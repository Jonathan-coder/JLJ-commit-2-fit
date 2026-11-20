import express from "express";
import { requireAuth, asyncHandler } from "../middleware/auth.js";
import { searchProducts, findProductByBarcode, createProduct } from "../repositories/products.js";

const router = express.Router();

function isValidNutritionValue(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isValidBarcode(value) {
  return typeof value === "string" && /^\d{8,14}$/.test(value.trim());
}

router.get(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const { items, total } = await searchProducts({ search, limit, offset });
    return res.json({ items, total, limit, offset });
  })
);

router.get(
  "/:barcode",
  requireAuth,
  asyncHandler(async (req, res) => {
    const barcode = req.params.barcode.trim();

    if (!isValidBarcode(barcode)) {
      return res.status(400).json({ error: "Barcode must contain only digits and be 8-14 characters long" });
    }

    const product = await findProductByBarcode(barcode);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }

    return res.json(product);
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

    const product = await createProduct({
      barcode: normalizedBarcode,
      name: productName,
      brand: typeof brand === "string" && brand.trim() ? brand.trim() : null,
      kcal,
      protein,
      carbs,
      fat,
      createdBy: req.user.id,
    });
    return res.status(201).json(product);
  })
);

export default router;
