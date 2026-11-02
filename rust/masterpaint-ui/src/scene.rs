//! Réglage automatique du mode Photo Pro : analyse de la scène puis correction adaptée.
//!
//! L'image est réduite à une grille (`GRID` px de côté au plus, moyennes en linéaire) sur
//! laquelle on repère la peau (visage → portrait), le ciel (colonnes lisses, claires et bleutées
//! ou blanches depuis le haut → paysage), le sujet (saillance : écart de couleur et contraste
//! local, pondérés vers le centre, hors ciel) et l'arrière-plan. La scène est classée (portrait,
//! paysage, contre-jour, nuit, high-key, générale) ; l'exposition est mesurée sur le sujet (le
//! visage pour un portrait), puis contraste, ombres / hautes lumières, voile, clarté, vibrance,
//! balance des blancs et mélangeur TSL sont réglés selon le type de scène.
//! Pour un RAW, l'analyse se fait sur les données flottantes : les hautes lumières au-delà du
//! blanc (que l'aperçu 8 bits écrête) sont vues et récupérées.

use crate::photo::neutral;

/// Plus grand côté de la grille d'analyse.
const GRID: usize = 160;

#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Kind {
    General,
    Portrait,
    Landscape,
    Backlit,
    Night,
    HighKey,
}

impl Kind {
    pub fn label(self) -> &'static str {
        match self {
            Kind::General => "scène générale",
            Kind::Portrait => "portrait",
            Kind::Landscape => "paysage",
            Kind::Backlit => "contre-jour",
            Kind::Night => "nuit / basse lumière",
            Kind::HighKey => "high-key (image claire)",
        }
    }
}

/// Résultat du réglage automatique : réglages, indices à reprendre (les autres réglages de la
/// photo sont gardés), type de scène et compte rendu affiché sous l'image.
pub struct Auto {
    pub params: Vec<f32>,
    pub keys: Vec<usize>,
    pub kind: Kind,
    pub note: String,
}

fn srgb_to_linear(c: f32) -> f32 {
    if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
}

fn linear_to_srgb(v: f32) -> f32 {
    let v = v.max(0.0);
    if v <= 0.0031308 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 }
}

/// Grille d'analyse : RVB linéaire (1 = blanc ; un RAW peut dépasser).
struct Grid {
    w: usize,
    h: usize,
    lin: Vec<[f32; 3]>,
}

impl Grid {
    fn build(w: usize, h: usize, px: impl Fn(usize) -> [f32; 3]) -> Grid {
        let s = w.max(h).div_ceil(GRID).max(1);
        let (gw, gh) = (w.div_ceil(s), h.div_ceil(s));
        let mut lin = vec![[0f32; 3]; gw * gh];
        let mut cnt = vec![0u32; gw * gh];
        for y in 0..h {
            let row = (y / s) * gw;
            for x in 0..w {
                let c = px(y * w + x);
                let g = &mut lin[row + x / s];
                g[0] += c[0];
                g[1] += c[1];
                g[2] += c[2];
                cnt[row + x / s] += 1;
            }
        }
        for (g, &n) in lin.iter_mut().zip(&cnt) {
            let n = n.max(1) as f32;
            g.iter_mut().for_each(|v| *v /= n);
        }
        Grid { w: gw, h: gh, lin }
    }
}

/// Mesures d'une case de la grille (sRVB, 1 = blanc).
#[derive(Clone, Copy, Default)]
struct Cell {
    l: f32,
    r: f32,
    g: f32,
    b: f32,
    hue: f32,
    sat: f32,
}

fn cell(c: [f32; 3]) -> Cell {
    let l = linear_to_srgb(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]);
    let (r, g, b) = (linear_to_srgb(c[0]).min(1.0), linear_to_srgb(c[1]).min(1.0), linear_to_srgb(c[2]).min(1.0));
    let (mx, mn) = (r.max(g).max(b), r.min(g).min(b));
    let d = mx - mn;
    let sat = if mx > 0.0 { d / mx } else { 0.0 };
    let hue = if d <= 1e-6 {
        0.0
    } else if mx == r {
        60.0 * ((g - b) / d).rem_euclid(6.0)
    } else if mx == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    Cell { l, r, g, b, hue, sat }
}

