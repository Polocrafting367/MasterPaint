/**
 * Panneau type Camera Raw + import RAW (conversion serveur via raw-convert.php).
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

    const PREVIEW_MAX = 960;

    let METADATA = { DEFAULT_PARAMS: {}, RANGES: {}, PRESETS: {} };
    let CR_RANGE = METADATA.RANGES;
    let DEFAULT_PARAMS = METADATA.DEFAULT_PARAMS;
    let PRESETS = METADATA.PRESETS;
    let showEffects = true;

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

            if (p.temp !== 0) {
                const t = p.temp / 100;
                r *= 1 + t * 0.12;
                b *= 1 - t * 0.12;
                g *= 1 + t * 0.02;
            }
            if (p.tint !== 0) {
                const tn = p.tint / 100;
                r *= 1 + tn * 0.06;
                b *= 1 + tn * 0.06;
                g *= 1 - tn * 0.08;
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
        if (p.clarity !== 0 || p.dehaze !== 0 || p.vignette !== 0) skipWebGL = true;
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
                        // Return the GPU canvas directly to avoid readPixels overhead (SUPER FAST)
                        return window.WebGLFilterEngine.renderToInternalCanvas(imageData, 'camera_raw', p);
                    }
                    const gpuRes = window.WebGLFilterEngine.applyFilter(imageData, 'camera_raw', p);
                    if (gpuRes) return gpuRes;
                }
            } catch (err) {
                console.warn('[CameraRaw] WebGL failed, falling back', err);
            }
        }

        const srcBuf = new Uint8ClampedArray(imageData.data);
        const core = typeof window.IlluImageAdjustCore !== 'undefined' ? window.IlluImageAdjustCore : null;
        const d =
            core && typeof core.applyCameraRawBuffer === 'function'
                ? core.applyCameraRawBuffer(srcBuf, w, h, p)
                : applyToneColor(srcBuf, w, h, p);
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
                if (workerAvailable()) {
                    requestWorker('cameraRaw', previewBase, currentParams)
                        .then((msg) => {
                            applyPreview(new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height));
                        })
                        .catch(() => {
                            applyPreview(window.illuApplyCameraRawParams(previewBase, currentParams));
                        });
                    return;
                }
                applyPreview(window.illuApplyCameraRawParams(previewBase, currentParams));
            } catch (err) {
                console.warn('Camera Raw preview', err);
            }
        });
    }

    function closePanel(runCancel) {
        latestPreviewJobId = 0;
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

    window.illuConvertRawFileToImageData = async function (file) {
        const url = window.ILLU_RAW_CONVERT_URL || 'raw-convert.php';
        const fd = new FormData();
        fd.append('raw', file, file.name);
        const res = await fetch(url, { method: 'POST', body: fd });
        if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(text.trim() || res.statusText);
        }
        const blob = await res.blob();
        const bmp = await createImageBitmap(blob);
        const c = document.createElement('canvas');
        c.width = bmp.width;
        c.height = bmp.height;
        const x = c.getContext('2d');
        x.drawImage(bmp, 0, 0);
        bmp.close();
        return x.getImageData(0, 0, c.width, c.height);
    };

    window.openCameraRawAfterRawImport = async function (file, fileInputEl) {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode) {
            window.showIlluAlert(tKey('msg.cameraRawPixel', 'Disponible en mode Pixel avec un calque bitmap.'));
            if (fileInputEl) fileInputEl.value = '';
            return;
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
        window.openCameraRawPanel(id, {
            onCommit: (out) => {
                const c = document.createElement('canvas');
                c.width = out.width;
                c.height = out.height;
                c.getContext('2d').putImageData(out, 0, 0);
                if (typeof em.promptImport === 'function') {
                    em.promptImport(c);
                }
            },
            onCancel: () => { }
        });
        if (fileInputEl) fileInputEl.value = '';
    };
})();
