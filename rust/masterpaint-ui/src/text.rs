//! Outil Texte : catalogue de polices et rendu du texte en couverture (comme un trait).
//!
//! Polices : Selawik (intégrée, équivalent libre de Segoe UI), les polices de MasterPaint
//! (dossier fonts/, WOFF2 décodé en Rust) et, sur le bureau, les polices du système.
//! Sur le web, les polices MasterPaint sont téléchargées à la demande depuis fonts/.

use crate::paint::Cover;
use ab_glyph::{Font, FontVec, PxScale, ScaleFont};
use std::collections::HashMap;
use std::rc::Rc;

pub enum Source {
    /// TTF/OTF ou WOFF2 intégré au programme
    Static(&'static [u8]),
    /// fichier de police du système (bureau)
    #[allow(dead_code)]
    File(std::path::PathBuf),
    /// police MasterPaint à télécharger (web) : chemin relatif à la page
    #[allow(dead_code)]
    Web(String),
}

pub struct Entry {
    pub name: String,
    pub source: Source,
}

#[derive(Default)]
pub struct Fonts {
    pub entries: Vec<Entry>,
    cache: HashMap<usize, Rc<FontVec>>,
}

/// Décode une police : TTF/OTF tel quel, WOFF2/WOFF décompressé.
pub fn decode_font(bytes: &[u8]) -> Option<FontVec> {
    let data = match bytes.get(0..4) {
        Some(b"wOF2") => wuff::decompress_woff2(bytes).ok()?,
        Some(b"wOFF") => wuff::decompress_woff1(bytes).ok()?,
        _ => bytes.to_vec(),
    };
    FontVec::try_from_vec(data).ok()
}

impl Fonts {
    pub fn new() -> Self {
        let mut f = Fonts::default();
        f.entries.push(Entry { name: "Selawik".into(), source: Source::Static(include_bytes!("../fonts/selawk.ttf")) });
        f.entries.push(Entry { name: "Selawik Semibold".into(), source: Source::Static(include_bytes!("../fonts/selawksb.ttf")) });
        f.entries.push(Entry { name: "Selawik Bold".into(), source: Source::Static(include_bytes!("../fonts/selawkb.ttf")) });
        for (name, src) in crate::fonts_gen::masterpaint_fonts() {
            f.entries.push(Entry { name: name.to_string(), source: src });
        }
        f
    }

    pub fn names(&self) -> Vec<String> {
        self.entries.iter().map(|e| e.name.clone()).collect()
    }

    /// Police prête à l'emploi (None : pas encore téléchargée ou illisible).
    pub fn get(&mut self, i: usize) -> Option<Rc<FontVec>> {
        if let Some(f) = self.cache.get(&i) {
            return Some(f.clone());
        }
        let font = match &self.entries.get(i)?.source {
            Source::Static(b) => decode_font(b)?,
            Source::File(p) => decode_font(&std::fs::read(p).ok()?)?,
            Source::Web(_) => return None,
        };
        let rc = Rc::new(font);
        self.cache.insert(i, rc.clone());
        Some(rc)
    }

    /// Police téléchargée (web) : mise en cache.
    #[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
    pub fn insert_loaded(&mut self, i: usize, bytes: &[u8]) -> bool {
        match decode_font(bytes) {
            Some(f) => {
                self.cache.insert(i, Rc::new(f));
                true
            }
            None => false,
        }
    }

    pub fn web_path(&self, i: usize) -> Option<String> {
        match &self.entries.get(i)?.source {
            Source::Web(p) => Some(p.clone()),
            _ => None,
        }
    }

    /// Ajoute les polices du système (bureau), triées par nom, sans doublon.
    #[cfg(not(target_arch = "wasm32"))]
    pub fn add_system(&mut self, list: Vec<(String, std::path::PathBuf)>) {
        let known: std::collections::HashSet<String> = self.entries.iter().map(|e| e.name.to_lowercase()).collect();
        for (name, path) in list {
            if !known.contains(&name.to_lowercase()) {
                self.entries.push(Entry { name, source: Source::File(path) });
            }
        }
    }

