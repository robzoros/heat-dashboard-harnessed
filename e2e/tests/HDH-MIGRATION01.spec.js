import { test, expect } from '@playwright/test';

 test.describe('HDH-MIGRATION01 - GitHub Pages estático', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
  });

  test('carga el JSON estático y no exige login BGG', async ({ page }) => {
    await expect.poll(() => page.evaluate(() => window.App.data.plays.length)).toBeGreaterThan(0);
    await expect(page.locator('#data-status')).toContainText('Actualizado');
    await expect(page.locator('#login-modal')).toHaveCount(0);
    await expect(page.locator('#stat-plays-total')).not.toHaveText('0');
  });

  test('el botón actualiza el JSON local sin llamar al proxy', async ({ page }) => {
    const requests = [];
    page.on('request', request => {
      if (request.url().includes('/bgg-api/')) requests.push(request.url());
    });
    await page.locator('#btn-load-data').click();
    await expect.poll(() => page.evaluate(() => window.App.data.plays.length)).toBeGreaterThan(0);
    expect(requests).toEqual([]);
  });

  test('los campeonato se guardan en localStorage', async ({ page }) => {
    await page.evaluate(async () => {
      localStorage.removeItem('hdh-championships');
      await window.App.createChampionship('Estático', 'Local', ['1'], 'local');
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect.poll(() => page.evaluate(() => window.App.championships.list.length)).toBe(1);
    await expect(page.locator('#campeonatos-select option')).toHaveCount(2);
    await page.screenshot({ path: '../evidence/screenshots/HDH-MIGRATION01-pagina-estatica.png', fullPage: true });
  });
});
