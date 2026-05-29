import { test, expect } from '@playwright/test';

test.describe('HDH-07 - Pestaña Historial', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar historial con mock data', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    await page.locator('.tab-btn[data-tab="historial"]').click();
    await expect(page.locator('#tab-historial')).toBeVisible();

    const entries = page.locator('.play-entry');
    await expect(entries).toHaveCount(4);

    await page.screenshot({ path: '../evidence/screenshots/HDH-07-historial-mock.png', fullPage: true });
  });

  test('debe mostrar detalles al pulsar entrada', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false }
      ],
      locations: [{ id: 1, name: 'Home' }],
      boards: [{ id: 1, name: 'USA' }],
      plays: [
        {
          id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
            { playerRefId: 2, score: '20', scoreNum: 20, winner: false }
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

    await page.locator('.tab-btn[data-tab="historial"]').click();

    const entry = page.locator('.play-entry').first();
    const details = page.locator('.play-details').first();

    // Details should be hidden initially
    await expect(details).not.toHaveClass(/expanded/);

    // Click to expand
    await entry.click();
    await expect(details).toHaveClass(/expanded/);

    // Winner should have green border
    await expect(details.locator('.player-winner')).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/HDH-07-historial-detalles.png', fullPage: true });

    // Click again to collapse
    await entry.click();
    await expect(details).not.toHaveClass(/expanded/);
  });

  test('debe mostrar wins evolution chart con mock data', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    await page.locator('.tab-btn[data-tab="historial"]').click();

    const chart = page.locator('#chart-wins-evolution');
    await expect(chart).toBeVisible();

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.winsEvolution;
      return {
        labels: chart.data.labels,
        datasets: chart.data.datasets.map(ds => ({ label: ds.label, data: ds.data }))
      };
    });

    expect(chartData.labels.length).toBeGreaterThan(0);
    expect(chartData.datasets.length).toBeGreaterThan(0);

    await page.screenshot({ path: '../evidence/screenshots/HDH-07-wins-evolution-mock.png', fullPage: true });
  });

  test('debe actualizar historial al aplicar filtros', async ({ page }) => {
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
          id: 2, playDate: '2024-01-02', board: 'Italy', locationRefId: 1,
          playerScores: [
            { playerRefId: 2, score: '25', scoreNum: 25, winner: true },
            { playerRefId: 1, score: '15', scoreNum: 15, winner: false }
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

    await page.locator('.tab-btn[data-tab="historial"]').click();

    // Initial: 2 entries
    let entries = page.locator('.play-entry');
    await expect(entries).toHaveCount(2);

    // Filter Italy only
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    entries = page.locator('.play-entry');
    await expect(entries).toHaveCount(1);

    await page.screenshot({ path: '../evidence/screenshots/HDH-07-historial-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    entries = page.locator('.play-entry');
    await expect(entries).toHaveCount(2);

    await page.screenshot({ path: '../evidence/screenshots/HDH-07-historial-filtro-desactivado.png', fullPage: true });
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

    await page.locator('.tab-btn[data-tab="historial"]').click();

    const entries = page.locator('.play-entry');
    await expect(entries).toHaveCount(0);

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.winsEvolution;
      return { labels: chart.data.labels, datasets: chart.data.datasets };
    });

    expect(chartData.labels).toEqual([]);
    // Datasets may still exist for main players but with empty data
    for (const ds of chartData.datasets) {
      expect(ds.data).toEqual([]);
    }
  });
});
