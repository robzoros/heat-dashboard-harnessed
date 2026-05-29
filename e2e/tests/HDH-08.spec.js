import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const screenshotDir = path.resolve('..', 'evidence', 'screenshots');

function ensureDir() {
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir, { recursive: true });
    }
}

test.describe('HDH-08 - Tests unitarios + integración con XML', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForFunction(() => window.App && window.App.charts && window.App.charts.wins);
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

    return result.data;
  }

  test('Unit: getFilteredPlays returns all when filters inactive', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    
    const result = await page.evaluate(() => {
      window.App.filters.active = false;
      return window.App.getFilteredPlays().length;
    });
    
    expect(result).toBe(4);
  });

  test('Unit: getFilteredPlays filters by track', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    
    const result = await page.evaluate(() => {
      window.App.filters.active = true;
      window.App.filters.tracks = ['Circuit A'];
      window.App.filters.players = [];
      window.App.filters.locations = [];
      return window.App.getFilteredPlays();
    });
    
    expect(result.length).toBe(2);
    expect(result.every(p => p.board === 'Circuit A')).toBe(true);
  });

  test('Unit: getFilteredPlays filters by player mode any', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    
    const result = await page.evaluate(() => {
      window.App.filters.active = true;
      window.App.filters.players = ['1'];
      window.App.filters.playerMode = 'any';
      window.App.filters.tracks = [];
      window.App.filters.locations = [];
      return window.App.getFilteredPlays();
    });
    
    expect(result.length).toBe(3);
  });

  test('Unit: getFilteredPlays filters by player mode all', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    
    const result = await page.evaluate(() => {
      window.App.filters.active = true;
      window.App.filters.players = ['1', '2'];
      window.App.filters.playerMode = 'all';
      window.App.filters.tracks = [];
      window.App.filters.locations = [];
      return window.App.getFilteredPlays();
    });
    
    expect(result.length).toBe(3);
  });

  test('Unit: getFilteredPlays filters by player mode exact', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    
    const result = await page.evaluate(() => {
      window.App.filters.active = true;
      window.App.filters.players = ['1', '2'];
      window.App.filters.playerMode = 'exact';
      window.App.filters.tracks = [];
      window.App.filters.locations = [];
      return window.App.getFilteredPlays();
    });
    
    expect(result.length).toBe(3);
  });

  test('Unit: getTrackFlag returns correct flags', async ({ page }) => {
    const flags = await page.evaluate(() => ({
      usa: window.App.getTrackFlag('USA'),
      italy: window.App.getTrackFlag('Italy'),
      france: window.App.getTrackFlag('France'),
      uk: window.App.getTrackFlag('UK'),
      germany: window.App.getTrackFlag('Germany'),
      japan: window.App.getTrackFlag('Japan'),
      unknown: window.App.getTrackFlag('Unknown Track')
    }));
    
    expect(flags.usa).toBe('🇺🇸');
    expect(flags.italy).toBe('🇮🇹');
    expect(flags.france).toBe('🇫🇷');
    expect(flags.uk).toBe('🇬🇧');
    expect(flags.germany).toBe('🇩🇪');
    expect(flags.japan).toBe('🇯🇵');
    expect(flags.unknown).toBe('🏁');
  });

  test('Unit: KPIs calculate correctly with mock data', async ({ page }) => {
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    
    await expect(page.locator('#kpi-leader')).toHaveText('Player1 (2)');
    const trackText = await page.locator('#kpi-track').textContent();
    expect(trackText).toContain('Circuit A');
  });

  test('Integration: Resumen sin filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="resumen"]').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-resumen-sin-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Resumen con filtro circuito', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="resumen"]').click();
    await page.locator('#btn-toggle-filters').click();
    const firstTrack = page.locator('#track-filters input').first();
    await firstTrack.check();
    await page.locator('#btn-apply-filters').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-resumen-filtro-circuito.png'),
      fullPage: true
    });
  });

  test('Integration: Resumen con filtro jugador', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="resumen"]').click();
    await page.locator('#btn-toggle-filters').click();
    const firstPlayer = page.locator('#player-filters input').first();
    await firstPlayer.check();
    await page.locator('#btn-apply-filters').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-resumen-filtro-jugador.png'),
      fullPage: true
    });
  });

  test('Integration: Jugadores sin filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="jugadores"]').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-jugadores-sin-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Jugadores con filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="jugadores"]').click();
    await page.locator('#btn-toggle-filters').click();
    const firstTrack = page.locator('#track-filters input').first();
    await firstTrack.check();
    await page.locator('#btn-apply-filters').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-jugadores-con-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Circuitos sin filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-circuitos-sin-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Circuitos con filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await page.locator('#btn-toggle-filters').click();
    const firstPlayer = page.locator('#player-filters input').first();
    await firstPlayer.check();
    await page.locator('#btn-apply-filters').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-circuitos-con-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Historial sin filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="historial"]').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-historial-sin-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Historial con filtros', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="historial"]').click();
    await page.locator('#btn-toggle-filters').click();
    const firstTrack = page.locator('#track-filters input').first();
    await firstTrack.check();
    await page.locator('#btn-apply-filters').click();
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-historial-con-filtros.png'),
      fullPage: true
    });
  });

  test('Integration: Historial con detalles expandidos', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('.tab-btn[data-tab="historial"]').click();
    await page.waitForTimeout(500);
    await page.locator('.play-entry').first().click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-historial-detalles.png'),
      fullPage: true
    });
  });

  test('Integration: Filtros panel desplegado', async ({ page }) => {
    ensureDir();
    await loadTestData(page);

    await page.locator('#btn-toggle-filters').click();
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(screenshotDir, 'HDH-08-filtros-panel.png'),
      fullPage: true
    });
  });
});
