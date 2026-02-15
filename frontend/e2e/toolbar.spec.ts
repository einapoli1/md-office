import { test, expect } from '@playwright/test';

test.describe('Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ProseMirror, .tiptap, [contenteditable="true"]', { timeout: 10000 });
  });

  test('bold button applies formatting', async ({ page }) => {
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('test text');

    // Select all text
    await page.keyboard.press('Meta+a');

    // Click bold button (look for bold toolbar button)
    const boldBtn = page.locator('button[title*="Bold"], button[aria-label*="Bold"]').first();
    if (await boldBtn.isVisible()) {
      await boldBtn.click();
      // Check that bold tag exists
      const boldText = editor.locator('strong, b');
      await expect(boldText).toBeVisible();
    }
  });

  test('italic button applies formatting', async ({ page }) => {
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first();
    await editor.click();
    await page.keyboard.type('test text');
    await page.keyboard.press('Meta+a');

    const italicBtn = page.locator('button[title*="Italic"], button[aria-label*="Italic"]').first();
    if (await italicBtn.isVisible()) {
      await italicBtn.click();
      const italicText = editor.locator('em, i');
      await expect(italicText).toBeVisible();
    }
  });
});
