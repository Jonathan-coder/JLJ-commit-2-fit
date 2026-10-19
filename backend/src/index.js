import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { pool, initDb } from "./db.js";

const app = express();
app.use(cors());
app.use(express.json());

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Middleware: prüft die User-ID bei geschützten Endpoints
async function requireUser(req, res, next) {
  const code = req.header("X-User-Code");
  if (!code || !UUID_REGEX.test(code)) {
    return res.status(401).json({ error: "Missing or invalid X-User-Code" });
  }

  const result = await pool.query(
    "SELECT id FROM users WHERE user_code = $1",
    [code]
  );
  if (result.rows.length === 0) {
    return res.status(401).json({ error: "Unknown user code" });
  }
  req.userId = result.rows[0].id;
  next();
}

// ---------- Health ----------
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// ---------- Users ----------
// Neuen Nutzer anlegen, liefert die persönliche ID zurück
app.post("/users", async (req, res) => {
  const code = randomUUID();
  await pool.query("INSERT INTO users (user_code) VALUES ($1)", [code]);
  res.status(201).json({ userCode: code });
});

// Test-Endpoint: zeigt, dass die ID funktioniert
app.get("/users/me", requireUser, async (req, res) => {
  const result = await pool.query(
    "SELECT height_cm, weight_kg, age, sex, activity_level FROM users WHERE id = $1",
    [req.userId]
  );
  res.json(result.rows[0]);
});

// ---------- Products ----------
app.post("/products", async (req, res) => {
  const { barcode, name, kcal, protein, carbs, fat } = req.body;

  if (!barcode || !name) {
    return res.status(400).json({ error: "barcode and name are required" });
  }

  const result = await pool.query(
    `INSERT INTO products (barcode, name, kcal, protein, carbs, fat)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (barcode) DO NOTHING
     RETURNING *`,
    [barcode, name, kcal, protein, carbs, fat]
  );

  if (result.rows.length === 0) {
    return res.status(409).json({ error: "Product with this barcode already exists" });
  }
  res.status(201).json(result.rows[0]);
});

app.get("/products/:barcode", async (req, res) => {
  const result = await pool.query(
    "SELECT * FROM products WHERE barcode = $1",
    [req.params.barcode]
  );

  if (result.rows.length === 0) {
    return res.status(404).json({ error: "Product not found" });
  }
  res.json(result.rows[0]);
});


await initDb();
app.listen(3000, () => console.log("API running on http://localhost:3000"));