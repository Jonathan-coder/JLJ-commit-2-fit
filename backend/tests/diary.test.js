// T052: database tests for the food diary (intake_logs, views, diary repository)
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool, resetTables } from "../src/db.js";
import {
  addEntry,
  getEntriesForDay,
  getDailyTotals,
  getTotalsForRange,
  getDiary,
  deleteEntry,
} from "../src/repositories/diary.js";

let userA;
let userB;
let yogurt;
let oats;

async function createUser(email) {
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'not-a-real-hash') RETURNING id",
    [email]
  );
  return result.rows[0].id;
}

async function createProduct(barcode, name, kcal, protein, carbs, fat) {
  const result = await pool.query(
    `INSERT INTO products (barcode, name, kcal, protein, carbs, fat)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [barcode, name, kcal, protein, carbs, fat]
  );
  return result.rows[0].id;
}

beforeEach(async () => {
  await resetTables();
  userA = await createUser("a@commit2fit.test");
  userB = await createUser("b@commit2fit.test");
  yogurt = await createProduct("12345678", "Greek Yogurt", 59, 10, 3.2, 1.5);
  oats = await createProduct("23456789", "Oats", 372, 13.5, 59, 7);
});

test("meal defaults to snack and only allows breakfast, lunch, dinner, snack", async () => {
  const inserted = await pool.query(
    "INSERT INTO intake_logs (user_id, product_id, amount_g) VALUES ($1, $2, 100) RETURNING meal",
    [userA, yogurt]
  );
  assert.equal(inserted.rows[0].meal, "snack");

  await assert.rejects(
    pool.query(
      "INSERT INTO intake_logs (user_id, product_id, amount_g, meal) VALUES ($1, $2, 100, 'brunch')",
      [userA, yogurt]
    ),
    /intake_logs_meal_check/
  );
});

test("addEntry stores the entry and calculates nutrients from the per-100-g values", async () => {
  const entry = await addEntry(userA, {
    productId: yogurt,
    amountG: 150,
    meal: "breakfast",
    consumedAt: "2026-11-10T07:30:00+01:00",
  });

  assert.equal(entry.meal, "breakfast");
  assert.equal(entry.day, "2026-11-10");
  assert.equal(entry.productName, "Greek Yogurt");
  assert.equal(entry.kcal, 88.5);
  assert.equal(entry.protein, 15);
  assert.equal(entry.carbs, 4.8);
  assert.equal(entry.fat, 2.3);
});

test("addEntry rejects invalid input and unknown products", async () => {
  const cases = [
    [{ productId: yogurt, amountG: 0 }, 400],
    [{ productId: yogurt, amountG: -5 }, 400],
    [{ productId: yogurt, amountG: "100" }, 400],
    [{ productId: yogurt, amountG: 100, meal: "brunch" }, 400],
    [{ productId: yogurt, amountG: 100, consumedAt: "yesterday" }, 400],
    [{ productId: "1", amountG: 100 }, 400],
    [{ productId: 999999, amountG: 100 }, 404],
  ];
  for (const [input, status] of cases) {
    await assert.rejects(addEntry(userA, input), (error) => error.statusCode === status, JSON.stringify(input));
  }
});

test("days follow the Europe/Vienna time zone", async () => {
  // 22:30 UTC on 9 Nov = 23:30 in Vienna (still 9 Nov); 23:30 UTC = 00:30 on 10 Nov in Vienna
  await addEntry(userA, { productId: yogurt, amountG: 100, consumedAt: "2026-11-09T22:30:00Z" });
  await addEntry(userA, { productId: oats, amountG: 50, consumedAt: "2026-11-09T23:30:00Z" });

  const ninth = await getEntriesForDay(userA, "2026-11-09");
  const tenth = await getEntriesForDay(userA, "2026-11-10");
  assert.deepEqual(ninth.map((e) => e.productName), ["Greek Yogurt"]);
  assert.deepEqual(tenth.map((e) => e.productName), ["Oats"]);
});

test("getDailyTotals sums all entries of a day and returns zeros for an empty day", async () => {
  await addEntry(userA, { productId: yogurt, amountG: 200, meal: "breakfast", consumedAt: "2026-11-10T08:00:00+01:00" });
  await addEntry(userA, { productId: oats, amountG: 50, meal: "breakfast", consumedAt: "2026-11-10T08:05:00+01:00" });

  const totals = await getDailyTotals(userA, "2026-11-10");
  assert.deepEqual(totals, { day: "2026-11-10", entries: 2, kcal: 304, protein: 26.8, carbs: 35.9, fat: 6.5 });

  const empty = await getDailyTotals(userA, "2026-11-11");
  assert.deepEqual(empty, { day: "2026-11-11", entries: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 });
});

test("getTotalsForRange returns one row per day with entries, ordered by day", async () => {
  await addEntry(userA, { productId: yogurt, amountG: 100, consumedAt: "2026-11-08T12:00:00+01:00" });
  await addEntry(userA, { productId: yogurt, amountG: 100, consumedAt: "2026-11-10T12:00:00+01:00" });
  await addEntry(userA, { productId: yogurt, amountG: 100, consumedAt: "2026-11-12T12:00:00+01:00" });

  const rows = await getTotalsForRange(userA, "2026-11-08", "2026-11-10");
  assert.deepEqual(rows.map((r) => [r.day, r.kcal]), [["2026-11-08", 59], ["2026-11-10", 59]]);

  await assert.rejects(getTotalsForRange(userA, "2026-11-10", "2026-11-08"), (e) => e.statusCode === 400);
  await assert.rejects(getTotalsForRange(userA, "08.11.2026", "2026-11-10"), (e) => e.statusCode === 400);
});

test("getDiary groups the entries of a day by meal", async () => {
  await addEntry(userA, { productId: oats, amountG: 60, meal: "breakfast", consumedAt: "2026-11-10T07:00:00+01:00" });
  await addEntry(userA, { productId: yogurt, amountG: 150, meal: "snack", consumedAt: "2026-11-10T16:00:00+01:00" });

  const diary = await getDiary(userA, "2026-11-10");
  assert.equal(diary.meals.breakfast.length, 1);
  assert.equal(diary.meals.lunch.length, 0);
  assert.equal(diary.meals.dinner.length, 0);
  assert.equal(diary.meals.snack.length, 1);
  assert.equal(diary.totals.entries, 2);
});

test("users only see and delete their own entries", async () => {
  const entry = await addEntry(userA, { productId: yogurt, amountG: 100, consumedAt: "2026-11-10T12:00:00+01:00" });

  assert.deepEqual(await getEntriesForDay(userB, "2026-11-10"), []);
  assert.equal((await getDailyTotals(userB, "2026-11-10")).entries, 0);

  assert.equal(await deleteEntry(userB, entry.id), false);
  assert.equal((await getEntriesForDay(userA, "2026-11-10")).length, 1);

  assert.equal(await deleteEntry(userA, entry.id), true);
  assert.equal((await getEntriesForDay(userA, "2026-11-10")).length, 0);
});

test("products have a source (manual by default) and a unique external ID per source", async () => {
  const manual = await pool.query("SELECT source, external_id FROM products WHERE id = $1", [yogurt]);
  assert.deepEqual(manual.rows[0], { source: "manual", external_id: null });

  await pool.query(
    `INSERT INTO products (barcode, name, kcal, protein, carbs, fat, source, external_id)
     VALUES ('3017620422003', 'Nutella', 539, 6.3, 57.5, 30.9, 'openfoodfacts', '3017620422003')`
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO products (barcode, name, kcal, protein, carbs, fat, source, external_id)
       VALUES ('3017620422004', 'Copy', 1, 1, 1, 1, 'openfoodfacts', '3017620422003')`
    ),
    /products_source_external_id_unique_idx/
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO products (barcode, name, kcal, protein, carbs, fat, source)
       VALUES ('3017620422005', 'Wrong', 1, 1, 1, 1, 'somewhere')`
    ),
    /products_source_check/
  );
});
