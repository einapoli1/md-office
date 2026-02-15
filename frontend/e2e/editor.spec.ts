import { test, expect } from '@playwright/test';

test.describe('Editor', () => {
  test('loads and renders the editor', async ({ page }) => {
    await page.goto('/');
    // Wait for the app to load
    await page.waitForSelector('.ProseMirror, .tiptap, [contenteditable="true"]', { timeout: 10000 });
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first();
    await expect(editor).toBeVisible();
  });

  test('can type text in the editor', async ({ page }) => {
    await page.goto('/');
    const editor = page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first();
    await editor.waitFor({ timeout: 10000 });
    await editor.click();
    await page.keyboard.type('Hello from Playwright');
    await expect(editor).toContainText('Hello from Playwright');
  });
});
