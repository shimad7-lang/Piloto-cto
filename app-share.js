/* ================= EVENTOS ================= */

$("extraer").addEventListener("click",extraer);
$("csv").addEventListener("click",descargarCSV);

$("limpiar").addEventListener("click",()=>{
archivoCompartido=null;
if($("recepcionCompartir")) $("recepcionCompartir").hidden=true;
registros=[];
elementosPDF=[];
textoOriginal="";
eliminados=0;

$("archivo").value="";
$("ctos").value="";
$("empalme").value="";
$("texto").textContent="No hay datos cargados.";
$("diagnostico").textContent="";
$("resumen").innerHTML="";
$("csv").disabled=true;
$("estado").textContent="";
$("estado").className="estado";

$("tabla").innerHTML=
'<tr><td colspan="15" class="vacia">Todavía no se han realizado búsquedas.</td></tr>';
$("recepcionCompartir").hidden = true;
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./sw.js")
      .catch(e=>console.warn("Service Worker:",e));
  });
}
 function mostrarArchivoCompartido(archivo){
  const panel=$("recepcionCompartir");
  const info=$("archivoCompartido");

  if(panel) panel.hidden=false;

  if(info){
    info.textContent=
      "Recibido: "+(archivo?.name||"archivo-compartido");
  }
}


async function procesarArchivoCompartido(archivo){
  if(!archivo) return;

  try{
    mostrarArchivoCompartido(archivo);

    $("estadoCompartido").textContent=
      "Extrayendo datos automáticamente…";

    const dt=new DataTransfer();
    dt.items.add(archivo);
    $("archivo").files=dt.files;

    await extraer();

    $("estadoCompartido").textContent=
      registros.length
      ? "✓ Extracción terminada. Resultados mostrados abajo."
      : "⚠ Archivo recibido, pero no se encontraron resultados.";

  }catch(e){
    console.error(e);

    $("estadoCompartido").textContent=
      "No se pudo procesar: "+e.message;
  }
}


function formatearDiagnosticoRecepcion(diagnostico){
  if(!diagnostico || typeof diagnostico!="object")
    return "Diagnóstico temporal no disponible.";

  const headers=Object.entries(diagnostico.headers||{})
    .map(([nombre,valor])=>nombre+": "+valor)
    .join(" · ");

  const partes=(diagnostico.parts||[]).map(parte=>{
    const detalle=[parte.kind,parte.mime||"MIME desconocido"];

    if(parte.kind==="file"){
      detalle.push((parte.bytes||0)+" bytes");
      detalle.push(parte.extension||"sin extensión");
    }else{
      detalle.push((parte.chars||0)+" caracteres");
      if(parte.containsContentUri) detalle.push("contiene URI content://");
      if(parte.containsWebUrl) detalle.push("contiene URL web");
      if(parte.containsSupportedFilename) detalle.push("menciona PDF/KML/KMZ");
    }

    return parte.name+" ["+detalle.join(", ")+"]";
  });

  return [
    "Diagnóstico temporal (sin valores de title/text ni contenido de archivo):",
    "Solicitud: "+(diagnostico.method||"?")+" "+(diagnostico.path||"?"),
    "Headers: "+(headers||"(ninguno)") ,
    "Partes multipart ("+partes.length+"): "+(partes.join("; ")||"(ninguna)")
  ].join("\n");
}


async function recuperarArchivoCompartido(){

  try{

    const panel=$("recepcionCompartir");
    const info=$("archivoCompartido");
    const estadoRec=$("estadoCompartido");

    if(panel) panel.hidden=false;

    if(info)
      info.textContent="Archivo compartido recibido. Buscando datos…";

    if(estadoRec)
      estadoRec.textContent="Buscando el archivo compartido desde Android…";

    const url=new URL(location.href);
    const error=url.searchParams.get("error");
    const id=url.searchParams.get("id");

    if(error){
      const mensajes={
        "no-file":"No se recibió ningún archivo.",
        "unsupported-file":"El archivo compartido no es PDF, KML ni KMZ.",
        "processing":"No se pudo guardar el archivo compartido. Inténtalo de nuevo."
      };

      if(info) info.textContent="⚠ No se pudo recibir el archivo.";
      if(estadoRec){
        estadoRec.textContent=mensajes[error]||"Error al recibir el archivo.";

        if(error==="no-file"){
          let diagnostico=null;

          try{
            diagnostico=JSON.parse(url.searchParams.get("debug")||"null");
          }catch(_e){}

          estadoRec.textContent+="\n\n"+formatearDiagnosticoRecepcion(diagnostico);
        }
      }
      return false;
    }

    if(!id){
      if(info) info.textContent="⚠ No se encontró el archivo compartido.";
      if(estadoRec) estadoRec.textContent="El enlace de recepción no contiene un identificador de archivo.";
      return false;
    }

    const db=await new Promise((resolve,reject)=>{

      const r=indexedDB.open("piloto-cto-share",1);

      r.onupgradeneeded=()=>{
        if(!r.result.objectStoreNames.contains("files")){
          r.result.createObjectStore("files");
        }
      };

      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);

    });

    const archivo=await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readonly");
      const req=tx.objectStore("files").get(id);

      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });

    if(!archivo){

      db.close();

      if(info)
        info.textContent=
          "⚠ Android abrió el piloto, pero no se encontró el archivo.";

      if(estadoRec)
        estadoRec.textContent=
          "El envío ha caducado o ya se había procesado. Vuelve a compartirlo.";

      return false;
    }

    const blob=new Blob(
      [archivo.data],
      {type:archivo.type||"application/octet-stream"}
    );

    const file=new File(
      [blob],
      archivo.name||"archivo-compartido",
      {type:archivo.type||"application/octet-stream"}
    );

    db.close();

    await procesarArchivoCompartido(file);
    await borrarArchivoCompartido(id);

    return true;

  }catch(e){

    console.error(e);

    const panel=$("recepcionCompartir");
    const info=$("archivoCompartido");
    const estadoRec=$("estadoCompartido");

    if(panel) panel.hidden=false;

    if(info)
      info.textContent="⚠ Error al recuperar el archivo compartido.";

    if(estadoRec)
      estadoRec.textContent="Error: "+(e.message||e);

    return false;
  }
}

async function borrarArchivoCompartido(id){
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open("piloto-cto-share",1);
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });

  try{
    await new Promise((resolve,reject)=>{
      const transaction=db.transaction("files","readwrite");
      transaction.objectStore("files").delete(id);
      transaction.oncomplete=resolve;
      transaction.onerror=()=>reject(transaction.error);
      transaction.onabort=()=>reject(transaction.error||new Error("Transacción abortada"));
    });
  }finally{
    db.close();
  }
}


function instalarRecepcionAndroid(){

  if("launchQueue" in window){

    window.launchQueue.setConsumer(
      async params=>{

        if(!params.files || !params.files.length)
          return;

        try{

          const file=
            await params.files[0].getFile();

          await procesarArchivoCompartido(file);

        }catch(e){

          estado(
            "Error recibiendo el archivo compartido: "+e.message,
            "error"
          );

        }
      }
    );
  }

  if(location.search.includes("shared=1")){

    window.addEventListener("load",async()=>{

      await recuperarArchivoCompartido();

      history.replaceState(
        {},
        document.title,
        location.pathname
      );

    });

  }
}

instalarRecepcionAndroid();