import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { crc32 } from 'node:zlib';
import { MAX_UPLOAD_BYTES, normalizeImage } from './images.js';

describe('untrusted image normalization', () => {
  it.each(['png', 'jpeg', 'webp'] as const)('decodes %s and emits metadata-free PNG pixels', async (format) => {
    const input = await sharp({ create: { width: 28, height: 16, channels: 3, background: '#246abc' } }).withMetadata({ density: 300 }).toFormat(format).toBuffer();
    const result = await normalizeImage(input, `image/${format}`);
    expect(result).toMatchObject({ width: 28, height: 16 });
    const metadata = await sharp(result.bytes).metadata();
    expect(metadata.format).toBe('png'); expect(metadata.exif).toBeUndefined(); expect(metadata.icc).toBeUndefined();
  });
  it('applies EXIF orientation before reporting stored dimensions', async () => {
    const input = await sharp({ create: { width: 28, height: 16, channels: 3, background: '#246abc' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const result = await normalizeImage(input, 'image/jpeg');
    expect(result).toMatchObject({ width: 16, height: 28 });
    expect((await sharp(result.bytes).metadata()).orientation).toBeUndefined();
  });
  it('rejects a mismatched MIME type and disguised SVG', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await expect(normalizeImage(png, 'image/jpeg')).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
    await expect(normalizeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/png')).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });
  it('rejects empty, truncated, and oversized inputs', async () => {
    await expect(normalizeImage(Buffer.alloc(0), 'image/png')).rejects.toMatchObject({ statusCode: 413 });
    await expect(normalizeImage(Buffer.alloc(MAX_UPLOAD_BYTES + 1), 'image/png')).rejects.toMatchObject({ statusCode: 413 });
    const input = await sharp({ create: { width: 28, height: 16, channels: 3, background: '#246abc' } }).png().toBuffer();
    await expect(normalizeImage(input.subarray(0, 35), 'image/png')).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });
  it('bounds decompressed pixels before attempting PNG output', async () => {
    const input = await sharp({ create: { width: 4001, height: 4000, channels: 3, background: '#ffffff' } }).png().toBuffer();
    await expect(normalizeImage(input, 'image/png')).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });
  it('rejects APNG animation controls even when the decoder reports a still image', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#ffffff' } }).png().toBuffer();
    const control = Buffer.alloc(20);
    control.writeUInt32BE(8); control.write('acTL', 4); control.writeUInt32BE(2, 8);
    control.writeUInt32BE(crc32(control.subarray(4, 16)), 16);
    // APNG animation control follows IHDR; PNG-only decoders ignore it.
    const animated = Buffer.concat([png.subarray(0, 33), control, png.subarray(33)]);
    expect((await sharp(animated).metadata()).pages).toBeUndefined();
    await expect(normalizeImage(animated, 'image/png')).rejects.toMatchObject({ code: 'INVALID_IMAGE' });
  });
});
