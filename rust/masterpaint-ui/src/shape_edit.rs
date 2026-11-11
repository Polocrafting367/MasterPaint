// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Forme « vivante », comme Paint.NET : après le tracé (outils Formes, Rectangle arrondi, Ligne),
//! la forme reste modifiable sur la toile — cadre à 8 poignées, poignée de rotation au-dessus,
//! glisser dedans pour la déplacer — et le ruban la retouche en direct (couleur, épaisseur,
//! style, rayon, côtés, branches, type de forme ; « Les deux » : intérieur de la couleur
//! secondaire). Ligne : ses deux bouts, plus deux points intermédiaires en mode « Courbe » (la
//! ligne devient une courbe qui passe par ses quatre points), bouts et trait réglables. Validée par Entrée, Échap,
//! un clic hors du cadre, un autre outil ou un menu : objet du calque SVG si elle y a été tracée
//! (« Modifiable »), pixels du calque sinon. Ctrl+Z pendant l'édition l'annule. Un clic sur une
//! forme d'un calque SVG la reprend dans ce mode, comme si elle venait d'être posée.

use super::*;

/// Forme en cours d'édition.
pub(crate) struct ShapeEdit {
    /// calque qui la reçoit (uid)
    pub(crate) layer: u64,
    /// objet repris d'un calque SVG (indice) ; None : nouvelle forme
    pub(crate) obj: Option<usize>,
    /// forme reprise telle qu'elle était (rien à enregistrer si elle n'a pas changé)
    orig: Option<vector::ShapeObj>,
    /// pixels du calque sans cette forme
    base: editor::Px,
    pub(crate) shape: vector::ShapeObj,
    /// geste en cours : prise, point de départ, forme au départ
    drag: Option<(Grab, (f32, f32), vector::ShapeObj)>,
    /// rectangle touché par le dernier rendu (seul lui est remis à neuf au suivant)
    last: Option<(usize, usize, usize, usize)>,
    /// réglages du dégradé déjà appliqués : un dégradé importé (plusieurs arrêts) n'est refait que
    /// si l'utilisateur change l'un d'eux, pas pour une autre retouche
    grad_sig: tools::GradSig,
}

#[derive(Clone, Copy, PartialEq)]
enum Grab {
    Move,
    /// poignée du cadre : 0 haut-gauche, puis dans le sens horaire (1 haut, 2 haut-droit…)
    Handle(usize),
    Rotate,
    /// point d'une ligne / courbe (bouts et points intermédiaires, dans l'ordre)
    Point(usize),
}

fn is_line(s: &vector::ShapeObj) -> bool {
    s.kind == "line" || s.kind == "curve"
}

/// Points modifiables d'une ligne : ceux de la courbe ; ligne droite en mode « Courbe » : bouts
/// et deux points au tiers et aux deux tiers ; sinon ses deux bouts.
fn line_points(s: &vector::ShapeObj, curve_mode: bool) -> Vec<(f32, f32)> {
    if s.kind == "curve" && s.points.len() >= 2 {
        return s.points.clone();
    }
    if curve_mode {
        let at = |k: f32| (s.a.0 + (s.b.0 - s.a.0) * k, s.a.1 + (s.b.1 - s.a.1) * k);
        return vec![s.a, at(1.0 / 3.0), at(2.0 / 3.0), s.b];
    }
    vec![s.a, s.b]
}

/// Formes de la famille du ruban (le ruban peut changer leur type).
fn ribbon_kind(s: &vector::ShapeObj) -> bool {
    s.points.is_empty() && !matches!(s.kind.as_str(), "line" | "polyline" | "polygon")
}

/// Poignées du cadre dans le repère de la forme (8) puis la poignée de rotation.
fn local_handles(s: &vector::ShapeObj, zoom: f32) -> Vec<(f32, f32)> {
    let (x0, y0, x1, y1) = s.bbox();
    let (mx, my) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    vec![(x0, y0), (mx, y0), (x1, y0), (x1, my), (x1, y1), (mx, y1), (x0, y1), (x0, my), (mx, y0 - 26.0 / zoom)]
}

