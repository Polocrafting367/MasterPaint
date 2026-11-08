// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Panneau « Objets SVG (bêta) » (Fenêtre › Objets SVG) : objets du calque vectoriel actif,
//! le plus haut en premier. Un clic choisit l'objet ; monter, descendre, dupliquer,
//! supprimer, et pour l'objet choisi couleur, épaisseur du trait et style (contour / plein /
//! les deux), modifiables après coup. Chaque modification est une étape d'historique et le
//! calque est re-rendu (pile d'effets comprise, voir `render_vector_layer`).
//!
//! L'état affiché vit dans le global Slint `SvgPanel` (ui/svg_objects.slint) : l'objet choisi
//! y est un indice dans `VectorLayer::objects` (0 = dessous), remis à zéro quand le calque
//! actif change.

use crate::{vector, AppWindow, Shared, State, SvgObjRow, SvgPanel};
use crate::paint::ShapeStyle;
use slint::{Color, ComponentHandle};
use std::cell::Cell;

thread_local! {
    /// calque (uid) auquel se rapporte l'objet choisi du panneau
    static SEL_LAYER: Cell<u64> = const { Cell::new(0) };
}

/// Nom d'une forme (`ShapeObj::kind`) dans la liste.
fn shape_name(kind: &str) -> &'static str {
    match kind {
        "rect" => "Rectangle",
        "roundrect" => "Rectangle arrondi",
        "ellipse" => "Ellipse",
        "line" => "Ligne",
        "polygon" => "Polygone",
        "polyline" => "Polyligne",
        "path" => "Tracé",
        "triangle" => "Triangle",
        "triangle-right" => "Triangle rectangle",
        "diamond" => "Losange",
        "trapezoid" => "Trapèze",
        "parallelogram" => "Parallélogramme",
        "pentagon" => "Pentagone",
        "hexagon" => "Hexagone",
        "heptagon" => "Heptagone",
        "octagon" => "Octogone",
        k if k.starts_with("star") => "Étoile",
        k if k.starts_with("ngon") => "Polygone",
        "arrow" => "Flèche",
        "cross" => "Croix",
        "heart" => "Cœur",
        "callout-rect" | "callout-oval" => "Bulle",
        _ => "Forme",
    }
}

/// Libellé d'un objet : « Rectangle », « Ellipse », « Texte : début du texte… ».
fn obj_name(o: &vector::Obj) -> String {
    match o {
        vector::Obj::Shape(s) => crate::i18n::tr(shape_name(&s.kind)),
        vector::Obj::Text(t) => {
            let first = t.text.lines().find(|l| !l.trim().is_empty()).unwrap_or("").trim();
            let mut short: String = first.chars().take(24).collect();
            if first.chars().count() > 24 || t.text.trim().lines().count() > 1 {
                short.push('…');
            }
            format!("{} : {short}", crate::i18n::tr("Texte"))
        }
    }
}

/// Icône Font Awesome de l'objet (carré, cercle, trait, polygone, texte).
fn obj_glyph(o: &vector::Obj) -> &'static str {
    match o {
        vector::Obj::Text(_) => "\u{f031}",
        vector::Obj::Shape(s) => match s.kind.as_str() {
            "rect" | "roundrect" => "\u{f0c8}",
            "ellipse" => "\u{f111}",
            "line" | "polyline" => "\u{f068}",
            k if k.starts_with("star") => "\u{f005}",
            "heart" => "\u{f004}",
            "arrow" => "\u{f061}",
            "callout-rect" | "callout-oval" => "\u{f075}",
            _ => "\u{f5ee}",
        },
    }
}

fn color_of(c: [u8; 4]) -> Color {
    Color::from_argb_u8(c[3], c[0], c[1], c[2])
}

