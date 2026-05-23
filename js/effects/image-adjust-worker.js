self.importScripts('image-adjust-core.js');
self.importScripts('../WasmManager.js');

// Removed auto-init: settings must be passed via message

self.onmessage = function (ev) {
    const msg = ev.data || {};
    const jobId = msg.jobId | 0;
    try {
        if (msg.type === 'init') {
             if (typeof MasterPaintWasm !== 'undefined') {
                 MasterPaintWasm.setSettings(msg.settings || {});
                 if (msg.settings && msg.settings.wasmEnabled) {
                     MasterPaintWasm.init();
                 }
             }
             return;
        }
        if (msg.type === 'cameraRaw') {
            const width = msg.width | 0;
            const height = msg.height | 0;
            const src = new Uint8ClampedArray(msg.buffer);
            let out;
            
            if (typeof MasterPaintWasm !== 'undefined' && MasterPaintWasm.isLoaded) {
                const res = MasterPaintWasm.applyCameraRaw(new ImageData(src, width, height), msg.params || {});
                out = res ? res.data : self.IlluImageAdjustCore.applyCameraRawBuffer(src, width, height, msg.params || {});
            } else {
                out = self.IlluImageAdjustCore.applyCameraRawBuffer(src, width, height, msg.params || {});
            }

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
