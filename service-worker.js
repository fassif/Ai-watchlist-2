self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open('aiwl-v2').then(c=>c.addAll([
    './','./index.html','./styles.css','./app.js','./papaparse.min.js','./manifest.json',
    './icons/icon-192.png','./icons/icon-512.png'
  ])));
});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});