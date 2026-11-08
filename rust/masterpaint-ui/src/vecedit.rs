// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Outils vectoriels d'un projet SVG, comme dans un logiciel de dessin vectoriel :
//! - Sélection : clic sur n'importe quel objet (tous calques), cadre et poignées, déplacement ;
//! - Sélection directe : points d'ancrage et poignées de Bézier d'un chemin ; double-clic sur un
//!   segment = ajoute un point, sur un point = le passe d'angle à lisse (et retour) ;
//! - Plume : clic = point d'angle, cliquer-glisser = point lisse, clic sur le premier point =
//!   ferme le chemin, Entrée = le termine ouvert, Ctrl+Z / Retour arrière = retire le dernier ;
//! - Crayon : trait à main levée, ajusté en courbes de Bézier au relâchement ;
//! - Dégradé : voir gradlive.rs.
//!
//! Aucun de ces outils n'écrit de pixels : ils modifient les objets du calque.

use super::vector::{Node, Obj, ShapeObj, SubPath};
use super::*;

/// Chemin en cours de tracé ou de modification.
pub(crate) struct PathEdit {
    pub layer: u64,
    /// objet repris (indice) ; None : nouveau chemin
    pub obj: Option<usize>,
    pub shape: ShapeObj,
    /// état enregistré (rien à enregistrer s'il n'a pas changé)
    saved: Option<ShapeObj>,
    /// points choisis (contour, point)
    sel: Vec<(usize, usize)>,
    drag: Option<Drag>,
    /// Plume : le dernier contour grandit encore
    drawing: bool,
    /// position du pointeur (trait élastique de la Plume)
    hover: Option<(f32, f32)>,
    /// Crayon : points relevés pendant le geste
    raw: Vec<(f32, f32)>,
    /// réglages du dégradé déjà appliqués (voir `ShapeEdit::grad_sig`)
    grad_sig: tools::GradSig,
}

#[derive(Clone, Copy)]
enum Drag {
    Anchors((f32, f32)),
    In(usize, usize),
    Out(usize, usize),
    /// Plume : point qui vient d'être posé, ses poignées suivent le pointeur (symétriques)
    NewAnchor(usize, usize),
    Whole((f32, f32)),
}

/// Outil d'un projet SVG équivalent à un outil de pixels ; outil de pixels équivalent à un outil
/// vectoriel dans un projet en pixels.
pub(crate) fn tool_for_mode<'a>(vector_mode: bool, id: &'a str) -> &'a str {
    if vector_mode {
        match id {
            "tool-select" | "tool-direct-select" | "tool-poly-lasso" | "tool-magnetic-lasso" | "tool-wand" | "tool-deform" | "tool-warp-4" | "tool-eraser" | "btn-deselect" => "tool-move",
            "tool-brush" => "tool-pencil",
            other => other,
        }
    } else {
        match id {
            "tool-node" | "tool-pen" => "tool-move",
            other => other,
        }
    }
}

/// Style d'un nouveau tracé : réglages du ruban (contour, plein ou les deux).
fn new_shape(app: &AppWindow, style: paint::ShapeStyle, width: f32) -> ShapeObj {
    let o = opts(app);
    let with_opacity = |mut c: [u8; 4]| {
        c[3] = (c[3] as f32 * o.opacity.clamp(0.0, 1.0)).round() as u8;
        c
    };
    ShapeObj {
        kind: "path".into(),
        a: (0.0, 0.0),
        b: (0.0, 0.0),
        style,
        width: width.max(0.1),
        color: with_opacity(o.primary),
        points: Vec::new(),
        radius: -1.0,
        fill: (style == paint::ShapeStyle::Both).then(|| with_opacity(o.secondary)),
        rot: 0.0,
        cap_start: 0,
        cap_end: 0,
        dash: o.dash,
        grad: None,
        subs: Vec::new(),
    }
}

/// Calque qui reçoit un nouveau tracé ; None (avec un message) si le calque actif le refuse.
fn target_layer(app: &AppWindow, st: &mut State) -> Option<u64> {
    if st.doc.locked_at(st.doc.active) {
        status(app, "Calque verrouillé : cliquez sur son cadenas (panneau Calques) pour le déverrouiller");
        return None;
    }
    prepare_shape_layer(app, st);
    st.doc.layer().vector.as_ref().map(|_| st.doc.layer().uid).or_else(|| {
        status(app, "Choisissez un calque SVG");
        None
    })
}

/// Objet (calque, indice) sous le pointeur : le plus haut de tous les calques visibles et non
/// verrouillés.
pub(crate) fn pick(st: &mut State, zoom: f32, x: f32, y: f32) -> Option<(usize, usize)> {
    let tol = 4.0 / zoom.max(0.01);
    let State { doc, fonts, .. } = st;
    for k in (0..doc.layers.len()).rev() {
        if doc.layers[k].group || !doc.visible_at(k) || doc.locked_at(k) {
            continue;
        }
        if let Some(i) = doc.layers[k].vector.as_deref().and_then(|v| v.pick(fonts, x, y, tol)) {
            return Some((k, i));
        }
    }
    None
}

