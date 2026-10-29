/**
 * illu-touch-mode.js — Détection stylet / doigt et « mode tactile ».
 *
 * DÉTECTION. Rien dans l'interface ne changeait selon le périphérique : les
 * cibles dessinées pour une souris (boutons de 20 px, barres de titre de 18 px)
 * sont difficiles à viser au stylet et impossibles au doigt. Dès qu'un vrai
 * geste stylet ou tactile est vu sur la toile (deux appuis, pour ne pas réagir
 * à un effleurement), on propose une fois le mode tactile. Le refus est
 * mémorisé ; la proposition ne revient pas.
 *
 * MODE TACTILE. Ce n'est pas le mode téléphone : les palettes restent des
 * fenêtres volantes, rien n'est ancré. C'est le même plan de travail, redessiné
 * pour le doigt (cf. css/touch-mode.css) :
 *   · cibles agrandies partout — outils, calques, menus, jauges ;
 *   · barres de titre simplifiées et plus hautes, croix atteignable ;
 *   · boîte à outils réduite aux outils courants, le reste sous « Plus d'outils » ;
 *   · palette Couleurs : pastilles et roue plus grandes, et une fois dépliée on
 *     n'affiche plus que RVB + hexadécimal + alpha (TSV et RAL sont redondants
 *     et mangeaient la place au profit de curseurs minuscules) ;
 *   · mode compact activé en même temps : le ruban sur une ligne et la barre
 *     d'état masquée rendent à la toile la hauteur que les grosses cibles prennent.
 *
 * Les deux réglages restent indépendants dans Paramètres › Apparence.
 */
