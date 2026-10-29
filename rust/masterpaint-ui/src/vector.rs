//! Calques vectoriels (début du mode SVG) : le calque garde la description de ses objets (un
//! texte pour l'instant ; formes et chemins viendront dans `Obj`) et ses pixels n'en sont que
//! le rendu. Les effets du menu posés sur un tel calque ne le modifient pas : ils forment une
//! pile rejouée sur le rendu des objets, comme les filtres dynamiques ƒ (mode « ce calque »).

use crate::text::{self, Align, Fonts};

/// Texte modifiable : coin haut-gauche (x, y) en pixels du document.
#[derive(Clone, Debug, PartialEq)]
pub struct TextObj {
    pub text: String,
    /// nom de la police (stable d'une version à l'autre ; l'indice est retrouvé au rendu)
    pub font: String,
    pub size: f32,
    pub color: [u8; 4],
    /// 0 gauche, 1 centre, 2 droite
    pub align: i32,
    pub antialias: bool,
    pub x: f32,
    pub y: f32,
}

impl TextObj {
    fn align(&self) -> Align {
        match self.align {
            1 => Align::Center,
            2 => Align::Right,
            _ => Align::Left,
        }
    }
}

/// Objet d'un calque vectoriel.
#[derive(Clone, Debug, PartialEq)]
pub enum Obj {
    Text(TextObj),
}

/// Effet du menu posé sur un calque vectoriel (mêmes valeurs que « Répéter »).
#[derive(Clone, Debug, PartialEq)]
pub struct Fx {
    /// nom de l'effet dans le moteur (masterpaint-core)
    pub name: String,
    /// titre affiché (liste des effets du calque)
    pub label: String,
    pub p: Vec<f32>,
    /// aberration chromatique ajoutée par la fenêtre de l'effet
    pub post: Option<Vec<f32>>,
    pub on: bool,
}

/// Contenu d'un calque vectoriel.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct VectorLayer {
    pub objects: Vec<Obj>,
    pub effects: Vec<Fx>,
    /// numéro du dernier rendu demandé (un résultat d'effets plus ancien est ignoré)
    pub serial: u64,
}

impl VectorLayer {
    pub fn with_text(t: TextObj) -> Self {
        VectorLayer { objects: vec![Obj::Text(t)], effects: Vec::new(), serial: 0 }
    }

    /// Texte de l'objet `i` (un calque texte peut en porter plusieurs).
    pub fn text_at(&self, i: usize) -> Option<&TextObj> {
        self.objects.get(i).map(|o| match o {
            Obj::Text(t) => t,
        })
    }

    pub fn text_at_mut(&mut self, i: usize) -> Option<&mut TextObj> {
        self.objects.get_mut(i).map(|o| match o {
            Obj::Text(t) => t,
        })
    }

    /// Déplace le seul objet `i`.
    pub fn translate_obj(&mut self, i: usize, dx: f32, dy: f32) {
        if let Some(t) = self.text_at_mut(i) {
            t.x += dx;
            t.y += dy;
        }
    }

    /// Cadre de l'objet `i` (x0, y0, x1, y1) en pixels du document.
    pub fn obj_frame(&self, fonts: &mut Fonts, i: usize) -> Option<(f32, f32, f32, f32)> {
        let t = self.text_at(i)?;
        let font = font_for(fonts, &t.font)?;
        Some(text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias).frame)
    }

    /// Objet sous le point (x, y), le plus haut d'abord (le dernier posé est dessiné par-dessus).
    pub fn hit_index(&self, fonts: &mut Fonts, x: f32, y: f32) -> Option<usize> {
        (0..self.objects.len())
            .rev()
            .find(|&i| self.obj_frame(fonts, i).is_some_and(|(x0, y0, x1, y1)| x >= x0 - 4.0 && y >= y0 - 4.0 && x <= x1 + 4.0 && y <= y1 + 4.0))
    }

    /// Dessine l'objet `i` dans `out` depuis `base` (rendu sans cet objet), dans son seul cadre.
    /// Retourne le rectangle touché (pixels du document).
    pub fn draw_obj(&self, fonts: &mut Fonts, i: usize, base: &[u8], out: &mut [u8], w: usize, h: usize) -> Option<(usize, usize, usize, usize)> {
        let t = self.text_at(i)?;
        let font = font_for(fonts, &t.font)?;
        let r = text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias);
        text::apply_raster(Some(base), out, w, h, &r, t.color, None)
    }

    /// Rendu des objets sans effets, l'objet `skip` excepté (fond de la saisie de cet objet).
    pub fn render_others(&self, fonts: &mut Fonts, w: usize, h: usize, skip: usize) -> Vec<u8> {
        let mut px = vec![0u8; w * h * 4];
        for (i, o) in self.objects.iter().enumerate() {
            if i == skip {
                continue;
            }
            let Obj::Text(t) = o;
            let Some(font) = font_for(fonts, &t.font) else { continue };
            let r = text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias);
            text::apply_raster_over(&mut px, w, h, &r, t.color);
        }
        px
    }

    pub fn has_effects(&self) -> bool {
        self.effects.iter().any(|f| f.on)
    }

    /// Rendu des objets seuls (sans les effets) sur une toile transparente w × h.
    pub fn render_objects(&self, fonts: &mut Fonts, w: usize, h: usize) -> Vec<u8> {
        let mut px = vec![0u8; w * h * 4];
        for o in &self.objects {
            let Obj::Text(t) = o;
            let Some(font) = font_for(fonts, &t.font) else { continue };
            let r = text::raster(&font, &t.text, t.size, t.x, t.y, t.align(), t.antialias);
            text::apply_raster_over(&mut px, w, h, &r, t.color);
        }
        px
    }
}

