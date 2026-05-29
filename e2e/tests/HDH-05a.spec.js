import { test, expect } from '@playwright/test';

test.describe('HDH-05a - Resumen KPIs', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar KPIs con mock data por defecto', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());

    // Leader: Player1 has 2 wins, Player2 has 1 win
    await expect(page.locator('#kpi-leader')).toHaveText('Player1');

    // Track: Circuit A = 2, Circuit B = 2 → tie, alphabetically Circuit A wins
    const trackText = await page.locator('#kpi-track').textContent();
    expect(trackText).toContain('Circuit A');

    // Streak: both have max streak 1, first encountered wins
    const streakText = await page.locator('#kpi-streak').textContent();
    expect(streakText).toMatch(/Player[12] \(1\)/);

    // Last: most recent is 2024-04-05, winner is Player3
    await expect(page.locator('#kpi-last')).toHaveText('2024-04-05 Player3');
  });

  test('debe mostrar KPIs correctos con datos custom', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false },
        { id: 3, name: 'Charlie', isBot: false, isMain: false, isOther: true }
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
        },
        {
          id: 4, playDate: '2024-01-04', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 5, playDate: '2024-01-05', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
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

    await expect(page.locator('#kpi-leader')).toHaveText('Alice');
    await expect(page.locator('#kpi-track')).toHaveText('🇺🇸 USA');
    await expect(page.locator('#kpi-streak')).toHaveText('Alice (2)');
    await expect(page.locator('#kpi-last')).toHaveText('2024-01-05 Alice');
  });

  test('debe actualizar KPIs al aplicar filtros', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false },
        { id: 3, name: 'Charlie', isBot: false, isMain: false, isOther: true }
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
        },
        {
          id: 4, playDate: '2024-01-04', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
          ]
        },
        {
          id: 5, playDate: '2024-01-05', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '10', scoreNum: 10, winner: true },
            { playerRefId: 2, score: '8', scoreNum: 8, winner: false }
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

    // Verify initial KPIs
    await expect(page.locator('#kpi-leader')).toHaveText('Alice');
    await expect(page.locator('#kpi-track')).toHaveText('🇺🇸 USA');
    await expect(page.locator('#kpi-streak')).toHaveText('Alice (2)');
    await expect(page.locator('#kpi-last')).toHaveText('2024-01-05 Alice');

    // Apply filter: Italy only
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    // With Italy filter: only play 3, Bob wins
    await expect(page.locator('#kpi-leader')).toHaveText('Bob');
    await expect(page.locator('#kpi-track')).toHaveText('🇮🇹 Italy');
    await expect(page.locator('#kpi-streak')).toHaveText('Bob (1)');
    await expect(page.locator('#kpi-last')).toHaveText('2024-01-03 Bob');

    // Clear filter by unchecking Italy
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    // Back to initial values
    await expect(page.locator('#kpi-leader')).toHaveText('Alice');
    await expect(page.locator('#kpi-track')).toHaveText('🇺🇸 USA');
    await expect(page.locator('#kpi-streak')).toHaveText('Alice (2)');
    await expect(page.locator('#kpi-last')).toHaveText('2024-01-05 Alice');
  });

  test('debe mostrar guiones cuando no hay partidas filtradas', async ({ page }) => {
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

    await expect(page.locator('#kpi-leader')).toHaveText('-');
    await expect(page.locator('#kpi-track')).toHaveText('-');
    await expect(page.locator('#kpi-streak')).toHaveText('-');
    await expect(page.locator('#kpi-last')).toHaveText('-');
  });
});
