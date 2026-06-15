// Routes recherche /api/v1/search
const { Router } = require('express');
const ctrl = require('../controllers/search.controller');
const { optionalAuth } = require('../middlewares/auth');
const { searchLimiter } = require('../middlewares/rateLimiter');

// Routeur Express monté sur /api/v1/search (recherche MongoDB, auth optionnelle).
const router = Router();

router.use(optionalAuth, searchLimiter);

router.get('/', ctrl.search);
router.get('/suggestions', ctrl.suggestions);
router.get('/suggestions/cities', ctrl.suggestionsCities);
router.get('/suggestions/categories', ctrl.suggestionsCategories);
router.get('/categories', ctrl.categories);
router.get('/categories/tree', ctrl.categoryTree);
router.get('/trending', ctrl.trending);
router.get('/product/:id', ctrl.getProduct);

module.exports = router;
