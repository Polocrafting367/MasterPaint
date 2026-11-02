//! Document d'édition : calques, modes de fusion, composition, sélection, historique.
//!
//! Tous les calques ont la taille du document (RGBA 8 bits non prémultiplié). La sélection
//! est un masque 0..255 de la taille du document (`None` = pas de sélection = tout).

pub use crate::colorspace::ColorMode;

/// Modes de fusion des calques : mêmes modes et même ordre que la liste « Fusion » de la
/// version web (opérations de composition du canvas : formules W3C Compositing).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Blend {
    Normal,
    Multiply,
    Screen,
    Overlay,
    SoftLight,
    HardLight,
    Darken,
    Lighten,
    ColorDodge,
    ColorBurn,
    Difference,
    Exclusion,
    Hue,
    Saturation,
    Color,
    Luminosity,
}

impl Blend {
    pub const ALL: [Blend; 16] = [
        Blend::Normal, Blend::Multiply, Blend::Screen, Blend::Overlay, Blend::SoftLight, Blend::HardLight, Blend::Darken, Blend::Lighten,
        Blend::ColorDodge, Blend::ColorBurn, Blend::Difference, Blend::Exclusion, Blend::Hue, Blend::Saturation, Blend::Color, Blend::Luminosity,
    ];
    /// Noms des opérations canvas (fichiers .illu de la version web).
    pub const CSS: [&'static str; 16] = [
        "source-over", "multiply", "screen", "overlay", "soft-light", "hard-light", "darken", "lighten", "color-dodge", "color-burn",
        "difference", "exclusion", "hue", "saturation", "color", "luminosity",
    ];

    pub fn from_index(i: i32) -> Blend {
        *Blend::ALL.get(i.max(0) as usize).unwrap_or(&Blend::Normal)
    }

    pub fn index(self) -> i32 {
        Blend::ALL.iter().position(|b| *b == self).unwrap_or(0) as i32
    }

    pub fn from_css(s: &str) -> Blend {
        Blend::CSS.iter().position(|c| *c == s).map(|i| Blend::ALL[i]).unwrap_or(Blend::Normal)
    }

    pub fn css(self) -> &'static str {
        Blend::CSS[self.index() as usize]
    }

    /// Mode séparable (canal par canal) : `s` calque du dessus, `d` dessous (0..1).
    #[inline]
    fn mix(self, s: f32, d: f32) -> f32 {
        match self {
            Blend::Multiply => s * d,
            Blend::Screen => s + d - s * d,
            Blend::Overlay => Blend::HardLight.mix(d, s),
            Blend::HardLight => {
                if s <= 0.5 {
                    d * 2.0 * s
                } else {
                    let s2 = 2.0 * s - 1.0;
                    d + s2 - d * s2
                }
            }
            Blend::SoftLight => {
                if s <= 0.5 {
                    d - (1.0 - 2.0 * s) * d * (1.0 - d)
                } else {
                    let dd = if d <= 0.25 { ((16.0 * d - 12.0) * d + 4.0) * d } else { d.sqrt() };
                    d + (2.0 * s - 1.0) * (dd - d)
                }
            }
            Blend::Darken => s.min(d),
            Blend::Lighten => s.max(d),
            Blend::ColorDodge => {
                if d <= 0.0 {
                    0.0
                } else if s >= 1.0 {
                    1.0
                } else {
                    (d / (1.0 - s)).min(1.0)
                }
            }
            Blend::ColorBurn => {
                if d >= 1.0 {
                    1.0
                } else if s <= 0.0 {
                    0.0
                } else {
                    1.0 - ((1.0 - d) / s).min(1.0)
                }
            }
            Blend::Difference => (s - d).abs(),
            Blend::Exclusion => s + d - 2.0 * s * d,
            _ => s,
        }
    }

    /// Couleur fusionnée (modes séparables et non séparables).
    #[inline]
    fn blend_rgb(self, s: [f32; 3], d: [f32; 3]) -> [f32; 3] {
        match self {
            Blend::Normal => s,
            Blend::Hue => set_lum(set_sat(s, sat(d)), lum(d)),
            Blend::Saturation => set_lum(set_sat(d, sat(s)), lum(d)),
            Blend::Color => set_lum(s, lum(d)),
            Blend::Luminosity => set_lum(d, lum(s)),
            b => [b.mix(s[0], d[0]), b.mix(s[1], d[1]), b.mix(s[2], d[2])],
        }
    }
}

// fonctions non séparables (W3C Compositing and Blending)
fn lum(c: [f32; 3]) -> f32 {
    0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]
}

fn clip_color(c: [f32; 3]) -> [f32; 3] {
    let l = lum(c);
    let n = c[0].min(c[1]).min(c[2]);
    let x = c[0].max(c[1]).max(c[2]);
    let mut o = c;
    if n < 0.0 {
        for v in o.iter_mut() {
            *v = l + (*v - l) * l / (l - n);
        }
    }
    if x > 1.0 {
        for v in o.iter_mut() {
            *v = l + (*v - l) * (1.0 - l) / (x - l);
        }
    }
    o
}

fn set_lum(c: [f32; 3], l: f32) -> [f32; 3] {
    let d = l - lum(c);
    clip_color([c[0] + d, c[1] + d, c[2] + d])
}

fn sat(c: [f32; 3]) -> f32 {
    c[0].max(c[1]).max(c[2]) - c[0].min(c[1]).min(c[2])
}

fn set_sat(c: [f32; 3], s: f32) -> [f32; 3] {
    let mx = c[0].max(c[1]).max(c[2]);
    let mn = c[0].min(c[1]).min(c[2]);
    if mx - mn <= 0.0 {
        return [0.0; 3];
    }
    c.map(|v| (v - mn) * s / (mx - mn))
}
/// Pixels d'un calque, partagés entre le document et les étapes d'historique : une copie
/// n'est faite qu'à la première écriture (`Arc::make_mut`). Un instantané d'historique ne
/// duplique donc que les calques réellement modifiés depuis l'étape précédente.
#[derive(Clone, Default)]
pub struct Px(std::sync::Arc<Vec<u8>>);

impl Px {
    /// Référence faible sur le tampon : reconnaît « le même contenu » sans le garder en vie
    /// (cache d'encodage de la sauvegarde automatique).
    pub fn weak(&self) -> std::sync::Weak<Vec<u8>> {
        std::sync::Arc::downgrade(&self.0)
    }

    /// Toujours le tampon désigné par `w`, sans écriture depuis (une écriture déplace le tampon
    /// tant qu'une référence faible existe : `Arc::make_mut`). Clé de cache qui, à la différence
    /// d'une copie de `Px`, n'oblige pas la prochaine écriture à recopier tout le calque.
    pub fn is(&self, w: &std::sync::Weak<Vec<u8>>) -> bool {
        std::sync::Weak::as_ptr(w) == std::sync::Arc::as_ptr(&self.0) && w.strong_count() > 0
    }

    /// Tampon partagé, sans copie : calculs en arrière-plan.
    pub fn arc(&self) -> std::sync::Arc<Vec<u8>> {
        self.0.clone()
    }
}

impl std::ops::Deref for Px {
    type Target = Vec<u8>;
    #[inline]
    fn deref(&self) -> &Vec<u8> {
        &self.0
    }
}

impl std::ops::DerefMut for Px {
    #[inline]
    fn deref_mut(&mut self) -> &mut Vec<u8> {
        std::sync::Arc::make_mut(&mut self.0)
    }
}

impl From<Vec<u8>> for Px {
    fn from(v: Vec<u8>) -> Self {
        Px(std::sync::Arc::new(v))
    }
}

/// Partie d'un calque hors de la toile (option « Hors toile », comme la version web) : tampon
/// placé en (x, y) dans les coordonnées du document ; ses pixels situés sur la toile ne
/// servent pas (le calque fait foi), seuls ceux du dehors comptent.
#[derive(Clone)]
pub struct Off {
    pub x: isize,
    pub y: isize,
    pub w: usize,
    pub h: usize,
    pub px: Px,
}

impl Off {
    /// Vrai si (dx, dy), coordonnées du document, est dans ce tampon et hors de la toile w × h.
    fn outside_at(&self, dx: isize, dy: isize, w: usize, h: usize) -> Option<usize> {
        let (lx, ly) = (dx - self.x, dy - self.y);
        if lx < 0 || ly < 0 || lx as usize >= self.w || ly as usize >= self.h {
            return None;
        }
        if dx >= 0 && dy >= 0 && (dx as usize) < w && (dy as usize) < h {
            return None;
        }
        Some((ly as usize * self.w + lx as usize) * 4)
    }
}

#[derive(Clone)]
pub struct Layer {
    pub name: String,
    pub px: Px,
    pub visible: bool,
    pub opacity: f32,
    pub blend: Blend,
    /// effet dynamique (pile de filtres « live ») : (type, rayon)
    pub dynamic: Option<Vec<(String, f32)>>,
    /// 0 : filtre les calques du dessous là où le calque est dessiné (luminance : blanc = actif,
    /// noir = inactif) ; 2 : filtre le dessous partout (opacité du calque) ; 1 (anciens projets) :
    /// le calque lui-même
    pub dynamic_mode: i32,
    /// rendu de l'effet dynamique (recalculé par `Doc::prepare_dynamic`)
    pub dyn_cache: Option<std::sync::Arc<Vec<u8>>>,
    /// entrées du dernier rendu dynamique (pixels sources, réglages) : recalcul seulement s'ils changent
    /// (références faibles : garder les tampons eux-mêmes forçait une copie complète du calque
    /// source à chaque écriture, donc à chaque mise à jour pendant un trait)
    pub dyn_key: Option<(Vec<std::sync::Weak<Vec<u8>>>, String)>,
    pub(crate) dyn_input: Option<DynInput>,
    pub(crate) dyn_dirty: Option<(usize, usize, usize, usize)>,
    /// chaîne d'effets gardée quand le filtre dynamique est désactivé (case « Activer »)
    pub dyn_saved: Vec<(String, f32)>,
    /// masque α lié : un octet par pixel (luminance × alpha du masque), 255 = visible
    pub mask: Option<Px>,
    /// identifiant stable (lien avec l'onglet du masque α)
    pub uid: u64,
    /// numéro du dernier calcul dynamique demandé (un résultat plus ancien est ignoré)
    pub dyn_serial: u64,
    /// contenu hors de la toile (option « Hors toile »)
    pub off: Option<Off>,
    /// verrouillé : dessin, effets et déplacement refusés (cadenas du panneau Calques)
    pub locked: bool,
    /// dossier de calques (pixels transparents, jamais dessinés) : ses enfants sont les calques
    /// dont `parent` vaut son `uid` (voir groups.rs)
    pub group: bool,
    /// dossier parent (`uid`), 0 = racine
    pub parent: u64,
    /// dossier replié dans le panneau Calques
    pub collapsed: bool,
    /// dossier en mode « Transfert » : ses enfants se fondent directement avec le dessous
    pub pass: bool,
    /// calque texte (objets vectoriels et effets non destructifs, voir vector.rs) : `px` en
    /// est le rendu
    pub vector: Option<Box<crate::vector::VectorLayer>>,
    /// mode animation : dessins de la frise (voir anim.rs) ; `px` est celui de la tête de lecture
    pub cels: Vec<crate::anim::Cel>,
    /// tampon posé par `anim::resolve` : `px` encore le même = rien à ranger dans les cels
    pub anim_shown: Option<std::sync::Weak<Vec<u8>>>,
}

#[derive(Clone)]
pub(crate) struct DynInput {
    sources: Vec<std::sync::Weak<Vec<u8>>>,
    settings: String,
    pixels: std::sync::Arc<Vec<u8>>,
}

/// Rendu dynamique à calculer (voir `Doc::dynamic_jobs`).
pub struct DynJob {
    pub uid: u64,
    pub serial: u64,
    pub src: std::sync::Arc<Vec<u8>>,
    pub stack: Vec<Stage>,
}

impl DynJob {
    /// Pile faite des seuls étages du moteur dynamique (carte graphique possible) ; `None` s'il
    /// y a un effet du menu (calculé en arrière-plan, étage par étage).
    pub fn codes(&self) -> Option<Vec<(i32, f32)>> {
        self.stack.iter().map(|s| if let Stage::Code(c, r) = s { Some((*c, *r)) } else { None }).collect()
    }
}

/// Étage d'une pile dynamique : étage du moteur fx_dynamic (code, rayon) ou effet du menu
/// (nom du moteur, réglages, intensité 0..1 : mélange avec l'image d'entrée).
#[derive(Clone, Debug, PartialEq)]
pub enum Stage {
    Code(i32, f32),
    Fx { name: String, p: Vec<f32>, mix: f32, post: Option<Vec<f32>> },
}

/// Intensité maximale d'un étage (curseur « Intensité » : 32 = effet entier).
pub const DYN_FULL: f32 = 32.0;

/// Type d'étage pour un effet du menu, gardé dans la pile `(type, intensité)` et dans le .illu
/// (`dynamicFilterStack`) : « fx » + JSON { n : nom du moteur, p : réglages, t : titre,
/// d : fenêtre d'origine, v : ses valeurs (pour la rouvrir) }. La version web ignore ce type.
pub fn fx_kind(name: &str, p: &[f32], label: &str, dialog: &str, vals: &std::collections::HashMap<String, String>) -> String {
    format!("fx{}", serde_json::json!({ "n": name, "p": p, "t": label, "d": dialog, "v": vals,
        "post": crate::effects::post_chromatic(name, &crate::effects::Vals(vals.clone())) }))
}

/// Étage désactivé (case de la liste) : préfixe « off: », ignoré au rendu (et par la version web).
pub const DYN_OFF: &str = "off:";