/// Remet le panneau à jour (calque actif, liste, réglages de l'objet choisi) ; rien si fermé.
/// Appelé par `sync_panels` (donc après chaque `refresh_all`).
pub fn sync(app: &AppWindow, st: &State) {
    let g = app.global::<SvgPanel>();
    if !g.get_open() {
        return;
    }
    let l = st.doc.layer();
    g.set_layer_name(l.name.as_str().into());
    let Some(v) = l.vector.as_deref() else {
        g.set_is_vector(false);
        crate::sync_rows(g.get_rows(), Vec::new(), |m| g.set_rows(m));
        g.set_selected(-1);
        g.set_obj_kind(0);
        return;
    };
    g.set_is_vector(true);
    let n = v.objects.len();
    // autre calque : plus d'objet choisi ; objet disparu (annuler, suppression) : le plus haut
    let same = SEL_LAYER.with(|c| c.replace(l.uid)) == l.uid;
    let mut sel = if same { g.get_selected() } else { -1 };
    if sel >= n as i32 {
        sel = n as i32 - 1;
    }
    g.set_selected(sel);
    g.set_count(n as i32);
    let rows: Vec<SvgObjRow> = (0..n)
        .rev()
        .map(|i| {
            let o = &v.objects[i];
            let c = match o {
                vector::Obj::Shape(s) => s.color,
                vector::Obj::Text(t) => t.color,
            };
            SvgObjRow { index: i as i32, name: obj_name(o).into(), glyph: obj_glyph(o).into(), swatch: color_of(c) }
        })
        .collect();
    crate::sync_rows(g.get_rows(), rows, |m| g.set_rows(m));
    // réglages de l'objet choisi : 1 forme, 2 trait (ligne, polyligne : épaisseur seule), 3 texte
    match usize::try_from(sel).ok().and_then(|i| v.objects.get(i)) {
        Some(vector::Obj::Shape(s)) => {
            g.set_obj_kind(if matches!(s.kind.as_str(), "line" | "polyline") { 2 } else { 1 });
            g.set_obj_color(color_of(s.color));
            g.set_obj_width(s.width);
            g.set_obj_style(match s.style {
                ShapeStyle::Outline => 0,
                ShapeStyle::Fill => 1,
                ShapeStyle::Both => 2,
            });
        }
        Some(vector::Obj::Text(t)) => {
            g.set_obj_kind(3);
            g.set_obj_color(color_of(t.color));
        }
        None => g.set_obj_kind(0),
    }
}

/// Fenêtre › Objets SVG : ouvre ou ferme le panneau.
pub fn toggle(app: &AppWindow, st: &State) {
    let g = app.global::<SvgPanel>();
    g.set_open(!g.get_open());
    sync(app, st);
}

/// Objet saisi à l'outil Déplacer : il devient l'objet choisi du panneau.
pub fn picked(app: &AppWindow, st: &State, i: usize) {
    SEL_LAYER.with(|c| c.set(st.doc.layer().uid));
    app.global::<SvgPanel>().set_selected(i as i32);
    sync(app, st);
}

