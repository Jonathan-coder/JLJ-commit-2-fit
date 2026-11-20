// T083: public functions of state.js (local state, nutrition, daily target, warnings)
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

const SCRIPTS = ["util.js", "config.js", "api.js", "data.js", "state.js"];
const USER = { "c2f-token": "t", "c2f-user": JSON.stringify({ id: 7 }) };
const KEY = "commit2fit-v2-7";
const yogurt = { id: 1, name: "Yogurt", k: 60, p: 10, c: 4, f: 2 };

function withState(saved, options = {}) {
  const storage = { ...USER };
  if (saved !== undefined) storage[KEY] = typeof saved === "string" ? saved : JSON.stringify(saved);
  return load(SCRIPTS, { storage, ...options });
}

/* ---------- loading and saving ---------- */

test("without saved state the defaults are used (incl. Ramadan dates)", () => {
  const { C2F } = withState();
  assert.equal(C2F.S.profile.goal, "halten");
  assert.deepEqual(C2F.S.fast, { model: "16:8", startTs: null, from: "05:30", to: "18:00", startDate: "2027-02-08", endDate: "2027-03-09" });
  assert.deepEqual(C2F.S.ue, []);
});

test("saved state is loaded and an old fast setting gets the new Ramadan fields", () => {
  const saved = { profile: { sex: "w", age: 30, h: 165, w: 60, act: 2, goal: "abnehmen" }, favs: [yogurt], fast: { model: "Ramadan", startTs: null, from: "05:00", to: "17:00" }, ue: [] };
  const { C2F } = withState(saved);
  assert.equal(C2F.S.profile.sex, "w");
  assert.deepEqual(C2F.S.favs, [yogurt]);
  assert.equal(C2F.S.fast.from, "05:00");
  assert.equal(C2F.S.fast.startDate, "2027-02-08");
});

test("broken JSON or state without profile falls back to the defaults", () => {
  assert.equal(withState("{broken").C2F.S.profile.goal, "halten");
  assert.equal(withState({ fast: {} }).C2F.S.profile.goal, "halten");
});

test("the state is stored per account, anonymous without login", () => {
  const { C2F, storage } = load(SCRIPTS, { location: { pathname: "/login.html" } });
  C2F.save();
  assert.ok(storage.data.has("commit2fit-v2-anon"));
});

test("save writes the state and ignores a blocked localStorage", () => {
  const { C2F, storage } = withState();
  C2F.S.profile.age = 40;
  C2F.save();
  assert.equal(JSON.parse(storage.data.get(KEY)).profile.age, 40);

  const blocked = load(SCRIPTS, { brokenStorage: true, location: { pathname: "/login.html" } });
  assert.doesNotThrow(() => blocked.C2F.save());
});

test("resetState restores the defaults and saves them", () => {
  const { C2F, storage } = withState({ profile: { age: 50 }, fast: {}, ue: [{ id: "u1" }], extra: true });
  C2F.resetState();
  assert.equal(C2F.S.profile.age, 22);
  assert.equal(C2F.S.extra, undefined);
  assert.deepEqual(JSON.parse(storage.data.get(KEY)).ue, []);
});

/* ---------- nutrition ---------- */

test("nutP scales values per 100 g; nut and logAll use the diary entries", () => {
  const { C2F } = withState({ profile: {}, fast: {}, ue: [{ id: "u1", d: "2026-11-20", m: 0, g: 150, snap: yogurt }] });
  assert.deepEqual(C2F.nutP(yogurt, 50), { k: 30, p: 5, c: 2, f: 1 });
  assert.deepEqual(C2F.nut(C2F.logAll()[0]), { k: 90, p: 15, c: 6, f: 3 });
});

test("dayTotals adds up only the entries of that day", () => {
  const ue = [
    { id: "a", d: "2026-11-20", m: 0, g: 100, snap: yogurt },
    { id: "b", d: "2026-11-20", m: 1, g: 200, snap: yogurt },
    { id: "c", d: "2026-11-19", m: 0, g: 100, snap: yogurt },
  ];
  const { C2F } = withState({ profile: {}, fast: {}, ue });
  assert.deepEqual(C2F.dayTotals("2026-11-20"), { k: 180, p: 30, c: 12, f: 6 });
  assert.deepEqual(C2F.dayTotals("2026-01-01"), { k: 0, p: 0, c: 0, f: 0 });
});

