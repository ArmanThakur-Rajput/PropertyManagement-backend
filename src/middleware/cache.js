/**
 * In-memory response cache middleware
 *
 * Use on public, read-heavy endpoints that don't change often.
 * Data is cached in RAM on the server — no Redis required.
 *
 * Usage:
 *   import { cache } from '../middleware/cache.js';
 *   router.get('/counts', cache(300), getPropertyCounts);   // 5-min cache
 *   router.get('/',       cache(60),  getAllProperties);     // 1-min cache
 */

const store = new Map(); // key → { data, expiresAt }

/**
 * @param {number} ttlSeconds  How long to cache the response
 */
export const cache = (ttlSeconds = 60) => (req, res, next) => {
  // Only cache GET requests
  if (req.method !== 'GET') return next();

  const key = req.originalUrl;
  const hit = store.get(key);

  if (hit && hit.expiresAt > Date.now()) {
    // Cache hit — send stored response immediately
    return res.status(200).json(hit.data);
  }

  // Cache miss — intercept res.json to store the response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful responses
    if (res.statusCode === 200 && body?.success) {
      store.set(key, { data: body, expiresAt: Date.now() + ttlSeconds * 1000 });
    }
    return originalJson(body);
  };

  next();
};

/**
 * Call this after any write operation that affects cached endpoints.
 * Pass a prefix to clear only matching keys (e.g. '/api/properties').
 */
export const invalidateCache = (prefix = '') => {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
};

// Auto-cleanup expired entries every 10 minutes to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store.entries()) {
    if (val.expiresAt <= now) store.delete(key);
  }
}, 10 * 60 * 1000);
