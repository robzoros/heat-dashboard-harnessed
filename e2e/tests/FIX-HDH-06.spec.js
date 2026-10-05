import { test, expect } from '@playwright/test';

// FIX-HDH-06 - Las carreras de un campeonato deben mostrarse de izquierda a derecha
// en orden cronologico (antigua -> reciente) en la tabla de clasificacion.
test.describe('FIX-HDH-06 - Orden cronologico de carreras en campeonato', () => {
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

  // Crea un campeonato con las partidas en un orden NO cronologico y lo selecciona.
  async function createChampWithPlaysInOrder(page, playIds) {
    const champData = await page.evaluate(
      ({ name, participants }) => window.App.createChampionship(name, '', participants, 'local').then(r => r.data),
      { name: 'Crono Test', participants: ['1', '2', '3', '4'] }
    );

    await page.evaluate(async ({ id, ids }) => {
      await App.loadChampionships();
      await App.selectChampionship(id);
      const champ = App.championships.selected;
      const byId = new Map(App.data.plays.map(p => [String(p.id), p]));
      // Orden de almacenamiento deliberadamente no cronologico
      champ.plays = ids.map(pid => byId.get(pid));
      App.renderChampionshipDetail();
    }, { id: champData.id, ids: playIds });

    await expect(page.locator('.standings-table')).toBeVisible();
  }

  async function columnDates(page) {
    return page.locator('.standings-table thead th[data-play-date]').evaluateAll(
      ths => ths.map(th => th.getAttribute('data-play-date'))
    );
  }

  test('columnas de la tabla van de izquierda a derecha en orden cronologico', async ({ page }) => {
    // Almacenadas en orden inverso (reciente -> antigua)
    await createChampWithPlaysInOrder(page, ['4', '2', '3', '1']);

    const dates = await columnDates(page);
    expect(dates).toEqual(['2024-01-15', '2024-02-20', '2024-03-10', '2024-04-05']);

    // La primera columna (izquierda) es la carrera mas antigua
    await expect(page.locator('.standings-table thead th[data-play-date]').first()).toContainText('Circuit A');
    // La ultima columna (derecha) es la carrera mas reciente
    await expect(page.locator('.standings-table thead th[data-play-date]').last()).toContainText('Circuit B');

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-06-carreras-cronologicas.png', fullPage: true });
  });

  test('el orden cronologico se mantiene aunque las partidas se anyadan en desorden', async ({ page }) => {
    await createChampWithPlaysInOrder(page, ['3', '1', '4', '2']);

    const dates = await columnDates(page);
    const sorted = [...dates].sort();
    expect(dates).toEqual(sorted);
    expect(dates).toHaveLength(4);
  });

  test('los puntos de cada columna siguen correspondiendo a su carrera', async ({ page }) => {
    await createChampWithPlaysInOrder(page, ['2', '4', '1', '3']);

    // Player1: 25 (2024-01-15), 22 (2024-02-20), 28 (2024-03-10) y no juega la 2024-04-05
    const player1Scores = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.standings-table tbody tr'));
      const row = rows.find(r => r.children[1].textContent.trim() === 'Player1');
      return Array.from(row.children).slice(2, -1).map(td => td.textContent.trim());
    });
    expect(player1Scores).toEqual(['25', '22', '28', '-']);
  });

  test('la lista de partidas conserva el orden reciente -> antigua y el array no se muta', async ({ page }) => {
    await createChampWithPlaysInOrder(page, ['1', '2', '3', '4']);

    const listDates = await page.locator('.campeonato-play-item span').evaluateAll(
      spans => spans.map(s => s.textContent.trim().split(' | ')[0])
    );
    expect(listDates).toEqual(['2024-04-05', '2024-03-10', '2024-02-20', '2024-01-15']);

    const storedOrder = await page.evaluate(() =>
      App.championships.selected.plays.map(p => p.playDate)
    );
    expect(storedOrder).toEqual(['2024-01-15', '2024-02-20', '2024-03-10', '2024-04-05']);
  });
});
