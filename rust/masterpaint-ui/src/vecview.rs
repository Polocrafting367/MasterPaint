// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Affichage d'un projet SVG, comme un logiciel vectoriel : la toile n'est pas une image agrandie.
//! À chaque changement (objet, zoom, déplacement de la vue), les objets sont retracés à la
//! résolution de l'écran pour la seule partie visible : aucun pixel de document n'est visible,
//! quel que soit le zoom. `Layer::px` n'est plus qu'un cache interne (vignettes, export PNG,
//! effets), jamais affiché pour un calque d'objets.
//!
//! Seules exceptions, dessinées comme des images placées : calques de pixels importés et calques
//! portant des effets du menu (les effets sont des calculs sur des pixels). Un filtre dynamique ƒ
//! visible, ou une fenêtre d'effet ouverte, repasse la toile sur la composition en pixels.

use super::*;
use std::collections::HashMap;
use tiny_skia::{BlendMode, FilterQuality, Mask, MaskType, Paint, Pattern, Pixmap, PixmapPaint, Rect, SpreadMode, Stroke, Transform};

#[derive(Default)]
pub(crate) struct VecView {
    /// la toile est tracée ici (voir `wanted_mode`)
    pub on: bool,
    /// zone rendue (pixels du document) et échelle (pixels écran par pixel du document)
    rect: (f32, f32, f32, f32),
    scale: f32,
    dirty: bool,
    overlay_dirty: bool,
    overlay_shown: bool,
    /// durée du dernier rendu (ms) : espace les suivants quand le dessin est lourd
    cost: f32,
    timer: slint::Timer,
    /// calques de pixels convertis (alpha prémultiplié) ; None : entièrement transparent
    bitmaps: HashMap<u64, (std::sync::Weak<Vec<u8>>, Option<Pixmap>)>,
}

/// Couleur des tracés d'édition (cadres, points d'ancrage).
pub(crate) const ACCENT: [u8; 4] = [0x2f, 0x7b, 0xff, 255];

fn wanted_mode(st: &State) -> bool {
    st.doc.vector_mode
        && !st.empty
        && st.doc.mask_of.is_none()
        && st.effect.is_none()
        && st.curves.is_none()
        && !st.doc.layers.iter().enumerate().any(|(i, l)| l.dynamic.is_some() && st.doc.visible_at(i))
}

/// Choisit le mode d'affichage de la toile ; à appeler avant toute composition. Au retour sur la
/// composition en pixels, elle est refaite et envoyée.
pub(crate) fn sync_mode(app: &AppWindow, st: &mut State) {
    let on = wanted_mode(st);
    if on == st.vv.on {
        return;
    }
    st.vv.on = on;
    app.set_vec_on(on);
    if on {
        st.vv.dirty = true;
        upload_full(app, st);
    } else {
        app.set_vec_image(Image::default());
        app.set_vec_overlay(Image::default());
        st.vv.overlay_shown = false;
        st.vv.bitmaps.clear();
        compose_display(app, st);
        upload_full(app, st);
    }
}

/// Le contenu a changé : un rendu est demandé (regroupé avec les changements proches).
pub(crate) fn touch(app: &AppWindow, st: &mut State) {
    if st.vv.on {
        st.vv.dirty = true;
        arm(app, st);
    }
}

/// Seuls les tracés d'édition ont changé.
pub(crate) fn touch_overlay(app: &AppWindow, st: &mut State) {
    if st.vv.on {
        st.vv.overlay_dirty = true;
        arm(app, st);
    }
}

/// Zoom ou vue déplacés.
pub(crate) fn view_changed(app: &AppWindow, st: &mut State) {
    if st.vv.on {
        arm(app, st);
    }
}

fn arm(app: &AppWindow, st: &mut State) {
    if st.vv.timer.running() {
        return;
    }
    let delay = (st.vv.cost * 0.6).clamp(0.0, 120.0) as u64;
    let weak = app.as_weak();
    st.vv.timer.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(delay), move || {
        let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
        let Ok(mut st) = state.try_borrow_mut() else { return };
        flush(&app, &mut st);
    });
}

/// Rendu immédiat (changement de document, capture).
pub(crate) fn render_now(app: &AppWindow, st: &mut State) {
    if st.vv.on {
        st.vv.dirty = true;
        flush(app, st);
    }
}

