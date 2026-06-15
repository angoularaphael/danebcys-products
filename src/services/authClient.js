// Client HTTP vers auth-service:3001
const http = require('http');
const https = require('https');
const env = require('../config/env');

// Appelle Auth-service port 3001 avec la clé inter-services.
function callAuth(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.AUTH_SERVICE_URL);
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
            const err = new Error(parsed.error || `Auth Service ${res.statusCode}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (_e) {
          reject(new Error('Réponse invalide du Auth Service'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Auth Service injoignable: ${err.message}`)));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Auth Service timeout (5s)'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// Valide un access token JWT auprès d'auth-service.
// Appel : POST {AUTH_SERVICE_URL}/internal/validate-token
async function validateToken(accessToken) {
  return callAuth('POST', '/internal/validate-token', { accessToken });
}

// Récupère un utilisateur par id auprès d'auth-service.
// Appel : GET {AUTH_SERVICE_URL}/internal/users/:userId
async function getUserById(userId) {
  return callAuth('GET', `/internal/users/${userId}`);
}

module.exports = { validateToken, getUserById };
