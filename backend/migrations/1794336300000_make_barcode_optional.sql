-- T078 (feedback 20.11.2026): products can be entered without the scanner, so a product may have no barcode
-- (e.g. loose fruit, home-made food). UNIQUE still prevents duplicate barcodes; PostgreSQL allows several NULLs.
-- The format check (8-14 digits) is kept and only applies when a barcode is set.
-- Up Migration
ALTER TABLE products ALTER COLUMN barcode DROP NOT NULL;

-- Down Migration
-- Fails on purpose while products without barcode exist: they would have to be removed or get a barcode first.
ALTER TABLE products ALTER COLUMN barcode SET NOT NULL;
