//! Espace de couleur d'un projet (Fichier › Espace de couleur, comme la version web) :
//! Bitmap (RVB libre), CMJN (simulation des encres d'imprimerie, EditorManager.applyCmjnFilter),
//! RAL (nuancier RAL Classic, couleurs limitées) et Tramé N&B (masqué dans les menus, lu dans
//! les fichiers .illu).
//!
//! Hors du mode Bitmap, chaque couleur passe par le filtre du mode : couleurs principale et
//! secondaire, roue et nuancier, résultat des effets, images collées ou importées.

use crate::ral_gen::RAL;

#[derive(Clone, Copy, PartialEq, Eq, Debug, Default)]
pub enum ColorMode {
    #[default]
    Rgb,
    Cmjn,
    Ral,
    Dither,
}

impl ColorMode {
    /// Valeur `mode` d'un projet .illu.
    pub fn from_illu(s: &str) -> ColorMode {
        match s {
            "pixel-cmjn" => ColorMode::Cmjn,
            "pixel-ral" => ColorMode::Ral,
            "pixel-dither" => ColorMode::Dither,
            _ => ColorMode::Rgb,
        }
    }

    pub fn illu(self) -> &'static str {
        match self {
            ColorMode::Rgb => "pixel",
            ColorMode::Cmjn => "pixel-cmjn",
            ColorMode::Ral => "pixel-ral",
            ColorMode::Dither => "pixel-dither",
        }
    }

    /// Index de l'interface (MenuState.color-mode, liste « Nouvelle image »).
    pub fn index(self) -> i32 {
        self as i32
    }

    pub fn from_index(i: i32) -> ColorMode {
        match i {
            1 => ColorMode::Cmjn,
            2 => ColorMode::Ral,
            3 => ColorMode::Dither,
            _ => ColorMode::Rgb,
        }
    }

    /// Libellé de la barre d'état (« Mode : … »), comme la version web.
    pub fn status(self) -> &'static str {
        match self {
            ColorMode::Rgb => "Pixel",
            ColorMode::Cmjn => "Pixel (CMJN)",
            ColorMode::Ral => "Pixel (RAL)",
            ColorMode::Dither => "Pixel (Tramé)",
        }
    }

    /// Suffixe du titre d'un nouveau projet (« Sans titre 2 (RAL) »).
    pub fn suffix(self) -> &'static str {
        match self {
            ColorMode::Rgb => "",
            ColorMode::Cmjn => " (CMJN)",
            ColorMode::Ral => " (RAL)",
            ColorMode::Dither => " (N&B)",
        }
    }

    /// Libellé de l'étape d'historique de la conversion.
    pub fn history_label(self) -> &'static str {
        match self {
            ColorMode::Rgb => "Conversion en Bitmap",
            ColorMode::Cmjn => "Conversion en CMJN",
            ColorMode::Ral => "Conversion en Couleurs RAL",
            ColorMode::Dither => "Conversion en Tramé N&B",
        }
    }

    /// Conversion d'une couleur vers l'espace du projet, comme la version web : nuancier le
    /// plus proche (RAL, N&B) ou rendu avec les encres d'imprimerie (CMJN). Sert à la
    /// conversion du projet et à l'affichage de la roue et du nuancier.
    #[inline]
    pub fn convert(self, c: [u8; 3]) -> [u8; 3] {
        match self {
            ColorMode::Rgb => c,
            ColorMode::Cmjn => cmjn_filter(c),
            ColorMode::Ral => RAL_PALETTE[ral_index(c)],
            ColorMode::Dither => {
                let l = 0.299 * c[0] as f32 + 0.587 * c[1] as f32 + 0.114 * c[2] as f32;
                if l >= 128.0 { [255; 3] } else { [0; 3] }
            }
        }
    }

    /// Couleur ramenée dans l'espace du projet sans dériver : une couleur déjà valable est
    /// gardée telle quelle (m(m(c)) = m(c)). Le rendu CMJN de la version web n'a pas cette
    /// propriété (l'appliquer deux fois éclaircit encore les gris) : une couleur imprimable
    /// n'y repasse donc pas. Sert aux couleurs choisies, aux effets et aux collages.
    #[inline]
    pub fn map(self, c: [u8; 3]) -> [u8; 3] {
        match self {
            ColorMode::Cmjn if printable(c) => c,
            _ => self.convert(c),
        }
    }

    /// Pixels RGBA ramenés dans l'espace du projet (`map`). Comme la version web, les pixels
    /// presque transparents (alpha < 128) ne sont pas touchés et l'alpha est conservé.
    pub fn constrain(self, px: &mut [u8]) {
        self.process(px, false);
    }

    /// Conversion d'un calque entier vers l'espace du projet (`convert`).
    pub fn convert_px(self, px: &mut [u8]) {
        self.process(px, true);
    }

    fn process(self, px: &mut [u8], convert: bool) {
        if self == ColorMode::Rgb {
            return;
        }
        let run = |rows: &mut [u8]| {
            // cache à correspondance directe : les images ont beaucoup de couleurs répétées
            let mut cache = vec![(u32::MAX, [0u8; 3]); 4096];
            for p in rows.chunks_exact_mut(4) {
                if p[3] < 128 {
                    continue;
                }
                let key = (p[0] as u32) << 16 | (p[1] as u32) << 8 | p[2] as u32;
                let slot = &mut cache[((key ^ (key >> 12)) & 4095) as usize];
                let c = if slot.0 == key {
                    slot.1
                } else {
                    let q = [p[0], p[1], p[2]];
                    let c = if convert { self.convert(q) } else { self.map(q) };
                    *slot = (key, c);
                    c
                };
                p[..3].copy_from_slice(&c);
            }
        };
        #[cfg(not(target_arch = "wasm32"))]
        {
            let n = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1).min(16);
            let chunk = (px.len() / 4).div_ceil(n).max(16384) * 4;
            if n > 1 && px.len() > chunk {
                std::thread::scope(|s| {
                    for part in px.chunks_mut(chunk) {
                        s.spawn(move || run(part));
                    }
                });
                return;
            }
        }
        run(px);
    }

    /// Nom de la couleur dans l'espace du projet : code et nom RAL, pourcentages CMJN.
    pub fn describe(self, c: [u8; 3]) -> String {
        match self {
            ColorMode::Ral => {
                let r = &RAL[ral_index(c)];
                format!("{} · {}", r.0, r.4)
            }
            ColorMode::Cmjn => {
                let [cc, m, y, k] = cmyk_percent(c);
                format!("C {cc} %  M {m} %  J {y} %  N {k} %")
            }
            _ => String::new(),
        }
    }
}

