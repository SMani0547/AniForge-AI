import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { emulatorEnvironment, workspace } from './emulator-env.mjs';

const mode = process.argv[2];
if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.ANIFORGE_EMULATOR_PROFILE !== mode) throw new Error('Run npm run dev:emulators or npm run test:emulators with its matching isolated profile.');
const env = emulatorEnvironment();
const children = [];
let stopping = false;
function start(args) {
  const child = spawn(process.execPath, args, { cwd: workspace, env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('exit', (code) => stop(code ?? 1));
}
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
if (mode === 'test') start([join(workspace, 'node_modules/@playwright/test/cli.js'), 'test', '--config', 'playwright.emulator.config.ts']);
else if (mode === 'dev') {
  start(['scripts/emulator-service.mjs', 'api']);
  start(['scripts/emulator-service.mjs', 'web']);
} else throw new Error('Usage: node scripts/emulator-run.mjs dev|test');
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop(0));
