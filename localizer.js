/* ================= LOCALIZADOR DE CORTES =================
   Elige un elemento "Origen de Medicion" y calcula donde cae un corte a X
   metros DESDE ese origen, recorriendo la cadena por ordenTramo.
   Motor puro (sin DOM): calcularPosicionDeCorte y detectarRaices.
*/

const SLACK_EQUIPO=5;

function _num(v){
if(v==null)return 0;
const m=String(v).replace(",",".").match(/-?\d+(\.\d+)?/);
return m?Number(m[0]):0;
}

function _rad(a){return a*Math.PI/180;}

function _haversineM(a,b){
const R=6371000;
const dLat=_rad(b.lat-a.lat),dLon=_rad(b.lon-a.lon);
const la1=_rad(a.lat),la2=_rad(b.lat);
const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
}

function _longGeom(vertices){
let d=0;
for(let i=1;i<vertices.length;i++)
d+=_haversineM({lat:+vertices[i-1].lat,lon:+vertices[i-1].lon},{lat:+vertices[i].lat,lon:+vertices[i].lon});
return d;
}

function _txt(e){
return ((e.nombreElemento||"")+" "+(e.name||"")+" "+(e.styleUrl||""));
}

function _esAereo(e){return /AER|AÉR|AERE/i.test(_txt(e));}
function _esSubterraneo(e){return /CAN|SUBTER|SUB\b/i.test((e.nombreElemento||"")+" "+(e.name||""));}
function _esEquipo(e){return !e.esLinea;}

function _factorTortuosidad(longM,e){
if(_esAereo(e))return 1.02;
if(_esSubterraneo(e)){
if(longM>500)return 1.15;
if(longM>100)return 1.08;
return 1.08;
}
return 1.02;
}

function _interpolar(vertices,fraccion){
if(!vertices||!vertices.length)return null;
if(vertices.length===1||fraccion<=0)return{lat:+vertices[0].lat,lon:+vertices[0].lon};
const segs=[];let total=0;
for(let i=1;i<vertices.length;i++){
const d=_haversineM({lat:+vertices[i-1].lat,lon:+vertices[i-1].lon},{lat:+vertices[i].lat,lon:+vertices[i].lon});
segs.push({a:i-1,b:i,d});total+=d;
}
if(total<=0)return{lat:+vertices[0].lat,lon:+vertices[0].lon};
let obj=fraccion*total;
for(const s of segs){
if(obj<=s.d||s===segs[segs.length-1]){
const f=s.d>0?Math.min(1,obj/s.d):0;
const a=vertices[s.a],b=vertices[s.b];
return{lat:+a.lat+(+b.lat-+a.lat)*f,lon:+a.lon+(+b.lon-+a.lon)*f};
}
obj-=s.d;
}
const l=vertices[vertices.length-1];
return{lat:+l.lat,lon:+l.lon};
}

function calcularPosicionDeCorte(circuitoArray,metrosDesdeOrigen,idElementoOrigen){
const lista=(circuitoArray||[]).filter(Boolean).slice();
lista.sort((a,b)=>(_num(a.orden)||0)-(_num(b.orden)||0));
const idx=lista.findIndex(e=>(e.id||"")===idElementoOrigen);
if(idx<0)return{error:"Origen no encontrado en el circuito",idOrigen:idElementoOrigen};

const camino=lista.slice(idx);
const origen=camino[0];
const nombreOrigen=origen.nombreElemento||origen.name||origen.id||"";
const metros=Number(metrosDesdeOrigen)||0;

let acum=0;
const ruta=[nombreOrigen];

for(let k=0;k<camino.length;k++){
const e=camino[k];
if(k===0&&_esEquipo(e))continue;

if(_esEquipo(e)){
if(k>0&&metros>0&&acum+SLACK_EQUIPO>=metros){
return{encontrado:true,metros,nombreOrigen,idOrigen:idElementoOrigen,
ordenTramo:e.orden,tramoId:e.id,tramoNombre:e.nombreElemento||e.name||"",tipo:"EQUIPMENT",
estructuraInicio:e.estructuraInicio||"",estructuraFinal:e.estructuraFinal||"",
lat:e.lat,lon:e.lon,ruta:ruta.slice()};
}
acum+=SLACK_EQUIPO;
ruta.push((e.nombreElemento||e.name||e.id||"")+" (+"+SLACK_EQUIPO+" m)");
continue;
}

const longDecl=_num(e.longitud);
const base=longDecl>0?longDecl:_longGeom(e.vertices||[]);
const factor=_factorTortuosidad(base,e);
const efectiva=base*factor;

if(acum+efectiva>=metros){
const dentro=metros-acum;
const frac=efectiva>0?Math.max(0,Math.min(1,dentro/efectiva)):0;
const p=_interpolar(e.vertices||[],frac)||{lat:e.lat,lon:e.lon};
return{encontrado:true,metros,nombreOrigen,idOrigen:idElementoOrigen,
ordenTramo:e.orden,tramoId:e.id,tramoNombre:e.nombreElemento||e.name||"",tipo:"TRANSMEDIA",
estructuraInicio:e.estructuraInicio||"",estructuraFinal:e.estructuraFinal||"",
lat:p.lat,lon:p.lon,factorTortuosidad:factor,longitudTramo:base,ruta:ruta.slice()};
}
acum+=efectiva;
ruta.push((e.nombreElemento||e.name||e.id||"")+" ("+Math.round(efectiva)+" m)");
}

return{encontrado:false,metros,nombreOrigen,idOrigen:idElementoOrigen,
metrosAcumulados:acum,mensaje:"La distancia supera el circuito desde el origen.",ruta:ruta.slice()};
}

