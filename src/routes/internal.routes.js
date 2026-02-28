const { Router } = require('express');
const { serviceAuth } = require('../middlewares/serviceAuth');
const productService = require('../services/product.service');

const router = Router();

router.use(serviceAuth);

router.get('/products/seller/:sellerId/stats', async (req, res, next) => {
  try {
    const stats = await productService.getSellerStats(req.params.sellerId);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await productService.getProductRaw(req.params.id);
    if (!product) return res.status(404).json({ error: 'Produit non trouvé' });
    res.json(productService.formatProduct(product));
  } catch (err) {
    next(err);
  }
});

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
