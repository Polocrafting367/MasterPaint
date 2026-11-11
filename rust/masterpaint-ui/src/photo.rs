// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
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
/// Réglages d'une photo : ceux du moteur (N), puis la réduction du bruit (58 luminance, 59
/// couleur), lue par le moteur juste après les points des courbes (aucun ici).
pub const NP: usize = 60;
/// Plus grand côté de l'aperçu 8 bits (original affiché, vignettes, source de la zone visible).
pub const PREVIEW_MAX: usize = 1600;
/// Plus grand côté du rendu en direct (pendant qu'un curseur bouge).
#[cfg(not(target_arch = "wasm32"))]
pub const LIVE_MAX: usize = 720;
#[cfg(target_arch = "wasm32")]
pub const LIVE_MAX: usize = 480;
/// Plus grand côté du rendu haute résolution de la zone visible.
pub const HQ_MAX: usize = 2560;

#[derive(Clone)]
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
    /// compte rendu du dernier réglage automatique (type de scène, corrections)
    pub note: String,
    /// recadrage (x0, y0, x1, y1, fractions du cadre) et redressement (degrés, sens horaire),
    /// appliqués à l'export et à l'ouverture dans l'éditeur
    pub crop: (f32, f32, f32, f32),
    pub angle: f32,
    /// identifiant (sauvegarde automatique : fichier d'origine rangé sous ce numéro)
    pub uid: u64,
    /// fichier d'origine tel qu'importé (sauvegarde automatique, une seule fois)
    pub orig: Option<Arc<Vec<u8>>>,
    /// quarts de tour horaires appliqués depuis l'import
    pub rot: u8,
    /// masques (réglages locaux, onglet Masque)
    pub masks: Vec<PmMask>,
    /// historique (annuler / rétablir) : états successifs, position de l'état affiché
    pub hist: Vec<Snap>,
    pub hist_pos: usize,
    /// sujet détouré par l'IA (largeur, hauteur, alpha 0..255 de la photo entière, orientation
    /// actuelle) : masques Sujet / Arrière-plan ; recalculé après une restauration
    pub ai: Option<Arc<(usize, usize, Vec<u8>)>>,
    /// IA : 0 rien demandé, 1 en cours, 2 échec (repli sur la détection simple)
    pub ai_state: u8,
}

/// Réglages locaux d'un masque : (indice du moteur, libellé, minimum, maximum).
pub const LOCAL: [(usize, &str, f32, f32); 13] = [
    (0, "Exposition", -150.0, 150.0),
    (18, "Contraste", -80.0, 80.0),
    (5, "Hautes lumières", -170.0, 170.0),
    (3, "Ombres", -170.0, 170.0),
    (6, "Blancs", -140.0, 140.0),
    (4, "Noirs", -140.0, 140.0),
    (1, "Température", -100.0, 100.0),
    (2, "Teinte", -100.0, 100.0),
    (19, "Saturation", -100.0, 100.0),
    (16, "Clarté (micro-contraste)", -70.0, 70.0),
    (17, "Correction du voile", -70.0, 70.0),
    (21, "Netteté (piqué)", 0.0, 100.0),
    (58, "Réduction du bruit", 0.0, 100.0),
];

/// Masque du Photo Pro (genres et formes : masterpaint-core fx_camraw_masks). Points en
/// fractions de la photo, avant recadrage ; `adjust` : un écart par réglage de `LOCAL`.
#[derive(Clone, PartialEq, Debug)]
pub struct PmMask {
    pub name: String,
    pub kind: u32,
    pub visible: bool,
    pub invert: bool,
    pub amount: f32,
    pub shape: Vec<f32>,
    pub adjust: Vec<f32>,
}

impl PmMask {
    /// Nouveau masque du genre `kind`, forme par défaut au centre de l'image.
    pub fn new(kind: u32, n: usize) -> PmMask {
        let (name, shape) = match kind {
            1 => ("Dégradé linéaire", vec![0.5, 0.15, 0.5, 0.55]),
            2 => ("Dégradé radial", vec![0.5, 0.5, 0.25, 0.18, 0.0, 50.0]),
            3 => ("Pinceau", vec![0.0]),
            4 => ("Plage de luminance", vec![70.0, 100.0, 15.0]),
            5 => ("Plage de couleur", vec![0.3, 0.5, 0.8, 50.0]),
            // sélections automatiques : contour (flou) 0..100, étendue −100..100
            6 => ("Ciel", vec![10.0, 0.0]),
            7 => ("Sujet", vec![10.0, 0.0]),
            _ => ("Arrière-plan", vec![10.0, 0.0]),
        };
        PmMask { name: format!("{} {n}", crate::i18n::tr(name)), kind, visible: true, invert: false, amount: 100.0, shape, adjust: vec![0.0; LOCAL.len()] }
    }

