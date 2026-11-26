// T083: public functions of api.js (REST client). fetch is replaced by a fake that records every call.
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, reply } = require("./helpers.cjs");

const SCRIPTS = ["util.js", "config.js", "api.js"];
const SESSION = { "c2f-token": "tok123", "c2f-user": JSON.stringify({ id: 7, email: "a@b.at" }) };

/** Load api.js with a fake fetch that answers with the given responses in order. */
function setup(responses = [], options = {}) {
  const calls = [];
  const queue = [...responses];
  const fetch = (url, init) => {
    calls.push({ url, init });
    const next = queue.shift();
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  };
  const loaded = load(SCRIPTS, { storage: SESSION, ...options, fetch });
  return { ...loaded, api: loaded.C2F.api, calls };
}

/* ---------- access guard ---------- */

test("pages other than login.html redirect to the login without a token", () => {
  const { C2F, replaced } = load(SCRIPTS, { location: { pathname: "/heute.html" } });
  assert.equal(C2F.halt, true);
  assert.deepEqual(replaced, ["login.html"]);
});

test("the login page and pages with a token are not redirected", () => {
  const login = load(SCRIPTS, { location: { pathname: "/login.html" } });
  assert.equal(login.C2F.onLoginPage, true);
  assert.equal(login.C2F.halt, undefined);
  assert.deepEqual(login.replaced, []);

  const withToken = load(SCRIPTS, { storage: SESSION });
  assert.equal(withToken.C2F.halt, undefined);
});

/* ---------- token, user, logout ---------- */

test("token and user are read from localStorage", () => {
  const { api } = setup();
  assert.equal(api.token(), "tok123");
  assert.deepEqual(api.user(), { id: 7, email: "a@b.at" });
});

test("user is null when nothing or broken JSON is stored", () => {
  assert.equal(load(SCRIPTS, { location: { pathname: "/login.html" } }).C2F.api.user(), null);
  const broken = load(SCRIPTS, { storage: { "c2f-token": "t", "c2f-user": "{not json" } });
  assert.equal(broken.C2F.api.user(), null);
});

test("logout removes token and user and opens the login page", () => {
  const { api, storage, replaced } = setup();
  api.logout();
  assert.equal(storage.data.has("c2f-token"), false);
  assert.equal(storage.data.has("c2f-user"), false);
  assert.deepEqual(replaced, ["login.html"]);
});

test("a blocked localStorage counts as logged out and does not throw", () => {
  const { C2F, replaced } = load(SCRIPTS, { brokenStorage: true, location: { pathname: "/login.html" } });
  assert.equal(C2F.api.token(), null);
  assert.doesNotThrow(() => C2F.api.logout());
  assert.deepEqual(replaced, ["login.html"]);
});

/* ---------- login / register ---------- */

test("login and register send e-mail and password without token and save the session", async () => {
  for (const [method, path] of [["login", "/auth/login"], ["register", "/auth/register"]]) {
    const user = { id: 1, email: "new@b.at" };
    const { api, calls, storage } = setup([reply(200, { token: "fresh", user })]);
    assert.deepEqual(await api[method]("new@b.at", "Password123!"), user);

    const { url, init } = calls[0];
    assert.equal(url, "http://localhost:3000" + path);
    assert.equal(init.method, "POST");
    assert.equal(init.headers.Authorization, undefined);
    assert.equal(init.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(init.body), { email: "new@b.at", password: "Password123!" });
    assert.equal(storage.data.get("c2f-token"), "fresh");
    assert.equal(storage.data.get("c2f-user"), JSON.stringify(user));
  }
});

test("a wrong login answers with the German text and does not redirect", async () => {
  const { api, replaced } = setup([reply(401, { error: "Invalid email or password" })]);
  await assert.rejects(api.login("a@b.at", "x"), { status: 401, message: "E-Mail oder Passwort ist falsch." });
  assert.deepEqual(replaced, []);
});

/* ---------- requests with token ---------- */

test("me and health use GET without body; me sends the token, health does not", async () => {
  const { api, calls } = setup([reply(200, { id: 7 }), reply(200, { status: "ok" })]);
  assert.deepEqual(await api.me(), { id: 7 });
  assert.deepEqual(await api.health(), { status: "ok" });

  assert.equal(calls[0].url, "http://localhost:3000/auth/me");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok123");
  assert.equal(calls[0].init.body, undefined);
  assert.equal(calls[0].init.headers["Content-Type"], undefined);
  assert.equal(calls[1].init.headers.Authorization, undefined);
});

test("requests without a stored token are sent without Authorization header", async () => {
  const calls = [];
  const { C2F } = load(SCRIPTS, {
    location: { pathname: "/login.html" },
    fetch: (url, init) => {
      calls.push(init);
      return Promise.resolve(reply(200, {}));
    },
  });
  await C2F.api.me();
  assert.equal(calls[0].headers.Authorization, undefined);
});

test("an empty success answer (e.g. 204) resolves with null", async () => {
  const { api } = setup([reply(204)]);
  assert.equal(await api.me(), null);
});

