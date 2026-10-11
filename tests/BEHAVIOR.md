# Comportamiento caracterizado antes de la refactorización

Estas pruebas fijan el contrato observable de la versión actual. La extracción de lógica debe conservar estos resultados salvo que una mejora v4 se acuerde explícitamente.

## Entrada y procesamiento

- El selector manual acepta PDF, KML y KMZ.
- Un KML se lee como texto. Un KMZ inspecciona sus KML internos, prioriza `doc.kml` y, en su ausencia, elige el nombre más corto. Si no hay KML, se informa el error actual.
- El parser XML rechaza documentos mal formados. Los `Placemark` se clasifican como CTO, cable o empalme usando sus nombres, metadatos y coordenadas.
- La relación KML busca el divisor/patilla y los empalmes asociados. Para el cable de llegada prioriza un cable de la misma línea cuyo extremo final conecte con la estructura de la CTO; si el KML no ofrece esa relación, intenta el tramo anterior y desempata por fibra cuando hay una coincidencia. La fibra mostrada procede del cable de llegada. El filtro de empalme limita resultados; los datos ausentes se representan con los textos actuales.
- Cada Placemark CTO y EMP se resuelve como un elemento independiente usando los mismos criterios de divisor, patilla y cable de llegada. Un KML con 16 CTO y 2 EMP debe producir 18 resultados, una fila por elemento, sin producto cruzado. La tabla usa una sola identidad (nombre de CTO o nomenclatura EMP) y las mismas columnas para ambos; los atributos extensos se pueden desplegar en evidencias. El CSV mantiene columnas genéricas para tipo, ID, línea, líneas petición, fibras, dirección, fecha, unidades, UUID, estructuras y coordenadas.
- En `registroKML`, `longitudElemento=NA` se trata como ausente; se hereda la longitud del cable conectado. La longitud mostrada es la del elemento cuando es un valor real y, si viene `NA` o vacía, la del cable de llegada.
- Modo circuito (KML sin CTOs y con empalmes, p. ej. circuito `THCli ..._DNG.kml`): los elementos de equipo (`C_EMP`, `ELFO:REP_F`, `ELFO:TM_FO`) son los protagonistas en lugar de filtrarse. Producen fila **todas** las entradas de `datos.empalmes` más los elementos `REP_F`/`TM_FO` que tengan `ordenTramo` válido, ordenadas por `ordenTramo`, sin filtrar por nombre, tipo ni por estar clasificados como cable. (Un empalme cuyo `nombreElemento` contiene la palabra `FO` en su descriptor de capacidad —p. ej. `Nº 7579 C-E 64 FO`— sigue siendo equipo, no cable: la pertenencia se decide por `datos.empalmes` o por el patrón `REP_F|TM_FO`, no por la clasificación de cables.) Se agrupan en cadenas por `nombreLinea + unidadAlta` y se ordenan por `ordenTramo`. Para cada equipo, el tramo entrante es el cable inmediatamente anterior y el saliente el inmediatamente siguiente (si son cables); `fibra` se muestra como `fibEntrante->fibSaliente` (p. ej. `21->1`) y, si no hay saliente, solo `fibEntrante`. `cable` es el `nombreElemento` del tramo saliente; `descripcionCable` y `etiquetaCable` unen entrante y saliente con ` -> ` (la etiqueta cable es solo esa forma `entrante -> saliente`, sin una línea suelta que repita el entrante); `longitud` es la del cable saliente y `distancia` la `distanciaAcumulada` del elemento. `divisor`/`patilla` quedan en `No disponible`. Las evidencias recogen la ruta completa de la cadena (una línea por `ordenTramo` con `orden nombreElemento fibIni longitudElemento`) y una línea final `Circuito <nombreLinea> <unidadAlta> · destino: <nombreElemento último>`. El diagnóstico "Elementos con coordenadas" cuenta los equipos de la cadena con punto (p. ej. 7). Si hay CTOs, se mantiene el comportamiento actual; un KML sin CTOs ni EMP sigue dando 0 resultados.
- Modo proyecto (KML/KMZ XML2KMZ con estilos `#IconCtoPDA`, `#IconEmpalmeFo*`, `#IconFo*` y nombres `O-xxxxx` / `E-xxxxx`, sin `ExtendedData` en CTO/EMP): `divisor`/`patilla`/`fibra`/`cable`/`longitud` provienen del campo `Asignacion` de los tramos FO y de la geometría. Se detecta proyecto si algún placemark tiene `styleUrl` `IconCto|IconEmpalmeFo|IconFo` o nombre `^O-\d+` / `^E-\d+`. CTO = `IconCto` o `^O-`; EMP = todos los `IconEmpalmeFo` o `^E-`; cables = `IconFo` con `LineString` (los rótulos `#IconTextFo`, que son `Point`, se excluyen). El enlace nodo-tramo usa la geometría: el punto del nodo coincide con el primer o último vértice del `LineString` (tolerancia 1e-6).
  - Regla de diferencia: lo que un nodo consume es la diferencia de asignación entre el tramo entrante y los salientes. Con un solo tramo conectado (hoja) se muestran sus líneas DV tal cual. Con dos o más tramos que tengan líneas DV, el entrante es el de mayor suma de patillas y los demás son salientes; por divisor, las patillas/fibras conservadas son las del entrante menos la unión de los salientes, emparejadas por orden (patilla como rango si es contigua, fibras unidas con `+`); las fibras sobrantes pasan a evidencias como `Fibras sin patilla asignada`. Si solo un tramo tiene líneas DV y el nodo no es hoja, el divisor queda vacío y las líneas DV/otras van a evidencias.
  - `Asignacion` se normaliza (`normalizarGuiones`: guiones U+2010..U+2015 y U+2212 a `-`, y secuencias mojibake `â` + 1-3 caracteres de control/U+FFFD/espacio) uniendo líneas de continuación; cada línea `DV-n,patillas#fibras` se parsea (`expandirLista` despliega `1-4` y `1+3+5`); las líneas que no encajan (`BALM.`, `ABA.`, `MUSK.`, `NFM`, vacías) van a `otras[]` y se reportan en evidencias.
  - `Etiqueta cable` = etiquetas `A\d+/\d+` de los segmentos unidas por `, `; `descripcionCable` = `fo + " FO"` (número inicial del nombre del primer segmento); `longitud` y estado del primer segmento. Si `divisorPatilla()` ya extrae divisor por texto, ese manda y no se pisa.
