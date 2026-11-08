// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Projets MasterPaint (.illu) : lecture et écriture, compatibles avec la version web
//! (EditorManager.serializeWorkspacePayload : JSON, calques en PNG base64).

use crate::editor::{Blend, ColorMode, Doc, Layer};
use base64::Engine;
use serde_json::{json, Value};

/// Ce qui n'a pas pu être repris (projets vectoriels, animation…), pour l'afficher.
pub struct Loaded {
    pub docs: Vec<Doc>,
    pub skipped: Vec<String>,
}

/// Image décodée : largeur, hauteur, RGBA.
pub type Decoded = (usize, usize, Vec<u8>);

thread_local! {
    /// images déjà décodées (en parallèle, avant l'assemblage des projets), par adresse de leur
    /// texte base64 dans le JSON analysé
    static PRE: std::cell::RefCell<std::collections::HashMap<usize, Decoded>> = std::cell::RefCell::new(std::collections::HashMap::new());
}

fn decode_data_url(s: &str) -> Option<Decoded> {
    if let Some(d) = PRE.with(|m| m.borrow_mut().remove(&(s.as_ptr() as usize))) {
        return Some(d);
    }
    decode_png(&payload(s)?)
}

fn payload(s: &str) -> Option<Vec<u8>> {
    let b64 = s.split_once(',').map(|(_, b)| b).unwrap_or(s);
    base64::engine::general_purpose::STANDARD.decode(b64.trim()).ok()
}

/// PNG (ou autre format d'image) → RGBA.
pub fn decode_png(bytes: &[u8]) -> Option<Decoded> {
    let img = image::load_from_memory(bytes).ok()?.to_rgba8();
    let (w, h) = img.dimensions();
    Some((w as usize, h as usize, img.into_raw()))
}

/// Analyse le JSON d'un fichier .illu.
pub fn parse(bytes: &[u8]) -> Result<Value, String> {
    serde_json::from_slice(bytes).map_err(|e| format!("fichier .illu illisible : {e}"))
}

/// Images (calques, dessins de la frise, masques) d'un .illu analysé : (clé, octets du PNG).
/// Décodées à part (en parallèle) puis passées à `load_parsed`.
pub fn image_payloads(v: &Value) -> Vec<(usize, Vec<u8>)> {
    fn walk(v: &Value, out: &mut Vec<(usize, Vec<u8>)>) {
        match v {
            Value::Object(m) => {
                for (k, x) in m {
                    match x {
                        Value::String(s) if k == "dataUrl" && !s.is_empty() => {
                            if let Some(b) = payload(s) {
                                out.push((s.as_ptr() as usize, b));
                            }
                        }
                        _ => walk(x, out),
                    }
                }
            }
            Value::Array(a) => a.iter().for_each(|x| walk(x, out)),
            _ => {}
        }
    }
    let mut out = Vec::new();
    walk(v, &mut out);
    out
}

/// Décode les images sur tous les cœurs (bureau).
#[cfg(not(target_arch = "wasm32"))]
fn decode_parallel(items: Vec<(usize, Vec<u8>)>) -> Vec<(usize, Decoded)> {
    use std::sync::atomic::{AtomicUsize, Ordering};
    let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4).min(items.len().max(1));
    let next = AtomicUsize::new(0);
    let out = std::sync::Mutex::new(Vec::with_capacity(items.len()));
    std::thread::scope(|sc| {
        for _ in 0..threads {
            sc.spawn(|| loop {
                let i = next.fetch_add(1, Ordering::Relaxed);
                let Some((k, b)) = items.get(i) else { break };
                if let Some(d) = decode_png(b) {
                    out.lock().unwrap_or_else(|e| e.into_inner()).push((*k, d));
                }
            });
        }
    });
    out.into_inner().unwrap_or_else(|e| e.into_inner())
}

pub(crate) fn png_data_url(w: usize, h: usize, px: &[u8]) -> String {
    use image::ImageEncoder;
    let mut out = std::io::Cursor::new(Vec::new());
    // compression rapide : la sauvegarde automatique écrit souvent de grandes images
    let enc = image::codecs::png::PngEncoder::new_with_quality(&mut out, image::codecs::png::CompressionType::Fast, image::codecs::png::FilterType::Sub);
    let _ = enc.write_image(px, w as u32, h as u32, image::ExtendedColorType::Rgba8);
    format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(out.into_inner()))
}

