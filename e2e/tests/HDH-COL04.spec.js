import { test, expect } from '@playwright/test';

// HDH-COL04: en la pestaña Circuitos, el chart de victorias del circuito
// usa los colores definidos en src/data/player-colors.json para cada jugador
// principal y la entrada agregada 'Bots' usa un color de la paleta de la
// config que no esté presente en el chart.
const fixtureConfig = {
  version: 1,
  generatedFrom: 'heat-data.json (fixture)',
  palette: ['#ff0000', '#00ff00', '#0000ff', '#ff00ff', '#00ffff'],
  paletteNames: ['Rojo', 'Verde', 'Azul', 'Magenta', 'Cian'],
  players: [
    { name: 'Alice', type: 'main', primary: '#ff0000', secondary: '' },
    { name: 'Bob', type: 'main', primary: '#00ff00', secondary: '' },
    { name: 'Charlie', type: 'main', primary: '#0000ff', secondary: '' },
    { name: 'Bot1', type: 'bot', primary: '#123456', secondary: '' }
  ]
};

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
      { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
      { playerRefId: 4, score: '10', scoreNum: 10, winner: false } ] },
    { id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 4, score: '28', scoreNum: 28, winner: true },
      { playerRefId: 1, score: '15', scoreNum: 15, winner: false } ] },
    { id: 3, playDate: '2024-01-03', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 2, score: '40', scoreNum: 40, winner: true },
      { playerRefId: 1, score: '18', scoreNum: 18, winner: false } ] },
    { id: 4, playDate: '2024-02-01', board: 'Italy', locationRefId: 1, playerScores: [
      { playerRefId: 3, score: '22', scoreNum: 22, winner: true },
      { playerRefId: 2, score: '20', scoreNum: 20, winner: false } ] }
  ]
};

async function routeConfig(page, config) {
  await page.route('**/data/player-colors.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) })
  );
}

async function openApp(page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const banner = page.locator('#cookie-consent-banner:not(.hidden)');
  if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('#btn-accept-cookies');
  }
}

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
  await page.locator('.tab-btn[data-tab="circuitos"]').click();
}

async function tracksChart(page) {
  return page.evaluate(() => {
    const ds = window.App.charts.tracks.data.datasets[0];
    return {
      labels: window.App.charts.tracks.data.labels,
      backgroundColor: ds.backgroundColor,
      title: document.getElementById('tracks-chart-title').textContent
    };
  });
}

test('al seleccionar un circuito, cada jugador del chart usa su color de player-colors.json', async ({ page }) => {
  await routeConfig(page, fixtureConfig);
  await openApp(page);
  await loadCustomData(page);

  // USA: Alice gana 1, Bot1 gana 1 (-> 'Bots'), Bob gana 1. Charlie no gana en USA.
  await page.locator('.track-name[data-track="USA"]').click();
  await expect(page.locator('#tracks-chart-title')).toContainText('Victorias — USA');

  const chart = await tracksChart(page);
  const idx = {};
  chart.labels.forEach((l, i) => { idx[l] = i; });

  expect(chart.backgroundColor[idx['Alice']]).toBe('#ff0000'); // primario de Alice
  expect(chart.backgroundColor[idx['Bob']]).toBe('#00ff00');   // primario de Bob
  // Los colores de jugadores presentes vienen de la config
  expect(chart.backgroundColor[idx['Charlie']]).toBeUndefined(); // Charlie no está en USA

  await page.screenshot({ path: '../evidence/screenshots/HDH-COL04-victorias-colores.png', fullPage: true });
});

test("la entrada 'Bots' usa un color de la paleta que no esté presente en el chart", async ({ page }) => {
  await routeConfig(page, fixtureConfig);
  await openApp(page);
  await loadCustomData(page);

  await page.locator('.track-name[data-track="USA"]').click();
  await expect(page.locator('#tracks-chart-title')).toContainText('Victorias — USA');

  const chart = await tracksChart(page);
  const idx = {};
  chart.labels.forEach((l, i) => { idx[l] = i; });

  const botsColor = chart.backgroundColor[idx['Bots']];
  // Está en la paleta de la config...
  expect(fixtureConfig.palette.map(c => c.toLowerCase())).toContain(botsColor.toLowerCase());
  // ...y no coincide con el color de ningún jugador presente en el chart.
  const playerColorsInChart = chart.labels
    .map((l, i) => (l === 'Bots' ? null : chart.backgroundColor[i]))
    .filter(Boolean)
    .map(c => c.toLowerCase());
  expect(playerColorsInChart).not.toContain(botsColor.toLowerCase());
  // Determinista: primer color libre de la paleta = #0000ff
  expect(botsColor.toLowerCase()).toBe('#0000ff');
});

test('al deseleccionar el circuito se restaura la Distribución con los colores por defecto', async ({ page }) => {
  await routeConfig(page, fixtureConfig);
  await openApp(page);
  await loadCustomData(page);

  await page.locator('.track-name[data-track="USA"]').click();
  await expect(page.locator('#tracks-chart-title')).toContainText('Victorias — USA');

  await page.locator('.track-name[data-track="USA"]').click();
  await expect(page.locator('#tracks-chart-title')).toContainText('Distribución');

  const chart = await tracksChart(page);
  expect(chart.labels).toEqual(['Italy', 'USA']);
  // Colores por defecto (accent, surface-3, text-muted), no colores de jugadores
  expect(chart.backgroundColor[0]).not.toBe('#ff0000');
  expect(chart.backgroundColor[0]).not.toBe('#00ff00');
});

test('evidencia con datos reales: colores de la config visibles en Circuitos', async ({ page }) => {
  // player-colors.json real (sin route): los principales deben tener su color de config
  await openApp(page);
  await page.locator('.tab-btn[data-tab="circuitos"]').click();
  await page.waitForSelector('#track-list .track-card', { timeout: 10000 });

  const firstTrack = await page.locator('.track-name').first().textContent();
  const trackName = (firstTrack || '').replace(/^[^\p{L}]+/u, '').trim();
  await page.locator(`.track-name[data-track="${trackName}"]`).click();
  await expect(page.locator('#tracks-chart-title')).toContainText(`Victorias — ${trackName}`);

  const info = await page.evaluate(() => {
    const ds = window.App.charts.tracks.data.datasets[0];
    const labels = window.App.charts.tracks.data.labels;
    return {
      loaded: Boolean(window.App.colorConfig),
      pairs: labels.map((l, i) => [l, ds.backgroundColor[i]])
    };
  });

  expect(info.loaded).toBe(true);
  // El color del chart coincide con playerColor de la config para cada jugador
  const resolved = await page.evaluate(labels =>
    labels.map(l => (l === 'Bots' ? 'BOTS' : window.App.playerColor(l))), info.pairs.map(p => p[0]));
  info.pairs.forEach(([label, color], i) => {
    if (label === 'Bots') {
      expect(resolved[i]).toBe('BOTS');
      expect(color.toLowerCase()).not.toBe('#123456');
    } else {
      expect(color.toLowerCase()).toBe(resolved[i].toLowerCase());
    }
  });

  await page.screenshot({ path: '../evidence/screenshots/HDH-COL04-datos-reales.png', fullPage: true });
});
