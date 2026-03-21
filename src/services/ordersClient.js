const http = require('http');
const https = require('https');
const env = require('../config/env');

function callOrders(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.ORDERS_SERVICE_URL);
    const transport = url.protocol === 'https:' ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path,
      method: 'GET',
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
            const err = new Error(parsed.error || `Orders Service ${res.statusCode}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (_e) {
          reject(new Error('Réponse invalide du Orders Service'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Orders Service injoignable: ${err.message}`)));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Orders Service timeout (5s)'));
    });
    req.end();
  });
}

async function getTopPaidProducts(limit = 20) {
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  return callOrders(`/internal/orders/top-products?limit=${normalizedLimit}`);
}

async function canReview(userId, productId) {
  const params = new URLSearchParams({ userId, productId });
  const result = await callOrders(`/internal/orders/can-review?${params}`);
  return result.canReview === true;
}

module.exports = { getTopPaidProducts, canReview };
