/**
 * Conversion Paint.NET (.pdn) → MasterPaint
 * Basé sur le format OpenPDN : PDN3 + XML, corps .NET, puis blocs BGRA différés (MemoryBlock).
 */
(function (global) {
    'use strict';

    const PDN3 = [0x50, 0x44, 0x4e, 0x33];
    const MPDN = [0x4d, 0x50, 0x44, 0x4e];
    const MPDN_VERSION = 1;
    const MIN_CHUNK = 512;
    const MAX_CHUNK = 64 * 1024 * 1024;
    const MAX_CHUNKS = 65536;

    function readU24LE(b, o) {
        return b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
    }
    function readU32BE(b, o) {
        return (b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3];
    }
    function readU32LE(b, o) {
        return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
    }
    function readI64LE(b, o) {
        const lo = readU32LE(b, o);
        const hi = readU32LE(b, o + 4);
        return lo + hi * 0x100000000;
    }
    function writeU32LE(arr, o, v) {
        arr[o] = v & 255;
        arr[o + 1] = (v >>> 8) & 255;
        arr[o + 2] = (v >>> 16) & 255;
        arr[o + 3] = (v >>> 24) & 255;
    }
    function bytesEq(a, b, off) {
        for (let i = 0; i < b.length; i++) if (a[off + i] !== b[i]) return false;
        return true;
    }

    async function gunzip(u8) {
        if (typeof DecompressionStream === 'undefined') return null;
        try {
            const ds = new DecompressionStream('gzip');
            const ab = await new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer();
            return new Uint8Array(ab);
        } catch (_) {
            return null;
        }
    }

    async function gzip(u8) {
        if (typeof CompressionStream === 'undefined') return null;
        try {
            const cs = new CompressionStream('gzip');
            const ab = await new Response(new Blob([u8]).stream().pipeThrough(cs)).arrayBuffer();
            return new Uint8Array(ab);
        } catch (_) {
            return null;
        }
    }

    function parseHeaderXml(xml) {
        const out = { width: 0, height: 0, layers: 1, savedWithVersion: null, custom: '' };
        try {
            const doc = new DOMParser().parseFromString(xml, 'text/xml');
            const root = doc.querySelector('pdnImage');
            if (!root) return out;
            out.width = parseInt(root.getAttribute('width') || '0', 10) || 0;
            out.height = parseInt(root.getAttribute('height') || '0', 10) || 0;
            out.layers = parseInt(root.getAttribute('layers') || '1', 10) || 1;
            out.savedWithVersion = root.getAttribute('savedWithVersion');
            const custom = doc.querySelector('custom');
            if (custom) out.custom = custom.innerHTML || '';
        } catch (_) {}
        return out;
    }

    function buildHeaderXml(width, height, layerCount) {
        const w = Math.max(1, width | 0);
        const h = Math.max(1, height | 0);
        const lc = Math.max(1, layerCount | 0);
        return (
            '<?xml version="1.0" encoding="utf-8"?>' +
            `<pdnImage width="${w}" height="${h}" layers="${lc}" savedWithVersion="4.0.0.0">` +
            '<custom><masterpaint export="mpdn-v1"/></custom></pdnImage>'
        );
    }

    function bgraToImageData(bgra, width, height) {
        const w = width | 0;
        const h = height | 0;
        const n = w * h * 4;
        const rgba = new Uint8ClampedArray(n);
        const use = Math.min(bgra.length, n);
        for (let i = 0; i < use; i += 4) {
            rgba[i] = bgra[i + 2];
            rgba[i + 1] = bgra[i + 1];
            rgba[i + 2] = bgra[i];
            rgba[i + 3] = bgra[i + 3];
        }
        return new ImageData(rgba, w, h);
    }

    function imageDataToBgra(img) {
        const d = img.data;
        const bgra = new Uint8Array(d.length);
        for (let i = 0; i < d.length; i += 4) {
            bgra[i] = d[i + 2];
            bgra[i + 1] = d[i + 1];
            bgra[i + 2] = d[i];
            bgra[i + 3] = d[i + 3];
        }
        return bgra;
    }

    function parsePdn3Header(bytes) {
        if (bytes.length < 8 || !bytesEq(bytes, PDN3, 0)) {
            return { ok: false, legacyGzipOnly: bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b };
        }
        const headerLen = readU24LE(bytes, 4);
        const headerStart = 7;
        const headerEnd = headerStart + headerLen;
        if (headerEnd > bytes.length) return { ok: false, error: 'En-tête PDN tronqué' };
        const xml = new TextDecoder('utf-8').decode(bytes.subarray(headerStart, headerEnd));
        return { ok: true, headerEnd, meta: parseHeaderXml(xml), xml };
    }

    /** Cherche des tailles « length » (w×h×4) dans le flux .NET binaire */
    function scanBinaryForPixelLengths(bytes, start, end, docW, docH) {
        const set = new Set();
        const target = docW > 0 && docH > 0 ? docW * docH * 4 : 0;
        if (target > 0) set.add(target);

        const lim = Math.min(end, bytes.length);
        for (let i = start; i + 8 <= lim; i++) {
            const v64 = readI64LE(bytes, i);
            if (v64 > 0 && v64 % 4 === 0 && v64 < 512 * 1024 * 1024) {
                const px = v64 / 4;
                if (target > 0 && v64 === target) set.add(v64);
                else if (docW > 0 && docH > 0 && px === docW * docH) set.add(v64);
                else if (!target && px >= 64 && px <= 64 * 1024 * 1024) {
                    const w = Math.round(Math.sqrt(px));
                    if (w > 0 && w * Math.floor(px / w) === px) set.add(v64);
                }
            }
            if (target > 0) {
                const v32 = readU32LE(bytes, i);
                if (v32 === target) set.add(v32);
            }
        }
        return [...set].sort((a, b) => b - a);
    }

    /**
     * Parse un bloc MemoryBlock différé Paint.NET (validation stricte des chunks gzip/raw).
     */
    async function tryParseDeferredStrict(bytes, start, expectedLen) {
        if (start + 5 > bytes.length) return null;
        const fv = bytes[start];
        if (fv !== 0 && fv !== 1) return null;
        const chunkSize = readU32BE(bytes, start + 1);
        if (chunkSize < MIN_CHUNK || chunkSize > MAX_CHUNK) return null;

        const maxChunks = expectedLen > 0 && chunkSize > 0 ? Math.ceil(expectedLen / chunkSize) : MAX_CHUNKS;
        let pos = start + 5;
        const chunkMap = new Map();

        while (pos + 12 <= bytes.length && chunkMap.size < maxChunks) {
            const chunkNumber = readU32BE(bytes, pos);
            pos += 4;
            const dataSize = readU32BE(bytes, pos);
            pos += 4;
            if (dataSize === 0 || dataSize > 64 * 1024 * 1024) break;
            if (pos + dataSize > bytes.length) break;
            if (chunkMap.has(chunkNumber)) return null;

            const payload = bytes.subarray(pos, pos + dataSize);
            pos += dataSize;
            chunkMap.set(chunkNumber, payload);
        }

        if (!chunkMap.size) return null;

        const maxIdx = Math.max(...chunkMap.keys());
        const chunkCount = maxIdx + 1;
        if (chunkCount > MAX_CHUNKS || chunkCount !== chunkMap.size) return null;

        for (let i = 0; i < chunkCount; i++) {
            if (!chunkMap.has(i)) return null;
        }

        const parts = [];
        for (let i = 0; i < chunkCount; i++) {
            const payload = chunkMap.get(i);
            let raw;
            if (fv === 0) {
                raw = await gunzip(payload);
                if (!raw) return null;
            } else {
                raw = payload;
            }
            parts.push(raw);
        }

        for (let i = 0; i < chunkCount - 1; i++) {
            if (parts[i].length !== chunkSize) return null;
        }

        const lastOffset = (chunkCount - 1) * chunkSize;
        const totalLen = lastOffset + parts[parts.length - 1].length;
        if (totalLen < 16 || totalLen % 4 !== 0) return null;
        if (expectedLen > 0 && totalLen !== expectedLen) return null;

        const out = new Uint8Array(totalLen);
        for (let i = 0; i < chunkCount; i++) {
            const off = i * chunkSize;
            out.set(parts[i].subarray(0, Math.min(parts[i].length, totalLen - off)), off);
        }

        return { bgra: out, byteLength: totalLen, endOffset: pos, offset: start };
    }

    /** Enchaîne les blocs différés consécutifs (un par calque bitmap) */
    async function extractDeferredChain(bytes, start, expectedLen, maxLayers) {
        const chain = [];
        let pos = start;
        const limit = maxLayers > 0 ? maxLayers : 256;

        while (chain.length < limit && pos < bytes.length - 32) {
            const block = await tryParseDeferredStrict(bytes, pos, expectedLen);
            if (!block) break;
            chain.push(block);
            pos = block.endOffset;
        }
        return chain;
    }

    function* candidateOffsets(bytes, scanStart) {
        const end = bytes.length - 64;
        const tailFrom = Math.max(scanStart, end - 32 * 1024 * 1024);
        for (let i = end; i >= tailFrom; i--) {
            if (bytes[i] === 0 || bytes[i] === 1) yield i;
        }
        const midFrom = Math.max(scanStart, Math.floor(bytes.length * 0.5));
        for (let i = midFrom; i < end; i++) {
            if (bytes[i] === 0 || bytes[i] === 1) yield i;
        }
    }

    /** Trouve la meilleure chaîne de calques dans le fichier */
    async function findBestLayerChain(bytes, scanStart, docW, docH, layerCount) {
        const expectedLen = docW > 0 && docH > 0 ? docW * docH * 4 : 0;
        const lengths = scanBinaryForPixelLengths(bytes, scanStart, bytes.length, docW, docH);
        if (expectedLen > 0 && !lengths.includes(expectedLen)) lengths.unshift(expectedLen);

        let best = null;
        let bestScore = -1;

        const tryAt = async (startPos, lenHint) => {
            const chain = await extractDeferredChain(bytes, startPos, lenHint || 0, layerCount + 8);
            if (!chain.length) return;
            let score = chain.length * 1000;
            if (layerCount > 0 && chain.length === layerCount) score += 50000;
            else if (layerCount > 0 && chain.length >= layerCount) score += 20000;
            if (lenHint > 0 && chain.every((c) => c.byteLength === lenHint)) score += 10000;
            if (score > bestScore) {
                bestScore = score;
                best = chain;
            }
        };

        const lenHints = lengths.length ? lengths : [expectedLen, 0];
        for (const len of lenHints) {
            for (const i of candidateOffsets(bytes, scanStart)) {
                const cs = readU32BE(bytes, i + 1);
                if (cs < MIN_CHUNK || cs > MAX_CHUNK) continue;
                await tryAt(i, len);
                if (best && best.length === layerCount && bestScore > 40000) break;
            }
            if (best && best.length === layerCount) break;
        }

        if (!best || !best.length) return [];

        if (layerCount > 0 && best.length > layerCount) {
            best = best.slice(-layerCount);
        }
        return best;
    }

    /** Passe(s) d’analyse : fichier brut + flux .NET gzip éventuel */
    async function buildScanPasses(bytes, hdr) {
        const passes = [];
        const warnings = [];
        let start = hdr.headerEnd;

        if (start + 2 <= bytes.length && bytes[start] === 0 && bytes[start + 1] === 1) {
            start += 2;
        }

        if (bytesEq(bytes, MPDN, start)) {
            return { isMasterPaint: true, mpdnOffset: start, passes: [], warnings };
        }

        passes.push({ label: 'fichier', buf: bytes, from: start });

        if (hdr.headerEnd + 2 <= bytes.length && bytes[hdr.headerEnd] === 0x1f && bytes[hdr.headerEnd + 1] === 0x8b) {
            const dec = await gunzip(bytes.subarray(hdr.headerEnd));
            if (dec) {
                passes.push({ label: 'net-gzip', buf: dec, from: 0 });
                warnings.push('Analyse du corps .NET décompressé (gzip).');
            }
        }

        const tail = bytes.length - Math.min(bytes.length, 48 * 1024 * 1024);
        if (start < tail) {
            passes.push({ label: 'fin-fichier', buf: bytes, from: Math.max(start, tail) });
        }

        return { isMasterPaint: false, mpdnOffset: -1, passes, warnings };
    }

    async function parseMasterPaintExtension(bytes, offset) {
        if (offset + 10 > bytes.length || !bytesEq(bytes, MPDN, offset)) return null;
        let pos = offset + 4;
        const ver = readU32LE(bytes, pos);
        pos += 4;
        if (ver !== MPDN_VERSION) return { warning: 'Version MPDN ' + ver };
        const layerCount = readU32LE(bytes, pos);
        pos += 4;
        const layers = [];
        for (let L = 0; L < layerCount && pos + 12 <= bytes.length; L++) {
            const w = readU32LE(bytes, pos);
            pos += 4;
            const h = readU32LE(bytes, pos);
            pos += 4;
            const dataLen = readU32LE(bytes, pos);
            pos += 4;
            if (pos + dataLen > bytes.length) break;
            const chunk = bytes.subarray(pos, pos + dataLen);
            pos += dataLen;
            let bgra = chunk[0] === 0x1f && chunk[1] === 0x8b ? await gunzip(chunk) : chunk;
            if (!bgra || bgra.length < w * h * 4) continue;
            layers.push({ width: w, height: h, bgra: bgra.subarray(0, w * h * 4) });
        }
        return layers.length ? { layers } : null;
    }

    /** Dernier recours : plus grand tampon BGRA valide unique ou empilé */
    async function bruteForceSingleSurface(bytes, scanStart, docW, docH) {
        const expectedLen = docW * docH * 4;
        const all = await findBestLayerChain(bytes, scanStart, docW, docH, 999);
        const matching = expectedLen > 0 ? all.filter((c) => c.byteLength === expectedLen) : all;
        const pick = matching.length ? matching : all;
        if (!pick.length) return null;
        return pick.map((c) => ({
            width: docW,
            height: docH,
            bgra: c.bgra
        }));
    }

    async function loadFromArrayBuffer(arrayBuffer) {
        const bytes = new Uint8Array(arrayBuffer);
        const warnings = [];
        let hdr = parsePdn3Header(bytes);

        if (!hdr.ok && hdr.legacyGzipOnly) {
            const dec = await gunzip(bytes);
            if (!dec) {
                return { ok: false, error: 'Fichier PDN ancien (gzip) : décompression impossible dans ce navigateur.' };
            }
            hdr = parsePdn3Header(dec);
            if (!hdr.ok) {
                const meta = { width: 0, height: 0, layers: 1 };
                warnings.push('PDN 2.x : dimensions déduites des pixels.');
                const chain = await findBestLayerChain(dec, 0, 0, 0, 32);
                if (!chain.length) {
                    return { ok: false, error: 'PDN 2.x : aucun calque bitmap trouvé après décompression.' };
                }
                const L = chain[0];
                const px = L.byteLength / 4;
                const w = Math.round(Math.sqrt(px));
                const h = Math.floor(px / w);
                return finishImport([{ width: w, height: h, bgra: L.bgra }], w, h, warnings, meta);
            }
        }

        if (!hdr.ok) {
            return { ok: false, error: hdr.error || 'Fichier .pdn non reconnu (attendu PDN3).' };
        }

        const { width, height, layers: layerCount } = hdr.meta;
        const scanPlan = await buildScanPasses(bytes, hdr);
        warnings.push(...scanPlan.warnings);

        let pixelLayers = [];
        let bestChain = [];

        if (scanPlan.isMasterPaint) {
            const mp = await parseMasterPaintExtension(bytes, scanPlan.mpdnOffset);
            if (mp && mp.layers) {
                pixelLayers = mp.layers;
                warnings.push('Format MasterPaint MPDN.');
            }
        }

        if (!pixelLayers.length) {
            for (const pass of scanPlan.passes) {
                const chain = await findBestLayerChain(pass.buf, pass.from, width, height, layerCount);
                if (chain.length > bestChain.length) bestChain = chain;
            }

            if (bestChain.length) {
                pixelLayers = bestChain.map((c) => ({
                    width: width || 0,
                    height: height || 0,
                    bgra: c.bgra
                }));
                warnings.push(
                    bestChain.length === layerCount
                        ? `Paint.NET : ${bestChain.length} calque(s) converti(s).`
                        : `Paint.NET : ${bestChain.length} calque(s) sur ${layerCount} déclaré(s) — conversion forcée.`
                );
            }
        }

        if (!pixelLayers.length && width > 0 && height > 0) {
            for (const pass of scanPlan.passes) {
                const fallback = await bruteForceSingleSurface(pass.buf, pass.from, width, height);
                if (fallback && fallback.length) {
                    pixelLayers = fallback;
                    warnings.push('Conversion forcée (tampons bitmap extraits).');
                    break;
                }
            }
        }

        if (!pixelLayers.length) {
            return {
                ok: false,
                error:
                    'Conversion impossible : tampons bitmap Paint.NET introuvables. Vérifiez que le fichier n’est pas corrompu, ou réessayez après l’avoir rouvert dans Paint.NET.'
            };
        }

        const docW = width || inferWidth(pixelLayers[0].bgra.length);
        const docH = height || Math.floor(pixelLayers[0].bgra.length / 4 / docW);

        return finishImport(pixelLayers, docW, docH, warnings, hdr.meta);
    }

    function inferWidth(byteLen) {
        const px = byteLen / 4;
        let w = Math.round(Math.sqrt(px));
        while (w > 1 && px % w !== 0) w--;
        return Math.max(1, w);
    }

    function finishImport(pixelLayers, docW, docH, warnings, meta) {
        const W = Math.max(1, docW | 0);
        const H = Math.max(1, docH | 0);
        const imageLayers = pixelLayers.map((L, i) => {
            const w = L.width || W;
            const h = L.height || H;
            let bgra = L.bgra;
            const need = W * H * 4;
            if (bgra.length > need) bgra = bgra.subarray(0, need);
            else if (bgra.length < need) {
                const pad = new Uint8Array(need);
                pad.set(bgra);
                bgra = pad;
            }
            return {
                name: L.name || 'Calque ' + (i + 1),
                width: W,
                height: H,
                imageData: bgraToImageData(bgra, W, H)
            };
        });

        return {
            ok: true,
            width: W,
            height: H,
            layerCount: imageLayers.length,
            layers: imageLayers,
            warnings,
            meta: meta || {},
            convertedFromPaintDotNet: true
        };
    }

    async function loadFromFile(file) {
        const buf = await file.arrayBuffer();
        const result = await loadFromArrayBuffer(buf);
        if (result.ok) result.fileName = file.name;
        return result;
    }

    /** Ré-enregistre en MPDN pour réouverture rapide dans Illu */
    async function convertToMasterPaintBlob(arrayBuffer) {
        const parsed = await loadFromArrayBuffer(arrayBuffer);
        if (!parsed.ok) throw new Error(parsed.error || 'Conversion échouée');
        const em = {
            isPixelMode: true,
            width: parsed.width,
            height: parsed.height,
            layers: parsed.layers.map((L, i) => {
                const c = document.createElement('canvas');
                c.width = parsed.width;
                c.height = parsed.height;
                c.getContext('2d').putImageData(L.imageData, 0, 0);
                return { buffer: c, x: 0, y: 0, name: L.name };
            })
        };
        return exportMasterPaintPdn(em);
    }

    async function exportMasterPaintPdn(editorManager) {
        const em = editorManager;
        if (!em || !em.isPixelMode || !em.layers.length) {
            throw new Error('Export .pdn : mode pixel requis.');
        }
        const W = Math.max(1, em.width | 0);
        const H = Math.max(1, em.height | 0);
        const pixelLayers = em.layers.filter((l) => l && l.buffer);
        if (!pixelLayers.length) throw new Error('Aucun calque bitmap à exporter.');

        const headerBytes = new TextEncoder().encode(buildHeaderXml(W, H, pixelLayers.length));
        const parts = [new Uint8Array(PDN3), new Uint8Array([headerBytes.length & 255, (headerBytes.length >>> 8) & 255, (headerBytes.length >>> 16) & 255]), headerBytes, new Uint8Array([0, 1])];

        const bodyChunks = [new Uint8Array(MPDN)];
        const verBuf = new Uint8Array(4);
        writeU32LE(verBuf, 0, MPDN_VERSION);
        bodyChunks.push(verBuf);
        const lcBuf = new Uint8Array(4);
        writeU32LE(lcBuf, 0, pixelLayers.length);
        bodyChunks.push(lcBuf);

        for (const layer of pixelLayers) {
            const full = document.createElement('canvas');
            full.width = W;
            full.height = H;
            const fctx = full.getContext('2d');
            fctx.clearRect(0, 0, W, H);
            fctx.drawImage(layer.buffer, layer.x | 0, layer.y | 0);
            const bgra = imageDataToBgra(fctx.getImageData(0, 0, W, H));
            let payload = await gzip(bgra);
            if (!payload) payload = bgra;
            const wh = new Uint8Array(12);
            writeU32LE(wh, 0, W);
            writeU32LE(wh, 4, H);
            writeU32LE(wh, 8, payload.length);
            bodyChunks.push(wh, payload);
        }

        let total = 0;
        for (const p of [...parts, ...bodyChunks]) total += p.length;
        const out = new Uint8Array(total);
        let o = 0;
        for (const p of [...parts, ...bodyChunks]) {
            out.set(p, o);
            o += p.length;
        }
        return out;
    }

    // ─── Paint.NET native .pdn export (BinaryFormatter / NRBF format) ──────────

    async function exportPaintDotNetNativePdn(editorManager) {
        const em = editorManager;
        if (!em || !em.isPixelMode || !em.layers.length)
            throw new Error('Export .pdn natif : mode pixel requis.');

        const W = Math.max(1, em.width | 0);
        const H = Math.max(1, em.height | 0);
        const pixelLayers = em.layers.filter((l) => l && l.buffer);
        if (!pixelLayers.length) throw new Error('Aucun calque bitmap à exporter.');
        const N = pixelLayers.length;
        const pixLen = W * H * 4;

        const bgraLayers = [];
        for (const layer of pixelLayers) {
            const c = document.createElement('canvas');
            c.width = W; c.height = H;
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, W, H);
            ctx.drawImage(layer.buffer, layer.x | 0, layer.y | 0);
            bgraLayers.push(imageDataToBgra(ctx.getImageData(0, 0, W, H)));
        }

        const bf = [];
        const _enc = new TextEncoder();

        function w7b(v) {
            v = v >>> 0;
            while (v >= 0x80) { bf.push((v & 0x7F) | 0x80); v >>>= 7; }
            bf.push(v);
        }
        function wLPS(s) {
            const b = _enc.encode(s);
            w7b(b.length);
            for (let k = 0; k < b.length; k++) bf.push(b[k]);
        }
        function wI32(v) {
            const n = v | 0;
            bf.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255);
        }
        function wI64(v) {
            const lo = v % 0x100000000;
            const hi = Math.floor(v / 0x100000000);
            bf.push(lo & 255, (lo >>> 8) & 255, (lo >>> 16) & 255, (lo >>> 24) & 255);
            bf.push(hi & 255, (hi >>> 8) & 255, (hi >>> 16) & 255, (hi >>> 24) & 255);
        }
        function null_() { bf.push(0x0A); }
        function ref_(id) { bf.push(0x09); wI32(id); }
        function strObj(oid, s) { bf.push(0x06); wI32(oid); wLPS(s); }

        function classWT(oid, cname, members, libId) {
            bf.push(0x05); wI32(oid); wLPS(cname); wI32(members.length);
            for (const m of members) wLPS(m.name);
            for (const m of members) bf.push(m.te);
            for (const m of members) {
                if (m.te === 0) bf.push(m.ai);
                else if (m.te === 3) wLPS(m.ai);
                else if (m.te === 4) { wLPS(m.ai[0]); wI32(m.ai[1]); }
            }
            wI32(libId);
        }

        function sysClassWT(oid, cname, members) {
            bf.push(0x04); wI32(oid); wLPS(cname); wI32(members.length);
            for (const m of members) wLPS(m.name);
            for (const m of members) bf.push(m.te);
            for (const m of members) { if (m.te === 0) bf.push(m.ai); }
        }

        function cidStart(oid, metaId) { bf.push(0x01); wI32(oid); wI32(metaId); }

        const PDN_LIB = 2, SYS_LIB = 3, CORE_LIB = 54;
        const KVPAIR_T =
            'System.Collections.Generic.KeyValuePair`2[[System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089],[System.String, mscorlib, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089]][]';

        // Object IDs: 1=Doc, 2=LayerList, 3=Version, 4=ObjArray
        // Layer i: BL=5+7i, BP=6+7i, BO=7+7i, SF=8+7i, MB=9+7i, LP=10+7i, NS=11+7i
        function lids(i) {
            const b = 5 + 7 * i;
            return { BL: b, BP: b + 1, BO: b + 2, SF: b + 3, MB: b + 4, LP: b + 5, NS: b + 6 };
        }
        const L0 = lids(0);

        const xmlStr = buildHeaderXml(W, H, N);
        const xmlBytes = _enc.encode(xmlStr);
        const parts = [
            new Uint8Array([0x50, 0x44, 0x4E, 0x33]),
            new Uint8Array([xmlBytes.length & 255, (xmlBytes.length >>> 8) & 255, (xmlBytes.length >>> 16) & 255]),
            xmlBytes
        ];

        // Two-byte prefix present in all Paint.NET PDN files
        bf.push(0x00, 0x01);
        // SerializationHeaderRecord
        bf.push(0x00); wI32(1); wI32(-1); wI32(1); wI32(0);
        // BinaryLibrary records
        bf.push(0x0C); wI32(PDN_LIB); wLPS('PaintDotNet.Data, Version=4.0.0.0, Culture=neutral, PublicKeyToken=null');
        bf.push(0x0C); wI32(SYS_LIB); wLPS('System, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089');
        bf.push(0x0C); wI32(CORE_LIB); wLPS('PaintDotNet.Core, Version=4.0.0.0, Culture=neutral, PublicKeyToken=null');

        // Document #1
        classWT(1, 'PaintDotNet.Document', [
            { name: 'isDisposed', te: 0, ai: 1 },
            { name: 'layers', te: 4, ai: ['PaintDotNet.LayerList', PDN_LIB] },
            { name: 'width', te: 0, ai: 8 },
            { name: 'height', te: 0, ai: 8 },
            { name: 'savedWith', te: 3, ai: 'System.Version' },
            { name: 'userMetaData', te: 4, ai: ['System.Collections.Specialized.NameValueCollection', SYS_LIB] },
            { name: 'userMetadataItems', te: 3, ai: KVPAIR_T },
        ], PDN_LIB);
        bf.push(0); ref_(2); wI32(W); wI32(H); ref_(3); null_(); null_();

        // LayerList #2
        classWT(2, 'PaintDotNet.LayerList', [
            { name: 'parent', te: 4, ai: ['PaintDotNet.Document', PDN_LIB] },
            { name: 'ArrayList+_items', te: 5, ai: null },
            { name: 'ArrayList+_size', te: 0, ai: 8 },
            { name: 'ArrayList+_version', te: 0, ai: 8 },
        ], PDN_LIB);
        ref_(1); ref_(4); wI32(N); wI32(0);

        // System.Version #3
        sysClassWT(3, 'System.Version', [
            { name: '_Major', te: 0, ai: 8 }, { name: '_Minor', te: 0, ai: 8 },
            { name: '_Build', te: 0, ai: 8 }, { name: '_Revision', te: 0, ai: 8 },
        ]);
        wI32(4); wI32(0); wI32(0); wI32(0);

        // Object array #4
        bf.push(0x10); wI32(4); wI32(N);
        for (let i = 0; i < N; i++) ref_(lids(i).BL);

        // BitmapLayer
        classWT(L0.BL, 'PaintDotNet.BitmapLayer', [
            { name: 'properties', te: 4, ai: ['PaintDotNet.BitmapLayer+BitmapLayerProperties', PDN_LIB] },
            { name: 'surface', te: 4, ai: ['PaintDotNet.Surface', CORE_LIB] },
            { name: 'Layer+isDisposed', te: 0, ai: 1 },
            { name: 'Layer+width', te: 0, ai: 8 },
            { name: 'Layer+height', te: 0, ai: 8 },
            { name: 'Layer+properties', te: 4, ai: ['PaintDotNet.Layer+LayerProperties', PDN_LIB] },
        ], PDN_LIB);
        ref_(L0.BP); ref_(L0.SF); bf.push(0); wI32(W); wI32(H); ref_(L0.LP);
        for (let i = 1; i < N; i++) {
            const Li = lids(i);
            cidStart(Li.BL, L0.BL);
            ref_(Li.BP); ref_(Li.SF); bf.push(0); wI32(W); wI32(H); ref_(Li.LP);
        }

        // BitmapLayerProperties
        classWT(L0.BP, 'PaintDotNet.BitmapLayer+BitmapLayerProperties', [
            { name: 'blendOp', te: 4, ai: ['PaintDotNet.UserBlendOps+NormalBlendOp', PDN_LIB] },
        ], PDN_LIB);
        ref_(L0.BO);
        for (let i = 1; i < N; i++) { cidStart(lids(i).BP, L0.BP); ref_(lids(i).BO); }

        // Surface (PaintDotNet.Core)
        classWT(L0.SF, 'PaintDotNet.Surface', [
            { name: 'scan0', te: 4, ai: ['PaintDotNet.MemoryBlock', CORE_LIB] },
            { name: 'width', te: 0, ai: 8 },
            { name: 'height', te: 0, ai: 8 },
            { name: 'stride', te: 0, ai: 8 },
        ], CORE_LIB);
        ref_(L0.MB); wI32(W); wI32(H); wI32(W * 4);
        for (let i = 1; i < N; i++) {
            cidStart(lids(i).SF, L0.SF);
            ref_(lids(i).MB); wI32(W); wI32(H); wI32(W * 4);
        }

        // MemoryBlock (PaintDotNet.Core) — deferred=true → pixel data follows MessageEnd
        classWT(L0.MB, 'PaintDotNet.MemoryBlock', [
            { name: 'length64', te: 0, ai: 9 },
            { name: 'hasParent', te: 0, ai: 1 },
            { name: 'deferred', te: 0, ai: 1 },
        ], CORE_LIB);
        wI64(pixLen); bf.push(0); bf.push(1);
        for (let i = 1; i < N; i++) {
            cidStart(lids(i).MB, L0.MB);
            wI64(pixLen); bf.push(0); bf.push(1);
        }

        // Layer+LayerProperties
        classWT(L0.LP, 'PaintDotNet.Layer+LayerProperties', [
            { name: 'name', te: 1, ai: null },
            { name: 'userMetaData', te: 4, ai: ['System.Collections.Specialized.NameValueCollection', SYS_LIB] },
            { name: 'userMetadataItems', te: 3, ai: KVPAIR_T },
            { name: 'visible', te: 0, ai: 1 },
            { name: 'isBackground', te: 0, ai: 1 },
            { name: 'opacity', te: 0, ai: 2 },
        ], PDN_LIB);
        strObj(L0.NS, pixelLayers[0].name || 'Arrière-plan');
        null_(); null_();
        bf.push(1); bf.push(1); bf.push(255);
        for (let i = 1; i < N; i++) {
            cidStart(lids(i).LP, L0.LP);
            strObj(lids(i).NS, pixelLayers[i].name || ('Calque ' + (i + 1)));
            null_(); null_();
            bf.push(1); bf.push(0); bf.push(255);
        }

        // UserBlendOps+NormalBlendOp — no fields
        classWT(L0.BO, 'PaintDotNet.UserBlendOps+NormalBlendOp', [], PDN_LIB);
        for (let i = 1; i < N; i++) cidStart(lids(i).BO, L0.BO);

        // MessageEnd
        bf.push(0x0B);
        parts.push(new Uint8Array(bf));

        // Deferred pixel data — one chunk block per MemoryBlock, in layer order
        const CHUNK_SIZE = 65536;
        const useGzip = typeof CompressionStream !== 'undefined';

        for (let i = 0; i < N; i++) {
            const bgra = bgraLayers[i];
            const dHdr = new Uint8Array(5);
            dHdr[0] = useGzip ? 0 : 1;
            new DataView(dHdr.buffer).setUint32(1, CHUNK_SIZE, false);
            parts.push(dHdr);

            let offset = 0, chunkNum = 0;
            while (offset < bgra.length) {
                const end = Math.min(offset + CHUNK_SIZE, bgra.length);
                const slice = bgra.subarray(offset, end);
                const payload = useGzip ? (await gzip(slice) || slice) : slice;
                const chunkHdr = new Uint8Array(8);
                const dv = new DataView(chunkHdr.buffer);
                dv.setUint32(0, chunkNum, false);
                dv.setUint32(4, payload.length, false);
                parts.push(chunkHdr, payload);
                offset = end;
                chunkNum++;
            }
        }

        let total = 0;
        for (const p of parts) total += p.length;
        const result = new Uint8Array(total);
        let off = 0;
        for (const p of parts) { result.set(p, off); off += p.length; }
        return result;
    }

    const PdnFile = {
        loadFromFile,
        loadFromArrayBuffer,
        convertToMasterPaintBlob,
        exportMasterPaintPdn,
        exportPaintDotNetNativePdn,
        bgraToImageData,
        imageDataToBgra
    };

    if (typeof module !== 'undefined' && module.exports) module.exports = PdnFile;
    global.PdnFile = PdnFile;
})(typeof window !== 'undefined' ? window : globalThis);
