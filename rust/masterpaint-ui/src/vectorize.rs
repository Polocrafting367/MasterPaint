// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Vectoriser un bitmap (Édition › Vectoriser) : le calque actif devient un calque vectoriel,
//! un chemin par couleur. Étapes : couleurs réduites (k-moyennes sur un échantillon), taches
//! plus petites que le seuil fondues dans leur voisine, contours suivis sur les bords des pixels
//! (trous compris, remplissage pair-impair des chemins), simplifiés (Douglas-Peucker), puis
//! lissés en courbes de Bézier (Catmull-Rom) sauf aux angles vifs.

use crate::paint::ShapeStyle;
use crate::vector::{Node, ShapeObj, SubPath};

/// Réglages : nombre de couleurs, tolérance de simplification (px), plus petite tache gardée
/// (px²), courbes lissées, noir et blanc (seuil 0..255, couleurs ignorées).
#[derive(Clone, Copy, Debug)]
pub struct Opts {
    pub colors: usize,
    pub tolerance: f32,
    pub min_area: usize,
    pub smooth: bool,
    pub mono: Option<u8>,
}

/// Côté au-delà duquel l'image est réduite avant l'analyse (les coordonnées sont remises à
/// l'échelle) : 2 Mpx tracés en une ou deux secondes dans le navigateur.
const MAX_PX: usize = 2_000_000;

/// Image réduite au plus proche voisin (analyse seulement).
fn reduce(px: &[u8], w: usize, h: usize) -> (Vec<u8>, usize, usize, f32) {
    if w * h <= MAX_PX {
        return (px.to_vec(), w, h, 1.0);
    }
    let k = ((w * h) as f32 / MAX_PX as f32).sqrt();
    let (sw, sh) = (((w as f32 / k) as usize).max(1), ((h as f32 / k) as usize).max(1));
    let mut out = vec![0u8; sw * sh * 4];
    for y in 0..sh {
        let sy = (y * h / sh).min(h - 1);
        for x in 0..sw {
            let sx = (x * w / sw).min(w - 1);
            let (o, s) = ((y * sw + x) * 4, (sy * w + sx) * 4);
            out[o..o + 4].copy_from_slice(&px[s..s + 4]);
        }
    }
    (out, sw, sh, w as f32 / sw as f32)
}

/// Palette par k-moyennes (échantillon régulier, départ réparti sur la luminosité).
fn palette(px: &[u8], k: usize) -> Vec<[f32; 3]> {
    let n = px.len() / 4;
    let stride = (n / 40_000).max(1);
    let sample: Vec<[f32; 3]> = (0..n).step_by(stride).filter(|&i| px[i * 4 + 3] >= 128).map(|i| [px[i * 4] as f32, px[i * 4 + 1] as f32, px[i * 4 + 2] as f32]).collect();
    if sample.is_empty() {
        return vec![[0.0; 3]];
    }
    let mut sorted = sample.clone();
    sorted.sort_by(|a, b| (a[0] * 0.3 + a[1] * 0.59 + a[2] * 0.11).total_cmp(&(b[0] * 0.3 + b[1] * 0.59 + b[2] * 0.11)));
    let k = k.clamp(2, 64).min(sample.len());
    let mut c: Vec<[f32; 3]> = (0..k).map(|j| sorted[(j * 2 + 1) * sorted.len() / (2 * k)]).collect();
    for _ in 0..10 {
        let mut acc = vec![[0.0f64; 4]; k];
        for s in &sample {
            let j = nearest(&c, s);
            for q in 0..3 {
                acc[j][q] += s[q] as f64;
            }
            acc[j][3] += 1.0;
        }
        for j in 0..k {
            if acc[j][3] > 0.0 {
                c[j] = [(acc[j][0] / acc[j][3]) as f32, (acc[j][1] / acc[j][3]) as f32, (acc[j][2] / acc[j][3]) as f32];
            }
        }
    }
    c
}

fn nearest(c: &[[f32; 3]], s: &[f32; 3]) -> usize {
    let mut best = (f32::MAX, 0);
    for (j, p) in c.iter().enumerate() {
        let d = (p[0] - s[0]).powi(2) * 0.3 + (p[1] - s[1]).powi(2) * 0.59 + (p[2] - s[2]).powi(2) * 0.11;
        if d < best.0 {
            best = (d, j);
        }
    }
    best.1
}

