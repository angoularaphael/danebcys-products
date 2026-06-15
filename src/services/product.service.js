// CRUD produits, stock et promotions flash
const { query } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');
const ordersClient = require('./ordersClient');

// Liste paginée de produits avec filtres texte, catégorie, ville et prix.
// Source : PostgreSQL (tables products, categories) ; pas d'appel microservice externe.
async function listProducts(filters = {}) {
  const {
    q, categoryId, city, minPrice, maxPrice,
    sort = 'recent', page = 1, limit = 20
  } = filters;

  const conditions = ['p.deleted = FALSE'];
  const params = [];
  let idx = 1;

  if (q) {
    const escaped = String(q).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const pattern = '%' + escaped + '%';
    conditions.push(`(LOWER(p.title) LIKE LOWER($${idx}) OR LOWER(p.description) LIKE LOWER($${idx}))`);
    params.push(pattern);
    idx++;
  }

  if (categoryId) {
    conditions.push(`(p.category_id = $${idx} OR p.category_id IN (SELECT id FROM categories WHERE parent_id = $${idx}))`);
    params.push(categoryId);
    idx++;
  }

  if (city) {
    const cityEscaped = String(city).replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    conditions.push(`LOWER(p.city) LIKE LOWER($${idx})`);
    params.push('%' + cityEscaped + '%');
    idx++;
  }

  if (minPrice !== undefined && minPrice !== null && minPrice !== '') {
    conditions.push(`p.price >= $${idx}`);
    params.push(Number(minPrice));
    idx++;
  }

  if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
    conditions.push(`p.price <= $${idx}`);
    params.push(Number(maxPrice));
    idx++;
  }

  const orderMap = {
    recent: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    price_asc: 'p.price ASC',
    price_desc: 'p.price DESC',
    popular: 'p.views_count DESC'
  };
  const orderBy = orderMap[sort] || orderMap.recent;

  const where = conditions.join(' AND ');
  const offset = (Math.max(1, page) - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limit, offset]
    ),
    query(
      `SELECT COUNT(*) AS total FROM products p WHERE ${where}`,
      params
    )
  ]);

  const total = parseInt(countResult.rows[0].total, 10);

  return {
    products: dataResult.rows.map(formatProduct),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

// Récupère un produit public par id avec nom de catégorie (PostgreSQL products + categories).
async function getProduct(id) {
  const result = await query(
    `SELECT p.*, c.name AS category_name
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.id = $1 AND p.deleted = FALSE`,
    [id]
  );
  if (result.rows.length === 0) throw new NotFoundError('Produit non trouvé');
  return formatProduct(result.rows[0]);
}

// Récupère une ligne produit brute sans jointure (PostgreSQL products).
// Utilisé par les routes /internal pour orders-service et autres microservices.
async function getProductRaw(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

// Crée une annonce pour un vendeur (PostgreSQL INSERT products).
async function createProduct(sellerId, data) {
  if (data.id !== undefined) {
    throw new BadRequestError('L\'ID du produit est généré automatiquement, ne pas le fournir');
  }
  if (data.sellerId !== undefined) {
    throw new BadRequestError('Le vendeur est déterminé par la session, ne pas fournir sellerId');
  }
  const { title, description, price, stock, categoryId, city, country, images } = data;

  if (!title || title.trim().length < 3) throw new BadRequestError('Titre requis (min 3 caractères)');
  if (price === undefined || price === null || Number(price) < 0) throw new BadRequestError('Prix invalide');
  const imgArr = Array.isArray(images) ? images : [];
  if (imgArr.length < 3) throw new BadRequestError('Minimum 3 photos requises pour créer une annonce');

  const result = await query(
    `INSERT INTO products (title, description, price, stock, seller_id, category_id, city, country, images)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      title.trim(),
      description || '',
      Number(price),
      parseInt(stock, 10) || 0,
      sellerId,
      categoryId || null,
      city || '',
      country || 'France',
      imgArr
    ]
  );

  return formatProduct(result.rows[0]);
}

// Met à jour une annonce si l'appelant en est le propriétaire (PostgreSQL UPDATE products).
// Recalcule flash_sale_price si le prix de base change pendant une vente flash.
async function updateProduct(id, sellerId, data) {
  const existing = await query(
    'SELECT * FROM products WHERE id = $1 AND deleted = FALSE',
    [id]
  );
  if (existing.rows.length === 0) throw new NotFoundError('Produit non trouvé');
  if (existing.rows[0].seller_id !== sellerId) throw new ForbiddenError('Vous n\'êtes pas le propriétaire');

  const fields = [];
  const params = [];
  let idx = 1;

  const allowedFields = {
    title: 'title', description: 'description', price: 'price',
    stock: 'stock', categoryId: 'category_id', city: 'city',
    country: 'country', images: 'images'
  };

  for (const [key, col] of Object.entries(allowedFields)) {
    if (data[key] !== undefined) {
      fields.push(`${col} = $${idx}`);
      params.push(key === 'price' ? Number(data[key]) : (key === 'stock' ? parseInt(data[key], 10) : data[key]));
      idx++;
    }
  }

  if (fields.length === 0) throw new BadRequestError('Aucun champ à mettre à jour');

  params.push(id);
  const result = await query(
    `UPDATE products SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    params
  );

  let updated = result.rows[0];
  if (data.price !== undefined && updated.is_flash_sale && updated.flash_sale_discount_percent) {
    const pct = Number(updated.flash_sale_discount_percent);
    const newFlashPrice = Number((Number(updated.price) * (1 - pct / 100)).toFixed(2));
    const refreshed = await query(
      `UPDATE products
       SET flash_sale_price = $1
       WHERE id = $2
       RETURNING *`,
      [newFlashPrice, id]
    );
    updated = refreshed.rows[0];
  }

  return formatProduct(updated);
}

// Suppression logique d'une annonce (PostgreSQL UPDATE products SET deleted = TRUE).
async function deleteProduct(id, sellerId) {
  const existing = await query(
    'SELECT * FROM products WHERE id = $1 AND deleted = FALSE',
    [id]
  );
  if (existing.rows.length === 0) throw new NotFoundError('Produit non trouvé');
  if (existing.rows[0].seller_id !== sellerId) throw new ForbiddenError('Vous n\'êtes pas le propriétaire');

  await query('UPDATE products SET deleted = TRUE WHERE id = $1', [id]);
  return { deleted: true };
}

// Liste les annonces du vendeur connecté (PostgreSQL products WHERE seller_id).
async function getMyAds(sellerId, page = 1, limit = 20) {
  const offset = (Math.max(1, page) - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.seller_id = $1 AND p.deleted = FALSE
       ORDER BY p.created_at DESC
       LIMIT $2 OFFSET $3`,
      [sellerId, limit, offset]
    ),
    query(
      'SELECT COUNT(*) AS total FROM products WHERE seller_id = $1 AND deleted = FALSE',
      [sellerId]
    )
  ]);

  const total = parseInt(countResult.rows[0].total, 10);

  return {
    products: dataResult.rows.map(formatProduct),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

// Alias public de getMyAds pour le catalogue vendeur (même requête PostgreSQL).
async function getSellerAds(sellerId, page = 1, limit = 20) {
  return getMyAds(sellerId, page, limit);
}

// Incrémente le compteur de vues côté PostgreSQL (colonne views_count).
// Complété par searchClient→MongoDB products_index dans le contrôleur.
async function incrementViews(id) {
  const result = await query(
    'UPDATE products SET views_count = views_count + 1 WHERE id = $1 AND deleted = FALSE RETURNING views_count',
    [id]
  );
  if (result.rows.length === 0) throw new NotFoundError('Produit non trouvé');
  return result.rows[0].views_count;
}

// Ajuste le stock d'un produit (appel interne orders-service après commande).
// PostgreSQL UPDATE products.stock ; peut être négatif en delta (quantity).
async function updateStock(id, quantity) {
  const existing = await query('SELECT stock FROM products WHERE id = $1 AND deleted = FALSE', [id]);
  if (existing.rows.length === 0) throw new NotFoundError('Produit non trouvé');

  const newStock = existing.rows[0].stock + quantity;
  if (newStock < 0) throw new BadRequestError('Stock insuffisant');

  const result = await query(
    'UPDATE products SET stock = $1 WHERE id = $2 RETURNING *',
    [newStock, id]
  );
  return formatProduct(result.rows[0]);
}

// Statistiques agrégées d'un vendeur : nombre d'annonces et vues totales (PostgreSQL products).
// Appelé par GET /internal/products/seller/:sellerId/stats.
async function getSellerStats(sellerId) {
  const result = await query(
    `SELECT COUNT(*) AS count, COALESCE(SUM(views_count), 0) AS total_views
     FROM products WHERE seller_id = $1 AND deleted = FALSE`,
    [sellerId]
  );
  return {
    count: parseInt(result.rows[0].count, 10),
    totalViews: parseInt(result.rows[0].total_views, 10)
  };
}

// Liste les ids produits actifs d'un vendeur (PostgreSQL products).
// Appelé par GET /internal/products/seller/:sellerId/ids.
async function getSellerProductIds(sellerId) {
  const result = await query(
    'SELECT id FROM products WHERE seller_id = $1 AND deleted = FALSE',
    [sellerId]
  );
  return result.rows.map((r) => r.id);
}

// Active une vente flash sur un produit (PostgreSQL UPDATE products flash_sale_*).
async function setFlashSale(id, sellerId, discountPercent, durationHours = 24) {
  const pct = Number(discountPercent);
  if (!Number.isInteger(pct) || pct < 1 || pct > 90) {
    throw new BadRequestError('Le pourcentage de réduction doit être un entier entre 1 et 90');
  }

  const dur = Number(durationHours);
  if (!Number.isInteger(dur) || dur < 1 || dur > 720) {
    throw new BadRequestError('La durée doit être entre 1 et 720 heures (30 jours)');
  }

  const existing = await query(
    'SELECT id, seller_id, price, deleted FROM products WHERE id = $1',
    [id]
  );
  if (existing.rows.length === 0 || existing.rows[0].deleted) {
    throw new NotFoundError('Produit non trouvé');
  }
  if (existing.rows[0].seller_id !== sellerId) {
    throw new ForbiddenError('Vous n\'êtes pas le propriétaire');
  }

  const basePrice = Number(existing.rows[0].price);
  const discounted = Number((basePrice * (1 - pct / 100)).toFixed(2));

  const result = await query(
    `UPDATE products
     SET is_flash_sale = TRUE,
         flash_sale_discount_percent = $1,
         flash_sale_price = $2,
         flash_sale_started_at = NOW(),
         flash_sale_ends_at = NOW() + make_interval(hours => $4::int)
     WHERE id = $3
     RETURNING *`,
    [pct, discounted, id, dur]
  );

  return formatProduct(result.rows[0]);
}

// Désactive la vente flash d'un produit (PostgreSQL, remise à NULL des champs flash).
async function clearFlashSale(id, sellerId) {
  const existing = await query(
    'SELECT id, seller_id, deleted FROM products WHERE id = $1',
    [id]
  );
  if (existing.rows.length === 0 || existing.rows[0].deleted) {
    throw new NotFoundError('Produit non trouvé');
  }
  if (existing.rows[0].seller_id !== sellerId) {
    throw new ForbiddenError('Vous n\'êtes pas le propriétaire');
  }

  const result = await query(
    `UPDATE products
     SET is_flash_sale = FALSE,
         flash_sale_discount_percent = NULL,
         flash_sale_price = NULL,
         flash_sale_started_at = NULL,
         flash_sale_ends_at = NULL
     WHERE id = $1
     RETURNING *`,
    [id]
  );

  return formatProduct(result.rows[0]);
}

// Liste les annonces en vente flash actives (PostgreSQL products + sous-requête reviews).
async function listFlashSales(limit = 20) {
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const result = await query(
    `SELECT p.*, c.name AS category_name,
            (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.deleted = FALSE)::int AS reviews_count
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.deleted = FALSE
       AND p.is_flash_sale = TRUE
       AND p.flash_sale_discount_percent IS NOT NULL
       AND p.flash_sale_discount_percent > 0
       AND p.flash_sale_price IS NOT NULL
       AND (p.flash_sale_ends_at IS NULL OR p.flash_sale_ends_at > NOW())
     ORDER BY p.flash_sale_started_at DESC, p.updated_at DESC
     LIMIT $1`,
    [normalizedLimit]
  );
  return result.rows.map(formatProduct);
}

// Durée de vie du cache mémoire pour listTopSellers (60 secondes).
const TOP_SELLERS_CACHE_TTL_MS = 60_000;
// Cache en mémoire des classements top vendeurs par limite demandée.
const topSellersCache = new Map();

// Classement des produits les plus vendus.
// Appels : orders-service (GET /internal/orders/top-products), puis PostgreSQL pour enrichir.
async function listTopSellers(limit = 20) {
  const normalizedLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const now = Date.now();
  const cached = topSellersCache.get(normalizedLimit);
  if (cached && cached.expiresAt > now) {
    return cached.data;
  }

  let sales;
  try {
    sales = await ordersClient.getTopPaidProducts(normalizedLimit);
  } catch (_err) {
    return [];
  }
  const ranked = Array.isArray(sales.items) ? sales.items : [];
  if (ranked.length === 0) {
    topSellersCache.set(normalizedLimit, { expiresAt: now + TOP_SELLERS_CACHE_TTL_MS, data: [] });
    return [];
  }

  const productIds = ranked.map((item) => item.productId);
  const result = await query(
    `SELECT p.*, c.name AS category_name,
            (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id AND r.deleted = FALSE)::int AS reviews_count
     FROM products p
     LEFT JOIN categories c ON c.id = p.category_id
     WHERE p.deleted = FALSE AND p.id = ANY($1::uuid[])`,
    [productIds]
  );

  const byId = new Map(result.rows.map((row) => [row.id, row]));
  const data = ranked
    .map((item) => {
      const row = byId.get(item.productId);
      if (!row) return null;
      return {
        ...formatProduct(row),
        quantitySold: Number(item.quantitySold) || 0
      };
    })
    .filter(Boolean);

  topSellersCache.set(normalizedLimit, { expiresAt: now + TOP_SELLERS_CACHE_TTL_MS, data });
  return data;
}

// Formate une ligne PostgreSQL products en objet API (prix flash, camelCase).
function formatProduct(row) {
  if (!row) return null;
  const isFlashSale = row.is_flash_sale === true;
  const flashSalePrice = row.flash_sale_price !== null && row.flash_sale_price !== undefined
    ? parseFloat(row.flash_sale_price)
    : null;
  const basePrice = parseFloat(row.price);
  const finalPrice = isFlashSale && flashSalePrice !== null ? flashSalePrice : basePrice;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: finalPrice,
    basePrice,
    stock: row.stock,
    sellerId: row.seller_id,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    city: row.city,
    country: row.country,
    images: row.images || [],
    viewsCount: row.views_count,
    reviewsCount: row.reviews_count !== undefined ? parseInt(row.reviews_count, 10) : 0,
    isFlashSale,
    flashSaleDiscountPercent: row.flash_sale_discount_percent === null || row.flash_sale_discount_percent === undefined
      ? null
      : Number(row.flash_sale_discount_percent),
    flashSalePrice,
    flashSaleStartedAt: row.flash_sale_started_at || null,
    flashSaleEndsAt: row.flash_sale_ends_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  listProducts, getProduct, getProductRaw, createProduct, updateProduct,
  deleteProduct, getMyAds, getSellerAds, incrementViews,
  updateStock, getSellerStats, getSellerProductIds, setFlashSale, clearFlashSale, listFlashSales, listTopSellers, formatProduct
};
