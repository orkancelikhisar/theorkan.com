import { test, expect } from '@playwright/test';

async function waitForBootReady(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.boot')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.boot__line--prompt')).toBeVisible({ timeout: 15_000 });
}

// After Enter wakes the OS, wait for the prompt span (always visible, has text).
// The input span itself is an empty inline-block (zero width) so Playwright
// doesn't treat it as "visible" — we use the prompt as the readiness signal.
async function waitForReadyTerminal(page: import('@playwright/test').Page): Promise<void> {
  await expect(page.locator('.terminal__prompt')).toBeVisible({ timeout: 10_000 });
}

test('boot sequence completes and reaches prompt after Enter', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
});

test('whoami returns a fragment', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('whoami');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('orkan', { timeout: 5_000 });
});

test('help shows the catalogue', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('help');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('INFO', { timeout: 5_000 });
  await expect(page.locator('.terminal')).toContainText('GAMES', { timeout: 5_000 });
});

test('life launches and quits cleanly', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('life');
  await page.keyboard.press('Enter');
  await expect(page.locator('.life-overlay')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press('q');
  await expect(page.locator('.life-overlay')).toBeHidden({ timeout: 2_000 });
});

test('regatta launches and quits cleanly', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('regatta');
  await page.keyboard.press('Enter');
  await expect(page.locator('.regatta-overlay')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press('q');
  await expect(page.locator('.regatta-overlay')).toBeHidden({ timeout: 2_000 });
});
