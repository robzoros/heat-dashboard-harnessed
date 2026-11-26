import { test, expect } from '@playwright/test';

// FIX-HDH-09 - Migración guiada de participantes legacy por matching de partidas.
// Las partidas guardadas en el campeonato legacy se casan contra el histórico
// global por (circuito, fecha) verificando el alineamiento posicional de puntajes;
// el informe exige confirmación antes de convertir el campeonato a v2.
// En los tests confirm/alert se stubbean porque el diálogo nativo bloquea el
// renderer y aísla el evento del runner; el contenido del informe se captura igual.
test.describe('FIX-HDH-09 - Migración legacy por matching de partidas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.removeItem('hdh-championships'));
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => {
      window.App.loadMockData();
      window.__dialogs = [];
      window.confirm = (msg) => { window.__dialogs.push({ kind: 'confirm', text: String(msg) }); return window.__confirmResult !== undefined ? window.__confirmResult : true; };
      window.alert = (msg) => { window.__dialogs.push({ kind: 'alert', text: String(msg) }); };
      window.App.loadChampionships();
    });
    await page.locator('#tabs .tab-btn').nth(4).click();
    await page.waitForTimeout(200);
  });

  async function seedLegacy(page, champ) {
    await page.evaluate(c => { localStorage.setItem('hdh-championships', JSON.stringify([c])); }, champ);
    await page.evaluate(async () => { await App.loadChampionships(); });
    await page.click('.champ-card[data-champ-id="' + champ.id + '"]');
    await page.waitForTimeout(200);
  }

  test('resuelve legacy por matching, muestra el informe y al confirmar convierte a v2', async ({ page }) => {
    await seedLegacy(page, {
      id: 'lg1', name: 'Liga Legacy', description: '', createdAt: '2024-01-01T00:00:00.000Z',
      owner: 'local', participants: ['1', '2', '4'],
      plays: [
        { id: 'a', playDate: '2024-01-15', board: 'Circuit A', locationRefId: 1, playerScores: [
          { playerRefId: 1, score: '25', scoreNum: 25, winner: true },
          { playerRefId: 2, score: '20', scoreNum: 20, winner: false },
          { playerRefId: 4, score: '18', scoreNum: 18, winner: false }] },
        { id: 'b', playDate: '2024-03-10', board: 'Circuit A', locationRefId: 1, playerScores: [
          { playerRefId: 1, score: '28', scoreNum: 28, winner: true },
          { playerRefId: 2, score: '24', scoreNum: 24, winner: false }] }
      ]
    });

    // Click programático: el handler re-renderiza el detalle tras aplicar y la
    // actionability de page.click sobre un botón que se destruye a sí mismo queda
    // pendiente indeterminadamente en este runner.
    await page.evaluate(() => document.querySelector('#btn-migrate-legacy').click());
    await page.waitForTimeout(400);

    const report = await page.evaluate(() => window.__dialogs.find(d => d.kind === 'confirm'));
    expect(report).toBeTruthy();
    expect(report.text).toContain('2/2 partidas casadas');
    expect(report.text).toContain('#1 → Player1');
    expect(report.text).toContain('#2 → Player2');
    expect(report.text).toContain('#4 → Bot1 [Bot]');

    // Convertido a v2: participantes por identidad, snapshot y carreras canonicalizadas.
    const converted = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('hdh-championships')).find(c => c.id === 'lg1')
    );
    expect(converted.schemaVersion).toBe(2);
    expect(converted.participants.sort()).toEqual(['local-bot1', 'local-player1', 'local-player2']);
    expect(converted.participantRefs['local-player1'].name).toBe('Player1');
    expect(converted.participantRefs['local-player1'].color).toBeTruthy();
    expect(converted.plays[0].playerScores[0].playerRefId).toBe('local-player1');

    // La clasificación muestra a los jugadores identificados.
    await expect(page.locator('.standings-table')).toBeVisible();
    const firstRow = await page.locator('.standings-table tbody tr td:nth-child(2)').first().textContent();
    expect(firstRow.trim()).toBe('Player1');

    // Ya no es legacy: sin aviso ni botón de migración.
    await expect(page.locator('.warn-inline').filter({ hasText: 'sin identidad estable' })).toHaveCount(0);
    await expect(page.locator('#btn-migrate-legacy')).toHaveCount(0);

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-09-migrado.png', fullPage: true });
  });

  test('rechazar el informe no convierte el campeonato', async ({ page }) => {
    await page.evaluate(() => { window.__confirmResult = false; });
    await seedLegacy(page, {
      id: 'lg2', name: 'Liga Rechazo', description: '', createdAt: '2024-01-01T00:00:00.000Z',
      owner: 'local', participants: ['1', '2', '3'],
      // Copia idéntica de la partida mock id 2 (3 jugadores; el resolver exige
      // alineamiento posicional exacto).
      plays: [
        { id: 'a', playDate: '2024-02-20', board: 'Circuit B', locationRefId: 1, playerScores: [
          { playerRefId: 2, score: '30', scoreNum: 30, winner: true },
          { playerRefId: 1, score: '22', scoreNum: 22, winner: false },
          { playerRefId: 3, score: '19', scoreNum: 19, winner: false }] }
      ]
    });

    await page.evaluate(() => document.querySelector('#btn-migrate-legacy').click());
    await page.waitForTimeout(400);

    expect(await page.evaluate(() => window.__dialogs.find(d => d.kind === 'confirm'))).toBeTruthy();
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hdh-championships')).find(c => c.id === 'lg2'));
    expect(stored.schemaVersion).toBeUndefined(); // sigue legacy
    await expect(page.locator('#btn-migrate-legacy')).toBeVisible();
  });

  test('una partida sin match marca la resolución como inválida y no aplica nada', async ({ page }) => {
    await seedLegacy(page, {
      id: 'lg3', name: 'Liga Sin Match', description: '', createdAt: '2024-01-01T00:00:00.000Z',
      owner: 'local', participants: ['1'],
      plays: [
        { id: 'ghost', playDate: '2030-01-01', board: 'Circuit X', locationRefId: 1,
          playerScores: [{ playerRefId: '1', score: '9', scoreNum: 9, winner: true }] }
      ]
    });

    await page.evaluate(() => document.querySelector('#btn-migrate-legacy').click());
    await page.waitForTimeout(400);

    const alertMsg = await page.evaluate(() => (window.__dialogs.find(d => d.kind === 'alert') || {}).text || '');
    expect(alertMsg).toContain('No se pudo resolver automáticamente');
    expect(alertMsg).toContain('Circuit X');

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hdh-championships')).find(c => c.id === 'lg3'));
    expect(stored.schemaVersion).toBeUndefined();

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-09-sin-match.png', fullPage: true });
  });
});
