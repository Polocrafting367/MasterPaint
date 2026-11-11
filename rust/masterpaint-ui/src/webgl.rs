// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Passerelle WebGL2 (navigateur sans WebGPU : Firefox, Chrome / Edge sous Linux…) : la
//! composition de l'affichage, les filtres dynamiques ƒ et les effets du menu accélérés passent
//! par `window.mpGL` (web/index.html), écrit en JavaScript sur WebGL2 avec les formules des
//! compute shaders de gpu.rs (WebGL2 n'a pas de compute shaders, le backend WebGL de wgpu ne
//! peut donc pas servir) ; mêmes plans de passes que gpu.rs (`flat_stack`, `flat_menu`). Les calques ne sont
//! envoyés que s'ils ont changé ; le résultat est relu tout de suite (comme sur le bureau).
//! Sans `mpGL`, sans WebGL2 ou si un envoi échoue : `None`, l'appelant compose sur le processeur.

use crate::editor::Doc;
use std::cell::{Cell, RefCell};
use std::collections::HashMap;
use std::sync::{Arc, Weak};
use wasm_bindgen::{JsCast, JsValue};

/// Au-delà (octets de textures de calques), la composition reste sur le processeur.
const BUDGET: usize = 1_000_000_000;

/// Sources déjà envoyées pour un calque : pixels et masque α / rendu ƒ.
struct Sent {
    main: Weak<Vec<u8>>,
    aux: Option<Weak<Vec<u8>>>,
}

thread_local! {
    static SENT: RefCell<HashMap<u64, Sent>> = RefCell::new(HashMap::new());
    /// passerelle disponible (testée une fois) et plus grand côté de texture
    static AVAIL: Cell<Option<(bool, usize)>> = const { Cell::new(None) };
}

fn call(name: &str, args: &[JsValue]) -> Option<JsValue> {
    let w = web_sys::window()?;
    let o = js_sys::Reflect::get(&w, &"mpGL".into()).ok().filter(|o| o.is_object())?;
    let f = js_sys::Reflect::get(&o, &name.into()).ok()?.dyn_into::<js_sys::Function>().ok()?;
    f.apply(&o, &args.iter().cloned().collect::<js_sys::Array>()).ok()
}

fn probe() -> (bool, usize) {
    AVAIL.with(|a| {
        if let Some(v) = a.get() {
            return v;
        }
        let ok = call("available", &[]).and_then(|v| v.as_bool()).unwrap_or(false);
        let max = if ok { call("maxSize", &[]).and_then(|v| v.as_f64()).unwrap_or(0.0) as usize } else { 0 };
        a.set(Some((ok, max)));
        (ok, max)
    })
}

/// WebGL2 utilisable pour la composition.
pub fn available() -> bool {
    probe().0
}

/// Nom de la carte graphique vue par WebGL2.
pub fn renderer() -> Option<String> {
    available().then(|| call("renderer", &[]).and_then(|v| v.as_string())).flatten().filter(|s| !s.is_empty())
}

/// Oublie les textures (accélération coupée dans les Paramètres).
pub fn forget() {
    SENT.with(|s| s.borrow_mut().clear());
    if AVAIL.with(|a| a.get()).is_some_and(|v| v.0) {
        call("forget", &[]);
    }
}

