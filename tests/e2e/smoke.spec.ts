import { expect, test } from '@playwright/test';

test('unconfigured foundation exposes an honest, functional local sketch preview', async ({ page }, testInfo) => {
  const browserErrors: string[] = [];
  page.on('pageerror', (error) => browserErrors.push(error.message));
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Your workspace', exact: true })).toBeVisible();
  await expect(page.getByText('Saved projects are not configured yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('gallery-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Try the unsaved playground' }).click();
  await expect(page.getByRole('heading', { name: 'Sketch playground' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Generate animation' })).toBeDisabled();
  await expect(page.getByText('AI generation is unavailable in this unsaved playground.', { exact: false })).toBeVisible();
  const canvas = page.getByTestId('sketch-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Canvas is not visible.');
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.6, { steps: 12 });
  await page.mouse.up();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByText('0 strokes', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByText('1 stroke', { exact: true })).toBeVisible();
  await expect(page.getByText('Preview · not saved', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('studio-desktop.png'), fullPage: true });
  page.once('dialog', (dialog) => { void dialog.accept(); });
  await page.reload();
  await expect(page.getByText('0 strokes', { exact: true })).toBeVisible();
  expect(browserErrors).toEqual([]);
});

test('project gallery and sketch controls fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/studio/preview');
  await expect(page.getByRole('heading', { name: 'Sketch playground' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pencil', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('signed-out dashboard is responsive and a saved-project URL retains its sign-in destination', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects');
  await expect(page.getByRole('heading', { name: 'Your workspace', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('dashboard-signed-out-mobile.png'), fullPage: true });
  await page.getByRole('button', { name: 'Dismiss getting started' }).click();
  await expect(page.getByRole('complementary', { name: 'Getting started' })).not.toBeVisible();
  await page.goto('/studio/original_project');
  await expect(page.getByRole('heading', { name: 'Sign in to return to your project' })).toBeVisible();
  await expect(page).toHaveURL(/\/studio\/original_project$/);
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to projects' }).click();
  await expect(page).toHaveURL(/\/projects$/);
});
