// T092: database tests for fasting sessions (migration 1794336500000, repositories/fasting.js)
import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { pool, resetTables } from "../src/db.js";
import { startSession, getActiveSession, endSession, listSessions } from "../src/repositories/fasting.js";

let userA;
let userB;

async function createUser(email) {
  const result = await pool.query(
    "INSERT INTO users (email, password_hash) VALUES ($1, 'not-a-real-hash') RETURNING id",
    [email]
  );
  return result.rows[0].id;
}

const ramadan = { model: "Ramadan", firstDay: "2027-02-08", lastDay: "2027-03-09", from: "05:30", to: "18:00" };
const HOUR = 3600e3;

beforeEach(async () => {
  await resetTables();
  userA = await createUser("a@commit2fit.test");
  userB = await createUser("b@commit2fit.test");
});

test("interval fasting: the planned end is start + 16, 18 or 20 hours", async () => {
  for (const [model, hours] of [["16:8", 16], ["18:6", 18], ["20:4", 20]]) {
    const s = await startSession(userA, { model, startedAt: "2026-11-26T20:00:00+01:00" });
    assert.equal(s.model, model);
    assert.equal(s.active, true);
    assert.equal(s.plannedEnd - s.startedAt, hours * HOUR);
    assert.equal(s.ramadanFirstDay, null);
    assert.equal(s.ramadanLastDay, null);
    assert.equal(s.from, null);
    assert.equal(s.to, null);
    await endSession(userA);
  }
});

test("startSession without startedAt starts now", async () => {
  const before = Date.now();
  const s = await startSession(userA, { model: "16:8" });
  assert.ok(s.startedAt.getTime() >= before - 5000 && s.startedAt.getTime() <= Date.now() + 5000);
});

test("Ramadan stores first and last day and the daily window, without planned end", async () => {
  const s = await startSession(userA, ramadan);
  assert.equal(s.plannedEnd, null);
  assert.equal(s.ramadanFirstDay, "2027-02-08");
  assert.equal(s.ramadanLastDay, "2027-03-09");
  assert.equal(s.from, "05:30");
  assert.equal(s.to, "18:00");
  assert.deepEqual(await getActiveSession(userA), s);
});

test("startSession rejects invalid input with statusCode 400", async () => {
  const cases = [
    undefined,
    { model: "12:12" },
    { model: "16:8", startedAt: "yesterday" },
    { model: "16:8", startedAt: "2026-11-26 20:00" },
    { ...ramadan, firstDay: "08.02.2027" },
    { ...ramadan, lastDay: "2027-02-30" },
    { ...ramadan, firstDay: "2027-13-45" },
    { ...ramadan, firstDay: 20270208 },
    { ...ramadan, lastDay: "2027-02-07" },
    { ...ramadan, from: undefined },
    { ...ramadan, to: undefined },
    { ...ramadan, to: "25:00" },
    { ...ramadan, from: "18:00", to: "05:30" },
    { ...ramadan, from: "18:00", to: "18:00" },
  ];
  for (const input of cases) {
    await assert.rejects(
      input === undefined ? startSession(userA) : startSession(userA, input),
      (e) => e.statusCode === 400,
      JSON.stringify(input)
    );
  }
  assert.equal(await getActiveSession(userA), null);
});

test("only one running session per user (409), but other users are independent", async () => {
  await startSession(userA, { model: "16:8" });
  await assert.rejects(startSession(userA, ramadan), (e) => e.statusCode === 409);
  const other = await startSession(userB, { model: "18:6" });
  assert.equal(other.active, true);
});

test("other database errors are passed on unchanged", async () => {
  await assert.rejects(startSession(999999, { model: "16:8" }), (e) => e.code === "23503" && e.statusCode === undefined);
});

test("getActiveSession returns null when nothing is running", async () => {
  assert.equal(await getActiveSession(userA), null);
});

test("endSession stops the running session; afterwards a new one can be started", async () => {
  await startSession(userA, { model: "16:8", startedAt: "2026-11-26T20:00:00+01:00" });
  const ended = await endSession(userA, "2026-11-27T12:00:00+01:00");
  assert.equal(ended.active, false);
  assert.equal(ended.endedAt.toISOString(), "2026-11-27T11:00:00.000Z");
  assert.equal(await getActiveSession(userA), null);
  assert.equal((await startSession(userA, { model: "20:4" })).active, true);
});

test("endSession never ends before the start and returns null when nothing is running", async () => {
  assert.equal(await endSession(userA), null);
  const s = await startSession(userA, { model: "16:8", startedAt: "2026-11-26T20:00:00+01:00" });
  const ended = await endSession(userA, "2026-11-26T10:00:00+01:00");
  assert.equal(ended.endedAt.getTime(), s.startedAt.getTime());
  await assert.rejects(endSession(userA, "now"), (e) => e.statusCode === 400);
});

test("listSessions returns the history newest first, only for the own user", async () => {
  await startSession(userA, { model: "16:8", startedAt: "2026-11-20T20:00:00+01:00" });
  await endSession(userA, "2026-11-21T12:00:00+01:00");
  await startSession(userA, { model: "18:6", startedAt: "2026-11-25T20:00:00+01:00" });
  await startSession(userB, { model: "20:4" });

  const all = await listSessions(userA);
  assert.deepEqual(all.map((s) => [s.model, s.active]), [["18:6", true], ["16:8", false]]);
  assert.equal((await listSessions(userA, 1)).length, 1);
  for (const limit of [0, 101, 1.5, "5"]) {
    await assert.rejects(listSessions(userA, limit), (e) => e.statusCode === 400, String(limit));
  }
});

test("the database rejects inconsistent sessions", async () => {
  await assert.rejects(
    pool.query("INSERT INTO fasting_sessions (user_id, model) VALUES ($1, '16:8')", [userA]),
    /fasting_sessions_fields_check/
  );
  await assert.rejects(
    pool.query(
      `INSERT INTO fasting_sessions (user_id, model, ramadan_first_day, ramadan_last_day, fast_from, fast_to)
       VALUES ($1, 'Ramadan', '2027-02-08', '2027-03-09', '18:00', '05:30')`,
      [userA]
    ),
    /fasting_sessions_fields_check/
  );
});

test("deleting a user deletes the fasting sessions", async () => {
  await startSession(userA, { model: "16:8" });
  await pool.query("DELETE FROM users WHERE id = $1", [userA]);
  const rows = await pool.query("SELECT COUNT(*)::int AS n FROM fasting_sessions");
  assert.equal(rows.rows[0].n, 0);
});
