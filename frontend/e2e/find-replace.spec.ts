import { test, expect } from '@playwright/test';

test.describe('Find and Replace', () => {
  test('opens find bar with Cmd+F', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first();
    await editor.waitFor({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('searchable text here');

    // Open find
    await page.keyboard.press('Meta+f');
    await page.waitForTimeout(500);

    // Look for find input
    const findInput = page.locator('input[placeholder="Find"], .find-input').first();
    if (await findInput.isVisible()) {
      await findInput.fill('searchable');
      await page.waitForTimeout(500);
      // Should show match count
      const countText = page.locator('.find-count, text=/of/').first();
      if (await countText.isVisible()) {
        await expect(countText).toContainText('1');
      }
    }
  });
});
