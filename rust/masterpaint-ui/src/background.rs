//! Calculs lourds hors du fil de l'interface, pour qu'elle ne se fige jamais : autre fil sur le
//! bureau, worker de la page dans le navigateur (même module wasm, voir web/mp-worker.js). Le
//! résultat revient sur le fil de l'interface, avec l'état de l'application, quand il est prêt.

use super::*;
use std::sync::Arc;

/// Travail confié à l'arrière-plan.
pub(crate) enum Heavy {
    /// effet du moteur sur une image RGBA, suivi éventuellement de l'aberration chromatique
    Effect { name: String, src: Arc<Vec<u8>>, w: usize, h: usize, p: Vec<f32>, post: Option<Vec<f32>> },
    /// Camera Raw sur une image RVB flottante linéaire (photo RAW, toute la dynamique du capteur)
    CamRawLin { lin: Arc<Vec<f32>>, w: usize, h: usize, p: Vec<f32> },
    /// zone d'une photo du Mode Photo Pro : extraction à la taille voulue, puis Camera Raw
    PhotoRegion(photo::RegionJob),
    /// remplissage de contenu (masterpaint_core::content_fill) : pixels, zone à refaire, réglages
    Fill { src: Arc<Vec<u8>>, mask: Arc<Vec<u8>>, w: usize, h: usize, p: Vec<f32> },
    /// calcul propre à l'interface (ASCII…) : autre fil sur le bureau, sur place dans le navigateur
    Local(Box<dyn FnOnce() -> Option<Vec<u8>> + Send>),
}

impl Heavy {
    pub(crate) fn run(self) -> Option<Vec<u8>> {
        match self {
            Heavy::Effect { name, src, w, h, p, post } => {
                let mut px = engine_apply(&name, &src, w, h, &p)?;
                if let Some(ca) = post {
                    px = masterpaint_core::chromatic_post(&src, &px, w, h, &ca);
                }
                Some(px)
            }
            Heavy::CamRawLin { lin, w, h, p } => masterpaint_core::camera_raw_linear(&lin, w, h, &p),
            Heavy::PhotoRegion(job) => Some(job.render()),
            Heavy::Fill { src, mask, w, h, p } => Some(masterpaint_core::content_fill(&src, &mask, w, h, &p)),
            Heavy::Local(f) => f(),
        }
    }
}

/// Au-delà de ce nombre de pixels, les effets du menu qui le permettent passent par la carte
/// graphique (en dessous, le moteur CPU répond aussi vite).
pub(crate) const GPU_MIN: usize = 250_000;

/// Effet du moteur sur toute l'image : carte graphique si l'effet le permet (bureau), sinon tous
/// les cœurs du processeur.
pub(crate) fn engine_apply(name: &str, src: &[u8], w: usize, h: usize, p: &[f32]) -> Option<Vec<u8>> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        if w * h >= GPU_MIN && GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) && crate::gpu::menu_supported(name) {
            if let Some(out) = crate::gpu::get().and_then(|g| g.run_menu(name, src, w, h, p)) {
                return Some(out);
            }
        }
        let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
        masterpaint_core::apply_parallel(name, src, w, h, p, threads)
    }
    #[cfg(target_arch = "wasm32")]
    {
        masterpaint_core::apply_image(name, src, w, h, p)
    }
}

type Done = Box<dyn FnOnce(&AppWindow, &mut State, Option<Vec<u8>>)>;

#[cfg(not(target_arch = "wasm32"))]
thread_local! {
    /// suites à exécuter sur le fil de l'interface, par numéro de calcul
    static PENDING: RefCell<std::collections::HashMap<u64, Done>> = RefCell::new(std::collections::HashMap::new());
}
#[cfg(not(target_arch = "wasm32"))]
static SEQ: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

