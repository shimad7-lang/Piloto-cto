const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { ROOT, loadApp, supportedKml } = require("./helpers.cjs");

const plain = value => JSON.parse(JSON.stringify(value));

test("selección manual conserva PDF, KML y KMZ", () => {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const input = html.match(/<input\s+id="archivo"[^>]*>/i)?.[0] || "";
  assert.match(input, /\.pdf/i);
  assert.match(input, /\.kml/i);
  assert.match(input, /\.kmz/i);
  const earlyServiceWorkerRegistration=html.indexOf('navigator.serviceWorker.register("./sw.js")');
  const pdfLibrary=html.indexOf('src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js');
  assert.ok(earlyServiceWorkerRegistration>=0&&earlyServiceWorkerRegistration<pdfLibrary);
  assert.deepEqual([...html.matchAll(/<script\s+src="(\.\/app-[^"]+\.js)"/g)].map(m => m[1]), [
    "./app-core.js", "./app-kml.js", "./app-pdf.js", "./app-processing.js", "./app-ui.js", "./app-share.js"
  ]);
});

test("normalización, listas, cable, CTO y enlaces conservan sus reglas", () => {
  const { api } = loadApp();
  assert.equal(api.limpiarTexto("  CTO\n   ÁRBOL  "), "CTO ÁRBOL");
  assert.equal(api.normalizar(" CTO-á 12 "), "CTOA12");
  assert.deepEqual(plain(api.lista("CTO123, 456; 007")), ["123", "456", "007"]);
  assert.deepEqual(plain(api.separarCable("FO: Troncal, A12/24 reserva")), {
    descripcion: "FO: Troncal", cable: "A12/24 reserva"
  });
  assert.equal(api.numeroCTO("Armario CTO nº 123 sector", "id-1"), "123");
  assert.equal(api.numeroCTO("sin número", "id-1"), "id-1");
  assert.equal(api.enlaceMaps("", "-3"), "");
  assert.equal(api.enlaceMaps("40.4", "-3.7"), "https://www.google.com/maps/search/?api=1&query=40.4%2C-3.7");
});

test("KML resuelve CTO y EMP como filas independientes con identidad compartida", () => {
  const app = loadApp();
  const { api } = app;
  const datos = api.analizarKML(supportedKml());
  assert.equal(datos.elementos.length, 3);
  assert.equal(datos.ctos.length, 1);
  assert.equal(datos.cables.length, 1);
  assert.equal(datos.empalmes.length, 1);
  assert.equal(datos.ctos[0].lon, "-3.7");
  assert.equal(datos.ctos[0].lat, "40.4");
  assert.equal(datos.cables[0].cable, "A1/2");

  const cto = plain(api.registroKML(datos.ctos[0], datos, ""))[0];
  const empalme = plain(api.registroKML(datos.empalmes[0], datos, ""))[0];
  assert.equal(cto.tipoRegistro, "CTO");
  assert.equal(cto.elemento, "CTO 123");
  assert.equal(cto.cto, "123");
  assert.equal(cto.divisor, "DV-7");
  assert.equal(cto.patilla, "4");
  assert.equal(cto.cable, "A1/2");
  assert.equal(cto.lat, "40.4");
  assert.equal(cto.estado, "Completa");
  assert.equal(empalme.tipoRegistro, "EMP");
  assert.equal(empalme.elemento, "Empalme N 5 DV-7, 4");
  assert.equal(empalme.idElemento, "splice-1");
  assert.equal(empalme.divisor, "DV-7");
  assert.equal(empalme.patilla, "4");
  assert.equal(empalme.fibIni, "2");
  assert.equal(empalme.fibFin, "3");
  assert.equal(empalme.lat, "40.3");
  assert.equal(empalme.lon, "-3.6");
  assert.equal(empalme.referencia, "40.3, -3.6");
  assert.equal(api.registroKML(datos.ctos[0], datos, "E999").length, 0);
  assert.equal(api.registroKML(datos.empalmes[0], datos, "E999").length, 0);
  assert.equal(api.registroKML(datos.empalmes[0], datos, "5").length, 1);

  api.setState({ registros: [cto,empalme] });
  api.pintar();
  assert.match(app.elements.get("tabla").innerHTML, /Empalme N 5/);
  assert.equal((app.elements.get("tabla").innerHTML.match(/<tr>/g)||[]).length,2);
  assert.match(app.elements.get("tabla").innerHTML, /Evidencias|Ver \d+ datos/);
  const html=fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  assert.match(html, /<th>Elemento CTO \/ EMP<\/th>/);
  assert.doesNotMatch(html, /<th>(?:Nº EMP|ID EMP|Datos EMP)<\/th>/);
  assert.doesNotMatch(html, /datos-empalme|entidad-identidad/);
});

