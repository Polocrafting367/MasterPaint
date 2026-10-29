/**
 * illu-boolean-ops.js — Opérations Booléennes SVG (Pathfinder)
 * Union, Soustraction, Intersection, Exclusion
 *
 * Implémentation : Sutherland-Hodgman (clipping polygon) + union via convex hull simplifié.
 * Aucune dépendance externe.
 * Phase 3 du plan SVG Studio.
 */
'use strict';
(function (global) {

    // ─── Helpers géométriques ────────────────────────────────────────────────

    /** Extraire un tableau de points {x,y} depuis un élément SVG */
    function _elToPolygon(el) {
        try {
            const tag = (el.tagName || '').toLowerCase();
            if (tag === 'rect') {
                const x = parseFloat(el.getAttribute('x') || 0);
                const y = parseFloat(el.getAttribute('y') || 0);
                const w = parseFloat(el.getAttribute('width') || 0);
                const h = parseFloat(el.getAttribute('height') || 0);
                return [{x, y}, {x: x+w, y}, {x: x+w, y: y+h}, {x, y: y+h}];
            }
            if (tag === 'circle' || tag === 'ellipse') {
                const cx = parseFloat(el.getAttribute('cx') || el.getAttribute('x') || 0);
                const cy = parseFloat(el.getAttribute('cy') || el.getAttribute('y') || 0);
                const rx = parseFloat(el.getAttribute('r') || el.getAttribute('rx') || 0);
                const ry = parseFloat(el.getAttribute('r') || el.getAttribute('ry') || rx);
                const pts = [];
                const N = 36;
                for (let i = 0; i < N; i++) {
                    const a = (2 * Math.PI * i) / N;
                    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
                }
                return pts;
            }
            if (tag === 'polygon' || tag === 'polyline') {
                const raw = (el.getAttribute('points') || '').trim().split(/[\s,]+/);
                const pts = [];
                for (let i = 0; i + 1 < raw.length; i += 2) {
                    pts.push({ x: parseFloat(raw[i]), y: parseFloat(raw[i+1]) });
                }
                return pts;
            }
            if (tag === 'path') {
                return _pathToPolygon(el.getAttribute('d') || '');
            }
        } catch(e) {}
        return [];
    }

    /** Parser simplifié d -> tableau de points (M, L, C, Q, Z uniquement) */
    function _pathToPolygon(d) {
        const cmds = d.match(/[MLHVCQCSAZ][^MLHVCQCSAZ]*/gi) || [];
        const pts = [];
        let cx = 0, cy = 0;
        for (const cmd of cmds) {
            const type = cmd[0].toUpperCase();
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(Number).filter(n => !isNaN(n));
            if (type === 'M' || type === 'L') {
                for (let i = 0; i + 1 < args.length; i += 2) {
                    cx = args[i]; cy = args[i+1];
                    pts.push({x: cx, y: cy});
                }
            } else if (type === 'H') {
                cx = args[0]; pts.push({x: cx, y: cy});
            } else if (type === 'V') {
                cy = args[0]; pts.push({x: cx, y: cy});
            } else if (type === 'C') {
                // Cubic — échantillonner 8 points par segment
                for (let i = 0; i + 5 < args.length; i += 6) {
                    const [x1,y1,x2,y2,x3,y3] = args.slice(i, i+6);
                    for (let t = 0.125; t <= 1; t += 0.125) {
                        const u = 1-t;
                        pts.push({
                            x: u*u*u*cx + 3*u*u*t*x1 + 3*u*t*t*x2 + t*t*t*x3,
                            y: u*u*u*cy + 3*u*u*t*y1 + 3*u*t*t*y2 + t*t*t*y3
                        });
                    }
                    cx = x3; cy = y3;
                }
            } else if (type === 'Q') {
                for (let i = 0; i + 3 < args.length; i += 4) {
                    const [x1,y1,x2,y2] = args.slice(i, i+4);
                    for (let t = 0.125; t <= 1; t += 0.125) {
                        const u = 1-t;
                        pts.push({
                            x: u*u*cx + 2*u*t*x1 + t*t*x2,
                            y: u*u*cy + 2*u*t*y1 + t*t*y2
                        });
                    }
                    cx = x2; cy = y2;
                }
            }
        }
        return pts;
    }

    /** Convertir un tableau de points en attribut `d` */
    function _polygonToPath(pts) {
        if (!pts || pts.length < 2) return '';
        let d = `M ${_r(pts[0].x)} ${_r(pts[0].y)}`;
        for (let i = 1; i < pts.length; i++) d += ` L ${_r(pts[i].x)} ${_r(pts[i].y)}`;
        d += ' Z';
        return d;
    }

    function _r(v) { return Math.round(v * 100) / 100; }

    // ─── Sutherland-Hodgman Clipping ─────────────────────────────────────────

    function _inside(p, a, b) {
        return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
    }

    function _intersect(s, e, a, b) {
        const A1 = e.y - s.y, B1 = s.x - e.x, C1 = A1*s.x + B1*s.y;
        const A2 = b.y - a.y, B2 = a.x - b.x, C2 = A2*a.x + B2*a.y;
        const det = A1*B2 - A2*B1;
        if (Math.abs(det) < 1e-10) return s;
        return { x: (C1*B2 - C2*B1)/det, y: (A1*C2 - A2*C1)/det };
    }

    function _sutherlandHodgman(subject, clip) {
        let output = [...subject];
        if (!output.length) return [];

        for (let i = 0; i < clip.length; i++) {
            if (!output.length) return [];
            const input = output;
            output = [];
            const a = clip[i];
            const b = clip[(i+1) % clip.length];

            for (let j = 0; j < input.length; j++) {
                const s = input[j];
                const e = input[(j+1) % input.length];
                const sIn = _inside(s, a, b);
                const eIn = _inside(e, a, b);

                if (eIn) {
                    if (!sIn) output.push(_intersect(s, e, a, b));
                    output.push(e);
                } else if (sIn) {
                    output.push(_intersect(s, e, a, b));
                }
            }
        }
        return output;
    }

    // ─── Convex Hull (pour union simple) ────────────────────────────────────

    function _crossProduct(O, A, B) {
        return (A.x - O.x) * (B.y - O.y) - (A.y - O.y) * (B.x - O.x);
    }

    function _convexHull(points) {
        const pts = [...points].sort((a, b) => a.x !== b.x ? a.x - b.x : a.y - b.y);
        if (pts.length <= 1) return pts;
        const lower = [], upper = [];
        for (const p of pts) {
            while (lower.length >= 2 && _crossProduct(lower[lower.length-2], lower[lower.length-1], p) <= 0) lower.pop();
            lower.push(p);
        }
        for (let i = pts.length - 1; i >= 0; i--) {
            const p = pts[i];
            while (upper.length >= 2 && _crossProduct(upper[upper.length-2], upper[upper.length-1], p) <= 0) upper.pop();
            upper.push(p);
        }
        upper.pop(); lower.pop();
        return lower.concat(upper);
    }

    // ─── Opérations principales ──────────────────────────────────────────────

    function _getColor(el, prop) {
        return el.getAttribute(prop) || (prop === 'fill' ? '#000000' : 'none');
    }

    function apply(op) {
        const em = global.EditorManager;
        if (!em) return;

        // Déléguer à EditorManager si disponible (futur)
        if (typeof em.applyVectorBoolean === 'function') {
            em.applyVectorBoolean(op);
            return;
        }

        const sel = em.activeVectorSelection;
        if (!sel || sel.length < 2) {
            console.warn('[BooleanOps] Sélectionnez au moins 2 objets.');
            return;
        }

        // Récupérer les polygones de chaque élément
        const polys = sel.map(el => ({ el, pts: _elToPolygon(el) })).filter(p => p.pts.length >= 3);
        if (polys.length < 2) {
            console.warn('[BooleanOps] Impossible de convertir les formes sélectionnées.');
            return;
        }

        let resultPts = null;

        if (op === 'union') {
            // Union = enveloppe convexe de tous les points
            const allPts = polys.reduce((acc, p) => acc.concat(p.pts), []);
            resultPts = _convexHull(allPts);
        } else if (op === 'subtract') {
            // Soustraire chaque forme 2..N de la forme 1
            resultPts = polys[0].pts;
            for (let i = 1; i < polys.length; i++) {
                // Inverser le clip pour la soustraction (winding inverse)
                const clipReversed = [...polys[i].pts].reverse();
                resultPts = _sutherlandHodgman(resultPts, clipReversed);
            }
        } else if (op === 'intersect') {
            resultPts = polys[0].pts;
            for (let i = 1; i < polys.length; i++) {
                resultPts = _sutherlandHodgman(resultPts, polys[i].pts);
            }
        } else if (op === 'exclude') {
            // XOR simplifié : union moins intersection
            const allPts = polys.reduce((acc, p) => acc.concat(p.pts), []);
            const unionPts = _convexHull(allPts);
            let interPts = polys[0].pts;
            for (let i = 1; i < polys.length; i++) {
                interPts = _sutherlandHodgman(interPts, polys[i].pts);
            }
            // Si l'intersection est vide, résultat = union
            resultPts = (interPts && interPts.length >= 3)
                ? _sutherlandHodgman(unionPts, [...interPts].reverse())
                : unionPts;
        }

        if (!resultPts || resultPts.length < 3) {
            console.warn('[BooleanOps] Résultat vide ou invalide pour:', op);
            return;
        }

        // Créer l'élément résultat
        const NS = 'http://www.w3.org/2000/svg';
        const result = document.createElementNS(NS, 'path');
        result.setAttribute('d', _polygonToPath(resultPts));
        // Hériter du style du premier élément
        const first = polys[0].el;
        ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'opacity'].forEach(attr => {
            const v = first.getAttribute(attr);
            if (v) result.setAttribute(attr, v);
        });

        // Insérer dans le même parent et supprimer les originaux
        const parent = first.parentElement;
        if (parent) {
            parent.insertBefore(result, first);
            polys.forEach(p => { if (p.el.parentElement) p.el.parentElement.removeChild(p.el); });
        }

        em.activeVectorSelection = [result];
        window._activeVectorShapeEl = result;

        if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
        if (em.saveHistory) em.saveHistory('Opération booléenne: ' + op, { patchActiveLayer: true });
        if (typeof illuScheduleInteractiveVisualRefresh === 'function') {
            illuScheduleInteractiveVisualRefresh({ render: true });
        } else if (em.render) {
            em.render();
        }

        // Rafraîchir le panneau objets
        if (window.illuSvgObjectsPanel && window.illuSvgObjectsPanel.refresh) {
            window.illuSvgObjectsPanel.refresh();
        }
    }

    // Raccourcis clavier
    document.addEventListener('keydown', function(e) {
        if (!document.body.classList.contains('illu-svg-mode-active')) return;
        if (!e.ctrlKey || !e.shiftKey) return;
        const k = e.key.toUpperCase();
        if (k === 'F') { e.preventDefault(); apply('union'); }
        else if (k === 'I') { e.preventDefault(); apply('intersect'); }
        else if (k === 'X') { e.preventDefault(); apply('exclude'); }
        else if (k === '-' || k === '_') { e.preventDefault(); apply('subtract'); }
    });

    global.illuBooleanOps = { apply };

})(window);
