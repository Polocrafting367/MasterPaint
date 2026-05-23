/* MasterPaint — Service Worker (PWA + réception partage d’images) */
const SHARE_CACHE = 'illu-share-inbox-v1';
const SHARE_CACHE_KEY = 'pending-share-file';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

function shareImportPath(pathname) {
    return pathname.endsWith('/share-import') || pathname.endsWith('/share-import/');
}

async function storeSharedFile(file) {
    const cache = await caches.open(SHARE_CACHE);
    const headers = new Headers({ 'Content-Type': file.type || 'application/octet-stream' });
    if (file.name) headers.set('X-Illu-Filename', file.name);
    await cache.put(SHARE_CACHE_KEY, new Response(file, { headers }));
}

async function handleShareTargetPost(request) {
    const formData = await request.formData();
    const file =
        formData.get('media') ||
        formData.get('image') ||
        formData.get('file') ||
        formData.get('files');
    if (file && typeof file.size === 'number' && file.size > 0) {
        await storeSharedFile(file);
    }
    const base = new URL(request.url);
    const dest = new URL('./', base);
    dest.searchParams.set('share', '1');
    return Response.redirect(dest.toString(), 303);
}

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    if (event.request.method === 'POST' && shareImportPath(url.pathname)) {
        event.respondWith(
            handleShareTargetPost(event.request).catch(() =>
                Response.redirect('./?share=1', 303)
            )
        );
    }
});
