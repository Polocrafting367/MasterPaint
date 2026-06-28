/**
 * illu-svg-objects-panel.js — Panneau Objets SVG enrichi (Module 5)
 * Fenêtre volante standard (window palette-panel floating-window), drag via WindowManager.
 * S'intègre dans #floating-palette-host comme les autres palettes.
 * - Arborescence des éléments SVG du calque actif
 * - Click = sélectionner, double-click = renommer
 * - Drag = réordonner (Z-order)
 * - Icônes œil (visibilité) + cadenas (verrouillage) via sprite SVG
 * - Bouton actualiser + auto-refresh au changement de calque
 * - Entrée menu Fenêtre synchronisée
 */
'use strict';
(function (global) {
    const PANEL_ID = 'win-svg-objects';

    let _dragItem = null;
    let _dragEl = null;
    /** ID du calque SVG lors du dernier build (pour détecter un changement de calque). */
    let _lastSvgLayerId = null;
    /** Timer de debounce auto-refresh. */
    let _autoRefreshTimer = 0;

    const ICON_MAP = {
        rect: '▬', circle: '●', ellipse: '⬭', line: '—', path: '✒',
        text: 'T', tspan: 'T', g: '▤', image: '🖼', polygon: '⬡',
        polyline: '⤵', use: '⎘', symbol: '⊞',
    };

    function _getBody() {
        const panel = document.getElementById(PANEL_ID);
        return panel ? panel.querySelector('.svg-panel-body') : null;
    }

    function _getTag(el) { return (el.tagName || '').toLowerCase(); }

    function _svgIcon(iconId, title) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'svg-obj-act-icon');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('width', '16');
        svg.setAttribute('height', '16');
        svg.setAttribute('aria-hidden', 'true');
        if (title) svg.setAttribute('title', title);
        const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
        use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', 'icons/illu-sprite.svg#' + iconId);
        use.setAttribute('href', 'icons/illu-sprite.svg#' + iconId);
        svg.appendChild(use);
        return svg;
    }

    // ─── Drag & Drop pour Z-order ─────────────────────────────────────────────

    function _setupDragDrop(item, svgEl, container) {
        item.draggable = true;
        item.addEventListener('dragstart', e => {
            _dragItem = item;
            _dragEl = svgEl;
            e.dataTransfer.effectAllowed = 'move';
        });
        item.addEventListener('dragover', e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            // Indique visuellement si on déposera au-dessus ou en dessous selon la position du curseur.
            const r = item.getBoundingClientRect();
            const after = (e.clientY - r.top) > r.height / 2;
            item.style.borderTop = after ? '' : '2px solid #0078d4';
            item.style.borderBottom = after ? '2px solid #0078d4' : '';
        });
        item.addEventListener('dragleave', () => { item.style.borderTop = ''; item.style.borderBottom = ''; });
        item.addEventListener('drop', e => {
            e.preventDefault();
            const r = item.getBoundingClientRect();
            const after = (e.clientY - r.top) > r.height / 2;
            item.style.borderTop = '';
            item.style.borderBottom = '';
            if (!_dragEl || _dragEl === svgEl) { _dragEl = null; _dragItem = null; return; }
            const parent = svgEl.parentElement;
            if (!parent || !parent.contains(_dragEl)) { _dragEl = null; _dragItem = null; return; }
            // La liste est affichée en ordre Z inverse (premier plan en haut). « Au-dessus » dans la
            // liste = plus haut dans la pile = plus tard dans le DOM ; on insère donc en conséquence.
            if (after) {
                parent.insertBefore(_dragEl, svgEl); // sous la cible visuelle → avant dans le DOM
            } else {
                parent.insertBefore(_dragEl, svgEl.nextSibling); // au-dessus → après dans le DOM
            }
            const em = global.EditorManager;
            if (em && em.saveHistory) em.saveHistory('Réordonner Z');
            document.dispatchEvent(new CustomEvent('illu:svg-objects-changed'));
            refresh();
            _dragEl = null; _dragItem = null;
        });
    }

    // ─── Construction des items ───────────────────────────────────────────────

    function _buildItems(parent, depth, container) {
        const children = Array.from(parent.children || []);
        children.reverse().forEach(child => {
            const tag = _getTag(child);
            if (tag === 'defs' || tag === 'title' || tag === 'desc' || tag === 'style') return;

            const item = document.createElement('div');
            item.className = 'svg-obj-item';
            item.setAttribute('data-depth', String(depth));
            item.setAttribute('tabindex', '0');

            const isHidden = child.getAttribute('visibility') === 'hidden';
            const isLocked = child.getAttribute('data-illu-locked') === '1';
            if (isHidden) item.classList.add('hidden-obj');
            if (isLocked) item.classList.add('locked-obj');

            const icon = document.createElement('span');
            icon.className = 'svg-obj-icon';
            icon.textContent = ICON_MAP[tag] || '◇';

            const name = document.createElement('span');
            name.className = 'svg-obj-name';
            const idStr = child.getAttribute('id') ? ` #${child.getAttribute('id')}` : '';
            const classStr = child.getAttribute('class') ? ` .${child.getAttribute('class').split(' ')[0]}` : '';
            const label = child.getAttribute('data-illu-label') || `${tag}${idStr}${classStr}`;
            name.textContent = label;
            name.title = label;

            name.addEventListener('dblclick', e => {
                e.stopPropagation();
                const input = document.createElement('input');
                input.type = 'text';
                input.value = name.textContent;
                input.style.cssText = 'width:100%;border:none;background:#fff;font-size:11px;padding:0;';
                name.replaceWith(input);
                input.focus(); input.select();
                const commit = () => {
                    const newLabel = input.value.trim() || label;
                    name.textContent = newLabel;
                    child.setAttribute('data-illu-label', newLabel);
                    input.replaceWith(name);
                };
                input.addEventListener('blur', commit);
                input.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') input.replaceWith(name); });
            });

            const actions = document.createElement('span');
            actions.className = 'svg-obj-actions';

            /* ── Bouton Visibilité ────────────────────────── */
            const btnVis = document.createElement('button');
            btnVis.type = 'button';
            btnVis.className = 'svg-obj-btn svg-obj-btn--vis';
            btnVis.title = isHidden ? 'Afficher' : 'Masquer';
            btnVis.appendChild(_svgIcon(isHidden ? 'illu-icon-svg-obj-hidden' : 'illu-icon-svg-obj-visible', btnVis.title));
            btnVis.addEventListener('click', e => {
                e.stopPropagation();
                const hidden = child.getAttribute('visibility') === 'hidden';
                child.setAttribute('visibility', hidden ? 'visible' : 'hidden');
                item.classList.toggle('hidden-obj', !hidden);
                btnVis.innerHTML = '';
                btnVis.appendChild(_svgIcon(!hidden ? 'illu-icon-svg-obj-hidden' : 'illu-icon-svg-obj-visible', btnVis.title));
                btnVis.title = !hidden ? 'Afficher' : 'Masquer';
            });

            /* ── Bouton Verrouillage ──────────────────────── */
            const btnLock = document.createElement('button');
            btnLock.type = 'button';
            btnLock.className = 'svg-obj-btn svg-obj-btn--lock';
            btnLock.title = isLocked ? 'Déverrouiller' : 'Verrouiller';
            btnLock.appendChild(_svgIcon(isLocked ? 'illu-icon-svg-obj-locked' : 'illu-icon-svg-obj-unlocked', btnLock.title));
            btnLock.addEventListener('click', e => {
                e.stopPropagation();
                const locked = child.getAttribute('data-illu-locked') === '1';
                child.setAttribute('data-illu-locked', locked ? '0' : '1');
                item.classList.toggle('locked-obj', !locked);
                btnLock.innerHTML = '';
                btnLock.appendChild(_svgIcon(!locked ? 'illu-icon-svg-obj-locked' : 'illu-icon-svg-obj-unlocked', btnLock.title));
                btnLock.title = !locked ? 'Déverrouiller' : 'Verrouiller';
                child.setAttribute('pointer-events', !locked ? 'none' : 'auto');
            });

            /* ── Bouton Supprimer ──────────────────────────── */
            const btnDel = document.createElement('button');
            btnDel.type = 'button';
            btnDel.className = 'svg-obj-btn svg-obj-btn--del';
            btnDel.title = 'Supprimer';
            btnDel.appendChild(_svgIcon('illu-icon-svg-obj-delete', btnDel.title));
            btnDel.addEventListener('click', e => {
                e.stopPropagation();
                if (typeof global.showIlluConfirm === 'function') {
                    global.showIlluConfirm({
                        title: 'Supprimer',
                        message: 'Supprimer cet élément ?',
                        confirmText: 'Supprimer',
                        cancelText: 'Annuler',
                        onConfirm: () => {
                            child.remove();
                            item.remove();
                            refresh();
                            const em = global.EditorManager;
                            if (em && em.saveHistory) em.saveHistory('Supprimer objet SVG');
                        }
                    });
                } else {
                    if (!confirm('Supprimer cet élément ?')) return;
                    child.remove();
                    item.remove();
                    const em = global.EditorManager;
                    if (em && em.saveHistory) em.saveHistory('Supprimer objet SVG');
                }
            });

            actions.appendChild(btnVis);
            actions.appendChild(btnLock);
            actions.appendChild(btnDel);
            item.appendChild(icon);
            item.appendChild(name);
            item.appendChild(actions);

            // Référence directe item → élément SVG (pour la synchro de surbrillance).
            item.__illuSvgEl = child;

            item.addEventListener('click', e => {
                if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT') return;
                const em = global.EditorManager;
                if (!em) return;
                if (!Array.isArray(em.activeVectorSelection)) em.activeVectorSelection = [];
                const additive = e.ctrlKey || e.metaKey || e.shiftKey;
                if (additive) {
                    const idx = em.activeVectorSelection.indexOf(child);
                    if (idx > -1) em.activeVectorSelection.splice(idx, 1);
                    else em.activeVectorSelection.push(child);
                } else {
                    em.activeVectorSelection = [child];
                }
                window._activeVectorShapeEl = em.activeVectorSelection[em.activeVectorSelection.length - 1] || null;
                _applySelectionHighlight();
                if (window.VectorEngine) window.VectorEngine.refreshSelectionUI();
                if (typeof window.updateToolOptionsBar === 'function') window.updateToolOptionsBar();
            });

            _setupDragDrop(item, child, container);

            container.appendChild(item);

            if ((tag === 'g' || tag === 'symbol') && child.children.length > 0) {
                _buildItems(child, depth + 1, container);
            }
        });
    }

    // ─── API Publique ─────────────────────────────────────────────────────────

    /** Marque comme « selected » les items dont l'élément SVG est dans la sélection active. */
    function _applySelectionHighlight() {
        const body = _getBody();
        if (!body) return;
        const em = global.EditorManager;
        const sel = (em && Array.isArray(em.activeVectorSelection)) ? em.activeVectorSelection : [];
        body.querySelectorAll('.svg-obj-item').forEach(it => {
            it.classList.toggle('selected', sel.indexOf(it.__illuSvgEl) > -1);
        });
    }

    /** Synchronise la surbrillance avec la sélection canvas sans reconstruire l'arbre. */
    function syncSelection() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel || panel.classList.contains('illu-floating-window-hidden')) return;
        _applySelectionHighlight();
    }

    /** Reconstruit la liste depuis le calque SVG actif. */
    function refresh() {
        const body = _getBody();
        if (!body) return;
        body.innerHTML = '';

        const em = global.EditorManager;
        const p = em && em.activeProject;
        if (!p || p.mode !== 'vector') { body.textContent = '(Mode bitmap actif)'; _lastSvgLayerId = null; return; }

        const activeLayerId = em.activeLayer && em.activeLayer.id;
        const svgLayer = (activeLayerId && document.getElementById('layer-' + activeLayerId))
                       || document.getElementById('svg-layers');
        if (!svgLayer) { body.textContent = '(Aucun calque SVG)'; _lastSvgLayerId = null; return; }

        _lastSvgLayerId = svgLayer.id;

        const count = svgLayer.querySelectorAll('*').length;
        if (count === 0) {
            body.innerHTML = '<div style="padding:8px;color:#888;font-size:11px;">Calque vide</div>';
            return;
        }
        _buildItems(svgLayer, 0, body);
        _applySelectionHighlight();
    }

    /** Auto-refresh : reconstruit dès qu'une mutation pertinente du DOM SVG survient (ajout,
     *  suppression, réordonnancement) ou que le calque actif change. Plus de comparaison de
     *  cardinalité (qui ratait les réordonnancements à nombre d'éléments constant). */
    function _scheduleAutoRefresh() {
        if (_autoRefreshTimer) return;
        _autoRefreshTimer = setTimeout(() => {
            _autoRefreshTimer = 0;
            const panel = document.getElementById(PANEL_ID);
            if (!panel || panel.classList.contains('illu-floating-window-hidden')) return;
            const em = global.EditorManager;
            if (!em || !em.activeProject || em.activeProject.mode !== 'vector') return;
            refresh();
        }, 120);
    }

    function show() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        panel.classList.remove('illu-floating-window-hidden');
        if (typeof global.refreshFloatingPaletteMenuLabels === 'function') global.refreshFloatingPaletteMenuLabels();
        refresh();
    }

    function hide() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        panel.classList.add('illu-floating-window-hidden');
        if (typeof global.refreshFloatingPaletteMenuLabels === 'function') global.refreshFloatingPaletteMenuLabels();
    }

    function toggle() {
        const panel = document.getElementById(PANEL_ID);
        if (!panel) return;
        if (panel.classList.contains('illu-floating-window-hidden')) {
            show();
        } else {
            hide();
        }
    }

    // ─── Événements ──────────────────────────────────────────────────────────

    document.addEventListener('illu:svg-mode-enter', show);
    document.addEventListener('illu:svg-mode-leave', hide);
    document.addEventListener('illu:svg-objects-changed', refresh);

    /* Auto-refresh au changement de calque / mutation DOM SVG. */
    document.addEventListener('illu:active-layer-changed', () => { _scheduleAutoRefresh(); });
    document.addEventListener('illu:svg-objects-changed', () => {
        /* S'assure que le flag de calque est réinitialisé pour forcer un refresh. */
        _lastSvgLayerId = null;
    });

    /* MutationObserver sur le conteneur SVG pour détecter ajout/suppression d'éléments. */
    function _startMutationObserver() {
        const svgRoot = document.getElementById('svg-layers');
        if (!svgRoot) return;
        const mo = new MutationObserver(() => {
            const panel = document.getElementById(PANEL_ID);
            if (panel && !panel.classList.contains('illu-floating-window-hidden')) {
                _scheduleAutoRefresh();
            }
        });
        mo.observe(svgRoot, { childList: true, subtree: true, attributes: true, attributeFilter: ['visibility', 'data-illu-locked', 'data-illu-label'] });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', _startMutationObserver);
    } else {
        _startMutationObserver();
    }

    /* Sélection canvas → surbrillance panneau (sans reconstruire l'arbre). */
    document.addEventListener('illu:vector-selection-changed', syncSelection);

    global.illuSvgObjectsPanel = { show, hide, toggle, refresh, syncSelection };
})(window);