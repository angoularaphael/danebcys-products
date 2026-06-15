// Contrôleurs HTTP : recherche full-text
const searchService = require('../services/search.service');
const indexService = require('../services/index.service');

// GET /api/v1/search — recherche full-text et filtres sur MongoDB products_index.
// Délègue à search.service.search.
async function search(req, res, next) {
  try {
    const { q, categoryId, city, country, sellerId,
            minPrice, maxPrice, sort, tag } = req.query;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));

    const result = await searchService.search({
      q, categoryId, city, country, sellerId,
      minPrice, maxPrice, sort, tag, page, limit
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/search/suggestions — autocomplétion titres produits (MongoDB).
async function suggestions(req, res, next) {
  try {
    const { q } = req.query;
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 8);
    const results = await searchService.suggestions(q, limit);
    res.json({ suggestions: results });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/search/suggestions/cities — autocomplétion villes (MongoDB aggregation).
async function suggestionsCities(req, res, next) {
  try {
    const { q } = req.query;
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const results = await searchService.suggestionsCities(q, limit);
    res.json({ cities: results });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/search/suggestions/categories — autocomplétion catégories (MongoDB).
async function suggestionsCategories(req, res, next) {
  try {
    const { q } = req.query;
    const limit = Math.min(20, parseInt(req.query.limit, 10) || 10);
    const results = await searchService.suggestionsCategories(q, limit);
    res.json({ categories: results });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/search/categories — catégories avec compteurs produits indexés (MongoDB).
async function categories(_req, res, next) {
  try {
    const cats = await searchService.categoriesWithCounts();
    res.json({ categories: cats });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/search/categories/tree — arbre statique des catégories (data/categories.js).
// Pas d'appel MongoDB ni PostgreSQL.
async function categoryTree(_req, res, _next) {
  const tree = searchService.categoryTree();
  res.json({ categories: tree });
}

// GET /api/v1/search/trending — produits les plus consultés (MongoDB products_index).
async function trending(req, res, next) {
  try {
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);
    const results = await searchService.trending(limit);
    res.json({ trending: results });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/search/product/:id — fiche produit depuis l'index MongoDB + incrément vues.
// Appels : search.service.getProduct, index.service.incrementViews.
async function getProduct(req, res, next) {
  try {
    const product = await searchService.getProduct(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });

    await indexService.incrementViews(req.params.id);
    product.viewsCount++;

    res.json({ product });
  } catch (err) {
    next(err);
  }
}

module.exports = { search, suggestions, suggestionsCities, suggestionsCategories, categories, categoryTree, trending, getProduct };
