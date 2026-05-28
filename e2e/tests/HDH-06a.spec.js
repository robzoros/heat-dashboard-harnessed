import { test, expect } from '@playwright/test';

test.describe('HDH-06a - Pestaña Jugadores', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar tabla de jugadores con mock data', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    await page.locator('.tab-btn[data-tab="jugadores"]').click();
    await expect(page.locator('#tab-jugadores')).toBeVisible();

    const rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(2);

    const firstRow = rows.first();
    await expect(firstRow.locator('td').nth(1)).toHaveText('Player1');

    await page.screenshot({ path: '../evidence/screenshots/HDH-06a-jugadores-mock.png', fullPage: true });
  });

  test('debe mostrar estadisticas correctas con datos custom', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false },
        { id: 3, name: 'Charlie', isBot: false, isMain: false, isOther: true },
        { id: 4, name: 'Bot1', isBot: true, isMain: false, isOther: false }
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
        },
        {
          id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '25', scoreNum: 25, winner: true },
            { playerRefId: 2, score: '15', scoreNum: 15, winner: false }
          ]
        },
        {
          id: 3, playDate: '2024-01-03', board: 'USA', locationRefId: 1,
          playerScores: [
            { playerRefId: 1, score: '20', scoreNum: 20, winner: false },
            { playerRefId: 2, score: '30', scoreNum: 30, winner: true }
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

    await page.locator('.tab-btn[data-tab="jugadores"]').click();

    const rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(2);

    // Alice: 3 plays, 2 wins, 67%, avg 25.0, max 30
    const aliceRow = rows.first();
    await expect(aliceRow.locator('td').nth(1)).toHaveText('Alice');
    await expect(aliceRow.locator('td').nth(2)).toHaveText('3');
    await expect(aliceRow.locator('td').nth(3)).toHaveText('2');
    await expect(aliceRow.locator('.win-pct-text')).toHaveText('67%');
    await expect(aliceRow.locator('td').nth(5)).toHaveText('25');
    await expect(aliceRow.locator('td').nth(6)).toHaveText('30');

    // Alice last 10: loss, win, win (most recent first)
    const aliceDots = aliceRow.locator('.dot');
    await expect(aliceDots).toHaveCount(3);
    await expect(aliceDots.nth(0)).toHaveClass(/dot-loss/);
    await expect(aliceDots.nth(1)).toHaveClass(/dot-win/);
    await expect(aliceDots.nth(2)).toHaveClass(/dot-win/);

    await page.screenshot({ path: '../evidence/screenshots/HDH-06a-jugadores-custom.png', fullPage: true });
  });

  test('debe actualizar tabla al aplicar filtros', async ({ page }) => {
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

    await page.locator('.tab-btn[data-tab="jugadores"]').click();

    // Initial: Alice 2 wins, Bob 1 win
    let rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('td').nth(1)).toHaveText('Alice');
    await expect(rows.first().locator('td').nth(3)).toHaveText('2');

    // Filter Italy only: Alice 1 win, Bob 0 wins (but both have plays)
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(2);
    await expect(rows.first().locator('td').nth(1)).toHaveText('Alice');
    await expect(rows.first().locator('td').nth(3)).toHaveText('1');
    await expect(rows.last().locator('td').nth(1)).toHaveText('Bob');
    await expect(rows.last().locator('td').nth(3)).toHaveText('0');

    await page.screenshot({ path: '../evidence/screenshots/HDH-06a-jugadores-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(2);

    await page.screenshot({ path: '../evidence/screenshots/HDH-06a-jugadores-filtro-desactivado.png', fullPage: true });
  });

  test('debe excluir bots y otros jugadores', async ({ page }) => {
    const customData = {
      players: [
        { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
        { id: 2, name: 'Bot1', isBot: true, isMain: false, isOther: false },
        { id: 3, name: 'Other1', isBot: false, isMain: false, isOther: true }
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

    await page.locator('.tab-btn[data-tab="jugadores"]').click();

    const rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(1);
    await expect(rows.first().locator('td').nth(1)).toHaveText('Alice');
  });

  test('debe mostrar tabla vacia cuando no hay partidas', async ({ page }) => {
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

    await page.locator('.tab-btn[data-tab="jugadores"]').click();

    const rows = page.locator('#players-table tbody tr');
    await expect(rows).toHaveCount(0);
  });
});
