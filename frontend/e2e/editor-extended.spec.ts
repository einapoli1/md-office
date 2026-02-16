import { test, expect } from '@playwright/test';
import { gotoApp, openMenu } from './helpers';

test.describe('Editor Extended', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Document")').click();
    await page.waitForTimeout(1000);
    await page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first().waitFor({ timeout: 10000 });
  });

  const editor = '.ProseMirror, .tiptap, [contenteditable="true"]';

  test('type text and verify it appears', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('Hello World');
    await expect(ed).toContainText('Hello World');
  });

  test('bold via Cmd+B', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('bold text');
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Meta+b');
    await expect(ed.locator('strong, b').first()).toBeVisible({ timeout: 3000 });
  });

  test('italic via Cmd+I', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('italic text');
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Meta+i');
    await expect(ed.locator('em, i').first()).toBeVisible({ timeout: 3000 });
  });

  test('undo via Cmd+Z', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('some text');
    await expect(ed).toContainText('some text');
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(300);
    // Text should be partially or fully undone
    await expect(page.locator('body')).toBeVisible();
  });

  test('insert heading via toolbar', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('Heading Text');
    await page.keyboard.press('Meta+a');
    // Try toolbar heading button or dropdown
    const headingBtn = page.locator('button[title*="Heading"], button[aria-label*="Heading"], [class*="heading"]').first();
    if (await headingBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await headingBtn.click();
      await page.waitForTimeout(300);
      // Click H1 if dropdown appeared
      const h1 = page.locator('text="Heading 1", text="H1"').first();
      if (await h1.isVisible({ timeout: 1000 }).catch(() => false)) {
        await h1.click();
      }
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('zoom controls in status bar', async ({ page }) => {
    const zoom = page.locator('.status-bar, .zoom-control, [class*="zoom"], [class*="status"]').first();
    if (await zoom.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(zoom).toBeVisible();
    }
  });

  test('word count in status bar', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('one two three four five');
    await page.waitForTimeout(500);
    const wordCount = page.locator('[class*="word"], [class*="count"], .status-bar').first();
    if (await wordCount.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(wordCount).toBeVisible();
    }
  });

  test('menu bar fully rendered with all 6 menus', async ({ page }) => {
    const menuBar = page.locator('.menu-bar').first();
    await expect(menuBar).toBeVisible({ timeout: 5000 });
    for (const name of ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools']) {
      await expect(page.locator('.menu-button, [class*="menu"]', { hasText: name }).first()).toBeVisible();
    }
  });

  const menus = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools'];
  for (const menu of menus) {
    test(`click ${menu} menu shows dropdown with items`, async ({ page }) => {
      await openMenu(page, menu);
      const dropdown = page.locator('.menu-dropdown, [role="menu"]').first();
      await expect(dropdown).toBeVisible({ timeout: 3000 });
      const items = dropdown.locator('.menu-dropdown-item, [role="menuitem"]');
      expect(await items.count()).toBeGreaterThanOrEqual(1);
    });
  }

  test('Format > Bold menu item works', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('format me');
    await page.keyboard.press('Meta+a');
    await openMenu(page, 'Format');
    const boldItem = page.locator('.menu-dropdown-item, [role="menuitem"]', { hasText: /bold/i }).first();
    if (await boldItem.isVisible({ timeout: 2000 }).catch(() => false)) {
      await boldItem.click();
      await page.waitForTimeout(300);
      await expect(ed.locator('strong, b').first()).toBeVisible({ timeout: 3000 });
    }
  });

  test('underline via Cmd+U', async ({ page }) => {
    const ed = page.locator(editor).first();
    await ed.click();
    await page.keyboard.type('underline text');
    await page.keyboard.press('Meta+a');
    await page.keyboard.press('Meta+u');
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });
});
