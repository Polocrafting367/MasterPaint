// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Effets créatifs (2026-11) : linogravure, mosaïque hexagonale, pointillisme, vitrail, tramage
//! ordonné, sphérisation et vagues tourbillonnantes. Tous se calculent pixel par pixel à
//! partir de l'image source (cellules pseudo-aléatoires recalculées sur place) : ils se
//! découpent en bandes de lignes sur plusieurs fils, et le même pixel donne le même résultat
//! quelle que soit la bande (pas de hasard séquentiel). Bords anticrénelés partout.

use crate::util::*;

/// Couleur moyenne (alpha pondéré) autour de (cx, cy) dans un rayon `r` : 9 échantillons
/// bilinéaires, assez pour une couleur de cellule nette sans coût par pixel.
fn cell_color(src: &Img, cx: f32, cy: f32, r: f32) -> [f32; 4] {
    let mut acc = [0f32; 4];
    for oy in [-0.5f32, 0.0, 0.5] {
        for ox in [-0.5f32, 0.0, 0.5] {
            let p = src.bilinear(cx + ox * r, cy + oy * r);
            let a = p[3] / 255.0;
            acc[0] += p[0] * a;
            acc[1] += p[1] * a;
            acc[2] += p[2] * a;
            acc[3] += a;
        }
    }
    if acc[3] <= 1e-4 {
        return [0.0; 4];
    }
    [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3], acc[3] / 9.0 * 255.0]
}

/// Transition douce de 0 (x ≤ a) à 1 (x ≥ b).
#[inline]
fn sstep(a: f32, b: f32, x: f32) -> f32 {
    if b <= a {
        return if x >= b { 1.0 } else { 0.0 };
    }
    let t = clampf((x - a) / (b - a), 0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Saturation renforcée (`k` = 1 : inchangée).
#[inline]
fn saturate(c: [f32; 4], k: f32) -> [f32; 4] {
    let l = luma601(c[0], c[1], c[2]);
    [l + (c[0] - l) * k, l + (c[1] - l) * k, l + (c[2] - l) * k, c[3]]
}

// ------------------------------------------------------------------ linogravure

/// Linogravure : hachures parallèles d'encre dont l'épaisseur suit l'ombre (gravure en
/// creux sur papier), tracé légèrement tremblé comme une gouge.
/// p: [écart des traits px, angle °, contraste %, tremblé %, couleur de l'encre 0 noir 1 couleur
/// d'origine, papier 0 crème 1 blanc 2 transparent, gamma ×100]
/// Épaisseur de l'encre = 1 − L^0,6 (relevé sur Paint.NET 5.2 : moitié noire vers L = 0,3,
/// traits fins sur le jaune, rien sur le blanc).
pub fn linocut(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let gap = p.f(0, 6.0).max(2.0);
    // angle compté vers le haut (écran : y vers le bas) : 45° = « / », comme Paint.NET
    let ang = -p.f(1, 45.0).to_radians();
    let contrast = 1.0 + p.f(2, 0.0) / 100.0;
    let expo = 0.6 * (p.f(6, 100.0) / 100.0).clamp(0.2, 5.0);
    let wob = p.f(3, 40.0) / 100.0 * gap * 0.35;
    let colored = p.f(4, 0.0) > 0.5;
    let paper_k = p.i(5, 0);
    let (sn, cs) = (ang.fsin(), ang.fcos());
    let paper = if paper_k == 1 { [255.0, 255.0, 255.0] } else { [243.0, 238.0, 226.0] };
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32, y as f32);
            let s = src.px(x, y);
            let i = src.idx(x, y);
            let a = s[3] as f32 / 255.0;
            // lumière locale (un peu adoucie : moins de bruit dans les traits)
            let c = src.bilinear(xf + 0.5, yf + 0.5);
            let l = luma601(c[0], c[1], c[2]) / 255.0;
            let l = clampf((l - 0.5) * contrast + 0.5, 0.0, 1.0);
            // position perpendiculaire aux traits, tremblée le long du trait
            let along = xf * cs + yf * sn;
            let across = -xf * sn + yf * cs + wob * ((along / (gap * 3.1)).fsin() + 0.5 * (along / (gap * 1.37) + 1.7).fsin());
            let f = (across / gap).fract().abs();
            let d = (f - 0.5).abs() * 2.0; // 0 au milieu du trait, 1 entre deux traits
            // épaisseur de l'encre : nulle dans les hautes lumières, pleine dans les noirs
            let ink_w = clampf(1.0 - l.max(0.0).fpow(expo), 0.0, 1.0);
            let aa = 1.2 / gap;
            let ink = 1.0 - sstep(ink_w - aa, ink_w + aa, d);
            let ink = if l > 0.985 { 0.0 } else { ink };
            let col = if colored { [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55] } else { [8.0, 8.0, 8.0] };
            if paper_k == 2 {
                put(dst, i, col[0], col[1], col[2], ink * a * 255.0);
            } else {
                let r = paper[0] + (col[0] - paper[0]) * ink;
                let g = paper[1] + (col[1] - paper[1]) * ink;
                let b = paper[2] + (col[2] - paper[2]) * ink;
                put(dst, i, r, g, b, 255.0);
            }
        }
    }
}