/// Outil Sélection. Faux : rien à prendre ici (l'outil Déplacer habituel s'applique à un calque
/// de pixels, image placée).
pub(crate) fn select_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32, shift: bool) -> bool {
    if kind != 0 {
        if st.shape_edit.is_some() {
            return shape_edit::pointer(app, st, kind, x, y, shift);
        }
        return vector_move_pointer(app, st, kind, x, y);
    }
    if shape_edit::grabs(app, st, x, y) {
        return shape_edit::pointer(app, st, kind, x, y, shift);
    }
    shape_edit::commit(app, st);
    commit_text(app, st);
    st.vector_drag = None;
    st.vector_drag_base = None;
    let Some((k, i)) = pick(st, app.get_zoom(), x, y) else {
        return st.doc.layer().vector.is_some();
    };
    st.doc.active = k;
    sync_panels(app, st);
    svg_panel::picked(app, st, i);
    match st.doc.layers[k].vector.as_ref().and_then(|v| v.objects.get(i)) {
        Some(Obj::Shape(_)) => shape_edit::begin_obj(app, st, i, x, y),
        Some(Obj::Text(_)) => {
            st.vector_drag = Some((st.doc.layers[k].uid, x.round(), y.round(), i, false));
        }
        None => {}
    }
    true
}

/// Reprend la forme `i` du calque `k` dans l'éditeur de chemin.
fn begin_path(app: &AppWindow, st: &mut State, k: usize, i: usize) {
    let Some(Obj::Shape(s)) = st.doc.layers[k].vector.as_ref().and_then(|v| v.objects.get(i)).cloned() else { return };
    let mut shape = s.clone();
    shape.bake_to_path();
    // le ruban reprend les réglages du chemin (avant de relever ceux de son dégradé)
    shape_edit::load_opts(app, &s);
    st.doc.active = k;
    let uid = st.doc.layers[k].uid;
    st.path_edit = Some(PathEdit { layer: uid, obj: Some(i), shape, saved: Some(s), sel: Vec::new(), drag: None, drawing: false, hover: None, raw: Vec::new(), grad_sig: opts(app).grad_sig() });
    sync_panels(app, st);
    vecview::touch(app, st);
    vecview::touch_overlay(app, st);
    status(app, "Sélection directe : glisser un point ou une poignée ; double-clic : ajouter un point, ou angle / lisse ; Suppr : retirer les points choisis");
}

/// Capture : met la forme `i` du calque `k` en Sélection directe, tous ses points choisis.
pub(crate) fn begin_path_at(app: &AppWindow, st: &mut State, k: usize, i: usize) {
    begin_path(app, st, k, i);
    if let Some(ed) = st.path_edit.as_mut() {
        ed.sel = ed.shape.subs.iter().enumerate().flat_map(|(c, s)| (0..s.nodes.len()).map(move |n| (c, n))).collect();
    }
}

/// Ce que prend un clic de l'outil Sélection directe sur le chemin en cours.
fn node_hit(ed: &PathEdit, x: f32, y: f32, tol: f32) -> Option<Drag> {
    let near = |p: (f32, f32)| (p.0 - x).abs() <= tol && (p.1 - y).abs() <= tol;
    // d'abord les poignées visibles (points choisis)
    for &(c, i) in &ed.sel {
        let Some(n) = ed.shape.subs.get(c).and_then(|s| s.nodes.get(i)) else { continue };
        if n.c_out != n.p && near(n.c_out) {
            return Some(Drag::Out(c, i));
        }
        if n.c_in != n.p && near(n.c_in) {
            return Some(Drag::In(c, i));
        }
    }
    None
}

fn node_at(ed: &PathEdit, x: f32, y: f32, tol: f32) -> Option<(usize, usize)> {
    for (c, s) in ed.shape.subs.iter().enumerate() {
        if let Some(i) = s.nodes.iter().position(|n| (n.p.0 - x).abs() <= tol && (n.p.1 - y).abs() <= tol) {
            return Some((c, i));
        }
    }
    None
}

