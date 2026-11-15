export class ProviderError extends Error {
  constructor(code, message, { status, retryable = false } = {}) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryable = retryable;
  }
}

/** Map an upstream HTTP failure to a safe, user-presentable error (never leak upstream bodies/keys). */
export async function toProviderError(res) {
  let detail = '';
  try {
    detail = (await res.text()).slice(0, 200);
  } catch {}
  console.error(JSON.stringify({ level: 'warn', msg: 'upstream_error', status: res.status, detail }));
  if (res.status === 401 || res.status === 403)
    return new ProviderError('UPSTREAM_AUTH', 'The AI provider rejected the server credentials.', { status: 502 });
  if (res.status === 429)
    return new ProviderError('UPSTREAM_RATE_LIMIT', 'The AI provider is rate limiting us. Try again shortly.', {
      status: 503,
      retryable: true,
    });
  if (res.status >= 500)
    return new ProviderError('UPSTREAM_ERROR', 'The AI provider had an error.', { status: 502, retryable: true });
  return new ProviderError('UPSTREAM_BAD_REQUEST', 'The AI provider could not process the request.', { status: 502 });
}

/** Parse an SSE byte stream into `data:` payload strings. */
export async function* sseData(body) {
  const dec = new TextDecoder();
  let buf = '';
  for await (const chunk of body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.search(/\r?\n\r?\n/)) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i).replace(/^\r?\n\r?\n/, '');
      const data = frame
        .split(/\r?\n/)
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trimStart())
        .join('\n');
      if (data) yield data;
    }
  }
}
