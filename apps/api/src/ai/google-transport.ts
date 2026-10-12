import { GoogleGenAI } from '@google/genai';
import type { AiConfiguration, AnalysisConfiguration } from './config.js';
import { AiProviderError } from './errors.js';
import { GeminiOmniVideoProvider, GeminiSceneAnalysisProvider, fileNameFromUri, validateMp4, type AnalysisProvider, type GoogleAiTransport } from './provider.js';

const GOOGLE_API_ORIGIN = 'https://generativelanguage.googleapis.com';
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function createGoogleAiProvider(config: AiConfiguration): GeminiOmniVideoProvider {
  return new GeminiOmniVideoProvider(config, createGoogleTransport(config));
}

/** Real Google transport only: no demo provider or fallback successful response. */
export function createGoogleAnalysisProvider(config: AnalysisConfiguration): AnalysisProvider {
  return new GeminiSceneAnalysisProvider(config, createGoogleTransport(config));
}

export function createGoogleTransport(config: AnalysisConfiguration): GoogleAiTransport {
  const client = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: config.timeoutMs } });
  return {
    create: async (request, signal) => client.interactions.create(request, { signal, timeout: config.timeoutMs, maxRetries: 0 }),
    uploadVideo: async (bytes, signal) => {
      validateMp4(bytes);
      // Documented Files API resumable upload. Use the caller's single deadline and no retries.
      const start = await fetch(`${GOOGLE_API_ORIGIN}/upload/v1beta/files`, {
        method: 'POST', signal, redirect: 'error',
        headers: {
          'x-goog-api-key': config.apiKey,
          'x-goog-upload-protocol': 'resumable', 'x-goog-upload-command': 'start',
          'x-goog-upload-header-content-length': String(bytes.length),
          'x-goog-upload-header-content-type': 'video/mp4', 'content-type': 'application/json',
        },
        body: JSON.stringify({ file: { display_name: 'AniForge original video edit input' } }),
      });
      await start.body?.cancel();
      if (!start.ok) throw { status: start.status };
      const location = start.headers.get('x-goog-upload-url');
      let uploadUrl: URL;
      try { uploadUrl = new URL(location ?? ''); }
      catch { throw new AiProviderError('AI_UNSAFE_MEDIA_URI', 'Google AI returned an invalid upload location. No video was uploaded.'); }
      if (uploadUrl.origin !== GOOGLE_API_ORIGIN || uploadUrl.username || uploadUrl.password || uploadUrl.port || uploadUrl.hash || uploadUrl.pathname !== '/upload/v1beta/files') {
        throw new AiProviderError('AI_UNSAFE_MEDIA_URI', 'Google AI returned an unsupported upload location. No video was uploaded.');
      }
      const uploaded = await fetch(uploadUrl, {
        method: 'POST', signal, redirect: 'error',
        // The scoped upload session URL authorizes this call; do not forward the API key.
        headers: { 'content-length': String(bytes.length), 'content-type': 'video/mp4', 'x-goog-upload-offset': '0', 'x-goog-upload-command': 'upload, finalize' },
        body: new Uint8Array(bytes).buffer,
      });
      if (!uploaded.ok) { await uploaded.body?.cancel(); throw { status: uploaded.status }; }
      const data = await uploaded.json() as { file?: unknown };
      return data.file;
    },
    deleteFile: async (name, signal) => {
      const canonicalName = fileNameFromUri(name);
      const response = await fetch(`${GOOGLE_API_ORIGIN}/v1beta/${canonicalName}`, {
        method: 'DELETE', headers: { 'x-goog-api-key': config.apiKey }, signal, redirect: 'error',
      });
      await response.body?.cancel();
      if (!response.ok && response.status !== 404) throw { status: response.status };
    },
    getFile: async (name, signal) => {
      const response = await fetch(`${GOOGLE_API_ORIGIN}/v1beta/${name}`, {
        headers: { 'x-goog-api-key': config.apiKey }, signal, redirect: 'error',
      });
      if (!response.ok) throw { status: response.status };
      return response.json() as Promise<unknown>;
    },
    downloadFile: async (name, signal) => {
      let url = new URL(`${GOOGLE_API_ORIGIN}/v1beta/${name}:download?alt=media`);
      for (let redirects = 0; redirects <= 3; redirects++) {
        const response = await fetch(url, {
          // Credentials are sent only to the fixed Google API origin, never a signed redirect.
          headers: url.origin === GOOGLE_API_ORIGIN ? { 'x-goog-api-key': config.apiKey } : {},
          signal, redirect: 'manual',
        });
        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get('location');
          await response.body?.cancel();
          if (!location) throw new AiProviderError('AI_DOWNLOAD_FAILED', 'Google video download returned an invalid redirect.');
          const next = new URL(location, url);
          const approvedHost = next.origin === GOOGLE_API_ORIGIN || next.hostname === 'storage.googleapis.com' || next.hostname.endsWith('.googleusercontent.com');
          if (!approvedHost || next.protocol !== 'https:' || next.username || next.password || next.port) {
            throw new AiProviderError('AI_UNSAFE_MEDIA_URI', 'Google video download returned an unsupported redirect.');
          }
          url = next;
          continue;
        }
        if (!response.ok) {
          await response.body?.cancel();
          throw { status: response.status };
        }
        if (!response.body || Number(response.headers.get('content-length')) > MAX_VIDEO_BYTES) {
          await response.body?.cancel();
          throw new AiProviderError('AI_INVALID_VIDEO', 'The provider video is empty or exceeds 100 MiB.');
        }
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let size = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > MAX_VIDEO_BYTES) {
            await reader.cancel();
            throw new AiProviderError('AI_INVALID_VIDEO', 'The provider video exceeds 100 MiB.');
          }
          chunks.push(value);
        }
        return Buffer.concat(chunks, size);
      }
      throw new AiProviderError('AI_DOWNLOAD_FAILED', 'Google video download exceeded the redirect limit.');
    },
  };
}