// ------------------------------------------------------------------ mosaïque hexagonale

/// Centre de l'hexagone (pointe en haut) qui contient (x, y), côté `s`, et distance au bord
/// (0 au bord, ~1 au centre).
fn hex_cell(x: f32, y: f32, s: f32) -> (f32, f32, f32) {
    // coordonnées axiales fractionnaires puis arrondi cubique
    let q = (3f32.sqrt() / 3.0 * x - y / 3.0) / s;
    let r = (2.0 / 3.0 * y) / s;
    let (cx_, cz_) = (q, r);
    let cy_ = -cx_ - cz_;
    let (mut rx, ry, mut rz) = (cx_.round(), cy_.round(), cz_.round());
    let (dx, dy, dz) = ((rx - cx_).abs(), (ry - cy_).abs(), (rz - cz_).abs());
    if dx > dy && dx > dz {
        rx = -ry - rz;
    } else if dy <= dz {
        rz = -rx - ry;
    }
    let hx = s * 3f32.sqrt() * (rx + rz / 2.0);
    let hy = s * 1.5 * rz;
    // distance hexagonale normalisée au centre
    let (px, py) = ((x - hx).abs(), (y - hy).abs());
    let h = 3f32.sqrt() / 2.0 * s;
    let dist = (px / h).max((px * 0.5 + py * 3f32.sqrt() / 2.0) / h);
    (hx, hy, 1.0 - dist)
}

/// Biseau éclairé : `v` = position dans la pièce (centre → bord, longueur ~1 au bord), `e`
/// distance au bord (0 bord, 1 centre), `depth` 0..1, `l` direction de la lumière. Facteur
/// de luminosité : la face tournée vers la lumière s'éclaire, l'autre s'assombrit.
#[inline]
fn bevel(v: (f32, f32), e: f32, depth: f32, l: (f32, f32)) -> f32 {
    let band = 0.18 + 0.3 * depth;
    if depth <= 0.0 || e >= band {
        return 1.0;
    }
    let n = v.0.fhypot(v.1).max(1e-4);
    let slope = 1.0 - e / band;
    1.0 + depth * 0.9 * slope * ((v.0 * l.0 + v.1 * l.1) / n)
}

/// Direction (écran, y vers le bas) d'une lumière venant de l'angle `deg` (135 = haut gauche).
#[inline]
fn light_dir(deg: f32) -> (f32, f32) {
    let a = deg.to_radians();
    (a.fcos(), -a.fsin())
}

