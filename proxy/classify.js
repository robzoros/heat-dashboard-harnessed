function classifyPlayers(players, plays) {
    const playCounts = {};
    for (const play of plays) {
        for (const ps of play.playerScores) {
            playCounts[ps.playerRefId] = (playCounts[ps.playerRefId] || 0) + 1;
        }
    }

    return players.map(p => {
        // FIX-HDH-10: bot = sin cuenta BGG ('0') o userid sintético persistente 'local-*'
        // (introducido por FIX-HDH-08 para bots y no-BGG). Sin esta extensión, los bots
        // dejaban de detectarse tras el cambio del exportador.
        const isBot = p.userid === '0' || String(p.userid || '').startsWith('local-');
        const playCount = playCounts[p.id] || 0;
        const isOther = !isBot && playCount < 3;
        const isMain = !isBot && !isOther;
        return { ...p, isBot, isMain, isOther };
    });
}

module.exports = { classifyPlayers };