/// Ce que saisit un clic en (x, y).
fn hit(s: &vector::ShapeObj, x: f32, y: f32, zoom: f32, curve_mode: bool) -> Option<Grab> {
    let tol = 8.0 / zoom.max(0.01);
    let near = |p: (f32, f32)| (p.0 - x).abs() <= tol && (p.1 - y).abs() <= tol;
    if is_line(s) {
        if let Some(i) = line_points(s, curve_mode).into_iter().position(near) {
            return Some(Grab::Point(i));
        }
        return ((s.sdf())(x, y) <= tol).then_some(Grab::Move);
    }
    let hs = local_handles(s, zoom);
    if near(s.to_world(hs[8])) {
        return Some(Grab::Rotate);
    }
    if let Some(k) = (0..8).find(|&k| near(s.to_world(hs[k]))) {
        return Some(Grab::Handle(k));
    }
    let (lx, ly) = s.to_local((x, y));
    let (x0, y0, x1, y1) = s.bbox();
    (lx >= x0 - tol && lx <= x1 + tol && ly >= y0 - tol && ly <= y1 + tol).then_some(Grab::Move)
}

fn translate(s: &mut vector::ShapeObj, dx: f32, dy: f32) {
    s.map_points(&move |p| (p.0 + dx, p.1 + dy));
}

/// Nouveau cadre (repère de la forme) ; les sommets libres suivent proportionnellement.
fn set_rect(s: &mut vector::ShapeObj, r: (f32, f32, f32, f32)) {
    let (nx0, ny0, nx1, ny1) = (r.0.min(r.2), r.1.min(r.3), r.0.max(r.2), r.1.max(r.3));
    let (nx1, ny1) = (nx1.max(nx0 + 1.0), ny1.max(ny0 + 1.0));
    let (ox0, oy0, ox1, oy1) = s.bbox();
    let (sx, sy) = ((nx1 - nx0) / (ox1 - ox0).max(1e-3), (ny1 - ny0) / (oy1 - oy0).max(1e-3));
    let to_new = move |p: (f32, f32)| (nx0 + (p.0 - ox0) * sx, ny0 + (p.1 - oy0) * sy);
    if !s.points.is_empty() {
        s.map_points(&to_new);
    } else if let Some(g) = s.grad.as_mut() {
        // le dégradé suit la forme
        g.p0 = to_new(g.p0);
        g.p1 = to_new(g.p1);
    }
    s.a = (nx0, ny0);
    s.b = (nx1, ny1);
}

/// Applique le geste en cours au point (x, y).
fn drag_to(start: &vector::ShapeObj, g: Grab, p0: (f32, f32), x: f32, y: f32, shift: bool, zoom: f32, curve_mode: bool) -> vector::ShapeObj {
    let mut s = start.clone();
    match g {
        Grab::Move => translate(&mut s, x - p0.0, y - p0.1),
        Grab::Point(i) => {
            let mut pts = line_points(start, curve_mode);
            let n = pts.len();
            if let Some(p) = pts.get_mut(i) {
                *p = (x, y);
            }
            // un point intermédiaire déplacé : la ligne devient une courbe par ses quatre points
            if n > 2 {
                s.kind = "curve".into();
                s.points = pts.clone();
            }
            s.a = pts[0];
            s.b = pts[n - 1];
        }
        Grab::Rotate => {
            let c = start.center();
            let a0 = (p0.1 - c.1).atan2(p0.0 - c.0);
            let a1 = (y - c.1).atan2(x - c.0);
            let mut r = start.rot + a1 - a0;
            // Maj : par pas de 15°
            if shift {
                let step = 15f32.to_radians();
                r = (r / step).round() * step;
            }
            s.rot = r;
        }
        Grab::Handle(k) => {
            let (lx, ly) = start.to_local((x, y));
            let (mut x0, mut y0, mut x1, mut y1) = start.bbox();
            match k {
                0 => (x0, y0) = (lx, ly),
                1 => y0 = ly,
                2 => (x1, y0) = (lx, ly),
                3 => x1 = lx,
                4 => (x1, y1) = (lx, ly),
                5 => y1 = ly,
                6 => (x0, y1) = (lx, ly),
                _ => x0 = lx,
            }
            // Maj sur un coin : proportions gardées
            if shift && k % 2 == 0 {
                let (ow, oh) = (start.bbox().2 - start.bbox().0, start.bbox().3 - start.bbox().1);
                if ow > 0.0 && oh > 0.0 {
                    let h = (x1 - x0).abs() * oh / ow * if y1 >= y0 { 1.0 } else { -1.0 };
                    if k == 0 || k == 2 {
                        y0 = y1 - h;
                    } else {
                        y1 = y0 + h;
                    }
                }
            }
            // le point opposé reste en place dans le document (le centre de rotation bouge)
            let anchor = local_handles(start, zoom)[(k + 4) % 8];
            let before = start.to_world(anchor);
            set_rect(&mut s, (x0, y0, x1, y1));
            let after = s.to_world(anchor);
            translate(&mut s, before.0 - after.0, before.1 - after.1);
        }
    }
    s
}

