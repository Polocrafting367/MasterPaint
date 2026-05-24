/**
 * Boutons − / + pour les jauges de précision (taille texte, contour, etc.).
 */
(function () {
    'use strict';

    const GAUGE_STEP_CONFIG = [
        { id: 'tool-text-size', step: 1 },
        { id: 'tool-text-stroke-w', step: 1 },
        { id: 'tool-text-grad-angle', step: 1 },
        { id: 'tool-size', step: 1 },
        { id: 'tool-shape-corner-radius', step: 1 },
        { id: 'tool-brush-hardness', step: 5 },
        { id: 'wand-tolerance', step: 1 },
        { id: 'fill-tolerance', step: 1 }
    ];

    function bumpRange(range, delta) {
        const min = Number(range.min) || 0;
        const max = Number(range.max) || 100;
        const step = Number(range.step) > 0 ? Number(range.step) : 1;
        let v = Number(range.value);
        if (!Number.isFinite(v)) v = min;
        v = Math.round((v + delta) / step) * step;
        v = Math.max(min, Math.min(max, v));
        if (Number(range.value) === v) return;
        range.value = String(v);
        range.dispatchEvent(new Event('input', { bubbles: true }));
        range.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function ensureGaugeTrack(wrap) {
        if (wrap.querySelector('.illu-gauge-track')) return wrap.querySelector('.illu-gauge-track');
        const track = document.createElement('span');
        track.className = 'illu-gauge-track';
        while (wrap.firstChild) {
            track.appendChild(wrap.firstChild);
        }
        wrap.appendChild(track);
        return track;
    }

    function wireGaugeSteppers() {
        GAUGE_STEP_CONFIG.forEach((cfg) => {
            const range = document.getElementById(cfg.id);
            if (!range || range.dataset.illuGaugeStepWired === '1') return;
            const wrap = range.closest('.illu-gauge-wrap');
            if (!wrap) return;
            range.dataset.illuGaugeStepWired = '1';
            if (wrap.querySelector('.illu-gauge-step--minus')) return;

            ensureGaugeTrack(wrap);
            wrap.classList.add('illu-gauge-wrap--has-steps');

            const mk = (dir) => {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = `illu-gauge-step illu-gauge-step--${dir}`;
                b.textContent = dir === 'minus' ? '−' : '+';
                b.setAttribute(
                    'aria-label',
                    dir === 'minus' ? 'Diminuer' : 'Augmenter'
                );
                b.tabIndex = -1;
                return b;
            };
            const minus = mk('minus');
            const plus = mk('plus');
            wrap.insertBefore(minus, wrap.firstChild);
            wrap.appendChild(plus);

            const step = cfg.step || 1;
            minus.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (typeof window.extendPixelTextEditorIgnoreBlur === 'function') {
                    window.extendPixelTextEditorIgnoreBlur(3000);
                }
            });
            plus.addEventListener('mousedown', (e) => {
                e.preventDefault();
                if (typeof window.extendPixelTextEditorIgnoreBlur === 'function') {
                    window.extendPixelTextEditorIgnoreBlur(3000);
                }
            });
            minus.addEventListener('click', (e) => {
                e.preventDefault();
                bumpRange(range, -step);
            });
            plus.addEventListener('click', (e) => {
                e.preventDefault();
                bumpRange(range, step);
            });
        });
    }

    window.setupIlluGaugeSteppers = wireGaugeSteppers;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', wireGaugeSteppers);
    } else {
        wireGaugeSteppers();
    }
})();
