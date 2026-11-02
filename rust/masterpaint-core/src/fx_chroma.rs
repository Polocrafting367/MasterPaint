//! Incrustation (chroma key CIELAB) — départ : js/effects/ChromaKeyer.js (`computeMatte`,
//! `applyUnmix`, `applyDespill`), complété comme un keyer de compositing : seconde couleur
//! avec sa propre tolérance, opérations sur le masque (nettoyer le fond, remplir les trous,
//! rétrécir / étendre, plume), suppression du débordement à trois méthodes avec couleur de
//! remplacement, correction des bords, ombres conservées, inversion, vues de contrôle.
//!
//! Paramètres :
//!  0 kr  1 kg  2 kb  3 tolérance  4 drift  5 feather  6 clipBlack  7 clipWhite  8 gamma
//!  9 spill  10 recover  11 lumaProt  12 useKey2  13 kr2  14 kg2  15 kb2  16 mode
//!  17 choke px (+ rétrécit, − étend)  18 plume px  19 nettoyer le fond px  20 remplir les trous px
//!  21 tolérance de la 2e couleur (0 : la même)  22 méthode du débordement (0 moyenne, 1 limite,
//!  2 double limite)  23 remplacement (0 aucun, 1 gris neutre, 2 couleur)  24-26 couleur de
//!  remplacement  27 correction des bords %  28 vue (0 résultat, 1 masque, 2 original,
//!  3 damier, 4 noir, 5 blanc, 6 couleur)  29-31 couleur de la vue 6  32 ombres conservées %
//!  33 inverser le masque
//! Les 17 premiers gardent leur sens d'origine : un tableau de 17 valeurs (réglages enregistrés,
//! Répéter) donne le même résultat qu'avant, sauf « récupération des détails », désormais
//! appliquée aussi en mode 0.
//! mode 0 : alpha ← round(alpha × masque) ; mode 1 : alpha ← round(255 × masque).
//! Opérations de voisinage : chaque bande calcule son masque avec une marge égale au rayon
//! cumulé des opérations, d'où un résultat identique en bandes ou d'un seul morceau.

use crate::util::*;

const LAB_K: f64 = 24389.0 / 27.0;
const LAB_E: f64 = 216.0 / 24389.0;

fn lin(c: f64) -> f64 {
    let c = c / 255.0;
    if c > 0.04045 { ((c + 0.055) / 1.055).powf(2.4) } else { c / 12.92 }
}

/// sRGB → linéaire pour les 256 valeurs entières (identique à `lin`, calculé une fois).
fn lin_table() -> [f64; 256] {
    let mut t = [0.0; 256];
    for (i, v) in t.iter_mut().enumerate() {
        *v = lin(i as f64);
    }
    t
}

fn rgb_to_lab(r: f64, g: f64, b: f64) -> [f64; 3] {
    lin3_to_lab(lin(r), lin(g), lin(b))
}

