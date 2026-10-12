import { defineConfig, devices } from '@playwright/test';

if (process.env.ANIFORGE_EMULATOR_RUN !== 'true' || process.env.ANIFORGE_EMULATOR_PROFILE !== 'test' || process.env.GOOGLE_CLOUD_PROJECT !== 'demo-aniforge' || process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:19099' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:18081' || process.env.FIREBASE_STORAGE_EMULATOR_HOST !== '127.0.0.1:19199') throw new Error('Use npm run test:emulators; this suite requires the isolated test-profile Firebase emulators.');

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.emulator.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  reporter: 'list',
  outputDir: 'test-results/emulators',
  use: { baseURL: 'http://127.0.0.1:15173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium-emulators', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }],
  webServer: [
    { command: 'node scripts/emulator-service.mjs api', url: 'http://127.0.0.1:18080/health', reuseExistingServer: false, timeout: 60_000 },
    { command: 'node scripts/emulator-service.mjs web-test', url: 'http://127.0.0.1:15173', reuseExistingServer: false, timeout: 60_000 },
  ],
});
