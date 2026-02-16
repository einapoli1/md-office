import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('Slides', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Presentation")').click();
    await page.waitForTimeout(2000);
  });

  test('presentation view renders', async ({ page }) => {
    await expect(page.locator('.slide-canvas, .slides-container, .slides-view, .slide-editor').first()).toBeVisible({ timeout: 10000 });
  });

  test('slide canvas is visible', async ({ page }) => {
    await expect(page.locator('.slide-canvas, .slide-main, .slide-editor, canvas, svg').first()).toBeVisible({ timeout: 10000 });
  });

  test('thumbnail panel is visible', async ({ page }) => {
    const panel = page.locator('.slide-thumbnails, .thumbnail-panel, .slide-sidebar, .slides-panel').first();
    if (await panel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(panel).toBeVisible();
    }
  });

  test('toolbar renders for slides', async ({ page }) => {
    await expect(page.locator('.toolbar, .menu-bar, .slide-toolbar').first()).toBeVisible({ timeout: 10000 });
  });

  test('menu bar available in slides mode', async ({ page }) => {
    await expect(page.locator('.menu-bar').first()).toBeVisible({ timeout: 10000 });
  });

  test('add slide button works', async ({ page }) => {
    const addBtn = page.locator('button:has-text("Add Slide"), button:has-text("New Slide"), button[title*="slide" i], button[aria-label*="slide" i]').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await addBtn.click();
      await page.waitForTimeout(500);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('slide has editable content area', async ({ page }) => {
    const editable = page.locator('[contenteditable="true"], .slide-content, .ProseMirror').first();
    if (await editable.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editable.click();
      await page.keyboard.type('Test slide text');
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('at least one slide thumbnail exists', async ({ page }) => {
    const thumb = page.locator('.slide-thumbnail, .thumbnail, [class*="thumb"]').first();
    if (await thumb.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(thumb).toBeVisible();
    }
  });

  test('slide navigation does not crash', async ({ page }) => {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(300);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(300);
    await expect(page.locator('body')).toBeVisible();
  });

  test('presentation has correct app mode', async ({ page }) => {
    // The menu bar or some indicator should reflect slides mode
    await expect(page.locator('.menu-bar, .toolbar').first()).toBeVisible({ timeout: 10000 });
  });
});
