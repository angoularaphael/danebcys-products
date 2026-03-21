const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const productRoutes = require('./routes/product.routes');
const internalRoutes = require('./routes/internal.routes');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: process.env.JSON_LIMIT || '15mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use((req, _res, next) => {
  req.clientIp = req.headers['x-client-ip'] || req.headers['x-forwarded-for'] || req.ip;
  next();
});

app.use('/api/v1/products', productRoutes);
app.use('/internal', internalRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'products-service' });
});

app.use((err, _req, res, _next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

module.exports = app;
