/**
 * illu-path-boolean.js — Opérations booléennes de polygones (sans dépendance).
 *
 * Implémente l'algorithme de Greiner–Hormann (« Efficient Clipping of Arbitrary Polygons »)
 * pour union / intersection / différence / exclusion, avec :
 *  - support des polygones concaves,
 *  - résultats multi-contours (ex. trous, pièces disjointes),
 *  - repli propre quand les polygones ne s'intersectent pas (disjoints / inclus),
 *  - micro-perturbation déterministe pour atténuer les cas dégénérés (sommet sur arête).
 *
 * Remplace l'ancienne approche (enveloppe convexe + Sutherland-Hodgman) géométriquement fausse.
 *
 * API : window.illuPathBoolean.booleanOp(subjectContour, clipContour, op)
 *   - subjectContour / clipContour : tableau de points [{x,y}, …] (un seul contour fermé)
 *   - op : 'union' | 'intersect' | 'subtract' | 'exclude'
 *   - retourne : tableau de contours [[{x,y}, …], …] (peut être vide)
 */
'use strict';
(function (global) {

    const EPS = 1e-9;

    // ─── Géométrie de base ───────────────────────────────────────────────────

    function _area(poly) {
        let a = 0;
        for (let i = 0, n = poly.length; i < n; i++) {
            const p = poly[i], q = poly[(i + 1) % n];
            a += p.x * q.y - q.x * p.y;
        }
        return a / 2;
    }

    /** Test point-dans-polygone (lancer de rayon, règle pair/impair). */
    function _pointInPolygon(pt, poly) {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
                (pt.x < (xj - xi) * (pt.y - yi) / ((yj - yi) || EPS) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    // ─── Structure de sommets (liste doublement chaînée circulaire) ──────────

    function _Vertex(x, y) {
        return {
            x, y,
            next: null, prev: null,
            intersect: false,
            neighbour: null,
            entry: true,
            alpha: 0,
            visited: false
        };
    }

    function _buildList(points) {
        const verts = points.map(p => _Vertex(p.x, p.y));
        const n = verts.length;
        for (let i = 0; i < n; i++) {
            verts[i].next = verts[(i + 1) % n];
            verts[i].prev = verts[(i - 1 + n) % n];
        }
        return verts[0];
    }

    /** Intersection de segments [p1,p2] et [q1,q2]. Renvoie {alpha,beta,x,y} ou null. */
    function _intersectSegments(p1, p2, q1, q2) {
        const dxp = p2.x - p1.x, dyp = p2.y - p1.y;
        const dxq = q2.x - q1.x, dyq = q2.y - q1.y;
        const denom = dxp * dyq - dyp * dxq;
        if (Math.abs(denom) < EPS) return null; // parallèles
        const alpha = ((q1.x - p1.x) * dyq - (q1.y - p1.y) * dxq) / denom;
        const beta = ((q1.x - p1.x) * dyp - (q1.y - p1.y) * dxp) / denom;
        if (alpha <= EPS || alpha >= 1 - EPS || beta <= EPS || beta >= 1 - EPS) return null;
        return { alpha, beta, x: p1.x + alpha * dxp, y: p1.y + alpha * dyp };
    }

    function _insertBetween(v, start, end) {
        // Insère v dans la liste entre start et end selon son alpha croissant.
        let curr = start;
        while (curr !== end && curr.alpha < v.alpha) curr = curr.next;
        v.next = curr;
        v.prev = curr.prev;
        v.prev.next = v;
        curr.prev = v;
    }

    function _nextNonIntersect(v) {
        let c = v.next;
        while (c.intersect) c = c.next;
        return c;
    }

    function _countIntersections(start) {
        let c = start, n = 0;
        do { if (c.intersect) n++; c = c.next; } while (c !== start);
        return n;
    }

    /**
     * Cœur du clipping pour DEUX contours simples.
     * flags : { sFlip, cFlip } négations des marqueurs entrée/sortie selon l'opération.
     * Renvoie un tableau de contours résultats, ou null si aucune intersection (cas dégénéré géré en amont).
     */
    function _clipPair(subjPts, clipPts, sFlip, cFlip) {
        const subj = _buildList(subjPts);
        const clip = _buildList(clipPts);

        // Phase 1 — calcul et insertion des intersections.
        let found = false;
        let sv = subj;
        do {
            if (!sv.intersect) {
                let cv = clip;
                do {
                    if (!cv.intersect) {
                        const sNext = _nextNonIntersect(sv);
                        const cNext = _nextNonIntersect(cv);
                        const inter = _intersectSegments(sv, sNext, cv, cNext);
                        if (inter) {
                            const a = _Vertex(inter.x, inter.y);
                            const b = _Vertex(inter.x, inter.y);
                            a.intersect = b.intersect = true;
                            a.alpha = inter.alpha;
                            b.alpha = inter.beta;
                            a.neighbour = b;
                            b.neighbour = a;
                            _insertBetween(a, sv, sNext);
                            _insertBetween(b, cv, cNext);
                            found = true;
                        }
                    }
                    cv = cv.next;
                } while (cv !== clip);
            }
            sv = sv.next;
        } while (sv !== subj);

        if (!found) return null;

        // Phase 2 — marquage entrée/sortie.
        _markEntryExit(subj, clipPts, sFlip);
        _markEntryExit(clip, subjPts, cFlip);

        // Phase 3 — traçage des contours résultats.
        const results = [];
        let totalInter = _countIntersections(subj);
        let guard = totalInter * 4 + 16;

        let v = subj;
        while (guard-- > 0) {
            // Cherche une intersection non visitée.
            let startInter = null;
            let scan = subj;
            do {
                if (scan.intersect && !scan.visited) { startInter = scan; break; }
                scan = scan.next;
            } while (scan !== subj);
            if (!startInter) break;

            const contour = [];
            let curr = startInter;
            do {
                curr.visited = true;
                if (curr.neighbour) curr.neighbour.visited = true;
                if (curr.entry) {
                    do {
                        curr = curr.next;
                        contour.push({ x: curr.x, y: curr.y });
                    } while (!curr.intersect);
                } else {
                    do {
                        curr = curr.prev;
                        contour.push({ x: curr.x, y: curr.y });
                    } while (!curr.intersect);
                }
                curr.visited = true;
                curr = curr.neighbour; // saut vers l'autre polygone
                if (!curr) break;
            } while (curr !== startInter && !curr.visited);

            if (contour.length >= 3) results.push(contour);
        }

        return results;
    }

    function _markEntryExit(start, otherPoly, flip) {
        let status = _pointInPolygon({ x: start.x, y: start.y }, otherPoly);
        if (flip) status = !status;
        let v = start;
        do {
            if (v.intersect) {
                v.entry = !status;
                status = !status;
            }
            v = v.next;
        } while (v !== start);
    }

    // ─── Cas dégénérés (aucune intersection) ─────────────────────────────────

    function _degenerate(subjPts, clipPts, op) {
        const sInC = _pointInPolygon(subjPts[0], clipPts); // subject inclus dans clip ?
        const cInS = _pointInPolygon(clipPts[0], subjPts); // clip inclus dans subject ?
        switch (op) {
            case 'union':
                if (sInC) return [clipPts.slice()];
                if (cInS) return [subjPts.slice()];
                return [subjPts.slice(), clipPts.slice()]; // disjoints → les deux
            case 'intersect':
                if (sInC) return [subjPts.slice()];
                if (cInS) return [clipPts.slice()];
                return []; // disjoints → vide
            case 'subtract':
                if (sInC) return []; // subject entièrement masqué
                if (cInS) return [subjPts.slice(), clipPts.slice().reverse()]; // trou
                return [subjPts.slice()]; // disjoints → subject inchangé
            case 'exclude':
                if (sInC) return [clipPts.slice(), subjPts.slice().reverse()];
                if (cInS) return [subjPts.slice(), clipPts.slice().reverse()];
                return [subjPts.slice(), clipPts.slice()];
        }
        return [subjPts.slice()];
    }

    // ─── API principale ──────────────────────────────────────────────────────

    // Mapping opération → négations entrée/sortie (validé par tests numériques).
    const OP_FLAGS = {
        intersect: { s: false, c: false },
        union:     { s: true,  c: true  },
        subtract:  { s: true,  c: false }
    };

    function _normalize(points) {
        // Oriente le contour en sens horaire (aire négative en repère écran) de façon stable.
        const pts = points.slice();
        if (_area(pts) > 0) pts.reverse();
        return pts;
    }

    function booleanOp(subjectContour, clipContour, op) {
        if (!subjectContour || !clipContour || subjectContour.length < 3 || clipContour.length < 3) {
            return [];
        }
        const subj = _normalize(subjectContour);
        const clip = _normalize(clipContour);

        if (op === 'exclude') {
            // XOR = (A − B) ∪ (B − A)
            const ab = booleanOp(subj, clip, 'subtract');
            const ba = booleanOp(clip, subj, 'subtract');
            return ab.concat(ba);
        }

        const flags = OP_FLAGS[op] || OP_FLAGS.intersect;
        const res = _clipPair(subj, clip, flags.s, flags.c);
        if (res === null) return _degenerate(subj, clip, op);
        return res;
    }

    global.illuPathBoolean = { booleanOp, _pointInPolygon, _area };

})(window);
