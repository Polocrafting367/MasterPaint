// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Détourage par IA sur le bureau (Linux, Windows, Android) : U²-Net-p (Qin et al. 2020,
//! « U²-Net: Going deeper with nested U-structure for salient object detection », Apache-2.0,
//! 4,6 Mo, embarqué) exécuté par tract, moteur ONNX en Rust pur — rien à installer ni à
//! télécharger, fonctionne hors ligne. La version web garde l'IA du navigateur (@imgly).
//!
//! Comme rembg : image ramenée à 320 × 320, divisée par son maximum puis normalisée ImageNet ;
//! la sortie principale (d0) est étirée entre son minimum et son maximum. Le calcul se fait sur
//! un fil à part : l'interface reste fluide, le résultat revient par un futur (`Pending`).

use std::future::Future;
use std::pin::Pin;
use std::sync::{Arc, Mutex, OnceLock};
use std::task::{Context, Poll, Waker};
use tract_onnx::prelude::*;

static MODEL_BYTES: &[u8] = include_bytes!("../models/u2netp.onnx");
/// côté de l'entrée du modèle
pub const SIDE: usize = 320;

type Plan = TypedRunnableModel<TypedModel>;

/// Modèle chargé et optimisé une seule fois (≈ 0,2 s), partagé par les analyses suivantes.
static PLAN: OnceLock<Result<Arc<Plan>, String>> = OnceLock::new();

fn plan() -> Result<Arc<Plan>, String> {
    PLAN.get_or_init(|| {
        tract_onnx::onnx()
            .model_for_read(&mut std::io::Cursor::new(MODEL_BYTES))
            .and_then(|m| m.with_input_fact(0, f32::fact([1, 3, SIDE, SIDE]).into()))
            .and_then(|m| m.into_optimized())
            .and_then(|m| m.into_runnable())
            .map(Arc::new)
            .map_err(|e| format!("modèle d'IA illisible : {e}"))
    })
    .clone()
}

/// Prépare le modèle en arrière-plan (option « Objet (IA) », premier masque Sujet) : la
/// première analyse n'attend plus son chargement.
pub fn preload() {
    if PLAN.get().is_none() {
        std::thread::spawn(|| {
            let _ = plan();
        });
    }
}

/// Image RVBA `w` × `h` ramenée à `SIDE` × `SIDE` (moyenne des pixels couverts, sur fond blanc
/// là où elle est transparente), en plans R, V, B.
fn input(rgba: &[u8], w: usize, h: usize) -> Vec<[f32; 3]> {
    let mut out = vec![[0f32; 3]; SIDE * SIDE];
    for ty in 0..SIDE {
        let (y0, y1) = (ty * h / SIDE, ((ty + 1) * h / SIDE).max(ty * h / SIDE + 1).min(h));
        for tx in 0..SIDE {
            let (x0, x1) = (tx * w / SIDE, ((tx + 1) * w / SIDE).max(tx * w / SIDE + 1).min(w));
            // au plus 4 × 4 échantillons par case : assez pour 320 px, rapide sur 40 Mpx
            let (sy, sx) = ((y1 - y0).div_ceil(4).max(1), (x1 - x0).div_ceil(4).max(1));
            let mut acc = [0f32; 3];
            let mut n = 0f32;
            let mut y = y0;
            while y < y1 {
                let mut x = x0;
                while x < x1 {
                    let o = (y * w + x) * 4;
                    let a = rgba[o + 3] as f32 / 255.0;
                    for c in 0..3 {
                        acc[c] += rgba[o + c] as f32 * a + 255.0 * (1.0 - a);
                    }
                    n += 1.0;
                    x += sx;
                }
                y += sy;
            }
            out[ty * SIDE + tx] = acc.map(|v| v / n.max(1.0));
        }
    }
    out
}