/// Modifie les objets du calque actif : `f` rend le libellé de l'étape et l'objet choisi
/// ensuite (`None` : rien n'a changé). Puis rendu du calque, étape d'historique si `commit`
/// (sinon aperçu pendant un glisser) et panneau à jour.
fn edit(app: &AppWindow, st: &mut State, commit: bool, f: impl FnOnce(&mut vector::VectorLayer) -> Option<(&'static str, Option<usize>)>) {
    if let Some(why) = st.doc.edit_refusal() {
        crate::status(app, why);
        return;
    }
    crate::drop_floating(app, st);
    crate::commit_text(app, st);
    let k = st.doc.active;
    let uid = st.doc.layers[k].uid;
    let Some(v) = st.doc.layers[k].vector.as_deref_mut() else {
        return sync(app, st);
    };
    let Some((label, sel)) = f(v) else { return };
    SEL_LAYER.with(|c| c.set(uid));
    app.global::<SvgPanel>().set_selected(sel.map_or(-1, |i| i as i32));
    crate::render_vector_layer(app, st, uid);
    if commit {
        st.doc.commit(label);
    }
    crate::refresh_all(app, st);
}

/// Objet choisi du panneau (indice dans les objets du calque).
fn selected(app: &AppWindow) -> Option<usize> {
    usize::try_from(app.global::<SvgPanel>().get_selected()).ok()
}

/// Boutons du panneau : « new-layer », « up », « down », « duplicate », « delete », « color ».
pub fn action(app: &AppWindow, st: &mut State, what: &str) {
    if what == "new-layer" {
        crate::layer_op(app, st, "vector-new");
        app.global::<SvgPanel>().set_selected(-1);
        return sync(app, st);
    }
    let Some(i) = selected(app) else {
        return crate::status(app, "Objets SVG : choisissez d'abord un objet dans la liste");
    };
    let primary = crate::rgba(app.get_primary_color());
    edit(app, st, true, |v| {
        let n = v.objects.len();
        if i >= n {
            return None;
        }
        match what {
            // liste du plus haut au plus bas : monter = dessiné plus tard
            "up" if i + 1 < n => {
                v.objects.swap(i, i + 1);
                Some(("Objet SVG : monter", Some(i + 1)))
            }
            "down" if i > 0 => {
                v.objects.swap(i, i - 1);
                Some(("Objet SVG : descendre", Some(i - 1)))
            }
            "duplicate" => {
                // copie juste au-dessus, décalée pour qu'on la voie
                let copy = v.objects[i].clone();
                v.objects.insert(i + 1, copy);
                v.translate_obj(i + 1, 10.0, 10.0);
                Some(("Objet SVG : dupliquer", Some(i + 1)))
            }
            "delete" => {
                v.objects.remove(i);
                Some(("Objet SVG : supprimer", (n > 1).then(|| i.min(n - 2))))
            }
            // couleur principale, opacité de l'objet gardée (comme le pot de peinture)
            "color" => {
                match &mut v.objects[i] {
                    vector::Obj::Shape(s) => s.color = [primary[0], primary[1], primary[2], s.color[3]],
                    vector::Obj::Text(t) => t.color = [primary[0], primary[1], primary[2], t.color[3]],
                }
                Some(("Objet SVG : couleur", Some(i)))
            }
            _ => None,
        }
    });
}

/// Clic sur une ligne de la liste : l'objet devient l'objet choisi (sans étape d'historique).
pub fn select(app: &AppWindow, st: &State, i: i32) {
    SEL_LAYER.with(|c| c.set(st.doc.layer().uid));
    app.global::<SvgPanel>().set_selected(i);
    sync(app, st);
}

/// Épaisseur du trait de l'objet choisi : aperçu pendant le glisser, étape au relâchement.
pub fn set_width(app: &AppWindow, st: &mut State, value: f32, commit: bool) {
    if !value.is_finite() {
        return;
    }
    let Some(i) = selected(app) else { return };
    let value = value.round().clamp(1.0, 100.0);
    edit(app, st, commit, |v| match v.objects.get_mut(i) {
        Some(vector::Obj::Shape(s)) if s.width != value || commit => {
            s.width = value;
            Some(("Objet SVG : épaisseur du trait", Some(i)))
        }
        _ => None,
    });
}

/// Style de la forme choisie : 0 contour, 1 plein, 2 les deux.
pub fn set_style(app: &AppWindow, st: &mut State, style: i32) {
    let Some(i) = selected(app) else { return };
    let style = match style {
        1 => ShapeStyle::Fill,
        2 => ShapeStyle::Both,
        _ => ShapeStyle::Outline,
    };
    edit(app, st, true, |v| match v.objects.get_mut(i) {
        Some(vector::Obj::Shape(s)) if s.style != style && !matches!(s.kind.as_str(), "line" | "polyline") => {
            s.style = style;
            Some(("Objet SVG : style", Some(i)))
        }
        _ => None,
    });
}

/// Branche les rappels du panneau (appelé une fois au démarrage, avec les autres fenêtres).
pub fn wire(app: &AppWindow, state: &Shared) {
    let g = app.global::<SvgPanel>();
    {
        let weak = app.as_weak();
        let state = state.clone();
        g.on_select(move |i| select(&weak.unwrap(), &state.borrow(), i));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        g.on_action(move |what| action(&weak.unwrap(), &mut state.borrow_mut(), &what));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        g.on_width_edited(move |v, commit| set_width(&weak.unwrap(), &mut state.borrow_mut(), v, commit));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        g.on_style_edited(move |s| set_style(&weak.unwrap(), &mut state.borrow_mut(), s));
    }
}
