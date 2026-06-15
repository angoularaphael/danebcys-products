// Limite le nombre de requêtes par utilisateur ou par IP
const env = require('../config/env');

// Store en mémoire des compteurs rate limit (clé → { count, resetAt }).
const store = new Map();

// Purge périodique des entrées expirées du store (toutes les 60 s) ; pas d'appel externe.
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 60_000).unref();

// Fabrique un middleware Express de limitation de débit par clé (user ID ou IP).
// Ne contacte aucun service externe ; lit env.RATE_LIMIT_* pour la configuration.
function createLimiter({ windowMs, max, keyFn }) {
  // Middleware Express : incrémente le compteur pour la clé et renvoie 429 si quota dépassé.
  return (req, res, next) => {
    const key = keyFn(req);
    if (!key) return next();

    const now = Date.now();
    let entry = store.get(key);

    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      store.set(key, entry);
    }

    entry.count++;

    const remaining = Math.max(0, max - entry.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(entry.resetAt / 1000)));

    if (entry.count > max) {
      return res.status(429).json({ error: 'Trop de requêtes, réessayez plus tard' });
    }

    next();
  };
}

// Limiteur pour les routes catalogue authentifiées (CRUD annonces, avis).
// Clé : user.id si authentifié, sinon IP client.
const productLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX_REQUESTS,
  keyFn: (req) => req.user ? `user:${req.user.id}` : (req.clientIp || req.ip)
});

// Limiteur pour /api/v1/search — quota plus généreux (min. 200 req/fenêtre).
// Clé : user.id si token présent, sinon IP client.
const searchLimiter = createLimiter({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: Math.max(env.RATE_LIMIT_MAX_REQUESTS, 200),
  keyFn: (req) => req.user ? `user:${req.user.id}` : (req.clientIp || req.ip)
});

module.exports = { createLimiter, productLimiter, searchLimiter };
