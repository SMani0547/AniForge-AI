import { AiProviderError } from './errors.js';

export const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
export type ImageMimeType = 'image/png' | 'image/jpeg' | 'image/webp';
export interface SourceImage {
  bytes: Buffer;
  mimeType: ImageMimeType;
  copyrightAttested: boolean;
}

export function identifyImage(bytes: Buffer): ImageMimeType {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  throw new AiProviderError('INVALID_SOURCE_IMAGE', 'Provide an original PNG, JPEG, or WebP image. The file signature is unsupported.');
}

export function validateSourceImage(image: SourceImage): void {
  if (!image.copyrightAttested) {
    throw new AiProviderError('COPYRIGHT_ATTESTATION_REQUIRED', 'Confirm that you own the original image and have permission to send it to Google AI.');
  }
  if (image.bytes.length === 0 || image.bytes.length > MAX_SOURCE_BYTES) {
    throw new AiProviderError('INVALID_SOURCE_IMAGE', 'The source image must be nonempty and at most 10 MiB.');
  }
  if (identifyImage(image.bytes) !== image.mimeType) {
    throw new AiProviderError('INVALID_SOURCE_IMAGE', 'The declared image format does not match its file signature.');
  }
}

export function validatePrompt(prompt: string): string {
  if (!prompt.trim() || prompt.length > 8_000) {
    throw new AiProviderError('INVALID_PROMPT', 'Enter a nonempty prompt of at most 8000 characters.');
  }
  return prompt.trim();
}
