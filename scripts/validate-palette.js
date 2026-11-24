#!/usr/bin/env node
/**
 * scripts/validate-palette.js
 *
 * Valida una paleta categórica para el tema oscuro «Asfalto y brasa»:
 *   1. contraste WCAG de cada color sobre los fondos del tema (>= 3:1);
 *   2. separación entre colores (ΔE76) en visión normal y simulando
 *      deuteranopia y protanopia (las dos más frecuentes).
 *
 * Uso:
 *   node scripts/validate-palette.js                  # paleta de player-colors.json
 *   node scripts/validate-palette.js --palette "#3987e5,#d95926"
 *   node scripts/validate-palette.js --json           # salida para máquinas
 *
 * Códigos de salida: 0 = OK, 1 = hay incumplimientos.
 * Sin dependencias externas.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = path.join(ROOT, 'src', 'data', 'player-colors.json');

// Fondos del tema Asfalto y brasa (deben coincidir con :root de styles.css).
const SURFACES = { bg: '#14110f', surface: '#1d1916' };

const MIN_CONTRAST = 3.0;
const MIN_DELTA_NORMAL = 12;
const MIN_DELTA_CVD = 10;
// Los colores tras el grupo estricto (bots) no suelen compararse entre sí:
// se les exige contraste y una separación mínima para no ser duplicados.
const MIN_DELTA_REST = 6;
// Número de colores del grupo estricto (los que usan los jugadores principales
// y por tanto aparecen juntos en los gráficos). Por defecto 8.
const STRICT_DEFAULT = 8;

/* ── color ──────────────────────────────────────────────────────────────── */

function normHex(hex) {
  if (typeof hex !== 'string') return '';
  let h = hex.trim().toLowerCase();
  if (!h) return '';
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  if (/^#[0-9a-f]{3}$/.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  return '';
}

function hexToRgb(hex) {
  return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
}

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function rgbToXyz([r, g, b]) {
  const rl = srgbToLinear(r);
  const gl = srgbToLinear(g);
  const bl = srgbToLinear(b);
  return [
    rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375,
    rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175,
    rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041
  ];
}

function xyzToLab([x, y, z]) {
  const ref = [0.95047, 1.0, 1.08883];
  const f = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  const [fx, fy, fz] = [x / ref[0], y / ref[1], z / ref[2]].map(f);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

function lab(hex) {
  return xyzToLab(rgbToXyz(hexToRgb(hex)));
}

function deltaE(aHex, bHex) {
  const a = lab(aHex);
  const b = lab(bHex);
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// Simulación de dicromacia con las matrices de Machado et al. (2009), severidad 1.
const CVD_MATRICES = {
  deuteranopia: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.011820, 0.042940, 0.968881]
  ],
  protanopia: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998]
  ]
};

function simulate(hex, kind) {
  const m = CVD_MATRICES[kind];
  const linear = hexToRgb(hex).map(srgbToLinear);
  const out = m.map((row) => row.reduce((sum, coef, i) => sum + coef * linear[i], 0));
  const encode = (v) => {
    const c = Math.max(0, Math.min(1, v));
    const s = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
    return Math.round(s * 255);
  };
  return '#' + out.map(encode).map((v) => v.toString(16).padStart(2, '0')).join('');
}

/* ── paleta ─────────────────────────────────────────────────────────────── */

function readPalette() {
  const arg = process.argv.find((a) => a.startsWith('--palette=')) || null;
  if (arg) return arg.split('=')[1].split(',').map(normHex).filter(Boolean);
  if (!fs.existsSync(CONFIG)) {
    console.error(`Error: no existe ${CONFIG}. Ejecuta scripts/player-colors.js init.`);
    process.exit(1);
  }
  const config = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  return (config.palette || []).map(normHex).filter(Boolean);
}

