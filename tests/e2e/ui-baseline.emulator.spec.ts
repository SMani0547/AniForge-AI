import { expect, test } from '@playwright/test';

test('baseline records actual project loading and a recoverable network error', async ({ page }, testInfo) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => { release = resolve; });
  // Delay a genuine emulator read; never replace it with invented project data.
  await page.route('**/api/v1/projects', async (route) => { await held; await route.continue(); });
  try {
    await page.goto('/projects');
    await page.getByRole('button', { name: 'Continue as a guest' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Loading your projects' })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('baseline-dashboard-loading.png'), fullPage: true });
  } finally { release(); }
  await expect(page.getByRole('heading', { name: 'A blank slate. All yours.' })).toBeVisible();
  await page.unroute('**/api/v1/projects');
  await page.route('**/api/v1/projects', (route) => route.abort('failed'));
  await page.getByRole('button', { name: 'Refresh projects' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('baseline-dashboard-network-error.png'), fullPage: true });
  await page.unroute('**/api/v1/projects');
  await page.getByRole('button', { name: 'Refresh projects' }).click();
  await expect(page.getByRole('alert')).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'A blank slate. All yours.' })).toBeVisible();
});
