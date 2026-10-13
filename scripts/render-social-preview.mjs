import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Reuse the API's declared image dependency; no downloaded art or fonts.
const sharp = createRequire(new URL('../apps/api/package.json', import.meta.url))('sharp');
const source = fileURLToPath(new URL('../apps/web/public/social-preview.svg', import.meta.url));
const output = fileURLToPath(new URL('../apps/web/public/social-preview.png', import.meta.url));
const result = await sharp(source).png().toFile(output);
console.info(`Exported original social preview: ${result.width}x${result.height}. Review it before publishing.`);
