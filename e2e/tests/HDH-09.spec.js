import { test, expect } from '@playwright/test';

test.describe('HDH-09 - Pestaña Campeonatos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Clean up all existing championships before each test
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

    const tabs = page.locator('#tabs .tab-btn');
    await expect(tabs.nth(4)).toContainText('Campeonatos');
    await tabs.nth(4).click();
    await expect(page.locator('#tab-campeonatos')).toBeVisible();
    await expect(page.locator('#campeonatos-list')).toBeVisible();
    await expect(page.locator('#btn-create-campeonato')).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/HDH-09-tab-campeonatos.png', fullPage: true });
  });

  test('debe mostrar estado vacío cuando no hay campeonatos', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(async () => { await window.App.loadChampionships(); });
    await page.locator('#tabs .tab-btn').nth(4).click();

    const emptyText = page.locator('#campeonatos-list .campeonato-empty');
    await expect(emptyText).toHaveText('No hay campeonatos. Crea uno nuevo.');
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

    // Create championship and add plays via API, then load into App
    const champId = await page.evaluate(async () => {
      const res = await fetch('/bgg-api/championships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Detalle Test', description: 'Ver detalle', participants: ['1', '2', '3'] })
      });
      const r = await res.json();
      await fetch(`/bgg-api/championships/${r.data.id}/plays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playIds: ['1', '2', '3'] })
      });
      return r.data.id;
    });

    // Manually load championships into App
    await page.evaluate(async () => {
      const res = await fetch('/bgg-api/championships');
      const data = await res.json();
      if (data.success) {
        window.App.championships.list = data.data;
        window.App.championships.selected = null;
        window.App.renderChampionships();
      }
    });

    await page.locator('#tabs .tab-btn').nth(4).click();

    // First card should be the one we just created
    const card = page.locator('.campeonato-card');
    await expect(card).toHaveCount(1);
    await card.click();

    await expect(page.locator('#campeonato-detail-content')).toBeVisible();
    await expect(page.locator('#campeonato-detail-content h2')).toHaveText('Detalle Test');

    const standingsRows = page.locator('.standings-table tbody tr');
    await expect(standingsRows).toHaveCount(3);

    const playItems = page.locator('.campeonato-play-item');
    await expect(playItems).toHaveCount(3);

    await page.screenshot({ path: '../evidence/screenshots/HDH-09-detalle-campeonato.png', fullPage: true });
  });

  test('debe importar partidas al campeonato', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    await page.evaluate(async () => {
      const res = await fetch('/bgg-api/championships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Import Test', description: '', participants: ['1', '2'] })
      });
      const r = await res.json();
      await fetch(`/bgg-api/championships/${r.data.id}/plays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playIds: ['1'] })
      });
    });

    await page.evaluate(async () => {
      const res = await fetch('/bgg-api/championships');
      const data = await res.json();
      if (data.success) {
        window.App.championships.list = data.data;
        window.App.championships.selected = null;
        window.App.renderChampionships();
      }
    });

    await page.locator('#tabs .tab-btn').nth(4).click();

    const card = page.locator('.campeonato-card');
    await expect(card).toHaveCount(1);
    await card.click();

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
      const res = await fetch('/bgg-api/championships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Delete Test', description: '', participants: ['1', '2'] })
      });
      const r = await res.json();
      await fetch(`/bgg-api/championships/${r.data.id}/plays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playIds: ['1', '2'] })
      });
    });

    await page.evaluate(async () => {
      const res = await fetch('/bgg-api/championships');
      const data = await res.json();
      if (data.success) {
        window.App.championships.list = data.data;
        window.App.championships.selected = null;
        window.App.renderChampionships();
      }
    });

    await page.locator('#tabs .tab-btn').nth(4).click();

    const card = page.locator('.campeonato-card');
    await expect(card).toHaveCount(1);
    await card.click();

    await expect(page.locator('.campeonato-play-item')).toHaveCount(2);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.remove-play').first().click();
    await page.waitForTimeout(500);

    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);
  });
});
