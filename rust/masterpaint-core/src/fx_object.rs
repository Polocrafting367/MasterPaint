//! Objet : contour d'objet (transparence) et ombre portée.

use crate::util::*;

/// Contour d'objet : p: [largeur, couleur, opacité %, mode 0=extérieur 1=intérieur 2=les deux, coin 0=rond 1=angle]
pub fn contour(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let width = p.f(0, 3.0).max(1.0) as isize;
    let color = p.rgb(1, 0xff0000);
    let opacity = clampf(p.f(2, 100.0) / 100.0, 0.0, 1.0);
    let mode = p.i(3, 0);
    let round = p.i(4, 0) == 0;
    let r2 = width * width;
    let (w, h) = (src.w as isize, src.h as isize);
    let opaque = |x: isize, y: isize| -> Option<bool> {
        if x < 0 || y < 0 || x >= w || y >= h { None } else { Some(src.d[src.idx(x as usize, y as usize) + 3] >= 128) }
    };
    for y in y0 as isize..y1 as isize {
        for x in 0..w {
            let i = src.idx(x as usize, y as usize);
            let cur = src.d[i + 3];
            let cur_op = cur >= 128;
            let mut boundary = false;
            'scan: for dy in -width..=width {
                for dx in -width..=width {
                    if round && dx * dx + dy * dy > r2 {
                        continue;
                    }
                    let n = opaque(x + dx, y + dy);
                    let hit = match mode {
                        0 => !cur_op && n == Some(true),
                        1 => cur_op && n != Some(true),
                        _ => cur_op != n.unwrap_or(false),
                    };
                    if hit {
                        boundary = true;
                        break 'scan;
                    }
                }
            }
            if !boundary {
                dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
                continue;
            }
            if opacity >= 1.0 {
                put(dst, i, color[0], color[1], color[2], 255.0);
            } else {
                let a1 = opacity;
                let a2 = cur as f32 / 255.0 * (1.0 - opacity);
                let ao = a1 + a2;
                if ao > 0.0 {
                    let f = |c: usize| (color[c] * a1 + src.d[i + c] as f32 * a2) / ao;
                    put(dst, i, f(0), f(1), f(2), ao * 255.0);
                } else {
                    dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
                }
            }
        }
    }
}

/// Ombre portée : p: [décalage x, décalage y, flou, opacité %, couleur]
pub fn drop_shadow(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let ox = p.f(0, 4.0).fround() as isize;
    let oy = p.f(1, 6.0).fround() as isize;
    let blur = p.f(2, 10.0).max(0.0);
    let op = clampf(p.f(3, 45.0) / 100.0, 0.0, 1.0);
    let col = p.rgb(4, 0x000000);
    let (w, h) = (src.w, src.h);
    // masque alpha décalé, sur une bande élargie pour le flou
    let r = (blur / 2.0).ceil() as usize;
    let (ya, yb) = band(h, y0, y1, r * 3 + 2);
    let bh = yb - ya;
    let mut mask = vec![0.0f32; w * bh];
    for y in 0..bh {
        let sy = (ya + y) as isize - oy;
        for x in 0..w {
            let sx = x as isize - ox;
            if sx >= 0 && sy >= 0 && (sx as usize) < w && (sy as usize) < h {
                mask[y * w + x] = src.d[src.idx(sx as usize, sy as usize) + 3] as f32;
            }
        }
    }
    gauss_blur_f32(&mut mask, w, bh, blur / 2.0);
    for y in y0..y1 {
        for x in 0..w {
            let i = src.idx(x, y);
            let sa = mask[(y - ya) * w + x] / 255.0 * op;
            let q = src.px(x, y);
            let fa = q[3] as f32 / 255.0;
            // composition « source par-dessus ombre »
            let oa = fa + sa * (1.0 - fa);
            if oa <= 0.0 {
                put(dst, i, 0.0, 0.0, 0.0, 0.0);
                continue;
            }
            let f = |c: usize| (q[c] as f32 * fa + col[c] * sa * (1.0 - fa)) / oa;
            put(dst, i, f(0), f(1), f(2), oa * 255.0);
        }
    }
}

/// Générateur pseudo-aléatoire (xorshift32) du remplissage.
struct Rng(u32);

impl Rng {
    fn next(&mut self) -> u32 {
        self.0 ^= self.0 << 13;
        self.0 ^= self.0 >> 17;
        self.0 ^= self.0 << 5;
        self.0
    }
    /// entier dans [-r, r]
    fn span(&mut self, r: i32) -> i32 {
        (self.next() % (2 * r as u32 + 1)) as i32 - r
    }
}