test("la salida CSV usa columnas compartidas y conserva metadatos del EMP", async () => {
  const { api, links } = loadApp();
  api.setState({ registros: [{
    tipoRegistro: "EMP", elemento: "Empalme N 5", idElemento: "splice-1",
    empalme: "5", idEmpalme: "splice-1",
    nombreEmpalme: "Empalme N 5", datosEmpalme: "Fibra: 2–3 · UUID: uuid-emp-5",
    tipoEmpalme: "EQUIPMENT", lineaEmpalme: "Linea 1", lineasPeticionEmpalme: "DV-7,4",
    fibIniEmpalme: "2", fibFinEmpalme: "3", longitudEmpalme: "18 m",
    distanciaEmpalme: "105", ordenEmpalme: "7", direccionEmpalme: "DOWN",
    fechaInstalacionEmpalme: "2015-10-21", unidadAltaEmpalme: "4", unidadBajaEmpalme: "3",
    noTeEmpalme: "", uuidEmpalme: "uuid-emp-5", latEmpalme: "40.3", lonEmpalme: "-3.6",
    estructuraInicioEmpalme: "Arqueta 1", estructuraFinalEmpalme: "Arqueta 2",
    divisor: "DV-7", patilla: "4", fibra: "12", cable: "A1/2", descripcionCable: "8 FO",
    tipoElemento: "Cable", longitud: "200 m", distancia: "200", ubicacion: "Exacta",
    referencia: "40.4,-3.7", maps: "", estado: "Completa", evidencias: []
  }] });
  api.descargarCSV();
  const bytes = new Uint8Array(await links[0].blob.arrayBuffer());
  const text = new TextDecoder().decode(bytes.slice(3));
  assert.match(text, /"Elemento CTO \/ EMP";"Tipo elemento";"ID elemento"/);
  assert.match(text, /"Empalme N 5";"EMP";"splice-1"/);
  assert.match(text, /"DOWN";"2015-10-21";"7";"4";"3"/);
});

test("KML muestra 18 elementos como 18 filas independientes, sin cruces CTO × EMP", async () => {
  const placemark=(type,index)=>{
    const emp=type==="EMP";
    const id=(emp?"emp-":"cto-")+index;
    const name=emp?"C_EMP::"+id:"ELFO:CTO::"+id;
    const elementName=emp?`E8548 C-E UC ${index} BD MFT`:`CTO EXT Nº ${22000+index}`;
    const divisor=`DV-${300+index}, 1`;
    return `<Placemark id="${id}"><name>${name}</name><ExtendedData>`+
      `<Data name="nombreElemento"><value>${elementName}</value></Data>`+
      `<Data name="elementType"><value>EQUIPMENT</value></Data>`+
      `<Data name="lineasPeticion"><value>${divisor}</value></Data>`+
      `<Data name="nombreLinea"><value>DV-${300+index}</value></Data>`+
      `<Data name="ordenTramo"><value>2</value></Data>`+
      `<Data name="fibIni"><value>1</value></Data>`+
      `<Data name="fibFin"><value>1</value></Data>`+
      `</ExtendedData></Placemark>`;
  };
  const xml=`<kml><Document>${Array.from({length:16},(_,i)=>placemark("CTO",i+1)).join("")}`+
    `${Array.from({length:2},(_,i)=>placemark("EMP",i+1)).join("")}</Document></kml>`;
  const { api, document }=loadApp();
  document.getElementById("archivo").files=[{name:"18-elementos.kml",text:async()=>xml}];
  await api.extraer();
  assert.match(document.getElementById("estado").textContent,/Resultados: 18/);
  const rows=api.getState().registros;
  assert.equal(rows.filter(row=>row.tipoRegistro==="CTO").length,16);
  assert.equal(rows.filter(row=>row.tipoRegistro==="EMP").length,2);
  assert.equal(new Set(rows.map(row=>row.idElemento)).size,18);
  assert.equal(new Set(rows.map(row=>row.elemento)).size,18);
  assert.match(document.getElementById("tabla").innerHTML,/E8548 C-E UC 1 BD MFT/);
});

