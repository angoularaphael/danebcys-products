require('dotenv').config();

const app = require('./src/app');
const { pool, initDB, query } = require('./src/config/database');
const env = require('./src/config/env');

const SAMPLE_PRODUCTS = [
  { title: 'iPhone 15 Pro Max 256Go', description: 'Neuf, sous blister, coloris Titane Naturel. Garantie Apple 2 ans.', price: 1299.99, stock: 5, categoryId: 'cat-1-1', city: 'Paris', country: 'France', images: ['https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=600&h=400&fit=crop', 'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=600&h=400&fit=crop'], tags: ['refurbished'] },
  { title: 'MacBook Air M3 15"', description: 'Processeur M3, 16 Go RAM, 512 Go SSD, écran Liquid Retina.', price: 1499.00, stock: 3, categoryId: 'cat-1-2', city: 'Lyon', country: 'France', images: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600&h=400&fit=crop'], tags: ['refurbished'] },
  { title: 'Samsung Galaxy Tab S9', description: 'Tablette Android haut de gamme avec stylet S-Pen inclus.', price: 749.90, stock: 8, categoryId: 'cat-1-3', city: 'Marseille', country: 'France', images: ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=600&h=400&fit=crop'], tags: ['refurbished'] },
  { title: 'LG OLED C3 55"', description: 'TV OLED 4K 55 pouces, Dolby Vision & Atmos, HDMI 2.1.', price: 1199.00, stock: 2, categoryId: 'cat-1-4', city: 'Toulouse', country: 'France', images: ['https://images.unsplash.com/photo-1593359677879-a4bb92f829d1?w=600&h=400&fit=crop'], tags: ['refurbished'] },
  { title: 'Sony WH-1000XM5', description: 'Casque Bluetooth à réduction de bruit active, autonomie 30h.', price: 349.99, stock: 12, categoryId: 'cat-1-5', city: 'Nice', country: 'France', images: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&h=400&fit=crop'], tags: ['refurbished'] },
  { title: 'Canapé d\'angle convertible Milano', description: 'Canapé 5 places en tissu gris avec coffre de rangement.', price: 899.00, stock: 4, categoryId: 'cat-2-1', city: 'Bordeaux', country: 'France', images: ['https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=400&fit=crop'], tags: ['vintage'] },
  { title: 'Robot cuiseur Thermomix TM6', description: 'Le robot cuiseur multifonction avec écran tactile et Wi-Fi.', price: 1399.00, stock: 6, categoryId: 'cat-2-3', city: 'Nantes', country: 'France', images: ['https://images.unsplash.com/photo-1585659722983-3a675dab3078?w=600&h=400&fit=crop'], tags: ['local'] },
  { title: 'Nike Air Max 90 Homme', description: 'Sneakers classiques Nike, coloris blanc/noir, tailles 40-46.', price: 139.99, stock: 20, categoryId: 'cat-3-4', city: 'Strasbourg', country: 'France', images: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&h=400&fit=crop'], tags: ['vintage'] },
  { title: 'Sérum Vitamine C La Roche-Posay', description: 'Sérum anti-oxydant pour le visage, 30ml.', price: 29.90, stock: 50, categoryId: 'cat-4-1', city: 'Montpellier', country: 'France', images: ['https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=400&fit=crop'], tags: ['local'] },
  { title: 'Vélo de route Canyon Endurace', description: 'Cadre aluminium, Shimano 105, taille M.', price: 1299.00, stock: 3, categoryId: 'cat-5-4', city: 'Lille', country: 'France', images: ['https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=600&h=400&fit=crop'], tags: [] },
  { title: 'PlayStation 5 Slim', description: 'Console de jeux nouvelle génération avec lecteur Blu-ray.', price: 549.99, stock: 7, categoryId: 'cat-1-6', city: 'Paris', country: 'France', images: ['https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=600&h=400&fit=crop'], tags: ['refurbished'] },
  { title: 'Poussette Yoyo² Babyzen', description: 'Ultra compacte, homologuée avion, coloris Noir.', price: 449.00, stock: 5, categoryId: 'cat-7-1', city: 'Lyon', country: 'France', images: ['https://images.unsplash.com/photo-1587899897387-091ebd01a6b2?w=600&h=400&fit=crop'], tags: [] },
  { title: 'LEGO Technic Ferrari Daytona SP3', description: 'Set de construction 3778 pièces pour adultes.', price: 399.99, stock: 10, categoryId: 'cat-8-2', city: 'Marseille', country: 'France', images: ['https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=600&h=400&fit=crop'], tags: [] },
  { title: 'Manga One Piece Tome 107', description: 'Dernier tome en date de la série d\'Eiichiro Oda.', price: 6.99, stock: 100, categoryId: 'cat-9-2', city: 'Toulouse', country: 'France', images: ['https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=600&h=400&fit=crop'], tags: ['local'] },
  { title: 'Tondeuse robot Husqvarna Automower', description: 'Tonte automatique jusqu\'à 600m², pilotage via app.', price: 1599.00, stock: 2, categoryId: 'cat-11-4', city: 'Rennes', country: 'France', images: ['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=400&fit=crop'], tags: [] }
];

const DEMO_SELLER_ID = '00000000-0000-4000-a000-000000000001';

async function seedProducts() {
  const existing = await query('SELECT COUNT(*) AS count FROM products');
  if (parseInt(existing.rows[0].count, 10) > 0) {
    console.log('[seed] Produits déjà présents, seed ignoré');
    return [];
  }

  const seeded = [];
  for (const p of SAMPLE_PRODUCTS) {
    const result = await query(
      `INSERT INTO products (title, description, price, stock, seller_id, category_id, city, country, images, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [p.title, p.description, p.price, p.stock, DEMO_SELLER_ID, p.categoryId, p.city, p.country, p.images, p.tags || []]
    );
    seeded.push(result.rows[0]);
  }

  console.log(`[seed] ${seeded.length} produits créés`);
  return seeded;
}

async function syncProductsToSearch() {
  try {
    const { query } = require('./src/config/database');
    const searchClient = require('./src/services/searchClient');
    const result = await query(
      'SELECT id, title, description, price, stock, seller_id, category_id, city, country, images, tags, views_count, created_at FROM products WHERE deleted = FALSE'
    );
    const rows = result.rows;

    if (rows.length > 0) {
      const reviewsCountResult = await query(
        'SELECT product_id, COUNT(*) AS cnt FROM reviews WHERE deleted = FALSE GROUP BY product_id'
      );
      const reviewsMap = {};
      for (const r of reviewsCountResult.rows) {
        reviewsMap[r.product_id] = parseInt(r.cnt, 10);
      }

      const toIndex = rows.map(p => ({
        productId: p.id,
        title: p.title,
        description: p.description,
        price: parseFloat(p.price),
        stock: p.stock,
        sellerId: p.seller_id,
        categoryId: p.category_id,
        city: p.city,
        country: p.country,
        images: p.images || [],
        tags: p.tags || [],
        viewsCount: p.views_count || 0,
        reviewsCount: reviewsMap[p.id] || 0,
        createdAt: p.created_at
      }));
      const res = await searchClient.bulkIndex(toIndex);
      console.log(`[sync] ${res.indexed} produits indexés dans Search Service (${res.inserted} insérés, ${res.updated} mis à jour)`);
    }

    const validIds = rows.map(p => String(p.id));
    const cleanupRes = await searchClient.cleanupIndex(validIds);
    if (cleanupRes.removed > 0) {
      console.log(`[sync] ${cleanupRes.removed} produit(s) obsolète(s) retiré(s) de l'index (IDs incohérents)`);
    }
  } catch (err) {
    console.warn('[sync] Échec indexation Search Service:', err.message);
  }
}

async function start() {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[Products Service] PostgreSQL connecté');

    await initDB();

    if (env.NODE_ENV === 'development') {
      await seedProducts();
    }
    await syncProductsToSearch();

    app.listen(env.PORT, () => {
      console.log(`[Products Service] Démarré sur le port ${env.PORT}`);
    });
  } catch (err) {
    console.error('[Products Service] Erreur au démarrage:', err.message);
    process.exit(1);
  }
}

start();
