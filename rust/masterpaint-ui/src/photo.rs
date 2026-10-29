//! Mode Photo Pro (version web : js/app/PhotoModeManager.js) : pellicule de photos, réglages
//! Camera Raw propres à chaque photo (moteur `fx_camraw`, même pipeline que la version web),
//! préréglages, réglage automatique, rotation, ouverture dans l'éditeur et export par lot.
//!
//! Rendu en deux temps, comme la version web : pendant qu'un curseur bouge, l'image entière en
//! basse résolution (`LIVE_MAX`, instantané) ; après une courte pause, la zone visible à la
//! résolution de l'écran (`RegionJob`), calculée en arrière-plan. L'export et l'ouverture dans
//! l'éditeur recalculent l'image en pleine résolution.

use std::sync::Arc;

/// Nombre de réglages du moteur Camera Raw (ordre de fx_camraw.rs).
pub const N: usize = 58;
/// Plus grand côté de l'aperçu 8 bits (original affiché, vignettes, source de la zone visible).
pub const PREVIEW_MAX: usize = 1600;
/// Plus grand côté du rendu en direct (pendant qu'un curseur bouge).
#[cfg(not(target_arch = "wasm32"))]
pub const LIVE_MAX: usize = 720;
#[cfg(target_arch = "wasm32")]
pub const LIVE_MAX: usize = 480;
/// Plus grand côté du rendu haute résolution de la zone visible.
pub const HQ_MAX: usize = 2560;

pub struct Photo {
    pub name: String,
    pub w: usize,
    pub h: usize,
    pub px: Arc<Vec<u8>>,
    pub pw: usize,
    pub ph: usize,
    pub preview: Arc<Vec<u8>>,
    pub params: Vec<f32>,
    pub modified: bool,
    pub preset: i32,
    /// vignette de la pellicule (largeur, hauteur, RGBA)
    pub thumb: (usize, usize, Vec<u8>),
    /// RAW : données linéaires en flottant (pleine résolution et aperçu, RVB) — tout le
    /// traitement se fait en flottant (14 bits du capteur), `px` / `preview` n'en sont que
    /// l'aperçu 8 bits
    pub lin: Option<(Arc<Vec<f32>>, Arc<Vec<f32>>)>,
    /// RAW : blanc mesuré de la scène (réglage 25 du moteur) et exposition de base (IL)
    pub raw_white: f32,
    pub raw_ev: f32,
    /// source du rendu en direct (`LIVE_MAX`) : 8 bits et, pour un RAW, flottante
    pub lw: usize,
    pub lh: usize,
    pub live: Arc<Vec<u8>>,
    pub lin_live: Option<Arc<Vec<f32>>>,
}

/// Source du rendu : image 8 bits ou RAW linéaire.
#[derive(Clone)]
pub enum Src {
    U8(Arc<Vec<u8>>),
    Lin(Arc<Vec<f32>>),
}

/// Rendu Camera Raw d'une source (RAW : pipeline en flottant, une quantification en sortie).
pub fn render_src(src: &Src, w: usize, h: usize, p: &[f32]) -> Vec<u8> {
    match src {
        Src::U8(px) => render(px, w, h, p),
        Src::Lin(l) => masterpaint_core::camera_raw_linear(l, w, h, p).unwrap_or_else(|| crate::raw::to_rgba8(l, 0.0)),
    }
}

#[derive(Default)]
pub struct PhotoMode {
    pub photos: Vec<Photo>,
    pub active: usize,
    /// effets affichés (bouton ON / OFF : comparer avec l'original)
    pub fx_off: bool,
    /// rendu en cours / un réglage a changé pendant le rendu / numéro du dernier rendu demandé
    pub running: bool,
    pub queued: bool,
    pub gen: u64,
    /// zone visible (x0, y0, x1, y1 entre 0 et 1) et largeur affichée de l'image (pixels
    /// logiques), et numéro du dernier rendu haute résolution demandé
    pub view: [f32; 5],
    pub hq_gen: u64,
}

