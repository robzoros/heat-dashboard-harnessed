import { test, expect } from '@playwright/test';

test.describe('HDH-06b - Pestaña Circuitos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar doughnut chart con mock data', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await expect(page.locator('#tab-circuitos')).toBeVisible();

    const chart = page.locator('#chart-tracks');
    await expect(chart).toBeVisible();

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.tracks;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual(['Circuit A', 'Circuit B']);
    expect(chartData.values).toEqual([2, 2]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-06b-circuitos-mock.png', fullPage: true });
  });

  test('debe mostrar track list con stats correctas', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false }
      ],
      locations: [{ id: 1, name: 'Home' }],
      boards: [{ id: 1, name: 'USA' }, { id: 2, name: 'Italy' }],
      plays: [
        {
          id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
            { playerRefId: 2, score: '20', scoreNum: 20, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '25', scoreNum: 25, winner: true },
            { playerRefId: 2, score: '15', scoreNum: 15, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'Italy', locationRefId: 1,
          playerScores: [
            { playerRefId: 2, score: '40', scoreNum: 40, winner: true },
            { playerRefId: 1, score: '10', scoreNum: 10, winner: false }
          ]
        }
      ]
    };

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

    const trackCards = page.locator('.track-card');
    await expect(trackCards).toHaveCount(2);

    // USA: 2 plays, avg 22.5, champion Alice (2 wins)
    const usaCard = trackCards.first();
    await expect(usaCard.locator('h4')).toContainText('USA');
    await expect(usaCard.locator('p').first()).toContainText('2');

    // Italy: 1 play, avg 25.0, champion Bob (1 win)
    const italyCard = trackCards.last();
    await expect(italyCard.locator('h4')).toContainText('Italy');
    await expect(italyCard.locator('p').first()).toContainText('1');

    await page.screenshot({ path: '../evidence/screenshots/HDH-06b-circuitos-custom.png', fullPage: true });
  });

  test('debe actualizar chart y lista al aplicar filtros', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false }
      ],
      locations: [{ id: 1, name: 'Home' }],
      boards: [{ id: 1, name: 'USA' }, { id: 2, name: 'Italy' }],
      plays: [
        {
          id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
            { playerRefId: 2, score: '20', scoreNum: 20, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 2, score: '25', scoreNum: 25, winner: true },
            { playerRefId: 1, score: '15', scoreNum: 15, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'Italy', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '40', scoreNum: 40, winner: true },
            { playerRefId: 2, score: '10', scoreNum: 10, winner: false }
          ]
        }
      ]
    };

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

    // Initial: 2 tracks
    let trackCards = page.locator('.track-card');
    await expect(trackCards).toHaveCount(2);

    // Filter Italy only
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    trackCards = page.locator('.track-card');
    await expect(trackCards).toHaveCount(1);
    await expect(trackCards.first().locator('h4')).toContainText('Italy');

    await page.screenshot({ path: '../evidence/screenshots/HDH-06b-circuitos-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    trackCards = page.locator('.track-card');
    await expect(trackCards).toHaveCount(2);

    await page.screenshot({ path: '../evidence/screenshots/HDH-06b-circuitos-filtro-desactivado.png', fullPage: true });
  });

  test('debe mostrar vacio cuando no hay partidas', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false }
      ],
      locations: [{ id: 1, name: 'Home' }],
      boards: [{ id: 1, name: 'USA' }],
      plays: []
    };

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

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.tracks;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual([]);
    expect(chartData.values).toEqual([]);

    const trackCards = page.locator('.track-card');
    await expect(trackCards).toHaveCount(0);
  });
});
