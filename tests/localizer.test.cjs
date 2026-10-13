const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { ROOT } = require("./helpers.cjs");

// Carga localizer.js en un contexto aislado (funciones puras, sin DOM).
function cargarLocalizer() {
  const src = fs.readFileSync(path.join(ROOT, "localizer.js"), "utf8");
  const ctx = { console: { log() {}, warn() {}, error() {} } };
  vm.runInNewContext(src, ctx, { filename: "localizer.js" });
  return ctx;
}

// Circuito REAL Durango-Roseta (KML DNG 1783630), validado con el archivo real.
const circuitoDurango = () => require("./durango-roseta.fixture.cjs");

test("localizador: detecta CT DURANGO (RO 01) como raiz por defecto", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  const info = L.detectarRaices(circuito);
  assert.equal(info.porDefecto, "1783630");
  assert.ok(info.raices.some(r => r.id === "1783630"));
});

test("localizador: corte a 2600 m desde CT DURANGO cae en orden 12 con 3 cajas", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  const r = L.calcularPosicionDeCorte(circuito, 2600, "1783630");

  assert.equal(r.encontrado, true);
  assert.equal(r.tipo, "TRANSMEDIA");
  const orden = Number(r.ordenTramo);
  assert.ok(orden >= 11 && orden <= 12, "orden del corte=" + orden);
  assert.ok(orden > 9, "no debe caer antes de orden 9");
  assert.ok(r.lat && r.lon, "debe interpolar coordenadas");
  assert.equal(r.cajas, 3, "cruza 3 cajas (7579, 5423, 20737)");
  assert.equal(r.distanciaReal, true, "usa distanciaAcumulada del KML");
  assert.equal(r.ruta[0], "RO 01");
  // La ruta menciona las cajas intermedias antes del punto de corte.
  assert.ok(r.ruta.some(x => /7579/.test(x)));
  assert.ok(r.ruta.some(x => /5423/.test(x)));
  assert.ok(r.ruta.some(x => /20737/.test(x)));
});

test("localizador: usa distanciaAcumulada (no infla) => cortes escalan por orden", () => {
  const L = cargarLocalizer();
  const circuito = circuitoDurango();
  // Con distanciaAcumulada real: 500m->ord4, 1500m->ord4, 2100m->ord9.
  assert.equal(Number(L.calcularPosicionDeCorte(circuito, 500, "1783630").ordenTramo), 4);
  assert.equal(Number(L.calcularPosicionDeCorte(circuito, 1500, "1783630").ordenTramo), 4);
  assert.equal(Number(L.calcularPosicionDeCorte(circuito, 2100, "1783630").ordenTramo), 9);
  // 2700m supera ord15, cae en el aereo final ord16 con 5 cajas.
  const lejos = L.calcularPosicionDeCorte(circuito, 2700, "1783630");
  assert.equal(Number(lejos.ordenTramo), 16);
  assert.equal(lejos.cajas, 5);
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