/// Outil Sélection directe.
pub(crate) fn node_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32, shift: bool, alt: bool) {
    let tol = 6.0 / app.get_zoom().max(0.01);
    match kind {
        0 => {
            if st.path_edit.is_some() {
                let Some(ed) = st.path_edit.as_mut() else { return };
                if let Some(d) = node_hit(ed, x, y, tol) {
                    ed.drag = Some(d);
                    return;
                }
                if let Some(n) = node_at(ed, x, y, tol) {
                    if shift {
                        if let Some(k) = ed.sel.iter().position(|s| *s == n) {
                            ed.sel.remove(k);
                        } else {
                            ed.sel.push(n);
                        }
                    } else if !ed.sel.contains(&n) {
                        ed.sel = vec![n];
                    }
                    ed.drag = Some(Drag::Anchors((x, y)));
                    vecview::touch_overlay(app, st);
                    return;
                }
                if ed.shape.hit(x, y, tol) {
                    ed.sel.clear();
                    ed.drag = Some(Drag::Whole((x, y)));
                    vecview::touch_overlay(app, st);
                    return;
                }
                commit(app, st);
            }
            match pick(st, app.get_zoom(), x, y) {
                Some((k, i)) => {
                    let is_shape = matches!(st.doc.layers[k].vector.as_ref().and_then(|v| v.objects.get(i)), Some(Obj::Shape(_)));
                    if is_shape {
                        begin_path(app, st, k, i);
                    } else {
                        status(app, "Ce texte n'a pas de points : outil Sélection pour le déplacer, Objets SVG › Contours pour le changer en chemin");
                    }
                }
                None => status(app, ""),
            }
        }
        1 => {
            let Some(ed) = st.path_edit.as_mut() else { return };
            let Some(d) = ed.drag else {
                let over = node_hit(ed, x, y, tol).is_some() || node_at(ed, x, y, tol).is_some();
                app.set_canvas_cursor(if over { 2 } else if ed.shape.hit(x, y, tol) { 1 } else { 0 });
                return;
            };
            apply_drag(ed, d, x, y, alt);
            vecview::touch(app, st);
        }
        _ => {
            let Some(ed) = st.path_edit.as_mut() else { return };
            if ed.drag.take().is_some() {
                store(app, st, "Modifier le tracé");
            }
        }
    }
}

fn apply_drag(ed: &mut PathEdit, d: Drag, x: f32, y: f32, alt: bool) {
    let mirror = |n: &mut Node, p: (f32, f32), incoming: bool, alt: bool| {
        if incoming {
            n.c_in = p;
        } else {
            n.c_out = p;
        }
        if alt {
            n.smooth = false;
        } else if n.smooth {
            // poignée opposée alignée, sa longueur gardée
            let other = if incoming { n.c_out } else { n.c_in };
            let l = vector::dist(other, n.p);
            let dv = (n.p.0 - p.0, n.p.1 - p.1);
            let m = (dv.0 * dv.0 + dv.1 * dv.1).sqrt();
            if m > 1e-4 && l > 1e-4 {
                let o = (n.p.0 + dv.0 / m * l, n.p.1 + dv.1 / m * l);
                if incoming {
                    n.c_out = o;
                } else {
                    n.c_in = o;
                }
            }
        }
    };
    match d {
        Drag::Anchors(last) => {
            let (dx, dy) = (x - last.0, y - last.1);
            for &(c, i) in &ed.sel {
                if let Some(n) = ed.shape.subs.get_mut(c).and_then(|s| s.nodes.get_mut(i)) {
                    n.p = (n.p.0 + dx, n.p.1 + dy);
                    n.c_in = (n.c_in.0 + dx, n.c_in.1 + dy);
                    n.c_out = (n.c_out.0 + dx, n.c_out.1 + dy);
                }
            }
            ed.drag = Some(Drag::Anchors((x, y)));
        }
        Drag::Whole(last) => {
            let (dx, dy) = (x - last.0, y - last.1);
            ed.shape.map_points(&move |p| (p.0 + dx, p.1 + dy));
            ed.drag = Some(Drag::Whole((x, y)));
        }
        Drag::In(c, i) => {
            if let Some(n) = ed.shape.subs.get_mut(c).and_then(|s| s.nodes.get_mut(i)) {
                mirror(n, (x, y), true, alt);
            }
        }
        Drag::Out(c, i) => {
            if let Some(n) = ed.shape.subs.get_mut(c).and_then(|s| s.nodes.get_mut(i)) {
                mirror(n, (x, y), false, alt);
            }
        }
        Drag::NewAnchor(c, i) => {
            if let Some(n) = ed.shape.subs.get_mut(c).and_then(|s| s.nodes.get_mut(i)) {
                n.c_out = (x, y);
                n.c_in = (2.0 * n.p.0 - x, 2.0 * n.p.1 - y);
                n.smooth = true;
            }
        }
    }
    ed.shape.sync_geom();
}

