/* ================= PROCESAMIENTO ================= */

function registroKML(elemento,datos,filtroEmpalme,permitirEMPNoRelacionado=false){
const tipoRegistro=(datos.empalmes||[]).some(emp=>(emp.id&&emp.id===elemento.id)||
emp===elemento)?"EMP":"CTO";
const nombre=elemento.nombreElemento||elemento.name||elemento.id||"Elemento sin nombre";
const identidad=normalizar([elemento.id,nombre].join(" "));
const filtro=normalizar(filtroEmpalme);

// El filtro de empalme selecciona los propios elementos EMP; no los adjunta
// como filas secundarias de una CTO.
if(filtro&&tipoRegistro!=="EMP")return[];
if(filtro&&!identidad.includes(filtro))return[];
if(tipoRegistro==="EMP"&&!permitirEMPNoRelacionado&&!datos.proyecto&&
!empalmeRelacionadoConCTO(elemento,datos.ctos||[]))return[];

const rel=divisorPatilla(elemento);

if(datos.proyecto&&!rel.divisor&&(tipoRegistro==="CTO"||tipoRegistro==="EMP"))
return[construirRegistroProyecto(elemento,datos,tipoRegistro)];

const cables=buscarCables(datos.cables,elemento);
const fibraElemento=String(elemento.fibIni||elemento.fibFin||"");
const cablePorFibra=cables.find(c=>
String(c.fibIni||"")===fibraElemento||String(c.fibFin||"")===fibraElemento
);
const cableElegido=cablePorFibra||cables[0]||null;
const candidatos=cableElegido?[cableElegido]:[{
cable:"No localizado",descripcionCable:"No disponible",nombreElemento:"",
longitud:"",distancia:"",evidencia:"Cable no localizado"
}];
const salida=[];

for(const cable of candidatos){
const fibra=cable.cable!=="No localizado"?
(cable.fibFin||cable.fibIni||""):(elemento.fibFin||elemento.fibIni||"");
let puntos=0;
if(elemento.id)puntos++;
if(rel.divisor)puntos++;
if(rel.patilla)puntos++;
if(fibra)puntos++;
if(cable.cable!=="No localizado")puntos++;

salida.push({
tipoRegistro,
idElemento:elemento.id||"",
elemento:nombre,
linea:elemento.nombreLinea||"",
lineasPeticion:elemento.lineasPeticion||"",
fibIni:elemento.fibIni||"",
fibFin:elemento.fibFin||"",
direccion:elemento.direccion||"",
fechaInstalacion:elemento.fechaInstalacion||"",
orden:elemento.orden||"",
unidadAlta:elemento.unidadAlta||"",
unidadBaja:elemento.unidadBaja||"",
noTe:elemento.noTe||"",
uuid:elemento.uuid||"",
estructuraInicio:elemento.estructuraInicio||"",
estructuraFinal:elemento.estructuraFinal||"",
cto:tipoRegistro==="CTO"?numeroCTO(nombre,elemento.id):"",
nombreCto:tipoRegistro==="CTO"?nombre:"",
empalme:tipoRegistro==="EMP"?(numeroCTO(nombre,elemento.id)):"",
idEmpalme:tipoRegistro==="EMP"?(elemento.id||""):"",
nombreEmpalme:tipoRegistro==="EMP"?nombre:"",
tipoEmpalme:tipoRegistro==="EMP"?(elemento.elementoTipo||""):"",
datosEmpalme:"",
divisor:rel.divisor||"No disponible",
patilla:rel.patilla||"No disponible",
fibra:fibra||"No disponible",
cable:cable.cable||"No localizado",
descripcionCable:cable.descripcionCable||"No disponible",
tipoElemento:elemento.elementoTipo||tipoRegistro,
longitud:valorUtil(elemento.longitud)||valorUtil(cable.longitud)||"",
distancia:elemento.distancia||cable.distancia||"",
lat:elemento.lat||"",
lon:elemento.lon||"",
ubicacion:elemento.lat&&elemento.lon?"Exacta · coordenadas KML":"Sin coordenadas",
referencia:elemento.lat&&elemento.lon?elemento.lat+", "+elemento.lon:"",
maps:enlaceMaps(elemento.lat,elemento.lon),
estado:puntos>=4?"Completa":puntos>=2?"Parcial":"Sin datos",
evidencias:[
tipoRegistro+": "+nombre,
"Línea: "+(elemento.nombreLinea||"No disponible"),
"Líneas petición: "+(elemento.lineasPeticion||"No disponible"),
"Divisor: "+(rel.divisor||"No localizado"),
"Patilla: "+(rel.patilla||"No localizada"),
"Fibra llegada ("+(cable.cable||"cable no localizado")+"): "+(fibra||"No disponible"),
cables.length>1?"Aviso: "+cables.length+" cables compatibles; se muestra "+(cable.cable||"el primero")+".":"",
cable.evidencia||[cable.nombreElemento,cable.nombreLinea].filter(Boolean).join(" | ")
].filter(Boolean)
});
}

return salida;
}

