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
if(tipoRegistro==="EMP"&&!permitirEMPNoRelacionado&&
!empalmeRelacionadoConCTO(elemento,datos.ctos||[]))return[];

const rel=divisorPatilla(elemento);
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
longitud:elemento.longitud||cable.longitud||"",
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
const empalmes=esKMZ?datos.empalmes:empalmesRelacionados;
let elementos=[...datos.ctos,...empalmes];

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
