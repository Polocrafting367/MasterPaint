// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Onglet Masque du Mode Photo Pro (repris de LightCraft) : liste des masques de la photo
//! active, réglages de la forme et réglages locaux, poignées des dégradés, pinceau, pipette de
//! la plage de couleur et voile rouge du masque choisi. Le calcul est dans le moteur
//! (masterpaint-core fx_camraw_masks), les masques voyageant avec les réglages.

use super::*;
use photo::PmMask;

/// Liste, masque choisi et ses valeurs vers l'interface.
pub(crate) fn sync(app: &AppWindow, st: &State) {
    let pm = &st.photo;
    let Some(p) = pm.photos.get(pm.active) else {
        app.set_pm_masks(ModelRc::default());
        app.set_pm_mask_sel(-1);
        return;
    };
    let rows: Vec<PmMaskRow> = p.masks.iter().map(|m| PmMaskRow { name: m.name.as_str().into(), kind: m.kind as i32, visible: m.visible, invert: m.invert }).collect();
    app.set_pm_masks(ModelRc::new(VecModel::from(rows)));
    let sel = if (pm.mask_sel as usize) < p.masks.len() && pm.mask_sel >= 0 { pm.mask_sel } else { -1 };
    app.set_pm_mask_sel(sel);
    match p.masks.get(sel.max(0) as usize).filter(|_| sel >= 0) {
        Some(m) => {
            app.set_pm_mask_kind(m.kind as i32);
            app.set_pm_mask_amount(m.amount);
            app.set_pm_mask_adjust(ModelRc::new(VecModel::from(m.adjust.clone())));
            app.set_pm_mask_shape(ModelRc::new(VecModel::from(m.shape.clone())));
            app.set_pm_mask_handles(ModelRc::new(VecModel::from(handles(p, m))));
        }
        None => {
            app.set_pm_mask_kind(0);
            app.set_pm_mask_handles(ModelRc::default());
            app.set_pm_mask_image(Image::default());
        }
    }
}

/// Unités du grand côté → fractions de la largeur et de la hauteur de la photo.
fn units(p: &photo::Photo) -> (f32, f32) {
    let a = p.w as f32 / p.h.max(1) as f32;
    if a >= 1.0 { (1.0, a) } else { (1.0 / a, 1.0) }
}

/// Poignées (u, v) sur la photo : linéaire départ / arrivée ; radial centre, bord droit, bord bas.
fn handles(p: &photo::Photo, m: &PmMask) -> Vec<f32> {
    let s = |i: usize| m.shape.get(i).copied().unwrap_or(0.0);
    match m.kind {
        1 => vec![s(0), s(1), s(2), s(3)],
        2 => {
            let (ku, kv) = units(p);
            vec![s(0), s(1), s(0) + s(2) * ku, s(1), s(0), s(1) + s(3) * kv]
        }
        _ => Vec::new(),
    }
}

fn changed(app: &AppWindow, st: &mut State) {
    let active = st.photo.active;
    if let Some(p) = st.photo.photos.get_mut(active) {
        p.modified = true;
    }
    sync(app, st);
    pm_render(app, st);
}

/// Actions des boutons de l'onglet (`mask-add:K`, `mask-del:I`, `mask-sel:I`, `mask-vis:I`,
/// `mask-inv:I`). Faux : action inconnue.
pub(crate) fn action(app: &AppWindow, st: &mut State, a: &str) -> bool {
    let (verb, arg) = a.split_once(':').unwrap_or((a, ""));
    let k: usize = arg.parse().unwrap_or(0);
    let active = st.photo.active;
    let Some(p) = st.photo.photos.get_mut(active) else { return true };
    match verb {
        "mask-add" => {
            let n = p.masks.len() + 1;
            let mut m = PmMask::new(k as u32, n);
            // un masque neuf éclaircit un peu, pour qu'on voie tout de suite où il agit
            m.adjust[0] = 30.0;
            p.masks.push(m);
            st.photo.mask_sel = (p.masks.len() - 1) as i32;
            app.set_pm_mask_overlay(true);
        }
        "mask-del" if k < p.masks.len() => {
            p.masks.remove(k);
            st.photo.mask_sel = (k as i32 - 1).max(if p.masks.is_empty() { -1 } else { 0 });
        }
        "mask-sel" if k < p.masks.len() => st.photo.mask_sel = k as i32,
        "mask-vis" if k < p.masks.len() => p.masks[k].visible = !p.masks[k].visible,
        "mask-inv" if k < p.masks.len() => p.masks[k].invert = !p.masks[k].invert,
        "mask-dup" if k < p.masks.len() => {
            let mut m = p.masks[k].clone();
            m.name = format!("{} ({})", m.name, i18n::tr("copie"));
            p.masks.insert(k + 1, m);
            st.photo.mask_sel = k as i32 + 1;
        }
        _ => return false,
    }
    changed(app, st);
    true
}

