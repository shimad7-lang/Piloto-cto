const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");

class XmlNode {
  constructor(name, attributes = {}) {
    this.nodeName = name;
    this.localName = name.includes(":") ? name.split(":").at(-1) : name;
    this.attributes = attributes;
    this.children = [];
    this.text = "";
  }

  getAttribute(name) {
    return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null;
  }

  get textContent() {
    return this.text + this.children.map(child => child.textContent).join("");
  }

  getElementsByTagName(name) {
    const found = [];
    const visit = parent => {
      for (const child of parent.children) {
        if (child instanceof XmlNode && (name === "*" || child.localName === name)) {
          found.push(child);
        }
        if (child instanceof XmlNode) visit(child);
      }
    };
    visit(this);
    return found;
  }
}

function parseXml(source) {
  const document = new XmlNode("#document");
  const stack = [document];
  const tokens = String(source).match(/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<[^>]+>|[^<]+/g) || [];
  let malformed = false;

  for (const token of tokens) {
    if (token.startsWith("<!--") || token.startsWith("<?") || token.startsWith("<!")) continue;

    if (token.startsWith("</")) {
      const closing = token.match(/^<\/\s*([^\s>]+)/)?.[1];
      if (!closing || stack.length === 1 || stack.at(-1).nodeName !== closing) {
        malformed = true;
        break;
      }
      stack.pop();
      continue;
    }

    if (token.startsWith("<")) {
      const match = token.match(/^<\s*([^\s/>]+)/);
      if (!match) {
        malformed = true;
        break;
      }
      const attributes = {};
      const body = token.slice(match[0].length, token.length - (token.endsWith("/>") ? 2 : 1));
      for (const attr of body.matchAll(/([^\s=]+)\s*=\s*(["'])(.*?)\2/g)) {
        attributes[attr[1]] = attr[3];
      }
      const node = new XmlNode(match[1], attributes);
      stack.at(-1).children.push(node);
      if (!token.endsWith("/>") && !/^<!/.test(token)) stack.push(node);
      continue;
    }

    stack.at(-1).text += token
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&")
      .replaceAll("&quot;", '"')
      .replaceAll("&apos;", "'");
  }

  if (stack.length !== 1) malformed = true;
  if (malformed) document.children.push(new XmlNode("parsererror"));
  return document;
}

function makeElement(id) {
  return {
    id,
    _value: "",
    get value() { return this._value; },
    set value(value) {
      this._value = value;
      if (id === "archivo" && value === "") this.files = [];
    },
    textContent: "",
    innerHTML: "",
    className: "",
    hidden: false,
    disabled: false,
    files: [],
    addEventListener(type, callback) {
      this.listeners ||= {};
      this.listeners[type] = callback;
    },
    click() {
      this.clicked = true;
    }
  };
}

function loadApp({ pdfjsLib, JSZip, location, launchQueue } = {}) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const source = ["app-core.js", "app-kml.js", "app-pdf.js", "app-processing.js", "app-ui.js", "app-share.js"]
    .map(file => fs.readFileSync(path.join(ROOT, file), "utf8")).join("\n");
  if (!source.trim()) throw new Error("Application script is empty");

  const elements = new Map();
  const links = [];
  const events = {};
  const document = {
    title: "Piloto CTO",
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id));
      return elements.get(id);
    },
    createElement(tag) {
      const element = makeElement(tag);
      links.push(element);
      return element;
    }
  };
  const window = {
    addEventListener(type, callback) {
      events[`window:${type}`] = callback;
    }
  };
  if (launchQueue) window.launchQueue = launchQueue;
  const appLocation = location || {
    href: "https://example.test/Piloto-cto/",
    search: "",
    pathname: "/Piloto-cto/"
  };
  class AppURL extends URL {}
  AppURL.createObjectURL = blob => {
    links.at(-1).blob = blob;
    return "blob:characterization";
  };
  AppURL.revokeObjectURL = () => {};

  const context = {
    console: { log() {}, info() {}, warn() {}, error() {} },
    document,
    window,
    location: appLocation,
    history: { calls: [], replaceState(...args) { this.calls.push(args); } },
    navigator: {},
    URL: AppURL,
    Blob,
    File: require("node:buffer").File,
    DataTransfer: class {
      constructor() {
        this.items = { add: file => (this.files ||= []).push(file) };
        this.files = [];
      }
    },
    DOMParser: class {
      parseFromString(source) {
        return parseXml(source);
      }
    },
    pdfjsLib: pdfjsLib || { GlobalWorkerOptions: {}, getDocument() { throw new Error("pdfjs not configured"); } },
    JSZip: JSZip || { async loadAsync() { throw new Error("JSZip not configured"); } },
    setTimeout(callback) {
      return 1;
    },
    clearTimeout() {}
  };

  const exported = [
    "limpiarTexto", "normalizar", "lista", "separarCable", "numeroCTO",
    "enlaceMaps", "enlaceBusqueda", "leerKMLKMZ", "analizarKML",
    "divisorPatilla", "buscarEmpalmes", "dedupEmpalmes", "buscarCables",
    "dedupCables", "leerPDF", "analizarPDF", "registroKML", "registroPDF",
    "claveRegistro", "deduplicarRegistros", "extraer", "pintar", "copiarTexto",
    "campoCSV", "descargarCSV", "procesarArchivoCompartido",
    "formatearDiagnosticoRecepcion", "recuperarArchivoCompartido",
    "borrarArchivoCompartido", "instalarRecepcionAndroid"
  ];
  const instrumented = source +
    `\nglobalThis.__api={${exported.join(",")},getState:()=>({registros,elementosPDF,textoOriginal,eliminados,archivoCompartido}),setState:(v={})=>{if(v.registros!==undefined)registros=v.registros;if(v.elementosPDF!==undefined)elementosPDF=v.elementosPDF;if(v.eliminados!==undefined)eliminados=v.eliminados;}};`;
  vm.runInNewContext(instrumented, context, { filename: "app-modules.js" });

  return { api: context.__api, context, document, elements, links, events, html };
}

