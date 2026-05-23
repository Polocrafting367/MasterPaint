/**
 * illu-mobile.js — Disposition « Téléphone » (menu ☰, colonnes) via Paramètres.
 * 2 doigts sur la zone toile : pincement = zoom, déplacement du centre = pan (comme clic molette).
 */
(function () {
    'use strict';

    let pinchState = null;

    window.illuCloseMobileDrawer = function illuCloseMobileDrawer() {
        const dr = document.getElementById('illu-mobile-drawer');
        const btn = document.getElementById('illu-mobile-drawer-open');
        if (dr) {
            dr.classList.remove('illu-mobile-drawer--open');
            dr.setAttribute('aria-hidden', 'true');
        }
        if (btn) btn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('illu-mobile-drawer-open');
    }

    function illuRebuildMobileDrawerMenus() {
        const host = document.getElementById('illu-mobile-drawer-menus');
        if (!host) return;
        host.innerHTML = '';
        const root = document.querySelector('menu.illu-menubar-root');
        if (!root) return;

        /**
         * Crée récursivement l'arborescence du menu mobile.
         */
        function buildRecursiveMenu(ul, parentContainer) {
            if (!ul) return;
            ul.querySelectorAll(':scope > li[role="menuitem"]').forEach((li) => {
                // Respect hidden items (for Photo Mode switching)
                if (li.style.display === 'none' || li.hidden) {
                    return;
                }

                if (li.classList.contains('divider')) {
                    const div = document.createElement('div');
                    div.className = 'illu-mobile-drawer__divider';
                    parentContainer.appendChild(div);
                    return;
                }

                const spanEl = li.querySelector(':scope > span:not(.menu-icon)');
                const label = (spanEl && spanEl.textContent ? spanEl.textContent : li.textContent || '').trim();
                const sub = li.querySelector(':scope > ul[role="menu"]');

                if (sub) {
                    // Sous-menu : Accordéon (details / summary)
                    const det = document.createElement('details');
                    det.className = 'illu-mobile-drawer__details';
                    const sum = document.createElement('summary');
                    sum.className = 'illu-mobile-drawer__summary';
                    sum.textContent = label;
                    det.appendChild(sum);
                    
                    const subList = document.createElement('div');
                    subList.className = 'illu-mobile-drawer__sub-list';
                    buildRecursiveMenu(sub, subList);
                    det.appendChild(subList);
                    
                    parentContainer.appendChild(det);
                } else {
                    // Item final : Bouton simple
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'illu-mobile-drawer__menu-btn';
                    
                    // Récupérer l'icône si dispo
                    const icon = li.querySelector('.menu-icon i');
                    if (icon) {
                        const iconClone = icon.cloneNode(true);
                        iconClone.style.marginRight = '8px';
                        btn.appendChild(iconClone);
                    }
                    
                    const txt = document.createElement('span');
                    txt.textContent = label;
                    btn.appendChild(txt);
                    
                    // Appliquer les styles de désactivation
                    if (li.style.pointerEvents === 'none') {
                        btn.style.pointerEvents = 'none';
                    }
                    if (li.style.opacity) {
                        btn.style.opacity = li.style.opacity;
                    }
                    if (li.classList.contains('disabled')) {
                        btn.classList.add('disabled');
                    }
                    
                    btn.addEventListener('click', () => {
                        // Simuler le clic sur l'item original
                        li.click();
                        // Fermer le tiroir après une microtask (pour laisser le temps au menu de s'exécuter)
                        queueMicrotask(() => illuCloseMobileDrawer());
                    });
                    
                    parentContainer.appendChild(btn);
                }
            });
        }

        buildRecursiveMenu(root, host);

        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(host);
        }
    }

    window.illuOpenMobileDrawer = function illuOpenMobileDrawer() {
        if (!document.body.classList.contains('illu-mobile-ui')) return;
        const dr = document.getElementById('illu-mobile-drawer');
        const btn = document.getElementById('illu-mobile-drawer-open');
        const panel = document.getElementById('illu-mobile-drawer-panel');
        if (!dr || !panel) return;
        illuRebuildMobileDrawerMenus();
        if (typeof window.illuMobileRebuildDrawerTabs === 'function') {
            window.illuMobileRebuildDrawerTabs();
        }
        if (window.IlluI18n && typeof window.IlluI18n.apply === 'function') {
            window.IlluI18n.apply(dr);
        }
        dr.classList.add('illu-mobile-drawer--open');
        dr.setAttribute('aria-hidden', 'false');
        if (btn) btn.setAttribute('aria-expanded', 'true');
        document.body.classList.add('illu-mobile-drawer-open');
        try {
            panel.focus();
        } catch (e) {
            /* ignore */
        }
    }

    function illuInitMobileDrawer() {
        const drRoot = document.getElementById('illu-mobile-drawer');
        if (!drRoot || drRoot.dataset.illuDrawerInit === '1') return;
        drRoot.dataset.illuDrawerInit = '1';
        const openBtn = document.getElementById('illu-mobile-drawer-open');
        const closeBtn = document.getElementById('illu-mobile-drawer-close');
        const backdrop = document.getElementById('illu-mobile-drawer-backdrop');
        if (openBtn) {
            openBtn.addEventListener('click', (e) => {
                e.preventDefault();
                illuOpenMobileDrawer();
            });
        }
        if (closeBtn) closeBtn.addEventListener('click', () => illuCloseMobileDrawer());
        if (backdrop) backdrop.addEventListener('click', () => illuCloseMobileDrawer());
        
        // Gestion des tuiles du haut (Actions Fichier) – Elles ont des onclick inline maintenant,
        // mais on garde la délégation pour d'éventuelles extensions futures.
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const dr = document.getElementById('illu-mobile-drawer');
            if (dr && dr.classList.contains('illu-mobile-drawer--open')) {
                e.preventDefault();
                illuCloseMobileDrawer();
            }
        });
        window.addEventListener('illu-i18n-applied', (e) => {
            // Éviter la boucle infinie : si l'événement provient d'un apply() scanné (ex: rebuild du drawer), 
            // on ne redéclenche pas le rebuild global du drawer.
            if (e.detail && e.detail.scoped) return;

            const dr = document.getElementById('illu-mobile-drawer');
            if (dr && dr.classList.contains('illu-mobile-drawer--open')) {
                illuRebuildMobileDrawerMenus();
            }
        });
    }

    window.getIlluMobileUiMode = function () {
        return window.isIlluMobileUiActive() ? 'on' : 'off';
    };

    window.isIlluMobileUiActive = function () {
        return (
            typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'phone'
        );
    };

    window.applyIlluMobileUiClass = function () {
        const on = window.isIlluMobileUiActive();
        document.body.classList.toggle('illu-mobile-ui', on);
        if (!on) {
            if (typeof window.teardownIlluMobileShell === 'function') window.teardownIlluMobileShell();
            if (typeof window.illuCloseMobileDrawer === 'function') window.illuCloseMobileDrawer();
        } else if (typeof window.initIlluMobileShell === 'function') {
            window.initIlluMobileShell();
        }
        try {
            window.dispatchEvent(new CustomEvent('illu-mobile-ui-changed', { detail: { active: on } }));
        } catch (e) {
            /* ignore */
        }
        if (typeof window.syncIlluMenubarZoomControls === 'function') {
            window.syncIlluMenubarZoomControls();
        }
        if (typeof window.refreshChromeDocTitle === 'function') {
            window.refreshChromeDocTitle();
        }
    };

    /** Dimensions document suggérées pour petit écran (nouveau projet). */
    window.illuSuggestedNewDocSize = function () {
        const ws = document.getElementById('workspace');
        if (!ws) return { w: 1280, h: 720 };
        const r = ws.getBoundingClientRect();
        const dpr = Math.min(2, typeof window.devicePixelRatio === 'number' ? window.devicePixelRatio : 1);
        let w = Math.round(Math.min(1920, Math.max(320, r.width * dpr * 0.92)));
        let h = Math.round(Math.min(1920, Math.max(240, r.height * dpr * 0.78)));
        w -= w % 2;
        h -= h % 2;
        return { w, h };
    };

    window.illuApplySuggestedNewProjectDimensions = function () {
        if (!window.isIlluMobileUiActive()) return;
        const { w, h } = window.illuSuggestedNewDocSize();
        const iw = document.getElementById('p-width');
        const ih = document.getElementById('p-height');
        if (iw) iw.value = String(w);
        if (ih) ih.value = String(h);
    };

    function wrapNewProjectDialog() {
        const orig = window.showNewProjectDialog;
        if (typeof orig !== 'function' || orig._illuMobileWrapped) return;
        /* Dimensions : illuPrepareNewProjectDialogInputs (sélection puis illuApplySuggestedNewProjectDimensions si mobile). */
        function wrapped() {
            orig();
        }
        wrapped._illuMobileWrapped = true;
        window.showNewProjectDialog = wrapped;
    }

    /** À appeler après EditorManager.init() si ce script est chargé avant l’init. */
    window.illuMobileUiInstallHooks = function () {
        wrapNewProjectDialog();
        illuInitPinchZoom();
        illuInitMobileDrawer();
    };

    function touchDistance(a, b) {
        return Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
    }

    function touchCentroid(t0, t1) {
        return {
            cx: (t0.clientX + t1.clientX) / 2,
            cy: (t0.clientY + t1.clientY) / 2
        };
    }

    function illuInitPinchZoom() {
        const ws = document.getElementById('workspace');
        if (!ws || ws.dataset.illuPinchInit === '1') return;
        ws.dataset.illuPinchInit = '1';

        ws.addEventListener(
            'touchstart',
            (e) => {
                if (e.touches.length === 2) {
                    if (typeof e.preventDefault === 'function') e.preventDefault();
                    if (typeof window.illuCancelStrokeForGesture === 'function') {
                        window.illuCancelStrokeForGesture();
                    }
                    const t0 = e.touches[0];
                    const t1 = e.touches[1];
                    const em = window.EditorManager;
                    const p = em && em.activeProject;
                    if (!p) {
                        pinchState = null;
                        return;
                    }
                    const { cx, cy } = touchCentroid(t0, t1);
                    pinchState = {
                        d0: Math.max(1e-3, touchDistance(t0, t1)),
                        z0: p.zoomLevel != null ? p.zoomLevel : 1,
                        panX0: p.canvasPanX != null ? p.canvasPanX : 0,
                        panY0: p.canvasPanY != null ? p.canvasPanY : 0,
                        cx0: cx,
                        cy0: cy
                    };
                    window._illuPinchGestureActive = true;
                }
            },
            { passive: false, capture: true }
        );

        ws.addEventListener(
            'touchmove',
            (e) => {
                if (!pinchState || e.touches.length < 2) return;
                if (typeof e.preventDefault === 'function') e.preventDefault();
                const em = window.EditorManager;
                const p = em && em.activeProject;
                if (!p) return;
                const t0 = e.touches[0];
                const t1 = e.touches[1];
                const d = touchDistance(t0, t1);
                const scale = d / pinchState.d0;
                let nz = pinchState.z0 * scale;
                const maxZ =
                    typeof window.illuMaxZoomLevelForProject === 'function'
                        ? window.illuMaxZoomLevelForProject(p)
                        : 10;
                const minZ =
                    typeof window.illuMinZoomLevelForProject === 'function'
                        ? window.illuMinZoomLevelForProject()
                        : 0.05;
                nz = Math.max(minZ, Math.min(maxZ, nz));
                p.zoomLevel = nz;
                const { cx, cy } = touchCentroid(t0, t1);
                p.canvasPanX = pinchState.panX0 + (cx - pinchState.cx0);
                p.canvasPanY = pinchState.panY0 + (cy - pinchState.cy0);
                if (typeof em.applyCanvasViewportOnly === 'function') em.applyCanvasViewportOnly();
                if (typeof window.syncIlluMenubarZoomControls === 'function') {
                    window.syncIlluMenubarZoomControls();
                }
            },
            { passive: false, capture: true }
        );

        function endPinch() {
            pinchState = null;
            window._illuPinchGestureActive = false;
        }
        ws.addEventListener('touchend', endPinch, { capture: true });
        ws.addEventListener('touchcancel', endPinch, { capture: true });
    }

    function illuInitMobileShell() {
        window.applyIlluMobileUiClass();
        window.illuMobileUiInstallHooks();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', illuInitMobileShell);
    } else {
        illuInitMobileShell();
    }
    queueMicrotask(() => window.illuMobileUiInstallHooks && window.illuMobileUiInstallHooks());
})();