/// Couleurs du nuancier RAL (r, v, b), même ordre que `ral_gen::RAL`.
static RAL_PALETTE: [[u8; 3]; 216] = {
    let mut out = [[0u8; 3]; 216];
    let mut i = 0;
    while i < 216 && i < RAL.len() {
        out[i] = [RAL[i].1, RAL[i].2, RAL[i].3];
        i += 1;
    }
    out
};

/// Teinte RAL la plus proche (distance pondérée 2 / 4 / 3 de la version web).
pub fn ral_index(c: [u8; 3]) -> usize {
    let (r, g, b) = (c[0] as i32, c[1] as i32, c[2] as i32);
    let mut best = 0;
    let mut best_d = i32::MAX;
    for (i, p) in RAL_PALETTE.iter().enumerate().take(RAL.len()) {
        let (dr, dg, db) = (r - p[0] as i32, g - p[1] as i32, b - p[2] as i32);
        let d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
        if d < best_d {
            best_d = d;
            best = i;
        }
    }
    best
}

/// Séparation CMJN naïve (C, M, J, N en %) d'une couleur écran.
pub fn cmyk_percent(c: [u8; 3]) -> [u8; 4] {
    let (r, g, b) = (c[0] as f32 / 255.0, c[1] as f32 / 255.0, c[2] as f32 / 255.0);
    let k = 1.0 - r.max(g).max(b);
    let (cc, m, y) = if k < 1.0 { ((1.0 - r - k) / (1.0 - k), (1.0 - g - k) / (1.0 - k), (1.0 - b - k) / (1.0 - k)) } else { (0.0, 0.0, 0.0) };
    [cc, m, y, k].map(|v| (v * 100.0).round().clamp(0.0, 100.0) as u8)
}

