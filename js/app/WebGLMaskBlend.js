/**
 * WebGLMaskBlend.js — Mélange base / filtré selon un masque (filtre dynamique calque).
 * Expérimental : accélère le filtre dynamique lorsque WebGL est disponible.
 * Repli silencieux sur le CPU si init échoue ou si désactivé (localStorage illu_webgl_blend).
 *
 * drawBlendedCanvas() évite readPixels : le résultat reste sur le canevas WebGL et est composé
 * via drawImage (souvent plus rapide). blend() conserve readPixels pour compatibilité.
 * WebGPU n’est pas branché ici : la relecture GPU→CPU est async (mapAsync), incompatible avec
 * le rendu toile synchrone actuel sans refonte majeure.
 */
(function () {
    let gl = null;
    let canvas = null;
    let program = null;
    let buf = null;
    let texBase = null;
    let texFil = null;
    let texMask = null;
    let uBaseLoc = null;
    let uFilLoc = null;
    let uMaskLoc = null;
    let lastW = 0;
    let lastH = 0;
    let initFailed = false;

    const VS = `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
  v_uv = a_uv;
}`;

    const FS = `
precision mediump float;
uniform sampler2D u_base;
uniform sampler2D u_filtered;
uniform sampler2D u_mask;
varying vec2 v_uv;
void main() {
  vec2 uv = vec2(v_uv.x, 1.0 - v_uv.y);
  vec4 b = texture2D(u_base, uv);
  vec4 f = texture2D(u_filtered, uv);
  float m = texture2D(u_mask, uv).a;
  gl_FragColor = vec4(mix(b.rgb, f.rgb, m), b.a);
}`;

    function compileShader(type, src) {
        const s = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            gl.deleteShader(s);
            return null;
        }
        return s;
    }

    function flipRowsRgba(rgba, w, h) {
        const row = w * 4;
        const tmp = new Uint8Array(row);
        const half = (h / 2) | 0;
        for (let y = 0; y < half; y++) {
            const y2 = h - 1 - y;
            const a = y * row;
            const b = y2 * row;
            tmp.set(rgba.subarray(a, a + row));
            rgba.copyWithin(a, b, b + row);
            rgba.set(tmp, b);
        }
    }

    function ensureTextures(w, h) {
        if (!gl) return false;
        const maxSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 4096;
        if (w > maxSize || h > maxSize || w < 1 || h < 1) return false;

        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            gl.viewport(0, 0, w, h);
        }

        if (w !== lastW || h !== lastH || !texBase) {
            [texBase, texFil, texMask].forEach((t) => {
                if (t) gl.deleteTexture(t);
            });
            texBase = gl.createTexture();
            texFil = gl.createTexture();
            texMask = gl.createTexture();
            lastW = w;
            lastH = h;
            const p = (t) => {
                gl.bindTexture(gl.TEXTURE_2D, t);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
                gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
                gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
            };
            p(texBase);
            p(texFil);
            p(texMask);
            gl.bindTexture(gl.TEXTURE_2D, null);
        }
        return true;
    }

    function initGL() {
        if (gl && gl.isContextLost && gl.isContextLost()) {
            gl = null;
            program = null;
            buf = null;
            texBase = texFil = texMask = null;
            lastW = lastH = 0;
            uBaseLoc = uFilLoc = uMaskLoc = null;
        }
        if (gl) return true;
        if (initFailed) return false;
        try {
            canvas = document.createElement('canvas');
            canvas.width = canvas.height = 4;
            gl =
                canvas.getContext('webgl', {
                    alpha: true,
                    premultipliedAlpha: false,
                    preserveDrawingBuffer: true,
                    antialias: false,
                    depth: false,
                    stencil: false
                }) ||
                canvas.getContext('experimental-webgl', {
                    alpha: true,
                    premultipliedAlpha: false,
                    preserveDrawingBuffer: true
                });
            if (!gl) {
                initFailed = true;
                return false;
            }

            const vs = compileShader(gl.VERTEX_SHADER, VS);
            const fs = compileShader(gl.FRAGMENT_SHADER, FS);
            if (!vs || !fs) {
                initFailed = true;
                return false;
            }
            program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                initFailed = true;
                return false;
            }

            gl.useProgram(program);
            const aPos = gl.getAttribLocation(program, 'a_pos');
            const aUv = gl.getAttribLocation(program, 'a_uv');
            uBaseLoc = gl.getUniformLocation(program, 'u_base');
            uFilLoc = gl.getUniformLocation(program, 'u_filtered');
            uMaskLoc = gl.getUniformLocation(program, 'u_mask');

            const quad = new Float32Array([
                -1, -1, 0, 0, 1, -1, 1, 0, -1, 1, 0, 1, -1, 1, 0, 1, 1, -1, 1, 0, 1, 1, 1, 1
            ]);
            buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
            gl.enableVertexAttribArray(aPos);
            gl.enableVertexAttribArray(aUv);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
            gl.vertexAttribPointer(aUv, 2, gl.FLOAT, false, 16, 8);

            gl.disable(gl.DEPTH_TEST);
            gl.disable(gl.STENCIL_TEST);

            canvas.addEventListener(
                'webglcontextlost',
                (e) => {
                    e.preventDefault();
                    gl = null;
                    program = null;
                    buf = null;
                    texBase = texFil = texMask = null;
                    lastW = lastH = 0;
                    uBaseLoc = uFilLoc = uMaskLoc = null;
                    initFailed = false;
                },
                false
            );
        } catch (e) {
            initFailed = true;
            gl = null;
            return false;
        }
        return !!gl;
    }

    function uploadTexture(tex, w, h, data) {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, data);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

    /**
     * Upload + passage fragment shader + clear + draw.
     * @returns {boolean}
     */
    function runBlendPass(base, blurred, maskIm) {
        const w = base.width;
        const h = base.height;
        if (
            blurred.width !== w ||
            blurred.height !== h ||
            maskIm.width !== w ||
            maskIm.height !== h
        ) {
            return false;
        }
        if (!initGL()) return false;
        if (!ensureTextures(w, h)) return false;

        try {
            gl.useProgram(program);
            uploadTexture(texBase, w, h, base.data);
            uploadTexture(texFil, w, h, blurred.data);
            uploadTexture(texMask, w, h, maskIm.data);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texBase);
            gl.uniform1i(uBaseLoc, 0);
            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, texFil);
            gl.uniform1i(uFilLoc, 1);
            gl.activeTexture(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, texMask);
            gl.uniform1i(uMaskLoc, 2);

            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, w, h);
            gl.disable(gl.BLEND);
            gl.clearColor(0, 0, 0, 0);
            gl.clear(gl.COLOR_BUFFER_BIT);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            return true;
        } catch (e) {
            return false;
        }
    }

    window.IlluWebGLMaskBlend = {
        isEnabled() {
            try {
                return localStorage.getItem('illu_webgl_blend') !== '0';
            } catch (e) {
                return true;
            }
        },

        setEnabled(on) {
            try {
                localStorage.setItem('illu_webgl_blend', on ? '1' : '0');
            } catch (e) { /* ignore */ }
        },

        /** @returns {boolean} */
        isAvailable() {
            if (initFailed) return false;
            const c = document.createElement('canvas');
            const g =
                c.getContext('webgl') ||
                c.getContext('experimental-webgl');
            return !!g;
        },

        /**
         * Canevas WebGL avec le dernier passage blend (préférer ctx.drawImage pour éviter readPixels).
         * @param {ImageData} base
         * @param {ImageData} blurred
         * @param {ImageData} maskIm
         * @returns {HTMLCanvasElement|null}
         */
        drawBlendedCanvas(base, blurred, maskIm) {
            if (!this.isEnabled()) return null;
            if (!runBlendPass(base, blurred, maskIm)) return null;
            return canvas;
        },

        /**
         * @param {ImageData} base
         * @param {ImageData} blurred
         * @param {ImageData} maskIm
         * @returns {ImageData|null}
         */
        blend(base, blurred, maskIm) {
            if (!this.isEnabled()) return null;
            const w = base.width;
            const h = base.height;
            if (!runBlendPass(base, blurred, maskIm)) return null;

            try {
                const out = new Uint8Array(w * h * 4);
                gl.pixelStorei(gl.PACK_ALIGNMENT, 1);
                gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
                flipRowsRgba(out, w, h);
                return new ImageData(new Uint8ClampedArray(out), w, h);
            } catch (e) {
                return null;
            }
        }
    };
})();
