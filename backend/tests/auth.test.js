import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import supertest from "supertest";
import app from "../src/app.js";
import { config } from "../src/config.js";
import { pool, resetTables } from "../src/db.js";

const request = supertest(app);

beforeEach(async () => {
  await resetTables();
});

test("register creates a hashed user and does not expose the hash", async () => {
  const response = await request.post("/auth/register").send({
    email: "demo@commit2fit.test",
    password: "Password123!",
  });

  assert.equal(response.status, 201);
  assert.ok(response.body.token);
  assert.deepEqual(response.body.user, {
    id: 1,
    email: "demo@commit2fit.test",
  });
  assert.equal(JSON.stringify(response.body).includes("password_hash"), false);

  const result = await pool.query(
    "SELECT email, password_hash FROM users WHERE email = $1",
    ["demo@commit2fit.test"]
  );
  assert.equal(result.rows.length, 1);
  assert.notEqual(result.rows[0].password_hash, "Password123!");
  assert.ok(result.rows[0].password_hash.startsWith("$2"));
});

test("register rejects invalid email and short passwords", async () => {
  const invalidEmail = await request.post("/auth/register").send({
    email: "not-an-email",
    password: "Password123!",
  });
  assert.equal(invalidEmail.status, 400);
  assert.match(invalidEmail.body.error, /email/i);

  const shortPassword = await request.post("/auth/register").send({
    email: "valid@commit2fit.test",
    password: "short",
  });
  assert.equal(shortPassword.status, 400);
  assert.match(shortPassword.body.error, /8 characters/i);
});

test("register rejects duplicate emails case-insensitively", async () => {
  await request.post("/auth/register").send({
    email: "Demo@Commit2Fit.test",
    password: "Password123!",
  });

  const duplicate = await request.post("/auth/register").send({
    email: "demo@commit2fit.test",
    password: "Password123!",
  });

  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.error, "User already exists");
});

test("login returns the same generic error for unknown email and wrong password", async () => {
  await request.post("/auth/register").send({
    email: "demo@commit2fit.test",
    password: "Password123!",
  });

  const wrongPassword = await request.post("/auth/login").send({
    email: "demo@commit2fit.test",
    password: "WrongPassword!",
  });
  const unknownEmail = await request.post("/auth/login").send({
    email: "missing@commit2fit.test",
    password: "Password123!",
  });

  assert.equal(wrongPassword.status, 401);
  assert.equal(unknownEmail.status, 401);
  assert.equal(wrongPassword.body.error, unknownEmail.body.error);
});

test("auth middleware rejects missing, manipulated and expired tokens", async () => {
  const registered = await request.post("/auth/register").send({
    email: "auth@commit2fit.test",
    password: "Password123!",
  });
  const userId = registered.body.user.id;

  const noToken = await request.get("/auth/me");
  assert.equal(noToken.status, 401);

  const manipulatedToken = `${registered.body.token.slice(0, -1)}x`;
  const manipulated = await request
    .get("/auth/me")
    .set("Authorization", `Bearer ${manipulatedToken}`);
  assert.equal(manipulated.status, 401);

  const expiredToken = jwt.sign({ sub: userId }, config.jwtSecret, {
    expiresIn: -1,
  });
  const expired = await request
    .get("/auth/me")
    .set("Authorization", `Bearer ${expiredToken}`);
  assert.equal(expired.status, 401);
});

test("two logins for one account issue distinct tokens that both remain valid", async () => {
  await request.post("/auth/register").send({
    email: "multi-device@commit2fit.test",
    password: "Password123!",
  });

  const firstLogin = await request.post("/auth/login").send({
    email: "multi-device@commit2fit.test",
    password: "Password123!",
  });
  const secondLogin = await request.post("/auth/login").send({
    email: "multi-device@commit2fit.test",
    password: "Password123!",
  });

  assert.equal(firstLogin.status, 200);
  assert.equal(secondLogin.status, 200);
  assert.notEqual(firstLogin.body.token, secondLogin.body.token);

  for (const token of [firstLogin.body.token, secondLogin.body.token]) {
    const response = await request
      .get("/auth/me")
      .set("Authorization", `Bearer ${token}`);
    assert.equal(response.status, 200);
    assert.equal(response.body.email, "multi-device@commit2fit.test");
  }
});

// T082: both outcomes of every if in routes/auth.js and middleware/auth.js
test("register and login treat a non-string e-mail or password as missing", async () => {
  const numberEmail = await request.post("/auth/register").send({ email: 12345, password: "Password123!" });
  assert.equal(numberEmail.status, 400);
  assert.equal(numberEmail.body.error, "A valid email is required");

  const numberPassword = await request
    .post("/auth/register")
    .send({ email: "types@commit2fit.test", password: 12345678 });
  assert.equal(numberPassword.status, 400);
  assert.equal(numberPassword.body.error, "Password must be at least 8 characters long");

  const emptyBody = await request.post("/auth/login").send({});
  assert.equal(emptyBody.status, 401);
});

test("login with an unknown e-mail and with a wrong password both answer 401", async () => {
  await request.post("/auth/register").send({ email: "known@commit2fit.test", password: "Password123!" });

  const unknown = await request.post("/auth/login").send({ email: "unknown@commit2fit.test", password: "Password123!" });
  const wrongPassword = await request.post("/auth/login").send({ email: "known@commit2fit.test", password: "Wrong1234!" });

  for (const response of [unknown, wrongPassword]) {
    assert.equal(response.status, 401);
    assert.equal(response.body.error, "Invalid email or password");
  }
});

test("requireAuth rejects a Bearer header without token (Node trims it to \"Bearer\") and a different scheme", async () => {
  const emptyToken = await request.get("/auth/me").set("Authorization", "Bearer    ");
  assert.equal(emptyToken.status, 401);
  assert.equal(emptyToken.body.error, "Authentication required");

  const basic = await request.get("/auth/me").set("Authorization", "Basic abc");
  assert.equal(basic.status, 401);
  assert.equal(basic.body.error, "Authentication required");
});

test("requireAuth rejects a valid token of a user that no longer exists", async () => {
  const registered = await request.post("/auth/register").send({ email: "gone@commit2fit.test", password: "Password123!" });
  await pool.query("DELETE FROM users WHERE id = $1", [registered.body.user.id]);

  const response = await request.get("/auth/me").set("Authorization", `Bearer ${registered.body.token}`);
  assert.equal(response.status, 401);
  assert.equal(response.body.error, "Authentication failed");
});

test("GET /auth/me returns id, e-mail and creation date of the logged-in user", async () => {
  const registered = await request.post("/auth/register").send({ email: "me@commit2fit.test", password: "Password123!" });
  const response = await request.get("/auth/me").set("Authorization", `Bearer ${registered.body.token}`);
  assert.equal(response.status, 200);
  assert.equal(response.body.id, registered.body.user.id);
  assert.equal(response.body.email, "me@commit2fit.test");
  assert.ok(!Number.isNaN(Date.parse(response.body.createdAt)));
  assert.equal("passwordHash" in response.body, false);
});
