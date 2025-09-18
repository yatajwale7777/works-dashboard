const CACHE = 'works-v1';
self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c=> c.addAll(['/','/index.html','/app.js','/styles.css'])));
});
self.addEventListener('fetch', ev => {
  ev.respondWith(caches.match(ev.request).then(r=> r || fetch(ev.request)));
});// hhh
