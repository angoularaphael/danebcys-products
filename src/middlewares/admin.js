const { ForbiddenError } = require('../utils/errors');

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return next(new ForbiddenError('Accès réservé aux administrateurs'));
  }
  next();
}

module.exports = { requireAdmin };
