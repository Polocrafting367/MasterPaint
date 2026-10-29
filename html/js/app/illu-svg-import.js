/**
 * Dialogue d’import SVG : projet cible + découpage en calques.
 */
(function () {
    'use strict';

    let _pending = null;

    function overlayEl() {
        return document.getElementById('svg-import-overlay');
    }

    function canSpriteSheet(text, filename) {
        return (
            typeof window.illuShouldOpenAsSpriteSheet === 'function' &&
            window.illuShouldOpenAsSpriteSheet(text, filename)
        );
    }

    function vectorProjectActive() {
        const em = window.EditorManager;
        return !!(em && em.activeProject && em.activeProject.mode === 'vector');
    }

    /**
     * @param {string} text
     * @param {string} filename
     * @param {(opts: {target:'new'|'current',layerMode:'single'|'split'|'sprite'}) => void} onConfirm
     */
    window.illuPromptSvgImport = function (text, filename, onConfirm) {
        const ov = overlayEl();
        if (!ov) {
            if (typeof onConfirm === 'function') {
                onConfirm({ target: 'new', layerMode: canSpriteSheet(text, filename) ? 'sprite' : 'split' });
            }
            return;
        }

        _pending = { text, filename, onConfirm };
        const spriteWrap = document.getElementById('svg-import-layers-sprite-wrap');
        const showSprite = canSpriteSheet(text, filename);
        if (spriteWrap) spriteWrap.hidden = !showSprite;

        const targetNew = ov.querySelector('input[name="svg-import-target"][value="new"]');
        const targetCur = ov.querySelector('input[name="svg-import-target"][value="current"]');
        const layerSingle = ov.querySelector('input[name="svg-import-layers"][value="single"]');
        const layerSplit = ov.querySelector('input[name="svg-import-layers"][value="split"]');
        const layerSprite = ov.querySelector('input[name="svg-import-layers"][value="sprite"]');

        const curOk = vectorProjectActive();
        if (targetNew) targetNew.checked = !curOk;
        if (targetCur && curOk) targetCur.checked = true;
        if (layerSplit && !showSprite) layerSplit.checked = true;
        if (layerSprite && showSprite) layerSprite.checked = true;

        if (targetCur) {
            targetCur.disabled = !curOk;
            if (!curOk && targetNew) targetNew.checked = true;
        }

        ov.style.display = 'flex';
    };

    function closeOverlay() {
        const ov = overlayEl();
        if (ov) ov.style.display = 'none';
        _pending = null;
    }

    function bindOnce() {
        const ov = overlayEl();
        if (!ov || ov.dataset.illuSvgImportBound === '1') return;
        ov.dataset.illuSvgImportBound = '1';

        const btnOk = document.getElementById('btn-svg-import-ok');
        const btnCancel = document.getElementById('btn-svg-import-cancel');

        if (btnCancel) {
            btnCancel.addEventListener('click', () => closeOverlay());
        }

        if (btnOk) {
            btnOk.addEventListener('click', () => {
                if (!_pending) {
                    closeOverlay();
                    return;
                }
                const targetEl = ov.querySelector('input[name="svg-import-target"]:checked');
                const layerEl = ov.querySelector('input[name="svg-import-layers"]:checked');
                const opts = {
                    target: targetEl && targetEl.value === 'current' ? 'current' : 'new',
                    layerMode:
                        layerEl && layerEl.value === 'sprite'
                            ? 'sprite'
                            : layerEl && layerEl.value === 'single'
                              ? 'single'
                              : 'split'
                };
                const cb = _pending.onConfirm;
                const text = _pending.text;
                const filename = _pending.filename;
                closeOverlay();
                if (typeof cb === 'function') cb(opts);
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bindOnce);
    } else {
        bindOnce();
    }
})();
