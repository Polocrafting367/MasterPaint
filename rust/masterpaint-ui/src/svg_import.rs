//! Import SVG simple (Fichier › Ouvrir un .svg, mode SVG bêta) : rect, circle, ellipse, line,
//! polygon et polyline deviennent les objets d'un calque vectoriel, modifiables ensuite
//! (panneau Objets SVG, Déplacer, Pot de peinture). Le reste (chemins, textes, images,
//! rotations…) est ignoré et signalé. Lecture à la main, sans bibliothèque XML : balises,
//! attributs et `style`, présentation héritée des groupes, `viewBox`, translate / scale.

use crate::editor::Doc;
use crate::paint::ShapeStyle;
use crate::vector::{Obj, ShapeObj, VectorLayer};

/// Présentation héritée des éléments englobants (attributs et `style`), transformation
/// comprise : x' = sx · x + tx, y' = sy · y + ty.
#[derive(Clone)]
struct Pres {
    /// None : « none »
    fill: Option<[u8; 4]>,
    stroke: Option<[u8; 4]>,
    width: f32,
    opacity: f32,
    fill_opacity: f32,
    stroke_opacity: f32,
    sx: f32,
    sy: f32,
    tx: f32,
    ty: f32,
    /// contenu jamais dessiné (defs, clipPath, display:none…)
    hidden: bool,
}

impl Default for Pres {
    fn default() -> Self {
        // valeurs initiales de SVG : remplissage noir, pas de trait
        Pres { fill: Some([0, 0, 0, 255]), stroke: None, width: 1.0, opacity: 1.0, fill_opacity: 1.0, stroke_opacity: 1.0, sx: 1.0, sy: 1.0, tx: 0.0, ty: 0.0, hidden: false }
    }
}

impl Pres {
    fn map(&self, x: f32, y: f32) -> (f32, f32) {
        (self.sx * x + self.tx, self.sy * y + self.ty)
    }

    /// Transformation `t` (sx, sy, tx, ty) appliquée avant celle déjà en place.
    fn then(&mut self, t: (f32, f32, f32, f32)) {
        self.tx += self.sx * t.2;
        self.ty += self.sy * t.3;
        self.sx *= t.0;
        self.sy *= t.1;
    }
}

/// Balise lue : nom (sans préfixe d'espace de noms), attributs, fermante, auto-fermante.
struct Tag {
    name: String,
    attrs: Vec<(String, String)>,
    close: bool,
    self_close: bool,
}

impl Tag {
    fn get(&self, k: &str) -> Option<&str> {
        self.attrs.iter().find(|(a, _)| a == k).map(|(_, v)| v.as_str())
    }

    fn len(&self, k: &str) -> f32 {
        self.get(k).and_then(parse_len).unwrap_or(0.0)
    }
}

fn unescape(s: &str) -> String {
    s.replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", "\"").replace("&apos;", "'").replace("&amp;", "&")
}

/// Attributs `nom="valeur"` (ou entre apostrophes) d'une balise.
fn parse_attrs(s: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut rest = s;
    loop {
        let Some(eq) = rest.find('=') else { break };
        // nom : dernier mot avant « = » (attributs sans valeur ignorés)
        let key = rest[..eq].split_whitespace().last().unwrap_or("").to_string();
        let after = rest[eq + 1..].trim_start();
        let Some(q) = after.chars().next().filter(|c| *c == '"' || *c == '\'') else { break };
        let body = &after[1..];
        let Some(end) = body.find(q) else { break };
        if !key.is_empty() {
            out.push((key, unescape(&body[..end])));
        }
        rest = &body[end + 1..];
    }
    out
}

