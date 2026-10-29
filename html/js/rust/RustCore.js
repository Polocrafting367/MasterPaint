/**
 * RustCore.js — chargeur du moteur d'effets Rust (build/masterpaint_core.wasm).
 *
 * Utilisable dans la page ET dans les workers (filter-worker.js). Expose
 * `self.MasterPaintRust` :
 *   await MasterPaintRust.init()            → charge le module (idempotent)
 *   MasterPaintRust.isLoaded                → prêt ?
 *   MasterPaintRust.supports(effect)        → l'effet existe côté Rust ?
 *   MasterPaintRust.apply(effect, rgba, w, h, params, y0, y1)
 *        → Uint8ClampedArray de taille w*h*4 (lignes [y0,y1) calculées, le reste = source)
 *          ou null si indisponible.
 *   MasterPaintRust.applyNative(effect, rgba, w, h, params)   (bureau Tauri, async)
 *
 * Le module est lié par rust/tools/wasm_objlink.py : mémoire, pile et table sont
 * fournies ici ; les imports non résolus (sinf, panics…) sont redirigés vers Math
 * ou transformés en erreur JS.
 */
(function (global) {
    'use strict';

    const STACK_SIZE = 1 << 20;

    function wasmUrl() {
        try {
            const loc = global.location;
            if (loc && loc.href) {
                const p = String(loc.pathname || '');
                // worker (js/effects/, js/tools/…) : la racine du site est tout ce qui précède /js/
                const k = p.lastIndexOf('/js/');
                if (k >= 0) return new URL(p.slice(0, k + 1) + 'build/masterpaint_core.wasm', loc.href).href;
                return new URL('build/masterpaint_core.wasm', loc.href).href;
            }
        } catch (e) { /* chemin relatif par défaut */ }
        return 'build/masterpaint_core.wasm';
    }

    function settingEnabled() {
        try {
            if (global.__mpRustEnabled === false) return false;
            if (typeof localStorage !== 'undefined') return localStorage.getItem('settings-rust-enabled') !== '0';
        } catch (e) { /* stockage indisponible */ }
        return true;
    }

    const Rust = {
        isLoaded: false,
        loading: null,
        error: null,
        exports: null,
        memory: null,
        ids: Object.create(null),
        names: [],
        lastMs: 0,

        get enabled() {
            return settingEnabled();
        },

        /** Bureau (Tauri) : le binaire natif est disponible. */
        get hasNative() {
            return !!(global.__TAURI_INTERNALS__ && typeof global.__TAURI_INTERNALS__.invoke === 'function');
        },

        init(bytes) {
            if (this.isLoaded) return Promise.resolve(true);
            if (this.loading) return this.loading;
            this.loading = (async () => {
                try {
                    let buf = bytes;
                    if (!buf) {
                        const res = await fetch(wasmUrl());
                        if (!res.ok) throw new Error('HTTP ' + res.status);
                        buf = await res.arrayBuffer();
                    }
                    const mod = await WebAssembly.compile(buf);
                    this._instantiate(mod);
                    this.isLoaded = true;
                    return true;
                } catch (e) {
                    this.error = e;
                    console.warn('[RustCore] moteur Rust indisponible, repli JS :', e);
                    return false;
                }
            })();
            return this.loading;
        },

        /** Chargement synchrone (octets déjà disponibles, module < 8 Mo). */
        initSync(bytes) {
            if (this.isLoaded) return true;
            try {
                this._instantiate(new WebAssembly.Module(bytes));
                this.isLoaded = true;
            } catch (e) {
                this.error = e;
            }
            return this.isLoaded;
        },

        _instantiate(mod) {
            const memory = new WebAssembly.Memory({ initial: 64, maximum: 65536 });
            const sp = new WebAssembly.Global({ value: 'i32', mutable: true }, 0);
            const table = new WebAssembly.Table({ initial: 64, element: 'anyfunc' });
            let ex = null;
            const env = {
                __linear_memory: memory,
                __stack_pointer: sp,
                __indirect_function_table: table,
                memory,
                sinf: Math.sin, cosf: Math.cos, tanf: Math.tan, asinf: Math.asin, acosf: Math.acos,
                atanf: Math.atan, atan2f: Math.atan2, expf: Math.exp, logf: Math.log, log2f: Math.log2,
                log10f: Math.log10, powf: Math.pow, sinhf: Math.sinh, coshf: Math.cosh, tanhf: Math.tanh,
                hypotf: Math.hypot, cbrtf: Math.cbrt, exp2f: (x) => Math.pow(2, x), expm1f: Math.expm1, log1pf: Math.log1p,
                sin: Math.sin, cos: Math.cos, tan: Math.tan, asin: Math.asin, acos: Math.acos, atan: Math.atan,
                atan2: Math.atan2, exp: Math.exp, log: Math.log, log2: Math.log2, log10: Math.log10, pow: Math.pow,
                hypot: Math.hypot, cbrt: Math.cbrt, exp2: (x) => Math.pow(2, x), sinh: Math.sinh, cosh: Math.cosh,
                tanh: Math.tanh, expm1: Math.expm1, log1p: Math.log1p,
                roundf: (x) => (x < 0 ? -Math.round(-x) : Math.round(x)),
                round: (x) => (x < 0 ? -Math.round(-x) : Math.round(x)),
                fmodf: (a, b) => a % b, fmod: (a, b) => a % b,
                fmaf: (a, b, c) => a * b + c, fma: (a, b, c) => a * b + c
            };
            for (const imp of WebAssembly.Module.imports(mod)) {
                if (imp.module !== 'env' || imp.name in env) continue;
                const n = imp.name;
                if (imp.kind !== 'function') continue;
                if (/__rust_alloc_zeroed/.test(n)) env[n] = (s, a) => ex.mp_alloc_zeroed(s, a);
                else if (/__rust_alloc/.test(n)) env[n] = (s, a) => ex.mp_alloc(s, a);
                else if (/__rust_dealloc/.test(n)) env[n] = (p, s, a) => ex.mp_dealloc(p, s, a);
                else if (/__rust_realloc/.test(n)) env[n] = (p, o, a, s) => ex.mp_realloc(p, o, a, s);
                else if (/no_alloc_shim/.test(n)) env[n] = () => {};
                else env[n] = () => { throw new Error('RustCore: panique / import non résolu ' + n); };
            }
            const inst = new WebAssembly.Instance(mod, { env });
            ex = inst.exports;
            const dataEnd = ex.__data_end ? ex.__data_end.value : 0;
            const stackTop = ((dataEnd + 15) & ~15) + STACK_SIZE;
            sp.value = stackTop;
            const need = stackTop + 65536;
            const have = memory.buffer.byteLength;
            if (need > have) memory.grow(Math.ceil((need - have) / 65536));
            ex.mp_heap_init(stackTop);
            this.exports = ex;
            this.memory = memory;
            const dec = new TextDecoder();
            const n = ex.mp_effect_count();
            for (let i = 0; i < n; i++) {
                const ptr = ex.mp_effect_name_ptr(i);
                const len = ex.mp_effect_name_len(i);
                const name = dec.decode(new Uint8Array(memory.buffer, ptr, len));
                this.ids[name] = i;
                this.names.push(name);
            }
        },

        supports(effect) {
            return this.isLoaded && this.enabled && effect in this.ids;
        },

        /**
         * @param {string} effect
         * @param {Uint8Array|Uint8ClampedArray} rgba image source complète (w*h*4)
         * @param {number[]|Float32Array} params
         * @returns {Uint8ClampedArray|null}
         */
        apply(effect, rgba, w, h, params, y0, y1) {
            if (!this.supports(effect)) return null;
            const ex = this.exports;
            w |= 0;
            h |= 0;
            y0 = Math.max(0, (y0 == null ? 0 : y0) | 0);
            y1 = Math.min(h, (y1 == null ? h : y1) | 0);
            if (y1 <= y0 || w <= 0) return null;
            const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
            const mark = ex.mp_heap_mark();
            try {
                const n = w * h * 4;
                const bandBytes = (y1 - y0) * w * 4;
                const pv = params instanceof Float32Array ? params : Float32Array.from(params || []);
                const srcPtr = ex.mp_alloc(n, 16);
                const dstPtr = ex.mp_alloc(bandBytes, 16);
                const parPtr = ex.mp_alloc(Math.max(4, pv.length * 4), 16);
                if (!srcPtr || !dstPtr || !parPtr) return null;
                new Uint8Array(this.memory.buffer, srcPtr, n).set(rgba.subarray ? rgba.subarray(0, n) : rgba);
                if (pv.length) new Float32Array(this.memory.buffer, parPtr, pv.length).set(pv);
                const ok = ex.mp_apply(this.ids[effect], srcPtr, dstPtr, w, h, y0, y1, parPtr, pv.length);
                if (!ok) return null;
                // la mémoire a pu grandir pendant l'effet : relire buffer
                const out = new Uint8ClampedArray(n);
                out.set(rgba.subarray ? rgba.subarray(0, n) : rgba);
                out.set(new Uint8Array(this.memory.buffer, dstPtr, bandBytes), y0 * w * 4);
                return out;
            } catch (e) {
                console.warn('[RustCore] échec de « ' + effect + ' », repli JS :', e);
                return null;
            } finally {
                ex.mp_heap_reset(mark);
                this.lastMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
            }
        },

        /**
         * Région d'un outil (pot de peinture, baguette magique), calculée par le moteur Rust.
         * @param {Uint8Array|Uint8ClampedArray} rgba image du calque (w*h*4)
         * @param {{x:number, y:number, contiguous:boolean, rule:'wand'|'bucket', tolerance:number,
         *          clip?:Uint8Array|null, bounds?:{x0:number,y0:number,x1:number,y1:number}}} o
         *   bounds : cadre autorisé, bornes INCLUSES ; clip : masque de sélection w*h (0 = interdit)
         *   fill : [r, g, b, a] → le moteur peint aussi la région, DANS `rgba` (modifié sur place)
         * @returns {Uint8Array|null} masque w*h (1 = dans la région), null si le moteur est absent
         */
        region(rgba, w, h, o) {
            if (!this.isLoaded || !this.enabled || !this.exports || !this.exports.mp_region) return null;
            const ex = this.exports;
            w |= 0;
            h |= 0;
            const n = w * h;
            if (n <= 0) return null;
            const b = o.bounds || { x0: 0, y0: 0, x1: w - 1, y1: h - 1 };
            const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
            const mark = ex.mp_heap_mark();
            try {
                const srcPtr = ex.mp_alloc(n * 4, 16);
                const outPtr = ex.mp_alloc(n, 16);
                const clipPtr = o.clip ? ex.mp_alloc(n, 16) : 0;
                if (!srcPtr || !outPtr || (o.clip && !clipPtr)) return null;
                new Uint8Array(this.memory.buffer, srcPtr, n * 4).set(rgba.subarray ? rgba.subarray(0, n * 4) : rgba);
                if (o.clip) new Uint8Array(this.memory.buffer, clipPtr, n).set(o.clip.subarray(0, n));
                const f = o.fill;
                const fillRgba = f ? ((f[0] & 255) | ((f[1] & 255) << 8) | ((f[2] & 255) << 16) | ((f[3] & 255) << 24)) >>> 0 : 0;
                const count = ex.mp_region(srcPtr, clipPtr, outPtr, w, h, o.x | 0, o.y | 0,
                    (o.contiguous ? 1 : 0) | (f ? 2 : 0),
                    o.rule === 'wand' ? 0 : 1, +o.tolerance || 0,
                    Math.max(0, b.x0 | 0), Math.max(0, b.y0 | 0), Math.max(0, b.x1 | 0), Math.max(0, b.y1 | 0), fillRgba);
                // image repeinte : une seule copie vers le tableau de l'appelant
                if (f && count > 0) rgba.set(new Uint8Array(this.memory.buffer, srcPtr, n * 4));
                return new Uint8Array(this.memory.buffer.slice(outPtr, outPtr + n));
            } catch (e) {
                console.warn('[RustCore] région indisponible, repli JS :', e);
                return null;
            } finally {
                ex.mp_heap_reset(mark);
                this.lastMs = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
            }
        },

        /**
         * Bureau : calcul natif multi-cœurs via la commande Tauri `apply_effect`.
         * @returns {Promise<Uint8ClampedArray|null>}
         */
        async applyNative(effect, rgba, w, h, params) {
            if (!this.hasNative || !this.enabled) return null;
            try {
                const head = new Float32Array([w, h, (params || []).length, ...(params || [])]);
                const name = new TextEncoder().encode(effect);
                // charge utile binaire : [len nom u32][nom][en-tête f32…][pixels]
                const payload = new Uint8Array(4 + name.length + head.byteLength + w * h * 4);
                new DataView(payload.buffer).setUint32(0, name.length, true);
                payload.set(name, 4);
                payload.set(new Uint8Array(head.buffer), 4 + name.length);
                payload.set(rgba.subarray ? rgba.subarray(0, w * h * 4) : rgba, 4 + name.length + head.byteLength);
                const res = await global.__TAURI_INTERNALS__.invoke('apply_effect', payload);
                if (!res) return null;
                const bytes = res instanceof ArrayBuffer ? new Uint8Array(res) : Uint8Array.from(res);
                return bytes.length === w * h * 4 ? new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.length) : null;
            } catch (e) {
                console.warn('[RustCore] natif indisponible pour « ' + effect + ' » :', e);
                return null;
            }
        }
    };

    global.MasterPaintRust = Rust;
})(typeof self !== 'undefined' ? self : typeof window !== 'undefined' ? window : globalThis);
