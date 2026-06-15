// Indexation MongoDB pour la recherche full-text
const { getDb } = require('../config/mongodb');
const { BadRequestError, NotFoundError, ConflictError } = require('../utils/errors');
const { lookupCategory, isParentCategory, getParentName } = require('../data/categories');

// Accès à la collection MongoDB `products_index` pour l'indexation produits.
function col() {
  return getDb().collection('products_index');
}

// Indexe un produit (appelé par product.controller et routes /internal/index).
// Résout parentCategoryId/Name via data/categories ; écrit dans MongoDB products_index.
async function indexProduct(data) {
  const { productId, title, description, price, stock, city, country,
          categoryId, categoryName, parentCategoryId, parentCategoryName,
          sellerId, sellerName, images, tags } = data;

  if (!productId || !title || price === undefined) {
    throw new BadRequestError('productId, title et price sont requis');
  }

  const catInfo = lookupCategory(categoryId);
  const isParent = isParentCategory(categoryId);
  const resolvedParentId = parentCategoryId || (catInfo ? catInfo.parentId : (isParent ? categoryId : null));
  const resolvedParentName = parentCategoryName || (catInfo ? catInfo.parentName : (isParent ? getParentName(categoryId) : ''));

  const doc = {
    product_id: productId,
    title,
    description: description || '',
    price: parseFloat(price),
    stock: parseInt(stock, 10) || 0,
    city: city || '',
    country: country || '',
    category_id: categoryId || null,
    category_name: categoryName || (catInfo ? catInfo.name : (isParent ? getParentName(categoryId) : '')),
    parent_category_id: resolvedParentId,
    parent_category_name: resolvedParentName,
    seller_id: sellerId || null,
    seller_name: sellerName || '',
    images: images || [],
    tags: (tags || []).map(t => String(t).toLowerCase()),
    views_count: 0,
    reviews_count: parseInt(data.reviewsCount, 10) || 0,
    deleted: false,
    created_at: new Date(),
    updated_at: new Date(),
    indexed_at: new Date()
  };

  const existing = await col().findOne({ product_id: productId });
  if (existing) {
    throw new ConflictError('Produit déjà indexé — utilisez PUT pour mettre à jour');
  }

  await col().insertOne(doc);
  return { productId, indexed: true };
}

// Met à jour un produit indexé dans MongoDB products_index.
async function updateProduct(productId, data) {
  const update = { updated_at: new Date(), indexed_at: new Date() };

  if (data.title !== undefined) update.title = data.title;
  if (data.description !== undefined) update.description = data.description;
  if (data.price !== undefined) update.price = parseFloat(data.price);
  if (data.stock !== undefined) update.stock = parseInt(data.stock, 10);
  if (data.city !== undefined) update.city = data.city;
  if (data.country !== undefined) update.country = data.country;

  if (data.categoryId !== undefined) {
    update.category_id = data.categoryId;
    const catInfo = lookupCategory(data.categoryId);
    const isParent = isParentCategory(data.categoryId);
    if (catInfo) {
      update.category_name = data.categoryName || catInfo.name;
      update.parent_category_id = catInfo.parentId;
      update.parent_category_name = catInfo.parentName;
    } else if (isParent) {
      update.category_name = data.categoryName || getParentName(data.categoryId);
      update.parent_category_id = data.categoryId;
      update.parent_category_name = getParentName(data.categoryId);
    } else {
      if (data.categoryName !== undefined) update.category_name = data.categoryName;
      if (data.parentCategoryId !== undefined) update.parent_category_id = data.parentCategoryId;
      if (data.parentCategoryName !== undefined) update.parent_category_name = data.parentCategoryName;
    }
  } else {
    if (data.categoryName !== undefined) update.category_name = data.categoryName;
    if (data.parentCategoryId !== undefined) update.parent_category_id = data.parentCategoryId;
    if (data.parentCategoryName !== undefined) update.parent_category_name = data.parentCategoryName;
  }

  if (data.sellerId !== undefined) update.seller_id = data.sellerId;
  if (data.sellerName !== undefined) update.seller_name = data.sellerName;
  if (data.images !== undefined) update.images = data.images;
  if (data.tags !== undefined) update.tags = (data.tags || []).map(t => String(t).toLowerCase());
  if (data.viewsCount !== undefined) update.views_count = parseInt(data.viewsCount, 10);

  const result = await col().updateOne(
    { product_id: productId, deleted: false },
    { $set: update }
  );

  if (result.matchedCount === 0) throw new NotFoundError('Produit non trouvé dans l\'index');
  return { productId, updated: true };
}

