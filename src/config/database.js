// Connexion PostgreSQL pour les produits et catégories
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const env = require('./env');

// Pool de connexions PostgreSQL vers la base `danebcys`.
// Tables utilisées : products, categories, reviews.
const pool = new Pool({
  host: env.PG_HOST,
  port: env.PG_PORT,
  database: env.PG_DATABASE,
  user: env.PG_USER,
  password: env.PG_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// Journalise les erreurs inattendues du pool PostgreSQL ; ne contacte aucun microservice.
pool.on('error', (err) => {
  console.error('[database] Erreur inattendue du pool:', err.message);
});

// Exécute une requête SQL paramétrée sur PostgreSQL.
// Appelé par product.service, category.service et review.service.
async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  if (env.NODE_ENV === 'development') {
    const duration = Date.now() - start;
    console.log('[query]', { text: text.substring(0, 80), duration: `${duration}ms`, rows: result.rowCount });
  }
  return result;
}

// Obtient un client PostgreSQL dédié pour une transaction.
// Utilise le pool local ; pas d'appel à un autre microservice.
async function getClient() {
  return pool.connect();
}

// Initialise le schéma PostgreSQL en exécutant init.sql (tables products, categories, reviews).
// Appelé au démarrage du serveur ; ne contacte que PostgreSQL.
async function initDB() {
  const sqlPath = path.join(__dirname, '..', '..', 'init.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('[database] Schema initialisé avec succès');
  } catch (err) {
    console.error('[database] Erreur initialisation:', err.message);
    throw err;
  }
}

module.exports = { pool, query, getClient, initDB };
