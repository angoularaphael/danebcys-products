const { query } = require('../config/database');
const ordersClient = require('./ordersClient');
const { BadRequestError, NotFoundError, ConflictError, ForbiddenError } = require('../utils/errors');

async function listReviews(productId, page = 1, limit = 20) {
  const offset = (Math.max(1, page) - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT * FROM reviews
       WHERE product_id = $1 AND deleted = FALSE
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [productId, limit, offset]
    ),
    query(
      'SELECT COUNT(*) AS total FROM reviews WHERE product_id = $1 AND deleted = FALSE',
      [productId]
    )
  ]);

  const total = parseInt(countResult.rows[0].total, 10);

  return {
    reviews: dataResult.rows.map(formatReview),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function addReview(productId, userId, data) {
  const product = await query(
    'SELECT seller_id FROM products WHERE id = $1 AND deleted = FALSE',
    [productId]
  );
  if (product.rows.length === 0) throw new NotFoundError('Produit non trouvé');
  if (product.rows[0].seller_id === userId) throw new ForbiddenError('Vous ne pouvez pas noter votre propre produit');

  let canReviewProduct = false;
  try {
    canReviewProduct = await ordersClient.canReview(userId, productId);
  } catch (_err) {
    return Promise.reject(new BadRequestError('Impossible de vérifier l\'éligibilité aux avis. Réessayez plus tard.'));
  }
  if (!canReviewProduct) {
    throw new ForbiddenError('Vous ne pouvez pas noter ce produit tant que vous n\'avez pas reçu une commande livrée le contenant.');
  }

  const { rating, comment } = data;
  if (!rating || rating < 1 || rating > 5) throw new BadRequestError('Note entre 1 et 5 requise');

  try {
    const result = await query(
      `INSERT INTO reviews (product_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [productId, userId, rating, comment || '']
    );
    return formatReview(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      throw new ConflictError('Vous avez déjà noté ce produit');
    }
    throw err;
  }
}

async function listReviewsByUser(userId, page = 1, limit = 50) {
  const offset = (Math.max(1, page) - 1) * limit;

  const [dataResult, countResult] = await Promise.all([
    query(
      `SELECT r.*, p.title AS product_title
       FROM reviews r
       JOIN products p ON p.id = r.product_id AND p.deleted = FALSE
       WHERE r.user_id = $1 AND r.deleted = FALSE
       ORDER BY r.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    ),
    query(
      'SELECT COUNT(*) AS total FROM reviews WHERE user_id = $1 AND deleted = FALSE',
      [userId]
    )
  ]);

  const total = parseInt(countResult.rows[0].total, 10);

  return {
    reviews: dataResult.rows.map((row) => ({
      ...formatReview(row),
      productTitle: row.product_title
    })),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

async function getAverageRating(productId) {
  const result = await query(
    `SELECT COALESCE(AVG(rating), 0) AS avg_rating, COUNT(*) AS count
     FROM reviews WHERE product_id = $1 AND deleted = FALSE`,
    [productId]
  );
  return {
    average: parseFloat(parseFloat(result.rows[0].avg_rating).toFixed(1)),
    count: parseInt(result.rows[0].count, 10)
  };
}

function formatReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    productId: row.product_id,
    userId: row.user_id,
    rating: row.rating,
    comment: row.comment,
    isModerated: row.is_moderated,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

async function checkEligibility(productId, userId) {
  const product = await query(
    'SELECT seller_id FROM products WHERE id = $1 AND deleted = FALSE',
    [productId]
  );
  if (product.rows.length === 0) return { eligible: false, reason: 'Produit non trouvé' };
  if (product.rows[0].seller_id === userId) return { eligible: false, reason: 'Vous ne pouvez pas noter votre propre produit' };

  const existing = await query(
    'SELECT id FROM reviews WHERE product_id = $1 AND user_id = $2 AND deleted = FALSE',
    [productId, userId]
  );
  if (existing.rows.length > 0) return { eligible: false, reason: 'Vous avez déjà noté ce produit' };

  try {
    const can = await ordersClient.canReview(userId, productId);
    return { eligible: can, reason: can ? null : 'Vous devez avoir reçu une commande livrée contenant ce produit.' };
  } catch (_err) {
    return { eligible: false, reason: 'Impossible de vérifier l\'éligibilité.' };
  }
}

module.exports = { listReviews, listReviewsByUser, addReview, getAverageRating, checkEligibility };