/// Réglages neutres (finesse du grain 50, graine 1, comme la version web).
pub fn neutral() -> Vec<f32> {
    let mut p = vec![0.0; N];
    p[24] = 50.0;
    p[28] = 1.0;
    p
}

/// Préréglages (Galerie de filtres / Photo Mode Pro de la version web) : 0 = aucun (manuel).
pub fn preset_names() -> Vec<&'static str> {
    std::iter::once("Aucun (manuel)").chain(crate::gallery_gen::PRESETS.iter().map(|p| p.1)).collect()
}

pub fn preset_params(i: i32) -> Vec<f32> {
    match crate::gallery_gen::PRESETS.get((i - 1).max(0) as usize).filter(|_| i > 0) {
        Some(p) => p.2.to_vec(),
        None => neutral(),
    }
}

impl Photo {
    pub fn new(name: &str, w: usize, h: usize, px: Vec<u8>) -> Photo {
        let (pw, ph, preview) = downscale(&px, w, h, PREVIEW_MAX);
        let thumb = downscale(&preview, pw, ph, 120);
        let (lw, lh, live) = downscale(&preview, pw, ph, LIVE_MAX);
        Photo {
            name: name.to_string(),
            w,
            h,
            px: Arc::new(px),
            pw,
            ph,
            preview: Arc::new(preview),
            params: neutral(),
            modified: false,
            preset: 0,
            thumb,
            lin: None,
            raw_white: 0.0,
            raw_ev: 0.0,
            lw,
            lh,
            live: Arc::new(live),
            lin_live: None,
        }
    }

    /// Photo RAW : données linéaires gardées pour le rendu, aperçus 8 bits pour l'affichage.
    pub fn from_raw(name: &str, r: crate::raw::Raw) -> Photo {
        let (pw, ph, lin_prev) = crate::raw::downscale(&r.lin, r.w, r.h, PREVIEW_MAX);
        let preview = crate::raw::to_rgba8(&lin_prev, r.baseline_ev);
        let thumb = downscale(&preview, pw, ph, 120);
        let (lw, lh, lin_live) = crate::raw::downscale(&lin_prev, pw, ph, LIVE_MAX);
        let live = downscale(&preview, pw, ph, LIVE_MAX).2;
        // le RAW se traite en flottant : pas de copie 8 bits pleine résolution
        let px = Vec::new();
        Photo {
            name: name.to_string(),
            w: r.w,
            h: r.h,
            px: Arc::new(px),
            pw,
            ph,
            preview: Arc::new(preview),
            params: neutral(),
            modified: false,
            preset: 0,
            thumb,
            lin: Some((Arc::new(r.lin), Arc::new(lin_prev))),
            raw_white: r.white,
            raw_ev: r.baseline_ev,
            lw,
            lh,
            live: Arc::new(live),
            lin_live: Some(Arc::new(lin_live)),
        }
    }

    /// Source du rendu en direct (basse résolution).
    pub fn live_src(&self) -> Src {
        match &self.lin_live {
            Some(l) => Src::Lin(l.clone()),
            None => Src::U8(self.live.clone()),
        }
    }

    /// Rendu haute résolution de la zone `r` (pixels de l'image entière) à `tw` × `th` : depuis
    /// l'aperçu 1600 px s'il est assez fin, sinon depuis la pleine résolution (zoom avant).
    pub fn region_job(&self, r: (usize, usize, usize, usize), tw: usize, th: usize) -> RegionJob {
        let k = self.pw as f32 / self.w.max(1) as f32;
        let fine = (r.2 - r.0) as f32 * k >= tw as f32 * 0.98;
        let (src, sw, sh, f) = match (&self.lin, fine) {
            (Some((_, prev)), true) => (Src::Lin(prev.clone()), self.pw, self.ph, k),
            (Some((full, _)), false) => (Src::Lin(full.clone()), self.w, self.h, 1.0),
            (None, true) => (Src::U8(self.preview.clone()), self.pw, self.ph, k),
            (None, false) => (Src::U8(self.px.clone()), self.w, self.h, 1.0),
        };
        let at = |v: usize, n: usize, up: bool| {
            let x = v as f32 * f;
            (if up { x.ceil() } else { x.floor() } as usize).min(n)
        };
        let (x0, y0) = (at(r.0, sw, false).min(sw - 1), at(r.1, sh, false).min(sh - 1));
        let rect = (x0, y0, at(r.2, sw, true).max(x0 + 1).min(sw), at(r.3, sh, true).max(y0 + 1).min(sh));
        RegionJob { src, sw, rect, tw, th, p: self.engine_params(), cancel: None }
    }

