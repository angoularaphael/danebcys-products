// Arbre statique des catégories marketplace (14 catégories parentes + sous-catégories).
// Données en dur ; utilisé par data/categories, search.service (arbre) et index.service (résolution noms).
const CATEGORIES = [
  {
    id: 'pcat-1',
    name: 'Électronique & High-Tech',
    subcategories: [
      { id: 'cat-1-1', name: 'Smartphones & accessoires' },
      { id: 'cat-1-2', name: 'Ordinateurs (portables, PC fixes)' },
      { id: 'cat-1-3', name: 'Tablettes & liseuses' },
      { id: 'cat-1-4', name: 'TV & Home cinéma' },
      { id: 'cat-1-5', name: 'Audio (casques, écouteurs, enceintes)' },
      { id: 'cat-1-6', name: 'Gaming (consoles, jeux, manettes)' },
      { id: 'cat-1-7', name: 'Appareils photo & caméras' },
      { id: 'cat-1-8', name: 'Composants informatiques (GPU, RAM, SSD)' }
    ]
  },
  {
    id: 'pcat-2',
    name: 'Maison & Cuisine',
    subcategories: [
      { id: 'cat-2-1', name: 'Meubles (canapés, tables, lits)' },
      { id: 'cat-2-2', name: 'Décoration (cadres, tapis, luminaires)' },
      { id: 'cat-2-3', name: 'Cuisine & ustensiles' },
      { id: 'cat-2-4', name: 'Électroménager (micro-ondes, mixeurs, cafetières)' },
      { id: 'cat-2-5', name: 'Rangement & organisation' },
      { id: 'cat-2-6', name: 'Literie' }
    ]
  },
  {
    id: 'pcat-3',
    name: 'Mode',
    subcategories: [
      { id: 'cat-3-1', name: 'Homme' },
      { id: 'cat-3-2', name: 'Femme' },
      { id: 'cat-3-3', name: 'Enfant & bébé' },
      { id: 'cat-3-4', name: 'Chaussures' },
      { id: 'cat-3-5', name: 'Sacs & bagages' },
      { id: 'cat-3-6', name: 'Bijoux & montres' },
      { id: 'cat-3-7', name: 'Accessoires (ceintures, lunettes)' }
    ]
  },
  {
    id: 'pcat-4',
    name: 'Beauté & Santé',
    subcategories: [
      { id: 'cat-4-1', name: 'Soins visage & corps' },
      { id: 'cat-4-2', name: 'Maquillage' },
      { id: 'cat-4-3', name: 'Parfums' },
      { id: 'cat-4-4', name: 'Produits capillaires' },
      { id: 'cat-4-5', name: 'Hygiène personnelle' },
      { id: 'cat-4-6', name: 'Compléments alimentaires' },
      { id: 'cat-4-7', name: 'Appareils de santé' }
    ]
  },
  {
    id: 'pcat-5',
    name: 'Sports & Loisirs',
    subcategories: [
      { id: 'cat-5-1', name: 'Fitness & musculation' },
      { id: 'cat-5-2', name: 'Sports d\'équipe' },
      { id: 'cat-5-3', name: 'Vélo & mobilité' },
      { id: 'cat-5-4', name: 'Camping & randonnée' },
      { id: 'cat-5-5', name: 'Sports nautiques' },
      { id: 'cat-5-6', name: 'Jeux de plein air' }
    ]
  },
  {
    id: 'pcat-6',
    name: 'Auto & Moto',
    subcategories: [
      { id: 'cat-6-1', name: 'Pièces détachées' },
      { id: 'cat-6-2', name: 'Accessoires auto' },
      { id: 'cat-6-3', name: 'Entretien & nettoyage' },
      { id: 'cat-6-4', name: 'Équipement moto' },
      { id: 'cat-6-5', name: 'Pneus & jantes' }
    ]
  },
  {
    id: 'pcat-7',
    name: 'Bébé & Enfants',
    subcategories: [
      { id: 'cat-7-1', name: 'Poussettes & sièges auto' },
      { id: 'cat-7-2', name: 'Vêtements bébé' },
      { id: 'cat-7-3', name: 'Jouets éducatifs' },
      { id: 'cat-7-4', name: 'Alimentation bébé' },
      { id: 'cat-7-5', name: 'Chambre bébé' }
    ]
  },
  {
    id: 'pcat-8',
    name: 'Jouets & Jeux',
    subcategories: [
      { id: 'cat-8-1', name: 'Jeux de société' },
      { id: 'cat-8-2', name: 'Jouets éducatifs' },
      { id: 'cat-8-3', name: 'Figurines' },
      { id: 'cat-8-4', name: 'Puzzles' },
      { id: 'cat-8-5', name: 'Jeux vidéo' }
    ]
  },
  {
    id: 'pcat-9',
    name: 'Livres, Films & Musique',
    subcategories: [
      { id: 'cat-9-1', name: 'Livres papier' },
      { id: 'cat-9-2', name: 'E-books' },
      { id: 'cat-9-3', name: 'Bandes dessinées' },
      { id: 'cat-9-4', name: 'DVD / Blu-ray' },
      { id: 'cat-9-5', name: 'Vinyles / CD' }
    ]
  },
  {
    id: 'pcat-10',
    name: 'Alimentation & Épicerie',
    subcategories: [
      { id: 'cat-10-1', name: 'Produits secs' },
      { id: 'cat-10-2', name: 'Boissons' },
      { id: 'cat-10-3', name: 'Produits bio' },
      { id: 'cat-10-4', name: 'Produits locaux' },
      { id: 'cat-10-5', name: 'Snacks & confiseries' }
    ]
  },
  {
    id: 'pcat-11',
    name: 'Bricolage & Jardin',
    subcategories: [
      { id: 'cat-11-1', name: 'Outils' },
      { id: 'cat-11-2', name: 'Matériaux' },
      { id: 'cat-11-3', name: 'Peinture' },
      { id: 'cat-11-4', name: 'Équipement de jardin' },
      { id: 'cat-11-5', name: 'Mobilier extérieur' }
    ]
  },
  {
    id: 'pcat-12',
    name: 'Fournitures de bureau & Papeterie',
    subcategories: [
      { id: 'cat-12-1', name: 'Cahiers & carnets' },
      { id: 'cat-12-2', name: 'Stylos & accessoires' },
      { id: 'cat-12-3', name: 'Imprimantes & cartouches' },
      { id: 'cat-12-4', name: 'Organisation de bureau' }
    ]
  },
  {
    id: 'pcat-13',
    name: 'Animaux',
    subcategories: [
      { id: 'cat-13-1', name: 'Nourriture chiens/chats' },
      { id: 'cat-13-2', name: 'Accessoires' },
      { id: 'cat-13-3', name: 'Aquariophilie' },
      { id: 'cat-13-4', name: 'Hygiène & soins' }
    ]
  },
  {
    id: 'pcat-14',
    name: 'Produits numériques',
    subcategories: [
      { id: 'cat-14-1', name: 'Logiciels' },
      { id: 'cat-14-2', name: 'Licences' },
      { id: 'cat-14-3', name: 'Cartes cadeaux' },
      { id: 'cat-14-4', name: 'Abonnements' }
    ]
  }
];

