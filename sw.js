const CACHE="piloto-cto-final-v1";
const SHELL=["./","./index.html","./manifest.webmanifest","./share-target.html","./icon.svg"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(
    keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
  )).then(()=>self.clients.claim()));
});

async function saveSharedFile(request){
  const form=await request.formData();
  const file=form.get("archivo");
  if(file && typeof file.arrayBuffer==="function"){
    const data=await file.arrayBuffer();
    const db=await new Promise((resolve,reject)=>{
      const r=indexedDB.open("piloto-cto-share",1);
      r.onupgradeneeded=()=>r.result.createObjectStore("files");
      r.onsuccess=()=>resolve(r.result);
      r.onerror=()=>reject(r.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction("files","readwrite");
      tx.objectStore("files").put({
        name:file.name||"archivo",
        type:file.type||"application/octet-stream",
        data
      },"latest");
      tx.oncomplete=resolve;
      tx.onerror=()=>reject(tx.error);
    });
  }
}

self.addEventListener("fetch",e=>{
  const url=new URL(e.request.url);

  if(e.request.method==="POST" && url.pathname.endsWith("/share-target.html")){
    e.respondWith(
      saveSharedFile(e.request)
        .catch(err=>console.error("Share Target:",err))
        .then(()=>Response.redirect("./?shared=1",303))
    );
    return;
  }

  if(e.request.method==="GET"){
    e.respondWith(
      caches.match(e.request).then(cached=>cached || fetch(e.request).then(res=>{
        if(res.ok){
          const copy=res.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
        }
        return res;
      }).catch(()=>caches.match("./index.html")))
    );
  }
});