    pub fn index_of(&self, name: &str) -> Option<usize> {
        self.entries.iter().position(|e| e.name.eq_ignore_ascii_case(name))
    }
}

/// Polices installées (Windows, Linux, macOS) : (nom de famille, fichier). Lecture lente :
/// à appeler hors du fil de l'interface.
#[cfg(not(target_arch = "wasm32"))]
pub fn scan_system_fonts() -> Vec<(String, std::path::PathBuf)> {
    let mut dirs: Vec<std::path::PathBuf> = vec![];
    if let Ok(w) = std::env::var("WINDIR") {
        dirs.push(std::path::Path::new(&w).join("Fonts"));
    }
    if let Ok(l) = std::env::var("LOCALAPPDATA") {
        dirs.push(std::path::Path::new(&l).join("Microsoft").join("Windows").join("Fonts"));
    }
    for d in ["/usr/share/fonts", "/usr/local/share/fonts", "/Library/Fonts", "/System/Library/Fonts"] {
        dirs.push(d.into());
    }
    if let Ok(h) = std::env::var("HOME") {
        dirs.push(std::path::Path::new(&h).join(".fonts"));
        dirs.push(std::path::Path::new(&h).join(".local/share/fonts"));
    }
    let mut out: Vec<(String, std::path::PathBuf)> = vec![];
    let mut seen = std::collections::HashSet::new();
    let mut stack = dirs;
    while let Some(d) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&d) else { continue };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() {
                stack.push(p);
                continue;
            }
            let ext = p.extension().map(|x| x.to_string_lossy().to_lowercase()).unwrap_or_default();
            if ext != "ttf" && ext != "otf" {
                continue;
            }
            // les très grosses polices (CJK) ralentiraient l'analyse
            if e.metadata().map(|m| m.len() > 8_000_000).unwrap_or(true) {
                continue;
            }
            let Ok(data) = std::fs::read(&p) else { continue };
            let Ok(face) = ttf_parser::Face::parse(&data, 0) else { continue };
            // nom complet de la police (« Arial Bold »…), à défaut la famille
            let name = face
                .names()
                .into_iter()
                .filter(|n| n.is_unicode() && (n.name_id == ttf_parser::name_id::FULL_NAME || n.name_id == ttf_parser::name_id::FAMILY))
                .max_by_key(|n| (n.name_id == ttf_parser::name_id::FULL_NAME) as u8)
                .and_then(|n| n.to_string());
            if let Some(name) = name {
                if seen.insert(name.to_lowercase()) {
                    out.push((name, p));
                }
            }
        }
    }
    out.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
    out
}

/// Alignement des lignes de texte.
#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Align {
    Left,
    Center,
    Right,
}

/// Dessine `text` (plusieurs lignes) dans la couverture, coin haut-gauche (x, y), taille en px.
/// Retourne le cadre occupé (x0, y0, x1, y1).
pub fn render(font: &FontVec, text: &str, size: f32, x: f32, y: f32, align: Align, antialias: bool, cov: &mut Cover) -> (f32, f32, f32, f32) {
    let scaled = font.as_scaled(PxScale::from(size.max(1.0)));
    let line_h = scaled.height() + scaled.line_gap();
    let lines: Vec<&str> = text.split('\n').collect();
    let widths: Vec<f32> = lines
        .iter()
        .map(|l| {
            let mut w = 0.0;
            let mut prev = None;
            for c in l.chars() {
                let id = scaled.glyph_id(c);
                if let Some(p) = prev {
                    w += scaled.kern(p, id);
                }
                w += scaled.h_advance(id);
                prev = Some(id);
            }
            w
        })
        .collect();
    let max_w = widths.iter().cloned().fold(0.0, f32::max);
    for (li, line) in lines.iter().enumerate() {
        let off = match align {
            Align::Left => 0.0,
            Align::Center => (max_w - widths[li]) / 2.0,
            Align::Right => max_w - widths[li],
        };
        let mut caret = x + off;
        let base = y + scaled.ascent() + li as f32 * line_h;
        let mut prev = None;
        for c in line.chars() {
            let id = scaled.glyph_id(c);
            if let Some(p) = prev {
                caret += scaled.kern(p, id);
            }
            let glyph = id.with_scale_and_position(scaled.scale(), ab_glyph::point(caret, base));
            caret += scaled.h_advance(id);
            prev = Some(id);
            if let Some(o) = font.outline_glyph(glyph) {
                let b = o.px_bounds();
                o.draw(|gx, gy, v| {
                    let a = if antialias { v } else if v >= 0.5 { 1.0 } else { 0.0 };
                    cov.put_pub(b.min.x as isize + gx as isize, b.min.y as isize + gy as isize, (a * 255.0) as u8);
                });
            }
        }
    }
    let total_h = lines.len() as f32 * line_h;
    cov.touch_pub(x as isize - 2, y as isize - 2, (x + max_w) as isize + 4, (y + total_h) as isize + 4);
    (x, y, x + max_w, y + total_h)
}

