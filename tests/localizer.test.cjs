const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {ROOT,loadApp}=require("./helpers.cjs");
const L=loadApp().api;
const P=(lon,lat)=>({lon:String(lon),lat:String(lat)});
const measured=n=>n/0.87;
const box=(id,structure,lat,lon,distancia="")=>({id,nombreElemento:id,esLinea:false,estructuraInicio:`${structure} (ID ${structure})`,lat:String(lat),lon:String(lon),distancia,vertices:[P(lon,lat)]});
const cable=(id,a,b,coords,{orden="1",longitud="",distancia=""}={})=>({id,nombreElemento:id,esLinea:true,elementType:"TRANSMEDIA",estructuraInicio:`${a} (ID ${a})`,estructuraFinal:`${b} (ID ${b})`,orden,longitud,distancia,vertices:coords.map(([lon,lat])=>P(lon,lat))});
const line=(a,b,id="a",options={})=>[box("root",a,0,0),cable(id,a,b,[[0,0],[0.001,0]],options),box("end",b,0,0.001)];

test("el motor real encuentra cortes desde ambos extremos e interpola al invertir",()=>{
 const c=line("1","2","c1",{longitud:"100",orden:"8"});
 const forward=L.calcularPosicionDeCorte(c,measured(25),"root");
 const reverse=L.calcularPosicionDeCorte(c,measured(25),"end");
 assert.equal(forward.tramoId,"c1");assert.equal(reverse.tramoId,"c1");
 assert.ok(forward.lon<reverse.lon);assert.ok(Math.abs(forward.lon-0.00025)<1e-8);assert.ok(Math.abs(reverse.lon-0.00075)<1e-8);
});
test("ambigüedad de bifurcación se muestra; elección selecciona el recorrido",()=>{
 const records=[box("r","1",0,0),cable("left","1","2",[[0,0],[.001,0]],{longitud:"100"}),cable("right","1","3",[[0,0],[0,.001]],{longitud:"120"}),box("l","2",0,.001),box("rr","3",.001,0)];
 const choice=L.calcularPosicionDeCorte(records,measured(50),"r");assert.equal(choice.requiereEleccion,true);assert.equal(choice.rutas.length,2);
 assert.equal(L.calcularPosicionDeCorte(records,measured(50),"r",1).tramoId,"right");
});
test("cables paralelos siguen siendo recorridos separados",()=>{
 const records=[box("r","1",0,0),cable("p1","1","2",[[0,0],[.001,0]],{longitud:"100"}),cable("p2","1","2",[[0,0],[0,.001]],{longitud:"110"}),box("e","2",0,.001)];
 assert.equal(L.calcularPosicionDeCorte(records,measured(20),"r").requiereEleccion,true);
});
test("órdenes repetidas no cambian conectividad; se miden tramos de orden menor en reversa",()=>{
 const records=[box("r","1",0,0),cable("first","1","2",[[0,0],[.001,0]],{longitud:"100",orden:"7"}),cable("second","2","3",[[.001,0],[.002,0]],{longitud:"100",orden:"7"}),box("e","3",0,.002)];
 assert.equal(L.calcularPosicionDeCorte(records,measured(150),"e").tramoId,"first");
});
test("reserva de cable con mismo ID de extremos suma su acumulado sin ramificar",()=>{
 const records=[box("r","1",0,0,"0"),cable("one","1","1",[[0,0],[.0001,0]],{distancia:"10"}),cable("next","1","2",[[.0001,0],[.001,0]],{distancia:"110"}),box("e","2",0,.001,"110")];
 const r=L.calcularPosicionDeCorte(records,measured(5),"r");assert.equal(r.tramoId,"one");assert.equal(r.fuenteDistancia,"distancia acumulada");
});
test("caso TIFlu: 55 m de campo se corrigen a 47,85 m en A105/666",()=>{
 const records=[box("cto","A666",0,0),cable("A105/666","A666","A564",[[0,0],[.00049,0]],{longitud:"49",distancia:"49",orden:"11"}),cable("A105/564","A564","A40",[[.00049,0],[.00054,0]],{longitud:"5",distancia:"54",orden:"11"}),cable("A105/40-11","A40","A40",[[.00054,0],[.00055,0]],{longitud:"1",distancia:"55",orden:"11"}),box("next","A40",0,.00055,"55")];
 const r=L.calcularPosicionDeCorte(records,55,"cto");assert.equal(r.metrosCorregidos,47.85);assert.equal(r.tramoId,"A105/666");assert.ok(Math.abs(r.lon-.0004785)<1e-8);
});
test("la distancia ajustada de 55 m alcanza la reserva final de aproximadamente 1 m",()=>{
 const records=[box("cto","A666",0,0),cable("A105/666","A666","A564",[[0,0],[.00049,0]],{longitud:"49",distancia:"49",orden:"11"}),cable("A105/564","A564","A40",[[.00049,0],[.00054,0]],{longitud:"5",distancia:"54",orden:"11"}),cable("A105/40-11","A40","A40",[[.00054,0],[.00055,0]],{longitud:"1",distancia:"55",orden:"11"}),box("next","A40",0,.00055,"55")];
 const r=L.calcularPosicionDeCorte(records,measured(55),"cto");assert.equal(r.tramoId,"A105/40-11");assert.equal(r.lon,.00055);
});
test("si faltan distancias usa longitud y luego geometría",()=>{
 const a=line("1","2","declared",{longitud:"100"});assert.equal(L.calcularPosicionDeCorte(a,measured(40),"root").fuenteDistancia,"longitud");
 a[1].longitud="";const r=L.calcularPosicionDeCorte(a,measured(40),"root");assert.equal(r.fuenteDistancia,"geometría");
});
test("corte en límite exacto se asigna al tramo terminado y devuelve objetivo",()=>{
 const records=[box("r","1",0,0),cable("first","1","2",[[0,0],[.001,0]],{longitud:"100"}),cable("next","2","3",[[.001,0],[.002,0]],{longitud:"100"}),box("e","3",0,.002)];
 const r=L.calcularPosicionDeCorte(records,measured(100),"r");assert.equal(r.tramoObjetivo,"first");assert.equal(r.lon,.001);
});
test("KML Durango existente: medición inversa desde PTRO no devuelve acumulado cero",()=>{
 const r=L.calcularPosicionDeCorte(require("./durango-roseta.fixture.cjs"),2600,"15126005");
 assert.ok(r.encontrado||r.requiereEleccion);if(r.requiereEleccion)assert.ok(r.rutas.every(x=>x.tramos.length>0));else assert.ok(r.tramoId);
});
test("interfaz contiene una única sección e IDs de localizador únicos",()=>{
 const html=fs.readFileSync(path.join(ROOT,"index.html"),"utf8");
 for(const id of ["seccion-localizador","origenMedicion","metrosCorte","resultadoLocalizador","localizar","verArchivo","texto"])
  assert.equal((html.match(new RegExp(`id=[\"']${id}[\"']`,"g"))||[]).length,1,id);
});

