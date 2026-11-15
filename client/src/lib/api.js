import { parseBlock } from '@trip/shared';

export class ApiError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

const STALL_MS = 30_000; // no bytes for this long => treat the stream as dead

/**
 * POST /api/plan and consume the NDJSON event stream.
 * onEvent receives {event:'block', block} | {event:'warn', reason} | {event:'start'} | {event:'done'}.
 * Rejects with ApiError (or AbortError when the caller aborted).
 */
export async function streamPlan({ prompt, current, signal, onEvent }) {
  const inner = new AbortController();
  let stalled = false;
  let timer;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      stalled = true;
      inner.abort();
    }, STALL_MS);
  };
  const onAbort = () => inner.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    arm();
    let res;
    try {
      res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt, current }),
        signal: inner.signal,
      });
    } catch (e) {
      if (signal?.aborted) throw e;
      if (stalled) throw new ApiError('STALLED', 'The server stopped responding.', true);
      throw new ApiError('NETWORK', "Can't reach the server. Check your connection.", true);
    }

    if (!res.ok) {
      let err = {};
      try {
        err = (await res.json()).error ?? {};
      } catch {}
      throw new ApiError(err.code || `HTTP_${res.status}`, err.message || `Request failed (${res.status}).`, err.retryable ?? res.status >= 500);
    }
    if (!res.body) throw new ApiError('NO_STREAM', 'Streaming is not supported in this browser.');

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    let finished = false;

    const handle = (line) => {
      if (!line.trim()) return;
      let ev;
      try {
        ev = JSON.parse(line);
      } catch {
        return; // transport-level garbage: ignore
      }
      if (ev.event === 'block') {
        const r = parseBlock(ev.data); // validate again: never trust the wire
        if (r.ok) onEvent({ event: 'block', block: r.block });
        else onEvent({ event: 'warn', reason: r.reason });
      } else if (ev.event === 'error') {
        throw new ApiError(ev.code || 'ERROR', ev.message || 'Generation failed.', !!ev.retryable);
      } else if (ev.event === 'done') {
        finished = true;
        onEvent(ev);
      } else onEvent(ev);
    };

    try {
      for (;;) {
        let chunk;
        try {
          chunk = await reader.read();
        } catch (e) {
          if (signal?.aborted) throw e;
          if (stalled) throw new ApiError('STALLED', 'The server stopped responding.', true);
          throw new ApiError('TRUNCATED', 'The connection dropped mid-response.', true);
        }
        if (chunk.done) break;
        arm();
        buf += dec.decode(chunk.value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          handle(buf.slice(0, i));
          buf = buf.slice(i + 1);
        }
      }
      handle(buf);
    } finally {
      reader.cancel().catch(() => {});
    }
    if (!finished) throw new ApiError('TRUNCATED', 'The response ended early.', true);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}
