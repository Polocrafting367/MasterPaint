/**
 * Étendre / réduire la sélection d'un nombre de pixels (Édition).
 *
 * +5 dilate le contour de 5 px, -3 l'érode de 3 px. Le calcul passe par une
 * transformée de distance (js/tools/select-core.js) : le coût ne dépend pas du
 * rayon, contrairement à une dilatation par disque.
 *
 * Le « joint » décide du sort des angles, comme pour un décalage de contour :
 * arrondi (défaut), biseauté, ou conservé — ce dernier laisse un rectangle
 * rectangulaire au lieu de lui arrondir les coins. Il s'applique aussi à la
 * réduction, sinon réduire puis étendre d'autant ne redonnerait pas la forme
 * de départ.
 *
 * La boîte applique en direct : on part d'une copie du masque d'origine et on
 * recalcule à chaque changement de valeur, de sorte que « Annuler » remet
 * exactement la sélection de départ.
 */
(function () {
    'use strict';

    const OVERLAY_ID = 'illu-sel-expand-overlay';
    let base = null;      // { mask, w, h, layerId }
    let applyTimer = 0;
    /* Retenu d'une ouverture à l'autre : on règle rarement ça une seule fois. */
    let join = 'round';

    function tr(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const v = window.IlluI18n.t(key);
            if (v !== key) return v;
        }
        return fallback;
    }

    function activeLayer() {
        const em = window.EditorManager;
        return em && em.isPixelMode ? em.activeLayer : null;
    }

    function snapshot() {
        const l = activeLayer();
        if (!l || !l.buffer) return null;
        if (typeof window.rasterizeCurrentSelectionToLayerMask !== 'function') return null;
        const m = window.rasterizeCurrentSelectionToLayerMask();
        if (!m) return null;
        let any = false;
        for (let i = 0; i < m.length; i++) if (m[i]) { any = true; break; }
        if (!any) return null;
        return { mask: m, w: l.buffer.width, h: l.buffer.height, layerId: l.id };
    }

    /** Recalcule la sélection à partir du masque d'origine. */
    function applyPixels(px, joinMode) {
        if (!base) return;
        const l = activeLayer();
        if (!l || !l.buffer || l.id !== base.layerId) return;
        if (l.buffer.width !== base.w || l.buffer.height !== base.h) return;
        const Core = window.IlluSelectCore;
        const j = joinMode || join;
        const out = px && Core ? Core.growMask(base.mask, base.w, base.h, px, j) : base.mask;
        if (typeof window.commitLayerMaskAsSelection === 'function') {
            window.commitLayerMaskAsSelection(out, base.w, base.h);
        }
        if (window.EditorManager) window.EditorManager.render();
    }

    function scheduleApply(px) {
        if (applyTimer) clearTimeout(applyTimer);
        applyTimer = setTimeout(() => {
            applyTimer = 0;
            applyPixels(px);
        }, 60);
    }

    const JOIN_LABELS = {
        round: ['dlg.selExpandJoinRound', 'Arrondi'],
        bevel: ['dlg.selExpandJoinBevel', 'Biseau'],
        miter: ['dlg.selExpandJoinMiter', 'Angles']
    };

    function close(restore) {
        if (applyTimer) { clearTimeout(applyTimer); applyTimer = 0; }
        if (restore) applyPixels(0);
        base = null;
        const ov = document.getElementById(OVERLAY_ID);
        if (ov) ov.remove();
    }

    function build() {
        const ov = document.createElement('div');
        ov.id = OVERLAY_ID;
        ov.style.cssText =
            'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:13040;' +
            'display:flex;align-items:center;justify-content:center;';
        ov.innerHTML = `
            <div class="window" style="width:340px;max-width:95vw;">
                <div class="title-bar">
                    <div class="title-bar-text">${tr('dlg.selExpand', 'Étendre / réduire la sélection')}</div>
                </div>
                <div class="window-body" style="font-size:12px;">
                    <p style="margin:0 0 10px;opacity:.8;line-height:1.35;">
                        ${tr('dlg.selExpandHint', 'Valeur positive : la sélection grandit. Négative : elle rétrécit.')}
                    </p>
                    <div class="field-row" style="gap:8px;align-items:center;">
                        <label for="illu-sel-expand-num" style="flex:0 0 auto;">${tr('dlg.selExpandPixels', 'Pixels')}</label>
                        <input type="number" id="illu-sel-expand-num" value="5" min="-500" max="500" step="1"
                               style="width:72px;">
                        <input type="range" id="illu-sel-expand-range" min="-100" max="100" step="1" value="5"
                               style="flex:1;">
                    </div>
                    <div class="field-row" style="gap:8px;align-items:center;margin-top:10px;">
                        <label style="flex:0 0 auto;">${tr('dlg.selExpandJoin', 'Angles')}</label>
                        <div class="illu-scope-btn-row illu-settings-scope-btn-row" id="illu-sel-expand-join"
                             role="group" style="flex:1;">
                            ${['round', 'bevel', 'miter'].map((k) => `
                            <button type="button" class="illu-scope-btn illu-settings-scope-btn" data-value="${k}"
                                    title="${tr('dlg.selExpandJoin' + k[0].toUpperCase() + k.slice(1) + 'Hint', '')}">
                                ${tr(JOIN_LABELS[k][0], JOIN_LABELS[k][1])}
                            </button>`).join('')}
                        </div>
                    </div>
                    <p style="margin:8px 0 0;font-size:10px;opacity:.7;line-height:1.3;" id="illu-sel-expand-join-hint"></p>
                    <div class="field-row" style="gap:6px;margin-top:10px;justify-content:flex-end;">
                        <button type="button" id="illu-sel-expand-cancel">${tr('common.cancel', 'Annuler')}</button>
                        <button type="button" id="illu-sel-expand-ok" class="primary">${tr('common.ok', 'OK')}</button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(ov);

        const num = ov.querySelector('#illu-sel-expand-num');
        const rng = ov.querySelector('#illu-sel-expand-range');
        const read = () => {
            let v = parseInt(num.value, 10);
            if (!Number.isFinite(v)) v = 0;
            return Math.max(-500, Math.min(500, v));
        };
        const sync = (from) => {
            const v = read();
            if (from !== 'num') num.value = String(v);
            if (from !== 'range') rng.value = String(Math.max(-100, Math.min(100, v)));
            scheduleApply(v);
        };
        const joinRow = ov.querySelector('#illu-sel-expand-join');
        const joinHint = ov.querySelector('#illu-sel-expand-join-hint');
        const HINTS = {
            round: tr('dlg.selExpandJoinRoundHint', 'Les angles deviennent des arrondis (comportement par défaut).'),
            bevel: tr('dlg.selExpandJoinBevelHint', 'Les angles sont coupés en biais.'),
            miter: tr('dlg.selExpandJoinMiterHint',
                'Les angles droits sont conservés : un rectangle reste un rectangle. Les angles obliques sont mitrés à 45°.')
        };
        const setJoin = (v) => {
            join = JOIN_LABELS[v] ? v : 'round';
            if (typeof window.illuSettingsScopeSetActive === 'function') {
                window.illuSettingsScopeSetActive(joinRow, join);
            }
            if (joinHint) joinHint.textContent = HINTS[join] || '';
            scheduleApply(read());
        };
        joinRow.addEventListener('click', (e) => {
            const b = e.target.closest('.illu-scope-btn');
            if (b) setJoin(b.getAttribute('data-value'));
        });
        setJoin(join);

        num.addEventListener('input', () => sync('num'));
        rng.addEventListener('input', () => { num.value = rng.value; sync('range'); });
        ov.querySelector('#illu-sel-expand-ok').addEventListener('click', () => {
            if (applyTimer) { clearTimeout(applyTimer); applyTimer = 0; }
            applyPixels(read());
            close(false);
        });
        ov.querySelector('#illu-sel-expand-cancel').addEventListener('click', () => close(true));
        ov.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); close(true); }
            else if (e.key === 'Enter') { e.stopPropagation(); applyPixels(read()); close(false); }
        });
        setTimeout(() => num.focus(), 0);
        sync();
        return ov;
    }

    window.showSelectionExpandDialog = function () {
        if (document.getElementById(OVERLAY_ID)) return;
        base = snapshot();
        if (!base) {
            const msg = tr('dlg.selExpandNoSel', 'Aucune sélection active.');
            if (typeof window.showToast === 'function') {
                window.showToast(msg, window.innerWidth / 2, 80);
            } else {
                console.warn(msg);
            }
            return;
        }
        build();
    };

    /**
     * Raccourci programmatique (sans boîte) : +n étend, -n réduit.
     * @param {'round'|'bevel'|'miter'} [joinMode] traitement des angles
     */
    window.illuExpandSelectionByPixels = function (px, joinMode) {
        const snap = snapshot();
        if (!snap || !px) return false;
        base = snap;
        applyPixels(px, joinMode || join);
        base = null;
        return true;
    };
})();
