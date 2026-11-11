// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Composition de l'affichage sur la carte graphique (gpu.rs `compose_submit`), pour que les
//! grandes images restent fluides, surtout dans le navigateur où le processeur n'a qu'un fil.
//! Bureau : résultat attendu sur place (même déroulé que le calcul CPU). Navigateur (WebGPU) :
//! résultat asynchrone ; l'ancien contenu reste affiché le temps d'une image, puis le
//! rectangle est remplacé. Les rectangles recomposés par le CPU entre-temps (traits de pinceau)
//! sont plus récents : ils sont refaits après coup, et un résultat dépassé est jeté.
//! Navigateur sans WebGPU : passerelle WebGL2 (webgl.rs, `window.mpGL`), résultat immédiat.
//! Sans carte graphique, accélération coupée, dossiers de calques ou image trop grande pour les
//! tampons : composition CPU, comme avant.

use super::*;
use std::cell::Cell;

/// Rectangle (x0, y0, x1, y1 exclus) de l'affichage ou de l'aperçu de fond.
pub(crate) type Rect = (usize, usize, usize, usize);

/// Image composée : affichage au pas `st.ds`, ou aperçu de fond (mode `lazy`) au pas `st.bs`.
#[derive(Clone, Copy, PartialEq)]
pub(crate) enum Target {
    Display,
    Backdrop,
}

/// En dessous (pixels × échantillons × calques), le processeur répond aussi vite : bureau, tous
/// les cœurs ; navigateur, un seul fil.
#[cfg(not(target_arch = "wasm32"))]
const MIN_WORK: usize = 2_000_000;
#[cfg(target_arch = "wasm32")]
const MIN_WORK: usize = 250_000;

thread_local! {
    /// numéro de la dernière composition confiée à la carte graphique
    static GEN: Cell<u64> = const { Cell::new(0) };
    /// compositions en route (navigateur)
    static PENDING: Cell<usize> = const { Cell::new(0) };
    /// rectangles recomposés par le CPU pendant qu'une composition était en route :
    /// (dernier numéro confié à ce moment, cible, rectangle)
    static CPU_RECTS: RefCell<Vec<(u64, Target, Rect)>> = const { RefCell::new(Vec::new()) };
    /// compositions déjà posées (numéro, cible, rectangle) : un résultat plus ancien, entièrement
    /// recouvert, est jeté
    static APPLIED: RefCell<Vec<(u64, Target, Rect)>> = const { RefCell::new(Vec::new()) };
}

fn step(st: &State, target: Target) -> usize {
    match target {
        Target::Display => st.ds,
        Target::Backdrop => st.bs,
    }
    .max(1)
}

fn buffer(st: &mut State, target: Target) -> &mut Vec<u8> {
    match target {
        Target::Display => &mut st.display,
        Target::Backdrop => &mut st.backdrop,
    }
}

#[cfg(target_arch = "wasm32")]
fn contains(a: Rect, b: Rect) -> bool {
    a.0 <= b.0 && a.1 <= b.1 && a.2 >= b.2 && a.3 >= b.3
}

#[cfg(target_arch = "wasm32")]
fn intersect(a: Rect, b: Rect) -> Option<Rect> {
    let r = (a.0.max(b.0), a.1.max(b.1), a.2.min(b.2), a.3.min(b.3));
    (r.2 > r.0 && r.3 > r.1).then_some(r)
}

/// Composition CPU du rectangle `r` (notée si une composition GPU est en route).
pub(crate) fn cpu(st: &mut State, target: Target, r: Rect) {
    let ds = step(st, target);
    match target {
        Target::Display => st.doc.composite_scaled(&mut st.display, ds, r, false),
        Target::Backdrop => st.doc.composite_scaled(&mut st.backdrop, ds, r, false),
    }
    if PENDING.with(|p| p.get()) > 0 {
        let g = GEN.with(|g| g.get());
        CPU_RECTS.with(|v| v.borrow_mut().push((g, target, r)));
    }
}

/// Compose `r` : carte graphique si possible, sinon processeur.
pub(crate) fn view(app: &AppWindow, st: &mut State, target: Target, r: Rect) {
    DEFERRED.with(|d| d.set(false));
    if target == Target::Display && gesture_active() && coarse(app, st, r) {
        return;
    }
    if !compose(app, st, target, r) {
        cpu(st, target, r);
    }
}

