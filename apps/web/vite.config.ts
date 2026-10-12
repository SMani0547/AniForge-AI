import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'node:url';
import { assertReleaseConfig } from './release-config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  if (mode === 'release') assertReleaseConfig(loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_'), process.env.GCLOUD_PROJECT);
  return {
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
  build: { target: 'es2022' },
  };
});
