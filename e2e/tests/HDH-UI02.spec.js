import { test, expect } from '@playwright/test';

// Alice 3 victorias, Bob 2, Charlie 1 (puestos distintos), más un bot.
const customData = {
  players: [
    { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
    { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false },
    { id: 3, name: 'Charlie', isBot: false, isMain: true, isOther: false },
    { id: 4, name: 'Bot1', isBot: true, isMain: false, isOther: false }
  ],
  locations: [{ id: 1, name: 'Home' }],
  boards: [{ id: 1, name: 'USA' }, { id: 2, name: 'Italy' }],
  plays: [
    { id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
      { playerRefId: 3, score: '6', scoreNum: 6, winner: false } ] },
    { id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
      { playerRefId: 3, score: '6', scoreNum: 6, winner: false } ] },
    { id: 3, playDate: '2024-02-03', board: 'Italy', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 2, score: '9', scoreNum: 9, winner: false },
      { playerRefId: 3, score: '7', scoreNum: 7, winner: false } ] },
    { id: 4, playDate: '2024-02-04', board: 'Italy', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '5', scoreNum: 5, winner: false },
      { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 3, score: '8', scoreNum: 8, winner: false } ] },
    { id: 5, playDate: '2024-03-05', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '5', scoreNum: 5, winner: false },
      { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 3, score: '8', scoreNum: 8, winner: false } ] },
    { id: 6, playDate: '2024-03-06', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '5', scoreNum: 5, winner: false },
      { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
      { playerRefId: 3, score: '10', scoreNum: 10, winner: true } ] }
  ]
};

async function loadCustomData(page) {
  await page.evaluate((data) => {
    window.App.data = data;
    window.App.populateFilters();
    window.App.filters.active = true;
    window.App.filters.players = [];
    window.App.filters.tracks = [];
    window.App.filters.locations = [];
    window.App.updateHeaderStats();
    window.App.renderAll();
  }, customData);
}

async function openApp(page, query = '') {
  await page.goto(`/${query}`);
  await page.waitForLoadState('networkidle');
  const banner = page.locator('#cookie-consent-banner:not(.hidden)');
  if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('#btn-accept-cookies');
  }
  await page.waitForSelector('canvas', { timeout: 10000 });
}

test.describe('HDH-UI02 - Rediseño visual de Resumen', () => {
  test('los KPIs usan etiquetas claras y mantienen sus valores', async ({ page }) => {
    await openApp(page);
    await loadCustomData(page);

    const labels = await page.locator('.kpi-card h3').allTextContents();
    expect(labels).toEqual(['Líder', 'Circuito más jugado', 'Mejor racha', 'Última partida']);
    await expect(page.locator('#kpi-leader')).toHaveText('Alice (3)');
  });

  test('el podio colorea cada puesto con el color de su jugador y sus alturas siguen el puesto', async ({ page }) => {
    await openApp(page);
    await loadCustomData(page);

    const places = page.locator('#podium .podium-place');
    await expect(places).toHaveCount(3);

    const info = await places.evaluateAll(els => els.map(el => ({
      name: el.querySelector('.podium-name').textContent,
      color: el.style.getPropertyValue('--pc'),
      height: el.getBoundingClientRect().height
    })));
    const byName = Object.fromEntries(info.map(i => [i.name, i]));

    // Colores: orden alfabético entre los principales (Alice, Bob, Charlie)
    const palette = await page.evaluate(() => App.PLAYER_PALETTE);
    expect(byName.Alice.color).toBe(palette[0]);
    expect(byName.Bob.color).toBe(palette[1]);
    expect(byName.Charlie.color).toBe(palette[2]);

    // Alturas: 1.º > 2.º > 3.º
    expect(byName.Alice.height).toBeGreaterThan(byName.Bob.height);
    expect(byName.Bob.height).toBeGreaterThan(byName.Charlie.height);
  });

  test('cada jugador conserva su color en los gráficos aunque el filtro cambie los supervivientes', async ({ page }) => {
    await openApp(page);
    await loadCustomData(page);

    const colors = () => page.evaluate(() => {
      const chart = Chart.getChart('chart-wins');
      const ds = chart.data.datasets[0];
      return Object.fromEntries(chart.data.labels.map((l, i) => [l, ds.backgroundColor[i]]));
    });
    const palette = await page.evaluate(() => App.PLAYER_PALETTE);

    const all = await colors();
    expect(all).toEqual({ Alice: palette[0], Bob: palette[1], Charlie: palette[2] });

    // Solo partidas en Italy: Alice (1) y Bob (1) siguen vivos y no se repintan
    await page.click('#btn-toggle-filters');
    await page.locator('#track-filters input').nth(1).check();
    await page.click('#btn-apply-filters');
    const filtered = await colors();
    expect(filtered.Alice).toBe(palette[0]);
    expect(filtered.Bob).toBe(palette[1]);

    // Puntos medios usa los mismos colores
    const avg = await page.evaluate(() => {
      const chart = Chart.getChart('chart-avgpts');
      const ds = chart.data.datasets[0];
      return Object.fromEntries(chart.data.labels.map((l, i) => [l, ds.backgroundColor[i]]));
    });
    expect(avg.Alice).toBe(palette[0]);
    expect(avg.Bob).toBe(palette[1]);
  });

  test('los gráficos de Resumen no muestran leyenda de una sola serie y respetan el tamaño del contenedor', async ({ page }) => {
    await openApp(page);
    await loadCustomData(page);

    const legends = await page.evaluate(() =>
      ['chart-wins', 'chart-plays-month', 'chart-avgpts'].map(id => Chart.getChart(id).options.plugins.legend.display));
    expect(legends).toEqual([false, false, false]);

    for (const id of ['chart-wins', 'chart-plays-month', 'chart-avgpts']) {
      const box = await page.locator(`#${id}`).boundingBox();
      expect(box.height).toBeGreaterThan(150);
      expect(box.height).toBeLessThanOrEqual(260);
    }
  });

  test('genera screenshots de Resumen con el tema Asfalto y brasa (escritorio y móvil)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await loadCustomData(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI02-resumen-escritorio.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI02-resumen-movil.png', fullPage: true });
  });
});
