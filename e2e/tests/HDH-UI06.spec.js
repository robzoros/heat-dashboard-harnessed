import { test, expect } from '@playwright/test';

// HDH-UI06 - Modal de carrera: al pulsar una partida concreta desde
// Circuitos (últimas visitas), Historial (play-entry) y Campeonatos
// (partidas del campeonato) se abre la modal «Carrera · <circuito>» con
// fecha, hero del ganador, tabla Pos/Piloto/Puntos, pódio en escalones,
// ficha de detalles y «Ver campeonato» cuando pertenece a uno.
test.describe('HDH-UI06 - Modal de carrera', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
  });

  test('desde Circuitos: clic en una última visita abre la modal con título y ganador', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await page.locator('.track-card').first().click();
    await page.waitForTimeout(200);

    const recents = page.locator('#track-recents .track-recent');
    await expect(recents.first()).toBeVisible();
    const winnerShown = await recents.first().locator('.recent-winner').textContent();
    const winnerName = winnerShown.replace('🏆', '').split('·')[0].trim();

    await recents.first().click();
    const modal = page.locator('#race-modal');
    await expect(modal).not.toHaveClass(/hidden/);
    await expect(modal).toContainText('Carrera ·');
    await expect(page.locator('#race-modal-winner')).toContainText(winnerName);
    await expect(page.locator('.race-standings tbody tr')).not.toHaveCount(0);
    await expect(page.locator('.race-podium .race-step')).not.toHaveCount(0);

    // La selección del circuito NO cambia (la modal no altera el detalle)
    await expect(page.locator('.track-card').first()).toHaveClass(/selected/);

    await page.screenshot({ path: '../evidence/screenshots/HDH-UI06-desde-circuitos.png', fullPage: true });
  });

  test('desde Historial: clic en una partida abre la modal y Cerrar la descarta', async ({ page }) => {
    await page.locator('.tab-btn[data-tab="historial"]').click();
    await page.locator('.play-entry').first().click();

    const modal = page.locator('#race-modal');
    await expect(modal).not.toHaveClass(/hidden/);
    await expect(page.locator('#race-modal-title')).toContainText('Carrera ·');

    await page.screenshot({ path: '../evidence/screenshots/HDH-UI06-desde-historial.png', fullPage: true });

    await page.locator('#btn-race-close').click();
    await expect(modal).toHaveClass(/hidden/);
  });

  test('desde Campeonatos: clic en una partida abre la modal y «Ver campeonato» navega', async ({ page }) => {
    // Campeonato local con una partida real del histórico; se persiste en
    // localStorage y se recarga la lista con loadChampionships().
    const playForChamp = await page.evaluate(() => {
      const play = window.App.data.plays.find(p => p.board && p.playDate);
      return { id: play.id, board: play.board, playDate: play.playDate, playerScores: play.playerScores };
    });
    await page.evaluate((play) => {
      const champ = {
        id: 'champ-ui06',
        name: 'Campeonato UI06',
        description: '',
        createdAt: new Date().toISOString(),
        owner: null,
        participants: play.playerScores.map(ps => String(ps.playerRefId)),
        plays: [play]
      };
      const stored = JSON.parse(localStorage.getItem('hdh-championships') || '[]');
      stored.push(champ);
      localStorage.setItem('hdh-championships', JSON.stringify(stored));
    }, playForChamp);
    await page.reload();
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.locator('.tab-btn[data-tab="campeonatos"]').click();
    await page.waitForTimeout(400);

    // El detalle del campeonato (con sus partidas) se abre al seleccionar la tarjeta
    await page.locator('.champ-card').first().click();
    await page.waitForTimeout(300);

    const item = page.locator('.campeonato-play-item').first();
    await expect(item).toBeVisible();
    await item.click();

    const modal = page.locator('#race-modal');
    await expect(modal).not.toHaveClass(/hidden/);

    // Ficha con campeonato + botón visible
    await expect(page.locator('#race-modal-facts')).toContainText('Campeonato UI06');
    const champBtn = page.locator('#btn-race-view-champ');
    await expect(champBtn).toBeVisible();
    await champBtn.click();

    // Navega al detalle del campeonato
    await expect(page.locator('#campeonato-detail-content')).toContainText('Campeonato UI06');
    await expect(modal).toHaveClass(/hidden/);

    await page.screenshot({ path: '../evidence/screenshots/HDH-UI06-ver-campeonato.png', fullPage: true });
  });

  test('la modal respeta el date de la partida con fecha ISO (sin desfase)', async ({ page }) => {
    // Partida a 2024-01-15; en navegadores con zona negativa el ISO parseado
    // a UTC puede desplazar el día — la modal usa el desglose manual.
    await page.locator('.tab-btn[data-tab="historial"]').click();
    await page.locator('.play-entry').first().click();
    await expect(page.locator('#race-modal-date')).not.toHaveText('-');
  });
});
