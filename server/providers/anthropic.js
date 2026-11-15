import { ProviderError, sseData, toProviderError } from './http.js';

export function createAnthropic({ apiKey, model }) {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required for provider=anthropic');
  return {
    name: 'anthropic',
    model,
    async *stream({ system, user, signal }) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          stream: true,
          system,
          messages: [{ role: 'user', content: user }],
        }),
      });
      if (!res.ok) throw await toProviderError(res);
      for await (const data of sseData(res.body)) {
        let ev;
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') yield ev.delta.text;
        else if (ev.type === 'error')
          throw new ProviderError('UPSTREAM_ERROR', 'The AI provider stream failed.', { status: 502, retryable: true });
      }
    },
  };
}