function registroCircuito(elemento,cadena,datos){
const nombre=elemento.nombreElemento||elemento.name||elemento.id||"Elemento sin nombre";
const cables=datos.cables||[];
const esCable=e=>cables.includes(e);
const idx=cadena.indexOf(elemento);

const anterior=idx>0?cadena[idx-1]:null;
const siguiente=idx>=0&&idx<cadena.length-1?cadena[idx+1]:null;
const tramoEntrante=anterior&&esCable(anterior)?anterior:null;
const tramoSaliente=siguiente&&esCable(siguiente)?siguiente:null;

const fibEntrante=tramoEntrante?String(tramoEntrante.fibIni||tramoEntrante.fibFin||""):"";
const fibSaliente=tramoSaliente?String(tramoSaliente.fibIni||tramoSaliente.fibFin||""):"";

let fibra="No disponible";
if(fibEntrante&&fibSaliente)fibra=fibEntrante+"->"+fibSaliente;
else if(fibEntrante)fibra=fibEntrante;
else if(fibSaliente)fibra=fibSaliente;

const nom=e=>e?(e.nombreElemento||e.name||""):"";
const nombreEntrante=tramoEntrante?nom(tramoEntrante):"";
const nombreSaliente=tramoSaliente?nom(tramoSaliente):"";

const cable=nombreSaliente||"No disponible";
const descripcionCable=[nombreEntrante,nombreSaliente]
.filter(Boolean).join(" -> ")||"No disponible";
const longitud=tramoSaliente?(valorUtil(tramoSaliente.longitud)||""):"";
const distancia=elemento.distancia||"";

const linea=elemento.nombreLinea||"";
const unidad=elemento.unidadAlta||"";
const ultimo=cadena[cadena.length-1];
const destino=ultimo?nom(ultimo):"";

const ruta=cadena.map(e=>[
e.orden||"",nom(e),e.fibIni||"",e.longitud||""
].filter(v=>v!=="").join(" ")).filter(Boolean);

const evidencias=[
...ruta,
"Circuito "+[linea,unidad].filter(Boolean).join(" ")+" · destino: "+(destino||"No disponible")
];

let puntos=0;
if(elemento.id)puntos++;
if(tramoEntrante)puntos++;
if(tramoSaliente)puntos++;
if(fibra!=="No disponible")puntos++;

return{
tipoRegistro:"EMP",
idElemento:elemento.id||"",
elemento:nombre,
linea:linea,
lineasPeticion:elemento.lineasPeticion||"",
fibIni:elemento.fibIni||"",
fibFin:elemento.fibFin||"",
direccion:elemento.direccion||"",
fechaInstalacion:elemento.fechaInstalacion||"",
orden:elemento.orden||"",
unidadAlta:unidad,
unidadBaja:elemento.unidadBaja||"",
noTe:elemento.noTe||"",
uuid:elemento.uuid||"",
estructuraInicio:elemento.estructuraInicio||"",
estructuraFinal:elemento.estructuraFinal||"",
cto:"",
nombreCto:"",
empalme:numeroCTO(nombre,elemento.id),
idEmpalme:elemento.id||"",
nombreEmpalme:nombre,
tipoEmpalme:elemento.elementoTipo||"",
datosEmpalme:"",
divisor:"No disponible",
patilla:"No disponible",
fibra:fibra,
cable:cable,
descripcionCable:descripcionCable,
tipoElemento:elemento.elementoTipo||"Circuito",
longitud:longitud,
distancia:distancia,
lat:elemento.lat||"",
lon:elemento.lon||"",
ubicacion:elemento.lat&&elemento.lon?"Exacta · coordenadas KML":"Sin coordenadas",
referencia:elemento.lat&&elemento.lon?elemento.lat+", "+elemento.lon:"",
maps:enlaceMaps(elemento.lat,elemento.lon),
estado:puntos>=3?"Completa":puntos>=1?"Parcial":"Sin datos",
evidencias:evidencias
};
}

