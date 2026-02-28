const { query } = require('../config/database');
const { NotFoundError } = require('../utils/errors');

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

async function getCategory(id) {
  const result = await query('SELECT * FROM categories WHERE id = $1', [id]);
  if (result.rows.length === 0) throw new NotFoundError('Catégorie non trouvée');
  const row = result.rows[0];
  return { id: row.id, name: row.name, parentId: row.parent_id };
}

async function getAllCategories() {
  const result = await query('SELECT * FROM categories ORDER BY id');
  return result.rows.map(r => ({ id: r.id, name: r.name, parentId: r.parent_id }));
}

module.exports = { getCategoryTree, getCategory, getAllCategories };
