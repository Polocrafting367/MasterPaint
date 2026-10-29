//! Effet VHS — portage de `illuProcessVhsCore` (js/effects/vhs-core.js).
//!
//! Traitement ligne par ligne (le saignement de chrominance dépend du pixel précédent et les
//! déchirures / pertes de signal s'étalent sur plusieurs lignes) : l'effet se calcule d'un seul
//! bloc, de la ligne 0 à la dernière. Le pré-traitement « patine de bande / flou codec » reste
//! dans vhs-core.js (il passe par OffscreenCanvas).
//!
//! Mêmes calculs que le JavaScript : lignes Y/I/Q stockées en f32 (Float32Array), calcul en f64,
//! conversion finale par troncature (Uint8Array). Le hasard (bruit, déchirures, pertes) vient
//! d'un générateur xorshift initialisé par la graine `p[50]` au lieu de Math.random().
//!
//! Paramètres (ordre fixe, voir `VHS_PARAM_ORDER` dans vhs-core.js) :
//!  0 chroma_bleed   1 chroma_blur   2 chroma_saturation  3 edge_sat     4 shadow_sat
//!  5 hs_sat         6 chroma_phase  7 shift_y            8 shift_r      9 shift_g
//! 10 shift_b       11 crop_padding 12 crop_feather      13 head_switch_freq 14 pixel_size
//! 15 luma_contrast 16 luma_brightness 17 luma_smear     18 right_pink  19 right_pink_width
//! 20 glitch_intensity 21 head_switch_wave 22 head_switch_noise 23 hs_color_tear
//! 24 tear_max_height 25 tear_length 26 tear_thickness   27 jitter_amp  28 dropout_chance
//! 29 glitch_jitter 30 glitch_dropouts 31 glitch_tears   32 glitch_noise
//! 33 head_switch_rows 34 head_switch_pull 35 jitter_freq 36 dropout_len 37 dropout_thickness
//! 38 tear_color (0 cyan, 1 magenta, 2 rouge, 3 vert, 4 aléatoire) 39 noise_intensity_y
//! 40 noise_intensity_c 41 apply_color_cast 42 cast_r 43 cast_g 44 cast_b
//! 45 enable_y 46 enable_r 47 enable_g 48 enable_b 49 effect_time 50 graine

use crate::util::*;

