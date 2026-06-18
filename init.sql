-- ============================================================
-- Products Service — Schema + Seed
-- Base de données : danebcys_products
-- ============================================================

-- ─── Categories (hiérarchiques) ────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  parent_id VARCHAR(20) REFERENCES categories(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Products / Annonces ───────────────────────────────────
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT DEFAULT '',
  price DECIMAL(12,2) NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  seller_id UUID NOT NULL,
  category_id VARCHAR(20) REFERENCES categories(id),
  city VARCHAR(100) DEFAULT '',
  country VARCHAR(100) DEFAULT 'France',
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  views_count INTEGER NOT NULL DEFAULT 0,
  is_flash_sale BOOLEAN NOT NULL DEFAULT FALSE,
  flash_sale_discount_percent INTEGER,
  flash_sale_price DECIMAL(12,2),
  flash_sale_started_at TIMESTAMPTZ,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Reviews / Avis ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id),
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT DEFAULT '',
  is_moderated BOOLEAN NOT NULL DEFAULT FALSE,
  deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(product_id, user_id)
);

-- ─── Migrations (colonnes ajoutées après création initiale du schéma) ───
ALTER TABLE products ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_flash_sale BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_discount_percent INTEGER;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_price DECIMAL(12,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_started_at TIMESTAMPTZ;
ALTER TABLE products ADD COLUMN IF NOT EXISTS flash_sale_ends_at TIMESTAMPTZ;

-- ─── Ads / Promotions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  content TEXT DEFAULT '',
  product_id UUID REFERENCES products(id),
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Index ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_products_title ON products USING gin (to_tsvector('french', title));
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category_id ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products (id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_views ON products (views_count DESC) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_price ON products (price) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_created ON products (created_at DESC) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_products_flash_sale ON products (is_flash_sale, flash_sale_started_at DESC) WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id) WHERE deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews (user_id) WHERE deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_ads_active ON ads_promotions (is_active, start_date, end_date);

-- ─── Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_products_updated_at'
  ) THEN
    CREATE TRIGGER trg_products_updated_at
      BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reviews_updated_at'
  ) THEN
    CREATE TRIGGER trg_reviews_updated_at
      BEFORE UPDATE ON reviews
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;

-- ═══════════════════════════════════════════════════════════
-- Seed categories (ON CONFLICT DO NOTHING)
-- ═══════════════════════════════════════════════════════════

-- Parents
INSERT INTO categories (id, name, parent_id) VALUES
  ('pcat-1',  'Électronique & High-Tech', NULL),
  ('pcat-2',  'Maison & Cuisine', NULL),
  ('pcat-3',  'Mode', NULL),
  ('pcat-4',  'Beauté & Santé', NULL),
  ('pcat-5',  'Sports & Loisirs', NULL),
  ('pcat-6',  'Auto & Moto', NULL),
  ('pcat-7',  'Bébé & Enfants', NULL),
  ('pcat-8',  'Jouets & Jeux', NULL),
  ('pcat-9',  'Livres, Films & Musique', NULL),
  ('pcat-10', 'Alimentation & Épicerie', NULL),
  ('pcat-11', 'Bricolage & Jardin', NULL),
  ('pcat-12', 'Fournitures de bureau & Papeterie', NULL),
  ('pcat-13', 'Animaux', NULL),
  ('pcat-14', 'Produits numériques', NULL)
ON CONFLICT DO NOTHING;

-- Électronique & High-Tech
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-1-1', 'Smartphones & accessoires', 'pcat-1'),
  ('cat-1-2', 'Ordinateurs', 'pcat-1'),
  ('cat-1-3', 'Tablettes & liseuses', 'pcat-1'),
  ('cat-1-4', 'TV & Home cinéma', 'pcat-1'),
  ('cat-1-5', 'Audio', 'pcat-1'),
  ('cat-1-6', 'Gaming', 'pcat-1'),
  ('cat-1-7', 'Appareils photo & caméras', 'pcat-1'),
  ('cat-1-8', 'Composants informatiques', 'pcat-1')
ON CONFLICT DO NOTHING;

-- Maison & Cuisine
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-2-1', 'Meubles', 'pcat-2'),
  ('cat-2-2', 'Décoration', 'pcat-2'),
  ('cat-2-3', 'Cuisine & ustensiles', 'pcat-2'),
  ('cat-2-4', 'Électroménager', 'pcat-2'),
  ('cat-2-5', 'Rangement & organisation', 'pcat-2'),
  ('cat-2-6', 'Literie', 'pcat-2')
ON CONFLICT DO NOTHING;

-- Mode
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-3-1', 'Homme', 'pcat-3'),
  ('cat-3-2', 'Femme', 'pcat-3'),
  ('cat-3-3', 'Enfant & bébé', 'pcat-3'),
  ('cat-3-4', 'Chaussures', 'pcat-3'),
  ('cat-3-5', 'Sacs & bagages', 'pcat-3'),
  ('cat-3-6', 'Bijoux & montres', 'pcat-3'),
  ('cat-3-7', 'Accessoires', 'pcat-3')
ON CONFLICT DO NOTHING;

