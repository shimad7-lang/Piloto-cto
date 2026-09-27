/* ================= KML/KMZ ================= */

async function leerKMLKMZ(archivo){
const n=archivo.name.toLowerCase();

if(n.endsWith(".kml"))return await archivo.text();

const zip=await JSZip.loadAsync(await archivo.arrayBuffer());
const nombres=Object.keys(zip.files)
.filter(x=>x.toLowerCase().endsWith(".kml"))
.sort((a,b)=>{
if(a.toLowerCase()==="doc.kml")return-1;
if(b.toLowerCase()==="doc.kml")return 1;
return a.length-b.length;
});

if(!nombres.length)throw Error("El KMZ no contiene ningún KML.");
return await zip.files[nombres[0]].async("text");
}

function analizarKML(xml){
const doc=new DOMParser().parseFromString(xml,"text/xml");
if(doc.getElementsByTagName("parsererror").length)
throw Error("El KML no tiene un XML válido.");

const ps=[...doc.getElementsByTagName("*")]
.filter(x=>x.localName==="Placemark");

const elementos=ps.map(p=>{
const id=p.getAttribute("id")||data(p,"id")||"";
const name=primer(p,"name");
const ne=nombreElemento(p)||name;
const cable=separarCable(ne);
const coordenadas=primer(p,"coordinates");
let lon="",lat="";

if(coordenadas){
const c=coordenadas.split(/\s+/)[0].split(",");
lon=c[0]||"";
lat=c[1]||"";
}

return{
id,name,nombreElemento:ne,
elementoTipo:data(p,"elementType"),
direccion:data(p,"direction"),
fechaInstalacion:data(p,"fechaInstalacion"),
nombreLinea:data(p,"nombreLinea"),
lineasPeticion:data(p,"lineasPeticion"),
fibIni:data(p,"fibIni"),
fibFin:data(p,"fibFin"),
longitud:data(p,"longitudElemento"),
distancia:data(p,"distanciaAcumulada"),
noTe:data(p,"noTe"),
estructuraInicio:data(p,"estructuraInicio"),
estructuraFinal:data(p,"estructuraFinal"),
orden:data(p,"ordenTramo"),
unidadAlta:data(p,"unidadAlta"),
unidadBaja:data(p,"unidadBaja"),
uuid:data(p,"uuid"),
coordenadas,
lat,lon,
cable:cable.cable,
descripcionCable:cable.descripcion
};
});

const ctos=elementos.filter(x=>
/CTO/i.test(x.name)||/CTO/i.test(x.nombreElemento)
);

const cables=elementos.filter(x=>
/^FO:/i.test(x.name)||x.cable||/\bFO\b/i.test(x.nombreElemento)
);

const empalmes=elementos.filter(x=>
/C_EMP|EMPALME/i.test(x.name+" "+x.nombreElemento)
);

return{elementos,ctos,cables,empalmes};
}

function divisorPatilla(c){
const t=[
c.lineasPeticion,c.nombreLinea,c.nombreElemento
].join(" ");

let m=t.match(/(DV[-\s]?\d+)\s*[,;]\s*(\d+)/i);
if(m)return{
divisor:m[1].replace(/\s+/g,"").toUpperCase(),
patilla:m[2]
};

m=t.match(/(DV[-\s]?\d+)/i);
return{
divisor:m?m[1].replace(/\s+/g,"").toUpperCase():"",
patilla:""
};
}

function buscarEmpalmes(datos,cto,divisor,filtro){
const salida=[];
const numero=divisor.replace(/[^\d]/g,"");
const objetivo=normalizar(filtro);

for(const e of datos.empalmes){
const t=[
e.name,e.nombreElemento,e.nombreLinea,e.lineasPeticion
].join(" ");

if(!new RegExp("DV[- ]?"+numero,"i").test(t)&&
!t.toUpperCase().includes(divisor.toUpperCase()))continue;

const numeroEmpalme=
(e.nombreElemento.match(/N[º°]?\s*(\d+)/i)||[])[1]||
(e.name.match(/(\d+)/)||[])[1]||
e.id;

const identidad=normalizar(
numeroEmpalme+" "+e.nombreElemento+" "+e.name
);

if(objetivo&&!identidad.includes(objetivo)&&
!objetivo.includes(normalizar(numeroEmpalme)))continue;

salida.push({
valor:numeroEmpalme,
e:e,
evidencia:e.name+" → "+(e.nombreElemento||e.lineasPeticion)
});
}

return dedupEmpalmes(salida);
}

function dedupEmpalmes(a){
const s=new Set();
return a.filter(x=>{
const k=normalizar(x.valor+"|"+x.evidencia);
if(s.has(k))return false;
s.add(k);return true;
});
}

function buscarCables(cables,cto){
const salida=[];
const linea=normalizar(cto.nombreLinea);
const estructura=normalizar(cto.estructuraInicio);
const fibra=String(cto.fibIni||cto.fibFin||"");
const ordenCTO=Number(cto.orden);

// La conexión topológica identifica el cable que termina en la estructura
// de la CTO. Es más específica que compartir línea o número de fibra.
if(estructura){
const llegadas=cables.filter(c=>
normalizar(c.estructuraFinal)===estructura&&
(!linea||normalizar(c.nombreLinea)===linea)
);

if(llegadas.length)return dedupCables(llegadas);
}

if(linea&&Number.isInteger(ordenCTO)){
const tramoAnterior=cables.filter(c=>
normalizar(c.nombreLinea)===linea&&
Number(c.orden)===ordenCTO-1
);

if(tramoAnterior.length){
// Si hay varios cables del tramo anterior, la fibra que figura en el
// elemento ayuda a discriminar cuál de ellos llega a la CTO.
const mismaFibra=tramoAnterior.filter(c=>
String(c.fibIni||"")===fibra||String(c.fibFin||"")===fibra
);
return dedupCables(mismaFibra.length?mismaFibra:tramoAnterior);
}
}

for(const c of cables){
const coincide=
(linea&&normalizar(c.nombreLinea)===linea)||
(estructura&&(
normalizar(c.estructuraInicio)===estructura||
normalizar(c.estructuraFinal)===estructura))||
(fibra&&(c.fibIni===fibra||c.fibFin===fibra));

if(coincide)salida.push(c);
}

const coincidentes=dedupCables(salida);

return coincidentes;
}

function dedupCables(a){
const s=new Set();
return a.filter(x=>{
const k=normalizar([
x.cable,x.descripcionCable,x.nombreLinea,
x.fibIni,x.fibFin,x.longitud
].join("|"));
if(s.has(k))return false;
s.add(k);return true;
});
}
