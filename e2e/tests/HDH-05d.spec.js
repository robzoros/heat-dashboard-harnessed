import { test, expect } from '@playwright/test';

test.describe('HDH-05d - Panel Partidas por Mes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar grafico de partidas por mes con mock data', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    const chart = page.locator('#chart-plays-month');
    await expect(chart).toBeVisible();

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.playsMonth;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual(['2024-01', '2024-02', '2024-03', '2024-04']);
    expect(chartData.values).toEqual([1, 1, 1, 1]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05d-partidas-mes-mock.png', fullPage: true });
  });

  test('debe mostrar conteo correcto con datos custom', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false }
      ],
      locations: [{ id: 1, name: 'Home' }],
      boards: [{ id: 1, name: 'USA' }],
      plays: [
        {
          id: 1, playDate: '2024-01-10', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-20', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 1, score: '7', scoreNum: 7, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-25', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '5', scoreNum: 5, winner: false }
          ]
        },
        {
          id: 4, playDate: '2024-03-05', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 1, score: '9', scoreNum: 9, winner: false }
          ]
        },
        {
          id: 5, playDate: '2024-03-15', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '6', scoreNum: 6, winner: false }
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
      const chart = window.App.charts.playsMonth;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual(['2024-01', '2024-03']);
    expect(chartData.values).toEqual([3, 2]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05d-partidas-mes-custom.png', fullPage: true });
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
          id: 1, playDate: '2024-01-10', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-20', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 2, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 1, score: '7', scoreNum: 7, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-02-05', board: 'Italy', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '5', scoreNum: 5, winner: false }
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

    // Initial: Jan=2, Feb=1
    let chartData = await page.evaluate(() => {
      const chart = window.App.charts.playsMonth;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['2024-01', '2024-02']);
    expect(chartData.values).toEqual([2, 1]);

    // Filter Italy only: Feb=1
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    chartData = await page.evaluate(() => {
      const chart = window.App.charts.playsMonth;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['2024-02']);
    expect(chartData.values).toEqual([1]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05d-partidas-mes-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    chartData = await page.evaluate(() => {
      const chart = window.App.charts.playsMonth;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['2024-01', '2024-02']);
    expect(chartData.values).toEqual([2, 1]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05d-partidas-mes-filtro-desactivado.png', fullPage: true });
  });

  test('debe mostrar grafico vacio cuando no hay partidas', async ({ page }) => {
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

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.playsMonth;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual([]);
    expect(chartData.values).toEqual([]);
  });
});
