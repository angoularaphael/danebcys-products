// Recherche full-text dans l'index MongoDB
const { getDb } = require('../config/mongodb');
const { BadRequestError } = require('../utils/errors');
const { getCategoryTree, isParentCategory, getSubcategoryIds } = require('../data/categories');

// Accès à la collection MongoDB `products_index` pour la recherche full-text.
function col() {
  return getDb().collection('products_index');
}

// Échappe les caractères spéciaux regex pour une recherche sûre sur MongoDB.
function escapeRegex(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Construit un filtre de recherche non-strict : ressemble ou commence par.
// Utilise $or avec regex sur titre, description, catégories (collection MongoDB products_index).
function buildTextFilter(q) {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const escaped = escapeRegex(trimmed);
  const regex = new RegExp(escaped, 'i');
  return {
    $or: [
      { title: regex },
      { description: regex },
      { category_name: regex },
      { parent_category_name: regex }
    ]
  };
}

// Recherche avancée : non-stricte (ressemble ou commence par) + filtres + pagination + tri.
// Source : MongoDB collection products_index ; utilise data/categories pour filtre parent.
async function search({ q, categoryId, city, country, sellerId,
                         minPrice, maxPrice, sort, tag, page = 1, limit = 20 }) {
  const filter = { deleted: false };

  if (q && q.trim()) {
    const textFilter = buildTextFilter(q);
    if (textFilter) Object.assign(filter, textFilter);
  }

  if (tag && tag.trim()) {
    filter.tags = { $in: [String(tag).trim().toLowerCase()] };
  }

  if (categoryId) {
    if (isParentCategory(categoryId)) {
      filter.$or = [
        { parent_category_id: categoryId },
        { category_id: categoryId }
      ];
    } else {
      filter.category_id = categoryId;
    }
  }

  if (city) filter.city = { $regex: new RegExp(escapeRegex(city), 'i') };
  if (country) filter.country = { $regex: new RegExp(escapeRegex(country), 'i') };
  if (sellerId) filter.seller_id = sellerId;

  if (minPrice !== undefined || maxPrice !== undefined) {
    filter.price = {};
    if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
    if (Object.keys(filter.price).length === 0) delete filter.price;
  }

  const sortMap = {
    date_desc: { created_at: -1 },
    date_asc: { created_at: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    views: { views_count: -1 },
    relevance: { created_at: -1 }
  };
  const sortObj = sortMap[sort] || { created_at: -1 };

  const skip = (page - 1) * limit;
  const projection = { _id: 0 };

  const [results, total] = await Promise.all([
    col().find(filter).project(projection).sort(sortObj).skip(skip).limit(limit).toArray(),
    col().countDocuments(filter)
  ]);

  return {
    results: results.map(formatProduct),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) }
  };
}

// Suggestions d'autocomplétion sur les titres — ressemble ou commence par (1 caractère min).
// Source : MongoDB collection products_index.
async function suggestions(q, limit = 8) {
  if (!q || !q.trim()) return [];

  const escaped = escapeRegex(q.trim());
  const regex = new RegExp(escaped, 'i');
  const results = await col()
    .find({ title: regex, deleted: false })
    .project({ title: 1, category_name: 1, parent_category_name: 1, price: 1, product_id: 1, _id: 0 })
    .limit(limit)
    .toArray();

  return results.map(r => ({
    title: r.title,
    category: r.category_name,
    parentCategory: r.parent_category_name,
    price: r.price,
    productId: r.product_id
  }));
}

// Suggestions d'autocomplétion sur les villes — ressemble ou commence par.
// Source : MongoDB aggregation sur products_index (champ city).
async function suggestionsCities(q, limit = 10) {
  if (!q || !q.trim()) return [];

  const escaped = escapeRegex(q.trim());
  const regex = new RegExp(escaped, 'i');
  const results = await col()
    .aggregate([
      { $match: { city: regex, deleted: false } },
      { $group: { _id: '$city' } },
      { $project: { city: '$_id', _id: 0 } },
      { $sort: { city: 1 } },
      { $limit: limit }
    ])
    .toArray();

  return results.map(r => r.city).filter(Boolean);
}

// Suggestions d'autocomplétion sur les catégories (nom) — ressemble ou commence par.
// Source : MongoDB aggregation sur products_index (category_name, parent_category_name).
async function suggestionsCategories(q, limit = 10) {
  if (!q || !q.trim()) return [];

  const escaped = escapeRegex(q.trim());
  const regex = new RegExp(escaped, 'i');
  const results = await col()
    .aggregate([
      {
        $match: {
          deleted: false,
          $or: [
            { category_name: regex },
            { parent_category_name: regex }
          ]
        }
      },
      {
        $group: {
          _id: { id: '$category_id', name: '$category_name', parentId: '$parent_category_id', parentName: '$parent_category_name' }
        }
      },
      { $limit: limit },
      {
        $project: {
          categoryId: '$_id.id',
          categoryName: '$_id.name',
          parentCategoryId: '$_id.parentId',
          parentCategoryName: '$_id.parentName',
          _id: 0
        }
      }
    ])
    .toArray();

  return results;
}

// Catégories avec le nombre de produits indexés.
// Source : MongoDB aggregation sur products_index.
async function categoriesWithCounts() {
  return col().aggregate([
    { $match: { deleted: false } },
    { $group: { _id: { id: '$category_id', name: '$category_name', parentId: '$parent_category_id', parentName: '$parent_category_name' }, count: { $sum: 1 } } },
    { $project: { _id: 0, categoryId: '$_id.id', categoryName: '$_id.name', parentCategoryId: '$_id.parentId', parentCategoryName: '$_id.parentName', count: 1 } },
    { $sort: { parentCategoryName: 1, count: -1 } }
  ]).toArray();
}

// Arbre de catégories statique (données en dur data/categories.js).
// Pas d'appel MongoDB ni PostgreSQL.
function categoryTree() {
  return getCategoryTree();
}

// Produits tendance (les plus vus).
// Source : MongoDB products_index trié par views_count.
async function trending(limit = 10) {
  const results = await col()
    .find({ deleted: false })
    .project({ _id: 0 })
    .sort({ views_count: -1 })
    .limit(limit)
    .toArray();

  return results.map(formatProduct);
}

// Détail d'un produit indexé par product_id.
// Source : MongoDB products_index (findOne).
async function getProduct(productId) {
  const doc = await col().findOne({ product_id: productId, deleted: false });
  return doc ? formatProduct(doc) : null;
}

// Formate un document MongoDB products_index en objet API camelCase.
function formatProduct(doc) {
  return {
    productId: doc.product_id,
    title: doc.title,
    description: doc.description,
    price: doc.price,
    stock: doc.stock,
    city: doc.city,
    country: doc.country,
    categoryId: doc.category_id,
    categoryName: doc.category_name,
    parentCategoryId: doc.parent_category_id,
    parentCategoryName: doc.parent_category_name,
    sellerId: doc.seller_id,
    sellerName: doc.seller_name,
    images: doc.images || [],
    tags: doc.tags || [],
    viewsCount: doc.views_count || 0,
    reviewsCount: doc.reviews_count || 0,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  };
}

module.exports = { search, suggestions, suggestionsCities, suggestionsCategories, categoriesWithCounts, categoryTree, trending, getProduct };