/// Lance `job` en arrière-plan ; `done` reçoit le résultat sur le fil de l'interface. Captures
/// et tests (`SYNC_LOADS`) : calcul immédiat.
pub(crate) fn spawn(app: &AppWindow, st: &mut State, job: Heavy, done: impl FnOnce(&AppWindow, &mut State, Option<Vec<u8>>) + 'static) {
    if SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
        let out = job.run();
        return done(app, st, out);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let id = SEQ.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        PENDING.with(|m| m.borrow_mut().insert(id, Box::new(done)));
        let weak = app.as_weak();
        std::thread::spawn(move || {
            let out = job.run();
            deliver(weak, id, out);
        });
    }
    #[cfg(target_arch = "wasm32")]
    {
        let weak = app.as_weak();
        let done: Done = Box::new(done);
        wasm_bindgen_futures::spawn_local(async move {
            // effet du menu sur la carte graphique (WebGPU) : calcul asynchrone, la page ne se
            // fige pas ; sans carte (ou effet sans équivalent) : worker, comme avant
            if let Heavy::Effect { name, src, w, h, p, post: None } = &job {
                if *w * *h >= GPU_MIN && GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) && crate::gpu::menu_supported(name) {
                    if let Some(g) = crate::gpu::get() {
                        if let Some(out) = g.run_menu(name, src, *w, *h, p).await {
                            return finish(weak, done, Some(out));
                        }
                    }
                }
            }
            let out = match web::compute(&job).await {
                Some(out) => out,
                // pas de worker (ou calcul propre à l'interface) : sur place, après un tour de
                // boucle pour que l'interface affiche d'abord son état « en cours »
                None => {
                    web::sleep(16).await;
                    job.run()
                }
            };
            finish(weak, done, out);
        });
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn deliver(weak: slint::Weak<AppWindow>, id: u64, out: Option<Vec<u8>>) {
    let _ = slint::invoke_from_event_loop(move || {
        let Some(app) = weak.upgrade() else { return };
        let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
        if state.try_borrow_mut().is_err() {
            return deliver(app.as_weak(), id, out);
        }
        let Some(done) = PENDING.with(|m| m.borrow_mut().remove(&id)) else { return };
        done(&app, &mut state.borrow_mut(), out);
    });
}

#[cfg(target_arch = "wasm32")]
fn finish(weak: slint::Weak<AppWindow>, done: Done, out: Option<Vec<u8>>) {
    let Some(app) = weak.upgrade() else { return };
    let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
    if state.try_borrow_mut().is_err() {
        // état occupé (rare) : un peu plus tard
        slint::Timer::single_shot(std::time::Duration::from_millis(5), move || finish(weak, done, out));
        return;
    }
    done(&app, &mut state.borrow_mut(), out);
}

// ------------------------------------------------------------------ worker du navigateur

/// Navigateur, worker de calcul (web/mp-worker.js) : effet du moteur, puis aberration
/// chromatique si `post` n'est pas vide. Image vide : effet inconnu.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn mp_worker_effect(name: &str, src: &[u8], w: usize, h: usize, params: &[f32], post: &[f32]) -> Vec<u8> {
    let Some(mut px) = masterpaint_core::apply_image(name, src, w, h, params) else { return Vec::new() };
    if !post.is_empty() {
        px = masterpaint_core::chromatic_post(src, &px, w, h, post);
    }
    px
}

/// Navigateur, worker : remplissage de contenu (zone `mask`, un octet par pixel).
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn mp_worker_fill(src: &[u8], mask: &[u8], w: usize, h: usize, params: &[f32]) -> Vec<u8> {
    masterpaint_core::content_fill(src, mask, w, h, params)
}

/// Navigateur, worker : Camera Raw sur RVB linéaire flottant.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn mp_worker_camraw_lin(lin: &[f32], w: usize, h: usize, params: &[f32]) -> Vec<u8> {
    masterpaint_core::camera_raw_linear(lin, w, h, params).unwrap_or_default()
}

/// Navigateur, worker : lecture et développement d'un RAW. Résultat : largeur, hauteur, blanc,
/// exposition de base, puis le RVB linéaire ; vide en cas d'échec (le fil de l'interface
/// refait alors le calcul pour obtenir le message d'erreur).
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn mp_worker_raw(bytes: &[u8]) -> Vec<f32> {
    match raw::read(bytes).and_then(|s| raw::develop(&s)) {
        Ok(r) => {
            let mut v = Vec::with_capacity(r.lin.len() + 4);
            v.extend_from_slice(&[r.w as f32, r.h as f32, r.white, r.baseline_ev]);
            v.extend_from_slice(&r.lin);
            v
        }
        Err(_) => Vec::new(),
    }
}

/// Navigateur, worker : décodage d'une image (PNG, JPEG…). Résultat : largeur et hauteur
/// (4 octets chacune, petit-boutiste), puis les pixels RGBA ; vide si le format est inconnu.
#[cfg(target_arch = "wasm32")]
#[wasm_bindgen::prelude::wasm_bindgen]
pub fn mp_worker_decode(bytes: &[u8]) -> Vec<u8> {
    match decode(bytes) {
        Some((w, h, px)) => {
            let mut v = Vec::with_capacity(px.len() + 8);
            v.extend_from_slice(&(w as u32).to_le_bytes());
            v.extend_from_slice(&(h as u32).to_le_bytes());
            v.extend_from_slice(&px);
            v
        }
        None => Vec::new(),
    }
}
