import { test, expect } from '@playwright/test';

// Fixtures para probar la config de colores (src/data/player-colors.json).
// Alice/Bot/Charlie comparten el primario #ff0000 a propósito:
// la resolución alfabética debe dar: Alice primario, Bob secundario,
// Bot1 primario (libre) y Charlie secundario.
const fixtureConfig = {
  version: 1,
  generatedFrom: 'heat-data.json (fixture)',
  players: [
    { name: 'Alice', type: 'main', primary: '#ff0000', secondary: '' },
    { name: 'Bob', type: 'main', primary: '#ff0000', secondary: '#00ff00' },
    { name: 'Charlie', type: 'main', primary: '#ff0000', secondary: '#0000ff' },
    { name: 'Bot1', type: 'bot', primary: '#ff00ff', secondary: '' }
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
  boards: [{ id: 1, name: 'USA' }],
  plays: [
    { id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
      { playerRefId: 3, score: '6', scoreNum: 6, winner: false } ] },
    { id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
      { playerRefId: 3, score: '6', scoreNum: 6, winner: false } ] },
    { id: 3, playDate: '2024-02-03', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '11', scoreNum: 11, winner: true },
      { playerRefId: 2, score: '10', scoreNum: 10, winner: false },
      { playerRefId: 3, score: '6', scoreNum: 6, winner: false } ] },
    { id: 4, playDate: '2024-02-04', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '7', scoreNum: 7, winner: false },
      { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
      { playerRefId: 3, score: '9', scoreNum: 9, winner: false } ] },
    { id: 5, playDate: '2024-02-05', board: 'USA', locationRefId: 1, playerScores: [
      { playerRefId: 1, score: '8', scoreNum: 8, winner: false },
      { playerRefId: 2, score: '9', scoreNum: 9, winner: false },
      { playerRefId: 3, score: '10', scoreNum: 10, winner: true } ] }
  ]
};

async function routeConfig(page, config) {
  await page.route('**/data/player-colors.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) })
  );
}

async function openApp(page, query = '') {
  await page.goto(`/${query}`);
  await page.waitForLoadState('networkidle');
  const banner = page.locator('#cookie-consent-banner:not(.hidden)');
  if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('#btn-accept-cookies');
  }
}

test('la app carga la config de colores y playerColor usa los colores definidos', async ({ page }) => {
  await routeConfig(page, fixtureConfig);
  await openApp(page);

  // Inyectamos datos cuyo roster coincide con el fixture.
  await page.evaluate((data) => {
    window.App.data = data;
    window.App.renderAll();
  }, customData);

  const colors = await page.evaluate(() => ({
    alice: window.App.playerColor('Alice'),
    bob: window.App.playerColor('Bob'),
    charlie: window.App.playerColor('Charlie'),
    bot: window.App.playerColor('Bot1'),
    loaded: Boolean(window.App.colorConfig)
  }));

  expect(colors.loaded).toBe(true);
  expect(colors.alice).toBe('#ff0000');   // primario sin conflicto
  expect(colors.bob).toBe('#00ff00');     // conflicto -> secundario
  expect(colors.charlie).toBe('#0000ff'); // conflicto -> secundario
  expect(colors.bot).toBe('#ff00ff');     // los bots también tienen color
});

test('los gráficos de Resumen pintan las barras con la config (primario y secundario)', async ({ page }) => {
  await routeConfig(page, fixtureConfig);
  await openApp(page);

  await page.evaluate((data) => {
    window.App.data = data;
    window.App.populateFilters();
    window.App.filters.active = false;
    window.App.updateHeaderStats();
    window.App.renderAll();
  }, customData);

  const chart = await page.evaluate(() => ({
    labels: window.App.charts.wins.data.labels,
    colors: window.App.charts.wins.data.datasets[0].backgroundColor
  }));

  expect(chart.labels).toEqual(['Alice', 'Bob', 'Charlie']);
  expect(chart.colors).toEqual(['#ff0000', '#00ff00', '#0000ff']);

  await page.screenshot({ path: '../evidence/screenshots/HDH-COL01-resumen-conflicto.png', fullPage: true });
});

test('con la config real, los principales conservan su color y los bots tienen color propio', async ({ page }) => {
  await openApp(page);

  const config = await page.evaluate(() => {
    const players = window.App.colorConfig ? window.App.colorConfig.players : [];
    return {
      entries: players.length,
      colorMapSize: window.App.colorMap ? window.App.colorMap.size : 0,
      botsColored: players.filter(e => e.type === 'bot' && e.primary).length
    };
  });

  expect(config.entries).toBeGreaterThan(0);
  expect(config.colorMapSize).toBeGreaterThan(0);
  expect(config.botsColored).toBeGreaterThan(0);

  await page.screenshot({ path: '../evidence/screenshots/HDH-COL01-resumen-config-real.png', fullPage: true });
});