test("CTO 22076 selecciona el cable del tramo anterior cuya fibra coincide", () => {
  const { api } = loadApp();
  const toCable = (id, nombreElemento, orden, fibra) => {
    const separado = api.separarCable(nombreElemento);
    return {
      id, name: `FO:AER::${id}`, nombreElemento, nombreLinea: "DV-27212",
      lineasPeticion: `DV-27212, ${fibra} (${fibra})`, orden: String(orden),
      fibIni: String(fibra), fibFin: String(fibra), longitud: "140",
      cable: separado.cable, descripcionCable: separado.descripcion
    };
  };
  const cto = {
    id: "15681471", name: "ELFO:CTO::15681471", nombreElemento: "CTO EXT Nº 22076",
    nombreLinea: "DV-27212", lineasPeticion: "DV-27212, 2 (1)", orden: "23",
    fibIni: "1", fibFin: "1", lat: "43.29194660000002", lon: "-3.0163505"
  };
  const candidates = [
    toCable("12161497", "24 FO AER, A109/231", 19, 1),
    toCable("10465606", "24 FO AER, A109/231", 20, 1),
    toCable("16662005", "24 FO AER, A109/233", 21, 13),
    toCable("10434971", "24 FO AER, A109/234", 22, 17),
    toCable("10434969", "8 FO AER, A109/232", 22, 1)
  ];

  const selected = plain(api.buscarCables(candidates, cto));
  assert.equal(selected.length, 1);
  assert.equal(selected[0].id, "10434969");
  assert.equal(selected[0].cable, "A109/232");

  const rows = plain(api.registroKML(cto, { cables: candidates, empalmes: [] }, ""));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cable, "A109/232");
});

test("KML prioriza el cable cuyo extremo final conecta con la estructura de la CTO", () => {
  const { api } = loadApp();
  const cto = {
    nombreLinea: "DV-27212", estructuraInicio: "EMPLAZAMIENTO RED (ID 2566648)",
    orden: "23", fibIni: "1", fibFin: "1"
  };
  const cables = [
    {
      id: "arrival", cable: "A109/232", descripcionCable: "8 FO AER",
      nombreLinea: "DV-27212", estructuraInicio: "EMPLAZAMIENTO RED (ID 2566650)",
      estructuraFinal: "EMPLAZAMIENTO RED (ID 2566648)", orden: "22", fibIni: "1", fibFin: "1"
    },
    {
      id: "decoy", cable: "A109/234", descripcionCable: "24 FO AER",
      nombreLinea: "DV-27212", estructuraInicio: "EMPLAZAMIENTO RED (ID 2566655)",
      estructuraFinal: "L 4810021 Nº 203 (9C) (ID 2566238)", orden: "22", fibIni: "1", fibFin: "1"
    }
  ];

  const selected = plain(api.buscarCables(cables, cto));
  assert.deepEqual(selected.map(c => c.id), ["arrival"]);
});