thread_local! {
    /// l'affichage montre une composition grossière (geste) : à refaire nette ensuite
    static COARSE_SHOWN: Cell<bool> = const { Cell::new(false) };
    /// navigateur (WebGL) : composition grossière en route (une seule à la fois)
    #[cfg(target_arch = "wasm32")]
    static ASYNC_FLIGHT: Cell<bool> = const { Cell::new(false) };
    /// image changée pendant ce calcul : une nouvelle composition est à lancer à son arrivée
    #[cfg(target_arch = "wasm32")]
    static ASYNC_DIRTY: Cell<bool> = const { Cell::new(false) };
    /// la dernière composition n'a rien écrit (résultat attendu plus tard) : rien à renvoyer à
    /// l'interface pour l'instant
    static DEFERRED: Cell<bool> = const { Cell::new(false) };
}

/// Vrai (remis à faux) si la dernière composition de l'affichage n'a rien écrit : son résultat
/// arrivera plus tard et sera envoyé à l'interface à ce moment-là (`arrive`).
pub(crate) fn deferred() -> bool {
    DEFERRED.with(|d| d.get())
}

pub(crate) fn take_deferred() -> bool {
    DEFERRED.with(|d| d.replace(false))
}

/// Une composition faite sur place pendant qu'une autre est en route : notée comme plus récente,
/// pour que le résultat en retard ne l'écrase pas (fin d'un geste : image nette posée avant
/// l'arrivée du dernier brouillon).
fn note_sync(target: Target, r: Rect) {
    if PENDING.with(|p| p.get()) > 0 {
        let g = GEN.with(|g| g.get());
        CPU_RECTS.with(|v| v.borrow_mut().push((g, target, r)));
    }
}

/// Agrandit au plus proche le rectangle grossier `px` (rectangle `rc` au pas double, largeur
/// `rc.2 - rc.0`) en lignes du rectangle `r` de l'affichage : le pixel x montre le pixel x / 2.
fn upscaled(px: &[u8], r: Rect, rc: Rect) -> Vec<u8> {
    let rcw = rc.2 - rc.0;
    let mut out = Vec::with_capacity((r.2 - r.0) * (r.3 - r.1) * 4);
    for y in r.1..r.3 {
        let srow = &px[((y / 2 - rc.1) * rcw) * 4..((y / 2 - rc.1 + 1) * rcw) * 4];
        for x in r.0..r.2 {
            let sx = (x / 2 - rc.0) * 4;
            out.extend_from_slice(&srow[sx..sx + 4]);
        }
    }
    out
}

/// Affichage grossier montré pendant le dernier geste (remis à faux).
pub(crate) fn take_coarse() -> bool {
    COARSE_SHOWN.with(|c| c.replace(false))
}

