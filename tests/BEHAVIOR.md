# Comportamiento caracterizado antes de la refactorización

Estas pruebas fijan el contrato observable de la versión actual. La extracción de lógica debe conservar estos resultados salvo que una mejora v4 se acuerde explícitamente.

## Entrada y procesamiento

- El selector manual acepta PDF, KML y KMZ.
- Un KML se lee como texto. Un KMZ inspecciona sus KML internos, prioriza `doc.kml` y, en su ausencia, elige el nombre más corto. Si no hay KML, se informa el error actual.
- El parser XML rechaza documentos mal formados. Los `Placemark` se clasifican como CTO, cable o empalme usando sus nombres, metadatos y coordenadas.
- La relación KML busca el divisor/patilla y los empalmes asociados. Para el cable de llegada prioriza un cable de la misma línea cuyo extremo final conecte con la estructura de la CTO; si el KML no ofrece esa relación, intenta el tramo anterior y desempata por fibra cuando hay una coincidencia. La fibra mostrada procede del cable de llegada. El filtro de empalme limita resultados; los datos ausentes se representan con los textos actuales.
- Cada resultado KML mantiene separadas la identidad y los metadatos de la CTO y del EMP. La tabla y el CSV muestran número, ID, nombre y atributos disponibles propios del empalme, incluidos tipo, dirección, línea, líneas petición, fibra inicial/final, longitud, distancia, orden, fecha, unidades, UUID, estructuras y coordenadas.
- PDF.js conserva el texto y las posiciones de cada elemento. El parser espacial agrupa rótulos próximos a cada CTO y, cuando existe una anotación `DV,pin#fibra` compatible, la usa para resolver la fibra y asociar el cable de esa anotación; si no, conserva la heurística de proximidad. También obtiene descripción, referencias geográficas y enlace de búsqueda de Maps. Si el PDF no contiene posiciones, mantiene el parser de texto. Los resultados PDF se marcan como parciales cuando hay divisor y fibra.
- Los filtros CTO y empalme se aplican durante la extracción. Los resultados duplicados se combinan por CTO, empalme, divisor, patilla, fibra, cable y coordenadas; se fusionan evidencias y se cuenta cada duplicado descartado.
- Sin archivo manual, la interfaz pide seleccionar uno. Los resultados se pintan en la tabla, habilitan el CSV si no están vacíos y el estado indica los conteos.

## Salida e interfaz

- El CSV lleva BOM UTF-8, usa `;`, entrecomilla cada campo y duplica comillas interiores. El nombre actual es `resultados_cto_v2_3.csv`.
- Las ubicaciones KML generan enlace a coordenadas exactas; referencias PDF generan búsqueda aproximada. La acción de copiar usa coordenadas cuando existen y, si no, la referencia textual.
- El diagnóstico temporal de recepción muestra método, ruta, cabeceras permitidas, nombres de partes, tipo y metadatos resumidos; no muestra los valores de title/text ni el contenido de archivos.

## Recepción PWA/Android

- El manifest anuncia POST `multipart/form-data` a `./share-target.html` con el campo `file` y extensiones PDF/KML/KMZ; conserva `start_url`, `scope` y `file_handlers` para apertura directa.
- El Service Worker intercepta POST a la ruta canónica y también a la raíz heredada. Busca cualquier parte tipo archivo, valida extensión/MIME, guarda bytes en IndexedDB bajo un ID por envío y responde con una redirección al piloto con `shared=1&id=...`.
- Si el POST solo contiene texto, redirige con `error=no-file` y un diagnóstico saneado. Los tipos no admitidos o MIME/extensión contradictorios se rechazan.
- El piloto recupera el archivo de IndexedDB, lo asigna al selector existente, ejecuta la misma extracción manual y después borra el envío. El `launchQueue` permite además recibir archivos mediante File Handling.
- El Service Worker conserva estrategia GET cache-first, precache de la app y activación que elimina cachés antiguas.

## Alcance de estas pruebas

La batería usa Node.js, mocks de DOM, PDF.js, JSZip, IndexedDB y APIs de Service Worker. Es una línea base automatizada del código actual, no sustituye una prueba de instalación/share real en Android ni valida el render visual completo del navegador.

## Mejoras v4 caracterizadas

- La regresión CTO 22076 fija el cable de llegada A109/232 cuando el extremo de ese cable coincide con la estructura de la CTO; el mismo caso también verifica la extracción PDF por posiciones y la presentación en la tabla.
- En los documentos de referencia revisados, PDF y KML contienen revisiones distintas: el KML no contiene las CTO 22084, 22085, 22086 y 22080 del plano; además, hay diferencias de divisor/patilla y de cables en algunas CTO comunes. No se debe usar una fuente para completar automáticamente la otra sin confirmar la revisión.
- El análisis espacial de PDF es heurístico porque los planos colocan etiquetas junto a trazados y otras CTO. El conjunto automatizado usa elementos PDF.js posicionados simulados; la comprobación del PDF completo fue visual y con posiciones extraídas, no una prueba de integración dentro de Android.

## Mapa de módulos v4

- `app-core.js`: estado de sesión, utilidades y funciones comunes.
- `app-kml.js`: lectura/clasificación KML y selección del documento interno KMZ; relaciones con empalmes/cables.
- `app-pdf.js`: lectura PDF.js y análisis del texto por CTO.
- `app-processing.js`: creación de registros, deduplicación y flujo de extracción con filtros.
- `app-ui.js`: tabla, resumen, copia de ubicación, CSV y acción de limpiar.
- `app-share.js`: recepción Share Target/File Handling, recuperación IndexedDB, diagnóstico temporal y registro del Service Worker.
- `sw.js`: caché de los módulos y recepción POST de Android.

Ejecutar con `node tests/run.cjs`. Cada script de aplicación se precarga explícitamente desde el Service Worker y la caché tiene versión propia para que instalaciones anteriores actualicen los módulos.
