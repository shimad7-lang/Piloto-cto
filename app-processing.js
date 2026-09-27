/* ================= PROCESAMIENTO ================= */

function registroKML(cto,datos,filtroEmpalme){
const rel=divisorPatilla(cto);
const fibra=cto.fibIni||cto.fibFin||"";
const emps=rel.divisor?
buscarEmpalmes(datos,cto,rel.divisor,filtroEmpalme):[];

if(filtroEmpalme&&!emps.length)return[];

const cables=buscarCables(datos.cables,cto);
const ee=emps.length?emps:[{
valor:"No disponible",
evidencia:"Empalme no localizado"
}];

const cc=cables.length?cables:[{
cable:"No localizado",
descripcionCable:"No disponible",
nombreElemento:"",
longitud:"",
distancia:"",
evidencia:"Cable no localizado"
}];

const salida=[];

for(const e of ee)for(const c of cc){
let puntos=0;
if(cto.id)puntos++;
if(rel.divisor)puntos++;
if(rel.patilla)puntos++;
if(fibra)puntos++;
if(e.valor!=="No disponible")puntos++;
if(c.cable!=="No localizado")puntos++;

salida.push({
cto:numeroCTO(cto.nombreElemento,cto.id),
nombreCto:cto.nombreElemento,
empalme:e.valor,
divisor:rel.divisor||"No disponible",
patilla:rel.patilla||"No disponible",
fibra:fibra||"No disponible",
cable:c.cable||"No localizado",
descripcionCable:c.descripcionCable||"No disponible",
tipoElemento:c.nombreElemento||cto.elementoTipo,
longitud:c.longitud||cto.longitud,
distancia:c.distancia||cto.distancia,
lat:cto.lat,
lon:cto.lon,
ubicacion:cto.lat&&cto.lon?
"Exacta · coordenadas KML":"Sin coordenadas",
referencia:cto.lat&&cto.lon?
cto.lat+", "+cto.lon:"",
maps:enlaceMaps(cto.lat,cto.lon),
estado:puntos>=5?"Completa":puntos>=2?"Parcial":"Sin datos",
evidencias:[
"CTO: "+cto.nombreElemento,
"Divisor: "+(rel.divisor||"No localizado"),
"Patilla: "+(rel.patilla||"No localizada"),
"Fibra: "+(fibra||"No localizada"),
e.evidencia||"",
c.evidencia||(
c.nombreElemento+" | "+c.nombreLinea
)
]
});
}

return salida;
}

function registroPDF(c){
return{
cto:c.cto,
nombreCto:c.nombreCto,
empalme:c.empalme||"No disponible",
divisor:c.divisor||"No disponible",
patilla:c.patilla||"No disponible",
fibra:c.fibra||"No disponible",
cable:c.cable||"No disponible",
descripcionCable:c.descripcionCable||"PDF sin geometría de cable",
tipoElemento:"PDF",
longitud:"",
distancia:"",
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
x.cto,x.empalme,x.divisor,x.patilla,
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

const datos=analizarKML(xml);
const filtros=lista($("ctos").value);
const filtroEmpalme=limpiarTexto($("empalme").value);

let ctos=datos.ctos;

if(filtros.length){
ctos=ctos.filter(c=>{
const n=numeroCTO(c.nombreElemento,c.id);
return filtros.includes(n)||filtros.includes(c.id);
});
}

for(const c of ctos)
registros.push(...registroKML(c,datos,filtroEmpalme));

$("diagnostico").innerHTML=
"Placemark: <b>"+datos.elementos.length+"</b> · "+
"CTO: <b>"+datos.ctos.length+"</b> · "+
"Cables: <b>"+datos.cables.length+"</b> · "+
"Empalmes: <b>"+datos.empalmes.length+"</b> · "+
"CTO con coordenadas: <b>"+
datos.ctos.filter(x=>x.lat&&x.lon).length+"</b>";

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
