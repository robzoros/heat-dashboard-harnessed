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
        this.populateFilters();
        this.updateHeaderStats();
        this.renderAll();
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
        if (maxWins <= 0) leaderName = '-';

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
        const trackDisplay = trackName !== '-' ? `${this.getTrackFlag(trackName)} ${trackName}` : '-';

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

        document.getElementById('kpi-leader').textContent = leaderName;
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

        const places = [
            { rank: 2, data: top3[1], cls: 'second', medal: '🥈' },
            { rank: 1, data: top3[0], cls: 'first', medal: '🥇' },
            { rank: 3, data: top3[2], cls: 'third', medal: '🥉' }
        ];

        podiumEl.innerHTML = places
            .filter(p => p.data)
            .map(p => `
                <div class="podium-place ${p.cls}">
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
        this.charts.wins.update();

        // Plays by month chart
        const playsByMonth = {};
        for (const play of filteredPlays) {
            const month = play.playDate.substring(0, 7);
            playsByMonth[month] = (playsByMonth[month] || 0) + 1;
        }
        const sortedMonths = Object.keys(playsByMonth).sort();
        this.charts.playsMonth.data.labels = sortedMonths;
        this.charts.playsMonth.data.datasets[0].data = sortedMonths.map(m => playsByMonth[m]);
        this.charts.playsMonth.update();

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
        this.charts.avgPts.update();

        // Track distribution doughnut chart
        const playsByTrack = {};
        for (const play of filteredPlays) {
            playsByTrack[play.board] = (playsByTrack[play.board] || 0) + 1;
        }
        const trackLabels = Object.keys(playsByTrack).sort();
        const trackData = trackLabels.map(t => playsByTrack[t]);
        this.charts.tracks.data.labels = trackLabels;
        this.charts.tracks.data.datasets[0].data = trackData;
        this.charts.tracks.update();

        // Wins evolution chart: cumulative wins by date per main player (max 10)
        const top10Players = mainPlayers.slice(0, 10);
        const allDates = [...new Set(filteredPlays.map(p => p.playDate))].sort();
        const colors = ['#e94560', '#0f3460', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4', '#ff5722', '#795548', '#607d8b', '#ffc107'];

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
                borderColor: colors[idx % colors.length],
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

    renderTrackList() {
        const filteredPlays = this.getFilteredPlays();
        const mainPlayers = this.data.players.filter(p => p.isMain);

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
            const avg = stats.scoresCount > 0 ? (stats.totalScore / stats.scoresCount).toFixed(1) : '0.0';
            let championName = '-';
            let maxWins = 0;
            for (const [pid, wins] of Object.entries(stats.winsByPlayer)) {
                if (wins > maxWins) {
                    maxWins = wins;
                    const player = this.data.players.find(p => p.id === parseInt(pid));
                    championName = player ? player.name : '-';
                }
            }
            return { name, plays: stats.plays, avg, champion: championName };
        })
        .sort((a, b) => b.plays - a.plays);

        document.getElementById('track-list').innerHTML = trackList.map(t => `
            <div class="track-card">
                <h4>${this.getTrackFlag(t.name)} ${t.name}</h4>
                <p>Partidas: ${t.plays}</p>
                <p>Pts Medio: ${t.avg}</p>
                <p>Campeón: ${t.champion}</p>
            </div>
        `).join('');
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
                const playId = entry.dataset.playId;
                const details = document.getElementById(`details-${playId}`);
                details.classList.toggle('expanded');
            });
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
window.App = App;
