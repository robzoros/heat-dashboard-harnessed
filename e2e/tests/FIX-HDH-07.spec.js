import { test, expect } from '@playwright/test';

// FIX-HDH-07 - Al importar partidas en un campeonato, los jugadores que aun no son
// participantes ya no bloquean la importacion en silencio: el modal pide consentimiento
// explicito para añadirlos como participantes, y la lista de participantes solo cambia
// cuando el propietario lo acepta.
test.describe('FIX-HDH-07 - Consentimiento para añadir participantes al importar partidas', () => {
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

  async function createChamp(page, name, participants) {
    return page.evaluate(({ name, participants }) =>
      window.App.createChampionship(name, '', participants, 'local').then(r => r.data),
      { name, participants }
    );
  }

  async function addPlaysViaAPI(page, champId, playIds) {
    await page.evaluate(async ({ id, playIds }) => {
      await window.App.addPlaysToChampionship(id, playIds);
    }, { id: champId, playIds });
  }

  async function selectChamp(page, champId) {
    await page.evaluate(async (id) => {
      await App.loadChampionships();
      await App.selectChampionship(id);
    }, champId);
    await page.waitForFunction((id) =>
      App.championships.selected && App.championships.selected.id === id,
      champId, { timeout: 5000 }
    );
  }

  async function getParticipants(page) {
    return page.evaluate(() =>
      [...(App.championships.selected.participants || [])].map(String).sort()
    );
  }

  test('sin consentimiento la importacion se bloquea y los participantes NO cambian', async ({ page }) => {
    // Campeonato con Player1 y Player2; importa la partida 3 (solo jugadores 1 y 2).
    const champ = await createChamp(page, 'Consent Test', ['1', '2']);
    await addPlaysViaAPI(page, champ.id, ['3']);
    await selectChamp(page, champ.id);
    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);

    // Intenta importar la partida 1 (incluye a Bot1, que no es participante).
    let dialogMessage = '';
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    await page.locator('#btn-import-plays-campeonato').click();
    await expect(page.locator('#import-consent-block')).toBeHidden();
    await page.locator('#import-plays-list input[value="1"]').check();
    // El bloque de consentimiento aparece con el nombre del jugador nuevo.
    await expect(page.locator('#import-consent-block')).toBeVisible();
    await expect(page.locator('#import-consent-names')).toHaveText('Bot1');

    // Importar sin marcar la casilla muestra el alert y NO añade nada.
    await page.locator('#btn-import-plays').click();
    await page.waitForTimeout(300);
    expect(dialogMessage).toContain('no son participantes del campeonato');
    expect(dialogMessage).toContain('casilla');

    await expect(page.locator('.campeonato-play-item')).toHaveCount(1);
    expect(await getParticipants(page)).toEqual(['1', '2']);

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-07-sin-consentimiento.png', fullPage: true });
  });

  test('con consentimiento los nuevos jugadores se añaden como participantes', async ({ page }) => {
    const champ = await createChamp(page, 'Consent OK', ['1', '2']);
    await addPlaysViaAPI(page, champ.id, ['3']);
    await selectChamp(page, champ.id);

    page.on('dialog', dialog => dialog.accept());
    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="1"]').check();
    await expect(page.locator('#import-consent-names')).toHaveText('Bot1');

    // Se marca la casilla y la importación se completa.
    await page.locator('#import-consent-checkbox').check();
    await page.locator('#btn-import-plays').click();

    await page.waitForFunction(() =>
      document.querySelectorAll('.campeonato-play-item').length >= 2,
      { timeout: 5000 }
    );
    await expect(page.locator('#import-plays-modal')).toBeHidden();
    await expect(page.locator('.campeonato-play-item')).toHaveCount(2);
    // Bot1 (id 4) pasa a ser participante del campeonato.
    expect(await getParticipants(page)).toEqual(['1', '2', '4']);

    // El detalle refleja el nuevo numero de participantes.
    await expect(page.locator('.campeonato-detail-header')).toContainText('Participantes: 3');

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-07-con-consentimiento.png', fullPage: true });
  });

  test('el bloque de consentimiento se oculta cuando todos los jugadores ya son participantes', async ({ page }) => {
    // Campeonato con los 4 jugadores declarados.
    const champ = await createChamp(page, 'All Participants', ['1', '2', '3', '4']);
    await addPlaysViaAPI(page, champ.id, ['3']);
    await selectChamp(page, champ.id);

    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="1"]').check();
    await page.locator('#import-plays-list input[value="2"]').check();

    // Todos los jugadores de las partidas seleccionadas ya son participantes.
    await expect(page.locator('#import-consent-block')).toBeHidden();

    // La importación directa funciona y la lista de participantes no cambia.
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#btn-import-plays').click();
    await page.waitForFunction(() =>
      document.querySelectorAll('.campeonato-play-item').length >= 3,
      { timeout: 5000 }
    );
    expect(await getParticipants(page)).toEqual(['1', '2', '3', '4']);
  });

  test('sin participantes declarados la importacion sigue libre (comportamiento previo)', async ({ page }) => {
    const champ = await createChamp(page, 'Free Import', []);
    await selectChamp(page, champ.id);

    await page.locator('#btn-import-plays-campeonato').click();
    await page.locator('#import-plays-list input[value="1"]').check();
    // Con participantes vacios no se pide consentimiento.
    await expect(page.locator('#import-consent-block')).toBeHidden();

    page.on('dialog', dialog => dialog.accept());
    await page.locator('#btn-import-plays').click();
    await page.waitForFunction(() =>
      document.querySelectorAll('.campeonato-play-item').length >= 1,
      { timeout: 5000 }
    );
    // addPlaysToChampionship sigue expandiendo participantes a partir de las partidas.
    expect(await getParticipants(page)).toEqual(['1', '2', '4']);
  });
});
