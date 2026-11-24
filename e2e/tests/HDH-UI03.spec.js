import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const colorConfig = JSON.parse(readFileSync(path.join(repoRoot, 'src', 'data', 'player-colors.json'), 'utf8'));

async function openApp(page, query = '') {
  await page.goto(`/${query}`);
  await page.waitForLoadState('networkidle');
  const banner = page.locator('#cookie-consent-banner:not(.hidden)');
  if (await banner.isVisible({ timeout: 2000 }).catch(() => false)) {
    await page.click('#btn-accept-cookies');
  }
  await page.waitForSelector('canvas', { timeout: 10000 });
}

test.describe('HDH-UI03 - Tema único Asfalto y brasa', () => {
  test('el tema es asfalto y brasa, sin variantes ni selector flotante', async ({ page }) => {
    await openApp(page);

    const tokens = await page.evaluate(() => ({
      bg: App.cssVar('--bg'),
      surface: App.cssVar('--surface'),
      text: App.cssVar('--text'),
      accent: App.cssVar('--accent'),
      variant: document.documentElement.getAttribute('data-variant')
    }));

    expect(tokens.bg).toBe('#14110f');
    expect(tokens.surface).toBe('#1d1916');
    expect(tokens.text).toBe('#f2ece5');
    expect(tokens.accent).toBe('#ff7a2f');
    expect(tokens.variant).toBeNull();
    await expect(page.locator('.variant-switch')).toHaveCount(0);
  });

  test('?variant=a ya no cambia el tema (la variante índigo y coral está eliminada)', async ({ page }) => {
    await openApp(page, '?variant=a');
    const state = await page.evaluate(() => ({
      variant: document.documentElement.getAttribute('data-variant'),
      bg: App.cssVar('--bg'),
      accent: App.cssVar('--accent'),
      stored: localStorage.getItem('heat-variant')
    }));
    expect(state.variant).toBeNull();
    expect(state.bg).toBe('#14110f');
    expect(state.accent).toBe('#ff7a2f');
    expect(state.stored).toBeNull();
  });

  test('la paleta de la app son los 12 colores oficiales del juego', async ({ page }) => {
    await openApp(page);
    const palette = await page.evaluate(() => App.PLAYER_PALETTE);
    expect(palette).toEqual(colorConfig.palette.slice(0, 8));
    expect(colorConfig.palette).toHaveLength(12);
    expect(colorConfig.paletteNames).toHaveLength(12);
    expect(colorConfig.paletteNames).toEqual([
      'Rojo', 'Azul', 'Amarillo', 'Rosa', 'Cian', 'Verde',
      'Morado', 'Naranja', 'Plata', 'Blanco', 'Marrón', 'Negro'
    ]);
    // Los puros del juego que no llegan al contraste o se confunden con
    // daltonismo no siguen en la paleta.
    for (const old of ['#1f2937', '#1d4ed8', '#7e22ce', '#9ca3af', '#78350f']) {
      expect(colorConfig.palette).not.toContain(old);
    }
  });

  test('validate-palette.js acepta la paleta del repositorio', () => {
    const out = execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'validate-palette.js')], {
      cwd: repoRoot,
      encoding: 'utf8'
    });
    expect(out).toContain('OK: contraste y separación dentro de los umbrales');
  });

  test('los colores de los jugadores se aplican en el podio y en los gráficos', async ({ page }) => {
    await openApp(page);

    const data = await page.evaluate(() => ({
      palette: App.PLAYER_PALETTE,
      podium: Array.from(document.querySelectorAll('#podium .podium-place')).map(el => ({
        name: el.querySelector('.podium-name').textContent,
        color: el.style.getPropertyValue('--pc').trim()
      })),
      bars: (() => {
        const chart = Chart.getChart('chart-wins');
        if (!chart) return null;
        const ds = chart.data.datasets[0];
        return chart.data.labels.map((label, i) => [label, ds.backgroundColor[i]]);
      })()
    }));

    expect(data.podium.length).toBeGreaterThan(0);
    for (const place of data.podium) {
      expect(data.palette).toContain(place.color);
    }
    if (data.bars) {
      for (const [, color] of data.bars) expect(data.palette).toContain(color);
    }
  });

  test('el editor de colores muestra los 12 con sus nombres oficiales', async ({ page }) => {
    await page.goto('/colors.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#palette-count')).toHaveText('12');
    const swatches = await page.locator('#palette-strip .palette-hex').allTextContents();
    expect(swatches).toEqual(colorConfig.palette);
    const names = await page.locator('#palette-strip .palette-name').allTextContents();
    expect(names).toEqual(colorConfig.paletteNames);
  });

  test('con 20 entradas y 12 colores, nadie cae al gris: la app reutiliza el primario', async ({ page }) => {
    await openApp(page);
    const state = await page.evaluate(() => ({
      palette: App.colorPalette(),
      // cssVar vive en el navegador; se lee aquí, no en Node.
      muted: App.cssVar('--text-muted').trim().toLowerCase(),
      players: App.data.players.length,
      colors: Object.fromEntries(App.colorMap.entries())
    }));
    expect(state.palette).toHaveLength(12);
    expect(Object.keys(state.colors)).toHaveLength(state.players);
    for (const [name, color] of Object.entries(state.colors)) {
      expect(color.trim().toLowerCase(), name).not.toBe(state.muted);
      expect(state.palette, name).toContain(color.trim().toLowerCase());
    }
  });

  test('genera screenshots del tema Asfalto y brasa', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    await page.waitForTimeout(600);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI03-resumen-asfalto-escritorio.png', fullPage: true });

    await page.goto('/colors.html');
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI03-paleta-asfalto.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(600);
    await page.screenshot({ path: '../evidence/screenshots/HDH-UI03-resumen-asfalto-movil.png', fullPage: true });
  });
});