/// Poignées et cadre sur la toile.
pub(crate) fn show(app: &AppWindow, ed: &ShapeEdit) {
    let zoom = app.get_zoom();
    let s = &ed.shape;
    if is_line(s) {
        let pts = line_points(s, app.global::<ToolOpts>().get_line_mode() == 1);
        let hs: Vec<Handle> = pts.iter().map(|p| Handle { x: p.0, y: p.1, round: true }).collect();
        app.set_handles(ModelRc::new(VecModel::from(hs)));
        let d: Vec<String> = pts.iter().enumerate().map(|(i, p)| format!("{} {} {}", if i == 0 { "M" } else { "L" }, p.0, p.1)).collect();
        app.set_overlay_path(SharedString::from(d.join(" ")));
        return;
    }
    let hs: Vec<Handle> = local_handles(s, zoom)
        .into_iter()
        .enumerate()
        .map(|(k, p)| {
            let (x, y) = s.to_world(p);
            Handle { x, y, round: k == 8 || k % 2 == 0 }
        })
        .collect();
    let q = s.corners_world();
    let top = s.to_world(local_handles(s, zoom)[1]);
    let rot = (hs[8].x, hs[8].y);
    app.set_handles(ModelRc::new(VecModel::from(hs)));
    app.set_overlay_path(SharedString::from(format!(
        "M {} {} L {} {} L {} {} L {} {} Z M {} {} L {} {}",
        q[0].0, q[0].1, q[1].0, q[1].1, q[2].0, q[2].1, q[3].0, q[3].1, top.0, top.1, rot.0, rot.1
    )));
}

/// Calque = pixels sans la forme + la forme telle qu'elle est maintenant. Seuls le cadre du
/// rendu précédent (remis depuis `base`) et celui du nouveau sont touchés et réaffichés.
fn render(app: &AppWindow, st: &mut State) {
    let Some(uid) = st.shape_edit.as_ref().map(|e| e.layer) else { return };
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == uid) else {
        st.shape_edit = None;
        return;
    };
    let (w, h) = (st.doc.w, st.doc.h);
    let Some(ed) = st.shape_edit.as_mut() else { return };
    let lay = &mut st.doc.layers[k].px;
    match ed.last {
        Some((x0, y0, x1, y1)) if lay.len() == ed.base.len() => {
            for yy in y0..y1 {
                let (s, e) = ((yy * w + x0) * 4, (yy * w + x1) * 4);
                lay[s..e].copy_from_slice(&ed.base[s..e]);
            }
        }
        _ => *lay = ed.base.clone(),
    }
    let r = ed.shape.paint(None, lay, w, h);
    let dirty = match (ed.last, r) {
        (Some(a), Some(b)) => Some((a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3))),
        // premier rendu : l'aperçu du tracé couvrait peut-être plus large, tout est réaffiché
        (None, _) => None,
        (a, b) => a.or(b),
    };
    ed.last = r;
    if let Some(ed) = st.shape_edit.as_ref() {
        show(app, ed);
    }
    vecview::touch_overlay(app, st);
    queue_paint_frame(app, st, dirty);
}