// couleurs réelles des encres d'imprimerie (EditorManager.applyCmjnFilter)
const IC: [f32; 3] = [0.0, 0.6, 0.86];
const IM: [f32; 3] = [0.88, 0.0, 0.47];
const IY: [f32; 3] = [1.0, 0.94, 0.0];
const IK: [f32; 3] = [0.1, 0.1, 0.1];

/// Couleur imprimée par les quantités d'encre c, m, j, n (0..1) : synthèse soustractive.
#[inline]
fn inks(c: f32, m: f32, y: f32, k: f32) -> [f32; 3] {
    [0, 1, 2].map(|i| (1.0 - c * (1.0 - IC[i])) * (1.0 - m * (1.0 - IM[i])) * (1.0 - y * (1.0 - IY[i])) * (1.0 - k * (1.0 - IK[i])))
}

/// Rendu d'une couleur imprimée avec de vraies encres (EditorManager.applyCmjnFilter) :
/// séparation naïve (le noir prend tout le gris), puis les encres cyan, magenta, jaune et
/// noire se superposent en synthèse soustractive.
pub fn cmjn_filter(col: [u8; 3]) -> [u8; 3] {
    let (r, g, b) = (col[0] as f32 / 255.0, col[1] as f32 / 255.0, col[2] as f32 / 255.0);
    let k = 1.0 - r.max(g).max(b);
    let (c, m, y) = if k < 1.0 { ((1.0 - r - k) / (1.0 - k), (1.0 - g - k) / (1.0 - k), (1.0 - b - k) / (1.0 - k)) } else { (0.0, 0.0, 0.0) };
    inks(c, m, y, k).map(|v| (v * 255.0).round().clamp(0.0, 255.0) as u8)
}

/// Couleur que `cmjn_filter` peut produire : il existe des quantités d'encre (dont une des
/// trois encres colorées à zéro, comme la séparation naïve) qui l'impriment à un niveau près.
/// Résolution par point fixe, encre par encre (les couplages entre encres sont faibles).
pub fn printable(col: [u8; 3]) -> bool {
    let t = col.map(|v| v as f32 / 255.0);
    // cas le plus probable d'abord : l'encre nulle est celle du canal le plus clair
    let first = if t[0] >= t[1] && t[0] >= t[2] { 0 } else if t[1] >= t[2] { 1 } else { 2 };
    [first, (first + 1) % 3, (first + 2) % 3].into_iter().any(|zero| solve_inks(t, zero))
}

