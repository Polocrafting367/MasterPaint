/**
 * GifImport — décodage de GIF animés en frames + délais, puis import comme document
 * d'animation (une image du GIF = un cel de la frise, timings préservés par maintien).
 *
 * Primaire : WebCodecs ImageDecoder (compose déjà la disposition inter-frames).
 * Repli    : omggif (window.omggif.GifReader) avec composition/disposition manuelle.
 */
(function () {
    'use strict';

    const DOC = document;

    function makeCanvas(w, h) {
        const c = DOC.createElement('canvas');
        c.width = Math.max(1, w | 0);
        c.height = Math.max(1, h | 0);
        return c;
    }

    const IlluGifImport = {
        imageDecoderAvailable() {
            return typeof window.ImageDecoder === 'function';
        },

        /**
         * Décode un blob GIF → { width, height, loop, frames:[{canvas, delayMs}] }.
         */
        async decode(blob) {
            const buf = await blob.arrayBuffer();
            if (this.imageDecoderAvailable()) {
                try {
                    return await this._decodeWithImageDecoder(buf);
                } catch (e) {
                    console.warn('ImageDecoder GIF échoué, repli omggif :', e);
                }
            }
            return this._decodeWithOmggif(buf);
        },

        async _decodeWithImageDecoder(buf) {
            const dec = new ImageDecoder({ data: buf, type: 'image/gif' });
            await dec.tracks.ready;
            const track = dec.tracks.selectedTrack;
            let count = track ? track.frameCount : 1;
            const frames = [];
            let width = 0;
            let height = 0;
            for (let i = 0; i < count; i++) {
                let res;
                try {
                    res = await dec.decode({ frameIndex: i, completeFramesOnly: true });
                } catch (e) {
                    break;
                }
                const image = res.image;
                width = image.displayWidth || image.codedWidth;
                height = image.displayHeight || image.codedHeight;
                const c = makeCanvas(width, height);
                c.getContext('2d').drawImage(image, 0, 0);
                const delayMs = image.duration ? Math.max(10, Math.round(image.duration / 1000)) : 100;
                frames.push({ canvas: c, delayMs });
                image.close();
                // frameCount peut croître au fil du décodage progressif.
                if (track && track.frameCount > count) count = track.frameCount;
            }
            const loop = !track || track.repetitionCount !== 0;
            return { width, height, loop, frames };
        },

        _decodeWithOmggif(buf) {
            if (!window.omggif || !window.omggif.GifReader) {
                throw new Error('Décodeur GIF indisponible (omggif)');
            }
            const reader = new window.omggif.GifReader(new Uint8Array(buf));
            const w = reader.width;
            const h = reader.height;
            const n = reader.numFrames();
            const frames = [];
            const full = new Uint8ClampedArray(w * h * 4); // tampon persistant (composition)
            let prev = null;
            for (let i = 0; i < n; i++) {
                const info = reader.frameInfo(i);
                if (info.disposal === 3) prev = full.slice(0);
                reader.decodeAndBlitFrameRGBA(i, full);
                const c = makeCanvas(w, h);
                c.getContext('2d').putImageData(new ImageData(full.slice(0), w, h), 0, 0);
                const delayMs = Math.max(10, (info.delay || 10) * 10); // délai en centisecondes
                frames.push({ canvas: c, delayMs });
                if (info.disposal === 2) {
                    // restaure la zone à « fond » (transparent)
                    for (let y = 0; y < info.height; y++) {
                        for (let x = 0; x < info.width; x++) {
                            const idx = ((info.y + y) * w + (info.x + x)) * 4;
                            full[idx] = full[idx + 1] = full[idx + 2] = full[idx + 3] = 0;
                        }
                    }
                } else if (info.disposal === 3 && prev) {
                    full.set(prev);
                }
            }
            const loop = reader.loopCount ? reader.loopCount() !== 0 : true;
            return { width: w, height: h, loop, frames };
        },

        /** Choisit une cadence (ips) adaptée aux délais des frames. */
        _pickFps(frames) {
            const delays = frames.map((f) => f.delayMs).filter((d) => d > 0);
            const minD = delays.length ? Math.min(...delays) : 100;
            let fps = Math.round(1000 / minD);
            return Math.max(1, Math.min(50, fps || 12));
        },

        /**
         * Importe un GIF (blob/File) comme nouveau document d'animation.
         * Retourne le projet créé.
         */
        async importAsAnimation(em, blob, name) {
            const dec = await this.decode(blob);
            if (!dec || !dec.frames.length) throw new Error('GIF sans image décodable');
            const fps = this._pickFps(dec.frames);
            const frameMs = 1000 / fps;

            // Position de chaque image du GIF sur la frise (maintien = durée du délai).
            let cum = 0;
            const placements = dec.frames.map((fr) => {
                const start = Math.round(cum / frameMs);
                cum += fr.delayMs;
                return { start, canvas: fr.canvas };
            });
            // Évite les collisions de frame de départ (délais très courts).
            for (let i = 1; i < placements.length; i++) {
                if (placements[i].start <= placements[i - 1].start) {
                    placements[i].start = placements[i - 1].start + 1;
                }
            }
            const duration = Math.max(placements[placements.length - 1].start + 1, Math.round(cum / frameMs) || 1);

            const project = em.createAnimationProject({
                width: dec.width,
                height: dec.height,
                fps,
                duration,
                name: name || 'GIF importé',
                layerName: 'GIF'
            });

            const layer = em.activeLayer;
            const IA = window.IlluAnim;
            layer.cels = placements.map((p) => ({
                frame: p.start,
                hold: IA ? IA.HOLD_INF : 1e9,
                buffer: p.canvas
            }));
            if (layer.cels[0].frame !== 0) layer.cels[0].frame = 0;
            layer.propTracks = { x: [], y: [], opacity: [], scale: [], rotation: [] };

            if (project.animation) {
                project.animation.loop = dec.loop !== false;
                project.animation.playhead = 0;
            }
            if (IA) IA.seek(em, 0);
            em.render();
            if (window.IlluAnimPanel && typeof window.IlluAnimPanel.refresh === 'function') {
                window.IlluAnimPanel.syncVisibility();
                window.IlluAnimPanel.refresh();
            }
            return project;
        },

        /** Ouvre un sélecteur de fichier et importe le GIF choisi comme animation. */
        pickAndImport(em) {
            const input = DOC.createElement('input');
            input.type = 'file';
            input.accept = 'image/gif,.gif';
            input.style.display = 'none';
            input.addEventListener('change', async () => {
                const file = input.files && input.files[0];
                input.remove();
                if (!file) return;
                try {
                    if (window.IlluProgress && window.IlluProgress.status) {
                        window.IlluProgress.status(10, 'Import du GIF…');
                    }
                    await this.importAsAnimation(em || window.EditorManager, file, file.name.replace(/\.gif$/i, ''));
                } catch (e) {
                    console.error('Import GIF échoué', e);
                    if (typeof window.showIlluAlert === 'function') {
                        window.showIlluAlert('Import GIF échoué : ' + (e && e.message ? e.message : e));
                    }
                } finally {
                    if (window.IlluProgress && window.IlluProgress.statusDone) window.IlluProgress.statusDone();
                }
            });
            DOC.body.appendChild(input);
            input.click();
        },

        /** Tri « naturel » par nom (frame1, frame2, …, frame10). */
        _naturalSort(a, b) {
            return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
        },

        /** Décode un fichier image en canvas. */
        async _fileToCanvas(file) {
            const url = URL.createObjectURL(file);
            try {
                const img = await new Promise((resolve, reject) => {
                    const im = new Image();
                    im.onload = () => resolve(im);
                    im.onerror = reject;
                    im.src = url;
                });
                const c = makeCanvas(img.naturalWidth || img.width, img.naturalHeight || img.height);
                c.getContext('2d').drawImage(img, 0, 0);
                return c;
            } finally {
                URL.revokeObjectURL(url);
            }
        },

        /**
         * Importe une liste de fichiers image (triés par nom) comme séquence d'images :
         * un nouveau document d'animation, une image du fichier = un cel.
         */
        async importSequenceAsAnimation(em, files, name) {
            const list = Array.from(files || []).filter((f) => /image\//.test(f.type) || /\.(png|jpe?g|webp|bmp|gif)$/i.test(f.name));
            list.sort((a, b) => this._naturalSort(a.name, b.name));
            if (list.length < 1) throw new Error('Aucune image dans la séquence');
            const canvases = [];
            for (let i = 0; i < list.length; i++) {
                if (window.IlluProgress && window.IlluProgress.status) {
                    window.IlluProgress.status(10 + Math.round((i / list.length) * 60), `Séquence ${i + 1}/${list.length}…`);
                }
                canvases.push(await this._fileToCanvas(list[i]));
            }
            const W = canvases[0].width;
            const H = canvases[0].height;
            const project = em.createAnimationProject({
                width: W,
                height: H,
                fps: 12,
                duration: canvases.length,
                name: name || 'Séquence',
                layerName: 'Séquence'
            });
            const IA = window.IlluAnim;
            const layer = em.activeLayer;
            layer.cels = canvases.map((cv, i) => {
                // recadre/centre chaque image sur la toile du document
                const buf = makeCanvas(W, H);
                buf.getContext('2d').drawImage(cv, 0, 0);
                return { frame: i, hold: IA ? IA.HOLD_INF : 1e9, buffer: buf };
            });
            layer.propTracks = { x: [], y: [], opacity: [], scale: [], rotation: [] };
            if (IA) IA.seek(em, 0);
            em.render();
            if (window.IlluAnimPanel && window.IlluAnimPanel.refresh) {
                window.IlluAnimPanel.syncVisibility();
                window.IlluAnimPanel.refresh();
            }
            if (window.IlluProgress && window.IlluProgress.statusDone) window.IlluProgress.statusDone();
            return project;
        },

        /** Ouvre un sélecteur multi-fichiers et importe la séquence choisie. */
        pickAndImportSequence(em) {
            const input = DOC.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.multiple = true;
            input.style.display = 'none';
            input.addEventListener('change', async () => {
                const files = input.files ? Array.from(input.files) : [];
                input.remove();
                if (!files.length) return;
                try {
                    await this.importSequenceAsAnimation(em || window.EditorManager, files, 'Séquence');
                } catch (e) {
                    console.error('Import séquence échoué', e);
                    if (typeof window.showIlluAlert === 'function') {
                        window.showIlluAlert('Import séquence échoué : ' + (e && e.message ? e.message : e));
                    }
                    if (window.IlluProgress && window.IlluProgress.statusDone) window.IlluProgress.statusDone();
                }
            });
            DOC.body.appendChild(input);
            input.click();
        },

        /**
         * Depuis des images déjà chargées (import multi-fichiers) : trie par nom, demande
         * image début / fin / IPS, puis crée le document d'animation.
         * @param {Array<{img:HTMLImageElement, importOpts:object}>} items
         */
        startSequenceFromPending(em, items) {
            const list = (items || [])
                .filter((it) => it && it.img)
                .map((it) => ({
                    img: it.img,
                    name: (it.importOpts && it.importOpts.layerName) || it.img._illuFileName || ''
                }));
            list.sort((a, b) => this._naturalSort(a.name, b.name));
            if (!list.length) return;
            this._showSequenceRangeDialog(list, (startIdx, endIdx, fps) => {
                const imgs = list.slice(startIdx - 1, endIdx).map((x) => x.img);
                this.importSequenceFromImages(em, imgs, { fps, name: 'Séquence' });
            });
        },

        /** Crée un document d'animation à partir d'images (HTMLImageElement/canvas) déjà chargées. */
        importSequenceFromImages(em, imgs, opts) {
            opts = opts || {};
            if (!imgs || !imgs.length) return null;
            const W = imgs[0].naturalWidth || imgs[0].width;
            const H = imgs[0].naturalHeight || imgs[0].height;
            const fps = Math.max(1, Math.min(60, opts.fps || 12));
            const project = em.createAnimationProject({
                width: W,
                height: H,
                fps,
                duration: imgs.length,
                name: opts.name || 'Séquence',
                layerName: 'Séquence'
            });
            const IA = window.IlluAnim;
            const layer = em.activeLayer;
            layer.cels = imgs.map((img, i) => {
                const buf = makeCanvas(W, H);
                buf.getContext('2d').drawImage(img, 0, 0);
                return { frame: i, hold: IA ? IA.HOLD_INF : 1e9, buffer: buf };
            });
            layer.propTracks = { x: [], y: [], opacity: [], scale: [], rotation: [], hue: [] };
            if (IA) IA.seek(em, 0);
            em.render();
            if (window.IlluAnimPanel && window.IlluAnimPanel.refresh) {
                window.IlluAnimPanel.syncVisibility();
                window.IlluAnimPanel.refresh();
            }
            return project;
        },

        /** Petite fenêtre : image début, image fin, IPS. */
        _showSequenceRangeDialog(list, onConfirm) {
            const n = list.length;
            const prev = DOC.getElementById('illu-anim-seq-dialog');
            if (prev) prev.remove();
            const ov = DOC.createElement('div');
            ov.id = 'illu-anim-seq-dialog';
            ov.style.cssText =
                'position:fixed;inset:0;z-index:14000;background:rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;';
            const t = (k, fb) =>
                window.IlluI18n && window.IlluI18n.t && window.IlluI18n.t(k) !== k ? window.IlluI18n.t(k) : fb;
            const win = DOC.createElement('div');
            win.className = 'window';
            win.style.cssText = 'width:320px;';
            win.innerHTML =
                '<div class="title-bar"><div class="title-bar-text">' +
                t('anim.seqTitle', 'Ouvrir en séquence animée') +
                '</div></div><div class="window-body" style="padding:12px;">' +
                '<p style="margin:0 0 10px;">' +
                t('anim.seqIntro', n + ' images détectées. Choisissez la plage et la cadence :').replace('{n}', n) +
                '</p>' +
                '<div class="field-row" style="justify-content:space-between;margin:6px 0;"><label>' +
                t('anim.seqFirst', 'Image de début') +
                '</label><input type="number" id="illu-seq-first" min="1" max="' + n + '" value="1" style="width:70px"></div>' +
                '<div class="field-row" style="justify-content:space-between;margin:6px 0;"><label>' +
                t('anim.seqLast', 'Image de fin') +
                '</label><input type="number" id="illu-seq-last" min="1" max="' + n + '" value="' + n + '" style="width:70px"></div>' +
                '<div class="field-row" style="justify-content:space-between;margin:6px 0;"><label>' +
                t('anim.seqFps', 'Images / seconde') +
                '</label><input type="number" id="illu-seq-fps" min="1" max="60" value="12" style="width:70px"></div>' +
                '<div style="text-align:right;margin-top:14px;display:flex;gap:8px;justify-content:flex-end;">' +
                '<button type="button" id="illu-seq-cancel">' + t('dlg.cancel', 'Annuler') + '</button>' +
                '<button type="button" id="illu-seq-ok">' + t('dlg.create', 'Créer') + '</button></div></div>';
            ov.appendChild(win);
            DOC.body.appendChild(ov);
            const close = () => ov.remove();
            win.querySelector('#illu-seq-cancel').onclick = close;
            ov.addEventListener('pointerdown', (e) => {
                if (e.target === ov) close();
            });
            win.querySelector('#illu-seq-ok').onclick = () => {
                let a = parseInt(win.querySelector('#illu-seq-first').value, 10) || 1;
                let b = parseInt(win.querySelector('#illu-seq-last').value, 10) || n;
                const fps = parseInt(win.querySelector('#illu-seq-fps').value, 10) || 12;
                a = Math.max(1, Math.min(n, a));
                b = Math.max(a, Math.min(n, b));
                close();
                onConfirm(a, b, fps);
            };
        }
    };

    window.IlluGifImport = IlluGifImport;
})();
