/*
 * illu-menu-safe-triangle.js
 * ---------------------------------------------------------------------------
 * Ajoute le « triangle de sécurité » (menu-aim) aux menus déroulants.
 *
 * Les menus de l'application s'ouvrent en pur CSS via :hover. Le problème
 * classique : quand on déplace la souris en diagonale depuis un item parent
 * vers son sous-menu (qui s'ouvre sur le côté), le curseur traverse les items
 * voisins, le parent perd son :hover et le sous-menu se referme avant qu'on
 * l'atteigne.
 *
 * Ce module détecte que le curseur « vise » le sous-menu ouvert : tant que le
 * mouvement reste dans le triangle formé par la position précédente du curseur
 * et les deux coins du bord proche du sous-menu, on garde la chaîne ouverte
 * (.illu-st-open sur tous les ancêtres) et on suppress l'ouverture des voisins
 * survolés (.illu-st-aiming).
 *
 * IMPORTANT : on marque toute la chaîne d'ancêtres avec .illu-st-open, pas
 * seulement l'item le plus profond — sinon la règle de suppression
 * (.illu-st-aiming … :not(.illu-st-open):hover) masquerait le menu parent que
 * la souris est en train de survoler.
 *
 * Ne s'applique qu'aux sous-menus latéraux (imbriqués). Le changement entre
 * items de premier niveau (barre horizontale) reste instantané.
 */
(function () {
    'use strict';

    var ROOT_SELECTOR = 'menu[role="menubar"]';
    var ROW_SELECTOR = 'li[role="menuitem"]';
    var ACTIVATION_DELAY = 240; // ms : durée max où l'on tolère la visée
    var TOLERANCE = 75; // px : marge verticale sur les coins du triangle
    var MOUSE_LOCS_TRACKED = 3;

    var mouseLocs = [];

    document.addEventListener(
        'mousemove',
        function (e) {
            mouseLocs.push({ x: e.clientX, y: e.clientY });
            if (mouseLocs.length > MOUSE_LOCS_TRACKED) mouseLocs.shift();
        },
        { passive: true }
    );

    function getSubmenu(row) {
        if (!row || row.nodeType !== 1) return null;
        for (var i = 0; i < row.children.length; i++) {
            var c = row.children[i];
            if (c.tagName === 'UL' && c.getAttribute('role') === 'menu') return c;
        }
        return null;
    }

    function slope(a, b) {
        return (b.y - a.y) / (b.x - a.x);
    }

    function initRoot(root) {
        if (root.__illuSafeTriangle) return;
        root.__illuSafeTriangle = true;

        var activeChain = []; // items portant .illu-st-open (du plus haut au plus profond)
        var activeRow = null; // item le plus profond possédant un sous-menu
        var lastRow = null;
        var timeoutId = null;

        // Chaîne des ancêtres (item inclus) possédant un sous-menu, du haut vers le bas.
        function chainOf(row) {
            var chain = [];
            var el = row;
            while (el && el !== root) {
                if (el.nodeType === 1 && el.matches(ROW_SELECTOR) && getSubmenu(el)) {
                    chain.unshift(el);
                }
                el = el.parentElement;
            }
            return chain;
        }

        function applyChain(chain) {
            var i;
            for (i = 0; i < activeChain.length; i++) {
                if (chain.indexOf(activeChain[i]) === -1) {
                    activeChain[i].classList.remove('illu-st-open');
                }
            }
            for (i = 0; i < chain.length; i++) {
                chain[i].classList.add('illu-st-open');
            }
            activeChain = chain;
            activeRow = chain.length ? chain[chain.length - 1] : null;
        }

        function clearActive() {
            for (var i = 0; i < activeChain.length; i++) {
                activeChain[i].classList.remove('illu-st-open');
            }
            activeChain = [];
            activeRow = null;
            root.classList.remove('illu-st-aiming');
        }

        function setActive(row) {
            root.classList.remove('illu-st-aiming');
            applyChain(chainOf(row));
        }

        // Faut-il retarder l'activation du nouvel item parce que le curseur vise
        // le sous-menu déjà ouvert ?
        function shouldDelay(row) {
            if (!activeRow) return false;
            var submenu = getSubmenu(activeRow);
            if (!submenu) return false;
            // Déjà à l'intérieur du sous-menu visé : on active directement.
            if (submenu.contains(row)) return false;
            // Items de premier niveau (sous-menu en dessous, déplacement
            // horizontal) : bascule immédiate.
            if (activeRow.parentElement === root) return false;

            var loc = mouseLocs[mouseLocs.length - 1];
            var prevLoc = mouseLocs[0] || loc;
            if (!loc) return false;

            var r = submenu.getBoundingClientRect();
            var rowRect = activeRow.getBoundingClientRect();
            var opensRight = r.left >= rowRect.right - 4;

            var topNear, bottomNear;
            if (opensRight) {
                topNear = { x: r.left, y: r.top - TOLERANCE };
                bottomNear = { x: r.left, y: r.bottom + TOLERANCE };
            } else {
                topNear = { x: r.right, y: r.top - TOLERANCE };
                bottomNear = { x: r.right, y: r.bottom + TOLERANCE };
            }

            var slopeTop = slope(loc, topNear);
            var slopeBottom = slope(loc, bottomNear);
            var prevSlopeTop = slope(prevLoc, topNear);
            var prevSlopeBottom = slope(prevLoc, bottomNear);

            return slopeTop < prevSlopeTop && slopeBottom > prevSlopeBottom;
        }

        function possiblyActivate(row) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            if (shouldDelay(row)) {
                root.classList.add('illu-st-aiming');
                timeoutId = setTimeout(function () {
                    timeoutId = null;
                    possiblyActivate(row);
                }, ACTIVATION_DELAY);
            } else {
                setActive(row);
            }
        }

        root.addEventListener('mouseover', function (e) {
            var row = e.target.closest(ROW_SELECTOR);
            if (!row || !root.contains(row)) return;
            if (row === lastRow) return;
            lastRow = row;
            possiblyActivate(row);
        });

        root.addEventListener('mouseleave', function () {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            lastRow = null;
            clearActive();
        });
    }

    function initAll() {
        var roots = document.querySelectorAll(ROOT_SELECTOR);
        for (var i = 0; i < roots.length; i++) initRoot(roots[i]);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }
})();