fn solve_inks(t: [f32; 3], zero: usize) -> bool {
    // inconnues : les deux encres colorées non nulles et kk = 1 - 0,9 n (part laissée par le noir)
    let (mut a, mut b, mut kk) = (0.0f32, 0.0f32, 1.0f32);
    // 2e passe : noir hors bornes (cible arrondie à l'octet) → noir fixé à sa borne, les deux
    // encres colorées résolues sur leurs canaux, le troisième canal vérifié ensuite
    let mut fixed: Option<f32> = None;
    for pass in 0..2 {
        for _ in 0..16 {
            match zero {
                // pas de cyan : R ne dépend (presque) que du noir
                0 => {
                    kk = fixed.unwrap_or((t[0] / (1.0 - 0.12 * a)).max(0.01));
                    a = 1.0 - t[1] / ((1.0 - 0.06 * b) * kk);
                    b = 1.0 - t[2] / ((1.0 - 0.53 * a) * kk);
                }
                // pas de magenta : V ne dépend que du cyan, du jaune et du noir
                1 => {
                    kk = fixed.unwrap_or((t[1] / ((1.0 - 0.4 * a) * (1.0 - 0.06 * b))).max(0.01));
                    a = 1.0 - t[0] / kk;
                    b = 1.0 - t[2] / ((1.0 - 0.14 * a) * kk);
                }
                // pas de jaune : B ne dépend que du cyan, du magenta et du noir
                _ => {
                    kk = fixed.unwrap_or((t[2] / ((1.0 - 0.14 * a) * (1.0 - 0.53 * b))).max(0.01));
                    a = 1.0 - t[0] / ((1.0 - 0.12 * b) * kk);
                    b = 1.0 - t[1] / ((1.0 - 0.4 * a) * kk);
                }
            }
            if !(a.is_finite() && b.is_finite()) {
                return false;
            }
        }
        if pass == 0 && !(0.1..=1.0).contains(&kk) {
            fixed = Some(kk.clamp(0.1, 1.0));
            continue;
        }
        break;
    }
    // tolérance : la cible est arrondie à l'octet, la solution exacte peut sortir à peine des bornes
    const E: f32 = 0.03;
    let k = (1.0 - kk) / 0.9;
    if !(-E..=1.0 + E).contains(&a) || !(-E..=1.0 + E).contains(&b) || !(-E..=1.0 + E).contains(&k) {
        return false;
    }
    let (a, b, k) = (a.clamp(0.0, 1.0), b.clamp(0.0, 1.0), k.clamp(0.0, 1.0));
    let out = match zero {
        0 => inks(0.0, a, b, k),
        1 => inks(a, 0.0, b, k),
        _ => inks(a, b, 0.0, k),
    };
    (0..3).all(|i| ((out[i] - t[i]) * 255.0).abs() <= 1.5)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ral_snaps_to_palette() {
        let c = ColorMode::Ral.map([250, 170, 2]);
        assert_eq!(c, [249, 169, 0]); // RAL 1003
        assert!(ColorMode::Ral.describe(c).starts_with("RAL 1003"));
    }

    #[test]
    fn cmjn_filter_matches_web() {
        assert_eq!(cmjn_filter([255, 255, 255]), [255, 255, 255]);
        assert_eq!(cmjn_filter([0, 0, 0]), [26, 26, 26]);
        assert_eq!(cmjn_filter([255, 0, 0]), [224, 0, 0]);
        assert_eq!(cmjn_filter([128, 128, 128]), [141, 141, 141]);
    }

    #[test]
    fn cmjn_map_is_idempotent() {
        // toute sortie du rendu CMJN est imprimable : la projection ne dérive pas
        let mut n = 0;
        for r in (0..=255).step_by(5) {
            for g in (0..=255).step_by(5) {
                for b in (0..=255).step_by(5) {
                    let once = ColorMode::Cmjn.convert([r as u8, g as u8, b as u8]);
                    assert!(printable(once), "{once:?} devrait être imprimable");
                    assert_eq!(ColorMode::Cmjn.map(once), once);
                    n += 1;
                }
            }
        }
        assert_eq!(n, 52 * 52 * 52);
        // couleur hors gamut (bleu pur) : ramenée au rendu imprimé
        assert!(!printable([0, 0, 255]));
        assert_eq!(ColorMode::Cmjn.map([0, 0, 255]), cmjn_filter([0, 0, 255]));
    }

    #[test]
    fn constrain_keeps_alpha_and_transparent() {
        let mut px = vec![10, 200, 30, 255, 1, 2, 3, 0];
        ColorMode::Ral.constrain(&mut px);
        assert_eq!(px[3], 255);
        assert_eq!(&px[4..], &[1, 2, 3, 0]);
        let c = [px[0], px[1], px[2]];
        assert!(RAL_PALETTE.contains(&c));
    }
}
