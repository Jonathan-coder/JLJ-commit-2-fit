-- T051: products can come from manual entry or from Open Food Facts.
-- external_id stores the ID of the product in the external database (OFF uses the barcode).
-- Up Migration
ALTER TABLE products
  ADD COLUMN source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN external_id TEXT;

ALTER TABLE products
  ADD CONSTRAINT products_source_check CHECK (source IN ('manual', 'openfoodfacts'));

CREATE UNIQUE INDEX IF NOT EXISTS products_source_external_id_unique_idx
  ON products (source, external_id)
  WHERE external_id IS NOT NULL;

-- Down Migration
DROP INDEX IF EXISTS products_source_external_id_unique_idx;
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_source_check;
ALTER TABLE products DROP COLUMN IF EXISTS external_id;
ALTER TABLE products DROP COLUMN IF EXISTS source;
