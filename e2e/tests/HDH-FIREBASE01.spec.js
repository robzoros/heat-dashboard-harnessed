import { test, expect } from '@playwright/test';

test.describe('HDH-FIREBASE01 - Integración Firebase', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
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
});