/// Étiquette de couleur par pixel (u16::MAX : transparent) et palette.
pub fn labels(px: &[u8], w: usize, h: usize, o: &Opts) -> (Vec<u16>, Vec<[u8; 3]>) {
    let n = w * h;
    let mut lab = vec![u16::MAX; n];
    let pal: Vec<[f32; 3]> = match o.mono {
        Some(_) => vec![[0.0; 3], [255.0; 3]],
        None => palette(px, o.colors),
    };
    for i in 0..n {
        let p = &px[i * 4..i * 4 + 4];
        if p[3] < 128 {
            continue;
        }
        lab[i] = match o.mono {
            Some(t) => ((p[0] as u32 * 77 + p[1] as u32 * 150 + p[2] as u32 * 29) >> 8 >= t as u32) as u16,
            None => nearest(&pal, &[p[0] as f32, p[1] as f32, p[2] as f32]) as u16,
        };
    }
    despeckle(&mut lab, w, h, o.min_area);
    (lab, pal.iter().map(|c| [c[0].round() as u8, c[1].round() as u8, c[2].round() as u8]).collect())
}

/// Taches (zones connexes d'une même couleur) plus petites que `min` : prennent la couleur la
/// plus fréquente sur leur bord.
fn despeckle(lab: &mut [u16], w: usize, h: usize, min: usize) {
    if min <= 1 {
        return;
    }
    let n = w * h;
    let mut comp = vec![u32::MAX; n];
    let mut stack = Vec::new();
    let mut members = Vec::new();
    for s in 0..n {
        if comp[s] != u32::MAX || lab[s] == u16::MAX {
            continue;
        }
        let l = lab[s];
        comp[s] = s as u32;
        stack.push(s);
        members.clear();
        let mut border: Vec<(u16, u32)> = Vec::new();
        while let Some(i) = stack.pop() {
            members.push(i);
            let (x, y) = (i % w, i / w);
            let mut visit = |j: usize, comp: &mut [u32], stack: &mut Vec<usize>| {
                if lab[j] == l {
                    if comp[j] == u32::MAX {
                        comp[j] = s as u32;
                        stack.push(j);
                    }
                } else if lab[j] != u16::MAX {
                    match border.iter_mut().find(|b| b.0 == lab[j]) {
                        Some(b) => b.1 += 1,
                        None => border.push((lab[j], 1)),
                    }
                }
            };
            if x > 0 { visit(i - 1, &mut comp, &mut stack); }
            if x + 1 < w { visit(i + 1, &mut comp, &mut stack); }
            if y > 0 { visit(i - w, &mut comp, &mut stack); }
            if y + 1 < h { visit(i + w, &mut comp, &mut stack); }
        }
        if members.len() < min {
            if let Some(&(nl, _)) = border.iter().max_by_key(|b| b.1) {
                for &i in &members {
                    lab[i] = nl;
                }
            }
        }
    }
}

/// Contours (sur les bords des pixels) de la zone `inside` : anneaux fermés de sommets entiers.
/// Chaque pixel intérieur donne ses côtés qui touchent l'extérieur, orientés dans le sens horaire
/// ; aux points où deux contours se touchent en diagonale, on tourne toujours du même côté
/// (les deux pixels en diagonale restent séparés).
fn trace(inside: &dyn Fn(usize, usize) -> bool, w: usize, h: usize) -> Vec<Vec<(i32, i32)>> {
    let vw = w + 1;
    // sorties de chaque sommet : bits 0 droite, 1 bas, 2 gauche, 3 haut
    let mut out = vec![0u8; vw * (h + 1)];
    let at = |x: isize, y: isize| x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h && inside(x as usize, y as usize);
    for y in 0..h {
        for x in 0..w {
            if !inside(x, y) {
                continue;
            }
            let (xi, yi) = (x as isize, y as isize);
            if !at(xi, yi - 1) { out[y * vw + x] |= 1; }
            if !at(xi + 1, yi) { out[y * vw + x + 1] |= 2; }
            if !at(xi, yi + 1) { out[(y + 1) * vw + x + 1] |= 4; }
            if !at(xi - 1, yi) { out[(y + 1) * vw + x] |= 8; }
        }
    }
    const D: [(i32, i32); 4] = [(1, 0), (0, 1), (-1, 0), (0, -1)];
    let mut rings = Vec::new();
    for start in 0..out.len() {
        while out[start] != 0 {
            let (sx, sy) = ((start % vw) as i32, (start / vw) as i32);
            let mut dir = out[start].trailing_zeros() as usize;
            let (mut x, mut y) = (sx, sy);
            let mut ring = vec![(x, y)];
            loop {
                let v = y as usize * vw + x as usize;
                out[v] &= !(1 << dir);
                x += D[dir].0;
                y += D[dir].1;
                // retour au départ : anneau fermé (une autre sortie du point de départ fera le sien)
                if (x, y) == (sx, sy) {
                    break;
                }
                let v = y as usize * vw + x as usize;
                // tourner à droite d'abord, puis tout droit, puis à gauche
                let next = [(dir + 1) % 4, dir, (dir + 3) % 4].into_iter().find(|&d| out[v] & (1 << d) != 0);
                let Some(nd) = next else { break };
                if nd != dir {
                    ring.push((x, y));
                }
                dir = nd;
            }
            if ring.len() >= 3 {
                rings.push(ring);
            }
        }
    }
    rings
}

