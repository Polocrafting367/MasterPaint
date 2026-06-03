/**
 * WorkspaceIO.js — Projet .illu, export image (PNG/JPEG/SVG), persistance localStorage + IndexedDB (pixels calques / historique).
 */
(function () {
    const STORAGE_KEY = 'illu_workspace_v1';
    const SESSION_MIRROR_KEY = 'illu_workspace_session_v1';
    const RAM_MIRROR_PREF_KEY = 'illu_ram_session_mirror';
    const AUTO_SAVE_MODE_KEY = 'illu_auto_save_mode';
    const AUTO_SAVE_INTERVAL_MIN_KEY = 'illu_auto_save_interval_min';
    const LAST_PERSIST_META_KEY = 'illu_last_persist_meta_v1';
    const MAX_LOCAL_BYTES = 4 * 1024 * 1024;
    const IDB_NAME = 'illu_workspace_blobs_v1';
    const IDB_STORE = 'blobs';
    const EMPTY_PNG_DATAURL =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    let idbDb = null;
    let persistQueue = Promise.resolve();
    let autoSaveIntervalHandle = null;
    let canvasPointerDepth = 0;

    /**
     * continuous = après chaque action (avec pause si la toile est manipulée) ;
     * interval = sauvegarde planifiée + fenêtre ;
     * off = rien en local (rafraîchir = perte).
     * Si la clé est absente : off (choix explicite dans Paramètres).
     */
    function getAutoSaveMode() {
        try {
            const v = localStorage.getItem(AUTO_SAVE_MODE_KEY);
            if (v === 'continuous' || v === 'interval' || v === 'off') return v;
        } catch (e) {
            /* ignore */
        }
        return 'off';
    }

    function shouldPersistOnExit() {
        const mode = getAutoSaveMode();
        if (mode === 'off') return false;
        if (mode === 'continuous') return true;
        if (mode === 'interval') return isAnyProjectAutoSaveEnabled();
        return false;
    }

    function recordPersistMeta(reason, em) {
        const ap = em && em.activeProject;
        const meta = {
            at: new Date().toISOString(),
            reason: reason || 'unknown',
            mode: getAutoSaveMode(),
            projectId: ap && ap.id != null ? ap.id : null,
            projectName: ap && ap.name ? ap.name : null,
            projectAutoSaveLocal: !!(ap && ap.autoSaveLocal)
        };
        try {
            localStorage.setItem(LAST_PERSIST_META_KEY, JSON.stringify(meta));
        } catch (e) {
            /* ignore */
        }
        const ov = document.getElementById('export-dialog-overlay');
        if (ov && ov.style.display !== 'none') syncExportLocalSaveStatus();
    }

    function getLastPersistMeta() {
        try {
            const raw = localStorage.getItem(LAST_PERSIST_META_KEY);
            if (raw) {
                const o = JSON.parse(raw);
                if (o && typeof o.at === 'string') return o;
            }
        } catch (e) {
            /* ignore */
        }
        return null;
    }

    function hasBrowserWorkspaceCopy() {
        try {
            if (localStorage.getItem(STORAGE_KEY)) return true;
            if (sessionStorage.getItem(SESSION_MIRROR_KEY)) return true;
        } catch (e) {
            /* ignore */
        }
        return false;
    }

    function formatPersistDateTime(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const lang =
            window.IlluI18n && typeof window.IlluI18n.getLang === 'function'
                ? window.IlluI18n.getLang()
                : 'fr';
        try {
            return d.toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR', {
                dateStyle: 'short',
                timeStyle: 'medium'
            });
        } catch (e) {
            return d.toLocaleString();
        }
    }

    function syncExportLocalSaveStatus() {
        const el = document.getElementById('export-local-save-status');
        if (!el) return;
        const t =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t.bind(window.IlluI18n)
                : (k, fb) => fb || k;
        const em = window.EditorManager;
        const mode = getAutoSaveMode();
        const min = getAutoSaveIntervalMinutes();
        let modeLabel;
        if (mode === 'continuous') {
            modeLabel = t('dlg.exportLocalModeContinuous', 'continu');
        } else if (mode === 'interval') {
            modeLabel = t('dlg.exportLocalModeInterval', 'intervalle {min} min').replace(
                '{min}',
                String(min)
            );
        } else {
            modeLabel = t('dlg.exportLocalModeOff', 'aucune');
        }
        const copyLine = t('dlg.exportLocalBrowserCopy', 'Copie navigateur : {state}').replace(
            '{state}',
            hasBrowserWorkspaceCopy()
                ? t('dlg.exportLocalBrowserYes', 'oui')
                : t('dlg.exportLocalBrowserNo', 'non')
        );
        const meta = getLastPersistMeta();
        const lastLine =
            meta && meta.at
                ? t('dlg.exportLocalLast', 'Dernier : {when}').replace(
                      '{when}',
                      formatPersistDateTime(meta.at)
                  )
                : t('dlg.exportLocalLastNever', 'Dernier : —');
        const paramLine = t('dlg.exportLocalMode', 'Paramètres : {mode}').replace('{mode}', modeLabel);
        const lines = [copyLine, lastLine, paramLine];
        if (mode === 'interval') {
            const projOn = !!(em && em.activeProject && em.activeProject.autoSaveLocal);
            lines.push(
                t('dlg.exportLocalProjectShort', 'Intervalle ce projet : {state}').replace(
                    '{state}',
                    projOn ? t('dlg.exportLocalBrowserYes', 'oui') : t('dlg.exportLocalBrowserNo', 'non')
                )
            );
        }
        el.innerHTML = '';
        lines.forEach((text) => {
            const row = document.createElement('div');
            row.className = 'illu-export-local-status__row';
            row.textContent = text;
            el.appendChild(row);
        });
        const ck = document.getElementById('export-auto-save-check');
        const ckRow = document.querySelector('.illu-export-dialog__autosave');
        if (ck) {
            const intervalMode = mode === 'interval';
            ck.disabled = !intervalMode;
            if (ckRow) ckRow.style.opacity = intervalMode ? '' : '0.55';
        }
    }

    function getAutoSaveIntervalMinutes() {
        try {
            const n = parseInt(localStorage.getItem(AUTO_SAVE_INTERVAL_MIN_KEY), 10);
            if (Number.isFinite(n) && n >= 1 && n <= 120) return n;
        } catch (e) {
            /* ignore */
        }
        return 3;
    }

    function shouldScheduleHistoryPersist() {
        return getAutoSaveMode() === 'continuous';
    }

    function isHeavyEffectBusy() {
        return !!(window.IlluBusyState && typeof window.IlluBusyState.isBusy === 'function' && window.IlluBusyState.isBusy('effect-heavy'));
    }

    function waitForHeavyEffectIdle(maxWaitMs) {
        if (!isHeavyEffectBusy()) return Promise.resolve();
        return new Promise((resolve) => {
            const startedAt = Date.now();
            let settled = false;
            let poll = null;
            const finish = () => {
                if (settled) return;
                settled = true;
                window.removeEventListener('illu:busy-change', onBusyChange);
                if (poll != null) window.clearInterval(poll);
                resolve();
            };
            const check = () => {
                if (!isHeavyEffectBusy()) {
                    finish();
                    return;
                }
                if (Date.now() - startedAt >= Math.max(500, maxWaitMs | 0)) {
                    finish();
                }
            };
            const onBusyChange = () => check();
            window.addEventListener('illu:busy-change', onBusyChange);
            poll = window.setInterval(check, 150);
            check();
        });
    }

    function onUserIdleAfterCanvas() {
        if (!window._illuPersistDeferred) return;
        if (getAutoSaveMode() !== 'continuous') return;
        if (window._illuCanvasPointerBusy) return;
        if (isHeavyEffectBusy()) return;
        window._illuPersistDeferred = false;
        queuePersistToLocalStorage();
    }

    function wireCanvasInteractionGate() {
        const mc = document.getElementById('main-canvas-container');
        if (!mc || mc.dataset.illuCanvasGate === '1') return;
        mc.dataset.illuCanvasGate = '1';
        mc.addEventListener(
            'pointerdown',
            (e) => {
                if (e.button !== 0 && e.button !== 1 && e.button !== 2) return;
                if (!mc.contains(e.target)) return;
                canvasPointerDepth++;
                window._illuCanvasPointerBusy = true;
            },
            true
        );
        const end = () => {
            canvasPointerDepth = Math.max(0, canvasPointerDepth - 1);
            if (canvasPointerDepth > 0) return;
            window._illuCanvasPointerBusy = false;
            onUserIdleAfterCanvas();
        };
        window.addEventListener('pointerup', end, true);
        window.addEventListener('pointercancel', end, true);
    }

    function setAutosaveModalVisible(visible, pct) {
        const ov = document.getElementById('illu-autosave-overlay');
        const fill = document.getElementById('illu-autosave-fill');
        if (!ov) return;
        if (visible) {
            ov.style.display = 'flex';
            ov.style.flexDirection = 'column';
            ov.setAttribute('aria-hidden', 'false');
            if (fill) fill.style.width = `${Math.max(0, Math.min(100, pct | 0))}%`;
        } else {
            ov.style.display = 'none';
            ov.setAttribute('aria-hidden', 'true');
            if (fill) fill.style.width = '0%';
        }
    }

    function isAnyProjectAutoSaveEnabled() {
        const em = window.EditorManager;
        if (!em || !em.projects) return false;
        return em.projects.some((p) => p.autoSaveLocal === true);
    }

    function runIntervalPersistJob() {
        if (getAutoSaveMode() === 'off') return;
        if (!isAnyProjectAutoSaveEnabled()) return;
        if (isHeavyEffectBusy()) {
            window._illuIntervalPersistDeferred = true;
            return;
        }
        window._illuIntervalPersistDeferred = false;
        setAutosaveModalVisible(true, 5);
        const intervalReason = { persistReason: 'interval' };
        const fill = document.getElementById('illu-autosave-fill');
        let fake = 5;
        const tick = window.setInterval(() => {
            fake = Math.min(92, fake + 8);
            if (fill) fill.style.width = `${fake}%`;
        }, 120);
        persistQueue = persistQueue
            .then(() => persistToLocalStorageAsync(intervalReason))
            .then(() => {
                if (fill) fill.style.width = '100%';
                window.clearInterval(tick);
                window.setTimeout(() => setAutosaveModalVisible(false, 0), 450);
            })
            .catch((e) => {
                window.clearInterval(tick);
                console.warn('Persist workspace :', e);
                setAutosaveModalVisible(false, 0);
            });
    }

    function clearAutoSaveInterval() {
        if (autoSaveIntervalHandle != null) {
            window.clearInterval(autoSaveIntervalHandle);
            autoSaveIntervalHandle = null;
        }
    }

    function setupAutoSaveIntervalTimer() {
        clearAutoSaveInterval();
        if (getAutoSaveMode() === 'off') return;
        if (!isAnyProjectAutoSaveEnabled()) return;
        const min = getAutoSaveIntervalMinutes();
        const ms = Math.max(60000, min * 60 * 1000);
        autoSaveIntervalHandle = window.setInterval(runIntervalPersistJob, ms);
    }

    function openIdb() {
        if (!window.indexedDB) return Promise.reject(new Error('indexedDB indisponible'));
        if (idbDb) return Promise.resolve(idbDb);
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_NAME, 1);
            req.onerror = () => reject(req.error || new Error('IDB open'));
            req.onsuccess = () => {
                idbDb = req.result;
                idbDb.onclose = () => {
                    idbDb = null;
                };
                resolve(idbDb);
            };
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
            };
        });
    }

    function idbPut(key, blob) {
        return openIdb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readwrite');
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    tx.objectStore(IDB_STORE).put(blob, key);
                })
        );
    }

    /** Plusieurs put dans une seule transaction (évite N allers-retours IDB). */
    function idbBulkPut(entries) {
        if (!entries || !entries.length) return Promise.resolve();
        return openIdb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readwrite');
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                    const st = tx.objectStore(IDB_STORE);
                    for (let i = 0; i < entries.length; i++) {
                        const e = entries[i];
                        st.put(e.blob, e.key);
                    }
                })
        );
    }

    function idbGet(key) {
        return openIdb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readonly');
                    const r = tx.objectStore(IDB_STORE).get(key);
                    r.onsuccess = () => resolve(r.result != null ? r.result : null);
                    r.onerror = () => reject(r.error);
                })
        );
    }

    function idbAllKeys() {
        return openIdb().then(
            (db) =>
                new Promise((resolve, reject) => {
                    const tx = db.transaction(IDB_STORE, 'readonly');
                    const r = tx.objectStore(IDB_STORE).getAllKeys();
                    r.onsuccess = () => resolve(r.result || []);
                    r.onerror = () => reject(r.error);
                })
        );
    }

    function idbDeleteExcept(keepSet) {
        return idbAllKeys().then((keys) => {
            const toDelete = keys.filter(
                (k) => typeof k === 'string' && k.startsWith('illu_') && !keepSet.has(k)
            );
            if (!toDelete.length) return Promise.resolve();
            return openIdb().then(
                (db) =>
                    new Promise((resolve, reject) => {
                        const tx = db.transaction(IDB_STORE, 'readwrite');
                        tx.oncomplete = () => resolve();
                        tx.onerror = () => reject(tx.error);
                        const st = tx.objectStore(IDB_STORE);
                        toDelete.forEach((k) => st.delete(k));
                    })
            );
        });
    }

    function dataUrlToBlob(dataUrl) {
        if (!dataUrl || typeof dataUrl !== 'string') return new Blob([], { type: 'image/png' });
        const p = dataUrl.indexOf(',');
        if (p < 0) return new Blob([], { type: 'image/png' });
        const head = dataUrl.slice(0, p);
        const body = dataUrl.slice(p + 1);
        const isBase64 = /;base64/i.test(head);
        let bytes;
        if (isBase64) {
            const bin = atob(body);
            bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        } else {
            bytes = new TextEncoder().encode(decodeURIComponent(body));
        }
        const mime = /data:([^;,]+)/.exec(head);
        return new Blob([bytes], { type: mime ? mime[1] : 'image/png' });
    }

    window.illuDataUrlToBlob = dataUrlToBlob;

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '');
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(blob);
        });
    }

    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => {
                const s = typeof fr.result === 'string' ? fr.result : '';
                const i = s.indexOf(',');
                resolve(i >= 0 ? s.slice(i + 1) : s);
            };
            fr.onerror = () => reject(fr.error);
            fr.readAsDataURL(blob);
        });
    }

    /** Collecte les blobs d’historique (un seul appel idbBulkPut ensuite). */
    function collectHistoryBlobsForStrip(d, pid, hi, usedKeys, seq) {
        const out = [];
        if (!d || typeof d !== 'object') return out;
        if (d.type === 'pixel-patch' && d.patch && d.patch.bufferDataUrl) {
            const url = d.patch.bufferDataUrl;
            if (typeof url === 'string' && url.length > 0) {
                const key = `illu_hp_${pid}_${hi}_${seq.n++}`;
                const patchRef = d.patch;
                out.push({
                    key,
                    blob: dataUrlToBlob(url),
                    apply: () => {
                        patchRef.pixelBlobKey = key;
                        delete patchRef.bufferDataUrl;
                    }
                });
                usedKeys.add(key);
            }
        }
        if (
            (d.type === 'pixel-full' || d.type === 'pixel-layers') &&
            Array.isArray(d.layers)
        ) {
            for (let li = 0; li < d.layers.length; li++) {
                const ly = d.layers[li];
                if (!ly || !ly.bufferDataUrl) continue;
                const url = ly.bufferDataUrl;
                if (typeof url !== 'string' || url.length === 0) continue;
                const key = `illu_hl_${pid}_${hi}_${li}`;
                const lyRef = ly;
                out.push({
                    key,
                    blob: dataUrlToBlob(url),
                    apply: () => {
                        lyRef.pixelBlobKey = key;
                        delete lyRef.bufferDataUrl;
                    }
                });
                usedKeys.add(key);
            }
        }
        return out;
    }

    async function hydrateHistoryDataFromIdb(d) {
        if (!d || typeof d !== 'object') return;
        if (d.type === 'pixel-patch' && d.patch) {
            const pk = d.patch.pixelBlobKey;
            if (pk && !d.patch.bufferDataUrl) {
                const blob = await idbGet(pk);
                d.patch.bufferDataUrl = blob ? await blobToDataUrl(blob) : EMPTY_PNG_DATAURL;
                delete d.patch.pixelBlobKey;
            }
        }
        if ((d.type === 'pixel-full' || d.type === 'pixel-layers') && Array.isArray(d.layers)) {
            for (const ly of d.layers) {
                if (!ly) continue;
                const pk = ly.pixelBlobKey;
                if (pk && !ly.bufferDataUrl) {
                    const blob = await idbGet(pk);
                    ly.bufferDataUrl = blob ? await blobToDataUrl(blob) : EMPTY_PNG_DATAURL;
                    delete ly.pixelBlobKey;
                }
            }
        }
    }

    /** Déplace les data URL pixel vers IndexedDB et renvoie la liste de clés référencées. */
    async function stripPayloadPixelBlobsToIdb(payload) {
        const usedKeys = new Set();
        const seq = { n: 0 };
        const bulk = [];
        for (const p of payload.projects || []) {
            const pid = p.id != null ? p.id : 0;
            const layers = p.pixelLayers || [];
            for (const pl of layers) {
                if (!pl) continue;
                const url = pl.dataUrl;
                if (typeof url === 'string' && url.length > 0) {
                    const key = `illu_pl_${pid}_${pl.id != null ? pl.id : 'x'}`;
                    bulk.push({
                        key,
                        blob: dataUrlToBlob(url),
                        apply: () => {
                            pl.pixelBlobKey = key;
                            delete pl.dataUrl;
                        }
                    });
                    usedKeys.add(key);
                }
            }
            const hist = p.historySerialized || [];
            for (let hi = 0; hi < hist.length; hi++) {
                const he = hist[hi];
                if (he && he.data) {
                    bulk.push(...collectHistoryBlobsForStrip(he.data, pid, hi, usedKeys, seq));
                }
            }
        }
        if (bulk.length) {
            await idbBulkPut(bulk.map((b) => ({ key: b.key, blob: b.blob })));
            bulk.forEach((b) => b.apply());
        }
        return usedKeys;
    }

    async function hydratePayloadFromIdb(payload) {
        const projects = payload.projects || [];
        const totalP = projects.length;
        const P = window.IlluProgress;
        for (let i = 0; i < totalP; i++) {
            const p = projects[i];
            const pName = p.name || 'Projet';
            if (P) P.splash(10 + Math.floor(i / totalP * 20), `Extraction : ${pName} (${i + 1}/${totalP})…`);
            
            const layers = p.pixelLayers || [];
            const totalL = layers.length;
            for (let j = 0; j < totalL; j++) {
                const pl = layers[j];
                if (!pl) continue;
                const pk = pl.pixelBlobKey;
                if (pk && !pl.dataUrl) {
                    if (P && totalL > 5) P.splash(10 + Math.floor(i / totalP * 20), `Extraction calque ${j + 1}/${totalL} (${pl.name || '…'})…`);
                    if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
                    const blob = await idbGet(pk);
                    pl.dataUrl = blob ? await blobToDataUrl(blob) : EMPTY_PNG_DATAURL;
                    delete pl.pixelBlobKey;
                }
            }
            const history = p.historySerialized || [];
            for (let hi = 0; hi < history.length; hi++) {
                const he = history[hi];
                if (he && he.data) await hydrateHistoryDataFromIdb(he.data);
            }
        }
    }

    async function persistWithIdb(payload) {
        const used = await stripPayloadPixelBlobsToIdb(payload);
        payload.version = 4;
        payload.pixelBlobsInIdb = true;
        payload.idbBlobKeys = [...used];
        const s = JSON.stringify(payload);
        await idbDeleteExcept(used);
        return s;
    }

    function persistLegacyInline(payload) {
        const s = JSON.stringify(payload);
        if (s.length > MAX_LOCAL_BYTES) {
            console.warn('Session Illu trop volumineuse pour localStorage (~5 Mo max).');
            return null;
        }
        return s;
    }

    /**
     * Reporte le gros travail (toDataURL, IDB, JSON) après le rendu / entrée utilisateur
     * pour éviter 1–2 s de blocage juste après chaque action.
     */
    function scheduleHeavyWork(fn, opts) {
        opts = opts || {};
        return new Promise((resolve, reject) => {
            const run = () => {
                try {
                    const p = fn();
                    Promise.resolve(p).then(resolve, reject);
                } catch (e) {
                    reject(e);
                }
            };
            const schedule = () => {
                if (!opts.ignoreBusy && isHeavyEffectBusy()) {
                    waitForHeavyEffectIdle(15000)
                        .then(() => {
                            if (!opts.ignoreBusy && isHeavyEffectBusy()) {
                                setTimeout(schedule, 120);
                                return;
                            }
                            schedule();
                        })
                        .catch(reject);
                    return;
                }
                if (typeof requestIdleCallback === 'function') {
                    requestIdleCallback(run, { timeout: 5000 });
                } else {
                    setTimeout(run, 0);
                }
            };
            schedule();
        });
    }

    async function persistToLocalStorageAsync(opts) {
        opts = opts || {};
        const em = window.EditorManager;
        if (!em) return;

        const work = async () => {
            try {
                em.syncActiveVectorSvg();
                const payload = em.serializeWorkspacePayload();
                let s;
                if (window.indexedDB) {
                    try {
                        s = await persistWithIdb(payload);
                    } catch (idbErr) {
                        console.warn('IndexedDB (sauvegarde auto) :', idbErr);
                        const fresh = em.serializeWorkspacePayload();
                        s = persistLegacyInline(fresh);
                        if (s == null) return;
                    }
                } else {
                    s = persistLegacyInline(payload);
                    if (s == null) return;
                }
                if (s.length > MAX_LOCAL_BYTES) {
                    console.warn('Manifeste workspace encore trop volumineux pour localStorage (ex. SVG très long).');
                    return;
                }
                let wroteLocal = false;
                try {
                    localStorage.setItem(STORAGE_KEY, s);
                    wroteLocal = true;
                } catch (lsErr) {
                    console.warn('localStorage (sauvegarde auto) :', lsErr);
                }
                const mirrorOn = localStorage.getItem(RAM_MIRROR_PREF_KEY) === '1';
                if (mirrorOn) {
                    try {
                        sessionStorage.setItem(SESSION_MIRROR_KEY, s);
                    } catch (e2) {
                        if (!wroteLocal) {
                            console.warn('sessionStorage miroir indisponible (quota / navigation privée).');
                        }
                    }
                }
                if (typeof window.onWorkspacePersisted === 'function') {
                    window.onWorkspacePersisted();
                }
                recordPersistMeta(opts.persistReason || 'continuous', em);
            } catch (err) {
                console.error('persistToLocalStorage (work) :', err);
            }
        };

        if (opts.immediate) {
            return await work();
        } else {
            return await scheduleHeavyWork(work, { ignoreBusy: !!opts.ignoreBusy });
        }
    }

    function queuePersistForced(opts) {
        const persistOpts = opts || {};
        persistQueue = persistQueue
            .then(() => persistToLocalStorageAsync(persistOpts))
            .catch((e) => console.warn('Persist workspace :', e));
    }

    function queuePersistToLocalStorage() {
        const mode = getAutoSaveMode();
        if (mode === 'off') return;
        if (mode === 'interval') return;
        if (mode === 'continuous' && (window._illuCanvasPointerBusy || isHeavyEffectBusy())) {
            window._illuPersistDeferred = true;
            return;
        }
        queuePersistForced({ persistReason: 'continuous' });
    }

    /**
     * @param {{ force?: boolean, manual?: boolean, persistReason?: string }} [opts]
     */
    function persistToLocalStorage(opts) {
        opts = opts || {};
        if (opts.force) {
            if (!opts.manual && !shouldPersistOnExit()) return;
            const reason = opts.manual ? 'manual' : 'exit';
            queuePersistForced({ ignoreBusy: true, persistReason: opts.persistReason || reason });
            return;
        }
        queuePersistToLocalStorage();
    }

    async function hydrateIfNeeded(data) {
        if (data && data.pixelBlobsInIdb && window.indexedDB) {
            try {
                await hydratePayloadFromIdb(data);
            } catch (e) {
                console.warn('Hydratation IndexedDB :', e);
            }
            delete data.pixelBlobsInIdb;
            delete data.idbBlobKeys;
        }
    }

    function sanitizeFilename(name) {
        return String(name || 'export')
            .replace(/[/\\?%*:|"<>]/g, '-')
            .replace(/\s+/g, '_')
            .slice(0, 80) || 'export';
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 2500);
    }

    function compositePixelCanvas() {
        const em = window.EditorManager;
        if (em && typeof em.flattenActivePixelDocument === 'function' && em.isPixelMode) {
            return em.flattenActivePixelDocument();
        }
        const w = em.width;
        const h = em.height;
        const out = document.createElement('canvas');
        out.width = w;
        out.height = h;
        const octx = out.getContext('2d', { willReadFrequently: true });
        octx.clearRect(0, 0, w, h);
        em.layers.forEach((layer) => {
            if (layer.visible && layer.buffer) {
                octx.save();
                octx.globalAlpha = layer.opacity;
                octx.globalCompositeOperation = em.getLayerBlendMode(layer);
                octx.drawImage(layer.buffer, layer.x, layer.y);
                octx.restore();
            }
        });
        octx.globalAlpha = 1;
        octx.globalCompositeOperation = 'source-over';
        return out;
    }

    async function tryRestoreOnInit(em) {
        try {
            let raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) {
                raw = sessionStorage.getItem(SESSION_MIRROR_KEY);
            }
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.format !== 'illu-workspace' || !Array.isArray(data.projects) || !data.projects.length) {
                return false;
            }
            await hydrateIfNeeded(data);
            await em.replaceWorkspaceFromPayload(data);
            return true;
        } catch (e) {
            console.warn('Restauration session :', e);
            return false;
        }
    }

    async function applyWorkspaceFromJsonText(textOrData, opts) {
        opts = opts || {};
        let busy = opts.busy || null;
        const ownBusy =
            !busy &&
            window.IlluProgress &&
            typeof window.IlluProgress.createDelayedInstantEffect === 'function';
        if (ownBusy) {
            busy = window.IlluProgress.createDelayedInstantEffect(
                window.IlluI18n?.t('dlg.loadProject') || 'Chargement',
                80
            );
            busy.showNow();
        } else if (busy && typeof busy.showNow === 'function') {
            busy.showNow();
        }

        const progress = (pct, detail) => {
            if (!busy) return;
            busy.progress(pct);
            if (detail && window.IlluProgress && typeof window.IlluProgress.status === 'function') {
                window.IlluProgress.status(pct, detail);
            }
        };

        try {
            progress(4);
            if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(2);

            let data;
            if (
                textOrData &&
                typeof textOrData === 'object' &&
                textOrData.format === 'illu-workspace'
            ) {
                data = textOrData;
            } else if (typeof textOrData === 'string') {
                progress(8, window.IlluI18n?.t('dlg.loadProjectParse') || 'Analyse du fichier…');
                if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(2);
                data = JSON.parse(textOrData);
                if (typeof window.illuYieldToMain === 'function') await window.illuYieldToMain(1);
            } else {
                throw new Error('Format de projet non reconnu');
            }

            progress(18);
            await hydrateIfNeeded(data);
            progress(22);
            await window.EditorManager.replaceWorkspaceFromPayload(data, opts.append !== false, {
                loadProgress: (pct, detail) => progress(Math.min(98, 22 + pct * 0.76), detail)
            });
            if (getAutoSaveMode() !== 'off') {
                queuePersistForced();
            }
        } finally {
            if (busy) {
                busy.progress(100);
                busy.done();
            }
        }
    }

    async function clearAllIlluIdbBlobs() {
        if (!window.indexedDB) return;
        try {
            const keys = await idbAllKeys();
            const db = await openIdb();
            await new Promise((resolve, reject) => {
                const tx = db.transaction(IDB_STORE, 'readwrite');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                const st = tx.objectStore(IDB_STORE);
                keys.forEach((k) => {
                    if (typeof k === 'string' && k.startsWith('illu_')) st.delete(k);
                });
            });
        } catch (e) {
            console.warn('Purge IndexedDB Illu :', e);
        }
    }

    async function attachIdbBlobsToExportBundle(bundle) {
        if (!bundle || !bundle.keys) return;
        const raw = bundle.keys[STORAGE_KEY];
        if (!raw || !window.indexedDB) return;
        let m;
        try {
            m = JSON.parse(raw);
        } catch (e) {
            return;
        }
        if (!m.idbBlobKeys || !Array.isArray(m.idbBlobKeys) || !m.idbBlobKeys.length) return;
        bundle.version = Math.max(bundle.version || 1, 2);
        bundle.idbBlobs = bundle.idbBlobs || {};
        for (const key of m.idbBlobKeys) {
            try {
                const blob = await idbGet(key);
                if (blob) bundle.idbBlobs[key] = await blobToBase64(blob);
            } catch (e) {
                /* ignore missing */
            }
        }
    }

    async function importIdbBlobsFromBundle(idbBlobs) {
        if (!idbBlobs || typeof idbBlobs !== 'object' || !window.indexedDB) return;
        const keys = Object.keys(idbBlobs);
        const total = keys.length;
        let count = 0;
        for (const key of keys) {
            if (!key.startsWith('illu_')) continue;
            const b64 = idbBlobs[key];
            if (typeof b64 !== 'string') continue;
            try {
                const binStr = atob(b64);
                const bytes = new Uint8Array(binStr.length);
                for (let i = 0; i < binStr.length; i++) bytes[i] = binStr.charCodeAt(i);
                await idbPut(key, new Blob([bytes], { type: 'image/png' }));
                count++;
                if (window.IlluProgress && total > 5) {
                    window.IlluProgress.status(Math.round((count / total) * 100), 'Restaurer base de pixels…');
                }
            } catch (e) {
                console.warn('Import blob IndexedDB fail:', key, e);
            }
        }
        if (window.IlluProgress) window.IlluProgress.statusDone();
    }

    function syncExportQuickImageLabel(isVec) {
        const icon = document.getElementById('export-quick-image-icon');
        const title = document.getElementById('export-quick-image-title');
        const hint = document.getElementById('export-quick-image-hint');
        const t = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t.bind(window.IlluI18n) : (k, fb) => fb || k;
        if (isVec) {
            if (icon) {
                icon.className = 'fa-solid fa-bezier-curve illu-export-quick-btn__icon';
            }
            if (title) title.textContent = t('dlg.exportQuickSvg', 'Image SVG');
            if (hint) hint.textContent = t('dlg.exportQuickSvgHint', 'Vectoriel, sans perte');
        } else {
            if (icon) {
                icon.className = 'fa-regular fa-image illu-export-quick-btn__icon';
            }
            if (title) title.textContent = t('dlg.exportQuickPng', 'Image PNG');
            if (hint) hint.textContent = t('dlg.exportQuickPngHint', 'Photo, réseaux, impression');
        }
    }

    function showExportDialog() {
        const ov = document.getElementById('export-dialog-overlay');
        if (!ov) return;
        const em = window.EditorManager;
        const isVec = em && em.mode === 'vector';
        const fmt = document.getElementById('export-format-select');
        const jpegRow = document.getElementById('export-jpeg-options');
        const webpRow = document.getElementById('export-webp-options');
        const pngNote = document.getElementById('export-png-note');
        const vectorPngScaleRow = document.getElementById('export-vector-png-scale-row');
        const scopeRow = document.getElementById('export-scope-row');
        const illuRow = document.getElementById('export-illu-options');
        const icoRow = document.getElementById('export-ico-options');
        const colorRow = document.getElementById('export-color-options');
        const morePanel = document.getElementById('export-more-panel');

        syncExportQuickImageLabel(isVec);

        if (fmt) {
            fmt.innerHTML = '';
            const add = (v, label) => {
                const o = document.createElement('option');
                o.value = v;
                o.textContent = label;
                fmt.appendChild(o);
            };
            if (isVec) {
                add('svg', 'SVG (.svg)');
                add('png', 'PNG haute résolution (.png)');
                add('illu', 'Projet Illu (.illu)');
            } else {
                add('png', 'PNG (.png)');
                add('jpeg', 'JPEG (.jpg)');
                add('webp', 'WebP (.webp)');
                add('gif', 'GIF (.gif)');
                add('ico', 'Icône (.ico)');
                add('pdn', 'Paint.NET (.pdn)');
                add('illu', 'Projet Illu (.illu)');
            }
            fmt.value = isVec ? 'svg' : 'png';
        }

        const setHidden = (el, hide) => {
            if (!el) return;
            if (hide) el.setAttribute('hidden', '');
            else el.removeAttribute('hidden');
        };

        const syncOpts = () => {
            const v = fmt ? fmt.value : 'illu';
            setHidden(jpegRow, v !== 'jpeg');
            setHidden(webpRow, v !== 'webp');
            setHidden(pngNote, v !== 'png');
            setHidden(vectorPngScaleRow, !(isVec && v === 'png'));
            setHidden(icoRow, v !== 'ico');
            setHidden(scopeRow, v !== 'illu');
            setHidden(illuRow, v !== 'illu');
            setHidden(colorRow, v !== 'png' && v !== 'gif');
            if (scopeRow) scopeRow.style.display = v === 'illu' ? 'flex' : 'none';
        };

        if (fmt) {
            fmt.onchange = syncOpts;
            syncOpts();
        }

        if (morePanel && !morePanel.dataset.illuExportBound) {
            morePanel.dataset.illuExportBound = '1';
            morePanel.addEventListener('toggle', () => {
                if (morePanel.open && fmt) syncOpts();
            });
        }

        const histCk = document.getElementById('export-include-history');
        if (histCk) histCk.checked = true;

        const scopeEl = document.getElementById('export-scope-select');
        if (scopeEl) scopeEl.value = 'current';

        const ck = document.getElementById('export-auto-save-check');
        const lbl = document.getElementById('export-auto-save-label');
        if (ck) {
            ck.checked = !!(em && em.activeProject && em.activeProject.autoSaveLocal);
            if (lbl) {
                const min = getAutoSaveIntervalMinutes();
                const raw =
                    window.IlluI18n?.t('dlg.autoSaveInterval') || 'Auto-sauvegarde (toutes les {min} min)';
                lbl.textContent = raw.replace('{min}', min);
            }
        }

        syncExportLocalSaveStatus();

        ov.style.display = 'flex';
    }

    /** Export en un clic : PNG (ou SVG) ou projet .illu (onglet actuel). */
    function runQuickExport(kind) {
        const em = window.EditorManager;
        if (!em || !em.activeProject) {
            window.showIlluAlert?.('Aucun projet ouvert à exporter.');
            return;
        }
        if (kind === 'illu') {
            runExportDownload({ fmt: 'illu', scope: 'current', includeHistory: true });
            return;
        }
        const isVec = em.mode === 'vector';
        runExportDownload({ fmt: isVec ? 'svg' : 'png', bits: '8' });
    }

    function hideExportDialog() {
        const P = window.IlluProgress;
        if (P && typeof P.setInstantEffectBusy === 'function') {
            P.setInstantEffectBusy(false);
        }
        const ov = document.getElementById('export-dialog-overlay');
        if (ov) ov.style.display = 'none';
    }

