self.importScripts('photo-pipeline.js');
self.importScripts('image-adjust-core.js');
self.importScripts('../WasmManager.js');
try {
    self.importScripts('../rust/RustCore.js');
} catch (e) {
    /* moteur Rust absent : pipeline JS */
}

// Removed auto-init: settings must be passed via message

let wasmInitPromise = null;
// Moteur Rust (Camera Raw 8 bits) : chargé une fois, en tâche de fond.
let rustInitPromise = self.MasterPaintRust ? self.MasterPaintRust.init().catch(() => false) : null;

self.onmessage = async function (ev) {
    const msg = ev.data || {};
    const jobId = msg.jobId | 0;
    try {
        if (msg.type === 'init') {
             if (typeof MasterPaintWasm !== 'undefined') {
                 MasterPaintWasm.setSettings(msg.settings || {});
                 if (msg.settings && msg.settings.rustEnabled === false) self.__mpRustEnabled = false;
                 if (msg.settings && msg.settings.wasmEnabled) {
                     wasmInitPromise = MasterPaintWasm.init().catch(err => console.error("WASM Init error:", err));
                 }
             }
             return;
        }
        if (msg.type === 'cameraRaw') {
            if (wasmInitPromise) {
                await wasmInitPromise;
            }
            if (rustInitPromise) {
                await rustInitPromise;
            }
            const width = msg.width | 0;
            const height = msg.height | 0;
            let src;
            if (msg.floatBuffer) {
                src = new Float32Array(msg.floatBuffer);
            } else {
                src = new Uint8ClampedArray(msg.buffer);
            }
            // Un seul moteur CPU : le pipeline flottant de photo-pipeline.js.
            // Le module Wasm n'est plus sollicité ici — sa version du traitement
            // divergeait (sortie 8 bits, math différente du shader), ce qui
            // faisait changer l'image selon le moteur qui la calculait.
            const out = self.IlluImageAdjustCore.applyCameraRawBuffer(src, width, height, msg.params || {});


            self.postMessage(
                {
                    type: 'cameraRawResult',
                    jobId: jobId,
                    width: msg.width | 0,
                    height: msg.height | 0,
                    buffer: out.buffer
                },
                [out.buffer]
            );
            return;
        }
        if (msg.type === 'levelsPreview') {
            const src = new Uint8ClampedArray(msg.buffer);
            const channels = msg.channels || {};
            const histIn = self.IlluImageAdjustCore.buildHistogramBuffer(src, !!channels.chR, !!channels.chG, !!channels.chB);
            const out = self.IlluImageAdjustCore.applyLevelsBuffer(src, msg.width | 0, msg.height | 0, msg.params || {});
            const histOut = self.IlluImageAdjustCore.buildHistogramBuffer(out, !!channels.chR, !!channels.chG, !!channels.chB);
            self.postMessage(
                {
                    type: 'levelsPreviewResult',
                    jobId: jobId,
                    width: msg.width | 0,
                    height: msg.height | 0,
                    imageBuffer: out.buffer,
                    histInBuffer: histIn.buffer,
                    histOutBuffer: histOut.buffer
                },
                [out.buffer, histIn.buffer, histOut.buffer]
            );
            return;
        }
        if (msg.type === 'levelsCommit') {
            const src = new Uint8ClampedArray(msg.buffer);
            const out = self.IlluImageAdjustCore.applyLevelsBuffer(src, msg.width | 0, msg.height | 0, msg.params || {});
            self.postMessage(
                {
                    type: 'levelsCommitResult',
                    jobId: jobId,
                    width: msg.width | 0,
                    height: msg.height | 0,
                    buffer: out.buffer
                },
                [out.buffer]
            );
        }
    } catch (err) {
        self.postMessage({
            type: 'error',
            jobId: jobId,
            message: err && err.message ? err.message : String(err)
        });
    }
};
