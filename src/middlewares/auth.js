const authClient = require('../services/authClient');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

async function authenticate(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token manquant');
    }

    const token = header.split(' ')[1];
    const result = await authClient.validateToken(token);

    if (!result.valid) {
      throw new UnauthorizedError(result.error || 'Token invalide');
    }

    req.user = result.user;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) return next(err);
    next(new UnauthorizedError('Token invalide ou expiré'));
  }
}

async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return next();
    }

    const token = header.split(' ')[1];
    const result = await authClient.validateToken(token);

    if (result.valid) {
      req.user = result.user;
    }
  } catch (_err) {
    // Silently ignore — auth is optional
  }
  next();
}

/**
 * Vérifie que l'utilisateur est autorisé à gérer des annonces.
 * À utiliser après authenticate — le token doit être validé en premier.
 */
function requireSeller(req, _res, next) {
  if (!req.user) {
    return next(new UnauthorizedError('Token d\'accès requis'));
  }
  const role = req.user.role;
  if (role !== 'vendeur' && role !== 'admin' && role !== 'user') {
    return next(new ForbiddenError('Rôle non autorisé pour gérer les annonces'));
  }
  next();
}

module.exports = { authenticate, optionalAuth, requireSeller };
