import { test, expect } from '@playwright/test';

test('boot sequence completes and reaches prompt after Enter', async ({ page }) => {
  await page.goto('/');
  // Wait for the boot block to appear
  await expect(page.locator('.boot')).toBeVisible({ timeout: 5_000 });
  // Wait for boot to finish (some lines render); then press Enter
  await page.waitForTimeout(3000);
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal__prompt')).toBeVisible({ timeout: 10_000 });
});

test('whoami returns a fragment', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3500);
  await page.keyboard.press('Enter');
  await page.locator('.terminal__input').waitFor({ timeout: 5000 });
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('whoami');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('orkan', { timeout: 5_000 });
});

test('help shows the catalogue', async ({ page }) => {
  await page.goto('/');
  await page.waitForTimeout(3500);
  await page.keyboard.press('Enter');
  await page.locator('.terminal__input').waitFor({ timeout: 5000 });
  await page.keyboard.type('help');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('INFO', { timeout: 5_000 });
  await expect(page.locator('.terminal')).toContainText('GAMES', { timeout: 5_000 });
});