// Map sous-catégorie id → { id, name, parentId, parentName } pour lookup O(1).
const flatMap = new Map();
// Map catégorie parente id → nom pour résolution rapide.
const parentMap = new Map();

for (const parent of CATEGORIES) {
  parentMap.set(parent.id, parent.name);
  for (const sub of parent.subcategories) {
    flatMap.set(sub.id, {
      id: sub.id,
      name: sub.name,
      parentId: parent.id,
      parentName: parent.name
    });
  }
}

// Retourne l'arbre complet des catégories statiques.
// Appelé par search.service.categoryTree() ; pas d'appel base de données.
function getCategoryTree() {
  return CATEGORIES;
}

// Indique si un identifiant correspond à une catégorie parente (préfixe pcat-).
// Utilisé par search.service et index.service pour filtrer par parent.
function isParentCategory(id) {
  return id && id.startsWith('pcat-');
}

// Résout une sous-catégorie par son id depuis la map en mémoire.
// Appelé par index.service lors de l'indexation MongoDB products_index.
function lookupCategory(categoryId) {
  return flatMap.get(categoryId) || null;
}

// Retourne le nom d'une catégorie parente par son id.
function getParentName(parentId) {
  return parentMap.get(parentId) || null;
}

// Liste les ids des sous-catégories d'une catégorie parente.
function getSubcategoryIds(parentId) {
  const parent = CATEGORIES.find(c => c.id === parentId);
  return parent ? parent.subcategories.map(s => s.id) : [];
}

module.exports = { CATEGORIES, getCategoryTree, isParentCategory, lookupCategory, getParentName, getSubcategoryIds };
