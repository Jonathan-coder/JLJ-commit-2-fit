// T091: database tests for user profiles (migration 1794336400000, repositories/profiles.js)
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool, resetTables } from "../src/db.js";
import { getProfile, saveProfile, validateProfile } from "../src/repositories/profiles.js";

let userA;
let userB;

async function createUser(email) {
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'not-a-real-hash') RETURNING id",
    [email]
  );
  return result.rows[0].id;
}

const valid = { sex: "male", age: 22, height: 180, weight: 75.5, activityLevel: 1, goal: "maintain" };

beforeEach(async () => {
  await resetTables();
  userA = await createUser("a@commit2fit.test");
  userB = await createUser("b@commit2fit.test");
});

test("getProfile returns null as long as the user has not saved a profile", async () => {
  assert.equal(await getProfile(userA), null);
});

test("saveProfile creates the profile and getProfile returns it with the frontend field names", async () => {
  const saved = await saveProfile(userA, valid);
  const { updatedAt, ...fields } = saved;
  assert.deepEqual(fields, valid);
  assert.ok(updatedAt instanceof Date);
  assert.deepEqual(await getProfile(userA), saved);
});

test("saveProfile replaces an existing profile instead of creating a second one", async () => {
  const first = await saveProfile(userA, valid);
  const second = await saveProfile(userA, { ...valid, weight: 72, goal: "lose", activityLevel: 3 });

  assert.equal(second.weight, 72);
  assert.equal(second.goal, "lose");
  assert.equal(second.activityLevel, 3);
  assert.ok(second.updatedAt >= first.updatedAt);
  const rows = await pool.query("SELECT COUNT(*)::int AS n FROM user_profiles WHERE user_id = $1", [userA]);
  assert.equal(rows.rows[0].n, 1);
});

test("profiles belong to one user only", async () => {
  await saveProfile(userA, valid);
  assert.equal(await getProfile(userB), null);
  await saveProfile(userB, { ...valid, sex: "female", age: 30 });
  assert.equal((await getProfile(userA)).sex, "male");
  assert.equal((await getProfile(userB)).sex, "female");
});

test("deleting a user deletes the profile", async () => {
  await saveProfile(userA, valid);
  await pool.query("DELETE FROM users WHERE id = $1", [userA]);
  const rows = await pool.query("SELECT COUNT(*)::int AS n FROM user_profiles");
  assert.equal(rows.rows[0].n, 0);
});

test("validateProfile accepts the limits and returns only the known fields", () => {
  const lower = { sex: "female", age: 12, height: 120, weight: 35, activityLevel: 0, goal: "gain" };
  const upper = { sex: "male", age: 100, height: 230, weight: 250, activityLevel: 3, goal: "lose" };
  assert.deepEqual(validateProfile(lower), lower);
  assert.deepEqual(validateProfile(upper), upper);
  assert.deepEqual(validateProfile({ ...valid, extra: "ignored" }), valid);
});

test("validateProfile and saveProfile reject every invalid field with statusCode 400", async () => {
  const cases = [
    [undefined, /sex/],
    [{ ...valid, sex: "x" }, /sex/],
    [{ ...valid, age: 25.5 }, /age/],
    [{ ...valid, age: 11 }, /age/],
    [{ ...valid, age: 101 }, /age/],
    [{ ...valid, age: "22" }, /age/],
    [{ ...valid, height: 119.9 }, /height/],
    [{ ...valid, height: 230.1 }, /height/],
    [{ ...valid, height: "180" }, /height/],
    [{ ...valid, height: Number.POSITIVE_INFINITY }, /height/],
    [{ ...valid, weight: 34 }, /weight/],
    [{ ...valid, weight: null }, /weight/],
    [{ ...valid, activityLevel: 1.5 }, /activityLevel/],
    [{ ...valid, activityLevel: 4 }, /activityLevel/],
    [{ ...valid, activityLevel: -1 }, /activityLevel/],
    [{ ...valid, goal: "bulk" }, /goal/],
  ];
  for (const [input, message] of cases) {
    assert.throws(() => validateProfile(input), (e) => e.statusCode === 400 && message.test(e.message), JSON.stringify(input));
    await assert.rejects(saveProfile(userA, input), (e) => e.statusCode === 400, JSON.stringify(input));
  }
  assert.equal(await getProfile(userA), null);
});

test("the database itself rejects values outside the limits", async () => {
  await assert.rejects(
    pool.query(
      `INSERT INTO user_profiles (user_id, sex, age, height_cm, weight_kg, activity_level, goal)
       VALUES ($1, 'male', 22, 180, 75, 7, 'maintain')`,
      [userA]
    ),
    /user_profiles_activity_check/
  );
});
