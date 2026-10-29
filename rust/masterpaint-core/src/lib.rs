//! # masterpaint-core
//!
//! Moteur d'effets pixel de MasterPaint, écrit en Rust.
//!
//! * **Web** : compilé en WebAssembly (`wasm32-unknown-unknown`), chargé par
//!   `js/rust/RustCore.js`, utilisé dans le thread principal et dans chaque worker de
//!   filtres (chaque worker calcule une bande de lignes → parallélisme).
//! * **Bureau** : lié en natif dans l'application Tauri (`rust/desktop`), où
//!   [`apply_parallel`] répartit les lignes sur tous les cœurs du processeur.
//!
//! Convention : image RGBA 8 bits non prémultipliée ; un effet lit l'image source
//! complète et écrit les lignes `[y0, y1)` de la sortie.

#![allow(clippy::too_many_arguments, clippy::needless_range_loop)]

pub mod util;
/// Calculs des outils (pot de peinture, baguette magique).
pub mod region;
mod fx_adjust;
mod fx_artistic;
mod fx_blur;
mod fx_distort;
mod fx_noise;
mod fx_object;
mod fx_photo;
mod fx_plugins;
mod fx_vhs;
mod fx_chroma;
mod fx_dynamic;
mod fx_halftone;
mod fx_camraw;
mod fx_render;
mod fx_stylize;

// Exports C du module WASM autonome (version web JS) ; absent quand le cœur est une dépendance.
#[cfg(all(target_arch = "wasm32", feature = "c-abi"))]
mod wasm;

pub use util::{Img, Out, P};
pub use util::{cancel_token, cancelled, with_cancel, with_token, CancelToken};
/// Option « Aberration chromatique » des effets (voir fx_distort::chromatic_post).
pub use fx_distort::chromatic_post;
/// Remplissage de contenu (Effets › Détourage), voir fx_object::content_fill.
pub use fx_object::content_fill;
/// Niveaux et taille de point du tramage ordonné ƒ (partagés avec le calcul sur carte graphique).
pub use fx_dynamic::dither_params;

/// Identifiants des effets (mêmes noms que les `applyEffect('…')` de l'interface).
/// L'ordre définit l'identifiant numérique utilisé par l'interface WASM.
pub const EFFECTS: &[&str] = &[
    // Ajustements
    "brightness", "grayscale", "invert", "invertalpha", "sepia", "exposure", "posterize",
    "threshold", "solarize", "hsv", "vibrance", "temptint", "temperature", "colorbal",
    "curves", "levels", "autolevel", "duotone", "cmjn", "highlightsshadows", "quantize", "ral",
    // Flous / bruit
    "blur", "gaussian", "median", "reducenoise", "unfocus", "motionblur", "surfaceblur",
    "fragment", "radialblur", "zoomblur", "sketchblur",
    // Déformer
    "bulge", "pinch", "twist", "polarInvert", "tileReflect", "wave", "mirrorquad", "chromatic",
    "crystallize", "pixelate", "frosted", "dents", "cabossage", "projection3d", "rotatezoom", "straighten",
    // Styliser
    "edges", "emboss", "relief", "outline", "morphology",
    // Artistique
    "oil", "sketch", "pencilsketch",
    // Photo
    "sharpen", "unsharp", "softglow", "softenportrait", "vignette", "redeyeremove",
    // Bruit
    "addnoise", "uniformnoise", "argenticgrain", "digitalpattern",
    // Rendu
    "clouds", "turbulence", "mandelbrot", "julia",
    // Objet
    "contour", "dropshadow",
    // Plugins Paint.NET (BoltBait, Vandermotten) réécrits en Rust
    "dream", "removedust", "gridcheck", "fadeedge", "coloraccent", "transparency", "featherobj", "pastel",
    // Effets lourds portés depuis le JavaScript
    "vhs", "chroma", "dynstage", "halftone", "cameraraw",
];

/// Effets qui calculent l'image entière à chaque appel (passes globales, hasard séquentiel) :
/// ils doivent être appelés en un seul morceau, jamais par bandes.
pub const WHOLE_IMAGE: &[&str] = &["quantize", "ral", "vhs", "dynstage", "cameraraw"];

