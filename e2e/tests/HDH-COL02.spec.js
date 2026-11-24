import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

// Config de prueba: Alice y Bob comparten primario a propósito y Zac es bot.
const fixtureConfig = {
  version: 1,
  generatedFrom: 'src/data/heat-data.json (fixture)',
  palette: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#0ca30c', '#9085e9', '#e66767'],
  players: [
    { name: 'Alice', type: 'main', primary: '#d95926', secondary: '', },
    { name: 'Bob', type: 'main', primary: '#d95926', secondary: '#199e70' },
    { name: 'Zac', type: 'bot', primary: '#c98500', secondary: '' }
  ]
};

async function openEditor(page, config = fixtureConfig) {
  await page.route('**/data/player-colors.json', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) })
  );
  await page.goto('/colors.html');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('#color-groups')).toContainText('Alice');
}

test.describe('HDH-COL02 - Editor visual de colores', () => {
  test('carga jugadores y bots agrupados por tipo con su color final', async ({ page }) => {
    await openEditor(page);

    const rows = page.locator('.color-row');
    await expect(rows).toHaveCount(3);
    await expect(page.locator('#group-main')).toContainText('Principales');
    await expect(page.locator('#group-bot')).toContainText('Bots');

    // Alice gana el primario compartido; Bob cae en su secundario.
    const aliceRow = page.locator('.color-row[data-name="Alice"]');
    const bobRow = page.locator('.color-row[data-name="Bob"]');
    await expect(aliceRow.locator('.row-final')).toContainText('#d95926');
    await expect(aliceRow.locator('.src-primary')).toBeVisible();
    await expect(bobRow.locator('.row-final')).toContainText('#199e70');
    await expect(bobRow.locator('.src-secondary')).toContainText('secundario');

    // La paleta disponible se muestra con su hex.
    await expect(page.locator('#palette-strip .palette-swatch')).toHaveCount(8);
    await expect(page.locator('#palette-count')).toHaveText('8');

    await page.screenshot({ path: '../evidence/screenshots/HDH-COL02-editor-inicial.png', fullPage: true });
  });

  test('elegir un color actualiza el hex, el color final y marca cambios sin guardar', async ({ page }) => {
    await openEditor(page);

    await page.locator('.slot[data-name="Zac"][data-slot="primary"]').click();
    const editor = page.locator('.color-row[data-name="Zac"] .slot-editor');
    await expect(editor).toBeVisible();

    await page.locator('.color-row[data-name="Zac"] .swatch[data-pick-hex="#9085e9"]').click();

    const state = await page.evaluate(() => ({
      primary: window.ColorEditor.state.config.players.find(p => p.name === 'Zac').primary,
      resolved: window.ColorEditor.resolveColors().get('Zac').color,
      dirty: window.ColorEditor.isDirty(),
      selected: document.querySelector('.color-row[data-name="Zac"] .slot[data-slot="primary"] .slot-hex').textContent
    }));

    expect(state.primary).toBe('#9085e9');
    expect(state.resolved).toBe('#9085e9');
    expect(state.selected).toBe('#9085e9');
    expect(state.dirty).toBe(true);
    await expect(page.locator('#dirty-badge')).toBeVisible();
    await expect(page.locator('#btn-reset')).toBeEnabled();
  });

  test('reutilizar un primario resuelve el conflicto con el secundario y lo explica', async ({ page }) => {
    await openEditor(page);

    // Zac (bot) pasa a usar el mismo primario que Alice.
    await page.locator('.slot[data-name="Zac"][data-slot="primary"]').click();
    await page.locator('.color-row[data-name="Zac"] .swatch[data-pick-hex="#d95926"]').click();

    // Alice < Bob < Zac: Zac es el tercero en conflicto, así que necesita secundario.
    await page.locator('.slot[data-name="Zac"][data-slot="secondary"]').click();
    await page.locator('.color-row[data-name="Zac"] .swatch[data-pick-hex="#c98500"]').click();

    const zacRow = page.locator('.color-row[data-name="Zac"]');
    await expect(zacRow.locator('.row-final')).toContainText('#c98500');
    await expect(zacRow.locator('.src-secondary')).toContainText('primario ocupado por');

    // El panel de conflictos lista el caso.
    await expect(page.locator('#issues-card')).toBeVisible();
    await expect(page.locator('#issues-list')).toContainText('#d95926 está asignado a 3 entradas');

    // Vista previa coherente con el color final.
    await expect(page.locator('.preview-item[data-preview-name="Zac"] .preview-hex')).toHaveText('#c98500');

    await page.screenshot({ path: '../evidence/screenshots/HDH-COL02-editor-conflicto.png', fullPage: true });
  });

  test('descargar genera player-colors.json con los cambios', async ({ page }) => {
    await openEditor(page);

    await page.locator('.slot[data-name="Alice"][data-slot="primary"]').click();
    await page.locator('.color-row[data-name="Alice"] .swatch[data-pick-hex="#0ca30c"]').click();

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('#btn-download').click()
    ]);

    expect(download.suggestedFilename()).toBe('player-colors.json');
    const path = await download.path();
    const json = JSON.parse(readFileSync(path, 'utf8'));

    expect(json.palette).toHaveLength(8);
    expect(json.players.find(p => p.name === 'Alice').primary).toBe('#0ca30c');
    expect(json.players.find(p => p.name === 'Bob').secondary).toBe('#199e70');
  });

  test('hex manual inválido avisa y no cambia el color', async ({ page }) => {
    await openEditor(page);

    await page.locator('.slot[data-name="Alice"][data-slot="primary"]').click();
    await page.locator('.hex-input[data-name="Alice"]').fill('naranja');
    await page.locator('[data-apply-hex][data-name="Alice"]').click();

    await expect(page.locator('#colors-status')).toContainText('Hex inválido');
    const primary = await page.evaluate(() =>
      window.ColorEditor.state.config.players.find(p => p.name === 'Alice').primary
    );
    expect(primary).toBe('#d95926');
  });

  test('el buscador y el filtro por tipo acotan las filas', async ({ page }) => {
    await openEditor(page);

    await page.locator('[data-type="bot"]').click();
    await expect(page.locator('.color-row')).toHaveCount(1);
    await expect(page.locator('.color-row[data-name="Zac"]')).toBeVisible();

    await page.locator('[data-type="all"]').click();
    await page.locator('#colors-search').fill('bo');
    await expect(page.locator('.color-row')).toHaveCount(1);
    await expect(page.locator('.color-row[data-name="Bob"]')).toBeVisible();
  });

  test('descartar cambios restaura el JSON original', async ({ page }) => {
    await openEditor(page);

    await page.locator('.slot[data-name="Alice"][data-slot="primary"]').click();
    await page.locator('.color-row[data-name="Alice"] .swatch[data-pick-hex="#0ca30c"]').click();
    await expect(page.locator('#btn-reset')).toBeEnabled();

    await page.locator('#btn-reset').click();

    const state = await page.evaluate(() => ({
      primary: window.ColorEditor.state.config.players.find(p => p.name === 'Alice').primary,
      dirty: window.ColorEditor.isDirty()
    }));
    expect(state.primary).toBe('#d95926');
    expect(state.dirty).toBe(false);
    await expect(page.locator('#dirty-badge')).toBeHidden();
  });

  test('la config real muestra los 20 jugadores y bots sin conflictos y con evidencia', async ({ page }) => {
    await page.goto('/colors.html');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#color-groups .color-row')).toHaveCount(20);
    await expect(page.locator('#issues-card')).toBeHidden();
    await expect(page.locator('#palette-count')).toHaveText('20');
    await page.screenshot({ path: '../evidence/screenshots/HDH-COL02-editor-real.png', fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: '../evidence/screenshots/HDH-COL02-editor-real-movil.png', fullPage: true });
  });

  test('el dashboard enlaza al editor de colores', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const link = page.locator('header .header-link');
    await expect(link).toHaveAttribute('href', 'colors.html');
    await link.click();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toContainText('Colores de jugadores');
  });
});
