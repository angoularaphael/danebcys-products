/**
 * Tests d'intégration de l'index recherche fusionné dans Products-service
 * (collection Mongo `products_index`, ex-Search-service).
 */

const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createFakeCollection } = require('./helpers/fakeMongoCollection');

const fakeCol = createFakeCollection();

const mongodbConfigPath = path.resolve(__dirname, '..', 'src', 'config', 'mongodb.js');
require.cache[mongodbConfigPath] = {
  id: mongodbConfigPath,
  filename: mongodbConfigPath,
  loaded: true,
  exports: {
    getDb: () => ({ collection: () => fakeCol }),
    connectMongo: async () => {},
    closeMongo: async () => {}
  }
};

const indexService = require('../src/services/index.service');
const searchService = require('../src/services/search.service');

const SAMPLE = {
  productId: 'prod-test-1',
  title: 'iPhone 15 Pro',
  description: 'Smartphone neuf',
  price: 999,
  stock: 5,
  city: 'Paris',
  country: 'France',
  categoryId: 'cat-1-1',
  sellerId: 'seller-1',
  sellerName: 'TechShop',
  images: ['img.jpg'],
  tags: ['Refurbished']
};

test.beforeEach(() => {
  fakeCol._reset();
});

test('indexProduct insère un produit dans l\'index', async () => {
  const res = await indexService.indexProduct(SAMPLE);
  assert.equal(res.indexed, true);

  const found = await fakeCol.findOne({ product_id: 'prod-test-1' });
  assert.equal(found.title, 'iPhone 15 Pro');
  assert.equal(found.deleted, false);
  assert.equal(found.views_count, 0);
  assert.deepEqual(found.tags, ['refurbished'], 'tags lowercased');
});

test('indexProduct refuse de réindexer un produit existant', async () => {
  await indexService.indexProduct(SAMPLE);
  await assert.rejects(
    () => indexService.indexProduct(SAMPLE),
    /déjà indexé/
  );
});

test('indexProduct rejette si productId/title/price manquant', async () => {
  await assert.rejects(
    () => indexService.indexProduct({ productId: 'x', title: '' }),
    /requis/
  );
});

test('updateProduct met à jour les champs autorisés', async () => {
  await indexService.indexProduct(SAMPLE);
  await indexService.updateProduct('prod-test-1', { title: 'iPhone 15 Pro Max', price: 1299 });

  const found = await fakeCol.findOne({ product_id: 'prod-test-1' });
  assert.equal(found.title, 'iPhone 15 Pro Max');
  assert.equal(found.price, 1299);
});

test('removeProduct fait un soft-delete', async () => {
  await indexService.indexProduct(SAMPLE);
  await indexService.removeProduct('prod-test-1');

  const found = await fakeCol.findOne({ product_id: 'prod-test-1' });
  assert.equal(found.deleted, true);
});

test('bulkIndex upsert plusieurs produits', async () => {
  const res = await indexService.bulkIndex([
    { ...SAMPLE, productId: 'a' },
    { ...SAMPLE, productId: 'b', title: 'Galaxy S24' },
    { ...SAMPLE, productId: 'c', title: 'MacBook' }
  ]);
  assert.equal(res.indexed, 3);
  assert.equal(res.inserted, 3);
});

test('removeObsoleteProducts retire seulement les anciens IDs prod-XXX', async () => {
  await indexService.indexProduct({ ...SAMPLE, productId: 'prod-001' });
  await indexService.indexProduct({ ...SAMPLE, productId: 'prod-002' });
  await indexService.indexProduct({ ...SAMPLE, productId: 'real-uuid-abc' });

  const res = await indexService.removeObsoleteProducts(['real-uuid-abc']);
  assert.equal(res.removed, 2, 'les 2 prod-XXX sont marqués deleted');

  const stillThere = await fakeCol.findOne({ product_id: 'real-uuid-abc' });
  assert.equal(stillThere.deleted, false);
});

test('incrementViews augmente le compteur', async () => {
  await indexService.indexProduct(SAMPLE);
  await indexService.incrementViews('prod-test-1');
  await indexService.incrementViews('prod-test-1');
  const found = await fakeCol.findOne({ product_id: 'prod-test-1' });
  assert.equal(found.views_count, 2);
});

test('search retrouve un produit par mot-clé du titre (regex non-strict)', async () => {
  await indexService.indexProduct({ ...SAMPLE, productId: 'p1', title: 'iPhone 15' });
  await indexService.indexProduct({ ...SAMPLE, productId: 'p2', title: 'Galaxy S24' });

  const res = await searchService.search({ q: 'iphone' });
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].title, 'iPhone 15');
  assert.equal(res.pagination.total, 1);
});

test('search filtre par fourchette de prix', async () => {
  await indexService.indexProduct({ ...SAMPLE, productId: 'cheap', title: 'A', price: 50 });
  await indexService.indexProduct({ ...SAMPLE, productId: 'mid', title: 'B', price: 500 });
  await indexService.indexProduct({ ...SAMPLE, productId: 'expensive', title: 'C', price: 5000 });

  const res = await searchService.search({ minPrice: 100, maxPrice: 1000 });
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].productId, 'mid');
});

test('search trie par price_asc', async () => {
  await indexService.indexProduct({ ...SAMPLE, productId: 'a', title: 'A', price: 300 });
  await indexService.indexProduct({ ...SAMPLE, productId: 'b', title: 'B', price: 100 });
  await indexService.indexProduct({ ...SAMPLE, productId: 'c', title: 'C', price: 200 });

  const res = await searchService.search({ sort: 'price_asc' });
  assert.deepEqual(res.results.map((r) => r.productId), ['b', 'c', 'a']);
});

test('search renvoie les soft-deleted comme exclus', async () => {
  await indexService.indexProduct({ ...SAMPLE, productId: 'kept', title: 'Kept' });
  await indexService.indexProduct({ ...SAMPLE, productId: 'gone', title: 'Gone' });
  await indexService.removeProduct('gone');

  const res = await searchService.search({});
  assert.equal(res.results.length, 1);
  assert.equal(res.results[0].productId, 'kept');
});

test('trending trie par views_count décroissant', async () => {
  await indexService.indexProduct({ ...SAMPLE, productId: 'low', title: 'Low' });
  await indexService.indexProduct({ ...SAMPLE, productId: 'high', title: 'High' });
  for (let i = 0; i < 5; i++) await indexService.incrementViews('high');
  await indexService.incrementViews('low');

  const res = await searchService.trending(5);
  assert.equal(res[0].productId, 'high');
});
