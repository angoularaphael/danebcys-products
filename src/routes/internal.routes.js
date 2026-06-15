// Routes internes inter-services /internal
const { Router } = require('express');
const { serviceAuth } = require('../middlewares/serviceAuth');
const productService = require('../services/product.service');
const indexService = require('../services/index.service');

// Routeur inter-services monté sur /internal — protégé par X-Service-Key.
const router = Router();

router.use(serviceAuth);

// POST /internal/index — indexe un produit dans MongoDB products_index.
// Délègue à index.service.indexProduct.
router.post('/index', async (req, res, next) => {
  try {
    const result = await indexService.indexProduct(req.body);
    res.status(201).json(result);
  } catch (err) { next(err); }
});

// POST /internal/index/bulk — indexation en lot MongoDB products_index.
// Délègue à index.service.bulkIndex.
router.post('/index/bulk', async (req, res, next) => {
  try {
    const result = await indexService.bulkIndex(req.body.products);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /internal/index/cleanup — retire les produits obsolètes (format prod-XXX) de l'index MongoDB.
// Délègue à index.service.removeObsoleteProducts.
router.post('/index/cleanup', async (req, res, next) => {
  try {
    const result = await indexService.removeObsoleteProducts(req.body.productIds);
    res.json(result);
  } catch (err) { next(err); }
});

// PUT /internal/index/:id — met à jour un document MongoDB products_index.
// Délègue à index.service.updateProduct.
router.put('/index/:id', async (req, res, next) => {
  try {
    const result = await indexService.updateProduct(req.params.id, req.body);
    res.json(result);
  } catch (err) { next(err); }
});

// DELETE /internal/index/:id — soft-delete dans MongoDB products_index.
// Délègue à index.service.removeProduct.
router.delete('/index/:id', async (req, res, next) => {
  try {
    const result = await indexService.removeProduct(req.params.id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /internal/index/:id/view — incrémente les vues MongoDB products_index.
// Délègue à index.service.incrementViews.
router.post('/index/:id/view', async (req, res, next) => {
  try {
    await indexService.incrementViews(req.params.id);
    res.json({ incremented: true });
  } catch (err) { next(err); }
});

// GET /internal/products/seller/:sellerId/stats — statistiques vendeur (PostgreSQL products).
// Délègue à product.service.getSellerStats.
router.get('/products/seller/:sellerId/stats', async (req, res, next) => {
  try {
    const stats = await productService.getSellerStats(req.params.sellerId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /internal/products/seller/:sellerId/ids — liste des ids produits d'un vendeur (PostgreSQL).
// Délègue à product.service.getSellerProductIds.
router.get('/products/seller/:sellerId/ids', async (req, res, next) => {
  try {
    const ids = await productService.getSellerProductIds(req.params.sellerId);
    res.json({ productIds: ids });
  } catch (err) {
    next(err);
  }
});

// GET /internal/products/:id — fiche produit brute pour les autres microservices (PostgreSQL).
// Délègue à product.service.getProductRaw + formatProduct.
router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await productService.getProductRaw(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(productService.formatProduct(product));
  } catch (err) {
    next(err);
  }
});

// PUT /internal/products/:id/stock — ajuste le stock (appelé par orders-service après commande).
// Délègue à product.service.updateStock (PostgreSQL table products).
router.put('/products/:id/stock', async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined || quantity === null) {
      return res.status(400).json({ error: 'quantity requis' });
    }
    const product = await productService.updateStock(req.params.id, parseInt(quantity, 10));
    res.json(product);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
