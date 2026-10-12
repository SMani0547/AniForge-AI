import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { emulatorEnvironment, workspace } from './emulator-env.mjs';

const mode = process.argv[2];
if (!['dev', 'test'].includes(mode)) throw new Error('Usage: node scripts/emulators.mjs dev|test');
const env = emulatorEnvironment();
const java = process.platform === 'win32' ? 'java.exe' : 'java';
const javaHomes = [process.env.JAVA_HOME, process.platform === 'win32' ? 'C:/Program Files/Android/Android Studio/jbr' : undefined];
if (spawnSync(java, ['-version'], { env, windowsHide: true }).status !== 0) {
  const javaHome = javaHomes.find((home) => home && existsSync(join(home, 'bin', java)));
  if (!javaHome) throw new Error('Java 21+ is required for Firestore and Storage emulators. Set JAVA_HOME or add java to PATH. See docs/local-emulators.md.');
  env.JAVA_HOME = javaHome;
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH';
  env[pathKey] = `${join(javaHome, 'bin')}${delimiter}${env[pathKey] ?? ''}`;
}
const cli = join(workspace, 'node_modules/firebase-tools/lib/bin/firebase.js');
if (!existsSync(cli)) throw new Error('Firebase CLI dependency is missing. Run npm install first.');
mkdirSync(env.FIREBASE_EMULATORS_PATH, { recursive: true });
console.log(`Starting real Firebase emulators for demo-aniforge (${mode}); AI calls are disabled.`);
const child = spawn(process.execPath, [cli, 'emulators:exec', '--only', 'auth,firestore,storage', '--project', 'demo-aniforge', '--config', 'firebase.emulators.json', ...(mode === 'dev' ? ['--ui'] : []), `node scripts/emulator-run.mjs ${mode}`], { cwd: workspace, env, stdio: 'inherit', windowsHide: true });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => {
  // Windows broadcasts Ctrl+C to attached console children already. kill()
  // force-terminates the CLI there, interrupting its Java emulator cleanup.
  if (process.platform !== 'win32') child.kill(signal);
});
