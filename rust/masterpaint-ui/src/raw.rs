// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Fichiers RAW des appareils photo (Sony ARW, Canon CR2 / CR3, Nikon NEF, Fujifilm RAF,
//! Olympus ORF, Panasonic RW2, Pentax PEF, DNG…) : décodage par `rawler` (dnglab), puis
//! développement LINÉAIRE en flottant — dématriçage, balance des blancs de l'appareil, matrice
//! couleur vers sRGB, sans gamma ni écrêtage — comme `illuDecodeRawDirect` de la version web
//! (LibRaw : `gamma: [1, 1]`, `noAutoBright`, `outputColor: 1`). Toute la dynamique du capteur
//! (12 à 14 bits) est gardée jusqu'au pipeline Camera Raw, qui ne quantifie qu'à la sortie.

use rawler::imgop::develop::{Intermediate, ProcessingStep, RawDevelop};

/// Extensions reconnues comme RAW.
pub const EXTENSIONS: &[&str] = &[
    "arw", "srf", "sr2", "cr2", "cr3", "crw", "nef", "nrw", "raf", "orf", "rw2", "rwl", "pef", "dng", "srw", "3fr", "fff", "iiq", "kdc", "dcr", "mrw", "mos", "erf", "mef",
];

pub fn is_raw(name: &str) -> bool {
    let ext = name.rsplit_once('.').map(|(_, e)| e.to_ascii_lowercase()).unwrap_or_default();
    EXTENSIONS.contains(&ext.as_str())
}

/// RAW développé : RVB linéaire (`w × h × 3`, 1.0 = blanc du capteur), blanc mesuré et
/// exposition de base (IL) qui présente l'image correctement exposée sans toucher à la marge.
pub struct Raw {
    pub w: usize,
    pub h: usize,
    pub lin: Vec<f32>,
    pub white: f32,
    pub baseline_ev: f32,
}

/// Fichier RAW lu (données brutes du capteur, pas encore dématriçées).
pub struct Sensor(rawler::RawImage);

/// Étape 1 : lecture et décodage des données du capteur.
pub fn read(bytes: &[u8]) -> Result<Sensor, String> {
    let src = rawler::rawsource::RawSource::new_from_slice(bytes);
    let decoder = rawler::get_decoder(&src).map_err(|e| format!("format RAW non pris en charge : {e}"))?;
    let mut raw = decoder.raw_image(&src, &rawler::decoders::RawDecodeParams::default(), false).map_err(|e| format!("lecture du RAW impossible : {e}"))?;
    // OpcodeList2 du DNG : rangée dans l'IFD virtuel des données brutes (pas dans dng_tags)
    let opcodes = decoder
        .ifd(rawler::decoders::WellKnownIFD::VirtualDngRawTags)
        .ok()
        .flatten()
        .and_then(|ifd| ifd.get_entry(rawler::tags::DngTag::OpcodeList2).map(|e| e.value.clone()));
    if let Some(v) = opcodes {
        apply_opcode_list2(&mut raw, v);
    }
    Ok(Sensor(raw))
}

