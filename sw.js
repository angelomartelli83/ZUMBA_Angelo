const CACHE_NAME='zumba-angelo-v1';
const BASE='/ZUMBA_Angelo/';
const APP_SHELL=[BASE,BASE+'index.html',BASE+'manifest.json',BASE+'icon-192.png',BASE+'icon-512.png',BASE+'apple-touch-icon.png',BASE+'css/style.css',BASE+'js/pwa.js'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  e.respondWith(fetch(e.request).then(r=>{
    if(r.ok && new URL(e.request.url).origin===self.location.origin){const copy=r.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,copy));}
    return r;
  }).catch(()=>caches.match(e.request).then(c=>c||caches.match(BASE))));
});