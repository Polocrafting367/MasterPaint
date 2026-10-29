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

fn decode_data_url(s: &str) -> Option<(usize, usize, Vec<u8>)> {
    let b64 = s.split_once(',').map(|(_, b)| b).unwrap_or(s);
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64.trim()).ok()?;
    let img = image::load_from_memory(&bytes).ok()?.to_rgba8();
    let (w, h) = img.dimensions();
    Some((w as usize, h as usize, img.into_raw()))
}

fn png_data_url(w: usize, h: usize, px: &[u8]) -> String {
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
static PNG_CACHE: std::sync::Mutex<Vec<(std::sync::Weak<Vec<u8>>, usize, usize, std::sync::Arc<String>)>> = std::sync::Mutex::new(Vec::new());

fn png_data_url_cached(w: usize, h: usize, px: &crate::editor::Px) -> std::sync::Arc<String> {
    let key = px.weak();
    {
        let mut cache = PNG_CACHE.lock().unwrap_or_else(|e| e.into_inner());
        cache.retain(|(k, ..)| k.strong_count() > 0);
        if let Some((_, _, _, url)) = cache.iter().find(|(k, cw, ch, _)| k.ptr_eq(&key) && *cw == w && *ch == h) {
            return url.clone();
        }
    }
    let url = std::sync::Arc::new(png_data_url(w, h, px));
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
    doc
}

/// Lit un fichier .illu : un document par projet pixel (calques, positions, opacité, fusion).
pub fn load(bytes: &[u8]) -> Result<Loaded, String> {
    let v: Value = serde_json::from_slice(bytes).map_err(|e| format!("fichier .illu illisible : {e}"))?;
    let projects = v.get("projects").and_then(|p| p.as_array()).cloned().unwrap_or_else(|| vec![v.clone()]);
    let mut docs = vec![];
    let mut skipped = vec![];
    // masques α liés (projets « layerAlphaMask ») : repris dans le calque parent
    let find_mask = |id: &Value| projects.iter().find(|q| q.get("id") == Some(id) && q.get("role").and_then(|r| r.as_str()) == Some("layerAlphaMask"));
    for p in &projects {
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
    let mut projects = Vec::new();
    let mut active_project = 0;
    for (k, d) in docs.iter().enumerate().filter(|(_, d)| d.mask_of.is_none()) {
        if k == active {
            active_project = projects.len();
        }
        projects.extend(project_json(d, &format!("rust-project-{k}")));
    }
    serde_json::to_vec(&json!({ "format": "illu-workspace", "version": 3, "activeProjectIndex": active_project, "projects": projects })).unwrap_or_default()
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
                "dataUrl": data_url.as_str(),
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
            // masque α : projet lié « layerAlphaMask » (comme la version web)
            if let Some(m) = l.mask.as_ref().filter(|m| m.len() == doc.w * doc.h) {
                let mid = format!("{pid}-mask-{i}");
                o["alphaMaskProjectId"] = json!(mid);
                let gray: Vec<u8> = m.iter().flat_map(|v| [*v, *v, *v, 255]).collect();
                masks.push(json!({
                    "id": mid,
                    "name": format!("α {}", l.name),
                    "mode": "pixel",
                    "width": doc.w,
                    "height": doc.h,
                    "activeLayerIndex": 0,
                    "pixelLayers": [{ "id": format!("{mid}-0"), "name": "Masque", "visible": true, "x": 0, "y": 0, "opacity": 1, "blendMode": "source-over", "alphaMaskProjectId": null, "dataUrl": png_data_url(doc.w, doc.h, &gray) }],
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
    let project = json!({
        "id": pid,
        "name": doc.title,
        "mode": doc.mode.illu(),
        "width": doc.w,
        "height": doc.h,
        "activeLayerIndex": doc.active,
        "pixelLayers": layers,
        "vectorLayers": [],
        "role": "main",
        "historyIndex": -1,
        "historySerialized": [],
    });
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