test("KML toma la fibra del cable de llegada y no el identificador fibIni/fibFin de la CTO", () => {
  const { api } = loadApp();
  const cto = {
    id: "15681469", nombreElemento: "CTO MI Nº 22074", nombreLinea: "DV-27209",
    lineasPeticion: "DV-27209, 2 (66)", orden: "23", fibIni: "66", fibFin: "66",
    estructuraInicio: "EMPLAZAMIENTO RED (ID 2566677)"
  };
  const llegada = {
    id: "10434966", cable: "A109/230", descripcionCable: "16 FO AER",
    nombreElemento: "16 FO AER, A109/230", nombreLinea: "DV-27209", orden: "22",
    fibIni: "9", fibFin: "9", estructuraFinal: "EMPLAZAMIENTO RED (ID 2566677)"
  };
  const rows = plain(api.registroKML(cto, { cables: [llegada], empalmes: [] }, ""));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cable, "A109/230");
  assert.equal(rows[0].fibra, "9");
  assert.match(rows[0].evidencias.join(" "), /Fibra llegada.*9/);
});

test("KML usa el tramo anterior aunque la fibra del elemento CTO no coincida", () => {
  const { api } = loadApp();
  const arrival = { id: "incoming", cable: "A109/230", nombreLinea: "DV-27209", orden: "22", fibIni: "9", fibFin: "9" };
  const decoy = { id: "older", cable: "A109/228", nombreLinea: "DV-27209", orden: "21", fibIni: "66", fibFin: "66" };
  const selected = plain(api.buscarCables([arrival, decoy], { nombreLinea: "DV-27209", orden: "23", fibIni: "66" }));
  assert.deepEqual(selected.map(c => c.id), ["incoming"]);
});

test("selección KML mantiene el fallback si la CTO no tiene orden de tramo", () => {
  const { api } = loadApp();
  const candidates = [
    { id: "a", cable: "A109/232", descripcionCable: "8 FO AER", nombreLinea: "DV-27212", fibIni: "1", fibFin: "1", longitud: "140", orden: "22" },
    { id: "b", cable: "A109/234", descripcionCable: "24 FO AER", nombreLinea: "DV-27212", fibIni: "17", fibFin: "17", longitud: "132", orden: "22" }
  ];
  assert.equal(api.buscarCables(candidates, { nombreLinea: "DV-27212", fibIni: "1" }).length, 2);
});

test("KMZ prioriza doc.kml, luego el KML con nombre más corto, y falla si no existe", async () => {
  const calls = [];
  const JSZip = { async loadAsync() { return { files: {
    "sub/largo-mapa.kml": { async: async () => { calls.push("sub/largo-mapa.kml"); return "long"; } },
    "doc.kml": { async: async () => { calls.push("doc.kml"); return "doc"; } },
    "a.kml": { async: async () => { calls.push("a.kml"); return "short"; } }
  } }; } };
  const { api } = loadApp({ JSZip });
  assert.equal(await api.leerKMLKMZ({ name: "mapa.KMZ", arrayBuffer: async () => new ArrayBuffer(0) }), "doc");
  assert.deepEqual(calls, ["doc.kml"]);

  const shortest = loadApp({ JSZip: { async loadAsync() { return { files: {
    "ruta/capa.kml": { async: async () => "long" },
    "x.kml": { async: async () => "short" }
  } }; } } });
  assert.equal(await shortest.api.leerKMLKMZ({ name: "mapa.kmz", arrayBuffer: async () => new ArrayBuffer(0) }), "short");
  const empty = loadApp({ JSZip: { async loadAsync() { return { files: { "img.png": {} } }; } } });
  await assert.rejects(empty.api.leerKMLKMZ({ name: "sin-kml.kmz", arrayBuffer: async () => new ArrayBuffer(0) }), /no contiene ningún KML/i);
});

test("KML mal formado muestra el error de XML actual", () => {
  const { api } = loadApp();
  assert.throws(() => api.analizarKML("<kml><Placemark></kml>"), /XML válido/i);
});

