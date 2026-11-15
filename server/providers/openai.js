import { ProviderError, sseData, toProviderError } from './http.js';

// Works with any OpenAI-compatible chat completions API (OpenAI, Groq, OpenRouter,
// Gemini's compat endpoint, Ollama). Set LLM_BASE_URL / LLM_MODEL / LLM_API_KEY.
export function createOpenAICompat({ apiKey, baseUrl, model, stream = true }) {
  return {
    name: 'openai-compat',
    model,
    async *stream({ system, user, signal }) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          stream,
          temperature: 0.7,
          max_tokens: 4096,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        }),
      });
      if (!res.ok) throw await toProviderError(res);
      if (!stream) {
        // Non-streaming: one JSON reply. The server's line parser still emits blocks one by one.
        const json = await res.json().catch(() => null);
        const text = json?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) {
          throw new ProviderError('UPSTREAM_ERROR', 'The AI provider returned no content.', { status: 502, retryable: true });
        }
        yield text;
        return;
      }
      for await (const data of sseData(res.body)) {
        if (data === '[DONE]') return;
        let ev;
        try {
          ev = JSON.parse(data);
        } catch {
          continue;
        }
        if (ev.error) throw new ProviderError('UPSTREAM_ERROR', 'The AI provider stream failed.', { status: 502, retryable: true });
        const text = ev.choices?.[0]?.delta?.content;
        if (text) yield text;
      }
    },
  };
}