    /// Forme complétée des valeurs par défaut qui manquent (séances d'avant un réglage : les
    /// sélections automatiques n'avaient ni contour ni étendue).
    pub fn full_shape(&self) -> Vec<f32> {
        let mut s = self.shape.clone();
        if self.kind >= 6 {
            for (i, d) in [10.0, 0.0].into_iter().enumerate() {
                if s.len() <= i {
                    s.push(d);
                }
            }
        }
        s
    }

    /// Quart de tour horaire de la forme (le point (u, v) va en (1 − v, u)).
    fn rotate90(&mut self) {
        let t = |s: &mut Vec<f32>, i: usize| {
            if i + 1 < s.len() {
                let (u, v) = (s[i], s[i + 1]);
                s[i] = 1.0 - v;
                s[i + 1] = u;
            }
        };
        match self.kind {
            1 => {
                t(&mut self.shape, 0);
                t(&mut self.shape, 2);
            }
            2 => {
                t(&mut self.shape, 0);
                if self.shape.len() > 3 {
                    self.shape.swap(2, 3);
                }
            }
            3 => {
                let ns = self.shape.first().copied().unwrap_or(0.0) as usize;
                let mut i = 1;
                for _ in 0..ns {
                    let np = self.shape.get(i + 4).copied().unwrap_or(0.0) as usize;
                    i += 5;
                    for k in 0..np {
                        t(&mut self.shape, i + 2 * k);
                    }
                    i += 2 * np;
                }
            }
            _ => {}
        }
    }

    /// Ajoute un trait de pinceau (taille en fraction du grand côté, contour et flux 0..100).
    pub fn add_stroke(&mut self, size: f32, feather: f32, flow: f32, erase: bool, pts: &[(f32, f32)]) {
        if self.shape.is_empty() {
            self.shape.push(0.0);
        }
        self.shape[0] += 1.0;
        self.shape.extend_from_slice(&[size, feather, flow, if erase { 1.0 } else { 0.0 }, pts.len() as f32]);
        for p in pts {
            self.shape.extend_from_slice(&[p.0, p.1]);
        }
    }
}

/// État d'une photo pour l'historique et la sauvegarde automatique : positions des curseurs,
/// filtre, recadrage, rotation et masques (jamais de pixels).
#[derive(Clone, PartialEq, Debug)]
pub struct Snap {
    pub params: Vec<f32>,
    pub preset: i32,
    pub crop: (f32, f32, f32, f32),
    pub angle: f32,
    pub rot: u8,
    pub masks: Vec<PmMask>,
}

static NEXT_UID: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

/// Identifiant neuf d'une photo (unique dans la séance, et d'une séance à l'autre grâce à l'heure).
pub fn new_uid() -> u64 {
    // heure réelle (ms depuis 1970) : unique d'une séance à l'autre. Navigateur : Date
    // (std::time y panique, « time not implemented on this platform »)
    #[cfg(target_arch = "wasm32")]
    let t = js_sys::Date::now().max(0.0) as u64;
    #[cfg(not(target_arch = "wasm32"))]
    let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map_or(0, |d| d.as_millis() as u64);
    (t << 8) + NEXT_UID.fetch_add(1, std::sync::atomic::Ordering::Relaxed) % 256
}

