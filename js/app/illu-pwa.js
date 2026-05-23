/**
 * illu-pwa.js — PWA : partage d’images (share_target), ouverture de fichiers, file_handlers.
 */
(function () {
    'use strict';

    const SHARE_CACHE = 'illu-share-inbox-v1';
    const SHARE_CACHE_KEY = 'pending-share-file';

    window.illuImportSharedFiles = async function illuImportSharedFiles(files) {
        if (!files || !files.length) return;
        const list = Array.from(files).filter((f) => f && f.size > 0);
        for (const file of list) {
            if (typeof window.illuProcessFileImport === 'function') {
                window.illuProcessFileImport(file, {});
            }
        }
    };

    async function consumeShareFromCache() {
        if (!('caches' in window)) return false;
        try {
            const cache = await caches.open(SHARE_CACHE);
            const res = await cache.match(SHARE_CACHE_KEY);
            if (!res) return false;
            await cache.delete(SHARE_CACHE_KEY);
            const blob = await res.blob();
            const name = res.headers.get('X-Illu-Filename') || 'shared-image';
            const type = blob.type || res.headers.get('Content-Type') || 'image/png';
            const file = new File([blob], name, { type });
            await window.illuImportSharedFiles([file]);
            return true;
        } catch (e) {
            console.warn('[MasterPaint] Partage PWA : lecture cache impossible.', e);
            return false;
        }
    }

    function clearShareQueryParam() {
        try {
            const u = new URL(window.location.href);
            if (!u.searchParams.has('share')) return;
            u.searchParams.delete('share');
            const qs = u.searchParams.toString();
            const next = u.pathname + (qs ? `?${qs}` : '') + u.hash;
            window.history.replaceState({}, '', next);
        } catch (e) {
            /* ignore */
        }
    }

    async function handleShareLaunch() {
        const u = new URL(window.location.href);
        if (u.searchParams.get('share') !== '1') return;
        const waitEditor = () =>
            new Promise((resolve) => {
                let n = 0;
                const tick = () => {
                    if (window.EditorManager && typeof window.illuProcessFileImport === 'function') {
                        resolve();
                        return;
                    }
                    if (++n > 120) {
                        resolve();
                        return;
                    }
                    setTimeout(tick, 100);
                };
                tick();
            });
        await waitEditor();
        await consumeShareFromCache();
        clearShareQueryParam();
    }

    function initLaunchQueue() {
        if (!('launchQueue' in window) || !window.launchQueue.setConsumer) return;
        window.launchQueue.setConsumer(async (launchParams) => {
            const files = [];
            if (launchParams.files && launchParams.files.length) {
                for (const handle of launchParams.files) {
                    try {
                        files.push(await handle.getFile());
                    } catch (e) {
                        console.warn('[MasterPaint] launchQueue fichier ignoré.', e);
                    }
                }
            }
            if (files.length) await window.illuImportSharedFiles(files);
        });
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', () => {
            const swUrl = new URL('sw.js', window.location.href).href;
            navigator.serviceWorker
                .register(swUrl, { scope: new URL('./', window.location.href).href })
                .catch((err) => {
                    console.warn('[MasterPaint] Service worker non enregistré.', err);
                });
        });
    }

    function initPwa() {
        registerServiceWorker();
        initLaunchQueue();
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => handleShareLaunch());
        } else {
            handleShareLaunch();
        }
    }

    initPwa();
})();
