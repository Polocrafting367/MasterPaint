//! Fenêtres de réglage des effets : description des champs (relevée sur la version web,
//! `effects_gen.rs`) et traduction des valeurs en paramètres du moteur Rust —
//! transposition de js/rust/rust-effect-params.js (échelle d'aperçu = 1).

use std::collections::HashMap;

/// Champ d'une fenêtre d'effet. `kind` : 0 curseur, 1 case, 2 liste, 3 couleur, 4 texte.
#[derive(Clone, Copy)]
pub struct Field {
    pub id: &'static str,
    pub label: &'static str,
    pub kind: u8,
    pub min: f32,
    pub max: f32,
    pub step: f32,
    pub def: f32,
    pub def_s: &'static str,
    pub options: &'static [(&'static str, &'static str)],
}

pub fn dialog(effect: &str) -> Option<(&'static str, &'static [Field])> {
    match effect {
        "levels" => return Some(("Niveaux", LEVELS)),
        "cameraraw" => return Some(("Camera Raw", CAMERA_RAW)),
        "ral" => return Some(("Conversion RAL", RAL)),
        "ascii" => return Some(("Art ASCII", ASCII)),
        "gallery" => return Some(("Galerie de filtres", GALLERY)),
        "chromatic" => return Some(("Aberration chromatique", CHROMATIC)),
        "splitrgb" => return Some(("Séparer les canaux RVB", SPLIT_RGB)),
        "cutoutsel" => return Some(("Détourage par sélection", CUTOUT_SEL)),
        "contentfill" => return Some(("Remplissage contenu pris en compte", CONTENT_FILL)),
        _ => {}
    }
    let (_, title, base) = crate::effects_gen::DIALOGS.iter().find(|d| d.0 == effect)?;
    if effect == "chroma" {
        return Some((title, chroma_fields(base)));
    }
    Some(with_aberration(effect, title, base))
}

/// Incrustation : préréglages de la version web en tête, « en masque α lié » à la fin.
fn chroma_fields(base: &'static [Field]) -> &'static [Field] {
    use std::sync::OnceLock;
    static F: OnceLock<&'static [Field]> = OnceLock::new();
    F.get_or_init(|| {
        let mut v = vec![Field {
            id: "ef-ck-preset",
            label: "Préréglage",
            kind: 2,
            min: 0.0,
            max: 0.0,
            step: 1.0,
            def: 0.0,
            def_s: "",
            options: &[("", "—"), ("default", "Défaut"), ("soft", "Doux"), ("hard", "Fort"), ("shadow", "Ombres"), ("glass", "Verre"), ("despill", "Spill")],
        }];
        v.extend_from_slice(base);
        v.push(Field { id: "ef-ck-mask", label: "Appliquer en masque α lié", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] });
        Box::leak(v.into_boxed_slice())
    })
}

/// Préréglage choisi (`changed`) : met à jour les autres réglages. Vrai si des valeurs ont
/// changé (la fenêtre est alors redessinée).
pub fn apply_preset(effect: &str, changed: &str, v: &mut Vals) -> bool {
    if effect != "chroma" || changed != "ef-ck-preset" {
        return false;
    }
    // couleur clé : saturée → dérive chroma tolérée, despill utile (comme ChromaKeyer.applyPreset)
    let lab = lab(v.g("ef-ch-r", 0.0), v.g("ef-ch-g", 255.0), v.g("ef-ch-b", 0.0));
    let sat = lab[1].hypot(lab[2]);
    let spill = if sat > 15.0 && lab[0] > 15.0 { 100.0 } else { 0.0 };
    let drift = if sat > 30.0 { 60.0 } else { 100.0 };
    let (tol, fea) = (30.0f32, 15.0f32);
    // tol, feather, drift, black, white, spill, recover, luma, gamma
    let p: [f32; 9] = match v.s("ef-ck-preset") {
        "default" => [tol, fea, drift, 10.0, 95.0, spill, 0.0, 0.0, 1.0],
        "soft" => [(tol - 10.0).max(1.0), (fea * 1.8).min(100.0), drift, 5.0, 90.0, spill, 80.0, 40.0, 1.3],
        "hard" => [tol + (fea / 2.0).round(), 5.0, drift, 30.0, 70.0, (spill / 2.0).round(), 0.0, 0.0, 1.0],
        "shadow" => [1.0, 100.0, 100.0, 0.0, 85.0, spill, 100.0, 80.0, 1.9],
        "glass" => [1.0, 100.0, 100.0, 0.0, 100.0, 0.0, 100.0, 0.0, 1.0],
        "despill" => [tol, 15.0, 50.0, 5.0, 95.0, 100.0, 0.0, 0.0, 1.0],
        _ => return false,
    };
    for (id, x) in ["ef-ch-tol", "ef-ch-feather", "ef-ch-drift", "ef-ch-black", "ef-ch-white", "ef-ch-spill", "ef-ch-recover", "ef-ch-luma", "ef-ch-gamma"].iter().zip(p) {
        v.0.insert(id.to_string(), fmt_num(x));
    }
    true
}

/// Incrustation appliquée au masque α lié du calque plutôt qu'à ses pixels.
pub fn chroma_as_mask(effect: &str, v: &Vals) -> bool {
    effect == "chroma" && v.b("ef-ck-mask", false) > 0.0
}

/// sRGB (0..255) → CIELAB (D65).
fn lab(r: f32, g: f32, b: f32) -> [f32; 3] {
    let lin = |c: f32| {
        let c = (c / 255.0).clamp(0.0, 1.0);
        if c <= 0.04045 { c / 12.92 } else { ((c + 0.055) / 1.055).powf(2.4) }
    };
    let (r, g, b) = (lin(r), lin(g), lin(b));
    let x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
    let y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    let z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
    let f = |t: f32| if t > 0.008856 { t.cbrt() } else { 7.787 * t + 16.0 / 116.0 };
    let (fx, fy, fz) = (f(x), f(y), f(z));
    [116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz)]
}

/// Effets qui reçoivent l'option « Aberration chromatique » en plus de ceux relevés sur la
/// version web.
const CA_ADD: &[&str] = &["bulge", "pinch", "unfocus", "sketchblur"];