/// Mosaïque (comme Paint.NET 5.2) : tesselles carrées ou hexagonales de la couleur moyenne,
/// joints, biseau éclairé, variation de clarté d'une pièce à l'autre.
/// p: [taille px, joint px, joint 0 blanc 1 gris 2 noir 3 transparent, biseau %, forme 0
/// hexagone 1 carré, angle de la lumière °, variation de clarté %, graine]
pub fn hex_mosaic(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let s = p.f(0, 14.0).max(3.0);
    let joint = p.f(1, 2.0).max(0.0);
    let jk = p.i(2, 0);
    let depth = clampf(p.f(3, 35.0) / 100.0, 0.0, 1.0);
    let square = p.i(4, 0) == 1;
    let l = light_dir(p.f(5, 135.0));
    let jitter = p.f(6, 10.0) / 100.0;
    let seed = p.f(7, 0.0) as u32;
    let jc = match jk {
        1 => [128.0, 128.0, 128.0],
        2 => [24.0, 24.0, 24.0],
        _ => [250.0, 250.0, 250.0],
    };
    // demi-largeur de la pièce, en px : le joint s'y mesure
    let half = if square { s / 2.0 } else { 3f32.sqrt() / 2.0 * s };
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32 + 0.5, y as f32 + 0.5);
            let (hx, hy, e) = if square {
                let (cx, cy) = ((xf / s).floor() * s + s / 2.0, (yf / s).floor() * s + s / 2.0);
                let d = ((xf - cx).abs()).max((yf - cy).abs()) / (s / 2.0);
                (cx, cy, 1.0 - d)
            } else {
                hex_cell(xf, yf, s)
            };
            let c = cell_color(src, hx, hy, half * 1.2);
            let k = 1.0 + jitter * (rand01((hx * 7.0) as i32, (hy * 7.0) as i32, seed) - 0.5) * 2.0;
            let lit = k * bevel(((xf - hx) / half, (yf - hy) / half), e, depth, l);
            let tile = [c[0] * lit, c[1] * lit, c[2] * lit, c[3]];
            // joint de `joint` px de large (moitié de chaque côté), anticrénelé sur 1 px
            let ed = e * half; // distance au bord en px
            let t = clampf(ed - joint / 2.0 + 0.5, 0.0, 1.0);
            let i = src.idx(x, y);
            if jk == 3 {
                put(dst, i, tile[0], tile[1], tile[2], tile[3] * t);
            } else {
                put(dst, i, jc[0] + (tile[0] - jc[0]) * t, jc[1] + (tile[1] - jc[1]) * t, jc[2] + (tile[2] - jc[2]) * t, 255.0 + (tile[3] - 255.0) * t);
            }
        }
    }
}

// ------------------------------------------------------------------ pointillisme

/// Pointillisme (comme Paint.NET 5.2) : touches rondes de couleur posées en désordre (deux
/// couches), sur un fond. p: [écart des points px, remplissage de la cellule %, saturation %,
/// fond 0 blanc 1 crème 2 transparent, graine, variation de couleur %, désordre des positions %]
pub fn pointillism(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let cell = p.f(0, 12.0).max(2.0);
    let fill = clampf(p.f(1, 140.0) / 100.0, 0.3, 3.0);
    let sat = 1.0 + p.f(2, 35.0) / 100.0;
    let paper_k = p.i(3, 0);
    let seed = p.f(4, 0.0) as u32;
    let cj = p.f(5, 25.0) / 100.0 * 60.0;
    let pj = clampf(p.f(6, 100.0) / 100.0, 0.0, 1.0);
    let paper = if paper_k == 1 { [246.0, 241.0, 230.0, 255.0] } else if paper_k == 2 { [255.0, 255.0, 255.0, 0.0] } else { [255.0, 255.0, 255.0, 255.0] };
    // rayon moyen : remplissage 100 % = disque inscrit dans la cellule
    let base_r = cell * fill * 0.5;
    let reach = (base_r * 1.3 / cell).ceil() as i32 + 1;
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32 + 0.5, y as f32 + 0.5);
            let mut out = paper;
            // une seule couche, comme Paint.NET : le papier reste visible entre les touches
            for layer in 0..1u32 {
                let off = layer as f32 * 0.5 * cell;
                let gx = ((xf + off) / cell).floor() as i32;
                let gy = ((yf + off) / cell).floor() as i32;
                let sd = seed.wrapping_add(layer.wrapping_mul(0x9e37_79b9));
                // toutes les touches qui couvrent le pixel, posées dans un ordre pseudo-aléatoire
                // (le bord adouci d'une touche se fond dans celle du dessous, pas dans le papier)
                let mut hits: [(f32, [f32; 4], f32); 24] = [(0.0, [0.0; 4], 0.0); 24];
                let mut nh = 0;
                for oy in -reach..=reach {
                    for ox in -reach..=reach {
                        let (cx, cy) = (gx + ox, gy + oy);
                        let px = (cx as f32 + 0.5 + pj * (rand01(cx, cy, sd) - 0.5)) * cell - off;
                        let py = (cy as f32 + 0.5 + pj * (rand01(cx, cy, sd ^ 0x5bd1_e995) - 0.5)) * cell - off;
                        let rad = base_r * (0.8 + 0.4 * rand01(cx, cy, sd ^ 0x0bad_f00d));
                        let d = (px - xf).fhypot(py - yf);
                        if d > rad + 0.5 || nh == hits.len() {
                            continue;
                        }
                        let mut c = saturate(src.bilinear(px, py), sat);
                        for k in 0..3 {
                            c[k] += cj * (rand01(cx, cy, sd ^ (0x1111 * (k as u32 + 3))) - 0.5) * 2.0;
                        }
                        hits[nh] = (rand01(cx, cy, sd ^ 0x7f4a_7c15), c, clampf(rad + 0.5 - d, 0.0, 1.0));
                        nh += 1;
                    }
                }
                let hits = &mut hits[..nh];
                hits.sort_unstable_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(core::cmp::Ordering::Equal));
                for (_, c, cov) in hits.iter() {
                    let a = cov * c[3] / 255.0;
                    let oa = out[3] / 255.0;
                    let na = a + oa * (1.0 - a);
                    if na > 1e-4 {
                        for k in 0..3 {
                            out[k] = (c[k] * a + out[k] * oa * (1.0 - a)) / na;
                        }
                    }
                    out[3] = na * 255.0;
                }
            }
            put(dst, src.idx(x, y), out[0], out[1], out[2], out[3]);
        }
    }
}

