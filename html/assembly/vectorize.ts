/**
 * vectorize.ts — Vectorisation bitmap (quantification couleurs, grille, masques).
 * Accès mémoire via load/store (pas de changetype sur des buffers bruts).
 */

const MAX_LABELS: i32 = 4096;

@inline
function pxOff(x: i32, y: i32, w: i32): i32 {
  return (y * w + x) << 2;
}

@inline
function loadPx(dataPtr: usize, off: i32): u8 {
  return load<u8>(dataPtr + off);
}

@inline
function colorDistSqAt(
  dataPtr: usize,
  o1: i32,
  o2: i32
): i32 {
  const dr: i32 = (loadPx(dataPtr, o1) as i32) - (loadPx(dataPtr, o2) as i32);
  const dg: i32 = (loadPx(dataPtr, o1 + 1) as i32) - (loadPx(dataPtr, o2 + 1) as i32);
  const db: i32 = (loadPx(dataPtr, o1 + 2) as i32) - (loadPx(dataPtr, o2 + 2) as i32);
  const da: i32 = (loadPx(dataPtr, o1 + 3) as i32) - (loadPx(dataPtr, o2 + 3) as i32);
  return dr * dr + dg * dg + db * db + da * da * 2;
}

@inline
function isOpaqueAt(dataPtr: usize, off: i32, minAlpha: i32): bool {
  return (loadPx(dataPtr, off + 3) as i32) >= minAlpha;
}

@inline
function colorDistSq(r1: u8, g1: u8, b1: u8, a1: u8, r2: u8, g2: u8, b2: u8, a2: u8): i32 {
  const dr: i32 = (r1 as i32) - (r2 as i32);
  const dg: i32 = (g1 as i32) - (g2 as i32);
  const db: i32 = (b1 as i32) - (b2 as i32);
  const da: i32 = (a1 as i32) - (a2 as i32);
  return dr * dr + dg * dg + db * db + da * da * 2;
}

export function labelColorRegions(
  dataPtr: usize,
  labelsPtr: usize,
  queuePtr: usize,
  palettePtr: usize,
  countsPtr: usize,
  w: i32,
  h: i32,
  tolerance: i32,
  minAlpha: i32,
  maxLabels: i32
): i32 {
  if (w < 1 || h < 1) return 0;
  const n: i32 = w * h;
  const tol2: i32 = tolerance * tolerance;
  const cap: i32 = maxLabels > MAX_LABELS ? MAX_LABELS : maxLabels;
  if (cap < 1) return 0;

  for (let i: i32 = 0; i < n; i++) {
    store<i32>(labelsPtr + (<usize>i << 2), -1);
  }
  for (let i: i32 = 0; i < cap; i++) {
    store<i32>(countsPtr + (<usize>i << 2), 0);
    const pi: i32 = i << 2;
    store<u8>(palettePtr + pi, 0);
    store<u8>(palettePtr + pi + 1, 0);
    store<u8>(palettePtr + pi + 2, 0);
    store<u8>(palettePtr + pi + 3, 0);
  }

  let numLabels: i32 = 0;

  for (let y: i32 = 0; y < h; y++) {
    for (let x: i32 = 0; x < w; x++) {
      const idx: i32 = y * w + x;
      if (load<i32>(labelsPtr + (<usize>idx << 2)) >= 0) continue;
      const o: i32 = pxOff(x, y, w);
      const r: u8 = loadPx(dataPtr, o);
      const g: u8 = loadPx(dataPtr, o + 1);
      const b: u8 = loadPx(dataPtr, o + 2);
      const a: u8 = loadPx(dataPtr, o + 3);
      if (!isOpaqueAt(dataPtr, o, minAlpha)) {
        store<i32>(labelsPtr + (<usize>idx << 2), -2);
        continue;
      }
      if (numLabels >= cap) continue;

      const label: i32 = numLabels;
      numLabels++;
      const pi: i32 = label << 2;
      store<u8>(palettePtr + pi, r);
      store<u8>(palettePtr + pi + 1, g);
      store<u8>(palettePtr + pi + 2, b);
      store<u8>(palettePtr + pi + 3, a);

      let qHead: i32 = 0;
      let qTail: i32 = 0;
      store<i32>(queuePtr + (<usize>qTail << 2), idx);
      qTail++;
      store<i32>(labelsPtr + (<usize>idx << 2), label);
      store<i32>(countsPtr + (<usize>label << 2), 1);

      while (qHead < qTail) {
        const cur: i32 = load<i32>(queuePtr + (<usize>qHead << 2));
        qHead++;
        const cx: i32 = cur % w;
        const cy: i32 = cur / w;
        for (let d: i32 = 0; d < 4; d++) {
          const nx: i32 = cx + (d == 0 ? -1 : d == 1 ? 1 : 0);
          const ny: i32 = cy + (d == 2 ? -1 : d == 3 ? 1 : 0);
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni: i32 = ny * w + nx;
          if (load<i32>(labelsPtr + (<usize>ni << 2)) != -1) continue;
          const no: i32 = pxOff(nx, ny, w);
          if (!isOpaqueAt(dataPtr, no, minAlpha)) {
            store<i32>(labelsPtr + (<usize>ni << 2), -2);
            continue;
          }
          if (colorDistSq(r, g, b, a, loadPx(dataPtr, no), loadPx(dataPtr, no + 1), loadPx(dataPtr, no + 2), loadPx(dataPtr, no + 3)) > tol2) continue;
          store<i32>(labelsPtr + (<usize>ni << 2), label);
          store<i32>(countsPtr + (<usize>label << 2), load<i32>(countsPtr + (<usize>label << 2)) + 1);
          if (qTail < n) {
            store<i32>(queuePtr + (<usize>qTail << 2), ni);
            qTail++;
          }
        }
      }
    }
  }
  return numLabels;
}