test("descuenta 13% a la medición de campo y conserva ambos valores en el resultado",()=>{
 const records=[box("root","1",0,0),cable("km","1","2",[[0,0],[.01,0]],{longitud:"1000"}),box("end","2",0,.01)];
 const r=L.calcularPosicionDeCorte(records,1000,"root");
 assert.equal(r.metros,1000);assert.equal(r.metrosCorregidos,870);assert.equal(r.tramoId,"km");assert.ok(Math.abs(r.lon-.0087)<1e-8);
});

test("orígenes solo ofrece CTO, EMP, N, CT y RO; excluye cables, coordenadas y arquetas",()=>{
 const app=loadApp(),api=app.api;
 const entries=[
  {id:"cto",nombreElemento:"CTO EXT 12",elementoTipo:"EQUIPMENT"},
  {id:"emp",nombreElemento:"Empalme 45",name:"ELFO:C_EMP",elementoTipo:"EQUIPMENT"},
  {id:"n",nombreElemento:"Nº 17",elementoTipo:"EQUIPMENT"},
  {id:"ct",nombreElemento:"CT DURANGO",elementoTipo:"EQUIPMENT"},
  {id:"ro",nombreElemento:"RO 01",elementoTipo:"EQUIPMENT"},
  {id:"ptro",nombreElemento:"PTRO 63 ROSETA",elementoTipo:"EQUIPMENT"},
  {id:"cto-project",nombreElemento:"O-52365",elementoTipo:"CTO"},
  {id:"emp-project",nombreElemento:"E-19224 DIVICAU",elementoTipo:"EQUIPMENT"},
  {id:"arq",nombreElemento:"ARQ H 418",elementoTipo:"EQUIPMENT"},
  {id:"coord",nombreElemento:"43.1,-3.2",elementoTipo:"LABEL"},
  {id:"line",nombreElemento:"CTO FO line",esLinea:true}
 ];
 assert.deepEqual(api.detectarRaices(entries).opciones.map(x=>x.id),["cto","emp","n","ct","ro","ptro","cto-project","emp-project"]);
 api.poblarOrigenes(entries);
 const options=app.document.getElementById("origenMedicion").innerHTML;
 for(const id of ["cto","emp","n","ct","ro","ptro","cto-project","emp-project"])assert.match(options,new RegExp(`value="${id}"`));
 for(const id of ["arq","coord","line"])assert.doesNotMatch(options,new RegExp(`value="${id}"`));
 api.poblarOrigenes(entries,[entries.find(e=>e.id==="cto-project"),entries.find(e=>e.id==="emp-project")]);
 const visibleOptions=app.document.getElementById("origenMedicion").innerHTML;
 assert.match(visibleOptions,/value="cto-project"/);assert.match(visibleOptions,/value="emp-project"/);
 assert.doesNotMatch(visibleOptions,/value="cto"/);
});

