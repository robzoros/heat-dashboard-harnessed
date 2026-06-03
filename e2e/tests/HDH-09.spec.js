import { test, expect } from '@playwright/test';

test.describe('HDH-09 - Pestaña Campeonatos', () => {
  test.beforeEach(async ({ page }) => {
    await cleanupChampionships();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
  });

  async function cleanupChampionships() {
    const baseUrl = 'http://localhost:8082';
    const http = await import('http');
    const listData = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/bgg-api/championships`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    if (listData.success && Array.isArray(listData.data)) {
      for (const champ of listData.data) {
        await new Promise((resolve, reject) => {
          const req = http.request(`${baseUrl}/bgg-api/championships/${champ.id}`, {
            method: 'DELETE'
          }, res => {
            res.on('data', () => {});
            res.on('end', () => resolve());
          });
          req.on('error', reject);
          req.end();
        });
      }
    }
  }

  async function loadData(page) {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(async () => {
      const response = await fetch('/bgg-api/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const result = await response.json();
      if (result.success && result.data) {
        window.App.data = result.data;
        window.App.bggUsername = 'testuser';
        window.App.originalPlayers = result.data.players.map(p => ({ ...p }));
        window.App.applyPlayerOverrides();
      }
      window.App.populateFilters();
      window.App.updateHeaderStats();
      window.App.renderAll();
    });
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

  const ALL_PARTICIPANTS = ['1','2','3','4','5','6','7','8','9','10','11','12','13','14'];

  async function createChampViaAPI(page, champName, participants) {
    // Create championship via native Node HTTP (not browser fetch)
    const baseUrl = 'http://localhost:8082';
    const http = await import('http');
    const postData = JSON.stringify({ name: champName, description: '', participants: participants || ALL_PARTICIPANTS, owner: 'testuser' });
    const createResult = await new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}/bgg-api/championships`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
    if (!createResult.success) throw new Error('Create failed');
    return createResult.data;
  }

  async function addPlaysViaAPI(page, champId, playIds) {
    const baseUrl = 'http://localhost:8082';
    const http = await import('http');
    const allPlaysData = await new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}/bgg-api/test-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write('{}');
      req.end();
    });
    const fullPlays = allPlaysData.data.plays.filter(p => playIds.includes(String(p.id)));
    const postData = JSON.stringify({ plays: fullPlays });
    await new Promise((resolve, reject) => {
      const req = http.request(`${baseUrl}/bgg-api/championships/${champId}/plays`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async function loadChampsIntoApp(page) {
    const baseUrl = 'http://localhost:8082';
    const http = await import('http');
    const listData = await new Promise((resolve, reject) => {
      http.get(`${baseUrl}/bgg-api/championships`, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => resolve(JSON.parse(d)));
      }).on('error', reject);
    });
    if (listData.success) {
      await page.evaluate(data => {
        window.App.championships.list = data;
        window.App.championships.selected = null;
        window.App.renderChampionships();
      }, listData.data);
    }
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
    await addPlaysViaAPI(page, champData.id, ['114140439', '113571664', '113505826']);
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
    await addPlaysViaAPI(page, champData.id, ['114140439']);
    await loadChampsIntoApp(page);

    await page.locator('#tabs .tab-btn').nth(4).click();
    await expect(page.locator('#campeonatos-select option')).toHaveCount(2);
    await selectChampInApp(page, champData.id);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="113571664"]').check();
    await page.locator('#import-plays-list input[value="113505826"]').check();
    await page.locator('#btn-import-plays').click();
    await page.waitForFunction(() => document.querySelectorAll('.campeonato-play-item').length >= 3, { timeout: 5000 });
    await expect(page.locator('.campeonato-play-item')).toHaveCount(3);
    await page.screenshot({ path: '../evidence/screenshots/HDH-09-importar-partidas.png', fullPage: true });
  });

  test('debe eliminar partida del campeonato', async ({ page }) => {
    await loadData(page);
    const champData = await createChampViaAPI(page, 'Delete Test');
    await addPlaysViaAPI(page, champData.id, ['114140439', '113571664']);
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
