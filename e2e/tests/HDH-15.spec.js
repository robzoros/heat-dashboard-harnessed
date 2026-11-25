import { test, expect } from '@playwright/test';

test.describe('HDH-15 - Modificar pestaña Circuitos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const banner = page.locator('#cookie-consent-banner:not(.hidden)');
    if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
      await page.click('#btn-accept-cookies');
    }
  });

  const customData = {
    players: [
      { id: 1, name: 'Alice', isBot: false, isMain: true, isOther: false },
      { id: 2, name: 'Bob', isBot: false, isMain: true, isOther: false },
      { id: 3, name: 'Automa', isBot: true, isMain: false, isOther: false },
      { id: 4, name: 'Charlie', isBot: false, isMain: false, isOther: true }
    ],
    locations: [{ id: 1, name: 'Home' }],
    boards: [{ id: 1, name: 'USA' }, { id: 2, name: 'Italy' }],
    plays: [
      {
        id: 1, playDate: '2024-01-01', board: 'USA', locationRefId: 1,
        playerScores: [
          { playerRefId: 1, score: '30', scoreNum: 30, winner: true },
          { playerRefId: 2, score: '20', scoreNum: 20, winner: false },
          { playerRefId: 3, score: '10', scoreNum: 10, winner: false }
        ]
      },
      {
        id: 2, playDate: '2024-01-02', board: 'USA', locationRefId: 1,
        playerScores: [
          { playerRefId: 3, score: '28', scoreNum: 28, winner: true },
          { playerRefId: 1, score: '15', scoreNum: 15, winner: false }
        ]
      },
      {
        id: 3, playDate: '2024-01-03', board: 'USA', locationRefId: 1,
        playerScores: [
          { playerRefId: 4, score: '22', scoreNum: 22, winner: true },
          { playerRefId: 1, score: '18', scoreNum: 18, winner: false }
        ]
      },
      {
        id: 4, playDate: '2024-01-04', board: 'Italy', locationRefId: 1,
        playerScores: [
          { playerRefId: 2, score: '40', scoreNum: 40, winner: true },
          { playerRefId: 1, score: '10', scoreNum: 10, winner: false }
        ]
      }
    ]
  };

  async function loadCustomData(page) {
    await page.evaluate((data) => {
      window.App.data = data;
      window.App.populateFilters();
      window.App.filters.active = true;
      window.App.filters.players = [];
      window.App.filters.tracks = [];
      window.App.filters.locations = [];
      window.App.updateHeaderStats();
      window.App.renderAll();
    }, customData);
    await page.locator('.tab-btn[data-tab="circuitos"]').click();
  }

  test('no debe mostrar Pts Medio y debe mostrar Victorias de Bots', async ({ page }) => {
    await loadCustomData(page);

    // En 4 partidas de USA ganaron: Alice (1), Automa bot (1), Charlie other (1).
    // Italy: Bob (1) -> 0 victorias de bots.
    const usaCard = page.locator('.track-card').first();
    await expect(usaCard.locator('h4')).toContainText('USA');
    await expect(usaCard).not.toContainText('Pts Medio');
    await expect(usaCard.locator('.track-meta span', { hasText: '🤖' })).toContainText('2');

    const italyCard = page.locator('.track-card').last();
    await expect(italyCard.locator('h4')).toContainText('Italy');
    await expect(italyCard.locator('.track-meta span', { hasText: '🤖' })).toContainText('0');

    await page.screenshot({ path: '../evidence/screenshots/HDH-15-circuitos-custom.png', fullPage: true });
  });

  test('debe mostrar victorias por jugador y Bots en DISTRIBUCIÓN al pulsar el circuito', async ({ page }) => {
    await loadCustomData(page);

    // Click en el nombre del circuito USA
    await page.locator('.track-name[data-track="USA"]').click();

    // El título cambia y el chart muestra victorias: Alice 1, Bots 2 (Automa + Charlie)
    await expect(page.locator('#tracks-chart-title')).toContainText('Victorias — USA');

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.tracks;
      return {
        labels: chart.data.labels,
        values: chart.data.datasets[0].data,
        title: document.getElementById('tracks-chart-title').textContent
      };
    });

    expect(chartData.labels.sort()).toEqual(['Alice', 'Bots']);
    expect(chartData.values).toEqual([1, 2]);

    await page.screenshot({ path: '../evidence/screenshots/HDH-15-victorias-circuito.png', fullPage: true });
  });

  test('debe restaurar la distribución al pulsar el mismo circuito de nuevo', async ({ page }) => {
    await loadCustomData(page);

    await page.locator('.track-name[data-track="USA"]').click();
    await expect(page.locator('#tracks-chart-title')).toContainText('Victorias — USA');

    // Segundo click sobre el mismo circuito deselecciona
    await page.locator('.track-name[data-track="USA"]').click();

    const chartData = await page.evaluate(() => {
      const chart = window.App.charts.tracks;
      return {
        labels: chart.data.labels,
        values: chart.data.datasets[0].data,
        title: document.getElementById('tracks-chart-title').textContent
      };
    });

    expect(chartData.title).toBe('Distribución');
    expect(chartData.labels).toEqual(['Italy', 'USA']);
    expect(chartData.values).toEqual([1, 3]);
  });

  test('debe generar screenshots con datos reales', async ({ page }) => {
    // Los datos reales (src/data/heat-data.json) se cargan automáticamente
    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await page.waitForSelector('#track-list .track-card', { timeout: 10000 });

    const cards = page.locator('.track-card');
    await expect(cards.first()).toBeVisible();

    await page.screenshot({ path: '../evidence/screenshots/HDH-15-datos-reales.png', fullPage: true });
  });

  test('debe generar screenshots con filtros aplicados', async ({ page }) => {
    // Datos reales + filtro por circuito
    await page.locator('#btn-toggle-filters').click();
    await page.locator('#filter-active').check();
    await page.locator('#track-filters input[value="USA"]').check();
    await page.locator('#btn-apply-filters').click();

    await page.locator('.tab-btn[data-tab="circuitos"]').click();
    await page.waitForSelector('#track-list .track-card', { timeout: 10000 });

    // Solo USA tras el filtro
    const cards = page.locator('.track-card');
    await expect(cards).toHaveCount(1);
    await expect(cards.first().locator('h4')).toContainText('USA');

    // El chart DISTRIBUCIÓN refleja el circuito filtrado
    const chartData = await page.evaluate(() => window.App.charts.tracks.data.labels);
    expect(chartData).toEqual(['USA']);

    // Y el click sobre el circuito filtrado sigue funcionando
    await cards.first().locator('.track-name').click();
    await expect(page.locator('#tracks-chart-title')).toContainText('Victorias — USA');

    await page.screenshot({ path: '../evidence/screenshots/HDH-15-filtros-aplicados.png', fullPage: true });
  });
});