function applyBitDepthReduction(ctx, width, height, bits) {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Si on a choisi "bw" (Noir & Blanc Intelligent)
    if (bits === "bw") {
        let totalLuminance = 0;
        let count = 0;

        // On calcule la moyenne pour le seuil
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 10) { 
                totalLuminance += (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
                count++;
            }
        }
        const threshold = count > 0 ? totalLuminance / count : 128;

        for (let i = 0; i < data.length; i += 4) {
            const lum = (0.299 * data[i] + 0.587 * data[i+1] + 0.114 * data[i+2]);
            const val = lum > threshold ? 255 : 0; 
            data[i] = data[i+1] = data[i+2] = val;
        }
    } 
    // Sinon on utilise la réduction mathématique classique (1, 2, 4, 8 bits)
    else {
        const b = parseInt(bits, 10);
        const levels = Math.pow(2, b);
        const step = 255 / (levels - 1);

        for (let i = 0; i < data.length; i += 4) {
            data[i]     = Math.round(data[i] / step) * step;
            data[i + 1] = Math.round(data[i + 1] / step) * step;
            data[i + 2] = Math.round(data[i + 2] / step) * step;
        }
    }
    
    ctx.putImageData(imgData, 0, 0);
}

    function runExportDownload(overrides) {
        const P = window.IlluProgress;
        if (P && typeof P.setInstantEffectBusy === 'function') {
            const t = window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t : (k, fb) => fb || k;
            P.setInstantEffectBusy(true, t('dlg.exporting', 'Exportation et Traitement...'));
            P.instantEffectProgress(30);
        }
        
        // Defer execution to allow the browser to render the loading overlay
        requestAnimationFrame(() => {
            setTimeout(() => {
                _doRunExportDownload(overrides);
            }, 50);
        });
    }

    function _doRunExportDownload(overrides) {
        overrides = overrides || {};
        const em = window.EditorManager;
        const fmtEl = document.getElementById('export-format-select');
        const fmt = overrides.fmt != null ? overrides.fmt : fmtEl ? fmtEl.value : 'illu';
        const scopeEl = document.getElementById('export-scope-select');
        const scope = overrides.scope != null ? overrides.scope : scopeEl ? scopeEl.value : 'current';

        const jpegQ = document.getElementById('export-jpeg-quality');
        const webpQ = document.getElementById('export-webp-quality');
        const qJ = jpegQ ? parseInt(jpegQ.value, 10) / 100 : 0.92;
        const qW = webpQ ? parseInt(webpQ.value, 10) / 100 : 0.85;

        const includeHistory =
            overrides.includeHistory != null
                ? !!overrides.includeHistory
                : !!(document.getElementById('export-include-history')?.checked);

        if (fmt === 'illu') {
            em.syncActiveVectorSvg();
            
            // Apply project scope filtering
            let payload = null;
            let filename = 'MasterPaint-session.illu';
            
            if (scope === 'current' && em.activeProject) {
                // [AMELIORATION] Détection automatique des calques alpha associés
                const projectsToSerialize = [em.activeProject];
                if (em.isPixelMode && Array.isArray(em.activeProject.layers)) {
                    em.activeProject.layers.forEach(l => {
                        if (l && l.alphaMaskProjectId) {
                            const maskProj = em.projects.find(p => p.id === l.alphaMaskProjectId);
                            if (maskProj && maskProj.role === 'layerAlphaMask' && !projectsToSerialize.includes(maskProj)) {
                                projectsToSerialize.push(maskProj);
                            }
                        }
                    });
                }
                payload = em.serializeWorkspacePayload(projectsToSerialize, { includeHistory });
                filename = `${sanitizeFilename(em.activeProject.name || 'project')}.illu`;
            } else {
                payload = em.serializeWorkspacePayload(null, { includeHistory });
            }

            const blob = new Blob([JSON.stringify(payload, null, 0)], {
                type: 'application/json;charset=utf-8'
            });
            downloadBlob(blob, filename);
            hideExportDialog();
            return;
        }

        if (em.mode === 'vector' && fmt === 'svg') {
            const svgData =
                typeof em.getStandaloneSvgMarkup === 'function'
                    ? em.getStandaloneSvgMarkup()
                    : (() => {
                          const svgEl = document.getElementById('drawing-svg');
                          return svgEl ? svgEl.outerHTML : '';
                      })();
            if (!svgData || !svgData.includes('<svg')) {
                window.showIlluAlert('Export SVG : rien à exporter.');
                hideExportDialog();
                return;
            }
            const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
            downloadBlob(blob, `${sanitizeFilename(em.activeProject?.name)}.svg`);
            hideExportDialog();
            return;
        }

        if (em.mode === 'vector' && fmt === 'png') {
            const scaleEl = document.getElementById('export-vector-png-scale');
            const scale =
                overrides.scale != null
                    ? Number(overrides.scale)
                    : scaleEl
                      ? parseFloat(scaleEl.value)
                      : 2;
            const base = sanitizeFilename(em.activeProject?.name || 'image');
            const runVectorPng = (canvas) => {
                const bitsEl = document.getElementById('export-colors-bits');
                const bitsValue =
                    overrides.bits != null ? String(overrides.bits) : bitsEl ? bitsEl.value : '8';
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tCtx = tempCanvas.getContext('2d');
                if (tCtx) {
                    tCtx.drawImage(canvas, 0, 0);
                    if (bitsValue !== '8') {
                        applyBitDepthReduction(tCtx, tempCanvas.width, tempCanvas.height, bitsValue);
                    }
                }
                tempCanvas.toBlob((blob) => {
                    if (blob) downloadBlob(blob, `${base}.png`);
                    hideExportDialog();
                }, 'image/png');
            };
            if (typeof em.flattenActiveVectorDocument === 'function') {
                em.flattenActiveVectorDocument(scale).then(runVectorPng).catch((err) => {
                    console.warn(err);
                    window.showIlluAlert?.('Export PNG vecteur impossible.');
                    hideExportDialog();
                });
            } else {
                window.showIlluAlert?.('Export PNG vecteur non disponible.');
                hideExportDialog();
            }
            return;
        }

        if (!em.isPixelMode) {
            window.showIlluAlert('Export image raster : passez sur un onglet mode Pixel, ou choisissez SVG / projet.');
            return;
        }

        const canvas = compositePixelCanvas();
        const base = sanitizeFilename(em.activeProject?.name || 'image');

        if (fmt === 'pdn') {
            if (!window.PdnFile || typeof window.PdnFile.exportMasterPaintPdn !== 'function') {
                window.showIlluAlert('Export .pdn : chargez js/io/PdnFile.js.');
                hideExportDialog();
                return;
            }
            window.PdnFile.exportMasterPaintPdn(em)
                .then((bytes) => {
                    const blob = new Blob([bytes], { type: 'application/octet-stream' });
                    downloadBlob(blob, `${base}.pdn`);
                    hideExportDialog();
                    window.showIlluAlert?.(
                        'Projet enregistré au format .pdn MasterPaint (MPDN). Réouverture dans Illu ; Paint.NET officiel ne lit pas ce sous-format sans sérialisation .NET complète.'
                    );
                })
                .catch((err) => {
                    console.warn(err);
                    window.showIlluAlert?.(
                        err && err.message ? `Export .pdn : ${err.message}` : 'Export .pdn impossible.'
                    );
                    hideExportDialog();
                });
            return;
        }

if (fmt === 'ico') {
    const sizes = [1024, 256, 128, 64, 32];
    const imagePromises = sizes.map(size => {
        return new Promise((resolve) => {
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = size;
            tempCanvas.height = size;
            const tCtx = tempCanvas.getContext('2d');
            tCtx.imageSmoothingEnabled = true;
            tCtx.imageSmoothingQuality = 'high';
            tCtx.drawImage(canvas, 0, 0, size, size);
            tempCanvas.toBlob(resolve, 'image/png');
        });
    });

    Promise.all(imagePromises).then(async (blobs) => {
        const validBlobs = blobs.filter(b => b !== null);
        const count = validBlobs.length;
        
        // ICO Header (6 bytes): Reserved(2), Type(2), Count(2)
        const header = new Uint8Array(6);
        const view = new DataView(header.buffer);
        view.setUint16(0, 0, true); // Reserved
        view.setUint16(2, 1, true); // Type: ICO
        view.setUint16(4, count, true); // Count
        
        const directoryEntries = [];
        let offset = 6 + count * 16;
        
        const imageDataList = [];
        
        for (let i = 0; i < count; i++) {
            const blob = validBlobs[i];
            const size = sizes[i];
            const arrayBuffer = await blob.arrayBuffer();
            const pngData = new Uint8Array(arrayBuffer);
            imageDataList.push(pngData);
            
            // Entry (16 bytes): W, H, Colors, Res, Planes, BPP, Size, Offset
            const entry = new Uint8Array(16);
            const eView = new DataView(entry.buffer);
            eView.setUint8(0, size >= 256 ? 0 : size);
            eView.setUint8(1, size >= 256 ? 0 : size);
            eView.setUint8(2, 0); // Colors
            eView.setUint8(3, 0); // Reserved
            eView.setUint16(4, 1, true); // Planes
            eView.setUint16(6, 32, true); // BPP
            eView.setUint32(8, pngData.length, true); // Data size
            eView.setUint32(12, offset, true); // Offset
            
            directoryEntries.push(entry);
            offset += pngData.length;
        }
        
        // Combine all chunks
        const totalSize = offset;
        const finalBuffer = new Uint8Array(totalSize);
        finalBuffer.set(header, 0);
        
        let currentPos = 6;
        for (const entry of directoryEntries) {
            finalBuffer.set(entry, currentPos);
            currentPos += 16;
        }
        
        for (const img of imageDataList) {
            finalBuffer.set(img, currentPos);
            currentPos += img.length;
        }
        
        const finalBlob = new Blob([finalBuffer], { type: 'image/x-icon' });
        downloadBlob(finalBlob, `${base}.ico`);
        hideExportDialog();
    });
    return;
}
// Dans runExportDownload, après la définition du 'canvas' composite :

// --- DANS runExportDownload ---

if (fmt === 'png' || fmt === 'gif') {
    const bitsEl = document.getElementById('export-colors-bits');
    const bitsValue = overrides.bits != null ? String(overrides.bits) : bitsEl ? bitsEl.value : '8';
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tCtx = tempCanvas.getContext('2d');

    tCtx.drawImage(canvas, 0, 0);

    // 2. ON APPLIQUE LA RÉDUCTION (Sauf si 8 bits qui est le standard)
    if (bitsValue !== "8") {
        applyBitDepthReduction(tCtx, tempCanvas.width, tempCanvas.height, bitsValue);
    }

    const mime = fmt === 'gif' ? 'image/gif' : 'image/png';
    tempCanvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, `${base}.${fmt}`);
        hideExportDialog();
    }, mime);
    return;
}
        if (fmt === 'jpeg') {
            canvas.toBlob(
                (blob) => {
                    if (blob) downloadBlob(blob, `${base}.jpg`);
                    hideExportDialog();
                },
                'image/jpeg',
                Math.min(1, Math.max(0.05, qJ))
            );
            return;
        }

        if (fmt === 'webp') {
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        downloadBlob(blob, `${base}.webp`);
                    } else {
                        window.showIlluAlert('WebP non pris en charge par ce navigateur.');
                    }
                    hideExportDialog();
                },
                'image/webp',
                Math.min(1, Math.max(0.05, qW))
            );
            return;
        }

        hideExportDialog();
    }

    function wireExportDialog() {
        const cancel = document.getElementById('export-dialog-cancel');
        const ok = document.getElementById('export-dialog-ok');
        const saveLocal = document.getElementById('export-dialog-save-local');
        if (cancel) cancel.onclick = () => hideExportDialog();
        if (ok) ok.onclick = () => runExportDownload();

        document.querySelectorAll('[data-export-quick]').forEach((btn) => {
            if (btn.dataset.illuExportQuickBound === '1') return;
            btn.dataset.illuExportQuickBound = '1';
            btn.addEventListener('click', () => {
                const kind = btn.getAttribute('data-export-quick');
                if (kind === 'illu') runQuickExport('illu');
                else runQuickExport('image');
            });
        });

        if (saveLocal) {
            saveLocal.onclick = async () => {
                const P = window.IlluProgress;
                if (P && typeof P.setInstantEffectBusy === 'function') {
                    P.setInstantEffectBusy(true, window.IlluI18n.t('settings.autoSaveModalTitle'));
                    P.instantEffectProgress(10);
                }
                try {
                    // Manual trigger of all local backup systems
                    persistToLocalStorage({ force: true, manual: true, persistReason: 'manual' });

                    // Simple confirm
                    window.setTimeout(() => {
                        if (P && typeof P.setInstantEffectBusy === 'function') {
                            P.setInstantEffectBusy(false);
                        }
                        const msg = window.IlluI18n.t('dlg.saveLocalConfirm') || 'Projet enregistré localement !';
                        if (typeof window.showIlluAlert === 'function') {
                            window.showIlluAlert(msg);
                        } else {
                            alert(msg);
                        }
                        hideExportDialog();
                    }, 1200);
                } catch (e) {
                    console.error('Manual local save failed:', e);
                    if (P && typeof P.setInstantEffectBusy === 'function') {
                        P.setInstantEffectBusy(false);
                    }
                }
            };
        }

        const jq = document.getElementById('export-jpeg-quality');
        const jqv = document.getElementById('export-jpeg-quality-val');
        if (jq && jqv) {
            jq.addEventListener('input', () => {
                jqv.textContent = `${jq.value}%`;
            });
        }
        const wq = document.getElementById('export-webp-quality');
        const wqv = document.getElementById('export-webp-quality-val');
        if (wq && wqv) {
            wq.addEventListener('input', () => {
                wqv.textContent = `${wq.value}%`;
            });
        }

        const ck = document.getElementById('export-auto-save-check');
        if (ck) {
            ck.onchange = () => {
                const em = window.EditorManager;
                if (em && em.activeProject) {
                    em.activeProject.autoSaveLocal = ck.checked;
                    setupAutoSaveIntervalTimer();
                    syncExportLocalSaveStatus();
                }
            };
        }
    }

    function wirePersistence() {
        const saveOnExit = () => persistToLocalStorage({ force: true });
        window.addEventListener('beforeunload', saveOnExit);
        window.addEventListener('pagehide', saveOnExit);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') saveOnExit();
        });
        window.addEventListener('illu:busy-change', () => {
            if (isHeavyEffectBusy()) return;
            if (window._illuCanvasPointerBusy) return;
            if (window._illuIntervalPersistDeferred) {
                window._illuIntervalPersistDeferred = false;
                runIntervalPersistJob();
                return;
            }
            if (window._illuPersistDeferred) {
                onUserIdleAfterCanvas();
            }
        });
    }

    window.WorkspaceIO = {
        STORAGE_KEY,
        SESSION_MIRROR_KEY,
        RAM_MIRROR_PREF_KEY,
        AUTO_SAVE_MODE_KEY,
        AUTO_SAVE_INTERVAL_MIN_KEY,
        LAST_PERSIST_META_KEY,
        getAutoSaveMode,
        getAutoSaveIntervalMinutes,
        shouldScheduleHistoryPersist,
        shouldPersistOnExit,
        getLastPersistMeta,
        syncExportLocalSaveStatus,
        persistToLocalStorage,
        persistToLocalStorageAsync,
        queuePersistToLocalStorage,
        queuePersistForced,
        setupAutoSaveIntervalTimer,
        wireCanvasInteractionGate,
        tryRestoreOnInit,
        applyWorkspaceFromJsonText,
        applyWorkspaceFromParsed: applyWorkspaceFromJsonText,
        clearAllIlluIdbBlobs,
        attachIdbBlobsToExportBundle,
        importIdbBlobsFromBundle,
        showExportDialog,
        hideExportDialog,
        runQuickExport
    };

    window.saveFile = function () {
        const em = window.EditorManager;
        if (em && em.activeProject && em.activeProject.autoSaveLocal) {
            // Direct local save if project opted-in for local auto-save
            persistToLocalStorage({ force: true, manual: true });
            const P = window.IlluProgress;
            if (P && typeof P.setInstantEffectBusy === 'function') {
                P.setInstantEffectBusy(true, window.IlluI18n?.t('settings.autoSaveModalTitle') || 'Sauvegarde…');
                P.instantEffectProgress(25);
                setTimeout(() => P.setInstantEffectBusy(false), 800);
            }
            return;
        }
        showExportDialog();
    };

    wireExportDialog();
    wirePersistence();
})();
