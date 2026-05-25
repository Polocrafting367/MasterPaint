/**
 * Édition illu-sprite.svg : grille type tableur (une icône par cellule), export au format symboles.
 */
(function () {
    'use strict';

    const NS = 'http://www.w3.org/2000/svg';
    const XHTML = 'http://www.w3.org/1999/xhtml';
    const COLS = 8;
    const CELL_INNER = 48;
    const LABEL_H = 16;
    const CELL_PAD = 6;
    const COL_W = CELL_INNER + CELL_PAD * 2 + 4;
    const ROW_H = CELL_INNER + LABEL_H + CELL_PAD * 2 + 4;
    const CHECKER_PATTERN_ID = 'illu-sprite-checker';

    function parseViewBox(vb) {
        const p = String(vb || '0 0 16 16')
            .trim()
            .split(/[\s,]+/)
            .map(parseFloat)
            .filter((n) => !Number.isNaN(n));
        if (p.length === 4) return { minX: p[0], minY: p[1], w: p[2], h: p[3] };
        return { minX: 0, minY: 0, w: 16, h: 16 };
    }

    function symbolChildren(sym) {
        return sym && sym.children ? [...sym.children] : [];
    }

    function spriteIdPrefix(fullId) {
        const m = String(fullId || '').match(/^(illu-(?:icon|cursor))-/);
        return m ? m[1] : 'illu-icon';
    }

    function spriteShortLabel(fullId) {
        return String(fullId || '')
            .replace(/^illu-(?:icon|cursor)-/, '')
            .trim();
    }

    /** Slug pour id de symbole (a-z, 0-9, tirets). */
    window.illuSanitizeSpriteSymbolSlug = function (text) {
        const s = String(text || '')
            .trim()
            .replace(/\u200b/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return s || 'unnamed';
    };

    window.illuGetSpriteCellLabelText = function (cell) {
        if (!cell) return '';
        const fo = cell.querySelector('[data-illu-sprite-label]');
        const div = fo && fo.querySelector('div[contenteditable]');
        if (!div) return '';
        return String(div.innerText || div.textContent || '')
            .trim()
            .replace(/\u200b/g, '');
    };

    window.illuSpriteSymbolIdFromCell = function (cell) {
        if (!cell) return 'illu-icon-unnamed';
        const prefix = cell.getAttribute('data-illu-sprite-id-prefix') || 'illu-icon';
        const slug =
            typeof window.illuSanitizeSpriteSymbolSlug === 'function'
                ? window.illuSanitizeSpriteSymbolSlug(window.illuGetSpriteCellLabelText(cell))
                : 'unnamed';
        return `${prefix}-${slug}`;
    };

    const PRESENTATION_ATTRS = ['fill', 'stroke', 'stop-color', 'flood-color', 'color'];
    const CSS_VAR_RE = /var\(\s*([^,)]+)\s*(?:,\s*([^)]+)\s*)?\)/gi;

    function iconVarFallbackMap() {
        const dark =
            document.documentElement.classList.contains('theme-dark') ||
            document.body.classList.contains('theme-dark');
        if (dark) {
            return {
                '--illu-icon-stroke': '#f8fafc',
                '--illu-icon-bg': '#2d2d2d',
                '--illu-icon-accent': '#6b9bd9',
                '--illu-icon-accent-subtle': '#4a5f7a',
                '--illu-icon-subtle': '#475569'
            };
        }
        return {
            '--illu-icon-stroke': '#1e293b',
            '--illu-icon-bg': '#ffffff',
            '--illu-icon-accent': '#3b82f6',
            '--illu-icon-accent-subtle': '#bfdbfe',
            '--illu-icon-subtle': '#e2e8f0'
        };
    }

    function resolveCssVarInValue(value, varMap) {
        if (!value || value.indexOf('var(') === -1) return value;
        return String(value).replace(CSS_VAR_RE, (_, name, fallback) => {
            const key = name.trim();
            if (varMap[key] != null) return varMap[key];
            if (fallback != null) return String(fallback).trim();
            return 'currentColor';
        });
    }

    /** Les attributs SVG fill/stroke avec var(--illu-*) ne sont pas peints sans résolution explicite. */
    function normalizeSpritePresentationColors(root, varMap) {
        if (!root || root.nodeType !== 1) return;
        PRESENTATION_ATTRS.forEach((attr) => {
            if (!root.hasAttribute(attr)) return;
            const raw = root.getAttribute(attr);
            const resolved = resolveCssVarInValue(raw, varMap);
            if (resolved !== raw) root.setAttribute(attr, resolved);
        });
        if (root.hasAttribute('style')) {
            const style = root.getAttribute('style');
            if (style && style.indexOf('var(') !== -1) {
                root.setAttribute('style', resolveCssVarInValue(style, varMap));
            }
        }
        [...root.children].forEach((ch) => normalizeSpritePresentationColors(ch, varMap));
    }

    /** Évite les collisions url(#gradient) quand plusieurs symboles sont clonés sur la feuille. */
    function uniqueifySvgIds(root, prefix) {
        const idMap = {};
        root.querySelectorAll('[id]').forEach((el) => {
            const old = el.getAttribute('id');
            if (!old) return;
            const neu = `${prefix}-${old}`;
            idMap[old] = neu;
            el.setAttribute('id', neu);
        });
        root.querySelectorAll('*').forEach((el) => {
            [...el.attributes].forEach((attr) => {
                let v = attr.value;
                if (!v || v.indexOf('url(#') === -1) return;
                let next = v;
                Object.keys(idMap).forEach((old) => {
                    next = next.split(`url(#${old})`).join(`url(#${idMap[old]})`);
                });
                if (next !== v) el.setAttribute(attr.name, next);
            });
        });
    }

    function appendClonedSymbolArt(artWrap, spec, cellIndex) {
        const frag = artWrap.ownerDocument.createDocumentFragment();
        spec.nodes.forEach((node) => frag.appendChild(node.cloneNode(true)));
        uniqueifySvgIds(frag, `sp${cellIndex}`);
        normalizeSpritePresentationColors(frag, iconVarFallbackMap());
        while (frag.firstChild) artWrap.appendChild(frag.firstChild);
    }

    function createCheckerPattern(doc) {
        const pattern = doc.createElementNS(NS, 'pattern');
        pattern.setAttribute('id', CHECKER_PATTERN_ID);
        pattern.setAttribute('width', '16');
        pattern.setAttribute('height', '16');
        pattern.setAttribute('patternUnits', 'userSpaceOnUse');
        const tiles = [
            { x: 0, y: 0, fill: '#3d3d45' },
            { x: 8, y: 0, fill: '#2f2f36' },
            { x: 0, y: 8, fill: '#2f2f36' },
            { x: 8, y: 8, fill: '#3d3d45' }
        ];
        tiles.forEach((t) => {
            const r = doc.createElementNS(NS, 'rect');
            r.setAttribute('x', String(t.x));
            r.setAttribute('y', String(t.y));
            r.setAttribute('width', '8');
            r.setAttribute('height', '8');
            r.setAttribute('fill', t.fill);
            pattern.appendChild(r);
        });
        return pattern;
    }

    /** Fond damier unique (defs locaux pour que le motif survive dans svgData du calque). */
    function buildSheetCheckerBackground(doc, width, height) {
        const g = doc.createElementNS(NS, 'g');
        g.setAttribute('data-illu-sprite-sheet-bg', '1');
        g.setAttribute('data-illu-sprite-chrome', '1');

        const defs = doc.createElementNS(NS, 'defs');
        defs.appendChild(createCheckerPattern(doc));
        g.appendChild(defs);

        const base = doc.createElementNS(NS, 'rect');
        base.setAttribute('x', '0');
        base.setAttribute('y', '0');
        base.setAttribute('width', String(width));
        base.setAttribute('height', String(height));
        base.setAttribute('fill', '#252528');
        base.setAttribute('pointer-events', 'none');
        g.appendChild(base);

        const r = doc.createElementNS(NS, 'rect');
        r.setAttribute('x', '0');
        r.setAttribute('y', '0');
        r.setAttribute('width', String(width));
        r.setAttribute('height', String(height));
        r.setAttribute('fill', `url(#${CHECKER_PATTERN_ID})`);
        r.setAttribute('pointer-events', 'none');
        g.appendChild(r);
        return g;
    }

    function createEditableLabel(doc, cellX, cellY, labelText, labelW) {
        const fo = doc.createElementNS(NS, 'foreignObject');
        fo.setAttribute('data-illu-sprite-label', '1');
        fo.setAttribute('x', String(cellX + CELL_PAD));
        fo.setAttribute('y', String(cellY + 2));
        fo.setAttribute('width', String(Math.max(40, labelW - CELL_PAD * 2)));
        fo.setAttribute('height', String(LABEL_H));

        const htmlDoc = document.implementation.createHTMLDocument('illu-sprite-label');
        const body = htmlDoc.createElement('body');
        body.setAttribute('style', 'margin:0;padding:0');

        const div = htmlDoc.createElement('div');
        div.setAttribute('contenteditable', 'true');
        div.setAttribute('spellcheck', 'false');
        div.setAttribute(
            'style',
            'outline:none;min-height:1em;cursor:text;font-family:ui-monospace,monospace;font-size:9px;line-height:1.2;color:#cbd5e1;background:transparent;white-space:nowrap;overflow:hidden;'
        );
        div.textContent = labelText || 'nom';

        body.appendChild(div);
        fo.appendChild(doc.importNode(body, true));
        return fo;
    }

    /** Liste ordonnée des symboles du fichier sprite. */
    window.illuCollectSpriteSymbols = function (svgRoot) {
        if (!svgRoot) return [];
        return [...svgRoot.querySelectorAll('symbol[id]')].map((sym, order) => ({
            id: sym.getAttribute('id'),
            viewBox: sym.getAttribute('viewBox') || '0 0 16 16',
            order,
            nodes: symbolChildren(sym)
        }));
    };

    /**
     * Construit une feuille vectorielle : damier global + libellés éditables + icônes par cellule.
     */
    window.illuBuildSpriteSheetFromSvgRoot = function (svgRoot) {
        const symbols = window.illuCollectSpriteSymbols(svgRoot);
        if (!symbols.length) throw new Error('Aucun symbole <symbol> dans ce fichier.');

        const doc = svgRoot.ownerDocument || document;
        const defsNodes = [];
        const srcDefs = svgRoot.querySelector('defs');
        if (srcDefs) {
            [...srcDefs.children].forEach((n) => {
                if (n.id !== CHECKER_PATTERN_ID) defsNodes.push(n.cloneNode(true));
            });
        }
        const rows = Math.ceil(symbols.length / COLS);
        const width = COLS * COL_W + CELL_PAD;
        const height = rows * ROW_H + CELL_PAD;
        const sheetChrome = buildSheetCheckerBackground(doc, width, height);
        const cells = [];

        symbols.forEach((spec, index) => {
            const col = index % COLS;
            const row = Math.floor(index / COLS);
            const cellX = CELL_PAD + col * COL_W;
            const cellY = CELL_PAD + row * ROW_H;
            const vb = parseViewBox(spec.viewBox);
            const scale = (CELL_INNER - 4) / Math.max(vb.w, vb.h, 1);
            const artW = vb.w * scale;
            const artH = vb.h * scale;
            const artX = cellX + CELL_PAD + (CELL_INNER - artW) / 2 - vb.minX * scale;
            const artY = cellY + LABEL_H + CELL_PAD + (CELL_INNER - artH) / 2 - vb.minY * scale;

            const prefix = spriteIdPrefix(spec.id);
            const shortName = spriteShortLabel(spec.id);

            const cell = doc.createElementNS(NS, 'g');
            cell.setAttribute('id', `illu-sprite-cell-${spec.id}`);
            cell.setAttribute('data-illu-sprite-id', spec.id);
            cell.setAttribute('data-illu-sprite-id-prefix', prefix);
            cell.setAttribute('data-illu-sprite-vb', spec.viewBox);
            cell.setAttribute('data-illu-sprite-order', String(spec.order));

            const frame = doc.createElementNS(NS, 'rect');
            frame.setAttribute('data-illu-sprite-cell-frame', '1');
            frame.setAttribute('data-illu-sprite-chrome', '1');
            frame.setAttribute('x', String(cellX));
            frame.setAttribute('y', String(cellY));
            frame.setAttribute('width', String(COL_W - 4));
            frame.setAttribute('height', String(ROW_H - 4));
            frame.setAttribute('rx', '3');
            frame.setAttribute('fill', 'none');
            frame.setAttribute('stroke', '#52525b');
            frame.setAttribute('stroke-width', '1');
            frame.setAttribute('pointer-events', 'none');
            cell.appendChild(frame);

            cell.appendChild(createEditableLabel(doc, cellX, cellY, shortName, COL_W - 4));

            const artWrap = doc.createElementNS(NS, 'g');
            artWrap.setAttribute('data-illu-sprite-art', '1');
            artWrap.setAttribute(
                'transform',
                `translate(${artX.toFixed(2)},${artY.toFixed(2)}) scale(${scale.toFixed(4)})`
            );
            appendClonedSymbolArt(artWrap, spec, index);
            cell.appendChild(artWrap);
            cells.push(cell);
        });

        return { width, height, defsNodes, sheetChrome, cells, symbolCount: symbols.length };
    };

    function serializeNode(node) {
        return new XMLSerializer().serializeToString(node);
    }

    function escapeXmlAttr(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;');
    }

    /** Exporte la feuille active vers le format illu-sprite.svg (symboles). */
    window.illuExportSpriteSheetMarkup = function () {
        const layersRoot = document.getElementById('svg-layers');
        if (!layersRoot) return '';
        const cells = [...layersRoot.querySelectorAll('[data-illu-sprite-id]')];
        if (!cells.length) return '';

        cells.sort((a, b) => {
            const oa = parseInt(a.getAttribute('data-illu-sprite-order') || '0', 10);
            const ob = parseInt(b.getAttribute('data-illu-sprite-order') || '0', 10);
            return oa - ob;
        });

        const defsHost = document.getElementById('vector-doc-defs');
        let defsInner = '';
        if (defsHost) {
            [...defsHost.children].forEach((n) => {
                if (n.id === CHECKER_PATTERN_ID) return;
                defsInner += serializeNode(n);
            });
        }

        let symbolsXml = '';
        cells.forEach((cell) => {
            const id =
                typeof window.illuSpriteSymbolIdFromCell === 'function'
                    ? window.illuSpriteSymbolIdFromCell(cell)
                    : cell.getAttribute('data-illu-sprite-id');
            const vb = cell.getAttribute('data-illu-sprite-vb') || '0 0 16 16';
            const art = cell.querySelector('[data-illu-sprite-art]');
            if (!id || !art) return;
            let inner = '';
            [...art.children].forEach((ch) => {
                inner += serializeNode(ch);
            });
            symbolsXml += `<symbol id="${escapeXmlAttr(id)}" viewBox="${escapeXmlAttr(vb)}">\n${inner}\n</symbol>\n\n`;
        });

        return (
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<!-- MasterPaint — Sprite SVG icônes internes (Adaptatif Mode Sombre/Clair) -->\n' +
            '<!-- Usage : <use href="icons/illu-sprite.svg#illu-icon-NOM"/> ou inline via fetch/inject -->\n' +
            '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"\n' +
            '     aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden;">\n' +
            (defsInner ? `  <defs>\n${defsInner}  </defs>\n\n` : '') +
            symbolsXml +
            '</svg>\n'
        );
    };
})();
