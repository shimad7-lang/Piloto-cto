const CACHE = "piloto-cto-final-v2";

const SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./share-target.html",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(k => k !== CACHE)
            .map(k => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function saveSharedFile(request) {
  const form = await request.formData();

  let file = form.get("archivo");

  if (!file || typeof file.arrayBuffer !== "function") {
    for (const value of form.values()) {
      if (value && typeof value.arrayBuffer === "function") {
        file = value;
        break;
      }
    }
  }

  if (!file || typeof file.arrayBuffer !== "function") {
    return;
  }

  const data = await file.arrayBuffer();

  const db = await new Promise((resolve, reject) => {
    const r = indexedDB.open("piloto-cto-share", 1);

    r.onupgradeneeded = () => {
      r.result.createObjectStore("files");
    };

    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });

  await new Promise((resolve, reject) => {
    const tx = db.transaction("files", "readwrite");

    tx.objectStore("files").put({
      name: file.name || "archivo",
      type: file.type || "application/octet-stream",
      size: data.byteLength,
      receivedAt: Date.now(),
      data
    }, "latest");

    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });

  db.close();
}

self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);

  if (
    e.request.method === "POST" &&
    url.pathname.endsWith("/share-target.html")
  ) {
    e.respondWith(
      saveSharedFile(e.request)
        .then(() =>
          Response.redirect(
            new URL("./?shared=1", e.request.url).href,
            303
          )
        )
        .catch(() =>
          Response.redirect(
            new URL("./?shared=1&error=1", e.request.url).href,
            303
          )
        )
    );
    return;
  }

  if (e.request.method !== "GET") {
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request);
    })
  );
});