// ------------------------------------------------------------------ vitrail

/// Vitrail (comme Paint.NET 5.2) : pièces de Voronoï, plomb anticrénelé dont la largeur est
/// une part de la pièce, verre biseauté éclairé d'un côté. p: [taille des pièces px, plomb %
/// de la pièce, biseau %, plomb 0 noir 1 gris 2 blanc, graine, angle de la lumière °, couleur
/// de la pièce 0 moyenne 1 centre]
pub fn stained_glass(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let cell = p.f(0, 22.0).max(4.0);
    let lead = (p.f(1, 15.0) / 100.0).max(0.0) * cell * 0.5;
    let depth = clampf(p.f(2, 50.0) / 100.0, 0.0, 1.0);
    let lk = p.i(3, 0);
    let seed = p.f(4, 0.0) as u32;
    let l = light_dir(p.f(5, 135.0));
    let center_color = p.i(6, 0) == 1;
    let lc = match lk {
        1 => [90.0, 90.0, 90.0],
        2 => [245.0, 245.0, 245.0],
        _ => [10.0, 10.0, 10.0],
    };
    let site = |gx: i32, gy: i32| -> (f32, f32) {
        let jx = 0.1 + 0.8 * rand01(gx, gy, seed);
        let jy = 0.1 + 0.8 * rand01(gx, gy, seed ^ 0x5bd1_e995);
        ((gx as f32 + jx) * cell, (gy as f32 + jy) * cell)
    };
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32 + 0.5, y as f32 + 0.5);
            let gx = (xf / cell).floor() as i32;
            let gy = (yf / cell).floor() as i32;
            let (mut b1, mut d1, mut d2) = ((0.0, 0.0), f32::MAX, f32::MAX);
            let mut sites = [(0f32, 0f32); 25];
            let mut k = 0;
            for oy in -2..=2 {
                for ox in -2..=2 {
                    let s = site(gx + ox, gy + oy);
                    sites[k] = s;
                    k += 1;
                    let d = (s.0 - xf) * (s.0 - xf) + (s.1 - yf) * (s.1 - yf);
                    if d < d1 {
                        d1 = d;
                        b1 = s;
                    }
                }
            }
            // distance exacte au bord de la pièce : projection sur les médiatrices
            for s in sites.iter() {
                if *s == b1 {
                    continue;
                }
                let (mx, my) = ((b1.0 + s.0) / 2.0, (b1.1 + s.1) / 2.0);
                let (nx, ny) = (s.0 - b1.0, s.1 - b1.1);
                let nl = nx.fhypot(ny).max(1e-6);
                let e = ((mx - xf) * nx + (my - yf) * ny) / nl;
                d2 = d2.min(e);
            }
            let c = if center_color { src.bilinear(b1.0, b1.1) } else { cell_color(src, b1.0, b1.1, cell * 0.55) };
            // biseau : distance au plomb rapportée à la demi-pièce
            let half = cell * 0.5;
            let e = clampf((d2 - lead) / half, 0.0, 1.0);
            let lit = bevel(((xf - b1.0) / half, (yf - b1.1) / half), e, depth, l);
            let glass = [c[0] * lit, c[1] * lit, c[2] * lit];
            let t = clampf(d2 - lead + 0.5, 0.0, 1.0);
            let i = src.idx(x, y);
            put(dst, i, lc[0] + (glass[0] - lc[0]) * t, lc[1] + (glass[1] - lc[1]) * t, lc[2] + (glass[2] - lc[2]) * t, 255.0 + (c[3] - 255.0) * t);
        }
    }
}

