/**
 * Worker des sélections assistées (sélection rapide, sélection d'objet, lasso magnétique).
 *
 * Une « session » = une image de travail (le tampon du calque actif), réduite
 * une seule fois selon la qualité choisie, avec sa carte de contours. Les
 * requêtes suivantes réutilisent ce cache : c'est ce qui permet au lasso
 * magnétique de répondre à chaque mouvement de souris.
 *
 * Le thread principal envoie et reçoit des coordonnées PLEINE résolution
 * (repère du tampon du calque) ; la conversion vers l'échelle de travail est
 * faite ici, pour que l'appelant n'ait pas à connaître le facteur.
 */
self.importScripts('select-core.js');

const Core = self.IlluSelectCore;

let session = null;

function buildSession(msg) {
    const prof = Core.qualityProfile(msg.quality);
    const w = msg.width | 0;
    const h = msg.height | 0;
    const src = new Uint8ClampedArray(msg.buffer);
    const factor = Core.scaleFactorFor(w, h, prof.maxDim);
    const ds = Core.downscaleRGBA(src, w, h, factor);
    return {
        id: msg.sessionId,
        quality: msg.quality,
        fullW: w,
        fullH: h,
        factor: factor,
        w: ds.w,
        h: ds.h,
        data: ds.data,
        edge: Core.buildEdgeMap(ds.data, ds.w, ds.h, 1)
    };
}

/** Coordonnée pleine résolution → coordonnée de l'image de travail. */
function toLocal(s, v) {
    return v / s.factor;
}

/** Trace les coups de pinceau (coords pleine résolution) dans un masque de graines. */
function rasterizeDabs(s, dabs) {
    const seeds = new Uint8Array(s.w * s.h);
    for (let i = 0; i < dabs.length; i++) {
        const d = dabs[i];
        const cx = toLocal(s, d.x);
        const cy = toLocal(s, d.y);
        const r = Math.max(0.6, toLocal(s, d.r));
        const x0 = Math.max(0, Math.floor(cx - r));
        const x1 = Math.min(s.w - 1, Math.ceil(cx + r));
        const y0 = Math.max(0, Math.floor(cy - r));
        const y1 = Math.min(s.h - 1, Math.ceil(cy + r));
        const r2 = r * r;
        for (let y = y0; y <= y1; y++) {
            const dy = y + 0.5 - cy;
            for (let x = x0; x <= x1; x++) {
                const dx = x + 0.5 - cx;
                if (dx * dx + dy * dy <= r2) seeds[y * s.w + x] = 1;
            }
        }
    }
    return seeds;
}

function postMask(msg, mask) {
    const buf = mask.buffer;
    self.postMessage(
        {
            type: 'maskResult',
            sessionId: session.id,
            jobId: msg.jobId,
            kind: msg.type,
            mask: mask,
            w: session.w,
            h: session.h,
            factor: session.factor,
            fullW: session.fullW,
            fullH: session.fullH
        },
        [buf]
    );
}

self.onmessage = function (ev) {
    const msg = ev.data || {};
    try {
        if (msg.type === 'session') {
            session = buildSession(msg);
            self.postMessage({
                type: 'sessionReady',
                sessionId: session.id,
                w: session.w,
                h: session.h,
                factor: session.factor
            });
            return;
        }
        if (msg.type === 'drop') {
            if (!session || session.id === msg.sessionId) session = null;
            return;
        }
        if (!session || msg.sessionId !== session.id) return;

        if (msg.type === 'livewire') {
            const path = Core.livewire({
                w: session.w,
                h: session.h,
                edge: session.edge,
                from: { x: toLocal(session, msg.from.x), y: toLocal(session, msg.from.y) },
                to: { x: toLocal(session, msg.to.x), y: toLocal(session, msg.to.y) },
                margin: msg.margin != null ? msg.margin : 24,
                pull: msg.pull
            });
            /* Retour en coordonnées pleine résolution, centre de pixel. */
            const f = session.factor;
            const out = new Float32Array(path.length * 2);
            for (let i = 0; i < path.length; i++) {
                out[i * 2] = (path[i].x + 0.5) * f;
                out[i * 2 + 1] = (path[i].y + 0.5) * f;
            }
            self.postMessage(
                { type: 'livewireResult', sessionId: session.id, jobId: msg.jobId, path: out },
                [out.buffer]
            );
            return;
        }

        if (msg.type === 'quick') {
            const seeds = rasterizeDabs(session, msg.dabs || []);
            const mask = Core.quickSelect({
                data: session.data,
                w: session.w,
                h: session.h,
                seeds: seeds,
                edge: session.edge,
                tolerance: msg.tolerance
            });
            postMask(msg, mask);
            return;
        }

        if (msg.type === 'object') {
            const f = session.factor;
            const mask = Core.objectSelect({
                data: session.data,
                w: session.w,
                h: session.h,
                quality: session.quality,
                rect: {
                    x: msg.rect.x / f,
                    y: msg.rect.y / f,
                    w: msg.rect.w / f,
                    h: msg.rect.h / f
                }
            });
            postMask(msg, mask);
            return;
        }
    } catch (err) {
        self.postMessage({
            type: 'error',
            sessionId: msg.sessionId,
            jobId: msg.jobId,
            message: err && err.message ? err.message : String(err)
        });
    }
};
