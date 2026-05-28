import { test, expect } from '@playwright/test';

test.describe('HDH-05b - Panel Podio', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('debe mostrar podio con mock data por defecto', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    const podium = page.locator('#podium');
    // Only 2 main players in mock data (Player1, Player2)
    await expect(podium.locator('.podium-place')).toHaveCount(2);

    // Visual order: #2 | #1
    const places = podium.locator('.podium-place');
    await expect(places.nth(0)).toHaveClass(/second/);
    await expect(places.nth(1)).toHaveClass(/first/);

    // #1 is Player1 (2 wins), #2 is Player2 (1 win)
    await expect(places.nth(0).locator('.podium-name')).toHaveText('Player2');
    await expect(places.nth(1).locator('.podium-name')).toHaveText('Player1');

    // Medals
    await expect(places.nth(0).locator('.podium-medal')).toHaveText('🥈');
    await expect(places.nth(1).locator('.podium-medal')).toHaveText('🥇');

    await page.screenshot({ path: '../evidence/screenshots/HDH-05b-podio-mock-data.png', fullPage: true });
  });

  test('debe mostrar podio correcto con datos custom de 3 jugadores', async ({ page }) => {
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

    const podium = page.locator('#podium');
    await expect(podium.locator('.podium-place')).toHaveCount(3);

    // Order: #2 Bob (1 win) | #1 Alice (2 wins) | #3 Charlie (1 win)
    const places = podium.locator('.podium-place');
    await expect(places.nth(0).locator('.podium-name')).toHaveText('Bob');
    await expect(places.nth(1).locator('.podium-name')).toHaveText('Alice');
    await expect(places.nth(2).locator('.podium-name')).toHaveText('Charlie');

    await page.screenshot({ path: '../evidence/screenshots/HDH-05b-podio-3-players.png', fullPage: true });
  });

  test('debe actualizar podio al aplicar filtros', async ({ page }) => {
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

    // Initial: Alice 2 wins, Bob 1 win → 2 places
    const podium = page.locator('#podium');
    const places = podium.locator('.podium-place');
    await expect(places).toHaveCount(2);
    await expect(places.nth(1).locator('.podium-name')).toHaveText('Alice');
    await expect(places.nth(0).locator('.podium-name')).toHaveText('Bob');

    // Filter Italy only: Bob 1 win, Alice 0 wins → only Bob shows
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#track-filters input[value="Italy"]').check();
    await page.locator('#btn-apply-filters').click();

    // Bob should be the only one (as #1)
    const placesAfter = podium.locator('.podium-place');
    await expect(placesAfter).toHaveCount(1);
    await expect(placesAfter.nth(0).locator('.podium-name')).toHaveText('Bob');
    await expect(placesAfter.nth(0)).toHaveClass(/first/);

    await page.screenshot({ path: '../evidence/screenshots/HDH-05b-podio-filtro-aplicado.png', fullPage: true });

    // Clear filter
    await page.locator('#track-filters input[value="Italy"]').uncheck();
    await page.locator('#btn-apply-filters').click();

    // Back to initial: 2 places
    const placesReset = podium.locator('.podium-place');
    await expect(placesReset).toHaveCount(2);
    await expect(placesReset.nth(1).locator('.podium-name')).toHaveText('Alice');

    await page.screenshot({ path: '../evidence/screenshots/HDH-05b-podio-filtro-desactivado.png', fullPage: true });
  });

  test('debe ocultar podio cuando no hay partidas', async ({ page }) => {
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

    await expect(page.locator('#podium')).toBeEmpty();
  });
});
