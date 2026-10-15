/**
 * Outils formes dédiés : géométrie, listes d’outils, préparation des paramètres.
 */
(function () {
    'use strict';

    window.ILLU_DRAG_SHAPE_TOOLS = [
        'rect',
        'circle',
        'line',
        'round-3',
        'triangle',
        'star',
        'reg-poly',
        'diamond',
        'trapezoid',
        'parallelogram',
        'triangle-right',
        'callout'
    ];

    window.ILLU_SHAPE_FAMILY_TOOLS = new Set([
        'rect',
        'round-3',
        'triangle',
        'circle',
        'star',
        'reg-poly',
        'diamond',
        'trapezoid',
        'parallelogram',
        'triangle-right',
        'callout'
    ]);

    window.ILLU_SHAPE_DRAWING_TOOLS = new Set([
        ...window.ILLU_DRAG_SHAPE_TOOLS,
        'cubic-3',
        'pen',
        'polygon',
        'line'
    ]);

    function clampSides(n) {
        const v = Math.round(Number(n));
        if (!Number.isFinite(v)) return 6;
        return Math.max(3, Math.min(24, v));
    }
    window.illuClampPolygonSides = clampSides;

    /** Polygone régulier (faces égales, pas d’étoile). */
    window.illuRegularPolygonPoints = function (lx, ly, w, h, sides) {
        const n = clampSides(sides);
        w = Math.max(2, w);
        h = Math.max(2, h);
        const cx = lx + w / 2;
        const cy = ly + h / 2;
        const rx = w / 2;
        const ry = h / 2;
        const pts = [];
        const start = -Math.PI / 2;
        for (let i = 0; i < n; i++) {
            const a = start + (i * 2 * Math.PI) / n;
            pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
        }
        return pts;
    };

    window.illuRegularPolygonPathD = function (lx, ly, w, h, sides) {
        const pts = window.illuRegularPolygonPoints(lx, ly, w, h, sides);
        if (!pts.length) return '';
        let d = `M ${pts[0].x} ${pts[0].y}`;
        for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x} ${pts[i].y}`;
        return d + ' Z';
    };

    window.illuDiamondPoints = function (lx, ly, w, h) {
        const cx = lx + w / 2;
        const cy = ly + h / 2;
        return [
            { x: cx, y: ly },
            { x: lx + w, y: cy },
            { x: cx, y: ly + h },
            { x: lx, y: cy }
        ];
    };

    window.illuTrapezoidPoints = function (lx, ly, w, h) {
        const inset = w * 0.22;
        return [
            { x: lx + inset, y: ly },
            { x: lx + w - inset, y: ly },
            { x: lx + w, y: ly + h },
            { x: lx, y: ly + h }
        ];
    };

    window.illuParallelogramPoints = function (lx, ly, w, h) {
        const skew = w * 0.28;
        return [
            { x: lx + skew, y: ly },
            { x: lx + w, y: ly },
            { x: lx + w - skew, y: ly + h },
            { x: lx, y: ly + h }
        ];
    };

    window.illuRightTrianglePoints = function (lx, ly, w, h) {
        return [
            { x: lx, y: ly },
            { x: lx, y: ly + h },
            { x: lx + w, y: ly + h }
        ];
    };

    window.illuQuadPointsForPreset = function (preset, lx, ly, w, h) {
        if (preset === 'diamond') return window.illuDiamondPoints(lx, ly, w, h);
        if (preset === 'trapezoid') return window.illuTrapezoidPoints(lx, ly, w, h);
        if (preset === 'parallelogram') return window.illuParallelogramPoints(lx, ly, w, h);
        if (preset === 'triangle-right') return window.illuRightTrianglePoints(lx, ly, w, h);
        return window.illuShapeQuadPtsFromRect(lx, ly, w, h);
    };

    function clampTailX(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return 0.5;
        return Math.max(0.08, Math.min(0.92, n));
    }

    function normalizeTailT(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return null;
        let t = n % 1;
        if (t < 0) t += 1;
        return t;
    }

    /** Paramètre 0–1 sur le contour du corps (ancien tailX = position sur le bas du rectangle). */
    function resolveCalloutTailT(opts, w, bodyH, style) {
        opts = opts || {};
        const t = normalizeTailT(opts.tailT);
        if (t != null) return t;
        const tx = opts.tailX != null ? clampTailX(opts.tailX) : 0.5;
        if (style === 'oval') {
            return (0.5 + (tx - 0.5) * 0.55) % 1;
        }
        const P = 2 * (w + bodyH);
        return P > 0 ? (tx * w) / P : 0.5;
    }

    /** Point d’ancrage de la tige sur le contour du corps + normale / tangente sortantes. */
    function illuCalloutAnchorAtT(style, lx, ly, w, bodyH, tailT) {
        style = style || 'rect';
        w = Math.max(8, w);
        bodyH = Math.max(4, bodyH);
        let t = normalizeTailT(tailT);
        if (t == null) t = 0.5;

        if (style === 'oval') {
            const cx = lx + w / 2;
            const cy = ly + bodyH / 2;
            const rx = w / 2;
            const ry = bodyH / 2;
            const theta = t * Math.PI * 2 - Math.PI / 2;
            const x = cx + rx * Math.cos(theta);
            const y = cy + ry * Math.sin(theta);
            let nx = Math.cos(theta) / rx;
            let ny = Math.sin(theta) / ry;
            const nlen = Math.hypot(nx, ny) || 1;
            nx /= nlen;
            ny /= nlen;
            const tx = -Math.sin(theta);
            const ty = Math.cos(theta);
            return { x, y, nx, ny, tx, ty };
        }

        const P = 2 * (w + bodyH);
        let d = t * P;
        let x;
        let y;
        let nx;
        let ny;
        let tx;
        let ty;
        
        // Use corner radius logic if style is round to clamp the anchor
        let r = 0;
        if (style === 'round') {
            // we don't have opts here, so we approximate or use the default
            r = Math.min(12, w / 4, bodyH / 3);
        }
        
        if (d <= w) {
            x = lx + d;
            y = ly + bodyH;
            if (style === 'round') x = Math.max(lx + r, Math.min(lx + w - r, x));
            nx = 0;
            ny = 1;
            tx = 1;
            ty = 0;
        } else if ((d -= w) <= bodyH) {
            x = lx + w;
            y = ly + bodyH - d;
            if (style === 'round') y = Math.max(ly + r, Math.min(ly + bodyH - r, y));
            nx = 1;
            ny = 0;
            tx = 0;
            ty = -1;
        } else if ((d -= bodyH) <= w) {
            x = lx + w - d;
            y = ly;
            if (style === 'round') x = Math.max(lx + r, Math.min(lx + w - r, x));
            nx = 0;
            ny = -1;
            tx = -1;
            ty = 0;
        } else {
            d -= w;
            x = lx;
            y = ly + d;
            if (style === 'round') y = Math.max(ly + r, Math.min(ly + bodyH - r, y));
            nx = -1;
            ny = 0;
            tx = 0;
            ty = 1;
        }
        return { x, y, nx, ny, tx, ty };
    }

    function illuCalloutWorldToTailT(style, lx, ly, w, h, wx, wy, opts) {
        const m = window.illuCalloutMetrics(style, lx, ly, w, h, opts);
        const samples = style === 'oval' ? 96 : 64;
        let bestT = m.tailT;
        let bestD = Infinity;
        for (let i = 0; i < samples; i++) {
            const t = i / samples;
            const a = illuCalloutAnchorAtT(m.style, m.lx, m.ly, m.w, m.bodyH, t);
            const d = (wx - a.x) * (wx - a.x) + (wy - a.y) * (wy - a.y);
            if (d < bestD) {
                bestD = d;
                bestT = t;
            }
        }
        return bestT;
    }

    window.illuCalloutWorldToTailT = illuCalloutWorldToTailT;

    window.illuCalloutSetTailFromWorld = function (ed, wx, wy) {
        if (!ed) return;
        const style = ed.style || 'rect';
        const opts = window.illuCalloutPathOptsFromEdit(ed);
        const t = illuCalloutWorldToTailT(style, ed.lx, ed.ly, ed.w, ed.h, wx, wy, opts);
        ed.tailT = t;
        if (typeof EditorManager !== 'undefined' && EditorManager.toolProps) {
            EditorManager.toolProps.calloutTailT = t;
        }
    };

    window.illuCalloutSetTipFromWorld = function (ed, wx, wy) {
        if (!ed) return;
        const m = window.illuCalloutMetrics(ed.style || 'rect', ed.lx, ed.ly, ed.w, ed.h, window.illuCalloutPathOptsFromEdit(ed));
        ed.tipOffsetX = wx - m.anchor.x;
        ed.tipOffsetY = wy - m.anchor.y;
        if (typeof EditorManager !== 'undefined' && EditorManager.toolProps) {
            EditorManager.toolProps.calloutTipOffsetX = ed.tipOffsetX;
            EditorManager.toolProps.calloutTipOffsetY = ed.tipOffsetY;
        }
    };

    function illuLocalEllipsePathD(cx, cy, rx, ry) {
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

    /** Métriques bulle (corps + tige), coords calque. */
    window.illuCalloutMetrics = function (style, lx, ly, w, h, opts) {
        opts = opts || {};
        style = style || 'rect';
        w = Math.max(8, w);
        h = Math.max(8, h);
        const tailH = Math.max(6, Math.min(h * 0.35, 24));
        const bodyH = Math.max(4, h - tailH);
        const tailT = resolveCalloutTailT(opts, w, bodyH, style);
        const anchor = illuCalloutAnchorAtT(style, lx, ly, w, bodyH, tailT);
        const cx = lx + w / 2;
        const tailW = Math.max(8, Math.min(w * 0.35, w * 0.55));
        const bodyBottom = ly + bodyH;
        let tipX = anchor.x + anchor.nx * tailH;
        let tipY = anchor.y + anchor.ny * tailH;
        
        if (opts.tipOffsetX != null && opts.tipOffsetY != null) {
            tipX = anchor.x + opts.tipOffsetX;
            tipY = anchor.y + opts.tipOffsetY;
        }
        
        return {
            style, lx, ly, w, h, tailH, bodyH, tailT, tailW, cx, anchor, tipX, tipY, bodyBottom
        };
    };

    /** Tige seule (triangle — dessinée en premier). */
    window.illuCalloutTailPathD = function (m) {
        if (!m || !m.anchor) return '';
        const a = m.anchor;
        const half = m.tailW / 2;
        let bx = a.x - a.tx * half;
        let by = a.y - a.ty * half;
        let cx = a.x + a.tx * half;
        let cy = a.y + a.ty * half;
        
        if (m.style === 'rect' || m.style === 'round' || m.style === 'cloud') {
            bx = Math.max(m.lx, Math.min(m.lx + m.w, bx));
            by = Math.max(m.ly, Math.min(m.ly + m.bodyH, by));
            cx = Math.max(m.lx, Math.min(m.lx + m.w, cx));
            cy = Math.max(m.ly, Math.min(m.ly + m.bodyH, cy));
        }
        
        return `M ${bx} ${by} L ${m.tipX} ${m.tipY} L ${cx} ${cy} Z`;
    };

    /** Corps seul (sans traits de tige à l’intérieur). */
    window.illuCalloutBodyPathD = function (m) {
        if (!m) return '';
        const { style, lx, ly, w, bodyH, cx } = m;
        if (style === 'oval') {
            const rx = w / 2;
            const ry = bodyH / 2;
            return illuLocalEllipsePathD(cx, ly + ry, rx, ry);
        }
        if (style === 'cloud') {
            const bx = lx;
            const by = ly;
            const bw = w;
            const bh = bodyH;
            return (
                `M ${bx + bw * 0.2} ${by + bh * 0.85}` +
                ` Q ${bx} ${by + bh * 0.5} ${bx + bw * 0.25} ${by + bh * 0.35}` +
                ` Q ${bx + bw * 0.15} ${by} ${bx + bw * 0.45} ${by + bh * 0.15}` +
                ` Q ${bx + bw * 0.55} ${by} ${bx + bw * 0.75} ${by + bh * 0.2}` +
                ` Q ${bx + bw} ${by + bh * 0.25} ${bx + bw * 0.85} ${by + bh * 0.55}` +
                ` Q ${bx + bw} ${by + bh * 0.75} ${bx + bw * 0.7} ${by + bh * 0.85}` +
                ` L ${bx + bw * 0.82} ${by + bh}` +
                ` L ${bx + bw * 0.18} ${by + bh} Z`
            );
        }
        
        let r = 0;
        if (style === 'round') {
            const rawR = opts.cornerRadius != null ? opts.cornerRadius : 12;
            r = Math.max(0, Math.min(rawR, w / 2, bodyH / 2));
        } else if (style !== 'rect') {
            r = 2;
        }
        
        const x = lx;
        const y = ly;
        const bw = w;
        const bh = bodyH;
        if (r > 1) {
            return (
                `M ${x + r} ${y} H ${x + bw - r} A ${r} ${r} 0 0 1 ${x + bw} ${y + r} ` +
                `V ${y + bh - r} A ${r} ${r} 0 0 1 ${x + bw - r} ${y + bh} H ${x + r} ` +
                `A ${r} ${r} 0 0 1 ${x} ${y + bh - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
            );
        }
        return `M ${x} ${y} L ${x + bw} ${y} L ${x + bw} ${y + bh} L ${x} ${y + bh} Z`;
    };

    /** Poignée jaune : sur le contour du corps (déplacement sur tout le périmètre). */
    window.illuCalloutTailHandleLocal = function (m) {
        if (!m || !m.anchor) return { x: 0, y: 0 };
        return { x: m.anchor.x, y: m.anchor.y };
    };

    /** Poignée jaune pour diriger la queue. */
    window.illuCalloutTipHandleLocal = function (m) {
        if (!m) return { x: 0, y: 0 };
        return { x: m.tipX, y: m.tipY };
    };

    /** Poignée jaune pour diriger l'arrondi (pour style round). */
    window.illuCalloutRoundHandleLocal = function (lx, ly, w, h, r) {
        return { x: lx + r, y: ly + r * 0.35 };
    };

    window.illuCalloutPathOptsFromEdit = function (ed) {
        if (!ed) return {};
        const opts = {};
        if (ed.tailT != null && Number.isFinite(Number(ed.tailT))) opts.tailT = ed.tailT;
        else opts.tailX = ed.tailX != null ? ed.tailX : 0.5;
        if (ed.tipOffsetX != null) opts.tipOffsetX = ed.tipOffsetX;
        if (ed.tipOffsetY != null) opts.tipOffsetY = ed.tipOffsetY;
        if (ed.r != null) opts.cornerRadius = ed.r;
        return opts;
    };

    window.illuCalloutPathOptsFromShape = function (shape) {
        if (!shape || !shape.getAttribute) return {};
        const opts = {};
        const rawT = shape.getAttribute('data-illu-callout-tail-t');
        if (rawT != null) {
            const t = parseFloat(rawT);
            if (Number.isFinite(t)) opts.tailT = t;
        } else {
            const rawX = shape.getAttribute('data-illu-callout-tail-x');
            opts.tailX = rawX != null ? parseFloat(rawX) : 0.5;
        }
        const rawTipX = shape.getAttribute('data-illu-callout-tip-x');
        const rawTipY = shape.getAttribute('data-illu-callout-tip-y');
        if (rawTipX != null && rawTipY != null) {
            opts.tipOffsetX = parseFloat(rawTipX);
            opts.tipOffsetY = parseFloat(rawTipY);
        }
        const rawCorner = shape.getAttribute('data-illu-callout-round');
        if (rawCorner != null) {
            opts.cornerRadius = parseFloat(rawCorner);
        }
        return opts;
    };

    /**
     * Unified continuous path to remove the inner stroke overlapping line,
     * except for cloud style which uses a dream tail of floating circles.
     */
    window.illuCalloutPathD = function (style, lx, ly, w, h, opts) {
        const m = window.illuCalloutMetrics(style, lx, ly, w, h, opts);
        
        if (style === 'cloud') {
            // Dream bubble tail
            const dx = m.tipX - m.anchor.x;
            const dy = m.tipY - m.anchor.y;
            const dist = Math.hypot(dx, dy);
            
            let tailPath = '';
            if (dist > 8) {
                const count = Math.max(1, Math.min(8, Math.floor(dist / 24)));
                const stepX = dx / (count + 1);
                const stepY = dy / (count + 1);
                
                let cx = m.anchor.x;
                let cy = m.anchor.y;
                for (let i = 1; i <= count; i++) {
                    cx += stepX;
                    cy += stepY;
                    const r = 2.5 + (7.5 * (count - i + 1)) / count;
                    tailPath += ` M ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`;
                }
            }
            return window.illuCalloutBodyPathD(m) + tailPath;
        }
        
        const a = m.anchor;
        const half = m.tailW / 2;
        let bx = a.x - a.tx * half;
        let by = a.y - a.ty * half;
        let cx = a.x + a.tx * half;
        let cy = a.y + a.ty * half;
        
        if (style === 'rect' || style === 'round') {
            bx = Math.max(lx, Math.min(lx + w, bx));
            by = Math.max(ly, Math.min(ly + m.bodyH, by));
            cx = Math.max(lx, Math.min(lx + w, cx));
            cy = Math.max(ly, Math.min(ly + m.bodyH, cy));
            
            let r = 0;
            if (style === 'round') {
                const rawR = opts.cornerRadius != null ? opts.cornerRadius : 12;
                r = Math.max(0, Math.min(rawR, w / 2, m.bodyH / 2));
                
                if (a.ny !== 0) {
                    const minX = Math.min(lx + r, lx + w / 2);
                    const maxX = Math.max(lx + w - r, lx + w / 2);
                    bx = Math.max(minX, Math.min(maxX, bx));
                    cx = Math.max(minX, Math.min(maxX, cx));
                } else if (a.nx !== 0) {
                    const minY = Math.min(ly + r, ly + m.bodyH / 2);
                    const maxY = Math.max(ly + m.bodyH - r, ly + m.bodyH / 2);
                    by = Math.max(minY, Math.min(maxY, by));
                    cy = Math.max(minY, Math.min(maxY, cy));
                }
            }

            if (style === 'rect' || style === 'round') {
                let path = `M ${cx} ${cy} `;
                if (a.ny === 1) {
                    path += `L ${lx+w-r} ${ly+m.bodyH} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w} ${ly+m.bodyH-r} `;
                    path += `L ${lx+w} ${ly+r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w-r} ${ly} `;
                    path += `L ${lx+r} ${ly} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx} ${ly+r} `;
                    path += `L ${lx} ${ly+m.bodyH-r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+r} ${ly+m.bodyH} `;
                }
                else if (a.nx === 1) {
                    path += `L ${lx+w} ${ly+r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w-r} ${ly} `;
                    path += `L ${lx+r} ${ly} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx} ${ly+r} `;
                    path += `L ${lx} ${ly+m.bodyH-r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+r} ${ly+m.bodyH} `;
                    path += `L ${lx+w-r} ${ly+m.bodyH} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w} ${ly+m.bodyH-r} `;
                }
                else if (a.ny === -1) {
                    path += `L ${lx+r} ${ly} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx} ${ly+r} `;
                    path += `L ${lx} ${ly+m.bodyH-r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+r} ${ly+m.bodyH} `;
                    path += `L ${lx+w-r} ${ly+m.bodyH} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w} ${ly+m.bodyH-r} `;
                    path += `L ${lx+w} ${ly+r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w-r} ${ly} `;
                }
                else if (a.nx === -1) {
                    path += `L ${lx} ${ly+m.bodyH-r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+r} ${ly+m.bodyH} `;
                    path += `L ${lx+w-r} ${ly+m.bodyH} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w} ${ly+m.bodyH-r} `;
                    path += `L ${lx+w} ${ly+r} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx+w-r} ${ly} `;
                    path += `L ${lx+r} ${ly} `; if (r>0) path += `A ${r} ${r} 0 0 0 ${lx} ${ly+r} `;
                }
                path += `L ${bx} ${by} `;
                path += `L ${m.tipX} ${m.tipY} Z`;
                return path;
            }
        } else if (style === 'oval') {
            const rx = w / 2;
            const ry = m.bodyH / 2;
            const ovalCx = lx + rx;
            const ovalCy = ly + ry;
            const perimeter = 2 * Math.PI * Math.sqrt((rx*rx + ry*ry) / 2);
            const deltaT = half / Math.max(1, perimeter);
            
            const getPt = (t) => {
                const theta = t * Math.PI * 2 - Math.PI / 2;
                return { x: ovalCx + rx * Math.cos(theta), y: ovalCy + ry * Math.sin(theta) };
            };
            
            // For oval, t is CW.
            const ptB = getPt(m.tailT - deltaT);
            const ptC = getPt(m.tailT + deltaT);
            
            return `M ${ptC.x} ${ptC.y} A ${rx} ${ry} 0 1 1 ${ptB.x} ${ptB.y} L ${m.tipX} ${m.tipY} Z`;
        }
        
        return window.illuCalloutTailPathD(m) + ' ' + window.illuCalloutBodyPathD(m);
    };

    window.illuDrawCanvasPolygonFromPoints = function (ctx, pts) {
        if (!pts || !pts.length) return;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.closePath();
    };

    window.illuPrepareShapeToolActivation = function (toolId, opts) {
        opts = opts || {};
        if (typeof EditorManager === 'undefined' || !EditorManager.toolProps) return;
        if (toolId === 'reg-poly' && opts.sides != null) {
            EditorManager.toolProps.polygonSides = clampSides(opts.sides);
            const sl = document.getElementById('tool-polygon-sides');
            const sv = document.getElementById('tool-polygon-sides-val');
            if (sl) sl.value = String(EditorManager.toolProps.polygonSides);
            if (sv) sv.textContent = String(EditorManager.toolProps.polygonSides);
        }
        if (toolId === 'star' && opts.branches != null) {
            const b =
                typeof window.illuClampTriangleBranches === 'function'
                    ? window.illuClampTriangleBranches(opts.branches)
                    : opts.branches;
            EditorManager.toolProps.triangleBranches = Math.max(4, b);
            const sl = document.getElementById('tool-triangle-branches');
            const sv = document.getElementById('tool-triangle-branches-val');
            if (sl) sl.value = String(EditorManager.toolProps.triangleBranches);
            if (sv) sv.textContent = String(EditorManager.toolProps.triangleBranches);
        }
        if (toolId === 'callout' && opts.calloutStyle) {
            EditorManager.toolProps.calloutStyle = opts.calloutStyle;
            document.querySelectorAll('[data-illu-callout-style]').forEach((btn) => {
                const on = btn.getAttribute('data-illu-callout-style') === opts.calloutStyle;
                btn.classList.toggle('active', on);
                btn.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            const hid = document.getElementById('tool-callout-style');
            if (hid) hid.value = opts.calloutStyle;
        }
        if (toolId === 'triangle') {
            EditorManager.toolProps.triangleBranches = 3;
        }
    };

    window.illuShapeToolQuadPreset = function (toolId) {
        if (toolId === 'diamond') return 'diamond';
        if (toolId === 'trapezoid') return 'trapezoid';
        if (toolId === 'parallelogram') return 'parallelogram';
        if (toolId === 'triangle-right') return 'triangle-right';
        return null;
    };

    function writePolygonPoints(shape, pts) {
        if (!shape || !pts || !pts.length) return;
        shape.setAttribute('points', pts.map((p) => `${p.x},${p.y}`).join(' '));
    }

    window.illuRegularPolygonWritePoints = function (shape, x, y, w, h, sides) {
        writePolygonPoints(shape, window.illuRegularPolygonPoints(x, y, w, h, sides));
    };

    window.illuQuadPresetReadState = function (shape) {
        if (!shape || !shape.getAttribute) return null;
        const preset = shape.getAttribute('data-illu-quad-preset');
        if (!preset) return null;
        let x = parseFloat(shape.getAttribute('data-illu-bbox-x'));
        let y = parseFloat(shape.getAttribute('data-illu-bbox-y'));
        let w = parseFloat(shape.getAttribute('data-illu-bbox-w'));
        let h = parseFloat(shape.getAttribute('data-illu-bbox-h'));
        if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(w) || !Number.isFinite(h)) {
            const raw = (shape.getAttribute('points') || '').trim().split(/\s+/);
            const xs = [];
            const ys = [];
            raw.forEach((pair) => {
                const p = pair.split(',');
                if (p.length < 2) return;
                const px = parseFloat(p[0]);
                const py = parseFloat(p[1]);
                if (Number.isFinite(px) && Number.isFinite(py)) {
                    xs.push(px);
                    ys.push(py);
                }
            });
            if (!xs.length) return null;
            x = Math.min(...xs);
            y = Math.min(...ys);
            w = Math.max(...xs) - x;
            h = Math.max(...ys) - y;
        }
        return { x, y, w: Math.max(2, w), h: Math.max(2, h), preset };
    };

    window.illuQuadPresetWritePoints = function (shape, x, y, w, h, preset) {
        w = Math.max(2, w);
        h = Math.max(2, h);
        writePolygonPoints(shape, window.illuQuadPointsForPreset(preset, x, y, w, h));
        if (shape && shape.setAttribute) {
            shape.setAttribute('data-illu-quad-preset', preset);
            shape.setAttribute('data-illu-bbox-x', String(x));
            shape.setAttribute('data-illu-bbox-y', String(y));
            shape.setAttribute('data-illu-bbox-w', String(w));
            shape.setAttribute('data-illu-bbox-h', String(h));
        }
    };

    window.illuPaintCalloutTextOnCtx = function (ctx, text, lx, ly, w, h) {
        if (!ctx || !text || typeof EditorManager === 'undefined') return;
        const tailH = Math.max(6, Math.min(h * 0.35, 24));
        const bodyH = Math.max(4, h - tailH);
        const size = Math.max(10, Math.min(48, EditorManager.toolProps.textSize || 16));
        const font = EditorManager.toolProps.textFont || 'Arial, sans-serif';
        ctx.save();
        ctx.font = `${size}px ${font}`;
        ctx.fillStyle = EditorManager.toolProps.color || '#000000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        wrapFillText(ctx, String(text).trim(), lx + w / 2, ly + bodyH / 2, Math.max(8, w - 10), size * 1.25);
        ctx.restore();
    };

    /** Légendes : pas de saisie texte automatique (outil Texte séparé). */
    window.illuPaintCalloutTextIfRequested = function () {
        return '';
    };

    function wrapFillText(ctx, text, cx, cy, maxW, lineH) {
        const words = text.split(/\s+/);
        const lines = [];
        let line = '';
        words.forEach((w) => {
            const test = line ? line + ' ' + w : w;
            if (ctx.measureText(test).width > maxW && line) {
                lines.push(line);
                line = w;
            } else {
                line = test;
            }
        });
        if (line) lines.push(line);
        const totalH = lines.length * lineH;
        let y = cy - totalH / 2 + lineH / 2;
        lines.forEach((ln) => {
            ctx.fillText(ln, cx, y, maxW);
            y += lineH;
        });
    }
})();
