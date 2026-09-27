/* ================= PDF ================= */

async function leerPDF(archivo){
const pdf=await pdfjsLib.getDocument({
data:await archivo.arrayBuffer()
}).promise;

const paginas=[];

for(let i=1;i<=pdf.numPages;i++){
const p=await pdf.getPage(i);
const c=await p.getTextContent();
paginas.push(c.items.map(x=>({
str:x.str,
transform:x.transform,
width:x.width,
height:x.height
})));
}

return paginas;
}

function analizarPDF(texto){
if(Array.isArray(texto)){
const paginasConPosicion=texto.some(pagina=>
pagina.some(item=>Array.isArray(item.transform)&&
Number.isFinite(Number(item.transform[4]))&&
Number.isFinite(Number(item.transform[5])))
);

if(paginasConPosicion)return analizarPDFEspacial(texto);

texto=texto.map(pagina=>pagina.map(item=>item.str||"").join("\n")).join("\n");
}

return analizarPDFTexto(texto);
}

function analizarPDFTexto(texto){
const lineas=String(texto||"").split(/\r?\n/)
.map(l=>limpiarTexto(l))
.filter(Boolean);

const ctos=[];
let actual=null;

for(let i=0;i<lineas.length;i++){
const l=lineas[i];

let m=l.match(/\bCTO\s+(\d+)\s*,\s*([^,]*)(?:,\s*(.*))?/i);

if(m){
actual={
cto:m[1],
nombreCto:l,
divisor:"",
patilla:"",
fibra:"",
empalme:"",
referencias:[],
evidencias:[l]
};
ctos.push(actual);
}

if(!actual)continue;

if(/DV[-\s]?\d+/i.test(l)){
const d=l.match(/(DV[-\s]?\d+)\s*[,;]?\s*(\d+)?/i);
if(d){
actual.divisor=d[1].replace(/\s+/g,"").toUpperCase();
actual.patilla=d[2]||"";
}
}

const f=l.match(/(?:FM|F\.?O\.?)\s*#?\s*(\d+(?:[-+]\d+)*)/i);
if(f)actual.fibra=f[1];

if(/EMPALME|C[_ ]?EMP|E\s*\d+/i.test(l))
actual.empalme=l;

if(/BARRIO|CALLE|AVENIDA|PLAZA|CONCHA|CARRANZA|MUNICIPIO|VIZCAYA/i.test(l))
actual.referencias.push(l);

actual.evidencias.push(l);
}

for(const c of ctos){
c.referencias=[...new Set(c.referencias)]
.filter(x=>!/^CTO/i.test(x))
.slice(0,8);

c.referencia=c.referencias.join(", ");
c.maps=enlaceBusqueda(
[c.nombreCto,c.referencia].filter(Boolean).join(" ")
);
}

return ctos;
}

function filasPDF(paginas){
const filas=[];

paginas.forEach((items,pagina)=>{
const posicionados=items
.filter(item=>Array.isArray(item.transform)&&
Number.isFinite(Number(item.transform[4]))&&
Number.isFinite(Number(item.transform[5]))&&
limpiarTexto(item.str))
.map(item=>({
texto:String(item.str),
x:Number(item.transform[4]),
y:Number(item.transform[5]),
ancho:Number(item.width)||String(item.str).length*3
}))
.sort((a,b)=>b.y-a.y||a.x-b.x);

const grupos=[];

for(const item of posicionados){
let grupo=grupos.find(f=>Math.abs(f.y-item.y)<=2.5);
if(!grupo){
grupo={pagina,y:item.y,items:[]};
grupos.push(grupo);
}
grupo.items.push(item);
grupo.y=grupo.items.reduce((s,x)=>s+x.y,0)/grupo.items.length;
}

for(const grupo of grupos){
grupo.items.sort((a,b)=>a.x-b.x);
const segmentos=[];

for(const item of grupo.items){
let segmento=segmentos.at(-1);
const finalAnterior=segmento?.items.reduce((max,x)=>Math.max(max,x.x+x.ancho),-Infinity);

if(!segmento||item.x-finalAnterior>32){
segmento={items:[]};
segmentos.push(segmento);
}

segmento.items.push(item);
}

for(const segmento of segmentos){
let texto="";
let finalAnterior=null;

for(const item of segmento.items){
if(finalAnterior!==null&&item.x-finalAnterior>2.5)texto+=" ";
texto+=item.texto;
finalAnterior=Math.max(finalAnterior??-Infinity,item.x+item.ancho);
}

const x0=Math.min(...segmento.items.map(x=>x.x));
const x1=Math.max(...segmento.items.map(x=>x.x+x.ancho));
filas.push({
pagina,y:grupo.y,texto:limpiarTexto(texto),x0,x1,
centro:(x0+x1)/2
});
}
}
});

return filas;
}

function analizarPDFEspacial(paginas){
const filas=filasPDF(paginas);
const anclas=filas.map(fila=>({
fila,
match:fila.texto.match(/\bCTO\s*(\d+)\b/i)
})).filter(x=>x.match);
const salida=[];

for(const ancla of anclas){
const {fila,match}=ancla;
const cercanas=filas.filter(x=>
x.pagina===fila.pagina&&
x!==fila&&
x.y<fila.y&&
fila.y-x.y<=70&&
Math.abs(x.centro-fila.centro)<=240
);

function masCercana(regex,limite=70){
return cercanas
.filter(x=>fila.y-x.y<=limite&&regex.test(x.texto))
.sort((a,b)=>{
const da=fila.y-a.y+Math.abs(a.centro-fila.centro)*0.5;
const db=fila.y-b.y+Math.abs(b.centro-fila.centro)*0.5;
return da-db;
})[0];
}

function mapaDivisor(texto){
const m=String(texto||"").match(/\b(DV[-\s]?\d+)\s*[,;.]\s*(\d+)(?:\s*-\s*(\d+))?\s*#\s*(\d+)(?:\s*-\s*(\d+))?/i);
if(!m)return null;
return{
divisor:m[1].replace(/\s+/g,"").toUpperCase(),
patillaInicio:Number(m[2]),
patillaFin:Number(m[3]||m[2]),
fibraInicio:Number(m[4]),
fibraFin:Number(m[5]||m[4])
};
}

function fibraDeMapa(mapa,patilla){
if(!mapa||!Number.isFinite(Number(patilla)))return"";
const anchoPatillas=mapa.patillaFin-mapa.patillaInicio;
const anchoFibras=mapa.fibraFin-mapa.fibraInicio;
if(Number(patilla)<mapa.patillaInicio||Number(patilla)>mapa.patillaFin)return"";
if(anchoPatillas===anchoFibras)
return String(mapa.fibraInicio+Number(patilla)-mapa.patillaInicio);
return mapa.patillaInicio===mapa.patillaFin?String(mapa.fibraInicio):"";
}

const filaDivisor=masCercana(/\bDV[-\s]?\d+/i,35);
const divisorTexto=filaDivisor?.texto||"";
const divisorMatch=divisorTexto.match(/(DV[-\s]?\d+)\s*[,;]?\s*(\d+)?/i);
const divisor=divisorMatch?divisorMatch[1].replace(/\s+/g,"").toUpperCase():"";
const patilla=divisorMatch?.[2]||"";

const divisorNormalizado=divisor.replace(/[-\s]/g,"");
const mapas=cercanas.map(f=>({fila:f,mapa:mapaDivisor(f.texto)}))
.filter(x=>x.mapa&&
x.mapa.divisor.replace(/[-\s]/g,"")===divisorNormalizado&&
fibraDeMapa(x.mapa,patilla));
mapas.sort((a,b)=>{
const da=fila.y-a.fila.y+Math.abs(a.fila.centro-fila.centro)*0.5;
const db=fila.y-b.fila.y+Math.abs(b.fila.centro-fila.centro)*0.5;
return da-db;
});
const mapaSeleccionado=mapas[0];

function distanciaDesde(origen,destino){
return Math.abs(origen.y-destino.y)+Math.abs(origen.centro-destino.centro)*0.5;
}

const cablesCercanos=cercanas.filter(x=>/\bA\s*\d+\s*\/\s*\d+\b/i.test(x.texto));
const filaCable=mapaSeleccionado?
cablesCercanos.sort((a,b)=>distanciaDesde(mapaSeleccionado.fila,a)-distanciaDesde(mapaSeleccionado.fila,b))[0]:
masCercana(/\bA\s*\d+\s*\/\s*\d+\b/i,55);
const cableTexto=filaCable?.texto||"";
const cable=(cableTexto.match(/\b(A\s*\d+\s*\/\s*\d+)\b/i)||[])[1]
?.replace(/\s+/g,"")||"";
const descripcionCable=(cableTexto.match(/\[\s*([^\]]+)\s*\]/)||[])[1]||"";

const filaFibra=mapaSeleccionado?null:masCercana(/(?:FM|F\.?O\.?)\s*#?\s*\d/i,65);
const fibraTexto=filaFibra?.texto||"";
const fibraMatch=fibraTexto.match(/(?:FM|F\.?O\.?)\s*#?\s*(\d+(?:[-+]\d+)*)/i);
const fibra=mapaSeleccionado?fibraDeMapa(mapaSeleccionado.mapa,patilla):fibraMatch?fibraMatch[1]:"";

const filaEmpalme=masCercana(/EMPALME|C[_ ]?EMP|\bE\s*\d+/i,45);
const empalme=filaEmpalme?.texto||"";
const referencias=[...new Set(cercanas
.filter(x=>/BARRIO|CALLE|AVENIDA|PLAZA|CONCHA|CARRANZA|MUNICIPIO|VIZCAYA/i.test(x.texto))
.map(x=>x.texto))].slice(0,8);
const referencia=referencias.join(", ");

salida.push({
cto:match[1],
nombreCto:fila.texto,
divisor,
patilla,
fibra,
empalme,
referencias,
referencia,
cable,
descripcionCable,
evidencias:[fila.texto,...new Set([divisorTexto,mapaSeleccionado?.fila.texto,cableTexto,fibraTexto,empalme].filter(Boolean))],
maps:enlaceBusqueda([fila.texto,referencia].filter(Boolean).join(" "))
});
}

return salida;
}
