/* ==========================================================================
   PBB — SERVICE WORKER
   --------------------------------------------------------------------------
   Deliberately conservative. This runs on a campaign site that collects
   membership PII and issues verification results, so the default posture is
   "do not cache" and caching is opted into per route, never inferred.

   WHAT IS CACHED
     - The static shell (tokens/site/widget CSS + JS, logo, offline page).
     - Same-origin /assets/* GETs, stale-while-revalidate.
     - Navigations, network-first with a cached copy as fallback.

   WHAT IS NEVER CACHED — and why
     - Anything that is not a GET. Form posts must always hit the network.
     - Any cross-origin request (Supabase, Cloudflare Turnstile, Google
       Fonts). Opaque responses would silently bloat the cache and, worse,
       a stale Turnstile script would break the join form.
     - /inform and /inform/* — the authenticated INFORM dashboard. Caching an
       authenticated SPA shell on a shared or borrowed phone is a real
       disclosure risk in the field, and the dashboard has no offline story.
     - /verify.html and /membership.html — results must be live, never a
       previously-rendered membership record.

   UPDATE MODEL
     Assets on this site are NOT content-hashed (pbb-site.css is served under
     a stable name), so a waiting worker would serve yesterday's CSS against
     today's HTML. During a campaign, correctness of the live page beats
     session stability: install skips waiting and activate claims clients, so
     a corrected page reaches voters on the next navigation, not the next
     browser restart.

     Bump CACHE_VERSION on every deploy that changes anything precached.
   ========================================================================== */

const CACHE_VERSION = 'pbb-v1.1.0';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const OFFLINE_URL = '/offline.html';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/assets/pbb-tokens.css',
  '/assets/pbb-site.css',
  '/assets/site-widgets.css',
  '/assets/site-widgets.js',
  '/assets/pbb-pwa.js',
  '/assets/pbb-logo-256.png',
  '/assets/favicon-32.png',
];

/* Paths that must always go to the network, matched against the pathname. */
const NEVER_CACHE = [
  /^\/inform(\/|$)/,
  /^\/verify\.html$/,
  /^\/membership\.html$/,
  /^\/api\//,
];

function isBypassed(url) {
  return NEVER_CACHE.some((re) => re.test(url.pathname));
}

/* -------------------------------------------------------------------------
   Install — precache the shell. Individual failures must not abort the whole
   install, or one renamed asset silently leaves every visitor un-serviced.
   ------------------------------------------------------------------------- */
self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(
        SHELL_ASSETS.map((url) => cache.add(new Request(url, { cache: 'reload' })))
      );
      await self.skipWaiting();
    })()
  );
});

/* -------------------------------------------------------------------------
   Activate — drop every cache from a previous version, then take control.
   ------------------------------------------------------------------------- */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      );
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })()
  );
});

/* -------------------------------------------------------------------------
   Fetch
   ------------------------------------------------------------------------- */
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;
  if (isBypassed(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

/* Network-first: the live page always wins when the network is up. */
async function handleNavigation(event) {
  const { request } = event;
  try {
    const preload = await event.preloadResponse;
    if (preload) {
      void cachePut(RUNTIME_CACHE, request, preload.clone());
      return preload;
    }
    const fresh = await fetch(request);
    void cachePut(RUNTIME_CACHE, request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await caches.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

/* Serve the cached asset instantly, refresh it in the background. */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response && response.ok && response.type === 'basic') {
        void cachePut(RUNTIME_CACHE, request, response.clone());
      }
      return response;
    })
    .catch(() => undefined);

  return cached || (await network) || Response.error();
}

async function cachePut(cacheName, request, response) {
  if (!response || !response.ok || response.type !== 'basic') return;
  try {
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (err) {
    /* Quota or storage errors must never break the response path. */
  }
}

/* Allows the page to force an update check from pbb-pwa.js. */
self.addEventListener('message', (event) => {
  if (event.data === 'PBB_SKIP_WAITING') self.skipWaiting();
});