fn lin3_to_lab(rl: f64, gl: f64, bl: f64) -> [f64; 3] {
    let x = (rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047;
    let y = rl * 0.2126 + gl * 0.7152 + bl * 0.0722;
    let z = (rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883;
    let f = |t: f64| if t > LAB_E { t.powf(1.0 / 3.0) } else { (LAB_K * t + 16.0) / 116.0 };
    let (fx, fy, fz) = (f(x), f(y), f(z));
    [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)]
}

struct Key {
    lab_k: [f64; 3],
    lab_k2: Option<[f64; 3]>,
    w_l: f64,
    w_c: f64,
    tol: f64,
    tol2: f64,
    feather: f64,
    clip_black: f64,
    clip_white: f64,
    gamma: f64,
    luma_prot: f64,
    lut: [f64; 256],
}

impl Key {
    fn matte(&self, r: u8, g: u8, b: u8) -> f64 {
        let lp = lin3_to_lab(self.lut[r as usize], self.lut[g as usize], self.lut[b as usize]);
        let k = self.lab_k;
        let mut kc = k;
        let mut tol = self.tol;
        if let Some(k2) = self.lab_k2 {
            // fond non uniforme : couleur clé la plus proche sur le segment k → k2, tolérance
            // interpolée entre celles des deux couleurs
            let (el, ea, eb) = (k2[0] - k[0], k2[1] - k[1], k2[2] - k[2]);
            let seg = self.w_l * el * el + self.w_c * (ea * ea + eb * eb);
            if seg > 1e-6 {
                let (pl, pa, pb) = (lp[0] - k[0], lp[1] - k[1], lp[2] - k[2]);
                let t = ((self.w_l * pl * el + self.w_c * (pa * ea + pb * eb)) / seg).clamp(0.0, 1.0);
                kc = [k[0] + t * el, k[1] + t * ea, k[2] + t * eb];
                tol = self.tol + (self.tol2 - self.tol) * t;
            }
        }
        let mut dl = lp[0] - kc[0];
        let (da, db) = (lp[1] - kc[1], lp[2] - kc[2]);
        if self.luma_prot > 0.0 {
            if dl > 0.0 && lp[0] > 60.0 {
                let f = ((lp[0] - 60.0) / 40.0).powf(2.0);
                dl += dl * f * (self.luma_prot / 5.0);
            } else if dl < 0.0 && lp[0] < 40.0 {
                let f = ((40.0 - lp[0]) / 40.0).powf(2.0);
                dl -= dl.abs() * f * (self.luma_prot / 5.0);
            }
        }
        let dist = (dl * dl * self.w_l + (da * da + db * db) * self.w_c).sqrt();
        let mut m = 1.0;
        if dist <= tol {
            m = 0.0;
        } else if self.feather > 0.0 && dist < tol + self.feather {
            let t = (dist - tol) / self.feather;
            m = t * t * (3.0 - 2.0 * t);
        }
        if m < self.clip_black {
            m = 0.0;
        } else if m > self.clip_white {
            m = 1.0;
        } else if self.clip_white > self.clip_black {
            m = (m - self.clip_black) / (self.clip_white - self.clip_black);
        }
        if self.gamma != 1.0 && m > 0.0 && m < 1.0 {
            m = m.powf(1.0 / self.gamma);
        }
        m.clamp(0.0, 1.0)
    }
}

/// Canal dominant de la couleur clé (0 rouge, 1 vert, 2 bleu), s'il domine nettement.
fn dominant(k: [f64; 3]) -> Option<usize> {
    let (i, v) = k.iter().copied().enumerate().fold((0, f64::MIN), |a, (i, v)| if v > a.1 { (i, v) } else { a });
    let others = k.iter().enumerate().filter(|(j, _)| *j != i).map(|(_, v)| *v).fold(f64::MIN, f64::max);
    (v > others).then_some(i)
}

/// Réglages de la suppression du débordement (couleur de la clé qui « bave » sur le sujet).
struct Spill {
    amount: f64,
    channel: Option<usize>,
    method: i32,
    replace: i32,
    rep: [f64; 3],
}

impl Spill {
    /// Retire l'excès du canal de la clé au-dessus de la limite tirée des deux autres canaux
    /// (moyenne, maximum, minimum), puis rend la quantité retirée en gris neutre (même
    /// luminance) ou dans la couleur de remplacement.
    fn apply(&self, c: [f64; 3]) -> [f64; 3] {
        let Some(ch) = self.channel else { return c };
        if self.amount <= 0.0 {
            return c;
        }
        let (a, b) = match ch {
            0 => (c[1], c[2]),
            1 => (c[0], c[2]),
            _ => (c[0], c[1]),
        };
        let limit = match self.method {
            0 => (a + b) / 2.0,
            2 => a.min(b),
            _ => a.max(b),
        };
        if c[ch] <= limit {
            return c;
        }
        let removed = (c[ch] - limit) * self.amount;
        let mut o = c;
        o[ch] -= removed;
        // luminance perdue (poids Rec. 709 du canal) rendue sans la teinte de la clé
        let lw = [0.2126, 0.7152, 0.0722][ch];
        let back = removed * lw;
        match self.replace {
            1 => {
                for v in o.iter_mut() {
                    *v += back;
                }
            }
            2 => {
                let l = (0.2126 * self.rep[0] + 0.7152 * self.rep[1] + 0.0722 * self.rep[2]).max(12.0);
                for (v, r) in o.iter_mut().zip(self.rep) {
                    *v += back * r / l;
                }
            }
            _ => {}
        }
        o
    }
}

fn unmix(r: f64, g: f64, b: f64, k: [f64; 3], matte: f64, intensity: f64) -> [f64; 3] {
    if intensity <= 0.0 || matte >= 1.0 || matte <= 0.0 {
        return [r, g, b];
    }
    let f = intensity / 100.0;
    let m = matte.max(0.05);
    let u = |c: f64, kc: f64| ((c - kc * (1.0 - matte)) / m).clamp(0.0, 255.0);
    [r * (1.0 - f) + u(r, k[0]) * f, g * (1.0 - f) + u(g, k[1]) * f, b * (1.0 - f) + u(b, k[2]) * f]
}

/// Uint8ClampedArray : arrondi au plus proche (demi vers le pair), borné.
#[inline]
fn clamped(v: f64) -> u8 {
    if v.is_nan() || v <= 0.0 {
        0
    } else if v >= 255.0 {
        255
    } else {
        let f = v.floor();
        let d = v - f;
        let r = if d > 0.5 || (d == 0.5 && (f as i64) % 2 == 1) { f + 1.0 } else { f };
        r as u8
    }
}

/// Math.round de JS (demi vers +∞)
#[inline]
fn js_round(v: f64) -> f64 {
    (v + 0.5).floor()
}

// ------------------------------------------------------------------ opérations sur le masque
// Tampon local `m` de `w` × `rows` valeurs ; bords bornés (le haut / bas du tampon ne sont des
// bords de l'image que si la bande y touche : sinon la marge absorbe l'erreur).

/// Minimum (`max == false`) ou maximum glissant sur une fenêtre carrée de rayon `r`, séparable.
fn morph(m: &mut [f32], w: usize, rows: usize, r: usize, max: bool) {
    if r == 0 || w == 0 || rows == 0 {
        return;
    }
    let pick = |a: f32, b: f32| if max { a.max(b) } else { a.min(b) };
    let mut line = vec![0f32; w.max(rows)];
    for y in 0..rows {
        let row = &mut m[y * w..(y + 1) * w];
        line[..w].copy_from_slice(row);
        for x in 0..w {
            let (a, b) = (x.saturating_sub(r), (x + r).min(w - 1));
            row[x] = line[a..=b].iter().copied().fold(line[x], pick);
        }
    }
    for x in 0..w {
        for y in 0..rows {
            line[y] = m[y * w + x];
        }
        for y in 0..rows {
            let (a, b) = (y.saturating_sub(r), (y + r).min(rows - 1));
            m[y * w + x] = line[a..=b].iter().copied().fold(line[y], pick);
        }
    }
}

/// Flou de boîte séparable de rayon `r` (somme glissante), bords bornés. Somme en entiers
/// (valeurs quantifiées à 2⁻²⁰) : exacte, donc indépendante du point de départ — une bande
/// donne au pixel près le même résultat que l'image entière.
fn box_blur(m: &mut [f32], w: usize, rows: usize, r: usize) {
    if r == 0 || w == 0 || rows == 0 {
        return;
    }
    const Q: f32 = (1 << 20) as f32;
    let mut line = vec![0f32; w.max(rows)];
    let norm = 1.0 / ((2 * r + 1) as f32 * Q);
    let pass = |src: &[f32], n: usize, out: &mut dyn FnMut(usize, f32)| {
        let at = |i: isize| (src[i.clamp(0, n as isize - 1) as usize] * Q).round() as i64;
        let mut acc: i64 = (-(r as isize)..=r as isize).map(at).sum();
        for i in 0..n {
            out(i, acc as f32 * norm);
            acc += at(i as isize + r as isize + 1) - at(i as isize - r as isize);
        }
    };
    for y in 0..rows {
        line[..w].copy_from_slice(&m[y * w..(y + 1) * w]);
        let row = &mut m[y * w..(y + 1) * w];
        pass(&line[..w], w, &mut |i, v| row[i] = v);
    }
    for x in 0..w {
        for y in 0..rows {
            line[y] = m[y * w + x];
        }
        pass(&line[..rows], rows, &mut |i, v| m[i * w + x] = v);
    }
}

/// Plume du masque : trois flous de boîte ≈ flou gaussien de rayon `r` (px, fractionnaire :
/// les deux rayons entiers voisins sont mélangés).
fn feather(m: &mut [f32], w: usize, rows: usize, r: f32) {
    if r <= 0.0 {
        return;
    }
    let lo = r.floor() as usize;
    let t = r - lo as f32;
    let run = |m: &mut [f32], k: usize| {
        let k = (k as f32 / 1.6).round() as usize;
        for _ in 0..3 {
            box_blur(m, w, rows, k.max(1));
        }
    };
    if t < 1e-3 || lo == 0 && t < 0.5 {
        run(m, lo.max(1));
        return;
    }
    let mut hi = m.to_vec();
    run(m, lo.max(1));
    run(&mut hi, lo + 1);
    for (a, b) in m.iter_mut().zip(hi) {
        *a += (b - *a) * t;
    }
}

/// Rayon d'influence des trois passes de `feather` (marge des bandes).
fn feather_reach(r: f32) -> usize {
    if r <= 0.0 {
        return 0;
    }
    3 * ((r.floor() + 1.0) / 1.6).round().max(1.0) as usize
}

// ------------------------------------------------------------------ effet

pub fn chroma(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let g = |i: usize, d: f32| p.f(i, d) as f64;
    let k = [g(0, 0.0), g(1, 255.0), g(2, 0.0)];
    let drift = g(4, 50.0) / 100.0;
    let tol = g(3, 30.0);
    let key = Key {
        lab_k: rgb_to_lab(k[0], k[1], k[2]),
        lab_k2: if p.b(12, false) { Some(rgb_to_lab(g(13, 0.0), g(14, 0.0), g(15, 0.0))) } else { None },
        w_l: 1.0 - drift,
        w_c: 1.0 + drift,
        tol,
        tol2: if g(21, 0.0) > 0.0 { g(21, 0.0) } else { tol },
        feather: g(5, 15.0),
        clip_black: (g(6, 0.0) / 100.0).max(0.0),
        clip_white: (g(7, 100.0) / 100.0).min(1.0),
        gamma: g(8, 1.0).max(0.1),
        luma_prot: g(11, 0.0),
        lut: lin_table(),
    };
    let (spill_amt, recover) = (g(9, 0.0), g(10, 0.0));
    let final_mode = p.i(16, 0) == 1;
    let choke = p.f(17, 0.0).clamp(-64.0, 64.0);
    let plume = p.f(18, 0.0).clamp(0.0, 64.0);
    let clean = p.f(19, 0.0).clamp(0.0, 32.0).round() as usize;
    let holes = p.f(20, 0.0).clamp(0.0, 32.0).round() as usize;
    let spill = Spill {
        amount: (spill_amt / 100.0).clamp(0.0, 1.0),
        channel: dominant(k),
        method: p.i(22, 1),
        replace: p.i(23, 0),
        rep: [g(24, 128.0), g(25, 128.0), g(26, 128.0)],
    };
    let edge = (g(27, 0.0) / 100.0).clamp(0.0, 1.0);
    let view = p.i(28, 0);
    let view_bg = [g(29, 128.0), g(30, 128.0), g(31, 128.0)];
    let shadows = (g(32, 0.0) / 100.0).clamp(0.0, 1.0);
    let invert = p.b(33, false);
    let key_l = key.lab_k[0].max(1.0);

    // masque des lignes [y0, y1) et de la marge nécessaire aux opérations de voisinage
    let (w, h) = (src.w, src.h);
    let choke_r = choke.abs().ceil() as usize;
    let margin = 2 * clean + 2 * holes + choke_r + feather_reach(plume);
    let (my0, my1) = (y0.saturating_sub(margin), (y1 + margin).min(h));
    let rows = my1 - my0;
    // cache à correspondance directe couleur → masque : les fonds unis se répètent beaucoup
    const CB: u32 = 15;
    let mut ckey = vec![u32::MAX; 1 << CB];
    let mut cval = vec![0f32; 1 << CB];
    let mut m = vec![0f32; w * rows];
    for y in my0..my1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let rgb = (src.d[i] as u32) << 16 | (src.d[i + 1] as u32) << 8 | src.d[i + 2] as u32;
            let slot = ((rgb.wrapping_mul(0x9E37_79B1)) >> (32 - CB)) as usize;
            m[(y - my0) * w + x] = if ckey[slot] == rgb {
                cval[slot]
            } else {
                let v = key.matte(src.d[i], src.d[i + 1], src.d[i + 2]) as f32;
                ckey[slot] = rgb;
                cval[slot] = v;
                v
            };
        }
    }
    // nettoyer le fond (ouverture : taches isolées retirées), remplir les trous du sujet
    // (fermeture), rétrécir / étendre le bord, puis plume
    if clean > 0 {
        morph(&mut m, w, rows, clean, false);
        morph(&mut m, w, rows, clean, true);
    }
    if holes > 0 {
        morph(&mut m, w, rows, holes, true);
        morph(&mut m, w, rows, holes, false);
    }
    if choke_r > 0 {
        // rayon fractionnaire : mélange des deux rayons entiers voisins
        let lo = choke.abs().floor() as usize;
        let t = choke.abs() - lo as f32;
        let grow = choke < 0.0;
        let mut a = m.clone();
        morph(&mut a, w, rows, lo, grow);
        if t > 1e-3 {
            morph(&mut m, w, rows, lo + 1, grow);
            for (x, y) in a.iter_mut().zip(&m) {
                *x += (*y - *x) * t;
            }
        }
        m = a;
    }
    feather(&mut m, w, rows, plume);

    for y in y0..y1 {
        for x in 0..w {
            let i = (y * w + x) * 4;
            let (r, gg, b, a) = (src.d[i] as f64, src.d[i + 1] as f64, src.d[i + 2] as f64, src.d[i + 3] as f64);
            let mut mt = (m[(y - my0) * w + x] as f64).clamp(0.0, 1.0);
            if invert {
                mt = 1.0 - mt;
            }
            if view == 2 {
                dst[i..i + 4].copy_from_slice(&src.d[i..i + 4]);
                continue;
            }
            if view == 1 {
                let v = clamped(255.0 * mt * if final_mode { 1.0 } else { a / 255.0 });
                dst[i..i + 4].copy_from_slice(&[v, v, v, 255]);
                continue;
            }
            let mut fg = [r, gg, b];
            if recover > 0.0 {
                fg = unmix(fg[0], fg[1], fg[2], k, mt, recover);
            }
            if mt > 0.0 {
                fg = spill.apply(fg);
            }
            // correction des bords : frange semi-transparente ramenée vers un gris de même
            // luminance (ou la couleur de remplacement)
            if edge > 0.0 && mt > 0.0 && mt < 1.0 {
                let l = 0.2126 * fg[0] + 0.7152 * fg[1] + 0.0722 * fg[2];
                let target = if spill.replace == 2 {
                    let rl = (0.2126 * spill.rep[0] + 0.7152 * spill.rep[1] + 0.0722 * spill.rep[2]).max(12.0);
                    spill.rep.map(|c| c * l / rl)
                } else {
                    [l, l, l]
                };
                let f = edge * (1.0 - mt);
                for c in 0..3 {
                    fg[c] += (target[c] - fg[c]) * f;
                }
            }
            let mut alpha = if final_mode { mt } else { a / 255.0 * mt };
            // ombres conservées : là où le fond est retiré, ce qui est plus sombre que la clé
            // reste en noir semi-transparent
            if shadows > 0.0 && mt < 1.0 {
                let lp = 0.2126 * key.lut[src.d[i] as usize] + 0.7152 * key.lut[src.d[i + 1] as usize] + 0.0722 * key.lut[src.d[i + 2] as usize];
                let lpl = if lp > LAB_E { 116.0 * lp.powf(1.0 / 3.0) - 16.0 } else { LAB_K * lp };
                let s = ((key_l - lpl) / key_l).clamp(0.0, 1.0) * shadows * (1.0 - mt);
                if s > 0.0 {
                    let base = if final_mode { 1.0 } else { a / 255.0 };
                    let na = alpha + s * base;
                    if na > 0.0 {
                        fg = fg.map(|c| c * alpha / na);
                    }
                    alpha = na;
                }
            }
            let alpha = alpha.clamp(0.0, 1.0);
            match view {
                3..=6 => {
                    let bg = match view {
                        3 => {
                            let on = ((x / 8) + (y / 8)) % 2 == 0;
                            if on { [204.0; 3] } else { [255.0; 3] }
                        }
                        4 => [0.0; 3],
                        5 => [255.0; 3],
                        _ => view_bg,
                    };
                    for c in 0..3 {
                        dst[i + c] = clamped(fg[c] * alpha + bg[c] * (1.0 - alpha));
                    }
                    dst[i + 3] = 255;
                }
                _ => {
                    dst[i] = clamped(fg[0]);
                    dst[i + 1] = clamped(fg[1]);
                    dst[i + 2] = clamped(fg[2]);
                    dst[i + 3] = js_round(255.0 * alpha) as u8;
                }
            }
        }
    }
}

