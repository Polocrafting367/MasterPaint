// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Outil Dégradé : le dégradé tracé reste modifiable avant d'être posé, en pixels comme en SVG.
//! Un trait relie trois points : début, milieu (équilibre entre les deux couleurs) et fin ; le
//! ruban (type, couleurs) le retouche en direct. Entrée ou un clic à côté le pose, Échap ou Ctrl+Z
//! l'annule. Sur une grande image vue de loin, le réglage ne calcule que les pixels affichés
//! (comme l'aperçu des effets) ; la pleine résolution est calculée à la pose.

use super::vector::Obj;
use super::*;

pub(crate) struct GradLive {
    layer: u64,
    target: Target,
    a: (f32, f32),
    b: (f32, f32),
    /// position de la couleur du milieu sur le trait (0..1)
    mid: f32,
    drag: Option<Part>,
    /// clic droit : couleurs inversées
    secondary: bool,
    /// aperçu réduit affiché directement (voir `direct_canvas`)
    pub direct: bool,
    small: Option<Small>,
}

enum Target {
    Pixels(editor::Px),
    Object { obj: usize, orig: vector::ShapeObj },
}

#[derive(Clone, Copy, PartialEq)]
enum Part {
    Start,
    Mid,
    End,
}

/// Version réduite pour le réglage : calque actif, sélection, calques.
struct Small {
    lod: usize,
    w: usize,
    h: usize,
    base: Vec<u8>,
    sel: Option<Vec<u8>>,
    layers: Vec<editor::Layer>,
}

impl GradLive {
    fn mid_point(&self) -> (f32, f32) {
        (self.a.0 + (self.b.0 - self.a.0) * self.mid, self.a.1 + (self.b.1 - self.a.1) * self.mid)
    }

    fn hit(&self, x: f32, y: f32, zoom: f32) -> Option<Part> {
        let tol = 9.0 / zoom.max(0.01);
        let near = |p: (f32, f32)| (p.0 - x).abs() <= tol && (p.1 - y).abs() <= tol;
        if near(self.mid_point()) {
            Some(Part::Mid)
        } else if near(self.b) {
            Some(Part::End)
        } else if near(self.a) {
            Some(Part::Start)
        } else {
            None
        }
    }
}

/// Couleurs du dégradé : réglages du ruban ; zone d'un calque dynamique : en gris.
fn colors(app: &AppWindow, st: &State, secondary: bool) -> ([u8; 4], [u8; 4], paint::GradientKind) {
    let mut o = opts(app);
    if st.doc.layer().dynamic.is_some() {
        editor::to_gray(&mut o.primary);
        editor::to_gray(&mut o.secondary);
    }
    let (c0, c1) = if secondary { (o.secondary, o.primary) } else { (o.primary, o.secondary) };
    (c0, c1, o.gradient)
}

/// Appui de l'outil sur un calque de pixels : nouveau dégradé.
pub(crate) fn begin_pixels(st: &mut State, x: f32, y: f32, secondary: bool) {
    let l = st.doc.layer();
    st.grad_live = Some(GradLive { layer: l.uid, target: Target::Pixels(l.px.clone()), a: (x, y), b: (x, y), mid: 0.5, drag: Some(Part::End), secondary, direct: false, small: None });
}

/// Appui de l'outil dans un projet SVG : l'objet sous le pointeur reçoit le dégradé.
pub(crate) fn begin_object(app: &AppWindow, st: &mut State, x: f32, y: f32, secondary: bool) {
    let found = vecedit::pick(st, app.get_zoom(), x, y).and_then(|(k, i)| match st.doc.layers[k].vector.as_ref().and_then(|v| v.objects.get(i)) {
        Some(Obj::Shape(s)) if !s.is_stroke_only() => Some((k, i, s.clone())),
        _ => None,
    });
    let Some((k, obj, orig)) = found else {
        return status(app, "Dégradé : glissez sur une forme ou un chemin fermé");
    };
    st.doc.active = k;
    st.grad_live = Some(GradLive { layer: st.doc.layers[k].uid, target: Target::Object { obj, orig }, a: (x, y), b: (x, y), mid: 0.5, drag: Some(Part::End), secondary, direct: false, small: None });
    sync_panels(app, st);
}