// Supprime un produit de l'index (soft delete deleted=true dans MongoDB products_index).
async function removeProduct(productId) {
  const result = await col().updateOne(
    { product_id: productId, deleted: false },
    { $set: { deleted: true, updated_at: new Date() } }
  );
  if (result.matchedCount === 0) throw new NotFoundError('Produit non trouvé dans l\'index');
  return { productId, removed: true };
}

// Indexe plusieurs produits en une fois (bulkWrite upsert MongoDB products_index).
async function bulkIndex(products) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new BadRequestError('Tableau de produits requis');
  }

  const ops = products.map(p => {
    const productId = p.productId || p.id;
    const catInfo = lookupCategory(p.categoryId);
    const isParent = isParentCategory(p.categoryId);
    const resolvedParentId = p.parentCategoryId || (catInfo ? catInfo.parentId : (isParent ? p.categoryId : null));
    const resolvedParentName = p.parentCategoryName || (catInfo ? catInfo.parentName : (isParent ? getParentName(p.categoryId) : ''));
    return {
      updateOne: {
        filter: { product_id: productId },
        update: {
          $set: {
            product_id: productId,
            title: p.title,
            description: p.description || '',
            price: parseFloat(p.price),
            stock: parseInt(p.stock, 10) || 0,
            city: p.city || '',
            country: p.country || '',
            category_id: p.categoryId || null,
            category_name: p.categoryName || (catInfo ? catInfo.name : (isParent ? getParentName(p.categoryId) : '')),
            parent_category_id: resolvedParentId,
            parent_category_name: resolvedParentName,
            seller_id: p.sellerId || null,
            seller_name: p.sellerName || '',
            images: p.images || [],
            tags: (p.tags || []).map(t => String(t).toLowerCase()),
            views_count: p.viewsCount || 0,
            reviews_count: parseInt(p.reviewsCount, 10) || 0,
            deleted: false,
            updated_at: new Date(),
            indexed_at: new Date()
          },
          $setOnInsert: { created_at: new Date() }
        },
        upsert: true
      }
    };
  });

  const result = await col().bulkWrite(ops);
  return {
    indexed: result.upsertedCount + result.modifiedCount,
    inserted: result.upsertedCount,
    updated: result.modifiedCount
  };
}

// Regex des anciens identifiants produits (prod-001…) à retirer de l'index MongoDB.
const OLD_ID_PATTERN = /^prod-\d+$/;

// Supprime de l'index uniquement les produits avec l'ancien format prod-XXX.
// Les produits UUID ajoutés via Products-service sont conservés (MongoDB products_index).
async function removeObsoleteProducts(validProductIds) {
  if (!Array.isArray(validProductIds)) {
    throw new BadRequestError('Tableau productIds requis');
  }
  const obsolete = await col()
    .find({ deleted: false })
    .project({ product_id: 1, _id: 0 })
    .toArray();

  const toRemove = obsolete.filter(doc => OLD_ID_PATTERN.test(String(doc.product_id)));
  if (toRemove.length === 0) return { removed: 0 };

  const result = await col().updateMany(
    { product_id: { $in: toRemove.map(d => d.product_id) } },
    { $set: { deleted: true, updated_at: new Date() } }
  );
  return { removed: result.modifiedCount };
}

// Incrémente le compteur de vues dans MongoDB products_index ($inc views_count).
// Complète product.service.incrementViews côté PostgreSQL.
async function incrementViews(productId) {
  await col().updateOne(
    { product_id: productId, deleted: false },
    { $inc: { views_count: 1 } }
  );
}