test("401 with a token clears the session and opens the login with ?expired=1", async () => {
  const { api, storage, replaced } = setup([reply(401, { error: "Invalid or expired token" })]);
  await assert.rejects(api.me(), { status: 401, message: "Deine Sitzung ist abgelaufen. Bitte melde dich neu an." });
  assert.equal(storage.data.has("c2f-token"), false);
  assert.deepEqual(replaced, ["login.html?expired=1"]);
});

/* ---------- error texts ---------- */

test("known backend errors are translated, unknown ones are passed on", async () => {
  const { api } = setup([
    reply(400, { error: "Product name is required" }),
    reply(400, { error: "carbs must be a non-negative number" }),
    reply(400, { error: "Something new" }),
  ]);
  await assert.rejects(api.createProduct({}), { status: 400, message: "Bitte einen Produktnamen eingeben." });
  await assert.rejects(api.createProduct({}), { message: "Bitte für Kohlenhydrate eine Zahl ab 0 eingeben." });
  await assert.rejects(api.createProduct({}), { message: "Something new" });
});

test("errors without JSON body show the status code", async () => {
  const { api } = setup([reply(500), reply(502, "<html>Bad Gateway</html>")]);
  await assert.rejects(api.me(), { status: 500, message: "Fehler 500" });
  await assert.rejects(api.me(), { status: 502, message: "Fehler 502" });
});

test("a network error says that the server cannot be reached", async () => {
  const { api } = setup([new TypeError("Failed to fetch")]);
  await assert.rejects(api.me(), (err) => err.status === 0 && /nicht erreichbar/.test(err.message));
});

/* ---------- products ---------- */

test("searchProducts builds the query with and without search text", async () => {
  const { api, calls } = setup([reply(200, { items: [] }), reply(200, { items: [] })]);
  await api.searchProducts("Müsli & Co", 5, 10);
  await api.searchProducts("");
  assert.equal(calls[0].url, "http://localhost:3000/products?search=M%C3%BCsli%20%26%20Co&limit=5&offset=10");
  assert.equal(calls[1].url, "http://localhost:3000/products?limit=20&offset=0");
});

test("productByBarcode returns the product, null for 404 and rejects other errors", async () => {
  const product = { id: 1, barcode: "12345678" };
  const { api, calls } = setup([reply(200, product), reply(404, { error: "Product not found" }), reply(500, {})]);
  assert.deepEqual(await api.productByBarcode("12345678"), product);
  assert.equal(await api.productByBarcode("99999999"), null);
  await assert.rejects(api.productByBarcode("12345678"), { status: 500 });
  assert.equal(calls[0].url, "http://localhost:3000/products/12345678");
});

test("createProduct posts the product", async () => {
  const { api, calls } = setup([reply(201, { id: 3 })]);
  assert.deepEqual(await api.createProduct({ name: "Apfel" }), { id: 3 });
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(calls[0].init.body), { name: "Apfel" });
});

test("mapProduct converts API products and handles missing brand and barcode", () => {
  const { C2F } = setup();
  assert.deepEqual(
    C2F.mapProduct({ id: 1, barcode: "12345678", name: "Yogurt", brand: "Farm", kcal: "59", protein: 10, carbs: 3.2, fat: "1.5" }),
    { id: 1, bc: "12345678", name: "Yogurt", brand: "Farm", k: 59, p: 10, c: 3.2, f: 1.5 }
  );
  const plain = C2F.mapProduct({ id: 2, barcode: null, name: "Apfel", brand: null, kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 });
  assert.equal(plain.bc, "");
  assert.equal(plain.brand, "");
});

/* ---------- diary (T094-T096) ---------- */

test("addIntake posts product, amount and meal with the token", async () => {
  const entry = { productId: 3, amountG: 150, meal: "lunch" };
  const { api, calls } = setup([reply(201, { id: 9, ...entry })]);
  assert.deepEqual(await api.addIntake(entry), { id: 9, ...entry });

  assert.equal(calls[0].url, "http://localhost:3000/intake");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok123");
  assert.deepEqual(JSON.parse(calls[0].init.body), entry);
});

test("addIntake rejects with the German text for wrong input and unknown products", async () => {
  const { api } = setup([
    reply(400, { error: "amountG must be a positive number" }),
    reply(404, { error: "Product not found" }),
    reply(400, { error: "productId must be a positive integer" }),
    reply(400, { error: "meal must be one of: breakfast, lunch, dinner, snack" }),
  ]);
  await assert.rejects(api.addIntake({}), { status: 400, message: "Bitte eine Menge größer als 0 g eingeben." });
  await assert.rejects(api.addIntake({}), { status: 404, message: "Produkt nicht gefunden." });
  await assert.rejects(api.addIntake({}), { message: "Das Produkt ist ungültig." });
  await assert.rejects(api.addIntake({}), { message: "Bitte eine Mahlzeit auswählen." });
});

test("deleteIntake sends DELETE and resolves with null for the empty 204 answer", async () => {
  const { api, calls } = setup([reply(204), reply(404, { error: "Entry not found" })]);
  assert.equal(await api.deleteIntake(42), null);
  assert.equal(calls[0].url, "http://localhost:3000/intake/42");
  assert.equal(calls[0].init.method, "DELETE");
  assert.equal(calls[0].init.body, undefined);

  await assert.rejects(api.deleteIntake("7"), { status: 404, message: "Dieser Eintrag existiert nicht mehr." });
});

