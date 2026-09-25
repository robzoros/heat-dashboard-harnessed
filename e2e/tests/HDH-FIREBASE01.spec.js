import { test, expect } from '@playwright/test';

test.describe('HDH-FIREBASE01 - Integración Firebase', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/cdn.jsdelivr.net/**', route => route.abort());
        await page.route('**/fonts.googleapis.com/**', route => route.abort());
        await page.route('**/fonts.gstatic.com/**', route => route.abort());
        await page.addInitScript(() => {
            window.Chart = class {
                constructor(element, config) {
                    this.data = config.data;
                }
                update() {}
            };
        });
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => window.App && window.App.data);
        const banner = page.locator('#cookie-consent-banner:not(.hidden)');
        if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
            await page.click('#btn-accept-cookies');
        }
    });

    test('carga la configuración pública del proyecto Firebase', async ({ page }) => {
        const config = await page.evaluate(() => window.FIREBASE_CONFIG);
        expect(config.projectId).toBe('heat-dashboard-511cf');
        expect(config.authDomain).toBe('heat-dashboard-511cf.firebaseapp.com');
        expect(config.appId).toBe('1:250832273701:web:8d5bf4b1845445b62edacc');
    });

    test('muestra el estado de lectura y el acceso de administrador', async ({ page }) => {
        await page.locator('#tabs .tab-btn').nth(4).click();
        await expect(page.locator('#admin-status')).toHaveText('Modo lectura');
        await expect(page.locator('#btn-admin-login')).toBeVisible();
        await page.screenshot({ path: '../evidence/screenshots/HDH-FIREBASE01-acceso-admin.png', fullPage: true });
    });

    test('habilita y deshabilita los controles según el estado del administrador', async ({ page }) => {
        await page.locator('#tabs .tab-btn').nth(4).click();
        await expect(page.locator('#btn-create-campeonato')).toBeDisabled();
        await expect(page.locator('#btn-admin-logout')).toBeDisabled();

        await page.evaluate(() => {
            window.App.bggUsername = 'local';
            window.App.renderAdminStatus();
        });
        await expect(page.locator('#btn-create-campeonato')).toBeEnabled();
        await expect(page.locator('#btn-admin-logout')).toBeEnabled();
        await expect(page.locator('#admin-status')).toHaveText('Administrador conectado');

        await page.evaluate(() => {
            window.App.bggUsername = null;
            window.App.renderAdminStatus();
        });
        await expect(page.locator('#btn-create-campeonato')).toBeDisabled();
        await expect(page.locator('#btn-admin-logout')).toBeDisabled();
        await expect(page.locator('#admin-status')).toHaveText('Modo lectura');
        await page.screenshot({ path: '../evidence/screenshots/HDH-UI01-controles-admin.png', fullPage: true });
    });
});
