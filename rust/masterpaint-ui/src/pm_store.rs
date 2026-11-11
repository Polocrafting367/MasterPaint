// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Mode Photo Pro comme un projet : historique (annuler / rétablir) de chaque photo et séance
//! gardée d'une ouverture de l'application à l'autre (sauvegarde automatique).
//!
//! Rien de lourd n'est réécrit à chaque réglage : le fichier d'origine de chaque photo est
//! rangé une seule fois à l'import (clé `pm-photo-<uid>`), la séance (`pm-session`) ne garde
//! que les positions des curseurs, le filtre, le recadrage, la rotation et les masques. Au
//! démarrage, les fichiers sont relus et redéveloppés, puis leurs réglages reposés.
//! Bureau : dossier `photopro` des données de l'application ; navigateur : IndexedDB
//! (`window.mpStore`, comme la sauvegarde des projets).

use super::*;
use photo::{PmMask, Snap};
use serde_json::{json, Value};

const SESSION: &str = "pm-session";

fn key(uid: u64) -> String {
    format!("pm-photo-{uid}")
}

#[cfg(not(target_arch = "wasm32"))]
fn path(key: &str) -> Option<std::path::PathBuf> {
    settings::Settings::data_dir().map(|d| d.join("photopro").join(format!("{key}.bin")))
}

/// Range `bytes` sous `key` (en arrière-plan).
fn put(key: &str, bytes: Vec<u8>) {
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    #[cfg(not(target_arch = "wasm32"))]
    if let Some(p) = path(key) {
        std::thread::spawn(move || {
            if let Some(d) = p.parent() {
                let _ = std::fs::create_dir_all(d);
            }
            let tmp = p.with_extension("tmp");
            if std::fs::write(&tmp, &bytes).is_ok() {
                let _ = std::fs::rename(&tmp, &p);
            }
        });
    }
    #[cfg(target_arch = "wasm32")]
    web_call("put", &[key.into(), js_sys::Uint8Array::from(&bytes[..]).into()]);
}

fn del(key: &str) {
    #[cfg(not(target_arch = "wasm32"))]
    if let Some(p) = path(key) {
        let _ = std::fs::remove_file(p);
    }
    #[cfg(target_arch = "wasm32")]
    web_call("del", &[key.into()]);
}

#[cfg(target_arch = "wasm32")]
fn web_call(name: &str, args: &[wasm_bindgen::JsValue]) -> Option<wasm_bindgen::JsValue> {
    use wasm_bindgen::JsCast;
    let w = web_sys::window()?;
    let st = js_sys::Reflect::get(&w, &"mpStore".into()).ok().filter(|v| v.is_object())?;
    let f: js_sys::Function = js_sys::Reflect::get(&st, &name.into()).ok()?.dyn_into().ok()?;
    f.apply(&st, &args.iter().cloned().collect::<js_sys::Array>()).ok()
}

async fn get(key: String) -> Option<Vec<u8>> {
    #[cfg(not(target_arch = "wasm32"))]
    {
        path(&key).and_then(|p| std::fs::read(p).ok())
    }
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;
        let p: js_sys::Promise = web_call("load", &[key.as_str().into()])?.dyn_into().ok()?;
        let v = wasm_bindgen_futures::JsFuture::from(p).await.ok()?;
        if v.is_null() || v.is_undefined() {
            return None;
        }
        Some(js_sys::Uint8Array::new(&v).to_vec()).filter(|b| !b.is_empty())
    }
}

fn mask_json(m: &PmMask) -> Value {
    json!({ "name": m.name, "kind": m.kind, "visible": m.visible, "invert": m.invert, "amount": m.amount, "shape": m.shape, "adjust": m.adjust })
}

fn mask_from(v: &Value) -> Option<PmMask> {
    let f = |k: &str| v.get(k).and_then(Value::as_f64).unwrap_or(0.0) as f32;
    let list = |k: &str| v.get(k).and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_f64).map(|x| x as f32).collect::<Vec<f32>>()).unwrap_or_default();
    let mut adjust = list("adjust");
    adjust.resize(photo::LOCAL.len(), 0.0);
    Some(PmMask {
        name: v.get("name")?.as_str()?.to_string(),
        kind: f("kind") as u32,
        visible: v.get("visible").and_then(Value::as_bool).unwrap_or(true),
        invert: v.get("invert").and_then(Value::as_bool).unwrap_or(false),
        amount: f("amount"),
        shape: list("shape"),
        adjust,
    })
}

fn snap_json(s: &Snap) -> Value {
    json!({
        "params": s.params, "preset": s.preset, "crop": [s.crop.0, s.crop.1, s.crop.2, s.crop.3],
        "angle": s.angle, "rot": s.rot, "masks": s.masks.iter().map(mask_json).collect::<Vec<_>>()
    })
}

fn snap_from(v: &Value) -> Option<Snap> {
    let nums = |k: &str| v.get(k).and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_f64).map(|x| x as f32).collect::<Vec<f32>>()).unwrap_or_default();
    let mut params = nums("params");
    params.resize(photo::NP, 0.0);
    let c = nums("crop");
    let crop = if c.len() == 4 { (c[0], c[1], c[2], c[3]) } else { (0.0, 0.0, 1.0, 1.0) };
    Some(Snap {
        params,
        preset: v.get("preset").and_then(Value::as_i64).unwrap_or(0) as i32,
        crop,
        angle: v.get("angle").and_then(Value::as_f64).unwrap_or(0.0) as f32,
        rot: v.get("rot").and_then(Value::as_u64).unwrap_or(0) as u8 % 4,
        masks: v.get("masks").and_then(Value::as_array).map(|a| a.iter().filter_map(mask_from).collect()).unwrap_or_default(),
    })
}

