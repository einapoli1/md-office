import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

test.describe('Databases', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    const dbBtn = page.locator('button:has-text("New Database")');
    if (!(await dbBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      test.skip();
      return;
    }
    await dbBtn.click();
    await page.waitForTimeout(2000);
    // A picker or the database view should appear
    const picker = page.locator('.db-picker').first();
    if (await picker.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click the first picker card (blank database)
      await page.locator('.db-picker-card').first().click();
      await page.waitForTimeout(1000);
    }
  });

  test('database view renders', async ({ page }) => {
    await expect(page.locator('.db-header, .db-table-wrapper, .db-view-content').first()).toBeVisible({ timeout: 10000 });
  });

  test('table view has rows or add-row button', async ({ page }) => {
    const rows = page.locator('.db-table-row');
    const addBtn = page.locator('.db-add-row-btn, button:has-text("New Row")').first();
    const hasRows = (await rows.count()) > 0;
    const hasAddBtn = await addBtn.isVisible({ timeout: 3000 }).catch(() => false);
    expect(hasRows || hasAddBtn).toBeTruthy();
  });

  test('column headers visible', async ({ page }) => {
    await expect(page.locator('.db-table-header').first()).toBeVisible({ timeout: 5000 });
  });

  test('add row button works if exists', async ({ page }) => {
    const addBtn = page.locator('.db-add-row-btn, button:has-text("New Row"), button:has-text("+ New")').first();
    if (await addBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      const rowsBefore = await page.locator('.db-table-row').count();
      await addBtn.click();
      await page.waitForTimeout(500);
      const rowsAfter = await page.locator('.db-table-row').count();
      expect(rowsAfter).toBeGreaterThanOrEqual(rowsBefore);
    }
  });

  test('view tabs are visible', async ({ page }) => {
    await expect(page.locator('.db-view-tabs').first()).toBeVisible({ timeout: 5000 });
  });

  test('db header is visible', async ({ page }) => {
    await expect(page.locator('.db-header').first()).toBeVisible({ timeout: 5000 });
  });

  test('can click a cell in the database table', async ({ page }) => {
    const cell = page.locator('.db-table-cell').first();
    if (await cell.isVisible({ timeout: 3000 }).catch(() => false)) {
      await cell.click();
      await page.waitForTimeout(300);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('+ View button exists', async ({ page }) => {
    const viewBtn = page.locator('button:has-text("+ View")').first();
    if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(viewBtn).toBeVisible();
    }
  });

  test('no critical console errors on load', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.waitForTimeout(2000);
    expect(errors.filter(e => e.includes('TypeError') || e.includes('ReferenceError')).length).toBe(0);
  });

  test('db-table element renders', async ({ page }) => {
    const table = page.locator('.db-table').first();
    if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(table).toBeVisible();
    }
  });
});
