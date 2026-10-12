import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AiConfiguration } from './config.js';
import { createGoogleAnalysisProvider, createGoogleTransport } from './google-transport.js';
import { safeProviderError } from './errors.js';

const config: AiConfiguration = { apiKey: 'test-only-not-a-real-key', analysisModel: 'gemini-3.8-flash', videoModel: 'gemini-omni-1.1-flash', timeoutMs: 1_000 };
const signal = new AbortController().signal;

// Mock only HTTP. The actual SDK constructor and transport run, with no live requests.
afterEach(() => vi.unstubAllGlobals());

describe('Google HTTP transport boundaries', () => {
  it('uploads private MP4 bytes with a bounded authenticated Files session and no API key on the session request', async () => {
    const uploadUrl = 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=fixture-only&upload_protocol=resumable';
    const file = { name: 'files/upload-fixture', uri: 'https://generativelanguage.googleapis.com/v1beta/files/upload-fixture', state: 'PROCESSING' };
    const fetcher = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { headers: { 'x-goog-upload-url': uploadUrl } }))
      .mockResolvedValueOnce(Response.json({ file }));
    vi.stubGlobal('fetch', fetcher);
    const bytes = Buffer.from('000000186674797069736f6d0000000069736f6d', 'hex'); // Container-only test bytes.
    expect(await createGoogleTransport(config).uploadVideo(bytes, signal)).toEqual(file);
    const start = new Request(...fetcher.mock.calls[0]!);
    expect(start.url).toBe('https://generativelanguage.googleapis.com/upload/v1beta/files');
    expect(start.headers.get('x-goog-api-key')).toBe(config.apiKey);
    expect(start.headers.get('x-goog-upload-header-content-length')).toBe(String(bytes.length));
    expect(start.headers.get('x-goog-upload-header-content-type')).toBe('video/mp4');
    expect(await start.json()).toEqual({ file: { display_name: 'AniForge original video edit input' } });
    const upload = new Request(...fetcher.mock.calls[1]!);
    expect(upload.url).toBe(uploadUrl);
    expect(upload.headers.get('x-goog-api-key')).toBeNull();
    expect(upload.headers.get('x-goog-upload-command')).toBe('upload, finalize');
    expect(Buffer.from(await upload.arrayBuffer())).toEqual(bytes);
    expect(fetcher.mock.calls.every(([, init]) => init?.signal === signal && init.redirect === 'error')).toBe(true);
  });

  it.each(['https://attacker.example/upload', 'http://generativelanguage.googleapis.com/upload/v1beta/files', 'https://generativelanguage.googleapis.com:444/upload/v1beta/files', 'https://user:pass@generativelanguage.googleapis.com/upload/v1beta/files', 'https://generativelanguage.googleapis.com/unexpected', 'not a URL'])('rejects an unapproved upload session URL without sending the MP4: %s', async (location) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { headers: { 'x-goog-upload-url': location } }));
    vi.stubGlobal('fetch', fetcher);
    const bytes = Buffer.from('000000186674797069736f6d0000000069736f6d', 'hex');
    await expect(createGoogleTransport(config).uploadVideo(bytes, signal)).rejects.toMatchObject({ code: 'AI_UNSAFE_MEDIA_URI' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deletes only a canonical Google file and treats an already deleted file as success', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetcher);
    await createGoogleTransport(config).deleteFile('files/input-fixture', signal);
    expect(fetcher).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/files/input-fixture', { method: 'DELETE', headers: { 'x-goog-api-key': config.apiKey }, signal, redirect: 'error' });
    await expect(createGoogleTransport(config).deleteFile('files/../../other-resource', signal)).rejects.toMatchObject({ code: 'AI_UNSAFE_MEDIA_URI' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([
    { input: 'Make the square green.', previous_interaction_id: 'fixture-parent' },
    { input: [{ type: 'video' as const, uri: 'https://generativelanguage.googleapis.com/v1beta/files/fixture-parent', mime_type: 'video/mp4' as const }, { type: 'text' as const, text: 'Make the square green.' }] },
  ])('passes the documented edit shape through the installed SDK without automatic retries', async (input) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      id: 'edited-http-fixture', object: 'interaction', model: config.videoModel,
      status: 'completed', created: '2026-10-13T00:00:00Z', updated: '2026-10-13T00:00:00Z',
      steps: [{ type: 'model_output', content: [{ type: 'video', mime_type: 'video/mp4', uri: 'files/edited' }] }],
    }));
    vi.stubGlobal('fetch', fetcher);
    await createGoogleTransport(config).create({ ...input, model: config.videoModel, response_format: { type: 'video', delivery: 'uri' }, background: false, stream: false, store: true }, signal);
    const request = new Request(...fetcher.mock.calls[0]!);
    expect(await request.json()).toMatchObject({ ...input, store: true, response_format: { delivery: 'uri' } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

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
