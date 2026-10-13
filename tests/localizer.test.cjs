const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { ROOT, loadApp } = require("./helpers.cjs");

// Carga localizer.js en un contexto aislado (funciones puras, sin DOM).
function cargarLocalizer() {
  const src = fs.readFileSync(path.join(ROOT, "localizer.js"), "utf8");
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(src, ctx, { filename: "localizer.js" });
  return ctx;
}

function circuitoDurango() {
  const { api } = loadApp();
  const xml = fs.readFileSync(path.join(ROOT, "tests", "durango-roseta.kml"), "utf8");
  return api.analizarKML(xml).elementos;
}

test("localizador: detecta CT DURANGO como raiz por defecto", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  const info = L.detectarRaices(circuito);
  assert.equal(info.porDefecto, "1783630");
  assert.ok(info.raices.some(r => r.id === "1783630"));
});

test("localizador: corte a 2600 m desde CT DURANGO cae en orden 11-12 (aereo)", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  const r = L.calcularPosicionDeCorte(circuito, 2600, "1783630");

  assert.equal(r.encontrado, true);
  assert.equal(r.tipo, "TRANSMEDIA");
  const orden = Number(r.ordenTramo);
  assert.ok(orden >= 11 && orden <= 12, "orden del corte=" + orden);
  assert.ok(orden > 9, "no debe caer antes de orden 9");
  assert.ok(r.lat && r.lon, "debe interpolar coordenadas");
  assert.equal(r.ruta[0], "CT DURANGO");
  // Debe haber contabilizado cajas intermedias (+5 m) antes del aereo.
  assert.ok(r.ruta.length >= 6, "ruta debe cruzarse con varias cajas");
});

test("localizador: distancia que supera el circuito no encontrado", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  const r = L.calcularPosicionDeCorte(circuito, 999999, "1783630");
  assert.equal(r.encontrado, false);
  assert.ok(r.metrosAcumulados > 0);
});

test("localizador: origen inexistente devuelve error", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  const r = L.calcularPosicionDeCorte(circuito, 100, "no-existe");
  assert.ok(r.error);
});

test("localizador: tortuosidad subt. 520 m aplica 1.15 (598 m)", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  // 0 m cae en el primer cable (orden 2) con factor 1.15 sobre 520 = 598.
  const r = L.calcularPosicionDeCorte(circuito, 100, "1783630");
  assert.equal(r.encontrado, true);
  assert.equal(Number(r.ordenTramo), 2);
  assert.equal(r.factorTortuosidad, 1.15);
  assert.equal(r.longitudTramo, 520);
});