/// Zone visible (pixels du document), bornée à la toile sauf « Hors toile ».
fn visible(app: &AppWindow, st: &State) -> Option<(f32, f32, f32, f32)> {
    let vr = app.get_visible_rect();
    let v: Vec<f32> = (0..4).filter_map(|i| vr.row_data(i)).collect();
    if v.len() < 4 || !v.iter().all(|x| x.is_finite()) || v[2] <= v[0] || v[3] <= v[1] {
        // vue pas encore connue : toute la toile
        return Some((0.0, 0.0, st.doc.w as f32, st.doc.h as f32));
    }
    if app.global::<ToolOpts>().get_outside_canvas() {
        return Some((v[0], v[1], v[2], v[3]));
    }
    let r = (v[0].max(0.0), v[1].max(0.0), v[2].min(st.doc.w as f32), v[3].min(st.doc.h as f32));
    (r.2 > r.0 && r.3 > r.1).then_some(r)
}

fn flush(app: &AppWindow, st: &mut State) {
    if !st.vv.on {
        return;
    }
    let scale = (app.get_zoom() * app.window().scale_factor()).max(1e-3);
    let vis = visible(app, st);
    let moved = vis.is_some_and(|v| {
        let r = st.vv.rect;
        (st.vv.scale - scale).abs() > scale * 1e-4 || v.0 < r.0 || v.1 < r.1 || v.2 > r.2 || v.3 > r.3
    });
    let mut drawn = false;
    if st.vv.dirty || moved {
        let t0 = now_ms();
        render(app, st, vis, scale);
        st.vv.cost = (now_ms() - t0) as f32;
        st.vv.dirty = false;
        drawn = true;
    }
    if st.vv.overlay_dirty || drawn {
        render_overlay(app, st);
        st.vv.overlay_dirty = false;
    }
}

/// Zone à rendre : la vue et une marge (déplacer la vue un peu ne demande pas de nouveau rendu),
/// calée sur les pixels de l'écran, dans la limite d'une texture.
fn rendered_rect(st: &State, app: &AppWindow, v: (f32, f32, f32, f32), s: f32) -> (f32, f32, f32, f32) {
    let (mx, my) = ((v.2 - v.0) * 0.15, (v.3 - v.1) * 0.15);
    let (mut x0, mut y0, mut x1, mut y1) = (v.0 - mx, v.1 - my, v.2 + mx, v.3 + my);
    if !app.global::<ToolOpts>().get_outside_canvas() {
        (x0, y0, x1, y1) = (x0.max(0.0), y0.max(0.0), x1.min(st.doc.w as f32), y1.min(st.doc.h as f32));
    }
    // marge retirée si la texture dépasserait la limite
    const MAX: f32 = 8192.0;
    if (x1 - x0) * s > MAX || (y1 - y0) * s > MAX {
        (x0, y0, x1, y1) = v;
    }
    let x1 = x1.min(x0 + MAX / s);
    let y1 = y1.min(y0 + MAX / s);
    ((x0 * s).floor() / s, (y0 * s).floor() / s, (x1 * s).ceil() / s, (y1 * s).ceil() / s)
}

/// Objet en cours de modification, dessiné à la place de sa version enregistrée (ou par-dessus
/// les objets du calque s'il est nouveau).
struct Live {
    layer: u64,
    at: Option<usize>,
    obj: vector::Obj,
}

fn live_objects(st: &State) -> Vec<Live> {
    let mut out = Vec::new();
    if let Some(ed) = &st.shape_edit {
        out.push(Live { layer: ed.layer, at: ed.obj, obj: vector::Obj::Shape(ed.shape.clone()) });
    }
    if let Some(ed) = &st.path_edit {
        out.push(Live { layer: ed.layer, at: ed.obj, obj: vector::Obj::Shape(ed.shape.clone()) });
    }
    // forme en train d'être tracée
    if st.shape_edit.is_none() && st.session.busy() {
        if let Some(s) = &st.session.last_shape {
            out.push(Live { layer: st.doc.layer().uid, at: None, obj: vector::Obj::Shape(s.clone()) });
        }
    }
    out
}