/// Outil Plume.
pub(crate) fn pen_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32, alt: bool) {
    let close_tol = 7.0 / app.get_zoom().max(0.01);
    match kind {
        0 => {
            if st.path_edit.as_ref().is_some_and(|e| !e.drawing) {
                commit(app, st);
            }
            if st.path_edit.is_none() {
                let Some(uid) = target_layer(app, st) else { return };
                let o = opts(app);
                let mut shape = new_shape(app, o.style, o.line_width);
                shape.subs.push(SubPath { nodes: vec![Node::corner((x, y))], closed: false });
                shape.sync_geom();
                st.path_edit = Some(PathEdit { layer: uid, obj: None, shape, saved: None, sel: vec![(0, 0)], drag: Some(Drag::NewAnchor(0, 0)), drawing: true, hover: None, raw: Vec::new(), grad_sig: o.grad_sig() });
                status(app, "Plume : clic = point d'angle, glisser = point lisse ; clic sur le premier point = fermer ; Entrée = terminer");
            } else if let Some(ed) = st.path_edit.as_mut() {
                let c = ed.shape.subs.len().saturating_sub(1);
                let Some(sub) = ed.shape.subs.last_mut() else { return };
                let first = sub.nodes[0].p;
                if sub.nodes.len() >= 2 && vector::dist(first, (x, y)) <= close_tol {
                    sub.closed = true;
                    ed.drawing = false;
                    ed.hover = None;
                    ed.sel = vec![(c, 0)];
                    // glisser depuis le premier point : ajuste la courbe de fermeture (poignée entrante)
                    ed.drag = Some(Drag::In(c, 0));
                } else {
                    sub.nodes.push(Node::corner((x, y)));
                    let i = sub.nodes.len() - 1;
                    ed.sel = vec![(c, i)];
                    ed.drag = Some(Drag::NewAnchor(c, i));
                }
                ed.shape.sync_geom();
            }
            vecview::touch(app, st);
            vecview::touch_overlay(app, st);
        }
        1 => {
            let Some(ed) = st.path_edit.as_mut() else { return };
            if let Some(d) = ed.drag {
                apply_drag(ed, d, x, y, alt);
                vecview::touch(app, st);
                vecview::touch_overlay(app, st);
            } else if ed.drawing {
                ed.hover = Some((x, y));
                vecview::touch_overlay(app, st);
            }
        }
        _ => {
            let Some(ed) = st.path_edit.as_mut() else { return };
            ed.drag = None;
            if !ed.drawing {
                commit(app, st);
            }
        }
    }
}

/// Crayon : trait à main levée, ajusté en courbes de Bézier au relâchement.
pub(crate) fn pencil_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32) {
    match kind {
        0 => {
            commit(app, st);
            let Some(uid) = target_layer(app, st) else { return };
            let o = opts(app);
            let mut shape = new_shape(app, paint::ShapeStyle::Outline, o.size);
            shape.cap_start = 1;
            shape.cap_end = 1;
            shape.dash = 0;
            st.path_edit = Some(PathEdit { layer: uid, obj: None, shape, saved: None, sel: Vec::new(), drag: None, drawing: false, hover: None, raw: vec![(x, y)], grad_sig: o.grad_sig() });
        }
        1 => {
            let Some(ed) = st.path_edit.as_mut().filter(|e| !e.raw.is_empty()) else { return };
            let min = 1.5 / app.get_zoom().max(0.01);
            if ed.raw.last().is_some_and(|p| vector::dist(*p, (x, y)) < min) {
                return;
            }
            ed.raw.push((x, y));
            ed.shape.subs = vec![SubPath { nodes: ed.raw.iter().map(|&p| Node::corner(p)).collect(), closed: false }];
            ed.shape.sync_geom();
            vecview::touch(app, st);
        }
        _ => {
            let Some(ed) = st.path_edit.as_mut().filter(|e| !e.raw.is_empty()) else { return };
            let tol = 1.2 / app.get_zoom().max(0.01) + 0.2;
            let raw = std::mem::take(&mut ed.raw);
            if raw.len() >= 2 {
                ed.shape.subs = vec![SubPath { nodes: fit_curve(&raw, tol), closed: false }];
                ed.shape.sync_geom();
            } else {
                ed.shape.subs.clear();
            }
            commit(app, st);
        }
    }
}

/// Enregistre le chemin dans son calque (une étape d'historique si besoin) ; il reste en édition.
fn store(app: &AppWindow, st: &mut State, label: &str) {
    let o = opts(app);
    let Some(ed) = st.path_edit.as_mut() else { return };
    // nouveau chemin de la Plume : son dégradé, maintenant que son cadre est connu
    if ed.obj.is_none() && ed.raw.is_empty() && ed.shape.grad.is_none() {
        ed.shape.grad = o.shape_grad(ed.shape.bbox(), o.primary, o.secondary);
    }
    if ed.saved.as_ref() == Some(&ed.shape) || (ed.obj.is_none() && ed.shape.subs.is_empty()) {
        return;
    }
    let (uid, shape, mut obj) = (ed.layer, ed.shape.clone(), ed.obj);
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == uid) else { return };
    if let Some(v) = st.doc.layers[k].vector.as_mut() {
        match obj {
            Some(i) if i < v.objects.len() => v.objects[i] = Obj::Shape(shape.clone()),
            _ => {
                v.objects.push(Obj::Shape(shape.clone()));
                obj = Some(v.objects.len() - 1);
            }
        }
    }
    if let Some(ed) = st.path_edit.as_mut() {
        ed.obj = obj;
        ed.saved = Some(shape);
    }
    st.shape_layer_new = None;
    render_vector_layer(app, st, uid);
    st.doc.commit(label);
    refresh_all(app, st);
}

