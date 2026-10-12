import { expect, test } from '@playwright/test';

test('public homepage fits three viewports without loading the application or private services', async ({ page }, testInfo) => {
  const unexpected: string[] = []; const errors: string[] = [];
  page.on('request', (request) => { if (/firebase|konva|CanvasEditor|\/src\/App.tsx|\/api\/v1|googleapis\.com/.test(request.url())) unexpected.push(request.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your sketch.Your story.In motion.');
    await expect(page.getByRole('complementary', { name: 'Current availability' })).toContainText('awaiting verification');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`homepage-${width}.png`), fullPage: true });
    await page.screenshot({ path: testInfo.outputPath(`hero-${width}.png`) });
    if (width === 1440) for (const section of ['product', 'examples', 'faq']) await page.locator(`#${section}`).screenshot({ path: testInfo.outputPath(`${section}-1440.png`) });
  }
  expect(unexpected).toEqual([]); expect(errors).toEqual([]);
  await expect(page).toHaveTitle('AniForge AI — Your sketch. Your story. In motion.');
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toBe('/social-preview.png');
  for (const asset of ['/favicon.svg', '/social-preview.png']) { const response = await page.request.get(asset); expect(response.ok()).toBe(true); expect(response.headers()['content-type']).toContain('image/'); }
});

test('homepage examples are honest local interactions and its links reach the real app', async ({ page }) => {
  await page.goto('/');
  const layer = page.getByRole('button', { name: 'Show observatory layer' });
  await layer.click(); await expect(layer).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('[data-art-layer="observatory"]').nth(1)).toHaveAttribute('visibility', 'hidden');
  await layer.click(); await expect(layer).toHaveAttribute('aria-pressed', 'true');
  await page.getByLabel('Try changing the camera direction').fill('Keep the camera still.');
  await page.getByRole('button', { name: /Violet dusk/ }).click();
  await expect(page.getByRole('button', { name: /Violet dusk/ })).toHaveAttribute('aria-pressed', 'true');
  const faq = page.locator('summary').filter({ hasText: 'Does the download include my trim and captions?' });
  await faq.focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('The current MP4 download is the original stored clip.', { exact: false })).toBeVisible();
  await page.getByRole('link', { name: 'Open studio', exact: true }).first().click();
  await expect(page).toHaveURL(/\/projects$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await page.getByRole('button', { name: 'AniForge home' }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.getByRole('link', { name: 'Try drawing', exact: true }).first().click();
  await expect(page.getByTestId('sketch-canvas')).toBeVisible();
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your sketch.Your story.In motion.');
});

test('mobile navigation supports keyboard dismissal, working anchors and reduced motion', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open navigation' });
  await toggle.focus(); await page.keyboard.press('Enter');
  const mobileNav = page.getByRole('navigation', { name: 'Mobile navigation' });
  await expect(mobileNav).toBeVisible(); await page.keyboard.press('Escape');
  await expect(mobileNav).not.toBeVisible(); await expect(toggle).toBeFocused();
  await toggle.click(); await mobileNav.getByRole('link', { name: 'Examples' }).click();
  await expect(page).toHaveURL(/#examples$/); await expect(mobileNav).not.toBeVisible();
  expect(await page.locator('#examples').evaluate((el) => el.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  const links = await page.locator('a[href^="#"]').evaluateAll((anchors) => anchors.map((anchor) => (anchor as HTMLAnchorElement).hash));
  for (const target of links) await expect(page.locator(target)).toHaveCount(1);
  expect(await page.locator('.af-home').evaluate((el) => getComputedStyle(el).getPropertyValue('--af-motion').trim())).toBe('0ms');
});
