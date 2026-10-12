import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testIgnore: '**/*.emulator.spec.ts',
  outputDir: 'test-results/unconfigured',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:15174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -w @aniforge/web -- --host 127.0.0.1 --port 15174',
    url: 'http://127.0.0.1:15174',
    reuseExistingServer: false,
    env: { VITE_FIREBASE_API_KEY: '', VITE_FIREBASE_PROJECT_ID: '', VITE_FIREBASE_AUTH_DOMAIN: '', VITE_FIREBASE_APP_ID: '' },
  },
});