/// Option « Aberration chromatique » des autres effets : case, intensité, puis couple de
/// canaux et sens (ajoutés à toutes les fenêtres qui ont l'option).
const CA_FIELDS: &[Field] = &[
    Field { id: "ef-ca", label: "Aberration chromatique", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
    slider("ef-ca-amt", "Intensité", 1.0, 40.0, 1.0, 8.0),
    Field { id: "ef-ca-pair", label: "Canaux décalés", kind: 2, min: 0.0, max: 0.0, step: 1.0, def: 0.0, def_s: "", options: ABERR_PAIRS },
    Field { id: "ef-ca-inv", label: "Inverser les franges", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
];

const ABERR_PAIRS: &[(&str, &str)] =
    &[("0", "Rouge / bleu (objectif)"), ("1", "Rouge / vert"), ("2", "Vert / bleu"), ("3", "Vert / magenta"), ("4", "Bleu / jaune")];

/// Fenêtre relevée sur la version web, complétée des réglages d'aberration (tableau construit
/// une fois par effet).
fn with_aberration(effect: &str, title: &'static str, base: &'static [Field]) -> (&'static str, &'static [Field]) {
    use std::sync::{Mutex, OnceLock};
    static CACHE: OnceLock<Mutex<HashMap<String, &'static [Field]>>> = OnceLock::new();
    let has = base.iter().any(|f| f.id == "ef-ca");
    if !has && !CA_ADD.contains(&effect) {
        return (title, base);
    }
    let mut cache = CACHE.get_or_init(Default::default).lock().unwrap_or_else(|e| e.into_inner());
    let fields = *cache.entry(effect.to_string()).or_insert_with(|| {
        let mut v: Vec<Field> = base.to_vec();
        if !has {
            v.extend_from_slice(&CA_FIELDS[..2]);
        }
        v.extend_from_slice(&CA_FIELDS[2..]);
        Box::leak(v.into_boxed_slice())
    });
    (title, fields)
}

/// Aberration chromatique autonome (fx_distort::chromatic) : taille, forme, centre « objectif »,
/// zone nette, canaux, progression, chevauchement.
const CHROMATIC: &[Field] = &[
    slider("ef-chr", "Décalage (px)", 0.0, 60.0, 0.5, 6.0),
    Field {
        id: "ef-chr-shape",
        label: "Forme",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 3.0,
        def_s: "",
        options: &[("0", "Horizontale"), ("1", "Verticale"), ("2", "Selon l'angle"), ("3", "Radiale (objectif)")],
    },
    slider("ef-chr-angle", "Angle °", 0.0, 360.0, 1.0, 0.0),
    slider("ef-chr-cx", "Centre X %", -100.0, 100.0, 1.0, 0.0),
    slider("ef-chr-cy", "Centre Y %", -100.0, 100.0, 1.0, 0.0),
    slider("ef-chr-inner", "Zone nette (rayon %)", 0.0, 100.0, 1.0, 20.0),
    Field {
        id: "ef-chr-falloff",
        label: "Progression",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 1.0,
        def_s: "",
        options: &[("0", "Uniforme"), ("1", "Linéaire (bords plus marqués)"), ("2", "Quadratique")],
    },
    Field { id: "ef-chr-pair", label: "Canaux décalés", kind: 2, min: 0.0, max: 0.0, step: 1.0, def: 0.0, def_s: "", options: ABERR_PAIRS },
    Field { id: "ef-chr-inv", label: "Inverser les franges", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
    slider("ef-chr-overlap", "Chevauchement %", 0.0, 100.0, 1.0, 0.0),
];

/// Séparer les canaux RVB (aussi dans le menu Calques) : trois calques, en couleur (Écran,
/// sur fond noir : recomposition identique) ou en niveaux de gris, avec décalage par canal.
const SPLIT_RGB: &[Field] = &[
    Field {
        id: "ef-split-mode",
        label: "Calques",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 0.0,
        def_s: "",
        options: &[("color", "Couleur (fusion Écran, recomposition exacte)"), ("gray", "Niveaux de gris (mode Normal)")],
    },
    slider("ef-split-rx", "Décalage rouge X (px)", -100.0, 100.0, 1.0, 0.0),
    slider("ef-split-ry", "Décalage rouge Y (px)", -100.0, 100.0, 1.0, 0.0),
    slider("ef-split-gx", "Décalage vert X (px)", -100.0, 100.0, 1.0, 0.0),
    slider("ef-split-gy", "Décalage vert Y (px)", -100.0, 100.0, 1.0, 0.0),
    slider("ef-split-bx", "Décalage bleu X (px)", -100.0, 100.0, 1.0, 0.0),
    slider("ef-split-by", "Décalage bleu Y (px)", -100.0, 100.0, 1.0, 0.0),
    Field { id: "ef-split-hide", label: "Masquer le calque d'origine", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 1.0, def_s: "", options: &[] },
];

/// Détourage par sélection : plume, étendre / contracter, inverser, masque α lié.
const CUTOUT_SEL: &[Field] = &[
    slider("ef-cut-feather", "Plume (px)", 0.0, 64.0, 1.0, 2.0),
    slider("ef-cut-grow", "Étendre / contracter (px)", -64.0, 64.0, 1.0, 0.0),
    Field { id: "ef-cut-invert", label: "Inverser (garder l'extérieur)", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
    Field { id: "ef-cut-mask", label: "En masque α lié (non destructif)", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
];

/// Remplissage contenu pris en compte (fx_object::content_fill), réglages de la version web.
const CONTENT_FILL: &[Field] = &[
    slider("ef-cf-ext", "Extension de la sélection (px)", 0.0, 64.0, 1.0, 4.0),
    slider("ef-cf-feather", "Fondu de bord (px)", 0.0, 80.0, 1.0, 8.0),
    slider("ef-cf-detail", "Intensité du détail %", 0.0, 100.0, 1.0, 100.0),
    Field {
        id: "ef-cf-mode",
        label: "Mode",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 0.0,
        def_s: "",
        options: &[("0", "Texture (morceaux semblables)"), ("1", "Dégradé lisse")],
    },
    Field { id: "ef-cf-alpha", label: "Conserver la transparence", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 1.0, def_s: "", options: &[] },
];

/// Réglages de « Séparer les canaux RVB » : (niveaux de gris, décalages [R, V, B], masquer
/// l'original).
pub fn split_rgb_opts(v: &Vals) -> (bool, [(i32, i32); 3], bool) {
    let d = |id: &str| v.g(id, 0.0).round() as i32;
    (
        v.s("ef-split-mode") == "gray",
        [(d("ef-split-rx"), d("ef-split-ry")), (d("ef-split-gx"), d("ef-split-gy")), (d("ef-split-bx"), d("ef-split-by"))],
        v.b("ef-split-hide", true) > 0.0,
    )
}

/// Réglages du détourage par sélection : (plume px, étendre px, inverser, masque α lié).
pub fn cutout_opts(v: &Vals) -> (f32, i32, bool, bool) {
    (v.g("ef-cut-feather", 2.0).max(0.0), v.g("ef-cut-grow", 0.0).round() as i32, v.b("ef-cut-invert", false) > 0.0, v.b("ef-cut-mask", false) > 0.0)
}

/// Paramètres de fx_object::content_fill (sans la graine, ajoutée par l'appelant).
pub fn content_fill_params(v: &Vals) -> Vec<f32> {
    vec![
        v.g("ef-cf-ext", 4.0),
        v.g("ef-cf-feather", 8.0),
        v.g("ef-cf-detail", 100.0),
        v.s("ef-cf-mode").parse::<f32>().unwrap_or(0.0),
        v.b("ef-cf-alpha", true),
    ]
}

const fn slider(id: &'static str, label: &'static str, min: f32, max: f32, step: f32, def: f32) -> Field {
    Field { id, label, kind: 0, min, max, step, def, def_s: "", options: &[] }
}

/// Conversion RAL (fx_adjust::palette_convert) : nuancier et tramage, comme FilterManager.js.
const RAL: &[Field] = &[
    Field {
        id: "ef-ral-category",
        label: "Nuancier RAL",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 0.0,
        def_s: "",
        options: &[
            ("all", "Tous (216 couleurs)"),
            ("yellow", "Jaunes (RAL 1000 - 1037)"),
            ("orange", "Oranges (RAL 2000 - 2017)"),
            ("red", "Rouges (RAL 3000 - 3033)"),
            ("violet", "Violets (RAL 4001 - 4012)"),
            ("blue", "Bleus (RAL 5000 - 5026)"),
            ("green", "Verts (RAL 6000 - 6038)"),
            ("grey", "Gris (RAL 7000 - 7048)"),
            ("brown", "Bruns (RAL 8000 - 8029)"),
            ("white-black", "Blancs et Noirs (RAL 9001 - 9023)"),
        ],
    },
    slider("ef-ral-dither", "Tramage %", 0.0, 100.0, 1.0, 0.0),
];

/// Galerie de filtres : looks Camera Raw de la version web (gallery_gen.rs) et corrections rapides.
const GALLERY: &[Field] = &[Field {
    id: "ef-gallery",
    label: "Choix du look",
    kind: 2,
    min: 0.0,
    max: 0.0,
    step: 1.0,
    def: 0.0,
    def_s: "",
    options: &[
        ("none", "Aucun (manuel)"),
        ("autolevel", "Niveaux automatiques"),
        ("grayscale", "Noir et blanc simple"),
        ("sepia", "Sépia simple"),
        ("invert", "Négatif"),
        ("bw_soft", "Noir & Blanc Doux"),
        ("bw_hard", "Noir & Blanc Intense"),
        ("sepia_classic", "Sépia Historique"),
        ("teal_and_orange", "Cinéma (Teal & Orange)"),
        ("neon_city", "Néon Urbain"),
        ("cyber_green", "Code Vert (Cyber)"),
        ("urban_night", "Nuit Bleutée"),
        ("pro_film", "Pellicule Pro"),
        ("sunkissed", "Soleil Doré"),
        ("high_key", "High Key (Lumineux)"),
        ("cinematic_mood", "Ambiance Cinéma Subtile"),
    ],
}];

/// Art ASCII (calculé par ascii.rs : il faut une police).
const ASCII: &[Field] = &[
    slider("ef-ascii-size", "Taille car. (px)", 4.0, 48.0, 1.0, 10.0),
    Field {
        id: "ef-ascii-set",
        label: "Jeu de caractères",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 0.0,
        def_s: "",
        options: &[("standard", "Classique (10 niveaux)"), ("detailed", "Détaillé (70 niveaux)"), ("blocks", "Blocs (░▒▓█)"), ("dots", "Points"), ("binary", "Binaire (1/0)"), ("custom", "Personnalisé (champ ci-dessous)")],
    },
    Field { id: "ef-ascii-chars", label: "Caractères personnalisés (du plus clair au plus dense)", kind: 4, min: 0.0, max: 0.0, step: 1.0, def: 0.0, def_s: " .:-=+*#%@", options: &[] },
    slider("ef-ascii-gamma", "Gamma", 20.0, 300.0, 1.0, 100.0),
    Field { id: "ef-ascii-invert", label: "Inverser la rampe", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
    Field { id: "ef-ascii-bold", label: "Gras", kind: 1, min: 0.0, max: 1.0, step: 1.0, def: 0.0, def_s: "", options: &[] },
    Field { id: "ef-ascii-color", label: "Couleur", kind: 2, min: 0.0, max: 0.0, step: 1.0, def: 0.0, def_s: "", options: &[("pixel", "Couleur des pixels"), ("solid", "Couleur unique (ci-dessous)")] },
    Field { id: "ef-ascii-ink", label: "Couleur unique (clic : couleur principale)", kind: 3, min: 0.0, max: 0.0, step: 1.0, def: 0.0, def_s: "#000000", options: &[] },
    Field {
        id: "ef-ascii-bg",
        label: "Fond",
        kind: 2,
        min: 0.0,
        max: 0.0,
        step: 1.0,
        def: 0.0,
        def_s: "",
        options: &[("transparent", "Transparent"), ("black", "Noir"), ("white", "Blanc"), ("secondary", "Couleur secondaire")],
    },
];

/// Réglages de l'Art ASCII (ascii.rs) d'après les valeurs de la fenêtre.
pub fn ascii_opts(v: &Vals, secondary: u32) -> crate::ascii::Opts {
    let set = v.s("ef-ascii-set");
    let chars: Vec<char> = match crate::ascii::RAMPS.iter().find(|r| r.0 == set) {
        Some(r) => r.1.chars().collect(),
        None => v.s("ef-ascii-chars").chars().collect(),
    };
    let rgb = |x: u32| [(x >> 16) as u8, (x >> 8) as u8, x as u8];
    crate::ascii::Opts {
        size: v.g("ef-ascii-size", 10.0),
        chars,
        gamma: v.g("ef-ascii-gamma", 100.0) / 100.0,
        invert: v.b("ef-ascii-invert", false) > 0.5,
        bold: v.b("ef-ascii-bold", false) > 0.5,
        ink: (v.s("ef-ascii-color") == "solid").then(|| rgb(v.hex("ef-ascii-ink", 0) as u32)),
        bg: match v.s("ef-ascii-bg") {
            "black" => Some([0, 0, 0]),
            "white" => Some([255, 255, 255]),
            "secondary" => Some(rgb(secondary)),
            _ => None,
        },
    }
}

/// Niveaux (fx_adjust::levels : entrée noir/blanc, gamma, sortie noir/blanc).
const LEVELS: &[Field] = &[
    slider("ef-lv-ib", "Entrée : noir", 0.0, 254.0, 1.0, 0.0),
    slider("ef-lv-iw", "Entrée : blanc", 1.0, 255.0, 1.0, 255.0),
    slider("ef-lv-g", "Gamma", 0.1, 5.0, 0.01, 1.0),
    slider("ef-lv-ob", "Sortie : noir", 0.0, 255.0, 1.0, 0.0),
    slider("ef-lv-ow", "Sortie : blanc", 0.0, 255.0, 1.0, 255.0),
];

/// Camera Raw (fx_camraw.rs) : réglages principaux du panneau web.
const CAMERA_RAW: &[Field] = &[
    slider("cr-exposure", "Exposition", -100.0, 100.0, 1.0, 0.0),
    slider("cr-temp", "Température", -100.0, 100.0, 1.0, 0.0),
    slider("cr-tint", "Teinte", -100.0, 100.0, 1.0, 0.0),
    slider("cr-contrast", "Contraste", -100.0, 100.0, 1.0, 0.0),
    slider("cr-highlights", "Hautes lumières", -100.0, 100.0, 1.0, 0.0),
    slider("cr-shadows", "Ombres", -100.0, 100.0, 1.0, 0.0),
    slider("cr-whites", "Blancs", -100.0, 100.0, 1.0, 0.0),
    slider("cr-blacks", "Noirs", -100.0, 100.0, 1.0, 0.0),
    slider("cr-clarity", "Clarté", -100.0, 100.0, 1.0, 0.0),
    slider("cr-dehaze", "Correction du voile", -100.0, 100.0, 1.0, 0.0),
    slider("cr-vibrance", "Vibrance", -100.0, 100.0, 1.0, 0.0),
    slider("cr-saturation", "Saturation", -100.0, 100.0, 1.0, 0.0),
    slider("cr-sharpen", "Netteté", 0.0, 100.0, 1.0, 0.0),
    slider("cr-vignette", "Vignettage", -100.0, 100.0, 1.0, 0.0),
    slider("cr-grain", "Grain", 0.0, 100.0, 1.0, 0.0),
];

/// Valeurs saisies, comme les `<input id="ef-…">` de la version web (chaînes).
#[derive(Default, Clone)]
pub struct Vals(pub HashMap<String, String>);

impl Vals {
    /// Valeurs par défaut d'une fenêtre.
    pub fn defaults(fields: &[Field]) -> Self {
        let mut v = Vals::default();
        for f in fields {
            let s = match f.kind {
                2 => f.options.get(f.def as usize).map(|o| o.0.to_string()).unwrap_or_default(),
                3 | 4 => f.def_s.to_string(),
                1 => (if f.def > 0.0 { "1" } else { "0" }).to_string(),
                _ => fmt_num(f.def),
            };
            v.0.insert(f.id.to_string(), s);
        }
        v
    }

    fn g(&self, id: &str, d: f32) -> f32 {
        self.0.get(id).and_then(|s| s.replace(',', ".").trim().parse::<f32>().ok()).filter(|v| v.is_finite()).unwrap_or(d)
    }

    fn b(&self, id: &str, d: bool) -> f32 {
        match self.0.get(id).map(|s| s.as_str()) {
            None | Some("") => d as u8 as f32,
            Some(s) => (s == "1" || s == "true") as u8 as f32,
        }
    }

    fn hex(&self, id: &str, d: u32) -> f32 {
        self.0
            .get(id)
            .and_then(|s| u32::from_str_radix(s.trim().trim_start_matches('#'), 16).ok())
            .filter(|_| self.0.get(id).map_or(false, |s| s.trim().trim_start_matches('#').len() == 6))
            .unwrap_or(d) as f32
    }

    fn s(&self, id: &str) -> &str {
        self.0.get(id).map(|s| s.as_str()).unwrap_or("")
    }
}

pub fn fmt_num(v: f32) -> String {
    if (v - v.round()).abs() < 1e-6 { format!("{}", v.round() as i64) } else { format!("{v}") }
}

/// Ordre des 49 réglages VHS du moteur (js/effects/vhs-core.js, VHS_PARAM_ORDER).
const VHS_ORDER: [&str; 49] = [
    "chroma_bleed", "chroma_blur", "chroma_saturation", "edge_sat", "shadow_sat", "hs_sat", "chroma_phase", "shift_y", "shift_r", "shift_g",
    "shift_b", "crop_padding", "crop_feather", "head_switch_freq", "pixel_size", "luma_contrast", "luma_brightness", "luma_smear", "right_pink",
    "right_pink_width", "glitch_intensity", "head_switch_wave", "head_switch_noise", "hs_color_tear", "tear_max_height", "tear_length",
    "tear_thickness", "jitter_amp", "dropout_chance", "glitch_jitter", "glitch_dropouts", "glitch_tears", "glitch_noise", "head_switch_rows",
    "head_switch_pull", "jitter_freq", "dropout_len", "dropout_thickness", "tear_color", "noise_intensity_y", "noise_intensity_c",
    "apply_color_cast", "cast_r", "cast_g", "cast_b", "enable_y", "enable_r", "enable_g", "enable_b",
];

/// Paramètres du moteur pour un effet (None = effet non géré par le moteur Rust).
/// `secondary` : couleur secondaire (effet Transparence), `seed` : graine aléatoire.
pub fn params(effect: &str, v: &Vals, secondary: u32, seed: u32) -> Option<(&'static str, Vec<f32>)> {
    let g = |id: &str, d: f32| v.g(id, d);
    let px_int = |x: f32| (x.round()).max(1.0);
    let px_rad = |x: f32| if x < 1.0 { 0.0 } else { x.round().max(1.0) };
    let or1 = |x: f32| if x == 0.0 { 1.0 } else { x };
    let seedf = seed as f32;
    let name: &'static str;
    let p: Vec<f32> = match effect {
        "brightness" => {
            name = "brightness";
            vec![g("ef-b", g("ef-br", 0.0)), g("ef-c", g("ef-co", 0.0)), g("ef-bc-temp", 0.0), g("ef-bc-tint", 0.0)]
        }
        "grayscale" | "invert" | "invertalpha" | "sepia" | "autolevel" | "cmjn" | "mirrorquad" => {
            name = static_name(effect)?;
            vec![]
        }
        "exposure" => {
            name = "exposure";
            vec![g("ef-exp", 100.0), g("ef-gamma", 100.0)]
        }
        "posterize" => {
            if v.b("ef-post-bw", false) > 0.0 {
                name = "threshold";
                vec![g("ef-thr", 128.0)]
            } else {
                name = "posterize";
                vec![g("ef-lvl", 4.0).max(2.0)]
            }
        }
        "threshold" => {
            name = "threshold";
            vec![g("ef-thr", 128.0)]
        }
        "solarize" => {
            name = "solarize";
            vec![g("ef-sol", 128.0)]
        }
        "hsv" => {
            name = "hsv";
            let mut p = vec![g("ef-h", 0.0), g("ef-s", 0.0), g("ef-l", 0.0), 0.0];
            p.extend(std::iter::repeat(0.0).take(24));
            p
        }
        "vibrance" => {
            name = "vibrance";
            vec![g("ef-vibr", 50.0)]
        }
        "temptint" => {
            name = "temptint";
            vec![g("ef-tt-temp", 0.0), g("ef-tt-tint", 0.0)]
        }
        "colorbal" => {
            name = "colorbal";
            vec![g("ef-cb-r", 0.0), g("ef-cb-g", 0.0), g("ef-cb-b", 0.0), 0.0]
        }
        "ral" => {
            // nuancier : préfixe du code (RAL 1xxx jaunes, 2xxx oranges…)
            let pre = match v.s("ef-ral-category") {
                "yellow" => "RAL 1",
                "orange" => "RAL 2",
                "red" => "RAL 3",
                "violet" => "RAL 4",
                "blue" => "RAL 5",
                "green" => "RAL 6",
                "grey" => "RAL 7",
                "brown" => "RAL 8",
                "white-black" => "RAL 9",
                _ => "RAL",
            };
            let cols: Vec<_> = crate::ral_gen::RAL.iter().filter(|c| c.0.starts_with(pre)).collect();
            name = "ral";
            let mut p = vec![g("ef-ral-dither", 0.0), cols.len() as f32];
            for c in cols {
                p.extend([c.1 as f32, c.2 as f32, c.3 as f32]);
            }
            p
        }
        // calculé par l'interface (ascii.rs), pas par le moteur
        "ascii" => {
            name = "ascii";
            vec![]
        }
        "duotone" => {
            name = "duotone";
            vec![v.hex("ef-duo-c1", 0x1a0533), v.hex("ef-duo-c2", 0xfff5e0), g("ef-duo-mid", 128.0)]
        }
        "highlightsshadows" => {
            name = "highlightsshadows";
            vec![g("ef-hs-shadows", 30.0), g("ef-hs-highlights", 0.0), g("ef-hs-radius", 25.0).max(1.0), g("ef-hs-clarity", 0.0)]
        }
        "quantize" => {
            name = "quantize";
            vec![g("ef-q-colors", 16.0), g("ef-q-dither", 50.0)]
        }
        "blur" | "gaussian" => {
            name = static_name(effect)?;
            vec![px_rad(g("ef-rad", 2.0))]
        }
        "median" => {
            name = "median";
            vec![px_rad(g("ef-med-rad", 10.0)).max(1.0), g("ef-med-pct", 50.0)]
        }
        "reducenoise" => {
            name = "reducenoise";
            vec![or1(px_rad(g("ef-rn-radius", 10.0))).min(20.0), g("ef-rn-strength", 40.0)]
        }
        "unfocus" => {
            name = "unfocus";
            vec![or1(px_rad(g("ef-unfocus-r", 8.0))), g("ef-unfocus-hl", 55.0)]
        }
        "motionblur" => {
            name = "motionblur";
            vec![g("ef-mblur-angle", 25.0), g("ef-mblur-dist", 10.0).round().max(1.0), v.b("ef-mblur-center", true)]
        }
        "surfaceblur" => {
            name = "surfaceblur";
            vec![or1(px_rad(g("ef-sblur-r", 6.0))), g("ef-sblur-t", 15.0)]
        }
        "fragment" => {
            name = "fragment";
            vec![g("ef-frag-n", 4.0), g("ef-frag-d", 8.0).round(), g("ef-frag-r", 0.0)]
        }
        "radialblur" => {
            name = "radialblur";
            vec![g("ef-rblur-angle", 2.0), g("ef-rblur-quality", 2.0), g("ef-rblur-ox", 0.0), g("ef-rblur-oy", 0.0), g("ef-rblur-inner", 0.0)]
        }
        "zoomblur" => {
            name = "zoomblur";
            vec![g("ef-zblur-amount", 10.0), g("ef-zblur-ox", 0.0), g("ef-zblur-oy", 0.0), g("ef-zblur-inner", 0.0)]
        }
        "sketchblur" => {
            name = "sketchblur";
            vec![g("ef-skb-r", 10.0).max(1.0), g("ef-skb-var", 50.0), g("ef-skb-seed", 0.0)]
        }
        "bulge" => {
            name = "bulge";
            vec![g("ef-bulge", 40.0)]
        }
        "pinch" => {
            name = "pinch";
            vec![g("ef-pinch", 40.0)]
        }
        "twist" => {
            name = "twist";
            vec![g("ef-twist", 30.0)]
        }
        "polarInvert" => {
            name = "polarInvert";
            vec![g("ef-polar", 80.0)]
        }
        "tileReflect" => {
            name = "tileReflect";
            vec![px_int(g("ef-tile", 24.0)).max(4.0)]
        }
        "wave" => {
            name = "wave";
            vec![g("ef-wave-a", 12.0), g("ef-wave-f", 14.0)]
        }
        "chromatic" => {
            // fx_distort::chromatic : [décalage, forme, angle, centre x %, centre y %, zone nette %,
            // canaux, sens inversé, progression, chevauchement %]
            name = "chromatic";
            let sel = |id: &str, d: f32| v.s(id).parse::<f32>().unwrap_or(d);
            vec![
                g("ef-chr", 6.0).max(0.0),
                sel("ef-chr-shape", 3.0),
                g("ef-chr-angle", 0.0),
                g("ef-chr-cx", 0.0),
                g("ef-chr-cy", 0.0),
                g("ef-chr-inner", 20.0),
                sel("ef-chr-pair", 0.0),
                v.b("ef-chr-inv", false),
                sel("ef-chr-falloff", 1.0),
                g("ef-chr-overlap", 0.0),
            ]
        }
        "crystallize" => {
            name = "crystallize";
            vec![px_int(g("ef-cry", 12.0)).max(2.0), g("ef-cry-seed", (seed & 0xffff) as f32)]
        }
        "pixelate" => {
            name = "pixelate";
            vec![px_int(g("ef-size", 10.0))]
        }
        "frosted" => {
            name = "frosted";
            vec![g("ef-frost", 8.0), g("ef-frost-q", 2.0), (seed & 0xffff) as f32]
        }
        "dents" => {
            name = "dents";
            vec![g("ef-dent-scale", 25.0), g("ef-dent-refr", 50.0), g("ef-dent-rough", 10.0), g("ef-dent-tension", 10.0), g("ef-dent-seed", 0.0)]
        }
        "projection3d" => {
            name = "projection3d";
            vec![
                g("ef-3d-rx", 0.0),
                g("ef-3d-ry", 0.0),
                g("ef-3d-f", 280.0).round().clamp(80.0, 800.0),
                g("ef-3d-z", 100.0),
                g("ef-3d-tl", 0.0),
                g("ef-3d-tr", 0.0),
                g("ef-3d-br", 0.0),
                g("ef-3d-bl", 0.0),
            ]
        }
        "rotatezoom" => {
            name = "rotatezoom";
            vec![g("ef-rz-angle", 0.0), g("ef-rz-panx", 0.0) / 100.0, g("ef-rz-pany", 0.0) / 100.0, g("ef-rz-zoom", 100.0) / 100.0, v.b("ef-rz-tile", false)]
        }
        "straighten" => {
            name = "straighten";
            vec![g("ef-str-angle", 0.0)]
        }
        "edges" => {
            name = "edges";
            vec![g("ef-edge", 40.0)]
        }
        "emboss" => {
            name = "emboss";
            vec![g("ef-emb-angle", 0.0)]
        }
        "relief" => {
            name = "relief";
            vec![g("ef-relief-angle", 45.0)]
        }
        "outline" => {
            name = "outline";
            vec![px_rad(g("ef-ol-thick", 3.0)).max(1.0), g("ef-ol-int", 50.0)]
        }
        "morphology" => {
            name = "morphology";
            vec![g("ef-mo-mode", 0.0), px_rad(g("ef-mo-r", 3.0)).max(1.0), g("ef-mo-shape", 0.0)]
        }
        "oil" => {
            name = "oil";
            vec![px_int(g("ef-oil", 4.0)), g("ef-oil-coarse", 50.0)]
        }
        "sketch" => {
            name = "sketch";
            vec![g("ef-ink", 50.0), g("ef-ink-color", 50.0)]
        }
        "pencilsketch" => {
            name = "pencilsketch";
            vec![or1(px_rad(g("ef-pencil-tip", 2.0))), g("ef-pencil-range", 0.0)]
        }
        "sharpen" => {
            name = "sharpen";
            vec![g("ef-sharp", 45.0), px_rad(g("ef-sharp-r", 1.0)).max(1.0)]
        }
        "unsharp" => {
            name = "unsharp";
            vec![g("ef-us-amount", 80.0), px_rad(g("ef-us-radius", 3.0)).max(1.0), g("ef-us-threshold", 0.0)]
        }
        "softglow" => {
            name = "softglow";
            vec![px_rad(g("ef-glow-r", 6.0)).max(1.0), g("ef-glow-a", 40.0)]
        }
        "softenportrait" => {
            name = "softenportrait";
            vec![g("ef-soft-softness", 5.0), g("ef-soft-lighting", 0.0), g("ef-soft-warmth", 10.0)]
        }
        "vignette" => {
            name = "vignette";
            vec![g("ef-vig", 50.0), v.hex("ef-vig-color", 0), g("ef-vig-blend", 0.0), g("ef-vig-cx", 0.0), g("ef-vig-cy", 0.0)]
        }
        "redeyeremove" => {
            name = "redeyeremove";
            vec![g("ef-redeye-tol", 70.0), g("ef-redeye-sat", 90.0)]
        }
        "addnoise" => {
            name = "addnoise";
            vec![g("ef-noise-int", 64.0), g("ef-noise-sat", 100.0), g("ef-noise-cov", 100.0), seedf]
        }
        "digitalpattern" => {
            name = "digitalpattern";
            vec![g("ef-grain", 40.0), px_int(g("ef-grain-fine", 15.0)), 0x2b7e1516u32 as f32]
        }
        "clouds" => {
            name = "clouds";
            vec![g("ef-clouds-scale", 250.0).max(1.0), g("ef-clouds-power", 50.0), g("ef-clouds-seed", 0.0), v.hex("ef-clouds-from", 0), v.hex("ef-clouds-to", 0xffffff), g("ef-clouds-blend", 0.0)]
        }
        "turbulence" => {
            name = "turbulence";
            vec![
                g("ef-tb-scale", 200.0).max(1.0),
                g("ef-tb-oct", 6.0),
                g("ef-tb-rough", 50.0),
                g("ef-tb-seed", 0.0),
                v.hex("ef-tb-from", 0),
                v.hex("ef-tb-to", 0xffffff),
                g("ef-tb-blend", 0.0),
                g("ef-tb-noise", 0.0),
            ]
        }
        "mandelbrot" => {
            name = "mandelbrot";
            vec![g("ef-mb-factor", 1.0), g("ef-mb-angle", 0.0), g("ef-mb-quality", 2.0), g("ef-mb-zoom", 10.0), v.b("ef-mb-invert", false)]
        }
        "julia" => {
            name = "julia";
            vec![g("ef-jl-factor", 4.0), g("ef-jl-angle", 0.0), g("ef-jl-quality", 2.0), g("ef-jl-zoom", 4.0)]
        }
        "contour" => {
            name = "contour";
            let mode = match v.s("ef-contour-mode") {
                "inside" => 1.0,
                "both" => 2.0,
                _ => 0.0,
            };
            let corner = if v.s("ef-contour-corner") == "square" { 1.0 } else { 0.0 };
            vec![px_int(g("ef-contour-width", 3.0)), v.hex("ef-contour-color", 0xff0000), g("ef-contour-opacity", 100.0), mode, corner]
        }
        "dropshadow" => {
            name = "dropshadow";
            vec![g("ef-ds-ox", 4.0).round(), g("ef-ds-oy", 6.0).round(), px_rad(g("ef-ds-blur", 10.0)), g("ef-ds-op", 45.0), v.hex("ef-ds-color", 0)]
        }
        "dream" => {
            name = "dream";
            vec![g("ef-dream-r", 10.0), v.b("ef-dream-vig", true)]
        }
        "removedust" => {
            name = "removedust";
            vec![g("ef-dust-mode", 0.0)]
        }
        "gridcheck" => {
            name = "gridcheck";
            vec![
                g("ef-gc-mode", 0.0),
                g("ef-gc-size", 33.0).round().max(1.0),
                g("ef-gc-width", 1.0).round().max(1.0),
                v.hex("ef-gc-color", 0),
                g("ef-gc-bg", 0.0),
                v.hex("ef-gc-color2", 0xffffff),
                v.b("ef-gc-swap", false),
            ]
        }
        "fadeedge" => {
            name = "fadeedge";
            vec![g("ef-fe-shape", 0.0), g("ef-fe-width", 20.0).round(), g("ef-fe-power", 1.0)]
        }
        "coloraccent" => {
            name = "coloraccent";
            vec![v.hex("ef-ca-color", 0xff0000), g("ef-ca-tol", 10.0)]
        }
        "transparency" => {
            name = "transparency";
            vec![g("ef-tr-adj", 0.0), v.b("ef-tr-ignore", false), v.b("ef-tr-replace", false), secondary as f32]
        }
        "featherobj" => {
            name = "featherobj";
            vec![g("ef-fo-r", 1.0).round()]
        }
        "pastel" => {
            name = "pastel";
            vec![g("ef-pa-brush", 3.0), g("ef-pa-coarse", 50.0), g("ef-pa-pencil", 50.0), or1(px_rad(g("ef-pa-tip", 2.0)))]
        }
        "chroma" => {
            name = "chroma";
            let c = |id: &str| g(id, 0.0).clamp(0.0, 255.0);
            let nz = |x: f32, d: f32| if x == 0.0 { d } else { x };
            let use2 = v.b("ef-ch-use2", false) > 0.0 && v.0.contains_key("ef-ch-r2");
            vec![
                c("ef-ch-r"),
                c("ef-ch-g"),
                c("ef-ch-b"),
                nz(g("ef-ch-tol", 0.0), 30.0),
                nz(g("ef-ch-drift", 0.0), 50.0),
                nz(g("ef-ch-feather", 0.0), 15.0),
                g("ef-ch-black", 0.0),
                nz(g("ef-ch-white", 0.0), 100.0),
                nz(g("ef-ch-gamma", 0.0), 1.0).max(0.1),
                g("ef-ch-spill", 0.0),
                g("ef-ch-recover", 0.0),
                g("ef-ch-luma", 0.0),
                use2 as u8 as f32,
                if use2 { c("ef-ch-r2") } else { 0.0 },
                if use2 { c("ef-ch-g2") } else { 0.0 },
                if use2 { c("ef-ch-b2") } else { 0.0 },
                0.0,
            ]
        }
        "halftone" => {
            // illuHalftoneOptsFromVals → ordre de fx_halftone.rs
            name = "halftone";
            let mode = match v.s("ef-half-mode") {
                "color" => 1.0,
                "cmyk" => 2.0,
                _ => 0.0,
            };
            vec![
                mode,
                (g("ef-half-rad", 4.0) * 1.5).round().max(2.0),
                g("ef-half-angle", 45.0),
                (v.s("ef-half-paper") != "transparent") as u8 as f32,
                (v.s("ef-half-k") != "0") as u8 as f32,
                (v.s("ef-half-invert") == "1") as u8 as f32,
                g("ef-half-dc", 100.0) / 100.0,
                g("ef-half-dm", 100.0) / 100.0,
                g("ef-half-dy", 100.0) / 100.0,
                g("ef-half-dk", 100.0) / 100.0,
                g("ef-half-gain", 0.0) / 100.0,
            ]
        }
        "vhs" => {
            name = "vhs";
            let mut p: Vec<f32> = VHS_ORDER
                .iter()
                .map(|k| {
                    let id = format!("ef-vhs-{k}");
                    if *k == "tear_color" {
                        return match v.s(&id) {
                            "cyan" => 0.0,
                            "magenta" => 1.0,
                            "red" => 2.0,
                            "green" => 3.0,
                            _ => 4.0,
                        };
                    }
                    g(&id, 0.0)
                })
                .collect();
            p.push(0.0); // instant de l'effet
            p.push(seed.max(1) as f32);
            p
        }
        "levels" => {
            name = "levels";
            vec![g("ef-lv-ib", 0.0), g("ef-lv-iw", 255.0), g("ef-lv-g", 1.0), g("ef-lv-ob", 0.0), g("ef-lv-ow", 255.0)]
        }
        "gallery" => match v.s("ef-gallery") {
            "autolevel" | "invert" => {
                name = static_name(v.s("ef-gallery"))?;
                vec![]
            }
            "none" | "" => {
                // aucun look : image d'origine (Camera Raw neutre)
                name = "cameraraw";
                let mut p = vec![0.0f32; 58];
                p[24] = 50.0;
                p[28] = 1.0;
                p
            }
            "grayscale" | "sepia" => {
                name = "cameraraw";
                let mut p = vec![0.0f32; 58];
                if v.s("ef-gallery") == "grayscale" {
                    p[19] = -100.0;
                } else {
                    (p[19], p[1], p[2]) = (-50.0, 40.0, 10.0);
                }
                p[24] = 50.0;
                p[28] = 1.0;
                p
            }
            id => {
                name = "cameraraw";
                crate::gallery_gen::PRESETS.iter().find(|p| p.0 == id)?.2.to_vec()
            }
        },
        "cameraraw" => {
            // ordre de fx_camraw.rs (58 valeurs, courbes et TSL vides)
            name = "cameraraw";
            let mut p = vec![0.0f32; 58];
            for (i, id) in [
                (0, "cr-exposure"), (1, "cr-temp"), (2, "cr-tint"), (3, "cr-shadows"), (4, "cr-blacks"), (5, "cr-highlights"), (6, "cr-whites"),
                (16, "cr-clarity"), (17, "cr-dehaze"), (18, "cr-contrast"), (19, "cr-saturation"), (20, "cr-vibrance"), (21, "cr-sharpen"),
                (22, "cr-vignette"), (23, "cr-grain"),
            ] {
                p[i] = g(id, 0.0);
            }
            p[24] = 50.0; // finesse du grain
            p[28] = 1.0; // graine du grain
            p
        }
        _ => return None,
    };
    Some((name, p))
}

/// Option « Aberration chromatique » des fenêtres de flou : appliquée après l'effet.
/// Aperçu réduit (grande image vue de loin, pas 1/k) : les réglages exprimés en pixels (rayon,
/// taille, distance, décalage…) sont ramenés à l'échelle `k` pour ressembler au résultat en
/// pleine résolution (comme `_effectPreviewPxScale` de la version web).
pub fn scale_px(fields: &[Field], v: &Vals, k: f32) -> Vals {
    // centre des flous radial / zoom : « Décalage X/Y » en % de l'image, pas en pixels
    const PERCENT: [&str; 4] = ["ef-rblur-ox", "ef-rblur-oy", "ef-zblur-ox", "ef-zblur-oy"];
    let mut out = v.clone();
    for f in fields.iter().filter(|f| f.kind == 0 && in_pixels(f.label) && !PERCENT.contains(&f.id)) {
        if let Some(x) = v.0.get(f.id).and_then(|s| s.replace(',', ".").trim().parse::<f32>().ok()) {
            out.0.insert(f.id.to_string(), fmt_num((x * k).clamp(f.min.min(f.max), f.max.max(f.min))));
        }
    }
    // intensité de l'aberration (pixels, libellé « Intensité ») : sans borne basse pour rester
    // proportionnelle à l'aperçu réduit
    if let Some(x) = v.0.get("ef-ca-amt").and_then(|s| s.replace(',', ".").trim().parse::<f32>().ok()) {
        out.0.insert("ef-ca-amt".to_string(), fmt_num(x * k));
    }
    out
}

/// Libellé d'un réglage en pixels.
fn in_pixels(label: &str) -> bool {
    let l = label.to_lowercase();
    !l.contains('%') && (l.contains("(px)") || ["rayon", "taille", "distance", "épaisseur", "décalage", "longueur", "largeur"].iter().any(|k| l.starts_with(k)))
}

/// Option « Aberration chromatique » d'un effet : paramètres de masterpaint_core::chromatic_post
/// ([intensité, mode, angle, centre x %, centre y %, zone nette %, canaux, sens inversé]).
/// Pas de flou → pas d'aberration : les flous radial / zoom suivent leur propre progression
/// depuis leur centre (même zone nette) ; les effets à centre (bosse, torsion…) décalent en
/// rayon selon leur force locale ; les autres selon leur force locale, dans leur direction.
pub fn post_chromatic(effect: &str, v: &Vals) -> Option<Vec<f32>> {
    if v.b("ef-ca", false) <= 0.0 {
        return None;
    }
    let amt = v.g("ef-ca-amt", 8.0).max(0.0);
    let pair = v.s("ef-ca-pair").parse::<f32>().unwrap_or(0.0);
    let inv = v.b("ef-ca-inv", false);
    let g = |id: &str| v.g(id, 0.0);
    let (mode, angle, ox, oy, inner) = match effect {
        "radialblur" => (1.0, 0.0, g("ef-rblur-ox"), g("ef-rblur-oy"), g("ef-rblur-inner")),
        "zoomblur" => (1.0, 0.0, g("ef-zblur-ox"), g("ef-zblur-oy"), g("ef-zblur-inner")),
        "bulge" | "pinch" | "twist" | "dents" | "polarInvert" => (2.0, 0.0, 0.0, 0.0, 0.0),
        "motionblur" => (0.0, v.g("ef-mblur-angle", 25.0), 0.0, 0.0, 0.0),
        _ => (0.0, 0.0, 0.0, 0.0, 0.0),
    };
    Some(vec![amt, mode, angle, ox, oy, inner, pair, inv])
}

fn static_name(e: &str) -> Option<&'static str> {
    masterpaint_core::EFFECTS.iter().copied().find(|n| *n == e)
}
