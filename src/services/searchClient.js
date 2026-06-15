// Pont vers l'index MongoDB local (index.service.js, pas d'appel réseau).
const indexService = require('./index.service');

// Ajoute un produit à l'index MongoDB local.
async function indexProduct(data) {
  return indexService.indexProduct(data);
}

// Indexe plusieurs produits en lot dans MongoDB.
async function bulkIndex(products) {
  return indexService.bulkIndex(products);
}

// Supprime de l'index MongoDB les produits au format obsolète prod-XXX.
async function cleanupIndex(productIds) {
  return indexService.removeObsoleteProducts(productIds);
}

// Met à jour un produit dans l'index MongoDB local.
async function updateProduct(productId, data) {
  return indexService.updateProduct(productId, data);
}

// Marque un produit supprimé dans l'index MongoDB local.
async function removeProduct(productId) {
  return indexService.removeProduct(productId);
}

// +1 vue dans l'index MongoDB local.
async function incrementViews(productId) {
  return indexService.incrementViews(productId);
}

module.exports = { indexProduct, bulkIndex, cleanupIndex, updateProduct, removeProduct, incrementViews };