/// Pointeur quand un dégradé est en cours. Faux : l'appui tombe hors de ses points (il vient
/// d'être posé), à traiter comme un nouveau geste.
pub(crate) fn pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32, shift: bool) -> bool {
    let zoom = app.get_zoom();
    let Some(g) = st.grad_live.as_mut() else { return false };
    match kind {
        0 => match g.hit(x, y, zoom) {
            Some(part) => {
                g.drag = Some(part);
                true
            }
            None => {
                commit(app, st);
                false
            }
        },
        1 => {
            let Some(part) = g.drag else {
                app.set_canvas_cursor(if g.hit(x, y, zoom).is_some() { 2 } else { 0 });
                return true;
            };
            match part {
                Part::Mid => {
                    let (dx, dy) = (g.b.0 - g.a.0, g.b.1 - g.a.1);
                    let l2 = (dx * dx + dy * dy).max(1e-6);
                    g.mid = (((x - g.a.0) * dx + (y - g.a.1) * dy) / l2).clamp(0.05, 0.95);
                }
                Part::Start | Part::End => {
                    // Maj : par pas de 15°
                    let other = if part == Part::End { g.a } else { g.b };
                    let mut p = (x, y);
                    if shift {
                        let (dx, dy) = (x - other.0, y - other.1);
                        let step = 15f32.to_radians();
                        let ang = (dy.atan2(dx) / step).round() * step;
                        let l = dx.hypot(dy);
                        p = (other.0 + ang.cos() * l, other.1 + ang.sin() * l);
                    }
                    if part == Part::End {
                        g.b = p;
                    } else {
                        g.a = p;
                    }
                }
            }
            render(app, st);
            true
        }
        _ => {
            let empty = vector::dist(g.a, g.b) * zoom < 3.0;
            g.drag = None;
            if empty {
                cancel(app, st);
            } else {
                show(app, st);
                status(app, "Dégradé : glissez ses 3 points pour le régler ; Entrée ou clic à côté pour le poser, Échap pour l'annuler");
            }
            true
        }
    }
}

/// Dessine l'état courant (aussi quand le ruban ou le zoom changent).
pub(crate) fn render(app: &AppWindow, st: &mut State) {
    let Some(mut g) = st.grad_live.take() else { return };
    if vector::dist(g.a, g.b) > 1e-3 {
        match &g.target {
            Target::Object { .. } => render_object(app, st, &g),
            Target::Pixels(_) => render_pixels(app, st, &mut g),
        }
    }
    st.grad_live = Some(g);
    show(app, st);
}

fn object_with_gradient(app: &AppWindow, st: &State, g: &GradLive, orig: &vector::ShapeObj) -> vector::ShapeObj {
    let (c0, c1, kind) = colors(app, st, g.secondary);
    let mid: [u8; 4] = std::array::from_fn(|k| ((c0[k] as u16 + c1[k] as u16) / 2) as u8);
    let mut s = orig.clone();
    // le dégradé tourne avec la forme : ses points dans le repère de la forme
    s.grad = Some(Box::new(vector::Grad {
        radial: kind == paint::GradientKind::Radial,
        p0: s.to_local(g.a),
        p1: s.to_local(g.b),
        stops: vec![(0.0, c0), (g.mid, mid), (1.0, c1)],
    }));
    if s.style == ShapeStyle::Outline {
        s.style = ShapeStyle::Both;
    }
    s
}

fn render_object(app: &AppWindow, st: &mut State, g: &GradLive) {
    let Target::Object { obj, orig } = &g.target else { return };
    let s = object_with_gradient(app, st, g, orig);
    if let Some(Obj::Shape(o)) = st.doc.layers.iter_mut().find(|l| l.uid == g.layer).and_then(|l| l.vector.as_mut()).and_then(|v| v.objects.get_mut(*obj)) {
        *o = s;
    }
    vecview::touch(app, st);
}

fn render_pixels(app: &AppWindow, st: &mut State, g: &mut GradLive) {
    let Target::Pixels(base) = &g.target else { return };
    let (w, h) = (st.doc.w, st.doc.h);
    let (c0, c1, kind) = colors(app, st, g.secondary);
    let lod = preview_lod(app, w, h);
    let reducible = lod > 1 && !st.doc.layers.iter().any(|l| l.dynamic.is_some() || l.off.is_some());
    if !reducible {
        let sel = st.doc.sel.clone();
        let Some(k) = st.doc.layers.iter().position(|l| l.uid == g.layer) else { return };
        paint::gradient_mid(base, &mut st.doc.layers[k].px, w, h, g.a, g.b, c0, c1, kind, sel.as_deref(), g.mid);
        if std::mem::take(&mut g.direct) {
            redraw_canvas(app, st);
        } else {
            refresh_rect(app, st, None);
        }
        return;
    }
    if g.small.as_ref().is_none_or(|s| s.lod != lod) {
        let (sw, sh) = (w.div_ceil(lod), h.div_ceil(lod));
        g.small = Some(Small {
            lod,
            w: sw,
            h: sh,
            base: photo::crop_resize::<u8, 4>(base, w, (0, 0, w, h), sw, sh),
            sel: st.doc.sel.as_ref().map(|m| photo::crop_resize::<u8, 1>(m, w, (0, 0, w, h), sw, sh)),
            layers: reduced_layers(&st.doc, sw, sh),
        });
    }
    let Some(s) = g.small.as_mut() else { return };
    let (kx, ky) = (s.w as f32 / w as f32, s.h as f32 / h as f32);
    let mut out = vec![0u8; s.base.len()];
    paint::gradient_mid(&s.base, &mut out, s.w, s.h, (g.a.0 * kx, g.a.1 * ky), (g.b.0 * kx, g.b.1 * ky), c0, c1, kind, s.sel.as_deref(), g.mid);
    g.direct = true;
    show_reduced(app, st, &mut s.layers, out, s.w, s.h);
}