/// Police d'un objet (police de secours : la première de la liste).
fn font_for(fonts: &mut Fonts, name: &str) -> Option<std::rc::Rc<ab_glyph::FontVec>> {
    fonts.index_of(name).and_then(|i| fonts.get(i)).or_else(|| fonts.get(0))
}

/// Effets que la pile d'un calque vectoriel n'accepte pas : ils ont besoin de pixels peints
/// (détourage, remplissage de contenu, retouches) ou changent la taille de l'image.
pub fn effect_allowed(name: &str) -> bool {
    !matches!(
        name,
        "contentfill" | "content_fill" | "removebg" | "cutout" | "cutoutsel" | "selection_cutout" | "splitrgb"
            // incrustation (couleur → transparence), retouches ponctuelles, rendus qui remplacent
            // le contenu du calque, conversions de palette
            | "chroma" | "redeyeremove" | "clouds" | "julia" | "mandelbrot" | "cameraraw" | "ascii"
    )
}

/// Entrée de menu (action « fx:<effet> » ou appel de la version web) indisponible sur un calque
/// texte : grisée dans les menus avec « Pixelliser le calque pour utiliser cet effet ».
/// Les effets du menu passent par leur nom de moteur (`effect_allowed`), ombre, VHS, flous,
/// déformations, aberration et réglages de couleur restent autorisés.
pub fn action_allowed(action: &str) -> bool {
    if let Some(fx) = action.strip_prefix("fx:") {
        let v = crate::effects::dialog(fx).map(|(_, f)| crate::effects::Vals::defaults(f)).unwrap_or_default();
        let name = crate::effects::params(fx, &v, 0xffffff, 1).map(|(n, _)| n).unwrap_or(fx);
        return effect_allowed(fx) && effect_allowed(name);
    }
    ![
        "splitActiveLayerRgbChannels", "illuGuidedCutoutToolStart", "illuRemoveBackgroundIntelligent",
        "showContentAwareFillDialog", "openCameraRawForActiveLayer", "illuMenuVectorizeBitmap",
        "clearSelectionContent", "ctxCut", "openLevelsForActiveLayer", "openCurvesForActiveLayer",
        "cutoutsel", "contentfill", "splitrgb",
    ]
    .iter()
    .any(|k| action.contains(k))
}

// ------------------------------------------------------------------ fichiers .illu

/// Objet texte en JSON (clé `textObject` d'un calque du .illu, ignorée par les anciennes
/// versions qui lisent les pixels rendus de `dataUrl`).
pub fn to_json(v: &VectorLayer) -> serde_json::Value {
    let objects: Vec<serde_json::Value> = v
        .objects
        .iter()
        .map(|o| match o {
            Obj::Text(t) => serde_json::json!({
                "type": "text",
                "text": t.text,
                "font": t.font,
                "size": t.size,
                "color": [t.color[0], t.color[1], t.color[2], t.color[3]],
                "align": t.align,
                "antialias": t.antialias,
                "x": t.x,
                "y": t.y,
            }),
        })
        .collect();
    let effects: Vec<serde_json::Value> = v
        .effects
        .iter()
        .map(|f| serde_json::json!({ "name": f.name, "label": f.label, "params": f.p, "post": f.post, "on": f.on }))
        .collect();
    serde_json::json!({ "objects": objects, "effects": effects })
}

pub fn from_json(j: &serde_json::Value) -> Option<VectorLayer> {
    let f32s = |v: &serde_json::Value| -> Vec<f32> { v.as_array().map(|a| a.iter().filter_map(|x| x.as_f64()).map(|x| x as f32).collect()).unwrap_or_default() };
    let mut out = VectorLayer::default();
    for o in j.get("objects")?.as_array()? {
        if o.get("type").and_then(|t| t.as_str()) != Some("text") {
            continue;
        }
        let c = f32s(&o["color"]);
        let color = if c.len() == 4 { [c[0] as u8, c[1] as u8, c[2] as u8, c[3] as u8] } else { [0, 0, 0, 255] };
        out.objects.push(Obj::Text(TextObj {
            text: o["text"].as_str().unwrap_or_default().to_string(),
            font: o["font"].as_str().unwrap_or_default().to_string(),
            size: o["size"].as_f64().unwrap_or(32.0) as f32,
            color,
            align: o["align"].as_i64().unwrap_or(0) as i32,
            antialias: o["antialias"].as_bool().unwrap_or(true),
            x: o["x"].as_f64().unwrap_or(0.0) as f32,
            y: o["y"].as_f64().unwrap_or(0.0) as f32,
        }));
    }
    if let Some(list) = j.get("effects").and_then(|e| e.as_array()) {
        for f in list {
            let Some(name) = f["name"].as_str() else { continue };
            out.effects.push(Fx {
                name: name.to_string(),
                label: f["label"].as_str().unwrap_or(name).to_string(),
                p: f32s(&f["params"]),
                post: f.get("post").filter(|p| p.is_array()).map(f32s),
                on: f["on"].as_bool().unwrap_or(true),
            });
        }
    }
    (!out.objects.is_empty()).then_some(out)
}
