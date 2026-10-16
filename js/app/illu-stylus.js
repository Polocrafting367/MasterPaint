/**
 * illu-stylus.js — Prise en charge des stylets (Pointer Events, pointerType 'pen').
 *
 * Trois apports, tous inertes pour la souris et le doigt :
 *
 *  1. BOUT GOMME — un stylet retourné signale son embout gomme par `button: 5`
 *     / `buttons: 32`. DrawingTools.js écartait tout bouton ≠ 0, donc ce bout ne
 *     dessinait rien du tout. On bascule maintenant sur l'outil Gomme le temps du
 *     tracé, puis on rend la main à l'outil précédent au relâchement.
 *
 *  2. BOUTON LATÉRAL (barrel, `button: 2` / `buttons: 2`) — inerte par défaut,
 *     comme le clic droit sur la toile aujourd'hui. IlluStylus.setBarrelAction('eraser')
 *     le mappe sur la gomme, pour les stylets sans embout gomme.
 *     (Pas de mappage « couleur secondaire » à la Paint.NET : ici
 *     EditorManager.activeColor est toujours recalculé depuis la couleur
 *     primaire — activeColorTarget ne pilote que le panneau de sélection — et la
 *     souris n'a pas ce comportement non plus.)
 *
 *  3. POSITION À L'ÉCRAN — un stylet survole la dalle avant de la toucher : le
 *     navigateur émet des `pointermove` sans contact, mais rien ne s'affichait.
 *     Un repère (#illu-stylus-hud) suit donc la pointe pendant le survol comme
 *     pendant le tracé : anneau au diamètre réel de l'outil, pastille gomme quand
 *     c'est le bout gomme, et coordonnées document + pression à côté. La barre
 *     d'état est alimentée en parallèle, car les `mousemove` de compatibilité ne
 *     sont pas garantis au survol au stylet — et le mode compact masque de toute
 *     façon cette barre.
 *
 * Le repère n'apparaît que pour pointerType 'pen' et seulement au-dessus de
 * #workspace : ni la souris, ni le doigt, ni les palettes ne le déclenchent.
 */