/// Pose le dégradé : une étape d'historique, à pleine résolution.
pub(crate) fn commit(app: &AppWindow, st: &mut State) {
    let Some(g) = st.grad_live.take() else { return };
    clear(app);
    st.vv_overlay_changed(app);
    if vector::dist(g.a, g.b) <= 1e-3 {
        return refresh_all(app, st);
    }
    match &g.target {
        Target::Pixels(base) => {
            let (w, h) = (st.doc.w, st.doc.h);
            let (c0, c1, kind) = colors(app, st, g.secondary);
            let sel = st.doc.sel.clone();
            if let Some(k) = st.doc.layers.iter().position(|l| l.uid == g.layer) {
                paint::gradient_mid(base, &mut st.doc.layers[k].px, w, h, g.a, g.b, c0, c1, kind, sel.as_deref(), g.mid);
            }
        }
        Target::Object { .. } => render_vector_layer(app, st, g.layer),
    }
    st.doc.commit("Dégradé");
    refresh_all(app, st);
}

/// Annule le dégradé en cours.
pub(crate) fn cancel(app: &AppWindow, st: &mut State) {
    let Some(g) = st.grad_live.take() else { return };
    clear(app);
    st.vv_overlay_changed(app);
    if let Some(k) = st.doc.layers.iter().position(|l| l.uid == g.layer) {
        match g.target {
            Target::Pixels(base) => st.doc.layers[k].px = base,
            Target::Object { obj, orig } => {
                if let Some(o) = st.doc.layers[k].vector.as_mut().and_then(|v| v.objects.get_mut(obj)) {
                    *o = Obj::Shape(orig);
                }
            }
        }
    }
    status(app, "");
    refresh_all(app, st);
}

fn clear(app: &AppWindow) {
    app.set_handles(ModelRc::default());
    app.set_overlay_path(SharedString::default());
    app.set_canvas_cursor(0);
}

/// Les trois points et le trait qui les relie.
pub(crate) fn show(app: &AppWindow, st: &mut State) {
    let Some(g) = st.grad_live.as_ref() else { return };
    if vector::dist(g.a, g.b) <= 1e-3 {
        return;
    }
    let (a, m, b) = (g.a, g.mid_point(), g.b);
    let hs = vec![Handle { x: a.0, y: a.1, round: true }, Handle { x: m.0, y: m.1, round: false }, Handle { x: b.0, y: b.1, round: true }];
    app.set_handles(ModelRc::new(VecModel::from(hs)));
    // projet SVG : le trait est tracé avec la toile
    if st.vv.on {
        vecview::touch_overlay(app, st);
    } else {
        app.set_overlay_path(SharedString::from(format!("M {} {} L {} {}", a.0, a.1, b.0, b.1)));
    }
}

/// Trait du dégradé sur la toile d'un projet SVG.
pub(crate) fn draw_overlay(st: &State, ov: &mut vecview::Overlay) {
    if let Some(g) = st.grad_live.as_ref() {
        ov.line(g.a, g.b);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Le point du milieu déplace la couleur centrale sans toucher aux bouts.
    #[test]
    fn middle_point_shifts_the_blend() {
        let (w, h) = (100, 1);
        let base = vec![0u8; 400];
        let row = |mid: f32| {
            let mut out = vec![0u8; 400];
            paint::gradient_mid(&base, &mut out, w, h, (0.0, 0.5), (100.0, 0.5), [0, 0, 0, 255], [200, 200, 200, 255], paint::GradientKind::Linear, None, mid);
            out
        };
        let (even, left) = (row(0.5), row(0.25));
        assert!((even[50 * 4] as i32 - 100).abs() <= 2, "{}", even[50 * 4]);
        assert!((left[25 * 4] as i32 - 100).abs() <= 2, "{}", left[25 * 4]);
        assert!(left[2 * 4] < 12 && left[99 * 4] > 195, "bouts inchangés");
    }
}
