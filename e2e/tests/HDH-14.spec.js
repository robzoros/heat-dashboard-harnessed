import { test, expect } from '@playwright/test';

// HDH-14 - Desempate en la clasificacion de campeonatos:
// en caso de empate en puntos, va por delante el jugador que quedo mejor
// en la carrera mas reciente del campeonato.
test.describe('HDH-14 - Desempate por carrera mas reciente en campeonato', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('hdh-championships'));
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(() => window.App.loadChampionships());
    await page.locator('#tabs .tab-btn').nth(4).click();
    await page.waitForTimeout(200);
  });

  // Crea un campeonato y lo rellena con carreras personalizadas.
  async function createChampWithPlays(page, plays, name = 'Desempate Test') {
    const champData = await page.evaluate(
      ({ name, participants }) => window.App.createChampionship(name, '', participants, 'local').then(r => r.data),
      { name, participants: ['1', '2', '3', '4'] }
    );

    await page.evaluate(async ({ id, plays }) => {
      await App.loadChampionships();
      await App.selectChampionship(id);
      const champ = App.championships.selected;
      champ.plays = plays;
      App.renderChampionshipDetail();
    }, { id: champData.id, plays });

    await expect(page.locator('.standings-table')).toBeVisible();
  }

  // Carrera con el mismo formato que los datos de mock.
  function race(id, playDate, board, scores) {
    return {
      id, playDate, board, locationRefId: 1,
      playerScores: scores.map(([playerRefId, scoreNum, winner]) => ({
        playerRefId, score: String(scoreNum), scoreNum, winner: !!winner
      }))
    };
  }

  // Nombres de jugador en el orden en que aparecen en la clasificacion.
  async function standingsOrder(page) {
    return page.locator('.standings-table tbody tr td:nth-child(2)').evaluateAll(
      tds => tds.map(td => td.textContent.trim())
    );
  }

  test('en empate, va por delante quien quedo mejor en la carrera mas reciente', async ({ page }) => {
    // Player1: 20 + 30 = 50 | Player2: 30 + 20 = 50 -> empate.
    // Carrera mas reciente (2024-02-20): Player1 gana -> Player1 primero.
    await createChampWithPlays(page, [
      race(1, '2024-01-15', 'Circuit A', [[1, 20, false], [2, 30, true]]),
      race(2, '2024-02-20', 'Circuit B', [[1, 30, true], [2, 20, false]])
    ]);

    expect(await standingsOrder(page)).toEqual(['Player1', 'Player2']);

    await page.screenshot({ path: '../evidence/screenshots/HDH-14-desempate-ultima-carrera.png', fullPage: true });
  });

  test('el desempate depende de la ultima carrera, no del orden alfabetico', async ({ page }) => {
    // Mismo empate 50-50, pero Player2 gana la carrera mas reciente.
    await createChampWithPlays(page, [
      race(1, '2024-01-15', 'Circuit A', [[1, 30, true], [2, 20, false]]),
      race(2, '2024-02-20', 'Circuit B', [[1, 20, false], [2, 30, true]])
    ]);

    expect(await standingsOrder(page)).toEqual(['Player2', 'Player1']);
  });

  test('sin empate, los puntos totales mandan aunque se gane la ultima carrera', async ({ page }) => {
    // Player1 gana la ultima carrera, pero Player2 va por delante por puntos (60 vs 40).
    await createChampWithPlays(page, [
      race(1, '2024-01-15', 'Circuit A', [[1, 10, false], [2, 40, true]]),
      race(2, '2024-02-20', 'Circuit B', [[1, 30, true], [2, 20, false]])
    ]);

    expect(await standingsOrder(page)).toEqual(['Player2', 'Player1']);
  });

  test('empate tambien en la ultima carrera: orden deterministico por victorias y nombre', async ({ page }) => {
    // Totales 75-75, misma posicion (25-25) en la ultima carrera y 1 victoria cada uno.
    await createChampWithPlays(page, [
      race(1, '2024-01-15', 'Circuit A', [[1, 30, true], [2, 20, false]]),
      race(2, '2024-02-20', 'Circuit B', [[1, 20, false], [2, 30, true]]),
      race(3, '2024-03-10', 'Circuit A', [[1, 25, false], [2, 25, false]])
    ]);

    expect(await standingsOrder(page)).toEqual(['Player1', 'Player2']);
  });
});
