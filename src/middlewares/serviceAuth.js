// Vérifie la clé X-Service-Key pour les routes /internal
const crypto = require('crypto');
const env = require('../config/env');

// Middleware Express — authentification inter-services via header X-Service-Key.
// Compare la clé hashée SHA-256 à env.INTER_SERVICE_KEY ; protège les routes /internal/*.
function serviceAuth(req, res, next) {
  const key = req.headers['x-service-key'];
  if (!key) return res.status(401).json({ error: 'Header X-Service-Key manquant' });

  const hashA = crypto.createHash('sha256').update(String(key)).digest();
  const hashB = crypto.createHash('sha256').update(String(env.INTER_SERVICE_KEY)).digest();

  if (!crypto.timingSafeEqual(hashA, hashB)) {
    return res.status(403).json({ error: 'Clé de service invalide' });
  }

  req.isService = true;
  next();
}

module.exports = { serviceAuth };
