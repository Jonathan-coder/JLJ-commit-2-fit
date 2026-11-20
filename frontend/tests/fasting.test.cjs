// T077/T083: fasting timer calculation (fasting.js), incl. Ramadan with first and last day
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

const { C2F } = load(["util.js", "data.js", "fasting.js"]);
const H = 3600e3;
const time = (y, m, d, h, min = 0) => new Date(y, m - 1, d, h, min).getTime();
const RAMADAN = { model: "Ramadan", startTs: null, from: "05:30", to: "18:00", startDate: "2027-02-08", endDate: "2027-03-09" };

test("at returns the local time of a day", () => {
  assert.equal(C2F.at("2027-02-08", "05:30"), time(2027, 2, 8, 5, 30));
});

test("daysBetween counts calendar days, also over the change to summer time", () => {
  assert.equal(C2F.daysBetween("2027-02-08", "2027-03-09"), 29);
  assert.equal(C2F.daysBetween("2026-03-28", "2026-03-30"), 2);
  assert.equal(C2F.daysBetween("2026-11-20", "2026-11-20"), 0);
});

/* ---------- 16:8, 18:6, 20:4 ---------- */

test("interval fasting: idle before the start", () => {
  assert.deepEqual(C2F.fastState({ model: "16:8", startTs: null }, Date.now()), { phase: "idle", total: 16 * H });
});

test("interval fasting: running and done", () => {
  const start = time(2026, 11, 20, 20);
  const running = C2F.fastState({ model: "18:6", startTs: start }, start + 2 * H);
  assert.equal(running.phase, "fast");
  assert.equal(running.remain, 16 * H);
  assert.equal(running.to, start + 18 * H);

  const done = C2F.fastState({ model: "20:4", startTs: start }, start + 21 * H);
  assert.equal(done.phase, "done");
  assert.equal(done.over, H);
  assert.equal(done.remain, 0);
});

/* ---------- Ramadan ---------- */

test("Ramadan: invalid when the last day is before the first day", () => {
  assert.deepEqual(C2F.fastState({ ...RAMADAN, endDate: "2027-02-01" }, time(2027, 2, 10, 12)), { invalid: "dates" });
});

test("Ramadan: invalid when the fast would end before it starts", () => {
  assert.deepEqual(C2F.fastState({ ...RAMADAN, from: "18:00", to: "05:30" }, time(2027, 2, 10, 12)), { invalid: "times" });
});

test("Ramadan: countdown before the first day of fasting", () => {
  const st = C2F.fastState(RAMADAN, time(2026, 11, 20, 12));
  assert.equal(st.phase, "before");
  assert.equal(st.start, time(2027, 2, 8, 5, 30));
  assert.equal(st.remain, time(2027, 2, 8, 5, 30) - time(2026, 11, 20, 12));
  assert.equal(st.days, 30);
});

test("Ramadan: on the first day before Fajr it is still the countdown", () => {
  assert.equal(C2F.fastState(RAMADAN, time(2027, 2, 8, 4)).phase, "before");
});

test("Ramadan: fasting during the day shows the day number", () => {
  const st = C2F.fastState(RAMADAN, time(2027, 2, 10, 12));
  assert.equal(st.phase, "fast");
  assert.equal(st.day, 3);
  assert.equal(st.days, 30);
  assert.equal(st.remain, 6 * H);
  assert.equal(st.from, time(2027, 2, 10, 5, 30));
});

test("Ramadan: eating window in the evening and early in the morning", () => {
  const evening = C2F.fastState(RAMADAN, time(2027, 2, 10, 20));
  assert.equal(evening.phase, "eat");
  assert.equal(evening.nextA, time(2027, 2, 11, 5, 30));
  assert.equal(evening.elapsed, 2 * H);

  const morning = C2F.fastState(RAMADAN, time(2027, 2, 11, 4, 30));
  assert.equal(morning.phase, "eat");
  assert.equal(morning.nextA, time(2027, 2, 11, 5, 30));
  assert.equal(morning.remain, H);
  assert.equal(morning.day, 4);
});

test("Ramadan: finished after Maghrib of the last day", () => {
  const lastDay = C2F.fastState(RAMADAN, time(2027, 3, 9, 12));
  assert.equal(lastDay.phase, "fast");
  assert.equal(lastDay.day, 30);

  const after = C2F.fastState(RAMADAN, time(2027, 3, 9, 18, 30));
  assert.deepEqual(after, { phase: "after", end: time(2027, 3, 9, 18), days: 30 });
});
