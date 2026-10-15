/**
 * pdn-commands.js — commandes et raccourcis clavier repris de Paint.NET 5.
 *
 *  - « Effets › Répéter <effet> » (Ctrl+F) : relance le dernier effet avec ses derniers
 *    réglages (FilterManager les mémorise déjà par effet), sans rouvrir le dialogue.
 *  - Raccourcis des Ajustements : Ctrl+Maj+L/G/M/U/P/E/I, Ctrl+L.
 * Les raccourcis déjà utilisés par MasterPaint (Ctrl+Maj+C/V/H/X, Ctrl+I…) sont conservés.
 */
(function () {
    'use strict';

    let lastEffect = null;

    function effectTitle(id) {
        try {
            const t = window.IlluI18n && window.IlluI18n.t('effect.title.' + id);
            if (t && t !== 'effect.title.' + id) return t;
        } catch (e) { /* ignore */ }
        if (window.IlluPdnDialogs) return window.IlluPdnDialogs.title(id);
        return id;
    }

    function syncRepeatItem() {
        const li = document.getElementById('menu-fx-repeat');
        const lbl = document.getElementById('menu-fx-repeat-label');
        if (!li || !lbl) return;
        const base = window.IlluI18n ? window.IlluI18n.t('pdn.fxRepeat') : 'Répéter';
        if (lastEffect) {
            li.removeAttribute('aria-disabled');
            lbl.textContent = (base && base !== 'pdn.fxRepeat' ? base : 'Répéter') + ' ' + effectTitle(lastEffect);
        } else {
            li.setAttribute('aria-disabled', 'true');
            lbl.textContent = base && base !== 'pdn.fxRepeat' ? base : 'Répéter';
        }
    }

    /** Mémorise l'effet validé (OK) pour « Répéter ». */
    function hookApply() {
        const FM = window.FilterManager;
        if (!FM || FM.__pdnApplyHooked) return;
        const orig = FM.apply;
        FM.apply = async function () {
            const eff = this.currentEffect;
            const r = await orig.apply(this, arguments);
            if (eff && eff !== 'gallery') {
                lastEffect = eff;
                syncRepeatItem();
            }
            return r;
        };
        FM.__pdnApplyHooked = true;
    }

    async function repeatLastEffect() {
        const FM = window.FilterManager;
        if (!lastEffect || !FM) return;
        const eff = lastEffect;
        await FM.initEffect(eff);
        // effets à dialogue : le dialogue s'ouvre avec les réglages mémorisés → valider tout de suite
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        if (document.body.classList.contains('effect-dialog-open') && FM.currentEffect === eff) {
            await FM.apply();
        }
    }
    window.illuRepeatLastEffect = repeatLastEffect;

    const SHORTCUTS = {
        // Ctrl+Maj+…
        'shift+l': () => window.applyEffect('autolevel'),
        'shift+g': () => window.applyEffect('grayscale'),
        'shift+m': () => typeof window.openCurvesForActiveLayer === 'function' && window.openCurvesForActiveLayer(),
        'shift+u': () => window.applyEffect('hsv'),
        'shift+p': () => window.applyEffect('posterize'),
        'shift+e': () => window.applyEffect('sepia'),
        // Ctrl+…
        l: () => typeof window.openLevelsForActiveLayer === 'function' && window.openLevelsForActiveLayer(),
        f: () => repeatLastEffect()
    };

    function isTyping(t) {
        return !!(t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)));
    }

    function onKey(e) {
        if (!(e.ctrlKey || e.metaKey) || e.altKey || isTyping(e.target)) return;
        if (document.body.classList.contains('effect-dialog-open')) return;
        const k = (e.shiftKey ? 'shift+' : '') + String(e.key || '').toLowerCase();
        const fn = SHORTCUTS[k];
        if (!fn || typeof window.applyEffect !== 'function') return;
        e.preventDefault();
        e.stopPropagation();
        fn();
    }

    function init() {
        hookApply();
        syncRepeatItem();
        window.addEventListener('keydown', onKey, true);
        window.addEventListener('illu-i18n-applied', syncRepeatItem);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