/// Peau (règles RVB de Kovač et YCbCr de Chai & Ngan, combinées).
fn is_skin(c: &Cell) -> bool {
    let (r, g, b) = (c.r * 255.0, c.g * 255.0, c.b * 255.0);
    let y = 0.299 * r + 0.587 * g + 0.114 * b;
    let cb = 128.0 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    let cr = 128.0 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    let kovac = r > 95.0 && g > 40.0 && b > 20.0 && r - r.min(g).min(b) > 15.0 && (r - g).abs() > 15.0 && r > g && r > b;
    kovac && y > 50.0 && (77.0..=127.0).contains(&cb) && (133.0..=173.0).contains(&cr)
}

/// Ciel possible : clair et bleuté, ou très clair et neutre (ciel couvert).
fn is_sky_like(c: &Cell) -> bool {
    c.l > 0.35 && ((c.hue >= 180.0 && c.hue <= 260.0 && c.sat > 0.1 && c.b >= c.r) || (c.sat < 0.14 && c.l > 0.62))
}

fn pct(v: &mut [f32], q: f32) -> f32 {
    if v.is_empty() {
        return 0.0;
    }
    v.sort_unstable_by(f32::total_cmp);
    v[((v.len() - 1) as f32 * q).round() as usize]
}

/// Exposition `stops` appliquée à une valeur sRVB.
fn expose(v: f32, stops: f32) -> f32 {
    linear_to_srgb(srgb_to_linear(v.max(0.0)) * 2f32.powf(stops))
}

/// Analyse d'une image 8 bits (RVBA).
pub fn analyze_u8(px: &[u8], w: usize, h: usize) -> Auto {
    let lut: Vec<f32> = (0..256).map(|i| srgb_to_linear(i as f32 / 255.0)).collect();
    let grid = Grid::build(w, h, |i| {
        let p = &px[i * 4..i * 4 + 3];
        [lut[p[0] as usize], lut[p[1] as usize], lut[p[2] as usize]]
    });
    analyze(&grid, false)
}

/// Analyse d'un RAW (RVB linéaire flottant, exposition de base `ev` en IL).
pub fn analyze_lin(lin: &[f32], w: usize, h: usize, ev: f32) -> Auto {
    let k = 2f32.powf(ev);
    let grid = Grid::build(w, h, |i| [lin[i * 3] * k, lin[i * 3 + 1] * k, lin[i * 3 + 2] * k]);
    analyze(&grid, true)
}

