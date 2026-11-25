import { test, expect } from '@playwright/test';

// HDH-UI04 - Rediseño de la pestaña Campeonatos (rail compacto + chart protagonista):
// - Lista de campeonatos como rail de tarjetas (líder, participantes, partidas, fecha).
// - Detalle: Clasificación y Evolución lado a lado, Partidas a todo lo ancho.
// - Chart de evolución acumulativa, siempre creciente, con eje Y adaptado al campeonato.
// - Responsive: rail en scroll horizontal y paneles apilados en pantallas estrechas.
test.describe('HDH-UI04 - Rail de campeonatos y detalle con chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('hdh-championships'));
    await page.waitForLoadState('networkidle');
    const cookieBanner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await cookieBanner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(() => window.App.loadChampionships());
    await page.locator('#tabs .tab-btn').nth(4).click();
    await page.waitForTimeout(200);
  });

  function race(id, playDate, board, scores) {
    return {
      id, playDate, board, locationRefId: 1,
      playerScores: scores.map(([playerRefId, scoreNum, winner]) => ({
        playerRefId, score: String(scoreNum), scoreNum, winner: !!winner
      }))
    };
  }

  async function createChampWithPlays(page, plays, name = 'UI04 Campeonato') {
    const champData = await page.evaluate(
      ({ name }) => window.App.createChampionship(name, 'Campeonato de prueba UI04', ['1', '2', '3', '4']).then(r => r.data),
      { name }
    );
    // Persistir las carreras en storage y recargar: el rail lee de championships.raw.
    await page.evaluate(async ({ id, plays }) => {
      App.championships.selected = null;
      const stored = App.getStoredChampionships().map(c => c.id === id
        ? { ...c, plays, playIds: plays.map(p => p.id) }
        : c);
      App.saveStoredChampionships(stored);
      await App.loadChampionships();
      await App.selectChampionship(id);
      App.renderChampionships();
    }, { id: champData.id, plays });
    return champData;
  }

  test('el rail muestra una tarjeta por campeonato con líder, participantes y partidas', async ({ page }) => {
    await createChampWithPlays(page, [
      race(101, '2024-01-10', 'Circuit A', [['1', 11, true], ['2', 8, false], ['3', 5, false]]),
      race(102, '2024-02-10', 'Circuit B', [['1', 8, false], ['2', 11, true], ['3', 4, false]])
    ]);
    await page.evaluate(() => window.App.loadChampionships());
    const card = page.locator('.champ-card').first();
    await expect(card).toBeVisible();
    await expect(card.locator('.champ-card-name')).toContainText('UI04 Campeonato');
    await expect(card.locator('.champ-card-meta')).toContainText('👥');
    await expect(card.locator('.champ-card-meta')).toContainText('🏁');
    await expect(card.locator('.champ-leader')).toContainText('Líder:');
    await expect(card).toHaveClass(/is-selected/);
    await expect(page.locator('#campeonato-detail')).toBeVisible();
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI04-rail.png', fullPage: true });
  });

  test('clic en la tarjeta del rail selecciona el campeonato', async ({ page }) => {
    const champ = await createChampWithPlays(page, [
      race(101, '2024-01-10', 'Circuit A', [['1', 11, true], ['2', 8, false], ['3', 5, false]])
    ]);
    await page.evaluate((id) => {
      App.championships.selected = null;
      App.renderChampionships();
    }, champ.id);
    await expect(page.locator('#campeonato-detail')).toBeHidden();
    await page.locator('.champ-card').first().click();
    await expect(page.locator('#campeonato-detail')).toBeVisible();
    await expect(page.locator('.campeonato-detail-header h2')).toContainText('UI04 Campeonato');
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI04-rail-seleccion.png', fullPage: true });
  });

  test('el detalle muestra Clasificación y Evolución lado a lado y Partidas debajo', async ({ page }) => {
    await createChampWithPlays(page, [
      race(201, '2024-01-10', 'Circuit A', [['1', 11, true], ['2', 8, false], ['3', 5, false]]),
      race(202, '2024-02-10', 'Circuit B', [['1', 9, true], ['2', 6, false], ['3', 3, false]])
    ]);
    const duo = page.locator('.campeonato-duo');
    await expect(duo).toBeVisible();
    const boxes = await duo.locator('.campeonato-section').evaluateAll(els => els.map(el => el.querySelector('h3')?.textContent));
    expect(boxes).toEqual(['Clasificación', 'Evolución de puntos']);
    const duoBox = await duo.boundingBox();
    const standingsBox = await duo.locator('.campeonato-section').first().boundingBox();
    const chartBox = await duo.locator('.campeonato-section').nth(1).boundingBox();
    expect(chartBox.y).toBeCloseTo(standingsBox.y, 0);
    await expect(page.locator('.campeonato-plays-panel')).toBeVisible();
    const playsBox = await page.locator('.campeonato-plays-panel').boundingBox();
    expect(playsBox.y).toBeGreaterThan(duoBox.y + duoBox.height - 5);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI04-detalle-duo.png', fullPage: true });
  });

  test('el chart de evolución es acumulativo y está en la pantalla del detalle', async ({ page }) => {
    await createChampWithPlays(page, [
      race(301, '2024-01-10', 'Circuit A', [['1', 11, true], ['2', 7, false], ['3', 4, false]]),
      race(302, '2024-02-10', 'Circuit B', [['1', 9, false], ['2', 11, true], ['3', 3, false]]),
      race(303, '2024-03-10', 'Circuit C', [['1', 10, true], ['2', 6, false], ['3', 5, false]])
    ]);
    // Player1: 11, 20, 30 (acumulativo y creciente) | Player2: 7, 18, 24 | Player3: 4, 7, 12.
    const series = await page.evaluate(() => {
      const c = window.App.charts.champEvolution;
      if (!c) return null;
      return c.data.datasets.map(d => ({ label: d.label, data: d.data }));
    });
    expect(series).not.toBeNull();
    const byName = Object.fromEntries(series.map(d => [d.label, d.data]));
    expect(byName['Player1']).toEqual([11, 20, 30]);
    expect(byName['Player2']).toEqual([7, 18, 24]);
    expect(byName['Player3']).toEqual([4, 7, 12]);
    for (const d of series) {
      for (let i = 1; i < d.data.length; i++) {
        expect(d.data[i]).toBeGreaterThanOrEqual(d.data[i - 1]);
      }
    }
    expect(page.locator('#chart-champ-evolution')).toBeVisible();
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI04-chart-acumulativo.png', fullPage: true });
  });

  test('móvil: el rail se desplaza en horizontal y el duo se apila', async ({ page }) => {
    const first = await createChampWithPlays(page, [
      race(401, '2024-01-10', 'Circuit A', [['1', 11, true], ['2', 8, false], ['3', 5, false]])
    ], 'UI04 Campeonato A');
    await page.evaluate(async ({ id }) => {
      await window.App.createChampionship('UI04 Campeonato B', '', ['1', '2'], 'local');
      App.championships.selected = null;
      await App.loadChampionships();
      App.renderChampionships();
    }, { id: first.id });
    await expect(page.locator('.champ-card')).toHaveCount(2);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const railOverflow = await page.locator('#campeonatos-rail .rail-list').evaluate(el => el.scrollWidth > el.clientWidth);
    expect(railOverflow).toBe(true);
    // Reseleccionar para medir el duo apilado con el detalle abierto.
    await page.evaluate((id) => window.App.selectChampionship(id), first.id);
    await page.waitForTimeout(300);
    const duoBox = await page.locator('.campeonato-duo').boundingBox();
    const standingsBox = await page.locator('.campeonato-duo .campeonato-section').first().boundingBox();
    const chartBox = await page.locator('.campeonato-duo .campeonato-section').nth(1).boundingBox();
    expect(chartBox.y).toBeGreaterThan(standingsBox.y + standingsBox.height - 5);
    expect(chartBox.width).toBeLessThanOrEqual(duoBox.width + 1);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI04-movil.png', fullPage: true });
  });
});