test("diary asks for one day, diaryTotals for a period; bad dates get the German text", async () => {
  const { api, calls } = setup([
    reply(200, { day: "2026-11-20" }),
    reply(200, { days: [] }),
    reply(400, { error: "date must be a date in the format YYYY-MM-DD" }),
    reply(400, { error: "from must be a date in the format YYYY-MM-DD" }),
    reply(400, { error: "to must be a date in the format YYYY-MM-DD" }),
  ]);
  assert.deepEqual(await api.diary("2026-11-20"), { day: "2026-11-20" });
  assert.deepEqual(await api.diaryTotals("2026-11-14", "2026-11-20"), { days: [] });
  assert.equal(calls[0].url, "http://localhost:3000/diary?date=2026-11-20");
  assert.equal(calls[1].url, "http://localhost:3000/diary/totals?from=2026-11-14&to=2026-11-20");
  assert.equal(calls[1].init.headers.Authorization, "Bearer tok123");

  await assert.rejects(api.diary("x"), { status: 400, message: "Das Datum ist ungültig." });
  await assert.rejects(api.diaryTotals("x", "y"), { message: "Das Datum ist ungültig." });
  await assert.rejects(api.diaryTotals("2026-11-14", "y"), { message: "Das Datum ist ungültig." });
});

/* ---------- profile (T097) ---------- */

const LOCAL_PROFILE = { sex: "w", age: 30, h: 165, w: 60, act: 2, goal: "abnehmen" };
const API_PROFILE = { sex: "female", age: 30, height: 165, weight: 60, activityLevel: 2, goal: "lose" };

test("profileToApi and profileFromApi convert in both directions", () => {
  const { C2F } = setup();
  assert.deepEqual(C2F.profileToApi(LOCAL_PROFILE), API_PROFILE);
  assert.deepEqual(C2F.profileToApi({ sex: "m", age: 22, h: 180, w: 75, act: 0, goal: "zunehmen" }), { sex: "male", age: 22, height: 180, weight: 75, activityLevel: 0, goal: "gain" });
  assert.equal(C2F.profileToApi({ ...LOCAL_PROFILE, goal: "halten" }).goal, "maintain");
  assert.deepEqual(C2F.profileFromApi(API_PROFILE), LOCAL_PROFILE);
  assert.equal(C2F.profileFromApi({ ...API_PROFILE, sex: "male", goal: "maintain", activityLevel: 3 }).goal, "halten");
  assert.equal(C2F.profileFromApi({ ...API_PROFILE, goal: "gain" }).goal, "zunehmen");
});

test("profileFromApi leaves out missing or invalid values so local values stay", () => {
  const { C2F } = setup();
  assert.deepEqual(C2F.profileFromApi({}), {});
  assert.deepEqual(C2F.profileFromApi({ sex: "x", goal: "fly", age: "30", height: null, weight: NaN, activityLevel: 4 }), {});
  assert.deepEqual(C2F.profileFromApi({ age: 41, activityLevel: 0 }), { age: 41, act: 0 });
});

test("getProfile returns the profile of the server in the local form", async () => {
  const { api, calls } = setup([reply(200, API_PROFILE)]);
  assert.deepEqual(await api.getProfile(), LOCAL_PROFILE);
  assert.equal(calls[0].url, "http://localhost:3000/profile");
  assert.equal(calls[0].init.method, "GET");
  assert.equal(calls[0].init.headers.Authorization, "Bearer tok123");
});

test("getProfile returns null while the backend has no /profile endpoint (404) or an empty answer, and rejects other errors", async () => {
  const { api } = setup([reply(404, { error: "Not found" }), reply(204), reply(500, {})]);
  assert.equal(await api.getProfile(), null);
  assert.equal(await api.getProfile(), null);
  await assert.rejects(api.getProfile(), { status: 500 });
});

test("a network error while loading the profile is passed on", async () => {
  const { api } = setup([new TypeError("Failed to fetch")]);
  await assert.rejects(api.getProfile(), { status: 0 });
});

test("saveProfile sends PUT with the converted profile and returns the saved profile", async () => {
  const { api, calls } = setup([reply(200, API_PROFILE)]);
  assert.deepEqual(await api.saveProfile(LOCAL_PROFILE), LOCAL_PROFILE);
  assert.equal(calls[0].url, "http://localhost:3000/profile");
  assert.equal(calls[0].init.method, "PUT");
  assert.deepEqual(JSON.parse(calls[0].init.body), API_PROFILE);
});

test("saveProfile returns null for 404 (no endpoint yet) and rejects other errors", async () => {
  const { api } = setup([reply(404, { error: "Not found" }), reply(400, { error: "Something new" })]);
  assert.equal(await api.saveProfile(LOCAL_PROFILE), null);
  await assert.rejects(api.saveProfile(LOCAL_PROFILE), { status: 400, message: "Something new" });
});
