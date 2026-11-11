// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
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

    /// Tampon tenu ailleurs aussi (historique, trait en cours) : la prochaine écriture le
    /// recopierait en entier.
    pub fn shared(&self) -> bool {
        std::sync::Arc::strong_count(&self.0) > 1
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
    /// brouillon pendant un réglage, à sa taille réduite (pas, pixels) : affiché à la place de
    /// `dyn_cache`. L'agrandir à la taille du document coûtait plus que de le calculer.
    pub dyn_low: Option<(usize, std::sync::Arc<Vec<u8>>)>,
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
    /// numéro du dernier calcul arrivé : égal à `dyn_serial`, `dyn_cache` correspond à `dyn_key`
    pub dyn_done: u64,
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
    /// pas de `src` : 1 = taille du document ; k > 1 = entrée composée directement au pas k
    /// (`ceil(w / k)` × `ceil(h / k)`), brouillon d'un geste
    pub step: usize,
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
    draft_stages_with(list, k, true)
}

/// Pile au pas `k` pendant un geste (déplacer un calque, régler une opacité sous des filtres ƒ) :
/// au plus près de l'aspect final, sans exiger qu'il soit exact (trame, pixellisation…) ; le
/// rendu exact suit le relâchement.
pub fn draft_stages_loose(list: &[(String, f32)], k: usize) -> Vec<Stage> {
    draft_stages_with(list, k, false).unwrap_or_default()
}