/// Texte rastérisé dans son seul cadre (pas un masque à la taille du document) : la saisie
/// reste rapide sur une grande image.
pub struct Raster {
    /// coin haut-gauche du tampon (pixels du document, peut être négatif) et sa taille
    pub x0: isize,
    pub y0: isize,
    pub w: usize,
    pub h: usize,
    /// couverture 0..255, w × h
    pub cov: Vec<u8>,
    /// cadre du texte (x0, y0, x1, y1) : cadre d'édition affiché
    pub frame: (f32, f32, f32, f32),
}

impl Raster {
    /// Partie du tampon sur une toile w × h : (x0, y0, x1, y1) exclus.
    pub fn clip(&self, w: usize, h: usize) -> Option<(usize, usize, usize, usize)> {
        let x0 = self.x0.clamp(0, w as isize) as usize;
        let y0 = self.y0.clamp(0, h as isize) as usize;
        let x1 = (self.x0 + self.w as isize).clamp(0, w as isize) as usize;
        let y1 = (self.y0 + self.h as isize).clamp(0, h as isize) as usize;
        (x1 > x0 && y1 > y0).then_some((x0, y0, x1, y1))
    }
}

/// Glyphe rastérisé : décalage du coin haut-gauche depuis le point entier de la ligne de base.
struct GlyphBitmap {
    left: isize,
    top: isize,
    w: usize,
    h: usize,
    cov: Vec<u8>,
}

/// Position sous-pixel des glyphes gardés en cache : quart de pixel.
const SUBPX: f32 = 4.0;

thread_local! {
    /// glyphes déjà rastérisés : (police, glyphe, taille, fraction x, fraction y, anticrénelage)
    static GLYPHS: std::cell::RefCell<HashMap<(usize, u16, u32, u8, u8, bool), Rc<GlyphBitmap>>> = std::cell::RefCell::new(HashMap::new());
}

fn glyph_bitmap(font: &FontVec, id: ab_glyph::GlyphId, scale: PxScale, fx: f32, fy: f32, antialias: bool) -> Option<Rc<GlyphBitmap>> {
    let (qx, qy) = ((fx * SUBPX).round().min(SUBPX - 1.0), (fy * SUBPX).round().min(SUBPX - 1.0));
    let key = (font as *const FontVec as usize, id.0, scale.x.to_bits(), qx as u8, qy as u8, antialias);
    if let Some(g) = GLYPHS.with(|c| c.borrow().get(&key).cloned()) {
        return Some(g);
    }
    let glyph = id.with_scale_and_position(scale, ab_glyph::point(qx / SUBPX, qy / SUBPX));
    let o = font.outline_glyph(glyph)?;
    let b = o.px_bounds();
    let (w, h) = ((b.max.x - b.min.x).ceil().max(0.0) as usize, (b.max.y - b.min.y).ceil().max(0.0) as usize);
    let mut cov = vec![0u8; w * h];
    o.draw(|gx, gy, v| {
        let a = if antialias { v } else if v >= 0.5 { 1.0 } else { 0.0 };
        let (gx, gy) = (gx as usize, gy as usize);
        if gx < w && gy < h {
            cov[gy * w + gx] = (a.clamp(0.0, 1.0) * 255.0) as u8;
        }
    });
    let g = Rc::new(GlyphBitmap { left: b.min.x.floor() as isize, top: b.min.y.floor() as isize, w, h, cov });
    GLYPHS.with(|c| {
        let mut c = c.borrow_mut();
        if c.len() > 6000 {
            c.clear();
        }
        c.insert(key, g.clone());
    });
    Some(g)
}

