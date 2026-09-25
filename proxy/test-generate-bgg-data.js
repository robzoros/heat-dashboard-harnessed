process.env.BGG_MAX_ATTEMPTS = '3';
process.env.BGG_RETRY_BASE_MS = '1';

const assert = require('assert');
const { makeRequestWithRetry } = require('./scripts/generate-bgg-data');

async function run() {
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

    console.log('BGG retry tests passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