    pub fn full_src(&self) -> Src {
        match &self.lin {
            Some((l, _)) => Src::Lin(l.clone()),
            None => Src::U8(self.px.clone()),
        }
    }

    /// Quart de tour horaire (image et aperçu).
    pub fn rotate90(&mut self) {
        if let Some((l, p)) = &self.lin {
            self.lin = Some((Arc::new(rot90_rgb(l, self.w, self.h)), Arc::new(rot90_rgb(p, self.pw, self.ph))));
        }
        if !self.px.is_empty() {
            self.px = Arc::new(rot90(&self.px, self.w, self.h));
        }
        self.preview = Arc::new(rot90(&self.preview, self.pw, self.ph));
        if let Some(l) = &self.lin_live {
            self.lin_live = Some(Arc::new(rot90_rgb(l, self.lw, self.lh)));
        }
        self.live = Arc::new(rot90(&self.live, self.lw, self.lh));
        (self.w, self.h) = (self.h, self.w);
        (self.pw, self.ph) = (self.ph, self.pw);
        (self.lw, self.lh) = (self.lh, self.lw);
        self.thumb = downscale(&self.preview, self.pw, self.ph, 120);
        self.modified = true;
    }

    /// Réglages du moteur : grain et clarté calés sur la pleine résolution, pour que l'aperçu
    /// réduit ressemble au fichier exporté.
    pub fn engine_params(&self) -> Vec<f32> {
        let mut p = self.params.clone();
        p.resize(N, 0.0);
        p[26] = self.w as f32;
        p[27] = self.h as f32;
        // RAW : exposition de base (le curseur reste à 0) et blanc mesuré de la scène
        if self.lin.is_some() {
            p[0] += self.raw_ev * 50.0;
            p[25] = self.raw_white;
        }
        p
    }

    /// Image finale en pleine résolution.
    pub fn render_full(&self) -> Vec<u8> {
        render_src(&self.full_src(), self.w, self.h, &self.engine_params())
    }

    pub fn stem(&self) -> String {
        let s = self.name.rsplit_once('.').map(|(a, _)| a).unwrap_or(&self.name);
        if s.is_empty() { "photo".into() } else { s.to_string() }
    }
}

/// Zone d'une photo à rendre en haute résolution (voir `Photo::region_job`).
pub struct RegionJob {
    src: Src,
    /// largeur de la source et zone dans ses pixels
    sw: usize,
    rect: (usize, usize, usize, usize),
    pub tw: usize,
    pub th: usize,
    pub p: Vec<f32>,
    /// test d'annulation (bureau) : un réglage changé arrête net un rendu devenu inutile
    pub cancel: Option<masterpaint_core::CancelToken>,
}

impl RegionJob {
    /// Pixels de la zone, ramenés à `tw` × `th`.
    pub fn extract(&self) -> Src {
        match &self.src {
            Src::Lin(l) => Src::Lin(Arc::new(crop_resize::<f32, 3>(l, self.sw, self.rect, self.tw, self.th))),
            Src::U8(u) => Src::U8(Arc::new(crop_resize::<u8, 4>(u, self.sw, self.rect, self.tw, self.th))),
        }
    }