/// Type sans le préfixe de désactivation.
pub fn dyn_base(kind: &str) -> &str {
    kind.strip_prefix(DYN_OFF).unwrap_or(kind)
}

fn fx_json(kind: &str) -> Option<serde_json::Value> {
    dyn_base(kind).strip_prefix("fx").filter(|r| r.starts_with('{')).and_then(|r| serde_json::from_str(r).ok())
}

/// Titre affiché d'un étage « effet du menu » (`None` pour un étage du moteur dynamique).
pub fn fx_label(kind: &str) -> Option<String> {
    fx_json(kind).map(|j| j["t"].as_str().or(j["n"].as_str()).unwrap_or_default().to_string())
}

/// Fenêtre d'origine d'un effet du menu et ses valeurs (pour la rouvrir et le modifier).
pub fn fx_dialog(kind: &str) -> Option<(String, std::collections::HashMap<String, String>)> {
    let j = fx_json(kind)?;
    let d = j["d"].as_str().filter(|d| !d.is_empty())?.to_string();
    let v = j["v"].as_object().map(|o| o.iter().filter_map(|(k, v)| Some((k.clone(), v.as_str()?.to_string()))).collect()).unwrap_or_default();
    Some((d, v))
}

/// Engine identifier of a stored menu effect (also handles disabled legacy entries).
pub fn fx_engine(kind: &str) -> Option<String> {
    fx_json(kind)?.get("n")?.as_str().map(str::to_string)
}

/// A gallery and a dedicated effect window may use the same engine. Their saved
/// fields still belong to distinct dialogs and must never overwrite one another.
pub fn fx_matches(kind: &str, dialog: &str) -> bool {
    if let Some((stored,_))=fx_dialog(kind) { return stored==dialog; }
    dyn_base(kind)==dialog || fx_engine(kind).as_deref()==Some(dialog)
}

pub fn fx_params(kind: &str) -> Option<Vec<f32>> {
    fx_json(kind)?.get("p")?.as_array().map(|a| a.iter().filter_map(|v|v.as_f64()).map(|v|v as f32).collect())
}

/// Legacy radius values are not menu-effect opacity. Preserve menu intensity when
/// editing one, but convert a legacy stage at full effect strength.
pub fn replace_stage(stage: &mut (String, f32), kind: String) {
    if fx_engine(&stage.0).is_none() && fx_engine(&kind).is_some() { stage.1 = DYN_FULL; }
    stage.0 = if stage.0.starts_with(DYN_OFF) && !kind.starts_with(DYN_OFF) { [DYN_OFF,kind.as_str()].concat() } else { kind };
}

/// Change opacity without confusing a legacy radius with effect strength.
pub fn set_stage_strength(stage: &mut (String,f32), percent: f32) {
    if !percent.is_finite() { return; }
    if fx_engine(&stage.0).is_none() {
        let Some(code)=dyn_code(dyn_base(&stage.0)) else { return };
        let label=dyn_base(&stage.0).to_string();
        let kind=fx_kind("dynstage", &[code as f32,stage.1], &label, "", &Default::default());
        replace_stage(stage,kind);
    }
    stage.1=percent.clamp(0.0,100.0)*DYN_FULL/100.0;
}

/// Étage décrit par une entrée de pile `(type, intensité)` (`None` : désactivé ou inconnu).
pub fn stage_of(kind: &str, r: f32) -> Option<Stage> {
    if kind.starts_with(DYN_OFF) {
        return None;
    }
    if let Some(j) = fx_json(kind) {
        let name = j["n"].as_str().filter(|n| !n.is_empty())?.to_string();
        let p = j["p"].as_array().map(|a| a.iter().filter_map(|v| v.as_f64()).map(|v| v as f32).collect()).unwrap_or_default();
        let post = j.get("post").and_then(|v| v.as_array()).map(|a| a.iter().filter_map(|v| v.as_f64()).map(|v| v as f32).collect());
        return Some(Stage::Fx { name, p, mix: (r / DYN_FULL).clamp(0.0, 1.0), post });
    }
    dyn_code(kind).map(|c| Stage::Code(c, r))
}

/// Pile d'un calque dynamique calculée au pas `k` (aperçu rapide pendant un réglage) : les
/// réglages en pixels sont divisés par `k` pour que le rendu réduit ait l'aspect du rendu
/// final. `None` si un étage ne peut pas garder exactement son aspect à ce pas (trame de
/// Pixeliser qui ne tombe pas juste, tramage Bayer…) : essayer un pas plus petit.
pub fn draft_stages(list: &[(String, f32)], k: usize) -> Option<Vec<Stage>> {
    if k <= 1 {
        return Some(list.iter().filter_map(|(t, r)| stage_of(t, *r)).collect());
    }
    let kf = k as f32;
    // étage du moteur dynamique (fx_dynamic.rs) : rayon ramené au pas, grilles exactes
    let code = |c: i32, r: f32| -> Option<f32> {
        match c {
            0 | 1 | 5 => Some(r / kf),
            3 => {
                let bs = (r * 2.0).round().clamp(2.0, 48.0) as usize;
                (bs % k == 0 && bs / k >= 2).then(|| (bs / k) as f32 / 2.0)
            }
            4 => ((r * 1.5).max(2.0) / kf >= 2.0).then_some(r / kf),
            13 => ((r * 1.5).max(3.0) / kf >= 3.0).then_some(r / kf),
            14 => None,
            _ => Some(r),
        }
    };
    let mut out = Vec::new();
    for (t, r) in list {
        let Some(stage) = stage_of(t, *r) else { continue };
        out.push(match stage {
            Stage::Code(c, r) => Stage::Code(c, code(c, r)?),
            Stage::Fx { name, p, mix, post } if name == "dynstage" && p.len() >= 2 => {
                let r = code(p[0] as i32, p[1])?;
                Stage::Fx { name, p: vec![p[0], r], mix, post }
            }
            Stage::Fx { name, p, mix, post } => match fx_dialog(t) {
                // effet sans fenêtre : pas de réglage en pixels
                None => Stage::Fx { name, p, mix, post },
                Some((id, values)) => {
                    let (_, fields) = crate::effects::dialog(&id)?;
                    let vals = crate::effects::Vals(values);
                    if crate::effects::preview_step(fields, &vals, k) != k {
                        return None;
                    }
                    let scaled = crate::effects::scale_px(fields, &vals, 1.0 / kf);
                    // réglages du moteur qui changent avec l'échelle : repris de la version
                    // réduite ; les autres (graine, couleurs…) restent ceux de l'étage
                    let (_, base) = crate::effects::params(&id, &vals, 0, 0)?;
                    let (_, small) = crate::effects::params(&id, &scaled, 0, 0)?;
                    let p: Vec<f32> = p.iter().enumerate().map(|(i, v)| if base.get(i) != small.get(i) { small.get(i).copied().unwrap_or(*v) } else { *v }).collect();
                    let post = post.is_some().then(|| crate::effects::post_chromatic(&name, &scaled)).flatten();
                    Stage::Fx { name, p, mix, post }
                }
            },
        });
    }
    Some(out)
}

/// Calque dynamique dont la zone est affichée en niveaux de gris au lieu du rendu (bouton
/// « Zone N&B » de la fenêtre Filtre dynamique) ; 0 = aucun.
pub static DYN_ZONE_VIEW: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);

fn zone_view() -> u64 {
    DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed)
}

/// Pixels en niveaux de gris (luminance), alpha gardé : la zone d'un calque dynamique se peint
/// en blanc (effet actif) / noir (inactif), comme un masque α.
pub fn to_gray(px: &mut [u8]) {
    for p in px.chunks_exact_mut(4) {
        let l = (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32).round() as u8;
        p[0] = l;
        p[1] = l;
        p[2] = l;
    }
}

/// Code d'étape du moteur (fx_dynamic.rs) d'un type de filtre dynamique.
pub fn dyn_code(t: &str) -> Option<i32> {
    ["blur", "gaussian", "sharpen", "pixelate", "halftone", "shadow", "grayscale", "sepia", "invert", "brightness", "contrast", "saturate", "hue", "printscreen", "bayer"]
        .iter()
        .position(|k| *k == t)
        .map(|i| i as i32)
}

/// Chaîne d'effets dynamiques sur le processeur (moteur masterpaint-core).
pub fn cpu_stack(src: &[u8], w: usize, h: usize, stack: &[(i32, f32)]) -> Vec<u8> {
    let mut img = src.to_vec();
    for (c, r) in stack {
        if let Some(o) = masterpaint_core::apply_image("dynstage", &img, w, h, &[*c as f32, *r]) {
            img = o;
        }
    }
    img
}

/// Identifiants uniques des documents et des calques.
pub fn next_uid() -> u64 {
    static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    N.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
}

impl Layer {
    pub fn new(name: &str, w: usize, h: usize, fill: [u8; 4]) -> Self {
        let mut px = vec![0u8; w * h * 4];
        if fill != [0, 0, 0, 0] {
            for p in px.chunks_exact_mut(4) {
                p.copy_from_slice(&fill);
            }
        }
        Layer {
            name: name.into(),
            px: px.into(),
            visible: true,
            opacity: 1.0,
            blend: Blend::Normal,
            dynamic: None,
            dynamic_mode: 0,
            dyn_cache: None,
            dyn_key: None,
            dyn_input: None,
            dyn_dirty: None,
            dyn_saved: Vec::new(),
            mask: None,
            uid: next_uid(),
            dyn_serial: 0,
            off: None,
            locked: false,
            group: false,
            parent: 0,
            collapsed: false,
            pass: true,
            vector: None,
            cels: Vec::new(),
            anim_shown: None,
        }
    }
}

/// Étape d'historique : état complet (calques, calque actif, taille). La sélection n'en fait
/// pas partie (sélectionner n'ajoute pas d'étape) ; seules les actions qui la modifient avec
/// les pixels (déplacer, transformer, coller, recadrer…) gardent son avant / après.
#[derive(Clone)]
pub struct Snapshot {
    pub label: String,
    pub w: usize,
    pub h: usize,
    pub layers: Vec<Layer>,
    pub active: usize,
    pub sel_change: Option<(Option<Vec<u8>>, Option<Vec<u8>>)>,
    pub mode: ColorMode,
    /// réglages de l'animation (mode animation activé / quitté, durée…)
    pub anim: Option<crate::anim::Anim>,
}

pub struct Doc {
    pub w: usize,
    pub h: usize,
    pub layers: Vec<Layer>,
    pub active: usize,
    pub sel: Option<Vec<u8>>,
    pub history: Vec<Snapshot>,
    pub hindex: usize,
    pub title: String,
    pub uid: u64,
    /// onglet « α » : masque du calque `.1` du document `.0` (écrit dans ce calque à chaque modification)
    pub mask_of: Option<(u64, u64)>,
    /// état de l'historique au dernier export (étape, nombre d'étapes) : sert à savoir si le
    /// document a des modifications non exportées
    pub saved: (usize, usize),
    /// espace de couleur du projet (Fichier › Espace de couleur)
    pub mode: ColorMode,
    /// sélection à la dernière étape (ou au dernier changement de sélection sans étape) : une
    /// étape qui la trouve différente l'a modifiée elle-même et garde l'avant / après
    pub sel_ref: Option<Vec<u8>>,
    /// centre des axes de symétrie (pixels du document) ; None = centre de l'image
    pub sym: Option<(f32, f32)>,
    /// mode animation (frise) : réglages ; les dessins sont dans `Layer::cels`
    pub anim: Option<crate::anim::Anim>,
    /// mode SVG (Image › Mode du projet) : nouveaux calques en calques SVG, formes et textes
    /// toujours gardés en objets modifiables
    pub vector_mode: bool,
}

/// Nombre maximal d'étapes d'historique conservées (Paramètres › Données).
pub static HISTORY_MAX: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(40);

impl Doc {
    pub fn new(w: usize, h: usize, bg: [u8; 4], title: &str) -> Self {
        let mut d = Doc {
            w,
            h,
            layers: vec![Layer::new(&crate::i18n::tr("Arrière-plan"), w, h, bg)],
            active: 0,
            sel: None,
            history: vec![],
            hindex: 0,
            title: title.into(),
            uid: next_uid(),
            mask_of: None,
            saved: (0, 1),
            mode: ColorMode::Rgb,
            sel_ref: None,
            sym: None,
            anim: None,
            vector_mode: false,
        };
        d.history.push(d.snapshot("Nouveau Document"));
        d
    }

    /// Copie légère pour la sauvegarde automatique (pixels partagés, sans historique).
    pub fn light_clone(&self) -> Doc {
        let mut d = Doc::scratch(self.w, self.h, self.layers.clone());
        d.active = self.active;
        d.title = self.title.clone();
        d.uid = self.uid;
        d.mask_of = self.mask_of;
        d.mode = self.mode;
        d.anim = self.anim.clone();
        d.vector_mode = self.vector_mode;
        d
    }

    /// Document de travail sans historique (composition d'une partie des calques).
    pub(crate) fn scratch(w: usize, h: usize, layers: Vec<Layer>) -> Doc {
        Doc { w, h, layers, active: 0, sel: None, history: vec![], hindex: 0, title: String::new(), uid: 0, mask_of: None, saved: (0, 0), mode: ColorMode::Rgb, sel_ref: None, sym: None, anim: None, vector_mode: false }
    }

    /// Masque α (un octet par pixel) calculé depuis l'image d'un onglet de masque.
    pub fn mask_values(&self) -> Px {
        let flat = self.flatten();
        flat.chunks_exact(4)
            .map(|p| ((0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32) * p[3] as f32 / 255.0 + 0.5) as u8)
            .collect::<Vec<u8>>()
            .into()
    }

