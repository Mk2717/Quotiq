const CACHE = 'quotiq-field-v6';
const CORE = ['/', '/manifest.webmanifest', '/quotiq-mark.svg', '/favicon.svg'];

const sameOriginPath = value => {
  try {
    const url = new URL(value, self.location.origin);
    return url.origin === self.location.origin ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
};

const cacheResponse = async (cache, request) => {
  try {
    const response = await fetch(request, { cache: 'reload' });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return null;
  }
};

const discoverAppShell = async cache => {
  const response = await cacheResponse(cache, '/');
  if (!response) return;
  const html = await response.clone().text();
  const paths = new Set(CORE);
  for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
    const path = sameOriginPath(match[1]);
    if (path) paths.add(path);
  }
  const loaded = await Promise.all([...paths].map(path => cacheResponse(cache, path)));
  const css = loaded.filter(Boolean).filter(item => item.headers.get('content-type')?.includes('text/css'));
  for (const stylesheet of css) {
    const text = await stylesheet.clone().text();
    const fontPaths = [...text.matchAll(/url\((?:["']?)([^)"']+)/g)]
      .map(match => sameOriginPath(match[1]))
      .filter(Boolean);
    await Promise.all(fontPaths.map(path => cacheResponse(cache, path)));
  }
};

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(discoverAppShell).then(() => self.skipWaiting()));
});

self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_URLS' || !Array.isArray(event.data.urls)) return;
  const paths = [...new Set(event.data.urls.map(sameOriginPath).filter(Boolean))];
  event.waitUntil(caches.open(CACHE).then(cache => Promise.all(paths.map(path => cacheResponse(cache, path)))));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== location.origin) return;
  const pathname = new URL(event.request.url).pathname;
  if (pathname === '/signin-with-chatgpt' || pathname === '/signout-with-chatgpt' || pathname === '/callback') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put('/', copy));
      return response;
    }).catch(async () => (await caches.match(event.request)) || (await caches.match('/'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
    return response;
  }).catch(() => cached)));
});
