// T083: public functions of state.js (local state, nutrition, daily target, warnings)
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, reply } = require("./helpers.cjs");

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
  assert.deepEqual(C2F.S.recent, []);
  assert.equal(C2F.S.ue, undefined);
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
  const { C2F, storage } = withState({ profile: { age: 50 }, fast: {}, recent: [yogurt], extra: true });
  C2F.resetState();
  assert.equal(C2F.S.profile.age, 22);
  assert.equal(C2F.S.extra, undefined);
  assert.deepEqual(JSON.parse(storage.data.get(KEY)).recent, []);
});

/* ---------- nutrition ---------- */

test("nutP scales values per 100 g", () => {
  const { C2F } = withState();
  assert.deepEqual(C2F.nutP(yogurt, 50), { k: 30, p: 5, c: 2, f: 1 });
  assert.deepEqual(C2F.nutP(yogurt, 150), { k: 90, p: 15, c: 6, f: 3 });
});

test("rememberRecent puts the product first, without duplicates, and keeps at most 10", () => {
  const { C2F, storage } = withState();
  const product = (id) => ({ id, name: "P" + id, k: 1, p: 1, c: 1, f: 1 });
  for (let id = 1; id <= 12; id += 1) C2F.rememberRecent(product(id));
  assert.deepEqual(C2F.S.recent.map((p) => p.id), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);

  C2F.rememberRecent(product(5));
  assert.deepEqual(C2F.S.recent.map((p) => p.id), [5, 12, 11, 10, 9, 8, 7, 6, 4, 3]);
  assert.deepEqual(JSON.parse(storage.data.get(KEY)).recent.map((p) => p.id), [5, 12, 11, 10, 9, 8, 7, 6, 4, 3]);
});

/* ---------- diary from the server (T094, T096) ---------- */

const apiEntry = (id, meal, amountG, name, kcal) => ({
  id, productId: 1, productName: name, brand: null, meal, amountG, consumedAt: "2026-11-20T07:30:00.000Z", day: "2026-11-20",
  kcal, protein: 10, carbs: 4.5, fat: 2,
});

test("zeroTotals returns a new object with zeros every time", () => {
  const { C2F } = withState();
  assert.deepEqual(C2F.zeroTotals(), { k: 0, p: 0, c: 0, f: 0 });
  assert.notEqual(C2F.zeroTotals(), C2F.zeroTotals());
});

test("totalsFromApi renames kcal, protein, carbs and fat", () => {
  const { C2F } = withState();
  assert.deepEqual(C2F.totalsFromApi({ day: "2026-11-20", entries: 2, kcal: 300, protein: 20, carbs: 30, fat: 10 }), { k: 300, p: 20, c: 30, f: 10 });
});

test("entryFromApi maps the meal name to its index and keeps the nutrients calculated by the server", () => {
  const { C2F } = withState();
  assert.deepEqual(C2F.entryFromApi(apiEntry(9, "dinner", 150, "Reis", 195)), { id: 9, day: "2026-11-20", m: 2, g: 150, name: "Reis", n: { k: 195, p: 10, c: 4.5, f: 2 } });
  assert.equal(C2F.entryFromApi(apiEntry(1, "breakfast", 1, "x", 1)).m, 0);
  assert.equal(C2F.entryFromApi(apiEntry(1, "lunch", 1, "x", 1)).m, 1);
  assert.equal(C2F.entryFromApi(apiEntry(1, "snack", 1, "x", 1)).m, 3);
});

test("diaryFromApi flattens the meals in the order of the day and converts the totals", () => {
  const { C2F } = withState();
  const diary = {
    day: "2026-11-20",
    totals: { day: "2026-11-20", entries: 3, kcal: 400, protein: 30, carbs: 40, fat: 12 },
    meals: {
      breakfast: [apiEntry(1, "breakfast", 100, "Müsli", 150)],
      lunch: [],
      dinner: [apiEntry(2, "dinner", 200, "Reis", 200), apiEntry(3, "dinner", 50, "Brot", 50)],
      snack: [],
    },
  };
  const result = C2F.diaryFromApi(diary);
  assert.equal(result.day, "2026-11-20");
  assert.deepEqual(result.totals, { k: 400, p: 30, c: 40, f: 12 });
  assert.deepEqual(result.entries.map((e) => [e.id, e.m, e.name]), [[1, 0, "Müsli"], [2, 2, "Reis"], [3, 2, "Brot"]]);
});

test("loadDiary asks GET /diary for the day and converts the answer; errors are passed on", async () => {
  const empty = { day: "2026-11-20", totals: { kcal: 0, protein: 0, carbs: 0, fat: 0 }, meals: { breakfast: [], lunch: [], dinner: [], snack: [] } };
  const urls = [];
  const answers = [reply(200, empty), reply(500, { error: "Internal server error" })];
  const { C2F } = withState(undefined, { fetch: (url) => { urls.push(url); return Promise.resolve(answers.shift()); } });

  assert.deepEqual(await C2F.loadDiary("2026-11-20"), { day: "2026-11-20", totals: { k: 0, p: 0, c: 0, f: 0 }, entries: [] });
  assert.deepEqual(urls, ["http://localhost:3000/diary?date=2026-11-20"]);
  await assert.rejects(C2F.loadDiary("2026-11-20"), { status: 500 });
});

test("loadTotals returns the totals by day and leaves out days without entries; errors are passed on", async () => {
  const days = [
    { day: "2026-11-19", entries: 1, kcal: 1800, protein: 90, carbs: 200, fat: 60 },
    { day: "2026-11-20", entries: 2, kcal: 500, protein: 30, carbs: 50, fat: 20 },
  ];
  const urls = [];
  const answers = [reply(200, { from: "2026-11-14", to: "2026-11-20", days }), reply(200, { from: "a", to: "b", days: [] }), reply(401, { error: "x" })];
  const { C2F } = withState(undefined, { fetch: (url) => { urls.push(url); return Promise.resolve(answers.shift()); } });

  assert.deepEqual(await C2F.loadTotals("2026-11-14", "2026-11-20"), {
    "2026-11-19": { k: 1800, p: 90, c: 200, f: 60 },
    "2026-11-20": { k: 500, p: 30, c: 50, f: 20 },
  });
  assert.deepEqual(urls, ["http://localhost:3000/diary/totals?from=2026-11-14&to=2026-11-20"]);
  assert.deepEqual(await C2F.loadTotals("a", "b"), {});
  await assert.rejects(C2F.loadTotals("a", "b"), { status: 401 });
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
