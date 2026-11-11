// Repris de LightCraft (`crates/inpaint`, lui-même porté de PhotoCraft `crates/algo`), © storytold
// et contributeurs — MIT OR Apache-2.0 — https://github.com/storytold — https://getartcraft.com/apps
// Adapté pour MasterPaint (module du moteur au lieu d'un crate). Voir COPYRIGHT.md.
//! Content-aware hole filling (inpainting) for the Remove tool.
//!
//! * [`complete`]: multi-scale patch-based completion (Wexler, Shechtman, Irani 2007) with the
//!   nearest-neighbour field found by PatchMatch (Barnes et al. 2009). See [`patchmatch`].
//! * [`membrane_fill`]: smooth harmonic fill, used to seed the coarsest level and as a fallback.
//!
//! Buffers are interleaved `w × h × ch` floats in any colour model plus a `w × h` hole mask.
//! Everything is deterministic (fixed-seed RNG, results independent of the thread count) and never
//! panics on mismatched sizes: such calls return `None` or the input unchanged.
//!
//! Sources: C. Barnes, E. Shechtman, A. Finkelstein, D. B. Goldman, *PatchMatch: A Randomized
//! Correspondence Algorithm for Structural Image Editing*, SIGGRAPH 2009; Y. Wexler, E. Shechtman,
//! M. Irani, *Space-Time Completion of Video*, PAMI 2007.
//!
//! Ported from PhotoCraft (`crates/algo/src/inpaint.rs`, `poisson.rs`, MIT OR Apache-2.0, same
//! organisation; see `NOTICE`).


pub mod membrane;
pub mod patchmatch;

pub use membrane::membrane_fill;
pub use patchmatch::{CompleteParams, complete, complete_with};

/// MasterPaint : reconstitue dans `px` (RGBA 8 bits, `w × h`) la zone où `hole` (un octet par
/// pixel) est non nul. Le calcul se limite au cadre de la zone élargi de `margin` pixels (là où
/// l'on cherche les morceaux) ; le résultat est fondu selon la valeur du masque (bord doux).
/// Retourne le rectangle modifié (x0, y0, x1, y1 exclus).
pub fn fill_rgba(px: &mut [u8], w: usize, h: usize, hole: &[u8], margin: usize) -> Option<(usize, usize, usize, usize)> {
    if px.len() < w * h * 4 || hole.len() < w * h {
        return None;
    }
    let (mut x0, mut y0, mut x1, mut y1) = (usize::MAX, usize::MAX, 0, 0);
    for y in 0..h {
        for x in 0..w {
            if hole[y * w + x] > 0 {
                x0 = x0.min(x);
                y0 = y0.min(y);
                x1 = x1.max(x + 1);
                y1 = y1.max(y + 1);
            }
        }
    }
    if x1 <= x0 {
        return None;
    }
    let m = margin.max((x1 - x0).max(y1 - y0) / 2).max(16);
    let (rx0, ry0, rx1, ry1) = (x0.saturating_sub(m), y0.saturating_sub(m), (x1 + m).min(w), (y1 + m).min(h));
    let (rw, rh) = (rx1 - rx0, ry1 - ry0);
    let mut img = vec![0f32; rw * rh * 4];
    let mut hb = vec![false; rw * rh];
    for y in 0..rh {
        for x in 0..rw {
            let (i, o) = (y * rw + x, ((ry0 + y) * w + rx0 + x) * 4);
            // couleurs prémultipliées : le transparent ne bave pas en noir
            let a = px[o + 3] as f32 / 255.0;
            for c in 0..3 {
                img[i * 4 + c] = px[o + c] as f32 / 255.0 * a;
            }
            img[i * 4 + 3] = a;
            hb[i] = hole[(ry0 + y) * w + rx0 + x] > 0;
        }
    }
    let p = CompleteParams { patch_radius: if (x1 - x0).max(y1 - y0) < 24 { 2 } else { 3 }, ..CompleteParams::default() };
    let out = complete(rw, rh, 4, &img, &hb, &p).unwrap_or_else(|| membrane_fill(rw, rh, 4, &img, &hb));
    for y in 0..rh {
        for x in 0..rw {
            let i = y * rw + x;
            let k = hole[(ry0 + y) * w + rx0 + x] as f32 / 255.0;
            if k <= 0.0 {
                continue;
            }
            let o = ((ry0 + y) * w + rx0 + x) * 4;
            let a = out[i * 4 + 3].clamp(0.0, 1.0);
            let mut c = [0f32; 4];
            for ch in 0..3 {
                c[ch] = if a > 1e-4 { (out[i * 4 + ch] / a).clamp(0.0, 1.0) * 255.0 } else { 0.0 };
            }
            c[3] = a * 255.0;
            for ch in 0..4 {
                px[o + ch] = (px[o + ch] as f32 * (1.0 - k) + c[ch] * k + 0.5) as u8;
            }
        }
    }
    Some((x0, y0, x1, y1))
}

/// A cancelled [`complete_with`].
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cancelled;

impl std::fmt::Display for Cancelled {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("cancelled")
    }
}

impl std::error::Error for Cancelled {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hostile_sizes_do_not_panic() {
        assert_eq!(complete(4, 4, 3, &[0.0; 5], &[true; 16], &CompleteParams::default()), None);
        assert_eq!(complete(4, 4, 0, &[], &[true; 16], &CompleteParams::default()), None);
        assert_eq!(complete(usize::MAX, 2, 3, &[0.0; 6], &[true; 2], &CompleteParams::default()), None);
        assert_eq!(membrane_fill(4, 4, 1, &[0.5; 3], &[true; 16]), vec![0.5; 3]);
        // A hole covering everything: nothing to copy from.
        assert_eq!(complete(16, 16, 1, &[0.5; 256], &[true; 256], &CompleteParams::default()), None);
        // A tiny image smaller than a patch.
        let _ = complete(2, 2, 1, &[0.5; 4], &[true, false, false, false], &CompleteParams::default());
    }

    #[test]
    fn cancellation_stops() {
        let img = vec![0.5f32; 64 * 64];
        let hole: Vec<bool> = (0..64 * 64usize).map(|i| (i % 64).abs_diff(32) < 4 && (i / 64).abs_diff(32) < 4).collect();
        assert_eq!(complete_with(64, 64, 1, &img, &hole, &CompleteParams::default(), &|| true), Err(Cancelled));
    }
}