    pub fn render(&self) -> Vec<u8> {
        masterpaint_core::with_token(self.cancel.clone(), || render_src(&self.extract(), self.tw, self.th, &self.p))
    }
}

/// Canal d'image (octet ou flottant) pour `crop_resize`.
pub trait Sample: Copy + Default {
    fn to_f(self) -> f32;
    fn from_f(v: f32) -> Self;
}

impl Sample for u8 {
    fn to_f(self) -> f32 {
        self as f32
    }
    fn from_f(v: f32) -> Self {
        (v + 0.5).clamp(0.0, 255.0) as u8
    }
}

impl Sample for f32 {
    fn to_f(self) -> f32 {
        self
    }
    fn from_f(v: f32) -> Self {
        v
    }
}

/// Zone (x0, y0, x1, y1) d'une image de largeur `w` à `C` canaux, ramenée à `tw` × `th` par
/// moyenne de blocs (pas de crénelage).
pub fn crop_resize<T: Sample, const C: usize>(px: &[T], w: usize, (x0, y0, x1, y1): (usize, usize, usize, usize), tw: usize, th: usize) -> Vec<T> {
    let (rw, rh) = (x1 - x0, y1 - y0);
    let mut out = vec![T::default(); tw * th * C];
    for y in 0..th {
        let sy0 = y0 + y * rh / th;
        let sy1 = (y0 + (y + 1) * rh / th).max(sy0 + 1).min(y1);
        for x in 0..tw {
            let sx0 = x0 + x * rw / tw;
            let sx1 = (x0 + (x + 1) * rw / tw).max(sx0 + 1).min(x1);
            let mut acc = [0f32; C];
            for yy in sy0..sy1 {
                for p in px[(yy * w + sx0) * C..(yy * w + sx1) * C].chunks_exact(C) {
                    for k in 0..C {
                        acc[k] += p[k].to_f();
                    }
                }
            }
            let n = ((sy1 - sy0) * (sx1 - sx0)) as f32;
            let o = (y * tw + x) * C;
            for k in 0..C {
                out[o + k] = T::from_f(acc[k] / n);
            }
        }
    }
    out
}

/// Pipeline Camera Raw du moteur (tous les cœurs sur le bureau).
pub fn render(src: &[u8], w: usize, h: usize, p: &[f32]) -> Vec<u8> {
    #[cfg(not(target_arch = "wasm32"))]
    let out = {
        let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
        masterpaint_core::apply_parallel("cameraraw", src, w, h, p, threads)
    };
    #[cfg(target_arch = "wasm32")]
    let out = masterpaint_core::apply_image("cameraraw", src, w, h, p);
    out.unwrap_or_else(|| src.to_vec())
}

/// Réduction par moyenne de zones (pas de crénelage, contrairement au bilinéaire).
pub fn downscale(px: &[u8], w: usize, h: usize, max: usize) -> (usize, usize, Vec<u8>) {
    if w.max(h) <= max {
        return (w, h, px.to_vec());
    }
    let s = w.max(h) as f32 / max as f32;
    let (nw, nh) = (((w as f32 / s).round() as usize).max(1), ((h as f32 / s).round() as usize).max(1));
    let mut out = vec![0u8; nw * nh * 4];
    for y in 0..nh {
        let (y0, y1) = (y * h / nh, ((y + 1) * h / nh).max(y * h / nh + 1).min(h));
        for x in 0..nw {
            let (x0, x1) = (x * w / nw, ((x + 1) * w / nw).max(x * w / nw + 1).min(w));
            let mut acc = [0u32; 4];
            for yy in y0..y1 {
                let row = &px[(yy * w + x0) * 4..(yy * w + x1) * 4];
                for p in row.chunks_exact(4) {
                    for k in 0..4 {
                        acc[k] += p[k] as u32;
                    }
                }
            }
            let n = ((y1 - y0) * (x1 - x0)) as u32;
            let o = (y * nw + x) * 4;
            for k in 0..4 {
                out[o + k] = ((acc[k] + n / 2) / n) as u8;
            }
        }
    }
    (nw, nh, out)
}

