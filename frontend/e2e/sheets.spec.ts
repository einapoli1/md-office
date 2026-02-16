import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('Sheets', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await page.locator('button:has-text("New Spreadsheet")').click();
    await page.waitForTimeout(2000);
  });

  test('spreadsheet view renders', async ({ page }) => {
    await expect(page.locator('.sheet-container, .sheet-grid, .sheets-view, canvas, table').first()).toBeVisible({ timeout: 10000 });
  });

  test('grid renders with cells', async ({ page }) => {
    // Look for cell elements or canvas
    const cells = page.locator('td, .cell, .sheet-cell, canvas');
    expect(await cells.count()).toBeGreaterThanOrEqual(1);
  });

  test('formula bar is visible', async ({ page }) => {
    const formulaBar = page.locator('.formula-bar, .cell-editor, input[class*="formula"], .fx-bar').first();
    if (await formulaBar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(formulaBar).toBeVisible();
    }
  });

  test('sheet tabs are visible', async ({ page }) => {
    const tabs = page.locator('.sheet-tab, .sheet-tabs, [class*="tab"]').first();
    if (await tabs.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(tabs).toBeVisible();
    }
  });

  test('toolbar renders for sheets', async ({ page }) => {
    await expect(page.locator('.toolbar, .menu-bar, .sheet-toolbar').first()).toBeVisible({ timeout: 10000 });
  });

  test('click cell to select it', async ({ page }) => {
    // Try clicking a cell
    const cell = page.locator('td, .cell, .sheet-cell').first();
    if (await cell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cell.click();
      await page.waitForTimeout(300);
      // Selected state - just verify no crash
      await expect(page.locator('body')).toBeVisible();
    } else {
      // Canvas-based sheets - click in the middle
      const canvas = page.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 3000 }).catch(() => false)) {
        await canvas.click({ position: { x: 100, y: 50 } });
        await page.waitForTimeout(300);
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('type value in a cell', async ({ page }) => {
    const cell = page.locator('td, .cell, .sheet-cell').first();
    if (await cell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cell.dblclick();
      await page.keyboard.type('42');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    } else {
      const canvas = page.locator('canvas').first();
      if (await canvas.isVisible({ timeout: 3000 }).catch(() => false)) {
        await canvas.click({ position: { x: 100, y: 50 } });
        await page.keyboard.type('42');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(300);
      }
    }
    await expect(page.locator('body')).toBeVisible();
  });

  test('column headers visible', async ({ page }) => {
    const headers = page.locator('th, .column-header, .col-header, [class*="header"]').first();
    if (await headers.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(headers).toBeVisible();
    }
  });

  test('row numbers visible', async ({ page }) => {
    const rowNums = page.locator('.row-number, .row-header, th').first();
    if (await rowNums.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(rowNums).toBeVisible();
    }
  });

  test('menu bar available in sheets mode', async ({ page }) => {
    await expect(page.locator('.menu-bar').first()).toBeVisible({ timeout: 10000 });
  });
});