function validate(palette, strictCount) {
  const contrastIssues = [];
  const separation = { normal: [], deuteranopia: [], protanopia: [] };
  const seen = new Map();

  for (const hex of palette) {
    if (seen.has(hex)) {
      contrastIssues.push(`color duplicado en la paleta: ${hex}`);
      continue;
    }
    seen.set(hex, true);

    for (const [name, surface] of Object.entries(SURFACES)) {
      const ratio = contrast(hex, surface);
      if (ratio < MIN_CONTRAST) {
        contrastIssues.push(`${hex} sobre ${name} (${surface}): ${ratio.toFixed(2)}:1 < ${MIN_CONTRAST}:1`);
      }
    }
  }

  const chars = [...seen.keys()];
  for (let i = 0; i < chars.length; i++) {
    for (let j = i + 1; j < chars.length; j++) {
      const a = chars[i];
      const b = chars[j];
      const bothStrict = i < strictCount && j < strictCount;
      const rows = {
        normal: [a, b],
        deuteranopia: [simulate(a, 'deuteranopia'), simulate(b, 'deuteranopia')],
        protanopia: [simulate(a, 'protanopia'), simulate(b, 'protanopia')]
      };
      for (const [kind, [ca, cb]] of Object.entries(rows)) {
        let limit;
        if (bothStrict) limit = kind === 'normal' ? MIN_DELTA_NORMAL : MIN_DELTA_CVD;
        else limit = MIN_DELTA_REST;
        separation[kind].push({ pair: `${a} / ${b}`, delta: deltaE(ca, cb), limit, strict: bothStrict });
      }
    }
  }

  const separationIssues = [];
  for (const [kind, list] of Object.entries(separation)) {
    for (const entry of list) {
      if (entry.delta < entry.limit) {
        separationIssues.push(`${entry.pair}: ΔE ${entry.delta.toFixed(1)} < ${entry.limit} (${kind}${entry.strict ? ', principales' : ''})`);
      }
    }
    const worstStrict = list.filter((e) => e.strict).sort((x, y) => x.delta - y.delta)[0];
    if (worstStrict) {
      separation.worstPair = separation.worstPair || {};
      separation.worstPair[kind] = worstStrict;
    }
  }

  return { palette: chars, contrastIssues, separationIssues, separation };
}

function strictCount() {
  const arg = process.argv.find((a) => a.startsWith('--strict='));
  if (!arg) return STRICT_DEFAULT;
  const value = Number.parseInt(arg.split('=')[1], 10);
  return Number.isFinite(value) && value > 0 ? value : STRICT_DEFAULT;
}

function main() {
  const palette = readPalette();
  if (!palette.length) {
    console.error('Error: la paleta está vacía.');
    process.exit(1);
  }

  const strict = strictCount();
  const result = validate(palette, strict);
  const json = process.argv.includes('--json');

  if (json) {
    console.log(JSON.stringify({
      palette: result.palette,
      strict,
      ok: !result.contrastIssues.length && !result.separationIssues.length,
      surfaces: SURFACES,
      thresholds: { minContrast: MIN_CONTRAST, minDeltaNormal: MIN_DELTA_NORMAL, minDeltaCvd: MIN_DELTA_CVD, minDeltaRest: MIN_DELTA_REST },
      contrastIssues: result.contrastIssues,
      separationIssues: result.separationIssues,
      worstPair: result.separation.worstPair
    }, null, 2));
  } else {
    console.log(`Paleta: ${result.palette.length} colores (${strict} principales con separación estricta)`);
    console.log(`Fondos: bg ${SURFACES.bg}, surface ${SURFACES.surface}`);
    console.log('');
    console.log('Contraste WCAG por color:');
    for (const hex of result.palette) {
      const a = contrast(hex, SURFACES.bg);
      const b = contrast(hex, SURFACES.surface);
      const flag = Math.min(a, b) >= MIN_CONTRAST ? 'ok  ' : 'BAJO';
      console.log(`  ${flag} ${hex}  bg ${a.toFixed(2)}:1  surface ${b.toFixed(2)}:1`);
    }
    console.log('');
    console.log('Peor par por tipo de visión (ΔE76 mayor = más distinguible):');
    for (const [kind, worst] of Object.entries(result.separation.worstPair || {})) {
      console.log(`  ${kind.padEnd(13)} ${worst.delta.toFixed(1)}  (${worst.pair})`);
    }
    console.log('');
    if (result.contrastIssues.length || result.separationIssues.length) {
      console.log('INCUMPLIMIENTOS:');
      for (const issue of [...result.contrastIssues, ...result.separationIssues]) console.log(`  - ${issue}`);
      process.exit(1);
    }
    console.log('OK: contraste y separación dentro de los umbrales.');
  }
}

main();
