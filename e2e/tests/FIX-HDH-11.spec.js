import { test, expect } from '@playwright/test';

// FIX-HDH-11 - Alias de nombre en el exportador BGG.
// El usuario renombra al jugador en BG Stats, pero las partidas ya enviadas a BGG
// conservan el nombre antiguo en el XML; el exportador canonifica 'Alfonso Daganzo'
// a 'Alfonso' con una tabla de alias, de modo que existe UNA sola entrada de
// jugador y todas sus partidas (antiguas y nuevas) apuntan a ella.
// La identidad no cambia: bgg:<userid> (userid 1428263 en los datos reales).
// Nota: usa los datos reales de src/data/heat-data.json (regenerados con alias).

test.describe('FIX-HDH-11 - Alias de nombre de jugador en el exportador', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('hay una sola entrada para Alfonso y ninguna con el nombre antiguo', async ({ page }) => {
    const info = await page.evaluate(() => {
      const plays = App.data.plays || [];
      const alfonso = App.data.players.filter(p => String(p.userid) === '1428263');
      const refId = alfonso.length === 1 ? String(alfonso[0].id) : null;
      return {
        con1428263: alfonso.map(p => p.name),
        entradaUnica: alfonso.length,
        nombreExacto: alfonso.length === 1 ? alfonso[0].name : null,
        conDaganzo: App.data.players.filter(p => /daganzo/i.test(p.name)).map(p => p.name),
        playsRef: refId ? plays.filter(pl => (pl.playerScores || []).some(ps => String(ps.playerRefId) === refId)).length : 0
      };
    });
    expect(info.entradaUnica, 'una única entrada de jugador con userid 1428263').toBe(1);
    expect(info.nombreExacto).toBe('Alfonso');
    expect(info.conDaganzo, 'ninguna entrada conserva el nombre antiguo').toEqual([]);
    expect(info.playsRef, 'todas las partidas del jugador apuntan a la entrada única').toBeGreaterThan(0);
  });

  test('la pestaña Jugadores muestra "Alfonso" y en la página no queda "Daganzo"', async ({ page }) => {
    await page.locator('#tabs .tab-btn').nth(1).click();
    await page.waitForTimeout(300);

    const table = page.locator('#players-table');
    await expect(table).toBeVisible();
    await expect(table).toContainText('Alfonso');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Alfonso Daganzo');

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-11-jugadores-alfonso.png', fullPage: true });
  });

  test('el podio de Resumen muestra el alias, no el nombre antiguo', async ({ page }) => {
    // Con los filtros por defecto, el podio de la pestaña Resumen usa nombres de
    // la tabla de players; el nombre canonizado debe ser el visible.
    const names = await page.evaluate(() => {
      return App.data.players.filter(p => p.isMain).map(p => p.name);
    });
    expect(names).toContain('Alfonso');
    expect(names.filter(n => /daganzo/i.test(n))).toEqual([]);

    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toContain('Alfonso Daganzo');
    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-11-resumen-sin-daganzo.png', fullPage: true });
  });
});
