/**
 * WebGLFilterEngine.js — Moteur GPU pour l'accélération des filtres d'image.
 */
window.WebGLFilterEngine = {
    gl: null,
    canvas: null,
    program: null,
    texture: null,
    buffer: null,
    outBuffer: null,
    lastShader: null,
    maxTextureSize: 4096,

    init() {
        if (this.gl) return true;
        try {
            this.canvas = document.createElement('canvas');
            this.gl = this.canvas.getContext('webgl', {
                alpha: true,
                premultipliedAlpha: false,
                preserveDrawingBuffer: true,
                antialias: false,
                depth: false,
                stencil: false
            });
            if (!this.gl) return false;
            this.maxTextureSize = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE) || 4096;
            return true;
        } catch (e) {
            return false;
        }
    },

    createShader(type, src) {
        const s = this.gl.createShader(type);
        this.gl.shaderSource(s, src);
        this.gl.compileShader(s);
        if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', this.gl.getShaderInfoLog(s));
            this.gl.deleteShader(s);
            return null;
        }
        return s;
    },

    createProgram(shaderName) {
        if (this.lastShader === shaderName && this.program) return this.program;

        const fsSrc = window.FilterShaders.header + window.FilterShaders[shaderName];
        const vs = this.createShader(this.gl.VERTEX_SHADER, window.FilterShaders.VS);
        const fs = this.createShader(this.gl.FRAGMENT_SHADER, fsSrc);

        if (!vs || !fs) return null;

        const prog = this.gl.createProgram();
        this.gl.attachShader(prog, vs);
        this.gl.attachShader(prog, fs);
        this.gl.linkProgram(prog);
        this.gl.deleteShader(vs);
        this.gl.deleteShader(fs);

        if (!this.gl.getProgramParameter(prog, this.gl.LINK_STATUS)) {
            console.error('Program link error:', this.gl.getProgramInfoLog(prog));
            this.gl.deleteProgram(prog);
            return null;
        }

        this.program = prog;
        this.lastShader = shaderName;
        return prog;
    },

    setupTexture(imageData) {
        const { width: w, height: h } = imageData;
        if (w > this.maxTextureSize || h > this.maxTextureSize) return null;

        if (this.canvas.width !== w || this.canvas.height !== h) {
            this.canvas.width = w;
            this.canvas.height = h;
            this.gl.viewport(0, 0, w, h);
            // Re-allocate outBuffer if size changed
            this.outBuffer = new Uint8Array(w * h * 4);
        }

        if (!this.texture) {
            this.texture = this.gl.createTexture();
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
            this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        } else {
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        }

        this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, 1);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, w, h, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, imageData.data);
        return this.texture;
    },

    applyFilter(imageData, shaderName, uniforms = {}) {
        if (!this.init()) return null;
        const prog = this.createProgram(shaderName);
        if (!prog) return null;

        if (!this.setupTexture(imageData)) return null;

        this.gl.useProgram(prog);

        // Setup Attributes (Quad)
        const aPos = this.gl.getAttribLocation(prog, 'a_pos');
        const aUv = this.gl.getAttribLocation(prog, 'a_uv');
        
        // GPU-side orientation: WebGL bottom-left is (-1,-1) and UV (0,0).
        // By default, texImage2D puts our Top-Left pixel at UV (0,0).
        // If we draw Bottom-Left (-1,-1) with UV (0,0), the image is upside down.
        // But readPixels reads from bottom-up, so it will read UV(0,0) first,
        // which is exactly what we want for top-to-bottom ImageData!
        const quad = new Float32Array([
            -1, -1, 0, 0,
             1, -1, 1, 0,
            -1,  1, 0, 1,
            -1,  1, 0, 1,
             1, -1, 1, 0,
             1,  1, 1, 1
        ]);
        
        if (!this.buffer) {
            this.buffer = this.gl.createBuffer();
        }
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);
        
        this.gl.enableVertexAttribArray(aPos);
        this.gl.enableVertexAttribArray(aUv);
        this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, 16, 0);
        this.gl.vertexAttribPointer(aUv, 2, this.gl.FLOAT, false, 16, 8);

        // Setup Uniforms
        const uTex = this.gl.getUniformLocation(prog, 'u_tex');
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(uTex, 0);

        for (const [name, val] of Object.entries(uniforms)) {
            const loc = this.gl.getUniformLocation(prog, name);
            if (loc === null) continue;
            if (Array.isArray(val)) {
                if (val.length === 2) this.gl.uniform2f(loc, val[0], val[1]);
                else if (val.length === 3) this.gl.uniform3f(loc, val[0], val[1], val[2]);
            } else {
                this.gl.uniform1f(loc, val);
            }
        }

        // Draw
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        // Read Result (Directly Top-Down thanks to flipped quad)
        if (!this.outBuffer || this.outBuffer.length !== imageData.width * imageData.height * 4) {
            this.outBuffer = new Uint8Array(imageData.width * imageData.height * 4);
        }
        this.gl.pixelStorei(this.gl.PACK_ALIGNMENT, 1);
        this.gl.readPixels(0, 0, imageData.width, imageData.height, this.gl.RGBA, this.gl.UNSIGNED_BYTE, this.outBuffer);

        return new ImageData(new Uint8ClampedArray(this.outBuffer), imageData.width, imageData.height);
    },

    renderToInternalCanvas(imageData, shaderName, uniforms = {}) {
        if (!this.init()) return null;
        const prog = this.createProgram(shaderName);
        if (!prog) return null;
        if (!this.setupTexture(imageData)) return null;

        this.gl.useProgram(prog);
        const aPos = this.gl.getAttribLocation(prog, 'a_pos');
        const aUv = this.gl.getAttribLocation(prog, 'a_uv');
        const quad = new Float32Array([
            -1,  1, 0, 0, // Top Left (flipped for drawImage compatibility)
             1,  1, 1, 0,
            -1, -1, 0, 1,
            -1, -1, 0, 1,
             1,  1, 1, 0,
             1, -1, 1, 1
        ]);
        if (!this.buffer) this.buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, quad, this.gl.STATIC_DRAW);
        this.gl.enableVertexAttribArray(aPos);
        this.gl.enableVertexAttribArray(aUv);
        this.gl.vertexAttribPointer(aPos, 2, this.gl.FLOAT, false, 16, 0);
        this.gl.vertexAttribPointer(aUv, 2, this.gl.FLOAT, false, 16, 8);

        const uTex = this.gl.getUniformLocation(prog, 'u_tex');
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.uniform1i(uTex, 0);

        for (const [name, val] of Object.entries(uniforms)) {
            const loc = this.gl.getUniformLocation(prog, name);
            if (loc === null) continue;
            if (Array.isArray(val)) {
                if (val.length === 2) this.gl.uniform2f(loc, val[0], val[1]);
                else if (val.length === 3) this.gl.uniform3f(loc, val[0], val[1], val[2]);
            } else this.gl.uniform1f(loc, val);
        }

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.clearColor(0, 0, 0, 0);
        this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);

        return this.canvas;
    }

};