/// Balises du document, dans l'ordre (commentaires, CDATA, `<?…?>`, `<!…>` sautés).
fn tags(src: &str) -> Vec<Tag> {
    let b = src.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while let Some(off) = src[i..].find('<') {
        let s = i + off;
        let rest = &src[s..];
        let skip = |end: &str, n: usize| rest.find(end).map_or(src.len(), |e| s + e + n);
        if rest.starts_with("<!--") {
            i = skip("-->", 3);
            continue;
        }
        if rest.starts_with("<![CDATA[") {
            i = skip("]]>", 3);
            continue;
        }
        if rest.starts_with("<?") || rest.starts_with("<!") {
            i = skip(">", 1);
            continue;
        }
        // fin de la balise : premier « > » hors guillemets
        let mut e = s + 1;
        let mut quote: Option<u8> = None;
        while e < b.len() {
            let c = b[e];
            match quote {
                Some(q) if c == q => quote = None,
                Some(_) => {}
                None if c == b'"' || c == b'\'' => quote = Some(c),
                None if c == b'>' => break,
                None => {}
            }
            e += 1;
        }
        let inner = src[s + 1..e.min(b.len())].trim();
        i = (e + 1).min(b.len());
        let close = inner.starts_with('/');
        let self_close = inner.ends_with('/');
        let body = inner.trim_start_matches('/').trim_end_matches('/');
        let name_end = body.find(|c: char| c.is_whitespace()).unwrap_or(body.len());
        // « svg:rect » → « rect » ; autres espaces de noms (Inkscape, RDF…) gardés tels quels
        let raw = &body[..name_end];
        let name = match raw.split_once(':') {
            Some(("svg", n)) => n.to_string(),
            _ => raw.to_string(),
        };
        if name.is_empty() {
            continue;
        }
        out.push(Tag { name, attrs: parse_attrs(&body[name_end..]), close, self_close });
    }
    out
}

/// Nombres d'une liste SVG (espaces, virgules, signes collés : « 10,20 30-5 »).
fn nums(s: &str) -> Vec<f32> {
    let b = s.as_bytes();
    let mut out = Vec::new();
    let mut i = 0;
    while i < b.len() {
        let c = b[i];
        if !(c.is_ascii_digit() || c == b'-' || c == b'+' || c == b'.') {
            i += 1;
            continue;
        }
        let start = i;
        let mut dot = c == b'.';
        i += 1;
        while i < b.len() {
            let d = b[i];
            if d.is_ascii_digit() {
                i += 1;
            } else if d == b'.' && !dot {
                dot = true;
                i += 1;
            } else if (d == b'e' || d == b'E') && i + 1 < b.len() {
                i += 1;
                if b[i] == b'-' || b[i] == b'+' {
                    i += 1;
                }
                dot = true;
            } else {
                break;
            }
        }
        if let Ok(v) = s[start..i].parse::<f32>() {
            if v.is_finite() {
                out.push(v);
            }
        }
    }
    out
}

/// Longueur en pixels (px, pt, mm, cm, in, em) ; pourcentage : None.
fn parse_len(s: &str) -> Option<f32> {
    let s = s.trim();
    if s.ends_with('%') {
        return None;
    }
    for (u, k) in [("px", 1.0f32), ("pt", 4.0 / 3.0), ("pc", 16.0), ("mm", 96.0 / 25.4), ("cm", 96.0 / 2.54), ("in", 96.0), ("em", 16.0), ("ex", 8.0)] {
        if let Some(n) = s.strip_suffix(u) {
            return n.trim().parse::<f32>().ok().filter(|v| v.is_finite()).map(|v| v * k);
        }
    }
    s.parse::<f32>().ok().filter(|v| v.is_finite())
}