/// Histogramme RVB (façon Lightroom) d'un aperçu RGBA : image 256 × 96 (couleurs additives,
/// fond transparent) et alertes d'écrêtage (noirs bouchés, blancs brûlés au-delà de 0,2 %).
pub fn histogram(px: &[u8]) -> (Vec<u8>, bool, bool) {
    const W: usize = 256;
    const H: usize = 96;
    let n = px.len() / 4;
    let stride = (n / 250_000).max(1);
    let mut bins = [[0u32; 256]; 3];
    let (mut lo, mut hi, mut cnt) = (0usize, 0usize, 0usize);
    for p in px.chunks_exact(4).step_by(stride) {
        if p[3] == 0 {
            continue;
        }
        cnt += 1;
        for c in 0..3 {
            bins[c][p[c] as usize] += 1;
        }
        if p[0].max(p[1]).max(p[2]) <= 1 {
            lo += 1;
        }
        if p[0].max(p[1]).max(p[2]) >= 254 {
            hi += 1;
        }
    }
    // échelle : 99e centile des barres (un pic de noir ou de blanc n'écrase pas le reste)
    let mut all: Vec<u32> = bins.iter().flat_map(|b| b[1..255].iter().copied()).collect();
    all.sort_unstable();
    let top = all.get(all.len() * 99 / 100).copied().unwrap_or(1).max(1) as f32;
    let mut img = vec![0u8; W * H * 4];
    let colors = [[230u8, 70, 70], [80, 210, 90], [80, 130, 255]];
    for x in 0..W {
        for c in 0..3 {
            let v = ((bins[c][x] as f32 / top).min(1.0) * H as f32) as usize;
            for y in H - v..H {
                let o = (y * W + x) * 4;
                for k in 0..3 {
                    img[o + k] = img[o + k].saturating_add(colors[c][k] / 2 + 20);
                }
                img[o + 3] = 230;
            }
        }
    }
    let lim = (cnt / 500).max(1);
    (img, lo > lim, hi > lim)
}

/// Couleur linéaire moyenne (0..1) autour du point (u, v) (0..1) d'une source de rendu
/// `w × h` : pipette de balance des blancs.
pub fn sample_linear(src: &Src, w: usize, h: usize, u: f32, v: f32) -> [f64; 3] {
    let (cx, cy) = ((u * w as f32) as isize, (v * h as f32) as isize);
    let r = ((w.max(h) / 200) as isize).max(2);
    let mut acc = [0f64; 3];
    let mut n = 0.0f64;
    for y in (cy - r).max(0)..(cy + r + 1).min(h as isize) {
        for x in (cx - r).max(0)..(cx + r + 1).min(w as isize) {
            let i = y as usize * w + x as usize;
            match src {
                Src::Lin(l) => {
                    for c in 0..3 {
                        acc[c] += l.get(i * 3 + c).copied().unwrap_or(0.0) as f64;
                    }
                }
                Src::U8(p) => {
                    for c in 0..3 {
                        let s = p.get(i * 4 + c).copied().unwrap_or(0) as f64 / 255.0;
                        acc[c] += if s <= 0.04045 { s / 12.92 } else { ((s + 0.055) / 1.055).powf(2.4) };
                    }
                }
            }
            n += 1.0;
        }
    }
    acc.map(|v| v / n.max(1.0))
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
    /// fichiers importés en attente de leur photo (nom, octets d'origine) : rangés pour la
    /// sauvegarde automatique quand la photo arrive (pm_store)
    pub pending_orig: Vec<(String, Arc<Vec<u8>>)>,
    /// restauration au démarrage : photos attendues (identifiant, nom, état) et photo active
    pub restore: Vec<(u64, String, Snap)>,
    pub restore_active: usize,
    pub restoring: bool,
    /// masque sélectionné dans l'onglet Masque (-1 : aucun)
    pub mask_sel: i32,
    /// pinceau des masques : taille (% du grand côté), contour, flux, gomme
    pub brush: (f32, f32, f32, bool),
    /// trait de pinceau en cours (points) et forme du masque avant ce trait
    pub stroke: Vec<(f32, f32)>,
    pub stroke_base: Vec<f32>,
    /// dernier aperçu rendu (largeur, hauteur, RGBA) : pipette de la plage de couleur
    pub last_live: (usize, usize, Arc<Vec<u8>>),
}

/// Réglages neutres (finesse du grain 50, graine 1, comme la version web).
pub fn neutral() -> Vec<f32> {
    let mut p = vec![0.0; NP];
    p[24] = 50.0;
    p[28] = 1.0;
    p
}

/// Préréglages (Galerie de filtres / Photo Mode Pro de la version web) : 0 = aucun (manuel).
/// Puis les looks de LightCraft (lightcraft_looks_gen.rs), à la suite.
pub fn preset_names() -> Vec<&'static str> {
    std::iter::once("Aucun (manuel)")
        .chain(crate::gallery_gen::PRESETS.iter().map(|p| p.1))
        .chain(crate::lightcraft_looks_gen::LOOKS.iter().map(|p| p.1))
        .collect()
}

