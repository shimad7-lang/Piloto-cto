const CACHE="piloto-cto-paralelo-v2";

self.addEventListener("install",()=>self.skipWaiting());

self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));

self.addEventListener("fetch",event=>{
  const url=new URL(event.request.url);

  if(event.request.method!=="POST") return;
  if(!url.pathname.endsWith("/share-target")) return;

  event.respondWith((async()=>{
    try{
      const form=await event.request.formData();
      const files=form.getAll("files").filter(x=>x instanceof File);

      const db=await openDB();
      const tx=db.transaction("files","readwrite");
      const store=tx.objectStore("files");

      for(const file of files){
        store.add({
          name:file.name,
          type:file.type,
          size:file.size,
          blob:file
        });
      }

      await txDone(tx);

      return Response.redirect(
        new URL("./?shared=1",url),
        303
      );

    }catch(err){

      return Response.redirect(
        new URL("./?shared=error",url),
        303
      );

    }
  })());
});

function openDB(){
  return new Promise((resolve,reject)=>{
    const r=indexedDB.open(
      "piloto-cto-share-paralelo",
      1
    );

    r.onupgradeneeded=()=>{
      if(!r.result.objectStoreNames.contains("files")){
        r.result.createObjectStore(
          "files",
          {
            keyPath:"id",
            autoIncrement:true
          }
        );
      }
    };

    r.onsuccess=()=>resolve(r.result);
    r.onerror=()=>reject(r.error);
  });
}

function txDone(tx){
  return new Promise((resolve,reject)=>{
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(
      tx.error || new Error("transaction aborted")
    );
  });
}
