import { test, expect } from '@playwright/test';

// Boot is ~25 lines × ~120ms ≈ 3 seconds. Add headroom for Vite cold-start and
// jitter. Each test polls the boot's final prompt line before pressing Enter
// instead of using a fixed timeout.
async function waitForBootReady(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.boot')).toBeVisible({ timeout: 15_000 });
  // The final "press enter to wake up" prompt line is the last to render
  await expect(page.locator('.boot__line--prompt')).toBeVisible({ timeout: 15_000 });
}

test('boot sequence completes and reaches prompt after Enter', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal__prompt')).toBeVisible({ timeout: 10_000 });
});

test('whoami returns a fragment', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await page.locator('.terminal__input').waitFor({ timeout: 5000 });
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('whoami');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('orkan', { timeout: 5_000 });
});

test('help shows the catalogue', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await page.locator('.terminal__input').waitFor({ timeout: 5000 });
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('help');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('INFO', { timeout: 5_000 });
  await expect(page.locator('.terminal')).toContainText('GAMES', { timeout: 5_000 });
});