fn blend_mode(b: editor::Blend) -> BlendMode {
    use editor::Blend::*;
    match b {
        Normal => BlendMode::SourceOver,
        Multiply => BlendMode::Multiply,
        Screen => BlendMode::Screen,
        Overlay => BlendMode::Overlay,
        SoftLight => BlendMode::SoftLight,
        HardLight => BlendMode::HardLight,
        Darken => BlendMode::Darken,
        Lighten => BlendMode::Lighten,
        ColorDodge => BlendMode::ColorDodge,
        ColorBurn => BlendMode::ColorBurn,
        Difference => BlendMode::Difference,
        Exclusion => BlendMode::Exclusion,
        Hue => BlendMode::Hue,
        Saturation => BlendMode::Saturation,
        Color => BlendMode::Color,
        Luminosity => BlendMode::Luminosity,
    }
}

/// Tracé des calques, du bas vers le haut (dossier `parent`).
struct Scene<'a> {
    doc: &'a Doc,
    fonts: &'a mut text::Fonts,
    bitmaps: &'a mut HashMap<u64, (std::sync::Weak<Vec<u8>>, Option<Pixmap>)>,
    live: &'a [Live],
    view: Transform,
    size: (u32, u32),
    /// rectangle rendu (document), pour écarter les objets hors de la vue
    rect: (f32, f32, f32, f32),
    scale: f32,
}

impl Scene<'_> {
    fn range(&mut self, parent: u64, pm: &mut Pixmap) {
        for i in 0..self.doc.layers.len() {
            let doc = self.doc;
            let l = &doc.layers[i];
            if l.parent != parent || !l.visible || l.opacity <= 0.0 {
                continue;
            }
            if l.group && (l.pass || (l.opacity >= 0.999 && l.blend == editor::Blend::Normal)) {
                self.range(l.uid, pm);
                continue;
            }
            let plain = l.opacity >= 0.999 && l.blend == editor::Blend::Normal && l.mask.is_none();
            if plain {
                self.layer(l, pm);
                continue;
            }
            let Some(mut tmp) = Pixmap::new(self.size.0, self.size.1) else { continue };
            if l.group {
                self.range(l.uid, &mut tmp);
            } else {
                self.layer(l, &mut tmp);
            }
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == doc.w * doc.h) {
                self.apply_mask(m, &mut tmp);
            }
            let paint = PixmapPaint { opacity: l.opacity, blend_mode: blend_mode(l.blend), quality: FilterQuality::Nearest };
            pm.draw_pixmap(0, 0, tmp.as_ref(), &paint, Transform::identity(), None);
        }
    }

    fn layer(&mut self, l: &editor::Layer, pm: &mut Pixmap) {
        let r = self.rect;
        let vector = l.vector.as_deref().filter(|v| !v.has_effects());
        let Some(v) = vector else { return self.bitmap(l, pm) };
        let mut target = pm.as_mut();
        let live = self.live;
        let seen = |x0: f32, y0: f32, x1: f32, y1: f32| x1 >= r.0 && y1 >= r.1 && x0 <= r.2 && y0 <= r.3;
        let mut draw = |fonts: &mut text::Fonts, o: &vector::Obj, view: Transform| {
            if let vector::Obj::Shape(s) = o {
                let (x0, y0, x1, y1) = s.paint_bounds();
                if !seen(x0, y0, x1, y1) {
                    return;
                }
            }
            vecrender::draw_obj(&mut target, fonts, o, view);
        };
        for (i, o) in v.objects.iter().enumerate() {
            let o = live.iter().find(|e| e.layer == l.uid && e.at == Some(i)).map_or(o, |e| &e.obj);
            draw(self.fonts, o, self.view);
        }
        for e in live.iter().filter(|e| e.layer == l.uid && e.at.is_none_or(|i| i >= v.objects.len())) {
            draw(self.fonts, &e.obj, self.view);
        }
    }

    /// Calque de pixels (image placée, ou calque d'objets portant des effets).
    fn bitmap(&mut self, l: &editor::Layer, pm: &mut Pixmap) {
        let (w, h) = (self.doc.w, self.doc.h);
        if l.px.len() != w * h * 4 {
            return;
        }
        let fresh = self.bitmaps.get(&l.uid).is_none_or(|(k, _)| !l.px.is(k));
        if fresh {
            let empty = l.px.chunks_exact(4).all(|p| p[3] == 0);
            let map = if empty {
                None
            } else {
                Pixmap::new(w as u32, h as u32).map(|mut m| {
                    for (d, s) in m.data_mut().chunks_exact_mut(4).zip(l.px.chunks_exact(4)) {
                        let a = s[3] as u32;
                        for c in 0..3 {
                            d[c] = ((s[c] as u32 * a + 127) / 255) as u8;
                        }
                        d[3] = s[3];
                    }
                    m
                })
            };
            self.bitmaps.insert(l.uid, (l.px.weak(), map));
        }
        let Some((_, Some(src))) = self.bitmaps.get(&l.uid) else { return };
        let Some(rect) = Rect::from_xywh(0.0, 0.0, w as f32, h as f32) else { return };
        let quality = if self.scale >= 1.0 { FilterQuality::Bilinear } else { FilterQuality::Bicubic };
        let paint = Paint { shader: Pattern::new(src.as_ref(), SpreadMode::Pad, quality, 1.0, Transform::identity()), anti_alias: false, ..Paint::default() };
        pm.fill_rect(rect, &paint, self.view, None);
    }

    fn apply_mask(&self, m: &[u8], pm: &mut Pixmap) {
        let (w, h) = (self.doc.w, self.doc.h);
        let Some(mut mask) = Mask::new(self.size.0, self.size.1) else { return };
        let (sw, x0, y0) = (self.size.0 as usize, self.rect.0, self.rect.1);
        for (k, v) in mask.data_mut().iter_mut().enumerate() {
            let (dx, dy) = ((k % sw) as f32 + 0.5, (k / sw) as f32 + 0.5);
            let (x, y) = ((x0 + dx / self.scale).floor(), (y0 + dy / self.scale).floor());
            if x >= 0.0 && y >= 0.0 && (x as usize) < w && (y as usize) < h {
                *v = m[y as usize * w + x as usize];
            }
        }
        let _ = MaskType::Alpha;
        pm.apply_mask(&mask);
    }
}

