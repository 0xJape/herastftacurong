const CACHE='hera-shell-v22';
const SHELL=['/homepage','/index.html','/styles.css?v=12','/analytics-baseline.css?v=2','/analytics-patterns.css?v=1','/analytics-learning.css?v=1','/goals.css?v=3','/care.css?v=4','/sleep-modern.css?v=1','/sleep-chart.css?v=1','/sleep-chart-contrast.css?v=2','/app.js?v=12','/assistant-ui.js?v=2','/notifications-ui.js?v=5','/profile-ui.js?v=5','/goals-ui.js?v=3','/care-ui.js?v=4','/checkin-reminder.js?v=3','/checkin-ui.js?v=1','/analytics-ui.js?v=12','/period-ui.js?v=3','/nutrition-ui.js?v=7','/meal-ui.js?v=1','/sleep-ui.js?v=1','/sleep-experience.js?v=3','/silk.js?v=2','/manifest.webmanifest','/assets/HERA_LOGO.jpg'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==location.origin)return;
  if(url.pathname.startsWith('/api/')){event.respondWith(fetch(request));return}
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy))}return response}).catch(()=>caches.match(request).then(cached=>cached||caches.match('/homepage'))));
});
