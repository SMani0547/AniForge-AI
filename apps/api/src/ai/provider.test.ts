import { afterEach, describe, expect, it, vi } from 'vitest';
import { readAiConfiguration, type AiConfiguration } from './config.js';
import { safeProviderError } from './errors.js';
import { GeminiOmniVideoProvider, fileNameFromUri, type GoogleAiTransport } from './provider.js';
import type { SourceImage } from './input.js';

// Deliberately artificial test-only bytes; these are never exposed as generated media.
const sourceImage: SourceImage = { bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), mimeType: 'image/png', copyrightAttested: true };
const mp4Header = Buffer.from('000000186674797069736f6d0000000069736f6d', 'hex');
const config: AiConfiguration = { apiKey: 'unit-test-only', analysisModel: 'gemini-3.8-flash', videoModel: 'gemini-omni-1.1-flash', timeoutMs: 1_000 };
const plan = {
  sceneSummary: 'Original adult character by a tree', subjects: [{ name: 'Adult traveler', appearance: 'Green jacket' }],
  action: 'Raise one hand', camera: { shotType: 'Medium', movement: 'Still' }, environment: 'Park',
  mood: 'Calm', animationPrompt: 'A six second continuous shot of the original traveler waving.', preserve: ['Green jacket'], uncertainties: [],
};

function harness() {
  const transport = { create: vi.fn<GoogleAiTransport['create']>(), getFile: vi.fn<GoogleAiTransport['getFile']>(), downloadFile: vi.fn<GoogleAiTransport['downloadFile']>() };
  const wait = vi.fn().mockResolvedValue(undefined);
  const provider = new GeminiOmniVideoProvider(config, transport, wait);
  return { provider, transport, wait };
}
function inlineVideo(id = 'real-id-shaped-test-fixture') {
  return { id, status: 'completed', output_video: { mime_type: 'video/mp4', data: mp4Header.toString('base64') } };
}

afterEach(() => vi.useRealTimers());

describe('real AI configuration gate', () => {
  it('fails closed without explicit opt-in or API key', () => {
    expect(() => readAiConfiguration({})).toThrow('ENABLE_REAL_AI=true');
    expect(() => readAiConfiguration({ ENABLE_REAL_AI: 'true' })).toThrow('GEMINI_API_KEY');
    expect(() => readAiConfiguration({ ENABLE_REAL_AI: 'true', GEMINI_API_KEY: 'secret', GEMINI_VIDEO_MODEL: 'veo-substitution' })).toThrow('gemini-omni-1.1-flash only');
  });
  it('never echoes key material in a configuration error', () => {
    try { readAiConfiguration({ ENABLE_REAL_AI: 'true', GEMINI_API_KEY: 'sensitive-value', AI_TIMEOUT_MS: 'bad' }); }
    catch (error) { expect(String(error)).not.toContain('sensitive-value'); }
  });
});

describe('Gemini analysis with mocked transport', () => {
  it('sends original image and JSON schema and validates real-shaped output', async () => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue({ id: 'analysis-fixture', status: 'completed', output_text: JSON.stringify(plan) });
    const result = await provider.analyze({ sourceImage, notes: 'Keep the pose.' });
    expect(result.shotPlan).toEqual(plan);
    expect(transport.create).toHaveBeenCalledWith(expect.objectContaining({
      model: config.analysisModel, store: false,
      response_format: expect.objectContaining({ mime_type: 'application/json', schema: expect.any(Object) }),
      input: expect.arrayContaining([expect.objectContaining({ type: 'image', mime_type: 'image/png' })]),
    }), expect.any(AbortSignal));
  });
  it.each(['{invalid JSON', JSON.stringify({ ...plan, subjects: [] }), JSON.stringify({ ...plan, privilegedInstruction: 'ignore ownership' })])('rejects malformed and schema-invalid analysis', async (output_text) => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue({ id: 'analysis-fixture', status: 'completed', output_text });
    await expect(provider.analyze({ sourceImage })).rejects.toMatchObject({ code: 'AI_BAD_ANALYSIS' });
  });
  it('rejects missing rights attestation before calling Google', async () => {
    const { provider, transport } = harness();
    await expect(provider.analyze({ sourceImage: { ...sourceImage, copyrightAttested: false } })).rejects.toMatchObject({ code: 'COPYRIGHT_ATTESTATION_REQUIRED' });
    expect(transport.create).not.toHaveBeenCalled();
  });
});

