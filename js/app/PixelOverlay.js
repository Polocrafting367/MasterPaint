/**
 * PixelOverlay.js — Dégradé éditable (2 points), formes éditables (poignées), nettoyage à changement d’outil.
 */
(function () {
    /** ~14 px à l’écran, en coordonnées document (pour hit test avec zoom). */
    function hitRadiusDoc() {
        return 14 / (EditorManager.getCanvasZoomLevel() || 1);
    }

    window._pixelGradientState = null;
    window._gradientHandleDrag = null;
    window._gradientNewDrag = false;
    window._gradientBackup = null;

    window.pixelShapeEdit = null;
    window.shapeHandleDrag = null;

    window.clearPixelToolSessions = function () {
        window._pixelGradientState = null;
        window._gradientHandleDrag = null;
        window._gradientNewDrag = false;
        window._gradientBackup = null;
        window.pixelShapeEdit = null;
        window.shapeHandleDrag = null;
        window._shapeBackupCanvas = null;
        if (typeof window.cancelSelectionInteractionState === 'function') window.cancelSelectionInteractionState();
    };

    function dist(ax, ay, bx, by) {
        const dx = ax - bx, dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    window.cloneLayerBuffer = function (buf) {
        const c = document.createElement('canvas');
        c.width = buf.width;
        c.height = buf.height;
        c.getContext('2d', { willReadFrequently: true }).drawImage(buf, 0, 0);
        return c;
    };

    function getSelectionLayerClip() {
        const sb = window.selectionBounds;
        const ov = document.getElementById('selection-overlay');
        if (!sb || !ov || ov.style.display === 'none' || window.selectionInverted) return null;
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
            return {
                type: 'lasso',
                points: window.selectionLassoPoints.map((p) => ({ x: p.x - lx, y: p.y - ly }))
            };
        }
        if (
            window.selectionKind === 'color' &&
            window.selectionColorMask &&
            EditorManager.colorMaskMatchesActiveLayer(window.selectionColorMask)
        ) {
            return { type: 'color', mask: window.selectionColorMask };
        }
        return { type: 'rect', x: sb.x - lx, y: sb.y - ly, w: sb.w, h: sb.h };
    }

    window.paintGradientFromState = function () {
        const st = window._pixelGradientState;
        if (!st || !EditorManager.activeLayer || st.layerId !== EditorManager.activeLayer.id) return;
        const buf = EditorManager.activeLayer.buffer;
        const ctx = buf.getContext('2d', { willReadFrequently: true });
        ctx.clearRect(0, 0, buf.width, buf.height);
        ctx.drawImage(st.backup, 0, 0);
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        const x0 = st.x0 - lx;
        const y0 = st.y0 - ly;
        const x1 = st.x1 - lx;
        const y1 = st.y1 - ly;
        const gradType = st.gradType || 'linear';
        ctx.save();
        const clip = st.selectionClip;
        if (clip) {
            ctx.beginPath();
            if (clip.type === 'lasso' && clip.points && clip.points.length >= 3) {
                clip.points.forEach((p, i) => {
                    if (i === 0) ctx.moveTo(p.x, p.y);
                    else ctx.lineTo(p.x, p.y);
                });
                ctx.closePath();
            } else if (clip.type === 'color' && clip.mask && EditorManager.colorMaskMatchesActiveLayer(clip.mask)) {
                EditorManager.appendColorMaskRectsToPath(ctx, clip.mask);
            } else {
                ctx.rect(clip.x, clip.y, clip.w, clip.h);
            }
            ctx.clip();
        }
        let grad;
        const method = st.gradMethod || 'simple';
        
        if (gradType === 'linear') {
            grad = ctx.createLinearGradient(x0, y0, x1, y1);
        } else {
            const r = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0));
            grad = ctx.createRadialGradient(x0, y0, 0, x0, y0, r || 1);
        }

        const c0 = EditorManager.activeColor;
        const sec =
            EditorManager.secondaryColor && typeof EditorManager.cssRgbaFromPart === 'function'
                ? EditorManager.cssRgbaFromPart(EditorManager.secondaryColor)
                : EditorManager.secondaryColor
                  ? `rgba(${EditorManager.secondaryColor.r},${EditorManager.secondaryColor.g},${EditorManager.secondaryColor.b},${
                        (EditorManager.secondaryColor.a != null ? EditorManager.secondaryColor.a : 255) / 255
                    })`
                  : '#ffffff';

        if (method === 'smart') {
            // Helper extrêmement robuste pour parser n'importe quelle couleur (hex, rgb, rgba, objet) en RGB
            const parseToRgb = (c) => {
                if (!c) return { r: 255, g: 255, b: 255, a: 255 };
                if (typeof c === 'object') {
                    return {
                        r: c.r ?? 255,
                        g: c.g ?? 255,
                        b: c.b ?? 255,
                        a: c.a != null ? c.a : 255
                    };
                }
                if (typeof c === 'string') {
                    const trimmed = c.trim().toLowerCase();
                    if (trimmed.startsWith('#')) {
                        let h = trimmed.replace(/^#/, '');
                        if (h.length === 3) h = h.split('').map(x => x + x).join('');
                        const n = parseInt(h, 16);
                        return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 255 };
                    }
                    if (trimmed.startsWith('rgb')) {
                        const parts = trimmed.match(/[\d\.]+/g);
                        if (parts && parts.length >= 3) {
                            return {
                                r: parseInt(parts[0], 10),
                                g: parseInt(parts[1], 10),
                                b: parseInt(parts[2], 10),
                                a: parts[3] != null ? Math.round(parseFloat(parts[3]) * 255) : 255
                            };
                        }
                    }
                }
                return { r: 255, g: 255, b: 255, a: 255 };
            };

            const rgb0 = parseToRgb(c0);
            const rgb1 = parseToRgb(sec);
            
            const hsv0 = EditorManager.rgbToHsv(rgb0.r, rgb0.g, rgb0.b);
            const hsv1 = EditorManager.rgbToHsv(rgb1.r, rgb1.g, rgb1.b);
            
            // Determine shortest path for hue on the HSL/HSV circle (0-360)
            let h0 = hsv0.h;
            let h1 = hsv1.h;
            let dh = h1 - h0;
            if (dh > 180) h1 -= 360;
            else if (dh < -180) h1 += 360;

            for (let i = 0; i <= 10; i++) {
                const t = i / 10;
                const h = (h0 + t * (h1 - h0) + 360) % 360;
                const s = hsv0.s + t * (hsv1.s - hsv0.s);
                const v = hsv0.v + t * (hsv1.v - hsv0.v);
                const rgb = EditorManager.hsvToRgb(h, s, v);
                const a = rgb0.a * (1 - t) + rgb1.a * t;
                grad.addColorStop(t, `rgba(${rgb.r},${rgb.g},${rgb.b},${a/255})`);
            }
        } else {
            grad.addColorStop(0, c0);
            grad.addColorStop(1, sec);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, buf.width, buf.height);
        ctx.restore();
        EditorManager.render();
    };

    window.hitGradientHandle = function (worldX, worldY) {
        const st = window._pixelGradientState;
        if (!st || !EditorManager.activeLayer || st.layerId !== EditorManager.activeLayer.id) return null;
        const hr = hitRadiusDoc();
        if (dist(worldX, worldY, st.x0, st.y0) <= hr) return 0;
        if (dist(worldX, worldY, st.x1, st.y1) <= hr) return 1;
        return null;
    };

    window.beginNewGradientDrag = function (x, y) {
        if (!EditorManager.activeLayer) return;
        window._gradientBackup = window.cloneLayerBuffer(EditorManager.activeLayer.buffer);
        window._gradientNewDrag = true;
        // Initialise l'état immédiatement pour que les poignées s'affichent durant le tracé
        window._pixelGradientState = {
            layerId: EditorManager.activeLayer.id,
            backup: window._gradientBackup,
            x0: x, y0: y, x1: x, y1: y,
            gradType: document.getElementById('tool-gradient-type') ? document.getElementById('tool-gradient-type').value : 'linear',
            gradMethod: document.getElementById('tool-gradient-method') ? document.getElementById('tool-gradient-method').value : 'simple',
            selectionClip: getSelectionLayerClip()
        };
    };

    window.finishNewGradientDrag = function (x0, y0, x1, y1) {
        const clip = getSelectionLayerClip();
        window._pixelGradientState = {
            layerId: EditorManager.activeLayer.id,
            backup: window._gradientBackup,
            x0, y0, x1, y1,
            gradType: document.getElementById('tool-gradient-type') ? document.getElementById('tool-gradient-type').value : 'linear',
            gradMethod: document.getElementById('tool-gradient-method') ? document.getElementById('tool-gradient-method').value : 'simple',
            selectionClip: clip
        };
        // On s'assure que les handles sont dessinés même si le rendu est long
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
        window.paintGradientFromState();
        window._gradientNewDrag = false;
        window._gradientBackup = null;
        EditorManager.saveHistory('Dégradé pixel', { patchActiveLayer: true });
        EditorManager.render({ flushUiThumbnails: true });
    };

    window.hitShapeEditHandle = function (worldX, worldY) {
        const ed = window.pixelShapeEdit;
        if (!ed || !EditorManager.activeLayer || ed.layerId !== EditorManager.activeLayer.id) return null;
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        const pts = window.getShapeEditHandlePointsWorld(ed);
        if (!pts) return null;
        const hr = hitRadiusDoc();
        for (let i = 0; i < pts.length; i++) {
            if (dist(worldX, worldY, pts[i].x, pts[i].y) <= hr) return i;
        }
        return null;
    };

    window.getShapeEditHandlePointsWorld = function (ed) {
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        if (ed.kind === 'rect' || ed.kind === 'roundrect') {
            const x = ed.lx + lx, y = ed.ly + ly, w = ed.w, h = ed.h;
            return [
                { x, y }, { x: x + w / 2, y }, { x: x + w, y },
                { x, y: y + h / 2 }, { x: x + w, y: y + h / 2 },
                { x, y: y + h }, { x: x + w / 2, y: y + h }, { x: x + w, y: y + h }
            ];
        }
        if (ed.kind === 'line') {
            return [
                { x: ed.x1 + lx, y: ed.y1 + ly },
                { x: ed.x2 + lx, y: ed.y2 + ly }
            ];
        }
        if (ed.kind === 'quadcurve') {
            return [
                { x: ed.x0 + lx, y: ed.y0 + ly },
                { x: ed.qx + lx, y: ed.qy + ly },
                { x: ed.x1 + lx, y: ed.y1 + ly }
            ];
        }
        if (ed.kind === 'ellipse') {
            const cx = ed.cx;
            const cy = ed.cy;
            const rx = ed.rx;
            const ry = ed.ry;
            const bx = cx - rx + lx;
            const by = cy - ry + ly;
            const w = rx * 2;
            const h = ry * 2;
            return [
                { x: bx, y: by },
                { x: bx + w / 2, y: by },
                { x: bx + w, y: by },
                { x: bx, y: by + h / 2 },
                { x: bx + w, y: by + h / 2 },
                { x: bx, y: by + h },
                { x: bx + w / 2, y: by + h },
                { x: bx + w, y: by + h }
            ];
        }
        return null;
    };

    function shapeFillCss() {
        return typeof window.shapePrimaryFillCss === 'function'
            ? window.shapePrimaryFillCss()
            : EditorManager.activeColor;
    }

    function shapeStrokeCss() {
        return typeof window.shapeSecondaryStrokeCss === 'function'
            ? window.shapeSecondaryStrokeCss()
            : EditorManager.activeColor;
    }

    function lineLikeStrokeCss() {
        return typeof window.shapeLineStrokeCss === 'function'
            ? window.shapeLineStrokeCss()
            : shapeFillCss();
    }

    function applyShapeStrokeFill(ctx, drawFillFn, drawStrokeFn, strokeW, mode, fillType) {
        const m = mode || 'both';
        const ft = fillType || 'solid';
        const doFill = m !== 'stroke' && ft !== 'none';
        const doStroke = m !== 'fill';
        if (doFill) drawFillFn();
        if (doStroke) {
            ctx.lineWidth = strokeW;
            ctx.strokeStyle = shapeStrokeCss();
            drawStrokeFn();
        }
    }

    window.redrawShapeFromEdit = function () {
        const ed = window.pixelShapeEdit;
        if (!ed || !EditorManager.activeLayer) return;
        const ctx = EditorManager.activeLayer.buffer.getContext('2d', { willReadFrequently: true });
        const buf = EditorManager.activeLayer.buffer;
        ctx.clearRect(0, 0, buf.width, buf.height);
        ctx.drawImage(ed.backup, 0, 0);
        const o = ed.opts || {};
        const strokeW = o.strokeWidth != null ? o.strokeWidth : 2;
        const mode = o.strokeMode || 'both';
        const fillType = o.fillType || 'solid';
        const gradType = o.gradType || 'linear';
        const angleDeg = o.gradAngle != null ? o.gradAngle : 0;
        const fillCss = shapeFillCss();
        const strokeCss = shapeStrokeCss();

        const mkGradientFill = (x0, y0, x1, y1, cx, cy, rx, ry) => {
            let grad;
            if (gradType === 'linear') {
                const rad = (angleDeg * Math.PI) / 180;
                const len = Math.max(rx || Math.abs(x1 - x0), ry || Math.abs(y1 - y0), 8) * 1.5;
                const mx = (x0 + x1) / 2 || cx;
                const my = (y0 + y1) / 2 || cy;
                grad = ctx.createLinearGradient(
                    mx - Math.cos(rad) * len,
                    my - Math.sin(rad) * len,
                    mx + Math.cos(rad) * len,
                    my + Math.sin(rad) * len
                );
            } else {
                const r = Math.max(rx, ry, 4);
                grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
            }
            grad.addColorStop(0, fillCss);
            grad.addColorStop(1, strokeCss);
            return grad;
        };

        if (ed.kind === 'rect') {
            const { lx, ly, w, h } = ed;
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fillRect(lx, ly, w, h);
                },
                () => ctx.strokeRect(lx, ly, w, h),
                strokeW,
                mode,
                fillType
            );
        } else if (ed.kind === 'roundrect') {
            const { lx, ly, w, h, r } = ed;
            const rr = Math.max(
                0,
                Math.min(r != null ? r : Math.min(64, 0.25 * Math.min(w, h), w / 2, h / 2), w / 2, h / 2)
            );
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            const drawRR = () => {
                ctx.beginPath();
                if (typeof ctx.roundRect === 'function') ctx.roundRect(lx, ly, w, h, rr);
                else ctx.rect(lx, ly, w, h);
            };
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    drawRR();
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fill();
                },
                () => {
                    drawRR();
                    ctx.stroke();
                },
                strokeW,
                mode,
                fillType
            );
        } else if (ed.kind === 'line') {
            if (mode !== 'fill') {
                const lineCss = lineLikeStrokeCss();
                const cap0 = EditorManager.toolProps.lineCapStart || 'none';
                const cap1 = EditorManager.toolProps.lineCapEnd || 'none';
                const bothRound = cap0 === 'round' && cap1 === 'round';
                ctx.lineCap = bothRound ? 'round' : 'butt';
                const x1 = ed.x1;
                const y1 = ed.y1;
                const x2 = ed.x2;
                const y2 = ed.y2;
                let tx1 = x1;
                let ty1 = y1;
                let tx2 = x2;
                let ty2 = y2;
                if (typeof window.illuTrimLineSegmentForPixelCaps === 'function') {
                    const tr = window.illuTrimLineSegmentForPixelCaps(x1, y1, x2, y2, strokeW, cap0, cap1);
                    tx1 = tr.x1;
                    ty1 = tr.y1;
                    tx2 = tr.x2;
                    ty2 = tr.y2;
                }
                ctx.beginPath();
                ctx.moveTo(tx1, ty1);
                ctx.lineTo(tx2, ty2);
                ctx.lineWidth = strokeW;
                if (fillType === 'gradient') {
                    const g = ctx.createLinearGradient(x1, y1, x2, y2);
                    g.addColorStop(0, lineCss);
                    g.addColorStop(1, lineCss);
                    ctx.strokeStyle = g;
                } else {
                    ctx.strokeStyle = lineCss;
                }
                ctx.stroke();
                if (typeof window.illuDrawPixelLineEndpointDecor === 'function') {
                    window.illuDrawPixelLineEndpointDecor(ctx, x1, y1, x2, y2, strokeW, lineCss, cap0, cap1);
                }
            }
        } else if (ed.kind === 'quadcurve') {
            const lineCss = lineLikeStrokeCss();
            const { x0, y0, qx, qy, x1, y1 } = ed;
            ctx.beginPath();
            ctx.moveTo(x0, y0);
            ctx.quadraticCurveTo(qx, qy, x1, y1);
            ctx.lineWidth = strokeW;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (fillType === 'gradient') {
                const g = ctx.createLinearGradient(x0, y0, x1, y1);
                g.addColorStop(0, lineCss);
                g.addColorStop(1, lineCss);
                ctx.strokeStyle = g;
            } else {
                ctx.strokeStyle = lineCss;
            }
            ctx.stroke();
        } else if (ed.kind === 'ellipse') {
            const { cx, cy, rx, ry } = ed;
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(cx - rx, cy - ry, cx + rx, cy + ry, cx, cy, rx, ry)
                : null;
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fill();
                },
                () => {
                    ctx.beginPath();
                    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
                    ctx.stroke();
                },
                strokeW,
                mode,
                fillType
            );
        }
        EditorManager.render();
    };

    window.updateShapeEditFromHandle = function (handleIndex, worldX, worldY) {
        const ed = window.pixelShapeEdit;
        if (!ed) return;
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        const wx = worldX - lx;
        const wy = worldY - ly;
        if (ed.kind === 'rect' || ed.kind === 'roundrect') {
            let { lx: rx, ly: ry, w, h } = ed;
            switch (handleIndex) {
                case 0: w += rx - wx; h += ry - wy; rx = wx; ry = wy; break;
                case 1: h += ry - wy; ry = wy; break;
                case 2: w = wx - rx; h += ry - wy; ry = wy; break;
                case 3: w += rx - wx; rx = wx; break;
                case 4: w = wx - rx; break;
                case 5: w += rx - wx; rx = wx; h = wy - ry; break;
                case 6: h = wy - ry; break;
                case 7: w = wx - rx; h = wy - ry; break;
                default: return;
            }
            if (w < 2) w = 2;
            if (h < 2) h = 2;
            if (window._shiftConstraintProportions && [0, 2, 5, 7].includes(handleIndex)) {
                const uw = w;
                const uh = h;
                const m = Math.max(Math.max(2, uw), Math.max(2, uh));
                if (handleIndex === 0) {
                    const fx = rx + uw;
                    const fy = ry + uh;
                    w = h = m;
                    rx = fx - m;
                    ry = fy - m;
                } else if (handleIndex === 2) {
                    const fx = rx;
                    const fy = ry + uh;
                    w = h = m;
                    rx = fx;
                    ry = fy - m;
                } else if (handleIndex === 5) {
                    const fx = rx + uw;
                    const fy = ry;
                    w = h = m;
                    rx = fx - m;
                    ry = fy;
                } else {
                    w = h = m;
                }
            }
            ed.lx = rx;
            ed.ly = ry;
            ed.w = w;
            ed.h = h;
            if (ed.kind === 'roundrect') {
                const cap = Math.min(w / 2, h / 2);
                if (ed.r == null) ed.r = EditorManager.toolProps.shapeCornerRadius ?? 12;
                ed.r = Math.max(0, Math.min(ed.r, cap));
            }
        } else if (ed.kind === 'line') {
            if (handleIndex === 0) { ed.x1 = wx; ed.y1 = wy; }
            else { ed.x2 = wx; ed.y2 = wy; }
        } else if (ed.kind === 'quadcurve') {
            if (handleIndex === 0) {
                ed.x0 = wx;
                ed.y0 = wy;
            } else if (handleIndex === 1) {
                ed.qx = wx;
                ed.qy = wy;
            } else {
                ed.x1 = wx;
                ed.y1 = wy;
            }
        } else if (ed.kind === 'ellipse') {
            let bx = ed.cx - ed.rx;
            let by = ed.cy - ed.ry;
            let w = ed.rx * 2;
            let h = ed.ry * 2;
            let rx0 = bx;
            let ry0 = by;
            switch (handleIndex) {
                case 0:
                    w += rx0 - wx;
                    h += ry0 - wy;
                    rx0 = wx;
                    ry0 = wy;
                    break;
                case 1:
                    h += ry0 - wy;
                    ry0 = wy;
                    break;
                case 2:
                    w = wx - rx0;
                    h += ry0 - wy;
                    ry0 = wy;
                    break;
                case 3:
                    w += rx0 - wx;
                    rx0 = wx;
                    break;
                case 4:
                    w = wx - rx0;
                    break;
                case 5:
                    w += rx0 - wx;
                    rx0 = wx;
                    h = wy - ry0;
                    break;
                case 6:
                    h = wy - ry0;
                    break;
                case 7:
                    w = wx - rx0;
                    h = wy - ry0;
                    break;
                default:
                    return;
            }
            if (w < 4) w = 4;
            if (h < 4) h = 4;
            if (window._shiftConstraintProportions && [0, 2, 5, 7].includes(handleIndex)) {
                const uw = w;
                const uh = h;
                const m = Math.max(Math.max(4, uw), Math.max(4, uh));
                if (handleIndex === 0) {
                    const fx = rx0 + uw;
                    const fy = ry0 + uh;
                    w = h = m;
                    rx0 = fx - m;
                    ry0 = fy - m;
                } else if (handleIndex === 2) {
                    const fx = rx0;
                    const fy = ry0 + uh;
                    w = h = m;
                    rx0 = fx;
                    ry0 = fy - m;
                } else if (handleIndex === 5) {
                    const fx = rx0 + uw;
                    const fy = ry0;
                    w = h = m;
                    rx0 = fx - m;
                    ry0 = fy;
                } else {
                    w = h = m;
                }
            }
            ed.cx = rx0 + w / 2;
            ed.cy = ry0 + h / 2;
            ed.rx = w / 2;
            ed.ry = h / 2;
        }
        window.redrawShapeFromEdit();
    };

    window.captureShapeEditAfterDraw = function (kind, params, opts) {
        if (!EditorManager.activeLayer || !window._shapeBackupCanvas) return;
        window.pixelShapeEdit = {
            kind,
            ...params,
            backup: window._shapeBackupCanvas,
            layerId: EditorManager.activeLayer.id,
            opts: { ...opts }
        };
        window._shapeBackupCanvas = null;
    };

    window.drawPixelOverlayHandles = function (svgUI) {
        if (!svgUI || EditorManager.mode !== 'pixel') return;

        const z = EditorManager.getCanvasZoomLevel();
        const inv = 1 / z;

        const mkCircle = (wx, wy, label) => {
            const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            c.setAttribute('cx', wx);
            c.setAttribute('cy', wy);
            c.setAttribute('r', String(7 * inv));
            c.setAttribute('fill', label.startsWith('g') ? (label === 'g0' ? '#6cf' : '#fc6') : '#fff');
            c.setAttribute('stroke', '#000');
            c.setAttribute('stroke-width', String(inv));
            c.setAttribute('style', 'cursor:move;pointer-events:all;');
            c.setAttribute('data-pixel-handle', label);
            svgUI.appendChild(c);
        };

        const shapeHandleCursors = ['nw-resize', 'n-resize', 'ne-resize', 'w-resize', 'e-resize', 'sw-resize', 's-resize', 'se-resize'];

        const mkShapeHandle = (wx, wy, label, cursor) => {
            const hs = EditorManager.svgUiHandleSizeDoc();
            const hh = hs / 2;
            const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            r.setAttribute('x', wx - hh);
            r.setAttribute('y', wy - hh);
            r.setAttribute('width', String(hs));
            r.setAttribute('height', String(hs));
            r.setAttribute('fill', '#ffffff');
            r.setAttribute('stroke', '#000000');
            r.setAttribute('stroke-width', String(inv));
            r.setAttribute('style', `cursor:${cursor || 'move'};pointer-events:all;`);
            r.setAttribute('data-pixel-handle', label);
            svgUI.appendChild(r);
        };

        const st = window._pixelGradientState;
        if (st && EditorManager.activeLayer && st.layerId === EditorManager.activeLayer.id && window.activeTool === 'gradient') {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(st.x0));
            line.setAttribute('y1', String(st.y0));
            line.setAttribute('x2', String(st.x1));
            line.setAttribute('y2', String(st.y1));
            line.setAttribute('stroke', '#6cf');
            line.setAttribute('stroke-width', String(1.5 * inv));
            line.setAttribute('stroke-dasharray', String(4 * inv) + ',' + String(2 * inv));
            line.setAttribute('pointer-events', 'none');
            svgUI.appendChild(line);

            mkCircle(st.x0, st.y0, 'g0');
            mkCircle(st.x1, st.y1, 'g1');
        }

        const ed = window.pixelShapeEdit;
        if (ed && EditorManager.activeLayer && ed.layerId === EditorManager.activeLayer.id) {
            const tools = ['rect', 'circle', 'line', 'round-3', 'cubic-3'];
            if (tools.includes(window.activeTool)) {
                const pts = window.getShapeEditHandlePointsWorld(ed);
                if (pts) {
                    pts.forEach((p, i) => {
                        const cur =
                            ed.kind === 'line' || ed.kind === 'quadcurve'
                                ? 'move'
                                : shapeHandleCursors[i] || 'move';
                        mkShapeHandle(p.x, p.y, 's' + i, cur);
                    });
                }
            }
        }
    };

    window.onEditorColorsChanged = function () {
        if (window._pixelGradientState && window.activeTool === 'gradient') {
            window.paintGradientFromState();
        }
        if (
            window.pixelShapeEdit &&
            ['rect', 'circle', 'line', 'round-3', 'cubic-3'].includes(window.activeTool)
        ) {
            window.redrawShapeFromEdit();
        }
        if (window.VectorEngine && typeof window.VectorEngine.refreshLiveDrawPreview === 'function') {
            window.VectorEngine.refreshLiveDrawPreview();
        }
        if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
        // Mode vecteur : appliquer couleur/style à la sélection active
        if (window.VectorEngine && window.EditorManager && EditorManager.mode === 'vector') {
            window.VectorEngine.applyStyleToSelection();
        } else if (typeof window.refreshVectorDraftFromEditor === 'function') {
            window.refreshVectorDraftFromEditor();
        }
    };
})();
