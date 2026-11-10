// T072: NF03 "Simultaneous access" (US12). Three users work at the same time against the same database:
// no request may fail and every user must see exactly his own, correctly summed data.
import http from "node:http";
import test, { after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import app from "../src/app.js";
import { pool, resetTables } from "../src/db.js";

// One shared server: supertest(app) would start a new server for each of the ~35 parallel requests.
const server = http.createServer(app).listen(0);
const request = supertest(server);

after(() => {
  server.close();
});

const USERS = 3;
const ENTRIES_PER_USER = 10;
const AMOUNT_G = 50;
const KCAL_PER_100_G = 100; // 50 g of the test product = 50 kcal per entry

beforeEach(async () => {
  await resetTables();
});

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

test("three users registering at the same time all succeed with distinct accounts and tokens", async () => {
  const responses = await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      request.post("/auth/register").send({ email: `parallel${i}@commit2fit.test`, password: "Password123!" })
    )
  );

  assert.deepEqual(responses.map((r) => r.status), [201, 201, 201]);
  assert.equal(new Set(responses.map((r) => r.body.user.id)).size, USERS);
  assert.equal(new Set(responses.map((r) => r.body.token)).size, USERS);
});

test("parallel registration with the same email returns exactly one 201 and one 409", async () => {
  const payload = { email: "same@commit2fit.test", password: "Password123!" };
  const responses = await Promise.all([
    request.post("/auth/register").send(payload),
    request.post("/auth/register").send(payload),
  ]);

  assert.deepEqual(responses.map((r) => r.status).sort(), [201, 409]);
  const stored = await pool.query("SELECT COUNT(*)::int AS total FROM users WHERE lower(email) = $1", [payload.email]);
  assert.equal(stored.rows[0].total, 1);
});

test("users logging entries in parallel get no errors and each sees only his own correct totals", async () => {
  const registrations = await Promise.all(
    Array.from({ length: USERS }, (_, i) =>
      request.post("/auth/register").send({ email: `user${i}@commit2fit.test`, password: "Password123!" })
    )
  );
  const tokens = registrations.map((r) => r.body.token);

  const product = await request
    .post("/products")
    .set(auth(tokens[0]))
    .send({ barcode: "12345678", name: "Test Product", kcal: KCAL_PER_100_G, protein: 10, carbs: 20, fat: 5 });
  assert.equal(product.status, 201);

  // Every user logs ENTRIES_PER_USER entries and reads his diary in between - all requests are in flight at once.
  const day = "2026-11-10";
  const requests = tokens.flatMap((token, userIndex) =>
    Array.from({ length: ENTRIES_PER_USER }, (_, i) =>
      request
        .post("/intake")
        .set(auth(token))
        .send({
          productId: product.body.id,
          amountG: AMOUNT_G + userIndex, // different amount per user to detect mixed-up data
          meal: ["breakfast", "lunch", "dinner", "snack"][i % 4],
          consumedAt: `${day}T${String(8 + i).padStart(2, "0")}:00:00+01:00`,
        })
    ).concat([request.get("/diary").query({ date: day }).set(auth(token))])
  );
  const responses = await Promise.all(requests);

  const failed = responses.filter((r) => r.status >= 400);
  assert.equal(failed.length, 0, `failed requests: ${JSON.stringify(failed.map((r) => [r.status, r.body]))}`);

  for (const [userIndex, token] of tokens.entries()) {
    const diary = await request.get("/diary").query({ date: day }).set(auth(token));
    assert.equal(diary.status, 200);
    assert.equal(diary.body.totals.entries, ENTRIES_PER_USER);
    assert.equal(diary.body.totals.kcal, ENTRIES_PER_USER * (AMOUNT_G + userIndex));
    const mealCount = Object.values(diary.body.meals).reduce((sum, entries) => sum + entries.length, 0);
    assert.equal(mealCount, ENTRIES_PER_USER);
  }

  const total = await pool.query("SELECT COUNT(*)::int AS total FROM intake_logs");
  assert.equal(total.rows[0].total, USERS * ENTRIES_PER_USER);
});
