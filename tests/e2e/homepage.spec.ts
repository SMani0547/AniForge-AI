import { expect, test } from '@playwright/test';

test('public homepage fits desktop, tablet and phone viewports without loading the application or private services', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const unexpected: string[] = []; const errors: string[] = [];
  page.on('request', (request) => { if (/firebase|konva|CanvasEditor|\/src\/App.tsx|\/api\/v1|googleapis\.com/.test(request.url())) unexpected.push(request.url()); });
  page.on('pageerror', (error) => errors.push(error.message));
  for (const width of [1440, 768, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your sketch.Your story.In motion.');
    await expect(page.getByRole('complementary', { name: 'Current availability' })).toContainText('awaiting verification');
    const character = page.locator('.af-anime-hero').getByRole('img', { name: /original anime artist in.*vermilion jacket/i });
    await expect(character).toBeVisible();
    await expect.poll(() => character.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`homepage-${width}.png`), fullPage: true });
    await page.screenshot({ path: testInfo.outputPath(`hero-${width}.png`) });
    if (width === 1440) for (const section of ['product', 'examples', 'faq']) await page.locator(`#${section}`).screenshot({ path: testInfo.outputPath(`${section}-1440.png`) });
  }
  expect(unexpected).toEqual([]); expect(errors).toEqual([]);
  await expect(page).toHaveTitle('AniForge AI — Your sketch. Your story. In motion.');
  expect(await page.locator('meta[property="og:image"]').getAttribute('content')).toBe('https://aniforge-511502.web.app/social-preview.png');
  for (const asset of ['/brand/favicon-32.png', '/brand/apple-touch-icon.png', '/social-preview.png']) { const response = await page.request.get(asset); expect(response.ok()).toBe(true); expect(response.headers()['content-type']).toContain('image/'); }
});

test('homepage motion reveals content, can be paused and switches off live for reduced motion', async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const home = page.locator('.af-home');
  await expect(home).toHaveAttribute('data-motion', 'true');
  const character = page.locator('.af-hero-character');
  await expect.poll(() => character.evaluate((image: HTMLImageElement) => image.complete && image.naturalWidth > 0)).toBe(true);
  const pause = page.getByRole('button', { name: 'Pause motion', exact: true });
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(character).not.toHaveCSS('animation-name', 'none');
  await expect(character).toHaveCSS('animation-play-state', 'running');
  const light = page.locator('.af-orbit-tail').first();
  await expect(page.locator('.af-orbit')).toHaveCount(3);
  const lightPosition = () => light.evaluate((element) => getComputedStyle(element).strokeDashoffset);
  const initialPosition = await lightPosition();
  await expect.poll(lightPosition).not.toBe(initialPosition);
  await expect(page.locator('.af-type-letter').last()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: testInfo.outputPath('hero-red-trails.png') });
  const gallery = page.locator('.af-art-gallery figure').first();
  await expect(gallery).toHaveCSS('opacity', '0');
  await gallery.scrollIntoViewIfNeeded();
  await expect(gallery).toHaveCSS('opacity', '1');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'true');
  await expect(home).toHaveAttribute('data-animation-paused', 'true');
  await expect(character).toHaveCSS('animation-play-state', 'paused');
  await expect(light).toHaveCSS('animation-play-state', 'paused');
  const pausedPosition = await lightPosition();
  // Compare across rendered frames to prove the light really stops in place.
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  expect(await lightPosition()).toBe(pausedPosition);
  await page.locator('.af-anime-hero').screenshot({ path: testInfo.outputPath('hero-red-trails-paused.png') });
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  await expect(page.locator('.af-type-letter').last()).toHaveCSS('opacity', '1');
  await pause.click();
  await expect(pause).toHaveAttribute('aria-pressed', 'false');
  await expect(home).toHaveAttribute('data-animation-paused', 'false');
  await expect(character).toHaveCSS('animation-play-state', 'running');
  await expect.poll(lightPosition).not.toBe(pausedPosition);
  await expect(home).toHaveAttribute('data-typing-complete', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('.af-home-final a').first().focus();
  await expect(page.locator('.af-home-final')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(home).toHaveAttribute('data-motion', 'false');
  await expect(character).toHaveCSS('animation-name', 'none');
  await expect(light).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
  await expect(page.locator('.af-home-final')).toHaveCSS('opacity', '1');
});

test('homepage reveals sibling content gradually and types the hero without changing its accessible heading', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText('Your sketch.Your story.In motion.');
  await expect(page.locator('.af-type-letter').last()).toHaveCSS('opacity', '1');
  expect(await title.evaluate((element) => getComputedStyle(element).fontFamily)).toContain('Oxanium');
  expect(await page.evaluate(async () => { await document.fonts.ready; return document.fonts.check('750 48px Oxanium'); })).toBe(true);
  const steps = page.locator('.af-home-workflow li');
  await expect(steps.first()).toHaveCSS('opacity', '0');
  await steps.first().scrollIntoViewIfNeeded();
  await expect(steps.first()).toHaveCSS('opacity', '1');
  await expect(steps.nth(1)).toHaveCSS('opacity', '1');
  const timings = await steps.evaluateAll((elements) => elements.map((element) => ({ delay: getComputedStyle(element).transitionDelay, duration: getComputedStyle(element).transitionDuration })));
  expect(timings[0]?.delay).not.toBe(timings[1]?.delay);
  expect(timings[0]?.duration).toContain('1.2s');
  await page.locator('.af-home-final a').first().focus();
  await expect(page.locator('.af-home-final .af-row')).toHaveCSS('opacity', '1');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('.af-type-letter').last()).toHaveCSS('animation-name', 'none');
  await expect(page.locator('[data-reveal="pending"]')).toHaveCount(0);
});

test('homepage examples are honest local interactions and its links reach the real app', async ({ page }) => {
  await page.goto('/');
  const layer = page.getByRole('button', { name: 'Show observatory layer' });
  await layer.click(); await expect(layer).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.af-layer-example [data-art-layer="observatory"]')).toHaveAttribute('visibility', 'hidden');
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
