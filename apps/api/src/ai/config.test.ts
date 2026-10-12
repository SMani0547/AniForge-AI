import { describe, expect, it } from 'vitest';
import { readAiConfiguration, readAnalysisConfiguration } from './config.js';

const enabled = { ENABLE_REAL_AI: 'true', GEMINI_API_KEY: 'unit-test-key' };

describe('application analysis configuration', () => {
  it('requires explicit paid opt-in and a server key', () => {
    expect(() => readAnalysisConfiguration({})).toThrow('ENABLE_REAL_AI=true');
    expect(() => readAnalysisConfiguration({ ENABLE_REAL_AI: 'true' })).toThrow('GEMINI_API_KEY');
  });

  it('does not require or validate unrelated video configuration', () => {
    expect(readAnalysisConfiguration({ ...enabled, GEMINI_VIDEO_MODEL: 'not-configured-yet', AI_TIMEOUT_MS: 'invalid' })).toEqual({
      apiKey: enabled.GEMINI_API_KEY, analysisModel: 'gemini-3.8-flash', timeoutMs: 40_000,
    });
  });

  it.each(['999', '45001', '1200000', 'invalid'])('rejects unsafe synchronous analysis timeout %s without revealing keys', (ANALYSIS_TIMEOUT_MS) => {
    expect(() => readAnalysisConfiguration({ ...enabled, ANALYSIS_TIMEOUT_MS })).toThrow('ANALYSIS_TIMEOUT_MS (1000 to 45000)');
    try { readAnalysisConfiguration({ ...enabled, ANALYSIS_TIMEOUT_MS }); }
    catch (error) { expect(String(error)).not.toContain(enabled.GEMINI_API_KEY); }
  });

  it('keeps the intentional CLI smoke deadline separate from browser analysis', () => {
    const environment = { ...enabled, ANALYSIS_TIMEOUT_MS: '20000', AI_TIMEOUT_MS: '300000' };
    expect(readAnalysisConfiguration(environment).timeoutMs).toBe(20_000);
    expect(readAiConfiguration(environment).timeoutMs).toBe(300_000);
  });
});
