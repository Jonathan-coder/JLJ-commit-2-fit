// T083: loads the browser scripts of the frontend in Node, with small fakes for the browser APIs they use.
// Every call starts from a clean state, like a fresh page load.
const path = require("node:path");

function fakeStorage(initial = {}, { broken = false } = {}) {
  const data = new Map(Object.entries(initial));
  const fail = () => {
    throw new Error("storage disabled");
  };
  return {
    data,
    getItem: broken ? fail : (k) => (data.has(k) ? data.get(k) : null),
    setItem: broken ? fail : (k, v) => data.set(k, String(v)),
    removeItem: broken ? fail : (k) => data.delete(k),
  };
}

function setGlobal(name, value) {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/**
 * Load scripts from frontend/js in this order (like the <script> tags of a page).
 * Options: storage / session (initial values), brokenStorage, location (protocol, hostname, pathname),
 * fetch (fake), elements (selector -> fake element for document.querySelector).
 */
function load(files, options = {}) {
  const storage = fakeStorage(options.storage, { broken: options.brokenStorage });
  const session = fakeStorage(options.session, { broken: options.brokenSession });
  const replaced = [];
  const elements = options.elements || {};

  setGlobal("window", {});
  setGlobal("localStorage", storage);
  setGlobal("sessionStorage", session);
  setGlobal("location", {
    protocol: "http:",
    hostname: "localhost",
    pathname: "/heute.html",
    ...options.location,
    replace: (url) => replaced.push(url),
  });
  setGlobal("document", { querySelector: (selector) => elements[selector] || null });
  setGlobal("fetch", options.fetch || (() => Promise.reject(new Error("no fetch in this test"))));

  for (const file of files) {
    const full = path.join(__dirname, "..", "js", file);
    delete require.cache[require.resolve(full)];
    require(full);
  }
  return { C2F: globalThis.window.C2F, storage, session, replaced };
}

/** Fake fetch answer: status and JSON body (or raw text). */
function reply(status, body) {
  const text = body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body);
  return { ok: status >= 200 && status < 300, status, text: () => Promise.resolve(text) };
}

module.exports = { load, reply };
