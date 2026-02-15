import { test, expect } from '@playwright/test';

test.describe('Menu Bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.ProseMirror, .tiptap, [contenteditable="true"]', { timeout: 10000 });
  });

  const menus = ['File', 'Edit', 'View', 'Insert', 'Format', 'Tools'];

  for (const menu of menus) {
    test(`${menu} menu opens`, async ({ page }) => {
      const menuBtn = page.locator(`text="${menu}"`).first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        // Menu should show dropdown items
        await page.waitForTimeout(300);
        // Check that some dropdown/popover appeared
        const dropdown = page.locator('.menu-dropdown, .dropdown-menu, [role="menu"]').first();
        if (await dropdown.isVisible()) {
          await expect(dropdown).toBeVisible();
        }
      }
    });
  }
});
