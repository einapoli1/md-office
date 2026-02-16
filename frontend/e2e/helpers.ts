import { Page } from '@playwright/test';

/**
 * Dismiss the onboarding tour and set localStorage so it doesn't appear again.
 */
export async function dismissTour(page: Page) {
  // Set localStorage to skip tour on future navigations
  await page.evaluate(() => localStorage.setItem('onboarding-complete', 'true'));
}

/**
 * Navigate to the app with tour already dismissed.
 */
export async function gotoApp(page: Page, path = '/') {
  await page.goto(path);
  await dismissTour(page);
  await page.reload({ waitUntil: 'networkidle' });
}

/**
 * Wait for the app shell to be ready (menu bar visible).
 */
export async function waitForAppShell(page: Page) {
  await page.locator('.menu-bar').waitFor({ timeout: 10000 });
}

/**
 * Create a new document and wait for the editor to appear.
 */
export async function createNewDocument(page: Page) {
  await page.locator('button:has-text("New Document"), text="New Document"').first().click();
  await page.waitForTimeout(1000);
  await page.locator('.ProseMirror, .tiptap, [contenteditable="true"]').first().waitFor({ timeout: 10000 });
}

/**
 * Open a menu by name and wait for dropdown to appear.
 */
export async function openMenu(page: Page, menuName: string) {
  await page.locator('.menu-button', { hasText: menuName }).click();
  await page.locator('.menu-dropdown').first().waitFor({ timeout: 3000 });
}

/**
 * Click a menu item inside an already-open dropdown.
 */
export async function clickMenuItem(page: Page, itemText: string | RegExp) {
  await page.locator('.menu-dropdown-item', { hasText: itemText }).click();
  await page.waitForTimeout(300);
}

/**
 * Open a menu and click an item.
 */
export async function menuAction(page: Page, menuName: string, itemText: string | RegExp) {
  await openMenu(page, menuName);
  await clickMenuItem(page, itemText);
}

/**
 * Switch app mode (Docs, Sheets, Slides, Database).
 */
export async function switchAppMode(page: Page, mode: 'Docs' | 'Sheets' | 'Slides' | 'Draw' | 'Database') {
  const modeMap: Record<string, string> = {
    'Docs': 'MD Docs',
    'Sheets': 'MD Sheets',
    'Slides': 'MD Slides',
    'Draw': 'MD Draw',
    'Database': 'MD Database',
  };
  // Click on the app mode link/button in landing page or sidebar
  const target = modeMap[mode] || mode;
  await page.locator(`text="${target}"`, ).first().click();
  await page.waitForTimeout(500);
}

/**
 * Create a new spreadsheet.
 */
export async function createNewSpreadsheet(page: Page) {
  await page.locator('button:has-text("New Spreadsheet"), text="New Spreadsheet"').first().click();
  await page.waitForTimeout(1000);
  await page.locator('.sheet-container, .sheet-grid').first().waitFor({ timeout: 10000 });
}

/**
 * Create a new presentation.
 */
export async function createNewPresentation(page: Page) {
  await page.locator('button:has-text("New Presentation"), text="New Presentation"').first().click();
  await page.waitForTimeout(1000);
  await page.locator('.slide-canvas, .slides-container').first().waitFor({ timeout: 10000 });
}
