import { test, expect } from '@playwright/test';

test.describe('HDH-10 - Jugadores no registrados en bgg', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.cookie = 'hdh-player-overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('debe abrir y cerrar el modal de gestión de jugadores', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(() => document.querySelector('.tab-btn[data-tab="jugadores"]').click());

    const btnVisible = await page.evaluate(() => !!document.getElementById('btn-manage-players'));
    expect(btnVisible).toBe(true);

    await page.evaluate(() => document.getElementById('btn-manage-players').click());
    await expect(page.locator('#player-manager-modal')).toBeVisible();
    await expect(page.locator('#player-manager-list .player-manager-row')).toHaveCount(4);

    await page.evaluate(() => document.getElementById('btn-close-player-manager').click());
    await expect(page.locator('#player-manager-modal')).toBeHidden();

    await page.screenshot({ path: '../evidence/screenshots/HDH-10-modal-open.png', fullPage: true });
  });

  test('debe cambiar clasificación de bot a principal', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    const mainPlayersBefore = await page.evaluate(() =>
      window.App.data.players.filter(p => p.isMain).map(p => p.name)
    );
    expect(mainPlayersBefore).not.toContain('Bot1');

    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'main');
    });

    const mainPlayersAfter = await page.evaluate(() =>
      window.App.data.players.filter(p => p.isMain).map(p => p.name)
    );
    expect(mainPlayersAfter).toContain('Bot1');

    const filterPlayers = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#player-filters input')).map(i => i.parentElement.textContent.trim())
    );
    expect(filterPlayers.some(name => name.includes('Bot1'))).toBeTruthy();

    await page.screenshot({ path: '../evidence/screenshots/HDH-10-bot-to-main.png', fullPage: true });
  });

  test('debe guardar clasificación en cookie y persistir al recargar', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'main');
    });

    const cookieValue = await page.evaluate(() => {
      const raw = document.cookie.split('; ').find(c => c.startsWith('hdh-player-overrides='));
      return raw ? decodeURIComponent(raw.split('=').slice(1).join('=')) : null;
    });
    expect(cookieValue).toBeTruthy();
    expect(cookieValue).toContain('"Bot1":"main"');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => window.App.loadMockData());

    const mainPlayersAfterReload = await page.evaluate(() =>
      window.App.data.players.filter(p => p.isMain).map(p => p.name)
    );
    expect(mainPlayersAfterReload).toContain('Bot1');

    await page.screenshot({ path: '../evidence/screenshots/HDH-10-persistence.png', fullPage: true });
  });

  test('debe volver a auto (clasificación BGG) desde cookie', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'main');
    });

    let mainPlayers = await page.evaluate(() =>
      window.App.data.players.filter(p => p.isMain).map(p => p.name)
    );
    expect(mainPlayers).toContain('Bot1');

    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'auto');
    });

    mainPlayers = await page.evaluate(() =>
      window.App.data.players.filter(p => p.isMain).map(p => p.name)
    );
    expect(mainPlayers).not.toContain('Bot1');

    const botPlayers = await page.evaluate(() =>
      window.App.data.players.filter(p => p.isBot).map(p => p.name)
    );
    expect(botPlayers).toContain('Bot1');

    await page.screenshot({ path: '../evidence/screenshots/HDH-10-back-to-auto.png', fullPage: true });
  });

  test('debe actualizar header-stats al cambiar clasificación', async ({ page }) => {
    await page.evaluate(() => window.App.loadMockData());

    let playersFiltered = await page.textContent('#stat-players-filtered');
    expect(parseInt(playersFiltered)).toBeGreaterThanOrEqual(2);

    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'main');
    });

    playersFiltered = await page.textContent('#stat-players-filtered');
    expect(parseInt(playersFiltered)).toBeGreaterThanOrEqual(3);

    await page.screenshot({ path: '../evidence/screenshots/HDH-10-stats-update.png', fullPage: true });
  });
});