/// Valeur réglée dans le panneau : `amount`, `adj:J` (réglage local J), `shape:I` (valeur I
/// de la forme), `brush:size|feather|flow|erase`.
pub(crate) fn set(app: &AppWindow, st: &mut State, field: &str, v: f32) {
    if let Some(b) = field.strip_prefix("brush:") {
        let pm = &mut st.photo;
        match b {
            "size" => pm.brush.0 = v.clamp(0.5, 50.0),
            "feather" => pm.brush.1 = v.clamp(0.0, 100.0),
            "flow" => pm.brush.2 = v.clamp(1.0, 100.0),
            _ => pm.brush.3 = v > 0.5,
        }
        return sync_brush(app, st);
    }
    let (active, sel) = (st.photo.active, st.photo.mask_sel);
    let Some(m) = st.photo.photos.get_mut(active).and_then(|p| p.masks.get_mut(sel.max(0) as usize)).filter(|_| sel >= 0) else { return };
    if field == "amount" {
        m.amount = v.clamp(0.0, 100.0);
    } else if let Some(j) = field.strip_prefix("adj:").and_then(|j| j.parse::<usize>().ok()) {
        if j < m.adjust.len() {
            m.adjust[j] = v;
        }
    } else if let Some(i) = field.strip_prefix("shape:").and_then(|i| i.parse::<usize>().ok()) {
        if i < m.shape.len() {
            m.shape[i] = v;
        }
    } else if field == "brush-clear" && m.kind == 3 {
        m.shape = vec![0.0];
    }
    changed(app, st);
}

/// Réglages du pinceau vers l'interface.
pub(crate) fn sync_brush(app: &AppWindow, st: &State) {
    let b = st.photo.brush;
    app.set_pm_brush(ModelRc::new(VecModel::from(vec![b.0, b.1, b.2, if b.3 { 1.0 } else { 0.0 }])));
}

/// Glisser sur la photo (`u`, `v` en fractions) : poignée `handle` (0, 1, 2), ou −1 pour le
/// pinceau et la pipette de la plage de couleur ; `phase` 0 appui, 1 mouvement, 2 relâché.
pub(crate) fn drag(app: &AppWindow, st: &mut State, handle: i32, u: f32, v: f32, phase: i32) {
    let (u, v) = (u.clamp(-0.5, 1.5), v.clamp(-0.5, 1.5));
    let (active, sel) = (st.photo.active, st.photo.mask_sel);
    let brush = st.photo.brush;
    let live = st.photo.last_live.clone();
    let Some(p) = st.photo.photos.get_mut(active) else { return };
    let (ku, kv) = units(p);
    let Some(m) = p.masks.get_mut(sel.max(0) as usize).filter(|_| sel >= 0) else { return };
    match (m.kind, handle) {
        (1, 0 | 1) => {
            let o = handle as usize * 2;
            m.shape[o] = u;
            m.shape[o + 1] = v;
        }
        (2, 0) => {
            m.shape[0] = u;
            m.shape[1] = v;
        }
        (2, 1) => m.shape[2] = ((u - m.shape[0]).abs() / ku).max(0.005),
        (2, 2) => m.shape[3] = ((v - m.shape[1]).abs() / kv).max(0.005),
        // pinceau : un trait par appui, prolongé à chaque mouvement
        (3, -1) => {
            if phase == 0 {
                st.photo.stroke_base = m.shape.clone();
                st.photo.stroke = vec![(u, v)];
            } else if phase == 1 {
                st.photo.stroke.push((u, v));
            } else {
                return;
            }
            // forme d'avant le trait, plus le trait entier jusqu'au pointeur
            let pts = st.photo.stroke.clone();
            m.shape = st.photo.stroke_base.clone();
            m.add_stroke(brush.0 / 100.0, brush.1, brush.2, brush.3, &pts);
        }
        // pipette : couleur de l'aperçu sous le pointeur
        (5, -1) => {
            if phase == 2 {
                return;
            }
            let (lw, lh, px) = live;
            if lw == 0 || px.len() < lw * lh * 4 {
                return;
            }
            let (x, y) = (((u * lw as f32) as usize).min(lw - 1), ((v * lh as f32) as usize).min(lh - 1));
            let o = (y * lw + x) * 4;
            m.shape[0] = px[o] as f32 / 255.0;
            m.shape[1] = px[o + 1] as f32 / 255.0;
            m.shape[2] = px[o + 2] as f32 / 255.0;
        }
        _ => return,
    }
    changed(app, st);
}

/// Voile rouge du masque choisi sur l'aperçu tout juste rendu (`px`, `w` × `h`).
pub(crate) fn overlay(app: &AppWindow, st: &State, px: &[u8], w: usize, h: usize) {
    let pm = &st.photo;
    let sel = pm.mask_sel;
    let params = pm.photos.get(pm.active).filter(|_| sel >= 0 && app.get_pm_mask_overlay() && app.get_pm_module() == 2).and_then(|p| p.overlay_params(sel as usize));
    let Some(params) = params else {
        return app.set_pm_mask_image(Image::default());
    };
    let Some(a) = masterpaint_core::camera_raw_mask_alpha(&params, 0, w, h, px) else { return };
    let mut img = vec![0u8; w * h * 4];
    for (i, v) in a.iter().enumerate() {
        img[i * 4..i * 4 + 4].copy_from_slice(&[235, 40, 70, (*v as u16 * 140 / 255) as u8]);
    }
    app.set_pm_mask_image(to_image(&img, w, h));
}
