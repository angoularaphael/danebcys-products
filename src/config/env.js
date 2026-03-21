const requiredVars = [
  'PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD',
  'AUTH_SERVICE_URL', 'SEARCH_SERVICE_URL', 'USERS_SERVICE_URL', 'ORDERS_SERVICE_URL',
  'INTER_SERVICE_KEY'
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`[env] Variable manquante: ${key}`);
  }
}

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3004,
  NODE_ENV: process.env.NODE_ENV || 'development',

  PG_HOST: process.env.PG_HOST || 'localhost',
  PG_PORT: parseInt(process.env.PG_PORT, 10) || 5432,
  PG_DATABASE: process.env.PG_DATABASE || 'danebcys',
  PG_USER: process.env.PG_USER || 'postgres',
  PG_PASSWORD: process.env.PG_PASSWORD || 'postgres',

  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  SEARCH_SERVICE_URL: process.env.SEARCH_SERVICE_URL || 'http://localhost:3003',
  USERS_SERVICE_URL: process.env.USERS_SERVICE_URL || 'http://localhost:3002',
  ORDERS_SERVICE_URL: process.env.ORDERS_SERVICE_URL || 'http://localhost:3005',
  INTER_SERVICE_KEY: process.env.INTER_SERVICE_KEY,

  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
};
