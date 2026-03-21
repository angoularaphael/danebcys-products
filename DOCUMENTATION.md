# Products-service

## Rôle
Gestion des annonces/produits, catégories, avis, opérations internes stock/statistiques vendeur.

## Port et santé
- Port par défaut: `3004`
- Healthcheck: `GET /health`

## Variables d'environnement (canoniques)
- `PORT`, `NODE_ENV`
- `PG_HOST`, `PG_PORT`, `PG_DATABASE`, `PG_USER`, `PG_PASSWORD`
- `AUTH_SERVICE_URL`, `SEARCH_SERVICE_URL`, `USERS_SERVICE_URL`, `ORDERS_SERVICE_URL`, `INTER_SERVICE_KEY`
- `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS`

## Routes publiques (`/api/v1/products`)
- `GET /categories`
- `GET /top-sellers`
- `GET /seller/:sellerId` — liste les annonces du vendeur ; chaque produit est enrichi avec **`sellerName`** (appel interne à Auth `GET /internal/users/:id`, libellé dérivé du username, du nom complet ou de l’email selon ce qui est disponible). Si Auth est indisponible ou si l’utilisateur est introuvable, les produits sont renvoyés sans ce champ ou avec une valeur vide selon le comportement actuel du service.
- `GET /flash-sales`
- `GET /:id/reviews`
- `GET /:id`

## Routes authentifiées (`/api/v1/products`)
- `GET /me` (à enregistrer **avant** `GET /:id` dans le routeur pour éviter que `me` soit capturé comme identifiant)
- `POST /`
- `PUT /:id`
- `DELETE /:id`
- `PUT /:id/flash-sale`
- `DELETE /:id/flash-sale`
- `POST /:id/reviews`

## Routes internes (`/internal`, protégées X-Service-Key)
- `GET /products/seller/:sellerId/stats`
- `GET /products/:id`
- `PUT /products/:id/stock`

## Dépendances
- PostgreSQL
- `Auth-service`
- `Search-service`
- `Users-service`

## Démarrage
- Local: `npm run dev`
- Docker: via `docker compose --env-file .env.docker up --build`

## Secrets & configuration
- **Fichier source** : `Products-service/.env` (non versionné par Git).
- **Copie locale de référence** : `Secrets-Danebcys/Products-service/.env`, synchronisée depuis la racine du monorepo avec `.\scripts\sync-secrets-danebcys.ps1` (PowerShell).
- Ne jamais committer les valeurs sensibles.

# Products Service — Documentation technique

> Microservice de gestion des produits/annonces pour **DANEBCYS**.  
> CRUD produits, catégories, avis. Indexation vers Search-service.  
> Les sections Home métier (best sellers / flash sales) sont alimentées depuis des endpoints dédiés backend.

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

- **POST /api/v1/products** (créer un produit) : autorisé aux rôles `admin`, `vendeur` et `user`
- Le flux applicatif redirige les vendeurs vers dashboard + vérification email avant publication
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
| GET | /top-sellers | Non | Produits classés par quantités vendues (commandes payées) |
| GET | /flash-sales | Non | Produits avec réduction flash active uniquement |
| GET | /seller/:sellerId | Non | Produits d'un vendeur |
| GET | /:id/reviews | Non | Avis paginés (avec info utilisateur) |

### Routes authentifiées — `/api/v1/products`

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | /me | Mes annonces (vendeur) |
| POST | / | Créer un produit (admin, vendeur ou user) |
| PUT | /:id | Modifier (propriétaire) |
| DELETE | /:id | Supprimer (soft delete, propriétaire) |
| PUT | /:id/flash-sale | Activer ou mettre à jour une réduction flash vendeur |
| DELETE | /:id/flash-sale | Désactiver la réduction flash |
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
| Orders-service (3005) | internal/orders/top-products (agrégation ventes payées) |

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
| ORDERS_SERVICE_URL | URL Orders-service | http://localhost:3005 |
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

Nécessite : Auth-service (3001), Search-service (3003), Orders-service (3005), PostgreSQL.