/// Pendant un geste qui change l'image à chaque mouvement sous des filtres ƒ (déplacer un
/// calque, régler une opacité) : le rectangle est composé à un pas deux fois plus grossier,
/// puis agrandi. Quatre fois moins de pixels composés et relus de la carte graphique (dans le
/// navigateur, cette relecture attend la fin de tout le travail en cours : 40 % du temps d'un
/// mouvement sur le projet d'exemple). Faux : petite zone, composition ordinaire.
fn coarse(app: &AppWindow, st: &mut State, r: Rect) -> bool {
    let ds = st.ds.max(1);
    let (dw, dh) = (st.doc.w.div_ceil(ds), st.doc.h.div_ceil(ds));
    let r = (r.0, r.1, r.2.min(dw), r.3.min(dh));
    if r.2 <= r.0 || r.3 <= r.1 || (r.2 - r.0) * (r.3 - r.1) < 250_000 || ds * 2 > 16 || st.display.len() != dw * dh * 4 {
        return false;
    }
    let ds2 = ds * 2;
    let (cw, ch) = (st.doc.w.div_ceil(ds2), st.doc.h.div_ceil(ds2));
    let rc = (r.0 / 2, r.1 / 2, r.2.div_ceil(2).min(cw), r.3.div_ceil(2).min(ch));
    if rc.2 <= rc.0 || rc.3 <= rc.1 {
        return false;
    }
    let rcw = rc.2 - rc.0;
    let allowed = GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) && crate::editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed) == 0;
    // pixels du rectangle grossier, largeur rcw
    let mut px: Option<Vec<u8>> = None;
    // navigateur : WebGL reste plus rapide que le processeur ici (mesuré sur le projet
    // d'exemple : 128 ms par mouvement contre 164) ; relu sans attendre la carte graphique :
    // le fil de l'interface prépare le mouvement suivant pendant le calcul
    #[cfg(target_arch = "wasm32")]
    if allowed && gpu::get().is_none() && crate::webgl::available() {
        // grande image en tuiles : composée sur place (une tuile neuve serait envoyée vide)
        if st.lazy {
            px = crate::webgl::compose(&st.doc, ds2, rc, false);
        } else if ASYNC_FLIGHT.with(|f| f.get()) {
            // un calcul est déjà en route : celui-ci est relancé à son arrivée (la file de la
            // carte graphique ne s'allonge pas, l'image ne prend pas de retard)
            ASYNC_DIRTY.with(|d| d.set(true));
            DEFERRED.with(|d| d.set(true));
            COARSE_SHOWN.with(|c| c.set(true));
            return true;
        } else if let Some(fut) = crate::webgl::compose_async(&st.doc, ds2, rc, false) {
            let gen = GEN.with(|c| {
                c.set(c.get() + 1);
                c.get()
            });
            PENDING.with(|p| p.set(p.get() + 1));
            ASYNC_FLIGHT.with(|f| f.set(true));
            ASYNC_DIRTY.with(|d| d.set(false));
            DEFERRED.with(|d| d.set(true));
            COARSE_SHOWN.with(|c| c.set(true));
            let (weak, doc, n) = (app.as_weak(), st.doc.uid, rcw * (rc.3 - rc.1) * 4);
            wasm_bindgen_futures::spawn_local(async move {
                let px = fut.await.filter(|p| p.len() >= n).map(|p| upscaled(&p, r, rc));
                PENDING.with(|p| p.set(p.get().saturating_sub(1)));
                ASYNC_FLIGHT.with(|f| f.set(false));
                let again = ASYNC_DIRTY.with(|d| d.replace(false)) && gesture_active();
                let w2 = weak.clone();
                // résultat perdu (contexte perdu…) : rien à poser, l'image nette suivra
                if px.is_some() {
                    arrive(weak, gen, doc, ds, Target::Display, r, px);
                }
                if again {
                    if let Some(app) = w2.upgrade() {
                        redraw_soon(&app);
                    }
                }
            });
            return true;
        } else {
            px = crate::webgl::compose(&st.doc, ds2, rc, false);
        }
    } else if allowed && gpu::get().is_some() {
        // WebGPU : résultat asynchrone, chemin ordinaire
        return false;
    }
    #[cfg(not(target_arch = "wasm32"))]
    let _ = app;
    #[cfg(not(target_arch = "wasm32"))]
    if allowed && gpu_ready() {
        px = gpu::get().and_then(|g| g.compose_submit(&st.doc, ds2, rc, false)).and_then(|job| gpu::get().and_then(|g| g.compose_wait(job)));
    }
    let px = match px {
        Some(p) if p.len() >= rcw * (rc.3 - rc.1) * 4 => p,
        _ => {
            let mut tmp = vec![0u8; cw * ch * 4];
            st.doc.composite_scaled(&mut tmp, ds2, rc, false);
            let mut out = Vec::with_capacity(rcw * (rc.3 - rc.1) * 4);
            for y in rc.1..rc.3 {
                out.extend_from_slice(&tmp[(y * cw + rc.0) * 4..(y * cw + rc.2) * 4]);
            }
            out
        }
    };
    // agrandi au plus proche : le pixel d'affichage x montre le pixel grossier x / 2
    write_rows(&mut st.display, dw, r, &upscaled(&px, r, rc));
    note_sync(Target::Display, r);
    COARSE_SHOWN.with(|c| c.set(true));
    true
}

/// Confie `r` à la carte graphique. Vrai si c'est fait (bureau) ou en route (navigateur) ;
/// faux : à composer sur le processeur.
pub(crate) fn compose(app: &AppWindow, st: &mut State, target: Target, r: Rect) -> bool {
    if !GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) {
        gpu::compose_forget();
        #[cfg(target_arch = "wasm32")]
        crate::webgl::forget();
        return false;
    }
    // zone d'un calque dynamique affichée en gris : composée sur le processeur (editor::over)
    if crate::editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed) != 0 {
        return false;
    }
    // navigateur sans WebGPU : passerelle WebGL2 (mpGL), résultat relu tout de suite
    #[cfg(target_arch = "wasm32")]
    let webgl = gpu::get().is_none() && crate::webgl::available();
    #[cfg(not(target_arch = "wasm32"))]
    let webgl = false;
    // pendant un geste (tracé, forme ou texte en cours de modification, objet déplacé) : petits
    // rectangles, et chaque envoi du calque actif coûterait plus ; dans le navigateur, un résultat
    // arrivé en retard écrasait aussi l'aperçu
    let gesture = st.session.busy() || st.shape_edit.is_some() || st.text_edit.is_some() || st.vector_drag.is_some() || st.grad_live.is_some();
    if !(gpu_ready() || webgl) || gesture {
        return false;
    }
    let ds = step(st, target);
    let (tw, th) = (st.doc.w.div_ceil(ds), st.doc.h.div_ceil(ds));
    let r = (r.0, r.1, r.2.min(tw), r.3.min(th));
    if r.2 <= r.0 || r.3 <= r.1 || buffer(st, target).len() != tw * th * 4 {
        return false;
    }
    let ns = if ds >= 4 { 4 } else { 1 };
    let layers = st.doc.layers.iter().filter(|l| l.visible && l.opacity > 0.0).count().max(1);
    if (r.2 - r.0) * (r.3 - r.1) * ns * layers < MIN_WORK {
        return false;
    }
    #[cfg(target_arch = "wasm32")]
    if webgl {
        let _ = app;
        let Some(px) = crate::webgl::compose(&st.doc, ds, r, false) else { return false };
        write_rows(buffer(st, target), tw, r, &px);
        note_sync(target, r);
        return true;
    }
    let Some(g) = gpu::get() else { return false };
    let Some(job) = g.compose_submit(&st.doc, ds, r, false) else { return false };
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = app;
        let Some(px) = g.compose_wait(job) else { return false };
        write_rows(buffer(st, target), tw, r, &px);
        true
    }
    #[cfg(target_arch = "wasm32")]
    {
        let gen = GEN.with(|c| {
            c.set(c.get() + 1);
            c.get()
        });
        PENDING.with(|p| p.set(p.get() + 1));
        let (weak, doc) = (app.as_weak(), st.doc.uid);
        wasm_bindgen_futures::spawn_local(async move {
            let px = g.compose_wait(job).await;
            PENDING.with(|p| p.set(p.get().saturating_sub(1)));
            arrive(weak, gen, doc, ds, target, r, px);
        });
        true
    }
}

