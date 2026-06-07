/**
 * Panneau type Camera Raw + import RAW (WASM local via LibRaw).
 */
(function () {
    const RAW_EXT = new Set([
        '3fr', 'arw', 'bay', 'cap', 'cr2', 'cr3', 'dcr', 'dcs', 'dng', 'drf', 'eip',
        'erf', 'fff', 'iiq', 'j6i', 'k25', 'kdc', 'mdc', 'mef', 'mos', 'mrw', 'nef',
        'nrw', 'obm', 'orf', 'pef', 'pxn', 'r3d', 'raf', 'raw', 'rw2', 'rwz', 'rwl',
        'sr2', 'srf', 'srw', 'x3f'
    ]);

    window.illuIsRawFileName = function (name) {
        if (!name || typeof name !== 'string') return false;
        const i = name.lastIndexOf('.');
        if (i < 0) return false;
        return RAW_EXT.has(name.slice(i + 1).toLowerCase());
    };

    const PREVIEW_MAX = 320;

    let METADATA = { DEFAULT_PARAMS: {}, RANGES: {}, PRESETS: {} };
    let CR_RANGE = METADATA.RANGES;
    let DEFAULT_PARAMS = METADATA.DEFAULT_PARAMS;
    let PRESETS = METADATA.PRESETS;
    let showEffects = true;
    let highResTimeout = null;

    function refreshMetadata() {
        if (window.IlluImageAdjustCore) {
            METADATA = window.IlluImageAdjustCore.METADATA;
            CR_RANGE = METADATA.RANGES;
            DEFAULT_PARAMS = METADATA.DEFAULT_PARAMS;
            PRESETS = METADATA.PRESETS;
        }
    }

    function clamp255(x) {
        return Math.max(0, Math.min(255, x | 0));
    }

    function clamp01(x) {
        return Math.max(0, Math.min(1, x));
    }

    function srgbToLin(c) {
        c /= 255;
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }

    function linToSrgbByte(x) {
        x = clamp01(x);
        const y = x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
        return clamp255(y * 255);
    }

    function rgbToHsv255(r, g, b) {
        r /= 255;
        g /= 255;
        b /= 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const d = max - min;
        let h = 0;
        const s = max === 0 ? 0 : (d / max) * 100;
        const v = max * 100;
        if (d !== 0) {
            if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
            else if (max === g) h = ((b - r) / d + 2) * 60;
            else h = ((r - g) / d + 4) * 60;
        }
        return { h, s, v };
    }

    function hsvToRgb255(h, s, v) {
        s = Math.max(0, Math.min(100, s)) / 100;
        v = Math.max(0, Math.min(100, v)) / 100;
        const c = v * s;
        const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
        const m = v - c;
        h = ((h % 360) + 360) % 360;
        let rp = 0,
            gp = 0,
            bp = 0;
        if (h < 60) {
            rp = c;
            gp = x;
        } else if (h < 120) {
            rp = x;
            gp = c;
        } else if (h < 180) {
            gp = c;
            bp = x;
        } else if (h < 240) {
            gp = x;
            bp = c;
        } else if (h < 300) {
            rp = x;
            bp = c;
        } else {
            rp = c;
            bp = x;
        }
        return {
            r: clamp255((rp + m) * 255),
            g: clamp255((gp + m) * 255),
            b: clamp255((bp + m) * 255)
        };
    }

    /** Pipeline tonal + couleur (sans texture / clarté). */
    function applyToneColor(src, w, h, p) {
        const out = new Uint8ClampedArray(src.length);
        const expStops = (p.exposure / 100) * 2;
        const mult = Math.pow(2, expStops);
        const contrastF = (100 + p.contrast) / 100;

        for (let i = 0; i < src.length; i += 4) {
            let r = srgbToLin(src[i]);
            let g = srgbToLin(src[i + 1]);
            let b = srgbToLin(src[i + 2]);
            const a = src[i + 3];

            r *= mult;
            g *= mult;
            b *= mult;

            const Y_orig = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            const Y_clamp = Math.max(0.0, Math.min(1.0, Y_orig));
            const wZone = Y_clamp * (1.0 - Y_clamp) * 4.0;

            if (p.temp !== 0) {
                const t = (p.temp / 100) * wZone;
                r *= Math.max(0.0, 1 + t * 0.12);
                b *= Math.max(0.0, 1 - t * 0.12);
                g *= Math.max(0.0, 1 + t * 0.02);
            }
            if (p.tint !== 0) {
                const tn = (p.tint / 100) * wZone;
                r *= Math.max(0.0, 1 + tn * 0.06);
                b *= Math.max(0.0, 1 + tn * 0.06);
                g *= Math.max(0.0, 1 - tn * 0.08);
            }

            let r8 = linToSrgbByte(r);
            let g8 = linToSrgbByte(g);
            let b8 = linToSrgbByte(b);

            let lr = r8 / 255;
            let lg = g8 / 255;
            let lb = b8 / 255;
            let Y = 0.299 * lr + 0.587 * lg + 0.114 * lb;

            if (p.highlights !== 0) {
                const hi = p.highlights / 100;
                const t = Math.max(0, Y - 0.55) / 0.45;
                const f = 1 - hi * 0.55 * t * t;
                lr *= f;
                lg *= f;
                lb *= f;
            }
            if (p.shadows !== 0) {
                const sh = p.shadows / 100;
                const t = Math.max(0, 0.45 - Y) / 0.45;
                const lift = sh * 0.12 * t;
                lr = clamp01(lr + lift);
                lg = clamp01(lg + lift);
                lb = clamp01(lb + lift);
            }

            const wAdj = p.whites / 100;
            const bAdj = p.blacks / 100;
            if (wAdj !== 0 || bAdj !== 0) {
                const whiteP = clamp01(1 + wAdj * 0.08);
                const blackP = clamp01(bAdj * 0.08);
                const den = whiteP - blackP || 1e-6;
                lr = clamp01((lr - blackP) / den);
                lg = clamp01((lg - blackP) / den);
                lb = clamp01((lb - blackP) / den);
            }

            lr = clamp01(0.5 + (lr - 0.5) * contrastF);
            lg = clamp01(0.5 + (lg - 0.5) * contrastF);
            lb = clamp01(0.5 + (lb - 0.5) * contrastF);

            r8 = clamp255(lr * 255);
            g8 = clamp255(lg * 255);
            b8 = clamp255(lb * 255);

            if (p.saturation !== 0 || p.vibrance !== 0) {
                const hsv = rgbToHsv255(r8, g8, b8);
                let s = hsv.s;
                const satM = 1 + p.saturation / 100;
                s = clamp01((s / 100) * satM) * 100;
                if (p.vibrance !== 0) {
                    const vib = p.vibrance / 100;
                    const lowSatBoost = (1 - hsv.s / 100) * vib * 40;
                    s = Math.max(0, Math.min(100, s + lowSatBoost));
                }
                const rgb = hsvToRgb255(hsv.h, s, hsv.v);
                r8 = rgb.r;
                g8 = rgb.g;
                b8 = rgb.b;
            }

            out[i] = r8;
            out[i + 1] = g8;
            out[i + 2] = b8;
            out[i + 3] = a;
        }
        return out;
    }
    window.illuApplyCameraRawParams = function (imageData, params) {
        const w = imageData.width;
        const h = imageData.height;
        const p = Object.assign({}, DEFAULT_PARAMS, params);

        let skipWebGL = false;
        const curveChanged = (c) => c && (c.length > 2 || (c.length === 2 && (c[0].x !== 0 || c[0].y !== 0 || c[1].x !== 255 || c[1].y !== 255)));
        if (p.clarity !== 0 || p.dehaze !== 0 || p.vignette !== 0 || p.grain !== 0 || p.sharpen !== 0) skipWebGL = true;
        if (curveChanged(p.curveMaster)) skipWebGL = true;
        if (curveChanged(p.curveR)) skipWebGL = true;
        if (curveChanged(p.curveG)) skipWebGL = true;
        if (curveChanged(p.curveB)) skipWebGL = true;
        if (p.hslHue && p.hslHue.some(x => x !== 0)) skipWebGL = true;
        if (p.hslSat && p.hslSat.some(x => x !== 0)) skipWebGL = true;
        if (p.hslLum && p.hslLum.some(x => x !== 0)) skipWebGL = true;

        // --- Priorité : WebGL (aperçu) puis CPU/Wasm dans applyCameraRawBuffer ---
        const useWebGL = localStorage.getItem('illu_webgl_filters') !== 'false' && !skipWebGL;

        if (useWebGL && window.WebGLFilterEngine && window.WebGLFilterEngine.init()) {
            try {
                if (w <= window.WebGLFilterEngine.maxTextureSize && h <= window.WebGLFilterEngine.maxTextureSize) {
                    if (params.isLivePreview) {
                        return window.WebGLFilterEngine.renderToInternalCanvas(imageData, 'camera_raw', p);
                    }
                    const gpuRes = window.WebGLFilterEngine.applyFilter(imageData, 'camera_raw', p);
                    if (gpuRes) return gpuRes;
                }
            } catch (err) {
                console.error('[CameraRaw] WebGL failed, falling back to CPU:', err);
            }
        }
        // CPU fallback — handles both Uint8ClampedArray and Float32Array
        let srcBuf = (p.isRawMode && imageData.rawFloatData) ? imageData.rawFloatData : imageData.data;
        const core = typeof window.IlluImageAdjustCore !== 'undefined' ? window.IlluImageAdjustCore : null;
        let d =
            core && typeof core.applyCameraRawBuffer === 'function'
                ? core.applyCameraRawBuffer(srcBuf, w, h, p)
                : applyToneColor(srcBuf, w, h, p);
        if (core && typeof core.applyPostCameraRaw === 'function') {
            d = core.applyPostCameraRaw(d, w, h, p);
        }
        return new ImageData(d, w, h);
    };

    function downscaleForPreview(id) {
        const w = id.width;
        const h = id.height;
        const m = Math.max(w, h);
        if (m <= PREVIEW_MAX) {
            return { id: new ImageData(new Uint8ClampedArray(id.data), w, h), scale: 1 };
        }
        const s = PREVIEW_MAX / m;
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

    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function' ? window.IlluI18n.t(k) : fb;
    }

    let panelRoot = null;
    let baseFull = null;
    let previewBase = null;
    let previewScale = 1;
    let currentParams = null;
    let rafPending = null;
    let onCommitCb = null;
    let onCancelCb = null;
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
            console.log('CameraRawPanel: Initializing worker (js/effects/image-adjust-worker.js)');
            worker = new Worker('js/effects/image-adjust-worker.js');
            
            // Initialisation du worker avec les paramètres Wasm
            worker.postMessage({
                type: 'init',
                settings: {
                    wasmEnabled: localStorage.getItem('settings-wasm-enabled') !== '0'
                }
            });

            worker.onmessage = (ev) => {
                const msg = ev.data || {};
                const pending = workerPending.get(msg.jobId | 0);
                if (!pending) return;
                workerPending.delete(msg.jobId | 0);
                if (msg.type === 'error') {
                    console.error('CameraRawPanel: Worker job error', msg.message);
                    pending.reject(new Error(msg.message || 'image-adjust-worker failed'));
                    return;
                }
                pending.resolve(msg);
            };
            worker.onerror = (err) => {
                console.error('CameraRawPanel: Worker error', err);
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
            return worker;
        } catch (err) {
            console.error('CameraRawPanel: Worker creation failed', err);
            workerBroken = true;
            return null;
        }
    }

    function requestWorker(type, imageData, params) {
        const wk = ensureWorker();
        if (!wk) return Promise.reject(new Error('worker unavailable'));
        const jobId = ++workerJobSeq;
        const payload = {
            type: type,
            jobId: jobId,
            width: imageData.width,
            height: imageData.height,
            params: params || {},
            buffer: new Uint8ClampedArray(imageData.data).buffer,
            floatBuffer: (params && params.isRawMode && imageData.rawFloatData) ? new Float32Array(imageData.rawFloatData).buffer : null
        };
        return new Promise((resolve, reject) => {
            workerPending.set(jobId, { resolve, reject });
            try {
                const transferables = [payload.buffer];
                if (payload.floatBuffer) transferables.push(payload.floatBuffer);
                wk.postMessage(payload, transferables);
            } catch (err) {
                workerPending.delete(jobId);
                reject(err);
            }
        });
    }

    function readParamsFromDom(root) {
        const params = {};
        Object.keys(DEFAULT_PARAMS).forEach(key => {
            const defVal = DEFAULT_PARAMS[key];
            if (Array.isArray(defVal)) {
                // Preserve current array values if they exist, otherwise use defaults
                params[key] = (currentParams && Array.isArray(currentParams[key])) ? [...currentParams[key]] : [...defVal];
                return;
            }
            const el = root.querySelector('#illu-cr-' + key);
            if (!el) {
                params[key] = defVal;
                return;
            }
            const v = parseInt(String(el.value).trim(), 10);
            params[key] = Number.isFinite(v) ? v : defVal;
        });

        // Preserve complex array params from the live currentParams object
        // (curves, hsl) — they are managed by CurveEditor/HSLManager directly
        if (currentParams) {
            Object.keys(DEFAULT_PARAMS).forEach(key => {
                if (Array.isArray(DEFAULT_PARAMS[key]) && currentParams[key] !== undefined) {
                    params[key] = currentParams[key];
                }
            });
        }

        return params;
    }

    function schedulePreview() {
        if (!panelRoot || !previewBase) return;
        if (rafPending != null) cancelAnimationFrame(rafPending);
        if (highResTimeout != null) {
            clearTimeout(highResTimeout);
            highResTimeout = null;
        }

        rafPending = requestAnimationFrame(() => {
            rafPending = null;
            try {
                const root = panelRoot;
                if (!root || !previewBase) return;
                const previewJobId = ++latestPreviewJobId;
                
                const applyPreview = (prev) => {
                    if (previewJobId !== latestPreviewJobId || root !== panelRoot) return;
                    const pv = root.querySelector('#illu-cr-preview');
                    if (pv) {
                        const c2d = pv.getContext('2d');
                        if (!c2d) return;
                        if (pv.width !== prev.width || pv.height !== prev.height) {
                            pv.width = prev.width;
                            pv.height = prev.height;
                        }
                        c2d.putImageData(prev, 0, 0);
                    }
                };

                if (!showEffects) {
                    applyPreview(previewBase);
                    return;
                }

                currentParams = readParamsFromDom(root);
                
                // Proxy fast render
                if (workerAvailable()) {
                    requestWorker('cameraRaw', previewBase, currentParams)
                        .then((msg) => applyPreview(new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height)))
                        .catch(() => applyPreview(window.illuApplyCameraRawParams(previewBase, currentParams)));
                } else {
                    applyPreview(window.illuApplyCameraRawParams(previewBase, currentParams));
                }

                // Schedule High-Res rendering after 800ms of inactivity
                if (baseFull && baseFull !== previewBase) {
                    highResTimeout = setTimeout(() => {
                        highResTimeout = null;
                        if (root !== panelRoot || !baseFull) return;
                        
                        // We use main thread renderer since WebGL applies it instantly without worker serialization overhead
                        const highResImg = window.illuApplyCameraRawParams(baseFull, currentParams);
                        
                        const pv = root.querySelector('#illu-cr-preview');
                        if (pv) {
                            const c2d = pv.getContext('2d');
                            if (c2d) {
                                if (pv.width !== highResImg.width || pv.height !== highResImg.height) {
                                    pv.width = highResImg.width;
                                    pv.height = highResImg.height;
                                }
                                c2d.putImageData(highResImg, 0, 0);
                            }
                        }
                    }, 800);
                }

            } catch (err) {
                console.warn('Camera Raw preview', err);
            }
        });
    }

    function closePanel(runCancel) {
        latestPreviewJobId = 0;
        if (highResTimeout != null) {
            clearTimeout(highResTimeout);
            highResTimeout = null;
        }
        if (panelRoot) {
            panelRoot.remove();
            panelRoot = null;
        }
        baseFull = null;
        previewBase = null;
        document.body.classList.remove('illu-camera-raw-open');
        showEffects = true; // Reset for next time
        if (runCancel && typeof onCancelCb === 'function') {
            onCancelCb();
        }
        onCancelCb = null;
        onCommitCb = null;
    }

    function toggleEffects() {
        showEffects = !showEffects;
        if (panelRoot) {
            const btn = panelRoot.querySelector('#pm-btn-toggle-effects');
            if (btn) {
                btn.classList.toggle('is-off', !showEffects);
                btn.innerHTML = showEffects 
                    ? `<i class="fa-solid fa-wand-magic-sparkles"></i> <span>ON</span>`
                    : `<i class="fa-solid fa-image"></i> <span>OFF</span>`;
            }
        }
        schedulePreview();
    }

    async function commitPanel() {
        if (!baseFull || typeof onCommitCb !== 'function' || !panelRoot) {
            closePanel(false);
            return;
        }
        currentParams = readParamsFromDom(panelRoot);
        let out;
        const busy =
            window.IlluProgress && typeof window.IlluProgress.createDelayedInstantEffect === 'function'
                ? window.IlluProgress.createDelayedInstantEffect(tKey('dlg.cameraRawTitle', 'Camera Raw'), 180)
                : null;
        try {
            if (workerAvailable()) {
                try {
                    if (busy) busy.progress(18);
                    const msg = await requestWorker('cameraRaw', baseFull, currentParams);
                    if (!panelRoot) return;
                    out = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
                    if (busy) busy.progress(100);
                } catch (err) {
                    out = window.illuApplyCameraRawParams(baseFull, currentParams);
                }
            } else {
                out = window.illuApplyCameraRawParams(baseFull, currentParams);
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

    function buildPanel() {
        const root = document.createElement('div');
        root.id = 'illu-camera-raw-root';
        root.className = 'illu-camera-raw-overlay';
        root.innerHTML = `
            <div class="illu-cr-backdrop" aria-hidden="true"></div>
            <div class="window floating-window illu-cr-window" role="dialog" aria-modal="true" aria-labelledby="illu-cr-title">
                <div class="title-bar">
                    <div class="title-bar-text" id="illu-cr-title">${tKey('dlg.cameraRawTitle', 'Camera Raw')}</div>
                </div>
                <div class="window-body illu-cr-window-body">
                    <div class="illu-cr-split">
                        <div class="illu-cr-preview-col">
                            <canvas id="illu-cr-preview" class="illu-cr-preview" width="1" height="1"></canvas>
                            <div class="illu-pm-zoom-badge" id="cr-zoom-badge">
                                <span id="pm-zoom-text">${tKey('dlg.preview', 'Aperçu')}</span>
                                <button class="illu-pm-zoom-btn-toggle" id="pm-btn-toggle-effects" title="${tKey('photo.toggleEffects', 'Activer/Désactiver les effets')}">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i> <span>ON</span>
                                </button>
                            </div>
                        </div>
                        <div class="illu-cr-controls-col">
                            <div class="illu-cr-scroll">
                                <section class="illu-cr-sec">
                                    <h3 class="illu-cr-sec-h" data-illu-cr-toggle><span class="illu-cr-chev">▼</span>${tKey('dlg.cameraRawFilters', 'Filtres & Reset')}</h3>
                                    <div class="illu-cr-sec-body" style="padding-bottom: 5px;">
                                        <div class="field-row" style="gap: 5px;">
                                            <select id="illu-cr-preset" style="flex: 1;">
                                                <option value="none">${tKey('photo.presetNone', 'Aucun (Manuel)')}</option>
                                                ${IlluImageAdjustCore.METADATA.UI_PRESETS_LAYOUT.map(group => `
                                                    <optgroup label="${tKey(group.label, group.fallback)}">
                                                        ${group.items.map(item => `
                                                            <option value="${item.id}">${tKey(item.label, item.fallback)}</option>
                                                        `).join('')}
                                                    </optgroup>
                                                `).join('')}
                                            </select>
                                            <button type="button" id="illu-cr-reset-all" style="flex-shrink: 0; padding: 0 10px; font-weight: bold; color: #f55; background: #333; border: 1px solid #444;" title="${tKey('photo.resetAll', 'Réinitialiser Tout')}">RAZ</button>
                                        </div>
                                    </div>
                                </section>
                                ${IlluImageAdjustCore.METADATA.UI_LAYOUT.map(sec => {
                                    const title = tKey(sec.title, sec.fallback);
                                    let content = '';

                                    if (sec.isRGB) {
                                        const rgbGroups = [
                                            { id: 'red', label: tKey('photo.red', 'Rouge'), colorClass: 'red' },
                                            { id: 'green', label: tKey('photo.green', 'Vert'), colorClass: 'green' },
                                            { id: 'blue', label: tKey('photo.blue', 'Bleu'), colorClass: 'blue' }
                                        ];
                                        content = rgbGroups.map(g => `
                                            <div class="illu-cr-chan-group illu-cr-chan-group--${g.colorClass}">
                                                <div class="illu-cr-chan-header">${g.label}</div>
                                                ${IlluImageAdjustCore.Slider.createHtml(`illu-cr-${g.id}`, tKey('photo.general', 'Général'), g.id)}
                                                <div class="illu-cr-chan-grid-mini">
                                                    ${IlluImageAdjustCore.Slider.createHtml(`illu-cr-${g.id}Hi`, 'High', `${g.id}Hi`, { isMini: true })}
                                                    ${IlluImageAdjustCore.Slider.createHtml(`illu-cr-${g.id}Sh`, 'Shadows', `${g.id}Sh`, { isMini: true })}
                                                </div>
                                            </div>
                                        `).join('');
                                    } else if (sec.isCurve) {
                                        content = IlluImageAdjustCore.CurveEditor.createHtml('illu-cr');
                                    } else if (sec.isHSL) {
                                        content = IlluImageAdjustCore.HSLManager.createHtml('illu-cr');
                                    } else if (sec.sliders) {
                                        content = sec.sliders.map(sl => {
                                            if (sl.type === 'separator') {
                                                return '<hr style="border:0;border-top:1px solid #444;margin:5px 0;">';
                                            }
                                            const options = Object.assign({}, sl.options || {});
                                            if (options.indent) {
                                                return `<div style="padding-left: 20px;">${IlluImageAdjustCore.Slider.createHtml(`illu-cr-${sl.id}`, tKey(sl.label, sl.fallback), sl.id, { isMini: true })}</div>`;
                                            }
                                            return IlluImageAdjustCore.Slider.createHtml(`illu-cr-${sl.id}`, tKey(sl.label, sl.fallback), sl.id, options);
                                        }).join('');
                                    }

                                    return `
                                        <section class="illu-cr-sec ${sec.isCollapsed ? 'illu-cr-sec--collapsed' : ''}" id="${sec.id || ''}">
                                            <h3 class="illu-cr-sec-h" data-illu-cr-toggle>
                                                <span><span class="illu-cr-chev">▼</span>${title}</span>
                                                <button type="button" class="cr-raz-btn">RAZ</button>
                                            </h3>
                                            <div class="illu-cr-sec-body">
                                                ${content}
                                            </div>
                                        </section>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                    <div class="illu-cr-foot field-row" style="justify-content: flex-end; flex-wrap: wrap; gap: 8px; margin-top: 10px;">
                        <div style="flex: 1;">
                            <button type="button" id="illu-cr-open-pm">
                                <i class="fa-solid fa-camera"></i> ${tKey('dlg.openInPhotoModePro', 'Ouvrir dans Photo Mode Pro')}
                            </button>
                        </div>
                        <button type="button" id="illu-cr-ok">${tKey('dlg.cameraRawOk', 'OK')}</button>
                        <button type="button" id="illu-cr-cancel">${tKey('dlg.cancel', 'Annuler')}</button>
                    </div>
                </div>
            </div>
        `;
        return root;
    }

    function wirePanel() {
        const root = panelRoot;
        const syncUiFromParams = (params, targetScope) => {
            if (!root || !params) return;
            const scopeNode = targetScope || root;
            Object.keys(DEFAULT_PARAMS).forEach((key) => {
                if (Array.isArray(DEFAULT_PARAMS[key])) return;
                if (targetScope && !scopeNode.querySelector('#illu-cr-' + key)) return;
                const input = root.querySelector('#illu-cr-' + key);
                if (!input) return;
                const val = params[key] != null ? params[key] : DEFAULT_PARAMS[key];
                input.value = val;
                const valDisplay = root.querySelector('#illu-cr-' + key + '-val');
                if (valDisplay) valDisplay.innerText = String(val);
            });
            const cv = root.querySelector('.illu-curve-editor canvas');
            if (cv && cv._forceDraw) cv._forceDraw();
            const hslWrap = root.querySelector('.illu-hsl-manager');
            if (hslWrap && hslWrap._syncUI) hslWrap._syncUI();
        };

        const resetAllBtn = root.querySelector('#illu-cr-reset-all');
        if (resetAllBtn) {
            resetAllBtn.onclick = () => {
                // Reset complex params in the object
                currentParams = Object.assign({}, DEFAULT_PARAMS);
                syncUiFromParams(currentParams);
                schedulePreview();
            };
        }

        const toggleEffectsBtn = root.querySelector('#pm-btn-toggle-effects');
        if (toggleEffectsBtn) {
            toggleEffectsBtn.onclick = () => toggleEffects();
        }

        root.querySelectorAll('[data-illu-cr-toggle]').forEach((h) => {
            h.addEventListener('click', (e) => {
                // RAZ support
                if (e.target.classList.contains('cr-raz-btn')) {
                    e.stopPropagation();
                    const sec = h.parentElement;
                    const inputs = sec.querySelectorAll('input[type="range"]');
                    inputs.forEach((input) => {
                        const key = input.id.replace('illu-cr-', '');
                        if (DEFAULT_PARAMS[key] != null) {
                            const def = DEFAULT_PARAMS[key];
                            input.value = def;
                            const vDisp = sec.querySelector('#illu-cr-' + key + '-val');
                            if (vDisp) vDisp.innerText = String(def);
                        } else {
                            input.value = 0;
                            input.dispatchEvent(new Event('input'));
                        }
                    });
                    if (sec.id === 'sec-curves' && currentParams) {
                        const defPts = [{x:0, y:0}, {x:255, y:255}];
                        currentParams.curveMaster = JSON.parse(JSON.stringify(defPts));
                        currentParams.curveR = JSON.parse(JSON.stringify(defPts));
                        currentParams.curveG = JSON.parse(JSON.stringify(defPts));
                        currentParams.curveB = JSON.parse(JSON.stringify(defPts));
                        const canvas = sec.querySelector('canvas');
                        if (canvas && canvas._forceDraw) canvas._forceDraw();
                    }
                    if (sec.id === 'sec-hsl' && currentParams) {
                        currentParams.hslHue = Array(8).fill(0);
                        currentParams.hslSat = Array(8).fill(0);
                        currentParams.hslLum = Array(8).fill(0);
                        const wrap = sec.querySelector('.illu-hsl-manager');
                        if (wrap && wrap._syncUI) wrap._syncUI();
                    }
                    syncUiFromParams(currentParams, sec);
                    schedulePreview();
                    return;
                }
                const sec = h.closest('.illu-cr-sec');
                if (sec) sec.classList.toggle('illu-cr-sec--collapsed');
            });
        });
        // Bind ALL numeric sliders from the core schema (includes new ones: clarity, dehaze, vignette, sharpen, grainSharpness)
        Object.keys(DEFAULT_PARAMS).forEach(k => {
            if (Array.isArray(DEFAULT_PARAMS[k])) return; // Skip complex types (curves, hsl)
            const id = 'illu-cr-' + k;
            IlluImageAdjustCore.Slider.bind(root, id, k, {}, {
                onInput: () => schedulePreview(),
                onChange: () => schedulePreview()
            });
        });

        // Courbes et TSL
        IlluImageAdjustCore.CurveEditor.bind(root, 'illu-cr', currentParams, () => schedulePreview());
        IlluImageAdjustCore.HSLManager.bind(root, 'illu-cr', currentParams, () => schedulePreview());
        const xBtn = root.querySelector('#illu-cr-close');
        if (xBtn) xBtn.addEventListener('click', () => closePanel(true));
        const cancelBtn = root.querySelector('#illu-cr-cancel');
        if (cancelBtn) cancelBtn.addEventListener('click', () => closePanel(true));
        const okBtn = root.querySelector('#illu-cr-ok');
        if (okBtn) okBtn.addEventListener('click', commitPanel);
        const bd = root.querySelector('.illu-cr-backdrop');
        if (bd) bd.addEventListener('click', () => closePanel(true));

        const pmBtn = root.querySelector('#illu-cr-open-pm');
        if (pmBtn) {
            pmBtn.addEventListener('click', () => {
                const em = window.EditorManager;
                if (em && typeof em.openActiveProjectInPhotoModePro === 'function') {
                    closePanel(false);
                    em.openActiveProjectInPhotoModePro();
                }
            });
        }

        const presetSel = root.querySelector('#illu-cr-preset');
        if (presetSel) {
            presetSel.addEventListener('change', (e) => {
                const p = PRESETS[e.target.value];
                if (p) {
                    currentParams = Object.assign({}, DEFAULT_PARAMS, p);
                    syncUiFromParams(currentParams);
                    schedulePreview();
                }
            });
        }
    }

    /**
     * @param {ImageData} fullImageData
     * @param {{ onCommit: function(ImageData), onCancel?: function() }} opts
     */
    window.openCameraRawPanel = function (fullImageData, opts) {
        if (!fullImageData || !fullImageData.data) return;
        refreshMetadata();
        closePanel(false);
        onCommitCb = opts && opts.onCommit;
        onCancelCb = opts && opts.onCancel;
        baseFull = fullImageData;
        const { id: prev, scale } = downscaleForPreview(fullImageData);
        previewBase = prev;
        previewScale = scale;

        currentParams = JSON.parse(JSON.stringify(DEFAULT_PARAMS));

        panelRoot = buildPanel();
        document.body.appendChild(panelRoot);
        document.body.classList.add('illu-camera-raw-open');
        const winEl = panelRoot.querySelector('.illu-cr-window');
        if (winEl && typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(winEl);
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(panelRoot);
        }
        wirePanel();
        if (window.IlluImageAdjustCore && window.IlluImageAdjustCore.Slider) {
            window.IlluImageAdjustCore.Slider.updateRanges(panelRoot, 'illu-cr-', !!(baseFull && baseFull.rawFloatData));
        }
        schedulePreview();
    };

    window.openCameraRawForActiveLayer = function () {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode || !em.activeLayer || !em.activeLayer.buffer) {
            window.showIlluAlert(tKey('msg.cameraRawPixel', 'Disponible en mode Pixel avec un calque bitmap.'));
            return;
        }
        if (em.activeProject && em.activeProject.role === 'layerAlphaMask') {
            window.showIlluAlert(tKey('msg.cameraRawMask', 'Ouvrez le document principal.'));
            return;
        }
        const c = em.activeLayer.buffer;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        const id = ctx.getImageData(0, 0, c.width, c.height);
        window.openCameraRawPanel(id, {
            onCommit: (out) => {
                ctx.putImageData(out, 0, 0);
                const hist = tKey('history.cameraRaw', 'Camera Raw');
                em.saveHistory(hist, { patchActiveLayer: true });
                em.render({ flushUiThumbnails: true });
            }
        });
    };

    function illuExtractLargestEmbeddedJpeg(arrayBuffer) {
        const u8 = new Uint8Array(arrayBuffer);
        const length = u8.length;
        const jpegStarts = [];
        
        // Find all SOI markers
        for (let i = 0; i < length - 4; i++) {
            if (u8[i] === 0xFF && u8[i+1] === 0xD8 && u8[i+2] === 0xFF) {
                jpegStarts.push(i);
            }
        }
        
        let maxLen = 0;
        let largestBlob = null;
        
        for (let i = 0; i < jpegStarts.length; i++) {
            const start = jpegStarts[i];
            
            // Check if it's a Lossless JPEG (FF C3). Browsers can't decode these, they are RAW data!
            let isLossless = false;
            for (let k = start; k < Math.min(start + 1000, length - 1); k++) {
                if (u8[k] === 0xFF && u8[k+1] === 0xC3) {
                    isLossless = true;
                    break;
                }
            }
            if (isLossless) continue; // Skip RAW data
            
            let depth = 1;
            let end = -1;
            for (let j = start + 2; j < length - 1; j++) {
                if (u8[j] === 0xFF) {
                    if (u8[j+1] === 0xD8) {
                        depth++;
                        j++;
                    } else if (u8[j+1] === 0xD9) {
                        depth--;
                        j++;
                        if (depth === 0) {
                            end = j + 1;
                            break;
                        }
                    }
                }
            }
            
            if (end !== -1) {
                const len = end - start;
                if (len > maxLen) {
                    maxLen = len;
                    largestBlob = new Blob([u8.slice(start, end)], { type: 'image/jpeg' });
                }
            }
        }
        return largestBlob;
    }

    function illuGetExifOrientation(buf) {
        try {
            const view = new DataView(buf);
            if (view.byteLength < 2) return 1;
            const m1 = view.getUint16(0, false);
            let little = false, offset = 0;
            if (m1 === 0xFFD8) {
                let i = 2;
                while (i < view.byteLength - 4) {
                    const marker = view.getUint16(i, false);
                    const len = view.getUint16(i + 2, false);
                    if (marker === 0xFFE1) {
                        if (view.getUint32(i + 4, false) === 0x45786966) {
                            little = view.getUint16(i + 10, false) === 0x4949;
                            offset = i + 10 + view.getUint32(i + 14, little);
                            break;
                        }
                    } else if ((marker & 0xFF00) !== 0xFF00) { break; }
                    i += 2 + len;
                }
            } else if (m1 === 0x4949 || m1 === 0x4D4D) {
                little = m1 === 0x4949;
                offset = view.getUint32(4, little);
            }
            if (offset && offset < view.byteLength - 2) {
                const tags = view.getUint16(offset, little);
                offset += 2;
                for (let j = 0; j < tags; j++) {
                    if (offset + (j * 12) + 12 > view.byteLength) break;
                    if (view.getUint16(offset + (j * 12), little) === 0x0112) {
                        return view.getUint16(offset + (j * 12) + 8, little);
                    }
                }
            }
        } catch(e) {}
        return 1;
    }

    function illuDrawOrientedBitmap(bmp, orientation) {
        const c = document.createElement('canvas');
        let width = bmp.width, height = bmp.height;
        if (orientation >= 5 && orientation <= 8) {
            c.width = height; c.height = width;
        } else {
            c.width = width; c.height = height;
        }
        const ctx = c.getContext('2d');
        switch (orientation) {
            case 2: ctx.transform(-1, 0, 0, 1, width, 0); break;
            case 3: ctx.transform(-1, 0, 0, -1, width, height); break;
            case 4: ctx.transform(1, 0, 0, -1, 0, height); break;
            case 5: ctx.transform(0, 1, 1, 0, 0, 0); break;
            case 6: ctx.transform(0, 1, -1, 0, height, 0); break;
            case 7: ctx.transform(0, -1, -1, 0, height, width); break;
            case 8: ctx.transform(0, -1, 1, 0, 0, width); break;
        }
        ctx.drawImage(bmp, 0, 0);
        return ctx.getImageData(0, 0, c.width, c.height);
    }

    // --- RAW DECODE DIRECT ---
    async function illuDecodeRawDirect(buffer) {
        const scripts = document.querySelectorAll('script[src*="CameraRawPanel"]');
        let librawUrl = './js/libraw/index.js';
        if (scripts.length) {
            librawUrl = new URL('../libraw/index.js', scripts[0].src).href;
        }

        const { default: LibRaw } = await import(librawUrl);
        const lr = new LibRaw();
        const u8 = new Uint8Array(buffer);

        await lr.open(u8, {
            outputBps: 16,
            useCameraWb: true,
            highlight: 1,      // 1 = Ne pas clipper les hautes lumières
            expCorrec: 1,      // Activer la correction d'exposition interne
            expShift: 0.25,    // -2 stops, compresse les hautes lumières dans la plage 16-bit
            outputColor: 0,    // Raw camera color space
        });

        const imgDataRaw = await lr.imageData();

        if (!imgDataRaw || !imgDataRaw.data || !imgDataRaw.width || !imgDataRaw.height) {
            throw new Error('libraw returned empty imageData');
        }

        const { width, height } = imgDataRaw;
        const expectedRgbLen = width * height * 3;
        const expectedRgbaLen = width * height * 4;

        const isUint16 = (imgDataRaw.data instanceof Uint16Array);
        const isFloat  = (imgDataRaw.data instanceof Float32Array);

        // Build Float32 RGBA in linear 0..∞ space
        const floatData = new Float32Array(expectedRgbaLen);
        const HDR_HEADROOM = 16.0; // Restauration du headroom HDR depuis LibRaw + Compensation Reinhard
        
        function srgbToLinear(x) {
            return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        }

        if (imgDataRaw.data.length === expectedRgbLen) {
            let s = 0, d = 0;
            const data = imgDataRaw.data;
            const len = width * height;
            if (isUint16) {
                const lut = new Float32Array(65536);
                for (let i = 0; i < 65536; i++) lut[i] = srgbToLinear(i / 65535.0) * HDR_HEADROOM;
                for (let i = 0; i < len; i++) {
                    floatData[d++] = lut[data[s++]];
                    floatData[d++] = lut[data[s++]];
                    floatData[d++] = lut[data[s++]];
                    floatData[d++] = 1.0;
                }
            } else if (!isFloat) {
                const lut = new Float32Array(256);
                for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i / 255.0) * HDR_HEADROOM;
                for (let i = 0; i < len; i++) {
                    floatData[d++] = lut[data[s++]];
                    floatData[d++] = lut[data[s++]];
                    floatData[d++] = lut[data[s++]];
                    floatData[d++] = 1.0;
                }
            } else {
                for (let i = 0; i < len; i++) {
                    floatData[d++] = srgbToLinear(data[s++]) * HDR_HEADROOM;
                    floatData[d++] = srgbToLinear(data[s++]) * HDR_HEADROOM;
                    floatData[d++] = srgbToLinear(data[s++]) * HDR_HEADROOM;
                    floatData[d++] = 1.0;
                }
            }
        } else {
            const data = imgDataRaw.data;
            const len = expectedRgbaLen;
            if (isUint16) {
                const lut = new Float32Array(65536);
                for (let i = 0; i < 65536; i++) lut[i] = srgbToLinear(i / 65535.0) * HDR_HEADROOM;
                for (let i = 0; i < len; i++) {
                    if ((i + 1) % 4 === 0) floatData[i] = 1.0;
                    else floatData[i] = lut[data[i]];
                }
            } else if (!isFloat) {
                const lut = new Float32Array(256);
                for (let i = 0; i < 256; i++) lut[i] = srgbToLinear(i / 255.0) * HDR_HEADROOM;
                for (let i = 0; i < len; i++) {
                    if ((i + 1) % 4 === 0) floatData[i] = 1.0;
                    else floatData[i] = lut[data[i]];
                }
            } else {
                for (let i = 0; i < len; i++) {
                    if ((i + 1) % 4 === 0) floatData[i] = 1.0;
                    else floatData[i] = srgbToLinear(data[i]) * HDR_HEADROOM;
                }
            }
        }

        // Extract metadata from the RAW file if available
        let metadata = null;
        try {
            metadata = await lr.metadata(true);
            console.log('[CameraRaw] Loaded RAW Metadata:', metadata);
        } catch (metaErr) {
            console.warn('[CameraRaw] Failed to load RAW metadata:', metaErr);
        }

        // Also build a U8 preview (sRGB gamma-corrected) for the 8-bit thumbnail
        // We apply the same Reinhard tonemapping here so the thumbnail perfectly matches the WebGL/Wasm canvas!
        const previewU8 = new Uint8ClampedArray(expectedRgbaLen);
        const Lw = 4.0;
        const Lw2 = Lw * Lw;
        
        // LUT for fast linToSrgbByte conversion since Reinhard outputs [0..1]
        const srgbOutLUT = new Uint8Array(4096);
        for (let i = 0; i < 4096; i++) {
            let x = i / 4095.0;
            let v = x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
            srgbOutLUT[i] = Math.max(0, Math.min(255, Math.round(v * 255)));
        }

        for (let i = 0; i < expectedRgbaLen; i += 4) {
            let r = floatData[i];
            let g = floatData[i + 1];
            let b = floatData[i + 2];
            
            // Fast inline max
            let maxC = r > g ? r : g;
            if (b > maxC) maxC = b;
            
            if (maxC > 0.0) {
                const mappedMax = maxC * (1.0 + maxC / Lw2) / (1.0 + maxC);
                const ratio = mappedMax / maxC;
                r *= ratio;
                g *= ratio;
                b *= ratio;
            }

            // LUT lookup
            previewU8[i]     = srgbOutLUT[(r * 4095) | 0] || 255;
            previewU8[i + 1] = srgbOutLUT[(g * 4095) | 0] || 255;
            previewU8[i + 2] = srgbOutLUT[(b * 4095) | 0] || 255;
            previewU8[i + 3] = 255;
        }

        return { floatData, previewU8, width, height, metadata };
    }

    window.illuConvertRawFileToImageData = async function (file) {
        if (window.IlluProgress && window.IlluProgress.instantEffectStart) {
            window.IlluProgress.instantEffectStart('Décodage RAW');
            window.IlluProgress.instantEffectProgress(0, 'Le traitement natif (14-bit) peut prendre quelques secondes.');
        }

        try {
            const buf = await file.arrayBuffer();
            const orientation = illuGetExifOrientation(buf);

        // Try libraw-wasm FIRST via background Worker for true linear RAW demosaicing
        // The worker runs libraw in a separate thread — UI stays fully responsive!
        try {
            // --- KEEPALIVE: ping IlluProgress every 2s so stall-timer doesn't fire ---
            const startMs = Date.now();
            const rawPhases = [
                'Initialisation du décodeur libraw-wasm…',
                'Démosaïcage des capteurs RAW…',
                'Traitement de la balance des blancs…',
                'Conversion en espace linéaire 16-bit…',
                'Rotation et reconstruction de l\'image…',
                'Finalisation des données flottantes…'
            ];
            let phaseIdx = 0;
            const keepalive = setInterval(() => {
                if (!window.IlluProgress || !window.IlluProgress.instantEffectProgress) return;
                const elapsed = Math.round((Date.now() - startMs) / 1000);
                const phase = rawPhases[Math.min(phaseIdx++, rawPhases.length - 1)];
                window.IlluProgress.instantEffectProgress(
                    Math.min(95, elapsed * 3), // Simulated progress (caps at 95%)
                    `${phase} (${elapsed}s)`
                );
            }, 2000);

            let floatResult;
            try {
                floatResult = await illuDecodeRawDirect(buf);
            } finally {
                clearInterval(keepalive);
            }

            if (floatResult && floatResult.floatData && floatResult.width) {
                if (window.IlluProgress && window.IlluProgress.instantEffectProgress) {
                    window.IlluProgress.instantEffectProgress(98, 'Application de l\'orientation…');
                }
                const { floatData, previewU8, width, height } = floatResult;

                // Build the 8-bit preview ImageData (sRGB) for display & thumbnail
                // previewU8 is already gamma-corrected by the worker
                const imgDataObj = new ImageData(previewU8, width, height);

                // Apply orientation to the 8-bit preview
                const c = document.createElement('canvas');
                c.width = imgDataObj.width; c.height = imgDataObj.height;
                c.getContext('2d').putImageData(imgDataObj, 0, 0);
                const bmp = await createImageBitmap(c);
                const id = illuDrawOrientedBitmap(bmp, orientation);
                bmp.close();

                // Rotate the Float32Array to match the 8-bit preview orientation
                if (orientation > 1) {
                    const w = width;
                    const h = height;
                    let outW = w, outH = h;
                    if (orientation >= 5 && orientation <= 8) { outW = h; outH = w; }
                    const outFloat = new Float32Array(outW * outH * 4);
                    
                    // Fast branch-hoisted loops for the common orientations
                    if (orientation === 6) { // 90 deg CW
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                const si = (y * w + x) * 4;
                                const di = (x * outW + (h - 1 - y)) * 4;
                                outFloat[di] = floatData[si]; outFloat[di+1] = floatData[si+1];
                                outFloat[di+2] = floatData[si+2]; outFloat[di+3] = floatData[si+3];
                            }
                        }
                    } else if (orientation === 8) { // 90 deg CCW
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                const si = (y * w + x) * 4;
                                const di = ((w - 1 - x) * outW + y) * 4;
                                outFloat[di] = floatData[si]; outFloat[di+1] = floatData[si+1];
                                outFloat[di+2] = floatData[si+2]; outFloat[di+3] = floatData[si+3];
                            }
                        }
                    } else if (orientation === 3) { // 180 deg
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                const si = (y * w + x) * 4;
                                const di = ((h - 1 - y) * outW + (w - 1 - x)) * 4;
                                outFloat[di] = floatData[si]; outFloat[di+1] = floatData[si+1];
                                outFloat[di+2] = floatData[si+2]; outFloat[di+3] = floatData[si+3];
                            }
                        }
                    } else {
                        for (let y = 0; y < h; y++) {
                            for (let x = 0; x < w; x++) {
                                let dx = x, dy = y;
                                switch (orientation) {
                                    case 2: dx = w - 1 - x; dy = y; break;
                                    case 4: dx = x; dy = h - 1 - y; break;
                                    case 5: dx = y; dy = x; break;
                                    case 7: dx = h - 1 - y; dy = w - 1 - x; break;
                                }
                                const si = (y * w + x) * 4;
                                const di = (dy * outW + dx) * 4;
                                outFloat[di] = floatData[si]; outFloat[di+1] = floatData[si+1];
                                outFloat[di+2] = floatData[si+2]; outFloat[di+3] = floatData[si+3];
                            }
                        }
                    }
                    id.rawFloatData   = outFloat;
                    id.rawFloatWidth  = outW;
                    id.rawFloatHeight = outH;
                } else {
                    id.rawFloatData   = floatData;
                    id.rawFloatWidth  = width;
                    id.rawFloatHeight = height;
                }
                id.rawMetadata = floatResult.metadata;

                return id;
            }
        } catch (wasmErr) {
            console.warn('[CameraRaw] Worker RAW decoding failed, falling back to embedded JPEG.', wasmErr);
        }

        // Try local extraction first
        try {
            const localBlob = illuExtractLargestEmbeddedJpeg(buf);
            if (localBlob) {
                const bmp = await createImageBitmap(localBlob, { imageOrientation: "none" });
                const id = illuDrawOrientedBitmap(bmp, orientation);
                bmp.close();
                return id;
            }
        } catch (localErr) {
            console.warn('[CameraRaw] Client-side RAW preview extraction failed.', localErr);
        }

            throw new Error("Conversion RAW indisponible : fichier corrompu ou illisible localement. Le traitement serveur a été désactivé.");
        } finally {
            if (window.IlluProgress && window.IlluProgress.instantEffectDone) {
                window.IlluProgress.instantEffectDone();
            }
        }
    };

    window.openCameraRawAfterRawImport = async function (file, fileInputEl) {
        const em = window.EditorManager;
        
        // Open the Photo Mode Pro UI immediately so the user isn't stuck on the main canvas
        if (window.PhotoModeManager && typeof window.PhotoModeManager.openMode === 'function') {
            window.PhotoModeManager.openMode();
        }

        let id;
        try {
            id = await window.illuConvertRawFileToImageData(file);
        } catch (e) {
            console.warn(e);
            window.showIlluAlert(
                (e && e.message) || tKey('msg.cameraRawConvertFail', 'Échec de la conversion RAW.')
            );
            if (fileInputEl) fileInputEl.value = '';
            return;
        }
        
        const c = document.createElement('canvas');
        c.width = id.width;
        c.height = id.height;
        c.getContext('2d').putImageData(id, 0, 0);

        if (em && typeof em.handleNewProjectFromImage === 'function') {
            em.handleNewProjectFromImage(c);
            if (window.PhotoModeManager && typeof window.PhotoModeManager.openFromCanvas === 'function') {
                await window.PhotoModeManager.openFromCanvas(c, file.name, {
                    rawFloatData: id.rawFloatData,
                    rawFloatWidth: id.rawFloatWidth,
                    rawFloatHeight: id.rawFloatHeight,
                    rawMetadata: id.rawMetadata
                });
            }
        }
        if (fileInputEl) fileInputEl.value = '';
    };
})();