- PDF.js conserva el texto y las posiciones de cada elemento. El parser espacial agrupa rótulos próximos a cada CTO y, cuando existe una anotación `DV,pin#fibra` compatible, la usa para resolver la fibra y asociar el cable de esa anotación; si no, conserva la heurística de proximidad. También obtiene descripción, referencias geográficas y enlace de búsqueda de Maps. Si el PDF no contiene posiciones, mantiene el parser de texto. Los resultados PDF se marcan como parciales cuando hay divisor y fibra.
- Los filtros CTO y empalme se aplican durante la extracción. Los resultados duplicados se combinan por CTO, empalme, divisor, patilla, fibra, cable y coordenadas; se fusionan evidencias y se cuenta cada duplicado descartado.
- Sin archivo manual, la interfaz pide seleccionar uno. Los resultados se pintan en la tabla, habilitan el CSV si no están vacíos y el estado indica los conteos.

## Salida e interfaz

- La tabla de resultados y el CSV exponen `Longitud` y `Distancia` como columnas propias situadas justo después de `Etiqueta cable` (recuperadas como en v4). En la tabla, la columna `Etiqueta cable` muestra únicamente `cable` y `descripción` para los registros KML (etiqueta cable limpia), dejando la longitud y la distancia en sus columnas dedicadas.
- El CSV lleva BOM UTF-8, usa `;`, entrecomilla cada campo y duplica comillas interiores. El nombre actual es `resultados_cto_v2_3.csv`.
- Las ubicaciones KML generan enlace a coordenadas exactas; referencias PDF generan búsqueda aproximada. La acción de copiar usa coordenadas cuando existen y, si no, la referencia textual.
- El diagnóstico temporal de recepción muestra método, ruta, cabeceras permitidas, nombres de partes, tipo y metadatos resumidos; no muestra los valores de title/text ni el contenido de archivos.

## Recepción PWA/Android

- El manifest anuncia POST `multipart/form-data` a `./share-target.html` con el campo `file` y extensiones PDF/KML/KMZ; conserva `start_url`, `scope` y `file_handlers` para apertura directa.
- El Service Worker intercepta POST a la ruta canónica y también a la raíz heredada. Busca cualquier parte tipo archivo, valida extensión/MIME, guarda bytes en IndexedDB bajo un ID por envío y responde con una redirección al piloto con `shared=1&id=...`.
- Si el POST solo contiene texto, redirige con `error=no-file` y un diagnóstico saneado. Los tipos no admitidos o MIME/extensión contradictorios se rechazan.
- El piloto registra el Service Worker desde la cabecera, antes de cargar las bibliotecas externas; al abrir una URL compartida, recupera IndexedDB inmediatamente sin esperar al evento `load`. Si todavía no aparece el envío, reintenta durante cinco segundos conservando el ID en la URL. `pageshow` y `visibilitychange` vuelven a comprobar la recepción si Android reactiva la PWA. Al completarlo, asigna el archivo al selector existente, ejecuta la misma extracción y borra el envío. El `launchQueue` permite además recibir archivos mediante File Handling.
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
