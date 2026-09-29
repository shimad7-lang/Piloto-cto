/* ================= TABLA ================= */

function pintar(){
const tabla=$("tabla");

if(!registros.length){
tabla.innerHTML=
'<tr><td colspan="9" class="vacia">No se han encontrado resultados.</td></tr>';
$("resumen").innerHTML="";
return;
}

const completas=registros.filter(x=>x.estado==="Completa").length;
const parciales=registros.filter(x=>x.estado==="Parcial").length;
const ctos=new Set(registros.filter(x=>x.tipoRegistro!="EMP").map(x=>x.idElemento||x.cto||x.elemento)).size;
const empalmes=new Set(registros.filter(x=>x.tipoRegistro==="EMP").map(x=>x.idElemento||x.elemento)).size;
const exactas=registros.filter(x=>x.lat&&x.lon).length;
const aproximadas=registros.filter(x=>!x.lat&&x.referencia).length;

$("resumen").innerHTML=`
<div class="indicador"><strong>${ctos}</strong>CTO</div>
<div class="indicador"><strong>${empalmes}</strong>EMP</div>
<div class="indicador"><strong>${registros.length}</strong>Resultados</div>
<div class="indicador"><strong>${completas}</strong>Completos</div>
<div class="indicador"><strong>${parciales}</strong>Parciales</div>
<div class="indicador"><strong>${exactas}</strong>Maps exactos</div>
<div class="indicador"><strong>${aproximadas}</strong>Maps aproximados</div>
`;

tabla.innerHTML=registros.map((x,i)=>{
const clase=x.estado==="Completa"?"completa":
x.estado==="Parcial"?"parcial":"no";

const maps=x.maps?
`<a class="btn-maps" target="_blank" href="${escapar(x.maps)}">Abrir Maps</a>`:
"Sin enlace";

const copiar=x.referencia?
`<button class="btn-copiar" onclick="copiarTexto(${i})">Copiar</button>`:"";
const identidad=x.elemento||x.nombreCto||x.nombreEmpalme||x.cto||"No disponible";
const etiquetaCable=x.etiquetaCable||[
x.cable,x.descripcionCable,x.tipoElemento,x.longitud,x.distancia
].filter(v=>v&&v!=="No disponible").join("\n");
const evidencias=x.evidencias?.length?
`<details class="evidencias"><summary>Ver ${x.evidencias.length} datos</summary>${x.evidencias.map(e=>`<div class="evidencia">${escapar(e)}</div>`).join("")}</details>`:
"—";

return`
<tr>
<td>${escapar(identidad)}</td>
<td>${escapar(x.divisor)}</td>
<td>${escapar(x.patilla)}</td>
<td>${escapar(x.fibra)}</td>
<td class="etiqueta-cable">${escapar(etiquetaCable)}</td>
<td>
<div>${escapar(x.ubicacion)}</div>
<div class="coordenadas">${escapar(x.referencia)}</div>
${copiar}
</td>
<td>${maps}</td>
<td><span class="badge ${clase}">${escapar(x.estado)}</span></td>
<td>${evidencias}</td>
</tr>`;
}).join("");
}

function copiarTexto(i){
const x=registros[i];
const texto=x.lat&&x.lon?
x.lat+","+x.lon:
x.referencia||"";
navigator.clipboard.writeText(texto)
.then(()=>estado("Datos de ubicación copiados.","ok"))
.catch(()=>estado("No se pudo copiar automáticamente.","error"));
}

/* ================= CSV ================= */

function campoCSV(v){
return'"'+String(v??"").replaceAll('"','""')+'"';
}

function descargarCSV(){
if(!registros.length)return;

const cab=[
"Elemento CTO / EMP","Tipo elemento","ID elemento","Línea","Líneas petición",
"Fibra inicial","Fibra final","Dirección","Fecha instalación","Orden tramo",
"Unidad alta","Unidad baja","NoTe","UUID","Estructura inicio","Estructura final",
"Divisor","Patilla","Fibra",
"Etiqueta cable",
"Ubicación","Referencia/Coordenadas","Enlace Maps",
"Estado","Evidencias"
];

const filas=registros.map(x=>[
x.elemento||(x.tipoRegistro==="EMP"?x.nombreEmpalme:x.nombreCto)||x.nombreCto||x.nombreEmpalme||x.cto,
x.tipoRegistro||x.tipoEmpalme||x.tipoElemento,x.idElemento||x.idEmpalme,
x.linea||x.lineaEmpalme,x.lineasPeticion||x.lineasPeticionEmpalme,
x.fibIni||x.fibIniEmpalme,x.fibFin||x.fibFinEmpalme,x.direccion||x.direccionEmpalme,
x.fechaInstalacion||x.fechaInstalacionEmpalme,x.orden||x.ordenEmpalme,
x.unidadAlta||x.unidadAltaEmpalme,x.unidadBaja||x.unidadBajaEmpalme,x.noTe||x.noTeEmpalme,
x.uuid||x.uuidEmpalme,x.estructuraInicio||x.estructuraInicioEmpalme,x.estructuraFinal||x.estructuraFinalEmpalme,
x.divisor,x.patilla,x.fibra,
x.etiquetaCable||[x.cable,x.descripcionCable,x.tipoElemento,x.longitud,x.distancia].filter(v=>v&&v!=="No disponible").join("\n"),
x.ubicacion,x.referencia,x.maps,x.estado,
x.evidencias.join(" | ")
]);

const contenido=[cab,...filas]
.map(f=>f.map(campoCSV).join(";"))
.join("\n");

const blob=new Blob(["\ufeff"+contenido],{
type:"text/csv;charset=utf-8"
});

const a=document.createElement("a");
a.href=URL.createObjectURL(blob);
a.download="resultados_cto_v2_3.csv";
a.click();

setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
