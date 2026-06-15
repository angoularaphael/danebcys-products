// Application Express Products-service : catalogue, avis et recherche (port 3004)
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const productRoutes = require('./routes/product.routes');
const searchRoutes = require('./routes/search.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '15mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware d'extraction de l'IP client (proxy / X-Forwarded-For).
// Alimente req.clientIp pour le rate limiter ; n'appelle aucun service externe.
app.use((req, _res, next) => {
  req.clientIp = req.headers['x-client-ip'] || req.headers['x-forwarded-for'] || req.ip;
  next();
});

// Routes publiques et authentifiées du catalogue produits (CRUD, avis, catégories).
app.use('/api/v1/products', productRoutes);
// Routes de recherche full-text et suggestions (index MongoDB local).
app.use('/api/v1/search', searchRoutes);
// Routes inter-services protégées par X-Service-Key (index, stock, stats vendeur).
app.use('/internal', internalRoutes);

// Endpoint de santé pour Docker / orchestration.
// Répond en JSON local ; n'appelle ni PostgreSQL ni MongoDB.
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'products-service' });
});

// Gestionnaire d'erreurs global Express.
// Transforme les AppError (statusCode) en réponse JSON ; pas d'appel externe.
app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
