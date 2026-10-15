/**
 * RemoveBgGuided.js
 * Détourage guidé par annotations (hints verts = conserver, rouges = supprimer).
 * Deux modes :
 *   - "force"  : lance l'IA existante puis force les zones annotées
 *   - "propagation" : segmentation couleur sans IA (GrabCut-like JS, hors-ligne)
 */
(function () {
    'use strict';

    /* ─── helpers i18n / progress ─── */
    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t(k) : fb;
    }

    /* ─── constantes ─── */
    const HINT_KEEP   = 1;
    const HINT_REMOVE = 2;
    const MAX_PREVIEW = 700; // px max pour le canvas d'annotation

    /* ─── état global ─── */
    const G = {
        visible   : false,
        srcBuf    : null,   // canvas source (calque actif)
        previewW  : 0,
        previewH  : 0,
        scale     : 1,      // srcBuf → preview
        hints     : null,   // Uint8Array[previewW * previewH] : 0=none, 1=keep, 2=remove
        painting  : false,
        mode      : 'propagation', // 'force' | 'propagation'
        brushSize : 12,
        brushType : HINT_KEEP,     // quel pinceau actif
    };

    /* ════════════════════════════════
       DOM
    ════════════════════════════════ */
    function ensureDom() {
        if (document.getElementById('illu-rbg-guided-overlay')) return;

        const el = document.createElement('div');
        el.id        = 'illu-rbg-guided-overlay';
        el.className = 'illu-rbg-guided-overlay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');

        el.innerHTML = `
<div class="illu-rbgg-backdrop" aria-hidden="true"></div>
<div class="window floating-window illu-rbgg-window" id="illu-rbgg-window">
  <div class="title-bar">
    <div class="title-bar-text" id="illu-rbgg-title">${tKey('dlg.guidedRemoveBgTitle','Détourage guidé')}</div>
    <div class="title-bar-controls">
      <button type="button" class="title-bar-close-btn" id="illu-rbgg-x" aria-label="Close"></button>
    </div>
  </div>
  <div class="window-body illu-rbgg-body">

    <!-- Toolbar -->
    <div class="illu-rbgg-toolbar">
      <div class="illu-rbgg-tool-group">
        <button id="illu-rbgg-btn-keep"   class="illu-rbgg-brush-btn illu-rbgg-btn-keep   is-active" title="${tKey('dlg.guidedKeep','Conserver (vert)')}">
          <span class="illu-rbgg-swatch illu-rbgg-swatch--keep"></span> ${tKey('dlg.guidedKeep','Conserver')}
        </button>
        <button id="illu-rbgg-btn-remove" class="illu-rbgg-brush-btn illu-rbgg-btn-remove"            title="${tKey('dlg.guidedRemove','Supprimer (rouge)')}">
          <span class="illu-rbgg-swatch illu-rbgg-swatch--remove"></span> ${tKey('dlg.guidedRemove','Supprimer')}
        </button>
        <button id="illu-rbgg-btn-erase"  class="illu-rbgg-brush-btn illu-rbgg-btn-erase"             title="${tKey('dlg.guidedErase','Effacer annotation')}">
          ✕ ${tKey('dlg.guidedErase','Effacer')}
        </button>
      </div>
      <div class="illu-rbgg-tool-group" style="align-items:center;gap:6px;">
        <label for="illu-rbgg-size" style="font-size:11px;white-space:nowrap;">${tKey('dlg.guidedBrushSize','Pinceau')}</label>
        <input type="range" id="illu-rbgg-size" min="3" max="60" value="12" style="width:80px;">
        <span id="illu-rbgg-size-val" style="font-size:11px;min-width:24px;">12</span>
      </div>
      <div class="illu-rbgg-tool-group">
        <button id="illu-rbgg-btn-clearall" style="font-size:11px;" title="${tKey('dlg.guidedClearAll','Effacer toutes les annotations')}">
          🗑 ${tKey('dlg.guidedClearAll','Tout effacer')}
        </button>
      </div>
    </div>

    <!-- Canvas zone -->
    <div class="illu-rbgg-canvas-wrap">
      <canvas id="illu-rbgg-canvas" class="illu-rbgg-canvas"></canvas>
      <canvas id="illu-rbgg-hint-canvas" class="illu-rbgg-hint-canvas"></canvas>
    </div>

    <p class="illu-rbgg-legend">
      <span class="illu-rbgg-swatch illu-rbgg-swatch--keep"></span>${tKey('dlg.guidedLegendKeep','Zones vertes = forcer conservation')} &nbsp;
      <span class="illu-rbgg-swatch illu-rbgg-swatch--remove"></span>${tKey('dlg.guidedLegendRemove','Zones rouges = forcer suppression')}
    </p>

    <!-- Mode -->
    <div class="illu-rbgg-mode-row">
      <label style="font-size:11px;font-weight:bold;">${tKey('dlg.guidedMode','Mode :')}</label>
      <label class="illu-rbgg-radio-lbl">
        <input type="radio" name="rbgg-mode" value="propagation" checked>
        ${tKey('dlg.guidedModeProp','Propagation couleur (hors-ligne)')}
      </label>
      <label class="illu-rbgg-radio-lbl">
        <input type="radio" name="rbgg-mode" value="force">
        ${tKey('dlg.guidedModeForce','IA + force zones')}
      </label>
    </div>

    <!-- Actions -->
    <div class="illu-rbgg-actions">
      <button type="button" id="illu-rbgg-cancel">${tKey('dlg.cancel','Annuler')}</button>
      <button type="button" id="illu-rbgg-apply"  class="illu-rbgg-apply-btn">${tKey('dlg.guidedApply','Appliquer le détourage')}</button>
    </div>
  </div>
</div>`;

        document.body.appendChild(el);
        bindDomEvents(el);
    }

    function bindDomEvents(root) {
        const close = () => hide();
        root.querySelector('.illu-rbgg-backdrop').addEventListener('click', close);
        root.querySelector('#illu-rbgg-x').addEventListener('click', close);
        root.querySelector('#illu-rbgg-cancel').addEventListener('click', close);

        /* pinceaux */
        root.querySelector('#illu-rbgg-btn-keep').addEventListener('click', () => setBrush(HINT_KEEP));
        root.querySelector('#illu-rbgg-btn-remove').addEventListener('click', () => setBrush(HINT_REMOVE));
        root.querySelector('#illu-rbgg-btn-erase').addEventListener('click', () => setBrush(0));

        /* taille pinceau */
        const sizeSlider = root.querySelector('#illu-rbgg-size');
        const sizeVal    = root.querySelector('#illu-rbgg-size-val');
        sizeSlider.addEventListener('input', () => {
            G.brushSize = parseInt(sizeSlider.value, 10);
            sizeVal.textContent = G.brushSize;
        });

        /* effacer tout */
        root.querySelector('#illu-rbgg-btn-clearall').addEventListener('click', clearAllHints);

        /* mode radio */
        root.querySelectorAll('input[name="rbgg-mode"]').forEach(r => {
            r.addEventListener('change', e => { G.mode = e.target.value; });
        });

        /* appliquer */
        root.querySelector('#illu-rbgg-apply').addEventListener('click', applyGuided);

        /* dessin sur hint-canvas */
        const hc = root.querySelector('#illu-rbgg-hint-canvas');
        hc.addEventListener('mousedown',  e => { G.painting = true; paintAt(e); });
        hc.addEventListener('mousemove',  e => { if (G.painting) paintAt(e); });
        hc.addEventListener('mouseup',    () => { G.painting = false; });
        hc.addEventListener('mouseleave', () => { G.painting = false; });
        hc.addEventListener('touchstart', e => { G.painting = true; paintAt(e.touches[0]); e.preventDefault(); }, { passive: false });
        hc.addEventListener('touchmove',  e => { if (G.painting) paintAt(e.touches[0]); e.preventDefault(); }, { passive: false });
        hc.addEventListener('touchend',   () => { G.painting = false; });
    }

    /* ════════════════════════════════
       Affichage / masquage
    ════════════════════════════════ */
    function show(srcCanvas) {
        ensureDom();
        G.srcBuf = srcCanvas;

        const w = srcCanvas.width, h = srcCanvas.height;
        const s = Math.min(1, MAX_PREVIEW / Math.max(w, h));
        G.previewW = Math.round(w * s);
        G.previewH = Math.round(h * s);
        G.scale    = s;
        G.hints    = new Uint8Array(G.previewW * G.previewH);

        /* canvas image */
        const imgCanvas = document.getElementById('illu-rbgg-canvas');
        imgCanvas.width  = G.previewW;
        imgCanvas.height = G.previewH;
        imgCanvas.getContext('2d').drawImage(srcCanvas, 0, 0, G.previewW, G.previewH);

        /* canvas hints (transparent) */
        const hintCanvas = document.getElementById('illu-rbgg-hint-canvas');
        hintCanvas.width  = G.previewW;
        hintCanvas.height = G.previewH;
        hintCanvas.getContext('2d').clearRect(0, 0, G.previewW, G.previewH);

        /* reset UI */
        setBrush(HINT_KEEP);
        const overlay = document.getElementById('illu-rbg-guided-overlay');
        overlay.style.display = 'flex';
        document.body.classList.add('illu-rbgg-open');
        G.visible = true;
    }

    function hide() {
        const overlay = document.getElementById('illu-rbg-guided-overlay');
        if (overlay) overlay.style.display = 'none';
        document.body.classList.remove('illu-rbgg-open');
        G.visible = false;
    }

    /* ════════════════════════════════
       Pinceau
    ════════════════════════════════ */
    function setBrush(type) {
        G.brushType = type;
        ['keep', 'remove', 'erase'].forEach(t => {
            const btn = document.getElementById('illu-rbgg-btn-' + t);
            if (btn) btn.classList.remove('is-active');
        });
        const map = { [HINT_KEEP]: 'keep', [HINT_REMOVE]: 'remove', 0: 'erase' };
        const id = 'illu-rbgg-btn-' + (map[type] || 'erase');
        const el = document.getElementById(id);
        if (el) el.classList.add('is-active');

        const hc = document.getElementById('illu-rbgg-hint-canvas');
        if (hc) {
            hc.style.cursor =
                type === HINT_KEEP   ? 'crosshair' :
                type === HINT_REMOVE ? 'cell'      : 'default';
        }
    }

    function paintAt(ev) {
        const hc   = document.getElementById('illu-rbgg-hint-canvas');
        if (!hc) return;
        const rect = hc.getBoundingClientRect();
        const cx   = document.getElementById('illu-rbgg-canvas');
        const scaleX = G.previewW / rect.width;
        const scaleY = G.previewH / rect.height;
        const px = Math.round((ev.clientX - rect.left) * scaleX);
        const py = Math.round((ev.clientY - rect.top)  * scaleY);
        const r  = Math.ceil(G.brushSize / 2);

        const ctx = hc.getContext('2d');

        for (let dy = -r; dy <= r; dy++) {
            for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy > r * r) continue;
                const nx = px + dx, ny = py + dy;
                if (nx < 0 || ny < 0 || nx >= G.previewW || ny >= G.previewH) continue;
                G.hints[ny * G.previewW + nx] = G.brushType;
            }
        }

        /* redessiner le hint-canvas */
        redrawHints(ctx);
    }

    function redrawHints(ctx) {
        ctx.clearRect(0, 0, G.previewW, G.previewH);
        const id = ctx.createImageData(G.previewW, G.previewH);
        const d  = id.data;
        for (let i = 0, n = G.hints.length; i < n; i++) {
            const h = G.hints[i];
            if (!h) continue;
            const base = i * 4;
            if (h === HINT_KEEP) {
                d[base]   = 0;
                d[base+1] = 200;
                d[base+2] = 60;
                d[base+3] = 140;
            } else {
                d[base]   = 220;
                d[base+1] = 30;
                d[base+2] = 30;
                d[base+3] = 140;
            }
        }
        ctx.putImageData(id, 0, 0);
    }

    function clearAllHints() {
        G.hints.fill(0);
        const hc  = document.getElementById('illu-rbgg-hint-canvas');
        if (hc) hc.getContext('2d').clearRect(0, 0, G.previewW, G.previewH);
    }

    /* ════════════════════════════════
       Application
    ════════════════════════════════ */
    async function applyGuided() {
        const em = window.EditorManager;
        if (!em || !em.activeLayer || !em.activeLayer.buffer) return;

        const applyBtn = document.getElementById('illu-rbgg-apply');
        if (applyBtn) { applyBtn.disabled = true; applyBtn.textContent = '⏳…'; }

        try {
            if (G.mode === 'force') {
                await applyModeForce(em);
            } else {
                applyModePropagation(em);
            }
            em.saveHistory(tKey('history.guidedRemoveBg', 'Détourage guidé'), { patchActiveLayer: true });
            em.render({ flushUiThumbnails: true });
            hide();
        } catch (e) {
            console.error('[RemoveBgGuided]', e);
            window.showIlluAlert && window.showIlluAlert(
                tKey('msg.guidedRemoveBgFail', 'Détourage guidé : erreur. ') + (e && e.message ? String(e.message).slice(0, 180) : '')
            );
        } finally {
            if (applyBtn) { applyBtn.disabled = false; applyBtn.textContent = tKey('dlg.guidedApply', 'Appliquer le détourage'); }
        }
    }

    /* ── Mode Force : IA d'abord puis écrasement des hints ── */
    async function applyModeForce(em) {
        /* On utilise la fonction IA déjà existante si dispo */
        if (typeof window.illuRemoveBackgroundIntelligent !== 'function') {
            throw new Error(tKey('msg.guidedNoIa', 'Module IA non disponible. Utilisez le mode Propagation.'));
        }

        const buf = em.activeLayer.buffer;
        const w   = buf.width, h = buf.height;

        /* Convertir les hints preview → pleine résolution */
        const fullHints = upscaleHints(w, h);

        /* Lancer l'IA via la lib directement (sans ouvrir la fenêtre IA) */
        const MODULE_URL =
            window.ILLU_REMOVE_BG_MODULE_URL ||
            'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm';
        const mod = await import(/* webpackIgnore: true */ MODULE_URL);
        const removeBackground = mod && mod.removeBackground;
        if (typeof removeBackground !== 'function') throw new Error('removeBackground fn missing');

        const blobIn = await canvasToBlob(buf);
        const outBlob = await removeBackground(blobIn, {
            model: window.ILLU_REMOVE_BG_MODEL || 'small',
            output: { format: 'image/png', quality: 1 }
        });

        const bmp = await createImageBitmap(outBlob);
        const ctx = buf.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(bmp, 0, 0, w, h);
        bmp.close();

        /* Forcer les hints */
        forceHintsOnCtx(ctx, w, h, fullHints);
    }

    /* ── Mode Propagation : segmentation couleur JS (GrabCut-like léger) ── */
    function applyModePropagation(em) {
        const buf = em.activeLayer.buffer;
        const w   = buf.width, h = buf.height;
        const ctx = buf.getContext('2d', { willReadFrequently: true });
        const id  = ctx.getImageData(0, 0, w, h);
        const data= id.data;

        /* Upscale hints */
        const fullHints = upscaleHints(w, h);

        /* Collecter les échantillons couleur (CIELAB) des zones keep et remove */
        const keepSamples   = [];
        const removeSamples = [];
        for (let i = 0; i < fullHints.length; i++) {
            if (!fullHints[i]) continue;
            const base = i * 4;
            const lab  = rgbToLab(data[base], data[base+1], data[base+2]);
            if (fullHints[i] === HINT_KEEP)   keepSamples.push(lab);
            else                               removeSamples.push(lab);
        }

        /* Si aucun hint → ne rien faire */
        if (keepSamples.length === 0 && removeSamples.length === 0) {
            throw new Error(tKey('msg.guidedNoHints', 'Peignez d\'abord des zones verte/rouge avant d\'appliquer.'));
        }

        /* Paramètres adaptatifs selon le nombre d'échantillons */
        const keepMean   = keepSamples.length   ? labMean(keepSamples)   : null;
        const removeMean = removeSamples.length ? labMean(removeSamples) : null;

        /* Seuil adaptatif basé sur la distance inter-classes */
        let threshold = 28;
        if (keepMean && removeMean) {
            const interDist = labDist(keepMean, removeMean);
            threshold = Math.max(10, Math.min(50, interDist * 0.35));
        }

        /* Segmenter pixel par pixel */
        for (let i = 0; i < w * h; i++) {
            /* Si ce pixel est un hint, on le force directement */
            if (fullHints[i] === HINT_REMOVE) { data[i * 4 + 3] = 0; continue; }
            if (fullHints[i] === HINT_KEEP)   { /* conserver tel quel */; continue; }

            const base = i * 4;
            const lab  = rgbToLab(data[base], data[base+1], data[base+2]);

            let dKeep   = keepMean   ? labDist(lab, keepMean)   : Infinity;
            let dRemove = removeMean ? labDist(lab, removeMean) : Infinity;

            if (keepMean && removeMean) {
                /* Pixel plus proche du remove que du keep → transparent */
                if (dRemove < dKeep - threshold * 0.15) {
                    data[i * 4 + 3] = 0;
                } else if (dKeep < dRemove - threshold * 0.15) {
                    /* conserver */
                } else {
                    /* Zone ambiguë : transparence progressive */
                    const t = Math.max(0, Math.min(1, (dKeep - dRemove) / (threshold * 0.8) * 0.5 + 0.5));
                    data[i * 4 + 3] = Math.round(t * data[i * 4 + 3]);
                }
            } else if (removeMean) {
                /* Seulement des hints remove */
                if (dRemove < threshold) {
                    const t = dRemove / threshold;
                    data[i * 4 + 3] = Math.round(t * t * data[i * 4 + 3]);
                }
            } else if (keepMean) {
                /* Seulement des hints keep : supprimer ce qui est loin */
                if (dKeep > threshold) {
                    const t = Math.min(1, (dKeep - threshold) / threshold);
                    data[i * 4 + 3] = Math.round((1 - t) * data[i * 4 + 3]);
                }
            }
        }

        ctx.putImageData(id, 0, 0);
    }

    /* ────────────────────────────────
       Utilitaires
    ──────────────────────────────── */

    /** Upscale hints preview → taille pleine résolution (nearest-neighbor) */
    function upscaleHints(fullW, fullH) {
        const result = new Uint8Array(fullW * fullH);
        const pw = G.previewW, ph = G.previewH;
        for (let fy = 0; fy < fullH; fy++) {
            const py = Math.min(ph - 1, Math.floor(fy / G.scale));
            for (let fx = 0; fx < fullW; fx++) {
                const px = Math.min(pw - 1, Math.floor(fx / G.scale));
                result[fy * fullW + fx] = G.hints[py * pw + px];
            }
        }
        return result;
    }

    /** Forcer alpha=255 sur KEEP et alpha=0 sur REMOVE */
    function forceHintsOnCtx(ctx, w, h, fullHints) {
        const id   = ctx.getImageData(0, 0, w, h);
        const data = id.data;
        for (let i = 0; i < fullHints.length; i++) {
            if (fullHints[i] === HINT_KEEP)   data[i * 4 + 3] = 255;
            else if (fullHints[i] === HINT_REMOVE) data[i * 4 + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
    }

    function canvasToBlob(canvas) {
        return new Promise((resolve, reject) => {
            canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob')), 'image/png');
        });
    }

    /* ── CIELAB ── */
    const LAB_E = 216 / 24389;
    const LAB_K = 24389 / 27;

    function rgbToLab(r, g, b) {
        let rL = r / 255, gL = g / 255, bL = b / 255;
        rL = rL > 0.04045 ? Math.pow((rL + 0.055) / 1.055, 2.4) : rL / 12.92;
        gL = gL > 0.04045 ? Math.pow((gL + 0.055) / 1.055, 2.4) : gL / 12.92;
        bL = bL > 0.04045 ? Math.pow((bL + 0.055) / 1.055, 2.4) : bL / 12.92;
        let x = (rL * 0.4124 + gL * 0.3576 + bL * 0.1805) / 0.95047;
        let y = (rL * 0.2126 + gL * 0.7152 + bL * 0.0722) / 1.00000;
        let z = (rL * 0.0193 + gL * 0.1192 + bL * 0.9505) / 1.08883;
        const f = t => t > LAB_E ? Math.cbrt(t) : (LAB_K * t + 16) / 116;
        const fx = f(x), fy = f(y), fz = f(z);
        return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
    }

    function labDist(a, b) {
        const dL = a[0]-b[0], da = a[1]-b[1], db = a[2]-b[2];
        return Math.sqrt(dL*dL + da*da + db*db);
    }

    function labMean(labs) {
        let L=0, A=0, B=0;
        const n = labs.length;
        for (let i = 0; i < n; i++) { L += labs[i][0]; A += labs[i][1]; B += labs[i][2]; }
        return [L/n, A/n, B/n];
    }

    /* ════════════════════════════════
       Point d'entrée public
    ════════════════════════════════ */
    window.illuRemoveBackgroundGuided = function () {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode || !em.activeLayer || !em.activeLayer.buffer) {
            window.showIlluAlert && window.showIlluAlert(
                tKey('msg.removeBgPixel', 'Disponible en mode Pixel sur un calque bitmap.')
            );
            return;
        }
        if (em.activeProject && em.activeProject.role === 'layerAlphaMask') {
            window.showIlluAlert && window.showIlluAlert(
                tKey('msg.removeBgMask', 'Ouvrez le document principal.')
            );
            return;
        }
        const buf = em.activeLayer.buffer;
        if (buf.width < 2 || buf.height < 2) {
            window.showIlluAlert && window.showIlluAlert(tKey('msg.removeBgSize', 'Image trop petite.'));
            return;
        }
        show(buf);
    };
})();
