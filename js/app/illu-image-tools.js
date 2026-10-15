/**
 * Outils d'image : bordure du document et extension de la zone de travail.
 *
 * Les deux dialogues réutilisent la fenêtre volante des effets (#effect-dialog),
 * comme applyEffect('dropshadow') : même chrome, même placement mémorisé, même
 * bouton OK. Ils partagent aussi deux briques :
 *   — le bloc de marges « unifié ou par côté » (case à cocher + 1 ou 4 champs) ;
 *   — le champ de couleur, qui sait piocher les couleurs primaire / secondaire
 *     de la fenêtre des couleurs de l'application.
 */
(function () {
    'use strict';

    function t(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const tr = window.IlluI18n.t(key);
            if (tr && tr !== key) return tr;
        }
        return fallback;
    }

    function esc(v) {
        return String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    }

    /* ── Fenêtre ─────────────────────────────────────────────────────────── */

    /**
     * Ouvre #effect-dialog avec un contenu libre et un seul bouton d'action.
     * @param {{title:string, html:string, width?:number, onApply:() => void}} spec
     */
    function openImageToolDialog(spec) {
        const dialog = document.getElementById('effect-dialog');
        const win = document.getElementById('effect-dialog-window');
        const content = document.getElementById('effect-dialog-content');
        if (!dialog || !win || !content) return null;

        const titleEl = document.getElementById('effect-dialog-title');
        if (titleEl) titleEl.textContent = spec.title;
        content.innerHTML = spec.html;

        const width = spec.width || 340;
        win.classList.add('floating-window');
        win.style.position = 'fixed';
        win.style.width = width + 'px';
        const hasPos =
            (typeof window.applyEffectDialogSavedPosition === 'function' &&
                window.applyEffectDialogSavedPosition(win)) ||
            (win.style.left &&
                String(win.style.left).trim() !== '' &&
                win.style.top &&
                String(win.style.top).trim() !== '');
        if (!hasPos) {
            const w = win.offsetWidth || width;
            const h = win.offsetHeight || 240;
            win.style.left = Math.max(0, Math.round((window.innerWidth - w) / 2)) + 'px';
            win.style.top = Math.max(0, Math.round((window.innerHeight - h) / 2)) + 'px';
        }
        if (typeof window.WindowManager !== 'undefined' && window.WindowManager.bringToFront) {
            window.WindowManager.bringToFront(win);
        }

        /* Pas de RAZ ni de « Fermer » : OK + Annuler, comme le redimensionnement. */
        if (typeof window.illuSetEffectDialogFooterMode === 'function') {
            window.illuSetEffectDialogFooterMode('resize');
        }
        dialog.style.display = 'block';
        document.body.classList.add('effect-dialog-open');
        if (typeof window.illuScheduleEffectDialogWorkspaceClamp === 'function') {
            window.illuScheduleEffectDialogWorkspaceClamp();
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(win);
        }

        const close = () => {
            dialog.style.display = 'none';
            document.body.classList.remove('effect-dialog-open');
            if (typeof window.illuSetEffectDialogFooterMode === 'function') {
                window.illuSetEffectDialogFooterMode('default');
            }
            window.applyCurrentEffectModal = function () {
                window.FilterManager.apply();
            };
        };
        window.applyCurrentEffectModal = function () {
            try {
                spec.onApply();
            } finally {
                close();
            }
        };
        return { close };
    }

    /* ── Bloc de marges : unifié ou par côté ─────────────────────────────── */

    /**
     * Fabrique le HTML du bloc « unifié / par côté ».
     * @param {string} ns préfixe des identifiants (ex. « ex » ou « ib »)
     * @param {{value?:number, min?:number, labelWidth?:number}} [opts]
     */
    function marginBlockHtml(ns, opts) {
        opts = opts || {};
        const v = opts.value != null ? opts.value : 0;
        const min = opts.min != null ? opts.min : 0;
        const lw = opts.labelWidth || 74;
        const row = (id, label) =>
            `<div class="field-row illu-imgtool-row"><label style="width:${lw}px;">${esc(label)}</label>` +
            `<input type="number" id="${ns}-${id}" value="${v}" min="${min}" style="flex:1;min-width:0;"> px</div>`;
        return `
        <div class="field-row illu-imgtool-row illu-imgtool-unified-row">
            <label class="illu-imgtool-check">
                <input type="checkbox" id="${ns}-unified" checked>
                <span data-i18n="dlg.marginUnified">${esc(t('dlg.marginUnified', 'Uniforme sur les 4 côtés'))}</span>
            </label>
        </div>
        <div id="${ns}-uni-wrap">
            ${row('all', t('dlg.marginAll', 'Taille'))}
        </div>
        <div id="${ns}-sides-wrap" hidden>
            ${row('mt', t('dlg.extendTop', 'Haut'))}
            ${row('ml', t('dlg.extendLeft', 'Gauche'))}
            ${row('mr', t('dlg.extendRight', 'Droite'))}
            ${row('mb', t('dlg.extendBottom', 'Bas'))}
        </div>`;
    }

    /** Branche la case « unifié » : elle bascule entre le champ unique et les 4 champs. */
    function bindMarginBlock(ns, onChange) {
        const chk = document.getElementById(ns + '-unified');
        const uni = document.getElementById(ns + '-uni-wrap');
        const sides = document.getElementById(ns + '-sides-wrap');
        if (!chk || !uni || !sides) return;
        const ids = ['mt', 'ml', 'mr', 'mb'];
        const sync = () => {
            const unified = chk.checked;
            uni.hidden = !unified;
            sides.hidden = unified;
            if (!unified) {
                /* Décoché : les 4 champs partent de la valeur unique, on ne perd rien. */
                const all = document.getElementById(ns + '-all');
                const v = all ? all.value : '0';
                ids.forEach((id) => {
                    const el = document.getElementById(ns + '-' + id);
                    if (el && !el.dataset.touched) el.value = v;
                });
            }
            if (typeof onChange === 'function') onChange();
        };
        chk.addEventListener('change', sync);
        ids.forEach((id) => {
            const el = document.getElementById(ns + '-' + id);
            if (el) el.addEventListener('input', () => { el.dataset.touched = '1'; if (onChange) onChange(); });
        });
        const all = document.getElementById(ns + '-all');
        if (all && onChange) all.addEventListener('input', onChange);
        sync();
    }

    /** Lit le bloc de marges. @returns {{mt:number, ml:number, mr:number, mb:number}} */
    function readMarginBlock(ns) {
        const num = (id) => {
            const el = document.getElementById(id);
            const v = parseInt(el && el.value, 10);
            return Number.isFinite(v) && v > 0 ? v : 0;
        };
        const chk = document.getElementById(ns + '-unified');
        if (!chk || chk.checked) {
            const all = num(ns + '-all');
            return { mt: all, ml: all, mr: all, mb: all };
        }
        return {
            mt: num(ns + '-mt'),
            ml: num(ns + '-ml'),
            mr: num(ns + '-mr'),
            mb: num(ns + '-mb')
        };
    }

    /* ── Champ de couleur ────────────────────────────────────────────────── */

    function toHex(c) {
        const h = (n) => Math.max(0, Math.min(255, n | 0)).toString(16).padStart(2, '0');
        return '#' + h(c.r) + h(c.g) + h(c.b);
    }

    function editorColor(which) {
        const em = window.EditorManager;
        const c = em && (which === 'secondary' ? em.secondaryColor : em.primaryColor);
        return c ? { r: c.r | 0, g: c.g | 0, b: c.b | 0, a: c.a == null ? 255 : c.a | 0 } : { r: 0, g: 0, b: 0, a: 255 };
    }

    /**
     * Champ couleur : nuancier natif + opacité + rappel des couleurs primaire et
     * secondaire de la fenêtre des couleurs.
     */
    function colorFieldHtml(ns, initial) {
        const c = initial || editorColor('primary');
        const alphaPct = Math.round((c.a / 255) * 100);
        return `
        <div class="field-row illu-imgtool-row illu-imgtool-color-row">
            <label style="width:74px;" data-i18n="dlg.borderColor">${esc(t('dlg.borderColor', 'Couleur'))}</label>
            <input type="color" id="${ns}-color" value="${toHex(c)}" class="illu-imgtool-swatch">
            <button type="button" id="${ns}-color-pri" class="illu-imgtool-color-pick"
                data-i18n="dlg.colorPrimary">${esc(t('dlg.colorPrimary', 'Primaire'))}</button>
            <button type="button" id="${ns}-color-sec" class="illu-imgtool-color-pick"
                data-i18n="dlg.colorSecondary">${esc(t('dlg.colorSecondary', 'Secondaire'))}</button>
        </div>
        <div class="field-row illu-imgtool-row">
            <label style="width:74px;" data-i18n="dlg.borderOpacity">${esc(t('dlg.borderOpacity', 'Opacité'))}</label>
            <input type="range" id="${ns}-alpha" min="0" max="100" value="${alphaPct}" style="flex:1;min-width:0;">
            <span id="${ns}-alpha-val" style="width:30px;text-align:right;">${alphaPct}</span>
        </div>`;
    }

    function bindColorField(ns, onChange) {
        const swatch = document.getElementById(ns + '-color');
        const alpha = document.getElementById(ns + '-alpha');
        const alphaVal = document.getElementById(ns + '-alpha-val');
        const fire = () => { if (typeof onChange === 'function') onChange(); };
        if (alpha && alphaVal) {
            alpha.addEventListener('input', () => {
                alphaVal.textContent = alpha.value;
                fire();
            });
        }
        if (swatch) swatch.addEventListener('input', fire);
        const pick = (which) => {
            const c = editorColor(which);
            if (swatch) swatch.value = toHex(c);
            if (alpha) {
                alpha.value = String(Math.round((c.a / 255) * 100));
                if (alphaVal) alphaVal.textContent = alpha.value;
            }
            fire();
        };
        const pri = document.getElementById(ns + '-color-pri');
        const sec = document.getElementById(ns + '-color-sec');
        if (pri) pri.addEventListener('click', (e) => { e.preventDefault(); pick('primary'); });
        if (sec) sec.addEventListener('click', (e) => { e.preventDefault(); pick('secondary'); });
    }

    /** @returns {{r:number,g:number,b:number,a:number}} a en 0-255 */
    function readColorField(ns) {
        const swatch = document.getElementById(ns + '-color');
        const alpha = document.getElementById(ns + '-alpha');
        const hex = (swatch && swatch.value) || '#000000';
        const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
        const pct = alpha ? Math.max(0, Math.min(100, parseInt(alpha.value, 10) || 0)) : 100;
        if (!m) return { r: 0, g: 0, b: 0, a: Math.round((pct / 100) * 255) };
        return {
            r: parseInt(m[1], 16),
            g: parseInt(m[2], 16),
            b: parseInt(m[3], 16),
            a: Math.round((pct / 100) * 255)
        };
    }

    function cssRgba(c) {
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${(c.a / 255).toFixed(3)})`;
    }

    /* ── Garde-fous communs ──────────────────────────────────────────────── */

    function alertMsg(key, fallback) {
        window.showIlluAlert(t(key, fallback));
    }

    /** @returns {boolean} true si le document accepte une commande de géométrie. */
    function checkDocument(pixelOnly) {
        const em = window.EditorManager;
        const p = em && em.activeProject;
        const okMode = p && (p.mode === 'vector' || em.isPixelMode);
        if (!em || !p || !okMode || (pixelOnly && !em.isPixelMode)) {
            alertMsg(
                pixelOnly ? 'msg.borderPixel' : 'msg.extendCanvasPixel',
                pixelOnly
                    ? 'Disponible sur un document en mode Pixel.'
                    : 'Disponible sur un document principal (Pixel ou Vecteur SVG).'
            );
            return false;
        }
        if (p.role === 'layerAlphaMask') {
            alertMsg('msg.extendCanvasMask', 'Ouvrez le document principal pour cette commande.');
            return false;
        }
        return true;
    }

    /* ── Étendre la zone de travail ──────────────────────────────────────── */

    window.showExtendCanvasDialog = function () {
        if (!checkDocument(false)) return;
        const em = window.EditorManager;

        const html = `
        <p style="margin:0 0 8px;font-size:11px;">${esc(t('dlg.extendWorkHint', 'Marges à ajouter (px) autour du document :'))}</p>
        ${marginBlockHtml('ex', { value: 0 })}
        <div class="field-row illu-imgtool-row" style="margin-top:6px;">
            <label class="illu-imgtool-check">
                <input type="checkbox" id="ex-fill">
                <span data-i18n="dlg.extendFill">${esc(t('dlg.extendFill', 'Remplir la zone ajoutée'))}</span>
            </label>
        </div>
        <div id="ex-fill-wrap" hidden>${colorFieldHtml('ex')}</div>
        <p id="ex-preview" class="illu-imgtool-preview"></p>`;

        openImageToolDialog({
            title: t('dlg.extendWork', 'Étendre la zone de travail'),
            html,
            width: 330,
            onApply() {
                const m = readMarginBlock('ex');
                if (m.mt + m.ml + m.mr + m.mb <= 0) return;
                const fill = document.getElementById('ex-fill');
                /* Le remplissage n'existe qu'en pixel : sans ce garde-fou, un document
                 * vecteur serait étendu en silencieux sans jamais écrire l'historique. */
                const color = fill && fill.checked && em.isPixelMode ? readColorField('ex') : null;
                em.extendDocumentMargins(m.ml, m.mt, m.mr, m.mb, { silent: !!color });
                if (color && em.isPixelMode) {
                    paintMarginRing(em, m, color, 'new', t('layer.borderName', 'Bordure'));
                    em.saveHistory(t('dlg.extendWork', 'Étendre la zone de travail'), {
                        documentGeometry: true
                    });
                }
            }
        });

        const updatePreview = () => {
            const el = document.getElementById('ex-preview');
            if (!el) return;
            const m = readMarginBlock('ex');
            const w = (em.width | 0) + m.ml + m.mr;
            const h = (em.height | 0) + m.mt + m.mb;
            el.textContent = t('dlg.newSize', 'Nouvelle taille') + ' : ' + w + ' × ' + h + ' px';
        };
        bindMarginBlock('ex', updatePreview);
        bindColorField('ex', null);
        const fill = document.getElementById('ex-fill');
        const fillWrap = document.getElementById('ex-fill-wrap');
        if (fill && fillWrap) {
            fill.addEventListener('change', () => { fillWrap.hidden = !fill.checked; });
            const fillRow = fill.closest('.illu-imgtool-row');
            if (!em.isPixelMode && fillRow) fillRow.hidden = true;
        }
        updatePreview();
    };

    /* ── Bordure d'image ─────────────────────────────────────────────────── */

    /**
     * Peint le cadre (les 4 bandes) sur un calque.
     * @param {object} em EditorManager
     * @param {{mt:number,ml:number,mr:number,mb:number}} m épaisseurs
     * @param {{r:number,g:number,b:number,a:number}} color
     * @param {'new'|'active'} target
     * @param {string} layerName nom du calque créé quand target vaut « new »
     */
    function paintMarginRing(em, m, color, target, layerName) {
        const W = Math.max(1, em.width | 0);
        const H = Math.max(1, em.height | 0);
        if (target === 'new') em.addLayer(layerName);
        const layer = em.activeLayer;
        if (!layer) return;
        if (!layer.buffer) {
            const buf = document.createElement('canvas');
            buf.width = W;
            buf.height = H;
            layer.buffer = buf;
        }
        /* Le tampon peut être décalé ou plus petit que le document : on le remet
         * d'aplomb, sinon les bandes seraient peintes à côté du cadre. */
        if (layer.buffer.width !== W || layer.buffer.height !== H || (layer.x | 0) || (layer.y | 0)) {
            const buf = document.createElement('canvas');
            buf.width = W;
            buf.height = H;
            buf.getContext('2d', { willReadFrequently: true }).drawImage(layer.buffer, layer.x | 0, layer.y | 0);
            layer.buffer = buf;
            layer.x = 0;
            layer.y = 0;
        }
        const ctx = layer.buffer.getContext('2d', { willReadFrequently: true });
        ctx.save();
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = cssRgba(color);
        /* Un seul tracé pair-impair (cadre extérieur moins fenêtre intérieure) :
         * avec quatre rectangles, les coins seraient peints deux fois et
         * ressortiraient plus foncés dès que la couleur n'est pas opaque. */
        const innerW = W - m.ml - m.mr;
        const innerH = H - m.mt - m.mb;
        if (innerW <= 0 || innerH <= 0) {
            ctx.fillRect(0, 0, W, H);
        } else {
            ctx.beginPath();
            ctx.rect(0, 0, W, H);
            ctx.rect(m.ml, m.mt, innerW, innerH);
            ctx.fill('evenodd');
        }
        ctx.restore();
        if (em.isAnimationMode && layer.cels && layer.cels.length) {
            /* Mode animation : le cel courant pointe le tampon, on le repointe. */
            layer.cels.forEach((cel) => {
                if (cel && cel.buffer && cel.frame === 0) cel.buffer = layer.buffer;
            });
        }
        em.render();
        em.updateLayerUI();
    }

    /**
     * Bordure d'image : un cadre de couleur autour du document, soit en agrandissant
     * la toile (le cadre s'ajoute autour de l'image), soit en peignant à l'intérieur
     * des bords existants (la taille du document ne bouge pas).
     */
    window.showImageBorderDialog = function () {
        if (!checkDocument(true)) return;
        const em = window.EditorManager;

        const html = `
        <p style="margin:0 0 8px;font-size:11px;">${esc(t('dlg.borderHint', 'Ajoute un cadre de couleur autour de l’image.'))}</p>
        <div class="field-row illu-imgtool-row">
            <label style="width:74px;" data-i18n="dlg.borderMode">${esc(t('dlg.borderMode', 'Position'))}</label>
            <select id="ib-mode" class="illu-select-mini" style="flex:1;min-width:0;">
                <option value="outside" data-i18n="dlg.borderOutside">${esc(t('dlg.borderOutside', 'Autour (agrandit la toile)'))}</option>
                <option value="inside" data-i18n="dlg.borderInside">${esc(t('dlg.borderInside', 'À l’intérieur (taille inchangée)'))}</option>
            </select>
        </div>
        ${marginBlockHtml('ib', { value: 12, min: 0 })}
        ${colorFieldHtml('ib')}
        <div class="field-row illu-imgtool-row">
            <label style="width:74px;" data-i18n="dlg.borderTarget">${esc(t('dlg.borderTarget', 'Destination'))}</label>
            <select id="ib-target" class="illu-select-mini" style="flex:1;min-width:0;">
                <option value="new" data-i18n="dlg.borderTargetNew">${esc(t('dlg.borderTargetNew', 'Nouveau calque'))}</option>
                <option value="active" data-i18n="dlg.borderTargetActive">${esc(t('dlg.borderTargetActive', 'Calque actif'))}</option>
            </select>
        </div>
        <p id="ib-preview" class="illu-imgtool-preview"></p>`;

        openImageToolDialog({
            title: t('dlg.borderTitle', 'Bordure d’image'),
            html,
            width: 340,
            onApply() {
                const m = readMarginBlock('ib');
                if (m.mt + m.ml + m.mr + m.mb <= 0) return;
                const mode = (document.getElementById('ib-mode') || {}).value || 'outside';
                const target = (document.getElementById('ib-target') || {}).value || 'new';
                const color = readColorField('ib');
                if (mode === 'outside') {
                    em.extendDocumentMargins(m.ml, m.mt, m.mr, m.mb, { silent: true });
                }
                paintMarginRing(em, m, color, target, t('layer.borderName', 'Bordure'));
                em.saveHistory(t('dlg.borderTitle', 'Bordure d’image'), {
                    documentGeometry: mode === 'outside'
                });
            }
        });

        const updatePreview = () => {
            const el = document.getElementById('ib-preview');
            if (!el) return;
            const m = readMarginBlock('ib');
            const outside = ((document.getElementById('ib-mode') || {}).value || 'outside') === 'outside';
            const w = (em.width | 0) + (outside ? m.ml + m.mr : 0);
            const h = (em.height | 0) + (outside ? m.mt + m.mb : 0);
            el.textContent = t('dlg.newSize', 'Nouvelle taille') + ' : ' + w + ' × ' + h + ' px';
        };
        bindMarginBlock('ib', updatePreview);
        bindColorField('ib', null);
        const mode = document.getElementById('ib-mode');
        if (mode) mode.addEventListener('change', updatePreview);
        updatePreview();
    };
})();
