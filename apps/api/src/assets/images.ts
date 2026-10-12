import sharp from 'sharp';
import { MAX_IMAGE_PIXELS, MAX_UPLOAD_BYTES } from '@aniforge/shared';
import { ApiError } from '../errors.js';

export { MAX_IMAGE_PIXELS, MAX_UPLOAD_BYTES };
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export interface NormalizedImage { bytes: Buffer; width: number; height: number }

function detectedType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function hasPngAnimation(bytes: Buffer): boolean {
  // libvips can decode only the default APNG frame and omit metadata.pages.
  // Inspect actual PNG chunk boundaries, never arbitrary pixel/text byte matches.
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const next = offset + 12 + length;
    if (next > bytes.length) throw new Error('Truncated PNG chunk.');
    const type = bytes.toString('ascii', offset + 4, offset + 8);
    if (type === 'acTL') return true;
    if (type === 'IEND') return false;
    offset = next;
  }
  return false;
}

/** Decode and re-encode untrusted images; strip metadata and bake EXIF orientation into pixels. */
export async function normalizeImage(bytes: Buffer, contentType: string): Promise<NormalizedImage> {
  if (!bytes.length || bytes.length > MAX_UPLOAD_BYTES) throw new ApiError(413, 'IMAGE_TOO_LARGE', 'Choose an image smaller than 10 MiB.');
  const detected = detectedType(bytes);
  if (!detected || detected !== contentType) throw new ApiError(400, 'INVALID_IMAGE', 'Choose a valid PNG, JPEG or WEBP image with a matching file type.');
  try {
    if (detected === 'image/png' && hasPngAnimation(bytes)) throw new Error('Animated PNG is not supported.');
    const input = sharp(bytes, { limitInputPixels: MAX_IMAGE_PIXELS, failOn: 'warning' });
    const metadata = await input.metadata();
    const formats: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };
    if (metadata.format !== formats[contentType] || !metadata.width || !metadata.height || metadata.width * metadata.height > MAX_IMAGE_PIXELS || (metadata.pages ?? 1) > 1) {
      throw new Error('Unsupported image dimensions or animation.');
    }
    const result = await input.rotate().png().toBuffer({ resolveWithObject: true });
    if (result.data.length > MAX_UPLOAD_BYTES) throw new ApiError(413, 'IMAGE_TOO_LARGE', 'The decoded image exceeds 10 MiB. Reduce its dimensions before importing.');
    return { bytes: result.data, width: result.info.width, height: result.info.height };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'INVALID_IMAGE', 'The image could not be decoded. Use a still PNG, JPEG or WEBP image of at most 16 megapixels.');
  }
}
