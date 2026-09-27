const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { ROOT } = require("./helpers.cjs");

function loadWorker() {
  const listeners = {};
  const stored = new Map();
  const cache = { addAll: async paths => { cache.precached = paths; } };
  const caches = {
    opened: [],
    async open(name) { caches.opened.push(name); return cache; },
    async keys() { return ["old-cache", "piloto-cto-v19-v4-share-first"]; },
    async delete(name) { caches.deleted = [...(caches.deleted || []), name]; return true; },
    async match(request) { caches.matched = request; return null; }
  };
  const db = {
    objectStoreNames: { contains: name => name === "files" },
    createObjectStore() {},
    close() {},
    transaction(name, mode) {
      return {
        objectStore() {
          return {
            delete(key) { stored.delete(key); },
            put(value, key) { stored.set(key, value); }
          };
        },
        set oncomplete(fn) { queueMicrotask(fn); },
        set onerror(fn) { this._error = fn; },
        set onabort(fn) { this._abort = fn; },
        name, mode
      };
    }
  };
  const indexedDB = { open(name, version) {
    const req = { result: db };
    queueMicrotask(() => req.onsuccess?.());
    return req;
  } };
  const self = {
    addEventListener(type, callback) { listeners[type] = callback; },
    skipWaiting: async () => { self.skipped = true; },
    clients: { claim: async () => { self.claimed = true; } },
    registration: { scope: "https://example.test/Piloto-cto/" },
    location: { origin: "https://example.test" },
    crypto: { randomUUID: () => "share-id-123" }
  };
  const context = { self, caches, indexedDB, URL, Response, console: { info() {}, error() {} }, fetch: async request => ({ fetched: request }) };
  const filename = path.join(ROOT, "sw.js");
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), context, { filename });
  return { listeners, stored, caches, self, cache };
}

function request({ path: pathname = "/Piloto-cto/share-target.html", entries = [], headers = {} } = {}) {
  return {
    url: "https://example.test" + pathname,
    method: "POST",
    headers: { get: name => headers[name] || null },
    formData: async () => ({ entries: () => entries[Symbol.iterator]() })
  };
}

async function dispatchFetch(worker, req) {
  const event = { request: req, respondWith(promise) { this.response = promise; } };
  worker.listeners.fetch(event);
  return event.response;
}

test("install precachea aplicación y ruta share-target; activate elimina caché anterior", async () => {
  const worker = loadWorker();
  const install = { waitUntil(promise) { this.done = promise; } };
  worker.listeners.install(install);
  await install.done;
  assert.deepEqual(worker.caches.opened, ["piloto-cto-v20-v4-elementos-share-retry"]);
  assert.deepEqual(Array.from(worker.cache.precached), ["./", "./index.html", "./app-core.js", "./app-kml.js", "./app-pdf.js", "./app-processing.js", "./app-ui.js", "./app-share.js", "./manifest.webmanifest", "./share-target.html"]);
  assert.equal(worker.self.skipped, true);

  const activate = { waitUntil(promise) { this.done = promise; } };
  worker.listeners.activate(activate);
  await activate.done;
  assert.deepEqual(worker.caches.deleted, ["old-cache", "piloto-cto-v19-v4-share-first"]);
  assert.equal(worker.self.claimed, true);
});

test("POST canonical guarda el PDF bajo ID único y redirige al piloto con shared=1", async () => {
  const worker = loadWorker();
  const bytes = Uint8Array.from([37, 80, 68, 70]);
  const file = { name: "plan.pdf", type: "application/pdf", size: bytes.length, arrayBuffer: async () => bytes.buffer };
  const response = await dispatchFetch(worker, request({ entries: [["file", file], ["title", "Plan"]] }));
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("location"), "https://example.test/Piloto-cto/?shared=1&id=share-id-123");
  assert.equal(worker.stored.has("share-id-123"), true);
  assert.equal(worker.stored.get("share-id-123").name, "plan.pdf");
  assert.equal(worker.stored.get("share-id-123").size, 4);
});

test("POST legado a la raíz sigue aceptado", async () => {
  const worker = loadWorker();
  const file = { name: "red.kml", type: "application/vnd.google-earth.kml+xml", size: 4, arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer };
  const response = await dispatchFetch(worker, request({ path: "/Piloto-cto/", entries: [["file", file]] }));
  assert.equal(response.status, 303);
  assert.match(response.headers.get("location"), /\?shared=1&id=share-id-123$/);
  assert.equal(worker.stored.get("share-id-123").name, "red.kml");
});

test("POST text-only informa no-file con diagnóstico de partes y sin sus valores", async () => {
  const worker = loadWorker();
  const response = await dispatchFetch(worker, request({
    entries: [["title", "Documento confidencial"], ["text", "contenido sensible"]],
    headers: { "content-type": "multipart/form-data; boundary=abc", "user-agent": "Android Chrome/123" }
  }));
  const location = response.headers.get("location");
  assert.match(location, /error=no-file/);
  const diagnostic = JSON.parse(new URL(location).searchParams.get("debug"));
  assert.deepEqual(diagnostic.parts.map(p => p.name), ["title", "text"]);
  assert.equal(diagnostic.parts[0].chars, 22);
  assert.equal(diagnostic.headers["content-type"], "multipart/form-data");
  assert.equal(decodeURIComponent(location).includes("contenido sensible"), false);
});

test("rechaza formatos no compatibles y nombres/MIME contradictorios", async () => {
  const worker = loadWorker();
  const unsupported = await dispatchFetch(worker, request({ entries: [["file", { name: "foto.jpg", type: "image/jpeg", size: 1, arrayBuffer: async () => new ArrayBuffer(1) }]] }));
  assert.match(unsupported.headers.get("location"), /error=unsupported-file/);
  const mismatch = await dispatchFetch(worker, request({ entries: [["file", { name: "plan.pdf", type: "application/vnd.google-earth.kml+xml", size: 1, arrayBuffer: async () => new ArrayBuffer(1) }]] }));
  assert.match(mismatch.headers.get("location"), /error=unsupported-file/);
  assert.equal(worker.stored.size, 0);
});

test("GET conserva la estrategia cache-first y deja pasar al origen cuando falta caché", async () => {
  const worker = loadWorker();
  const req = { method: "GET", url: "https://example.test/Piloto-cto/index.html" };
  const event = { request: req, respondWith(promise) { this.response = promise; } };
  worker.listeners.fetch(event);
  const response = await event.response;
  assert.equal(response.fetched, req);
  assert.equal(worker.caches.matched, req);
});

test("manifest mantiene recepción multipart con el campo file y apertura directa", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, "manifest.webmanifest"), "utf8"));
  assert.equal(manifest.start_url, "./?source=pwa");
  assert.equal(manifest.scope, "./");
  assert.equal(manifest.share_target.action, "./share-target.html");
  assert.equal(manifest.share_target.method, "POST");
  assert.equal(manifest.share_target.enctype, "multipart/form-data");
  assert.deepEqual(manifest.share_target.params.files.map(x => x.name), ["file"]);
  assert.equal(manifest.file_handlers[0].action, "./");
});
