'use strict';

/**
 * Custom Content-Aware Fill Worker - COHERENT INPAINTING EDITION
 * Implémentation du système de synthèse de texture intelligente (PatchMatch hybride)
 */


self.onmessage = async function (ev) {
    const msg = ev && ev.data ? ev.data : {};
    if (msg.type !== 'runCaf') return;

    const jobId = msg.jobId | 0;
    const w = msg.width | 0;
    const h = msg.height | 0;
    const mode = msg.mode || 'texture'; 
    const preserveTransparency = !!msg.preserveTransparency;
    const power = msg.opacity !== undefined ? (Math.max(0, Math.min(100, Number(msg.opacity))) / 100) : 1.0;

    const source = new Uint8ClampedArray(msg.sourceBuffer);
    const mask = new Uint8Array(msg.maskBuffer);

    function emitProgress(pct, msgText) {
        self.postMessage({ type: 'progress', jobId, pct, message: msgText });
    }

    try {
        const out = new Uint8ClampedArray(source);
        const expandPx = Math.max(0, Math.min(128, msg.expandPx | 0));

        const hasWork = new Uint8Array(mask.length);
        let count = 0;

        // Étape 1 : Création du masque
        for (let i = 0; i < mask.length; i++) {
            if (mask[i]) {
                if (preserveTransparency && source[i * 4 + 3] === 0) continue;
                hasWork[i] = 1;
                count++;
            }
        }

        if (count === 0) {
            self.postMessage({ type: 'result', jobId, resultBuffer: source.buffer }, [source.buffer]);
            return;
        }

        // Étape 2 : Dilatation automatique
        if (expandPx > 0) {
            emitProgress(5, 'Extension de la sélection…');
            const dilatedWork = new Uint8Array(w * h);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (hasWork[y * w + x]) {
                        for (let dy = -expandPx; dy <= expandPx; dy++) {
                            for (let dx = -expandPx; dx <= expandPx; dx++) {
                                if (dx * dx + dy * dy > expandPx * expandPx) continue;
                                const ny = y + dy, nx = x + dx;
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    dilatedWork[ny * w + nx] = 1;
                                }
                            }
                        }
                    }
                }
            }
            hasWork.set(dilatedWork);

            count = 0;
            for (let i = 0; i < hasWork.length; i++) {
                if (hasWork[i]) count++;
            }
        }


        // --- NOUVEAU MOTEUR INTELLIGENT (COHERENT TEXTURE SYNTHESIS) ---
        if (mode === 'texture' || mode === 'harmonic') {
            emitProgress(10, 'Analyse des textures disponibles (IA)…');

            // Taille du bloc de texture à cloner (de 5x5 px à 11x11 px selon la "puissance")
            const patchRadius = Math.max(2, Math.floor(2 + power * 3)); 
            const randomCandidatesCount = Math.floor(15 + power * 40); // Nombre d'essais aléatoires en plus des voisins

            // 1. On cherche les "bons" pixels sources (les centres de patch qui ne mordent pas sur le trou)
            const invalidSrc = new Uint8Array(w * h);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    if (hasWork[y * w + x]) {
                        for (let dy = -patchRadius; dy <= patchRadius; dy++) {
                            for (let dx = -patchRadius; dx <= patchRadius; dx++) {
                                const ny = y + dy, nx = x + dx;
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                                    invalidSrc[ny * w + nx] = 1;
                                }
                            }
                        }
                    }
                }
            }

            const validCoords = [];
            for (let y = patchRadius; y < h - patchRadius; y++) {
                for (let x = patchRadius; x < w - patchRadius; x++) {
                    // Les sources doivent être visibles (alpha > 50) et hors du trou élargi
                    if (!invalidSrc[y * w + x] && source[(y * w + x) * 4 + 3] > 50) {
                        validCoords.push((y << 16) | x); // Optimisation mémoire : on emballe X et Y dans un seul int
                    }
                }
            }

            if (validCoords.length === 0) {
                throw new Error("Pas assez de contexte (pixels sains) autour de la zone pour cloner la texture de manière intelligente. Réduisez l'extension de la sélection.");
            }

            // 2. Traçage des remplissages
            const known = new Uint8Array(w * h);
            for (let i = 0; i < w * h; i++) known[i] = hasWork[i] ? 0 : 1;

            // On mémorise de quelle coordonnée (source) provient chaque pixel
            const srcCoord = new Int32Array(w * h);
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    srcCoord[y * w + x] = (y << 16) | x;
                }
            }

            let holePixelsLeft = count;
            let passes = 0;
            const maxPasses = w * h; // Sécurité boucle infinie

            emitProgress(20, 'Synthèse de texture par propagation spatiale…');

            // Boucle principale : on grignote le trou depuis les bords vers le centre
            while (holePixelsLeft > 0 && passes < maxPasses) {
                passes++;
                
                // On cherche tous les pixels au bord du trou
                const boundary = [];
                for (let y = 0; y < h; y++) {
                    for (let x = 0; x < w; x++) {
                        if (!known[y * w + x]) {
                            let knownCount = 0;
                            if (y > 0 && known[(y - 1) * w + x]) knownCount++;
                            if (y < h - 1 && known[(y + 1) * w + x]) knownCount++;
                            if (x > 0 && known[y * w + (x - 1)]) knownCount++;
                            if (x < w - 1 && known[y * w + (x + 1)]) knownCount++;

                            if (knownCount > 0) {
                                // Plus un pixel a de voisins sains, plus il est prioritaire
                                boundary.push({ x, y, idx: y * w + x, priority: knownCount });
                            }
                        }
                    }
                }

                if (boundary.length === 0) break;

                // Tri : on commence par les angles et crevasses (Inpainting de Criminisi)
                boundary.sort((a, b) => b.priority - a.priority);

                // Pour ne pas freezer totalement, on traite par petits lots (chunks)
                const processCount = Math.min(boundary.length, 1200);

                for (let i = 0; i < processCount; i++) {
                    const p = boundary[i];
                    if (known[p.idx]) continue; 

                    const candidates = [];

                    // A. Cohérence spatiale : l'IA déduit que si le pixel d'à côté a été rempli 
                    // avec un morceau de ciel, on devrait probablement continuer le même ciel.
                    for (let dy = -1; dy <= 1; dy++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            if (dx === 0 && dy === 0) continue;
                            const nx = p.x + dx, ny = p.y + dy;
                            if (nx >= 0 && nx < w && ny >= 0 && ny < h && known[ny * w + nx]) {
                                const sPacked = srcCoord[ny * w + nx];
                                const sy = sPacked >> 16, sx = sPacked & 0xFFFF;
                                const candX = sx - dx, candY = sy - dy;
                                
                                if (candX >= patchRadius && candX < w - patchRadius && candY >= patchRadius && candY < h - patchRadius) {
                                    if (!invalidSrc[candY * w + candX]) {
                                        candidates.push((candY << 16) | candX);
                                    }
                                }
                            }
                        }
                    }

                    // B. Hasard : on ajoute des candidats aléatoires au cas où on trouve mieux ailleurs
                    for (let rc = 0; rc < randomCandidatesCount; rc++) {
                        const rIdx = Math.floor(Math.random() * validCoords.length);
                        candidates.push(validCoords[rIdx]);
                    }

                    let bestCand = -1;
                    let minErr = Infinity;

                    // C. Évaluation : quel candidat "colle" le mieux avec les pixels déjà remplis autour du trou ?
                    for (let c = 0; c < candidates.length; c++) {
                        const candPacked = candidates[c];
                        const cy = candPacked >> 16, cx = candPacked & 0xFFFF;
                        let err = 0;
                        let validPixels = 0;

                        // Sum of Squared Differences (SSD)
                        for (let dy = -patchRadius; dy <= patchRadius; dy++) {
                            for (let dx = -patchRadius; dx <= patchRadius; dx++) {
                                const nx = p.x + dx, ny = p.y + dy;
                                if (nx >= 0 && nx < w && ny >= 0 && ny < h && known[ny * w + nx]) {
                                    const nIdx = (ny * w + nx) * 4;
                                    const cIdx = ((cy + dy) * w + (cx + dx)) * 4;
                                    
                                    const dr = out[nIdx] - source[cIdx];
                                    const dg = out[nIdx + 1] - source[cIdx + 1];
                                    const db = out[nIdx + 2] - source[cIdx + 2];
                                    
                                    err += dr * dr + dg * dg + db * db;
                                    validPixels++;
                                }
                            }
                        }
                        if (validPixels > 0) {
                            err /= validPixels;
                            if (err < minErr) {
                                minErr = err;
                                bestCand = candPacked;
                            }
                        }
                    }

                    // D. Remplissage avec le meilleur candidat trouvé
                    if (bestCand !== -1) {
                        const cy = bestCand >> 16, cx = bestCand & 0xFFFF;
                        const srcIdx = (cy * w + cx) * 4;
                        const dstIdx = p.idx * 4;
                        out[dstIdx] = source[srcIdx];
                        out[dstIdx + 1] = source[srcIdx + 1];
                        out[dstIdx + 2] = source[srcIdx + 2];
                        out[dstIdx + 3] = 255;
                        srcCoord[p.idx] = bestCand;
                        known[p.idx] = 1;
                        holePixelsLeft--;
                    } else {
                        // Cas extrêmement rare, évite une boucle infinie
                        known[p.idx] = 1;
                        holePixelsLeft--;
                    }
                }

                // Mise à jour de la jauge de progression
                if (passes % 3 === 0) {
                    const pct = 20 + ((count - holePixelsLeft) / count) * 70;
                    emitProgress(pct, `Reconstruction en cours (${holePixelsLeft} px restants)…`);
                }
            }
            
            // 3. Lissage final des raccords pour enlever l'effet "blocs"
            emitProgress(92, 'Lissage final des raccords…');
            const finalOut = new Uint8ClampedArray(out);
            for (let y = 1; y < h - 1; y++) {
                for (let x = 1; x < w - 1; x++) {
                    if (hasWork[y * w + x]) {
                        const d = (y * w + x) * 4;
                        const up = ((y - 1) * w + x) * 4;
                        const dn = ((y + 1) * w + x) * 4;
                        const lt = (y * w + (x - 1)) * 4;
                        const rt = (y * w + (x + 1)) * 4;
                        finalOut[d] = (out[d]*2 + out[up] + out[dn] + out[lt] + out[rt]) / 6;
                        finalOut[d+1] = (out[d+1]*2 + out[up+1] + out[dn+1] + out[lt+1] + out[rt+1]) / 6;
                        finalOut[d+2] = (out[d+2]*2 + out[up+2] + out[dn+2] + out[lt+2] + out[rt+2]) / 6;
                    }
                }
            }
            out.set(finalOut);
        }

        // --- ALGORITHMES TRADITIONNELS (ÉTIREMENTS) ---
        else if (mode === 'stretch' || mode === 'stretch-v' || mode === 'stretch-h') {
            emitProgress(30, 'Remplissage par étirement linéaire…');
            const isV = mode === 'stretch-v';
            const isH = mode === 'stretch-h';
            const isStar = mode === 'stretch';

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    if (!hasWork[i]) continue;

                    let rt = 0, gt = 0, bt = 0, at = 0, totalWeight = 0;
                    const dirs = [];
                    if (isStar || isV) { dirs.push([0, 1]); dirs.push([0, -1]); }
                    if (isStar || isH) { dirs.push([1, 0]); dirs.push([-1, 0]); }

                    for (const [dx, dy] of dirs) {
                        let tx = x + dx, ty = y + dy;
                        let dist = 1;
                        while (tx >= 0 && tx < w && ty >= 0 && ty < h) {
                            if (!hasWork[ty * w + tx]) {
                                const s = (ty * w + tx) * 4;
                                const weight = 1 / dist;
                                rt += source[s] * weight; gt += source[s + 1] * weight;
                                bt += source[s + 2] * weight; at += source[s + 3] * weight;
                                totalWeight += weight;
                                break;
                            }
                            tx += dx; ty += dy;
                            dist++;
                        }
                    }
                    if (totalWeight > 0) {
                        const d = i * 4;
                        out[d] = rt / totalWeight; out[d + 1] = gt / totalWeight;
                        out[d + 2] = bt / totalWeight; out[d + 3] = at / totalWeight;
                    }
                }
            }
        }

        // --- FONDU DE BORD (innerRadius) ---
        const innerRadius = Math.max(0, Math.min(200, msg.innerRadius | 0));
        if (innerRadius > 0) {
            emitProgress(96, 'Fondu de bord (innerRadius)…');
            // Distance transform chamfer (approx BFS) : dist[i] = distance du px rempli au bord (non-rempli)
            const dist = new Float32Array(w * h);
            for (let i = 0; i < w * h; i++) dist[i] = hasWork[i] ? 999999 : 0;
            // Passe avant (↘)
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    const i = y * w + x;
                    if (!hasWork[i]) continue;
                    if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
                    if (y > 0) dist[i] = Math.min(dist[i], dist[i - w] + 1);
                }
            }
            // Passe arrière (↖)
            for (let y = h - 1; y >= 0; y--) {
                for (let x = w - 1; x >= 0; x--) {
                    const i = y * w + x;
                    if (!hasWork[i]) continue;
                    if (x < w - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
                    if (y < h - 1) dist[i] = Math.min(dist[i], dist[i + w] + 1);
                }
            }
            // Blending : pixels proches du bord (dist < innerRadius) → mélangés avec l'original
            for (let i = 0; i < w * h; i++) {
                if (!hasWork[i]) continue;
                const d = dist[i];
                const alpha = d >= innerRadius ? 1.0 : d / innerRadius;
                if (alpha >= 1.0) continue;
                const si = i * 4;
                out[si]   = Math.round(source[si]   * (1 - alpha) + out[si]   * alpha);
                out[si+1] = Math.round(source[si+1] * (1 - alpha) + out[si+1] * alpha);
                out[si+2] = Math.round(source[si+2] * (1 - alpha) + out[si+2] * alpha);
                out[si+3] = Math.round(source[si+3] * (1 - alpha) + out[si+3] * alpha);
            }
        }

        self.postMessage({ type: 'result', jobId, resultBuffer: out.buffer }, [out.buffer]);

    } catch (e) {
        self.postMessage({ type: 'error', jobId, message: e.message || String(e) });
    }
};