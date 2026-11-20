// T083: public functions of ui.js (toast, warnings, macro bars, meal list, delete buttons)
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

const SCRIPTS = ["util.js", "config.js", "api.js", "data.js", "state.js", "ui.js"];
const USER = { "c2f-token": "t", "c2f-user": JSON.stringify({ id: 7 }) };
const yogurt = { id: 1, name: "Yogurt <b>", k: 60, p: 10, c: 4, f: 2 };

function setup({ ue = [], elements = {}, ...options } = {}) {
  const storage = { ...USER, "commit2fit-v2-7": JSON.stringify({ profile: {}, fast: {}, ue }) };
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

test("mealList groups the entries of a day by meal, with or without add links", () => {
  const ue = [
    { id: "a", d: "2026-11-20", m: 0, g: 200, snap: yogurt },
    { id: "b", d: "2026-11-19", m: 1, g: 100, snap: yogurt },
  ];
  const { C2F } = setup({ ue });
  const html = C2F.mealList("2026-11-20", true);
  assert.equal((html.match(/<section class="meal">/g) || []).length, 4);
  assert.match(html, /Frühstück<\/h2><span class="mono sub">120 kcal/);
  assert.match(html, /Yogurt &lt;b&gt;/);
  assert.equal((html.match(/Noch nichts eingetragen/g) || []).length, 3);
  assert.match(html, /produkte\.html\?meal=3/);

  assert.doesNotMatch(C2F.mealList("2026-11-20", false), /Hinzufügen/);
});

test("bindDelete removes the clicked entry, saves and redraws; other clicks are ignored", () => {
  let handler;
  const container = { addEventListener: (type, fn) => { assert.equal(type, "click"); handler = fn; } };
  const ue = [
    { id: "a", d: "2026-11-20", m: 0, g: 100, snap: yogurt },
    { id: "b", d: "2026-11-20", m: 0, g: 100, snap: yogurt },
  ];
  const { C2F, storage } = setup({ ue });
  let redrawn = 0;
  C2F.bindDelete(container, () => { redrawn += 1; });

  handler({ target: { closest: () => null } });
  assert.equal(C2F.S.ue.length, 2);
  assert.equal(redrawn, 0);

  handler({ target: { closest: () => ({ dataset: { id: "a" } }) } });
  assert.deepEqual(C2F.S.ue.map((e) => e.id), ["b"]);
  assert.equal(redrawn, 1);
  assert.deepEqual(JSON.parse(storage.data.get("commit2fit-v2-7")).ue.map((e) => e.id), ["b"]);
});