/// Forme qui vient d'être tracée : elle reste modifiable (pixels d'avant le tracé relevés à
/// l'appui, `State::shape_base`). Faux si ces pixels manquent (la forme est alors posée).
pub(crate) fn begin_new(app: &AppWindow, st: &mut State, shape: vector::ShapeObj) -> bool {
    let uid = st.doc.layer().uid;
    let Some((_, base)) = st.shape_base.take().filter(|(u, _)| *u == uid) else { return false };
    st.shape_edit = Some(ShapeEdit { layer: uid, obj: None, orig: None, base, shape, drag: None, last: None, grad_sig: opts(app).grad_sig() });
    render(app, st);
    status(app, "Forme : poignées pour la redimensionner ou la tourner, ruban pour la modifier ; Entrée ou clic à côté pour la poser");
    true
}

/// Clic sur une forme d'un calque SVG (outils Formes, Ligne) : elle redevient modifiable.
fn begin_existing(app: &AppWindow, st: &mut State, x: f32, y: f32) -> bool {
    let k = st.doc.active;
    if st.doc.locked_at(k) {
        return false;
    }
    let Some(v) = st.doc.layers[k].vector.as_deref() else { return false };
    let tol = 3.0 / app.get_zoom().max(0.01);
    let Some(i) = (0..v.objects.len()).rev().find(|&i| matches!(&v.objects[i], vector::Obj::Shape(s) if s.hit(x, y, tol))) else {
        return false;
    };
    begin_obj(app, st, i, x, y);
    true
}

/// Reprend la forme `i` du calque actif, saisie en (x, y).
pub(crate) fn begin_obj(app: &AppWindow, st: &mut State, i: usize, x: f32, y: f32) {
    let k = st.doc.active;
    let Some(v) = st.doc.layers[k].vector.as_deref() else { return };
    let Some(vector::Obj::Shape(shape)) = v.objects.get(i).cloned() else { return };
    let (w, h) = (st.doc.w, st.doc.h);
    let base = v.render_others(&mut st.fonts, w, h, i);
    let uid = st.doc.layers[k].uid;
    load_opts(app, &shape);
    st.shape_edit = Some(ShapeEdit { layer: uid, obj: Some(i), orig: Some(shape.clone()), base: base.into(), shape: shape.clone(), drag: Some((Grab::Move, (x, y), shape)), last: None, grad_sig: opts(app).grad_sig() });
    render(app, st);
    status(app, "Forme reprise : glisser pour la déplacer, poignées pour la redimensionner ou la tourner, ruban pour la modifier");
}

/// Un appui en (x, y) prend-il une poignée ou le cadre de la forme en cours ?
pub(crate) fn grabs(app: &AppWindow, st: &State, x: f32, y: f32) -> bool {
    let curve = app.global::<ToolOpts>().get_line_mode() == 1;
    st.shape_edit.as_ref().is_some_and(|ed| hit(&ed.shape, x, y, app.get_zoom(), curve).is_some())
}

/// Retire la forme en cours de l'édition pour la supprimer : (calque, objet).
pub(crate) fn take_for_delete(app: &AppWindow, st: &mut State) -> Option<(u64, Option<usize>)> {
    let ed = st.shape_edit.take()?;
    clear_overlay(app);
    st.shape_layer_new = None;
    Some((ed.layer, ed.obj))
}

/// Cadre et trait de la forme en cours, tracés avec la toile d'un projet SVG.
pub(crate) fn draw_overlay(app: &AppWindow, ed: &ShapeEdit, ov: &mut vecview::Overlay) {
    let s = &ed.shape;
    let rot = (s.rot != 0.0).then(|| (s.rot, s.center()));
    ov.outline(&s.to_subs(), rot);
    if is_line(s) {
        let pts = line_points(s, app.global::<ToolOpts>().get_line_mode() == 1);
        for w in pts.windows(2) {
            ov.line(w[0], w[1]);
        }
        return;
    }
    let q = s.corners_world();
    for i in 0..4 {
        ov.line(q[i], q[(i + 1) % 4]);
    }
    let hs = local_handles(s, app.get_zoom());
    ov.line(s.to_world(hs[1]), s.to_world(hs[8]));
}