/// Termine le tracé ou la modification en cours.
pub(crate) fn commit(app: &AppWindow, st: &mut State) {
    let Some(ed) = st.path_edit.as_ref() else { return };
    let empty = ed.obj.is_none() && !ed.shape.subs.iter().any(|s| s.nodes.len() >= 2);
    if !empty {
        store(app, st, "Tracé");
    }
    st.path_edit = None;
    app.set_canvas_cursor(0);
    if empty {
        drop_empty_shape_layer(app, st);
    }
    vecview::touch(app, st);
    vecview::touch_overlay(app, st);
}

/// Touche Entrée ou Échap : termine le tracé. Vrai si un tracé était en cours.
pub(crate) fn finish_key(app: &AppWindow, st: &mut State) -> bool {
    if st.path_edit.is_none() {
        return false;
    }
    commit(app, st);
    true
}

/// Ctrl+Z : la Plume retire son dernier point. Vrai si l'annulation s'arrête là ; une modification
/// de points en cours se termine, l'annulation suit son cours dans l'historique.
pub(crate) fn undo_step(app: &AppWindow, st: &mut State) -> bool {
    let Some(ed) = st.path_edit.as_mut() else { return false };
    if !ed.drawing {
        st.path_edit = None;
        vecview::touch_overlay(app, st);
        return false;
    }
    remove_last_point(app, st);
    true
}

fn remove_last_point(app: &AppWindow, st: &mut State) {
    let Some(ed) = st.path_edit.as_mut() else { return };
    if let Some(sub) = ed.shape.subs.last_mut() {
        sub.nodes.pop();
        if sub.nodes.is_empty() {
            st.path_edit = None;
            drop_empty_shape_layer(app, st);
            vecview::touch(app, st);
            vecview::touch_overlay(app, st);
            return;
        }
    }
    ed.shape.sync_geom();
    vecview::touch(app, st);
    vecview::touch_overlay(app, st);
}

/// Suppr / Retour arrière dans un projet SVG : retire les points choisis, le dernier point de la
/// Plume ou l'objet choisi. Vrai si la touche est prise.
pub(crate) fn delete_key(app: &AppWindow, st: &mut State) -> bool {
    if st.path_edit.as_ref().is_some_and(|e| e.drawing) {
        remove_last_point(app, st);
        return true;
    }
    if let Some(ed) = st.path_edit.as_mut() {
        if ed.sel.is_empty() {
            let (uid, obj) = (ed.layer, ed.obj);
            st.path_edit = None;
            remove_object(app, st, uid, obj);
            return true;
        }
        let mut sel = std::mem::take(&mut ed.sel);
        sel.sort_unstable_by(|a, b| b.cmp(a));
        for (c, i) in sel {
            if let Some(s) = ed.shape.subs.get_mut(c) {
                if i < s.nodes.len() {
                    s.nodes.remove(i);
                }
            }
        }
        ed.shape.subs.retain(|s| s.nodes.len() >= 2);
        if ed.shape.subs.is_empty() {
            let (uid, obj) = (ed.layer, ed.obj);
            st.path_edit = None;
            remove_object(app, st, uid, obj);
            return true;
        }
        for s in &mut ed.shape.subs {
            s.closed = s.closed && s.nodes.len() >= 3;
        }
        ed.shape.sync_geom();
        store(app, st, "Supprimer des points");
        vecview::touch_overlay(app, st);
        return true;
    }
    if st.shape_edit.is_some() {
        let Some((uid, obj)) = shape_edit::take_for_delete(app, st) else { return true };
        remove_object(app, st, uid, obj);
        return true;
    }
    false
}

fn remove_object(app: &AppWindow, st: &mut State, uid: u64, obj: Option<usize>) {
    if let (Some(i), Some(k)) = (obj, st.doc.layers.iter().position(|l| l.uid == uid)) {
        if let Some(v) = st.doc.layers[k].vector.as_mut() {
            if i < v.objects.len() {
                v.objects.remove(i);
            }
        }
        render_vector_layer(app, st, uid);
        st.doc.commit("Supprimer l'objet");
        refresh_all(app, st);
    } else {
        vecview::touch(app, st);
    }
    vecview::touch_overlay(app, st);
}

