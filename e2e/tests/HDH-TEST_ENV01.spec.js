import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.resolve('..', 'evidence', 'screenshots');

function ensureDir() {
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
}

test.describe('HDH-TEST_ENV01 - Tests usando XML de prueba', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
    });

    async function loadTestData(page) {
        const response = await page.request.post('/bgg-api/test-login');
        expect(response.ok()).toBe(true);
        const result = await response.json();
        expect(result.success).toBe(true);
        expect(result.data.plays.length).toBeGreaterThan(0);

        await page.evaluate((data) => {
            window.App.data = data;
            window.App.populateFilters();
            window.App.filters.active = true;
            window.App.filters.players = [];
            window.App.filters.tracks = [];
            window.App.filters.locations = [];
            window.App.updateHeaderStats();
            window.App.renderAll();
        }, result.data);
    }

    test('debe cargar datos desde XML de prueba y capturar evidencia', async ({ page }) => {
        ensureDir();
        await loadTestData(page);

        // Verify data loaded
        const totalPlays = await page.locator('#stat-plays-total').textContent();
        expect(Number(totalPlays)).toBeGreaterThan(0);

        await page.screenshot({
            path: path.join(screenshotDir, 'HDH-TEST_ENV01-datos-cargados.png'),
            fullPage: true
        });
    });

    test('debe aplicar filtro y capturar evidencia', async ({ page }) => {
        ensureDir();
        await loadTestData(page);

        const initialFiltered = await page.locator('#stat-plays-filtered').textContent();
        const initialTotal = await page.locator('#stat-plays-total').textContent();
        expect(Number(initialFiltered)).toBe(Number(initialTotal));

        // Expand filters
        await page.locator('#btn-toggle-filters').click();
        // Select first track filter
        const firstTrack = page.locator('#track-filters input').first();
        await firstTrack.check();
        await page.locator('#btn-apply-filters').click();

        const filteredAfter = await page.locator('#stat-plays-filtered').textContent();
        expect(Number(filteredAfter)).toBeLessThan(Number(initialTotal));

        await page.screenshot({
            path: path.join(screenshotDir, 'HDH-TEST_ENV01-filtro-aplicado.png'),
            fullPage: true
        });
    });

    test('debe desactivar filtro y capturar evidencia', async ({ page }) => {
        ensureDir();
        await loadTestData(page);

        const initialFiltered = await page.locator('#stat-plays-filtered').textContent();
        const initialTotal = await page.locator('#stat-plays-total').textContent();

        // Expand, apply first track filter
        await page.locator('#btn-toggle-filters').click();
        const firstTrack = page.locator('#track-filters input').first();
        await firstTrack.check();
        await page.locator('#btn-apply-filters').click();

        const filteredAfter = await page.locator('#stat-plays-filtered').textContent();
        expect(Number(filteredAfter)).toBeLessThan(Number(initialTotal));

        // Uncheck filter and re-apply
        await firstTrack.uncheck();
        await page.locator('#btn-apply-filters').click();

        const filteredBack = await page.locator('#stat-plays-filtered').textContent();
        expect(Number(filteredBack)).toBe(Number(initialTotal));

        await page.screenshot({
            path: path.join(screenshotDir, 'HDH-TEST_ENV01-filtro-desactivado.png'),
            fullPage: true
        });
    });
});