/// Couleur du fond à incruster, détectée sur le pourtour de l'image (cadre de 4 % de chaque
/// côté) : la teinte la plus fréquente (cases de 4 bits par canal), moyennée sur ses pixels.
/// Les pixels transparents sont ignorés ; `None` si le pourtour est entièrement transparent.
pub fn detect_key(rgba: &[u8], w: usize, h: usize) -> Option<[u8; 3]> {
    if w == 0 || h == 0 || rgba.len() < w * h * 4 {
        return None;
    }
    let bx = (w / 25).max(1);
    let by = (h / 25).max(1);
    let step = ((w * h) / 400_000).max(1);
    let mut hist = vec![(0u32, [0u64; 3]); 4096];
    let mut n = 0usize;
    for y in 0..h {
        let edge_row = y < by || y >= h - by;
        let mut x = 0;
        while x < w {
            if edge_row || x < bx || x >= w - bx {
                n += 1;
                if n % step == 0 {
                    let i = (y * w + x) * 4;
                    if rgba[i + 3] >= 128 {
                        let (r, g, b) = (rgba[i], rgba[i + 1], rgba[i + 2]);
                        let bin = ((r as usize >> 4) << 8) | ((g as usize >> 4) << 4) | (b as usize >> 4);
                        let e = &mut hist[bin];
                        e.0 += 1;
                        e.1[0] += r as u64;
                        e.1[1] += g as u64;
                        e.1[2] += b as u64;
                    }
                }
                x += 1;
            } else {
                x = w - bx;
            }
        }
    }
    let best = hist.iter().max_by_key(|e| e.0)?;
    (best.0 > 0).then(|| best.1.map(|s| (s / best.0 as u64) as u8))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(src: &[u8], w: usize, h: usize, p: &[f32], y0: usize, y1: usize) -> Vec<u8> {
        let img = Img { d: src, w, h };
        let mut buf = vec![0u8; (y1 - y0) * w * 4];
        let mut out = Out { d: &mut buf, base: y0 * w * 4 };
        chroma(&img, &mut out, y0, y1, &P(p));
        buf
    }

    /// Sujet gris sur fond vert : le fond devient transparent, le sujet reste opaque ; les
    /// opérations de voisinage donnent le même résultat découpées en bandes.
    #[test]
    fn green_screen_and_bands() {
        let (w, h) = (40, 36);
        let mut src = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let i = (y * w + x) * 4;
                let subject = (10..30).contains(&x) && (8..28).contains(&y);
                let c = if subject { [120, 110, 100] } else { [20, 200, 40] };
                src[i..i + 4].copy_from_slice(&[c[0], c[1], c[2], 255]);
            }
        }
        let mut p = vec![20.0, 200.0, 40.0, 30.0, 50.0, 15.0, 0.0, 100.0, 1.0, 80.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0];
        p.extend_from_slice(&[1.5, 2.0, 1.0, 2.0, 0.0, 1.0, 1.0, 128.0, 128.0, 128.0, 30.0, 0.0, 0.0, 0.0, 0.0, 20.0, 0.0]);
        let whole = run(&src, w, h, &p, 0, h);
        assert_eq!(whole[3], 0, "fond transparent");
        assert_eq!(whole[((18 * w) + 20) * 4 + 3], 255, "sujet opaque");
        let mut banded = run(&src, w, h, &p, 0, 13);
        banded.extend(run(&src, w, h, &p, 13, 25));
        banded.extend(run(&src, w, h, &p, 25, h));
        assert!(whole == banded, "bandes différentes");
        assert_eq!(detect_key(&src, w, h), Some([20, 200, 40]));
    }
}
