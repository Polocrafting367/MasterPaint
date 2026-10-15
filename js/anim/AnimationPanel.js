/**
 * AnimationPanel — frise chronologique (UI) du mode animation.
 *
 * Panneau ancré en bas : barre d'outils (lecture, navigation, fps, images) + grille
 * calques × frames (losange = cel dessiné, barre = maintien, rond = clé de propriété).
 * Lit/écrit l'état via window.EditorManager + window.IlluAnim.
 */
(function () {
    'use strict';

    const DOC = document;
    let panel = null;
    let gridEl = null;
    let readoutEl = null;
    let fpsInput = null;
    let playBtn = null;
    let onionBtn = null;
    let onionOpts = null;
    let onionBeforeInput = null;
    let onionAfterInput = null;
    let onionOpacityInput = null;
    let onionAllBtn = null;
    let pingpongBtn = null;
    let drawStepBtn = null;
    let rafRefresh = 0;
    let _dragCel = null; // {layerIndex, frame} en cours de glisser-déposer
    let _selCell = { layerIndex: 0, frame: 0 }; // dernière cellule sélectionnée (copier/coller)
    let _panelHovered = false;
    let loopBtn = null;
    let durInput = null;
    let selInfoEl = null;
    let openBtn = null; // bouton de réouverture dans la barre d'état
    /** Sélection multi-images : { layers:[index…], from, to } (null = aucune). */
    let _sel = null;
    /** Ancre du Maj+clic (dernière cellule cliquée sans Maj). */
    let _selAnchor = null;
    /** Frise repliée par la croix de fermeture (le mode animation reste actif). */
    let _collapsed = false;

    function syncOnionOptsVisibility() {
        if (!onionOpts) return;
        const a = anim();
        onionOpts.style.display = a && a.onionSkin ? 'inline-flex' : 'none';
    }

    function em() {
        return window.EditorManager || null;
    }
    function anim() {
        const e = em();
        return e && e.animation ? e.animation : null;
    }
    function isAnim() {
        const e = em();
        return !!(e && e.isAnimationMode);
    }

    function t(key, fallback) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const v = window.IlluI18n.t(key);
            if (v && v !== key) return v;
        }
        return fallback;
    }

    /**
     * Icône FontAwesome (bibliothèque déjà chargée par l'application).
     * @param {string} name nom sans préfixe de style, ex. 'fa-play'
     */
    function faIcon(name) {
        const i = DOC.createElement('i');
        i.className = 'fa-solid ' + name + ' illu-anim-ico';
        i.setAttribute('aria-hidden', 'true');
        return i;
    }

    /**
     * Icône du sprite interne (icons/illu-sprite.svg), pour les deux notions que
     * FontAwesome ne couvre pas : pelure d'oignon et dessiner-puis-avancer.
     */
    function spriteIcon(id) {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = DOC.createElementNS(NS, 'svg');
        svg.setAttribute('class', 'illu-anim-ico');
        svg.setAttribute('viewBox', '0 0 16 16');
        svg.setAttribute('aria-hidden', 'true');
        svg.setAttribute('focusable', 'false');
        const use = DOC.createElementNS(NS, 'use');
        use.setAttribute('href', '#' + id);
        svg.appendChild(use);
        return svg;
    }

    /** Échange le glyphe FontAwesome d'un bouton (lecture ⇄ pause, œil ouvert/barré). */
    function setBtnIcon(el, name) {
        const i = el && el.querySelector('i.illu-anim-ico');
        if (i) i.className = 'fa-solid ' + name + ' illu-anim-ico';
    }

    /**
     * Bouton de la barre d'outils. `icon` est un nom FontAwesome ('fa-play') ou un nœud
     * déjà construit (spriteIcon). Les boutons n'ont pas de libellé visible : le titre
     * fait aussi office d'étiquette accessible.
     */
    function btn(icon, title, onClick, cls) {
        const b = DOC.createElement('button');
        b.type = 'button';
        b.appendChild(typeof icon === 'string' ? faIcon(icon) : icon);
        if (title) {
            b.title = title;
            b.setAttribute('aria-label', title);
        }
        if (cls) b.className = cls;
        b.addEventListener('click', onClick);
        return b;
    }

    function sep() {
        const s = DOC.createElement('span');
        s.className = 'illu-anim-sep';
        return s;
    }

    // ---- Sélection multi-images -------------------------------------------

    function allLayerIndices() {
        const e = em();
        return e && e.layers ? e.layers.map((l, i) => i) : [];
    }

    /** Sélection normalisée (bornes triées, indices valides) ou null. */
    function normSel() {
        const IA = window.IlluAnim;
        if (!IA || !IA.normalizeSelection) return null;
        return IA.normalizeSelection(em(), _sel);
    }

    /**
     * Sélection effective des opérations : la sélection explicite si elle existe,
     * sinon la cellule courante (calque actif × tête de lecture).
     */
    function opsSelection() {
        const s = normSel();
        if (s) return s;
        const e = em();
        const a = anim();
        if (!e || !a) return null;
        const f = a.playhead | 0;
        return { layers: [e.activeLayerIndex], from: f, to: f };
    }

    function setSelection(sel) {
        _sel = sel;
        scheduleRefresh();
        syncSelectionMirror();
    }

    function clearSelection() {
        _sel = null;
        _selAnchor = null;
        scheduleRefresh();
        syncSelectionMirror();
    }

    function selectAllFrames() {
        const IA = window.IlluAnim;
        const s = IA && IA.wholeTimelineSelection ? IA.wholeTimelineSelection(em()) : null;
        if (s) {
            _selAnchor = { layerIndex: 0, frame: 0 };
            setSelection(s);
        }
    }

    function isCellSelected(li, f) {
        const s = normSel();
        return !!(s && f >= s.from && f <= s.to && s.layers.indexOf(li) >= 0);
    }

    /** Étend la sélection depuis l'ancre jusqu'à (li, f) — Maj+clic. */
    function extendSelectionTo(li, f) {
        const a = _selAnchor || { layerIndex: li, frame: f };
        const l0 = Math.min(a.layerIndex, li);
        const l1 = Math.max(a.layerIndex, li);
        const layers = [];
        for (let i = l0; i <= l1; i++) layers.push(i);
        setSelection({ layers, from: Math.min(a.frame, f), to: Math.max(a.frame, f) });
    }

    /** Publie la sélection pour les consommateurs externes (portée des effets). */
    function syncSelectionMirror() {
        const s = normSel();
        window.IlluAnimSelection = s
            ? { layers: s.layers.slice(), from: s.from, to: s.to }
            : null;
        DOC.dispatchEvent(new CustomEvent('illu:anim-selection-changed', { detail: window.IlluAnimSelection }));
    }

    // ---- Petit menu flottant réutilisable ---------------------------------

    function makeMenu(id) {
        closeFloatingMenus();
        const menu = DOC.createElement('div');
        menu.id = id;
        menu.className = 'illu-anim-menu';
        const api = {
            el: menu,
            add(label, fn, disabled) {
                const it = DOC.createElement('div');
                it.className = 'illu-anim-menu-item';
                it.textContent = label;
                if (disabled) it.classList.add('illu-anim-menu-item--off');
                if (!disabled) {
                    it.addEventListener('click', () => {
                        closeFloatingMenus();
                        fn();
                    });
                }
                menu.appendChild(it);
                return it;
            },
            sep() {
                const d = DOC.createElement('div');
                d.className = 'illu-anim-menu-sep';
                menu.appendChild(d);
            },
            title(label) {
                const d = DOC.createElement('div');
                d.className = 'illu-anim-menu-title';
                d.textContent = label;
                menu.appendChild(d);
            },
            show(clientX, clientY) {
                DOC.body.appendChild(menu);
                const mw = menu.offsetWidth;
                const mh = menu.offsetHeight;
                let x = clientX;
                let y = clientY;
                if (x + mw > innerWidth) x = innerWidth - mw - 6;
                if (y + mh > innerHeight) y = innerHeight - mh - 6;
                menu.style.left = Math.max(4, x) + 'px';
                menu.style.top = Math.max(4, y) + 'px';
                setTimeout(() => DOC.addEventListener('pointerdown', closeFloatingMenus, { once: true }), 0);
            }
        };
        return api;
    }

    function closeFloatingMenus() {
        DOC.querySelectorAll('.illu-anim-menu').forEach((m) => m.remove());
    }

    /** Menu des opérations groupées sur la sélection. */
    function openSelectionMenu(clientX, clientY) {
        const IA = window.IlluAnim;
        const E = em();
        if (!IA || !E) return;
        const s = opsSelection();
        const nFrames = s ? s.to - s.from + 1 : 0;
        const nLayers = s ? s.layers.length : 0;
        const m = makeMenu('illu-anim-sel-menu');
        m.title(
            s
                ? t('anim.selSummary', 'Sélection') + ` : ${nLayers} × ${nFrames}`
                : t('anim.selNone', 'Aucune sélection')
        );
        m.add(t('anim.selAll', 'Tout sélectionner (Ctrl+A)'), selectAllFrames);
        m.add(t('anim.selClearSel', 'Désélectionner (Échap)'), clearSelection, !_sel);
        m.sep();
        m.add(t('anim.selCopy', 'Copier la plage'), () => {
            IA.copySelection(E, s);
            scheduleRefresh();
        }, !s);
        m.add(
            t('anim.selPaste', 'Coller la plage ici'),
            () => {
                withAnimHistory(t('anim.histPaste', 'Coller une plage d’images'), () =>
                    IA.pasteSelection(E, s.layers[0], s.from)
                );
            },
            !s || !IA.hasRangeClipboard()
        );
        m.sep();
        m.add(t('anim.selClear', 'Effacer le dessin des images'), () => {
            withAnimHistory(
                t('anim.histClear', 'Effacer les images sélectionnées'),
                () => IA.clearSelectionCels(E, s),
                { pixelSel: s }
            );
        }, !s);
        m.add(t('anim.selDelete', 'Supprimer les cels (Suppr)'), () => {
            withAnimHistory(
                t('anim.histDelete', 'Supprimer des cels'),
                () => IA.removeSelectionCels(E, s),
                { pixelSel: s }
            );
        }, !s);
        m.sep();
        m.add(t('anim.selShiftLeft', 'Décaler ← d’une image'), () => {
            withAnimHistory(t('anim.histShift', 'Décaler des cels'), () => IA.shiftSelectionCels(E, s, -1));
        }, !s);
        m.add(t('anim.selShiftRight', 'Décaler → d’une image'), () => {
            withAnimHistory(t('anim.histShift', 'Décaler des cels'), () => IA.shiftSelectionCels(E, s, 1));
        }, !s);
        m.add(t('anim.selReverse', 'Inverser l’ordre de la plage'), () => {
            withAnimHistory(t('anim.histReverse', 'Inverser une plage'), () => IA.reverseSelectionCels(E, s));
        }, !s || nFrames < 2);
        m.sep();
        m.title(t('anim.exposure', 'Cadence (images par dessin)'));
        [1, 2, 3, 4].forEach((n) => {
            m.add(
                t('anim.exposureN', 'Animer sur') + ` ${n}`,
                () => {
                    withAnimHistory(t('anim.histExposure', 'Changer la cadence'), () =>
                        IA.setSelectionExposure(E, s, n)
                    );
                },
                !s
            );
        });
        m.show(clientX, clientY);
    }

    /**
     * Exécute une opération de frise entre deux points d'historique, de sorte que Ctrl+Z
     * rende bien l'état d'avant : l'historique bitmap seul ne suit que `layer.buffer`,
     * c'est-à-dire l'unique image affichée.
     *
     * La *structure* (images clés, maintiens, durée, tween) est clichée par référence —
     * coût négligeable. Les *pixels* ne le sont que pour les opérations qui écrivent dans
     * un buffer existant (effacement), via `opts.pixelSel` : tout cloner reviendrait à
     * dupliquer l'animation entière à chaque clic.
     *
     * @param {string} label
     * @param {function} fn
     * @param {{pixelSel?: object}} [opts]
     */
    function withAnimHistory(label, fn, opts) {
        const E = em();
        if (!E) return;
        const pixelSel = opts && opts.pixelSel ? opts.pixelSel : null;
        const refs = () =>
            pixelSel && typeof E.animCelRefsForSelection === 'function'
                ? E.animCelRefsForSelection(pixelSel)
                : null;
        if (typeof E.pushHistoryCheckpoint === 'function') {
            E.pushHistoryCheckpoint(t('anim.histBefore', 'Avant modification de la frise'), {
                animCels: refs(),
                animStructure: true
            });
        }
        fn();
        if (typeof E.saveHistory === 'function') {
            E.saveHistory(label, {
                patchActiveLayer: !!(E.activeLayer && E.activeLayer.buffer),
                animCels: refs(),
                animStructure: true
            });
        }
        scheduleRefresh();
    }

    const PANEL_H_KEY = 'illu-anim-panel-height';

    function setPanelHeight(h) {
        const min = 96;
        const max = Math.max(min, Math.round(window.innerHeight * 0.72));
        const v = Math.max(min, Math.min(max, Math.round(h)));
        DOC.documentElement.style.setProperty('--anim-panel-h', v + 'px');
        try {
            localStorage.setItem(PANEL_H_KEY, String(v));
        } catch (e) {
            /* ignore */
        }
    }

    function restorePanelHeight() {
        let v = 0;
        try {
            v = parseInt(localStorage.getItem(PANEL_H_KEY) || '', 10);
        } catch (e) {
            /* ignore */
        }
        if (v && v > 60) DOC.documentElement.style.setProperty('--anim-panel-h', v + 'px');
    }

    function wireResizeHandle(handle) {
        let startY = 0;
        let startH = 0;
        let dragging = false;
        const onMove = (e) => {
            if (!dragging) return;
            const dy = e.clientY - startY;
            setPanelHeight(startH - dy); // tirer vers le haut = plus grand
        };
        const onUp = (e) => {
            dragging = false;
            try {
                handle.releasePointerCapture(e.pointerId);
            } catch (err) {
                /* ignore */
            }
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            repositionFloatingWindowsAbovePanel();
            if (typeof window.fitActiveProjectZoomToWorkspace === 'function' && em() && em().activeProject) {
                // Le workspace a changé de taille : rien de forcé, on laisse la vue.
            }
        };
        handle.addEventListener('pointerdown', (e) => {
            dragging = true;
            startY = e.clientY;
            startH = panel.getBoundingClientRect().height;
            try {
                handle.setPointerCapture(e.pointerId);
            } catch (err) {
                /* ignore */
            }
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            e.preventDefault();
        });
    }

    function ensurePanel() {
        if (panel) return panel;
        restorePanelHeight();
        panel = DOC.createElement('div');
        panel.id = 'illu-anim-panel';

        // Poignée de redimensionnement (bord haut).
        const handle = DOC.createElement('div');
        handle.className = 'illu-anim-resize';
        handle.title = t('anim.resize', 'Redimensionner le panneau');
        panel.appendChild(handle);
        wireResizeHandle(handle);

        // --- Barre d'outils ---
        const bar = DOC.createElement('div');
        bar.className = 'illu-anim-toolbar';

        bar.appendChild(btn('fa-backward-fast', t('anim.first', 'Première image'), () => window.IlluAnim.gotoFirst(em())));
        bar.appendChild(btn('fa-backward-step', t('anim.prev', 'Image précédente'), () => window.IlluAnim.step(em(), -1)));
        playBtn = btn('fa-play', t('anim.play', 'Lecture / Pause'), () => window.IlluAnim.togglePlay(em()));
        bar.appendChild(playBtn);
        bar.appendChild(btn('fa-forward-step', t('anim.next', 'Image suivante'), () => window.IlluAnim.step(em(), 1)));
        bar.appendChild(btn('fa-forward-fast', t('anim.last', 'Dernière image'), () => window.IlluAnim.gotoLast(em())));

        bar.appendChild(sep());

        // fps
        const fpsLbl = DOC.createElement('label');
        fpsLbl.textContent = t('anim.fps', 'IPS');
        fpsInput = DOC.createElement('input');
        fpsInput.type = 'number';
        fpsInput.min = '1';
        fpsInput.max = '60';
        fpsInput.value = '12';
        fpsInput.addEventListener('change', () => window.IlluAnim.setFps(em(), parseInt(fpsInput.value, 10)));
        fpsLbl.appendChild(fpsInput);
        bar.appendChild(fpsLbl);

        bar.appendChild(sep());

        bar.appendChild(btn('fa-plus', t('anim.addFrame', 'Ajouter une image'), () =>
            withAnimHistory(t('anim.addFrame', 'Ajouter une image'), () => window.IlluAnim.addFrame(em()))));
        bar.appendChild(btn('fa-copy', t('anim.dupCel', 'Dupliquer le cel'), () =>
            withAnimHistory(t('anim.dupCel', 'Dupliquer le cel'), () => window.IlluAnim.duplicateCel(em()))));
        bar.appendChild(btn('fa-turn-down', t('anim.insertFrame', 'Insérer une image ici'), () =>
            withAnimHistory(t('anim.insertFrame', 'Insérer une image ici'), () => window.IlluAnim.insertFrame(em()))));
        bar.appendChild(btn('fa-trash', t('anim.delFrame', 'Supprimer l’image'), () =>
            withAnimHistory(t('anim.delFrame', 'Supprimer l’image'), () => window.IlluAnim.removeFrame(em()))));

        bar.appendChild(sep());

        onionBtn = btn(spriteIcon('illu-icon-anim-onion'), t('anim.onion', 'Pelure d’oignon'), () => {
            const a = anim();
            if (!a) return;
            a.onionSkin = !a.onionSkin;
            onionBtn.classList.toggle('illu-anim-on', a.onionSkin);
            syncOnionOptsVisibility();
            em().render();
        });
        bar.appendChild(onionBtn);

        // Contrôles de profondeur de la pelure d'oignon (nb d'images avant/après + opacité).
        onionOpts = DOC.createElement('span');
        onionOpts.className = 'illu-anim-onion-opts';
        const mkNum = (icon, title, get, set, min, max) => {
            const wrap = DOC.createElement('label');
            wrap.className = 'illu-anim-onion-num';
            wrap.title = title;
            wrap.appendChild(faIcon(icon));
            const inp = DOC.createElement('input');
            inp.type = 'number';
            inp.min = String(min);
            inp.max = String(max);
            inp.value = String(get());
            inp.addEventListener('change', () => {
                const a = anim();
                if (!a) return;
                let v = parseInt(inp.value, 10);
                if (!Number.isFinite(v)) v = min;
                v = Math.max(min, Math.min(max, v));
                inp.value = String(v);
                set(a, v);
                em().render();
            });
            wrap.appendChild(inp);
            return { wrap, inp };
        };
        const beforeCtl = mkNum('fa-caret-left', t('anim.onionBefore', 'Images précédentes affichées'),
            () => (anim() ? anim().onionBefore : 1), (a, v) => (a.onionBefore = v), 0, 10);
        const afterCtl = mkNum('fa-caret-right', t('anim.onionAfter', 'Images suivantes affichées'),
            () => (anim() ? anim().onionAfter : 1), (a, v) => (a.onionAfter = v), 0, 10);
        onionBeforeInput = beforeCtl.inp;
        onionAfterInput = afterCtl.inp;
        const opaWrap = DOC.createElement('label');
        opaWrap.className = 'illu-anim-onion-num';
        opaWrap.title = t('anim.onionOpacity', 'Opacité des fantômes');
        opaWrap.appendChild(faIcon('fa-circle-half-stroke'));
        onionOpacityInput = DOC.createElement('input');
        onionOpacityInput.type = 'range';
        onionOpacityInput.min = '5';
        onionOpacityInput.max = '100';
        onionOpacityInput.step = '5';
        onionOpacityInput.value = '40';
        onionOpacityInput.addEventListener('input', () => {
            const a = anim();
            if (!a) return;
            a.onionOpacity = Math.max(0.05, Math.min(1, parseInt(onionOpacityInput.value, 10) / 100));
            em().render();
        });
        opaWrap.appendChild(onionOpacityInput);
        // Teintes personnalisables (avant / après).
        const mkTint = (title, get, set) => {
            const inp = DOC.createElement('input');
            inp.type = 'color';
            inp.title = title;
            inp.className = 'illu-anim-onion-tint';
            inp.value = get();
            inp.addEventListener('input', () => {
                const a = anim();
                if (!a) return;
                set(a, inp.value);
                em().render();
            });
            return inp;
        };
        const tintBefore = mkTint(t('anim.onionTintBefore', 'Teinte images précédentes'),
            () => (anim() ? anim().onionTintBefore || '#2a6bff' : '#2a6bff'), (a, v) => (a.onionTintBefore = v));
        const tintAfter = mkTint(t('anim.onionTintAfter', 'Teinte images suivantes'),
            () => (anim() ? anim().onionTintAfter || '#ff3b3b' : '#ff3b3b'), (a, v) => (a.onionTintAfter = v));
        // Toutes les couches.
        onionAllBtn = btn('fa-layer-group', t('anim.onionAll', 'Pelure sur toutes les couches'), () => {
            const a = anim();
            if (!a) return;
            a.onionAllLayers = !a.onionAllLayers;
            onionAllBtn.classList.toggle('illu-anim-on', a.onionAllLayers);
            em().render();
        });
        onionOpts.appendChild(beforeCtl.wrap);
        onionOpts.appendChild(afterCtl.wrap);
        onionOpts.appendChild(opaWrap);
        onionOpts.appendChild(tintBefore);
        onionOpts.appendChild(tintAfter);
        onionOpts.appendChild(onionAllBtn);
        bar.appendChild(onionOpts);

        bar.appendChild(sep());

        // Inversion / ping-pong / draw & step.
        bar.appendChild(btn('fa-arrow-right-arrow-left', t('anim.reverse', 'Inverser l’animation'), () =>
            withAnimHistory(t('anim.reverse', 'Inverser l’animation'), () => window.IlluAnim.reverseAnimation(em()))));
        pingpongBtn = btn('fa-arrows-left-right', t('anim.pingpong', 'Lecture aller-retour (ping-pong)'), () => {
            window.IlluAnim.togglePingPong(em());
            const a = anim();
            pingpongBtn.classList.toggle('illu-anim-on', !!(a && a.pingpong));
        });
        bar.appendChild(pingpongBtn);
        drawStepBtn = btn(spriteIcon('illu-icon-anim-draw-step'), t('anim.drawStep', 'Avancer d’une image après chaque tracé'), () => {
            const a = anim();
            if (!a) return;
            a.drawStep = !a.drawStep;
            drawStepBtn.classList.toggle('illu-anim-on', a.drawStep);
        });
        bar.appendChild(drawStepBtn);

        bar.appendChild(sep());

        // Boucle de lecture + durée totale de la frise.
        loopBtn = btn('fa-repeat', t('anim.loop', 'Lecture en boucle'), () => {
            window.IlluAnim.toggleLoop(em());
            const a = anim();
            loopBtn.classList.toggle('illu-anim-on', !!(a && a.loop));
        });
        bar.appendChild(loopBtn);

        const durLbl = DOC.createElement('label');
        durLbl.textContent = t('anim.duration', 'Images');
        durLbl.title = t('anim.durationTitle', 'Nombre total d’images de l’animation');
        durInput = DOC.createElement('input');
        durInput.type = 'number';
        durInput.min = '1';
        durInput.max = '9999';
        durInput.value = '24';
        durInput.addEventListener('change', () => {
            const v = parseInt(durInput.value, 10);
            if (Number.isFinite(v) && v > 0) {
                withAnimHistory(t('anim.duration', 'Images'), () => window.IlluAnim.setDuration(em(), v));
            }
        });
        durLbl.appendChild(durInput);
        bar.appendChild(durLbl);

        bar.appendChild(sep());

        // Opérations groupées sur la sélection (effacer, décaler, cadence…).
        const selBtn = btn('fa-table-cells', t('anim.selMenu', 'Sélection d’images : opérations groupées'), (ev) => {
            const r = ev.currentTarget.getBoundingClientRect();
            openSelectionMenu(r.left, r.bottom + 2);
        });
        bar.appendChild(selBtn);

        selInfoEl = DOC.createElement('span');
        selInfoEl.className = 'illu-anim-sel-info';
        selInfoEl.title = t('anim.selInfoTitle', 'Images sélectionnées — les effets peuvent leur être appliqués (portée « Images » de la fenêtre d’effet)');
        bar.appendChild(selInfoEl);

        readoutEl = DOC.createElement('span');
        readoutEl.className = 'illu-anim-frame-readout';
        bar.appendChild(readoutEl);

        // Sortie de piste : quitter le mode animation (aplatit). Trait bas : réduire la frise.
        const exitBtn = btn('fa-right-from-bracket', t('anim.exitMode', 'Quitter le mode animation (aplatit sur l’image courante)'), () => {
            requestExitAnimationMode();
        }, 'illu-anim-exit-btn');
        bar.appendChild(exitBtn);
        // Réduction, pas fermeture : le mode animation reste actif, seule la frise se replie.
        const closeBtn = btn('fa-window-minimize', t('anim.collapsePanel', 'Réduire la frise (le mode animation reste actif)'), () => {
            collapsePanel(true);
        }, 'illu-anim-collapse-btn');
        bar.appendChild(closeBtn);

        panel.appendChild(bar);

        // --- Frise (grille) ---
        const timeline = DOC.createElement('div');
        timeline.className = 'illu-anim-timeline';
        gridEl = DOC.createElement('div');
        gridEl.className = 'illu-anim-grid';
        timeline.appendChild(gridEl);
        panel.appendChild(timeline);

        panel.addEventListener('pointerenter', () => (_panelHovered = true));
        panel.addEventListener('pointerleave', () => (_panelHovered = false));

        mountPanel(panel);
        return panel;
    }

    /**
     * Ancre la frise DANS le flux de l'application, entre la zone de travail
     * (#editor-dock-row / #workspace-wrapper) et la barre d'état — pas au-dessous d'elle.
     * Repli sur <body> si la coquille applicative n'est pas encore là.
     */
    function mountPanel(el) {
        const statusBar = DOC.getElementById('app-status-bar');
        const host = statusBar ? statusBar.parentNode : null;
        if (host && statusBar) {
            host.insertBefore(el, statusBar);
            el.classList.add('illu-anim-inflow');
            return;
        }
        const dockRow = DOC.getElementById('editor-dock-row');
        if (dockRow && dockRow.parentNode) {
            dockRow.parentNode.insertBefore(el, dockRow.nextSibling);
            el.classList.add('illu-anim-inflow');
            return;
        }
        DOC.body.appendChild(el);
        DOC.body.classList.add('illu-anim-floating');
    }

    /** Construit une cellule de règle (numéro d'image). */
    function rulerCell(frame, playhead) {
        const c = DOC.createElement('div');
        c.className = 'illu-anim-ruler-cell';
        c.dataset.frame = String(frame);
        if (frame % 5 === 0) {
            c.classList.add('illu-anim-tick');
            c.textContent = String(frame);
        }
        if (frame === playhead) c.classList.add('illu-anim-playhead-col');
        const s = normSel();
        if (s && frame >= s.from && frame <= s.to) c.classList.add('illu-anim-sel-col');
        // Clic = déplacer la tête de lecture ; glisser = sélectionner une plage d'images
        // sur tous les calques (le glisser-déposer de cel vit dans les cellules, pas ici).
        c.addEventListener('pointerdown', (ev) => {
            if (ev.button !== 0) return;
            ev.preventDefault();
            window.IlluAnim.seek(em(), frame);
            if (ev.shiftKey && _selAnchor) {
                extendSelectionTo(_selAnchor.layerIndex, frame);
            } else {
                _selAnchor = { layerIndex: 0, frame };
                setSelection({ layers: allLayerIndices(), from: frame, to: frame });
            }
            beginRulerDrag(frame);
        });
        return c;
    }

    /** Glisser sur la règle : étend la plage d'images sélectionnée. */
    function beginRulerDrag(startFrame) {
        const onMove = (ev) => {
            const el = DOC.elementFromPoint(ev.clientX, ev.clientY);
            const cell = el && el.closest ? el.closest('.illu-anim-ruler-cell, .illu-anim-cell') : null;
            if (!cell || cell.dataset.frame == null) return;
            const f = parseInt(cell.dataset.frame, 10);
            if (!Number.isFinite(f)) return;
            setSelection({ layers: allLayerIndices(), from: startFrame, to: f });
        };
        const onUp = () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
        };
        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
    }

    /** Construit une cellule calque×frame. */
    /** Miniature d'un buffer de cel (aperçu dans la case). */
    function makeThumb(buffer) {
        const w = 20;
        const h = 20;
        const cv = DOC.createElement('canvas');
        cv.width = w;
        cv.height = h;
        cv.className = 'illu-anim-thumb';
        const cx = cv.getContext('2d');
        // damier de transparence
        cx.fillStyle = '#bbb';
        cx.fillRect(0, 0, w, h);
        cx.fillStyle = '#eee';
        for (let y = 0; y < h; y += 5) for (let x = 0; x < w; x += 5) {
            if (((x / 5) + (y / 5)) % 2 === 0) cx.fillRect(x, y, 5, 5);
        }
        if (buffer) {
            cx.imageSmoothingEnabled = true;
            cx.drawImage(buffer, 0, 0, w, h);
        }
        return cv;
    }

    function trackCell(layerIndex, layer, frame, playhead) {
        const c = DOC.createElement('div');
        c.className = 'illu-anim-cell';
        c.dataset.frame = String(frame);
        c.dataset.layer = String(layerIndex);
        if (isCellSelected(layerIndex, frame)) c.classList.add('illu-anim-sel');
        const IA = window.IlluAnim;
        const info = IA.activeCelInfo(layer, frame);
        const isCel = info && info.cel.frame === frame;
        if (info) {
            c.classList.add(isCel ? 'illu-anim-cel' : 'illu-anim-hold');
        }
        if (isCel) {
            c.appendChild(makeThumb(info.cel.buffer));
            // Glisser-déposer pour réordonner (pas le cel@0 de base).
            if (frame !== 0) {
                c.setAttribute('draggable', 'true');
                c.addEventListener('dragstart', (ev) => {
                    _dragCel = { layerIndex, frame };
                    if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move';
                });
            }
        }
        c.addEventListener('dragover', (ev) => {
            if (_dragCel && _dragCel.layerIndex === layerIndex) {
                ev.preventDefault();
                c.classList.add('illu-anim-drop');
            }
        });
        c.addEventListener('dragleave', () => c.classList.remove('illu-anim-drop'));
        c.addEventListener('drop', (ev) => {
            c.classList.remove('illu-anim-drop');
            if (_dragCel && _dragCel.layerIndex === layerIndex) {
                ev.preventDefault();
                const from = _dragCel.frame;
                withAnimHistory(t('anim.moveCel', 'Déplacer un cel'), () =>
                    IA.moveCel(em(), layerIndex, from, frame)
                );
                _dragCel = null;
                refresh();
            }
        });
        // clé de propriété présente à cette frame ?
        const pt = layer.propTracks;
        if (pt) {
            for (const k in pt) {
                if (pt[k] && pt[k].some((kf) => kf.frame === frame)) {
                    c.classList.add('illu-anim-key');
                    break;
                }
            }
        }
        if (frame === playhead) c.classList.add('illu-anim-playhead-col');

        c.addEventListener('click', (e) => {
            const e2 = em();
            _selCell = { layerIndex, frame };
            // Maj+clic : étend la sélection depuis l'ancre. Ctrl/Cmd+clic : ajoute ou retire
            // le calque de la sélection en cours. Clic simple : sélectionne cette cellule.
            if (e.shiftKey) {
                extendSelectionTo(layerIndex, frame);
            } else if ((e.ctrlKey || e.metaKey) && normSel()) {
                const s = normSel();
                const layers = s.layers.slice();
                const k = layers.indexOf(layerIndex);
                if (k >= 0) layers.splice(k, 1);
                else layers.push(layerIndex);
                setSelection({ layers, from: s.from, to: s.to });
            } else {
                _selAnchor = { layerIndex, frame };
                setSelection({ layers: [layerIndex], from: frame, to: frame });
            }
            e2.setActiveLayerIndex(layerIndex);
            IA.seek(e2, frame);
            if (e.altKey) {
                // Alt+clic : matérialise un cel éditable ici
                e2.ensureEditableCelAtPlayhead(layerIndex);
                e2.render();
                refresh();
            }
        });
        c.addEventListener('dblclick', () => {
            const e2 = em();
            e2.setActiveLayerIndex(layerIndex);
            IA.seek(e2, frame);
            e2.ensureEditableCelAtPlayhead(layerIndex);
            e2.render();
            refresh();
        });
        c.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // Clic droit dans une sélection multiple : opérations groupées.
            const s = normSel();
            const inSel = isCellSelected(layerIndex, frame);
            const multi = s && (s.layers.length > 1 || s.to > s.from);
            if (inSel && multi) {
                openSelectionMenu(e.clientX, e.clientY);
                return;
            }
            openCellMenu(e, layerIndex, layer, frame);
        });
        return c;
    }

    /** Petit menu contextuel de cellule. */
    function openCellMenu(evt, layerIndex, layer, frame) {
        const IA = window.IlluAnim;
        const m = makeMenu('illu-anim-cell-menu');
        const add = (label, fn, disabled) => m.add(label, fn, disabled);

        add(t('anim.menuKey', 'Créer un cel ici (image clé)'), () => {
            const e2 = em();
            e2.setActiveLayerIndex(layerIndex);
            IA.seek(e2, frame);
            e2.ensureEditableCelAtPlayhead(layerIndex);
            e2.render();
            refresh();
        });
        add(t('anim.menuDup', 'Dupliquer ce cel →'), () =>
            withAnimHistory(t('anim.menuDup', 'Dupliquer ce cel →'), () => IA.duplicateCel(em(), layerIndex, frame)));
        add(t('anim.menuCopy', 'Copier le cel'), () => {
            IA.copyCel(em(), layerIndex, frame);
        });
        add(t('anim.menuPaste', 'Coller le cel ici'), () =>
            withAnimHistory(t('anim.menuPaste', 'Coller le cel ici'), () => IA.pasteCel(em(), layerIndex, frame)),
            !IA.hasClipboard());
        add(t('anim.menuExtend', 'Étendre ce dessin sur… images'), () => {
            const n = parseInt(window.prompt(t('anim.extendPrompt', 'Sur combien d’images suivantes ?'), '3'), 10);
            if (Number.isFinite(n) && n > 0) {
                withAnimHistory(t('anim.menuExtend', 'Étendre ce dessin sur… images'), () =>
                    IA.repeatCelOverRange(em(), layerIndex, frame, n)
                );
            }
        });
        add(
            t('anim.menuClear', 'Effacer ce cel'),
            () => withAnimHistory(t('anim.menuClear', 'Effacer ce cel'), () => IA.clearCel(em(), layerIndex, frame)),
            !IA.hasCelAt(layer, frame) || frame === 0
        );
        add(t('anim.menuHold', 'Figer jusqu’à cette image'), () => {
            const info = IA.activeCelInfo(layer, frame);
            if (info) {
                withAnimHistory(t('anim.menuHold', 'Figer jusqu’à cette image'), () =>
                    IA.setCelHoldUntil(em(), layerIndex, info.cel.frame, frame)
                );
            }
        });
        m.sep();
        add(t('anim.menuPosKey', 'Clé de position (x/y)'), () => {
            IA.addPropKeyframe(em(), layerIndex, 'x', frame);
            IA.addPropKeyframe(em(), layerIndex, 'y', frame);
        });
        add(t('anim.menuOpaKey', 'Clé d’opacité'), () => IA.addPropKeyframe(em(), layerIndex, 'opacity', frame));
        add(t('anim.menuScaleKey', 'Clé d’échelle'), () => IA.addPropKeyframe(em(), layerIndex, 'scale', frame));
        add(t('anim.menuRotKey', 'Clé de rotation'), () => IA.addPropKeyframe(em(), layerIndex, 'rotation', frame));
        add(t('anim.menuHueKey', 'Clé de teinte (couleur)'), () => {
            const cur = em().activeLayer && em().activeLayer.animHue ? em().activeLayer.animHue : 0;
            const v = parseInt(window.prompt(t('anim.huePrompt', 'Teinte à cette image (degrés, -180 à 180) :'), String(cur)), 10);
            if (Number.isFinite(v)) IA.addPropKeyframe(em(), layerIndex, 'hue', frame, v);
        });

        // Easing des clés présentes à cette image (courbe d'accélération éditable).
        if (IA.hasPropKeyAt(layer, frame)) {
            m.sep();
            [
                ['linear', t('anim.easeLinear', 'Easing : linéaire')],
                ['ease-in', t('anim.easeIn', 'Easing : accélère')],
                ['ease-out', t('anim.easeOut', 'Easing : ralentit')],
                ['ease-in-out', t('anim.easeInOut', 'Easing : accélère puis ralentit')],
                ['hold', t('anim.easeHold', 'Easing : maintien (paliers)')]
            ].forEach(([val, label]) => add(label, () => IA.setEasingAtFrame(em(), layerIndex, frame, val)));
        }

        m.show(evt.clientX, evt.clientY);
    }

    /** Reconstruit la grille depuis l'état courant. */
    function refresh() {
        if (!panel) return;
        const e = em();
        const a = anim();
        if (!e || !a) return;
        const dur = Math.max(1, a.duration | 0);
        const playhead = a.playhead | 0;

        if (fpsInput) fpsInput.value = String(a.fps || 12);
        if (playBtn) {
            setBtnIcon(playBtn, a.playing ? 'fa-pause' : 'fa-play');
            playBtn.classList.toggle('illu-anim-on', !!a.playing);
        }
        if (onionBtn) onionBtn.classList.toggle('illu-anim-on', !!a.onionSkin);
        if (onionBeforeInput && DOC.activeElement !== onionBeforeInput) {
            onionBeforeInput.value = String(a.onionBefore != null ? a.onionBefore : 1);
        }
        if (onionAfterInput && DOC.activeElement !== onionAfterInput) {
            onionAfterInput.value = String(a.onionAfter != null ? a.onionAfter : 1);
        }
        if (onionOpacityInput && DOC.activeElement !== onionOpacityInput) {
            onionOpacityInput.value = String(Math.round((a.onionOpacity != null ? a.onionOpacity : 0.4) * 100));
        }
        if (onionAllBtn) onionAllBtn.classList.toggle('illu-anim-on', !!a.onionAllLayers);
        if (pingpongBtn) pingpongBtn.classList.toggle('illu-anim-on', !!a.pingpong);
        if (drawStepBtn) drawStepBtn.classList.toggle('illu-anim-on', !!a.drawStep);
        if (loopBtn) loopBtn.classList.toggle('illu-anim-on', a.loop !== false);
        if (durInput && DOC.activeElement !== durInput) durInput.value = String(dur);
        syncOnionOptsVisibility();
        if (readoutEl) {
            const secs = dur / Math.max(1, a.fps || 12);
            readoutEl.textContent =
                `${playhead + 1} / ${dur} · ${a.fps || 12} ips · ${secs.toFixed(2)} s`;
        }
        if (selInfoEl) {
            const s = normSel();
            if (s) {
                const nF = s.to - s.from + 1;
                selInfoEl.textContent = `${t('anim.selShort', 'Sél.')} ${s.layers.length}×${nF}`;
                selInfoEl.classList.add('illu-anim-sel-info--on');
            } else {
                selInfoEl.textContent = '';
                selInfoEl.classList.remove('illu-anim-sel-info--on');
            }
        }

        // Grille : 1 colonne de libellé + `dur` colonnes de frame.
        gridEl.style.gridTemplateColumns = `var(--anim-label-w) repeat(${dur}, var(--anim-cell-w))`;

        const frag = DOC.createDocumentFragment();

        // Ligne règle
        const rl = DOC.createElement('div');
        rl.className = 'illu-anim-ruler-label';
        rl.textContent = t('anim.frames', 'Images');
        frag.appendChild(rl);
        for (let f = 0; f < dur; f++) frag.appendChild(rulerCell(f, playhead));

        // Lignes calque (haut = dernier calque, cohérent avec la pile de calques)
        const layers = e.layers || [];
        for (let li = layers.length - 1; li >= 0; li--) {
            const layer = layers[li];
            const lab = DOC.createElement('div');
            lab.className = 'illu-anim-track-label';
            if (li === e.activeLayerIndex) lab.classList.add('illu-anim-active');
            const vis = DOC.createElement('span');
            vis.className = 'illu-anim-vis';
            vis.appendChild(faIcon(layer.visible ? 'fa-eye' : 'fa-eye-slash'));
            vis.title = t('anim.toggleVis', 'Visibilité');
            vis.addEventListener('click', (ev) => {
                ev.stopPropagation();
                layer.visible = !layer.visible;
                e.render();
                e.updateLayerUI && e.updateLayerUI();
                refresh();
            });
            const nm = DOC.createElement('span');
            nm.textContent = layer.name || `Calque ${li + 1}`;
            nm.style.overflow = 'hidden';
            nm.style.textOverflow = 'ellipsis';
            lab.appendChild(vis);
            lab.appendChild(nm);
            lab.addEventListener('click', (ev) => {
                e.setActiveLayerIndex(li);
                // Clic sur le nom du calque : sélectionne toute sa ligne (Maj = étend).
                const lastFrame = Math.max(0, dur - 1);
                if (ev.shiftKey && _selAnchor) {
                    extendSelectionTo(li, lastFrame);
                } else {
                    _selAnchor = { layerIndex: li, frame: 0 };
                    setSelection({ layers: [li], from: 0, to: lastFrame });
                }
                refresh();
            });
            lab.addEventListener('contextmenu', (ev) => {
                ev.preventDefault();
                if (!isCellSelected(li, 0)) {
                    _selAnchor = { layerIndex: li, frame: 0 };
                    setSelection({ layers: [li], from: 0, to: Math.max(0, dur - 1) });
                }
                openSelectionMenu(ev.clientX, ev.clientY);
            });
            frag.appendChild(lab);
            for (let f = 0; f < dur; f++) frag.appendChild(trackCell(li, layer, f, playhead));
        }

        gridEl.innerHTML = '';
        gridEl.appendChild(frag);
    }

    function scheduleRefresh() {
        if (rafRefresh) return;
        rafRefresh = requestAnimationFrame(() => {
            rafRefresh = 0;
            refresh();
        });
    }

    /** Remonte les palettes flottantes qui débordent sur le panneau d'animation. */
    function repositionFloatingWindowsAbovePanel() {
        if (!panel || !panel.classList.contains('illu-anim-visible')) return;
        const panelRect = panel.getBoundingClientRect();
        DOC.querySelectorAll('.floating-window').forEach((w) => {
            if (w.offsetParent === null) return; // masquée
            const r = w.getBoundingClientRect();
            if (r.height === 0) return;
            const overlap = r.bottom - panelRect.top;
            if (overlap > 0) {
                const curTop = parseFloat(w.style.top);
                const base = Number.isFinite(curTop) ? curTop : r.top;
                w.style.top = Math.max(0, base - (overlap + 8)) + 'px';
            }
        });
    }

    // ---- Ouverture / fermeture de la frise ---------------------------------

    /** Replie (ou déplie) la frise sans toucher au mode animation du projet. */
    function collapsePanel(on) {
        _collapsed = !!on;
        const a = anim();
        if (_collapsed && a && a.playing) window.IlluAnim.pause(em());
        syncVisibility();
        const e = em();
        if (e && typeof e._refitZoomAfterLayout === 'function') e._refitZoomAfterLayout();
    }

    function togglePanelCollapsed() {
        collapsePanel(!_collapsed);
    }

    /** Quitte le mode animation — destructif (aplatit sur l'image courante) : on confirme. */
    function requestExitAnimationMode() {
        const e = em();
        if (!e || !e.isAnimationMode) return;
        const doExit = () => {
            if (typeof e.disableAnimationOnActiveProject === 'function') e.disableAnimationOnActiveProject();
            _collapsed = false;
            clearSelection();
            syncVisibility();
        };
        if (typeof window.showIlluConfirm === 'function') {
            window.showIlluConfirm({
                title: t('anim.exitTitle', 'Quitter le mode animation'),
                message: t(
                    'anim.exitMsg',
                    'Les calques seront aplatis sur l’image affichée et les autres images seront perdues. Continuer ?'
                ),
                confirmText: t('anim.exitConfirm', 'Quitter l’animation'),
                onConfirm: doExit
            });
        } else {
            doExit();
        }
    }

    /** Bouton de réouverture logé dans la barre d'état (visible en mode animation). */
    function ensureOpenButton() {
        if (openBtn && openBtn.isConnected) return openBtn;
        const zones = DOC.querySelector('#app-status-bar .status-bar-zones');
        if (!zones) return null;
        const cell = DOC.createElement('div');
        cell.className = 'status-bar-cell illu-anim-open-cell';
        openBtn = DOC.createElement('button');
        openBtn.type = 'button';
        openBtn.id = 'illu-anim-open-btn';
        openBtn.className = 'illu-anim-open-btn';
        openBtn.appendChild(faIcon('fa-film'));
        const openLbl = DOC.createElement('span');
        openLbl.textContent = t('anim.timeline', 'Frise');
        openBtn.appendChild(openLbl);
        openBtn.title = t('anim.togglePanel', 'Afficher / masquer la frise chronologique');
        openBtn.addEventListener('click', togglePanelCollapsed);
        cell.appendChild(openBtn);
        zones.insertBefore(cell, zones.firstChild);
        return openBtn;
    }

    function syncOpenButton() {
        const b = ensureOpenButton();
        if (!b) return;
        const on = isAnim();
        b.parentNode.style.display = on ? '' : 'none';
        b.classList.toggle('illu-anim-on', on && !_collapsed);
    }

    function syncMenuCheck() {
        const el = DOC.getElementById('menu-anim-check');
        if (el) el.style.visibility = isAnim() ? 'visible' : 'hidden';
    }

    function syncVisibility() {
        ensurePanel();
        const animOn = isAnim();
        const show = animOn && !_collapsed;
        if (!animOn) _collapsed = false;
        panel.classList.toggle('illu-anim-visible', show);
        DOC.body.classList.toggle('illu-anim-active', show);
        DOC.body.classList.toggle('illu-anim-mode', animOn);
        syncMenuCheck();
        syncOpenButton();
        if (show) {
            refresh();
            // Laisse le layout se réserver avant de repositionner les palettes flottantes.
            requestAnimationFrame(repositionFloatingWindowsAbovePanel);
        } else {
            const a = anim();
            if (a && a.playing) window.IlluAnim.pause(em());
            if (!animOn) {
                _sel = null;
                _selAnchor = null;
                syncSelectionMirror();
            }
        }
    }

    /** Bascule le mode animation (activer / désactiver) sur le projet actif. */
    window.toggleAnimationMode = function () {
        const e = em();
        if (!e || !e.activeProject) return;
        if (e.isAnimationMode) {
            if (typeof e.disableAnimationOnActiveProject === 'function') e.disableAnimationOnActiveProject();
        } else {
            if (typeof e.enableAnimationOnActiveProject === 'function') e.enableAnimationOnActiveProject();
        }
        syncVisibility();
    };

    // ---- Raccourcis clavier (gardés par mode animation + focus hors saisie) ----
    function isTypingTarget(el) {
        if (!el) return false;
        const tag = (el.tagName || '').toLowerCase();
        return tag === 'input' || tag === 'textarea' || tag === 'select' || el.isContentEditable;
    }

    function onKeydown(e) {
        if (!isAnim()) return;
        if (isTypingTarget(e.target)) return;
        const IA = window.IlluAnim;
        const E = em();
        // Copier/coller un cel : seulement quand la frise est survolée (sinon on laisse le
        // copier/coller pixel habituel de l'application).
        if ((e.ctrlKey || e.metaKey) && _panelHovered) {
            if (e.key === 'a' || e.key === 'A') {
                selectAllFrames();
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            const s = normSel();
            const multi = s && (s.layers.length > 1 || s.to > s.from);
            if (e.key === 'c' || e.key === 'C') {
                // Sélection multiple : copie de plage ; sinon copie du cel pointé.
                const ok = multi ? IA.copySelection(E, s) : IA.copyCel(E, _selCell.layerIndex, _selCell.frame);
                if (ok) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            if (e.key === 'v' || e.key === 'V') {
                if (IA.hasRangeClipboard() && multi) {
                    withAnimHistory(t('anim.histPaste', 'Coller une plage d’images'), () =>
                        IA.pasteSelection(E, s.layers[0], s.from)
                    );
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
                E.setActiveLayerIndex(_selCell.layerIndex);
                IA.seek(E, _selCell.frame);
                if (IA.pasteCel(E, _selCell.layerIndex, _selCell.frame)) {
                    e.preventDefault();
                    e.stopPropagation();
                    scheduleRefresh();
                }
                return;
            }
        }
        if (_panelHovered && (e.key === 'Delete' || e.key === 'Backspace')) {
            const s = normSel();
            if (s) {
                withAnimHistory(
                    t('anim.histDelete', 'Supprimer des cels'),
                    () => IA.removeSelectionCels(E, s),
                    { pixelSel: s }
                );
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
        if (e.key === 'Escape' && _sel) {
            clearSelection();
            e.preventDefault();
            return;
        }
        switch (e.key) {
            case ' ':
                e.preventDefault();
                IA.togglePlay(E);
                break;
            case 'ArrowLeft':
                if (e.shiftKey) IA.gotoFirst(E);
                else IA.step(E, -1);
                e.preventDefault();
                break;
            case 'ArrowRight':
                if (e.shiftKey) IA.gotoLast(E);
                else IA.step(E, 1);
                e.preventDefault();
                break;
            case 'Home':
                IA.gotoFirst(E);
                e.preventDefault();
                break;
            case 'End':
                IA.gotoLast(E);
                e.preventDefault();
                break;
            case 'k':
            case 'K':
                E.ensureEditableCelAtPlayhead(E.activeLayerIndex);
                E.render();
                scheduleRefresh();
                e.preventDefault();
                break;
            default:
                break;
        }
    }

    function init() {
        ensurePanel();
        DOC.addEventListener('illu:anim-changed', scheduleRefresh);
        DOC.addEventListener('illu:anim-mode-enter', () => {
            _collapsed = false;
            clearSelection();
            syncVisibility();
        });
        DOC.addEventListener('illu:anim-mode-leave', () => {
            clearSelection();
            syncVisibility();
        });
        // Changement d'onglet : la sélection appartient au document précédent.
        DOC.addEventListener('illu:project-applied', () => {
            clearSelection();
            syncVisibility();
        });
        window.addEventListener('keydown', onKeydown, true);
        syncSelectionMirror();
        syncVisibility();
    }

    window.IlluAnimPanel = {
        init,
        refresh,
        syncVisibility,
        /** Sélection courante de la frise (ou null) — lue par FilterManager. */
        getSelection: () => normSel(),
        setSelection: (sel) => setSelection(sel),
        clearSelection,
        selectAll: selectAllFrames,
        isCollapsed: () => _collapsed,
        setCollapsed: collapsePanel,
        toggleCollapsed: togglePanelCollapsed
    };

    if (DOC.readyState === 'loading') {
        DOC.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