test("coincidencias y deduplicación de empalmes, cables y registros mantienen el comportamiento", () => {
  const { api } = loadApp();
  assert.deepEqual(plain(api.divisorPatilla({ lineasPeticion: "", nombreLinea: "", nombreElemento: "DV 12, 3" })), { divisor: "DV12", patilla: "3" });
  const emp = { id: "e1", name: "C_EMP 12", nombreElemento: "Empalme N 5 DV-7, 4", nombreLinea: "", lineasPeticion: "DV-7" };
  const datos = { empalmes: [emp, { ...emp }] };
  assert.equal(api.buscarEmpalmes(datos, {}, "DV-7", "").length, 1);
  assert.equal(api.buscarEmpalmes(datos, {}, "DV-7", "E999").length, 0);
  const cable = { cable: "A1/2", descripcionCable: "FO: Línea", nombreLinea: "L1", fibIni: "1", fibFin: "2", longitud: "10" };
  assert.equal(api.dedupCables([cable, { ...cable }]).length, 1);
  api.setState({ registros: [], eliminados: 0 });
  const item = { cto: "1", empalme: "2", divisor: "DV-1", patilla: "3", fibra: "4", cable: "A1/2", lat: "", lon: "", evidencias: ["A"] };
  const result = api.deduplicarRegistros([item, { ...item, evidencias: ["B"] }]);
  assert.equal(result.length, 1);
  assert.deepEqual(plain(result[0].evidencias), ["A", "B"]);
  assert.equal(api.getState().eliminados, 1);
});

test("PDF detecta CTO, divisor, fibra, empalme y referencia; respeta filtros", async () => {
  const text = [
    "CTO 44653, Sector Norte, Armario",
    "DV-12, 4",
    "FM # 12-24",
    "EMPALME E4374",
    "CALLE Mayor 12, VIZCAYA"
  ].join("\n");
  const pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: text.split("\n").map(str => ({ str })) }) })
  }) }) };
  const { api } = loadApp({ pdfjsLib });
  const parsed = plain(api.analizarPDF(text));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].cto, "44653");
  assert.equal(parsed[0].divisor, "DV-12");
  assert.equal(parsed[0].patilla, "4");
  assert.equal(parsed[0].fibra, "12-24");
  assert.equal(parsed[0].empalme, "EMPALME E4374");
  assert.match(parsed[0].referencia, /CALLE Mayor/);
  assert.match(parsed[0].maps, /google\.com\/maps/);
  assert.equal(plain(api.registroPDF(parsed[0])).estado, "Parcial");
  const pages = await api.leerPDF({ arrayBuffer: async () => new ArrayBuffer(0) });
  assert.equal(pages.length, 1);
  assert.equal(pages[0].map(item => item.str).join("\n"), text);
});

test("PDF de plano conserva el mapeo de fibra del divisor y el cable de llegada", () => {
  const { api } = loadApp();
  const item = (str, x, y, width = str.length * 5) => ({
    str, width, height: 8, transform: [1, 0, 0, 8, x, y]
  });
  const page = [
    item("CTO", 1451, 1221, 16),
    item("22076,EXT-16,1DV", 1470, 1221, 69),
    item("DV-27212,2<16DV-27221>1-16", 1439, 1211, 108),
    item("A109/232 [8 F.O. KT]", 1501, 1195, 90),
    item("A109/999 [64 F.O. KT]", 1660, 1210, 70),
    item("8FM#1-8", 1516, 1188, 38),
    item("DV-27212,2#1", 1511, 1181, 60),
    item("7FM#2-8", 1518, 1174, 39),
    item("DV-27268,1#21", 1730, 1180, 70),
    item("49FM#1-4+7-8+10-64", 627, 1360, 120),
    item("CTO 22075,EXT-16,1DV", 1478, 1134, 120),
    item("DV-27268,1<16DV-27226>1-16", 1477, 1125, 130)
  ];

  const parsed = plain(api.analizarPDF([page]));
  const target = parsed.find(row => row.cto === "22076");
  assert.ok(target);
  assert.equal(target.divisor, "DV-27212");
  assert.equal(target.patilla, "2");
  assert.equal(target.fibra, "1");
  assert.equal(target.cable, "A109/232");
  assert.equal(target.empalme, "");
  const record = plain(api.registroPDF(target));
  assert.equal(record.cable, "A109/232");
  assert.match(record.descripcionCable, /8 F\.O\. KT/);
});