    pub fn from_pixels(w: usize, h: usize, px: Vec<u8>, title: &str) -> Self {
        let mut d = Doc::new(w, h, [0, 0, 0, 0], title);
        d.layers[0].px = px.into();
        d.history.clear();
        d.history.push(d.snapshot("Ouvrir l'image"));
        d
    }

    fn snapshot(&self, label: &str) -> Snapshot {
        let mut layers = self.layers.clone();
        // Input previews are disposable; never pin another full image in undo history.
        for layer in &mut layers { layer.dyn_input = None; layer.dyn_dirty = None; }
        Snapshot { label: label.into(), w: self.w, h: self.h, layers, active: self.active, sel_change: None, mode: self.mode, anim: self.anim.clone() }
    }

    /// La sélection a changé sans étape d'historique (outils de sélection, Ctrl+A, Ctrl+D…) :
    /// l'annulation de l'étape suivante ne la remettra pas.
    pub fn selection_changed(&mut self) {
        self.sel_ref = self.sel.clone();
    }

    /// Enregistre l'état courant comme nouvelle étape d'historique.
    pub fn commit(&mut self, label: &str) {
        // mode animation : ce que les outils ont changé rejoint les dessins de la frise
        crate::anim::stash(self);
        self.history.truncate(self.hindex + 1);
        let mut snap = self.snapshot(label);
        if self.sel != self.sel_ref {
            // l'action a modifié la sélection avec les pixels : l'annuler la remet
            snap.sel_change = Some((self.sel_ref.take(), self.sel.clone()));
            self.sel_ref = self.sel.clone();
        }
        self.history.push(snap);
        if self.history.len() > HISTORY_MAX.load(std::sync::atomic::Ordering::Relaxed) {
            // on garde l'état initial comme base : on fusionne la 2e étape dans la 1re
            self.history.remove(1);
        }
        self.hindex = self.history.len() - 1;
    }

    /// Pixels gardés par l'historique (Paramètres › Infos techniques).
    pub fn history_layers(&self) -> impl Iterator<Item = &Px> {
        self.history.iter().flat_map(|s| s.layers.iter().map(|l| &l.px))
    }

    /// Oublie les étapes passées (mémoire) : l'état courant devient la seule étape.
    pub fn clear_history(&mut self) {
        let modified = self.modified();
        let snap = self.snapshot("Historique vidé");
        self.history = vec![snap];
        self.hindex = 0;
        self.saved = if modified { (usize::MAX, 0) } else { (0, 1) };
    }

    pub fn goto(&mut self, i: usize) {
        if i >= self.history.len() {
            return;
        }
        // sélection : celle des étapes traversées qui l'ont modifiée (avant si on annule, après
        // si on rétablit) ; sinon la sélection courante reste
        let from = self.hindex.min(self.history.len() - 1);
        let mut sel = None;
        if i < from {
            for k in (i + 1..=from).rev() {
                if let Some((before, _)) = &self.history[k].sel_change {
                    sel = Some(before.clone());
                }
            }
        } else {
            for k in from + 1..=i {
                if let Some((_, after)) = &self.history[k].sel_change {
                    sel = Some(after.clone());
                }
            }
        }
        let s = &self.history[i];
        self.w = s.w;
        self.h = s.h;
        self.layers = s.layers.clone();
        self.active = s.active.min(self.layers.len() - 1);
        self.mode = s.mode;
        // animation : structure de l'étape, mais la tête de lecture reste où elle est
        let playhead = self.anim.as_ref().map(|a| a.playhead);
        self.anim = s.anim.clone();
        if let (Some(a), Some(t)) = (self.anim.as_mut(), playhead) {
            a.playhead = t.min(a.duration.saturating_sub(1));
        }
        crate::anim::resolve(self);
        if let Some(m) = sel {
            self.sel = m;
        }
        if self.sel.as_ref().map_or(false, |m| m.len() != self.w * self.h) {
            self.sel = None;
        }
        self.sel_ref = self.sel.clone();
        self.hindex = i;
    }

    /// Modifications depuis le dernier export (ou l'ouverture).
    pub fn modified(&self) -> bool {
        (self.hindex, self.history.len()) != self.saved
    }

    pub fn mark_saved(&mut self) {
        self.saved = (self.hindex, self.history.len());
    }

    pub fn undo(&mut self) {
        if self.hindex > 0 {
            self.goto(self.hindex - 1);
        }
    }

    pub fn redo(&mut self) {
        if self.hindex + 1 < self.history.len() {
            self.goto(self.hindex + 1);
        }
    }

    /// Nouveau projet créé directement dans un espace de couleur (le fond n'est pas converti,
    /// comme dans la version web).
    pub fn with_mode(mut self, mode: ColorMode) -> Self {
        self.mode = mode;
        for s in &mut self.history {
            s.mode = mode;
        }
        self
    }

    /// Change l'espace de couleur du projet : tous les calques sont ramenés dans le nouvel espace.
    pub fn set_color_mode(&mut self, mode: ColorMode) {
        self.mode = mode;
        for l in &mut self.layers {
            mode.convert_px(&mut l.px);
        }
    }

    pub fn layer(&self) -> &Layer {
        &self.layers[self.active]
    }

    pub fn layer_mut(&mut self) -> &mut Layer {
        &mut self.layers[self.active]
    }

    /// Couverture de sélection d'un pixel (255 = modifiable).
    #[inline]
    pub fn sel_at(&self, i: usize) -> u8 {
        match &self.sel {
            Some(m) => m[i],
            None => 255,
        }
    }

    // ------------------------------------------------------------ composition

    /// Composition de tous les calques visibles (RGBA, transparence conservée).
    pub fn flatten(&self) -> Vec<u8> {
        let mut out = vec![0u8; self.w * self.h * 4];
        self.composite_rect(&mut out, 0, 0, self.w, self.h, false);
        out
    }

    /// Calques dynamiques dont le rendu est à refaire (entrées changées depuis le dernier calcul) :
    /// (identifiant du calque, numéro du calcul, image source, chaîne d'effets). Comme
    /// dynamic-render-worker.js : mode 0 = calques du dessous, mode 1 = le calque lui-même.
    pub fn dynamic_jobs(&mut self) -> Vec<DynJob> {
        self.dynamic_jobs_excluding(&std::collections::HashSet::new())
    }

    /// One job per layer at a time. Dependent adjustment layers wait for their
    /// lower neighbours' newest cache rather than capturing stale input.
    pub fn dynamic_jobs_excluding(&mut self, in_flight: &std::collections::HashSet<u64>) -> Vec<DynJob> {
        let (w, h) = (self.w, self.h);
        let mut jobs = Vec::new();
        let mut pending = in_flight.clone();
        for i in 0..self.layers.len() {
            if pending.contains(&self.layers[i].uid) || !self.visible_at(i) { continue; }
            let Some(stack) = self.layers[i].dynamic.clone() else {
                self.layers[i].dyn_cache = None;
                self.layers[i].dyn_key = None;
                self.layers[i].dyn_input = None;
                self.layers[i].dyn_dirty = None;
                continue;
            };
            // An empty adjustment layer is a neutral placeholder, not a blur.
            if stack.is_empty() {
                self.layers[i].dyn_cache = None;
                self.layers[i].dyn_key = None;
                self.layers[i].dyn_input = None;
                self.layers[i].dyn_dirty = None;
                continue;
            }
            // clé : tampons sources (partagés, comparés par adresse) et réglages qui comptent
            let mode = self.layers[i].dynamic_mode;
            // calques filtrés : ceux du dessous, limités au dossier qui isole le calque (un
            // filtre rangé dans un dossier ne touche pas ce qui est hors du dossier)
            let scope = self.isolating_group(i);
            let below: Vec<usize> = (0..i).filter(|&k| scope.map_or(true, |g| self.is_inside(k, g))).collect();
            if mode != 1 && below.iter().any(|&k| pending.contains(&self.layers[k].uid)) { continue; }
            let srcs: Vec<Px> = if mode == 1 { vec![self.layers[i].px.clone()] } else { below.iter().flat_map(|&k| std::iter::once(self.layers[k].px.clone()).chain(self.layers[k].mask.iter().cloned()).chain(self.layers[k].dyn_cache.iter().map(|cache| Px(cache.clone())))).collect() };
            let mut input_settings = format!("{w}x{h}|{mode}|{scope:?}");
            if mode != 1 {
                for l in below.iter().map(|&k| &self.layers[k]) {
                    input_settings += &format!("|{}{}{}{:?}|{}{}{}", l.visible, l.opacity, l.blend.index(), l.dynamic, l.parent, l.group, l.pass);
                }
            }
            let settings = format!("{stack:?}|{input_settings}");
            if let Some((ks, kset)) = &self.layers[i].dyn_key {
                if *kset == settings && ks.len() == srcs.len() && ks.iter().zip(&srcs).all(|(a, b)| b.is(a)) {
                    continue;
                }
            }
            self.layers[i].dyn_key = Some((srcs.iter().map(|p| p.weak()).collect(), settings));
            let serial = next_uid();
            self.layers[i].dyn_serial = serial;
            // Reuse the exact unfiltered input when only effect parameters changed.
            // During drawing, recompose only the dirty rectangle when the dependency
            // is plain raster content. Lower dynamic filters may spread changes and
            // therefore retain full recomposition on cache changes.
            let cached = self.layers[i].dyn_input.take();
            let dirty = self.layers[i].dyn_dirty.take();
            let compatible = cached.as_ref().is_some_and(|c| c.settings == input_settings && c.pixels.len() == w*h*4);
            let same = compatible && cached.as_ref().is_some_and(|c| c.sources.len() == srcs.len() && c.sources.iter().zip(&srcs).all(|(a,b)| b.is(a)));
            let partial = compatible && dirty.is_some() && !below.iter().any(|&k| self.layers[k].dynamic.is_some());
            let src = if same {
                cached.unwrap().pixels
            } else if partial && mode != 1 {
                let mut pixels = cached.unwrap().pixels;
                let r = dirty.unwrap();
                let target: &mut Vec<u8> = std::sync::Arc::make_mut(&mut pixels);
                Doc::scratch(w,h,below.iter().map(|&k| self.layers[k].clone()).collect())
                    .composite_rect(target.as_mut_slice(),r.0,r.1,r.2,r.3,false);
                pixels
            } else if mode == 1 {
                self.layers[i].px.arc()
            } else {
                std::sync::Arc::new(Doc::scratch(w,h,below.iter().map(|&k| self.layers[k].clone()).collect()).flatten())
            };
            self.layers[i].dyn_input = Some(DynInput { sources: srcs.iter().map(Px::weak).collect(), settings: input_settings, pixels: src.clone() });
            let stack: Vec<Stage> = stack.iter().filter_map(|(t, r)| stage_of(t, *r)).collect();
            jobs.push(DynJob { uid: self.layers[i].uid, serial, src, stack });
            pending.insert(self.layers[i].uid);
        }
        jobs
    }

    /// Accumulate paint damage for dependent adjustment inputs without recomposing
    /// the complete layer stack for each hardware sample.
    pub fn mark_dynamic_dirty(&mut self, rect: Option<(usize,usize,usize,usize)>) {
        let r = rect.unwrap_or((0,0,self.w,self.h));
        for i in self.active+1..self.layers.len() {
            if self.layers[i].dynamic.is_none() || self.layers[i].dynamic_mode == 1 { continue; }
            let scope = self.isolating_group(i);
            if !scope.map_or(true, |g| self.is_inside(self.active,g)) { continue; }
            let old = self.layers[i].dyn_dirty;
            self.layers[i].dyn_dirty = Some(old.map_or(r, |a| (a.0.min(r.0),a.1.min(r.1),a.2.max(r.2),a.3.max(r.3))));
        }
    }

    /// Range un rendu dynamique calculé (ignoré si le calque a changé depuis).
    pub fn set_dynamic(&mut self, uid: u64, serial: u64, img: Vec<u8>) {
        if let Some(l) = self.layers.iter_mut().find(|l| l.uid == uid && l.dyn_serial == serial && l.dynamic.is_some()) {
            if img.len() == self.w * self.h * 4 {
                l.dyn_cache = Some(std::sync::Arc::new(img));
            }
        }
    }


    /// Compose le rectangle [x0,x1)×[y0,y1) dans `out` (taille document). Avec `checker`,
    /// le résultat est posé sur le damier de transparence (affichage).
    pub fn composite_rect(&self, out: &mut [u8], x0: usize, y0: usize, x1: usize, y1: usize, checker: bool) {
        let w = self.w;
        let (x1, y1) = (x1.min(w), y1.min(self.h));
        if x1 <= x0 || y1 <= y0 {
            return;
        }
        let rows = &mut out[y0 * w * 4..y1 * w * 4];
        // bureau : bandes de lignes réparties sur les cœurs (au-delà de ~200 000 pixels)
        #[cfg(not(target_arch = "wasm32"))]
        {
            let n = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
            if n > 1 && (x1 - x0) * (y1 - y0) > 200_000 {
                let band = (y1 - y0).div_ceil(n);
                std::thread::scope(|sc| {
                    for (k, chunk) in rows.chunks_mut(band * w * 4).enumerate() {
                        let ys = y0 + k * band;
                        let ye = ys + chunk.len() / (w * 4);
                        sc.spawn(move || self.composite_band(chunk, ys, ye, x0, x1, checker));
                    }
                });
                return;
            }
        }
        self.composite_band(rows, y0, y1, x0, x1, checker);
    }