/// Double-clic (position du dernier appui).
pub(crate) fn double_click(app: &AppWindow, st: &mut State, x: f32, y: f32) {
    let tol = 6.0 / app.get_zoom().max(0.01);
    match st.tool {
        Tool::Pen => {
            // le double-clic a posé un point de trop au même endroit
            if let Some(ed) = st.path_edit.as_mut().filter(|e| e.drawing) {
                if let Some(s) = ed.shape.subs.last_mut() {
                    let n = s.nodes.len();
                    if n >= 2 && vector::dist(s.nodes[n - 1].p, s.nodes[n - 2].p) <= tol {
                        s.nodes.pop();
                    }
                }
                ed.shape.sync_geom();
            }
            commit(app, st);
        }
        Tool::Node => node_double(app, st, x, y, tol),
        // Sélection : texte = saisie ; forme = ses points
        Tool::Move => {
            let Some((k, i)) = pick(st, app.get_zoom(), x, y) else { return };
            match st.doc.layers[k].vector.as_ref().and_then(|v| v.objects.get(i)) {
                Some(Obj::Text(_)) => {
                    st.vector_drag = None;
                    st.vector_drag_base = None;
                    set_tool(app, st, "tool-text");
                    begin_text(app, st, x, y);
                }
                Some(Obj::Shape(_)) => {
                    set_tool(app, st, "tool-node");
                    begin_path(app, st, k, i);
                }
                None => {}
            }
        }
        _ => {}
    }
}

fn node_double(app: &AppWindow, st: &mut State, x: f32, y: f32, tol: f32) {
    let Some(ed) = st.path_edit.as_mut() else { return };
    // sur un point : angle ↔ lisse
    if let Some((c, i)) = node_at(ed, x, y, tol) {
        let closed = ed.shape.subs[c].closed;
        let count = ed.shape.subs[c].nodes.len();
        let neighbour = |k: isize| {
            let n = count as isize;
            let j = if closed { (k + n) % n } else { k.clamp(0, n - 1) };
            ed.shape.subs[c].nodes[j as usize].p
        };
        let (prev, next) = (neighbour(i as isize - 1), neighbour(i as isize + 1));
        let n = &mut ed.shape.subs[c].nodes[i];
        if n.smooth || n.c_in != n.p || n.c_out != n.p {
            *n = Node::corner(n.p);
        } else {
            let t = ((next.0 - prev.0) / 6.0, (next.1 - prev.1) / 6.0);
            n.c_in = (n.p.0 - t.0, n.p.1 - t.1);
            n.c_out = (n.p.0 + t.0, n.p.1 + t.1);
            n.smooth = true;
        }
        ed.sel = vec![(c, i)];
        ed.shape.sync_geom();
        store(app, st, "Point d'angle / lisse");
        vecview::touch_overlay(app, st);
        return;
    }
    // sur un segment : nouveau point, la courbe reste exactement la même
    let mut best: Option<(usize, usize, f32, f32)> = None;
    for (c, s) in ed.shape.subs.iter().enumerate() {
        for (i, p0, c1, c2, p1) in s.segments() {
            for k in 0..=48 {
                let t = k as f32 / 48.0;
                let d = vector::dist(vector::cubic_at(p0, c1, c2, p1, t), (x, y));
                if best.is_none_or(|b| d < b.3) {
                    best = Some((c, i, t, d));
                }
            }
        }
    }
    let Some((c, i, t, d)) = best.filter(|b| b.3 <= tol.max(ed.shape.width / 2.0 + tol)) else { return };
    let _ = d;
    if t <= 0.0 || t >= 1.0 {
        return;
    }
    let sub = &mut ed.shape.subs[c];
    let n = sub.nodes.len();
    let j = (i + 1) % n;
    let (a, b) = (sub.nodes[i], sub.nodes[j]);
    let lerp = |u: (f32, f32), v: (f32, f32)| (u.0 + (v.0 - u.0) * t, u.1 + (v.1 - u.1) * t);
    let (q0, q1, q2) = (lerp(a.p, a.c_out), lerp(a.c_out, b.c_in), lerp(b.c_in, b.p));
    let (r0, r1) = (lerp(q0, q1), lerp(q1, q2));
    let m = lerp(r0, r1);
    let straight = a.c_out == a.p && b.c_in == b.p;
    sub.nodes[i].c_out = if straight { a.p } else { q0 };
    sub.nodes[j].c_in = if straight { b.p } else { q2 };
    let node = if straight { Node::corner(m) } else { Node { p: m, c_in: r0, c_out: r1, smooth: true } };
    sub.nodes.insert(i + 1, node);
    ed.sel = vec![(c, i + 1)];
    ed.shape.sync_geom();
    store(app, st, "Ajouter un point");
    vecview::touch_overlay(app, st);
}

