import { expect, test } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('public screens reflow across release viewports and 200 percent equivalent CSS viewport', async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  for (const route of ['/', '/projects', '/studio/preview']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    for (const width of [390, 768, 1280, 1440, 720]) {
      // 720 x 450 CSS pixels models 1440 x 900 at 200% browser zoom.
      await page.setViewportSize({ width, height: width === 720 ? 450 : 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${route} at ${width}`).toBe(true);
      const name = route === '/' ? 'homepage' : route.split('/').at(-1);
      await page.screenshot({ path: testInfo.outputPath(`${name}-${width}.png`), fullPage: true });
    }
  }
});

test('keyboard navigation preserves cancelled history and warns before losing a playground drawing', async ({ page }) => {
  await page.goto('/projects');
  await page.getByRole('button', { name: 'Try the unsaved playground' }).click();
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveTitle('Sketch playground | AniForge AI');
  const canvas = page.getByTestId('sketch-canvas');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + 30, box.y + 30); await page.mouse.down();
  await page.mouse.move(box.x + 100, box.y + 60); await page.mouse.up();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  const length = await page.evaluate(() => history.length);
  page.once('dialog', (dialog) => { void dialog.dismiss(); });
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/studio\/preview$/);
  await expect.poll(() => page.evaluate(() => history.state.aniforgeIndex)).toBe(1);
  expect(await page.evaluate(() => history.length)).toBe(length);
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => { void dialog.dismiss(); });
  await page.getByRole('button', { name: 'Back to projects', exact: true }).click();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await page.evaluate(() => history.back());
  await expect(page.getByRole('heading', { name: 'Your workspace', exact: true })).toBeVisible();
  await expect(page.locator('#main')).toBeFocused();
  await page.goForward();
  await expect(page.getByText('0 strokes', { exact: true })).toBeVisible();
  await page.reload(); await expect(canvas).toBeVisible();
  await page.getByRole('link', { name: 'Skip to main content' }).focus();
  await page.keyboard.press('Enter'); await expect(page.locator('#main')).toBeFocused();
});

test('core theme text and focus colors meet contrast targets and motion preference is respected', async ({ page }, testInfo) => {
  await page.goto('/');
  const colors = await page.locator('.af-theme').evaluate((element) => {
    const style = getComputedStyle(element);
    return Object.fromEntries(['text','muted','accent','ink','focus','bg','surface','raised','danger','success'].map((key) => [key, style.getPropertyValue('--af-' + key).trim()]));
  });
  function luminance(hex: string) {
    const values = hex.slice(1).match(/../g)!.map((part) => parseInt(part, 16) / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return values[0]! * 0.2126 + values[1]! * 0.7152 + values[2]! * 0.0722;
  }
  const results: { foreground: string; background: string; ratio: number }[] = [];
  for (const foreground of ['text','muted','accent','danger','success','focus']) for (const background of ['bg','surface','raised']) {
    const a = luminance(colors[foreground]!); const b = luminance(colors[background]!);
    const ratio = (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05);
    results.push({ foreground, background, ratio });
    expect(ratio).toBeGreaterThanOrEqual(foreground === 'focus' ? 3 : 4.5);
  }
  const buttonRatio = (luminance(colors.accent!) + 0.05) / (luminance(colors.ink!) + 0.05);
  expect(buttonRatio).toBeGreaterThanOrEqual(4.5);
  const report = testInfo.outputPath('theme-contrast.json');
  await writeFile(report, JSON.stringify({ results, buttonRatio }, null, 2) + '\n');
  await testInfo.attach('theme-contrast.json', { path: report, contentType: 'application/json' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.locator('.af-theme').evaluate((el) => getComputedStyle(el).getPropertyValue('--af-motion').trim())).toBe('0ms');
  const link = page.getByRole('link', { name: 'Open studio', exact: true }).first();
  await link.focus();
  expect(await link.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none');
});