/// Comme `render`, mais dans un tampon limité au cadre du texte, avec les glyphes en cache.
pub fn raster(font: &FontVec, text: &str, size: f32, x: f32, y: f32, align: Align, antialias: bool) -> Raster {
    let scale = PxScale::from(size.max(1.0));
    let scaled = font.as_scaled(scale);
    let line_h = scaled.height() + scaled.line_gap();
    let lines: Vec<&str> = text.split('\n').collect();
    let widths: Vec<f32> = lines
        .iter()
        .map(|l| {
            let mut w = 0.0;
            let mut prev = None;
            for c in l.chars() {
                let id = scaled.glyph_id(c);
                if let Some(p) = prev {
                    w += scaled.kern(p, id);
                }
                w += scaled.h_advance(id);
                prev = Some(id);
            }
            w
        })
        .collect();
    let max_w = widths.iter().cloned().fold(0.0, f32::max);
    // glyphes placés : (bitmap, x et y entiers de leur coin)
    let mut placed: Vec<(Rc<GlyphBitmap>, isize, isize)> = Vec::new();
    for (li, line) in lines.iter().enumerate() {
        let off = match align {
            Align::Left => 0.0,
            Align::Center => (max_w - widths[li]) / 2.0,
            Align::Right => max_w - widths[li],
        };
        let mut caret = x + off;
        let base = y + scaled.ascent() + li as f32 * line_h;
        let mut prev = None;
        for c in line.chars() {
            let id = scaled.glyph_id(c);
            if let Some(p) = prev {
                caret += scaled.kern(p, id);
            }
            let (ix, iy) = (caret.floor(), base.floor());
            if let Some(g) = glyph_bitmap(font, id, scale, caret - ix, base - iy, antialias) {
                if g.w > 0 && g.h > 0 {
                    placed.push((g.clone(), ix as isize + g.left, iy as isize + g.top));
                }
            }
            caret += scaled.h_advance(id);
            prev = Some(id);
        }
    }
    let total_h = lines.len() as f32 * line_h;
    let frame = (x, y, x + max_w, y + total_h);
    if placed.is_empty() {
        return Raster { x0: x as isize, y0: y as isize, w: 0, h: 0, cov: Vec::new(), frame };
    }
    let x0 = placed.iter().map(|p| p.1).min().unwrap_or(0);
    let y0 = placed.iter().map(|p| p.2).min().unwrap_or(0);
    let x1 = placed.iter().map(|p| p.1 + p.0.w as isize).max().unwrap_or(0);
    let y1 = placed.iter().map(|p| p.2 + p.0.h as isize).max().unwrap_or(0);
    let (w, h) = ((x1 - x0) as usize, (y1 - y0) as usize);
    let mut cov = vec![0u8; w * h];
    for (g, gx, gy) in &placed {
        let (ox, oy) = ((gx - x0) as usize, (gy - y0) as usize);
        for row in 0..g.h {
            let src = &g.cov[row * g.w..(row + 1) * g.w];
            let dst = &mut cov[(oy + row) * w + ox..(oy + row) * w + ox + g.w];
            for (d, s) in dst.iter_mut().zip(src) {
                if *s > *d {
                    *d = *s;
                }
            }
        }
    }
    Raster { x0, y0, w, h, cov, frame }
}

/// Remet le rectangle `r` (x0, y0, x1, y1) du calque `out` (largeur `w`) à l'état `base`
/// (None : transparent).
pub fn restore_rect(out: &mut [u8], base: Option<&[u8]>, w: usize, r: (usize, usize, usize, usize)) {
    let (x0, y0, x1, y1) = r;
    for y in y0..y1 {
        let (a, b) = ((y * w + x0) * 4, (y * w + x1) * 4);
        match base {
            Some(src) => out[a..b].copy_from_slice(&src[a..b]),
            None => out[a..b].fill(0),
        }
    }
}

