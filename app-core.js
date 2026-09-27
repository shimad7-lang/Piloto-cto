if(typeof pdfjsLib!=="undefined"){
  pdfjsLib.GlobalWorkerOptions.workerSrc=
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}
let registros=[];
let elementosPDF=[]
let textoOriginal="";
let eliminados=0;
let archivoCompartido=null;

const $=id=>document.getElementById(id);



function limpiarTexto(v){
return String(v??"").replace(/\s+/g," ").trim();
}

function escapar(v){
return String(v??"")
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");
}

function estado(m,t=""){
$("estado").textContent=m;
$("estado").className="estado "+t;
}

function normalizar(v){
return limpiarTexto(v)
.toUpperCase()
.normalize("NFD")
.replace(/[\u0300-\u036f]/g,"")
.replace(/[^A-Z0-9]+/g,"");
}

function lista(v){
return String(v||"")
.split(/[\s,;]+/)
.map(x=>x.replace(/^CTO/i,"").trim())
.filter(Boolean);
}

function nombreElemento(p){
const n=[...p.getElementsByTagName("*")]
.find(x=>x.localName==="Data"&&x.getAttribute("name")==="nombreElemento");
const value=n?[...n.getElementsByTagName("*")]
.find(x=>x.localName==="value"):null;
return value?limpiarTexto(value.textContent):"";
}

function data(p,nombre){
const d=[...p.getElementsByTagName("*")]
.find(x=>x.localName==="Data"&&x.getAttribute("name")===nombre);
if(!d)return"";
const v=[...d.getElementsByTagName("*")]
.find(x=>x.localName==="value");
return v?limpiarTexto(v.textContent):"";
}

function primer(p,nombre){
const x=[...p.getElementsByTagName("*")]
.find(e=>e.localName===nombre);
return x?limpiarTexto(x.textContent):"";
}

function separarCable(nombre){
const t=limpiarTexto(nombre);
let m=t.match(/^(.+?),\s*(A\d+\/\d+.*)$/i);
if(m)return{descripcion:limpiarTexto(m[1]),cable:limpiarTexto(m[2])};
m=t.match(/\b(A\d+\/\d+)\b/i);
return{
descripcion:m?limpiarTexto(t.replace(m[1],"").replace(/,\s*$/,"")):t,
cable:m?m[1]:""
};
}

function numeroCTO(nombre,id){
let m=String(nombre).match(/CTO[^0-9]*(\d+)/i);
return m?m[1]:(id||"");
}

function enlaceMaps(lat,lon){
if(lat===""||lon==="")return"";
return"https://www.google.com/maps/search/?api=1&query="+
encodeURIComponent(lat+","+lon);
}

function enlaceBusqueda(texto){
if(!texto)return"";
return"https://www.google.com/maps/search/?api=1&query="+
encodeURIComponent(texto);
}
