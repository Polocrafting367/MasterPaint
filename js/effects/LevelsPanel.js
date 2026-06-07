/**
 * Réglage des niveaux (entrée / sortie, gamma, canaux RVB) — style Win98 / thème Illu.
 */
(function () {
    const PREVIEW_MAX = 880;

    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(k) : fb;
    }

    function clamp255(x) {
        return Math.max(0, Math.min(255, Math.round(x)));
    }

    function clamp01(x) {
        return Math.max(0, Math.min(1, x));
    }

    function parseGammaInput(str) {
        const s = String(str || '').trim().replace(',', '.');
        let g = parseFloat(s);
        if (!Number.isFinite(g)) g = 1;
        return Math.max(0.01, Math.min(9.99, g));
    }

    /**
     * @param {ImageData} imageData
     * @param {{
     *   inBlack?: number, inWhite?: number, gamma?: number,
     *   outBlack?: number, outWhite?: number,
     *   chR?: boolean, chG?: boolean, chB?: boolean
     * }} p
     */
    window.illuApplyLevels = function (imageData, p) {
        const d = imageData.data;
        const core = typeof window.IlluImageAdjustCore !== 'undefined' ? window.IlluImageAdjustCore : null;
        const out =
            core && typeof core.applyLevelsBuffer === 'function'
                ? core.applyLevelsBuffer(d, imageData.width, imageData.height, p)
                : (() => {
                      const next = new Uint8ClampedArray(d.length);
                      next.set(d);
                      const ib = clamp255(p.inBlack != null ? p.inBlack : 0);
                      let iw = clamp255(p.inWhite != null ? p.inWhite : 255);
                      if (iw <= ib) iw = Math.min(255, ib + 1);
                      let g = parseFloat(String(p.gamma != null ? p.gamma : 1));
                      if (!Number.isFinite(g) || g < 0.01) g = 0.01;
                      if (g > 9.99) g = 9.99;
                      const ob = clamp255(p.outBlack != null ? p.outBlack : 0);
                      let ow = clamp255(p.outWhite != null ? p.outWhite : 255);
                      if (ow < ob) ow = ob;
                      const span = Math.max(1, iw - ib);
                      const rR = p.chR !== false;
                      const rG = p.chG !== false;
                      const rB = p.chB !== false;
                      const any = rR || rG || rB;
                      const useR = any ? rR : true;
                      const useG = any ? rG : true;
                      const useB = any ? rB : true;
                      function mapOne(v) {
                          let t = (v - ib) / span;
                          t = clamp01(t);
                          t = Math.pow(t, 1 / g);
                          const y = t * 255;
                          const o = ob + (y / 255) * (ow - ob);
                          return clamp255(o);
                      }
                      for (let i = 0; i < next.length; i += 4) {
                          if (useR) next[i] = mapOne(d[i]);
                          if (useG) next[i + 1] = mapOne(d[i + 1]);
                          if (useB) next[i + 2] = mapOne(d[i + 2]);
                      }
                      return next;
                  })();
        return new ImageData(out, imageData.width, imageData.height);
    };

    function lumaByte(r, g, b) {
        return Math.round(0.299 * r + 0.587 * g + 0.114 * b) | 0;
    }

    function buildHistogram(imageData, chR, chG, chB) {
        const h = new Uint32Array(256);
        const d = imageData.data;
        const any = chR || chG || chB;
        const uR = any ? chR : true;
        const uG = any ? chG : true;
        const uB = any ? chB : true;
        for (let i = 0; i < d.length; i += 4) {
            const a = d[i + 3];
            if (a < 8) continue;
            let v;
            if (uR && uG && uB) {
                v = lumaByte(d[i], d[i + 1], d[i + 2]);
            } else {
                let s = 0;
                let n = 0;
                if (uR) {
                    s += d[i];
                    n++;
                }
                if (uG) {
                    s += d[i + 1];
                    n++;
                }
                if (uB) {
                    s += d[i + 2];
                    n++;
                }
                v = n ? Math.round(s / n) : 0;
            }
            h[v]++;
        }
        return h;
    }

    function percentileLow(hist, total, frac) {
        if (total <= 0) return 0;
        const target = Math.max(1, Math.floor(total * frac));
        let cum = 0;
        for (let i = 0; i < 256; i++) {
            cum += hist[i];
            if (cum >= target) return i;
        }
        return 255;
    }

    function percentileHigh(hist, total, frac) {
        if (total <= 0) return 255;
        const target = Math.max(1, Math.floor(total * frac));
        let cum = 0;
        for (let i = 255; i >= 0; i--) {
            cum += hist[i];
            if (cum >= target) return i;
        }
        return 0;
    }

    function downscaleForPreview(id) {
        const w = id.width;
        const h = id.height;
        const maxSide = Math.max(w, h);
        if (maxSide <= PREVIEW_MAX) {
            return { id: id, scale: 1 };
        }
        const s = PREVIEW_MAX / maxSide;
        const nw = Math.max(1, Math.round(w * s));
        const nh = Math.max(1, Math.round(h * s));
        const c = document.createElement('canvas');
        c.width = nw;
        c.height = nh;
        const x = c.getContext('2d');
        x.imageSmoothingEnabled = true;
        x.imageSmoothingQuality = 'high';
        const c0 = document.createElement('canvas');
        c0.width = w;
        c0.height = h;
        c0.getContext('2d').putImageData(id, 0, 0);
        x.drawImage(c0, 0, 0, nw, nh);
        return { id: x.getImageData(0, 0, nw, nh), scale: s };
    }

    let panelRoot = null;
    let baseFull = null;
    let previewBase = null;
    let onCommitCb = null;
    let onCancelCb = null;
    let dragState = null;
    let worker = null;
    let workerBroken = false;
    let workerJobSeq = 0;
    let latestPreviewJobId = 0;
    const workerPending = new Map();

    function workerAvailable() {
        return !workerBroken && typeof Worker !== 'undefined' && typeof window.IlluImageAdjustCore !== 'undefined';
    }

    function ensureWorker() {
        if (!workerAvailable()) return null;
        if (worker) return worker;
        try {
            console.log('LevelsPanel: Initializing worker (js/effects/image-adjust-worker.js)');
            worker = new Worker('js/effects/image-adjust-worker.js');
            worker.onmessage = (ev) => {
                const msg = ev.data || {};
                const pending = workerPending.get(msg.jobId | 0);
                if (!pending) return;
                workerPending.delete(msg.jobId | 0);
                if (msg.type === 'error') {
                    console.error('LevelsPanel: Worker job error', msg.message);
                    pending.reject(new Error(msg.message || 'image-adjust-worker failed'));
                    return;
                }
                pending.resolve(msg);
            };
            worker.onerror = (err) => {
                console.error('LevelsPanel: Worker error', err);
                workerBroken = true;
                workerPending.forEach((pending) => pending.reject(new Error('image-adjust-worker unavailable')));
                workerPending.clear();
                if (worker) {
                    try {
                        worker.terminate();
                    } catch (e) { /* ignore */ }
                }
                worker = null;
            };
            
            // Initialisation du worker avec les paramètres Wasm
            worker.postMessage({
                type: 'init',
                settings: {
                    wasmEnabled: localStorage.getItem('settings-wasm-enabled') !== '0'
                }
            });

            return worker;
        } catch (err) {
            console.error('LevelsPanel: Worker creation failed', err);
            workerBroken = true;
            return null;
        }
    }

    function requestWorker(type, imageData, params, channels) {
        const wk = ensureWorker();
        if (!wk) return Promise.reject(new Error('worker unavailable'));
        const jobId = ++workerJobSeq;
        const payload = {
            type: type,
            jobId: jobId,
            width: imageData.width,
            height: imageData.height,
            params: params || {},
            channels: channels || null,
            buffer: new Uint8ClampedArray(imageData.data).buffer
        };
        return new Promise((resolve, reject) => {
            workerPending.set(jobId, { resolve, reject });
            try {
                wk.postMessage(payload, [payload.buffer]);
            } catch (err) {
                workerPending.delete(jobId);
                reject(err);
            }
        });
    }

    function readChannels(root) {
        return {
            chR: !!root.querySelector('#illu-lvl-ch-r')?.checked,
            chG: !!root.querySelector('#illu-lvl-ch-g')?.checked,
            chB: !!root.querySelector('#illu-lvl-ch-b')?.checked
        };
    }

    function readParams(root) {
        const ch = readChannels(root);
        let ib = parseInt(String(root.querySelector('#illu-lvl-in-black')?.value || '0'), 10);
        let iw = parseInt(String(root.querySelector('#illu-lvl-in-white')?.value || '255'), 10);
        let ob = parseInt(String(root.querySelector('#illu-lvl-out-black')?.value || '0'), 10);
        let ow = parseInt(String(root.querySelector('#illu-lvl-out-white')?.value || '255'), 10);
        let g = parseGammaInput(root.querySelector('#illu-lvl-gamma')?.value);
        if (!Number.isFinite(ib)) ib = 0;
        if (!Number.isFinite(iw)) iw = 255;
        if (!Number.isFinite(ob)) ob = 0;
        if (!Number.isFinite(ow)) ow = 255;
        ib = clamp255(ib);
        iw = clamp255(iw);
        ob = clamp255(ob);
        ow = clamp255(ow);
        if (iw <= ib) iw = Math.min(255, ib + 1);
        if (ow < ob) ow = ob;
        g = Math.max(0.01, Math.min(9.99, g));
        return {
            inBlack: ib,
            inWhite: iw,
            gamma: g,
            outBlack: ob,
            outWhite: ow,
            chR: ch.chR,
            chG: ch.chG,
            chB: ch.chB
        };
    }

    function writeParamsToDom(root, p) {
        const nb = root.querySelector('#illu-lvl-in-black');
        const nw = root.querySelector('#illu-lvl-in-white');
        const ob = root.querySelector('#illu-lvl-out-black');
        const ow = root.querySelector('#illu-lvl-out-white');
        const gn = root.querySelector('#illu-lvl-gamma');
        const gr = root.querySelector('#illu-lvl-gamma-range');
        if (nb) nb.value = String(p.inBlack);
        if (nw) nw.value = String(p.inWhite);
        if (ob) ob.value = String(p.outBlack);
        if (ow) ow.value = String(p.outWhite);
        if (gn) gn.value = p.gamma.toFixed(2).replace('.', ',');
        if (gr) gr.value = String(Math.round(p.gamma * 100));
        syncHandles(root);
    }

    function syncHandles(root) {
        const p = readParams(root);
        const lo = root.querySelector('.illu-lvl-handle--in-lo');
        const hi = root.querySelector('.illu-lvl-handle--in-hi');
        const olo = root.querySelector('.illu-lvl-handle--out-lo');
        const ohi = root.querySelector('.illu-lvl-handle--out-hi');
        const pct = (v) => `${(v / 255) * 100}%`;
        if (lo) lo.style.bottom = pct(p.inBlack);
        if (hi) hi.style.bottom = pct(p.inWhite);
        if (olo) olo.style.bottom = pct(p.outBlack);
        if (ohi) ohi.style.bottom = pct(p.outWhite);
    }

    function drawHistogramOnCanvas(canvas, hist, opts) {
        const o = opts || {};
        const markLo = o.markLo;
        const markHi = o.markHi;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        const dark = document.body.classList.contains('theme-dark');
        ctx.fillStyle = dark ? '#3a3d44' : '#c4c4c4';
        ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = dark ? '#606060' : '#606060';
        ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
        let mx = 1;
        for (let i = 0; i < 256; i++) {
            if (hist[i] > mx) mx = hist[i];
        }
        ctx.fillStyle = dark ? '#c8ccd4' : '#2a2a2a';
        const barW = w / 256;
        for (let i = 0; i < 256; i++) {
            const bh = mx > 0 ? Math.max(0, (hist[i] / mx) * (h - 4)) : 0;
            ctx.fillRect(i * barW, h - 2 - bh, Math.max(1, barW - 0.5), bh);
        }
        if (markLo != null && markLo >= 0 && markLo <= 255) {
            const x = (markLo / 255) * w;
            ctx.strokeStyle = '#c41e1e';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
        if (markHi != null && markHi >= 0 && markHi <= 255) {
            const x = (markHi / 255) * w;
            ctx.strokeStyle = '#c41e1e';
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, h);
            ctx.stroke();
        }
    }

    function scheduleRedraw(root) {
        if (!root || !previewBase) return;
        requestAnimationFrame(() => {
            try {
                const previewJobId = ++latestPreviewJobId;
                redrawHistogramsAndPreview(root, previewJobId);
            } catch (e) {
                console.warn('Levels preview', e);
            }
        });
    }

    function redrawHistogramsAndPreview(root, previewJobId) {
        const p = readParams(root);
        const ch = readChannels(root);
        const applyResult = (after, histIn, histOut) => {
            if (previewJobId !== latestPreviewJobId || root !== panelRoot) return;
            const cIn = root.querySelector('#illu-lvl-hist-in');
            if (cIn) {
                drawHistogramOnCanvas(cIn, histIn, { markLo: p.inBlack, markHi: p.inWhite });
            }
            const cOut = root.querySelector('#illu-lvl-hist-out');
            if (cOut) {
                drawHistogramOnCanvas(cOut, histOut, { markLo: p.outBlack, markHi: p.outWhite });
            }
            const pv = root.querySelector('#illu-lvl-preview');
            if (pv) {
                const c2d = pv.getContext('2d');
                if (c2d) {
                    if (pv.width !== after.width || pv.height !== after.height) {
                        pv.width = after.width;
                        pv.height = after.height;
                    }
                    c2d.putImageData(after, 0, 0);
                }
            }
        };
        if (workerAvailable()) {
            requestWorker('levelsPreview', previewBase, p, ch)
                .then((msg) => {
                    const after = new ImageData(new Uint8ClampedArray(msg.imageBuffer), msg.width, msg.height);
                    const histIn = new Uint32Array(msg.histInBuffer);
                    const histOut = new Uint32Array(msg.histOutBuffer);
                    applyResult(after, histIn, histOut);
                })
                .catch(() => {
                    const histIn = buildHistogram(previewBase, ch.chR, ch.chG, ch.chB);
                    const tmp = new ImageData(new Uint8ClampedArray(previewBase.data), previewBase.width, previewBase.height);
                    const after = window.illuApplyLevels(tmp, p);
                    const histOut = buildHistogram(after, ch.chR, ch.chG, ch.chB);
                    applyResult(after, histIn, histOut);
                });
            return;
        }
        const histIn = buildHistogram(previewBase, ch.chR, ch.chG, ch.chB);
        const tmp = new ImageData(new Uint8ClampedArray(previewBase.data), previewBase.width, previewBase.height);
        const after = window.illuApplyLevels(tmp, p);
        const histOut = buildHistogram(after, ch.chR, ch.chG, ch.chB);
        applyResult(after, histIn, histOut);
    }

    function closePanel(runCancel) {
        latestPreviewJobId = 0;
        if (panelRoot) {
            panelRoot.remove();
            panelRoot = null;
        }
        baseFull = null;
        previewBase = null;
        dragState = null;
        document.body.classList.remove('illu-levels-open');
        if (runCancel && typeof onCancelCb === 'function') {
            onCancelCb();
        }
        onCancelCb = null;
        onCommitCb = null;
    }

    async function commitPanel() {
        if (!baseFull || typeof onCommitCb !== 'function' || !panelRoot) {
            closePanel(false);
            return;
        }
        const p = readParams(panelRoot);
        let out;
        const busy =
            window.IlluProgress && typeof window.IlluProgress.createDelayedInstantEffect === 'function'
                ? window.IlluProgress.createDelayedInstantEffect(tKey('dlg.levelsTitle', 'Niveaux'), 180)
                : null;
        try {
            if (workerAvailable()) {
                try {
                    if (busy) busy.progress(18);
                    const msg = await requestWorker('levelsCommit', baseFull, p, null);
                    if (!panelRoot) return;
                    out = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
                    if (busy) busy.progress(100);
                } catch (err) {
                    out = window.illuApplyLevels(baseFull, p);
                }
            } else {
                out = window.illuApplyLevels(baseFull, p);
            }
        } finally {
            if (busy) busy.done();
        }
        const fn = onCommitCb;
        onCommitCb = null;
        onCancelCb = null;
        fn(out);
        closePanel(false);
    }

    function autoLevels(root) {
        if (!previewBase) return;
        const ch = readChannels(root);
        const hist = buildHistogram(previewBase, ch.chR, ch.chG, ch.chB);
        let total = 0;
        for (let i = 0; i < 256; i++) total += hist[i];
        if (total < 1) return;
        const lo = percentileLow(hist, total, 0.005);
        const hi = percentileHigh(hist, total, 0.005);
        const cur = readParams(root);
        writeParamsToDom(root, {
            inBlack: lo,
            inWhite: Math.max(lo + 1, hi),
            gamma: 1,
            outBlack: cur.outBlack,
            outWhite: cur.outWhite
        });
        scheduleRedraw(root);
    }

    function resetLevels(root) {
        writeParamsToDom(root, {
            inBlack: 0,
            inWhite: 255,
            gamma: 1,
            outBlack: 0,
            outWhite: 255,
            chR: true,
            chG: true,
            chB: true
        });
        root.querySelector('#illu-lvl-ch-r').checked = true;
        root.querySelector('#illu-lvl-ch-g').checked = true;
        root.querySelector('#illu-lvl-ch-b').checked = true;
        scheduleRedraw(root);
    }

    function bindRampDrag(root, wrapSel, kind) {
        const wrap = root.querySelector(wrapSel);
        if (!wrap) return;
        wrap.querySelectorAll('.illu-lvl-handle').forEach((h) => {
            h.addEventListener('pointerdown', (ev) => {
                ev.preventDefault();
                const which = h.getAttribute('data-illu-lvl-handle');
                try {
                    h.setPointerCapture(ev.pointerId);
                } catch (e) {
                    /* ignore */
                }
                dragState = { which, kind, root };
            });
        });
    }

    document.addEventListener('pointermove', (ev) => {
        if (!dragState) return;
        const { which, kind, root } = dragState;
        const ramp = root.querySelector(
            kind === 'in' ? '.illu-lvl-ramp-wrap--in .illu-lvl-ramp' : '.illu-lvl-ramp-wrap--out .illu-lvl-ramp'
        );
        if (!ramp) return;
        const r = ramp.getBoundingClientRect();
        const t = clamp01((r.bottom - ev.clientY) / Math.max(1, r.height));
        const v = Math.round(t * 255);
        const p = readParams(root);
        if (kind === 'in') {
            if (which === 'lo') {
                p.inBlack = Math.min(v, p.inWhite - 1);
            } else if (which === 'hi') {
                p.inWhite = Math.max(v, p.inBlack + 1);
            }
        } else {
            if (which === 'lo') {
                p.outBlack = Math.min(v, p.outWhite);
            } else if (which === 'hi') {
                p.outWhite = Math.max(v, p.outBlack);
            }
        }
        writeParamsToDom(root, p);
        scheduleRedraw(root);
    });

    document.addEventListener('pointerup', () => {
        dragState = null;
    });
    document.addEventListener('pointercancel', () => {
        dragState = null;
    });

    function buildPanel() {
        const root = document.createElement('div');
        root.id = 'illu-levels-root';
        root.className = 'illu-levels-overlay';
        root.innerHTML = `
            <div class="illu-lvl-backdrop" aria-hidden="true"></div>
            <div class="window floating-window illu-lvl-window" role="dialog" aria-modal="true" aria-labelledby="illu-lvl-title">
                <div class="title-bar">
                    <div class="title-bar-text" id="illu-lvl-title">${tKey('dlg.levelsTitle', 'Réglage des niveaux')}</div>
                    <div class="title-bar-controls">
                        <button type="button" class="title-bar-close-btn" id="illu-lvl-x" aria-label="${tKey('dlg.cameraRawClose', 'Fermer')}" data-i18n-aria-label="dlg.cameraRawClose"></button>
                    </div>
                </div>
                <div class="window-body illu-lvl-body">
                    <div class="illu-lvl-main">
                        <div class="illu-lvl-hist-block">
                            <span class="illu-lvl-col-title" data-i18n="dlg.levelsHistIn">Histogramme d’entrée</span>
                            <canvas id="illu-lvl-hist-in" class="illu-lvl-hist" width="256" height="120"></canvas>
                        </div>
                        <div class="illu-lvl-col illu-lvl-col--entr">
                            <span class="illu-lvl-col-title" data-i18n="dlg.levelsInput">Entrée</span>
                            <input type="number" class="illu-lvl-num" id="illu-lvl-in-white" min="0" max="255" value="255" title="">
                            <div class="illu-lvl-ramp-wrap illu-lvl-ramp-wrap--in">
                                <div class="illu-lvl-ramp"></div>
                                <button type="button" class="illu-lvl-handle illu-lvl-handle--in-hi" data-illu-lvl-handle="hi" aria-label=""></button>
                                <button type="button" class="illu-lvl-handle illu-lvl-handle--in-lo" data-illu-lvl-handle="lo" aria-label=""></button>
                            </div>
                            <input type="number" class="illu-lvl-num" id="illu-lvl-in-black" min="0" max="255" value="0">
                            <div class="illu-lvl-gamma-block">
                                <label class="illu-lvl-gamma-lab" for="illu-lvl-gamma-range" data-i18n="dlg.levelsGamma">Gamma (milieu)</label>
                                <div class="illu-lvl-gamma-row">
                                    <input type="range" id="illu-lvl-gamma-range" min="10" max="999" value="100" step="1">
                                    <input type="text" class="illu-lvl-num illu-lvl-num--gamma" id="illu-lvl-gamma" inputmode="decimal" value="1,00">
                                </div>
                            </div>
                        </div>
                        <div class="illu-lvl-col illu-lvl-col--sortie">
                            <span class="illu-lvl-col-title" data-i18n="dlg.levelsOutput">Sortie</span>
                            <input type="number" class="illu-lvl-num" id="illu-lvl-out-white" min="0" max="255" value="255">
                            <div class="illu-lvl-ramp-wrap illu-lvl-ramp-wrap--out">
                                <div class="illu-lvl-ramp"></div>
                                <button type="button" class="illu-lvl-handle illu-lvl-handle--out-hi" data-illu-lvl-handle="hi" aria-label=""></button>
                                <button type="button" class="illu-lvl-handle illu-lvl-handle--out-lo" data-illu-lvl-handle="lo" aria-label=""></button>
                            </div>
                            <input type="number" class="illu-lvl-num" id="illu-lvl-out-black" min="0" max="255" value="0">
                        </div>
                        <div class="illu-lvl-hist-block">
                            <span class="illu-lvl-col-title" data-i18n="dlg.levelsHistOut">Histogramme de sortie</span>
                            <canvas id="illu-lvl-hist-out" class="illu-lvl-hist" width="256" height="120"></canvas>
                        </div>
                    </div>
                    <div class="illu-lvl-preview-wrap">
                        <canvas id="illu-lvl-preview" class="illu-lvl-preview" width="1" height="1"></canvas>
                    </div>
                    <div class="illu-lvl-foot">
                        <div class="illu-lvl-foot-left">
                            <button type="button" id="illu-lvl-auto" data-i18n="dlg.levelsAuto">Automatique</button>
                            <button type="button" id="illu-lvl-reset" data-i18n="dlg.levelsReset">Réinitialiser</button>
                        </div>
                        <div class="illu-lvl-channels field-row" role="group">
                            <label class="illu-lvl-ch"><input type="checkbox" id="illu-lvl-ch-r" checked> <span data-i18n="dlg.levelsChR">R</span></label>
                            <label class="illu-lvl-ch"><input type="checkbox" id="illu-lvl-ch-g" checked> <span data-i18n="dlg.levelsChV">V</span></label>
                            <label class="illu-lvl-ch"><input type="checkbox" id="illu-lvl-ch-b" checked> <span data-i18n="dlg.levelsChB">B</span></label>
                        </div>
                        <div class="illu-lvl-foot-right">
                            <button type="button" id="illu-lvl-ok" class="illu-lvl-btn-ok" data-i18n="dlg.cameraRawOk">OK</button>
                            <button type="button" id="illu-lvl-cancel" data-i18n="dlg.cancel">Annuler</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        return root;
    }

    function wirePanel() {
        const root = panelRoot;
        function onNum() {
            let p = readParams(root);
            if (p.inWhite <= p.inBlack) p.inWhite = Math.min(255, p.inBlack + 1);
            if (p.outWhite < p.outBlack) p.outWhite = p.outBlack;
            writeParamsToDom(root, p);
            scheduleRedraw(root);
        }
        ['#illu-lvl-in-black', '#illu-lvl-in-white', '#illu-lvl-out-black', '#illu-lvl-out-white'].forEach((sel) => {
            const el = root.querySelector(sel);
            if (el) {
                el.addEventListener('change', onNum);
                el.addEventListener('input', onNum);
            }
        });
        const gr = root.querySelector('#illu-lvl-gamma-range');
        const gn = root.querySelector('#illu-lvl-gamma');
        if (gr && gn) {
            gr.addEventListener('input', () => {
                const g = Math.max(0.01, Math.min(9.99, parseInt(gr.value, 10) / 100));
                gn.value = g.toFixed(2).replace('.', ',');
                scheduleRedraw(root);
            });
            gn.addEventListener('change', () => {
                const g = parseGammaInput(gn.value);
                gn.value = g.toFixed(2).replace('.', ',');
                gr.value = String(Math.round(g * 100));
                scheduleRedraw(root);
            });
            gn.addEventListener('input', () => {
                const g = parseGammaInput(gn.value);
                gr.value = String(Math.round(g * 100));
                scheduleRedraw(root);
            });
        }
        ['#illu-lvl-ch-r', '#illu-lvl-ch-g', '#illu-lvl-ch-b'].forEach((sel) => {
            root.querySelector(sel)?.addEventListener('change', () => {
                const ch = readChannels(root);
                if (!ch.chR && !ch.chG && !ch.chB) {
                    root.querySelector('#illu-lvl-ch-r').checked = true;
                    root.querySelector('#illu-lvl-ch-g').checked = true;
                    root.querySelector('#illu-lvl-ch-b').checked = true;
                }
                scheduleRedraw(root);
            });
        });
        root.querySelector('#illu-lvl-auto')?.addEventListener('click', () => autoLevels(root));
        root.querySelector('#illu-lvl-reset')?.addEventListener('click', () => resetLevels(root));
        root.querySelector('#illu-lvl-ok')?.addEventListener('click', commitPanel);
        root.querySelector('#illu-lvl-cancel')?.addEventListener('click', () => closePanel(true));
        root.querySelector('#illu-lvl-x')?.addEventListener('click', () => closePanel(true));
        root.querySelector('.illu-lvl-backdrop')?.addEventListener('click', () => closePanel(true));
        bindRampDrag(root, '.illu-lvl-ramp-wrap--in', 'in');
        bindRampDrag(root, '.illu-lvl-ramp-wrap--out', 'out');
        syncHandles(root);
    }

    window.openLevelsPanel = function (fullImageData, opts) {
        if (!fullImageData || !fullImageData.data) return;
        closePanel(false);
        onCommitCb = opts && opts.onCommit;
        onCancelCb = opts && opts.onCancel;
        baseFull = fullImageData;
        const { id: prev } = downscaleForPreview(fullImageData);
        previewBase = prev;

        panelRoot = buildPanel();
        document.body.appendChild(panelRoot);
        document.body.classList.add('illu-levels-open');
        const winEl = panelRoot.querySelector('.illu-lvl-window');
        if (winEl && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(winEl);
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(panelRoot);
        }
        if (window.IlluTheme && typeof window.IlluTheme.refreshIfActive === 'function') {
            window.IlluTheme.refreshIfActive();
        }
        wirePanel();
        scheduleRedraw(panelRoot);
    };

    window.openLevelsForActiveLayer = function () {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode || !em.activeLayer || !em.activeLayer.buffer) {
            window.showIlluAlert(tKey('msg.levelsPixel', 'Disponible en mode Pixel avec un calque bitmap.'));
            return;
        }
        if (em.activeProject && em.activeProject.role === 'layerAlphaMask') {
            window.showIlluAlert(tKey('msg.levelsMask', 'Ouvrez le document principal.'));
            return;
        }
        const c = em.activeLayer.buffer;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const id = ctx.getImageData(0, 0, c.width, c.height);
        window.openLevelsPanel(id, {
            onCommit: (out) => {
                ctx.putImageData(out, 0, 0);
                const hist = tKey('history.levels', 'Réglage des niveaux');
                em.saveHistory(hist, { patchActiveLayer: true });
                em.render({ flushUiThumbnails: true });
            }
        });
    };
})();
