const productService = require('../services/product.service');
const categoryService = require('../services/category.service');
const searchClient = require('../services/searchClient');
const authClient = require('../services/authClient');
const { BadRequestError } = require('../utils/errors');

async function enrichReviewsWithUserNames(reviews) {
  const userIds = [...new Set(reviews.map(r => r.userId).filter(Boolean))];
  const userMap = {};
  await Promise.all(userIds.map(async (uid) => {
    try {
      const res = await authClient.getUserById(uid);
      const u = res.user || res;
      userMap[uid] = u.username || (u.first_name && u.last_name ? `${u.first_name} ${u.last_name}`.trim() : null) || u.email || `Utilisateur ${uid.slice(0, 8)}`;
    } catch (_e) {
      userMap[uid] = `Utilisateur ${uid.slice(0, 8)}`;
    }
  }));
  return reviews.map(r => ({ ...r, userName: userMap[r.userId] || 'Anonyme' }));
}

async function listAds(req, res, next) {
  try {
    const { q, categoryId, city, minPrice, maxPrice, sort } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await productService.listProducts({
      q, categoryId, city, minPrice, maxPrice, sort, page, limit
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getAd(req, res, next) {
  try {
    const product = await productService.getProduct(req.params.id);

    await productService.incrementViews(req.params.id).catch(() => {});
    product.viewsCount++;

    try { await searchClient.incrementViews(req.params.id); } catch (_e) { /* best-effort */ }

    const reviewService = require('../services/review.service');
    const [ratingData, reviewsData] = await Promise.all([
      reviewService.getAverageRating(req.params.id),
      reviewService.listReviews(req.params.id, 1, 10)
    ]);

    const reviews = await enrichReviewsWithUserNames(reviewsData.reviews);

    res.json({
      product,
      rating: ratingData,
      reviews,
      reviewsPagination: reviewsData.pagination
    });
  } catch (err) {
    next(err);
  }
}

async function getSellerAds(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await productService.getSellerAds(req.params.sellerId, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getCategories(_req, res, next) {
  try {
    const tree = await categoryService.getCategoryTree();
    res.json({ categories: tree });
  } catch (err) {
    next(err);
  }
}

async function createAd(req, res, next) {
  try {
    const product = await productService.createProduct(req.user.id, req.body);

    try {
      await searchClient.indexProduct({
        productId: product.id,
        title: product.title,
        description: product.description,
        price: product.price,
        stock: product.stock,
        sellerId: product.sellerId,
        categoryId: product.categoryId,
        city: product.city,
        country: product.country,
        images: product.images,
        viewsCount: product.viewsCount,
        createdAt: product.createdAt
      });
    } catch (_e) {
      console.warn('[products] Échec indexation Search Service:', _e.message);
    }

    res.status(201).json({ product, message: 'Annonce créée' });
  } catch (err) {
    next(err);
  }
}

async function updateAd(req, res, next) {
  try {
    const product = await productService.updateProduct(req.params.id, req.user.id, req.body);

    try {
      await searchClient.updateProduct(product.id, {
        title: product.title,
        description: product.description,
        price: product.price,
        stock: product.stock,
        categoryId: product.categoryId,
        city: product.city,
        country: product.country,
        images: product.images
      });
    } catch (_e) {
      console.warn('[products] Échec mise à jour Search Service:', _e.message);
    }

    res.json({ product, message: 'Annonce mise à jour' });
  } catch (err) {
    next(err);
  }
}

async function deleteAd(req, res, next) {
  try {
    await productService.deleteProduct(req.params.id, req.user.id);

    try {
      await searchClient.removeProduct(req.params.id);
    } catch (_e) {
      console.warn('[products] Échec suppression Search Service:', _e.message);
    }

    res.json({ message: 'Annonce supprimée' });
  } catch (err) {
    next(err);
  }
}

async function getMyAds(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await productService.getMyAds(req.user.id, page, limit);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAds, getAd, getSellerAds, getCategories,
  createAd, updateAd, deleteAd, getMyAds
};