/// Douglas-Peucker sur un anneau fermé : coupé au point le plus loin du premier, chaque moitié
/// simplifiée.
fn simplify(r: &[(f32, f32)], tol: f32) -> Vec<(f32, f32)> {
    if r.len() < 4 || tol <= 0.0 {
        return r.to_vec();
    }
    let far = (1..r.len()).max_by(|&a, &b| d2(r[0], r[a]).total_cmp(&d2(r[0], r[b]))).unwrap_or(r.len() / 2);
    let mut closed: Vec<(f32, f32)> = r.to_vec();
    closed.push(r[0]);
    let mut keep = vec![false; closed.len()];
    keep[0] = true;
    keep[far] = true;
    dp(&closed, 0, far, tol, &mut keep);
    dp(&closed, far, closed.len() - 1, tol, &mut keep);
    (0..r.len()).filter(|&i| keep[i]).map(|i| r[i]).collect()
}

fn d2(a: (f32, f32), b: (f32, f32)) -> f32 {
    (a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)
}

fn dp(p: &[(f32, f32)], a: usize, b: usize, tol: f32, keep: &mut [bool]) {
    if b <= a + 1 {
        return;
    }
    let (pa, pb) = (p[a], p[b]);
    let (dx, dy) = (pb.0 - pa.0, pb.1 - pa.1);
    let l = (dx * dx + dy * dy).sqrt().max(1e-6);
    let mut best = (0.0f32, a);
    for i in a + 1..b {
        let d = ((p[i].0 - pa.0) * dy - (p[i].1 - pa.1) * dx).abs() / l;
        if d > best.0 {
            best = (d, i);
        }
    }
    if best.0 > tol {
        keep[best.1] = true;
        dp(p, a, best.1, tol, keep);
        dp(p, best.1, b, tol, keep);
    }
}

/// Anneau → contour de chemin : courbes de Catmull-Rom, angle vif (plus de 75°) gardé net.
fn to_sub(r: &[(f32, f32)], smooth: bool) -> SubPath {
    let n = r.len();
    let nodes = (0..n)
        .map(|i| {
            let (p0, p, p1) = (r[(i + n - 1) % n], r[i], r[(i + 1) % n]);
            if !smooth || n < 4 {
                return Node::corner(p);
            }
            let (ax, ay, bx, by) = (p.0 - p0.0, p.1 - p0.1, p1.0 - p.0, p1.1 - p.1);
            let cos = (ax * bx + ay * by) / ((ax * ax + ay * ay).sqrt() * (bx * bx + by * by).sqrt()).max(1e-6);
            if cos < 0.26 {
                return Node::corner(p);
            }
            let (tx, ty) = ((p1.0 - p0.0) / 6.0, (p1.1 - p0.1) / 6.0);
            Node { p, c_in: (p.0 - tx, p.1 - ty), c_out: (p.0 + tx, p.1 + ty), smooth: true }
        })
        .collect();
    SubPath { nodes, closed: true }
}