/// Couleur SVG : #rgb, #rrggbb, rgb(…) / rgba(…), noms usuels. « none » : Some(None).
/// Dégradé ou motif (url(…)) : gris moyen. Valeur inconnue : None (héritée).
fn parse_color(s: &str) -> Option<Option<[u8; 4]>> {
    let s = s.trim().to_ascii_lowercase();
    if s == "none" || s == "transparent" {
        return Some(None);
    }
    if s.starts_with("url(") {
        return Some(Some([128, 128, 128, 255]));
    }
    if let Some(hex) = s.strip_prefix('#') {
        let v: Vec<u8> = hex.chars().filter_map(|c| c.to_digit(16)).map(|d| d as u8).collect();
        if v.len() != hex.chars().count() {
            return None;
        }
        return match v.len() {
            3 => Some(Some([v[0] * 17, v[1] * 17, v[2] * 17, 255])),
            4 => Some(Some([v[0] * 17, v[1] * 17, v[2] * 17, v[3] * 17])),
            6 => Some(Some([v[0] * 16 + v[1], v[2] * 16 + v[3], v[4] * 16 + v[5], 255])),
            8 => Some(Some([v[0] * 16 + v[1], v[2] * 16 + v[3], v[4] * 16 + v[5], v[6] * 16 + v[7]])),
            _ => None,
        };
    }
    if s.starts_with("rgb") {
        let inner = s.split_once('(')?.1.trim_end_matches(')');
        let parts: Vec<&str> = inner.split(|c: char| c == ',' || c == '/' || c.is_whitespace()).filter(|p| !p.is_empty()).collect();
        if parts.len() < 3 {
            return None;
        }
        let chan = |p: &str| -> Option<u8> {
            let v = match p.strip_suffix('%') {
                Some(n) => n.parse::<f32>().ok()? * 2.55,
                None => p.parse::<f32>().ok()?,
            };
            Some(v.round().clamp(0.0, 255.0) as u8)
        };
        let a = parts.get(3).and_then(|p| match p.strip_suffix('%') {
            Some(n) => n.parse::<f32>().ok().map(|v| v / 100.0),
            None => p.parse::<f32>().ok(),
        });
        return Some(Some([chan(parts[0])?, chan(parts[1])?, chan(parts[2])?, (a.unwrap_or(1.0).clamp(0.0, 1.0) * 255.0).round() as u8]));
    }
    let named: [u8; 3] = match s.as_str() {
        "black" => [0, 0, 0],
        "white" => [255, 255, 255],
        "red" => [255, 0, 0],
        "green" => [0, 128, 0],
        "lime" => [0, 255, 0],
        "blue" => [0, 0, 255],
        "yellow" => [255, 255, 0],
        "cyan" | "aqua" => [0, 255, 255],
        "magenta" | "fuchsia" => [255, 0, 255],
        "gray" | "grey" => [128, 128, 128],
        "darkgray" | "darkgrey" => [169, 169, 169],
        "lightgray" | "lightgrey" => [211, 211, 211],
        "silver" => [192, 192, 192],
        "maroon" => [128, 0, 0],
        "olive" => [128, 128, 0],
        "navy" => [0, 0, 128],
        "purple" => [128, 0, 128],
        "teal" => [0, 128, 128],
        "orange" => [255, 165, 0],
        "pink" => [255, 192, 203],
        "brown" => [165, 42, 42],
        "gold" => [255, 215, 0],
        "currentcolor" => [0, 0, 0],
        _ => return None,
    };
    Some(Some([named[0], named[1], named[2], 255]))
}

/// Présentation propre à l'élément (attributs, puis `style` qui l'emporte). Retourne `false`
/// si sa transformation n'a pas pu être reprise (rotation, inclinaison).
fn apply_pres(p: &mut Pres, tag: &Tag) -> bool {
    let mut props: Vec<(String, String)> = tag.attrs.clone();
    if let Some(style) = tag.get("style") {
        for decl in style.split(';') {
            if let Some((k, v)) = decl.split_once(':') {
                props.push((k.trim().to_string(), v.trim().to_string()));
            }
        }
    }
    for (k, v) in &props {
        match k.as_str() {
            "fill" => {
                if let Some(c) = parse_color(v) {
                    p.fill = c;
                }
            }
            "stroke" => {
                if let Some(c) = parse_color(v) {
                    p.stroke = c;
                }
            }
            "stroke-width" => {
                if let Some(w) = parse_len(v) {
                    p.width = w.max(0.0);
                }
            }
            "opacity" => p.opacity *= v.trim().parse::<f32>().unwrap_or(1.0).clamp(0.0, 1.0),
            "fill-opacity" => p.fill_opacity = v.trim().parse::<f32>().unwrap_or(1.0).clamp(0.0, 1.0),
            "stroke-opacity" => p.stroke_opacity = v.trim().parse::<f32>().unwrap_or(1.0).clamp(0.0, 1.0),
            "display" if v.trim() == "none" => p.hidden = true,
            "visibility" if v.trim() == "hidden" || v.trim() == "collapse" => p.hidden = true,
            _ => {}
        }
    }
    let mut ok = true;
    if let Some(t) = tag.get("transform") {
        // liste « f(a, b) g(c) … » appliquée de gauche à droite
        for part in t.split(')') {
            let Some((f, args)) = part.split_once('(') else { continue };
            let a = nums(args);
            let f = f.trim().trim_start_matches(',').trim();
            match (f, a.as_slice()) {
                ("translate", [x]) => p.then((1.0, 1.0, *x, 0.0)),
                ("translate", [x, y, ..]) => p.then((1.0, 1.0, *x, *y)),
                ("scale", [s]) => p.then((*s, *s, 0.0, 0.0)),
                ("scale", [sx, sy, ..]) => p.then((*sx, *sy, 0.0, 0.0)),
                ("matrix", [m0, m1, m2, m3, m4, m5]) if m1.abs() < 1e-6 && m2.abs() < 1e-6 => p.then((*m0, *m3, *m4, *m5)),
                ("rotate", [r, ..]) if r.abs() < 1e-6 => {}
                _ => ok = false,
            }
        }
    }
    ok
}

