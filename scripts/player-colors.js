#!/usr/bin/env node
/**
 * scripts/player-colors.js
 *
 * Configuración de colores de jugadores y bots (src/data/player-colors.json).
 *
 * Comandos:
 *   node scripts/player-colors.js init              Genera/actualiza la config desde heat-data.json.
 *                                                   Preserva los colores ya asignados; añade
 *                                                   jugadores nuevos y actualiza su tipo.
 *                                                   Con --reseed reasigna TODOS los primarios con
 *                                                   la paleta actual (y vacía los secundarios).
 *   node scripts/player-colors.js list [--json]     Lista jugadores y bots con su color actual.
 *   node scripts/player-colors.js set <nombre> [--primary <hex>] [--secondary <hex>]
 *                                                   Cambia el color primario/secundario de un
 *                                                   jugador o bot ("--secondary auto" lo limpia).
 *   node scripts/player-colors.js check             Detecta conflictos de color y hex inválidos.
 *
 * Sin dependencias externas. Node >= 20.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_DATA = path.join(ROOT, 'src', 'data', 'heat-data.json');
const DEFAULT_CONFIG = path.join(ROOT, 'src', 'data', 'player-colors.json');

// Paleta de siembra: los 8 primeros son PLAYER_PALETTE de src/app.js
// (validada para fondos oscuros con validate_palette.js). Los siguientes
// completan hasta 20 entradas (jugadores + bots actuales).
// Paleta del tema «Asfalto y brasa», validada con scripts/validate-palette.js:
// contraste >= 3:1 sobre #14110f y #1d1916 y ΔE >= 12 (visión normal) / >= 10
// (deuteranopia y protanopia) entre los 8 primeros, que son los que comparten
// los jugadores principales en los gráficos.
const SEED_PALETTE = [
  '#f4e3c4', '#f2c14e', '#e9913f', '#d1583c', '#86c8e3', '#2f8f76', '#7561ad', '#d67a9c',
  '#c3aa79', '#b7d7d1', '#ab69a0', '#c8af9d', '#cdc570', '#83b0b9', '#aa79c3', '#b6825d',
  '#d7d18e', '#d7ccb7', '#d0bc95', '#79c3b7'
];

function fail(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function readJson(file, what) {
  if (!fs.existsSync(file)) fail(`No existe ${what}: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    fail(`${what} es JSON inválido (${file}): ${e.message}`);
  }
}

function writeJson(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

/** Normaliza un hex a formato '#rrggbb' minúscula; '' si es inválido. */
function normHex(hex) {
  if (typeof hex !== 'string') return '';
  let h = hex.trim().toLowerCase();
  if (!h) return '';
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-f]{6}$/.test(h)) return h;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return '';
}