/// Numéro d'un effet d'après son nom.
pub fn effect_id(name: &str) -> Option<u32> {
    EFFECTS.iter().position(|n| *n == name).map(|i| i as u32)
}

/// Applique l'effet `id` : lit `src` (image complète), écrit les lignes [y0,y1) dans `dst`.
/// Retourne `false` si l'identifiant est inconnu.
pub fn apply(id: u32, src: &Img, dst: &mut Out, y0: usize, y1: usize, p: &P) -> bool {
    use fx_adjust as a;
    use fx_artistic as ar;
    use fx_blur as b;
    use fx_distort as d;
    use fx_noise as n;
    use fx_object as o;
    use fx_photo as ph;
    use fx_plugins as pl;
    use fx_render as r;
    use fx_stylize as s;
    let y1 = y1.min(src.h);
    if y0 >= y1 || src.w == 0 {
        return true;
    }
    match EFFECTS.get(id as usize).copied().unwrap_or("") {
        "brightness" => a::brightness(src, dst, y0, y1, p),
        "grayscale" => a::grayscale(src, dst, y0, y1, p),
        "invert" => a::invert(src, dst, y0, y1, p),
        "invertalpha" => a::invert_alpha(src, dst, y0, y1, p),
        "sepia" => a::sepia(src, dst, y0, y1, p),
        "exposure" => a::exposure(src, dst, y0, y1, p),
        "posterize" => a::posterize(src, dst, y0, y1, p),
        "threshold" => a::threshold(src, dst, y0, y1, p),
        "solarize" => a::solarize(src, dst, y0, y1, p),
        "hsv" => a::hsv(src, dst, y0, y1, p),
        "vibrance" => a::vibrance(src, dst, y0, y1, p),
        "temptint" => a::temp_tint(src, dst, y0, y1, p),
        "temperature" => a::temperature(src, dst, y0, y1, p),
        "colorbal" => a::color_balance(src, dst, y0, y1, p),
        "curves" => a::apply_luts(src, dst, y0, y1, p),
        "levels" => a::levels(src, dst, y0, y1, p),
        "autolevel" => a::auto_level(src, dst, y0, y1, p),
        "duotone" => a::duotone(src, dst, y0, y1, p),
        "cmjn" => a::cmyk(src, dst, y0, y1, p),
        "highlightsshadows" => a::highlights_shadows(src, dst, y0, y1, p),
        "quantize" => a::quantize(src, dst, y0, y1, p),
        "ral" => a::palette_convert(src, dst, y0, y1, p),
        "blur" => b::square(src, dst, y0, y1, p),
        "gaussian" => b::gaussian(src, dst, y0, y1, p),
        "median" => b::median(src, dst, y0, y1, p),
        "reducenoise" => b::reduce_noise(src, dst, y0, y1, p),
        "unfocus" => b::bokeh(src, dst, y0, y1, p),
        "motionblur" => b::motion(src, dst, y0, y1, p),
        "surfaceblur" => b::surface(src, dst, y0, y1, p),
        "fragment" => b::fragment(src, dst, y0, y1, p),
        "radialblur" => b::radial(src, dst, y0, y1, p),
        "zoomblur" => b::zoom(src, dst, y0, y1, p),
        "sketchblur" => b::sketch_blur(src, dst, y0, y1, p),
        "bulge" => d::bulge(src, dst, y0, y1, p),
        "pinch" => d::pinch(src, dst, y0, y1, p),
        "twist" => d::twist(src, dst, y0, y1, p),
        "polarInvert" => d::polar_invert(src, dst, y0, y1, p),
        "tileReflect" => d::tile_reflect(src, dst, y0, y1, p),
        "wave" => d::wave(src, dst, y0, y1, p),
        "mirrorquad" => d::mirror_quad(src, dst, y0, y1, p),
        "chromatic" => d::chromatic(src, dst, y0, y1, p),
        "crystallize" => d::crystallize(src, dst, y0, y1, p),
        "pixelate" => d::pixelate(src, dst, y0, y1, p),
        "frosted" => d::frosted(src, dst, y0, y1, p),
        "dents" => d::dents(src, dst, y0, y1, p),
        "cabossage" => d::cabossage(src, dst, y0, y1, p),
        "projection3d" => d::projection3d(src, dst, y0, y1, p),
        "rotatezoom" => d::rotate_zoom(src, dst, y0, y1, p),
        "straighten" => d::straighten(src, dst, y0, y1, p),
        "edges" => s::edges(src, dst, y0, y1, p),
        "emboss" => s::emboss(src, dst, y0, y1, p),
        "relief" => s::relief(src, dst, y0, y1, p),
        "outline" => s::outline(src, dst, y0, y1, p),
        "morphology" => s::morphology(src, dst, y0, y1, p),
        "oil" => ar::oil(src, dst, y0, y1, p),
        "sketch" => ar::ink_sketch(src, dst, y0, y1, p),
        "pencilsketch" => ar::pencil_sketch(src, dst, y0, y1, p),
        "sharpen" => ph::sharpen(src, dst, y0, y1, p),
        "unsharp" => ph::unsharp(src, dst, y0, y1, p),
        "softglow" => ph::glow(src, dst, y0, y1, p),
        "softenportrait" => ph::soften_portrait(src, dst, y0, y1, p),
        "vignette" => ph::vignette(src, dst, y0, y1, p),
        "redeyeremove" => ph::red_eye(src, dst, y0, y1, p),
        "addnoise" => n::add_noise(src, dst, y0, y1, p),
        "uniformnoise" | "argenticgrain" => n::uniform_noise(src, dst, y0, y1, p),
        "digitalpattern" => n::digital_pattern(src, dst, y0, y1, p),
        "clouds" => r::clouds(src, dst, y0, y1, p),
        "turbulence" => r::turbulence(src, dst, y0, y1, p),
        "mandelbrot" => r::fractal(false, src, dst, y0, y1, p),
        "julia" => r::fractal(true, src, dst, y0, y1, p),
        "contour" => o::contour(src, dst, y0, y1, p),
        "dropshadow" => o::drop_shadow(src, dst, y0, y1, p),
        "dream" => pl::dream(src, dst, y0, y1, p),
        "removedust" => pl::remove_dust(src, dst, y0, y1, p),
        "gridcheck" => pl::grid_checker(src, dst, y0, y1, p),
        "fadeedge" => pl::fade_edge(src, dst, y0, y1, p),
        "coloraccent" => pl::color_accent(src, dst, y0, y1, p),
        "transparency" => pl::transparency(src, dst, y0, y1, p),
        "featherobj" => pl::feather_object(src, dst, y0, y1, p),
        "pastel" => pl::pastel(src, dst, y0, y1, p),
        "vhs" => fx_vhs::vhs(src, dst, y0, y1, p),
        "chroma" => fx_chroma::chroma(src, dst, y0, y1, p),
        "dynstage" => fx_dynamic::dynamic(src, dst, y0, y1, p),
        "halftone" => fx_halftone::halftone(src, dst, y0, y1, p),
        "cameraraw" => fx_camraw::camera_raw(src, dst, y0, y1, p),
        _ => return false,
    }
    true
}

