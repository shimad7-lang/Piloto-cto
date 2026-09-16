const CACHE_NAME = "piloto-cto-v3";

const ARCHIVOS_APP = [
  "./",
  "./index.html",
  "./manifest.webmanifest"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS_APP))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new 
    URL(request.url);
// RECEPCIÓN DESDE WHATSAPP / COMPARTIR
if (
  request.method === "POST" &&
  url.pathname.endsWith("/share-target.html")
) {
  event.respondWith(recibirArchivoCompartido(request));
  return;
}
  // FUNCIONAMIENTO NORMAL
  if (request.method === "GET") {
    event.respondWith(
      caches.match(request).then(cached => {
        return cached || fetch(request);
      })
    );
  }
});

async function recibirArchivoCompartido(request) {
  try {
    const formData = await request.formData();

    let archivo = formData.get("file");

    // Si Android utiliza otro nombre, buscamos cualquier archivo.
    if (!archivo || typeof archivo.arrayBuffer !== "function") {
      for (const valor of formData.values()) {
        if (valor && typeof valor.arrayBuffer === "function") {
          archivo = valor;
          break;
        }
      }
    }

    if (!archivo || typeof archivo.arrayBuffer !== "function") {
      return Response.redirect(
        "./?shared=1&error=no-file",
        303
      );
    }

    const buffer = await archivo.arrayBuffer();

    const db = await abrirBaseDatos();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");

      transaction.objectStore("files").put(
        {
          name: archivo.name || "archivo-compartido",
          type: archivo.type || "application/octet-stream",
          data: buffer,
          size: archivo.size || buffer.byteLength,
          receivedAt: Date.now()
        },
        "latest"
      );

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });

    db.close();

    return Response.redirect(
      "./?shared=1",
      303
    );

  } catch (error) {
    console.error(
      "Error recibiendo archivo compartido:",
      error
    );

    return Response.redirect(
      "./?shared=1&error=processing",
      303
    );
  }
}

function abrirBaseDatos() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(
      "piloto-cto-share",
      1
    );

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files");
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}