(function () {
    'use strict';

    const MODE_KEY = 'illu_touch_mode';
    const PROMPT_KEY = 'illu_touch_prompt_done';
    const ALL_TOOLS_KEY = 'illu_touch_tools_all';
    /* Préférence « mode compact » d'avant l'activation du tactile, pour la rendre
       telle quelle si l'utilisateur repasse en interface souris. */
    const COMPACT_RESTORE_KEY = 'illu_touch_compact_restore';
    const BODY_CLASS = 'illu-touch-mode';
    const ALL_TOOLS_CLASS = 'illu-touch-tools-all';

    /* Deux appuis avant de proposer quoi que ce soit : un effleurement isolé
       (paume, clic accidentel) ne doit pas ouvrir de bandeau. */
    const PROMPT_AFTER_POINTERS = 2;

    let _touchPointerCount = 0;
    let _promptEl = null;

    function readFlag(key) {
        try {
            return localStorage.getItem(key) === '1';
        } catch (e) {
            return false;
        }
    }

    function writeFlag(key, on) {
        try {
            localStorage.setItem(key, on ? '1' : '0');
        } catch (e) {
            /* ignore */
        }
    }

    function t(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const v = window.IlluI18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /* ── Mode ────────────────────────────────────────────────────────────── */

    function isEnabled() {
        return readFlag(MODE_KEY);
    }

    function showAllTools() {
        return readFlag(ALL_TOOLS_KEY);
    }

    /** Le mode compact est-il forcé par le mode tactile ? */
    function compactIsForced() {
        return isEnabled();
    }

    function apply() {
        const on = isEnabled();
        document.body.classList.toggle(BODY_CLASS, on);
        /* Le compact n'était imposé qu'à l'instant de l'activation : après un
           rechargement — ou si le compact avait été coupé entre-temps — le mode
           tactile se retrouvait avec le ruban sur deux rangées et la barre
           d'état, c'est-à-dire de grosses cibles ET rien pour la toile. Il est
           donc réaffirmé à chaque application. */
        if (on && typeof window.illuIsCompactMode === 'function' &&
            typeof window.illuSetCompactMode === 'function' && !window.illuIsCompactMode()) {
            window.illuSetCompactMode(true);
        }
        document.body.classList.toggle(ALL_TOOLS_CLASS, on && showAllTools());
        syncToolsToggleButton();
        /* Nuancier : la taille de pastille est une constante lue par
           refreshPaletteGridLayout, qui la pose en grid-template-columns inline.
           On la relève plutôt que de la forcer en CSS — sinon les pastilles
           débordent de leurs pistes et se chevauchent. */
        window.ILLU_PALETTE_CELL_PX = on ? 16 : 13;
        /* Les palettes volantes sont positionnées en pixels : à cibles agrandies
           elles peuvent déborder de l'écran. */
        if (typeof window.illuClampAllFloatingPalettes === 'function') {
            window.illuClampAllFloatingPalettes();
        }
        if (window.EditorManager && typeof window.EditorManager.refreshPaletteGridLayout === 'function') {
            window.EditorManager.refreshPaletteGridLayout();
        } else if (typeof window.refreshPaletteGridLayout === 'function') {
            window.refreshPaletteGridLayout();
        }
        window.dispatchEvent(new CustomEvent('illu-touch-mode-changed', { detail: { enabled: on } }));
    }

    function setEnabled(on) {
        if (on) {
            /* Mémoriser la préférence compact d'avant, pour ne pas la perdre. */
            const hadCompact =
                typeof window.illuIsCompactMode === 'function' ? window.illuIsCompactMode() : false;
            writeFlag(COMPACT_RESTORE_KEY, !hadCompact);
            writeFlag(MODE_KEY, true);
            apply(); /* apply() se charge d'allumer le compact */
            return;
        }
        writeFlag(MODE_KEY, false);
        /* Rendre la préférence d'avant : le compact n'était allumé que pour le
           tactile, il n'a pas à rester imposé une fois celui-ci coupé. */
        if (readFlag(COMPACT_RESTORE_KEY) && typeof window.illuSetCompactMode === 'function') {
            window.illuSetCompactMode(false);
        }
        writeFlag(COMPACT_RESTORE_KEY, false);
        apply();
    }

    /* ── Boîte à outils réduite ──────────────────────────────────────────── */

    /* Le repli est purement visuel (css/touch-mode.css masque les autres
       boutons) : aucun outil n'est retiré du DOM, les raccourcis clavier et le
       sélecteur du ruban continuent de tout atteindre. */
    function setShowAllTools(on) {
        writeFlag(ALL_TOOLS_KEY, on);
        document.body.classList.toggle(ALL_TOOLS_CLASS, isEnabled() && on);
        syncToolsToggleButton();
    }

    function ensureToolsToggleButton() {
        const box = document.getElementById('main-toolbox');
        if (!box) return null;
        let btn = document.getElementById('illu-touch-tools-toggle');
        if (btn) return btn;
        btn = document.createElement('button');
        btn.type = 'button';
        btn.id = 'illu-touch-tools-toggle';
        btn.className = 'illu-touch-tools-toggle';
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            setShowAllTools(!showAllTools());
        });
        box.appendChild(btn);
        return btn;
    }

    function syncToolsToggleButton() {
        const btn = ensureToolsToggleButton();
        if (!btn) return;
        const all = showAllTools();
        btn.textContent = all
            ? t('touch.fewerTools', 'Moins d’outils')
            : t('touch.moreTools', 'Plus d’outils');
        btn.setAttribute('aria-pressed', all ? 'true' : 'false');
    }

    /* ── Proposition ─────────────────────────────────────────────────────── */

    function dismissPrompt(remember) {
        if (remember) writeFlag(PROMPT_KEY, true);
        if (_promptEl && _promptEl.parentNode) _promptEl.parentNode.removeChild(_promptEl);
        _promptEl = null;
    }

    function showPrompt() {
        if (_promptEl) return;
        const host = document.getElementById('workspace') || document.body;
        const el = document.createElement('div');
        el.className = 'illu-touch-prompt';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-live', 'polite');

        const msg = document.createElement('div');
        msg.className = 'illu-touch-prompt__msg';
        msg.innerHTML =
            '<strong>' + t('touch.promptTitle', 'Stylet détecté') + '</strong>' +
            '<span>' +
            t(
                'touch.promptBody',
                'Passer en mode tactile ? Cibles agrandies, barres de titre simplifiées, outils courants seuls, ruban sur une ligne.'
            ) +
            '</span>';

        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'illu-touch-prompt__btn illu-touch-prompt__btn--primary';
        accept.textContent = t('touch.promptAccept', 'Activer');
        accept.addEventListener('click', () => {
            setEnabled(true);
            dismissPrompt(true);
        });

        const decline = document.createElement('button');
        decline.type = 'button';
        decline.className = 'illu-touch-prompt__btn';
        decline.textContent = t('touch.promptDecline', 'Non merci');
        decline.addEventListener('click', () => dismissPrompt(true));

        el.appendChild(msg);
        el.appendChild(decline);
        el.appendChild(accept);
        host.appendChild(el);
        _promptEl = el;

        /* Sans réponse, le bandeau s'efface tout seul — mais la question pourra
           revenir à la prochaine session : on ne mémorise que les réponses. */
        setTimeout(() => dismissPrompt(false), 20000);
    }

    function onPointerDown(e) {
        if (!e || (e.pointerType !== 'pen' && e.pointerType !== 'touch')) return;
        if (isEnabled() || readFlag(PROMPT_KEY)) return;
        /* Le mode téléphone a déjà sa propre interface tactile. */
        if (document.body.classList.contains('illu-mobile-ui')) return;
        const t2 = e.target;
        if (!t2 || typeof t2.closest !== 'function' || !t2.closest('#workspace')) return;
        _touchPointerCount++;
        if (_touchPointerCount >= PROMPT_AFTER_POINTERS) showPrompt();
    }

    /* ── API ─────────────────────────────────────────────────────────────── */

    window.IlluTouchMode = {
        isEnabled,
        setEnabled,
        apply,
        compactIsForced,
        showAllTools,
        setShowAllTools,
        /** Rouvre la proposition (Paramètres, tests). */
        resetPrompt() {
            writeFlag(PROMPT_KEY, false);
            _touchPointerCount = 0;
        }
    };

    function init() {
        apply();
        window.addEventListener('pointerdown', onPointerDown, true);
        window.addEventListener('illu-lang-changed', syncToolsToggleButton);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
