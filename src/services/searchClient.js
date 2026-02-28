const http = require('http');
const https = require('https');
const env = require('../config/env');

function callSearch(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(env.SEARCH_SERVICE_URL);
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
            const err = new Error(parsed.error || `Search Service ${res.statusCode}`);
            err.statusCode = res.statusCode;
            return reject(err);
          }
          resolve(parsed);
        } catch (_e) {
          reject(new Error('Réponse invalide du Search Service'));
        }
      });
    });

    req.on('error', (err) => reject(new Error(`Search Service injoignable: ${err.message}`)));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Search Service timeout (5s)'));
    });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function indexProduct(data) {
  return callSearch('POST', '/internal/index', data);
}

async function bulkIndex(products) {
  return callSearch('POST', '/internal/index/bulk', { products });
}

async function cleanupIndex(productIds) {
  return callSearch('POST', '/internal/index/cleanup', { productIds });
}

async function updateProduct(productId, data) {
  return callSearch('PUT', `/internal/index/${productId}`, data);
}

async function removeProduct(productId) {
  return callSearch('DELETE', `/internal/index/${productId}`);
}

async function incrementViews(productId) {
  return callSearch('POST', `/internal/index/${productId}/view`);
}

module.exports = { indexProduct, bulkIndex, cleanupIndex, updateProduct, removeProduct, incrementViews };
