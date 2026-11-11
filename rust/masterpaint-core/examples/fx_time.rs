// Chronométrage d'un effet du moteur : cargo run --release --example fx_time -- nom p0,p1,… [w h]
fn main() {
    let a: Vec<String> = std::env::args().collect();
    let name = &a[1];
    let p: Vec<f32> = a.get(2).map(|s| s.split(',').filter(|x| !x.is_empty()).map(|x| x.parse().unwrap()).collect()).unwrap_or_default();
    let w: usize = a.get(3).map(|s| s.parse().unwrap()).unwrap_or(1000);
    let h: usize = a.get(4).map(|s| s.parse().unwrap()).unwrap_or(850);
    // dégradé + bruit déterministe (pas besoin d'une photo pour chronométrer)
    let mut px = vec![0u8; w * h * 4];
    let mut s = 12345u32;
    for (i, c) in px.chunks_mut(4).enumerate() {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        let (x, y) = (i % w, i / w);
        c[0] = ((x * 255 / w) as u32 ^ (s & 15)) as u8;
        c[1] = ((y * 255 / h) as u32 ^ ((s >> 4) & 15)) as u8;
        c[2] = (((x + y) * 128 / (w + h)) as u32 + ((s >> 8) & 31)) as u8;
        c[3] = 255;
    }
    let t = std::time::Instant::now();
    let out = masterpaint_core::apply_parallel(name, &px, w, h, &p, 1).expect("effet");
    let ms = t.elapsed().as_secs_f64() * 1000.0;
    let sum: u64 = out.iter().map(|&b| b as u64).sum();
    println!("{name} {ms:.1} ms  somme {sum}");
}