/// Pose le texte `r` par-dessus le contenu actuel de `out` (sans copie du calque : plusieurs
/// textes d'un même calque texte se superposent ainsi pour le prix de leurs seuls cadres).
pub fn apply_raster_over(out: &mut [u8], w: usize, h: usize, r: &Raster, color: [u8; 4]) {
    let Some((x0, y0, x1, y1)) = r.clip(w, h) else { return };
    for y in y0..y1 {
        let ry = (y as isize - r.y0) as usize;
        for x in x0..x1 {
            let c = r.cov[ry * r.w + (x as isize - r.x0) as usize];
            if c == 0 {
                continue;
            }
            let o = (y * w + x) * 4;
            let sa = c as f32 / 255.0 * color[3] as f32 / 255.0;
            let da = out[o + 3] as f32 / 255.0;
            let ao = sa + da * (1.0 - sa);
            if ao <= 0.0 {
                continue;
            }
            for k in 0..3 {
                out[o + k] = ((color[k] as f32 * sa + out[o + k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
            }
            out[o + 3] = (ao * 255.0 + 0.5) as u8;
        }
    }
}

/// Pose le texte `r` (couleur `color`) sur le calque `out` (w × h) depuis `base` (état sans le
/// texte ; None : transparent), dans la sélection `sel`. Retourne le rectangle touché.
pub fn apply_raster(base: Option<&[u8]>, out: &mut [u8], w: usize, h: usize, r: &Raster, color: [u8; 4], sel: Option<&[u8]>) -> Option<(usize, usize, usize, usize)> {
    let (x0, y0, x1, y1) = r.clip(w, h)?;
    for y in y0..y1 {
        let ry = (y as isize - r.y0) as usize;
        for x in x0..x1 {
            let c = r.cov[ry * r.w + (x as isize - r.x0) as usize];
            if c == 0 {
                continue;
            }
            let i = y * w + x;
            let o = i * 4;
            let s = sel.map_or(255, |m| m[i]) as f32 / 255.0;
            let sa = c as f32 / 255.0 * s * color[3] as f32 / 255.0;
            let d = match base {
                Some(b) => [b[o], b[o + 1], b[o + 2], b[o + 3]],
                None => [0, 0, 0, 0],
            };
            let da = d[3] as f32 / 255.0;
            let ao = sa + da * (1.0 - sa);
            if ao <= 0.0 {
                out[o..o + 4].copy_from_slice(&[0, 0, 0, 0]);
                continue;
            }
            for k in 0..3 {
                out[o + k] = ((color[k] as f32 * sa + d[k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
            }
            out[o + 3] = (ao * 255.0 + 0.5) as u8;
        }
    }
    Some((x0, y0, x1, y1))
}

/// Aperçu d'une police : son nom écrit dans la police (blanc, alpha = couverture), pour la
/// liste des polices de l'outil Texte (recoloré par l'interface).
pub fn preview(font: &FontVec, name: &str) -> Option<(usize, usize, Vec<u8>)> {
    let (w, h) = (300usize, 26usize);
    let mut cov = Cover::new(w, h);
    let (_, _, x1, _) = render(font, name, 17.0, 1.0, 1.0, Align::Left, true, &mut cov);
    let used = (x1.ceil() as usize + 2).clamp(1, w);
    if !cov.m.iter().any(|v| *v > 0) {
        return None;
    }
    let mut px = vec![0u8; used * h * 4];
    for y in 0..h {
        for x in 0..used {
            let o = (y * used + x) * 4;
            px[o..o + 3].copy_from_slice(&[255, 255, 255]);
            px[o + 3] = cov.m[y * w + x];
        }
    }
    Some((used, h, px))
}

/// Source d'une police lisible depuis un autre fil (aperçus calculés en arrière-plan).
pub enum PreviewSource {
    Bytes(&'static [u8]),
    File(std::path::PathBuf),
}

impl Fonts {
    /// Polices dont l'aperçu peut être calculé sans téléchargement : (index, nom, source).
    pub fn preview_sources(&self) -> Vec<(usize, String, PreviewSource)> {
        self.entries
            .iter()
            .enumerate()
            .filter_map(|(i, e)| match &e.source {
                Source::Static(b) => Some((i, e.name.clone(), PreviewSource::Bytes(b))),
                Source::File(p) => Some((i, e.name.clone(), PreviewSource::File(p.clone()))),
                Source::Web(_) => None,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_builtin_and_woff2_fonts() {
        let mut fonts = Fonts::new();
        assert!(fonts.entries.len() > 90, "Selawik + polices MasterPaint");
        for name in ["Selawik", "Lobster", "Press Start 2P"] {
            let i = fonts.index_of(name).expect(name);
            let font = fonts.get(i).expect(name);
            let mut cov = Cover::new(400, 120);
            let (x0, y0, x1, y1) = render(&font, "Bonjour\nMasterPaint", 32.0, 10.0, 10.0, Align::Center, true, &mut cov);
            let inked = cov.m.iter().filter(|v| **v > 128).count();
            assert!(inked > 300, "{name} : {inked} pixels");
            assert!(x1 > x0 + 50.0 && y1 > y0 + 40.0, "{name} : cadre {x0},{y0},{x1},{y1}");
        }
    }
}
