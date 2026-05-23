/**
 * Barre de progression globale (splash au boot + barre de statut 0–100 %).
 * window.IlluProgress.splash(pct, msg) | finishBoot([cb]) (splash ≥ 1 s puis cb) | status(pct, msg) | statusDone()
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

    /** Horodatage du premier `splash()` au boot (évite le scintillement si l’init est trop rapide). */
    let splashBootStartMs = null;

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
            setFill('illu-splash-fill', pct);
            if (msg !== undefined) {
                const el = document.getElementById('illu-splash-status');
                if (el) el.textContent = msg != null ? String(msg) : '';
            }
        },

        /**
         * Ferme le splash (durée minimale 1 s depuis le premier splash).
         * @param {function} [onSplashHidden] appelé une fois le splash masqué et `illu-splash-active` retiré (ex. fenêtre paramètres au 1er lancement).
         */
        finishBoot(onSplashHidden) {
            const MIN_SPLASH_MS = 1000;
            const t0 = splashBootStartMs != null ? splashBootStartMs : Date.now();
            const elapsed = Date.now() - t0;
            const delay = Math.max(0, MIN_SPLASH_MS - elapsed);

            const hideSplash = () => {
                splashBootStartMs = null;
                const sp = document.getElementById('illu-splash');
                const app = document.getElementById('app-window');
                if (sp) {
                    sp.style.display = 'none';
                    sp.setAttribute('aria-hidden', 'true');
                }
                if (app) {
                    app.classList.remove('illu-boot-hidden');
                    app.removeAttribute('aria-hidden');
                }
                document.body.classList.remove('illu-splash-active');
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        window.dispatchEvent(new Event('resize'));
                        if (window.EditorManager && typeof window.EditorManager.applyCanvasViewportOnly === 'function') {
                            window.EditorManager.applyCanvasViewportOnly();
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
            };

            if (delay > 0) {
                setTimeout(hideSplash, delay);
            } else {
                hideSplash();
            }
        },

        /**
         * Masquage immédiat (ou presque) du splash / overlay de progression.
         */
        hide() {
            // On réutilise la logique de masquage
            const sp = document.getElementById('illu-splash');
            const app = document.getElementById('app-window');
            if (sp) {
                sp.style.display = 'none';
                sp.setAttribute('aria-hidden', 'true');
            }
            if (app) {
                app.classList.remove('illu-boot-hidden');
                app.removeAttribute('aria-hidden');
            }
            document.body.classList.remove('illu-splash-active');
            splashBootStartMs = null;
            
            // On déclenche un resize car l'UI peut avoir changé
            requestAnimationFrame(() => {
                window.dispatchEvent(new Event('resize'));
            });
            
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
            // Message supprimé à la demande de l'utilisateur
        },

        statusDone() {
            this.status(-1, '');
        },

        get instantEffectBusy() {
            return instantEffectActive;
        },

        /**
         * @param {string} effectDisplayName libellé (ex. « Réduction du bruit (médian) »)
         */
        instantEffectStart(effectDisplayName) {
            instantEffectActive = true;
            document.body.classList.add('illu-instant-effect-busy-active');
            const ov = document.getElementById('illu-instant-effect-busy');
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
            if (ov) {
                ov.hidden = false;
                ov.setAttribute('aria-hidden', 'false');
            }
            setFill('illu-instant-effect-busy-fill', 6);
            this.status(6, line);
        },

        instantEffectProgress(pct, detailMsg) {
            if (!instantEffectActive) return;
            const p = Math.max(0, Math.min(100, Number(pct) || 0));
            setFill('illu-instant-effect-busy-fill', p);
            const busyMsg = document.getElementById('illu-instant-effect-busy-msg');
            if (detailMsg && busyMsg) busyMsg.textContent = detailMsg;
            const line = busyMsg && busyMsg.textContent ? busyMsg.textContent : '';
            this.status(p, line);
        },

        instantEffectDone() {
            instantEffectActive = false;
            document.body.classList.remove('illu-instant-effect-busy-active');
            const ov = document.getElementById('illu-instant-effect-busy');
            if (ov) {
                ov.hidden = true;
                ov.setAttribute('aria-hidden', 'true');
            }
            setFill('illu-instant-effect-busy-fill', 0);
            this.statusDone();
        },

        /**
         * Affiche la fenêtre « Traitement » uniquement si l’opération dépasse un court délai.
         * Usage :
         *   const busy = IlluProgress.createDelayedInstantEffect('Niveaux', 180);
         *   busy.progress(20);
         *   await workerPromise;
         *   busy.progress(100);
         *   busy.done();
         *
         * @param {string} effectDisplayName
         * @param {number} [delayMs]
         * @returns {{ progress: (pct:number)=>void, done: ()=>void, showNow: ()=>void, get visible(): boolean }}
         */
        createDelayedInstantEffect(effectDisplayName, delayMs) {
            const api = this;
            const delay = Math.max(0, Number(delayMs) || 240);
            let closed = false;
            let visible = false;
            let lastPct = 6;
            let timer = setTimeout(() => {
                timer = null;
                if (closed || visible) return;
                visible = true;
                api.instantEffectStart(effectDisplayName);
                api.instantEffectProgress(lastPct);
            }, delay);

            return {
                progress(pct) {
                    lastPct = Math.max(0, Math.min(100, Number(pct) || 0));
                    if (visible) api.instantEffectProgress(lastPct);
                },
                showNow() {
                    if (closed || visible) return;
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    visible = true;
                    api.instantEffectStart(effectDisplayName);
                    api.instantEffectProgress(lastPct);
                },
                done() {
                    if (closed) return;
                    closed = true;
                    if (timer) {
                        clearTimeout(timer);
                        timer = null;
                    }
                    if (visible) {
                        api.instantEffectDone();
                    }
                },
                get visible() {
                    return visible;
                }
            };
        }
    };
})();
