import { emulatorEnvironment, workspace } from './emulator-env.mjs';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || !['dev', 'test'].includes(process.env.ANIFORGE_EMULATOR_PROFILE)) throw new Error('Launch services through the isolated emulator launcher.');
const env = emulatorEnvironment();
for (const name of Object.keys(process.env)) if (!(name in env)) delete process.env[name];
Object.assign(process.env, env);
const mode = process.argv[2];
if (mode === 'api') {
  // No --env-file: personal credentials never enter this local-only server.
  await import('tsx/esm/api').then(({ register }) => register());
  await import('../apps/api/src/server.ts');
} else if (mode === 'web' || mode === 'web-test') {
  if ((mode === 'web-test') !== (env.ANIFORGE_EMULATOR_PROFILE === 'test')) throw new Error('The web service must match its emulator profile.');
  const { createServer } = await import('vite');
  const server = await createServer({ root: `${workspace}/apps/web`, envDir: false, mode: 'emulator', server: { host: '127.0.0.1', port: Number(env.ANIFORGE_EMULATOR_WEB_PORT), strictPort: true, proxy: { '/api': `http://127.0.0.1:${env.PORT}` }, ...(mode === 'web-test' ? { watch: null, hmr: false } : {}) } });
  await server.listen();
  server.printUrls();
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => { void server.close(); });
} else throw new Error('Usage: node scripts/emulator-service.mjs api|web|web-test');
