self.importScripts('warp-core.js');

let currentSessionId = 0;
let sourceData = null;
let sourceWidth = 0;
let sourceHeight = 0;

self.onmessage = function (ev) {
    const msg = ev.data || {};
    if (msg.type === 'initSession') {
        currentSessionId = msg.sessionId | 0;
        sourceWidth = msg.sourceWidth | 0;
        sourceHeight = msg.sourceHeight | 0;
        sourceData = new Uint8ClampedArray(msg.sourceBuffer);
        return;
    }
    if (msg.type === 'dropSession') {
        if ((msg.sessionId | 0) === currentSessionId) {
            sourceData = null;
            sourceWidth = 0;
            sourceHeight = 0;
        }
        return;
    }
    if (msg.type !== 'renderPatch') return;
    if ((msg.sessionId | 0) !== currentSessionId || !sourceData) return;
    let result = null;
    try {
        result = self.IlluWarpCore.renderWarpPatch({
            baseData: msg.baseBuffer ? new Uint8ClampedArray(msg.baseBuffer) : null,
            sourceData: sourceData,
            sourceWidth: sourceWidth,
            sourceHeight: sourceHeight,
            srcQuad: msg.srcQuad,
            dstQuad: msg.dstQuad,
            patchWidth: msg.patchWidth,
            patchHeight: msg.patchHeight,
            patchX: msg.patchX,
            patchY: msg.patchY,
            polyLocal: msg.polyLocal,
            smooth: msg.smooth,
            stride: msg.stride | 0
        });
    } catch (err) {
        self.postMessage({
            type: 'error',
            sessionId: currentSessionId,
            jobId: msg.jobId | 0,
            message: err && err.message ? err.message : String(err)
        });
        return;
    }
    if (!result) {
        self.postMessage({
            type: 'nullResult',
            sessionId: currentSessionId,
            jobId: msg.jobId | 0,
            chunkOffset: msg.chunkOffset | 0
        });
        return;
    }
    self.postMessage(
        {
            type: 'renderPatchResult',
            sessionId: currentSessionId,
            jobId: msg.jobId | 0,
            patchX: result.x | 0,
            patchY: result.y | 0,
            patchWidth: result.width | 0,
            patchHeight: result.height | 0,
            patchBuffer: result.data.buffer,
            chunkOffset: msg.chunkOffset | 0
        },
        [result.data.buffer]
    );
};
