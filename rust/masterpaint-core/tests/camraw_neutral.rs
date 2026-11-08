// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Camera Raw à réglages neutres : l'image doit rester (presque) identique, couleurs saturées
//! comprises.
#[test]
fn neutral_keeps_colors() {
    let cols: [[u8; 3]; 9] = [[255, 40, 40], [255, 150, 0], [255, 255, 0], [40, 200, 255], [0, 255, 0], [180, 120, 90], [250, 250, 250], [30, 30, 30], [128, 128, 128]];
    let (w, h) = (cols.len() * 8, 8);
    let mut px = vec![0u8; w * h * 4];
    for y in 0..h {
        for x in 0..w {
            let c = cols[x / 8];
            px[(y * w + x) * 4..][..4].copy_from_slice(&[c[0], c[1], c[2], 255]);
        }
    }
    let mut p = vec![0f32; 58];
    p[24] = 50.0;
    p[28] = 1.0;
    let out = masterpaint_core::apply_image("cameraraw", &px, w, h, &p).unwrap();
    let mut worst = 0i32;
    for (k, c) in cols.iter().enumerate() {
        let o = ((4 * w) + k * 8 + 4) * 4;
        let r = [out[o], out[o + 1], out[o + 2]];
        let d = (0..3).map(|i| (r[i] as i32 - c[i] as i32).abs()).max().unwrap();
        println!("{:?} -> {:?} (écart {d})", c, r);
        worst = worst.max(d);
    }
    assert!(worst <= 3, "écart max {worst}");
}