/// Applique un effet sur l'image entière, dans le thread courant (toutes plateformes,
/// y compris le web où les threads ne sont pas disponibles).
pub fn apply_image(name: &str, src: &[u8], w: usize, h: usize, params: &[f32]) -> Option<Vec<u8>> {
    let id = effect_id(name)?;
    if src.len() < w * h * 4 {
        return None;
    }
    let img = Img { d: &src[..w * h * 4], w, h };
    let mut out = src[..w * h * 4].to_vec();
    let mut o = Out { d: &mut out, base: 0 };
    if apply(id, &img, &mut o, 0, h, &P(params)) { Some(out) } else { None }
}

/// Camera Raw sur un RAW développé en flottant linéaire (RVB, `w × h × 3`) : tout le
/// traitement en flottant, une seule quantification 8 bits en sortie.
pub fn camera_raw_linear(lin: &[f32], w: usize, h: usize, params: &[f32]) -> Option<Vec<u8>> {
    if lin.len() < w * h * 3 {
        return None;
    }
    let mut out = vec![0u8; w * h * 4];
    let mut o = Out { d: &mut out, base: 0 };
    fx_camraw::camera_raw_src(w, h, &fx_camraw::Src::Linear(lin), &mut o, 0, h, &P(params));
    Some(out)
}

