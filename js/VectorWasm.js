
/**
 * VectorWasm.js - Bridge for Wasm vector operations
 */
'use strict';

window.VectorWasm = (() => {
    let wasm = null;

    async function init() {
        if (wasm) return wasm;
        try {
            // Assuming WasmManager or similar loads the wasm
            if (window.WasmManager && window.WasmManager.exports) {
                wasm = window.WasmManager.exports;
                return wasm;
            }
        } catch (e) {
            console.error('VectorWasm init failed:', e);
        }
        return null;
    }

    function pointDistance(x1, y1, x2, y2) {
        if (wasm && wasm.pointDistance) return wasm.pointDistance(x1, y1, x2, y2);
        return Math.hypot(x1 - x2, y1 - y2);
    }

    function isPointOnSegment(px, py, x1, y1, x2, y2, tol) {
        if (wasm && wasm.isPointOnSegment) return wasm.isPointOnSegment(px, py, x1, y1, x2, y2, tol);
        // Fallback
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        if (len === 0) return Math.hypot(px - x1, py - y1) < tol;
        const t = ((px - x1) * dx + (py - y1) * dy) / (len * len);
        if (t < 0 || t > 1) return false;
        const qx = x1 + t * dx;
        const qy = y1 + t * dy;
        return Math.hypot(px - qx, py - qy) < tol;
    }

    return {
        init,
        pointDistance,
        isPointOnSegment
    };
})();