function detectarRaices(circuitoArray){
const lista=(circuitoArray||[]).filter(Boolean).slice();
lista.sort((a,b)=>(_num(a.orden)||0)-(_num(b.orden)||0));
const equipos=lista.filter(_esEquipo);
const esRaizNombre=e=>{
const t=(e.nombreElemento||"")+" "+(e.name||"");
return /(^|[^A-Za-z])(CT|CENTRAL|CABECERA)/i.test(t)||/REP[_ ]?F|REP\b/i.test(t);
};
const porNombre=equipos.filter(esRaizNombre);
const raiz=porNombre[0]||equipos[0]||null;
const _opt=e=>({id:e.id,nombre:e.nombreElemento||e.name||e.id,orden:e.orden});
return{
raices:porNombre.map(_opt),
porDefecto:raiz?raiz.id:"",
opciones:equipos.map(_opt)
};
}

/* ================= UI DEL LOCALIZADOR ================= */

let _circuitoLocalizador=[];

function poblarOrigenes(circuitoArray){
_circuitoLocalizador=(circuitoArray||[]).filter(Boolean);
const sel=$("origenMedicion");
if(!sel)return;
const info=detectarRaices(_circuitoLocalizador);
const opciones=info.opciones.length?info.opciones:info.raices;
sel.innerHTML=opciones.map(o=>
'<option value="'+escapar(String(o.id))+'">'+escapar(o.nombre)+
(opciones.length>1?' (orden '+escapar(String(o.orden))+')':'')+'</option>').join("");
if(info.porDefecto)sel.value=info.porDefecto;
}

function calcularLocalizador(){
const metros=Number(($("metrosCorte")||{}).value||0);
const idOrigen=($("origenMedicion")||{}).value||"";
const caja=$("resultadoLocalizador");
if(!caja)return;
if(!_circuitoLocalizador.length||!idOrigen){
caja.innerHTML='<div class="estado">Primero extrae un circuito para localizar.</div>';
return;
}
renderizarLocalizador(calcularPosicionDeCorte(_circuitoLocalizador,metros,idOrigen));
}

function renderizarLocalizador(r){
const caja=$("resultadoLocalizador");
if(!caja)return;
if(!r){caja.innerHTML="";return;}
if(r.error){caja.innerHTML='<div class="estado error">'+escapar(r.error)+'</div>';return;}
if(!r.encontrado){
caja.innerHTML='<div class="estado">La distancia ('+escapar(String(r.metros))+
' m) supera el circuito. Acumulado: '+escapar(String(Math.round(r.metrosAcumulados||0)))+' m.</div>';
return;
}
const maps=enlaceMaps(r.lat,r.lon);
const rutaHtml=(r.ruta||[]).map(x=>'<li>'+escapar(x)+'</li>').join("");
caja.innerHTML=
'<div class="resumen">'+
'<div class="indicador">📍 Corte estimado a <strong>'+escapar(String(r.metros))+
'</strong> m desde <strong>'+escapar(r.nombreOrigen)+'</strong></div>'+
'</div>'+
'<div>Ubicación: Tramo '+escapar(String(r.ordenTramo))+' ('+escapar(r.tipo)+
'), entre '+escapar(r.estructuraInicio||"—")+' y '+escapar(r.estructuraFinal||"—")+'</div>'+
'<div class="coordenadas">Coordenadas: '+escapar(String(r.lat))+', '+escapar(String(r.lon))+
(maps?' <a class="btn-maps" target="_blank" href="'+escapar(maps)+'">Abrir en Maps</a>':'')+'</div>'+
'<div>Ruta seguida:<ul>'+rutaHtml+'</ul></div>';
}

function inicializarLocalizador(){
const btn=$("localizar");
if(btn&&!btn.__loc){btn.addEventListener("click",calcularLocalizador);btn.__loc=true;}
}