test("PDF usa la línea mapeada de la CTO para obtener fibra y cable, aunque haya rótulos más cercanos", () => {
  const { api } = loadApp();
  const item = (str, x, y, width = str.length * 5) => ({
    str, width, height: 8, transform: [1, 0, 0, 8, x, y]
  });
  const page = [
    item("CTO 22071", 200, 1000, 58),
    item("DV-27208,3", 205, 990, 58),
    item("DV-27208,3-4#1-2", 255, 978, 100),
    item("A109/227 [16 F.O. TKT]", 270, 970, 115),
    item("DV-27310,1#1", 430, 986, 78),
    item("A109/225 [8 F.O. KT]", 430, 981, 105),
    item("CTO 22072", 700, 1000, 58),
    item("DV-27310,1", 705, 990, 58),
    item("DV-27310,1#1", 750, 978, 78),
    item("A109/225 [8 F.O. KT]", 765, 970, 105),
    item("DV-27208,3-4#1-2", 900, 988, 100),
    item("A109/227 [16 F.O. TKT]", 900, 980, 115)
  ];
  const parsed = plain(api.analizarPDF([page]));
  const cto22071 = parsed.find(row => row.cto === "22071");
  const cto22072 = parsed.find(row => row.cto === "22072");
  assert.ok(cto22071);
  assert.ok(cto22072);
  assert.equal(cto22071.divisor, "DV-27208");
  assert.equal(cto22071.patilla, "3");
  assert.equal(cto22071.fibra, "1");
  assert.equal(cto22071.cable, "A109/227");
  assert.match(cto22071.descripcionCable, /16 F\.O\. TKT/);
  assert.equal(cto22072.divisor, "DV-27310");
  assert.equal(cto22072.patilla, "1");
  assert.equal(cto22072.fibra, "1");
  assert.equal(cto22072.cable, "A109/225");
  assert.match(cto22072.descripcionCable, /8 F\.O\. KT/);
});

test("PDF resuelve cada patilla del rango contra su fibra mapeada", () => {
  const { api } = loadApp();
  const item = (str, x, y, width = str.length * 5) => ({
    str, width, height: 8, transform: [1, 0, 0, 8, x, y]
  });
  const page = [
    item("CTO 22071", 200, 1000, 58),
    item("DV-27208,4", 205, 990, 58),
    item("DV-27208,3-4#1-2", 255, 978, 100),
    item("A109/227 [16 F.O. TKT]", 270, 970, 115)
  ];
  const row = plain(api.analizarPDF([page])).find(x => x.cto === "22071");
  assert.equal(row.patilla, "4");
  assert.equal(row.fibra, "2");
  assert.equal(row.cable, "A109/227");
});

test("extracción manual informa archivo ausente y procesa KML con filtros de CTO", async () => {
  const { api, elements } = loadApp();
  await api.extraer();
  assert.equal(elements.get("estado").textContent, "Selecciona primero un archivo.");

  const app = loadApp();
  app.document.getElementById("archivo").files = [{ name: "red.kml", text: async () => supportedKml() }];
  app.document.getElementById("ctos").value = "999";
  await app.api.extraer();
  assert.match(app.document.getElementById("estado").textContent, /Resultados: 0/);
  assert.equal(app.document.getElementById("csv").disabled, true);

  app.document.getElementById("ctos").value = "123";
  await app.api.extraer();
  assert.match(app.document.getElementById("estado").textContent, /Resultados: 1/);
  assert.equal(app.document.getElementById("csv").disabled, false);
  assert.match(app.document.getElementById("tabla").innerHTML, /A1\/2/);
});

