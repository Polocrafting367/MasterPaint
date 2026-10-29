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
    let n = chars.len();
    let mut glyphs: std::collections::HashMap<char, Vec<u8>> = Default::default();
    for y0 in (0..h).step_by(ch) {
        let y1 = (y0 + ch).min(h);
        for x0 in (0..w).step_by(cw) {
            let x1 = (x0 + cw).min(w);
            let (mut sr, mut sg, mut sb, mut sa, mut cnt) = (0f32, 0f32, 0f32, 0f32, 0f32);
            for y in y0..y1 {
                for x in x0..x1 {
                    let i = (y * w + x) * 4;
                    let a = src[i + 3] as f32 / 255.0;
                    sr += src[i] as f32 * a;
                    sg += src[i + 1] as f32 * a;
                    sb += src[i + 2] as f32 * a;
                    sa += a;
                    cnt += 1.0;
                }
            }
            let a_avg = sa / cnt.max(1.0);
            if a_avg < 0.02 {
                continue; // cellule vide : reste transparente
            }
            let (r, g, b) = (sr / sa, sg / sa, sb / sa);
            if let Some(bg) = o.bg {
                for y in y0..y1 {
                    for x in x0..x1 {
                        put(&mut out, x, y, bg, a_avg);
                    }
                }
            }
            let mut t = ((0.299 * r + 0.587 * g + 0.114 * b) / 255.0).clamp(0.0, 1.0).powf(1.0 / o.gamma.max(0.2));
            if o.invert {
                t = 1.0 - t;
            }
            let c = chars[((t * (n - 1) as f32).round() as usize).min(n - 1)];
            if c == ' ' {
                continue;
            }
            let ink = o.ink.unwrap_or([r as u8, g as u8, b as u8]);
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
                    // glyphe rendu une fois par caractère dans une vignette centrée, puis recopié
                    let (bw, bh) = (cw + 2 * ch, 3 * ch);
                    let m = glyphs.entry(c).or_insert_with(|| {
                        let mut cov = Cover::new(bw, bh);
                        let adv = scaled.h_advance(scaled.glyph_id(c));
                        let top = bh as f32 / 2.0 - (scaled.ascent() - scaled.descent()) / 2.0;
                        text::render(&font, &c.to_string(), size, bw as f32 / 2.0 - adv / 2.0, top, text::Align::Left, true, &mut cov);
                        cov.m
                    });
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
    }
    out
}
