// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Moteur vectoriel du mode SVG : trace les objets (contours exacts, traits, dégradés, texte en
//! vraies courbes de la police) dans une image à la résolution demandée. Aucune géométrie n'est
//! découpée ni rééchantillonnée à l'avance : un même objet est net à tous les zooms, et le rendu
//! des calques (`ShapeObj::paint`) passe par les mêmes tracés que l'affichage.

use crate::paint::ShapeStyle;
use crate::text::Fonts;
use crate::vector::{self, Obj, ShapeObj, SubPath, TextObj};
use tiny_skia::{Color, FillRule, GradientStop, LineCap, LineJoin, LinearGradient, Paint, Path, PathBuilder, Pixmap, PixmapMut, Point, RadialGradient, SpreadMode, Stroke, StrokeDash, Transform};

/// Contours → tracé.
pub fn path_of(subs: &[SubPath]) -> Option<Path> {
    let mut b = PathBuilder::new();
    for s in subs {
        let Some(first) = s.nodes.first() else { continue };
        b.move_to(first.p.0, first.p.1);
        for (_, p0, c1, c2, p1) in s.segments() {
            if c1 == p0 && c2 == p1 {
                b.line_to(p1.0, p1.1);
            } else {
                b.cubic_to(c1.0, c1.1, c2.0, c2.1, p1.0, p1.1);
            }
        }
        if s.closed {
            b.close();
        }
    }
    b.finish()
}

fn solid(c: [u8; 4]) -> Paint<'static> {
    let mut p = Paint::default();
    p.set_color_rgba8(c[0], c[1], c[2], c[3]);
    p.anti_alias = true;
    p
}

fn polygon(pts: &[(f32, f32)]) -> Option<Path> {
    let (first, rest) = pts.split_first()?;
    let mut b = PathBuilder::new();
    b.move_to(first.0, first.1);
    for p in rest {
        b.line_to(p.0, p.1);
    }
    b.close();
    b.finish()
}

/// Peinture du remplissage : dégradé (qui suit la rotation de la forme) ou couleur unie.
fn fill_paint(s: &ShapeObj) -> Paint<'static> {
    let fallback = s.fill.unwrap_or(s.color);
    let Some(g) = s.grad.as_deref() else { return solid(fallback) };
    let stops: Vec<GradientStop> = g.stops.iter().map(|(t, c)| GradientStop::new(*t, Color::from_rgba8(c[0], c[1], c[2], c[3]))).collect();
    let (p0, p1) = (Point::from_xy(g.p0.0, g.p0.1), Point::from_xy(g.p1.0, g.p1.1));
    let shader = if g.radial {
        RadialGradient::new(p0, 0.0, p0, vector::dist(g.p0, g.p1).max(1e-3), stops, SpreadMode::Pad, Transform::identity())
    } else {
        LinearGradient::new(p0, p1, stops, SpreadMode::Pad, Transform::identity())
    };
    let mut paint = solid(fallback);
    if let Some(shader) = shader {
        paint.shader = shader;
    }
    paint
}

/// Trace une forme ; `view` : document → image.
pub fn draw_shape(pm: &mut PixmapMut, s: &ShapeObj, view: Transform) {
    let t = if s.rot != 0.0 {
        let c = s.center();
        view.pre_concat(Transform::from_rotate_at(s.rot.to_degrees(), c.0, c.1))
    } else {
        view
    };
    let lw = s.width.max(0.01);
    if s.is_stroke_only() {
        return draw_line(pm, s, t, lw);
    }
    let subs = s.to_subs();
    let Some(path) = path_of(&subs) else { return };
    if s.fill.is_some() || s.grad.is_some() || s.style != ShapeStyle::Outline {
        let rule = if s.kind == "path" { FillRule::EvenOdd } else { FillRule::Winding };
        pm.fill_path(&path, &fill_paint(s), rule, t, None);
    }
    if s.style != ShapeStyle::Fill {
        // tracé à main levée, SVG à bouts ronds : bouts et angles arrondis ; sinon comme le SVG
        let round = s.kind == "path" && s.cap_start == 1;
        let stroke = Stroke {
            width: lw,
            miter_limit: 4.0,
            line_cap: if round { LineCap::Round } else { LineCap::Butt },
            line_join: if round { LineJoin::Round } else { LineJoin::Miter },
            dash: dash_of(s.dash, lw),
        };
        pm.stroke_path(&path, &solid(s.color), &stroke, t, None);
    }
}

fn dash_of(kind: u8, lw: f32) -> Option<StrokeDash> {
    match kind {
        1 => StrokeDash::new(vec![lw * 3.0, lw * 2.0], 0.0),
        2 => StrokeDash::new(vec![0.01, lw * 2.0], 0.0),
        _ => None,
    }
}