test("extracción manual procesa KMZ y PDF a través de la misma interfaz", async () => {
  const JSZip = { async loadAsync() { return { files: {
    "doc.kml": { async: async () => supportedKml() }
  } }; } };
  const kmlApp = loadApp({ JSZip });
  kmlApp.document.getElementById("archivo").files = [{ name: "red.kmz", arrayBuffer: async () => new ArrayBuffer(0) }];
  await kmlApp.api.extraer();
  assert.match(kmlApp.document.getElementById("estado").textContent, /Resultados: 2/);

  const pdfItems = [
    ["CTO", 1451, 1221, 16], ["22076,EXT-16,1DV", 1470, 1221, 69],
    ["DV-27212,2<16DV-27221>1-16", 1439, 1211, 108],
    ["A109/232 [8 F.O. KT]", 1501, 1195, 90], ["8FM#1-8", 1516, 1188, 38],
    ["DV-27212,2#1", 1511, 1181, 60], ["7FM#2-8", 1518, 1174, 39]
  ].map(([str, x, y, width]) => ({ str, width, height: 8, transform: [1, 0, 0, 8, x, y] }));
  const pdfjsLib = { GlobalWorkerOptions: {}, getDocument: () => ({ promise: Promise.resolve({
    numPages: 1,
    getPage: async () => ({ getTextContent: async () => ({ items: pdfItems }) })
  }) }) };
  const pdfApp = loadApp({ pdfjsLib });
  pdfApp.document.getElementById("archivo").files = [{ name: "red.pdf", arrayBuffer: async () => new ArrayBuffer(0) }];
  await pdfApp.api.extraer();
  assert.match(pdfApp.document.getElementById("estado").textContent, /Resultados: 1/);
  assert.match(pdfApp.document.getElementById("tabla").innerHTML, /22076/);
  assert.match(pdfApp.document.getElementById("tabla").innerHTML, /A109\/232/);
  assert.match(pdfApp.document.getElementById("tabla").innerHTML, /DV-27212/);
});

test("archivo compartido se asigna al selector y se extrae automáticamente; Limpiar restablece la vista", async () => {
  const { api, document, elements } = loadApp();
  const sharedFile = { name: "desde-whatsapp.kml", text: async () => supportedKml() };
  await api.procesarArchivoCompartido(sharedFile);
  assert.equal(elements.get("archivoCompartido").textContent, "Recibido: desde-whatsapp.kml");
  assert.match(elements.get("estadoCompartido").textContent, /Extracción terminada/);
  assert.match(elements.get("estado").textContent, /Resultados: 2/);
  assert.equal(document.getElementById("archivo").files[0], sharedFile);

  elements.get("limpiar").listeners.click();
  assert.equal(elements.get("archivo").files.length, 0);
  assert.equal(elements.get("ctos").value, "");
  assert.equal(elements.get("empalme").value, "");
  assert.equal(elements.get("csv").disabled, true);
  assert.equal(elements.get("recepcionCompartir").hidden, true);
  assert.match(elements.get("tabla").innerHTML, /Todavía no se han realizado búsquedas/);
});

test("File Handling usa launchQueue y el mismo flujo automático de extracción", async () => {
  let consumer;
  const launchQueue = { setConsumer(callback) { consumer = callback; } };
  const app = loadApp({ launchQueue });
  assert.equal(typeof consumer, "function");
  const file = { name: "desde-android.kml", text: async () => supportedKml() };
  await consumer({ files: [{ getFile: async () => file }] });
  assert.match(app.document.getElementById("estado").textContent, /Resultados: 2/);
});

test("ruta compartida con error no-file presenta diagnóstico sin exponer los valores del POST", async () => {
  const diagnostic = encodeURIComponent(JSON.stringify({
    method: "POST", path: "/share-target.html", headers: { "content-type": "multipart/form-data" },
    parts: [{ name: "title", kind: "text", mime: "text/plain", chars: 18 }]
  }));
  const location = {
    href: `https://example.test/Piloto-cto/?shared=1&error=no-file&debug=${diagnostic}`,
    search: `?shared=1&error=no-file&debug=${diagnostic}`,
    pathname: "/Piloto-cto/"
  };
  const app = loadApp({ location });
  await app.api.iniciarRecuperacionCompartida();
  const message = app.document.getElementById("estadoCompartido").textContent;
  assert.match(message, /No se recibió ningún archivo/);
  assert.match(message, /title/);
  assert.doesNotMatch(message, /valor real|datos privados/);
  assert.equal(app.context.history.calls.length, 0);
  assert.equal(typeof app.events["window:pageshow"], "function");
});

