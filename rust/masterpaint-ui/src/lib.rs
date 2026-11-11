// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! MasterPaint — interface native en Rust (Slint), partagée par le bureau et le web.
//!
//! Mise en page de la version web en mode Paint.NET : barre de menus, barre rapide,
//! ruban (ou barre classique), fenêtres volantes Outils / Couleurs / Calques /
//! Historique, barre d'état. Le dessin, les calques, la sélection et les effets sont
//! calculés en Rust (`editor`, `paint`, `tools`, `masterpaint-core`).

#![recursion_limit = "256"]

mod anim;
mod icon_packs;
mod reference_assets_gen;
mod fa_svg_gen;
mod shape_edit;
mod gradlive;
mod vecedit;
mod vecrender;
mod vecview;
mod ascii;
mod appearance;
#[cfg(target_os = "android")]
mod android_io;
#[cfg(target_os = "android")]
use android_io as rfd;
#[cfg(target_os = "android")]
use android_io::clipboard as arboard;
#[cfg(not(target_arch = "wasm32"))]
mod clipboard_size;
mod perf;
mod background;
mod colorspace;
mod curves;
mod editor;
mod gallery_gen;
mod lightcraft_looks_gen;
mod gpu;
mod gpu_damage;
mod gpuview;
mod groups;
mod vector;
mod svg_import;
mod svg_panel;
#[cfg(target_arch = "wasm32")]
mod webgl;
mod effects;
mod effects_gen;
mod illu;
mod settings;
#[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
mod snapshot;
mod sprite_gen;
mod fonts_gen;
mod text;
mod transform;
mod icons_gen;
mod mpicons_gen;
mod mp_fa_gen;
mod fa_used_gen;
mod pdn;
mod psd;
mod paint;
mod pen;
mod photo;
mod pm_store;
mod pm_masks;
mod raw;
mod scene;
mod i18n;
mod ral_gen;
mod theme;
mod tools;

use editor::{Blend, ColorMode, Doc, SelMode};
use paint::{BrushShape, GradientKind, ShapeStyle};
use slint::{Color, ComponentHandle, Image, Model, ModelRc, Rgba8Pixel, SharedPixelBuffer, SharedString, VecModel};
use std::cell::RefCell;
use std::rc::Rc;
use tools::{Outcome, Session, Tool};

slint::include_modules!();

/// Version des fichiers proposés au téléchargement.
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

struct State {
    doc: Doc,
    session: Session,
    tool: Tool,
    display: Vec<u8>,
    clipboard: Option<Clip>,
    last_effect: Option<(String, Vec<f32>, String)>,
    /// réglages de la fenêtre du dernier effet (aberration…) et sa portée, pour Répéter (Ctrl+F)
    last_effect_vals: Option<(effects::Vals, i32)>,
    effect: Option<EffectSession>,
    effect_memory: std::collections::HashMap<String, effects::Vals>,
    effect_timer: Rc<slint::Timer>,
    fonts: text::Fonts,
    text_edit: Option<TextEdit>,
    /// outil Déplacer sur un calque texte : (calque, dernier point, objet saisi, déplacé)
    vector_drag: Option<(u64, f32, f32, usize, bool)>,
    /// … et le rendu des autres objets du calque + le cadre déjà dessiné de l'objet saisi
    vector_drag_base: Option<(editor::Px, Option<(usize, usize, usize, usize)>)>,
    floating: Option<transform::Floating>,
    /// autres images ouvertes (l'image active est doc, sa case vaut None)
    tabs: Vec<Option<Doc>>,
    cur: usize,
    transform_drag: Option<(transform::Grab, transform::Floating, (f32, f32))>,
    /// Déformation / 4 coins : tracé d'une nouvelle sélection (clic hors de la sélection)
    sel_drag: bool,
    ants_phase: usize,
    /// contour des fourmis : (sélection, pas, rectangle), pixels de l'affichage, tuiles touchées
    ants_cache: Option<((usize, usize, (usize, usize, usize, usize)), Vec<u32>, Vec<(usize, usize)>)>,
    /// tuiles posées sur l'image complète depuis le dernier envoi entier (voir `upload_rect`)
    tiles: Rc<VecModel<CanvasTile>>,
    tile_index: std::collections::HashMap<(usize, usize), usize>,
    /// grande image : seules les tuiles visibles sont composées (voir `LAZY_MIN`)
    lazy: bool,
    /// tuiles de l'affichage à jour (composées et envoyées) en mode `lazy`
    tile_ok: std::collections::HashSet<(usize, usize)>,
    /// Tuiles de l'affichage avec au moins un pixel transparent (voir sync_canvas_opaque).
    tile_clear: std::collections::HashSet<(usize, usize)>,
    /// état du masque α ouvert à sa dernière recopie vers son projet (voir write_back_mask)
    mask_sig: u64,
    /// mode `lazy` : aperçu réduit de toute l'image (fond sous les tuiles, vignettes) et son pas
    backdrop: Vec<u8>,
    bs: usize,
    /// vignettes des calques, gardées tant que les pixels du calque ne changent pas
    /// vignettes des calques, avec une référence faible sur les pixels dont elles sont tirées
    /// (une copie de `Px` ici obligeait la prochaine écriture à recopier tout le calque)
    thumbs: Vec<(std::sync::Weak<Vec<u8>>, Image)>,
    /// cadre de la sélection (mis à jour par refresh_all) : animation des fourmis
    sel_bounds: Option<(usize, usize, usize, usize)>,
    dyn_inflight: std::collections::HashSet<u64>,
    /// aucun projet ouvert (dernier onglet fermé) : `doc` n'est qu'un document vide de 1 × 1,
    /// sans onglet ni toile affichés ; palettes grisées
    empty: bool,
    /// calque dynamique en cours de réglage : rendu rapide au pas réduit (voir `dyn_draft`)
    dyn_draft: Option<u64>,
    /// rendus réduits en cours de calcul (un seul à la fois par calque, le dernier réglage gagne)
    dyn_draft_flight: std::collections::HashSet<u64>,
    /// calque SVG créé à l'appui d'un outil Formes (uid, calque actif d'avant) : retiré si le
    /// geste ne trace rien
    shape_layer_new: Option<(u64, usize)>,
    /// forme « vivante » (poignées, rotation, ruban en direct) avant d'être posée
    shape_edit: Option<shape_edit::ShapeEdit>,
    /// chemin en cours de tracé (Plume, Crayon) ou de modification (Sélection directe)
    path_edit: Option<vecedit::PathEdit>,
    /// dégradé tracé, encore modifiable (ses 3 points) avant d'être posé
    grad_live: Option<gradlive::GradLive>,
    /// dernier appui sur la toile (position du double-clic)
    last_press: (f32, f32),
    /// affichage d'un projet SVG, tracé à la résolution de l'écran
    vv: vecview::VecView,
    /// pixels du calque relevés à l'appui d'un outil Formes (fond de la forme vivante)
    shape_base: Option<(u64, editor::Px)>,
    /// effet en cours de réglage sur un calque dynamique (aperçu par sa pile, voir `dyn_preview`)
    dyn_fx: Option<DynEdit>,
    /// étage de la pile à modifier par la prochaine fenêtre d'effet (bouton « Réglages… »)
    dyn_pending_edit: Option<usize>,
    /// taille mise de côté en passant du crayon au pinceau / à la gomme (et inversement)
    other_size: f32,
    dyn_timer: Rc<slint::Timer>,
    /// calque en cours de renommage
    rename_index: usize,
    /// fenêtre « Courbes » ouverte
    curves: Option<CurvesSession>,
    /// pincement à deux doigts en cours : la toile ignore les doigts
    pinching: bool,
    /// aperçus des polices (liste de l'outil Texte), même ordre que les noms
    font_previews: Vec<Image>,
    /// signature des onglets à la dernière sauvegarde automatique
    autosave_sig: u64,
    /// dernière sauvegarde automatique (ms)
    autosave_at: f64,
    /// fenêtre de choix ouverte (fermeture, glisser-déposer, collage trop grand)
    task: Option<Task>,
    /// pas de l'affichage (1 = pleine résolution ; voir `display_step`)
    ds: usize,
    /// recadrage interactif en cours (Image › Recadrer)
    crop: Option<Crop>,
    /// pipette appuyée (vrai : couleur secondaire, clic droit)
    picking: Option<bool>,
    /// vignettes des onglets inactifs : (uid du document) → (état du document, image)
    tab_thumbs: std::collections::HashMap<u64, ((usize, usize, usize, usize), Image)>,
    /// Mode Photo Pro : pellicule et réglages (gardés à la fermeture du mode)
    photo: photo::PhotoMode,
    /// axe de symétrie déplacé (0 aucun, 1 vertical, 2 horizontal) et dernier appui sur une poignée
    sym_drag: u8,
    sym_click: f64,
    /// Aperçu 1:1 hors de la toile (popup du navigateur / seconde fenêtre) : dernier envoi (ms)
    live_sent: f64,
    /// signature de l'historique affiché (document, étapes, étape courante) : la liste n'est
    /// refaite que si elle change
    history_shown: u64,
}

// ------------------------------------------------------------------ sauvegarde automatique

/// Signature de l'espace de travail : change dès qu'un onglet est modifié, ouvert ou fermé.
fn workspace_sig(st: &State) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    st.cur.hash(&mut h);
    st.empty.hash(&mut h);
    for (i, t) in st.tabs.iter().enumerate() {
        let d = if i == st.cur { Some(&st.doc) } else { t.as_ref() };
        if let Some(d) = d {
            (d.uid, d.hindex, d.history.len(), &d.title, d.w, d.h).hash(&mut h);
        }
    }
    h.finish()
}

/// Tous les onglets, au format .illu (copie légère : les pixels sont partagés).
fn workspace_docs(st: &State) -> (Vec<Doc>, usize) {
    if st.empty {
        return (Vec::new(), 0);
    }
    let docs: Vec<Doc> = st.tabs.iter().enumerate().filter_map(|(i, t)| if i == st.cur { Some(st.doc.light_clone()) } else { t.as_ref().map(|d| d.light_clone()) }).collect();
    (docs, st.cur)
}

#[cfg(not(target_arch = "wasm32"))]
fn autosave_path() -> Option<std::path::PathBuf> {
    settings::Settings::data_dir().map(|d| d.join("autosave.illu"))
}

/// Sauvegarde automatique si quelque chose a changé (bureau : dans un autre fil ; web :
/// IndexedDB). `now` : écriture immédiate dans ce fil (fermeture de la fenêtre).
fn autosave(st: &mut State, now: bool) {
    // restauration en cours : surtout ne pas écraser la sauvegarde qu'on est en train de lire
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) || RESTORING.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    let sig = workspace_sig(st);
    let force = AUTOSAVE_FORCE.load(std::sync::atomic::Ordering::Relaxed);
    // fermeture de la page pendant une écriture confiée au worker : celle-ci serait perdue
    #[cfg(target_arch = "wasm32")]
    let force = force || (now && AUTOSAVE_RUNNING.with(|r| r.get()) != 0);
    if sig == st.autosave_sig && !force {
        return;
    }
    // l'encodage d'une grande image prend des secondes : pas pendant un geste (reporté au
    // prochain passage), sauf si la dernière sauvegarde remonte à plus d'une minute
    let t = now_ms();
    if !now && t - LAST_ACTIVITY.with(|a| a.get()) < 1500.0 && t - st.autosave_at < 60_000.0 {
        return;
    }
    // navigateur : la précédente est encore dans le worker ; celle-ci viendra au prochain passage
    #[cfg(target_arch = "wasm32")]
    if !now && AUTOSAVE_RUNNING.with(|r| r.get()) != 0 {
        return;
    }
    AUTOSAVE_FORCE.store(false, std::sync::atomic::Ordering::Relaxed);
    st.autosave_at = t;
    st.autosave_sig = sig;
    let (docs, cur) = workspace_docs(st);
    write_autosave(docs, cur, now);
}

thread_local! {
    /// dernier geste de l'utilisateur à la souris, au doigt ou au clavier (ms)
    static LAST_ACTIVITY: std::cell::Cell<f64> = const { std::cell::Cell::new(0.0) };
}

/// Numéro de la dernière écriture demandée : une écriture plus ancienne encore en route (projet
/// fermé entre-temps) est abandonnée au lieu de remettre ce projet dans la sauvegarde.
static AUTOSAVE_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
/// Sauvegarde automatique rétablie : à réécrire même si rien n'a changé.
static AUTOSAVE_FORCE: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
/// Bureau : écritures et suppression, une à la fois (écritures faites dans d'autres fils).
#[cfg(not(target_arch = "wasm32"))]
static AUTOSAVE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn write_autosave(docs: Vec<Doc>, cur: usize, now: bool) {
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    // plus aucun projet : pas de fichier vide, plus de sauvegarde du tout
    if docs.iter().all(|d| d.mask_of.is_some()) {
        return clear_autosave();
    }
    let gen = AUTOSAVE_GEN.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
    let latest = move || AUTOSAVE_GEN.load(std::sync::atomic::Ordering::Relaxed) == gen;
    #[cfg(target_arch = "wasm32")]
    let png_jobs = illu::missing_pngs(&docs.iter().collect::<Vec<&Doc>>());
    let write = move || {
        let refs: Vec<&Doc> = docs.iter().collect();
        let bytes = illu::save_all(&refs, cur);
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(p) = autosave_path() {
            let _guard = AUTOSAVE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
            if !latest() {
                return;
            }
            if let Some(dir) = p.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let tmp = p.with_extension("tmp");
            if std::fs::write(&tmp, &bytes).is_ok() {
                let _ = std::fs::rename(&tmp, &p);
            }
        }
        #[cfg(target_arch = "wasm32")]
        if latest() {
            web::store_save(&bytes);
        }
    };
    #[cfg(not(target_arch = "wasm32"))]
    {
        if now {
            write();
        } else {
            std::thread::spawn(write);
        }
    }
    // navigateur : un seul fil d'interface ; les images passent par le worker de calcul, sinon
    // leur encodage fige la page des secondes sur une grande photo
    #[cfg(target_arch = "wasm32")]
    {
        if now {
            return write();
        }
        AUTOSAVE_RUNNING.with(|r| r.set(gen));
        wasm_bindgen_futures::spawn_local(async move {
            for job in png_jobs {
                if !latest() {
                    break;
                }
                if let Some(url) = web::compute_png(&job.px, job.w, job.h, job.gray).await {
                    illu::cache_png(&job.px, job.w, job.h, url);
                }
            }
            if latest() {
                write();
            }
            AUTOSAVE_RUNNING.with(|r| {
                if r.get() == gen {
                    r.set(0);
                }
            });
        });
    }
}

/// Supprime la sauvegarde automatique ; toute écriture encore en route est abandonnée.
fn clear_autosave() {
    AUTOSAVE_GEN.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    #[cfg(not(target_arch = "wasm32"))]
    if let Some(p) = autosave_path() {
        let _guard = AUTOSAVE_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let _ = std::fs::remove_file(&p);
        let _ = std::fs::remove_file(p.with_extension("tmp"));
    }
    #[cfg(target_arch = "wasm32")]
    {
        AUTOSAVE_RUNNING.with(|r| r.set(0));
        web::store_clear();
    }
}

/// Un projet vient d'être fermé : il quitte tout de suite la sauvegarde et les mémoires tampons
/// (images encodées, vignettes, textures de la carte graphique).
fn forget_closed(st: &mut State) {
    illu::forget_closed_pngs();
    let live: std::collections::HashSet<u64> = std::iter::once(st.doc.uid).chain(st.tabs.iter().flatten().map(|d| d.uid)).collect();
    st.tab_thumbs.retain(|uid, _| live.contains(uid));
    gpu::compose_forget();
    #[cfg(target_arch = "wasm32")]
    webgl::forget();
    if AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) && !RESTORING.load(std::sync::atomic::Ordering::Relaxed) {
        st.autosave_sig = workspace_sig(st);
        st.autosave_at = now_ms();
        let (docs, cur) = workspace_docs(st);
        write_autosave(docs, cur, false);
    }
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    /// numéro de l'écriture confiée au worker (0 : aucune)
    static AUTOSAVE_RUNNING: std::cell::Cell<u64> = const { std::cell::Cell::new(0) };
}

/// Restauration de la session précédente en cours (lecture en arrière-plan) : la sauvegarde
/// automatique attend.
static RESTORING: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Restaure les onglets de la dernière session (au démarrage).
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
fn restore_workspace(app: &AppWindow, st: &mut State, bytes: &[u8]) {
    if let Ok(l) = illu::load(bytes) {
        restore_loaded(app, st, l);
    }
}

/// Ouvre les projets restaurés : à la place de l'onglet vide du démarrage s'il n'a pas été
/// touché, sinon (dessin commencé pendant la lecture) dans des onglets en plus.
fn restore_loaded(app: &AppWindow, st: &mut State, l: illu::Loaded) {
    let untouched = st.tabs.len() == 1 && st.doc.hindex == 0 && st.doc.history.len() == 1;
    let mut docs = l.docs;
    let n = docs.len();
    // jamais exportés : la fermeture d'un onglet restauré demandera confirmation
    for d in &mut docs {
        d.saved = (usize::MAX, 0);
    }
    let Some(last) = docs.pop() else { return };
    finish_edits(app, st);
    st.session = Session::default();
    // tous rangés dans leurs onglets d'un coup, le dernier affiché : un seul rendu (avant,
    // chaque projet était composé, avec ses vignettes et ses filtres ƒ, puis aussitôt caché)
    if untouched || st.empty {
        st.tabs.clear();
        st.doc = last;
    } else {
        let old = std::mem::replace(&mut st.doc, last);
        st.tabs[st.cur] = Some(old);
    }
    st.tabs.extend(docs.into_iter().map(Some));
    st.tabs.push(None);
    st.cur = st.tabs.len() - 1;
    set_empty(app, st, false);
    st.autosave_sig = workspace_sig(st);
    refresh_all(app, st);
    app.invoke_zoom_open();
    status(app, if n > 1 { i18n::tr_format!("{n} projets restaurés (sauvegarde automatique)") } else { "Projet restauré (sauvegarde automatique)".to_string() });
}

/// Navigateur : lecture d'un .illu avec les images des calques décodées par les workers de
/// calcul, plusieurs à la fois (le décodeur WebAssembly sur la page, une image après l'autre,
/// pouvait figer de longues secondes). Une image refusée par les workers est décodée sur place.
#[cfg(target_arch = "wasm32")]
async fn illu_load_workers(bytes: &[u8]) -> Result<illu::Loaded, String> {
    let v = illu::parse(bytes)?;
    let items = illu::image_payloads(&v);
    let n = items.len();
    // tous les décodages partent d'abord (les workers travaillent en parallèle), puis on attend
    let started: Vec<(usize, Option<js_sys::Promise>)> = items.iter().enumerate().map(|(i, (k, png))| (*k, web::decode_start(png, i))).collect();
    let mut pre = Vec::with_capacity(n);
    for (i, (k, p)) in started.into_iter().enumerate() {
        if i % 4 == 0 && n > 4 {
            web::loading_step(&i18n::tr_format!("Restauration des projets… {} / {}", i + 1, n));
        }
        if let Some(d) = match p {
            Some(p) => web::decode_finish(p).await,
            None => None,
        } {
            pre.push((k, d));
        }
    }
    illu::load_parsed(&v, pre)
}

/// Range un aperçu de police et republie la liste.
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
fn set_font_preview(app: &AppWindow, st: &mut State, i: usize, p: Option<(usize, usize, Vec<u8>)>) {
    let n = st.fonts.entries.len();
    st.font_previews.resize(n, Image::default());
    if let (Some((w, h, px)), true) = (p, i < n) {
        st.font_previews[i] = to_image(&px, w, h);
    }
    app.global::<FontList>().set_previews(ModelRc::new(VecModel::from(st.font_previews.clone())));
}

/// Aperçus de toutes les polices lisibles, calculés hors du fil de l'interface (bureau).
#[cfg(not(target_arch = "wasm32"))]
fn start_font_previews(app: &AppWindow, st: &State) {
    let sources = st.fonts.preview_sources();
    let weak = app.as_weak();
    std::thread::spawn(move || {
        let mut out = Vec::new();
        for (i, name, src) in sources {
            let bytes = match src {
                text::PreviewSource::Bytes(b) => b.to_vec(),
                text::PreviewSource::File(p) => std::fs::read(p).unwrap_or_default(),
            };
            if let Some(p) = text::decode_font(&bytes).and_then(|f| text::preview(&f, &name)) {
                out.push((i, p));
            }
        }
        let _ = slint::invoke_from_event_loop(move || {
            let Some(app) = weak.upgrade() else { return };
            let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            let n = st.fonts.entries.len();
            st.font_previews.resize(n, Image::default());
            for (i, (w, h, px)) in out {
                if i < n {
                    st.font_previews[i] = to_image(&px, w, h);
                }
            }
            app.global::<FontList>().set_previews(ModelRc::new(VecModel::from(st.font_previews.clone())));
        });
    });
}

/// Courbes en cours : calque d'origine (Annuler), points des 4 canaux, canal affiché.
struct CurvesSession {
    base: editor::Px,
    ch: [curves::Points; 4],
    active: usize,
    ed: curves::Editor,
}

/// Maximum non-destructive menu effects retained by one adjustment layer.
const DYN_MAX: usize = 12;

type Shared = Rc<RefCell<State>>;

/// Contenu copié : pixels et, s'il vient de MasterPaint, sa position d'origine et son document.
#[derive(Clone)]
struct Clip {
    w: usize,
    h: usize,
    px: Vec<u8>,
    origin: Option<(isize, isize, u64)>,
}

fn to_image(px: &[u8], w: usize, h: usize) -> Image {
    perf::note_upload();
    Image::from_rgba8(SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(px, w as u32, h as u32))
}

/// Liste de l'interface mise à jour sur place : seules les lignes changées sont réécrites.
/// Remplacer le modèle à chaque rafraîchissement faisait recréer toutes les lignes (calques,
/// onglets, historique) par Slint, même quand rien n'avait bougé.
fn sync_rows<T: Clone + PartialEq + 'static>(cur: ModelRc<T>, rows: Vec<T>, set: impl FnOnce(ModelRc<T>)) {
    if let Some(vm) = cur.as_any().downcast_ref::<VecModel<T>>() {
        if vm.row_count() == rows.len() {
            for (i, r) in rows.into_iter().enumerate() {
                if vm.row_data(i).as_ref() != Some(&r) {
                    vm.set_row_data(i, r);
                }
            }
        } else {
            vm.set_vec(rows);
        }
        return;
    }
    set(ModelRc::new(VecModel::from(rows)));
}

fn rgba(c: Color) -> [u8; 4] {
    [c.red(), c.green(), c.blue(), c.alpha()]
}

/// Horloge en millisecondes (std::time::Instant n'existe pas sur le web).
fn now_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::sync::OnceLock;
        static START: OnceLock<std::time::Instant> = OnceLock::new();
        START.get_or_init(std::time::Instant::now).elapsed().as_secs_f64() * 1000.0
    }
}

/// Image déjà décodée par le navigateur (web) : « MPRGBA01 », largeur et hauteur (u32 LE), RGBA.
const PREDECODED: &[u8; 8] = b"MPRGBA01";

fn decode(bytes: &[u8]) -> Option<(usize, usize, Vec<u8>)> {
    if bytes.len() > 16 && &bytes[..8] == PREDECODED {
        let w = u32::from_le_bytes(bytes[8..12].try_into().ok()?) as usize;
        let h = u32::from_le_bytes(bytes[12..16].try_into().ok()?) as usize;
        return (bytes.len() == 16 + w * h * 4).then(|| (w, h, bytes[16..].to_vec()));
    }
    let img = decode_oriented(bytes)?.to_rgba8();
    let (w, h) = img.dimensions();
    Some((w as usize, h as usize, img.into_raw()))
}

/// Décode une image en appliquant son orientation EXIF (photos de téléphone prises en
/// portrait : sans cela elles s'ouvraient couchées).
pub(crate) fn decode_oriented(bytes: &[u8]) -> Option<image::DynamicImage> {
    use image::ImageDecoder;
    let mut dec = image::ImageReader::new(std::io::Cursor::new(bytes)).with_guessed_format().ok()?.into_decoder().ok()?;
    let orientation = dec.orientation().unwrap_or(image::metadata::Orientation::NoTransforms);
    let mut img = image::DynamicImage::from_decoder(dec).ok()?;
    img.apply_orientation(orientation);
    Some(img)
}

/// Vignette sur damier (calques).
fn thumb(px: &[u8], w: usize, h: usize) -> Image {
    let (tw, th) = (38usize, 20usize);
    let mut out = vec![0u8; tw * th * 4];
    let s = (w as f32 / tw as f32).max(h as f32 / th as f32);
    let (ox, oy) = ((tw as f32 - w as f32 / s) / 2.0, (th as f32 - h as f32 / s) / 2.0);
    for y in 0..th {
        for x in 0..tw {
            let o = (y * tw + x) * 4;
            let chk = if ((x / 4) + (y / 4)) % 2 == 0 { 255u8 } else { 204 };
            let sx = ((x as f32 - ox) * s) as isize;
            let sy = ((y as f32 - oy) * s) as isize;
            let mut c = [chk, chk, chk, 255];
            if sx >= 0 && sy >= 0 && (sx as usize) < w && (sy as usize) < h {
                let i = (sy as usize * w + sx as usize) * 4;
                let a = px[i + 3] as u32;
                for k in 0..3 {
                    c[k] = ((px[i + k] as u32 * a + chk as u32 * (255 - a)) / 255) as u8;
                }
            }
            out[o..o + 4].copy_from_slice(&c);
        }
    }
    to_image(&out, tw, th)
}

fn hsv(h: f32, s: f32, v: f32) -> [u8; 3] {
    let c = v * s;
    let hp = (h / 60.0).rem_euclid(6.0);
    let x = c * (1.0 - (hp % 2.0 - 1.0).abs());
    let (r, g, b) = match hp as u32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    let m = v - c;
    [((r + m) * 255.0).round() as u8, ((g + m) * 255.0).round() as u8, ((b + m) * 255.0).round() as u8]
}

/// Couleur de la grille (mode « Grille ») : teinte en x ; en haut du blanc vers la
/// couleur pure, en bas de la couleur pure vers le noir.
fn grid_color(u: f32, v: f32) -> [u8; 3] {
    let hue = u.clamp(0.0, 1.0) * 360.0;
    let v = v.clamp(0.0, 1.0);
    if v < 0.5 { hsv(hue, v * 2.0, 1.0) } else { hsv(hue, 1.0, 1.0 - (v - 0.5) * 2.0) }
}

/// Roue / grille d'un masque α : dégradé de gris.
fn gray_ramp(size: usize) -> Image {
    let mut px = vec![255u8; size * size * 4];
    for y in 0..size {
        for x in 0..size {
            let v = (x as f32 / (size - 1) as f32 * 255.0).round() as u8;
            let o = (y * size + x) * 4;
            px[o..o + 3].fill(v);
        }
    }
    to_image(&px, size, size)
}

/// Interface d'un masque α : roue, grille et nuancier en niveaux de gris, couleurs ramenées au
/// gris ; retour à l'espace de couleur du projet en le quittant.
fn sync_mask_ui(app: &AppWindow, mask_doc: bool, gray: bool, mode: ColorMode) {
    app.set_mask_doc(mask_doc);
    if app.get_gray_palette() == gray { return; }
    if gray {
        app.set_gray_original_primary(app.get_primary_color());
        app.set_gray_original_secondary(app.get_secondary_color());
    }
    app.set_gray_palette(gray);
    if gray {
        app.set_wheel_image(gray_ramp(260));
        app.set_color_grid_image(gray_ramp(260));
        let pal: Vec<Color> = (0..28).map(|i| { let v = (i * 255 / 27) as u8; Color::from_rgb_u8(v, v, v) }).collect();
        app.set_mode_palette(ModelRc::new(VecModel::from(pal)));
        snap_color(app, false);
        snap_color(app, true);
        sync_color_fields(app);
    } else {
        app.set_primary_color(app.get_gray_original_primary());
        app.set_secondary_color(app.get_gray_original_secondary());
        app.global::<MenuState>().set_color_mode(-1);
        sync_color_mode(app, mode);
    }
}

/// Grille teinte × luminosité, filtrée par l'espace de couleur du projet.
fn color_grid(size: usize, mode: ColorMode) -> Image {
    let mut px = vec![255u8; size * size * 4];
    for y in 0..size {
        for x in 0..size {
            let c = grid_color(x as f32 / (size - 1) as f32, y as f32 / (size - 1) as f32);
            let o = (y * size + x) * 4;
            px[o..o + 3].copy_from_slice(&c);
        }
    }
    mode.convert_px(&mut px);
    to_image(&px, size, size)
}

/// RVB → (teinte 0..360, saturation 0..100, valeur 0..100).
fn rgb_to_hsv(r: u8, g: u8, b: u8) -> (f32, f32, f32) {
    let (r, g, b) = (r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0);
    let mx = r.max(g).max(b);
    let mn = r.min(g).min(b);
    let d = mx - mn;
    let h = if d <= 0.0 {
        0.0
    } else if mx == r {
        60.0 * ((g - b) / d).rem_euclid(6.0)
    } else if mx == g {
        60.0 * ((b - r) / d + 2.0)
    } else {
        60.0 * ((r - g) / d + 4.0)
    };
    (h, if mx <= 0.0 { 0.0 } else { d / mx * 100.0 }, mx * 100.0)
}

/// Couleur que modifient la roue, le carré et les curseurs de la fenêtre Couleurs.
fn edited_color(app: &AppWindow) -> Color {
    if app.get_color_edit_secondary() { app.get_secondary_color() } else { app.get_primary_color() }
}

fn set_edited_color(app: &AppWindow, c: Color) {
    if app.get_color_edit_secondary() {
        app.set_secondary_color(c);
    } else {
        app.set_primary_color(c);
    }
}

/// Couleurs récentes de la fenêtre Couleurs : la couleur peinte passe en tête (8 au plus),
/// enregistrée seulement si la liste change.
fn note_recent_color(app: &AppWindow, c: Color) {
    let m = app.get_recent_colors();
    let mut list: Vec<Color> = (0..m.row_count()).filter_map(|k| m.row_data(k)).collect();
    if list.first().map(|x| x.as_argb_encoded()) == Some(c.as_argb_encoded()) {
        return;
    }
    list.retain(|x| x.as_argb_encoded() != c.as_argb_encoded());
    list.insert(0, c);
    list.truncate(8);
    app.set_recent_colors(ModelRc::new(VecModel::from(list)));
    save_settings(app);
}

/// Met à jour les champs RVB / TSV / hexa de la fenêtre Couleurs (et le nom RAL / CMJN) pour la
/// couleur modifiée (principale ou secondaire).
fn sync_color_fields(app: &AppWindow) {
    let c = edited_color(app);
    let (h, s, v) = rgb_to_hsv(c.red(), c.green(), c.blue());
    let comps = vec![c.red() as f32, c.green() as f32, c.blue() as f32, c.alpha() as f32, h.round(), s.round(), v.round()];
    app.set_color_comps(ModelRc::new(VecModel::from(comps)));
    app.set_color_hex(SharedString::from(format!("{:02X}{:02X}{:02X}", c.red(), c.green(), c.blue())));
    let mode = ColorMode::from_index(app.global::<MenuState>().get_color_mode());
    app.set_color_info(SharedString::from(i18n::tr(&mode.describe([c.red(), c.green(), c.blue()]))));
    // RAL le plus proche de la principale (ruban de la pipette, comme la version web)
    let p = app.get_primary_color();
    app.set_color_ral(SharedString::from(i18n::tr(&ColorMode::Ral.describe([p.red(), p.green(), p.blue()]))));
}

/// Ramène la couleur principale (ou secondaire) dans l'espace du projet. Vrai si elle a changé.
fn snap_color(app: &AppWindow, primary: bool) -> bool {
    let mode = ColorMode::from_index(app.global::<MenuState>().get_color_mode());
    let c = if primary { app.get_primary_color() } else { app.get_secondary_color() };
    let mut m = if app.get_gray_palette() {[c.red(),c.green(),c.blue()]} else {mode.map([c.red(), c.green(), c.blue()])};
    // masque α : niveaux de gris seulement (luminance)
    if app.get_gray_palette() {
        let l = (0.299 * m[0] as f32 + 0.587 * m[1] as f32 + 0.114 * m[2] as f32).round() as u8;
        m = [l; 3];
    }
    if m == [c.red(), c.green(), c.blue()] {
        return false;
    }
    let n = Color::from_argb_u8(c.alpha(), m[0], m[1], m[2]);
    if primary {
        app.set_primary_color(n);
    } else {
        app.set_secondary_color(n);
    }
    true
}

/// Espace de couleur du projet actif : menu coché, barre d'état, roue et grille filtrées,
/// nuancier imposé et couleurs aimantées (comme EditorManager.applyProjectToUI).
fn sync_color_mode(app: &AppWindow, mode: ColorMode) {
    app.set_mode_text(SharedString::from(i18n::tr(mode.status())));
    let ms = app.global::<MenuState>();
    if ms.get_color_mode() == mode.index() {
        return;
    }
    ms.set_color_mode(mode.index());
    if app.get_gray_palette() {
        snap_color(app,false);snap_color(app,true);return;
    }
    app.set_wheel_image(color_wheel(260, mode));
    app.set_color_grid_image(color_grid(260, mode));
    let pal: Vec<Color> = match mode {
        ColorMode::Rgb => Vec::new(),
        // nuancier RAL complet, dans l'ordre des codes
        ColorMode::Ral => ral_gen::RAL.iter().map(|c| Color::from_rgb_u8(c.1, c.2, c.3)).collect(),
        // nuancier ordinaire tel qu'imprimé
        _ => {
            let g = app.global::<Generated>().get_palette();
            (0..g.row_count())
                .filter_map(|i| g.row_data(i))
                .map(|c| {
                    let m = mode.convert([c.red(), c.green(), c.blue()]);
                    Color::from_rgb_u8(m[0], m[1], m[2])
                })
                .collect()
        }
    };
    app.set_mode_palette(ModelRc::new(VecModel::from(pal)));
    snap_color(app, false);
    if !snap_color(app, true) {
        sync_color_fields(app);
    }
}

/// Roue chromatique (teinte = angle, saturation = rayon), bord anticrénelé, filtrée par
/// l'espace de couleur du projet.
fn color_wheel(size: usize, mode: ColorMode) -> Image {
    let mut px = vec![0u8; size * size * 4];
    let r = size as f32 / 2.0;
    for y in 0..size {
        for x in 0..size {
            let (dx, dy) = (x as f32 + 0.5 - r, y as f32 + 0.5 - r);
            let d = (dx * dx + dy * dy).sqrt();
            let o = (y * size + x) * 4;
            let a = (r - d).clamp(0.0, 1.0);
            if a <= 0.0 {
                continue;
            }
            let hue = (-dy).atan2(dx).to_degrees().rem_euclid(360.0);
            px[o..o + 3].copy_from_slice(&mode.convert(hsv(hue, (d / r).min(1.0), 1.0)));
            px[o + 3] = (a * 255.0) as u8;
        }
    }
    to_image(&px, size, size)
}

/// Lit les réglages d'outils (ruban) et les couleurs.
fn opts(app: &AppWindow) -> tools::Opts {
    let t = app.global::<ToolOpts>();
    tools::Opts {
        size: t.get_brush_size(),
        hardness: t.get_hardness() / 100.0,
        opacity: 1.0,
        brush: match t.get_brush_shape() {
            1 => BrushShape::Soft,
            2 => BrushShape::Spray,
            3 => BrushShape::Square,
            _ => BrushShape::Round,
        },
        tolerance: t.get_tolerance(),
        contiguous: t.get_contiguous(),
        sel_mode: match t.get_sel_mode() {
            1 => SelMode::Add,
            2 => SelMode::Subtract,
            3 => SelMode::Intersect,
            4 => SelMode::Xor,
            _ => SelMode::Replace,
        },
        style: match t.get_shape_style() {
            1 => ShapeStyle::Fill,
            2 => ShapeStyle::Both,
            _ => ShapeStyle::Outline,
        },
        line_width: t.get_line_width(),
        gradient: match t.get_gradient_kind() {
            1 => GradientKind::Radial,
            2 => GradientKind::Diamond,
            3 => GradientKind::Conical,
            _ => GradientKind::Linear,
        },
        // polygone / étoile : le nombre de côtés ou de branches entre dans le nom (« ngon-7 »)
        shape_kind: match t.get_shape_kind().as_str() {
            "ngon" => format!("ngon-{}", t.get_shape_sides().round().clamp(3.0, 12.0)),
            "star" => format!("star-{}", t.get_star_points().round().clamp(3.0, 12.0)),
            k => k.to_string(),
        },
        corner: t.get_corner_radius(),
        cap_start: t.get_cap_start().clamp(0, 4) as u8,
        cap_end: t.get_cap_end().clamp(0, 4) as u8,
        dash: t.get_line_dash().clamp(0, 2) as u8,
        sym_x: t.get_sym_x(),
        sym_y: t.get_sym_y(),
        primary: rgba(app.get_primary_color()),
        secondary: rgba(app.get_secondary_color()),
        magnet: t.get_magnet_strength() / 100.0,
        magnet_freq: t.get_magnet_freq(),
        fill_gradient: t.get_shape_fill_type() == 1,
        grad_radial: t.get_shape_grad_type() == 1,
        grad_angle: t.get_shape_grad_angle(),
        grad_smart: t.get_shape_grad_smart(),
        retouch_mode: t.get_retouch_mode().clamp(0, 3) as u8,
        strength: t.get_retouch_strength() / 100.0,
        smoothing: t.get_smoothing() / 100.0,
        sample_all: t.get_sample_all(),
    }
}

/// Interpolation des transformations (Déplacer, Déformation, 4 coins) d'après le ruban.
fn sync_interp(app: &AppWindow) {
    transform::NEAREST.store(app.global::<ToolOpts>().get_nearest(), std::sync::atomic::Ordering::Relaxed);
}

// ------------------------------------------------------------------ affichage

/// Côté d'une tuile de mise à jour partielle (pixels de l'affichage).
const TILE: usize = 256;
// Covers image-edge AA even at the minimum 5% zoom and reduced UI scaling.
const TILE_GUTTER: usize = 32;

/// Pas de l'affichage à l'échelle de l'écran (1, 2, 4… : voir `Doc::composite_scaled`) : une
/// grande image vue de loin n'est composée et envoyée qu'aux pixels utiles. Les calculs (outils,
/// effets) restent faits sur l'image entière.
fn display_step(app: &AppWindow, doc: &Doc) -> usize {
    // résolution de rendu du projet : quel que soit le zoom, jamais plus de pixels que ça
    let div = doc.effective_div();
    if doc.w * doc.h <= 1_500_000 {
        return div;
    }
    let eff = app.get_zoom() * app.window().scale_factor();
    let mut ds = 1;
    while eff * (ds * 2) as f32 <= 1.0 && ds < 16 {
        ds *= 2;
    }
    ds.max(div)
}

/// Réduction des nouveaux projets (Paramètres › Performances).
fn render_default(ctl: bool, index: i32) -> usize {
    if ctl { 1 << index.clamp(0, 3) } else { 1 }
}

/// Boutons de résolution de rendu du ruban : visibles si l'option est active, ou si ce projet-ci
/// a une réduction en cours (proposition acceptée pour lui seul).
fn sync_render_ctl(app: &AppWindow, st: &State) {
    let t = app.global::<ToolOpts>();
    let set = st.doc.render_div_set();
    t.set_render_ctl(!st.empty && (app.get_set_render_ctl() || set > 1));
    t.set_render_div(set as i32);
    t.set_render_max(st.doc.render_choices().last().copied().unwrap_or(2) as i32);
    t.set_render_full(set > 1 && st.doc.effective_div() == 1);
}

/// Ruban : réduction suivante pour ce projet.
fn render_cycle(app: &AppWindow, st: &mut State) {
    let choices = st.doc.render_choices();
    if choices.len() < 2 {
        return status(app, "Image trop petite : la réduire n'apporterait rien");
    }
    let cur = st.doc.render_div_set();
    let next = choices.iter().copied().find(|c| *c > cur).unwrap_or(1);
    render_set(app, st, next);
}

/// Change la résolution de rendu de ce projet.
fn render_set(app: &AppWindow, st: &mut State, div: usize) {
    st.doc.render_div = div;
    st.doc.render_full_at = None;
    for l in st.doc.layers.iter_mut().filter(|l| l.dynamic.is_some()) {
        l.dyn_key = None;
    }
    refresh_all(app, st);
    if div > 1 {
        status(app, i18n::tr_format!("Toile rendue ÷{div} : l'enregistrement reste en pleine résolution"));
    } else {
        status(app, "Toile rendue en pleine résolution");
    }
}

/// Ruban : rendu complet tout de suite, valable jusqu'à la prochaine modification.
fn render_now(app: &AppWindow, st: &mut State) {
    st.doc.render_full_at = Some((st.doc.hindex, st.doc.history.len()));
    for l in st.doc.layers.iter_mut().filter(|l| l.dyn_low.is_some()) {
        l.dyn_key = None;
    }
    refresh_all(app, st);
    status(app, "Rendu en pleine résolution, jusqu'à la prochaine modification");
}

/// Dimensions de l'affichage au pas courant.
fn display_dims(st: &State) -> (usize, usize) {
    (st.doc.w.div_ceil(st.ds), st.doc.h.div_ceil(st.ds))
}

/// Rectangle du document → rectangle de l'affichage (arrondi vers l'extérieur).
fn to_display_rect(st: &State, (x0, y0, x1, y1): (usize, usize, usize, usize)) -> (usize, usize, usize, usize) {
    let ds = st.ds;
    (x0 / ds, y0 / ds, x1.div_ceil(ds), y1.div_ceil(ds))
}

/// Au-delà de ce nombre de pixels d'affichage, seule la partie visible de l'image est composée :
/// tuiles calculées à la demande, au fil des déplacements de la vue, sur un aperçu réduit de
/// toute l'image qui sert de fond le temps qu'elles arrivent. Les calculs (outils, effets)
/// restent faits sur l'image entière.
const LAZY_MIN: usize = 3_000_000;
/// Taille maximale (pixels) de l'aperçu de fond.
const BACKDROP_MAX: usize = 1_000_000;

/// Zoom changé : l'affichage n'est recomposé que si son pas change ; sinon, seules les tuiles
/// devenues visibles sont calculées.
fn zoom_changed(app: &AppWindow, st: &mut State) {
    if st.vv.on {
        return vecview::view_changed(app, st);
    }
    // dégradé en cours sur une grande image : aperçu à la nouvelle taille affichée
    if st.grad_live.is_some() {
        gradlive::render(app, st);
    }
    if display_step(app, &st.doc) != st.ds {
        redraw_canvas(app, st);
    } else {
        ensure_visible(app, st);
    }
    update_pixel_grid(app, st);
}

/// Tuiles (tx0, ty0, tx1, ty1 exclus) qui recouvrent la zone visible, avec une tuile de marge ;
/// toutes si la vue n'est pas encore connue.
fn visible_tiles(app: &AppWindow, st: &State) -> (usize, usize, usize, usize) {
    let (dw, dh) = display_dims(st);
    let (ntx, nty) = (dw.div_ceil(TILE), dh.div_ceil(TILE));
    let vr = app.get_visible_rect();
    let v: Vec<f32> = (0..4).filter_map(|i| vr.row_data(i)).collect();
    if v.len() < 4 || !v.iter().all(|x| x.is_finite()) || v[2] <= v[0] || v[3] <= v[1] {
        return (0, 0, ntx, nty);
    }
    let t = |p: f32, n: usize| ((p / st.ds as f32 / TILE as f32).floor().max(0.0) as usize).min(n);
    let (tx0, ty0) = (t(v[0], ntx).saturating_sub(1), t(v[1], nty).saturating_sub(1));
    let (tx1, ty1) = ((t(v[2], ntx) + 2).min(ntx), (t(v[3], nty) + 2).min(nty));
    (tx0, ty0, tx1.max(tx0), ty1.max(ty0))
}

/// Tuile (tx, ty) de l'affichage, placée en pixels du document (l'interface la met au zoom).
fn make_tile(st: &State, (tx, ty): (usize, usize)) -> Option<CanvasTile> {
    perf::note_upload();
    let (w, h) = display_dims(st);
    let (ds, dw, dh) = (st.ds, st.doc.w, st.doc.h);
    let (px0, py0) = (tx * TILE, ty * TILE);
    if px0 >= w || py0 >= h || st.display.len() != w * h * 4 {
        return None;
    }
    let (tw, th) = (TILE.min(w - px0), TILE.min(h - py0));
    // A repeated-pixel gutter keeps the GPU image's antialiased outer edge outside
    // the tile's clip rectangle. Adjacent translucent tiles never overlap.
    let stride = tw + 2 * TILE_GUTTER;
    let mut pb = SharedPixelBuffer::<Rgba8Pixel>::new(stride as u32, (th + 2 * TILE_GUTTER) as u32);
    let buf = pb.make_mut_bytes();
    for yy in 0..th + 2 * TILE_GUTTER {
        let s = ((py0 + yy.saturating_sub(TILE_GUTTER).min(th - 1)) * w + px0) * 4;
        let row = &mut buf[yy * stride * 4..(yy + 1) * stride * 4];
        row[TILE_GUTTER * 4..(tw + TILE_GUTTER) * 4].copy_from_slice(&st.display[s..s + tw * 4]);
        for pixel in row[..TILE_GUTTER * 4].chunks_exact_mut(4) {
            pixel.copy_from_slice(&st.display[s..s + 4]);
        }
        for pixel in row[(tw + TILE_GUTTER) * 4..].chunks_exact_mut(4) {
            pixel.copy_from_slice(&st.display[s + (tw - 1) * 4..s + tw * 4]);
        }
    }
    let (docx, docy) = (px0 * ds, py0 * ds);
    Some(CanvasTile { x: docx as i32, y: docy as i32, w: (tw * ds).min(dw - docx) as i32, h: (th * ds).min(dh - docy) as i32, img: Image::from_rgba8(pb) })
}

/// Retient si la tuile (tx, ty) a un pixel transparent.
fn note_tile_alpha(st: &mut State, (tx, ty): (usize, usize)) {
    let (w, h) = display_dims(st);
    let (px0, py0) = (tx * TILE, ty * TILE);
    if px0 >= w || py0 >= h || st.display.len() != w * h * 4 {
        return;
    }
    let (tw, th) = (TILE.min(w - px0), TILE.min(h - py0));
    let clear = (py0..py0 + th).any(|y| {
        let s = (y * w + px0) * 4;
        st.display[s..s + tw * 4].chunks_exact(4).any(|p| p[3] != 255)
    });
    if clear {
        st.tile_clear.insert((tx, ty));
    } else {
        st.tile_clear.remove(&(tx, ty));
    }
}

/// Image entièrement opaque : l'interface ne dessine ni le fond ni le damier, qu'elle cache.
/// Grande image (tuiles visibles seulement) et projet SVG : toujours dessinés.
fn sync_canvas_opaque(app: &AppWindow, st: &State) {
    app.set_canvas_opaque(!st.vv.on && !st.lazy && !direct_canvas(st) && st.tile_clear.is_empty());
}

/// Pose (ou remplace) une tuile dans l'interface.
fn put_tile(st: &mut State, k: (usize, usize)) {
    if st.vv.on || direct_canvas(st) {
        return;
    }
    let Some(tile) = make_tile(st, k) else { return };
    if !st.lazy {
        note_tile_alpha(st, k);
    }
    match st.tile_index.get(&k) {
        Some(&i) => st.tiles.set_row_data(i, tile),
        None => {
            st.tile_index.insert(k, st.tiles.row_count());
            st.tiles.push(tile);
        }
    }
}

/// Envoie l'image entière à l'interface et retire les tuiles ; grande image : l'aperçu de fond
/// et les tuiles visibles déjà composées.
fn upload_full(app: &AppWindow, st: &mut State) {
    st.tile_clear.clear();
    upload_full_tiles(app, st);
    sync_canvas_opaque(app, st);
}

fn upload_full_tiles(app: &AppWindow, st: &mut State) {
    // projet SVG : la toile est tracée à part (vecview), aucune image de pixels n'est affichée
    if st.vv.on {
        st.tile_index.clear();
        st.tiles.set_vec(Vec::new());
        app.set_canvas_image(Image::default());
        return;
    }
    if direct_canvas(st) {
        return;
    }
    if st.lazy {
        let (bw, bh) = (st.doc.w.div_ceil(st.bs.max(1)), st.doc.h.div_ceil(st.bs.max(1)));
        if st.backdrop.len() == bw * bh * 4 {
            app.set_canvas_image(to_image(&st.backdrop, bw, bh));
        }
        let mut keys: Vec<(usize, usize)> = st.tile_ok.iter().copied().collect();
        keys.sort_unstable_by_key(|k| (k.1, k.0));
        let made: Vec<((usize, usize), CanvasTile)> = keys.into_iter().filter_map(|k| Some((k, make_tile(st, k)?))).collect();
        st.tile_index = made.iter().enumerate().map(|(i, (k, _))| (*k, i)).collect();
        st.tiles.set_vec(made.into_iter().map(|(_, t)| t).collect::<Vec<_>>());
        return;
    }
    // Each document pixel is drawn once. A transparent patch must never be layered over
    // a previous transparent full-image copy (that would increase its opacity).
    let (dw, dh) = display_dims(st);
    let made: Vec<_> = (0..dh.div_ceil(TILE)).flat_map(|y| (0..dw.div_ceil(TILE)).map(move |x| (x, y)))
        .filter_map(|key| make_tile(st, key).map(|tile| (key, tile))).collect();
    for (key, _) in &made {
        note_tile_alpha(st, *key);
    }
    st.tile_index = made.iter().enumerate().map(|(i, (key, _))| (*key, i)).collect();
    st.tiles.set_vec(made.into_iter().map(|(_, tile)| tile).collect::<Vec<_>>());
    app.set_canvas_image(Image::default());
}

/// Envoie seulement les tuiles qui recouvrent `r` : un coup de pinceau ne renvoie plus toute
/// l'image vers la carte graphique. Chaque tuile remplace la précédente, sans superposer
/// deux copies de pixels semi-transparents.
fn upload_rect(app: &AppWindow, st: &mut State, r: (usize, usize, usize, usize)) {
    let (w, h) = display_dims(st);
    let (x0, y0, x1, y1) = (r.0.min(w), r.1.min(h), r.2.min(w), r.3.min(h));
    if x1 <= x0 || y1 <= y0 {
        return;
    }
    let (tx0, ty0, tx1, ty1) = (x0 / TILE, y0 / TILE, x1.div_ceil(TILE), y1.div_ceil(TILE));
    for ty in ty0..ty1 {
        for tx in tx0..tx1 {
            if st.lazy && !st.tile_ok.contains(&(tx, ty)) {
                continue;
            }
            put_tile(st, (tx, ty));
        }
    }
    sync_canvas_opaque(app, st);
}

fn prime_backdrop(st: &mut State, r: (usize, usize, usize, usize)) {
    let (w, _) = display_dims(st);
    let (bw, bh) = (st.doc.w.div_ceil(st.bs.max(1)), st.doc.h.div_ceil(st.bs.max(1)));
    if st.backdrop.len() != bw * bh * 4 { return; }
    for y in r.1..r.3 {
        for x in r.0..r.2 {
            let (sx, sy) = ((x * st.ds / st.bs.max(1)).min(bw - 1), (y * st.ds / st.bs.max(1)).min(bh - 1));
            let source = (sy * bw + sx) * 4;
            let dst = (y * w + x) * 4;
            st.display[dst..dst + 4].copy_from_slice(&st.backdrop[source..source + 4]);
        }
    }
}

/// Mode `lazy` : compose les tuiles visibles qui ne sont pas à jour (un seul calcul sur leur
/// cadre commun, réparti sur les cœurs), les envoie, et oublie celles parties loin de la vue.
fn ensure_visible(app: &AppWindow, st: &mut State) {
    let (dw, dh) = display_dims(st);
    if st.vv.on || direct_canvas(st) || !st.lazy || st.display.len() != dw * dh * 4 {
        return;
    }
    let (tx0, ty0, tx1, ty1) = visible_tiles(app, st);
    let missing: Vec<(usize, usize)> = (ty0..ty1).flat_map(|ty| (tx0..tx1).map(move |tx| (tx, ty))).filter(|k| !st.tile_ok.contains(k)).collect();
    if !missing.is_empty() {
        let bx0 = missing.iter().map(|k| k.0).min().unwrap_or(0) * TILE;
        let by0 = missing.iter().map(|k| k.1).min().unwrap_or(0) * TILE;
        let bx1 = ((missing.iter().map(|k| k.0).max().unwrap_or(0) + 1) * TILE).min(dw);
        let by1 = ((missing.iter().map(|k| k.1).max().unwrap_or(0) + 1) * TILE).min(dh);
        let r = (bx0, by0, bx1, by1);
        for &(tx, ty) in &missing {
            prime_backdrop(st, (tx * TILE, ty * TILE, ((tx + 1) * TILE).min(dw), ((ty + 1) * TILE).min(dh)));
        }
        // carte graphique si possible (navigateur : les tuiles arrivent un instant plus tard,
        // sur l'aperçu de fond)
        gpuview::view(app, st, gpuview::Target::Display, r);
        st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, r);
        for k in missing {
            st.tile_ok.insert(k);
            put_tile(st, k);
        }
    }
    // tuiles loin de la vue : retirées (mémoire, dessin), recomposées si elles reviennent
    let vis = (tx1 - tx0) * (ty1 - ty0);
    if st.tiles.row_count() > vis * 3 + 48 {
        let inside = |k: &(usize, usize)| k.0 >= tx0 && k.0 < tx1 && k.1 >= ty0 && k.1 < ty1;
        st.tile_ok.retain(|k| inside(k));
        let keep: Vec<((usize, usize), CanvasTile)> = st.tile_index.iter().filter(|(k, _)| inside(k)).filter_map(|(k, &i)| st.tiles.row_data(i).map(|t| (*k, t))).collect();
        st.tile_index.clear();
        let mut v = Vec::with_capacity(keep.len());
        for (k, t) in keep {
            st.tile_index.insert(k, v.len());
            v.push(t);
        }
        st.tiles.set_vec(v);
    }
}

/// Mode `lazy` : aperçu réduit de toute l'image (au plus `BACKDROP_MAX` pixels).
/// Carte graphique si possible ; aperçu de même taille : l'ancien reste affiché le temps que le
/// nouveau arrive (navigateur), sinon composition CPU immédiate.
fn compose_backdrop(app: &AppWindow, st: &mut State) {
    let (w, h) = (st.doc.w, st.doc.h);
    let mut bs = (st.ds * 2).max(2);
    while w.div_ceil(bs) * h.div_ceil(bs) > BACKDROP_MAX {
        bs *= 2;
    }
    let (bw, bh) = (w.div_ceil(bs), h.div_ceil(bs));
    let fresh = st.bs != bs || st.backdrop.len() != bw * bh * 4;
    st.bs = bs;
    if fresh {
        st.backdrop.clear();
        st.backdrop.resize(bw * bh * 4, 0);
    }
    if fresh || !gpuview::compose(app, st, gpuview::Target::Backdrop, (0, 0, bw, bh)) {
        gpuview::cpu(st, gpuview::Target::Backdrop, (0, 0, bw, bh));
    }
}

/// Mode `lazy` : aperçu de fond refait peu après la fin d'un geste (pas à chaque mouvement).
fn schedule_backdrop(app: &AppWindow) {
    thread_local! {
        static DEBOUNCE: slint::Timer = slint::Timer::default();
    }
    let weak = app.as_weak();
    DEBOUNCE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(350), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            if st.lazy && !st.vv.on && !direct_canvas(&st) {
                compose_backdrop(&app, &mut st);
                let (bw, bh) = (st.doc.w.div_ceil(st.bs), st.doc.h.div_ceil(st.bs));
                app.set_canvas_image(to_image(&st.backdrop, bw, bh));
            }
        })
    });
}

/// Onglet de masque α : recopie le masque dans le calque lié (document parent, autre onglet).
fn write_back_mask(st: &mut State) {
    let Some((du, lu)) = st.doc.mask_of else { return };
    // rien de changé dans le masque (sélection, zoom, panneaux…) : surtout ne pas tout recomposer
    let sig = {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        (st.doc.uid, st.doc.hindex, st.doc.history.len()).hash(&mut h);
        for l in &st.doc.layers {
            (l.px.weak().as_ptr() as usize, l.visible, l.opacity.to_bits()).hash(&mut h);
        }
        h.finish()
    };
    if st.mask_sig == sig {
        return;
    }
    st.mask_sig = sig;
    let vals = st.doc.mask_values();
    for d in st.tabs.iter_mut().flatten() {
        if d.uid == du {
            if let Some(l) = d.layers.iter_mut().find(|l| l.uid == lu) {
                if d.w == st.doc.w && d.h == st.doc.h {
                    l.mask = Some(vals);
                }
            }
            return;
        }
    }
}

/// Rendus des filtres dynamiques (ƒ) à refaire : carte graphique si elle est disponible,
/// sinon moteur CPU. Bureau : calcul immédiat ; navigateur (WebGPU) : résultat asynchrone,
/// l'affichage est recomposé à son arrivée.
fn update_dynamic(app: &AppWindow, st: &mut State) -> bool {
    if !st.doc.layers.iter().any(|l| l.dynamic.is_some() || l.dyn_cache.is_some()) {
        return false;
    }
    // fin de trait : les derniers points, encore en attente, sans recalculer toute l'image
    dyn_patch(app, st, None);
    if !st.session.busy() && !st.doc.needs_refine().is_empty() {
        arm_low_refine(app);
    }
    DYN_DEFER_SAID.with(|s| s.set(false));
    let mut started = false;
    let (w, h) = (st.doc.w, st.doc.h);
    // Synchronous results can unlock the next dependency immediately; asynchronous
    // ones keep their slot and trigger a fresh pass after completion.
    for _ in 0..st.doc.layers.len() {
    // calque en cours de réglage : un calcul pleine résolution déjà lancé ne bloque pas le
    // rendu réduit du dernier réglage (son résultat, périmé, sera ignoré)
    let excluded: std::collections::HashSet<u64> = st.dyn_inflight.iter().copied().filter(|u| st.dyn_draft != Some(*u)).chain(st.dyn_draft_flight.iter().copied()).collect();
    // geste en cours : pas du brouillon de chaque calque ƒ, entrée composée à ce pas
    let plans: std::collections::HashMap<u64, (usize, Vec<editor::Stage>)> = if gesture_active() {
        st.doc.layers.iter().filter(|l| l.dynamic.is_some()).filter_map(|l| gesture_plan(st, l.uid).map(|p| (l.uid, p))).collect()
    } else {
        Default::default()
    };
    let jobs = st.doc.dynamic_jobs_step(&excluded, &|uid| plans.get(&uid).map_or(1, |p| p.0));
    if jobs.is_empty() { break; }
    started = true;
    for j in jobs {
        if j.step > 1 {
            if let Some((_, stages)) = plans.get(&j.uid) {
                st.dyn_draft_flight.insert(j.uid);
                dyn_chain(app, st, j.uid, j.serial, j.src.clone(), std::sync::Arc::new(stages.clone()), 0, (w.div_ceil(j.step), h.div_ceil(j.step)));
                continue;
            }
        }
        if st.dyn_draft == Some(j.uid) {
            if let Some(plan) = draft_plan(st, j.uid) {
                dyn_low_job(app, st, &j, plan);
                continue;
            }
        }
        // résolution de rendu du projet : les filtres restent en brouillon, sans recalcul complet
        if let Some(plan) = render_plan(st, j.uid) {
            dyn_low_job(app, st, &j, plan);
            continue;
        }
        st.dyn_inflight.insert(j.uid);
        // pile avec un effet du menu : étage par étage, en arrière-plan
        let Some(codes) = j.codes() else {
            dyn_chain(app, st, j.uid, j.serial, j.src, std::sync::Arc::new(j.stack), 0, (w, h));
            continue;
        };
        #[cfg(not(target_arch = "wasm32"))]
        {
            let g = if GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) { gpu::get() } else { None };
            let img = g.as_ref().and_then(|g| g.run_stack(&j.src, w, h, &codes)).unwrap_or_else(|| editor::cpu_stack(&j.src, w, h, &codes));
            st.doc.set_dynamic(j.uid, j.serial, img);
            st.dyn_inflight.remove(&j.uid);
        }
        #[cfg(target_arch = "wasm32")]
        {
            let Some(g) = gpu::get().filter(|_| GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed)) else {
                let img = run_codes(&j.src, w, h, &codes);
                st.doc.set_dynamic(j.uid, j.serial, img);
            st.dyn_inflight.remove(&j.uid);
                continue;
            };
            let (g, weak) = (g.clone(), app.as_weak());
            wasm_bindgen_futures::spawn_local(async move {
                let img = match g.run_stack(&j.src, w, h, &codes).await {
                    Some(img) => img,
                    None => editor::cpu_stack(&j.src, w, h, &codes),
                };
                let Some(app) = weak.upgrade() else { return };
                let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
                let Ok(mut st) = state.try_borrow_mut() else { return };
                let st = &mut *st;
                st.doc.set_dynamic(j.uid, j.serial, img);
            st.dyn_inflight.remove(&j.uid);
                schedule_dynamic(&app, st);
                redraw_canvas(&app, st);
            });
        }
    }
    }
    if started {
        perf::render_started();
    }
    started
}

/// Calcul d'un filtre ƒ au pas réduit `k`.
fn dyn_low_job(app: &AppWindow, st: &mut State, j: &editor::DynJob, (k, stages): (usize, Vec<editor::Stage>)) {
    let (w, h) = (st.doc.w, st.doc.h);
    st.dyn_draft_flight.insert(j.uid);
    let small = std::sync::Arc::new(editor::shrink_rect(&j.src, w, h, k, (0, 0, w.div_ceil(k), h.div_ceil(k))));
    dyn_chain(app, st, j.uid, j.serial, small, std::sync::Arc::new(stages), 0, (w.div_ceil(k), h.div_ceil(k)));
}

/// Pas de calcul d'un filtre ƒ selon la résolution de rendu du projet (`None` : pleine résolution,
/// ou pile impossible à réduire sans changer son aspect).
fn render_plan(st: &State, uid: u64) -> Option<(usize, Vec<editor::Stage>)> {
    let div = st.doc.effective_div();
    if div < 2 || (st.doc.w == 1 && st.doc.h == 1) { return None; }
    let list = st.doc.layers.iter().find(|l| l.uid == uid)?.dynamic.as_ref()?;
    (2..=div).rev().find_map(|k| editor::draft_stages(list, k).map(|s| (k, s)))
}

/// Étages du moteur dynamique calculés tout de suite : carte graphique quand c'est possible sans
/// attendre (bureau : wgpu ; navigateur sans WebGPU : WebGL2), sinon processeur.
fn run_codes(src: &[u8], w: usize, h: usize, codes: &[(i32, f32)]) -> Vec<u8> {
    let allowed = GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed);
    #[cfg(not(target_arch = "wasm32"))]
    let out = if allowed { gpu::get().and_then(|g| g.run_stack(src, w, h, codes)) } else { None };
    #[cfg(target_arch = "wasm32")]
    let out = if allowed && gpu::get().is_none() { webgl::run_stack(src, w, h, codes) } else { None };
    out.unwrap_or_else(|| editor::cpu_stack(src, w, h, codes))
}

/// Pile dynamique contenant des effets du menu, à partir de l'étage `i` : les étages du moteur
/// dynamique sont faits sur place (rapides), chaque effet du menu en arrière-plan (fil ou worker),
/// mélangé à son entrée selon son intensité ; le rendu final est rangé s'il est toujours attendu
/// (un calcul plus récent l'a sinon remplacé).
/// `dims` : taille de travail (plus petite que le document pour un rendu réduit, agrandi à la fin).
#[allow(clippy::too_many_arguments)]
fn dyn_chain(app: &AppWindow, st: &mut State, uid: u64, serial: u64, src: std::sync::Arc<Vec<u8>>, stack: std::sync::Arc<Vec<editor::Stage>>, i: usize, dims: (usize, usize)) {
    let (w, h) = dims;
    let draft = dims != (st.doc.w, st.doc.h);
    let done = |st: &mut State| {
        if draft {
            st.dyn_draft_flight.remove(&uid);
        } else {
            st.dyn_inflight.remove(&uid);
        }
    };
    if !st.doc.layers.iter().any(|l| l.uid == uid && l.dyn_serial == serial && l.dynamic.is_some()) {
        done(st);
        schedule_dynamic(app, st);
        return;
    }
    let mut img = src;
    let mut i = i;
    let mut codes = Vec::new();
    while let Some(editor::Stage::Code(c, r)) = stack.get(i) {
        codes.push((*c, *r));
        i += 1;
    }
    if !codes.is_empty() {
        img = std::sync::Arc::new(run_codes(&img, w, h, &codes));
    }
    let Some(editor::Stage::Fx { name, p, mix, post }) = stack.get(i).cloned() else {
        // rendu réduit : agrandi à la taille du document (au plus proche, comme l'aperçu des effets)
        let (dw, dh) = (st.doc.w, st.doc.h);
        // affiché à sa taille ; seul un filtre sur le calque lui-même (anciens projets) l'agrandit
        let low = (2..=16).find(|k| draft && dw.div_ceil(*k) == w && dh.div_ceil(*k) == h).filter(|_| st.doc.layers.iter().any(|l| l.uid == uid && l.dynamic_mode != 1));
        if let Some(k) = low {
            st.doc.set_dynamic_low(uid, serial, k, img);
        } else {
            let px = if draft { upscale_nearest(&img, w, h, dw, dh) } else { std::sync::Arc::try_unwrap(img).unwrap_or_else(|a| (*a).clone()) };
            st.doc.set_dynamic(uid, serial, px);
        }
        done(st);
        schedule_dynamic(app, st);
        // brouillons d'un geste : plusieurs calques ƒ rendent presque en même temps, une seule
        // recomposition pour eux tous (avant : une recomposition complète par calque)
        if draft && gesture_active() {
            redraw_soon(app);
        } else {
            redraw_canvas(app, st);
        }
        return;
    };
    let job = background::Heavy::Effect { name, src: img.clone(), w, h, p, post };
    background::spawn(app, st, job, move |app, st, out| {
        let mut px = match out {
            Some(px) if px.len() == w * h * 4 && img.len() == px.len() => px,
            _ => img.to_vec(),
        };
        if mix < 1.0 {
            for (o, s) in px.iter_mut().zip(img.iter()) {
                *o = (*s as f32 + (*o as f32 - *s as f32) * mix).round() as u8;
            }
        }
        dyn_chain(app, st, uid, serial, std::sync::Arc::new(px), stack, i + 1, (w, h));
    });
}

/// Pile ou mode d'un calque ƒ changés : tout calcul encore en cours pour lui (lancé avec l'ancien
/// réglage) sera ignoré à son retour (nouveau numéro), et le nouveau calcul part sans l'attendre.
fn dyn_invalidate(st: &mut State, uid: u64) {
    if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == uid) {
        l.dyn_key = None;
        l.dyn_serial = editor::next_uid();
    }
    st.dyn_inflight.remove(&uid);
    st.dyn_draft_flight.remove(&uid);
}

thread_local! {
    /// geste en cours qui change l'entrée des filtres ƒ à chaque mouvement (déplacer un calque,
    /// régler une opacité) : instant (ms) jusqu'auquel les filtres sont calculés en brouillon
    static GESTURE_UNTIL: std::cell::Cell<f64> = const { std::cell::Cell::new(0.0) };
}

/// Geste en cours (voir `note_gesture`).
fn gesture_active() -> bool {
    GESTURE_UNTIL.with(|g| now_ms() < g.get())
}

/// Un mouvement du geste : les filtres ƒ au-dessus suivent en brouillon (rendu réduit), la
/// pleine résolution est calculée quand le geste s'arrête (`arm_low_refine`). Avant, le projet
/// d'exemple recalculait toutes ses piles en entier à chaque mouvement : 350 ms par image.
fn note_gesture(app: &AppWindow) {
    GESTURE_UNTIL.with(|g| g.set(now_ms() + 250.0));
    arm_low_refine(app);
}

/// Fin du geste (relâchement) : le prochain calcul repasse en pleine résolution.
fn end_gesture() {
    GESTURE_UNTIL.with(|g| g.set(0.0));
}

/// Pas du brouillon d'un filtre ƒ pendant un geste : le budget de pixels par mouvement est
/// partagé entre les calques ƒ du projet. None : image assez petite pour tout calculer.
fn gesture_plan(st: &State, uid: u64) -> Option<(usize, Vec<editor::Stage>)> {
    let (w, h) = (st.doc.w, st.doc.h);
    let layer = st.doc.layers.iter().find(|l| l.uid == uid)?;
    // filtre appliqué au calque lui-même (anciens projets) : son brouillon serait agrandi et
    // gardé comme rendu final
    if layer.dynamic_mode == 1 {
        return None;
    }
    let list = layer.dynamic.as_ref()?;
    let n = st.doc.layers.iter().filter(|l| l.dynamic.is_some() && l.visible).count().max(1);
    let budget = if cfg!(target_arch = "wasm32") { 360_000.0 } else { 1_600_000.0 } / n as f64;
    if ((w * h) as f64) <= budget {
        return None;
    }
    let want = (((w * h) as f64 / budget).sqrt().ceil() as usize).clamp(2, 16).max(st.ds);
    // aspect exact si un pas voisin le permet, sinon au plus près
    (want..=(want + 2).min(16)).find_map(|k| editor::draft_stages(list, k).map(|s| (k, s)))
        .or_else(|| Some((want, editor::draft_stages_loose(list, want))))
}

/// Au-delà de ce nombre de pixels, le réglage d'un calque dynamique passe par un rendu réduit.
const DRAFT_MIN: usize = 1_000_000;
/// Au-delà, un filtre ƒ au-dessus du tracé n'est recalculé que là où passe le pinceau
/// (`Doc::patch_dynamic`) : le recalculer en entier à chaque image figeait l'application.
const PATCH_MIN: usize = 500_000;

thread_local! {
    /// message « recalculé à la fin du trait » déjà affiché pour ce trait
    static DYN_DEFER_SAID: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

/// Filtres ƒ recalculés autour de la zone peinte ; renvoie le rectangle à recomposer.
fn dyn_patch(app: &AppWindow, st: &mut State, rect: Option<PaintRect>) -> Option<PaintRect> {
    if st.doc.w * st.doc.h < PATCH_MIN || st.dyn_draft.is_some() {
        return rect;
    }
    let budget = if cfg!(target_arch = "wasm32") { 1_200_000 } else { 6_000_000 };
    // nouveau trait pendant le recalcul complet d'un brouillon : ce recalcul (déjà périmé) est
    // abandonné, pour que le filtre suive le pinceau au lieu d'attendre la fin du trait
    if st.session.busy() {
        for l in st.doc.layers.iter_mut() {
            if l.dyn_low.is_some() && l.dyn_done != l.dyn_serial && st.dyn_inflight.contains(&l.uid) && st.dyn_draft != Some(l.uid) {
                l.dyn_serial = l.dyn_done;
            }
        }
    }
    let done = st.doc.patch_dynamic(budget, st.ds.max(1));
    if st.session.busy() && !DYN_DEFER_SAID.with(|s| s.get()) && st.doc.layers.iter().any(|l| l.dynamic.is_some() && l.dyn_dirty.is_some()) {
        DYN_DEFER_SAID.with(|s| s.set(true));
        status(app, "Filtre ƒ trop étendu pour suivre le pinceau : recalculé à la fin du trait");
    }
    match (done, rect) {
        (Some(o), Some(r)) => Some((o.0.min(r.0), o.1.min(r.1), o.2.max(r.2), o.3.max(r.3))),
        _ => rect,
    }
}

thread_local! {
    static DYN_REFINE: slint::Timer = slint::Timer::default();
}

/// Pas du rendu réduit d'un calque dynamique et sa pile ramenée à ce pas (réglages en pixels
/// divisés) : environ 700 000 pixels (300 000 dans le navigateur), au moins le pas de
/// l'affichage. None : image petite, ou pile impossible à réduire sans changer son aspect.
fn draft_plan(st: &State, uid: u64) -> Option<(usize, Vec<editor::Stage>)> {
    let (w, h) = (st.doc.w, st.doc.h);
    if w * h < DRAFT_MIN {
        return None;
    }
    let list = st.doc.layers.iter().find(|l| l.uid == uid)?.dynamic.as_ref()?;
    let budget = if cfg!(target_arch = "wasm32") { 300_000.0 } else { 700_000.0 };
    let want = (((w * h) as f64 / budget).sqrt().ceil() as usize).max(st.ds).min(16);
    (2..=want).rev().find_map(|k| editor::draft_stages(list, k).map(|s| (k, s)))
}

/// Réglage en cours sur le calque dynamique `uid` (fenêtre d'effet, curseurs de la liste) :
/// rendu réduit tout de suite, pleine résolution après une courte pause.
fn dyn_draft(app: &AppWindow, st: &mut State, uid: u64) {
    if st.doc.w * st.doc.h < DRAFT_MIN {
        return;
    }
    st.dyn_draft = Some(uid);
    arm_refine(app);
}

fn arm_refine(app: &AppWindow) {
    let weak = app.as_weak();
    DYN_REFINE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(320), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return arm_refine(&app) };
            dyn_refine(&app, &mut st);
        })
    });
}

thread_local! {
    static LOW_REFINE: slint::Timer = slint::Timer::default();
}

/// Brouillons ƒ plus réduits que la résolution de rendu (retouche pendant un trait vu de loin,
/// étape d'historique) : pleine résolution une fois le geste fini depuis un instant. Un nouveau
/// trait repousse le calcul.
fn arm_low_refine(app: &AppWindow) {
    let weak = app.as_weak();
    LOW_REFINE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(700), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return arm_low_refine(&app) };
            let st = &mut *st;
            if st.session.busy() || st.dyn_draft.is_some() || st.effect.is_some() || st.transform_drag.is_some() || gesture_active() {
                return arm_low_refine(&app);
            }
            // affichage grossier du geste : recomposé net
            let mut any = gpuview::take_coarse();
            for uid in st.doc.needs_refine() {
                if st.dyn_inflight.contains(&uid) {
                    continue;
                }
                if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == uid) {
                    l.dyn_key = None;
                    any = true;
                }
            }
            if any {
                update_dynamic(&app, st);
                redraw_canvas(&app, st);
            }
        })
    });
}

/// Fin du réglage : le calque est recalculé en pleine résolution.
fn dyn_refine(app: &AppWindow, st: &mut State) {
    // fenêtre d'effet ouverte sur ce calque : l'aperçu reste à la taille affichée ; la pleine
    // résolution n'est calculée qu'à la validation (dyn_preview_end). Avant, une pause de 0,3 s
    // lançait le calcul complet : sur une photo de 20 Mpx, plusieurs secondes d'interface figée
    // (passes WebGL et lecture synchrone de 80 Mo) et une toile vide pendant ce temps.
    if st.dyn_fx.is_some() && st.effect.is_some() {
        return;
    }
    let Some(uid) = st.dyn_draft.take() else { return };
    if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == uid) {
        l.dyn_key = None;
    }
    update_dynamic(app, st);
    redraw_canvas(app, st);
}

thread_local! {
    static REDRAW_SOON: slint::Timer = slint::Timer::default();
}

/// Recomposition de la toile regroupée (une par image affichée au plus).
fn redraw_soon(app: &AppWindow) {
    if REDRAW_SOON.with(|t| t.running()) {
        return;
    }
    let weak = app.as_weak();
    REDRAW_SOON.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(12), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return redraw_soon(&app) };
            redraw_canvas(&app, &mut st);
        })
    });
}

/// Recompose toute la toile (sans toucher aux panneaux).
fn redraw_canvas(app: &AppWindow, st: &mut State) {
    vecview::sync_mode(app, st);
    if st.vv.on {
        return vecview::touch(app, st);
    }
    compose_display(app, st);
    // geste sous filtres ƒ, navigateur : rien d'écrit, le résultat est posé et envoyé à son
    // arrivée (gpuview::arrive) ; renvoyer l'ancienne image ne servirait à rien
    if gpuview::take_deferred() {
        return;
    }
    upload_full(app, st);
    perf::render_finished(app, st, 0.0);
}

/// Contenu hors toile (option « Hors toile ») affiché autour de la toile.
fn sync_outside(app: &AppWindow, st: &State) {
    // option coupée : rien à composer (le calcul couvre toute la toile et ses marges) ; projet
    // SVG : le débord est tracé avec le reste
    let shown = app.global::<ToolOpts>().get_outside_canvas() && !st.vv.on;
    let visible = app.get_visible_rect();
    let values: Vec<f32> = (0..4).filter_map(|i| visible.row_data(i)).collect();
    let viewport = (values.len() == 4 && values.iter().all(|v| v.is_finite()))
        .then(|| (values[0].floor() as isize - 1, values[1].floor() as isize - 1,
            values[2].ceil() as isize + 1, values[3].ceil() as isize + 1));
    match shown.then(|| st.doc.outside_composite_in(viewport)).flatten() {
        Some((x, y, w, h, mut px)) => {
            // estompé (moitié de l'opacité) directement dans les pixels
            for a in px.iter_mut().skip(3).step_by(4) {
                *a /= 2;
            }
            app.set_outside_image(to_image(&px, w, h));
            app.set_outside_x(x as f32);
            app.set_outside_y(y as f32);
            app.set_outside_w(w as f32);
            app.set_outside_h(h as f32);
        }
        None => app.set_outside_w(0.0),
    }
}

/// Compose l'affichage au pas adapté au zoom : toute l'image, ou (grande image) l'aperçu de
/// fond et les seules tuiles visibles.
fn compose_display(app: &AppWindow, st: &mut State) {
    sync_outside(app, st);
    st.ds = display_step(app, &st.doc);
    let (dw, dh) = display_dims(st);
    st.lazy = dw * dh > LAZY_MIN;
    let fresh = st.display.len() != dw * dh * 4;
    if fresh {
        st.display = vec![0u8; dw * dh * 4];
    }
    st.tile_ok.clear();
    if !st.lazy {
        st.backdrop = Vec::new();
        st.bs = 0;
        // affichage neuf (vide) : composé tout de suite ; sinon carte graphique si possible
        // (navigateur : l'image précédente reste le temps du calcul)
        if fresh {
            gpuview::cpu(st, gpuview::Target::Display, (0, 0, dw, dh));
        } else {
            // geste sous filtres ƒ : composition grossière (voir gpuview::coarse)
            gpuview::view(app, st, gpuview::Target::Display, (0, 0, dw, dh));
        }
        // résultat attendu de la carte graphique : fourmis tracées à son arrivée
        if !gpuview::deferred() {
            st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, (0, 0, dw, dh));
        }
        return;
    }
    compose_backdrop(app, st);
    let (tx0, ty0, tx1, ty1) = visible_tiles(app, st);
    let r = (tx0 * TILE, ty0 * TILE, (tx1 * TILE).min(dw), (ty1 * TILE).min(dh));
    if r.2 > r.0 && r.3 > r.1 {
        prime_backdrop(st, r);
        gpuview::view(app, st, gpuview::Target::Display, r);
        st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, r);
        for ty in ty0..ty1 {
            for tx in tx0..tx1 {
                st.tile_ok.insert((tx, ty));
            }
        }
    }
}

/// Pendant un geste : rendu dynamique remis à jour au plus vite (une fois par image affichée),
/// pour que les filtres ƒ suivent le dessin en temps réel.
fn schedule_dynamic(app: &AppWindow, st: &State) {
    if st.dyn_timer.running() || !st.doc.layers.iter().any(|l| l.dynamic.is_some()) {
        return;
    }
    let weak = app.as_weak();
    st.dyn_timer.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(24), move || {
        let Some(app) = weak.upgrade() else { return };
        let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
        let Ok(mut st) = state.try_borrow_mut() else { return };
        let st = &mut *st;
        // grande image, trait en cours : `dyn_patch` a fait ce qu'il pouvait, le reste attend la fin
        // du trait (tout recalculer à chaque image : plus d'une seconde par mouvement)
        if st.session.busy() && st.doc.w * st.doc.h >= PATCH_MIN {
            return;
        }
        // rien à recalculer (on peint sur le calque de filtre lui-même : refresh_rect a déjà refait
        // la zone touchée) : surtout ne pas recomposer toute la vue à chaque mouvement
        if update_dynamic(&app, st) {
            if gesture_active() {
                redraw_soon(&app);
            } else {
                redraw_canvas(&app, st);
            }
        }
    });
}

/// Carte graphique prête (sans bloquer pour l'ouvrir).
fn gpu_ready() -> bool {
    #[cfg(not(target_arch = "wasm32"))]
    {
        GPU_READY.load(std::sync::atomic::Ordering::Relaxed)
    }
    #[cfg(target_arch = "wasm32")]
    {
        gpu::get().is_some()
    }
}

#[cfg(not(target_arch = "wasm32"))]
static GPU_READY: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

thread_local! {
    static SPARE: slint::Timer = slint::Timer::default();
}

/// Au repos (outil de pinceau) : copie privée du calque actif préparée pour le prochain trait
/// (`Doc::prepare_spare`).
fn schedule_spare(app: &AppWindow) {
    let weak = app.as_weak();
    SPARE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(350), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return schedule_spare(&app) };
            if st.session.busy() || st.transform_drag.is_some() || gesture_active() {
                return schedule_spare(&app);
            }
            if tools::is_stroke(st.tool) && st.doc.mask_of.is_none() {
                st.doc.prepare_spare();
            } else {
                st.doc.spare = None;
            }
        })
    });
}

/// Recompose tout l'affichage et met à jour les panneaux.
fn refresh_all(app: &AppWindow, st: &mut State) {
    schedule_spare(app);
    let render_t0 = now_ms();
    app.set_work_mode(SharedString::from(match (st.doc.vector_mode, st.doc.anim.is_some()) {
        (true, true) => i18n::tr(" · Animation SVG"),
        (true, false) => i18n::tr(" · SVG"),
        (false, true) => i18n::tr(" · Animation"),
        _ => String::new(),
    }));
    if editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed)!=st.doc.layer().uid {
        editor::DYN_ZONE_VIEW.store(0,std::sync::atomic::Ordering::Relaxed);
    }
    vecview::sync_mode(app, st);
    trim_history(st);
    if std::mem::take(&mut st.doc.vec_stale) {
        let uids: Vec<u64> = st.doc.layers.iter().filter(|l| l.vector.is_some()).map(|l| l.uid).collect();
        for uid in uids {
            render_vector_layer(app, st, uid);
        }
    }
    vecedit_sync_tool(app, st);
    if app.get_show_applied_fx() { sync_applied_fx(app,st); }
    PAINT_DIRTY.with(|dirty| *dirty.borrow_mut() = None);
    write_back_mask(st);
    // poignées : recalculées depuis la sélection courante (hors glisser en cours)
    if st.transform_drag.is_none() && !st.session.busy() {
        let keep = st.floating.as_ref().map_or(false, |f| f.kind != transform::Kind::MoveSelection);
        if !keep {
            st.floating = None;
            if transform_kind(st.tool).is_some() && st.doc.sel.is_some() {
                prepare_handles(app, st);
            } else {
                show_handles(app, st);
            }
        }
    }
    update_dynamic(app, st);
    compose_display(app, st);
    if !gpuview::take_deferred() {
        upload_full(app, st);
    }
    vecview::render_now(app, st);
    sync_panels(app, st);
    sync_anim(app, st);
    perf::render_finished(app, st, render_t0);
}

impl State {
    /// Les tracés d'édition ont changé (aucun effet hors d'un projet SVG).
    fn vv_overlay_changed(&mut self, app: &AppWindow) {
        vecview::touch_overlay(app, self);
    }
}

/// Limite de l'historique, tous projets ouverts confondus : les étapes les plus anciennes sont
/// oubliées d'abord, chaque projet gardant son image d'origine et ses dernières étapes.
fn trim_history(st: &mut State) {
    let max = editor::HISTORY_MAX.load(std::sync::atomic::Ordering::Relaxed);
    loop {
        let total: usize = st.doc.history_steps() + st.tabs.iter().flatten().map(|d| d.history_steps()).sum::<usize>();
        if total <= max {
            return;
        }
        let tabs = st.tabs.iter_mut().flatten();
        let Some(doc) = std::iter::once(&mut st.doc).chain(tabs).filter(|d| d.oldest_step().is_some()).min_by_key(|d| d.oldest_step()) else { return };
        doc.drop_oldest_step();
    }
}

/// Outil courant adapté au mode du projet affiché (changement d'onglet, de mode).
fn vecedit_sync_tool(app: &AppWindow, st: &mut State) {
    let cur = app.get_current_tool();
    let id = vecedit::tool_for_mode(st.doc.vector_mode, cur.as_str()).to_string();
    if id != cur.as_str() {
        set_tool(app, st, &id);
    }
}

/// Recompose seulement un rectangle (pendant un trait de pinceau).
fn refresh_rect(app: &AppWindow, st: &mut State, r: Option<(usize, usize, usize, usize)>) {
    if st.vv.on {
        return vecview::touch(app, st);
    }
    if direct_canvas(st) {
        return;
    }
    if app.global::<ToolOpts>().get_outside_canvas() { sync_outside(app, st); }
    let (w, h) = (st.doc.w, st.doc.h);
    let (dw, dh) = display_dims(st);
    if st.display.len() != dw * dh * 4 || st.ds != display_step(app, &st.doc) {
        return refresh_all(app, st);
    }
    let (x0, y0, x1, y1) = to_display_rect(st, r.unwrap_or((0, 0, w, h)));
    if st.lazy {
        // grande image : seule la partie visible est recomposée ; les tuiles touchées hors de
        // la vue le seront quand elles y reviendront
        ensure_visible(app, st);
        let (tx0, ty0, tx1, ty1) = visible_tiles(app, st);
        for ty in y0 / TILE..y1.div_ceil(TILE) {
            for tx in x0 / TILE..x1.div_ceil(TILE) {
                if tx < tx0 || tx >= tx1 || ty < ty0 || ty >= ty1 {
                    st.tile_ok.remove(&(tx, ty));
                }
            }
        }
        let (vx0, vy0, vx1, vy1) = (tx0 * TILE, ty0 * TILE, (tx1 * TILE).min(dw), (ty1 * TILE).min(dh));
        let c = (x0.max(vx0), y0.max(vy0), x1.min(vx1), y1.min(vy1));
        if c.2 > c.0 && c.3 > c.1 {
            gpuview::view(app, st, gpuview::Target::Display, c);
            let ants = (c.0.saturating_sub(1).max(vx0), c.1.saturating_sub(1).max(vy0), (c.2 + 1).min(vx1), (c.3 + 1).min(vy1));
            st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, ants);
            upload_rect(app, st, ants);
        }
        schedule_backdrop(app);
        schedule_dynamic(app, st);
        return;
    }
    gpuview::view(app, st, gpuview::Target::Display, (x0, y0, x1, y1));
    schedule_dynamic(app, st);
    // résultat attendu de la carte graphique : posé et envoyé à son arrivée
    if gpuview::take_deferred() {
        return;
    }
    // fourmis : un pixel de marge (le contour dépend des voisins)
    let ants = (x0.saturating_sub(1), y0.saturating_sub(1), (x1 + 1).min(dw), (y1 + 1).min(dh));
    st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, ants);
    upload_rect(app, st, (x0, y0, x1, y1));
}

/// Lignes de la grille de pixels d'une zone de `w` × `h` pixels (coordonnées de la zone).
fn pixel_grid_path(w: usize, h: usize) -> String {
    let mut s = String::with_capacity((w + h) * 16);
    for x in 1..w {
        s += &format!("M{x} 0V{h}");
    }
    for y in 1..h {
        s += &format!("M0 {y}H{w}");
    }
    s
}

/// Grille de pixels (zoom ≥ 400 %) recalculée pour la partie visible du document seulement :
/// quelques centaines de lignes au lieu d'une par pixel de l'image, à la taille de l'écran.
fn update_pixel_grid(app: &AppWindow, st: &State) {
    if app.get_zoom() < 4.0 {
        return;
    }
    let vr = app.get_visible_rect();
    let v: Vec<f32> = (0..4).filter_map(|i| vr.row_data(i)).collect();
    let (w, h) = (st.doc.w as i32, st.doc.h as i32);
    let (x0, y0, x1, y1) = if v.len() == 4 && v.iter().all(|x| x.is_finite()) && v[2] > v[0] && v[3] > v[1] {
        (((v[0].floor() as i32) - 2).clamp(0, w), ((v[1].floor() as i32) - 2).clamp(0, h), ((v[2].ceil() as i32) + 2).clamp(0, w), ((v[3].ceil() as i32) + 2).clamp(0, h))
    } else {
        (0, 0, w.min(512), h.min(512))
    };
    let (gw, gh) = (x1 - x0, y1 - y0);
    if (app.get_grid_x(), app.get_grid_y(), app.get_grid_w(), app.get_grid_h()) == (x0, y0, gw, gh) && !app.get_pixel_grid_path().is_empty() {
        return;
    }
    app.set_pixel_grid_path(SharedString::from(if gw > 0 && gh > 0 && gw + gh <= 4096 { pixel_grid_path(gw as usize, gh as usize) } else { String::new() }));
    app.set_grid_x(x0);
    app.set_grid_y(y0);
    app.set_grid_w(gw);
    app.set_grid_h(gh);
}

/// Aimantation (Paramètres aimantation) : côté d'une case en pixels document et zone
/// d'attraction (pixels document), comme `illuCalculateEdgeSnap` de la version web.
fn snap_params(app: &AppWindow, doc_w: usize) -> (f32, f32) {
    let div = app.get_set_snap_div().round().clamp(4.0, 128.0);
    let cell = (doc_w as f32 / div).round().max(5.0);
    (cell, cell / 2.0 * app.get_set_snap_thresh().round().clamp(1.0, 100.0) / 100.0)
}

/// Grille de prévisualisation de l'aimantation (coordonnées document).
fn refresh_snap_grid(app: &AppWindow, st: &State) {
    let (cell, _) = snap_params(app, st.doc.w);
    let (w, h) = (st.doc.w as f32, st.doc.h as f32);
    let mut s = String::new();
    if (w / cell) * (h / cell) < 40000.0 {
        let mut x = cell;
        while x < w {
            s += &format!("M{x} 0V{h}");
            x += cell;
        }
        let mut y = cell;
        while y < h {
            s += &format!("M0 {y}H{w}");
            y += cell;
        }
    }
    app.set_snap_grid_path(SharedString::from(s));
}

/// Aimante un point de la toile sur la grille (outils de sélection, formes, texte…).
fn snap_point(app: &AppWindow, st: &State, x: f32, y: f32) -> (f32, f32) {
    if !app.global::<ToolOpts>().get_snap() {
        return (x, y);
    }
    let (cell, th) = snap_params(app, st.doc.w);
    let (nx, ny) = ((x / cell).round() * cell, (y / cell).round() * cell);
    let (hx, hy) = ((x - nx).abs() <= th, (y - ny).abs() <= th);
    show_snap_guides(app, hx.then_some(nx), hy.then_some(ny));
    (if hx { nx } else { x }, if hy { ny } else { y })
}

/// Repères magenta d'accroche (-1 : masqué).
fn show_snap_guides(app: &AppWindow, x: Option<f32>, y: Option<f32>) {
    let on = app.get_set_snap_guides();
    app.set_snap_guide_x(if on { x.unwrap_or(-1.0) } else { -1.0 });
    app.set_snap_guide_y(if on { y.unwrap_or(-1.0) } else { -1.0 });
}

// Aperçu 1:1 hors de la toile : fenêtre séparée du navigateur (web) ou seconde fenêtre Slint
// (bureau), un pixel de l'image = un pixel de l'écran ; repli sur la fenêtre interne si le
// navigateur bloque la fenêtre.
#[cfg(not(target_arch = "wasm32"))]
thread_local! {
    static PREVIEW_WIN: RefCell<Option<PreviewWindow>> = const { RefCell::new(None) };
}

fn live_open(app: &AppWindow, st: &mut State) {
    let (w, h) = (st.doc.w, st.doc.h);
    #[cfg(target_arch = "wasm32")]
    {
        if web::preview_open(w, h) {
            app.set_show_live(false);
            web::preview_update(&st.doc.flatten(), w, h);
            st.live_sent = now_ms();
            return;
        }
        status(app, "Fenêtre d'aperçu bloquée par le navigateur : aperçu affiché dans l'application");
        app.set_live_image(to_image(&st.doc.flatten(), w, h));
        app.set_show_live(true);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let img = to_image(&st.doc.flatten(), w, h);
        let shown = PREVIEW_WIN.with(|p| {
            let mut p = p.borrow_mut();
            if p.is_none() {
                *p = PreviewWindow::new().ok();
            }
            let Some(win) = p.as_ref() else { return false };
            win.set_source(img.clone());
            win.set_info(i18n::tr_format!("{w} × {h} px — 1 pixel de l'image = 1 pixel de l'écran").into());
            win.show().is_ok()
        });
        if shown {
            app.set_show_live(false);
            st.live_sent = now_ms();
        } else {
            app.set_live_image(img);
            app.set_show_live(true);
        }
    }
}

/// Aperçu 1:1 ouvert hors de la toile.
fn live_external_open() -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        web::preview_is_open()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        PREVIEW_WIN.with(|p| p.borrow().as_ref().is_some_and(|w| w.window().is_visible()))
    }
}

/// Ferme l'aperçu hors de la toile (fermeture de l'application de bureau).
#[cfg_attr(target_arch = "wasm32", allow(dead_code))]
fn live_close() {
    #[cfg(not(target_arch = "wasm32"))]
    PREVIEW_WIN.with(|p| {
        if let Some(w) = p.borrow().as_ref() {
            let _ = w.hide();
        }
    });
}

/// Aperçu 1:1 remis à jour aux validations (rafraîchissement complet), pas pendant un geste ;
/// au plus quatre fois par seconde, la dernière mise à jour suivant après une pause.
fn live_refresh(app: &AppWindow, st: &mut State) {
    let external = live_external_open();
    if !external && !app.get_show_live() {
        return;
    }
    let now = now_ms();
    if now - st.live_sent < 250.0 {
        thread_local! {
            static TRAIL: slint::Timer = slint::Timer::default();
        }
        let weak = app.as_weak();
        TRAIL.with(|t| {
            t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(260), move || {
                let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
                if let Ok(mut st) = state.try_borrow_mut() {
                    live_refresh(&app, &mut st);
                };
            })
        });
        return;
    }
    st.live_sent = now;
    let (w, h) = (st.doc.w, st.doc.h);
    let flat = st.doc.flatten();
    // une seule conversion en image Slint, partagée par les deux aperçus
    let img = (app.get_show_live() || (external && cfg!(not(target_arch = "wasm32")))).then(|| to_image(&flat, w, h));
    if app.get_show_live() {
        app.set_live_image(img.clone().unwrap_or_default());
    }
    #[cfg(target_arch = "wasm32")]
    if external {
        web::preview_update(&flat, w, h);
    }
    #[cfg(not(target_arch = "wasm32"))]
    if external {
        let img = img.unwrap_or_default();
        PREVIEW_WIN.with(|p| {
            if let Some(win) = p.borrow().as_ref() {
                win.set_source(img);
                win.set_info(i18n::tr_format!("{w} × {h} px — 1 pixel de l'image = 1 pixel de l'écran").into());
            }
        });
    }
}

/// Plus grande valeur utile d'un réglage d'outil pour l'image active : son plus grand côté
/// (arrondi aux 50 px), au moins `floor`. Recalculée à chaque changement d'onglet ou de taille :
/// passer d'une image de 3000 px à une de 500 px ramène les curseurs à l'échelle de 500 px.
fn scaled_tool_limit(w:usize,h:usize,floor:f32)->f32 {
    let side=w.max(h) as f64;
    ((side/50.0).ceil()*50.0).clamp(floor as f64,32768.0) as f32
}

fn sync_panels(app: &AppWindow, st: &mut State) {
    sync_repeat_item(app, st);
    sync_render_ctl(app, st);
    let t=app.global::<ToolOpts>();
    // maximums à l'échelle de l'image active ; une valeur plus grande y est ramenée
    let side=scaled_tool_limit(st.doc.w,st.doc.h,100.0);
    let fit=|max:f32,v:f32,set:&dyn Fn(f32),setv:&dyn Fn(f32)| { set(max); if v>max { setv(max); } };
    fit(side,t.get_brush_size(),&|m|t.set_brush_size_max(m),&|v|t.set_brush_size(v));
    fit((side/4.0).max(20.0),t.get_line_width(),&|m|t.set_line_width_max(m),&|v|t.set_line_width(v));
    fit((side/2.0).max(20.0),t.get_corner_radius(),&|m|t.set_corner_radius_max(m),&|v|t.set_corner_radius(v));
    fit(side.max(72.0),t.get_font_size(),&|m|t.set_font_size_max(m),&|v|t.set_font_size(v));
    live_refresh(app, st);
    sync_sym(app, st);
    sync_layer_blocks(app, st);
    sync_tabs(app, st);
    svg_panel::sync(app, st);
    // vignettes : recalculées seulement pour les calques dont les pixels ont changé
    let old = std::mem::take(&mut st.thumbs);
    st.thumbs = st
        .doc
        .layers
        .iter()
        .map(|l| match old.iter().find(|(p, _)| l.px.is(p)) {
            Some((p, img)) => (p.clone(), img.clone()),
            None => (l.px.weak(), thumb(&l.px, st.doc.w, st.doc.h)),
        })
        .collect();
    let d = &st.doc;
    if app.get_doc_width() != d.w as i32 || app.get_doc_height() != d.h as i32 {
        // nouvelle taille : la grille de la zone visible est refaite
        app.set_grid_w(0);
    }
    update_pixel_grid(app, st);
    let d = &st.doc;
    let resized = app.get_doc_width() != d.w as i32 || app.get_doc_height() != d.h as i32;
    app.set_doc_width(d.w as i32);
    app.set_doc_height(d.h as i32);
    if resized || app.get_snap_grid_path().is_empty() {
        refresh_snap_grid(app, st);
    }
    app.set_doc_title(SharedString::from(d.title.as_str()));
    sync_color_mode(app, d.mode);
    let zone_gray=d.layer().dynamic.is_some() && editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed)==d.layer().uid;
    sync_mask_ui(app, d.mask_of.is_some(), d.mask_of.is_some() || zone_gray, d.mode);
    // lignes du haut vers le bas, contenu des dossiers en retrait (replié : caché)
    let rows: Vec<LayerRow> = d
        .panel_rows()
        .into_iter()
        .map(|(i, depth)| {
            let l = &d.layers[i];
            LayerRow {
                index: i as i32,
                name: SharedString::from(l.name.as_str()),
                visible: l.visible,
                thumb: if l.group { Image::default() } else { st.thumbs[i].1.clone() },
                has_mask: l.mask.is_some(),
                dyn_on: l.dynamic.is_some(),
                is_mask_doc: d.mask_of.is_some(),
                depth: depth as i32,
                is_group: l.group,
                collapsed: l.collapsed,
                locked: l.locked,
                is_text: l.vector.is_some(),
                vec_shapes: l.vector.as_ref().is_some_and(|v| v.objects.is_empty() || v.objects.iter().any(|o| matches!(o, vector::Obj::Shape(_)))),
                fx_count: l.vector.as_ref().map_or(0, |v| v.effects.len() as i32),
            }
        })
        .collect();
    sync_rows(app.get_layers(), rows, |m| app.set_layers(m));
    app.set_active_layer(d.active as i32);
    app.set_layer_opacity((d.layer().opacity * 100.0).round());
    app.set_layer_blend(d.layer().blend.index());
    // historique : liste refaite seulement quand ses étapes changent (pas à chaque rafraîchissement)
    let key = {
        use std::hash::{Hash, Hasher};
        let mut hs = std::collections::hash_map::DefaultHasher::new();
        d.uid.hash(&mut hs);
        for s in &d.history {
            s.label.hash(&mut hs);
            s.repeat.hash(&mut hs);
        }
        hs.finish()
    };
    if key != st.history_shown {
        st.history_shown = key;
        let items: Vec<HistoryItem> = d
            .history
            .iter()
            .enumerate()
            .map(|(i, s)| {
                // première étape : l'image telle qu'ouverte ou créée (comme « Image d'origine » de Paint.NET)
                let label = if i == 0 && s.label != "Historique vidé" { "Image d'origine" } else { s.label.as_str() };
                let text = if s.repeat > 1 { format!("{} ({})", i18n::tr(label), s.repeat) } else { i18n::tr(label) };
                HistoryItem { label: text.into(), fa: history_icon(i, &s.label).to_string().into() }
            })
            .collect();
        sync_rows(app.get_history(), items, |m| app.set_history(m));
    }
    app.set_history_index(d.hindex as i32);
    let b = d.selection_bounds();
    st.sel_bounds = b;
    app.set_has_selection(b.is_some());
    app.set_selection_text(SharedString::from(match b {
        Some((x0, y0, x1, y1)) => i18n::tr_format!("Sélection : {} × {} px", x1 - x0, y1 - y0),
        None => String::new(),
    }));
}

/// Message de la barre d'état : affiché quelques secondes, puis effacé.
fn status(app: &AppWindow, msg: impl Into<String>) {
    thread_local! {
        static CLEAR: slint::Timer = slint::Timer::default();
    }
    let msg = i18n::tr(&msg.into());
    let keep = !msg.is_empty();
    app.set_status_text(SharedString::from(msg));
    if keep {
        let weak = app.as_weak();
        CLEAR.with(|t| {
            t.start(slint::TimerMode::SingleShot, std::time::Duration::from_secs(6), move || {
                if let Some(app) = weak.upgrade() {
                    app.set_status_text(SharedString::default());
                }
            })
        });
    }
}

// ------------------------------------------------------------------ calques : masque α, filtre dynamique ƒ

/// Bouton α d'un calque : crée le masque (blanc = visible) et l'ouvre dans son onglet, ou le supprime.
fn layer_alpha(app: &AppWindow, st: &mut State, i: usize, remove: bool) {
    if i >= st.doc.layers.len() || st.doc.mask_of.is_some() {
        return;
    }
    finish_edits(app, st);
    let (du, lu, w, h) = (st.doc.uid, st.doc.layers[i].uid, st.doc.w, st.doc.h);
    let tab = st.tabs.iter().position(|t| t.as_ref().map_or(false, |d| d.mask_of == Some((du, lu))));
    if remove {
        if st.doc.layers[i].mask.take().is_some() {
            st.doc.commit("Masque α supprimé");
        }
        if let Some(t) = tab {
            close_tab(app, st, t);
        } else {
            refresh_all(app, st);
        }
        return;
    }
    if st.doc.layers[i].dynamic.is_some() {
        status(app, "Filtre dynamique actif : désactivez-le pour utiliser un masque α");
        return;
    }
    if st.doc.layers[i].mask.is_none() {
        st.doc.layers[i].mask = Some(vec![255u8; w * h].into());
        st.doc.commit("Masque α");
    }
    if let Some(t) = tab {
        switch_tab(app, st, t);
        return;
    }
    // onglet du masque : image grise du masque actuel, éditable avec tous les outils
    let l = &st.doc.layers[i];
    let gray: Vec<u8> = l.mask.as_ref().map(|m| m.iter().flat_map(|v| [*v, *v, *v, 255]).collect()).unwrap_or_else(|| vec![255; w * h * 4]);
    let mut md = Doc::from_pixels(w, h, gray, &format!("α {}", l.name));
    md.layers[0].name = i18n::tr("Masque");
    md.mask_of = Some((du, lu));
    md.history[0].label = "Masque α".into();
    let at = st.cur + 1;
    open_document_at(app, st, md, at);
    status(app, "Masque α : blanc = visible, noir = masqué");
}

thread_local! { static NEW_IMAGE_REQUEST: std::cell::Cell<u64> = const { std::cell::Cell::new(0) }; }

fn show_new_project(app: &AppWindow, st: &State) {
    #[cfg(not(target_arch = "wasm32"))]
    let size = clipboard_size::proposed(clipboard_size::read(), st.clipboard.as_ref().map(|c| (c.w, c.h)), (st.doc.w, st.doc.h));
    #[cfg(target_arch = "wasm32")]
    let size = st.clipboard.as_ref().map(|c| (c.w, c.h)).unwrap_or((st.doc.w, st.doc.h));
    app.set_dlg_w(size.0.to_string().into());
    app.set_dlg_h(size.1.to_string().into());
    app.set_dlg_mode(st.doc.mode.index().min(2));
    app.set_show_new(true);
    let request = NEW_IMAGE_REQUEST.with(|n| { let value = n.get().wrapping_add(1); n.set(value); value });
    #[cfg(not(target_arch = "wasm32"))]
    let _ = request;
    #[cfg(target_arch = "wasm32")]
    {
        let weak = app.as_weak();
        let _ = slint::spawn_local(async move {
            if let Some((w, h)) = web::clipboard_dimensions().await {
                if let Some(app) = weak.upgrade() {
                    // An asynchronous browser permission prompt must not overwrite manual edits.
                    if NEW_IMAGE_REQUEST.with(|n| n.get()) == request && app.get_show_new()
                        && app.get_dlg_w().as_str() == size.0.to_string() && app.get_dlg_h().as_str() == size.1.to_string() {
                        app.set_dlg_w(w.to_string().into());
                        app.set_dlg_h(h.to_string().into());
                    }
                }
            }
        });
    }
}

// ------------------------------------------------------------------ fichiers

/// Termine les éditions en cours avant de changer d'image.
fn finish_edits(app: &AppWindow, st: &mut State) {
    shape_edit::commit(app, st);
    vecedit::commit(app, st);
    gradlive::commit(app, st);
    if st.crop.is_some() {
        crop_action(app, st, "cancel");
    }
    st.session.cancel(&mut st.doc);
    drop_floating(app, st);
    commit_text(app, st);
    if st.effect.is_some() {
        cancel_effect(app, st);
    }
    if st.curves.is_some() {
        curves_action(app, st, "cancel", 0);
    }
}

/// Ouvre une image dans un nouvel onglet (multi-projet).
fn set_document(app: &AppWindow, st: &mut State, doc: Doc) {
    let at = st.tabs.len();
    open_document_at(app, st, doc, at);
}

/// Ouvre un document dans un nouvel onglet placé en `at` (masque α : juste après son projet).
fn open_document_at(app: &AppWindow, st: &mut State, doc: Doc, at: usize) {
    finish_edits(app, st);
    st.session = Session::default();
    // aucun projet ouvert : le document vide est simplement remplacé
    if st.empty {
        st.doc = doc;
        set_empty(app, st, false);
        refresh_all(app, st);
        app.invoke_zoom_open();
        return;
    }
    let old = std::mem::replace(&mut st.doc, doc);
    st.tabs[st.cur] = Some(old);
    let at = at.min(st.tabs.len());
    st.tabs.insert(at, None);
    st.cur = at;
    refresh_all(app, st);
    app.invoke_zoom_open();
}

fn switch_tab(app: &AppWindow, st: &mut State, i: usize) {
    if i == st.cur || i >= st.tabs.len() {
        return;
    }
    finish_edits(app, st);
    let Some(doc) = st.tabs[i].take() else { return };
    let old = std::mem::replace(&mut st.doc, doc);
    st.tabs[st.cur] = Some(old);
    st.cur = i;
    st.session = Session::default();
    refresh_all(app, st);
    app.invoke_zoom_fit();
}

/// Passe dans l'état « aucun projet ouvert » (ou en sort) : toile masquée, palettes grisées.
fn set_empty(app: &AppWindow, st: &mut State, empty: bool) {
    st.empty = empty;
    app.set_no_doc(empty);
    if empty {
        stop_anim(app);
        app.set_show_applied_fx(false);
        app.set_overlay_path(SharedString::default());
    }
}

/// Ferme un onglet ; la dernière image fermée laisse l'application sans projet.
/// Fermeture demandée par l'utilisateur : confirmation si l'onglet a des modifications non
/// exportées (elles restent dans la sauvegarde automatique tant que l'onglet est ouvert).
fn request_close_tab(app: &AppWindow, st: &mut State, i: usize) {
    let doc = if i == st.cur { Some(&st.doc) } else { st.tabs.get(i).and_then(|t| t.as_ref()) };
    let Some(doc) = doc else { return };
    if doc.modified() && doc.mask_of.is_none() {
        let thumb = TaskThumb { name: doc.title.as_str().into(), image: px_thumb(&doc.flatten(), doc.w, doc.h, 180, 135) };
        let intro = i18n::tr_format!("« {} » contient des modifications non enregistrées. Que voulez-vous faire ?", doc.title);
        st.task = Some(Task::CloseTab(i));
        show_task(
            app,
            "Modifications non enregistrées",
            &intro,
            "",
            "",
            &[
                ("Enregistrer", "Enregistre l'image, puis la ferme."),
                ("Ne pas enregistrer", "Abandonne les modifications non enregistrées."),
                ("Annuler", "Revient à MasterPaint."),
            ],
            vec![thumb],
        );
    } else {
        close_tab(app, st, i);
    }
}

fn close_tab(app: &AppWindow, st: &mut State, i: usize) {
    if i >= st.tabs.len() {
        return;
    }
    finish_edits(app, st);
    // les onglets de masque α du projet fermé partent avec lui
    let doc_at = |st: &State, j: usize| if j == st.cur { Some(st.doc.uid) } else { st.tabs[j].as_ref().map(|d| d.uid) };
    let mask_of = |st: &State, j: usize| if j == st.cur { st.doc.mask_of } else { st.tabs[j].as_ref().and_then(|d| d.mask_of) };
    let uid = doc_at(st, i);
    let list: Vec<usize> = (0..st.tabs.len()).filter(|&j| j == i || mask_of(st, j).is_some_and(|m| Some(m.0) == uid)).collect();
    // du dernier au premier : les rangs restant à fermer ne bougent pas
    for &j in list.iter().rev() {
        drop_tab(app, st, j);
    }
    st.session = Session::default();
    forget_closed(st);
    refresh_all(app, st);
    app.invoke_zoom_fit();
}

/// Retire l'onglet `i` ; le dernier laisse l'application sans projet.
fn drop_tab(app: &AppWindow, st: &mut State, i: usize) {
    if i != st.cur {
        st.tabs.remove(i);
        if i < st.cur {
            st.cur -= 1;
        }
    } else if st.tabs.len() == 1 {
        // dernier projet fermé : l'application reste sans projet (fond de l'espace de travail)
        st.doc = Doc::new(1, 1, [0, 0, 0, 0], &i18n::tr("Aucun projet"));
        set_empty(app, st, true);
    } else {
        st.tabs.remove(i);
        let ni = i.min(st.tabs.len() - 1);
        st.doc = st.tabs[ni].take().unwrap_or_else(|| Doc::new(1280, 720, [255, 255, 255, 255], &i18n::tr("Sans titre 1")));
        st.cur = ni;
    }
}

// ------------------------------------------------------------------ journal et erreurs

/// Journal des derniers évènements (presse-papiers, fichiers, erreurs) : joint aux rapports
/// d'erreur ; aussi écrit dans la console (navigateur) ou sur la sortie d'erreur (bureau).
pub(crate) mod applog {
    use std::cell::RefCell;
    use std::collections::VecDeque;
    thread_local! {
        static LINES: RefCell<VecDeque<String>> = const { RefCell::new(VecDeque::new()) };
    }

    pub fn log(msg: impl AsRef<str>) {
        let msg = msg.as_ref();
        #[cfg(target_arch = "wasm32")]
        web_sys::console::log_1(&format!("[MasterPaint] {msg}").into());
        #[cfg(not(target_arch = "wasm32"))]
        eprintln!("[MasterPaint] {msg}");
        LINES.with(|l| {
            let mut l = l.borrow_mut();
            if l.len() >= 200 {
                l.pop_front();
            }
            l.push_back(msg.to_string());
        });
    }

    /// Les `n` dernières lignes.
    pub fn tail(n: usize) -> String {
        LINES.with(|l| {
            let l = l.borrow();
            l.iter().skip(l.len().saturating_sub(n)).cloned().collect::<Vec<_>>().join("\n")
        })
    }
}

/// Appareil et version (rapports d'erreur).
fn platform_info() -> String {
    #[cfg(target_arch = "wasm32")]
    {
        let ua = web_sys::window().and_then(|w| w.navigator().user_agent().ok()).unwrap_or_default();
        i18n::tr_format!("MasterPaint Rust {APP_VERSION} — web — {ua}")
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        i18n::tr_format!("MasterPaint Rust {APP_VERSION} — application {} {}", std::env::consts::OS, std::env::consts::ARCH)
    }
}

/// Paramètres › Infos techniques : version, appareil, rendu, accélération, calculs en
/// arrière-plan, mémoire des images et de l'historique.
fn refresh_tech_info(app: &AppWindow, st: &State) {
    app.set_tech_info(tech_info(app, st).into());
    let docs: Vec<&Doc> = std::iter::once(&st.doc).chain(st.tabs.iter().flatten()).collect();
    let pixel_bytes: usize = docs.iter().flat_map(|d| d.layers.iter()).map(|l| l.px.len()).sum();
    let history_bytes: usize = docs.iter().flat_map(|d| d.history_layers()).map(|p| p.len()).sum();
    let mut rows = vec![
        crate::DiagnosticRow { label: "MasterPaint".into(), value: format!("Rust {}", APP_VERSION).into() },
        crate::DiagnosticRow { label: "Plateforme".into(), value: platform_info().into() },
        crate::DiagnosticRow { label: "Fenêtre".into(), value: format!("{} × {} px · échelle {:.2}", app.window().size().width, app.window().size().height, app.window().scale_factor()).into() },
        crate::DiagnosticRow { label: "Rendu graphique".into(), value: app.get_gpu_text().into() },
        crate::DiagnosticRow { label: "Projets ouverts".into(), value: format!("{} onglet(s) · image active {} × {} px · {} calque(s)", docs.len(), st.doc.w, st.doc.h, st.doc.layers.len()).into() },
        crate::DiagnosticRow { label: "Mémoire des pixels".into(), value: format!("{:.1} Mo de calques · {:.1} Mo d’historique", pixel_bytes as f64 / 1_048_576.0, history_bytes as f64 / 1_048_576.0).into() },
        crate::DiagnosticRow { label: "Historique".into(), value: format!("{} étapes conservées par projet · limite globale {}", app.get_set_history_keep().round(), app.get_set_history_max().round()).into() },
        crate::DiagnosticRow { label: "Sauvegarde automatique".into(), value: if app.get_set_autosave() { format!("Activée · {} min (0 = en continu)", app.get_set_autosave_min().round()) } else { "Désactivée".into() }.into() },
        crate::DiagnosticRow { label: "Pack d’icônes".into(), value: format!("{} · {} pack(s) importé(s)", match app.get_set_icon_pack() { 0 => "MasterPaint", 1 => "PaintJS", 2 => "PhotoCraft", _ => "Importé" }, icon_packs::all_custom().as_array().map_or(0, |a| a.len())).into() },
    ];
    #[cfg(not(target_arch = "wasm32"))]
    rows.push(crate::DiagnosticRow { label: "Cœurs du processeur".into(), value: std::thread::available_parallelism().map(|n| n.get().to_string()).unwrap_or_else(|_| "inconnu".into()).into() });
    #[cfg(target_arch = "wasm32")]
    rows.push(crate::DiagnosticRow { label: "Cœurs du processeur".into(), value: web_sys::window().map(|w| w.navigator().hardware_concurrency().to_string()).unwrap_or_else(|| "inconnu".into()).into() });
    app.set_diagnostic_rows(ModelRc::new(VecModel::from(rows)));
}

fn tech_info(app: &AppWindow, st: &State) -> String {
    let docs: Vec<&Doc> = std::iter::once(&st.doc).chain(st.tabs.iter().flatten()).collect();
    let mb = |b: usize| b as f64 / 1_048_576.0;
    let mut pixels = 0usize;
    let mut history = 0usize;
    let mut seen = std::collections::HashSet::new();
    for d in &docs {
        for l in &d.layers {
            if seen.insert(std::sync::Arc::as_ptr(&l.px.arc())) {
                pixels += l.px.len();
            }
        }
        // étapes : seuls les tampons propres à l'historique comptent (les autres sont partagés)
        for s in d.history_layers() {
            if seen.insert(std::sync::Arc::as_ptr(&s.arc())) {
                history += s.len();
            }
        }
    }
    #[cfg(not(target_arch = "wasm32"))]
    let (cores, background) = (std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1), "fils séparés (tous les cœurs)".to_string());
    #[cfg(target_arch = "wasm32")]
    let (cores, background) = (
        web_sys::window().map(|w| w.navigator().hardware_concurrency() as usize).unwrap_or(1),
        if js_sys::Reflect::get(&web_sys::window().map(wasm_bindgen::JsValue::from).unwrap_or_default(), &"mpWasmModule".into()).is_ok_and(|v| v.is_object()) {
            "workers du navigateur (même module wasm)".to_string()
        } else {
            "sur place (workers indisponibles)".to_string()
        },
    );
    i18n::tr_format!("{}\nRendu de l'interface : Slint (Rust) — fenêtre {} × {} px, échelle {:.2}\nAccélération : {}\nProcesseur : {cores} cœurs ; calculs lourds : {background}\nImages ouvertes : {} onglet(s), {:.0} Mo de pixels ; historique : {:.0} Mo (au plus {} étapes)\nImage active : {} × {} px, {} calque(s), zoom {:.0} %, affichage {}",
        platform_info(),
        app.window().size().width,
        app.window().size().height,
        app.window().scale_factor(),
        app.get_gpu_text(),
        docs.len(),
        mb(pixels),
        mb(history),
        app.get_set_history_max().round(),
        st.doc.w,
        st.doc.h,
        st.doc.layers.len(),
        app.get_zoom() * 100.0,
        if st.lazy { i18n::tr_format!("par tuiles visibles (pas {})", st.ds) } else if st.ds > 1 { i18n::tr_format!("réduit (pas {})", st.ds) } else { "pleine résolution".to_string() },
    )
}

/// Fenêtre d'erreur : message, détails (appareil, contexte, journal) et « Signaler l'erreur »
/// qui ouvre le formulaire de rapport déjà rempli.
fn show_error(app: &AppWindow, context: &str, message: &str) {
    applog::log(i18n::tr_format!("ERREUR [{context}] {message}"));
    let (context, message) = (&i18n::tr(context), &i18n::tr(message));
    let doc = app.get_doc_title();
    let details = i18n::tr_format!("{}\nContexte : {context}\nImage : {doc} ({} × {} px), zoom {:.0} %, outil {}\nErreur : {message}\n\nJournal :\n{}",
        platform_info(),
        app.get_doc_width(),
        app.get_doc_height(),
        app.get_zoom() * 100.0,
        app.get_current_tool(),
        applog::tail(30)
    );
    app.set_error_context(context.into());
    app.set_error_message(message.into());
    app.set_error_details(details.into());
    app.set_show_error(true);
}

// ------------------------------------------------------------------ fenêtres de choix

/// Fenêtre de choix ouverte (boutons de commande façon Paint.NET, textes de paint.js).
enum Task {
    /// ralentissements observés : proposer d'envoyer un rapport
    PerfReport,
    /// rendu trop lent sur ce projet : proposer la réduction (projet, réduction)
    RenderOffer(u64, usize),
    /// onglet modifié à fermer : Enregistrer / Ne pas enregistrer / Annuler
    CloseTab(usize),
    /// fermeture de l'application : onglets modifiés (vignettes cliquables)
    Exit(Vec<usize>),
    /// images déposées : Ouvrir / Ajouter comme calques
    Drop(Vec<(String, usize, usize, Vec<u8>)>),
    /// images plus grandes que la toile à coller : Agrandir / Conserver / Annuler
    Paste(Vec<(Clip, &'static str, Option<String>)>),
    /// désactiver « Hors toile » avec du contenu au dehors
    DropOutside,
    /// image venue de l'extérieur : Nouvel onglet / Image actuelle / Annuler
    PasteWhere(Vec<(Clip, &'static str, Option<String>)>),
    /// peindre sur un calque texte : Pixelliser / Annuler
    Rasterize(u64),
    /// fichier SVG ouvert : nom, contenu, feuille de symboles (grille proposée)
    SvgOpen(String, Vec<u8>, bool),
    /// pack d'icônes incomplet choisi : remplacer les manquantes par MasterPaint ou un équivalent
    IconFallback,
}

/// Pack d'icônes incomplet : demander par quoi remplacer les icônes qui lui manquent.
fn ask_icon_fallback(app: &AppWindow) {
    let missing = icon_packs::missing_count();
    let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
    let Ok(mut st) = state.try_borrow_mut() else { return };
    if missing == 0 || st.task.is_some() {
        return;
    }
    st.task = Some(Task::IconFallback);
    drop(st);
    let intro = i18n::tr_format!("Ce pack n'a pas d'équivalent pour {missing} icônes de MasterPaint. Par quoi les remplacer ?");
    show_task(
        app,
        "Icônes manquantes",
        &intro,
        "Modifiable ensuite dans Paramètres › Icônes.",
        "",
        &[
            ("Icônes MasterPaint", "Le dessin d'origine de MasterPaint, toujours disponible."),
            ("Équivalents Font Awesome", "Icônes simples d'une seule couleur, plus proches de certains packs. MasterPaint quand il n'y en a pas."),
        ],
        Vec::new(),
    );
}

fn show_task(app: &AppWindow, title: &str, intro: &str, info: &str, header: &str, commands: &[(&str, &str)], thumbs: Vec<TaskThumb>) {
    let t = i18n::tr;
    app.set_task_title(t(title).into());
    app.set_task_intro(t(intro).into());
    app.set_task_info(t(info).into());
    app.set_task_list_header(t(header).into());
    let cmds: Vec<TaskCommand> = commands.iter().map(|(a, x)| TaskCommand { title: t(a).into(), text: t(x).into(), glyph: "".into() }).collect();
    app.set_task_commands(ModelRc::new(VecModel::from(cmds)));
    app.set_task_thumbs(ModelRc::new(VecModel::from(thumbs)));
    app.set_show_task(true);
}

/// Vignette d'une image RGBA (sur damier), au plus `tw` × `th`.
fn px_thumb(px: &[u8], w: usize, h: usize, tw: usize, th: usize) -> Image {
    if w == 0 || h == 0 || px.len() < w * h * 4 {
        return Image::default();
    }
    let s = (w as f32 / tw as f32).max(h as f32 / th as f32).max(1.0);
    let (dw, dh) = (((w as f32 / s) as usize).max(1), ((h as f32 / s) as usize).max(1));
    let mut out = vec![0u8; dw * dh * 4];
    for y in 0..dh {
        for x in 0..dw {
            let sx = (((x as f32 + 0.5) * s) as usize).min(w - 1);
            let sy = (((y as f32 + 0.5) * s) as usize).min(h - 1);
            let i = (sy * w + sx) * 4;
            let a = px[i + 3] as f32 / 255.0;
            let chk = if ((x / 5) + (y / 5)) % 2 == 0 { 255.0 } else { 204.0 };
            let o = (y * dw + x) * 4;
            for c in 0..3 {
                out[o + c] = (px[i + c] as f32 * a + chk * (1.0 - a)) as u8;
            }
            out[o + 3] = 255;
        }
    }
    to_image(&out, dw, dh)
}

/// Onglets aux modifications non enregistrées (les onglets de masque α suivent leur projet).
fn unsaved_tabs(st: &State) -> Vec<usize> {
    if st.empty {
        return Vec::new();
    }
    (0..st.tabs.len())
        .filter(|&i| {
            let d = if i == st.cur { Some(&st.doc) } else { st.tabs[i].as_ref() };
            d.is_some_and(|d| d.modified() && d.mask_of.is_none())
        })
        .collect()
}

/// Fermeture de l'application demandée : `true` si rien n'est à enregistrer (on peut quitter),
/// sinon la fenêtre « Modifications non enregistrées » s'ouvre.
fn request_exit(app: &AppWindow, st: &mut State) -> bool {
    finish_edits(app, st);
    let list = unsaved_tabs(st);
    if list.is_empty() {
        return true;
    }
    let thumbs = list
        .iter()
        .map(|&i| {
            let d = if i == st.cur { &st.doc } else { st.tabs[i].as_ref().unwrap() };
            TaskThumb { name: d.title.as_str().into(), image: px_thumb(&d.flatten(), d.w, d.h, 82, 62) }
        })
        .collect();
    let n = list.len();
    st.task = Some(Task::Exit(list));
    show_task(
        app,
        "Modifications non enregistrées",
        if n > 1 { "Des images ouvertes contiennent des modifications non enregistrées." } else { "Une image ouverte contient des modifications non enregistrées." },
        "Cliquez sur une vignette pour afficher l'image dans la fenêtre principale.",
        "Images",
        &[
            (
                "Enregistrer",
                if n > 1 { "Enregistre les images de la liste ci-dessus, puis quitte." } else { "Enregistre l'image de la liste ci-dessus, puis quitte." },
            ),
            ("Ne pas enregistrer", "Abandonne toutes les modifications non enregistrées, puis quitte."),
            ("Annuler", "Revient à MasterPaint."),
        ],
        thumbs,
    );
    false
}

/// Quitte l'application. `discard` : les onglets modifiés ne sont pas repris par la
/// sauvegarde automatique (« Ne pas enregistrer »).
fn quit_app(st: &mut State, discard: bool) {
    if discard {
        let keep: Vec<Doc> = (0..st.tabs.len())
            .filter_map(|i| if i == st.cur { Some(&st.doc) } else { st.tabs[i].as_ref() })
            .filter(|d| !d.modified() && d.mask_of.is_none())
            .map(|d| d.light_clone())
            .collect();
        write_autosave(keep, 0, true);
    } else {
        autosave(st, true);
    }
    let _ = slint::quit_event_loop();
}

/// Enregistre (exporte) l'onglet `i` : `true` si c'est fait (pas d'annulation).
fn save_tab(app: &AppWindow, state: &Shared, i: usize) -> bool {
    switch_tab(app, &mut state.borrow_mut(), i);
    export_quick(app, state);
    !state.borrow().doc.modified()
}

fn task_result(app: &AppWindow, state: &Shared, r: i32) {
    app.set_show_task(false);
    let Some(task) = state.borrow_mut().task.take() else { return };
    match task {
        Task::PerfReport => {
            if r == 0 {
                perf::open_report(app, &state.borrow());
            }
        }
        Task::IconFallback => {
            if r == 0 || r == 1 {
                app.set_set_missing_icon_fallback(r);
                app.invoke_icon_pack_action("fallback".into());
            }
        }
        Task::RenderOffer(uid, div) => {
            if r == 1 {
                // pour de bon : le réglage rejoint les Paramètres et le ruban
                app.set_set_render_ctl(true);
                app.set_set_render_default(div.trailing_zeros() as i32);
                app.invoke_settings_changed();
            }
            let mut st = state.borrow_mut();
            if r <= 1 && st.doc.uid == uid {
                render_set(app, &mut st, div);
            }
        }
        Task::CloseTab(i) => match r {
            0 => {
                if save_tab(app, state, i) {
                    let mut st = state.borrow_mut();
                    let cur = st.cur;
                    close_tab(app, &mut st, cur);
                }
            }
            1 => close_tab(app, &mut state.borrow_mut(), i),
            _ => {}
        },
        Task::Exit(list) => match r {
            0 => {
                for i in list {
                    if !save_tab(app, state, i) {
                        status(app, "Fermeture annulée : image non enregistrée");
                        return;
                    }
                }
                quit_app(&mut state.borrow_mut(), false);
            }
            1 => quit_app(&mut state.borrow_mut(), true),
            _ => {}
        },
        Task::Drop(files) => {
            let mut st = state.borrow_mut();
            match r {
                0 => {
                    for (name, w, h, px) in files {
                        set_document(app, &mut st, Doc::from_pixels(w, h, px, &name));
                    }
                }
                1 => {
                    let clips = files
                        .into_iter()
                        .map(|(name, w, h, px)| {
                            let stem = name.rsplit_once('.').map(|(a, _)| a).unwrap_or(&name).to_string();
                            (Clip { w, h, px, origin: None }, "Importer en calque", Some(stem))
                        })
                        .collect();
                    paste_clips(app, &mut st, clips);
                }
                _ => {}
            }
        }
        Task::DropOutside => {
            let mut st = state.borrow_mut();
            match r {
                0 => {
                    st.doc.clear_outside();
                    st.doc.commit("Hors toile : contenu supprimé");
                }
                1 => {
                    // toile agrandie jusqu'au contenu le plus éloigné : tout revient dedans
                    if let Some((x, y, w, h, _)) = st.doc.outside_composite() {
                        finish_edits(app, &mut st);
                        st.doc.resize_canvas_at(w, h, -x, -y);
                        st.doc.clear_outside();
                        st.doc.commit("Hors toile : toile agrandie");
                        app.invoke_zoom_fit();
                    }
                }
                _ => return,
            }
            app.global::<ToolOpts>().set_outside_canvas(false);
            refresh_all(app, &mut st);
        }
        Task::PasteWhere(clips) => {
            let mut st = state.borrow_mut();
            match r {
                0 => {
                    for (c, _, _) in clips {
                        paste_as_new_image(app, &mut st, c);
                    }
                }
                1 => paste_clips_here(app, &mut st, clips),
                _ => {}
            }
        }
        Task::SvgOpen(name, bytes, sprite) => {
            let mut st = state.borrow_mut();
            // mêmes choix que la fenêtre (la grille n'est proposée qu'aux feuilles de symboles,
            // « Dans le projet en cours » qu'avec un projet ouvert)
            let mut choices: Vec<Option<(svg_import::SvgMode, bool)>> = Vec::new();
            if sprite {
                choices.push(Some((svg_import::SvgMode::Sprite, false)));
            }
            choices.push(Some((svg_import::SvgMode::Split, false)));
            choices.push(Some((svg_import::SvgMode::Single, false)));
            if !st.empty {
                choices.push(Some((svg_import::SvgMode::Split, true)));
            }
            if let Some(Some((mode, here))) = usize::try_from(r).ok().and_then(|i| choices.get(i).cloned()) {
                open_svg(app, &mut st, &name, &bytes, mode, here);
            }
        }
        Task::Rasterize(uid) => {
            let mut st = state.borrow_mut();
            if r == 0 {
                if let Some(k) = st.doc.layers.iter().position(|l| l.uid == uid) {
                    rasterize_layer(app, &mut st, k);
                    status(app, "Calque pixellisé : vous pouvez peindre");
                }
            }
        }
        Task::Paste(clips) => {
            let mut st = state.borrow_mut();
            match r {
                0 => {
                    let nw = clips.iter().map(|c| c.0.w).max().unwrap_or(0).max(st.doc.w);
                    let nh = clips.iter().map(|c| c.0.h).max().unwrap_or(0).max(st.doc.h);
                    finish_edits(app, &mut st);
                    st.doc.resize_canvas_at(nw, nh, 0, 0);
                    for (c, label, name) in clips {
                        paste_pixels(app, &mut st, &c, label, name.as_deref(), Some((0, 0)));
                    }
                    app.invoke_zoom_fit();
                }
                1 => {
                    for (c, label, name) in clips {
                        paste_pixels(app, &mut st, &c, label, name.as_deref(), None);
                    }
                }
                _ => {}
            }
        }
    }
}

/// Vignette cliquée dans « Modifications non enregistrées » : affiche cette image.
fn task_thumb(app: &AppWindow, st: &mut State, k: usize) {
    if let Some(Task::Exit(list)) = &st.task {
        if let Some(&i) = list.get(k) {
            switch_tab(app, st, i);
        }
    }
}

/// Fond du haut de la fenêtre (comme la version web, app.js) : bande supérieure de l'image
/// active, très réduite puis floutée, éclaircie quand l'image est sombre. Slint l'étire sur
/// toute la largeur derrière les menus et les onglets, sous un voile de la couleur d'accent.
fn header_background(display: &[u8], w: usize, h: usize) -> Option<Image> {
    if display.len() != w * h * 4 || w == 0 || h == 0 {
        return None;
    }
    let (tw, th) = (64usize, 6usize);
    // bande du haut de l'image, à la proportion de la barre (≈ 1400 × 70 px)
    let band = ((w as f32 * 0.05) as usize).clamp(1, h);
    let mut px = vec![0f32; tw * th * 3];
    let mut intensity = 0f32;
    for ty in 0..th {
        for tx in 0..tw {
            let mut acc = [0f32; 3];
            // 4 × 4 échantillons par case : moyenne rapide, quelle que soit la taille de l'image
            for sy in 0..4 {
                for sx in 0..4 {
                    let x = ((tx * 4 + sx) * w / (tw * 4)).min(w - 1);
                    let y = ((ty * 4 + sy) * band / (th * 4)).min(h - 1);
                    let o = (y * w + x) * 4;
                    for k in 0..3 {
                        acc[k] += display[o + k] as f32 / 16.0;
                    }
                }
            }
            let o = (ty * tw + tx) * 3;
            px[o..o + 3].copy_from_slice(&acc);
            intensity += (0.299 * acc[0] + 0.587 * acc[1] + 0.114 * acc[2]).max(acc[0].max(acc[1]).max(acc[2]));
        }
    }
    // flou horizontal (la réduction verticale suffit déjà)
    let mut blur = px.clone();
    for ty in 0..th {
        for tx in 0..tw {
            for k in 0..3 {
                let mut s = 0.0;
                for d in -3i32..=3 {
                    let x = (tx as i32 + d).clamp(0, tw as i32 - 1) as usize;
                    s += px[(ty * tw + x) * 3 + k];
                }
                blur[(ty * tw + tx) * 3 + k] = s / 7.0;
            }
        }
    }
    // image sombre : plus lumineuse (1,5 pour du noir, 1 pour du blanc), comme la version web
    let gain = 1.5 - (intensity / (tw * th) as f32 / 255.0) * 0.5;
    let out: Vec<u8> = blur.chunks_exact(3).flat_map(|c| [(c[0] * gain).min(255.0) as u8, (c[1] * gain).min(255.0) as u8, (c[2] * gain).min(255.0) as u8, 255]).collect();
    Some(to_image(&out, tw, th))
}

thread_local! {
    /// l'image de l'aperçu du haut est tenue à jour
    static HEADER_SHOWN: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

fn sync_tabs(app: &AppWindow, st: &mut State) {
    // aucun projet : pas d'onglet
    if st.empty {
        app.set_active_tab_index(-1);
        sync_rows(app.get_tabs(), Vec::new(), |m| app.set_tabs(m));
        // l'aperçu flouté ne doit pas survivre au dernier projet fermé
        app.set_header_bg(Image::default());
        return;
    }
    // image vue en entier : affichage, ou aperçu de fond pour une grande image (mode lazy)
    let (ov, dw, dh): (&[u8], usize, usize) = if st.lazy && st.bs > 0 {
        (&st.backdrop, st.doc.w.div_ceil(st.bs), st.doc.h.div_ceil(st.bs))
    } else {
        let (dw, dh) = display_dims(st);
        (&st.display, dw, dh)
    };
    // fond du haut (onglets, barre translucide) seulement s'il est affiché ; vignette de l'onglet
    // actif tirée de l'affichage sans le recopier (une copie entière par rafraîchissement
    // coûtait cher sur les grandes images)
    let header = app.get_set_header_preview();
    HEADER_SHOWN.with(|h| h.set(header));
    if header {
        if let Some(img) = header_background(ov, dw, dh) {
            app.set_header_bg(img);
        }
    }
    let cur_thumb = (ov.len() == dw * dh * 4).then(|| px_thumb(ov, dw, dh, 68, 47));
    let mut new_thumbs = Vec::new();
    let tabs: Vec<DocTab> = st
        .tabs
        .iter()
        .enumerate()
        .map(|(i, d)| {
            let doc = if i == st.cur { &st.doc } else { d.as_ref().unwrap_or(&st.doc) };
            // image complète : rendu affiché (masques α, modes de fusion, filtres ƒ) pour l'onglet
            // actif ; image aplatie, gardée tant que le document ne change pas, pour les autres
            let thumb = if let (true, Some(t)) = (i == st.cur, &cur_thumb) {
                t.clone()
            } else {
                let key = (doc.hindex, doc.history.len(), doc.w, doc.h);
                match st.tab_thumbs.get(&doc.uid) {
                    Some((k, img)) if *k == key => img.clone(),
                    _ => {
                        // composée à l'échelle de la vignette (×2), pas en pleine résolution :
                        // des centaines de fois moins de calcul pour une grande image (restauration
                        // de plusieurs projets au démarrage)
                        let ds = (doc.w / 136).max(doc.h / 94).max(1);
                        let (sw, sh) = (doc.w.div_ceil(ds), doc.h.div_ceil(ds));
                        let mut small = vec![0u8; sw * sh * 4];
                        doc.composite_scaled(&mut small, ds, (0, 0, sw, sh), false);
                        let img = px_thumb(&small, sw, sh, 68, 47);
                        new_thumbs.push((doc.uid, key, img.clone()));
                        img
                    }
                }
            };
            DocTab { title: SharedString::from(doc.title.as_str()), thumb, active: i == st.cur, linked: false, link_left: false, link_right: false, mask: doc.mask_of.is_some(), kind: SharedString::from(match (doc.vector_mode, doc.anim.is_some()) {
                (true, true) => "ANIM SVG",
                (true, false) => "SVG",
                (false, true) => "ANIM",
                _ => "",
            }) }
        })
        .collect();
    for (uid, key, img) in new_thumbs {
        st.tab_thumbs.insert(uid, (key, img));
    }
    // groupes projet + masque α (identifiant du projet parent)
    let doc_at = |i: usize| if i == st.cur { Some(&st.doc) } else { st.tabs[i].as_ref() };
    let groups: Vec<Option<u64>> = (0..st.tabs.len())
        .map(|i| {
            let d = doc_at(i)?;
            d.mask_of.map(|m| m.0).or_else(|| (0..st.tabs.len()).any(|j| doc_at(j).and_then(|o| o.mask_of).is_some_and(|m| m.0 == d.uid)).then_some(d.uid))
        })
        .collect();
    let tabs: Vec<DocTab> = tabs
        .into_iter()
        .enumerate()
        .map(|(i, mut t)| {
            if let Some(g) = groups[i] {
                t.linked = true;
                t.link_left = i > 0 && groups[i - 1] == Some(g);
                t.link_right = groups.get(i + 1).copied().flatten() == Some(g);
            }
            t
        })
        .collect();
    sync_rows(app.get_tabs(), tabs, |m| app.set_tabs(m));
    app.set_active_tab_index(st.cur as i32);
}

fn open_file(app: &AppWindow, state: &Shared) {
    let weak = app.as_weak();
    let state = state.clone();
    #[cfg(target_arch = "wasm32")]
    let task = async move {
        // web : sélecteur de fichier du navigateur
        let Some((name, bytes)) = web::pick_file(&format!("image/*,.illu,.svg,.pdn,.psd,.psb,.tga,.qoi,{}", raw_accept())).await else { return };
        let Some(app) = weak.upgrade() else { return };
        load_bytes(&app, &state, &name, bytes);
    };
    #[cfg(not(target_arch = "wasm32"))]
    let task = async move {
        let all: Vec<&str> = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico", "tif", "tiff", "tga", "qoi", "illu", "svg", "pdn", "psd", "psb"].into_iter().chain(raw::EXTENSIONS.iter().copied()).collect();
        let Some(file) = rfd::AsyncFileDialog::new()
            .add_filter(i18n::tr("Images, photos RAW et projets MasterPaint"), &all)
            .add_filter(i18n::tr("Projet MasterPaint (.illu)"), &["illu"])
            .add_filter(i18n::tr("Paint.NET (.pdn)"), &["pdn"])
            .add_filter(i18n::tr("Photoshop (.psd, .psb)"), &["psd", "psb"])
            .add_filter(i18n::tr("Dessin SVG"), &["svg"])
            .add_filter(i18n::tr("Photos RAW"), raw::EXTENSIONS)
            .pick_file()
            .await
        else {
            return;
        };
        let bytes = file.read().await;
        let Some(app) = weak.upgrade() else { return };
        load_bytes(&app, &state, &file.file_name(), bytes);
    };
    let _ = slint::spawn_local(task);
}

/// Ouvre un fichier lu (image, photo RAW ou projet .illu) dans de nouveaux onglets.
fn load_bytes(app: &AppWindow, state: &Shared, name: &str, bytes: Vec<u8>) {
    let mut st = state.borrow_mut();
    // GIF animé : ouvert en mode animation (une image par dessin)
    if open_animated_gif(app, &mut st, name, &bytes) {
        return;
    }
    start_load(app, &mut st, LoadTo::Tabs, vec![(name.to_string(), bytes)]);
}

/// Encode l'image aplatie (PNG, JPEG, WebP sans perte, BMP selon l'extension).
fn encode(doc: &Doc, ext: &str) -> Option<Vec<u8>> {
    let flat = doc.flatten_final();
    let img = image::RgbaImage::from_raw(doc.w as u32, doc.h as u32, flat)?;
    let fmt = match ext {
        "jpg" | "jpeg" => image::ImageFormat::Jpeg,
        "webp" => image::ImageFormat::WebP,
        "bmp" => image::ImageFormat::Bmp,
        _ => image::ImageFormat::Png,
    };
    let mut out = std::io::Cursor::new(Vec::new());
    if fmt == image::ImageFormat::Jpeg {
        image::DynamicImage::ImageRgba8(img).to_rgb8().write_to(&mut out, fmt).ok()?;
    } else {
        img.write_to(&mut out, fmt).ok()?;
    }
    Some(out.into_inner())
}

/// Fenêtre Exporter (comme la version web) : nom du fichier, export rapide PNG / .illu, autres
/// formats et options (qualité JPEG, profondeur de couleur, onglet ou tous les onglets).
fn show_export(app: &AppWindow, st: &State) {
    let t = &st.doc.title;
    let base = t.rsplit_once('.').map(|(a, _)| a.to_string()).unwrap_or(t.clone());
    app.set_ex_name(SharedString::from(base));
    app.set_ex_tabs(st.tabs.len() as i32);
    app.set_show_export(true);
}

/// Réduction de la profondeur de couleur (WorkspaceIO.applyBitDepthReduction) : « bw » = noir et
/// blanc au seuil de la luminance moyenne, sinon 1 / 2 / 4 bits par canal.
fn reduce_bits(px: &mut [u8], bits: &str) {
    let lum = |p: &[u8]| 0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32;
    if bits == "bw" {
        let (mut sum, mut n) = (0f64, 0usize);
        for p in px.chunks_exact(4).filter(|p| p[3] > 10) {
            sum += lum(p) as f64;
            n += 1;
        }
        let thr = if n > 0 { (sum / n as f64) as f32 } else { 128.0 };
        for p in px.chunks_exact_mut(4) {
            let v = if lum(p) > thr { 255 } else { 0 };
            p[..3].fill(v);
        }
    } else if let Ok(b) = bits.parse::<u32>() {
        if (1..8).contains(&b) {
            let step = 255.0 / ((1u32 << b) - 1) as f32;
            for p in px.chunks_exact_mut(4) {
                for c in &mut p[..3] {
                    *c = ((*c as f32 / step).round() * step).min(255.0) as u8;
                }
            }
        }
    }
}

/// Image aplatie encodée au format demandé (qualité JPEG 1..100, profondeur de couleur).
fn encode_with(doc: &Doc, fmt: &str, quality: u8, bits: &str) -> Option<Vec<u8>> {
    let mut flat = doc.flatten_final();
    reduce_bits(&mut flat, bits);
    let img = image::RgbaImage::from_raw(doc.w as u32, doc.h as u32, flat)?;
    let mut out = std::io::Cursor::new(Vec::new());
    match fmt {
        "jpeg" => {
            let rgb = image::DynamicImage::ImageRgba8(img).to_rgb8();
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality.clamp(1, 100)).encode_image(&rgb).ok()?;
        }
        "webp" => img.write_to(&mut out, image::ImageFormat::WebP).ok()?,
        "bmp" => img.write_to(&mut out, image::ImageFormat::Bmp).ok()?,
        "gif" => img.write_to(&mut out, image::ImageFormat::Gif).ok()?,
        _ => img.write_to(&mut out, image::ImageFormat::Png).ok()?,
    }
    Some(out.into_inner())
}

/// Exporte selon la fenêtre Exporter : bureau = fenêtre d'enregistrement du système (nom
/// proposé), web = téléchargement. `all` : tous les onglets dans un seul .illu.
fn export_to(app: &AppWindow, state: &Shared, fmt: &str, name: &str, quality: i32, bits: &str, all: bool) {
    let (ext, mime, label) = match fmt {
        "jpeg" => ("jpg", "image/jpeg", "JPEG"),
        "webp" => ("webp", "image/webp", "WebP"),
        "bmp" => ("bmp", "image/bmp", "BMP"),
        "gif" => ("gif", "image/gif", "GIF"),
        "illu" => ("illu", "application/octet-stream", "Projet MasterPaint (.illu)"),
        "svg" => ("svg", "image/svg+xml", "SVG"),
        _ => ("png", "image/png", "PNG"),
    };
    let bytes = {
        let mut st = state.borrow_mut();
        let st = &mut *st;
        if fmt == "svg" {
            Some(vector::to_svg(&st.doc, &mut st.fonts).into_bytes())
        } else if fmt == "illu" {
            if all {
                let (docs, cur) = workspace_docs(&st);
                let refs: Vec<&Doc> = docs.iter().collect();
                Some(illu::save_all(&refs, cur))
            } else {
                Some(illu::save(&st.doc))
            }
        } else {
            encode_with(&st.doc, fmt, quality.clamp(1, 100) as u8, bits)
        }
    };
    let Some(bytes) = bytes else {
        show_error(app, "Exporter", &i18n::tr_format!("L'image n'a pas pu être encodée au format {fmt}."));
        return;
    };
    let name = {
        let n = name.trim();
        let n = if n.is_empty() { "image" } else { n };
        format!("{n}.{ext}")
    };
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    {
        let _ = mime;
        let Some(path) = rfd::FileDialog::new().set_file_name(&name).add_filter(label, &[ext]).save_file() else { return };
        if std::fs::write(&path, &bytes).is_ok() {
            state.borrow_mut().doc.mark_saved();
            app.set_show_export(false);
            status(app, i18n::tr_format!("Exporté : {}", path.display()));
        } else {
            show_error(app, "Exporter", &i18n::tr_format!("Écriture impossible : {}", path.display()));
        }
    }
    #[cfg(target_os = "android")]
    {
        let (weak, state) = (app.as_weak(), state.clone());
        android_io::save(&name, mime, bytes, move |ok| {
            if ok {
                if let Some(app) = weak.upgrade() {
                    state.borrow_mut().doc.mark_saved();
                    app.set_show_export(false);
                }
            }
        });
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = label;
        web::download_bytes(&bytes, &name, mime);
        state.borrow_mut().doc.mark_saved();
        app.set_show_export(false);
        status(app, i18n::tr_format!("Exporté : {name}"));
    }
}

/// Enregistrement direct (fenêtre « Modifications non enregistrées ») : choix du format dans
/// la fenêtre d'enregistrement du système.
fn export_quick(app: &AppWindow, state: &Shared) {
    let base = {
        let st = state.borrow();
        let t = st.doc.title.rsplit_once('.').map(|(a, _)| a.to_string()).unwrap_or(st.doc.title.clone());
        if t.is_empty() { "image".to_string() } else { t }
    };
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    {
        let Some(path) = rfd::FileDialog::new()
            .set_file_name(format!("{base}.png"))
            .add_filter(i18n::tr("PNG"), &["png"])
            .add_filter(i18n::tr("Projet MasterPaint (.illu)"), &["illu"])
            .add_filter(i18n::tr("JPEG"), &["jpg", "jpeg"])
            .add_filter(i18n::tr("WebP"), &["webp"])
            .add_filter(i18n::tr("BMP"), &["bmp"])
            .save_file()
        else {
            return;
        };
        let ext = path.extension().map(|e| e.to_string_lossy().to_lowercase()).unwrap_or_else(|| "png".into());
        let bytes = if ext == "illu" { Some(illu::save(&state.borrow().doc)) } else { encode(&state.borrow().doc, &ext) };
        let res = bytes.and_then(|b| std::fs::write(&path, b).ok());
        if res.is_some() {
            state.borrow_mut().doc.mark_saved();
        }
        status(app, if res.is_some() { i18n::tr_format!("Exporté : {}", path.display()) } else { "Échec de l'export".into() });
    }
    #[cfg(target_arch = "wasm32")]
    {
        // encodé avant : l'emprunt d'un `if let` vit jusqu'à la fin du bloc (le `borrow_mut`
        // ci-dessous paniquait : « RefCell already borrowed »)
        let bytes = encode(&state.borrow().doc, "png");
        if let Some(bytes) = bytes {
            web::download_bytes(&bytes, &format!("{base}.png"), "image/png");
            state.borrow_mut().doc.mark_saved();
            status(app, "Image exportée (PNG)");
        }
    }
    #[cfg(target_os = "android")]
    export_to(app, state, "png", &base, 92, "8", false);

}

// ------------------------------------------------------------------ recadrage interactif

/// Recadrage interactif (IlluCropInteractive.js) : cadre sur la toile, 8 poignées, extérieur
/// assombri, rapports imposés ; Entrée / « Recadrer » applique, Échap annule.
struct Crop {
    /// cadre (x, y, largeur, hauteur) en pixels du document
    r: (f32, f32, f32, f32),
    ratio: Option<f32>,
    /// glisser en cours : poignée (0..7 : coins hg, hd, bd, bg puis bords h, d, b, g ; 8 = déplacer ;
    /// 9 = nouveau cadre), cadre au départ, point de départ
    drag: Option<(u8, (f32, f32, f32, f32), (f32, f32))>,
}

fn start_crop(app: &AppWindow, st: &mut State) {
    if st.doc.mask_of.is_some() {
        status(app, "Ouvrez le document principal pour le recadrer");
        return;
    }
    finish_edits(app, st);
    // la sélection rectangulaire sert de point de départ, sinon toute l'image
    let r = st.doc.selection_bounds().map(|(x0, y0, x1, y1)| (x0 as f32, y0 as f32, (x1 - x0) as f32, (y1 - y0) as f32));
    let r = r.filter(|r| r.2 >= 4.0 && r.3 >= 4.0).unwrap_or((0.0, 0.0, st.doc.w as f32, st.doc.h as f32));
    st.crop = Some(Crop { r, ratio: None, drag: None });
    app.set_crop_ratio(-1);
    app.set_show_crop(true);
    app.invoke_zoom_fit();
    show_crop(app, st);
}

fn show_crop(app: &AppWindow, st: &State) {
    let Some(c) = &st.crop else {
        app.set_crop_active(false);
        app.set_handles(ModelRc::default());
        app.set_overlay_path(SharedString::default());
        return;
    };
    let (x, y, w, h) = c.r;
    app.set_crop_active(true);
    app.set_crop_x(x);
    app.set_crop_y(y);
    app.set_crop_w(w);
    app.set_crop_h(h);
    let pts = crop_points(c.r);
    app.set_handles(ModelRc::new(VecModel::from(pts.iter().enumerate().map(|(i, p)| Handle { x: p.0, y: p.1, round: i < 4 }).collect::<Vec<_>>())));
    // tiers (règle des tiers) et contour
    let mut path = format!("M {x} {y} L {} {y} L {} {} L {x} {} Z", x + w, x + w, y + h, y + h);
    for k in 1..3 {
        let fx = x + w * k as f32 / 3.0;
        let fy = y + h * k as f32 / 3.0;
        path += &format!(" M {fx} {y} L {fx} {} M {x} {fy} L {} {fy}", y + h, x + w);
    }
    app.set_overlay_path(SharedString::from(path));
    app.set_status_text(SharedString::from(i18n::tr_format!("Recadrage : {} × {} px", w.round(), h.round())));
}

/// Poignées : 4 coins puis milieux des bords (haut, droite, bas, gauche).
fn crop_points((x, y, w, h): (f32, f32, f32, f32)) -> [(f32, f32); 8] {
    [(x, y), (x + w, y), (x + w, y + h), (x, y + h), (x + w / 2.0, y), (x + w, y + h / 2.0), (x + w / 2.0, y + h), (x, y + h / 2.0)]
}

fn crop_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32) {
    let (dw, dh) = (st.doc.w as f32, st.doc.h as f32);
    let tol = 8.0 / app.get_zoom().max(0.01);
    let Some(c) = st.crop.as_mut() else { return };
    match kind {
        0 => {
            let hit = crop_points(c.r).iter().position(|p| (p.0 - x).abs() <= tol && (p.1 - y).abs() <= tol);
            let (rx, ry, rw, rh) = c.r;
            let grab = match hit {
                Some(i) => i as u8,
                None if x >= rx && x <= rx + rw && y >= ry && y <= ry + rh => 8,
                None => 9,
            };
            c.drag = Some((grab, c.r, (x, y)));
        }
        1 => {
            let Some((grab, (sx, sy, sw, sh), (fx, fy))) = c.drag else {
                // curseur : flèches orientées sur une poignée, déplacement à l'intérieur du cadre
                let (rx, ry, rw, rh) = c.r;
                let (cx, cy) = (rx + rw / 2.0, ry + rh / 2.0);
                let cur = match crop_points(c.r).iter().find(|p| (p.0 - x).abs() <= tol && (p.1 - y).abs() <= tol) {
                    Some(p) => transform::resize_cursor(p.0 - cx, p.1 - cy),
                    None if x >= rx && x <= rx + rw && y >= ry && y <= ry + rh => 1,
                    None => 0,
                };
                app.set_canvas_cursor(cur);
                return;
            };
            let (ddx, ddy) = (x - fx, y - fy);
            let (mut l, mut t, mut r, mut b) = (sx, sy, sx + sw, sy + sh);
            match grab {
                8 => {
                    let (nx, ny) = ((sx + ddx).clamp(0.0, (dw - sw).max(0.0)), (sy + ddy).clamp(0.0, (dh - sh).max(0.0)));
                    c.r = (nx.round(), ny.round(), sw, sh);
                    show_crop(app, st);
                    return;
                }
                9 => {
                    l = fx.min(x);
                    r = fx.max(x);
                    t = fy.min(y);
                    b = fy.max(y);
                }
                g => {
                    if matches!(g, 0 | 3 | 7) {
                        l = (sx + ddx).min(r - 1.0);
                    }
                    if matches!(g, 1 | 2 | 5) {
                        r = (sx + sw + ddx).max(l + 1.0);
                    }
                    if matches!(g, 0 | 1 | 4) {
                        t = (sy + ddy).min(b - 1.0);
                    }
                    if matches!(g, 2 | 3 | 6) {
                        b = (sy + sh + ddy).max(t + 1.0);
                    }
                }
            }
            l = l.clamp(0.0, dw);
            r = r.clamp(0.0, dw);
            t = t.clamp(0.0, dh);
            b = b.clamp(0.0, dh);
            let (mut w, mut h) = (r - l, b - t);
            if let Some(q) = c.ratio {
                // rapport imposé : la dimension qui dépasse est réduite, ancrée côté opposé
                if w / h.max(1.0) > q {
                    w = h * q;
                } else {
                    h = w / q;
                }
                if matches!(grab, 0 | 3 | 7) || (grab == 9 && x < fx) {
                    l = r - w;
                }
                if matches!(grab, 0 | 1 | 4) || (grab == 9 && y < fy) {
                    t = b - h;
                }
            }
            c.r = (l.round(), t.round(), w.round().max(1.0), h.round().max(1.0));
            show_crop(app, st);
        }
        _ => {
            c.drag = None;
        }
    }
}

/// Panneau Recadrage : rapport (0 16:9, 1 9:16, 2 1:1, 3 4:3, autre = libre), appliquer, annuler.
fn crop_action(app: &AppWindow, st: &mut State, what: &str) {
    let (dw, dh) = (st.doc.w as f32, st.doc.h as f32);
    match what {
        "apply" => {
            let Some(c) = st.crop.take() else { return };
            let (x, y, w, h) = c.r;
            app.set_show_crop(false);
            if w >= 1.0 && h >= 1.0 && (x, y, w, h) != (0.0, 0.0, dw, dh) {
                st.doc.resize_canvas_at(w as usize, h as usize, -(x as isize), -(y as isize));
                st.doc.commit("Recadrer");
            }
            show_crop(app, st);
            status(app, "");
            refresh_all(app, st);
            app.invoke_zoom_fit();
        }
        "cancel" => {
            st.crop = None;
            app.set_show_crop(false);
            show_crop(app, st);
            status(app, "");
        }
        r => {
            let Some(c) = st.crop.as_mut() else { return };
            c.ratio = match r {
                "0" => Some(16.0 / 9.0),
                "1" => Some(9.0 / 16.0),
                "2" => Some(1.0),
                "3" => Some(4.0 / 3.0),
                _ => None,
            };
            if let Some(q) = c.ratio {
                // cadre recentré au rapport choisi, aussi grand que possible
                let (x, y, w, h) = c.r;
                let (cx, cy) = (x + w / 2.0, y + h / 2.0);
                let (mut nw, mut nh) = if w / h > q { (h * q, h) } else { (w, w / q) };
                nw = nw.min(dw);
                nh = nh.min(dh);
                let nx = (cx - nw / 2.0).clamp(0.0, dw - nw);
                let ny = (cy - nh / 2.0).clamp(0.0, dh - nh);
                c.r = (nx.round(), ny.round(), nw.round(), nh.round());
            }
            show_crop(app, st);
        }
    }
}

/// Démonstrations (--demo) : action de menu appelée directement.
fn menu_demo(app: &AppWindow, st: &mut State, action: &str) {
    let has = |k: &str| action.contains(k);
    if has("showImageBorderDialog") {
        app.set_bd_doc_w(st.doc.w as i32);
        app.set_bd_doc_h(st.doc.h as i32);
        app.set_show_border(true);
    } else {
        app.set_dlg_w(SharedString::from(st.doc.w.to_string()));
        app.set_dlg_h(SharedString::from(st.doc.h.to_string()));
        app.set_rs_orig_w(st.doc.w as i32);
        app.set_rs_orig_h(st.doc.h as i32);
        let presets = size_presets(st.doc.w, st.doc.h);
        app.set_rs_preset_labels(ModelRc::new(VecModel::from(std::iter::once(SharedString::from(i18n::tr("Choisir une taille…"))).chain(presets.iter().map(|p| p.label.clone())).collect::<Vec<_>>())));
        app.set_rs_presets(ModelRc::new(VecModel::from(presets)));
        app.set_resize_canvas_mode(has("Extend"));
        app.set_show_resize(true);
    }
}

/// Tailles prédéfinies de Redimensionner, selon le rapport de l'image : formats courants si le
/// rapport est connu (16:9, 4:3, 3:2, 1:1 et leurs versions portrait), sinon largeurs usuelles
/// au même rapport ; plus la moitié et le double.
fn size_presets(w: usize, h: usize) -> Vec<SizePreset> {
    let r = w as f32 / h.max(1) as f32;
    let known: &[(f32, &str, &[(usize, usize, &str)])] = &[
        (16.0 / 9.0, "16:9", &[(3840, 2160, "4K"), (2560, 1440, "1440p"), (1920, 1080, "1080p"), (1280, 720, "720p"), (854, 480, "480p")]),
        (4.0 / 3.0, "4:3", &[(2048, 1536, ""), (1600, 1200, ""), (1024, 768, ""), (800, 600, ""), (640, 480, "")]),
        (3.0 / 2.0, "3:2", &[(6000, 4000, "24 Mpx"), (3000, 2000, ""), (1800, 1200, ""), (1200, 800, ""), (900, 600, "")]),
        (1.0, "1:1", &[(2048, 2048, ""), (1080, 1080, "Instagram"), (1024, 1024, ""), (512, 512, ""), (256, 256, "icône")]),
    ];
    let mut out: Vec<(usize, usize, String)> = Vec::new();
    for (kr, name, sizes) in known {
        let portrait = (r - 1.0 / kr).abs() < 0.01 && *kr != 1.0;
        if (r - kr).abs() < 0.01 || portrait {
            for (a, b, tag) in sizes.iter() {
                let (pw, ph) = if portrait { (*b, *a) } else { (*a, *b) };
                let ratio = if portrait { name.split(':').rev().collect::<Vec<_>>().join(":") } else { name.to_string() };
                let extra = if tag.is_empty() { ratio } else { i18n::tr_format!("{ratio}, {tag}") };
                out.push((pw, ph, i18n::tr_format!("{pw} × {ph} ({extra})")));
            }
            break;
        }
    }
    if out.is_empty() {
        for tw in [3840usize, 2560, 1920, 1280, 1024, 800, 640] {
            let th = ((tw as f32 / r).round() as usize).max(1);
            out.push((tw, th, i18n::tr_format!("{tw} × {th}")));
        }
    }
    for (f, tag) in [(2.0f32, "200 %"), (0.5, "50 %")] {
        let (pw, ph) = (((w as f32 * f).round() as usize).max(1), ((h as f32 * f).round() as usize).max(1));
        out.push((pw, ph, i18n::tr_format!("{pw} × {ph} ({tag})")));
    }
    out.into_iter()
        .filter(|(pw, ph, _)| *pw <= 16384 && *ph <= 16384 && (*pw, *ph) != (w, h))
        .map(|(pw, ph, label)| SizePreset { label: label.into(), w: pw.to_string().into(), h: ph.to_string().into() })
        .collect()
}

/// Liens de téléchargement de l'application installable.
fn download_url(kind: &str) -> String {
    // noms fixes (sans version) : rust/build-all.sh remplace le fichier à chaque compilation
    let file = match kind {
        "windows-exe" => "MasterPaint-windows-x64.exe",
        // installeur NSIS de la version Rust (rust/packaging/installer/masterpaint.nsi)
        "windows-setup" => "MasterPaint-windows-setup.exe",
        "linux-tar" => "MasterPaint-linux-x86_64.tar.gz",
        "linux-flatpak" => "MasterPaint.flatpak",
        // AppImage : build-all.sh la refait sans appimagetool (lanceur repris + mksquashfs)
        "linux-appimage" => "MasterPaint-linux-x86_64.AppImage",
        // coquille WebApk (build-all.sh apk) ; iOS : .ipa non signée, compilée sur un Mac
        "android" => "MasterPaint-android.apk",
        "ios" => "MasterPaint-ios.ipa",
        _ => "MasterPaint-macos.dmg",
    };
    // sur le web : à côté de la page ; sur le bureau : le site officiel
    #[cfg(target_arch = "wasm32")]
    {
        // site masterpaint.fr : /downloads/ à la racine (la version Rust est sous /rust-app/)
        web::site_path(&format!("/downloads/{file}"))
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        format!("https://masterpaint.fr/downloads/{file}")
    }
}

// ------------------------------------------------------------------ suppression du fond (IA)

/// Plume : adoucit le canal alpha (deux passes de flou boîte, rayon ≤ 8 comme la version web).
#[cfg(target_arch = "wasm32")]
fn feather_alpha(px: &mut [u8], w: usize, h: usize, radius: usize) {
    let rad = radius.min(8);
    if rad == 0 || w == 0 || h == 0 {
        return;
    }
    let mut a: Vec<f32> = px.chunks_exact(4).map(|p| p[3] as f32).collect();
    let mut tmp = vec![0f32; w * h];
    for _ in 0..2 {
        // horizontal puis vertical : moyenne sur la fenêtre (bords tronqués)
        for y in 0..h {
            let row = &a[y * w..(y + 1) * w];
            let mut acc: f32 = row[..rad.min(w - 1) + 1].iter().sum();
            for x in 0..w {
                let (lo, hi) = (x.saturating_sub(rad), (x + rad).min(w - 1));
                tmp[y * w + x] = acc / (hi - lo + 1) as f32;
                if x + rad + 1 < w {
                    acc += row[x + rad + 1];
                }
                if x >= rad {
                    acc -= row[x - rad];
                }
            }
        }
        for x in 0..w {
            let mut acc: f32 = (0..=rad.min(h - 1)).map(|y| tmp[y * w + x]).sum();
            for y in 0..h {
                let (lo, hi) = (y.saturating_sub(rad), (y + rad).min(h - 1));
                a[y * w + x] = acc / (hi - lo + 1) as f32;
                if y + rad + 1 < h {
                    acc += tmp[(y + rad + 1) * w + x];
                }
                if y >= rad {
                    acc -= tmp[(y - rad) * w + x];
                }
            }
        }
    }
    for (p, v) in px.chunks_exact_mut(4).zip(a) {
        p[3] = v.round().clamp(0.0, 255.0) as u8;
    }
}

/// Texte et avancement (0–100) d'une étape de la bibliothèque IA (clés de @imgly/background-removal).
#[cfg(target_arch = "wasm32")]
fn rmbg_step(key: &str, cur: f64, total: f64) -> (String, f32) {
    let k = key.to_lowercase();
    let has = |s: &str| k.contains(s);
    let pct = if total > 0.0 {
        (100.0 * cur / total).round().clamp(0.0, 100.0) as f32
    } else if has("fetch") || has("download") {
        22.0
    } else if has("decode") || has("wasm") {
        32.0
    } else if has("inference") {
        55.0
    } else if has("mask") {
        76.0
    } else if has("encode") {
        90.0
    } else {
        45.0
    };
    let with_pct = |t: &str| { let t = i18n::tr(t); if total > 0.0 { format!("{t} {pct:.0} %") } else { t } };
    let text = if k == "module" {
        "Chargement du module IA…".to_string()
    } else if k == "prepare" {
        "Préparation de l'image…".to_string()
    } else if k == "apply" {
        "Application sur le calque…".to_string()
    } else if has("fetch") || has("download") {
        with_pct("Téléchargement des ressources…")
    } else if has("inference") {
        "Analyse de l'image…".to_string()
    } else if has("mask") {
        "Application du masque…".to_string()
    } else if has("encode") {
        "Encodage…".to_string()
    } else {
        with_pct("Traitement…")
    };
    let pct = match k.as_str() {
        "module" => 3.0,
        "prepare" => 11.0,
        "apply" => 96.0,
        _ => 15.0 + pct * 0.8,
    };
    (text, pct)
}

/// Ouvre la fenêtre « Suppression du fond » (calque bitmap du document principal).
fn rmbg_open(app: &AppWindow, st: &mut State) {
    if st.doc.mask_of.is_some() {
        return status(app, "Suppression du fond : ouvrez le document principal.");
    }
    if st.doc.w < 2 || st.doc.h < 2 {
        return status(app, "Suppression du fond : image trop petite.");
    }
    finish_edits(app, st);
    let big = st.doc.w.max(st.doc.h) > 4096;
    app.set_rmbg_warn(SharedString::from(i18n::tr(if big {
        "Image très grande : le traitement peut être lent ou saturer la mémoire."
    } else {
        ""
    })));
    app.set_rmbg_busy(false);
    app.set_show_rmbg(true);
}

/// Lance la suppression du fond sur le calque actif (web : bibliothèque de la page, dans ses
/// propres Workers, sans bloquer l'interface).
fn rmbg_start(app: &AppWindow, state: &Shared) {
    #[cfg(target_arch = "wasm32")]
    {
        let model = ["small", "medium", "large"][app.get_rmbg_model().clamp(0, 2) as usize];
        let feather = app.get_rmbg_feather().round().max(0.0) as usize;
        let (w, h, uid, layer, base) = {
            let st = state.borrow();
            (st.doc.w, st.doc.h, st.doc.uid, st.doc.active, st.doc.layer().px.clone())
        };
        app.set_rmbg_busy(true);
        app.set_rmbg_progress(2.0);
        app.set_rmbg_text(SharedString::from(i18n::tr("Chargement du module IA…")));
        applog::log(i18n::tr_format!("Supprimer le fond (IA) : {w} × {h} px, modèle {model}, plume {feather}"));
        let (weak, state) = (app.as_weak(), state.clone());
        let _ = slint::spawn_local(async move {
            let t0 = now_ms();
            let wk = weak.clone();
            let res = web::remove_bg(&base, w, h, model, move |k, c, t| {
                if let Some(app) = wk.upgrade() {
                    let (text, pct) = rmbg_step(&k, c, t);
                    app.set_rmbg_text(SharedString::from(i18n::tr(&text)));
                    app.set_rmbg_progress(pct);
                }
            })
            .await;
            let Some(app) = weak.upgrade() else { return };
            app.set_rmbg_busy(false);
            match res {
                Ok(mut px) if px.len() == w * h * 4 => {
                    app.set_show_rmbg(false);
                    let Ok(mut st) = state.try_borrow_mut() else { return };
                    if st.doc.uid != uid || st.doc.active != layer || st.doc.w != w || st.doc.h != h {
                        return status(&app, "Suppression du fond : le document a changé pendant le traitement, résultat ignoré.");
                    }
                    feather_alpha(&mut px, w, h, feather);
                    st.doc.layer_mut().px = px.into();
                    st.doc.commit("Supprimer le fond (IA)");
                    refresh_all(&app, &mut st);
                    status(&app, i18n::tr_format!("Supprimer le fond (IA) : {:.1} s", (now_ms() - t0) / 1000.0));
                }
                Err(e) if e == "ILLU_ABORT" => {
                    app.set_show_rmbg(false);
                    status(&app, "Suppression du fond annulée");
                }
                other => {
                    app.set_show_rmbg(false);
                    let why = other.err().unwrap_or_else(|| "résultat inattendu".into());
                    show_error(
                        &app,
                        "Supprimer le fond (IA)",
                        &i18n::tr_format!("Impossible de supprimer le fond ({why}). Vérifiez la connexion (premier usage : téléchargement du modèle), un bloqueur de script, ou essayez un navigateur récent."),
                    );
                }
            }
        });
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = state;
        app.set_show_rmbg(false);
        show_error(
            app,
            "Supprimer le fond (IA)",
            "Cette fonction utilise un modèle d'IA exécuté dans le navigateur : elle est disponible dans la version web de MasterPaint (masterpaint.fr). La version de bureau suivra.",
        );
    }
}

// ------------------------------------------------------------------ presse-papiers

fn copy(app: &AppWindow, st: &mut State) -> bool {
    let Some((x, y, w, h, px)) = st.doc.copy_selection() else { return false };
    #[cfg(not(target_arch = "wasm32"))]
    {
        clipboard_size::write_image(w, h, &px);
    }
    applog::log(i18n::tr_format!("Copier : {w} × {h} px"));
    #[cfg(target_arch = "wasm32")]
    web::clipboard_write(&px, w, h);
    st.clipboard = Some(Clip { w, h, px, origin: Some((x as isize, y as isize, st.doc.uid)) });
    status(app, "Copié");
    true
}

// État partagé, pour les collages du navigateur (lecture asynchrone du presse-papiers).
#[cfg(target_arch = "wasm32")]
thread_local! {
    static SHARED: RefCell<std::rc::Weak<RefCell<State>>> = RefCell::new(std::rc::Weak::new());
    /// dernier Ctrl+V lu par l'application (ms) : l'évènement « paste » qui suit est ignoré
    static PASTE_READ_AT: std::cell::Cell<f64> = const { std::cell::Cell::new(-1e9) };
}

/// Image reçue du presse-papiers du système : notre propre copie (mêmes pixels) garde sa
/// position d'origine, une autre image est collée sans position (centrée).
#[cfg(target_arch = "wasm32")]
fn clip_from_raw(st: &mut State, w: usize, h: usize, px: Vec<u8>) -> Clip {
    // même image que notre copie ? (comparaison par échantillons : inutile de relire des
    // dizaines de Mo, une image différente change presque sûrement l'un d'eux)
    let same = |a: &[u8], b: &[u8]| a.len() == b.len() && a.iter().step_by(509).zip(b.iter().step_by(509)).all(|(x, y)| x == y) && a[..4096.min(a.len())] == b[..4096.min(b.len())];
    if let Some(c) = st.clipboard.as_ref().filter(|c| c.w == w && c.h == h && same(&c.px, &px)) {
        return c.clone();
    }
    let c = Clip { w, h, px, origin: None };
    st.clipboard = Some(c.clone());
    c
}

/// Web : lit le presse-papiers du système, puis colle (`new_image` : dans une nouvelle image).
#[cfg(target_arch = "wasm32")]
fn web_paste(app: &AppWindow, new_image: bool) {
    applog::log("Coller : lecture du presse-papiers du système…");
    let weak = app.as_weak();
    let _ = slint::spawn_local(async move {
        let bytes = web::clipboard_read().await;
        applog::log(match &bytes {
            Some((w, h, _)) => i18n::tr_format!("Coller : image reçue ({w} × {h} px)"),
            None => i18n::tr_format!("Coller : rien reçu du système ({})", web::clipboard_error()),
        });
        // la lecture peut être refusée (focus, permission) alors que l'évènement « paste » du
        // navigateur, lui, arrive juste après et porte l'image : on l'attend avant de conclure
        if bytes.is_none() && !web::paste_event_claimed() {
            web::wait_paste(700.0).await;
        }
        if web::paste_event_claimed() {
            applog::log("Coller : déjà traité par l'évènement du navigateur");
            return;
        }
        PASTE_READ_AT.with(|t| t.set(js_sys::Date::now()));
        let (Some(app), Some(state)) = (weak.upgrade(), SHARED.with(|s| s.borrow().upgrade())) else {
            applog::log("Coller : application indisponible");
            return;
        };
        let Ok(mut st) = state.try_borrow_mut() else {
            applog::log("Coller : état occupé, collage abandonné");
            return;
        };
        let decoded = bytes.map(|(w, h, px)| clip_from_raw(&mut st, w, h, px));
        let c = match decoded {
            Some(c) => c,
            None => match st.clipboard.clone() {
                Some(c) => {
                    applog::log("Coller : presse-papiers interne");
                    c
                }
                None => {
                    let why = web::clipboard_error();
                    drop(st);
                    show_error(
                        &app,
                        "Coller",
                        &i18n::tr_format!("Aucune image à coller. Le navigateur n'a pas donné le contenu du presse-papiers{}.", if why.is_empty() { String::new() } else { i18n::tr_format!(" : {why}") }),
                    );
                    return;
                }
            },
        };
        if new_image {
            paste_as_new_image(&app, &mut st, c);
        } else {
            paste_clips(&app, &mut st, vec![(c, "Coller", None)]);
        }
    });
}

/// Bureau : image du presse-papiers système (copiée dans une autre application) reprise comme
/// contenu à coller, sauf si c'est notre propre copie (elle garde alors sa position d'origine).
#[cfg(not(target_arch = "wasm32"))]
fn read_system_clipboard(st: &mut State) {
    if let Ok(img) = arboard::Clipboard::new().and_then(|mut cb| cb.get_image()) {
        let ours = st.clipboard.as_ref().is_some_and(|c| c.w == img.width && c.h == img.height && c.px[..] == img.bytes[..]);
        if !ours {
            st.clipboard = Some(Clip { w: img.width, h: img.height, px: img.bytes.into_owned(), origin: None });
        }
    }
}

fn paste(app: &AppWindow, st: &mut State) {
    #[cfg(target_arch = "wasm32")]
    {
        let _ = st;
        web_paste(app, false);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        read_system_clipboard(st);
        let Some(c) = st.clipboard.clone() else {
            status(app, "Presse-papiers vide");
            return;
        };
        paste_clips(app, st, vec![(c, "Coller", None)]);
    }
}

/// Coller dans une nouvelle image (Ctrl+Alt+V, comme Paint.NET).
fn paste_new_image(app: &AppWindow, st: &mut State) {
    #[cfg(target_arch = "wasm32")]
    {
        let _ = st;
        web_paste(app, true);
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        read_system_clipboard(st);
        let Some(c) = st.clipboard.clone() else {
            status(app, "Le presse-papiers ne contient pas d'image utilisable.");
            return;
        };
        paste_as_new_image(app, st, c);
    }
}

fn paste_as_new_image(app: &AppWindow, st: &mut State, c: Clip) {
    let n = if st.empty { 1 } else { st.tabs.len() + 1 };
    let mut doc = Doc::from_pixels(c.w, c.h, c.px, &i18n::tr_format!("Sans titre {n}"));
    doc.saved = (usize::MAX, 0);
    set_document(app, st, doc);
}

/// Colle des images en calques ; si l'une dépasse la toile, demande d'abord s'il faut
/// l'agrandir (Paint.NET : « L'image collée est plus grande que la toile »).
fn paste_clips(app: &AppWindow, st: &mut State, clips: Vec<(Clip, &'static str, Option<String>)>) {
    // aucun projet ouvert : chaque image collée devient un projet
    if st.empty {
        for (c, _, _) in clips {
            paste_as_new_image(app, st, c);
        }
        return;
    }
    // image venue de l'extérieur (pas copiée dans MasterPaint) : première question, où la mettre
    if app.get_set_paste_ask() && clips[0].1 == "Coller" && clips.iter().all(|(c, _, _)| c.origin.is_none()) {
        let one = clips.len() == 1;
        let thumbs = clips.iter().take(1).map(|(c, _, n)| TaskThumb { name: n.clone().unwrap_or_default().into(), image: px_thumb(&c.px, c.w, c.h, 180, 135) }).collect();
        st.task = Some(Task::PasteWhere(clips));
        show_task(
            app,
            "Coller",
            if one { "Où voulez-vous coller cette image ?" } else { "Où voulez-vous coller ces images ?" },
            "",
            "",
            &[
                ("Dans un nouvel onglet", "Ouvre l'image collée comme une nouvelle image."),
                ("Dans l'image actuelle", "Ajoute l'image collée comme nouveau calque de l'image ouverte."),
                ("Annuler", "Annule le collage."),
            ],
            thumbs,
        );
        return;
    }
    paste_clips_here(app, st, clips);
}

/// Coller dans l'image actuelle : question de la taille si l'image dépasse la toile.
fn paste_clips_here(app: &AppWindow, st: &mut State, clips: Vec<(Clip, &'static str, Option<String>)>) {
    if clips.iter().any(|(c, _, _)| c.w > st.doc.w || c.h > st.doc.h) {
        let title = if clips[0].1 == "Coller" { "Coller" } else { "Importer en calque" };
        let intro = if clips.len() > 1 {
            "Des images à coller sont plus grandes que la toile. Que voulez-vous faire ?"
        } else {
            "L'image collée est plus grande que la toile. Que voulez-vous faire ?"
        };
        let thumbs = clips.iter().take(1).map(|(c, _, n)| TaskThumb { name: n.clone().unwrap_or_default().into(), image: px_thumb(&c.px, c.w, c.h, 180, 135) }).collect();
        st.task = Some(Task::Paste(clips));
        show_task(
            app,
            title,
            intro,
            "",
            "",
            &[
                ("Agrandir la toile", "Agrandit automatiquement la toile pour contenir l'image collée."),
                (
                    "Conserver la taille de la toile",
                    "N'agrandit pas la toile. Il faudra déplacer l'image collée pour que la partie voulue soit dans les limites de la toile.",
                ),
                ("Annuler", "Annule le collage."),
            ],
            thumbs,
        );
        return;
    }
    for (c, label, name) in clips {
        paste_pixels(app, st, &c, label, name.as_deref(), None);
    }
}

/// Colle des pixels dans un nouveau calque : en `at`, sinon à la position d'origine dans le
/// même document (comme Paint.NET), sinon centrés ; puis l'outil Déplacer présente les poignées.
fn paste_pixels(app: &AppWindow, st: &mut State, c: &Clip, label: &str, name: Option<&str>, at: Option<(isize, isize)>) {
    finish_edits(app, st);
    let (x, y) = match (at, c.origin) {
        (Some(p), _) => p,
        (None, Some((x, y, doc))) if doc == st.doc.uid => (x, y),
        _ => ((st.doc.w as isize - c.w as isize) / 2, (st.doc.h as isize - c.h as isize) / 2),
    };
    let mut px = std::borrow::Cow::Borrowed(&c.px[..]);
    if st.doc.mode != ColorMode::Rgb {
        st.doc.mode.constrain(px.to_mut());
    }
    // Coller (pas Importer) dans le calque actif si les Paramètres le demandent : pixels
    // flottants déplaçables, reposés au changement d'outil ou avec Entrée
    if label == "Coller" && app.get_set_paste_mode() == 1 && st.doc.mask_of.is_none() {
        // outil Déplacer d'abord, sans sélection : il ne soulève rien du calque
        st.doc.sel = None;
        set_tool(app, st, "tool-move");
        let f = transform::Floating::pasted(&st.doc, x, y, c.w, c.h, &px);
        f.render(&mut st.doc);
        st.doc.commit(label);
        st.floating = Some(f);
        refresh_all(app, st);
        show_handles(app, st);
        return;
    }
    st.doc.paste(x, y, c.w, c.h, &px);
    if let Some(n) = name {
        st.doc.layer_mut().name = n.to_string();
    }
    st.doc.commit(label);
    set_tool(app, st, "tool-move");
    refresh_all(app, st);
}

// ------------------------------------------------------------------ glisser-déposer

/// Fichier déposé sur la fenêtre : projet .illu ouvert directement ; image : choix entre un
/// nouvel onglet et un nouveau calque du document courant (comme la version web).
fn dropped_file(app: &AppWindow, st: &mut State, name: String, bytes: Vec<u8>) {
    // Mode Photo Pro ouvert : la photo déposée rejoint sa pellicule
    if app.get_pm_open() && !is_project_file(&name) {
        return pm_add(app, st, vec![(name, bytes)]);
    }
    if open_animated_gif(app, st, &name, &bytes) {
        return;
    }
    // aucun projet ouvert : pas de « nouveau calque » possible, l'image est ouverte
    if st.empty || raw::is_raw(&name) || is_project_file(&name) {
        return start_load(app, st, LoadTo::Tabs, vec![(name, bytes)]);
    }
    start_load(app, st, LoadTo::Drop, vec![(name, bytes)]);
}

/// Image déposée et décodée : fenêtre de choix (nouvel onglet ou nouveau calque).
fn dropped_pixels(app: &AppWindow, st: &mut State, name: String, w: usize, h: usize, px: Vec<u8>) {
    // plusieurs fichiers déposés d'un coup arrivent un par un : la fenêtre ouverte s'enrichit
    let mut files = match st.task.take() {
        Some(Task::Drop(v)) => v,
        Some(other) => {
            st.task = Some(other);
            return;
        }
        None => Vec::new(),
    };
    files.push((name, w, h, px));
    let n = files.len();
    let thumbs: Vec<TaskThumb> = files.iter().map(|(name, w, h, px)| TaskThumb { name: name.as_str().into(), image: px_thumb(px, *w, *h, 180, 135) }).collect();
    st.task = Some(Task::Drop(files));
    let one = n == 1;
    show_task(
        app,
        "Glisser-déposer",
        if one { "Que voulez-vous faire avec le fichier ?" } else { "Que voulez-vous faire avec les fichiers ?" },
        "",
        if one { "" } else { "Fichiers" },
        &[
            ("Ouvrir", if one { "Ouvre l'image dans un nouvel onglet." } else { "Ouvre chaque image dans un nouvel onglet." }),
            (
                if one { "Ajouter comme calque" } else { "Ajouter comme calques" },
                if one {
                    "Charge l'image et l'ajoute comme nouveau calque de l'image actuelle."
                } else {
                    "Charge les images et les ajoute comme nouveaux calques de l'image actuelle."
                },
            ),
        ],
        thumbs,
    );
}

// ------------------------------------------------------------------ effets

/// Calcule un effet du moteur sur le calque `base` (fondu dans la sélection).
fn compute_effect(doc: &Doc, base: &[u8], name: &str, params: &[f32]) -> Option<Vec<u8>> {
    effect_pixels(doc.w, doc.h, doc.sel.as_deref(), base, name, params, &effects::Vals::default(), 0, doc.mode)
}

/// Effet appliqué directement (sans fenêtre de réglages) ou répété (Ctrl+F) : calculé en
/// arrière-plan, l'interface reste libre.
fn run_effect(app: &AppWindow, st: &mut State, name: &str, params: &[f32], label: &str) {
    // répétition de l'ASCII (Ctrl+F) : derniers réglages de la fenêtre
    let vals = if name == "ascii" { st.effect_memory.get("ascii").cloned().unwrap_or_default() } else { effects::Vals::default() };
    run_effect_with(app, st, name, params, label, vals, 0);
    st.last_effect_vals = None;
}

thread_local! {
    /// libellé affiché de l'entrée Répéter du menu Effets (vide : celui d'origine)
    static REPEAT_LABEL: RefCell<String> = const { RefCell::new(String::new()) };
}

/// Entrée Répéter du menu Effets : elle nomme le dernier effet utilisé.
fn sync_repeat_item(app: &AppWindow, st: &State) {
    let label = match &st.last_effect {
        Some((_, _, l)) => i18n::tr_format!("Répéter {}", i18n::tr(l).trim_end_matches('…').trim_end()),
        None => i18n::tr("Répéter le dernier effet"),
    };
    if REPEAT_LABEL.with(|r| *r.borrow() == label) {
        return;
    }
    REPEAT_LABEL.with(|r| r.borrow_mut().clone_from(&label));
    let menus = app.get_menus();
    for m in (0..menus.row_count()).filter_map(|i| menus.row_data(i)) {
        for j in 0..m.items.row_count() {
            let Some(mut it) = m.items.row_data(j) else { continue };
            if it.action.contains("illuRepeatLastEffect") {
                it.label = label.as_str().into();
                m.items.set_row_data(j, it);
            }
        }
    }
}

/// Répéter (Ctrl+F, menu) : dernier effet avec tous les réglages de sa fenêtre (aberration
/// chromatique comprise) et sa portée.
fn repeat_effect(app: &AppWindow, st: &mut State) {
    let Some((n, p, l)) = st.last_effect.clone() else {
        return status(app, "Aucun effet à répéter : appliquez d'abord un effet");
    };
    match st.last_effect_vals.clone() {
        Some((vals, scope)) => run_effect_with(app, st, &n, &p, &l, vals, scope),
        None => run_effect(app, st, &n, &p, &l),
    }
}

/// Calques visés par un effet (identifiant, pixels de départ) : le calque actif (`active` :
/// ses pixels d'origine, None = ne pas le recalculer) et, portée « Tous les calques » (2), les
/// autres calques dessinés (ni dossiers ni calques verrouillés). `bases` : pixels d'origine
/// déjà retenus (aperçu de la fenêtre d'effet posé sur les autres calques).
fn effect_targets(st: &State, scope: i32, active: Option<editor::Px>, bases: &[(u64, editor::Px)]) -> Vec<(u64, editor::Px)> {
    let mut v = Vec::new();
    if scope == 2 {
        let n = st.doc.w * st.doc.h * 4;
        for (i, l) in st.doc.layers.iter().enumerate() {
            if i == st.doc.active || l.group || l.locked || l.px.len() != n {
                continue;
            }
            let px = bases.iter().find(|b| b.0 == l.uid).map(|b| b.1.clone()).unwrap_or_else(|| l.px.clone());
            v.push((l.uid, px));
        }
    }
    if let Some(px) = active {
        v.push((st.doc.layer().uid, px));
    }
    v
}

#[allow(clippy::too_many_arguments)]
fn run_effect_with(app: &AppWindow, st: &mut State, name: &str, params: &[f32], label: &str, vals: effects::Vals, scope: i32) {
    // Auto-niveau : réglage automatique du Mode Photo Pro (scène, exposition, contraste, blancs /
    // noirs, dominante) appliqué par Camera Raw, au lieu d'un simple étirement d'histogramme
    if name == "autolevel" {
        let (w, h) = (st.doc.w, st.doc.h);
        let px = st.doc.layer().px.clone();
        if px.len() == w * h * 4 {
            let (p, note) = scene::auto_camera_raw(&px, w, h);
            // libellé fixe (pas celui, traduit, du menu) : l'historique regroupe les répétitions
            let _ = label;
            run_effect_with(app, st, "cameraraw", &p, "Auto-niveau", vals, scope);
            status(app, note);
            return;
        }
    }
    // calque texte : effet ajouté à sa pile (non destructif)
    if scope != 2 && vector_layer_effect(app, st, name, params, effects::post_chromatic(name, &vals), label) {
        return;
    }
    // calque dynamique : effet ajouté à sa pile (ses pixels ne sont que la zone de l'effet)
    if scope != 2 && dynamic_layer_effect(app, st, name, params, label, "", &vals) {
        return;
    }
    let sec = rgba(app.get_secondary_color());
    let targets = effect_targets(st, scope, Some(st.doc.layer().px.clone()), &[]);
    let total = targets.len();
    let ctx = ApplyCtx {
        title: label.to_string(),
        name: name.to_string(),
        p: params.to_vec(),
        vals: vals.clone(),
        secondary: (sec[0] as u32) << 16 | (sec[1] as u32) << 8 | sec[2] as u32,
        // portée « Calque actif » : la sélection est ignorée
        sel: if scope == 1 { None } else { st.doc.sel.clone() },
        uid: st.doc.uid,
        targets,
        total,
        applied: 0,
        t0: now_ms(),
    };
    st.last_effect = Some((name.into(), params.to_vec(), label.into()));
    st.last_effect_vals = Some((vals, scope));
    begin_busy(app, label, "Calcul de l'effet…", st.doc.w * st.doc.h > 1_000_000 || total > 1);
    apply_next(app, st, ctx);
}

/// Effet à appliquer en pleine résolution à un ou plusieurs calques, l'un après l'autre.
struct ApplyCtx {
    title: String,
    name: String,
    p: Vec<f32>,
    vals: effects::Vals,
    secondary: u32,
    sel: Option<Vec<u8>>,
    /// document concerné (un changement d'onglet entre-temps abandonne l'application)
    uid: u64,
    /// calques visés : identifiant (`Layer::uid`, sûr même si l'ordre change) et pixels de départ
    targets: Vec<(u64, editor::Px)>,
    total: usize,
    applied: usize,
    t0: f64,
}

/// Calque suivant de `ctx` en arrière-plan ; à la fin, une étape d'historique.
fn apply_next(app: &AppWindow, st: &mut State, mut ctx: ApplyCtx) {
    let Some((layer, base)) = ctx.targets.pop() else {
        end_busy(app);
        if ctx.applied == 0 && ctx.total > 0 {
            status(app, i18n::tr_format!("{} : effet indisponible dans le moteur Rust", ctx.title));
            return;
        }
        st.doc.commit(&ctx.title);
        refresh_all(app, st);
        status(app, i18n::tr_format!("{} : {:.0} ms", ctx.title, now_ms() - ctx.t0));
        return;
    };
    if ctx.total > 1 {
        load_progress(app, (ctx.total - ctx.targets.len()) as f32 / ctx.total as f32, &i18n::tr_format!("Calque {} sur {}", ctx.total - ctx.targets.len(), ctx.total));
    }
    let (w, h, mode) = (st.doc.w, st.doc.h, st.doc.mode);
    let src = base.arc();
    // même tâche que l'aperçu (art ASCII sur place, sinon effet en arrière-plan)
    let job = preview_job(&ctx.name, src.clone(), w, h, &ctx.p, effects::post_chromatic(&ctx.name, &ctx.vals), &ctx.vals, ctx.secondary);
    background::spawn(app, st, job, move |app, st, out| {
        if st.doc.uid != ctx.uid || st.doc.w != w || st.doc.h != h {
            end_busy(app);
            status(app, i18n::tr_format!("{} : abandonné (l'image a changé)", ctx.title));
            return;
        }
        if let Some(mut px) = out {
            mode.constrain(&mut px);
            blend_selection(&mut px, &src, ctx.sel.as_deref());
            let as_mask = effects::chroma_as_mask(&ctx.name, &ctx.vals);
            // incrustation dans un nouveau calque : au-dessus de l'original, masqué et intact
            if effects::chroma_to_layer(&ctx.name, &ctx.vals) {
                if let Some(k) = st.doc.layers.iter().position(|l| l.uid == layer) {
                    let mut nl = st.doc.layers[k].clone();
                    nl.uid = editor::next_uid();
                    nl.name = i18n::tr_format!("{} (incrusté)", nl.name);
                    nl.px = px.into();
                    nl.vector = None;
                    nl.locked = false;
                    let orig = &mut st.doc.layers[k];
                    orig.px = base;
                    orig.visible = false;
                    st.doc.layers.insert(k + 1, nl);
                    if st.doc.active >= k {
                        st.doc.active += 1;
                    }
                    ctx.applied += 1;
                }
                return apply_next(app, st, ctx);
            }
            if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == layer) {
                if as_mask && l.dynamic.is_none() {
                    // incrustation en masque α lié : pixels intacts, transparence dans le masque
                    let mut mk = l.mask.as_ref().map(|k| k.to_vec()).unwrap_or_else(|| vec![255u8; w * h]);
                    for (k, p) in mk.iter_mut().zip(px.chunks_exact(4).zip(src.chunks_exact(4))) {
                        let (a, a0) = (p.0[3] as u32, p.1[3].max(1) as u32);
                        *k = (*k as u32 * (a * 255 / a0).min(255) / 255) as u8;
                    }
                    l.mask = Some(mk.into());
                    l.px = base;
                } else {
                    l.px = px.into();
                }
                ctx.applied += 1;
            }
        }
        apply_next(app, st, ctx);
    });
}

/// Fenêtre de progression pendant un calcul en arrière-plan (`show` : grande image).
fn begin_busy(app: &AppWindow, title: &str, detail: &str, show: bool) {
    LOADS_ACTIVE.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    if show {
        app.set_load_title(i18n::tr(title).into());
        load_progress(app, 0.6, detail);
        app.set_loading(true);
    }
}

fn end_busy(app: &AppWindow) {
    use std::sync::atomic::Ordering::Relaxed;
    if LOADS_ACTIVE.load(Relaxed) > 0 && LOADS_ACTIVE.fetch_sub(1, Relaxed) == 1 {
        app.set_loading(false);
    }
}

/// Fenêtre d'effet ouverte : valeurs, calque d'origine (pour Annuler) et aperçu.
struct EffectSession {
    id: String,
    title: String,
    fields: &'static [effects::Field],
    vals: effects::Vals,
    base: editor::Px,
    seed: u32,
    /// premier numéro d'aperçu de cette fenêtre, dernier demandé, dernier affiché (voir PREVIEW_GEN)
    first: u64,
    want: u64,
    shown: u64,
    /// calcul en cours dans un autre fil (bureau), et réglage changé entre-temps
    running: bool,
    queued: bool,
    /// lignes affichées (sections, champs, couleurs R/V/B) et sections repliées
    rows: Vec<RowRef>,
    folded: std::collections::HashSet<&'static str>,
    /// pipette en attente d'un clic sur la toile (ligne concernée)
    pick: Option<usize>,
    /// l'aperçu affiché ne couvre que la zone visible (grande image) : recalcul complet à OK
    partial: bool,
    /// pas de l'aperçu affiché (1 = pleine résolution ; plus : aperçu réduit d'une grande image)
    lod: usize,
    /// zone où le calque affiché diffère de l'original (aperçu de la zone visible) ; `None` :
    /// tout le calque. Un nouvel aperçu ne recompose que cette zone et la sienne.
    shown_rect: Option<(usize, usize, usize, usize)>,
    /// l'aperçu affiché est l'image réduite elle-même (voir `apply_direct_preview`) : la toile ne
    /// doit pas être recomposée depuis les calques tant qu'il est là
    direct: bool,
    /// calques réduits pour cet aperçu (pas, calques)
    reduced_layers: Option<(usize, Vec<editor::Layer>)>,
    /// calque (et sélection) réduits pour l'aperçu réduit : (pas, pixels, sélection, l, h)
    reduced: Option<(usize, std::sync::Arc<Vec<u8>>, Option<Vec<u8>>, usize, usize)>,
    /// portée « Tous les calques » : pixels d'origine des autres calques (identifiant, pixels),
    /// l'aperçu y étant aussi posé ; remis en place à Annuler ou en changeant de portée
    others: Vec<(u64, editor::Px)>,
}

/// Ligne de la fenêtre d'effet : titre de section, champ, ou couleur faite de trois champs R / V / B.
#[derive(Clone, Copy)]
enum RowRef {
    Head(&'static str),
    Field(usize),
    Rgb([usize; 3]),
}

/// Section d'un champ (groupes des fenêtres HTML) et si elle est repliée au départ.
fn section_of(effect: &str, field: &str) -> Option<(&'static str, bool)> {
    effects::own_sections(effect).unwrap_or(effects_gen::SECTIONS).iter().find(|s| s.0 == effect && s.1 == field).map(|s| (s.2, s.3))
}

/// Trois curseurs 0..255 dont les identifiants ne diffèrent que par r / g / b : une couleur.
fn rgb_trio(f: &[effects::Field], i: usize) -> Option<[usize; 3]> {
    let ok = |k: usize| f.get(k).is_some_and(|x| x.kind == 0 && x.min == 0.0 && x.max == 255.0);
    if !(ok(i) && ok(i + 1) && ok(i + 2)) {
        return None;
    }
    let id = f[i].id;
    let p = id.rfind('r')?;
    let with = |c: &str| format!("{}{}{}", &id[..p], c, &id[p + 1..]);
    (f[i + 1].id == with("g") && f[i + 2].id == with("b")).then_some([i, i + 1, i + 2])
}

fn build_rows(es: &EffectSession) -> Vec<RowRef> {
    let f = es.fields;
    let mut out = Vec::new();
    let mut cur: Option<&'static str> = None;
    let mut i = 0;
    while i < f.len() {
        let sec = section_of(&es.id, f[i].id).map(|s| s.0);
        if sec != cur {
            if let Some(s) = sec {
                out.push(RowRef::Head(s));
            }
            cur = sec;
        }
        if sec.is_some_and(|s| es.folded.contains(s)) {
            i += 1;
            continue;
        }
        if let Some(t) = rgb_trio(f, i) {
            out.push(RowRef::Rgb(t));
            // fenêtres compactes (incrustation) : la ligne couleur seule (hexa + pipette)
            if !effects::compact_colors(&es.id) {
                out.extend(t.map(RowRef::Field));
            }
            i += 3;
            continue;
        }
        out.push(RowRef::Field(i));
        i += 1;
    }
    out
}

/// Dégradé de la piste d'un curseur d'après ce qu'il règle : (type, début, fin).
fn slider_track(f: &effects::Field) -> (i32, Color, Color) {
    let l = f.label.to_lowercase();
    let id = f.id;
    let c = |h: u32| Color::from_rgb_u8((h >> 16) as u8, (h >> 8) as u8, h as u8);
    let has = |k: &str| l.contains(k) || id.contains(k);
    if (has("teinte") || has("hue")) && !l.contains("teinte r") && !l.contains("teinte v") && !l.contains("teinte b") && (f.max - f.min) >= 180.0 {
        (2, c(0), c(0))
    } else if has("tint") || (has("teinte") && (id.contains("tt-") || id.contains("cr-") || id.contains("bc-"))) {
        (1, c(0x22c55e), c(0xd946ef))
    } else if has("temp") || has("chaleur") {
        (1, c(0x3b82f6), c(0xf59e0b))
    } else if has("satur") || has("vibr") || has("chroma_saturation") {
        (1, c(0x8a8a8a), c(0xff3b30))
    } else if has("contraste") || has("contrast") {
        (1, c(0x9a9a9a), c(0x000000))
    } else if has("lumin") || has("bright") || has("expos") || has("gamma") || l == "noirs" || l == "blancs" || has("ombres") || has("lumière") {
        (1, c(0x000000), c(0xffffff))
    } else if has("opacit") || has("alpha") || has("transparen") {
        (1, c(0xf0f0f0), c(0x303030))
    } else {
        (0, c(0), c(0))
    }
}

/// Lignes de la fenêtre d'effet (modèle de l'interface).
fn effect_rows(app: &AppWindow, es: &EffectSession) -> Vec<EffectField> {
    let primary = app.get_primary_color();
    let num = |fi: usize| {
        let f = &es.fields[fi];
        es.vals.0.get(f.id).and_then(|s| s.replace(',', ".").parse::<f32>().ok()).unwrap_or(f.def)
    };
    let blank = |kind: i32, label: String| EffectField {
        label: label.into(),
        kind,
        minimum: 0.0,
        maximum: 1.0,
        step: 1.0,
        value: 0.0,
        text: SharedString::default(),
        options: ModelRc::default(),
        default_value: 0.0,
        swatch: primary,
        section: SharedString::default(),
        collapsed: false,
        track_kind: 0,
        track_a: primary,
        track_b: primary,
        angle: false,
    };
    // couleur de chaque trio (pour l'aperçu et les dégradés des curseurs R / V / B)
    let mut trio_of = std::collections::HashMap::new();
    for r in &es.rows {
        if let RowRef::Rgb(t) = r {
            let rgb = t.map(|k| num(k).round().clamp(0.0, 255.0) as u8);
            for (ch, k) in t.iter().enumerate() {
                trio_of.insert(*k, (rgb, ch));
            }
        }
    }
    let mut nth_trio = 0;
    es.rows
        .iter()
        .map(|r| match *r {
            RowRef::Head(sec) => EffectField { section: i18n::tr(sec).into(), collapsed: es.folded.contains(sec), ..blank(5, String::new()) },
            RowRef::Rgb(t) => {
                let rgb = t.map(|k| num(k).round().clamp(0.0, 255.0) as u8);
                nth_trio += 1;
                let label = match (effects::color_label(&es.id, es.fields[t[0]].id), nth_trio) {
                    (Some(l), _) => i18n::tr(l),
                    (None, 1) => i18n::tr("Couleur"),
                    (None, n) => format!("{} {n}", i18n::tr("Couleur")),
                };
                EffectField {
                    swatch: Color::from_rgb_u8(rgb[0], rgb[1], rgb[2]),
                    text: format!("#{:02X}{:02X}{:02X}", rgb[0], rgb[1], rgb[2]).into(),
                    ..blank(6, label)
                }
            }
            RowRef::Field(fi) => {
                let f = &es.fields[fi];
                let s = es.vals.0.get(f.id).cloned().unwrap_or_default();
                let value = match f.kind {
                    2 => f.options.iter().position(|o| o.0 == s).unwrap_or(0) as f32,
                    3 | 4 => 0.0,
                    _ => s.replace(',', ".").parse::<f32>().unwrap_or(f.def),
                };
                let swatch = u32::from_str_radix(s.trim_start_matches('#'), 16)
                    .map(|v| Color::from_rgb_u8((v >> 16) as u8, (v >> 8) as u8, v as u8))
                    .unwrap_or(primary);
                let (track_kind, track_a, track_b) = match trio_of.get(&fi) {
                    // canal d'une couleur : de 0 à 255 sur ce canal, les deux autres inchangés
                    Some((rgb, ch)) => {
                        let mut a = *rgb;
                        let mut b = *rgb;
                        a[*ch] = 0;
                        b[*ch] = 255;
                        (1, Color::from_rgb_u8(a[0], a[1], a[2]), Color::from_rgb_u8(b[0], b[1], b[2]))
                    }
                    None if f.kind == 0 => slider_track(f),
                    None => (0, primary, primary),
                };
                EffectField {
                    label: SharedString::from(i18n::tr(f.label)),
                    kind: f.kind as i32,
                    minimum: f.min,
                    maximum: f.max,
                    step: f.step,
                    value,
                    // bouton (kind 7) : son libellé
                    text: if f.kind == 7 { SharedString::from(i18n::tr(f.def_s)) } else { SharedString::from(s) },
                    options: ModelRc::new(VecModel::from(f.options.iter().map(|o| SharedString::from(i18n::tr(o.1))).collect::<Vec<_>>())),
                    default_value: f.def,
                    swatch,
                    section: SharedString::default(),
                    collapsed: false,
                    track_kind,
                    track_a,
                    track_b,
                    angle: f.kind == 0 && effects::is_angle(f),
                }
            }
        })
        .collect()
}

/// Valeur choisie à la pipette (ou saisie en hexa) pour une ligne couleur.
fn set_row_color(es: &mut EffectSession, row: usize, c: [u8; 3]) {
    match es.rows.get(row) {
        Some(RowRef::Rgb(t)) => {
            for (k, fi) in t.iter().enumerate() {
                es.vals.0.insert(es.fields[*fi].id.to_string(), c[k].to_string());
            }
        }
        Some(RowRef::Field(fi)) => {
            es.vals.0.insert(es.fields[*fi].id.to_string(), format!("#{:02x}{:02x}{:02x}", c[0], c[1], c[2]));
        }
        _ => {}
    }
}

/// Numéro des aperçus d'effet : un résultat plus ancien que le dernier demandé est ignoré.
static PREVIEW_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);

thread_local! {
    /// état de l'application, pour les résultats renvoyés au fil de l'interface
    static APP_STATE: RefCell<Option<Shared>> = const { RefCell::new(None) };
}

/// Fond d'un résultat dans la sélection (hors sélection : l'original).
fn blend_selection(px: &mut [u8], base: &[u8], sel: Option<&[u8]>) {
    let Some(m) = sel else { return };
    for (i, s) in m.iter().enumerate() {
        let s = *s as u32;
        if s == 255 {
            continue;
        }
        for k in 0..4 {
            let o = i * 4 + k;
            px[o] = ((px[o] as u32 * s + base[o] as u32 * (255 - s)) / 255) as u8;
        }
    }
}

/// Pixels d'un aperçu ou d'une application d'effet, ramenés dans l'espace de couleur du projet.
/// Ne touche pas à l'interface : peut tourner dans un autre fil (bureau).
#[allow(clippy::too_many_arguments)]
fn effect_pixels(w: usize, h: usize, sel: Option<&[u8]>, base: &[u8], name: &str, p: &[f32], vals: &effects::Vals, secondary: u32, mode: ColorMode) -> Option<Vec<u8>> {
    let engine = |src: &[u8], name: &str, p: &[f32]| {
        #[cfg(not(target_arch = "wasm32"))]
        {
            let threads = std::thread::available_parallelism().map(|n| n.get()).unwrap_or(4);
            masterpaint_core::apply_parallel(name, src, w, h, p, threads)
        }
        #[cfg(target_arch = "wasm32")]
        {
            masterpaint_core::apply_image(name, src, w, h, p)
        }
    };
    let mut px = if name == "ascii" { ascii::render(base, w, h, &effects::ascii_opts(vals, secondary)) } else { engine(base, name, p)? };
    if let Some(ca) = effects::post_chromatic(name, vals) {
        px = masterpaint_core::chromatic_post(base, &px, w, h, &ca);
    }
    mode.constrain(&mut px);
    blend_selection(&mut px, base, sel);
    Some(px)
}

/// Résultat d'aperçu reçu : affiché s'il est le dernier demandé ; relance si un réglage a changé.
fn apply_preview(app: &AppWindow, st: &mut State, gen: u64, px: Option<Vec<u8>>, ms: f64, lod: usize, region: Option<(usize, usize, usize, usize)>) {
    let (w, h) = (st.doc.w, st.doc.h);
    let Some(es) = st.effect.as_mut() else { return };
    if gen == es.want {
        es.running = false;
    }
    // un calcul lancé par une fenêtre d'effet précédente n'est jamais affiché ici
    let fresh = gen > es.shown && gen >= es.first;
    let queued = std::mem::take(&mut es.queued) && !es.running;
    if let (Some(px), true) = (px, fresh) {
        es.shown = gen;
        es.lod = lod;
        // retour d'un aperçu réduit (zoom avant) : toute la toile est à reposer
        let was_direct = std::mem::take(&mut es.direct);
        // zone visible seulement : recomposer l'ancienne zone d'aperçu et la nouvelle, pas
        // toute l'image (le reste du calque est resté l'original)
        let cur = if lod > 1 { None } else { region };
        let dirty = match (es.shown_rect, cur) {
            (Some(a), Some(b)) if a.2 <= a.0 || a.3 <= a.1 => b,
            (Some(a), Some(b)) => (a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3)),
            _ => (0, 0, w, h),
        };
        es.shown_rect = cur;
        st.doc.layer_mut().px = px.into();
        if was_direct {
            redraw_canvas(app, st);
        } else {
            refresh_rect(app, st, Some(dirty));
        }
        // aperçu réduit gardé pendant les réglages : la pleine résolution n'est calculée qu'à OK
        app.set_effect_info(SharedString::from(if lod > 1 { i18n::tr_format!("Aperçu réduit : {ms:.0} ms — pleine résolution à la validation") } else { i18n::tr_format!("Aperçu : {ms:.0} ms") }));
    }
    if queued {
        preview_effect(app, st);
    }
}

/// Ouvre un effet : fenêtre de réglages si l'effet en a une, sinon application directe.
fn open_effect(app: &AppWindow, st: &mut State, id: &str, label: &str) {
    open_effect_at(app,st,id,label,None);
}
fn open_effect_at(app: &AppWindow, st: &mut State, id: &str, label: &str, selected: Option<usize>) {
    drop_floating(app, st);
    if st.effect.is_some() {
        cancel_effect(app, st);
    }
    // réglage d'un calque dynamique : repart de sa pile actuelle (aperçu par la pile)
    st.dyn_fx = None;
    // calque verrouillé ou dossier : pas d'effet
    if let Some(why) = st.doc.edit_refusal() {
        status(app, why);
        return;
    }
    app.set_effect_dynamic_layer(st.doc.layer().dynamic.is_some());
    app.set_effect_dynamic_edit(false);
    if st.doc.layer().dynamic.is_some() {
        app.set_effect_scope(0);
        let found = st.doc.layer().dynamic.as_ref().and_then(|stack| selected.filter(|&i| stack.get(i).is_some_and(|(kind,_)|editor::fx_matches(kind,id))).or_else(||stack.iter().rposition(|(kind, _)| editor::fx_matches(kind,id))));
        st.dyn_pending_edit = found;
        if let Some(i) = found {
            let kind = st.doc.layer().dynamic.as_ref().unwrap()[i].0.clone();
            if effects::dialog(id).is_none() {
                st.doc.layer_mut().dynamic.as_mut().unwrap().remove(i);
                let uid = st.doc.layer().uid;
                dyn_invalidate(st, uid);
                st.doc.layer_mut().dyn_cache = None;
                st.doc.layer_mut().dyn_low = None;
                st.dyn_pending_edit = None;
                st.doc.commit("Supprimer");
                refresh_all(app, st);
                return;
            }
            if let Some((_, vals)) = editor::fx_dialog(&kind) {
                st.effect_memory.insert(id.into(), effects::Vals(vals));
            } else if let Some((_, fields)) = effects::dialog(id) {
                let mut vals = effects::Vals::defaults(fields);
                let radius = st.doc.layer().dynamic.as_ref().unwrap()[i].1;
                if let Some(field) = fields.iter().find(|f| f.kind == 0) {
                    vals.0.insert(field.id.into(), radius.clamp(field.min,field.max).to_string());
                }
                st.effect_memory.insert(id.into(),vals);
            }
            app.set_effect_dynamic_edit(true);
        }
    } else { st.dyn_pending_edit = None; }
    let label = label.trim_end_matches('…').trim_end_matches("...").trim().to_string();
    match effects::dialog(id) {
        None => {
            match effects::params(id, &effects::Vals::default(), 0xffffff, 1) {
                Some((name, p)) => run_effect(app, st, name, &p, &label),
                None => status(app, i18n::tr_format!("« {label} » : pas encore porté dans la version Rust")),
            }
        }
        Some((title, fields)) => {
            let mut vals = effects::Vals::defaults(fields);
            if let Some(saved) = st.effect_memory.get(id) {
                vals.0.extend(saved.0.clone());
            }
            let mut es = EffectSession {
                id: id.into(),
                title: title.into(),
                fields,
                vals,
                base: st.doc.layer().px.clone(),
                seed: (now_ms() as u64 as u32) | 1,
                first: PREVIEW_GEN.load(std::sync::atomic::Ordering::Relaxed),
                want: 0,
                shown: 0,
                running: false,
                queued: false,
                rows: Vec::new(),
                folded: effects::own_sections(id).unwrap_or(effects_gen::SECTIONS).iter().filter(|s| s.0 == id && s.3).map(|s| s.2).collect(),
                pick: None,
                partial: false,
                lod: 1,
                shown_rect: Some((0, 0, 0, 0)),
                direct: false,
                reduced_layers: None,
                reduced: None,
                others: Vec::new(),
            };
            es.rows = build_rows(&es);
            app.set_effect_title(SharedString::from(i18n::tr(title)));
            app.set_effect_fields(ModelRc::new(VecModel::from(effect_rows(app, &es))));
            app.set_show_effect(true);
            st.effect = Some(es);
            vecview::sync_mode(app, st);
            // la fenêtre s'affiche d'abord ; le premier aperçu (calcul lourd, surtout dans le
            // navigateur) suit juste après pour ne pas retarder son ouverture
            let weak = app.as_weak();
            let want = st.effect.as_ref().map(|e| e.id.clone());
            slint::Timer::single_shot(std::time::Duration::from_millis(30), move || {
                let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
                let Ok(mut st) = state.try_borrow_mut() else { return };
                if st.effect.as_ref().map(|e| e.id.clone()) == want {
                    preview_effect(&app, &mut st);
                }
            });
        }
    }
}

/// Aperçu en direct sur la toile (le calque est restauré si on annule), calculé en arrière-plan
/// (autre fil sur le bureau, worker dans le navigateur) : l'interface reste fluide pendant qu'on
/// règle un curseur ; un seul calcul à la fois, le dernier réglage gagne. Grande image vue de
/// loin : d'abord à la résolution de l'affichage (réglages en pixels mis à l'échelle), puis en
/// pleine résolution après une courte pause.
fn preview_effect(app: &AppWindow, st: &mut State) {
    preview_effect_at(app, st, false);
}

/// Au-delà de ce nombre de pixels, une image vue de loin a un aperçu réduit.
const LOD_MIN: usize = 1_500_000;
/// Pixels calculés au plus pour l'aperçu d'un effet sur l'image entière (le rendu complet ne se
/// fait qu'à OK) : 17 Mpx → pas de 4 dans le navigateur.
#[cfg(target_arch = "wasm32")]
const PREVIEW_BUDGET: usize = 1_500_000;
#[cfg(not(target_arch = "wasm32"))]
const PREVIEW_BUDGET: usize = 4_000_000;

/// Pas de l'aperçu d'un effet : un pixel d'aperçu par pixel de l'écran, rien de plus (une photo
/// de 5472 px vue à 19 % n'occupe que 1040 px à l'écran).
fn preview_lod(app: &AppWindow, w: usize, h: usize) -> usize {
    if w * h < LOD_MIN {
        return 1;
    }
    let eff = app.get_zoom() * app.window().scale_factor();
    ((1.0 / eff.max(0.01)).floor() as usize).clamp(1, 64)
}

/// La toile affiche une image réduite posée directement (aperçu d'effet, réglage d'un dégradé) : ne
/// pas la recomposer depuis les calques tant qu'elle est là.
fn direct_canvas(st: &State) -> bool {
    st.effect.as_ref().is_some_and(|e| e.direct) || st.grad_live.as_ref().is_some_and(|g| g.direct)
}

/// Calques du document réduits à sw × sh, sans le contenu du calque actif (l'aperçu le remplace).
fn reduced_layers(doc: &Doc, sw: usize, sh: usize) -> Vec<editor::Layer> {
    let (w, h, active) = (doc.w, doc.h, doc.active);
    doc.layers
        .iter()
        .enumerate()
        .map(|(i, l)| {
            let mut c = l.clone();
            c.cels.clear();
            c.vector = None;
            c.dyn_cache = None;
            c.dyn_low = None;
            c.px = if i == active || l.group { vec![0u8; sw * sh * 4].into() } else { photo::crop_resize::<u8, 4>(&l.px, w, (0, 0, w, h), sw, sh).into() };
            c.mask = l.mask.as_ref().filter(|m| m.len() == w * h).map(|m| photo::crop_resize::<u8, 1>(m, w, (0, 0, w, h), sw, sh).into());
            c
        })
        .collect()
}

/// Compose l'aperçu du calque actif avec les autres calques réduits et le pose sur la toile.
fn show_reduced(app: &AppWindow, st: &mut State, layers: &mut [editor::Layer], px: Vec<u8>, sw: usize, sh: usize) {
    let active = st.doc.active;
    layers[active].px = px.into();
    let shown = if layers.len() == 1 && layers[0].opacity >= 1.0 && layers[0].mask.is_none() {
        None
    } else {
        let mut d = Doc::scratch(sw, sh, layers.to_vec());
        d.active = active;
        Some(d.flatten())
    };
    let img = to_image(shown.as_deref().unwrap_or(&layers[active].px), sw, sh);
    st.tile_index.clear();
    st.tile_ok.clear();
    st.tiles.set_vec(Vec::new());
    app.set_canvas_image(img);
}

/// Aperçu réduit prêt : composé avec les autres calques à sa taille et affiché directement. Les
/// calques ne sont pas touchés : aucun agrandissement à la taille de l'image, aucune recomposition
/// de ses millions de pixels.
fn apply_direct_preview(app: &AppWindow, st: &mut State, gen: u64, small: Option<Vec<u8>>, ms: f64, lod: usize, (sw, sh): (usize, usize)) {
    let Some(es) = st.effect.as_mut() else { return };
    if gen == es.want {
        es.running = false;
    }
    let fresh = gen > es.shown && gen >= es.first;
    let queued = std::mem::take(&mut es.queued) && !es.running;
    if let (Some(px), true) = (small, fresh) {
        es.shown = gen;
        es.lod = lod;
        es.shown_rect = None;
        es.direct = true;
        // autres calques réduits une fois pour toutes, le temps de la fenêtre
        if es.reduced_layers.as_ref().is_none_or(|r| r.0 != lod) {
            es.reduced_layers = Some((lod, reduced_layers(&st.doc, sw, sh)));
        }
        let Some((_, mut layers)) = es.reduced_layers.take() else { return };
        show_reduced(app, st, &mut layers, px, sw, sh);
        if let Some(es) = st.effect.as_mut() {
            es.reduced_layers = Some((lod, layers));
        }
        app.set_effect_info(SharedString::from(i18n::tr_format!("Aperçu à la taille affichée : {ms:.0} ms — pleine résolution à la validation")));
    }
    if queued {
        preview_effect(app, st);
    }
}

fn preview_effect_at(app: &AppWindow, st: &mut State, full: bool) {
    vecview::sync_mode(app, st);
    let sec = rgba(app.get_secondary_color());
    let secondary = (sec[0] as u32) << 16 | (sec[1] as u32) << 8 | sec[2] as u32;
    // portée « Calque actif » : l'effet ignore la sélection
    let sel = if app.get_effect_scope() == 1 { None } else { st.doc.sel.clone() };
    let (w, h, mode, ds) = (st.doc.w, st.doc.h, st.doc.mode, st.ds);
    // calque dynamique : aperçu par sa pile (l'effet y est inséré), ses pixels restent la zone
    if app.get_effect_scope() != 2 && st.doc.layer().dynamic.is_some() {
        let kind = st.effect.as_ref().and_then(|es| {
            let (name, p) = effects::params(&es.id, &es.vals, secondary, es.seed)?;
            dyn_effect_allowed(name).then(|| editor::fx_kind(name, &p, &es.title, &es.id, &es.vals.0))
        });
        if let Some(kind) = kind {
            if dyn_preview(app, st, kind) {
                return;
            }
        }
    }
    let Some(es) = st.effect.as_mut() else { return };
    let Some((name, p)) = effects::params(&es.id, &es.vals, secondary, es.seed) else {
        app.set_effect_info(SharedString::from(i18n::tr(if SPECIAL_DIALOGS.contains(&es.id.as_str()) {
            "Appliqué à la validation (OK)"
        } else {
            "Aperçu indisponible : effet pas encore porté en Rust"
        })));
        return;
    };
    if es.running {
        es.queued = true;
        return;
    }
    // pas réduit choisi pour garder les réglages de grille exacts (carreaux de Pixeliser…) :
    // l'aperçu a les mêmes proportions que le rendu final. Il suit aussi la résolution de rendu
    // du projet (÷2 ÷4 ÷8, groupe Affichage) : avant, elle était ignorée par les effets du menu.
    let _ = ds;
    let want = preview_lod(app, w, h).max(st.doc.effective_div().max(1));
    let mut lod = if full || want < 2 { 1 } else { effects::preview_step(es.fields, &es.vals, want) };
    // grande image vue de près + effet local : seule la zone visible (et une marge) est calculée,
    // en pleine résolution. Vue de loin, l'image réduite entière : avant, une zone visible
    // trouvée forçait la pleine résolution (des millions de pixels, plusieurs secondes).
    let region = if lod == 1 { visible_region(app, w, h, name, &p) } else { None };
    // plafond de l'aperçu : jamais plus de PREVIEW_BUDGET pixels calculés par réglage
    if !full && lod == 1 && region.is_none() && w * h > PREVIEW_BUDGET {
        let k = ((w * h) as f64 / PREVIEW_BUDGET as f64).sqrt().ceil() as usize;
        lod = effects::preview_step(es.fields, &es.vals, k.max(2));
    }
    let (name, p, vals) = if lod > 1 {
        let v = effects::scale_px(es.fields, &es.vals, 1.0 / lod as f32);
        match effects::params(&es.id, &v, secondary, es.seed) {
            Some((n, p)) => (n, p, v),
            None => return,
        }
    } else {
        (name, p, es.vals.clone())
    };
    let gen = PREVIEW_GEN.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    es.want = gen;
    es.running = true;
    es.partial = region.is_some();
    // portée « Tous les calques » : même aperçu sur les autres calques (voir plus bas)
    let all_layers = app.get_effect_scope() == 2;
    let sel_others = if all_layers { sel.clone() } else { None };
    let (src, ssel, sw, sh) = if lod > 1 {
        if es.reduced.as_ref().map_or(true, |r| r.0 != lod) {
            let (sw, sh) = (w.div_ceil(lod), h.div_ceil(lod));
            let src = std::sync::Arc::new(photo::crop_resize::<u8, 4>(&es.base, w, (0, 0, w, h), sw, sh));
            let ssel = sel.as_ref().map(|m| photo::crop_resize::<u8, 1>(m, w, (0, 0, w, h), sw, sh));
            es.reduced = Some((lod, src, ssel, sw, sh));
        }
        let r = es.reduced.as_ref().expect("aperçu réduit");
        (r.1.clone(), r.2.clone(), r.3, r.4)
    } else if region.is_some() {
        // zone visible : même découpe que pour les autres calques
        preview_source(&es.base, sel.as_deref(), w, h, 1, region)
    } else {
        (es.base.arc(), sel, w, h)
    };
    let base = es.base.clone();
    let post = effects::post_chromatic(name, &vals);
    let job = preview_job(name, src.clone(), sw, sh, &p, post.clone(), &vals, secondary);
    let t0 = now_ms();
    // aperçu réduit : affiché tel quel, à sa taille ; le calque garde ses pixels jusqu'à OK
    // (le contenu « Hors toile » n'est pas visible : il ne gêne pas l'aperçu réduit)
    let direct = lod > 1 && !all_layers && !st.doc.layers.iter().any(|l| l.dynamic.is_some());
    background::spawn(app, st, job, move |app, st, out| {
        if direct {
            let small = out.map(|mut o| {
                mode.constrain(&mut o);
                blend_selection(&mut o, &src, ssel.as_deref());
                o
            });
            return apply_direct_preview(app, st, gen, small, now_ms() - t0, lod, (sw, sh));
        }
        let px = out.map(|o| finish_preview(o, &src, ssel.as_deref(), region, lod, &base, (w, h), (sw, sh), mode));
        apply_preview(app, st, gen, px, now_ms() - t0, lod, region);
    });
    if !all_layers {
        if restore_effect_others(st) {
            refresh_rect(app, st, Some((0, 0, w, h)));
        }
        return;
    }
    // autres calques : pixels d'origine retenus une fois, puis un calcul par calque ; un
    // résultat n'est posé que s'il répond encore au dernier réglage
    let others = match st.effect.as_ref() {
        None => return,
        Some(e) if !e.others.is_empty() => e.others.clone(),
        Some(_) => {
            let v = effect_targets(st, 2, None, &[]);
            if let Some(es) = st.effect.as_mut() {
                es.others = v.clone();
            }
            v
        }
    };
    for (uid, ob) in others {
        let (osrc, osel, sw, sh) = preview_source(&ob, sel_others.as_deref(), w, h, lod, region);
        let job = preview_job(name, osrc.clone(), sw, sh, &p, post.clone(), &vals, secondary);
        background::spawn(app, st, job, move |app, st, out| {
            if st.effect.as_ref().map_or(true, |e| e.want != gen) {
                return;
            }
            let Some(o) = out else { return };
            let px = finish_preview(o, &osrc, osel.as_deref(), region, lod, &ob, (w, h), (sw, sh), mode);
            if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == uid) {
                l.px = px.into();
            }
            refresh_rect(app, st, Some((0, 0, w, h)));
        });
    }
}

/// Calcul d'aperçu (ou d'application) d'un effet sur une image `w` × `h`.
#[allow(clippy::too_many_arguments)]
fn preview_job(name: &str, src: std::sync::Arc<Vec<u8>>, w: usize, h: usize, p: &[f32], post: Option<Vec<f32>>, vals: &effects::Vals, secondary: u32) -> background::Heavy {
    if name == "ascii" {
        let v = vals.clone();
        background::Heavy::Local(Box::new(move || Some(ascii::render(&src, w, h, &effects::ascii_opts(&v, secondary)))))
    } else {
        background::Heavy::Effect { name: name.into(), src, w, h, p: p.to_vec(), post }
    }
}

/// Source de l'aperçu d'un calque : réduite (pas `lod`), zone visible `region`, ou entière ;
/// avec la sélection au même cadrage. Renvoie (pixels, sélection, largeur, hauteur).
fn preview_source(base: &editor::Px, sel: Option<&[u8]>, w: usize, h: usize, lod: usize, region: Option<(usize, usize, usize, usize)>) -> (std::sync::Arc<Vec<u8>>, Option<Vec<u8>>, usize, usize) {
    if lod > 1 {
        let (sw, sh) = (w.div_ceil(lod), h.div_ceil(lod));
        let src = photo::crop_resize::<u8, 4>(base, w, (0, 0, w, h), sw, sh);
        let ssel = sel.map(|m| photo::crop_resize::<u8, 1>(m, w, (0, 0, w, h), sw, sh));
        (std::sync::Arc::new(src), ssel, sw, sh)
    } else if let Some((x0, y0, x1, y1)) = region {
        let (cw, ch) = (x1 - x0, y1 - y0);
        let mut crop = Vec::with_capacity(cw * ch * 4);
        for y in y0..y1 {
            crop.extend_from_slice(&base[(y * w + x0) * 4..(y * w + x1) * 4]);
        }
        // sélection découpée ligne à ligne (sans vecteur intermédiaire par ligne)
        let csel = sel.map(|m| {
            let mut c = Vec::with_capacity(cw * ch);
            for y in y0..y1 {
                c.extend_from_slice(&m[y * w + x0..y * w + x1]);
            }
            c
        });
        (std::sync::Arc::new(crop), csel, cw, ch)
    } else {
        (base.arc(), sel.map(|m| m.to_vec()), w, h)
    }
}

/// Résultat d'aperçu ramené au calque entier : espace de couleur, sélection, zone visible
/// recollée sur l'original ou aperçu réduit agrandi.
#[allow(clippy::too_many_arguments)]
fn finish_preview(mut o: Vec<u8>, src: &[u8], ssel: Option<&[u8]>, region: Option<(usize, usize, usize, usize)>, lod: usize, base: &[u8], (w, h): (usize, usize), (sw, sh): (usize, usize), mode: ColorMode) -> Vec<u8> {
    mode.constrain(&mut o);
    blend_selection(&mut o, src, ssel);
    match (region, lod) {
        (Some((x0, y0, x1, y1)), _) => {
            let cw = x1 - x0;
            let mut full = base.to_vec();
            for (j, y) in (y0..y1).enumerate() {
                full[(y * w + x0) * 4..(y * w + x1) * 4].copy_from_slice(&o[j * cw * 4..(j + 1) * cw * 4]);
            }
            full
        }
        (None, l) if l > 1 => upscale_nearest(&o, sw, sh, w, h),
        _ => o,
    }
}

/// Remet les autres calques à leurs pixels d'origine (aperçu « Tous les calques » retiré).
/// Vrai si un calque a changé.
fn restore_effect_others(st: &mut State) -> bool {
    let Some(es) = st.effect.as_mut() else { return false };
    let others = std::mem::take(&mut es.others);
    let changed = !others.is_empty();
    for (uid, px) in others {
        if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == uid) {
            l.px = px;
        }
    }
    changed
}

/// Agrandissement au plus proche voisin (aperçu réduit posé sur le calque entier).
fn upscale_nearest(px: &[u8], sw: usize, sh: usize, w: usize, h: usize) -> Vec<u8> {
    let mut out = vec![0u8; w * h * 4];
    let xs: Vec<usize> = (0..w).map(|x| (x * sw / w).min(sw - 1) * 4).collect();
    for y in 0..h {
        let row = &px[(y * sh / h).min(sh - 1) * sw * 4..];
        let o = &mut out[y * w * 4..(y + 1) * w * 4];
        for (x, sx) in xs.iter().enumerate() {
            o[x * 4..x * 4 + 4].copy_from_slice(&row[*sx..*sx + 4]);
        }
    }
    out
}

/// Opacité du calque : une seule étape d'historique quand le curseur s'arrête (500 ms).
fn schedule_opacity_commit(app: &AppWindow) {
    thread_local! {
        static DEBOUNCE: slint::Timer = slint::Timer::default();
    }
    let weak = app.as_weak();
    DEBOUNCE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(500), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return schedule_opacity_commit(&app) };
            let st = &mut *st;
            let op = st.doc.layer().opacity;
            let saved = st.doc.history.get(st.doc.hindex).and_then(|s| s.layers.get(st.doc.active)).map(|l| l.opacity);
            if saved.is_some_and(|s| (s - op).abs() > 1e-4) {
                st.doc.commit("Opacité du calque");
                refresh_all(&app, st);
            }
        })
    });
}

/// Effets locaux (chaque pixel ne dépend que de son voisinage proche) dont l'aperçu peut se
/// limiter à la zone visible sans changer ce qu'on y voit.
const LOCAL_EFFECTS: &[&str] = &[
    "blur", "gaussian", "median", "reducenoise", "unfocus", "motionblur", "surfaceblur", "sharpen", "unsharp", "edges", "emboss", "relief", "outline", "addnoise",
    // ajustements point par point : chaque pixel ne dépend que de lui-même
    "brightness", "grayscale", "invert", "invertalpha", "sepia", "exposure", "posterize", "threshold", "solarize", "hsv", "vibrance", "temptint", "temperature", "colorbal",
    "curves", "levels", "duotone", "cmjn",
];

/// Zone à calculer pour l'aperçu (x0, y0, x1, y1) si l'image est grande, l'effet local et la
/// zone visible nettement plus petite que l'image ; `None` : image entière.
fn visible_region(app: &AppWindow, w: usize, h: usize, name: &str, p: &[f32]) -> Option<(usize, usize, usize, usize)> {
    if w * h < 4_000_000 || !LOCAL_EFFECTS.contains(&name) {
        return None;
    }
    let vr = app.get_visible_rect();
    let v: Vec<f32> = (0..4).filter_map(|i| vr.row_data(i)).collect();
    if v.len() < 4 {
        return None;
    }
    // marge : au moins 128 px, ou 3 fois le rayon de l'effet (premier réglage)
    let m = (p.first().copied().unwrap_or(0.0).abs() * 3.0).max(128.0).min(1024.0) as isize;
    let x0 = ((v[0].floor() as isize) - m).clamp(0, w as isize) as usize;
    let y0 = ((v[1].floor() as isize) - m).clamp(0, h as isize) as usize;
    let x1 = ((v[2].ceil() as isize) + m).clamp(0, w as isize) as usize;
    let y1 = ((v[3].ceil() as isize) + m).clamp(0, h as isize) as usize;
    if x1 <= x0 || y1 <= y0 || (x1 - x0) * (y1 - y0) * 10 > w * h * 6 {
        return None;
    }
    Some((x0, y0, x1, y1))
}

/// Aperçu d'un effet : image entière, ou seulement la zone `region` (le reste du calque reste
/// celui d'origine).
#[allow(clippy::too_many_arguments)]
#[cfg_attr(not(test), allow(dead_code))]
fn effect_preview_pixels(w: usize, h: usize, sel: Option<&[u8]>, base: &[u8], name: &str, p: &[f32], vals: &effects::Vals, secondary: u32, mode: ColorMode, region: Option<(usize, usize, usize, usize)>) -> Option<Vec<u8>> {
    let Some((x0, y0, x1, y1)) = region else {
        return effect_pixels(w, h, sel, base, name, p, vals, secondary, mode);
    };
    let (cw, ch) = (x1 - x0, y1 - y0);
    let mut crop = Vec::with_capacity(cw * ch * 4);
    for y in y0..y1 {
        crop.extend_from_slice(&base[(y * w + x0) * 4..(y * w + x1) * 4]);
    }
    let csel = sel.map(|s| {
        let mut v = Vec::with_capacity(cw * ch);
        for y in y0..y1 {
            v.extend_from_slice(&s[y * w + x0..y * w + x1]);
        }
        v
    });
    let out = effect_pixels(cw, ch, csel.as_deref(), &crop, name, p, vals, secondary, mode)?;
    let mut full = base.to_vec();
    for (j, y) in (y0..y1).enumerate() {
        full[(y * w + x0) * 4..(y * w + x1) * 4].copy_from_slice(&out[j * cw * 4..(j + 1) * cw * 4]);
    }
    Some(full)
}

/// Vue déplacée ou zoomée pendant une fenêtre d'effet à aperçu partiel : l'aperçu est refait
/// pour la nouvelle zone visible (après une courte pause).
fn view_moved(app: &AppWindow) {
    thread_local! {
        static DEBOUNCE: slint::Timer = slint::Timer::default();
    }
    let weak = app.as_weak();
    DEBOUNCE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(180), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            // zone visible changée, ou zoom avant : l'aperçu réduit n'a plus assez de pixels
            let (w, h) = (st.doc.w, st.doc.h);
            let want = preview_lod(&app, w, h);
            if st.effect.as_ref().is_some_and(|e| e.partial || e.lod > want) {
                preview_effect(&app, &mut st);
            }
        })
    });
}

fn cancel_effect(app: &AppWindow, st: &mut State) {
    restore_effect_others(st);
    dyn_preview_end(app, st, None);
    if let Some(es) = st.effect.take() {
        st.doc.layer_mut().px = es.base;
        refresh_all(app, st);
    }
    app.set_show_effect(false);
}

/// Fenêtres de réglage qui ne passent pas par le moteur d'effets (séparation des canaux,
/// détourage, remplissage) : appliquées à OK. Faux pour un effet ordinaire.
fn commit_special(app: &AppWindow, st: &mut State, es: &EffectSession) -> bool {
    if !SPECIAL_DIALOGS.contains(&es.id.as_str()) {
        return false;
    }
    st.doc.layer_mut().px = es.base.clone();
    match es.id.as_str() {
        "splitrgb" => {
            let (gray, off, hide) = effects::split_rgb_opts(&es.vals);
            st.doc.split_rgb_with(gray, off, hide);
            st.doc.commit(&es.title);
            refresh_all(app, st);
        }
        "cutoutsel" => {
            let (feather, grow, invert, mask) = effects::cutout_opts(&es.vals);
            match st.doc.cutout_with(feather, grow, invert, mask) {
                Ok(()) => {
                    st.doc.commit(&es.title);
                    refresh_all(app, st);
                }
                Err(m) => {
                    refresh_all(app, st);
                    status(app, m);
                }
            }
        }
        _ => {
            // remplissage : PatchMatch simplifié, long sur une grande zone → arrière-plan
            let Some(mask) = st.doc.sel.clone() else {
                refresh_all(app, st);
                status(app, "Remplissage : sélectionnez la zone à reconstituer");
                return true;
            };
            let p = effects::content_fill_params(&es.vals, (es.seed & 0xffff) as f32);
            let (w, h, uid, luid) = (st.doc.w, st.doc.h, st.doc.uid, st.doc.layer().uid);
            let title = es.title.clone();
            begin_busy(app, &title, "Reconstitution de la zone…", true);
            let job = background::Heavy::Fill { src: es.base.arc(), mask: std::sync::Arc::new(mask), w, h, p };
            background::spawn(app, st, job, move |app, st, out| {
                end_busy(app);
                if st.doc.uid != uid || st.doc.w != w || st.doc.h != h {
                    return status(app, i18n::tr_format!("{title} : abandonné (l'image a changé)"));
                }
                let Some(px) = out.filter(|v| v.len() == w * h * 4) else { return };
                if let Some(l) = st.doc.layers.iter_mut().find(|l| l.uid == luid) {
                    l.px = px.into();
                }
                st.doc.commit(&title);
                refresh_all(app, st);
            });
        }
    }
    true
}

/// Fenêtres de `commit_special` (sans aperçu : appliquées à OK).
const SPECIAL_DIALOGS: [&str; 3] = ["splitrgb", "cutoutsel", "contentfill"];

fn commit_effect(app: &AppWindow, st: &mut State) {
    app.set_show_effect(false);
    let Some(mut es) = st.effect.take() else { return };
    // vue de contrôle de l'aperçu (masque, original, sur fond…) : le résultat est appliqué
    let preview_only = effects::preview_only(&es.id, &es.vals);
    es.vals = effects::for_commit(&es.id, &es.vals);
    st.effect_memory.insert(es.id.clone(), es.vals.clone());
    if commit_special(app, st, &es) {
        return;
    }
    let sec = rgba(app.get_secondary_color());
    let secondary = (sec[0] as u32) << 16 | (sec[1] as u32) << 8 | sec[2] as u32;
    let Some((name, p)) = effects::params(&es.id, &es.vals, secondary, es.seed) else {
        st.doc.commit(&es.title);
        refresh_all(app, st);
        return;
    };
    // calque texte : l'aperçu est oublié, l'effet rejoint la pile du calque
    if app.get_effect_scope() != 2 && st.doc.layer().vector.is_some() {
        st.doc.layer_mut().px = es.base.clone();
        if vector_layer_effect(app, st, name, &p, effects::post_chromatic(name, &es.vals), &es.title) {
            return;
        }
    }
    // calque dynamique : l'aperçu est oublié, l'effet rejoint sa pile
    if app.get_effect_scope() != 2 && st.doc.layer().dynamic.is_some() {
        st.doc.layer_mut().px = es.base.clone();
        if dynamic_layer_effect(app, st, name, &p, &es.title, &es.id, &es.vals) {
            return;
        }
    }
    // l'aperçu affiché n'est pas le résultat final (calcul en cours, zone visible, aperçu
    // réduit) : calcul en pleine résolution ; portée « Tous les calques » : les autres aussi
    // (incrustation en masque α : l'aperçu a modifié les pixels, le calcul final va au masque)
    // (incrustation dans un nouveau calque ou vue de contrôle : idem)
    let stale = es.shown != es.want || es.running || es.partial || es.lod > 1 || preview_only || effects::chroma_as_mask(name, &es.vals) || effects::chroma_to_layer(name, &es.vals);
    let scope = app.get_effect_scope();
    // autres calques : toujours recalculés en pleine résolution depuis leurs pixels d'origine
    // (leur aperçu peut être réduit)
    let targets = effect_targets(st, scope, stale.then(|| es.base.clone()), &es.others);
    st.last_effect = Some((name.into(), p.clone(), es.title.clone()));
    st.last_effect_vals = Some((es.vals.clone(), scope));
    let total = targets.len();
    let ctx = ApplyCtx {
        title: es.title.clone(),
        name: name.to_string(),
        p,
        vals: es.vals.clone(),
        secondary,
        sel: if app.get_effect_scope() == 1 { None } else { st.doc.sel.clone() },
        uid: st.doc.uid,
        targets,
        total,
        // l'aperçu à jour du calque actif compte comme appliqué
        applied: usize::from(!stale),
        t0: now_ms(),
    };
    begin_busy(app, &es.title, "Application à l'image entière…", total > 0 && st.doc.w * st.doc.h > 1_000_000);
    apply_next(app, st, ctx);
}
// ------------------------------------------------------------------ courbes

fn open_curves(app: &AppWindow, st: &mut State) { open_curves_at(app,st,None); }
fn open_curves_at(app: &AppWindow, st: &mut State, selected: Option<usize>) {
    finish_edits(app, st);
    st.dyn_fx = None;
    st.dyn_pending_edit = None;
    if let Some(why)=st.doc.edit_refusal() { return status(app,why); }
    let mut ch=std::array::from_fn(|_|curves::identity());
    let mut active=0;
    let found=st.doc.layer().dynamic.as_ref().and_then(|stack|selected.filter(|&i|stack.get(i).is_some_and(|(kind,_)|editor::fx_matches(kind,"curves"))).or_else(||stack.iter().rposition(|(kind,_)|editor::fx_matches(kind,"curves"))));
    if let Some(i)=found {
        let kind=&st.doc.layer().dynamic.as_ref().unwrap()[i].0;
        let mut restored=false;
        if let Some((_,values))=editor::fx_dialog(kind) {
            if let Some(saved)=curves::restore_values(&values) { ch=saved;restored=true; }
            active=values.get("curves-channel").and_then(|v|v.parse::<usize>().ok()).unwrap_or(0).min(3);
        }
        if !restored { if let Some(saved)=editor::fx_params(kind).and_then(|p|curves::from_engine_params(&p)) { ch=saved; } }
        st.dyn_pending_edit=Some(i);
    }
    app.set_curves_dynamic_edit(found.is_some());
    st.curves=Some(CurvesSession { base:st.doc.layer().px.clone(),ch,active,ed:Default::default() });
    sync_curves(app,st,true);
    app.set_show_curves(true);
}

/// Courbe, points et (si `hist`) histogramme du canal affiché.
fn sync_curves(app: &AppWindow, st: &State, hist: bool) {
    let Some(cs) = &st.curves else { return };
    let pts = &cs.ch[cs.active];
    app.set_curves_channel(cs.active as i32);
    app.set_curves_path(SharedString::from(curves::path(pts)));
    let hs: Vec<Handle> = pts.iter().enumerate().map(|(i, p)| Handle { x: p.0, y: p.1, round: cs.ed.drag == Some(i) }).collect();
    app.set_curves_points(ModelRc::new(VecModel::from(hs)));
    if hist {
        app.set_curves_hist(SharedString::from(curves::histogram_path(&cs.base, cs.active)));
    }
}

/// Aperçu direct sur la toile.
fn preview_curves(app: &AppWindow, st: &mut State) {
    let Some(cs) = &st.curves else { return };
    let p = curves::engine_params(&cs.ch);
    // calque dynamique : les courbes rejoignent sa pile (aperçu par la pile)
    if st.doc.layer().dynamic.is_some() {
        let kind = editor::fx_kind("curves", &p, "Courbes", "curves", &curves::saved_values(&cs.ch,cs.active));
        dyn_preview(app, st, kind);
        return;
    }
    let base = cs.base.clone();
    if let Some(px) = compute_effect(&st.doc, &base, "curves", &p) {
        st.doc.layer_mut().px = px.into();
        let (w, h) = (st.doc.w, st.doc.h);
        refresh_rect(app, st, Some((0, 0, w, h)));
    }
}

fn curves_action(app: &AppWindow, st: &mut State, action: &str, i: usize) {
    match action {
        "remove" => { remove_dynamic_effect(app,st); }
        "channel" => {
            if let Some(cs) = st.curves.as_mut() {
                cs.active = i.min(3);
                cs.ed.drag = None;
            }
            sync_curves(app, st, true);
        }
        "reset" => {
            if let Some(cs) = st.curves.as_mut() {
                cs.ch[cs.active] = curves::identity();
            }
            sync_curves(app, st, false);
            preview_curves(app, st);
        }
        "ok" => {
            if st.dyn_fx.is_some() {
                if let Some(cs) = st.curves.take() {
                    let kind = editor::fx_kind("curves", &curves::engine_params(&cs.ch), "Courbes", "curves", &curves::saved_values(&cs.ch,cs.active));
                    app.set_show_curves(false);
                    dyn_preview_end(app, st, Some((kind, "Courbes")));
                    return;
                }
            }
            if let Some(cs) = st.curves.take() {
                if cs.ch.iter().any(|c| *c != curves::identity()) {
                    st.last_effect = Some(("curves".into(), curves::engine_params(&cs.ch), "Courbes".into()));
                    st.last_effect_vals = None;
                    st.doc.commit("Courbes");
                }
            }
            app.set_show_curves(false);
            st.dyn_pending_edit=None;
            refresh_all(app, st);
        }
        _ => {
            if let Some(cs) = st.curves.take() {
                st.doc.layer_mut().px = cs.base;
            }
            app.set_show_curves(false);
            st.dyn_pending_edit=None;
            if !dyn_preview_end(app, st, None) {
                refresh_all(app, st);
            }
        }
    }
}

fn curves_pointer(app: &AppWindow, state: &Shared, kind: i32, x: f32, y: f32, right: bool) {
    let mut st = state.borrow_mut();
    let st = &mut *st;
    let Some(cs) = st.curves.as_mut() else { return };
    let a = cs.active;
    let changed = match kind {
        0 => cs.ed.press(&mut cs.ch[a], x, y, right),
        1 => cs.ed.moved(&mut cs.ch[a], x, y),
        _ => {
            cs.ed.drag = None;
            false
        }
    };
    sync_curves(app, st, false);
    if changed {
        // aperçu regroupé : un calcul par image affichée au plus pendant le glisser
        let weak = app.as_weak();
        let state2 = state.clone();
        st.effect_timer.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(30), move || {
            if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                preview_curves(&app, &mut st);
            }
        });
    }
}

// ------------------------------------------------------------------ transformation (Déplacer, Déformation, 4 coins)

fn transform_kind(tool: Tool) -> Option<transform::Kind> {
    match tool {
        Tool::Move => Some(transform::Kind::MovePixels),
        Tool::Deform => Some(transform::Kind::Deform),
        Tool::Warp => Some(transform::Kind::Warp),
        Tool::RectSelect | Tool::EllipseSelect => Some(transform::Kind::MoveSelection),
        _ => None,
    }
}

/// Poignées visibles dès qu'il y a une sélection (outils de transformation, Sélection
/// rectangulaire), comme Paint.NET. Le contenu n'est modifié qu'au premier glisser.
fn prepare_handles(app: &AppWindow, st: &mut State) {
    if let Some(tk) = transform_kind(st.tool) {
        if st.doc.sel.is_some() && st.floating.as_ref().map_or(true, |f| f.kind != tk) && !st.session.busy() {
            st.floating = transform::Floating::lift(&mut st.doc, tk, app.global::<ToolOpts>().get_outside_canvas());
        }
    }
    show_handles(app, st);
}

/// Affiche les poignées et le contour du contenu soulevé.
fn show_handles(app: &AppWindow, st: &State) {
    match &st.floating {
        Some(f) if st.transform_drag.is_none() || matches!(st.transform_drag, Some((transform::Grab::Edge(_), _, _)) | Some((transform::Grab::Corner(_), _, _))) => {
            let hs: Vec<Handle> = f.handles().into_iter().map(|((x, y), round)| Handle { x, y, round }).collect();
            app.set_handles(ModelRc::new(VecModel::from(hs)));
            app.set_overlay_path(SharedString::from(f.outline_path()));
        }
        Some(f) => {
            app.set_handles(ModelRc::default());
            app.set_overlay_path(SharedString::from(f.outline_path()));
        }
        None if st.shape_edit.is_some() => {
            if let Some(ed) = &st.shape_edit {
                shape_edit::show(app, ed);
            }
        }
        // ses 3 points restent affichés (voir gradlive::show)
        None if st.grad_live.is_some() => {}
        None => {
            app.set_handles(ModelRc::default());
            if !st.session.tracing() {
                app.set_overlay_path(SharedString::default());
            }
        }
    }
}

/// Repose le contenu soulevé (il est déjà dessiné sur le calque) : fin de la transformation.
fn drop_floating(app: &AppWindow, st: &mut State) {
    if st.floating.take().is_some() {
        st.transform_drag = None;
        show_handles(app, st);
        app.set_canvas_cursor(0);
        app.set_rotate_hint(false);
    }
}

/// Événement de la toile pour les outils de transformation. Retourne true s'il est traité.
fn transform_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32, button: i32, shift: bool, alt: bool) -> bool {
    let Some(tk) = transform_kind(st.tool) else { return false };
    sync_interp(app);
    let zoom = app.get_zoom().max(0.01);
    let (tol, rot) = (7.0 / zoom, 32.0 / zoom);
    // Déformation / 4 coins : clic hors de la sélection (ou sans sélection) = nouvelle sélection
    if st.sel_drag {
        let o = opts(app);
        let out = if kind == 1 {
            st.session.moved(Tool::RectSelect, &mut st.doc, &o, x, y, false)
        } else {
            st.sel_drag = false;
            st.session.release(Tool::RectSelect, &mut st.doc)
        };
        handle_outcome(app, st, out);
        if kind != 1 {
            prepare_handles(app, st);
        }
        return true;
    }
    if kind == 0 && matches!(tk, transform::Kind::Deform | transform::Kind::Warp) {
        let on_target = st.floating.as_ref().map_or(false, |f| f.contains(x, y) || !matches!(f.hit(x, y, tol, rot, button == 1), transform::Grab::Translate));
        if st.doc.sel.is_none() || !on_target {
            drop_floating(app, st);
            st.sel_drag = true;
            let o = opts(app);
            let out = st.session.press(Tool::RectSelect, &mut st.doc, &o, x, y, false, false, false);
            handle_outcome(app, st, out);
            return true;
        }
    }
    match kind {
        0 => {
            if st.floating.as_ref().map_or(true, |f| f.kind != tk) {
                drop_floating(app, st);
                st.floating = transform::Floating::lift(&mut st.doc, tk, app.global::<ToolOpts>().get_outside_canvas());
            }
            let Some(f) = &st.floating else { return true };
            let grab = f.hit(x, y, tol, rot, button == 1);
            if tk == transform::Kind::MoveSelection && !matches!(grab, transform::Grab::Edge(_)) {
                // hors des poignées : nouvelle sélection (comportement normal de l'outil)
                drop_floating(app, st);
                return false;
            }
            st.transform_drag = Some((grab, f.snapshot(), (x, y)));
            show_handles(app, st);
        }
        1 => {
            if let Some((grab, start, from)) = &st.transform_drag {
                let (grab, from) = (*grab, *from);
                let start = start.snapshot();
                let snap = app.global::<ToolOpts>().get_snap();
                let (dw, dh) = (st.doc.w as f32, st.doc.h as f32);
                if let Some(f) = st.floating.as_mut() {
                    f.drag(&start, grab, from, (x, y), shift, alt);
                    let mut guides = (None, None);
                    if snap && grab == transform::Grab::Translate {
                        // Aimantation : coin haut-gauche sur la grille (Paramètres aimantation),
                        // sinon bords et centre de la toile, à 8 pixels écran près
                        let q = f.corners();
                        let (x0, x1) = (q.iter().map(|p| p.0).fold(f32::MAX, f32::min), q.iter().map(|p| p.0).fold(f32::MIN, f32::max));
                        let (y0, y1) = (q.iter().map(|p| p.1).fold(f32::MAX, f32::min), q.iter().map(|p| p.1).fold(f32::MIN, f32::max));
                        let tol = 8.0 / zoom;
                        let best = |cands: [f32; 3]| cands.into_iter().filter(|d| d.abs() <= tol).min_by(|a, b| a.abs().total_cmp(&b.abs())).unwrap_or(0.0);
                        let (cell, th) = snap_params(app, st.doc.w);
                        let (gx, gy) = ((x0 / cell).round() * cell, (y0 / cell).round() * cell);
                        let ddx = if (x0 - gx).abs() <= th {
                            guides.0 = Some(gx);
                            gx - x0
                        } else {
                            best([-x0, dw - x1, (dw - (x1 - x0)) / 2.0 - x0]).round()
                        };
                        let ddy = if (y0 - gy).abs() <= th {
                            guides.1 = Some(gy);
                            gy - y0
                        } else {
                            best([-y0, dh - y1, (dh - (y1 - y0)) / 2.0 - y0]).round()
                        };
                        if ddx != 0.0 || ddy != 0.0 {
                            let s2 = f.snapshot();
                            f.drag(&s2, transform::Grab::Translate, (0.0, 0.0), (ddx, ddy), false, false);
                        }
                    }
                    show_snap_guides(app, guides.0, guides.1);
                    // grande zone : brouillon par blocs pendant le glisser (≈ 1,5 Mpx calculés
                    // par mouvement), rendu exact au relâchement
                    let q = f.corners();
                    let bw = q.iter().map(|p| p.0).fold(f32::MIN, f32::max) - q.iter().map(|p| p.0).fold(f32::MAX, f32::min);
                    let bh = q.iter().map(|p| p.1).fold(f32::MIN, f32::max) - q.iter().map(|p| p.1).fold(f32::MAX, f32::min);
                    let area = (bw.max(0.0) * bh.max(0.0)).min((st.doc.w * st.doc.h) as f32 * 4.0);
                    let under_fx = st.doc.layers.iter().any(|l| l.dynamic.is_some());
                    f.draft = if area > 2.0e6 { ((area / 1.5e6).sqrt().ceil() as usize).clamp(1, 8) } else if under_fx && area > 400_000.0 { 2 } else { 1 };
                    if under_fx {
                        note_gesture(app);
                    }
                    let r = f.render(&mut st.doc);
                    refresh_rect(app, st, r);
                    show_handles(app, st);
                }
            } else if tk == transform::Kind::MoveSelection {
                if st.session.busy() {
                    return false;
                }
                // poignée : flèches orientées comme elle
                let cur = st.floating.as_ref().map_or(0, |f| match f.hit(x, y, tol, 0.0, false) {
                    g @ transform::Grab::Edge(_) => f.grab_cursor(g),
                    _ => 0,
                });
                app.set_canvas_cursor(cur);
                return false;
            } else {
                // survol : curseur selon la zone (poignée, rotation, déplacement)
                let (cur, hint) = match &st.floating {
                    Some(f) => {
                        let g = f.hit(x, y, tol, rot, false);
                        (f.grab_cursor(g), g == transform::Grab::Rotate)
                    }
                    None => (1, false),
                };
                app.set_canvas_cursor(cur);
                app.set_rotate_hint(hint);
            }
        }
        _ => {
            if st.transform_drag.is_none() && tk == transform::Kind::MoveSelection {
                return false;
            }
            if let Some((grab, _, _)) = st.transform_drag.take() {
                end_gesture();
                gpuview::take_coarse();
                // brouillon du glisser : rendu exact avant l'étape d'historique
                if let Some(f) = st.floating.as_mut() {
                    if f.draft > 1 {
                        f.draft = 1;
                        let r = f.render(&mut st.doc);
                        refresh_rect(app, st, r);
                    }
                }
                let label = match (tk, grab) {
                    (transform::Kind::MoveSelection, _) => "Redimensionner la sélection",
                    (transform::Kind::Warp, _) => "Déformation 4 coins",
                    (_, transform::Grab::Rotate) => "Rotation",
                    (_, transform::Grab::Edge(_)) => "Redimensionner",
                    (transform::Kind::Deform, _) => "Déformation",
                    _ => "Déplacer les pixels",
                };
                // « Hors toile » : ce qui dépasse est gardé dans le calque (étape d'historique comprise)
                if app.global::<ToolOpts>().get_outside_canvas() {
                    if let Some(f) = &st.floating {
                        f.write_outside(&mut st.doc);
                    }
                }
                if tk == transform::Kind::MoveSelection {
                    // contour de sélection seul : pas d'étape d'historique
                    st.doc.selection_changed();
                } else {
                    st.doc.commit(label);
                }
                refresh_all(app, st);
                show_handles(app, st);
            }
        }
    }
    true
}

// ------------------------------------------------------------------ texte

/// Texte en cours de saisie : position (coin haut-gauche) et calque d'origine.
struct TextEdit {
    x: f32,
    y: f32,
    base: editor::Px,
    /// calque texte modifié (`uid`) ; None : texte peint dans le calque actif
    layer: Option<u64>,
    /// calque texte créé pour cette saisie (supprimé si le texte reste vide)
    created: bool,
    /// rectangle déjà dessiné (remis à l'état d'origine à la frappe suivante)
    prev: Option<(usize, usize, usize, usize)>,
    /// calque texte : indice de l'objet saisi (un calque texte porte plusieurs textes)
    obj: usize,
    /// objet ajouté pour cette saisie (retiré sans étape d'historique s'il reste vide)
    new_obj: bool,
}

/// Réunion de deux rectangles (x0, y0, x1, y1).
fn union_rect(a: Option<(usize, usize, usize, usize)>, b: Option<(usize, usize, usize, usize)>) -> Option<(usize, usize, usize, usize)> {
    match (a, b) {
        (Some(a), Some(b)) => Some((a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3))),
        (a, b) => a.or(b),
    }
}

/// Redessine le texte en cours. Seul le cadre du texte est rastérisé et recomposé (la saisie
/// reste fluide sur une grande image). Calque texte : son objet est mis à jour et le rendu
/// est affiché sans ses effets pendant la saisie. Retourne l'index d'une police web à
/// télécharger si la police choisie n'est pas encore disponible.
fn render_text(app: &AppWindow, st: &mut State) -> Option<usize> {
    let (tx, ty, layer, prev, base, obj) = {
        let te = st.text_edit.as_ref()?;
        (te.x, te.y, te.layer, te.prev, te.base.clone(), te.obj)
    };
    let t = app.global::<ToolOpts>();
    let fi = t.get_font_index().max(0) as usize;
    let mut missing = None;
    let font = match st.fonts.get(fi) {
        Some(f) => f,
        None => {
            if st.fonts.web_path(fi).is_some() {
                missing = Some(fi);
            }
            st.fonts.get(0)?
        }
    };
    let align = match t.get_text_align() {
        1 => text::Align::Center,
        2 => text::Align::Right,
        _ => text::Align::Left,
    };
    let (w, h) = (st.doc.w, st.doc.h);
    let content = app.get_text_value().to_string();
    let r = text::raster(&font, &content, t.get_font_size(), tx, ty, align, t.get_antialias());
    let (x0, y0, x1, y1) = r.frame;
    app.set_text_x(x0);
    app.set_text_y(y0);
    app.set_text_w((x1 - x0).max(t.get_font_size() * 0.6));
    app.set_text_h((y1 - y0).max(t.get_font_size()));
    let color = rgba(app.get_primary_color());
    let new = match layer.and_then(|u| st.doc.layers.iter().position(|l| l.uid == u)) {
        Some(k) => {
            let font_name = st.fonts.entries.get(fi).map(|e| e.name.clone()).unwrap_or_default();
            let l = &mut st.doc.layers[k];
            if let Some(o) = l.vector.as_mut().and_then(|v| v.text_at_mut(obj)) {
                *o = vector::TextObj { text: content, font: font_name, size: t.get_font_size(), color, align: t.get_text_align(), antialias: t.get_antialias(), x: tx, y: ty, m: o.m };
            }
            // fond : les autres textes du calque (rendus sans effets au début de la saisie)
            let lay = &mut l.px;
            if let Some(p) = prev {
                text::restore_rect(lay, Some(&base[..]), w, p);
            }
            text::apply_raster(Some(&base[..]), lay, w, h, &r, color, None)
        }
        None => {
            let sel = st.doc.sel.clone();
            let lay = &mut st.doc.layer_mut().px;
            if let Some(p) = prev {
                text::restore_rect(lay, Some(&base[..]), w, p);
            }
            text::apply_raster(Some(&base[..]), lay, w, h, &r, color, sel.as_deref())
        }
    };
    if let Some(te) = st.text_edit.as_mut() {
        te.prev = new;
    }
    if let Some(rr) = union_rect(prev, new) {
        refresh_rect(app, st, Some(rr));
    }
    missing
}

/// Valide le texte en cours (nouvelle étape d'historique s'il n'est pas vide). Calque texte :
/// rendu complet (effets compris) ; texte vide : le calque est supprimé.
fn commit_text(app: &AppWindow, st: &mut State) {
    if let Some(te) = st.text_edit.take() {
        let empty = app.get_text_value().trim().is_empty();
        let target = te.layer.and_then(|u| st.doc.layers.iter().position(|l| l.uid == u));
        // texte vidé d'un calque qui garde d'autres textes : seul l'objet est retiré
        if let Some(k) = target.filter(|&k| empty && st.doc.layers[k].vector.as_ref().is_some_and(|v| v.objects.len() > 1)) {
            let uid = st.doc.layers[k].uid;
            if let Some(v) = st.doc.layers[k].vector.as_mut() {
                if te.obj < v.objects.len() {
                    v.objects.remove(te.obj);
                }
            }
            render_vector_layer(app, st, uid);
            if !te.new_obj {
                st.doc.commit("Supprimer le texte");
            }
            app.set_text_active(false);
            app.set_text_value(SharedString::default());
            refresh_all(app, st);
            return;
        }
        match target {
            Some(k) if empty => {
                st.doc.layers.remove(k);
                if st.doc.layers.iter().all(|l| l.group) || st.doc.layers.is_empty() {
                    // il reste toujours un calque de pixels
                    st.doc.layers.insert(0, editor::Layer::new(&i18n::tr("Calque 1"), st.doc.w, st.doc.h, [0, 0, 0, 0]));
                }
                st.doc.active = k.saturating_sub(1).min(st.doc.layers.len() - 1);
                if !te.created {
                    st.doc.commit("Supprimer le texte");
                }
                refresh_all(app, st);
            }
            Some(k) => {
                let uid = st.doc.layers[k].uid;
                render_vector_layer(app, st, uid);
                st.doc.commit(if te.created {
                    "Calque texte"
                } else if te.new_obj {
                    "Texte"
                } else {
                    "Modifier le texte"
                });
                refresh_all(app, st);
            }
            None if empty => {
                st.doc.layer_mut().px = te.base;
                refresh_all(app, st);
            }
            None => {
                st.doc.commit("Texte");
                refresh_all(app, st);
            }
        }
    }
    app.set_text_active(false);
    app.set_text_value(SharedString::default());
}

/// Commence une saisie de texte au point (x, y) : nouveau texte, ou modification de l'objet
/// d'un calque texte cliqué (ses réglages reviennent dans le ruban).
fn begin_text(app: &AppWindow, st: &mut State, x: f32, y: f32) {
    // calque texte sous le pointeur : le calque actif d'abord, puis du haut vers le bas
    let order: Vec<usize> = std::iter::once(st.doc.active).chain((0..st.doc.layers.len()).rev()).collect();
    let mut hit = None;
    for k in order {
        let l = &st.doc.layers[k];
        if !l.visible || st.doc.locked_at(k) {
            continue;
        }
        if let Some(v) = l.vector.clone() {
            if let Some(i) = v.hit_text(&mut st.fonts, x, y) {
                hit = Some((k, v, i));
                break;
            }
        }
    }
    if let Some((k, v, i)) = hit {
        let Some(o) = v.text_at(i).cloned() else { return };
        st.doc.active = k;
        let t = app.global::<ToolOpts>();
        if let Some(fi) = st.fonts.index_of(&o.font) {
            t.set_font_index(fi as i32);
        }
        t.set_font_size(o.size);
        t.set_text_align(o.align);
        t.set_antialias(o.antialias);
        app.set_primary_color(Color::from_argb_u8(o.color[3], o.color[0], o.color[1], o.color[2]));
        // pendant la saisie : les textes du calque sans leurs effets (rejoués à la validation),
        // l'objet saisi redessiné à chaque frappe par-dessus les autres
        let (w, h) = (st.doc.w, st.doc.h);
        st.doc.layers[k].px = v.render_others(&mut st.fonts, w, h, i).into();
        let uid = st.doc.layers[k].uid;
        st.text_edit = Some(TextEdit { x: o.x, y: o.y, base: st.doc.layers[k].px.clone(), layer: Some(uid), created: false, prev: None, obj: i, new_obj: false });
        app.set_text_value(SharedString::from(o.text.as_str()));
        app.set_text_active(true);
        app.set_text_serial(app.get_text_serial() + 1);
        render_text(app, st);
        refresh_all(app, st);
        return;
    }
    if (app.global::<ToolOpts>().get_text_layer() || st.doc.vector_mode) && st.doc.mask_of.is_none() {
        // « Calque texte » : le texte rejoint le calque texte actif, ou celui juste au-dessus du
        // calque actif (l'utilisateur a cliqué le calque d'en dessous) ; sinon nouveau calque
        let usable = |st: &State, k: usize| {
            st.doc.layers.get(k).is_some_and(|l| l.vector.is_some() && l.visible) && !st.doc.locked_at(k)
        };
        let reuse = if usable(st, st.doc.active) {
            Some(st.doc.active)
        } else if usable(st, st.doc.active + 1) && st.doc.layers[st.doc.active + 1].parent == st.doc.layer().parent {
            Some(st.doc.active + 1)
        } else {
            None
        };
        if let Some(k) = reuse {
            let (w, h) = (st.doc.w, st.doc.h);
            st.doc.active = k;
            let t = app.global::<ToolOpts>();
            let font = st.fonts.entries.get(t.get_font_index().max(0) as usize).map(|e| e.name.clone()).unwrap_or_default();
            let obj = vector::TextObj {
                text: String::new(),
                font,
                size: t.get_font_size(),
                color: rgba(app.get_primary_color()),
                align: t.get_text_align(),
                antialias: t.get_antialias(),
                x,
                y,
                m: None,
            };
            let l = &mut st.doc.layers[k];
            let Some(v) = l.vector.as_mut() else { return };
            v.objects.push(vector::Obj::Text(obj));
            let i = v.objects.len() - 1;
            // fond de la saisie : les textes déjà posés, sans effets (rejoués à la validation)
            let others = v.render_others(&mut st.fonts, w, h, i);
            let l = &mut st.doc.layers[k];
            l.px = others.into();
            let uid = l.uid;
            st.text_edit = Some(TextEdit { x, y, base: l.px.clone(), layer: Some(uid), created: false, prev: None, obj: i, new_obj: true });
            app.set_text_value(SharedString::default());
            app.set_text_active(true);
            app.set_text_serial(app.get_text_serial() + 1);
            render_text(app, st);
            refresh_all(app, st);
            return;
        }
        let (w, h) = (st.doc.w, st.doc.h);
        st.doc.add_layer_in();
        let n = st.doc.layers.iter().filter(|l| l.vector.is_some()).count() + 1;
        let l = st.doc.layer_mut();
        l.name = i18n::tr_format!("Texte {n}");
        l.vector = Some(Box::new(vector::VectorLayer::with_text(vector::TextObj {
            text: String::new(),
            font: String::new(),
            size: 32.0,
            color: [0, 0, 0, 255],
            align: 0,
            antialias: true,
            x,
            y,
            m: None,
        })));
        l.px = vec![0u8; w * h * 4].into();
        let uid = l.uid;
        st.text_edit = Some(TextEdit { x, y, base: st.doc.layer().px.clone(), layer: Some(uid), created: true, prev: None, obj: 0, new_obj: true });
        sync_panels(app, st);
    } else {
        if let Some(why) = st.doc.edit_refusal() {
            status(app, why);
            return;
        }
        st.text_edit = Some(TextEdit { x, y, base: st.doc.layer().px.clone(), layer: None, created: false, prev: None, obj: 0, new_obj: false });
    }
    app.set_text_value(SharedString::default());
    app.set_text_active(true);
    app.set_text_serial(app.get_text_serial() + 1);
    render_text(app, st);
}

/// Refait les pixels d'un calque vectoriel : objets tout de suite, puis sa pile d'effets en
/// arrière-plan (un effet après l'autre). Le résultat remplace aussi les pixels de l'étape
/// d'historique courante, pour qu'annuler / rétablir retrouve le rendu complet.
fn render_vector_layer(app: &AppWindow, st: &mut State, uid: u64) {
    let (w, h) = (st.doc.w, st.doc.h);
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == uid) else { return };
    let Some(mut v) = st.doc.layers[k].vector.as_deref().cloned() else { return };
    let raw = v.render_objects(&mut st.fonts, w, h);
    let serial = editor::next_uid();
    v.serial = serial;
    let fx: Vec<vector::Fx> = v.effects.iter().filter(|f| f.on).cloned().collect();
    let l = &mut st.doc.layers[k];
    l.vector = Some(Box::new(v));
    l.px = raw.clone().into();
    if !fx.is_empty() {
        vector_fx_step(app, st, uid, serial, std::sync::Arc::new(raw), fx, 0);
    }
}

/// Effet `i` de la pile d'un calque vectoriel, puis le suivant.
fn vector_fx_step(app: &AppWindow, st: &mut State, uid: u64, serial: u64, src: std::sync::Arc<Vec<u8>>, fx: Vec<vector::Fx>, i: usize) {
    let (w, h) = (st.doc.w, st.doc.h);
    let Some(f) = fx.get(i).cloned() else { return };
    let job = background::Heavy::Effect { name: f.name.clone(), src: src.clone(), w, h, p: f.p.clone(), post: f.post.clone() };
    background::spawn(app, st, job, move |app, st, out| {
        let current = |st: &State| st.doc.layers.iter().position(|l| l.uid == uid && l.vector.as_ref().is_some_and(|v| v.serial == serial));
        let Some(k) = current(st) else { return };
        let (w, h) = (st.doc.w, st.doc.h);
        let px = match out {
            Some(px) if px.len() == w * h * 4 => px,
            _ => src.to_vec(),
        };
        if i + 1 < fx.len() {
            return vector_fx_step(app, st, uid, serial, std::sync::Arc::new(px), fx, i + 1);
        }
        let px: editor::Px = px.into();
        st.doc.layers[k].px = px.clone();
        let hi = st.doc.hindex;
        if let Some(snap) = st.doc.history.get_mut(hi) {
            if let Some(l) = snap.layers.iter_mut().find(|l| l.uid == uid && l.vector.as_ref().is_some_and(|v| v.serial == serial)) {
                l.px = px;
            }
        }
        refresh_all(app, st);
    });
}

/// Effet du menu appliqué à un calque texte : ajouté à sa pile (non destructif) au lieu de
/// modifier ses pixels. `true` si l'effet a été pris en charge ici.
fn vector_layer_effect(app: &AppWindow, st: &mut State, name: &str, p: &[f32], post: Option<Vec<f32>>, label: &str) -> bool {
    let k = st.doc.active;
    if st.doc.layers.get(k).map_or(true, |l| l.vector.is_none()) {
        return false;
    }
    if !vector::effect_allowed(name) {
        status(app, i18n::tr_format!("{label} : indisponible sur un calque texte (Calques › Pixelliser le calque)"));
        st.doc.goto(st.doc.hindex);
        refresh_all(app, st);
        return true;
    }
    let uid = st.doc.layers[k].uid;
    if let Some(v) = st.doc.layers[k].vector.as_mut() {
        v.effects.push(vector::Fx { name: name.into(), label: label.into(), p: p.to_vec(), post, on: true });
    }
    render_vector_layer(app, st, uid);
    st.doc.commit(label);
    refresh_all(app, st);
    status(app, i18n::tr_format!("{label} : ajouté aux effets du calque texte (modifiables, non destructifs)"));
    true
}

/// Effet en cours de réglage sur un calque dynamique : pile d'origine (remise à Annuler) et
/// étage remplacé (`None` : l'effet s'ajoute au bout).
struct DynEdit {
    uid: u64,
    orig: Vec<(String, f32)>,
    cache: Option<std::sync::Arc<Vec<u8>>>,
    index: Option<usize>,
}

/// Effets refusés dans la pile d'un calque dynamique : ils ont besoin de pixels peints
/// (détourage, remplissage, retouches) ou découpent l'image.
fn dyn_effect_allowed(name: &str) -> bool {
    !matches!(name, "contentfill" | "content_fill" | "removebg" | "cutout" | "cutoutsel" | "selection_cutout" | "splitrgb" | "redeyeremove")
}

/// Aperçu d'un effet sur le calque dynamique actif : sa pile d'origine avec l'étage `kind` (à
/// la place de l'étage modifié, sinon au bout), recalculée et affichée — ses pixels (la zone)
/// ne changent pas. Faux si le calque actif n'est pas dynamique.
fn dyn_preview(app: &AppWindow, st: &mut State, kind: String) -> bool {
    let l = st.doc.layer();
    let Some(stack) = l.dynamic.clone() else { return false };
    let uid = l.uid;
    if st.dyn_fx.as_ref().map_or(true, |d| d.uid != l.uid) {
        st.dyn_fx = Some(DynEdit { uid: l.uid, orig: stack, cache: l.dyn_cache.clone(), index: st.dyn_pending_edit.take() });
    }
    let Some(d) = st.dyn_fx.as_ref() else { return false };
    let mut list = d.orig.clone();
    match d.index {
        Some(i) if i < list.len() => editor::replace_stage(&mut list[i], kind),
        _ if list.len() < DYN_MAX => list.push((kind, editor::DYN_FULL)),
        _ => {}
    }
    st.doc.layer_mut().dynamic = Some(list);
    // grande image : rendu réduit pendant le réglage, pleine résolution après une pause
    dyn_draft(app, st, uid);
    // Keep an in-flight frame valid; its completion schedules the latest settings.
    update_dynamic(app, st);
    redraw_canvas(app, st);
    true
}

/// Fin du réglage d'un effet sur un calque dynamique : pile d'origine remise (Annuler,
/// `keep` = None) ou étage `keep` (type, titre) posé à sa place / au bout, avec une étape
/// d'historique. Faux si aucun réglage n'était en cours.
fn dyn_preview_end(app: &AppWindow, st: &mut State, keep: Option<(String, &str)>) -> bool {
    let Some(d) = st.dyn_fx.take() else { return false };
    st.dyn_pending_edit = None;
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == d.uid) else { return true };
    // dernier rendu peut-être réduit : recalcul en pleine résolution
    st.dyn_draft = None;
    dyn_invalidate(st, d.uid);
    let restore = keep.is_none();
    let keep = keep.map(|(kind,label)| (kind,i18n::tr(label)));
    let mut list = d.orig;
    let msg = match keep {
        None => None,
        Some((kind, label)) => match d.index {
            Some(i) if i < list.len() => {
                editor::replace_stage(&mut list[i], kind);
                Some((i18n::tr_format!("Modifier : {label}"), i18n::tr_format!("{label} : effet du calque dynamique modifié")))
            }
            _ if list.len() < DYN_MAX => {
                list.push((kind, editor::DYN_FULL));
                Some((label.to_string(), i18n::tr_format!("{label} : ajouté aux effets du calque dynamique")))
            }
            _ => {
                status(app, i18n::tr_format!("Filtre dynamique : {DYN_MAX} effets au maximum"));
                None
            }
        },
    };
    st.doc.layers[k].dynamic = Some(list);
    if restore {
        st.doc.layers[k].dyn_cache = d.cache;
        st.doc.layers[k].dyn_low = None;
        st.doc.layers[k].dyn_key = None;
        st.doc.layers[k].dyn_serial = 0;
    }
    if let Some((step, info)) = msg {
        st.doc.commit(&step);
        status(app, info);
    }
    refresh_all(app, st);
    true
}

fn remove_dynamic_effect(app: &AppWindow, st: &mut State) {
    let edit=st.dyn_fx.as_ref().and_then(|d|d.index.map(|i|(d.uid,i)))
        .or_else(||st.dyn_pending_edit.map(|i|(st.doc.layer().uid,i)));
    if st.curves.is_some() { curves_action(app,st,"cancel",0); } else { cancel_effect(app,st); }
    if let Some((uid,i))=edit {
        if let Some(layer)=st.doc.layers.iter_mut().find(|l|l.uid==uid) {
            if let Some(stack)=layer.dynamic.as_mut() { if i<stack.len() { stack.remove(i); } }
            layer.dyn_key=None;layer.dyn_cache=None;layer.dyn_low=None;layer.dyn_serial=0;
            st.doc.commit("Supprimer");refresh_all(app,st);
        }
    }
    app.set_effect_dynamic_edit(false);
    app.set_curves_dynamic_edit(false);
}

/// Effet du menu validé sur un calque dynamique : ajouté au bout de sa pile (ou à la place de
/// l'étage en cours de modification), au lieu de modifier ses pixels (la zone de l'effet).
/// `dialog` / `vals` : fenêtre d'origine et ses valeurs (« » sans fenêtre). `true` si l'effet a
/// été pris en charge ici.
fn dynamic_layer_effect(app: &AppWindow, st: &mut State, name: &str, p: &[f32], label: &str, dialog: &str, vals: &effects::Vals) -> bool {
    if st.doc.layer().dynamic.is_none() {
        dyn_preview_end(app, st, None);
        return false;
    }
    if !dyn_effect_allowed(name) {
        dyn_preview_end(app, st, None);
        status(app, i18n::tr_format!("{label} : indisponible sur un calque dynamique (il ne garde que des effets non destructifs)"));
        st.doc.goto(st.doc.hindex);
        refresh_all(app, st);
        return true;
    }
    let kind = editor::fx_kind(name, p, label, dialog, &vals.0);
    if st.dyn_fx.is_none() {
        // sans aperçu (effet sans fenêtre, Répéter) : réglage ouvert puis validé aussitôt
        let l = st.doc.layer();
        st.dyn_fx = Some(DynEdit { uid: l.uid, orig: l.dynamic.clone().unwrap_or_default(), cache: l.dyn_cache.clone(), index: st.dyn_pending_edit.take() });
    }
    dyn_preview_end(app, st, Some((kind, label)))
}

/// Calque actif qui refuse les pixels : marqueur des entrées de menu grisées (« calque texte »,
/// « verrouillé », « dossier » ; lu par MenuRow, les menus du téléphone et la fenêtre Outils),
/// vide sinon.
fn layer_block_mark(st: &State) -> &'static str {
    let Some(l) = st.doc.layers.get(st.doc.active) else { return "" };
    if l.vector.is_some() {
        "calque texte"
    } else if l.locked {
        "verrouillé"
    } else if l.group {
        "dossier"
    } else {
        ""
    }
}

/// Entrée de menu qui modifie les pixels du calque actif (grisée sur un calque verrouillé ou un
/// dossier ; sur un calque texte, voir `vector::action_allowed`).
fn action_edits_layer(action: &str) -> bool {
    action.starts_with("fx:")
        || [
            "splitActiveLayerRgbChannels", "illuGuidedCutoutToolStart", "illuRemoveBackgroundIntelligent",
            "showContentAwareFillDialog", "openCameraRawForActiveLayer", "openLevelsForActiveLayer",
            "openCurvesForActiveLayer", "clearSelectionContent", "ctxCut", "showInstantFilterGallery",
            "illuRepeatLastEffect", "illuMenuVectorizeBitmap",
        ]
        .iter()
        .any(|k| action.contains(k))
}

/// Marqueur d'une entrée selon le calque actif : grisée (`mark`) ou marqueur habituel.
fn item_badge(mark: &'static str, action: &str, label: &str) -> &'static str {
    let blocked = match mark {
        "" => false,
        "calque texte" => !vector::action_allowed(action),
        _ => action_edits_layer(action),
    };
    if blocked { mark } else { action_badge(action, label) }
}

thread_local! {
    /// marqueur appliqué aux menus (« ? » : menus refaits, à reprendre)
    static MENU_MARK: std::cell::Cell<&'static str> = const { std::cell::Cell::new("?") };
}

/// Grise les entrées de menu, les outils et les boutons du ruban indisponibles pour le calque
/// actif (calque texte, verrouillé, dossier). Les menus ne sont repris que si l'état change.
fn sync_layer_blocks(app: &AppWindow, st: &State) {
    let mark = layer_block_mark(st);
    let ms = app.global::<MenuState>();
    if ms.get_layer_block().as_str() != mark {
        ms.set_layer_block(mark.into());
    }
    if app.get_pm_open() || MENU_MARK.with(|m| m.get()) == mark {
        return;
    }
    MENU_MARK.with(|m| m.set(mark));
    let menus = app.get_menus();
    for m in (0..menus.row_count()).filter_map(|i| menus.row_data(i)) {
        for j in 0..m.items.row_count() {
            let Some(mut it) = m.items.row_data(j) else { continue };
            if it.separator {
                continue;
            }
            if it.submenu {
                for k in 0..it.children.row_count() {
                    let Some(mut c) = it.children.row_data(k) else { continue };
                    let b = i18n::tr(item_badge(mark, &c.action, &c.label));
                    if c.badge.as_str() != b {
                        c.badge = b.into();
                        it.children.set_row_data(k, c);
                    }
                }
            } else {
                let b = i18n::tr(item_badge(mark, &it.action, &it.label));
                if it.badge.as_str() != b {
                    it.badge = b.into();
                    m.items.set_row_data(j, it);
                }
            }
        }
    }
}

/// Outils qui peignent dans le calque actif.
fn paints_pixels(t: Tool) -> bool {
    tools::is_stroke(t) || matches!(t, Tool::Fill | Tool::Gradient | Tool::Shape | Tool::RoundRect | Tool::Line)
}

/// Le calque actif refuse les pixels (verrou, dossier) : message, `true`. Calque texte :
/// propose de le pixelliser d'abord.
fn layer_guard(app: &AppWindow, st: &mut State) -> bool {
    if let Some(why) = st.doc.edit_refusal() {
        status(app, why);
        return true;
    }
    // formes tracées sur un calque vectoriel (hors sélection) : elles y deviennent des objets
    // modifiables (handle_outcome), pas des pixels
    let shape_tool = matches!(st.tool, Tool::Shape | Tool::RoundRect | Tool::Line | Tool::Fill);
    if st.doc.layer().vector.is_some() && !shape_tool {
        st.task = Some(Task::Rasterize(st.doc.layer().uid));
        show_task(
            app,
            "Calque SVG",
            "Ce calque est un calque SVG (textes et formes modifiables). Pour y peindre, il doit d'abord redevenir un calque de pixels : ses objets ne seront plus modifiables.",
            "",
            "",
            &[
                ("Pixelliser le calque", "Transforme ses textes, formes et effets en pixels ordinaires, puis vous pouvez peindre."),
                ("Annuler", "Garde le calque SVG modifiable (outils Texte, Formes, Déplacer, Pot de peinture)."),
            ],
            Vec::new(),
        );
        return true;
    }
    false
}

/// Outils Formes avec « Calque SVG » : la forme va sur un calque vectoriel, où elle reste un
/// objet modifiable — le calque actif s'il l'est, celui juste au-dessus, sinon un nouveau calque
/// (retiré si le geste ne trace rien). Pas en animation pixel, ni sur un masque α ou un calque ƒ :
/// la forme y est peinte en pixels. Une sélection ne découpe pas un objet.
fn prepare_shape_layer(app: &AppWindow, st: &mut State) {
    drop_empty_shape_layer(app, st);
    let d = &st.doc;
    if !(app.global::<ToolOpts>().get_shape_layer() || d.vector_mode)
        || d.layer().vector.is_some()
        || d.mask_of.is_some()
        || (d.anim.is_some() && !d.vector_mode)
        || d.layer().dynamic.is_some()
        || d.edit_refusal().is_some()
    {
        return;
    }
    let above = d.active + 1;
    if d.layers.get(above).is_some_and(|l| l.vector.is_some() && l.visible && l.parent == d.layer().parent) && !d.locked_at(above) {
        st.doc.active = above;
        sync_panels(app, st);
        return;
    }
    let prev = st.doc.active;
    st.doc.add_layer_in();
    let n = st.doc.layers.iter().filter(|l| l.vector.is_some()).count() + 1;
    let l = st.doc.layer_mut();
    l.name = i18n::tr_format!("Formes {n}");
    l.vector = Some(Box::new(vector::VectorLayer::default()));
    st.shape_layer_new = Some((l.uid, prev));
    sync_panels(app, st);
}

/// Retire le calque SVG créé par `prepare_shape_layer` quand le geste n'a rien tracé.
fn drop_empty_shape_layer(app: &AppWindow, st: &mut State) {
    let Some((uid, prev)) = st.shape_layer_new.take() else { return };
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == uid) else { return };
    if st.doc.layers[k].vector.as_ref().is_some_and(|v| v.objects.is_empty()) {
        st.doc.layers.remove(k);
        st.doc.active = prev.min(st.doc.layers.len() - 1);
        refresh_all(app, st);
    }
}

/// Outil Déplacer sur un calque texte sans sélection : le texte sous le pointeur le suit et il
/// est redessiné net à sa nouvelle place (hors d'un texte : rien). `true` si le geste est pris
/// ici.
fn vector_move_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32) -> bool {
    if kind == 0 {
        st.vector_drag = None;
        st.vector_drag_base = None;
        if st.tool != Tool::Move || st.doc.sel.is_some() || st.floating.is_some() || st.doc.layer().vector.is_none() {
            return false;
        }
        if st.doc.locked_at(st.doc.active) {
            status(app, "Calque verrouillé : cliquez sur son cadenas (panneau Calques) pour le déverrouiller");
            return true;
        }
        let Some(v) = st.doc.layer().vector.as_deref().cloned() else { return true };
        let Some(i) = v.hit_index(&mut st.fonts, x, y) else {
            // calque texte : les pixels ne se déplacent pas, seuls ses textes
            status(app, "Cliquez sur un texte ou une forme du calque pour le déplacer");
            return true;
        };
        st.vector_drag = Some((st.doc.layer().uid, x.round(), y.round(), i, false));
        // objet saisi : il devient l'objet choisi du panneau Objets SVG
        svg_panel::picked(app, st, i);
        return true;
    }
    let Some((uid, lx, ly, i, moved)) = st.vector_drag else { return false };
    let Some(k) = st.doc.layers.iter().position(|l| l.uid == uid) else {
        st.vector_drag = None;
        st.vector_drag_base = None;
        return true;
    };
    let (w, h) = (st.doc.w, st.doc.h);
    let (x, y) = (x.round(), y.round());
    if x != lx || y != ly {
        if !moved {
            // début du geste : les autres textes sans effets (effets rejoués au relâchement)
            if let Some(v) = st.doc.layers[k].vector.as_deref() {
                let base: editor::Px = v.render_others(&mut st.fonts, w, h, i).into();
                st.doc.layers[k].px = base.clone();
                st.vector_drag_base = Some((base, None));
            }
        }
        if let Some(v) = st.doc.layers[k].vector.as_mut() {
            v.translate_obj(i, x - lx, y - ly);
        }
        st.vector_drag = Some((uid, x, y, i, true));
        // seul le cadre de l'objet est redessiné (ancien cadre remis au fond, nouveau posé)
        let mut dirty = None;
        if let Some((base, prev)) = st.vector_drag_base.as_mut() {
            let l = &mut st.doc.layers[k];
            if let Some(v) = l.vector.as_deref() {
                if let Some(p) = *prev {
                    text::restore_rect(&mut l.px, Some(&base[..]), w, p);
                }
                let new = v.draw_obj(&mut st.fonts, i, &base[..], &mut l.px, w, h);
                dirty = union_rect(*prev, new);
                *prev = new;
            }
        }
        refresh_rect(app, st, Some(dirty.unwrap_or((0, 0, w, h))));
    }
    if kind == 2 {
        st.vector_drag = None;
        st.vector_drag_base = None;
        if moved || x != lx || y != ly {
            render_vector_layer(app, st, uid);
            st.doc.commit("Déplacer l'objet");
            refresh_all(app, st);
        }
    }
    true
}

/// Pot de peinture sur un calque vectoriel : l'objet sous le pointeur (le plus haut) prend la
/// couleur `c` (opacité de la forme gardée), étape d'historique.
fn vector_recolor(app: &AppWindow, st: &mut State, x: f32, y: f32, c: [u8; 4]) {
    // projet SVG : l'objet visible sous le pointeur, quel que soit son calque
    let picked = if st.doc.vector_mode { vecedit::pick(st, app.get_zoom(), x, y) } else { None };
    if let Some((k, _)) = picked {
        st.doc.active = k;
    }
    let k = st.doc.active;
    let uid = st.doc.layers[k].uid;
    let Some(mut v) = st.doc.layers[k].vector.as_deref().cloned() else { return };
    let Some(i) = picked.map(|p| p.1).or_else(|| if st.doc.vector_mode { None } else { v.hit_index(&mut st.fonts, x, y) }) else {
        status(app, "Cliquez sur une forme ou un texte du calque vectoriel pour le recolorer");
        return;
    };
    // forme : clic sur le contour = couleur du trait ; clic dedans = remplissage (une forme en
    // contour seul se remplit, son trait reste) ; texte : sa couleur
    let label = match v.objects.get_mut(i) {
        Some(vector::Obj::Shape(s)) => {
            let (inside, on_edge) = s.hit_parts(x, y, 2.0);
            if s.is_stroke_only() || (on_edge && s.style != ShapeStyle::Fill) {
                s.color = [c[0], c[1], c[2], s.color[3]];
                "Couleur du trait"
            } else if inside {
                s.grad = None;
                if s.style == ShapeStyle::Fill {
                    s.color = [c[0], c[1], c[2], s.color[3]];
                    s.fill = None;
                } else {
                    s.fill = Some([c[0], c[1], c[2], s.color[3]]);
                }
                "Remplir la forme"
            } else {
                status(app, "Cliquez dans la forme (remplissage) ou sur son contour (trait)");
                return;
            }
        }
        Some(vector::Obj::Text(t)) => {
            t.color = [c[0], c[1], c[2], t.color[3]];
            "Recolorer le texte"
        }
        None => return,
    };
    st.doc.layers[k].vector = Some(Box::new(v));
    render_vector_layer(app, st, uid);
    st.doc.commit(label);
    refresh_all(app, st);
}

/// Opérations du panneau et du menu Calques (dossiers compris).
fn layer_op(app: &AppWindow, st: &mut State, a: &str) {
    drop_floating(app, st);
    commit_text(app, st);
    let r: Result<&str, groups::Refused> = match a {
        "add" if st.doc.vector_mode => return layer_op(app, st, "vector-new"),
        "add" => {
            st.doc.add_layer_in();
            Ok("Ajouter un calque")
        }
        // calque vectoriel vide (mode SVG) : formes et textes y restent des objets modifiables
        "vector-new" => {
            st.doc.add_layer_in();
            let n = st.doc.layers.iter().filter(|l| l.vector.is_some()).count() + 1;
            let l = st.doc.layer_mut();
            l.name = i18n::tr_format!("Vecteur {n}");
            l.vector = Some(Box::new(vector::VectorLayer::default()));
            status(app, "Calque vectoriel : tracez des formes (Formes, Rectangle arrondi, Ligne) ou du texte ; Déplacer les déplace, Pot de peinture les recolore");
            Ok("Nouveau calque vectoriel")
        }
        "delete" => st.doc.delete_layer_in().map(|_| "Supprimer le calque"),
        "duplicate" => {
            st.doc.duplicate_in();
            Ok("Dupliquer le calque")
        }
        "merge" => st.doc.merge_in().map(|_| "Fusionner le calque"),
        "up" => {
            st.doc.move_in(true);
            Ok("Monter le calque")
        }
        "down" => {
            st.doc.move_in(false);
            Ok("Descendre le calque")
        }
        "dynamic-everywhere" | "dynamic-mask" => {
            let l = st.doc.layer_mut();
            if l.dynamic.is_none() { return; }
            l.dynamic_mode = if a == "dynamic-everywhere" { 2 } else { 0 };
            let uid = l.uid;
            dyn_invalidate(st, uid);
            Ok("Filtre dynamique")
        }
        "dynamic-mask-view" => {
            let uid = st.doc.layer().uid;
            if st.doc.layer().dynamic.is_none() { return; }
            let old = editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed);
            editor::DYN_ZONE_VIEW.store(if old == uid { 0 } else { uid }, std::sync::atomic::Ordering::Relaxed);
            redraw_canvas(app, st);
            sync_panels(app,st);
            return;
        }
        "group-new" => {
            st.doc.add_group();
            Ok("Nouveau dossier")
        }
        "group" => {
            st.doc.group_active();
            Ok("Grouper les calques")
        }
        "ungroup" => st.doc.ungroup_active().map(|_| "Dégrouper"),
        "pass" => {
            let l = st.doc.layer_mut();
            if !l.group {
                return status(app, "Mode Transfert : sélectionnez un dossier");
            }
            l.pass = !l.pass;
            Ok(if l.pass { "Dossier : mode Transfert" } else { "Dossier : composé à part" })
        }
        "lock" => {
            let l = st.doc.layer_mut();
            l.locked = !l.locked;
            Ok(if l.locked { "Verrouiller le calque" } else { "Déverrouiller le calque" })
        }
        "rasterize" => {
            let k = st.doc.active;
            if st.doc.layers[k].vector.is_none() {
                return status(app, "Pixelliser : le calque actif n'est pas un calque texte");
            }
            return rasterize_layer(app, st, k);
        }
        "text-fx" => {
            if st.doc.layer().vector.is_none() {
                return status(app, "Effets du texte : le calque actif n'est pas un calque texte");
            }
            sync_text_fx(app, st);
            app.set_show_text_fx(true);
            return;
        }
        _ => return,
    };
    match r {
        Ok(label) => {
            st.doc.commit(label);
            refresh_all(app, st);
        }
        Err(why) => status(app, why),
    }
}

/// The compact manager contains only effects already applied to this layer.
fn applied_quick(kind: &str) -> Option<(String,String,f32,f32,f32,f32)> {
    if let Some((id,values))=editor::fx_dialog(kind) {
        let (_,fields)=effects::dialog(&id)?;
        let f=fields.iter().find(|f|f.kind==0)?;
        let value=values.get(f.id).and_then(|s|s.parse::<f32>().ok()).unwrap_or(f.def);
        return Some((f.id.into(),f.label.into(),value,f.min,f.max,f.step));
    }
    if editor::fx_engine(kind).as_deref()==Some("dynstage") {
        let p=editor::fx_params(kind)?;
        return p.get(1).map(|v|("legacy-radius".into(),"Rayon".into(),*v,0.0,128.0,1.0));
    }
    if editor::dyn_code(editor::dyn_base(kind)).is_some() {
        return Some(("legacy-radius".into(),"Rayon".into(),0.0,0.0,128.0,1.0));
    }
    None
}
// ------------------------------------------------------------------ animation (frise)

thread_local! {
    /// lecture de l'animation : minuterie et sens courant (lecture aller-retour)
    static ANIM_PLAY: slint::Timer = slint::Timer::default();
    static ANIM_DIR: std::cell::Cell<i32> = const { std::cell::Cell::new(1) };
}

/// Entrées de menu utilisables sans projet ouvert.
const NO_DOC_ACTIONS: &[&str] = &[
    "showNewProjectDialog", "showSettingsDialog", "showChangelog", "showDownloadDialog", "showWelcomeDialog", "PhotoModeManager.open", "win-", "toggleIllu",
    "resetWorkspace", "illuOpenSnapSettings", "openIconViewerWindow", "ctxPaste", "rust:paste-new",
];

/// Actions qui changent la taille de l'image : pas encore appliquées à tous les dessins de la
/// frise (rotations et retournements, eux, le sont : `anim_map_cels`).
const ANIM_BLOCKED: &[&str] = &["resizeCanvas()", "showExtendCanvasDialog", "cropToSelection", "startIlluInteractiveCrop", "showPixelTransformDialog", "expandCanvasToLayers"];

/// Frise, réglages de lecture et pelure d'oignon d'après le document actif.
fn sync_anim(app: &AppWindow, st: &State) {
    let Some(a) = st.doc.anim.as_ref() else {
        if app.get_anim_on() {
            stop_anim(app);
            app.set_anim_on(false);
            app.set_onion_shown(false);
        }
        return;
    };
    app.set_anim_on(true);
    app.set_anim_frame(a.playhead as i32);
    app.set_anim_duration(a.duration as i32);
    app.set_anim_fps(a.fps as i32);
    app.set_anim_loop(a.looping);
    app.set_anim_pingpong(a.pingpong);
    app.set_anim_onion(a.onion);
    app.set_anim_onion_all(a.onion_all);
    app.set_anim_draw_step(a.draw_step);
    app.set_anim_has_clip(anim::has_cel_clip(&st.doc));
    let rows: Vec<AnimRow> = st
        .doc
        .layers
        .iter()
        .enumerate()
        .rev()
        .filter(|(_, l)| anim::animated(l))
        .map(|(i, l)| AnimRow {
            name: l.name.as_str().into(),
            layer: i as i32,
            active: i == st.doc.active,
            visible: l.visible,
            cells: ModelRc::new(VecModel::from(anim::row_cells(l, a.duration))),
        })
        .collect();
    app.set_anim_rows(ModelRc::new(VecModel::from(rows)));
    sync_onion(app, st);
}

/// Pelure d'oignon (réduite à 1280 px au plus : elle n'est qu'un repère).
fn sync_onion(app: &AppWindow, st: &State) {
    match anim::onion(&st.doc, 1280) {
        Some((px, w, h)) => {
            app.set_onion_image(to_image(&px, w, h));
            app.set_onion_shown(true);
        }
        None => app.set_onion_shown(false),
    }
}

fn stop_anim(app: &AppWindow) {
    ANIM_PLAY.with(|t| t.stop());
    app.set_anim_playing(false);
}

/// Va à l'image `t` (affichage et panneaux à jour).
fn anim_seek(app: &AppWindow, st: &mut State, t: usize) {
    if st.doc.anim.is_none() {
        return;
    }
    anim::goto(&mut st.doc, t);
    refresh_all(app, st);
}

/// Lecture / pause. Pendant la lecture, seule la toile est recomposée à chaque image.
fn toggle_play(app: &AppWindow, st: &mut State) {
    if app.get_anim_playing() {
        stop_anim(app);
        refresh_all(app, st);
        return;
    }
    let Some(a) = st.doc.anim.as_ref() else { return };
    // lecture unique déjà au bout : on repart du début
    if !a.looping && !a.pingpong && a.playhead + 1 >= a.duration {
        anim::goto(&mut st.doc, 0);
    }
    let fps = st.doc.anim.as_ref().map_or(12, |a| a.fps.max(1));
    anim::stash(&mut st.doc);
    ANIM_DIR.with(|d| d.set(1));
    app.set_anim_playing(true);
    let weak = app.as_weak();
    ANIM_PLAY.with(|t| {
        t.start(slint::TimerMode::Repeated, std::time::Duration::from_millis((1000 / fps) as u64), move || {
            let Some(app) = weak.upgrade() else { return };
            let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            let st = &mut *st;
            let next = st.doc.anim.as_ref().and_then(|a| {
                ANIM_DIR.with(|d| {
                    let mut dir = d.get();
                    let n = anim::next_play_frame(a, &mut dir);
                    d.set(dir);
                    n
                })
            });
            let Some(t) = next else {
                stop_anim(&app);
                refresh_all(&app, st);
                return;
            };
            anim::goto(&mut st.doc, t);
            update_dynamic(&app, st);
            redraw_canvas(&app, st);
            app.set_anim_frame(t as i32);
            if st.doc.anim.as_ref().is_some_and(|a| a.onion) {
                sync_onion(&app, st);
            }
        })
    });
}

/// Boutons de la frise et entrée de menu « Animation (frise) » (`toggle`).
fn anim_action(app: &AppWindow, st: &mut State, what: &str) {
    if what == "toggle" {
        finish_edits(app, st);
        stop_anim(app);
        if st.doc.anim.is_some() {
            anim::disable(&mut st.doc);
            st.doc.commit("Quitter le mode animation");
            status(app, "Mode animation quitté : chaque calque garde l'image courante");
        } else {
            anim::enable(&mut st.doc);
            st.doc.commit("Mode animation");
            app.set_anim_open(true);
            status(app, "Mode animation : dessinez, puis + pour une nouvelle image (pelure d'oignon pour voir la précédente)");
        }
        refresh_all(app, st);
        return;
    }
    let Some((t, dur)) = st.doc.anim.as_ref().map(|a| (a.playhead, a.duration)) else { return };
    if what != "play" && app.get_anim_playing() {
        stop_anim(app);
    }
    let flip = |st: &mut State, f: fn(&mut anim::Anim)| {
        if let Some(a) = st.doc.anim.as_mut() {
            f(a);
        }
    };
    let label = match what {
        "play" => return toggle_play(app, st),
        "first" => return anim_seek(app, st, 0),
        "prev" => return anim_seek(app, st, if t == 0 { dur - 1 } else { t - 1 }),
        "next" => return anim_seek(app, st, if t + 1 >= dur { 0 } else { t + 1 }),
        "last" => return anim_seek(app, st, dur - 1),
        "onion" | "onion-all" | "loop" | "pingpong" | "draw-step" => {
            match what {
                "onion" => flip(st, |a| a.onion = !a.onion),
                "onion-all" => flip(st, |a| a.onion_all = !a.onion_all),
                "loop" => flip(st, |a| a.looping = !a.looping),
                "pingpong" => flip(st, |a| a.pingpong = !a.pingpong),
                _ => flip(st, |a| a.draw_step = !a.draw_step),
            }
            sync_anim(app, st);
            return;
        }
        "export-gif" => return export_anim(app, st, true),
        "export-sheet" => return export_anim(app, st, false),
        "exit" => return anim_action(app, st, "toggle"),
        "add" => {
            anim::add_frame(&mut st.doc);
            "Ajouter une image"
        }
        "dup" => {
            anim::duplicate_cel(&mut st.doc);
            "Dupliquer le dessin"
        }
        "insert" => {
            anim::insert_frame(&mut st.doc);
            "Insérer une image"
        }
        "delete" => {
            anim::remove_frame(&mut st.doc);
            "Supprimer l'image"
        }
        "reverse" => {
            anim::reverse(&mut st.doc);
            "Inverser l'animation"
        }
        _ => return,
    };
    st.doc.commit(label);
    refresh_all(app, st);
}

/// Clic sur une case de la frise : calque `li` (−1 : règle des images) actif, image `f`.
fn anim_cell(app: &AppWindow, st: &mut State, li: i32, f: i32) {
    if st.doc.anim.is_none() {
        return;
    }
    if app.get_anim_playing() {
        stop_anim(app);
    }
    if li >= 0 && (li as usize) < st.doc.layers.len() && li as usize != st.doc.active {
        finish_edits(app, st);
        st.doc.active = li as usize;
    }
    anim_seek(app, st, f.max(0) as usize);
}

/// Menu d'un dessin de la frise (clic droit), double-clic (image clé), glisser (déplacer).
fn anim_cell_op(app: &AppWindow, st: &mut State, op: &str, li: i32, f: i32) {
    if st.doc.anim.is_none() || li < 0 || li as usize >= st.doc.layers.len() {
        return;
    }
    stop_anim(app);
    finish_edits(app, st);
    let (li, f) = (li as usize, f.max(0) as usize);
    let n = |p: &str| op.strip_prefix(p).and_then(|v| v.parse::<usize>().ok());
    let label = if op == "key" {
        anim::key_here(&mut st.doc, li, f);
        "Image clé"
    } else if op == "blank" {
        st.doc.active = li;
        anim::goto(&mut st.doc, f);
        anim::clear_cel(&mut st.doc, li, f);
        if f != 0 {
            anim::ensure_blank_cel(&mut st.doc);
        }
        "Dessin vierge"
    } else if op == "clear" {
        anim::clear_cel(&mut st.doc, li, f);
        "Effacer le dessin"
    } else if op == "hold" {
        anim::hold_until(&mut st.doc, li, f);
        "Figer le dessin"
    } else if op == "holdinf" {
        anim::hold_forever(&mut st.doc, li, f);
        "Maintenir le dessin"
    } else if op == "copy" {
        anim::copy_cel(&mut st.doc, li, f);
        app.set_anim_has_clip(true);
        status(app, "Dessin copié : clic droit sur une autre image › Coller le dessin ici");
        return;
    } else if op == "paste" {
        if !anim::paste_cel(&mut st.doc, li, f) {
            return;
        }
        "Coller le dessin"
    } else if let Some(k) = n("repeat:") {
        anim::repeat_cel(&mut st.doc, li, f, k);
        "Répéter le dessin"
    } else if let Some(k) = n("exposure:") {
        st.doc.active = li;
        anim::set_exposure(&mut st.doc, k);
        "Cadence de l'animation"
    } else if let Some(to) = n("move:") {
        anim::move_cel(&mut st.doc, li, f, to);
        anim::goto(&mut st.doc, to);
        "Déplacer un dessin"
    } else {
        return;
    };
    st.doc.commit(label);
    refresh_all(app, st);
}

/// Réglages numériques de la frise : images par seconde, nombre d'images.
fn anim_set(app: &AppWindow, st: &mut State, what: &str, v: i32) {
    let playing = app.get_anim_playing();
    match what {
        "fps" => {
            if let Some(a) = st.doc.anim.as_mut() {
                a.fps = v.clamp(1, 60) as u32;
            }
            // lecture en cours : reprise à la nouvelle cadence
            if playing {
                stop_anim(app);
                toggle_play(app, st);
            }
            sync_anim(app, st);
        }
        "duration" => {
            stop_anim(app);
            anim::set_duration(&mut st.doc, v.max(1) as usize);
            st.doc.commit("Durée de l'animation");
            refresh_all(app, st);
        }
        _ => {}
    }
}

/// Mode animation : même transformation de l'image entière (rotation, retournement) sur
/// tous les dessins de la frise ; hors animation, sur le document seul.
fn anim_map_cels(doc: &mut Doc, op: impl Fn(&mut Doc)) {
    if doc.anim.is_none() {
        return op(doc);
    }
    anim::stash(doc);
    let (w, h) = (doc.w, doc.h);
    for li in 0..doc.layers.len() {
        if !anim::animated(&doc.layers[li]) {
            continue;
        }
        for k in 0..doc.layers[li].cels.len() {
            let mut l = doc.layers[li].clone();
            l.cels.clear();
            l.px = doc.layers[li].cels[k].px.clone();
            let mut d = Doc::scratch(w, h, vec![l]);
            op(&mut d);
            doc.layers[li].cels[k].px = d.layers[0].px.clone();
        }
    }
    op(doc);
    anim::resolve(doc);
}

/// Export de l'animation : GIF animé ou planche de sprites (PNG), encodé en arrière-plan.
fn export_anim(app: &AppWindow, st: &mut State, gif: bool) {
    let Some(a) = st.doc.anim.clone() else { return };
    stop_anim(app);
    anim::stash(&mut st.doc);
    let (w, h) = (st.doc.w, st.doc.h);
    let frames = anim::all_frames(&st.doc);
    let stem = st.doc.title.rsplit_once('.').map(|(a, _)| a.to_string()).unwrap_or_else(|| st.doc.title.clone());
    let title = if gif { "GIF animé" } else { "Planche de sprites" };
    begin_busy(app, title, "Encodage des images…", w * h * frames.len() > 2_000_000);
    let job = background::Heavy::Local(Box::new(move || if gif { anim::encode_gif(&frames, w, h, a.fps, a.looping) } else { anim::sprite_sheet(&frames, w, h) }));
    background::spawn(app, st, job, move |app, _st, out| {
        end_busy(app);
        let Some(bytes) = out else {
            show_error(app, title, &i18n::tr("L'animation n'a pas pu être encodée."));
            return;
        };
        let (ext, mime, label) = if gif { ("gif", "image/gif", "GIF") } else { ("png", "image/png", "PNG") };
        let name = if gif { format!("{stem}.gif") } else { format!("{stem}-planche.png") };
        offer_file(app, &name, label, ext, mime, bytes);
    });
}

/// Propose d'enregistrer un fichier produit (fenêtre du système, téléchargement sur le web).
fn offer_file(app: &AppWindow, name: &str, label: &str, ext: &str, mime: &str, bytes: Vec<u8>) {
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    {
        let _ = mime;
        let Some(path) = rfd::FileDialog::new().set_file_name(name).add_filter(label, &[ext]).save_file() else { return };
        if std::fs::write(&path, &bytes).is_ok() {
            status(app, i18n::tr_format!("Exporté : {}", path.display()));
        } else {
            show_error(app, "Exporter", &i18n::tr_format!("Écriture impossible : {}", path.display()));
        }
    }
    #[cfg(target_os = "android")]
    {
        let _ = (label, ext);
        android_io::save(name, mime, bytes, |_| {});
        status(app, i18n::tr_format!("Exporté : {name}"));
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = (label, ext);
        web::download_bytes(&bytes, name, mime);
        status(app, i18n::tr_format!("Exporté : {name}"));
    }
}

/// Ouvre un GIF animé dans un nouvel onglet en mode animation ; faux si ce n'en est pas un.
fn open_animated_gif(app: &AppWindow, st: &mut State, name: &str, bytes: &[u8]) -> bool {
    if !name.to_lowercase().ends_with(".gif") {
        return false;
    }
    let Some((frames, w, h, fps)) = anim::decode_gif(bytes) else { return false };
    let n = frames.len();
    let mut doc = anim::doc_from_frames(frames, w, h, fps, name);
    doc.saved = (usize::MAX, 0);
    set_document(app, st, doc);
    app.set_anim_open(true);
    status(app, i18n::tr_format!("GIF animé ouvert : {n} images à {fps} images par seconde"));
    true
}

/// Outils › Importer une séquence d'images : chaque fichier devient une image de l'animation
/// (ordre des noms ; images d'une autre taille posées en haut à gauche).
fn import_sequence(app: &AppWindow, state: &Shared) {
    let weak = app.as_weak();
    let state = state.clone();
    #[cfg(not(target_arch = "wasm32"))]
    let task = async move {
        let Some(files) = rfd::AsyncFileDialog::new()
            .add_filter(i18n::tr("Images"), &["png", "jpg", "jpeg", "webp", "bmp", "gif"])
            .pick_files()
            .await
        else {
            return;
        };
        let mut list = Vec::new();
        for f in files {
            list.push((f.file_name(), f.read().await));
        }
        let Some(app) = weak.upgrade() else { return };
        sequence_doc(&app, &mut state.borrow_mut(), list);
    };
    #[cfg(target_arch = "wasm32")]
    let task = async move {
        let Some(list) = web::pick_files("image/*").await else { return };
        let Some(app) = weak.upgrade() else { return };
        sequence_doc(&app, &mut state.borrow_mut(), list);
    };
    let _ = slint::spawn_local(task);
}

fn sequence_doc(app: &AppWindow, st: &mut State, mut list: Vec<(String, Vec<u8>)>) {
    list.sort_by(|a, b| a.0.to_lowercase().cmp(&b.0.to_lowercase()));
    let decoded: Vec<(usize, usize, Vec<u8>)> = list.iter().filter_map(|(_, b)| decode(b)).collect();
    let Some(&(w, h, _)) = decoded.first() else {
        status(app, "Aucune image lisible dans la séquence");
        return;
    };
    let frames: Vec<Vec<u8>> = decoded
        .into_iter()
        .map(|(iw, ih, px)| {
            if iw == w && ih == h {
                return px;
            }
            let mut out = vec![0u8; w * h * 4];
            for y in 0..ih.min(h) {
                out[y * w * 4..(y * w + iw.min(w)) * 4].copy_from_slice(&px[y * iw * 4..(y * iw + iw.min(w)) * 4]);
            }
            out
        })
        .collect();
    let n = frames.len();
    let title = list.first().map(|f| f.0.clone()).unwrap_or_default();
    let mut doc = anim::doc_from_frames(frames, w, h, 12, &title);
    doc.saved = (usize::MAX, 0);
    set_document(app, st, doc);
    app.set_anim_open(true);
    status(app, i18n::tr_format!("Séquence importée : {n} images"));
}

fn sync_applied_fx(app: &AppWindow, st: &State) {
    let layer=st.doc.layer();
    if layer.dynamic.is_none() || app.get_applied_fx_uid().as_str()!=layer.uid.to_string() {
        app.set_show_applied_fx(false);return;
    }
    app.set_applied_fx_layer(layer.name.as_str().into());
    app.set_applied_fx_mode(layer.dynamic_mode as i32);
    app.set_applied_fx_zone(editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed)==layer.uid);
    let rows:Vec<AppliedFxRow>=layer.dynamic.as_ref().unwrap().iter().map(|(kind,power)| {
        let label=editor::fx_label(kind).unwrap_or_else(||effects::dialog(editor::dyn_base(kind)).map(|(s,_)|s.to_string()).unwrap_or_else(||legacy_dyn_label(editor::dyn_base(kind)).into()));
        let quick=applied_quick(kind);
        let legacy=editor::fx_engine(kind).is_none();
        let editable=editor::fx_dialog(kind).is_some_and(|(id,_)|id=="curves" || effects::dialog(&id).is_some());
        AppliedFxRow { label:i18n::tr(&label).into(),on:!kind.starts_with(editor::DYN_OFF),
            strength:if legacy {100.0}else{power/editor::DYN_FULL*100.0},editable,
            quick_label:quick.as_ref().map_or("".into(),|q|i18n::tr(&q.1).into()),
            quick_value:quick.as_ref().map_or(0.0,|q|if legacy {*power}else{q.2}),
            quick_min:quick.as_ref().map_or(0.0,|q|q.3),quick_max:quick.as_ref().map_or(100.0,|q|q.4) }
    }).collect();
    sync_rows(app.get_applied_fx(),rows,|m|app.set_applied_fx(m));
}
/// Nom affiché des filtres ƒ d'origine (codes courts des anciens projets).
fn legacy_dyn_label(base: &str) -> &str {
    match base {
        "blur" => "Flou",
        "gaussian" => "Flou gaussien",
        "sharpen" => "Netteté",
        "pixelate" => "Pixeliser",
        "halftone" => "Trame",
        "shadow" => "Ombre portée",
        "grayscale" => "Noir et blanc",
        "sepia" => "Sépia",
        "invert" => "Négatif",
        "brightness" => "Luminosité",
        "contrast" => "Contraste",
        "saturate" => "Saturation",
        "hue" => "Teinte",
        "printscreen" => "Impression écran",
        "bayer" => "Tramage Bayer",
        b => b,
    }
}

fn applied_fx_action(app: &AppWindow,st:&mut State,i:usize,what:&str) {
    // « + Effet » : ouvre le menu Effets (l'effet choisi rejoint la pile du calque ƒ)
    if what == "add" {
        let menus = app.get_menus();
        if let Some(k) = menus.iter().position(|m| m.title.as_str() == i18n::tr("Effets")) {
            app.set_open_menu(k as i32);
        }
        status(app, "Choisissez un effet ou un ajustement : il rejoint la chaîne du calque ƒ");
        return;
    }
    if let Some(why)=st.doc.edit_refusal() {status(app,why);return;}
    finish_edits(app,st);
    let Some(stack)=st.doc.layer_mut().dynamic.as_mut() else{return;};
    let Some((kind,_))=stack.get(i).cloned() else{return;};
    if what=="edit" {
        if let Some((id,_))=editor::fx_dialog(&kind) {
            app.set_show_applied_fx(false);
            if id=="curves" {open_curves_at(app,st,Some(i));}
            else {let label=editor::fx_label(&kind).unwrap_or_else(||id.clone());open_effect_at(app,st,&id,&label,Some(i));}
        }
        return;
    }
    match what {
        "toggle"=>stack[i].0=if kind.starts_with(editor::DYN_OFF) {editor::dyn_base(&kind).into()} else {format!("{}{kind}",editor::DYN_OFF)},
        "up" if i>0=>stack.swap(i,i-1),
        "down" if i+1<stack.len()=>stack.swap(i,i+1),
        "delete"=>{stack.remove(i);},
        _=>return,
    }
    // pile changée : un calcul encore en cours (lancé avec l'ancienne pile) est ignoré à son
    // retour (nouveau numéro) et le nouveau calcul part tout de suite. Avant, ce résultat
    // périmé était accepté : l'effet supprimé réapparaissait, même pile vide (bureau surtout,
    // les effets du menu y étant calculés dans un autre fil).
    let uid=st.doc.layer().uid;
    dyn_invalidate(st,uid);
    if st.doc.layer().dynamic.as_ref().is_some_and(|s|s.is_empty()) {
        st.doc.layer_mut().dyn_cache=None;
        st.doc.layer_mut().dyn_low=None;
    }
    st.doc.commit("Effets appliqués");refresh_all(app,st);
}
fn applied_fx_value(app:&AppWindow,st:&mut State,i:usize,quick:bool,value:f32,commit:bool) {
    if !value.is_finite() {return;}
    if let Some(why)=st.doc.edit_refusal() {status(app,why);return;}
    let Some(stack)=st.doc.layer_mut().dynamic.as_mut() else{return;};
    let Some(stage)=stack.get_mut(i) else{return;};
    if quick {
        let Some((key,_,_,min,max,step))=applied_quick(&stage.0) else{return;};
        let value=if step>0.0 {(value/step).round()*step}else{value}.clamp(min,max);
        if key=="legacy-radius" {
            if let Some(mut p)=editor::fx_params(&stage.0) {
                if p.len()>1 {p[1]=value;let label=editor::fx_label(&stage.0).unwrap_or_default();let kind=editor::fx_kind("dynstage",&p,&label,"",&Default::default());editor::replace_stage(stage,kind);}
            } else {stage.1=value;}
        } else if let Some((id,mut values))=editor::fx_dialog(&stage.0) {
            values.insert(key,value.to_string());
            let vals=effects::Vals(values);
            let sec=rgba(app.get_secondary_color());
            let secondary=(sec[0] as u32)<<16 | (sec[1] as u32)<<8 | sec[2] as u32;
            if let Some((engine,p))=effects::params(&id,&vals,secondary,1) {
                let label=editor::fx_label(&stage.0).unwrap_or_else(||id.clone());
                let kind=editor::fx_kind(engine,&p,&label,&id,&vals.0);editor::replace_stage(stage,kind);
            }
        }
    } else {editor::set_stage_strength(stage,value);}
    let uid=st.doc.layer().uid;
    if commit {
        // relâchement : pleine résolution
        st.dyn_draft=None;st.doc.layer_mut().dyn_key=None;
        st.doc.commit("Effets appliqués");refresh_all(app,st);
    }
    else {dyn_draft(app,st,uid);sync_applied_fx(app,st);schedule_dynamic(app,st);}
}

/// Liste des effets du calque texte actif (fenêtre « Effets du calque texte »).
fn sync_text_fx(app: &AppWindow, st: &State) {
    let rows: Vec<TextFxRow> = st
        .doc
        .layer()
        .vector
        .as_ref()
        .map(|v| v.effects.iter().map(|f| TextFxRow { label: i18n::tr(&f.label).into(), on: f.on }).collect())
        .unwrap_or_default();
    app.set_text_fx(ModelRc::new(VecModel::from(rows)));
}

/// Fenêtre « Effets du calque texte » : activer, monter, descendre, supprimer un effet.
fn text_fx_action(app: &AppWindow, st: &mut State, i: usize, what: &str) {
    let k = st.doc.active;
    let uid = st.doc.layers[k].uid;
    let Some(v) = st.doc.layers[k].vector.as_mut() else {
        app.set_show_text_fx(false);
        return;
    };
    if i >= v.effects.len() {
        return;
    }
    let label = match what {
        "toggle" => {
            v.effects[i].on = !v.effects[i].on;
            "Effets du texte : activer / désactiver"
        }
        // liste dans l'ordre d'application (premier effet en haut)
        "up" if i > 0 => {
            v.effects.swap(i, i - 1);
            "Effets du texte : ordre"
        }
        "down" if i + 1 < v.effects.len() => {
            v.effects.swap(i, i + 1);
            "Effets du texte : ordre"
        }
        "delete" => {
            v.effects.remove(i);
            "Effets du texte : supprimer"
        }
        _ => return,
    };
    render_vector_layer(app, st, uid);
    st.doc.commit(label);
    refresh_all(app, st);
    sync_text_fx(app, st);
}

/// Pixellise le calque texte `k` : il devient un calque de pixels ordinaire (rendu actuel).
fn rasterize_layer(app: &AppWindow, st: &mut State, k: usize) {
    if st.doc.layers.get(k).and_then(|l| l.vector.as_ref()).is_none() {
        return;
    }
    st.doc.layers[k].vector = None;
    st.doc.commit("Pixelliser le calque");
    refresh_all(app, st);
}

/// Télécharge une police MasterPaint (web) puis redessine le texte.
#[allow(unused_variables)]
fn ensure_font(app: &AppWindow, state: &Shared, fi: usize) {
    #[cfg(target_arch = "wasm32")]
    {
        let Some(path) = state.borrow().fonts.web_path(fi) else { return };
        let weak = app.as_weak();
        let state = state.clone();
        status(app, "Téléchargement de la police…");
        let _ = slint::spawn_local(async move {
            let bytes = web::fetch_bytes(&path).await;
            let Some(app) = weak.upgrade() else { return };
            let mut st = state.borrow_mut();
            match bytes {
                Some(b) if st.fonts.insert_loaded(fi, &b) => {
                    status(&app, "");
                    let name = st.fonts.entries[fi].name.clone();
                    let p = st.fonts.get(fi).and_then(|f| text::preview(&f, &name));
                    set_font_preview(&app, &mut st, fi, p);
                    render_text(&app, &mut st);
                }
                _ => status(&app, "Police indisponible"),
            }
        });
    }
}

// ------------------------------------------------------------------ outils

fn set_tool(app: &AppWindow, st: &mut State, id: &str) {
    match id {
        "btn-deselect" => {
            st.doc.deselect();
            sel_changed(app, st);
            return;
        }
        "illu-tb-zoom-fit-2" => {
            app.invoke_zoom_fit();
            return;
        }
        // corbeille de la fenêtre Outils : comme Édition › Effacer la sélection (Suppr)
        "tool-clear-sel" => {
            drop_floating(app, st);
            st.doc.erase_selection();
            st.doc.commit("Effacer la sélection");
            refresh_all(app, st);
            return;
        }
        _ => {}
    }
    let id = vecedit::tool_for_mode(st.doc.vector_mode, id);
    st.session.cancel(&mut st.doc);
    drop_floating(app, st);
    app.set_overlay_path(SharedString::default());
    shape_edit::commit(app, st);
    vecedit::commit(app, st);
    gradlive::commit(app, st);
    commit_text(app, st);
    // taille du crayon gardée à part de celle du pinceau / de la gomme (crayon : 1 px au départ)
    let t = app.global::<ToolOpts>();
    let was_pencil = st.tool == Tool::Pencil;
    let to_pencil = Tool::from_id(id) == Tool::Pencil;
    if was_pencil != to_pencil {
        let cur = t.get_brush_size();
        let other = std::mem::replace(&mut st.other_size, cur);
        t.set_brush_size(if to_pencil && other <= 0.0 { 1.0 } else if other > 0.0 { other } else { cur });
        // la taille retrouvée reste dans le maximum de l'image active
        t.set_brush_size(t.get_brush_size().min(t.get_brush_size_max()));
    }
    st.tool = Tool::from_id(id);
    app.set_current_tool(SharedString::from(id));
    prepare_handles(app, st);
    let tools = app.global::<Generated>().get_tools();
    let svg_tools = app.global::<SvgTools>().get_tools();
    // structure anonyme vue comme un tuple, champs par ordre alphabétique : (h, icon, id, title, w, x, y)
    let info = if st.doc.vector_mode { svg_tools.iter().find(|t| t.2 == id) } else { None }.or_else(|| tools.iter().find(|t| t.2 == id));
    let title = info.as_ref().map(|t| t.3.clone()).unwrap_or_default();
    app.set_tool_title(title);
    let icon = info.and_then(|t| tool_cursor_icon(app, id, t.1));
    TOOL_CURSOR_ICON.with(|c| *c.borrow_mut() = icon);
    refresh_tool_cursor(app);
    if st.tool == Tool::Unsupported && id != "tool-pan" {
        status(app, "Cet outil n'est pas encore porté dans la version Rust");
    } else {
        status(app, "");
    }
    // outil et réglages de l'outil quitté retenus pour le prochain lancement
    save_settings(app);
    schedule_spare(app);
}

thread_local! {
    /// Icône (SVG) du curseur de l'outil actif ; None : curseur système ordinaire.
    static TOOL_CURSOR_ICON: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Icône du curseur d'un outil. None : outils qui gardent un curseur système (Déplacer, Zoom,
/// Texte) ou icône introuvable.
fn tool_cursor_icon(app: &AppWindow, id: &str, icon: IconSpec) -> Option<String> {
    if matches!(id, "tool-move" | "tool-node" | "tool-zoom" | "tool-text" | "btn-deselect" | "tool-pan") {
        return None;
    }
    let k = app.global::<MpIcons>().invoke_for_spec(icon);
    let (_, tpl) = mpicons_gen::MP_ICONS.get(usize::try_from(k).ok()?)?;
    Some(
        tpl.replace("{STROKE}", "#1a1a1a")
            .replace("{ACCENT}", "#3b82f6")
            .replace("{SUBTLE}", "#bfdbfe")
            .replace("{BG}", "#ffffff")
            .replacen("<svg ", "<svg x=\"14\" y=\"14\" width=\"16\" height=\"16\" ", 1),
    )
}

/// Curseur d'un outil sur la toile, comme Paint.NET : croix fine et icône de l'outil en bas à
/// droite, sur une pastille claire lisible sur tous les fonds, et contour du pinceau. Un vrai
/// curseur système : le pointeur bouge sans redessiner la fenêtre. En pixels (pas en SVG) : dans
/// le navigateur, le SVG d'une `Image` n'est pas lisible par Slint, qui l'ignorerait.
/// `s` : pixels du curseur par unité de l'interface ; `d` : diamètre du contour en pixels du
/// curseur (0 : aucun). Renvoie aussi le point actif.
fn render_tool_cursor(icon: &str, s: f32, d: f32, square: bool) -> Option<(Image, i32)> {
    let (size, hot) = tool_cursor_size(s, d);
    let (c, sw) = (hot as f32 + 0.5, s.max(1.0));
    let ring = if d <= 0.0 {
        String::new()
    } else if square {
        let (o, w) = (c - d / 2.0 + sw / 2.0, d - sw);
        format!("<rect x=\"{o}\" y=\"{o}\" width=\"{w}\" height=\"{w}\" fill=\"none\" stroke=\"#808080\" stroke-opacity=\"0.5\" stroke-width=\"{sw}\"/>")
    } else {
        let r = (d - sw) / 2.0;
        format!("<circle cx=\"{c}\" cy=\"{c}\" r=\"{r}\" fill=\"none\" stroke=\"#808080\" stroke-opacity=\"0.5\" stroke-width=\"{sw}\"/>")
    };
    let cross = "M7 0V5M7 9V14M0 7H5M9 7H14";
    let origin = c - 7.0 * s;
    let svg = format!(
        "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"{size}\" height=\"{size}\" viewBox=\"0 0 {size} {size}\">{ring}\
         <g transform=\"translate({origin} {origin}) scale({s})\">\
         <path d=\"{cross}\" stroke=\"#ffffff\" stroke-width=\"3\" fill=\"none\"/>\
         <path d=\"{cross}\" stroke=\"#000000\" stroke-width=\"1\" fill=\"none\"/>\
         <rect x=\"12.5\" y=\"12.5\" width=\"19\" height=\"19\" rx=\"3\" fill=\"#ffffff\" fill-opacity=\"0.92\" stroke=\"#606060\"/>{icon}</g></svg>"
    );
    let tree = resvg::usvg::Tree::from_data(svg.as_bytes(), &resvg::usvg::Options::default()).ok()?;
    let mut pm = tiny_skia::Pixmap::new(size, size)?;
    resvg::render(&tree, tiny_skia::Transform::identity(), &mut pm.as_mut());
    let pb = SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(pm.data(), size, size);
    Some((Image::from_rgba8_premultiplied(pb), hot as i32))
}

/// Côté de l'image du curseur et position de son point actif, en pixels.
fn tool_cursor_size(s: f32, d: f32) -> (u32, u32) {
    let hot = (7.0 * s).round().max((d / 2.0).ceil() + 1.0) as u32;
    (((hot as f32 + (25.0 * s).round()) as u32).max(2 * hot + 1), hot)
}

/// Taille maximale d'un curseur : 128 pixels dans les navigateurs (au-delà, ils l'ignorent).
const TOOL_CURSOR_MAX: u32 = if cfg!(target_arch = "wasm32") { 128 } else { 256 };

/// Refait le curseur de l'outil (outil, taille du pinceau, zoom, échelle de l'interface). Le
/// contour d'un pinceau trop grand pour un curseur système reste dessiné par l'interface.
fn refresh_tool_cursor(app: &AppWindow) {
    // une image de curseur compte en pixels de l'écran sur le bureau, en pixels CSS dans le navigateur
    #[cfg(target_arch = "wasm32")]
    let s = app.window().scale_factor() / web_sys::window().map_or(1.0, |w| w.device_pixel_ratio() as f32);
    #[cfg(not(target_arch = "wasm32"))]
    let s = app.window().scale_factor();
    let d = app.get_ring_d() * s;
    let fits = tool_cursor_size(s, d).0 <= TOOL_CURSOR_MAX;
    let icon = TOOL_CURSOR_ICON.with(|c| c.borrow().clone()).filter(|_| !app.get_phone());
    let cursor = icon.and_then(|icon| render_tool_cursor(&icon, s, if fits { d } else { 0.0 }, app.get_ring_square()));
    app.set_ring_overlay(d > 0.0 && (!fits || cursor.is_none()));
    match cursor {
        Some((img, hot)) => {
            app.set_tool_cursor(img);
            app.set_tool_cursor_hx(hot);
            app.set_tool_cursor_hy(hot);
            app.set_tool_cursor_on(true);
        }
        None => app.set_tool_cursor_on(false),
    }
}

/// Coordonnées du pointeur dans la barre d'état. Le moindre changement de texte redessine la
/// fenêtre : au survol, 4 fois par seconde au plus, et la dernière position dès l'arrêt ; pendant
/// un tracé, la toile est redessinée de toute façon.
fn show_cursor_pos(app: &AppWindow, x: i32, y: i32, busy: bool) {
    use std::cell::Cell;
    thread_local! {
        static LAST: Cell<f64> = const { Cell::new(0.0) };
        static POS: Cell<(i32, i32)> = const { Cell::new((0, 0)) };
        static TRAIL: slint::Timer = slint::Timer::default();
    }
    const PERIOD_MS: u64 = 250;
    fn apply(app: &AppWindow) {
        let (x, y) = POS.with(|p| p.get());
        LAST.with(|l| l.set(now_ms()));
        app.set_cursor_text(SharedString::from(i18n::tr_format!("{}, {} px", x, y)));
    }
    POS.with(|p| p.set((x, y)));
    if busy || now_ms() - LAST.with(|l| l.get()) >= PERIOD_MS as f64 {
        TRAIL.with(|t| t.stop());
        return apply(app);
    }
    TRAIL.with(|t| {
        if !t.running() {
            let weak = app.as_weak();
            t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(PERIOD_MS), move || {
                if let Some(app) = weak.upgrade() {
                    apply(&app);
                }
            });
        }
    });
}

/// Glyphe Font Awesome d'une étape d'historique selon son libellé (outil, calque, image, effet…).
fn history_icon(i: usize, label: &str) -> char {
    if i == 0 {
        return '\u{f03e}'; // image
    }
    let l = label.to_lowercase();
    let has = |k: &[&str]| k.iter().any(|w| l.contains(w));
    if has(&["pinceau"]) {
        '\u{f1fc}'
    } else if has(&["crayon"]) {
        '\u{f303}'
    } else if has(&["gomme", "effacer"]) {
        '\u{f12d}'
    } else if has(&["remplissage contenu"]) {
        '\u{f5c3}'
    } else if has(&["remplissage"]) {
        '\u{f575}'
    } else if has(&["dégradé"]) {
        '\u{f042}'
    } else if has(&["texte"]) {
        '\u{f031}'
    } else if has(&["ligne"]) {
        '\u{f715}'
    } else if has(&["forme"]) {
        '\u{f61f}'
    } else if has(&["coller", "couper", "copier"]) {
        '\u{f0ea}'
    } else if has(&["masque"]) {
        '\u{f5fd}'
    } else if has(&["filtre dynamique"]) {
        '\u{f0b0}'
    } else if has(&["calque", "canaux"]) {
        '\u{f5fd}'
    } else if has(&["déplacer", "aligner", "centrer"]) {
        '\u{f0b2}'
    } else if has(&["recadrer", "ajuster au contenu"]) {
        '\u{f125}'
    } else if has(&["rotation", "retournement"]) {
        '\u{f2f1}'
    } else if has(&["redimensionner", "taille", "bordure", "hors toile"]) {
        '\u{f424}'
    } else if has(&["courbes", "niveaux", "luminosité", "teinte", "saturation", "exposition", "balance"]) {
        '\u{f1de}'
    } else if has(&["détourage", "fond"]) {
        '\u{f0c4}'
    } else if has(&["espace", "cmjn", "ral", "conversion"]) {
        '\u{f53f}'
    } else if has(&["historique"]) {
        '\u{f1da}'
    } else {
        // effets et ajustements du menu
        '\u{f0d0}'
    }
}

/// La sélection a changé (outil de sélection, Ctrl+A, Ctrl+D…) : affichage refait, sans étape
/// d'historique (les sélections n'encombrent plus l'historique).
fn sel_changed(app: &AppWindow, st: &mut State) {
    st.doc.selection_changed();
    refresh_all(app, st);
}

type PaintRect = (usize, usize, usize, usize);
thread_local! {
    // At most one composition/upload per display frame, never one per input sample.
    static PAINT_DIRTY: RefCell<Option<(u64, Option<PaintRect>)>> = const { RefCell::new(None) };
    static PAINT_QUEUED: std::cell::Cell<bool> = const { std::cell::Cell::new(false) };
}

fn queue_paint_frame(app: &AppWindow, st: &mut State, rect: Option<PaintRect>) {
    st.doc.mark_dynamic_dirty(rect);
    PAINT_DIRTY.with(|dirty| {
        let mut dirty = dirty.borrow_mut();
        let merged = match *dirty {
            Some((doc, old)) if doc == st.doc.uid => match (old, rect) {
                (Some(a), Some(b)) => Some((a.0.min(b.0), a.1.min(b.1), a.2.max(b.2), a.3.max(b.3))),
                _ => None,
            },
            _ => rect,
        };
        *dirty = Some((st.doc.uid, merged));
    });
    schedule_paint_frame(app.as_weak());
}

fn schedule_paint_frame(weak: slint::Weak<AppWindow>) {
    if PAINT_QUEUED.with(|queued| queued.replace(true)) { return; }
    slint::Timer::single_shot(std::time::Duration::from_millis(8), move || {
        PAINT_QUEUED.with(|queued| queued.set(false));
        let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
        let Ok(mut st) = state.try_borrow_mut() else {
            schedule_paint_frame(weak);
            return;
        };
        if let Some((doc, rect)) = PAINT_DIRTY.with(|dirty| dirty.borrow_mut().take()) {
            if st.doc.uid == doc {
                let rect = dyn_patch(&app, &mut st, rect);
                refresh_rect(&app, &mut st, rect);
            }
        }
    });
}

fn handle_outcome(app: &AppWindow, st: &mut State, out: Outcome) {
    match out {
        Outcome::Nothing => {}
        Outcome::Redraw(r) => refresh_rect(app, st, r),
        Outcome::Commit(label) => {
            // forme sur un calque vectoriel : ajoutée à ses objets, calque re-rendu (effets compris)
            // forme tracée : elle reste modifiable (poignées) jusqu'à ce qu'on la pose
            if matches!(label, "Forme" | "Ligne") {
                if let Some(shape) = st.session.last_shape.clone() {
                    if shape_edit::begin_new(app, st, shape) {
                        st.session.last_shape = None;
                        return;
                    }
                }
            }
            if matches!(label, "Forme" | "Ligne") && st.doc.layer().vector.is_some() {
                if let Some(shape) = st.session.last_shape.take() {
                    let uid = st.doc.layer().uid;
                    if let Some(v) = st.doc.layers[st.doc.active].vector.as_mut() {
                        v.objects.push(vector::Obj::Shape(shape));
                    }
                    render_vector_layer(app, st, uid);
                }
            }
            // fin d'un trait : zone touchée notée pour la carte graphique (seules ces lignes
            // repartent), et filtres ƒ du dessus terminés AVANT l'étape d'historique (sinon
            // l'étape gardait un rendu ƒ périmé : recalcul complet à chaque annulation)
            if let Some((base, r)) = st.session.last_stroke.take().filter(|_| tools::is_stroke(st.tool)) {
                let px = st.doc.layer().px.arc();
                if base.len() == px.len() {
                    gpu_damage::note(&base.weak(), &px, gpu_damage::rows(st.doc.w, r.1, r.3));
                }
            }
            dyn_patch(app, st, None);
            st.doc.commit(label);
            // animation « avancer après chaque tracé » : image suivante (la frise s'allonge)
            if st.doc.anim.as_ref().is_some_and(|a| a.draw_step) && paints_pixels(st.tool) {
                if let Some(a) = st.doc.anim.as_mut() {
                    a.duration = a.duration.max(a.playhead + 2);
                }
                let t = st.doc.anim.as_ref().map_or(0, |a| a.playhead + 1);
                anim::goto(&mut st.doc, t);
            }
            refresh_all(app, st);
        }
        Outcome::Selection => {
            sel_changed(app, st);
        }
        Outcome::PickColor(c, secondary) => {
            let col = Color::from_argb_u8(c[3], c[0], c[1], c[2]);
            if secondary {
                app.set_secondary_color(col);
            } else {
                app.set_primary_color(col);
            }
        }
        Outcome::Zoom(x, y, zin) => app.invoke_zoom_doc(if zin { 1.25 } else { 0.8 }, x, y),
        Outcome::Message(m) => status(app, m),
        Outcome::Outline(pts) => {
            let mut p = String::new();
            for (i, (x, y)) in pts.iter().enumerate() {
                p += &format!("{}{x} {y} ", if i == 0 { "M" } else { "L" });
            }
            if pts.len() > 1 {
                p += "Z";
            }
            app.set_overlay_path(SharedString::from(p));
        }
    }
}

/// Axes de symétrie (pinceau, gomme, crayon) : les poignées aux extrémités d'un axe, ou un appui
/// hors de la toile dans son alignement (comme depuis les règles), le déplacent ; double-clic sur
/// une poignée = axes recentrés. Retourne true si l'évènement est pris.
fn sym_pointer(app: &AppWindow, st: &mut State, kind: i32, x: f32, y: f32) -> bool {
    let t = app.global::<ToolOpts>();
    let (sx, sy) = (t.get_sym_x(), t.get_sym_y());
    let (w, h) = (st.doc.w as f32, st.doc.h as f32);
    // axe décoché : il revient au centre
    if let Some(c) = st.doc.sym {
        let c2 = (if sx { c.0 } else { w / 2.0 }, if sy { c.1 } else { h / 2.0 });
        if c2 != c {
            st.doc.sym = if sx || sy { Some(c2) } else { None };
            sync_sym(app, st);
        }
    }
    if !(sx || sy) || !matches!(st.tool, Tool::Brush | Tool::Eraser | Tool::Pencil) {
        st.sym_drag = 0;
        return false;
    }
    let (cx, cy) = tools::sym_center(&st.doc);
    let tol = 8.0 / app.get_zoom().max(0.01);
    // axe vertical (symétrie X) : poignées en haut et en bas ; axe horizontal : à gauche et à droite
    let near_x = sx && (x - cx).abs() <= tol && (y <= tol || y >= h - tol);
    let near_y = sy && (y - cy).abs() <= tol && (x <= tol || x >= w - tol);
    match kind {
        0 => {
            let grab = if near_x { 1 } else if near_y { 2 } else { 0 };
            if grab == 0 {
                return false;
            }
            let now = now_ms();
            if now - st.sym_click < 450.0 {
                st.doc.sym = None;
                st.sym_click = 0.0;
                st.sym_drag = 0;
                sync_sym(app, st);
                status(app, "Axes de symétrie recentrés");
                return true;
            }
            st.sym_click = now;
            st.sym_drag = grab;
            // axe vertical : glissé de gauche à droite ; axe horizontal : de haut en bas
            app.set_canvas_cursor(if grab == 1 { 9 } else { 10 });
            true
        }
        1 => {
            if st.sym_drag == 0 {
                app.set_canvas_cursor(if near_x { 9 } else if near_y { 10 } else { 0 });
                return false;
            }
            // aimantation : grille, puis bords et centre de l'image ; sinon au demi-pixel
            let (cell, th) = snap_params(app, st.doc.w);
            let snap_on = t.get_snap();
            let snap = |v: f32, lim: f32| -> f32 {
                let v = v.clamp(0.0, lim);
                if snap_on {
                    let g = (v / cell).round() * cell;
                    if (v - g).abs() <= th {
                        return g.min(lim);
                    }
                    for c in [0.0, lim / 2.0, lim] {
                        if (v - c).abs() <= tol {
                            return c;
                        }
                    }
                }
                (v * 2.0).round() / 2.0
            };
            st.doc.sym = Some(if st.sym_drag == 1 { (snap(x, w), cy) } else { (cx, snap(y, h)) });
            sync_sym(app, st);
            let (ncx, ncy) = tools::sym_center(&st.doc);
            status(app, i18n::tr_format!("Axe de symétrie : {} px", if st.sym_drag == 1 { ncx } else { ncy }));
            true
        }
        _ => {
            if st.sym_drag == 0 {
                return false;
            }
            st.sym_drag = 0;
            app.set_canvas_cursor(0);
            true
        }
    }
}

/// Position des axes de symétrie dans l'interface (pixels du document).
fn sync_sym(app: &AppWindow, st: &State) {
    let (cx, cy) = tools::sym_center(&st.doc);
    let t = app.global::<ToolOpts>();
    t.set_sym_cx(cx);
    t.set_sym_cy(cy);
}

fn poly_path(st: &State, cursor: (f32, f32)) -> SharedString {
    let p = &st.session.poly;
    if p.is_empty() {
        return SharedString::default();
    }
    let mut s = format!("M {} {}", p[0].0, p[0].1);
    for q in &p[1..] {
        s += &format!(" L {} {}", q.0, q.1);
    }
    s += &format!(" L {} {}", cursor.0, cursor.1);
    SharedString::from(s)
}

// ------------------------------------------------------------------ clavier

/// Raccourcis clavier de MasterPaint (mêmes touches que la version web).
fn handle_key(app: &AppWindow, state: &Shared, text: &str, ctrl: bool, shift: bool, alt: bool) -> bool {
    use slint::platform::Key;
    LAST_ACTIVITY.with(|a| a.set(now_ms()));
    // navigateur : modificateurs relevés par la page (Slint ne les transmet pas)
    #[cfg(target_arch = "wasm32")]
    let (ctrl, shift, alt) = {
        let (c, s, a) = web::modifiers();
        (ctrl || c, shift || s, alt || a)
    };
    let k = |key: Key| SharedString::from(key).as_str() == text;
    let mut ch = text.chars().next().unwrap_or('\0');
    // Ctrl+lettre peut arriver comme caractère de contrôle (0x01..0x1a)
    if ctrl && (ch as u32) >= 1 && (ch as u32) <= 26 {
        ch = (b'a' + ch as u8 - 1) as char;
    }
    let c = ch.to_ascii_lowercase();
    // navigateur : dans un champ de texte de l'application (élément <input> de Slint), les
    // raccourcis d'édition restent au champ (Ctrl+A sélectionne le texte, pas l'image)
    #[cfg(target_arch = "wasm32")]
    if ctrl && matches!(c, 'a' | 'c' | 'v' | 'x' | 'z' | 'y') && web::text_focused() {
        return false;
    }
    if ctrl {
        applog::log(format!("raccourci reçu : texte {text:?} (Ctrl{}{})", if shift { "+Maj" } else { "" }, if alt { "+Alt" } else { "" }));
    }
    // menu contextuel ouvert : Échap le ferme avant toute autre action
    if app.get_ctx_open() {
        if k(Key::Escape) {
            app.set_ctx_open(false);
            return true;
        }
    }
    // calcul en cours (fenêtre de progression) : les raccourcis attendent
    if app.get_loading() {
        return true;
    }
    // Mode Photo Pro : les raccourcis de l'éditeur ne touchent pas l'image cachée derrière
    if app.get_pm_open() {
        if ctrl && ch.eq_ignore_ascii_case(&'o') {
            pm_action(app, state, "import");
            return true;
        }
        if ctrl && ch.eq_ignore_ascii_case(&'s') {
            pm_action(app, state, "export");
            return true;
        }
        // annuler / rétablir les réglages de la photo active
        if ctrl && (ch.eq_ignore_ascii_case(&'z') || ch.eq_ignore_ascii_case(&'y')) {
            let back = ch.eq_ignore_ascii_case(&'z') && !shift;
            pm_store::undo(app, &mut state.borrow_mut(), back);
            return true;
        }
        return false;
    }
    // fenêtre de choix ouverte : Échap = fermer, les autres raccourcis attendent
    if app.get_show_task() {
        if k(Key::Escape) {
            task_result(app, state, -1);
        }
        return true;
    }
    // ouvrir / exporter empruntent eux-mêmes l'état : traités avant l'emprunt
    if ctrl && c == 'o' && !shift {
        open_file(app, state);
        return true;
    }
    if ctrl && c == 's' {
        if !state.borrow().empty {
            show_export(app, &state.borrow());
        }
        return true;
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;
    // aucun projet ouvert : seuls Nouvelle image (Ctrl+N) et Coller (Ctrl+V) servent
    if st.empty && !(ctrl && matches!(c, 'n' | 'v')) {
        return !k(Key::Tab);
    }

    if st.crop.is_some() {
        if k(Key::Escape) || k(Key::Return) {
            crop_action(app, st, if k(Key::Return) { "apply" } else { "cancel" });
            return true;
        }
    }
    if st.curves.is_some() {
        if k(Key::Escape) || k(Key::Return) {
            curves_action(app, st, if k(Key::Return) { "ok" } else { "cancel" }, 0);
            return true;
        }
        return false;
    }
    // fenêtre d'effet ouverte : Entrée = OK, Échap = Annuler
    if st.effect.is_some() {
        if k(Key::Escape) {
            if let Some(es) = st.effect.as_mut().filter(|e| e.pick.is_some()) {
                es.pick = None;
                status(app, "");
                return true;
            }
            cancel_effect(app, st);
            return true;
        }
        if k(Key::Return) {
            commit_effect(app, st);
            return true;
        }
        return false;
    }
    if st.text_edit.is_some() {
        if k(Key::Escape) {
            commit_text(app, st);
            return true;
        }
        return false;
    }
    if st.grad_live.is_some() {
        if k(Key::Return) {
            gradlive::commit(app, st);
            return true;
        }
        if k(Key::Escape) || (ctrl && c == 'z' && !shift) {
            gradlive::cancel(app, st);
            return true;
        }
    }
    if (k(Key::Escape) || k(Key::Return)) && vecedit::finish_key(app, st) {
        return true;
    }
    if ctrl && c == 'z' && !shift && vecedit::undo_step(app, st) {
        return true;
    }
    if (k(Key::Delete) || k(Key::Backspace)) && !ctrl && !alt && st.doc.vector_mode && vecedit::delete_key(app, st) {
        return true;
    }
    if st.shape_edit.is_some() {
        if k(Key::Escape) || k(Key::Return) {
            shape_edit::commit(app, st);
            return true;
        }
        if ctrl && c == 'z' && !shift {
            shape_edit::cancel(app, st);
            return true;
        }
    }
    if k(Key::Escape) {
        if st.session.tracing() {
            // lasso polygonal / magnétique : Échap termine et affiche la sélection
            let o = opts(app);
            let out = st.session.finish_trace(&mut st.doc, &o);
            app.set_overlay_path(SharedString::default());
            handle_outcome(app, st, out);
            return true;
        }
        if st.session.busy() {
            st.session.cancel(&mut st.doc);
            app.set_overlay_path(SharedString::default());
            refresh_all(app, st);
        } else {
            drop_floating(app, st);
            if st.doc.sel.is_some() {
                st.doc.deselect();
                sel_changed(app, st);
            } else {
                refresh_all(app, st);
            }
        }
        return true;
    }
    if k(Key::Return) && st.floating.is_some() {
        drop_floating(app, st);
        return true;
    }
    if k(Key::Return) {
        if st.session.tracing() {
            let o = opts(app);
            let out = st.session.finish_trace(&mut st.doc, &o);
            app.set_overlay_path(SharedString::default());
            handle_outcome(app, st, out);
        }
        return true;
    }
    // lasso en cours : retour arrière = retirer le dernier point (pas d'effacement des pixels)
    if (k(Key::Delete) || k(Key::Backspace)) && st.session.tracing() {
        let out = st.session.undo_point();
        if matches!(out, Outcome::Nothing) {
            let cur = st.session.poly.last().copied().unwrap_or((0.0, 0.0));
            app.set_overlay_path(poly_path(st, cur));
        } else {
            handle_outcome(app, st, out);
        }
        return true;
    }
    if (k(Key::Delete) || k(Key::Backspace)) && !ctrl && !alt {
        st.doc.erase_selection();
        st.doc.commit("Effacer la sélection");
        refresh_all(app, st);
        return true;
    }
    // flèches : déplacer la sélection de 1 px (10 px avec Maj)
    let step = if shift { 10 } else { 1 };
    let arrow = if k(Key::LeftArrow) {
        Some((-step, 0))
    } else if k(Key::RightArrow) {
        Some((step, 0))
    } else if k(Key::UpArrow) {
        Some((0, -step))
    } else if k(Key::DownArrow) {
        Some((0, step))
    } else {
        None
    };
    if let Some((dx, dy)) = arrow {
        // contenu soulevé : déplacement de 1 px (10 avec Maj), comme Paint.NET
        if let Some(f) = st.floating.as_mut() {
            let start = f.snapshot();
            f.drag(&start, transform::Grab::Translate, (0.0, 0.0), (dx as f32, dy as f32), false, false);
            f.render(&mut st.doc);
            st.doc.commit("Déplacer les pixels");
            refresh_all(app, st);
            show_handles(app, st);
            return true;
        }
        if st.doc.sel.is_some() {
            st.doc.translate_selection(dx, dy);
            st.doc.commit("Déplacer la sélection");
            refresh_all(app, st);
        }
        return true;
    }

    if !ctrl {
        if alt {
            return false;
        }
        // Maj+F6 : contour progressif de la sélection (Photoshop)
        if shift && k(Key::F6) {
            if st.doc.sel.is_some() {
                prompt(app, "selfeather", "Contour progressif", "Rayon (pixels)", "8");
            }
            return true;
        }
        let tool = match c {
            'b' if shift => "tool-brush",
            _ if shift => "",
            // S répété : rectangle ↔ ellipse (Paint.NET)
            's' if st.tool == Tool::RectSelect => "tool-ellipse-select",
            's' => "tool-select",
            'k' => "tool-clone",
            'j' => "tool-heal",
            'm' | 'v' => "tool-move",
            // projet SVG : A = Sélection directe des points (comme Illustrator)
            'a' if st.doc.vector_mode => "tool-node",
            'a' | 'd' => "tool-direct-select",
            'b' | 'w' => "tool-wand",
            'e' => "tool-eraser",
            'f' => "tool-fill",
            'g' => "tool-gradient",
            'i' => "tool-eyedropper",
            'z' => "tool-zoom",
            't' => "tool-text",
            'r' | 'o' => "tool-shapes-family",
            'l' => "tool-line",
            'u' => "tool-round-3",
            'y' => "tool-deform",
            'q' => "tool-warp-4",
            // projet SVG : P = Plume, N = Crayon (comme Illustrator)
            'p' if st.doc.vector_mode => "tool-pen",
            'n' if st.doc.vector_mode => "tool-pencil",
            'p' => "tool-pencil",
            _ => "",
        };
        if !tool.is_empty() {
            if c == 'r' {
                app.global::<ToolOpts>().set_shape_kind("rect".into());
            } else if c == 'o' {
                app.global::<ToolOpts>().set_shape_kind("ellipse".into());
            }
            set_tool(app, st, tool);
            return true;
        }
        match c {
            '[' | ']' => {
                let t = app.global::<ToolOpts>();
                let s = t.get_brush_size();
                let step = if s < 10.0 { 1.0 } else if s < 50.0 { 5.0 } else { 10.0 };
                t.set_brush_size((if c == '[' { s - step } else { s + step }).clamp(1.0, t.get_brush_size_max()));
                return true;
            }
            'x' => {
                let (p, s) = (app.get_primary_color(), app.get_secondary_color());
                app.set_primary_color(s);
                app.set_secondary_color(p);
                return true;
            }
            _ => return false,
        }
    }

    // ---- Ctrl ----
    drop_floating(app, st);
    match (c, shift) {
        ('h', true) | ('v', true) | ('c', true) => {
            let (h, v) = match c {
                'h' => (Some(0), None),
                'v' => (None, Some(0)),
                _ => (Some(0), Some(0)),
            };
            st.doc.align_selection(h, v);
            st.doc.commit("Centrer la sélection");
            refresh_all(app, st);
        }
        ('r', true) => start_crop(app, st),
        ('x', true) => {
            st.doc.crop_to_selection();
            st.doc.commit("Recadrer");
            refresh_all(app, st);
            app.invoke_zoom_fit();
        }
        ('z', true) | ('y', false) => {
            st.doc.redo();
            refresh_all(app, st);
        }
        ('z', false) => {
            if st.session.tracing() {
                // lasso en cours : Ctrl+Z annule le tracé, pas l'étape précédente
                st.session.cancel(&mut st.doc);
                app.set_overlay_path(SharedString::default());
            } else {
                st.doc.undo();
            }
            refresh_all(app, st);
        }
        ('d', false) => {
            st.doc.deselect();
            sel_changed(app, st);
        }
        ('d', true) => layer_op(app, st, "duplicate"),
        ('a', false) => {
            st.doc.select_all();
            sel_changed(app, st);
        }
        ('n', false) => {
            show_new_project(app, st);
        }

        ('i', true) => run_effect(app, st, "invert", &[], "Inverser les couleurs"),
        // raccourcis des Ajustements (mêmes touches que la version web)
        ('l', true) => run_effect(app, st, "autolevel", &[], "Auto-niveau"),
        ('g', true) => run_effect(app, st, "grayscale", &[], "Noir et blanc"),
        ('e', true) => run_effect(app, st, "sepia", &[], "Sépia"),
        ('u', true) => open_effect(app, st, "hsv", "Teinte / Saturation"),
        ('p', true) => open_effect(app, st, "posterize", "Postériser"),
        ('m', true) => open_curves(app, st),
        ('l', false) => open_effect(app, st, "levels", "Niveaux"),
        ('i', false) => {
            st.doc.invert_selection();
            sel_changed(app, st);
        }
        ('c', false) => {
            copy(app, st);
        }
        ('x', false) => {
            if copy(app, st) {
                st.doc.erase_selection();
                st.doc.commit("Couper");
                refresh_all(app, st);
            }
        }
        ('v', false) if alt => paste_new_image(app, st),
        ('v', false) => paste(app, st),
        ('w', false) => {
            let cur = st.cur;
            request_close_tab(app, st, cur);
        }
        ('f', false) => repeat_effect(app, st),
        // Paint.NET : rotations de l'image, Aplatir
        ('h', false) => rotate_image(app, st, "rot-cw"),
        ('g', false) => rotate_image(app, st, "rot-ccw"),
        ('j', false) => rotate_image(app, st, "rot-180"),
        ('f', true) => flatten_image(app, st),
        ('+', _) | ('=', _) => app.set_zoom((app.get_zoom() * 1.25).min(if st.doc.vector_mode { 640.0 } else { 32.0 })),
        ('-', _) => app.set_zoom((app.get_zoom() / 1.25).max(0.05)),
        ('0', _) => app.invoke_zoom_fit(),
        _ => return false,
    }
    true
}

// ------------------------------------------------------------------ menus

/// Appels de la version web déjà traduits en Rust par `handle_action` (même liste).
const HANDLED_ACTIONS: &[&str] = &[
    "showSelectionExpandDialog", "showImageBorderDialog", "alignActiveLayerWidthToCanvas",
    "illuTriggerFileImport", "showExportDialog", "showNewProjectDialog", "requestCloseActiveDocument", "showSettingsDialog",
    "showChangelog", "showDownloadDialog", "showWelcomeDialog", "undo()", "redo()", "ctxCut", "ctxCopy", "ctxPaste", "selectAll", "deselectAll",
    "invertSelection", "clearSelectionContent", "cropToSelection", "startIlluInteractiveCrop", "resizeCanvas()",
    "showExtendCanvasDialog", "showPixelTransformDialog", "expandCanvasToLayers", "addLayer", "deleteLayer",
    "duplicateActiveLayer", "moveLayer(1)", "moveLayer(-1)", "mergeLayers", "splitActiveLayerRgbChannels", "centerSelection",
    "openLevelsForActiveLayer", "openCurvesForActiveLayer", "showInstantFilterGallery", "openCameraRawForActiveLayer", "illuRepeatLastEffect", "toggleIlluPixelGrid", "toggleIlluRulers",
    "toggleIlluSnapToEdges", "toggleIlluAllowOutsideCanvas", "toggleIlluShowAllRibbonOptions", "win-tools", "win-colors",
    "win-layers", "win-history", "win-svg-objects", "resetWorkspace", "openCanvasLivePreviewWindow", "openIconViewerWindow",
    "openImageLayerBoundsDialog", "illuOpenSnapSettings", "illuRemoveBackgroundIntelligent", "illuGuidedCutoutToolStart", "showContentAwareFillDialog", "convertActiveProjectTo", "PhotoModeManager", "openActiveProjectInPhotoModePro",
    "toggleAnimationMode", "IlluGifImport",
];

/// Marqueur d'une entrée de menu : vide si la fonction est en Rust, « à venir » sinon.
fn action_badge(action: &str, label: &str) -> &'static str {
    if action.starts_with("layerop:") || action.starts_with("rust:") {
        return "";
    }
    if let Some(fx) = action.strip_prefix("fx:") {
        let v = effects::dialog(fx).map(|(_, f)| effects::Vals::defaults(f)).unwrap_or_default();
        return if effects::params(fx, &v, 0xffffff, 1).is_some() { "" } else { "à venir" };
    }
    if action.is_empty() {
        let ported = ["Palettes volantes (Paint.NET)", "Interface : mode téléphone (menu ☰, palettes en colonnes)", "Palettes : ancrage fixe (style Adobe)"];
        return if ported.iter().any(|p| label == i18n::tr(p)) { "" } else { "à venir" };
    }
    // mode SVG (calques vectoriels) : porté, encore en bêta
    if action.contains("win-svg-objects") {
        return "bêta";
    }
    if HANDLED_ACTIONS.iter().any(|k| action.contains(k)) { "" } else { "à venir" }
}

/// Menus de la version web, avec le marqueur des fonctions pas encore transférées.
fn menus_with_status(app: &AppWindow) -> ModelRc<MenuSpec> {
    // menus refaits : les entrées grisées selon le calque actif seront reprises (sync_layer_blocks)
    MENU_MARK.with(|m| m.set("?"));
    let gm = app.global::<Generated>().get_menus();
    let menus: Vec<MenuSpec> = (0..gm.row_count())
        .filter_map(|i| gm.row_data(i))
        .map(|mut m| {
            let items: Vec<MenuItemSpec> = (0..m.items.row_count())
                .filter_map(|j| m.items.row_data(j))
                .map(|mut it| {
                    if it.separator {
                        return it;
                    }
                    // menus refaits : l'entrée Répéter garde le nom du dernier effet
                    if it.action.contains("illuRepeatLastEffect") {
                        REPEAT_LABEL.with(|r| {
                            if !r.borrow().is_empty() {
                                it.label = r.borrow().as_str().into();
                            }
                        });
                    }
                    if it.submenu {
                        let kids: Vec<SubItemSpec> = (0..it.children.row_count())
                            .filter_map(|k| it.children.row_data(k))
                            // « Tramé (Noir et Blanc) » : masqué dans la version web
                            .filter(|c| !c.action.contains("convertActiveProjectToDither"))
                            .map(|mut c| {
                                c.badge = i18n::tr(action_badge(&c.action, &c.label)).into();
                                c
                            })
                            .collect();
                        let todo = kids.iter().filter(|c| !c.badge.is_empty()).count();
                        it.badge = if todo == kids.len() && todo > 0 { i18n::tr("à venir").into() } else { SharedString::default() };
                        it.children = ModelRc::new(VecModel::from(kids));
                    } else {
                        it.badge = i18n::tr(action_badge(&it.action, &it.label)).into();
                    }
                    it
                })
                .collect();
            let mut items = items;
            if m.title.as_str() == i18n::tr("Calques") {
                // dossiers, verrou et calque texte (aussi au clic droit sur un calque)
                let item = |label: &str, action: &str, fa: &str| MenuItemSpec { label: i18n::tr(label).into(), action: action.into(), fa: fa.into(), fa_weight: 900, ..Default::default() };
                items.push(MenuItemSpec { separator: true, ..Default::default() });
                items.push(item("Nouveau dossier", "layerop:group-new", "\u{f65e}"));
                items.push(item("Grouper dans un dossier", "layerop:group", "\u{f07b}"));
                items.push(item("Dégrouper", "layerop:ungroup", "\u{f07c}"));
                items.push(item("Verrouiller / déverrouiller le calque", "layerop:lock", "\u{f023}"));
                items.push(item("Pixelliser le calque", "layerop:rasterize", "\u{f1fc}"));
            }
            m.items = ModelRc::new(VecModel::from(items));
            m
        })
        .collect();
    ModelRc::new(VecModel::from(paint_net_order(menus)))
}

/// Menus rangés comme Paint.NET (et paintdotjs) sans toucher à la version web : Fichier,
/// Édition, Affichage, Image, Calques, Ajustements, Effets, Fenêtre. « Affichage » reprend le
/// zoom, la grille, les règles, l'aimantation et la frise ; « Outils » devient « Fenêtre »
/// (palettes, disposition) ; Image gagne les rotations directes et Aplatir.
fn paint_net_order(mut menus: Vec<MenuSpec>) -> Vec<MenuSpec> {
    let item = |label: &str, action: &str, fa: &str, shortcut: &str| MenuItemSpec {
        label: i18n::tr(label).into(),
        action: action.into(),
        fa: fa.into(),
        fa_weight: 900,
        shortcut: shortcut.into(),
        badge: SharedString::default(),
        ..Default::default()
    };
    let sep = || MenuItemSpec { separator: true, ..Default::default() };
    let pos = |menus: &Vec<MenuSpec>, t: &str| menus.iter().position(|m| m.title.as_str() == i18n::tr(t));
    let items_of = |m: &MenuSpec| -> Vec<MenuItemSpec> { (0..m.items.row_count()).filter_map(|j| m.items.row_data(j)).collect() };
    // retire d'une liste les entrées dont l'action contient l'une des clés (dans l'ordre des clés)
    let take = |list: &mut Vec<MenuItemSpec>, keys: &[&str]| -> Vec<MenuItemSpec> {
        let mut out = Vec::new();
        for k in keys {
            if let Some(i) = list.iter().position(|it| !it.separator && it.action.contains(k)) {
                out.push(list.remove(i));
            }
        }
        out
    };
    // séparateurs en tête, en fin ou doublés après les retraits
    let tidy = |list: Vec<MenuItemSpec>| -> Vec<MenuItemSpec> {
        let mut out: Vec<MenuItemSpec> = Vec::new();
        for it in list {
            if it.separator && out.last().map_or(true, |l| l.separator) {
                continue;
            }
            out.push(it);
        }
        while out.last().is_some_and(|l| l.separator) {
            out.pop();
        }
        out
    };
    let (Some(tools), Some(edit)) = (pos(&menus, "Outils"), pos(&menus, "Édition")) else { return menus };
    let mut tool_items = items_of(&menus[tools]);
    let view_items = take(&mut tool_items, &["toggleIlluPixelGrid", "toggleIlluRulers"]);
    let snap_items = take(&mut tool_items, &["toggleIlluSnapToEdges", "illuOpenSnapSettings", "toggleIlluAllowOutsideCanvas"]);
    let more_items = take(&mut tool_items, &["openCanvasLivePreviewWindow", "toggleIlluShowAllRibbonOptions"]);
    let anim_items = take(&mut tool_items, &["toggleAnimationMode"]);
    let seq_items = take(&mut tool_items, &["IlluGifImport"]);
    let mut view = vec![
        item("Zoom avant", "rust:quick:illu-tb-zoom-in", "\u{f00e}", "Ctrl++"),
        item("Zoom arrière", "rust:quick:illu-tb-zoom-out", "\u{f010}", "Ctrl+-"),
        item("Ajuster à la fenêtre", "rust:quick:illu-tb-zoom-fit-row1", "\u{f065}", "Ctrl+0"),
        sep(),
    ];
    view.extend(view_items);
    view.push(sep());
    view.extend(snap_items);
    view.push(sep());
    view.extend(more_items);
    // la frise n'est plus un affichage : Image › Mode du projet (Animation pixel / SVG)
    drop(anim_items);
    menus[tools].title = i18n::tr("Fenêtre").into();
    menus[tools].items = ModelRc::new(VecModel::from(tidy(tool_items)));
    // Fichier : séquence d'images à côté d'Ouvrir
    if let Some(f) = pos(&menus, "Fichier") {
        let mut list = items_of(&menus[f]);
        let at = list.iter().position(|it| it.action.contains("illuTriggerFileImport")).map_or(list.len(), |i| i + 1);
        for (k, it) in seq_items.into_iter().enumerate() {
            list.insert(at + k, it);
        }
        menus[f].items = ModelRc::new(VecModel::from(list));
    }
    // Édition : coller dans une nouvelle image (Ctrl+Alt+V), sous Coller
    {
        let mut list = items_of(&menus[edit]);
        let at = list.iter().position(|it| it.action.contains("ctxPaste")).map_or(list.len(), |i| i + 1);
        list.insert(at, item("Coller dans une nouvelle image", "rust:paste-new", "\u{f0ea}", "Ctrl+Alt+V"));
        // Sélection › Modifier (Photoshop) : sous « Étendre / réduire »
        let at = list.iter().position(|it| it.action.contains("showSelectionExpandDialog")).map_or(list.len(), |i| i + 1);
        let more = [
            item("Contour progressif (plume)…", "rust:sel-feather", "\u{f52d}", "Maj+F6"),
            item("Bordure de la sélection…", "rust:sel-border", "\u{f850}", ""),
            item("Lisser la sélection…", "rust:sel-smooth", "\u{f111}", ""),
            item("Sélectionner l'opacité du calque", "rust:sel-alpha", "\u{f5fd}", ""),
        ];
        for (k, it) in more.into_iter().enumerate() {
            list.insert(at + k, it);
        }
        menus[edit].items = ModelRc::new(VecModel::from(list));
    }
    // Image : rotations directes et Aplatir (raccourcis de Paint.NET)
    if let Some(im) = pos(&menus, "Image") {
        let mut list = items_of(&menus[im]);
        let at = list.iter().position(|it| it.action.contains("showPixelTransformDialog")).map_or(list.len(), |i| i + 1);
        let extra = [
            item("Rotation de 90° dans le sens horaire", "rust:quick:rot-cw", "\u{f01e}", "Ctrl+H"),
            item("Rotation de 90° dans le sens antihoraire", "rust:quick:rot-ccw", "\u{f0e2}", "Ctrl+G"),
            item("Rotation de 180°", "rust:quick:rot-180", "\u{f2f1}", "Ctrl+J"),
            item("Retourner horizontalement", "rust:quick:flip-h", "\u{f337}", ""),
            item("Retourner verticalement", "rust:quick:flip-v", "\u{f338}", ""),
            sep(),
            item("Aplatir", "rust:flatten", "\u{f5fd}", "Ctrl+Maj+F"),
            sep(),
            MenuItemSpec {
                label: i18n::tr("Mode du projet").into(),
                submenu: true,
                fa: "\u{f5fd}".into(),
                fa_weight: 900,
                children: ModelRc::new(VecModel::from(
                    [
                        ("Pixel", "rust:mode:pixel", "\u{f03e}"),
                        ("SVG (objets modifiables)", "rust:mode:svg", "\u{f5ee}"),
                        ("Animation pixel", "rust:mode:anim", "\u{f008}"),
                        ("Animation SVG", "rust:mode:svg-anim", "\u{f008}"),
                    ]
                    .iter()
                    .map(|(l, a, f)| SubItemSpec { label: i18n::tr(l).into(), action: (*a).into(), fa: (*f).into(), fa_weight: 900, badge: SharedString::default() })
                    .collect::<Vec<_>>(),
                )),
                ..Default::default()
            },
        ];
        for (k, it) in extra.into_iter().enumerate() {
            list.insert(at + k, it);
        }
        menus[im].items = ModelRc::new(VecModel::from(tidy(list)));
    }
    let view_menu = MenuSpec { title: i18n::tr("Affichage").into(), items: ModelRc::new(VecModel::from(tidy(view))) };
    menus.insert(edit + 1, view_menu);
    // Fenêtre en dernier (comme le menu Fenêtre de Paint.NET)
    if let Some(w) = pos(&menus, "Fenêtre") {
        let m = menus.remove(w);
        menus.push(m);
    }
    menus
}

/// Image › Mode du projet : pixel, svg, anim (animation pixel) ou svg-anim. Le mode SVG fait
/// des nouveaux calques des calques SVG (un calque SVG est ajouté s'il n'y en a aucun) ; quitter
/// le mode SVG garde les calques SVG existants. L'animation s'allume / s'éteint avec la frise.
fn set_work_mode(app: &AppWindow, st: &mut State, m: &str) {
    finish_edits(app, st);
    let (svg, anim_on) = (m.starts_with("svg"), m.ends_with("anim"));
    if svg != st.doc.vector_mode {
        st.doc.vector_mode = svg;
        if svg {
            st.doc.deselect();
        }
        if svg && !st.doc.layers.iter().any(|l| l.vector.is_some()) {
            layer_op(app, st, "vector-new");
        }
    }
    if anim_on != st.doc.anim.is_some() {
        anim_action(app, st, "toggle");
    }
    status(app, match m {
        "svg" => "Mode SVG : formes et textes restent des objets modifiables, les nouveaux calques sont des calques SVG",
        "svg-anim" => "Mode Animation SVG : chaque image de la frise garde ses propres objets",
        "anim" => "Mode Animation pixel : dessin image par image sur la frise",
        _ => "Mode Pixel",
    });
    refresh_all(app, st);
}

/// Rotation / retournement de l'image entière (menu Image, Ctrl+H / G / J) ; en mode
/// animation, toutes les images de la frise.
fn rotate_image(app: &AppWindow, st: &mut State, id: &str) {
    finish_edits(app, st);
    match id {
        "rot-cw" => anim_map_cels(&mut st.doc, |d| d.rotate90(true)),
        "rot-ccw" => anim_map_cels(&mut st.doc, |d| d.rotate90(false)),
        "rot-180" => anim_map_cels(&mut st.doc, |d| d.rotate180()),
        "flip-h" => anim_map_cels(&mut st.doc, |d| d.flip(true)),
        _ => anim_map_cels(&mut st.doc, |d| d.flip(false)),
    }
    st.doc.commit("Rotation / retournement");
    refresh_all(app, st);
    app.invoke_zoom_fit();
}

/// Image › Aplatir : tous les calques fondus en un seul (comme Paint.NET, Ctrl+Maj+F).
fn flatten_image(app: &AppWindow, st: &mut State) {
    if st.doc.anim.is_some() {
        return status(app, "Mode animation : aplatir n'est pas encore possible (quittez le mode animation)");
    }
    if st.doc.layers.len() < 2 {
        return status(app, "L'image n'a qu'un calque");
    }
    finish_edits(app, st);
    let flat = st.doc.flatten_final();
    let mut l = editor::Layer::new(&i18n::tr("Arrière-plan"), st.doc.w, st.doc.h, [0, 0, 0, 0]);
    l.px = flat.into();
    st.doc.layers = vec![l];
    st.doc.active = 0;
    st.doc.commit("Aplatir");
    refresh_all(app, st);
}

/// Action d'une entrée de menu : « fx:<effet> » ou l'appel JavaScript de la version web,
/// traduit vers son équivalent Rust.
/// Entrées d'un menu contextuel : actions des menus de la barre (libellé, icône, raccourci et
/// marqueur « à venir » repris tels quels). `-` = séparateur.
fn context_items(app: &AppWindow, wanted: &[&str]) -> ModelRc<MenuItemSpec> {
    let menus = app.get_menus();
    let mut all: Vec<MenuItemSpec> = Vec::new();
    for m in (0..menus.row_count()).filter_map(|i| menus.row_data(i)) {
        for it in (0..m.items.row_count()).filter_map(|j| m.items.row_data(j)) {
            if !it.submenu {
                all.push(it);
                continue;
            }
            for c in (0..it.children.row_count()).filter_map(|k| it.children.row_data(k)) {
                all.push(MenuItemSpec { label: c.label, action: c.action, badge: c.badge, fa: c.fa, fa_weight: c.fa_weight, ..Default::default() });
            }
        }
    }
    let mut out: Vec<MenuItemSpec> = Vec::new();
    for w in wanted {
        if *w == "-" {
            if !out.is_empty() && !out.last().is_some_and(|l| l.separator) {
                out.push(MenuItemSpec { separator: true, ..Default::default() });
            }
        } else if let Some(it) = all.iter().find(|it| !it.separator && it.action.contains(w)) {
            out.push(it.clone());
        }
    }
    ModelRc::new(VecModel::from(out))
}

/// Menu contextuel d'un calque : entrées des dossiers, du verrou et du calque texte selon le
/// calque cliqué (actions `layerop:…`, voir `layer_op`).
fn layer_context_extra(app: &AppWindow, base: ModelRc<MenuItemSpec>) -> Vec<MenuItemSpec> {
    let mut out: Vec<MenuItemSpec> = (0..base.row_count()).filter_map(|i| base.row_data(i)).collect();
    let rows = app.get_layers();
    let active = app.get_active_layer();
    let Some(row) = (0..rows.row_count()).filter_map(|i| rows.row_data(i)).find(|r| r.index == active) else { return out };
    let item = |label: &str, action: &str, fa: &str| MenuItemSpec { label: i18n::tr(label).into(), action: action.into(), fa: fa.into(), fa_weight: 900, ..Default::default() };
    out.push(MenuItemSpec { separator: true, ..Default::default() });
    out.push(item("Nouveau dossier", "layerop:group-new", "\u{f65e}"));
    out.push(item("Grouper dans un dossier", "layerop:group", "\u{f07b}"));
    if row.is_group {
        out.push(item("Dégrouper", "layerop:ungroup", "\u{f07c}"));
        out.push(item("Mode Transfert (fusion du contenu avec le dessous)", "layerop:pass", "\u{f0c5}"));
    }
    if row.dyn_on {
        out.push(MenuItemSpec { separator: true, ..Default::default() });
        out.push(item("Partout", "layerop:dynamic-everywhere", "\u{f0d0}"));
        out.push(item("Zone dessinée", "layerop:dynamic-mask", "\u{f1fc}"));
        out.push(item("Zone N&B", "layerop:dynamic-mask-view", "\u{f042}"));
    }
    out.push(item(if row.locked { "Déverrouiller le calque" } else { "Verrouiller le calque" }, "layerop:lock", if row.locked { "\u{f09c}" } else { "\u{f023}" }));
    if row.is_text {
        out.push(MenuItemSpec { separator: true, ..Default::default() });
        out.push(item("Effets du calque texte…", "layerop:text-fx", "\u{f0d0}"));
        out.push(item("Pixelliser le calque", "layerop:rasterize", "\u{f1fc}"));
    }
    out
}

/// Clic droit : menu contextuel de la toile, d'un calque ou d'un onglet. Les outils de dessin
/// gardent le clic droit pour la couleur secondaire (comme Paint.NET) : Ctrl + clic droit y
/// ouvre le menu.
/// `outside` : la toile a du contenu hors de ses bords (option « Hors toile »).
fn context_menu(app: &AppWindow, kind: &str, x: f32, y: f32, ctrl: bool, outside: bool) -> bool {
    let wanted: &[&str] = match kind {
        "canvas" => {
            let cur = Tool::from_id(app.get_current_tool().as_str());
            let painting = tools::is_stroke(cur) || matches!(
                cur,
                Tool::Fill | Tool::Gradient | Tool::Text | Tool::Shape | Tool::RoundRect | Tool::Line | Tool::Deform | Tool::Warp
            );
            #[cfg(target_arch = "wasm32")]
            let ctrl = ctrl || web::modifiers().0;
            if painting && !ctrl {
                return false;
            }
            // outils de sélection : Ctrl + clic droit = OU exclusif (Paint.NET), pas de menu
            if ctrl && matches!(cur, Tool::RectSelect | Tool::EllipseSelect | Tool::Lasso | Tool::PolyLasso | Tool::MagneticLasso | Tool::Wand) {
                return false;
            }
            &[
                "ctxCut", "ctxCopy", "ctxPaste", "-", "EditorManager.selectAll", "illuDeselectLikeCtrlD", "invertSelection", "clearSelectionContent", "-", "startIlluInteractiveCrop", "EditorManager.addLayer()", "-", "undo()", "redo()",
            ]
        }
        "snap" => &["toggleIlluSnapToEdges", "illuOpenSnapSettings"],
        "layer" => &["EditorManager.addLayer()", "duplicateActiveLayer", "deleteLayer()", "-", "moveLayer(1)", "moveLayer(-1)", "mergeLayers", "-", "openImageLayerBoundsDialog", "fx:rotatezoom"],
        _ => &["requestCloseActiveDocumentFromMenu", "-", "showExportDialog", "PhotoModeManager.open()", "showNewProjectDialog"],
    };
    let mut items = context_items(app, wanted);
    if kind == "layer" {
        items = ModelRc::new(VecModel::from(layer_context_extra(app, items)));
    }
    // contenu dessiné ou déplacé hors de la toile : agrandir la toile pour le reprendre
    if matches!(kind, "canvas" | "layer") && outside {
        let mut v: Vec<MenuItemSpec> = items.iter().collect();
        v.push(MenuItemSpec { separator: true, ..Default::default() });
        v.push(MenuItemSpec {
            label: i18n::tr("Ajuster la toile à la taille du calque (contenu hors toile)").into(),
            action: "rust:fitCanvasToOutside".into(),
            fa: "\u{f065}".into(),
            fa_weight: 900,
            ..Default::default()
        });
        items = ModelRc::new(VecModel::from(v));
    }
    app.set_ctx_items(items);
    app.set_ctx_x(x);
    app.set_ctx_y(y);
    app.set_ctx_open(true);
    true
}

fn handle_action(app: &AppWindow, state: &Shared, action: &str, label: &str) {
    // menus du Mode Photo Pro
    if let Some(a) = action.strip_prefix("pm:") {
        if let Some(k) = a.strip_prefix("preset:").and_then(|k| k.parse::<i32>().ok()) {
            return pm_preset(app, &mut state.borrow_mut(), k);
        }
        return pm_action(app, state, a);
    }
    let has = |k: &str| action.contains(k);
    // menus façon Paint.NET : boutons rapides (zoom, rotations) par leur action
    if let Some(q) = action.strip_prefix("rust:quick:") {
        return app.invoke_quick_action(q.into());
    }
    // ouvrir / exporter empruntent eux-mêmes l'état
    if has("illuTriggerFileImport") {
        return open_file(app, state);
    }
    if has("showExportDialog") {
        if state.borrow().empty {
            return status(app, "Aucun projet ouvert : rien à exporter");
        }
        return show_export(app, &state.borrow());
    }
    if has("IlluGifImport") {
        return import_sequence(app, state);
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;
    drop_floating(app, st);
    // aucun projet ouvert : seules les actions qui n'en ont pas besoin
    if st.empty && !NO_DOC_ACTIONS.iter().any(|k| action.contains(k)) {
        status(app, "Aucun projet ouvert : créez une nouvelle image ou ouvrez un fichier");
        return;
    }
    if has("toggleAnimationMode") {
        return anim_action(app, st, "toggle");
    }
    if let Some(m) = action.strip_prefix("rust:mode:") {
        return set_work_mode(app, st, m);
    }
    if action == "rust:paste-new" {
        return paste_new_image(app, st);
    }
    if action == "rust:flatten" {
        return flatten_image(app, st);
    }
    match action {
        "rust:sel-feather" | "rust:sel-border" | "rust:sel-smooth" if st.doc.sel.is_none() => {
            return status(app, "Aucune sélection : sélectionnez d'abord une zone");
        }
        "rust:sel-feather" => return prompt(app, "selfeather", "Contour progressif", "Rayon (pixels)", "8"),
        "rust:sel-border" => return prompt(app, "selborder", "Bordure de la sélection", "Largeur (pixels)", "10"),
        "rust:sel-smooth" => return prompt(app, "selsmooth", "Lisser la sélection", "Rayon (pixels)", "4"),
        "rust:sel-alpha" => {
            let a = st.doc.active;
            let mode = opts(app).sel_mode;
            st.doc.select_layer_alpha(a, mode);
            st.doc.selection_changed();
            return sel_changed(app, st);
        }
        _ => {}
    }
    if st.doc.anim.is_some() && ANIM_BLOCKED.iter().any(|k| action.contains(k)) {
        status(app, "Mode animation : changer la taille de l'image n'est pas encore possible (Rotation / retournement fonctionne sur toutes les images)");
        return;
    }
    // menu contextuel des calques : dossiers, verrou, calque texte
    if let Some(a) = action.strip_prefix("layerop:") {
        return layer_op(app, st, a);
    }
    if let Some(fx) = action.strip_prefix("fx:") {
        open_effect(app, st, fx, label);
        return;
    }
    let commit = |app: &AppWindow, st: &mut State, label: &str| {
        st.doc.commit(label);
        refresh_all(app, st);
    };
    let size_dialog = |app: &AppWindow, st: &State, canvas: bool| {
        app.set_dlg_w(SharedString::from(st.doc.w.to_string()));
        app.set_dlg_h(SharedString::from(st.doc.h.to_string()));
        app.set_rs_orig_w(st.doc.w as i32);
        app.set_rs_orig_h(st.doc.h as i32);
        app.set_rs_layers(st.doc.layers.len() as i32);
        app.set_rs_pct("100".into());
        app.set_rs_by_pct(false);
        app.set_rs_anchor(4);
        let presets = size_presets(st.doc.w, st.doc.h);
        app.set_rs_preset_labels(ModelRc::new(VecModel::from(std::iter::once(SharedString::from(i18n::tr("Choisir une taille…"))).chain(presets.iter().map(|p| p.label.clone())).collect::<Vec<_>>())));
        app.set_rs_presets(ModelRc::new(VecModel::from(presets)));
        app.set_resize_canvas_mode(canvas);
        app.set_show_resize(true);
    };
    if has("showNewProjectDialog") {
        show_new_project(app, st);
    } else if has("openActiveProjectInPhotoModePro") {
        // projet aplati, ajouté à la pellicule
        let flat = st.doc.flatten_final();
        let name = st.doc.title.clone();
        st.photo.photos.push(photo::Photo::new(&name, st.doc.w, st.doc.h, flat));
        st.photo.active = st.photo.photos.len() - 1;
        pm_open(app, st);
    } else if has("PhotoModeManager") {
        pm_open(app, st);
    } else if has("convertActiveProjectTo") {
        let mode = if has("ToRal") {
            ColorMode::Ral
        } else if has("ToCmjn") {
            ColorMode::Cmjn
        } else if has("ToDither") {
            ColorMode::Dither
        } else {
            ColorMode::Rgb
        };
        set_color_mode(app, st, mode);
    } else if has("requestCloseActiveDocument") {
        let cur = st.cur;
        request_close_tab(app, st, cur);
    } else if has("showSettingsDialog") {
        refresh_tech_info(app, st);
        app.set_show_settings(true);
    } else if has("showChangelog") {
        app.set_changelog_text(SharedString::from(include_str!("../../../changelog.txt")));
        app.set_show_changelog(true);
    } else if has("showDownloadDialog") {
        // Fichier › Télécharger l'application : même fenêtre que le bouton de la barre MasterPaint,
        // pour que toutes les interfaces y aient accès
        app.set_show_download(true);
    } else if has("showWelcomeDialog") {
        // Fichier › Bienvenue / Informations : toujours, même après « Ne plus afficher »
        app.set_show_welcome(true);
    } else if action == "fn:undo()" || has("undo()") && !has("redo") {
        if st.grad_live.is_some() {
            return gradlive::cancel(app, st);
        }
        if vecedit::undo_step(app, st) {
            return;
        }
        if st.shape_edit.is_some() {
            return shape_edit::cancel(app, st);
        }
        if st.session.tracing() {
            st.session.cancel(&mut st.doc);
            app.set_overlay_path(SharedString::default());
        } else {
            st.doc.undo();
        }
        refresh_all(app, st);
    } else if has("redo()") {
        st.doc.redo();
        refresh_all(app, st);
    } else if has("ctxCut") {
        if copy(app, st) {
            st.doc.erase_selection();
            commit(app, st, "Couper");
        }
    } else if has("ctxCopy") {
        copy(app, st);
    } else if has("ctxPaste") {
        paste(app, st);
    } else if has("selectAll") {
        st.doc.select_all();
        sel_changed(app, st);
    } else if has("deselectAll") {
        st.doc.deselect();
        sel_changed(app, st);
    } else if has("invertSelection") {
        st.doc.invert_selection();
        sel_changed(app, st);
    } else if has("clearSelectionContent") {
        st.doc.erase_selection();
        commit(app, st, "Effacer la sélection");
    } else if has("startIlluInteractiveCrop") {
        start_crop(app, st);
    } else if has("cropToSelection") {
        st.doc.crop_to_selection();
        commit(app, st, "Recadrer");
        app.invoke_zoom_fit();
    } else if has("resizeCanvas()") {
        size_dialog(app, st, false);
    } else if has("showExtendCanvasDialog") {
        size_dialog(app, st, true);
    } else if has("showPixelTransformDialog") {
        app.set_show_rotate(true);
    } else if has("rust:fitCanvasToOutside") {
        // The action handler already owns the state borrow. Preserve other layers' margins.
        finish_edits(app, st);
        if let Some((x, y, w, h)) = st.doc.layer_content_bounds(st.doc.active) {
            let (x0, y0) = (x.min(0), y.min(0));
            let (x1, y1) = ((x + w as isize).max(st.doc.w as isize), (y + h as isize).max(st.doc.h as isize));
            st.doc.resize_canvas_at((x1 - x0) as usize, (y1 - y0) as usize, -x0, -y0);
            st.doc.commit("Ajuster la toile au calque");
            app.invoke_zoom_fit();
            refresh_all(app, st);
        }
    } else if has("expandCanvasToLayers") {
        st.doc.crop_to_content();
        commit(app, st, "Ajuster au contenu");
        app.invoke_zoom_fit();
    } else if has("rust:newVectorLayer") {
        layer_op(app, st, "vector-new");
    } else if has("addLayer") {
        layer_op(app, st, "add");
    } else if has("deleteLayer") {
        layer_op(app, st, "delete");
    } else if has("duplicateActiveLayer") {
        layer_op(app, st, "duplicate");
    } else if has("moveLayer(1)") {
        layer_op(app, st, "up");
    } else if has("moveLayer(-1)") {
        layer_op(app, st, "down");
    } else if has("mergeLayers") {
        layer_op(app, st, "merge");
    } else if has("splitActiveLayerRgbChannels") {
        // menus Calques et Effets › Couleur : fenêtre (couleur / gris, décalages, original masqué)
        open_effect(app, st, "splitrgb", "Séparer les canaux RVB");
    } else if has("centerSelection") {
        let (h, v) = if has("'h'") {
            (Some(0), None)
        } else if has("'v'") {
            (None, Some(0))
        } else {
            (Some(0), Some(0))
        };
        st.doc.align_selection(h, v);
        commit(app, st, "Centrer la sélection");
    } else if has("showSelectionExpandDialog") {
        prompt(app, "selexpand", "Étendre / réduire la sélection", "Pixels (− = réduire)", "4");
    } else if has("showImageBorderDialog") {
        app.set_bd_doc_w(st.doc.w as i32);
        app.set_bd_doc_h(st.doc.h as i32);
        app.set_show_border(true);
    } else if has("alignActiveLayerWidthToCanvas") {
        status(app, "Les calques ont déjà les dimensions de la toile dans la version Rust");
    } else if has("openCanvasLivePreviewWindow") {
        live_open(app, st);
    } else if has("openIconViewerWindow") {
        open_icon_viewer(app);
    } else if has("openImageLayerBoundsDialog") {
        match st.doc.layer_content_bounds(st.doc.active) {
            Some((x, y, w, h)) => {
                app.set_bd_x(x.to_string().into());
                app.set_bd_y(y.to_string().into());
                app.set_bd_w(w.to_string().into());
                app.set_bd_h(h.to_string().into());
                app.set_bd_orig_w(w as i32);
                app.set_bd_orig_h(h as i32);
                app.set_show_bounds(true);
            }
            None => status(app, "Le calque actif est vide"),
        }
    } else if has("illuGuidedCutoutToolStart") {
        if st.doc.sel.is_some() {
            open_effect(app, st, "cutoutsel", "Détourage par sélection");
        } else {
            status(app, "Détourage : tracez d'abord une sélection autour de l'objet à garder");
        }
    } else if has("showContentAwareFillDialog") {
        if st.doc.sel.is_some() {
            open_effect(app, st, "contentfill", "Remplissage contenu pris en compte");
        } else {
            status(app, "Remplissage : sélectionnez la zone à reconstituer");
        }
    } else if has("showInstantFilterGallery") {
        open_effect(app, st, "gallery", "Galerie de filtres");
    } else if has("openCurvesForActiveLayer") {
        open_curves(app, st);
    } else if has("openLevelsForActiveLayer") {
        open_effect(app, st, "levels", "Niveaux");
    } else if has("openCameraRawForActiveLayer") {
        open_effect(app, st, "cameraraw", "Camera Raw");
    } else if has("illuRepeatLastEffect") {
        repeat_effect(app, st);
    } else if has("toggleIlluPixelGrid") {
        toggle_opt(app, "pixel-grid");
    } else if has("toggleIlluRulers") {
        toggle_opt(app, "rulers");
    } else if has("toggleIlluSnapToEdges") {
        toggle_opt(app, "snap");
    } else if has("illuRemoveBackgroundIntelligent") {
        rmbg_open(app, st);
    } else if has("illuOpenSnapSettings") {
        refresh_snap_grid(app, st);
        app.set_show_snap(true);
    } else if has("toggleIlluAllowOutsideCanvas") {
        toggle_outside(app, st);
    } else if has("toggleIlluShowAllRibbonOptions") {
        app.set_toolbar_mode(1 - app.get_toolbar_mode());
    } else if has("toggleFloatingPaletteVisibility") {
        if has("win-tools") {
            app.set_show_tools(!app.get_show_tools());
        } else if has("win-colors") {
            app.set_show_colors(!app.get_show_colors());
        } else if has("win-layers") {
            app.set_show_layers(!app.get_show_layers());
        } else if has("win-history") {
            app.set_show_history(!app.get_show_history());
        } else if has("win-svg-objects") {
            // panneau « Objets SVG (bêta) » : objets du calque vectoriel actif (svg_panel.rs)
            svg_panel::toggle(app, st);
        } else {
            status(app, "Fenêtre pas encore portée dans la version Rust");
        }
    } else if label == i18n::tr("Interface : mode téléphone (menu ☰, palettes en colonnes)") || label == i18n::tr("Palettes : ancrage fixe (style Adobe)") {
        // bascule de disposition (Paint.NET ↔ téléphone / Photoshop), enregistrée ; quitter
        // l'interface téléphone affichée d'office sur un écran étroit la désactive (le choix
        // est respecté, l'interface n'est jamais imposée)
        let target = if label == i18n::tr("Interface : mode téléphone (menu ☰, palettes en colonnes)") { 2 } else { 1 };
        let layout = if target == 2 && app.get_phone() {
            if app.get_set_layout() == 2 { 0 } else { app.get_set_layout() }
        } else if app.get_set_layout() == target {
            0
        } else {
            target
        };
        if layout != 2 && app.get_phone() {
            app.set_set_layout_auto(false);
        }
        app.set_set_layout(layout);
        set_phone_panels(app, app.get_phone());
        save_settings(app);
        app.invoke_zoom_fit();
    } else if label == i18n::tr("Palettes volantes (Paint.NET)") {
        if app.get_phone() {
            app.set_set_layout_auto(false);
        }
        app.set_set_layout(0);
        set_phone_panels(app, app.get_phone());
        save_settings(app);
        app.invoke_zoom_fit();
    } else if has("resetWorkspace") {
        // palettes affichées et remises à leur place d'origine (positions retenues oubliées),
        // colonne Photoshop d'origine, toile ajustée
        app.set_show_tools(true);
        app.set_show_colors(true);
        app.set_show_layers(true);
        app.set_show_history(true);
        for set in [AppWindow::set_geom_tools, AppWindow::set_geom_colors, AppWindow::set_geom_layers, AppWindow::set_geom_history] {
            set(app, PalGeom::default());
        }
        let d = settings::Settings::default().ps_dock;
        app.set_ps_pos_colors(d[0] as i32);
        app.set_ps_pos_history(d[1] as i32);
        app.set_ps_pos_layers(d[2] as i32);
        app.set_ps_h_colors(d[3]);
        app.set_ps_h_history(d[4]);
        // palettes déjà déplacées : leur position n'écoute plus geom_*, le signal les y ramène
        let w = app.global::<Workspace>();
        w.set_reset(w.get_reset() + 1);
        save_settings(app);
        app.invoke_zoom_fit();
        status(app, "Bureau réinitialisé : palettes à leur place d'origine");
    } else {
        let l = label.trim_end_matches('…').trim_end_matches("...").trim();
        status(app, i18n::tr_format!("« {l} » : pas encore porté dans la version Rust"));
    }
}
// ------------------------------------------------------------------ Mode Photo Pro

/// Extensions RAW pour le sélecteur de fichiers du navigateur (« .arw,.cr2,… »).
#[cfg(target_arch = "wasm32")]
fn raw_accept() -> String {
    raw::EXTENSIONS.iter().map(|e| format!(".{e}")).collect::<Vec<_>>().join(",")
}

// ------------------------------------------------------------------ chargement en tâche de fond

/// Où va le résultat d'un chargement.
#[derive(Clone, Copy, PartialEq)]
enum LoadTo {
    /// nouveaux onglets (les photos RAW vont au Mode Photo Pro)
    Tabs,
    /// pellicule du Mode Photo Pro
    Photos,
    /// glisser-déposer : fenêtre « Que voulez-vous faire ? »
    Drop,
}

enum Loaded {
    Pixels(String, usize, usize, Vec<u8>),
    /// fichier SVG : la fenêtre de choix (découpage, destination) décide de l'import
    Svg(String, Vec<u8>),
    Illu(Result<illu::Loaded, String>),
    Photo(Box<photo::Photo>),
    Failed(String, String),
}

/// Étapes d'un chargement : chacune est annoncée (fraction atteinte, libellé) avant d'être
/// exécutée, sur un autre fil sur le bureau, entre deux tours de boucle sur le web.
struct LoadJob {
    to: LoadTo,
    files: std::collections::VecDeque<(String, Vec<u8>)>,
    total: usize,
    finished: usize,
    sensor: Option<(String, raw::Sensor)>,
    developed: Option<(String, raw::Raw)>,
    out: Vec<Loaded>,
}

impl LoadJob {
    fn new(to: LoadTo, files: Vec<(String, Vec<u8>)>) -> LoadJob {
        let total = files.len().max(1);
        LoadJob { to, files: files.into(), total, finished: 0, sensor: None, developed: None, out: Vec::new() }
    }

    /// Prochaine étape : (progression globale en fin d'étape, libellé), `None` si tout est fait.
    fn plan(&self) -> Option<(f32, String)> {
        let at = |frac: f32| (self.finished as f32 + frac) / self.total as f32;
        if let Some((n, _)) = &self.developed {
            return Some((at(1.0), i18n::tr_format!("Aperçu et vignette de « {n} »")));
        }
        if let Some((n, _)) = &self.sensor {
            return Some((at(0.85), i18n::tr_format!("Dématriçage et couleurs de « {n} » (flottant)")));
        }
        let (n, _) = self.files.front()?;
        Some(if raw::is_raw(n) { (at(0.3), i18n::tr_format!("Lecture des données du capteur de « {n} »")) } else { (at(0.9), i18n::tr_format!("Décodage de « {n} »")) })
    }

    fn run(&mut self) {
        if let Some((n, r)) = self.developed.take() {
            self.out.push(Loaded::Photo(Box::new(photo::Photo::from_raw(&n, r))));
            self.finished += 1;
            return;
        }
        if let Some((n, sensor)) = self.sensor.take() {
            match raw::develop(&sensor) {
                Ok(r) => {
                    applog::log(format!("RAW : {n} → {} × {} px, blanc {:.3}, exposition de base +{:.2} IL", r.w, r.h, r.white, r.baseline_ev));
                    self.developed = Some((n, r));
                }
                Err(e) => {
                    self.out.push(Loaded::Failed(n, e));
                    self.finished += 1;
                }
            }
            return;
        }
        let Some((name, bytes)) = self.files.pop_front() else { return };
        applog::log(i18n::tr_format!("Chargement : {name} ({} octets)", bytes.len()));
        if raw::is_raw(&name) {
            match raw::read(&bytes) {
                Ok(sensor) => self.sensor = Some((name, sensor)),
                Err(e) => {
                    self.out.push(Loaded::Failed(name, e));
                    self.finished += 1;
                }
            }
            return;
        }
        self.finished += 1;
        if name.to_lowercase().ends_with(".illu") {
            return self.out.push(Loaded::Illu(illu::load(&bytes)));
        }
        // fichier Photoshop : calques, dossiers, masques, modes de fusion
        if name.to_lowercase().ends_with(".psd") || name.to_lowercase().ends_with(".psb") {
            return self.out.push(Loaded::Illu(psd::load(&name, &bytes).map(|(doc, notes)| illu::Loaded {
                docs: vec![doc],
                skipped: notes,
            })));
        }
        // fichier Paint.NET : calques, noms, visibilité, opacité, modes de fusion
        if name.to_lowercase().ends_with(".pdn") {
            return self.out.push(Loaded::Illu(pdn::load(&name, &bytes).map(|(doc, notes)| illu::Loaded {
                docs: vec![doc],
                skipped: notes,
            })));
        }
        // dessin SVG : importé après la fenêtre de choix (fil principal, load_done)
        if name.to_lowercase().ends_with(".svg") {
            return self.out.push(Loaded::Svg(name, bytes));
        }
        match decode(&bytes) {
            Some((w, h, px)) if self.to == LoadTo::Photos => self.out.push(Loaded::Photo(Box::new(photo::Photo::new(&name, w, h, px)))),
            Some((w, h, px)) => self.out.push(Loaded::Pixels(name, w, h, px)),
            None => self.out.push(Loaded::Failed(name.clone(), i18n::tr_format!("« {name} » : format d'image non reconnu (formats lus : PNG, JPEG, WebP, BMP, GIF, ICO, TIFF, TGA, QOI, RAW, PSD, PDN, SVG, .illu)."))),
        }
    }
}

/// Projets en cours de chargement (fenêtre de progression visible tant que > 0).
static LOADS_ACTIVE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
/// Captures et tests : chargement immédiat (la boucle d'événements n'est pas pompée).
static SYNC_LOADS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn load_progress(app: &AppWindow, frac: f32, label: &str) {
    app.set_load_progress(frac);
    app.set_load_detail(i18n::tr(label).into());
}

/// Charge des fichiers (image, photo RAW, projet) sans figer l'interface : fenêtre de
/// progression, décodage et développement en tâche de fond, puis ouverture.
fn start_load(app: &AppWindow, st: &mut State, to: LoadTo, files: Vec<(String, Vec<u8>)>) {
    use std::sync::atomic::Ordering::Relaxed;
    if files.is_empty() {
        return;
    }
    let single = files.len() == 1;
    let first = files[0].0.clone();
    // photos (et RAW, qui vont toujours au Photo Pro) : fichier d'origine gardé pour la
    // sauvegarde automatique de la pellicule (pm_store), sauf pendant sa restauration
    if !st.photo.restoring {
        for (n, b) in &files {
            if to == LoadTo::Photos || raw::is_raw(n) {
                st.photo.pending_orig.push((n.clone(), std::sync::Arc::new(b.clone())));
            }
        }
    }
    let mut job = LoadJob::new(to, files);
    if SYNC_LOADS.load(Relaxed) {
        while job.plan().is_some() {
            job.run();
        }
        return load_done(app, st, to, job.out);
    }
    LOADS_ACTIVE.fetch_add(1, Relaxed);
    app.set_load_title(i18n::tr(if single && raw::is_raw(&first) { "Développement de la photo RAW" } else if single { "Ouverture de l'image" } else { "Ouverture des fichiers" }).into());
    load_progress(app, 0.0, "Préparation…");
    app.set_loading(true);
    #[cfg(not(target_arch = "wasm32"))]
    {
        let weak = app.as_weak();
        std::thread::spawn(move || {
            let t0 = now_ms();
            while let Some((frac, label)) = job.plan() {
                let w = weak.clone();
                let _ = slint::invoke_from_event_loop(move || {
                    if let Some(app) = w.upgrade() {
                        load_progress(&app, frac, &label);
                    }
                });
                job.run();
            }
            applog::log(i18n::tr_format!("Chargement terminé en {:.0} ms", now_ms() - t0));
            load_deliver(weak, to, job.out);
        });
    }
    #[cfg(target_arch = "wasm32")]
    {
        // pas de fil sur le web : une étape par tour de boucle, la fenêtre se repeint entre deux
        let _ = st;
        let weak = app.as_weak();
        let _ = slint::spawn_local(async move {
            // JPEG : décodeur natif du navigateur (grandes photos), repassé à l'application sous
            // forme de pixels bruts
            for (name, bytes) in job.files.iter_mut() {
                if bytes.starts_with(&[0xff, 0xd8]) && !raw::is_raw(name) {
                    if let Some((w, h, px)) = web::decode_native(bytes).await {
                        let mut packed = Vec::with_capacity(16 + px.len());
                        packed.extend_from_slice(PREDECODED);
                        packed.extend_from_slice(&(w as u32).to_le_bytes());
                        packed.extend_from_slice(&(h as u32).to_le_bytes());
                        packed.extend_from_slice(&px);
                        *bytes = packed;
                    }
                }
            }
            load_web(weak, to, std::mem::take(&mut job.files).into()).await;
        });
    }
}

#[cfg(not(target_arch = "wasm32"))]
fn load_deliver(weak: slint::Weak<AppWindow>, to: LoadTo, out: Vec<Loaded>) {
    let _ = slint::invoke_from_event_loop(move || {
        let Some(app) = weak.upgrade() else { return };
        let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
        let busy = state.try_borrow_mut().is_err();
        if busy {
            return load_deliver(app.as_weak(), to, out);
        }
        load_done(&app, &mut state.borrow_mut(), to, out);
    });
}

/// Navigateur : RAW développé et images décodées par le worker (l'interface reste libre) ;
/// sans worker, une étape par tour de boucle (la fenêtre de progression se repeint entre deux).
#[cfg(target_arch = "wasm32")]
async fn load_web(weak: slint::Weak<AppWindow>, to: LoadTo, files: Vec<(String, Vec<u8>)>) {
    let total = files.len().max(1);
    let mut out = Vec::new();
    for (i, (name, bytes)) in files.into_iter().enumerate() {
        let at = |f: f32| (i as f32 + f) / total as f32;
        let progress = |f: f32, label: &str| {
            if let Some(app) = weak.upgrade() {
                load_progress(&app, at(f), label);
            }
        };
        if raw::is_raw(&name) {
            progress(0.85, &i18n::tr_format!("Développement de « {name} » en flottant (arrière-plan)"));
            if let Some(r) = web::compute_raw(&bytes).await {
                applog::log(format!("RAW : {name} → {} × {} px, blanc {:.3}, exposition de base +{:.2} IL (worker)", r.w, r.h, r.white, r.baseline_ev));
                progress(1.0, &i18n::tr_format!("Aperçu et vignette de « {name} »"));
                web::sleep(30).await;
                out.push(Loaded::Photo(Box::new(photo::Photo::from_raw(&name, r))));
                continue;
            }
        } else if !is_project_file(&name) && !bytes.starts_with(PREDECODED) {
            progress(0.9, &i18n::tr_format!("Décodage de « {name} » (arrière-plan)"));
            if let Some((w, h, px)) = web::compute_decode(&bytes).await {
                out.push(if to == LoadTo::Photos { Loaded::Photo(Box::new(photo::Photo::new(&name, w, h, px))) } else { Loaded::Pixels(name, w, h, px) });
                continue;
            }
        }
        // sans worker, projet .illu ou JPEG déjà décodé par le navigateur : étapes sur place
        let mut job = LoadJob::new(to, vec![(name, bytes)]);
        while let Some((f, label)) = job.plan() {
            progress(f, &label);
            web::sleep(30).await;
            job.run();
        }
        out.append(&mut job.out);
    }
    let Some(app) = weak.upgrade() else { return };
    loop {
        let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
        if let Ok(mut st) = state.try_borrow_mut() {
            return load_done(&app, &mut st, to, out);
        }
        web::sleep(5).await;
    }
}

/// Visionneuse d'icônes : onglet MasterPaint, sans recherche, aperçu au thème courant.
fn open_icon_viewer(app: &AppWindow) {
    let (n_mp, n_fa) = theme::icon_counts(app);
    app.set_icon_counts(ModelRc::new(VecModel::from(vec![n_mp as i32, n_fa as i32])));
    app.set_icon_tab(0);
    app.set_icon_query(SharedString::default());
    app.set_icon_dark(app.global::<Theme>().get_dark());
    app.set_icon_accent(app.global::<Theme>().get_accent_base());
    app.set_icon_sel(-1);
    app.set_icon_entries(ModelRc::new(VecModel::from(theme::icon_entries(app, 0, "", app.get_icon_dark()))));
    app.set_show_icons(true);
}

/// Copie un texte dans le presse-papiers du système (navigateur : celui de la page).
fn copy_text(text: &str) -> bool {
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;
        let Some(w) = web_sys::window() else { return false };
        let Ok(cb) = js_sys::Reflect::get(&w.navigator(), &"clipboard".into()) else { return false };
        let Ok(f) = js_sys::Reflect::get(&cb, &"writeText".into()) else { return false };
        return f.dyn_ref::<js_sys::Function>().is_some_and(|f| f.call1(&cb, &text.into()).is_ok());
    }
    #[cfg(not(any(target_arch = "wasm32", target_os = "android")))]
    {
        return clipboard_size::write_text(text);
    }
    #[cfg(target_os = "android")]
    {
        let _ = text;
        false
    }
}

/// Ouvre un SVG selon le choix : nouvel onglet, ou ses calques ajoutés au projet en cours (au-
/// dessus du calque actif, dans leur ordre).
fn open_svg(app: &AppWindow, st: &mut State, name: &str, bytes: &[u8], mode: svg_import::SvgMode, here: bool) {
    let l = match svg_import::import_with(name, bytes, mode) {
        Ok(l) => l,
        Err(e) => return show_error(app, "Ouvrir un SVG", &e),
    };
    if here && !st.empty {
        finish_edits(app, st);
        let Some(src) = l.docs.into_iter().next() else { return };
        let (w, h) = (st.doc.w, st.doc.h);
        for layer in src.layers {
            let Some(v) = layer.vector else { continue };
            st.doc.add_layer_in();
            let px = v.render_objects(&mut st.fonts, w, h);
            let dst = st.doc.layer_mut();
            dst.name = layer.name;
            dst.px = px.into();
            dst.vector = Some(v);
        }
        st.doc.commit("Importer un SVG");
        refresh_all(app, st);
    } else {
        for mut d in l.docs {
            // textes (noms de la grille d'icônes) : rendus avec les polices de l'application
            let (w, h) = (d.w, d.h);
            for layer in d.layers.iter_mut() {
                if let Some(v) = layer.vector.as_ref().filter(|v| v.objects.iter().any(|o| matches!(o, vector::Obj::Text(_)))) {
                    layer.px = v.render_objects(&mut st.fonts, w, h).into();
                }
            }
            if let Some(px) = d.history.last_mut().map(|s| &mut s.layers) {
                for (sl, l) in px.iter_mut().zip(d.layers.iter()) {
                    sl.px = l.px.clone();
                }
            }
            set_document(app, st, d);
        }
    }
    if !l.skipped.is_empty() {
        let skipped: Vec<String> = l.skipped.iter().map(|e| i18n::tr(e)).collect();
        status(app, i18n::tr_format!("Non repris (pas encore en Rust) : {}", skipped.join(", ")));
    }
}

/// Fichier projet ou dessin (ouvert en onglet, pas décodé comme une image) : .illu, .pdn, .svg.
fn is_project_file(name: &str) -> bool {
    let n = name.to_lowercase();
    n.ends_with(".illu") || n.ends_with(".pdn") || n.ends_with(".svg")
}

/// Fin d'un chargement (fil principal) : ouvre onglets, photos ou fenêtre de dépôt.
fn load_done(app: &AppWindow, st: &mut State, to: LoadTo, out: Vec<Loaded>) {
    use std::sync::atomic::Ordering::Relaxed;
    if LOADS_ACTIVE.load(Relaxed) > 0 && LOADS_ACTIVE.fetch_sub(1, Relaxed) == 1 {
        app.set_loading(false);
    }
    let (mut photos, mut failed) = (0, Vec::new());
    for l in out {
        match l {
            Loaded::Pixels(name, w, h, px) if to == LoadTo::Drop => dropped_pixels(app, st, name, w, h, px),
            Loaded::Pixels(name, w, h, px) => {
                let doc = Doc::from_pixels(w, h, px, &name);
                set_document(app, st, doc);
            }
            Loaded::Illu(Ok(l)) => {
                for d in l.docs {
                    set_document(app, st, d);
                }
                if !l.skipped.is_empty() {
                    let skipped: Vec<String> = l.skipped.iter().map(|entry| {
                        if let Some((count, message)) = entry.split_once(" × ").filter(|(n, _)| n.parse::<usize>().is_ok()) {
                            format!("{count} × {}", i18n::tr(message))
                        } else { i18n::tr(entry) }
                    }).collect();
                    status(app, i18n::tr_format!("Non repris (pas encore en Rust) : {}", skipped.join(", ")));
                }
            }
            Loaded::Illu(Err(e)) => show_error(app, "Ouvrir un projet", &e),
            // une seule fenêtre de choix à la fois : les SVG suivants sont ouverts en calques séparés
            Loaded::Svg(name, bytes) if st.task.is_some() => open_svg(app, st, &name, &bytes, svg_import::SvgMode::Split, false),
            Loaded::Svg(name, bytes) => {
                let sprite = svg_import::has_symbols(&bytes);
                let intro = i18n::tr_format!("« {name} » : comment ouvrir ce dessin ? Les formes et les chemins restent des objets modifiables (calques SVG).");
                st.task = Some(Task::SvgOpen(name, bytes, sprite));
                let mut cmds: Vec<(&str, &str)> = Vec::new();
                if sprite {
                    cmds.push(("Grille d'icônes", "Feuille de symboles (type illu-sprite.svg) : chaque icône dans une case, son nom dessous."));
                }
                cmds.push(("Un calque par élément", "Nouveau projet : chaque élément ou groupe racine du fichier sur son propre calque SVG."));
                cmds.push(("Tout sur un seul calque", "Nouveau projet : tous les éléments sur un même calque SVG."));
                if !st.empty {
                    cmds.push(("Dans le projet en cours", "Ajoute les éléments du fichier au projet ouvert, un calque SVG par élément racine."));
                }
                cmds.push(("Annuler", "N'ouvre pas le fichier."));
                show_task(app, "Ouvrir un SVG", &intro, "", "", &cmds, Vec::new());
            }
            Loaded::Photo(mut p) => {
                if st.photo.restoring {
                    pm_store::restored(st, &mut p);
                }
                st.photo.photos.push(*p);
                let idx = st.photo.photos.len() - 1;
                pm_store::photo_added(st, idx);
                photos += 1;
            }
            Loaded::Failed(name, e) => failed.push((name, e)),
        }
    }
    // restauration de la pellicule au démarrage : mode laissé fermé (onglet « Photo Pro »)
    if st.photo.restoring {
        st.photo.restoring = false;
        st.photo.restore.clear();
        st.photo.active = st.photo.restore_active.min(st.photo.photos.len().saturating_sub(1));
        pm_store::save_session(st);
        app.set_pm_count(st.photo.photos.len() as i32);
        if photos > 0 {
            status(app, i18n::tr_format!("Photo Pro : {photos} photo(s) retrouvée(s) avec leurs réglages (onglet Photo Pro)"));
        }
        return;
    }
    if photos > 0 {
        st.photo.active = st.photo.photos.len() - 1;
        pm_store::save_session(st);
        if app.get_pm_open() {
            pm_sync(app, st);
            pm_render(app, st);
        } else {
            pm_open(app, st);
        }
        status(app, if photos == 1 { "Photo ouverte dans le Mode Photo Pro".to_string() } else { i18n::tr_format!("{photos} photos ajoutées à la pellicule") });
    }
    match failed.as_slice() {
        [] => {}
        [(name, e)] => show_error(app, "Ouvrir", &i18n::tr_format!("« {name} » : {e}")),
        many => show_error(app, "Ouvrir", &many.iter().map(|(n, e)| format!("« {n} » : {e}")).collect::<Vec<_>>().join("\n")),
    }
}

/// Ouvre le Mode Photo Pro (pellicule gardée d'une ouverture à l'autre).
fn pm_open(app: &AppWindow, st: &mut State) {
    finish_edits(app, st);
    if st.photo.brush.0 <= 0.0 {
        st.photo.brush = (5.0, 50.0, 100.0, false);
    }
    pm_masks::sync_brush(app, st);
    app.set_phone_menu(false);
    app.set_phone_sheet(SharedString::default());
    let names: Vec<SharedString> = photo::preset_names().into_iter().map(|name| SharedString::from(i18n::tr(name))).collect();
    app.set_pm_presets(ModelRc::new(VecModel::from(names)));
    pm_set_open(app, true);
    pm_sync(app, st);
    pm_render(app, st);
}

/// Thème choisi dans les Paramètres pendant que le Mode Photo Pro impose le sombre
/// (0 : mode fermé, 1 : clair, 2 : sombre) ; c'est lui qui est enregistré.
static PM_DARK_RESTORE: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(0);
/// Thème clair / sombre choisi hors de la présentation Photoshop (0 inconnu = clair, 1 clair,
/// 2 sombre) : Photoshop impose le sombre, le quitter rend ce choix (Paint.NET n'impose rien).
static USER_DARK: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(0);

/// Thème sombre choisi par l'utilisateur (hors Mode Photo Pro), pour l'enregistrement.
fn saved_dark(app: &AppWindow) -> bool {
    match PM_DARK_RESTORE.load(std::sync::atomic::Ordering::Relaxed) {
        1 => false,
        2 => true,
        _ => app.global::<Theme>().get_dark(),
    }
}

/// Mode Photo Pro ouvert ou fermé, comme la version web : interface sombre le temps du mode
/// (sans toucher au réglage enregistré), menus réduits à ceux du mode, onglets et barre rapide
/// masqués.
fn pm_set_open(app: &AppWindow, open: bool) {
    use std::sync::atomic::Ordering::Relaxed;
    if open == app.get_pm_open() {
        return;
    }
    let t = app.global::<Theme>();
    if open {
        PM_DARK_RESTORE.store(if t.get_dark() { 2 } else { 1 }, Relaxed);
        if !t.get_dark() {
            theme::apply(app, true, t.get_accent_base());
        }
        app.set_menus(photo_menus());
    } else {
        let dark = PM_DARK_RESTORE.swap(0, Relaxed) == 2;
        if !dark {
            theme::apply(app, false, t.get_accent_base());
        }
        app.set_menus(menus_with_status(app));
    }
    app.set_open_menu(-1);
    app.set_pm_hq_shown(false);
    app.set_pm_open(open);
}

/// Menus du Mode Photo Pro (version web : menu Fichier « photopro », Édition, Ajustements).
fn photo_menus() -> ModelRc<MenuSpec> {
    let item = |label: &str, fa: char, shortcut: &str, action: &str| MenuItemSpec {
        label: i18n::tr(label).into(),
        fa: fa.to_string().into(),
        fa_weight: 900,
        shortcut: shortcut.into(),
        action: action.into(),
        ..Default::default()
    };
    let sep = || MenuItemSpec { separator: true, ..Default::default() };
    let presets: Vec<SubItemSpec> = photo::preset_names()
        .into_iter()
        .enumerate()
        .skip(1)
        .map(|(k, n)| SubItemSpec { label: i18n::tr(n).into(), action: format!("pm:preset:{k}").into(), fa: "\u{f0d0}".into(), fa_weight: 900, ..Default::default() })
        .collect();
    let menu = |title: &str, items: Vec<MenuItemSpec>| MenuSpec { title: i18n::tr(title).into(), items: ModelRc::new(VecModel::from(items)) };
    let menus = vec![
        menu(
            "Fichier",
            vec![
                item("Importer des photos…", '\u{f030}', "Ctrl+O", "pm:import"),
                item("Ouvrir dans l'éditeur", '\u{f35d}', "", "pm:open-editor"),
                item("Exporter en JPEG…", '\u{f56e}', "Ctrl+S", "pm:export"),
                item("Exporter en PNG 16 bits…", '\u{f56e}', "", "pm:export:png16"),
                item("Exporter en TIFF 16 bits…", '\u{f56e}', "", "pm:export:tiff16"),
                sep(),
                item("Paramètres…", '\u{f013}', "", "pm:settings"),
                sep(),
                item("Réduire (garder la pellicule)", '\u{f2d1}', "", "pm:minimize"),
                item("Fermer le Mode Photo Pro", '\u{f00d}', "", "pm:close"),
            ],
        ),
        menu(
            "Édition",
            vec![
                item("Annuler", '\u{f0e2}', "Ctrl+Z", "pm:undo"),
                item("Rétablir", '\u{f01e}', "Ctrl+Y", "pm:redo"),
                sep(),
                item("Réinitialiser les réglages", '\u{f0e2}', "", "pm:reset"),
                item("Appliquer à toutes les photos", '\u{f0c5}', "", "pm:apply-all"),
                sep(),
                item("Rotation de 90°", '\u{f2f9}', "", "pm:rotate"),
                item("Recadrer et redresser", '\u{f125}', "", "pm:crop"),
                item("Annuler le recadrage", '\u{f0e2}', "", "pm:crop-reset"),
                item("Comparer avec l'original", '\u{f06e}', "", "pm:fx"),
            ],
        ),
        menu(
            "Ajustements",
            vec![
                item("Réglage automatique", '\u{f0d0}', "", "pm:auto"),
                MenuItemSpec { label: i18n::tr("Préréglages créatifs").into(), submenu: true, fa: "\u{f53f}".into(), fa_weight: 900, children: ModelRc::new(VecModel::from(presets)), ..Default::default() },
            ],
        ),
    ];
    ModelRc::new(VecModel::from(menus))
}

/// Préréglage créatif `k` sur la photo active.
fn pm_preset(app: &AppWindow, st: &mut State, k: i32) {
    let active = st.photo.active;
    let Some(p) = st.photo.photos.get_mut(active) else { return };
    // le filtre se pose par-dessus les réglages de l'utilisateur (photo::with_preset) : ils
    // restent tels quels, en changeant de filtre comme en le retirant
    p.preset = k;
    p.modified = true;
    pm_sync(app, st);
    pm_render(app, st);
}

/// Pellicule, réglages de la photo active, informations.
fn pm_sync(app: &AppWindow, st: &State) {
    let pm = &st.photo;
    let thumbs: Vec<PmThumb> = pm
        .photos
        .iter()
        .enumerate()
        .map(|(i, p)| PmThumb { name: p.name.as_str().into(), thumb: to_image(&p.thumb.2, p.thumb.0, p.thumb.1), active: i == pm.active, modified: p.modified })
        .collect();
    app.set_pm_photos(ModelRc::new(VecModel::from(thumbs)));
    app.set_pm_count(pm.photos.len() as i32);
    pm_store::sync_undo(app, st);
    pm_masks::sync(app, st);
    app.set_pm_fx_off(pm.fx_off);
    match pm.photos.get(pm.active) {
        Some(p) => {
            app.set_pm_values(ModelRc::new(VecModel::from(p.params.clone())));
            app.set_pm_shift(ModelRc::new(VecModel::from(p.preset_shift())));
            // fond d'ambiance (MasterPaint) : la vignette réduite à 28 px, agrandie en douceur
            let (tw, th, t) = &p.thumb;
            let (aw, ah, amb) = photo::downscale(t, *tw, *th, 28);
            app.set_pm_ambient(to_image(&amb, aw, ah));
            app.set_pm_preset(p.preset);
            app.set_pm_img_w(p.pw as i32);
            app.set_pm_img_h(p.ph as i32);
            app.set_pm_full_w(p.w as i32);
            app.set_pm_crop(ModelRc::new(VecModel::from(vec![p.crop.0, p.crop.1, p.crop.2, p.crop.3])));
            app.set_pm_angle(p.angle);
            let note = if p.note.is_empty() { String::new() } else { format!(" · {}", p.note) };
            app.set_pm_info(SharedString::from(i18n::tr_format!("{} — {} × {} px{note}", p.name, p.w, p.h)));
        }
        None => {
            app.set_pm_values(ModelRc::new(VecModel::from(photo::neutral())));
            app.set_pm_shift(ModelRc::default());
            app.set_pm_preset(0);
            app.set_pm_info(SharedString::default());
        }
    }
}

/// Rendu de la photo active, en deux temps comme la version web : tout de suite l'image entière
/// en basse résolution (curseurs fluides ; le dernier réglage gagne), puis, après une courte
/// pause, la zone visible à la résolution de l'écran (`pm_hq`). Les deux en arrière-plan.
fn pm_render(app: &AppWindow, st: &mut State) {
    // historique : l'état sera rangé peu après le dernier réglage
    pm_store::touch(app);
    // réglage ou photo changés : la zone haute résolution affichée n'est plus juste, et celle
    // en cours de calcul est abandonnée (bureau : jeton d'annulation ; navigateur : sa file de
    // worker est arrêtée)
    st.photo.hq_gen += 1;
    PM_HQ_GEN.store(st.photo.hq_gen, std::sync::atomic::Ordering::Relaxed);
    if PM_HQ_BUSY.swap(false, std::sync::atomic::Ordering::Relaxed) {
        #[cfg(target_arch = "wasm32")]
        web::cancel_lane(2);
    }
    app.set_pm_hq_shown(false);
    let pm = &mut st.photo;
    let Some(ph) = pm.photos.get(pm.active) else {
        app.set_pm_image(Image::default());
        app.set_pm_busy(false);
        return;
    };
    if pm.fx_off {
        app.set_pm_image(to_image(&ph.preview, ph.pw, ph.ph));
        pm_histogram(app, &ph.preview);
        app.set_pm_busy(false);
        return;
    }
    pm_schedule_hq(app, 420);
    if pm.running {
        pm.queued = true;
        return;
    }
    pm.running = true;
    pm.gen += 1;
    let (gen, idx, w, h) = (pm.gen, pm.active, ph.lw, ph.lh);
    let p = ph.engine_params();
    let job = match ph.live_src() {
        photo::Src::Lin(lin) => background::Heavy::CamRawLin { lin, w, h, p },
        photo::Src::U8(src) => background::Heavy::Effect { name: "cameraraw".into(), src, w, h, p, post: None },
    };
    app.set_pm_busy(true);
    let t0 = now_ms();
    background::spawn(app, st, job, move |app, st, px| pm_rendered(app, st, gen, idx, w, h, px.unwrap_or_default(), now_ms() - t0));
}

#[allow(clippy::too_many_arguments)]
fn pm_rendered(app: &AppWindow, st: &mut State, gen: u64, idx: usize, w: usize, h: usize, px: Vec<u8>, ms: f64) {
    let pm = &mut st.photo;
    if gen == pm.gen {
        pm.running = false;
    }
    let same = pm.photos.get(pm.active).is_some_and(|p| idx == pm.active && p.lw == w && p.lh == h);
    if same && !pm.fx_off && px.len() == w * h * 4 {
        app.set_pm_image(to_image(&px, w, h));
        pm_histogram(app, &px);
        pm.last_live = (w, h, std::sync::Arc::new(px));
        let px = st.photo.last_live.2.clone();
        pm_masks::overlay(app, st, &px, w, h);
    }
    let pm = &mut st.photo;
    if std::mem::take(&mut pm.queued) || !same {
        pm_render(app, st);
    } else {
        app.set_pm_busy(false);
        if let Some(p) = st.photo.photos.get(st.photo.active) {
            app.set_pm_info(SharedString::from(i18n::tr_format!("{} — {} × {} px — aperçu {ms:.0} ms", p.name, p.w, p.h)));
        }
    }
}

fn p_angle(a: f32) -> f32 {
    a.clamp(-45.0, 45.0)
}

/// Histogramme RVB et alertes d'écrêtage de l'aperçu (toutes les présentations : une
/// interface ne change que la mise en page, jamais les fonctions).
fn pm_histogram(app: &AppWindow, px: &[u8]) {
    let (img, lo, hi) = photo::histogram(px);
    app.set_pm_hist(to_image(&img, 256, 96));
    app.set_pm_clip_lo(lo);
    app.set_pm_clip_hi(hi);
}

/// Rendu haute résolution de la zone visible, après `ms` sans changement de réglage ni de vue.
fn pm_schedule_hq(app: &AppWindow, ms: u64) {
    thread_local! {
        static DEBOUNCE: slint::Timer = slint::Timer::default();
    }
    let weak = app.as_weak();
    DEBOUNCE.with(|t| {
        t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(ms), move || {
            let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
            let Ok(mut st) = state.try_borrow_mut() else {
                return pm_schedule_hq(&app, 60);
            };
            pm_hq(&app, &mut st);
        })
    });
}

/// Zone visible (avec une marge) rendue à la résolution de l'écran, au plus `HQ_MAX`, depuis
/// l'aperçu 1600 px ou la pleine résolution ; posée par-dessus le rendu basse résolution.
/// Numéro du rendu haute résolution voulu (lu par le jeton d'annulation dans l'autre fil) et
/// rendu haute résolution en cours.
static PM_HQ_GEN: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
static PM_HQ_BUSY: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn pm_hq(app: &AppWindow, st: &mut State) {
    let pm = &st.photo;
    if pm.fx_off || !app.get_pm_open() {
        return;
    }
    // rendu en direct pas fini : la haute résolution est reprise un peu plus tard (avant, elle
    // n'était jamais relancée si le rendu en direct dépassait le délai)
    if pm.running {
        return pm_schedule_hq(app, 120);
    }
    let Some(p) = pm.photos.get(pm.active) else { return };
    let [vx0, vy0, vx1, vy1, disp] = pm.view;
    if disp <= 0.0 || vx1 <= vx0 || vy1 <= vy0 {
        return;
    }
    let pad = 0.03;
    let (vx0, vy0, vx1, vy1) = ((vx0 - pad).max(0.0), (vy0 - pad).max(0.0), (vx1 + pad).min(1.0), (vy1 + pad).min(1.0));
    let (x0, y0) = ((vx0 * p.w as f32) as usize, (vy0 * p.h as f32) as usize);
    let x1 = ((vx1 * p.w as f32).ceil() as usize).min(p.w).max(x0 + 1);
    let y1 = ((vy1 * p.h as f32).ceil() as usize).min(p.h).max(y0 + 1);
    let (rw, rh) = (x1 - x0, y1 - y0);
    // pixels d'écran que couvre la zone
    let screen = ((vx1 - vx0) * disp * app.window().scale_factor()).ceil().max(1.0) as usize;
    let mut tw = rw.min(screen);
    let mut th = ((rh as f32 * tw as f32 / rw as f32).round() as usize).max(1);
    if tw.max(th) > photo::HQ_MAX {
        let k = photo::HQ_MAX as f32 / tw.max(th) as f32;
        (tw, th) = (((tw as f32 * k) as usize).max(1), ((th as f32 * k) as usize).max(1));
    }
    // le rendu en direct est déjà assez fin pour cette zone : rien à faire
    if (tw as f32) <= (vx1 - vx0) * p.lw as f32 * 1.15 {
        return;
    }
    let rect = (x0 as f32 / p.w as f32, y0 as f32 / p.h as f32, x1 as f32 / p.w as f32, y1 as f32 / p.h as f32);
    let mut rj = p.region_job((x0, y0, x1, y1), tw, th);
    st.photo.hq_gen += 1;
    let gen = st.photo.hq_gen;
    PM_HQ_GEN.store(gen, std::sync::atomic::Ordering::Relaxed);
    rj.cancel = Some(std::sync::Arc::new(move || PM_HQ_GEN.load(std::sync::atomic::Ordering::Relaxed) != gen));
    let job = background::Heavy::PhotoRegion(rj);
    // une zone précédente encore en calcul (vue déplacée) : abandonnée
    if PM_HQ_BUSY.swap(true, std::sync::atomic::Ordering::Relaxed) {
        #[cfg(target_arch = "wasm32")]
        web::cancel_lane(2);
    }
    app.set_pm_busy(true);
    background::spawn(app, st, job, move |app, st, px| {
        if st.photo.hq_gen != gen || st.photo.fx_off {
            return;
        }
        PM_HQ_BUSY.store(false, std::sync::atomic::Ordering::Relaxed);
        app.set_pm_busy(st.photo.running);
        let Some(px) = px.filter(|v| v.len() == tw * th * 4) else { return };
        app.set_pm_hq_image(to_image(&px, tw, th));
        app.set_pm_hq_x0(rect.0);
        app.set_pm_hq_y0(rect.1);
        app.set_pm_hq_x1(rect.2);
        app.set_pm_hq_y1(rect.3);
        app.set_pm_hq_shown(true);
    });
}

/// Ajoute des photos lues (nom, octets) à la pellicule.
fn pm_add(app: &AppWindow, st: &mut State, files: Vec<(String, Vec<u8>)>) {
    start_load(app, st, LoadTo::Photos, files);
}

fn encode_jpeg(px: &[u8], w: usize, h: usize, quality: u8) -> Option<Vec<u8>> {
    let rgb: Vec<u8> = px.chunks_exact(4).flat_map(|p| [p[0], p[1], p[2]]).collect();
    let mut out = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut out, quality).encode(&rgb, w as u32, h as u32, image::ExtendedColorType::Rgb8).ok()?;
    Some(out)
}

/// Boutons du Mode Photo Pro.
fn pm_action(app: &AppWindow, state: &Shared, a: &str) {
    if a == "import" {
        let weak = app.as_weak();
        let state = state.clone();
        #[cfg(not(target_arch = "wasm32"))]
        let task = async move {
            let exts: Vec<&str> = ["jpg", "jpeg", "png", "webp", "bmp", "gif"].into_iter().chain(raw::EXTENSIONS.iter().copied()).collect();
            let Some(files) = rfd::AsyncFileDialog::new().add_filter(i18n::tr("Photos (dont RAW)"), &exts).pick_files().await else { return };
            let mut read = Vec::new();
            for f in files {
                read.push((f.file_name(), f.read().await));
            }
            let Some(app) = weak.upgrade() else { return };
            pm_add(&app, &mut state.borrow_mut(), read);
        };
        #[cfg(target_arch = "wasm32")]
        let task = async move {
            let Some(file) = web::pick_file(&format!("image/*,{}", raw_accept())).await else { return };
            let Some(app) = weak.upgrade() else { return };
            pm_add(&app, &mut state.borrow_mut(), vec![file]);
        };
        let _ = slint::spawn_local(task);
        return;
    }
    if a == "export" || a == "export-dialog" {
        return pm_export_dialog(app, &state.borrow(), 0);
    }
    if a == "crop" {
        app.set_pm_crop_mode(true);
        return;
    }
    if a == "settings" {
        app.set_show_settings(true);
        return;
    }
    if a == "undo" || a == "redo" {
        return pm_store::undo(app, &mut state.borrow_mut(), a == "undo");
    }
    // réduire : le mode se ferme, la pellicule reste (onglet « Photo Pro » pour le rouvrir)
    if a == "minimize" {
        pm_set_open(app, false);
        app.set_pm_count(state.borrow().photo.photos.len() as i32);
        return;
    }
    if a == "reopen" {
        return pm_open(app, &mut state.borrow_mut());
    }
    if a == "export:png16" {
        return pm_export_dialog(app, &state.borrow(), 1);
    }
    if a == "export:tiff16" {
        return pm_export_dialog(app, &state.borrow(), 2);
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;
    if a.starts_with("mask-") {
        pm_masks::action(app, st, a);
        return;
    }
    let active = st.photo.active;
    match a {
        "close" => {
            pm_set_open(app, false);
            app.set_pm_count(st.photo.photos.len() as i32);
            return;
        }
        "fx" => st.photo.fx_off = !st.photo.fx_off,
        "open-editor" => {
            let Some(p) = st.photo.photos.get(active) else { return };
            let t0 = now_ms();
            let (w, h, name) = (p.w, p.h, p.name.clone());
            let params = p.engine_params();
            let job = match p.full_src() {
                photo::Src::Lin(lin) => background::Heavy::CamRawLin { lin, w, h, p: params },
                photo::Src::U8(src) => background::Heavy::Effect { name: "cameraraw".into(), src, w, h, p: params, post: None },
            };
            // pleine résolution : hors du fil de l'interface, qui se figeait plusieurs secondes
            app.set_load_title(i18n::tr("Développement de la photo RAW").into());
            load_progress(app, 0.5, &name);
            app.set_loading(true);
            background::spawn(app, st, job, move |app, st, out| {
                app.set_loading(false);
                // calcul impossible en arrière-plan : refait ici
                let px = out.filter(|px| px.len() == w * h * 4).or_else(|| st.photo.photos.get(active).map(|p| p.render_full()));
                let Some(px) = px else { return };
                // recadrage et redressement du Photo Pro
                let (angle, crop) = st.photo.photos.get(active).map_or((0.0, (0.0, 0.0, 1.0, 1.0)), |p| (p.angle, p.crop));
                let (px, w, h) = photo::geometry(&px, w, h, angle, crop);
                let doc = Doc::from_pixels(w, h, px, &name);
                pm_set_open(app, false);
                set_document(app, st, doc);
                status(app, i18n::tr_format!("Photo ouverte dans l'éditeur ({:.0} ms)", now_ms() - t0));
            });
            return;
        }
        "apply-all" => {
            let Some((params, preset)) = st.photo.photos.get(active).map(|p| (p.params.clone(), p.preset)) else { return };
            let n = st.photo.photos.len();
            for p in &mut st.photo.photos {
                p.params = params.clone();
                p.preset = preset;
                p.modified = true;
            }
            status(app, i18n::tr_format!("Réglages appliqués aux {n} photos"));
        }
        // réglage automatique de chaque photo d'après sa propre scène
        "auto-all" => {
            let n = st.photo.photos.len();
            let mut kinds = std::collections::BTreeMap::new();
            for p in &mut st.photo.photos {
                let (kind, _) = pm_auto(p);
                *kinds.entry(i18n::tr(kind.label())).or_insert(0) += 1;
            }
            let detail: Vec<String> = kinds.iter().map(|(k, c)| format!("{c} {k}")).collect();
            status(app, i18n::tr_format!("Auto sur {n} photos ({})", detail.join(", ")));
        }
        _ => {
            let Some(p) = st.photo.photos.get_mut(active) else { return };
            match a {
                "reset" => {
                    p.params = photo::neutral();
                    p.preset = 0;
                    p.note.clear();
                }
                "rotate" => p.rotate90(),
                "crop-reset" => {
                    p.crop = (0.0, 0.0, 1.0, 1.0);
                    p.angle = 0.0;
                }
                "auto" => {
                    let (_, note) = pm_auto(p);
                    status(app, note);
                }
                // Auto d'une section : réglage automatique de toute la photo (comme le bouton
                // Auto), dont seuls les réglages de cette section sont repris ; les autres
                // retouches à la main restent
                s if s.starts_with("auto-section:") => {
                    let mut t = p.clone();
                    let (_, note) = pm_auto(&mut t);
                    t.params.resize(photo::NP, 0.0);
                    p.params.resize(photo::NP, 0.0);
                    for i in pm_section(s.trim_start_matches("auto-section:")) {
                        p.params[i] = t.params[i];
                    }
                    status(app, note);
                }
                s if s.starts_with("reset-section:") => {
                    let idx = pm_section(s.trim_start_matches("reset-section:"));
                    let n = photo::neutral();
                    p.params.resize(photo::NP, 0.0);
                    for i in idx {
                        p.params[i] = n[i];
                    }
                }
                _ => return,
            }
            p.modified = true;
        }
    }
    pm_sync(app, st);
    pm_render(app, st);
}

/// Réglages d'une section du panneau de Photo Pro (0 Lumière, 1 Couleur, 2 Présence, 3 Color
/// grading, 4 Mélangeur TSL).
fn pm_section(k: &str) -> Vec<usize> {
    match k {
        "0" => vec![0, 18, 5, 3, 6, 4],
        "1" => vec![1, 2, 20, 19],
        "2" => vec![16, 17, 22, 21, 23, 24, 58, 59],
        "3" => (7..=15).collect(),
        _ => (30..=53).collect(),
    }
}

/// Réglage automatique d'une photo d'après l'analyse de sa scène (`scene`) : seuls les réglages
/// concernés sont remplacés. Rend le type de scène et le compte rendu (aussi gardé dans `note`).
fn pm_auto(p: &mut photo::Photo) -> (scene::Kind, String) {
    let mut auto = match &p.lin {
        Some((_, prev)) => scene::analyze_lin(prev, p.pw, p.ph, p.raw_ev),
        None => scene::analyze_u8(&p.preview, p.pw, p.ph),
    };
    // boucle fermée : rendus du vrai moteur sur la photo réduite, mesurés et corrigés
    let s = scene::REFINE_MAX as f32 / p.lw.max(p.lh).max(1) as f32;
    let (tw, th) = if s < 1.0 { (((p.lw as f32 * s).round() as usize).max(1), ((p.lh as f32 * s).round() as usize).max(1)) } else { (p.lw, p.lh) };
    let src = match &p.lin_live {
        Some(l) => photo::Src::Lin(std::sync::Arc::new(photo::crop_resize::<f32, 3>(l, p.lw, (0, 0, p.lw, p.lh), tw, th))),
        None => photo::Src::U8(std::sync::Arc::new(photo::crop_resize::<u8, 4>(&p.live, p.lw, (0, 0, p.lw, p.lh), tw, th))),
    };
    let base = p.params.clone();
    scene::refine(&mut auto, &base, |q| photo::render_src(&src, tw, th, &p.engine_params_for(q)));
    for &i in &auto.keys {
        p.params[i] = auto.params[i];
    }
    p.modified = true;
    p.note = auto.note;
    (auto.kind, p.note.clone())
}

#[cfg(test)]
mod auto_look {
    /// Planche avant / après du réglage automatique sur de vraies photos :
    /// `MP_AUTO="a.jpg;b.dng" MP_OUT=planche.png cargo test --lib auto_look -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn auto_look() {
        let files = std::env::var("MP_AUTO").unwrap_or_default();
        let (cell_w, cell_h) = (360usize, 240usize);
        let list: Vec<&str> = files.split(';').filter(|f| !f.is_empty()).collect();
        let (sw, sh) = (cell_w * 2, cell_h * list.len().max(1));
        let mut sheet = vec![0u8; sw * sh * 4];
        for (row, f) in list.iter().enumerate() {
            let bytes = std::fs::read(f).expect(f);
            let name = std::path::Path::new(f).file_name().unwrap().to_string_lossy().to_string();
            let mut p = if crate::raw::is_raw(&name) {
                crate::photo::Photo::from_raw(&name, crate::raw::decode(&bytes).unwrap())
            } else {
                let i = image::load_from_memory(&bytes).unwrap().to_rgba8();
                crate::photo::Photo::new(&name, i.width() as usize, i.height() as usize, i.into_raw())
            };
            let before = crate::photo::render_src(&p.live_src(), p.lw, p.lh, &p.engine_params());
            let t = std::time::Instant::now();
            let (_, note) = super::pm_auto(&mut p);
            let ms = t.elapsed().as_millis();
            let after = crate::photo::render_src(&p.live_src(), p.lw, p.lh, &p.engine_params());
            let keys = [0usize, 1, 2, 3, 4, 5, 6, 16, 17, 18, 19, 20];
            println!("{name} ({ms} ms) : {note}\n    {:?}", keys.iter().map(|&k| (k, p.params[k])).filter(|(_, v)| *v != 0.0).collect::<Vec<_>>());
            for (col, img) in [before, after].iter().enumerate() {
                let s = (cell_w as f32 / p.lw as f32).min(cell_h as f32 / p.lh as f32);
                let (tw, th) = ((p.lw as f32 * s) as usize, (p.lh as f32 * s) as usize);
                let small = crate::photo::crop_resize::<u8, 4>(img, p.lw, (0, 0, p.lw, p.lh), tw, th);
                for y in 0..th {
                    let o = ((row * cell_h + y) * sw + col * cell_w) * 4;
                    sheet[o..o + tw * 4].copy_from_slice(&small[y * tw * 4..(y + 1) * tw * 4]);
                }
            }
        }
        let out = std::env::var("MP_OUT").unwrap_or("auto.png".into());
        image::save_buffer(&out, &sheet, sw as u32, sh as u32, image::ExtendedColorType::Rgba8).unwrap();
    }
}

/// Exporte toutes les photos en JPEG (pleine résolution). Bureau : dans un dossier choisi ;
/// web : un téléchargement par photo.
/// Photo exportée : (nom, octets, type MIME) — JPEG 8 bits (0), PNG 16 bits (1), TIFF 16 bits
/// (2) ; recadrage et redressement appliqués.
/// Taille de sortie : plus grand côté `max` (0 : taille d'origine, jamais agrandie).
fn pm_fit(w: usize, h: usize, max: usize) -> (usize, usize) {
    if max == 0 || w.max(h) <= max {
        return (w, h);
    }
    let k = max as f32 / w.max(h) as f32;
    (((w as f32 * k).round() as usize).max(1), ((h as f32 * k).round() as usize).max(1))
}

/// Plus grand côté choisi dans la fenêtre d'exportation (0 : taille d'origine).
fn pm_export_edge(i: i32) -> usize {
    [0, 4000, 3000, 2048, 1080].get(i.max(0) as usize).copied().unwrap_or(0)
}

fn pm_encode(p: &photo::Photo, fmt: u8, quality: u8, max: usize) -> Option<(String, Vec<u8>, &'static str)> {
    let stem = p.stem();
    if fmt == 0 {
        let (px, w, h) = photo::geometry(&p.render_full(), p.w, p.h, p.angle, p.crop);
        let (tw, th) = pm_fit(w, h, max);
        let (px, w, h) = if (tw, th) == (w, h) {
            (px, w, h)
        } else {
            let img = image::RgbaImage::from_raw(w as u32, h as u32, px)?;
            (image::imageops::resize(&img, tw as u32, th as u32, image::imageops::FilterType::Lanczos3).into_raw(), tw, th)
        };
        return encode_jpeg(&px, w, h, quality.clamp(50, 100)).map(|b| (format!("{stem}-photo-pro.jpg"), b, "image/jpeg"));
    }
    let (px, w, h) = photo::geometry(&p.render_full16(), p.w, p.h, p.angle, p.crop);
    let mut img = image::ImageBuffer::<image::Rgba<u16>, Vec<u16>>::from_raw(w as u32, h as u32, px)?;
    let (tw, th) = pm_fit(w, h, max);
    if (tw, th) != (w, h) {
        img = image::imageops::resize(&img, tw as u32, th as u32, image::imageops::FilterType::Lanczos3);
    }
    // photo opaque : RVB 16 bits (un tiers plus léger que RVBA)
    let rgb = image::DynamicImage::ImageRgba16(img).to_rgb16();
    let mut out = std::io::Cursor::new(Vec::new());
    let (format, ext, mime) = if fmt == 1 { (image::ImageFormat::Png, "png", "image/png") } else { (image::ImageFormat::Tiff, "tif", "image/tiff") };
    image::DynamicImage::ImageRgb16(rgb).write_to(&mut out, format).ok()?;
    Some((format!("{stem}-photo-pro-16bits.{ext}"), out.into_inner(), mime))
}

/// Fenêtre d'exportation de Photo Pro : ouverte sur le format `fmt`.
fn pm_export_dialog(app: &AppWindow, st: &State, fmt: i32) {
    if st.photo.photos.is_empty() {
        return status(app, "Aucune photo à exporter");
    }
    app.set_pm_exp_fmt(fmt);
    app.set_show_pm_export(true);
    pm_export_info(app, st);
}

/// Dimensions et nombre de photos exportées, sous les choix de la fenêtre.
fn pm_export_info(app: &AppWindow, st: &State) {
    let Some(p) = st.photo.photos.get(st.photo.active) else { return };
    // recadrage compris (fractions du cadre)
    let (cw, ch) = (((p.crop.2 - p.crop.0) * p.w as f32).round().max(1.0) as usize, ((p.crop.3 - p.crop.1) * p.h as f32).round().max(1.0) as usize);
    let (tw, th) = pm_fit(cw, ch, pm_export_edge(app.get_pm_exp_size()));
    let n = if app.get_pm_exp_all() { st.photo.photos.len() } else { 1 };
    app.set_pm_exp_info(i18n::tr_format!("{n} photo(s) — celle-ci : {tw} × {th} px (recadrage compris)").into());
}

fn pm_export(app: &AppWindow, state: &Shared, fmt: u8) {
    if state.borrow().photo.photos.is_empty() {
        status(app, "Aucune photo à exporter");
        return;
    }
    let (quality, max, all) = (app.get_pm_exp_quality().round() as u8, pm_export_edge(app.get_pm_exp_size()), app.get_pm_exp_all());
    // copies légères (images partagées) : l'export tourne hors du fil de l'interface
    let photos: Vec<photo::Photo> = {
        let st = state.borrow();
        if all { st.photo.photos.clone() } else { st.photo.photos.get(st.photo.active).cloned().into_iter().collect() }
    };
    for p in &mut state.borrow_mut().photo.photos {
        p.modified = false;
    }
    pm_sync(app, &state.borrow());
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    {
        let Some(dir) = rfd::FileDialog::new().set_title(i18n::tr("Dossier d'exportation des photos")).pick_folder() else { return };
        app.set_pm_busy(true);
        status(app, i18n::tr_format!("Export de {} photo(s)…", photos.len()));
        let weak = app.as_weak();
        std::thread::spawn(move || {
            let mut done = 0;
            for p in &photos {
                if let Some((name, bytes, _)) = pm_encode(p, fmt, quality, max) {
                    if std::fs::write(dir.join(name), bytes).is_ok() {
                        done += 1;
                    }
                }
            }
            let msg = i18n::tr_format!("{done} photo(s) exportée(s) dans {}", dir.display());
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(app) = weak.upgrade() {
                    app.set_pm_busy(false);
                    status(&app, msg.clone());
                    app.set_pm_info(SharedString::from(msg));
                }
            });
        });
    }
    #[cfg(target_arch = "wasm32")]
    {
        for p in &photos {
            if let Some((name, bytes, mime)) = pm_encode(p, fmt, quality, max) {
                web::download_bytes(&bytes, &name, mime);
            }
        }
        status(app, i18n::tr_format!("{} photo(s) exportée(s)", photos.len()));
    }
    #[cfg(target_os = "android")]
    {
        for p in &photos {
            if let Some((name, bytes, mime)) = pm_encode(p, fmt, quality, max) {
                android_io::save(&name, mime, bytes, |_| {});
            }
        }
    }
}

/// Panneau de menu du mode téléphone (barre du bas) : entrées d'Ajustements, ou des sous-menus
/// d'Effets regroupés par section (comme js/app/illu-mobile-shell.js, buildMenuSheet).
fn phone_sheet_rows(app: &AppWindow, which: &str) -> Vec<SheetRow> {
    let menus = app.get_menus();
    let find = |title: &str| (0..menus.row_count()).filter_map(|i| menus.row_data(i)).find(|m| m.title.as_str() == i18n::tr(title));
    let mut rows = Vec::new();
    let entry = |label: &SharedString, fa: &SharedString, w: i32, action: &SharedString, badge: &SharedString| SheetRow {
        section: false,
        label: label.clone(),
        fa: fa.clone(),
        fa_weight: w,
        action: action.clone(),
        badge: badge.clone(),
    };
    let Some(m) = find(if which == "adjust" { "Ajustements" } else { "Effets" }) else { return rows };
    let items: Vec<MenuItemSpec> = (0..m.items.row_count()).filter_map(|i| m.items.row_data(i)).collect();
    if which == "adjust" {
        for it in items.iter().filter(|it| !it.separator && !it.submenu) {
            rows.push(entry(&it.label, &it.fa, it.fa_weight, &it.action, &it.badge));
        }
        return rows;
    }
    let sections: &[&str] = if which == "deform" { &["Artistique", "Bruit", "Déformer", "Détourage"] } else { &["Couleur", "Flous", "Objet", "Photo", "Rendu", "Styliser"] };
    for name in sections {
        let Some(it) = items.iter().find(|it| it.submenu && it.label.as_str() == i18n::tr(name)) else { continue };
        rows.push(SheetRow { section: true, label: i18n::tr(name).to_uppercase().into(), ..Default::default() });
        for c in (0..it.children.row_count()).filter_map(|k| it.children.row_data(k)) {
            rows.push(entry(&c.label, &c.fa, c.fa_weight, &c.action, &c.badge));
        }
    }
    rows
}

/// Fichier › Espace de couleur : tous les calques passent dans le nouvel espace (une étape
/// d'historique, annulable).
fn set_color_mode(app: &AppWindow, st: &mut State, mode: ColorMode) {
    finish_edits(app, st);
    if st.doc.mode == mode {
        status(app, i18n::tr_format!("Le projet est déjà en mode {}", mode.status()));
        return;
    }
    let t0 = now_ms();
    st.doc.set_color_mode(mode);
    st.doc.commit(mode.history_label());
    refresh_all(app, st);
    status(app, i18n::tr_format!("{} : {:.0} ms", i18n::tr(mode.history_label()), now_ms() - t0));
}

fn prompt(app: &AppWindow, kind: &str, title: &str, label: &str, value: &str) {
    app.set_prompt_kind(kind.into());
    app.set_prompt_title(i18n::tr(title).into());
    app.set_prompt_label(i18n::tr(label).into());
    app.set_prompt_value(value.into());
    app.set_show_prompt(true);
}

/// Envoie le formulaire « Signaler un bug » (même serveur et même format que js/contact.js).
fn send_contact(app: &AppWindow, kind: &str, message: &str, contact: &str) {
    let payload = serde_json::json!({
        "appTitle": "MasterPaint (Rust)",
        "type": kind,
        "message": message,
        "contact": contact,
        "deviceId": "rust",
        "timestamp": now_epoch_ms(),
        "userAgent": i18n::tr_format!("MasterPaint-Rust/{APP_VERSION} ({})", std::env::consts::OS),
    })
    .to_string();
    const URL: &str = "https://polocrafting.fr/contact_save.php";
    app.set_contact_status(i18n::tr("Envoi…").into());
    let weak = app.as_weak();
    #[cfg(not(target_arch = "wasm32"))]
    {
        // envoi hors du fil de l'interface
        std::thread::spawn(move || {
            let ok = ureq::post(URL)
                .set("Content-Type", "text/plain;charset=UTF-8")
                .send_string(&payload)
                .ok()
                .and_then(|r| r.into_string().ok())
                .and_then(|b| serde_json::from_str::<serde_json::Value>(&b).ok())
                .and_then(|v| v.get("success").and_then(|s| s.as_bool()))
                .unwrap_or(false);
            let _ = slint::invoke_from_event_loop(move || contact_done(&weak, ok));
        });
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = slint::spawn_local(async move {
            let ok = web::post_text(URL, &payload).await.and_then(|b| serde_json::from_str::<serde_json::Value>(&b).ok()).and_then(|v| v.get("success").and_then(|s| s.as_bool())).unwrap_or(false);
            contact_done(&weak, ok);
        });
    }
}

fn contact_done(weak: &slint::Weak<AppWindow>, ok: bool) {
    let Some(app) = weak.upgrade() else { return };
    if ok {
        app.set_show_contact(false);
        app.set_contact_status(SharedString::default());
        status(&app, "Message envoyé, merci !");
    } else {
        app.set_contact_status(i18n::tr("Échec de l'envoi (réseau ?)").into());
    }
}

fn now_epoch_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        js_sys::Date::now()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as f64).unwrap_or(0.0)
    }
}

/// Enregistre les paramètres de l'interface.
/// Réglages des outils et de l'affichage à retrouver au prochain lancement (enregistrés avec
/// les Paramètres : à chaque changement d'outil, à la fermeture, quand l'onglet web est masqué).
fn tool_state(app: &AppWindow) -> serde_json::Value {
    let t = app.global::<ToolOpts>();
    let fonts = app.global::<FontList>().get_names();
    serde_json::json!({
        "tool": app.get_current_tool().as_str(),
        "brushSize": t.get_brush_size(),
        "hardness": t.get_hardness(),
        "brushShape": t.get_brush_shape(),
        "tolerance": t.get_tolerance(),
        "contiguous": t.get_contiguous(),
        "selMode": t.get_sel_mode(),
        "shapeStyle": t.get_shape_style(),
        "shapeFillType": t.get_shape_fill_type(),
        "shapeGradType": t.get_shape_grad_type(),
        "shapeGradAngle": t.get_shape_grad_angle(),
        "shapeGradSmart": t.get_shape_grad_smart(),
        "lineWidth": t.get_line_width(),
        "gradientKind": t.get_gradient_kind(),
        "shapeKind": t.get_shape_kind().as_str(),
        "cornerRadius": t.get_corner_radius(),
        "shapeSides": t.get_shape_sides(),
        "starPoints": t.get_star_points(),
        "lineMode": t.get_line_mode(),
        "capStart": t.get_cap_start(),
        "capEnd": t.get_cap_end(),
        "lineDash": t.get_line_dash(),
        "symX": t.get_sym_x(),
        "symY": t.get_sym_y(),
        "pixelGrid": t.get_pixel_grid(),
        "rulers": t.get_rulers(),
        "outsideCanvas": t.get_outside_canvas(),
        "snap": t.get_snap(),
        "font": fonts.row_data(t.get_font_index().max(0) as usize).map(|n| n.to_string()).unwrap_or_default(),
        "fontSize": t.get_font_size(),
        "textAlign": t.get_text_align(),
        "antialias": t.get_antialias(),
        "retouchMode": t.get_retouch_mode(),
        "retouchStrength": t.get_retouch_strength(),
        "smoothing": t.get_smoothing(),
        "sampleAll": t.get_sample_all(),
        "nearest": t.get_nearest(),
        "panels": [app.get_show_tools(), app.get_show_colors(), app.get_show_history(), app.get_show_layers()],
        "groupPick": t.get_group_pick().iter().collect::<Vec<i32>>(),
    })
}

/// Remet les réglages retenus par `tool_state` ; renvoie le dernier outil utilisé.
fn restore_tool_state(app: &AppWindow, v: &serde_json::Value) -> Option<String> {
    let t = app.global::<ToolOpts>();
    let f = |k: &str| v.get(k).and_then(|x| x.as_f64()).map(|x| x as f32);
    let i = |k: &str| v.get(k).and_then(|x| x.as_i64()).map(|x| x as i32);
    let b = |k: &str| v.get(k).and_then(|x| x.as_bool());
    if let Some(x) = f("brushSize") { t.set_brush_size(x.max(1.0)); }
    if let Some(x) = f("hardness") { t.set_hardness(x.clamp(0.0, 100.0)); }
    if let Some(x) = i("brushShape") { t.set_brush_shape(x.clamp(0, 3)); }
    if let Some(x) = f("tolerance") { t.set_tolerance(x.max(0.0)); }
    if let Some(x) = b("contiguous") { t.set_contiguous(x); }
    if let Some(x) = i("selMode") { t.set_sel_mode(x.clamp(0, 4)); }
    if let Some(x) = i("retouchMode") { t.set_retouch_mode(x.clamp(0, 3)); }
    // outil retenu dans chaque groupe de la fenêtre Outils
    if let Some(a) = v.get("groupPick").and_then(|x| x.as_array()) {
        let mut pick: Vec<i32> = t.get_group_pick().iter().collect();
        for (k, x) in a.iter().enumerate().take(pick.len()) {
            pick[k] = x.as_i64().map_or(-1, |x| x as i32);
        }
        t.set_group_pick(ModelRc::new(VecModel::from(pick)));
    }
    if let Some(x) = f("retouchStrength") { t.set_retouch_strength(x.clamp(1.0, 100.0)); }
    if let Some(x) = f("smoothing") { t.set_smoothing(x.clamp(0.0, 100.0)); }
    if let Some(x) = b("sampleAll") { t.set_sample_all(x); }
    if let Some(x) = b("nearest") { t.set_nearest(x); }
    if let Some(x) = i("shapeStyle") { t.set_shape_style(x.clamp(0, 2)); }
    if let Some(x) = i("shapeFillType") { t.set_shape_fill_type(x.clamp(0, 1)); }
    if let Some(x) = i("shapeGradType") { t.set_shape_grad_type(x.clamp(0, 1)); }
    if let Some(x) = f("shapeGradAngle") { t.set_shape_grad_angle(x.clamp(0.0, 360.0)); }
    if let Some(x) = v.get("shapeGradSmart").and_then(|x| x.as_bool()) { t.set_shape_grad_smart(x); }
    if let Some(x) = f("lineWidth") { t.set_line_width(x.max(1.0)); }
    if let Some(x) = i("gradientKind") { t.set_gradient_kind(x.clamp(0, 3)); }
    if let Some(x) = v.get("shapeKind").and_then(|x| x.as_str()) { t.set_shape_kind(x.into()); }
    if let Some(x) = f("cornerRadius") { t.set_corner_radius(x.max(0.0)); }
    if let Some(x) = f("shapeSides") { t.set_shape_sides(x.clamp(3.0, 12.0)); }
    if let Some(x) = f("starPoints") { t.set_star_points(x.clamp(3.0, 12.0)); }
    if let Some(x) = i("lineMode") { t.set_line_mode(x.clamp(0, 1)); }
    if let Some(x) = i("capStart") { t.set_cap_start(x.clamp(0, 4)); }
    if let Some(x) = i("capEnd") { t.set_cap_end(x.clamp(0, 4)); }
    if let Some(x) = i("lineDash") { t.set_line_dash(x.clamp(0, 2)); }
    if let Some(x) = b("symX") { t.set_sym_x(x); }
    if let Some(x) = b("symY") { t.set_sym_y(x); }
    if let Some(x) = b("pixelGrid") { t.set_pixel_grid(x); }
    if let Some(x) = b("rulers") { t.set_rulers(x); }
    if let Some(x) = b("outsideCanvas") { t.set_outside_canvas(x); }
    if let Some(x) = b("snap") { t.set_snap(x); }
    if let Some(name) = v.get("font").and_then(|x| x.as_str()).filter(|n| !n.is_empty()) {
        let fonts = app.global::<FontList>().get_names();
        if let Some(k) = fonts.iter().position(|n| n.as_str() == name) {
            t.set_font_index(k as i32);
        }
    }
    if let Some(x) = f("fontSize") { t.set_font_size(x.max(1.0)); }
    if let Some(x) = i("textAlign") { t.set_text_align(x.clamp(0, 2)); }
    if let Some(x) = b("antialias") { t.set_antialias(x); }
    if let Some(p) = v.get("panels").and_then(|p| p.as_array()).filter(|p| p.len() == 4) {
        let on = |k: usize| p[k].as_bool().unwrap_or(true);
        app.set_show_tools(on(0));
        app.set_show_colors(on(1));
        app.set_show_history(on(2));
        app.set_show_layers(on(3));
    }
    v.get("tool").and_then(|x| x.as_str()).filter(|x| !x.is_empty()).map(|x| x.to_string())
}

fn save_settings(app: &AppWindow) {
    if DATA_PURGED.load(std::sync::atomic::Ordering::Relaxed) { return; }
    let t = app.global::<Theme>();
    let a = t.get_accent_base();
    let hm = app.get_set_history_max().round().clamp(3.0, 200.0) as usize;
    let hk = app.get_set_history_keep().round().clamp(1.0, 20.0) as usize;
    editor::HISTORY_MAX.store(hm, std::sync::atomic::Ordering::Relaxed);
    editor::HISTORY_KEEP.store(hk, std::sync::atomic::Ordering::Relaxed);
    settings::Settings {
        accent: (a.red() as u32) << 16 | (a.green() as u32) << 8 | a.blue() as u32,
        dark: saved_dark(app),
        checker_light: appearance::color_value(app, 0),
        checker_dark: appearance::color_value(app, 1),
        checker_size: app.get_checker_size().round().clamp(2.0, 32.0) as u32,
        workspace_color: app.get_workspace_custom().then(|| appearance::color_value(app, 2)),
        default_primary: appearance::color_value(app, 3),
        default_secondary: appearance::color_value(app, 4),
        toolbar_mode: app.get_toolbar_mode(),
        wheel_scroll: app.get_set_wheel_mode() == 1,
        history_max: hm,
        history_keep: hk,
        autosave_min: app.get_set_autosave_min().round() as u32,
        language: app.get_set_language(),
        layout: app.get_set_layout(),
        layout_auto: app.get_set_layout_auto(),
        theme_style: app.get_set_theme_style(),
        interface_theme: app.get_set_interface_theme(),
        follow_interface_style: app.get_set_follow_interface_style(),
        icon_pack: app.get_set_icon_pack(),
        missing_icon_fallback: app.get_set_missing_icon_fallback(),
        custom_icon_pack: icon_packs::custom(),
        imported_icon_packs: icon_packs::all_custom(),
        active_custom_icon: icon_packs::active_custom_index(),
        ui_zoom: app.get_set_ui_zoom(),
        default_zoom: app.get_set_default_zoom(),
        default_tool: tool_id_at(app, app.get_set_default_tool()),
        autosave: app.get_set_autosave(),
        use_gpu: app.get_set_use_gpu(),
        paste_mode: app.get_set_paste_mode(),
        paste_ask: app.get_set_paste_ask(),
        rounded: app.get_set_rounded(),
        pronounced_borders: app.get_set_pronounced_borders(),
        glass: app.get_set_glass(),
        title_transparent: app.get_set_title_transparent(),
        header_preview: app.get_set_header_preview(),
        shadows: app.get_set_shadows(),
        perf_mode: app.get_set_perf_mode(),
        hover_fx: app.get_set_hover_fx(),
        render_scale: app.get_set_render_scale(),
        render_ctl: app.get_set_render_ctl(),
        render_default: app.get_set_render_default(),
        perf_done: app.get_set_perf_done(),
        perf_cut: app.get_set_perf_cut(),
        perf_reported: app.get_set_perf_reported(),
        zoom_smooth: app.get_set_zoom_smooth(),
        snap_div: app.get_set_snap_div().round().clamp(4.0, 128.0) as u32,
        snap_thresh: app.get_set_snap_thresh().round().clamp(1.0, 100.0) as u32,
        snap_always: app.get_set_snap_always(),
        snap_guides: app.get_set_snap_guides(),
        fav_colors: {
            let f = app.get_fav_colors();
            (0..f.row_count()).filter_map(|i| f.row_data(i)).map(|c| c.as_argb_encoded()).take(24).collect()
        },
        recent_colors: {
            let f = app.get_recent_colors();
            (0..f.row_count()).filter_map(|i| f.row_data(i)).map(|c| c.as_argb_encoded()).take(8).collect()
        },
        color_square: app.get_colors_grid(),
        text_layer: app.global::<ToolOpts>().get_text_layer(),
        shape_layer: app.global::<ToolOpts>().get_shape_layer(),
        magnet_strength: app.global::<ToolOpts>().get_magnet_strength(),
        magnet_freq: app.global::<ToolOpts>().get_magnet_freq(),
        palettes: [
            ("tools", app.get_geom_tools()),
            ("history", app.get_geom_history()),
            ("colors", app.get_geom_colors()),
            ("layers", app.get_geom_layers()),
        ]
        .into_iter()
        .filter(|(_, g)| g.set)
        .map(|(k, g)| (k.to_string(), [g.x, g.y, g.w, g.h]))
        .collect(),
        ps_dock: [
            app.get_ps_pos_colors() as f32,
            app.get_ps_pos_history() as f32,
            app.get_ps_pos_layers() as f32,
            app.get_ps_h_colors(),
            app.get_ps_h_history(),
        ],
        welcome_count: app.get_welcome_count().max(0) as u32,
        welcome_hide: app.get_welcome_hide(),
        tool_state: tool_state(app),
    }
    .save();
    // sauvegarde coupée : la copie existante disparaît (rien ne doit revenir au prochain démarrage) ;
    // rétablie : une nouvelle copie dès le prochain passage
    let on = app.get_set_autosave();
    let was = AUTOSAVE_ON.swap(on, std::sync::atomic::Ordering::Relaxed);
    if was && !on {
        clear_autosave();
    } else if on && !was {
        AUTOSAVE_FORCE.store(true, std::sync::atomic::Ordering::Relaxed);
    }
    GPU_ALLOWED.store(app.get_set_use_gpu(), std::sync::atomic::Ordering::Relaxed);
}

/// Fenêtre de bienvenue au démarrage (comme la version HTML) : les deux premières ouvertures,
/// sauf « Ne plus afficher », hors captures / démonstrations et hors Photo Mode Pro. Appelée
/// une fois les projets restaurés (écran de chargement retiré sur le web).
fn welcome_at_start(app: &AppWindow) {
    // pellicule du Photo Pro de la dernière séance (une fois, après les projets)
    static PM_RESTORE: std::sync::Once = std::sync::Once::new();
    PM_RESTORE.call_once(|| {
        if let Some(state) = APP_STATE.with(|s| s.borrow().clone()) {
            pm_store::start_restore(app, &state);
        }
    });
    if SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) || app.get_welcome_hide() || app.get_welcome_count() >= 2 || app.get_pm_open() {
        return;
    }
    app.set_welcome_count(app.get_welcome_count() + 1);
    app.set_show_welcome(true);
    save_settings(app);
}

/// Sauvegarde automatique et carte graphique autorisées (Paramètres).
static AUTOSAVE_ON: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);
static GPU_ALLOWED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(true);
/// Après effacement complet, aucune fermeture ou tâche d'arrière-plan ne doit recréer les données.
static DATA_PURGED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Identifiant de l'outil n° `i` de la fenêtre Outils (Paramètres › outil au démarrage).
fn tool_id_at(app: &AppWindow, i: i32) -> String {
    let tools = app.global::<Generated>().get_tools();
    tools.row_data(i.max(0) as usize).map(|t| t.2.to_string()).unwrap_or_else(|| "tool-select".into())
}

thread_local! {
    /// échelle de l'écran (sans le zoom de l'interface)
    static BASE_SCALE: std::cell::Cell<f32> = const { std::cell::Cell::new(0.0) };
}

thread_local! {
    /// zoom de l'interface (Paramètres) : 1 = 100 %
    static UI_ZOOM: std::cell::Cell<f32> = const { std::cell::Cell::new(1.0) };
}

/// Bureau : avec un zoom de l'interface, la taille logique de la fenêtre doit être sa taille
/// réelle divisée par l'échelle zoomée. Le système la recalcule avec l'échelle réelle à chaque
/// redimensionnement (agrandir, bord de fenêtre) : l'interface était alors posée pour une
/// fenêtre plus grande que l'écran (toile décentrée, marges trop larges). Corrigé ici à chaque
/// changement de taille (rappel `ui-resized`). Dans le navigateur, les redimensionnements de la
/// page passent déjà par l'échelle zoomée ; apply_ui_zoom pose la taille au changement de zoom.
fn fit_ui_zoom_size(app: &AppWindow) {
    #[cfg(not(target_arch = "wasm32"))]
    {
        let sf = app.window().scale_factor();
        let phys = app.window().size();
        if phys.width == 0 || phys.height == 0 {
            return;
        }
        let want = slint::LogicalSize::new(phys.width as f32 / sf, phys.height as f32 / sf);
        let cur = (app.get_win_w(), app.get_win_h());
        if (cur.0 - want.width).abs() > 0.5 || (cur.1 - want.height).abs() > 0.5 {
            app.window().dispatch_event(slint::platform::WindowEvent::Resized { size: want });
        }
    }
    #[cfg(target_arch = "wasm32")]
    let _ = app;
}

/// Zoom de l'interface : facteur d'échelle de la fenêtre = échelle de l'écran × zoom.
fn apply_ui_zoom(app: &AppWindow, pct: f32) {
    let base = BASE_SCALE.with(|b| {
        if b.get() <= 0.0 {
            b.set(app.window().scale_factor());
        }
        b.get()
    });
    let z = (pct / 100.0).clamp(0.6, 2.0);
    UI_ZOOM.with(|u| u.set(z));
    app.window().dispatch_event(slint::platform::WindowEvent::ScaleFactorChanged { scale_factor: base * z });
    fit_ui_zoom_size(app);
    // navigateur : la zone de dessin de la page garde la taille de la fenêtre ; seule la taille
    // de mise en page de Slint devient (fenêtre ÷ zoom). Avant : set_size redimensionnait le
    // <canvas> lui-même (vide à droite et en bas au-dessus de 100 %, débordement en dessous).
    #[cfg(target_arch = "wasm32")]
    {
        let (w, h) = web::viewport();
        app.window().dispatch_event(slint::platform::WindowEvent::Resized { size: slint::LogicalSize::new(w / z, h / z) });
    }
    app.invoke_zoom_fit();
}

fn toggle_opt(app: &AppWindow, which: &str) {
    let t = app.global::<ToolOpts>();
    match which {
        "pixel-grid" => t.set_pixel_grid(!t.get_pixel_grid()),
        "rulers" => t.set_rulers(!t.get_rulers()),
        "snap" => t.set_snap(!t.get_snap()),
        _ => t.set_outside_canvas(!t.get_outside_canvas()),
    }
}

/// Langues de l'interface (même ordre que la liste des Paramètres) : dossiers de lang/.
const LANGUAGES: [&str; 6] = ["fr", "en", "es", "de", "it", "pt"];

/// Applique la langue `i` (traductions embarquées de lang/*.po ; texte manquant : français).
fn apply_language(i: i32) {
    let code = LANGUAGES.get(i.max(0) as usize).copied().unwrap_or("fr");
    i18n::set_language(code);
    #[cfg(target_arch = "wasm32")]
    web::set_language(code);
    if let Err(e) = slint::select_bundled_translation(code) {
        applog::log(i18n::tr_format!("Langue « {code} » indisponible : {e}"));
    }
}

/// « Hors toile » : activer ; désactiver supprime le contenu du dehors, après confirmation s'il
/// y en a (comme la version web).
fn toggle_outside(app: &AppWindow, st: &mut State) {
    let t = app.global::<ToolOpts>();
    if !t.get_outside_canvas() || !st.doc.has_outside() {
        t.set_outside_canvas(!t.get_outside_canvas());
        refresh_all(app, st);
        return;
    }
    st.task = Some(Task::DropOutside);
    show_task(
        app,
        "Hors toile",
        "Désactiver « Hors toile » supprime le contenu dessiné en dehors de la toile. Que voulez-vous faire ?",
        "",
        "",
        &[
            ("Supprimer le contenu hors toile", "Rogne tout ce qui dépasse de l'image, puis désactive l'option."),
            ("Agrandir la toile", "Agrandit l'image pour tout garder, puis désactive l'option."),
            ("Annuler", "Garde « Hors toile » activé."),
        ],
        Vec::new(),
    );
}

fn handle_ribbon(app: &AppWindow, state: &Shared, id: &str) {
    if id == "magnet-opts" {
        // force / ancres du lasso magnétique : lus à chaque mouvement (opts), seulement retenus
        save_settings(app);
        return;
    }
    if id == "text-layer" {
        save_settings(app);
        let on = app.global::<ToolOpts>().get_text_layer();
        status(app, if on { "Calque texte : chaque texte aura son calque, modifiable ensuite" } else { "Texte peint directement dans le calque actif" });
        return;
    }
    if id == "shape-layer" {
        save_settings(app);
        let on = app.global::<ToolOpts>().get_shape_layer();
        status(app, if on { "Calque SVG : les formes restent des objets modifiables" } else { "Formes tracées en pixels dans le calque actif" });
        return;
    }
    if id == "text-opts" {
        let missing = render_text(app, &mut state.borrow_mut());
        if let Some(fi) = missing {
            ensure_font(app, state, fi);
        }
        return;
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;
    drop_floating(app, st);
    let commit = |app: &AppWindow, st: &mut State, label: &str| {
        st.doc.commit(label);
        refresh_all(app, st);
    };
    let t = app.global::<ToolOpts>();
    match id {
        "render-cycle" => render_cycle(app, st),
        "render-now" => render_now(app, st),
        "opt-invert-selection" => {
            st.doc.invert_selection();
            sel_changed(app, st);
        }
        "opt-select-all" => {
            st.doc.select_all();
            sel_changed(app, st);
        }
        "opt-sel-copy-ribbon" => {
            copy(app, st);
        }
        "opt-sel-paste-ribbon" => paste(app, st),
        "opt-sel-clear-ribbon" => {
            st.doc.erase_selection();
            commit(app, st, "Effacer la sélection");
        }
        "opt-sel-align-left" | "opt-sel-center-h" | "opt-sel-align-right" | "opt-sel-align-top" | "opt-sel-center-v" | "opt-sel-align-bottom" | "opt-sel-center-both" => {
            let (h, v) = match id {
                "opt-sel-align-left" => (Some(-1), None),
                "opt-sel-center-h" => (Some(0), None),
                "opt-sel-align-right" => (Some(1), None),
                "opt-sel-align-top" => (None, Some(-1)),
                "opt-sel-center-v" => (None, Some(0)),
                "opt-sel-align-bottom" => (None, Some(1)),
                _ => (Some(0), Some(0)),
            };
            st.doc.align_selection(h, v);
            commit(app, st, "Aligner la sélection");
        }
        "opt-sel-pixelgrid" => toggle_opt(app, "pixel-grid"),
        "opt-sel-rulers" => toggle_opt(app, "rulers"),
        "ribbon-snap-toggle" => toggle_opt(app, "snap"),
        "rot-cw" | "rot-ccw" | "rot-180" | "flip-h" | "flip-v" if app.get_rotate_layer() => {
            // portée « Calque actif » : retournements et demi-tour du seul calque
            match id {
                "rot-180" => st.doc.flip_layer(true, true),
                "flip-h" => st.doc.flip_layer(true, false),
                "flip-v" => st.doc.flip_layer(false, true),
                _ => {
                    status(app, "Rotation à 90° : image entière seulement (les calques ont la taille de la toile)");
                    return;
                }
            }
            commit(app, st, "Rotation / retournement du calque");
        }
        "rot-cw" | "rot-ccw" | "rot-180" | "flip-h" | "flip-v" => {
            // mode animation : chaque dessin de la frise tourne aussi
            match id {
                "rot-cw" => anim_map_cels(&mut st.doc, |d| d.rotate90(true)),
                "rot-ccw" => anim_map_cels(&mut st.doc, |d| d.rotate90(false)),
                "rot-180" => anim_map_cels(&mut st.doc, |d| d.rotate180()),
                "flip-h" => anim_map_cels(&mut st.doc, |d| d.flip(true)),
                _ => anim_map_cels(&mut st.doc, |d| d.flip(false)),
            }
            commit(app, st, "Rotation / retournement");
            app.invoke_zoom_fit();
        }
        id if id.starts_with("nouvelle") => t.set_sel_mode(0),
        id if id.starts_with("ajouter") => t.set_sel_mode(1),
        id if id.starts_with("soustraire") => t.set_sel_mode(2),
        // intersection / OU exclusif : un second clic revient à « Nouvelle »
        "sel-intersect" => t.set_sel_mode(if t.get_sel_mode() == 3 { 0 } else { 3 }),
        "sel-xor" => t.set_sel_mode(if t.get_sel_mode() == 4 { 0 } else { 4 }),
        id if id.starts_with("autoriser") => toggle_outside(app, st),
        _ => status(app, "Option pas encore portée dans la version Rust"),
    }
}

// ------------------------------------------------------------------ démarrage

#[cfg_attr(target_arch = "wasm32", wasm_bindgen::prelude::wasm_bindgen(start))]
pub fn main() {
    // web : message d'une erreur fatale dans la console du navigateur
    // + fenêtre d'erreur de la page (web/index.html, mpReportError) : le module wasm est arrêté
    // après une panique, l'interface Slint ne peut plus rien afficher (worker : seulement la console,
    // le worker transmet le message à la page)
    #[cfg(target_arch = "wasm32")]
    std::panic::set_hook(Box::new(|info| {
        let msg = i18n::tr_format!("MasterPaint : {info}");
        web_sys::console::error_1(&msg.clone().into());
        if let Some(w) = web_sys::window() {
            if let Ok(f) = js_sys::Reflect::get(&w, &"mpReportError".into()) {
                if let Some(f) = wasm_bindgen::JsCast::dyn_ref::<js_sys::Function>(&f) {
                    let _ = f.call2(&w, &msg.into(), &true.into());
                }
            }
        }
    }));
    #[cfg(target_arch = "wasm32")]
    if let Some(w) = web_sys::window() {
        let _ = js_sys::Reflect::set(&w, &"mpVersion".into(), &APP_VERSION.into());
    }
    // worker de calcul (web/mp-worker.js) : pas d'interface, seulement les fonctions mp_worker_*
    #[cfg(target_arch = "wasm32")]
    if web_sys::window().is_none() {
        return;
    }
    if let Err(e) = run() {
        eprintln!("MasterPaint : {e}");
    }
}

fn run() -> Result<(), slint::PlatformError> {
    // capture sans fenêtre (--snapshot=…) : plateforme logicielle installée avant la fenêtre
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    let snap = snapshot::install(&std::env::args().skip(1).collect::<Vec<_>>());
    // navigateur sans WebGL (voir web/index.html, mpNoWebGL) : rendu logiciel plutôt qu'un arrêt
    #[cfg(target_arch = "wasm32")]
    if web::flag("mpNoWebGL") {
        web_sys::console::warn_1(&"MasterPaint : WebGL indisponible, rendu logiciel".into());
        let _ = slint::BackendSelector::new().renderer_name("software".into()).select();
    }
    let app = AppWindow::new()?;
    #[cfg(target_os = "android")]
    app.set_platform_insets(true);
    // options : --classic (barre Paint.NET), --dark, --accent=#rrggbb, puis un fichier image
    #[cfg(not(target_arch = "wasm32"))]
    let args: Vec<String> = std::env::args().skip(1).collect();
    // web : mêmes options dans l'adresse (?effect=vhs&show=colors&dark) — démonstrations, tests
    #[cfg(target_arch = "wasm32")]
    let args: Vec<String> = web_sys::window()
        .and_then(|w| w.location().search().ok())
        .map(|q| q.trim_start_matches('?').split('&').filter(|p| !p.is_empty()).map(|p| format!("--{p}")).collect())
        .unwrap_or_default();
    let flag = |f: &str| args.iter().any(|a| a == f);
    SYNC_LOADS.store(args.iter().any(|a| a.starts_with("--demo=") || a.starts_with("--snapshot")), std::sync::atomic::Ordering::Relaxed);
    // options : --tool=<id> (outil actif au démarrage)
    let accent = args
        .iter()
        .find_map(|a| a.strip_prefix("--accent=#"))
        .and_then(|h| u32::from_str_radix(h, 16).ok())
        .map(|v| Color::from_rgb_u8((v >> 16) as u8, (v >> 8) as u8, v as u8))
        .unwrap_or(Color::from_rgb_u8(0x0d, 0x7a, 0x7a));
    let cfg = settings::Settings::load();
    apply_language(cfg.language);
    let accent = if args.iter().any(|a| a.starts_with("--accent=")) {
        accent
    } else {
        Color::from_rgb_u8((cfg.accent >> 16) as u8, (cfg.accent >> 8) as u8, cfg.accent as u8)
    };
    app.set_set_theme_style(if flag("--win98") { 1 } else { cfg.theme_style });
    app.set_set_interface_theme(cfg.interface_theme);
    app.set_show_tools(cfg.interface_theme != 3);
    app.set_set_follow_interface_style(cfg.follow_interface_style);
    icon_packs::restore_all(cfg.imported_icon_packs.clone(), cfg.custom_icon_pack.clone(), cfg.active_custom_icon);
    app.set_set_icon_pack(cfg.icon_pack);
    app.set_set_missing_icon_fallback(cfg.missing_icon_fallback);
    icon_packs::set_missing_fallback(cfg.missing_icon_fallback);
    icon_packs::select(cfg.icon_pack);
    app.set_icon_pack_catalog(ModelRc::new(VecModel::from(icon_packs::catalog(cfg.icon_pack))));
    if let Some(preset)=args.iter().find_map(|a| a.strip_prefix("--interface=")) {
        let i=match preset {"paintdotnet"=>1,"photoshop"=>2,"phone"=>3,_=>0};
        app.set_set_interface_theme(i);
        app.set_toolbar_mode(if i == 0 { 0 } else { 1 });
        app.set_set_layout(match i {1=>0,2=>1,3=>2,_=>0});
        app.set_show_tools(i != 1 && i != 3);
        app.set_set_icon_pack(match i {1=>1,2=>2,_=>0}); icon_packs::select(app.get_set_icon_pack());
    }
    app.set_set_ui_zoom(cfg.ui_zoom);
    app.set_set_default_zoom(cfg.default_zoom);
    app.set_set_autosave(cfg.autosave);
    app.set_set_use_gpu(cfg.use_gpu);
    app.set_set_paste_mode(cfg.paste_mode);
    app.set_set_paste_ask(cfg.paste_ask);
    app.set_set_rounded(cfg.rounded);
    app.set_set_pronounced_borders(cfg.pronounced_borders);
    app.set_set_glass(cfg.glass);
    app.set_set_title_transparent(cfg.title_transparent);
    app.set_set_header_preview(cfg.header_preview);
    app.set_set_shadows(cfg.shadows);
    app.set_set_perf_mode(cfg.perf_mode);
    app.set_set_hover_fx(cfg.hover_fx);
    app.set_set_render_scale(cfg.render_scale);
    app.set_render_scale_start(cfg.render_scale);
    app.set_set_render_ctl(cfg.render_ctl);
    app.set_set_render_default(cfg.render_default);
    editor::RENDER_DEFAULT.store(render_default(cfg.render_ctl, cfg.render_default), std::sync::atomic::Ordering::Relaxed);
    app.set_set_perf_done(cfg.perf_done);
    app.set_set_perf_cut(cfg.perf_cut);
    app.set_set_perf_reported(cfg.perf_reported);
    app.set_set_zoom_smooth(cfg.zoom_smooth);
    AUTOSAVE_ON.store(cfg.autosave, std::sync::atomic::Ordering::Relaxed);
    GPU_ALLOWED.store(cfg.use_gpu, std::sync::atomic::Ordering::Relaxed);
    {
        let tools = app.global::<Generated>().get_tools();
        let titles: Vec<SharedString> = (0..tools.row_count()).filter_map(|i| tools.row_data(i)).map(|t| t.3).collect();
        let idx = (0..tools.row_count()).filter_map(|i| tools.row_data(i)).position(|t| t.2 == cfg.default_tool.as_str()).unwrap_or(0);
        app.set_tool_titles(ModelRc::new(VecModel::from(titles)));
        app.set_set_default_tool(idx as i32);
    }
    app.set_set_layout(cfg.layout);
    app.set_set_layout_auto(cfg.layout_auto);
    theme::apply(&app, flag("--dark") || cfg.dark, accent);
    if cfg.interface_theme != 2 {
        USER_DARK.store(if flag("--dark") || cfg.dark { 2 } else { 1 }, std::sync::atomic::Ordering::Relaxed);
    }
    appearance::initialize(&app, &cfg);
    app.set_primary_color(appearance::color(&app, 3));
    app.set_secondary_color(appearance::color(&app, 4));
    {
        let weak = app.as_weak();
        app.on_appearance_changed(move || appearance::render(&weak.unwrap()));
        let weak = app.as_weak();
        app.on_appearance_color_picked({
            let weak = app.as_weak();
            move |index, color| { let app = weak.unwrap(); appearance::pick(&app, index, color); save_settings(&app); }
        });
        app.on_appearance_color_edited(move |index, text| {
            let app = weak.unwrap();
            if appearance::edit(&app, index, &text) { save_settings(&app); }
        });
        let weak = app.as_weak();
        app.on_appearance_reset(move || {
            let app = weak.unwrap();
            appearance::initialize(&app, &settings::Settings::default());
            save_settings(&app);
        });
    }
    app.set_toolbar_mode(if flag("--classic") { 1 } else { cfg.toolbar_mode });
    app.set_set_wheel_mode(cfg.wheel_scroll as i32);
    app.set_set_history_max(cfg.history_max as f32);
    app.set_set_history_keep(cfg.history_keep as f32);
    app.set_set_snap_div(cfg.snap_div as f32);
    app.set_set_snap_thresh(cfg.snap_thresh as f32);
    app.set_set_snap_always(cfg.snap_always);
    app.set_set_snap_guides(cfg.snap_guides);
    app.set_fav_colors(ModelRc::new(VecModel::from(cfg.fav_colors.iter().map(|c| Color::from_argb_encoded(*c)).collect::<Vec<_>>())));
    app.set_recent_colors(ModelRc::new(VecModel::from(cfg.recent_colors.iter().map(|c| Color::from_argb_encoded(*c)).collect::<Vec<_>>())));
    app.set_colors_grid(cfg.color_square);
    // palettes : position et taille enregistrées (re-bornées à l'affichage par FloatWindow)
    for (k, g) in &cfg.palettes {
        let geom = PalGeom { set: true, x: g[0], y: g[1], w: g[2], h: g[3] };
        match k.as_str() {
            "tools" => app.set_geom_tools(geom),
            "history" => app.set_geom_history(geom),
            "colors" => app.set_geom_colors(geom),
            "layers" => app.set_geom_layers(geom),
            _ => {}
        }
    }
    // disposition Photoshop : ordre et hauteurs de la colonne de droite
    app.set_ps_pos_colors(cfg.ps_dock[0] as i32);
    app.set_ps_pos_history(cfg.ps_dock[1] as i32);
    app.set_ps_pos_layers(cfg.ps_dock[2] as i32);
    app.set_ps_h_colors(cfg.ps_dock[3]);
    app.set_ps_h_history(cfg.ps_dock[4]);
    app.global::<ToolOpts>().set_text_layer(cfg.text_layer);
    app.global::<ToolOpts>().set_shape_layer(cfg.shape_layer);
    app.set_welcome_count(cfg.welcome_count.min(1000) as i32);
    app.set_welcome_hide(cfg.welcome_hide);
    app.global::<ToolOpts>().set_magnet_strength(cfg.magnet_strength);
    app.global::<ToolOpts>().set_magnet_freq(cfg.magnet_freq);
    app.set_set_autosave_min(cfg.autosave_min as f32);
    app.set_set_language(cfg.language);
    editor::HISTORY_MAX.store(cfg.history_max, std::sync::atomic::Ordering::Relaxed);
    editor::HISTORY_KEEP.store(cfg.history_keep, std::sync::atomic::Ordering::Relaxed);
    let rows: Vec<(SharedString, SharedString)> = settings::SHORTCUTS.iter().map(|(k, w)| (SharedString::from(i18n::tr(k)), SharedString::from(i18n::tr(w)))).collect();
    app.set_shortcut_list(ModelRc::new(VecModel::from(rows)));
    {
        // enregistrement à la fermeture des Paramètres et à chaque changement de thème
        let weak = app.as_weak();
        app.on_settings_changed(move || {
            let app = weak.unwrap();
            save_settings(&app);
            // résolution de rendu : boutons du ruban, et toile recomposée si la réduction change
            let div = render_default(app.get_set_render_ctl(), app.get_set_render_default());
            let changed = editor::RENDER_DEFAULT.swap(div, std::sync::atomic::Ordering::Relaxed) != div;
            if let Some(state) = APP_STATE.with(|s| s.borrow().clone()) {
                if let Ok(mut st) = state.try_borrow_mut() {
                    if changed {
                        for l in st.doc.layers.iter_mut().filter(|l| l.dynamic.is_some()) {
                            l.dyn_key = None;
                        }
                        refresh_all(&app, &mut st);
                    } else {
                        sync_render_ctl(&app, &st);
                    }
                }
            }
            // aperçu du haut rétabli : son image n'était plus tenue à jour
            if app.get_set_header_preview() && !HEADER_SHOWN.with(|h| h.get()) {
                if let Some(state) = APP_STATE.with(|s| s.borrow().clone()) {
                    if let Ok(mut st) = state.try_borrow_mut() {
                        sync_tabs(&app, &mut st);
                    }
                }
            }
        });
    }
    {
        let weak = app.as_weak();
        app.on_perf_auto_changed(move || perf::auto_changed(&weak.unwrap()));
    }
    if !SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
        perf::start(&app);
    }
    app.set_menus(menus_with_status(&app));
    app.set_wheel_image(color_wheel(260, ColorMode::Rgb));
    app.set_color_grid_image(color_grid(260, ColorMode::Rgb));
    sync_color_fields(&app);
    {
        let weak = app.as_weak();
        app.on_primary_changed(move || {
            let app = weak.unwrap();
            if snap_color(&app, true) {
                return; // nouvelle couleur posée : ce rappel est relancé avec elle
            }
            sync_color_fields(&app);
        });
        let weak = app.as_weak();
        app.on_secondary_changed(move || {
            let app = weak.unwrap();
            if snap_color(&app, false) {
                return;
            }
            // fenêtre Couleurs réglée sur la secondaire : ses champs suivent
            if app.get_color_edit_secondary() {
                sync_color_fields(&app);
            }
        });
    }
    {
        let weak = app.as_weak();
        app.on_color_component(move |i, v| {
            let app = weak.unwrap();
            let c = edited_color(&app);
            let (mut r, mut g, mut b, mut a) = (c.red(), c.green(), c.blue(), c.alpha());
            match i {
                0 => r = v as u8,
                1 => g = v as u8,
                2 => b = v as u8,
                3 => a = v as u8,
                _ => {
                    let (mut h, mut s, mut vv) = rgb_to_hsv(r, g, b);
                    match i {
                        4 => h = v,
                        5 => s = v,
                        _ => vv = v,
                    }
                    let n = hsv(h, s / 100.0, vv / 100.0);
                    (r, g, b) = (n[0], n[1], n[2]);
                }
            }
            set_edited_color(&app, Color::from_argb_u8(a, r, g, b));
        });
    }
    {
        let weak = app.as_weak();
        app.on_color_hex_edited(move |t| {
            let app = weak.unwrap();
            if let Ok(v) = u32::from_str_radix(t.trim().trim_start_matches('#'), 16) {
                let a = edited_color(&app).alpha();
                set_edited_color(&app, Color::from_argb_u8(a, (v >> 16) as u8, (v >> 8) as u8, v as u8));
            }
        });
    }
    {
        // carré saturation × valeur, barres de teinte et de valeur : couleur posée d'après ses
        // composantes TSV (la teinte reste celle du geste même sur un gris), alpha gardé
        let weak = app.as_weak();
        app.on_hsv_picked(move |h, s, v, secondary| {
            let app = weak.unwrap();
            let old = if secondary { app.get_secondary_color() } else { app.get_primary_color() };
            let n = hsv(h.rem_euclid(360.0), s.clamp(0.0, 1.0), v.clamp(0.0, 1.0));
            let col = Color::from_argb_u8(old.alpha(), n[0], n[1], n[2]);
            if secondary {
                app.set_secondary_color(col);
            } else {
                app.set_primary_color(col);
            }
        });
    }
    {
        // couleurs favorites : « + » ajoute la couleur principale (ou la retire si elle y est
        // déjà) ; Maj + clic / clic du milieu retire une case ; enregistrées dans les réglages
        let weak = app.as_weak();
        app.on_fav_action(move |what, i| {
            let app = weak.unwrap();
            let f = app.get_fav_colors();
            let mut favs: Vec<Color> = (0..f.row_count()).filter_map(|k| f.row_data(k)).collect();
            match what.as_str() {
                "add" => {
                    let c = app.get_primary_color();
                    if let Some(k) = favs.iter().position(|x| x.as_argb_encoded() == c.as_argb_encoded()) {
                        favs.remove(k);
                        status(&app, "Couleur retirée des favoris");
                    } else if favs.len() >= 24 {
                        status(&app, "Favoris pleins (24 couleurs) : Maj + clic sur une case pour la retirer");
                        return;
                    } else {
                        favs.push(c);
                        status(&app, "Couleur ajoutée aux favoris");
                    }
                }
                "remove" if (i as usize) < favs.len() => {
                    favs.remove(i as usize);
                }
                _ => return,
            }
            app.set_fav_colors(ModelRc::new(VecModel::from(favs)));
            save_settings(&app);
        });
    }
    {
        // palettes : fin d'un déplacement / redimensionnement → géométrie enregistrée (gardée
        // aussi à la réouverture de la palette)
        let weak = app.as_weak();
        app.on_palette_geometry(move |name, x, y, w, h| {
            let app = weak.unwrap();
            let geom = PalGeom { set: true, x, y, w, h };
            let old = match name.as_str() {
                "tools" => app.get_geom_tools(),
                "history" => app.get_geom_history(),
                "colors" => app.get_geom_colors(),
                "layers" => app.get_geom_layers(),
                _ => return,
            };
            if old == geom {
                return;
            }
            match name.as_str() {
                "tools" => app.set_geom_tools(geom),
                "history" => app.set_geom_history(geom),
                "colors" => app.set_geom_colors(geom),
                _ => app.set_geom_layers(geom),
            }
            save_settings(&app);
        });
    }

    #[cfg(not(target_arch = "wasm32"))]
    let doc = args
        .iter()
        .find(|a| !a.starts_with("--"))
        .and_then(|p| {
            let path = std::path::Path::new(p);
            let (w, h, px) = decode(&std::fs::read(path).ok()?)?;
            Some(Doc::from_pixels(w, h, px, &path.file_name()?.to_string_lossy()))
        })
        .unwrap_or_else(|| Doc::new(1280, 720, [255, 255, 255, 255], &i18n::tr("Sans titre 1")));
    #[cfg(target_arch = "wasm32")]
    let doc = Doc::new(1280, 720, [255, 255, 255, 255], &i18n::tr("Sans titre 1"));

    let state: Shared = Rc::new(RefCell::new(State {
        doc,
        session: Session::default(),
        tool: Tool::RectSelect,
        display: Vec::new(),
        clipboard: None,
        last_effect: None,
        last_effect_vals: None,
        effect: None,
        effect_memory: Default::default(),
        effect_timer: Rc::new(slint::Timer::default()),
        fonts: text::Fonts::new(),
        text_edit: None,
        vector_drag: None,
        vector_drag_base: None,
        floating: None,
        tabs: vec![None],
        cur: 0,
        transform_drag: None,
        sel_drag: false,
        ants_phase: 0,
        ants_cache: None,
        tiles: Rc::new(VecModel::default()),
        tile_index: Default::default(),
        lazy: false,
        tile_ok: Default::default(),
        tile_clear: Default::default(),
        mask_sig: 0,
        backdrop: Vec::new(),
        bs: 0,
        path_edit: None,
        grad_live: None,
        last_press: (0.0, 0.0),
        vv: Default::default(),
        thumbs: Vec::new(),
        sel_bounds: None,
        dyn_inflight: std::collections::HashSet::new(),
        empty: false,
        dyn_draft: None,
        dyn_draft_flight: std::collections::HashSet::new(),
        shape_layer_new: None,
        shape_edit: None,
        shape_base: None,
        dyn_fx: None,
        dyn_pending_edit: None,
        other_size: 0.0,
        dyn_timer: Rc::new(slint::Timer::default()),
        rename_index: 0,
        curves: None,
        pinching: false,
        font_previews: Vec::new(),
        autosave_sig: 0,
        autosave_at: 0.0,
        task: None,
        ds: 1,
        crop: None,
        picking: None,
        tab_thumbs: Default::default(),
        photo: photo::PhotoMode::default(),
        sym_drag: 0,
        sym_click: 0.0,
        live_sent: 0.0,
        history_shown: u64::MAX,
    }));
    app.set_canvas_tiles(ModelRc::from(state.borrow().tiles.clone()));
    APP_STATE.with(|s| *s.borrow_mut() = Some(state.clone()));
    // barre de titre intégrée (bureau) : la fenêtre n'a pas de cadre du système
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    {
        app.set_custom_frame(!flag("--system-frame"));
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_window_action(move |a| {
            use slint::winit_030::WinitWindowAccessor;
            let Some(app) = weak.upgrade() else { return };
            let w = app.window();
            // le système prend la main sur la souris (déplacement, réduction, agrandissement) :
            // Slint ne reçoit jamais le relâchement, et l'élément pressé gardait la souris
            // capturée — les menus ne répondaient plus. On lui envoie ce relâchement nous-mêmes.
            // (au tour suivant de la boucle : pas d'évènement envoyé depuis un gestionnaire d'évènement)
            let release = |w: &slint::Window| {
                let _ = w;
                let weak = app.as_weak();
                slint::Timer::single_shot(std::time::Duration::from_millis(1), move || {
                    use slint::platform::{PointerEventButton, WindowEvent};
                    let Some(app) = weak.upgrade() else { return };
                    let position = slint::LogicalPosition::new(-1.0, -1.0);
                    app.window().dispatch_event(WindowEvent::PointerReleased { position, button: PointerEventButton::Left });
                    app.window().dispatch_event(WindowEvent::PointerExited);
                });
            };
            match a.as_str() {
                "drag" => {
                    let _ = w.with_winit_window(|ww| ww.drag_window());
                    release(w);
                }
                "minimize" => {
                    release(w);
                    w.set_minimized(true);
                }
                "maximize" => {
                    release(w);
                    let m = !w.is_maximized();
                    w.set_maximized(m);
                    app.set_maximized(m);
                }
                _ => {
                    // fermeture : confirmation si des images ne sont pas enregistrées
                    if let Ok(mut st) = state2.try_borrow_mut() {
                        if request_exit(&app, &mut st) {
                            quit_app(&mut st, false);
                        }
                    }
                }
            }
        });
    }
    // glisser-déposer d'un fichier sur la fenêtre
    {
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_task_result(move |r| task_result(&weak.unwrap(), &state2, r));
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_crop_action(move |a| crop_action(&weak.unwrap(), &mut state2.borrow_mut(), a.as_str()));
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_bounds_apply(move |x, y, w, h| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let n = |s: SharedString| s.trim().parse::<f32>().ok();
            let (Some(nx), Some(ny), Some(nw), Some(nh)) = (n(x), n(y), n(w), n(h)) else { return };
            let (nw, nh) = ((nw.round() as usize).clamp(1, 16384), (nh.round() as usize).clamp(1, 16384));
            let a = st.doc.active;
            let Some((bx, by, bw, bh)) = st.doc.layer_content_bounds(a) else { return };
            finish_edits(&app, &mut st);
            // contenu actuel (emprise seule), éventuellement redimensionné, puis reposé
            let (ux, uy, uw, _uh, full) = st.doc.layer_full(a);
            let mut crop = vec![0u8; bw * bh * 4];
            for yy in 0..bh {
                let si = (((by - uy) as usize + yy) * uw + (bx - ux) as usize) * 4;
                crop[yy * bw * 4..(yy + 1) * bw * 4].copy_from_slice(&full[si..si + bw * 4]);
            }
            let content = if (nw, nh) != (bw, bh) { editor::resample(&crop, bw, bh, nw, nh) } else { crop };
            let keep = app.global::<ToolOpts>().get_outside_canvas();
            st.doc.place_layer_content(a, nx.round() as isize, ny.round() as isize, nw, nh, &content, keep);
            st.doc.commit("Calque actif : position et taille");
            refresh_all(&app, &mut st);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        {
            let weak = app.as_weak();
            let state2 = state.clone();
            app.on_vec_view_moved(move || {
                if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                    vecview::view_changed(&app, &mut st);
                }
            });
        }
        app.on_zoom_changed(move || {
            if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                zoom_changed(&app, &mut st);
            }
            view_moved(&weak.unwrap());
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_effect_scope_changed(move || {
            if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                if st.effect.is_some() {
                    preview_effect(&app, &mut st);
                }
            }
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_view_moved(move || {
            if let Some(app) = weak.upgrade() {
                if let Ok(mut st) = state2.try_borrow_mut() {
                    ensure_visible(&app, &mut st);
                    sync_outside(&app, &st);
                    update_pixel_grid(&app, &st);
                }
                view_moved(&app);
            }
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_export_run(move |fmt, name, quality, bits, all| export_to(&weak.unwrap(), &state2, &fmt, &name, quality, &bits, all));
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_snap_changed(move || {
            let app = weak.unwrap();
            let st = state2.borrow();
            refresh_snap_grid(&app, &st);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_rmbg_start(move || rmbg_start(&weak.unwrap(), &state2));
        let weak = app.as_weak();
        app.on_rmbg_cancel(move || {
            let app = weak.unwrap();
            #[cfg(target_arch = "wasm32")]
            if app.get_rmbg_busy() {
                // le traitement s'arrête ; la fenêtre se ferme à la fin de l'attente
                web::remove_bg_abort();
                app.set_rmbg_text(SharedString::from(i18n::tr("Annulation…")));
                return;
            }
            app.set_show_rmbg(false);
        });
        let weak = app.as_weak();
        app.on_snap_ok(move || {
            let app = weak.unwrap();
            save_settings(&app);
            show_snap_guides(&app, None, None);
            app.set_show_snap(false);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_snap_cancel(move || {
            // retour aux réglages enregistrés
            let app = weak.unwrap();
            let cfg = settings::Settings::load();
    apply_language(cfg.language);
            app.set_set_snap_div(cfg.snap_div as f32);
            app.set_set_snap_thresh(cfg.snap_thresh as f32);
            app.set_set_snap_always(cfg.snap_always);
            app.set_set_snap_guides(cfg.snap_guides);
            refresh_snap_grid(&app, &state2.borrow());
            show_snap_guides(&app, None, None);
            app.set_show_snap(false);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_border_apply(move || {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let px = |s: SharedString| s.trim().parse::<f32>().map(|v| v.max(0.0).round() as usize).unwrap_or(0).min(4096);
            let m = if app.get_bd_uniform() {
                let a = px(app.get_bd_all());
                (a, a, a, a)
            } else {
                (px(app.get_bd_l()), px(app.get_bd_t()), px(app.get_bd_r()), px(app.get_bd_b()))
            };
            if m.0 + m.1 + m.2 + m.3 == 0 {
                return;
            }
            let c = rgba(if app.get_bd_secondary() { app.get_secondary_color() } else { app.get_primary_color() });
            finish_edits(&app, &mut st);
            st.doc.add_border(m, c, app.get_bd_outside(), app.get_bd_new_layer());
            st.doc.commit("Bordure d'image");
            refresh_all(&app, &mut st);
            if app.get_bd_outside() {
                app.invoke_zoom_fit();
            }
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_task_thumb(move |k| task_thumb(&weak.unwrap(), &mut state2.borrow_mut(), k.max(0) as usize));
        #[cfg(not(target_os = "android"))]
        {
            use slint::winit_030::{winit, EventResult, WinitWindowAccessor};
            use winit::event::{ElementState, TouchPhase, WindowEvent};
            let weak = app.as_weak();
            #[cfg(not(target_arch = "wasm32"))]
            let state2 = state.clone();
            let mut pointer = winit::dpi::LogicalPosition::new(0f32, 0f32);
            app.window().on_winit_window_event(move |w, ev| {
                #[cfg(not(target_arch = "wasm32"))]
                match ev {
                    WindowEvent::Touch(touch) => pen::native(touch.force.map(|force| force.normalized())),
                    WindowEvent::CursorMoved { .. } => pen::native(None),
                    _ => {},
                }
                if matches!(ev, WindowEvent::CursorMoved { .. } | WindowEvent::MouseInput { .. } | WindowEvent::Touch(_)) {
                    LAST_ACTIVITY.with(|a| a.set(now_ms()));
                }
                // fenêtre flottante sous l'appui : devant, avant même que Slint ne traite l'appui
                let scale = w.scale_factor() as f64;
                let pressed = match ev {
                    WindowEvent::CursorMoved { position, .. } => {
                        pointer = position.to_logical(scale);
                        false
                    }
                    WindowEvent::Touch(t) => {
                        pointer = t.location.to_logical(scale);
                        t.phase == TouchPhase::Started
                    }
                    WindowEvent::MouseInput { state: ElementState::Pressed, .. } => true,
                    _ => false,
                };
                if let (true, Some(app)) = (pressed, weak.upgrade()) {
                    app.invoke_window_press(pointer.x, pointer.y);
                    let weak = weak.clone();
                    // les fenêtres répondent par leurs « changed » : on tranche juste après
                    slint::Timer::single_shot(std::time::Duration::from_millis(30), move || {
                        if let Some(app) = weak.upgrade() {
                            app.invoke_window_press_commit();
                        }
                    });
                }
                #[cfg(not(target_arch = "wasm32"))]
                if let WindowEvent::DroppedFile(path) = ev {
                    if let (Some(app), Ok(bytes)) = (weak.upgrade(), std::fs::read(path)) {
                        let name = path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                        if let Ok(mut st) = state2.try_borrow_mut() {
                            dropped_file(&app, &mut st, name, bytes);
                        }
                    }
                    return EventResult::PreventDefault;
                }
                EventResult::Propagate
            });
        }
        #[cfg(target_arch = "wasm32")]
        {
            SHARED.with(|s| *s.borrow_mut() = Rc::downgrade(&state));
            // collage du navigateur (menu Coller, raccourci non intercepté) : ignoré s'il suit
            // un Ctrl+V déjà lu par l'application
            let weak = app.as_weak();
            let state2 = state.clone();
            let weak_raw = app.as_weak();
            let state_raw = state.clone();
            web::on_paste(
                move |name, bytes| {
                    let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) else { return };
                    if js_sys::Date::now() - PASTE_READ_AT.with(|t| t.get()) < 1500.0 {
                        applog::log("Coller : évènement du navigateur ignoré (déjà lu par l'application)");
                        return;
                    }
                    if name == "*" {
                        // rien d'utilisable dans le presse-papiers du système (texte…) : copie interne
                        return match st.clipboard.clone() {
                            Some(c) => {
                                applog::log("Coller : presse-papiers interne");
                                paste_clips(&app, &mut st, vec![(c, "Coller", None)]);
                            }
                            None => status(&app, "Presse-papiers vide"),
                        };
                    }
                    if bytes.is_empty() {
                        applog::log("Coller : le presse-papiers ne contient qu'un chemin de fichier");
                        return status(&app, "Le navigateur ne peut pas lire un fichier copié : glissez-le sur la page ou utilisez Fichier › Ouvrir".to_string());
                    }
                    applog::log(i18n::tr_format!("Coller (évènement du navigateur) : {name}, {} octets", bytes.len()));
                    if raw::is_raw(&name) || is_project_file(&name) {
                        return dropped_file(&app, &mut st, name, bytes);
                    }
                    match decode(&bytes) {
                        Some((w, h, px)) => {
                            let c = clip_from_raw(&mut st, w, h, px);
                            paste_clips(&app, &mut st, vec![(c, "Coller", None)]);
                        }
                        None => status(&app, i18n::tr_format!("Coller : « {name} » n'est pas une image reconnue")),
                    }
                },
                move |name, w, h, px| {
                    let (Some(app), Ok(mut st)) = (weak_raw.upgrade(), state_raw.try_borrow_mut()) else { return };
                    if js_sys::Date::now() - PASTE_READ_AT.with(|t| t.get()) < 1500.0 {
                        return;
                    }
                    applog::log(i18n::tr_format!("Coller (évènement du navigateur) : {name}, {w} × {h} px"));
                    let c = clip_from_raw(&mut st, w, h, px);
                    paste_clips(&app, &mut st, vec![(c, "Coller", None)]);
                },
            );
            // copier / couper du navigateur : même chose que Ctrl+C / Ctrl+X
            let weak = app.as_weak();
            let state2 = state.clone();
            web::on_copy(move |cut| {
                if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                    applog::log(if cut { "Couper (évènement du navigateur)" } else { "Copier (évènement du navigateur)" });
                    if copy(&app, &mut st) && cut {
                        st.doc.erase_selection();
                        st.doc.commit("Couper");
                        refresh_all(&app, &mut st);
                    }
                }
            });
            let weak = app.as_weak();
            let state2 = state.clone();
            web::on_file_drop(move |name, bytes| {
                if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                    dropped_file(&app, &mut st, name, bytes);
                }
            });
        }
    }
    // sauvegarde automatique : restauration de la session précédente, puis toutes les 15 s
    {
        // sauvegarde coupée : aucune copie laissée par une session précédente
        if !cfg.autosave && !SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
            clear_autosave();
        }
        let opened_file = args.iter().any(|a| !a.starts_with("--"));
        // (bureau : lecture et décodage des calques dans un autre fil, sur tous les cœurs ; la
        // fenêtre s'affiche tout de suite avec la barre de progression)
        #[cfg(not(target_arch = "wasm32"))]
        let restoring = !opened_file && AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) && autosave_path().is_some_and(|p| p.exists());
        #[cfg(not(target_arch = "wasm32"))]
        if restoring && SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
            if let Some(bytes) = autosave_path().and_then(|p| std::fs::read(p).ok()) {
                restore_workspace(&app, &mut state.borrow_mut(), &bytes);
            }
        } else if restoring {
            RESTORING.store(true, std::sync::atomic::Ordering::Relaxed);
            app.set_load_title(i18n::tr("Restauration des projets").into());
            load_progress(&app, 0.0, "Lecture de la sauvegarde automatique…");
            app.set_loading(true);
            let weak = app.as_weak();
            let path = autosave_path();
            std::thread::spawn(move || {
                let t0 = now_ms();
                let l = path.and_then(|p| std::fs::read(p).ok()).and_then(|b| illu::load(&b).ok());
                applog::log(i18n::tr_format!("Restauration lue en {:.0} ms", now_ms() - t0));
                let _ = slint::invoke_from_event_loop(move || {
                    RESTORING.store(false, std::sync::atomic::Ordering::Relaxed);
                    let Some(app) = weak.upgrade() else { return };
                    if LOADS_ACTIVE.load(std::sync::atomic::Ordering::Relaxed) == 0 {
                        app.set_loading(false);
                    }
                    if let (Some(l), Some(state)) = (l, APP_STATE.with(|s| s.borrow().clone())) {
                        if let Ok(mut st) = state.try_borrow_mut() {
                            restore_loaded(&app, &mut st, l);
                        }
                    }
                    welcome_at_start(&app);
                });
            });
        }
        // fenêtre de bienvenue (deux premières ouvertures), une fois les projets restaurés
        #[cfg(not(target_arch = "wasm32"))]
        if !restoring || SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
            welcome_at_start(&app);
        }
        #[cfg(target_arch = "wasm32")]
        if !opened_file {
            let weak = app.as_weak();
            let state = state.clone();
            // l'écran de chargement de la page reste affiché pendant la restauration
            web::loading_step("Restauration des projets…");
            let _ = slint::spawn_local(async move {
                let stored = if AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) { web::store_load().await } else { None };
                if let Some(bytes) = stored {
                    RESTORING.store(true, std::sync::atomic::Ordering::Relaxed);
                    let t0 = now_ms();
                    let l = illu_load_workers(&bytes).await;
                    applog::log(i18n::tr_format!("Restauration lue en {:.0} ms", now_ms() - t0));
                    RESTORING.store(false, std::sync::atomic::Ordering::Relaxed);
                    if let (Ok(l), Some(app)) = (l, weak.upgrade()) {
                        if let Ok(mut st) = state.try_borrow_mut() {
                            restore_loaded(&app, &mut st, l);
                        }
                    }
                }
                // une image dessinée avant de retirer l'écran de chargement
                slint::Timer::single_shot(std::time::Duration::from_millis(60), web::ready);
                // puis la fenêtre de bienvenue (deux premières ouvertures)
                slint::Timer::single_shot(std::time::Duration::from_millis(400), move || {
                    if let Some(app) = weak.upgrade() {
                        welcome_at_start(&app);
                    }
                });
            });
        }
        #[cfg(target_arch = "wasm32")]
        if opened_file {
            slint::Timer::single_shot(std::time::Duration::from_millis(60), web::ready);
            let weak = app.as_weak();
            slint::Timer::single_shot(std::time::Duration::from_millis(400), move || {
                if let Some(app) = weak.upgrade() {
                    welcome_at_start(&app);
                }
            });
        }
        // battement pour la page : montre si le module tourne encore après une panique (« Attendre »)
        #[cfg(target_arch = "wasm32")]
        {
            let beat = slint::Timer::default();
            beat.start(slint::TimerMode::Repeated, std::time::Duration::from_secs(1), || {
                if let Some(w) = web_sys::window() {
                    let _ = js_sys::Reflect::set(&w, &"mpBeat".into(), &js_sys::Date::now().into());
                }
            });
            std::mem::forget(beat);
        }
        let sig = workspace_sig(&state.borrow());
        state.borrow_mut().autosave_sig = sig;
        let timer = slint::Timer::default();
        let state2 = state.clone();
        timer.start(slint::TimerMode::Repeated, std::time::Duration::from_secs(5), move || {
            if let Ok(mut st) = state2.try_borrow_mut() {
                autosave(&mut st, false);
            }
        });
        std::mem::forget(timer);
        // fermeture de la fenêtre (bureau) / onglet masqué (web) : sauvegarde immédiate
        #[cfg(not(target_arch = "wasm32"))]
        {
            let state2 = state.clone();
            let weak = app.as_weak();
            app.window().on_close_requested(move || {
                if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                    if !request_exit(&app, &mut st) {
                        return slint::CloseRequestResponse::KeepWindowShown;
                    }
                    save_settings(&app);
                    autosave(&mut st, true);
                }
                // l'aperçu 1:1 garderait la boucle d'évènements (et l'application) en vie
                live_close();
                slint::CloseRequestResponse::HideWindow
            });
        }
        #[cfg(target_arch = "wasm32")]
        {
            let state2 = state.clone();
            let weak = app.as_weak();
            web::on_hidden(move || {
                if let Some(app) = weak.upgrade() {
                    save_settings(&app);
                }
                if let Ok(mut st) = state2.try_borrow_mut() {
                    autosave(&mut st, true);
                }
            });
            // onglet du navigateur fermé ou rechargé : le navigateur demande confirmation
            // (son texte est imposé) s'il reste des images non enregistrées
            let state2 = state.clone();
            web::on_before_unload(move || state2.try_borrow().map(|st| !unsaved_tabs(&st).is_empty()).unwrap_or(false));
        }
    }
    // carte graphique : ouverte en arrière-plan (quelques centaines de ms), nom affiché ensuite
    {
        let weak = app.as_weak();
        let done = move |name: Option<String>| {
            #[cfg(target_arch = "wasm32")]
            let renderer = name.clone().or_else(webgl::renderer);
            #[cfg(not(target_arch = "wasm32"))]
            let renderer = name.clone();
            let msg = match name {
                Some(n) => i18n::tr_format!("Carte graphique : {n}"),
                // navigateur sans WebGPU : affichage composé en WebGL2 (passerelle mpGL)
                #[cfg(target_arch = "wasm32")]
                None if webgl::available() => i18n::tr_format!("Carte graphique : WebGL2 ({}) — WebGPU absent : affichage, filtres ƒ et effets courants accélérés en WebGL2",
                    webgl::renderer().unwrap_or_else(|| "carte inconnue".into())
                ),
                None => "Carte graphique : non disponible (tout est calculé par le processeur)".to_string(),
            };
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(app) = weak.upgrade() {
                    // annoncé quelques secondes dans la barre d'état ; le détail reste dans les Paramètres
                    status(&app, msg.clone());
                    app.set_gpu_text(SharedString::from(i18n::tr(&msg)));
                    perf::hardware_check(&app, renderer.as_deref());
                }
            });
        };
        #[cfg(not(target_arch = "wasm32"))]
        std::thread::spawn(move || {
            let name = gpu::get().map(|g| g.name.clone());
            GPU_READY.store(name.is_some(), std::sync::atomic::Ordering::Relaxed);
            done(name);
        });
        #[cfg(target_arch = "wasm32")]
        gpu::init(done);
    }
    refresh_all(&app, &mut state.borrow_mut());
    // outil au démarrage : option --tool=…, sinon celui des Paramètres
    // réglages des outils retenus ; outil au démarrage : --tool=…, sinon celui des Paramètres
    // s'il a été changé, sinon le dernier utilisé
    let last_tool = if SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) { None } else { restore_tool_state(&app, &cfg.tool_state) };
    let factory_tool = settings::Settings::default().default_tool;
    let start_tool = args
        .iter()
        .find_map(|a| a.strip_prefix("--tool="))
        .map(|t| t.to_string())
        .or_else(|| (cfg.default_tool == factory_tool).then_some(last_tool).flatten())
        .unwrap_or(cfg.default_tool.clone());
    set_tool(&app, &mut state.borrow_mut(), &start_tool);
    // --show=settings,colors,rulers,grid,shortcuts (captures et démonstrations)
    if let Some(list) = args.iter().find_map(|a| a.strip_prefix("--show=")) {
        for w in list.split(',') {
            match w {
                "settings" => app.set_show_settings(true),
                "welcome" => app.set_show_welcome(true),
                "shortcuts" => app.set_show_shortcuts(true),
                w if w.starts_with("info") => {
                    app.set_info_tab(w[4..].parse().unwrap_or(0));
                    app.set_show_shortcuts(true);
                }
                "colors" => app.set_colors_expanded(true),
                "rulers" => app.global::<ToolOpts>().set_rulers(true),
                "grid" => app.global::<ToolOpts>().set_pixel_grid(true),
                "new" => app.set_show_new(true),
                "rotate" => app.set_show_rotate(true),
                "download" => app.set_show_download(true),
                "resize" => app.set_show_resize(true),
                "prompt" => prompt(&app, "selexpand", "Étendre / réduire la sélection", "Pixels (− = réduire)", "4"),
                "changelog" => {
                    app.set_changelog_text(SharedString::from(include_str!("../../../changelog.txt")));
                    app.set_show_changelog(true);
                }
                _ => {}
            }
        }
    }
    if let Some(e) = args.iter().find_map(|a| a.strip_prefix("--effect=")) {
        open_effect(&app, &mut state.borrow_mut(), e, e);
    }
    app.set_web(cfg!(target_arch = "wasm32"));
    app.set_app_version(APP_VERSION.into());
    // fichier passé au lancement (« Ouvrir avec ») : photo RAW → Mode Photo Pro, projet .illu
    #[cfg(not(target_arch = "wasm32"))]
    if let Some(p) = args.iter().find(|a| !a.starts_with("--")).filter(|p| raw::is_raw(p) || is_project_file(p)) {
        let path = std::path::Path::new(p);
        match std::fs::read(path) {
            Ok(bytes) => load_bytes(&app, &state, &path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(), bytes),
            Err(e) => show_error(&app, "Ouvrir", &format!("{} : {e}", path.display())),
        }
    }
    // --demo=close|exit|drop|paste : fenêtres de choix (captures ; sans sauvegarde automatique)
    if let Some(d) = args.iter().find_map(|a| a.strip_prefix("--demo=")) {
        AUTOSAVE_ON.store(false, std::sync::atomic::Ordering::Relaxed);
        let mut st = state.borrow_mut();
        let st = &mut *st;
        let demo = |w: usize, h: usize| {
            let mut px = vec![0u8; w * h * 4];
            for (i, p) in px.chunks_exact_mut(4).enumerate() {
                let (x, y) = (i % w, i / w);
                p.copy_from_slice(&[(x * 255 / w) as u8, (y * 255 / h) as u8, 180, 255]);
            }
            px
        };
        st.doc.saved = (usize::MAX, 0);
        match d {
            "close" => request_close_tab(&app, st, 0),
            // projet SVG tracé à la résolution de l'écran : MP_SVG (fichier), MP_ZOOM, chemin 1 en
            // Sélection directe
            "svg" => {
                let path = std::env::var("MP_SVG").unwrap_or_default();
                let bytes = std::fs::read(&path).unwrap_or_default();
                if let Ok(l) = svg_import::import_with("essai.svg", &bytes, svg_import::SvgMode::Single) {
                    if let Some(doc) = l.docs.into_iter().next() {
                        set_document(&app, st, doc);
                    }
                }
                // après l'ajustement à la fenêtre (taille de la capture connue)
                let weak = app.as_weak();
                slint::Timer::single_shot(std::time::Duration::from_millis(120), move || {
                    if let Some(app) = weak.upgrade() {
                        app.set_zoom(std::env::var("MP_ZOOM").ok().and_then(|z| z.parse().ok()).unwrap_or(1.0));
                    }
                });
                set_tool(&app, st, "tool-node");
                let k = st.doc.active;
                vecedit::begin_path_at(&app, st, k, 1);
                vecview::render_now(&app, st);
            }
            // Mode Photo Pro avec une photo dans la pellicule
            "photo" => {
                let png = encode(&Doc::from_pixels(640, 420, demo(640, 420), "x"), "png").unwrap_or_default();
                pm_add(&app, st, vec![("photo.png".into(), png)]);
            }
            "drop" => {
                let enc = |w: usize, h: usize| encode(&Doc::from_pixels(w, h, demo(w, h), "x"), "png").unwrap_or_default();
                dropped_file(&app, st, "paysage.png".into(), enc(320, 200));
                dropped_file(&app, st, "portrait.png".into(), enc(200, 300));
            }
            "paste" => paste_clips_here(&app, st, vec![(Clip { w: 1600, h: 900, px: demo(1600, 900), origin: None }, "Coller", None)]),
            "paste-where" => paste_clips(&app, st, vec![(Clip { w: 1600, h: 900, px: demo(1600, 900), origin: None }, "Coller", None)]),
            "export" => show_export(&app, st),
            "export-more" => {
                show_export(&app, st);
                app.set_ex_more(true);
                app.set_ex_fmt(1);
            }
            "border" => menu_demo(&app, st, "fn:showImageBorderDialog()"),
            "resize" => menu_demo(&app, st, "fn:resizeCanvas()"),
            "canvas" => menu_demo(&app, st, "fn:showExtendCanvasDialog()"),
            "rotate" => app.set_show_rotate(true),
            "snap" => {
                app.global::<ToolOpts>().set_snap(true);
                refresh_snap_grid(&app, st);
                show_snap_guides(&app, Some(240.0), Some(150.0));
                app.set_show_snap(true);
            }
            "crop" => {
                st.doc = Doc::from_pixels(1280, 720, demo(1280, 720), "photo.png");
                start_crop(&app, st);
                crop_action(&app, st, "0");
            }
            "settings" => app.set_show_settings(true),
            "welcome" => app.set_show_welcome(true),
            // aucun projet ouvert (dernier onglet fermé)
            "empty" => {
                let cur = st.cur;
                close_tab(&app, st, cur);
            }
            // fenêtre d'effet avec cadran d'angle, menu Affichage, Nouvelle image
            "fx-motion" => open_effect(&app, st, "motionblur", "Flou de déplacement"),
            "menu-view" => app.set_open_menu(2),
            // fenêtre Couleurs surgissante contre une case des Paramètres
            "color-pop" => {
                app.set_show_settings(true);
                app.set_settings_page(1);
                app.global::<ColorPop>().invoke_show("appearance:0".into(), Color::from_rgb_u8(255, 255, 255), 700.0, 330.0, 22.0);
            }
            // fenêtre Filtre dynamique (cartes) : calque ƒ avec deux effets
            "dyn" => {
                st.doc = Doc::from_pixels(1280, 720, demo(1280, 720), "photo.png");
                st.doc.add_layer_in();
                let l = st.doc.layer_mut();
                l.name = "Filtre".into();
                l.px = vec![255u8; 1280 * 720 * 4].into();
                l.dynamic = Some(vec![("blur".into(), 16.0), ("invert".into(), 6.0)]);
                l.dynamic_mode = 2;
                let uid = st.doc.layer().uid;
                app.set_applied_fx_uid(uid.to_string().into());
                refresh_all(&app, st);
                app.set_show_applied_fx(true);
                sync_applied_fx(&app, st);
            }
            "new" => {
                show_new_project(&app, st);
                app.set_new_keep(true);
                app.set_new_kind(2);
            }
            // mode animation : trois dessins (un rond qui avance), pelure d'oignon, image 2
            "anim" => {
                let (w, h) = (640usize, 400usize);
                let disc = |cx: f32| {
                    let mut px = vec![0u8; w * h * 4];
                    for y in 0..h {
                        for x in 0..w {
                            if (x as f32 - cx).powi(2) + (y as f32 - 200.0).powi(2) < 60.0 * 60.0 {
                                px[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&[20, 40, 60, 255]);
                            }
                        }
                    }
                    px
                };
                let mut d = anim::doc_from_frames(vec![disc(160.0), disc(160.0), disc(320.0), disc(480.0)], w, h, 8, "anim.gif");
                if let Some(a) = d.anim.as_mut() {
                    a.onion = true;
                    a.duration = 12;
                }
                anim::goto(&mut d, 2);
                st.doc = d;
                refresh_all(&app, st);
                app.invoke_zoom_fit();
            }
            "settings-adv" => {
                app.set_show_settings(true);
                app.set_settings_page(6);
            }
            "eyedropper" => set_tool(&app, st, "tool-eyedropper"),
            "mask" => layer_alpha(&app, st, 0, false),
            "icons" => open_icon_viewer(&app),
            "live" => {
                st.doc = Doc::from_pixels(640, 400, demo(640, 400), "photo.png");
                app.set_live_image(to_image(&st.doc.flatten(), st.doc.w, st.doc.h));
                app.set_show_live(true);
            }
            // grande image (8000 × 6000) à 100 % : seules les tuiles visibles sont composées
            "big" => {
                let mut doc = Doc::from_pixels(8000, 6000, demo(8000, 6000), "grande.png");
                doc.saved = (usize::MAX, 0);
                set_document(&app, st, doc);
                app.set_zoom(1.0);
                let t0 = now_ms();
                refresh_all(&app, st);
                eprintln!("refresh_all {} × {} : {:.0} ms (tuiles visibles seulement : {}, pas {}, {} tuiles)", st.doc.w, st.doc.h, now_ms() - t0, st.lazy, st.ds, st.tiles.row_count());
                let (dw, dh) = display_dims(st);
                let t0 = now_ms();
                st.doc.composite_scaled(&mut st.display, st.ds, (0, 0, dw, dh), false);
                eprintln!("même image composée en entier (comme avant) : {:.0} ms", now_ms() - t0);
                refresh_all(&app, st);
            }
            "ctx" => {
                context_menu(&app, "canvas", 420.0, 260.0, true, false);
            }
            "tip" => {
                let tip = app.global::<Tip>();
                tip.set_text(i18n::tr("Pinceau").into());
                tip.set_x(120.0);
                tip.set_y(200.0);
                tip.set_shown(true);
            }
            "bounds" => {
                st.doc.place_layer_content(0, 100, 80, 200, 120, &vec![200u8; 200 * 120 * 4], true);
                app.set_bd_x("100".into());
                app.set_bd_y("80".into());
                app.set_bd_w("200".into());
                app.set_bd_h("120".into());
                app.set_bd_orig_w(200);
                app.set_bd_orig_h(120);
                app.set_show_bounds(true);
            }
            "sym" => {
                app.global::<ToolOpts>().set_sym_x(true);
                app.global::<ToolOpts>().set_rulers(true);
                set_tool(&app, st, "tool-brush");
            }
            "effect" => open_effect(&app, st, "gaussian", "Flou gaussien"),
            "shapes" => set_tool(&app, st, "tool-shapes-family"),
            _ => {
                set_document(&app, st, Doc::from_pixels(400, 300, demo(400, 300), "photo.png"));
                st.doc.saved = (usize::MAX, 0);
                request_exit(&app, st);
            }
        }
    }
    // --color-mode=ral|cmjn : projet de départ converti (captures et démonstrations)
    if let Some(m) = args.iter().find_map(|a| a.strip_prefix("--color-mode=")) {
        let mode = ColorMode::from_illu(&format!("pixel-{m}"));
        set_color_mode(&app, &mut state.borrow_mut(), mode);
    }

    #[cfg(not(target_arch = "wasm32"))]
    {
        app.set_native_touch(true);
        let weak = app.as_weak();
        let state = state.clone();
        app.on_native_pinch(move |active| {
            let Some(app) = weak.upgrade() else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            st.pinching = active;
            if active {
                let st = &mut *st;
                st.session.cancel(&mut st.doc);
                app.set_overlay_path(SharedString::default());
                refresh_all(&app, st);
            }
        });
    }
    // ---- toile ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_canvas_pointer(move |kind, x, y, button, ctrl, _shift, alt| {
            // navigateur : modificateurs relevés par la page (Slint ne les transmet pas)
            #[cfg(target_arch = "wasm32")]
            let (ctrl, _shift, alt) = {
                let (c, s, a) = web::modifiers();
                (ctrl || c, _shift || s, alt || a)
            };
            let app = weak.unwrap();
            LAST_ACTIVITY.with(|a| a.set(now_ms()));
            let mut st = state.borrow_mut();
            let st = &mut *st;
            // aucun projet ouvert : pas de toile
            if st.empty {
                return;
            }
            // lassos : horloge du double-clic et proximité du point de départ (12 px écran)
            st.session.now = now_ms();
            st.session.near_tol = 12.0 / app.get_zoom().max(0.01);
            // aimantation sur la grille : sélections, formes, ligne, texte, déformation
            let snapped = matches!(
                st.tool,
                Tool::RectSelect | Tool::Lasso | Tool::PolyLasso | Tool::Shape | Tool::RoundRect | Tool::Line | Tool::Text | Tool::Deform | Tool::Warp
            ) && st.transform_drag.is_none();
            let (x, y) = if snapped && kind != 2 && (kind == 0 || st.session.busy()) {
                snap_point(&app, st, x, y)
            } else {
                (x, y)
            };
            if kind == 2 || !snapped {
                show_snap_guides(&app, None, None);
            }
            if kind == 1 {
                let (w, h) = (st.doc.w as f32, st.doc.h as f32);
                if x >= 0.0 && y >= 0.0 && x < w && y < h {
                    show_cursor_pos(&app, x as i32, y as i32, st.session.busy());
                }
                if !st.session.poly.is_empty() {
                    app.set_overlay_path(poly_path(st, (x, y)));
                }
            }
            if st.pinching {
                return;
            }
            // pipette d'une fenêtre d'effet : couleur de l'image d'origine (sans l'aperçu)
            if kind == 0 {
                let (w, h) = (st.doc.w, st.doc.h);
                if let Some(es) = st.effect.as_mut() {
                    if let Some(row) = es.pick.take() {
                        if x >= 0.0 && y >= 0.0 && (x as usize) < w && (y as usize) < h {
                            let o = (y as usize * w + x as usize) * 4;
                            let c = [es.base[o], es.base[o + 1], es.base[o + 2]];
                            set_row_color(es, row, c);
                            app.set_effect_fields(ModelRc::new(VecModel::from(effect_rows(&app, es))));
                            status(&app, i18n::tr_format!("Couleur choisie : #{:02X}{:02X}{:02X}", c[0], c[1], c[2]));
                            preview_effect(&app, st);
                        }
                        return;
                    }
                }
            }
            if st.effect.is_some() || st.curves.is_some() {
                return; // aperçu d'effet en cours : la toile ne se modifie pas
            }
            if st.crop.is_some() {
                crop_pointer(&app, st, kind, x, y);
                return;
            }
            // pipette : la couleur suit le pointeur tant que le bouton reste appuyé
            if st.tool == Tool::Eyedropper {
                match kind {
                    // clic gauche : la couleur active (principale ou secondaire, choisie dans la
                    // fenêtre Couleurs) ; clic droit : l'autre (avant : toujours la principale)
                    0 => st.picking = Some((button == 1) != app.get_color_edit_secondary()),
                    1 if st.picking.is_some() => {}
                    2 => {
                        st.picking = None;
                        return;
                    }
                    _ => return,
                }
                let (w, h) = (st.doc.w, st.doc.h);
                if x >= 0.0 && y >= 0.0 && (x as usize) < w && (y as usize) < h {
                    let secondary = st.picking.unwrap_or(false);
                    handle_outcome(&app, st, Outcome::PickColor(st.doc.pixel_color(x as usize, y as usize), secondary));
                }
                return;
            }
            if sym_pointer(&app, st, kind, x, y) {
                return;
            }
            if kind == 0 {
                st.last_press = (x, y);
            }
            // dégradé en cours : ses 3 points ; un appui à côté le pose et commence un nouveau geste
            if st.grad_live.is_some() && gradlive::pointer(&app, st, kind, x, y, _shift) {
                return;
            }
            // projet SVG : les outils tracent et modifient des objets, jamais des pixels
            if st.doc.vector_mode && st.doc.mask_of.is_none() {
                match st.tool {
                    Tool::Move => {
                        if vecedit::select_pointer(&app, st, kind, x, y, _shift) {
                            return;
                        }
                    }
                    Tool::Node => return vecedit::node_pointer(&app, st, kind, x, y, _shift, alt),
                    Tool::Pen => return vecedit::pen_pointer(&app, st, kind, x, y, alt),
                    Tool::Pencil | Tool::Brush => return vecedit::pencil_pointer(&app, st, kind, x, y),
                    Tool::Gradient => {
                        if kind == 0 {
                            gradlive::begin_object(&app, st, x, y, button == 1);
                        }
                        return;
                    }
                    _ => {}
                }
            }
            // outil Déplacer sur un calque texte : l'objet est déplacé (rendu net)
            if vector_move_pointer(&app, st, kind, x, y) {
                return;
            }
            if kind == 0 && matches!(st.tool, Tool::Move | Tool::Deform | Tool::Warp) && st.floating.is_none() {
                if st.doc.locked_at(st.doc.active) {
                    status(&app, "Calque verrouillé : cliquez sur son cadenas (panneau Calques) pour le déverrouiller");
                    return;
                }
                // déformer une partie d'un calque texte : il doit d'abord être pixellisé
                if st.doc.layer().vector.is_some() && st.doc.sel.is_some() && layer_guard(&app, st) {
                    return;
                }
            }
            if transform_pointer(&app, st, kind, x, y, button, _shift, alt) {
                return;
            }
            if st.tool == Tool::Text {
                if kind == 0 {
                    commit_text(&app, st);
                    begin_text(&app, st, x, y);
                }
                return;
            }
            // forme vivante : poignées, rotation, déplacement ; clic sur une forme SVG = la reprendre
            if matches!(st.tool, Tool::Shape | Tool::RoundRect | Tool::Line) && shape_edit::pointer(&app, st, kind, x, y, _shift) {
                return;
            }
            if kind == 0 && matches!(st.tool, Tool::Shape | Tool::RoundRect | Tool::Line) {
                prepare_shape_layer(&app, st);
            }
            // calque verrouillé, dossier ou calque texte : les outils qui peignent ne s'y appliquent pas
            if kind == 0 && paints_pixels(st.tool) && layer_guard(&app, st) {
                return;
            }
            // pot de peinture sur un calque vectoriel : l'objet cliqué prend la couleur
            if st.tool == Tool::Fill && (st.doc.layer().vector.is_some() || st.doc.vector_mode) {
                if kind == 0 {
                    let c = rgba(if button == 1 { app.get_secondary_color() } else { app.get_primary_color() });
                    vector_recolor(&app, st, x, y, c);
                }
                return;
            }
            if kind == 0 && paints_pixels(st.tool) && st.tool != Tool::Eraser {
                note_recent_color(&app, if button == 1 { app.get_secondary_color() } else { app.get_primary_color() });
            }
            // mode animation : on ne dessine pas pendant la lecture ; un tracé sur une image
            // qui montre un dessin maintenu commence un dessin vierge à cette image (dessin
            // image par image, comme la version web ; la gomme, elle, retouche une copie)
            if kind == 0 && st.doc.anim.is_some() {
                if app.get_anim_playing() {
                    stop_anim(&app);
                }
                if matches!(st.tool, Tool::Brush | Tool::Pencil | Tool::Shape | Tool::RoundRect | Tool::Line | Tool::Gradient | Tool::Fill) && anim::ensure_blank_cel(&mut st.doc) {
                    refresh_all(&app, st);
                }
            }
            if st.tool == Tool::Gradient {
                if kind == 0 {
                    gradlive::begin_pixels(st, x, y, button == 1);
                }
                return;
            }
            // pixels d'avant la forme : fond de la forme vivante (shape_edit::begin_new)
            if kind == 0 && matches!(st.tool, Tool::Shape | Tool::RoundRect | Tool::Line) {
                st.shape_base = Some((st.doc.layer().uid, st.doc.layer().px.clone()));
            }
            let mut o = opts(&app);
            // calque dynamique : sa zone se peint en gris (blanc = effet actif, noir = inactif)
            if st.doc.layer().dynamic.is_some() {
                editor::to_gray(&mut o.primary);
                editor::to_gray(&mut o.secondary);
            }
            let pen = pen::current();
            let tool = if pen.eraser && matches!(st.tool, Tool::Brush | Tool::Eraser | Tool::Pencil) { Tool::Eraser } else { st.tool };
            // Maj : contraintes (carré, 15°, trait droit, baguette globale) lues par les outils
            st.session.shift = _shift;
            let size = o.size;
            if tools::is_stroke(tool) { o.size *= pen.pressure.max(0.02); }
            let samples = if kind == 1 && st.session.busy() && tools::is_stroke(tool) {
                pen::points(x, y, app.get_zoom(), app.window().scale_factor())
            } else { vec![] };
            let outside = app.global::<ToolOpts>().get_outside_canvas();
            for (sx, sy, pressure) in samples {
                o.size = size * pressure.max(0.02);
                let outcome = if outside {
                    st.session.outside_pointer(tool, &mut st.doc, &o, 1, sx, sy, button == 1, ctrl, alt)
                        .unwrap_or_else(|| st.session.moved(tool, &mut st.doc, &o, sx, sy, false))
                } else { st.session.moved(tool, &mut st.doc, &o, sx, sy, false) };
                if let Outcome::Redraw(rect) = outcome { queue_paint_frame(&app, st, rect); }
            }
            if tools::is_stroke(tool) { o.size = size * pen.pressure.max(0.02); }
            let out = if let Some(out) = outside.then(|| st.session.outside_pointer(tool, &mut st.doc, &o, kind, x, y, button == 1, ctrl, alt)).flatten() {
                out
            } else {
                match kind {
                    0 => st.session.press(tool, &mut st.doc, &o, x, y, button == 1, ctrl, alt),
                    1 => st.session.moved(tool, &mut st.doc, &o, x, y, false),
                    _ => st.session.release(tool, &mut st.doc),
                }
            };
            if kind == 0 && tool == Tool::PolyLasso {
                app.set_overlay_path(poly_path(st, (x, y)));
            }
            let committed = matches!(out, Outcome::Commit(_));
            match out {
                Outcome::Redraw(rect) if tools::is_stroke(tool) => queue_paint_frame(&app, st, rect),
                out => handle_outcome(&app, st, out),
            }
            if kind == 2 && !committed {
                drop_empty_shape_layer(&app, st);
            } else if kind == 2 && st.shape_edit.is_none() {
                st.shape_layer_new = None;
            }
        });
    }
    {
        let weak = app.as_weak();
        app.on_tool_cursor_refresh(move || {
            thread_local! {
                static DEBOUNCE: slint::Timer = slint::Timer::default();
            }
            // zoom à la molette, curseur de taille : une seule image à la fin du geste
            let weak = weak.clone();
            DEBOUNCE.with(|t| {
                t.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(40), move || {
                    if let Some(app) = weak.upgrade() {
                        refresh_tool_cursor(&app);
                    }
                });
            });
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_canvas_double_click(move || {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let st = &mut *st;
            if st.doc.vector_mode {
                let (x, y) = st.last_press;
                vecedit::double_click(&app, st, x, y);
            }
            // double-clic de Slint : en secours (le double-clic est déjà mesuré à l'appui)
            if matches!(st.tool, Tool::PolyLasso | Tool::MagneticLasso) && st.session.tracing() {
                let o = opts(&app);
                let out = st.session.finish_trace(&mut st.doc, &o);
                app.set_overlay_path(SharedString::default());
                handle_outcome(&app, st, out);
            }
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_key_pressed(move |text, ctrl, shift, alt| handle_key(&weak.unwrap(), &state, &text, ctrl, shift, alt));
    }

    // ---- outils, menus, ruban ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_tool_selected(move |id| set_tool(&weak.unwrap(), &mut state.borrow_mut(), &id));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_menu_action(move |action, label| handle_action(&weak.unwrap(), &state, &action, &label));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_context_request(move |kind, _idx, x, y, ctrl| {
            // lasso polygonal / magnétique en cours : le clic droit le termine (pas de menu)
            if kind.as_str() == "canvas" && state.try_borrow().map_or(false, |st| st.session.tracing()) {
                return false;
            }
            let outside = state.try_borrow().map_or(false, |st| st.doc.layer().off.is_some());
            context_menu(&weak.unwrap(), &kind, x, y, ctrl, outside)
        });
    }

    // ---- outil Texte ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_text_edited(move |_| {
            let app = weak.unwrap();
            let missing = render_text(&app, &mut state.borrow_mut());
            if let Some(fi) = missing {
                ensure_font(&app, &state, fi);
            }
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_text_move(move |x, y| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            // décalage depuis le cadre affiché (le point d'ancrage diffère si le texte est centré)
            let (dx, dy) = (x - app.get_text_x(), y - app.get_text_y());
            if let Some(te) = st.text_edit.as_mut() {
                te.x = (te.x + dx).round();
                te.y = (te.y + dy).round();
            }
            render_text(&app, &mut st);
        });
    }
    {
        let names: Vec<SharedString> = state.borrow().fonts.names().into_iter().map(SharedString::from).collect();
        app.global::<FontList>().set_names(ModelRc::new(VecModel::from(names)));
        // web : aperçus des polices intégrées, puis téléchargement progressif des polices
        // MasterPaint (une à la fois, après le démarrage) pour afficher leur aperçu
        #[cfg(target_arch = "wasm32")]
        {
            let mut st = state.borrow_mut();
            for (i, name, _) in st.fonts.preview_sources() {
                let p = st.fonts.get(i).and_then(|f| text::preview(&f, &name));
                set_font_preview(&app, &mut st, i, p);
            }
            let todo: Vec<(usize, String)> = (0..st.fonts.entries.len()).filter_map(|i| st.fonts.web_path(i).map(|p| (i, p))).collect();
            drop(st);
            let weak = app.as_weak();
            let state = state.clone();
            slint::Timer::single_shot(std::time::Duration::from_secs(4), move || {
                let _ = slint::spawn_local(async move {
                    for (i, path) in todo {
                        let Some(bytes) = web::fetch_bytes(&path).await else { continue };
                        let Some(app) = weak.upgrade() else { return };
                        let Ok(mut st) = state.try_borrow_mut() else { continue };
                        if st.fonts.insert_loaded(i, &bytes) {
                            let name = st.fonts.entries[i].name.clone();
                            let p = st.fonts.get(i).and_then(|f| text::preview(&f, &name));
                            set_font_preview(&app, &mut st, i, p);
                        }
                    }
                });
            });
        }
        // polices du système : analyse en arrière-plan (bureau)
        #[cfg(not(target_arch = "wasm32"))]
        {
            let weak = app.as_weak();
            let state = state.clone();
            let (tx, rx) = std::sync::mpsc::channel();
            std::thread::spawn(move || {
                let _ = tx.send(text::scan_system_fonts());
            });
            let poll = slint::Timer::default();
            let poll = Rc::new(poll);
            let poll2 = poll.clone();
            poll.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(250), move || {
                let Ok(list) = rx.try_recv() else { return };
                poll2.stop();
                let Some(app) = weak.upgrade() else { return };
                let mut st = state.borrow_mut();
                st.fonts.add_system(list);
                start_font_previews(&app, &st);
                let names: Vec<SharedString> = st.fonts.names().into_iter().map(SharedString::from).collect();
                app.global::<FontList>().set_names(ModelRc::new(VecModel::from(names)));
                // police par défaut comme la version web : Segoe UI s'il est installé
                if app.global::<ToolOpts>().get_font_index() == 0 {
                    if let Some(i) = st.fonts.index_of("Segoe UI") {
                        app.global::<ToolOpts>().set_font_index(i as i32);
                    }
                }
            });
            std::mem::forget(poll);
        }
    }

    // ---- fenêtres d'effets ----
    // ---- fenêtre Couleurs surgissante (ColorPop) : mêmes calculs que la fenêtre Couleurs, sur
    // la couleur de la case cliquée ; chaque changement est appliqué à sa destination ----
    {
        fn pop_fields(app: &AppWindow) {
            let g = app.global::<ColorPop>();
            let c = g.get_color();
            let (h, s, v) = rgb_to_hsv(c.red(), c.green(), c.blue());
            g.set_comps(ModelRc::new(VecModel::from(vec![c.red() as f32, c.green() as f32, c.blue() as f32, c.alpha() as f32, h.round(), s.round(), v.round()])));
            g.set_hex(SharedString::from(format!("{:02X}{:02X}{:02X}", c.red(), c.green(), c.blue())));
        }
        let g = app.global::<ColorPop>();
        let weak = app.as_weak();
        g.on_sync(move || pop_fields(&weak.unwrap()));
        let weak = app.as_weak();
        g.on_changed(move |c| {
            let app = weak.unwrap();
            pop_fields(&app);
            let target = app.global::<ColorPop>().get_target();
            if let Some(n) = target.strip_prefix("appearance:").and_then(|n| n.parse::<i32>().ok()) {
                appearance::pick(&app, n, c);
                save_settings(&app);
            } else if let Some(n) = target.strip_prefix("effect:").and_then(|n| n.parse::<i32>().ok()) {
                app.invoke_effect_color_picked(n, c);
            } else if target == "paint:0" {
                // pastilles de la colonne d'outils (Photoshop) : couleur principale / secondaire
                app.set_primary_color(c);
            } else if target == "paint:1" {
                app.set_secondary_color(c);
            }
        });
        let weak = app.as_weak();
        g.on_wheel_picked(move |x, y, size| {
            let app = weak.unwrap();
            let g = app.global::<ColorPop>();
            let old = g.get_color();
            let c = if app.get_gray_palette() {
                [(x / size * 255.0).round().clamp(0.0, 255.0) as u8; 3]
            } else if app.get_colors_grid() {
                grid_color(x / size, y / size)
            } else {
                let r = size / 2.0;
                let (dx, dy) = (x - r, y - r);
                let s = ((dx * dx + dy * dy).sqrt() / r).min(1.0);
                let hue = (-dy).atan2(dx).to_degrees().rem_euclid(360.0);
                let v = rgb_to_hsv(old.red(), old.green(), old.blue()).2 / 100.0;
                hsv(hue, s, if v <= 0.0 { 1.0 } else { v })
            };
            let c = if app.get_gray_palette() { c } else { ColorMode::from_index(app.global::<MenuState>().get_color_mode()).convert(c) };
            g.set_color(Color::from_argb_u8(old.alpha(), c[0], c[1], c[2]));
        });
        let weak = app.as_weak();
        g.on_hsv_picked(move |h, sv, v| {
            let app = weak.unwrap();
            let g = app.global::<ColorPop>();
            let old = g.get_color();
            let n = hsv(h.rem_euclid(360.0), sv.clamp(0.0, 1.0), v.clamp(0.0, 1.0));
            g.set_color(Color::from_argb_u8(old.alpha(), n[0], n[1], n[2]));
        });
        let weak = app.as_weak();
        g.on_component_changed(move |i, v| {
            let app = weak.unwrap();
            let g = app.global::<ColorPop>();
            let c = g.get_color();
            let (mut r, mut gr, mut b, mut a) = (c.red(), c.green(), c.blue(), c.alpha());
            match i {
                0 => r = v as u8,
                1 => gr = v as u8,
                2 => b = v as u8,
                3 => a = v as u8,
                _ => {
                    let (mut h, mut s, mut vv) = rgb_to_hsv(r, gr, b);
                    match i {
                        4 => h = v,
                        5 => s = v,
                        _ => vv = v,
                    }
                    let n = hsv(h, s / 100.0, vv / 100.0);
                    (r, gr, b) = (n[0], n[1], n[2]);
                }
            }
            g.set_color(Color::from_argb_u8(a, r, gr, b));
        });
        let weak = app.as_weak();
        g.on_hex_edited(move |t| {
            let app = weak.unwrap();
            let g = app.global::<ColorPop>();
            if let Ok(v) = u32::from_str_radix(t.trim().trim_start_matches('#'), 16) {
                let a = g.get_color().alpha();
                g.set_color(Color::from_argb_u8(a, (v >> 16) as u8, (v >> 8) as u8, v as u8));
            }
        });
    }
    {
        // visionneuse d'icônes : onglet, recherche, aperçu sombre ; copier le nom, ouvrir en projet
        let weak = app.as_weak();
        app.on_icon_refresh(move || {
            let app = weak.unwrap();
            let missing = icon_packs::missing_count();
            app.set_icon_pack_missing(missing > 0);
            app.set_icon_pack_missing_count(missing as i32);
            let list = theme::icon_entries(&app, app.get_icon_tab(), app.get_icon_query().as_str(), app.get_icon_dark());
            let gallery = theme::icon_entries(&app, 0, "", app.global::<Theme>().get_dark()).into_iter().take(96).collect::<Vec<_>>();
            app.set_icon_pack_preview(ModelRc::new(VecModel::from(gallery)));
            // couleur ou thème changés : l'icône choisie reste choisie, recalculée
            let keep = usize::try_from(app.get_icon_sel()).ok().and_then(|k| app.get_icon_entries().row_data(k)).and_then(|e| list.iter().position(|n| n.name == e.name && n.kind == e.kind));
            app.set_icon_entries(ModelRc::new(VecModel::from(list)));
            app.set_icon_sel(keep.map_or(-1, |k| k as i32));
            if let Some(k) = keep {
                app.invoke_icon_preview(k as i32);
            }
        });
        let weak = app.as_weak();
        let state = state.clone();
        {
            let weak = weak.clone();
            app.on_icon_preview(move |i| {
                let app = weak.unwrap();
                if let Some(e) = usize::try_from(i).ok().and_then(|k| app.get_icon_entries().row_data(k)) {
                    app.set_icon_big(theme::icon_big(&app, e.name.as_str(), e.kind, app.get_icon_dark()));
                }
            });
        }
        app.on_icon_action(move |what, i| {
            let app = weak.unwrap();
            let Some(e) = app.get_icon_entries().row_data(i.max(0) as usize) else { return };
            match what.as_str() {
                "copy" => {
                    // comme la version HTML : classe Font Awesome ou identifiant du symbole
                    let id = match e.kind {
                        2 => format!("fa-{} fa-{}", if e.brands { "brands" } else { "solid" }, e.name),
                        0 => format!("illu-icon-mp-{}", e.name),
                        _ => format!("illu-icon-{}", e.name),
                    };
                    status(&app, if copy_text(&id) { i18n::tr_format!("« {id} » copié") } else { i18n::tr_format!("Nom : {id} (copie impossible ici)") });
                }
                "open" => {
                    let Some(svg) = theme::icon_svg(&app, e.name.as_str(), e.kind, app.get_icon_dark()) else {
                        return status(&app, "Seules les icônes MasterPaint s'ouvrent en projet SVG");
                    };
                    let mut st = state.borrow_mut();
                    open_svg(&app, &mut st, &format!("{}.svg", e.name), svg.as_bytes(), svg_import::SvgMode::Single, false);
                    app.set_show_icons(false);
                }
                _ => {}
            }
        });
    }
    {
        // réglages du ruban / couleur principale changés : la forme vivante les prend
        let weak = app.as_weak();
        let state = state.clone();
        app.on_shape_opts_changed(move || {
            let app = weak.unwrap();
            let Ok(mut st) = state.try_borrow_mut() else { return };
            shape_edit::opts_changed(&app, &mut st);
            vecedit::opts_changed(&app, &mut st);
            gradlive::render(&app, &mut st);
        });
    }
    // saisie hexadécimale des sélecteurs de couleur surgissants (ColorPopup)
    app.global::<ColorUtil>().on_parse_hex(|t| {
        let h = t.trim().trim_start_matches('#');
        match u32::from_str_radix(h, 16) {
            Ok(v) if h.len() == 6 => Color::from_rgb_u8((v >> 16) as u8, (v >> 8) as u8, v as u8),
            _ => Color::from_argb_u8(0, 0, 0, 0),
        }
    });
    {
        // fenêtre surgissante d'un champ couleur : même chemin que la saisie hexadécimale
        let weak = app.as_weak();
        app.on_effect_color_picked(move |i, c| {
            let app = weak.unwrap();
            app.invoke_effect_field_changed(i, 0.0, SharedString::from(format!("#{:02x}{:02x}{:02x}", c.red(), c.green(), c.blue())));
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_effect_field_changed(move |i, value, text| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let primary = app.get_primary_color();
            let i = i.max(0) as usize;
            let (dw, dh) = (st.doc.w, st.doc.h);
            let Some(es) = st.effect.as_mut() else { return };
            let Some(row) = es.rows.get(i).copied() else { return };
            // pipette : le prochain clic sur la toile choisit la couleur
            if text.as_str() == "pick" {
                es.pick = Some(i);
                status(&app, "Pipette : cliquez sur la toile pour choisir la couleur (Échap pour annuler)");
                return;
            }
            let full_rebuild = match row {
                RowRef::Head(sec) => {
                    if !es.folded.remove(sec) {
                        es.folded.insert(sec);
                    }
                    es.rows = build_rows(es);
                    app.set_effect_fields(ModelRc::new(VecModel::from(effect_rows(&app, es))));
                    return;
                }
                RowRef::Rgb(_) => {
                    let c = if text.as_str() == "primary" {
                        Some([primary.red(), primary.green(), primary.blue()])
                    } else {
                        u32::from_str_radix(text.trim().trim_start_matches('#'), 16).ok().filter(|_| text.trim().trim_start_matches('#').len() == 6).map(|v| [(v >> 16) as u8, (v >> 8) as u8, v as u8])
                    };
                    let Some(c) = c else { return };
                    set_row_color(es, i, c);
                    true
                }
                RowRef::Field(fi) => {
                    let f = &es.fields[fi];
                    let s = match f.kind {
                        2 => f.options.get(value as usize).map(|o| o.0.to_string()).unwrap_or_default(),
                        3 if text.is_empty() => format!("#{:02x}{:02x}{:02x}", primary.red(), primary.green(), primary.blue()),
                        3 => {
                            let Some(color) = effects::normalize_color(text.as_str()) else { return };
                            color
                        },
                        4 => text.to_string(),
                        _ => effects::fmt_num(value),
                    };
                    let id = f.id;
                    // bouton (kind 7, ex. « Auto » de l'incrustation) : action sur le calque
                    if f.kind == 7 {
                        if !effects::run_button(&es.id, id, &mut es.vals, &es.base, dw, dh) {
                            status(&app, "Aucune couleur détectée (pourtour transparent)");
                            return;
                        }
                        true
                    } else {
                        es.vals.0.insert(id.to_string(), s);
                        // préréglage (incrustation…) : d'autres champs changent, tout est redessiné
                        effects::apply_preset(&es.id, id, &mut es.vals)
                    }
                }
            };
            let rows = effect_rows(&app, es);
            let model = app.get_effect_fields();
            if full_rebuild {
                app.set_effect_fields(ModelRc::new(VecModel::from(rows)));
            } else {
                // mise à jour en place (le glisser en cours continue) : la jauge, l'aperçu d'une
                // couleur et les dégradés R / V / B suivent
                for (j, r) in rows.into_iter().enumerate() {
                    if j < model.row_count() {
                        model.set_row_data(j, r);
                    }
                }
            }
            // aperçu différé : recalcul seulement quand le curseur se pose
            let timer = st.effect_timer.clone();
            drop(st);
            let weak2 = app.as_weak();
            let state2 = state.clone();
            timer.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(90), move || {
                if let (Some(app), Ok(mut st)) = (weak2.upgrade(), state2.try_borrow_mut()) {
                    preview_effect(&app, &mut st);
                }
            });
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_effect_ok(move || {
            let app = weak.unwrap();
            let (big, title) = {
                let st = state.borrow();
                (
                    st.doc.w * st.doc.h >= 4_000_000 && st.effect.as_ref().is_some_and(|e| e.shown != e.want || e.running || e.partial || e.lod > 1 || !e.others.is_empty()),
                    st.effect.as_ref().map(|e| e.title.clone()).unwrap_or_default(),
                )
            };
            if !big {
                return commit_effect(&app, &mut state.borrow_mut());
            }
            // grande image : le calcul final prend du temps, une fenêtre d'attente est d'abord
            // peinte, puis l'effet est appliqué au tour suivant de la boucle ; elle reste
            // affichée (interface bloquée) jusqu'au dernier calque calculé (begin_busy de
            // commit_effect, refermée par apply_next)
            begin_busy(&app, &i18n::tr_format!("Application de « {title} »"), "Calcul sur l'image entière…", true);
            let (weak, state) = (weak.clone(), state.clone());
            slint::Timer::single_shot(std::time::Duration::from_millis(80), move || {
                let Some(app) = weak.upgrade() else { return };
                if let Ok(mut st) = state.try_borrow_mut() {
                    commit_effect(&app, &mut st);
                }
                end_busy(&app);
            });
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_effect_cancel(move || cancel_effect(&weak.unwrap(), &mut state.borrow_mut()));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_effect_remove(move || remove_dynamic_effect(&weak.unwrap(),&mut state.borrow_mut()));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_effect_reset(move || {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let Some(es) = st.effect.as_mut() else { return };
            es.vals = effects::Vals::defaults(es.fields);
            let rows = effect_rows(&app, es);
            app.set_effect_fields(ModelRc::new(VecModel::from(rows)));
            preview_effect(&app, &mut st);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.global::<Actions>().on_ribbon(move |id| handle_ribbon(&weak.unwrap(), &state, &id));
        // clic droit sur un bouton du ruban : Aimantation → bascule et réglages
        let weak2 = app.as_weak();
        app.global::<Actions>().on_ribbon_context(move |id, x, y| {
            if id.as_str() == "ribbon-snap-toggle" {
                if let Some(app) = weak2.upgrade() {
                    context_menu(&app, "snap", x, y, false, false);
                }
            }
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_quick_action(move |id| {
            let app = weak.unwrap();
            // aucun projet ouvert : boutons qui touchent l'image sans effet (message)
            const NO_DOC: [&str; 21] = ["credits-paintdotjs", "credits-paintjs", "credits-paintnet", "credits-openpdn", "credits-photocraft", "credits-artcraft", "credits-storytold", "signaler-un-bug", "illu-tb-new", "illu-tb-open", "illu-tb-print", "open-author", "open-github", "restart-app", "tech-info", "crash-test", "clear-autosave", "open-changelog", "open-example", "icon-viewer", "clear-history-all"];
            if state.borrow().empty && !NO_DOC.contains(&id.as_str()) && !id.starts_with("opt-") {
                status(&app, "Aucun projet ouvert : créez une nouvelle image ou ouvrez un fichier");
                return;
            }
            match id.as_str() {
                "pdn-cut" => {
                    let mut st = state.borrow_mut();
                    if st.doc.sel.is_some() && copy(&app, &mut st) {
                        st.doc.erase_selection();
                        st.doc.commit("Couper la sélection");
                        refresh_all(&app, &mut st);
                    } else { status(&app, "Sélectionnez une zone avant de la couper"); }
                }
                "opt-sel-copy-ribbon" | "opt-sel-paste-ribbon" | "opt-sel-pixelgrid" | "opt-sel-rulers" => handle_ribbon(&app, &state, &id),
                "pdn-deselect" => set_tool(&app, &mut state.borrow_mut(), "btn-deselect"),
                "illu-tb-new" => {
                    let st = state.borrow();
                    show_new_project(&app, &st);
                }
                "illu-tb-open" => open_file(&app, &state),
                "illu-tb-save" => show_export(&app, &state.borrow()),
                "illu-tb-print" => status(&app, "Impression : exportez l'image puis imprimez-la depuis votre visionneuse"),
                "illu-tb-undo" => {
                    let mut st = state.borrow_mut();
                    st.doc.undo();
                    refresh_all(&app, &mut st);
                }
                "illu-tb-redo" => {
                    let mut st = state.borrow_mut();
                    st.doc.redo();
                    refresh_all(&app, &mut st);
                }
                "illu-tb-zoom-in" => {
                    let max = if state.borrow().doc.vector_mode { 640.0 } else { 32.0 };
                    app.set_zoom((app.get_zoom() * 1.25).min(max));
                }
                "illu-tb-zoom-out" => app.set_zoom((app.get_zoom() / 1.25).max(0.05)),
                "illu-tb-zoom-fit-row1" => app.invoke_zoom_fit(),
                "credits-paintdotjs" => { let _ = webbrowser::open("https://github.com/LabyStudio/paintdotjs"); }
                "credits-paintjs" => { let _ = webbrowser::open("https://paintjs.net/"); }
                "credits-paintnet" => { let _ = webbrowser::open("https://paint.net/"); }
                "credits-openpdn" => { let _ = webbrowser::open("https://github.com/rivy/OpenPDN"); }
                "credits-photocraft" => { let _ = webbrowser::open("https://github.com/storytold/photocraft"); }
                "credits-artcraft" => { let _ = webbrowser::open("https://getartcraft.com/apps"); }
                "credits-storytold" => { let _ = webbrowser::open("https://github.com/storytold"); }
                "open-author" => {
                    let _ = webbrowser::open("https://polocrafting.fr/");
                }
                "open-github" => {
                    let _ = webbrowser::open("https://github.com/Polocrafting367/MasterPaint");
                }
                "restart-app" => {
                    // sauvegarde automatique d'abord (projets restaurés au redémarrage)
                    if let Ok(mut st) = state.try_borrow_mut() {
                        autosave(&mut st, true);
                    }
                    // web : l'écriture IndexedDB est asynchrone, rechargement un peu après
                    #[cfg(target_arch = "wasm32")]
                    slint::Timer::single_shot(std::time::Duration::from_millis(700), || {
                        if let Some(w) = web_sys::window() {
                            let _ = w.location().reload();
                        }
                    });
                    #[cfg(not(target_arch = "wasm32"))]
                    if let Ok(exe) = std::env::current_exe() {
                        let args: Vec<String> = std::env::args().skip(1).collect();
                        if std::process::Command::new(exe).args(args).spawn().is_ok() {
                            std::process::exit(0);
                        }
                    }
                }
                "clear-history" | "clear-history-all" => {
                    let mut st = state.borrow_mut();
                    let st = &mut *st;
                    finish_edits(&app, st);
                    st.doc.clear_history();
                    if id.as_str() == "clear-history-all" {
                        for d in st.tabs.iter_mut().flatten() {
                            d.clear_history();
                        }
                    }
                    refresh_all(&app, st);
                    refresh_tech_info(&app, st);
                    status(&app, if id.as_str() == "clear-history-all" { "Historique de tous les onglets vidé" } else { "Historique de l'onglet vidé" });
                }
                "tech-info" => refresh_tech_info(&app, &state.borrow()),
                "copy-diagnostics" => {
                    refresh_tech_info(&app, &state.borrow());
                    let rows = app.get_diagnostic_rows();
                    let text = (0..rows.row_count()).filter_map(|i| rows.row_data(i)).map(|r| format!("{}: {}", r.label, r.value)).collect::<Vec<_>>().join("\n");
                    status(&app, if copy_text(&text) { "Diagnostic copié dans le presse-papiers" } else { "Copie du diagnostic indisponible" });
                }
                // Paramètres › Avancé : aperçu de la fenêtre de plantage (sans arrêter l'application)
                "crash-test" => {
                    let msg = i18n::tr_format!("Essai de la fenêtre de plantage (Paramètres › Avancé) — MasterPaint {APP_VERSION}");
                    #[cfg(target_arch = "wasm32")]
                    {
                        let shown = web_sys::window().and_then(|w| {
                            let f = js_sys::Reflect::get(&w, &"mpReportError".into()).ok()?;
                            let f = wasm_bindgen::JsCast::dyn_ref::<js_sys::Function>(&f)?.clone();
                            let args = js_sys::Array::of3(&msg.clone().into(), &true.into(), &true.into());
                            f.apply(&w, &args).ok()
                        });
                        if shown.is_none() {
                            show_error(&app, "Fenêtre de plantage", "La page ne fournit pas de fenêtre de plantage (mpReportError).");
                        }
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    show_error(&app, "MasterPaint s'est arrêté (essai)", &msg);
                }
                "clear-autosave" => {
                    clear_autosave();
                    status(&app, "Sauvegarde automatique effacée");
                }
                "open-changelog" => {
                    app.set_changelog_text(SharedString::from(include_str!("../../../changelog.txt")));
                    app.set_show_changelog(true);
                }
                "open-example" => {
                    // projet d'exemple de la version web (IMG/start.illu) dans un nouvel onglet :
                    // lu sur le site dans le navigateur, embarqué dans l'application (2,6 Mo)
                    app.set_show_settings(false);
                    #[cfg(target_arch = "wasm32")]
                    {
                        let weak = app.as_weak();
                        let state = state.clone();
                        status(&app, "Chargement du projet d'exemple…");
                        let _ = slint::spawn_local(async move {
                            let bytes = web::fetch_bytes("/IMG/start.illu").await;
                            let Some(app) = weak.upgrade() else { return };
                            match bytes {
                                Some(b) => load_bytes(&app, &state, "Projet d'exemple.illu", b),
                                None => status(&app, "Projet d'exemple introuvable sur le site"),
                            }
                        });
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    load_bytes(&app, &state, "Projet d'exemple.illu", include_bytes!("../../../IMG/start.illu").to_vec());
                }
                "icon-viewer" => open_icon_viewer(&app),
                _ => {
                    // même fenêtre partout (avant, une fenêtre HTML à part dans le navigateur)
                    app.set_contact_message(SharedString::default());
                    let journal = state.try_borrow().map(|st| format!("{}\n\n{}", tech_info(&app, &st), applog::tail(30))).unwrap_or_default();
                    app.set_contact_journal(journal.into());
                    app.set_contact_with_journal(true);
                    app.set_show_contact(true);
                }
            }
        });
    }

    // ---- frise du mode Animation ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_anim_action(move |a| anim_action(&weak.unwrap(), &mut state.borrow_mut(), &a));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_anim_cell(move |l, f| anim_cell(&weak.unwrap(), &mut state.borrow_mut(), l, f));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_anim_cell_op(move |op, l, f| anim_cell_op(&weak.unwrap(), &mut state.borrow_mut(), &op, l, f));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_anim_set(move |k, v| anim_set(&weak.unwrap(), &mut state.borrow_mut(), &k, v));
    }
    {
        let weak=app.as_weak();let state=state.clone();
        app.on_applied_fx_open(move |i| {
            let app=weak.unwrap();let mut st=state.borrow_mut();
            finish_edits(&app,&mut st);
            st.doc.active=(i.max(0) as usize).min(st.doc.layers.len()-1);
            app.set_applied_fx_uid(st.doc.layer().uid.to_string().into());
            refresh_all(&app,&mut st);app.set_show_applied_fx(true);sync_applied_fx(&app,&st);
        });
    }
    {
        let weak=app.as_weak();let state=state.clone();
        app.on_applied_fx_action(move |i,what|applied_fx_action(&weak.unwrap(),&mut state.borrow_mut(),i.max(0) as usize,&what));
    }
    {
        let weak=app.as_weak();let state=state.clone();
        app.on_applied_fx_value(move |i,quick,value,commit|applied_fx_value(&weak.unwrap(),&mut state.borrow_mut(),i.max(0) as usize,quick,value,commit));
    }

    {
        let weak=app.as_weak();let state=state.clone();
        app.on_applied_fx_scope(move |mode| {
            let app=weak.unwrap();let mut st=state.borrow_mut();
            layer_op(&app,&mut st,if mode==2 {"dynamic-everywhere"}else{"dynamic-mask"});
            sync_applied_fx(&app,&st);
        });
    }
    {
        let weak=app.as_weak();let state=state.clone();
        app.on_applied_fx_zone_toggle(move || {
            let app=weak.unwrap();let mut st=state.borrow_mut();layer_op(&app,&mut st,"dynamic-mask-view");sync_applied_fx(&app,&st);
        });
    }
    // panneau « Objets SVG (bêta) »
    svg_panel::wire(&app, &state);

    // ---- onglets (multi-projet) ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_tab_clicked(move |i| switch_tab(&weak.unwrap(), &mut state.borrow_mut(), i.max(0) as usize));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_tab_close(move |i| request_close_tab(&weak.unwrap(), &mut state.borrow_mut(), i.max(0) as usize));
    }
    // ---- calques ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_clicked(move |i| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            drop_floating(&app, &mut st);
            st.doc.active = (i.max(0) as usize).min(st.doc.layers.len() - 1);
            // Selecting a layer leaves effect editing in the normal Effects menu.
            // A different layer's mask inspection is closed.
            let uid = st.doc.layer().uid;
            if editor::DYN_ZONE_VIEW.load(std::sync::atomic::Ordering::Relaxed) != uid {
                editor::DYN_ZONE_VIEW.store(0, std::sync::atomic::Ordering::Relaxed);
            }
            refresh_all(&app, &mut st);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_drag(move |from_row, to_row| {
            // la liste affiche le calque du dessus en premier
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            drop_floating(&app, &mut st);
            // lignes affichées (dossiers : retrait, contenu replié caché)
            st.doc.drop_row(from_row.max(0) as usize, to_row.max(0) as usize);
            st.doc.commit("Déplacer le calque");
            refresh_all(&app, &mut st);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_visibility(move |i, v| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            if let Some(l) = st.doc.layers.get_mut(i as usize) {
                l.visible = v;
            }
            st.doc.commit(if v { "Afficher le calque" } else { "Masquer le calque" });
            refresh_all(&app, &mut st);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_props(move |opacity, blend| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let l = st.doc.layer_mut();
            let moved = (l.opacity - (opacity / 100.0).clamp(0.0, 1.0)).abs() > 1e-4;
            l.opacity = (opacity / 100.0).clamp(0.0, 1.0);
            l.blend = Blend::from_index(blend);
            let (w, h) = (st.doc.w, st.doc.h);
            let st = &mut *st;
            // curseur d'opacité sous des filtres ƒ : brouillon pendant le glisser
            if moved && st.doc.layers[st.doc.active + 1..].iter().any(|l| l.dynamic.is_some()) {
                note_gesture(&app);
            }
            refresh_rect(&app, st, Some((0, 0, w, h)));
            // historique : mode de fusion aussitôt, opacité en fin de geste (pas une étape par cran)
            let (op, bl) = (st.doc.layer().opacity, st.doc.layer().blend);
            let saved = st.doc.history.get(st.doc.hindex).and_then(|s| s.layers.get(st.doc.active)).map(|l| (l.opacity, l.blend));
            if let Some((sop, sbl)) = saved {
                if sbl != bl {
                    st.doc.commit("Mode de fusion du calque");
                    refresh_all(&app, st);
                } else if (sop - op).abs() > 1e-4 {
                    schedule_opacity_commit(&app);
                }
            }
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_action(move |a| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            layer_op(&app, &mut st, a.as_str());
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_toggle(move |i, what| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let st = &mut *st;
            let Some(l) = st.doc.layers.get_mut(i.max(0) as usize) else { return };
            match what.as_str() {
                // replier un dossier : affichage seul, pas d'étape d'historique
                "collapse" => {
                    l.collapsed = !l.collapsed;
                    sync_panels(&app, st);
                }
                "lock" => {
                    l.locked = !l.locked;
                    let label = if l.locked { "Verrouiller le calque" } else { "Déverrouiller le calque" };
                    st.doc.commit(label);
                    refresh_all(&app, st);
                }
                // badge « fx » d'un calque texte : liste de ses effets
                "text-fx" => {
                    st.doc.active = i.max(0) as usize;
                    layer_op(&app, st, "text-fx");
                    sync_panels(&app, st);
                }
                _ => {}
            }
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_text_fx_action(move |i, what| text_fx_action(&weak.unwrap(), &mut state.borrow_mut(), i.max(0) as usize, what.as_str()));
    }

    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_rename(move |i| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let Some(l) = st.doc.layers.get(i.max(0) as usize) else { return };
            let name = l.name.clone();
            st.rename_index = i.max(0) as usize;
            prompt(&app, "rename", "Renommer le calque", "Nom du calque", &name);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_alpha(move |i, remove| layer_alpha(&weak.unwrap(), &mut state.borrow_mut(), i.max(0) as usize, remove));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_layer_filter_toggle(move |i| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let st = &mut *st;
            drop_floating(&app, st);
            st.doc.active = (i.max(0) as usize).min(st.doc.layers.len() - 1);
            if st.doc.locked_at(st.doc.active) || st.doc.layer().group { return; }
            let layer = st.doc.layer_mut();
            if let Some(stack) = layer.dynamic.take() {
                layer.dyn_saved = stack;
            } else {
                let first = layer.dyn_saved.is_empty();
                layer.dynamic = Some(std::mem::take(&mut layer.dyn_saved));
                if first { layer.dynamic_mode = 2; }
            }
            layer.dyn_cache = None;
            layer.dyn_low = None;
            let uid = layer.uid;
            dyn_invalidate(st, uid);
            st.doc.commit("Filtre dynamique");
            refresh_all(&app, st);
            // Effects and parameters are reached from their ordinary menu windows.
        });
    }
    {
        let state = state.clone();
        let language_state = state.clone();
        let language_app = app.as_weak();
        app.on_language_chosen(move |i| {
            apply_language(i);
            let app = language_app.unwrap();
            let mut st = language_state.borrow_mut();
            st.history_shown = 0;
            let tools = app.global::<Generated>().get_tools();
            let current = app.get_current_tool();
            let titles: Vec<_> = (0..tools.row_count()).filter_map(|i| tools.row_data(i)).map(|t| t.3).collect();
            let title = (0..tools.row_count()).filter_map(|i| tools.row_data(i)).find(|t| t.2 == current).map(|t| t.3).unwrap_or_default();
            app.set_tool_titles(ModelRc::new(VecModel::from(titles)));
            app.set_tool_title(title);
            app.set_menus(if app.get_pm_open() { photo_menus() } else { menus_with_status(&app) });
            refresh_all(&app, &mut st);
            sync_text_fx(&app, &st);
            if let Some(es) = st.effect.as_ref() {
                app.set_effect_title(i18n::tr(&es.title).into());
                app.set_effect_fields(ModelRc::new(VecModel::from(effect_rows(&app, es))));
            }
            app.set_pm_presets(ModelRc::new(VecModel::from(photo::preset_names().into_iter().map(|n| SharedString::from(i18n::tr(n))).collect::<Vec<_>>())));
            let rows = settings::SHORTCUTS.iter().map(|(k, w)|
                (SharedString::from(i18n::tr(k)), SharedString::from(i18n::tr(w)))).collect::<Vec<_>>();
            app.set_shortcut_list(ModelRc::new(VecModel::from(rows)));
            app.set_status_text(SharedString::default());
        });
    }

    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_curves_pointer(move |kind, x, y, right| curves_pointer(&weak.unwrap(), &state, kind, x, y, right));
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_curves_action(move |a, i| curves_action(&weak.unwrap(), &mut state.borrow_mut(), &a, i.max(0) as usize));
    }

    // ---- historique, couleurs, thème ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_history_picked(move |i| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            drop_floating(&app, &mut st);
            st.doc.goto(i as usize);
            refresh_all(&app, &mut st);
        });
    }
    {
        let weak = app.as_weak();
        app.on_wheel_picked(move |x, y, size, secondary| {
            let app = weak.unwrap();
            let old = if secondary { app.get_secondary_color() } else { app.get_primary_color() };
            let c = if app.get_gray_palette() {
                let v=(x/size*255.0).round().clamp(0.0,255.0) as u8;
                [v;3]
            } else if app.get_colors_grid() {
                // grille teinte × luminosité (espace imposé)
                grid_color(x / size, y / size)
            } else {
                // roue : teinte et saturation ; valeur gardée (noir → 1), comme Paint.NET
                let r = size / 2.0;
                let (dx, dy) = (x - r, y - r);
                let s = ((dx * dx + dy * dy).sqrt() / r).min(1.0);
                let hue = (-dy).atan2(dx).to_degrees().rem_euclid(360.0);
                let v = rgb_to_hsv(old.red(), old.green(), old.blue()).2 / 100.0;
                hsv(hue, s, if v <= 0.0 { 1.0 } else { v })
            };
            // la couleur prise est celle affichée (roue et grille filtrées par l'espace du projet)
            let c = if app.get_gray_palette() {c} else {ColorMode::from_index(app.global::<MenuState>().get_color_mode()).convert(c)};
            let col = Color::from_argb_u8(old.alpha(), c[0], c[1], c[2]);
            if secondary {
                app.set_secondary_color(col);
            } else {
                app.set_primary_color(col);
            }
        });
    }
    {
        let weak = app.as_weak();
        app.on_settings_reset(move |page| {
            let app = weak.unwrap();
            let d = settings::Settings::default();
            match page {
                // Apparence (l'essentiel)
                0 => {
                    app.set_toolbar_mode(d.toolbar_mode);
                    app.set_set_theme_style(d.theme_style);
                    app.set_set_interface_theme(0);
                    app.set_set_follow_interface_style(d.follow_interface_style);
                    app.set_set_icon_pack(0); icon_packs::select(0);
                    app.set_set_pronounced_borders(d.pronounced_borders);
                    app.set_icon_pack_catalog(ModelRc::new(VecModel::from(icon_packs::catalog(0))));
                    app.set_set_rounded(d.rounded);
                    app.set_set_glass(d.glass);
                    app.set_set_header_preview(d.header_preview);
                    app.set_set_layout(d.layout);
                    app.set_set_layout_auto(d.layout_auto);
                    let a = Color::from_rgb_u8((d.accent >> 16) as u8, (d.accent >> 8) as u8, d.accent as u8);
                    app.invoke_apply_theme(d.dark, a);
                    app.invoke_zoom_fit();
                }
                // Toile et outils : damier, couleurs, navigation
                1 => {
                    appearance::initialize(&app, &d);
                    app.set_set_default_zoom(d.default_zoom);
                    let tools = app.global::<Generated>().get_tools();
                    app.set_set_default_tool(tools.iter().position(|t| t.2 == d.default_tool.as_str()).unwrap_or(0) as i32);
                    app.set_set_wheel_mode(d.wheel_scroll as i32);
                    app.set_set_zoom_smooth(d.zoom_smooth);
                }
                2 => {
                    app.set_set_paste_mode(d.paste_mode);
                    app.set_set_paste_ask(d.paste_ask);
                    app.set_set_history_max(d.history_max as f32);
                    app.set_set_history_keep(d.history_keep as f32);
                }
                3 => {
                    app.set_set_use_gpu(d.use_gpu);
                    GPU_ALLOWED.store(d.use_gpu, std::sync::atomic::Ordering::Relaxed);
                    app.set_set_perf_mode(d.perf_mode);
                    app.set_set_render_scale(d.render_scale);
                    app.set_set_render_ctl(d.render_ctl);
                    app.set_set_render_default(d.render_default);
                    app.set_set_perf_done(d.perf_done);
                    app.set_set_perf_cut(d.perf_cut);
                    app.set_set_perf_reported(d.perf_reported);
                    app.invoke_settings_changed();
                }
                // Personnalisation : style, disposition, taille, effets visuels
                9 => {
                    app.set_set_theme_style(d.theme_style);
                    app.set_set_pronounced_borders(d.pronounced_borders);
                    app.set_set_follow_interface_style(d.follow_interface_style);
                    app.set_set_layout_auto(d.layout_auto);
                    app.set_set_title_transparent(d.title_transparent);
                    app.set_set_shadows(d.shadows);
                    app.set_set_hover_fx(d.hover_fx);
                    let t = app.global::<Theme>();
                    app.invoke_apply_theme(t.get_dark(), t.get_accent_base());
                    app.set_set_ui_zoom(d.ui_zoom);
                    apply_ui_zoom(&app, d.ui_zoom);
                    app.invoke_settings_changed();
                }
                4 => {
                    app.set_set_autosave(d.autosave);
                    app.set_set_autosave_min(d.autosave_min as f32);
                    AUTOSAVE_ON.store(d.autosave, std::sync::atomic::Ordering::Relaxed);
                }
                _ => return,
            }
            save_settings(&app);
            status(&app, "Réglages de la section remis à leurs valeurs d'origine");
        });
    }
    {
        let weak = app.as_weak();
        app.on_data_action(move |action| {
            let Some(app) = weak.upgrade() else { return };
            match action.as_str() {
                "purge-request" => app.set_show_purge_confirm(true),
                "purge-confirmed" => {
                    DATA_PURGED.store(true, std::sync::atomic::Ordering::Relaxed);
                    AUTOSAVE_ON.store(false, std::sync::atomic::Ordering::Relaxed);
                    AUTOSAVE_FORCE.store(false, std::sync::atomic::Ordering::Relaxed);
                    clear_autosave();
                    settings::Settings::clear_storage();
                    #[cfg(target_arch = "wasm32")]
                    web::clear_all_data();
                    app.set_show_settings(false);
                    app.set_show_purge_complete(true);
                }
                "purge-restart" => {
                    #[cfg(target_arch = "wasm32")]
                    slint::Timer::single_shot(std::time::Duration::from_millis(500), || {
                        if let Some(w) = web_sys::window() { let _ = w.location().reload(); }
                    });
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        if let Ok(exe) = std::env::current_exe() {
                            let args: Vec<String> = std::env::args().skip(1).collect();
                            let _ = std::process::Command::new(exe).args(args).spawn();
                        }
                        std::process::exit(0);
                    }
                }
                "purge-leave" => {
                    app.set_show_purge_complete(false);
                    #[cfg(target_arch = "wasm32")]
                    if let Some(w) = web_sys::window() { let _ = w.location().set_href("https://polocrafting.fr/"); }
                    #[cfg(not(target_arch = "wasm32"))]
                    { let _ = webbrowser::open("https://polocrafting.fr/"); std::process::exit(0); }
                }
                "reset-all-settings" => {
                    for page in [0, 1, 2, 3, 4, 9] { app.invoke_settings_reset(page); }
                    app.set_set_snap_div(48.0);
                    app.set_set_snap_thresh(50.0);
                    app.set_set_snap_always(false);
                    app.set_set_snap_guides(true);
                    app.set_set_missing_icon_fallback(0);
                    icon_packs::set_missing_fallback(0);
                    app.set_set_follow_interface_style(true);
                    app.set_icon_pack_catalog(ModelRc::new(VecModel::from(icon_packs::catalog(0))));
                    save_settings(&app);
                    status(&app, "Tous les paramètres ont été réinitialisés sans redémarrer");
                }
                _ => {}
            }
        });
    }
    {
        let weak = app.as_weak();
        app.on_ui_resized(move || {
            if UI_ZOOM.with(|u| (u.get() - 1.0).abs() > 0.001) {
                fit_ui_zoom_size(&weak.unwrap());
            }
        });
    }
    {
        let weak = app.as_weak();
        app.on_apply_ui_zoom(move |z| {
            let app = weak.unwrap();
            apply_ui_zoom(&app, z);
            save_settings(&app);
        });
    }
    {
        let weak = app.as_weak();
        app.on_select_interface_style(move |i| {
            let app = weak.unwrap();
            let was_phone=app.get_phone();
            let i=i.clamp(0,3);
            app.set_set_interface_theme(i);
            // Les dispositions Paint.NET et Photoshop utilisent leur barre d'options compacte;
            // le mode MasterPaint reprend son ruban. Les préférences d'icônes/couleurs restent
            // pilotées séparément par « appliquer les réglages conseillés ».
            app.set_toolbar_mode(if i == 0 { 0 } else { 1 });
            app.set_set_layout(match i { 1 => 0, 2 => 1, 3 => 2, _ => 0 });
            // PaintJS choisit les outils depuis le sélecteur de la barre d’options, pas depuis
            // une palette séparée. Les autres thèmes gardent leur palette d’outils.
            // paintdotjs montre aussi la palette Outils (deux colonnes) ; seul le téléphone la cache
            app.set_show_tools(i != 3);
            if app.get_set_follow_interface_style() {
                let pack = match i.clamp(0, 3) { 1 => 1, 2 => 2, _ => 0 };
                // coins arrondis : MasterPaint et Photoshop (PhotoCraft arrondit ses contrôles) ;
                // Paint.NET reste carré comme paintdotjs
                app.set_set_rounded(i == 0 || i == 2);
                app.set_set_pronounced_borders(i == 1 || i == 2);
                // couleur d'accentuation de la référence (bleu Paint.NET, bleu PhotoCraft), modifiable
                // ensuite ; seul Photoshop (PhotoCraft) passe en sombre. En le quittant, le thème
                // choisi avant revient : Paint.NET et MasterPaint ne restent pas sombres d'office.
                let user_dark = USER_DARK.load(std::sync::atomic::Ordering::Relaxed) == 2;
                let accent = match i { 1 => Color::from_rgb_u8(0x03, 0x69, 0xa1), 2 => Color::from_rgb_u8(0x1d, 0x4e, 0xd8), _ => app.global::<Theme>().get_accent_base() };
                app.invoke_apply_theme(if i == 2 { true } else { user_dark }, accent);
                app.set_set_icon_pack(pack);
                icon_packs::select(pack);
                app.set_icon_pack_catalog(ModelRc::new(VecModel::from(icon_packs::catalog(pack))));
                app.invoke_icon_refresh();
            }
            if i != 3 && app.window().size().width as f32 / app.window().scale_factor() < 600.0 { app.set_set_layout_auto(false); }
            if was_phone != app.get_phone() { set_phone_panels(&app,app.get_phone()); }
            app.invoke_zoom_fit();
            let t=app.global::<Theme>();
            theme::apply(&app,t.get_dark(),t.get_accent_base());
            save_settings(&app);
        });
        let weak = app.as_weak();
        app.on_icon_pack_action(move |action| {
            let app=weak.unwrap();
            let action=action.to_string();
            if action == "fallback" {
                icon_packs::set_missing_fallback(app.get_set_missing_icon_fallback());
                let t=app.global::<Theme>(); theme::apply(&app,t.get_dark(),t.get_accent_base());
                app.invoke_icon_refresh(); save_settings(&app); return;
            }
            if action == "import" {
                let weak=app.as_weak();
                let task=async move {
                    #[cfg(target_arch="wasm32")]
                    let files = { let Some(files)=web::pick_files(".zip,.json,.png,.jpg,.jpeg,.svg,application/zip,application/json,image/*").await else { return }; files };
                    #[cfg(all(not(target_arch="wasm32"), target_os="android"))]
                    let files = { let Some(files)=rfd::AsyncFileDialog::new().pick_files().await else {return}; let mut v=Vec::new(); for f in files {v.push((f.file_name(), f.read().await));} v };
                    #[cfg(all(not(target_arch="wasm32"), not(target_os="android")))]
                    let files = { let Some(files)=rfd::AsyncFileDialog::new().add_filter("Packs et icônes", &["zip","json","png","jpg","jpeg","svg"]).pick_files().await else {return}; let mut v=Vec::new(); for f in files {v.push((f.file_name(), f.read().await));} v };
                    let Some(app)=weak.upgrade() else {return};
                    match icon_packs::import_files(files) {
                        Ok((name,_)) => { app.set_set_icon_pack(3); icon_packs::select(3); app.set_icon_pack_catalog(ModelRc::new(VecModel::from(icon_packs::catalog(3)))); let t=app.global::<Theme>(); theme::apply(&app,t.get_dark(),t.get_accent_base()); app.invoke_icon_refresh(); save_settings(&app); status(&app,format!("Pack importé : {name}")); ask_icon_fallback(&app); }
                        Err(e) => show_error(&app,"Importer un pack",&e),
                    }
                };
                let _=slint::spawn_local(task); return;
            }
            if let Some((verb,id))=action.split_once(':') {
                let mut parts=id.split(':'); let kind=parts.next().unwrap_or(""); let index=parts.next().and_then(|s|s.parse::<usize>().ok()).unwrap_or(0);
                match (verb,kind) {
                    ("select","builtin") if index<3 => { app.set_set_icon_pack(index as i32); }
                    ("select","custom") => { icon_packs::select_custom(index); app.set_set_icon_pack(3); }
                    ("export","builtin") if index<3 => { let name=["masterpaint","paintjs","photocraft"][index]; offer_file(&app,&format!("masterpaint-{name}-icons.zip"),"Pack d'icônes","zip","application/zip",icon_packs::export_zip(index as i32)); }
                    ("export","custom") => { let previous=icon_packs::active_custom_index(); icon_packs::select_custom(index); offer_file(&app,"masterpaint-pack-importe.zip","Pack d'icônes importé","zip","application/zip",icon_packs::export_zip(3)); icon_packs::select_custom(previous); }
                    ("export-json","builtin") if index<3 => { let name=["masterpaint","paintjs","photocraft"][index]; offer_file(&app,&format!("masterpaint-{name}-icons.json"),"Pack d'icônes","json","application/json",icon_packs::export_json(index as i32)); }
                    ("export-json","custom") => { let previous=icon_packs::active_custom_index(); icon_packs::select_custom(index); offer_file(&app,"masterpaint-pack-importe.json","Pack d'icônes importé","json","application/json",icon_packs::export_json(3)); icon_packs::select_custom(previous); }
                    ("delete","custom") => { icon_packs::delete_custom(index); if icon_packs::all_custom().as_array().is_none_or(|a|a.is_empty()){app.set_set_icon_pack(0);icon_packs::select(0);}else if app.get_set_icon_pack()==3 {icon_packs::select(3);} }
                    ("source",_) => { if let Some(url)=icon_packs::github_source(id) { let _=webbrowser::open(&url); } }
                    _ => {}
                }
                if verb=="select" { icon_packs::select(app.get_set_icon_pack()); let t=app.global::<Theme>();theme::apply(&app,t.get_dark(),t.get_accent_base());app.invoke_icon_refresh(); ask_icon_fallback(&app); }
                if verb=="delete" { let t=app.global::<Theme>();theme::apply(&app,t.get_dark(),t.get_accent_base());app.invoke_icon_refresh(); }
                app.set_icon_pack_catalog(ModelRc::new(VecModel::from(icon_packs::catalog(app.get_set_icon_pack())))); save_settings(&app); return;
            }
            if action=="select" { icon_packs::select(app.get_set_icon_pack()); let t=app.global::<Theme>();theme::apply(&app,t.get_dark(),t.get_accent_base());app.invoke_icon_refresh();save_settings(&app); }
            if action=="export" { offer_file(&app,"masterpaint-icons.zip","Pack d'icônes","zip","application/zip",icon_packs::export_zip(app.get_set_icon_pack())); }
        });
    }
    {
        let weak = app.as_weak();
        app.on_apply_theme(move |dark, accent| {
            let app = weak.unwrap();
            // choix clair / sombre de l'utilisateur, hors Photoshop (qui l'impose)
            if app.get_set_interface_theme() != 2 && !app.get_pm_open() {
                USER_DARK.store(if dark { 2 } else { 1 }, std::sync::atomic::Ordering::Relaxed);
            }
            if app.get_pm_open() {
                // Mode Photo Pro : le choix est retenu pour la sortie du mode, l'interface reste sombre
                PM_DARK_RESTORE.store(if dark { 2 } else { 1 }, std::sync::atomic::Ordering::Relaxed);
                theme::apply(&app, true, accent);
            } else {
                theme::apply(&app, dark, accent);
            }
            save_settings(&app);
        });
    }

    // ---- Mode Photo Pro ----
    {
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_action(move |a| pm_action(&weak.unwrap(), &state2, &a));
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_select(move |i| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            if (i as usize) < st.photo.photos.len() {
                st.photo.active = i as usize;
                pm_store::save_session(&st);
                pm_sync(&app, &st);
                pm_render(&app, &mut st);
            }
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_remove(move |i| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let i = i as usize;
            if i < st.photo.photos.len() {
                let gone = st.photo.photos.remove(i);
                pm_store::photo_removed(gone.uid);
                let n = st.photo.photos.len();
                st.photo.active = if st.photo.active > i { st.photo.active - 1 } else { st.photo.active.min(n.saturating_sub(1)) };
                pm_store::save_session(&st);
                pm_sync(&app, &st);
                pm_render(&app, &mut st);
            }
        });
        // onglet Masque : réglages du masque choisi et glisser sur la photo
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_export_update(move || {
            let app = weak.unwrap();
            pm_export_info(&app, &state2.borrow());
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_export_run(move || {
            let app = weak.unwrap();
            let fmt = app.get_pm_exp_fmt().clamp(0, 2) as u8;
            pm_export(&app, &state2, fmt);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_mask_set(move |field, v| {
            let app = weak.unwrap();
            pm_masks::set(&app, &mut state2.borrow_mut(), &field, v);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_mask_drag(move |handle, u, v, phase| {
            let app = weak.unwrap();
            pm_masks::drag(&app, &mut state2.borrow_mut(), handle, u, v, phase);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_set(move |i, v| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let active = st.photo.active;
            let Some(p) = st.photo.photos.get_mut(active) else { return };
            if p.params.len() < photo::NP {
                p.params.resize(photo::NP, 0.0);
            }
            if let Some(slot) = p.params.get_mut(i as usize) {
                *slot = v;
                p.modified = true;
            }
            app.set_pm_values(ModelRc::new(VecModel::from(p.params.clone())));
            pm_render(&app, &mut st);
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_preset_chosen(move |k| pm_preset(&weak.unwrap(), &mut state2.borrow_mut(), k));
        // pipette de balance des blancs : le gris cliqué devient neutre
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_crop_set(move |x0, y0, x1, y1, angle| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let st = &mut *st;
            let active = st.photo.active;
            let Some(p) = st.photo.photos.get_mut(active) else { return };
            let (x0, x1) = (x0.clamp(0.0, 1.0).min(x1), x1.clamp(0.0, 1.0));
            let (y0, y1) = (y0.clamp(0.0, 1.0).min(y1), y1.clamp(0.0, 1.0));
            p.crop = (x0, y0, x1.max(x0 + 0.01), y1.max(y0 + 0.01));
            p.angle = angle.clamp(-45.0, 45.0);
            p.modified = true;
            let (cw, ch) = (((p.crop.2 - p.crop.0) * p.w as f32).round(), ((p.crop.3 - p.crop.1) * p.h as f32).round());
            pm_sync(&app, st);
            status(&app, &i18n::tr_format!("Recadrage : {cw} × {ch} px, redressement {:.1}°", p_angle(angle)));
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_pick_wb(move |u, v| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let st = &mut *st;
            let active = st.photo.active;
            let Some(p) = st.photo.photos.get_mut(active) else { return };
            let rgb = photo::sample_linear(&p.live_src(), p.lw, p.lh, u, v);
            let (t, n) = masterpaint_core::neutral_wb(rgb);
            p.params[1] = t;
            p.params[2] = n;
            p.modified = true;
            pm_sync(&app, st);
            pm_render(&app, st);
            status(&app, &i18n::tr_format!("Balance des blancs : température {:.0}, teinte {:.0}", t, n));
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_view(move |x0, y0, x1, y1, disp| {
            if let Ok(mut st) = state2.try_borrow_mut() {
                st.photo.view = [x0, y0, x1, y1, disp];
            }
            pm_schedule_hq(&weak.unwrap(), 260);
        });
    }

    // ---- mode téléphone : panneaux de menu de la barre du bas ----
    {
        let weak = app.as_weak();
        app.on_phone_sheet_open(move |w| {
            let app = weak.unwrap();
            let rows = phone_sheet_rows(&app, &w);
            app.set_phone_sheet_rows(ModelRc::new(VecModel::from(rows)));
        });
    }

    // ---- dialogues ----
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_new_image(move |w, h, bg, mode| {
            let app = weak.unwrap();
            let (w, h) = (w.trim().parse::<usize>().unwrap_or(1280).clamp(1, 16384), h.trim().parse::<usize>().unwrap_or(720).clamp(1, 16384));
            let fill = match bg {
                1 => [0, 0, 0, 0],
                2 => rgba(app.get_secondary_color()),
                _ => [255, 255, 255, 255],
            };
            let mode = ColorMode::from_index(mode);
            // comme la version web : « Sans titre N », N = nombre de projets ouverts + 1
            let n = if state.borrow().empty { 1 } else { state.borrow().tabs.len() + 1 };
            let mut doc = Doc::new(w, h, fill, &i18n::tr_format!("Sans titre {n}{}", i18n::tr(mode.suffix()))).with_mode(mode);
            // type de projet : 0 pixel, 1 SVG, 2 animation pixel, 3 animation SVG
            let kind = app.get_new_kind();
            if kind == 1 || kind == 3 {
                // projet SVG : aucun calque de pixels ; le fond est un rectangle (verrouillé), un
                // fond transparent n'a pas de calque du tout
                doc.vector_mode = true;
                if fill[3] > 0 {
                    let bg = vector::ShapeObj {
                        kind: "rect".into(),
                        a: (0.0, 0.0),
                        b: (w as f32, h as f32),
                        style: ShapeStyle::Fill,
                        width: 1.0,
                        color: fill,
                        points: Vec::new(),
                        radius: 0.0,
                        fill: None,
                        rot: 0.0,
                        cap_start: 0,
                        cap_end: 0,
                        dash: 0,
                        grad: None,
                        subs: Vec::new(),
                    };
                    let l = doc.layer_mut();
                    l.vector = Some(Box::new(vector::VectorLayer { objects: vec![vector::Obj::Shape(bg)], effects: Vec::new(), serial: 0 }));
                    l.locked = true;
                    doc.add_layer_in();
                } else {
                    doc.layer_mut().px = vec![0u8; w * h * 4].into();
                }
                let l = doc.layer_mut();
                l.name = i18n::tr_format!("Vecteur 1");
                l.vector = Some(Box::new(vector::VectorLayer::default()));
                doc.history.clear();
                doc.hindex = 0;
                doc.commit("Nouvelle image");
            }
            if kind >= 2 {
                anim::enable(&mut doc);
                doc.history.clear();
                doc.hindex = 0;
                doc.commit("Nouvelle animation");
                app.set_anim_open(true);
            }
            set_document(&app, &mut state.borrow_mut(), doc);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_resize_image(move |w, h, canvas, anchor| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let (w, h) = (w.trim().parse::<f32>().map(|v| v.round() as usize).unwrap_or(st.doc.w).clamp(1, 16384), h.trim().parse::<f32>().map(|v| v.round() as usize).unwrap_or(st.doc.h).clamp(1, 16384));
            if (w, h) == (st.doc.w, st.doc.h) {
                return;
            }
            finish_edits(&app, &mut st);
            if canvas {
                // ancrage 0..8 (haut-gauche … bas-droite) : position de l'ancienne image
                let (ax, ay) = ((anchor.clamp(0, 8) % 3) as isize, (anchor.clamp(0, 8) / 3) as isize);
                let ox = (w as isize - st.doc.w as isize) * ax / 2;
                let oy = (h as isize - st.doc.h as isize) * ay / 2;
                st.doc.resize_canvas_at(w, h, ox, oy);
            } else {
                st.doc.resize(w, h);
            }
            st.doc.commit(if canvas { "Taille de la zone de travail" } else { "Redimensionner" });
            refresh_all(&app, &mut st);
            app.invoke_zoom_fit();
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_prompt_ok(move |kind, value| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let v = value.trim().replace(',', ".").parse::<f32>().unwrap_or(0.0);
            match kind.as_str() {
                "rename" => {
                    let (i, name) = (st.rename_index, value.trim().to_string());
                    if name.is_empty() || i >= st.doc.layers.len() {
                        return;
                    }
                    st.doc.layers[i].name = name;
                    st.doc.commit("Renommer le calque");
                }
                "selexpand" => {
                    if st.doc.sel.is_none() {
                        status(&app, "Aucune sélection à étendre");
                        return;
                    }
                    st.doc.grow_selection(v.round() as i32);
                    st.doc.selection_changed();
                }
                "selfeather" | "selborder" | "selsmooth" => {
                    if st.doc.sel.is_none() || v <= 0.0 {
                        return;
                    }
                    let v = v.min(500.0);
                    match kind.as_str() {
                        "selfeather" => st.doc.feather_selection(v),
                        "selborder" => st.doc.border_selection(v),
                        _ => st.doc.smooth_selection(v),
                    }
                    st.doc.selection_changed();
                }
                _ => return,
            }
            refresh_all(&app, &mut st);
        });
    }
    {
        let weak = app.as_weak();
        app.on_contact_send(move |kind, msg, contact| {
            let app = weak.unwrap();
            if msg.trim().is_empty() {
                app.set_contact_status(i18n::tr("Écrivez un message").into());
                return;
            }
            let k = ["bug", "idee", "remarque", "autre"][kind.clamp(0, 3) as usize];
            send_contact(&app, k, &msg, &contact);
        });
    }
    app.on_download(move |kind| {
        let url = download_url(&kind);
        #[cfg(target_arch = "wasm32")]
        web::open_link(&url);
        #[cfg(not(target_arch = "wasm32"))]
        let _ = webbrowser::open(&url);
    });

    // fourmis de la sélection : défilement lent
    let ants = slint::Timer::default();
    {
        let weak = app.as_weak();
        let state = state.clone();
        ants.start(slint::TimerMode::Repeated, std::time::Duration::from_millis(400), move || {
            let Some(app) = weak.upgrade() else { return };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            // grande image : tuiles devenues visibles sans déplacement de la vue (fenêtre
            // agrandie, panneau fermé…)
            ensure_visible(&app, &mut st);
            // animation limitée au cadre de la sélection ; figée au-delà de 2 Mpx (« Tout sélectionner »
            // sur une grande image) pour ne pas renvoyer l'image entière deux fois par seconde
            let Some(b) = st.sel_bounds else { return };
            let area = (b.2 - b.0) * (b.3 - b.1);
            let (dw, dh) = display_dims(&st);
            if st.doc.sel.is_some() && !st.session.busy() && st.display.len() == dw * dh * 4 && area / (st.ds * st.ds) <= 2_000_000 {
                st.ants_phase = (st.ants_phase + 2) % 8;
                let st = &mut *st;
                let r = to_display_rect(st, b);
                // contour (pixels et tuiles) calculé une fois par sélection et par pas
                // d'affichage : chaque pas ne réécrit que ces pixels et ne renvoie que ces tuiles
                let key = (st.doc.sel.as_ref().map_or(0, |m| m.as_ptr() as usize), st.ds, r);
                if st.ants_cache.as_ref().map_or(true, |c| c.0 != key) {
                    let edges = st.doc.ant_edges(st.ds, r);
                    let mut tiles: Vec<(usize, usize)> = edges.iter().map(|&i| ((i as usize % dw) / TILE, (i as usize / dw) / TILE)).collect();
                    tiles.sort_unstable();
                    tiles.dedup();
                    st.ants_cache = Some((key, edges, tiles));
                }
                if let Some((_, edges, tiles)) = st.ants_cache.take() {
                    Doc::paint_ants(&mut st.display, &edges, dw, st.ants_phase);
                    // même règle que upload_rect : trop de tuiles par-dessus l'image → envoi entier
                    let fresh = tiles.iter().filter(|k| !st.tile_index.contains_key(k)).count();
                    if !st.lazy && (st.tile_index.len() + fresh) * TILE * TILE * 10 > dw * dh * 6 {
                        upload_full(&app, st);
                    } else {
                        for &t in &tiles {
                            if !st.lazy || st.tile_ok.contains(&t) {
                                put_tile(st, t);
                            }
                        }
                    }
                    st.ants_cache = Some((key, edges, tiles));
                }
            }
        });
    }

    // web : l'interface occupe toute la fenêtre du navigateur et suit ses changements de taille
    #[cfg(target_arch = "wasm32")]
    {
        let (w, h) = web::viewport();
        app.window().set_size(slint::LogicalSize::new(w, h));
        let weak = app.as_weak();
        // même règle que `phone` de l'interface : largeur logique (zoom de l'interface compris)
        let narrow = |app: &AppWindow, w: f32| {
            let z = (app.get_set_ui_zoom() / 100.0).clamp(0.6, 2.0);
            app.get_set_interface_theme() == 3 || (app.get_set_interface_theme() == 0 && app.get_set_layout() == 2) || (app.get_set_layout_auto() && w / z < 600.0)
        };
        let was_phone = std::cell::Cell::new(narrow(&app, w));
        web::on_resize(move || {
            if let Some(app) = weak.upgrade() {
                let (w, h) = web::viewport();
                let z = (app.get_set_ui_zoom() / 100.0).clamp(0.6, 2.0);
                app.window().set_size(slint::LogicalSize::new(w / z, h / z));
                let phone = narrow(&app, w);
                if phone != was_phone.replace(phone) {
                    set_phone_panels(&app, phone);
                    app.invoke_zoom_fit();
                }
            }
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        web::on_pinch(move |g| {
            let Some(app) = weak.upgrade() else { return };
            let Ok(mut st) = state2.try_borrow_mut() else { return };
            let st = &mut *st;
            match g {
                web::Pinch::Begin => {
                    // le premier doigt a commencé un trait : il est annulé
                    st.pinching = true;
                    st.session.cancel(&mut st.doc);
                    app.set_overlay_path(SharedString::default());
                    refresh_all(&app, st);
                }
                web::Pinch::Move { factor, x, y, dx, dy } => app.invoke_pinch(factor, x, y, dx, dy),
                web::Pinch::End => st.pinching = false,
            }
        });
    }
    // écran de téléphone (ou disposition choisie) : panneaux fermés, ouverts depuis la barre du haut
    if app.get_phone() {
        set_phone_panels(&app, true);
    }
    // ajustement du zoom une fois la fenêtre dimensionnée
    {
        let weak = app.as_weak();
        let ui_zoom = cfg.ui_zoom;
        slint::Timer::single_shot(std::time::Duration::from_millis(60), move || {
            if let Some(app) = weak.upgrade() {
                if (ui_zoom - 100.0).abs() > 0.5 {
                    apply_ui_zoom(&app, ui_zoom);
                }
                app.invoke_zoom_open();
            }
        });
    }
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    if let Some(s) = snap {
        return s.capture(&app);
    }
    app.run()
}

/// Mode téléphone : une seule palette à la fois, ouverte depuis la barre du haut ; retour au
/// bureau : palettes habituelles.
fn set_phone_panels(app: &AppWindow, phone: bool) {
    app.set_show_colors(!phone);
    app.set_show_layers(!phone);
    app.set_show_history(!phone);
    app.set_show_tools(!phone);
}

/// Téléchargement d'un fichier depuis le navigateur (export sur le web).
#[cfg(target_arch = "wasm32")]
mod web {
    use wasm_bindgen::JsCast;

    /// Attente sans bloquer (un tour de boucle au moins : l'interface se repeint).
    pub async fn sleep(ms: i32) {
        let p = js_sys::Promise::new(&mut |res, _| {
            if let Some(w) = web_sys::window() {
                let _ = w.set_timeout_with_callback_and_timeout_and_arguments_0(&res, ms);
            }
        });
        let _ = wasm_bindgen_futures::JsFuture::from(p).await;
    }

    /// Message pour le worker de calcul (`window.mpCompute.run`, voir web/index.html) ; `None`
    /// si aucun worker n'est disponible ou si le calcul a échoué.
    /// Arrête la file de worker `lane` (calculs devenus inutiles) : ses calculs en attente
    /// rendent un résultat vide, ignoré ; un nouveau worker est créé au prochain calcul.
    pub fn cancel_lane(lane: u32) {
        let Some(win) = web_sys::window() else { return };
        let Some(mc) = js_sys::Reflect::get(&win, &"mpCompute".into()).ok().filter(|v| v.is_object()) else { return };
        if let Some(f) = js_sys::Reflect::get(&mc, &"cancel".into()).ok().and_then(|f| f.dyn_into::<js_sys::Function>().ok()) {
            let _ = f.call1(&mc, &lane.into());
        }
    }

    async fn run_worker(msg: &js_sys::Object, transfer: &js_sys::Array) -> Option<wasm_bindgen::JsValue> {
        let win = web_sys::window()?;
        let mc = js_sys::Reflect::get(&win, &"mpCompute".into()).ok().filter(|v| v.is_object())?;
        let run: js_sys::Function = js_sys::Reflect::get(&mc, &"run".into()).ok()?.dyn_into().ok()?;
        let promise: js_sys::Promise = run.call2(&mc, msg, transfer).ok()?.dyn_into().ok()?;
        let v = wasm_bindgen_futures::JsFuture::from(promise).await.ok()?;
        (!v.is_null() && !v.is_undefined()).then_some(v)
    }

    /// Calcul lourd confié au worker. `None` : pas de worker (ou calcul propre à l'interface),
    /// à faire sur place ; `Some(None)` : le calcul a échoué.
    pub async fn compute(job: &crate::background::Heavy) -> Option<Option<Vec<u8>>> {
        use crate::background::Heavy;
        let msg = js_sys::Object::new();
        let transfer = js_sys::Array::new();
        let set = |k: &str, v: &wasm_bindgen::JsValue| {
            let _ = js_sys::Reflect::set(&msg, &k.into(), v);
        };
        let bytes = |d: &[u8]| {
            let a = js_sys::Uint8Array::from(d);
            transfer.push(&a.buffer());
            a
        };
        let floats = |d: &[f32]| {
            let a = js_sys::Float32Array::from(d);
            transfer.push(&a.buffer());
            a
        };
        // file 0 : petits calculs (rendu en direct) ; file 1 : longs, pour ne pas retarder les
        // autres ; file 2 : haute résolution du Mode Photo Pro, annulable (`cancel_lane`)
        let region;
        let (w, h, lane) = match job {
            Heavy::Effect { name, src, w, h, p, post } => {
                set("type", &"effect".into());
                set("name", &name.as_str().into());
                set("data", &bytes(src));
                set("params", &js_sys::Float32Array::from(&p[..]));
                if let Some(ca) = post {
                    set("post", &js_sys::Float32Array::from(&ca[..]));
                }
                // effet spatial calculable par bandes : la page peut le répartir sur plusieurs
                // workers (image entière envoyée à chacun, une bande de lignes calculée chacun)
                if post.is_none() && masterpaint_core::bandable(name) {
                    set("bands", &true.into());
                }
                (*w, *h, (*w * *h > 700_000) as u32)
            }
            Heavy::CamRawLin { lin, w, h, p } => {
                set("type", &"camraw-lin".into());
                set("data", &floats(lin));
                set("params", &js_sys::Float32Array::from(&p[..]));
                (*w, *h, (*w * *h > 700_000) as u32)
            }
            Heavy::PhotoRegion(job) => {
                // la source entière reste ici : seule la zone, déjà réduite, part au worker
                region = job.extract();
                match &region {
                    crate::photo::Src::Lin(l) => {
                        set("type", &"camraw-lin".into());
                        set("data", &floats(l));
                    }
                    crate::photo::Src::U8(u) => {
                        set("type", &"effect".into());
                        set("name", &"cameraraw".into());
                        set("data", &bytes(u));
                    }
                }
                set("params", &js_sys::Float32Array::from(&job.p[..]));
                (job.tw, job.th, 2)
            }
            Heavy::Fill { src, mask, w, h, p } => {
                set("type", &"fill".into());
                set("data", &bytes(src));
                set("mask", &bytes(mask));
                set("params", &js_sys::Float32Array::from(&p[..]));
                (*w, *h, 1)
            }
            Heavy::Local(_) => return None,
        };
        set("w", &(w as u32).into());
        set("h", &(h as u32).into());
        set("lane", &lane.into());
        let v = run_worker(&msg, &transfer).await?;
        let out = js_sys::Uint8Array::new(&v).to_vec();
        Some((!out.is_empty()).then_some(out))
    }

    /// RAW lu et développé par le worker ; `None` : pas de worker ou échec (refait sur place).
    pub async fn compute_raw(bytes: &[u8]) -> Option<crate::raw::Raw> {
        let msg = js_sys::Object::new();
        let transfer = js_sys::Array::new();
        let a = js_sys::Uint8Array::from(bytes);
        transfer.push(&a.buffer());
        let _ = js_sys::Reflect::set(&msg, &"type".into(), &"raw".into());
        let _ = js_sys::Reflect::set(&msg, &"data".into(), &a);
        let _ = js_sys::Reflect::set(&msg, &"lane".into(), &1.into());
        let v = run_worker(&msg, &transfer).await?;
        let mut lin = js_sys::Float32Array::new(&v).to_vec();
        if lin.len() < 4 {
            return None;
        }
        let head: Vec<f32> = lin.drain(..4).collect();
        let (w, h) = (head[0] as usize, head[1] as usize);
        (w * h * 3 == lin.len()).then_some(crate::raw::Raw { w, h, lin, white: head[2], baseline_ev: head[3] })
    }

    /// Décodage d'une image lancé tout de suite dans un worker (place `slot` de la file des
    /// longs calculs, pour en faire tourner plusieurs à la fois) ; résultat avec `decode_finish`.
    pub fn decode_start(bytes: &[u8], slot: usize) -> Option<js_sys::Promise> {
        let msg = js_sys::Object::new();
        let transfer = js_sys::Array::new();
        let a = js_sys::Uint8Array::from(bytes);
        transfer.push(&a.buffer());
        let _ = js_sys::Reflect::set(&msg, &"type".into(), &"decode".into());
        let _ = js_sys::Reflect::set(&msg, &"data".into(), &a);
        let _ = js_sys::Reflect::set(&msg, &"lane".into(), &1.into());
        let _ = js_sys::Reflect::set(&msg, &"slot".into(), &(slot as u32).into());
        let win = web_sys::window()?;
        let mc = js_sys::Reflect::get(&win, &"mpCompute".into()).ok().filter(|v| v.is_object())?;
        let run: js_sys::Function = js_sys::Reflect::get(&mc, &"run".into()).ok()?.dyn_into().ok()?;
        run.call2(&mc, &msg, &transfer).ok()?.dyn_into().ok()
    }

    pub async fn decode_finish(p: js_sys::Promise) -> Option<(usize, usize, Vec<u8>)> {
        let v = wasm_bindgen_futures::JsFuture::from(p).await.ok().filter(|v| !v.is_null() && !v.is_undefined())?;
        let mut px = js_sys::Uint8Array::new(&v).to_vec();
        if px.len() < 8 {
            return None;
        }
        let head: Vec<u8> = px.drain(..8).collect();
        let w = u32::from_le_bytes([head[0], head[1], head[2], head[3]]) as usize;
        let h = u32::from_le_bytes([head[4], head[5], head[6], head[7]]) as usize;
        (w * h * 4 == px.len()).then_some((w, h, px))
    }

    /// Image décodée par le worker ; `None` : pas de worker ou format inconnu (refait sur place).
    pub async fn compute_decode(bytes: &[u8]) -> Option<(usize, usize, Vec<u8>)> {
        let msg = js_sys::Object::new();
        let transfer = js_sys::Array::new();
        let a = js_sys::Uint8Array::from(bytes);
        transfer.push(&a.buffer());
        let _ = js_sys::Reflect::set(&msg, &"type".into(), &"decode".into());
        let _ = js_sys::Reflect::set(&msg, &"data".into(), &a);
        let _ = js_sys::Reflect::set(&msg, &"lane".into(), &1.into());
        let v = run_worker(&msg, &transfer).await?;
        let mut px = js_sys::Uint8Array::new(&v).to_vec();
        if px.len() < 8 {
            return None;
        }
        let head: Vec<u8> = px.drain(..8).collect();
        let w = u32::from_le_bytes([head[0], head[1], head[2], head[3]]) as usize;
        let h = u32::from_le_bytes([head[4], head[5], head[6], head[7]]) as usize;
        (w * h * 4 == px.len()).then_some((w, h, px))
    }

    /// POST d'un texte (formulaire de contact) ; renvoie le corps de la réponse.
    pub async fn post_text(url: &str, body: &str) -> Option<String> {
        let init = web_sys::RequestInit::new();
        init.set_method("POST");
        init.set_body(&wasm_bindgen::JsValue::from_str(body));
        let req = web_sys::Request::new_with_str_and_init(url, &init).ok()?;
        let _ = req.headers().set("Content-Type", "text/plain;charset=UTF-8");
        let resp = wasm_bindgen_futures::JsFuture::from(web_sys::window()?.fetch_with_request(&req)).await.ok()?;
        let resp: web_sys::Response = resp.dyn_into().ok()?;
        let txt = wasm_bindgen_futures::JsFuture::from(resp.text().ok()?).await.ok()?;
        txt.as_string()
    }

    /// Taille utile de la fenêtre du navigateur (px CSS).
    pub fn viewport() -> (f32, f32) {
        let Some(w) = web_sys::window() else { return (1280.0, 800.0) };
        let iw = w.inner_width().ok().and_then(|v| v.as_f64()).unwrap_or(1280.0);
        let ih = w.inner_height().ok().and_then(|v| v.as_f64()).unwrap_or(800.0);
        (iw as f32, ih as f32)
    }

    /// Sauvegarde automatique : IndexedDB, par l'assistant `window.mpStore` de la page.
    fn store() -> Option<wasm_bindgen::JsValue> {
        let w = web_sys::window()?;
        js_sys::Reflect::get(&w, &"mpStore".into()).ok().filter(|v| v.is_object())
    }

    /// Image encodée en PNG (adresse data:) par le worker de calcul ; `gray` : masque α, un octet
    /// par pixel. `None` : pas de worker, l'encodage se fera sur place.
    pub async fn compute_png(px: &[u8], w: usize, h: usize, gray: bool) -> Option<String> {
        let msg = js_sys::Object::new();
        let transfer = js_sys::Array::new();
        let a = js_sys::Uint8Array::from(px);
        transfer.push(&a.buffer());
        let set = |k: &str, v: &wasm_bindgen::JsValue| {
            let _ = js_sys::Reflect::set(&msg, &k.into(), v);
        };
        set("type", &"png".into());
        set("data", &a);
        set("w", &(w as u32).into());
        set("h", &(h as u32).into());
        set("gray", &gray.into());
        set("lane", &1.into());
        let v = run_worker(&msg, &transfer).await?;
        String::from_utf8(js_sys::Uint8Array::new(&v).to_vec()).ok()
    }

    pub fn store_clear() {
        let Some(st) = store() else { return };
        let Ok(f) = js_sys::Reflect::get(&st, &"clear".into()) else { return };
        if let Ok(f) = f.dyn_into::<js_sys::Function>() {
            let _ = f.call0(&st);
        }
    }

    /// Supprime la base IndexedDB utilisée par MasterPaint et son ancien nom de stockage.
    pub fn clear_all_data() {
        if let Some(w) = web_sys::window() {
            if let Ok(idb) = js_sys::Reflect::get(&w, &"indexedDB".into()) {
                if let Ok(delete) = js_sys::Reflect::get(&idb, &"deleteDatabase".into()) {
                    if let Ok(delete) = delete.dyn_into::<js_sys::Function>() {
                        let _ = delete.call1(&idb, &"masterpaint-rust".into());
                        let _ = delete.call1(&idb, &"illu_workspace_blobs_v1".into());
                    }
                }
            }
        }
    }

    pub fn store_save(bytes: &[u8]) {
        let Some(st) = store() else { return };
        let Ok(f) = js_sys::Reflect::get(&st, &"save".into()) else { return };
        if let Ok(f) = f.dyn_into::<js_sys::Function>() {
            let _ = f.call1(&st, &js_sys::Uint8Array::from(bytes));
        }
    }

    pub async fn store_load() -> Option<Vec<u8>> {
        let st = store()?;
        let f: js_sys::Function = js_sys::Reflect::get(&st, &"load".into()).ok()?.dyn_into().ok()?;
        let p: js_sys::Promise = f.call0(&st).ok()?.dyn_into().ok()?;
        let v = wasm_bindgen_futures::JsFuture::from(p).await.ok()?;
        if v.is_null() || v.is_undefined() {
            return None;
        }
        Some(js_sys::Uint8Array::new(&v).to_vec()).filter(|b| !b.is_empty())
    }

    fn clipboard() -> Option<wasm_bindgen::JsValue> {
        let w = web_sys::window()?;
        js_sys::Reflect::get(&w, &"mpClipboard".into()).ok().filter(|v| v.is_object())
    }

    /// Suppression du fond (IA) par la bibliothèque de la page (`window.mpAi`) : pixels RGBA en
    /// entrée et en sortie ; `progress(clé, courant, total)` ; `Err("ILLU_ABORT")` si annulé.
    pub async fn remove_bg(rgba: &[u8], w: usize, h: usize, model: &str, progress: impl Fn(String, f64, f64) + 'static) -> Result<Vec<u8>, String> {
        let ai = web_sys::window()
            .and_then(|win| js_sys::Reflect::get(&win, &"mpAi".into()).ok())
            .filter(|v| v.is_object())
            .ok_or("module IA indisponible")?;
        let f: js_sys::Function = js_sys::Reflect::get(&ai, &"removeBg".into()).map_err(|_| "module IA indisponible")?.dyn_into().map_err(|_| "module IA indisponible")?;
        let cb = wasm_bindgen::closure::Closure::<dyn FnMut(String, f64, f64)>::new(move |k: String, c: f64, t: f64| progress(k, c, t));
        let args = js_sys::Array::of5(&js_sys::Uint8Array::from(rgba), &(w as f64).into(), &(h as f64).into(), &model.into(), cb.as_ref());
        let p = f.apply(&ai, &args).map_err(|e| format!("{e:?}"))?;
        let p: js_sys::Promise = p.dyn_into().map_err(|_| "module IA indisponible")?;
        let r = wasm_bindgen_futures::JsFuture::from(p).await.map_err(|e| {
            e.dyn_ref::<js_sys::Error>().map(|x| String::from(x.message())).or_else(|| e.as_string()).unwrap_or_else(|| "échec".into())
        })?;
        drop(cb);
        Ok(js_sys::Uint8Array::new(&r).to_vec())
    }

    pub fn remove_bg_abort() {
        if let Some(ai) = web_sys::window().and_then(|win| js_sys::Reflect::get(&win, &"mpAi".into()).ok()).filter(|v| v.is_object()) {
            if let Ok(f) = js_sys::Reflect::get(&ai, &"abort".into()).and_then(|f| f.dyn_into::<js_sys::Function>().map_err(|e| e)) {
                let _ = f.call0(&ai);
            }
        }
    }

    /// Copie une image (RGBA) dans le presse-papiers du système : le PNG est encodé par le
    /// navigateur. À appeler pendant le geste de l'utilisateur (évènement copy, clic).
    pub fn clipboard_write(rgba: &[u8], w: usize, h: usize) {
        let Some(cb) = clipboard() else { return };
        let Ok(f) = js_sys::Reflect::get(&cb, &"write".into()) else { return };
        if let Ok(f) = f.dyn_into::<js_sys::Function>() {
            let _ = f.call3(&cb, &js_sys::Uint8Array::from(rgba), &(w as f64).into(), &(h as f64).into());
        }
    }

    /// Aperçu 1:1 dans une fenêtre séparée du navigateur (`window.mpPreview`).
    fn preview_obj() -> Option<wasm_bindgen::JsValue> {
        let w = web_sys::window()?;
        js_sys::Reflect::get(&w, &"mpPreview".into()).ok().filter(|v| v.is_object())
    }

    /// Ouvre la fenêtre d'aperçu ; false si le navigateur l'a bloquée.
    pub fn preview_open(w: usize, h: usize) -> bool {
        let Some(p) = preview_obj() else { return false };
        let Ok(f) = js_sys::Reflect::get(&p, &"open".into()).and_then(|f| f.dyn_into::<js_sys::Function>()) else { return false };
        f.call2(&p, &(w as f64).into(), &(h as f64).into()).ok().and_then(|v| v.as_bool()).unwrap_or(false)
    }

    pub fn preview_is_open() -> bool {
        let Some(p) = preview_obj() else { return false };
        let Ok(f) = js_sys::Reflect::get(&p, &"isOpen".into()).and_then(|f| f.dyn_into::<js_sys::Function>()) else { return false };
        f.call0(&p).ok().and_then(|v| v.as_bool()).unwrap_or(false)
    }

    pub fn preview_update(rgba: &[u8], w: usize, h: usize) {
        let Some(p) = preview_obj() else { return };
        if let Ok(f) = js_sys::Reflect::get(&p, &"update".into()).and_then(|f| f.dyn_into::<js_sys::Function>()) {
            let _ = f.call3(&p, &js_sys::Uint8Array::from(rgba), &(w as f64).into(), &(h as f64).into());
        }
    }

    /// Image décodée par le navigateur : (largeur, hauteur, RGBA).
    fn raw_image(v: &wasm_bindgen::JsValue) -> Option<(usize, usize, Vec<u8>)> {
        if !v.is_object() {
            return None;
        }
        let w = js_sys::Reflect::get(v, &"w".into()).ok()?.as_f64()? as usize;
        let h = js_sys::Reflect::get(v, &"h".into()).ok()?.as_f64()? as usize;
        let data = js_sys::Uint8Array::new(&js_sys::Reflect::get(v, &"data".into()).ok()?).to_vec();
        (w * h * 4 == data.len() && w > 0).then_some((w, h, data))
    }

    /// Décode un fichier image avec les codecs du navigateur (`window.mpImage`).
    pub async fn decode_native(bytes: &[u8]) -> Option<(usize, usize, Vec<u8>)> {
        let w = web_sys::window()?;
        let img = js_sys::Reflect::get(&w, &"mpImage".into()).ok().filter(|v| v.is_object())?;
        let f: js_sys::Function = js_sys::Reflect::get(&img, &"decode".into()).ok()?.dyn_into().ok()?;
        let p: js_sys::Promise = f.call1(&img, &js_sys::Uint8Array::from(bytes)).ok()?.dyn_into().ok()?;
        raw_image(&wasm_bindgen_futures::JsFuture::from(p).await.ok()?)
    }

    pub async fn clipboard_dimensions() -> Option<(usize, usize)> {
        let cb = clipboard()?;
        let f: js_sys::Function = js_sys::Reflect::get(&cb, &"dimensions".into()).ok()?.dyn_into().ok()?;
        let promise: js_sys::Promise = f.call0(&cb).ok()?.dyn_into().ok()?;
        let result = wasm_bindgen_futures::JsFuture::from(promise).await.ok()?;
        let number = |key: &str| js_sys::Reflect::get(&result, &key.into()).ok()?.as_f64();
        let (w, h) = (number("w")?, number("h")?);
        (w.is_finite() && h.is_finite() && w > 0.0 && h > 0.0).then_some((w as usize, h as usize))
    }

    /// Image du presse-papiers du système (menus Coller), décodée par le navigateur.
    pub async fn clipboard_read() -> Option<(usize, usize, Vec<u8>)> {
        let cb = clipboard()?;
        let f: js_sys::Function = js_sys::Reflect::get(&cb, &"read".into()).ok()?.dyn_into().ok()?;
        let p: js_sys::Promise = f.call0(&cb).ok()?.dyn_into().ok()?;
        let v = wasm_bindgen_futures::JsFuture::from(p).await.ok()?;
        raw_image(&v)
    }

    /// Drapeau booléen posé par la page (`window.<nom>`).
    pub fn flag(name: &str) -> bool {
        web_sys::window().and_then(|w| js_sys::Reflect::get(&w, &name.into()).ok()).and_then(|v| v.as_bool()).unwrap_or(false)
    }

    /// Le focus est dans un champ de texte (élément <input> invisible de Slint).
    pub fn text_focused() -> bool {
        web_sys::window()
            .and_then(|w| w.document())
            .and_then(|d| d.active_element())
            .is_some_and(|e| matches!(e.tag_name().as_str(), "INPUT" | "TEXTAREA"))
    }

    /// Touches Ctrl (ou Cmd), Maj, Alt enfoncées, d'après la page (`window.mpMods`).
    pub fn modifiers() -> (bool, bool, bool) {
        let Some(m) = web_sys::window().and_then(|w| js_sys::Reflect::get(&w, &"mpMods".into()).ok()).filter(|v| v.is_object()) else {
            return (false, false, false);
        };
        let get = |k: &str| js_sys::Reflect::get(&m, &k.into()).ok().and_then(|v| v.as_bool()).unwrap_or(false);
        (get("ctrl"), get("shift"), get("alt"))
    }

    /// Dernière raison d'échec du presse-papiers (page).
    pub fn clipboard_error() -> String {
        clipboard()
            .and_then(|cb| js_sys::Reflect::get(&cb, &"lastError".into()).ok())
            .and_then(|v| v.as_string())
            .unwrap_or_default()
    }

    /// Copier / couper déclenchés par le navigateur (`true` = couper).
    pub fn on_copy(f: impl Fn(bool) + 'static) {
        let Some(cb) = clipboard() else { return };
        let Ok(on) = js_sys::Reflect::get(&cb, &"onCopy".into()) else { return };
        let Ok(on) = on.dyn_into::<js_sys::Function>() else { return };
        let c = wasm_bindgen::closure::Closure::<dyn FnMut(bool)>::new(move |cut: bool| f(cut));
        let _ = on.call1(&cb, c.as_ref().unchecked_ref());
        c.forget();
    }

    /// Collage venu du navigateur (évènement « paste ») : `f(nom, contenu)` pour un fichier à
    /// décoder ici (.illu, RAW…), `f_raw(nom, w, h, RGBA)` pour une image déjà décodée par le
    /// navigateur. Nom « * » : rien d'utilisable ; contenu vide : le presse-papiers ne donne
    /// qu'un chemin de fichier.
    pub fn on_paste(f: impl Fn(String, Vec<u8>) + 'static, f_raw: impl Fn(String, usize, usize, Vec<u8>) + 'static) {
        let Some(cb) = clipboard() else { return };
        let Ok(on) = js_sys::Reflect::get(&cb, &"onPaste".into()) else { return };
        let Ok(on) = on.dyn_into::<js_sys::Function>() else { return };
        let c = wasm_bindgen::closure::Closure::<dyn FnMut(String, js_sys::Uint8Array)>::new(move |n: String, a: js_sys::Uint8Array| f(n, a.to_vec()));
        let r = wasm_bindgen::closure::Closure::<dyn FnMut(String, f64, f64, js_sys::Uint8Array)>::new(move |n: String, w: f64, h: f64, a: js_sys::Uint8Array| f_raw(n, w as usize, h as usize, a.to_vec()));
        let _ = on.call2(&cb, c.as_ref().unchecked_ref(), r.as_ref().unchecked_ref());
        c.forget();
        r.forget();
    }

    /// Attend jusqu'à `ms` millisecondes l'évènement « paste » du navigateur.
    pub async fn wait_paste(ms: f64) -> bool {
        let Some(cb) = clipboard() else { return false };
        let Ok(f) = js_sys::Reflect::get(&cb, &"waitPaste".into()) else { return false };
        let Ok(f) = f.dyn_into::<js_sys::Function>() else { return false };
        let Ok(p) = f.call1(&cb, &ms.into()) else { return false };
        let Ok(p) = p.dyn_into::<js_sys::Promise>() else { return false };
        wasm_bindgen_futures::JsFuture::from(p).await.ok().and_then(|v| v.as_bool()).unwrap_or(false)
    }

    /// Le navigateur a-t-il déjà fourni le collage (évènement « paste » des 3 dernières secondes) ?
    pub fn paste_event_claimed() -> bool {
        clipboard()
            .and_then(|cb| js_sys::Reflect::get(&cb, &"claimedAt".into()).ok())
            .and_then(|v| v.as_f64())
            .is_some_and(|t| js_sys::Date::now() - t < 3000.0)
    }

    /// Lien ouvert / téléchargé par un clic d'ancre (déclenché par le geste de l'utilisateur).
    pub fn open_link(url: &str) {
        let Some(doc) = web_sys::window().and_then(|w| w.document()) else { return };
        if let Ok(a) = doc.create_element("a") {
            if let Ok(a) = a.dyn_into::<web_sys::HtmlAnchorElement>() {
                a.set_href(url);
                a.set_download("");
                a.set_target("_blank");
                a.set_rel("noopener");
                a.click();
            }
        }
    }

    /// Fichier déposé sur la page : `f(nom, contenu)`.
    pub fn on_file_drop(f: impl Fn(String, Vec<u8>) + 'static) {
        let Some(doc) = web_sys::window().and_then(|w| w.document()) else { return };
        let over = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::DragEvent)>::new(|e: web_sys::DragEvent| e.prevent_default());
        let _ = doc.add_event_listener_with_callback("dragover", over.as_ref().unchecked_ref());
        over.forget();
        let f = std::rc::Rc::new(f);
        let drop = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::DragEvent)>::new(move |e: web_sys::DragEvent| {
            e.prevent_default();
            let Some(list) = e.data_transfer().and_then(|d| d.files()) else { return };
            // tous les fichiers déposés, dans l'ordre (la fenêtre de choix les regroupe)
            let files: Vec<web_sys::File> = (0..list.length()).filter_map(|i| list.get(i)).collect();
            let f = f.clone();
            wasm_bindgen_futures::spawn_local(async move {
                for file in files {
                    let name = file.name();
                    if let Ok(buf) = wasm_bindgen_futures::JsFuture::from(file.array_buffer()).await {
                        f(name, js_sys::Uint8Array::new(&buf).to_vec());
                    }
                }
            });
        });
        let _ = doc.add_event_listener_with_callback("drop", drop.as_ref().unchecked_ref());
        drop.forget();
    }

    /// Onglet du navigateur masqué ou page fermée : `f` est appelée (sauvegarde immédiate).
    /// Fermeture / rechargement de la page : `f` renvoie `true` pour demander confirmation.
    pub fn on_before_unload(f: impl Fn() -> bool + 'static) {
        let Some(win) = web_sys::window() else { return };
        let cb = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::BeforeUnloadEvent)>::new(move |e: web_sys::BeforeUnloadEvent| {
            if f() {
                e.prevent_default();
                e.set_return_value("Des images contiennent des modifications non enregistrées.");
            }
        });
        let _ = win.add_event_listener_with_callback("beforeunload", cb.as_ref().unchecked_ref());
        cb.forget();
    }

    pub fn on_hidden(f: impl Fn() + 'static) {
        let Some(doc) = web_sys::window().and_then(|w| w.document()) else { return };
        let d2 = doc.clone();
        let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(move || {
            if d2.hidden() {
                f();
            }
        });
        let _ = doc.add_event_listener_with_callback("visibilitychange", cb.as_ref().unchecked_ref());
        cb.forget();
    }

    /// Geste à deux doigts sur la toile du navigateur.
    pub enum Pinch {
        Begin,
        /// facteur de zoom, centre (px CSS de la page), décalage du centre depuis l'événement précédent
        Move { factor: f32, x: f32, y: f32, dx: f32, dy: f32 },
        End,
    }

    /// Pincement / glisser à deux doigts sur le canevas de Slint (Slint ne gère pas encore ce geste).
    pub fn on_pinch(f: impl Fn(Pinch) + 'static) {
        let Some(canvas) = web_sys::window().and_then(|w| w.document()).and_then(|d| d.get_element_by_id("canvas")) else { return };
        let f = std::rc::Rc::new(f);
        let last: std::rc::Rc<std::cell::Cell<Option<(f32, f32, f32)>>> = Default::default();
        let two = |e: &web_sys::TouchEvent| -> Option<(f32, f32, f32)> {
            let t = e.touches();
            if t.length() < 2 {
                return None;
            }
            let (a, b) = (t.get(0)?, t.get(1)?);
            let (ax, ay, bx, by) = (a.client_x() as f32, a.client_y() as f32, b.client_x() as f32, b.client_y() as f32);
            Some((((ax - bx).powi(2) + (ay - by).powi(2)).sqrt().max(1.0), (ax + bx) / 2.0, (ay + by) / 2.0))
        };
        let opts = web_sys::AddEventListenerOptions::new();
        opts.set_passive(false);
        for kind in ["touchstart", "touchmove", "touchend", "touchcancel"] {
            let (f, last) = (f.clone(), last.clone());
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut(web_sys::TouchEvent)>::new(move |e: web_sys::TouchEvent| {
                match (kind, two(&e)) {
                    ("touchstart", Some(g)) => {
                        if last.replace(Some(g)).is_none() {
                            f(Pinch::Begin);
                        }
                        e.prevent_default();
                    }
                    ("touchmove", Some((d, x, y))) => {
                        if let Some((d0, x0, y0)) = last.replace(Some((d, x, y))) {
                            f(Pinch::Move { factor: d / d0, x, y, dx: x - x0, dy: y - y0 });
                        }
                        e.prevent_default();
                    }
                    ("touchend" | "touchcancel", None) if last.take().is_some() => f(Pinch::End),
                    _ => {}
                }
            });
            let _ = canvas.add_event_listener_with_callback_and_add_event_listener_options(kind, cb.as_ref().unchecked_ref(), &opts);
            cb.forget();
        }
    }

    /// Appelle `f` à chaque redimensionnement de la fenêtre du navigateur.
    pub fn on_resize(f: impl FnMut() + 'static) {
        if let Some(w) = web_sys::window() {
            let cb = wasm_bindgen::closure::Closure::<dyn FnMut()>::new(f);
            let _ = w.add_event_listener_with_callback("resize", cb.as_ref().unchecked_ref());
            cb.forget();
        }
    }

    /// Sélecteur de fichier du navigateur : (nom, contenu) du fichier choisi.
    pub async fn pick_file(accept: &str) -> Option<(String, Vec<u8>)> {
        let doc = web_sys::window()?.document()?;
        let input: web_sys::HtmlInputElement = doc.create_element("input").ok()?.dyn_into().ok()?;
        input.set_type("file");
        input.set_accept(accept);
        let inp = input.clone();
        let promise = js_sys::Promise::new(&mut |resolve, _reject| {
            let r = resolve.clone();
            let on_change = wasm_bindgen::closure::Closure::once_into_js(move || {
                let _ = r.call0(&wasm_bindgen::JsValue::NULL);
            });
            inp.set_onchange(Some(on_change.unchecked_ref()));
        });
        input.click();
        wasm_bindgen_futures::JsFuture::from(promise).await.ok()?;
        let file = input.files()?.get(0)?;
        let name = file.name();
        let buf = wasm_bindgen_futures::JsFuture::from(file.array_buffer()).await.ok()?;
        Some((name, js_sys::Uint8Array::new(&buf).to_vec()))
    }

    /// Plusieurs fichiers choisis par l'utilisateur (séquence d'images).
    pub async fn pick_files(accept: &str) -> Option<Vec<(String, Vec<u8>)>> {
        let doc = web_sys::window()?.document()?;
        let input: web_sys::HtmlInputElement = doc.create_element("input").ok()?.dyn_into().ok()?;
        input.set_type("file");
        input.set_accept(accept);
        input.set_multiple(true);
        let inp = input.clone();
        let promise = js_sys::Promise::new(&mut |resolve, _reject| {
            let r = resolve.clone();
            let on_change = wasm_bindgen::closure::Closure::once_into_js(move || {
                let _ = r.call0(&wasm_bindgen::JsValue::NULL);
            });
            inp.set_onchange(Some(on_change.unchecked_ref()));
        });
        input.click();
        wasm_bindgen_futures::JsFuture::from(promise).await.ok()?;
        let files = input.files()?;
        let mut out = Vec::new();
        for i in 0..files.length() {
            let Some(file) = files.get(i) else { continue };
            let buf = wasm_bindgen_futures::JsFuture::from(file.array_buffer()).await.ok()?;
            out.push((file.name(), js_sys::Uint8Array::new(&buf).to_vec()));
        }
        (!out.is_empty()).then_some(out)
    }

    /// Télécharge un fichier à côté de la page (polices MasterPaint).
    fn call_page(name: &str, arg: Option<&str>) {
        let Some(w) = web_sys::window() else { return };
        let Ok(f) = js_sys::Reflect::get(&w, &name.into()) else { return };
        if let Ok(f) = f.dyn_into::<js_sys::Function>() {
            let _ = match arg {
                Some(a) => f.call1(&w, &a.into()),
                None => f.call0(&w),
            };
        }
    }

    /// Écran de chargement de la page : étape affichée.
    pub fn set_language(code: &str) {
        call_page("mpSetLanguage", Some(code));
    }

    pub fn loading_step(text: &str) {
        call_page("mpLoadingStep", Some(text));
    }

    /// Interface prête (projets restaurés) : l'écran de chargement disparaît.
    pub fn ready() {
        call_page("mpReady", None);
    }

    /// Chemin « /dossier/… » du site rendu relatif au dossier de l'application (`MP_ROOT` de la
    /// page : « ./ » à la racine, « ../ » dans /rust-app/), pour qu'il marche aussi dans un
    /// sous-dossier (http://localhost/MasterPaint/).
    pub fn site_path(path: &str) -> String {
        let Some(rest) = path.strip_prefix('/') else { return path.to_string() };
        let root = web_sys::window()
            .and_then(|w| js_sys::Reflect::get(&w, &"MP_ROOT".into()).ok())
            .and_then(|v| v.as_string())
            .unwrap_or_else(|| "./".into());
        format!("{root}{rest}")
    }

    pub async fn fetch_bytes(url: &str) -> Option<Vec<u8>> {
        let win = web_sys::window()?;
        let url = site_path(url);
        let resp = wasm_bindgen_futures::JsFuture::from(win.fetch_with_str(&url)).await.ok()?;
        let resp: web_sys::Response = resp.dyn_into().ok()?;
        if !resp.ok() {
            return None;
        }
        let buf = wasm_bindgen_futures::JsFuture::from(resp.array_buffer().ok()?).await.ok()?;
        Some(js_sys::Uint8Array::new(&buf).to_vec())
    }

    pub fn download_bytes(bytes: &[u8], name: &str, mime: &str) {
        let Some(win) = web_sys::window() else { return };
        let Some(doc) = win.document() else { return };
        let arr = js_sys::Uint8Array::from(bytes);
        let parts = js_sys::Array::of1(&arr);
        let opts = web_sys::BlobPropertyBag::new();
        opts.set_type(mime);
        let Ok(blob) = web_sys::Blob::new_with_u8_array_sequence_and_options(&parts, &opts) else { return };
        let Ok(url) = web_sys::Url::create_object_url_with_blob(&blob) else { return };
        if let Ok(a) = doc.create_element("a") {
            if let Ok(a) = a.dyn_into::<web_sys::HtmlAnchorElement>() {
                a.set_href(&url);
                a.set_download(name);
                a.click();
            }
        }
        // pas tout de suite : le navigateur lit l'adresse après le clic (sinon GET blob:…
        // net::ERR_FILE_NOT_FOUND, téléchargement perdu)
        slint::Timer::single_shot(std::time::Duration::from_secs(60), move || {
            let _ = web_sys::Url::revoke_object_url(&url);
        });
    }
}

#[cfg(test)]
mod worklist {
    /// Liste les entrées de menu non transférées (cargo test worklist -- --nocapture --ignored).
    #[test]
    #[ignore]
    fn print_menu_status() {
        let v: serde_json::Value = serde_json::from_str(include_str!("../tools/menus.json").trim_start_matches('\u{feff}')).unwrap();
        for m in v["menus"].as_array().unwrap() {
            let title = m["title"].as_str().unwrap_or("");
            for it in m["items"].as_array().unwrap() {
                if it.get("sep").is_some() {
                    continue;
                }
                let label = it["label"].as_str().unwrap_or("");
                let kids = it["children"].as_array().cloned().unwrap_or_default();
                if kids.is_empty() {
                    let b = super::action_badge(it["action"].as_str().unwrap_or(""), label);
                    println!("{}\t{}\t{}\t{}", if b.is_empty() { "RUST" } else { "TODO" }, title, label, it["action"].as_str().unwrap_or(""));
                }
                for c in kids {
                    let cl = c["label"].as_str().unwrap_or("");
                    let b = super::action_badge(c["action"].as_str().unwrap_or(""), cl);
                    println!("{}\t{} > {}\t{}\t{}", if b.is_empty() { "RUST" } else { "TODO" }, title, label, cl, c["action"].as_str().unwrap_or(""));
                }
            }
        }
    }
}

#[cfg(test)]
mod effects_check {
    /// Chaque effet des menus doit produire une image (cargo test effects_check -- --nocapture).
    #[test]
    fn every_menu_effect_runs() {
        let v: serde_json::Value = serde_json::from_str(include_str!("../tools/menus.json").trim_start_matches('\u{feff}')).unwrap();
        let (w, h) = (64usize, 48usize);
        let img: Vec<u8> = (0..w * h * 4).map(|i| if i % 4 == 3 { 255 } else { (i * 37 % 251) as u8 }).collect();
        let mut fails = Vec::new();
        let mut n = 0;
        for m in v["menus"].as_array().unwrap() {
            for it in m["items"].as_array().unwrap() {
                let mut all = vec![it.clone()];
                all.extend(it["children"].as_array().cloned().unwrap_or_default());
                for c in all {
                    let Some(fx) = c["action"].as_str().and_then(|a| a.strip_prefix("fx:")) else { continue };
                    n += 1;
                    let vals = super::effects::dialog(fx).map(|(_, f)| super::effects::Vals::defaults(f)).unwrap_or_default();
                    match super::effects::params(fx, &vals, 0xffffff, 7) {
                        None => fails.push(format!("{fx} : pas de paramètres (non porté)")),
                        Some(("ascii", _)) => {
                            let out = super::ascii::render(&img, w, h, &super::effects::ascii_opts(&vals, 0));
                            if out.iter().skip(3).step_by(4).all(|a| *a == 0) {
                                fails.push("ascii : rien n'est dessiné".into());
                            }
                        }
                        Some((name, p)) => match masterpaint_core::apply_image(name, &img, w, h, &p) {
                            None => fails.push(format!("{fx} -> {name} : le moteur ne connaît pas l'effet")),
                            Some(out) if out == img => fails.push(format!("{fx} -> {name} : image inchangée avec les réglages par défaut")),
                            Some(_) => {}
                        },
                    }
                }
            }
        }
        println!("{n} effets de menu, {} problèmes :\n{}", fails.len(), fails.join("\n"));
    }
}

#[cfg(test)]
mod partial_preview {
    use super::*;

    /// Aperçu limité à une zone : à l'intérieur de la zone, mêmes pixels que l'effet complet ;
    /// hors zone, le calque d'origine.
    #[test]
    fn region_preview_matches_full_effect() {
        let (w, h) = (300usize, 200usize);
        let img: Vec<u8> = (0..w * h * 4).map(|i| if i % 4 == 3 { 255 } else { ((i / 4 % w) * 3 + (i / 4 / w) * 5 + (i % 4) * 40) as u8 }).collect();
        let vals = effects::Vals::default();
        let (name, p) = effects::params("gaussian", &vals, 0xffffff, 1).expect("flou gaussien");
        let full = effect_preview_pixels(w, h, None, &img, name, &p, &vals, 0xffffff, ColorMode::Rgb, None).unwrap();
        let reg = (60, 40, 240, 160);
        let part = effect_preview_pixels(w, h, None, &img, name, &p, &vals, 0xffffff, ColorMode::Rgb, Some(reg)).unwrap();
        // marge de 30 px à l'intérieur de la zone : le flou n'y voit que des pixels calculés
        let mut inner_diff = 0;
        for y in 70..130 {
            for x in 90..210 {
                let i = (y * w + x) * 4;
                if full[i..i + 4] != part[i..i + 4] {
                    inner_diff += 1;
                }
            }
        }
        assert_eq!(inner_diff, 0, "zone intérieure identique à l'effet complet");
        // hors zone : image d'origine
        assert_eq!(part[0..4], img[0..4]);
        assert_ne!(full[(100 * w + 100) * 4..(100 * w + 100) * 4 + 3], img[(100 * w + 100) * 4..(100 * w + 100) * 4 + 3]);
    }
}

#[cfg(target_os = "android")]
#[no_mangle]
fn android_main(app: slint::android::AndroidApp) {
    android_io::initialize(app.clone());
    slint::android::init(app).expect("android_init");
    main();
}
