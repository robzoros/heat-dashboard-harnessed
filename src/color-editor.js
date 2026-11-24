/* Editor visual de colores de jugadores y bots (src/colors.html).
 *
 * Lee src/data/player-colors.json (jugadores + paleta disponible) y
 * src/data/heat-data.json (roster real, para detectar jugadores nuevos).
 * La resolución de conflictos es la misma que aplica src/app.js:
 *   primario libre -> secundario libre -> siguiente color libre de la paleta -> gris
 * recorriendo los jugadores en orden alfabético (estable al filtrar).
 *
 * No guarda en el servidor (GitHub Pages es estático): genera el JSON con
 * "Descargar" para reemplazar src/data/player-colors.json en el repositorio.
 */
(function () {
    'use strict';

    const TYPE_LABEL = { main: 'Principal', other: 'Otro', bot: 'Bot' };
    const TYPE_LABEL_PLURAL = { main: 'Principales', other: 'Otros', bot: 'Bots' };
    const TYPE_ORDER = ['main', 'other', 'bot'];

    // Solo se usa si player-colors.json no trae "palette" (config antigua).
    // Los 12 colores de los bots del juego Heat adaptados al tema «Asfalto y
    // brasa»; la misma lista que SEED_PALETTE de scripts/player-colors.js.
    const FALLBACK_PALETTE = [
        '#d62828', '#2563eb', '#eab308', '#ec4899', '#06b6d4', '#1a9e50',
        '#c084fc', '#f97316', '#c3cbd5', '#f3f4f6', '#b98a2e', '#64748b'
    ];

    // Nombres oficiales de la paleta (Rojo, Azul...); por si la config no
    // los trae, los del FALLBACK_PALETTE en el mismo orden.
    const FALLBACK_PALETTE_NAMES = [
        'Rojo', 'Azul', 'Amarillo', 'Rosa', 'Cian', 'Verde',
        'Morado', 'Naranja', 'Plata', 'Blanco', 'Marrón', 'Negro'
    ];

    const state = {
        config: null,       // copia editable
        originalJson: '',   // JSON serializado al cargar (para "descartar")
        roster: [],         // nombres reales de heat-data.json
        openEditor: null,   // { name, slot }
        filterType: 'all',
        search: '',
        statusTimer: null
    };

    const el = (id) => document.getElementById(id);

    /* ── utilidades de color ─────────────────────────────────────────────── */

    function normHex(hex) {
        if (typeof hex !== 'string') return '';
        let h = hex.trim().toLowerCase();
        if (!h) return '';
        if (!h.startsWith('#')) h = '#' + h;
        if (/^#[0-9a-f]{6}$/.test(h)) return h;
        if (/^#[0-9a-f]{3}$/.test(h)) return '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
        return '';
    }

    function rgb(hex) {
        return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    }

    function distance(a, b) {
        const pa = rgb(a);
        const pb = rgb(b);
        return pa.reduce((sum, v, i) => sum + Math.abs(v - pb[i]), 0);
    }

    function mutedColor() {
        const value = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
        return normHex(value) || '#9aa2c0';
    }

    function palette() {
        const fromConfig = state.config && Array.isArray(state.config.palette) ? state.config.palette : null;
        const list = fromConfig && fromConfig.length ? fromConfig : FALLBACK_PALETTE;
        return list.map(normHex).filter(Boolean);
    }

    // Nombre oficial de cada color de palette() (Rojo, Azul...), si la config
    // trae paletteNames; vacío si el color no está en la lista.
    function paletteNames() {
        const names = state.config && Array.isArray(state.config.paletteNames)
            ? state.config.paletteNames
            : FALLBACK_PALETTE_NAMES;
        const fromConfig = state.config && Array.isArray(state.config.palette)
            ? state.config.palette.map(normHex).filter(Boolean)
            : FALLBACK_PALETTE;
        return palette().map((hex) => {
            const idx = fromConfig.indexOf(hex);
            return idx >= 0 ? (names[idx] || '') : '';
        });
    }

    function entries() {
        return state.config ? state.config.players : [];
    }

    function findEntry(name) {
        return entries().find((e) => e.name === name) || null;
    }

    /* ── resolución de conflictos (idéntica a src/app.js) ────────────────── */

    function resolveColors() {
        const used = new Map();   // color -> nombre que lo usa
        const result = new Map();
        // Igual que buildColorMap de src/app.js: principales primero
        // (main -> other -> bot, alfabético dentro de cada grupo).
        const sorted = entries().slice().sort((a, b) =>
            (TYPE_ORDER.indexOf(a.type) + 1 || 1) - (TYPE_ORDER.indexOf(b.type) + 1 || 1)
            || a.name.localeCompare(b.name));

        for (const entry of sorted) {
            const primary = normHex(entry.primary);
            const secondary = normHex(entry.secondary);
            let color;
            let source;
            let blockedBy = '';

            if (primary && !used.has(primary)) {
                color = primary;
                source = 'primary';
            } else if (secondary && !used.has(secondary)) {
                color = secondary;
                source = 'secondary';
                blockedBy = primary ? used.get(primary) || '' : '';
            } else {
                const free = palette().find((c) => !used.has(c));
                color = free || primary || secondary || mutedColor();
                source = free ? 'palette' : (primary || secondary) ? 'reused' : 'fallback';
                blockedBy = primary ? used.get(primary) || '' : '';
            }

            used.set(color, entry.name);
            result.set(entry.name, { color, source, blockedBy });
        }
        return result;
    }

    /* ── estado de la interfaz ───────────────────────────────────────────── */

    function outputJson() {
        return {
            version: 1,
            generatedFrom: state.config.generatedFrom || 'src/data/heat-data.json',
            palette: palette(),
            paletteNames: paletteNames(),
            players: entries().map((e) => ({
                name: e.name,
                type: e.type,
                primary: normHex(e.primary) || '',
                secondary: normHex(e.secondary) || ''
            }))
        };
    }

    function isDirty() {
        return JSON.stringify(outputJson()) !== state.originalJson;
    }

    function setStatus(message, kind) {
        const node = el('colors-status');
        node.textContent = message || '';
        node.dataset.kind = kind || '';
        if (state.statusTimer) clearTimeout(state.statusTimer);
        if (message) {
            state.statusTimer = setTimeout(() => {
                node.textContent = '';
                node.dataset.kind = '';
            }, 6000);
        }
    }

    function markDirty() {
        const dirty = isDirty();
        el('btn-reset').disabled = !dirty;
        const badge = el('dirty-badge');
        badge.hidden = !dirty;
        document.title = (dirty ? '• ' : '') + 'Colores — Heat Dashboard';
    }

    /* ── render ──────────────────────────────────────────────────────────── */

    function paletteUsage() {
        const usage = new Map();
        for (const entry of entries()) {
            const primary = normHex(entry.primary);
            if (!primary) continue;
            if (!usage.has(primary)) usage.set(primary, []);
            usage.get(primary).push(entry.name);
        }
        return usage;
    }

    // Entradas que usan cada color como secundario (para no mostrar "libre"
    // en un color que ya está reservado como alternativa).
    function secondaryUsage() {
        const usage = new Map();
        for (const entry of entries()) {
            const secondary = normHex(entry.secondary);
            if (!secondary) continue;
            if (!usage.has(secondary)) usage.set(secondary, []);
            usage.get(secondary).push(entry.name);
        }
        return usage;
    }

    function renderPaletteStrip() {
        const usage = paletteUsage();
        const secondaryUsers = secondaryUsage();
        const names = paletteNames();
        const container = el('palette-strip');
        const counter = el('palette-count');
        if (counter) counter.textContent = String(palette().length);
        container.innerHTML = palette().map((hex, i) => {
            const label = names[i] || '';
            const primaries = usage.get(hex) || [];
            const secondaries = secondaryUsers.get(hex) || [];
            const parts = [];
            if (primaries.length) parts.push(`${primaries.length} prim.`);
            if (secondaries.length) parts.push(`${secondaries.length} sec.`);
            const use = primaries.length
                ? `primario de ${primaries.join(', ')}`
                : secondaries.length ? `secundario de ${secondaries.join(', ')}` : 'libre';
            const full = label ? `${label} (${hex}): ${use}` : `${hex}: ${use}`;
            return `
                <button type="button" class="palette-swatch" data-copy-hex="${hex}"
                        title="Copiar ${hex}${label ? ` (${label})` : ''} (${use})"
                        aria-label="Color ${hex}${label ? `, ${label}` : ''}, ${use}">
                    <span class="palette-chip" style="--c:${hex}"></span>
                    <span class="palette-hex">${hex}</span>
                    <span class="palette-name">${escapeHtml(label)}</span>
                    <span class="palette-use ${parts.length ? 'taken' : 'free'}">${parts.length ? parts.join(' · ') : 'libre'}</span>
                </button>
            `;
        }).join('');
    }

    function rowTemplate(entry, resolved) {
        const finalColor = resolved.color;
        const isFallback = resolved.source === 'palette' || resolved.source === 'reused' || resolved.source === 'fallback';
        const primary = normHex(entry.primary);
        const secondary = normHex(entry.secondary);
        const inRoster = !state.roster.length || state.roster.includes(entry.name);

        let finalNote;
        if (resolved.source === 'primary') {
            finalNote = '<span class="src src-primary">primario</span>';
        } else if (resolved.source === 'secondary') {
            finalNote = `<span class="src src-secondary">secundario · primario ocupado por ${escapeHtml(resolved.blockedBy || 'otro')}</span>`;
        } else if (resolved.source === 'palette') {
            finalNote = `<span class="src src-palette">paleta libre · primario ocupado por ${escapeHtml(resolved.blockedBy || 'otro')}</span>`;
        } else if (resolved.source === 'reused') {
            finalNote = `<span class="src src-reused">repite su primario (paleta agotada · ocupado por ${escapeHtml(resolved.blockedBy || 'otro')})</span>`;
        } else {
            finalNote = '<span class="src src-fallback">sin color libre (gris)</span>';
        }

        const open = state.openEditor && state.openEditor.name === entry.name ? state.openEditor.slot : '';

        return `
            <article class="color-row ${isFallback ? 'has-conflict' : ''}" data-name="${escapeAttr(entry.name)}">
                <span class="row-chip" style="--c:${finalColor}" title="Color final: ${finalColor}" aria-hidden="true"></span>
                <div class="row-id">
                    <strong>${escapeHtml(entry.name)}</strong>
                    <span class="type-badge type-${entry.type}">${TYPE_LABEL[entry.type] || entry.type}</span>
                    ${inRoster ? '' : '<span class="type-badge type-missing" title="No está en heat-data.json">nuevo</span>'}
                </div>
                <div class="row-slots">
                    <button type="button" class="slot ${primary ? '' : 'slot-empty'}" data-name="${escapeAttr(entry.name)}" data-slot="primary"
                            aria-expanded="${open === 'primary'}"
                            aria-label="Color primario de ${escapeAttr(entry.name)}: ${primary || 'sin asignar'}">
                        <span class="slot-chip" style="--c:${primary || 'transparent'}"></span>
                        <span class="slot-label">Primario</span>
                        <span class="slot-hex">${primary || 'sin asignar'}</span>
                    </button>
                    <button type="button" class="slot ${secondary ? '' : 'slot-empty'}" data-name="${escapeAttr(entry.name)}" data-slot="secondary"
                            aria-expanded="${open === 'secondary'}"
                            aria-label="Color secundario de ${escapeAttr(entry.name)}: ${secondary || 'sin asignar'}">
                        <span class="slot-chip" style="--c:${secondary || 'transparent'}"></span>
                        <span class="slot-label">Secundario</span>
                        <span class="slot-hex">${secondary || 'vacío'}</span>
                    </button>
                </div>
                <p class="row-final">
                    <span class="row-final-chip" style="--c:${finalColor}"></span>
                    <span class="row-final-text">En la web usa <strong>${finalColor}</strong></span>
                    ${finalNote}
                </p>
                ${open ? slotEditorTemplate(entry, open) : '<div class="slot-editor-slot"></div>'}
            </article>
        `;
    }

    function slotEditorTemplate(entry, slot) {
        const current = normHex(slot === 'primary' ? entry.primary : entry.secondary);
        const usage = paletteUsage();
        const names = paletteNames();
        const swatches = palette().map((hex, i) => {
            const label = names[i] || '';
            const users = (usage.get(hex) || []).filter((n) => n !== entry.name);
            const taken = users.length ? users.join(', ') : '';
            const withName = label ? `${label} ${hex}` : hex;
            return `
                <button type="button" class="swatch ${hex === current ? 'selected' : ''}" data-pick-hex="${hex}"
                        data-name="${escapeAttr(entry.name)}" data-slot="${slot}"
                        aria-pressed="${hex === current}"
                        aria-label="Usar ${withName} en ${escapeAttr(entry.name)}${taken ? ' (lo usa ' + taken + ')' : ''}">
                    <span class="swatch-chip" style="--c:${hex}"></span>
                    <span class="swatch-hex">${withName}</span>
                    ${taken ? `<span class="swatch-taken">${escapeHtml(taken)}</span>` : '<span class="swatch-taken free">libre</span>'}
                </button>
            `;
        }).join('');

        return `
            <div class="slot-editor" data-editor="${slot}">
                <div class="slot-editor-head">
                    <strong>${slot === 'primary' ? 'Color primario' : 'Color secundario'} de ${escapeHtml(entry.name)}</strong>
                    <span class="hint-inline">Los principales resuelven antes que los bots; si no queda color libre en la paleta, se reutiliza el primario del grupo.</span>
                    <button type="button" class="mini-btn" data-close-editor="1">Cerrar</button>
                </div>
                <div class="swatch-grid">${swatches}</div>
                <div class="slot-editor-foot">
                    <label class="custom-hex">
                        Otro color:
                        <input type="text" class="hex-input" data-name="${escapeAttr(entry.name)}" data-slot="${slot}"
                               value="${current || ''}" placeholder="#rrggbb" spellcheck="false" autocomplete="off">
                    </label>
                    <button type="button" class="mini-btn" data-apply-hex="1" data-name="${escapeAttr(entry.name)}" data-slot="${slot}">Aplicar hex</button>
                    <button type="button" class="mini-btn" data-clear-slot="1" data-name="${escapeAttr(entry.name)}" data-slot="${slot}">Vaciar ${slot === 'primary' ? 'primario' : 'secundario'}</button>
                </div>
            </div>
        `;
    }

    function visibleEntries() {
        const search = state.search.trim().toLowerCase();
        return entries().filter((entry) => {
            if (state.filterType !== 'all' && entry.type !== state.filterType) return false;
            if (search && !entry.name.toLowerCase().includes(search)) return false;
            return true;
        });
    }

    function renderGroups() {
        const resolved = resolveColors();
        const visible = visibleEntries();
        const container = el('color-groups');

        if (!visible.length) {
            container.innerHTML = '<p class="empty-state">Ningún jugador coincide con el filtro.</p>';
            return;
        }

        container.innerHTML = TYPE_ORDER.map((type) => {
            const group = visible.filter((entry) => entry.type === type);
            if (!group.length) return '';
            return `
                <section class="color-card color-group" aria-labelledby="group-${type}">
                    <h2 id="group-${type}">${TYPE_LABEL_PLURAL[type] || TYPE_LABEL[type]} <span class="group-count">${group.length}</span></h2>
                    <div class="color-rows">
                        ${group.map((entry) => rowTemplate(entry, resolved.get(entry.name))).join('')}
                    </div>
                </section>
            `;
        }).join('');
    }

    function renderIssues() {
        const resolved = resolveColors();
        const problems = [];

        for (const entry of entries().slice().sort((a, b) => a.name.localeCompare(b.name))) {
            const primary = normHex(entry.primary);
            const secondary = normHex(entry.secondary);
            const info = resolved.get(entry.name);

            if (!entry.primary) problems.push({ name: entry.name, text: 'sin color primario asignado' });
            else if (!primary) problems.push({ name: entry.name, text: `primario inválido (${entry.primary})` });
            if (entry.secondary && !secondary) problems.push({ name: entry.name, text: `secundario inválido (${entry.secondary})` });
            if (primary && secondary && primary === secondary) problems.push({ name: entry.name, text: 'primario y secundario son el mismo color' });
            if (info && info.source === 'secondary') {
                problems.push({ name: entry.name, text: `su primario ${primary} ya lo usa ${info.blockedBy}; se mostrará con el secundario ${info.color}` });
            }
            if (info && info.source === 'palette') {
                problems.push({ name: entry.name, text: `primario y secundario ocupados; se mostrará con ${info.color} (primer color libre)` });
            }
            if (info && info.source === 'reused') {
                problems.push({ name: entry.name, text: `primario y secundario ocupados; repite ${info.color} (paleta agotada)` });
            }
            if (info && info.source === 'fallback') {
                problems.push({ name: entry.name, text: 'sin color disponible: se mostrará en gris' });
            }
        }

        const duplicates = new Map();
        for (const entry of entries()) {
            const primary = normHex(entry.primary);
            if (!primary) continue;
            if (!duplicates.has(primary)) duplicates.set(primary, []);
            duplicates.get(primary).push(entry.name);
        }
        for (const [hex, names] of duplicates) {
            if (names.length < 2) continue;
            problems.push({ name: names.join(' / '), text: `${hex} está asignado a ${names.length} entradas` });
        }

        const card = el('issues-card');
        card.hidden = problems.length === 0;
        el('issues-count').textContent = String(problems.length);
        el('issues-list').innerHTML = problems
            .map((p) => `<li><strong>${escapeHtml(p.name)}</strong>: ${escapeHtml(p.text)}</li>`)
            .join('');
    }

    function renderPreview() {
        const resolved = resolveColors();
        const ordered = entries().slice().sort((a, b) => {
            const order = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
            return order !== 0 ? order : a.name.localeCompare(b.name);
        });
        const height = { main: 100, other: 72, bot: 48 };

        el('color-preview').innerHTML = ordered.map((entry) => {
            const info = resolved.get(entry.name);
            return `
                <div class="preview-item" data-preview-name="${escapeAttr(entry.name)}" title="${escapeAttr(entry.name)} — ${info.color}">
                    <div class="preview-bar" style="--c:${info.color};--h:${height[entry.type] || 60}%"></div>
                    <span class="preview-hex">${info.color}</span>
                    <span class="preview-name">${escapeHtml(entry.name)}</span>
                </div>
            `;
        }).join('');
    }

    function render() {
        renderPaletteStrip();
        renderGroups();
        renderIssues();
        renderPreview();
        markDirty();
    }

    /* ── acciones ────────────────────────────────────────────────────────── */

    function setColor(name, slot, hex) {
        const entry = findEntry(name);
        if (!entry) return;
        entry[slot] = normHex(hex);
        setStatus(`${name}: ${slot === 'primary' ? 'primario' : 'secundario'} = ${entry[slot] || 'vacío'}`, 'ok');
        render();
    }

    function clearColor(name, slot) {
        const entry = findEntry(name);
        if (!entry) return;
        entry[slot] = '';
        setStatus(`${name}: ${slot === 'primary' ? 'primario' : 'secundario'} vaciado`, 'ok');
        render();
    }

    function downloadJson() {
        const json = JSON.stringify(outputJson(), null, 2) + '\n';
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'player-colors.json';
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        setStatus('Descargado player-colors.json. Reemplaza src/data/player-colors.json en el repositorio.', 'ok');
    }

    async function copyJson() {
        const json = JSON.stringify(outputJson(), null, 2);
        try {
            await navigator.clipboard.writeText(json);
            setStatus('JSON copiado al portapapeles', 'ok');
        } catch (e) {
            setStatus('No se pudo copiar al portapapeles; usa Descargar', 'error');
        }
    }

    function resetChanges() {
        state.config = JSON.parse(state.originalJson);
        state.openEditor = null;
        setStatus('Cambios descartados', 'ok');
        render();
    }

    async function copyPaletteHex(hex) {
        try {
            await navigator.clipboard.writeText(hex);
            setStatus(`${hex} copiado`, 'ok');
        } catch (e) {
            setStatus(`${hex} (no se pudo copiar automáticamente)`, '');
        }
    }

    /* ── eventos ─────────────────────────────────────────────────────────── */

    function bindEvents() {
        document.addEventListener('click', (event) => {
            const target = event.target;

            const slotBtn = target.closest('.slot');
            if (slotBtn) {
                const name = slotBtn.dataset.name;
                const slot = slotBtn.dataset.slot;
                const same = state.openEditor && state.openEditor.name === name && state.openEditor.slot === slot;
                state.openEditor = same ? null : { name, slot };
                render();
                return;
            }

            const pick = target.closest('[data-pick-hex]');
            if (pick) {
                setColor(pick.dataset.name, pick.dataset.slot, pick.dataset.pickHex);
                state.openEditor = null;
                render();
                return;
            }

            if (target.closest('[data-close-editor]')) {
                state.openEditor = null;
                render();
                return;
            }

            const applyBtn = target.closest('[data-apply-hex]');
            if (applyBtn) {
                const name = applyBtn.dataset.name;
                const slot = applyBtn.dataset.slot;
                const input = document.querySelector(`.hex-input[data-name="${cssEscape(name)}"][data-slot="${slot}"]`);
                const hex = normHex(input ? input.value : '');
                if (!hex) {
                    setStatus(`Hex inválido: ${input ? input.value : ''} (usa #rgb o #rrggbb)`, 'error');
                    return;
                }
                setColor(name, slot, hex);
                return;
            }

            const clearBtn = target.closest('[data-clear-slot]');
            if (clearBtn) {
                clearColor(clearBtn.dataset.name, clearBtn.dataset.slot);
                return;
            }

            const copyBtn = target.closest('[data-copy-hex]');
            if (copyBtn) {
                copyPaletteHex(copyBtn.dataset.copyHex);
                return;
            }

            const typeBtn = target.closest('[data-type]');
            if (typeBtn) {
                state.filterType = typeBtn.dataset.type;
                document.querySelectorAll('[data-type]').forEach((btn) => {
                    const active = btn.dataset.type === state.filterType;
                    btn.classList.toggle('active', active);
                    btn.setAttribute('aria-pressed', String(active));
                });
                state.openEditor = null;
                renderGroups();
                return;
            }
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && state.openEditor) {
                state.openEditor = null;
                render();
            }
            if (event.key === 'Enter' && event.target.classList && event.target.classList.contains('hex-input')) {
                event.preventDefault();
                const input = event.target;
                const hex = normHex(input.value);
                if (!hex) {
                    setStatus(`Hex inválido: ${input.value}`, 'error');
                    return;
                }
                setColor(input.dataset.name, input.dataset.slot, hex);
            }
        });

        el('colors-search').addEventListener('input', (event) => {
            state.search = event.target.value;
            state.openEditor = null;
            renderGroups();
        });

        el('btn-download').addEventListener('click', downloadJson);
        el('btn-copy').addEventListener('click', copyJson);
        el('btn-reset').addEventListener('click', resetChanges);
    }

    /* ── helpers de escape ───────────────────────────────────────────────── */

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function escapeAttr(value) {
        return escapeHtml(value);
    }

    function cssEscape(value) {
        return String(value).replace(/["\\]/g, '\\$&');
    }

    /* ── arranque ────────────────────────────────────────────────────────── */

    async function loadConfig() {
        const response = await fetch('./data/player-colors.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status} al cargar player-colors.json`);
        const config = await response.json();
        if (!config || !Array.isArray(config.players)) throw new Error('player-colors.json no tiene la lista "players"');
        return config;
    }

    async function loadRoster() {
        try {
            const response = await fetch('./data/heat-data.json', { cache: 'no-store' });
            if (!response.ok) return [];
            const data = await response.json();
            return Array.isArray(data.players) ? data.players.map((p) => p.name) : [];
        } catch (e) {
            return [];
        }
    }

    async function init() {
        bindEvents();
        try {
            const [config, roster] = await Promise.all([loadConfig(), loadRoster()]);
            state.config = config;
            state.originalJson = JSON.stringify(outputJson());
            state.roster = roster;
            render();
            setStatus(`${entries().length} jugadores y bots cargados · ${palette().length} colores disponibles`, 'ok');
        } catch (error) {
            console.error(error);
            el('color-groups').innerHTML = `<p class="empty-state error">No se pudo cargar la configuración: ${escapeHtml(error.message)}</p>`;
            setStatus('Error al cargar player-colors.json', 'error');
        }
    }

    // Superficie para los tests E2E (y depuración desde la consola).
    window.ColorEditor = {
        state,
        init,
        resolveColors,
        outputJson,
        setColor,
        clearColor,
        isDirty,
        palette
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
