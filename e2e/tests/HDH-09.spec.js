import { test, expect } from '@playwright/test';

test.describe('HDH-09 - Pestaña Campeonatos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await cleanupChampionships(page);
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForTimeout(300);
  });

  async function cleanupChampionships(page) {
    await page.evaluate(() => localStorage.removeItem('hdh-championships'));
  }

  async function loadData(page) {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
  }

  test('debe mostrar la pestaña Campeonatos y su contenido', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#tab-campeonatos')).toBeVisible();
    await expect(page.locator('#campeonatos-select')).toBeVisible();
    await expect(page.locator('#btn-create-campeonato')).toBeVisible();
    await expect(page.locator('#btn-load-campeonatos')).toBeVisible();
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-tab-campeonatos.png', fullPage: true });
  });

  test('debe mostrar estado vacío cuando no hay campeonatos', async ({ page }) => {
    await loadData(page);
    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#campeonatos-select')).toHaveValue('');
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
    await page.waitForTimeout(2000);
    await expect(page.locator('#campeonatos-select option')).toHaveCount(2);
    await expect(page.locator('#campeonato-detail-content')).toBeVisible();
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-campeonato-creado.png', fullPage: true });
  });

  const ALL_PARTICIPANTS = ['1','2','3','4'];

  async function createChampViaAPI(page, champName, participants) {
    return page.evaluate(({ name, participants }) => window.App.createChampionship(name, '', participants, 'local').then(result => result.data), {
      name: champName,
      participants: participants || ALL_PARTICIPANTS
    });
  }

  async function addPlaysViaAPI(page, champId, playIds) {
    await page.evaluate(async ({ id, playIds }) => {
      await window.App.addPlaysToChampionship(id, playIds);
    }, { id: champId, playIds });
  }

  async function loadChampsIntoApp(page) {
    await page.evaluate(() => window.App.loadChampionships());
  }

  async function selectChampInApp(page, champId) {
    await page.evaluate(async (id) => {
      await App.selectChampionship(id);
    }, champId);
    await page.waitForFunction((id) => {
      return App.championships.selected && App.championships.selected.id === id;
    }, champId, { timeout: 5000 });
  }

  test('debe ver detalle del campeonato con clasificación tras importar partidas', async ({ page }) => {
    await loadData(page);
    const champData = await createChampViaAPI(page, 'Detalle Test');
    await addPlaysViaAPI(page, champData.id, ['1', '2', '3']);
    await loadChampsIntoApp(page);

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#campeonatos-select option')).toHaveCount(2);
    await selectChampInApp(page, champData.id);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-detalle-campeonato.png', fullPage: true });
  });

  test('debe importar partidas adicionales al campeonato', async ({ page }) => {
    await loadData(page);
    const champData = await createChampViaAPI(page, 'Import Test');
    await addPlaysViaAPI(page, champData.id, ['1']);
    await loadChampsIntoApp(page);

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#campeonatos-select option')).toHaveCount(2);
    await selectChampInApp(page, champData.id);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="2"]').check();
    await page.locator('#import-plays-list input[value="3"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForFunction(() => document.querySelectorAll('.campeonato-play-item').length >= 3, { timeout: 5000 });
    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-importar-partidas.png', fullPage: true });
  });

  test('debe eliminar partida del campeonato', async ({ page }) => {
    await loadData(page);
    const champData = await createChampViaAPI(page, 'Delete Test');
    await addPlaysViaAPI(page, champData.id, ['1', '2']);
    await loadChampsIntoApp(page);

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#campeonatos-select option')).toHaveCount(2);
    await selectChampInApp(page, champData.id);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(2);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('.remove-play').first().click();
    await page.waitForFunction(() => document.querySelectorAll('.campeonato-play-item').length <= 1, { timeout: 5000 });
    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);
  });
});