/* ---------- daily target (Mifflin-St Jeor) ---------- */

function targetsFor(profile) {
  const { C2F } = withState({ profile, fast: {}, ue: [] });
  return C2F.targets();
}

test("targets for a man who keeps his weight", () => {
  // BMR = 10*75 + 6.25*180 - 5*22 + 5 = 1770; TDEE = 1770 * 1.2 = 2124 -> 2120; carbs = (2120 - 120*4 - 71*9) / 4 = 250
  assert.deepEqual(targetsFor({ sex: "m", age: 22, h: 180, w: 75, act: 0, goal: "halten" }), { bmr: 1770, tdee: 2124, k: 2120, p: 120, c: 250, f: 71 });
});

test("targets for a woman: -161, goals change the calories, unknown goal counts as keep", () => {
  const base = { sex: "w", age: 30, h: 165, w: 60, act: 2 };
  // BMR = 600 + 1031.25 - 150 - 161 = 1320.25; TDEE = 2046.4
  assert.equal(targetsFor({ ...base, goal: "halten" }).bmr, 1320);
  assert.equal(targetsFor({ ...base, goal: "halten" }).k, 2050);
  assert.equal(targetsFor({ ...base, goal: "abnehmen" }).k, 1650);
  assert.equal(targetsFor({ ...base, goal: "zunehmen" }).k, 2350);
  assert.equal(targetsFor({ ...base, goal: "unknown" }).k, 2050);
});

test("targets never go below the minimum (1500 men, 1200 women) and fix invalid profile values", () => {
  assert.equal(targetsFor({ sex: "m", age: 100, h: 120, w: 35, act: 0, goal: "abnehmen" }).k, 1500);
  assert.equal(targetsFor({ sex: "w", age: 100, h: 120, w: 35, act: 0, goal: "abnehmen" }).k, 1200);
  // invalid values -> defaults 22 years, 180 cm, 75 kg
  assert.equal(targetsFor({ sex: "m", age: "x", h: "", w: null, act: 0, goal: "halten" }).bmr, 1770);
});

/* ---------- warnings (F06) ---------- */

const target = { k: 2000, p: 100, c: 250, f: 70 };

test("status: none without intake, high above 115 %, low below 70 % for past days", () => {
  const { C2F } = withState();
  assert.equal(C2F.status({ k: 0 }, target, false), "none");
  assert.equal(C2F.status({ k: 2400 }, target, false), "high");
  assert.equal(C2F.status({ k: 1000 }, target, false), "low");
  assert.equal(C2F.status({ k: 1800 }, target, false), "ok");
});

test("status for today warns about too little only from 18:00", (t) => {
  const { C2F } = withState();
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 20, 12, 0) });
  assert.equal(C2F.status({ k: 1000 }, target, true), "ok");
  t.mock.timers.setTime(new Date(2026, 10, 20, 19, 0).getTime());
  assert.equal(C2F.status({ k: 1000 }, target, true), "low");
});

test("checks lists the warnings for too much, too little, fat and protein", (t) => {
  const { C2F } = withState();
  assert.deepEqual(C2F.checks({ k: 0, p: 0, f: 0 }, target, false), []);
  assert.deepEqual(C2F.checks({ k: 1900, p: 90, f: 60 }, target, false), []);

  const high = C2F.checks({ k: 2500, p: 50, f: 100 }, target, false);
  assert.deepEqual(high.map((w) => w.lv), ["bad", "warn", "warn"]);
  assert.match(high[0].txt, /500 kcal über dem Tagesziel/);

  const low = C2F.checks({ k: 1000, p: 80, f: 30 }, target, false);
  assert.deepEqual(low, [{ lv: "warn", txt: "Zu wenig: nur 50 % des Tagesziels erreicht." }]);

  // today before 18:00: no protein warning yet
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 20, 9, 0) });
  assert.deepEqual(C2F.checks({ k: 1500, p: 10, f: 30 }, target, true), []);
});

test("defMeal picks the meal from the time of day", (t) => {
  const { C2F } = withState();
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 20, 8, 0) });
  const at = (h) => {
    t.mock.timers.setTime(new Date(2026, 10, 20, h, 0).getTime());
    return C2F.defMeal();
  };
  assert.deepEqual([at(8), at(12), at(16), at(19)], [0, 1, 3, 2]);
});