fn image_of(pm: &Pixmap) -> Image {
    let mut buf = SharedPixelBuffer::<Rgba8Pixel>::new(pm.width(), pm.height());
    buf.make_mut_bytes().copy_from_slice(pm.data());
    Image::from_rgba8_premultiplied(buf)
}

fn render(app: &AppWindow, st: &mut State, vis: Option<(f32, f32, f32, f32)>, s: f32) {
    let Some(v) = vis else {
        // toile entièrement hors de la vue
        app.set_vec_image(Image::default());
        st.vv.scale = s;
        st.vv.rect = (0.0, 0.0, 0.0, 0.0);
        return;
    };
    let r = rendered_rect(st, app, v, s);
    let (pw, ph) = ((((r.2 - r.0) * s).round() as u32).max(1), (((r.3 - r.1) * s).round() as u32).max(1));
    let Some(mut pm) = Pixmap::new(pw, ph) else { return };
    let view = Transform::from_row(s, 0.0, 0.0, s, -r.0 * s, -r.1 * s);
    let live = live_objects(st);
    let mut scene = Scene { doc: &st.doc, fonts: &mut st.fonts, bitmaps: &mut st.vv.bitmaps, live: &live, view, size: (pw, ph), rect: r, scale: s };
    scene.range(0, &mut pm);
    // « Hors toile » : ce qui dépasse de la toile est estompé
    if app.global::<ToolOpts>().get_outside_canvas() {
        let (dw, dh) = (st.doc.w as f32, st.doc.h as f32);
        let w = pw as usize;
        for (k, p) in pm.data_mut().chunks_exact_mut(4).enumerate() {
            let (x, y) = (r.0 + ((k % w) as f32 + 0.5) / s, r.1 + ((k / w) as f32 + 0.5) / s);
            if x < 0.0 || y < 0.0 || x > dw || y > dh {
                for c in p {
                    *c /= 2;
                }
            }
        }
    }
    // retient les seuls calques encore présents
    let doc = &st.doc;
    st.vv.bitmaps.retain(|uid, _| doc.layers.iter().any(|l| l.uid == *uid));
    st.vv.rect = r;
    st.vv.scale = s;
    app.set_vec_image(image_of(&pm));
    app.set_vec_x(r.0);
    app.set_vec_y(r.1);
    app.set_vec_w(r.2 - r.0);
    app.set_vec_h(r.3 - r.1);
}

