// T071: API tests for the intake and diary endpoints (US08, US17, US09).
// Covers authentication, validation (400/404 instead of 500), owner isolation and the Vienna day rule.
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import app from "../src/app.js";
import { resetTables } from "../src/db.js";
import { todayInVienna } from "../src/utils/date.js";

const request = supertest(app);

beforeEach(async () => {
  await resetTables();
});

async function registerUser(email) {
  const response = await request.post("/auth/register").send({ email, password: "Password123!" });
  assert.equal(response.status, 201);
  return response.body.token;
}

async function createProduct(token, overrides = {}) {
  const response = await request
    .post("/products")
    .set("Authorization", `Bearer ${token}`)
    .send({
      barcode: "12345678",
      name: "Greek Yogurt",
      brand: "Farm Fresh",
      kcal: 59,
      protein: 10,
      carbs: 3.2,
      fat: 1.5,
      ...overrides,
    });
  assert.equal(response.status, 201);
  return response.body.id;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

function logEntry(token, body) {
  return request.post("/intake").set(auth(token)).send(body);
}

test("all intake and diary endpoints require authentication", async () => {
  const responses = await Promise.all([
    request.post("/intake").send({ productId: 1, amountG: 100 }),
    request.get("/intake"),
    request.delete("/intake/1"),
    request.get("/diary"),
    request.get("/diary/totals").query({ from: "2026-11-01", to: "2026-11-10" }),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 401);
  }
});

test("POST /intake stores the entry and calculates nutrients from the per-100-g values", async () => {
  const token = await registerUser("intake@commit2fit.test");
  const productId = await createProduct(token);

  const response = await logEntry(token, {
    productId,
    amountG: 150,
    meal: "breakfast",
    consumedAt: "2026-11-10T07:30:00+01:00",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.productId, productId);
  assert.equal(response.body.productName, "Greek Yogurt");
  assert.equal(response.body.meal, "breakfast");
  assert.equal(response.body.day, "2026-11-10");
  assert.equal(response.body.amountG, 150);
  assert.equal(response.body.kcal, 88.5);
  assert.equal(response.body.protein, 15);
  assert.equal(response.body.carbs, 4.8);
  assert.equal(response.body.fat, 2.3);
});

test("POST /intake defaults to meal snack and to the current time", async () => {
  const token = await registerUser("default@commit2fit.test");
  const productId = await createProduct(token);

  const response = await logEntry(token, { productId, amountG: 100 });

  assert.equal(response.status, 201);
  assert.equal(response.body.meal, "snack");
  assert.equal(response.body.day, todayInVienna());
});

test("POST /intake returns 400 for invalid input and 404 for an unknown product", async () => {
  const token = await registerUser("invalid@commit2fit.test");
  const productId = await createProduct(token);

  const badRequests = [
    {},
    { amountG: 100 },
    { productId },
    { productId, amountG: 0 },
    { productId, amountG: -5 },
    { productId, amountG: "100" },
    { productId, amountG: null },
    { productId, amountG: 100, meal: "brunch" },
    { productId, amountG: 100, meal: null },
    { productId, amountG: 100, consumedAt: "yesterday" },
    { productId, amountG: 100, consumedAt: 5 },
    { productId, amountG: 100, consumedAt: "2026-02-30T10:00:00Z" },
    { productId: "1", amountG: 100 },
    { productId: 1.5, amountG: 100 },
    { productId: 0, amountG: 100 },
    { productId: 2 ** 31, amountG: 100 },
  ];
  for (const body of badRequests) {
    const response = await logEntry(token, body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(typeof response.body.error, "string", JSON.stringify(body));
  }

  const unknown = await logEntry(token, { productId: 999999, amountG: 100 });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error, "Product not found");

  const malformed = await request
    .post("/intake")
    .set(auth(token))
    .set("Content-Type", "application/json")
    .send("{ not json");
  assert.equal(malformed.status, 400);
});

test("GET /diary groups the entries of a day by meal and returns the day totals", async () => {
  const token = await registerUser("diary@commit2fit.test");
  const yogurt = await createProduct(token);
  const oats = await createProduct(token, { barcode: "23456789", name: "Oats", kcal: 372, protein: 13.5, carbs: 59, fat: 7 });

  await logEntry(token, { productId: oats, amountG: 60, meal: "breakfast", consumedAt: "2026-11-10T07:00:00+01:00" });
  await logEntry(token, { productId: yogurt, amountG: 150, meal: "snack", consumedAt: "2026-11-10T16:00:00+01:00" });
  await logEntry(token, { productId: yogurt, amountG: 100, meal: "snack", consumedAt: "2026-11-11T16:00:00+01:00" });

  const response = await request.get("/diary").query({ date: "2026-11-10" }).set(auth(token));

  assert.equal(response.status, 200);
  assert.equal(response.body.day, "2026-11-10");
  assert.equal(response.body.totals.entries, 2);
  assert.equal(response.body.totals.kcal, 311.7); // 60 g oats = 223.2 + 150 g yogurt = 88.5
  assert.equal(response.body.meals.breakfast.length, 1);
  assert.equal(response.body.meals.lunch.length, 0);
  assert.equal(response.body.meals.dinner.length, 0);
  assert.equal(response.body.meals.snack.length, 1);
  assert.equal(response.body.meals.breakfast[0].productName, "Oats");
});

test("GET /diary returns zeros for a day without entries and defaults to today", async () => {
  const token = await registerUser("empty@commit2fit.test");

  const empty = await request.get("/diary").query({ date: "2026-01-01" }).set(auth(token));
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.totals, { day: "2026-01-01", entries: 0, kcal: 0, protein: 0, carbs: 0, fat: 0 });

  const today = await request.get("/diary").set(auth(token));
  assert.equal(today.status, 200);
  assert.equal(today.body.day, todayInVienna());
});

test("GET /diary and GET /intake return 400 for invalid dates", async () => {
  const token = await registerUser("dates@commit2fit.test");
  const invalidDates = ["abc", "10.11.2026", "2026-13-01", "2026-02-30", "2026-11-31", "2026-1-5", ""];

  for (const date of invalidDates) {
    for (const path of ["/diary", "/intake"]) {
      const response = await request.get(path).query({ date }).set(auth(token));
      assert.equal(response.status, 400, `${path}?date=${date}`);
      assert.match(response.body.error, /YYYY-MM-DD/);
    }
  }

  const repeated = await request.get("/diary?date=2026-11-10&date=2026-11-11").set(auth(token));
  assert.equal(repeated.status, 400);
});

test("days follow the Europe/Vienna time zone through the API", async () => {
  const token = await registerUser("zone@commit2fit.test");
  const yogurt = await createProduct(token);

  // 22:30 UTC on 9 Nov = 23:30 in Vienna (still 9 Nov); 23:30 UTC = 00:30 on 10 Nov in Vienna
  await logEntry(token, { productId: yogurt, amountG: 100, consumedAt: "2026-11-09T22:30:00Z" });
  await logEntry(token, { productId: yogurt, amountG: 200, consumedAt: "2026-11-09T23:30:00Z" });

  const ninth = await request.get("/diary").query({ date: "2026-11-09" }).set(auth(token));
  const tenth = await request.get("/diary").query({ date: "2026-11-10" }).set(auth(token));
  assert.equal(ninth.body.totals.entries, 1);
  assert.equal(ninth.body.totals.kcal, 59);
  assert.equal(tenth.body.totals.entries, 1);
  assert.equal(tenth.body.totals.kcal, 118);
});

test("GET /intake lists the entries of a day ordered by time", async () => {
  const token = await registerUser("list@commit2fit.test");
  const yogurt = await createProduct(token);

  await logEntry(token, { productId: yogurt, amountG: 100, meal: "dinner", consumedAt: "2026-11-10T19:00:00+01:00" });
  await logEntry(token, { productId: yogurt, amountG: 100, meal: "breakfast", consumedAt: "2026-11-10T07:00:00+01:00" });

  const response = await request.get("/intake").query({ date: "2026-11-10" }).set(auth(token));

  assert.equal(response.status, 200);
  assert.equal(response.body.date, "2026-11-10");
  assert.deepEqual(response.body.items.map((entry) => entry.meal), ["breakfast", "dinner"]);
});

test("users only see and delete their own entries", async () => {
  const tokenA = await registerUser("a@commit2fit.test");
  const tokenB = await registerUser("b@commit2fit.test");
  const yogurt = await createProduct(tokenA);

  const created = await logEntry(tokenA, { productId: yogurt, amountG: 100, consumedAt: "2026-11-10T12:00:00+01:00" });
  const entryId = created.body.id;

  const diaryB = await request.get("/diary").query({ date: "2026-11-10" }).set(auth(tokenB));
  const listB = await request.get("/intake").query({ date: "2026-11-10" }).set(auth(tokenB));
  const totalsB = await request
    .get("/diary/totals")
    .query({ from: "2026-11-01", to: "2026-11-30" })
    .set(auth(tokenB));
  assert.equal(diaryB.body.totals.entries, 0);
  assert.deepEqual(listB.body.items, []);
  assert.deepEqual(totalsB.body.days, []);

  const foreignDelete = await request.delete(`/intake/${entryId}`).set(auth(tokenB));
  assert.equal(foreignDelete.status, 404);

  const stillThere = await request.get("/intake").query({ date: "2026-11-10" }).set(auth(tokenA));
  assert.equal(stillThere.body.items.length, 1);
});

test("DELETE /intake/:id removes the entry (204), a second delete returns 404 and invalid ids return 400", async () => {
  const token = await registerUser("delete@commit2fit.test");
  const yogurt = await createProduct(token);
  const created = await logEntry(token, { productId: yogurt, amountG: 100, consumedAt: "2026-11-10T12:00:00+01:00" });

  const deleted = await request.delete(`/intake/${created.body.id}`).set(auth(token));
  assert.equal(deleted.status, 204);

  const again = await request.delete(`/intake/${created.body.id}`).set(auth(token));
  assert.equal(again.status, 404);

  const diary = await request.get("/diary").query({ date: "2026-11-10" }).set(auth(token));
  assert.equal(diary.body.totals.entries, 0);

  for (const id of ["abc", "0", "-1", "1.5", "1e3", "99999999999"]) {
    const response = await request.delete(`/intake/${id}`).set(auth(token));
    assert.equal(response.status, 400, `DELETE /intake/${id}`);
  }
});

test("GET /diary/totals returns one row per day with entries for a period", async () => {
  const token = await registerUser("totals@commit2fit.test");
  const yogurt = await createProduct(token);

  await logEntry(token, { productId: yogurt, amountG: 100, consumedAt: "2026-11-08T12:00:00+01:00" });
  await logEntry(token, { productId: yogurt, amountG: 200, consumedAt: "2026-11-10T12:00:00+01:00" });
  await logEntry(token, { productId: yogurt, amountG: 100, consumedAt: "2026-11-12T12:00:00+01:00" });

  const response = await request
    .get("/diary/totals")
    .query({ from: "2026-11-08", to: "2026-11-10" })
    .set(auth(token));

  assert.equal(response.status, 200);
  assert.equal(response.body.from, "2026-11-08");
  assert.equal(response.body.to, "2026-11-10");
  assert.deepEqual(response.body.days.map((row) => [row.day, row.kcal]), [["2026-11-08", 59], ["2026-11-10", 118]]);
});

test("GET /diary/totals returns 400 for missing, invalid or reversed periods", async () => {
  const token = await registerUser("range@commit2fit.test");
  const queries = [
    {},
    { from: "2026-11-01" },
    { to: "2026-11-10" },
    { from: "2026-11-10", to: "2026-11-01" },
    { from: "01.11.2026", to: "2026-11-10" },
    { from: "2026-02-30", to: "2026-11-10" },
  ];
  for (const query of queries) {
    const response = await request.get("/diary/totals").query(query).set(auth(token));
    assert.equal(response.status, 400, JSON.stringify(query));
  }
});