/// PNG déjà encodés des calques inchangés (clé : le tampon de pixels, partagé tant qu'il n'est pas
/// modifié). La sauvegarde automatique ré-encodait sinon tous les calques à chaque passage : des
/// secondes de gel sur une grande image.
///
/// Seuls les calques de la dernière sauvegarde sont gardés : une entrée restée pour chaque étape
/// d'historique (tampon encore vivant, mais plus affiché) pesait des dizaines de Mo par étape sur
/// une photo, et les projets fermés ne partaient pas avant la sauvegarde suivante.
/// Adresse data: d'une image, ou d'un masque α (un octet par pixel, écrit en gris) si `gray`.
pub(crate) fn png_url_of(px: &[u8], w: usize, h: usize, gray: bool) -> String {
    if gray {
        let rgba: Vec<u8> = px.iter().flat_map(|v| [*v, *v, *v, 255]).collect();
        png_data_url(w, h, &rgba)
    } else {
        png_data_url(w, h, px)
    }
}

/// Image pas encore encodée pour la prochaine sauvegarde.
#[cfg(target_arch = "wasm32")]
pub(crate) struct PngJob {
    pub px: crate::editor::Px,
    pub w: usize,
    pub h: usize,
    pub gray: bool,
}

/// Images de ces documents absentes du cache (à confier au worker de calcul).
#[cfg(target_arch = "wasm32")]
pub(crate) fn missing_pngs(docs: &[&Doc]) -> Vec<PngJob> {
    let cache = PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner());
    let mut out: Vec<PngJob> = Vec::new();
    let mut add = |px: &crate::editor::Px, w: usize, h: usize, gray: bool| {
        let key = px.weak();
        if !cache.iter().any(|(k, cw, ch, _)| k.ptr_eq(&key) && *cw == w && *ch == h) && !out.iter().any(|j| j.px.weak().ptr_eq(&key)) {
            out.push(PngJob { px: px.clone(), w, h, gray });
        }
    };
    for d in docs.iter().filter(|d| d.mask_of.is_none()) {
        for l in &d.layers {
            if l.off.is_none() {
                add(&l.px, d.w, d.h, false);
            }
            if d.anim.is_some() {
                for c in &l.cels {
                    add(&c.px, d.w, d.h, false);
                }
            }
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == d.w * d.h) {
                add(m, d.w, d.h, true);
            }
        }
    }
    out
}

/// Résultat du worker, repris tel quel par `save_all`.
#[cfg(target_arch = "wasm32")]
pub(crate) fn cache_png(px: &crate::editor::Px, w: usize, h: usize, url: String) {
    PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner()).push((px.weak(), w, h, std::sync::Arc::new(url)));
}

static PNG_CACHE: std::sync::Mutex<Vec<(std::sync::Weak<Vec<u8>>, usize, usize, std::sync::Arc<String>)>> = std::sync::Mutex::new(Vec::new());
static PNG_USED: std::sync::Mutex<Vec<std::sync::Weak<Vec<u8>>>> = std::sync::Mutex::new(Vec::new());

fn png_data_url_cached(w: usize, h: usize, px: &crate::editor::Px) -> std::sync::Arc<String> {
    png_url_cached(w, h, px, false)
}

fn png_url_cached(w: usize, h: usize, px: &crate::editor::Px, gray: bool) -> std::sync::Arc<String> {
    let key = px.weak();
    PNG_USED.lock().unwrap_or_else(|e| e.into_inner()).push(key.clone());
    {
        let mut cache = PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        cache.retain(|(k, ..)| k.strong_count() > 0);
        if let Some((_, _, _, url)) = cache.iter().find(|(k, cw, ch, _)| k.ptr_eq(&key) && *cw == w && *ch == h) {
            return url.clone();
        }
    }
    let url = std::sync::Arc::new(png_url_of(px, w, h, gray));
    PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner()).push((key, w, h, url.clone()));
    url
}

