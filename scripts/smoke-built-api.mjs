import assert from 'node:assert/strict';
import { buildApp } from '../apps/api/dist/app.js';
import { readConfig } from '../apps/api/dist/config.js';

// Exercises actual compiled imports and HTTP, with no Firebase credentials or AI provider.
const app = buildApp({ config: readConfig({ NODE_ENV: 'test', ALLOWED_ORIGINS: 'https://aniforge.invalid' }), repository: null, verifyToken: null });
try {
  const url = await app.listen({ host: '127.0.0.1', port: 0 });
  const get = (path, init) => fetch(`${url}${path}`, { ...init, signal: AbortSignal.timeout(5000) });
  assert.equal((await (await get('/health')).json()).data.status, 'ok');
  assert.equal((await get('/api/v1/projects')).status, 401);
  assert.equal((await get('/internal/jobs/execute', { method: 'POST' })).status, 404);
  const allowed = await get('/health', { headers: { origin: 'https://aniforge.invalid' } });
  assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://aniforge.invalid');
  const denied = await get('/health', { headers: { origin: 'https://untrusted.invalid' } });
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
  console.info('Compiled API smoke passed: HTTP health, missing-token rejection, private-worker route separation and CORS. Firebase/Google integration was not exercised.');
} finally { await app.close(); }