/// Courbes de l'« OpcodeList2 » d'un DNG (MapPolynomial, MapTable), que rawler n'applique pas.
/// Les DNG « avec perte » (Lightroom, convertisseur Adobe : données 8 bits déjà dématriçées)
/// y rangent la courbe qui ramène leurs valeurs en lumière linéaire, canal par canal : sans
/// elle, le rouge et le bleu sortent deux fois trop forts et l'image est rose et délavée.
fn apply_opcode_list2(raw: &mut rawler::RawImage, list: rawler::formats::tiff::Value) {
    use rawler::formats::tiff::Value;
    let bytes = match list {
        Value::Undefined(b) | Value::Byte(b) => b,
        _ => return,
    };
    // liste d'opérations : grand-boutiste (spécification DNG), en-tête = nombre d'opérations
    let be32 = |b: &[u8], o: usize| b.get(o..o + 4).map(|s| u32::from_be_bytes([s[0], s[1], s[2], s[3]]));
    let be64f = |b: &[u8], o: usize| b.get(o..o + 8).map(|s| f64::from_be_bytes([s[0], s[1], s[2], s[3], s[4], s[5], s[6], s[7]]));
    let Some(count) = be32(&bytes, 0) else { return };
    let (w, h, cpp) = (raw.width, raw.height, raw.cpp.max(1));
    let white = |c: usize| raw.whitelevel.0.get(c).or(raw.whitelevel.0.first()).copied().unwrap_or(65535) as f64;
    let black = |c: usize| {
        let l = &raw.blacklevel.levels;
        l.get(c).or(l.first()).map_or(0.0, |r| if r.d == 0 { 0.0 } else { r.n as f64 / r.d as f64 })
    };
    let (whites, blacks): (Vec<f64>, Vec<f64>) = ((0..cpp).map(white).collect(), (0..cpp).map(black).collect());
    let mut p = 4;
    for _ in 0..count {
        let (Some(id), Some(size)) = (be32(&bytes, p), be32(&bytes, p + 12)) else { return };
        let body = &bytes[(p + 16).min(bytes.len())..(p + 16 + size as usize).min(bytes.len())];
        p += 16 + size as usize;
        // zone, plans, pas : communs à MapTable (6) et MapPolynomial (8)
        let head: Vec<u32> = (0..8).filter_map(|k| be32(body, k * 4)).collect();
        if head.len() < 8 || !(id == 6 || id == 8) {
            continue;
        }
        let (top, left, bottom, right) = (head[0] as usize, head[1] as usize, (head[2] as usize).min(h), (head[3] as usize).min(w));
        let (plane, planes, rp, cp) = (head[4] as usize, head[5] as usize, head[6].max(1) as usize, head[7].max(1) as usize);
        // valeur d'entrée → valeur de sortie, pour un plan
        let map: Box<dyn Fn(usize, f64) -> f64> = if id == 8 {
            let Some(degree) = be32(body, 32) else { continue };
            let coef: Vec<f64> = (0..=degree as usize).filter_map(|k| be64f(body, 36 + k * 8)).collect();
            let (wh, bl) = (whites.clone(), blacks.clone());
            Box::new(move |c, v| {
                // polynôme sur la valeur ramenée à 0..1 (noir → blanc)
                let range = (wh[c] - bl[c]).max(1.0);
                let x = ((v - bl[c]) / range).clamp(0.0, 1.0);
                let y = coef.iter().rev().fold(0.0, |acc, k| acc * x + k);
                bl[c] + y.clamp(0.0, 1.0) * range
            })
        } else {
            let Some(n) = be32(body, 32) else { continue };
            let table: Vec<f64> = (0..n as usize).filter_map(|k| body.get(36 + k * 2..38 + k * 2).map(|s| u16::from_be_bytes([s[0], s[1]]) as f64)).collect();
            if table.is_empty() {
                continue;
            }
            Box::new(move |_, v| table[(v.max(0.0) as usize).min(table.len() - 1)])
        };
        let apply = |get: &mut dyn FnMut(usize) -> f64, set: &mut dyn FnMut(usize, f64)| {
            for y in (top..bottom).step_by(rp) {
                for x in (left..right).step_by(cp) {
                    for c in plane..(plane + planes).min(cpp) {
                        let i = (y * w + x) * cpp + c;
                        let v = get(i);
                        set(i, map(c, v));
                    }
                }
            }
        };
        match &mut raw.data {
            rawler::RawImageData::Integer(d) => {
                let d = std::cell::RefCell::new(d);
                apply(&mut |i| d.borrow()[i] as f64, &mut |i, v| d.borrow_mut()[i] = v.round().clamp(0.0, 65535.0) as u16);
            }
            rawler::RawImageData::Float(d) => {
                let d = std::cell::RefCell::new(d);
                apply(&mut |i| d.borrow()[i] as f64, &mut |i, v| d.borrow_mut()[i] = v as f32);
            }
        }
    }
}