/// Réglages du ruban changés : le chemin en cours les prend.
pub(crate) fn opts_changed(app: &AppWindow, st: &mut State) {
    let o = opts(app);
    let Some(ed) = st.path_edit.as_mut() else { return };
    let sig = o.grad_sig();
    let grad_changed = sig != ed.grad_sig && ed.raw.is_empty() && !ed.drawing;
    ed.grad_sig = sig;
    let s = &mut ed.shape;
    let before = s.clone();
    if grad_changed {
        s.grad = o.shape_grad(s.bbox(), o.primary, o.secondary);
    }
    s.color = [o.primary[0], o.primary[1], o.primary[2], s.color[3]];
    if !ed.raw.is_empty() {
        s.width = o.size.max(0.1);
    } else {
        s.width = o.line_width.max(0.1);
        s.style = o.style;
        s.fill = (o.style == paint::ShapeStyle::Both).then_some(o.secondary);
        s.dash = o.dash;
    }
    if *s != before {
        vecview::touch(app, st);
    }
}

/// Tracés d'édition : contour, points d'ancrage, poignées des points choisis, trait élastique.
pub(crate) fn draw_overlay(st: &State, ov: &mut vecview::Overlay) {
    gradlive::draw_overlay(st, ov);
    let Some(ed) = st.path_edit.as_ref().filter(|e| e.raw.is_empty()) else { return };
    ov.outline(&ed.shape.subs, None);
    if let (true, Some(h)) = (ed.drawing, ed.hover) {
        if let Some(last) = ed.shape.subs.last().and_then(|s| s.nodes.last()) {
            let band = SubPath { nodes: vec![Node { p: last.p, c_in: last.p, c_out: last.c_out, smooth: false }, Node::corner(h)], closed: false };
            ov.outline(&[band], None);
        }
    }
    for &(c, i) in &ed.sel {
        let Some(n) = ed.shape.subs.get(c).and_then(|s| s.nodes.get(i)) else { continue };
        if n.c_in != n.p {
            ov.line(n.p, n.c_in);
            ov.knob(n.c_in);
        }
        if n.c_out != n.p {
            ov.line(n.p, n.c_out);
            ov.knob(n.c_out);
        }
    }
    for (c, s) in ed.shape.subs.iter().enumerate() {
        for (i, n) in s.nodes.iter().enumerate() {
            ov.anchor(n.p, ed.sel.contains(&(c, i)));
        }
    }
}

/// Ajuste des courbes de Bézier sur une suite de points (méthode de Schneider) : `tol` est
/// l'écart maximal, en pixels du document.
pub(crate) fn fit_curve(pts: &[(f32, f32)], tol: f32) -> Vec<Node> {
    let mut clean: Vec<(f32, f32)> = Vec::with_capacity(pts.len());
    for &p in pts {
        if clean.last().is_none_or(|q| vector::dist(*q, p) > 1e-3) {
            clean.push(p);
        }
    }
    if clean.len() < 2 {
        return clean.into_iter().map(Node::corner).collect();
    }
    let n = clean.len();
    let t0 = unit_between(clean[1], clean[0]);
    let t1 = unit_between(clean[n - 2], clean[n - 1]);
    let mut segs = Vec::new();
    fit_range(&clean, t0, t1, tol * tol, &mut segs);
    let mut nodes = vec![Node::corner(clean[0])];
    for (c1, c2, p) in segs {
        if let Some(l) = nodes.last_mut() {
            l.c_out = c1;
            // jonction d'une courbe : les poignées restent alignées
            if vector::dist(l.c_in, l.p) > 1e-3 {
                l.smooth = true;
            }
        }
        nodes.push(Node { p, c_in: c2, c_out: p, smooth: false });
    }
    nodes
}

fn unit_between(to: (f32, f32), from: (f32, f32)) -> (f32, f32) {
    let (dx, dy) = (to.0 - from.0, to.1 - from.1);
    let l = (dx * dx + dy * dy).sqrt().max(1e-6);
    (dx / l, dy / l)
}

type Seg = ((f32, f32), (f32, f32), (f32, f32));

fn fit_range(p: &[(f32, f32)], t0: (f32, f32), t1: (f32, f32), tol2: f32, out: &mut Vec<Seg>) {
    let n = p.len();
    if n == 2 {
        let d = vector::dist(p[0], p[1]) / 3.0;
        out.push(((p[0].0 + t0.0 * d, p[0].1 + t0.1 * d), (p[1].0 + t1.0 * d, p[1].1 + t1.1 * d), p[1]));
        return;
    }
    // paramètres selon la longueur parcourue, puis quelques corrections de Newton
    let mut u = vec![0.0f32; n];
    for i in 1..n {
        u[i] = u[i - 1] + vector::dist(p[i - 1], p[i]);
    }
    let total = u[n - 1].max(1e-6);
    u.iter_mut().for_each(|v| *v /= total);
    let mut best = solve_cubic(p, &u, t0, t1);
    let (mut err, mut split) = fit_error(p, &u, best);
    if err > tol2 && err <= tol2 * 16.0 {
        for _ in 0..4 {
            for i in 1..n - 1 {
                u[i] = newton(best, p[i], u[i]).clamp(0.0, 1.0);
            }
            best = solve_cubic(p, &u, t0, t1);
            (err, split) = fit_error(p, &u, best);
            if err <= tol2 {
                break;
            }
        }
    }
    if err <= tol2 {
        out.push((best.1, best.2, best.3));
        return;
    }
    let k = split.clamp(1, n - 2);
    let tc = unit_between(p[k - 1], p[k + 1]);
    fit_range(&p[..=k], t0, tc, tol2, out);
    fit_range(&p[k..], (-tc.0, -tc.1), t1, tol2, out);
}

