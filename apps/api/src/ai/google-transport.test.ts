import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfiguration } from './config.js';
import { createGoogleAnalysisProvider, createGoogleTransport } from './google-transport.js';
import { safeProviderError } from './errors.js';

const config: AiConfiguration = { apiKey: 'test-only-not-a-real-key', analysisModel: 'gemini-3.8-flash', videoModel: 'gemini-omni-1.1-flash', timeoutMs: 1_000 };
const signal = new AbortController().signal;

// Mock only HTTP. The actual SDK constructor and transport run, with no live requests.
afterEach(() => vi.unstubAllGlobals());

describe('Google HTTP transport boundaries', () => {
  it('sends inline image and structured JSON through the installed SDK and reads its current-turn analysis', async () => {
    const plan = {
      sceneSummary: 'An original geometric shape', subjects: [{ name: 'Square', appearance: 'Blue' }],
      action: 'Turn slowly', camera: { shotType: 'Wide', movement: 'Static' }, environment: 'White background',
      mood: 'Calm', animationPrompt: 'The original blue square turns slowly in one shot.', preserve: ['Blue color'], uncertainties: [],
    };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      id: 'analysis-http-fixture', object: 'interaction', model: config.analysisModel,
      status: 'completed', created: '2026-10-12T00:00:00Z', updated: '2026-10-12T00:00:00Z',
      steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify(plan) }] }],
    }));
    vi.stubGlobal('fetch', fetcher);
    const provider = createGoogleAnalysisProvider({ apiKey: config.apiKey, analysisModel: config.analysisModel, timeoutMs: 40_000 });
    const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]); // Signature-only test fixture, never a user-visible image.
    expect(await provider.analyze({ sourceImage: { bytes, mimeType: 'image/png', copyrightAttested: true } })).toEqual({
      shotPlan: plan, model: config.analysisModel, interactionId: 'analysis-http-fixture',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0]!;
    const request = new Request(url, init);
    expect(request.url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect(request.headers.get('x-goog-api-key')).toBe(config.apiKey);
    expect(await request.json()).toMatchObject({
      model: config.analysisModel, store: false, stream: false, background: false,
      response_format: { type: 'text', mime_type: 'application/json', schema: { type: 'object', additionalProperties: false } },
      input: expect.arrayContaining([{ type: 'image', data: bytes.toString('base64'), mime_type: 'image/png' }]),
    });
  });

  it('polls the fixed file API with server authentication and no automatic redirects', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ name: 'files/unit-test-file', state: 'ACTIVE' }));
    vi.stubGlobal('fetch', fetcher);
    const result = await createGoogleTransport(config).getFile('files/unit-test-file', signal);
    expect(result).toEqual({ name: 'files/unit-test-file', state: 'ACTIVE' });
    expect(fetcher).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/files/unit-test-file', {
      headers: { 'x-goog-api-key': config.apiKey }, redirect: 'error', signal,
    });
  });

  it('downloads from an approved signed redirect without forwarding the API key', async () => {
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://storage.googleapis.com/private-video/file?signature=test-only' } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetcher);
    expect(await createGoogleTransport(config).downloadFile('files/unit-test-file', signal)).toEqual(Buffer.from([1, 2, 3]));
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get('x-goog-api-key')).toBe(config.apiKey);
    expect(new Headers(fetcher.mock.calls[1]?.[1]?.headers).get('x-goog-api-key')).toBeNull();
    expect(fetcher.mock.calls[1]?.[1]?.redirect).toBe('manual');
    expect(String(fetcher.mock.calls[1]?.[0])).not.toContain(config.apiKey);
  });

  it.each(['https://attacker.example/steal', 'http://storage.googleapis.com/file', 'https://storage.googleapis.com.attacker.example/file', 'https://user:password@storage.googleapis.com/file'])('rejects a hostile redirect before following it: %s', async (location) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 302, headers: { location } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(createGoogleTransport(config).downloadFile('files/unit-test-file', signal)).rejects.toMatchObject({ code: 'AI_UNSAFE_MEDIA_URI' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('rejects an oversized video before consuming its body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([1]), { headers: { 'content-length': String(100 * 1024 * 1024 + 1) } }));
    vi.stubGlobal('fetch', fetcher);
    await expect(createGoogleTransport(config).downloadFile('files/unit-test-file', signal)).rejects.toMatchObject({ code: 'AI_INVALID_VIDEO' });
  });

  it('exposes an actionable status without propagating a private HTTP error body', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response('sensitive signed media URL and key', { status: 403 }));
    vi.stubGlobal('fetch', fetcher);
    const error = await createGoogleTransport(config).downloadFile('files/unit-test-file', signal).catch((failure: unknown) => safeProviderError(failure));
    expect(error).toMatchObject({ code: 'AI_ACCESS_DENIED' });
    expect(String(error)).not.toContain('sensitive signed');
  });

  it('uses the installed SDK to derive video output from documented interaction steps', async () => {
    const video = { type: 'video', mime_type: 'video/mp4', data: 'unit-test-only' };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      id: 'unit-test-interaction', object: 'interaction', model: config.videoModel,
      status: 'completed', created: '2026-10-12T00:00:00Z', updated: '2026-10-12T00:00:00Z',
      steps: [{ type: 'model_output', content: [video] }],
    }));
    vi.stubGlobal('fetch', fetcher);
    const result = await createGoogleTransport(config).create({
      model: config.videoModel, input: 'Test-only request intercepted by mocked fetch.',
      response_format: { type: 'video', delivery: 'uri' }, background: false, stream: false, store: true,
    }, signal);
    expect(result).toMatchObject({ id: 'unit-test-interaction', output_video: video });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
