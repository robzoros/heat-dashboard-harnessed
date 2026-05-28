import { test, expect } from '@playwright/test';

test.describe('HDH-05e - Panel Puntos Medios', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar grafico de puntos medios con mock data', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    const chart = page.locator('#chart-avgpts');
    await expect(chart).toBeVisible();

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.avgPts;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    // Player1: (25+22+28)/3 = 25.0, Player2: (20+30+24)/3 = 24.666... -> 24.7
    expect(chartData.labels).toEqual(['Player1', 'Player2']);
    expect(chartData.values.length).toBe(2);
    expect(chartData.values[0]).toBe(25.0);
    expect(chartData.values[1]).toBeCloseTo(24.7, 1);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05e-avgpts-mock.png', fullPage: true });
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
            { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
            { playerRefId: 2, score: '20', scoreNum: 20, winner: false },
            { playerRefId: 3, score: '10', scoreNum: 10, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '20', scoreNum: 20, winner: false },
            { playerRefId: 2, score: '30', scoreNum: 30, winner: true },
            { playerRefId: 3, score: '10', scoreNum: 10, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: false },
            { playerRefId: 2, score: '20', scoreNum: 20, winner: false },
            { playerRefId: 3, score: '30', scoreNum: 30, winner: true }
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
      const chart = window.App.charts.avgPts;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    // Alice: (30+20+10)/3=20.0, Bob: (20+30+20)/3=23.33, Charlie: (10+10+30)/3=16.67
    expect(chartData.labels).toEqual(['Bob', 'Alice', 'Charlie']);
    expect(chartData.values[0]).toBeCloseTo(23.3, 1);
    expect(chartData.values[1]).toBe(20.0);
    expect(chartData.values[2]).toBeCloseTo(16.7, 1);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05e-avgpts-custom.png', fullPage: true });
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
            { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
            { playerRefId: 2, score: '10', scoreNum: 10, winner: false }
          ]
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '20', scoreNum: 20, winner: true },
            { playerRefId: 2, score: '20', scoreNum: 20, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'Italy', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: false },
            { playerRefId: 2, score: '40', scoreNum: 40, winner: true }
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

    // Initial: Alice (30+20+10)/3=20.0, Bob (10+20+40)/3=23.33
    let chartData = await page.evaluate(() => {
      const chart = window.App.charts.avgPts;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['Bob', 'Alice']);
    expect(chartData.values[0]).toBeCloseTo(23.3, 1);
    expect(chartData.values[1]).toBe(20.0);

    // Filter Italy only: Alice 10, Bob 40
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    chartData = await page.evaluate(() => {
      const chart = window.App.charts.avgPts;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['Bob', 'Alice']);
    expect(chartData.values).toEqual([40, 10]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05e-avgpts-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    chartData = await page.evaluate(() => {
      const chart = window.App.charts.avgPts;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });
    expect(chartData.labels).toEqual(['Bob', 'Alice']);
    expect(chartData.values[0]).toBeCloseTo(23.3, 1);
    expect(chartData.values[1]).toBe(20.0);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05e-avgpts-filtro-desactivado.png', fullPage: true });
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
      const chart = window.App.charts.avgPts;
      return { labels: chart.data.labels, values: chart.data.datasets[0].data };
    });

    expect(chartData.labels).toEqual([]);
    expect(chartData.values).toEqual([]);
  });
});
