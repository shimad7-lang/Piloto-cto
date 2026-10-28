const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {ROOT,loadApp}=require("./helpers.cjs");
const L=loadApp().api;
const P=(lon,lat)=>({lon:String(lon),lat:String(lat)});
const box=(id,structure,lat,lon,distancia="")=>({id,nombreElemento:id,esLinea:false,estructuraInicio:`${structure} (ID ${structure})`,lat:String(lat),lon:String(lon),distancia,vertices:[P(lon,lat)]});
const cable=(id,a,b,coords,{orden="1",longitud="",distancia=""}={})=>({id,nombreElemento:id,esLinea:true,elementType:"TRANSMEDIA",estructuraInicio:`${a} (ID ${a})`,estructuraFinal:`${b} (ID ${b})`,orden,longitud,distancia,vertices:coords.map(([lon,lat])=>P(lon,lat))});
const line=(a,b,id="a",options={})=>[box("root",a,0,0),cable(id,a,b,[[0,0],[0.001,0]],options),box("end",b,0,0.001)];

test("el motor real encuentra cortes desde ambos extremos e interpola al invertir",()=>{
 const c=line("1","2","c1",{longitud:"100",orden:"8"});
 const forward=L.calcularPosicionDeCorte(c,25,"root");
 const reverse=L.calcularPosicionDeCorte(c,25,"end");
 assert.equal(forward.tramoId,"c1");assert.equal(reverse.tramoId,"c1");
 assert.ok(forward.lon<reverse.lon);assert.ok(Math.abs(forward.lon-0.00025)<1e-8);assert.ok(Math.abs(reverse.lon-0.00075)<1e-8);
});
test("ambigüedad de bifurcación se muestra; elección selecciona el recorrido",()=>{
 const records=[box("r","1",0,0),cable("left","1","2",[[0,0],[.001,0]],{longitud:"100"}),cable("right","1","3",[[0,0],[0,.001]],{longitud:"120"}),box("l","2",0,.001),box("rr","3",.001,0)];
 const choice=L.calcularPosicionDeCorte(records,50,"r");assert.equal(choice.requiereEleccion,true);assert.equal(choice.rutas.length,2);
 assert.equal(L.calcularPosicionDeCorte(records,50,"r",1).tramoId,"right");
});
test("cables paralelos siguen siendo recorridos separados",()=>{
 const records=[box("r","1",0,0),cable("p1","1","2",[[0,0],[.001,0]],{longitud:"100"}),cable("p2","1","2",[[0,0],[0,.001]],{longitud:"110"}),box("e","2",0,.001)];
 assert.equal(L.calcularPosicionDeCorte(records,20,"r").requiereEleccion,true);
});
test("órdenes repetidas no cambian conectividad; se miden tramos de orden menor en reversa",()=>{
 const records=[box("r","1",0,0),cable("first","1","2",[[0,0],[.001,0]],{longitud:"100",orden:"7"}),cable("second","2","3",[[.001,0],[.002,0]],{longitud:"100",orden:"7"}),box("e","3",0,.002)];
 assert.equal(L.calcularPosicionDeCorte(records,150,"e").tramoId,"first");
});
test("reserva de cable con mismo ID de extremos suma su acumulado sin ramificar",()=>{
 const records=[box("r","1",0,0,"0"),cable("one","1","1",[[0,0],[.0001,0]],{distancia:"10"}),cable("next","1","2",[[.0001,0],[.001,0]],{distancia:"110"}),box("e","2",0,.001,"110")];
 const r=L.calcularPosicionDeCorte(records,5,"r");assert.equal(r.tramoId,"one");assert.equal(r.fuenteDistancia,"distancia acumulada");
});
test("caso TIFlu 55 m: 49 + 5 + 1 m y tramo final CR GEN 52 sin bifurcación",()=>{
 const records=[box("cto","A666",0,0),cable("A105/666","A666","A564",[[0,0],[.00049,0]],{longitud:"49",distancia:"49",orden:"11"}),cable("A105/564","A564","A40",[[.00049,0],[.00054,0]],{longitud:"5",distancia:"54",orden:"11"}),cable("A105/40-11","A40","A40",[[.00054,0],[.00055,0]],{longitud:"1",distancia:"55",orden:"11"}),box("next","A40",0,.00055,"55")];
 const r=L.calcularPosicionDeCorte(records,55,"cto");assert.equal(r.tramoId,"A105/40-11");assert.equal(r.lon,.00055);
});
test("si faltan distancias usa longitud y luego geometría",()=>{
 const a=line("1","2","declared",{longitud:"100"});assert.equal(L.calcularPosicionDeCorte(a,40,"root").fuenteDistancia,"longitud");
 a[1].longitud="";const r=L.calcularPosicionDeCorte(a,40,"root");assert.equal(r.fuenteDistancia,"geometría");
});
test("corte en límite exacto se asigna al tramo terminado y devuelve objetivo",()=>{
 const records=[box("r","1",0,0),cable("first","1","2",[[0,0],[.001,0]],{longitud:"100"}),cable("next","2","3",[[.001,0],[.002,0]],{longitud:"100"}),box("e","3",0,.002)];
 const r=L.calcularPosicionDeCorte(records,100,"r");assert.equal(r.tramoObjetivo,"first");assert.equal(r.lon,.001);
});
test("KML Durango existente: medición inversa desde PTRO no devuelve acumulado cero",()=>{
 const r=L.calcularPosicionDeCorte(require("./durango-roseta.fixture.cjs"),2600,"15126005");
 assert.ok(r.encontrado||r.requiereEleccion);if(r.requiereEleccion)assert.ok(r.rutas.every(x=>x.tramos.length>0));else assert.ok(r.tramoId);
});
test("interfaz contiene una única sección e IDs de localizador únicos",()=>{
 const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
 for(const id of ["seccion-localizador","origenMedicion","metrosCorte","resultadoLocalizador","localizar"])
  assert.equal((html.match(new RegExp(`id=[\"']${id}[\"']`,"g"))||[]).length,1,id);
});