/// Document d'un projet pixel (calques posés à leur position, opacité, fusion, filtre dynamique).
fn pixel_project(p: &Value) -> Doc {
    let name = p.get("name").and_then(|n| n.as_str()).unwrap_or("Projet").to_string();
    let w = p.get("width").and_then(|x| x.as_u64()).unwrap_or(1280).clamp(1, 16384) as usize;
    let h = p.get("height").and_then(|x| x.as_u64()).unwrap_or(720).clamp(1, 16384) as usize;
    let mut doc = Doc::new(w, h, [0, 0, 0, 0], &name);
    doc.layers.clear();
    // dossiers : identifiant du fichier de chaque calque et de son dossier parent
    let mut ids: Vec<(String, Option<String>)> = Vec::new();
    for l in p.get("pixelLayers").and_then(|x| x.as_array()).into_iter().flatten() {
        let mut layer = Layer::new(l.get("name").and_then(|n| n.as_str()).unwrap_or("Calque"), w, h, [0, 0, 0, 0]);
        layer.visible = l.get("visible").and_then(|b| b.as_bool()).unwrap_or(true);
        // clés de la version Rust (ignorées par la version web)
        layer.locked = l.get("locked").and_then(|b| b.as_bool()).unwrap_or(false);
        layer.group = l.get("isGroup").and_then(|b| b.as_bool()).unwrap_or(false);
        layer.collapsed = l.get("collapsed").and_then(|b| b.as_bool()).unwrap_or(false);
        layer.pass = l.get("passThrough").and_then(|b| b.as_bool()).unwrap_or(true);
        layer.vector = l.get("textObject").and_then(crate::vector::from_json).map(Box::new);
        ids.push((
            l.get("id").map(|v| v.as_str().map(String::from).unwrap_or_else(|| v.to_string())).unwrap_or_default(),
            l.get("parentId").and_then(|v| v.as_str()).map(String::from),
        ));
        layer.opacity = l.get("opacity").and_then(|o| o.as_f64()).unwrap_or(1.0).clamp(0.0, 1.0) as f32;
        layer.blend = Blend::from_css(l.get("blendMode").and_then(|b| b.as_str()).unwrap_or("source-over"));
        let (lx, ly) = (l.get("x").and_then(|x| x.as_f64()).unwrap_or(0.0) as isize, l.get("y").and_then(|x| x.as_f64()).unwrap_or(0.0) as isize);
        if let Some((iw, ih, px)) = l.get("dataUrl").and_then(|d| d.as_str()).filter(|d| !d.is_empty()).and_then(decode_data_url) {
            let mut outside = false;
            for y in 0..ih {
                for x in 0..iw {
                    let (dx, dy) = (lx + x as isize, ly + y as isize);
                    let si = (y * iw + x) * 4;
                    if dx < 0 || dy < 0 || dx as usize >= w || dy as usize >= h {
                        outside |= px[si + 3] > 0;
                        continue;
                    }
                    let di = (dy as usize * w + dx as usize) * 4;
                    layer.px[di..di + 4].copy_from_slice(&px[si..si + 4]);
                }
            }
            // contenu hors de la toile (calque plus grand ou décalé) : gardé
            if outside {
                layer.off = Some(crate::editor::Off { x: lx, y: ly, w: iw, h: ih, px: px.into() });
            }
        }
        // animation : dessins de la frise (cels), dataUrl à la taille du document
        if let Some(cels) = l.get("cels").and_then(|c| c.as_array()).filter(|_| p.get("animation").and_then(crate::anim::from_json).is_some()) {
            for c in cels {
                let px = c.get("dataUrl").and_then(|d| d.as_str()).filter(|d| !d.is_empty()).and_then(decode_data_url)
                    .filter(|(iw, ih, _)| *iw == w && *ih == h).map(|(_, _, px)| px).unwrap_or_else(|| vec![0u8; w * h * 4]);
                let hold = c.get("hold").and_then(|v| v.as_f64()).filter(|v| *v > 0.0).map_or(crate::anim::HOLD_INF, |v| (v as usize).min(crate::anim::HOLD_INF));
                let vector = c.get("vector").and_then(crate::vector::from_json).map(Box::new);
                layer.cels.push(crate::anim::Cel { frame: c.get("frame").and_then(|v| v.as_u64()).unwrap_or(0) as usize, hold, px: px.into(), vector });
            }
            layer.cels.sort_by_key(|c| c.frame);
        }
        let stack: Vec<(String, f32)> = l
            .get("dynamicFilterStack")
            .and_then(|s| s.as_array())
            .map(|arr| arr.iter().filter_map(|f| Some((f.get("type")?.as_str()?.to_string(), f.get("radius").and_then(|r| r.as_f64()).unwrap_or(6.0) as f32))).collect())
            .unwrap_or_default();
        layer.dynamic_mode = l.get("dynamicFilterMode").and_then(|m| m.as_i64()).unwrap_or(0) as i32;
        if l.get("dynamicFilterEnabled").and_then(|b| b.as_bool()).unwrap_or(false) {
            layer.dynamic = Some(stack);
        } else {
            layer.dyn_saved = stack; // chaîne gardée pour une réactivation
        }
        doc.layers.push(layer);
    }
    // dossier parent : retrouvé par l'identifiant du fichier (l'ordre est rétabli au chargement,
    // après les masques α, par `normalize_groups`)
    for k in 0..ids.len().min(doc.layers.len()) {
        if let Some(pid) = &ids[k].1 {
            if let Some(j) = ids.iter().position(|(id, _)| id == pid).filter(|&j| j != k && doc.layers[j].group) {
                doc.layers[k].parent = doc.layers[j].uid;
            }
        }
    }
    if doc.layers.is_empty() {
        doc.layers.push(Layer::new("Arrière-plan", w, h, [255, 255, 255, 255]));
    }
    doc.anim = p.get("animation").and_then(crate::anim::from_json);
    crate::anim::resolve(&mut doc);
    doc
}