type Cubic = ((f32, f32), (f32, f32), (f32, f32), (f32, f32));

fn solve_cubic(p: &[(f32, f32)], u: &[f32], t0: (f32, f32), t1: (f32, f32)) -> Cubic {
    let (first, last) = (p[0], p[p.len() - 1]);
    let (mut c00, mut c01, mut c11, mut x0, mut x1) = (0.0f32, 0.0f32, 0.0f32, 0.0f32, 0.0f32);
    for (q, &t) in p.iter().zip(u) {
        let m = 1.0 - t;
        let (b0, b1, b2, b3) = (m * m * m, 3.0 * t * m * m, 3.0 * t * t * m, t * t * t);
        let (a0, a1) = ((t0.0 * b1, t0.1 * b1), (t1.0 * b2, t1.1 * b2));
        c00 += a0.0 * a0.0 + a0.1 * a0.1;
        c01 += a0.0 * a1.0 + a0.1 * a1.1;
        c11 += a1.0 * a1.0 + a1.1 * a1.1;
        let d = (q.0 - (first.0 * (b0 + b1) + last.0 * (b2 + b3)), q.1 - (first.1 * (b0 + b1) + last.1 * (b2 + b3)));
        x0 += a0.0 * d.0 + a0.1 * d.1;
        x1 += a1.0 * d.0 + a1.1 * d.1;
    }
    let det = c00 * c11 - c01 * c01;
    let seg = vector::dist(first, last);
    let (mut a, mut b) = if det.abs() > 1e-9 { ((x0 * c11 - x1 * c01) / det, (c00 * x1 - c01 * x0) / det) } else { (0.0, 0.0) };
    // solution dégénérée : poignées au tiers
    if a < seg * 1e-3 || b < seg * 1e-3 {
        a = seg / 3.0;
        b = seg / 3.0;
    }
    (first, (first.0 + t0.0 * a, first.1 + t0.1 * a), (last.0 + t1.0 * b, last.1 + t1.1 * b), last)
}

fn fit_error(p: &[(f32, f32)], u: &[f32], c: Cubic) -> (f32, usize) {
    let (mut worst, mut at) = (0.0, p.len() / 2);
    for (i, (q, &t)) in p.iter().zip(u).enumerate() {
        let m = vector::cubic_at(c.0, c.1, c.2, c.3, t);
        let d = (m.0 - q.0).powi(2) + (m.1 - q.1).powi(2);
        if d > worst {
            (worst, at) = (d, i);
        }
    }
    (worst, at)
}

fn newton(c: Cubic, q: (f32, f32), t: f32) -> f32 {
    let m = 1.0 - t;
    let d1 = |a: f32, b: f32, e: f32, f: f32| 3.0 * m * m * (b - a) + 6.0 * m * t * (e - b) + 3.0 * t * t * (f - e);
    let d2 = |a: f32, b: f32, e: f32, f: f32| 6.0 * m * (e - 2.0 * b + a) + 6.0 * t * (f - 2.0 * e + b);
    let p = vector::cubic_at(c.0, c.1, c.2, c.3, t);
    let (dx, dy) = (d1(c.0 .0, c.1 .0, c.2 .0, c.3 .0), d1(c.0 .1, c.1 .1, c.2 .1, c.3 .1));
    let (ddx, ddy) = (d2(c.0 .0, c.1 .0, c.2 .0, c.3 .0), d2(c.0 .1, c.1 .1, c.2 .1, c.3 .1));
    let num = (p.0 - q.0) * dx + (p.1 - q.1) * dy;
    let den = dx * dx + dy * dy + (p.0 - q.0) * ddx + (p.1 - q.1) * ddy;
    if den.abs() < 1e-9 { t } else { t - num / den }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Trait à main levée : une courbe lisse devient peu de points, fidèles au tracé.
    #[test]
    fn freehand_fit_is_compact_and_close() {
        let raw: Vec<(f32, f32)> = (0..200).map(|i| {
            let t = i as f32 * 0.03;
            (i as f32 * 2.0, 60.0 + 40.0 * t.sin())
        }).collect();
        let nodes = fit_curve(&raw, 0.8);
        assert!(nodes.len() < 30, "{} points", nodes.len());
        let sub = SubPath { nodes, closed: false };
        let flat = sub.flatten();
        for q in raw.iter().step_by(7) {
            let d = flat.iter().map(|p| vector::dist(*p, *q)).fold(f32::MAX, f32::min);
            assert!(d < 4.0, "écart {d} en {q:?}");
        }
    }
}
