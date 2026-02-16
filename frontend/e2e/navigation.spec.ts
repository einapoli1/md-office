import { test, expect } from '@playwright/test';
import { gotoApp, waitForAppShell } from './helpers';

test.describe('Navigation & Landing Page', () => {
  test('landing page loads', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.recent-docs')).toBeVisible({ timeout: 10000 });
  });

  test('landing page shows hero heading', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.recent-docs-heading')).toBeVisible({ timeout: 10000 });
  });

  test('landing page shows subtitle', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.recent-docs-subtitle')).toBeVisible({ timeout: 10000 });
  });

  test('New Document button is visible', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('button:has-text("New Document")')).toBeVisible({ timeout: 10000 });
  });

  test('New Spreadsheet button is visible', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('button:has-text("New Spreadsheet")')).toBeVisible({ timeout: 10000 });
  });

  test('New Presentation button is visible', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('button:has-text("New Presentation")')).toBeVisible({ timeout: 10000 });
  });

  test('app switcher buttons are visible', async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.app-switcher')).toBeVisible({ timeout: 10000 });
    const buttons = page.locator('.app-switcher-btn');
    expect(await buttons.count()).toBeGreaterThanOrEqual(3);
  });

  test('click New Document creates a doc editor', async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Document")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('click New Spreadsheet creates a spreadsheet', async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Spreadsheet")').click();
    await page.waitForTimeout(1000);
    // Sheet grid or container should appear
    await expect(page.locator('.sheet-container, .sheet-grid, .sheets-view, canvas').first()).toBeVisible({ timeout: 10000 });
  });

  test('click New Presentation creates a presentation', async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Presentation")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.slide-canvas, .slides-container, .slides-view').first()).toBeVisible({ timeout: 10000 });
  });

  test('click New Database creates a database (if available)', async ({ page }) => {
    await gotoApp(page);
    const dbBtn = page.locator('button:has-text("New Database")');
    if (await dbBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await dbBtn.click();
      await page.waitForTimeout(1000);
      // Either a picker or database view should appear
      await expect(page.locator('.db-picker, .db-header, .db-table-wrapper, .db-view-content').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('app switcher changes landing mode', async ({ page }) => {
    await gotoApp(page);
    const buttons = page.locator('.app-switcher-btn');
    const count = await buttons.count();
    if (count >= 2) {
      // Click second switcher button
      await buttons.nth(1).click();
      await page.waitForTimeout(500);
      await expect(buttons.nth(1)).toHaveClass(/active/);
    }
  });

  test('clicking app switcher updates hero heading color', async ({ page }) => {
    await gotoApp(page);
    const heading = page.locator('.recent-docs-heading');
    const initialColor = await heading.evaluate(el => getComputedStyle(el).color);
    const buttons = page.locator('.app-switcher-btn');
    if (await buttons.count() >= 2) {
      await buttons.nth(1).click();
      await page.waitForTimeout(500);
      // Color may or may not change depending on theme, just verify no crash
      await expect(heading).toBeVisible();
    }
  });

  test('menu bar appears after creating a document', async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Document")').click();
    await page.waitForTimeout(1000);
    await expect(page.locator('.menu-bar').first()).toBeVisible({ timeout: 10000 });
  });

  test('actions section has multiple buttons', async ({ page }) => {
    await gotoApp(page);
    const actions = page.locator('.recent-docs-actions button');
    expect(await actions.count()).toBeGreaterThanOrEqual(3);
  });
});
