import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { preview } from 'vite';
import { chromium } from '@playwright/test';

// Local production artifact measurement. No credentials, cloud or AI calls.
const root = resolve('apps/web');
await readFile(resolve(root, 'dist/index.html'));
const server = await preview({ root, configFile: false, preview: { host: '127.0.0.1', port: 15175, strictPort: true } });
let browser;
try {
  browser = await chromium.launch();
  const runs = [];
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const requests = []; const errors = [];
    page.on('request', (request) => requests.push(request.url()));
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      window.__uiLcp = 0;
      new PerformanceObserver((list) => { window.__uiLcp = list.getEntries().at(-1)?.startTime ?? 0; }).observe({ type: 'largest-contentful-paint', buffered: true });
    });
    await page.goto('http://127.0.0.1:15175/', { waitUntil: 'networkidle' });
    await page.getByRole('heading', { level: 1 }).waitFor();
    const metrics = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      return {
        domContentLoadedMs: nav.domContentLoadedEventEnd,
        loadMs: nav.loadEventEnd,
        firstContentfulPaintMs: performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? null,
        largestContentfulPaintMs: window.__uiLcp,
        transferBytes: [nav, ...resources].reduce((sum, entry) => sum + entry.transferSize, 0),
        resources: resources.map((entry) => ({ path: new URL(entry.name).pathname, encodedBodyBytes: entry.encodedBodySize, transferBytes: entry.transferSize })),
      };
    });
    if (errors.length || requests.some((url) => !url.startsWith('http://127.0.0.1:15175/') || /CanvasEditor|ReactKonva|\/App-|firebase|\/api\//i.test(url))) throw new Error('Homepage requested application/cloud code or raised a browser error.');
    runs.push(metrics);
    await context.close();
  }
  const artifacts = [];
  for (const name of await readdir(resolve(root, 'dist/assets'))) {
    const bytes = await readFile(resolve(root, 'dist/assets', name));
    artifacts.push({ name, bytes: bytes.length, gzipBytes: gzipSync(bytes).length });
  }
  const report = { recordedAt: new Date().toISOString(), browser: await browser.version(), method: 'Three fresh Chromium contexts; built Vite preview on loopback; 1440x900; no CPU/network throttling. Transfer includes local HTTP overhead. Not Lighthouse, field data or deployed latency.', runs, artifacts };
  await mkdir('artifacts/ui-review', { recursive: true });
  await writeFile('artifacts/ui-review/performance.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ report: 'artifacts/ui-review/performance.json', runs: runs.map(({ resources, ...metrics }) => ({ ...metrics, resourceCount: resources.length })) }, null, 2));
} finally {
  await browser?.close();
  await new Promise((done, reject) => server.httpServer.close((error) => error ? reject(error) : done()));
}
