
/**
 * WasmManager.js
 * Manages the MasterPaint WebAssembly Engine.
 */
class WasmManager {
    constructor() {
        this.module = null;
        this.instance = null;
        this.memory = null;
        this.exports = null;
        this.isLoaded = false;
        
        // Memory pointers
        this.inputPtr = 0;
        this.outputPtr = 0;
        this.bufferSize = 0;
        this.hslPtr = 0;
        this.lutPtr = 0;
        /** Évite de spammer la console si applyCameraRaw échoue (repli CPU). */
        this._cameraRawWasmWarned = false;
    }

    async init(force = false) {
        if (this.isLoaded) return;
        
        // Checking if enabled before loading (unless forced)
        if (!force) {
            const enabled = this._isWasmEnabled();
            if (!enabled) {
                console.log("WasmManager: Wasm engine is disabled in settings, skipping load.");
                return;
            }
        }
        
        try {
            // Determine the correct path to the wasm file
            let wasmPath = 'build/release.wasm';
            
            if (typeof self !== 'undefined' && self.location) {
                const loc = self.location.pathname;
                // If we are in a worker deep in the folder structure
                if (loc.includes('/js/effects/')) {
                    wasmPath = '../../build/release.wasm';
                } else if (loc.includes('/js/')) {
                    wasmPath = '../build/release.wasm';
                }
            }

            // console.log(`WasmManager: Fetching from ${wasmPath}`);
            const response = await fetch(wasmPath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} while fetching ${wasmPath}`);
            }
            
            const buffer = await response.arrayBuffer();
            const view = new Uint8Array(buffer);
            if (view[0] !== 0x00 || view[1] !== 0x61 || view[2] !== 0x73 || view[3] !== 0x6D) {
                const header = String.fromCharCode(view[0], view[1], view[2], view[3]);
                throw new Error(`Invalid Wasm header detected: "${header}". The server likely returned an error page or a 404 instead of the binary.`);
            }
            const wasm = await WebAssembly.instantiate(buffer, {
                env: {
                    abort: (msg, file, line, col) => console.error(`Wasm abort: ${msg} at ${file}:${line}:${col}`)
                }
            });
            
            this.instance = wasm.instance;
            this.exports = wasm.instance.exports;
            this.memory = this.exports.memory;
            
            this.isLoaded = true;
            // console.log('MasterPaint Wasm Engine loaded successfully.');
        } catch (err) {
            console.error('Failed to load MasterPaint Wasm Engine:', err);
        }
    }

    /**
     * Ensure we have enough memory for an image of size (w * h)
     */
    _prepareBuffers(width, height, isFloat = false) {
        const inputSize = width * height * 4 * (isFloat ? 4 : 1);
        const outputSize = width * height * 4;
        const requiredSize = Math.max(inputSize, outputSize);
        
        if (this.bufferSize >= requiredSize && this.hslPtr && this.lastIsFloat === isFloat) return;
        
        // Base heap start after module static data
        this.inputPtr = 65536; 
        this.outputPtr = this.inputPtr + inputSize + 1024;
        this.hslPtr = this.outputPtr + outputSize + 1024; // 96 bytes for 24 floats
        this.lutPtr = this.hslPtr + 1024; // 1024 bytes for 4 LUTs
        
        this.bufferSize = requiredSize;
        this.lastIsFloat = isFloat;
        
        const totalRequiredMemory = this.lutPtr + 2048;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequiredMemory / 65536);
        
        if (requiredPages > currentPages) {
            this.memory.grow(requiredPages - currentPages);
        }
    }

    /**
     * @deprecated Le traitement Camera Raw passe désormais par
     * js/effects/photo-pipeline.js (CPU flottant) et par le shader camera_raw
     * (GPU), qui partagent une définition mathématique unique.
     *
     * Cette implémentation Wasm produisait une image différente des deux autres
     * — elle repassait en 8 bits dès la conversion sRGB, écrasant la dynamique
     * d'un RAW avant les outils couleur — de sorte que le rendu changeait selon
     * le moteur retenu. Elle est conservée pour référence mais n'est plus
     * appelée ; la réactiver exige d'abord de réaligner assembly/camera_raw.ts.
     */
    applyCameraRaw(imageData, params = {}, width = 0, height = 0) {
        if (!this.isLoaded) return null;

        // Respect Wasm toggle
        if (typeof localStorage !== 'undefined' && localStorage.getItem('settings-wasm-enabled') === '0') {
            return null;
        }

        const isFloat = imageData instanceof Float32Array || (imageData && imageData.constructor && imageData.constructor.name === 'Float32Array');
        const w = isFloat ? width : imageData.width;
        const h = isFloat ? height : imageData.height;
        const data = isFloat ? imageData : imageData.data;

        this._prepareBuffers(w, h, isFloat);
        
        if (isFloat) {
            const inputView = new Float32Array(this.memory.buffer, this.inputPtr, w * h * 4);
            inputView.set(data);
        } else {
            const inputView = new Uint8Array(this.memory.buffer, this.inputPtr, w * h * 4);
            inputView.set(data);
        }

        // Map HSL Mixer params (8 bands * 3 values)
        if (params.hsvMixParams) {
            const hslView = new Float32Array(this.memory.buffer, this.hslPtr, 24);
            const p = params.hsvMixParams;
            for (let i = 0; i < 8; i++) {
                hslView[i * 3]     = (p.hslHue && p.hslHue[i]) || 0;
                hslView[i * 3 + 1] = (p.hslSat && p.hslSat[i]) || 0;
                hslView[i * 3 + 2] = (p.hslLum && p.hslLum[i]) || 0;
            }
        }

        // Map Curves (LUTs)
        if (params.cbParams) {
            const lutView = new Uint8Array(this.memory.buffer, this.lutPtr, 1024);
            const cb = params.cbParams;
            const setLut = (pts, offset) => {
                if (pts && pts.lut) lutView.set(pts.lut, offset);
                else {
                    for(let j=0; j<256; j++) lutView[offset+j] = j;
                }
            };
            setLut(cb.curveMaster, 0);
            setLut(cb.curveR, 256);
            setLut(cb.curveG, 512);
            setLut(cb.curveB, 768);
        }

        const sanitize = (v) => {
            if (v === null || v === undefined || isNaN(v) || !isFinite(v)) return 0;
            return Number(v);
        };

        const startY = Math.max(0, params.startY || 0);
        const endY = Math.min(h, params.endY || h);
        if (startY >= endY) return isFloat ? new Uint8ClampedArray(w * h * 4) : imageData;

        // Safety check for pointers
        const safeHslPtr = (params.hsvMixParams && this.hslPtr) ? this.hslPtr : 0;
        const safeLutPtr = (params.cbParams && this.lutPtr) ? this.lutPtr : 0;

        try {
            if (isFloat) {
                if (typeof this.exports.__setArgumentsLength === 'function') {
                    this.exports.__setArgumentsLength(27);
                }
                this.exports.applyCameraRawFloat(
                    this.inputPtr,
                    this.outputPtr,
                    w,
                    h,
                    sanitize(params.exposure),
                    sanitize(params.contrast),
                    sanitize(params.highlights),
                    sanitize(params.shadows),
                    sanitize(params.whites),
                    sanitize(params.blacks),
                    sanitize(params.temperature !== undefined ? params.temperature : params.temp),
                    sanitize(params.tint),
                    sanitize(params.vibrance),
                    sanitize(params.saturation),
                    // Split Toning
                    sanitize(params.red), sanitize(params.redHi), sanitize(params.redSh),
                    sanitize(params.green), sanitize(params.greenHi), sanitize(params.greenSh),
                    sanitize(params.blue), sanitize(params.blueHi), sanitize(params.blueSh),
                    safeHslPtr,
                    safeLutPtr,
                    startY,
                    endY
                );
            } else {
                if (typeof this.exports.__setArgumentsLength === 'function') {
                    this.exports.__setArgumentsLength(26);
                }
                this.exports.applyCameraRaw(
                    this.inputPtr,
                    w,
                    h,
                    sanitize(params.exposure),
                    sanitize(params.contrast),
                    sanitize(params.highlights),
                    sanitize(params.shadows),
                    sanitize(params.whites),
                    sanitize(params.blacks),
                    sanitize(params.temperature !== undefined ? params.temperature : params.temp),
                    sanitize(params.tint),
                    sanitize(params.vibrance),
                    sanitize(params.saturation),
                    // Split Toning
                    sanitize(params.red), sanitize(params.redHi), sanitize(params.redSh),
                    sanitize(params.green), sanitize(params.greenHi), sanitize(params.greenSh),
                    sanitize(params.blue), sanitize(params.blueHi), sanitize(params.blueSh),
                    safeHslPtr,
                    safeLutPtr,
                    startY,
                    endY
                );
            }
        } catch (wasmErr) {
            if (!this._cameraRawWasmWarned) {
                console.warn('[Wasm Engine] applyCameraRaw indisponible, repli CPU/WebGL :', wasmErr);
                this._cameraRawWasmWarned = true;
            }
            return null;
        }
        
        if (isFloat) {
            return new Uint8ClampedArray(this.memory.buffer, this.outputPtr, w * h * 4);
        } else {
            const resultView = new Uint8ClampedArray(this.memory.buffer, this.inputPtr, w * h * 4);
            imageData.data.set(resultView);
            return imageData;
        }
    }

    applyFilter(type, imageData, params = {}) {
        if (!this.isLoaded) return null;
        if (typeof imageData === 'undefined' || !imageData) return null;

        if (typeof localStorage !== 'undefined' && localStorage.getItem('settings-wasm-enabled') === '0') {
            return null;
        }

        const { width, height } = imageData;
        this._prepareBuffers(width, height);
        
        const inputView = new Uint8Array(this.memory.buffer, this.inputPtr, width * height * 4);
        inputView.set(imageData.data);

        const startY = params.startY || 0;
        const endY = params.endY || height;
        
        let targetOutPtr = this.outputPtr;

        if (type === 'chromatic') {
            const shift = params.shift || 0;
            this.exports.chromatic(this.inputPtr, this.outputPtr, width, height, shift, startY, endY);
        } else if (type === 'wave') {
            const amp = params.amp || 10;
            const freq = params.freq || 100;
            this.exports.wave(this.inputPtr, this.outputPtr, width, height, amp, freq, startY, endY);
        } else if (type === 'twist') {
            const angle = params.angle || 0;
            this.exports.twist(this.inputPtr, this.outputPtr, width, height, angle, startY, endY);
        } else if (type === 'brightness' || type === 'contrast') {
            const brightness = params.brightness || 0;
            const contrast = params.contrast || 0;
            this.exports.adjustBCS(this.inputPtr, width, height, brightness, contrast, startY, endY);
            targetOutPtr = this.inputPtr; 
        } else if (type === 'invert') {
            this.exports.invert(this.inputPtr, width, height, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'grayscale') {
            this.exports.grayscale(this.inputPtr, width, height, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'posterize') {
            const levels = params.levels || 4;
            this.exports.posterize(this.inputPtr, width, height, levels, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'pinch') {
            const amount = params.amount || 1.5;
            this.exports.pinch(this.inputPtr, this.outputPtr, width, height, amount, startY, endY);
        } else if (type === 'vignette') {
            const amount = params.amount || 0.5;
            const colorStr = params['ef-vig-color'] || '#000000';
            const h_str = colorStr.replace('#', '').trim();
            const hn = parseInt(h_str, 16);
            let r = 0, g = 0, b = 0;
            if (!Number.isNaN(hn)) {
                r = (hn>>16)&255; g = (hn>>8)&255; b = hn&255;
            }
            const blend = parseInt(params['ef-vig-blend'] || 0, 10);
            this.exports.vignette(this.inputPtr, width, height, amount, r, g, b, blend, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'crystallize') {
            const size = params.size || 15;
            this.exports.crystallize(this.inputPtr, this.outputPtr, width, height, size, startY, endY);
        } else if (type === 'softglow') {
            const amount = params.amount || 0.5;
            this.exports.softglow(this.inputPtr, width, height, amount, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'orderedDither') {
            const size = params.size || 1;
            const invert = !!params.invert;
            this.exports.orderedDither(this.inputPtr, width, height, size, invert, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'pixelate') {
            const size = params.size || 1;
            this.exports.pixelate(this.inputPtr, this.outputPtr, width, height, size, startY, endY);
        } else if (type === 'sepia') {
            this.exports.sepia(this.inputPtr, width, height, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'exposure') {
            const exp = (params.exposure !== undefined ? params.exposure : 100) / 100;
            const gamma = (params.gamma !== undefined ? params.gamma : 100) / 100;
            this.exports.exposure(this.inputPtr, width, height, exp, gamma, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'halftone') {
            const dotSize = params.dotSize || 4;
            this.exports.halftone(this.inputPtr, width, height, dotSize, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'edges') {
            const sensitivity = params.sensitivity || 0.5;
            this.exports.edgeDetect(this.inputPtr, this.outputPtr, width, height, sensitivity, startY, endY);
        } else if (type === 'scanlines') {
            const density = params.density || 1.0;
            const opacity = params.opacity || 0.5;
            this.exports.scanlines(this.inputPtr, width, height, density, opacity, startY, endY);
            targetOutPtr = this.inputPtr;
        } else if (type === 'oilPainting') {
            const brushSize = params.brushSize || 3;
            const coarseness = params.coarseness || 50;
            this.exports.oilPainting(this.inputPtr, this.outputPtr, width, height, brushSize, coarseness, startY, endY);
        } else if (type === 'relief') {
            const angle = params.angle || 0;
            this.exports.relief(this.inputPtr, this.outputPtr, width, height, angle, startY, endY);
        } else if (type === 'frostedGlass') {
            const minRad = params.minRadius || 0;
            const maxRad = params.maxRadius || 3;
            const samples = params.samples || 2;
            this.exports.frostedGlass(this.inputPtr, this.outputPtr, width, height, minRad, maxRad, samples, startY, endY);
        } else if (type === 'redEyeRemove') {
            const tolerance = params.tolerance || 70;
            const saturation = params.saturation || 0.9;
            this.exports.redEyeRemove(this.inputPtr, this.outputPtr, width, height, tolerance, saturation, startY, endY);
        } else {
            return null;
        }
        
        const resultView = new Uint8ClampedArray(this.memory.buffer, targetOutPtr, width * height * 4);
        imageData.data.set(resultView);
        return imageData;
    }

    _isWasmEnabled() {
        if (this._settings && this._settings.wasmEnabled !== undefined) {
            return this._settings.wasmEnabled;
        }
        if (typeof localStorage !== 'undefined') {
            return localStorage.getItem('settings-wasm-enabled') !== '0';
        }
        // Environment check: if in a worker and no settings provided, default to false
        return false;
    }

    isEffectSupported(type) {
        const supported = [
            'chromatic', 'wave', 'twist', 'brightness', 'contrast', 
            'invert', 'grayscale', 'posterize', 'pinch', 
            'vignette', 'crystallize', 'softglow', 'orderedDither', 'pixelate',
            'sepia', 'exposure', 'halftone', 'edges', 'scanlines',
            'oilPainting', 'relief', 'frostedGlass', 'redEyeRemove'
        ];
        return supported.includes(type);
    }

    resize(imageData, targetWidth, targetHeight) {
        if (!this.isLoaded || !imageData || !imageData.data) return null;
        const { width, height } = imageData;
        const tw = Math.max(1, targetWidth | 0);
        const th = Math.max(1, targetHeight | 0);
        if (width < 1 || height < 1) return null;
        const srcBytes = width * height * 4;
        if (imageData.data.length < srcBytes) return null;

        this._prepareBuffers(Math.max(width, tw), Math.max(height, th));

        const inputView = new Uint8Array(this.memory.buffer, this.inputPtr, srcBytes);
        inputView.set(imageData.data.subarray(0, srcBytes));

        this.exports.resize(this.inputPtr, this.outputPtr, width, height, tw, th);

        const outBytes = tw * th * 4;
        const resultView = new Uint8ClampedArray(this.memory.buffer, this.outputPtr, outBytes);
        return new ImageData(new Uint8ClampedArray(resultView), tw, th);
    }

    blendMask(baseImageData, filteredImageData, maskImageData, startY = 0, endY = -1) {
        if (!this.isLoaded) return null;
        const { width, height } = baseImageData;
        if (endY === -1) endY = height;
        
        const size = width * height * 4;
        this._prepareBuffers(width, height);
        
        // We need 4 buffers: base, filtered, mask, output. 
        // _prepareBuffers only provides 2 main ones. Let's adjust.
        const basePtr = this.inputPtr;
        const filteredPtr = this.outputPtr;
        const maskPtr = this.outputPtr + size + 1024;
        const outPtr = maskPtr + size + 1024;
        
        const totalRequired = outPtr + size + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, basePtr, size).set(baseImageData.data);
        new Uint8Array(this.memory.buffer, filteredPtr, size).set(filteredImageData.data);
        new Uint8Array(this.memory.buffer, maskPtr, size).set(maskImageData.data);

        this.exports.blendMask(basePtr, filteredPtr, maskPtr, outPtr, width, height, startY, endY);
        
        const res = new Uint8ClampedArray(this.memory.buffer, outPtr, size);
        const out = new ImageData(width, height);
        out.data.set(res);
        return out;
    }

    buildDynamicMask(layerImageData, lx, ly, dw, dh, opacity) {
        if (!this.isLoaded) return null;
        const { width: lw, height: lh } = layerImageData;
        const lSize = lw * lh * 4;
        const dSize = dw * dh * 4;
        
        const layerPtr = 65536;
        const maskPtr = layerPtr + lSize + 1024;
        
        const totalRequired = maskPtr + dSize + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, layerPtr, lSize).set(layerImageData.data);
        
        this.exports.buildDynamicMask(layerPtr, maskPtr, lw, lh, lx, ly, dw, dh, opacity);
        
        const res = new Uint8ClampedArray(this.memory.buffer, maskPtr, dSize);
        const out = new ImageData(dw, dh);
        out.data.set(res);
        return out;
    }

    applyLuminanceMask(layerImageData, maskImageData, lx, ly, dw, dh) {
        if (!this.isLoaded) return null;
        const { width: lw, height: lh } = layerImageData;
        const { width: mw, height: mh } = maskImageData;
        const lSize = lw * lh * 4;
        const mSize = mw * mh * 4;
        const dSize = dw * dh * 4;
        
        const layerPtr = 65536;
        const maskPtr = layerPtr + lSize + 1024;
        const outPtr = maskPtr + mSize + 1024;
        
        const totalRequired = outPtr + dSize + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, layerPtr, lSize).set(layerImageData.data);
        new Uint8Array(this.memory.buffer, maskPtr, mSize).set(maskImageData.data);
        
        this.exports.applyLuminanceMask(layerPtr, maskPtr, outPtr, lw, lh, lx, ly, mw, mh, dw, dh);
        
        const res = new Uint8ClampedArray(this.memory.buffer, outPtr, dSize);
        const out = new ImageData(dw, dh);
        out.data.set(res);
        return out;
    }

    grayscaleAlpha(imageData) {
        if (!this.isLoaded) return null;
        const { width, height } = imageData;
        const size = width * height * 4;
        this._prepareBuffers(width, height);

        new Uint8Array(this.memory.buffer, this.inputPtr, size).set(imageData.data);
        this.exports.grayscaleAlpha(this.inputPtr, this.outputPtr, width, height);

        const res = new Uint8ClampedArray(this.memory.buffer, this.outputPtr, size);
        const out = new ImageData(width, height);
        out.data.set(res);
        return out;
    }

    colorMatch(imageData, r0, g0, b0, a0, rgbMax, alphaMax) {
        if (!this.isLoaded) return null;
        const { width, height } = imageData;
        const size = width * height * 4;
        const maskSize = width * height;
        
        const dataPtr = 65536;
        const maskPtr = dataPtr + size + 1024;
        
        const totalRequired = maskPtr + maskSize + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, dataPtr, size).set(imageData.data);
        
        this.exports.colorMatch(dataPtr, maskPtr, width, height, r0, g0, b0, a0, rgbMax, alphaMax);
        
        return new Uint8Array(this.memory.buffer.slice(maskPtr, maskPtr + maskSize));
    }

    similarColor(imageData, sr, sg, sb, sa, tol) {
        if (!this.isLoaded) return null;
        const { width, height } = imageData;
        const size = width * height * 4;
        const maskSize = width * height;
        
        const dataPtr = 65536;
        const maskPtr = dataPtr + size + 1024;
        
        const totalRequired = maskPtr + maskSize + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, dataPtr, size).set(imageData.data);
        
        this.exports.similarColor(dataPtr, maskPtr, width, height, sr, sg, sb, sa, tol);
        
        return new Uint8Array(this.memory.buffer.slice(maskPtr, maskPtr + maskSize));
    }

    magicWand(imageData, startX, startY, sr, sg, sb, sa, tol) {
        if (!this.isLoaded) return null;
        const { width, height } = imageData;
        const size = width * height * 4;
        const maskSize = width * height;
        
        const dataPtr = 65536;
        const maskPtr = dataPtr + size + 1024;
        
        const totalRequired = maskPtr + maskSize + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, dataPtr, size).set(imageData.data);
        
        this.exports.magicWand(dataPtr, maskPtr, width, height, startX, startY, sr, sg, sb, sa, tol);
        
        return new Uint8Array(this.memory.buffer.slice(maskPtr, maskPtr + maskSize));
    }

    getMaskOutlineSegments(maskData, w, h, startX, startY, endX, endY, stride) {
        if (!this.isLoaded) return null;
        const maskSize = maskData.length;
        const maxSegments = Math.min(200000, maskSize * 2); // Safety limit
        const segmentsSize = maxSegments * 16;
        
        const maskPtr = 65536;
        const outPtr = maskPtr + maskSize + 1024;
        
        const totalRequired = outPtr + segmentsSize + 1024;
        const currentPages = this.memory.buffer.byteLength / 65536;
        const requiredPages = Math.ceil(totalRequired / 65536);
        if (requiredPages > currentPages) this.memory.grow(requiredPages - currentPages);

        new Uint8Array(this.memory.buffer, maskPtr, maskSize).set(maskData);
        
        const count = this.exports.getMaskOutlineSegments(maskPtr, w, h, startX, startY, endX, endY, stride, outPtr, maxSegments);
        
        return new Float32Array(this.memory.buffer.slice(outPtr, outPtr + count * 16));
    }

    setSettings(s) {
        this._settings = s;
    }

    generateThumbnail(imageData, dstW, dstH) {
        if (!this.isLoaded) return null;
        const { width: srcW, height: srcH } = imageData;
        
        this._prepareBuffers(Math.max(srcW, dstW), Math.max(srcH, dstH));

        const inputView = new Uint8Array(this.memory.buffer, this.inputPtr, srcW * srcH * 4);
        inputView.set(imageData.data);

        this.exports.generateThumbnail(this.inputPtr, this.outputPtr, srcW, srcH, dstW, dstH);

        const resultView = new Uint8ClampedArray(this.memory.buffer, this.outputPtr, dstW * dstH * 4);
        return new ImageData(new Uint8ClampedArray(resultView), dstW, dstH);
    }

    /** Charge RGBA dans inputPtr (vectorisation). */
    uploadImageData(imageData) {
        if (!this.isLoaded) return false;
        const { width: w, height: h } = imageData;
        this._prepareBuffers(w, h);
        const view = new Uint8Array(this.memory.buffer, this.inputPtr, w * h * 4);
        view.set(imageData.data);
        this._lastUploadW = w;
        this._lastUploadH = h;
        return true;
    }

    _ensureScratch(minBytes) {
        if (!this.scratchBase) {
            this.scratchBase = (this.lutPtr || this.inputPtr) + 131072;
            this.scratchEnd = this.scratchBase;
            this.scratchLimit = this.scratchBase + 4194304;
        }
        if (this.scratchEnd + minBytes > this.scratchLimit) {
            this.scratchEnd = this.scratchBase;
        }
        const need = this.scratchEnd + minBytes;
        const pages = Math.ceil(need / 65536);
        const cur = this.memory.buffer.byteLength / 65536;
        if (pages > cur) this.memory.grow(pages - cur);
        return true;
    }

    _allocScratch(bytes) {
        const size = Math.max(4, bytes | 0);
        this._ensureScratch(size);
        const ptr = this.scratchEnd;
        this.scratchEnd += size + (4 - (size % 4 || 4));
        return ptr;
    }

    _freeScratch(_ptr) {
        /* bump allocator — rien à libérer */
    }

    _readI32(ptr, count) {
        return Array.from(new Int32Array(this.memory.buffer, ptr, count));
    }

    _readU8(ptr, count) {
        return Array.from(new Uint8Array(this.memory.buffer, ptr, count));
    }

    _readMask(ptr, len) {
        return new Uint8Array(this.memory.buffer.slice(ptr, ptr + len));
    }

    /**
     * Quantifie l'image chargée via uploadImageData en régions couleur.
     */
    labelColorRegions(w, h, tolerance, minAlpha, maxLabels) {
        if (!this.isLoaded || !this.exports.labelColorRegions) return null;
        const n = w * h;
        const cap = Math.min(Math.max(1, maxLabels | 0), 4096);
        if (!this.scratchBase) {
            this.scratchBase = (this.lutPtr || this.inputPtr) + 131072;
        }
        this.scratchEnd = this.scratchBase;
        const labelsPtr = this._allocScratch(n * 4);
        const queuePtr = this._allocScratch(n * 4);
        const palettePtr = this._allocScratch(cap * 4);
        const countsPtr = this._allocScratch(cap * 4);

        const numLabels = this.exports.labelColorRegions(
            this.inputPtr,
            labelsPtr,
            queuePtr,
            palettePtr,
            countsPtr,
            w,
            h,
            tolerance | 0,
            minAlpha | 0,
            cap
        );

        const labels = new Int32Array(this.memory.buffer.slice(labelsPtr, labelsPtr + n * 4));
        const palette = new Uint8Array(this.memory.buffer.slice(palettePtr, palettePtr + cap * 4));
        const counts = new Int32Array(this.memory.buffer.slice(countsPtr, countsPtr + cap * 4));

        return {
            numLabels,
            labelsPtr,
            palettePtr,
            countsPtr,
            labels,
            palette,
            counts,
            _n: n,
            _w: w,
            _h: h
        };
    }

    freeLabelBuffers(_labeled) {
        /* buffers WASM réutilisés */
    }
}

const MasterPaintWasm = new WasmManager();
if (typeof self !== 'undefined') {
    self.MasterPaintWasm = MasterPaintWasm;
}