/// Couleur `c` dont l'opacité est multipliée par `a`.
fn faded(c: [u8; 4], a: f32) -> [u8; 4] {
    [c[0], c[1], c[2], (c[3] as f32 * a.clamp(0.0, 1.0)).round() as u8]
}

/// Objets d'une forme SVG : un seul (remplissage et / ou trait de même couleur) ou deux
/// (remplissage puis contour, quand leurs couleurs diffèrent : un objet n'a qu'une couleur).
fn shapes(tag: &Tag, p: &Pres) -> Vec<ShapeObj> {
    let sw = p.width * (p.sx.abs() + p.sy.abs()) / 2.0;
    let fill = p.fill.map(|c| faded(c, p.opacity * p.fill_opacity)).filter(|c| c[3] > 0);
    let stroke = p.stroke.filter(|_| sw > 0.0).map(|c| faded(c, p.opacity * p.stroke_opacity)).filter(|c| c[3] > 0);
    let obj = |kind: &str, a: (f32, f32), b: (f32, f32), style: ShapeStyle, color: [u8; 4], points: Vec<(f32, f32)>| ShapeObj {
        kind: kind.to_string(),
        a,
        b,
        style,
        width: sw.max(1.0),
        color,
        points,
        radius: -1.0,
        fill: None,
        rot: 0.0,
        cap_start: 1,
        cap_end: 1,
        dash: 0,
    };
    // forme fermée : remplissage, contour ou les deux
    let closed = |kind: &str, a: (f32, f32), b: (f32, f32), points: Vec<(f32, f32)>| -> Vec<ShapeObj> {
        match (fill, stroke) {
            (Some(f), Some(s)) if f == s => vec![obj(kind, a, b, ShapeStyle::Both, f, points)],
            (Some(f), Some(s)) => vec![obj(kind, a, b, ShapeStyle::Fill, f, points.clone()), obj(kind, a, b, ShapeStyle::Outline, s, points)],
            (Some(f), None) => vec![obj(kind, a, b, ShapeStyle::Fill, f, points)],
            (None, Some(s)) => vec![obj(kind, a, b, ShapeStyle::Outline, s, points)],
            (None, None) => Vec::new(),
        }
    };
    match tag.name.as_str() {
        "rect" => {
            let (x, y, w, h) = (tag.len("x"), tag.len("y"), tag.len("width"), tag.len("height"));
            if w <= 0.0 || h <= 0.0 {
                return Vec::new();
            }
            let rx = tag.len("rx").max(tag.len("ry"));
            let corner = rx * (p.sx.abs() + p.sy.abs()) / 2.0;
            let mut objs = closed(if rx > 0.0 { "roundrect" } else { "rect" }, p.map(x, y), p.map(x + w, y + h), Vec::new());
            for o in &mut objs {
                if rx > 0.0 {
                    o.radius = corner;
                }
            }
            objs
        }
        "circle" => {
            let (cx, cy, r) = (tag.len("cx"), tag.len("cy"), tag.len("r"));
            if r <= 0.0 {
                return Vec::new();
            }
            closed("ellipse", p.map(cx - r, cy - r), p.map(cx + r, cy + r), Vec::new())
        }
        "ellipse" => {
            let (cx, cy, rx, ry) = (tag.len("cx"), tag.len("cy"), tag.len("rx"), tag.len("ry"));
            if rx <= 0.0 || ry <= 0.0 {
                return Vec::new();
            }
            closed("ellipse", p.map(cx - rx, cy - ry), p.map(cx + rx, cy + ry), Vec::new())
        }
        "line" => match stroke {
            Some(s) => vec![obj("line", p.map(tag.len("x1"), tag.len("y1")), p.map(tag.len("x2"), tag.len("y2")), ShapeStyle::Fill, s, Vec::new())],
            None => Vec::new(),
        },
        "polygon" | "polyline" => {
            let v = nums(tag.get("points").unwrap_or(""));
            let pts: Vec<(f32, f32)> = v.chunks_exact(2).map(|c| p.map(c[0], c[1])).collect();
            if pts.len() < 2 {
                return Vec::new();
            }
            let (first, last) = (pts[0], pts[pts.len() - 1]);
            if tag.name == "polygon" {
                return closed("polygon", first, last, pts);
            }
            // polyligne : remplissage éventuel (fermé), puis trait ouvert
            let mut out = Vec::new();
            if let Some(f) = fill.filter(|_| pts.len() >= 3) {
                out.push(obj("polygon", first, last, ShapeStyle::Fill, f, pts.clone()));
            }
            if let Some(s) = stroke {
                out.push(obj("polyline", first, last, ShapeStyle::Fill, s, pts));
            }
            out
        }
        _ => Vec::new(),
    }
}

