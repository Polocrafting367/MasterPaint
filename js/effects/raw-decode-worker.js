/**
 * raw-decode-worker.js — Décodage libraw-wasm dans un thread séparé.
 * Reçoit: { id, buffer: ArrayBuffer }
 * Renvoie: { id, floatData: Float32Array, width, height } ou { id, error }
 */

self.onmessage = async function (evt) {
    const { id, buffer } = evt.data;

    try {
        // Import libraw dynamically inside the worker
        const { default: LibRaw } = await import('../libraw/index.js');
        const lr = new LibRaw();
        const u8 = new Uint8Array(buffer);

        await lr.open(u8, {
            outputBps: 16,
            useCameraWb: true,
            noAutoBright: true,
            gamma: [1.0, 1.0], // TRUE LINEAR output — real RAW headroom
            outputColor: 0,    // Raw camera color space
        });

        const imgDataRaw = await lr.imageData();

        if (!imgDataRaw || !imgDataRaw.data || !imgDataRaw.width || !imgDataRaw.height) {
            throw new Error('libraw returned empty imageData');
        }

        const { width, height } = imgDataRaw;
        const expectedRgbLen = width * height * 3;
        const expectedRgbaLen = width * height * 4;

        const isUint16 = (imgDataRaw.data instanceof Uint16Array);
        const isFloat  = (imgDataRaw.data instanceof Float32Array);

        // Build Float32 RGBA in linear 0..∞ space
        // For Uint16: divide by 65535 → 0..1 linear
        // For Float: pass through directly (may be 0..∞)
        const floatData = new Float32Array(expectedRgbaLen);

        if (imgDataRaw.data.length === expectedRgbLen) {
            // RGB packed → RGBA
            let s = 0, d = 0;
            for (let i = 0; i < width * height; i++) {
                const r = imgDataRaw.data[s++];
                const g = imgDataRaw.data[s++];
                const b = imgDataRaw.data[s++];
                floatData[d++] = isUint16 ? (r / 65535.0) : (isFloat ? r : r / 255.0);
                floatData[d++] = isUint16 ? (g / 65535.0) : (isFloat ? g : g / 255.0);
                floatData[d++] = isUint16 ? (b / 65535.0) : (isFloat ? b : b / 255.0);
                floatData[d++] = 1.0; // alpha always 1
            }
        } else {
            // RGBA or other layout
            for (let i = 0; i < expectedRgbaLen; i++) {
                if ((i + 1) % 4 === 0) {
                    floatData[i] = 1.0; // alpha = 1
                } else {
                    const v = imgDataRaw.data[i];
                    floatData[i] = isUint16 ? (v / 65535.0) : (isFloat ? v : v / 255.0);
                }
            }
        }

        // Also build a U8 preview (sRGB gamma-corrected) for the 8-bit thumbnail
        // Apply simple sRGB gamma to the linear data for display
        const previewU8 = new Uint8ClampedArray(expectedRgbaLen);
        for (let i = 0; i < expectedRgbaLen; i += 4) {
            const r = floatData[i], g = floatData[i + 1], b = floatData[i + 2];
            // Linear → sRGB gamma (standard formula)
            previewU8[i]     = linearToSrgbByte(r);
            previewU8[i + 1] = linearToSrgbByte(g);
            previewU8[i + 2] = linearToSrgbByte(b);
            previewU8[i + 3] = 255;
        }

        // Transfer the large buffers back to the main thread (zero-copy)
        self.postMessage(
            { id, floatData, previewU8, width, height },
            [floatData.buffer, previewU8.buffer]
        );

    } catch (err) {
        self.postMessage({ id, error: String(err) });
    }
};

/** Linear → sRGB (0..255) with proper gamma */
function linearToSrgbByte(lin) {
    if (lin <= 0) return 0;
    if (lin >= 1) return 255;
    const s = lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(lin, 1.0 / 2.4) - 0.055;
    return Math.round(s * 255);
}
