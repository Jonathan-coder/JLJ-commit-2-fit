-- Up Migration
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT users_email_not_blank CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique_idx
  ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  barcode TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  brand TEXT,
  kcal NUMERIC(8,2) NOT NULL CHECK (kcal >= 0),
  protein NUMERIC(8,2) NOT NULL CHECK (protein >= 0),
  carbs NUMERIC(8,2) NOT NULL CHECK (carbs >= 0),
  fat NUMERIC(8,2) NOT NULL CHECK (fat >= 0),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT products_barcode_format CHECK (barcode ~ '^\d{8,14}$'),
  CONSTRAINT products_name_not_blank CHECK (length(trim(name)) > 0)
);

CREATE INDEX IF NOT EXISTS products_name_lower_idx
  ON products (LOWER(name));

CREATE INDEX IF NOT EXISTS products_name_trgm_idx
  ON products USING GIN (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS intake_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  amount_g NUMERIC NOT NULL CHECK (amount_g > 0),
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS intake_logs_user_consumed_at_idx
  ON intake_logs (user_id, consumed_at DESC);
-- Down Migration
DROP TABLE IF EXISTS intake_logs;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS users;
DROP EXTENSION IF EXISTS pg_trgm;
