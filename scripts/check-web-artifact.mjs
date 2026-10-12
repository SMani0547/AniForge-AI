import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../apps/web/dist/', import.meta.url));
const canary = 'ANIFORGE_SERVER_SECRET_CANARY_NOT_A_REAL_KEY';
// Firebase's public API key is expected in the browser. Do not reject all AIza keys.
const forbiddenValues = [canary, process.env.GEMINI_API_KEY].filter((value) => value && value.length >= 12);
const findings = [];
let files = 0;
async function inspect(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) { findings.push('Symbolic links are not permitted in the web artifact'); continue; }
    if (entry.isDirectory()) { await inspect(path); continue; }
    files++;
    const label = relative(root, path);
    if (/^\.env|\.map$|credentials|service[-_]?account|\.pem$|\.key$/i.test(entry.name)) findings.push(`Unexpected sensitive/source-map file: ${label}`);
    const bytes = await readFile(path);
    if (forbiddenValues.some((value) => bytes.includes(Buffer.from(value))) || /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|"private_key"\s*:|"type"\s*:\s*"service_account"/.test(bytes.toString('utf8'))) findings.push(`Potential server secret in: ${label}`);
  }
}
try {
  await readFile(join(root, 'index.html')); await inspect(root);
  if (findings.length) throw new Error(findings.join('\n'));
  console.info(`Web artifact check passed (${files} files): no known server secret, private-key material, source maps or credential files detected. This is a bounded scan, not proof against every possible secret.`);
} catch (error) { console.error(error?.code === 'ENOENT' ? 'Web artifact is missing. Run npm run build first.' : error.message); process.exitCode = 1; }
