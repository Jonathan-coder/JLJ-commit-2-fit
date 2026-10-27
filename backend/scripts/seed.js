import bcrypt from "bcrypt";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:pw@localhost:5432/commit2fit";
const pool = new pg.Pool({ connectionString });

const products = [
  { barcode: "12345678", name: "Greek Yogurt", brand: "Farm Fresh", kcal: 59, protein: 10, carbs: 3.2, fat: 1.5 },
  { barcode: "23456789", name: "Oat Milk", brand: "Plant Pantry", kcal: 42, protein: 1, carbs: 7, fat: 1 },
  { barcode: "34567890", name: "Brown Rice", brand: "Nature Harvest", kcal: 360, protein: 7.5, carbs: 76, fat: 2.7 },
  { barcode: "45678901", name: "Chicken Breast", brand: "Prime Cuts", kcal: 165, protein: 31, carbs: 0, fat: 3.6 },
  { barcode: "56789012", name: "Banana", brand: "Fruit Co.", kcal: 89, protein: 1.1, carbs: 23, fat: 0.3 },
  { barcode: "67890123", name: "Almonds", brand: "Nuts & More", kcal: 579, protein: 21, carbs: 22, fat: 49 },
  { barcode: "78901234", name: "Whole Wheat Bread", brand: "Bakehouse", kcal: 265, protein: 12, carbs: 41, fat: 4 },
  { barcode: "89012345", name: "Avocado", brand: "Green Valley", kcal: 160, protein: 2, carbs: 8.5, fat: 15 },
  { barcode: "90123456", name: "Eggs", brand: "Farm Best", kcal: 155, protein: 13, carbs: 1.1, fat: 11 },
  { barcode: "01234567", name: "Salmon Fillet", brand: "Ocean Fresh", kcal: 208, protein: 20, carbs: 0, fat: 13 },
];

async function main() {
  const demoPasswordHash = await bcrypt.hash("Demo1234!", 12);

  await pool.query(
    `INSERT INTO users (email, password_hash)
     SELECT $1, $2
     WHERE NOT EXISTS (
       SELECT 1 FROM users WHERE lower(email) = lower($1)
     )`,
    ["demo@commit2fit.test", demoPasswordHash]
  );

  const userResult = await pool.query(
    "SELECT id FROM users WHERE lower(email) = lower($1)",
    ["demo@commit2fit.test"]
  );

  const userId = userResult.rows[0]?.id ?? null;

  for (const product of products) {
    await pool.query(
      `INSERT INTO products (barcode, name, brand, kcal, protein, carbs, fat, created_by)
       SELECT $1, $2, $3, $4, $5, $6, $7, $8
       WHERE NOT EXISTS (
         SELECT 1 FROM products WHERE barcode = $1
       )`,
      [
        product.barcode,
        product.name,
        product.brand,
        product.kcal,
        product.protein,
        product.carbs,
        product.fat,
        userId,
      ]
    );
  }

  console.log("Seed data applied successfully.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => {
    pool.end();
  });
