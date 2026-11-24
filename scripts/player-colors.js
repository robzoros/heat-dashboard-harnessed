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

// Paleta de siembra: los 12 colores de los bots del juego Heat (Rojo, Azul,
// Verde, Amarillo, Negro, Plata, Naranja, Morado, Blanco, Rosa, Marrón y Cian),
// adaptados al tema «Asfalto y brasa»: los tonos puros de Negro (#1F2937), Azul
// (#1D4ED8) y Morado (#7E22CE) no llegan al contraste 3:1 sobre los fondos
// oscuros del tema, y Rojo/Marrón y Azul/Morado se confunden con daltonismo
// (verificado con scripts/validate-palette.js: ΔE >= 12 normal, >= 10 CVD).
const SEED_PALETTE = [
  '#d62828', '#2563eb', '#eab308', '#ec4899', '#06b6d4', '#1a9e50',
  '#c084fc', '#f97316', '#c3cbd5', '#f3f4f6', '#b98a2e', '#64748b'
];

// Nombre del color oficial de cada entrada de SEED_PALETTE (etiquetas del editor
// y comandos list/save). Rojo #d62828, Plata #c3cbd5 (el plata puro #9CA3AF no
// llega al contraste), Blanco con borde distinto como en el juego, etc.
const SEED_PALETTE_NAMES = [
  'Rojo', 'Azul', 'Amarillo', 'Rosa', 'Cian', 'Verde',
  'Morado', 'Naranja', 'Plata', 'Blanco', 'Marrón', 'Negro'
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

/** Hex de SEED_PALETTE -> nombre oficial (Rojo, Azul...). */
function paletteNameOf(hex) {
  const idx = SEED_PALETTE.indexOf(hex);
  return idx >= 0 ? SEED_PALETTE_NAMES[idx] : '';
}

/** Reparto de primarios del reseed: los jugadores van en orden (principales,
 *  otros, bots — el mismo orden de playersFromData) y se les asigna
 *  SEED_PALETTE[i % 12]. Los principales reciben así los 8 primeros colores
 *  (el grupo estricto del validador) y los bots reparten los 12, repitiendo
 *  color cuando se acaban (la app reutiliza el primario del grupo, nunca
 *  grisea, y los principales resuelven antes que los bots).
 *  Los secundarios quedan vacíos: los asigna el usuario a mano si quiere
 *  distinguir dos bots que comparten color y hay colores libres. */
function assignSeedPairs(players) {
  return players.map((p, i) => ({
    ...p,
    primary: SEED_PALETTE[i % SEED_PALETTE.length],
    secondary: ''
  }));
}

function cmdInit(args) {
  const dataFile = args['--data'] || DEFAULT_DATA;
  const configFile = args['--config'] || DEFAULT_CONFIG;
  const data = readJson(dataFile, 'JSON de datos');
  const config = loadConfigOrEmpty(configFile);
  const prevByName = new Map(config.players.map(e => [e.name, e]));

  const players = playersFromData(data);
  const result = [];
  const entries = [];
  const added = [];
  const reseeded = [];
  if (args['--reseed']) {
    // Una sola pasada: todos reasignados con la paleta de 12 (primarios
    // en ciclo, ver assignSeedPairs).
    for (const p of players) {
      const prev = prevByName.get(p.name);
      prevByName.delete(p.name);
      entries.push({ name: p.name, type: p.type, _line: prev ? 'reseeded' : 'added' });
    }
  } else {
    for (const p of players) {
      const prev = prevByName.get(p.name);
      prevByName.delete(p.name);
      if (prev) {
        result.push({ name: p.name, type: p.type, primary: prev.primary || '', secondary: prev.secondary || '' });
      } else {
        entries.push({ name: p.name, type: p.type, _line: 'added' });
        added.push(p.name);
      }
    }
  }
  const assigned = assignSeedPairs(entries);
  for (const e of assigned) {
    result.push({ name: e.name, type: e.type, primary: e.primary, secondary: e.secondary });
    const line = `${e.name} -> ${e.primary}`;
    if (e._line === 'added') added.push(line);
    if (e._line === 'reseeded') reseeded.push(line);
  }

  const dropped = [...prevByName.keys()];
  const out = {
    version: 1,
    generatedFrom: path.relative(ROOT, dataFile).replace(/\\/g, '/'),
    // Paleta de colores disponibles (los 12 oficiales del juego) con sus
    // nombres: la usa el editor visual (src/colors.html) y sirve de
    // reserva a la app cuando primario y secundario están ocupados.
    palette: SEED_PALETTE,
    paletteNames: SEED_PALETTE_NAMES,
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
    const pname = paletteNameOf(e.primary);
    const sname = paletteNameOf(e.secondary);
    const primary = `${e.primary || '-'}${pname ? ` (${pname})` : ''}`;
    const secondary = `${e.secondary || '-'}${sname ? ` (${sname})` : ''}`;
    console.log(`${name} | ${type} | ${primary} | ${secondary}`);
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
      // La app reparte primero a los principales (main -> other -> bot) y
      // reutiliza el primario cuando la paleta se agota: compartir color es
      // esperable con 20 entradas y 12 colores; solo avisa.
      const group = config.players.filter(e => names.includes(e.name));
      const types = group.map(e => TYPE_LABEL[e.type]);
      warnings.push(`${color} (${paletteNameOf(color) || 'sin nombre'}) compartido por: ${names.join(', ')} (${types.join(', ')})`);
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
