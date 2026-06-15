// Gestion des catégories produits
const { query } = require('../config/database');
const { NotFoundError, BadRequestError } = require('../utils/errors');

// Construit l'arbre hiérarchique des catégories depuis PostgreSQL (table categories).
async function getCategoryTree() {
  const result = await query('SELECT * FROM categories ORDER BY id');
  const rows = result.rows;

  const parents = rows.filter(r => !r.parent_id).map(r => ({
    id: r.id,
    name: r.name,
    children: rows
      .filter(c => c.parent_id === r.id)
      .map(c => ({ id: c.id, name: c.name, parentId: c.parent_id }))
  }));

  return parents;
}

// Récupère une catégorie par id (PostgreSQL table categories).
async function getCategory(id) {
  const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
  if (result.rows.length === 0) throw new NotFoundError('Catégorie non trouvée');
  const row = result.rows[0];
  return { id: row.id, name: row.name, parentId: row.parent_id };
}

// Liste plate de toutes les catégories (PostgreSQL table categories).
async function getAllCategories() {
  const result = await query('SELECT * FROM categories ORDER BY id');
  return result.rows.map(r => ({ id: r.id, name: r.name, parentId: r.parent_id }));
}

// Crée une catégorie parente ou sous-catégorie (PostgreSQL INSERT categories).
async function createCategory(name, parentId = null) {
  const trimmed = (name || '').trim();
  if (!trimmed) throw new BadRequestError('Le nom de la catégorie est requis');

  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const id = (parentId ? `cat-${suffix}` : `pcat-${suffix}`).slice(0, 20);
  if (parentId) {
    const parent = await getCategory(parentId);
    if (!parent) throw new NotFoundError('Catégorie parente introuvable');
  }

  const existing = await query('SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND (parent_id IS NOT DISTINCT FROM $2)', [trimmed, parentId]);
  if (existing.rows.length > 0) throw new BadRequestError('Une catégorie avec ce nom existe déjà');

  await query(
    'INSERT INTO categories (id, name, parent_id) VALUES ($1, $2, $3)',
    [id, trimmed, parentId]
  );
  return getCategory(id);
}

// Supprime une catégorie si sans enfants ni produits associés (PostgreSQL DELETE categories).
async function deleteCategory(id) {
  const cat = await getCategory(id);

  const children = await query('SELECT id FROM categories WHERE parent_id = $1', [id]);
  if (children.rows.length > 0) {
    throw new BadRequestError('Impossible de supprimer : cette catégorie a des sous-catégories. Supprimez-les d\'abord.');
  }

  const products = await query('SELECT id FROM products WHERE category_id = $1 AND deleted = FALSE LIMIT 1', [id]);
  if (products.rows.length > 0) {
    throw new BadRequestError('Impossible de supprimer : des produits utilisent cette catégorie.');
  }

  await query('DELETE FROM categories WHERE id = $1', [id]);
  return { deleted: true, id };
}

module.exports = { getCategoryTree, getCategory, getAllCategories, createCategory, deleteCategory };
