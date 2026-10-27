import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import app from "../src/app.js";
import { pool, resetTables } from "../src/db.js";

const request = supertest(app);

beforeEach(async () => {
  await resetTables();
});

async function createUserAndToken() {
  const response = await request.post("/auth/register").send({
    email: "products@commit2fit.test",
    password: "Password123!",
  });
  assert.equal(response.status, 201);
  return response.body.token;
}

function productInput(overrides = {}) {
  return {
    barcode: "12345678",
    name: "Greek Yogurt",
    brand: "Farm Fresh",
    kcal: 59,
    protein: 10,
    carbs: 3.2,
    fat: 1.5,
    ...overrides,
  };
}

test("all product endpoints require authentication", async () => {
  const product = productInput();
  const [list, barcode, create] = await Promise.all([
    request.get("/products"),
    request.get("/products/12345678"),
    request.post("/products").send(product),
  ]);

  assert.equal(list.status, 401);
  assert.equal(barcode.status, 401);
  assert.equal(create.status, 401);
});

test("POST /products trims the barcode and sets createdBy", async () => {
  const token = await createUserAndToken();
  const response = await request
    .post("/products")
    .set("Authorization", `Bearer ${token}`)
    .send(productInput({ barcode: " 12345678 " }));

  assert.equal(response.status, 201);
  assert.equal(response.body.barcode, "12345678");
  assert.equal(response.body.createdBy, 1);

  const stored = await pool.query(
    "SELECT barcode, created_by FROM products WHERE barcode = $1",
    ["12345678"]
  );
  assert.equal(stored.rows.length, 1);
  assert.equal(stored.rows[0].barcode, "12345678");
  assert.equal(stored.rows[0].created_by, 1);
});

test("parallel product creates with one barcode return exactly one 201 and one 409", async () => {
  const token = await createUserAndToken();
  const payload = productInput();
  const responses = await Promise.all([
    request.post("/products").set("Authorization", `Bearer ${token}`).send(payload),
    request.post("/products").set("Authorization", `Bearer ${token}`).send(payload),
  ]);

  assert.deepEqual(
    responses.map((response) => response.status).sort(),
    [201, 409]
  );
  assert.equal(
    responses.find((response) => response.status === 409).body.error,
    "Product with this barcode already exists"
  );

  const stored = await pool.query(
    "SELECT COUNT(*)::int AS total FROM products WHERE barcode = $1",
    [payload.barcode]
  );
  assert.equal(stored.rows[0].total, 1);
});

test("POST /products returns 400 for invalid fields and nutrition values", async () => {
  const token = await createUserAndToken();
  const invalidInputs = [
    productInput({ name: "" }),
    productInput({ barcode: "not-a-barcode" }),
    productInput({ kcal: -1 }),
    productInput({ kcal: "59" }),
    productInput({ kcal: "" }),
    productInput({ kcal: null }),
    productInput({ protein: -1 }),
    productInput({ carbs: "three" }),
    productInput({ fat: null }),
  ];
  const missingFat = productInput();
  delete missingFat.fat;
  invalidInputs.push(missingFat);

  for (const input of invalidInputs) {
    const response = await request
      .post("/products")
      .set("Authorization", `Bearer ${token}`)
      .send(input);
    assert.equal(response.status, 400, JSON.stringify(input));
    assert.equal(typeof response.body.error, "string");
  }
});

test("GET /products searches case-insensitively, escapes wildcards and paginates", async () => {
  const token = await createUserAndToken();
  for (const product of [
    productInput({ barcode: "11111111", name: "Almond Milk", brand: "Plant Pantry" }),
    productInput({ barcode: "22222222", name: "Oat Milk", brand: "Plant Pantry" }),
  ]) {
    const created = await request
      .post("/products")
      .set("Authorization", `Bearer ${token}`)
      .send(product);
    assert.equal(created.status, 201);
  }

  const search = await request
    .get("/products")
    .query({ search: "mIlK", limit: 10, offset: 0 })
    .set("Authorization", `Bearer ${token}`);
  assert.equal(search.status, 200);
  assert.equal(search.body.total, 2);
  assert.equal(search.body.items.length, 2);

  const page = await request
    .get("/products")
    .query({ limit: 1, offset: 1 })
    .set("Authorization", `Bearer ${token}`);
  assert.equal(page.status, 200);
  assert.equal(page.body.total, 2);
  assert.equal(page.body.limit, 1);
  assert.equal(page.body.offset, 1);
  assert.equal(page.body.items.length, 1);
  assert.equal(page.body.items[0].name, "Oat Milk");

  const wildcard = await request
    .get("/products")
    .query({ search: "%" })
    .set("Authorization", `Bearer ${token}`);
  assert.equal(wildcard.status, 200);
  assert.deepEqual(wildcard.body.items, []);
  assert.equal(wildcard.body.total, 0);
});

test("GET /products/:barcode returns a product, 404 for missing and 400 for invalid barcode", async () => {
  const token = await createUserAndToken();
  await request
    .post("/products")
    .set("Authorization", `Bearer ${token}`)
    .send(productInput());

  const found = await request
    .get("/products/12345678")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(found.status, 200);
  assert.equal(found.body.name, "Greek Yogurt");

  const missing = await request
    .get("/products/99999999")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "Product not found");

  const invalid = await request
    .get("/products/not-a-barcode")
    .set("Authorization", `Bearer ${token}`);
  assert.equal(invalid.status, 400);
});
