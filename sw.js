const CACHE_NAME = "piloto-cto-v14-share-target-post";

const ARCHIVOS_APP = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./share-target.html"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ARCHIVOS_APP))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  const rutaShareTarget = new URL("./share-target.html", self.registration.scope).pathname;
  const rutaShareAnterior = new URL("./", self.registration.scope).pathname;

if (
    request.method === "POST" &&
    url.origin === self.location.origin &&
    (url.pathname === rutaShareTarget || url.pathname === rutaShareAnterior)
  ) {
    event.respondWith(recibirArchivoCompartido(request));
    return;
  }

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
  let db = null;

  try {
    const formData = await request.formData();
    const diagnostico = diagnosticarRecepcion(request, formData);
    console.info("Diagnóstico temporal Web Share Target:", diagnostico);
    let archivo = null;

    for (const [, valor] of formData.entries()) {
      if (
        valor &&
        typeof valor !== "string" &&
        typeof valor.arrayBuffer === "function"
      ) {
        archivo = valor;
        break;
      }
    }

    if (!archivo) {
      return redirigirRecepcion(
        "&error=no-file&debug=" + encodeURIComponent(JSON.stringify(diagnostico))
      );
    }

    const nombre = String(archivo.name || "").trim();
    const nombreMinusculas = nombre.toLowerCase();
    const tipo = String(archivo.type || "").toLowerCase();
    const formatos = [
      [".pdf", "application/pdf"],
      [".kml", "application/vnd.google-earth.kml+xml"],
      [".kmz", "application/vnd.google-earth.kmz"]
    ];
    const extensionReconocida = formatos.find(([extension]) =>
      nombreMinusculas.endsWith(extension)
    );
    const formatoPorTipo = formatos.find(([, mime]) => tipo === mime);

    if (!extensionReconocida && !formatoPorTipo) {
      return redirigirRecepcion("&error=unsupported-file");
    }

    if (extensionReconocida && formatoPorTipo && extensionReconocida[1] !== formatoPorTipo[1]) {
      return redirigirRecepcion("&error=unsupported-file");
    }

    const formato = extensionReconocida || formatoPorTipo;
    const nombreFinal = nombreMinusculas.endsWith(formato[0])
      ? nombre
      : (nombre || "archivo-compartido") + formato[0];

    const buffer = await archivo.arrayBuffer();
    db = await abrirBaseDatos();
    const id = crearIdRecepcion();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction("files", "readwrite");
      const files = transaction.objectStore("files");

      // Elimina el formato anterior y guarda cada envío con una clave propia,
      // para que dos recepciones seguidas no se pisen ni recuperen datos viejos.
      files.delete("latest");
      files.put(
        {
          name: nombreFinal,
          type: tipo || "application/octet-stream",
          data: buffer,
          size: archivo.size || buffer.byteLength,
          receivedAt: Date.now(),
          id
        },
        id
      );

      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () =>
        reject(transaction.error || new Error("Transacción abortada"));
    });

    return redirigirRecepcion("&id=" + encodeURIComponent(id));

  } catch (error) {
    console.error("Error recibiendo archivo compartido:", error);

    return redirigirRecepcion("&error=processing");
  } finally {
    if (db) db.close();
  }
}

function diagnosticarRecepcion(request, formData) {
  const nombresHeaders = [
    "content-type",
    "content-length",
    "sec-fetch-mode",
    "sec-fetch-dest",
    "sec-fetch-site",
    "user-agent"
  ];
  const headers = {};

  for (const nombre of nombresHeaders) {
    const valor = request.headers.get(nombre);
    if (valor) {
      headers[nombre] = nombre === "content-type"
        ? valor.split(";")[0].trim()
        : nombre === "user-agent"
          ? resumirUserAgent(valor)
          : valor.slice(0, 180);
    }
  }

  const partes = [];

  for (const [nombre, valor] of formData.entries()) {
    if (valor && typeof valor !== "string" && typeof valor.arrayBuffer === "function") {
      const nombreArchivo = String(valor.name || "");
      const extension = nombreArchivo.match(/\.(pdf|kml|kmz)$/i);

      partes.push({
        name: nombre,
        kind: "file",
        mime: valor.type || "(vacío)",
        bytes: Number(valor.size) || 0,
        filenamePresent: Boolean(nombreArchivo),
        extension: extension ? "." + extension[1].toLowerCase() : "(sin extensión reconocida)"
      });
    } else {
      const texto = String(valor);

      partes.push({
        name: nombre,
        kind: "text",
        mime: "text/plain",
        chars: texto.length,
        containsContentUri: /content:\/\//i.test(texto),
        containsWebUrl: /https?:\/\//i.test(texto),
        containsSupportedFilename: /\.(pdf|kml|kmz)(?:\b|$)/i.test(texto)
      });
    }
  }

  return {
    method: request.method,
    path: new URL(request.url).pathname,
    headers,
    parts: partes
  };
}

function resumirUserAgent(userAgent) {
  const plataforma = /Android/i.test(userAgent) ? "Android" : "otra plataforma";
  const navegador = userAgent.match(/(?:Chrome|Chromium|EdgA|Firefox)\/[\d.]+/i);
  const esWebView = /\bwv\b/i.test(userAgent);

  return [plataforma, navegador ? navegador[0] : "navegador no identificado", esWebView ? "WebView" : ""]
    .filter(Boolean)
    .join(" ");
}

function redirigirRecepcion(parametros) {
  const destino = new URL("./?shared=1" + parametros, self.registration.scope);
  return Response.redirect(destino.href, 303);
}

function crearIdRecepcion() {
  if (self.crypto && typeof self.crypto.randomUUID === "function") {
    return self.crypto.randomUUID();
  }

  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}

function abrirBaseDatos() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("piloto-cto-share", 1);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("files")) {
        db.createObjectStore("files");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
