import { test, expect } from '@playwright/test';

test.describe('HDH-09 - Pestaña Campeonatos', () => {
  test.beforeEach(async ({ page, request }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  async function loadData(page) {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.waitForTimeout(200);
  }

  test('debe mostrar la pestaña Campeonatos y su contenido', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#tab-campeonatos')).toBeVisible();
    await expect(page.locator('#campeonatos-list')).toBeVisible();
    await expect(page.locator('#btn-create-campeonato')).toBeVisible();
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-tab-campeonatos.png', fullPage: true });
  });

  test('debe mostrar estado vacío cuando no hay campeonatos', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#campeonatos-list .campeonato-empty')).toHaveText('No hay campeonatos. Crea uno nuevo.');
  });

  test('debe crear un campeonato desde la UI', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();
    await page.locator('#btn-create-campeonato').click();
    await expect(page.locator('#create-campeonato-modal')).toBeVisible();
    await page.locator('#new-campeonato-name').fill('Liga Test');
    await page.locator('#new-campeonato-description').fill('Liga de prueba');
    await page.locator('#new-campeonato-players input[value="1"]').check();
    await page.locator('#new-campeonato-players input[value="2"]').check();
    await page.locator('#btn-save-campeonato').click();
    await expect(page.locator('#create-campeonato-modal')).not.toBeVisible();

    // Explicitly reload championships
    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await expect(page.locator('.campeonato-card')).toHaveCount(1);
    await expect(page.locator('.campeonato-card h3')).toHaveText('Liga Test');
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-campeonato-creado.png', fullPage: true });
  });

  test('debe ver detalle del campeonato con clasificación tras importar partidas', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();

    await page.locator('#btn-create-campeonato').click();
    await page.locator('#new-campeonato-name').fill('Detalle UI');
    await page.locator('#new-campeonato-players input[value="1"]').check();
    await page.locator('#new-campeonato-players input[value="2"]').check();
    await page.locator('#new-campeonato-players input[value="3"]').check();
    await page.locator('#btn-save-campeonato').click();
    await expect(page.locator('#create-campeonato-modal')).not.toBeVisible();

    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await expect(page.locator('.campeonato-card')).toHaveCount(1);
    await page.locator('.campeonato-card').click();
    await expect(page.locator('#campeonato-detail-content')).toBeVisible();

    await page.locator('#btn-import-plays-campeonato').click();
    await expect(page.locator('#import-plays-modal')).toBeVisible();
    await page.locator('#import-plays-list input[value="1"]').check();
    await page.locator('#import-plays-list input[value="2"]').check();
    await page.locator('#import-plays-list input[value="3"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.standings-table tbody tr')).toHaveCount(3);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-detalle-campeonato.png', fullPage: true });
  });

  test('debe importar partidas adicionales al campeonato', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();

    await page.locator('#btn-create-campeonato').click();
    await page.locator('#new-campeonato-name').fill('Import UI');
    await page.locator('#new-campeonato-players input[value="1"]').check();
    await page.locator('#new-campeonato-players input[value="2"]').check();
    await page.locator('#btn-save-campeonato').click();
    await expect(page.locator('#create-campeonato-modal')).not.toBeVisible();

    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await expect(page.locator('.campeonato-card')).toHaveCount(1);
    await page.locator('.campeonato-card').click();
    await expect(page.locator('#campeonato-detail-content')).toBeVisible();

    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="1"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);

    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="2"]').check();
    await page.locator('#import-plays-list input[value="3"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-importar-partidas.png', fullPage: true });
  });

  test('debe eliminar partida del campeonato', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();

    await page.locator('#btn-create-campeonato').click();
    await page.locator('#new-campeonato-name').fill('Delete UI');
    await page.locator('#new-campeonato-players input[value="1"]').check();
    await page.locator('#new-campeonato-players input[value="2"]').check();
    await page.locator('#btn-save-campeonato').click();
    await expect(page.locator('#create-campeonato-modal')).not.toBeVisible();

    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await expect(page.locator('.campeonato-card')).toHaveCount(1);
    await page.locator('.campeonato-card').click();
    await expect(page.locator('#campeonato-detail-content')).toBeVisible();

    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="1"]').check();
    await page.locator('#import-plays-list input[value="2"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForTimeout(500);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(2);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.remove-play').first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);
  });
});
