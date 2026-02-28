const { query } = require('../config/database');
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

module.exports = { listReviews, addReview, getAverageRating };
