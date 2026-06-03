/**
 * Barre de progression globale (splash au boot + barre de statut 0–100 %).
 * window.IlluProgress.splash(pct, msg) | finishBoot([cb]) (splash ≥ durée min puis fondu) | status(pct, msg) | statusDone()
 * Effets instantanés (sans modale) : instantEffectStart(name) | instantEffectProgress(pct) | instantEffectDone()
 */
(function () {
    'use strict';

    function setFill(id, pct) {
        const el = document.getElementById(id);
        if (el) el.style.width = Math.max(0, Math.min(100, Number(pct) || 0)) + '%';
    }

    const busyTokens = new Map();
    let busyTokenSeq = 0;

    function emitBusyChange() {
        window.dispatchEvent(
            new CustomEvent('illu:busy-change', {
                detail: {
                    count: busyTokens.size,
                    tags: [...new Set(Array.from(busyTokens.values()).map((entry) => entry.tag))]
                }
            })
        );
    }

    /** Effets applyEffect() sans fenêtre (esquisse, médiane, etc.) : petite fenêtre « Traitement » avant/après le calcul ; validation OK des modales idem. */
    let instantEffectActive = false;
    let instantEffectDepth = 0;
    
    // Nouveau système de tâches (Multi-Tâches)
    const activeTasks = new Map();
    let nextTaskId = 1;

    function _syncTasksUI() {
        const ov = document.getElementById('illu-instant-effect-busy');
        const defaultTask = document.getElementById('illu-task-default');
        const globalActions = document.getElementById('illu-instant-effect-global-actions');
        
        if (activeTasks.size === 0 && instantEffectDepth <= 0) {
            if (ov) {
                ov.hidden = true;
                ov.setAttribute('aria-hidden', 'true');
            }
            document.body.classList.remove('illu-instant-effect-busy-active');
            if (globalActions) globalActions.style.display = 'none';
        } else {
            if (ov) {
                ov.hidden = false;
                ov.setAttribute('aria-hidden', 'false');
            }
            document.body.classList.add('illu-instant-effect-busy-active');
            
            if (defaultTask) {
                defaultTask.style.display = (instantEffectDepth > 0) ? 'flex' : 'none';
            }
            if (globalActions) {
                globalActions.style.display = (activeTasks.size + (instantEffectDepth > 0 ? 1 : 0)) > 1 ? 'block' : 'none';
            }
        }
    }

    let instantEffectWatchdog = null;
    let instantEffectStallTimer = null;
    let instantEffectLastProgressMs = 0;

    function clearInstantEffectTimers() {
        if (instantEffectWatchdog) {
            clearTimeout(instantEffectWatchdog);
            instantEffectWatchdog = null;
        }
        if (instantEffectStallTimer) {
            clearTimeout(instantEffectStallTimer);
            instantEffectStallTimer = null;
        }
    }

    function armInstantEffectTimers(api) {
        clearInstantEffectTimers();
        instantEffectLastProgressMs = Date.now();
        instantEffectWatchdog = setTimeout(() => {
            instantEffectWatchdog = null;
            if (instantEffectDepth > 0) {
                console.warn('IlluProgress: fermeture auto (durée maximale dépassée)');
                api.forceDismissInstantEffect();
            }
        }, 300000); // 5 min max pour les décodages RAW longs
        instantEffectStallTimer = setTimeout(function tickStall() {
            if (instantEffectDepth <= 0) return;
            if (Date.now() - instantEffectLastProgressMs > 30000) {
                console.warn('IlluProgress: fermeture auto (progression bloquée)');
                api.forceDismissInstantEffect();
                return;
            }
            instantEffectStallTimer = setTimeout(tickStall, 5000);
        }, 30000); // 30s stall threshold (RAW decode can take time)
    }

    /** Horodatage du premier `splash()` au boot (évite le scintillement si l’init est trop rapide). */
    let splashBootStartMs = null;

    const MIN_SPLASH_MS = 1650;
    const SPLASH_FADE_MS = 480;

    function illuSplashFadeDurationMs() {
        try {
            if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                return 120;
            }
        } catch (e) {
            /* ignore */
        }
        return SPLASH_FADE_MS;
    }

    function illuFinalizeSplashHidden(onSplashHidden) {
        splashBootStartMs = null;
        const sp = document.getElementById('illu-splash');
        const app = document.getElementById('app-window');
        if (sp) {
            sp.getAnimations().forEach((a) => a.cancel());
            sp.classList.remove('illu-splash--hiding');
            sp.classList.add('illu-splash--gone');
            sp.setAttribute('aria-hidden', 'true');
            sp.setAttribute('aria-busy', 'false');
            sp.style.removeProperty('opacity');
            sp.style.display = 'none';
        }
        if (app) {
            app.getAnimations().forEach((a) => a.cancel());
            app.classList.remove('illu-boot-hidden');
            app.removeAttribute('aria-hidden');
            app.style.removeProperty('opacity');
            app.style.removeProperty('visibility');
            app.style.removeProperty('pointer-events');
        }
        document.body.classList.remove('illu-splash-active', 'illu-splash-fading');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
                if (window.EditorManager && typeof EditorManager.applyCanvasViewportOnly === 'function') {
                    EditorManager.applyCanvasViewportOnly();
                }
                if (typeof window.illuClampAllFloatingPalettes === 'function') {
                    window.illuClampAllFloatingPalettes();
                }
            });
        });
        if (typeof onSplashHidden === 'function') {
            queueMicrotask(() => {
                try {
                    onSplashHidden();
                } catch (e) {
                    /* ignore */
                }
            });
        }
    }

    /**
     * Fondu splash 1→0 + fondu entrant de l’app (évite le « cut »).
     * Ne pas retirer body.illu-splash-active avant la fin : le fond bureau reste stable.
     */
    function illuRunSplashFadeOut(onDone) {
        const sp = document.getElementById('illu-splash');
        const app = document.getElementById('app-window');
        if (!sp) {
            onDone();
            return;
        }

        const fadeMs = illuSplashFadeDurationMs();

        sp.setAttribute('aria-busy', 'false');
        sp.classList.remove('illu-splash--gone', 'illu-splash--hiding');
        sp.style.removeProperty('display');
        sp.getAnimations().forEach((a) => a.cancel());
        sp.style.opacity = '1';

        if (app) {
            app.getAnimations().forEach((a) => a.cancel());
            app.classList.remove('illu-boot-hidden');
            app.removeAttribute('aria-hidden');
            app.style.visibility = 'visible';
            app.style.opacity = '0';
            app.style.pointerEvents = 'none';
        }

        let finished = false;
        const finish = () => {
            if (finished) return;
            finished = true;
            sp.getAnimations().forEach((a) => a.cancel());
            if (app) app.getAnimations().forEach((a) => a.cancel());
            sp.classList.add('illu-splash--hiding');
            sp.style.opacity = '0';
            if (app) {
                app.style.opacity = '1';
                app.style.removeProperty('pointer-events');
            }
            onDone();
        };

        void sp.offsetWidth;
        if (app) void app.offsetWidth;

        const animOpts = { duration: fadeMs, easing: 'ease-out', fill: 'forwards' };
        const runners = [];
        if (typeof sp.animate === 'function') {
            runners.push(sp.animate([{ opacity: 1 }, { opacity: 0 }], animOpts).finished);
        }
        if (app && typeof app.animate === 'function') {
            runners.push(app.animate([{ opacity: 0 }, { opacity: 1 }], animOpts).finished);
        }

        if (runners.length) {
            Promise.all(runners.map((p) => p.catch(() => {}))).then(finish);
        } else {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    sp.classList.add('illu-splash--hiding');
                    const onEnd = (e) => {
                        if (e.target !== sp || e.propertyName !== 'opacity') return;
                        finish();
                    };
                    sp.addEventListener('transitionend', onEnd, { once: true });
                });
            });
        }

        window.setTimeout(finish, fadeMs + 150);
    }

    /** Affiche la zone statut + barre une fois la couleur d’accent appliquée (évite le scintillement). */
    window.illuRevealSplashProgress = function () {
        const ov = document.querySelector('.illu-splash__overlay-bottom--boot');
        if (ov) ov.classList.add('illu-splash__overlay-bottom--ready');
    };

    /** Animation d’entrée du sous-titre (version) quand le texte est prêt. */
    window.illuRevealSplashSub = function () {
        const sub = document.getElementById('illu-splash-sub');
        if (sub) sub.classList.add('illu-splash__sub--ready');
    };

    window.IlluBusyState = window.IlluBusyState || {
        begin(tag, meta) {
            const token = {
                id: ++busyTokenSeq,
                tag: tag || 'global',
                meta: meta || null
            };
            busyTokens.set(token.id, token);
            emitBusyChange();
            return token;
        },
        end(token) {
            if (!token || !busyTokens.has(token.id)) return;
            busyTokens.delete(token.id);
            emitBusyChange();
        },
        isBusy(tag) {
            if (!tag) return busyTokens.size > 0;
            for (const entry of busyTokens.values()) {
                if (entry.tag === tag) return true;
            }
            return false;
        },
        snapshot() {
            return Array.from(busyTokens.values());
        }
    };

    window.IlluProgress = {
        /**
         * @param {number} pct 0–100
         * @param {string} [msg] texte bas gauche (splash)
         */
        splash(pct, msg) {
            if (splashBootStartMs === null) splashBootStartMs = Date.now();
            if (typeof window.illuRevealSplashProgress === 'function') {
                window.illuRevealSplashProgress();
            }
            setFill('illu-splash-fill', pct);
            if (msg !== undefined) {
                const el = document.getElementById('illu-splash-status');
                if (el) el.textContent = msg != null ? String(msg) : '';
            }
        },

        /**
         * Ferme le splash (durée minimale depuis le premier splash, puis fondu).
         * @param {function} [onSplashHidden] appelé une fois le splash masqué et `illu-splash-active` retiré (ex. fenêtre paramètres au 1er lancement).
         */
        finishBoot(onSplashHidden) {
            const t0 = splashBootStartMs != null ? splashBootStartMs : Date.now();
            const elapsed = Date.now() - t0;
            const delay = Math.max(0, MIN_SPLASH_MS - elapsed);

            const startFadeOut = () => {
                illuRunSplashFadeOut(() => illuFinalizeSplashHidden(onSplashHidden));
            };

            if (delay > 0) {
                setTimeout(startFadeOut, delay);
            } else {
                startFadeOut();
            }
        },

        /**
         * Masquage immédiat (ou presque) du splash / overlay de progression.
         */
        hide() {
            const sp = document.getElementById('illu-splash');
            if (sp) {
                sp.classList.remove('illu-splash--hiding');
                sp.classList.add('illu-splash--gone');
            }
            illuFinalizeSplashHidden(null);
            this.statusDone();
        },

        /**
         * Barre de statut : pct null ou &lt; 0 pour masquer.
         * @param {number|null} pct 0–100
         * @param {string} [msg]
         */
        status(pct, msg) {
            const row = document.getElementById('illu-status-progress-row');
            if (!row) return;
            if (pct == null || pct < 0) {
                row.hidden = true;
                row.setAttribute('aria-hidden', 'true');
                setFill('illu-status-progress-fill', 0);
                row.setAttribute('aria-valuenow', '0');
                const msgEl = document.getElementById('illu-status-progress-msg');
                if (msgEl) {
                    msgEl.textContent = '';
                    msgEl.hidden = true;
                }
                return;
            }
            row.hidden = false;
            row.setAttribute('aria-hidden', 'false');
            setFill('illu-status-progress-fill', pct);
            const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
            row.setAttribute('aria-valuenow', String(n));
        },

        statusDone() {
            this.status(-1, '');
        },

        get instantEffectBusy() {
            return instantEffectActive;
        },

        registerTask(title, options = {}) {
            const taskId = nextTaskId++;
            const tId = 'illu-task-' + taskId;
            
            const container = document.getElementById('illu-instant-effect-tasks');
            if (container) {
                const row = document.createElement('div');
                row.id = tId;
                row.style.display = 'flex';
                row.style.flexDirection = 'column';
                row.style.gap = '4px';
                
                const header = document.createElement('div');
                header.style.display = 'flex';
                header.style.justifyContent = 'space-between';
                header.style.alignItems = 'center';
                
                const titleEl = document.createElement('p');
                titleEl.className = 'illu-instant-effect-busy__line';
                titleEl.style.margin = '0';
                titleEl.style.fontSize = '12px';
                titleEl.textContent = title || 'Traitement…';
                
                header.appendChild(titleEl);

                if (options.onCancel) {
                    const cancelBtn = document.createElement('button');
                    cancelBtn.type = 'button';
                    cancelBtn.innerHTML = '✕';
                    cancelBtn.style.padding = '2px 6px';
                    cancelBtn.style.fontSize = '10px';
                    cancelBtn.style.background = '#444';
                    cancelBtn.style.color = '#fff';
                    cancelBtn.style.border = '1px solid #555';
                    cancelBtn.style.borderRadius = '3px';
                    cancelBtn.style.cursor = 'pointer';
                    cancelBtn.title = 'Annuler';
                    cancelBtn.onclick = () => {
                        if (options.onCancel) options.onCancel();
                        this.finishTask(taskId);
                    };
                    header.appendChild(cancelBtn);
                }

                row.appendChild(header);

                const track = document.createElement('div');
                track.className = 'illu-mp-progress-indicator illu-mp-progress-indicator--segmented illu-status-progress-track illu-instant-effect-busy__track';
                
                const fill = document.createElement('span');
                fill.className = 'illu-mp-progress-indicator__bar illu-status-progress-fill';
                fill.id = tId + '-fill';
                fill.style.width = '0%';
                
                track.appendChild(fill);
                row.appendChild(track);

                container.appendChild(row);
            }

            const task = {
                id: taskId,
                onCancel: options.onCancel,
                progress: (pct, msg) => {
                    const fill = document.getElementById(tId + '-fill');
                    if (fill && pct != null) fill.style.width = Math.max(0, Math.min(100, Number(pct) || 0)) + '%';
                    if (msg) {
                        const row = document.getElementById(tId);
                        if (row) {
                            const titleEl = row.querySelector('.illu-instant-effect-busy__line');
                            if (titleEl) titleEl.textContent = msg;
                        }
                    }
                    this.status(pct != null ? pct : -1, msg || '');
                },
                done: () => {
                    this.finishTask(taskId);
                }
            };
            activeTasks.set(taskId, task);
            _syncTasksUI();
            
            return task;
        },

        finishTask(taskId) {
            const task = activeTasks.get(taskId);
            if (!task) return;
            activeTasks.delete(taskId);
            
            const row = document.getElementById('illu-task-' + taskId);
            if (row) row.remove();
            
            _syncTasksUI();
            if (activeTasks.size === 0 && instantEffectDepth === 0) {
                this.statusDone();
            }
        },

        cancelAllTasks() {
            for (const [taskId, task] of activeTasks.entries()) {
                if (task.onCancel) {
                    try { task.onCancel(); } catch (e) { console.warn(e); }
                }
                this.finishTask(taskId);
            }
            this.forceDismissInstantEffect();
        },

        /**
         * @param {string} effectDisplayName libellé (ex. « Réduction du bruit (médian) »)
         */
        instantEffectStart(effectDisplayName) {
            instantEffectDepth++;
            if (instantEffectDepth > 1) return;
            instantEffectActive = true;
            _syncTasksUI();
            const titleEl = document.getElementById('illu-instant-effect-busy-title');
            const msgEl = document.getElementById('illu-instant-effect-busy-msg');
            const name = effectDisplayName != null ? String(effectDisplayName) : '';
            let line = '';
            if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
                line = window.IlluI18n.t('effect.instantBusyMsg', { name: name });
            } else {
                line = name ? `Effet « ${name} » en cours…` : 'Traitement en cours…';
            }
            if (titleEl) {
                titleEl.textContent =
                    window.IlluI18n && typeof window.IlluI18n.t === 'function'
                        ? window.IlluI18n.t('effect.instantBusyTitle')
                        : 'Traitement';
            }
            if (msgEl) msgEl.textContent = line;
            // DOM setup if needed
            setFill('illu-instant-effect-busy-fill', 6);
            this.status(6, line);
            armInstantEffectTimers(this);
        },

        instantEffectProgress(pct, detailMsg) {
            if (!instantEffectActive && instantEffectDepth <= 0 && activeTasks.size === 0) return;
            instantEffectLastProgressMs = Date.now();
            const hasPct = pct != null && pct !== '';
            const p = hasPct ? Math.max(0, Math.min(100, Number(pct) || 0)) : null;
            
            let updatedTask = false;
            // Si on a des tâches dynamiques et PAS de fenêtre modale legacy active, on redirige vers les tâches.
            if (activeTasks.size > 0 && instantEffectDepth <= 0) {
                for (const task of activeTasks.values()) {
                    if (task.progress) {
                        // Avoid infinite loop if task.progress calls this again? No, task.progress is an internal object method we defined.
                        // Wait! task.progress calls `this.status` but not `instantEffectProgress`. So it's safe.
                        
                        const tId = 'illu-task-' + task.id;
                        const fill = document.getElementById(tId + '-fill');
                        if (fill && p != null) fill.style.width = p + '%';
                        if (detailMsg) {
                            const row = document.getElementById(tId);
                            if (row) {
                                const titleEl = row.querySelector('.illu-instant-effect-busy__line');
                                if (titleEl) titleEl.textContent = detailMsg;
                            }
                        }
                        updatedTask = true;
                    }
                }
            }

            if (!updatedTask) {
                if (p != null) setFill('illu-instant-effect-busy-fill', p);
                const busyMsg = document.getElementById('illu-instant-effect-busy-msg');
                if (detailMsg && busyMsg) busyMsg.textContent = detailMsg;
            }
            
            const line = detailMsg || (document.getElementById('illu-instant-effect-busy-msg') ? document.getElementById('illu-instant-effect-busy-msg').textContent : '');
            this.status(p != null ? p : -1, line);
        },

        instantEffectDone() {
            if (instantEffectDepth > 0) instantEffectDepth--;
            if (instantEffectDepth > 0) return;
            instantEffectDepth = 0;
            clearInstantEffectTimers();
            const ov = document.getElementById('illu-instant-effect-busy');
            const ae = document.activeElement;
            if (ov && ae && ae !== document.body && ov.contains(ae)) {
                try {
                    ae.blur();
                } catch (e) {
                    /* ignore */
                }
            }
            instantEffectActive = false;
            _syncTasksUI();
            setFill('illu-instant-effect-busy-fill', 0);
            this.statusDone();
        },

        /** Réinitialise l’UI si un worker a planté sans appeler done(). */
        resetInstantEffect() {
            instantEffectDepth = 0;
            clearInstantEffectTimers();
            instantEffectActive = false;
            activeTasks.clear();
            const container = document.getElementById('illu-instant-effect-tasks');
            if (container) {
                // Supprimer toutes les tâches dynamiques (laissant seulement illu-task-default)
                Array.from(container.children).forEach(c => {
                    if (c.id !== 'illu-task-default') c.remove();
                });
            }
            _syncTasksUI();
            setFill('illu-instant-effect-busy-fill', 0);
            this.statusDone();
        },

        /** Fermeture forcée : masque l’overlay et libère les verrous (déformation, déplacement, etc.). */
        forceDismissInstantEffect() {
            if (typeof window.illuForceReleaseStuckEditorState === 'function') {
                window.illuForceReleaseStuckEditorState();
            }
            this.resetInstantEffect();
        },

        /**
         * Exécute une opération lourde avec fenêtre « Traitement » différée ; fermeture garantie (finally).
         * @param {string} effectDisplayName
         * @param {() => void|Promise<void>} fn reçoit { progress(pct, msg?) }
         * @param {{ delayMs?: number }} [opts]
         */
        async runAsyncEffect(effectDisplayName, fn, opts) {
            opts = opts || {};
            const busy = this.createDelayedInstantEffect(effectDisplayName, opts);
            try {
                if (typeof fn === 'function') {
                    await fn({
                        progress: (pct, msg) => {
                            if (busy && typeof busy.progress === 'function') {
                                busy.progress(pct);
                            } else if (pct != null) {
                                this.instantEffectProgress(pct, msg);
                            }
                        }
                    });
                }
            } finally {
                if (busy && typeof busy.done === 'function') {
                    busy.done();
                } else {
                    this.instantEffectDone();
                }
            }
        },

        /**
         * Affiche la fenêtre « Traitement » uniquement si l’opération dépasse un court délai.
         */
        createDelayedInstantEffect(effectDisplayName, opts) {
            const api = this;
            if (typeof opts === 'number') opts = { delayMs: opts };
            opts = opts || {};
            const delay = Math.max(0, Number(opts.delayMs) || 240);
            let closed = false;
            let visible = false;
            let lastPct = 6;
            let timer = null;
            let watchdog = null;
            let task = null;

            const armWatchdog = () => {
                if (watchdog) clearTimeout(watchdog);
                watchdog = setTimeout(() => {
                    watchdog = null;
                    if (!closed && visible) {
                        console.warn('IlluProgress: fermeture auto (traitement prolongé)');
                        api.forceDismissInstantEffect();
                    }
                }, 300000); // 5 minutes max
            };

            timer = setTimeout(() => {
                timer = null;
                if (closed || visible) return;
                visible = true;
                if (opts.onCancel || opts.useTask) {
                    task = api.registerTask(effectDisplayName, opts);
                    task.progress(lastPct);
                } else {
                    api.instantEffectStart(effectDisplayName);
                    api.instantEffectProgress(lastPct);
                }
                armWatchdog();
            }, delay);

            return {
                progress(pct) {
                    lastPct = Math.max(0, Math.min(100, Number(pct) || 0));
                    if (visible) {
                        if (task) task.progress(lastPct);
                        else api.instantEffectProgress(lastPct);
                        armWatchdog(); // Reset watchdog timer on progress
                    }
                },
                showNow() {
                    if (closed || visible) return;
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    visible = true;
                    if (opts.onCancel || opts.useTask) {
                        task = api.registerTask(effectDisplayName, opts);
                        task.progress(lastPct);
                    } else {
                        api.instantEffectStart(effectDisplayName);
                        api.instantEffectProgress(lastPct);
                    }
                    armWatchdog();
                },
                done() {
                    if (closed) return;
                    closed = true;
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    if (watchdog) {
                        clearTimeout(watchdog);
                        watchdog = null;
                    }
                    if (visible) {
                        if (task) task.done();
                        else api.instantEffectDone();
                    }
                },
                get visible() {
                    return visible;
                }
            };
        }
    };
})();
