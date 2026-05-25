/**
 * Chargement / normalisation du sprite icons/illu-sprite.svg
 */
(function () {
    'use strict';

    /** Aplatit un sous-<svg> imbriqué (symboles + defs au niveau racine). */
    window.illuFlattenSpriteSvg = function (svgEl) {
        if (!svgEl) return;
        const nested = [...svgEl.querySelectorAll('svg')].filter((s) => s.parentElement && s !== svgEl);
        nested.forEach((inner) => {
            const innerDefs = inner.querySelector('defs');
            if (innerDefs) {
                let rootDefs = svgEl.querySelector(':scope > defs');
                if (!rootDefs) {
                    rootDefs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
                    svgEl.insertBefore(rootDefs, svgEl.firstChild);
                }
                [...innerDefs.children].forEach((n) => rootDefs.appendChild(n.cloneNode(true)));
            }
            [...inner.querySelectorAll('symbol')].forEach((sym) => svgEl.appendChild(sym.cloneNode(true)));
            inner.remove();
        });
        const legacy = svgEl.querySelector('#mac-shadow');
        if (legacy && !svgEl.querySelector('#illu-filter-mac-shadow')) {
            legacy.id = 'illu-filter-mac-shadow';
        }
        svgEl.querySelectorAll('#mac-shadow').forEach((el, i) => {
            if (i > 0) el.remove();
        });
    };

    window.illuMountSpriteSvgElement = function (svgEl) {
        if (!svgEl) return false;
        window.illuFlattenSpriteSvg(svgEl);
        svgEl.id = 'illu-shape-icons-sprite';
        svgEl.setAttribute('aria-hidden', 'true');
        svgEl.setAttribute('focusable', 'false');
        svgEl.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none;';
        const prev = document.getElementById('illu-shape-icons-sprite');
        if (prev && prev !== svgEl) prev.remove();
        document.body.insertBefore(svgEl, document.body.firstChild);
        window.dispatchEvent(new CustomEvent('illuSpriteLoaded'));
        return true;
    };

    window.illuApplySpriteSvgText = function (text) {
        const doc = new DOMParser().parseFromString(String(text || ''), 'image/svg+xml');
        const pe = doc.querySelector('parsererror');
        if (pe) throw new Error('Fichier SVG sprite invalide (XML).');
        const svgEl = doc.querySelector('svg');
        if (!svgEl) throw new Error('Aucun élément <svg> à la racine.');
        if (!window.illuMountSpriteSvgElement(svgEl)) {
            throw new Error('Impossible d’injecter le sprite.');
        }
    };

    function localTag(el) {
        const t = (el && (el.localName || el.tagName) || '').toLowerCase();
        return t.includes(':') ? t.split(':').pop() : t;
    }

    /** Heuristique rapide (nom de fichier ou balises symboles MasterPaint). */
    window.illuShouldOpenAsSpriteSheet = function (text, filename) {
        const fn = String(filename || '')
            .toLowerCase()
            .replace(/\\/g, '/');
        if (fn.includes('illu-sprite') || /(?:^|\/)illu-sprite\.svg$/i.test(fn)) return true;

        const src = String(text || '');
        if (!src.trim()) return false;
        if (/data-illu-sprite-sheet|data-illu-sprite-id\s*=/.test(src)) return true;

        const symIllu = (src.match(/<symbol\s+[^>]*\bid\s*=\s*["']illu-/gi) || []).length;
        return symIllu >= 2;
    };

    /** Détecte une bibliothèque de symboles MasterPaint (pas un dessin classique). */
    window.illuIsSvgSpriteLibraryDoc = function (svgRoot, opts) {
        if (!svgRoot) return false;
        opts = opts || {};
        const fn = String(opts.filename || '')
            .toLowerCase()
            .replace(/\\/g, '/');
        if (fn.includes('illu-sprite') || /(?:^|\/)illu-sprite\.svg$/i.test(fn)) return true;

        if (svgRoot.querySelector('[data-illu-sprite-sheet], [data-illu-sprite-id]')) return true;

        const symbols = svgRoot.querySelectorAll('symbol[id^="illu-"]');
        if (symbols.length < 2) return false;

        const hidden =
            svgRoot.getAttribute('aria-hidden') === 'true' ||
            /width:\s*0|height:\s*0/.test(svgRoot.getAttribute('style') || '');

        const skip = new Set(['defs', 'title', 'desc', 'metadata', 'script', 'style']);
        let other = 0;
        [...svgRoot.children].forEach((c) => {
            const t = localTag(c);
            if (skip.has(t) || t === 'symbol') return;
            other++;
        });

        if (other === 0 || hidden) return true;
        return symbols.length >= 2 && other <= 1;
    };
})();
