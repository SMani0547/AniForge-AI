import { z } from 'zod';
import { AiProviderError } from './errors.js';

const configurationSchema = z.object({
  ENABLE_REAL_AI: z.literal('true'),
  GEMINI_API_KEY: z.string().trim().min(1),
  GEMINI_ANALYSIS_MODEL: z.string().trim().min(1).default('gemini-3.8-flash'),
  GEMINI_VIDEO_MODEL: z.literal('gemini-omni-1.1-flash').default('gemini-omni-1.1-flash'),
  AI_TIMEOUT_MS: z.coerce.number().int().min(1000).max(1_200_000).default(300_000),
});

export interface AiConfiguration {
  apiKey: string;
  analysisModel: string;
  videoModel: 'gemini-omni-1.1-flash';
  timeoutMs: number;
}

export function readAiConfiguration(environment: NodeJS.ProcessEnv): AiConfiguration {
  if (environment.ENABLE_REAL_AI !== 'true') {
    throw new AiProviderError('REAL_AI_DISABLED', 'Real AI is disabled. Set ENABLE_REAL_AI=true only after confirming paid API billing.');
  }
  if (!environment.GEMINI_API_KEY?.trim()) {
    throw new AiProviderError('AI_KEY_MISSING', 'Set GEMINI_API_KEY on the server from a billing-enabled Google AI Studio project. Never put it in VITE_* variables.');
  }
  const parsed = configurationSchema.safeParse(environment);
  if (!parsed.success) {
    throw new AiProviderError('AI_CONFIG_INVALID', 'Invalid AI configuration. Verify model names and AI_TIMEOUT_MS (1000 to 1200000). The video adapter supports gemini-omni-1.1-flash only.');
  }
  return {
    apiKey: parsed.data.GEMINI_API_KEY,
    analysisModel: parsed.data.GEMINI_ANALYSIS_MODEL,
    videoModel: parsed.data.GEMINI_VIDEO_MODEL,
    timeoutMs: parsed.data.AI_TIMEOUT_MS,
  };
}
