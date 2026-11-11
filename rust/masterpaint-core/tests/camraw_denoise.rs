// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Réduction du bruit et noir et blanc du Photo Pro : effets mesurés sur une image bruitée.

/// Image grise 50 % bruitée (luminance σ ≈ 12 niveaux, couleur σ ≈ 10) ; graine fixe.
fn noisy(w: usize, h: usize) -> Vec<u8> {
    let mut s: u64 = 0x9e3779b97f4a7c15;
    let mut rnd = || {
        s ^= s << 13;
        s ^= s >> 7;
        s ^= s << 17;
        // somme de 4 uniformes : presque gaussien, σ ≈ 1
        let mut t = 0.0;
        for k in 0..4 {
            t += ((s >> (k * 16)) & 0xffff) as f64 / 65535.0;
        }
        (t - 2.0) * 1.732
    };
    let mut px = vec![0u8; w * h * 4];
    for i in 0..w * h {
        let l = 128.0 + 12.0 * rnd();
        let (cr, cb) = (10.0 * rnd(), 10.0 * rnd());
        let c = [l + cr, l - 0.5 * (cr + cb), l + cb];
        for k in 0..3 {
            px[i * 4 + k] = c[k].round().clamp(0.0, 255.0) as u8;
        }
        px[i * 4 + 3] = 255;
    }
    px
}

/// (σ de la luminance, σ de la chrominance) au centre de l'image.
fn sigma(px: &[u8], w: usize, h: usize) -> (f64, f64) {
    let (mut n, mut sl, mut sl2, mut sc2) = (0.0, 0.0, 0.0, 0.0);
    for y in h / 4..3 * h / 4 {
        for x in w / 4..3 * w / 4 {
            let o = (y * w + x) * 4;
            let (r, g, b) = (px[o] as f64, px[o + 1] as f64, px[o + 2] as f64);
            let l = 0.299 * r + 0.587 * g + 0.114 * b;
            n += 1.0;
            sl += l;
            sl2 += l * l;
            sc2 += (r - l).powi(2) + (b - l).powi(2);
        }
    }
    let m = sl / n;
    ((sl2 / n - m * m).sqrt(), (sc2 / (2.0 * n)).sqrt())
}

/// Bruit en taches (moyenne 3 × 3 d'un bruit fort), comme celui d'un capteur après dématriçage.
fn blotchy(w: usize, h: usize) -> Vec<u8> {
    let raw = noisy(w, h);
    let mut px = raw.clone();
    for y in 1..h - 1 {
        for x in 1..w - 1 {
            for k in 0..3 {
                let mut t = 0i32;
                for dy in 0..3 {
                    for dx in 0..3 {
                        t += raw[((y + dy - 1) * w + x + dx - 1) * 4 + k] as i32 - 128;
                    }
                }
                px[(y * w + x) * 4 + k] = (128 + t / 3).clamp(0, 255) as u8;
            }
        }
    }
    px
}

#[test]
fn denoise_handles_blotchy_noise() {
    let (w, h) = (192, 192);
    let px = blotchy(w, h);
    let base = masterpaint_core::apply_image("cameraraw", &px, w, h, &params(0.0, 0.0)).unwrap();
    let full = masterpaint_core::apply_image("cameraraw", &px, w, h, &params(100.0, 100.0)).unwrap();
    let half = masterpaint_core::apply_image("cameraraw", &px, w, h, &params(50.0, 50.0)).unwrap();
    let (l0, c0) = sigma(&base, w, h);
    let (l1, c1) = sigma(&full, w, h);
    let (lh, ch) = sigma(&half, w, h);
    println!("taches — sans : lum {l0:.2} coul {c0:.2} | 50 : lum {lh:.2} coul {ch:.2} | 100 : lum {l1:.2} coul {c1:.2}");
    assert!(l1 < l0 / 3.0, "luminance {l0:.2} → {l1:.2}");
    assert!(c1 < c0 / 4.0, "couleur {c0:.2} → {c1:.2}");
    assert!(lh < l0 / 1.6 && ch < c0 / 2.0, "mi-course : {lh:.2} {ch:.2}");
}

