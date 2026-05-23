/**
 * Modèle de sélection inspiré Paint.NET (base + continuation + combine verrouillé).
 * Coordonnées sélection = espace document ; indépendantes de layer.x/y sauf masque couleur.
 * Affichage (marquee, lasso, baguette) : js/tools/SelectionChrome.js — séparé du composite calques.
 */
(function () {
    'use strict';

    const SelectionModel = {
        /** @type {'new'|'add'|'subtract'|null} Verrouillé au pointerdown jusqu'au commit. */
        pendingCombineOp: null,

        /** Ctrl = Union, Alt = Exclude, sinon mode barre d'outils. */
        resolveCombineOpFromEvent(ev) {
            if (ev && ev.altKey && !ev.ctrlKey && !ev.metaKey) return 'subtract';
            if (ev && (ev.ctrlKey || ev.metaKey) && !ev.altKey) return 'add';
            const mode = window.selectionMode || 'new';
            if (mode === 'add') return 'add';
            if (mode === 'subtract') return 'subtract';
            return 'new';
        },

        isCombineOp(op) {
            return op === 'add' || op === 'subtract';
        },

        lockCombineOp(ev) {
            this.pendingCombineOp = this.resolveCombineOpFromEvent(ev);
            return this.pendingCombineOp;
        },

        consumeCombineOp() {
            const op = this.pendingCombineOp;
            this.pendingCombineOp = null;
            return op;
        },

        peekCombineOp() {
            return this.pendingCombineOp;
        },

        clearCombineOp() {
            this.pendingCombineOp = null;
        },

        /** Sélection pixel active (logique, sans dépendre de l'overlay DOM). */
        hasActivePixelSelection() {
            if (window.illuCropSessionActive && window.selectionBounds) {
                const sb = window.selectionBounds;
                return sb.w >= 1 && sb.h >= 1;
            }
            if (window.selectionInverted) return false;
            const sb = window.selectionBounds;
            if (sb && sb.w >= 1 && sb.h >= 1) return true;
            if (
                window.selectionKind === 'lasso' &&
                window.selectionLassoPoints &&
                window.selectionLassoPoints.length >= 3
            ) {
                return true;
            }
            const m = window.selectionColorMask;
            if (m && m.data && m.w > 0 && m.h > 0) {
                for (let i = 0; i < m.data.length; i++) {
                    if (m.data[i]) return true;
                }
            }
            return false;
        }
    };

    window.SelectionModel = SelectionModel;
    window.hasActivePixelSelection = function () {
        return SelectionModel.hasActivePixelSelection();
    };

    window.illuResolveSelectionCombineOp = function (ev) {
        return SelectionModel.resolveCombineOpFromEvent(ev);
    };

    window.illuLockSelectionCombineOp = function (ev) {
        return SelectionModel.lockCombineOp(ev);
    };

    window.illuConsumeSelectionCombineOp = function () {
        return SelectionModel.consumeCombineOp();
    };

    window.illuClearSelectionCombineOp = function () {
        SelectionModel.clearCombineOp();
    };
})();
