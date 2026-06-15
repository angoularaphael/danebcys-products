// Vérifie que l'utilisateur connecté a le rôle administrateur
const { ForbiddenError } = require('../utils/errors');

// Middleware Express — restreint l'accès aux administrateurs (req.user.role === 'admin').
// Utilisé sur /api/v1/products/admin/* ; pas d'appel auth-service (authenticate déjà exécuté).
function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('Accès réservé aux administrateurs'));
  }
  next();
}

module.exports = { requireAdmin };