/// Quart de tour horaire d'une image RVB flottante.
fn rot90_rgb(px: &[f32], w: usize, h: usize) -> Vec<f32> {
    let mut out = vec![0f32; px.len()];
    for y in 0..h {
        for x in 0..w {
            let (nx, ny) = (h - 1 - y, x);
            let (s, d) = ((y * w + x) * 3, (ny * h + nx) * 3);
            out[d..d + 3].copy_from_slice(&px[s..s + 3]);
        }
    }
    out
}

fn rot90(px: &[u8], w: usize, h: usize) -> Vec<u8> {
    let mut out = vec![0u8; px.len()];
    for y in 0..h {
        for x in 0..w {
            let (nx, ny) = (h - 1 - y, x);
            let (s, d) = ((y * w + x) * 4, (ny * h + nx) * 4);
            out[d..d + 4].copy_from_slice(&px[s..s + 4]);
        }
    }
    out
}

fn srgb_to_linear(c: f32) -> f32 {
    if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
}

/// Réglage automatique (bouton « Auto » de la section Lumière) : médiane ramenée vers un gris
/// moyen, hautes lumières et ombres récupérées si elles sont écrêtées, contraste si l'image est
/// plate. Version simplifiée de suggestAutoParams (image-adjust-core.js).
pub fn auto_params(prev: &[u8]) -> Vec<f32> {
    let mut hist = [0u32; 256];
    let mut n = 0u32;
    for p in prev.chunks_exact(4).step_by(3) {
        let l = 0.2126 * p[0] as f32 + 0.7152 * p[1] as f32 + 0.0722 * p[2] as f32;
        hist[(l as usize).min(255)] += 1;
        n += 1;
    }
    let pct = |q: f32| -> f32 {
        let target = (q * n as f32) as u32;
        let mut acc = 0;
        for (i, c) in hist.iter().enumerate() {
            acc += c;
            if acc > target {
                return i as f32 / 255.0;
            }
        }
        1.0
    };
    auto_from(pct(0.005), pct(0.5), pct(0.995))
}

/// Réglage automatique d'une photo RAW, mesuré sur ses données flottantes (exposition de base
/// comprise) : les hautes lumières au-delà du blanc, que l'aperçu 8 bits écrête, sont vues et
/// récupérées d'autant plus qu'elles dépassent.
pub fn auto_params_lin(lin: &[f32], ev: f32) -> Vec<f32> {
    let k = 2f32.powf(ev);
    let mut lum: Vec<f32> = lin.chunks_exact(3).step_by(3).map(|c| linear_to_srgb((0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) * k)).collect();
    if lum.is_empty() {
        return neutral();
    }
    lum.sort_by(f32::total_cmp);
    let pct = |q: f32| lum[((lum.len() - 1) as f32 * q) as usize];
    auto_from(pct(0.005), pct(0.5), pct(0.995))
}

fn linear_to_srgb(v: f32) -> f32 {
    let v = v.max(0.0);
    if v <= 0.0031308 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 }
}

