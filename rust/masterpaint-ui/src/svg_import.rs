// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Import SVG simple (Fichier › Ouvrir un .svg, mode SVG bêta) : rect, circle, ellipse, line,
//! polygon et polyline deviennent les objets d'un calque vectoriel, modifiables ensuite
//! (panneau Objets SVG, Déplacer, Pot de peinture). Le reste (chemins, textes, images,
//! rotations…) est ignoré et signalé. Lecture à la main, sans bibliothèque XML : balises,
//! attributs et `style`, présentation héritée des groupes, `viewBox`, translate / scale.

use crate::editor::Doc;
use crate::paint::ShapeStyle;
use crate::vector::{dist, Node, Obj, ShapeObj, SubPath, VectorLayer};

/// Présentation héritée des éléments englobants (attributs et `style`), transformation
/// comprise : matrice affine SVG [a b c d e f] (x' = a·x + c·y + e, y' = b·x + d·y + f).
#[derive(Clone)]
struct Pres {
    /// None : « none »
    fill: Option<[u8; 4]>,
    /// remplissage par dégradé : identifiant (« url(#id) »)
    fill_grad: Option<String>,
    stroke: Option<[u8; 4]>,
    width: f32,
    opacity: f32,
    fill_opacity: f32,
    stroke_opacity: f32,
    m: [f32; 6],
    /// contenu jamais dessiné (defs, clipPath, display:none…)
    hidden: bool,
    /// bouts et angles de trait arrondis (stroke-linecap / stroke-linejoin)
    round: bool,
}

impl Default for Pres {
    fn default() -> Self {
        // valeurs initiales de SVG : remplissage noir, pas de trait
        Pres { fill: Some([0, 0, 0, 255]), fill_grad: None, stroke: None, width: 1.0, opacity: 1.0, fill_opacity: 1.0, stroke_opacity: 1.0, m: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0], hidden: false, round: false }
    }
}

