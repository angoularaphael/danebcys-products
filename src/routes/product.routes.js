const { Router } = require('express');
const { authenticate, optionalAuth, requireSeller } = require('../middlewares/auth');
const { requireAdmin } = require('../middlewares/admin');
const { productLimiter } = require('../middlewares/rateLimiter');
const productCtrl = require('../controllers/product.controller');
const reviewCtrl = require('../controllers/review.controller');

const router = Router();

// ─── Routes admin (catégories) ──────────────────────────────
const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);
adminRouter.post('/categories', productCtrl.createCategory);
adminRouter.delete('/categories/:id', productCtrl.deleteCategory);
router.use('/admin', adminRouter);

// ─── Routes publiques ──────────────────────────────────────
router.get('/categories', productCtrl.getCategories);
router.get('/top-sellers', productCtrl.getTopSellers);
router.get('/flash-sales', productCtrl.getFlashSales);
// Segments fixes avant toute route "/:id" (évite toute ambiguïté avec "me", etc.)
router.get('/me', authenticate, productLimiter, productCtrl.getMyAds);
router.get('/reviews/me', authenticate, productLimiter, reviewCtrl.listMyReviews);
router.get('/seller/:sellerId', productCtrl.getSellerAds);
router.get('/:id/reviews/eligibility', authenticate, productLimiter, reviewCtrl.checkEligibility);
router.get('/:id/reviews', reviewCtrl.listReviews);
router.post('/', authenticate, requireSeller, productLimiter, productCtrl.createAd);
router.put('/:id/flash-sale', authenticate, requireSeller, productLimiter, productCtrl.enableFlashSale);
router.delete('/:id/flash-sale', authenticate, requireSeller, productLimiter, productCtrl.disableFlashSale);

// ─── Route publique détail (recherche via /api/v1/search) ───
router.get('/:id', productCtrl.getAd);

// ─── Routes authentifiées sur /:id ─────────────────────────
router.put('/:id', authenticate, requireSeller, productLimiter, productCtrl.updateAd);
router.delete('/:id', authenticate, requireSeller, productLimiter, productCtrl.deleteAd);

router.post('/:id/reviews', authenticate, productLimiter, reviewCtrl.addReview);

module.exports = router;
