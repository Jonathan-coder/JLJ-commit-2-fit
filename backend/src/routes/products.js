import express from "express";
import { pool } from "../db.js";
import { requireAuth, asyncHandler } from "../middleware/auth.js";

const router = express.Router();

function isValidNutritionValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidBarcode(value) {
  return typeof value === "string" && /^\d{8,14}$/.test(value.trim());
}

function mapProductRow(row) {
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

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const values = [];
    let whereClause = "";

    if (search) {
      const escaped = search.replace(/[\\%_]/g, "\\$&");
      values.push(`%${escaped}%`);
      whereClause = "WHERE (name ILIKE $1 ESCAPE '\\' OR brand ILIKE $1 ESCAPE '\\')";
    }

    const countQuery = `SELECT COUNT(*)::int AS total FROM products ${whereClause}`;
    const countResult = await pool.query(countQuery, values);

    const params = [...values, limit, offset];
    const paramIndexStart = values.length + 1;

    let selectQuery = "SELECT * FROM products";
    if (whereClause) {
      selectQuery += ` ${whereClause}`;
    }
    selectQuery += ` ORDER BY name ASC LIMIT $${paramIndexStart} OFFSET $${paramIndexStart + 1}`;

    const result = await pool.query(selectQuery, params);

    return res.json({
      items: result.rows.map(mapProductRow),
      total: Number(countResult.rows[0].total),
      limit,
      offset,
    });
  })
);

router.get(
  "/:barcode",
  requireAuth,
  asyncHandler(async (req, res) => {
    const barcode = String(req.params.barcode || "").trim();

    if (!isValidBarcode(barcode)) {
      return res.status(400).json({ error: "Barcode must contain only digits and be 8-14 characters long" });
    }

    const result = await pool.query("SELECT * FROM products WHERE barcode = $1", [barcode]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(mapProductRow(result.rows[0]));
  })
);

router.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { barcode, name, brand, kcal, protein, carbs, fat } = req.body || {};
    const normalizedBarcode = typeof barcode === "string" ? barcode.trim() : "";

    if (!isValidBarcode(normalizedBarcode)) {
      return res.status(400).json({ error: "Barcode must contain only digits and be 8-14 characters long" });
    }

    const productName = typeof name === "string" ? name.trim() : "";
    if (!productName) {
      return res.status(400).json({ error: "Product name is required" });
    }

    const nutrition = { kcal, protein, carbs, fat };
    for (const [field, value] of Object.entries(nutrition)) {
      if (!isValidNutritionValue(value)) {
        return res.status(400).json({ error: `${field} must be a non-negative number` });
      }
    }

    try {
      const result = await pool.query(
        `INSERT INTO products (barcode, name, brand, kcal, protein, carbs, fat, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
        [normalizedBarcode, productName, typeof brand === "string" && brand.trim() ? brand.trim() : null, kcal, protein, carbs, fat, req.user.id]
      );

      return res.status(201).json(mapProductRow(result.rows[0]));
    } catch (error) {
      if (error && error.code === "23505") {
        return res.status(409).json({ error: "Product with this barcode already exists" });
      }
      throw error;
    }
  })
);

export default router;