// ------------------------------------------------------------------ tramage ordonné

/// Matrice de Bayer n × n (n = 2, 4, 8), valeurs normalisées dans ]0, 1[.
fn bayer(n: usize, x: usize, y: usize) -> f32 {
    // M₂ = [[0, 2], [3, 1]] ; M₂ₙ = 4·Mₙ + M₂ : le bit de poids faible des coordonnées donne
    // le chiffre de poids fort
    let mut v = 0usize;
    for k in 0..n.trailing_zeros() {
        let (bx, by) = ((x >> k) & 1, (y >> k) & 1);
        v = v * 4 + (2 * (bx ^ by) + by);
    }
    (v as f32 + 0.5) / (n * n) as f32
}

/// Tramage ordonné (Bayer) : niveaux par canal, matrice agrandie (pixel art).
/// p: [matrice 2/4/8, niveaux 2..16, échelle px, mode 0 couleur 1 noir & blanc 2 deux couleurs
/// (encre/papier), force %]
pub fn ordered_dither(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let n = match p.i(0, 4) {
        2 => 2,
        8 => 8,
        _ => 4,
    };
    let levels = p.f(1, 2.0).clamp(2.0, 16.0) - 1.0;
    let scale = p.f(2, 1.0).max(1.0) as usize;
    let mode = p.i(3, 0);
    let strength = clampf(p.f(4, 100.0) / 100.0, 0.0, 1.0);
    for y in y0..y1 {
        for x in 0..src.w {
            let s = src.px(x, y);
            let t = bayer(n, (x / scale) % n, (y / scale) % n) - 0.5;
            let q = |v: f32| -> f32 { (((v / 255.0) * levels + t * strength).round().clamp(0.0, levels) / levels) * 255.0 };
            let (r, g, b) = (s[0] as f32, s[1] as f32, s[2] as f32);
            let i = src.idx(x, y);
            match mode {
                1 | 2 => {
                    let l = q(luma601(r, g, b));
                    if mode == 2 {
                        // encre bleu nuit sur papier crème (deux tons)
                        let k = l / 255.0;
                        put(dst, i, 28.0 + (240.0 - 28.0) * k, 32.0 + (232.0 - 32.0) * k, 62.0 + (214.0 - 62.0) * k, s[3] as f32);
                    } else {
                        put(dst, i, l, l, l, s[3] as f32);
                    }
                }
                _ => put(dst, i, q(r), q(g), q(b), s[3] as f32),
            }
        }
    }
}

// ------------------------------------------------------------------ sphériser

