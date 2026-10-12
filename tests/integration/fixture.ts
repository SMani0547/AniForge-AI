import { crc32, deflateSync } from 'node:zlib';

// Original geometric test artwork, generated locally; no downloaded art or AI.
export function originalImage(): Buffer {
  const width = 64; const height = 48;
  const pixels = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inside = x >= 12 && x < 52 && y >= 10 && y < 38;
      const offset = y * (width * 3 + 1) + 1 + x * 3;
      pixels.set(inside ? [69, 129, 244] : [239, 226, 205], offset);
    }
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4);
  header[8] = 8; header[9] = 2;
  function chunk(type: string, data: Buffer) {
    const buffer = Buffer.alloc(data.length + 12);
    buffer.writeUInt32BE(data.length); buffer.write(type, 4); data.copy(buffer, 8);
    buffer.writeUInt32BE(crc32(buffer.subarray(4, data.length + 8)), data.length + 8);
    return buffer;
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
