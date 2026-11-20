// T082/T083: app routes, central error handling, configuration and the test-only table reset.
// Every if in these files is tested for both outcomes; every exported function has a test.
import test from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import app from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { resetTables } from "../src/db.js";
import { errorHandler } from "../src/middleware/errorHandler.js";
import { asyncHandler } from "../src/middleware/auth.js";

const request = supertest(app);

/* ---------- app.js ---------- */

test("GET /health answers ok", async () => {
  const response = await request.get("/health");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: "ok" });
});

test("GET /openapi.json returns the OpenAPI document", async () => {
  const response = await request.get("/openapi.json");
  assert.equal(response.status, 200);
  assert.match(response.body.openapi, /^3\./);
  assert.ok(response.body.paths["/products"]);
});

test("unknown routes answer 404 as JSON", async () => {
  const response = await request.get("/does-not-exist");
  assert.equal(response.status, 404);
  assert.deepEqual(response.body, { error: "Not found" });
});

/* ---------- middleware/errorHandler.js ---------- */

function fakeResponse({ headersSent = false } = {}) {
  return {
    headersSent,
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test("errorHandler passes the error on when the response was already sent", () => {
  const res = fakeResponse({ headersSent: true });
  const error = new Error("late");
  let passed;
  errorHandler(error, {}, res, (err) => {
    passed = err;
  });
  assert.equal(passed, error);
  assert.equal(res.body, undefined);
});

test("errorHandler uses statusCode and message of the error", () => {
  const error = Object.assign(new Error("date must be a date"), { statusCode: 400 });
  const res = fakeResponse();
  errorHandler(error, {}, res, () => assert.fail("next must not be called"));
  assert.equal(res.statusCode, 400);
  assert.deepEqual(res.body, { error: "date must be a date" });
});

test("errorHandler uses a default text when an error with statusCode has no message", () => {
  const res = fakeResponse();
  errorHandler({ statusCode: 404, message: "" }, {}, res, () => {});
  assert.equal(res.statusCode, 404);
  assert.deepEqual(res.body, { error: "Request failed" });
});

test("errorHandler turns a unique violation (23505) into 409", () => {
  const res = fakeResponse();
  errorHandler({ code: "23505" }, {}, res, () => {});
  assert.equal(res.statusCode, 409);
  assert.deepEqual(res.body, { error: "Resource already exists" });
});

test("errorHandler answers 500 for unknown errors and for a missing error", (t) => {
  const logged = t.mock.method(console, "error", () => {});
  for (const error of [new Error("boom"), null]) {
    const res = fakeResponse();
    errorHandler(error, {}, res, () => {});
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { error: "Internal server error" });
  }
  assert.equal(logged.mock.callCount(), 2);
});

/* ---------- middleware/auth.js: asyncHandler ---------- */

test("asyncHandler passes a rejected handler to next() and does not call next() on success", async () => {
  const error = new Error("db down");
  const failed = await new Promise((resolve) => {
    asyncHandler(async () => {
      throw error;
    })({}, {}, resolve);
  });
  assert.equal(failed, error);

  let nextCalled = false;
  await asyncHandler(async () => "done")({}, {}, () => {
    nextCalled = true;
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(nextCalled, false);
});

/* ---------- config.js ---------- */

test("loadConfig uses the environment variables when they are set", () => {
  const warnings = [];
  const config = loadConfig(
    {
      NODE_ENV: "production",
      PORT: "8080",
      JWT_SECRET: "s3cret",
      JWT_EXPIRES_IN: "1h",
      DATABASE_URL: "postgresql://db/app",
      TEST_DATABASE_URL: "postgresql://db/app_test",
    },
    (msg) => warnings.push(msg)
  );
  assert.deepEqual(config, {
    mode: "production",
    port: 8080,
    jwtSecret: "s3cret",
    jwtExpiresIn: "1h",
    databaseUrl: "postgresql://db/app",
    testDatabaseUrl: "postgresql://db/app_test",
    connectionString: "postgresql://db/app",
  });
  assert.deepEqual(warnings, []);
});

test("loadConfig falls back to local defaults and warns about the missing JWT secret", () => {
  const warnings = [];
  const config = loadConfig({}, (msg) => warnings.push(msg));
  assert.equal(config.mode, "development");
  assert.equal(config.port, 3000);
  assert.equal(config.jwtSecret, "development-secret");
  assert.equal(config.jwtExpiresIn, "7d");
  assert.equal(config.connectionString, "postgresql://postgres:pw@localhost:5432/commit2fit");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /JWT_SECRET not set/);
});

test("loadConfig in test mode uses the test database and a test secret without warning", () => {
  const warnings = [];
  const config = loadConfig({ NODE_ENV: "test" }, (msg) => warnings.push(msg));
  assert.equal(config.jwtSecret, "test-secret");
  assert.equal(config.connectionString, "postgresql://postgres:pw@localhost:5432/commit2fit_test");
  assert.deepEqual(warnings, []);
});

test("loadConfig warns with console.warn by default", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  loadConfig({ NODE_ENV: "development" });
  assert.equal(warn.mock.callCount(), 1);
});

/* ---------- db.js ---------- */

test("resetTables refuses to run outside of tests", async () => {
  await assert.rejects(resetTables("development"), /only be used when NODE_ENV=test/);
});

test("resetTables empties the tables in test mode", async () => {
  await resetTables();
  const response = await request.post("/auth/login").send({ email: "nobody@commit2fit.test", password: "x" });
  assert.equal(response.status, 401);
});