// Peuple l'index MongoDB products_index avec des données de démonstration (seed).
// Appelle connectMongo puis bulkIndex ; utilisé au démarrage ou en script manuel.
async function seedProducts() {
  const { connectMongo } = require('../config/mongodb');
  await connectMongo();

  const existing = await col().countDocuments({});
  if (existing > 0) {
    const sample = await col().findOne({});
    if (sample && sample.parent_category_id) {
      console.log(`[seed] Index déjà peuplé (${existing} documents) — skip`);
      return;
    }
    console.log('[seed] Données obsolètes détectées (pas de parent_category_id) — re-seed');
    await col().deleteMany({});
  }

  const products = [
    { productId: 'prod-001', title: 'iPhone 15 Pro Max 256Go', description: 'Smartphone Apple dernière génération, état neuf, avec facture et garantie. Couleur titane noir.', price: 1199.99, stock: 5, city: 'Paris', country: 'France', categoryId: 'cat-1-1', sellerId: 'seller-001', sellerName: 'TechStore', images: [], viewsCount: 342 },
    { productId: 'prod-002', title: 'Samsung Galaxy S24 Ultra', description: 'Smartphone Samsung haut de gamme, S Pen intégré, 512Go. Excellent état.', price: 999.00, stock: 3, city: 'Lyon', country: 'France', categoryId: 'cat-1-1', sellerId: 'seller-002', sellerName: 'MobileZone', images: [], viewsCount: 218 },
    { productId: 'prod-003', title: 'MacBook Pro M3 14 pouces', description: 'Ordinateur portable Apple M3 Pro, 18Go RAM, 512Go SSD. Parfait pour les développeurs.', price: 2199.00, stock: 2, city: 'Paris', country: 'France', categoryId: 'cat-1-2', sellerId: 'seller-001', sellerName: 'TechStore', images: [], viewsCount: 567 },
    { productId: 'prod-004', title: 'Vélo électrique Cowboy 4', description: 'Vélo électrique connecté, autonomie 70km, cadre aluminium. Très peu utilisé.', price: 1790.00, stock: 1, city: 'Bordeaux', country: 'France', categoryId: 'cat-5-3', sellerId: 'seller-003', sellerName: 'VeloCity', images: [], viewsCount: 89 },
    { productId: 'prod-005', title: 'Canapé 3 places en cuir marron', description: 'Canapé en cuir véritable, style vintage, très confortable. Dimensions : 220x90x85cm.', price: 450.00, stock: 1, city: 'Marseille', country: 'France', categoryId: 'cat-2-1', sellerId: 'seller-004', sellerName: 'MeublesPlus', images: [], viewsCount: 156 },
    { productId: 'prod-006', title: 'Nike Air Max 90 - Taille 43', description: 'Baskets Nike Air Max 90, coloris blanc/noir, neuves dans boîte. Taille 43 EU.', price: 89.99, stock: 8, city: 'Toulouse', country: 'France', categoryId: 'cat-3-4', sellerId: 'seller-005', sellerName: 'SneakersShop', images: [], viewsCount: 423 },
    { productId: 'prod-007', title: 'PlayStation 5 Digital Edition', description: 'Console Sony PS5 Digital Edition avec 2 manettes DualSense. Firmware à jour.', price: 399.99, stock: 4, city: 'Lille', country: 'France', categoryId: 'cat-1-6', sellerId: 'seller-006', sellerName: 'GameWorld', images: [], viewsCount: 891 },
    { productId: 'prod-008', title: 'Appareil photo Canon EOS R6 Mark II', description: 'Appareil photo hybride plein format, 24.2MP, stabilisation IBIS. Boîtier seul.', price: 2299.00, stock: 2, city: 'Nice', country: 'France', categoryId: 'cat-1-7', sellerId: 'seller-007', sellerName: 'PhotoPro', images: [], viewsCount: 134 },
    { productId: 'prod-009', title: 'Cours de Python — Pack complet', description: 'Formation complète Python : bases, POO, Django, Data Science. 40h de vidéo + exercices.', price: 29.99, stock: 999, city: 'En ligne', country: 'France', categoryId: 'cat-14-1', sellerId: 'seller-008', sellerName: 'LearnCode', images: [], viewsCount: 1203 },
    { productId: 'prod-010', title: 'Table de jardin en teck 6 places', description: 'Table de jardin en teck massif, résistante aux intempéries. 180x90cm avec rallonge.', price: 599.00, stock: 3, city: 'Nantes', country: 'France', categoryId: 'cat-11-5', sellerId: 'seller-004', sellerName: 'MeublesPlus', images: [], viewsCount: 67 },
    { productId: 'prod-011', title: 'Drone DJI Mini 4 Pro', description: 'Drone compact 4K, détection d\'obstacles omnidirectionnelle, autonomie 34 min.', price: 799.00, stock: 6, city: 'Strasbourg', country: 'France', categoryId: 'cat-1-7', sellerId: 'seller-007', sellerName: 'PhotoPro', images: [], viewsCount: 245 },
    { productId: 'prod-012', title: 'Lot de 50 livres de poche', description: 'Collection variée : romans, thrillers, science-fiction. Bon état général.', price: 25.00, stock: 1, city: 'Montpellier', country: 'France', categoryId: 'cat-9-1', sellerId: 'seller-009', sellerName: 'BouquinExpress', images: [], viewsCount: 43 },
    { productId: 'prod-013', title: 'Montre Casio G-Shock GA-2100', description: 'Montre Casio G-Shock "CasiOak", résistante aux chocs, étanche 200m. Coloris noir.', price: 79.00, stock: 12, city: 'Lyon', country: 'France', categoryId: 'cat-3-6', sellerId: 'seller-005', sellerName: 'SneakersShop', images: [], viewsCount: 312 },
    { productId: 'prod-014', title: 'Aspirateur robot Roborock S8 Pro', description: 'Aspirateur robot avec station de lavage automatique, navigation LiDAR. Excellent état.', price: 549.00, stock: 2, city: 'Paris', country: 'France', categoryId: 'cat-2-4', sellerId: 'seller-010', sellerName: 'HomeTech', images: [], viewsCount: 178 },
    { productId: 'prod-015', title: 'Guitare acoustique Yamaha FG800', description: 'Guitare acoustique folk, table en épicéa, idéale pour débutants et intermédiaires.', price: 199.00, stock: 4, city: 'Rennes', country: 'France', categoryId: 'cat-9-5', sellerId: 'seller-011', sellerName: 'MusicShop', images: [], viewsCount: 92 },
    { productId: 'prod-016', title: 'Parfum Dior Sauvage 100ml', description: 'Eau de Parfum Dior Sauvage, flacon 100ml neuf sous blister.', price: 89.90, stock: 10, city: 'Paris', country: 'France', categoryId: 'cat-4-3', sellerId: 'seller-012', sellerName: 'BeautyCorner', images: [], viewsCount: 187 },
    { productId: 'prod-017', title: 'RTX 4070 Super 12Go', description: 'Carte graphique NVIDIA GeForce RTX 4070 Super, 12Go GDDR6X. Neuve garantie 3 ans.', price: 649.00, stock: 7, city: 'Paris', country: 'France', categoryId: 'cat-1-8', sellerId: 'seller-001', sellerName: 'TechStore', images: [], viewsCount: 534 },
    { productId: 'prod-018', title: 'Poussette Yoyo2 Babyzen', description: 'Poussette ultra-compacte, pliage cabine avion. Coloris noir, très bon état.', price: 320.00, stock: 2, city: 'Lyon', country: 'France', categoryId: 'cat-7-1', sellerId: 'seller-013', sellerName: 'BabyShop', images: [], viewsCount: 76 },
    { productId: 'prod-019', title: 'Croquettes Royal Canin Chat 10kg', description: 'Croquettes premium pour chat adulte, sac de 10kg. Date limite lointaine.', price: 54.99, stock: 20, city: 'Toulouse', country: 'France', categoryId: 'cat-13-1', sellerId: 'seller-014', sellerName: 'PetFood', images: [], viewsCount: 38 },
    { productId: 'prod-020', title: 'Perceuse visseuse Bosch 18V', description: 'Perceuse-visseuse sans fil Bosch Professional, 2 batteries Li-Ion 4.0Ah + coffret.', price: 189.00, stock: 5, city: 'Bordeaux', country: 'France', categoryId: 'cat-11-1', sellerId: 'seller-015', sellerName: 'BricoDepot', images: [], viewsCount: 95 }
  ];

  await bulkIndex(products);
  console.log(`[seed] ${products.length} produits indexés`);
}

module.exports = { indexProduct, updateProduct, removeProduct, bulkIndex, removeObsoleteProducts, incrementViews, seedProducts };
