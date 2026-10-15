/**
 * PixelOverlay.js — Dégradé éditable (2 points), formes éditables (poignées), nettoyage à changement d’outil.
 */
(function () {
    /** ~14 px à l’écran, en coordonnées document (pour hit test avec zoom). */
    function hitRadiusDoc() {
        return 14 / (EditorManager.getCanvasZoomLevel() || 1);
    }

    function rotateDocPointAround(px, py, cx, cy, ang) {
        const dx = px - cx;
        const dy = py - cy;
        const c = Math.cos(ang);
        const s = Math.sin(ang);
        return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
    }

    function shapeEditRotationPivotDoc(ed) {
        if (!ed || !EditorManager.activeLayer) return null;
        if (ed.docCx != null && ed.docRx != null) {
            return { cx: ed.docCx, cy: ed.docCy };
        }
        if (ed.docX != null && ed.docW != null && ed.docH != null) {
            return { cx: ed.docX + ed.docW / 2, cy: ed.docY + ed.docH / 2 };
        }
        if (ed.docX1 != null && ed.docX2 != null) {
            return {
                cx: (ed.docX1 + ed.docX2) / 2,
                cy: (ed.docY1 + ed.docY2) / 2
            };
        }
        if (ed.docX0 != null) {
            return {
                cx: (ed.docX0 + ed.docQx + ed.docX1) / 3,
                cy: (ed.docY0 + ed.docQy + ed.docY1) / 3
            };
        }
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        if (ed.kind === 'ellipse') {
            return { cx: ed.cx + lx, cy: ed.cy + ly };
        }
        if (ed.lx != null && ed.w != null && ed.h != null) {
            return { cx: ed.lx + ed.w / 2 + lx, cy: ed.ly + ed.h / 2 + ly };
        }
        if (ed.kind === 'line') {
            return { cx: (ed.x1 + ed.x2) / 2 + lx, cy: (ed.y1 + ed.y2) / 2 + ly };
        }
        if (ed.kind === 'quadcurve') {
            return {
                cx: (ed.x0 + ed.qx + ed.x1) / 3 + lx,
                cy: (ed.y0 + ed.qy + ed.y1) / 3 + ly
            };
        }
        return null;
    }

    function illuSyncShapeOutlineRotationTransform(ed) {
        if (!shapeEditOutlineSolid || !shapeEditOutlineDash) return;
        const ang = ed && ed.angleRad ? ed.angleRad : 0;
        if (Math.abs(ang) > 1e-8) {
            const pivot = shapeEditRotationPivotDoc(ed);
            if (pivot) {
                const deg = (ang * 180) / Math.PI;
                const tr = `rotate(${deg} ${pivot.cx} ${pivot.cy})`;
                shapeEditOutlineSolid.setAttribute('transform', tr);
                shapeEditOutlineDash.setAttribute('transform', tr);
                return;
            }
        }
        shapeEditOutlineSolid.removeAttribute('transform');
        shapeEditOutlineDash.removeAttribute('transform');
    }

    window.illuSnapshotShapeEditGeom = function illuSnapshotShapeEditGeom(ed) {
        if (!ed) return null;
        if (ed.kind === 'ellipse') {
            return { kind: ed.kind, cx: ed.cx, cy: ed.cy };
        }
        if (ed.kind === 'line') {
            return { kind: ed.kind, x1: ed.x1, y1: ed.y1, x2: ed.x2, y2: ed.y2, cx1: ed.cx1, cy1: ed.cy1, cx2: ed.cx2, cy2: ed.cy2, isCubic: ed.isCubic };
        }
        if (ed.kind === 'quadcurve') {
            return {
                kind: ed.kind,
                x0: ed.x0,
                y0: ed.y0,
                qx: ed.qx,
                qy: ed.qy,
                x1: ed.x1,
                y1: ed.y1
            };
        }
        if (ed.kind === 'quad' && ed.pts && ed.pts.length >= 4) {
            return {
                kind: 'quad',
                pts: ed.pts.map((p) => ({ x: p.x, y: p.y })),
                quadBase: ed.quadBase,
                r: ed.r,
                lx: ed.lx,
                ly: ed.ly,
                w: ed.w,
                h: ed.h
            };
        }
        return { kind: ed.kind, lx: ed.lx, ly: ed.ly };
    };

    window.illuApplyShapeEditGeomFromSnapshot = function (ed, snap, dx, dy) {
        if (!ed || !snap) return;
        if (ed.kind === 'ellipse') {
            ed.cx = snap.cx + dx;
            ed.cy = snap.cy + dy;
        } else if (ed.kind === 'line') {
            ed.x1 = snap.x1 + dx;
            ed.y1 = snap.y1 + dy;
            ed.x2 = snap.x2 + dx;
            ed.y2 = snap.y2 + dy;
            if (ed.isCubic && snap.cx1 != null) {
                ed.cx1 = snap.cx1 + dx;
                ed.cy1 = snap.cy1 + dy;
                ed.cx2 = snap.cx2 + dx;
                ed.cy2 = snap.cy2 + dy;
            }
        } else if (ed.kind === 'quadcurve') {
            ed.x0 = snap.x0 + dx;
            ed.y0 = snap.y0 + dy;
            ed.qx = snap.qx + dx;
            ed.qy = snap.qy + dy;
            ed.x1 = snap.x1 + dx;
            ed.y1 = snap.y1 + dy;
        } else if (ed.kind === 'quad' && snap.pts && snap.pts.length >= 4) {
            ed.pts = snap.pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
            if (snap.quadBase) ed.quadBase = snap.quadBase;
            if (snap.r != null) ed.r = snap.r;
            if (typeof window.illuSyncShapeEditBBoxFromQuadPts === 'function') {
                window.illuSyncShapeEditBBoxFromQuadPts(ed);
            }
        } else if (snap.lx != null) {
            ed.lx = snap.lx + dx;
            ed.ly = snap.ly + dy;
        }
        if (typeof window.illuSyncPixelShapeEditDocFromLocals === 'function') {
            window.illuSyncPixelShapeEditDocFromLocals(ed);
        }
    };

    window._illuShapeEditMoveActive = false;
    window._illuShapeEditMoveStartDoc = null;
    window._illuShapeEditMoveSnapshot = null;
    window._illuShapeEditMoveFromButtonEl = null;
    window._illuShapeEditMoveFromButtonPointerId = null;

    function illuReleaseShapeEditMoveButtonPointerCapture() {
        const el = window._illuShapeEditMoveFromButtonEl;
        const pid = window._illuShapeEditMoveFromButtonPointerId;
        if (el && pid != null) {
            try {
                el.releasePointerCapture(pid);
            } catch (err) {
                /* ignore */
            }
        }
        window._illuShapeEditMoveFromButtonEl = null;
        window._illuShapeEditMoveFromButtonPointerId = null;
    }
    window.illuReleaseShapeEditMoveButtonPointerCapture = illuReleaseShapeEditMoveButtonPointerCapture;

    /** Coordonnées document figées pour contour / poignées (indépendantes du décalage calque courant). */
    window.illuSyncPixelShapeEditDocFromLocals = function (ed) {
        const layer = EditorManager.activeLayer;
        if (!ed || !layer) return;
        const ox = ed.captureLayerX != null ? ed.captureLayerX | 0 : layer.x | 0;
        const oy = ed.captureLayerY != null ? ed.captureLayerY | 0 : layer.y | 0;
        if (ed.lx != null && ed.w != null && ed.h != null) {
            ed.docX = (ed.lx + ox) | 0;
            ed.docY = (ed.ly + oy) | 0;
            ed.docW = ed.w;
            ed.docH = ed.h;
        } else if (ed.kind === 'ellipse' && ed.cx != null) {
            ed.docCx = ed.cx + ox;
            ed.docCy = ed.cy + oy;
            ed.docRx = ed.rx;
            ed.docRy = ed.ry;
        } else if (ed.kind === 'line' && ed.x1 != null) {
            ed.docX1 = ed.x1 + ox;
            ed.docY1 = ed.y1 + oy;
            ed.docX2 = ed.x2 + ox;
            ed.docY2 = ed.y2 + oy;
            if (ed.cx1 != null) {
                ed.docCx1 = ed.cx1 + ox;
                ed.docCy1 = ed.cy1 + oy;
                ed.docCx2 = ed.cx2 + ox;
                ed.docCy2 = ed.cy2 + oy;
            } else {
                delete ed.docCx1;
                delete ed.docCy1;
                delete ed.docCx2;
                delete ed.docCy2;
            }
        } else if (ed.kind === 'quadcurve' && ed.x0 != null) {
            ed.docX0 = ed.x0 + ox;
            ed.docY0 = ed.y0 + oy;
            ed.docQx = ed.qx + ox;
            ed.docQy = ed.qy + oy;
            ed.docX1 = ed.x1 + ox;
            ed.docY1 = ed.y1 + oy;
        }
    };

    /** Recalcule lx/ly locaux depuis les coords document (avant repeindre sur le tampon). */
    window.illuSyncPixelShapeEditLocalsFromDoc = function (ed) {
        const layer = EditorManager.activeLayer;
        if (!ed || !layer) return;
        const ox = layer.x | 0;
        const oy = layer.y | 0;
        if (ed.docX != null && ed.docW != null) {
            ed.lx = (ed.docX - ox) | 0;
            ed.ly = (ed.docY - oy) | 0;
            ed.w = ed.docW;
            ed.h = ed.docH;
        } else if (ed.docCx != null) {
            ed.cx = ed.docCx - ox;
            ed.cy = ed.docCy - oy;
            ed.rx = ed.docRx;
            ed.ry = ed.docRy;
        } else if (ed.docX1 != null) {
            ed.x1 = ed.docX1 - ox;
            ed.y1 = ed.docY1 - oy;
            ed.x2 = ed.docX2 - ox;
            ed.y2 = ed.docY2 - oy;
            if (ed.docCx1 != null) {
                ed.cx1 = ed.docCx1 - ox;
                ed.cy1 = ed.docCy1 - oy;
                ed.cx2 = ed.docCx2 - ox;
                ed.cy2 = ed.docCy2 - oy;
            }
        } else if (ed.docX0 != null) {
            ed.x0 = ed.docX0 - ox;
            ed.y0 = ed.docY0 - oy;
            ed.qx = ed.docQx - ox;
            ed.qy = ed.docQy - oy;
            ed.x1 = ed.docX1 - ox;
            ed.y1 = ed.docY1 - oy;
        }
    };

    window.illuFlushPixelShapeEditChrome = function () {
        if (!window.pixelShapeEdit || !EditorManager.activeLayer) return;
        if (typeof window.refreshPixelShapeEditOverlay === 'function') {
            window.refreshPixelShapeEditOverlay({ forceFull: true });
        }
        if (typeof EditorManager.drawUI === 'function') {
            EditorManager.drawUI(true);
        }
    };

    function shapeEditBoundsDoc(ed) {
        if (!ed || !EditorManager.activeLayer) return null;
        if (ed.docX != null && ed.docW != null && ed.docH != null) {
            return { x: ed.docX, y: ed.docY, w: ed.docW, h: ed.docH };
        }
        if (ed.docCx != null && ed.docRx != null && ed.docRy != null) {
            return {
                x: ed.docCx - ed.docRx,
                y: ed.docCy - ed.docRy,
                w: ed.docRx * 2,
                h: ed.docRy * 2
            };
        }
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        if (ed.kind === 'ellipse') {
            return {
                x: ed.cx - ed.rx + lx,
                y: ed.cy - ed.ry + ly,
                w: ed.rx * 2,
                h: ed.ry * 2
            };
        }
        if (ed.lx != null && ed.w != null && ed.h != null) {
            return { x: ed.lx + lx, y: ed.ly + ly, w: ed.w, h: ed.h };
        }
        return null;
    }

    const SHAPE_ROTATABLE_KINDS = new Set(['rect', 'roundrect', 'triangle', 'star', 'poly', 'callout', 'quad', 'ellipse']);

    window._pixelGradientState = null;
    window._gradientHandleDrag = null;
    window._gradientNewDrag = false;
    window._gradientBackup = null;

    let shapeEditRenderRaf = 0;
    let shapeEditPreviewLastMs = 0;
    let shapeEditPreviewTimer = 0;
    const SHAPE_EDIT_PREVIEW_MS = 200;

    function scheduleShapeEditLayerRefresh() {
        if (shapeEditRenderRaf) return;
        shapeEditRenderRaf = requestAnimationFrame(() => {
            shapeEditRenderRaf = 0;
            if (typeof EditorManager.render === 'function') {
                EditorManager.render({ skipUiThumbnails: true, skipDrawUI: true, activeLayerViewOnly: true });
            }
        });
    }

    /** Aperçu pixels forme en édition (~5 fps) — poignées / contour restent fluides. */
    function scheduleShapeEditPreviewRefresh() {
        const now = performance.now();
        const diff = now - shapeEditPreviewLastMs;
        if (diff < SHAPE_EDIT_PREVIEW_MS) {
            if (!shapeEditPreviewTimer) {
                shapeEditPreviewTimer = window.setTimeout(() => {
                    shapeEditPreviewTimer = 0;
                    scheduleShapeEditPreviewRefresh();
                }, SHAPE_EDIT_PREVIEW_MS - diff + 5);
            }
            return;
        }
        shapeEditPreviewLastMs = now;
        if (shapeEditPreviewTimer) {
            clearTimeout(shapeEditPreviewTimer);
            shapeEditPreviewTimer = 0;
        }
        scheduleShapeEditLayerRefresh();
    }

    let shapeEditOutlineSvg = null;
    let shapeEditOutlineSolid = null;
    let shapeEditOutlineDash = null;

    function illuRoundRectOutlinePathD(x, y, w, h, r) {
        r = Math.max(0, Math.min(r, w / 2, h / 2));
        if (r < 0.5) {
            return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
        }
        return (
            `M ${x + r} ${y} H ${x + w - r} A ${r} ${r} 0 0 1 ${x + w} ${y + r} ` +
            `V ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} H ${x + r} ` +
            `A ${r} ${r} 0 0 1 ${x} ${y + h - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
        );
    }

    function illuEllipseOutlinePathD(cx, cy, rx, ry) {
        rx = Math.max(0.5, rx);
        ry = Math.max(0.5, ry);
        const k = 0.5522847498;
        const ox = rx * k;
        const oy = ry * k;
        return (
            `M ${cx} ${cy - ry} ` +
            `C ${cx + ox} ${cy - ry} ${cx + rx} ${cy - oy} ${cx + rx} ${cy} ` +
            `C ${cx + rx} ${cy + oy} ${cx + ox} ${cy + ry} ${cx} ${cy + ry} ` +
            `C ${cx - ox} ${cy + ry} ${cx - rx} ${cy + oy} ${cx - rx} ${cy} ` +
            `C ${cx - rx} ${cy - oy} ${cx - ox} ${cy - ry} ${cx} ${cy - ry} Z`
        );
    }

    window.getShapeEditOutlineSpec = function (ed) {
        ed = ed || window.pixelShapeEdit;
        const layer = EditorManager.activeLayer;
        if (!ed || !layer) return null;
        const lx = layer.x;
        const ly = layer.y;
        if (ed.kind === 'rect') {
            const x = ed.docX != null ? ed.docX : ed.lx + lx;
            const y = ed.docY != null ? ed.docY : ed.ly + ly;
            const w = ed.docW != null ? ed.docW : ed.w;
            const h = ed.docH != null ? ed.docH : ed.h;
            return {
                d: `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`,
                closed: true
            };
        }
        if (ed.kind === 'roundrect') {
            const x = ed.docX != null ? ed.docX : ed.lx + lx;
            const y = ed.docY != null ? ed.docY : ed.ly + ly;
            const w = ed.docW != null ? ed.docW : ed.w;
            const h = ed.docH != null ? ed.docH : ed.h;
            const r = ed.r != null ? ed.r : EditorManager.toolProps.shapeCornerRadius ?? 12;
            return {
                d: illuRoundRectOutlinePathD(x, y, w, h, r),
                closed: true
            };
        }
        if (ed.kind === 'triangle') {
            const x = ed.docX != null ? ed.docX : ed.lx + lx;
            const y = ed.docY != null ? ed.docY : ed.ly + ly;
            const w = ed.docW != null ? ed.docW : ed.w;
            const h = ed.docH != null ? ed.docH : ed.h;
            const adj = ed.adj != null ? ed.adj : 0.5;
            const vf = ed.vf != null ? ed.vf : 0;
            return {
                d: `M ${x + w * adj} ${y + h * vf} L ${x} ${y + h} L ${x + w} ${y + h} Z`,
                closed: true
            };
        }
        if (ed.kind === 'star') {
            const x = ed.docX != null ? ed.docX : ed.lx + lx;
            const y = ed.docY != null ? ed.docY : ed.ly + ly;
            const w = ed.docW != null ? ed.docW : ed.w;
            const h = ed.docH != null ? ed.docH : ed.h;
            const branches = ed.branches != null ? ed.branches : 5;
            const d =
                typeof window.illuStarPathD === 'function'
                    ? window.illuStarPathD(x, y, w, h, branches)
                    : '';
            return { d, closed: true };
        }
        if (ed.kind === 'poly') {
            const x = ed.docX != null ? ed.docX : ed.lx + lx;
            const y = ed.docY != null ? ed.docY : ed.ly + ly;
            const w = ed.docW != null ? ed.docW : ed.w;
            const h = ed.docH != null ? ed.docH : ed.h;
            const sides = ed.sides != null ? ed.sides : 6;
            const d =
                typeof window.illuRegularPolygonPathD === 'function'
                    ? window.illuRegularPolygonPathD(x, y, w, h, sides)
                    : '';
            return { d, closed: true };
        }
        if (ed.kind === 'callout') {
            const x = ed.docX != null ? ed.docX : ed.lx + lx;
            const y = ed.docY != null ? ed.docY : ed.ly + ly;
            const w = ed.docW != null ? ed.docW : ed.w;
            const h = ed.docH != null ? ed.docH : ed.h;
            const style = ed.style || 'rect';
            const cOpts =
                typeof window.illuCalloutPathOptsFromEdit === 'function'
                    ? window.illuCalloutPathOptsFromEdit(ed)
                    : {};
            const d =
                typeof window.illuCalloutPathD === 'function'
                    ? window.illuCalloutPathD(style, x, y, w, h, cOpts)
                    : '';
            return { d, closed: true };
        }
        if (ed.kind === 'quad' && ed.pts && ed.pts.length >= 4) {
            if (
                ed.quadPreset &&
                typeof window.illuQuadPointsForPreset === 'function'
            ) {
                const drawPts = window.illuQuadPointsForPreset(ed.quadPreset, ed.lx, ed.ly, ed.w, ed.h);
                if (drawPts.length >= 3) {
                    let d = `M ${drawPts[0].x + lx} ${drawPts[0].y + ly}`;
                    for (let i = 1; i < drawPts.length; i++) {
                        d += ` L ${drawPts[i].x + lx} ${drawPts[i].y + ly}`;
                    }
                    return { d: d + ' Z', closed: true };
                }
            }
            const r = ed.r != null ? ed.r : 0;
            if (ed.quadBase === 'roundrect' && r > 0) {
                if (
                    typeof window.illuQuadPtsMatchAxisRect === 'function' &&
                    window.illuQuadPtsMatchAxisRect(ed.pts, ed.lx, ed.ly, ed.w, ed.h)
                ) {
                    return {
                        d: illuRoundRectOutlinePathD(ed.lx + lx, ed.ly + ly, ed.w, ed.h, r),
                        closed: true
                    };
                }
                const d =
                    typeof window.illuShapeRoundedQuadPathD === 'function'
                        ? window.illuShapeRoundedQuadPathD(ed.pts, r, lx, ly)
                        : '';
                return { d, closed: true };
            }
            const d =
                typeof window.illuShapeQuadPathD === 'function'
                    ? window.illuShapeQuadPathD(ed.pts, lx, ly)
                    : '';
            return { d, closed: true };
        }
        if (ed.kind === 'line') {
            const x1 = ed.docX1 != null ? ed.docX1 : ed.x1 + lx;
            const y1 = ed.docY1 != null ? ed.docY1 : ed.y1 + ly;
            const x2 = ed.docX2 != null ? ed.docX2 : ed.x2 + lx;
            const y2 = ed.docY2 != null ? ed.docY2 : ed.y2 + ly;
            if (ed.isCubic && ed.cx1 != null) {
                const cx1 = ed.docCx1 != null ? ed.docCx1 : ed.cx1 + lx;
                const cy1 = ed.docCy1 != null ? ed.docCy1 : ed.cy1 + ly;
                const cx2 = ed.docCx2 != null ? ed.docCx2 : ed.cx2 + lx;
                const cy2 = ed.docCy2 != null ? ed.docCy2 : ed.cy2 + ly;
                const fn = window.illuInterpolateCubicControlPoints || (typeof illuInterpolateCubicControlPoints === 'function' ? illuInterpolateCubicControlPoints : null);
                if (fn) {
                    const cp = fn(x1, y1, cx1, cy1, cx2, cy2, x2, y2);
                    return {
                        d: `M ${x1} ${y1} C ${cp.b1x} ${cp.b1y} ${cp.b2x} ${cp.b2y} ${x2} ${y2}`,
                        closed: false
                    };
                }
                return {
                    d: `M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`,
                    closed: false
                };
            }
            return {
                d: `M ${x1} ${y1} L ${x2} ${y2}`,
                closed: false
            };
        }
        if (ed.kind === 'ellipse') {
            const cx = ed.docCx != null ? ed.docCx : ed.cx + lx;
            const cy = ed.docCy != null ? ed.docCy : ed.cy + ly;
            const rx = ed.docRx != null ? ed.docRx : ed.rx;
            const ry = ed.docRy != null ? ed.docRy : ed.ry;
            return {
                d: illuEllipseOutlinePathD(cx, cy, rx, ry),
                closed: true
            };
        }
        if (ed.kind === 'quadcurve') {
            const x0 = ed.docX0 != null ? ed.docX0 : ed.x0 + lx;
            const y0 = ed.docY0 != null ? ed.docY0 : ed.y0 + ly;
            const qx = ed.docQx != null ? ed.docQx : ed.qx + lx;
            const qy = ed.docQy != null ? ed.docQy : ed.qy + ly;
            const x1 = ed.docX1 != null ? ed.docX1 : ed.x1 + lx;
            const y1 = ed.docY1 != null ? ed.docY1 : ed.y1 + ly;
            return {
                d: `M ${x0} ${y0} Q ${qx} ${qy} ${x1} ${y1}`,
                closed: false
            };
        }
        return null;
    };

    window.hidePixelShapeEditOverlay = function () {
        const overlay = document.getElementById('selection-overlay');
        if (overlay) {
            overlay.querySelectorAll('.illu-shape-edit-outline').forEach((el) => el.remove());
        }
        shapeEditOutlineSvg = null;
        shapeEditOutlineSolid = null;
        shapeEditOutlineDash = null;
    };

    window.updatePixelShapeEditOverlayFast = function (ed) {
        ed = ed || window.pixelShapeEdit;
        const spec = window.getShapeEditOutlineSpec(ed);
        if (!spec || !spec.d || typeof EditorManager === 'undefined') return false;

        const overlay = document.getElementById('selection-overlay');
        if (!overlay) return false;
        overlay.style.display = 'block';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.width = EditorManager.width + 'px';
        overlay.style.height = EditorManager.height + 'px';
        overlay.style.overflow = 'visible';

        const z = EditorManager.getCanvasZoomLevel() || 1;
        const strokeW = Math.max(1, 1.25 / z);
        const outlineW = strokeW * 2;
        const d = spec.d;

        if (!shapeEditOutlineSvg || !shapeEditOutlineSolid) {
            overlay.querySelectorAll('.illu-shape-edit-outline').forEach((el) => el.remove());
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.classList.add('illu-shape-edit-outline');
            svg.setAttribute('width', String(EditorManager.width));
            svg.setAttribute('height', String(EditorManager.height));
            svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;';
            const pathSolid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathSolid.setAttribute('fill', 'none');
            pathSolid.setAttribute('stroke', '#000');
            pathSolid.setAttribute('stroke-width', String(outlineW));
            const pathDash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            pathDash.setAttribute('fill', 'none');
            pathDash.setAttribute('stroke', '#fff');
            pathDash.setAttribute('stroke-width', String(strokeW));
            pathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
            svg.appendChild(pathSolid);
            svg.appendChild(pathDash);
            overlay.appendChild(svg);
            shapeEditOutlineSvg = svg;
            shapeEditOutlineSolid = pathSolid;
            shapeEditOutlineDash = pathDash;
        }

        shapeEditOutlineSolid.setAttribute('d', d);
        shapeEditOutlineSolid.setAttribute('stroke-width', String(outlineW));
        shapeEditOutlineDash.setAttribute('d', d);
        shapeEditOutlineDash.setAttribute('stroke-width', String(strokeW));
        shapeEditOutlineDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
        illuSyncShapeOutlineRotationTransform(ed);
        return true;
    };

    window.refreshPixelShapeEditOverlay = function (opts) {
        opts = opts || {};
        if (!window.pixelShapeEdit || !EditorManager.activeLayer) {
            window.hidePixelShapeEditOverlay();
            return false;
        }
        if (!opts.forceFull && window.updatePixelShapeEditOverlayFast()) {
            return true;
        }
        window.hidePixelShapeEditOverlay();
        return window.updatePixelShapeEditOverlayFast();
    };

    window.schedulePixelShapeEditChromeRefresh = function () {
        window.refreshPixelShapeEditOverlay();
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(false);
    };

    window.flushShapeEditPreview = function () {
        if (shapeEditPreviewTimer) {
            clearTimeout(shapeEditPreviewTimer);
            shapeEditPreviewTimer = 0;
        }
        shapeEditPreviewLastMs = 0;
        if (shapeEditRenderRaf) {
            cancelAnimationFrame(shapeEditRenderRaf);
            shapeEditRenderRaf = 0;
        }
        if (typeof EditorManager.render === 'function') {
            EditorManager.render({ skipUiThumbnails: true, skipDrawUI: true, activeLayerViewOnly: true });
        }
    };

    window.pixelShapeEdit = null;
    window.shapeHandleDrag = null;

    window.clearPixelToolSessions = function () {
        window._pixelGradientState = null;
        window._gradientHandleDrag = null;
        window._gradientNewDrag = false;
        window._gradientBackup = null;
        window.pixelShapeEdit = null;
        window.shapeHandleDrag = null;
        window._illuShapeEditMoveActive = false;
        window._illuShapeEditMoveStartDoc = null;
        window._illuShapeEditMoveSnapshot = null;
        if (typeof window.illuReleaseShapeEditMoveButtonPointerCapture === 'function') {
            window.illuReleaseShapeEditMoveButtonPointerCapture();
        }
        window._shapeBackupCanvas = null;
        if (typeof window.hidePixelShapeEditOverlay === 'function') window.hidePixelShapeEditOverlay();
        if (typeof window.cancelSelectionInteractionState === 'function') window.cancelSelectionInteractionState();
    };

    function dist(ax, ay, bx, by) {
        const dx = ax - bx, dy = ay - by;
        return Math.sqrt(dx * dx + dy * dy);
    }

    window.hitShapeLiveRotationHandle = function (worldX, worldY) {
        const hr = hitRadiusDoc();
        const ed = window.pixelShapeEdit;
        if (ed && SHAPE_ROTATABLE_KINDS.has(ed.kind)) {
            const sb = shapeEditBoundsDoc(ed);
            if (sb) {
                const rhp = EditorManager.selectionRotationHandleDocXY(sb, ed.angleRad || 0, null);
                if (dist(worldX, worldY, rhp.x, rhp.y) <= hr) return true;
            }
        }
        if (
            typeof window.illuIsShapeLiveDrawSession === 'function' &&
            window.illuIsShapeLiveDrawSession() &&
            typeof window.getLiveShapeDocBounds === 'function' &&
            window._shapeLiveStartX != null
        ) {
            const pos = window._illuLastPointerDoc || {
                x: window._shapeLiveStartX,
                y: window._shapeLiveStartY
            };
            const b = window.getLiveShapeDocBounds(
                pos,
                window._shapeLiveStartX,
                window._shapeLiveStartY,
                !!window._shiftConstraintProportions
            );
            if (b.w >= 2 && b.h >= 2) {
                const rhp = EditorManager.selectionRotationHandleDocXY(
                    b,
                    window._shapeLivePreviewAngleRad || 0,
                    null
                );
                if (dist(worldX, worldY, rhp.x, rhp.y) <= hr) return true;
            }
        }
        return false;
    };

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

        if (typeof window.illuApplyGradientColorStops === 'function') {
            window.illuApplyGradientColorStops(grad, c0, sec, method);
        } else {
            grad.addColorStop(0, c0);
            grad.addColorStop(1, sec);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, buf.width, buf.height);
        ctx.restore();
        if (typeof EditorManager.quantizeActiveLayerBuffer === 'function') {
            EditorManager.quantizeActiveLayerBuffer();
        }
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
        let pts = null;
        if (ed.kind === 'quad' && ed._quadCornerEdit) {
            return null;
        }
        if (
            ed.kind === 'rect' ||
            ed.kind === 'roundrect' ||
            ed.kind === 'triangle' ||
            ed.kind === 'star' ||
            ed.kind === 'poly' ||
            (ed.kind === 'quad' && ed.quadPreset && !ed._quadCornerEdit)
        ) {
            const sb = shapeEditBoundsDoc(ed);
            if (!sb) return null;
            const x = sb.x;
            const y = sb.y;
            const w = sb.w;
            const h = sb.h;
            pts = [
                { x, y }, { x: x + w / 2, y }, { x: x + w, y },
                { x, y: y + h / 2 }, { x: x + w, y: y + h / 2 },
                { x, y: y + h }, { x: x + w / 2, y: y + h }, { x: x + w, y: y + h }
            ];
        } else if (ed.kind === 'line') {
            const lx = EditorManager.activeLayer.x;
            const ly = EditorManager.activeLayer.y;
            pts = [
                {
                    x: ed.docX1 != null ? ed.docX1 : ed.x1 + lx,
                    y: ed.docY1 != null ? ed.docY1 : ed.y1 + ly
                },
                {
                    x: ed.docX2 != null ? ed.docX2 : ed.x2 + lx,
                    y: ed.docY2 != null ? ed.docY2 : ed.y2 + ly
                }
            ];
            if (ed.isCubic && ed.cx1 != null) {
                pts.push(
                    {
                        x: ed.docCx1 != null ? ed.docCx1 : ed.cx1 + lx,
                        y: ed.docCy1 != null ? ed.docCy1 : ed.cy1 + ly
                    },
                    {
                        x: ed.docCx2 != null ? ed.docCx2 : ed.cx2 + lx,
                        y: ed.docCy2 != null ? ed.docCy2 : ed.cy2 + ly
                    }
                );
            }
        } else if (ed.kind === 'quadcurve') {
            const lx = EditorManager.activeLayer.x;
            const ly = EditorManager.activeLayer.y;
            pts = [
                {
                    x: ed.docX0 != null ? ed.docX0 : ed.x0 + lx,
                    y: ed.docY0 != null ? ed.docY0 : ed.y0 + ly
                },
                {
                    x: ed.docQx != null ? ed.docQx : ed.qx + lx,
                    y: ed.docQy != null ? ed.docQy : ed.qy + ly
                },
                {
                    x: ed.docX1 != null ? ed.docX1 : ed.x1 + lx,
                    y: ed.docY1 != null ? ed.docY1 : ed.y1 + ly
                }
            ];
        } else if (ed.kind === 'ellipse') {
            const sb = shapeEditBoundsDoc(ed);
            if (!sb) return null;
            const bx = sb.x;
            const by = sb.y;
            const w = sb.w;
            const h = sb.h;
            pts = [
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
        const ang = ed.angleRad || 0;
        if (pts && Math.abs(ang) > 1e-8) {
            const pivot = shapeEditRotationPivotDoc(ed);
            if (pivot) {
                pts = pts.map((p) => rotateDocPointAround(p.x, p.y, pivot.cx, pivot.cy, ang));
            }
        }
        return pts;
    };

    function shapeFillCss() {
        return typeof window.shapeEffectiveFillCss === 'function'
            ? window.shapeEffectiveFillCss()
            : typeof window.shapePrimaryFillCss === 'function'
              ? window.shapePrimaryFillCss()
              : EditorManager.activeColor;
    }

    function shapeStrokeCss() {
        return typeof window.shapeEffectiveStrokeCss === 'function'
            ? window.shapeEffectiveStrokeCss(null, 'shape')
            : typeof window.shapeSecondaryStrokeCss === 'function'
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
            const dashStyle = EditorManager.toolProps.lineDash || 'solid';
            if (dashStyle === 'dashed') ctx.setLineDash([Math.max(6, strokeW * 2), Math.max(4, strokeW * 1.5)]);
            else if (dashStyle === 'dotted') ctx.setLineDash([Math.max(2, strokeW * 0.5), Math.max(4, strokeW * 1.5)]);
            else ctx.setLineDash([]);
            drawStrokeFn();
            ctx.setLineDash([]);
        }
    }

    window.redrawShapeFromEdit = function () {
        const ed = window.pixelShapeEdit;
        if (!ed || !EditorManager.activeLayer) return;
        if (typeof window.illuSyncPixelShapeEditLocalsFromDoc === 'function') {
            window.illuSyncPixelShapeEditLocalsFromDoc(ed);
        }
        const layer = EditorManager.activeLayer;
        const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
        const buf = layer.buffer;
        if (
            ed.backup &&
            (ed.backup.width !== buf.width || ed.backup.height !== buf.height) &&
            typeof window.illuRealignShapeBackupCanvasToLayer === 'function'
        ) {
            const ox = ed.backupOriginX != null ? ed.backupOriginX : layer.x | 0;
            const oy = ed.backupOriginY != null ? ed.backupOriginY : layer.y | 0;
            ed.backup = window.illuRealignShapeBackupCanvasToLayer(ed.backup, ox, oy, layer);
        }
        ctx.clearRect(0, 0, buf.width, buf.height);
        ctx.drawImage(ed.backup, 0, 0);
        const o = ed.opts || {};
        const strokeW = o.strokeWidth != null ? o.strokeWidth : 2;
        const lineContourW = o.lineContourWidth != null ? o.lineContourWidth : 0;
        const mode = o.strokeMode || 'both';
        const fillType = o.fillType || 'solid';
        const gradType = o.gradType || 'linear';
        const gradMethod = o.gradMethod || (typeof window.illuGetGradientMethod === 'function' ? window.illuGetGradientMethod() : 'simple');
        const angleDeg = o.gradAngle != null ? o.gradAngle : 0;
        const fillCss = shapeFillCss();
        const strokeCss = shapeStrokeCss();

        ctx.save();
        const shapeAng = ed.angleRad || 0;
        if (Math.abs(shapeAng) > 1e-8) {
            const pivot = shapeEditRotationPivotLocal(ed);
            if (pivot) {
                ctx.translate(pivot.cx, pivot.cy);
                ctx.rotate(shapeAng);
                ctx.translate(-pivot.cx, -pivot.cy);
            }
        }

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
            const c0 = typeof window.shapePrimaryFillCss === 'function' ? window.shapePrimaryFillCss() : fillCss;
            const c1 = typeof window.makeShapeSecondaryColor === 'function'
                ? window.makeShapeSecondaryColor()
                : (typeof window.shapeSecondaryStrokeCss === 'function' ? window.shapeSecondaryStrokeCss() : strokeCss);
            if (typeof window.illuApplyGradientColorStops === 'function') {
                window.illuApplyGradientColorStops(grad, c0, c1, gradMethod);
            } else {
                grad.addColorStop(0, c0);
                grad.addColorStop(1, c1);
            }
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
        } else if (ed.kind === 'poly') {
            const { lx, ly, w, h } = ed;
            const sides = ed.sides != null ? ed.sides : 6;
            const polyPts =
                typeof window.illuRegularPolygonPoints === 'function'
                    ? window.illuRegularPolygonPoints(lx, ly, w, h, sides)
                    : [];
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            const drawPoly = () => {
                if (!polyPts.length) return;
                ctx.beginPath();
                ctx.moveTo(polyPts[0].x, polyPts[0].y);
                for (let i = 1; i < polyPts.length; i++) ctx.lineTo(polyPts[i].x, polyPts[i].y);
                ctx.closePath();
            };
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    drawPoly();
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fill();
                },
                () => {
                    drawPoly();
                    ctx.stroke();
                },
                strokeW,
                mode,
                fillType
            );
        } else if (ed.kind === 'callout') {
            const { lx, ly, w, h } = ed;
            const style = ed.style || 'rect';
            const cOpts =
                typeof window.illuCalloutPathOptsFromEdit === 'function'
                    ? window.illuCalloutPathOptsFromEdit(ed)
                    : {};
            const d =
                typeof window.illuCalloutPathD === 'function'
                    ? window.illuCalloutPathD(style, lx, ly, w, h, cOpts)
                    : '';
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            if (d) {
                applyShapeStrokeFill(
                    ctx,
                    () => {
                        if (fillType === 'none') return;
                        const p2d = new Path2D(d);
                        ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                        ctx.fill(p2d);
                    },
                    () => {
                        const p2d = new Path2D(d);
                        ctx.stroke(p2d);
                    },
                    strokeW,
                    mode,
                    fillType
                );
            }
            if (ed.text && typeof window.illuPaintCalloutTextOnCtx === 'function') {
                window.illuPaintCalloutTextOnCtx(ctx, ed.text, ed.lx, ed.ly, ed.w, ed.h);
            }
        } else if (ed.kind === 'triangle') {
            const { lx, ly, w, h } = ed;
            const adj = ed.adj != null ? ed.adj : 0.5;
            const vf = ed.vf != null ? ed.vf : 0;
            const triPts =
                typeof window.illuTriangleCanvasPoints === 'function'
                    ? window.illuTriangleCanvasPoints(lx, ly, w, h, adj, vf)
                    : [];
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            const drawPoly = () => {
                if (!triPts.length) return;
                if (typeof window.illuDrawCanvasPolygonFromPoints === 'function') {
                    window.illuDrawCanvasPolygonFromPoints(ctx, triPts);
                } else {
                    ctx.beginPath();
                    ctx.moveTo(triPts[0].x, triPts[0].y);
                    for (let i = 1; i < triPts.length; i++) ctx.lineTo(triPts[i].x, triPts[i].y);
                    ctx.closePath();
                }
            };
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    drawPoly();
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fill();
                },
                () => {
                    drawPoly();
                    ctx.stroke();
                },
                strokeW,
                mode,
                fillType
            );
        } else if (ed.kind === 'star') {
            const { lx, ly, w, h } = ed;
            const branches = ed.branches != null ? ed.branches : 5;
            const starPts =
                typeof window.illuStarCanvasPoints === 'function'
                    ? window.illuStarCanvasPoints(lx, ly, w, h, branches)
                    : [];
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            const drawPoly = () => {
                if (!starPts.length) return;
                ctx.beginPath();
                ctx.moveTo(starPts[0].x, starPts[0].y);
                for (let i = 1; i < starPts.length; i++) ctx.lineTo(starPts[i].x, starPts[i].y);
                ctx.closePath();
            };
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    drawPoly();
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fill();
                },
                () => {
                    drawPoly();
                    ctx.stroke();
                },
                strokeW,
                mode,
                fillType
            );
        } else if (ed.kind === 'quad' && ed.pts && ed.pts.length >= 4) {
            const { lx, ly, w, h } = ed;
            let drawPts = ed.pts;
            if (
                ed.quadPreset &&
                !ed._quadCornerEdit &&
                typeof window.illuQuadPointsForPreset === 'function'
            ) {
                drawPts = window.illuQuadPointsForPreset(ed.quadPreset, lx, ly, w, h);
            }
            const fillGrad = fillType === 'gradient'
                ? mkGradientFill(lx, ly, lx + w, ly + h, lx + w / 2, ly + h / 2, w / 2, h / 2)
                : null;
            const drawQuad = () => {
                if (typeof window.illuDrawCanvasPolygonFromPoints === 'function') {
                    window.illuDrawCanvasPolygonFromPoints(ctx, drawPts);
                } else if (typeof window.illuDrawCanvasQuadPath === 'function') {
                    window.illuDrawCanvasQuadPath(ctx, drawPts, {
                        quadBase: ed.quadBase,
                        r: ed.r,
                        lx: ed.lx,
                        ly: ed.ly,
                        w: ed.w,
                        h: ed.h
                    });
                }
            };
            applyShapeStrokeFill(
                ctx,
                () => {
                    if (fillType === 'none') return;
                    drawQuad();
                    ctx.fillStyle = fillType === 'gradient' ? fillGrad : fillCss;
                    ctx.fill();
                },
                () => {
                    drawQuad();
                    ctx.stroke();
                },
                strokeW,
                mode,
                fillType
            );
        } else if (ed.kind === 'line') {
            const lineOpts = {
                strokeWidth: strokeW,
                lineContourWidth: lineContourW,
                strokeMode: mode,
                fillType
            };
            if (ed.isCubic && ed.cx1 != null) {
                if (typeof window.illuDrawPixelCubicCurveWithBorder === 'function') {
                    window.illuDrawPixelCubicCurveWithBorder(ctx, ed.x1, ed.y1, ed.cx1, ed.cy1, ed.cx2, ed.cy2, ed.x2, ed.y2, lineOpts);
                }
            } else {
                if (typeof window.illuDrawPixelLineSegment === 'function') {
                    window.illuDrawPixelLineSegment(ctx, ed.x1, ed.y1, ed.x2, ed.y2, lineOpts);
                }
            }
        } else if (ed.kind === 'quadcurve') {
            const { x0, y0, qx, qy, x1, y1 } = ed;
            const curveOpts = {
                strokeWidth: strokeW,
                lineContourWidth: lineContourW,
                strokeMode: mode,
                fillType
            };
            if (typeof window.illuDrawPixelQuadCurveWithBorder === 'function') {
                window.illuDrawPixelQuadCurveWithBorder(ctx, x0, y0, qx, qy, x1, y1, curveOpts);
            }
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
        ctx.restore();
        scheduleShapeEditPreviewRefresh();
    };

    function shapeEditRotationPivotLocal(ed) {
        if (!ed) return null;
        if (ed.kind === 'ellipse') {
            return { cx: ed.cx, cy: ed.cy };
        }
        if (ed.lx != null && ed.w != null && ed.h != null) {
            return { cx: ed.lx + ed.w / 2, cy: ed.ly + ed.h / 2 };
        }
        return null;
    }

    window.redrawShapeFromEditLive = function () {
        window.redrawShapeFromEdit();
        if (typeof window.refreshPixelShapeEditOverlay === 'function') {
            window.refreshPixelShapeEditOverlay();
        }
        if (typeof EditorManager !== 'undefined' && typeof EditorManager.drawUI === 'function') {
            EditorManager.drawUI(true);
        }
        scheduleShapeEditPreviewRefresh();
    };

    window.updateShapeEditFromHandle = function (handleIndex, worldX, worldY) {
        const ed = window.pixelShapeEdit;
        if (!ed) return;
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        const wx = worldX - lx;
        const wy = worldY - ly;
        if (ed.kind === 'quad' && ed._quadCornerEdit) {
            return;
        }
        if (
            ed.kind === 'rect' ||
            ed.kind === 'roundrect' ||
            ed.kind === 'triangle' ||
            ed.kind === 'star' ||
            ed.kind === 'poly' ||
            (ed.kind === 'quad' && ed.quadPreset && !ed._quadCornerEdit)
        ) {
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
            if (ed.kind === 'quad' && ed.quadPreset && typeof window.illuQuadPointsForPreset === 'function') {
                ed.pts = window.illuQuadPointsForPreset(ed.quadPreset, ed.lx, ed.ly, ed.w, ed.h);
            }
        } else if (ed.kind === 'line') {
            if (handleIndex === 0) { ed.x1 = wx; ed.y1 = wy; }
            else if (handleIndex === 1) { ed.x2 = wx; ed.y2 = wy; }
            else if (handleIndex === 2) { ed.cx1 = wx; ed.cy1 = wy; }
            else if (handleIndex === 3) { ed.cx2 = wx; ed.cy2 = wy; }
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
        if (typeof window.illuSyncPixelShapeEditDocFromLocals === 'function') {
            window.illuSyncPixelShapeEditDocFromLocals(ed);
        }
        window.redrawShapeFromEditLive();
    };

    function shapeAdjustHandleToWorld(ed, local, type) {
        const lx = EditorManager.activeLayer.x;
        const ly = EditorManager.activeLayer.y;
        let wx = local.x + lx;
        let wy = local.y + ly;
        const ang = ed.angleRad || 0;
        if (Math.abs(ang) > 1e-8) {
            const pivot = shapeEditRotationPivotDoc(ed);
            if (pivot) {
                const rot = rotateDocPointAround(wx, wy, pivot.cx, pivot.cy, ang);
                wx = rot.x;
                wy = rot.y;
            }
        }
        return { x: wx, y: wy, type };
    }

    window.getShapeAdjustHandlesWorld = function (ed) {
        if (!ed || !EditorManager.activeLayer) return [];
        const out = [];
        if (ed.kind === 'roundrect') {
            const w = ed.w;
            const h = ed.h;
            const r = ed.r != null ? ed.r : EditorManager.toolProps.shapeCornerRadius ?? 12;
            const local =
                typeof window.illuRoundRectAdjustHandleLocal === 'function'
                    ? window.illuRoundRectAdjustHandleLocal(ed.lx, ed.ly, w, h, r)
                    : { x: ed.lx + r, y: ed.ly + r * 0.35 };
            out.push(shapeAdjustHandleToWorld(ed, local, 'adj-round'));
        } else if (ed.kind === 'triangle') {
            const st = {
                x: ed.lx,
                y: ed.ly,
                w: ed.w,
                h: ed.h,
                adj: ed.adj != null ? ed.adj : 0.5,
                vf: ed.vf != null ? ed.vf : 0
            };
            ['l', 'r'].forEach((side) => {
                const local =
                    typeof window.illuTriangleAdjustHandleLocal === 'function'
                        ? window.illuTriangleAdjustHandleLocal(st, side)
                        : side === 'r'
                          ? { x: ed.lx + ed.w * 0.75, y: ed.ly + ed.h * 0.28 }
                          : { x: ed.lx + ed.w * 0.25, y: ed.ly + ed.h * 0.28 };
                out.push(shapeAdjustHandleToWorld(ed, local, side === 'r' ? 'adj-tri-r' : 'adj-tri-l'));
            });
        } else if (ed.kind === 'quad' && ed.pts && ed._quadCornerEdit) {
            for (let i = 0; i < 4; i++) {
                out.push(shapeAdjustHandleToWorld(ed, ed.pts[i], 'adj-quad-' + i));
            }
        } else if (ed.kind === 'callout') {
            const m =
                typeof window.illuCalloutMetrics === 'function'
                    ? window.illuCalloutMetrics(
                          ed.style || 'rect',
                          ed.lx,
                          ed.ly,
                          ed.w,
                          ed.h,
                          typeof window.illuCalloutPathOptsFromEdit === 'function'
                              ? window.illuCalloutPathOptsFromEdit(ed)
                              : {}
                      )
                    : null;
            if (m && typeof window.illuCalloutTailHandleLocal === 'function') {
                out.push(
                    shapeAdjustHandleToWorld(ed, window.illuCalloutTailHandleLocal(m), 'adj-callout-tail')
                );
            }
            if (m && typeof window.illuCalloutTipHandleLocal === 'function') {
                out.push(
                    shapeAdjustHandleToWorld(ed, window.illuCalloutTipHandleLocal(m), 'adj-callout-tip')
                );
            }
            if (ed.style === 'round' && typeof window.illuCalloutRoundHandleLocal === 'function') {
                const r = ed.r != null ? ed.r : EditorManager.toolProps.shapeCornerRadius ?? 12;
                out.push(
                    shapeAdjustHandleToWorld(ed, window.illuCalloutRoundHandleLocal(ed.lx, ed.ly, ed.w, ed.h, r), 'adj-callout-round')
                );
            }
        }
        return out;
    };

    window.getShapeAdjustHandleWorld = function (ed) {
        const all = window.getShapeAdjustHandlesWorld(ed);
        return all.length ? all[0] : null;
    };

    window.hitShapeAdjustHandle = function (worldX, worldY) {
        const ed = window.pixelShapeEdit;
        if (!ed || !EditorManager.activeLayer || ed.layerId !== EditorManager.activeLayer.id) return null;
        const handles =
            typeof window.getShapeAdjustHandlesWorld === 'function'
                ? window.getShapeAdjustHandlesWorld(ed)
                : [];
        for (let i = handles.length - 1; i >= 0; i--) {
            const h = handles[i];
            if (dist(worldX, worldY, h.x, h.y) <= hitRadiusDoc()) return h.type;
        }
        return null;
    };

    window.updateShapeAdjustFromPointer = function (adjustType, worldX, worldY) {
        const ed = window.pixelShapeEdit;
        if (!ed || !EditorManager.activeLayer) return;
        const wx = worldX - EditorManager.activeLayer.x;
        const wy = worldY - EditorManager.activeLayer.y;
        if (adjustType === 'adj-round' && ed.kind === 'roundrect') {
            const r =
                typeof window.illuRoundRectRadiusFromLocalDrag === 'function'
                    ? window.illuRoundRectRadiusFromLocalDrag(ed.lx, ed.ly, ed.w, ed.h, wx, wy)
                    : Math.max(0, Math.min(wx - ed.lx, wy - ed.ly, ed.w / 2, ed.h / 2));
            ed.r = r;
            EditorManager.toolProps.shapeCornerRadius = r;
            const sc = document.getElementById('tool-shape-corner-radius');
            const scv = document.getElementById('tool-shape-corner-radius-val');
            const crCap =
                typeof window.illuClampShapeCornerRadius === 'function'
                    ? window.illuClampShapeCornerRadius(r)
                    : Math.max(0, Math.min(256, r));
            if (sc) sc.value = String(crCap);
            if (scv) scv.textContent = String(crCap);
        } else if (
            (adjustType === 'adj-tri' || adjustType === 'adj-tri-l') &&
            ed.kind === 'triangle'
        ) {
            ed.adj = ed.w > 0 ? Math.max(0, Math.min(1, (wx - ed.lx) / ed.w)) : 0.5;
        } else if (adjustType === 'adj-tri-r' && ed.kind === 'triangle') {
            ed.vf = ed.h > 0 ? Math.max(0, Math.min(0.92, (wy - ed.ly) / ed.h)) : 0;
        } else if (adjustType.startsWith('adj-quad-') && ed.kind === 'quad' && ed.pts) {
            const idx = parseInt(adjustType.slice('adj-quad-'.length), 10);
            if (idx >= 0 && idx < 4) {
                ed.pts[idx] = { x: wx, y: wy };
                if (typeof window.illuSyncShapeEditBBoxFromQuadPts === 'function') {
                    window.illuSyncShapeEditBBoxFromQuadPts(ed);
                }
            }
        } else if (adjustType === 'adj-callout-tail' && ed.kind === 'callout') {
            if (typeof window.illuCalloutSetTailFromWorld === 'function') {
                window.illuCalloutSetTailFromWorld(ed, wx, wy);
            }
        } else if (adjustType === 'adj-callout-tip' && ed.kind === 'callout') {
            if (typeof window.illuCalloutSetTipFromWorld === 'function') {
                window.illuCalloutSetTipFromWorld(ed, wx, wy);
            }
        } else if (adjustType === 'adj-callout-round' && ed.kind === 'callout' && ed.style === 'round') {
            const r =
                typeof window.illuRoundRectRadiusFromLocalDrag === 'function'
                    ? window.illuRoundRectRadiusFromLocalDrag(ed.lx, ed.ly, ed.w, ed.h, wx, wy)
                    : Math.max(0, Math.min(wx - ed.lx, wy - ed.ly, ed.w / 2, ed.h / 2));
            ed.r = r;
            EditorManager.toolProps.shapeCornerRadius = r;
            const sc = document.getElementById('tool-shape-corner-radius');
            const scv = document.getElementById('tool-shape-corner-radius-val');
            const crCap =
                typeof window.illuClampShapeCornerRadius === 'function'
                    ? window.illuClampShapeCornerRadius(r)
                    : Math.max(0, Math.min(256, r));
            if (sc) sc.value = String(crCap);
            if (scv) scv.textContent = String(crCap);
        }
        window.redrawShapeFromEditLive();
    };

    window.illuMovePixelShapeEditByDelta = function (dx, dy) {
        const ed = window.pixelShapeEdit;
        const layer = EditorManager.activeLayer;
        if (!ed || !layer || ed.layerId !== layer.id || (dx === 0 && dy === 0)) return false;
        if (ed.kind === 'quad' && ed.pts) {
            ed.pts.forEach((p) => {
                p.x += dx;
                p.y += dy;
            });
            if (typeof window.illuSyncShapeEditBBoxFromQuadPts === 'function') {
                window.illuSyncShapeEditBBoxFromQuadPts(ed);
            }
        } else if (
            ed.kind === 'rect' ||
            ed.kind === 'roundrect' ||
            ed.kind === 'triangle' ||
            ed.kind === 'star' ||
            ed.kind === 'poly' ||
            (ed.kind === 'quad' && ed.quadPreset) ||
            ed.kind === 'callout'
        ) {
            if (ed.docX != null) {
                ed.docX = (ed.docX + dx) | 0;
                ed.docY = (ed.docY + dy) | 0;
                if (typeof window.illuSyncPixelShapeEditLocalsFromDoc === 'function') {
                    window.illuSyncPixelShapeEditLocalsFromDoc(ed);
                }
            } else {
                ed.lx += dx;
                ed.ly += dy;
            }
        } else if (ed.kind === 'line') {
            ed.x1 += dx;
            ed.y1 += dy;
            ed.x2 += dx;
            ed.y2 += dy;
            if (ed.isCubic && ed.cx1 != null) {
                ed.cx1 += dx; ed.cy1 += dy;
                ed.cx2 += dx; ed.cy2 += dy;
            }
        } else if (ed.kind === 'ellipse') {
            ed.cx += dx;
            ed.cy += dy;
        } else {
            return false;
        }
        window.redrawShapeFromEdit();
        if (typeof window.refreshPixelShapeEditOverlay === 'function') {
            window.refreshPixelShapeEditOverlay({ forceFull: true });
        }
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
        EditorManager.saveHistory('Centrage forme', { patchActiveLayer: true });
        EditorManager.render({ flushUiThumbnails: true });
        if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
        return true;
    };

    window.captureShapeEditAfterDraw = function (kind, params, opts, angleRad) {
        if (!EditorManager.activeLayer || !window._shapeBackupCanvas) return;
        const layer = EditorManager.activeLayer;
        if (kind === 'callout' && params.tailT == null && params.tailX == null) {
            if (
                typeof EditorManager !== 'undefined' &&
                EditorManager.toolProps &&
                EditorManager.toolProps.calloutTailT != null &&
                Number.isFinite(Number(EditorManager.toolProps.calloutTailT))
            ) {
                params.tailT = EditorManager.toolProps.calloutTailT;
            } else {
                params.tailX =
                    EditorManager.toolProps && EditorManager.toolProps.calloutTailX != null
                        ? EditorManager.toolProps.calloutTailX
                        : 0.5;
            }
        }
        window.pixelShapeEdit = {
            kind,
            ...params,
            angleRad: angleRad || 0,
            backup: window._shapeBackupCanvas,
            backupOriginX:
                window._shapeBackupOriginX != null
                    ? window._shapeBackupOriginX | 0
                    : layer.x | 0,
            backupOriginY:
                window._shapeBackupOriginY != null
                    ? window._shapeBackupOriginY | 0
                    : layer.y | 0,
            captureLayerX: layer.x | 0,
            captureLayerY: layer.y | 0,
            layerId: layer.id,
            opts: { ...opts }
        };
        if (typeof window.illuSyncPixelShapeEditDocFromLocals === 'function') {
            window.illuSyncPixelShapeEditDocFromLocals(window.pixelShapeEdit);
        }
        window._shapeBackupCanvas = null;
        if (typeof window.refreshPixelShapeEditOverlay === 'function') {
            window.refreshPixelShapeEditOverlay({ forceFull: true });
        }
        if (typeof EditorManager.drawUI === 'function') EditorManager.drawUI(true);
    };

    window.drawPixelOverlayHandles = function (svgUI) {
        if (!svgUI) return;
        const isPixel = EditorManager.mode !== 'vector';
        if (!isPixel && typeof window.vectorQuadBezierClickState !== 'undefined' && window.vectorQuadBezierClickState) {
            const z = EditorManager.getCanvasZoomLevel();
            const inv = 1 / z;
            const st = window.vectorQuadBezierClickState;
            const mkDot = (x, y, fill) => {
                const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                c.setAttribute('cx', String(x));
                c.setAttribute('cy', String(y));
                c.setAttribute('r', String(5 * inv));
                c.setAttribute('fill', fill);
                c.setAttribute('stroke', '#003d7a');
                c.setAttribute('stroke-width', String(inv));
                c.setAttribute('vector-effect', 'non-scaling-stroke');
                c.setAttribute('pointer-events', 'none');
                svgUI.appendChild(c);
            };
            if (st.p0) mkDot(st.p0.x, st.p0.y, '#ffe08a');
            if (st.p1) mkDot(st.p1.x, st.p1.y, '#ffb84d');
        }
        if (!isPixel) return;

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

        const mkShapeRotHandle = (wx, wy) => {
            const rotR = EditorManager.svgUiRotationHandleRadiusDoc();
            const rh = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            rh.setAttribute('cx', wx);
            rh.setAttribute('cy', wy);
            rh.setAttribute('r', String(rotR));
            rh.setAttribute('fill', '#aecbfa');
            rh.setAttribute('stroke', '#000000');
            rh.setAttribute('stroke-width', String(inv));
            rh.setAttribute('style', `cursor:${typeof window.illuGrabCursor === 'function' ? window.illuGrabCursor() : 'grab'};pointer-events:all;touch-action:none;`);
            rh.setAttribute('data-pixel-handle', 'shape-rot');
            svgUI.appendChild(rh);
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

        const mkAdjustHandle = (wx, wy, label) => {
            const s = Math.max(5, EditorManager.svgUiHandleSizeDoc() * 0.55);
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            p.setAttribute(
                'points',
                [
                    [wx, wy - s],
                    [wx + s, wy],
                    [wx, wy + s],
                    [wx - s, wy]
                ]
                    .map(([a, b]) => `${a},${b}`)
                    .join(' ')
            );
            p.setAttribute('class', 'svg-adjust-anchor');
            p.setAttribute('fill', '#ffd966');
            p.setAttribute('stroke', '#b8860b');
            p.setAttribute('stroke-width', String(inv));
            p.setAttribute('style', 'cursor:move;pointer-events:all;');
            p.setAttribute('data-pixel-handle', label);
            svgUI.appendChild(p);
        };

        const ed = window.pixelShapeEdit;
        if (ed && EditorManager.activeLayer && ed.layerId === EditorManager.activeLayer.id) {
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
            const adjHandles =
                typeof window.getShapeAdjustHandlesWorld === 'function'
                    ? window.getShapeAdjustHandlesWorld(ed)
                    : [];
            adjHandles.forEach((h) => mkAdjustHandle(h.x, h.y, h.type));
            if (SHAPE_ROTATABLE_KINDS.has(ed.kind)) {
                const sb = shapeEditBoundsDoc(ed);
                if (sb) {
                    const rhp = EditorManager.selectionRotationHandleDocXY(sb, ed.angleRad || 0, null);
                    mkShapeRotHandle(rhp.x, rhp.y);
                }
            }
            const movePivot = shapeEditRotationPivotDoc(ed);
            if (movePivot) {
                const hsz = EditorManager.svgUiHandleSizeDoc();
                const size = EditorManager.svgUiMoveButtonSizeDoc();
                const half = size / 2;
                const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
                fo.setAttribute('x', String(movePivot.cx - half));
                fo.setAttribute('y', String(movePivot.cy - half));
                fo.setAttribute('width', String(size));
                fo.setAttribute('height', String(size));
                fo.setAttribute('class', 'illu-deform-move-fo');
                fo.setAttribute('style', 'overflow: visible; pointer-events: all;');
                const wrap = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
                wrap.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
                wrap.style.cssText =
                    'display:flex;align-items:center;justify-content:center;width:100%;height:100%;margin:0;padding:0;box-sizing:border-box;';
                const btn = document.createElementNS('http://www.w3.org/1999/xhtml', 'button');
                btn.setAttribute('type', 'button');
                btn.setAttribute('class', 'illu-pixel-text-move-btn illu-deform-selection-move-btn');
                btn.innerHTML =
                    '<i class="fa-solid fa-arrows-up-down-left-right illu-deform-move-icon" aria-hidden="true"></i>';
                const moveTitle =
                    window.IlluI18n && typeof window.IlluI18n.t === 'function'
                        ? window.IlluI18n.t('tools.shapeMoveHandle')
                        : 'Déplacer (forme)';
                btn.setAttribute('title', moveTitle);
                btn.setAttribute('aria-label', moveTitle);
                const runShapeMove = (ev) => {
                    if (ev.button != null && ev.button !== 0) return;
                    ev.preventDefault();
                    ev.stopPropagation();
                    if (typeof window.illuShapeEditMoveButtonMouseDown === 'function') {
                        window.illuShapeEditMoveButtonMouseDown(ev);
                    }
                    if (ev.pointerId != null) {
                        try {
                            window._illuShapeEditMoveFromButtonEl = btn;
                            window._illuShapeEditMoveFromButtonPointerId = ev.pointerId;
                            btn.setPointerCapture(ev.pointerId);
                        } catch (err) {
                            /* ignore */
                        }
                    }
                };
                const releaseShapeMoveCapture = (ev) => {
                    if (ev.button != null && ev.button !== 0) return;
                    if (typeof window.illuHandleMouseUp === 'function') {
                        window.illuHandleMouseUp(ev);
                    }
                    if (typeof window.illuReleaseShapeEditMoveButtonPointerCapture === 'function') {
                        window.illuReleaseShapeEditMoveButtonPointerCapture();
                    }
                };
                btn.addEventListener('pointerup', releaseShapeMoveCapture, { capture: true });
                btn.addEventListener('mouseup', releaseShapeMoveCapture, { capture: true });
                btn.addEventListener('pointercancel', releaseShapeMoveCapture, { capture: true });
                btn.addEventListener('lostpointercapture', releaseShapeMoveCapture, { capture: true });
                btn.addEventListener('pointerdown', runShapeMove, { passive: false });
                wrap.appendChild(btn);
                fo.appendChild(wrap);
                svgUI.appendChild(fo);
            }
        }

        if (
            typeof window.illuIsShapeLiveDrawSession === 'function' &&
            window.illuIsShapeLiveDrawSession() &&
            typeof window.getLiveShapeDocBounds === 'function' &&
            window._shapeLiveStartX != null
        ) {
            const pos = window._illuLastPointerDoc || {
                x: window._shapeLiveStartX,
                y: window._shapeLiveStartY
            };
            const b = window.getLiveShapeDocBounds(
                pos,
                window._shapeLiveStartX,
                window._shapeLiveStartY,
                !!window._shiftConstraintProportions
            );
            if (b.w >= 2 && b.h >= 2) {
                const rhp = EditorManager.selectionRotationHandleDocXY(
                    b,
                    window._shapeLivePreviewAngleRad || 0,
                    null
                );
                mkShapeRotHandle(rhp.x, rhp.y);
            }
        }
    };

    window.onEditorColorsChanged = function () {
        if (window._pixelGradientState && window.activeTool === 'gradient') {
            window.paintGradientFromState();
        }
        if (
            typeof window.illuRepaintShapeLiveDrawPreview === 'function' &&
            window.illuRepaintShapeLiveDrawPreview()
        ) {
            /* aperçu forme en cours de tracé */
        } else if (
            window.pixelShapeEdit &&
            ['rect', 'circle', 'line', 'round-3', 'triangle', 'cubic-3'].includes(window.activeTool)
        ) {
            window.redrawShapeFromEditLive();
        }
        if (window.VectorEngine && typeof window.VectorEngine.refreshLiveDrawPreview === 'function') {
            window.VectorEngine.refreshLiveDrawPreview();
        }
        if (typeof window.syncPixelTextEditorStyles === 'function') window.syncPixelTextEditorStyles();
        if (typeof window.syncVectorTextEditorStyles === 'function') window.syncVectorTextEditorStyles();
        // Mode vecteur : primaire = remplissage, secondaire = contour (sans réinitialiser l’épaisseur)
        if (window.EditorManager && EditorManager.mode === 'vector') {
            if (
                EditorManager.activeVectorSelection &&
                EditorManager.activeVectorSelection.length &&
                typeof EditorManager.applyVectorColorFromPicker === 'function'
            ) {
                EditorManager.applyVectorColorFromPicker();
            } else if (window.VectorEngine && typeof window.VectorEngine.applyStyleToSelection === 'function') {
                window.VectorEngine.applyStyleToSelection();
            }
        } else if (typeof window.refreshVectorDraftFromEditor === 'function') {
            window.refreshVectorDraftFromEditor();
        }
    };
})();
