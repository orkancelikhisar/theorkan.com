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

test('whois returns lore for a known name', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('whois stowaway');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('the one that boarded with you', { timeout: 5_000 });
});

test('pinpoint prints a signature and uniqueness estimate', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('pinpoint');
  await page.keyboard.press('Enter');
  // The scan is async (progressive checkmarks then summary). Give it room.
  await expect(page.locator('.terminal')).toContainText('your signature', { timeout: 8_000 });
  await expect(page.locator('.terminal')).toContainText('you are 1 in', { timeout: 8_000 });
});

test('gallery opens, navigates, and quits with q', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('gallery');
  await page.keyboard.press('Enter');
  await expect(page.locator('.gallery-overlay')).toBeVisible({ timeout: 5_000 });
  // Should show first piece by default.
  await expect(page.locator('.gallery-frame__title')).toContainText('(', { timeout: 3_000 });
  // Arrow right advances to next piece; counter should change from 01/10 → 02/10.
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.gallery-frame__chrome')).toContainText('02', { timeout: 2_000 });
  await page.keyboard.press('q');
  await expect(page.locator('.gallery-overlay')).toBeHidden({ timeout: 2_000 });
});

test('music ls lists the tracks', async ({ page }) => {
  await page.goto('/');
  await waitForBootReady(page);
  await page.keyboard.press('Enter');
  await waitForReadyTerminal(page);
  await page.locator('.terminal__input').focus();
  await page.keyboard.type('music ls');
  await page.keyboard.press('Enter');
  await expect(page.locator('.terminal')).toContainText('harbor', { timeout: 5_000 });
  await expect(page.locator('.terminal')).toContainText('tuesday', { timeout: 5_000 });
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
  // Game posts 'regatta:quit' to the parent on Q/Esc; window-level capture
  // also handles q when focus is on the parent shell. Either path works.
  await page.keyboard.press('q');
  await expect(page.locator('.regatta-overlay')).toBeHidden({ timeout: 2_000 });
});
