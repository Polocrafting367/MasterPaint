/**
 * GuidedCutoutTool.js
 * Outil de détourage intelligent par sélection guidée (Façon PowerPoint/Photoshop).
 * Algorithme : KNN Spatio-Chromatique + Analyse Basse Résolution & Lissage Blur.
 */
(function () {
    'use strict';

    const HINT_KEEP   = 1;
    const HINT_REMOVE = 2;

    const G = {
        active      : false,
        brushType   : HINT_REMOVE,
        brushSize   : 12,
        painting    : false,
        hints       : null,
        overlayCvs  : null,
        srcCvs      : null,
        w           : 0,
        h           : 0,
        previewCvs  : null, // Calque de prévisualisation (vert/bleu flouté)
        removalCvs  : null  // Masque binaire final avec lissage
    };

    function tKey(k, fb) {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t(k) : fb;
    }

    /* ── Overlay ── */
    function ensureOverlay() {
        if (G.overlayCvs) return;
        const mcc = document.getElementById('main-canvas-container');
        if (!mcc) return;
        const cvs = document.createElement('canvas');
        cvs.id = 'illu-cutout-guided-overlay';
        cvs.style.position = 'absolute'; cvs.style.left = '0'; cvs.style.top = '0';
        cvs.style.pointerEvents = 'none'; cvs.style.zIndex = '5';
        cvs.style.imageRendering = 'pixelated';
        mcc.appendChild(cvs); G.overlayCvs = cvs;
    }

    function removeOverlay() { if (G.overlayCvs) { G.overlayCvs.remove(); G.overlayCvs = null; } }
    
    function initHints(w, h) { 
        G.hints = new Uint8Array(w * h); 
        G.w = w; G.h = h; 
        G.previewCvs = null; 
        G.removalCvs = null; 
    }
    
    function clearAllHints() { 
        if (G.hints) G.hints.fill(0); 
        G.previewCvs = null; 
        G.removalCvs = null; 
        redrawOverlay(); 
    }

    /* ── Dessin overlay ── */
    function redrawOverlay() {
        const ov = G.overlayCvs; if (!ov) return;
        const ctx = ov.getContext('2d');
        ctx.clearRect(0, 0, G.w, G.h);
        
        // 1. Dessiner la prévisualisation calculée (si existante)
        if (G.previewCvs) {
            ctx.drawImage(G.previewCvs, 0, 0);
        }

        // 2. Dessiner les traits utilisateurs par-dessus
        if (!G.hints) return;
        
        // On passe par un canvas temporaire pour ne pas écraser la preview avec putImageData
        const hintCvs = document.createElement('canvas');
        hintCvs.width = G.w; hintCvs.height = G.h;
        const hCtx = hintCvs.getContext('2d');
        const hId = hCtx.createImageData(G.w, G.h);
        const hD = hId.data;
        for (let i = 0; i < G.hints.length; i++) {
            if (!G.hints[i]) continue;
            const b = i * 4;
            if (G.hints[i] === HINT_KEEP) {
                hD[b]=0; hD[b+1]=220; hD[b+2]=60; hD[b+3]=210;
            } else {
                hD[b]=240; hD[b+1]=30; hD[b+2]=30; hD[b+3]=210;
            }
        }
        hCtx.putImageData(hId, 0, 0);
        ctx.drawImage(hintCvs, 0, 0);
    }

    /* ── Coordonnées ── */
    function canvasToBuf(cx, cy) {
        const dc = document.getElementById('drawing-canvas'); if (!dc) return null;
        const r = dc.getBoundingClientRect();
        const px = Math.round((cx - r.left) * G.w / r.width);
        const py = Math.round((cy - r.top) * G.h / r.height);
        if (px < 0 || py < 0 || px >= G.w || py >= G.h) return null;
        return { x: px, y: py };
    }

    /* ── Strokes continus (Très rapide sans recalcul) ── */
    let _lastPaintPos = null;

    function brushDot(px, py, r, val) {
        for (let dy = -r; dy <= r; dy++)
            for (let dx = -r; dx <= r; dx++) {
                if (dx*dx+dy*dy > r*r) continue;
                const nx = px+dx, ny = py+dy;
                if (nx<0||ny<0||nx>=G.w||ny>=G.h) continue;
                G.hints[ny*G.w+nx] = val;
            }
    }

    function lineInterp(x0,y0,x1,y1,r,val) {
        const steps = Math.max(Math.abs(x1-x0), Math.abs(y1-y0));
        for (let s = 0; s <= steps; s++) {
            const t = steps === 0 ? 0 : s / steps;
            brushDot(Math.round(x0+(x1-x0)*t), Math.round(y0+(y1-y0)*t), r, val);
        }
    }

    // Mise à jour visuelle instantanée pendant le tracé (sans bloquer le fil JS)
    function fastOverlayStroke(p1, p2, type) {
        const ov = G.overlayCvs; if (!ov) return;
        const ctx = ov.getContext('2d');
        if (type === 0) {
            redrawOverlay(); // Redessine tout pour la gomme
            return;
        }
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = G.brushSize;
        ctx.strokeStyle = type === HINT_KEEP ? 'rgba(0,220,60,0.82)' : 'rgba(240,30,30,0.82)';
        ctx.beginPath();
        if (p1) {
            ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
        } else {
            ctx.moveTo(p2.x, p2.y); ctx.lineTo(p2.x+0.1, p2.y);
        }
        ctx.stroke();
    }

    function paintAt(cx, cy) {
        const p = canvasToBuf(cx, cy); if (!p) return;
        const r = Math.ceil(G.brushSize/2);
        if (_lastPaintPos) lineInterp(_lastPaintPos.x, _lastPaintPos.y, p.x, p.y, r, G.brushType);
        else brushDot(p.x, p.y, r, G.brushType);
        fastOverlayStroke(_lastPaintPos, p, G.brushType);
        _lastPaintPos = { x: p.x, y: p.y };
    }

    function eraseAt(cx, cy) {
        const p = canvasToBuf(cx, cy); if (!p) return;
        const r = Math.ceil(G.brushSize/2);
        if (_lastPaintPos) lineInterp(_lastPaintPos.x, _lastPaintPos.y, p.x, p.y, r, 0);
        else brushDot(p.x, p.y, r, 0);
        fastOverlayStroke(_lastPaintPos, p, 0);
        _lastPaintPos = { x: p.x, y: p.y };
    }

    /* ── Événements ── */
    function onPtrDown(e) {
        if (!G.active) return;
        // Garde de sécurité : si l'outil a changé (raccourci clavier, etc.), on stoppe automatiquement
        if (window.activeTool !== 'cutout') { window.illuGuidedCutoutToolStop(); return; }
        if (e.button && e.button !== 0) return;
        G.painting = true; _lastPaintPos = null;
        G.brushType === 0 ? eraseAt(e.clientX, e.clientY) : paintAt(e.clientX, e.clientY);
        e.preventDefault(); e.stopPropagation();
    }
    
    function onPtrMove(e) { 
        if (!G.active || window.activeTool !== 'cutout') { G.painting = false; return; }
        if (G.painting) {
            G.brushType===0 ? eraseAt(e.clientX,e.clientY) : paintAt(e.clientX,e.clientY); 
        }
    }
    
    // On lance l'analyse UNIQUEMENT quand le tracé est terminé
    function onPtrUp() { 
        if (G.painting) {
            G.painting = false; _lastPaintPos = null; 
            scheduleMaskUpdate(); 
        }
    }

    let _bD, _bM, _bU, _bCancel, _bToolChange;
    function onPtrCancel() { 
        if (G.painting) {
            G.painting = false; _lastPaintPos = null; 
            scheduleMaskUpdate(); 
        }
    }

    function bindCanvasEvents() {
        const dc = document.getElementById('drawing-canvas'); if (!dc) return;
        _bD = onPtrDown; _bU = onPtrUp; _bCancel = onPtrCancel;
        dc.addEventListener('pointerdown', _bD); dc.addEventListener('pointerup', _bU);
        dc.addEventListener('pointerleave', _bU); dc.addEventListener('pointercancel', _bCancel);
        _bM = onPtrMove; document.addEventListener('pointermove', _bM);
        // Cleanup immédiat quand l'utilisateur change d'outil via le sélecteur ou les boutons toolbox
        const ts = document.getElementById('illu-tool-list-select');
        if (ts) {
            _bToolChange = () => { if (ts.value !== 'cutout' && G.active) window.illuGuidedCutoutToolStop(); };
            ts.addEventListener('change', _bToolChange);
        }
        const box = document.getElementById('main-toolbox');
        if (box && !box._illuCutoutToolChangeBound) {
            box._illuCutoutToolChangeBound = true;
            box.addEventListener('pointerdown', () => {
                // Laisse le click se traiter d'abord, puis on vérifie
                setTimeout(() => { if (G.active && window.activeTool !== 'cutout') window.illuGuidedCutoutToolStop(); }, 0);
            }, true);
        }
    }
    
    function unbindCanvasEvents() {
        const dc = document.getElementById('drawing-canvas'); if (!dc) return;
        if (_bD) { dc.removeEventListener('pointerdown',_bD); try { document.releasePointerCapture&&document.releasePointerCapture(1); dc.releasePointerCapture&&dc.releasePointerCapture(1); } catch(_){} }
        if (_bU) { dc.removeEventListener('pointerup',_bU); dc.removeEventListener('pointerleave',_bU); }
        if (_bCancel) dc.removeEventListener('pointercancel',_bCancel);
        if (_bM) document.removeEventListener('pointermove',_bM);
        const ts = document.getElementById('illu-tool-list-select');
        if (ts && _bToolChange) ts.removeEventListener('change', _bToolChange);
        _bM=null;_bD=null;_bU=null;_bCancel=null;_bToolChange=null;
        const box = document.getElementById('main-toolbox');
        if (box) box._illuCutoutToolChangeBound = false;
    }

    /* ════════════════════════════════
       ALGORITHME KNN MULTI-WORKERS
       Résolution max/2 — poids couleur pur
    ════════════════════════════════ */

    /* ════ Pool Workers KNN (multi-cœurs) ════ */
    const NUM_WORKERS = Math.max(2, Math.min(8, (navigator.hardwareConcurrency || 4) - 1));
    let _workerPool = [], _knnBusy = false, _knnQueued = false;

    const _knnCode = `
const SW=0.05;
self.onmessage=function(e){
    const{td,th,sw,sh,ks,rs,y0,y1}=e.data;
    const K=1,R=2;
    const len=sw*(y1-y0);
    let raw=new Uint8Array(len);
    if(ks.length===0){self.postMessage({raw,y0,y1},[raw.buffer]);return;}
    if(rs.length===0){raw.fill(1);self.postMessage({raw,y0,y1},[raw.buffer]);return;}
    for(let y=y0;y<y1;y++){
        const ro=y*sw,li=(y-y0)*sw;
        for(let x=0;x<sw;x++){
            const i=ro+x,b=i*4;
            if(th[i]===K){raw[li+x]=1;continue;}
            if(th[i]===R){raw[li+x]=0;continue;}
            const r=td[b],g=td[b+1],bl=td[b+2];
            let mK=1e9,mR=1e9;
            for(let k=0;k<ks.length;k++){const s=ks[k];const d=Math.abs(r-s[0])*.3+Math.abs(g-s[1])*.59+Math.abs(bl-s[2])*.11+(Math.abs(x-s[3])+Math.abs(y-s[4]))*SW;if(d<mK)mK=d;}
            for(let k=0;k<rs.length;k++){const s=rs[k];const d=Math.abs(r-s[0])*.3+Math.abs(g-s[1])*.59+Math.abs(bl-s[2])*.11+(Math.abs(x-s[3])+Math.abs(y-s[4]))*SW;if(d<mR)mR=d;}
            raw[li+x]=(mK<=mR)?1:0;
        }
    }
    self.postMessage({raw,y0,y1},[raw.buffer]);
};`;

    function getWorkerPool() {
        while (_workerPool.length < NUM_WORKERS)
            _workerPool.push(new Worker(URL.createObjectURL(new Blob([_knnCode],{type:'application/javascript'}))));
        return _workerPool;
    }

    /* Extraction échantillons : tableau [r,g,b,x,y] pour transfer efficace */
    function extractSamplesArr(hints, data, w, h, targetHint, maxSamples) {
        let pool = [];
        for (let i = 0; i < w * h; i++) {
            if (hints[i] === targetHint)
                pool.push([data[i*4], data[i*4+1], data[i*4+2], i%w, Math.floor(i/w)]);
        }
        if (pool.length <= maxSamples) return pool;
        const ratio = pool.length / maxSamples;
        return Array.from({length: maxSamples}, (_,i) => pool[Math.floor(i*ratio)]);
    }

    let _updateTimer = 0;
    function scheduleMaskUpdate() {
        if (_updateTimer) clearTimeout(_updateTimer);
        _updateTimer = setTimeout(() => { _updateTimer = 0; performMaskUpdate(); }, 60);
    }

    function performMaskUpdate() {
        const em = window.EditorManager;
        if (!em || !em.activeLayer || !em.activeLayer.buffer || !G.hints) return;
        const srcBuf = em.activeLayer.buffer;
        const fullW = srcBuf.width, fullH = srcBuf.height;

        const hasKeep = G.hints.some(v => v === HINT_KEEP);
        const hasRemove = G.hints.some(v => v === HINT_REMOVE);
        if (!hasKeep && !hasRemove) { G.previewCvs=null; G.removalCvs=null; redrawOverlay(); return; }

        // KNN à max/2 (perf) — la frontière est rattrapée par blur+seuillage
        const MAX_DIM = Math.round(Math.max(fullW, fullH) / 2);
        let sw=fullW, sh=fullH;
        let tinyData, tinyHints;
        if (fullW <= MAX_DIM && fullH <= MAX_DIM) {
            const ctx0 = srcBuf.getContext('2d', { willReadFrequently: true });
            tinyData = new Uint8Array(ctx0.getImageData(0,0,fullW,fullH).data.buffer);
            tinyHints = new Uint8Array(G.hints);
        } else {
            const scale = MAX_DIM / Math.max(fullW, fullH);
            sw = Math.round(fullW * scale); sh = Math.round(fullH * scale);
            const tmpC = document.createElement('canvas'); tmpC.width=sw; tmpC.height=sh;
            const tmpX = tmpC.getContext('2d');
            tmpX.drawImage(srcBuf, 0, 0, sw, sh);
            tinyData = new Uint8Array(tmpX.getImageData(0,0,sw,sh).data.buffer);
            tinyHints = new Uint8Array(sw * sh);
            for (let y=0; y<fullH; y++) {
                const ty = Math.min(sh-1, Math.floor(y*sh/fullH));
                const ro=y*fullW, tyo=ty*sw;
                for (let x=0; x<fullW; x++) {
                    const hv = G.hints[ro+x];
                    if (hv) { const tx=Math.min(sw-1,Math.floor(x*sw/fullW)); tinyHints[tyo+tx]=hv; }
                }
            }
        }

        // 2. Échantillons KNN (250 max de chaque côté)
        const ks = extractSamplesArr(tinyHints, tinyData, sw, sh, HINT_KEEP, 250);
        const rs = extractSamplesArr(tinyHints, tinyData, sw, sh, HINT_REMOVE, 250);

        if (_knnBusy) { _knnQueued = true; return; }
        _knnBusy = true;

        const _sw=sw, _sh=sh, _fW=fullW, _fH=fullH;
        const workers = getWorkerPool();
        const N = workers.length;
        const bands = Array.from({length:N}, (_,wi) => ({
            y0: Math.floor(wi*sh/N), y1: Math.floor((wi+1)*sh/N)
        }));
        const results = new Array(N);
        let done = 0;

        for (let wi = 0; wi < N; wi++) {
            const {y0, y1} = bands[wi];
            const tdCopy = wi < N-1 ? new Uint8Array(tinyData) : tinyData;
            const thCopy = wi < N-1 ? new Uint8Array(tinyHints) : tinyHints;
            const _wi = wi;
            workers[wi].onmessage = function(ev) {
                results[_wi] = ev.data;
                if (++done < N) return;
                _knnBusy = false;
                if (!G.active) return;
                const fullMask = new Uint8Array(_sw * _sh);
                for (let r=0; r<N; r++) {
                    const rd = results[r], bH = rd.y1 - rd.y0;
                    for (let ry=0; ry<bH; ry++)
                        fullMask.set(rd.raw.subarray(ry*_sw, (ry+1)*_sw), (rd.y0+ry)*_sw);
                }
                buildPreviewFromMask(fullMask, _sw, _sh, _fW, _fH);
                if (_knnQueued) { _knnQueued=false; scheduleMaskUpdate(); }
            };
            workers[wi].postMessage({td:tdCopy,th:thCopy,sw,sh,ks,rs,y0,y1}, [tdCopy.buffer,thCopy.buffer]);
        }
    }

    function buildPreviewFromMask(rawMask, sw, sh, fullW, fullH) {
        // 1. Masque binaire en niveaux de gris (blanc=garder, noir=supprimer) à résolution KNN
        const mc = document.createElement('canvas'); mc.width=sw; mc.height=sh;
        const mCtx = mc.getContext('2d', {willReadFrequently:true});
        const mId = mCtx.createImageData(sw,sh), mD = mId.data;
        for (let i=0; i<sw*sh; i++) {
            const b=i*4, v=rawMask[i]===1?255:0;
            mD[b]=mD[b+1]=mD[b+2]=v; mD[b+3]=255;
        }
        mCtx.putImageData(mId,0,0);

        // 2. Blur à résolution KNN → frontières douces
        const blurPx = Math.max(2, Math.round(Math.min(sw,sh)/100));
        const bc = document.createElement('canvas'); bc.width=sw; bc.height=sh;
        const bCtx = bc.getContext('2d', {willReadFrequently:true});
        bCtx.filter=`blur(${blurPx}px)`; bCtx.drawImage(mc,0,0); bCtx.filter='none';
        const bd = bCtx.getImageData(0,0,sw,sh).data;

        // 3. Seuillage : > 127 = garder, sinon = supprimer → délimitation nette
        const thId=mCtx.createImageData(sw,sh), thD=thId.data;
        const rbId=mCtx.createImageData(sw,sh), rbD=rbId.data;
        for (let i=0; i<sw*sh; i++) {
            const b=i*4;
            if (bd[b]>127) {
                thD[b]=40;thD[b+1]=210;thD[b+2]=80;thD[b+3]=110;
            } else {
                thD[b]=230;thD[b+1]=30;thD[b+2]=30;thD[b+3]=130;
                rbD[b]=rbD[b+1]=rbD[b+2]=rbD[b+3]=255;
            }
        }
        mCtx.putImageData(thId,0,0);

        // 4. Upscale → pleine résolution (interpolation bilinéaire = douceur aux bords)
        const fp = document.createElement('canvas'); fp.width=fullW; fp.height=fullH;
        fp.getContext('2d').drawImage(mc,0,0,fullW,fullH);

        // 5. Masque suppression : upscale + 1px blur pour anti-aliasing applyCutout
        const rm = document.createElement('canvas'); rm.width=sw; rm.height=sh;
        rm.getContext('2d').putImageData(rbId,0,0);
        const fr = document.createElement('canvas'); fr.width=fullW; fr.height=fullH;
        const frX=fr.getContext('2d',{willReadFrequently:true});
        frX.filter='blur(1px)'; frX.drawImage(rm,0,0,fullW,fullH);

        G.previewCvs=fp; G.removalCvs=fr;
        redrawOverlay();
    }

    /* ── Application finale avec anti-aliasing réel ── */
    function applyCutout() {
        const em = window.EditorManager;
        if (!em || !em.activeLayer || !G.removalCvs) return false;

        const buf = em.activeLayer.buffer;
        const fullW = buf.width, fullH = buf.height;

        // removalCvs est déjà à pleine résolution (fullW × fullH) avec blur CSS appliqué
        // → l'alpha encode l'intensité d'effacement (0 = garder, 255 = effacer totalement)
        const rmCtx = G.removalCvs.getContext('2d', { willReadFrequently: true });
        const maskData = rmCtx.getImageData(0, 0, G.removalCvs.width, G.removalCvs.height).data;
        const mW = G.removalCvs.width, mH = G.removalCvs.height;

        const ctx = buf.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, fullW, fullH);
        const data = imgData.data;

        for (let y = 0; y < fullH; y++) {
            const my = Math.min(mH-1, Math.round(y * mH / fullH));
            const ro = y * fullW, mro = my * mW;
            for (let x = 0; x < fullW; x++) {
                const mx = Math.min(mW-1, Math.round(x * mW / fullW));
                // L'alpha du masque de suppression = degré d'effacement (0→garder, 255→effacer)
                const removeA = maskData[(mro + mx) * 4 + 3];
                if (removeA > 0) {
                    const pIdx = (ro + x) * 4;
                    // Anti-aliasing : alpha source réduit proportionnellement
                    data[pIdx + 3] = Math.round(data[pIdx + 3] * (1 - removeA / 255));
                }
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return true;
    }
    /* ════════════════════════════════
       API publique
    ════════════════════════════════ */
    window.illuGuidedCutoutToolStart = function () {
        const em = window.EditorManager;
        if (!em || !em.isPixelMode || !em.activeLayer || !em.activeLayer.buffer) {
            window.showIlluAlert && window.showIlluAlert(tKey('msg.removeBgPixel', 'Disponible en mode Pixel sur un calque bitmap.'));
            return;
        }
        if (em.activeProject && em.activeProject.role === 'layerAlphaMask') {
            window.showIlluAlert && window.showIlluAlert(tKey('msg.removeBgMask', 'Ouvrez le document principal.'));
            return;
        }
        const buf = em.activeLayer.buffer;
        if (buf.width < 2 || buf.height < 2) {
            window.showIlluAlert && window.showIlluAlert(tKey('msg.removeBgSize', 'Image trop petite.'));
            return;
        }
        if (G.active) window.illuGuidedCutoutToolStop();

        const w = buf.width, h = buf.height;
        G.srcCvs = buf; G.active = true; G.brushType = HINT_REMOVE;
        ensureOverlay(); initHints(w, h);

        const dc = document.getElementById('drawing-canvas');
        if (G.overlayCvs && dc) {
            G.overlayCvs.width = w; G.overlayCvs.height = h;
            G.overlayCvs.style.width = dc.style.width || w + 'px';
            G.overlayCvs.style.height = dc.style.height || h + 'px';
        }
        bindCanvasEvents(); showCutoutToolbar(); redrawOverlay();
        // L'utilisateur dessine ses zones librement — pas d'analyse auto

        window._illuCutoutActive = true; window.activeTool = 'cutout';
        const ts = document.getElementById('illu-tool-list-select');
        if (ts && ts.value !== 'cutout') ts.value = 'cutout';
        const box = document.getElementById('main-toolbox');
        if (box) box.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        em.render && em.render();
    };

    window.illuGuidedCutoutToolStop = function () {
        G.active = false; G.painting = false; G.hints = null; G.srcCvs = null;
        G.previewCvs = null; G.removalCvs = null;
        unbindCanvasEvents(); removeOverlay(); hideCutoutToolbar();
        window._illuCutoutActive = false;
        if (window.activeTool === 'cutout') window.activeTool = 'select';
        const ts = document.getElementById('illu-tool-list-select');
        if (ts && ts.value === 'cutout') ts.value = 'select';
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
    };

    window.illuGuidedCutoutToolApply = function () {
        if (!G.active) return;
        const success = applyCutout();
        if (success) {
            const em = window.EditorManager;
            if (em) { em.saveHistory(tKey('history.guidedRemoveBg', 'Détourage guidé'), { patchActiveLayer: true }); em.render({ flushUiThumbnails: true }); }
        }
        window.illuGuidedCutoutToolStop();
    };

    window.illuGuidedCutoutSetBrush = function (type) {
        G.brushType = type === 'keep' ? HINT_KEEP : type === 'remove' ? HINT_REMOVE : 0;
        updateCutoutToolbarActiveBrush();
    };
    window.illuGuidedCutoutSetBrushSize = function (size) { G.brushSize = Math.max(3, Math.min(120, parseInt(size,10)||12)); };
    window.illuGuidedCutoutClearAll = function () { clearAllHints(); };

    /* ── toolbar ── */
    function showCutoutToolbar() { const b = document.getElementById('opt-grp-cutout-guided'); if (b) b.hidden = false; updateCutoutToolbarActiveBrush(); }
    function hideCutoutToolbar() { const b = document.getElementById('opt-grp-cutout-guided'); if (b) b.hidden = true; }
    function updateCutoutToolbarActiveBrush() {
        ['keep','remove','erase'].forEach(t => {
            const btn = document.getElementById('illu-cutout-btn-'+t);
            if (!btn) return;
            const isActive = (t==='keep'&&G.brushType===HINT_KEEP)||(t==='remove'&&G.brushType===HINT_REMOVE)||(t==='erase'&&G.brushType===0);
            /* Style ruban standard : illu-icon-toggle--on + aria-pressed */
            btn.classList.toggle('illu-icon-toggle--on', isActive);
            btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
        const dc = document.getElementById('drawing-canvas');
        if (dc) dc.style.cursor = G.brushType===HINT_KEEP?'crosshair':G.brushType===HINT_REMOVE?'cell':'default';
    }


    /* ── wire ── */
    function initDom() {
        ['keep','remove','erase'].forEach(t => {
            const btn = document.getElementById('illu-cutout-btn-'+t);
            if (btn) btn.addEventListener('click', () => window.illuGuidedCutoutSetBrush(t));
        });
        const sld = document.getElementById('illu-cutout-brush-size'), sv = document.getElementById('illu-cutout-brush-size-val');
        if (sld) sld.addEventListener('input', () => { const v = parseInt(sld.value,10); if (sv) sv.textContent = v; window.illuGuidedCutoutSetBrushSize(v); });
        const clr = document.getElementById('illu-cutout-btn-clear');
        if (clr) clr.addEventListener('click', () => window.illuGuidedCutoutClearAll());
        const ap = document.getElementById('illu-cutout-btn-apply');
        if (ap) ap.addEventListener('click', () => window.illuGuidedCutoutToolApply());
        const cn = document.getElementById('illu-cutout-btn-cancel');
        if (cn) cn.addEventListener('click', () => window.illuGuidedCutoutToolStop());
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDom);
    else initDom();
})();