fn params(lum: f32, col: f32) -> Vec<f32> {
    let mut p = vec![0f32; 60];
    p[24] = 50.0;
    p[28] = 1.0;
    p[58] = lum;
    p[59] = col;
    p
}

#[test]
fn denoise_removes_most_noise() {
    let (w, h) = (192, 192);
    let px = noisy(w, h);
    let base = masterpaint_core::apply_image("cameraraw", &px, w, h, &params(0.0, 0.0)).unwrap();
    let full = masterpaint_core::apply_image("cameraraw", &px, w, h, &params(100.0, 100.0)).unwrap();
    let half = masterpaint_core::apply_image("cameraraw", &px, w, h, &params(50.0, 50.0)).unwrap();
    let (l0, c0) = sigma(&base, w, h);
    let (l1, c1) = sigma(&full, w, h);
    let (lh, ch) = sigma(&half, w, h);
    println!("sans : lum {l0:.2} coul {c0:.2} | 50 : lum {lh:.2} coul {ch:.2} | 100 : lum {l1:.2} coul {c1:.2}");
    // à fond : au moins 4 fois moins de bruit de luminance, 5 fois moins de taches de couleur
    assert!(l1 < l0 / 4.0, "luminance {l0:.2} → {l1:.2}");
    assert!(c1 < c0 / 5.0, "couleur {c0:.2} → {c1:.2}");
    // à mi-course : déjà nettement moins de bruit
    assert!(lh < l0 / 2.0 && ch < c0 / 2.5, "mi-course : {lh:.2} {ch:.2}");
}

#[test]
fn saturation_minus_100_is_gray() {
    let cols: [[u8; 3]; 4] = [[230, 40, 40], [40, 200, 90], [40, 90, 230], [200, 160, 60]];
    let (w, h) = (cols.len() * 8, 8);
    let mut px = vec![0u8; w * h * 4];
    for y in 0..h {
        for x in 0..w {
            let c = cols[x / 8];
            px[(y * w + x) * 4..][..4].copy_from_slice(&[c[0], c[1], c[2], 255]);
        }
    }
    let mut p = params(0.0, 0.0);
    p[19] = -100.0;
    let out = masterpaint_core::apply_image("cameraraw", &px, w, h, &p).unwrap();
    let spread = out.chunks_exact(4).map(|c| c[0].max(c[1]).max(c[2]) - c[0].min(c[1]).min(c[2])).max().unwrap();
    assert!(spread <= 2, "saturation −100 : écart entre canaux {spread}");
}

/// Masque linéaire (Photo Pro) : exposition +100 en haut, rien en bas ; sans masque, image
/// inchangée par rapport au rendu sans fin de tableau.
#[test]
fn linear_mask_brightens_top_only() {
    let (w, h) = (64, 64);
    let mut px = vec![0u8; w * h * 4];
    for i in 0..w * h {
        px[i * 4..i * 4 + 4].copy_from_slice(&[100, 100, 100, 255]);
    }
    let base = params(0.0, 0.0);
    let plain = masterpaint_core::apply_image("cameraraw", &px, w, h, &base).unwrap();
    // 1 masque, zone entière, photo carrée ; linéaire de (0.5, 0.2) à (0.5, 0.6) ; exposition +100
    let mut p = base.clone();
    p.extend_from_slice(&[1.0, 0.0, 0.0, 1.0, 1.0, 1.0]);
    p.extend_from_slice(&[1.0, 0.0, 100.0, 1.0, 0.0, 100.0, 4.0, 0.5, 0.2, 0.5, 0.6]);
    let out = masterpaint_core::apply_image("cameraraw", &px, w, h, &p).unwrap();
    let at = |y: usize| out[(y * w + w / 2) * 4] as i32;
    let pl = plain[(2 * w + w / 2) * 4] as i32;
    println!("sans masque {pl} ; masque : haut {} milieu {} bas {}", at(2), at(32), at(60));
    assert!(at(2) > pl + 30, "haut éclairci");
    assert!((at(60) - pl).abs() <= 1, "bas inchangé");
    assert!(at(32) > pl && at(32) < at(2), "transition");
}
