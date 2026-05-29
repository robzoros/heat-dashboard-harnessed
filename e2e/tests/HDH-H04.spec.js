import { test, expect } from '@playwright/test';

test.describe('HDH-H04 - Poblamiento de filtros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.App.loadMockData());
  });

  test('debe cargar mock data y actualizar header-stats', async ({ page }) => {
    await expect(page.locator('#stat-plays-total')).toHaveText('4');
    await expect(page.locator('#stat-players-total')).toHaveText('4');
    await expect(page.locator('#stat-tracks-total')).toHaveText('2');
    await expect(page.locator('#stat-locations-total')).toHaveText('2');
    await expect(page.locator('#stat-plays-filtered')).toHaveText('4');
  });

  test('debe desplegar y plegar el panel de filtros', async ({ page }) => {
    const panel = page.locator('#filter-panel');
    await expect(panel).toHaveClass(/collapsed/);
    await page.locator('#btn-toggle-filters').click();
    await expect(panel).not.toHaveClass(/collapsed/);
    await page.locator('#btn-toggle-filters').click();
    await expect(panel).toHaveClass(/collapsed/);
  });

  test('debe activar y desactivar el filtro', async ({ page }) => {
    await expect(page.locator('#stat-plays-filtered')).toHaveText('4');
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Circuit A"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('2');
    await page.locator('#filter-active').uncheck();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('4');
    await page.locator('#filter-active').check();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('2');
  });

  test('debe filtrar jugadores en modo alguno (any)', async ({ page }) => {
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#player-filters input[value="1"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('3');
  });

  test('debe filtrar jugadores en modo todos (all)', async ({ page }) => {
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#player-filter-mode').selectOption('all');
    await page.locator('#player-filters input[value="1"]').check();
    await page.locator('#player-filters input[value="2"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('3');
  });

  test('debe filtrar jugadores en modo exacto (exact)', async ({ page }) => {
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#player-filter-mode').selectOption('exact');
    await page.locator('#player-filters input[value="1"]').check();
    await page.locator('#player-filters input[value="2"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('3');
  });

  test('debe filtrar por circuitos', async ({ page }) => {
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Circuit A"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('2');
  });

  test('debe filtrar por localizaciones', async ({ page }) => {
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#location-filters input[value="1"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('2');
  });

  test('debe actualizar header-stats al aplicar filtros', async ({ page }) => {
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Circuit A"]').check();
    await page.locator('#btn-apply-filters').click();
    await expect(page.locator('#stat-plays-filtered')).toHaveText('2');
    await expect(page.locator('#stat-tracks-filtered')).toHaveText('1');
    await expect(page.locator('#stat-locations-filtered')).toHaveText('1');
    await expect(page.locator('#stat-players-filtered')).toHaveText('3');
  });
});
