process.env.BGG_MAX_ATTEMPTS = '3';
process.env.BGG_RETRY_BASE_MS = '1';

const assert = require('assert');
const { makeRequestWithRetry, canonicalPlayerName, normalizeData } = require('./scripts/generate-bgg-data');

function testCanonicalPlayerName() {
    // FIX-HDH-11: alias de visualización.
    assert.strictEqual(canonicalPlayerName('Alfonso Daganzo'), 'Alfonso');
    assert.strictEqual(canonicalPlayerName('alfonso daganzo'), 'Alfonso');
    assert.strictEqual(canonicalPlayerName('  Alfonso Daganzo  '), 'Alfonso');
    assert.strictEqual(canonicalPlayerName('Alfonso'), 'Alfonso');
    assert.strictEqual(canonicalPlayerName('Calvo'), 'Calvo');
    assert.strictEqual(canonicalPlayerName(''), '');
    assert.strictEqual(canonicalPlayerName(undefined), '');
    console.log('canonicalPlayerName tests passed');
}

function testNormalizeDataAliasConverges() {
    // Partidas antiguas con el nombre pre-rename y una nueva con el post-rename:
    // ambas deben converger en UNA entrada de jugador con el mismo userid.
    const rawPlays = [
        {
            $: { id: '1', date: '2026-01-01', location: '' },
            comments: 'Circuito [1]',
            players: {
                player: [
                    { $: { name: 'Alfonso Daganzo', username: 'alfongmr', userid: '1428263', score: '30', win: '1' } },
                    { $: { name: 'Calvo', username: '', userid: '0', score: '20', win: '0' } }
                ]
            }
        },
        {
            $: { id: '2', date: '2026-02-02', location: '' },
            comments: 'Circuito [1]',
            players: {
                player: [
                    { $: { name: 'Alfonso', username: 'alfongmr', userid: '1428263', score: '25', win: '0' } },
                    { $: { name: 'Calvo', username: '', userid: '0', score: '15', win: '1' } }
                ]
            }
        }
    ];
    const data = normalizeData(rawPlays);
    const alfonso = data.players.filter(p => p.userid === '1428263');
    assert.strictEqual(alfonso.length, 1, 'una única entrada para el jugador renombrado');
    assert.strictEqual(alfonso[0].name, 'Alfonso');
    assert.strictEqual(data.players.filter(p => p.name === 'Alfonso Daganzo').length, 0, 'no queda la entrada con el nombre antiguo');
    // El userid sintético del bot conserva el nombre original del XML (no el alias).
    const calvo = data.players.find(p => p.name === 'Calvo');
    assert.strictEqual(calvo.userid, 'local-calvo');
    // Todas las partidas apuntan al mismo playerRefId de Alfonso.
    const refIds = new Set(data.plays.flatMap(p => p.playerScores.map(ps => String(ps.playerRefId))));
    assert.strictEqual(refIds.has(String(alfonso[0].id)), true, 'las dos partidas referencian a Alfonso');
    assert.strictEqual(refIds.size, 2, 'solo hay dos jugadores en total');
    console.log('normalizeData alias tests passed');
}

async function run() {
    testCanonicalPlayerName();
    testNormalizeDataAliasConverges();

    let calls = 0;
    const response = await makeRequestWithRetry({}, null, 'test retry', async () => {
        calls++;
        return calls < 3
            ? { statusCode: 403, headers: { 'retry-after': '0' } }
            : { statusCode: 204, headers: {} };
    });
    assert.strictEqual(calls, 3, 'debe reintentar errores transitorios');
    assert.strictEqual(response.statusCode, 204);

    calls = 0;
    const unauthorized = await makeRequestWithRetry({}, null, 'test no retry', async () => {
        calls++;
        return { statusCode: 401, headers: {} };
    });
    assert.strictEqual(calls, 1, 'no debe reintentar errores de autenticación');
    assert.strictEqual(unauthorized.statusCode, 401);

    console.log('BGG export tests passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