fn analyze(grid: &Grid, raw: bool) -> Auto {
    let (gw, gh) = (grid.w, grid.h);
    let n = gw * gh;
    let cells: Vec<Cell> = grid.lin.iter().map(|&c| cell(c)).collect();
    let mut p = neutral();
    if n == 0 {
        return Auto { params: p, keys: vec![], kind: Kind::General, note: String::new() };
    }
    // poids du centre (gaussienne, σ = 0,3 de la largeur / hauteur)
    let center = |x: usize, y: usize| {
        let (dx, dy) = ((x as f32 + 0.5) / gw as f32 - 0.5, (y as f32 + 0.45) / gh as f32 - 0.45);
        (-(dx * dx + dy * dy) / (2.0 * 0.3 * 0.3)).exp()
    };

    // ---- peau / visage
    let skin: Vec<bool> = cells.iter().map(is_skin).collect();
    let (mut sk_w, mut tot_w, mut sk_n, mut sk_y) = (0f32, 0f32, 0usize, 0f32);
    for y in 0..gh {
        for x in 0..gw {
            let c = center(x, y);
            tot_w += c;
            if skin[y * gw + x] {
                sk_w += c;
                sk_n += 1;
                sk_y += y as f32;
            }
        }
    }
    let skin_frac = sk_n as f32 / n as f32;
    let skin_center = sk_w / tot_w.max(1e-6);
    let skin_cy = if sk_n > 0 { sk_y / sk_n as f32 / gh as f32 } else { 1.0 };
    // peau au centre, dans les deux tiers du haut, sans tout couvrir (sable, bois…)
    let portrait = skin_center > 0.07 && skin_frac < 0.6 && skin_cy < 0.72;

    // ---- ciel : depuis le haut de chaque colonne, cases claires, lisses et bleutées / blanches
    let mut sky = vec![false; n];
    for x in 0..gw {
        for y in 0..gh {
            let i = y * gw + x;
            let c = &cells[i];
            let smooth = (y + 1 >= gh || (c.l - cells[i + gw].l).abs() < 0.07) && (x + 1 >= gw || (c.l - cells[i + 1].l).abs() < 0.07);
            if !is_sky_like(c) || !smooth || skin[i] {
                break;
            }
            sky[i] = true;
        }
    }
    let sky_n = sky.iter().filter(|&&s| s).count();
    let sky_frac = sky_n as f32 / n as f32;
    let mut sky_l: Vec<f32> = cells.iter().zip(&sky).filter(|(_, &s)| s).map(|(c, _)| c.l).collect();
    let sky_med = pct(&mut sky_l, 0.5);
    let green_frac = cells.iter().filter(|c| c.hue >= 60.0 && c.hue <= 170.0 && c.sat > 0.18 && c.l > 0.12).count() as f32 / n as f32;

    // ---- sujet : saillance (écart à la couleur moyenne + contraste local) × centre, hors ciel
    let mut mean = [0f32; 3];
    let mut m_n = 0f32;
    for (c, &s) in cells.iter().zip(&sky) {
        if !s {
            mean[0] += c.r;
            mean[1] += c.g;
            mean[2] += c.b;
            m_n += 1.0;
        }
    }
    mean.iter_mut().for_each(|v| *v /= m_n.max(1.0));
    let blur_l = |x: usize, y: usize| {
        let (mut s, mut k) = (0f32, 0f32);
        for yy in y.saturating_sub(2)..(y + 3).min(gh) {
            for xx in x.saturating_sub(2)..(x + 3).min(gw) {
                s += cells[yy * gw + xx].l;
                k += 1.0;
            }
        }
        s / k
    };
    let mut sal = vec![0f32; n];
    for y in 0..gh {
        for x in 0..gw {
            let i = y * gw + x;
            if sky[i] {
                continue;
            }
            let c = &cells[i];
            let dc = ((c.r - mean[0]).powi(2) + (c.g - mean[1]).powi(2) + (c.b - mean[2]).powi(2)).sqrt();
            sal[i] = (dc + 2.0 * (c.l - blur_l(x, y)).abs() + 0.05) * center(x, y) * if portrait && skin[i] { 3.0 } else { 1.0 };
        }
    }
    let mut sorted = sal.clone();
    let cut = pct(&mut sorted, 0.8).max(1e-6);
    let subject: Vec<bool> = sal.iter().map(|&s| s >= cut).collect();
    let mut subj_l: Vec<f32> = cells.iter().zip(&subject).filter(|(_, &s)| s).map(|(c, _)| c.l).collect();
    let mut bg_l: Vec<f32> = cells.iter().zip(&subject).filter(|(_, &s)| !s).map(|(c, _)| c.l).collect();
    let mut face_l: Vec<f32> = cells.iter().zip(&skin).filter(|(_, &s)| s).map(|(c, _)| c.l).collect();
    let subj_med = pct(&mut subj_l, 0.5);
    let subj_spread = pct(&mut subj_l, 0.9) - pct(&mut subj_l, 0.1);
    let bg_med = pct(&mut bg_l, 0.5);
    let face_med = pct(&mut face_l, 0.5);

    // ---- histogramme global
    let mut lum: Vec<f32> = cells.iter().map(|c| c.l).collect();
    let (lo, p5, med, p95, hi) = (pct(&mut lum, 0.005), pct(&mut lum, 0.05), pct(&mut lum, 0.5), pct(&mut lum, 0.95), pct(&mut lum, 0.995));
    let dark_frac = cells.iter().filter(|c| c.l < 0.15).count() as f32 / n as f32;
    let mean_sat = cells.iter().map(|c| c.sat).sum::<f32>() / n as f32;

    // ---- type de scène
    let kind = if med < 0.13 && dark_frac > 0.6 {
        Kind::Night
    } else if (sky_frac > 0.05 || bg_med > 0.6) && hi > 0.85 && subj_med < bg_med - 0.22 && subj_med < 0.4 {
        Kind::Backlit
    } else if portrait {
        Kind::Portrait
    } else if sky_frac > 0.08 || green_frac > 0.3 {
        Kind::Landscape
    } else if med > 0.68 && lo > 0.25 {
        Kind::HighKey
    } else {
        Kind::General
    };

    // ---- exposition : mesurée sur le sujet (le visage pour un portrait)
    let (metered, target, max_stops) = match kind {
        Kind::Portrait => (face_med.max(0.02), 0.6, 1.8),
        Kind::Backlit => (subj_med.max(0.02), 0.42, 2.0),
        Kind::Night => (med.max(0.01), 0.24, 1.2),
        Kind::HighKey => (med, 0.72, 0.6),
        _ => (0.5 * subj_med + 0.5 * med, 0.46, 1.6),
    };
    let mut stops = (srgb_to_linear(target) / srgb_to_linear(metered.max(0.02))).log2().clamp(-1.6, max_stops);
    if kind == Kind::Night {
        stops = stops.max(0.0); // une scène de nuit n'est jamais assombrie
    }
    p[0] = (stops * 50.0).round();
    let (lo2, p5_2, p95_2, hi2, subj2) = (expose(lo, stops), expose(p5, stops), expose(p95, stops), expose(hi, stops), expose(subj_med, stops));
    let spread = p95_2 - p5_2;

    // ---- hautes lumières / blancs (au-delà du blanc pour un RAW : marge du capteur récupérée)
    if hi2 > 1.0 && raw {
        p[5] = -(35.0 + ((hi2 - 1.0) * 60.0).min(45.0)).round();
        p[6] = -20.0;
    } else if hi2 > 0.97 {
        p[5] = -(30.0 + ((hi2 - 0.97) * 300.0).min(40.0)).round();
        p[6] = -10.0;
    } else if hi2 < 0.85 && kind != Kind::Night {
        p[6] = ((0.95 - hi2) * 120.0).round().min(40.0);
    }
    // ---- ombres / noirs
    if lo2 < 0.03 {
        p[3] = 20.0;
    }
    if subj2 < 0.3 && kind != Kind::Night {
        p[3] = p[3].max(((0.3 - subj2) * 200.0).round().min(60.0));
    }
    if lo2 > 0.1 {
        p[4] = -((lo2 - 0.04) * 150.0).round().min(45.0); // noirs délavés : on les creuse
    } else if lo2 < 0.01 && kind != Kind::Night {
        p[4] = 8.0;
    }
    // ---- contraste cohérent : étendue 5–95 % visée ≈ 0,78
    let c_max = match kind {
        Kind::Portrait => 15.0,
        Kind::Night | Kind::HighKey => 10.0,
        _ => 30.0,
    };
    p[18] = ((0.78 - spread) * 60.0).clamp(-15.0, c_max).round();
    // ---- voile (image plate aux noirs levés, peu saturée)
    let hazy = lo2 > 0.12 && mean_sat < 0.2;
    if hazy {
        p[17] = ((lo2 - 0.08) * 120.0).min(30.0).round();
    }
    // ---- clarté : sujet peu contrasté → micro-contraste
    if subj_spread < 0.35 {
        p[16] = ((0.35 - subj_spread) * 60.0).min(20.0).round();
    }
    // ---- vibrance selon la saturation moyenne ; image déjà très saturée : on modère
    p[20] = ((0.3 - mean_sat) * 80.0).clamp(0.0, 35.0).round();
    if mean_sat > 0.5 {
        p[19] = -10.0;
    }

    // ---- balance des blancs : cases quasi neutres (hors peau, ciel, ombres, écrêtage)
    let (mut wr, mut wg, mut wb, mut wn) = (0f32, 0f32, 0f32, 0usize);
    for (i, c) in cells.iter().enumerate() {
        if c.sat < 0.3 && c.l > 0.15 && c.l < 0.95 && !skin[i] && !sky[i] {
            let g = grid.lin[i];
            wr += g[0];
            wg += g[1];
            wb += g[2];
            wn += 1;
        }
    }
    let mut wb_note = "";
    if kind != Kind::Night && wn as f32 > n as f32 * 0.05 && wr > 0.0 && wb > 0.0 && wg > 0.0 {
        // ciel chaud (coucher de soleil) : dominante voulue, corrigée à moitié seulement
        let warm_sky = sky_frac > 0.05 && cells.iter().zip(&sky).filter(|(c, &s)| s && c.r > c.b).count() > sky_n / 2;
        let k = if warm_sky { 0.5 } else { 1.0 };
        let temp = ((wb / wr).ln() * 70.0 * k).clamp(-25.0, 25.0).round();
        let tint = ((wg / (wr * wb).sqrt()).ln() * 90.0 * k).clamp(-20.0, 20.0).round();
        if temp.abs() >= 3.0 {
            p[1] = temp;
            wb_note = if temp > 0.0 { "dominante froide corrigée" } else { "dominante chaude corrigée" };
        }
        if tint.abs() >= 3.0 {
            p[2] = tint;
            if wb_note.is_empty() {
                wb_note = if tint > 0.0 { "dominante verte corrigée" } else { "dominante magenta corrigée" };
            }
        }
    }

    // ---- corrections propres au type de scène (TSL : 38 + bande saturation, 46 + bande luminance ;
    // bandes 0 rouge, 1 orange, 2 jaune, 3 vert, 4 cyan, 5 bleu, 6 violet, 7 magenta)
    let mut keys: Vec<usize> = vec![0, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20];
    let mut hsl = |p: &mut Vec<f32>, i: usize, v: f32| {
        p[i] = v;
        keys.push(i);
    };
    match kind {
        Kind::Portrait => {
            p[16] = -5.0; // peau adoucie
            p[20] = p[20].min(12.0);
            hsl(&mut p, 46 + 1, 8.0); // peau un peu plus lumineuse
            if mean_sat > 0.4 {
                hsl(&mut p, 38 + 1, -6.0);
            }
        }
        Kind::Landscape => {
            p[16] = (p[16] + 12.0).min(25.0);
            p[17] = (p[17] + 8.0).min(35.0);
            p[20] = (p[20] + 10.0).min(40.0);
            if sky_frac > 0.08 {
                if sky_med > 0.75 {
                    p[5] = (p[5] - 15.0).max(-80.0); // ciel clair : détails récupérés
                }
                hsl(&mut p, 38 + 5, 10.0); // ciel plus profond
                hsl(&mut p, 46 + 5, -12.0);
                hsl(&mut p, 38 + 4, 6.0);
            }
            if green_frac > 0.15 {
                hsl(&mut p, 38 + 3, 6.0);
            }
        }
        Kind::Backlit => {
            p[3] = p[3].max(55.0);
            p[5] = p[5].min(-55.0);
            p[16] = (p[16] + 8.0).min(25.0);
        }
        Kind::Night => {
            p[5] = p[5].min(-40.0); // sources lumineuses
            p[4] = p[4].min(-5.0); // noirs gardés profonds
            p[3] = p[3].max(15.0);
            p[16] = 0.0;
            p[20] = p[20].min(10.0);
        }
        Kind::HighKey => {
            p[4] = p[4].min(-5.0);
        }
        Kind::General => {}
    }

    // ---- compte rendu
    let mut why: Vec<String> = Vec::new();
    match kind {
        Kind::Portrait => why.push("visage détecté".into()),
        Kind::Landscape if sky_frac > 0.08 => why.push(format!("ciel {} %", (sky_frac * 100.0).round())),
        Kind::Landscape => why.push("végétation".into()),
        Kind::Backlit => why.push("sujet plus sombre que le fond".into()),
        _ => {}
    }
    if stops.abs() >= 0.1 {
        let v = format!("{:+.1}", stops).replace('.', ",");
        why.push(if stops > 0.0 { format!("éclaircie {v} IL") } else { format!("assombrie {v} IL") });
    }
    if p[18] >= 5.0 {
        why.push("contraste renforcé".into());
    } else if p[18] <= -5.0 {
        why.push("contraste adouci".into());
    }
    if hazy {
        why.push("voile retiré".into());
    }
    if !wb_note.is_empty() {
        why.push(wb_note.into());
    }
    let note = crate::i18n::tr_format!("Auto : {} — {}", crate::i18n::tr(kind.label()), if why.is_empty() { crate::i18n::tr("peu de corrections") } else { why.iter().map(|s| crate::i18n::tr(s)).collect::<Vec<_>>().join(", ") });
    Auto { params: p, keys, kind, note }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn img(w: usize, h: usize, f: impl Fn(usize, usize) -> [u8; 3]) -> Vec<u8> {
        (0..w * h).flat_map(|i| {
            let c = f(i % w, i / w);
            [c[0], c[1], c[2], 255]
        }).collect()
    }

    #[test]
    fn dark_image_is_brightened() {
        let px = img(200, 150, |x, y| {
            let v = (20 + (x + y) % 40) as u8;
            [v, v, v]
        });
        let a = analyze_u8(&px, 200, 150);
        assert!(a.params[0] > 30.0, "exposition {}", a.params[0]);
    }

    #[test]
    fn bright_image_is_darkened() {
        let px = img(200, 150, |x, y| {
            let v = (200 + (x * 3 + y) % 50) as u8;
            [v, (v as f32 * 0.9) as u8, (v as f32 * 0.8) as u8]
        });
        let a = analyze_u8(&px, 200, 150);
        assert!(a.params[0] < 0.0, "exposition {}", a.params[0]);
    }

    #[test]
    fn sky_makes_landscape() {
        let px = img(300, 200, |x, y| if y < 80 { [110, 160, 225] } else { [(60 + x % 30) as u8, (110 + y % 20) as u8, 40] });
        let a = analyze_u8(&px, 300, 200);
        assert_eq!(a.kind, Kind::Landscape, "{}", a.note);
    }

    #[test]
    fn centered_skin_makes_portrait() {
        let px = img(200, 260, |x, y| {
            let (dx, dy) = (x as f32 - 100.0, y as f32 - 110.0);
            if dx * dx / 2500.0 + dy * dy / 4900.0 < 1.0 { [205, 150, 125] } else { [40, 45, 55] }
        });
        let a = analyze_u8(&px, 200, 260);
        assert_eq!(a.kind, Kind::Portrait, "{}", a.note);
        // visage mesuré, pas le fond sombre : pas de surexposition massive
        assert!(a.params[0] < 40.0, "exposition {}", a.params[0]);
    }

    #[test]
    fn blue_cast_is_warmed() {
        let px = img(200, 150, |x, y| {
            let v = (60 + (x + 2 * y) % 40) as u8;
            [v, v, v + 30]
        });
        let a = analyze_u8(&px, 200, 150);
        assert!(a.params[1] > 3.0, "température {}", a.params[1]);
    }
}
