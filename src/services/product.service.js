const { query } = require('../config/database');
const { BadRequestError, NotFoundError, ForbiddenError } = require('../utils/errors');

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

async function getProductRaw(id) {
  const result = await query('SELECT * FROM products WHERE id = $1', [id]);
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

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
      images || []
    ]
  );

  return formatProduct(result.rows[0]);
}

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

  return formatProduct(result.rows[0]);
}

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

async function getSellerAds(sellerId, page = 1, limit = 20) {
  return getMyAds(sellerId, page, limit);
}

async function incrementViews(id) {
  const result = await query(
    'UPDATE products SET views_count = views_count + 1 WHERE id = $1 AND deleted = FALSE RETURNING views_count',
    [id]
  );
  if (result.rows.length === 0) throw new NotFoundError('Produit non trouvé');
  return result.rows[0].views_count;
}

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

function formatProduct(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: parseFloat(row.price),
    stock: row.stock,
    sellerId: row.seller_id,
    categoryId: row.category_id,
    categoryName: row.category_name || null,
    city: row.city,
    country: row.country,
    images: row.images || [],
    viewsCount: row.views_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

module.exports = {
  listProducts, getProduct, getProductRaw, createProduct, updateProduct,
  deleteProduct, getMyAds, getSellerAds, incrementViews,
  updateStock, getSellerStats, formatProduct
};
