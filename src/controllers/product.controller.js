const productService = require('../services/product.service');
const categoryService = require('../services/category.service');
const searchClient = require('../services/searchClient');
const authClient = require('../services/authClient');
const { BadRequestError } = require('../utils/errors');

/** Libellé brut vendeur pour exposition API (aligné avec enrichReviewsWithUserNames). */
function sellerLabelFromAuthUser(u) {
  if (!u) return null;
  const username = u.username != null ? String(u.username).trim() : '';
  if (username) return username;
  const fn = u.first_name != null ? String(u.first_name).trim() : '';
  const ln = u.last_name != null ? String(u.last_name).trim() : '';
  if (fn || ln) return `${fn} ${ln}`.trim();
  const email = u.email != null ? String(u.email).trim() : '';
  if (email) {
    const local = email.split('@')[0];
    return local || null;
  }
  return null;
}

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
    const sellerId = req.params.sellerId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await productService.getSellerAds(sellerId, page, limit);

    let sellerName;
    try {
      const authRes = await authClient.getUserById(sellerId);
      const u = authRes.user || authRes;
      sellerName = sellerLabelFromAuthUser(u);
    } catch (_e) {
      /* catalogue sans sellerName si Auth indisponible */
    }

    const products = sellerName
      ? result.products.map((p) => ({ ...p, sellerName }))
      : result.products;

    res.json({ ...result, products });
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

async function createCategory(req, res, next) {
  try {
    const { name, parentId } = req.body || {};
    const category = await categoryService.createCategory(name, parentId || null);
    res.status(201).json({ category, message: 'Catégorie créée' });
  } catch (err) {
    next(err);
  }
}

async function deleteCategory(req, res, next) {
  try {
    await categoryService.deleteCategory(req.params.id);
    res.json({ message: 'Catégorie supprimée' });
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

async function getFlashSales(req, res, next) {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const products = await productService.listFlashSales(limit);
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

async function getTopSellers(req, res, next) {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const products = await productService.listTopSellers(limit);
    res.json({ products });
  } catch (err) {
    next(err);
  }
}

async function enableFlashSale(req, res, next) {
  try {
    const discountPercent = req.body?.discountPercent;
    const durationHours = req.body?.durationHours ?? 24;
    const product = await productService.setFlashSale(req.params.id, req.user.id, discountPercent, durationHours);

    try {
      await searchClient.updateProduct(product.id, {
        price: product.price
      });
    } catch (_e) {
      console.warn('[products] Échec synchro flash sale Search Service:', _e.message);
    }

    res.json({ product, message: 'Flash sale activée' });
  } catch (err) {
    next(err);
  }
}

async function disableFlashSale(req, res, next) {
  try {
    const product = await productService.clearFlashSale(req.params.id, req.user.id);

    try {
      await searchClient.updateProduct(product.id, {
        price: product.price
      });
    } catch (_e) {
      console.warn('[products] Échec synchro arrêt flash sale Search Service:', _e.message);
    }

    res.json({ product, message: 'Flash sale désactivée' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAds, getAd, getSellerAds, getCategories, createCategory, deleteCategory,
  createAd, updateAd, deleteAd, getMyAds, getFlashSales, getTopSellers, enableFlashSale, disableFlashSale
};