function construirRegistroProyecto(elemento,datos,tipoRegistro){
const nombre=elemento.nombreElemento||elemento.name||elemento.id||"Elemento sin nombre";
const cables=datos.cables||[];
const px=Number(elemento.lon),py=Number(elemento.lat);
const tol=1e-6;
const cerca=(a,b)=>Number.isFinite(Number(a))&&Number.isFinite(Number(b))&&
Math.abs(Number(a)-Number(b))<=tol;

const tocaPunto=c=>{
const vs=c.vertices||[];
if(!vs.length)return false;
const p0=vs[0],p1=vs[vs.length-1];
return (cerca(p0.lon,px)&&cerca(p0.lat,py))||(cerca(p1.lon,px)&&cerca(p1.lat,py));
};

const segmentos=cables.filter(tocaPunto);
const conDV=segmentos.filter(c=>c.asignacion&&c.asignacion.lineas.length);

const rango=a=>{
if(!a.length)return"";
const s=[...a].map(Number).sort((x,y)=>x-y);
let cont=s.length>1;
for(let i=1;i<s.length;i++)if(s[i]!==s[i-1]+1)cont=false;
return cont?s[0]+"-"+s[s.length-1]:s.join("+");
};

let divisor="No disponible",patilla="No disponible",fibra="No disponible";
const fibrasSobrantes=[];
const evidenciasAsig=[];

if(segmentos.length===1&&conDV.length===1){
const lineas=conDV[0].asignacion.lineas;
divisor=lineas.map(l=>l.divisor).join("\n");
patilla=lineas.map(l=>rango(l.patillas)).join("\n");
fibra=lineas.map(l=>l.fibras.join("+")).join("\n");
}else if(segmentos.length>=2&&conDV.length>=2){
const suma=c=>c.asignacion.lineas.reduce((a,l)=>a+l.patillas.reduce((x,y)=>x+y,0),0);
const entrante=conDV.slice().sort((a,b)=>suma(b)-suma(a))[0];
const salientes=conDV.filter(c=>c!==entrante);

const porDiv=new Map();
for(const l of entrante.asignacion.lineas){
if(!porDiv.has(l.divisor))porDiv.set(l.divisor,{pat:[],fib:[]});
const d=porDiv.get(l.divisor);
d.pat.push(...l.patillas);
d.fib.push(...l.fibras);
}

const salSet=new Map();
for(const c of salientes){
for(const l of c.asignacion.lineas){
if(!salSet.has(l.divisor))salSet.set(l.divisor,{pat:new Set(),fib:new Set()});
const s=salSet.get(l.divisor);
l.patillas.forEach(p=>s.pat.add(p));
l.fibras.forEach(f=>s.fib.add(f));
}
}

const divs=[],pats=[],fibs=[];
for(const [dv,d] of porDiv){
const sal=salSet.get(dv)||{pat:new Set(),fib:new Set()};
const patCons=d.pat.filter(p=>!sal.pat.has(p));
const fibCons=d.fib.filter(f=>!sal.fib.has(f));
const emp=fibCons.slice(0,patCons.length);
fibrasSobrantes.push(...fibCons.slice(patCons.length));
divs.push(dv);
pats.push(rango(patCons));
fibs.push(emp.join("+"));
}
divisor=divs.join("\n");
patilla=pats.join("\n");
fibra=fibs.join("\n");
if(fibrasSobrantes.length)
evidenciasAsig.push("Fibras sin patilla asignada: "+
fibrasSobrantes.map(Number).sort((a,b)=>a-b).join("+"));
}else{
for(const c of segmentos){
if(!c.asignacion)continue;
for(const l of c.asignacion.lineas)
evidenciasAsig.push("Asignación "+l.divisor+","+rango(l.patillas)+"#"+l.fibras.join("+"));
for(const o of c.asignacion.otras)
evidenciasAsig.push("Asignación: "+o);
}
}

const etiquetaCable=segmentos.map(c=>c.etiqueta).filter(Boolean).join(", ");
const primero=segmentos[0];
const fo=primero&&primero.fo?primero.fo:"";
const descripcionCable=fo?fo+" FO":"No disponible";
const longitud=primero?(valorUtil(primero.longProy)||""):"";
const estadoTramo=primero&&primero.estadoProy?primero.estadoProy:"";

let puntos=0;
if(elemento.id)puntos++;
if(divisor!=="No disponible")puntos++;
if(patilla!=="No disponible")puntos++;
if(fibra!=="No disponible")puntos++;
if(etiquetaCable)puntos++;

const evidencias=[
tipoRegistro+": "+nombre,
...evidenciasAsig,
etiquetaCable?"Etiqueta cable: "+etiquetaCable:"",
estadoTramo?"Estado tramo: "+estadoTramo:""
].filter(Boolean);

return{
tipoRegistro,
idElemento:elemento.id||"",
elemento:nombre,
linea:elemento.nombreLinea||"",
lineasPeticion:elemento.lineasPeticion||"",
fibIni:elemento.fibIni||"",
fibFin:elemento.fibFin||"",
direccion:elemento.direccion||"",
fechaInstalacion:elemento.fechaInstalacion||"",
orden:elemento.orden||"",
unidadAlta:elemento.unidadAlta||"",
unidadBaja:elemento.unidadBaja||"",
noTe:elemento.noTe||"",
uuid:elemento.uuid||"",
estructuraInicio:elemento.estructuraInicio||"",
estructuraFinal:elemento.estructuraFinal||"",
cto:tipoRegistro==="CTO"?numeroCTO(nombre,elemento.id):"",
nombreCto:tipoRegistro==="CTO"?nombre:"",
empalme:tipoRegistro==="EMP"?(numeroCTO(nombre,elemento.id)):"",
idEmpalme:tipoRegistro==="EMP"?(elemento.id||""):"",
nombreEmpalme:tipoRegistro==="EMP"?nombre:"",
tipoEmpalme:tipoRegistro==="EMP"?(elemento.elementoTipo||""):"",
datosEmpalme:"",
divisor:divisor,
patilla:patilla,
fibra:fibra,
etiquetaCable:etiquetaCable,
cable:etiquetaCable||"No localizado",
descripcionCable:descripcionCable,
tipoElemento:elemento.elementoTipo||tipoRegistro,
longitud:longitud,
distancia:elemento.distancia||"",
lat:elemento.lat||"",
lon:elemento.lon||"",
ubicacion:elemento.lat&&elemento.lon?"Exacta · coordenadas KML":"Sin coordenadas",
referencia:elemento.lat&&elemento.lon?elemento.lat+", "+elemento.lon:"",
maps:enlaceMaps(elemento.lat,elemento.lon),
estado:puntos>=4?"Completa":puntos>=2?"Parcial":"Sin datos",
evidencias:evidencias
};
}

