# Products Service — Documentation technique

> Microservice de gestion des produits/annonces pour **DANEBCYS**.  
> CRUD produits, catégories, avis. Indexation vers Search-service.  
> Seuls super admin et vendeur peuvent créer des produits.

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture du projet](#2-architecture-du-projet)
3. [Autorisation création](#3-autorisation-création)
4. [Schéma PostgreSQL](#4-schéma-postgresql)
5. [Endpoints API](#5-endpoints-api)
6. [Routes internes](#6-routes-internes)
7. [Communication inter-services](#7-communication-inter-services)
8. [Variables d'environnement](#8-variables-denvironnement)
9. [Installation et lancement](#9-installation-et-lancement)

---

## 1. Vue d'ensemble

| Fonctionnalité | Technologie |
|----------------|-------------|
| CRUD produits | PostgreSQL |
| Catégories | Arbre hiérarchique (14 parentes + sous-catégories) |
| Avis | Note 1-5, 1 par user/produit, moyenne affichée |
| Indexation | Push vers Search-service à la création/mise à jour |
| Authentification | Bearer token via Auth-service |
| Rate limiting | In-memory, user ID ou IP |

**Port** : 3004  
**Base de données** : PostgreSQL (base partagée `danebcys`)

---

## 2. Architecture du projet

```
Products-service/
├── src/
│   ├── config/
│   │   ├── database.js
│   │   └── env.js
│   ├── controllers/
│   │   ├── product.controller.js
│   │   └── review.controller.js
│   ├── middlewares/
│   │   ├── auth.js
│   │   ├── rateLimiter.js
│   │   ├── sellerOrAdmin.js    # Vérification vendeur/admin pour création
│   │   └── serviceAuth.js
│   ├── routes/
│   │   ├── product.routes.js   # /api/v1/products
│   │   └── internal.routes.js  # /internal
│   ├── services/
│   │   ├── authClient.js
│   │   ├── searchClient.js
│   │   ├── usersClient.js
│   │   ├── product.service.js
│   │   ├── category.service.js
│   │   └── review.service.js
│   ├── utils/
│   │   └── errors.js
│   └── app.js
├── public/
├── init.sql
├── server.js
├── .env
└── package.json
```

---

## 3. Autorisation création

- **POST /api/v1/products** (créer un produit) : réservé aux rôles `admin` (super admin) et `vendeur`
- Les utilisateurs standard (`user`) ne peuvent pas créer de produits
- L'ID du produit est généré automatiquement (gen_random_uuid), l'utilisateur ne fournit pas l'id

---

## 4. Schéma PostgreSQL

| Table | Description |
|-------|-------------|
| categories | Catégories hiérarchiques (parent_id) |
| products | Annonces (seller_id, category_id, price, stock, soft delete) |
| reviews | Avis (product_id, user_id, rating 1-5, comment) — moyenne calculée |
| ads_promotions | Promotions |

---

## 5. Endpoints API

### Routes publiques — `/api/v1/products`

| Méthode | Route | Auth | Description |
|---------|-------|------|-------------|
| GET | /:id | Non | Détail produit (incrémente views_count, inclut avis et moyenne) |
| GET | /categories | Non | Arbre des catégories |
| GET | /:id/reviews | Non | Avis paginés (avec info utilisateur) |

### Routes authentifiées — `/api/v1/products`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /me | Mes annonces (vendeur) |
| POST | / | Créer un produit (admin ou vendeur uniquement) |
| PUT | /:id | Modifier (propriétaire) |
| DELETE | /:id | Supprimer (soft delete, propriétaire) |
| POST | /:id/reviews | Ajouter un avis |

---

## 6. Routes internes

Protégées par `X-Service-Key`.

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /internal/products/:id | Récupérer un produit |
| PUT | /internal/products/:id/stock | Modifier le stock |
| GET | /internal/products/seller/:sellerId/stats | Stats vendeur |

---

## 7. Communication inter-services

| Service | Appels |
|---------|--------|
| Auth-service (3001) | validate-token, users/:id |
| Search-service (3003) | index, index/bulk, index/:id, index/:id/view |
| Users-service (3002) | favorites/:userId/:adId (vérifier favori) |

---

## 8. Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| PORT | Port du serveur | 3004 |
| NODE_ENV | Environnement | development |
| PG_HOST, PG_PORT, PG_DATABASE, PG_USER, PG_PASSWORD | PostgreSQL | — |
| AUTH_SERVICE_URL | URL Auth-service | http://localhost:3001 |
| SEARCH_SERVICE_URL | URL Search-service | http://localhost:3003 |
| USERS_SERVICE_URL | URL Users-service | http://localhost:3002 |
| INTER_SERVICE_KEY | Clé inter-services | — |
| RATE_LIMIT_WINDOW_MS | Fenêtre rate limit | 900000 |
| RATE_LIMIT_MAX_REQUESTS | Max requêtes par fenêtre | 100 |

---

## 9. Installation et lancement

```bash
cd Products-service
npm install
npm start
```

Nécessite : Auth-service (3001), Search-service (3003), Users-service (3002), PostgreSQL.
