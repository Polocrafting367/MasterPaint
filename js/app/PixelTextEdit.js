/**
 * PixelTextEdit.js — Édition texte inline sur le canevas (aperçu live, validation au clic ailleurs / changement d’outil).
 */
(function () {
    let session = null;
    let savedSelectionRange = null;

    function saveEditorSelection() {
        if (!session || !session.el || document.activeElement !== session.el) return;
        const sel = window.getSelection && window.getSelection();
        if (!sel || sel.rangeCount < 1) return;
        try {
            savedSelectionRange = sel.getRangeAt(0).cloneRange();
        } catch (e) {
            savedSelectionRange = null;
        }
    }

    function restoreEditorSelection() {
        if (!session || !session.el || !savedSelectionRange || !window.getSelection) return;
        try {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedSelectionRange);
        } catch (e) {
            /* ignore */
        }
    }

    function refocusEditorAfterUiChange() {
        if (!session || !session.el) return;
        const el = session.el;
        requestAnimationFrame(() => {
            if (!session || session.el !== el || !el.isConnected) return;
            try {
                el.focus({ preventScroll: true });
            } catch (e) {
                try {
                    el.focus();
                } catch (e2) {
                    /* ignore */
                }
            }
            restoreEditorSelection();
        });
    }

    /** Clic / focus sur la barre d’options ou le corps de la palette couleurs : ne pas valider l’édition texte pixel. */
    function isChromeKeepTextSession(target) {
        if (!target || !target.closest) return false;
        if (
            target.closest('#tool-options-container') ||
            target.closest('#tool-options-bar') ||
            target.closest('#tool-options-bar-2') ||
            target.closest('#tool-context-bar')
        ) {
            return true;
        }
        if (target.closest('#win-colors')) return true;
        if (target.closest('.illu-gauge-step')) return true;
        return false;
    }

    window.extendPixelTextEditorIgnoreBlur = function (ms) {
        if (!session) return;
        const dur = typeof ms === 'number' && ms > 0 ? ms : 2500;
        session.ignoreBlurUntil = performance.now() + dur;
    };

    document.addEventListener(
        'mousedown',
        (e) => {
            if (!session || !session.el) return;
            const t = e.target;
            if (t && t.closest && t.closest('#tool-options-bar')) {
                saveEditorSelection();
                session.ignoreBlurUntil = performance.now() + 800;
            }
            if (t.closest && t.closest('.palette-panel .title-bar') && !t.closest('button')) {
                session.ignoreBlurUntil = performance.now() + 600;
            }
        },
        true
    );

    function colorToCss(c) {
        if (typeof c === 'string') return c;
        if (c && c.r != null) {
            const a = c.a != null ? c.a / 255 : 1;
            return `rgba(${c.r},${c.g},${c.b},${a})`;
        }
        return '#000000';
    }

    function secondaryCss() {
        const s = EditorManager.secondaryColor;
        if (!s) return '#000000';
        if (typeof EditorManager.cssRgbaFromPart === 'function') {
            return EditorManager.cssRgbaFromPart(s);
        }
        const a = s.a != null ? s.a / 255 : 1;
        return `rgba(${s.r},${s.g},${s.b},${a})`;
    }

    function textLineHeightPx(size) {
        return Math.round(size * 1.25);
    }

    window.syncPixelTextEditorStyles = function () {
        if (!session || !session.el) return;
        window.extendPixelTextEditorIgnoreBlur(2500);
        const el = session.el;
        const tp = EditorManager.toolProps;
        const size = tp.textSize || 18;
        const lh = textLineHeightPx(size);
        const fam = tp.textFont || 'Arial, sans-serif';
        el.style.fontSize = size + 'px';
        el.style.lineHeight = lh + 'px';
        el.style.fontFamily = fam;
        el.style.padding = '0';
        el.style.margin = '0';
        el.style.fontWeight = tp.textBold ? 'bold' : 'normal';
        el.style.fontStyle = tp.textItalic ? 'italic' : 'normal';
        const ft = tp.textFillType || 'solid';
        if (ft === 'none') {
            el.style.color = 'transparent';
        } else if (ft === 'gradient') {
            el.style.color = colorToCss(EditorManager.activeColor);
            el.style.backgroundImage = `linear-gradient(90deg, ${colorToCss(EditorManager.activeColor)}, ${secondaryCss()})`;
            el.style.webkitBackgroundClip = 'text';
            el.style.backgroundClip = 'text';
            el.style.webkitTextFillColor = 'transparent';
        } else {
            el.style.backgroundImage = '';
            el.style.webkitBackgroundClip = '';
            el.style.backgroundClip = '';
            el.style.webkitTextFillColor = '';
            el.style.color = colorToCss(EditorManager.activeColor);
        }
        const sw = Math.max(1, tp.textStrokeWidth || 2);
        if (tp.textStroke) {
            el.style.webkitTextStroke = `${sw}px ${secondaryCss()}`;
            el.style.paintOrder = 'stroke fill';
        } else {
            el.style.webkitTextStroke = '0 transparent';
        }
        refocusEditorAfterUiChange();
    };

    function removeSessionEl() {
        if (session && session.wrap && session.wrap.parentNode) {
            session.wrap.parentNode.removeChild(session.wrap);
        } else if (session && session.el && session.el.parentNode) {
            session.el.parentNode.removeChild(session.el);
        }
        session = null;
        savedSelectionRange = null;
    }

    function quoteCanvasFontStack(stack) {
        const parts = String(stack || 'sans-serif')
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (parts.length === 0) return 'sans-serif';
        if (/\s/.test(parts[0])) parts[0] = `"${parts[0].replace(/"/g, '')}"`;
        return parts.join(', ');
    }

    function drawTextToLayer(layerX, layerY, text) {
        const l = EditorManager.activeLayer;
        if (!l || !l.buffer) return;
        const ctx = l.buffer.getContext('2d', { willReadFrequently: true });
        const tp = EditorManager.toolProps;
        const size = tp.textSize || 18;
        const fam = quoteCanvasFontStack(tp.textFont || 'Arial, sans-serif');
        const weight = tp.textBold ? 'bold' : 'normal';
        const style = tp.textItalic ? 'italic' : 'normal';
        ctx.font = `${style} ${weight} ${size}px ${fam}`;
        ctx.textBaseline = 'top';
        const lines = text.length ? text.split('\n') : [''];
        const lineHeight = textLineHeightPx(size);
        const primary = colorToCss(EditorManager.activeColor);
        const sec = secondaryCss();
        const ft = tp.textFillType || 'solid';
        const stroke = !!tp.textStroke;
        const sw = Math.max(1, tp.textStrokeWidth || 2);

        let maxW = 0;
        lines.forEach((line) => {
            maxW = Math.max(maxW, ctx.measureText(line || ' ').width);
        });

        const drawX = Math.round(layerX);
        const drawY = Math.round(layerY);
        lines.forEach((line, i) => {
            const yy = drawY + i * lineHeight;
            if (stroke) {
                ctx.strokeStyle = sec;
                ctx.lineWidth = sw;
                ctx.lineJoin = 'round';
                ctx.strokeText(line, drawX, yy);
            }
            if (ft === 'none') {
                /* contour seul */
            } else if (ft === 'gradient') {
                const grad = ctx.createLinearGradient(drawX, yy, drawX + Math.max(maxW, 8), yy + lineHeight);
                grad.addColorStop(0, primary);
                grad.addColorStop(1, sec);
                ctx.fillStyle = grad;
                ctx.fillText(line, drawX, yy);
            } else {
                ctx.fillStyle = primary;
                ctx.fillText(line, drawX, yy);
            }
        });
    }

    window.hasActivePixelTextSession = function () {
        return !!(session && session.el && session.el.isConnected);
    };

    window.commitPixelTextSession = function (force) {
        if (!session) return;
        if (!force && session.ignoreBlurUntil && performance.now() < session.ignoreBlurUntil) return;
        const el = session.el;
        const raw = el.innerText.replace(/\u00a0/g, ' ');
        const text = raw.replace(/\n+$/, '');
        const lx = session.layerX;
        const ly = session.layerY;
        removeSessionEl();
        if (text.length > 0) {
            drawTextToLayer(lx, ly, text);
            EditorManager.saveHistory('Texte', { patchActiveLayer: true });
        }
        EditorManager.render();
    };

    /** Clic en dehors de la zone d’édition : valider le texte avant les autres outils. */
    window.preparePixelTextForMouseDown = function (e) {
        if (!session || !session.el) return;
        if (session.ignoreBlurUntil && performance.now() < session.ignoreBlurUntil) return;
        const t = e.target;
        if (t && t.closest && t.closest('.illu-pixel-text-wrap')) return;
        const r = session.el.getBoundingClientRect();
        const inside =
            e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
        if (!inside && isChromeKeepTextSession(e.target)) return;
        if (!inside) window.commitPixelTextSession();
    };

    /** Clic à l’intérieur de l’éditeur : ne pas lancer d’autre outil. */
    window.pixelTextEditorHandlesMouseDown = function (e) {
        if (!session || !session.el) return false;
        const t = e.target;
        if (t && t.closest && t.closest('.illu-pixel-text-wrap')) {
            if (session.el && session.el.focus) session.el.focus();
            return true;
        }
        return false;
    };

    function moveBtnTitle() {
        return window.IlluI18n && typeof window.IlluI18n.t === 'function'
            ? window.IlluI18n.t('pixelText.moveBtn')
            : 'Déplacer le texte (glisser)';
    }

    window.beginPixelTextSession = function (worldX, worldY) {
        window.commitPixelTextSession(true);
        const l = EditorManager.activeLayer;
        if (!l) return;
        const container = document.getElementById('main-canvas-container');
        if (!container) return;

        const wrap = document.createElement('div');
        wrap.className = 'illu-pixel-text-wrap';
        wrap.style.cssText = [
            'position:absolute',
            `left:${worldX}px`,
            `top:${worldY}px`,
            'z-index:25',
            'display:block',
            'max-width:90%',
            'pointer-events:none'
        ].join(';');

        const moveBtn = document.createElement('button');
        moveBtn.type = 'button';
        moveBtn.className = 'illu-pixel-text-move-btn';
        moveBtn.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right" aria-hidden="true"></i>';
        moveBtn.setAttribute('aria-label', moveBtnTitle());
        moveBtn.title = moveBtnTitle();
        moveBtn.style.cssText = [
            'position:absolute',
            'right:0',
            'bottom:100%',
            'margin-bottom:2px',
            'pointer-events:auto'
        ].join(';');

        const el = document.createElement('div');
        el.setAttribute('contenteditable', 'true');
        el.setAttribute('spellcheck', 'false');
        const initSize = EditorManager.toolProps.textSize || 18;
        const initLh = textLineHeightPx(initSize);
        el.style.cssText = [
            'min-width:32px',
            'min-height:' + initLh + 'px',
            'outline:1px dashed #0066cc',
            'background:rgba(255,255,255,0.02)',
            'pointer-events:auto',
            'white-space:pre-wrap',
            'word-break:break-word',
            'width:100%',
            'display:block',
            'padding:0',
            'margin:0',
            'box-sizing:border-box',
            'line-height:' + initLh + 'px'
        ].join(';');

        wrap.appendChild(moveBtn);
        wrap.appendChild(el);
        container.appendChild(wrap);

        const docX = Math.round(worldX);
        const docY = Math.round(worldY);
        session = {
            el,
            wrap,
            layerX: docX - l.x,
            layerY: docY - l.y,
            ignoreBlurUntil: performance.now() + 450
        };
        wrap.style.left = `${docX}px`;
        wrap.style.top = `${docY}px`;

        function setDocPosition(docX, docY) {
            const layer = EditorManager.activeLayer;
            if (!session || !layer) return;
            const rx = Math.round(docX);
            const ry = Math.round(docY);
            session.layerX = rx - layer.x;
            session.layerY = ry - layer.y;
            wrap.style.left = `${rx}px`;
            wrap.style.top = `${ry}px`;
        }

        let textDrag = null;
        moveBtn.addEventListener('pointerdown', (ev) => {
            if (ev.button !== 0) return;
            ev.preventDefault();
            ev.stopPropagation();
            saveEditorSelection();
            session.ignoreBlurUntil = performance.now() + 60000;
            moveBtn.style.cursor = 'grabbing';
            const startDoc = EditorManager.logicalPointerFromClientXY(ev.clientX, ev.clientY);
            const startLeft = parseFloat(wrap.style.left) || worldX;
            const startTop = parseFloat(wrap.style.top) || worldY;
            textDrag = {
                pid: ev.pointerId,
                sx: startDoc.x,
                sy: startDoc.y,
                ox: startLeft,
                oy: startTop
            };
            try {
                moveBtn.setPointerCapture(ev.pointerId);
            } catch (err) {
                /* ignore */
            }
        });
        moveBtn.addEventListener('pointermove', (ev) => {
            if (!textDrag || textDrag.pid !== ev.pointerId) return;
            ev.preventDefault();
            const p = EditorManager.logicalPointerFromClientXY(ev.clientX, ev.clientY);
            const nx = textDrag.ox + (p.x - textDrag.sx);
            const ny = textDrag.oy + (p.y - textDrag.sy);
            setDocPosition(nx, ny);
        });
        const endTextDrag = (ev) => {
            if (!textDrag || textDrag.pid !== ev.pointerId) return;
            try {
                moveBtn.releasePointerCapture(ev.pointerId);
            } catch (err) {
                /* ignore */
            }
            textDrag = null;
            moveBtn.style.cursor = 'grab';
            refocusEditorAfterUiChange();
        };
        moveBtn.addEventListener('pointerup', endTextDrag);
        moveBtn.addEventListener('pointercancel', endTextDrag);

        window.syncPixelTextEditorStyles();
        const doFocus = () => {
            el.focus();
            if (window.getSelection && document.createRange) {
                const r = document.createRange();
                r.selectNodeContents(el);
                r.collapse(false);
                const s = window.getSelection();
                s.removeAllRanges();
                s.addRange(r);
            }
        };
        requestAnimationFrame(() => requestAnimationFrame(doFocus));
        el.addEventListener('keyup', saveEditorSelection);
        el.addEventListener('mouseup', saveEditorSelection);
        el.addEventListener('input', saveEditorSelection);

        const onBlur = () => {
            setTimeout(() => {
                if (!session || session.el !== el) return;
                if (session.ignoreBlurUntil && performance.now() < session.ignoreBlurUntil) return;
                const ae = document.activeElement;
                if (ae === el || (ae && el.contains(ae))) return;
                if (ae === moveBtn || (ae && wrap.contains(ae))) return;
                if (ae && isChromeKeepTextSession(ae)) return;
                window.commitPixelTextSession();
            }, 0);
        };
        el.addEventListener('blur', onBlur);
        session.onBlur = onBlur;

        el.addEventListener('keydown', (ev) => {
            if (ev.key === 'Escape') {
                ev.preventDefault();
                window.commitPixelTextSession(true);
            }
        });
    };
})();