fn upload(uid: u64, slot: u32, w: usize, h: usize, data: &[u8], ch: u32) -> bool {
    // vue sur la mémoire du module : copiée par texImage2D avant tout autre appel Rust
    let view = unsafe { js_sys::Uint8Array::view(data) };
    call("upload", &[JsValue::from_f64(uid as f64), slot.into(), (w as u32).into(), (h as u32).into(), view.into(), ch.into()])
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Lignes [y0, y1) d'une texture déjà envoyée remplacées (texSubImage2D) : après un trait, seule
/// la zone touchée repart (gpu_damage).
fn upload_rows(uid: u64, slot: u32, w: usize, y0: usize, y1: usize, data: &[u8], ch: u32) -> bool {
    let row = w * ch as usize;
    if y1 <= y0 || y1 * row > data.len() {
        return false;
    }
    let view = unsafe { js_sys::Uint8Array::view(&data[y0 * row..y1 * row]) };
    call("uploadRows", &[JsValue::from_f64(uid as f64), slot.into(), (w as u32).into(), (y0 as u32).into(), ((y1 - y0) as u32).into(), view.into(), ch.into()])
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Lignes à renvoyer (texture tenue : `held`, source actuelle : `now`, largeur `w`, `ch` canaux).
fn damaged_rows(held: &Weak<Vec<u8>>, now: &Arc<Vec<u8>>, w: usize, ch: usize) -> Option<(usize, usize)> {
    let (s, e) = crate::gpu_damage::since(held, now)?;
    let row = w * ch;
    Some((s / row, e.div_ceil(row)))
}

fn same(w: &Weak<Vec<u8>>, a: &Arc<Vec<u8>>) -> bool {
    std::ptr::eq(w.as_ptr(), Arc::as_ptr(a))
}

/// Compose le rectangle `r` (pixels de l'affichage au pas `ds`) comme `Doc::composite_scaled`
/// (`checker` : sur le damier). Mêmes cas refusés que `Gpu::compose_submit`.
pub fn compose(doc: &Doc, ds: usize, r: (usize, usize, usize, usize), checker: bool) -> Option<Vec<u8>> {
    let (params, plan, n) = prepare(doc, ds, r, checker)?;
    let res = call("compose", &[js_sys::Float64Array::from(&params[..]).into(), js_sys::Float64Array::from(&plan[..]).into()])?;
    let arr = res.dyn_into::<js_sys::Uint8Array>().ok()?;
    (arr.length() as usize == n).then(|| arr.to_vec())
}

/// Même composition, relue sans attendre la carte graphique : les calques sont envoyés et le
/// calcul lancé tout de suite, le résultat arrive plus tard (None : refusé, à composer
/// autrement). Les compositions suivantes passent après dans la file de la carte graphique.
pub fn compose_async(doc: &Doc, ds: usize, r: (usize, usize, usize, usize), checker: bool) -> Option<impl std::future::Future<Output = Option<Vec<u8>>>> {
    let (params, plan, n) = prepare(doc, ds, r, checker)?;
    let res = call("composeAsync", &[js_sys::Float64Array::from(&params[..]).into(), js_sys::Float64Array::from(&plan[..]).into()])?;
    let promise = res.dyn_into::<js_sys::Promise>().ok()?;
    Some(async move {
        let v = wasm_bindgen_futures::JsFuture::from(promise).await.ok()?;
        let arr = v.dyn_into::<js_sys::Uint8Array>().ok()?;
        (arr.length() as usize == n).then(|| arr.to_vec())
    })
}

/// Envoie les calques manquants ou modifiés et prépare le plan de `mpGL.compose` :
/// (paramètres, plan, taille attendue du résultat en octets).
fn prepare(doc: &Doc, ds: usize, r: (usize, usize, usize, usize), checker: bool) -> Option<(Vec<f64>, Vec<f64>, usize)> {
    let (ok, max) = probe();
    let (w, h) = (doc.w, doc.h);
    let ds = ds.max(1);
    let (dw, dh) = (w.div_ceil(ds), h.div_ceil(ds));
    let (x0, y0, x1, y1) = (r.0, r.1, r.2.min(dw), r.3.min(dh));
    if !ok || w == 0 || h == 0 || w > max || h > max || x1 <= x0 || y1 <= y0 || doc.has_groups() {
        return None;
    }
    // sous un filtre ƒ « partout » : rien à envoyer ni à composer
    let vis = doc.shown_layers();
    if vis.is_empty() {
        return None;
    }
    let (off0, off1, ns) = if ds >= 4 { (ds / 4, ds * 3 / 4, 4) } else { (ds / 2, ds / 2, 1) };
    SENT.with(|sent| {
        let mut sent = sent.borrow_mut();
        // erreur relevée en retard par la passerelle : ses textures sont perdues, tout est renvoyé
        if call("takeLost", &[]).is_some_and(|v| v.is_truthy()) {
            sent.clear();
        }
        // textures des calques disparus libérées
        sent.retain(|uid, _| doc.layers.iter().any(|l| l.uid == *uid));
        let uids: Vec<f64> = sent.keys().map(|u| *u as f64).collect();
        call("retain", &[js_sys::Float64Array::from(&uids[..]).into()]);
        let mut plan: Vec<f64> = Vec::with_capacity(vis.len() * 5);
        let mut total = 0usize;
        for (n, l) in vis.iter().enumerate() {
            let mask = l.mask.as_ref().filter(|m| m.len() == w * h).map(|m| m.arc());
            // mêmes sources et drapeaux que compose_submit : aux = masque (1 canal) ou rendu ƒ
            let low = l.low_cache(w, h);
            let aux_k = low.map_or(1, |(k, _)| k);
            let (aw, ah) = (w.div_ceil(aux_k), h.div_ceil(aux_k));
            let (main, aux, mut flags): (Arc<Vec<u8>>, Option<(Arc<Vec<u8>>, u32)>, u32) = match (&l.dyn_cache, l.dynamic_mode) {
                _ if low.is_some() => (l.px.arc(), low.map(|(_, c)| (c.clone(), 4)), if l.dynamic_mode == 0 { 2 } else { 4 }),
                (Some(c), 0) => (l.px.arc(), Some((c.clone(), 4)), 2),
                (Some(c), 2) => (l.px.arc(), Some((c.clone(), 4)), 4),
                (Some(c), 1) => (c.clone(), mask.clone().map(|m| (m, 1)), mask.is_some() as u32),
                _ => (l.px.arc(), mask.clone().map(|m| (m, 1)), mask.is_some() as u32),
            };
            if main.len() != w * h * 4 || aux.as_ref().is_some_and(|(a, ch)| a.len() < aw * ah * *ch as usize) {
                return None;
            }
            if n == 0 {
                flags |= 8;
            }
            total += main.len() + aux.as_ref().map_or(0, |(a, _)| a.len());
            if total > BUDGET {
                return None;
            }
            let entry = sent.get(&l.uid);
            let main_ok = entry.is_some_and(|e| same(&e.main, &main));
            let aux_ok = match (&aux, entry.and_then(|e| e.aux.as_ref())) {
                (Some((a, _)), Some(old)) => same(old, a),
                (None, _) => true,
                _ => false,
            };
            let main_rows = if main_ok { None } else { entry.and_then(|e| damaged_rows(&e.main, &main, w, 4)) };
            let main_ok = main_ok || main_rows.is_some_and(|(y0, y1)| upload_rows(l.uid, 0, w, y0, y1.min(h), &main, 4));
            let aux_ok = aux_ok || match (&aux, entry.and_then(|e| e.aux.as_ref())) {
                (Some((a, ch)), Some(old)) => damaged_rows(old, a, aw, *ch as usize).is_some_and(|(y0, y1)| upload_rows(l.uid, 1, aw, y0, y1.min(ah), a, *ch)),
                _ => false,
            };
            if !main_ok && !upload(l.uid, 0, w, h, &main, 4) {
                sent.remove(&l.uid);
                return None;
            }
            if !aux_ok {
                let (a, ch) = aux.as_ref().expect("source auxiliaire");
                if !upload(l.uid, 1, aw, ah, &a[..aw * ah * *ch as usize], *ch) {
                    sent.remove(&l.uid);
                    return None;
                }
            }
            sent.insert(l.uid, Sent { main: Arc::downgrade(&main), aux: aux.as_ref().map(|(a, _)| Arc::downgrade(a)) });
            plan.extend([l.uid as f64, l.blend.index() as f64, flags as f64, l.opacity as f64, aux_k as f64]);
        }
        let (rw, rh) = (x1 - x0, y1 - y0);
        let params: Vec<f64> = [w, h, ds, ns, x0, y0, rw, rh, off0, off1, checker as usize].iter().map(|v| *v as f64).collect();
        Some((params, plan, rw * rh * 4))
    })
}

/// Passes à plat (`gpu::flat_stack` / `gpu::flat_menu`) sur l'image `src` : même plan que la
/// carte graphique WebGPU, noyaux portés en GLSL dans `mpGL.runPasses`.
fn run_passes(src: &[u8], w: usize, h: usize, passes: &[f64], out: usize) -> Option<Vec<u8>> {
    let (ok, max) = probe();
    if !ok || passes.is_empty() || w == 0 || h == 0 || w > max || h > max || src.len() != w * h * 4 {
        return None;
    }
    let view = unsafe { js_sys::Uint8Array::view(src) };
    let res = call(
        "runPasses",
        &[(w as u32).into(), (h as u32).into(), js_sys::Float64Array::from(passes).into(), (out as u32).into(), view.into()],
    )?;
    let arr = res.dyn_into::<js_sys::Uint8Array>().ok()?;
    (arr.length() as usize == w * h * 4).then(|| arr.to_vec())
}

/// Chaîne d'effets dynamiques (étages du moteur) en WebGL2.
pub fn run_stack(src: &[u8], w: usize, h: usize, stack: &[(i32, f32)]) -> Option<Vec<u8>> {
    let (passes, out) = crate::gpu::flat_stack(stack);
    run_passes(src, w, h, &passes, out)
}

/// Effet du menu qui a un équivalent carte graphique (`gpu::menu_supported`), en WebGL2.
pub fn run_menu(name: &str, src: &[u8], w: usize, h: usize, p: &[f32]) -> Option<Vec<u8>> {
    let (passes, out) = crate::gpu::flat_menu(name, p, w, h)?;
    run_passes(src, w, h, &passes, out)
}