/// Étape 2 : développement linéaire (dématriçage, balance des blancs, couleurs) et mesures.
pub fn develop(sensor: &Sensor) -> Result<Raw, String> {
    let raw = &sensor.0;
    // toutes les étapes du développement sauf la courbe sRGB : sortie linéaire
    let dev = RawDevelop::new_with(&[
        ProcessingStep::Rescale,
        ProcessingStep::Demosaic,
        ProcessingStep::FujiRotate,
        ProcessingStep::CropActiveArea,
        ProcessingStep::WhiteBalance,
        ProcessingStep::Calibrate,
        ProcessingStep::CropDefault,
    ]);
    let (w, h, lin) = match dev.develop_intermediate(raw).map_err(|e| format!("développement du RAW impossible : {e}"))? {
        Intermediate::ThreeColor(c) => (c.width, c.height, c.data.iter().flat_map(|p| [p[0].max(0.0), p[1].max(0.0), p[2].max(0.0)]).collect::<Vec<f32>>()),
        Intermediate::Monochrome(p) => (p.width, p.height, p.data.iter().flat_map(|v| [v.max(0.0); 3]).collect()),
        Intermediate::FourColor(_) => return Err("capteur à 4 couleurs non pris en charge".into()),
    };
    if w == 0 || h == 0 {
        return Err("image RAW vide".into());
    }
    let (white, baseline_ev) = measure(&lin);
    Ok(Raw { w, h, lin, white, baseline_ev })
}

#[cfg(test)]
pub fn decode(bytes: &[u8]) -> Result<Raw, String> {
    develop(&read(bytes)?)
}

/// Blanc de la scène (centile 99,99 du canal le plus fort, comme `measureSourceWhite`) et
/// exposition de base : gris moyen ramené vers 18 %, sans dépasser +4 IL.
fn measure(lin: &[f32]) -> (f32, f32) {
    let step = (lin.len() / 3 / 200_000).max(1);
    let mut mx: Vec<f32> = Vec::new();
    let mut lum: Vec<f32> = Vec::new();
    for p in lin.chunks_exact(3).step_by(step) {
        mx.push(p[0].max(p[1]).max(p[2]));
        lum.push(0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2]);
    }
    let pct = |v: &mut Vec<f32>, q: f32| {
        v.sort_by(|a, b| a.total_cmp(b));
        v[((v.len() - 1) as f32 * q) as usize]
    };
    let white = pct(&mut mx, 0.9999).max(1e-4);
    let median = pct(&mut lum, 0.5).max(1e-5);
    // sans pousser le blanc de la scène au-delà de 4 (le reste de la marge reste récupérable)
    let ev = (0.18 / median).log2().min((4.0 / white).log2()).clamp(0.0, 4.0);
    (white, ev)
}

/// Aperçu 8 bits (vignettes, réglage automatique) : exposition de base, courbe sRGB.
pub fn to_rgba8(lin: &[f32], ev: f32) -> Vec<u8> {
    let k = 2f32.powf(ev);
    // courbe sRGB en table : une puissance par canal coûtait des centaines de ms par photo. Un cran
    // vaut moins d'un niveau de sortie, même dans les ombres, où la courbe est la plus raide
    const N: usize = 16384;
    static LUT: std::sync::OnceLock<Vec<u8>> = std::sync::OnceLock::new();
    let lut = LUT.get_or_init(|| {
        (0..N)
            .map(|i| {
                let v = i as f32 / (N - 1) as f32;
                let s = if v <= 0.0031308 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 };
                (s * 255.0 + 0.5) as u8
            })
            .collect()
    });
    let enc = |v: f32| lut[((v * k).clamp(0.0, 1.0) * (N - 1) as f32 + 0.5) as usize];
    lin.chunks_exact(3).flat_map(|p| [enc(p[0]), enc(p[1]), enc(p[2]), 255]).collect()
}

