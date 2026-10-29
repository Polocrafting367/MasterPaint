//! Composition de l'affichage sur la carte graphique (gpu.rs `compose_submit`), pour que les
//! grandes images restent fluides, surtout dans le navigateur où le processeur n'a qu'un fil.
//! Bureau : résultat attendu sur place (même déroulé que le calcul CPU). Navigateur (WebGPU) :
//! résultat asynchrone ; l'ancien contenu reste affiché le temps d'une image, puis le
//! rectangle est remplacé. Les rectangles recomposés par le CPU entre-temps (traits de pinceau)
//! sont plus récents : ils sont refaits après coup, et un résultat dépassé est jeté.
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

fn contains(a: Rect, b: Rect) -> bool {
    a.0 <= b.0 && a.1 <= b.1 && a.2 >= b.2 && a.3 >= b.3
}

fn intersect(a: Rect, b: Rect) -> Option<Rect> {
    let r = (a.0.max(b.0), a.1.max(b.1), a.2.min(b.2), a.3.min(b.3));
    (r.2 > r.0 && r.3 > r.1).then_some(r)
}

/// Composition CPU du rectangle `r` (notée si une composition GPU est en route).
pub(crate) fn cpu(st: &mut State, target: Target, r: Rect) {
    let ds = step(st, target);
    match target {
        Target::Display => st.doc.composite_scaled(&mut st.display, ds, r, true),
        Target::Backdrop => st.doc.composite_scaled(&mut st.backdrop, ds, r, true),
    }
    if PENDING.with(|p| p.get()) > 0 {
        let g = GEN.with(|g| g.get());
        CPU_RECTS.with(|v| v.borrow_mut().push((g, target, r)));
    }
}

/// Compose `r` : carte graphique si possible, sinon processeur.
pub(crate) fn view(app: &AppWindow, st: &mut State, target: Target, r: Rect) {
    if !compose(app, st, target, r) {
        cpu(st, target, r);
    }
}

/// Confie `r` à la carte graphique. Vrai si c'est fait (bureau) ou en route (navigateur) ;
/// faux : à composer sur le processeur.
pub(crate) fn compose(app: &AppWindow, st: &mut State, target: Target, r: Rect) -> bool {
    if !GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) {
        gpu::compose_forget();
        return false;
    }
    // pendant un geste : petits rectangles, et chaque envoi du calque actif coûterait plus
    if !gpu_ready() || st.session.busy() {
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
    let Some(g) = gpu::get() else { return false };
    let Some(job) = g.compose_submit(&st.doc, ds, r, true) else { return false };
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
                    Target::Display => st.doc.composite_scaled(&mut st.display, d, a, true),
                    Target::Backdrop => st.doc.composite_scaled(&mut st.backdrop, d, a, true),
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