/// Réécrit la séance (quelques ko : réglages seulement). Aucune photo : séance effacée.
pub(crate) fn save_session(st: &State) {
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) || st.photo.restoring {
        return;
    }
    if st.photo.photos.is_empty() {
        return del(SESSION);
    }
    let photos: Vec<Value> = st.photo.photos.iter().map(|p| json!({ "uid": p.uid.to_string(), "name": p.name, "state": snap_json(&p.snap()) })).collect();
    let v = json!({ "version": 1, "active": st.photo.active, "photos": photos });
    put(SESSION, v.to_string().into_bytes());
}

/// Photo ajoutée à la pellicule : fichier d'origine rangé (une fois), premier état de son
/// historique, séance réécrite.
pub(crate) fn photo_added(st: &mut State, idx: usize) {
    let Some(p) = st.photo.photos.get_mut(idx) else { return };
    // fichier d'origine : pris dans la file des fichiers importés (même nom)
    if p.orig.is_none() {
        if let Some(k) = st.photo.pending_orig.iter().position(|(n, _)| *n == p.name) {
            p.orig = Some(st.photo.pending_orig.remove(k).1);
        }
    }
    p.commit();
    if let Some(b) = p.orig.take() {
        put(&key(p.uid), b.to_vec());
    }
}

/// Photo retirée de la pellicule : son fichier d'origine n'est plus gardé.
pub(crate) fn photo_removed(uid: u64) {
    del(&key(uid));
}

thread_local! {
    /// historique : état rangé peu après le dernier réglage (un glisser de curseur = un état)
    static COMMIT: slint::Timer = slint::Timer::default();
}

/// Un réglage vient de changer : l'état sera rangé dans l'historique (et la séance réécrite)
/// 600 ms après le dernier changement.
pub(crate) fn touch(app: &AppWindow) {
    let weak = app.as_weak();
    COMMIT.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(600), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return touch(&app) };
            let active = st.photo.active;
            if st.photo.photos.get_mut(active).is_some_and(|p| p.commit()) {
                save_session(&st);
            }
            sync_undo(&app, &st);
        })
    });
}

/// Boutons Annuler / Rétablir de Photo Pro selon l'historique de la photo active.
pub(crate) fn sync_undo(app: &AppWindow, st: &State) {
    let p = st.photo.photos.get(st.photo.active);
    // une modification pas encore rangée s'annule aussi
    let pending = p.is_some_and(|p| p.hist.get(p.hist_pos) != Some(&p.snap()));
    app.set_pm_can_undo(p.is_some_and(|p| p.can_undo() || pending));
    app.set_pm_can_redo(p.is_some_and(|p| p.can_redo() && !pending));
}

/// Annuler (`back`) ou rétablir sur la photo active.
pub(crate) fn undo(app: &AppWindow, st: &mut State, back: bool) {
    let active = st.photo.active;
    let Some(p) = st.photo.photos.get_mut(active) else { return };
    let done = if back { p.undo() } else { p.redo() };
    if !done {
        return status(app, if back { "Rien à annuler" } else { "Rien à rétablir" });
    }
    save_session(st);
    pm_sync(app, st);
    pm_render(app, st);
    sync_undo(app, st);
}

/// Démarrage : séance de Photo Pro relue, photos redéveloppées en arrière-plan, réglages
/// reposés. Le mode reste fermé (onglet « Photo Pro » pour le rouvrir).
pub(crate) fn start_restore(app: &AppWindow, state: &Shared) {
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) || SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    let weak = app.as_weak();
    let state = state.clone();
    let _ = slint::spawn_local(async move {
        let Some(bytes) = get(SESSION.to_string()).await else { return };
        let Ok(v) = serde_json::from_slice::<Value>(&bytes) else { return };
        let Some(list) = v.get("photos").and_then(Value::as_array) else { return };
        let mut files = Vec::new();
        let mut queue = Vec::new();
        for e in list {
            let (Some(uid), Some(name), Some(snap)) = (e.get("uid").and_then(Value::as_str).and_then(|u| u.parse::<u64>().ok()), e.get("name").and_then(Value::as_str), e.get("state").and_then(snap_from)) else { continue };
            // fichier d'origine perdu (données du site effacées en partie) : photo oubliée
            let Some(b) = get(key(uid)).await else { continue };
            files.push((name.to_string(), b));
            queue.push((uid, name.to_string(), snap));
        }
        if files.is_empty() {
            return;
        }
        let Some(app) = weak.upgrade() else { return };
        let Ok(mut st) = state.try_borrow_mut() else { return };
        let active = v.get("active").and_then(Value::as_u64).unwrap_or(0) as usize;
        st.photo.restore = queue;
        st.photo.restore_active = active;
        st.photo.restoring = true;
        start_load(&app, &mut st, LoadTo::Photos, files);
    });
}

/// Photo arrivée pendant une restauration : identifiant et état d'avant reposés. Faux si la
/// photo n'était pas attendue (import ordinaire).
pub(crate) fn restored(st: &mut State, p: &mut photo::Photo) -> bool {
    let Some(k) = st.photo.restore.iter().position(|(_, n, _)| *n == p.name) else { return false };
    let (uid, _, snap) = st.photo.restore.remove(k);
    p.uid = uid;
    p.apply_snap(&snap);
    p.modified = snap != photo::Photo::new_snap();
    p.commit();
    true
}
