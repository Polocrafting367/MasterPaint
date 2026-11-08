// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Effet « Art ASCII » (comme FilterManager.js) : l'image est découpée en cellules de la taille
//! d'un caractère ; chaque cellule reçoit sa couleur moyenne (pondérée par l'alpha) et le
//! caractère de la rampe dont la densité correspond à sa luminosité.
//!
//! Les rampes « Blocs » et « Points » sont dessinées directement (trame, disques) : la police
//! intégrée n'a pas ces glyphes. Les autres caractères passent par la police Selawik.

use crate::paint::Cover;
use crate::text;
use ab_glyph::{Font, PxScale, ScaleFont};

/// Rampes prédéfinies, du plus clair au plus dense (mêmes que la version web).
pub const RAMPS: [(&str, &str); 5] = [
    ("standard", " .:-=+*#%@"),
    ("detailed", " .'`^\",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$"),
    ("blocks", " ░▒▓█"),
    ("dots", " .·◦•●"),
    ("binary", " 10"),
];

pub struct Opts {
    pub size: f32,
    pub chars: Vec<char>,
    pub gamma: f32,
    pub invert: bool,
    pub bold: bool,
    /// None : couleur des pixels ; Some : couleur unique
    pub ink: Option<[u8; 3]>,
    /// fond des cellules non vides (None : transparent)
    pub bg: Option<[u8; 3]>,
}

/// Densité de tracé des caractères dessinés sans police (blocs, points) : None = police.
fn drawn_density(c: char) -> Option<(bool, f32)> {
    match c {
        '░' => Some((false, 0.25)),
        '▒' => Some((false, 0.5)),
        '▓' => Some((false, 0.75)),
        '█' => Some((false, 1.0)),
        '·' => Some((true, 0.12)),
        '◦' => Some((true, 0.22)),
        '•' => Some((true, 0.32)),
        '●' => Some((true, 0.45)),
        _ => None,
    }
}

