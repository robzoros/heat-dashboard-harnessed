import { test, expect } from '@playwright/test';

// FIX-HDH-08 - Identidad estable de participantes en Campeonatos.
// Diseño v2 tras la corrección del usuario: los participantes se identifican por
// userid de BGG (estable entre exportaciones) o por clave sintética persistente
// para bots y jugadores sin cuenta BGG; el color y el tipo se congelan en un
// snapshot por campeonato. Los campeonatos legacy (1961/1962/Boadilla) quedan
// congelados tal cual: su migración será guiada y va en otra feature.
test.describe('FIX-HDH-08 - Identidad estable de participantes', () => {
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

  function race(id, playDate, board, scores) {
    return {
      id, playDate, board, locationRefId: 1,
      playerScores: scores.map(([playerRefId, scoreNum, winner]) => ({
        playerRefId, score: String(scoreNum), scoreNum, winner: !!winner
      }))
    };
  }

  async function standingsOrder(page) {
    return page.locator('.standings-table tbody tr td:nth-child(2)').evaluateAll(
      tds => tds.map(td => td.textContent.trim())
    );
  }

  test('un campeonato nuevo guarda participantes por identidad con snapshot de color', async ({ page }) => {
    const result = await page.evaluate(() => {
      const meta = {};
      for (const name of ['Player1', 'Player2']) {
        const p = App.data.players.find(q => q.name === name);
        const key = App.identityKey(p);
        meta[key] = App.participantMeta(p);
      }
      return App.createChampionship('Nuevo Test', 'desc', Object.keys(meta), 'local', meta).then(r => r.data);
    });
    // Identidades: los jugadores del mock no tienen userid de BGG → clave sintética
    // estable basada en el nombre.
    expect(result.schemaVersion).toBe(2);
    expect(result.participants.sort()).toEqual(['local-player1', 'local-player2']);
    expect(result.participantRefs['local-player1'].name).toBe('Player1');
    expect(result.participantRefs['local-player1'].color).toBeTruthy();

    // La clasificación del detalle muestra los nombres del snapshot con su color
    // congelado (aunque la paleta actual cambiara, el color punto sale del snapshot).
    await page.evaluate(async id => {
      await App.loadChampionships();
      await App.selectChampionship(id);
      // Sin partidas la clasificación está vacía; importamos una partida del mock.
      await App.addPlaysToChampionship(id, ['1']);
    }, result.id);
    await page.waitForTimeout(250);
    const dotStyle = await page.locator('.standings-table .name-dot').first().evaluate(el => el.style.background);
    expect(dotStyle).toContain('rgb');

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-08-nuevo-formato.png', fullPage: true });
  });

  test('los campeonatos legacy quedan congelados: la carga no reescribe sus ids ni inventa nombres', async ({ page }) => {
    await page.evaluate(() => {
      const race = (id, playDate, board, scores) => ({
        id, playDate, board, locationRefId: 1,
        playerScores: scores.map(([playerRefId, scoreNum, winner]) => ({
          playerRefId, score: String(scoreNum), scoreNum, winner: !!winner
        }))
      });
      localStorage.setItem('hdh-championships', JSON.stringify([{
        id: 'legacy_1961',
        name: '1961 Daganzo',
        description: '',
        createdAt: '2024-01-01T00:00:00.000Z',
        owner: 'local',
        participants: ['1', '2', '3'],
        playIds: [10],
        plays: [race(10, '2024-01-15', 'Circuit A', [[1, 25, true], [2, 20, false], [3, 10, false]])]
      }]));
    });
    await page.evaluate(async () => { await App.loadChampionships(); });

    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('hdh-championships'))[0]);
    // Congelado: formato heredado intacto, ids sin reinterpretar.
    expect(stored.schemaVersion).toBeUndefined();
    expect(stored.participants).toEqual(['1', '2', '3']);
    expect(stored.participantRefs).toBeUndefined();

    // Detalle: aviso de identidad pendiente y nombres como el comportamiento actual.
    await page.click('.champ-card[data-champ-id="legacy_1961"]');
    await page.waitForTimeout(200);
    await expect(page.locator('.warn-inline').filter({ hasText: 'sin identidad estable' })).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-08-legacy-congelado.png', fullPage: true });
  });

  test('la identidad por userid sobrevive a una exportación que reordena los ids', async ({ page }) => {
    // Semana de creación: Player1=1, Player2=2 (con userid de BGG, como el XML real).
    await page.evaluate(() => {
      App.data.players = App.data.players.map(p =>
        p.name === 'Player1' ? { ...p, userid: '111' }
          : p.name === 'Player2' ? { ...p, userid: '222' }
          : p
      );
      const p1 = App.data.players.find(q => q.name === 'Player1');
      const p2 = App.data.players.find(q => q.name === 'Player2');
      const meta = {};
      for (const p of [p1, p2]) {
        const key = App.identityKey(p);
        meta[key] = App.participantMeta(p);
      }
      window.__champId = null;
      App.createChampionship('UserId Test', '', Object.keys(meta), 'local', meta).then(r => r.data)
        .then(async champ => {
          await App.loadChampionships();
          await App.selectChampionship(champ.id);
          // La partida mock 3 solo tiene Player1 y Player2 (ids 1 y 2).
          await App.addPlaysToChampionship(champ.id, ['3']);
          window.__champId = champ.id;
        });
    });
    await page.waitForTimeout(400);

    // Semana siguiente: el exportador asigna otro orden (1=Player2, 2=Player1).
    // Las identificades (userid) no cambian.
    await page.evaluate(() => {
      App.data.players = App.data.players.map(p =>
        p.userid === '111' ? { ...p, id: 2 } : p.userid === '222' ? { ...p, id: 1 } : p
      );
    });

    // La clasificación sigue mostrando a los jugadores reales con sus totales.
    await page.evaluate(async () => {
      await App.loadChampionships();
      await App.selectChampionship(window.__champId);
    });
    await page.waitForTimeout(250);

    // Partida importada original (mock id 3): Player1 28 (ganador), Player2 24.
    expect(await standingsOrder(page)).toEqual(['Player1', 'Player2']);
    const totals = await page.locator('.standings-table tbody tr td.total-col').evaluateAll(
      tds => tds.map(td => td.textContent.trim())
    );
    expect(totals).toEqual(['28', '24']);

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-08-userid-estable.png', fullPage: true });
  });

  test('el color del participante sale del snapshot congelado, no de la paleta actual', async ({ page }) => {
    await page.evaluate(() => {
      const race = (id, playDate, board, scores) => ({
        id, playDate, board, locationRefId: 1,
        playerScores: scores.map(([playerRefId, scoreNum, winner]) => ({
          playerRefId, score: String(scoreNum), scoreNum, winner: !!winner
        }))
      });
      // Campeonato v2 con un color garabado distinto a lo que daría la config actual.
      localStorage.setItem('hdh-championships', JSON.stringify([{
        id: 'v2_frozen',
        name: 'Color Congelado',
        description: '',
        createdAt: '2024-06-01T00:00:00.000Z',
        owner: 'local',
        schemaVersion: 2,
        participants: ['local-player1'],
        participantRefs: {
          'local-player1': { name: 'Player1', isMain: true, isBot: false, isOther: false, color: '#123456', verified: true }
        },
        playIds: [10],
        plays: [race(10, '2024-06-15', 'Circuit A', [['local-player1', 25, true]])]
      }]));
    });
    await page.evaluate(async () => { await App.loadChampionships(); });
    await page.click('.champ-card[data-champ-id="v2_frozen"]');
    await page.waitForTimeout(250);

    const dotColor = await page.locator('.standings-table .name-dot').first().evaluate(
      el => getComputedStyle(el).backgroundColor
    );
    // #123456 → rgb(18, 52, 86)
    expect(dotColor).toBe('rgb(18, 52, 86)');

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-08-color-congelado.png', fullPage: true });
  });

  test('las identidades de un campeonato persisten entre recargas de la sesión', async ({ page }) => {
    const champId = await page.evaluate(async () => {
      const meta = {};
      for (const name of ['Player1', 'Bot1']) {
        const p = App.data.players.find(q => q.name === name);
        const key = App.identityKey(p);
        meta[key] = App.participantMeta(p);
      }
      const r = await App.createChampionship('Persistencia Test', '', Object.keys(meta), 'local', meta);
      return r.data.id;
    });
    // Recarga completa de la página: nueva "sesión".
    await page.reload();
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(() => window.App.loadChampionships());
    await page.locator('#tabs .tab-btn').nth(4).click();
    await page.evaluate(async () => { await App.loadChampionships(); });

    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('hdh-championships')).find(c => c.participants && c.participants.length === 2 && c.schemaVersion === 2)
    );
    expect(stored.id).toBe(champId);
    expect(stored.participants.sort()).toEqual(['local-bot1', 'local-player1']);
    expect(stored.participantRefs['local-player1'].color).toBeTruthy();
    expect(stored.participantRefs['local-bot1'].isBot).toBe(true);

    await page.screenshot({ path: '../evidence/screenshots/FIX-HDH-08-persistencia.png', fullPage: true });
  });
});