function clasificarElementosKMZ(xml,datos){
const doc=new DOMParser().parseFromString(xml,"text/xml");
if(doc.getElementsByTagName("parsererror").length)
throw Error("El KML no tiene un XML válido.");

const placemarks=[...doc.getElementsByTagName("*")]
.filter(x=>x.localName==="Placemark");
const ctos=[];
const cables=[];
const empalmes=[];

datos.elementos.forEach((elemento,i)=>{
const placemark=placemarks[i];
if(!placemark)return;

const nombre=elemento.nombreElemento||elemento.name||"";
const estilo=primer(placemark,"styleUrl");
const asignacion=(data(placemark,"Asignacion")||"")
.replace(/[−–—]/g,"-");
const longitud=data(placemark,"Longitud");
const estadoElemento=data(placemark,"Estado");
const esCTO=(datos.ctos||[]).includes(elemento)||
/(?:CTO|CtExt)/i.test(estilo)||/^CT(?:O)?[-\s]?\d+\b/i.test(nombre);
const esEMP=(datos.empalmes||[]).includes(elemento)||
/Empalme/i.test(estilo)||/^E[-\s]?\d+\b/i.test(nombre);
const esCable=(datos.cables||[]).includes(elemento)||
/(?:Fo|Cable)/i.test(estilo)||/\bA\d+\/\d+\b/i.test(nombre);

if(esCTO){
ctos.push(elemento);
elemento.elementoTipo="CTO";
}else if(esEMP){
empalmes.push(elemento);
elemento.elementoTipo="EMP";
}else if(esCable){
cables.push(elemento);
elemento.elementoTipo="Cable";
}

const identidad=nombre.match(/^(?:CTO?[-\s]?\d+|E[-\s]?\d+|O[-\s]?\d+)/i);
if(identidad)elemento.id=identidad[0];
if(asignacion)elemento.lineasPeticion=asignacion;
if(longitud)elemento.longitud=longitud;
if(estadoElemento)elemento.estadoFuente=estadoElemento;

if(esCable){
const separado=separarCable(nombre);
elemento.cable=separado.cable;
elemento.descripcionCable=separado.descripcion;
}
});

return{...datos,ctos,cables,empalmes};
}