fn draft_stages_with(list: &[(String, f32)], k: usize, exact: bool) -> Option<Vec<Stage>> {
    if k <= 1 {
        return Some(list.iter().filter_map(|(t, r)| stage_of(t, *r)).collect());
    }
    let kf = k as f32;
    // étage du moteur dynamique (fx_dynamic.rs) : rayon ramené au pas, grilles exactes
    let code = |c: i32, r: f32| -> Option<f32> {
        let exact_r = match c {
            0 | 1 | 5 => Some(r / kf),
            3 => {
                let bs = (r * 2.0).round().clamp(2.0, 48.0) as usize;
                (bs % k == 0 && bs / k >= 2).then(|| (bs / k) as f32 / 2.0)
            }
            4 => ((r * 1.5).max(2.0) / kf >= 2.0).then_some(r / kf),
            13 => ((r * 1.5).max(3.0) / kf >= 3.0).then_some(r / kf),
            14 => None,
            _ => Some(r),
        };
        // geste : réglage ramené au pas même s'il ne tombe pas juste
        if exact { exact_r } else { exact_r.or(Some(if c == 14 { r } else { (r / kf).max(1.0) })) }
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
                Some((id, values)) => match crate::effects::dialog(&id) {
                    None if exact => return None,
                    None => Stage::Fx { name, p, mix, post },
                    Some((_, fields)) => {
                        let vals = crate::effects::Vals(values);
                        if exact && crate::effects::preview_step(fields, &vals, k) != k {
                            return None;
                        }
                        let scaled = crate::effects::scale_px(fields, &vals, 1.0 / kf);
                        // réglages du moteur qui changent avec l'échelle : repris de la version
                        // réduite ; les autres (graine, couleurs…) restent ceux de l'étage
                        match (crate::effects::params(&id, &vals, 0, 0), crate::effects::params(&id, &scaled, 0, 0)) {
                            (Some((_, base)), Some((_, small))) => {
                                let p: Vec<f32> = p.iter().enumerate().map(|(i, v)| if base.get(i) != small.get(i) { small.get(i).copied().unwrap_or(*v) } else { *v }).collect();
                                let post = post.is_some().then(|| crate::effects::post_chromatic(&name, &scaled)).flatten();
                                Stage::Fx { name, p, mix, post }
                            }
                            _ if exact => return None,
                            _ => Stage::Fx { name, p, mix, post },
                        }
                    }
                },
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

fn rect_union(a: (usize, usize, usize, usize), b: (usize, usize, usize, usize)) -> (usize, usize, usize, usize) {
    (a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3))
}

fn rect_grow(r: (usize, usize, usize, usize), m: usize, w: usize, h: usize) -> (usize, usize, usize, usize) {
    (r.0.saturating_sub(m), r.1.saturating_sub(m), (r.2 + m).min(w), (r.3 + m).min(h))
}

/// Morceau `r` (en cases) d'une image réduite au pas `k` : quatre points par case. Un pas de 1 : le
/// morceau tel quel. Un brouillon ne vit que le temps de l'affichage ; une vraie réduction relirait
/// tous les pixels à chaque fois.
pub fn shrink_rect(px: &[u8], w: usize, h: usize, k: usize, r: (usize, usize, usize, usize)) -> Vec<u8> {
    let mut out = Vec::with_capacity((r.2 - r.0) * (r.3 - r.1) * 4);
    if k <= 1 {
        for y in r.1..r.3 {
            out.extend_from_slice(&px[(y * w + r.0) * 4..(y * w + r.2) * 4]);
        }
        return out;
    }
    let (a, b) = (k / 4, k * 3 / 4);
    let at = |x: usize, y: usize| (y.min(h - 1) * w + x.min(w - 1)) * 4;
    for sy in r.1..r.3 {
        for sx in r.0..r.2 {
            let (x, y) = (sx * k, sy * k);
            let p = [at(x + a, y + a), at(x + b, y + a), at(x + a, y + b), at(x + b, y + b)];
            for c in 0..4 {
                out.push(((p.iter().map(|o| px[o + c] as u32).sum::<u32>() + 2) / 4) as u8);
            }
        }
    }
    out
}

/// Portée d'un flou à boîtes du moteur dynamique (fx_dynamic : `box_blur_rgb`, `box_blur_full`) :
/// passe de rayon `r`, puis, au-delà de `twice`, passe de 0,6 × `r`.
fn box_reach(r: f32, max: f32, twice: f32) -> usize {
    let r = r.trunc().clamp(1.0, max);
    r as usize + 1 + if r > twice { (r * 0.6).round() as usize + 1 } else { 0 }
}

/// Portée d'un étage du moteur dynamique : jusqu'où un pixel changé se fait sentir. `None` : il
/// dépend de la position dans l'image (trames) et ne se calcule pas sur un morceau.
fn code_margin(c: i32, r: f32) -> Option<usize> {
    Some(match c {
        0 => box_reach(r, 32.0, 1.0),
        1 => box_reach(r, 32.0, 1.0) + box_reach((r * 0.55).round(), 32.0, 1.0),
        2 => box_reach(r.clamp(1.0, 3.0), 32.0, 1.0),
        5 => box_reach(r, 64.0, 2.0),
        6..=12 => 0,
        _ => return None,
    })
}

/// Portée d'un étage de la pile (`None` : il lit toute l'image, ou l'on n'en sait rien). Liste
/// vérifiée par le test `patched_stage_equals_full_image`.
fn stage_margin(s: &Stage) -> Option<usize> {
    match s {
        Stage::Code(c, r) => code_margin(*c, *r),
        // l'aberration chromatique dépend de la distance au centre de l'image
        Stage::Fx { post: Some(_), .. } => None,
        Stage::Fx { name, p, .. } => {
            let f = |i: usize, d: f32| p.get(i).copied().filter(|v| v.is_finite()).unwrap_or(d);
            // comme `util::box_blur_for`
            let boxes = |r: f32, passes: usize| (r.max(0.0) as usize + 1) * passes + 1;
            Some(match name.as_str() {
                "brightness" | "grayscale" | "invert" | "invertalpha" | "sepia" | "exposure" | "posterize" | "threshold" | "solarize" | "hsv" | "vibrance" | "temptint" | "temperature" | "colorbal" | "curves" | "levels" | "duotone" | "cmjn" => 0,
                "blur" => boxes(f(0, 2.0), 1),
                "gaussian" => boxes(f(0, 2.0), 3),
                "sharpen" => boxes(f(1, 1.0).max(1.0), 1),
                "unsharp" => boxes(f(1, 3.0).max(1.0), 1),
                "dynstage" => code_margin(f(0, -1.0) as i32, f(1, 1.0))?,
                _ => return None,
            })
        }
    }
}

/// Portée d'une pile : celle de ses étages s'additionne.
pub fn stack_margin(stages: &[Stage]) -> Option<usize> {
    stages.iter().map(stage_margin).sum()
}

/// Étages d'une pile sur une petite image, sur place (`Doc::patch_dynamic`).
pub fn run_stages(src: &[u8], w: usize, h: usize, stages: &[Stage]) -> Vec<u8> {
    let engine = |name: &str, img: &[u8], p: &[f32]| {
        #[cfg(not(target_arch = "wasm32"))]
        let out = masterpaint_core::apply_parallel(name, img, w, h, p, std::thread::available_parallelism().map_or(1, |n| n.get()));
        #[cfg(target_arch = "wasm32")]
        let out = masterpaint_core::apply_image(name, img, w, h, p);
        out
    };
    let mut img = src.to_vec();
    for s in stages {
        match s {
            Stage::Code(c, r) => {
                if let Some(o) = engine("dynstage", &img, &[*c as f32, *r]) {
                    img = o;
                }
            }
            Stage::Fx { name, p, mix, post } => {
                if let Some(mut o) = engine(name, &img, p) {
                    if let Some(ca) = post {
                        o = masterpaint_core::chromatic_post(&img, &o, w, h, ca);
                    }
                    if *mix < 1.0 {
                        for (d, s) in o.iter_mut().zip(img.iter()) {
                            *d = (*s as f32 + (*d as f32 - *s as f32) * mix).round() as u8;
                        }
                    }
                    img = o;
                }
            }
        }
    }
    img
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

/// Résolution de rendu des nouveaux projets (1 : pleine ; Paramètres › Performances).
pub static RENDER_DEFAULT: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(1);

/// Identifiants uniques des documents et des calques.
pub fn next_uid() -> u64 {
    static N: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    N.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
}

impl Layer {
    /// Brouillon à afficher pour un document `w` × `h` : son pas et ses pixels.
    pub(crate) fn low_cache(&self, w: usize, h: usize) -> Option<(usize, &std::sync::Arc<Vec<u8>>)> {
        let (k, p) = self.dyn_low.as_ref().filter(|_| self.dynamic.is_some() && self.dynamic_mode != 1)?;
        (p.len() == w.div_ceil(*k) * h.div_ceil(*k) * 4).then_some((*k, p))
    }

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
            dyn_low: None,
            dyn_key: None,
            dyn_input: None,
            dyn_dirty: None,
            dyn_saved: Vec::new(),
            mask: None,
            uid: next_uid(),
            dyn_serial: 0,
            dyn_done: 0,
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
    /// même action répétée dans cette seule étape (« Auto-niveau (3) »)
    pub repeat: u32,
    /// ordre des étapes tous projets confondus : les plus anciennes sont oubliées d'abord
    pub seq: u64,
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
    /// résolution de rendu de ce projet : la toile et ses filtres ƒ sont calculés avec N fois moins
    /// de pixels par côté (0 : réglage par défaut). Les pixels du projet ne changent jamais.
    pub render_div: usize,
    /// « Rendre maintenant » : rendu complet valable tant que l'historique reste à cet état
    pub render_full_at: Option<(usize, usize)>,
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
    /// géométrie des objets changée (redimensionner, tourner…) : le rendu en cache des calques
    /// SVG est à refaire (voir `refresh_all`)
    pub vec_stale: bool,
    /// copie privée, préparée au repos, des pixels du calque actif (tampon désigné par la
    /// référence faible, partagé avec l'historique) : le premier coup de pinceau la prend au lieu
    /// de recopier tout le calque (photo de 20 Mpx : 80 Mo, près de la moitié du temps d'une touche)
    pub spare: Option<(std::sync::Weak<Vec<u8>>, Px)>,
}

/// Retouche d'un filtre ƒ au pas de l'affichage : seulement sur une grande image, et si la zone à
/// refaire en pleine résolution dépasse cette surface (pixels).
const PATCH_LOW_MIN: usize = 2_000_000;
const PATCH_LOW_AREA: usize = 200_000;

/// Nombre maximal d'étapes d'historique, tous projets ouverts confondus (Paramètres › Données).
/// La première étape de chaque projet (son image d'origine) n'est jamais oubliée ni comptée.
pub static HISTORY_MAX: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(20);
/// Dernières étapes toujours gardées dans chaque projet, même au-delà de `HISTORY_MAX`.
pub static HISTORY_KEEP: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(3);
static HISTORY_SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
/// Actions dont la répétition immédiate tient en une étape : un seul retour en arrière ramène
/// à l'image d'avant la première, et seuls cet original et le dernier résultat restent en mémoire.
const REPEATABLE: &[&str] = &["Auto-niveau"];

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
            render_div: 0,
            render_full_at: None,
            saved: (0, 1),
            mode: ColorMode::Rgb,
            sel_ref: None,
            sym: None,
            anim: None,
            vector_mode: false,
            vec_stale: false,
            spare: None,
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
        d.render_div = self.render_div;
        d.mode = self.mode;
        d.anim = self.anim.clone();
        d.vector_mode = self.vector_mode;
        d
    }

    /// Prépare la copie privée du calque actif (voir `spare`) s'il est grand et partagé avec
    /// l'historique. Vrai si une copie a été faite.
    pub fn prepare_spare(&mut self) -> bool {
        let Some(l) = self.layers.get(self.active) else { return false };
        let fits = |sp: &Option<(std::sync::Weak<Vec<u8>>, Px)>| sp.as_ref().is_some_and(|(wk, _)| l.px.is(wk));
        if fits(&self.spare) {
            return false;
        }
        self.spare = None;
        if l.px.len() < 8_000_000 || !l.px.shared() || l.vector.is_some() {
            return false;
        }
        self.spare = Some((l.px.weak(), Px::from(l.px.to_vec())));
        true
    }

    /// Début d'un trait : le calque actif prend sa copie privée si elle correspond toujours à
    /// ses pixels (même contenu ; l'original reste à l'historique et au trait).
    pub fn adopt_spare(&mut self) {
        if let Some((wk, sp)) = self.spare.take() {
            if let Some(l) = self.layers.get_mut(self.active) {
                if l.px.is(&wk) && sp.len() == l.px.len() {
                    l.px = sp;
                }
            }
        }
    }

    /// Document de travail sans historique (composition d'une partie des calques).
    pub(crate) fn scratch(w: usize, h: usize, layers: Vec<Layer>) -> Doc {
        Doc { w, h, layers, active: 0, sel: None, history: vec![], hindex: 0, title: String::new(), uid: 0, mask_of: None, render_div: 1, render_full_at: None, saved: (0, 0), mode: ColorMode::Rgb, sel_ref: None, sym: None, anim: None, vector_mode: false, vec_stale: false, spare: None }
    }

    /// Masque α (un octet par pixel) calculé depuis l'image d'un onglet de masque.
    pub fn mask_values(&self) -> Px {
        // cas courant (un seul calque, sans effet) : pas de composition de toute l'image
        let vis: Vec<&Layer> = self.layers.iter().filter(|l| l.visible && l.opacity > 0.0).collect();
        let flat = match vis[..] {
            [l] if l.opacity >= 1.0 && l.mask.is_none() && l.dyn_cache.is_none() && l.dynamic.is_none() && l.off.is_none() && !self.has_groups() => l.px.clone(),
            _ => Px::from(self.flatten()),
        };
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
        // Input previews are disposable; never pin another full image in undo history. Le
        // brouillon ƒ (petit) reste : sans lui, une étape prise pendant un brouillon revenait sans
        // rendu, avec une clé à jour, donc sans filtre visible.
        for layer in &mut layers { layer.dyn_input = None; layer.dyn_dirty = None; }
        Snapshot { label: label.into(), w: self.w, h: self.h, layers, active: self.active, sel_change: None, mode: self.mode, anim: self.anim.clone(), repeat: 1, seq: HISTORY_SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed) }
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
        // action répétée : le résultat remplace celui de l'étape, dont l'avant reste l'original
        let mut repeat = 1;
        if REPEATABLE.contains(&label) && self.history.len() >= 2 && self.history.last().is_some_and(|s| s.label == label) {
            if self.saved == (self.hindex, self.history.len()) {
                self.saved = (usize::MAX, 0);
            }
            repeat = self.history.pop().map_or(1, |s| s.repeat + 1);
        }
        let mut snap = self.snapshot(label);
        snap.repeat = repeat;
        if self.sel != self.sel_ref {
            // l'action a modifié la sélection avec les pixels : l'annuler la remet
            snap.sel_change = Some((self.sel_ref.take(), self.sel.clone()));
            self.sel_ref = self.sel.clone();
        }
        self.history.push(snap);
        let cap = HISTORY_MAX.load(std::sync::atomic::Ordering::Relaxed).max(HISTORY_KEEP.load(std::sync::atomic::Ordering::Relaxed));
        if self.history.len() > cap + 1 {
            // on garde l'état initial comme base : on fusionne la 2e étape dans la 1re
            self.history.remove(1);
        }
        self.hindex = self.history.len() - 1;
    }

    /// Étapes comptées dans la limite de l'historique (sans l'image d'origine).
    pub fn history_steps(&self) -> usize {
        self.history.len().saturating_sub(1)
    }

    /// Numéro de l'étape qui peut être oubliée (la plus ancienne), s'il y en a une : les dernières
    /// du projet sont gardées, ainsi que l'étape affichée.
    pub fn oldest_step(&self) -> Option<u64> {
        let keep = HISTORY_KEEP.load(std::sync::atomic::Ordering::Relaxed);
        (self.history_steps() > keep && self.hindex != 1).then(|| self.history[1].seq)
    }

    /// Oublie la plus ancienne étape (voir `oldest_step`).
    pub fn drop_oldest_step(&mut self) {
        if self.history.len() < 2 {
            return;
        }
        self.history.remove(1);
        if self.hindex >= 1 {
            self.hindex -= 1;
        }
        if self.saved.0 != usize::MAX && self.saved.0 >= 1 && self.saved.1 >= 1 {
            self.saved = (self.saved.0 - 1, self.saved.1 - 1);
        }
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
    #[cfg(test)]
    pub fn dynamic_jobs(&mut self) -> Vec<DynJob> {
        self.dynamic_jobs_excluding(&std::collections::HashSet::new())
    }

    /// One job per layer at a time. Dependent adjustment layers wait for their
    /// lower neighbours' newest cache rather than capturing stale input.
    #[cfg(test)]
    pub fn dynamic_jobs_excluding(&mut self, in_flight: &std::collections::HashSet<u64>) -> Vec<DynJob> {
        self.dynamic_jobs_step(in_flight, &|_| 1)
    }

    /// Comme `dynamic_jobs_excluding`, l'entrée du calque `uid` étant composée au pas
    /// `step(uid)` (brouillon d'un geste : composer toute l'image sous chaque filtre à chaque
    /// mouvement coûtait plus que les filtres eux-mêmes).
    pub fn dynamic_jobs_step(&mut self, in_flight: &std::collections::HashSet<u64>, step: &dyn Fn(u64) -> usize) -> Vec<DynJob> {
        let (w, h) = (self.w, self.h);
        let mut jobs = Vec::new();
        let mut pending = in_flight.clone();
        for i in 0..self.layers.len() {
            if pending.contains(&self.layers[i].uid) || !self.visible_at(i) { continue; }
            let Some(stack) = self.layers[i].dynamic.clone() else {
                self.layers[i].dyn_cache = None;
                self.layers[i].dyn_low = None;
                self.layers[i].dyn_key = None;
                self.layers[i].dyn_input = None;
                self.layers[i].dyn_dirty = None;
                continue;
            };
            // An empty adjustment layer is a neutral placeholder, not a blur.
            if stack.is_empty() {
                self.layers[i].dyn_cache = None;
                self.layers[i].dyn_low = None;
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
            let srcs: Vec<Px> = if mode == 1 { vec![self.layers[i].px.clone()] } else { self.dyn_sources(&below) };
            let input_settings = self.dyn_input_settings(mode, scope, &below);
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
            let k = if mode == 1 { 1 } else { step(self.layers[i].uid).max(1) };
            if k > 1 {
                // brouillon : entrée composée au pas k, jamais gardée comme entrée exacte
                self.layers[i].dyn_input = None;
                let (sw, sh) = (w.div_ceil(k), h.div_ceil(k));
                let mut small = vec![0u8; sw * sh * 4];
                Doc::scratch(w, h, below.iter().map(|&b| self.layers[b].clone()).collect()).composite_scaled(&mut small, k, (0, 0, sw, sh), false);
                let stack: Vec<Stage> = stack.iter().filter_map(|(t, r)| stage_of(t, *r)).collect();
                jobs.push(DynJob { uid: self.layers[i].uid, serial, src: std::sync::Arc::new(small), stack, step: k });
                pending.insert(self.layers[i].uid);
                continue;
            }
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
            jobs.push(DynJob { uid: self.layers[i].uid, serial, src, stack, step: 1 });
            pending.insert(self.layers[i].uid);
        }
        jobs
    }

    /// Réductions possibles pour cette image : pleine résolution, puis ÷2, ÷4 et ÷8 selon sa taille.
    pub fn render_choices(&self) -> Vec<usize> {
        let px = self.w * self.h;
        [(1, 0), (2, 0), (4, 4_000_000), (8, 16_000_000)].iter().filter(|(_, min)| px >= *min).map(|(d, _)| *d).collect()
    }

    /// Réduction choisie pour ce projet (ou celle des nouveaux projets), bornée par sa taille.
    pub fn render_div_set(&self) -> usize {
        let d = if self.render_div == 0 { RENDER_DEFAULT.load(std::sync::atomic::Ordering::Relaxed) } else { self.render_div };
        self.render_choices().into_iter().filter(|c| *c <= d).max().unwrap_or(1)
    }

    /// Réduction en vigueur : aucune juste après « Rendre maintenant », jusqu'à la prochaine modification.
    pub fn effective_div(&self) -> usize {
        if self.render_full_at == Some((self.hindex, self.history.len())) { 1 } else { self.render_div_set() }
    }

    /// Filtres ƒ encore en brouillon calculés en pleine résolution, sur place (processeur).
    pub fn render_full_dynamic(&mut self) {
        for i in 0..self.layers.len() {
            if self.layers[i].low_cache(self.w, self.h).is_none() {
                continue;
            }
            let scope = self.isolating_group(i);
            let below: Vec<usize> = (0..i).filter(|&k| scope.map_or(true, |g| self.is_inside(k, g))).collect();
            let input = Doc::scratch(self.w, self.h, below.iter().map(|&k| self.layers[k].clone()).collect()).flatten();
            let stages: Vec<Stage> = self.layers[i].dynamic.iter().flatten().filter_map(|(t, v)| stage_of(t, *v)).collect();
            let out = run_stages(&input, self.w, self.h, &stages);
            let l = &mut self.layers[i];
            l.dyn_cache = Some(std::sync::Arc::new(out));
            l.dyn_low = None;
            l.dyn_key = None;
        }
    }

    /// Image aplatie pour écrire un fichier ou modifier le projet : jamais un brouillon réduit.
    pub fn flatten_final(&self) -> Vec<u8> {
        if !self.layers.iter().any(|l| l.low_cache(self.w, self.h).is_some()) {
            return self.flatten();
        }
        let mut d = Doc::scratch(self.w, self.h, self.layers.clone());
        d.render_full_dynamic();
        d.flatten()
    }

    /// Tampons dont dépend l'entrée d'un filtre : pixels, masque et rendu ƒ de chaque calque.
    fn dyn_sources(&self, below: &[usize]) -> Vec<Px> {
        below.iter().flat_map(|&k| std::iter::once(self.layers[k].px.clone()).chain(self.layers[k].mask.iter().cloned()).chain(self.layers[k].dyn_cache.iter().map(|cache| Px(cache.clone()))).chain(self.layers[k].dyn_low.iter().map(|(_, low)| Px(low.clone())))).collect()
    }

    /// Réglages dont dépend l'entrée d'un filtre.
    fn dyn_input_settings<G: std::fmt::Debug>(&self, mode: i32, scope: G, below: &[usize]) -> String {
        let mut s = format!("{}x{}|{mode}|{scope:?}", self.w, self.h);
        if mode != 1 {
            for l in below.iter().map(|&k| &self.layers[k]) {
                s += &format!("|{}{}{}{:?}|{}{}{}", l.visible, l.opacity, l.blend.index(), l.dynamic, l.parent, l.group, l.pass);
            }
        }
        s
    }

    /// Filtres ƒ au-dessus du calque actif recalculés là où il vient d'être peint, plutôt que sur
    /// toute l'image : l'entrée, puis le rendu, sont refaits autour de la zone touchée, agrandie
    /// de la portée des effets. Rendu : la zone à recomposer. Un filtre qui ne s'y prête pas
    /// (effet qui lit toute l'image, zone trop grande par rapport à `budget` pixels, calcul en
    /// route) garde sa zone en attente, comme ceux qui en dépendent : calcul complet ensuite.
    /// `view_k` : pas de l'affichage (1 = pleine résolution à l'écran). Vue de loin, un filtre
    /// dont la retouche coûterait cher est retouché à ce pas (brouillon `dyn_low`, comme les
    /// aperçus d'effets) ; la pleine résolution revient après le geste (`needs_refine`).
    pub fn patch_dynamic(&mut self, budget: usize, view_k: usize) -> Option<(usize, usize, usize, usize)> {
        if self.has_groups() {
            return None;
        }
        let mut done: Option<(usize, usize, usize, usize)> = None;
        let mut patched: Vec<usize> = Vec::new();
        let mut blocked = false;
        for i in self.active + 1..self.layers.len() {
            let l = &self.layers[i];
            if l.dynamic.is_none() || l.dynamic_mode == 1 || !self.visible_at(i) {
                continue;
            }
            if l.dynamic.as_ref().is_some_and(|s| s.is_empty()) {
                self.layers[i].dyn_dirty = None;
                continue;
            }
            // un filtre plus bas a changé cette zone : celui-ci la relit aussi
            let dirty = match (l.dyn_dirty, done) {
                (Some(a), Some(b)) => Some(rect_union(a, b)),
                (a, b) => a.or(b),
            };
            let Some(r) = dirty else { continue };
            let zone = if blocked { None } else { self.patch_layer(i, r, budget, view_k, &patched) };
            match zone {
                Some(o) => {
                    done = Some(done.map_or(o, |d| rect_union(d, o)));
                    patched.push(i);
                }
                None => {
                    self.layers[i].dyn_dirty = Some(r);
                    blocked = true;
                }
            }
        }
        done
    }

    /// Recalcule le filtre du calque `i` autour de `r`, dans son rendu complet ou dans son brouillon
    /// réduit (résolution de rendu du projet) ; rendu : la zone refaite, en pixels du document.
    fn patch_layer(&mut self, i: usize, r: (usize, usize, usize, usize), budget: usize, view_k: usize, patched: &[usize]) -> Option<(usize, usize, usize, usize)> {
        let (w, h) = (self.w, self.h);
        let stack = self.layers[i].dynamic.clone()?;
        let mut low_k = self.layers[i].low_cache(w, h).map(|(k, _)| k);
        // vue réduite et retouche chère en pleine résolution : passage au brouillon à la taille
        // affichée (le rendu complet, réduit, sert de départ ; seule la zone peinte est refaite)
        if low_k.is_none() && view_k >= 2 && w * h >= PATCH_LOW_MIN && self.layers[i].dyn_done == self.layers[i].dyn_serial {
            let full: Vec<Stage> = stack.iter().filter_map(|(t, v)| stage_of(t, *v)).collect();
            let costly = stack_margin(&full).is_some_and(|m| (r.2 - r.0 + 4 * m) * (r.3 - r.1 + 4 * m) > PATCH_LOW_AREA);
            let step = (2..=view_k.min(16)).rev().find(|k| draft_stages(&stack, *k).is_some());
            if let (true, Some(k), Some(cache)) = (costly, step, self.layers[i].dyn_cache.as_ref().filter(|c| c.len() == w * h * 4)) {
                let low = shrink_rect(cache, w, h, k, (0, 0, w.div_ceil(k), h.div_ceil(k)));
                self.layers[i].dyn_low = Some((k, std::sync::Arc::new(low)));
                low_k = Some(k);
            }
        }
        let l = &self.layers[i];
        let stack = &stack;
        let k = low_k.unwrap_or(1);
        let stages: Vec<Stage> = if k > 1 { draft_stages(stack, k)? } else { stack.iter().filter_map(|(t, v)| stage_of(t, *v)).collect() };
        let m = stack_margin(&stages)?;
        // même calcul à l'échelle du rendu : zone qui change, et ce qu'il faut lire pour la refaire
        let (sw, sh) = (w.div_ceil(k), h.div_ceil(k));
        let rs = (r.0 / k, r.1 / k, r.2.div_ceil(k), r.3.div_ceil(k));
        let o = rect_grow(rs, m, sw, sh);
        let c = rect_grow(o, m, sw, sh);
        if (c.2 - c.0) * (c.3 - c.1) > budget || l.dyn_done != l.dyn_serial || (low_k.is_none() && l.dyn_cache.as_ref().is_none_or(|p| p.len() != w * h * 4)) {
            return None;
        }
        let below: Vec<usize> = (0..i).collect();
        let input_settings = self.dyn_input_settings(l.dynamic_mode, self.isolating_group(i), &below);
        let settings = format!("{stack:?}|{input_settings}");
        let srcs = self.dyn_sources(&below);
        // le rendu en place doit correspondre à tout, sauf à ce qui vient d'être peint
        let (keys, kset) = l.dyn_key.as_ref()?;
        if *kset != settings || keys.len() != srcs.len() {
            return None;
        }
        let mut n = 0;
        for &k in &below {
            let lk = &self.layers[k];
            let done = patched.contains(&k);
            let free = [k == self.active, false, done, done];
            let has = [true, lk.mask.is_some(), lk.dyn_cache.is_some(), lk.dyn_low.is_some()];
            for (f, _) in free.iter().zip(&has).filter(|(_, h)| **h) {
                if !*f && !srcs[n].is(&keys[n]) {
                    return None;
                }
                n += 1;
            }
        }
        if !l.dyn_input.as_ref().is_some_and(|d| d.settings == input_settings && d.pixels.len() == w * h * 4) {
            return None;
        }
        let mut input = self.layers[i].dyn_input.take()?;
        {
            let target: &mut Vec<u8> = std::sync::Arc::make_mut(&mut input.pixels);
            Doc::scratch(w, h, below.iter().map(|&k| self.layers[k].clone()).collect()).composite_rect(target.as_mut_slice(), r.0, r.1, r.2, r.3, false);
        }
        let (cw, ch) = (c.2 - c.0, c.3 - c.1);
        let crop = shrink_rect(&input.pixels, w, h, k, c);
        let out = run_stages(&crop, cw, ch, &stages);
        let row = (o.2 - o.0) * 4;
        let paste = |dst: &mut Vec<u8>, width: usize| {
            for y in o.1..o.3 {
                let from = ((y - c.1) * cw + o.0 - c.0) * 4;
                dst[(y * width + o.0) * 4..(y * width + o.0) * 4 + row].copy_from_slice(&out[from..from + row]);
            }
        };
        let weaks: Vec<_> = srcs.iter().map(Px::weak).collect();
        input.sources = weaks.clone();
        let l = &mut self.layers[i];
        // nouveaux tampons : les textures de la carte graphique seront renvoyées à la prochaine composition
        // seule la bande de lignes refaite repartira vers la carte graphique (gpu_damage)
        if let Some((k, low)) = l.dyn_low.take() {
            let before = std::sync::Arc::downgrade(&low);
            let mut low = std::sync::Arc::try_unwrap(low).unwrap_or_else(|a| (*a).clone());
            paste(&mut low, sw);
            let low = std::sync::Arc::new(low);
            crate::gpu_damage::note(&before, &low, crate::gpu_damage::rows(sw, o.1, o.3));
            l.dyn_low = Some((k, low));
        } else {
            let cache = l.dyn_cache.take()?;
            let before = std::sync::Arc::downgrade(&cache);
            let mut cache = std::sync::Arc::try_unwrap(cache).unwrap_or_else(|a| (*a).clone());
            paste(&mut cache, w);
            let cache = std::sync::Arc::new(cache);
            crate::gpu_damage::note(&before, &cache, crate::gpu_damage::rows(w, o.1, o.3));
            l.dyn_cache = Some(cache);
        }
        l.dyn_key = Some((weaks, settings));
        l.dyn_input = Some(input);
        l.dyn_dirty = None;
        Some((o.0 * k, o.1 * k, (o.2 * k).min(w), (o.3 * k).min(h)))
    }

    /// Calques ƒ affichés en brouillon plus réduit que la résolution de rendu du projet (retouche
    /// pendant un trait vu de loin, étape d'historique, fin de réglage) : à recalculer en entier.
    pub fn needs_refine(&self) -> Vec<u64> {
        let div = self.effective_div();
        self.layers.iter().filter(|l| l.low_cache(self.w, self.h).is_some_and(|(k, _)| k > div)).map(|l| l.uid).collect()
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
                l.dyn_low = None;
                l.dyn_done = serial;
            }
        }
    }

    /// Range un brouillon calculé au pas `k` (ignoré si le calque a changé depuis).
    pub fn set_dynamic_low(&mut self, uid: u64, serial: u64, k: usize, img: std::sync::Arc<Vec<u8>>) {
        if let Some(l) = self.layers.iter_mut().find(|l| l.uid == uid && l.dyn_serial == serial && l.dynamic.is_some()) {
            l.dyn_low = Some((k, img));
            l.dyn_done = serial;
        }
    }


    /// Calques à composer, de bas en haut. Un filtre dynamique « partout » à pleine opacité remplace
    /// tout ce qu'il couvre par son rendu : le dessous n'a pas à être lu, pixel après pixel.
    pub(crate) fn shown_layers(&self) -> Vec<&Layer> {
        let vis: Vec<&Layer> = self.layers.iter().filter(|l| l.visible && l.opacity > 0.0).collect();
        let n = self.w * self.h * 4;
        let covers = |l: &&Layer| {
            l.dynamic.is_some() && l.dynamic_mode == 2 && l.opacity >= 1.0 && l.uid != zone_view() && (l.low_cache(self.w, self.h).is_some() || l.dyn_cache.as_ref().is_some_and(|c| c.len() == n))
        };
        match vis.iter().rposition(|l| covers(l)) {
            Some(k) => vis[k..].to_vec(),
            None => vis,
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
        let vis = self.shown_layers();
        // un seul calque ordinaire, masque α compris : les couleurs telles quelles, l'alpha réduit par
        // le masque (entrée d'un filtre ƒ sur une photo masquée : 20 Mpx à chaque ouverture d'effet)
        if let ([l], false) = (&vis[..], checker) {
            let mask = l.mask.as_ref().filter(|m| m.len() == w * self.h);
            if l.opacity >= 1.0 && l.blend == Blend::Normal && l.dyn_cache.is_none() && l.dynamic.is_none() && l.dyn_saved.is_empty() && l.uid != zone_view() {
                for y in y0..y1 {
                    let (i, o) = ((y * w + x0) * 4, (y - y0) * w * 4 + x0 * 4);
                    let n = (x1 - x0) * 4;
                    rows[o..o + n].copy_from_slice(&l.px[i..i + n]);
                    for (k, p) in rows[o..o + n].chunks_exact_mut(4).enumerate() {
                        if let Some(m) = mask {
                            p[3] = ((p[3] as u32 * m[i / 4 + k] as u32 + 127) / 255) as u8;
                        }
                        if p[3] == 0 {
                            p[..3].fill(0);
                        }
                    }
                }
                return;
            }
        }
        let top = vis.last().filter(|l| l.opacity >= 1.0 && l.blend == Blend::Normal && l.mask.is_none() && l.dyn_saved.is_empty() && l.dyn_cache.is_none() && l.dynamic.is_none());
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
            self.pixel_rgba(&self.shown_layers(), i)
        };
        let q = |v: f32| (v * 255.0 + 0.5) as u8;
        [q(r), q(g), q(b), q(a)]
    }

    /// Couleur composée (r, v, b, a entre 0 et 1) du pixel d'indice `i` (octet, RVBA).
    fn pixel_rgba(&self, vis: &[&Layer], i: usize) -> (f32, f32, f32, f32) {
        let (mut r, mut g, mut b, mut a) = (0f32, 0f32, 0f32, 0f32);
        // calque opaque ici le plus haut (fusion normale, masque blanc ou absent, sans effet) : il recouvre tout
        // ce qui est dessous, la composition part de lui
        let mut start = 0;
        for (k, l) in vis.iter().enumerate().rev() {
            if l.px[i + 3] == 255 && l.opacity >= 1.0 && l.blend == Blend::Normal && l.dyn_cache.is_none() && l.dynamic.is_none() && l.dyn_saved.is_empty()
                && l.mask.as_ref().is_none_or(|m| m.len() != self.w * self.h || m[i / 4] == 255) {
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
        // brouillon en cours de réglage : le pixel de sa case
        let low = l.low_cache(self.w, self.h).map(|(k, c)| {
            let (sw, (x, y)) = (self.w.div_ceil(k), ((i / 4) % self.w, i / 4 / self.w));
            let o = ((y / k) * sw + x / k) * 4;
            [c[o], c[o + 1], c[o + 2], c[o + 3]]
        });
        let full = l.dyn_cache.as_ref().filter(|cache| l.dynamic.is_some() && matches!(l.dynamic_mode, 0 | 2) && cache.len() == self.w * self.h * 4).map(|c| [c[i], c[i + 1], c[i + 2], c[i + 3]]);
        if let Some(cache) = low.or(full) {
            let p = &l.px;
            let m = if l.dynamic_mode == 2 {
                l.opacity
            } else {
                (0.299 * p[i] as f32 + 0.587 * p[i + 1] as f32 + 0.114 * p[i + 2] as f32) / 255.0 * (p[i + 3] as f32 / 255.0) * l.opacity
            };
            if m > 0.0 {
                let fa = cache[3] as f32 / 255.0;
                r += (cache[0] as f32 / 255.0 - r) * m;
                g += (cache[1] as f32 / 255.0 - g) * m;
                b += (cache[2] as f32 / 255.0 - b) * m;
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
        let vis = self.shown_layers();
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
            (SelMode::Replace, _) | (SelMode::Add, None) | (SelMode::Intersect, None) | (SelMode::Xor, None) => mask,
            (SelMode::Xor, Some(mut o)) => {
                // OU exclusif (Paint.NET : Ctrl + clic droit) : |a − b|
                for (a, b) in o.iter_mut().zip(&mask) {
                    *a = (*a as i16 - *b as i16).unsigned_abs() as u8;
                }
                o
            }
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

    /// Étend (r > 0) ou réduit (r < 0) la sélection de |r| pixels : distance euclidienne exacte
    /// au contour (transformée de distance de Felzenszwalb, coût indépendant du rayon), donc
    /// coins arrondis comme Photoshop, bord anticrénelé. Les bords de l'image ne réduisent pas.
    pub fn grow_selection(&mut self, r: i32) {
        let Some(m) = self.sel.take() else { return };
        let (w, h) = (self.w, self.h);
        if r == 0 {
            self.sel = Some(m);
            return;
        }
        let out = grow_mask(&m, w, h, r as f32);
        self.sel = if out.iter().any(|v| *v > 0) { Some(out) } else { None };
    }

    /// Sélection › Modifier › Contour progressif (plume) : bord adouci de `r` pixels.
    pub fn feather_selection(&mut self, r: f32) {
        let Some(mut m) = self.sel.take() else { return };
        // flou boîte ×3 ≈ gaussienne d'écart-type r/2 (comme Photoshop, la plume est un rayon)
        blur_mask(&mut m, self.w, self.h, (r * 0.58).round().max(1.0) as usize);
        self.sel = if m.iter().any(|v| *v > 0) { Some(m) } else { None };
    }

    /// Sélection › Modifier › Bordure : bande de `width` pixels centrée sur le contour.
    pub fn border_selection(&mut self, width: f32) {
        let Some(m) = self.sel.take() else { return };
        let (w, h) = (self.w, self.h);
        let half = (width / 2.0).max(0.5);
        let outer = grow_mask(&m, w, h, half);
        let inner = grow_mask(&m, w, h, -half);
        let out: Vec<u8> = outer.iter().zip(&inner).map(|(a, b)| (*a as u16 * (255 - *b) as u16 / 255) as u8).collect();
        self.sel = if out.iter().any(|v| *v > 0) { Some(out) } else { None };
    }

    /// Sélection › Modifier › Lisser : arrondit les angles et retire les îlots de moins de `r`
    /// pixels (flou puis seuil à 50 %, bord anticrénelé gardé).
    pub fn smooth_selection(&mut self, r: f32) {
        let Some(mut m) = self.sel.take() else { return };
        let (w, h) = (self.w, self.h);
        blur_mask(&mut m, w, h, (r * 0.58).round().max(1.0) as usize);
        for v in m.iter_mut() {
            // rampe étroite autour de 128 : contour net mais pas crénelé
            *v = ((*v as i32 - 128) * 8 + 128).clamp(0, 255) as u8;
        }
        self.sel = if m.iter().any(|v| *v > 0) { Some(m) } else { None };
    }

    /// Sélection depuis l'alpha d'un calque (Ctrl+clic sur sa vignette dans Photoshop), combinée
    /// selon `mode`.
    pub fn select_layer_alpha(&mut self, i: usize, mode: SelMode) {
        let Some(l) = self.layers.get(i) else { return };
        let mut m: Vec<u8> = l.px.chunks_exact(4).map(|p| p[3]).collect();
        if let Some(mask) = &l.mask {
            for (v, k) in m.iter_mut().zip(mask.iter()) {
                *v = (*v as u16 * *k as u16 / 255) as u8;
            }
        }
        self.apply_selection(m, mode);
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

    /// Remplissage de contenu : la sélection est reconstituée par correspondance de morceaux
    /// (PatchMatch multi-échelle, module `inpaint` repris de LightCraft / PhotoCraft), bord
    /// adouci selon le masque. Calque actif.
    #[cfg_attr(not(test), allow(dead_code))]
    pub fn content_aware_fill(&mut self) -> bool {
        let Some(m) = self.sel.clone() else { return false };
        if !m.iter().any(|v| *v >= 128) {
            return false;
        }
        let (w, h) = (self.w, self.h);
        let a = self.active;
        masterpaint_core::inpaint::fill_rgba(&mut self.layers[a].px, w, h, &m, 48).is_some()
    }

    /// Correcteur localisé : reconstitue la zone peinte `hole` (couverture du pinceau) d'après
    /// ses abords. Retourne le rectangle modifié.
    pub fn heal_area(&mut self, hole: &[u8]) -> Option<(usize, usize, usize, usize)> {
        let (w, h) = (self.w, self.h);
        let a = self.active;
        let hole: Vec<u8> = match &self.sel {
            Some(s) => hole.iter().zip(s).map(|(c, s)| (*c as u16 * *s as u16 / 255) as u8).collect(),
            None => hole.to_vec(),
        };
        masterpaint_core::inpaint::fill_rgba(&mut self.layers[a].px, w, h, &hole, 24)
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

    /// Fusionne le calque actif dans celui du dessous (avec son mode et son opacité).
    pub fn merge_down(&mut self) {
        if self.active == 0 {
            return;
        }
        let top = self.layers.remove(self.active);
        self.active -= 1;
        let merged = Doc::scratch(self.w, self.h, vec![self.layers[self.active].clone(), top]).flatten_final();
        self.layers[self.active].px = merged.into();
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
            layer.dyn_low = None;
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

    /// Applique une transformation [a, b, c, d, e, f] aux objets des calques SVG (dessins de la
    /// frise compris) : ils sont recalculés, leurs tracés restent exacts.
    fn map_vectors(&mut self, m: [f32; 6]) {
        for l in self.layers.iter_mut() {
            if let Some(v) = l.vector.as_mut() {
                v.transform(m);
                self.vec_stale = true;
            }
            for c in l.cels.iter_mut() {
                if let Some(v) = c.vector.as_mut() {
                    v.transform(m);
                }
            }
        }
    }

    pub fn rotate90(&mut self, clockwise: bool) {
        let (w, h) = (self.w, self.h);
        let (wf, hf) = (w as f32, h as f32);
        self.map_vectors(if clockwise { [0.0, 1.0, -1.0, 0.0, hf, 0.0] } else { [0.0, -1.0, 1.0, 0.0, 0.0, wf] });
        if clockwise {
            self.remap(h, w, |x, y| (y, h - 1 - x));
        } else {
            self.remap(h, w, |x, y| (w - 1 - y, x));
        }
    }

    pub fn rotate180(&mut self) {
        let (w, h) = (self.w, self.h);
        self.map_vectors([-1.0, 0.0, 0.0, -1.0, w as f32, h as f32]);
        self.remap(w, h, |x, y| (w - 1 - x, h - 1 - y));
    }

    pub fn flip(&mut self, horizontal: bool) {
        let (w, h) = (self.w, self.h);
        self.map_vectors(if horizontal { [-1.0, 0.0, 0.0, 1.0, w as f32, 0.0] } else { [1.0, 0.0, 0.0, -1.0, 0.0, h as f32] });
        if horizontal {
            self.remap(w, h, |x, y| (w - 1 - x, y));
        } else {
            self.remap(w, h, |x, y| (x, h - 1 - y));
        }
    }

    /// Retourne (ou tourne de 180° : `horizontal` et `vertical`) le seul calque actif.
    pub fn flip_layer(&mut self, horizontal: bool, vertical: bool) {
        let (w, h) = (self.w, self.h);
        let (sx, ex) = if horizontal { (-1.0, w as f32) } else { (1.0, 0.0) };
        let (sy, ey) = if vertical { (-1.0, h as f32) } else { (1.0, 0.0) };
        if let Some(v) = self.layers[self.active].vector.as_mut() {
            v.transform([sx, 0.0, 0.0, sy, ex, ey]);
            self.vec_stale = true;
        }
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
        self.map_vectors([1.0, 0.0, 0.0, 1.0, -(x0 as f32), -(y0 as f32)]);
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
            self.map_vectors([1.0, 0.0, 0.0, 1.0, -(x0 as f32), -(y0 as f32)]);
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
        self.map_vectors([nw as f32 / w as f32, 0.0, 0.0, nh as f32 / h as f32, 0.0, 0.0]);
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
        self.map_vectors([1.0, 0.0, 0.0, 1.0, ox as f32, oy as f32]);
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
    Xor,
}

/// Transformée de distance euclidienne au carré (Felzenszwalb & Huttenlocher 2012), en place :
/// `f` vaut 0 sur les pixels « source » et `EDT_INF` ailleurs. Coût linéaire en pixels.
pub const EDT_INF: f32 = 1e20;
pub fn edt2(f: &mut [f32], w: usize, h: usize) {
    fn pass(f: &mut [f32], n: usize, stride: usize, off: usize, d: &mut [f64], v: &mut [usize], z: &mut [f64]) {
        let get = |f: &[f32], q: usize| f[off + q * stride] as f64;
        let mut k = 0usize;
        v[0] = 0;
        z[0] = f64::NEG_INFINITY;
        z[1] = f64::INFINITY;
        for q in 1..n {
            let fq = get(f, q) + (q * q) as f64;
            loop {
                let p = v[k];
                let s = (fq - (get(f, p) + (p * p) as f64)) / (2.0 * (q as f64 - p as f64));
                if s <= z[k] && k > 0 {
                    k -= 1;
                    continue;
                }
                if s <= z[k] {
                    // k == 0 : la nouvelle parabole domine partout
                    v[0] = q;
                    z[1] = f64::INFINITY;
                    break;
                }
                k += 1;
                v[k] = q;
                z[k] = s;
                z[k + 1] = f64::INFINITY;
                break;
            }
        }
        k = 0;
        for q in 0..n {
            while z[k + 1] < q as f64 {
                k += 1;
            }
            let p = v[k];
            d[q] = (q as f64 - p as f64).powi(2) + get(f, p);
        }
        for q in 0..n {
            f[off + q * stride] = d[q].min(EDT_INF as f64) as f32;
        }
    }
    let n = w.max(h);
    let (mut d, mut v, mut z) = (vec![0f64; n], vec![0usize; n], vec![0f64; n + 1]);
    for x in 0..w {
        pass(f, h, w, x, &mut d, &mut v, &mut z);
    }
    for y in 0..h {
        pass(f, w, 1, y * w, &mut d, &mut v, &mut z);
    }
}

/// Masque étendu (r > 0) ou réduit (r < 0) de |r| pixels à la distance euclidienne, bord
/// anticrénelé d'un pixel. Les bords de l'image ne comptent pas comme extérieur.
pub fn grow_mask(m: &[u8], w: usize, h: usize, r: f32) -> Vec<u8> {
    let grow = r > 0.0;
    let r = r.abs();
    // source : intérieur (pour étendre) ou extérieur (pour réduire)
    let mut f: Vec<f32> = m.iter().map(|v| if (*v >= 128) == grow { 0.0 } else { EDT_INF }).collect();
    if !f.iter().any(|v| *v == 0.0) {
        return if grow { vec![0; w * h] } else { m.to_vec() };
    }
    edt2(&mut f, w, h);
    m.iter()
        .zip(&f)
        .map(|(v, d2)| {
            let d = d2.sqrt();
            if grow {
                if *v >= 128 { 255 } else { ((r + 0.5 - d).clamp(0.0, 1.0) * 255.0).max(*v as f32) as u8 }
            } else if *v < 128 {
                0
            } else {
                ((d - r - 0.5).clamp(0.0, 1.0) * 255.0).min(*v as f32) as u8
            }
        })
        .collect()
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
    #[test]
    fn spare_copy_is_adopted_without_touching_history() {
        let mut d = super::Doc::new(2000, 1100, [255, 255, 255, 255], "t");
        assert!(d.prepare_spare(), "grand calque partagé avec l'historique");
        assert!(!d.prepare_spare(), "déjà prête");
        let kept = d.history[0].layers[0].px.arc();
        d.adopt_spare();
        assert!(!d.layers[0].px.shared(), "plus de copie à la première écriture");
        d.layers[0].px[0] = 7;
        assert_eq!(kept[0], 255);
        assert_eq!(d.layers[0].px[1], 255);
        // calque changé depuis : la copie périmée n'est pas prise
        d.commit("x");
        assert!(d.prepare_spare());
        d.layers[0].px[4] = 9;
        d.adopt_spare();
        assert_eq!(d.layers[0].px[4], 9);
    }

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
mod dynamic_patch_tests {
    use super::*;

    fn noisy(w: usize, h: usize, seed: u32) -> Vec<u8> {
        let mut x = seed.wrapping_mul(2654435761).max(1);
        let mut v = Vec::with_capacity(w * h * 4);
        for k in 0..w * h * 4 {
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
            // alpha varié : les effets qui le lisent sont vérifiés aussi
            v.push(if k % 4 == 3 && k % 3 != 0 { 255 } else { (x >> 8) as u8 });
        }
        v
    }

    fn fx(name: &str, p: &[f32]) -> Stage {
        Stage::Fx { name: name.into(), p: p.to_vec(), mix: 1.0, post: None }
    }

    /// La liste de `stage_margin` : sur un morceau, même résultat que sur toute l'image.
    #[test]
    fn patched_stage_equals_full_image() {
        let (w, h) = (120, 90);
        let src = noisy(w, h, 7);
        let mut cases: Vec<Stage> = Vec::new();
        for name in ["brightness", "grayscale", "invert", "invertalpha", "sepia", "exposure", "posterize", "threshold", "solarize", "hsv", "vibrance", "temptint", "temperature", "colorbal", "curves", "levels", "duotone", "cmjn"] {
            cases.push(fx(name, &[]));
        }
        cases.extend([fx("brightness", &[40.0, 20.0, 5.0, 5.0]), fx("blur", &[1.0]), fx("blur", &[9.0]), fx("gaussian", &[1.0]), fx("gaussian", &[7.0]), fx("sharpen", &[80.0, 3.0]), fx("unsharp", &[80.0, 5.0, 3.0]), fx("gaussian", &[6.0])]);
        for c in [0, 1, 2, 5] {
            for r in [1.0, 2.0, 5.0, 11.0] {
                cases.push(Stage::Code(c, r));
                cases.push(fx("dynstage", &[c as f32, r]));
            }
        }
        for c in 6..=12 {
            cases.push(Stage::Code(c, 8.0));
        }
        // pile de plusieurs étages, intensité partielle
        let piles: Vec<Vec<Stage>> = cases.iter().map(|s| vec![s.clone()]).chain([
            vec![fx("gaussian", &[3.0]), Stage::Code(0, 2.0), fx("sepia", &[])],
            vec![Stage::Fx { name: "gaussian".into(), p: vec![4.0], mix: 0.5, post: None }, fx("unsharp", &[50.0, 2.0, 0.0])],
        ]).collect();
        for r in [(50, 40, 56, 44), (0, 0, 5, 5), (115, 85, 120, 90)] {
            for stages in &piles {
                let m = stack_margin(stages).unwrap_or_else(|| panic!("{stages:?} : pas de portée"));
                let full = run_stages(&src, w, h, stages);
                let o = rect_grow(r, m, w, h);
                let c = rect_grow(o, m, w, h);
                let (cw, ch) = (c.2 - c.0, c.3 - c.1);
                let crop: Vec<u8> = (c.1..c.3).flat_map(|y| src[(y * w + c.0) * 4..(y * w + c.2) * 4].to_vec()).collect();
                let out = run_stages(&crop, cw, ch, stages);
                for y in o.1..o.3 {
                    let a = &full[(y * w + o.0) * 4..(y * w + o.2) * 4];
                    let b = &out[((y - c.1) * cw + o.0 - c.0) * 4..((y - c.1) * cw + o.2 - c.0) * 4];
                    assert!(a == b, "{stages:?} : morceau différent, ligne {y}");
                }
            }
        }
    }

    #[test]
    fn effects_reading_the_whole_image_are_not_patched() {
        assert_eq!(stack_margin(&[fx("autolevel", &[])]), None);
        assert_eq!(stack_margin(&[fx("vignette", &[])]), None);
        assert_eq!(stack_margin(&[Stage::Code(3, 8.0)]), None, "pixellisation : grille absolue");
        assert_eq!(stack_margin(&[Stage::Fx { name: "gaussian".into(), p: vec![2.0], mix: 1.0, post: Some(vec![8.0]) }]), None);
        assert_eq!(stack_margin(&[fx("sepia", &[]), fx("autolevel", &[])]), None, "un seul étage suffit");
    }

    fn doc_with_filter(stack: Vec<(String, f32)>) -> Doc {
        let mut d = Doc::new(64, 48, [0, 0, 0, 255], "t");
        d.layers[0].px = noisy(64, 48, 3).into();
        for p in d.layers[0].px.chunks_exact_mut(4) {
            p[3] = 255;
        }
        let mut l = Layer::new("filtre", 64, 48, [255, 255, 255, 255]);
        l.dynamic = Some(stack);
        l.dynamic_mode = 2;
        d.layers.push(l);
        d.active = 0;
        d
    }

    /// Fait les calculs demandés, sur toute l'image, jusqu'à ce qu'il n'y en ait plus.
    fn settle(d: &mut Doc) {
        for _ in 0..d.layers.len() + 1 {
            for j in d.dynamic_jobs() {
                let img = run_stages(&j.src, d.w, d.h, &j.stack);
                d.set_dynamic(j.uid, j.serial, img);
            }
        }
    }

    fn paint(d: &mut Doc, r: (usize, usize, usize, usize)) {
        let w = d.w;
        for y in r.1..r.3 {
            for x in r.0..r.2 {
                d.layers[0].px[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&[250, 10, 200, 255]);
            }
        }
        d.mark_dynamic_dirty(Some(r));
    }

    #[test]
    fn painting_under_a_filter_updates_only_around_the_stroke_and_stays_exact() {
        let g = fx_kind("gaussian", &[3.0], "Flou", "", &Default::default());
        let mut d = doc_with_filter(vec![(g, DYN_FULL)]);
        settle(&mut d);
        let before = d.layers[1].dyn_cache.clone().unwrap();
        paint(&mut d, (30, 20, 34, 23));
        let zone = d.patch_dynamic(1_000_000, 1).expect("zone recalculée");
        assert!(zone.0 < 30 && zone.2 > 34 && zone.2 - zone.0 < 64, "{zone:?}");
        assert!(d.dynamic_jobs().is_empty(), "plus rien à recalculer sur toute l'image");
        assert!(d.layers[1].dyn_dirty.is_none());
        let patched = d.layers[1].dyn_cache.clone().unwrap();
        assert!(!std::sync::Arc::ptr_eq(&before, &patched), "nouveau tampon : la carte graphique doit le recevoir");
        // même résultat qu'un recalcul complet
        d.layers[1].dyn_key = None;
        settle(&mut d);
        assert!(*patched == **d.layers[1].dyn_cache.as_ref().unwrap());
    }

    #[test]
    fn stacked_filters_follow_each_other() {
        let g = fx_kind("gaussian", &[2.0], "Flou", "", &Default::default());
        let mut d = doc_with_filter(vec![(g, DYN_FULL)]);
        let mut top = Layer::new("haut", 64, 48, [255, 255, 255, 255]);
        top.dynamic = Some(vec![(fx_kind("blur", &[2.0], "Flou", "", &Default::default()), DYN_FULL)]);
        top.dynamic_mode = 2;
        d.layers.push(top);
        settle(&mut d);
        paint(&mut d, (30, 20, 33, 22));
        assert!(d.patch_dynamic(1_000_000, 1).is_some());
        assert!(d.layers[1].dyn_dirty.is_none() && d.layers[2].dyn_dirty.is_none());
        assert!(d.dynamic_jobs().is_empty());
        let patched = d.layers[2].dyn_cache.clone().unwrap();
        d.layers[1].dyn_key = None;
        settle(&mut d);
        assert!(*patched == **d.layers[2].dyn_cache.as_ref().unwrap());
    }

    #[test]
    fn draft_is_shown_at_its_own_size_until_the_full_result() {
        let g = fx_kind("invert", &[], "Inverser", "", &Default::default());
        let mut d = doc_with_filter(vec![(g, DYN_FULL)]);
        d.layers[0].px = vec![10u8; 64 * 48 * 4].into();
        settle(&mut d);
        let full = d.pixel_color(5, 5);
        let (uid, serial) = (d.layers[1].uid, d.layers[1].dyn_serial);
        // pas de 4 : 16 × 12 cases, la case (3, 2) en rouge
        let mut low = vec![0u8; 16 * 12 * 4];
        for p in low.chunks_exact_mut(4) {
            p[3] = 255;
        }
        low[(2 * 16 + 3) * 4] = 255;
        d.set_dynamic_low(uid, serial, 4, std::sync::Arc::new(low));
        assert_eq!(d.pixel_color(13, 9), [255, 0, 0, 255], "lue dans la case du brouillon");
        assert_eq!(d.pixel_color(16, 9), [0, 0, 0, 255]);
        assert_eq!(d.shown_layers().len(), 1, "le brouillon couvre aussi le dessous");
        // le rendu complet remplace le brouillon
        let serial = d.layers[1].dyn_serial;
        d.set_dynamic(uid, serial, vec![255u8; 64 * 48 * 4]);
        assert!(d.layers[1].dyn_low.is_none());
        assert_ne!(d.pixel_color(5, 5), full);
        assert_eq!(d.pixel_color(5, 5), [255, 255, 255, 255]);
    }

    #[test]
    fn painting_under_a_filter_retouches_the_reduced_render_too() {
        let g = fx_kind("gaussian", &[2.0], "Flou", "", &Default::default());
        let mut d = Doc::new(400, 300, [0, 0, 0, 255], "t");
        d.layers[0].px = noisy(400, 300, 3).into();
        for p in d.layers[0].px.chunks_exact_mut(4) {
            p[3] = 255;
        }
        let mut f = Layer::new("filtre", 400, 300, [255, 255, 255, 255]);
        f.dynamic = Some(vec![(g, DYN_FULL)]);
        f.dynamic_mode = 2;
        d.layers.push(f);
        d.active = 0;
        // brouillon au pas de 4, comme le calcule update_dynamic
        let k = 4;
        let brouillon = |d: &mut Doc| {
            for j in d.dynamic_jobs() {
                let stages = draft_stages(d.layers[1].dynamic.as_ref().unwrap(), k).unwrap();
                let (sw, sh) = (d.w.div_ceil(k), d.h.div_ceil(k));
                let small = shrink_rect(&j.src, d.w, d.h, k, (0, 0, sw, sh));
                d.set_dynamic_low(j.uid, j.serial, k, std::sync::Arc::new(run_stages(&small, sw, sh, &stages)));
            }
        };
        brouillon(&mut d);
        let avant = d.layers[1].dyn_low.clone().unwrap().1;
        paint(&mut d, (30, 20, 34, 23));
        let zone = d.patch_dynamic(1_000_000, 1).expect("retouche du brouillon");
        assert!(zone.2 - zone.0 < 200, "seulement autour du trait : {zone:?}");
        assert!(d.dynamic_jobs().is_empty(), "plus rien à recalculer");
        assert!(d.layers[1].dyn_cache.is_none(), "le rendu complet n'a pas été calculé");
        let (_, retouche) = d.layers[1].dyn_low.clone().unwrap();
        assert!(*retouche != *avant, "le trait se voit");
        // même résultat qu'un brouillon recalculé en entier
        d.layers[1].dyn_key = None;
        brouillon(&mut d);
        assert!(*retouche == *d.layers[1].dyn_low.as_ref().unwrap().1);
    }

    #[test]
    fn saving_never_writes_a_reduced_render() {
        let g = fx_kind("gaussian", &[3.0], "Flou", "", &Default::default());
        let mut d = doc_with_filter(vec![(g, DYN_FULL)]);
        settle(&mut d);
        let full = d.flatten();
        let (uid, serial) = (d.layers[1].uid, d.layers[1].dyn_serial);
        d.set_dynamic_low(uid, serial, 4, std::sync::Arc::new(vec![9u8; 16 * 12 * 4]));
        assert_ne!(d.flatten(), full, "à l'écran : le brouillon");
        assert_eq!(d.flatten_final(), full, "à l'enregistrement : le rendu complet");
        assert!(d.layers[1].dyn_low.is_some(), "l'affichage n'est pas touché");
        d.render_full_dynamic();
        assert!(d.layers[1].dyn_low.is_none());
        assert_eq!(d.flatten(), full);
    }

    #[test]
    fn render_choices_follow_the_image_size() {
        assert_eq!(Doc::new(800, 600, [0; 4], "t").render_choices(), vec![1, 2]);
        assert_eq!(Doc::new(1280, 800, [0; 4], "t").render_choices(), vec![1, 2]);
        assert_eq!(Doc::new(2500, 1800, [0; 4], "t").render_choices(), vec![1, 2, 4]);
        let mut d = Doc::new(1280, 800, [0; 4], "t");
        d.render_div = 8;
        assert_eq!(d.effective_div(), 2, "bornée par la taille de l'image");
        d.render_full_at = Some((d.hindex, d.history.len()));
        assert_eq!(d.effective_div(), 1, "juste après Rendre maintenant");
        d.commit("trait");
        assert_eq!(d.effective_div(), 2, "la modification suivante revient au rendu réduit");
    }

    #[test]
    fn what_cannot_be_patched_waits_for_a_full_job() {
        // effet qui lit toute l'image
        let mut d = doc_with_filter(vec![(fx_kind("autolevel", &[], "Auto", "", &Default::default()), DYN_FULL)]);
        settle(&mut d);
        paint(&mut d, (30, 20, 33, 22));
        assert_eq!(d.patch_dynamic(1_000_000, 1), None);
        assert!(d.layers[1].dyn_dirty.is_some(), "zone gardée");
        assert_eq!(d.dynamic_jobs().len(), 1);
        // zone trop grande pour le budget
        let g = fx_kind("gaussian", &[3.0], "Flou", "", &Default::default());
        let mut d = doc_with_filter(vec![(g.clone(), DYN_FULL)]);
        settle(&mut d);
        paint(&mut d, (30, 20, 33, 22));
        assert_eq!(d.patch_dynamic(10, 1), None);
        assert_eq!(d.dynamic_jobs().len(), 1);
        // calcul en route : son résultat n'est pas encore là
        let mut d = doc_with_filter(vec![(g, DYN_FULL)]);
        let _ = d.dynamic_jobs();
        paint(&mut d, (30, 20, 33, 22));
        assert_eq!(d.patch_dynamic(1_000_000, 1), None);
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

    /// Auto-niveau répété : une seule étape, un seul retour en arrière rend l'image d'origine.
    #[test]
    fn repeated_auto_level_is_one_step() {
        let mut d = Doc::new(4, 4, [10, 20, 30, 255], "essai");
        let original = d.layer().px.to_vec();
        for k in 0..3u8 {
            d.layer_mut().px = vec![k + 50; 64].into();
            d.commit("Auto-niveau");
        }
        assert_eq!(d.history.len(), 2);
        assert_eq!(d.history[1].repeat, 3);
        assert!(d.modified());
        d.undo();
        assert_eq!(d.hindex, 0);
        assert_eq!(d.layer().px.to_vec(), original);
        d.redo();
        assert_eq!(d.layer().px[0], 52);
        // autre action entre deux : nouvelle étape
        d.commit("Remplissage");
        d.commit("Auto-niveau");
        assert_eq!(d.history.len(), 4);
        assert_eq!(d.history[3].repeat, 1);
    }

    /// Oubli des étapes : l'origine et les dernières restent, l'étape affichée suit.
    #[test]
    fn dropping_old_steps_keeps_origin_and_last() {
        let mut d = Doc::new(4, 4, [0, 0, 0, 255], "essai");
        for k in 0..6 {
            d.commit(&format!("étape {k}"));
        }
        let keep = HISTORY_KEEP.load(std::sync::atomic::Ordering::Relaxed);
        while d.oldest_step().is_some() {
            d.drop_oldest_step();
        }
        assert_eq!(d.history_steps(), keep);
        assert_eq!(d.history[0].label, "Nouveau Document");
        assert_eq!(d.history.last().map(|s| s.label.as_str()), Some("étape 5"));
        assert_eq!(d.hindex, d.history.len() - 1);
    }
}

#[cfg(test)]
mod selection_modify_tests {
    use super::*;

    /// disque de rayon r centré : masque 0 / 255
    fn disc(w: usize, h: usize, cx: f32, cy: f32, r: f32) -> Vec<u8> {
        (0..w * h).map(|i| if ((i % w) as f32 + 0.5 - cx).hypot((i / w) as f32 + 0.5 - cy) <= r { 255 } else { 0 }).collect()
    }

    #[test]
    fn grow_is_round_and_shrink_inverts_it() {
        let (w, h) = (64, 64);
        // carré 10×10 au centre, étendu de 8 px : coins ARRONDIS (distance euclidienne)
        let mut sq = vec![0u8; w * h];
        for y in 27..37 {
            for x in 27..37 {
                sq[y * w + x] = 255;
            }
        }
        let g = grow_mask(&sq, w, h, 8.0);
        assert_eq!(g[32 * w + 20], 255, "bord étendu de 7 px");
        // coin : à 8 px en x et en y du coin du carré, distance 11,3 > 8 → hors sélection
        assert_eq!(g[(36 + 8) * w + 36 + 8], 0, "coin arrondi");
        // réduire un disque de 20 px de 5 px ≈ disque de 15 px
        let d = disc(w, h, 32.0, 32.0, 20.0);
        let s = grow_mask(&d, w, h, -5.0);
        assert_eq!(s[32 * w + 32 + 13], 255);
        assert_eq!(s[32 * w + 32 + 17], 0);
        // les bords de l'image ne réduisent pas une sélection pleine
        let full = vec![255u8; w * h];
        assert!(grow_mask(&full, w, h, -4.0).iter().all(|v| *v == 255));
    }

    #[test]
    fn xor_border_and_alpha_selection() {
        let mut d = Doc::new(20, 20, [255, 255, 255, 255], "t");
        let mut a = vec![0u8; 400];
        a[..200].fill(255);
        d.sel = Some(a);
        let mut b = vec![0u8; 400];
        b[100..300].fill(255);
        d.apply_selection(b, SelMode::Xor);
        let s = d.sel.clone().unwrap();
        assert_eq!((s[50], s[150], s[250], s[350]), (255, 0, 255, 0));
        // bordure : bande autour du contour, intérieur vide
        let mut d = Doc::new(40, 40, [255, 255, 255, 255], "t");
        d.sel = Some(disc(40, 40, 20.0, 20.0, 12.0));
        d.border_selection(4.0);
        let s = d.sel.clone().unwrap();
        assert_eq!(s[20 * 40 + 20], 0);
        assert!(s[20 * 40 + 20 + 12] > 200);
        // opacité du calque : un calque transparent à moitié gauche
        let mut d = Doc::new(10, 10, [0, 0, 0, 255], "t");
        for y in 0..10 {
            for x in 0..5 {
                d.layer_mut().px[(y * 10 + x) * 4 + 3] = 0;
            }
        }
        d.select_layer_alpha(0, SelMode::Replace);
        let s = d.sel.clone().unwrap();
        assert_eq!((s[0], s[9]), (0, 255));
    }

    #[test]
    fn heal_area_fills_from_surroundings() {
        let mut d = Doc::new(48, 48, [40, 160, 60, 255], "t");
        let mut hole = vec![0u8; 48 * 48];
        for y in 20..28 {
            for x in 20..28 {
                d.layer_mut().px[(y * 48 + x) * 4..(y * 48 + x) * 4 + 4].copy_from_slice(&[250, 0, 250, 255]);
                hole[y * 48 + x] = 255;
            }
        }
        assert!(d.heal_area(&hole).is_some());
        let c = &d.layer().px[(24 * 48 + 24) * 4..(24 * 48 + 24) * 4 + 4];
        assert!(c[1] > 120 && c[0] < 100, "défaut effacé : {c:?}");
    }
}
