import { test, expect } from '@playwright/test';

test.describe('HDH-05c - Panel Victorias', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar grafico de victorias con mock data', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    const chart = page.locator('#chart-wins');
    await expect(chart).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/HDH-05c-victorias-mock.png', fullPage: true });
  });

  test('debe mostrar barras correctas con datos custom', async ({ page }) => {
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
        {
          id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
            { playerRefId: 3, score: '6', scoreNum: 6, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
            { playerRefId: 3, score: '6', scoreNum: 6, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '5', scoreNum: 5, winner: false },
            { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 3, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 4, playDate: '2024-01-04', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '5', scoreNum: 5, winner: false },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false },
            { playerRefId: 3, score: '10', scoreNum: 10, winner: true }
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

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.wins;
      return {
        labels: chart.data.labels,
        values: chart.data.datasets[0].data
      };
    });

    // Alice: 2 wins, Bob: 1 win, Charlie: 1 win (sorted desc)
    expect(chartData.labels).toEqual(['Alice', 'Bob', 'Charlie']);
    expect(chartData.values).toEqual([2, 1, 1]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05c-victorias-custom.png', fullPage: true });
  });

  test('debe actualizar grafico al aplicar filtros', async ({ page }) => {
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
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'Italy', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '5', scoreNum: 5, winner: false },
            { playerRefId: 2, score: '10', scoreNum: 10, winner: true }
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

    // Initial: Alice 2, Bob 1
    let chartData = await page.evaluate(() => {
      const chart = window.App.charts.wins;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['Alice', 'Bob']);
    expect(chartData.values).toEqual([2, 1]);

    // Filter Italy only: Bob 1, Alice 0
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    chartData = await page.evaluate(() => {
      const chart = window.App.charts.wins;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['Bob']);
    expect(chartData.values).toEqual([1]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05c-victorias-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    chartData = await page.evaluate(() => {
      const chart = window.App.charts.wins;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['Alice', 'Bob']);
    expect(chartData.values).toEqual([2, 1]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05c-victorias-filtro-desactivado.png', fullPage: true });
  });

  test('debe mostrar grafico vacio cuando no hay victorias', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false }
      ],
      locations: [{ id: 1, name: 'Home' }],
      boards: [{ id: 1, name: 'USA' }],
      plays: [
        {
          id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '5', scoreNum: 5, winner: false }
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

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.wins;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual([]);
    expect(chartData.values).toEqual([]);
  });
});
