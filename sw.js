const CACHE_NAME = "piloto-cto-v8-share";
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
});self.addEventListener("fetch", event => {
const request = event.request;
const url = new URL(request.url);

// Recepción de archivos desde Android / WhatsApp
if (
request.method === "POST" &&
url.pathname.endsWith("/share-target")
) {
event.respondWith(recibirArchivoCompartido(request));
return;
}

// Funcionamiento normal de la aplicación
if (request.method === "GET") {
event.respondWith(
caches.match(request).then(cached => {
return cached || fetch(request);
})
);
}
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



async function recibirArchivoCompartido(request) {
try {
const formData = await request.formData();

let archivo = null;

// Android/WhatsApp puede usar distintos nombres para la parte del archivo.
const nombresArchivo = [
  "file",
  "files",
  "media",
  "attachment",
  "document"
];

for (const nombre of nombresArchivo) {
  const valores = formData.getAll(nombre);

  for (const valor of valores) {
    if (valor && typeof valor.arrayBuffer === "function") {
      archivo = valor;
      break;
    }
  }

  if (archivo) break;
}

// Último recurso: buscar cualquier Blob/File dentro del multipart.
if (!archivo) {
  for (const [nombre, valor] of formData.entries()) {
    if (
      valor &&
      typeof valor !== "string" &&
      typeof valor.arrayBuffer === "function"
    ) {
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
  const transaction = db.transaction(
    "files",
    "readwrite"
  );

  transaction.objectStore("files").put(
    {
      name:
        archivo.name ||
        "archivo-compartido",

      type:
        archivo.type ||
        "application/octet-stream",

      data: buffer,

      size:
        archivo.size ||
        buffer.byteLength,

      receivedAt: Date.now()
    },
    "latest"
  );

  transaction.oncomplete = resolve;

  transaction.onerror = () =>
    reject(transaction.error);
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

  if (
    !db.objectStoreNames.contains("files")
  ) {
    db.createObjectStore("files");
  }
};

request.onsuccess = () =>
  resolve(request.result);

request.onerror = () =>
  reject(request.error);

});
}