    /// Composition des lignes y0..y1 ; `rows` commence à la ligne y0 (largeur du document).
    fn composite_band(&self, rows: &mut [u8], y0: usize, y1: usize, x0: usize, x1: usize, checker: bool) {
        let w = self.w;
        // dossiers de calques : composition par l'arbre (groups.rs)
        if self.has_groups() {
            let tree = crate::groups::visible_tree(self);
            for y in y0..y1 {
                for x in x0..x1 {
                    let (i, o) = ((y * w + x) * 4, ((y - y0) * w + x) * 4);
                    let c = crate::groups::pixel_tree(self, &tree, i, (0.0, 0.0, 0.0, 0.0));
                    put_rgba(&mut rows[o..o + 4], c, checker, x, y);
                }
            }
            return;
        }
        let vis: Vec<&Layer> = self.layers.iter().filter(|l| l.visible && l.opacity > 0.0).collect();
        let top = vis.last().filter(|l| l.opacity >= 1.0 && l.blend == Blend::Normal && l.mask.is_none() && l.dyn_cache.is_none() && l.dynamic.is_none());
        for y in y0..y1 {
            for x in x0..x1 {
                let (i, o) = ((y * w + x) * 4, ((y - y0) * w + x) * 4);
                // calque du dessus opaque : recopié tel quel
                if let Some(l) = top.filter(|l| l.px[i + 3] == 255) {
                    rows[o..o + 4].copy_from_slice(&l.px[i..i + 4]);
                    continue;
                }
                let c = self.pixel_rgba(&vis, i);
                put_rgba(&mut rows[o..o + 4], c, checker, x, y);
            }
        }
    }

    /// Couleur affichée d'un pixel (tous les calques visibles) : pipette.
    pub fn pixel_color(&self, x: usize, y: usize) -> [u8; 4] {
        let i = (y.min(self.h - 1) * self.w + x.min(self.w - 1)) * 4;
        let (r, g, b, a) = if self.has_groups() {
            crate::groups::pixel_tree(self, &crate::groups::visible_tree(self), i, (0.0, 0.0, 0.0, 0.0))
        } else {
            let vis: Vec<&Layer> = self.layers.iter().filter(|l| l.visible && l.opacity > 0.0).collect();
            self.pixel_rgba(&vis, i)
        };
        let q = |v: f32| (v * 255.0 + 0.5) as u8;
        [q(r), q(g), q(b), q(a)]
    }

    /// Couleur composée (r, v, b, a entre 0 et 1) du pixel d'indice `i` (octet, RVBA).
    fn pixel_rgba(&self, vis: &[&Layer], i: usize) -> (f32, f32, f32, f32) {
        let (mut r, mut g, mut b, mut a) = (0f32, 0f32, 0f32, 0f32);
        // calque opaque le plus haut (fusion normale, sans masque ni effet) : il recouvre tout
        // ce qui est dessous, la composition part de lui
        let mut start = 0;
        for (k, l) in vis.iter().enumerate().rev() {
            if l.opacity >= 1.0 && l.blend == Blend::Normal && l.mask.is_none() && l.dyn_cache.is_none() && l.dynamic.is_none() && l.px[i + 3] == 255 {
                (r, g, b, a) = (l.px[i] as f32 / 255.0, l.px[i + 1] as f32 / 255.0, l.px[i + 2] as f32 / 255.0, 1.0);
                start = k + 1;
                break;
            }
        }
        for l in &vis[start..] {
            (r, g, b, a) = self.over(l, i, (r, g, b, a));
        }
        (r, g, b, a)
    }

    /// Pose le pixel `i` du calque `l` sur la couleur composée `acc` (r, v, b, a entre 0 et 1) :
    /// effet dynamique, masque α, opacité et mode de fusion.
    pub(crate) fn over(&self, l: &Layer, i: usize, acc: (f32, f32, f32, f32)) -> (f32, f32, f32, f32) {
        let (mut r, mut g, mut b, mut a) = acc;
        // zone d'un calque dynamique affichée (Zone N&B) : gris opaque, blanc = effet actif
        if l.uid == zone_view() && l.dynamic.is_some() {
            let p = &l.px;
            let m = if l.dynamic_mode == 2 {
                l.opacity
            } else {
                (0.299 * p[i] as f32 + 0.587 * p[i + 1] as f32 + 0.114 * p[i + 2] as f32) / 255.0 * (p[i + 3] as f32 / 255.0) * l.opacity
            };
            return (m, m, m, 1.0);
        }
        // effet dynamique, mode 0 : l'image filtrée remplace le dessous là où le
        // calque est clair (luminance × alpha × opacité) ; le calque n'est pas dessiné
        if let (Some(cache), 0 | 2) = (l.dyn_cache.as_ref().filter(|cache| l.dynamic.is_some() && cache.len() == self.w * self.h * 4), l.dynamic_mode) {
            let p = &l.px;
            let m = if l.dynamic_mode == 2 {
                l.opacity
            } else {
                (0.299 * p[i] as f32 + 0.587 * p[i + 1] as f32 + 0.114 * p[i + 2] as f32) / 255.0 * (p[i + 3] as f32 / 255.0) * l.opacity
            };
            if m > 0.0 {
                let fa = cache[i + 3] as f32 / 255.0;
                r += (cache[i] as f32 / 255.0 - r) * m;
                g += (cache[i + 1] as f32 / 255.0 - g) * m;
                b += (cache[i + 2] as f32 / 255.0 - b) * m;
                a += (fa - a) * m;
            }
            return (r, g, b, a);
        }
        // An adjustment's pixels define its mask; never flash that mask as a normal
        // image while its first asynchronous result is pending (or it is disabled).
        if l.dynamic_mode != 1 && (l.dynamic.is_some() || !l.dyn_saved.is_empty()) {
            return acc;
        }
        let lpx: &[u8] = match (&l.dyn_cache, l.dynamic_mode) {
            (Some(cache), 1) if cache.len() == self.w * self.h * 4 => cache,
            _ => &l.px,
        };
        let mut sa = lpx[i + 3] as f32 / 255.0 * l.opacity;
        if let Some(m) = l.mask.as_ref().filter(|m| m.len() == self.w * self.h) {
            sa *= m[i / 4] as f32 / 255.0;
        }
        over_rgba((lpx[i] as f32 / 255.0, lpx[i + 1] as f32 / 255.0, lpx[i + 2] as f32 / 255.0), sa, l.blend, acc)
    }
}

/// Porter-Duff « over » de la couleur `s` (alpha `sa`, déjà multiplié par l'opacité) sur `acc`,
/// avec la couleur fusionnée (mode `blend`) là où les deux couches se recouvrent.
pub(crate) fn over_rgba(s: (f32, f32, f32), sa: f32, blend: Blend, acc: (f32, f32, f32, f32)) -> (f32, f32, f32, f32) {
    let (r, g, b, a) = acc;
    if sa <= 0.0 {
        return acc;
    }
    let (sr, sg, sb) = s;
    let [br, bg, bb] = if a > 0.0 && blend != Blend::Normal { blend.blend_rgb([sr, sg, sb], [r, g, b]) } else { [sr, sg, sb] };
    let ao = sa + a * (1.0 - sa);
    let c = |s: f32, bl: f32, d: f32| (sa * (1.0 - a) * s + sa * a * bl + (1.0 - sa) * a * d) / ao;
    (c(sr, br, r), c(sg, bg, g), c(sb, bb, b), ao)
}

impl Doc {