/// Lit un fichier .illu : un document par projet pixel (calques, positions, opacité, fusion).
pub fn load(bytes: &[u8]) -> Result<Loaded, String> {
    let v = parse(bytes)?;
    #[cfg(not(target_arch = "wasm32"))]
    let pre = decode_parallel(image_payloads(&v));
    #[cfg(target_arch = "wasm32")]
    let pre = Vec::new();
    load_parsed(&v, pre)
}

/// Assemble les projets d'un .illu analysé ; `pre` : images déjà décodées (`image_payloads`),
/// les autres sont décodées au passage.
pub fn load_parsed(v: &Value, pre: Vec<(usize, Decoded)>) -> Result<Loaded, String> {
    PRE.with(|m| m.borrow_mut().extend(pre));
    let out = load_value(v);
    PRE.with(|m| m.borrow_mut().clear());
    out
}

fn load_value(v: &Value) -> Result<Loaded, String> {
    // (pas de copie du JSON : ses textes base64 font souvent des dizaines de Mo)
    let projects: &[Value] = match v.get("projects").and_then(|p| p.as_array()) {
        Some(a) => a,
        None => std::slice::from_ref(v),
    };
    let mut docs = vec![];
    let mut skipped = vec![];
    // masques α liés (projets « layerAlphaMask ») : repris dans le calque parent
    let find_mask = |id: &Value| projects.iter().find(|q| q.get("id") == Some(id) && q.get("role").and_then(|r| r.as_str()) == Some("layerAlphaMask"));
    for p in projects {
        let name = p.get("name").and_then(|n| n.as_str()).unwrap_or("Projet").to_string();
        let mode = p.get("mode").and_then(|m| m.as_str()).unwrap_or("pixel");
        let role = p.get("role").and_then(|r| r.as_str()).unwrap_or("main");
        if role != "main" {
            continue;
        }
        if !mode.starts_with("pixel") {
            skipped.push(format!("{name} (projet vectoriel)"));
            continue;
        }
        let mut doc = pixel_project(p);
        doc.mode = ColorMode::from_illu(mode);
        doc.vector_mode = p.get("vectorMode").and_then(|v| v.as_bool()).unwrap_or(false);
        let (w, h) = (doc.w, doc.h);
        for (l, lj) in doc.layers.iter_mut().zip(p.get("pixelLayers").and_then(|x| x.as_array()).into_iter().flatten()) {
            let Some(mp) = lj.get("alphaMaskProjectId").filter(|v| !v.is_null()).and_then(|id| find_mask(id)) else { continue };
            let md = pixel_project(mp);
            if md.w == w && md.h == h {
                l.mask = Some(md.mask_values());
            } else {
                // masque à la taille du calque d'origine : posé en haut à gauche
                let mv = md.mask_values();
                let mut out = vec![0u8; w * h];
                let (lx, ly) = (lj.get("x").and_then(|x| x.as_f64()).unwrap_or(0.0) as isize, lj.get("y").and_then(|x| x.as_f64()).unwrap_or(0.0) as isize);
                for y in 0..md.h {
                    for x in 0..md.w {
                        let (dx, dy) = (lx + x as isize, ly + y as isize);
                        if dx >= 0 && dy >= 0 && (dx as usize) < w && (dy as usize) < h {
                            out[dy as usize * w + dx as usize] = mv[y * md.w + x];
                        }
                    }
                }
                l.mask = Some(out.into());
            }
        }
        doc.active = (p.get("activeLayerIndex").and_then(|i| i.as_u64()).unwrap_or(0) as usize).min(doc.layers.len() - 1);
        // dossiers : contenu rangé juste sous chaque dossier (rien à faire sans dossier)
        doc.normalize_groups();
        doc.history.clear();
        doc.hindex = 0;
        doc.commit("Ouvrir le projet");
        docs.push(doc);
    }
    if docs.is_empty() && skipped.is_empty() {
        return Err("aucun projet dans ce fichier .illu".into());
    }
    Ok(Loaded { docs, skipped })
}

