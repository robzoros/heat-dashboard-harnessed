import { test, expect } from '@playwright/test';

test.describe('HDH-11 - Aceptar Cookies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      document.cookie = 'hdh-cookie-consent=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      document.cookie = 'hdh-player-overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    });
    await page.waitForSelector('canvas', { timeout: 10000 });
  });

  test('debe mostrar el banner de cookies en la primera visita', async ({ page }) => {
    await page.waitForSelector('#cookie-consent-banner:not(.hidden)', { timeout: 5000 });
    await expect(page.locator('#cookie-consent-banner')).toBeVisible();
    await expect(page.locator('#btn-accept-cookies')).toBeVisible();
    await expect(page.locator('#btn-reject-cookies')).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/HDH-11-banner-visible.png', fullPage: true });
  });

  test('debe ocultar el banner al aceptar cookies', async ({ page }) => {
    await page.waitForSelector('#cookie-consent-banner:not(.hidden)', { timeout: 5000 });
    await page.click('#btn-accept-cookies');
    await expect(page.locator('#cookie-consent-banner')).toBeHidden();

    const consent = await page.evaluate(() => {
      const raw = document.cookie.split('; ').find(c => c.startsWith('hdh-cookie-consent='));
      return raw ? decodeURIComponent(raw.split('=').slice(1).join('=')) : null;
    });
    expect(consent).toBe('"accepted"');

    await page.screenshot({ path: '../evidence/screenshots/HDH-11-accepted.png', fullPage: true });
  });

  test('debe ocultar el banner al rechazar cookies', async ({ page }) => {
    await page.waitForSelector('#cookie-consent-banner:not(.hidden)', { timeout: 5000 });
    await page.click('#btn-reject-cookies');
    await expect(page.locator('#cookie-consent-banner')).toBeHidden();

    const consent = await page.evaluate(() => {
      const raw = document.cookie.split('; ').find(c => c.startsWith('hdh-cookie-consent='));
      return raw ? decodeURIComponent(raw.split('=').slice(1).join('=')) : null;
    });
    expect(consent).toBe('"rejected"');

    await page.screenshot({ path: '../evidence/screenshots/HDH-11-rejected.png', fullPage: true });
  });

  test('debe persistir la aceptación entre recargas', async ({ page }) => {
    await page.waitForSelector('#cookie-consent-banner:not(.hidden)', { timeout: 5000 });
    await page.click('#btn-accept-cookies');

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#cookie-consent-banner')).toBeHidden();

    await page.screenshot({ path: '../evidence/screenshots/HDH-11-persistence.png', fullPage: true });
  });

  test('no debe guardar overrides si se rechazan las cookies', async ({ page }) => {
    await page.waitForSelector('#cookie-consent-banner:not(.hidden)', { timeout: 5000 });
    await page.click('#btn-reject-cookies');

    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'main');
    });

    const overrides = await page.evaluate(() => {
      const raw = document.cookie.split('; ').find(c => c.startsWith('hdh-player-overrides='));
      return raw ? decodeURIComponent(raw.split('=').slice(1).join('=')) : null;
    });
    expect(overrides).toBeNull();

    await page.screenshot({ path: '../evidence/screenshots/HDH-11-no-overrides.png', fullPage: true });
  });

  test('debe guardar overrides si se aceptan las cookies', async ({ page }) => {
    await page.waitForSelector('#cookie-consent-banner:not(.hidden)', { timeout: 5000 });
    await page.click('#btn-accept-cookies');

    await page.evaluate(() => window.App.loadMockData());
    await page.evaluate(() => {
      window.App.togglePlayerClassification('Bot1', 'main');
    });

    const overrides = await page.evaluate(() => {
      const raw = document.cookie.split('; ').find(c => c.startsWith('hdh-player-overrides='));
      return raw ? decodeURIComponent(raw.split('=').slice(1).join('=')) : null;
    });
    expect(overrides).toBeTruthy();
    expect(overrides).toContain('"Bot1":"main"');

    await page.screenshot({ path: '../evidence/screenshots/HDH-11-overrides-saved.png', fullPage: true });
  });
});
