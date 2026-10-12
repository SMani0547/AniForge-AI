// Generates our own geometric test clip. This fixture is NEVER runtime AI output.
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
const edited = process.argv.includes('--edited');
try {
  const page = await browser.newPage();
  const bytes = await page.evaluate(async (revised) => {
    const mimeType = 'video/mp4;codecs=avc1.42001E';
    if (!MediaRecorder.isTypeSupported(mimeType)) throw new Error('Chromium MP4 recording is unavailable.');
    const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable.');
    const stream = canvas.captureStream(12);
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 150000 });
    const chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
    recorder.start();
    for (let frame = 0; frame < 24; frame++) {
      ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = revised ? '#bd73ff' : '#4285f4'; ctx.fillRect(30 + frame * 5, revised ? 100 - frame * 2 : 65, 45, 45);
      ctx.fillStyle = '#ffffff'; ctx.font = '14px sans-serif'; ctx.fillText('TEST FIXTURE - NOT AI OUTPUT', 20, 25);
      await new Promise((resolve) => setTimeout(resolve, 1000 / 12));
    }
    recorder.stop(); await stopped; stream.getTracks().forEach((track) => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: 'video/mp4' }).arrayBuffer())];
  }, edited);
  await mkdir(new URL('../tests/fixtures/', import.meta.url), { recursive: true });
  await writeFile(new URL(`../tests/fixtures/${edited ? 'revised' : 'original'}-square-test-only.mp4`, import.meta.url), Buffer.from(bytes));
  console.info(`Original TEST FIXTURE MP4 recorded: ${bytes.length} bytes. Not Google AI evidence.`);
} finally { await browser.close(); }