    /// Affichage à l'échelle de l'écran : une image `ceil(w / ds)` × `ceil(h / ds)` dont chaque
    /// pixel couvre un bloc ds × ds du document (un échantillon au centre, quatre moyennés à
    /// partir de ds = 4). Seuls ces échantillons sont composés : une grande image vue de loin
    /// coûte ds² fois moins. `r` : rectangle de l'affichage (x0, y0, x1, y1 exclus).
    pub fn composite_scaled(&self, out: &mut [u8], ds: usize, r: (usize, usize, usize, usize), checker: bool) {
        if ds <= 1 {
            return self.composite_rect(out, r.0, r.1, r.2, r.3, checker);
        }
        let (dw, dh) = (self.w.div_ceil(ds), self.h.div_ceil(ds));
        let (x0, y0, x1, y1) = (r.0, r.1, r.2.min(dw), r.3.min(dh));
        if x1 <= x0 || y1 <= y0 {
            return;
        }
        let rows = &mut out[y0 * dw * 4..y1 * dw * 4];
        #[cfg(not(target_arch = "wasm32"))]
        {
            let n = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1);
            if n > 1 && (x1 - x0) * (y1 - y0) > 100_000 {
                let band = (y1 - y0).div_ceil(n);
                std::thread::scope(|sc| {
                    for (k, chunk) in rows.chunks_mut(band * dw * 4).enumerate() {
                        let ys = y0 + k * band;
                        let ye = ys + chunk.len() / (dw * 4);
                        sc.spawn(move || self.scaled_band(chunk, ds, ys, ye, x0, x1, checker));
                    }
                });
                return;
            }
        }
        self.scaled_band(rows, ds, y0, y1, x0, x1, checker);
    }

    fn scaled_band(&self, rows: &mut [u8], ds: usize, y0: usize, y1: usize, x0: usize, x1: usize, checker: bool) {
        let (w, h) = (self.w, self.h);
        let dw = w.div_ceil(ds);
        let vis: Vec<&Layer> = self.layers.iter().filter(|l| l.visible && l.opacity > 0.0).collect();
        // dossiers de calques : composition par l'arbre (groups.rs)
        let tree = if self.has_groups() { Some(crate::groups::visible_tree(self)) } else { None };
        let sample = |i: usize| match &tree {
            Some(t) => crate::groups::pixel_tree(self, t, i, (0.0, 0.0, 0.0, 0.0)),
            None => self.pixel_rgba(&vis, i),
        };
        // positions des échantillons dans un bloc
        let offs: &[usize] = if ds >= 4 { &[ds / 4, ds * 3 / 4] } else { &[ds / 2] };
        let n = (offs.len() * offs.len()) as f32;
        for y in y0..y1 {
            for x in x0..x1 {
                let (mut r, mut g, mut b, mut a) = (0f32, 0f32, 0f32, 0f32);
                for oy in offs {
                    let sy = (y * ds + oy).min(h - 1);
                    for ox in offs {
                        let sx = (x * ds + ox).min(w - 1);
                        let c = sample((sy * w + sx) * 4);
                        // moyenne en couleurs prémultipliées (les bords transparents ne bavent pas)
                        r += c.0 * c.3;
                        g += c.1 * c.3;
                        b += c.2 * c.3;
                        a += c.3;
                    }
                }
                let c = if a > 0.0 { (r / a, g / a, b / a, a / n) } else { (0.0, 0.0, 0.0, 0.0) };
                let o = ((y - y0) * dw + x) * 4;
                // damier à la même taille apparente qu'en pleine résolution
                put_rgba(&mut rows[o..o + 4], c, checker, x * ds, y * ds);
            }
        }
    }

    /// Fourmis sur un affichage réduit (voir `composite_scaled`), dans le rectangle `r` de
    /// l'affichage : contour de la sélection échantillonnée au centre des blocs.
    pub fn draw_ants_scaled(&self, out: &mut [u8], phase: usize, ds: usize, r: (usize, usize, usize, usize)) {
        if ds <= 1 {
            return self.draw_ants_in(out, phase, r);
        }
        let Some(m) = &self.sel else { return };
        let (w, h) = (self.w, self.h);
        let (dw, dh) = (w.div_ceil(ds) as isize, h.div_ceil(ds) as isize);
        let inside = |x: isize, y: isize| {
            if x < 0 || y < 0 || x >= dw || y >= dh {
                return false;
            }
            let (sx, sy) = ((x as usize * ds + ds / 2).min(w - 1), (y as usize * ds + ds / 2).min(h - 1));
            m[sy * w + sx] >= 128
        };
        for y in r.1 as isize..(r.3 as isize).min(dh) {
            for x in r.0 as isize..(r.2 as isize).min(dw) {
                if !inside(x, y) || (inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) {
                    continue;
                }
                let i = (y as usize * dw as usize + x as usize) * 4;
                let v = if ((x + y) as usize + phase) / 4 % 2 == 0 { 0 } else { 255 };
                out[i..i + 3].fill(v);
                out[i + 3] = 255;
            }
        }
    }

    /// Pixels du contour de la sélection dans l'affichage au pas `ds`, rectangle `r` (indices
    /// de pixel de l'affichage) : mêmes pixels que `draw_ants_scaled`, calculés une fois pour
    /// l'animation des fourmis.
    pub fn ant_edges(&self, ds: usize, r: (usize, usize, usize, usize)) -> Vec<u32> {
        let Some(m) = &self.sel else { return Vec::new() };
        let ds = ds.max(1);
        let (w, h) = (self.w, self.h);
        let (dw, dh) = (w.div_ceil(ds) as isize, h.div_ceil(ds) as isize);
        let inside = |x: isize, y: isize| {
            if x < 0 || y < 0 || x >= dw || y >= dh {
                return false;
            }
            let (sx, sy) = if ds == 1 { (x as usize, y as usize) } else { ((x as usize * ds + ds / 2).min(w - 1), (y as usize * ds + ds / 2).min(h - 1)) };
            m[sy * w + sx] >= 128
        };
        let mut out = Vec::new();
        for y in r.1 as isize..(r.3 as isize).min(dh) {
            for x in r.0 as isize..(r.2 as isize).min(dw) {
                if inside(x, y) && !(inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1)) {
                    out.push((y as usize * dw as usize + x as usize) as u32);
                }
            }
        }
        out
    }

    /// Pose les fourmis (phase `phase`) sur les pixels `edges` d'un affichage de largeur `dw`.
    pub fn paint_ants(out: &mut [u8], edges: &[u32], dw: usize, phase: usize) {
        for &i in edges {
            let i = i as usize;
            let (x, y) = (i % dw, i / dw);
            let v = if (x + y + phase) / 4 % 2 == 0 { 0 } else { 255 };
            let o = i * 4;
            if o + 3 < out.len() {
                out[o..o + 3].fill(v);
                out[o + 3] = 255;
            }
        }
    }

    /// Fourmis limitées au rectangle `r` (x0, y0, x1, y1 exclus).
    pub fn draw_ants_in(&self, out: &mut [u8], phase: usize, r: (usize, usize, usize, usize)) {
        let Some(m) = &self.sel else { return };
        let (w, h) = (self.w, self.h);
        let inside = |x: isize, y: isize| x >= 0 && y >= 0 && (x as usize) < w && (y as usize) < h && m[y as usize * w + x as usize] >= 128;
        for y in r.1 as isize..r.3.min(h) as isize {
            for x in r.0 as isize..r.2.min(w) as isize {
                if !inside(x, y) {
                    continue;
                }
                if inside(x - 1, y) && inside(x + 1, y) && inside(x, y - 1) && inside(x, y + 1) {
                    continue;
                }
                let i = (y as usize * w + x as usize) * 4;
                let v = if ((x + y) as usize + phase) / 4 % 2 == 0 { 0 } else { 255 };
                out[i] = v;
                out[i + 1] = v;
                out[i + 2] = v;
                out[i + 3] = 255;
            }
        }
    }

    // ------------------------------------------------------------ sélection

    pub fn select_all(&mut self) {
        self.sel = Some(vec![255; self.w * self.h]);
    }

    pub fn deselect(&mut self) {
        self.sel = None;
    }

    pub fn invert_selection(&mut self) {
        self.sel = match self.sel.take() {
            None => None,
            Some(mut m) => {
                for v in m.iter_mut() {
                    *v = 255 - *v;
                }
                if m.iter().all(|v| *v == 0) {
                    None
                } else {
                    Some(m)
                }
            }
        };
    }

    /// Combine un nouveau masque avec la sélection courante selon le mode du ruban.
    pub fn apply_selection(&mut self, mask: Vec<u8>, mode: SelMode) {
        let old = self.sel.take();
        let combined = match (mode, old) {
            (SelMode::Replace, _) | (SelMode::Add, None) | (SelMode::Intersect, None) => mask,
            (SelMode::Subtract, None) => vec![0; self.w * self.h],
            (SelMode::Add, Some(mut o)) => {
                for (a, b) in o.iter_mut().zip(&mask) {
                    *a = (*a).max(*b);
                }
                o
            }
            (SelMode::Subtract, Some(mut o)) => {
                for (a, b) in o.iter_mut().zip(&mask) {
                    *a = (*a as u16 * (255 - *b) as u16 / 255) as u8;
                }
                o
            }
            (SelMode::Intersect, Some(mut o)) => {
                for (a, b) in o.iter_mut().zip(&mask) {
                    *a = (*a).min(*b);
                }
                o
            }
        };
        self.sel = if combined.iter().any(|v| *v > 0) { Some(combined) } else { None };
    }

    /// Étend (r > 0) ou réduit (r < 0) la sélection de |r| pixels (disque, deux passes séparables
    /// sur la distance de Chebyshev puis lissage du coin).
    pub fn grow_selection(&mut self, r: i32) {
        let Some(m) = self.sel.take() else { return };
        let (w, h) = (self.w, self.h);
        let n = r.unsigned_abs() as usize;
        if n == 0 {
            self.sel = Some(m);
            return;
        }
        let grow = r > 0;
        let pick = |a: u8, b: u8| if grow { a.max(b) } else { a.min(b) };
        // passe horizontale puis verticale (fenêtre glissante simple)
        let mut tmp = vec![0u8; w * h];
        for y in 0..h {
            for x in 0..w {
                let (x0, x1) = (x.saturating_sub(n), (x + n).min(w - 1));
                let mut v = if grow { 0 } else { 255 };
                for xx in x0..=x1 {
                    v = pick(v, m[y * w + xx]);
                }
                if !grow && (x < n || x + n >= w) {
                    v = pick(v, m[y * w + x]);
                }
                tmp[y * w + x] = v;
            }
        }
        let mut out = vec![0u8; w * h];
        for x in 0..w {
            for y in 0..h {
                let (y0, y1) = (y.saturating_sub(n), (y + n).min(h - 1));
                let mut v = if grow { 0 } else { 255 };
                for yy in y0..=y1 {
                    v = pick(v, tmp[yy * w + x]);
                }
                out[y * w + x] = v;
            }
        }
        self.sel = if out.iter().any(|v| *v > 0) { Some(out) } else { None };
    }

    /// Bordure de `n` pixels à l'intérieur de l'image, dans un nouveau calque.
    /// Emprise du contenu visible (alpha > 0) du calque `i`, hors toile comprise, en coordonnées
    /// du document : (x, y, largeur, hauteur).
    pub fn layer_content_bounds(&self, i: usize) -> Option<(isize, isize, usize, usize)> {
        let layer = &self.layers[i];
        let (mut x0, mut y0, mut x1, mut y1) = (isize::MAX, isize::MAX, isize::MIN, isize::MIN);
        let mut touch = |x: isize, y: isize| {
            x0 = x0.min(x); y0 = y0.min(y);
            x1 = x1.max(x + 1); y1 = y1.max(y + 1);
        };
        for y in 0..self.h {
            for x in 0..self.w {
                if layer.px[(y * self.w + x) * 4 + 3] > 0 { touch(x as isize, y as isize); }
            }
        }
        if let Some(off) = &layer.off {
            for y in 0..off.h {
                for x in 0..off.w {
                    let (dx, dy) = (off.x + x as isize, off.y + y as isize);
                    if let Some(si) = off.outside_at(dx, dy, self.w, self.h) {
                        if off.px[si + 3] > 0 { touch(dx, dy); }
                    }
                }
            }
        }
        (x0 < x1).then(|| (x0, y0, (x1 - x0) as usize, (y1 - y0) as usize))
    }

    /// Replace le contenu du calque `i` : pixels `src` (`sw` × `sh`) posés en (x, y). Ce qui
    /// dépasse de la toile est gardé (hors toile) si `keep_outside`, sinon rogné.
    pub fn place_layer_content(&mut self, i: usize, x: isize, y: isize, sw: usize, sh: usize, src: &[u8], keep_outside: bool) {
        let (w, h) = (self.w, self.h);
        let mut px = vec![0u8; w * h * 4];
        let mut off_needed = false;
        for yy in 0..sh {
            for xx in 0..sw {
                let (dx, dy) = (x + xx as isize, y + yy as isize);
                let si = (yy * sw + xx) * 4;
                if dx >= 0 && dy >= 0 && (dx as usize) < w && (dy as usize) < h {
                    let di = (dy as usize * w + dx as usize) * 4;
                    px[di..di + 4].copy_from_slice(&src[si..si + 4]);
                } else if src[si + 3] > 0 {
                    off_needed = true;
                }
            }
        }
        let l = &mut self.layers[i];
        l.px = px.into();
        l.off = (keep_outside && off_needed).then(|| Off { x, y, w: sw, h: sh, px: src.to_vec().into() });
    }

    /// Détourage par sélection : tout ce qui est hors de la sélection devient transparent
    /// (calque actif).
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn cutout_outside_selection(&mut self) -> bool {
        let Some(m) = self.sel.clone() else { return false };
        let a = self.active;
        let px = &mut self.layers[a].px;
        for (i, s) in m.iter().enumerate() {
            let k = i * 4 + 3;
            px[k] = (px[k] as u32 * *s as u32 / 255) as u8;
        }
        true
    }

    /// Remplissage de contenu : la sélection est reconstituée à partir de ses abords (de la
    /// frontière vers l'intérieur, moyenne des voisins connus, avec un grain emprunté aux
    /// voisins pour ne pas laisser d'aplat). Calque actif.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn content_aware_fill(&mut self) -> bool {
        let Some(m) = self.sel.clone() else { return false };
        let (w, h) = (self.w, self.h);
        let a = self.active;
        let mut px = self.layers[a].px.to_vec();
        let mut unknown: Vec<bool> = m.iter().map(|v| *v >= 128).collect();
        if !unknown.iter().any(|u| *u) {
            return false;
        }
        let mut seed = 0x9e3779b9u32;
        let mut rnd = move || {
            seed ^= seed << 13;
            seed ^= seed >> 17;
            seed ^= seed << 5;
            seed
        };
        let dirs: [(isize, isize); 8] = [(1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (-1, -1), (1, -1), (-1, 1)];
        // couches successives : chaque tour remplit les inconnus touchant au moins un connu
        for _ in 0..(w + h) {
            let mut fill: Vec<(usize, [u8; 4])> = Vec::new();
            for y in 0..h {
                for x in 0..w {
                    let i = y * w + x;
                    if !unknown[i] {
                        continue;
                    }
                    let mut acc = [0u32; 4];
                    let mut n = 0u32;
                    let mut pick: Option<[u8; 4]> = None;
                    for (k, (dx, dy)) in dirs.iter().enumerate() {
                        let (nx, ny) = (x as isize + dx, y as isize + dy);
                        if nx < 0 || ny < 0 || nx as usize >= w || ny as usize >= h {
                            continue;
                        }
                        let j = ny as usize * w + nx as usize;
                        if unknown[j] {
                            continue;
                        }
                        let p = [px[j * 4], px[j * 4 + 1], px[j * 4 + 2], px[j * 4 + 3]];
                        for c in 0..4 {
                            acc[c] += p[c] as u32;
                        }
                        n += 1;
                        if k == (rnd() % 8) as usize || pick.is_none() {
                            pick = Some(p);
                        }
                    }
                    if n > 0 {
                        let mean = [(acc[0] / n) as u8, (acc[1] / n) as u8, (acc[2] / n) as u8, (acc[3] / n) as u8];
                        // moitié moyenne, moitié voisin tiré au hasard : un peu de texture
                        let q = pick.unwrap_or(mean);
                        let mix = |c: usize| ((mean[c] as u32 + q[c] as u32) / 2) as u8;
                        fill.push((i, [mix(0), mix(1), mix(2), mix(3)]));
                    }
                }
            }
            if fill.is_empty() {
                break;
            }
            for (i, c) in fill {
                px[i * 4..i * 4 + 4].copy_from_slice(&c);
                unknown[i] = false;
            }
        }
        // retour dans la sélection seulement (bords fondus du masque conservés)
        let base = self.layers[a].px.clone();
        for i in 0..w * h {
            let s = m[i] as u32;
            if s > 0 {
                for c in 0..4 {
                    px[i * 4 + c] = ((px[i * 4 + c] as u32 * s + base[i * 4 + c] as u32 * (255 - s)) / 255) as u8;
                }
            } else {
                px[i * 4..i * 4 + 4].copy_from_slice(&base[i * 4..i * 4 + 4]);
            }
        }
        self.layers[a].px = px.into();
        true
    }

    /// Un calque a du contenu hors de la toile.
    pub fn has_outside(&self) -> bool {
        self.layers.iter().any(|l| l.off.is_some())
    }

    /// Supprime tout le contenu hors de la toile (option « Hors toile » désactivée).
    pub fn clear_outside(&mut self) {
        for l in &mut self.layers {
            l.off = None;
        }
    }

    /// Calque `i` en entier, toile et dehors : (x, y, largeur, hauteur, pixels).
    pub fn layer_full(&self, i: usize) -> (isize, isize, usize, usize, Vec<u8>) {
        let (w, h) = (self.w, self.h);
        let l = &self.layers[i];
        let Some(o) = &l.off else { return (0, 0, w, h, l.px.to_vec()) };
        let (x0, y0) = (o.x.min(0), o.y.min(0));
        let (x1, y1) = ((o.x + o.w as isize).max(w as isize), (o.y + o.h as isize).max(h as isize));
        let (uw, uh) = ((x1 - x0) as usize, (y1 - y0) as usize);
        let mut out = vec![0u8; uw * uh * 4];
        for y in 0..o.h {
            for x in 0..o.w {
                let (dx, dy) = (o.x + x as isize, o.y + y as isize);
                if let Some(si) = o.outside_at(dx, dy, w, h) {
                    let di = ((dy - y0) as usize * uw + (dx - x0) as usize) * 4;
                    out[di..di + 4].copy_from_slice(&o.px[si..si + 4]);
                }
            }
        }
        for y in 0..h {
            let di = ((y as isize - y0) as usize * uw + (-x0) as usize) * 4;
            out[di..di + w * 4].copy_from_slice(&l.px[y * w * 4..(y + 1) * w * 4]);
        }
        (x0, y0, uw, uh, out)
    }

    /// Contenu hors toile de tous les calques visibles, superposé (affichage autour de la toile) :
    /// (x, y, largeur, hauteur, pixels) dans les coordonnées du document.
    pub fn outside_composite(&self) -> Option<(isize, isize, usize, usize, Vec<u8>)> {
        self.outside_composite_in(None)
    }

    pub fn outside_composite_in(&self, viewport: Option<(isize, isize, isize, isize)>) -> Option<(isize, isize, usize, usize, Vec<u8>)> {
        let offs: Vec<(&Off, f32)> = self.layers.iter().filter(|l| l.visible).filter_map(|l| l.off.as_ref().map(|o| (o, l.opacity))).collect();
        if offs.is_empty() {
            return None;
        }
        let x0 = offs.iter().map(|(o, _)| o.x).min()?.min(0);
        let y0 = offs.iter().map(|(o, _)| o.y).min()?.min(0);
        let x1 = offs.iter().map(|(o, _)| o.x + o.w as isize).max()?.max(self.w as isize);
        let y1 = offs.iter().map(|(o, _)| o.y + o.h as isize).max()?.max(self.h as isize);
        let (x0, y0, x1, y1) = if let Some(v) = viewport {
            (x0.max(v.0), y0.max(v.1), x1.min(v.2), y1.min(v.3))
        } else { (x0, y0, x1, y1) };
        if x1 <= x0 || y1 <= y0 || (x0 >= 0 && y0 >= 0 && x1 <= self.w as isize && y1 <= self.h as isize) { return None; }
        let (uw, uh) = ((x1 - x0) as usize, (y1 - y0) as usize);
        let mut out = vec![0u8; uw * uh * 4];
        for (o, op) in offs {
            let left = (x0 - o.x).clamp(0, o.w as isize) as usize;
            let top = (y0 - o.y).clamp(0, o.h as isize) as usize;
            let right = (x1 - o.x).clamp(0, o.w as isize) as usize;
            let bottom = (y1 - o.y).clamp(0, o.h as isize) as usize;
            for y in top..bottom {
                for x in left..right {
                    let (dx, dy) = (o.x + x as isize, o.y + y as isize);
                    let Some(si) = o.outside_at(dx, dy, self.w, self.h) else { continue };
                    let sa = o.px[si + 3] as f32 / 255.0 * op;
                    if sa <= 0.0 {
                        continue;
                    }
                    let di = ((dy - y0) as usize * uw + (dx - x0) as usize) * 4;
                    let da = out[di + 3] as f32 / 255.0;
                    let ao = sa + da * (1.0 - sa);
                    for k in 0..3 {
                        out[di + k] = ((o.px[si + k] as f32 * sa + out[di + k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
                    }
                    out[di + 3] = (ao * 255.0 + 0.5) as u8;
                }
            }
        }
        Some((x0, y0, uw, uh, out))
    }

    /// Bordure d'image (illu-image-tools.js) : marges (gauche, haut, droite, bas) ; `outside` :
    /// la toile est agrandie d'autant, sinon le cadre est peint à l'intérieur ; dans un nouveau
    /// calque « Bordure » ou dans le calque actif.
    pub fn add_border(&mut self, m: (usize, usize, usize, usize), color: [u8; 4], outside: bool, new_layer: bool) {
        let (l, t, r, b) = m;
        if outside {
            self.resize_canvas_at(self.w + l + r, self.h + t + b, l as isize, t as isize);
        }
        let (w, h) = (self.w, self.h);
        if new_layer {
            self.add_layer();
            self.layer_mut().name = "Bordure".into();
        }
        let lay = &mut self.layers[self.active].px;
        for y in 0..h {
            for x in 0..w {
                if x < l || y < t || x + r >= w || y + b >= h {
                    lay[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&color);
                }
            }
        }
    }

    /// Cadre englobant de la sélection (x0, y0, x1, y1 exclus).
    pub fn selection_bounds(&self) -> Option<(usize, usize, usize, usize)> {
        let m = self.sel.as_ref()?;
        let (mut x0, mut y0, mut x1, mut y1) = (self.w, self.h, 0, 0);
        // par ligne : premier et dernier pixel sélectionnés (une sélection pleine s'arrête à
        // chaque extrémité de ligne au lieu de parcourir tous les pixels)
        for y in 0..self.h {
            let row = &m[y * self.w..(y + 1) * self.w];
            if let Some(a) = row.iter().position(|v| *v > 0) {
                let b = row.iter().rposition(|v| *v > 0).unwrap_or(a);
                x0 = x0.min(a);
                x1 = x1.max(b + 1);
                y0 = y0.min(y);
                y1 = y + 1;
            }
        }
        if x1 > x0 { Some((x0, y0, x1, y1)) } else { None }
    }

    /// Efface la sélection (ou tout le calque) en transparent.
    pub fn erase_selection(&mut self) {
        // calque verrouillé, dossier ou calque texte : rien n'est effacé
        if self.edit_refusal().is_some() || self.layers[self.active].vector.is_some() {
            return;
        }
        let (n, sel) = (self.w * self.h, self.sel.clone());
        let l = &mut self.layers[self.active];
        for i in 0..n {
            let s = sel.as_ref().map_or(255, |m| m[i]) as u32;
            if s > 0 {
                l.px[i * 4 + 3] = (l.px[i * 4 + 3] as u32 * (255 - s) / 255) as u8;
            }
        }
    }

    /// Copie de la sélection du calque actif : (x, y, w, h, pixels).
    pub fn copy_selection(&self) -> Option<(usize, usize, usize, usize, Vec<u8>)> {
        let (x0, y0, x1, y1) = self.selection_bounds().unwrap_or((0, 0, self.w, self.h));
        let (cw, ch) = (x1 - x0, y1 - y0);
        let mut out = vec![0u8; cw * ch * 4];
        let l = self.layer();
        for y in 0..ch {
            let si = ((y0 + y) * self.w + x0) * 4;
            let o = y * cw * 4;
            out[o..o + cw * 4].copy_from_slice(&l.px[si..si + cw * 4]);
            // alpha pondéré par la couverture de la sélection (rien à faire sans sélection)
            if let Some(m) = &self.sel {
                let row = &m[(y0 + y) * self.w + x0..(y0 + y) * self.w + x0 + cw];
                for (px, s) in out[o..o + cw * 4].chunks_exact_mut(4).zip(row) {
                    if *s != 255 {
                        px[3] = (px[3] as u32 * *s as u32 / 255) as u8;
                    }
                }
            }
        }
        Some((x0, y0, cw, ch, out))
    }

    /// Colle des pixels dans un nouveau calque à (x, y), et sélectionne la zone collée.
    pub fn paste(&mut self, x: isize, y: isize, cw: usize, ch: usize, px: &[u8]) {
        let mut layer = Layer::new(&crate::i18n::tr("Collage"), self.w, self.h, [0, 0, 0, 0]);
        let mut mask = vec![0u8; self.w * self.h];
        // lignes recopiées d'un bloc, rognées à la toile
        let (w, h) = (self.w as isize, self.h as isize);
        let (cx0, cx1) = (x.max(0), (x + cw as isize).min(w));
        if cx1 > cx0 {
            for yy in 0..ch {
                let dy = y + yy as isize;
                if dy < 0 || dy >= h {
                    continue;
                }
                let (di, si) = (dy as usize * self.w + cx0 as usize, yy * cw + (cx0 - x) as usize);
                let n = (cx1 - cx0) as usize;
                layer.px[di * 4..(di + n) * 4].copy_from_slice(&px[si * 4..(si + n) * 4]);
                mask[di..di + n].fill(255);
            }
        }
        self.layers.insert(self.active + 1, layer);
        self.active += 1;
        self.sel = Some(mask);
    }

    /// Déplace le contenu sélectionné du calque actif (et la sélection) de (dx, dy).
    pub fn translate_selection(&mut self, dx: isize, dy: isize) {
        let (w, h) = (self.w, self.h);
        let Some(m) = self.sel.clone() else { return };
        let base = self.layers[self.active].px.clone();
        let lay = &mut self.layers[self.active].px;
        for i in 0..w * h {
            let s = m[i] as u32;
            if s > 0 {
                lay[i * 4 + 3] = (lay[i * 4 + 3] as u32 * (255 - s) / 255) as u8;
            }
        }
        let mut nm = vec![0u8; w * h];
        for y in 0..h as isize {
            for x in 0..w as isize {
                let (sx, sy) = (x - dx, y - dy);
                if sx < 0 || sy < 0 || sx as usize >= w || sy as usize >= h {
                    continue;
                }
                let si = sy as usize * w + sx as usize;
                let s = m[si] as f32 / 255.0;
                nm[y as usize * w + x as usize] = m[si];
                if s <= 0.0 {
                    continue;
                }
                let o = (y as usize * w + x as usize) * 4;
                let sa = base[si * 4 + 3] as f32 / 255.0 * s;
                let da = lay[o + 3] as f32 / 255.0;
                let ao = sa + da * (1.0 - sa);
                if ao <= 0.0 {
                    continue;
                }
                for k in 0..3 {
                    lay[o + k] = ((base[si * 4 + k] as f32 * sa + lay[o + k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
                }
                lay[o + 3] = (ao * 255.0 + 0.5) as u8;
            }
        }
        self.sel = Some(nm);
    }

    /// Aligne la sélection sur la toile : `h` = -1 gauche, 0 centre, 1 droite (None = inchangé).
    pub fn align_selection(&mut self, h: Option<i32>, v: Option<i32>) {
        let Some((x0, y0, x1, y1)) = self.selection_bounds() else { return };
        let dx = match h {
            Some(-1) => -(x0 as isize),
            Some(0) => (self.w as isize - (x1 - x0) as isize) / 2 - x0 as isize,
            Some(1) => self.w as isize - x1 as isize,
            _ => 0,
        };
        let dy = match v {
            Some(-1) => -(y0 as isize),
            Some(0) => (self.h as isize - (y1 - y0) as isize) / 2 - y0 as isize,
            Some(1) => self.h as isize - y1 as isize,
            _ => 0,
        };
        if dx != 0 || dy != 0 {
            self.translate_selection(dx, dy);
        }
    }

    // ------------------------------------------------------------ calques

    pub fn add_layer(&mut self) {
        let n = self.layers.len() + 1;
        self.layers.insert(self.active + 1, Layer::new(&crate::i18n::tr_format!("Calque {n}"), self.w, self.h, [0, 0, 0, 0]));
        self.active += 1;
    }

    pub fn delete_layer(&mut self) {
        if self.layers.len() > 1 {
            self.layers.remove(self.active);
            self.active = self.active.min(self.layers.len() - 1);
        }
    }

    pub fn duplicate_layer(&mut self) {
        let mut l = self.layer().clone();
        l.name = crate::i18n::tr_format!("{} copie", l.name);
        l.uid = next_uid();
        self.layers.insert(self.active + 1, l);
        self.active += 1;
    }

    /// Déplace un calque d'une position à une autre (glisser-déposer).
    pub fn reorder_layer(&mut self, from: usize, to: usize) {
        if from >= self.layers.len() || to >= self.layers.len() || from == to {
            return;
        }
        let l = self.layers.remove(from);
        self.layers.insert(to, l);
        self.active = to;
    }

    pub fn move_layer(&mut self, up: bool) {
        let a = self.active;
        if up && a + 1 < self.layers.len() {
            self.layers.swap(a, a + 1);
            self.active += 1;
        } else if !up && a > 0 {
            self.layers.swap(a, a - 1);
            self.active -= 1;
        }
    }

    /// Fusionne le calque actif dans celui du dessous (avec son mode et son opacité).
    pub fn merge_down(&mut self) {
        if self.active == 0 {
            return;
        }
        let top = self.layers.remove(self.active);
        self.active -= 1;
        let merged = Doc::scratch(self.w, self.h, vec![self.layers[self.active].clone(), top]).flatten();
        self.layers[self.active].px = merged.into();
    }

    #[allow(dead_code)]
    pub fn flatten_all(&mut self) {
        let px = self.flatten();
        let mut l = Layer::new(&crate::i18n::tr("Arrière-plan"), self.w, self.h, [0, 0, 0, 0]);
        l.px = px.into();
        self.layers = vec![l];
        self.active = 0;
    }

    /// Sépare les canaux R, V, B du calque actif en trois calques.
    #[allow(dead_code)]
    pub fn split_rgb(&mut self) {
        self.split_rgb_with(false, [(0, 0); 3], true);
    }

    /// Séparation des canaux (Calques et Effets › Couleur). Couleur : « Rouge » en mode Normal,
    /// « Vert » et « Bleu » en Écran par-dessus — sans décalage, la recomposition redonne
    /// exactement les pixels opaques d'origine (avant, les trois en Écran sur l'original encore
    /// visible éclaircissaient l'image). Niveaux de gris : trois calques gris en mode Normal
    /// (comme la version web). `off` : décalage de chaque canal (x, y) en pixels, le bord
    /// découvert devient transparent ; `hide` : masque le calque d'origine.
    pub fn split_rgb_with(&mut self, gray: bool, off: [(i32, i32); 3], hide: bool) {
        let src = self.layer().px.clone();
        let parent = self.layer().parent;
        let (w, h) = (self.w as i32, self.h as i32);
        if hide {
            self.layers[self.active].visible = false;
        }
        let names = if gray { ["Canal R", "Canal V", "Canal B"] } else { ["Rouge", "Vert", "Bleu"] };
        for (c, name) in names.iter().enumerate() {
            let mut l = Layer::new(&crate::i18n::tr(name), self.w, self.h, [0, 0, 0, 0]);
            let (dx, dy) = off[c];
            for y in 0..h {
                let sy = y - dy;
                if sy < 0 || sy >= h {
                    continue;
                }
                for x in 0..w {
                    let sx = x - dx;
                    if sx < 0 || sx >= w {
                        continue;
                    }
                    let (o, s) = (((y * w + x) * 4) as usize, ((sy * w + sx) * 4) as usize);
                    if gray {
                        l.px[o..o + 3].fill(src[s + c]);
                    } else {
                        l.px[o + c] = src[s + c];
                    }
                    l.px[o + 3] = src[s + 3];
                }
            }
            l.blend = if gray || c == 0 { Blend::Normal } else { Blend::Screen };
            l.parent = parent;
            self.layers.insert(self.active + 1, l);
            self.active += 1;
        }
    }

    /// Détourage par sélection avec réglages : la sélection est étendue (`grow` > 0) ou
    /// contractée, adoucie (`feather` px), éventuellement inversée, puis appliquée à l'alpha du
    /// calque actif, ou mise dans son masque α lié (non destructif, combinée au masque existant).
    pub fn cutout_with(&mut self, feather: f32, grow: i32, invert: bool, as_mask: bool) -> Result<(), &'static str> {
        let Some(saved) = self.sel.clone() else { return Err("Détourage : tracez d'abord une sélection autour de l'objet à garder") };
        if as_mask && self.layer().dynamic.is_some() {
            return Err("Filtre dynamique actif : désactivez-le pour détourer en masque α");
        }
        self.grow_selection(grow);
        let mut m = self.sel.take().unwrap_or_else(|| vec![0u8; self.w * self.h]);
        self.sel = Some(saved);
        if invert {
            m.iter_mut().for_each(|v| *v = 255 - *v);
        }
        let r = feather.round() as usize;
        if r > 0 {
            blur_mask(&mut m, self.w, self.h, r);
        }
        let a = self.active;
        if as_mask {
            let l = &mut self.layers[a];
            let mut mk = l.mask.as_ref().map(|k| k.to_vec()).unwrap_or_else(|| vec![255u8; m.len()]);
            for (k, s) in mk.iter_mut().zip(&m) {
                *k = (*k as u32 * *s as u32 / 255) as u8;
            }
            l.mask = Some(mk.into());
        } else {
            let px = &mut self.layers[a].px;
            for (i, s) in m.iter().enumerate() {
                let k = i * 4 + 3;
                px[k] = (px[k] as u32 * *s as u32 / 255) as u8;
            }
        }
        Ok(())
    }

    // ------------------------------------------------------------ image

    fn invalidate_dynamic_geometry(&mut self) {
        for layer in &mut self.layers {
            layer.dyn_cache = None;
            layer.dyn_key = None;
            layer.dyn_input = None;
            layer.dyn_dirty = None;
            layer.dyn_serial = 0;
        }
    }

    fn remap<F: Fn(usize, usize) -> (usize, usize)>(&mut self, nw: usize, nh: usize, f: F) {
        self.invalidate_dynamic_geometry();
        let (w, _h) = (self.w, self.h);
        for l in self.layers.iter_mut() {
            // rotation, retournement, recadrage : le contenu hors toile n'est pas transformé
            l.off = None;
            let mut out = vec![0u8; nw * nh * 4];
            for y in 0..nh {
                for x in 0..nw {
                    let (sx, sy) = f(x, y);
                    let si = (sy * w + sx) * 4;
                    let o = (y * nw + x) * 4;
                    out[o..o + 4].copy_from_slice(&l.px[si..si + 4]);
                }
            }
            l.px = out.into();
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == w * _h) {
                let mut out = vec![0u8; nw * nh];
                for y in 0..nh {
                    for x in 0..nw {
                        let (sx, sy) = f(x, y);
                        out[y * nw + x] = m[sy * w + sx];
                    }
                }
                l.mask = Some(out.into());
            }
        }
        if let Some(m) = &self.sel {
            let mut out = vec![0u8; nw * nh];
            for y in 0..nh {
                for x in 0..nw {
                    let (sx, sy) = f(x, y);
                    out[y * nw + x] = m[sy * w + sx];
                }
            }
            self.sel = Some(out);
        }
        self.w = nw;
        self.h = nh;
    }

    pub fn rotate90(&mut self, clockwise: bool) {
        let (w, h) = (self.w, self.h);
        if clockwise {
            self.remap(h, w, |x, y| (y, h - 1 - x));
        } else {
            self.remap(h, w, |x, y| (w - 1 - y, x));
        }
    }

    pub fn rotate180(&mut self) {
        let (w, h) = (self.w, self.h);
        self.remap(w, h, |x, y| (w - 1 - x, h - 1 - y));
    }

    pub fn flip(&mut self, horizontal: bool) {
        let (w, h) = (self.w, self.h);
        if horizontal {
            self.remap(w, h, |x, y| (w - 1 - x, y));
        } else {
            self.remap(w, h, |x, y| (x, h - 1 - y));
        }
    }

    /// Retourne (ou tourne de 180° : `horizontal` et `vertical`) le seul calque actif.
    pub fn flip_layer(&mut self, horizontal: bool, vertical: bool) {
        let (w, h) = (self.w, self.h);
        let src = self.layers[self.active].px.clone();
        let mut out = vec![0u8; w * h * 4];
        for y in 0..h {
            let sy = if vertical { h - 1 - y } else { y };
            for x in 0..w {
                let sx = if horizontal { w - 1 - x } else { x };
                out[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&src[(sy * w + sx) * 4..(sy * w + sx) * 4 + 4]);
            }
        }
        self.layers[self.active].px = out.into();
    }

    pub fn crop_to_selection(&mut self) {
        let Some((x0, y0, x1, y1)) = self.selection_bounds() else { return };
        self.remap(x1 - x0, y1 - y0, |x, y| (x + x0, y + y0));
        self.sel = None;
    }

    /// Recadre au contenu non transparent de l'image.
    pub fn crop_to_content(&mut self) {
        let flat = self.flatten();
        let (mut x0, mut y0, mut x1, mut y1) = (self.w, self.h, 0, 0);
        for y in 0..self.h {
            for x in 0..self.w {
                if flat[(y * self.w + x) * 4 + 3] > 0 {
                    x0 = x0.min(x);
                    y0 = y0.min(y);
                    x1 = x1.max(x + 1);
                    y1 = y1.max(y + 1);
                }
            }
        }
        if x1 > x0 {
            self.remap(x1 - x0, y1 - y0, |x, y| (x + x0, y + y0));
        }
    }

    /// Redimensionne l'image (bilinéaire).
    pub fn resize(&mut self, nw: usize, nh: usize) {
        let (w, h) = (self.w, self.h);
        if nw == 0 || nh == 0 {
            return;
        }
        self.invalidate_dynamic_geometry();
        for l in self.layers.iter_mut() {
            l.px = resample(&l.px, w, h, nw, nh).into();
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == w * h) {
                // masque : rééchantillonné comme une image grise
                let gray: Vec<u8> = m.iter().flat_map(|v| [*v, *v, *v, 255]).collect();
                l.mask = Some(resample(&gray, w, h, nw, nh).chunks_exact(4).map(|p| p[0]).collect::<Vec<u8>>().into());
            }
        }
        self.sel = None;
        self.w = nw;
        self.h = nh;
    }

    /// Change la taille de la zone de travail (bords transparents), l'ancien contenu placé en
    /// (ox, oy) : agrandir, recadrer (décalage négatif), ancrer.
    pub fn resize_canvas_at(&mut self, nw: usize, nh: usize, ox: isize, oy: isize) {
        self.invalidate_dynamic_geometry();
        let (w, h) = (self.w, self.h);
        for l in self.layers.iter_mut() {
            let mut out = vec![0u8; nw * nh * 4];
            // contenu hors toile qui retombe dans la nouvelle toile : réintégré ; le reste suit
            // le décalage
            if let Some(o) = l.off.take() {
                let mut opx = o.px.to_vec();
                let mut left = false;
                for y in 0..o.h {
                    for x in 0..o.w {
                        let (dx, dy) = (o.x + x as isize, o.y + y as isize);
                        let Some(si) = o.outside_at(dx, dy, w, h) else { continue };
                        if opx[si + 3] == 0 {
                            continue;
                        }
                        let (nx, ny) = (dx + ox, dy + oy);
                        if nx >= 0 && ny >= 0 && (nx as usize) < nw && (ny as usize) < nh {
                            let di = (ny as usize * nw + nx as usize) * 4;
                            out[di..di + 4].copy_from_slice(&opx[si..si + 4]);
                            opx[si..si + 4].fill(0);
                        } else {
                            left = true;
                        }
                    }
                }
                if left {
                    l.off = Some(Off { x: o.x + ox, y: o.y + oy, w: o.w, h: o.h, px: opx.into() });
                }
            }
            for y in 0..nh as isize {
                for x in 0..nw as isize {
                    let (sx, sy) = (x - ox, y - oy);
                    if sx >= 0 && sy >= 0 && (sx as usize) < w && (sy as usize) < h {
                        let si = (sy as usize * w + sx as usize) * 4;
                        let o = (y as usize * nw + x as usize) * 4;
                        out[o..o + 4].copy_from_slice(&l.px[si..si + 4]);
                    }
                }
            }
            l.px = out.into();
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == w * h) {
                let mut out = vec![255u8; nw * nh];
                for y in 0..nh as isize {
                    for x in 0..nw as isize {
                        let (sx, sy) = (x - ox, y - oy);
                        if sx >= 0 && sy >= 0 && (sx as usize) < w && (sy as usize) < h {
                            out[y as usize * nw + x as usize] = m[sy as usize * w + sx as usize];
                        }
                    }
                }
                l.mask = Some(out.into());
            }
        }
        self.sel = None;
        self.w = nw;
        self.h = nh;
    }
}

/// Écrit une couleur composée dans l'affichage : sur damier (8 px du document) ou telle quelle.
fn put_rgba(o: &mut [u8], (r, g, b, a): (f32, f32, f32, f32), checker: bool, x: usize, y: usize) {
    if checker {
        let chk = if ((x >> 3) + (y >> 3)) & 1 == 0 { 1.0 } else { 0.8 };
        o[0] = ((r * a + chk * (1.0 - a)) * 255.0 + 0.5) as u8;
        o[1] = ((g * a + chk * (1.0 - a)) * 255.0 + 0.5) as u8;
        o[2] = ((b * a + chk * (1.0 - a)) * 255.0 + 0.5) as u8;
        o[3] = 255;
    } else {
        o[0] = (r * 255.0 + 0.5) as u8;
        o[1] = (g * 255.0 + 0.5) as u8;
        o[2] = (b * 255.0 + 0.5) as u8;
        o[3] = (a * 255.0 + 0.5) as u8;
    }
}

/// Rééchantillonnage bilinéaire RGBA.
pub fn resample(px: &[u8], w: usize, h: usize, nw: usize, nh: usize) -> Vec<u8> {
    let mut out = vec![0u8; nw * nh * 4];
    for y in 0..nh {
        let fy = ((y as f32 + 0.5) * h as f32 / nh as f32 - 0.5).clamp(0.0, (h - 1) as f32);
        let (y0, ty) = (fy.floor() as usize, fy - fy.floor());
        let y1 = (y0 + 1).min(h - 1);
        for x in 0..nw {
            let fx = ((x as f32 + 0.5) * w as f32 / nw as f32 - 0.5).clamp(0.0, (w - 1) as f32);
            let (x0, tx) = (fx.floor() as usize, fx - fx.floor());
            let x1 = (x0 + 1).min(w - 1);
            for c in 0..4 {
                let p = |xx: usize, yy: usize| px[(yy * w + xx) * 4 + c] as f32;
                let v = (p(x0, y0) * (1.0 - tx) + p(x1, y0) * tx) * (1.0 - ty) + (p(x0, y1) * (1.0 - tx) + p(x1, y1) * tx) * ty;
                out[(y * nw + x) * 4 + c] = (v + 0.5) as u8;
            }
        }
    }
    out
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SelMode {
    Replace,
    Add,
    Subtract,
    Intersect,
}

/// Adoucit un masque (un octet par pixel) : trois passes de moyenne glissante de rayon `r`
/// (proche d'un flou gaussien), bords répétés.
pub fn blur_mask(m: &mut [u8], w: usize, h: usize, r: usize) {
    if r == 0 || w == 0 || h == 0 || m.len() < w * h {
        return;
    }
    let mut a: Vec<f32> = m[..w * h].iter().map(|v| *v as f32).collect();
    let mut tmp = vec![0f32; w * h];
    let n = (2 * r + 1) as f32;
    for _ in 0..3 {
        for y in 0..h {
            let row = &a[y * w..(y + 1) * w];
            let at = |x: isize| row[x.clamp(0, w as isize - 1) as usize];
            let mut s: f32 = (-(r as isize)..=r as isize).map(at).sum();
            for x in 0..w {
                tmp[y * w + x] = s / n;
                s += at(x as isize + r as isize + 1) - at(x as isize - r as isize);
            }
        }
        for x in 0..w {
            let at = |y: isize| tmp[y.clamp(0, h as isize - 1) as usize * w + x];
            let mut s: f32 = (-(r as isize)..=r as isize).map(at).sum();
            for y in 0..h {
                a[y * w + x] = s / n;
                s += at(y as isize + r as isize + 1) - at(y as isize - r as isize);
            }
        }
    }
    for (o, v) in m.iter_mut().zip(&a) {
        *o = (v + 0.5).clamp(0.0, 255.0) as u8;
    }
}

#[cfg(test)]
mod dyn_tests {
    use super::*;

    /// Effet du menu dans une pile dynamique : type relu à l'identique, intensité → mélange.
    #[test]
    fn fx_stage_roundtrip() {
        let vals: std::collections::HashMap<String, String> = [("ef-frost-amt".to_string(), "4".to_string())].into();
        let k = fx_kind("frosted", &[4.0, 0.5], "Verre dépoli : fort", "frosted", &vals);
        assert_eq!(fx_label(&k).as_deref(), Some("Verre dépoli : fort"));
        assert_eq!(fx_dialog(&k), Some(("frosted".to_string(), vals)));
        assert_eq!(stage_of(&k, DYN_FULL / 2.0), Some(Stage::Fx { name: "frosted".into(), p: vec![4.0, 0.5], mix: 0.5, post: None }));
        assert_eq!(stage_of(&format!("{DYN_OFF}{k}"), DYN_FULL), None);
        assert_eq!(fx_label(&format!("{DYN_OFF}{k}")).as_deref(), Some("Verre dépoli : fort"));
        assert_eq!(stage_of("blur", 6.0), Some(Stage::Code(0, 6.0)));
        assert_eq!(stage_of("inconnu", 6.0), None);
    }

    /// Fond rouge, dossier { calque bleu (pixel 0, pixel 1 transparent), filtre ƒ « négatif » } :
    /// rend la composition après calcul des rendus ƒ, pour un dossier isolé ou en Transfert.
    fn folder_dyn(pass: bool) -> [[u8; 4]; 2] {
        let mut d = Doc::new(2, 1, [255, 0, 0, 255], "t");
        let mut g = Layer::new("Dossier", 2, 1, [0, 0, 0, 0]);
        g.group = true;
        g.pass = pass;
        let mut c2 = Layer::new("Calque 2", 2, 1, [0, 0, 0, 0]);
        c2.parent = g.uid;
        c2.px[0..4].copy_from_slice(&[0, 0, 255, 255]);
        let mut f = Layer::new("ƒ", 2, 1, [255, 255, 255, 255]);
        f.parent = g.uid;
        f.dynamic = Some(vec![("invert".into(), 32.0)]);
        // de bas en haut : contenu puis dossier
        d.layers.extend([c2, f, g]);
        for j in d.dynamic_jobs() {
            let img = cpu_stack(&j.src, 2, 1, &j.codes().expect("étages du moteur"));
            d.set_dynamic(j.uid, j.serial, img);
        }
        [d.pixel_color(0, 0), d.pixel_color(1, 0)]
    }

    /// Filtre dynamique rangé dans un dossier : il ne filtre que le contenu du dossier.
    #[test]
    fn dynamic_in_folder_only_filters_folder() {
        let [p0, p1] = folder_dyn(false);
        assert_eq!(p0, [255, 255, 0, 255], "calque bleu du dossier inversé");
        assert_eq!(p1, [255, 0, 0, 255], "le fond rouge, hors du dossier, n'est pas filtré");
        // Even a Pass Through folder must keep the filter inside its boundary.
        let [q0, q1] = folder_dyn(true);
        assert_eq!(q0, [255, 255, 0, 255]);
        assert_eq!(q1, [255, 0, 0, 255], "Transfert : le fond extérieur reste rouge");
    }

    /// Vue « zone » : gris opaque à la place du rendu, pour ce calque seulement.
    #[test]
    fn zone_view_shows_gray() {
        let mut d = Doc::new(4, 4, [10, 200, 30, 255], "t");
        let mut l = Layer::new("ƒ", 4, 4, [255, 255, 255, 255]);
        l.dynamic = Some(vec![("invert".into(), 4.0)]);
        d.layers.push(l);
        let uid = d.layers[1].uid;
        DYN_ZONE_VIEW.store(uid, std::sync::atomic::Ordering::Relaxed);
        let c = d.pixel_color(1, 1);
        DYN_ZONE_VIEW.store(0, std::sync::atomic::Ordering::Relaxed);
        assert_eq!(c, [255, 255, 255, 255]);
    }
}

#[cfg(test)]
mod dynamic_scope_regressions {
    use super::*;
    #[test]
    fn nested_pass_through_folders_keep_adjustments_within_their_own_children() {
        let mut doc = Doc::new(4,1,[255,0,0,255],"t");
        let mut outer=Layer::new("outer",4,1,[0,0,0,0]); outer.group=true; outer.pass=true;
        let mut inner=Layer::new("inner",4,1,[0,0,0,0]); inner.group=true; inner.pass=true; inner.parent=outer.uid;
        let mut sibling=Layer::new("sibling",4,1,[0,0,0,0]); sibling.parent=outer.uid; sibling.px[4..8].copy_from_slice(&[0,255,0,255]);
        let mut blue=Layer::new("blue",4,1,[0,0,0,0]); blue.parent=inner.uid; blue.px[..4].copy_from_slice(&[0,0,255,255]);
        let mut filter=Layer::new("filter",4,1,[255,255,255,255]); filter.parent=inner.uid; filter.dynamic=Some(vec![("invert".into(),32.0)]);
        let mut above=Layer::new("above",4,1,[0,0,0,0]); above.parent=inner.uid; above.px[8..12].copy_from_slice(&[0,0,0,255]);
        doc.layers.extend([sibling,blue,filter,above,inner,outer]);
        for job in doc.dynamic_jobs() {
            let pixels=cpu_stack(&job.src,4,1,&job.codes().unwrap()); doc.set_dynamic(job.uid,job.serial,pixels);
        }
        assert_eq!(doc.pixel_color(0,0),[255,255,0,255],"only the lower child is inverted");
        assert_eq!(doc.pixel_color(1,0),[0,255,0,255],"outer sibling stays green");
        assert_eq!(doc.pixel_color(2,0),[0,0,0,255],"child above the filter stays black");
        assert_eq!(doc.pixel_color(3,0),[255,0,0,255],"root background stays red");
    }
    #[test]
    fn empty_or_pending_adjustments_never_show_their_mask_as_an_image() {
        let mut doc=Doc::new(2,1,[10,20,30,255],"t");
        let mut layer=Layer::new("filter",2,1,[255,255,255,255]); layer.dynamic=Some(vec![]); doc.layers.push(layer);
        assert!(doc.dynamic_jobs().is_empty());
        assert_eq!(doc.pixel_color(0,0),[10,20,30,255]);
        doc.layers[1].dynamic=Some(vec![("invert".into(),32.0)]);
        assert_eq!(doc.pixel_color(0,0),[10,20,30,255],"pending cache must remain neutral");
    }
}

#[cfg(test)]
mod dynamic_input_cache_tests {
    use super::*;
    fn doc() -> Doc {
        let mut d=Doc::new(32,16,[10,20,30,255],"t");
        let mut f=Layer::new("filter",32,16,[255,255,255,255]); f.dynamic=Some(vec![("invert".into(),32.0)]); d.layers.push(f); d
    }
    #[test]
    fn parameter_edits_reuse_input_and_paint_updates_preserve_untouched_pixels() {
        let mut d=doc();
        let first=d.dynamic_jobs().pop().unwrap();
        d.layers[1].dynamic=Some(vec![("grayscale".into(),32.0)]);
        let second=d.dynamic_jobs().pop().unwrap();
        assert!(std::sync::Arc::ptr_eq(&first.src,&second.src),"editing parameters must not flatten the image again");
        d.layers[0].px[4..8].copy_from_slice(&[100,110,120,255]);
        d.mark_dynamic_dirty(Some((1,0,2,1)));
        let painted=d.dynamic_jobs().pop().unwrap();
        assert_eq!(&painted.src[4..8],&[100,110,120,255]);
        assert_eq!(&painted.src[8..],&first.src[8..]);
        assert_eq!(&first.src[4..8],&[10,20,30,255],"in-flight snapshots must not be mutated");
        d.commit("paint");
        assert!(d.history[d.hindex].layers.iter().all(|l|l.dyn_input.is_none()),"undo must not pin disposable input previews");
    }
    #[test]
    fn dependent_filters_wait_for_lower_results_and_hidden_filters_do_no_work() {
        let mut d=doc();
        let mut top=Layer::new("top",32,16,[255,255,255,255]);top.dynamic=Some(vec![("grayscale".into(),32.0)]);d.layers.push(top);
        let jobs=d.dynamic_jobs();assert_eq!(jobs.len(),1);
        let lower=&jobs[0];
        let pending=std::collections::HashSet::from([lower.uid]);
        assert!(d.dynamic_jobs_excluding(&pending).is_empty());
        d.set_dynamic(lower.uid,lower.serial,cpu_stack(&lower.src,32,16,&lower.codes().unwrap()));
        let upper=d.dynamic_jobs();assert_eq!(upper.len(),1);assert_eq!(&upper[0].src[..4],&[245,235,225,255]);
        d.set_dynamic(upper[0].uid,upper[0].serial,cpu_stack(&upper[0].src,32,16,&upper[0].codes().unwrap()));
        assert!(d.dynamic_jobs().is_empty());
        d.layers[1].visible=false;d.layers[2].visible=false;d.layers[0].px[0]=90;
        assert!(d.dynamic_jobs().is_empty());
    }
    #[test]
    fn dynamic_menu_preserves_main_parameters_and_chromatic_postprocessing() {
        let vals=std::collections::HashMap::from([("ef-ca".to_string(),"1".to_string()),("ef-ca-amt".to_string(),"12".to_string())]);
        let kind=fx_kind("frosted",&[4.0,0.5],"Verre dépoli","frosted",&vals);
        assert_eq!(fx_dialog(&kind),Some(("frosted".into(),vals)));
        assert!(matches!(stage_of(&kind,DYN_FULL),Some(Stage::Fx { post:Some(_), .. })));
    }
}

#[cfg(test)]
mod legacy_dynamic_replacement_test {
    use super::*;
    #[test]
    fn legacy_radius_becomes_a_parameter_not_an_effect_opacity() {
        let kind=fx_kind("blur",&[6.0],"Flou carré","blur",&std::collections::HashMap::new());
        let mut old=("blur".into(),6.0);
        replace_stage(&mut old,kind.clone());
        assert_eq!(old.1,DYN_FULL);
        assert!(matches!(stage_of(&old.0,old.1),Some(Stage::Fx { mix:1.0,.. })));
        old.1=DYN_FULL/2.0;
        replace_stage(&mut old,kind);
        assert_eq!(old.1,DYN_FULL/2.0,"existing menu intensity is preserved");
    }
}

#[cfg(test)]
mod dynamic_latest_frame_test {
    use super::*;
    #[test]
    fn a_pending_frame_is_followed_by_the_last_parameter_edit_after_commit() {
        let mut d=Doc::new(2,1,[10,20,30,255],"t");
        let mut filter=Layer::new("f",2,1,[255,255,255,255]);filter.dynamic=Some(vec![("invert".into(),32.0)]);d.layers.push(filter);
        let first=d.dynamic_jobs().pop().unwrap();
        d.layers[1].dynamic=Some(vec![("grayscale".into(),32.0)]);
        assert!(d.dynamic_jobs_excluding(&std::collections::HashSet::from([first.uid])).is_empty());
        d.set_dynamic(first.uid,first.serial,cpu_stack(&first.src,2,1,&first.codes().unwrap()));
        let second=d.dynamic_jobs().pop().unwrap();
        d.layers[1].dynamic=Some(vec![("invert".into(),32.0)]);
        d.commit("edit");
        d.set_dynamic(second.uid,second.serial,cpu_stack(&second.src,2,1,&second.codes().unwrap()));
        let last=d.dynamic_jobs().pop().expect("the final edit must not be lost after committing");
        d.set_dynamic(last.uid,last.serial,cpu_stack(&last.src,2,1,&last.codes().unwrap()));
        assert_eq!(d.pixel_color(0,0),[245,235,225,255]);
        assert!(d.dynamic_jobs().is_empty());
    }
}

#[cfg(test)]
mod dynamic_dialog_identity_test {
    use super::*;
    #[test]
    fn gallery_fields_are_not_reused_by_a_different_window_with_the_same_engine() {
        let values=std::collections::HashMap::new();
        let gallery=fx_kind("frosted",&[4.0],"Galerie de filtres","gallery",&values);
        assert!(fx_matches(&gallery,"gallery"));
        assert!(!fx_matches(&gallery,"frosted"));
        let legacy=fx_kind("frosted",&[4.0],"Verre dépoli","",&values);
        assert!(fx_matches(&legacy,"frosted"));
        assert!(fx_matches("blur","blur"));
    }
}

#[cfg(test)]
mod dynamic_geometry_tests {
    use super::*;
    fn filtered() -> Doc {
        let mut d=Doc::new(4,3,[10,20,30,255],"test");
        let mut f=Layer::new("filter",4,3,[255,255,255,255]);
        f.dynamic=Some(vec![("invert".into(),32.0)]);d.layers.push(f);
        let j=d.dynamic_jobs().pop().unwrap();
        d.set_dynamic(j.uid,j.serial,cpu_stack(&j.src,4,3,&j.codes().unwrap()));d
    }
    #[test]
    fn geometry_changes_discard_old_outputs_and_reject_pending_frames() {
        for action in 0..4 {
            let mut d=filtered();
            d.layers[1].dynamic=Some(vec![("grayscale".into(),32.0)]);
            let pending=d.dynamic_jobs().pop().unwrap();
            match action {0=>d.resize(8,6),1=>d.resize_canvas_at(8,6,0,0),2=>d.rotate90(true),_=>d.flip(true)}
            assert!(d.layers[1].dyn_cache.is_none());
            d.set_dynamic(pending.uid,pending.serial,vec![255;d.w*d.h*4]);
            assert!(d.layers[1].dyn_cache.is_none(),"old geometry job rejected even for equal area");
            let _=d.pixel_color(d.w-1,d.h-1);
            let j=d.dynamic_jobs().pop().unwrap();
            d.set_dynamic(j.uid,j.serial,cpu_stack(&j.src,d.w,d.h,&j.codes().unwrap()));
            assert!(d.layers[1].dyn_cache.is_some());
        }
    }
    #[test]
    fn malformed_old_size_cache_never_indexes_past_its_buffer() {
        let mut d=filtered();
        for mode in [0,1,2] {
            d.layers[1].dynamic_mode=mode;
            d.layers[1].dyn_cache=Some(std::sync::Arc::new(vec![255;4]));
            assert_eq!(d.pixel_color(3,2),if mode==1 {[255,255,255,255]} else {[10,20,30,255]});
        }
    }
}

#[cfg(test)]
mod applied_strength_tests {
    use super::*;
    #[test]
    fn changing_legacy_strength_preserves_radius_and_disabled_state() {
        let mut stage=("off:gaussian".into(),7.0);
        set_stage_strength(&mut stage,25.0);
        assert!(stage.0.starts_with(DYN_OFF));
        assert_eq!(fx_params(&stage.0),Some(vec![1.0,7.0]));
        assert_eq!(stage.1,DYN_FULL/4.0);
        assert!(matches!(stage_of(dyn_base(&stage.0),stage.1),Some(Stage::Fx{mix:0.25,..})));
        set_stage_strength(&mut stage,100.0);
        assert_eq!(fx_params(&stage.0),Some(vec![1.0,7.0]));
    }
}
