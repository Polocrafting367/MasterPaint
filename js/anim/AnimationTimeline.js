/**
 * AnimationTimeline — moteur de la frise chronologique (mode animation).
 *
 * Modèle (par projet) : project.animation = { enabled, fps, duration, playhead, loop,
 *   playing, onionSkin, onionBefore, onionAfter }.
 * Modèle (par calque) :
 *   layer.cels = [ { frame, hold, buffer:<canvas> }, … ]  (triés par frame croissant)
 *     — un cel est « exposé » (figé/maintien) de `frame` jusqu'au cel suivant (ou fin de
 *       la frise), éventuellement écourté par `hold` (crée un trou vide après).
 *   layer.propTracks = { x:[], y:[], opacity:[], scale:[], rotation:[] }  (points clés
 *     de propriété interpolés — tween, rempli en P2).
 *
 * Le moteur repointe layer.buffer sur le cel actif au temps courant à chaque rendu, de
 * sorte que tous les outils et effets bitmap existants (qui écrivent dans layer.buffer)
 * fonctionnent sans modification.
 */
(function () {
    'use strict';

    const DOC = document;
    const HOLD_INF = 1e9;
    let _celClipboard = null; // presse-papier de cel (canvas) pour copier/coller

    function makeCanvas(w, h) {
        const c = DOC.createElement('canvas');
        c.width = Math.max(1, w | 0);
        c.height = Math.max(1, h | 0);
        return c;
    }

    function copyCanvas(src, w, h) {
        const c = makeCanvas(w, h);
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (src) {
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(src, 0, 0);
        }
        return c;
    }

    /** Canvas transparent partagé (trous / calques sans cel), redimensionné au besoin. */
    function emptyBuffer(em) {
        const w = em.width | 0;
        const h = em.height | 0;
        let e = em._animEmptyBuffer;
        if (!e || e.width !== w || e.height !== h) {
            e = makeCanvas(w, h);
            em._animEmptyBuffer = e;
        }
        return e;
    }

    /** Garantit que le calque possède des pistes d'animation (init paresseuse). */
    function ensureTracks(em, layer) {
        if (!layer) return;
        if (!Array.isArray(layer.cels) || layer.cels.length === 0) {
            const anim = em.animation;
            const dur = anim && anim.duration > 0 ? anim.duration : 24;
            layer.cels = [{ frame: 0, hold: dur, buffer: layer.buffer || makeCanvas(em.width, em.height) }];
        }
        if (!layer.propTracks) {
            layer.propTracks = { x: [], y: [], opacity: [], scale: [], rotation: [] };
        }
    }

    function sortCels(layer) {
        layer.cels.sort((a, b) => a.frame - b.frame);
    }

    /**
     * Cel actif d'un calque au temps t (ou null si trou / avant le premier cel).
     * Retourne { cel, index, exposureEnd } ou null.
     */
    function activeCelInfo(layer, t) {
        const cels = layer.cels;
        if (!cels || cels.length === 0) return null;
        let idx = -1;
        for (let i = 0; i < cels.length; i++) {
            if (cels[i].frame <= t) idx = i;
            else break;
        }
        if (idx < 0) return null;
        const cel = cels[idx];
        const nextFrame = idx + 1 < cels.length ? cels[idx + 1].frame : HOLD_INF;
        const hold = cel.hold != null && cel.hold > 0 ? cel.hold : HOLD_INF;
        const exposureEnd = Math.min(cel.frame + hold, nextFrame);
        if (t < exposureEnd) return { cel, index: idx, exposureEnd };
        return null; // trou (au-delà du maintien, avant le cel suivant)
    }

    function celAt(layer, t) {
        const info = activeCelInfo(layer, t);
        return info ? info.cel : null;
    }

    // ---- Interpolation des propriétés (tween) --------------------------------

    function easeValue(kind, u) {
        switch (kind) {
            case 'ease-in':
                return u * u;
            case 'ease-out':
                return u * (2 - u);
            case 'ease-in-out':
                return u < 0.5 ? 2 * u * u : -1 + (4 - 2 * u) * u;
            case 'hold':
                return 0; // maintient la valeur de la clé précédente
            default:
                return u; // linéaire
        }
    }

    /** Valeur interpolée d'une piste au temps t, ou undefined si aucune clé. */
    function sampleTrack(track, t) {
        if (!track || track.length === 0) return undefined;
        if (track.length === 1) return track[0].value;
        // triée par frame
        if (t <= track[0].frame) return track[0].value;
        if (t >= track[track.length - 1].frame) return track[track.length - 1].value;
        for (let i = 0; i < track.length - 1; i++) {
            const a = track[i];
            const b = track[i + 1];
            if (t >= a.frame && t <= b.frame) {
                const span = b.frame - a.frame || 1;
                const u = (t - a.frame) / span;
                const e = easeValue(a.easing || 'linear', u);
                return a.value + (b.value - a.value) * e;
            }
        }
        return track[track.length - 1].value;
    }

    function applyTween(em, layer, t) {
        const pt = layer.propTracks;
        if (!pt) return;
        const x = sampleTrack(pt.x, t);
        const y = sampleTrack(pt.y, t);
        const o = sampleTrack(pt.opacity, t);
        const s = sampleTrack(pt.scale, t);
        const r = sampleTrack(pt.rotation, t);
        const hue = sampleTrack(pt.hue, t);
        if (x !== undefined) layer.x = x;
        if (y !== undefined) layer.y = y;
        if (o !== undefined) layer.opacity = Math.max(0, Math.min(1, o));
        // scale/rotation/teinte honorés par le compositing (_drawNormalPixelLayerToContext)
        layer.animScale = s !== undefined ? s : 1;
        layer.animRotation = r !== undefined ? r : 0;
        layer.animHue = hue !== undefined ? hue : 0;
    }

    // ---- Résolution au rendu -------------------------------------------------

    const IlluAnim = {
        HOLD_INF,
        celAt,
        activeCelInfo,
        makeCanvas,

        /** Repointage des buffers + tween avant compositing. Appelé par render(). */
        resolveForRender(em) {
            const anim = em.animation;
            if (!anim) return;
            const t = anim.playhead | 0;
            // Détecte un changement d'image : on recalcule alors TOUS les filtres dynamiques
            // (effet sur soi ET « sur les calques en dessous ») et les masques alpha, car le
            // contenu de n'importe quel calque a pu changer à ce nouveau temps.
            const playheadChanged = em._animLastResolvedPlayhead !== t;
            em._animLastResolvedPlayhead = t;
            const layers = em.layers || [];
            for (let i = 0; i < layers.length; i++) {
                const layer = layers[i];
                if (!layer) continue;
                ensureTracks(em, layer);
                const cel = celAt(layer, t);
                const newBuf = cel ? cel.buffer : emptyBuffer(em);
                if (layer.buffer !== newBuf) layer.buffer = newBuf;
                if (playheadChanged) {
                    layer._dynAsyncKey = null;
                    layer._dynAsyncPendingKey = null;
                    layer._alphaAsyncKey = null;
                    layer._alphaAsyncPendingKey = null;
                }
                applyTween(em, layer, t);
            }
        },

        /**
         * Garantit un cel éditable exactement au temps courant sur le calque donné.
         * Matérialise (copie du cel maintenu) si le temps tombe sur un maintien ou un trou.
         */
        ensureEditableCel(em, layerIndex) {
            const anim = em.animation;
            if (!anim) return null;
            const layer = em.layers[layerIndex];
            if (!layer) return null;
            ensureTracks(em, layer);
            const t = anim.playhead | 0;
            const info = activeCelInfo(layer, t);
            if (info && info.cel.frame === t) {
                layer.buffer = info.cel.buffer;
                return info.cel;
            }
            // Créer un nouveau cel VIERGE à t (dessin image par image). Pour repartir du
            // cel maintenu, utiliser « Dupliquer le cel » (⧉) explicitement.
            const buf = makeCanvas(em.width, em.height);
            const cel = { frame: t, hold: HOLD_INF, buffer: buf };
            layer.cels.push(cel);
            sortCels(layer);
            layer.buffer = buf;
            this._changed(em);
            return cel;
        },

        // ---- Navigation ------------------------------------------------------

        seek(em, frame) {
            const anim = em.animation;
            if (!anim) return;
            let f = frame | 0;
            if (f < 0) f = 0;
            if (f > anim.duration - 1) f = anim.duration - 1;
            anim.playhead = f;
            em.render();
            this._changed(em, 'seek');
        },

        step(em, delta) {
            const anim = em.animation;
            if (!anim) return;
            this.seek(em, (anim.playhead | 0) + delta);
        },

        gotoFirst(em) {
            this.seek(em, 0);
        },
        gotoLast(em) {
            const anim = em.animation;
            if (anim) this.seek(em, anim.duration - 1);
        },

        // ---- Lecture ---------------------------------------------------------

        play(em) {
            const anim = em.animation;
            if (!anim || anim.playing) return;
            anim.playing = true;
            const frameDur = () => 1000 / Math.max(1, anim.fps || 12);
            let last = performance.now();
            const loop = (ts) => {
                if (!anim.playing || em.animation !== anim) return;
                const fd = frameDur();
                let dt = ts - last;
                if (dt >= fd) {
                    const adv = Math.floor(dt / fd);
                    last += adv * fd;
                    const lastFrame = anim.duration - 1;
                    if (anim._playDir !== -1) anim._playDir = 1;
                    let p;
                    if (anim.pingpong) {
                        // Lecture aller-retour : rebond aux extrémités.
                        p = (anim.playhead | 0) + adv * anim._playDir;
                        let guard = 0;
                        while ((p > lastFrame || p < 0) && lastFrame > 0 && guard++ < 8) {
                            if (p > lastFrame) {
                                p = 2 * lastFrame - p;
                                anim._playDir = -1;
                            } else {
                                p = -p;
                                anim._playDir = 1;
                            }
                        }
                    } else {
                        p = (anim.playhead | 0) + adv;
                        if (p > lastFrame) {
                            if (anim.loop) p = anim.duration > 0 ? p % anim.duration : 0;
                            else {
                                p = lastFrame;
                                anim.playing = false;
                            }
                        }
                    }
                    anim.playhead = Math.max(0, Math.min(lastFrame, p));
                    em.render();
                    this._changed(em, 'playhead');
                }
                if (anim.playing) anim._raf = requestAnimationFrame(loop);
            };
            anim._raf = requestAnimationFrame(loop);
            this._changed(em, 'play');
        },

        pause(em) {
            const anim = em.animation;
            if (!anim) return;
            anim.playing = false;
            if (anim._raf) cancelAnimationFrame(anim._raf);
            anim._raf = 0;
            this._changed(em, 'pause');
        },

        togglePlay(em) {
            const anim = em.animation;
            if (!anim) return;
            if (anim.playing) this.pause(em);
            else this.play(em);
        },

        // ---- Frames ----------------------------------------------------------

        setFps(em, fps) {
            const anim = em.animation;
            if (anim) anim.fps = Math.max(1, Math.min(60, fps | 0 || 12));
            this._changed(em);
        },

        setDuration(em, dur) {
            const anim = em.animation;
            if (!anim) return;
            anim.duration = Math.max(1, dur | 0);
            if (anim.playhead > anim.duration - 1) anim.playhead = anim.duration - 1;
            this._changed(em);
            em.render();
        },

        /** Ajoute une image vierge à la fin de la frise. */
        addFrame(em) {
            const anim = em.animation;
            if (!anim) return;
            anim.duration += 1;
            this._changed(em);
        },

        /** Insère une image à `frame` (décale cels & clés ≥ frame). */
        insertFrame(em, frame) {
            const anim = em.animation;
            if (!anim) return;
            const t = frame == null ? anim.playhead : frame | 0;
            em.layers.forEach((layer) => {
                ensureTracks(em, layer);
                layer.cels.forEach((c) => {
                    if (c.frame >= t) c.frame += 1;
                });
                const pt = layer.propTracks;
                if (pt) Object.keys(pt).forEach((k) => pt[k].forEach((kf) => { if (kf.frame >= t) kf.frame += 1; }));
            });
            anim.duration += 1;
            this._changed(em);
            em.render();
        },

        /** Supprime l'image `frame` (décale, retire les clés situées dessus). */
        removeFrame(em, frame) {
            const anim = em.animation;
            if (!anim || anim.duration <= 1) return;
            const t = frame == null ? anim.playhead : frame | 0;
            em.layers.forEach((layer) => {
                ensureTracks(em, layer);
                layer.cels = layer.cels.filter((c) => c.frame !== t);
                layer.cels.forEach((c) => { if (c.frame > t) c.frame -= 1; });
                if (layer.cels.length === 0) {
                    layer.cels = [{ frame: 0, hold: HOLD_INF, buffer: makeCanvas(em.width, em.height) }];
                }
                const pt = layer.propTracks;
                if (pt) Object.keys(pt).forEach((k) => {
                    pt[k] = pt[k].filter((kf) => kf.frame !== t);
                    pt[k].forEach((kf) => { if (kf.frame > t) kf.frame -= 1; });
                });
            });
            anim.duration -= 1;
            if (anim.playhead > anim.duration - 1) anim.playhead = anim.duration - 1;
            this._changed(em);
            em.render();
        },

        /** Duplique le cel actif du calque à l'image courante vers l'image suivante. */
        duplicateCel(em, layerIndex, frame) {
            const anim = em.animation;
            if (!anim) return;
            const layer = em.layers[layerIndex == null ? em.activeLayerIndex : layerIndex];
            if (!layer) return;
            ensureTracks(em, layer);
            const t = frame == null ? anim.playhead : frame | 0;
            const src = celAt(layer, t);
            const dstFrame = Math.min(anim.duration - 1, t + 1);
            const buf = copyCanvas(src ? src.buffer : null, em.width, em.height);
            layer.cels = layer.cels.filter((c) => c.frame !== dstFrame);
            layer.cels.push({ frame: dstFrame, hold: HOLD_INF, buffer: buf });
            sortCels(layer);
            this._changed(em);
            em.render();
        },

        /** Copie le cel courant (résolu au temps t) dans le presse-papier interne. */
        copyCel(em, layerIndex, frame) {
            const layer = em.layers[layerIndex == null ? em.activeLayerIndex : layerIndex];
            if (!layer) return false;
            ensureTracks(em, layer);
            const t = frame == null ? em.animation.playhead : frame | 0;
            const src = celAt(layer, t);
            _celClipboard = copyCanvas(src ? src.buffer : null, em.width, em.height);
            return true;
        },

        hasClipboard() {
            return !!_celClipboard;
        },

        /** Colle le presse-papier comme cel à l'image courante (remplace un cel existant). */
        pasteCel(em, layerIndex, frame) {
            if (!_celClipboard) return false;
            const layer = em.layers[layerIndex == null ? em.activeLayerIndex : layerIndex];
            if (!layer) return false;
            ensureTracks(em, layer);
            const t = frame == null ? em.animation.playhead : frame | 0;
            const buf = copyCanvas(_celClipboard, em.width, em.height);
            layer.cels = layer.cels.filter((c) => c.frame !== t);
            layer.cels.push({ frame: t, hold: HOLD_INF, buffer: buf });
            sortCels(layer);
            layer.buffer = buf;
            this._changed(em);
            em.render();
            return true;
        },

        /** Déplace un cel d'une image à une autre (glisser-déposer). */
        moveCel(em, layerIndex, fromFrame, toFrame) {
            const layer = em.layers[layerIndex];
            if (!layer || !layer.cels) return;
            const from = fromFrame | 0;
            const to = toFrame | 0;
            if (from === to || from === 0) return; // ne déplace pas le cel@0 de base
            const cel = layer.cels.find((c) => c.frame === from);
            if (!cel) return;
            layer.cels = layer.cels.filter((c) => c.frame !== to && c !== cel);
            cel.frame = to;
            cel.hold = HOLD_INF;
            layer.cels.push(cel);
            sortCels(layer);
            this._changed(em);
            em.render();
        },

        /** Duplique le cel courant sur les `count` images suivantes (étendre un dessin). */
        repeatCelOverRange(em, layerIndex, frame, count) {
            const anim = em.animation;
            if (!anim) return;
            const layer = em.layers[layerIndex == null ? em.activeLayerIndex : layerIndex];
            if (!layer) return;
            ensureTracks(em, layer);
            const t = frame == null ? anim.playhead : frame | 0;
            const src = celAt(layer, t);
            if (!src) return;
            const n = Math.max(1, count | 0);
            const end = Math.min(anim.duration - 1, t + n);
            for (let f = t + 1; f <= end; f++) {
                const buf = copyCanvas(src.buffer, em.width, em.height);
                layer.cels = layer.cels.filter((c) => c.frame !== f);
                layer.cels.push({ frame: f, hold: HOLD_INF, buffer: buf });
            }
            sortCels(layer);
            this._changed(em);
            em.render();
        },

        /** Inverse l'animation dans le temps (cels résolus + clés de propriété). */
        reverseAnimation(em) {
            const anim = em.animation;
            if (!anim) return;
            const last = anim.duration - 1;
            em.layers.forEach((layer) => {
                ensureTracks(em, layer);
                // Échantillonne le buffer résolu à chaque image, inverse, reconstruit les cels
                // en préservant les maintiens (un cel seulement quand le buffer change).
                const frames = [];
                for (let f = 0; f <= last; f++) {
                    const c = celAt(layer, f);
                    frames.push(c ? c.buffer : null);
                }
                frames.reverse();
                const newCels = [];
                let prev;
                for (let f = 0; f <= last; f++) {
                    const buf = frames[f];
                    if (buf !== prev) {
                        if (buf) newCels.push({ frame: f, hold: HOLD_INF, buffer: buf });
                        prev = buf;
                    }
                }
                if (!newCels.length || newCels[0].frame !== 0) {
                    newCels.unshift({ frame: 0, hold: HOLD_INF, buffer: makeCanvas(em.width, em.height) });
                }
                layer.cels = newCels;
                const pt = layer.propTracks;
                if (pt) {
                    Object.keys(pt).forEach((k) => {
                        pt[k].forEach((kf) => { kf.frame = last - kf.frame; });
                        pt[k].sort((a, b) => a.frame - b.frame);
                    });
                }
            });
            this._changed(em);
            em.render();
        },

        /** Active/désactive la lecture aller-retour (ping-pong). */
        togglePingPong(em) {
            const anim = em.animation;
            if (!anim) return;
            anim.pingpong = !anim.pingpong;
            this._changed(em, 'pingpong');
        },

        /** Supprime le cel exactement à `frame` sur un calque (revient au maintien). */
        clearCel(em, layerIndex, frame) {
            const layer = em.layers[layerIndex];
            if (!layer || !layer.cels) return;
            const t = frame | 0;
            if (t === 0) return; // garde toujours un cel@0
            layer.cels = layer.cels.filter((c) => c.frame !== t);
            this._changed(em);
            em.render();
        },

        /** Définit la fin de maintien (« figer jusqu'à Y ») d'un cel : hold = Y - frame + 1. */
        setCelHoldUntil(em, layerIndex, celFrame, untilFrame) {
            const layer = em.layers[layerIndex];
            if (!layer || !layer.cels) return;
            const cel = layer.cels.find((c) => c.frame === (celFrame | 0));
            if (!cel) return;
            const until = Math.max(cel.frame, untilFrame | 0);
            cel.hold = until - cel.frame + 1;
            this._changed(em);
            em.render();
        },

        // ---- Points clés de propriété (tween) --------------------------------

        addPropKeyframe(em, layerIndex, prop, frame, value, easing) {
            const layer = em.layers[layerIndex];
            if (!layer) return;
            ensureTracks(em, layer);
            if (!layer.propTracks[prop]) layer.propTracks[prop] = []; // pistes ajoutées à la demande (ex. hue)
            const track = layer.propTracks[prop];
            const t = frame == null ? em.animation.playhead | 0 : frame | 0;
            const v = value == null ? this._currentPropValue(layer, prop) : value;
            const existing = track.find((k) => k.frame === t);
            if (existing) existing.value = v;
            else track.push({ frame: t, value: v, easing: easing || 'linear' });
            track.sort((a, b) => a.frame - b.frame);
            this._changed(em);
            em.render();
        },

        removePropKeyframe(em, layerIndex, prop, frame) {
            const layer = em.layers[layerIndex];
            if (!layer || !layer.propTracks || !layer.propTracks[prop]) return;
            const t = frame | 0;
            layer.propTracks[prop] = layer.propTracks[prop].filter((k) => k.frame !== t);
            this._changed(em);
            em.render();
        },

        _currentPropValue(layer, prop) {
            switch (prop) {
                case 'x':
                    return layer.x || 0;
                case 'y':
                    return layer.y || 0;
                case 'opacity':
                    return layer.opacity != null ? layer.opacity : 1;
                case 'scale':
                    return layer.animScale != null ? layer.animScale : 1;
                case 'rotation':
                    return layer.animRotation || 0;
                case 'hue':
                    return layer.animHue || 0;
                default:
                    return 0;
            }
        },

        /** Change l'easing de toutes les clés de propriété situées à `frame`. */
        setEasingAtFrame(em, layerIndex, frame, easing) {
            const layer = em.layers[layerIndex];
            if (!layer || !layer.propTracks) return;
            const t = frame | 0;
            let touched = false;
            Object.keys(layer.propTracks).forEach((k) => {
                (layer.propTracks[k] || []).forEach((kf) => {
                    if (kf.frame === t) {
                        kf.easing = easing;
                        touched = true;
                    }
                });
            });
            if (touched) {
                this._changed(em);
                em.render();
            }
        },

        /** Y a-t-il une clé de propriété à `frame` sur ce calque ? */
        hasPropKeyAt(layer, frame) {
            if (!layer || !layer.propTracks) return false;
            const t = frame | 0;
            return Object.keys(layer.propTracks).some((k) =>
                (layer.propTracks[k] || []).some((kf) => kf.frame === t)
            );
        },

        // ---- Utilitaires panneau --------------------------------------------

        /** Y a-t-il un cel exactement à `frame` sur ce calque ? */
        hasCelAt(layer, frame) {
            return !!(layer && layer.cels && layer.cels.some((c) => c.frame === (frame | 0)));
        },

        _changed(em, kind) {
            DOC.dispatchEvent(new CustomEvent('illu:anim-changed', { detail: { kind: kind || 'edit' } }));
        }
    };

    window.IlluAnim = IlluAnim;
})();