/// Lit un fichier SVG : un document (nouvel onglet) avec un calque vectoriel. Les éléments
/// non repris sont comptés dans `skipped`.
pub fn import(name: &str, bytes: &[u8]) -> Result<crate::illu::Loaded, String> {
    let src = String::from_utf8_lossy(bytes);
    let all = tags(&src);
    if !all.iter().any(|t| t.name == "svg" && !t.close) {
        return Err(format!("« {name} » n'est pas un fichier SVG lisible"));
    }
    let mut size: Option<(usize, usize)> = None;
    let mut cur = Pres::default();
    // présentation à rendre à la fermeture de chaque élément ouvert
    let mut stack: Vec<(String, Pres)> = Vec::new();
    let mut objects = Vec::new();
    let mut ignored: Vec<(String, usize)> = Vec::new();
    let mut note = |what: &str| match ignored.iter_mut().find(|(n, _)| n == what) {
        Some((_, k)) => *k += 1,
        None => ignored.push((what.to_string(), 1)),
    };
    for tag in &all {
        if tag.close {
            while let Some((n, p)) = stack.pop() {
                cur = p;
                if n == tag.name {
                    break;
                }
            }
            continue;
        }
        let mut p = cur.clone();
        if tag.name == "svg" && size.is_none() {
            // taille du document : width / height, sinon viewBox ; viewBox ajusté au centre
            // (preserveAspectRatio par défaut)
            let vb = tag.get("viewBox").map(nums).filter(|v| v.len() == 4 && v[2] > 0.0 && v[3] > 0.0);
            let (w, h) = match (tag.get("width").and_then(parse_len), tag.get("height").and_then(parse_len), &vb) {
                (Some(w), Some(h), _) => (w, h),
                (Some(w), None, Some(v)) => (w, w * v[3] / v[2]),
                (None, Some(h), Some(v)) => (h * v[2] / v[3], h),
                (_, _, Some(v)) => (v[2], v[3]),
                (Some(w), None, None) => (w, w * 0.75),
                (None, Some(h), None) => (h / 0.75, h),
                (None, None, None) => (800.0, 600.0),
            };
            let (w, h) = (w.max(1.0), h.max(1.0));
            if let Some(v) = &vb {
                // x' = s·x + t (échelle uniforme, contenu centré)
                let s = (w / v[2]).min(h / v[3]);
                p.then((s, s, (w - v[2] * s) / 2.0 - v[0] * s, (h - v[3] * s) / 2.0 - v[1] * s));
            }
            size = Some(((w.round() as usize).clamp(1, 8192), (h.round() as usize).clamp(1, 8192)));
        }
        let transform_ok = apply_pres(&mut p, tag);
        match tag.name.as_str() {
            "rect" | "circle" | "ellipse" | "line" | "polygon" | "polyline" if !p.hidden => {
                if !transform_ok {
                    note("rotation / inclinaison (forme posée sans elle)");
                }
                objects.extend(shapes(tag, &p).into_iter().map(Obj::Shape));
            }
            "svg" | "g" | "a" | "switch" => {
                if !transform_ok && !p.hidden {
                    note("rotation / inclinaison (forme posée sans elle)");
                }
            }
            // définitions et métadonnées : jamais dessinées telles quelles
            "defs" | "clipPath" | "mask" | "symbol" | "pattern" | "marker" | "linearGradient" | "radialGradient" | "filter" | "style" | "title" | "desc" | "metadata" | "script" => p.hidden = true,
            // éléments d'un autre espace de noms (sodipodi:namedview…) : métadonnées d'éditeur
            n if n.contains(':') => p.hidden = true,
            // le reste (chemins, textes, images, <use>…) : compté, son contenu ignoré
            other => {
                if !p.hidden {
                    note(&format!("<{other}>"));
                }
                p.hidden = true;
            }
        }
        if !tag.self_close {
            stack.push((tag.name.clone(), cur.clone()));
            cur = p;
        }
    }
    let (w, h) = size.unwrap_or((800, 600));
    let n = objects.len();
    let v = VectorLayer { objects, effects: Vec::new(), serial: 0 };
    let px = v.render_objects(&mut crate::text::Fonts::default(), w, h);
    let mut doc = Doc::new(w, h, [0, 0, 0, 0], name);
    {
        let l = &mut doc.layers[0];
        l.name = "Vecteur 1".into();
        l.px = px.into();
        l.vector = Some(Box::new(v));
    }
    // une seule étape : l'état ouvert
    doc.history.clear();
    doc.commit("Ouvrir le SVG");
    let mut skipped: Vec<String> = ignored.into_iter().map(|(what, k)| if k > 1 { format!("{k} × {what}") } else { what }).collect();
    if n == 0 {
        skipped.insert(0, "aucune forme simple (rect, circle, ellipse, line, polygon, polyline)".to_string());
    }
    Ok(crate::illu::Loaded { docs: vec![doc], skipped })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Formes simples reprises (viewBox, groupe, style), chemin compté parmi les ignorés.
    #[test]
    fn simple_svg_import() {
        let svg = r##"<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="0 0 100 50">
  <!-- commentaire <rect> -->
  <g fill="#ff0000" transform="translate(10,5)">
    <rect x="0" y="0" width="20" height="10"/>
    <circle cx="40" cy="20" r="5" style="fill:none;stroke:blue;stroke-width:2"/>
  </g>
  <line x1="0" y1="0" x2="100" y2="50" stroke="black"/>
  <polyline points="0,0 10,10 20,0" fill="none" stroke="#0f0"/>
  <path d="M0 0 L10 10"/>
  <defs><rect width="5" height="5"/></defs>
</svg>"##;
        let l = import("essai.svg", svg.as_bytes()).unwrap();
        let d = &l.docs[0];
        assert_eq!((d.w, d.h), (200, 100));
        let v = d.layers[0].vector.as_deref().unwrap();
        assert_eq!(v.objects.len(), 4, "rect, cercle, ligne, polyligne (defs exclus)");
        match &v.objects[0] {
            Obj::Shape(s) => {
                assert_eq!(s.kind, "rect");
                assert_eq!(s.color, [255, 0, 0, 255]);
                assert_eq!(s.a, (20.0, 10.0), "translate puis échelle ×2");
                assert_eq!(s.b, (60.0, 30.0));
            }
            _ => panic!("forme attendue"),
        }
        match &v.objects[1] {
            Obj::Shape(s) => {
                assert_eq!(s.style, ShapeStyle::Outline);
                assert_eq!(s.color, [0, 0, 255, 255]);
                assert_eq!(s.width, 4.0);
            }
            _ => panic!("forme attendue"),
        }
        assert!(l.skipped.iter().any(|s| s.contains("<path>")), "{:?}", l.skipped);
        assert!(d.layers[0].px.iter().skip(3).step_by(4).any(|a| *a > 0), "rendu fait");
    }
}
