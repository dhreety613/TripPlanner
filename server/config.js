const env = process.env;

function pickProvider() {
  if (env.LLM_PROVIDER) return env.LLM_PROVIDER.toLowerCase();
  if (env.ANTHROPIC_API_KEY) return 'anthropic';
  if (env.LLM_API_KEY) return 'openai';
  return 'mock'; // zero-config demo mode: the app always works, even with no key
}

const provider = pickProvider();

export const config = {
  port: Number(env.PORT) || 8787,
  provider,
  anthropic: {
    apiKey: env.ANTHROPIC_API_KEY,
    model: env.LLM_MODEL || 'claude-haiku-5-5',
  },
  // Any OpenAI-compatible endpoint: OpenAI, Groq, OpenRouter, Gemini (compat), Ollama.
  openai: {
    apiKey: env.LLM_API_KEY || '',
    baseUrl: (env.LLM_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, ''),
    model: env.LLM_MODEL || 'gpt-4o-mini',
    // Some compat endpoints (e.g. Gemini 3.x) stall on SSE; LLM_STREAM=false uses one plain call.
    stream: env.LLM_STREAM !== 'false',
  },
  upstreamTimeoutMs: Number(env.UPSTREAM_TIMEOUT_MS) || 90_000,
  rateLimit: { windowMs: 60_000, max: Number(env.RATE_LIMIT_PER_MIN) || 12 },
  maxConcurrent: Number(env.MAX_CONCURRENT) || 8,
};