/// Réduction par moyenne de zones d'une image RVB flottante (aperçu des curseurs).
pub fn downscale(lin: &[f32], w: usize, h: usize, max: usize) -> (usize, usize, Vec<f32>) {
    if w.max(h) <= max {
        return (w, h, lin.to_vec());
    }
    let s = w.max(h) as f32 / max as f32;
    let (nw, nh) = (((w as f32 / s).round() as usize).max(1), ((h as f32 / s).round() as usize).max(1));
    let mut out = vec![0f32; nw * nh * 3];
    for y in 0..nh {
        let (y0, y1) = (y * h / nh, ((y + 1) * h / nh).max(y * h / nh + 1).min(h));
        for x in 0..nw {
            let (x0, x1) = (x * w / nw, ((x + 1) * w / nw).max(x * w / nw + 1).min(w));
            let mut acc = [0f32; 3];
            for yy in y0..y1 {
                for p in lin[(yy * w + x0) * 3..(yy * w + x1) * 3].chunks_exact(3) {
                    acc[0] += p[0];
                    acc[1] += p[1];
                    acc[2] += p[2];
                }
            }
            let n = ((y1 - y0) * (x1 - x0)) as f32;
            let o = (y * nw + x) * 3;
            out[o..o + 3].copy_from_slice(&[acc[0] / n, acc[1] / n, acc[2] / n]);
        }
    }
    (nw, nh, out)
}

#[cfg(test)]
mod tests {
    /// Décode les RAW trouvés dans MP_RAW_DIR (ignoré sans fichiers).
    #[test]
    #[ignore]
    fn decode_samples() {
        let Ok(dir) = std::env::var("MP_RAW_DIR") else { return };
        for e in std::fs::read_dir(dir).unwrap().flatten() {
            let p = e.path();
            if !super::is_raw(&p.to_string_lossy()) {
                continue;
            }
            let t = std::time::Instant::now();
            let r = super::decode(&std::fs::read(&p).unwrap());
            match r {
                Ok(r) => println!("{} : {} × {} px, blanc {:.3}, base +{:.2} IL, {} ms", p.display(), r.w, r.h, r.white, r.baseline_ev, t.elapsed().as_millis()),
                Err(e) => println!("{} : ÉCHEC {e}", p.display()),
            }
        }
    }

    /// Rendu Camera Raw d'un RAW réel (MP_RAW_FILE) : durée et luminosité moyenne.
    #[test]
    #[ignore]
    fn render_sample() {
        let Ok(f) = std::env::var("MP_RAW_FILE") else { return };
        let r = super::decode(&std::fs::read(f).unwrap()).unwrap();
        let (pw, ph, prev) = super::downscale(&r.lin, r.w, r.h, 1600);
        let mut p = crate::photo::neutral();
        p.resize(crate::photo::N, 0.0);
        p[0] += r.baseline_ev * 50.0;
        p[25] = r.white;
        p[26] = r.w as f32;
        p[27] = r.h as f32;
        let t = std::time::Instant::now();
        let out = masterpaint_core::camera_raw_linear(&prev, pw, ph, &p).unwrap();
        let mean = out.chunks_exact(4).map(|c| c[0] as f64 + c[1] as f64 + c[2] as f64).sum::<f64>() / (out.len() as f64 / 4.0 * 3.0);
        if let Ok(f) = std::env::var("MP_RAW_OUT") {
            image::save_buffer(f, &out, pw as u32, ph as u32, image::ExtendedColorType::Rgba8).unwrap();
        }
        println!("rendu {pw}x{ph} en {} ms, moyenne {mean:.1}/255 (ev {:.2}, blanc {:.3})", t.elapsed().as_millis(), r.baseline_ev, r.white);
    }
}