/// Recopie les lignes composées (rectangle `r`, largeur `r.2 - r.0`) dans l'image de largeur `tw`.
fn write_rows(buf: &mut [u8], tw: usize, r: Rect, px: &[u8]) {
    let rw = (r.2 - r.0) * 4;
    if px.len() < rw * (r.3 - r.1) {
        return;
    }
    for (k, y) in (r.1..r.3).enumerate() {
        let o = (y * tw + r.0) * 4;
        buf[o..o + rw].copy_from_slice(&px[k * rw..(k + 1) * rw]);
    }
}

/// Navigateur : résultat d'une composition arrivé ; posé s'il est encore valable, puis envoyé
/// à l'interface.
#[cfg(target_arch = "wasm32")]
fn arrive(weak: slint::Weak<AppWindow>, gen: u64, doc: u64, ds: usize, target: Target, r: Rect, px: Option<Vec<u8>>) {
    let Some(app) = weak.upgrade() else { return };
    let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
    let Ok(mut st) = state.try_borrow_mut() else {
        // état occupé (rare) : un peu plus tard
        slint::Timer::single_shot(std::time::Duration::from_millis(5), move || arrive(weak, gen, doc, ds, target, r, px));
        return;
    };
    let st = &mut *st;
    let idle = PENDING.with(|p| p.get()) == 0;
    let newer: Vec<Rect> = CPU_RECTS.with(|v| v.borrow().iter().filter(|(g, t, _)| *g >= gen && *t == target).map(|(_, _, rr)| *rr).collect());
    if idle {
        CPU_RECTS.with(|v| v.borrow_mut().clear());
    }
    // document, pas ou taille changés : une recomposition complète a eu lieu (ou aura lieu)
    let (tw, th) = (st.doc.w.div_ceil(ds), st.doc.h.div_ceil(ds));
    if st.doc.uid != doc || step(st, target) != ds || buffer(st, target).len() != tw * th * 4 || (target == Target::Backdrop && !st.lazy) {
        return;
    }
    // déjà recouvert par un résultat plus récent, ou recomposé ensuite par le CPU
    let covered = APPLIED.with(|v| v.borrow().iter().any(|(g, t, a)| *g > gen && *t == target && contains(*a, r)));
    if covered || newer.iter().any(|a| contains(*a, r)) {
        return;
    }
    match px {
        Some(px) => {
            write_rows(buffer(st, target), tw, r, &px);
            // traits faits pendant le calcul : plus récents que ce résultat
            for a in newer.iter().filter_map(|a| intersect(*a, r)) {
                let d = step(st, target);
                match target {
                    Target::Display => st.doc.composite_scaled(&mut st.display, d, a, false),
                    Target::Backdrop => st.doc.composite_scaled(&mut st.backdrop, d, a, false),
                }
            }
        }
        None => cpu(st, target, r),
    }
    APPLIED.with(|v| {
        let mut v = v.borrow_mut();
        v.push((gen, target, r));
        let n = v.len();
        if n > 32 {
            v.drain(..n - 32);
        }
    });
    match target {
        Target::Display => {
            st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, r);
            upload_rect(&app, st, r);
        }
        Target::Backdrop => {
            let (bw, bh) = (st.doc.w.div_ceil(st.bs), st.doc.h.div_ceil(st.bs));
            app.set_canvas_image(to_image(&st.backdrop, bw, bh));
        }
    }
}
