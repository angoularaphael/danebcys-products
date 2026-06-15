// Connexion MongoDB pour l'index de recherche
const { MongoClient } = require('mongodb');
const env = require('./env');

// Client MongoDB singleton ; null tant que connectMongo() n'a pas été appelé.
let client = null;
// Référence à la base MongoDB `danebcys` ; null si non connecté.
let db = null;

// Établit la connexion MongoDB et crée les index de la collection `products_index`.
// Appelé au démarrage (server.js) ; ne contacte que MongoDB local.
async function connectMongo() {
  if (db) return db;

  client = new MongoClient(env.MONGO_URI, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 5000
  });

  await client.connect();
  db = client.db(env.MONGO_DB_NAME);

  await ensureIndexes();

  console.log('[mongodb] Connecté à', env.MONGO_DB_NAME);
  return db;
}

// Crée ou recrée les index MongoDB sur la collection `products_index`
// (recherche texte, prix, ville, catégories, vendeur, vues).
async function ensureIndexes() {
  const col = db.collection('products_index');

  try {
    await col.dropIndex('idx_text_search');
  } catch (_e) { // index may not exist yet }

  await col.createIndex(
    { title: 'text', description: 'text', category_name: 'text', parent_category_name: 'text' },
    { weights: { title: 10, category_name: 5, parent_category_name: 3, description: 1 }, name: 'idx_text_search' }
  );
  await col.createIndex({ price: 1 });
  await col.createIndex({ city: 1 });
  await col.createIndex({ category_id: 1 });
  await col.createIndex({ parent_category_id: 1 });
  await col.createIndex({ seller_id: 1 });
  await col.createIndex({ created_at: -1 });
  await col.createIndex({ views_count: -1 });
  await col.createIndex({ deleted: 1 });
  await col.createIndex(
    { product_id: 1 },
    { unique: true, partialFilterExpression: { deleted: false } }
  );

  console.log('[mongodb] Index de recherche créés');
}

// Retourne l'instance Db MongoDB connectée.
// Utilisée par search.service et index.service (collection products_index).
function getDb() {
  if (!db) throw new Error('MongoDB non connecté — appelez connectMongo() au démarrage');
  return db;
}

// Ferme proprement la connexion MongoDB.
// Appelé à l'arrêt du processus ; ne contacte que MongoDB.
async function closeMongo() {
  if (client) { await client.close(); client = null; db = null; }
}

module.exports = { connectMongo, getDb, closeMongo };