/// Tracés d'édition (cadres, points d'ancrage), dans une image à part : les redessiner ne coûte
/// pas un rendu de la toile. Coordonnées et épaisseurs en pixels de l'écran.
pub(crate) struct Overlay<'a> {
    pub pm: tiny_skia::PixmapMut<'a>,
    origin: (f32, f32),
    pub scale: f32,
}

impl Overlay<'_> {
    pub fn at(&self, p: (f32, f32)) -> (f32, f32) {
        ((p.0 - self.origin.0) * self.scale, (p.1 - self.origin.1) * self.scale)
    }

    fn paint(c: [u8; 4]) -> Paint<'static> {
        let mut p = Paint::default();
        p.set_color_rgba8(c[0], c[1], c[2], c[3]);
        p.anti_alias = true;
        p
    }

    /// Contours d'un chemin (coordonnées du document), trait fin.
    pub fn outline(&mut self, subs: &[vector::SubPath], rot: Option<(f32, (f32, f32))>) {
        let Some(path) = vecrender::path_of(subs) else { return };
        let mut t = Transform::from_row(self.scale, 0.0, 0.0, self.scale, -self.origin.0 * self.scale, -self.origin.1 * self.scale);
        if let Some((a, c)) = rot {
            t = t.pre_concat(Transform::from_rotate_at(a.to_degrees(), c.0, c.1));
        }
        let Some(path) = path.transform(t) else { return };
        self.pm.stroke_path(&path, &Self::paint(ACCENT), &Stroke { width: 1.2, ..Stroke::default() }, Transform::identity(), None);
    }

    pub fn line(&mut self, a: (f32, f32), b: (f32, f32)) {
        let (a, b) = (self.at(a), self.at(b));
        let mut pb = tiny_skia::PathBuilder::new();
        pb.move_to(a.0, a.1);
        pb.line_to(b.0, b.1);
        let Some(path) = pb.finish() else { return };
        self.pm.stroke_path(&path, &Self::paint(ACCENT), &Stroke { width: 1.0, ..Stroke::default() }, Transform::identity(), None);
    }

    /// Point d'ancrage : carré, plein s'il est choisi.
    pub fn anchor(&mut self, p: (f32, f32), selected: bool) {
        let q = self.at(p);
        let Some(r) = Rect::from_xywh((q.0 - 3.5).round(), (q.1 - 3.5).round(), 7.0, 7.0) else { return };
        let path = tiny_skia::PathBuilder::from_rect(r);
        self.pm.fill_path(&path, &Self::paint(if selected { ACCENT } else { [255, 255, 255, 255] }), tiny_skia::FillRule::Winding, Transform::identity(), None);
        self.pm.stroke_path(&path, &Self::paint(ACCENT), &Stroke { width: 1.0, ..Stroke::default() }, Transform::identity(), None);
    }

    /// Bout d'une poignée de courbe : rond.
    pub fn knob(&mut self, p: (f32, f32)) {
        let q = self.at(p);
        let Some(path) = tiny_skia::PathBuilder::from_circle(q.0, q.1, 3.0) else { return };
        self.pm.fill_path(&path, &Self::paint(ACCENT), tiny_skia::FillRule::Winding, Transform::identity(), None);
    }
}

fn render_overlay(app: &AppWindow, st: &mut State) {
    let needed = st.shape_edit.is_some() || st.path_edit.is_some() || st.grad_live.is_some();
    if !needed {
        if st.vv.overlay_shown {
            app.set_vec_overlay(Image::default());
            st.vv.overlay_shown = false;
        }
        return;
    }
    let (r, s) = (st.vv.rect, st.vv.scale);
    let (pw, ph) = (((r.2 - r.0) * s).round() as u32, ((r.3 - r.1) * s).round() as u32);
    let Some(mut pm) = Pixmap::new(pw.max(1), ph.max(1)) else { return };
    let mut ov = Overlay { pm: pm.as_mut(), origin: (r.0, r.1), scale: s };
    if let Some(ed) = &st.shape_edit {
        shape_edit::draw_overlay(app, ed, &mut ov);
    }
    vecedit::draw_overlay(st, &mut ov);
    app.set_vec_overlay(image_of(&pm));
    st.vv.overlay_shown = true;
}
