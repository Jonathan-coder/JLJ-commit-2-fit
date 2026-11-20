// T083: public functions of util.js and config.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { load } = require("./helpers.cjs");

test("pad adds a leading zero only to one-digit numbers", () => {
  const { C2F } = load(["util.js"]);
  assert.equal(C2F.pad(5), "05");
  assert.equal(C2F.pad(12), "12");
});

test("dk, dayKey and dateOf convert between Date and 'YYYY-MM-DD'", (t) => {
  const { C2F } = load(["util.js"]);
  assert.equal(C2F.dk(new Date(2026, 0, 9)), "2026-01-09");
  assert.deepEqual(C2F.dateOf("2026-11-20"), new Date(2026, 10, 20));

  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 10, 20, 12, 0) });
  assert.equal(C2F.dayKey(0), "2026-11-20");
  assert.equal(C2F.dayKey(1), "2026-11-19");
});

test("fmt formats numbers in German with and without decimals", () => {
  const { C2F } = load(["util.js"]);
  assert.equal(C2F.fmt(1234.567), "1.235");
  assert.equal(C2F.fmt(2.345, 1), "2,3");
});

test("esc escapes all HTML special characters", () => {
  const { C2F } = load(["util.js"]);
  assert.equal(C2F.esc(`<a href="x">Tom & Jerry's</a>`), "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;");
  assert.equal(C2F.esc(42), "42");
});

test("num limits a number to a range and uses the default for invalid input", () => {
  const { C2F } = load(["util.js"]);
  assert.equal(C2F.num("50", 10, 100, 1), 50);
  assert.equal(C2F.num(5, 10, 100, 1), 10);
  assert.equal(C2F.num(500, 10, 100, 1), 100);
  assert.equal(C2F.num("abc", 10, 100, 1), 1);
});

test("$ returns the element for a selector", () => {
  const el = { id: "x" };
  const { C2F } = load(["util.js"], { elements: { "#x": el } });
  assert.equal(C2F.$("#x"), el);
  assert.equal(C2F.$("#missing"), null);
});

test("icons.star is filled when active and outlined when not", () => {
  const { C2F } = load(["util.js"]);
  assert.match(C2F.icons.star(true), /fill="currentColor"/);
  assert.match(C2F.icons.star(false), /fill="none"/);
});

test("util.js keeps an existing C2F object", () => {
  const { C2F } = load(["util.js", "util.js"]);
  assert.equal(typeof C2F.pad, "function");
});

/* ---------- config.js ---------- */

test("API_BASE uses the host of the page with port 3000 for http and https", () => {
  for (const protocol of ["http:", "https:"]) {
    const { C2F } = load(["config.js"], { location: { protocol, hostname: "192.168.0.10" } });
    assert.equal(C2F.API_BASE, `${protocol}//192.168.0.10:3000`);
  }
});

test("API_BASE is localhost:3000 when the page is opened as a file", () => {
  const { C2F } = load(["config.js"], { location: { protocol: "file:", hostname: "" } });
  assert.equal(C2F.API_BASE, "http://localhost:3000");
});

test("API_BASE can be overridden in localStorage, without trailing slashes", () => {
  const { C2F } = load(["config.js"], { storage: { "c2f-api": "http://server:4000//" } });
  assert.equal(C2F.API_BASE, "http://server:4000");
});

test("API_BASE ignores a blocked localStorage and keeps an existing C2F object", () => {
  const { C2F } = load(["util.js", "config.js"], { brokenStorage: true });
  assert.equal(C2F.API_BASE, "http://localhost:3000");
  assert.equal(typeof C2F.pad, "function");
});