function supportedKml() {
  return `<?xml version="1.0"?><kml><Document>
    <Placemark id="cto-1"><name>Centro CTO 123</name><ExtendedData>
      <Data name="nombreElemento"><value>CTO 123</value></Data>
      <Data name="elementType"><value>CTO</value></Data>
      <Data name="lineasPeticion"><value>DV-7, 4</value></Data>
      <Data name="nombreLinea"><value>Linea 1</value></Data>
      <Data name="fibIni"><value>12</value></Data>
      <Data name="estructuraInicio"><value>poste-1</value></Data>
      <Data name="longitudElemento"><value>20 m</value></Data>
    </ExtendedData><Point><coordinates>-3.7,40.4,0</coordinates></Point></Placemark>
    <Placemark id="cable-1"><name>FO: Linea 1</name><ExtendedData>
      <Data name="nombreElemento"><value>FO: Linea 1, A1/2</value></Data>
      <Data name="elementType"><value>Cable</value></Data>
      <Data name="nombreLinea"><value>Linea 1</value></Data>
      <Data name="fibIni"><value>12</value></Data>
      <Data name="longitudElemento"><value>200 m</value></Data>
    </ExtendedData></Placemark>
    <Placemark id="splice-1"><name>C_EMP 12</name><ExtendedData>
      <Data name="nombreElemento"><value>Empalme N 5 DV-7, 4</value></Data>
      <Data name="elementType"><value>EQUIPMENT</value></Data>
      <Data name="direction"><value>DOWN</value></Data>
      <Data name="distanciaAcumulada"><value>105</value></Data>
      <Data name="fechaInstalacion"><value>2015-10-21</value></Data>
      <Data name="estructuraInicio"><value>Arqueta 1</value></Data>
      <Data name="estructuraFinal"><value>Arqueta 2</value></Data>
      <Data name="fibIni"><value>2</value></Data>
      <Data name="fibFin"><value>3</value></Data>
      <Data name="lineasPeticion"><value>DV-7, 4 (2-3)</value></Data>
      <Data name="longitudElemento"><value>18 m</value></Data>
      <Data name="nombreLinea"><value>Linea 1</value></Data>
      <Data name="ordenTramo"><value>7</value></Data>
      <Data name="unidadAlta"><value>4</value></Data>
      <Data name="unidadBaja"><value>3</value></Data>
      <Data name="uuid"><value>uuid-emp-5</value></Data>
    </ExtendedData><Point><coordinates>-3.6,40.3,0</coordinates></Point></Placemark>
  </Document></kml>`;
}

module.exports = { ROOT, loadApp, supportedKml };