/// Sphériser (comme Photoshop) : la zone ronde se bombe (quantité > 0) ou se creuse.
/// p: [quantité −100..100, rayon %, mode 0 normal 1 horizontal 2 vertical, centre x %, centre y %]
pub fn spherize(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let amt = clampf(p.f(0, 100.0) / 100.0, -1.0, 1.0);
    let (w, h) = (src.w as f32, src.h as f32);
    let rad = (p.f(1, 100.0) / 100.0).max(0.05) * w.min(h) / 2.0;
    let mode = p.i(2, 0);
    let (cx, cy) = (p.f(3, 50.0) / 100.0 * w, p.f(4, 50.0) / 100.0 * h);
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32 + 0.5, y as f32 + 0.5);
            let (mut dx, mut dy) = ((xf - cx) / rad, (yf - cy) / rad);
            if mode == 1 {
                dy = 0.0;
            } else if mode == 2 {
                dx = 0.0;
            }
            let r = dx.fhypot(dy);
            let i = src.idx(x, y);
            if r >= 1.0 || r <= 1e-6 {
                let s = src.px(x, y);
                dst[i..i + 4].copy_from_slice(&s);
                continue;
            }
            // profil de sphère : bombé = asin, creusé = sin ; fondu par la quantité
            let bulge = (r.asin() / core::f32::consts::FRAC_PI_2) / r;
            let pinch = ((r * core::f32::consts::FRAC_PI_2).fsin()) / r;
            let k = if amt >= 0.0 { 1.0 + (bulge - 1.0) * amt } else { 1.0 + (pinch - 1.0) * -amt };
            // bord adouci : aucune cassure au cercle
            let k = 1.0 + (k - 1.0) * (1.0 - sstep(0.92, 1.0, r));
            let (sx, sy) = match mode {
                1 => (cx + (xf - cx) * k - 0.5, yf - 0.5),
                2 => (xf - 0.5, cy + (yf - cy) * k - 0.5),
                _ => (cx + (xf - cx) * k - 0.5, cy + (yf - cy) * k - 0.5),
            };
            let o = src.bilinear(sx, sy);
            put(dst, i, o[0], o[1], o[2], o[3]);
        }
    }
}

// ------------------------------------------------------------------ vagues tourbillonnantes

/// Vagues : tourbillon autour du centre et ondulations concentriques (pétales qui
/// s'enroulent). p: [tourbillon °, amplitude px, longueur d'onde px, rayon %, ondes radiales %]
pub fn swirl_waves(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let twirl = p.f(0, 220.0).to_radians();
    let amp = p.f(1, 10.0);
    let wl = p.f(2, 40.0).max(4.0);
    let (w, h) = (src.w as f32, src.h as f32);
    let rmax = (p.f(3, 100.0) / 100.0).max(0.05) * w.fhypot(h) / 2.0;
    let radial = p.f(4, 50.0) / 100.0;
    let (cx, cy) = (w / 2.0, h / 2.0);
    let tau = core::f32::consts::TAU;
    for y in y0..y1 {
        for x in 0..src.w {
            let (xf, yf) = (x as f32 + 0.5, y as f32 + 0.5);
            let (dx, dy) = (xf - cx, yf - cy);
            let r = dx.fhypot(dy);
            let f = clampf(1.0 - r / rmax, 0.0, 1.0);
            let f2 = f * f * (3.0 - 2.0 * f);
            let th = dy.fatan2(dx);
            // ondulation angulaire (les vagues) puis tourbillon plus fort au centre
            let wave = amp * (r / wl * tau).fsin() * f2;
            let th2 = th + twirl * f2 + wave / r.max(8.0);
            let r2 = r + radial * amp * (th * 6.0 + r / wl * tau * 0.5).fsin() * f2;
            let (sx, sy) = (cx + r2 * th2.fcos() - 0.5, cy + r2 * th2.fsin() - 0.5);
            let o = src.bilinear(sx, sy);
            put(dst, src.idx(x, y), o[0], o[1], o[2], o[3]);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bayer4_is_a_permutation() {
        let mut v: Vec<u32> = (0..16).map(|k| (bayer(4, k % 4, k / 4) * 16.0 - 0.5).round() as u32).collect();
        v.sort_unstable();
        assert_eq!(v, (0..16).collect::<Vec<u32>>());
    }

    #[test]
    fn hex_cell_center_is_inside() {
        let (hx, hy, e) = hex_cell(100.0, 80.0, 12.0);
        assert!((hx - 100.0).abs() <= 12.0 && (hy - 80.0).abs() <= 12.0);
        assert!((0.0..=1.0).contains(&e));
    }
}
