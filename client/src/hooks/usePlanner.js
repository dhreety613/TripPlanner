import { useCallback, useEffect, useRef, useState } from 'react';
import { streamPlan, ApiError } from '../lib/api.js';
import { toBlocks } from '../lib/planReducer.js';

const MAX_AUTO_RETRIES = 1;
const wait = (ms, signal) =>
  new Promise((res, rej) => {
    const t = setTimeout(res, ms);
    signal.addEventListener('abort', () => (clearTimeout(t), rej(signal.reason)), { once: true });
  });

/**
 * Owns the request lifecycle. Guarantees:
 *  - only the newest request can mutate state (reqId guard + AbortController),
 *  - a failed request with no output restores the previous plan,
 *  - a failed request with partial output keeps it and surfaces the error,
 *  - one silent auto-retry for retryable failures before any block arrived.
 */
export function usePlanner(dispatch) {
  const [state, setState] = useState({ status: 'idle', error: null, dropped: 0, blocks: 0 });
  const reqId = useRef(0);
  const ctrl = useRef(null);
  useEffect(() => () => ctrl.current?.abort(), []);

  const run = useCallback(
    async ({ prompt, currentPlan }) => {
      const id = ++reqId.current;
      ctrl.current?.abort();
      const c = new AbortController();
      ctrl.current = c;
      const live = () => id === reqId.current;
      const current = currentPlan ? toBlocks(currentPlan) : undefined;

      dispatch({ type: 'stream/start' });
      setState({ status: 'loading', error: null, dropped: 0, blocks: 0 });
      let blocks = 0;
      let dropped = 0;

      for (let attempt = 0; ; attempt++) {
        try {
          await streamPlan({
            prompt,
            current,
            signal: c.signal,
            onEvent: (ev) => {
              if (!live()) return;
              if (ev.event === 'block') {
                blocks++;
                dispatch({ type: 'stream/block', block: ev.block });
                setState((s) => ({ ...s, status: 'streaming', blocks }));
              } else if (ev.event === 'warn') {
                dropped++;
                setState((s) => ({ ...s, dropped }));
              }
            },
          });
          if (live()) setState((s) => ({ ...s, status: 'done' }));
          return;
        } catch (e) {
          if (!live()) return; // superseded: a stale response must never touch state
          if (c.signal.aborted) return;
          const err = e instanceof ApiError ? e : new ApiError('UNKNOWN', 'Something went wrong.', true);
          if (err.retryable && blocks === 0 && attempt < MAX_AUTO_RETRIES) {
            setState((s) => ({ ...s, status: 'retrying' }));
            try {
              await wait(900, c.signal);
            } catch {
              return;
            }
            if (!live()) return;
            continue;
          }
          if (blocks === 0) dispatch({ type: 'stream/revert' });
          setState((s) => ({ ...s, status: 'error', error: { code: err.code, message: err.message, partial: blocks > 0, retryable: err.retryable } }));
          return;
        }
      }
    },
    [dispatch],
  );

  const cancel = useCallback(() => {
    reqId.current++;
    ctrl.current?.abort();
    dispatch({ type: 'stream/revert' });
    setState((s) => ({ ...s, status: 'idle', error: null }));
  }, [dispatch]);

  const dismiss = useCallback(() => setState((s) => ({ ...s, status: s.status === 'error' ? 'idle' : s.status, error: null })), []);

  return { ...state, busy: ['loading', 'streaming', 'retrying'].includes(state.status), run, cancel, dismiss };
}
