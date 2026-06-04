const RATE_LIMIT_DISABLED = process.env.RATE_LIMIT_DISABLED === 'true';
const RATE_LIMIT_LOGIN = parseInt(process.env.RATE_LIMIT_LOGIN, 10) || 5;
const RATE_LIMIT_TEST_LOGIN = parseInt(process.env.RATE_LIMIT_TEST_LOGIN, 10) || 10;
const RATE_LIMIT_CHAMPIONSHIPS = parseInt(process.env.RATE_LIMIT_CHAMPIONSHIPS, 10) || 30;
const WINDOW_MS = 60 * 1000;

const buckets = new Map();

function getClientIp(req) {
    return req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
}

function cleanExpired(now) {
    for (const [key, bucket] of buckets.entries()) {
        bucket.timestamps = bucket.timestamps.filter(ts => now - ts < WINDOW_MS);
        if (bucket.timestamps.length === 0) {
            buckets.delete(key);
        }
    }
}

function checkLimit(bucketKey, limit, req) {
    const now = Date.now();
    cleanExpired(now);

    const ip = getClientIp(req);
    const key = `${ip}:${bucketKey}`;

    if (!buckets.has(key)) {
        buckets.set(key, { timestamps: [] });
    }

    const bucket = buckets.get(key);
    bucket.timestamps.push(now);

    if (bucket.timestamps.length > limit) {
        const oldest = bucket.timestamps[0];
        const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
        return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }

    return { allowed: true };
}

function rateLimitMiddleware(bucketKey, limit) {
    return (req, res) => {
        if (RATE_LIMIT_DISABLED) return true;
        const result = checkLimit(bucketKey, limit, req);
        if (!result.allowed) {
            res.setHeader('Retry-After', String(result.retryAfter));
            res.setHeader('Content-Type', 'application/json');
            res.writeHead(429);
            res.end(JSON.stringify({
                success: false,
                error: 'Too many requests',
                retryAfter: result.retryAfter
            }));
            return false;
        }
        return true;
    };
}

const loginLimiter = rateLimitMiddleware('login', RATE_LIMIT_LOGIN);
const testLoginLimiter = rateLimitMiddleware('test-login', RATE_LIMIT_TEST_LOGIN);
const championshipsLimiter = rateLimitMiddleware('championships', RATE_LIMIT_CHAMPIONSHIPS);

module.exports = { loginLimiter, testLoginLimiter, championshipsLimiter, checkLimit, buckets, WINDOW_MS };