test("el primer lanzamiento compartido recupera y extrae sin esperar al evento load", async () => {
  const contenido = new TextEncoder().encode(supportedKml());
  const storedFile = {
    name: "primer-envio.kml", type: "application/vnd.google-earth.kml+xml",
    data: contenido.buffer, size: contenido.byteLength
  };
  const files = new Map([["first-share-1", storedFile]]);
  const db = {
    close() {},
    transaction() {
      const transaction = {};
      transaction.objectStore = () => ({
        get(id) {
          const request = {};
          queueMicrotask(() => { request.result = files.get(id)||null; request.onsuccess?.(); });
          return request;
        },
        delete(id) {
          queueMicrotask(() => { files.delete(id); transaction.oncomplete?.(); });
        }
      });
      return transaction;
    }
  };
  const indexedDB = { open() {
    const request = {};
    queueMicrotask(() => { request.result = db; request.onsuccess?.(); });
    return request;
  } };
  const location = {
    href: "https://example.test/Piloto-cto/?shared=1&id=first-share-1&source=pwa",
    search: "?shared=1&id=first-share-1&source=pwa",
    pathname: "/Piloto-cto/"
  };
  const app = loadApp({ location, indexedDB });
  await app.api.iniciarRecuperacionCompartida();
  assert.match(app.document.getElementById("estado").textContent, /Resultados: 2/);
  assert.match(app.document.getElementById("estadoCompartido").textContent, /Extracción terminada/);
  assert.equal(app.context.history.calls[0][2], "/Piloto-cto/?source=pwa");
  assert.equal(files.has("first-share-1"), false);
});

test("CSV conserva BOM, separador punto y coma, escape de comillas y nombre de descarga", async () => {
  const { api, elements, links } = loadApp();
  api.setState({ registros: [{ cto: "1", nombreCto: 'CTO "uno"', empalme: "2", divisor: "DV-1", patilla: "3", fibra: "4", cable: "A1/2", descripcionCable: "x", tipoElemento: "KML", longitud: "", distancia: "", ubicacion: "Exacta", referencia: "40,-3", maps: "https://maps.test", estado: "Completa", evidencias: ["e"] }] });
  api.descargarCSV();
  assert.equal(links[0].download, "resultados_cto_v2_3.csv");
  assert.equal(links[0].blob.type, "text/csv;charset=utf-8");
  assert.equal(api.campoCSV('a"b'), '"a""b"');
  const csv = new Uint8Array(await links[0].blob.arrayBuffer());
  assert.deepEqual(Array.from(csv.slice(0, 3)), [0xef, 0xbb, 0xbf]);
  const text = new TextDecoder().decode(csv.slice(3));
  assert.match(text, /"CTO ""uno""";/);
});

test("diagnóstico de recepción muestra nombres, cabeceras y metadatos sin valores compartidos", () => {
  const { api } = loadApp();
  const output = api.formatearDiagnosticoRecepcion({
    method: "POST", path: "/share-target.html", headers: { "content-type": "multipart/form-data", "user-agent": "Android Chrome/123" },
    parts: [{ name: "title", kind: "text", mime: "text/plain", chars: 20 }, { name: "file", kind: "file", mime: "application/pdf", bytes: 123, extension: ".pdf" }]
  });
  assert.match(output, /title/);
  assert.match(output, /file/);
  assert.match(output, /application\/pdf/);
  assert.match(output, /123 bytes/);
  assert.doesNotMatch(output, /Documento de Hugo|archivo secreto/);
});
