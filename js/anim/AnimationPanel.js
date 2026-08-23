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

    function btn(label, title, onClick, cls) {
        const b = DOC.createElement('button');
        b.type = 'button';
        b.textContent = label;
        if (title) b.title = title;
        if (cls) b.className = cls;
        b.addEventListener('click', onClick);
        return b;
    }

    function sep() {
        const s = DOC.createElement('span');
        s.className = 'illu-anim-sep';
        return s;
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

        bar.appendChild(btn('⏮', t('anim.first', 'Première image'), () => window.IlluAnim.gotoFirst(em())));
        bar.appendChild(btn('◀', t('anim.prev', 'Image précédente'), () => window.IlluAnim.step(em(), -1)));
        playBtn = btn('▶', t('anim.play', 'Lecture / Pause'), () => window.IlluAnim.togglePlay(em()));
        bar.appendChild(playBtn);
        bar.appendChild(btn('▶▶', t('anim.next', 'Image suivante'), () => window.IlluAnim.step(em(), 1)));
        bar.appendChild(btn('⏭', t('anim.last', 'Dernière image'), () => window.IlluAnim.gotoLast(em())));

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

        bar.appendChild(btn('＋', t('anim.addFrame', 'Ajouter une image'), () => window.IlluAnim.addFrame(em())));
        bar.appendChild(btn('⧉', t('anim.dupCel', 'Dupliquer le cel'), () => window.IlluAnim.duplicateCel(em())));
        bar.appendChild(btn('⤵', t('anim.insertFrame', 'Insérer une image ici'), () => window.IlluAnim.insertFrame(em())));
        bar.appendChild(btn('🗑', t('anim.delFrame', 'Supprimer l’image'), () => window.IlluAnim.removeFrame(em())));

        bar.appendChild(sep());

        onionBtn = btn('🧅', t('anim.onion', 'Pelure d’oignon'), () => {
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
        const mkNum = (label, title, get, set, min, max) => {
            const wrap = DOC.createElement('label');
            wrap.className = 'illu-anim-onion-num';
            wrap.title = title;
            wrap.textContent = label;
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
        const beforeCtl = mkNum('◀', t('anim.onionBefore', 'Images précédentes affichées'),
            () => (anim() ? anim().onionBefore : 1), (a, v) => (a.onionBefore = v), 0, 10);
        const afterCtl = mkNum('▶', t('anim.onionAfter', 'Images suivantes affichées'),
            () => (anim() ? anim().onionAfter : 1), (a, v) => (a.onionAfter = v), 0, 10);
        onionBeforeInput = beforeCtl.inp;
        onionAfterInput = afterCtl.inp;
        const opaWrap = DOC.createElement('label');
        opaWrap.className = 'illu-anim-onion-num';
        opaWrap.title = t('anim.onionOpacity', 'Opacité des fantômes');
        opaWrap.textContent = 'α';
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
        onionAllBtn = btn('👥', t('anim.onionAll', 'Pelure sur toutes les couches'), () => {
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
        bar.appendChild(btn('⇄', t('anim.reverse', 'Inverser l’animation'), () => window.IlluAnim.reverseAnimation(em())));
        pingpongBtn = btn('⇋', t('anim.pingpong', 'Lecture aller-retour (ping-pong)'), () => {
            window.IlluAnim.togglePingPong(em());
            const a = anim();
            pingpongBtn.classList.toggle('illu-anim-on', !!(a && a.pingpong));
        });
        bar.appendChild(pingpongBtn);
        drawStepBtn = btn('✎▶', t('anim.drawStep', 'Avancer d’une image après chaque tracé'), () => {
            const a = anim();
            if (!a) return;
            a.drawStep = !a.drawStep;
            drawStepBtn.classList.toggle('illu-anim-on', a.drawStep);
        });
        bar.appendChild(drawStepBtn);

        readoutEl = DOC.createElement('span');
        readoutEl.className = 'illu-anim-frame-readout';
        bar.appendChild(readoutEl);

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

        DOC.body.appendChild(panel);
        return panel;
    }

    /** Construit une cellule de règle (numéro d'image). */
    function rulerCell(frame, playhead) {
        const c = DOC.createElement('div');
        c.className = 'illu-anim-ruler-cell';
        if (frame % 5 === 0) {
            c.classList.add('illu-anim-tick');
            c.textContent = String(frame);
        }
        if (frame === playhead) c.classList.add('illu-anim-playhead-col');
        c.addEventListener('click', () => window.IlluAnim.seek(em(), frame));
        return c;
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
                IA.moveCel(em(), layerIndex, _dragCel.frame, frame);
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
            openCellMenu(e, layerIndex, layer, frame);
        });
        return c;
    }

    /** Petit menu contextuel de cellule. */
    function openCellMenu(evt, layerIndex, layer, frame) {
        closeCellMenu();
        const IA = window.IlluAnim;
        const menu = DOC.createElement('div');
        menu.id = 'illu-anim-cell-menu';
        menu.style.cssText =
            'position:fixed;z-index:12000;background:var(--anim-surface,#fff);color:var(--anim-text,#000);' +
            'border:1px solid var(--anim-border,#999);border-radius:6px;box-shadow:0 4px 16px rgba(0,0,0,.28);' +
            'padding:4px;min-width:180px;font-size:12px;';
        const add = (label, fn, disabled) => {
            const it = DOC.createElement('div');
            it.textContent = label;
            it.style.cssText =
                'padding:6px 10px;border-radius:4px;cursor:pointer;white-space:nowrap;' +
                (disabled ? 'opacity:.45;pointer-events:none;' : '');
            it.addEventListener('mouseenter', () => (it.style.background = 'rgba(43,108,255,.16)'));
            it.addEventListener('mouseleave', () => (it.style.background = ''));
            it.addEventListener('click', () => {
                closeCellMenu();
                fn();
            });
            menu.appendChild(it);
        };

        add(t('anim.menuKey', 'Créer un cel ici (image clé)'), () => {
            const e2 = em();
            e2.setActiveLayerIndex(layerIndex);
            IA.seek(e2, frame);
            e2.ensureEditableCelAtPlayhead(layerIndex);
            e2.render();
            refresh();
        });
        add(t('anim.menuDup', 'Dupliquer ce cel →'), () => IA.duplicateCel(em(), layerIndex, frame));
        add(t('anim.menuCopy', 'Copier le cel'), () => {
            IA.copyCel(em(), layerIndex, frame);
        });
        add(t('anim.menuPaste', 'Coller le cel ici'), () => IA.pasteCel(em(), layerIndex, frame), !IA.hasClipboard());
        add(t('anim.menuExtend', 'Étendre ce dessin sur… images'), () => {
            const n = parseInt(window.prompt(t('anim.extendPrompt', 'Sur combien d’images suivantes ?'), '3'), 10);
            if (Number.isFinite(n) && n > 0) IA.repeatCelOverRange(em(), layerIndex, frame, n);
        });
        add(
            t('anim.menuClear', 'Effacer ce cel'),
            () => IA.clearCel(em(), layerIndex, frame),
            !IA.hasCelAt(layer, frame) || frame === 0
        );
        add(t('anim.menuHold', 'Figer jusqu’à cette image'), () => {
            const info = IA.activeCelInfo(layer, frame);
            if (info) IA.setCelHoldUntil(em(), layerIndex, info.cel.frame, frame);
        });
        const sepDiv = DOC.createElement('div');
        sepDiv.style.cssText = 'height:1px;background:var(--anim-border,#999);margin:4px 2px;';
        menu.appendChild(sepDiv);
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
            const sep2 = DOC.createElement('div');
            sep2.style.cssText = 'height:1px;background:var(--anim-border,#999);margin:4px 2px;';
            menu.appendChild(sep2);
            [
                ['linear', t('anim.easeLinear', 'Easing : linéaire')],
                ['ease-in', t('anim.easeIn', 'Easing : accélère')],
                ['ease-out', t('anim.easeOut', 'Easing : ralentit')],
                ['ease-in-out', t('anim.easeInOut', 'Easing : accélère puis ralentit')],
                ['hold', t('anim.easeHold', 'Easing : maintien (paliers)')]
            ].forEach(([val, label]) => add(label, () => IA.setEasingAtFrame(em(), layerIndex, frame, val)));
        }

        DOC.body.appendChild(menu);
        const mw = menu.offsetWidth;
        const mh = menu.offsetHeight;
        let x = evt.clientX;
        let y = evt.clientY;
        if (x + mw > innerWidth) x = innerWidth - mw - 6;
        if (y + mh > innerHeight) y = innerHeight - mh - 6;
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        setTimeout(() => DOC.addEventListener('pointerdown', closeCellMenu, { once: true }), 0);
    }

    function closeCellMenu() {
        const m = DOC.getElementById('illu-anim-cell-menu');
        if (m) m.remove();
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
            playBtn.textContent = a.playing ? '⏸' : '▶';
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
        syncOnionOptsVisibility();
        if (readoutEl) readoutEl.textContent = `${playhead + 1} / ${dur} · ${a.fps || 12} ips`;

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
            vis.textContent = layer.visible ? '👁' : '﹣';
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
            lab.addEventListener('click', () => {
                e.setActiveLayerIndex(li);
                refresh();
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

    function syncMenuCheck() {
        const el = DOC.getElementById('menu-anim-check');
        if (el) el.style.visibility = isAnim() ? 'visible' : 'hidden';
    }

    function syncVisibility() {
        ensurePanel();
        const show = isAnim();
        panel.classList.toggle('illu-anim-visible', show);
        DOC.body.classList.toggle('illu-anim-active', show);
        syncMenuCheck();
        if (show) {
            refresh();
            // Laisse le layout se réserver (padding app-window) avant de repositionner.
            requestAnimationFrame(repositionFloatingWindowsAbovePanel);
        } else {
            const a = anim();
            if (a && a.playing) window.IlluAnim.pause(em());
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
            if (e.key === 'c' || e.key === 'C') {
                if (IA.copyCel(E, _selCell.layerIndex, _selCell.frame)) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                return;
            }
            if (e.key === 'v' || e.key === 'V') {
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
        DOC.addEventListener('illu:anim-mode-enter', syncVisibility);
        DOC.addEventListener('illu:anim-mode-leave', syncVisibility);
        DOC.addEventListener('illu:project-applied', syncVisibility);
        window.addEventListener('keydown', onKeydown, true);
        syncVisibility();
    }

    window.IlluAnimPanel = { init, refresh, syncVisibility };

    if (DOC.readyState === 'loading') {
        DOC.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