struct Rand(u64);
impl Rand {
    #[inline]
    fn next(&mut self) -> f64 {
        // xorshift64* → [0, 1)
        let mut x = self.0;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.0 = x;
        ((x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64) * (1.0 / 9_007_199_254_740_992.0)
    }
}

pub fn vhs(src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) {
    let (w, h) = (src.w, src.h);
    let d = src.d;
    let g = |i: usize, def: f32| p.f(i, def) as f64;
    let flag = |i: usize, def: bool| p.b(i, def);

    let bleed_raw = g(0, 12.0);
    let bleed = if bleed_raw > 0.0 { 1.0 - 10f64.powf(-(bleed_raw / 30.0)) } else { 0.0 };
    let blur_radius = g(1, 25.0).round().max(0.0) as isize;
    let chroma_sat_base = g(2, 2.4);
    let edge_sat = g(3, 4.8);
    let shadow_sat = g(4, 0.0);
    let hs_sat = g(5, 0.0);
    let phase = g(6, 0.0) * (core::f64::consts::PI / 180.0);
    let (cos_p, sin_p) = (phase.cos(), phase.sin());
    let shift_y = g(7, 0.0);
    let shift_r = g(8, -13.0);
    let shift_g = g(9, 8.0);
    let shift_b = g(10, 6.0);
    let crop = g(11, 6.0);
    let feather = g(12, 4.0);
    let hs_freq = g(13, 0.52);
    let pixel_size = g(14, 1.0);
    let luma_contrast = g(15, 1.0);
    let luma_brightness = g(16, 0.0);
    let luma_smear = { let v = g(17, 0.0); if v > 0.0 { v / 100.0 } else { 0.0 } };
    let right_pink = g(18, 0.0) / 100.0;
    let right_pink_width = g(19, 0.4);
    let glitch_intensity = g(20, 0.0);
    let hs_wave = g(21, 0.5);
    let hs_noise_amt = g(22, 0.0);
    let hs_color_tear = g(23, 0.0);
    let tear_max_height = g(24, 20.0) / 100.0;
    let tear_length = g(25, 80.0) / 100.0;
    let tear_thickness = g(26, 2.0);
    let jitter_amp = g(27, 1.0);
    let dropout_chance = g(28, 0.0);
    let (glitch_jitter, glitch_dropouts, glitch_tears, glitch_noise) = (flag(29, true), flag(30, true), flag(31, true), flag(32, true));
    let hs_rows = g(33, 95.0);
    let hs_pull = g(34, 24.0);
    let jitter_freq = g(35, 0.39);
    let dropout_len = g(36, 0.2);
    let dropout_thickness = g(37, 2.0);
    let tear_color = p.i(38, 0);
    let noise_y = g(39, 0.0);
    let noise_c = g(40, 30.0);
    let color_cast = flag(41, true);
    let (cast_r, cast_g, cast_b) = (g(42, 33.0), g(43, -5.0), g(44, -10.0));
    let (en_y, en_r, en_g, en_b) = (flag(45, true), flag(46, true), flag(47, true), flag(48, true));
    let effect_time = g(49, 0.0);
    let mut rng = Rand((p.f(50, 1.0) as u64).wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);

    // glitch global (même formule pseudo-aléatoire que le JS, dépend du temps)
    let (mut is_glitching, mut glitch_mult) = (false, 0.0);
    if glitch_intensity > 0.0 {
        let seed = (effect_time * 10.0).floor();
        let rv = ((seed * 12.9898).sin() * 43758.5453).abs() % 1.0;
        if rv > 1.0 - glitch_intensity / 15.0 {
            is_glitching = true;
            glitch_mult = glitch_intensity / 5.0;
        }
    }
    let active_jitter_amp = jitter_amp + if is_glitching && glitch_jitter { glitch_mult * 3.0 } else { 0.0 };
    let active_dropout = dropout_chance + if is_glitching && glitch_dropouts { glitch_mult * 0.1 } else { 0.0 };
    let active_hs_tear = hs_color_tear + if is_glitching && glitch_tears { glitch_mult * 0.5 } else { 0.0 };
    let active_noise_c = noise_c + if is_glitching && glitch_noise { glitch_mult * 30.0 } else { 0.0 };

    let mut row_y = vec![0f32; w];
    let mut row_i = vec![0f32; w];
    let mut row_q = vec![0f32; w];
    let mut row_a = vec![0u8; w];
    let mut tmp_i = vec![0f32; w];
    let mut tmp_q = vec![0f32; w];

    let (mut drop_rows, mut drop_center, mut drop_half, mut drop_int) = (0i64, 0.0, 0.0, 0.0);
    let (mut tear_rows, mut tear_x0, mut tear_x1) = (0i64, 0.0, 0.0);
    let bottom_crop = crop.min(5.0);
    let (wf, hf) = (w as f64, h as f64);

    // l'effet est séquentiel : on calcule toujours depuis la ligne 0, on n'écrit que [y0, y1)
    for y in 0..y1.min(h) {
        let eff_y = if pixel_size > 1.0 { ((y as f64 / pixel_size).floor() * pixel_size) as usize } else { y };
        let eff_y = eff_y.min(h - 1);
        let eyf = eff_y as f64;
        let dist_bottom_row = hf - eyf;
        let is_hs = dist_bottom_row <= hs_rows && hs_rows > 0.0;
        let (mut pull, mut hs_curve) = (0.0, 0.0);
        if is_hs {
            let t = 1.0 - dist_bottom_row / hs_rows;
            hs_curve = t * t * t;
            let base = hs_pull * hs_curve;
            let head_noise = (rng.next() - 0.5) * hs_noise_amt * hs_curve;
            let wave = (eyf * hs_freq).sin() * (hs_pull * hs_wave) * hs_curve;
            pull = base + head_noise + wave;
        }

        if tear_rows > 0 {
            tear_rows -= 1;
            pull += (rng.next() - 0.5) * 30.0 * active_hs_tear;
        } else if active_hs_tear > 0.0 {
            let mut prob = 0.0;
            if is_hs {
                prob += hs_curve * active_hs_tear * 0.5;
            }
            let yp = eyf / hf;
            if yp >= 1.0 - tear_max_height && tear_max_height > 0.0 {
                let ly = (yp - (1.0 - tear_max_height)) / tear_max_height;
                prob += ly * ly * active_hs_tear * 0.1;
            }
            if is_glitching && glitch_tears && yp >= 1.0 - tear_max_height {
                prob += glitch_mult * 0.2;
            }
            if prob > 0.0 && rng.next() < prob {
                tear_rows = (rng.next() * tear_thickness).floor() as i64 + 1;
                let tlen = tear_length * wf;
                tear_x0 = rng.next() * (wf - tlen);
                tear_x1 = tear_x0 + tlen;
                pull += (rng.next() - 0.5) * 50.0;
            }
        }

        let jitter = ((eyf * jitter_freq + effect_time * 5.0).sin() + (eyf * jitter_freq * 2.1 - effect_time * 2.0).sin() * 0.4) * active_jitter_amp;
        let mut is_dropout = false;
        if drop_rows > 0 {
            is_dropout = true;
            drop_rows -= 1;
        } else if active_dropout > 0.0 && rng.next() < active_dropout / 10.0 {
            is_dropout = true;
            drop_rows = (rng.next() * dropout_thickness).floor() as i64;
            drop_center = rng.next() * wf;
            drop_half = (rng.next() * dropout_len * wf) / 2.0;
            drop_int = 0.5 + rng.next() * 0.5;
        }

        let (mut prev_i, mut prev_q, mut prev_y) = (0.0f64, 0.0f64, 0.0f64);
        for x in 0..w {
            let xf = x as f64;
            let cx = xf + pull;
            let min_dist = (cx - crop).min((wf - crop) - cx).min((hf - bottom_crop) - eyf);
            let edge_fade = if min_dist <= 0.0 { 0.0 } else if feather > 0.0 && min_dist < feather { min_dist / feather } else { 1.0 };
            let (mut r, mut gg, mut b) = (0.0, 0.0, 0.0);
            row_a[x] = 255;
            if edge_fade > 0.0 {
                let mut sx = (xf + pull + jitter).floor();
                if pixel_size > 1.0 {
                    sx = (sx / pixel_size).floor() * pixel_size;
                }
                let sx = sx.clamp(0.0, wf - 1.0) as usize;
                let idx = (eff_y * w + sx) * 4;
                r = d[idx] as f64 * edge_fade;
                gg = d[idx + 1] as f64 * edge_fade;
                b = d[idx + 2] as f64 * edge_fade;
                row_a[x] = d[idx + 3];
            }
            if is_dropout {
                let dist = (xf - drop_center).abs();
                if dist < drop_half {
                    let env = 1.0 - dist / drop_half;
                    let noise = rng.next() * 200.0 * env * drop_int;
                    let base = 150.0 * env;
                    r = (r + base + noise).min(255.0);
                    gg = (gg + base + noise).min(255.0);
                    b = (b + base + noise).min(255.0);
                }
            }
            let mut luma = 0.299 * r + 0.587 * gg + 0.114 * b;
            luma = (luma - 128.0) * luma_contrast + 128.0 + luma_brightness;
            let mut i = 0.596 * r - 0.274 * gg - 0.322 * b;
            let mut q = 0.211 * r - 0.523 * gg + 0.312 * b;
            if tear_rows > 0 && xf >= tear_x0 && xf <= tear_x1 && edge_fade > 0.5 {
                match tear_color {
                    0 => { i = -80.0; q = 80.0; }
                    1 => { i = 60.0; q = 40.0; }
                    2 => { i = 80.0; q = 20.0; }
                    3 => { i = -40.0; q = -60.0; }
                    _ => { i = (rng.next() - 0.5) * 200.0; q = (rng.next() - 0.5) * 200.0; }
                }
                luma += 40.0;
            }
            if phase != 0.0 {
                let ni = i * cos_p - q * sin_p;
                let nq = i * sin_p + q * cos_p;
                i = ni;
                q = nq;
            }
            if x == 0 {
                prev_i = i;
                prev_q = q;
                prev_y = luma;
            } else {
                prev_i = i * (1.0 - bleed) + prev_i * bleed;
                prev_q = q * (1.0 - bleed) + prev_q * bleed;
                if luma_smear > 0.0 {
                    if luma > 180.0 {
                        prev_y = luma;
                    } else {
                        prev_y *= 1.0 - luma_smear * 0.1;
                        if prev_y > luma {
                            luma = prev_y;
                        }
                    }
                }
            }
            row_y[x] = luma as f32;
            row_i[x] = prev_i as f32;
            row_q[x] = prev_q as f32;
        }

        // flou de chrominance (moyenne glissante sur ±rayon, bornée aux bords comme le JS)
        if blur_radius > 0 {
            let r = blur_radius;
            let (mut si, mut sq) = (0.0f64, 0.0f64);
            let mut count = 0usize;
            for k in 0..=r.min(w as isize - 1) {
                si += row_i[k as usize] as f64;
                sq += row_q[k as usize] as f64;
                count += 1;
            }
            for x in 0..w as isize {
                tmp_i[x as usize] = (si / count as f64) as f32;
                tmp_q[x as usize] = (sq / count as f64) as f32;
                let add = x + r + 1;
                if add < w as isize {
                    si += row_i[add as usize] as f64;
                    sq += row_q[add as usize] as f64;
                    count += 1;
                }
                let rem = x - r;
                if rem >= 0 {
                    si -= row_i[rem as usize] as f64;
                    sq -= row_q[rem as usize] as f64;
                    count -= 1;
                }
            }
            row_i.copy_from_slice(&tmp_i);
            row_q.copy_from_slice(&tmp_q);
        }

        if y < y0 {
            continue;
        }
        for x in 0..w {
            let xf = x as f64;
            let cxl = |s: f64| ((xf - s).floor()).clamp(0.0, wf - 1.0) as usize;
            let mut luma = row_y[cxl(shift_y)] as f64;
            if !en_y {
                luma = 0.0;
            }
            let (cr, cg, cb) = (cxl(shift_r), cxl(shift_g), cxl(shift_b));
            let cx = xf + pull;
            let min_dist = (cx - crop).min((wf - crop) - cx).min((hf - bottom_crop) - eyf);
            let edge_fade = if min_dist <= 0.0 { 0.0 } else if feather > 0.0 && min_dist < feather { min_dist / feather } else { 1.0 };
            let mut sat = chroma_sat_base;
            if edge_fade < 1.0 {
                sat += (1.0 - edge_fade) * edge_sat;
            }
            let shadow = if luma < 128.0 { 1.0 - luma / 128.0 } else { 0.0 };
            sat += shadow * shadow_sat;
            sat += hs_curve * hs_sat;
            if sat < 0.0 {
                sat = 0.0;
            }
            let (i_r, q_r) = (row_i[cr] as f64 * sat, row_q[cr] as f64 * sat);
            let (i_g, q_g) = (row_i[cg] as f64 * sat, row_q[cg] as f64 * sat);
            let (i_b, q_b) = (row_i[cb] as f64 * sat, row_q[cb] as f64 * sat);
            let mut r = luma + (0.956 * i_r + 0.621 * q_r);
            let mut gg = luma + (-0.272 * i_g - 0.647 * q_g);
            let mut b = luma + (-1.106 * i_b + 1.703 * q_b);
            if right_pink > 0.0 && right_pink_width > 0.0 {
                let ed = xf / wf;
                let start = 1.0 - right_pink_width;
                if ed > start {
                    let fade = ((ed - start) / right_pink_width).powi(2) * right_pink;
                    let desat = 0.299 * r + 0.587 * gg + 0.114 * b;
                    r = r * (1.0 - fade) + desat * fade;
                    gg = gg * (1.0 - fade) + desat * fade;
                    b = b * (1.0 - fade) + desat * fade;
                    r = (r + fade * 60.0).min(255.0);
                    b = (b + fade * 50.0).min(255.0);
                    gg = (gg - fade * 20.0).max(0.0);
                }
            }
            if color_cast {
                r += cast_r;
                gg += cast_g;
                b += cast_b;
            }
            // le JS tire toujours deux nombres ; on garde la même consommation du hasard
            let noise = (rng.next() - 0.5) * noise_y * 2.0;
            let c_noise = (rng.next() - 0.5) * active_noise_c * 2.0;
            r += noise + c_noise;
            gg += noise;
            b += noise - c_noise;
            if !en_r {
                r = luma;
            }
            if !en_g {
                gg = luma;
            }
            if !en_b {
                b = luma;
            }
            // Uint8Array : borne puis troncature
            let t8 = |v: f64| if v.is_nan() { 0 } else if v > 255.0 { 255 } else if v < 0.0 { 0 } else { v as u8 };
            let o = (y * w + x) * 4;
            dst[o] = t8(r);
            dst[o + 1] = t8(gg);
            dst[o + 2] = t8(b);
            dst[o + 3] = row_a[x];
        }
    }
}