impl Pres {
    fn map(&self, x: f32, y: f32) -> (f32, f32) {
        let m = &self.m;
        (m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5])
    }

    /// Matrice `t` appliquée avant celle déjà en place (transform des éléments imbriqués).
    fn then_m(&mut self, t: [f32; 6]) {
        let m = self.m;
        self.m = [
            m[0] * t[0] + m[2] * t[1],
            m[1] * t[0] + m[3] * t[1],
            m[0] * t[2] + m[2] * t[3],
            m[1] * t[2] + m[3] * t[3],
            m[0] * t[4] + m[2] * t[5] + m[4],
            m[1] * t[4] + m[3] * t[5] + m[5],
        ];
    }

    /// Échelle et translation (sx, sy, tx, ty) appliquées avant celles déjà en place.
    fn then(&mut self, t: (f32, f32, f32, f32)) {
        self.then_m([t.0, 0.0, 0.0, t.1, t.2, t.3]);
    }

    /// Ni rotation ni inclinaison : rectangles et ellipses restent des formes simples.
    fn axis_aligned(&self) -> bool {
        self.m[1].abs() < 1e-6 && self.m[2].abs() < 1e-6
    }

    /// Facteur d'échelle moyen (épaisseurs de trait, rayons).
    fn scale(&self) -> f32 {
        (self.m[0] * self.m[3] - self.m[1] * self.m[2]).abs().sqrt()
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
    // couleur du texte courant (icônes) : gris ardoise, comme le sprite en thème clair
    if s == "currentcolor" {
        return Some(Some([0x1e, 0x29, 0x3b, 255]));
    }
    // variable CSS : sa valeur de repli (« var(--illu-icon-accent, #3b82f6) »)
    if let Some(inner) = s.strip_prefix("var(").and_then(|r| r.strip_suffix(')')) {
        return match inner.split_once(',') {
            Some((_, fallback)) => parse_color(fallback),
            None => Some(Some([0x1e, 0x29, 0x3b, 255])),
        };
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
                let id = v.trim().strip_prefix("url(").and_then(|r| r.split(')').next()).map(|r| r.trim().trim_matches(|c| c == '\'' || c == '"').trim_start_matches('#').to_string());
                p.fill_grad = id;
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
            "stroke-linecap" | "stroke-linejoin" => {
                if v.trim() == "round" {
                    p.round = true;
                } else if k == "stroke-linecap" {
                    p.round = false;
                }
            }
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
                ("matrix", [m0, m1, m2, m3, m4, m5]) => p.then_m([*m0, *m1, *m2, *m3, *m4, *m5]),
                ("rotate", [r]) => {
                    let (sn, cs) = r.to_radians().sin_cos();
                    p.then_m([cs, sn, -sn, cs, 0.0, 0.0]);
                }
                ("rotate", [r, cx, cy, ..]) => {
                    let (sn, cs) = r.to_radians().sin_cos();
                    p.then((1.0, 1.0, *cx, *cy));
                    p.then_m([cs, sn, -sn, cs, 0.0, 0.0]);
                    p.then((1.0, 1.0, -*cx, -*cy));
                }
                ("skewX", [k]) => p.then_m([1.0, 0.0, k.to_radians().tan(), 1.0, 0.0, 0.0]),
                ("skewY", [k]) => p.then_m([1.0, k.to_radians().tan(), 0.0, 1.0, 0.0, 0.0]),
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
fn shapes(tag: &Tag, p: &Pres, grads: &std::collections::HashMap<String, GradDef>) -> Vec<ShapeObj> {
    let sw = p.width * p.scale();
    let fill = p.fill.map(|c| faded(c, p.opacity * p.fill_opacity)).filter(|c| c[3] > 0);
    let stroke = p.stroke.filter(|_| sw > 0.0).map(|c| faded(c, p.opacity * p.stroke_opacity)).filter(|c| c[3] > 0);
    let gdef = p.fill_grad.as_ref().and_then(|id| grads.get(id)).filter(|g| !g.stops.is_empty() && fill.is_some());
    let obj = |kind: &str, a: (f32, f32), b: (f32, f32), style: ShapeStyle, color: [u8; 4], points: Vec<(f32, f32)>| ShapeObj {
        kind: kind.to_string(),
        a,
        b,
        style,
        width: sw.max(0.01),
        color,
        points,
        radius: -1.0,
        fill: None,
        rot: 0.0,
        cap_start: 1,
        cap_end: 1,
        dash: 0,
        grad: None,
        subs: Vec::new(),
    };
    // contours de Bézier (repère de l'élément) → un objet « path » : mêmes courbes, transformation
    // appliquée à leurs points, remplissage et trait sur le même objet
    let path_obj = |mut subs: Vec<SubPath>, user: (f32, f32, f32, f32)| -> Vec<ShapeObj> {
        for c in &mut subs {
            for n in &mut c.nodes {
                n.p = p.map(n.p.0, n.p.1);
                n.c_in = p.map(n.c_in.0, n.c_in.1);
                n.c_out = p.map(n.c_out.0, n.c_out.1);
            }
        }
        let (style, color, inner) = match (fill, stroke) {
            (Some(f), Some(s)) => (ShapeStyle::Both, s, Some(f)),
            (Some(f), None) => (ShapeStyle::Fill, f, None),
            (None, Some(s)) => (ShapeStyle::Outline, s, None),
            (None, None) => return Vec::new(),
        };
        let mut o = obj("path", (0.0, 0.0), (0.0, 0.0), style, color, Vec::new());
        o.fill = inner;
        o.grad = gdef.map(|g| Box::new(g.resolve(p, user)));
        o.subs = subs;
        (o.cap_start, o.cap_end) = if p.round { (1, 1) } else { (0, 0) };
        o.sync_geom();
        vec![o]
    };
    // forme fermée : remplissage (couleur ou dégradé), contour ou les deux ; `user` : cadre de
    // l'élément dans son propre repère (dégradés « objectBoundingBox »)
    let closed = |kind: &str, a: (f32, f32), b: (f32, f32), points: Vec<(f32, f32)>, user: (f32, f32, f32, f32)| -> Vec<ShapeObj> {
        let grad = gdef.map(|g| Box::new(g.resolve(p, user)));
        let mut out = match (fill, stroke) {
            (Some(f), Some(s)) if f == s && grad.is_none() => vec![obj(kind, a, b, ShapeStyle::Both, f, points)],
            (Some(f), Some(s)) => vec![obj(kind, a, b, ShapeStyle::Fill, f, points.clone()), obj(kind, a, b, ShapeStyle::Outline, s, points)],
            (Some(f), None) => vec![obj(kind, a, b, ShapeStyle::Fill, f, points)],
            (None, Some(s)) => vec![obj(kind, a, b, ShapeStyle::Outline, s, points)],
            (None, None) => Vec::new(),
        };
        for o in &mut out {
            if o.style != ShapeStyle::Outline {
                o.grad = grad.clone();
            }
        }
        out
    };
    // rotation, inclinaison ou dégradé : rectangles et ellipses passent en contours
    let simple = p.axis_aligned() && gdef.is_none();
    match tag.name.as_str() {
        "rect" => {
            let (x, y, w, h) = (tag.len("x"), tag.len("y"), tag.len("width"), tag.len("height"));
            if w <= 0.0 || h <= 0.0 {
                return Vec::new();
            }
            let rx = tag.len("rx").max(tag.len("ry")).min(w / 2.0).min(h / 2.0);
            if simple {
                let mut objs = closed(if rx > 0.0 { "roundrect" } else { "rect" }, p.map(x, y), p.map(x + w, y + h), Vec::new(), (x, y, w, h));
                for o in &mut objs {
                    if rx > 0.0 {
                        o.radius = rx * p.scale();
                    }
                }
                return objs;
            }
            // rectangle penché ou à dégradé : son contour exact
            let mut r = obj(if rx > 0.0 { "roundrect" } else { "rect" }, (x, y), (x + w, y + h), ShapeStyle::Fill, [0, 0, 0, 255], Vec::new());
            r.radius = rx;
            path_obj(r.to_subs(), (x, y, w, h))
        }
        "circle" | "ellipse" => {
            let (cx, cy) = (tag.len("cx"), tag.len("cy"));
            let (rx, ry) = if tag.name == "circle" { (tag.len("r"), tag.len("r")) } else { (tag.len("rx"), tag.len("ry")) };
            if rx <= 0.0 || ry <= 0.0 {
                return Vec::new();
            }
            let user = (cx - rx, cy - ry, 2.0 * rx, 2.0 * ry);
            if simple {
                return closed("ellipse", p.map(cx - rx, cy - ry), p.map(cx + rx, cy + ry), Vec::new(), user);
            }
            let e = obj("ellipse", (cx - rx, cy - ry), (cx + rx, cy + ry), ShapeStyle::Fill, [0, 0, 0, 255], Vec::new());
            path_obj(e.to_subs(), user)
        }
        "line" => match stroke {
            Some(s) => vec![obj("line", p.map(tag.len("x1"), tag.len("y1")), p.map(tag.len("x2"), tag.len("y2")), ShapeStyle::Fill, s, Vec::new())],
            None => Vec::new(),
        },
        "polygon" | "polyline" => {
            let v = nums(tag.get("points").unwrap_or(""));
            let raw: Vec<(f32, f32)> = v.chunks_exact(2).map(|c| (c[0], c[1])).collect();
            if raw.len() < 2 {
                return Vec::new();
            }
            let user = bounds(&raw);
            let pts: Vec<(f32, f32)> = raw.iter().map(|&(x, y)| p.map(x, y)).collect();
            let (first, last) = (pts[0], pts[pts.len() - 1]);
            if tag.name == "polygon" {
                return closed("path", first, last, pts, user);
            }
            // polyligne : remplissage éventuel (fermé), puis trait ouvert
            let mut out = Vec::new();
            if fill.is_some() && pts.len() >= 3 {
                let saved = stroke;
                out.extend(closed("path", first, last, pts.clone(), user).into_iter().filter(|o| o.style == ShapeStyle::Fill || saved.is_none()));
            }
            if let Some(s) = stroke {
                out.push(obj("polyline", first, last, ShapeStyle::Fill, s, pts));
            }
            out
        }
        // chemin : un objet « path » (contours séparés, trous pair-impair) pour le remplissage,
        // une polyligne coupée (contours fermés refermés) pour le trait
        "path" => {
            let subs = path_subs(tag.get("d").unwrap_or(""));
            if subs.is_empty() {
                return Vec::new();
            }
            let raw: Vec<(f32, f32)> = subs.iter().flat_map(|c| c.flatten()).collect();
            path_obj(subs, bounds(&raw))
        }
        _ => Vec::new(),
    }
}

/// Cadre (x, y, largeur, hauteur) d'une liste de points.
fn bounds(pts: &[(f32, f32)]) -> (f32, f32, f32, f32) {
    let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
    for &(x, y) in pts {
        (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
    }
    (x0, y0, (x1 - x0).max(1e-3), (y1 - y0).max(1e-3))
}

/// Dégradé lu dans le fichier : linéaire ou radial, attributs, arrêts, lien vers un autre
/// dégradé (href) dont il reprend les arrêts et attributs manquants.
#[derive(Clone, Default)]
struct GradDef {
    radial: bool,
    attrs: Vec<(String, String)>,
    stops: Vec<(f32, [u8; 4])>,
    href: Option<String>,
}

impl GradDef {
    fn attr(&self, k: &str) -> Option<&str> {
        self.attrs.iter().find(|(n, _)| n == k).map(|(_, v)| v.as_str())
    }

    /// Dégradé en pixels du document pour un élément de cadre `user` (son repère).
    fn resolve(&self, p: &Pres, user: (f32, f32, f32, f32)) -> crate::vector::Grad {
        let bbox_units = self.attr("gradientUnits") != Some("userSpaceOnUse");
        // valeur : nombre, ou pourcentage (fraction du cadre)
        let val = |k: &str, def: f32| -> f32 {
            match self.attr(k).map(|v| v.trim()) {
                Some(v) if v.ends_with('%') => v.trim_end_matches('%').parse::<f32>().map(|f| f / 100.0).unwrap_or(def),
                Some(v) => v.parse::<f32>().unwrap_or(def),
                None => def,
            }
        };
        // transformation propre au dégradé (gradientTransform)
        let mut gm = Pres::default();
        if let Some(t) = self.attr("gradientTransform") {
            let tag = Tag { name: "g".into(), attrs: vec![("transform".into(), t.to_string())], close: false, self_close: true };
            apply_pres(&mut gm, &tag);
        }
        let to_doc = |x: f32, y: f32| {
            let (gx, gy) = gm.map(x, y);
            let (ux, uy) = if bbox_units { (user.0 + gx * user.2, user.1 + gy * user.3) } else { (gx, gy) };
            p.map(ux, uy)
        };
        let (radial, p0, p1) = if self.radial {
            let (cx, cy, r) = (val("cx", 0.5), val("cy", 0.5), val("r", 0.5));
            (true, to_doc(cx, cy), to_doc(cx + r, cy))
        } else {
            (false, to_doc(val("x1", 0.0), val("y1", 0.0)), to_doc(val("x2", 1.0), val("y2", 0.0)))
        };
        let a = p.opacity * p.fill_opacity;
        let stops = self.stops.iter().map(|&(t, c)| (t, faded(c, a))).collect();
        crate::vector::Grad { radial, p0, p1, stops }
    }
}

/// Dégradés du fichier (linéaires et radiaux, liens href résolus), par identifiant.
fn collect_gradients(all: &[Tag]) -> std::collections::HashMap<String, GradDef> {
    let mut map: std::collections::HashMap<String, GradDef> = std::collections::HashMap::new();
    let mut cur: Option<String> = None;
    for t in all {
        match t.name.as_str() {
            "linearGradient" | "radialGradient" if t.close => cur = None,
            "linearGradient" | "radialGradient" => {
                let id = t.get("id").unwrap_or("").to_string();
                let href = t.get("href").or(t.get("xlink:href")).map(|h| h.trim_start_matches('#').to_string());
                map.insert(id.clone(), GradDef { radial: t.name == "radialGradient", attrs: t.attrs.clone(), stops: Vec::new(), href });
                cur = if t.self_close { None } else { Some(id) };
            }
            "stop" if !t.close => {
                let Some(def) = cur.as_ref().and_then(|id| map.get_mut(id)) else { continue };
                let mut props: Vec<(String, String)> = t.attrs.clone();
                if let Some(style) = t.get("style") {
                    for decl in style.split(';') {
                        if let Some((k, v)) = decl.split_once(':') {
                            props.push((k.trim().to_string(), v.trim().to_string()));
                        }
                    }
                }
                let get = |k: &str| props.iter().rev().find(|(n, _)| n == k).map(|(_, v)| v.clone());
                let off = get("offset").map(|v| {
                    let v = v.trim().to_string();
                    if let Some(pct) = v.strip_suffix('%') { pct.parse::<f32>().unwrap_or(0.0) / 100.0 } else { v.parse::<f32>().unwrap_or(0.0) }
                }).unwrap_or(0.0).clamp(0.0, 1.0);
                let col = get("stop-color").and_then(|c| parse_color(&c)).flatten().unwrap_or([0, 0, 0, 255]);
                let op = get("stop-opacity").and_then(|o| o.trim().parse::<f32>().ok()).unwrap_or(1.0);
                // arrêts dans l'ordre : un arrêt plus tôt que le précédent est ramené à lui
                let off = def.stops.last().map_or(off, |l| off.max(l.0));
                def.stops.push((off, faded(col, op)));
            }
            _ => {}
        }
    }
    // liens : arrêts et attributs manquants repris du dégradé visé (une chaîne de quelques liens)
    for _ in 0..4 {
        let snapshot = map.clone();
        for def in map.values_mut() {
            let Some(src) = def.href.as_ref().and_then(|h| snapshot.get(h)) else { continue };
            if def.stops.is_empty() {
                def.stops = src.stops.clone();
            }
            for (k, v) in &src.attrs {
                if k != "id" && k != "href" && k != "xlink:href" && !def.attrs.iter().any(|(n, _)| n == k) {
                    def.attrs.push((k.clone(), v.clone()));
                }
            }
        }
    }
    map
}

/// Contours d'un chemin SVG (`d`), courbes gardées telles quelles (arcs changés en Béziers
/// équivalentes). Coordonnées du fichier (transformation appliquée ensuite).
fn path_subs(d: &str) -> Vec<SubPath> {
    // jetons : lettres de commande et nombres (« 1.5.5 », « -3e-2 », drapeaux d'arc collés)
    let mut toks: Vec<Result<char, f32>> = Vec::new();
    let b = d.as_bytes();
    let mut i = 0;
    while i < b.len() {
        let c = b[i] as char;
        if c.is_ascii_alphabetic() && c != 'e' && c != 'E' {
            toks.push(Ok(c));
            i += 1;
        } else if c.is_ascii_digit() || c == '-' || c == '+' || c == '.' {
            let st = i;
            let mut dot = c == '.';
            i += 1;
            while i < b.len() {
                let ch = b[i] as char;
                if ch.is_ascii_digit() {
                    i += 1;
                } else if ch == '.' && !dot {
                    dot = true;
                    i += 1;
                } else if (ch == 'e' || ch == 'E') && i + 1 < b.len() {
                    i += 1;
                    if b[i] == b'-' || b[i] == b'+' {
                        i += 1;
                    }
                } else {
                    break;
                }
            }
            toks.push(Err(d[st..i].parse().unwrap_or(0.0)));
        } else {
            i += 1;
        }
    }
    let mut rings: Vec<SubPath> = Vec::new();
    let mut cur: Vec<Node> = Vec::new();
    let (mut x, mut y, mut sx, mut sy) = (0.0f32, 0.0f32, 0.0f32, 0.0f32);
    // dernier point de contrôle (S / T)
    let mut ctrl: Option<(f32, f32)> = None;
    let mut cmd = 'M';
    let mut k = 0;
    let flush = |cur: &mut Vec<Node>, closed: bool, rings: &mut Vec<SubPath>| {
        if cur.len() >= 2 {
            let mut nodes = std::mem::take(cur);
            // retour au point de départ : ce dernier point et le premier ne font qu'un
            if closed && nodes.len() >= 3 && dist(nodes[nodes.len() - 1].p, nodes[0].p) < 1e-3 {
                if let Some(last) = nodes.pop() {
                    nodes[0].c_in = last.c_in;
                }
            }
            // poignées alignées : point lisse
            for n in &mut nodes {
                let (a, b) = ((n.c_in.0 - n.p.0, n.c_in.1 - n.p.1), (n.c_out.0 - n.p.0, n.c_out.1 - n.p.1));
                let (la, lb) = ((a.0 * a.0 + a.1 * a.1).sqrt(), (b.0 * b.0 + b.1 * b.1).sqrt());
                n.smooth = la > 1e-3 && lb > 1e-3 && (a.0 * b.0 + a.1 * b.1) / (la * lb) < -0.999;
            }
            rings.push(SubPath { nodes, closed });
        } else {
            cur.clear();
        }
    };
    let curve = |cur: &mut Vec<Node>, c1: (f32, f32), c2: (f32, f32), p: (f32, f32)| {
        if let Some(l) = cur.last_mut() {
            l.c_out = c1;
        }
        cur.push(Node { p, c_in: c2, c_out: p, smooth: false });
    };
    while k < toks.len() {
        if let Ok(c) = toks[k] {
            cmd = c;
            k += 1;
            if c == 'Z' || c == 'z' {
                x = sx;
                y = sy;
                flush(&mut cur, true, &mut rings);
                ctrl = None;
                continue;
            }
        }
        let rel = cmd.is_ascii_lowercase();
        let n = match cmd.to_ascii_uppercase() {
            'M' | 'L' | 'T' => 2,
            'H' | 'V' => 1,
            'S' | 'Q' => 4,
            'C' => 6,
            'A' => 7,
            _ => {
                k += 1;
                continue;
            }
        };
        let mut v = [0.0f32; 7];
        let mut got = 0;
        while got < n && k < toks.len() {
            match toks[k] {
                Err(f) => {
                    v[got] = f;
                    got += 1;
                    k += 1;
                }
                Ok(_) => break,
            }
        }
        if got < n {
            break;
        }
        let (ox, oy) = if rel { (x, y) } else { (0.0, 0.0) };
        match cmd.to_ascii_uppercase() {
            'M' => {
                flush(&mut cur, false, &mut rings);
                (x, y) = (v[0] + ox, v[1] + oy);
                (sx, sy) = (x, y);
                cur.push(Node::corner((x, y)));
                ctrl = None;
                // coordonnées suivantes d'un M : des L
                cmd = if rel { 'l' } else { 'L' };
            }
            'L' => {
                let start = (x, y);
                (x, y) = (v[0] + ox, v[1] + oy);
                if cur.is_empty() {
                    cur.push(Node::corner(start));
                }
                cur.push(Node::corner((x, y)));
                ctrl = None;
            }
            'H' => {
                let start = (x, y);
                x = v[0] + ox;
                if cur.is_empty() {
                    cur.push(Node::corner(start));
                }
                cur.push(Node::corner((x, y)));
                ctrl = None;
            }
            'V' => {
                let start = (x, y);
                y = v[0] + if rel { y } else { 0.0 };
                if cur.is_empty() {
                    cur.push(Node::corner(start));
                }
                cur.push(Node::corner((x, y)));
                ctrl = None;
            }
            'C' | 'S' => {
                let (c1, c2, p) = if cmd.to_ascii_uppercase() == 'C' {
                    ((v[0] + ox, v[1] + oy), (v[2] + ox, v[3] + oy), (v[4] + ox, v[5] + oy))
                } else {
                    let c1 = ctrl.map_or((x, y), |c| (2.0 * x - c.0, 2.0 * y - c.1));
                    (c1, (v[0] + ox, v[1] + oy), (v[2] + ox, v[3] + oy))
                };
                if cur.is_empty() {
                    cur.push(Node::corner((x, y)));
                }
                curve(&mut cur, c1, c2, p);
                ctrl = Some(c2);
                (x, y) = p;
            }
            'Q' | 'T' => {
                let (q, p) = if cmd.to_ascii_uppercase() == 'Q' {
                    ((v[0] + ox, v[1] + oy), (v[2] + ox, v[3] + oy))
                } else {
                    (ctrl.map_or((x, y), |c| (2.0 * x - c.0, 2.0 * y - c.1)), (v[0] + ox, v[1] + oy))
                };
                if cur.is_empty() {
                    cur.push(Node::corner((x, y)));
                }
                // quadratique → cubique
                let c1 = (x + 2.0 / 3.0 * (q.0 - x), y + 2.0 / 3.0 * (q.1 - y));
                let c2 = (p.0 + 2.0 / 3.0 * (q.0 - p.0), p.1 + 2.0 / 3.0 * (q.1 - p.1));
                curve(&mut cur, c1, c2, p);
                ctrl = Some(q);
                (x, y) = p;
            }
            'A' => {
                let p = (v[5] + ox, v[6] + oy);
                if cur.is_empty() {
                    cur.push(Node::corner((x, y)));
                }
                for (c1, c2, q) in arc_cubics((x, y), v[0], v[1], v[2], v[3] != 0.0, v[4] != 0.0, p) {
                    curve(&mut cur, c1, c2, q);
                }
                (x, y) = p;
                ctrl = None;
            }
            _ => {}
        }
    }
    flush(&mut cur, false, &mut rings);
    rings
}

/// Arc elliptique SVG (paramètres d'extrémités) en courbes de Bézier (une par quart de tour au
/// plus) : (poignée 1, poignée 2, point).
fn arc_cubics(p0: (f32, f32), rx: f32, ry: f32, rot_deg: f32, large: bool, sweep: bool, p1: (f32, f32)) -> Vec<((f32, f32), (f32, f32), (f32, f32))> {
    let (mut rx, mut ry) = (rx.abs(), ry.abs());
    if rx < 1e-6 || ry < 1e-6 || (p0.0 - p1.0).abs() + (p0.1 - p1.1).abs() < 1e-6 {
        return vec![(p0, p1, p1)];
    }
    let phi = rot_deg.to_radians();
    let (sp, cp) = phi.sin_cos();
    let (dx, dy) = ((p0.0 - p1.0) / 2.0, (p0.1 - p1.1) / 2.0);
    let (x1, y1) = (cp * dx + sp * dy, -sp * dx + cp * dy);
    let l = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry);
    if l > 1.0 {
        rx *= l.sqrt();
        ry *= l.sqrt();
    }
    let num = (rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1).max(0.0);
    let den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
    let mut co = if den > 0.0 { (num / den).sqrt() } else { 0.0 };
    if large == sweep {
        co = -co;
    }
    let (cx1, cy1) = (co * rx * y1 / ry, -co * ry * x1 / rx);
    let (cx, cy) = (cp * cx1 - sp * cy1 + (p0.0 + p1.0) / 2.0, sp * cx1 + cp * cy1 + (p0.1 + p1.1) / 2.0);
    let ang = |ux: f32, uy: f32, vx: f32, vy: f32| {
        let a = (ux * vy - uy * vx).atan2(ux * vx + uy * vy);
        a
    };
    let t1 = ang(1.0, 0.0, (x1 - cx1) / rx, (y1 - cy1) / ry);
    let mut dt = ang((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry);
    if !sweep && dt > 0.0 {
        dt -= std::f32::consts::TAU;
    } else if sweep && dt < 0.0 {
        dt += std::f32::consts::TAU;
    }
    let steps = ((dt.abs() / std::f32::consts::FRAC_PI_2 - 1e-4).ceil() as usize).max(1);
    let delta = dt / steps as f32;
    let k = 4.0 / 3.0 * (delta / 4.0).tan();
    let at = |t: f32| {
        let (st, ct) = t.sin_cos();
        (cx + cp * rx * ct - sp * ry * st, cy + sp * rx * ct + cp * ry * st)
    };
    let tangent = |t: f32| {
        let (st, ct) = t.sin_cos();
        (-cp * rx * st - sp * ry * ct, -sp * rx * st + cp * ry * ct)
    };
    (0..steps)
        .map(|s| {
            let (a, b) = (t1 + delta * s as f32, t1 + delta * (s + 1) as f32);
            let (e0, d0, e1, d1) = (at(a), tangent(a), at(b), tangent(b));
            let end = if s + 1 == steps { p1 } else { e1 };
            ((e0.0 + k * d0.0, e0.1 + k * d0.1), (end.0 - k * d1.0, end.1 - k * d1.1), end)
        })
        .collect()
}

/// Découpage d'un SVG ouvert (fenêtre de choix, comme la version HTML).
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum SvgMode {
    /// tous les éléments sur un seul calque SVG
    Single,
    /// un calque SVG par élément (ou groupe) racine
    Split,
    /// grille d'icônes : chaque <symbol> (type illu-sprite.svg) dans une case, nom dessous
    Sprite,
}

/// Le fichier contient des symboles (feuille d'icônes) : la grille est proposée en premier.
pub fn has_symbols(bytes: &[u8]) -> bool {
    String::from_utf8_lossy(bytes).matches("<symbol").count() >= 2
}

/// Lit un fichier SVG en un seul calque (voir `import_with`).
#[cfg(test)]
pub fn import(name: &str, bytes: &[u8]) -> Result<crate::illu::Loaded, String> {
    import_with(name, bytes, SvgMode::Single)
}

/// Lit un fichier SVG : un document (nouvel onglet) avec un calque vectoriel. Les éléments
/// non repris sont comptés dans `skipped`.
pub fn import_with(name: &str, bytes: &[u8], mode: SvgMode) -> Result<crate::illu::Loaded, String> {
    let src = String::from_utf8_lossy(bytes);
    let all = tags(&src);
    if !all.iter().any(|t| t.name == "svg" && !t.close) {
        return Err(format!("« {name} » n'est pas un fichier SVG lisible"));
    }
    // grille d'icônes : cases de 96 px (icône de 48 px, nom dessous), 12 par rangée
    const CELL: f32 = 96.0;
    const ICON: f32 = 48.0;
    const COLS: usize = 12;
    let symbols = all.iter().filter(|t| t.name == "symbol" && !t.close).count();
    let sprite = mode == SvgMode::Sprite && symbols > 0;
    let mut size: Option<(usize, usize)> = None;
    if sprite {
        let rows = symbols.div_ceil(COLS);
        size = Some(((COLS.min(symbols) as f32 * CELL) as usize, (rows as f32 * CELL) as usize));
    }
    let mut sym_k = 0usize;
    let grads = collect_gradients(&all);
    let mut labels: Vec<Obj> = Vec::new();
    // calque de chaque objet : élément racine (enfant direct du <svg>) ou case de la grille
    let mut group = 0usize;
    let mut group_names: Vec<String> = Vec::new();
    let mut cur = Pres::default();
    // présentation à rendre à la fermeture de chaque élément ouvert
    let mut stack: Vec<(String, Pres)> = Vec::new();
    let mut objects: Vec<(usize, Obj)> = Vec::new();
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
        // élément racine (sous le <svg> principal) : nouveau groupe, donc nouveau calque en
        // mode « un calque par élément »
        if stack.len() == 1 && !sprite {
            group = group_names.len();
            let label = tag.get("id").map(|i| i.to_string()).unwrap_or_else(|| match tag.name.as_str() {
                "g" => format!("Groupe {}", group + 1),
                "path" => format!("Tracé {}", group + 1),
                n => format!("{n} {}", group + 1),
            });
            group_names.push(label);
        }
        if sprite && tag.name == "symbol" {
            // symbole : posé dans sa case (viewBox ramené à l'icône), même s'il est dans <defs>
            let (cx, cy) = ((sym_k % COLS) as f32 * CELL, (sym_k / COLS) as f32 * CELL);
            let vb = tag.get("viewBox").map(nums).filter(|v| v.len() == 4 && v[2] > 0.0 && v[3] > 0.0).unwrap_or(vec![0.0, 0.0, 16.0, 16.0]);
            let sc = ICON / vb[2].max(vb[3]);
            p = Pres::default();
            p.then((sc, sc, cx + (CELL - vb[2] * sc) / 2.0 - vb[0] * sc, cy + 10.0 - vb[1] * sc));
            let id = tag.get("id").unwrap_or("").trim_start_matches("illu-icon-").to_string();
            labels.push(Obj::Text(crate::vector::TextObj {
                text: id.clone(),
                font: String::new(),
                size: 11.0,
                color: [0x47, 0x55, 0x69, 255],
                align: 0,
                antialias: true,
                x: cx + 6.0,
                y: cy + 66.0,
                m: None,
            }));
            group = sym_k;
            group_names.push(if id.is_empty() { format!("Icône {}", sym_k + 1) } else { id });
            sym_k += 1;
        }
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
            // petit dessin (icône de 16 à 512 px) : document agrandi à 1536 px de côté, pour que
            // ses objets restent nets à l'écran (le calque est rendu à la taille du document)
            let k = (1536.0 / w.max(h)).max(1.0);
            let (w, h) = (w * k, h * k);
            // avec un viewBox, sa mise à l'échelle sur la taille agrandie suffit ; sinon les unités
            // du fichier sont des pixels : même agrandissement pour elles
            if k > 1.0 && vb.is_none() {
                p.then((k, k, 0.0, 0.0));
            }
            if let Some(v) = &vb {
                // x' = s·x + t (échelle uniforme, contenu centré)
                let s = (w / v[2]).min(h / v[3]);
                p.then((s, s, (w - v[2] * s) / 2.0 - v[0] * s, (h - v[3] * s) / 2.0 - v[1] * s));
            }
            size = Some(((w.round() as usize).clamp(1, 8192), (h.round() as usize).clamp(1, 8192)));
        }
        let transform_ok = apply_pres(&mut p, tag);
        match tag.name.as_str() {
            "rect" | "circle" | "ellipse" | "line" | "polygon" | "polyline" | "path" if !p.hidden => {
                if !transform_ok {
                    note("transformation inconnue (forme posée sans elle)");
                }
                objects.extend(shapes(tag, &p, &grads).into_iter().map(|s| (group, Obj::Shape(s))));
            }
            "svg" | "g" | "a" | "switch" => {
                if !transform_ok && !p.hidden {
                    note("transformation inconnue (forme posée sans elle)");
                }
            }
            // définitions et métadonnées : jamais dessinées telles quelles
            // symbole en grille d'icônes : dessiné dans sa case
            "symbol" if sprite => {}
            "defs" if sprite => {}
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
    let mut fonts = crate::text::Fonts::default();
    let mut doc = Doc::new(w, h, [0, 0, 0, 0], name);
    // calques SVG : un seul, un par élément racine (ordre du fichier, le premier en bas), ou la
    // grille (icônes + noms)
    let mut layers: Vec<(String, Vec<Obj>)> = Vec::new();
    match mode {
        SvgMode::Split if !sprite && group_names.len() > 1 => {
            for (g, gname) in group_names.iter().enumerate() {
                let objs: Vec<Obj> = objects.iter().filter(|(k, _)| *k == g).map(|(_, o)| o.clone()).collect();
                if !objs.is_empty() {
                    layers.push((gname.clone(), objs));
                }
            }
        }
        _ if sprite => {
            layers.push(("Icônes".into(), objects.into_iter().map(|(_, o)| o).collect()));
            layers.push(("Noms".into(), labels));
        }
        _ => layers.push(("Vecteur 1".into(), objects.into_iter().map(|(_, o)| o).collect())),
    }
    if layers.is_empty() {
        layers.push(("Vecteur 1".into(), Vec::new()));
    }
    for (i, (lname, objs)) in layers.into_iter().enumerate() {
        if i > 0 {
            doc.add_layer_in();
        }
        let v = VectorLayer { objects: objs, effects: Vec::new(), serial: 0 };
        let px = v.render_objects(&mut fonts, w, h);
        let l = doc.layer_mut();
        l.name = lname;
        l.px = px.into();
        l.vector = Some(Box::new(v));
    }
    // un fichier SVG ouvert est un projet SVG : aucun pixel, objets natifs
    doc.vector_mode = true;
    // une seule étape : l'état ouvert
    doc.history.clear();
    doc.commit("Ouvrir le SVG");
    let mut skipped: Vec<String> = ignored.into_iter().map(|(what, k)| if k > 1 { format!("{k} × {what}") } else { what }).collect();
    if n == 0 {
        skipped.insert(0, "aucune forme (rect, circle, ellipse, line, polygon, polyline, path)".to_string());
    }
    Ok(crate::illu::Loaded { docs: vec![doc], skipped })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Rendu de fichiers SVG réels (MP_SVG = chemins séparés par « | ») en PNG dans MP_OUT, pour
    /// les comparer à un autre moteur : `cargo test --lib svg_look -- --ignored`.
    #[test]
    #[ignore]
    fn svg_look() {
        let out = std::env::var("MP_OUT").expect("MP_OUT");
        for path in std::env::var("MP_SVG").expect("MP_SVG").split('|') {
            let bytes = std::fs::read(path).unwrap();
            let t = std::time::Instant::now();
            let mode = if has_symbols(&bytes) { SvgMode::Sprite } else { SvgMode::Single };
            let l = import_with(path, &bytes, mode).unwrap();
            let d = &l.docs[0];
            let flat = d.flatten();
            let name = std::path::Path::new(path).file_stem().unwrap().to_string_lossy().to_string();
            image::save_buffer(format!("{out}/{name}.png"), &flat, d.w as u32, d.h as u32, image::ColorType::Rgba8).unwrap();
            // référence : resvg (moteur SVG de Slint) à la même taille
            if let Ok(tree) = resvg::usvg::Tree::from_data(&bytes, &resvg::usvg::Options::default()) {
                let mut pm = resvg::tiny_skia::Pixmap::new(d.w as u32, d.h as u32).unwrap();
                let sz = tree.size();
                let k = (d.w as f32 / sz.width()).min(d.h as f32 / sz.height());
                resvg::render(&tree, resvg::tiny_skia::Transform::from_scale(k, k), &mut pm.as_mut());
                pm.save_png(format!("{out}/ref_{name}.png")).unwrap();
            }
            eprintln!("{name} : {}×{} en {:?}, non repris {:?}", d.w, d.h, t.elapsed(), l.skipped);
        }
    }

    /// Formes simples et chemins repris (viewBox, groupe, style), définitions exclues.
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
        // petit SVG agrandi à l'ouverture (proportions gardées)
        assert_eq!(d.w * 100, d.h * 200);
        let v = d.layers[0].vector.as_deref().unwrap();
        assert_eq!(v.objects.len(), 5, "rect, cercle, ligne, polyligne, chemin (defs exclus)");
        match &v.objects[4] {
            Obj::Shape(s) => assert_eq!(s.kind, "path"),
            _ => panic!("chemin attendu"),
        }
        match &v.objects[0] {
            Obj::Shape(s) => {
                assert_eq!(s.kind, "rect");
                assert_eq!(s.color, [255, 0, 0, 255]);
                let k = d.w as f32 / 100.0;
                assert_eq!(s.a, (10.0 * k, 5.0 * k), "translate puis échelle");
                assert_eq!(s.b, (30.0 * k, 15.0 * k));
            }
            _ => panic!("forme attendue"),
        }
        match &v.objects[1] {
            Obj::Shape(s) => {
                assert_eq!(s.style, ShapeStyle::Outline);
                assert_eq!(s.color, [0, 0, 255, 255]);
                assert_eq!(s.width, 2.0 * d.w as f32 / 100.0);
            }
            _ => panic!("forme attendue"),
        }
        assert!(!l.skipped.iter().any(|s| s.contains("<path>")), "{:?}", l.skipped);
        assert!(d.layers[0].px.iter().skip(3).step_by(4).any(|a| *a > 0), "rendu fait");
    }

    /// Un `<path>` garde ses courbes (pas de découpage en petits segments), arcs compris.
    #[test]
    fn path_keeps_bezier_nodes() {
        let svg = br##"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="M10 10 C20 0 40 0 50 10 A20 20 0 0 1 90 10 Z" fill="#f00" stroke="#00f"/></svg>"##;
        let l = import("essai.svg", svg).unwrap();
        let d = &l.docs[0];
        assert!(d.vector_mode, "un SVG ouvert est un projet SVG");
        let Some(Obj::Shape(s)) = d.layers[0].vector.as_ref().and_then(|v| v.objects.first()) else { panic!() };
        assert_eq!(s.kind, "path");
        assert!(s.subs[0].closed);
        assert!(s.subs[0].nodes.len() <= 5, "{} points", s.subs[0].nodes.len());
        // petit SVG agrandi à l'ouverture : mêmes points, à l'échelle du document
        let k = d.w as f32 / 100.0;
        assert_eq!(s.subs[0].nodes[0].c_out, (20.0 * k, 0.0));
        assert_eq!(s.style, ShapeStyle::Both);
        assert_eq!(s.fill, Some([255, 0, 0, 255]));
        assert_eq!(d.layers.iter().filter(|l| l.vector.is_none()).count(), 0, "aucun calque de pixels");
    }
}
