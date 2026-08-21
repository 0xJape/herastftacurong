const CACHE='hera-shell-v2';
const SHELL=['/','/index.html','/styles.css?v=11','/app.js?v=8','/assistant-ui.js?v=2','/notifications-ui.js?v=3','/profile-ui.js?v=1','/checkin-reminder.js?v=1','/checkin-ui.js?v=1','/analytics-ui.js?v=3','/period-ui.js?v=2','/nutrition-ui.js?v=4','/silk.js?v=2','/manifest.webmanifest','/assets/HERA_LOGO.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(request));return}
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request).then(cached=>cached||caches.match('/index.html'))));
});
