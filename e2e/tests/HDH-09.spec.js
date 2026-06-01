import { test, expect } from '@playwright/test';

test.describe('HDH-09 - Pestaña Campeonatos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      const res = await fetch('/bgg-api/championships');
      const data = await res.json();
      if (data.success && data.data.length > 0) {
        for (const champ of data.data) {
          await fetch(`/bgg-api/championships/${champ.id}`, { method: 'DELETE' });
        }
      }
    });
  });

  test('debe mostrar la pestaña Campeonatos y su contenido', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(async () => { await window.App.loadChampionships(); });

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#tab-campeonatos')).toBeVisible();
    await expect(page.locator('#campeonatos-list')).toBeVisible();
    await expect(page.locator('#btn-create-campeonato')).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/HDH-09-tab-campeonatos.png', fullPage: true });
  });

  test('debe mostrar estado vacío cuando no hay campeonatos', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await page.locator('#tabs .tab-btn').nth(4).click();

    await expect(page.locator('#campeonatos-list .campeonato-empty')).toHaveText('No hay campeonatos. Crea uno nuevo.');
  });

  test('debe crear un campeonato desde la UI', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await page.locator('#tabs .tab-btn').nth(4).click();

    await page.locator('#btn-create-campeonato').click();
    await expect(page.locator('#create-campeonato-modal')).toBeVisible();
    await page.locator('#new-campeonato-name').fill('Liga Test');
    await page.locator('#new-campeonato-description').fill('Liga de prueba');
    await page.locator('#new-campeonato-players input[value="1"]').check();
    await page.locator('#new-campeonato-players input[value="2"]').check();
    await page.locator('#btn-save-campeonato').click();

    await expect(page.locator('#create-campeonato-modal')).not.toBeVisible();
    await page.waitForTimeout(500);

    const card = page.locator('.campeonato-card');
    await expect(card).toHaveCount(1);
    await expect(card.locator('h3')).toHaveText('Liga Test');

    await page.screenshot({ path: '../evidence/screenshots/HDH-09-campeonato-creado.png', fullPage: true });
  });

  test('debe ver detalle del campeonato con clasificación', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    // Use App.createChampionship (which uses App's fetch internally) instead of raw fetch
    await page.evaluate(async () => {
      const result = await window.App.createChampionship('Detalle Test', 'Ver detalle', ['1', '2', '3']);
      if (result.success) {
        await window.App.addPlaysToChampionship(result.data.id, ['1', '2', '3']);
      }
      window.App.championships.selected = null;
      await window.App.loadChampionships();
    });

    await page.locator('#tabs .tab-btn').nth(4).click();
    const card = page.locator('.campeonato-card');
    await expect(card).toHaveCount(1);
    await card.click();

    await expect(page.locator('#campeonato-detail-content')).toBeVisible();
    await expect(page.locator('#campeonato-detail-content h2')).toHaveText('Detalle Test');

    await expect(page.locator('.standings-table tbody tr')).toHaveCount(3);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);

    await page.screenshot({ path: '../evidence/screenshots/HDH-09-detalle-campeonato.png', fullPage: true });
  });

  test('debe importar partidas al campeonato', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    await page.evaluate(async () => {
      const result = await window.App.createChampionship('Import Test', '', ['1', '2']);
      if (result.success) {
        await window.App.addPlaysToChampionship(result.data.id, ['1']);
      }
      window.App.championships.selected = null;
      await window.App.loadChampionships();
    });

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('.campeonato-card')).toHaveCount(1);
    await page.locator('.campeonato-card').click();

    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);
    await page.locator('#btn-import-plays-campeonato').click();
    await expect(page.locator('#import-plays-modal')).toBeVisible();

    await page.locator('#import-plays-list input[value="2"]').check();
    await page.locator('#import-plays-list input[value="3"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForTimeout(500);

    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);

    await page.screenshot({ path: '../evidence/screenshots/HDH-09-importar-partidas.png', fullPage: true });
  });

  test('debe eliminar partida del campeonato', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    await page.evaluate(async () => {
      const result = await window.App.createChampionship('Delete Test', '', ['1', '2']);
      if (result.success) {
        await window.App.addPlaysToChampionship(result.data.id, ['1', '2']);
      }
      window.App.championships.selected = null;
      await window.App.loadChampionships();
    });

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('.campeonato-card')).toHaveCount(1);
    await page.locator('.campeonato-card').click();

    await expect(page.locator('.campeonato-play-item')).toHaveCount(2);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.remove-play').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);
  });
});