-- Beauté & Santé
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-4-1', 'Soins du visage', 'pcat-4'),
  ('cat-4-2', 'Soins du corps', 'pcat-4'),
  ('cat-4-3', 'Maquillage', 'pcat-4'),
  ('cat-4-4', 'Parfums', 'pcat-4'),
  ('cat-4-5', 'Hygiène', 'pcat-4'),
  ('cat-4-6', 'Compléments alimentaires', 'pcat-4'),
  ('cat-4-7', 'Matériel médical', 'pcat-4')
ON CONFLICT DO NOTHING;

-- Sports & Loisirs
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-5-1', 'Fitness & musculation', 'pcat-5'),
  ('cat-5-2', 'Sports collectifs', 'pcat-5'),
  ('cat-5-3', 'Randonnée & camping', 'pcat-5'),
  ('cat-5-4', 'Cyclisme', 'pcat-5'),
  ('cat-5-5', 'Sports nautiques', 'pcat-5'),
  ('cat-5-6', 'Sports d''hiver', 'pcat-5')
ON CONFLICT DO NOTHING;

-- Auto & Moto
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-6-1', 'Pièces auto', 'pcat-6'),
  ('cat-6-2', 'Pièces moto', 'pcat-6'),
  ('cat-6-3', 'Accessoires auto', 'pcat-6'),
  ('cat-6-4', 'Accessoires moto', 'pcat-6'),
  ('cat-6-5', 'Entretien & outillage', 'pcat-6')
ON CONFLICT DO NOTHING;

-- Bébé & Enfants
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-7-1', 'Poussettes & sièges auto', 'pcat-7'),
  ('cat-7-2', 'Alimentation bébé', 'pcat-7'),
  ('cat-7-3', 'Vêtements bébé', 'pcat-7'),
  ('cat-7-4', 'Jouets premier âge', 'pcat-7'),
  ('cat-7-5', 'Puériculture', 'pcat-7')
ON CONFLICT DO NOTHING;

-- Jouets & Jeux
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-8-1', 'Jeux de société', 'pcat-8'),
  ('cat-8-2', 'Jeux de construction', 'pcat-8'),
  ('cat-8-3', 'Figurines & peluches', 'pcat-8'),
  ('cat-8-4', 'Jeux éducatifs', 'pcat-8'),
  ('cat-8-5', 'Jeux d''extérieur', 'pcat-8')
ON CONFLICT DO NOTHING;

-- Livres, Films & Musique
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-9-1', 'Livres', 'pcat-9'),
  ('cat-9-2', 'BD & mangas', 'pcat-9'),
  ('cat-9-3', 'DVD & Blu-ray', 'pcat-9'),
  ('cat-9-4', 'Vinyles & CD', 'pcat-9'),
  ('cat-9-5', 'Instruments de musique', 'pcat-9')
ON CONFLICT DO NOTHING;

-- Alimentation & Épicerie
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-10-1', 'Épicerie sucrée', 'pcat-10'),
  ('cat-10-2', 'Épicerie salée', 'pcat-10'),
  ('cat-10-3', 'Boissons', 'pcat-10'),
  ('cat-10-4', 'Bio & diététique', 'pcat-10'),
  ('cat-10-5', 'Produits du terroir', 'pcat-10')
ON CONFLICT DO NOTHING;

-- Bricolage & Jardin
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-11-1', 'Outillage', 'pcat-11'),
  ('cat-11-2', 'Quincaillerie', 'pcat-11'),
  ('cat-11-3', 'Peinture & revêtements', 'pcat-11'),
  ('cat-11-4', 'Jardin & extérieur', 'pcat-11'),
  ('cat-11-5', 'Plomberie & électricité', 'pcat-11')
ON CONFLICT DO NOTHING;

-- Fournitures de bureau & Papeterie
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-12-1', 'Fournitures scolaires', 'pcat-12'),
  ('cat-12-2', 'Papeterie', 'pcat-12'),
  ('cat-12-3', 'Imprimantes & consommables', 'pcat-12'),
  ('cat-12-4', 'Mobilier de bureau', 'pcat-12')
ON CONFLICT DO NOTHING;

-- Animaux
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-13-1', 'Alimentation animale', 'pcat-13'),
  ('cat-13-2', 'Accessoires chien', 'pcat-13'),
  ('cat-13-3', 'Accessoires chat', 'pcat-13'),
  ('cat-13-4', 'Aquariophilie & terrariophilie', 'pcat-13')
ON CONFLICT DO NOTHING;

-- Produits numériques
INSERT INTO categories (id, name, parent_id) VALUES
  ('cat-14-1', 'Logiciels & licences', 'pcat-14'),
  ('cat-14-2', 'E-books', 'pcat-14'),
  ('cat-14-3', 'Formations en ligne', 'pcat-14'),
  ('cat-14-4', 'Musique & vidéo dématérialisée', 'pcat-14')
ON CONFLICT DO NOTHING;

-- Nettoyage migration flash sale
UPDATE products
SET
  is_flash_sale = FALSE,
  flash_sale_discount_percent = NULL,
  flash_sale_price = NULL,
  flash_sale_started_at = NULL
WHERE
  is_flash_sale = TRUE
  AND (
    flash_sale_discount_percent IS NULL
    OR flash_sale_discount_percent <= 0
    OR flash_sale_discount_percent >= 100
    OR flash_sale_price IS NULL
  );

-- Migration : images par défaut pour produits sans images (placeholder générique)
UPDATE products
SET images = ARRAY['https://placehold.co/600x400?text=Produit']
WHERE images = '{}' OR array_length(images, 1) IS NULL;