(function () {
    'use strict';

    /* Constantes Pointer Events (spec « Button States »). */
    const BTN_BARREL = 2;
    const BTNS_BARREL = 2;
    const BTN_ERASER = 5;
    const BTNS_ERASER = 32;

    /* Outils dont la pointe est un disque de toolProps.size : l'anneau vaut le
       tracé réel. Les autres n'ont droit qu'au point de visée. */
    const ROUND_TIP_TOOLS = new Set(['brush', 'pencil', 'eraser']);

    let _enabled = true;
    let _barrelAction = 'none';

    /* État du geste en cours (un seul stylet à la fois : le tracé l'est aussi). */
    const _gesture = {
        pointerId: null,
        restoreTool: null
    };

    /* Un stylet retourné ne dit pas toujours « gomme » pendant le survol : selon
       l'UA, buttons vaut 32 ou 0 tant que la pointe ne touche pas. On mémorise
       donc le dernier embout vu en contact — mais brièvement : sans péremption,
       le badge gomme resterait collé au survol après un trait de gomme, alors
       que l'utilisateur a déjà retourné le stylet.
       Cette mémoire ne sert qu'à l'affichage : dessiner ou gommer se décide au
       pointerdown, sur l'événement réel. */
    const TIP_MEMO_MS = 400;
    const _lastTipByPointer = new Map();

    function rememberTip(pointerId, tip) {
        if (pointerId == null) return;
        /* Chromium incrémente le pointerId à chaque nouveau contact : sans ce
           plafond la table grossirait toute la session pour rien. */
        if (_lastTipByPointer.size > 16) _lastTipByPointer.clear();
        _lastTipByPointer.set(pointerId, { tip, at: performance.now() });
    }

    function recalledTip(pointerId) {
        if (pointerId == null) return null;
        const memo = _lastTipByPointer.get(pointerId);
        if (!memo) return null;
        if (performance.now() - memo.at > TIP_MEMO_MS) {
            _lastTipByPointer.delete(pointerId);
            return null;
        }
        return memo.tip;
    }

    /* ── Détection des embouts / boutons ─────────────────────────────────── */

    function isPen(e) {
        return !!e && e.pointerType === 'pen';
    }

    /** Bout gomme du stylet (contact ou survol selon ce que rapporte l'UA). */
    function isEraserButton(e) {
        if (!_enabled || !isPen(e)) return false;
        if (e.button === BTN_ERASER) return true;
        return (e.buttons & BTNS_ERASER) === BTNS_ERASER;
    }

    /** Bouton latéral du corps du stylet. */
    function isBarrelButton(e) {
        if (!_enabled || !isPen(e)) return false;
        if (e.button === BTN_BARREL) return true;
        return (e.buttons & BTNS_BARREL) === BTNS_BARREL;
    }

    /**
     * Cet appui stylet doit-il tracer, malgré un `button` ≠ 0 ?
     * DrawingTools.js interroge ce prédicat dans ses gardes d'entrée : sans lui,
     * ni le bout gomme (button 5) ni le bouton latéral (button 2) ne posaient le
     * moindre pixel. Le test porte sur pointerType 'pen' : le clic droit et le
     * clic milieu de la souris gardent exactement leur comportement.
     */
    function isDrawButton(e) {
        if (!_enabled || !isPen(e)) return false;
        if (isEraserButton(e)) return true;
        return _barrelAction !== 'none' && isBarrelButton(e);
    }

    /** Embout supposé pendant un survol, mémoire récente du contact incluse. */
    function hoveringTip(e) {
        if (isEraserButton(e)) return 'eraser';
        return recalledTip(e.pointerId) === 'eraser' ? 'eraser' : 'tip';
    }

    /* ── Bascule d'outil le temps du geste ───────────────────────────────── */

    function pixelModeReady() {
        const em = window.EditorManager;
        return !!(em && em.isPixelMode && em.activeProject);
    }

    /**
     * Active un outil comme le ferait un clic dans la boîte à outils : le bouton
     * porte toute la logique de changement (validation du texte en cours, purge
     * des sessions pixel, ruban, curseur). On ne réécrit pas window.activeTool à
     * la main, sous peine de laisser l'éditeur à moitié dans l'outil précédent.
     */
    function activateTool(toolId) {
        if (!toolId || window.activeTool === toolId) return false;
        const btn = document.getElementById('tool-' + toolId);
        if (btn && !btn.disabled) {
            btn.click();
            return window.activeTool === toolId;
        }
        return false;
    }

    function beginGesture(e) {
        if (!_enabled || !isPen(e)) return;
        if (_gesture.pointerId != null) return;

        const eraser = isEraserButton(e);
        const barrel = !eraser && isBarrelButton(e);
        rememberTip(e.pointerId, eraser ? 'eraser' : 'tip');
        if (!eraser && !barrel) return;
        if (!pixelModeReady()) return;

        if (!eraser && !(barrel && _barrelAction === 'eraser')) return;

        _gesture.pointerId = e.pointerId;
        const prev = window.activeTool;
        if (activateTool('eraser')) _gesture.restoreTool = prev;
    }

    function endGesture(e) {
        if (_gesture.pointerId == null) return;
        if (e && e.pointerId != null && e.pointerId !== _gesture.pointerId) return;

        const tool = _gesture.restoreTool;
        _gesture.pointerId = null;
        _gesture.restoreTool = null;
        /* Après handleMouseUp : restaurer l'outil pendant le tracé le couperait. */
        if (tool) activateTool(tool);
    }

    /* ── Repère de position ──────────────────────────────────────────────── */

    let _hud = null;
    let _hudVisible = false;
    let _rafId = 0;
    let _pending = null;

    function buildHud() {
        if (_hud) return _hud;
        const el = document.createElement('div');
        el.id = 'illu-stylus-hud';
        el.className = 'illu-stylus-hud';
        el.setAttribute('aria-hidden', 'true');
        el.hidden = true;
        el.innerHTML =
            '<span class="illu-stylus-hud__ring" aria-hidden="true"></span>' +
            '<span class="illu-stylus-hud__dot" aria-hidden="true"></span>' +
            '<span class="illu-stylus-hud__badge" aria-hidden="true"><i class="fa-solid fa-eraser"></i></span>' +
            '<span class="illu-stylus-hud__readout"></span>';
        document.body.appendChild(el);
        _hud = el;
        return el;
    }

    /** Facteur px écran / px document (zoom + échelle CSS du conteneur). */
    function screenScale() {
        const em = window.EditorManager;
        const cont = document.getElementById('main-canvas-container');
        const p = em && em.activeProject;
        if (!cont || !p || !p.width) return 1;
        const r = cont.getBoundingClientRect();
        if (r.width < 1e-6) return 1;
        return r.width / p.width;
    }

    function docPos(e) {
        const em = window.EditorManager;
        if (em && typeof em.logicalPointerFromClientXY === 'function') {
            return em.logicalPointerFromClientXY(e.clientX, e.clientY);
        }
        return null;
    }

    function coordsText(pos) {
        const rx = Math.round(pos.x);
        const ry = Math.round(pos.y);
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const s = window.IlluI18n.t('status.coords', { x: rx, y: ry });
            if (s && s !== 'status.coords') return s;
        }
        return rx + ', ' + ry + ' px';
    }

    /** Alimente #status-coords : les mousemove de compatibilité manquent au survol. */
    let _lastStatusText = '';
    function syncStatusCoords(pos) {
        const sc = document.getElementById('status-coords');
        if (!sc) return;
        const txt = coordsText(pos);
        if (txt === _lastStatusText) return;
        sc.textContent = txt;
        _lastStatusText = txt;
    }

    function hideHud() {
        if (!_hudVisible || !_hud) return;
        _hudVisible = false;
        _hud.hidden = true;
    }

    function renderHud(e) {
        const el = buildHud();
        const pos = docPos(e);
        if (!pos) {
            hideHud();
            return;
        }

        const tip = hoveringTip(e);
        /* Contact = pression non nulle. `buttons` ne convient pas : le bout gomme
           rapporte buttons:32 en simple survol, et le bouton latéral buttons:2
           sans que la pointe touche quoi que ce soit. */
        const contact = e.pressure > 0;
        const tool = tip === 'eraser' ? 'eraser' : window.activeTool || '';
        const em = window.EditorManager;

        /* Diamètre réel de la pointe, en pixels écran. Hors outils à pointe ronde
           on retombe sur un simple point de visée. */
        let ring = 0;
        if (ROUND_TIP_TOOLS.has(tool) && em && em.toolProps) {
            const size = Number(em.toolProps.size) || 1;
            ring = Math.max(6, Math.min(400, size * screenScale()));
        }

        el.classList.toggle('illu-stylus-hud--eraser', tip === 'eraser');
        el.classList.toggle('illu-stylus-hud--contact', !!contact);
        el.classList.toggle('illu-stylus-hud--ring', ring > 0);
        el.style.setProperty('--illu-stylus-ring', ring + 'px');
        el.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';

        /* Près du bord droit / bas, la légende passe de l'autre côté du repère. */
        el.classList.toggle('illu-stylus-hud--flip-x', e.clientX > window.innerWidth - 190);
        el.classList.toggle('illu-stylus-hud--flip-y', e.clientY > window.innerHeight - 70);

        const readout = el.querySelector('.illu-stylus-hud__readout');
        if (readout) {
            let txt = coordsText(pos);
            if (contact && e.pressure > 0) {
                txt += ' · ' + Math.round(e.pressure * 100) + ' %';
            }
            readout.textContent = txt;
        }

        if (!_hudVisible) {
            _hudVisible = true;
            el.hidden = false;
        }
        syncStatusCoords(pos);
    }

    function overWorkspace(e) {
        const t = e.target;
        if (!t || typeof t.closest !== 'function') return false;
        if (!t.closest('#workspace')) return false;
        /* Palettes volantes et commandes posées au-dessus de la toile : le stylet
           y agit comme une souris, le repère n'a rien à y faire.
           (Pas de test sur .window : #app-window porte cette classe, tout
           l'éditeur en descend.) */
        if (t.closest('.palette-panel, .illu-mobile-sheet, button, input, select, textarea, [contenteditable="true"]')) {
            return false;
        }
        return true;
    }

    function onPointerMove(e) {
        if (!isPen(e)) {
            /* La souris ou le doigt reprend la main : le repère du stylet n'a
               plus de sens et resterait figé sur sa dernière position. */
            hideHud();
            return;
        }
        if (!_enabled) return;
        if (!overWorkspace(e)) {
            hideHud();
            return;
        }
        _pending = e;
        if (_rafId) return;
        _rafId = requestAnimationFrame(() => {
            _rafId = 0;
            const ev = _pending;
            _pending = null;
            if (ev) renderHud(ev);
        });
    }

    /* ── Câblage ─────────────────────────────────────────────────────────── */

    /* Capture : la bascule d'outil doit être faite AVANT le pointerdown de
       DrawingTools (phase bubble sur #workspace), sinon le tracé démarre avec
       l'ancien outil. */
    window.addEventListener('pointerdown', beginGesture, true);
    window.addEventListener('pointermove', onPointerMove, { passive: true, capture: true });
    window.addEventListener('pointerup', (e) => {
        if (!isPen(e)) return;
        rememberTip(e.pointerId, isEraserButton(e) ? 'eraser' : 'tip');
        /* Après le pointerup de DrawingTools (bubble) : d'où le setTimeout. */
        setTimeout(() => endGesture(e), 0);
    });
    window.addEventListener('pointercancel', (e) => {
        if (!isPen(e)) return;
        setTimeout(() => endGesture(e), 0);
    });
    /* Stylet qui sort du champ de détection : plus de position à montrer. */
    window.addEventListener('pointerout', (e) => {
        if (isPen(e)) hideHud();
    }, true);
    window.addEventListener('pointerleave', (e) => {
        if (isPen(e)) hideHud();
    }, true);
    window.addEventListener('blur', hideHud);

    /* Le bouton latéral déclenche un `contextmenu` : laissé faire, le menu
       natif s'ouvre au milieu du tracé. Seulement au-dessus du workspace, et
       seulement pour un stylet — le clic droit souris garde son menu. */
    window.addEventListener('contextmenu', (e) => {
        if (!_enabled) return;
        if (e.pointerType && e.pointerType !== 'pen') return;
        if (_gesture.pointerId == null) return;
        const t = e.target;
        if (t && typeof t.closest === 'function' && t.closest('#workspace')) e.preventDefault();
    });

    /* ── API ─────────────────────────────────────────────────────────────── */

    window.IlluStylus = {
        isEraserButton,
        isBarrelButton,
        isDrawButton,
        isPen,
        hideIndicator: hideHud,
        isEnabled: () => _enabled,
        setEnabled(on) {
            _enabled = !!on;
            if (!_enabled) {
                hideHud();
                endGesture(null);
            }
        },
        getBarrelAction: () => _barrelAction,
        /** 'none' (défaut) ou 'eraser' : gomme au bouton latéral, pour les
            stylets dépourvus d'embout gomme. */
        setBarrelAction(action) {
            _barrelAction = action === 'eraser' ? 'eraser' : 'none';
        }
    };
})();