/** Distancia RGB simple (0..765) entre dos hex normalizados. */
function colorDistance(a, b) {
  const pa = [1, 3, 5].map(i => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map(i => parseInt(b.slice(i, i + 2), 16));
  return pa.reduce((sum, v, i) => sum + Math.abs(v - pb[i]), 0);
}

function typeOf(p) {
  if (p.isBot) return 'bot';
  if (p.isMain) return 'main';
  return 'other';
}

const TYPE_LABEL = { main: 'Principal', bot: 'Bot', other: 'Otro' };

/** Lista de jugadores del JSON de datos: [{ name, type }] ordenada bots al final. */
function playersFromData(data) {
  const order = { main: 0, other: 1, bot: 2 };
  return (data.players || [])
    .map(p => ({ name: p.name, type: typeOf(p) }))
    .sort((a, b) => order[a.type] - order[b.type] || a.name.localeCompare(b.name, 'es'));
}

function loadConfigOrEmpty(file) {
  if (!fs.existsSync(file)) return { version: 1, players: [] };
  return readJson(file, 'Config de colores');
}

/** Ronda de siembra: primer color de SEED_PALETTE no ocupado por un primario. */
function nextSeedColor(config) {
  const used = new Set(
    config.players
      .map(e => normHex(e.primary))
      .filter(Boolean)
  );
  return SEED_PALETTE.find(c => !used.has(c)) || SEED_PALETTE[config.players.length % SEED_PALETTE.length];
}

function cmdInit(args) {
  const dataFile = args['--data'] || DEFAULT_DATA;
  const configFile = args['--config'] || DEFAULT_CONFIG;
  const data = readJson(dataFile, 'JSON de datos');
  const config = loadConfigOrEmpty(configFile);
  const prevByName = new Map(config.players.map(e => [e.name, e]));

  const players = playersFromData(data);
  const result = [];
  const added = [];
  const reseeded = [];
  for (const p of players) {
    const prev = prevByName.get(p.name);
    prevByName.delete(p.name);
    if (prev && !args['--reseed']) {
      result.push({
        name: p.name,
        type: p.type,
        primary: prev.primary || '',
        secondary: prev.secondary || ''
      });
    } else {
      const primary = nextSeedColor({ players: result });
      result.push({ name: p.name, type: p.type, primary, secondary: '' });
      const line = `${p.name} (${TYPE_LABEL[p.type]}) -> ${primary}`;
      if (prev) reseeded.push(line); else added.push(line);
    }
  }

  const dropped = [...prevByName.keys()];
  const out = {
    version: 1,
    generatedFrom: path.relative(ROOT, dataFile).replace(/\\/g, '/'),
    // Paleta de colores disponibles: la usa el editor visual (src/colors.html)
    // y sirve de reserva a la app cuando primario y secundario estan ocupados.
    palette: SEED_PALETTE,
    players: result
  };
  writeJson(configFile, out);

  console.log(`Config escrita: ${path.relative(ROOT, configFile).replace(/\\/g, '/')}`);
  console.log(`Entradas: ${result.length} (${added.length} nuevas, ${reseeded.length} reasignadas)`);
  if (added.length) console.log(`Nuevos:\n  ${added.join('\n  ')}`);
  if (reseeded.length) console.log(`Reasignados (--reseed):\n  ${reseeded.join('\n  ')}`);
  if (dropped.length) console.log(`Eliminados (ya no están en los datos):\n  ${dropped.join('\n  ')}`);
}

function cmdList(args) {
  const configFile = args['--config'] || DEFAULT_CONFIG;
  const config = readJson(configFile, 'Config de colores');
  if (args['--json']) {
    console.log(JSON.stringify(config, null, 2));
    return;
  }
  if (!config.players.length) {
    console.log('Config vacía. Ejecuta: node scripts/player-colors.js init');
    return;
  }
  const wName = Math.max('Nombre'.length, ...config.players.map(e => e.name.length));
  const wType = Math.max('Tipo'.length, ...config.players.map(e => TYPE_LABEL[e.type].length));
  const head = `Nombre${' '.repeat(wName - 6)} | Tipo${' '.repeat(wType - 4)} | Primario | Secundario`;
  console.log(head);
  console.log('-'.repeat(head.length));
  for (const e of config.players) {
    const name = `${e.name}${' '.repeat(wName - e.name.length)}`;
    const type = `${TYPE_LABEL[e.type]}${' '.repeat(wType - TYPE_LABEL[e.type].length)}`;
    console.log(`${name} | ${type} | ${e.primary || '-'}     | ${e.secondary || '-'}`);
  }
}

function cmdSet(args) {
  const configFile = args['--config'] || DEFAULT_CONFIG;
  const config = readJson(configFile, 'Config de colores');
  const name = args._.slice(1).find(a => !a.startsWith('--'));
  if (!name) fail('Falta el nombre: node scripts/player-colors.js set <nombre> [--primary hex] [--secondary hex|none]');

  const entry = config.players.find(e => e.name.toLowerCase() === name.toLowerCase());
  if (!entry) {
    const close = config.players
      .filter(e => e.name.toLowerCase().includes(name.toLowerCase()))
      .map(e => e.name);
    fail(`No existe el jugador "${name}" en la config.${close.length ? ` ¿Quizá: ${close.join(', ')}?` : ' Ejecuta init primero.'}`);
  }

  const changes = [];
  if (args['--primary'] !== undefined) {
    const hex = normHex(args['--primary']);
    if (!hex) fail(`Hex inválido: ${args['--primary']} (formatos: #abc, #aabbcc)`);
    if (entry.primary !== hex) { entry.primary = hex; changes.push(`primario=${hex}`); }
  }
  if (args['--secondary'] !== undefined) {
    if (args['--secondary'] === 'none' || args['--secondary'] === 'auto') {
      if (entry.secondary) { entry.secondary = ''; changes.push('secundario=(vacío)'); }
    } else {
      const hex = normHex(args['--secondary']);
      if (!hex) fail(`Hex inválido: ${args['--secondary']} (formatos: #abc, #aabbcc; usa "none" para vaciar)`);
      if (entry.secondary !== hex) { entry.secondary = hex; changes.push(`secundario=${hex}`); }
    }
  }

  if (!changes.length) {
    console.log(`${entry.name}: sin cambios (primario=${entry.primary || '-'}, secundario=${entry.secondary || '-'})`);
  } else {
    writeJson(configFile, config);
    console.log(`${entry.name}: ${changes.join(', ')}`);
  }
}

function cmdCheck(args) {
  const configFile = args['--config'] || DEFAULT_CONFIG;
  const config = readJson(configFile, 'Config de colores');
  const problems = [];
  const warnings = [];

  const byPrimary = new Map();
  for (const e of config.players) {
    const p = normHex(e.primary);
    if (!e.primary) problems.push(`${e.name}: primario vacío`);
    else if (!p) problems.push(`${e.name}: primario inválido (${e.primary})`);
    else if (e.secondary && !normHex(e.secondary)) problems.push(`${e.name}: secundario inválido (${e.secondary})`);
    if (e.secondary && p === normHex(e.secondary)) problems.push(`${e.name}: primario y secundario son el mismo color`);
    if (p) {
      if (!byPrimary.has(p)) byPrimary.set(p, []);
      byPrimary.get(p).push(e.name);
    }
  }
  for (const [color, names] of byPrimary) {
    if (names.length > 1) {
      const resolution = [...names].sort((a, b) => a.localeCompare(b, 'es'))[0];
      problems.push(`${color} compartido por: ${names.join(', ')} (la app usa el secundario a partir de "${resolution}" por orden alfabético)`);
    }
  }
  const entries = config.players.map(e => ({ name: e.name, p: normHex(e.primary) })).filter(e => e.p);
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      if (entries[i].p === entries[j].p) continue;
      const d = colorDistance(entries[i].p, entries[j].p);
      if (d < 60) warnings.push(`${entries[i].p} (${entries[i].name}) y ${entries[j].p} (${entries[j].name}) son muy parecidos (distancia ${d})`);
    }
  }

  if (!problems.length && !warnings.length) {
    console.log(`OK: ${config.players.length} entradas sin conflictos.`);
    return;
  }
  for (const p of problems) console.log(`CONFLICTO: ${p}`);
  for (const w of warnings) console.log(`AVISO: ${w}`);
  process.exit(problems.length ? 1 : 0);
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--json' || a === '--reseed' || a === '--help' || a === '-h') {
      args[a] = true;
      if (a === '--help' || a === '-h') args.help = true;
    } else if (a === '--data' || a === '--config' || a === '--primary' || a === '--secondary') {
      args[a] = argv[++i];
      if (args[a] === undefined) fail(`Falta valor para ${a}`);
    } else if (a.startsWith('-')) {
      fail(`Opción desconocida: ${a}`);
    } else {
      args._.push(a);
    }
  }
  return args;
}

function usage() {
  console.log(`Uso: node scripts/player-colors.js <comando>

Comandos:
  init [--reseed]             Genera/actualiza src/data/player-colors.json desde heat-data.json
                              (--reseed reasigna todos los primarios con la paleta actual)
  list [--json]               Lista jugadores/bots con su color actual
  set <nombre> [--primary hex] [--secondary hex|none]   Cambia colores
  check                       Detecta conflictos y hex inválidos

Opciones comunes: --data <ruta> (heat-data.json), --config <ruta>`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cmd = args._[0];
  if (!cmd || args.help) {
    usage();
    process.exit(cmd ? 0 : 1);
  }
  switch (cmd) {
    case 'init': return cmdInit(args);
    case 'list': return cmdList(args);
    case 'set': return cmdSet(args);
    case 'check': return cmdCheck(args);
    default: fail(`Comando desconocido: ${cmd}\n` + usage());
  }
}

main();