/// Écrit un document au format .illu (un projet pixel, sans historique).
pub fn save(doc: &Doc) -> Vec<u8> {
    save_all(&[doc], 0)
}

/// Plusieurs documents dans un seul fichier .illu (sauvegarde automatique de tous les onglets).
/// Les onglets de masque α ne sont pas écrits à part : leur contenu est dans le calque parent.
pub fn save_all(docs: &[&Doc], active: usize) -> Vec<u8> {
    PNG_USED.lock().unwrap_or_else(|e| e.into_inner()).clear();
    let bytes = save_all_inner(docs, active);
    let used = std::mem::take(&mut *PNG_USED.lock().unwrap_or_else(|e| e.into_inner()));
    PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner()).retain(|(k, ..)| used.iter().any(|u| u.ptr_eq(k)));
    bytes
}

/// Oublie les images encodées des projets fermés (leurs pixels n'existent plus).
pub(crate) fn forget_closed_pngs() {
    PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner()).retain(|(k, ..)| k.strong_count() > 0);
}

thread_local! {
    /// images du fichier en cours d'écriture : dans le JSON, seulement un jeton (voir `splice_images`)
    static IMAGES: std::cell::RefCell<Vec<std::sync::Arc<String>>> = const { std::cell::RefCell::new(Vec::new()) };
}

const IMAGE_MARK: &str = "@@mp-image-";

/// Jeton à la place d'une image dans le JSON.
fn image_token(url: std::sync::Arc<String>) -> String {
    IMAGES.with(|v| {
        let mut v = v.borrow_mut();
        v.push(url);
        format!("{IMAGE_MARK}{}@@", v.len() - 1)
    })
}

/// Remet les images à la place de leurs jetons. Les adresses data: ne contiennent rien à échapper :
/// une simple recopie, au lieu d'examiner chaque octet (une demi-seconde sur une grande photo).
fn splice_images(json: Vec<u8>) -> Vec<u8> {
    let images = IMAGES.with(|v| std::mem::take(&mut *v.borrow_mut()));
    let mark = IMAGE_MARK.as_bytes();
    let mut out = Vec::with_capacity(json.len() + images.iter().map(|u| u.len()).sum::<usize>());
    let mut rest = &json[..];
    while let Some(i) = rest.windows(mark.len()).position(|w| w == mark) {
        let after = &rest[i + mark.len()..];
        let end = after.iter().position(|c| *c == b'@').unwrap_or(0);
        let k: usize = std::str::from_utf8(&after[..end]).ok().and_then(|n| n.parse().ok()).unwrap_or(usize::MAX);
        out.extend_from_slice(&rest[..i]);
        if let Some(url) = images.get(k) {
            out.extend_from_slice(url.as_bytes());
        }
        rest = &after[(end + 2).min(after.len())..];
    }
    out.extend_from_slice(rest);
    out
}

