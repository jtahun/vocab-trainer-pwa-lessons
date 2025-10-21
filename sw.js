const CACHE='vocab-json-v2';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE&&caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const url = new URL(e.request.url);
  if(url.pathname.endsWith('/words.json') || url.pathname.endsWith('words.json')){
    e.respondWith(fetch(e.request, {cache:'no-cache'}).then(res=>{
      const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res;
    }).catch(()=>caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{
    const copy=res.clone(); caches.open(CACHE).then(c=>c.put(e.request, copy)); return res;
  })));
});