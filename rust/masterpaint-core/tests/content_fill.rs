// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Remplissage de contenu : un motif régulier (rayures) dont un carré est effacé doit être
//! reconstitué ; la qualité haute (multi-échelle) ne doit pas faire moins bien que la rapide.
fn stripes(w: usize, h: usize) -> Vec<u8> {
    (0..w * h).flat_map(|i| {
        let x = i % w;
        let v = if (x / 6) % 2 == 0 { 220 } else { 40 };
        [v, v / 2, 255 - v, 255]
    }).collect()
}

fn err(quality: f32) -> f64 {
    let (w, h) = (96usize, 96usize);
    let truth = stripes(w, h);
    let mut src = truth.clone();
    let mut mask = vec![0u8; w * h];
    for y in 36..60 {
        for x in 36..60 {
            mask[y * w + x] = 255;
            src[(y * w + x) * 4..(y * w + x) * 4 + 3].copy_from_slice(&[128, 128, 128]);
        }
    }
    // extension 0, fondu 0, détail 100 %, texture, alpha gardé, graine, morceaux auto,
    // échantillonnage auto, qualité, miroir non, adaptation 0
    let out = masterpaint_core::content_fill(&src, &mask, w, h, &[0.0, 0.0, 100.0, 0.0, 1.0, 7.0, 0.0, 0.0, quality, 0.0, 0.0]);
    let mut e = 0f64;
    let mut n = 0f64;
    for i in 0..w * h {
        if mask[i] == 255 {
            for c in 0..3 {
                e += (out[i * 4 + c] as f64 - truth[i * 4 + c] as f64).abs();
                n += 1.0;
            }
        }
    }
    e / n
}

#[test]
fn stripes_are_rebuilt() {
    let fast = err(0.0);
    let high = err(2.0);
    println!("écart moyen : rapide {fast:.1}, haute {high:.1} (gris uni : ~80)");
    assert!(high < 10.0, "rayures mal reconstituées (écart {high:.1})");
    assert!(high <= fast + 5.0, "la qualité haute fait moins bien que la rapide");
}