/// Remplissage de contenu (Effets › Détourage) : la zone `mask` (≥ 128 : à reconstituer) est
/// refaite à partir de ses abords. p: [extension px (0..64), fondu de bord px (0..80),
/// intensité du détail % (0..100), mode (0 texture, 1 dégradé), conserver la transparence,
/// graine]. Texture : recherche de morceaux semblables autour de la zone (PatchMatch : propagation
/// + recherche aléatoire, vote des morceaux), posée sur un fond lisse reconstitué de la
/// frontière vers l'intérieur ; Dégradé : ce fond lisse seul, avec un grain léger.
pub fn content_fill(src: &[u8], mask: &[u8], w: usize, h: usize, p: &[f32]) -> Vec<u8> {
    let p = P(p);
    let n = w * h;
    let mut out = src[..(n * 4).min(src.len())].to_vec();
    if src.len() < n * 4 || mask.len() < n || n == 0 {
        return out;
    }
    let ext = p.f(0, 0.0).clamp(0.0, 64.0);
    let feather = p.f(1, 0.0).clamp(0.0, 80.0);
    let detail = clampf(p.f(2, 100.0) / 100.0, 0.0, 1.0);
    let texture = p.i(3, 0) == 0;
    let keep_alpha = p.b(4, false);
    let mut rng = Rng((p.f(5, 1.0) as u32) | 1);
    // boîte de la zone
    let (mut x0, mut y0, mut x1, mut y1) = (w, h, 0usize, 0usize);
    for y in 0..h {
        for x in 0..w {
            if mask[y * w + x] >= 128 {
                x0 = x0.min(x);
                x1 = x1.max(x);
                y0 = y0.min(y);
                y1 = y1.max(y);
            }
        }
    }
    if x1 < x0 {
        return out;
    }
    // rectangle de travail : la zone, sa bande de fondu et de quoi y chercher des morceaux
    let grow = (ext + feather).ceil() as usize;
    let margin = grow + ((x1 - x0).max(y1 - y0) / 2).clamp(24, 256);
    let (rx0, ry0) = (x0.saturating_sub(margin), y0.saturating_sub(margin));
    let (rx1, ry1) = ((x1 + margin + 1).min(w), (y1 + margin + 1).min(h));
    let (rw, rh) = (rx1 - rx0, ry1 - ry0);
    let rn = rw * rh;
    let gi = |i: usize| (ry0 + i / rw) * w + rx0 + i % rw;
    // distance à la zone (chanfrein 3-4, en tiers de pixel)
    const FAR: u32 = u32::MAX / 4;
    let mut dist: Vec<u32> = (0..rn).map(|i| if mask[gi(i)] >= 128 { 0 } else { FAR }).collect();
    for y in 0..rh {
        for x in 0..rw {
            let i = y * rw + x;
            let mut d = dist[i];
            if x > 0 {
                d = d.min(dist[i - 1] + 3);
            }
            if y > 0 {
                d = d.min(dist[i - rw] + 3);
                if x > 0 {
                    d = d.min(dist[i - rw - 1] + 4);
                }
                if x + 1 < rw {
                    d = d.min(dist[i - rw + 1] + 4);
                }
            }
            dist[i] = d;
        }
    }
    for y in (0..rh).rev() {
        for x in (0..rw).rev() {
            let i = y * rw + x;
            let mut d = dist[i];
            if x + 1 < rw {
                d = d.min(dist[i + 1] + 3);
            }
            if y + 1 < rh {
                d = d.min(dist[i + rw] + 3);
                if x + 1 < rw {
                    d = d.min(dist[i + rw + 1] + 4);
                }
                if x > 0 {
                    d = d.min(dist[i + rw - 1] + 4);
                }
            }
            dist[i] = d;
        }
    }
    // cible (zone étendue + bande de fondu) et poids du mélange final
    let df = |i: usize| dist[i] as f32 / 3.0;
    let target: Vec<bool> = (0..rn).map(|i| df(i) <= ext + feather + 0.01).collect();
    let weight = |i: usize| {
        let d = df(i);
        if d <= ext + 0.01 {
            1.0
        } else if feather > 0.0 {
            clampf(1.0 - (d - ext) / feather, 0.0, 1.0)
        } else {
            0.0
        }
    };
    // pixels en alpha prémultiplié (0..255)
    let pm = |gidx: usize| {
        let a = src[gidx * 4 + 3] as f32;
        [src[gidx * 4] as f32 * a / 255.0, src[gidx * 4 + 1] as f32 * a / 255.0, src[gidx * 4 + 2] as f32 * a / 255.0, a]
    };
    let mut cur: Vec<[f32; 4]> = (0..rn).map(|i| pm(gi(i))).collect();
    if !target.iter().any(|t| !*t) {
        return out;
    }
    // 1) fond lisse : de la frontière vers l'intérieur (couches successives), puis lissage
    let neigh: [(isize, isize); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)];
    let at = |i: usize, dx: isize, dy: isize| {
        let (x, y) = ((i % rw) as isize + dx, (i / rw) as isize + dy);
        (x >= 0 && y >= 0 && (x as usize) < rw && (y as usize) < rh).then(|| y as usize * rw + x as usize)
    };
    let mut done: Vec<bool> = target.iter().map(|t| !*t).collect();
    let mut queued = vec![false; rn];
    let mut layer: Vec<usize> = Vec::new();
    for i in 0..rn {
        if target[i] && neigh.iter().any(|(dx, dy)| at(i, *dx, *dy).is_some_and(|j| done[j])) {
            layer.push(i);
            queued[i] = true;
        }
    }
    while !layer.is_empty() {
        let vals: Vec<[f32; 4]> = layer
            .iter()
            .map(|&i| {
                let mut acc = [0.0f32; 4];
                let mut k = 0.0f32;
                for (dx, dy) in neigh {
                    if let Some(j) = at(i, dx, dy).filter(|j| done[*j]) {
                        for c in 0..4 {
                            acc[c] += cur[j][c];
                        }
                        k += 1.0;
                    }
                }
                acc.map(|v| v / k.max(1.0))
            })
            .collect();
        let mut next = Vec::new();
        for (&i, v) in layer.iter().zip(vals) {
            cur[i] = v;
            done[i] = true;
        }
        for &i in &layer {
            for (dx, dy) in neigh {
                if let Some(j) = at(i, dx, dy).filter(|j| target[*j] && !queued[*j]) {
                    queued[j] = true;
                    next.push(j);
                }
            }
        }
        layer = next;
    }
    let tgt: Vec<usize> = (0..rn).filter(|i| target[*i]).collect();
    for _ in 0..12 {
        let upd: Vec<[f32; 4]> = tgt
            .iter()
            .map(|&i| {
                let mut acc = [0.0f32; 4];
                let mut k = 0.0f32;
                for (dx, dy) in &neigh[..4] {
                    if let Some(j) = at(i, *dx, *dy) {
                        for c in 0..4 {
                            acc[c] += cur[j][c];
                        }
                        k += 1.0;
                    }
                }
                acc.map(|v| v / k.max(1.0))
            })
            .collect();
        for (&i, v) in tgt.iter().zip(upd) {
            cur[i] = v;
        }
    }
    let base = cur.clone();
    // 2) détail : texture (morceaux pris autour) ou grain
    if texture && detail > 0.0 {
        let pr = ((x1 - x0).min(y1 - y0) / 16).clamp(2, 4) as isize;
        // morceaux entièrement connus : table des sommes de pixels inconnus
        let mut sat = vec![0u32; (rw + 1) * (rh + 1)];
        for y in 0..rh {
            let mut row = 0u32;
            for x in 0..rw {
                row += target[y * rw + x] as u32;
                sat[(y + 1) * (rw + 1) + x + 1] = sat[y * (rw + 1) + x + 1] + row;
            }
        }
        let valid = |x: isize, y: isize| {
            if x < pr || y < pr || x + pr >= rw as isize || y + pr >= rh as isize {
                return false;
            }
            let (ax, ay, bx, by) = ((x - pr) as usize, (y - pr) as usize, (x + pr + 1) as usize, (y + pr + 1) as usize);
            sat[by * (rw + 1) + bx] + sat[ay * (rw + 1) + ax] == sat[ay * (rw + 1) + bx] + sat[by * (rw + 1) + ax]
        };
        let srcs: Vec<usize> = (0..rn).filter(|i| valid((i % rw) as isize, (i / rw) as isize)).collect();
        if !srcs.is_empty() {
            let orig: Vec<[f32; 4]> = (0..rn).map(|i| pm(gi(i))).collect();
            let xy = |i: usize| ((i % rw) as isize, (i / rw) as isize);
            let dist_patch = |cur: &[[f32; 4]], t: usize, q: usize, best: f32| -> f32 {
                let ((tx, ty), (qx, qy)) = (xy(t), xy(q));
                let mut s = 0.0f32;
                for dy in -pr..=pr {
                    let (yt, yq) = (ty + dy, qy + dy);
                    if yt < 0 || yt >= rh as isize {
                        continue;
                    }
                    for dx in -pr..=pr {
                        let xt = tx + dx;
                        if xt < 0 || xt >= rw as isize {
                            continue;
                        }
                        let a = &cur[yt as usize * rw + xt as usize];
                        let b = &orig[yq as usize * rw + (qx + dx) as usize];
                        for c in 0..4 {
                            let d = a[c] - b[c];
                            s += d * d;
                        }
                    }
                    if s >= best {
                        return s;
                    }
                }
                s
            };
            let mut nnf: Vec<usize> = vec![0; rn];
            let mut cost: Vec<f32> = vec![f32::MAX; rn];
            for &t in &tgt {
                let q = srcs[rng.next() as usize % srcs.len()];
                nnf[t] = q;
                cost[t] = dist_patch(&cur, t, q, f32::MAX);
            }
            let iters = if tgt.len() > 1_500_000 { 2 } else if tgt.len() > 300_000 { 3 } else { 5 };
            let radius0 = rw.max(rh) as i32;
            for it in 0..iters {
                if crate::util::cancelled() {
                    break;
                }
                let order: Box<dyn Iterator<Item = &usize>> = if it % 2 == 0 { Box::new(tgt.iter()) } else { Box::new(tgt.iter().rev()) };
                let step: isize = if it % 2 == 0 { 1 } else { -1 };
                for &t in order {
                    let try_q = |q: usize, nnf: &mut Vec<usize>, cost: &mut Vec<f32>| {
                        let c = dist_patch(&cur, t, q, cost[t]);
                        if c < cost[t] {
                            cost[t] = c;
                            nnf[t] = q;
                        }
                    };
                    // propagation : le voisin déjà traité, décalé d'un pixel
                    for (dx, dy) in [(-step, 0), (0, -step)] {
                        if let Some(nb) = at(t, dx, dy).filter(|j| target[*j]) {
                            let (qx, qy) = xy(nnf[nb]);
                            let (cx, cy) = (qx - dx, qy - dy);
                            if valid(cx, cy) {
                                try_q(cy as usize * rw + cx as usize, &mut nnf, &mut cost);
                            }
                        }
                    }
                    // recherche aléatoire autour de la meilleure trouvaille, rayon divisé par 2
                    let mut r = radius0;
                    while r >= 1 {
                        let (qx, qy) = xy(nnf[t]);
                        let (cx, cy) = (qx + rng.span(r) as isize, qy + rng.span(r) as isize);
                        if valid(cx, cy) {
                            try_q(cy as usize * rw + cx as usize, &mut nnf, &mut cost);
                        }
                        r /= 2;
                    }
                }
                // vote : chaque pixel = moyenne des morceaux qui le recouvrent
                let voted: Vec<[f32; 4]> = tgt
                    .iter()
                    .map(|&t| {
                        let (tx, ty) = xy(t);
                        let mut acc = [0.0f32; 4];
                        let mut k = 0.0f32;
                        for dy in -pr..=pr {
                            for dx in -pr..=pr {
                                let (sx, sy) = (tx - dx, ty - dy);
                                if sx < 0 || sy < 0 || sx >= rw as isize || sy >= rh as isize {
                                    continue;
                                }
                                let s = sy as usize * rw + sx as usize;
                                if !target[s] {
                                    continue;
                                }
                                let (qx, qy) = xy(nnf[s]);
                                let v = &orig[(qy + dy) as usize * rw + (qx + dx) as usize];
                                for c in 0..4 {
                                    acc[c] += v[c];
                                }
                                k += 1.0;
                            }
                        }
                        if k > 0.0 { acc.map(|v| v / k) } else { cur[t] }
                    })
                    .collect();
                for (&t, v) in tgt.iter().zip(voted) {
                    cur[t] = v;
                }
            }
            for &t in &tgt {
                for c in 0..4 {
                    cur[t][c] = lerp(base[t][c], cur[t][c], detail);
                }
            }
        }
    } else if detail > 0.0 {
        for &t in &tgt {
            let g = ((rng.next() & 0xffff) as f32 / 65535.0 - 0.5) * 12.0 * detail;
            let a = cur[t][3] / 255.0;
            for c in 0..3 {
                cur[t][c] = (cur[t][c] + g * a).max(0.0);
            }
        }
    }
    // 3) mélange avec l'original (bande de fondu), retour en alpha droit
    for &t in &tgt {
        let wgt = weight(t);
        if wgt <= 0.0 {
            continue;
        }
        let g = gi(t);
        let o = pm(g);
        let f = cur[t];
        let mut m = [0.0f32; 4];
        for c in 0..4 {
            m[c] = lerp(o[c], f[c], wgt);
        }
        let a = if keep_alpha { src[g * 4 + 3] as f32 } else { m[3] };
        let k = if m[3] > 0.01 { 255.0 / m[3] } else { 0.0 };
        out[g * 4] = c8(m[0] * k);
        out[g * 4 + 1] = c8(m[1] * k);
        out[g * 4 + 2] = c8(m[2] * k);
        out[g * 4 + 3] = c8(a);
    }
    out
}
