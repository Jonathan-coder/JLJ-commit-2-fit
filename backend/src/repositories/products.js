// T079: database access for products. Routes call these functions and contain no SQL.
import { pool } from "../db.js";

function mapProduct(row) {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    brand: row.brand,
    kcal: Number(row.kcal),
    protein: Number(row.protein),
    carbs: Number(row.carbs),
    fat: Number(row.fat),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

/**
 * Products ordered by name. With a search text only products whose name or brand contains it
 * (case-insensitive; % and _ are matched literally). Returns one page plus the total number of matches.
 */
export async function searchProducts({ search = "", limit, offset }) {
  const values = [];
  let where = "";

  if (search) {
    values.push(`%${search.replace(/[\\%_]/g, "\\$&")}%`);
    where = "WHERE (name ILIKE $1 ESCAPE '\\' OR brand ILIKE $1 ESCAPE '\\')";
  }

  const count = await pool.query(`SELECT COUNT(*)::int AS total FROM products ${where}`, values);
  const next = values.length + 1;
  const page = await pool.query(
    `SELECT * FROM products ${where} ORDER BY name ASC LIMIT $${next} OFFSET $${next + 1}`,
    [...values, limit, offset]
  );

  return { items: page.rows.map(mapProduct), total: Number(count.rows[0].total) };
}

/** Product with this barcode, or null. */
export async function findProductByBarcode(barcode) {
  const result = await pool.query("SELECT * FROM products WHERE barcode = $1", [barcode]);
  return result.rows.length === 0 ? null : mapProduct(result.rows[0]);
}

/** True if a product with this id exists. */
export async function productExists(id) {
  const result = await pool.query("SELECT 1 FROM products WHERE id = $1", [id]);
  return result.rows.length > 0;
}

/** Save a new product. A duplicate barcode is rejected with an error with statusCode 409. */
export async function createProduct({ barcode, name, brand, kcal, protein, carbs, fat, createdBy }) {
  try {
    const result = await pool.query(
      `INSERT INTO products (barcode, name, brand, kcal, protein, carbs, fat, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [barcode, name, brand, kcal, protein, carbs, fat, createdBy]
    );
    return mapProduct(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      const conflict = new Error("Product with this barcode already exists");
      conflict.statusCode = 409;
      throw conflict;
    }
    throw error;
  }
}
