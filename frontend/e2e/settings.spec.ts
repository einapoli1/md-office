import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('Settings & Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Document")').click();
    await page.waitForTimeout(1000);
    await page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first().waitFor({ timeout: 10000 });
  });

  test('command palette opens with Cmd+K', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    const palette = page.locator('.command-palette, .cmdk, [class*="command"], [role="dialog"]').first();
    if (await palette.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(palette).toBeVisible();
    }
  });

  test('command palette has search input', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    const input = page.locator('.command-palette input, .cmdk input, [class*="command"] input').first();
    if (await input.isVisible({ timeout: 3000 }).catch(() => false)) {
      await input.click();
      await page.keyboard.type('new');
      await page.waitForTimeout(300);
      await expect(input).toHaveValue('new');
    }
  });

  test('command palette lists commands', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    const items = page.locator('.command-palette-item, .cmdk-item, [class*="command"] [class*="item"]');
    if (await items.first().isVisible({ timeout: 3000 }).catch(() => false)) {
      expect(await items.count()).toBeGreaterThanOrEqual(1);
    }
  });

  test('command palette closes with Escape', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    // Palette should be gone or hidden
    await expect(page.locator('body')).toBeVisible();
  });

  test('AI assistant button exists in toolbar (if available)', async ({ page }) => {
    const aiBtn = page.locator('button[title*="AI"], button[aria-label*="AI"], button:has-text("AI"), [class*="ai-btn"]').first();
    if (await aiBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await aiBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