/** Détecte une grille régulière (damier). outPtr : 3×i32 [cellW, cellH, score]. */
export function detectGridCellSize(dataPtr: usize, w: i32, h: i32, outPtr: usize, minAlpha: i32): bool {
  if (w < 8 || h < 8) {
    store<i32>(outPtr, 0);
    store<i32>(outPtr + 4, 0);
    store<i32>(outPtr + 8, 0);
    return false;
  }

  let bestScore: i32 = 0;
  let bestW: i32 = 0;
  let bestH: i32 = 0;

  const minCell: i32 = 4;
  let maxCellW: i32 = w >> 2;
  let maxCellH: i32 = h >> 2;
  if (maxCellW > 128) maxCellW = 128;
  if (maxCellH > 128) maxCellH = 128;

  for (let cw: i32 = minCell; cw <= maxCellW; cw++) {
    for (let ch: i32 = minCell; ch <= maxCellH; ch++) {
      const cols: i32 = w / cw;
      const rows: i32 = h / ch;
      if (cols < 2 || rows < 2) continue;

      let uniform: i32 = 0;
      let total: i32 = 0;
      const stepGx: i32 = cols > 16 ? cols / 8 : 1;
      const stepGy: i32 = rows > 16 ? rows / 8 : 1;

      for (let gy: i32 = 0; gy < rows; gy += stepGy) {
        for (let gx: i32 = 0; gx < cols; gx += stepGx) {
          const x0: i32 = gx * cw;
          const y0: i32 = gy * ch;
          const o0: i32 = pxOff(x0, y0, w);
          if (!isOpaqueAt(dataPtr, o0, minAlpha)) continue;
          total++;
          let ok: bool = true;
          const stepX: i32 = cw > 8 ? cw >> 2 : 1;
          const stepY: i32 = ch > 8 ? ch >> 2 : 1;
          for (let sy: i32 = 0; sy < ch && ok; sy += stepY) {
            for (let sx: i32 = 0; sx < cw && ok; sx += stepX) {
              const px: i32 = x0 + sx;
              const py: i32 = y0 + sy;
              if (px >= w || py >= h) continue;
              const o: i32 = pxOff(px, py, w);
              if (colorDistSqAt(dataPtr, o0, o) > 900) ok = false;
            }
          }
          if (ok) uniform++;
        }
      }

      if (total < 4) continue;
      const score: i32 = (uniform * 1000) / total;
      if (score > bestScore) {
        bestScore = score;
        bestW = cw;
        bestH = ch;
        if (bestScore >= 980) break;
      }
    }
    if (bestScore >= 980) break;
  }

  store<i32>(outPtr, bestW);
  store<i32>(outPtr + 4, bestH);
  store<i32>(outPtr + 8, bestScore);
  return bestScore >= 920 && bestW === bestH;
}

export function extractLabelMask(
  labelsPtr: usize,
  labelId: i32,
  maskPtr: usize,
  w: i32,
  h: i32
): void {
  const n: i32 = w * h;
  for (let i: i32 = 0; i < n; i++) {
    store<u8>(maskPtr + i, load<i32>(labelsPtr + (<usize>i << 2)) == labelId ? 1 : 0);
  }
}

export function computeLabelBounds(
  labelsPtr: usize,
  labelId: i32,
  w: i32,
  h: i32,
  outPtr: usize
): i32 {
  let x0: i32 = w;
  let y0: i32 = h;
  let x1: i32 = -1;
  let y1: i32 = -1;
  let count: i32 = 0;
  const n: i32 = w * h;
  for (let i: i32 = 0; i < n; i++) {
    if (load<i32>(labelsPtr + (<usize>i << 2)) != labelId) continue;
    count++;
    const x: i32 = i % w;
    const y: i32 = i / w;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (count < 1) return 0;
  store<i32>(outPtr, x0);
  store<i32>(outPtr + 4, y0);
  store<i32>(outPtr + 8, x1 + 1);
  store<i32>(outPtr + 12, y1 + 1);
  store<i32>(outPtr + 16, count);
  return count;
}

export function sampleCellAverageColor(
  dataPtr: usize,
  w: i32,
  h: i32,
  x0: i32,
  y0: i32,
  cw: i32,
  ch: i32,
  outPtr: usize
): void {
  let sr: i32 = 0;
  let sg: i32 = 0;
  let sb: i32 = 0;
  let sa: i32 = 0;
  let n: i32 = 0;
  const x1: i32 = x0 + cw > w ? w : x0 + cw;
  const y1: i32 = y0 + ch > h ? h : y0 + ch;
  for (let y: i32 = y0; y < y1; y++) {
    for (let x: i32 = x0; x < x1; x++) {
      const o: i32 = pxOff(x, y, w);
      sr += loadPx(dataPtr, o) as i32;
      sg += loadPx(dataPtr, o + 1) as i32;
      sb += loadPx(dataPtr, o + 2) as i32;
      sa += loadPx(dataPtr, o + 3) as i32;
      n++;
    }
  }
  if (n < 1) {
    store<u8>(outPtr, 0);
    store<u8>(outPtr + 1, 0);
    store<u8>(outPtr + 2, 0);
    store<u8>(outPtr + 3, 0);
    return;
  }
  store<u8>(outPtr, (sr / n) as u8);
  store<u8>(outPtr + 1, (sg / n) as u8);
  store<u8>(outPtr + 2, (sb / n) as u8);
  store<u8>(outPtr + 3, (sa / n) as u8);
}