/// Applique un effet sur l'image entière en répartissant les lignes sur `threads` threads
/// (bureau). Retourne `None` si l'effet est inconnu.
#[cfg(not(target_arch = "wasm32"))]
pub fn apply_parallel(name: &str, src: &[u8], w: usize, h: usize, params: &[f32], threads: usize) -> Option<Vec<u8>> {
    let id = effect_id(name)?;
    if src.len() < w * h * 4 {
        return None;
    }
    let img = Img { d: &src[..w * h * 4], w, h };
    let p = P(params);
    let mut out = src[..w * h * 4].to_vec();
    let whole = WHOLE_IMAGE.contains(&name);
    let threads = if whole { 1 } else { threads.clamp(1, 64).min(h.max(1)) };
    // bandes de 32 lignes distribuées dynamiquement : équilibre la charge
    // (le bas d'une image coûte parfois bien plus que le haut).
    let rows = if whole { h.max(1) } else { 32usize.min(h.max(1)) };
    let chunks: Vec<(usize, &mut [u8])> = out.chunks_mut(rows * w * 4).enumerate().map(|(k, c)| (k * rows, c)).collect();
    let queue = std::sync::Mutex::new(chunks);
    let ok = std::sync::atomic::AtomicBool::new(true);
    // test d'annulation de l'appelant transmis aux fils de calcul
    let tok = util::cancel_token();
    std::thread::scope(|s| {
        for _ in 0..threads {
            let tok = tok.clone();
            s.spawn(|| {
                util::with_token(tok, || loop {
                    if util::cancelled() {
                        break;
                    }
                    let job = queue.lock().ok().and_then(|mut q| q.pop());
                    let Some((y0, chunk)) = job else { break };
                    let y1 = (y0 + chunk.len() / (w * 4)).min(h);
                    let mut o = Out { d: chunk, base: y0 * w * 4 };
                    if !apply(id, &img, &mut o, y0, y1, &p) {
                        ok.store(false, std::sync::atomic::Ordering::Relaxed);
                    }
                })
            });
        }
    });
    if ok.load(std::sync::atomic::Ordering::Relaxed) { Some(out) } else { None }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(w: usize, h: usize) -> Vec<u8> {
        let mut v = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                let i = (y * w + x) * 4;
                v[i] = (x * 255 / w) as u8;
                v[i + 1] = (y * 255 / h) as u8;
                v[i + 2] = ((x ^ y) & 255) as u8;
                v[i + 3] = if x < 5 { 0 } else if x < 12 { 128 } else { 255 };
            }
        }
        v
    }

    /// Les effets portés récemment tournent sans paniquer, et les effets « par bandes »
    /// donnent le même résultat découpés en 32 lignes qu'en un seul morceau.
    #[test]
    fn heavy_ports_run_and_bands_match() {
        let (w, h) = (97, 83);
        let src = image(w, h);
        let cases: &[(&str, &[f32])] = &[
            ("chroma", &[10.0, 220.0, 15.0, 30.0, 50.0, 15.0, 0.0, 100.0, 1.0, 60.0, 50.0, 20.0, 1.0, 30.0, 255.0, 20.0, 1.0]),
            ("halftone", &[2.0, 6.0, 45.0, 1.0, 1.0, 0.0, 1.0, 1.0, 1.0, 1.0, 0.2]),
            ("dynstage", &[5.0, 6.0]),
            ("cameraraw", &[30.0, 20.0, 0.0, 40.0, 0.0, -30.0, 0.0, 10.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 30.0, 20.0, 25.0, 10.0, 20.0, 40.0, 30.0, 20.0, 50.0, 0.0, 0.0, 0.0, 1.0, 0.0]),
        ];
        for (name, p) in cases {
            let whole = apply_parallel(name, &src, w, h, p, 1).expect(name);
            assert_eq!(whole.len(), src.len());
            if !WHOLE_IMAGE.contains(name) {
                let banded = apply_parallel(name, &src, w, h, p, 4).expect(name);
                assert!(whole == banded, "{name} : bandes différentes");
            }
        }
    }
}