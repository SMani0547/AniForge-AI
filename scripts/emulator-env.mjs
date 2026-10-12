import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const workspace = fileURLToPath(new URL('../', import.meta.url));

/** Every service gets this same demo project; no local .env is loaded. */
export function emulatorEnvironment(base = process.env, profile = base.ANIFORGE_EMULATOR_PROFILE ?? 'dev') {
  if (!['dev', 'test'].includes(profile)) throw new Error('Emulator profile must be dev or test.');
  const test = profile === 'test';
  const ports = test ? { auth: 19099, firestore: 18081, storage: 19199, api: 18080, web: 15173 } : { auth: 9099, firestore: 8081, storage: 9199, api: 8080, web: 5173 };
  // The CLI can log its child environment. Inherit OS/runtime essentials only,
  // never unrelated personal API keys, cached cloud credentials or .env values.
  const runtimeNames = /^(path|pathext|systemroot|windir|comspec|temp|tmp|tmpdir|username|userdomain|userprofile|homedrive|homepath|home|appdata|localappdata|programfiles|programfiles\(x86\)|programdata|java_home|ci|term|no_color|force_color|playwright_browsers_path)$/i;
  const env = Object.fromEntries(Object.entries(base).filter(([name]) => runtimeNames.test(name)));
  return {
    ...env,
    NODE_ENV: 'development',
    ANIFORGE_EMULATOR_RUN: 'true',
    ANIFORGE_EMULATOR_PROFILE: profile,
    GOOGLE_CLOUD_PROJECT: 'demo-aniforge',
    GCLOUD_PROJECT: 'demo-aniforge',
    GCS_BUCKET: 'demo-aniforge.appspot.com',
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${ports.firestore}`,
    FIREBASE_STORAGE_EMULATOR_HOST: `127.0.0.1:${ports.storage}`,
    FIREBASE_EMULATORS_PATH: resolve(workspace, '.cache/firebase/emulators'),
    XDG_CONFIG_HOME: resolve(workspace, `.cache/firebase/config/${profile}`),
    // Firebase names its temporary hub locator by project ID. Keep the test
    // locator separate so starting/stopping tests cannot replace the dev locator.
    ...(test ? Object.fromEntries(['TEMP', 'TMP', 'TMPDIR'].map((name) => [name, resolve(workspace, '.cache/firebase/test-tmp')])) : {}),
    NO_UPDATE_NOTIFIER: '1',
    METADATA_SERVER_DETECTION: 'none',
    ENABLE_REAL_AI: 'false',
    ENABLE_VIDEO_GENERATION: 'false',
    GEMINI_API_KEY: '',
    PORT: String(ports.api),
    ANIFORGE_EMULATOR_WEB_PORT: String(ports.web),
    ALLOWED_ORIGINS: `http://localhost:${ports.web},http://127.0.0.1:${ports.web}`,
    VITE_FIREBASE_API_KEY: 'demo-emulator-only',
    VITE_FIREBASE_PROJECT_ID: 'demo-aniforge',
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-aniforge.firebaseapp.com',
    VITE_FIREBASE_APP_ID: 'demo-aniforge-local',
    VITE_FIREBASE_AUTH_EMULATOR_URL: `http://127.0.0.1:${ports.auth}`,
    VITE_ENABLE_ANONYMOUS_AUTH: 'true',
    VITE_API_BASE_URL: '/api/v1',
  };
}