fn save_all_inner(docs: &[&Doc], active: usize) -> Vec<u8> {
    IMAGES.with(|v| v.borrow_mut().clear());
    let mut projects = Vec::new();
    let mut active_project = 0;
    for (k, d) in docs.iter().enumerate().filter(|(_, d)| d.mask_of.is_none()) {
        if k == active {
            active_project = projects.len();
        }
        projects.extend(project_json(d, &format!("rust-project-{k}")));
    }
    splice_images(serde_json::to_vec(&json!({ "format": "illu-workspace", "version": 3, "activeProjectIndex": active_project, "projects": projects })).unwrap_or_default())
}

/// Projet pixel (et ses masques α liés) au format de la version web.
fn project_json(doc: &Doc, pid: &str) -> Vec<Value> {
    let mut masks: Vec<Value> = Vec::new();
    let layers: Vec<Value> = doc
        .layers
        .iter()
        .enumerate()
        .map(|(i, l)| {
            // « Hors toile » : tampon du calque entier, décalé (x, y), comme la version web
            let (lx, ly, data_url) = if l.off.is_none() {
                (0, 0, png_data_url_cached(doc.w, doc.h, &l.px))
            } else {
                let (lx, ly, lw, lh, full) = doc.layer_full(i);
                (lx, ly, std::sync::Arc::new(png_data_url(lw, lh, &full)))
            };
            let mut o = json!({
                "id": format!("rust-{i}"),
                "name": l.name,
                "visible": l.visible,
                "x": lx,
                "y": ly,
                "opacity": l.opacity,
                "blendMode": l.blend.css(),
                "alphaMaskProjectId": null,
                "dynamicFilterEnabled": l.dynamic.is_some(),
                "dynamicFilterStack": l.dynamic.as_ref().unwrap_or(&l.dyn_saved).iter().map(|(t, r)| json!({ "type": t, "radius": r })).collect::<Vec<_>>(),
                "dynamicFilterMode": l.dynamic_mode,
                "dataUrl": image_token(data_url),
            });
            if let Some(st) = &l.dynamic {
                o["dynamicFilterType"] = json!(st.first().map(|s| s.0.clone()));
            }
            // version Rust : verrou, dossiers, calque texte (clés ignorées par la version web,
            // qui lit les pixels rendus de dataUrl)
            if l.locked {
                o["locked"] = json!(true);
            }
            if l.group {
                o["isGroup"] = json!(true);
                o["collapsed"] = json!(l.collapsed);
                o["passThrough"] = json!(l.pass);
            }
            if l.parent != 0 {
                if let Some(j) = doc.layers.iter().position(|p| p.uid == l.parent) {
                    o["parentId"] = json!(format!("rust-{j}"));
                }
            }
            if let Some(v) = &l.vector {
                o["textObject"] = crate::vector::to_json(v);
            }
            // animation : dessins de la frise (maintien sans fin écrit null, comme la version web)
            if doc.anim.is_some() && !l.cels.is_empty() {
                o["cels"] = json!(l
                    .cels
                    .iter()
                    .map(|c| {
                        let hold = if c.hold >= crate::anim::HOLD_INF { Value::Null } else { json!(c.hold) };
                        let mut o = json!({ "frame": c.frame, "hold": hold, "dataUrl": image_token(png_data_url_cached(doc.w, doc.h, &c.px)) });
                        // mode Animation SVG : objets du dessin (MasterPaint Rust seulement)
                        if let Some(v) = &c.vector {
                            o["vector"] = crate::vector::to_json(v);
                        }
                        o
                    })
                    .collect::<Vec<_>>());
            }
            // masque α : projet lié « layerAlphaMask » (comme la version web)
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == doc.w * doc.h) {
                let mid = format!("{pid}-mask-{i}");
                o["alphaMaskProjectId"] = json!(mid);
                masks.push(json!({
                    "id": mid,
                    "name": format!("α {}", l.name),
                    "mode": "pixel",
                    "width": doc.w,
                    "height": doc.h,
                    "activeLayerIndex": 0,
                    "pixelLayers": [{ "id": format!("{mid}-0"), "name": "Masque", "visible": true, "x": 0, "y": 0, "opacity": 1, "blendMode": "source-over", "alphaMaskProjectId": null, "dataUrl": image_token(png_url_cached(doc.w, doc.h, m, true)) }],
                    "vectorLayers": [],
                    "role": "layerAlphaMask",
                    "parentProjectId": pid,
                    "parentLayerId": format!("rust-{i}"),
                    "historyIndex": -1,
                    "historySerialized": [],
                }));
            }
            o
        })
        .collect();
    let mut project = json!({
        "id": pid,
        "name": doc.title,
        "mode": if doc.anim.is_some() { "pixel-anim" } else { doc.mode.illu() },
        "width": doc.w,
        "height": doc.h,
        "activeLayerIndex": doc.active,
        "pixelLayers": layers,
        "vectorLayers": [],
        // mode SVG de MasterPaint Rust (la version web garde « mode » pour le pixel / l'animation)
        "vectorMode": doc.vector_mode,
        "role": "main",
        "historyIndex": -1,
        "historySerialized": [],
    });
    if let Some(a) = &doc.anim {
        project["animation"] = crate::anim::to_json(a);
    }
    let mut projects = vec![project];
    projects.extend(masks);
    projects
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip_layers_blend_and_dynamic() {
        let mut d = Doc::new(8, 6, [10, 20, 30, 255], "essai");
        d.add_layer();
        d.layer_mut().blend = Blend::Luminosity;
        d.layer_mut().opacity = 0.5;
        d.layer_mut().px[0..4].copy_from_slice(&[200, 100, 50, 255]);
        d.layer_mut().dynamic = Some(vec![("blur".into(), 4.0)]);
        let mut mv = vec![255u8; 8 * 6];
        mv[1] = 0;
        d.layer_mut().mask = Some(mv.into());
        let bytes = save(&d);
        let l = load(&bytes).unwrap();
        let e = &l.docs[0];
        assert_eq!((e.w, e.h, e.layers.len()), (8, 6, 2));
        assert_eq!(e.layers[1].blend, Blend::Luminosity);
        assert!((e.layers[1].opacity - 0.5).abs() < 1e-6);
        assert_eq!(&e.layers[1].px[0..4], &[200, 100, 50, 255]);
        let m = e.layers[1].mask.as_ref().expect("masque α relu");
        assert_eq!((m[0], m[1]), (255, 0), "masque α : blanc visible, noir masqué");
        assert_eq!(&e.layers[0].px[4..8], &[10, 20, 30, 255]);
        assert_eq!(e.layers[1].dynamic.as_ref().unwrap()[0].0, "blur");
    }

    #[test]
    fn roundtrip_color_mode() {
        let mut d = Doc::new(4, 4, [10, 200, 30, 255], "ral");
        d.set_color_mode(ColorMode::Ral);
        let l = load(&save(&d)).unwrap();
        assert_eq!(l.docs[0].mode, ColorMode::Ral);
        assert_eq!(&l.docs[0].layers[0].px[..4], &d.layers[0].px[..4]);
    }
}

#[cfg(test)]
mod bench {
    /// Lecture d'un .illu : décodage en série (ancien chemin) puis en parallèle :
    /// `MP_ILLU=fichier.illu cargo test --release --lib illu_speed -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn illu_speed() {
        let bytes = std::fs::read(std::env::var("MP_ILLU").unwrap()).unwrap();
        let t = std::time::Instant::now();
        let v = super::parse(&bytes).unwrap();
        let serial = super::load_parsed(&v, Vec::new()).unwrap();
        let t1 = t.elapsed();
        let t = std::time::Instant::now();
        let par = super::load(&bytes).unwrap();
        let t2 = t.elapsed();
        assert_eq!(serial.docs.len(), par.docs.len());
        for (a, b) in serial.docs.iter().zip(&par.docs) {
            assert!(a.layers.iter().zip(&b.layers).all(|(x, y)| *x.px == *y.px), "pixels différents");
        }
        println!("{} projet(s) : en série {t1:?}, en parallèle {t2:?}", par.docs.len());
    }
}