/// Chemins du calque vectoriel (un par couleur, du plus étendu au plus petit) et nombre de
/// points d'ancrage.
pub fn vectorize(px: &[u8], w: usize, h: usize, o: &Opts) -> (Vec<ShapeObj>, usize) {
    if w == 0 || h == 0 || px.len() < w * h * 4 {
        return (Vec::new(), 0);
    }
    let (img, sw, sh, k) = reduce(px, w, h);
    let (lab, pal) = labels(&img, sw, sh, o);
    let mut area = vec![0usize; pal.len()];
    for &l in &lab {
        if l != u16::MAX {
            area[l as usize] += 1;
        }
    }
    let mut order: Vec<usize> = (0..pal.len()).filter(|&j| area[j] > 0).collect();
    order.sort_by_key(|&j| std::cmp::Reverse(area[j]));
    let mut shapes = Vec::new();
    let mut nodes = 0;
    for j in order {
        let rings = trace(&|x, y| lab[y * sw + x] == j as u16, sw, sh);
        let subs: Vec<SubPath> = rings
            .iter()
            .filter_map(|r| {
                let pts: Vec<(f32, f32)> = r.iter().map(|&(x, y)| (x as f32 * k, y as f32 * k)).collect();
                let s = simplify(&pts, o.tolerance * k.max(1.0));
                (s.len() >= 3).then(|| to_sub(&s, o.smooth))
            })
            .collect();
        if subs.is_empty() {
            continue;
        }
        nodes += subs.iter().map(|s| s.nodes.len()).sum::<usize>();
        let c = pal[j];
        let col = [c[0], c[1], c[2], 255];
        // trait fin de la même couleur : pas de liseré clair entre deux zones voisines
        let mut s = ShapeObj {
            kind: "path".into(),
            a: (0.0, 0.0),
            b: (0.0, 0.0),
            style: ShapeStyle::Both,
            width: 1.0,
            color: col,
            points: Vec::new(),
            radius: -1.0,
            fill: Some(col),
            rot: 0.0,
            cap_start: 0,
            cap_end: 0,
            dash: 0,
            grad: None,
            subs,
        };
        s.sync_geom();
        shapes.push(s);
    }
    (shapes, nodes)
}

/// Aperçu (fenêtre de réglage) : couleurs réduites et taches fondues, en pixels.
pub fn preview(px: &[u8], w: usize, h: usize, o: &Opts) -> Vec<u8> {
    let (lab, pal) = labels(px, w, h, o);
    let mut out = vec![0u8; w * h * 4];
    for (i, &l) in lab.iter().enumerate() {
        if l != u16::MAX {
            let c = pal[l as usize];
            out[i * 4..i * 4 + 4].copy_from_slice(&[c[0], c[1], c[2], 255]);
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Carré plein percé d'un trou : un contour extérieur et un trou, aux bons sommets.
    #[test]
    fn traces_outer_ring_and_hole() {
        let (w, h) = (6, 6);
        let inside = |x: usize, y: usize| (1..5).contains(&x) && (1..5).contains(&y) && !(x == 2 && y == 2);
        let rings = trace(&inside, w, h);
        assert_eq!(rings.len(), 2, "{rings:?}");
        assert!(rings.iter().any(|r| r.contains(&(1, 1)) && r.contains(&(5, 5))));
        assert!(rings.iter().any(|r| r.contains(&(2, 2)) && r.contains(&(3, 3))));
    }

    /// Deux pixels en diagonale : deux contours séparés.
    #[test]
    fn diagonal_pixels_stay_apart() {
        let inside = |x: usize, y: usize| (x, y) == (0, 0) || (x, y) == (1, 1);
        assert_eq!(trace(&inside, 2, 2).len(), 2);
    }

    /// Image en deux couleurs : deux chemins, rien de transparent.
    #[test]
    fn two_colors_two_paths() {
        let (w, h) = (20, 10);
        let mut px = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let c = if x < 10 { [200, 30, 30, 255] } else { [20, 40, 220, 255] };
                px[(y * w + x) * 4..][..4].copy_from_slice(&c);
            }
        }
        let (shapes, _) = vectorize(&px, w, h, &Opts { colors: 2, tolerance: 0.5, min_area: 4, smooth: false, mono: None });
        assert_eq!(shapes.len(), 2);
    }
}
