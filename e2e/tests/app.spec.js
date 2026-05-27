import { test, expect } from '@playwright/test';

test.describe('App base', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe cargar con status 200 y DOCTYPE html', async ({ page }) => {
    const response = await page.goto('/');
    expect(response.status()).toBe(200);
    const html = await page.content();
    expect(html).toContain('<!DOCTYPE html>');
  });

  test('debe mostrar los 4 tabs', async ({ page }) => {
    const tabs = page.locator('#tabs .tab-btn');
    await expect(tabs).toHaveCount(4);
    await expect(tabs.nth(0)).toContainText('Resumen');
    await expect(tabs.nth(1)).toContainText('Jugadores');
    await expect(tabs.nth(2)).toContainText('Circuitos');
    await expect(tabs.nth(3)).toContainText('Historial');
  });

  test('debe tener Chart.js cargado', async ({ page }) => {
    const hasChart = await page.evaluate(() => typeof window.Chart !== 'undefined');
    expect(hasChart).toBe(true);
  });

  test('debe tener el panel de filtros', async ({ page }) => {
    await expect(page.locator('#filter-panel')).toBeVisible();
    await expect(page.locator('#btn-toggle-filters')).toBeVisible();
  });

  test('debe tener header-stats', async ({ page }) => {
    await expect(page.locator('#header-stats')).toBeVisible();
    await expect(page.locator('#stat-plays-total')).toBeVisible();
    await expect(page.locator('#stat-players-total')).toBeVisible();
    await expect(page.locator('#stat-tracks-total')).toBeVisible();
    await expect(page.locator('#stat-locations-total')).toBeVisible();
  });

  test('debe capturar screenshot inicial del dashboard', async ({ page }) => {
    await page.screenshot({ path: '../evidence/screenshots/app-inicial-desktop.png', fullPage: true });
  });
});
