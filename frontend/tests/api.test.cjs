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