/// Réglages qu'un préréglage n'additionne pas : tailles, blanc du RAW, graine du grain, masque,
/// nombres de points des courbes, réduction du bruit (ils restent ceux de l'utilisateur).
fn structural(i: usize) -> bool {
    matches!(i, 25..=29 | 54..=57) || i >= N
}

/// Part d'un préréglage dans chaque réglage (préréglage − neutre ; 0 pour les réglages
/// structurels). Le filtre s'ajoute aux réglages de l'utilisateur au lieu de les remplacer.
pub fn preset_delta(i: i32) -> Vec<f32> {
    let (p, n) = (preset_params(i), neutral());
    (0..NP).map(|k| if structural(k) || i <= 0 { 0.0 } else { p[k] - n[k] }).collect()
}

/// Réglages effectifs : ceux de l'utilisateur plus la part du préréglage `preset`. Un
/// préréglage noir et blanc (saturation −100) reste en noir et blanc quelle que soit la
/// saturation de l'utilisateur.
pub fn with_preset(params: &[f32], preset: i32) -> Vec<f32> {
    let mut v = params.to_vec();
    v.resize(NP, 0.0);
    if preset <= 0 {
        return v;
    }
    let d = preset_delta(preset);
    for k in 0..NP {
        v[k] += d[k];
    }
    if preset_params(preset)[19] <= -100.0 {
        v[19] = -100.0;
    }
    v
}

