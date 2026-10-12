import { GoogleGenAI } from '@google/genai';
import type { AiConfiguration } from './config.js';
import { AiProviderError } from './errors.js';
import { GeminiOmniVideoProvider, type GoogleAiTransport } from './provider.js';

const GOOGLE_API_ORIGIN = 'https://generativelanguage.googleapis.com';
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export function createGoogleAiProvider(config: AiConfiguration): GeminiOmniVideoProvider {
  return new GeminiOmniVideoProvider(config, createGoogleTransport(config));
}

export function createGoogleTransport(config: AiConfiguration): GoogleAiTransport {
  const client = new GoogleGenAI({ apiKey: config.apiKey, httpOptions: { timeout: config.timeoutMs } });
  return {
    create: async (request, signal) => client.interactions.create(request, { signal, timeout: config.timeoutMs, maxRetries: 0 }),
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