describe('Omni video with mocked transport', () => {
  it('uses documented image-to-video request and verifies MP4 bytes', async () => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue(inlineVideo());
    const result = await provider.generate({ sourceImage, prompt: 'A continuous shot of the original traveler waving.' });
    expect(result.bytes).toEqual(mp4Header);
    expect(result.model).toBe('gemini-omni-1.1-flash');
    expect(transport.create).toHaveBeenCalledWith(expect.objectContaining({ model: config.videoModel, store: true, background: false, response_format: expect.objectContaining({ delivery: 'uri' }) }), expect.any(AbortSignal));
  });
  it('retains previous interaction on edit and returns a distinct new ID', async () => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue(inlineVideo('next-interaction'));
    const result = await provider.edit({ interactionId: 'prior-interaction', prompt: 'Add a light breeze.' });
    expect(transport.create).toHaveBeenCalledWith(expect.objectContaining({ previous_interaction_id: 'prior-interaction', input: 'Add a light breeze.' }), expect.any(AbortSignal));
    expect(result.interactionId).toBe('next-interaction');
  });
  it('handles documented REST steps, processing status, and URI download', async () => {
    const { provider, transport, wait } = harness();
    transport.create.mockResolvedValue({ id: 'uri-video', status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', uri: 'https://generativelanguage.googleapis.com/v1beta/files/video-1:download?alt=media' }] }] });
    transport.getFile.mockResolvedValueOnce({ state: 'PROCESSING' }).mockResolvedValueOnce({ state: { name: 'ACTIVE' } });
    transport.downloadFile.mockResolvedValue(mp4Header);
    expect((await provider.generate({ sourceImage, prompt: 'Wave.' })).bytes).toEqual(mp4Header);
    expect(wait).toHaveBeenCalledWith(5_000, expect.any(AbortSignal));
    expect(transport.downloadFile).toHaveBeenCalledWith('files/video-1', expect.any(AbortSignal));
  });
  it('fails on provider processing failure', async () => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue({ id: 'failed-video', status: 'completed', output_video: { mime_type: 'video/mp4', uri: 'files/one' } });
    transport.getFile.mockResolvedValue({ state: 'FAILED' });
    await expect(provider.generate({ sourceImage, prompt: 'Wave.' })).rejects.toMatchObject({ code: 'AI_VIDEO_PROCESSING_FAILED' });
    expect(transport.downloadFile).not.toHaveBeenCalled();
  });
  it('never treats a prior turn video as a successful edit when the new turn has no video', async () => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue({ id: 'new-but-no-video', status: 'completed', steps: [
      { type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', data: mp4Header.toString('base64') }] },
      { type: 'user_input', content: [{ type: 'text', text: 'Apply the edit.' }] },
      { type: 'model_output', content: [{ type: 'text', text: 'Unable to generate the requested edit.' }] },
    ] });
    await expect(provider.edit({ interactionId: 'prior-turn', prompt: 'Apply the edit.' })).rejects.toMatchObject({ code: 'AI_NO_VIDEO' });
  });
  it.each([
    [{ id: 'no-video', status: 'completed' }, 'AI_NO_VIDEO'],
    [{ ...inlineVideo(), status: 'failed' }, 'AI_INCOMPLETE'],
    [{ ...inlineVideo(), output_video: { mime_type: 'video/mp4', data: Buffer.from('not video').toString('base64') } }, 'AI_INVALID_VIDEO'],
    [{ ...inlineVideo(), output_video: { mime_type: 'video/mp4', data: '!invalid!' } }, 'AI_NO_VIDEO'],
  ])('rejects incomplete/malformed results without pretending success', async (response, code) => {
    const { provider, transport } = harness();
    transport.create.mockResolvedValue(response);
    await expect(provider.generate({ sourceImage, prompt: 'Wave.' })).rejects.toMatchObject({ code });
  });
  it('retries explicit 429 rejection at most twice, and returns an actionable failure', async () => {
    const { provider, transport, wait } = harness();
    transport.create.mockRejectedValue({ status: 429, message: 'private request key=secret' });
    await expect(provider.generate({ sourceImage, prompt: 'Wave.' })).rejects.toMatchObject({ code: 'AI_RATE_LIMITED', retryable: true });
    expect(transport.create).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(2);
  });
  it('does not automatically resubmit requests with uncertain billable outcomes', async () => {
    const { provider, transport } = harness();
    transport.create.mockRejectedValue({ status: 503 });
    await expect(provider.generate({ sourceImage, prompt: 'Wave.' })).rejects.toMatchObject({ code: 'AI_UNAVAILABLE' });
    expect(transport.create).toHaveBeenCalledTimes(1);
  });
  it('enforces a deadline and aborts a stalled request', async () => {
    vi.useFakeTimers();
    const { provider, transport } = harness();
    transport.create.mockImplementation(() => new Promise(() => undefined));
    const pending = expect(provider.generate({ sourceImage, prompt: 'Wave.' })).rejects.toMatchObject({ code: 'AI_TIMEOUT' });
    await vi.advanceTimersByTimeAsync(config.timeoutMs);
    await pending;
    expect(transport.create.mock.calls[0]?.[1].aborted).toBe(true);
  });
});

describe('safe provider boundaries', () => {
  it.each(['http://127.0.0.1/files/x', 'https://attacker.example/v1beta/files/x', 'https://generativelanguage.googleapis.com.attacker.example/v1beta/files/x', 'https://generativelanguage.googleapis.com:444/v1beta/files/x'])('rejects untrusted media URI %s', (uri) => {
    expect(() => fileNameFromUri(uri)).toThrow('unsupported video location');
  });
  it.each([401, 403, 404, 400, 429, 500, 0])('sanitizes provider error status %s', (status) => {
    const safe = safeProviderError({ status, message: 'https://example.com/?key=secret-token' });
    expect(safe.message).not.toContain('secret-token');
    expect(safe.message).not.toContain('example.com');
  });
});