/// Ligne, courbe ou polyligne : bouts réglables, tirets, flèches et losanges.
fn draw_line(pm: &mut PixmapMut, s: &ShapeObj, t: Transform, lw: f32) {
    let mut subs = s.to_subs();
    let sampled = s.stroke_path();
    let caps = if s.kind != "polyline" && sampled.len() >= 2 { s.caps(&sampled) } else { [None, None] };
    // le trait s'arrête sous une flèche (sinon il dépasse de la pointe)
    if let Some(sub) = subs.first_mut().filter(|c| c.nodes.len() >= 2) {
        let last = sub.nodes.len() - 1;
        for (end, cap) in caps.iter().enumerate() {
            let Some((_, _, inset)) = cap else { continue };
            let (i, next) = if end == 0 { (0, sampled[1]) } else { (last, sampled[sampled.len() - 2]) };
            let n = &mut sub.nodes[i];
            let l = vector::dist(n.p, next);
            if *inset > 0.0 && l > 1e-3 {
                let k = (inset / l).min(0.95);
                let d = ((next.0 - n.p.0) * k, (next.1 - n.p.1) * k);
                n.p = (n.p.0 + d.0, n.p.1 + d.1);
                n.c_in = (n.c_in.0 + d.0, n.c_in.1 + d.1);
                n.c_out = (n.c_out.0 + d.0, n.c_out.1 + d.1);
            }
        }
    }
    let paint = solid(s.color);
    let round = s.cap_start != 0 && s.cap_end != 0;
    let dash = dash_of(s.dash, lw);
    let stroke = Stroke {
        width: lw,
        miter_limit: 4.0,
        line_cap: if round || s.dash == 2 { LineCap::Round } else { LineCap::Butt },
        line_join: LineJoin::Round,
        dash,
    };
    if let Some(path) = path_of(&subs) {
        pm.stroke_path(&path, &paint, &stroke, t, None);
    }
    // un seul bout rond : le trait est coupé net, le rond posé à part
    if !round && s.dash == 0 {
        for (cap, p) in [(s.cap_start, sampled.first()), (s.cap_end, sampled.last())] {
            if let (1, Some(p)) = (cap, p) {
                if let Some(c) = PathBuilder::from_circle(p.0, p.1, lw / 2.0) {
                    pm.fill_path(&c, &paint, FillRule::Winding, t, None);
                }
            }
        }
    }
    for (pts, hollow, _) in caps.into_iter().flatten() {
        let Some(path) = polygon(&pts) else { continue };
        if hollow {
            let outline = Stroke { width: lw, line_join: LineJoin::Round, ..Stroke::default() };
            pm.stroke_path(&path, &paint, &outline, t, None);
        } else {
            pm.fill_path(&path, &paint, FillRule::Winding, t, None);
        }
    }
}

/// Trace un texte par ses contours.
pub fn draw_text(pm: &mut PixmapMut, fonts: &mut Fonts, o: &TextObj, view: Transform) {
    if o.text.trim().is_empty() {
        return;
    }
    let Some(font) = vector::font_for(fonts, &o.font) else { return };
    let Some(path) = crate::text::outline(&font, &o.text, o.size, o.x, o.y, o.align()) else { return };
    let t = match o.m {
        Some([a, b, c, d, e, f]) => view.pre_concat(Transform::from_row(a, b, c, d, e, f)),
        None => view,
    };
    pm.fill_path(&path, &solid(o.color), FillRule::Winding, t, None);
}

/// Trace un objet.
pub fn draw_obj(pm: &mut PixmapMut, fonts: &mut Fonts, o: &Obj, view: Transform) {
    match o {
        Obj::Shape(s) => draw_shape(pm, s, view),
        Obj::Text(t) => draw_text(pm, fonts, t, view),
    }
}

/// Pose `pm` (alpha prémultiplié, taille du rectangle `r`) sur `out` (pixels w de large, alpha
/// droit), par-dessus `base` si donné, sinon par-dessus le contenu de `out`.
pub fn blit(pm: &Pixmap, r: (usize, usize, usize, usize), base: Option<&[u8]>, out: &mut [u8], w: usize) {
    let rw = r.2 - r.0;
    let src = pm.data();
    for y in r.1..r.3 {
        let row = &src[(y - r.1) * rw * 4..(y - r.1 + 1) * rw * 4];
        let start = (y * w + r.0) * 4;
        let dst = &mut out[start..start + rw * 4];
        if let Some(b) = base {
            dst.copy_from_slice(&b[start..start + rw * 4]);
        }
        for (s, d) in row.chunks_exact(4).zip(dst.chunks_exact_mut(4)) {
            let sa = s[3] as u32;
            if sa == 0 {
                continue;
            }
            let inv = 255 - sa;
            let da = (d[3] as u32 * inv + 127) / 255;
            let ra = sa + da;
            for c in 0..3 {
                // prémultiplié source + destination pondérée, ramené en alpha droit
                d[c] = (((s[c] as u32 * 255 + d[c] as u32 * da) + ra / 2) / ra.max(1)).min(255) as u8;
            }
            d[3] = ra.min(255) as u8;
        }
    }
}
