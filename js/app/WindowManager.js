/**
 * WindowManager.js
 * Fenêtres .floating-window : déplacement par délégation (évite les doubles bindings au changement de layout).
 */

const WindowManager = {
    _delegationBound: false,

    init() {
        if (this._delegationBound) return;
        this._delegationBound = true;

        document.addEventListener(
            'mousedown',
            (e) => {
                const win = e.target.closest('.floating-window');
                if (!win) return;
                if (e.button !== 0) return;
                this.bringToFront(win);
                /* Panneau recadrage : ancré dans .illu-crop-panel-host — le drag briserait left/top (pas fixed). */
                if (win.classList.contains('illu-crop-panel')) return;
                const tb = e.target.closest('.title-bar');
                if (!tb || !win.contains(tb)) return;
                if (e.target.closest('button')) return;
                if (win.closest && win.closest('.illu-pdn-slot')) return;
                this.dragStart(e, win);
            },
            true
        );
    },

    dragStart(e, win) {
        const rect = win.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        const useViewport = window.getComputedStyle(win).position === 'fixed';
        
        // --- Fix Teleportation Bug ---
        // We calculate the current relative position and apply it IMMEDIATELY
        // so that clearing anchors below doesn't cause a jump.
        
        // Important: set inset to auto FIRST, because it's a shorthand that overwrites top/left.
        win.style.inset = 'auto';
        win.style.bottom = 'auto';
        win.style.right = 'auto';
        if (win.id === 'win-history') {
            win.style.width = '200px';
            win.style.minWidth = '200px';
            win.style.maxWidth = '200px';
        }

        if (useViewport) {
            win.style.left = rect.left + 'px';
            win.style.top = rect.top + 'px';
        } else {
            const parent = win.offsetParent;
            let parentRect = { left: 0, top: 0 };
            let scrollX = 0;
            let scrollY = 0;
            if (parent) {
                parentRect = parent.getBoundingClientRect();
                scrollX = parent.scrollLeft || 0;
                scrollY = parent.scrollTop || 0;
            }
            win.style.left = (rect.left - parentRect.left + scrollX) + 'px';
            win.style.top = (rect.top - parentRect.top + scrollY) + 'px';
        }

        win.classList.add('dragging');

        const dragMove = (moveEv) => {
            let newX;
            let newY;
            if (useViewport) {
                newX = moveEv.clientX - offsetX;
                newY = moveEv.clientY - offsetY;
            } else {
                const parent = win.offsetParent;
                let parentRect = { left: 0, top: 0 };
                let scrollX = 0;
                let scrollY = 0;

                if (parent) {
                    parentRect = parent.getBoundingClientRect();
                    scrollX = parent.scrollLeft || 0;
                    scrollY = parent.scrollTop || 0;
                }

                newX = moveEv.clientX - parentRect.left - offsetX + scrollX;
                newY = moveEv.clientY - parentRect.top - offsetY + scrollY;
            }

            win.style.left = newX + 'px';
            win.style.top = newY + 'px';
            win.style.bottom = 'auto';
            win.style.right = 'auto';
            if (win.id === 'win-history') {
                win.style.width = '200px';
                win.style.minWidth = '200px';
                win.style.maxWidth = '200px';
            }

            const pad = 2;
            const paletteIds = ['win-tools', 'win-colors', 'win-layers', 'win-history'];
            const floatingUi =
                typeof window.getUILayoutMode === 'function' && window.getUILayoutMode() === 'floating';
            const useWorkspaceClamp =
                (floatingUi && paletteIds.includes(win.id)) || win.id === 'effect-dialog-window';

            const clampToViewport = () => {
                const br = win.getBoundingClientRect();
                let dvx = 0;
                let dvy = 0;
                if (br.left < pad) dvx = pad - br.left;
                if (br.top < pad) dvy = pad - br.top;
                if (dvx !== 0 || dvy !== 0) {
                    const curL = parseFloat(win.style.left) || 0;
                    const curT = parseFloat(win.style.top) || 0;
                    win.style.left = curL + dvx + 'px';
                    win.style.top = curT + dvy + 'px';
                }
                const br2 = win.getBoundingClientRect();
                let dvx2 = 0;
                let dvy2 = 0;
                if (br2.right > window.innerWidth - pad) dvx2 = window.innerWidth - pad - br2.right;
                if (br2.bottom > window.innerHeight - pad) dvy2 = window.innerHeight - pad - br2.bottom;
                if (dvx2 !== 0 || dvy2 !== 0) {
                    const curL = parseFloat(win.style.left) || 0;
                    const curT = parseFloat(win.style.top) || 0;
                    win.style.left = curL + dvx2 + 'px';
                    win.style.top = curT + dvy2 + 'px';
                }
            };

            const clampToWorkspace = () => {
                if (typeof window.clampIlluFloatingWindowToWorkspace !== 'function') return;
                window.clampIlluFloatingWindowToWorkspace(win, pad);
            };

            if (useWorkspaceClamp) {
                clampToWorkspace();
                clampToWorkspace();
            } else {
                clampToViewport();
                clampToViewport();
            }
        };

        const dragEnd = () => {
            document.removeEventListener('mousemove', dragMove);
            document.removeEventListener('mouseup', dragEnd);
            win.classList.remove('dragging');

            // -- Smart Anchoring Logic --
            const rect = win.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;

            // Important: clear layout-manager or manual insets
            win.style.inset = 'auto';

            // Anchor Y:
            if (rect.top + rect.height / 2 > vh / 2) {
                // Closer to bottom
                win.style.bottom = (vh - rect.bottom) + 'px';
                win.style.top = 'auto';
            } else {
                // Closer to top
                win.style.top = rect.top + 'px';
                win.style.bottom = 'auto';
            }

            // Anchor X:
            if (rect.left + rect.width / 2 > vw / 2) {
                // Closer to right
                win.style.right = (vw - rect.right) + 'px';
                win.style.left = 'auto';
            } else {
                // Closer to left
                win.style.left = rect.left + 'px';
                win.style.right = 'auto';
            }

            if (win.id === 'win-history') {
                win.style.width = '200px';
                win.style.minWidth = '200px';
                win.style.maxWidth = '200px';
            }
            if (typeof window.saveIlluWindowPositionAfterDrag === 'function') {
                window.saveIlluWindowPositionAfterDrag(win);
            }
        };

        document.addEventListener('mousemove', dragMove);
        document.addEventListener('mouseup', dragEnd);
        this.bringToFront(win);
    },

    bringToFront(win) {
        const windows = document.querySelectorAll('.floating-window');
        let maxZ = 500;
        windows.forEach((w) => {
            const z = parseInt(window.getComputedStyle(w).zIndex, 10);
            if (!Number.isNaN(z) && z > maxZ) maxZ = z;
        });

        if (parseInt(window.getComputedStyle(win).zIndex, 10) < maxZ || maxZ === 500) {
            win.style.zIndex = String(maxZ + 1);
        }
    }
};

WindowManager.init();
window.WindowManager = WindowManager;
