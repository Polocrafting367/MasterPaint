/**
 * AnimationExport — rendu image par image de la frise puis encodage :
 *   - GIF animé  : gifenc (window.gifenc) — quantization palette + LZW.
 *   - MP4 (H.264): WebCodecs VideoEncoder + mp4-muxer (window.Mp4Muxer).
 *   - WebM (VP9) : WebCodecs VideoEncoder + webm-muxer (window.WebMMuxer).
 *   - Repli      : MediaRecorder + canvas.captureStream (WebM) si WebCodecs absent.
 *
 * Chaque frame est composée par EditorManager.flattenPixelProjectToCanvas après avoir
 * repointé les buffers/tween au temps voulu (IlluAnim.resolveForRender), donc l'export
 * reflète cels, maintien et interpolation.
 */
(function () {
    'use strict';

    function yieldToMain(ms) {
        return new Promise((r) => setTimeout(r, ms || 0));
    }

    function progress(pct, msg) {
        if (window.IlluProgress && typeof window.IlluProgress.status === 'function') {
            window.IlluProgress.status(Math.round(pct * 100), msg);
        }
    }
    function progressDone() {
        if (window.IlluProgress && typeof window.IlluProgress.statusDone === 'function') {
            window.IlluProgress.statusDone();
        }
    }

    // --- Constructeur ZIP minimal (méthode « stored », sans dépendance) --------
    const _crcTable = (() => {
        const t = new Uint32Array(256);
        for (let n = 0; n < 256; n++) {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            t[n] = c >>> 0;
        }
        return t;
    })();
    function crc32(buf) {
        let c = ~0;
        for (let i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
        return ~c >>> 0;
    }
    const _u16 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255]);
    const _u32 = (n) => new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
    /** files: [{name, data:Uint8Array}] → Blob application/zip (stored). */
    function buildZip(files) {
        const enc = new TextEncoder();
        const parts = [];
        let offset = 0;
        const push = (a) => {
            parts.push(a);
            offset += a.length;
        };
        const central = [];
        for (const f of files) {
            const name = enc.encode(f.name);
            const crc = crc32(f.data);
            const size = f.data.length;
            const localOffset = offset;
            push(_u32(0x04034b50));
            push(_u16(20));
            push(_u16(0));
            push(_u16(0)); // méthode 0 = stored
            push(_u16(0));
            push(_u16(0));
            push(_u32(crc));
            push(_u32(size));
            push(_u32(size));
            push(_u16(name.length));
            push(_u16(0));
            push(name);
            push(f.data);
            central.push({ crc, size, name, localOffset });
        }
        const cdStart = offset;
        for (const c of central) {
            push(_u32(0x02014b50));
            push(_u16(20));
            push(_u16(20));
            push(_u16(0));
            push(_u16(0));
            push(_u16(0));
            push(_u16(0));
            push(_u32(c.crc));
            push(_u32(c.size));
            push(_u32(c.size));
            push(_u16(c.name.length));
            push(_u16(0));
            push(_u16(0));
            push(_u16(0));
            push(_u16(0));
            push(_u32(0));
            push(_u32(c.localOffset));
            push(c.name);
        }
        const cdSize = offset - cdStart;
        push(_u32(0x06054b50));
        push(_u16(0));
        push(_u16(0));
        push(_u16(central.length));
        push(_u16(central.length));
        push(_u32(cdSize));
        push(_u32(cdStart));
        push(_u16(0));
        return new Blob(parts, { type: 'application/zip' });
    }

    const IlluAnimExport = {
        webCodecsAvailable() {
            return typeof window.VideoEncoder === 'function' && typeof window.VideoFrame === 'function';
        },

        /** Résout la plage d'images [start, end] depuis les options. */
        _range(em, opts) {
            const anim = em.animation;
            const dur = anim ? anim.duration | 0 : 1;
            let start = opts && Number.isFinite(opts.start) ? opts.start | 0 : 0;
            let end = opts && Number.isFinite(opts.end) ? opts.end | 0 : dur - 1;
            start = Math.max(0, Math.min(start, dur - 1));
            end = Math.max(start, Math.min(end, dur - 1));
            return [start, end];
        },

        /** Compose la frame `frame` du document animé dans un canvas plein document. */
        renderFrameCanvas(em, frame) {
            const anim = em.animation;
            const prev = anim.playhead;
            anim.playhead = frame | 0;
            if (window.IlluAnim && typeof window.IlluAnim.resolveForRender === 'function') {
                window.IlluAnim.resolveForRender(em);
            }
            const c = em.flattenPixelProjectToCanvas(em.activeProject, true);
            anim.playhead = prev;
            return c;
        },

        /** Restaure l'affichage après un export (repointe au playhead courant). */
        _restoreView(em) {
            if (window.IlluAnim && typeof window.IlluAnim.resolveForRender === 'function') {
                window.IlluAnim.resolveForRender(em);
            }
            em.render();
        },

        // ---- GIF -------------------------------------------------------------

        async exportGif(em, opts) {
            opts = opts || {};
            if (!window.gifenc || !window.gifenc.GIFEncoder) {
                throw new Error('gifenc indisponible');
            }
            const { GIFEncoder, quantize, applyPalette } = window.gifenc;
            const anim = em.animation;
            const fps = Math.max(1, opts.fps || anim.fps || 12);
            const loop = opts.loop !== false;
            const [start, end] = this._range(em, opts);
            const delay = Math.round(1000 / fps);
            const gif = GIFEncoder();
            const total = end - start + 1;

            for (let i = 0, f = start; f <= end; f++, i++) {
                const canvas = this.renderFrameCanvas(em, f);
                const ctx = canvas.getContext('2d', { willReadFrequently: true });
                const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const palette = quantize(data, 256, { format: 'rgba4444' });
                const index = applyPalette(data, palette, 'rgba4444');
                // Ne marquer transparent que s'il existe réellement une entrée alpha=0,
                // sinon gifenc rendrait la palette[0] transparente (frame « noire »).
                let transparentIndex = -1;
                for (let k = 0; k < palette.length; k++) {
                    if (palette[k][3] === 0) {
                        transparentIndex = k;
                        break;
                    }
                }
                const hasAlpha = transparentIndex >= 0;
                gif.writeFrame(index, width, height, {
                    palette,
                    delay,
                    transparent: hasAlpha,
                    transparentIndex: hasAlpha ? transparentIndex : 0,
                    dispose: hasAlpha ? 2 : -1,
                    repeat: i === 0 ? (loop ? 0 : -1) : undefined
                });
                progress((i + 1) / total, `Encodage GIF ${i + 1}/${total}…`);
                if (i % 2 === 0) await yieldToMain(0);
            }
            gif.finish();
            const bytes = gif.bytes();
            this._restoreView(em);
            progressDone();
            return new Blob([bytes], { type: 'image/gif' });
        },

        // ---- Vidéo (MP4 / WebM) ---------------------------------------------

        async exportVideo(em, opts) {
            opts = opts || {};
            if (this.webCodecsAvailable()) {
                try {
                    return await this._exportVideoWebCodecs(em, opts);
                } catch (e) {
                    console.warn('WebCodecs export échoué, repli MediaRecorder :', e);
                }
            }
            return this._exportVideoMediaRecorder(em, opts);
        },

        async _exportVideoWebCodecs(em, opts) {
            const isMp4 = opts.format === 'mp4';
            const Mux = isMp4 ? window.Mp4Muxer : window.WebMMuxer;
            if (!Mux || !Mux.Muxer) throw new Error((isMp4 ? 'mp4-muxer' : 'webm-muxer') + ' indisponible');

            const anim = em.animation;
            const fps = Math.max(1, opts.fps || anim.fps || 12);
            const [start, end] = this._range(em, opts);
            const total = end - start + 1;
            // H.264 exige des dimensions paires.
            const W = em.width + (isMp4 ? em.width & 1 : 0);
            const H = em.height + (isMp4 ? em.height & 1 : 0);

            const target = new Mux.ArrayBufferTarget();
            const muxer = new Mux.Muxer(
                Object.assign(
                    {
                        target,
                        video: { codec: isMp4 ? 'avc' : 'V_VP9', width: W, height: H }
                    },
                    isMp4 ? { fastStart: 'in-memory' } : {}
                )
            );

            const encoder = new VideoEncoder({
                output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
                error: (e) => console.error('VideoEncoder', e)
            });
            encoder.configure({
                codec: isMp4 ? 'avc1.42001f' : 'vp09.00.10.08',
                width: W,
                height: H,
                bitrate: opts.bitrate || 8_000_000,
                framerate: fps
            });

            const frameDurUs = 1e6 / fps;
            const pad = document.createElement('canvas');
            pad.width = W;
            pad.height = H;
            const pctx = pad.getContext('2d');

            for (let i = 0, f = start; f <= end; f++, i++) {
                const frameCanvas = this.renderFrameCanvas(em, f);
                pctx.clearRect(0, 0, W, H);
                pctx.drawImage(frameCanvas, 0, 0);
                const vf = new VideoFrame(pad, {
                    timestamp: Math.round(i * frameDurUs),
                    duration: Math.round(frameDurUs)
                });
                encoder.encode(vf, { keyFrame: i % Math.max(1, Math.round(fps * 2)) === 0 });
                vf.close();
                progress((i + 1) / total, `Encodage ${isMp4 ? 'MP4' : 'WebM'} ${i + 1}/${total}…`);
                // Contre-pression : laisser l'encodeur se vider.
                while (encoder.encodeQueueSize > 8) await yieldToMain(4);
                if (i % 2 === 0) await yieldToMain(0);
            }
            await encoder.flush();
            muxer.finalize();
            this._restoreView(em);
            progressDone();
            return new Blob([target.buffer], { type: isMp4 ? 'video/mp4' : 'video/webm' });
        },

        _exportVideoMediaRecorder(em, opts) {
            return new Promise((resolve, reject) => {
                if (typeof MediaRecorder === 'undefined') {
                    reject(new Error('MediaRecorder indisponible'));
                    return;
                }
                const anim = em.animation;
                const fps = Math.max(1, opts.fps || anim.fps || 12);
                const [start, end] = this._range(em, opts);
                const total = end - start + 1;
                const w = em.width;
                const h = em.height;
                const c = document.createElement('canvas');
                c.width = w;
                c.height = h;
                const cx = c.getContext('2d');
                const stream = c.captureStream(fps);
                const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                    ? 'video/webm;codecs=vp9'
                    : 'video/webm';
                const rec = new MediaRecorder(stream, {
                    mimeType: mime,
                    videoBitsPerSecond: opts.bitrate || 8_000_000
                });
                const chunks = [];
                rec.ondataavailable = (e) => {
                    if (e.data && e.data.size) chunks.push(e.data);
                };
                rec.onstop = () => {
                    this._restoreView(em);
                    progressDone();
                    resolve(new Blob(chunks, { type: 'video/webm' }));
                };
                rec.onerror = (e) => reject(e.error || new Error('MediaRecorder error'));
                rec.start();

                const frameMs = 1000 / fps;
                let i = 0;
                let f = start;
                const tick = () => {
                    const frameCanvas = this.renderFrameCanvas(em, f);
                    cx.clearRect(0, 0, w, h);
                    cx.drawImage(frameCanvas, 0, 0);
                    progress((i + 1) / total, `Capture WebM ${i + 1}/${total}…`);
                    i++;
                    f++;
                    if (f > end) {
                        setTimeout(() => rec.stop(), frameMs * 2);
                        return;
                    }
                    setTimeout(tick, frameMs);
                };
                setTimeout(tick, frameMs);
            });
        },

        // ---- Point d'entrée --------------------------------------------------

        async export(em, opts) {
            opts = opts || {};
            const fmt = opts.format || 'gif';
            if (fmt === 'gif') return this.exportGif(em, opts);
            if (fmt === 'sheet') return this.exportSpriteSheet(em, opts);
            if (fmt === 'zip') return this.exportSequenceZip(em, opts);
            return this.exportVideo(em, opts);
        },

        /** Exporte toutes les images en PNG numérotés, réunis dans un ZIP. */
        async exportSequenceZip(em, opts) {
            opts = opts || {};
            const [start, end] = this._range(em, opts);
            const total = end - start + 1;
            const width = Math.max(4, String(total).length);
            const base = opts.baseName || 'frame';
            const files = [];
            for (let i = 0, f = start; f <= end; f++, i++) {
                const canvas = this.renderFrameCanvas(em, f);
                const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
                const buf = new Uint8Array(await blob.arrayBuffer());
                const num = String(i + 1).padStart(width, '0');
                files.push({ name: `${base}_${num}.png`, data: buf });
                progress((i + 1) / total, `Image ${i + 1}/${total}…`);
                if (i % 3 === 0) await yieldToMain(0);
            }
            this._restoreView(em);
            progressDone();
            return buildZip(files);
        },

        /** Exporte toutes les images en une planche de sprites (grille PNG). */
        async exportSpriteSheet(em, opts) {
            opts = opts || {};
            const [start, end] = this._range(em, opts);
            const total = end - start + 1;
            const cols = Math.max(1, opts.columns || Math.ceil(Math.sqrt(total)));
            const rows = Math.ceil(total / cols);
            const W = em.width;
            const H = em.height;
            const sheet = document.createElement('canvas');
            sheet.width = cols * W;
            sheet.height = rows * H;
            const sx = sheet.getContext('2d');
            for (let i = 0, f = start; f <= end; f++, i++) {
                const frameCanvas = this.renderFrameCanvas(em, f);
                const col = i % cols;
                const row = Math.floor(i / cols);
                sx.drawImage(frameCanvas, col * W, row * H);
                progress((i + 1) / total, `Planche ${i + 1}/${total}…`);
                if (i % 4 === 0) await yieldToMain(0);
            }
            this._restoreView(em);
            progressDone();
            return await new Promise((resolve) => sheet.toBlob((blob) => resolve(blob), 'image/png'));
        }
    };

    window.IlluAnimExport = IlluAnimExport;
})();
