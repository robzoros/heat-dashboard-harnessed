function classifyPlayers(players, plays) {
    const playCounts = {};
    for (const play of plays) {
        for (const ps of play.playerScores) {
            playCounts[ps.playerRefId] = (playCounts[ps.playerRefId] || 0) + 1;
        }
    }

    return players.map(p => {
        const isBot = p.userid === '0';
        const playCount = playCounts[p.id] || 0;
        const isOther = !isBot && playCount < 3;
        const isMain = !isBot && !isOther;
        return { ...p, isBot, isMain, isOther };
    });
}

module.exports = { classifyPlayers };