function registroPDF(c){
return{
cto:c.cto,
nombreCto:c.nombreCto,
empalme:c.empalme||"No disponible",
idEmpalme:"",
nombreEmpalme:"",
tipoEmpalme:"",
direccionEmpalme:"",
fechaInstalacionEmpalme:"",
lineaEmpalme:"",
lineasPeticionEmpalme:"",
fibIniEmpalme:"",
fibFinEmpalme:"",
longitudEmpalme:"",
distanciaEmpalme:"",
ordenEmpalme:"",
unidadAltaEmpalme:"",
unidadBajaEmpalme:"",
noTeEmpalme:"",
uuidEmpalme:"",
latEmpalme:"",
lonEmpalme:"",
estructuraInicioEmpalme:"",
estructuraFinalEmpalme:"",
datosEmpalme:"",
divisor:c.divisor||"No disponible",
patilla:c.patilla||"No disponible",
fibra:c.fibra||"No disponible",
cable:c.cable||"No disponible",
etiquetaCable:[c.etiquetaCable,c.longitudCable,c.distanciaCable].filter(Boolean).join("\n"),
descripcionCable:c.descripcionCable||"PDF sin geometría de cable",
tipoElemento:"PDF",
longitud:c.longitudCable||"",
distancia:c.distanciaCable||"",
lat:"",
lon:"",
ubicacion:c.referencia?
"Aproximada · referencia PDF":"Sin ubicación",
referencia:c.referencia,
maps:c.maps,
estado:c.divisor&&c.fibra?"Parcial":"Sin datos",
evidencias:c.evidencias
};
}

function claveRegistro(x){
return normalizar([
x.tipoRegistro,x.idElemento,x.elemento,x.cto,x.empalme,x.divisor,x.patilla,
x.fibra,x.cable,x.lat,x.lon
].join("|"));
}

function deduplicarRegistros(a){
const mapa=new Map();

for(const x of a){
const k=claveRegistro(x);

if(!mapa.has(k)){
mapa.set(k,x);
}else{
const anterior=mapa.get(k);
anterior.evidencias=[
...new Set([
...anterior.evidencias,
...x.evidencias
])
];
eliminados++;
}
}

return [...mapa.values()];
}

