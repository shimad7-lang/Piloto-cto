/* ================= TABLA ================= */

function pintar(){
const tabla=$("tabla");

if(!registros.length){
tabla.innerHTML=
'<tr><td colspan="18" class="vacia">No se han encontrado resultados.</td></tr>';
$("resumen").innerHTML="";
return;
}

const completas=registros.filter(x=>x.estado==="Completa").length;
const parciales=registros.filter(x=>x.estado==="Parcial").length;
const ctos=new Set(registros.map(x=>x.cto)).size;
const exactas=registros.filter(x=>x.lat&&x.lon).length;
const aproximadas=registros.filter(x=>!x.lat&&x.referencia).length;

$("resumen").innerHTML=`
<div class="indicador"><strong>${ctos}</strong>CTO</div>
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

return`
<tr>
<td>${escapar(x.cto)}</td>
<td>${escapar(x.nombreCto)}</td>
<td>${escapar(x.empalme)}</td>
<td>${escapar(x.idEmpalme)}</td>
<td>${escapar(x.nombreEmpalme)}</td>
<td>${escapar(x.datosEmpalme)}</td>
<td>${escapar(x.divisor)}</td>
<td>${escapar(x.patilla)}</td>
<td>${escapar(x.fibra)}</td>
<td>${escapar(x.cable)}</td>
<td>${escapar(x.descripcionCable)}</td>
<td>${escapar(x.tipoElemento)}</td>
<td>${escapar(x.longitud)}</td>
<td>${escapar(x.distancia)}</td>
<td>
<div>${escapar(x.ubicacion)}</div>
<div class="coordenadas">${escapar(x.referencia)}</div>
${copiar}
</td>
<td>${maps}</td>
<td><span class="badge ${clase}">${escapar(x.estado)}</span></td>
<td>${x.evidencias.map(e=>`<div class="evidencia">${escapar(e)}</div>`).join("")}</td>
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
"CTO","Nombre CTO","Nº EMP","ID EMP","Nombre EMP","Datos EMP",
"Tipo EMP","Línea EMP","Líneas petición EMP","Fibra inicial EMP","Fibra final EMP",
"Longitud EMP","Distancia EMP","Orden tramo EMP","Dirección EMP","Fecha instalación EMP",
"Unidad alta EMP","Unidad baja EMP","NoTe EMP","UUID EMP","Latitud EMP","Longitud geográfica EMP",
"Estructura inicio EMP","Estructura final EMP","Divisor","Patilla","Fibra",
"Cable","Descripción cable","Tipo","Longitud","Distancia",
"Ubicación","Referencia/Coordenadas","Enlace Maps",
"Estado","Evidencias"
];

const filas=registros.map(x=>[
x.cto,x.nombreCto,x.empalme,x.idEmpalme,x.nombreEmpalme,x.datosEmpalme,
x.tipoEmpalme,x.lineaEmpalme,x.lineasPeticionEmpalme,x.fibIniEmpalme,x.fibFinEmpalme,
x.longitudEmpalme,x.distanciaEmpalme,x.ordenEmpalme,x.direccionEmpalme,x.fechaInstalacionEmpalme,
x.unidadAltaEmpalme,x.unidadBajaEmpalme,x.noTeEmpalme,x.uuidEmpalme,x.latEmpalme,x.lonEmpalme,
x.estructuraInicioEmpalme,x.estructuraFinalEmpalme,x.divisor,x.patilla,x.fibra,
x.cable,x.descripcionCable,x.tipoElemento,x.longitud,x.distancia,
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
