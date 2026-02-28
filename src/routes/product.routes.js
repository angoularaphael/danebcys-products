const { Router } = require('express');
const { authenticate, optionalAuth, requireSeller } = require('../middlewares/auth');
const { productLimiter } = require('../middlewares/rateLimiter');
const productCtrl = require('../controllers/product.controller');
const reviewCtrl = require('../controllers/review.controller');

const router = Router();

// ─── Routes publiques ──────────────────────────────────────
router.get('/categories', productCtrl.getCategories);
router.get('/seller/:sellerId', productCtrl.getSellerAds);
router.get('/:id/reviews', reviewCtrl.listReviews);

// ─── Routes authentifiées (avant /:id pour éviter collision) ─
router.get('/me', authenticate, productLimiter, productCtrl.getMyAds);
router.post('/', authenticate, requireSeller, productLimiter, productCtrl.createAd);

// ─── Route publique détail (recherche via /api/v1/search) ───
router.get('/:id', productCtrl.getAd);

// ─── Routes authentifiées sur /:id ─────────────────────────
router.put('/:id', authenticate, requireSeller, productLimiter, productCtrl.updateAd);
router.delete('/:id', authenticate, requireSeller, productLimiter, productCtrl.deleteAd);

router.post('/:id/reviews', authenticate, productLimiter, reviewCtrl.addReview);

module.exports = router;
