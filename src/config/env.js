// Liste des variables obligatoires au démarrage.
const requiredVars = [
  'PG_HOST', 'PG_PORT', 'PG_DATABASE', 'PG_USER', 'PG_PASSWORD',
  'MONGO_URI', 'MONGO_DB_NAME',
  'AUTH_SERVICE_URL', 'USERS_SERVICE_URL', 'ORDERS_SERVICE_URL',
  'INTER_SERVICE_KEY'
];

for (const key of requiredVars) {
  if (!process.env[key]) {
    console.warn(`[env] Variable manquante: ${key}`);
  }
}

module.exports = {
  // Port d'écoute du service (défaut 3004).
  PORT: parseInt(process.env.PORT, 10) || 3004,
  // Mode dev ou production.
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Connexion PostgreSQL — produits, catégories, avis.
  PG_HOST: process.env.PG_HOST || 'localhost',
  PG_PORT: parseInt(process.env.PG_PORT, 10) || 5432,
  PG_DATABASE: process.env.PG_DATABASE || 'danebcys',
  PG_USER: process.env.PG_USER || 'postgres',
  PG_PASSWORD: process.env.PG_PASSWORD || 'postgres',

  // Connexion MongoDB — index de recherche products_index.
  MONGO_URI: process.env.MONGO_URI || 'mongodb://localhost:27017',
  MONGO_DB_NAME: process.env.MONGO_DB_NAME || 'danebcys',

  // Appelle Auth-service port 3001 (validation token, profils).
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  // Appelle Users-service port 3002 (favoris).
  USERS_SERVICE_URL: process.env.USERS_SERVICE_URL || 'http://localhost:3002',
  // Appelle Orders-service port 3005 (top ventes, éligibilité avis).
  ORDERS_SERVICE_URL: process.env.ORDERS_SERVICE_URL || 'http://localhost:3005',
  // Clé secrète partagée entre microservices.
  INTER_SERVICE_KEY: process.env.INTER_SERVICE_KEY,

  // Limite de requêtes : fenêtre en ms (défaut 15 min).
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  // Limite de requêtes : max par fenêtre (défaut 100).
  RATE_LIMIT_MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
};
