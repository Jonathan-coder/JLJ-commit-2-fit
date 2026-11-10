# Mapping Open Food Facts → `products` (T062)

Specification for the food-database client (T055, US16). If a scanned barcode is not in our database,
the backend looks it up in Open Food Facts (OFF), maps the values and stores the product.

> Field names are based on the OFF API v2 documentation. Verify them against a live response when implementing T055.

## Request
`GET https://world.openfoodfacts.org/api/v2/product/{barcode}.json?fields=code,product_name,brands,nutriments`

- Send a custom `User-Agent` (e.g. `Commit2Fit/1.0 (FH Technikum Wien student project)`), as requested by OFF.
- `status = 1` → product found; `status = 0` → not found → frontend offers manual entry (F09).

## Mapping (all nutrition values per 100 g)

| `products` column | OFF field | Rule |
|---|---|---|
| `barcode` | `code` | digits only, 8–14 characters (same check as POST /products) |
| `name` | `product_name` | trim; if empty → not importable, manual entry |
| `brand` | `brands` | first brand before the first comma; may be empty |
| `kcal` | `nutriments["energy-kcal_100g"]` | if missing: `nutriments["energy-kj_100g"]` / 4.184, rounded to 1 decimal |
| `protein` | `nutriments.proteins_100g` | required |
| `carbs` | `nutriments.carbohydrates_100g` | required |
| `fat` | `nutriments.fat_100g` | required |
| `source` | – | always `openfoodfacts` |
| `external_id` | `code` | OFF identifies products by barcode |
| `created_by` | – | user who scanned the product |

## Missing or invalid values
- If kcal (also not via kJ) or one of protein/carbs/fat is missing or negative, the product is **not saved automatically**. The frontend shows the values it found and the user completes them (manual entry, `source = manual`).
- Values are rounded to 2 decimals (column type `NUMERIC(8,2)`).
- Duplicates are impossible: `barcode` is UNIQUE and `(source, external_id)` is unique.