/// Le ruban reprend les réglages de la forme reprise.
pub(crate) fn load_opts(app: &AppWindow, s: &vector::ShapeObj) {
    let t = app.global::<ToolOpts>();
    t.set_line_width(s.width);
    if !is_line(s) {
        t.set_shape_fill_type(s.grad.is_some() as i32);
        if let Some(g) = s.grad.as_deref() {
            t.set_shape_grad_type(g.radial as i32);
            if !g.radial {
                t.set_shape_grad_angle((g.p1.1 - g.p0.1).atan2(g.p1.0 - g.p0.0).to_degrees().rem_euclid(360.0).round());
            }
        }
    }
    if !is_line(s) {
        t.set_shape_style(match s.style {
            ShapeStyle::Outline => 0,
            ShapeStyle::Fill => 1,
            ShapeStyle::Both => 2,
        });
    }
    if s.radius >= 0.0 {
        t.set_corner_radius(s.radius);
    }
    if is_line(s) {
        t.set_cap_start(s.cap_start as i32);
        t.set_cap_end(s.cap_end as i32);
        t.set_line_dash(s.dash as i32);
        if s.kind == "curve" {
            t.set_line_mode(1);
        }
    }
    if let (ShapeStyle::Both, Some(f)) = (s.style, s.fill) {
        app.set_secondary_color(Color::from_argb_u8(f[3], f[0], f[1], f[2]));
    }
    if ribbon_kind(s) {
        if let Some(n) = s.kind.strip_prefix("ngon-").and_then(|n| n.parse::<f32>().ok()) {
            t.set_shape_kind("ngon".into());
            t.set_shape_sides(n);
        } else if let Some(n) = s.kind.strip_prefix("star-").and_then(|n| n.parse::<f32>().ok()) {
            t.set_shape_kind("star".into());
            t.set_star_points(n);
        } else if s.kind == "star" {
            t.set_shape_kind("star".into());
            t.set_star_points(5.0);
        } else {
            t.set_shape_kind(s.kind.as_str().into());
        }
    }
    app.set_primary_color(Color::from_argb_u8(s.color[3], s.color[0], s.color[1], s.color[2]));
    // dégradé : ses deux couleurs dans les couleurs principale et secondaire
    if let Some(g) = s.grad.as_deref() {
        if let (Some(a), Some(b)) = (g.stops.first(), g.stops.last()) {
            if s.style == ShapeStyle::Fill {
                app.set_primary_color(Color::from_argb_u8(a.1[3], a.1[0], a.1[1], a.1[2]));
            }
            app.set_secondary_color(Color::from_argb_u8(b.1[3], b.1[0], b.1[1], b.1[2]));
        }
    }
}

/// Réglages du ruban (ou couleur principale) changés : la forme en cours les prend.
pub(crate) fn opts_changed(app: &AppWindow, st: &mut State) {
    let tool = st.tool;
    let o = opts(app);
    let Some(ed) = st.shape_edit.as_mut() else { return };
    let sig = o.grad_sig();
    let grad_changed = sig != ed.grad_sig;
    ed.grad_sig = sig;
    let s = &mut ed.shape;
    let before = s.clone();
    if grad_changed && !is_line(s) {
        s.grad = o.shape_grad(s.bbox(), o.primary, o.secondary);
    }
    let c = o.primary;
    s.color = [c[0], c[1], c[2], c[3]];
    s.width = o.line_width.max(1.0);
    if is_line(s) {
        s.cap_start = o.cap_start;
        s.cap_end = o.cap_end;
        s.dash = o.dash;
        // mode « Droite » : une courbe redevient la ligne entre ses deux bouts
        if s.kind == "curve" && app.global::<ToolOpts>().get_line_mode() == 0 {
            if let (Some(&a), Some(&b)) = (s.points.first(), s.points.last()) {
                (s.a, s.b) = (a, b);
            }
            s.kind = "line".into();
            s.points.clear();
        }
    } else {
        s.style = o.style;
        // « Les deux » : intérieur de la couleur secondaire
        s.fill = (o.style == ShapeStyle::Both).then_some(o.secondary);
    }
    if tool == Tool::Shape && ribbon_kind(s) {
        s.kind = o.shape_kind.clone();
    }
    if s.kind == "roundrect" {
        s.radius = o.corner;
    }
    if *s != before {
        render(app, st);
    }
}

