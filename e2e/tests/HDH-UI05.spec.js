import { test, expect } from '@playwright/test';

// HDH-UI05 - Rediseño de la pestaña Circuitos (rail + panel de detalle):
// - Rail lateral de tarjetas ricas (partidas, bots, reparto, campeón con color).
// - A la derecha: badges del circuito activo, donut existente, pódio top 3
//   de jugadores principales y últimas visitas al circuito.
// - El toggle de selección y el chart DISTRIBUCIÓN/Victorias siguen igual.
test.describe('HDH-UI05 - Rail de circuitos y panel de detalle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
    await page.waitForSelector('canvas', { timeout: 10000 });
    await page.evaluate(() => window.App.loadMockData());
    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await page.waitForTimeout(200);
  });

  test('el rail muestra tarjetas ricas contando partidas, bots y campeón con color', async ({ page }) => {
    const cards = page.locator('.track-card');
    await expect(cards.first()).toBeVisible();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);

    const first = cards.first();
    await expect(first.locator('h4.track-name')).toBeVisible();
    await expect(first.locator('.track-meta')).toContainText('🏁');
    await expect(first.locator('.track-meta')).toContainText('🤖');
    await expect(first.locator('.sharebar')).toBeVisible();
    await expect(first.locator('.track-champ')).toBeVisible();

    // Si el campeón tiene color de jugador, el punto existe y no es gris neutro.
    const dotColor = await first.locator('.track-champ .name-dot').getAttribute('style');
    if (dotColor) expect(dotColor).toContain('background');

    await page.screenshot({ path: '../evidence/screenshots/HDH-UI05-rail-circuitos.png', fullPage: true });
  });

  test('clic en la tarjeta activa el detalle: badges, pódio y visitas', async ({ page }) => {
    // Nombre del primer circuito tal como lo pinta la app.
    const trackName = await page.locator('.track-card').first().locator('h4.track-name').textContent();
    const bareName = trackName.replace(/^[^\w]+/, '').trim();

    await page.locator('.track-card').first().click();
    await page.waitForTimeout(200);

    await expect(page.locator('.track-card').first()).toHaveClass(/selected/);
    await expect(page.locator('#tracks-chart-title')).toContainText(`Victorias — ${bareName}`);

    // Cabecera de badges del circuito activo.
    const head = page.locator('#track-detail-head');
    await expect(head).toContainText(bareName);
    await expect(head).toContainText('partidas');
    await expect(head).toContainText('% del total');
    await expect(head).toContainText('última:');

    // Pódio: peldaños con colores de jugador reales (1 si en el mock solo gana un principal).
    const steps = page.locator('#track-podium .podium-place');
    const stepsCount = await steps.count();
    expect(stepsCount).toBeGreaterThan(0);
    expect(stepsCount).toBeLessThanOrEqual(3);
    const firstStepStyle = await steps.first().getAttribute('style');
    expect(firstStepStyle).toContain('--pc:#');
    expect(firstStepStyle).not.toContain('--pc:#a99f95'); // no usa el gris de fallback

    // Visitas: hasta 5 filas con ganador.
    const recents = page.locator('#track-recents .track-recent');
    const recentsCount = await recents.count();
    expect(recentsCount).toBeGreaterThan(0);
    expect(recentsCount).toBeLessThanOrEqual(5);
    await expect(recents.first()).toContainText('🏆');

    await page.screenshot({ path: '../evidence/screenshots/HDH-UI05-detalle-circuito.png', fullPage: true });

    // Segundo clic deselecciona y vuelve a Distribución + estados vacíos.
    await page.locator('.track-card').first().click();
    await page.waitForTimeout(200);
    await expect(page.locator('#tracks-chart-title')).toContainText('Distribución');
    await expect(page.locator('#track-podium')).toContainText('Haz clic en un circuito');
    await expect(page.locator('#track-recents')).toContainText('Haz clic en un circuito');
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI05-sin-seleccion.png', fullPage: true });
  });

  test('responsive: el rail pasa a carrusel horizontal y el duo se apila', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    const railOverflow = await page.locator('.track-rail .rail-list').evaluate(
      el => el.scrollWidth > el.clientWidth
    );
    expect(railOverflow).toBe(true);
    const duoBox = await page.locator('.circuitos-duo').boundingBox();
    expect(duoBox.width).toBeLessThanOrEqual(392);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI05-movil.png', fullPage: true });
  });
});