pub fn render(src: &[u8], w: usize, h: usize, o: &Opts) -> Vec<u8> {
    let font = text::decode_font(if o.bold { include_bytes!("../fonts/selawkb.ttf") } else { include_bytes!("../fonts/selawk.ttf") }).expect("police intégrée");
    let size = o.size.max(2.0);
    let scaled = font.as_scaled(PxScale::from(size));
    let chars = if o.chars.is_empty() { RAMPS[0].1.chars().collect() } else { o.chars.clone() };
    // grille régulière, à la manière d'une police à chasse fixe (la version web utilise
    // « monospace ») : largeur moyenne des caractères de la rampe. Avec la plus large (police
    // proportionnelle), les caractères étroits étaient très espacés.
    let advances: Vec<f32> = chars.iter().map(|c| if drawn_density(*c).is_some() { size * 0.6 } else { scaled.h_advance(scaled.glyph_id(*c)) }).collect();
    let mean = advances.iter().sum::<f32>() / advances.len().max(1) as f32;
    let cw = mean.max(size * 0.55).round().max(1.0) as usize;
    let ch = size.round().max(1.0) as usize;
    let mut out = vec![0u8; w * h * 4];
    let put = |out: &mut [u8], x: usize, y: usize, c: [u8; 3], a: f32| {
        let i = (y * w + x) * 4;
        let da = out[i + 3] as f32 / 255.0;
        let ao = a + da * (1.0 - a);
        if ao <= 0.0 {
            return;
        }
        for k in 0..3 {
            out[i + k] = ((c[k] as f32 * a + out[i + k] as f32 * da * (1.0 - a)) / ao + 0.5) as u8;
        }
        out[i + 3] = (ao * 255.0 + 0.5) as u8;
    };
    // glyphes rendus une fois (vignette centrée), et leur encre réelle : la rampe est
    // recalibrée sur cette police (sinon les paliers de gris sont irréguliers : « = » plus
    // clair que « - » en Selawik, etc.)
    let (bw, bh) = (cw + 2 * ch, 3 * ch);
    let mut glyphs: std::collections::HashMap<char, Vec<u8>> = Default::default();
    let cell_area = (cw * ch) as f32;
    let mut ramp: Vec<(char, f32)> = Vec::with_capacity(chars.len());
    for &c in &chars {
        let ink = match drawn_density(c) {
            _ if c == ' ' => 0.0,
            Some((false, d)) => d,
            Some((true, d)) => std::f32::consts::PI * (d * ch as f32).powi(2) / cell_area,
            None => {
                let m = glyphs.entry(c).or_insert_with(|| {
                    let mut cov = Cover::new(bw, bh);
                    let adv = scaled.h_advance(scaled.glyph_id(c));
                    let top = bh as f32 / 2.0 - (scaled.ascent() - scaled.descent()) / 2.0;
                    text::render(&font, &c.to_string(), size, bw as f32 / 2.0 - adv / 2.0, top, text::Align::Left, true, &mut cov);
                    cov.m
                });
                m.iter().map(|v| *v as f32 / 255.0).sum::<f32>() / cell_area
            }
        };
        if !ramp.iter().any(|r| r.0 == c) {
            ramp.push((c, ink));
        }
    }
    ramp.sort_by(|a, b| a.1.total_cmp(&b.1));
    let (lo_ink, hi_ink) = (ramp.first().map_or(0.0, |r| r.1), ramp.last().map_or(1.0, |r| r.1).max(1e-6));
    let ramp: Vec<(char, f32)> = ramp.into_iter().map(|(c, i)| (c, (i - lo_ink) / (hi_ink - lo_ink).max(1e-6))).collect();
    // 1re passe : couleur et luminosité moyennes de chaque cellule
    struct Cell {
        rgb: [f32; 3],
        a: f32,
        lum: f32,
    }
    let (cols, rows) = (w.div_ceil(cw), h.div_ceil(ch));
    let mut cells: Vec<Option<Cell>> = Vec::with_capacity(cols * rows);
    for y0 in (0..h).step_by(ch) {
        for x0 in (0..w).step_by(cw) {
            let (x1, y1) = ((x0 + cw).min(w), (y0 + ch).min(h));
            let (mut sr, mut sg, mut sb, mut sa, mut cnt) = (0f32, 0f32, 0f32, 0f32, 0f32);
            for y in y0..y1 {
                for p in src[(y * w + x0) * 4..(y * w + x1) * 4].chunks_exact(4) {
                    let a = p[3] as f32 / 255.0;
                    sr += p[0] as f32 * a;
                    sg += p[1] as f32 * a;
                    sb += p[2] as f32 * a;
                    sa += a;
                    cnt += 1.0;
                }
            }
            let a = sa / cnt.max(1.0);
            cells.push((a >= 0.02).then(|| {
                let rgb = [sr / sa, sg / sa, sb / sa];
                Cell { rgb, a, lum: (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255.0 }
            }));
        }
    }
    // contraste étalé (2 % / 98 % des cellules) : toute la rampe sert, même sur une photo terne
    let mut lums: Vec<f32> = cells.iter().flatten().map(|c| c.lum).collect();
    lums.sort_by(|a, b| a.total_cmp(b));
    let pick = |q: f32| lums.get(((lums.len().saturating_sub(1)) as f32 * q) as usize).copied();
    let (lo, hi) = match (pick(0.02), pick(0.98)) {
        (Some(a), Some(b)) if b - a > 0.08 => (a, b),
        _ => (0.0, 1.0),
    };
    // fond sombre et couleur des pixels : encre ravivée (un caractère couvre peu sa cellule)
    let dark_bg = o.bg.is_some_and(|b| (0.299 * b[0] as f32 + 0.587 * b[1] as f32 + 0.114 * b[2] as f32) < 96.0);
    for (k, cell) in cells.iter().enumerate() {
        let Some(cell) = cell else { continue };
        let (x0, y0) = ((k % cols) * cw, (k / cols) * ch);
        let (x1, y1) = ((x0 + cw).min(w), (y0 + ch).min(h));
        let a_avg = cell.a;
        if let Some(bg) = o.bg {
            for y in y0..y1 {
                for x in x0..x1 {
                    put(&mut out, x, y, bg, a_avg);
                }
            }
        }
        let mut t = ((cell.lum - lo) / (hi - lo)).clamp(0.0, 1.0).powf(1.0 / o.gamma.max(0.2));
        if o.invert {
            t = 1.0 - t;
        }
        // caractère dont l'encre est la plus proche de la densité voulue
        let c = ramp.iter().min_by(|a, b| (a.1 - t).abs().total_cmp(&(b.1 - t).abs())).map_or(' ', |r| r.0);
        if c == ' ' {
            continue;
        }
        let [r, g, b] = cell.rgb;
        let ink = o.ink.unwrap_or_else(|| {
            if dark_bg {
                let m = r.max(g).max(b).max(1.0);
                let k = 1.0 + ((255.0 / m).min(1.8) - 1.0) * 0.6;
                [(r * k).min(255.0) as u8, (g * k).min(255.0) as u8, (b * k).min(255.0) as u8]
            } else {
                [r as u8, g as u8, b as u8]
            }
        });
        let (cx, cy) = ((x0 + x1) as f32 / 2.0, (y0 + y1) as f32 / 2.0);
        match drawn_density(c) {
            Some((false, d)) => {
                // trame ordonnée 2×2 : 25 / 50 / 75 / 100 %
                const B: [f32; 4] = [0.0, 0.5, 0.75, 0.25];
                for y in y0..y1 {
                    for x in x0..x1 {
                        if B[(y % 2) * 2 + x % 2] < d {
                            put(&mut out, x, y, ink, a_avg);
                        }
                    }
                }
            }
            Some((true, d)) => {
                let rad = d * ch as f32;
                for y in y0..y1 {
                    for x in x0..x1 {
                        let dd = ((x as f32 + 0.5 - cx).powi(2) + (y as f32 + 0.5 - cy).powi(2)).sqrt();
                        let cov = (rad - dd + 0.5).clamp(0.0, 1.0);
                        if cov > 0.0 {
                            put(&mut out, x, y, ink, a_avg * cov);
                        }
                    }
                }
            }
            None => {
                let Some(m) = glyphs.get(&c) else { continue };
                let (ox, oy) = (cx as isize - (bw / 2) as isize, cy as isize - (bh / 2) as isize);
                for gy in 0..bh {
                    for gx in 0..bw {
                        let v = m[gy * bw + gx];
                        let (x, y) = (ox + gx as isize, oy + gy as isize);
                        if v > 0 && x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h {
                            put(&mut out, x as usize, y as usize, ink, a_avg * v as f32 / 255.0);
                        }
                    }
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Aperçu du rendu sur une photo : `MP_OUT=f.png cargo test ascii_look -- --ignored`.
    #[test]
    #[ignore]
    fn ascii_look() {
        let bytes = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../../IMG/Photo.jpeg")).expect("photo");
        let img = image::load_from_memory(&bytes).expect("jpeg").thumbnail(800, 800).to_rgba8();
        let (w, h) = (img.width() as usize, img.height() as usize);
        let o = Opts { size: 10.0, chars: RAMPS[0].1.chars().collect(), gamma: 1.0, invert: false, bold: false, ink: None, bg: Some([0, 0, 0]) };
        let out = render(img.as_raw(), w, h, &o);
        if let Ok(path) = std::env::var("MP_OUT") {
            image::RgbaImage::from_raw(w as u32, h as u32, out).expect("taille").save(path).expect("écriture");
        }
    }
}
