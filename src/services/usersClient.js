// Client HTTP vers Users-service:3002
const http = require('http');
const https = require('https');
const env = require('../config/env');

// Appelle Users-service port 3002 avec la clé inter-services.
function callUsers(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.USERS_SERVICE_URL);
    const transport = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Service-Key': env.INTER_SERVICE_KEY
      }
    };

    const req = transport.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            const err = new Error(parsed.error || `Users Service ${res.statusCode}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (_e) {
          reject(new Error('Réponse invalide du Users Service'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Users Service injoignable: ${err.message}`)));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Users Service timeout (5s)'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Vérifie si un produit est dans les favoris d'un utilisateur.
// Appel : GET {USERS_SERVICE_URL}/internal/favorites/:userId/:adId
async function isFavorite(userId, adId) {
  const result = await callUsers('GET', `/internal/favorites/${userId}/${adId}`);
  return result.isFavorite;
}

module.exports = { isFavorite };