async function extraer(){
const archivo=$("archivo").files[0];

if(!archivo){
estado("Selecciona primero un archivo.","error");
return;
}

registros=[];
elementosPDF=[];
eliminados=0;

try{
estado("Procesando "+archivo.name+"...");
$("diagnostico").textContent="";
$("texto").textContent="Procesando...";

const nombre=archivo.name.toLowerCase();

if(nombre.endsWith(".kml")||nombre.endsWith(".kmz")){
const xml=await leerKMLKMZ(archivo);
textoOriginal=xml;
$("texto").textContent=xml;

const esKMZ=nombre.endsWith(".kmz");
const datosKML=analizarKML(xml);
const datos=esKMZ?clasificarElementosKMZ(xml,datosKML):datosKML;
const filtros=lista($("ctos").value);
const filtroEmpalme=limpiarTexto($("empalme").value);

const empalmesRelacionados=datos.empalmes.filter(empalme=>
empalmeRelacionadoConCTO(empalme,datos.ctos)
);

// Modo circuito: KML sin CTOs pero con empalmes. Los elementos de equipo
// (EMP, REP_F, TM_FO) son los protagonistas y la ruta de la FO se sigue por
// ordenTramo dentro de la misma línea+unidad. Si hay CTOs, comportamiento actual.
// El modo proyecto (XML2KMZ con estilos) tiene prioridad sobre el circuito.
const modoCircuito=!datos.proyecto&&!datos.ctos.length&&datos.empalmes.length>0;
let elementos;

if(modoCircuito){
const aNum=v=>Number(v)||0;
const cadenas=new Map();

for(const e of datos.elementos){
const k=(e.nombreLinea||"")+"|"+(e.unidadAlta||"");
if(!cadenas.has(k))cadenas.set(k,[]);
cadenas.get(k).push(e);
}

const equipos=[];
for(const cadena of cadenas.values()){
cadena.sort((a,b)=>aNum(a.orden)-aNum(b.orden));
const esCable=e=>(datos.cables||[]).includes(e);
for(const e of cadena){
if(!esCable(e))equipos.push({elemento:e,cadena});
}
}

const filtrados=filtros.length?equipos.filter(({elemento})=>{
const numero=numeroCTO(elemento.nombreElemento||elemento.name,elemento.id);
const texto=normalizar([elemento.id,elemento.name,elemento.nombreElemento].join(" "));
return filtros.some(filtro=>
filtro===numero||filtro===elemento.id||texto.includes(normalizar(filtro))
);
}):equipos;

registros=filtrados.map(({elemento,cadena})=>registroCircuito(elemento,cadena,datos));
elementos=[];
}else{
const empalmes=(esKMZ||datos.proyecto)?datos.empalmes:empalmesRelacionados;
elementos=[...datos.ctos,...empalmes];
}

if(filtros.length){
elementos=elementos.filter(elemento=>{
const numero=numeroCTO(elemento.nombreElemento||elemento.name,elemento.id);
const texto=normalizar([elemento.id,elemento.name,elemento.nombreElemento].join(" "));
return filtros.some(filtro=>
filtro===numero||filtro===elemento.id||texto.includes(normalizar(filtro))
);
});
}

for(const elemento of elementos)
registros.push(...registroKML(elemento,datos,filtroEmpalme,esKMZ));

$("diagnostico").innerHTML=
"Placemark: <b>"+datos.elementos.length+"</b> · "+
"CTO: <b>"+datos.ctos.length+"</b> · "+
"Cables: <b>"+datos.cables.length+"</b> · "+
"EMP detectados: <b>"+datos.empalmes.length+"</b> · "+
"EMP asociados a CTO (mismo divisor/patilla): <b>"+empalmesRelacionados.length+"</b> · "+
"Elementos con coordenadas: <b>"+
elementos.filter(x=>x.lat&&x.lon).length+"</b>";

}else if(nombre.endsWith(".pdf")){
const paginas=await leerPDF(archivo);
const texto=paginas.map(pagina=>pagina.map(item=>item.str||"").join("\n")).join("\n");
textoOriginal=texto;
$("texto").textContent=texto;

elementosPDF=analizarPDF(paginas);
const filtros=lista($("ctos").value);

let ctos=elementosPDF;

if(filtros.length)
ctos=ctos.filter(c=>filtros.includes(c.cto));

const filtroEmpalme=normalizar($("empalme").value);

if(filtroEmpalme)
ctos=ctos.filter(c=>
normalizar(c.empalme+" "+c.evidencias.join(" "))
.includes(filtroEmpalme)
);

registros=ctos.map(registroPDF);

$("diagnostico").innerHTML=
"Páginas PDF procesadas · CTO detectadas: <b>"+
elementosPDF.length+"</b> · Ubicaciones aproximadas: <b>"+
elementosPDF.filter(x=>x.referencia).length+"</b>";

}else{
throw Error("Formato no compatible.");
}

registros=deduplicarRegistros(registros);
pintar();
$("csv").disabled=!registros.length;

estado(
"Procesado correctamente. Resultados: "+
registros.length+" · Duplicados eliminados: "+
eliminados,
registros.length?"ok":"error"
);

}catch(e){
console.error(e);
estado("Error procesando el archivo: "+e.message,"error");
$("csv").disabled=true;
}
}
