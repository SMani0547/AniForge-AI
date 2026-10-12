import { expect, test } from '@playwright/test';

test('design compositions are responsive and never request cloud or AI services', async ({ page }, testInfo) => {
  const errors: string[] = []; const serviceRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => { if (/\/api\/v1|googleapis\.com|firebaseio\.com|identitytoolkit/.test(request.url())) serviceRequests.push(request.url()); });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const view of ['home', 'dashboard', 'editor', 'components']) {
      await page.goto(`/design?view=${view}`);
      await expect(page.getByText('Interactive design study · sample content · no cloud or AI requests')).toBeVisible();
      await expect(page.getByRole('group', { name: 'Design screens' })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await page.screenshot({ path: testInfo.outputPath(`${view}-${width}.png`), fullPage: true });
    }
  }
  expect(errors).toEqual([]); expect(serviceRequests).toEqual([]);
});

test('component dialog validates, traps focus and restores it; menus and tooltips support Escape', async ({ page }, testInfo) => {
  await page.goto('/design?view=components');
  const trigger = page.getByRole('button', { name: 'Open sample dialog' });
  await trigger.focus(); await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Name a sample scene' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Confirm preview' }).click();
  await expect(dialog.getByLabel('Sample scene name')).toHaveAttribute('aria-invalid', 'true');
  for (let index = 0; index < 8; index++) { await page.keyboard.press('Tab'); expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(dialog).not.toBeVisible(); await expect(trigger).toBeFocused();
  await page.screenshot({ path: testInfo.outputPath('keyboard-focus.png'), fullPage: true });
  await trigger.click(); await dialog.getByLabel('Sample scene name').fill('My original idea');
  await dialog.getByRole('button', { name: 'Confirm preview' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Preview named “My original idea”. Nothing was saved.' })).toBeVisible();
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  const menu = page.locator('summary').filter({ hasText: 'Sample actions' });
  await menu.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Preview duplicate' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(menu).toBeFocused();
  await expect(page.getByRole('button', { name: 'Preview duplicate' })).not.toBeVisible();
  const search = page.getByRole('button', { name: 'Search preview', exact: true });
  await search.focus(); await expect(page.getByRole('tooltip', { name: 'Search preview' })).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('tooltip', { name: 'Search preview' })).not.toBeVisible();
});

test('editor starts before generation and preview navigation preserves a clear route to real drawing', async ({ page }, testInfo) => {
  await page.goto('/design?view=editor');
  await expect(page.getByRole('heading', { name: 'Start with a line.' })).toBeVisible();
  await page.getByRole('button', { name: 'Video', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'No clip yet' })).toBeVisible();
  await page.getByRole('button', { name: 'Return to Source' }).click();
  await expect(page.getByRole('heading', { name: 'Start with a line.' })).toBeVisible();
  await page.getByRole('button', { name: 'View sample composition' }).click();
  await expect(page.getByRole('img', { name: /Original vector illustration/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('editor-artwork.png'), fullPage: true });
  await page.getByRole('button', { name: 'Back to dashboard preview' }).click();
  await page.getByRole('button', { name: 'Empty', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'An empty canvas is a beginning' })).toBeVisible();
  await page.getByRole('button', { name: 'Error', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Example error');
  await page.getByRole('button', { name: 'Reset preview' }).click();
  await page.getByLabel('Search sample projects').fill('No matching example');
  await expect(page.getByRole('heading', { name: 'No sample matches' })).toBeVisible();
  await page.getByRole('link', { name: 'Try drawing', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sketch playground' })).toBeVisible();
});