/// Alpha du sujet (0..255) en `SIDE` × `SIDE`.
pub fn subject_alpha(rgba: &[u8], w: usize, h: usize) -> Result<Vec<u8>, String> {
    if w == 0 || h == 0 || rgba.len() < w * h * 4 {
        return Err("image vide".into());
    }
    let plan = plan()?;
    let px = input(rgba, w, h);
    let max = px.iter().flat_map(|p| p.iter()).fold(1e-6f32, |m, v| m.max(*v));
    const MEAN: [f32; 3] = [0.485, 0.456, 0.406];
    const STD: [f32; 3] = [0.229, 0.224, 0.225];
    let t: Tensor = tract_ndarray::Array4::from_shape_fn((1, 3, SIDE, SIDE), |(_, c, y, x)| (px[y * SIDE + x][c] / max - MEAN[c]) / STD[c]).into();
    let out = plan.run(tvec!(t.into())).map_err(|e| format!("analyse impossible : {e}"))?;
    let d0 = out[0].to_array_view::<f32>().map_err(|e| format!("sortie inattendue : {e}"))?;
    let v: Vec<f32> = d0.iter().copied().collect();
    if v.len() != SIDE * SIDE {
        return Err("sortie inattendue".into());
    }
    let (mi, ma) = v.iter().fold((f32::MAX, f32::MIN), |(a, b), x| (a.min(*x), b.max(*x)));
    let k = 255.0 / (ma - mi).max(1e-6);
    Ok(v.iter().map(|x| ((x - mi) * k).round().clamp(0.0, 255.0) as u8).collect())
}

/// Résultat attendu d'un fil de calcul (futur minimal : rempli par le fil, réveille la tâche).
pub struct Pending<T>(Arc<Mutex<(Option<T>, Option<Waker>)>>);

impl<T> Future for Pending<T> {
    type Output = T;
    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<T> {
        let mut g = self.0.lock().unwrap_or_else(|e| e.into_inner());
        match g.0.take() {
            Some(v) => Poll::Ready(v),
            None => {
                g.1 = Some(cx.waker().clone());
                Poll::Pending
            }
        }
    }
}

/// Lance l'analyse sur un fil à part ; le futur rend (largeur, hauteur, alpha).
pub fn spawn(rgba: Vec<u8>, w: usize, h: usize) -> Pending<Result<(usize, usize, Vec<u8>), String>> {
    let cell = Arc::new(Mutex::new((None, None::<Waker>)));
    let c2 = cell.clone();
    std::thread::spawn(move || {
        let r = std::panic::catch_unwind(|| subject_alpha(&rgba, w, h))
            .unwrap_or_else(|_| Err("erreur interne de l'IA".into()))
            .map(|a| (SIDE, SIDE, a));
        let mut g = c2.lock().unwrap_or_else(|e| e.into_inner());
        g.0 = Some(r);
        if let Some(wk) = g.1.take() {
            wk.wake();
        }
    });
    Pending(cell)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Disque sombre sur fond clair : le sujet est trouvé au centre, pas dans les coins.
    #[test]
    fn finds_a_centered_subject() {
        let (w, h) = (400usize, 300usize);
        let mut px = vec![235u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let o = (y * w + x) * 4;
                let (dx, dy) = (x as f32 - 200.0, y as f32 - 150.0);
                if dx * dx + dy * dy < 90.0 * 90.0 {
                    px[o..o + 3].copy_from_slice(&[180, 40, 30]);
                }
                px[o + 3] = 255;
            }
        }
        let t0 = std::time::Instant::now();
        let a = subject_alpha(&px, w, h).expect("analyse");
        println!("U²-Net-p : {:.0} ms (chargement compris)", t0.elapsed().as_secs_f64() * 1000.0);
        let at = |x: usize, y: usize| a[y * SIDE + x];
        assert!(at(SIDE / 2, SIDE / 2) > 128, "centre : {}", at(SIDE / 2, SIDE / 2));
        assert!(at(4, 4) < 128 && at(SIDE - 5, SIDE - 5) < 128);
        let t1 = std::time::Instant::now();
        subject_alpha(&px, w, h).expect("analyse");
        println!("U²-Net-p : {:.0} ms (modèle déjà chargé)", t1.elapsed().as_secs_f64() * 1000.0);
    }
}