pub fn preset_params(i: i32) -> Vec<f32> {
    if i <= 0 {
        return neutral();
    }
    let k = (i - 1) as usize;
    let g = crate::gallery_gen::PRESETS;
    let mut v = match g.get(k) {
        Some(p) => p.2.to_vec(),
        None => crate::lightcraft_looks_gen::LOOKS.get(k - g.len()).map_or_else(neutral, |p| p.3.to_vec()),
    };
    v.resize(NP, 0.0);
    v
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
            note: String::new(),
            crop: (0.0, 0.0, 1.0, 1.0),
            angle: 0.0,
            uid: new_uid(),
            orig: None,
            rot: 0,
            masks: Vec::new(),
            hist: Vec::new(),
            hist_pos: 0,
            ai: None,
            ai_state: 0,
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
            note: String::new(),
            crop: (0.0, 0.0, 1.0, 1.0),
            angle: 0.0,
            uid: new_uid(),
            orig: None,
            rot: 0,
            masks: Vec::new(),
            hist: Vec::new(),
            hist_pos: 0,
            ai: None,
            ai_state: 0,
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
        // taille de la zone en pixels d'origine : rayon de la réduction du bruit et taille du
        // grain à la même échelle que l'image entière (avant : la largeur de toute la photo,
        // une zone agrandie était lissée sur 1 pixel, la réduction du bruit semblait sans effet)
        let mut p = self.engine_params();
        p[26] = (r.2 - r.0).max(1) as f32;
        p[27] = (r.3 - r.1).max(1) as f32;
        // masques : la zone rendue, en fractions de la photo entière
        if p.len() > NP + 5 {
            let (fw, fh) = (self.w.max(1) as f32, self.h.max(1) as f32);
            p[NP + 1] = r.0 as f32 / fw;
            p[NP + 2] = r.1 as f32 / fh;
            p[NP + 3] = r.2 as f32 / fw;
            p[NP + 4] = r.3 as f32 / fh;
        }
        RegionJob { src, sw, rect, tw, th, p, cancel: None }
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
        // le cadre de recadrage tourne avec l'image (quart de tour horaire)
        let (x0, y0, x1, y1) = self.crop;
        self.crop = (1.0 - y1, x0, 1.0 - y0, x1);
        for m in &mut self.masks {
            m.rotate90();
        }
        // carte de l'IA : même quart de tour (le point (u, v) va en (1 − v, u))
        if let Some(a) = self.ai.take() {
            let (aw, ah, src) = (a.0, a.1, &a.2);
            let mut d = vec![0u8; aw * ah];
            for y in 0..ah {
                for x in 0..aw {
                    d[x * ah + (ah - 1 - y)] = src[y * aw + x];
                }
            }
            self.ai = Some(Arc::new((ah, aw, d)));
        }
        self.rot = (self.rot + 1) % 4;
        self.modified = true;
    }

    /// État d'une photo tout juste importée (aucun réglage).
    pub fn new_snap() -> Snap {
        Snap { params: neutral(), preset: 0, crop: (0.0, 0.0, 1.0, 1.0), angle: 0.0, rot: 0, masks: Vec::new() }
    }

    /// État actuel (historique, sauvegarde).
    pub fn snap(&self) -> Snap {
        Snap { params: self.params.clone(), preset: self.preset, crop: self.crop, angle: self.angle, rot: self.rot, masks: self.masks.clone() }
    }

    /// Revient à l'état `s` (rotation refaite par quarts de tour, le reste recopié).
    pub fn apply_snap(&mut self, s: &Snap) {
        while self.rot != s.rot % 4 {
            self.rotate90();
        }
        self.params = s.params.clone();
        self.preset = s.preset;
        self.crop = s.crop;
        self.angle = s.angle;
        self.masks = s.masks.clone();
        self.modified = true;
    }

    /// Range l'état actuel dans l'historique s'il a changé ; vrai si c'est le cas.
    pub fn commit(&mut self) -> bool {
        let s = self.snap();
        if self.hist.get(self.hist_pos) == Some(&s) {
            return false;
        }
        if self.hist.is_empty() {
            self.hist.push(s);
            self.hist_pos = 0;
            return true;
        }
        self.hist.truncate(self.hist_pos + 1);
        self.hist.push(s);
        // 200 états au plus (quelques centaines d'octets chacun, sans pixels)
        if self.hist.len() > 200 {
            self.hist.remove(0);
        }
        self.hist_pos = self.hist.len() - 1;
        true
    }

    pub fn can_undo(&self) -> bool {
        self.hist_pos > 0
    }

    pub fn can_redo(&self) -> bool {
        self.hist_pos + 1 < self.hist.len()
    }

    pub fn undo(&mut self) -> bool {
        // modification pas encore rangée : rangée d'abord, pour pouvoir la rétablir
        self.commit();
        if !self.can_undo() {
            return false;
        }
        self.hist_pos -= 1;
        let s = self.hist[self.hist_pos].clone();
        self.apply_snap(&s);
        true
    }

    pub fn redo(&mut self) -> bool {
        if !self.can_redo() {
            return false;
        }
        self.hist_pos += 1;
        let s = self.hist[self.hist_pos].clone();
        self.apply_snap(&s);
        true
    }

    /// Réglages du moteur avec le seul masque `idx` (affiché même s'il est caché), pour son
    /// voile rouge dans l'onglet Masque.
    pub fn overlay_params(&self, idx: usize) -> Option<Vec<f32>> {
        let mut one = self.clone_light();
        let mut m = self.masks.get(idx)?.clone();
        m.visible = true;
        // quantité et inversion comprises, réglages sans importance pour l'alpha
        m.adjust = vec![1.0; LOCAL.len()];
        one.masks = vec![m];
        let mut p = with_preset(&self.params, 0);
        p.resize(NP, 0.0);
        p[54..58].fill(0.0);
        p.extend(one.mask_params());
        Some(p)
    }

    /// Copie légère (sans pixels : les tampons sont partagés) pour préparer des réglages.
    fn clone_light(&self) -> Photo {
        Photo { hist: Vec::new(), ..self.clone() }
    }

    /// Masques au format du moteur (après la réduction du bruit) : zone entière ; `region_job`
    /// remplace la zone. Vide sans masque visible.
    fn mask_params(&self) -> Vec<f32> {
        let vis: Vec<&PmMask> = self.masks.iter().filter(|m| m.visible).collect();
        if vis.is_empty() {
            return Vec::new();
        }
        let mut v = vec![vis.len() as f32, 0.0, 0.0, 1.0, 1.0, self.w as f32 / self.h.max(1) as f32];
        for m in vis {
            let adj: Vec<(f32, f32)> = LOCAL.iter().zip(&m.adjust).filter(|(_, d)| **d != 0.0).map(|(l, d)| (l.0 as f32, *d)).collect();
            v.extend_from_slice(&[m.kind as f32, if m.invert { 1.0 } else { 0.0 }, m.amount, adj.len() as f32]);
            for (k, d) in adj {
                v.extend_from_slice(&[k, d]);
            }
            // Sujet / Arrière-plan : contour, étendue, puis la carte de l'IA si elle est prête
            let mut shape = m.full_shape();
            if matches!(m.kind, 7 | 8) {
                shape.truncate(2);
                if let Some(a) = &self.ai {
                    shape.extend_from_slice(&[a.0 as f32, a.1 as f32]);
                    shape.extend(masterpaint_core::pack_mask_bytes(&a.2));
                }
            }
            v.push(shape.len() as f32);
            v.extend_from_slice(&shape);
        }
        v
    }

    /// Un masque visible ou choisi attend la carte de l'IA (Sujet / Arrière-plan).
    pub fn wants_ai(&self) -> bool {
        self.ai.is_none() && self.ai_state == 0 && self.masks.iter().any(|m| matches!(m.kind, 7 | 8))
    }

    /// Réglages du moteur : grain et clarté calés sur la pleine résolution, pour que l'aperçu
    /// réduit ressemble au fichier exporté.
    pub fn engine_params(&self) -> Vec<f32> {
        self.engine_params_for(&self.params)
    }

    /// Réglages du moteur pour un autre jeu de réglages de la photo (essais du réglage auto).
    pub fn engine_params_for(&self, params: &[f32]) -> Vec<f32> {
        // préréglage actif : ajouté par-dessus les réglages de l'utilisateur
        let mut p = with_preset(params, self.preset);
        // réduction du bruit en 58–59 : les points de courbe n'existent pas dans le Photo Pro
        p.resize(NP, 0.0);
        p[54..58].fill(0.0);
        p[26] = self.w as f32;
        p[27] = self.h as f32;
        // RAW : exposition de base (le curseur reste à 0) et blanc mesuré de la scène
        if self.lin.is_some() {
            p[0] += self.raw_ev * 50.0;
            p[25] = self.raw_white;
        }
        p.extend(self.mask_params());
        p
    }

    /// Part du préréglage actif dans chaque réglage, telle qu'elle s'applique (effectif −
    /// utilisateur) : affichée sur les curseurs.
    pub fn preset_shift(&self) -> Vec<f32> {
        let mut u = self.params.clone();
        u.resize(NP, 0.0);
        let e = with_preset(&u, self.preset);
        (0..NP).map(|k| e[k] - u[k]).collect()
    }

    /// Image finale en pleine résolution.
    pub fn render_full(&self) -> Vec<u8> {
        render_src(&self.full_src(), self.w, self.h, &self.engine_params())
    }

    /// Image finale en pleine résolution, 16 bits par canal (export PNG / TIFF 16 bits).
    pub fn render_full16(&self) -> Vec<u16> {
        let p = self.engine_params();
        match self.full_src() {
            Src::U8(px) => masterpaint_core::camera_raw16(Some(&px), None, self.w, self.h, &p),
            Src::Lin(l) => masterpaint_core::camera_raw16(None, Some(&l), self.w, self.h, &p),
        }
        .unwrap_or_default()
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

impl Sample for u16 {
    fn to_f(self) -> f32 {
        self as f32
    }
    fn from_f(v: f32) -> Self {
        (v + 0.5).clamp(0.0, 65535.0) as u16
    }
}

/// Agrandissement d'une image tournée de `angle` degrés pour qu'elle couvre encore tout son
/// cadre (pas de coins vides, comme « Limiter à l'image » de Lightroom).
pub fn cover_scale(w: f32, h: f32, angle: f32) -> f32 {
    let (s, c) = angle.to_radians().abs().sin_cos();
    ((w * c + h * s) / w).max((w * s + h * c) / h)
}

/// Redressement (rotation de `angle` degrés, sens horaire, image agrandie pour couvrir le cadre)
/// puis recadrage (`crop` : fractions du cadre) d'une image RVBA `w` × `h` ; bilinéaire.
pub fn geometry<T: Sample>(px: &[T], w: usize, h: usize, angle: f32, crop: (f32, f32, f32, f32)) -> (Vec<T>, usize, usize) {
    let (cx0, cy0) = (crop.0.clamp(0.0, 1.0), crop.1.clamp(0.0, 1.0));
    let (cx1, cy1) = (crop.2.clamp(cx0, 1.0), crop.3.clamp(cy0, 1.0));
    if angle == 0.0 && (cx0, cy0, cx1, cy1) == (0.0, 0.0, 1.0, 1.0) {
        return (px.to_vec(), w, h);
    }
    let (fw, fh) = (w as f32, h as f32);
    let (x0, y0) = (cx0 * fw, cy0 * fh);
    let nw = ((cx1 - cx0) * fw).round().max(1.0) as usize;
    let nh = ((cy1 - cy0) * fh).round().max(1.0) as usize;
    let k = cover_scale(fw, fh, angle);
    let (sn, cs) = (-angle).to_radians().sin_cos();
    let (mx, my) = (fw / 2.0, fh / 2.0);
    let mut out = vec![T::default(); nw * nh * 4];
    let at = |x: isize, y: isize, c: usize| px[((y.clamp(0, h as isize - 1) as usize) * w + x.clamp(0, w as isize - 1) as usize) * 4 + c].to_f();
    for oy in 0..nh {
        for ox in 0..nw {
            // point du cadre → point de l'image (rotation inverse autour du centre, puis échelle)
            let (dx, dy) = (x0 + ox as f32 + 0.5 - mx, y0 + oy as f32 + 0.5 - my);
            let sx = (dx * cs - dy * sn) / k + mx - 0.5;
            let sy = (dx * sn + dy * cs) / k + my - 0.5;
            let (ix, iy) = (sx.floor() as isize, sy.floor() as isize);
            let (fx, fy) = (sx - ix as f32, sy - iy as f32);
            let o = (oy * nw + ox) * 4;
            for c in 0..4 {
                let v = at(ix, iy, c) * (1.0 - fx) * (1.0 - fy) + at(ix + 1, iy, c) * fx * (1.0 - fy) + at(ix, iy + 1, c) * (1.0 - fx) * fy + at(ix + 1, iy + 1, c) * fx * fy;
                out[o + c] = T::from_f(v);
            }
        }
    }
    (out, nw, nh)
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
        assert_eq!(preset_params(1).len(), NP, "moteur (N) + réduction du bruit");
        assert!(preset_names().len() > 5);
    }

    #[test]
    fn crop_and_straighten() {
        // moitié gauche rouge, moitié droite bleue
        let (w, h) = (40, 20);
        let px: Vec<u8> = (0..w * h).flat_map(|i| if i % w < 20 { [255, 0, 0, 255] } else { [0, 0, 255, 255] }).collect();
        let (c, cw, ch) = geometry(&px, w, h, 0.0, (0.5, 0.0, 1.0, 1.0));
        assert_eq!((cw, ch), (20, 20));
        assert_eq!(&c[..4], &[0, 0, 255, 255], "moitié droite gardée");
        // redressé : le centre ne bouge pas, pas de coin vide (agrandissement)
        let (r, rw, rh) = geometry(&px, w, h, 10.0, (0.0, 0.0, 1.0, 1.0));
        assert_eq!((rw, rh), (w, h));
        assert!(r.chunks_exact(4).all(|p| p[3] == 255));
        assert!(cover_scale(40.0, 20.0, 10.0) > 1.0);
    }

    #[test]
    fn export16_matches_8bit_and_denoise_smooths() {
        let (w, h) = (32, 32);
        let mut seed = 7u32;
        let px: Vec<u8> = (0..w * h)
            .flat_map(|_| {
                seed = seed.wrapping_mul(1_103_515_245).wrapping_add(12345);
                let n = (seed >> 16) as u8 % 40;
                [100 + n, 120, 140 - n / 2, 255]
            })
            .collect();
        let mut p = neutral();
        p[26] = w as f32;
        p[27] = h as f32;
        let p8 = render(&px, w, h, &p);
        let p16 = masterpaint_core::camera_raw16(Some(&px), None, w, h, &p).unwrap();
        for i in 0..w * h * 4 {
            assert!((p16[i] as f32 / 257.0 - p8[i] as f32).abs() <= 1.5, "16 bits ≈ 8 bits");
        }
        // réduction du bruit couleur : moins d'écart entre pixels voisins sur le rouge
        let mut q = p.clone();
        q[59] = 100.0;
        let d = render(&px, w, h, &q);
        let var = |v: &[u8]| v.chunks_exact(4).map(|c| c[0] as f32).collect::<Vec<_>>().windows(2).map(|a| (a[0] - a[1]).abs()).sum::<f32>();
        assert!(var(&d) < var(&p8) * 0.8, "{} vs {}", var(&d), var(&p8));
    }
}
