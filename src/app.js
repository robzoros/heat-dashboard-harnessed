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

    init() {
        this.setupTabs();
        this.setupFilters();
        this.setupModal();
        this.initCharts();
        this.updateHeaderStats();
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
            document.getElementById('filter-panel').classList.toggle('collapsed');
        });

        document.getElementById('filter-active').addEventListener('change', (e) => {
            this.filters.active = e.target.checked;
        });

        document.getElementById('player-filter-mode').addEventListener('change', (e) => {
            this.filters.playerMode = e.target.value;
        });

        document.getElementById('btn-apply-filters').addEventListener('click', () => {
            this.applyFilters();
        });
    },

    setupModal() {
        document.getElementById('btn-load-data').addEventListener('click', () => {
            document.getElementById('login-modal').classList.remove('hidden');
        });

        document.getElementById('btn-cancel-login').addEventListener('click', () => {
            document.getElementById('login-modal').classList.add('hidden');
        });

        document.getElementById('btn-login').addEventListener('click', () => {
            const username = document.getElementById('bgg-username').value;
            const password = document.getElementById('bgg-password').value;
            this.loadData(username, password);
        });
    },

    async loadData(username, password) {
        try {
            const response = await fetch('/bgg-api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            document.getElementById('login-modal').classList.add('hidden');
            if (result.success && result.data) {
                this.data = result.data;
                console.log('BGG Data loaded:');
                console.log('Players:', this.data.players);
                console.log('Locations:', this.data.locations);
                console.log('Boards:', this.data.boards);
                console.log('Plays:', this.data.plays);
            }
            this.populateFilters();
            this.updateHeaderStats();
            this.renderAll();
        } catch (error) {
            console.error('Error loading data:', error);
            this.loadMockData();
        }
    },

    loadMockData() {
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
                { id: 1, date: '2024-01-15', board: 'Circuit A', locationRefId: 1, players: [] },
                { id: 2, date: '2024-02-20', board: 'Circuit B', locationRefId: 2, players: [] }
            ],
            boards: [
                { id: 1, name: 'Circuit A' },
                { id: 2, name: 'Circuit B' }
            ]
        };
        this.populateFilters();
        this.updateHeaderStats();
        this.renderAll();
    },

    populateFilters() {
        const playerFilters = document.getElementById('player-filters');
        const trackFilters = document.getElementById('track-filters');
        const locationFilters = document.getElementById('location-filters');

        playerFilters.innerHTML = this.data.players
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
        return this.data.plays.filter(play => {
            if (this.filters.tracks.length && !this.filters.tracks.includes(play.board)) return false;
            if (this.filters.locations.length && !this.filters.locations.includes(String(play.locationRefId))) return false;
            return true;
        });
    },

    getFilteredPlayers() {
        return this.data.players;
    },

    initCharts() {
        this.charts.wins = new Chart(document.getElementById('chart-wins'), {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Victorias', data: [], backgroundColor: '#e94560' }] },
            options: { responsive: true, plugins: { legend: { display: false } } }
        });

        this.charts.playsMonth = new Chart(document.getElementById('chart-plays-month'), {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Partidas', data: [], borderColor: '#e94560', tension: 0.1 }] },
            options: { responsive: true, scales: { y: { ticks: { stepSize: 1 } } } }
        });

        this.charts.avgPts = new Chart(document.getElementById('chart-avgpts'), {
            type: 'bar',
            data: { labels: [], datasets: [{ label: 'Pts Medios', data: [], backgroundColor: '#0f3460' }] },
            options: { responsive: true, indexAxis: 'y' }
        });

        this.charts.tracks = new Chart(document.getElementById('chart-tracks'), {
            type: 'doughnut',
            data: { labels: [], datasets: [{ data: [], backgroundColor: ['#e94560', '#0f3460', '#16213e'] }] },
            options: { responsive: true }
        });

        this.charts.winsEvolution = new Chart(document.getElementById('chart-wins-evolution'), {
            type: 'line',
            data: { labels: [], datasets: [] },
            options: { responsive: true }
        });
    },

    renderAll() {
        this.renderKPIs();
        this.renderPodium();
        this.renderCharts();
        this.renderPlayersTable();
        this.renderTrackList();
        this.renderPlaysHistory();
    },

    renderKPIs() {
        document.getElementById('kpi-leader').textContent = '-';
        document.getElementById('kpi-track').textContent = '-';
        document.getElementById('kpi-streak').textContent = '-';
        document.getElementById('kpi-last').textContent = '-';
    },

    renderPodium() {
        document.getElementById('podium').innerHTML = '';
    },

    renderCharts() {
        Object.values(this.charts).forEach(chart => chart.update());
    },

    renderPlayersTable() {
        document.querySelector('#players-table tbody').innerHTML = '';
    },

    renderTrackList() {
        document.getElementById('track-list').innerHTML = '';
    },

    renderPlaysHistory() {
        document.getElementById('plays-history').innerHTML = '';
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