/// Réglages automatiques d'après les centiles 0,5 / 50 / 99,5 % de la luminance (sRVB, 1 = blanc).
fn auto_from(lo: f32, med: f32, hi: f32) -> Vec<f32> {
    let mut p = neutral();
    // exposition : 2 diaphragmes pour 100 (EXPOSURE_STOPS_PER_100), médiane visée 0,45 en sRVB
    let stops = (srgb_to_linear(0.45) / srgb_to_linear(med.max(0.02))).log2().clamp(-1.6, 1.6);
    p[0] = (stops * 50.0).round();
    if hi > 1.0 {
        // au-delà du blanc (RAW) : la marge du capteur est ramenée dans l'image
        p[5] = -(35.0 + ((hi - 1.0) * 60.0).min(50.0)).round();
        p[6] = -20.0;
    } else if hi > 0.97 {
        p[5] = -35.0; // hautes lumières
        p[6] = -15.0; // blancs
    } else if hi < 0.85 {
        p[6] = ((0.95 - hi) * 120.0).round().min(40.0);
    }
    if lo < 0.02 {
        p[3] = 25.0; // ombres
        p[4] = 10.0; // noirs
    } else if lo > 0.12 {
        p[4] = -((lo - 0.05) * 120.0).round().min(40.0);
    }
    if hi.min(1.0) - lo < 0.7 {
        p[18] = 15.0; // contraste
    }
    p[20] = 12.0; // vibrance
    p
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn downscale_and_rotate() {
        let px: Vec<u8> = (0..40 * 20).flat_map(|i| [(i % 256) as u8, 0, 0, 255]).collect();
        let (w, h, p) = downscale(&px, 40, 20, 10);
        assert_eq!((w, h, p.len()), (10, 5, 10 * 5 * 4));
        let mut ph = Photo::new("a.jpg", 40, 20, px);
        ph.rotate90();
        assert_eq!((ph.w, ph.h), (20, 40));
        assert_eq!(ph.stem(), "a");
    }

    /// RAW : la marge au-dessus du blanc (jusqu'à 2 IL) reste exploitable par les curseurs —
    /// baisser l'exposition fait réapparaître un dégradé — alors qu'une source 8 bits écrêtée
    /// n'a plus qu'un aplat.
    #[test]
    fn raw_headroom_is_recovered() {
        let (w, h) = (256usize, 2usize);
        let lin: Vec<f32> = (0..w * h).flat_map(|i| {
            let v = (i % w) as f32 / (w - 1) as f32 * 4.0;
            [v, v, v]
        }).collect();
        let mut p = neutral();
        p[0] = -100.0; // −2 IL
        p[25] = 4.0;
        p[26] = w as f32;
        p[27] = h as f32;
        let out = masterpaint_core::camera_raw_linear(&lin, w, h, &p).unwrap();
        let top = |px: &[u8]| px.chunks_exact(4).take(w).skip(w * 3 / 4).map(|c| c[0]).collect::<std::collections::BTreeSet<u8>>().len();
        let clipped: Vec<u8> = lin.chunks_exact(3).flat_map(|c| {
            let v = (c[0].min(1.0) * 255.0) as u8;
            [v, v, v, 255]
        }).collect();
        let mut p8 = p.clone();
        p8[25] = 0.0;
        let out8 = render(&clipped, w, h, &p8);
        assert!(top(&out) > 20, "dégradé au-delà du blanc perdu : {} niveaux", top(&out));
        assert!(top(&out8) <= 2, "la source 8 bits devrait être écrêtée");
    }

    /// Zone réduite : même moyenne que la zone d'origine, bonnes dimensions.
    #[test]
    fn region_crop_resize() {
        let (w, h) = (64usize, 32usize);
        let px: Vec<u8> = (0..w * h).flat_map(|i| [((i % w) * 4) as u8, 100, 0, 255]).collect();
        let out = crop_resize::<u8, 4>(&px, w, (16, 8, 48, 24), 8, 4);
        assert_eq!(out.len(), 8 * 4 * 4);
        let mean = |v: &[u8]| v.chunks_exact(4).map(|c| c[0] as f32).sum::<f32>() / (v.len() / 4) as f32;
        let src: Vec<u8> = (8..24).flat_map(|y| px[(y * w + 16) * 4..(y * w + 48) * 4].to_vec()).collect();
        assert!((mean(&out) - mean(&src)).abs() < 1.5);
        let ph = Photo::new("a.png", w, h, px);
        let job = ph.region_job((16, 8, 48, 24), 8, 4);
        assert_eq!(job.render().len(), 8 * 4 * 4);
    }

    #[test]
    fn presets_have_engine_layout() {
        assert_eq!(preset_params(0), neutral());
        assert_eq!(preset_params(1).len(), N);
        assert!(preset_names().len() > 5);
    }
}
