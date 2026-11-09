// Two caches: the app shell (small, replaced when you bump SHELL) and MusicXML (large, kept across updates).
// Both use stale-while-revalidate: students get the cached copy instantly, and a fresh copy is fetched in the
// background. Netlify answers unchanged files with a tiny "not modified" reply, so this costs almost no bandwidth.
const SHELL = 'band-shell-v0.5';
const XML = 'band-xml';
const ASSETS_TO_CACHE = [
  './', './index.html', './styles.css', './catalog.js', './score.js', './player.js', './tuner.js', './app.js',
  './manifest.json', './assets/vendor/opensheetmusicdisplay.min.js'
];
self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(ASSETS_TO_CACHE)));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((names) =>
    Promise.all(names.filter((n) => n !== SHELL && n !== XML).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || !r.url.startsWith(self.location.origin)) return;
  const name = new URL(r.url).pathname.endsWith('.musicxml') ? XML : SHELL;
  e.respondWith(caches.open(name).then(async (c) => {
    const hit = await c.match(r);
    const net = fetch(r)
      .then((res) => { if (res.status === 200) c.put(r, res.clone()); return res; })
      .catch(() => hit || Response.error());
    e.waitUntil(net);
    return hit || net;
  }));
});
