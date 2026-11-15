import { config } from '../config.js';
import { createAnthropic } from './anthropic.js';
import { createOpenAICompat } from './openai.js';
import { createMock } from './mock.js';

export function getProvider() {
  switch (config.provider) {
    case 'anthropic':
      return createAnthropic(config.anthropic);
    case 'openai':
      return createOpenAICompat(config.openai);
    case 'mock':
      return createMock();
    default:
      throw new Error(`Unknown LLM_PROVIDER "${config.provider}" (use anthropic | openai | mock)`);
  }
}
