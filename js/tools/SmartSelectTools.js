/**
 * Outils de sélection assistée : Sélection rapide, Sélection d'objet, Lasso magnétique.
 *
 * Couche d'interaction seulement — tout le calcul est dans js/tools/select-core.js,
 * exécuté par js/tools/select-worker.js pour ne jamais bloquer l'interface.
 *
 * Une session worker = le tampon du calque actif réduit une fois selon la qualité,
 * avec sa carte de contours. Elle est (re)construite au début de chaque geste :
 * c'est ce qui permet au lasso magnétique de répondre à chaque frame ensuite.
 *
 * Les trois outils aboutissent au même endroit que les outils historiques :
 *   • rapide / objet → masque de calque → commitLayerMaskAsSelection()
 *   • lasso magnétique → polygone document → selectionKind = 'lasso'
 * Ils héritent donc sans rien de plus des modes Nouveau / Ajouter / Soustraire,
 * de l'inversion, du déplacement, de la déformation et du rendu du contour.
 */
(function () {
    'use strict';

    const TOOLS = new Set(['quick-select', 'object-select', 'magnetic-lasso', 'poly-lasso']);
    /* Le lasso polygonal partage toute la mécanique d'ancres du lasso magnétique,
       mais relie les points en ligne droite : aucun calcul, donc aucun worker. */
    const POLY = 'poly-lasso';

    const DEFAULTS = {
        smartSelectQuality: 'medium',
        smartSelectTolerance: 45,
        smartSelectBrush: 24,
        magneticFrequency: 45,
        magneticWidth: 24
    };

    const S = {
        worker: null,
        workerBroken: false,
        sessionId: 0,
        sessionSeq: 0,
        sessionReady: false,
        sessionKey: '',
        jobSeq: 0,
        latestMaskJob: 0,
        latestPathJob: 0,
        pending: [],

        /* geste en cours */
        mode: null,          // 'quick' | 'object' | 'magnetic'
        dabs: null,          // sélection rapide : coups de pinceau (coords calque)
        lastDab: null,
        quickThrottle: 0,
        quickDirty: false,
        combineOp: 'new',
        backupMask: null,

        rectStart: null,     // sélection d'objet

        anchors: null,       // lasso : points validés (coords document)
        segment: null,       // chemin provisoire depuis la dernière ancre
        poly: false,         // true = lasso polygonal (segments droits, sans worker)
        dragTrace: false,    // magnétique : geste en cours tant que le bouton est enfoncé
        movedSinceDown: false,
        pathBusy: false,
        pathQueued: null,
        busyUi: null
    };

    /* ─── Accès réglages ─────────────────────────────────────────────────── */

    function prop(name) {
        const p = window.EditorManager && window.EditorManager.toolProps;
        const v = p ? p[name] : undefined;
        return v === undefined || v === null ? DEFAULTS[name] : v;
    }
    function quality() {
        const q = prop('smartSelectQuality');
        return q === 'fast' || q === 'slow' ? q : 'medium';
    }

    function activeLayer() {
        const em = window.EditorManager;
        return em && em.isPixelMode ? em.activeLayer : null;
    }

    function isActive() {
        return !!(TOOLS.has(window.activeTool) && activeLayer());
    }

    /* ─── Session worker ─────────────────────────────────────────────────── */

    function ensureWorker() {
        if (S.workerBroken) return null;
        if (S.worker) return S.worker;
        try {
            console.log('SmartSelectTools: Initializing selection worker (js/tools/select-worker.js)');
            S.worker = new Worker('js/tools/select-worker.js');
            S.worker.onmessage = onWorkerMessage;
            S.worker.onerror = function (err) {
                console.error('SmartSelectTools: worker error', err);
                S.workerBroken = true;
                try { S.worker.terminate(); } catch (e) { /* ignore */ }
                S.worker = null;
                S.sessionReady = false;
                endBusy();
            };
        } catch (e) {
            S.workerBroken = true;
            S.worker = null;
        }
        return S.worker;
    }

    /**
     * (Re)construit la session à partir du tampon du calque actif.
     * Appelée au début de chaque geste : le calque a pu être peint entre-temps,
     * et la qualité changée dans le ruban.
     */
    function startSession() {
        const l = activeLayer();
        const w = ensureWorker();
        if (!l || !l.buffer || !w) return false;
        const ctx = l.buffer.getContext('2d', { willReadFrequently: true });
        if (!ctx) return false;
        const img = ctx.getImageData(0, 0, l.buffer.width, l.buffer.height);
        const copy = new Uint8ClampedArray(img.data);
        S.sessionId = ++S.sessionSeq;
        S.sessionReady = false;
        S.pending.length = 0;
        try {
            w.postMessage(
                {
                    type: 'session',
                    sessionId: S.sessionId,
                    width: l.buffer.width,
                    height: l.buffer.height,
                    quality: quality(),
                    buffer: copy.buffer
                },
                [copy.buffer]
            );
        } catch (e) {
            S.workerBroken = true;
            return false;
        }
        return true;
    }

    function post(msg) {
        const w = ensureWorker();
        if (!w) return;
        msg.sessionId = S.sessionId;
        if (!S.sessionReady) {
            /* Une seule requête en attente par type : la dernière prime. */
            S.pending = S.pending.filter((m) => m.type !== msg.type);
            S.pending.push(msg);
            return;
        }
        try { w.postMessage(msg); } catch (e) { /* ignore */ }
    }

    function onWorkerMessage(ev) {
        const msg = ev.data || {};
        if (msg.sessionId !== S.sessionId) return;
        if (msg.type === 'sessionReady') {
            S.sessionReady = true;
            const q = S.pending.slice();
            S.pending.length = 0;
            q.forEach(post);
            return;
        }
        if (msg.type === 'error') {
            console.warn('SmartSelectTools:', msg.message);
            S.pathBusy = false;
            endBusy();
            return;
        }
        if (msg.type === 'livewireResult') {
            S.pathBusy = false;
            if (msg.jobId === S.latestPathJob) applyLivewirePath(msg.path);
            if (S.pathQueued) {
                const nxt = S.pathQueued;
                S.pathQueued = null;
                requestPath(nxt.x, nxt.y);
            }
            return;
        }
        if (msg.type === 'maskResult') {
            if (msg.jobId !== S.latestMaskJob) return;
            applyMaskResult(msg);
            return;
        }
    }

    function dropSession() {
        if (S.worker && S.sessionId) {
            try { S.worker.postMessage({ type: 'drop', sessionId: S.sessionId }); } catch (e) { /* ignore */ }
        }
        S.sessionReady = false;
        S.pending.length = 0;
    }

    /* ─── Indicateur d'attente ───────────────────────────────────────────── */

    function beginBusy(labelKey, fallback) {
        endBusy();
        const P = window.IlluProgress;
        if (!P || typeof P.createDelayedInstantEffect !== 'function') return;
        const name =
            window.IlluI18n && typeof window.IlluI18n.t === 'function'
                ? window.IlluI18n.t(labelKey)
                : fallback;
        S.busyUi = P.createDelayedInstantEffect(name, 250);
    }
    function endBusy() {
        if (S.busyUi) {
            try { S.busyUi.done(); } catch (e) { /* ignore */ }
            S.busyUi = null;
        }
    }

    /* ─── Application d'un masque ────────────────────────────────────────── */

    function applyMaskResult(msg) {
        endBusy();
        const l = activeLayer();
        if (!l || !l.buffer) return;
        const lw = l.buffer.width;
        const lh = l.buffer.height;
        if (msg.fullW !== lw || msg.fullH !== lh) return;

        const Core = window.IlluSelectCore;
        const small = msg.mask instanceof Uint8Array ? msg.mask : new Uint8Array(msg.mask);
        const full = Core ? Core.upscaleMask(small, msg.w, msg.h, lw, lh) : small;

        let hasAny = false;
        for (let i = 0; i < full.length; i++) if (full[i]) { hasAny = true; break; }

        if (S.combineOp === 'add' || S.combineOp === 'subtract') {
            if (typeof window.combineSelectionWithNewLayerMask === 'function') {
                window.combineSelectionWithNewLayerMask(full, S.combineOp, S.backupMask);
            }
        } else if (hasAny) {
            if (typeof window.commitLayerMaskAsSelection === 'function') {
                window.commitLayerMaskAsSelection(full, lw, lh);
            }
        } else if (msg.kind === 'object') {
            /* Rien trouvé : on le dit plutôt que de laisser l'écran inchangé. */
            if (typeof window.showToast === 'function') {
                window.showToast(
                    tr('smartSel.objectNothing', 'Aucun objet détecté dans le cadre.'),
                    window.innerWidth / 2,
                    80
                );
            }
        }
        /* Ne pas réinitialiser S.combineOp / S.backupMask ici : la sélection rapide
           republie un masque à chaque rafraîchissement du trait, et le contexte de
           combinaison doit valoir pour tous ces résultats — y compris le dernier.
           Il est écrasé au geste suivant par beginCombine(), et vidé par cancel(). */
        if (typeof window.illuSyncSelectionAdjustToolbar === 'function') {
            window.illuSyncSelectionAdjustToolbar();
        }
        if (window.EditorManager) window.EditorManager.render();
    }

    function tr(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const v = window.IlluI18n.t(key);
            if (v !== key) return v;
        }
        return fallback;
    }

    /* ─── Sélection rapide (pinceau) ─────────────────────────────────────── */

    function quickBrushRadiusDoc() {
        return Math.max(1, prop('smartSelectBrush') / 2);
    }

    function addDab(pos) {
        const l = activeLayer();
        if (!l) return;
        const x = pos.x - l.x;
        const y = pos.y - l.y;
        const r = quickBrushRadiusDoc();
        if (S.lastDab) {
            /* Interpole entre deux événements pour un trait continu. */
            const dx = x - S.lastDab.x;
            const dy = y - S.lastDab.y;
            const d = Math.hypot(dx, dy);
            const steps = Math.floor(d / Math.max(1, r * 0.5));
            for (let i = 1; i <= steps; i++) {
                S.dabs.push({ x: S.lastDab.x + (dx * i) / steps, y: S.lastDab.y + (dy * i) / steps, r });
            }
        }
        S.dabs.push({ x, y, r });
        S.lastDab = { x, y };
    }

    function flushQuick(force) {
        if (!S.dabs || !S.dabs.length) return;
        const now = performance.now();
        if (!force && now - S.quickThrottle < 110) {
            S.quickDirty = true;
            return;
        }
        S.quickThrottle = now;
        S.quickDirty = false;
        S.latestMaskJob = ++S.jobSeq;
        post({
            type: 'quick',
            jobId: S.latestMaskJob,
            dabs: S.dabs.slice(),
            tolerance: prop('smartSelectTolerance')
        });
    }

    /* ─── Lasso magnétique ───────────────────────────────────────────────── */

    function lastAnchor() {
        return S.anchors && S.anchors.length ? S.anchors[S.anchors.length - 1] : null;
    }

    function requestPath(x, y) {
        const a = lastAnchor();
        if (!a) return;
        if (S.pathBusy) {
            S.pathQueued = { x: x, y: y };
            return;
        }
        const l = activeLayer();
        if (!l) return;
        S.pathBusy = true;
        S.latestPathJob = ++S.jobSeq;
        post({
            type: 'livewire',
            jobId: S.latestPathJob,
            from: { x: a.x - l.x, y: a.y - l.y },
            to: { x: x - l.x, y: y - l.y },
            margin: Math.max(6, prop('magneticWidth')),
            pull: 1
        });
    }

    function applyLivewirePath(flat) {
        const l = activeLayer();
        if (!l || !flat) return;
        const pts = [];
        for (let i = 0; i < flat.length; i += 2) {
            pts.push({ x: flat[i] + l.x, y: flat[i + 1] + l.y });
        }
        S.segment = pts;

        /* Pose automatique d'ancres : au-delà de la « fréquence » réglée, le début
           du tracé est figé. Sans cela, un long segment serait recalculé en entier
           à chaque frame et le chemin « glisserait » derrière le curseur. */
        const freq = Math.max(8, prop('magneticFrequency'));
        if (pts.length > 2) {
            let acc = 0;
            for (let i = 1; i < pts.length; i++) {
                acc += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
                if (acc >= freq && i < pts.length - 1) {
                    S.anchors.push({ x: pts[i].x, y: pts[i].y });
                    S.segment = pts.slice(i);
                    break;
                }
            }
        }
        paintLassoDraft();
    }

    function lassoDraftPoints() {
        const pts = (S.anchors || []).slice();
        if (S.segment && S.segment.length) {
            for (let i = 1; i < S.segment.length; i++) pts.push(S.segment[i]);
        }
        return pts;
    }

    function paintLassoDraft() {
        const pts = lassoDraftPoints();
        if (typeof window.scheduleSelectionOverlayOnly === 'function') {
            window.scheduleSelectionOverlayOnly({ lassoPoints: pts });
        }
    }

    /** Ferme le lasso et transforme le polygone en sélection. */
    function commitMagnetic() {
        const pts = lassoDraftPoints();
        endBusy();
        if (pts.length < 3) {
            cancel();
            return;
        }
        const l = activeLayer();
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        pts.forEach((p) => {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
        });

        if ((S.combineOp === 'add' || S.combineOp === 'subtract') && l && l.buffer &&
            typeof window.rasterizeDocLassoPolygonToLayerMask === 'function') {
            const lw = l.buffer.width;
            const lh = l.buffer.height;
            const nm = new Uint8Array(lw * lh);
            window.rasterizeDocLassoPolygonToLayerMask(pts, l.x, l.y, lw, lh, nm);
            if (typeof window.combineSelectionWithNewLayerMask === 'function') {
                window.combineSelectionWithNewLayerMask(nm, S.combineOp, S.backupMask);
            }
        } else {
            window.selectionBounds = {
                x: minX,
                y: minY,
                w: Math.max(1, Math.ceil(maxX - minX)),
                h: Math.max(1, Math.ceil(maxY - minY))
            };
            window.selectionKind = 'lasso';
            window.selectionColorMask = null;
            window.selectionLassoPoints = pts;
            window.selectionInverted = false;
            window.selectionPreviewAngleRad = 0;
            window.selectionIsWarpQuad = false;
            if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
        }
        resetGesture();
        if (typeof window.illuSyncSelectionAdjustToolbar === 'function') {
            window.illuSyncSelectionAdjustToolbar();
        }
        if (window.EditorManager) window.EditorManager.render();
    }

    function resetGesture() {
        S.mode = null;
        S.dabs = null;
        S.lastDab = null;
        S.quickDirty = false;
        S.rectStart = null;
        S.anchors = null;
        S.segment = null;
        S.poly = false;
        S.dragTrace = false;
        S.movedSinceDown = false;
        S.pathQueued = null;
        S.pathBusy = false;
        /* S.combineOp / S.backupMask appartiennent au calcul en attente, pas au
           geste : la sélection d'objet poste sa requête une fois le cadre relâché.
           Les effacer ici ferait perdre l'ancienne sélection en mode Ajouter /
           Soustraire (le repli relirait le cadre de tracé au lieu d'elle). */
        if (typeof window.endSelectionDraftChrome === 'function') window.endSelectionDraftChrome();
    }

    /** Abandonne le geste en cours sans rien sélectionner (Échap, changement d'outil). */
    function cancel() {
        if (!S.mode) return false;
        const wasMagnetic = S.mode === 'magnetic';
        S.latestMaskJob = ++S.jobSeq;   // invalide un calcul déjà parti
        resetGesture();
        S.backupMask = null;
        S.combineOp = 'new';
        endBusy();
        if (wasMagnetic && typeof window.refreshSelectionVisual === 'function') {
            window.refreshSelectionVisual();
        }
        if (window.EditorManager) window.EditorManager.render();
        return true;
    }

    /* ─── Entrées pointeur (appelées depuis DrawingTools) ────────────────── */

    function beginCombine(e) {
        S.combineOp =
            typeof window.illuLockSelectionCombineOp === 'function'
                ? window.illuLockSelectionCombineOp(e)
                : 'new';
        if (typeof window.illuConsumeSelectionCombineOp === 'function') {
            window.illuConsumeSelectionCombineOp();
        }
        S.backupMask =
            (S.combineOp === 'add' || S.combineOp === 'subtract') &&
            typeof window.rasterizeCurrentSelectionToLayerMask === 'function'
                ? window.rasterizeCurrentSelectionToLayerMask()
                : null;
    }

    function onPointerDown(e, pos) {
        if (!isActive()) return false;
        const tool = window.activeTool;

        if (tool === 'magnetic-lasso' || tool === POLY) {
            const poly = tool === POLY;
            if (S.mode === 'magnetic' && S.anchors && S.anchors.length) {
                /* Seul le polygonal enchaîne les clics ; le magnétique se trace
                   bouton enfoncé et se referme au relâchement (voir onPointerUp). */
                const first = S.anchors[0];
                const z = window.EditorManager.getCanvasZoomLevel() || 1;
                const near = Math.hypot(pos.x - first.x, pos.y - first.y) * z <= 12;
                if (near || e.detail >= 2) {
                    commitMagnetic();
                    return true;
                }
                const seg = S.segment;
                if (seg && seg.length > 1) {
                    for (let i = 1; i < seg.length; i++) S.anchors.push(seg[i]);
                }
                S.anchors.push({ x: pos.x, y: pos.y });
                S.segment = null;
                paintLassoDraft();
                return true;
            }
            beginCombine(e);
            if (!poly) startSession();
            S.mode = 'magnetic';
            S.poly = poly;
            S.dragTrace = !poly;   // magnétique : le geste dure tant que le bouton est enfoncé
            S.movedSinceDown = false;
            S.anchors = [{ x: pos.x, y: pos.y }];
            S.segment = null;
            if (typeof window.beginSelectionDraftChrome === 'function') {
                window.beginSelectionDraftChrome();
            }
            paintLassoDraft();
            return true;
        }

        if (tool === 'quick-select') {
            beginCombine(e);
            startSession();
            S.mode = 'quick';
            S.dabs = [];
            S.lastDab = null;
            S.quickThrottle = 0;
            if (typeof window.beginSelectionDraftChrome === 'function') {
                window.beginSelectionDraftChrome();
            }
            addDab(pos);
            flushQuick(true);
            return true;
        }

        if (tool === 'object-select') {
            beginCombine(e);
            S.mode = 'object';
            S.rectStart = { x: pos.x, y: pos.y };
            window.selectionInverted = false;
            window.selectionKind = 'rect';
            window.selectionColorMask = null;
            window.selectionLassoPoints = null;
            window.selectionIsWarpQuad = false;
            window.selectionPreviewAngleRad = 0;
            window.selectionBounds = { x: pos.x, y: pos.y, w: 0, h: 0 };
            if (typeof window.beginSelectionDraftChrome === 'function') {
                window.beginSelectionDraftChrome();
            }
            if (typeof window.scheduleSelectionOverlayOnly === 'function') {
                window.scheduleSelectionOverlayOnly();
            }
            return true;
        }
        return false;
    }

    function onPointerMove(e, pos) {
        if (!S.mode) return false;
        if (S.mode === 'magnetic') {
            S.movedSinceDown = true;
            if (S.poly) {
                const a = lastAnchor();
                S.segment = a ? [{ x: a.x, y: a.y }, { x: pos.x, y: pos.y }] : null;
                paintLassoDraft();
            } else {
                requestPath(pos.x, pos.y);
            }
            return true;
        }
        if (S.mode === 'quick') {
            addDab(pos);
            flushQuick(false);
            return true;
        }
        if (S.mode === 'object' && S.rectStart) {
            const x = Math.min(S.rectStart.x, pos.x);
            const y = Math.min(S.rectStart.y, pos.y);
            window.selectionBounds = {
                x: x,
                y: y,
                w: Math.abs(pos.x - S.rectStart.x),
                h: Math.abs(pos.y - S.rectStart.y)
            };
            if (typeof window.scheduleSelectionOverlayOnly === 'function') {
                window.scheduleSelectionOverlayOnly();
            }
            return true;
        }
        return false;
    }

    function onPointerUp(e, pos) {
        if (!S.mode) return false;
        if (S.mode === 'magnetic') {
            /* Lasso magnétique : tracé bouton enfoncé, refermé au relâchement —
               c'est le geste attendu. Un simple clic sans déplacement bascule en
               mode « clic à clic » pour ceux qui préfèrent poser des ancres. */
            if (S.dragTrace) {
                if (S.movedSinceDown) {
                    commitMagnetic();
                } else {
                    S.dragTrace = false;
                }
            }
            return true;
        }
        if (S.mode === 'quick') {
            flushQuick(true);
            /* Le masque arrive de façon asynchrone ; le geste, lui, est terminé. */
            S.mode = null;
            S.lastDab = null;
            if (typeof window.endSelectionDraftChrome === 'function') window.endSelectionDraftChrome();
            return true;
        }
        if (S.mode === 'object' && S.rectStart) {
            const sb = window.selectionBounds;
            const rect = sb
                ? { x: sb.x, y: sb.y, w: sb.w, h: sb.h }
                : null;
            const l = activeLayer();
            resetGesture();
            if (!rect || rect.w < 6 || rect.h < 6 || !l) {
                window.selectionBounds = null;
                if (typeof window.refreshSelectionVisual === 'function') window.refreshSelectionVisual();
                if (window.EditorManager) window.EditorManager.render();
                return true;
            }
            startSession();
            S.latestMaskJob = ++S.jobSeq;
            beginBusy('tool.object-select', 'Sélection d’objet');
            post({
                type: 'object',
                jobId: S.latestMaskJob,
                rect: { x: rect.x - l.x, y: rect.y - l.y, w: rect.w, h: rect.h }
            });
            return true;
        }
        return false;
    }

    /** Entrée / Échap pendant un lasso magnétique. */
    function onKeyDown(e) {
        if (S.mode !== 'magnetic') return false;
        if (e.key === 'Escape') {
            cancel();
            return true;
        }
        if (e.key === 'Enter' || e.code === 'NumpadEnter') {
            commitMagnetic();
            return true;
        }
        if (e.key === 'Backspace' && S.anchors && S.anchors.length > 1) {
            S.anchors.pop();
            S.segment = null;
            paintLassoDraft();
            return true;
        }
        return false;
    }

    window.IlluSmartSelect = {
        TOOLS: TOOLS,
        DEFAULTS: DEFAULTS,
        isActive: isActive,
        isGesturing: function () { return !!S.mode; },
        quality: quality,
        onPointerDown: onPointerDown,
        onPointerMove: onPointerMove,
        onPointerUp: onPointerUp,
        onKeyDown: onKeyDown,
        cancel: cancel,
        dropSession: dropSession,
        /** Rejoue la dernière demande après un changement de tolérance / qualité. */
        refreshQuick: function () {
            if (S.dabs && S.dabs.length) {
                startSession();
                flushQuick(true);
            }
        },
        _state: S
    };

    window.illuSmartSelectIsTool = function (t) {
        return TOOLS.has(t || window.activeTool);
    };

    /* Capture : Échap et Entrée sont déjà pris plus loin (désélection globale,
       validation de tracé vectoriel). Tant qu'un lasso magnétique est ouvert,
       ils lui appartiennent. */
    window.addEventListener(
        'keydown',
        function (e) {
            if (!S.mode) return;
            const tgt = e.target;
            if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) {
                return;
            }
            if (onKeyDown(e)) {
                e.preventDefault();
                e.stopPropagation();
            }
        },
        true
    );
})();
