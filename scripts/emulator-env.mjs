import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const workspace = fileURLToPath(new URL('../', import.meta.url));

/** Every service gets this same demo project; no local .env is loaded. */
export function emulatorEnvironment(base = process.env) {
  // The CLI can log its child environment. Inherit OS/runtime essentials only,
  // never unrelated personal API keys, cached cloud credentials or .env values.
  const runtimeNames = /^(path|pathext|systemroot|windir|comspec|temp|tmp|username|userdomain|userprofile|homedrive|homepath|home|appdata|localappdata|programfiles|programfiles\(x86\)|programdata|java_home|ci|term|no_color|force_color|playwright_browsers_path)$/i;
  const env = Object.fromEntries(Object.entries(base).filter(([name]) => runtimeNames.test(name)));
  return {
    ...env,
    NODE_ENV: 'development',
    ANIFORGE_EMULATOR_RUN: 'true',
    GOOGLE_CLOUD_PROJECT: 'demo-aniforge',
    GCLOUD_PROJECT: 'demo-aniforge',
    GCS_BUCKET: 'demo-aniforge.appspot.com',
    FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
    FIRESTORE_EMULATOR_HOST: '127.0.0.1:8081',
    FIREBASE_STORAGE_EMULATOR_HOST: '127.0.0.1:9199',
    FIREBASE_EMULATORS_PATH: resolve(workspace, '.cache/firebase/emulators'),
    XDG_CONFIG_HOME: resolve(workspace, '.cache/firebase/config'),
    NO_UPDATE_NOTIFIER: '1',
    METADATA_SERVER_DETECTION: 'none',
    ENABLE_REAL_AI: 'false',
    ENABLE_VIDEO_GENERATION: 'false',
    GEMINI_API_KEY: '',
    PORT: '8080',
    ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
    VITE_FIREBASE_API_KEY: 'demo-emulator-only',
    VITE_FIREBASE_PROJECT_ID: 'demo-aniforge',
    VITE_FIREBASE_AUTH_DOMAIN: 'demo-aniforge.firebaseapp.com',
    VITE_FIREBASE_APP_ID: 'demo-aniforge-local',
    VITE_FIREBASE_AUTH_EMULATOR_URL: 'http://127.0.0.1:9099',
    VITE_ENABLE_ANONYMOUS_AUTH: 'true',
    VITE_API_BASE_URL: '/api/v1',
  };
}
