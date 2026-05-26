/**
 * Couche visuelle de sélection (style Paint.NET / OpenPDN SelectionRenderer).
 * Séparée du composite calques : marquee, lasso en cours, masque baguette.
 */
(function () {
    'use strict';

    const SelectionChrome = {
        _fastRectReady: false,
        _lassoDraftSvg: null,
        _lassoDraftPath: null,
        _maskOutlineSvg: null,
        _maskOutlineKey: '',
        _warpQuadSvg: null,
        _warpQuadPathSolid: null,
        _warpQuadPathDash: null,

        getOverlay() {
            return document.getElementById('selection-overlay');
        },

        invalidateFast() {
            this._fastRectReady = false;
            this._lassoDraftSvg = null;
            this._lassoDraftPath = null;
            this._maskOutlineSvg = null;
            this._maskOutlineKey = '';
            this._warpQuadSvg = null;
            this._warpQuadPathSolid = null;
            this._warpQuadPathDash = null;
            window._selectionOverlayFastReady = false;
        },

        /** Rect axis-aligné ; autorise le tracé rect en cours (w/h = 0). */
        canUseRectFast() {
            if (!window.selectionBounds) return false;
            if (window.selectionInverted) return false;
            if (window.illuCropSessionActive) return false;
            if (window.selectionKind === 'color' && window.selectionColorMask) return false;
            if (window.selectionCombineGhost) return false;
            if (window.selectionExpansionPreviewPx && window.selectionExpansionPreviewPx > 0) return false;
            if (window.selectionPixelWarpActive && window.selectionWarpQuad) return false;
            if (window.selectionKind === 'lasso' && window.selectionLassoPoints && window.selectionLassoPoints.length >= 3) {
                return false;
            }
            const kind = window.selectionKind || 'rect';
            return kind === 'rect' && Math.abs(window.selectionPreviewAngleRad || 0) < 1e-6;
        },

        /** Lasso / direct-select en cours de tracé (polyline ouverte). */
        canUseLassoDraftFast(points) {
            return !!(points && points.length >= 1 && !window.selectionCombineGhost);
        },

        ensureOverlayRoot(W, H) {
            const overlay = this.getOverlay();
            if (!overlay) return null;
            overlay.style.display = 'block';
            overlay.style.left = '0';
            overlay.style.top = '0';
            overlay.style.width = W + 'px';
            overlay.style.height = H + 'px';
            overlay.style.overflow = 'visible';
            return overlay;
        },

        hideOverlay() {
            const overlay = this.getOverlay();
            if (!overlay) return;
            overlay.style.display = 'none';
            overlay.innerHTML = '';
            this.invalidateFast();
        },

        _isVectorDocumentMode() {
            return typeof EditorManager !== 'undefined' && EditorManager.mode === 'vector';
        },

        updateRectFast(sb) {
            if (this._isVectorDocumentMode()) {
                this.hideOverlay();
                return false;
            }
            sb = sb || window.selectionBounds;
            if (!sb || typeof EditorManager === 'undefined' || !this.canUseRectFast()) {
                this.invalidateFast();
                return false;
            }
            const overlay = this.ensureOverlayRoot(EditorManager.width, EditorManager.height);
            if (!overlay) return false;

            const z = EditorManager.getCanvasZoomLevel() || 1;
            const strokeW = 1.25 / z;
            const outlineW = strokeW * 2;
            const isCrop = window.illuCropSessionActive;
            const mainCol = isCrop ? '#ff0000' : '#000000';
            const dashCol = '#ffffff';

            const x = sb.x;
            const y = sb.y;
            const w = sb.w;
            const h = sb.h;
            const d = `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;

            if (!this._fastRectReady || !this._fastRectPathSolid || !document.getElementById('selection-overlay-fast-svg')) {
                overlay.innerHTML = '';
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.id = 'selection-overlay-fast-svg';
                svg.setAttribute('width', String(EditorManager.width));
                svg.setAttribute('height', String(EditorManager.height));
                svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;';
                
                const pathSolid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathSolid.id = 'selection-overlay-fast-solid';
                pathSolid.setAttribute('fill', 'none');
                pathSolid.setAttribute('stroke', mainCol);
                pathSolid.setAttribute('stroke-width', String(outlineW));
                pathSolid.setAttribute('stroke-linejoin', 'round');
                
                const pathDash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathDash.id = 'selection-overlay-fast-dash';
                pathDash.setAttribute('fill', 'none');
                pathDash.setAttribute('stroke', dashCol);
                pathDash.setAttribute('stroke-width', String(strokeW));
                pathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
                pathDash.setAttribute('stroke-linejoin', 'round');
                
                svg.appendChild(pathSolid);
                svg.appendChild(pathDash);
                overlay.appendChild(svg);
                
                this._fastRectReady = true;
                this._fastRectPathSolid = pathSolid;
                this._fastRectPathDash = pathDash;
                window._selectionOverlayFastReady = true;
                this._lassoDraftSvg = null;
                this._lassoDraftPath = null;
            }

            this._fastRectPathSolid.setAttribute('d', d);
            this._fastRectPathSolid.setAttribute('stroke-width', String(outlineW));
            this._fastRectPathSolid.setAttribute('stroke', mainCol);
            if (this._fastRectPathDash) {
                this._fastRectPathDash.setAttribute('d', d);
                this._fastRectPathDash.setAttribute('stroke-width', String(strokeW));
                this._fastRectPathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
            }
            return true;
        },

        _pointsToPathD(points, closed) {
            if (!points || points.length < 1) return '';
            let d = `M ${points[0].x} ${points[0].y}`;
            for (let i = 1; i < points.length; i++) {
                d += ` L ${points[i].x} ${points[i].y}`;
            }
            if (closed && points.length >= 3) d += ' Z';
            return d;
        },

        /** Quad warp actif : un seul SVG, mise à jour du path `d` (évite innerHTML à chaque frame). */
        updateWarpQuadFast(quad) {
            if (this._isVectorDocumentMode()) {
                this.hideOverlay();
                return false;
            }
            if (
                !quad ||
                !window.selectionPixelWarpActive ||
                window.selectionInverted ||
                typeof EditorManager === 'undefined'
            ) {
                return false;
            }
            const overlay = this.ensureOverlayRoot(EditorManager.width, EditorManager.height);
            if (!overlay) return false;

            const z = EditorManager.getCanvasZoomLevel() || 1;
            const strokeW = 1.25 / z;
            const outlineW = strokeW * 2;
            const pts = [quad.tl, quad.tr, quad.br, quad.bl];
            const d =
                `M ${pts[0].x} ${pts[0].y}` +
                ` L ${pts[1].x} ${pts[1].y}` +
                ` L ${pts[2].x} ${pts[2].y}` +
                ` L ${pts[3].x} ${pts[3].y} Z`;

            if (!this._warpQuadSvg || !this._warpQuadPathSolid || !document.getElementById('selection-warp-quad-svg')) {
                overlay.innerHTML = '';
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.id = 'selection-warp-quad-svg';
                svg.setAttribute('width', String(EditorManager.width));
                svg.setAttribute('height', String(EditorManager.height));
                svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;';
                const pathSolid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathSolid.id = 'selection-warp-quad-solid';
                pathSolid.setAttribute('fill', 'none');
                pathSolid.setAttribute('stroke', '#000');
                pathSolid.setAttribute('stroke-width', String(outlineW));
                pathSolid.setAttribute('stroke-linejoin', 'round');
                const pathDash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathDash.id = 'selection-warp-quad-dash';
                pathDash.setAttribute('fill', 'none');
                pathDash.setAttribute('stroke', '#fff');
                pathDash.setAttribute('stroke-width', String(strokeW));
                pathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
                pathDash.setAttribute('stroke-linejoin', 'round');
                svg.appendChild(pathSolid);
                svg.appendChild(pathDash);
                overlay.appendChild(svg);
                this._warpQuadSvg = svg;
                this._warpQuadPathSolid = pathSolid;
                this._warpQuadPathDash = pathDash;
                this._fastRectReady = false;
                this._lassoDraftSvg = null;
                this._lassoDraftPath = null;
                window._selectionOverlayFastReady = false;
            }

            this._warpQuadPathSolid.setAttribute('d', d);
            this._warpQuadPathSolid.setAttribute('stroke-width', String(outlineW));
            if (this._warpQuadPathDash) {
                this._warpQuadPathDash.setAttribute('d', d);
                this._warpQuadPathDash.setAttribute('stroke-width', String(strokeW));
                this._warpQuadPathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
            }
            return true;
        },

        /** Tracé lasso à la volée : un seul SVG, mise à jour du path `d`. */
        updateLassoDraft(points) {
            if (this._isVectorDocumentMode()) {
                this.hideOverlay();
                return false;
            }
            if (!this.canUseLassoDraftFast(points)) return false;
            if (typeof EditorManager === 'undefined') return false;
            const overlay = this.ensureOverlayRoot(EditorManager.width, EditorManager.height);
            if (!overlay) return false;

            const z = EditorManager.getCanvasZoomLevel() || 1;
            const strokeW = 1.25 / z;
            const outlineW = strokeW * 2;

            if (!this._lassoDraftSvg || !this._lassoDraftPath || !document.getElementById('selection-lasso-draft-svg')) {
                overlay.innerHTML = '';
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.id = 'selection-lasso-draft-svg';
                svg.setAttribute('width', String(EditorManager.width));
                svg.setAttribute('height', String(EditorManager.height));
                svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;';
                const pathSolid = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathSolid.id = 'selection-lasso-draft-solid';
                pathSolid.setAttribute('fill', 'none');
                pathSolid.setAttribute('stroke', '#000');
                pathSolid.setAttribute('stroke-width', String(outlineW));
                pathSolid.setAttribute('stroke-linejoin', 'round');
                pathSolid.setAttribute('stroke-linecap', 'round');
                const pathDash = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                pathDash.id = 'selection-lasso-draft-dash';
                pathDash.setAttribute('fill', 'none');
                pathDash.setAttribute('stroke', '#fff');
                pathDash.setAttribute('stroke-width', String(strokeW));
                pathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
                pathDash.setAttribute('stroke-linejoin', 'round');
                pathDash.setAttribute('stroke-linecap', 'round');
                svg.appendChild(pathSolid);
                svg.appendChild(pathDash);
                overlay.appendChild(svg);
                this._lassoDraftSvg = svg;
                this._lassoDraftPath = pathSolid;
                this._lassoDraftPathDash = pathDash;
                this._fastRectReady = false;
                window._selectionOverlayFastReady = false;
            }

            const d = this._pointsToPathD(points, false);
            this._lassoDraftPath.setAttribute('d', d);
            this._lassoDraftPath.setAttribute('stroke-width', String(outlineW));
            if (this._lassoDraftPathDash) {
                this._lassoDraftPathDash.setAttribute('d', d);
                this._lassoDraftPathDash.setAttribute('stroke-width', String(strokeW));
                this._lassoDraftPathDash.setAttribute('stroke-dasharray', `${5 / z} ${4 / z}`);
            }
            return true;
        },

        /**
         * Rafraîchissement overlay sans toucher aux calques.
         * @returns {'rect'|'lasso'|'none'} chemin utilisé
         */
        tryOverlayOnly(opts) {
            opts = opts || {};
            if (opts.lassoPoints && this.updateLassoDraft(opts.lassoPoints)) return 'lasso';
            if (this.updateRectFast(window.selectionBounds)) return 'rect';
            return 'none';
        },

        /**
         * Planifie overlay + poignées sans recomposite calques (OpenPDN invalidation ciblée).
         */
        scheduleInteractive(extra) {
            const o = extra || {};
            let overlayMode = 'none';

            if (o.lassoPoints) {
                overlayMode = this.tryOverlayOnly({ lassoPoints: o.lassoPoints }) ? 'lasso' : 'none';
            } else if (!o.forceFullOverlay) {
                overlayMode = this.tryOverlayOnly();
            }

            if (
                o.loupeEvent &&
                window.illuSelectionLoupeActive &&
                typeof window.illuSelectionLoupeMove === 'function'
            ) {
                window.illuSelectionLoupeMove(o.loupeEvent, o.loupeAnchorDoc);
            }

            const needDrawUI = o.forceDrawUI === true;
            const needFullOverlay = o.forceFullOverlay === true || (overlayMode === 'none' && !needDrawUI);

            if (typeof window.illuScheduleInteractiveVisualRefresh === 'function') {
                window.illuScheduleInteractiveVisualRefresh({
                    render: needDrawUI || needFullOverlay,
                    selection: needFullOverlay,
                    renderOpts: {
                        skipLayerComposite: true,
                        skipUiThumbnails: true,
                        skipDrawUI: !needDrawUI
                    }
                });
            }
        },

        /** Overlay seul, zéro render (tracé rect/lasso en cours). */
        paintOverlayOnly(extra) {
            if (this._isVectorDocumentMode()) {
                this.hideOverlay();
                return;
            }
            const o = extra || {};
            if (o.lassoPoints) this.updateLassoDraft(o.lassoPoints);
            else this.updateRectFast(window.selectionBounds);
        }
    };

    window.SelectionChrome = SelectionChrome;

    window.invalidateSelectionOverlayFast = function () {
        SelectionChrome.invalidateFast();
    };

    window.updateSelectionOverlayFast = function (sb) {
        return SelectionChrome.updateRectFast(sb);
    };

    window.updateLassoDrawingOverlayFast = function (points) {
        return SelectionChrome.updateLassoDraft(points);
    };

    window.updateWarpSelectionOverlayFast = function (quad) {
        return SelectionChrome.updateWarpQuadFast(quad || window.selectionWarpQuad);
    };

    window.scheduleSelectionOverlayOnly = function (extra) {
        SelectionChrome.paintOverlayOnly(extra || {});
    };

    window.scheduleSelectionChromeRefresh = function (extra) {
        SelectionChrome.scheduleInteractive(extra || {});
    };
})();
