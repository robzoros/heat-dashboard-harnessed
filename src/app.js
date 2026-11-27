const App = {
    data: {
        players: [],
        locations: [],
        plays: [],
        boards: []
    },
    filters: {
        active: true,
        players: [],
        playerMode: 'any',
        tracks: [],
        locations: []
    },
    charts: {},
    championships: {
        list: [],
        selected: null
    },
    bggUsername: null,
    firebaseApp: null,
    firebaseAuth: null,
    firebaseDb: null,
    firebaseUser: null,
    firebaseEnabled: false,
    championshipsUnsubscribe: null,

    // Fallback de color: paleta «Asfalto y brasa» validada con
    // scripts/validate-palette.js (contraste >= 3:1 sobre #14110f y #1d1916 y
    // separación ΔE en visión normal, deuteranopia y protanopia). La fuente de
    // verdad de los colores de jugadores y bots es src/data/player-colors.json
    // (scripts/player-colors.js); esta paleta solo se usa si un jugador no
    // tiene entrada en la config o el config está agotado.
    // Paleta de reserva con los 12 colores de los bots del juego Heat (los mismos
// de src/data/player-colors.json, scripts/player-colors.js) adaptados al tema
// «Asfalto y brasa»: los tonos puros de Negro, Azul y Morado no llegan al
// contraste 3:1 y Rojo/Marrón y Azul/Morado se confundían con daltonismo
// (scripts/validate-palette.js). Los 8 primeros son los de los jugadores
// principales. Esta paleta solo se usa si un jugador no tiene entrada en la
// config o el config está agotado; la fuente de verdad es player-colors.json.
PLAYER_PALETTE: ['#d62828', '#2563eb', '#eab308', '#ec4899', '#06b6d4', '#1a9e50', '#c084fc', '#f97316'],

    // Config de colores cargada de ./data/player-colors.json (null si falla).
    colorConfig: null,
    // Mapa nombre -> color resuelto, recalculado al cargar/cambiar datos.
    colorMap: null,

    cssVar(name) {
        return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    },

    normHex(hex) {
        if (typeof hex !== 'string') return '';
        let h = hex.trim().toLowerCase();
        if (!h.startsWith('#')) h = `#${h}`;
        if (/^#[0-9a-f]{6}$/.test(h)) return h;
        if (/^#[0-9a-f]{3}$/.test(h)) return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
        return '';
    },

    // Descarga la config de colores; fallo suave (queda null y se usa el fallback).
    async loadColorConfig() {
        this.colorConfig = null;
        try {
            const response = await fetch('./data/player-colors.json', { cache: 'no-store' });
            if (!response.ok) return;
            const config = await response.json();
            if (config && Array.isArray(config.players)) this.colorConfig = config;
        } catch (e) {
            console.warn('No se pudo cargar player-colors.json; usando paleta por defecto', e);
        }
    },

    // Paleta de colores libres: la de la config (campo palette, la misma que
    // muestra el editor visual) y, si falta, la paleta validada de reserva.
    colorPalette() {
        const fromConfig = this.colorConfig && Array.isArray(this.colorConfig.palette)
            ? this.colorConfig.palette.map(c => this.normHex(c)).filter(Boolean)
            : [];
        return fromConfig.length ? fromConfig : this.PLAYER_PALETTE.map(c => this.normHex(c)).filter(Boolean);
    },

    // Resuelve colors de la config: primario; si otro jugador ya lo usa, el
    // secundario; si ambos están cogidos, siguiente color libre de la paleta;
    // si no hay ninguno libre, reutiliza su primario (los bots reparten 12
    // colores entre 20 y comparten con su jugador principal); y si no tiene
    // primario válido, gris. Se recorre principales primero (main -> other
    // -> bot, alfabético dentro de cada grupo) para que el color elegido por
    // un jugador principal no lo pise un bot y el resultado no cambie al
    // filtrar.
    buildColorMap() {
        if (!this.colorConfig || !this.data || !Array.isArray(this.data.players)) {
            this.colorMap = null;
            return;
        }
        const dataNames = new Set(this.data.players.map(p => p.name));
        const typeRank = { main: 0, other: 1, bot: 2 };
        const entries = this.colorConfig.players
            .filter(e => e && e.name && dataNames.has(e.name))
            .slice()
            .sort((a, b) =>
                (typeRank[a.type] ?? 1) - (typeRank[b.type] ?? 1)
                || a.name.localeCompare(b.name));
        const free = this.colorPalette();
        const used = new Set();
        const map = new Map();
        for (const e of entries) {
            const primary = this.normHex(e.primary);
            const secondary = this.normHex(e.secondary);
            let color = primary && !used.has(primary) ? primary
                : secondary && !used.has(secondary) ? secondary
                : free.find(c => !used.has(c))
                || (primary || secondary)
                || this.cssVar('--text-muted');
            used.add(color);
            map.set(e.name, color);
        }
        this.colorMap = map;
    },

    playerColor(name) {
        if (this.colorMap && this.colorMap.has(name)) return this.colorMap.get(name);
        // Fallback histórico: paleta por orden alfabético de principales, resto gris.
        const names = this.data.players
            .filter(p => p.isMain)
            .map(p => p.name)
            .sort((a, b) => a.localeCompare(b));
        const idx = names.indexOf(name);
        return idx >= 0 && idx < this.PLAYER_PALETTE.length
            ? this.PLAYER_PALETTE[idx]
            : this.cssVar('--text-muted');
    },

    // Escribe el valor al final de cada barra (solo en gráficos con pocas barras).
    valueLabelsPlugin: {
        id: 'valueLabels',
        afterDatasetsDraw(chart, args, opts) {
            if (!opts || !opts.enabled) return;
            const ctx = chart.ctx;
            const horizontal = chart.options.indexAxis === 'y';
            ctx.save();
            ctx.font = `600 12px ${opts.font}`;
            ctx.fillStyle = opts.color;
            ctx.textBaseline = 'middle';
            chart.getDatasetMeta(0).data.forEach((bar, i) => {
                const value = chart.data.datasets[0].data[i];
                if (value === null || value === undefined) return;
                const text = opts.format ? opts.format(value) : String(value);
                if (horizontal) {
                    ctx.textAlign = 'left';
                    ctx.fillText(text, bar.x + 6, bar.y);
                } else {
                    ctx.textAlign = 'center';
                    ctx.fillText(text, bar.x, bar.y - 10);
                }
            });
            ctx.restore();
        }
    },

    init() {
        this.selectedTrack = null;
        this.setupTabs();
        this.setupFilters();
        this.setupTrackList();
        this.setupModal();
        this.setupRaceModal();
        this.setupChampionships();
        this.setupPlayerManager();
        this.setupAdminAuth();
        this.setupCookieConsent();
        this.initFirebase();
        this.initCharts();
        this.updateHeaderStats();
        this.loadStaticData();
    },

    setupTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
            });
        });
    },

    setupFilters() {
        document.getElementById('btn-toggle-filters').addEventListener('click', () => {
            const panel = document.getElementById('filter-panel');
            panel.classList.toggle('collapsed');
            document.body.classList.toggle('panel-open', !panel.classList.contains('collapsed'));
        });

        document.getElementById('filter-active').addEventListener('change', (e) => {
            this.filters.active = e.target.checked;
            this.updateHeaderStats();
            this.renderAll();
        });

        document.getElementById('player-filter-mode').addEventListener('change', (e) => {
            this.filters.playerMode = e.target.value;
        });

        document.getElementById('btn-apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });
    },

    loadFirebaseScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async loadFirebaseSdk() {
        if (window.firebase) return;
        const base = 'https://www.gstatic.com/firebasejs/10.14.1/';
        await this.loadFirebaseScript(`${base}firebase-app-compat.js`);
        await this.loadFirebaseScript(`${base}firebase-auth-compat.js`);
        await this.loadFirebaseScript(`${base}firebase-firestore-compat.js`);
    },

    async initFirebase() {
        const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        if (isLocal || !window.FIREBASE_CONFIG) {
            this.firebaseEnabled = false;
            this.renderAdminStatus();
            return;
        }
        try {
            await this.loadFirebaseSdk();
            this.firebaseApp = window.firebase.initializeApp(window.FIREBASE_CONFIG);
            this.firebaseAuth = window.firebase.auth();
            this.firebaseDb = window.firebase.firestore();
            this.firebaseEnabled = true;
            this.firebaseAuth.onAuthStateChanged(user => {
                this.firebaseUser = user;
                this.bggUsername = user && user.uid === window.FIREBASE_ADMIN_UID ? user.email : null;
                this.renderAdminStatus();
                if (this.data && this.data.players) this.renderAll();
            });
            if (this.data && this.data.players) this.loadChampionships();
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            this.firebaseEnabled = false;
        }
        this.renderAdminStatus();
    },

    isAdmin() {
        return this.bggUsername === 'local' || (this.firebaseUser && this.firebaseUser.uid === window.FIREBASE_ADMIN_UID);
    },

    renderAdminStatus() {
        const status = document.getElementById('admin-status');
        const loginButton = document.getElementById('btn-admin-login');
        const logoutButton = document.getElementById('btn-admin-logout');
        const createButton = document.getElementById('btn-create-campeonato');
        if (!status || !loginButton || !logoutButton) return;
        const admin = this.isAdmin();
        status.textContent = admin ? 'Administrador conectado' : 'Modo lectura';
        loginButton.classList.toggle('hidden', admin && this.firebaseEnabled);
        logoutButton.disabled = !admin;
        if (createButton) createButton.disabled = !admin;
    },

    setupAdminAuth() {
        const modal = document.getElementById('admin-login-modal');
        const errorEl = document.getElementById('admin-login-error');
        document.getElementById('btn-admin-login').addEventListener('click', () => {
            errorEl.classList.add('hidden');
            modal.classList.remove('hidden');
        });
        document.getElementById('btn-admin-cancel').addEventListener('click', () => modal.classList.add('hidden'));
        document.getElementById('btn-admin-submit').addEventListener('click', async () => {
            const email = document.getElementById('admin-email').value.trim();
            const password = document.getElementById('admin-password').value;
            errorEl.classList.add('hidden');
            if (!this.firebaseEnabled) {
                errorEl.textContent = 'Firebase sólo está disponible en el sitio publicado.';
                errorEl.classList.remove('hidden');
                return;
            }
            try {
                await this.firebaseAuth.signInWithEmailAndPassword(email, password);
                modal.classList.add('hidden');
                document.getElementById('admin-password').value = '';
            } catch (error) {
                errorEl.textContent = 'No se pudo iniciar sesión.';
                errorEl.classList.remove('hidden');
            }
        });
        document.getElementById('btn-admin-logout').addEventListener('click', async () => {
            if (!this.firebaseAuth || !this.firebaseUser || !this.isAdmin()) return;
            await this.firebaseAuth.signOut();
            modal.classList.add('hidden');
        });
    },

    setupModal() {
        document.getElementById('btn-load-data').addEventListener('click', () => {
            this.loadStaticData();
        });
    },

    setupChampionships() {
        document.getElementById('btn-create-campeonato').addEventListener('click', () => {
            if (!this.isAdmin()) return;
            this.showCreateChampionshipModal();
        });
        document.getElementById('btn-load-campeonatos').addEventListener('click', () => {
            this.loadChampionships();
        });
        // Rail de campeonatos: delegación de click en tarjetas (el rail se re-renderiza en cada snapshot).
        document.getElementById('campeonatos-rail').addEventListener('click', (e) => {
            const card = e.target.closest('.champ-card');
            if (card) this.selectChampionship(card.dataset.champId);
        });
        document.getElementById('btn-save-campeonato').addEventListener('click', () => {
            this.saveChampionship();
        });
        document.getElementById('btn-cancel-create-campeonato').addEventListener('click', () => {
            document.getElementById('create-campeonato-modal').classList.add('hidden');
        });
        document.getElementById('btn-import-plays').addEventListener('click', () => {
            this.importSelectedPlays();
        });
        document.getElementById('import-plays-list').addEventListener('change', () => {
            this.updateImportConsent();
        });
        document.getElementById('btn-cancel-import-plays').addEventListener('click', () => {
            document.getElementById('import-plays-modal').classList.add('hidden');
        });
        document.getElementById('btn-save-manual-play').addEventListener('click', () => {
            this.saveManualPlay();
        });
        document.getElementById('btn-cancel-manual-play').addEventListener('click', () => {
            document.getElementById('add-manual-play-modal').classList.add('hidden');
        });
        document.getElementById('btn-exit-campeonato').addEventListener('click', () => {
            this.championships.selected = null;
            this.renderChampionships();
        });
    },

    isFirestoreMode() {
        return this.firebaseEnabled && this.firebaseDb;
    },

    championshipSummary(championship) {
        return {
            id: championship.id,
            name: championship.name,
            description: championship.description,
            createdAt: championship.createdAt,
            owner: championship.owner || null,
            participantCount: (championship.participants || []).length,
            playCount: (championship.plays || []).length
        };
    },

    getStoredChampionships() {
        try {
            const stored = JSON.parse(localStorage.getItem('hdh-championships') || '[]');
            return Array.isArray(stored) ? stored : [];
        } catch (error) {
            console.error('Error reading local championships:', error);
            return [];
        }
    },

    saveStoredChampionships(championships) {
        localStorage.setItem('hdh-championships', JSON.stringify(championships));
    },

    async loadChampionships() {
        if (this.isFirestoreMode()) {
            const collection = this.firebaseDb.collection('championships');
            if (this.championshipsUnsubscribe) this.championshipsUnsubscribe();
            this.championshipsUnsubscribe = collection.onSnapshot(snapshot => {
                const championships = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                this.championships.raw = championships.slice()
                    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                this.championships.list = this.championships.raw
                    .map(champ => this.championshipSummary(champ));
                this.championships.selected = null;
                this.renderChampionshipsRail();
                this.renderChampionships();
            }, error => console.error('Error loading championships:', error));
            return;
        }
        const stored = this.getStoredChampionships()
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        this.championships.raw = stored;
        this.championships.list = stored.map(champ => this.championshipSummary(champ));
        this.renderChampionshipsRail();
        this.renderChampionships();
    },

    async createChampionship(name, description, participants, owner, participantMetaList) {
        // FIX-HDH-08: con snapshot de identidad (participantMetaList) el campeonato es
        // v2 y los participants son claves de identidad. Sin snapshot queda en formato
        // legacy congelado (S5): ids tal cual, sin reinterpretación posterior.
        const hasMeta = participantMetaList && Object.keys(participantMetaList).length > 0;
        const base = {
            name, description: description || '', createdAt: new Date().toISOString(),
            participants: participants || [], playIds: [], plays: []
        };
        if (hasMeta) {
            base.schemaVersion = 2;
            base.participantRefs = { ...participantMetaList };
        }
        if (this.isFirestoreMode()) {
            if (!this.isAdmin()) return { success: false, error: 'Sólo el administrador puede crear campeonatos' };
            const doc = this.firebaseDb.collection('championships').doc();
            const championship = { id: doc.id, ...base, owner: owner || this.bggUsername || 'local' };
            await doc.set(championship);
            return { success: true, data: championship };
        }
        const championships = this.getStoredChampionships();
        const championship = {
            id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            ...base, owner: owner || 'local'
        };
        championships.push(championship);
        this.saveStoredChampionships(championships);
        return { success: true, data: championship };
    },

    async saveChampionshipToServer(champ) {
        if (this.isFirestoreMode()) {
            if (!this.isAdmin()) throw new Error('Sólo el administrador puede modificar campeonatos');
            await this.firebaseDb.collection('championships').doc(champ.id).set(champ);
            this.championships.selected = champ;
            return;
        }
        const championships = this.getStoredChampionships();
        const index = championships.findIndex(item => item.id === champ.id);
        if (index >= 0) championships[index] = champ;
        else championships.push(champ);
        this.saveStoredChampionships(championships);
        this.championships.selected = champ;
    },

    async selectChampionship(id) {
        if (this.isFirestoreMode()) {
            const snapshot = await this.firebaseDb.collection('championships').doc(id).get();
            if (!snapshot.exists) return;
            this.championships.selected = { id: snapshot.id, ...snapshot.data() };
            this.renderChampionships();
            return;
        }
        const championship = this.getStoredChampionships().find(item => item.id === id);
        if (!championship) return;
        this.championships.selected = championship;
        this.renderChampionships();
    },

    async addPlaysToChampionship(championshipId, playIds) {
        const current = this.isFirestoreMode()
            ? await this.firebaseDb.collection('championships').doc(championshipId).get().then(s => s.data())
            : this.getStoredChampionships().find(item => item.id === championshipId);
        if (!current) return;
        // FIX-HDH-08: en legacy las partidas se guardan con sus ids tal cual
        // (identidad sin definir, S5); en v2 se canonicalizan a identidades estables.
        const championship = { ...current, plays: current.plays || [] };
        const existingIds = new Set(championship.plays.map(play => String(play.id)));
        // FIX-HDH-08: en legacy, las partidas importadas se conservan tal cual sin
        // transformar el formato del campeonato con derivas no vividas; cuando
        // reciba identidades asignadas manualmente se marcará v2.
        const isLegacy = this.isLegacyChampionship(championship);
        for (const playId of playIds) {
            const play = this.data.plays.find(item => String(item.id) === String(playId));
            if (!play || existingIds.has(String(play.id))) continue;
            championship.plays.push(isLegacy ? play : this.canonicalizePlay(championship, play));
            existingIds.add(String(play.id));
        }
        if (isLegacy) {
            // Legacy congelado: misma conducta previa (expandir participantes con los
            // ids tal cual) y solo se actualiza el índice de partidas.
            const seen = new Set((championship.participants || []).map(id => String(id)));
            const expanded = [...(championship.participants || [])];
            for (const play of championship.plays) {
                for (const ps of play.playerScores) {
                    const pid = String(ps.playerRefId);
                    if (!seen.has(pid)) { seen.add(pid); expanded.push(pid); }
                }
            }
            championship.participants = expanded;
            championship.playIds = championship.plays.map(play => play.id);
            await this.saveChampionshipToServer(championship);
            this.renderChampionships();
            return;
        }
        // FIX-HDH-08: participantes por identidad estable; se añaden con snapshot
        // los que aparecen en las partidas importadas.
        const withMeta = {};
        for (const key of new Set((championship.participants || []).map(k => String(k)))) {
            const player = this.data.players.find(p => this.identityKey(p) === String(key));
            withMeta[key] = player ? this.participantMeta(player)
                : { name: this.playerNameByKey(championship, key), isMain: false, isBot: false, isOther: false, color: null, verified: false };
        }
        const resolver = this.championshipKeyResolver(championship);
        for (const play of championship.plays) {
            for (const ps of play.playerScores) {
                const key = resolver(ps.playerRefId);
                if (withMeta[key]) continue;
                const player = this.data.players.find(p => this.identityKey(p) === key);
                withMeta[key] = player ? this.participantMeta(player)
                    : { name: `Jugador ${ps.playerRefId}`, isMain: false, isBot: false, isOther: false, color: null, verified: false };
            }
        }
        championship.participants = Object.keys(withMeta);
        championship.participantRefs = withMeta;
        championship.schemaVersion = 2;
        championship.playIds = championship.plays.map(play => play.id);
        await this.saveChampionshipToServer(championship);
        this.renderChampionships();
    },

    async deleteChampionship(championshipId) {
        if (this.isFirestoreMode()) {
            if (!this.isAdmin()) throw new Error('Sólo el administrador puede eliminar campeonatos');
            await this.firebaseDb.collection('championships').doc(championshipId).delete();
        } else {
            this.saveStoredChampionships(this.getStoredChampionships().filter(champ => champ.id !== championshipId));
        }
        this.championships.selected = null;
        await this.loadChampionships();
    },

    async removePlayFromChampionship(championshipId, playId) {
        const current = this.isFirestoreMode()
            ? await this.firebaseDb.collection('championships').doc(championshipId).get().then(s => s.data())
            : this.getStoredChampionships().find(item => item.id === championshipId);
        if (!current) return;
        const championship = { ...current, plays: (current.plays || []).filter(play => String(play.id) !== String(playId)) };
        championship.playIds = championship.plays.map(play => play.id);
        await this.saveChampionshipToServer(championship);
        this.renderChampionships();
    },

    showCreateChampionshipModal() {
        if (!this.isAdmin()) return;
        // FIX-HDH-08: el checkbox guarda la clave de identidad (nombre normalizado),
        // no el id de BGG; data-player-name conserva el nombre para el snapshot.
        const playerList = document.getElementById('new-campeonato-players');
        playerList.innerHTML = this.data.players.map(p =>
            `<label><input type="checkbox" value="${this.escapeHtml(this.identityKey(p))}" data-player-key="${this.escapeHtml(this.identityKey(p))}"> ${this.escapeHtml(p.name)}${p.isBot ? ' (Bot)' : ''}${p.isMain ? ' (Principal)' : ''}${p.isOther ? ' (Otro)' : ''}</label>`
        ).join('');
        document.getElementById('new-campeonato-name').value = '';
        document.getElementById('new-campeonato-description').value = '';
        document.getElementById('create-campeonato-modal').classList.remove('hidden');
    },

    saveChampionship() {
        const name = document.getElementById('new-campeonato-name').value.trim();
        const description = document.getElementById('new-campeonato-description').value.trim();
        const selectedPlayers = Array.from(
            document.querySelectorAll('#new-campeonato-players input:checked')
        ).map(input => {
            const player = this.data.players.find(p => this.identityKey(p) === String(input.dataset.playerKey));
            return player ? this.participantMeta(player) : null;
        }).filter(Boolean);
        const participantMetaList = {};
        for (const p0 of selectedPlayers) {
            const player = this.data.players.find(q => q.name === p0.name);
            const key = this.identityKey(player || p0);
            participantMetaList[key] = { ...this.participantMeta(player || p0) };
        }
        if (!name) {
            alert('El nombre es obligatorio');
            return;
        }
        this.createChampionship(name, description, Object.keys(participantMetaList), this.bggUsername, participantMetaList).then(result => {
            if (result.success) {
                document.getElementById('create-campeonato-modal').classList.add('hidden');
                this.loadChampionships().then(() => {
                    this.selectChampionship(result.data.id);
                });
            } else {
                alert('Error: ' + (result.error || 'No se pudo crear el campeonato'));
            }
        });
    },

    openImportPlaysModal() {
        const champ = this.championships.selected;
        if (!champ) return;
        const existingIds = new Set(champ.playIds.map(id => String(id)));
        const availablePlays = this.data.plays.filter(p => !existingIds.has(String(p.id)));
        const list = document.getElementById('import-plays-list');
        list.innerHTML = availablePlays.map(p => {
            const winnerPs = p.playerScores.find(ps => ps.winner);
            const winnerName = winnerPs ? this.playerNameByRef(champ, winnerPs.playerRefId) : '-';
            return `<label><input type="checkbox" value="${p.id}"> ${p.playDate} | ${p.board} | Ganador: ${winnerName}</label>`;
        }).join('');
        if (availablePlays.length === 0) {
            list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No hay partidas disponibles para importar</p>';
        }
        const consentCheckbox = document.getElementById('import-consent-checkbox');
        if (consentCheckbox) consentCheckbox.checked = false;
        this.updateImportConsent();
        document.getElementById('import-plays-modal').classList.remove('hidden');
    },

    // FIX-HDH-07: calcula los jugadores de las partidas seleccionadas que aun no son
    // participantes del campeonato y muestra el bloque de consentimiento explicito.
    updateImportConsent() {
        const champ = this.championships.selected;
        const block = document.getElementById('import-consent-block');
        if (!champ || !block) {
            if (block) block.classList.add('hidden');
            return;
        }
        const participantKeys = this.effectiveParticipantKeys(champ);
        // Sin participantes declarados la importacion es libre (comportamiento previo):
        // no hace falta consentimiento.
        if (participantKeys.size === 0) {
            block.classList.add('hidden');
            return;
        }
        const selected = Array.from(
            document.querySelectorAll('#import-plays-list input:checked')
        ).map(i => i.value);
        const resolver = this.championshipKeyResolver(champ);
        const newNames = [];
        for (const playId of selected) {
            const play = this.data.plays.find(p => String(p.id) === String(playId));
            if (!play) continue;
            for (const ps of play.playerScores) {
                const key = resolver(ps.playerRefId);
                if (!participantKeys.has(key)) {
                    const name = this.playerNameByKey(champ, key);
                    if (!newNames.includes(name)) newNames.push(name);
                }
            }
        }
        const namesEl = document.getElementById('import-consent-names');
        if (namesEl) namesEl.textContent = newNames.join(', ');
        block.classList.toggle('hidden', newNames.length === 0);
    },

    importSelectedPlays() {
        const champ = this.championships.selected;
        if (!champ) return;
        const selected = Array.from(
            document.querySelectorAll('#import-plays-list input:checked')
        ).map(i => i.value);
        if (selected.length === 0) return;

        const participantKeys = this.effectiveParticipantKeys(champ);
        const hasParticipants = participantKeys.size > 0;
        // FIX-HDH-07: el propietario puede aceptar añadir los jugadores no participantes
        // marcando la casilla de consentimiento del modal.
        const consentGiven = document.getElementById('import-consent-checkbox')?.checked || false;

        if (hasParticipants) {
            const invalidPlays = [];
            const resolver = this.championshipKeyResolver(champ);
            for (const playId of selected) {
                const play = this.data.plays.find(p => String(p.id) === String(playId));
                if (play) {
                    for (const ps of play.playerScores) {
                        const key = resolver(ps.playerRefId);
                        if (!participantKeys.has(key)) {
                            const playerName = this.playerNameByKey(champ, key);
                            invalidPlays.push({ playId, playerName });
                        }
                    }
                }
            }
            if (invalidPlays.length > 0 && !consentGiven) {
                const names = [...new Set(invalidPlays.map(i => i.playerName))];
                alert(`No se pueden añadir estas partidas.\n\nEstos jugadores no son participantes del campeonato:\n${names.join(', ')}\n\nMarca la casilla del modal para añadirlos como participantes, o quita esas partidas de la selección.`);
                return;
            }
        }

        // FIX-HDH-07/08: con consentimiento, los nuevos jugadores se registran en el
        // campeonato dentro de addPlaysToChampionship (con snapshot de identidad).
        this.addPlaysToChampionship(champ.id, selected);
        document.getElementById('import-plays-modal').classList.add('hidden');
    },

    openAddManualPlayModal() {
        const champ = this.championships.selected;
        if (!champ) return;
        const boardSelect = document.getElementById('manual-play-board');
        boardSelect.innerHTML = this.data.boards.map(b => 
            `<option value="${b.name}">${b.name}</option>`
        ).join('');
        document.getElementById('manual-play-date').value = new Date().toISOString().split('T')[0];
        const playersDiv = document.getElementById('manual-play-players');
        // FIX-HDH-08: participants son claves de identidad; el nombre sale del snapshot
        // o de la tabla actual.
        const participants = champ.participants || [];
        playersDiv.innerHTML = participants.map(pkey => {
            const meta = this.participantRefsOf(champ)[pkey];
            const player = this.data.players.find(p => this.identityKey(p) === String(pkey));
            const displayName = (meta && meta.name) || (player && player.name) || pkey;
            const color = this.participantColor(champ, pkey);
            if (!displayName) return '';
            return `
                <div class="manual-player-row">
                    <span class="manual-player-name">${color ? `<span class="name-dot" style="background:${color};"></span> ` : ''}${this.escapeHtml(displayName)}</span>
                    <input type="number" class="manual-player-score" data-player-id="${this.escapeHtml(pkey)}" data-player-name="${this.escapeHtml(displayName)}" placeholder="Pts" min="0">
                    <label class="manual-player-winner">
                        <input type="radio" name="manual-winner" value="${this.escapeHtml(pkey)}"> Ganador
                    </label>
                </div>
            `;
        }).join('');
        if (participants.length === 0) {
            playersDiv.innerHTML = '<p style="color:var(--text-muted);text-align:center;">No hay participantes. Añade jugadores al campeonato primero.</p>';
        }
        document.getElementById('add-manual-play-modal').classList.remove('hidden');
    },

    saveManualPlay() {
        const champ = this.championships.selected;
        if (!champ) return;
        const board = document.getElementById('manual-play-board').value;
        const date = document.getElementById('manual-play-date').value;
        const winnerRadio = document.querySelector('input[name="manual-winner"]:checked');
        if (!winnerRadio) {
            alert('Selecciona un ganador');
            return;
        }
        const winnerId = winnerRadio.value;
        const playerScores = Array.from(document.querySelectorAll('.manual-player-score')).map(input => ({
            // FIX-HDH-08: la clave del participante viaja en playerRefId; el resolver
            // de claves la reconoce porque no es un id numérico conocido.
            playerRefId: input.dataset.playerId,
            score: parseInt(input.value) || 0,
            scoreNum: parseInt(input.value) || 0,
            winner: input.dataset.playerId === winnerId
        }));
        const newPlay = {
            id: `manual_${Date.now()}`,
            playDate: date,
            board: board,
            playerScores: playerScores
        };
        if (!champ.plays) champ.plays = [];
        // FIX-HDH-08: los playerRefId de la partida manual ya son claves de
        // participantes; se canonicalizan igualmente por si el formato cambia.
        champ.plays.push(this.canonicalizePlay(champ, newPlay));
        this.saveChampionshipToServer(champ);
        document.getElementById('add-manual-play-modal').classList.add('hidden');
        this.renderChampionshipDetail();
    },

    async loadStaticData() {
        const status = document.getElementById('data-status');
        status.textContent = 'Cargando datos...';
        status.classList.remove('data-status-error');
        try {
            const response = await fetch('./data/heat-data.json', { cache: 'no-store' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            if (!Array.isArray(data.players) || !Array.isArray(data.plays)) {
                throw new Error('Formato de datos inválido');
            }
            this.data = data;
            this.originalPlayers = this.data.players.map(p => ({ ...p }));
            this.applyPlayerOverrides();
            await this.loadColorConfig();
            this.buildColorMap();
            this.populateFilters();
            this.updateHeaderStats();
            this.renderAll();
            this.loadChampionships();
            const generatedAt = data.generatedAt ? new Date(data.generatedAt) : null;
            status.textContent = generatedAt && !Number.isNaN(generatedAt.getTime())
                ? `Actualizado: ${generatedAt.toLocaleDateString('es-ES')}`
                : 'Datos cargados';
        } catch (error) {
            console.error('Error loading static data:', error);
            status.textContent = 'No se pudo cargar el JSON; usando datos de ejemplo';
            status.classList.add('data-status-error');
            this.loadMockData();
        }
    },

    loadMockData() {
        this.bggUsername = 'local';
        this.data = {
            players: [
                { id: 1, name: 'Player1', isBot: false, isMain: true, isOther: false },
                { id: 2, name: 'Player2', isBot: false, isMain: true, isOther: false },
                { id: 3, name: 'Player3', isBot: false, isMain: false, isOther: true },
                { id: 4, name: 'Bot1', isBot: true, isMain: false, isOther: false }
            ],
            locations: [
                { id: 1, name: 'Casa' },
                { id: 2, name: 'Bar' }
            ],
            plays: [
                {
                    id: 1, playDate: '2024-01-15', board: 'Circuit A', locationRefId: 1,
                    playerScores: [
                        { playerRefId: 1, score: '25', scoreNum: 25, winner: true },
                        { playerRefId: 2, score: '20', scoreNum: 20, winner: false },
                        { playerRefId: 4, score: '18', scoreNum: 18, winner: false }
                    ]
                },
                {
                    id: 2, playDate: '2024-02-20', board: 'Circuit B', locationRefId: 2,
                    playerScores: [
                        { playerRefId: 2, score: '30', scoreNum: 30, winner: true },
                        { playerRefId: 1, score: '22', scoreNum: 22, winner: false },
                        { playerRefId: 3, score: '19', scoreNum: 19, winner: false }
                    ]
                },
                {
                    id: 3, playDate: '2024-03-10', board: 'Circuit A', locationRefId: 1,
                    playerScores: [
                        { playerRefId: 1, score: '28', scoreNum: 28, winner: true },
                        { playerRefId: 2, score: '24', scoreNum: 24, winner: false }
                    ]
                },
                {
                    id: 4, playDate: '2024-04-05', board: 'Circuit B', locationRefId: 2,
                    playerScores: [
                        { playerRefId: 3, score: '35', scoreNum: 35, winner: true },
                        { playerRefId: 4, score: '15', scoreNum: 15, winner: false }
                    ]
                }
            ],
            boards: [
                { id: 1, name: 'Circuit A' },
                { id: 2, name: 'Circuit B' }
            ]
        };
        this.originalPlayers = this.data.players.map(p => ({ ...p }));
        this.applyPlayerOverrides();
        this.buildColorMap();
        this.populateFilters();
        this.updateHeaderStats();
        this.renderAll();
        this.renderAdminStatus();
        this.loadChampionships();
    },

    populateFilters() {
        const playerFilters = document.getElementById('player-filters');
        const trackFilters = document.getElementById('track-filters');
        const locationFilters = document.getElementById('location-filters');

        playerFilters.innerHTML = this.data.players
            .filter(p => p.isMain)
            .map(p => `<label><input type="checkbox" value="${p.id}"> ${p.name}</label>`)
            .join('');

        trackFilters.innerHTML = this.data.boards
            .map(b => `<label><input type="checkbox" value="${b.name}"> ${b.name}</label>`)
            .join('');

        locationFilters.innerHTML = this.data.locations
            .map(l => `<label><input type="checkbox" value="${l.id}"> ${l.name}</label>`)
            .join('');
    },

    applyFilters() {
        this.filters.players = Array.from(document.querySelectorAll('#player-filters input:checked')).map(i => i.value);
        this.filters.tracks = Array.from(document.querySelectorAll('#track-filters input:checked')).map(i => i.value);
        this.filters.locations = Array.from(document.querySelectorAll('#location-filters input:checked')).map(i => i.value);
        this.updateHeaderStats();
        this.renderAll();
    },

    updateHeaderStats() {
        document.getElementById('stat-plays-total').textContent = this.data.plays.length;
        document.getElementById('stat-players-total').textContent = this.data.players.length;
        document.getElementById('stat-tracks-total').textContent = this.data.boards.length;
        document.getElementById('stat-locations-total').textContent = this.data.locations.length;

        const filteredPlays = this.getFilteredPlays();
        document.getElementById('stat-plays-filtered').textContent = filteredPlays.length;
        document.getElementById('stat-players-filtered').textContent = this.getFilteredPlayers().length;
        document.getElementById('stat-tracks-filtered').textContent = new Set(filteredPlays.map(p => p.board)).size;
        document.getElementById('stat-locations-filtered').textContent = new Set(filteredPlays.map(p => p.locationRefId)).size;
    },

    getFilteredPlays() {
        if (!this.filters.active) return this.data.plays;
        const selectedPlayerIds = this.filters.players.map(id => String(id));
        const selectedTrackNames = this.filters.tracks.map(t => String(t));
        const selectedLocationIds = this.filters.locations.map(id => String(id));

        return this.data.plays.filter(play => {
            if (selectedTrackNames.length > 0 && !selectedTrackNames.includes(String(play.board))) {
                return false;
            }
            if (selectedLocationIds.length > 0 && !selectedLocationIds.includes(String(play.locationRefId))) {
                return false;
            }
            if (selectedPlayerIds.length > 0) {
                const playPlayerIds = play.playerScores.map(ps => String(ps.playerRefId));
                if (this.filters.playerMode === 'any') {
                    const hasAny = selectedPlayerIds.some(pid => playPlayerIds.includes(pid));
                    if (!hasAny) return false;
                } else if (this.filters.playerMode === 'all') {
                    const hasAll = selectedPlayerIds.every(pid => playPlayerIds.includes(pid));
                    if (!hasAll) return false;
                } else if (this.filters.playerMode === 'exact') {
                    const playMainPlayerIds = play.playerScores
                        .map(ps => String(ps.playerRefId))
                        .filter(pid => {
                            const player = this.data.players.find(p => String(p.id) === pid);
                            return player && player.isMain;
                        });
                    const sameSize = playMainPlayerIds.length === selectedPlayerIds.length;
                    const sameSet = sameSize && selectedPlayerIds.every(pid => playMainPlayerIds.includes(pid));
                    if (!sameSet) return false;
                }
            }
            return true;
        });
    },

    getFilteredPlayers() {
        const filteredPlays = this.getFilteredPlays();
        const playerIds = new Set();
        for (const play of filteredPlays) {
            for (const ps of play.playerScores) {
                playerIds.add(ps.playerRefId);
            }
        }
        return this.data.players.filter(p => playerIds.has(p.id));
    },

    initCharts() {
        const accent = this.cssVar('--accent');
        const surface = this.cssVar('--surface');
        const text = this.cssVar('--text');
        const font = this.cssVar('--font-body');

        // Estilo común de todos los gráficos (leyendas redondas, tooltips y rejilla discretos)
        Chart.defaults.font.family = font;
        Chart.defaults.font.size = 12;
        Chart.defaults.color = this.cssVar('--text-muted');
        Chart.defaults.borderColor = this.cssVar('--chart-grid');
        Chart.defaults.plugins.legend.labels.usePointStyle = true;
        Chart.defaults.plugins.legend.labels.boxWidth = 8;
        Chart.defaults.plugins.legend.labels.boxHeight = 8;
        Object.assign(Chart.defaults.plugins.tooltip, {
            backgroundColor: this.cssVar('--surface-3'),
            titleColor: text,
            bodyColor: text,
            borderColor: this.cssVar('--line'),
            borderWidth: 1,
            padding: 10,
            cornerRadius: 8,
            boxPadding: 4
        });

        const playsMonthDataset = () => ({
            label: 'Partidas',
            data: [],
            borderColor: accent,
            backgroundColor: this.cssVar('--accent-soft'),
            fill: true,
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: accent,
            pointHoverBorderColor: surface,
            pointHoverBorderWidth: 2,
            tension: 0.3
        });
        const playsMonthScales = {
            x: { grid: { display: false }, ticks: { maxTicksLimit: 6, maxRotation: 0 } },
            y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5 } }
        };

        this.charts.wins = new Chart(document.getElementById('chart-wins'), {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Victorias', data: [], backgroundColor: accent, borderRadius: { topLeft: 4, topRight: 4 }, maxBarThickness: 28 }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                plugins: {
                    legend: { display: false },
                    valueLabels: { enabled: true, color: text, font },
                    tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} victorias` } }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 5 } }
                }
            },
            plugins: [this.valueLabelsPlugin]
        });

        this.charts.playsMonth = new Chart(document.getElementById('chart-plays-month'), {
            type: 'line',
            data: { labels: [], datasets: [playsMonthDataset()] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false } },
                scales: playsMonthScales
            }
        });

        this.charts.avgPts = new Chart(document.getElementById('chart-avgpts'), {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Pts Medios', data: [], backgroundColor: accent, borderRadius: { topRight: 4, bottomRight: 4 }, maxBarThickness: 18 }] },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                layout: { padding: { right: 34 } },
                plugins: {
                    legend: { display: false },
                    valueLabels: { enabled: true, color: text, font, format: v => Number(v).toFixed(1) }
                },
                scales: {
                    x: { beginAtZero: true },
                    y: { grid: { display: false } }
                }
            },
            plugins: [this.valueLabelsPlugin]
        });

        this.charts.tracks = new Chart(document.getElementById('chart-tracks'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: [accent, this.cssVar('--surface-3'), this.cssVar('--text-muted')], borderColor: surface, borderWidth: 2 }] },
            // El contenedor (.donut-wrap) limita el ancho; el doughnut mantiene su ratio cuadrado.
            options: { responsive: true }
        });

        this.charts.winsEvolution = new Chart(document.getElementById('chart-wins-evolution'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { responsive: true, interaction: { mode: 'index', intersect: false } }
        });

        this.charts.playsMonthHistorial = new Chart(document.getElementById('chart-plays-month-historial'), {
            type: 'line',
            data: { labels: [], datasets: [playsMonthDataset()] },
            options: {
                responsive: true,
                interaction: { mode: 'index', intersect: false },
                plugins: { legend: { display: false } },
                scales: playsMonthScales
            }
        });
    },

    renderAll() {
        this.buildColorMap();
        this.renderKPIs();
        this.renderPodium();
        this.renderCharts();
        this.renderPlayersTable();
        this.renderTrackList();
        this.renderPlaysHistory();
    },

    getTrackFlag(boardName) {
        const flags = {
            'usa': '🇺🇸', 'united states': '🇺🇸', 'america': '🇺🇸',
            'italy': '🇮🇹', 'italia': '🇮🇹',
            'france': '🇫🇷',
            'great britain': '🇬🇧', 'uk': '🇬🇧', 'england': '🇬🇧',
            'germany': '🇩🇪', 'deutschland': '🇩🇪',
            'poland': '🇵🇱', 'mexico': '🇲🇽', 'méxico': '🇲🇽',
            'japan': '🇯🇵', 'nippon': '🇯🇵',
            'australia': '🇦🇺',
            'spain': '🇪🇸', 'españa': '🇪🇸',
            'brazil': '🇧🇷', 'brasil': '🇧🇷',
            'canada': '🇨🇦',
            'netherlands': '🇳🇱', 'holland': '🇳🇱'
        };
        const key = (boardName || '').toLowerCase().trim();
        if (flags[key]) return flags[key];
        for (const [name, flag] of Object.entries(flags)) {
            if (key.includes(name)) return flag;
        }
        return '🏁';
    },

    renderKPIs() {
        const filteredPlays = this.getFilteredPlays();
        const mainPlayers = this.data.players.filter(p => p.isMain);

        // KPI Leader: main player with most wins
        let leaderName = '-';
        let maxWins = -1;
        for (const player of mainPlayers) {
            const wins = filteredPlays.filter(play =>
                play.playerScores.some(ps => ps.playerRefId === player.id && ps.winner)
            ).length;
            if (wins > maxWins) {
                maxWins = wins;
                leaderName = player.name;
            }
        }
        const leaderDisplay = maxWins > 0 ? `${leaderName} (${maxWins})` : '-';

        // KPI Track: most frequent board
        let trackName = '-';
        let trackMax = 0;
        const boardCounts = {};
        for (const play of filteredPlays) {
            boardCounts[play.board] = (boardCounts[play.board] || 0) + 1;
            if (boardCounts[play.board] > trackMax) {
                trackMax = boardCounts[play.board];
                trackName = play.board;
            } else if (boardCounts[play.board] === trackMax && play.board < trackName) {
                trackName = play.board;
            }
        }
        const trackDisplay = trackName !== '-' ? `${this.getTrackFlag(trackName)} ${trackName} (${trackMax})` : '-';

        // KPI Streak: best winning streak for a main player
        let bestStreak = { name: '-', count: 0 };
        for (const player of mainPlayers) {
            const playerPlays = filteredPlays
                .filter(p => p.playerScores.some(ps => ps.playerRefId === player.id))
                .sort((a, b) => new Date(a.playDate) - new Date(b.playDate));
            let currentStreak = 0;
            let maxPlayerStreak = 0;
            for (const play of playerPlays) {
                const ps = play.playerScores.find(ps => ps.playerRefId === player.id);
                if (ps && ps.winner) {
                    currentStreak++;
                    maxPlayerStreak = Math.max(maxPlayerStreak, currentStreak);
                } else {
                    currentStreak = 0;
                }
            }
            if (maxPlayerStreak > bestStreak.count) {
                bestStreak = { name: player.name, count: maxPlayerStreak };
            }
        }
        const streakDisplay = bestStreak.count > 0 ? `${bestStreak.name} (${bestStreak.count})` : '-';

        // KPI Last: most recent play date with winner
        let lastDisplay = '-';
        if (filteredPlays.length > 0) {
            const lastPlay = filteredPlays.slice().sort((a, b) => new Date(b.playDate) - new Date(a.playDate))[0];
            const winnerPs = lastPlay.playerScores.find(ps => ps.winner);
            const winnerName = winnerPs ? (this.data.players.find(p => p.id === winnerPs.playerRefId)?.name || '-') : '-';
            lastDisplay = `${lastPlay.playDate} ${winnerName}`;
        }

        document.getElementById('kpi-leader').textContent = leaderDisplay;
        document.getElementById('kpi-track').textContent = trackDisplay;
        document.getElementById('kpi-streak').textContent = streakDisplay;
        document.getElementById('kpi-last').textContent = lastDisplay;
    },

    renderPodium() {
        const podiumEl = document.getElementById('podium');
        const filteredPlays = this.getFilteredPlays();
        const mainPlayers = this.data.players.filter(p => p.isMain);

        const winsByPlayer = mainPlayers.map(player => {
            const wins = filteredPlays.filter(play =>
                play.playerScores.some(ps => ps.playerRefId === player.id && ps.winner)
            ).length;
            return { id: player.id, name: player.name, wins };
        })
        .filter(p => p.wins > 0)
        .sort((a, b) => b.wins - a.wins);

        const top3 = winsByPlayer.slice(0, 3);

        if (top3.length === 0) {
            podiumEl.innerHTML = '';
            return;
        }

        // Altura del peldaño según el puesto (no según las victorias: 31/26/24 apenas se distinguirían)
        const places = [
            { rank: 2, data: top3[1], cls: 'second', medal: '🥈', height: 0.76 },
            { rank: 1, data: top3[0], cls: 'first', medal: '🥇', height: 1 },
            { rank: 3, data: top3[2], cls: 'third', medal: '🥉', height: 0.58 }
        ];

        podiumEl.innerHTML = places
            .filter(p => p.data)
            .map(p => `
                <div class="podium-place ${p.cls}" style="--pc:${this.playerColor(p.data.name)};--share:${p.height}">
                    <div class="podium-medal">${p.medal}</div>
                    <div class="podium-name">${p.data.name}</div>
                    <div class="podium-wins">${p.data.wins} victoria${p.data.wins !== 1 ? 's' : ''}</div>
                </div>
            `).join('');
    },

    renderCharts() {
        const filteredPlays = this.getFilteredPlays();
        const mainPlayers = this.data.players.filter(p => p.isMain);

        // Wins chart: victories per player
        const winsByPlayer = mainPlayers.map(player => {
            const wins = filteredPlays.filter(play =>
                play.playerScores.some(ps => ps.playerRefId === player.id && ps.winner)
            ).length;
            return { name: player.name, wins };
        })
        .filter(p => p.wins > 0)
        .sort((a, b) => b.wins - a.wins);

        this.charts.wins.data.labels = winsByPlayer.map(p => p.name);
        this.charts.wins.data.datasets[0].data = winsByPlayer.map(p => p.wins);
        this.charts.wins.data.datasets[0].backgroundColor = winsByPlayer.map(p => this.playerColor(p.name));
        this.charts.wins.update();

        // Plays by month chart
        const playsByMonth = {};
        for (const play of filteredPlays) {
            const month = play.playDate.substring(0, 7);
            playsByMonth[month] = (playsByMonth[month] || 0) + 1;
        }
        const sortedMonths = Object.keys(playsByMonth).sort();
        const monthData = sortedMonths.map(m => playsByMonth[m]);
        this.charts.playsMonth.data.labels = sortedMonths;
        this.charts.playsMonth.data.datasets[0].data = monthData;
        this.charts.playsMonth.update();
        this.charts.playsMonthHistorial.data.labels = sortedMonths;
        this.charts.playsMonthHistorial.data.datasets[0].data = monthData;
        this.charts.playsMonthHistorial.update();

        // Avg points chart: average score per main player
        const avgByPlayer = mainPlayers.map(player => {
            let totalScore = 0;
            let playCount = 0;
            for (const play of filteredPlays) {
                const ps = play.playerScores.find(ps => ps.playerRefId === player.id);
                if (ps) {
                    totalScore += ps.scoreNum;
                    playCount++;
                }
            }
            return { name: player.name, avg: playCount > 0 ? totalScore / playCount : 0 };
        })
        .filter(p => p.avg > 0)
        .sort((a, b) => b.avg - a.avg);

        this.charts.avgPts.data.labels = avgByPlayer.map(p => p.name);
        this.charts.avgPts.data.datasets[0].data = avgByPlayer.map(p => parseFloat(p.avg.toFixed(1)));
        this.charts.avgPts.data.datasets[0].backgroundColor = avgByPlayer.map(p => this.playerColor(p.name));
        this.charts.avgPts.update();

        // Track chart: distribución de partidas o victorias del circuito seleccionado
        this.updateTracksChart();

        // Wins evolution chart: cumulative wins by date per main player (max 10)
        const top10Players = mainPlayers.slice(0, 10);
        const allDates = [...new Set(filteredPlays.map(p => p.playDate))].sort();

        const datasets = top10Players.map((player, idx) => {
            let cumulative = 0;
            const data = allDates.map(date => {
                const playsOnDate = filteredPlays.filter(p => p.playDate === date);
                for (const play of playsOnDate) {
                    if (play.playerScores.some(ps => ps.playerRefId === player.id && ps.winner)) {
                        cumulative++;
                    }
                }
                return cumulative;
            });
            return {
                label: player.name,
                data,
                borderColor: this.playerColor(player.name),
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                tension: 0.1,
                fill: false
            };
        });

        this.charts.winsEvolution.data.labels = allDates;
        this.charts.winsEvolution.data.datasets = datasets;
        this.charts.winsEvolution.update();
    },

    renderPlayersTable() {
        const filteredPlays = this.getFilteredPlays();
        const mainPlayers = this.data.players.filter(p => p.isMain);

        const playerStats = mainPlayers.map(player => {
            let plays = 0, wins = 0, totalScore = 0, maxScore = 0;
            const recentPlays = [];

            const sortedPlays = filteredPlays
                .filter(p => p.playerScores.some(ps => ps.playerRefId === player.id))
                .sort((a, b) => new Date(b.playDate) - new Date(a.playDate));

            for (const play of sortedPlays) {
                const ps = play.playerScores.find(ps => ps.playerRefId === player.id);
                if (ps) {
                    plays++;
                    if (ps.winner) wins++;
                    totalScore += ps.scoreNum;
                    if (ps.scoreNum > maxScore) maxScore = ps.scoreNum;
                    if (recentPlays.length < 10) {
                        recentPlays.push(ps.winner);
                    }
                }
            }

            return {
                id: player.id,
                name: player.name,
                plays,
                wins,
                winPct: plays > 0 ? Math.round((wins / plays) * 100) : 0,
                avg: plays > 0 ? parseFloat((totalScore / plays).toFixed(1)) : 0,
                max: maxScore,
                recentPlays
            };
        })
        .filter(p => p.plays > 0)
        .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);

        const tbody = document.querySelector('#players-table tbody');
        tbody.innerHTML = playerStats.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${p.name}</td>
                <td>${p.plays}</td>
                <td>${p.wins}</td>
                <td>
                    <div class="win-pct-bar">
                        <div class="win-pct-fill" style="width: ${p.winPct}%"></div>
                        <span class="win-pct-text">${p.winPct}%</span>
                    </div>
                </td>
                <td>${p.avg}</td>
                <td>${p.max}</td>
                <td>
                    <div class="last10-dots">
                        ${p.recentPlays.map(w => `<span class="dot ${w ? 'dot-win' : 'dot-loss'}"></span>`).join('')}
                    </div>
                </td>
            </tr>
        `).join('');
    },

    setupTrackList() {
        // Delegación de eventos: el track-list se re-renderiza con cada filtro,
        // por lo que el listener vive en el contenedor, no en cada tarjeta.
        document.getElementById('track-list').addEventListener('click', (e) => {
            const card = e.target.closest('.track-card');
            if (!card) return;
            const trackName = card.dataset.track;
            this.selectedTrack = this.selectedTrack === trackName ? null : trackName;
            this.renderTrackList();
            this.updateTracksChart();
        });
    },

    // Actualiza el chart DISTRIBUCIÓN: por defecto reparto de partidas por
    // circuito; con un circuito seleccionado, victorias de cada jugador (+Bots).
    updateTracksChart() {
        const filteredPlays = this.getFilteredPlays();
        const titleEl = document.getElementById('tracks-chart-title');

        if (this.selectedTrack) {
            // Reset si el circuito seleccionado desaparece con un nuevo filtro
            const exists = filteredPlays.some(p => p.board === this.selectedTrack);
            if (!exists) this.selectedTrack = null;
        }

        if (this.selectedTrack) {
            const wins = {};
            for (const play of filteredPlays) {
                if (play.board !== this.selectedTrack) continue;
                for (const ps of play.playerScores) {
                    if (!ps.winner) continue;
                    const player = this.data.players.find(p => p.id === ps.playerRefId);
                    const label = (player && player.isMain) ? player.name : 'Bots';
                    wins[label] = (wins[label] || 0) + 1;
                }
            }
            if (titleEl) titleEl.textContent = `Victorias — ${this.selectedTrack}`;
            const labels = Object.keys(wins);
            // Color por jugador desde player-colors.json; la entrada agregada
            // 'Bots' usa un color de la paleta que no esté presente en el chart.
            const perPlayer = labels.map(l => l === 'Bots' ? null : this.playerColor(l));
            const usedInChart = new Set(perPlayer.filter(Boolean).map(c => this.normHex(c)));
            const botsColor = this.colorPalette().find(c => !usedInChart.has(this.normHex(c)))
                || this.cssVar('--text-muted');
            this.charts.tracks.data.labels = labels;
            this.charts.tracks.data.datasets[0].data = Object.values(wins);
            this.charts.tracks.data.datasets[0].backgroundColor = perPlayer.map(c => c || botsColor);
        } else {
            const playsByTrack = {};
            for (const play of filteredPlays) {
                playsByTrack[play.board] = (playsByTrack[play.board] || 0) + 1;
            }
            if (titleEl) titleEl.textContent = 'Distribución';
            this.charts.tracks.data.labels = Object.keys(playsByTrack).sort();
            this.charts.tracks.data.datasets[0].data = Object.keys(playsByTrack).sort().map(t => playsByTrack[t]);
            this.charts.tracks.data.datasets[0].backgroundColor = [
                this.cssVar('--accent'),
                this.cssVar('--surface-3'),
                this.cssVar('--text-muted')
            ];
        }
        this.charts.tracks.update();
    },

    renderTrackList() {
        const { trackList, trackStats, filteredPlays } = this.computeTrackStats();
        const totalPlays = filteredPlays.length;
        const selected = this.selectedTrack;

        const cards = trackList.map(t => {
            const isSelected = selected === t.name;
            const share = totalPlays > 0 ? Math.round((t.plays * 100) / totalPlays) : 0;
            let champHtml;
            if (t.championName && t.championWins > 0) {
                champHtml = `<p class="track-champ"><span class="name-dot" style="background:${this.playerColor(t.championName)};"></span>Campeón: <b>${this.escapeHtml(t.championName)}</b> · ${t.championWins} W</p>`;
            } else {
                champHtml = '<p class="track-champ">🤖 Sin victorias de jugadores principales</p>';
            }
            const flag = this.getTrackFlag(t.name);
            return `
            <article class="track-card${isSelected ? ' selected' : ''}" data-track="${this.escapeHtml(t.name)}">
                <h4 class="track-name" data-track="${this.escapeHtml(t.name)}">${flag} ${this.escapeHtml(t.name)}</h4>
                <p class="track-meta"><span>🏁 <b>${t.plays}</b> partidas</span><span>🤖 <b>${t.botWins}</b> W</span></p>
                <p class="track-share"><span class="sharebar" title="${share}% de todas las partidas"><i style="width:${share}%;"></i></span><span class="share-pct">${share}%</span></p>
                ${champHtml}
            </article>`;
        }).join('');

        document.getElementById('track-list').innerHTML = `
            <div class="rail-head"><span>${trackList.length} ${trackList.length === 1 ? 'circuito' : 'circuitos'}${totalPlays > 0 ? ` · ${totalPlays} partidas` : ''}</span></div>
            <div class="rail-list">${trackList.length === 0 ? '<div class="campeonato-empty">No hay circuitos con las partidas filtradas.</div>' : cards}</div>`;

        this.renderTrackDetail(trackStats, totalPlays, filteredPlays);
    },

    // Estadisticas por circuito compartidas entre el rail, el podio y las visitas.
    computeTrackStats() {
        const filteredPlays = this.getFilteredPlays();
        const trackStats = {};
        for (const play of filteredPlays) {
            if (!trackStats[play.board]) {
                trackStats[play.board] = { plays: 0, totalScore: 0, scoresCount: 0, winsByPlayer: {} };
            }
            trackStats[play.board].plays++;
            for (const ps of play.playerScores) {
                trackStats[play.board].totalScore += ps.scoreNum;
                trackStats[play.board].scoresCount++;
                if (ps.winner) {
                    const pid = ps.playerRefId;
                    trackStats[play.board].winsByPlayer[pid] = (trackStats[play.board].winsByPlayer[pid] || 0) + 1;
                }
            }
        }

        const trackList = Object.entries(trackStats).map(([name, stats]) => {
            let championName = '';
            let championWins = 0;
            let botWins = 0;
            for (const [pid, wins] of Object.entries(stats.winsByPlayer)) {
                const player = this.data.players.find(p => p.id === parseInt(pid));
                if (!player || !player.isMain) {
                    botWins += wins;
                    continue;
                }
                if (wins > championWins) {
                    championWins = wins;
                    championName = player.name;
                }
            }
            return { name, plays: stats.plays, championName, championWins, botWins };
        })
        .sort((a, b) => b.plays - a.plays);

        return { trackList, trackStats, filteredPlays };
    },

    // Detalle a la derecha: badges del circuito activo (o guia para elegir uno),
    // podio top 3 de jugadores principales y ultimas visitas al circuito.
    renderTrackDetail(trackStats, totalPlays, filteredPlays) {
        const headEl = document.getElementById('track-detail-head');
        const podiumEl = document.getElementById('track-podium');
        const recentsEl = document.getElementById('track-recents');
        const recentsTitle = document.getElementById('track-recents-title');
        if (!headEl || !podiumEl || !recentsEl) return;

        const selected = this.selectedTrack;
        const stats = selected ? trackStats[selected] : null;

        if (!selected || !stats) {
            headEl.innerHTML = '';
            podiumEl.innerHTML = '<div class="campeonato-empty">Haz clic en un circuito del rail para ver su pódio.</div>';
            recentsEl.innerHTML = '<div class="campeonato-empty">Haz clic en un circuito para ver sus últimas partidas.</div>';
            recentsTitle.textContent = 'Últimas visitas';
            return;
        }

        const playsOfTrack = (filteredPlays || []).filter(pl => pl.board === selected);

        const share = totalPlays > 0 ? Math.round((stats.plays * 100) / totalPlays) : 0;
        const timeOf = p => {
            const t = new Date(p && p.playDate).getTime();
            return Number.isNaN(t) ? 0 : t;
        };
        const withDate = playsOfTrack.filter(p => !Number.isNaN(new Date(p.playDate).getTime()));
        const lastVisit = withDate.reduce((acc, p) => (!acc || timeOf(p) > timeOf(acc) ? p : acc), null);
        const lastVisitText = lastVisit ? new Date(lastVisit.playDate).toLocaleDateString('es-ES') : '-';

        const botWinsCount = Object.entries(stats.winsByPlayer).reduce((acc, [pid, wins]) => {
            const player = this.data.players.find(p => p.id === parseInt(pid));
            return (!player || !player.isMain) ? acc + wins : acc;
        }, 0);

        // Campeón recalculado aquí: trackStats no guarda championName (solo el
        // trackList del rail lo tiene), así que el badge caía siempre en
        // «sin campeón». Mismo criterio que computeTrackStats.
        const champ = Object.entries(stats.winsByPlayer)
            .map(([pid, wins]) => ({ player: this.data.players.find(p => p.id === parseInt(pid)), wins }))
            .filter(e => e.player && e.player.isMain)
            .sort((a, b) => b.wins - a.wins || a.player.name.localeCompare(b.player.name))[0] || null;

        headEl.innerHTML = `
            <h2>${this.getTrackFlag(selected)} ${this.escapeHtml(selected)}</h2>
            <div class="detail-badges">
                <span class="badge-gold">🏆 ${champ ? `${this.escapeHtml(champ.player.name)} · ${champ.wins} W` : 'sin campeón'}</span>
                <span class="detail-badge">🏁 ${stats.plays} partidas · ${share}% del total</span>
                <span class="detail-badge">🤖 ${botWinsCount} W de bots</span>
                <span class="detail-badge">📅 última: ${lastVisitText}</span>
            </div>`;

        // Podio: top 3 de jugadores principales por victorias en este circuito.
        const mainWins = Object.entries(stats.winsByPlayer)
            .map(([pid, wins]) => ({ player: this.data.players.find(p => p.id === parseInt(pid)), wins }))
            .filter(e => e.player && e.player.isMain)
            .sort((a, b) => b.wins - a.wins || a.player.name.localeCompare(b.player.name))
            .slice(0, 3);
        if (mainWins.length === 0) {
            podiumEl.innerHTML = '<div class="campeonato-empty">Todavía no ha ganado ningún jugador principal en este circuito: solo se imponen los bots.</div>';
        } else {
            const medals = ['🥇', '🥈', '🥉'];
            const maxWins = mainWins[0].wins || 1;
            // Orden clásico de podio: 2º a la izquierda, ganador en el centro y
            // 3º a la derecha (igual que renderPodium de Resumen).
            const ranked = mainWins.slice(0, 3).map((e, i) => ({ e, medal: medals[i] }));
            const displayOrder = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
            podiumEl.innerHTML = '<div class="podium-steps">' + displayOrder.map(({ e, medal }) => `
                <div class="podium-place" style="--pc:${this.playerColor(e.player.name)};--share:${(e.wins / maxWins).toFixed(3)}">
                    <div class="podium-medal">${medal}</div>
                    <div class="podium-name">${this.escapeHtml(e.player.name)}</div>
                    <div class="podium-wins">${e.wins} victoria${e.wins !== 1 ? 's' : ''}</div>
                </div>
            `).join('') + '</div>';
        }

        // Ultimas visitas: hasta 5 partidas mas recientes del circuito.
        recentsTitle.textContent = `Últimas visitas a ${selected}`;
        const recents = [...playsOfTrack].sort((a, b) => timeOf(b) - timeOf(a)).slice(0, 5);
        recentsEl.innerHTML = recents.map(play => {
            const winnerPs = play.playerScores.find(ps => ps.winner);
            const winnerName = winnerPs ? (this.data.players.find(p => p.id === winnerPs.playerRefId)?.name || '-') : '-';
            return `
                <div class="track-recent" data-play-id="${play.id}" role="button" tabindex="0" title="Abrir la carrera">
                    <span class="recent-main"><b>${this.escapeHtml(play.playDate || '-')}</b> · ${play.playerScores.length} jugadores</span>
                    <span class="recent-winner">🏆 ${this.escapeHtml(winnerName)}${winnerPs ? ` · ${winnerPs.score}` : ''}</span>
                </div>
            `;
        }).join('') || '<div class="campeonato-empty">Sin partidas registradas.</div>';
    },

    renderPlaysHistory() {
        const filteredPlays = this.getFilteredPlays();
        const sortedPlays = filteredPlays.slice().sort((a, b) => new Date(b.playDate) - new Date(a.playDate));

        document.getElementById('plays-history').innerHTML = sortedPlays.map(play => {
            const winnerPs = play.playerScores.find(ps => ps.winner);
            const winnerName = winnerPs ? (this.data.players.find(p => p.id === winnerPs.playerRefId)?.name || '-') : '-';
            const winnerScore = winnerPs ? winnerPs.score : '-';
            const flag = this.getTrackFlag(play.board);

            const details = play.playerScores.map(ps => {
                const playerName = this.data.players.find(p => p.id === ps.playerRefId)?.name || '-';
                const cls = ps.winner ? 'player-winner' : '';
                return `<div class="${cls}"><span>${playerName}</span>: ${ps.score}</div>`;
            }).join('');

            return `
                <div class="play-entry" data-play-id="${play.id}">
                    <span>${play.playDate}</span> | <span>${flag} ${play.board}</span> | <span>${winnerName} (${winnerScore})</span>
                </div>
                <div class="play-details" id="details-${play.id}">
                    ${details}
                </div>
            `;
        }).join('');

        document.querySelectorAll('.play-entry').forEach(entry => {
            entry.addEventListener('click', () => {
                // HDH-UI06: la partida abre la modal de carrera (el expandir inline
                // de HDH-07 se retira: el detalle completo vive en la modal).
                this.openRaceModal(entry.dataset.playId);
            });
        });
    },

    /* ── HDH-UI06: modal de carrera ──────────────────────────────
       Se abre desde Circuitos (últimas visitas), Historial (play-entry) y
       Campeonatos (listado de partidas del campeonato). Título «Carrera ·
       <circuito>» con la fecha; hero del ganador, tabla Pos/Piloto/Puntos,
       pódio en escalones y ficha de detalles. Si la partida pertenece a un
       campeonato, botón «Ver campeonato» que navega a su detalle. */

    // Localiza el campeonato al que pertenece una partida del histórico global:
    // primero por id conservado, y si no, por (circuito, fecha), como hace la
    // resolución guiada FIX-HDH-09. Devuelve null si pertenece a ninguno.
    findChampionshipForPlay(play) {
        if (!play) return null;
        for (const champ of this.championships.raw) {
            for (const stored of (champ.plays || [])) {
                if ((play.id && String(stored.id) === String(play.id)) ||
                    (stored.board === play.board && stored.playDate === play.playDate)) {
                    return champ;
                }
            }
        }
        return null;
    },

    // Fecha ISO yyyy-mm-dd en display es-ES sin desfase de zona (los ISO se
    // parsean a UTC y en zonas negativas desplazan el día).
    formatRaceDate(iso) {
        const m = /^\d{4}-\d{2}-\d{2}$/.exec(String(iso || ''));
        if (!m) return iso || '-';
        const [y, mo, d] = iso.split('-').map(Number);
        return new Date(y, mo - 1, d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    },

    // Abre la modal por id de partida en el histórico global (visitas e historial)
    // o por objeto de partida de un campeonato (el clic del campeonato pasa champ).
    openRaceModal(playIdOrPlay, champOverride = null) {
        let play = playIdOrPlay;
        if (typeof playIdOrPlay === 'string' || typeof playIdOrPlay === 'number') {
            play = (this.data.plays || []).find(p => String(p.id) === String(playIdOrPlay))
                // Las partidas manuales de un campeonato solo existen en champ.plays.
                || (champOverride && (champOverride.plays || []).find(p => String(p.id) === String(playIdOrPlay)));
        }
        if (!play) return;
        const champ = champOverride || this.findChampionshipForPlay(play);

        // Resolutores de nombre y color: en campeonatos, participantes por identidad
        // (v2 con claves congeladas, legacy según congelación); en partidas sueltas,
        // contra la tabla global con playerColor.
        const nameOf = (ps) => {
            if (champ) return this.playerNameByRef(champ, ps.playerRefId) || '-';
            return (this.data.players || []).find(p => p.id === ps.playerRefId)?.name || '-';
        };
        const colorOf = (personalName, ps) => {
            if (champ) return this.participantColor(champ, String(this.championshipKeyResolver(champ)(ps.playerRefId)));
            return this.playerColor(personalName);
        };

        // Clasificación por puntos, ganador por su flag (BGG); si nadie la lleva
        // (todas a 0), gana el mayor puntaje.
        const winnerPs = play.playerScores.find(ps => ps.winner)
            || play.playerScores.slice().sort((a, b) => (b.scoreNum || 0) - (a.scoreNum || 0))[0];
        const sorted = play.playerScores
            .map((ps, i) => ({ ps, name: nameOf(ps), color: colorOf(nameOf(ps), ps), order: i }))
            .sort((a, b) => (b.ps.scoreNum || 0) - (a.ps.scoreNum || 0) || a.order - b.order);

        // Título: «Carrera · <circuito>» + fecha.
        document.getElementById('race-modal-title').textContent = `Carrera · ${play.board || '-'}`;
        const locationName = (this.data.locations || []).find(l => l.id === play.locationRefId)?.name;
        const when = this.formatRaceDate(play.playDate);
        document.getElementById('race-modal-date').textContent =
            [when, locationName, `${play.playerScores.length} pilotos`].filter(Boolean).join(' · ');

        // Hero del ganador con su color.
        const winnerName = winnerPs ? nameOf(winnerPs) : null;
        const winnerEl = document.getElementById('race-modal-winner');
        if (winnerPs && winnerName && winnerName !== '-') {
            const wColor = colorOf(winnerName, winnerPs) || 'var(--accent)';
            winnerEl.classList.remove('hidden');
            winnerEl.style.setProperty('--pc', wColor);
            winnerEl.innerHTML = `
                <span class="race-winner-puck" aria-hidden="true"></span>
                <div>
                    <p class="race-winner-label">Victoria</p>
                    <p class="race-winner-name">${this.escapeHtml(winnerName)}</p>
                </div>
                <div class="race-winner-score"><b>${this.escapeHtml(String(winnerPs.scoreNum ?? winnerPs.score ?? 0))}</b><span>puntos</span></div>
            `;
        } else {
            winnerEl.classList.add('hidden');
            winnerEl.style.removeProperty('--pc');
        }

        // Tabla Pos / Piloto / Puntos con la fila del ganador en acento.
        // Puntos en color del piloto (color de jugador o participante), como en
        // los dots de Historical y campeonatos.
        document.getElementById('race-modal-standings').innerHTML = `
            <table class="standings-table race-standings">
                <thead><tr><th class="pos">Pos</th><th>Piloto</th><th>Puntos</th></tr></thead>
                <tbody>
                    ${sorted.map((entry, i) => {
                        const isWinner = winnerPs && entry.ps === winnerPs;
                        const medal = ['🥇', '🥈', '🥉'][i] || '';
                        const dot = entry.color
                            ? `<span class="name-dot" style="background:${entry.color};"></span> `
                            : '';
                        return `
                            <tr class="${isWinner ? 'winner-row' : ''}">
                                <td class="pos">${medal || i + 1}</td>
                                <td><span class="standings-name">${dot}${this.escapeHtml(entry.name)}</span>${isWinner ? ' <span class="medal" aria-hidden="true">🏁</span>' : ''}</td>
                                <td class="pts">${entry.ps.scoreNum ?? entry.ps.score ?? 0}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Pódio en escalones: alturas a la escala de puntos (como el artboard 02
        // y .podium-place de Resumen); 1º con resplandor; solo los 3 primeros.
        // Orden clásico: 2º a la izquierda, ganador en el centro y 3º a la derecha.
        const podiumEl = document.getElementById('race-modal-podium');
        if (sorted.length > 0) {
            const maxPts = sorted[0].ps.scoreNum || 0;
            const medals = ['🏆', '🥈', '🥉'];
            const ranked = sorted.slice(0, 3).map((entry, i) => {
                const pts = entry.ps.scoreNum || 0;
                const share = maxPts > 0 ? pts / maxPts : (i === 0 ? 0.8 : 0.4);
                const h = Math.round(60 + 80 * share);
                return { entry, h, medal: medals[i], first: i === 0 };
            });
            const displayOrder = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
            podiumEl.innerHTML = displayOrder.map(({ entry, h, medal, first }) => `
                <div class="race-step${first ? ' first' : ''}" style="--pc:${entry.color || 'var(--accent)'};--h:${h}px">
                    <span class="race-step-medal">${medal}</span>
                    <span class="race-step-name">${this.escapeHtml(entry.name)}</span>
                    <span class="race-step-n">${entry.ps.scoreNum || 0} pts</span>
                </div>
            `).join('');
        } else {
            podiumEl.innerHTML = '<div class="campeonato-empty">Sin resultados.</div>';
        }

        // Ficha de detalles: tablero, fecha, localización, pilotos y, si hay,
        // campeonato (ficha del modelo ya existente).
        const facts = [
            { label: 'Tablero', value: this.getTrackFlag(play.board) + ' ' + (play.board || '-') },
            { label: 'Fecha', value: when },
            { label: 'Localización', value: locationName || '-' },
            { label: 'Pilotos', value: play.playerScores.length }
        ];
        if (champ) facts.push({ label: 'Campeonato', value: champ.name, gold: true });
        document.getElementById('race-modal-facts').innerHTML = facts.map(f => `
            <div class="race-fact${f.gold ? ' gold' : ''}">
                <span>${this.escapeHtml(f.label)}</span>
                <b>${this.escapeHtml(String(f.value))}</b>
            </div>
        `).join('');

        // Footer con «Ver campeonato» cuando la partida pertenece a uno.
        const champBtn = document.getElementById('btn-race-view-champ');
        this.raceModalChampId = champ ? champ.id : null;
        champBtn.classList.toggle('hidden', !champ);

        document.getElementById('race-modal').classList.remove('hidden');
    },

    closeRaceModal() {
        document.getElementById('race-modal').classList.add('hidden');
    },

    // Cable de la modal: botones de cierre y navegación al campeonato.
    setupRaceModal() {
        document.getElementById('btn-race-close').addEventListener('click', () => this.closeRaceModal());
        document.getElementById('btn-close-race').addEventListener('click', () => this.closeRaceModal());
        // HDH-UI06: las últimas visitas del circuito (panel de detalle) abren la
        // modal de carrera; el contenedor es estático y el contenido re-renderiza.
        document.getElementById('track-recents').addEventListener('click', (e) => {
            const recent = e.target.closest('.track-recent');
            if (recent && recent.dataset.playId) this.openRaceModal(recent.dataset.playId);
        });
        document.getElementById('btn-race-view-champ').addEventListener('click', () => {
            const champId = this.raceModalChampId;
            this.closeRaceModal();
            if (!champId) return;
            // Al campeonato: activa su pestaña y navega al detalle.
            document.querySelector('.tab-btn[data-tab="campeonatos"]')?.click();
            this.selectChampionship(champId);
        });
    },

    renderChampionships() {
        const detailEl = document.getElementById('campeonato-detail');
        if (this.championships.selected) {
            detailEl.classList.remove('hidden');
            this.renderChampionshipDetail();
        } else {
            detailEl.classList.add('hidden');
            document.getElementById('campeonato-detail-content').innerHTML = '';
            // El canvas del chart vive dentro del detalle: al vaciar el DOM hay que destruir la instancia.
            if (this.charts.champEvolution) {
                this.charts.champEvolution.destroy();
                this.charts.champEvolution = null;
            }
        }
        this.renderChampionshipsRail();
    },

    // Rail lateral: una tarjeta por campeonato con participantes, partidas,
    // fecha de creación y líder (nombre + puntos + color de jugador).
    renderChampionshipsRail() {
        const rail = document.getElementById('campeonatos-rail');
        if (!rail) return;
        const raw = this.championships.raw || [];
        const selectedId = this.championships.selected ? String(this.championships.selected.id) : null;
        const count = raw.length;
        const items = raw.map(champ => {
            const isSelected = selectedId !== null && String(champ.id) === selectedId;
            const date = new Date(champ.createdAt);
            const created = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-ES');
            const participants = Array.isArray(champ.participants) ? champ.participants.length : (champ.participantCount || 0);
            const plays = Array.isArray(champ.plays) ? champ.plays.length : (champ.playCount || 0);
            let leaderHtml = '<span class="champ-leader">Sin partidas todavía</span>';
            if (plays > 0) {
                const leader = this.getChampionshipStandings(champ)[0] || null;
                if (leader) {
                    leaderHtml = `<span class="champ-leader"><span class="leader-dot" style="background:${this.playerColor(leader.name)};"></span>Líder: <b>${this.escapeHtml(leader.name)}</b> · ${Math.round(leader.totalScore)} pts</span>`;
                }
            }
            return `
                <button type="button" class="champ-card${isSelected ? ' is-selected' : ''}" data-champ-id="${this.escapeHtml(String(champ.id))}"${isSelected ? ' aria-current="true"' : ''}>
                    <span class="champ-card-name">${this.escapeHtml(champ.name)}</span>
                    <span class="champ-card-meta">
                        <span>👥 <b>${participants}</b></span>
                        <span>🏁 <b>${plays}</b></span>
                        <span>📅 ${created}</span>
                    </span>
                    ${leaderHtml}
                </button>`;
        }).join('');
        rail.innerHTML = `
            <div class="rail-head"><span>${count} ${count === 1 ? 'campeonato' : 'campeonatos'}</span></div>
            <div class="rail-list">${count === 0 ? '<div class="campeonato-rail-empty">No hay campeonatos todavía. Crea el primero con «+ Nuevo Campeonato».</div>' : items}</div>`;
    },

    renderChampionshipDetail() {
        const champ = this.championships.selected;
        if (!champ) return;
        const content = document.getElementById('campeonato-detail-content');
        const date = new Date(champ.createdAt);
        const created = Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-ES');
        const isOwner = champ.owner && this.bggUsername && champ.owner === this.bggUsername;
        const canEdit = (isOwner || !champ.owner) && this.bggUsername;

        const standings = this.getChampionshipStandings(champ);
        const playTime = p => {
            const t = new Date(p && p.playDate).getTime();
            return Number.isNaN(t) ? 0 : t;
        };
        // Las carreras se muestran de izquierda a derecha en orden cronologico (antigua -> reciente).
        const champPlaysChrono = [...(champ.plays || [])]
            .sort((a, b) => playTime(a) - playTime(b) || String(a.id).localeCompare(String(b.id)));
        // La lista de partidas mantiene la convencion reciente -> antigua sin alterar el array original.
        const champPlaysList = [...champPlaysChrono].reverse();
        const leader = standings[0] || null;

        // Cabecera reducida a una linea de badges (nombre + metricas + avisos).
        const badges = [
            leader ? `<span class="detail-badge is-gold">🏆 Líder: ${this.escapeHtml(leader.name)} · ${Math.round(leader.totalScore)} pts</span>` : '',
            `<span class="detail-badge">🏁 ${champPlaysChrono.length} ${champPlaysChrono.length === 1 ? 'partida' : 'partidas'}</span>`,
            `<span class="detail-badge">👥 ${(champ.participants || []).length} participantes</span>`,
            created ? `<span class="detail-badge">📅 desde ${created}</span>` : '',
            champ.owner ? `<span class="detail-badge">👤 ${this.escapeHtml(champ.owner)}</span>` : ''
        ].filter(Boolean).join('');
        const warnings = [];
        if (!isOwner && champ.owner) warnings.push('Solo lectura (no eres el propietario)');
        if (!this.bggUsername) warnings.push('Inicia sesión en BGG para editar campeonatos');
        if (this.isLegacyChampionship(champ)) {
            warnings.push('FIX-HDH-08 · Participantes sin identidad estable (campeonato antiguo): los nombres mostrados pueden no corresponder. Pendiente de identificación guiada.');
        }

        // Clasificacion: mismas clases y data-play-date que la tabla anterior.
        const standingsHtml = champPlaysChrono.length > 0 ? `
                    <div class="standings-wrap">
                        <table class="standings-table">
                            <thead>
                                <tr><th class="pos"></th><th>Jugador</th>${champPlaysChrono.map(p => `<th data-play-date="${p.playDate || ''}">${this.getTrackFlag(p.board)} ${p.board}</th>`).join('')}<th class="total-col">Total</th></tr>
                            </thead>
                            <tbody>
                                ${standings.map((s, i) => `
                                    <tr>
                                        <td class="pos">${i === 0 ? '<span class="medal">🥇</span>' : i === 1 ? '<span class="medal">🥈</span>' : i === 2 ? '<span class="medal">🥉</span>' : i + 1}</td>
                                        <td><span class="standings-name"><span class="name-dot" style="background:${this.participantColor(champ, s.id)};"></span>${this.escapeHtml(s.name)}</span></td>
                                        ${champPlaysChrono.map(p => {
                                            const playerScore = p.playerScores.find(ps => String(this.championshipKeyResolver(champ)(ps.playerRefId)) === String(s.id));
                                            return `<td>${playerScore ? playerScore.scoreNum : '-'}</td>`;
                                        }).join('')}
                                        <td class="total-col"><strong>${Math.round(s.totalScore)}</strong></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>` : '<div class="campeonato-empty">No hay partidas en este campeonato. Importa o añade partidas para ver la clasificación.</div>';

        // Lista de partidas (reciente -> antigua) con ganador y accion de borrado.
        const playsHtml = champPlaysList.map(p => {
            const winnerPs = p.playerScores.find(ps => ps.winner);
            const winnerName = winnerPs ? this.playerNameByRef(champ, winnerPs.playerRefId) : '-';
            const flag = this.getTrackFlag(p.board);
            return `
                        <div class="campeonato-play-item" data-open-race="${p.id}">
                            <span class="play-main"><b>${this.escapeHtml(p.board)}</b> · ${flag} · ${p.playDate || ''}</span>
                            <span class="play-winner">🏆 ${this.escapeHtml(winnerName)}</span>
                            ${isOwner || !champ.owner ? `<button class="remove-play btn-secondary" data-play-id="${p.id}" title="Eliminar esta partida del campeonato">✕</button>` : ''}
                        </div>
            `;
        }).join('') || '<div class="campeonato-empty">No hay partidas registradas.</div>';

        content.innerHTML = `
            <div class="campeonato-detail-header">
                <div class="detail-title-row">
                    <h2>${this.escapeHtml(champ.name)}</h2>
                    ${warnings.map(w => `<span class="warn-inline">⚠ ${w}</span>`).join(' ')}
                    ${canEdit ? `
                    <div class="campeonato-actions">
                        ${this.isLegacyChampionship(champ) ? '<button id="btn-migrate-legacy" class="btn-primary btn-narrow">🧭 Identificar participantes</button>' : ''}
                        <button id="btn-import-plays-campeonato" class="btn-primary btn-narrow">+ Importar Partidas</button>
                        <button id="btn-add-manual-play" class="btn-secondary btn-narrow">+ Añadir Partida Manual</button>
                        <button id="btn-delete-campeonato" class="btn-danger btn-narrow">✕ Borrar Campeonato</button>
                    </div>` : ''}
                </div>
                <div class="detail-badges">${badges}</div>
                ${champ.description ? `<p class="detail-desc">${this.escapeHtml(champ.description)}</p>` : ''}
            </div>
            <div class="campeonato-duo">
                <section class="campeonato-section">
                    <h3>Clasificación</h3>
                    ${standingsHtml}
                </section>
                <section class="campeonato-section champ-chart-section">
                    <h3>Evolución de puntos</h3>
                    ${champPlaysChrono.length > 0 ? `
                    <div class="champ-chart-wrap"><canvas id="chart-champ-evolution"></canvas></div>` : '<div class="campeonato-empty">Con la primera partida verás aquí la evolución acumulada.</div>'}
                </section>
            </div>
            <section class="campeonato-section campeonato-plays-panel">
                <h3>Partidas (${champPlaysChrono.length})</h3>
                <div class="campeonato-plays-list">${playsHtml}</div>
            </section>
        `;

        // Chart de evolucion acumulada: cada punto suma los puntos (0-11) de esa carrera
        // al total del jugador; eje Y adaptado al maximo acumulado del campeonato.
        const canvas = document.getElementById('chart-champ-evolution');
        if (canvas && champPlaysChrono.length > 0) {
            const labels = champPlaysChrono.map(p => `${this.getTrackFlag(p.board)} ${p.board}`);
            const tracked = standings.slice(0, 8);
            const datasets = tracked.map(s => {
                let cumulative = 0;
                const data = champPlaysChrono.map(p => {
                    const ps = p.playerScores.find(item => String(this.championshipKeyResolver(champ)(item.playerRefId)) === String(s.id));
                    cumulative += ps ? (ps.scoreNum || 0) : 0;
                    return cumulative;
                });
                return {
                    label: s.name,
                    data,
                    borderColor: this.participantColor(champ, s.id),
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                    tension: 0.1,
                    fill: false
                };
            });
            const maxTotal = Math.max(...standings.map(s => Math.round(s.totalScore)), 1);
            // Escala: empieza en 0 y el tope se adapta al maximo acumulado del campeonato.
            const niceMax = m => Math.max(10, Math.ceil(m / 5) * 5);
            if (this.charts.champEvolution) this.charts.champEvolution.destroy();
            this.charts.champEvolution = new Chart(canvas, {
                type: 'line',
                data: { labels, datasets },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, boxHeight: 8 } } },
                    scales: {
                        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false } },
                        y: { beginAtZero: true, suggestedMax: niceMax(maxTotal), ticks: { precision: 0, maxTicksLimit: 5 } }
                    }
                }
            });
        }

        const importBtn = document.getElementById('btn-import-plays-campeonato');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.openImportPlaysModal();
            });
        }
        const addManualBtn = document.getElementById('btn-add-manual-play');
        if (addManualBtn) {
            addManualBtn.addEventListener('click', () => {
                this.openAddManualPlayModal();
            });
        }
        const migrateBtn = document.getElementById('btn-migrate-legacy');
        if (migrateBtn) {
            migrateBtn.addEventListener('click', async () => {
                // FIX-HDH-09: calcula la resolución, muestra el informe y pide confirmación
                // antes de convertir el campeonato a v2.
                const resolution = this.resolveLegacyChampionship(champ);
                if (!resolution.ok) {
                    alert(`No se pudo resolver automáticamente:\n\n${resolution.reason}`);
                    return;
                }
                const lines = resolution.entries.map(e =>
                    `#${e.legacyId} → ${e.name}${e.userid ? ` (BGG ${e.userid})` : ''} [${e.type}]${e.unverified ? ' ⚠ sin partidas: por confirmar' : ''}`
                ).join('\n');
                const okToApply = confirm(
                    `Resolución automática (${resolution.playsMatched}/${resolution.playsTotal} partidas casadas por circuito y fecha con puntajes coincidentes):\n\n${lines}\n\n¿Convertir el campeonato a identidades estables? Esta operación reescribe el campeonato.`
                );
                if (!okToApply) return;
                const applied = await this.applyLegacyResolution(champ, resolution);
                if (applied) {
                    await this.loadChampionships();
                    await this.selectChampionship(champ.id);
                } else {
                    alert('No se pudo aplicar la resolución.');
                }
            });
        }
        const deleteBtn = document.getElementById('btn-delete-campeonato');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (confirm('¿Eliminar este campeonato? Esta acción no se puede deshacer.')) {
                    this.deleteChampionship(champ.id);
                }
            });
        }
        content.querySelectorAll('.remove-play').forEach(btn => {
            btn.addEventListener('click', () => {
                if (confirm('¿Eliminar esta partida del campeonato?')) {
                    this.removePlayFromChampionship(champ.id, btn.dataset.playId);
                }
            });
        });
        // HDH-UI06: clic en una partida del campeonato abre la modal de carrera;
        // el botón de borrar (remove-play) no abre nada.
        content.querySelectorAll('.campeonato-play-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.closest('.remove-play')) return;
                this.openRaceModal(item.dataset.openRace, champ);
            });
        });
    },

    // FIX-HDH-08: identidad estable de participantes. Los usuarios BGG se identifican
    // por su userid (viaja en el XML de cada partida y no rota entre exportaciones);
    // bots y jugadores sin cuenta BGG usan una clave sintética persistente basada en
    // su nombre (el exportador mantiene el registro entre sesiones).
    // FIX-HDH-09: misma identidad que serializa el exportador — bgg:<userid> para
    // cuentas BGG y local-<slug> para bots y jugadores sin cuenta (syntheticUserid),
    // de modo que un id de campeonato legacy resuelto contra la tabla de una
    // exportación coincide con la identidad que graban los campeonatos v2.
    identityKey(player) {
        if (!player) return null;
        const uid = String(player.userid || '').trim();
        if (uid && uid !== '0') return `bgg:${uid}`;
        return `local-${String(player.name || '').trim().toLocaleLowerCase('es-ES').replace(/[^a-z0-9]+/g, '-')}`;
    },

    playerKey(name) {
        return String(name || '').trim().toLocaleLowerCase('es-ES');
    },

    participantRefsOf(champ) {
        return (champ && champ.participantRefs && typeof champ.participantRefs === 'object')
            ? champ.participantRefs
            : {};
    },

    participantMeta(player) {
        return {
            name: player.name,
            isMain: !!player.isMain,
            isBot: !!player.isBot,
            isOther: !!player.isOther,
            color: this.playerColor(player.name) || null,
            verified: true
        };
    },

    // Resuelve la clave de identidad de un playerRefId de una partida. En formato v2
    // las partidas guardadas ya llevan la clave; los ids numéricos de BGG se resuelven
    // contra la tabla de la exportación en curso en el momento de importar. Los
    // campeonatos legacy (sin formato) conservan el comportamiento previo tal cual:
    // sus ids no identifican a nadie y su migración se hará aparte, guiada (S5).
    championshipKeyResolver(champ) {
        const refs = this.participantRefsOf(champ);
        const declared = new Set(((champ && champ.participants) || []).map(k => String(k)));
        return (refId) => {
            const raw = String(refId);
            const isV2 = Object.keys(refs).length > 0 || (champ && champ.schemaVersion >= 2);
            if (!isV2) return raw; // legacy: sin identificar, tal como hoy.
            if (refs[raw] || declared.has(raw)) return raw;
            const player = this.data.players.find(p => String(p.id) === raw);
            if (player) return this.identityKey(player);
            const byIdentity = this.data.players.find(p => this.identityKey(p) === raw);
            if (byIdentity) return raw;
            return `id-${raw}`;
        };
    },

    // Reescribe los playerRefId de una partida a claves de identidad (copia; no
    // muta la partida original del histórico global).
    canonicalizePlay(champ, play) {
        const resolver = this.championshipKeyResolver(champ);
        return {
            ...play,
            playerScores: (play.playerScores || []).map(ps => ({ ...ps, playerRefId: resolver(ps.playerRefId) }))
        };
    },

    // Nombre de un participante a partir de cualquier ref (id BGG o clave).
    playerNameByRef(champ, refId) {
        return this.playerNameByKey(champ, this.championshipKeyResolver(champ)(refId));
    },

    // Claves efectivas de participantes: del formato v2 tal cual; legacy devuelve
    // sus ids sin interpretar (S5: congelado hasta migración guiada).
    effectiveParticipantKeys(champ) {
        const refs = this.participantRefsOf(champ);
        if (Object.keys(refs).length > 0 || champ.schemaVersion >= 2) {
            return new Set(((champ && champ.participants) || []).map(k => String(k)));
        }
        const keys = new Set();
        for (const pid of (champ && champ.participants) || []) keys.add(String(pid));
        if (keys.size === 0) {
            for (const play of (champ && champ.plays) || []) {
                for (const ps of play.playerScores || []) keys.add(String(ps.playerRefId));
            }
        }
        return keys;
    },

    isLegacyChampionship(champ) {
        return !!champ && !champ.schemaVersion && Object.keys(this.participantRefsOf(champ)).length === 0;
    },

    // FIX-HDH-09: motor de resolución legacy. Casa cada partida guardada del
    // campeonato contra el histórico global por (circuito, fecha) y verifica el
    // alineamiento posicional de puntajes (el orden de jugadores de una partida no
    // cambia). Duplicados (circuito, fecha): se desambiguan comparando puntajes
    // paralelos; si siguen empatados, la resolución queda inválida para revisión.
    resolveLegacyChampionship(champ) {
        const invalid = { ok: false, reason: '', entries: [], playsMatched: 0, playsTotal: 0 };
        if (!this.isLegacyChampionship(champ)) {
            invalid.reason = 'El campeonato no es legacy (ya tiene identidades).';
            return invalid;
        }
        const byKey = {};
        for (const play of this.data.plays || []) {
            (byKey[`${play.board}|${play.playDate}`] = byKey[`${play.board}|${play.playDate}`] || []).push(play);
        }
        const mapping = {}; // id legacy -> identidad estable
        const entries = [];
        let matched = 0;
        const plays = (champ.plays || []);
        for (const stored of plays) {
            const cands = byKey[`${stored.board}|${stored.playDate}`] || [];
            let global = null;
            if (cands.length === 1) global = cands[0];
            else if (cands.length > 1) {
                global = cands.find(gp => gp.playerScores.length === stored.playerScores.length
                    && gp.playerScores.every((ps, i) => ps.scoreNum === stored.playerScores[i].scoreNum && ps.winner === stored.playerScores[i].winner)) || null;
            }
            if (!global) {
                invalid.reason = `La partida ${stored.board} del ${stored.playDate || 'sin fecha'} no casó o es ambigua en el histórico global. Reporta qué jugador era cada uno y aplicamos la resolución manual.`;
                invalid.playsMatched = matched;
                invalid.playsTotal = plays.length;
                return invalid;
            }
            if (global.playerScores.length !== stored.playerScores.length
                || !global.playerScores.every((ps, i) => ps.scoreNum === stored.playerScores[i].scoreNum && ps.winner === stored.playerScores[i].winner)) {
                invalid.reason = `La partida ${stored.board} del ${stored.playDate || 'sin fecha'} no coincide posición a posición con el histórico (¿jugadores distintos en la copia guardada?).`;
                invalid.playsMatched = matched;
                invalid.playsTotal = plays.length;
                return invalid;
            }
            matched++;
            global.playerScores.forEach((ps, i) => {
                const legacyRef = String(stored.playerScores[i].playerRefId);
                const player = this.data.players.find(p => String(p.id) === String(ps.playerRefId));
                if (!player) {
                    mapping[legacyRef] = mapping[legacyRef] || {
                        name: `Jugador ${ps.playerRefId}`, isMain: false, isBot: false, isOther: false, color: null, verified: false
                    };
                    return;
                }
                const key = this.identityKey(player);
                if (mapping[legacyRef] && mapping[legacyRef].name && mapping[legacyRef].name !== player.name) {
                    // El mismo id legacy resolvió a dos jugadores distintos: inválido.
                    invalid.reason = `El id ${legacyRef} resuelve a ${player.name} y a ${mapping[legacyRef].name}: revisión manual.`;
                    invalid.entries = entries.slice();
                    invalid.playsMatched = matched;
                    invalid.playsTotal = plays.length;
                    global = null;
                }
                if (!global) return;
                if (!mapping[legacyRef]) {
                    mapping[legacyRef] = this.participantMeta(player);
                    entries.push({
                        legacyId: legacyRef,
                        identity: key,
                        name: player.name,
                        userid: String(player.userid || '').trim(),
                        type: player.isBot ? 'Bot' : player.isMain ? 'Principal' : 'Otro',
                        color: mapping[legacyRef].color,
                        plays: [`${stored.board} ${stored.playDate || ''}`.trim()]
                    });
                } else if (mapping[legacyRef].verified) {
                    const entry = entries.find(e => e.legacyId === legacyRef);
                    entry.plays.push(`${stored.board} ${stored.playDate || ''}`.trim());
                }
            });
            if (invalid.reason) break;
        }
        if (invalid.reason) return { ...invalid, ok: false };
        // Participantes declarados que no aparecen en partidas casadas: informe con marca.
        const resolvedIds = new Set(Object.keys(mapping));
        for (const pid of (champ.participants || []).map(id => String(id))) {
            if (!resolvedIds.has(pid)) {
                const resolved = this.playerNameByKey(champ, pid);
                entries.push({ legacyId: pid, identity: this.identityKey(this.data.players.find(p => String(p.id) === pid) || {}), name: resolved, userid: String((this.data.players.find(p => String(p.id) === pid) || {}).userid || ''), type: 'sin partidas', color: null, plays: [], unverified: true });
                mapping[pid] = { name: resolved, isMain: false, isBot: false, isOther: false, color: null, verified: false };
            }
        }
        return { ok: true, entries, mapping, playsMatched: matched, playsTotal: plays.length };
    },

    // Aplica una resolución previamente calculada (y confirmada por el usuario)
    // convirtiendo el campeonato a v2: participantes por identidad, snapshot y
    // carreras canonicalizadas. Persiste en Firestore (admin) o local.
    async applyLegacyResolution(champ, resolution) {
        if (!this.isLegacyChampionship(champ) || !resolution || !resolution.ok) return false;
        const refs = {};
        for (const [legacyId, meta] of Object.entries(resolution.mapping)) {
            const key = meta.name && meta.verified !== false && meta.color ? this.identityKey(this.data.players.find(p => p.name === meta.name) || {}) : null;
            if (!key) continue;
            refs[legacyId] = meta;
            // Y el formato final: participants = identidades; participantRefs por identidad.
        }
        const participants = [];
        const refsByIdentity = {};
        for (const [legacyId, meta] of Object.entries(resolution.mapping)) {
            const player = this.data.players.find(p => p.name === meta.name);
            const key = player ? this.identityKey(player) : legacyId;
            if (!refsByIdentity[key]) {
                refsByIdentity[key] = player ? this.participantMeta(player)
                    : { name: meta.name, isMain: false, isBot: false, isOther: false, color: null, verified: false, legacyId };
                participants.push(key);
            }
        }
        const converted = {
            ...champ,
            schemaVersion: 2,
            participants,
            participantRefs: refsByIdentity,
            playIds: (champ.plays || []).map(play => play.id),
            plays: (champ.plays || []).map(play => ({
                ...play,
                playerScores: (play.playerScores || []).map(ps => ({
                    ...ps,
                    playerRefId: resolution.mapping[String(ps.playerRefId)] && this.data.players.find(p => p.name === resolution.mapping[String(ps.playerRefId)].name)
                        ? this.identityKey(this.data.players.find(p => p.name === resolution.mapping[String(ps.playerRefId)].name))
                        : String(ps.playerRefId)
                }))
            }))
        };
        await this.saveChampionshipToServer(converted);
        return true;
    },

    // Color del participante: congelado en el snapshot del campeonato (S4); si no
    // hay snapshot, cae a la config de colores por nombre.
    participantColor(champ, key) {
        const meta = this.participantRefsOf(champ)[key];
        if (meta && meta.color) return meta.color;
        return this.playerColor(this.playerNameByKey(champ, key));
    },

    playerNameByKey(champ, key) {
        const meta = this.participantRefsOf(champ)[key];
        if (meta && meta.name) return meta.name;
        const player = this.data.players.find(p => this.identityKey(p) === String(key));
        if (player) return player.name;
        // Legacy: ids sin identificar resueltos contra la tabla actual (comportamiento
        // congelado hasta la migración guiada; es el defecto original reportado).
        const byId = this.data.players.find(p => String(p.id) === String(key));
        if (byId) return byId.name;
        return key.startsWith('id-') ? `Jugador ${key.slice(3)}` : key;
    },

    getChampionshipStandings(champ) {
        if (!champ) return [];
        const allPlays = champ.plays || [];

        // Tiempo de carrera seguro (evita NaN con fechas ausentes o invalidas).
        const playTime = p => {
            const t = new Date(p && p.playDate).getTime();
            return Number.isNaN(t) ? 0 : t;
        };
        // Carrera mas reciente del campeonato (criterio de desempate).
        const latestPlay = allPlays.slice()
            .sort((a, b) => playTime(b) - playTime(a) || String(b.id).localeCompare(String(a.id)))[0] || null;
        // Puesto de un jugador en una carrera (1 = mejor puesto). FIX-HDH-08: se
        // compara por clave de identidad, no por id.
        const resolver = this.championshipKeyResolver(champ);
        const positionInPlay = (play, key) => {
            if (!play) return null;
            const ranked = (play.playerScores || [])
                .map(ps => ({ key: resolver(ps.playerRefId), scoreNum: ps.scoreNum || 0 }))
                .sort((a, b) => b.scoreNum - a.scoreNum);
            const idx = ranked.findIndex(s => s.key === String(key));
            return idx === -1 ? null : idx + 1;
        };

        const allPlayerKeys = new Set();
        for (const play of allPlays) {
            for (const ps of play.playerScores) {
                allPlayerKeys.add(resolver(ps.playerRefId));
            }
        }

        // FIX-HDH-08: los participantes se declaran por clave, no por id.
        const declaredKeys = this.effectiveParticipantKeys(champ);
        const effectiveKeys = declaredKeys.size > 0 ? declaredKeys : allPlayerKeys;
        const refs = this.participantRefsOf(champ);

        const stats = {};
        for (const key of effectiveKeys) {
            const playerName = (refs[key] && refs[key].name) || this.playerNameByKey(champ, key);
            stats[key] = { id: key, name: playerName, plays: 0, wins: 0, totalScore: 0 };
        }

        for (const play of allPlays) {
            for (const ps of play.playerScores) {
                const key = resolver(ps.playerRefId);
                if (effectiveKeys.has(key) && stats[key]) {
                    stats[key].plays++;
                    if (ps.winner) stats[key].wins++;
                    stats[key].totalScore += ps.scoreNum || 0;
                }
            }
        }

        return Object.values(stats)
            .filter(s => s.plays > 0)
            .sort((a, b) => {
                // 1) Puntos totales.
                if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
                // 2) Desempate: mejor puesto en la carrera mas reciente del campeonato.
                if (latestPlay) {
                    const posA = positionInPlay(latestPlay, a.id);
                    const posB = positionInPlay(latestPlay, b.id);
                    if (posA !== null && posB !== null && posA !== posB) return posA - posB;
                }
                // 3) Desempate historico: victorias.
                if (b.wins !== a.wins) return b.wins - a.wins;
                // 4) Orden deterministico por nombre.
                return a.name.localeCompare(b.name);
            })
            .map(s => ({ ...s, avg: s.plays > 0 ? (s.totalScore / s.plays).toFixed(1) : '0.0' }));
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    setCookie(name, value, days = 365) {
        const expires = new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = name + '=' + encodeURIComponent(JSON.stringify(value)) + '; expires=' + expires + '; path=/';
    },

    getCookie(name) {
        const match = document.cookie.split('; ').find(c => c.startsWith(name + '='));
        if (!match) return null;
        try {
            return JSON.parse(decodeURIComponent(match.split('=').slice(1).join('=')));
        } catch {
            return null;
        }
    },

    getPlayerOverrides() {
        return this.getCookie('hdh-player-overrides') || {};
    },

    savePlayerOverrides(overrides) {
        if (!this.hasCookieConsent()) return;
        this.setCookie('hdh-player-overrides', overrides);
    },

    hasCookieConsent() {
        const val = this.getCookie('hdh-cookie-consent');
        return val === 'accepted';
    },

    setCookieConsent(accepted) {
        this.setCookie('hdh-cookie-consent', accepted ? 'accepted' : 'rejected');
    },

    setupCookieConsent() {
        document.getElementById('btn-accept-cookies').addEventListener('click', () => {
            this.setCookieConsent(true);
            document.getElementById('cookie-consent-banner').classList.add('hidden');
        });
        document.getElementById('btn-reject-cookies').addEventListener('click', () => {
            this.setCookieConsent(false);
            document.getElementById('cookie-consent-banner').classList.add('hidden');
            document.cookie = 'hdh-player-overrides=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
        });
        if (!this.hasCookieConsent()) {
            document.getElementById('cookie-consent-banner').classList.remove('hidden');
        }
    },

    applyPlayerOverrides() {
        if (!this.originalPlayers) {
            this.originalPlayers = this.data.players.map(p => ({ ...p }));
        }
        const overrides = this.getPlayerOverrides();
        for (const player of this.data.players) {
            const override = overrides[player.name];
            if (override !== undefined) {
                player.isBot = override === 'bot';
                player.isMain = override === 'main';
                player.isOther = override === 'other';
            } else {
                const orig = this.originalPlayers.find(op => op.name === player.name);
                if (orig) {
                    player.isBot = orig.isBot;
                    player.isMain = orig.isMain;
                    player.isOther = orig.isOther;
                }
            }
        }
    },

    togglePlayerClassification(playerName, newType) {
        const player = this.data.players.find(p => p.name === playerName);
        if (!player) return;
        const overrides = this.getPlayerOverrides();
        if (newType === 'auto') {
            delete overrides[playerName];
        } else {
            overrides[playerName] = newType;
        }
        this.savePlayerOverrides(overrides);
        this.applyPlayerOverrides();
        this.populateFilters();
        this.updateHeaderStats();
        this.renderAll();
        this.renderPlayerManager();
    },

    setupPlayerManager() {
        document.getElementById('btn-manage-players').addEventListener('click', () => {
            this.renderPlayerManager();
            document.getElementById('player-manager-modal').classList.remove('hidden');
        });
        document.getElementById('btn-close-player-manager').addEventListener('click', () => {
            document.getElementById('player-manager-modal').classList.add('hidden');
        });
    },

    renderPlayerManager() {
        const list = document.getElementById('player-manager-list');
        const overrides = this.getPlayerOverrides();
        list.innerHTML = this.data.players.map(p => {
            const override = overrides[p.name];
            const currentType = override || (p.isBot ? 'bot' : p.isMain ? 'main' : 'other');
            const isAuto = override === undefined;
            return `
                <div class="player-manager-row">
                    <span class="player-manager-name">${p.name}</span>
                    <select class="player-manager-select" data-player-name="${p.name}" ${isAuto ? 'data-auto="true"' : ''}>
                        <option value="main" ${currentType === 'main' ? 'selected' : ''}>Principal</option>
                        <option value="bot" ${currentType === 'bot' ? 'selected' : ''}>Bot</option>
                        <option value="other" ${currentType === 'other' ? 'selected' : ''}>Otro</option>
                        <option value="auto" ${isAuto ? 'selected' : ''}>Auto (BGG)</option>
                    </select>
                </div>
            `;
        }).join('');
        list.querySelectorAll('.player-manager-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const playerName = e.target.dataset.playerName;
                this.togglePlayerClassification(playerName, e.target.value);
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