test("elementos de proyecto y PTRO sin ID se pueden medir en ambos sentidos usando geometría",()=>{
 const app=loadApp();
 const root={name:"O-52365",nombreElemento:"O-52365",elementoTipo:"CTO",esLinea:false,lat:"0",lon:"0",vertices:[P(0,0)]};
 const wire=cable("wire","","",[[0,0],[.001,0]],{longitud:"100"});
 wire.estructuraInicio="";wire.estructuraFinal="";
 const end={name:"PTRO 63 ROSETA",nombreElemento:"PTRO 63 ROSETA",elementoTipo:"EQUIPMENT",esLinea:false,lat:"0",lon:".001",vertices:[P(.001,0)]};
 const records=[root,wire,end];
 app.api.poblarOrigenes(records,[root,end]);
 const select=app.document.getElementById("origenMedicion");
 assert.match(select.innerHTML,/O-52365/);assert.match(select.innerHTML,/PTRO 63 ROSETA/);
 assert.ok(select.value);assert.match(select.innerHTML,/value="localizer:0">O-52365/);
 const r=app.api.calcularPosicionDeCorte(records,measured(50),select.value);
 assert.equal(r.encontrado,true);assert.equal(r.nombreOrigen,"O-52365");assert.equal(r.tramoId,"wire");assert.ok(Math.abs(r.lon-.0005)<1e-8);
 select.value="localizer:2";
 const reverse=app.api.calcularPosicionDeCorte(records,measured(50),select.value);
 assert.equal(reverse.encontrado,true);assert.equal(reverse.nombreOrigen,"PTRO 63 ROSETA");assert.equal(reverse.tramoId,"wire");assert.ok(Math.abs(reverse.lon-.0005)<1e-8);
});

test("el enlace Ver archivo conserva los bytes originales y asigna el MIME correcto",async()=>{
 const app=loadApp(),{html}=app;
 assert.match(html,/id="verArchivo"[^>]*hidden/);
 assert.match(html,/id="texto" hidden/);
 assert.doesNotMatch(html,/<summary>[^<]*(?:texto|XML|datos técnicos)/i);
 const xml="<kml><Document><name>original</name></Document></kml>";
 const archivo=new (require("node:buffer").File)([xml],"red.kml",{type:"application/vnd.google-earth.kml+xml"});
 app.api.mostrarEnlaceArchivo(archivo);
 const enlace=app.document.getElementById("verArchivo");
 assert.equal(enlace.hidden,false);assert.equal(enlace.textContent,"Ver archivo: red.kml");assert.equal(enlace.href,"blob:characterization");assert.equal(enlace.download,undefined);
 assert.equal(app.objectUrls.at(-1).type,"text/xml;charset=utf-8");assert.equal(await app.objectUrls.at(-1).text(),xml);
 const pdf=new (require("node:buffer").File)(["%PDF"],"plano.pdf",{type:"application/octet-stream"});
 app.api.mostrarEnlaceArchivo(pdf);assert.equal(app.objectUrls.at(-1).type,"application/pdf");assert.equal(await app.objectUrls.at(-1).text(),"%PDF");
 const kmz=new (require("node:buffer").File)(["PK-original"],"red.kmz",{type:"application/octet-stream"});
 app.api.mostrarEnlaceArchivo(kmz);assert.equal(app.objectUrls.at(-1).type,"application/vnd.google-earth.kmz");assert.equal(await app.objectUrls.at(-1).text(),"PK-original");
});
