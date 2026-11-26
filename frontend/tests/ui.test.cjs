// T083: public functions of ui.js (toast, warnings, macro bars, meal list, delete buttons)
const test = require("node:test");
const assert = require("node:assert/strict");
const { load, reply } = require("./helpers.cjs");

const SCRIPTS = ["util.js", "config.js", "api.js", "data.js", "state.js", "ui.js"];
const USER = { "c2f-token": "t", "c2f-user": JSON.stringify({ id: 7 }) };
/* entries in the form of C2F.entryFromApi: n = nutrients of the entry, calculated by the server */
const entry = (id, m, g, name, k) => ({ id, day: "2026-11-20", m, g, name, n: { k, p: 10, c: 4, f: 2 } });

function setup({ elements = {}, ...options } = {}) {
  const storage = { ...USER, "commit2fit-v2-7": JSON.stringify({ profile: {}, fast: {} }) };
  return load(SCRIPTS, { storage, elements, ...options });
}

/* ---------- toast ---------- */

test("toast shows the message and hides it after 2.8 s", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const toast = { textContent: "", hidden: true };
  const { C2F } = setup({ elements: { "#toast": toast } });
  C2F.toast("Gespeichert");
  assert.equal(toast.textContent, "Gespeichert");
  assert.equal(toast.hidden, false);
  t.mock.timers.tick(2800);
  assert.equal(toast.hidden, true);
});

test("toast does nothing on pages without toast element", () => {
  const { C2F } = setup();
  assert.doesNotThrow(() => C2F.toast("x"));
});

test("flashToast keeps a message for the next page, showFlash shows and removes it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const toast = { textContent: "", hidden: true };
  const { C2F, session } = setup({ elements: { "#toast": toast } });
  C2F.flashToast("Hinzugefügt");
  assert.equal(session.data.get("c2f-toast"), "Hinzugefügt");

  C2F.showFlash();
  assert.equal(toast.textContent, "Hinzugefügt");
  assert.equal(session.data.has("c2f-toast"), false);

  toast.textContent = "";
  C2F.showFlash();
  assert.equal(toast.textContent, "");
});

test("flashToast and showFlash ignore a blocked sessionStorage", () => {
  const { C2F } = setup({ brokenSession: true });
  assert.doesNotThrow(() => C2F.flashToast("x"));
  assert.doesNotThrow(() => C2F.showFlash());
});

/* ---------- HTML parts ---------- */

test("alertHTML builds an escaped warning box", () => {
  const { C2F } = setup();
  const html = C2F.alertHTML({ lv: "warn", txt: "Fett > Ziel" });
  assert.match(html, /class="alert warn"/);
  assert.match(html, /Fett &gt; Ziel/);
});

test("setMacros fills values and bar widths (max. 100 %, 0 % without target)", () => {
  const elements = {};
  for (const k of ["p", "c", "f"]) {
    elements[`#d-${k}-val`] = { textContent: "" };
    elements[`#d-${k}-bar`] = { style: {} };
  }
  const { C2F } = setup({ elements });
  C2F.setMacros("d", { p: 50, c: 300, f: 10 }, { p: 100, c: 250, f: 0 });
  assert.equal(elements["#d-p-val"].textContent, "50 / 100 g");
  assert.equal(elements["#d-p-bar"].style.width, "50%");
  assert.equal(elements["#d-c-bar"].style.width, "100%");
  assert.equal(elements["#d-f-bar"].style.width, "0%");
});

test("loadingHTML and errorHTML build the status blocks; the error text is escaped and has a retry button", () => {
  const { C2F } = setup();
  assert.match(C2F.loadingHTML(), /role="status">Wird geladen/);
  const html = C2F.errorHTML("Der Server ist <nicht> erreichbar.");
  assert.match(html, /class="alert bad" role="alert"/);
  assert.match(html, /&lt;nicht&gt;/);
  assert.match(html, /data-act="retry"/);
});

test("bindRetry calls the function only for clicks on the retry button", () => {
  let handler;
  const container = { addEventListener: (type, fn) => { assert.equal(type, "click"); handler = fn; } };
  const { C2F } = setup();
  let tries = 0;
  C2F.bindRetry(container, () => { tries += 1; });

  handler({ target: { closest: () => null } });
  assert.equal(tries, 0);
  handler({ target: { closest: (sel) => (sel === '[data-act="retry"]' ? {} : null) } });
  assert.equal(tries, 1);
});

test("mealList groups the entries of a day by meal, with or without add links", () => {
  const entries = [entry(11, 0, 200, "Yogurt <b>", 120), entry(12, 0, 50, "Banane", 30), entry(13, 1, 100, "Reis", 130)];
  const { C2F } = setup();
  const html = C2F.mealList(entries, true);
  assert.equal((html.match(/<section class="meal">/g) || []).length, 4);
  assert.match(html, /Frühstück<\/h2><span class="mono sub">150 kcal/);
  assert.match(html, /Mittagessen<\/h2><span class="mono sub">130 kcal/);
  assert.match(html, /Yogurt &lt;b&gt;<\/b><small>200 g · E 10 · KH 4 · F 2 g/);
  assert.match(html, /data-id="11"/);
  assert.equal((html.match(/Noch nichts eingetragen/g) || []).length, 2);
  assert.match(html, /produkte\.html\?meal=3/);

  assert.doesNotMatch(C2F.mealList(entries, false), /Hinzufügen/);
  assert.equal((C2F.mealList([], false).match(/Noch nichts eingetragen/g) || []).length, 4);
});

/** bindDelete with a fake fetch; returns the click handler, the fake toast and the list of reloads. */
function deleteSetup(responses) {
  const calls = [];
  const queue = [...responses];
  const fetch = (url, init) => {
    calls.push({ url, method: init.method });
    return Promise.resolve(queue.shift());
  };
  const toast = { textContent: "", hidden: true };
  const { C2F } = setup({ fetch, elements: { "#toast": toast } });
  let handler;
  const container = { addEventListener: (type, fn) => { assert.equal(type, "click"); handler = fn; } };
  const reloads = [];
  C2F.bindDelete(container, () => reloads.push("reload"));
  return { handler, toast, reloads, calls };
}
const tick = () => new Promise((resolve) => setImmediate(resolve));

test("bindDelete deletes the entry on the server, then shows a message and reloads; other clicks are ignored", async () => {
  const { handler, toast, reloads, calls } = deleteSetup([reply(204)]);

  handler({ target: { closest: () => null } });
  assert.deepEqual(calls, []);

  const button = { dataset: { id: "42" }, disabled: false };
  handler({ target: { closest: () => button } });
  assert.equal(button.disabled, true);
  await tick();
  assert.deepEqual(calls, [{ url: "http://localhost:3000/intake/42", method: "DELETE" }]);
  assert.equal(toast.textContent, "Eintrag entfernt.");
  assert.equal(reloads.length, 1);

  // a button that is already waiting for its answer ignores further clicks
  handler({ target: { closest: () => button } });
  assert.equal(calls.length, 1);
});

test("bindDelete shows the error text and reloads so the page matches the server", async () => {
  const { handler, toast, reloads } = deleteSetup([reply(404, { error: "Entry not found" })]);
  handler({ target: { closest: () => ({ dataset: { id: "42" }, disabled: false }) } });
  await tick();
  assert.equal(toast.textContent, "Dieser Eintrag existiert nicht mehr.");
  assert.equal(reloads.length, 1);
});
