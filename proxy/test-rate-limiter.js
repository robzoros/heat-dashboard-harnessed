const assert = require('assert');
const { checkLimit, buckets, WINDOW_MS } = require('./rate-limiter');

function mockReq(ip) {
    return { socket: { remoteAddress: ip }, headers: {} };
}

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✓ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ✗ ${name}: ${err.message}`);
        failed++;
    }
}

function resetBuckets() {
    buckets.clear();
}

test('allows requests under limit', () => {
    resetBuckets();
    const req = mockReq('1.2.3.4');
    for (let i = 0; i < 5; i++) {
        const result = checkLimit('login', 5, req);
        assert.strictEqual(result.allowed, true, `Request ${i + 1} should be allowed`);
    }
});

test('blocks request after exceeding limit', () => {
    resetBuckets();
    const req = mockReq('1.2.3.4');
    for (let i = 0; i < 5; i++) {
        checkLimit('login', 5, req);
    }
    const result = checkLimit('login', 5, req);
    assert.strictEqual(result.allowed, false);
    assert.strictEqual(typeof result.retryAfter, 'number');
    assert.ok(result.retryAfter > 0);
});

test('different IPs have separate limits', () => {
    resetBuckets();
    const req1 = mockReq('1.2.3.4');
    const req2 = mockReq('5.6.7.8');
    for (let i = 0; i < 5; i++) {
        checkLimit('login', 5, req1);
    }
    const result1 = checkLimit('login', 5, req1);
    const result2 = checkLimit('login', 5, req2);
    assert.strictEqual(result1.allowed, false);
    assert.strictEqual(result2.allowed, true);
});

test('different buckets have separate limits', () => {
    resetBuckets();
    const req = mockReq('1.2.3.4');
    for (let i = 0; i < 5; i++) {
        checkLimit('login', 5, req);
    }
    const loginResult = checkLimit('login', 5, req);
    const champResult = checkLimit('championships', 30, req);
    assert.strictEqual(loginResult.allowed, false);
    assert.strictEqual(champResult.allowed, true);
});

test('retryAfter is positive and reasonable', () => {
    resetBuckets();
    const req = mockReq('1.2.3.4');
    for (let i = 0; i < 5; i++) {
        checkLimit('login', 5, req);
    }
    const result = checkLimit('login', 5, req);
    assert.ok(result.retryAfter <= 60, `retryAfter ${result.retryAfter} should be <= 60s`);
    assert.ok(result.retryAfter >= 1, `retryAfter ${result.retryAfter} should be >= 1s`);
});

test('X-Forwarded-For header is used for IP', () => {
    resetBuckets();
    const req1 = { socket: { remoteAddress: '1.2.3.4' }, headers: { 'x-forwarded-for': '10.0.0.1' } };
    const req2 = { socket: { remoteAddress: '1.2.3.4' }, headers: { 'x-forwarded-for': '10.0.0.2' } };
    for (let i = 0; i < 5; i++) {
        checkLimit('login', 5, req1);
    }
    const result1 = checkLimit('login', 5, req1);
    const result2 = checkLimit('login', 5, req2);
    assert.strictEqual(result1.allowed, false);
    assert.strictEqual(result2.allowed, true);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