/// Pointeur sur la toile (outils Formes, Rectangle arrondi, Ligne). Vrai si le geste est pris.
pub(crate) fn pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32, shift: bool) -> bool {
    let zoom = app.get_zoom();
    let curve = app.global::<ToolOpts>().get_line_mode() == 1;
    let Some(ed) = st.shape_edit.as_mut() else {
        return kind == 0 && begin_existing(app, st, x, y);
    };
    match kind {
        0 => {
            if let Some(g) = hit(&ed.shape, x, y, zoom, curve) {
                ed.drag = Some((g, (x, y), ed.shape.clone()));
                return true;
            }
            // clic hors du cadre : la forme est posée ; le clic peut reprendre une autre forme
            commit(app, st);
            begin_existing(app, st, x, y)
        }
        1 => {
            if let Some((g, p0, s0)) = ed.drag.clone() {
                ed.shape = drag_to(&s0, g, p0, x, y, shift, zoom, curve);
                render(app, st);
            } else {
                app.set_canvas_cursor(match hit(&ed.shape, x, y, zoom, curve) {
                    Some(Grab::Move) => 1,
                    Some(Grab::Rotate) => 3,
                    // poignée du cadre : flèches orientées comme elle (forme tournée comprise)
                    Some(Grab::Handle(k)) => {
                        let hs = local_handles(&ed.shape, zoom);
                        let (x0, y0, x1, y1) = ed.shape.bbox();
                        let p = ed.shape.to_world(hs[k]);
                        let c = ed.shape.to_world(((x0 + x1) / 2.0, (y0 + y1) / 2.0));
                        crate::transform::resize_cursor(p.0 - c.0, p.1 - c.1)
                    }
                    Some(_) => 2,
                    None => 0,
                });
            }
            true
        }
        _ => {
            ed.drag = None;
            true
        }
    }
}

fn clear_overlay(app: &AppWindow) {
    app.set_handles(ModelRc::default());
    app.set_overlay_path(SharedString::default());
    app.set_canvas_cursor(0);
}

/// Pose la forme : objet du calque SVG, sinon pixels du calque ; une étape d'historique.
pub(crate) fn commit(app: &AppWindow, st: &mut State) {
    let Some(ed) = st.shape_edit.take() else { return };
    clear_overlay(app);
    st.shape_layer_new = None;
    vecview::touch_overlay(app, st);
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == ed.layer) else { return };
    let label = if is_line(&ed.shape) { "Ligne" } else { "Forme" };
    let unchanged = ed.orig.as_ref() == Some(&ed.shape);
    if let Some(v) = st.doc.layers[k].vector.as_mut() {
        match ed.obj {
            Some(i) if i < v.objects.len() => v.objects[i] = vector::Obj::Shape(ed.shape),
            _ => v.objects.push(vector::Obj::Shape(ed.shape)),
        }
        render_vector_layer(app, st, ed.layer);
    } else {
        let (w, h) = (st.doc.w, st.doc.h);
        let mut px = ed.base.to_vec();
        ed.shape.paint(None, &mut px, w, h);
        st.doc.layers[k].px = px.into();
    }
    if !unchanged {
        st.doc.commit(label);
    }
    refresh_all(app, st);
}

/// Annule la forme en cours (Ctrl+Z) : nouvelle forme retirée, forme reprise inchangée.
pub(crate) fn cancel(app: &AppWindow, st: &mut State) {
    let Some(ed) = st.shape_edit.take() else { return };
    clear_overlay(app);
    vecview::touch_overlay(app, st);
    if let Some(k) = st.doc.layers.iter().position(|l| l.uid == ed.layer) {
        if ed.obj.is_some() {
            render_vector_layer(app, st, ed.layer);
        } else {
            st.doc.layers[k].px = ed.base;
        }
    }
    drop_empty_shape_layer(app, st);
    refresh_all(app, st);
}
