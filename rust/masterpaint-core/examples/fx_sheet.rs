// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Planche d'essai des effets créatifs : `cargo run --release --example fx_sheet -- entrée.rgba
//! largeur hauteur dossier` (RGBA brut, comme `convert x.png rgba:x.rgba`). Un fichier .rgba
//! par effet, réglages par défaut des fenêtres.
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (src, w, h, out) = (std::fs::read(&a[1]).expect("entrée"), a[2].parse::<usize>().unwrap(), a[3].parse::<usize>().unwrap(), &a[4]);
    let list: &[(&str, &[f32])] = &[
        ("linocut", &[8.0, 45.0, 0.0, 20.0, 0.0, 0.0, 100.0]),
        ("hexmosaic", &[14.0, 2.0, 0.0, 35.0, 0.0, 135.0, 10.0, 0.0]),
        ("pointillism", &[12.0, 140.0, 35.0, 0.0, 0.0, 25.0, 100.0]),
        ("stainedglass", &[22.0, 15.0, 50.0, 0.0, 0.0, 135.0, 0.0]),
        ("ordereddither", &[4.0, 2.0, 1.0, 0.0, 100.0]),
        ("spherize", &[100.0, 100.0, 0.0, 50.0, 50.0]),
        ("swirlwaves", &[220.0, 10.0, 40.0, 100.0, 50.0]),
    ];
    for (n, p) in list {
        let t = std::time::Instant::now();
        let r = masterpaint_core::apply_parallel(n, &src, w, h, p, 8).expect("effet inconnu");
        println!("{n} : {:.0} ms", t.elapsed().as_secs_f64() * 1000.0);
        std::fs::write(format!("{out}/mp-{n}.rgba"), r).unwrap();
    }
}
