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
            // Fusion des canaux saturés : évite la dominante magenta sur les
            // zones brûlées (voir CameraRawPanel.js).
            highlight: 2,
            gamma: [1.0, 1.0], // Sortie vraiment linéaire — conserve la marge du RAW
            // sRGB, et non l'espace natif du capteur : la matrice couleur du
            // boîtier doit être appliquée AVANT le traitement, sinon la balance
            // des blancs, la saturation et le TSL opèrent sur des primaires
            // inconnues et les couleurs sortent fausses.
            outputColor: 1,
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

        // Vignette 8 bits pour la pellicule. Le blanc de scène est mesuré, puis
        // comprimé par le même Reinhard étendu que le pipeline (photo-pipeline.js) :
        // sans lui, tout ce qui dépasse 1.0 en linéaire ressortirait écrêté à blanc.
        const sceneWhite = measureSceneWhite(floatData);
        const previewU8 = new Uint8ClampedArray(expectedRgbaLen);
        for (let i = 0; i < expectedRgbaLen; i += 4) {
            previewU8[i]     = linearToSrgbByte(toneMap(floatData[i], sceneWhite));
            previewU8[i + 1] = linearToSrgbByte(toneMap(floatData[i + 1], sceneWhite));
            previewU8[i + 2] = linearToSrgbByte(toneMap(floatData[i + 2], sceneWhite));
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

/**
 * Reinhard étendu calé sur W : f(W) = 1 exactement, et f = identité quand W = 1.
 * Doit rester identique à toneMapScalar de js/effects/photo-pipeline.js.
 */
function toneMap(x, W) {
    if (W <= 1.0000001 || x <= 0) return x;
    return x * (1 + x / (W * W)) / (1 + x);
}

/** Blanc de la scène : percentile haut, pour qu'un spéculaire isolé ne pèse pas. */
function measureSceneWhite(floatData) {
    const len = floatData.length;
    const step = Math.max(4, (((len / 4) / 200000) | 0) * 4);
    const samples = [];
    let hi = 0;
    for (let o = 0; o < len; o += step) {
        const m = Math.max(floatData[o], Math.max(floatData[o + 1], floatData[o + 2]));
        if (m > hi) hi = m;
        samples.push(m);
    }
    if (!samples.length) return 1;
    samples.sort((a, b) => a - b);
    const p999 = samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.999))];
    return Math.max(0.05, Math.min(hi, p999));
}

/** Linear → sRGB (0..255) with proper gamma */
function linearToSrgbByte(lin) {
    if (lin <= 0) return 0;
    if (lin >= 1) return 255;
    const s = lin <= 0.0031308 ? 12.92 * lin : 1.055 * Math.pow(lin, 1.0 / 2.4) - 0.055;
    return Math.round(s * 255);
}
