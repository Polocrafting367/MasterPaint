//! MasterPaint — interface native en Rust (Slint), partagée par le bureau et le web.
//!
//! Mise en page de la version web en mode Paint.NET : barre de menus, barre rapide,
//! ruban (ou barre classique), fenêtres volantes Outils / Couleurs / Calques /
//! Historique, barre d'état. Le dessin, les calques, la sélection et les effets sont
//! calculés en Rust (`editor`, `paint`, `tools`, `masterpaint-core`).

mod ascii;
mod background;
mod colorspace;
mod curves;
mod editor;
mod gallery_gen;
mod gpu;
mod gpuview;
mod groups;
mod vector;
mod effects;
mod effects_gen;
mod illu;
mod settings;
#[cfg(not(target_arch = "wasm32"))]
mod snapshot;
mod sprite_gen;
mod fonts_gen;
mod text;
mod transform;
mod icons_gen;
mod mpicons_gen;
mod paint;
mod photo;
mod raw;
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
    /// tuiles posées sur l'image complète depuis le dernier envoi entier (voir `upload_rect`)
    tiles: Rc<VecModel<CanvasTile>>,
    tile_index: std::collections::HashMap<(usize, usize), usize>,
    /// grande image : seules les tuiles visibles sont composées (voir `LAZY_MIN`)
    lazy: bool,
    /// tuiles de l'affichage à jour (composées et envoyées) en mode `lazy`
    tile_ok: std::collections::HashSet<(usize, usize)>,
    /// mode `lazy` : aperçu réduit de toute l'image (fond sous les tuiles, vignettes) et son pas
    backdrop: Vec<u8>,
    bs: usize,
    /// vignettes des calques, gardées tant que les pixels du calque ne changent pas
    thumbs: Vec<(editor::Px, Image)>,
    /// cadre de la sélection (mis à jour par refresh_all) : animation des fourmis
    sel_bounds: Option<(usize, usize, usize, usize)>,
    /// fenêtre « Filtre dynamique » : modifiée depuis l'ouverture (une étape d'historique à la fermeture)
    dynfx_dirty: bool,
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
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    let sig = workspace_sig(st);
    if sig == st.autosave_sig {
        return;
    }
    // l'encodage d'une grande image prend des secondes : pas pendant un geste (reporté au
    // prochain passage), sauf si la dernière sauvegarde remonte à plus d'une minute
    let t = now_ms();
    if !now && t - LAST_ACTIVITY.with(|a| a.get()) < 1500.0 && t - st.autosave_at < 60_000.0 {
        return;
    }
    st.autosave_at = t;
    st.autosave_sig = sig;
    let (docs, cur) = workspace_docs(st);
    write_autosave(docs, cur, now);
}

thread_local! {
    /// dernier geste de l'utilisateur sur la toile ou le clavier (ms)
    static LAST_ACTIVITY: std::cell::Cell<f64> = const { std::cell::Cell::new(0.0) };
}

fn write_autosave(docs: Vec<Doc>, cur: usize, now: bool) {
    if !AUTOSAVE_ON.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    let write = move || {
        let refs: Vec<&Doc> = docs.iter().collect();
        let bytes = illu::save_all(&refs, cur);
        #[cfg(not(target_arch = "wasm32"))]
        if let Some(p) = autosave_path() {
            if let Some(dir) = p.parent() {
                let _ = std::fs::create_dir_all(dir);
            }
            let tmp = p.with_extension("tmp");
            if std::fs::write(&tmp, &bytes).is_ok() {
                let _ = std::fs::rename(&tmp, &p);
            }
        }
        #[cfg(target_arch = "wasm32")]
        web::store_save(&bytes);
    };
    #[cfg(not(target_arch = "wasm32"))]
    {
        if now {
            write();
        } else {
            std::thread::spawn(write);
        }
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = now;
        write();
    }
}

/// Restaure les onglets de la dernière session (au démarrage, si rien n'a encore été modifié).
fn restore_workspace(app: &AppWindow, st: &mut State, bytes: &[u8]) {
    if st.tabs.len() != 1 || st.doc.hindex != 0 || st.doc.history.len() != 1 {
        return;
    }
    let Ok(l) = illu::load(bytes) else { return };
    let n = l.docs.len();
    let mut docs = l.docs.into_iter();
    let Some(mut first) = docs.next() else { return };
    // jamais exportés : la fermeture d'un onglet restauré demandera confirmation
    first.saved = (usize::MAX, 0);
    st.doc = first;
    for mut d in docs {
        d.saved = (usize::MAX, 0);
        set_document(app, st, d);
    }
    st.autosave_sig = workspace_sig(st);
    refresh_all(app, st);
    app.invoke_zoom_open();
    status(app, if n > 1 { format!("{n} projets restaurés (sauvegarde automatique)") } else { "Projet restauré (sauvegarde automatique)".to_string() });
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

/// Types de filtre dynamique, dans l'ordre de la liste de la fenêtre ƒ (comme la version web).
const DYN_KINDS: [&str; 15] = ["blur", "shadow", "gaussian", "sharpen", "pixelate", "grayscale", "sepia", "invert", "saturate", "brightness", "contrast", "hue", "halftone", "printscreen", "bayer"];

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
    Image::from_rgba8(SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(px, w as u32, h as u32))
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
    let img = image::load_from_memory(bytes).ok()?.to_rgba8();
    let (w, h) = img.dimensions();
    Some((w as usize, h as usize, img.into_raw()))
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
fn sync_mask_ui(app: &AppWindow, on: bool, mode: ColorMode) {
    if app.get_mask_doc() == on {
        return;
    }
    app.set_mask_doc(on);
    if on {
        app.set_wheel_image(gray_ramp(260));
        app.set_color_grid_image(gray_ramp(260));
        let pal: Vec<Color> = (0..28).map(|i| { let v = (i * 255 / 27) as u8; Color::from_rgb_u8(v, v, v) }).collect();
        app.set_mode_palette(ModelRc::new(VecModel::from(pal)));
        snap_color(app, false);
        snap_color(app, true);
        sync_color_fields(app);
    } else {
        // force le rétablissement des images et du nuancier du mode
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
    app.set_color_info(SharedString::from(mode.describe([c.red(), c.green(), c.blue()])));
    // RAL le plus proche de la principale (ruban de la pipette, comme la version web)
    let p = app.get_primary_color();
    app.set_color_ral(SharedString::from(ColorMode::Ral.describe([p.red(), p.green(), p.blue()])));
}

/// Ramène la couleur principale (ou secondaire) dans l'espace du projet. Vrai si elle a changé.
fn snap_color(app: &AppWindow, primary: bool) -> bool {
    let mode = ColorMode::from_index(app.global::<MenuState>().get_color_mode());
    let c = if primary { app.get_primary_color() } else { app.get_secondary_color() };
    let mut m = mode.map([c.red(), c.green(), c.blue()]);
    // masque α : niveaux de gris seulement (luminance)
    if app.get_mask_doc() {
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
    app.set_mode_text(SharedString::from(mode.status()));
    let ms = app.global::<MenuState>();
    if ms.get_color_mode() == mode.index() {
        return;
    }
    ms.set_color_mode(mode.index());
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
        shape_kind: t.get_shape_kind().to_string(),
        sym_x: t.get_sym_x(),
        sym_y: t.get_sym_y(),
        primary: rgba(app.get_primary_color()),
        secondary: rgba(app.get_secondary_color()),
        magnet: t.get_magnet_strength() / 100.0,
        magnet_freq: t.get_magnet_freq(),
    }
}

// ------------------------------------------------------------------ affichage

/// Côté d'une tuile de mise à jour partielle (pixels de l'affichage).
const TILE: usize = 256;

/// Pas de l'affichage à l'échelle de l'écran (1, 2, 4… : voir `Doc::composite_scaled`) : une
/// grande image vue de loin n'est composée et envoyée qu'aux pixels utiles. Les calculs (outils,
/// effets) restent faits sur l'image entière.
fn display_step(app: &AppWindow, doc: &Doc) -> usize {
    if doc.w * doc.h <= 1_500_000 {
        return 1;
    }
    let eff = app.get_zoom() * app.window().scale_factor();
    let mut ds = 1;
    while eff * (ds * 2) as f32 <= 1.0 && ds < 16 {
        ds *= 2;
    }
    ds
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
    let (w, h) = display_dims(st);
    let (ds, dw, dh) = (st.ds, st.doc.w, st.doc.h);
    let (px0, py0) = (tx * TILE, ty * TILE);
    if px0 >= w || py0 >= h || st.display.len() != w * h * 4 {
        return None;
    }
    let (tw, th) = (TILE.min(w - px0), TILE.min(h - py0));
    let mut buf = vec![0u8; tw * th * 4];
    for yy in 0..th {
        let s = ((py0 + yy) * w + px0) * 4;
        buf[yy * tw * 4..(yy + 1) * tw * 4].copy_from_slice(&st.display[s..s + tw * 4]);
    }
    let (docx, docy) = (px0 * ds, py0 * ds);
    Some(CanvasTile { x: docx as i32, y: docy as i32, w: (tw * ds).min(dw - docx) as i32, h: (th * ds).min(dh - docy) as i32, img: to_image(&buf, tw, th) })
}

/// Pose (ou remplace) une tuile dans l'interface.
fn put_tile(st: &mut State, k: (usize, usize)) {
    let Some(tile) = make_tile(st, k) else { return };
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
    let (dw, dh) = display_dims(st);
    app.set_canvas_image(to_image(&st.display, dw, dh));
    if !st.tile_index.is_empty() {
        st.tile_index.clear();
        st.tiles.set_vec(Vec::new());
    }
}

/// Envoie seulement les tuiles qui recouvrent `r` : un coup de pinceau ne renvoie plus toute
/// l'image vers la carte graphique. Au-delà de 60 % de l'image, l'envoi entier est plus simple
/// (sauf en mode `lazy`, où seules les tuiles à jour partent).
fn upload_rect(app: &AppWindow, st: &mut State, r: (usize, usize, usize, usize)) {
    let (w, h) = display_dims(st);
    let (x0, y0, x1, y1) = (r.0.min(w), r.1.min(h), r.2.min(w), r.3.min(h));
    if x1 <= x0 || y1 <= y0 {
        return;
    }
    let (tx0, ty0, tx1, ty1) = (x0 / TILE, y0 / TILE, x1.div_ceil(TILE), y1.div_ceil(TILE));
    if !st.lazy {
        let fresh = (ty0..ty1).flat_map(|ty| (tx0..tx1).map(move |tx| (tx, ty))).filter(|k| !st.tile_index.contains_key(k)).count();
        if (st.tile_index.len() + fresh) * TILE * TILE * 10 > w * h * 6 {
            upload_full(app, st);
            return;
        }
    }
    for ty in ty0..ty1 {
        for tx in tx0..tx1 {
            if st.lazy && !st.tile_ok.contains(&(tx, ty)) {
                continue;
            }
            put_tile(st, (tx, ty));
        }
    }
}

/// Mode `lazy` : compose les tuiles visibles qui ne sont pas à jour (un seul calcul sur leur
/// cadre commun, réparti sur les cœurs), les envoie, et oublie celles parties loin de la vue.
fn ensure_visible(app: &AppWindow, st: &mut State) {
    let (dw, dh) = display_dims(st);
    if !st.lazy || st.display.len() != dw * dh * 4 {
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
            if st.lazy {
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
fn update_dynamic(app: &AppWindow, st: &mut State) {
    if !st.doc.layers.iter().any(|l| l.dynamic.is_some() || l.dyn_cache.is_some()) {
        return;
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = app;
        let g = if GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed) { gpu::get() } else { None };
        st.doc.prepare_dynamic(&mut |src, w, h, stack| {
            g.as_ref().and_then(|g| g.run_stack(src, w, h, stack)).unwrap_or_else(|| editor::cpu_stack(src, w, h, stack))
        });
    }
    #[cfg(target_arch = "wasm32")]
    {
        let Some(g) = gpu::get().filter(|_| GPU_ALLOWED.load(std::sync::atomic::Ordering::Relaxed)) else {
            st.doc.prepare_dynamic(&mut |src, w, h, stack| editor::cpu_stack(src, w, h, stack));
            return;
        };
        let (w, h) = (st.doc.w, st.doc.h);
        for j in st.doc.dynamic_jobs() {
            let (g, weak) = (g.clone(), app.as_weak());
            wasm_bindgen_futures::spawn_local(async move {
                let img = match g.run_stack(&j.src, w, h, &j.stack).await {
                    Some(img) => img,
                    None => editor::cpu_stack(&j.src, w, h, &j.stack),
                };
                let Some(app) = weak.upgrade() else { return };
                let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
                let Ok(mut st) = state.try_borrow_mut() else { return };
                let st = &mut *st;
                st.doc.set_dynamic(j.uid, j.serial, img);
                redraw_canvas(&app, st);
            });
        }
    }
}

/// Recompose toute la toile (sans toucher aux panneaux).
fn redraw_canvas(app: &AppWindow, st: &mut State) {
    compose_display(app, st);
    upload_full(app, st);
}

/// Contenu hors toile (option « Hors toile ») affiché autour de la toile.
fn sync_outside(app: &AppWindow, st: &State) {
    let shown = app.global::<ToolOpts>().get_outside_canvas();
    match st.doc.outside_composite().filter(|_| shown) {
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
        if fresh || !gpuview::compose(app, st, gpuview::Target::Display, (0, 0, dw, dh)) {
            gpuview::cpu(st, gpuview::Target::Display, (0, 0, dw, dh));
        }
        st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, (0, 0, dw, dh));
        return;
    }
    compose_backdrop(app, st);
    let (tx0, ty0, tx1, ty1) = visible_tiles(app, st);
    let r = (tx0 * TILE, ty0 * TILE, (tx1 * TILE).min(dw), (ty1 * TILE).min(dh));
    if r.2 > r.0 && r.3 > r.1 {
        // tuiles vides en attendant la carte graphique : l'aperçu de fond se voit au travers
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
    st.dyn_timer.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(if gpu_ready() { 16 } else { 120 }), move || {
        let Some(app) = weak.upgrade() else { return };
        let Some(state) = APP_STATE.with(|s| s.borrow().clone()) else { return };
        let Ok(mut st) = state.try_borrow_mut() else { return };
        let st = &mut *st;
        update_dynamic(&app, st);
        redraw_canvas(&app, st);
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

/// Recompose tout l'affichage et met à jour les panneaux.
fn refresh_all(app: &AppWindow, st: &mut State) {
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
    upload_full(app, st);
    sync_panels(app, st);
}

/// Recompose seulement un rectangle (pendant un trait de pinceau).
fn refresh_rect(app: &AppWindow, st: &mut State, r: Option<(usize, usize, usize, usize)>) {
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
            win.set_info(format!("{w} × {h} px — 1 pixel de l'image = 1 pixel de l'écran").into());
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
    if app.get_show_live() {
        app.set_live_image(to_image(&flat, w, h));
    }
    #[cfg(target_arch = "wasm32")]
    if external {
        web::preview_update(&flat, w, h);
    }
    #[cfg(not(target_arch = "wasm32"))]
    if external {
        let img = to_image(&flat, w, h);
        PREVIEW_WIN.with(|p| {
            if let Some(win) = p.borrow().as_ref() {
                win.set_source(img);
                win.set_info(format!("{w} × {h} px — 1 pixel de l'image = 1 pixel de l'écran").into());
            }
        });
    }
}

fn sync_panels(app: &AppWindow, st: &mut State) {
    live_refresh(app, st);
    sync_sym(app, st);
    sync_layer_blocks(app, st);
    sync_tabs(app, st);
    // vignettes : recalculées seulement pour les calques dont les pixels ont changé
    let old = std::mem::take(&mut st.thumbs);
    st.thumbs = st
        .doc
        .layers
        .iter()
        .map(|l| match old.iter().find(|(p, _)| p.same(&l.px)) {
            Some((p, img)) => (p.clone(), img.clone()),
            None => (l.px.clone(), thumb(&l.px, st.doc.w, st.doc.h)),
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
    sync_mask_ui(app, d.mask_of.is_some(), d.mode);
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
                fx_count: l.vector.as_ref().map_or(0, |v| v.effects.len() as i32),
            }
        })
        .collect();
    app.set_layers(ModelRc::new(VecModel::from(rows)));
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
                HistoryItem { label: label.into(), fa: history_icon(i, &s.label).to_string().into() }
            })
            .collect();
        app.set_history(ModelRc::new(VecModel::from(items)));
    }
    app.set_history_index(d.hindex as i32);
    let b = d.selection_bounds();
    st.sel_bounds = b;
    app.set_has_selection(b.is_some());
    app.set_selection_text(SharedString::from(match b {
        Some((x0, y0, x1, y1)) => format!("Sélection : {} × {} px", x1 - x0, y1 - y0),
        None => String::new(),
    }));
}

/// Message de la barre d'état : affiché quelques secondes, puis effacé.
fn status(app: &AppWindow, msg: impl Into<String>) {
    thread_local! {
        static CLEAR: slint::Timer = slint::Timer::default();
    }
    let msg = msg.into();
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
    md.layers[0].name = "Masque".into();
    md.mask_of = Some((du, lu));
    md.history[0].label = "Masque α".into();
    let at = st.cur + 1;
    open_document_at(app, st, md, at);
    status(app, "Masque α : blanc = visible, noir = masqué");
}

/// Remplit la fenêtre « Filtre dynamique » d'après le calque actif.
fn sync_dynfx(app: &AppWindow, st: &State) {
    let l = st.doc.layer();
    let list = l.dynamic.as_ref().unwrap_or(&l.dyn_saved);
    let rows: Vec<DynFx> = if list.is_empty() {
        vec![DynFx { kind: 0, radius: 6.0 }]
    } else {
        list.iter().map(|(t, r)| DynFx { kind: DYN_KINDS.iter().position(|k| k == t).unwrap_or(0) as i32, radius: *r }).collect()
    };
    app.set_dynfx_enabled(l.dynamic.is_some());
    // choix « Zone dessinée » (0) / « Partout » (2)
    app.set_dynfx_mode(if l.dynamic_mode == 2 { 1 } else { 0 });
    app.set_dynfx_stack(ModelRc::new(VecModel::from(rows)));
}

fn dynfx_changed(app: &AppWindow, state: &Shared, action: &str, i: usize, v: f32) {
    let mut st = state.borrow_mut();
    let st = &mut *st;
    if action == "close" {
        app.set_show_dynfx(false);
        if st.dynfx_dirty {
            st.dynfx_dirty = false;
            st.doc.commit("Filtre dynamique");
            refresh_all(app, st);
        }
        return;
    }
    if st.doc.layer().mask.is_some() {
        status(app, "Masque α actif : retirez-le pour utiliser le filtre dynamique (ƒ).");
        return;
    }
    let l = st.doc.layer_mut();
    // la chaîne modifiée : celle en service, ou celle gardée quand le filtre est désactivé
    let on = l.dynamic.is_some();
    {
        let list = if on { l.dynamic.as_mut().unwrap() } else { &mut l.dyn_saved };
        if list.is_empty() {
            list.push(("blur".into(), 6.0));
        }
        let n = list.len();
        match action {
            "add" if n < 8 => list.push(("blur".into(), 6.0)),
            "up" if i > 0 && i < n => list.swap(i, i - 1),
            "down" if i + 1 < n => list.swap(i, i + 1),
            "remove" if n > 1 && i < n => {
                list.remove(i);
            }
            "kind" if i < n => list[i].0 = DYN_KINDS.get(v as usize).unwrap_or(&"blur").to_string(),
            "radius" if i < n => list[i].1 = v.clamp(1.0, 32.0),
            _ => {}
        }
    }
    match action {
        "enable" => {
            if v > 0.5 {
                l.dynamic = Some(std::mem::take(&mut l.dyn_saved));
            } else if let Some(d) = l.dynamic.take() {
                l.dyn_saved = d;
            }
        }
        "mode" => l.dynamic_mode = if v > 0.5 { 2 } else { 0 },
        _ => {}
    }
    st.dynfx_dirty = true;
    if action == "radius" {
        // curseur : la ligne seule est mise à jour (le glisser continue), rendu différé
        if let Some(mut row) = app.get_dynfx_stack().row_data(i) {
            row.radius = v.clamp(1.0, 32.0);
            app.get_dynfx_stack().set_row_data(i, row);
        }
        let weak = app.as_weak();
        let state2 = state.clone();
        st.dyn_timer.start(slint::TimerMode::SingleShot, std::time::Duration::from_millis(120), move || {
            if let (Some(app), Ok(mut st)) = (weak.upgrade(), state2.try_borrow_mut()) {
                refresh_all(&app, &mut st);
            }
        });
        return;
    }
    sync_dynfx(app, st);
    refresh_all(app, st);
}

// ------------------------------------------------------------------ fichiers

/// Termine les éditions en cours avant de changer d'image.
fn finish_edits(app: &AppWindow, st: &mut State) {
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

/// Ferme un onglet ; la dernière image fermée laisse place à une page blanche.
/// Fermeture demandée par l'utilisateur : confirmation si l'onglet a des modifications non
/// exportées (elles restent dans la sauvegarde automatique tant que l'onglet est ouvert).
fn request_close_tab(app: &AppWindow, st: &mut State, i: usize) {
    let doc = if i == st.cur { Some(&st.doc) } else { st.tabs.get(i).and_then(|t| t.as_ref()) };
    let Some(doc) = doc else { return };
    if doc.modified() && doc.mask_of.is_none() {
        let thumb = TaskThumb { name: doc.title.as_str().into(), image: px_thumb(&doc.flatten(), doc.w, doc.h, 180, 135) };
        let intro = format!("« {} » contient des modifications non enregistrées. Que voulez-vous faire ?", doc.title);
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
    if i != st.cur {
        st.tabs.remove(i);
        if i < st.cur {
            st.cur -= 1;
        }
    } else if st.tabs.len() == 1 {
        st.doc = Doc::new(1280, 720, [255, 255, 255, 255], "Sans titre 1");
    } else {
        st.tabs.remove(i);
        let ni = i.min(st.tabs.len() - 1);
        st.doc = st.tabs[ni].take().unwrap_or_else(|| Doc::new(1280, 720, [255, 255, 255, 255], "Sans titre 1"));
        st.cur = ni;
    }
    st.session = Session::default();
    refresh_all(app, st);
    app.invoke_zoom_fit();
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
        format!("MasterPaint Rust {APP_VERSION} — web — {ua}")
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        format!("MasterPaint Rust {APP_VERSION} — application {} {}", std::env::consts::OS, std::env::consts::ARCH)
    }
}

/// Paramètres › Infos techniques : version, appareil, rendu, accélération, calculs en
/// arrière-plan, mémoire des images et de l'historique.
fn refresh_tech_info(app: &AppWindow, st: &State) {
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
    let info = format!(
        "{}\nRendu de l'interface : Slint (Rust) — fenêtre {} × {} px, échelle {:.2}\nAccélération : {}\nProcesseur : {cores} cœurs ; calculs lourds : {background}\nImages ouvertes : {} onglet(s), {:.0} Mo de pixels ; historique : {:.0} Mo (au plus {} étapes)\nImage active : {} × {} px, {} calque(s), zoom {:.0} %, affichage {}",
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
        if st.lazy { format!("par tuiles visibles (pas {})", st.ds) } else if st.ds > 1 { format!("réduit (pas {})", st.ds) } else { "pleine résolution".to_string() },
    );
    app.set_tech_info(info.into());
}

/// Fenêtre d'erreur : message, détails (appareil, contexte, journal) et « Signaler l'erreur »
/// qui ouvre le formulaire de rapport déjà rempli.
fn show_error(app: &AppWindow, context: &str, message: &str) {
    applog::log(format!("ERREUR [{context}] {message}"));
    let doc = app.get_doc_title();
    let details = format!(
        "{}\nContexte : {context}\nImage : {doc} ({} × {} px), zoom {:.0} %, outil {}\nErreur : {message}\n\nJournal :\n{}",
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
}

fn show_task(app: &AppWindow, title: &str, intro: &str, info: &str, header: &str, commands: &[(&str, &str)], thumbs: Vec<TaskThumb>) {
    app.set_task_title(title.into());
    app.set_task_intro(intro.into());
    app.set_task_info(info.into());
    app.set_task_list_header(header.into());
    let cmds: Vec<TaskCommand> = commands.iter().map(|(t, x)| TaskCommand { title: (*t).into(), text: (*x).into(), glyph: "".into() }).collect();
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

fn sync_tabs(app: &AppWindow, st: &mut State) {
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
    if app.get_set_header_preview() || app.get_set_glass() {
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
                        let img = px_thumb(&doc.flatten(), doc.w, doc.h, 68, 47);
                        new_thumbs.push((doc.uid, key, img.clone()));
                        img
                    }
                }
            };
            DocTab { title: SharedString::from(doc.title.as_str()), thumb, active: i == st.cur, linked: false, link_left: false, link_right: false, mask: doc.mask_of.is_some() }
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
    app.set_tabs(ModelRc::new(VecModel::from(tabs)));
}

fn open_file(app: &AppWindow, state: &Shared) {
    let weak = app.as_weak();
    let state = state.clone();
    #[cfg(target_arch = "wasm32")]
    let task = async move {
        // web : sélecteur de fichier du navigateur
        let Some((name, bytes)) = web::pick_file(&format!("image/*,.illu,{}", raw_accept())).await else { return };
        let Some(app) = weak.upgrade() else { return };
        load_bytes(&app, &state, &name, bytes);
    };
    #[cfg(not(target_arch = "wasm32"))]
    let task = async move {
        let all: Vec<&str> = ["png", "jpg", "jpeg", "webp", "bmp", "gif", "ico", "tif", "tiff", "illu"].into_iter().chain(raw::EXTENSIONS.iter().copied()).collect();
        let Some(file) = rfd::AsyncFileDialog::new()
            .add_filter("Images, photos RAW et projets MasterPaint", &all)
            .add_filter("Projet MasterPaint (.illu)", &["illu"])
            .add_filter("Photos RAW", raw::EXTENSIONS)
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
    start_load(app, &mut state.borrow_mut(), LoadTo::Tabs, vec![(name.to_string(), bytes)]);
}

/// Encode l'image aplatie (PNG, JPEG, WebP sans perte, BMP selon l'extension).
fn encode(doc: &Doc, ext: &str) -> Option<Vec<u8>> {
    let flat = doc.flatten();
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
    let mut flat = doc.flatten();
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
        _ => ("png", "image/png", "PNG"),
    };
    let bytes = {
        let st = state.borrow();
        if fmt == "illu" {
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
        show_error(app, "Exporter", &format!("L'image n'a pas pu être encodée au format {fmt}."));
        return;
    };
    let name = {
        let n = name.trim();
        let n = if n.is_empty() { "image" } else { n };
        format!("{n}.{ext}")
    };
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = mime;
        let Some(path) = rfd::FileDialog::new().set_file_name(&name).add_filter(label, &[ext]).save_file() else { return };
        if std::fs::write(&path, &bytes).is_ok() {
            state.borrow_mut().doc.mark_saved();
            app.set_show_export(false);
            status(app, format!("Exporté : {}", path.display()));
        } else {
            show_error(app, "Exporter", &format!("Écriture impossible : {}", path.display()));
        }
    }
    #[cfg(target_arch = "wasm32")]
    {
        let _ = label;
        web::download_bytes(&bytes, &name, mime);
        state.borrow_mut().doc.mark_saved();
        app.set_show_export(false);
        status(app, format!("Exporté : {name}"));
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
    #[cfg(not(target_arch = "wasm32"))]
    {
        let Some(path) = rfd::FileDialog::new()
            .set_file_name(format!("{base}.png"))
            .add_filter("PNG", &["png"])
            .add_filter("Projet MasterPaint (.illu)", &["illu"])
            .add_filter("JPEG", &["jpg", "jpeg"])
            .add_filter("WebP", &["webp"])
            .add_filter("BMP", &["bmp"])
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
        status(app, if res.is_some() { format!("Exporté : {}", path.display()) } else { "Échec de l'export".into() });
    }
    #[cfg(target_arch = "wasm32")]
    {
        if let Some(bytes) = encode(&state.borrow().doc, "png") {
            web::download_bytes(&bytes, &format!("{base}.png"), "image/png");
            state.borrow_mut().doc.mark_saved();
            status(app, "Image exportée (PNG)");
        }
    }
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
    app.set_status_text(SharedString::from(format!("Recadrage : {} × {} px", w.round(), h.round())));
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
                // curseur : déplacement à l'intérieur du cadre
                let (rx, ry, rw, rh) = c.r;
                app.set_canvas_cursor(if x >= rx && x <= rx + rw && y >= ry && y <= ry + rh { 1 } else { 0 });
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
        app.set_rs_preset_labels(ModelRc::new(VecModel::from(std::iter::once(SharedString::from("Choisir une taille…")).chain(presets.iter().map(|p| p.label.clone())).collect::<Vec<_>>())));
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
                let extra = if tag.is_empty() { ratio } else { format!("{ratio}, {tag}") };
                out.push((pw, ph, format!("{pw} × {ph} ({extra})")));
            }
            break;
        }
    }
    if out.is_empty() {
        for tw in [3840usize, 2560, 1920, 1280, 1024, 800, 640] {
            let th = ((tw as f32 / r).round() as usize).max(1);
            out.push((tw, th, format!("{tw} × {th}")));
        }
    }
    for (f, tag) in [(2.0f32, "200 %"), (0.5, "50 %")] {
        let (pw, ph) = (((w as f32 * f).round() as usize).max(1), ((h as f32 * f).round() as usize).max(1));
        out.push((pw, ph, format!("{pw} × {ph} ({tag})")));
    }
    out.into_iter()
        .filter(|(pw, ph, _)| *pw <= 16384 && *ph <= 16384 && (*pw, *ph) != (w, h))
        .map(|(pw, ph, label)| SizePreset { label: label.into(), w: pw.to_string().into(), h: ph.to_string().into() })
        .collect()
}

/// Liens de téléchargement de l'application installable.
fn download_url(kind: &str) -> String {
    let file = match kind {
        "windows-exe" => format!("MasterPaint-{APP_VERSION}-windows-x64.exe"),
        // installeur NSIS de la version Rust (rust/desktop/installer/masterpaint.nsi)
        "windows-setup" => format!("MasterPaint_{APP_VERSION}_x64-setup.exe"),
        "linux-tar" => format!("MasterPaint_{APP_VERSION}_linux_x86_64.tar.gz"),
        "linux-flatpak" => "fr.masterpaint.app.flatpak".to_string(),
        // AppImage : build-all.sh la refait sans appimagetool (lanceur repris + mksquashfs)
        "linux-appimage" => format!("MasterPaint_{APP_VERSION}_amd64.AppImage"),
        _ => format!("MasterPaint_{APP_VERSION}_universal.dmg"),
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
    let with_pct = |t: &str| if total > 0.0 { format!("{t} {pct:.0} %") } else { t.to_string() };
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
    app.set_rmbg_warn(SharedString::from(if big {
        "Image très grande : le traitement peut être lent ou saturer la mémoire."
    } else {
        ""
    }));
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
        app.set_rmbg_text(SharedString::from("Chargement du module IA…"));
        applog::log(format!("Supprimer le fond (IA) : {w} × {h} px, modèle {model}, plume {feather}"));
        let (weak, state) = (app.as_weak(), state.clone());
        let _ = slint::spawn_local(async move {
            let t0 = now_ms();
            let wk = weak.clone();
            let res = web::remove_bg(&base, w, h, model, move |k, c, t| {
                if let Some(app) = wk.upgrade() {
                    let (text, pct) = rmbg_step(&k, c, t);
                    app.set_rmbg_text(SharedString::from(text));
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
                    status(&app, format!("Supprimer le fond (IA) : {:.1} s", (now_ms() - t0) / 1000.0));
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
                        &format!("Impossible de supprimer le fond ({why}). Vérifiez la connexion (premier usage : téléchargement du modèle), un bloqueur de script, ou essayez un navigateur récent."),
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
        if let Ok(mut cb) = arboard::Clipboard::new() {
            let _ = cb.set_image(arboard::ImageData { width: w, height: h, bytes: std::borrow::Cow::Borrowed(&px) });
        }
    }
    applog::log(format!("Copier : {w} × {h} px"));
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
            Some((w, h, _)) => format!("Coller : image reçue ({w} × {h} px)"),
            None => format!("Coller : rien reçu du système ({})", web::clipboard_error()),
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
                        &format!("Aucune image à coller. Le navigateur n'a pas donné le contenu du presse-papiers{}.", if why.is_empty() { String::new() } else { format!(" : {why}") }),
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
    let n = st.tabs.len() + 1;
    let mut doc = Doc::from_pixels(c.w, c.h, c.px, &format!("Sans titre {n}"));
    doc.saved = (usize::MAX, 0);
    set_document(app, st, doc);
}

/// Colle des images en calques ; si l'une dépasse la toile, demande d'abord s'il faut
/// l'agrandir (Paint.NET : « L'image collée est plus grande que la toile »).
fn paste_clips(app: &AppWindow, st: &mut State, clips: Vec<(Clip, &'static str, Option<String>)>) {
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
    if raw::is_raw(&name) || name.to_lowercase().ends_with(".illu") {
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

/// Répéter (Ctrl+F, menu) : dernier effet avec tous les réglages de sa fenêtre (aberration
/// chromatique comprise) et sa portée.
fn repeat_effect(app: &AppWindow, st: &mut State) {
    let Some((n, p, l)) = st.last_effect.clone() else { return };
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
    // calque texte : effet ajouté à sa pile (non destructif)
    if scope != 2 && vector_layer_effect(app, st, name, params, effects::post_chromatic(name, &vals), label) {
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
            status(app, format!("{} : effet indisponible dans le moteur Rust", ctx.title));
            return;
        }
        st.doc.commit(&ctx.title);
        refresh_all(app, st);
        status(app, format!("{} : {:.0} ms", ctx.title, now_ms() - ctx.t0));
        return;
    };
    if ctx.total > 1 {
        load_progress(app, (ctx.total - ctx.targets.len()) as f32 / ctx.total as f32, &format!("Calque {} sur {}", ctx.total - ctx.targets.len(), ctx.total));
    }
    let (w, h, mode) = (st.doc.w, st.doc.h, st.doc.mode);
    let src = base.arc();
    let job = if ctx.name == "ascii" {
        let (v, s2, sec) = (ctx.vals.clone(), src.clone(), ctx.secondary);
        background::Heavy::Local(Box::new(move || Some(ascii::render(&s2, w, h, &effects::ascii_opts(&v, sec)))))
    } else {
        background::Heavy::Effect { name: ctx.name.clone(), src: src.clone(), w, h, p: ctx.p.clone(), post: effects::post_chromatic(&ctx.name, &ctx.vals) }
    };
    background::spawn(app, st, job, move |app, st, out| {
        if st.doc.uid != ctx.uid || st.doc.w != w || st.doc.h != h {
            end_busy(app);
            status(app, format!("{} : abandonné (l'image a changé)", ctx.title));
            return;
        }
        if let Some(mut px) = out {
            mode.constrain(&mut px);
            blend_selection(&mut px, &src, ctx.sel.as_deref());
            let as_mask = effects::chroma_as_mask(&ctx.name, &ctx.vals);
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
        app.set_load_title(title.into());
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
    effects_gen::SECTIONS.iter().find(|s| s.0 == effect && s.1 == field).map(|s| (s.2, s.3))
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
            out.extend(t.map(RowRef::Field));
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
            RowRef::Head(sec) => EffectField { section: sec.into(), collapsed: es.folded.contains(sec), ..blank(5, String::new()) },
            RowRef::Rgb(t) => {
                let rgb = t.map(|k| num(k).round().clamp(0.0, 255.0) as u8);
                nth_trio += 1;
                let label = match (es.id.as_str(), nth_trio) {
                    ("chroma", 1) => "Couleur clé".to_string(),
                    ("chroma", _) => "2e couleur clé".to_string(),
                    (_, 1) => "Couleur".to_string(),
                    (_, n) => format!("Couleur {n}"),
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
                    label: SharedString::from(f.label),
                    kind: f.kind as i32,
                    minimum: f.min,
                    maximum: f.max,
                    step: f.step,
                    value,
                    text: SharedString::from(s),
                    options: ModelRc::new(VecModel::from(f.options.iter().map(|o| SharedString::from(o.1)).collect::<Vec<_>>())),
                    default_value: f.def,
                    swatch,
                    section: SharedString::default(),
                    collapsed: false,
                    track_kind,
                    track_a,
                    track_b,
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
fn apply_preview(app: &AppWindow, st: &mut State, gen: u64, px: Option<Vec<u8>>, ms: f64, lod: usize) {
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
        st.doc.layer_mut().px = px.into();
        let (w, h) = (st.doc.w, st.doc.h);
        refresh_rect(app, st, Some((0, 0, w, h)));
        // aperçu réduit gardé pendant les réglages : la pleine résolution n'est calculée qu'à OK
        app.set_effect_info(SharedString::from(if lod > 1 { format!("Aperçu réduit : {ms:.0} ms — pleine résolution à la validation") } else { format!("Aperçu : {ms:.0} ms") }));
    }
    if queued {
        preview_effect(app, st);
    }
}

/// Ouvre un effet : fenêtre de réglages si l'effet en a une, sinon application directe.
fn open_effect(app: &AppWindow, st: &mut State, id: &str, label: &str) {
    drop_floating(app, st);
    if st.effect.is_some() {
        cancel_effect(app, st);
    }
    // calque verrouillé ou dossier : pas d'effet
    if let Some(why) = st.doc.edit_refusal() {
        status(app, why);
        return;
    }
    let label = label.trim_end_matches('…').trim_end_matches("...").trim().to_string();
    match effects::dialog(id) {
        None => {
            match effects::params(id, &effects::Vals::default(), 0xffffff, 1) {
                Some((name, p)) => run_effect(app, st, name, &p, &label),
                None => status(app, format!("« {label} » : pas encore porté dans la version Rust")),
            }
        }
        Some((title, fields)) => {
            let vals = st.effect_memory.get(id).cloned().unwrap_or_else(|| effects::Vals::defaults(fields));
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
                folded: effects_gen::SECTIONS.iter().filter(|s| s.0 == id && s.3).map(|s| s.2).collect(),
                pick: None,
                partial: false,
                lod: 1,
                reduced: None,
                others: Vec::new(),
            };
            es.rows = build_rows(&es);
            app.set_effect_title(SharedString::from(title));
            app.set_effect_fields(ModelRc::new(VecModel::from(effect_rows(app, &es))));
            app.set_show_effect(true);
            st.effect = Some(es);
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

/// Au-delà de ce nombre de pixels, une grande image vue de loin a d'abord un aperçu réduit.
const LOD_MIN: usize = 3_000_000;

fn preview_effect_at(app: &AppWindow, st: &mut State, full: bool) {
    let sec = rgba(app.get_secondary_color());
    let secondary = (sec[0] as u32) << 16 | (sec[1] as u32) << 8 | sec[2] as u32;
    // portée « Calque actif » : l'effet ignore la sélection
    let sel = if app.get_effect_scope() == 1 { None } else { st.doc.sel.clone() };
    let (w, h, mode, ds) = (st.doc.w, st.doc.h, st.doc.mode, st.ds);
    let Some(es) = st.effect.as_mut() else { return };
    let Some((name, p)) = effects::params(&es.id, &es.vals, secondary, es.seed) else {
        app.set_effect_info(SharedString::from(if SPECIAL_DIALOGS.contains(&es.id.as_str()) {
            "Appliqué à la validation (OK)"
        } else {
            "Aperçu indisponible : effet pas encore porté en Rust"
        }));
        return;
    };
    if es.running {
        es.queued = true;
        return;
    }
    // grande image + effet local : seule la zone visible (et une marge) est calculée
    let region = visible_region(app, w, h, name, &p);
    let lod = if full || region.is_some() || w * h < LOD_MIN || ds < 2 { 1 } else { ds };
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
    } else if let Some((x0, y0, x1, y1)) = region {
        let (cw, ch) = (x1 - x0, y1 - y0);
        let mut crop = Vec::with_capacity(cw * ch * 4);
        for y in y0..y1 {
            crop.extend_from_slice(&es.base[(y * w + x0) * 4..(y * w + x1) * 4]);
        }
        let csel = sel.as_ref().map(|m| (y0..y1).flat_map(|y| m[y * w + x0..y * w + x1].to_vec()).collect::<Vec<u8>>());
        (std::sync::Arc::new(crop), csel, cw, ch)
    } else {
        (es.base.arc(), sel, w, h)
    };
    let base = es.base.clone();
    let post = effects::post_chromatic(name, &vals);
    let job = preview_job(name, src.clone(), sw, sh, &p, post.clone(), &vals, secondary);
    let t0 = now_ms();
    background::spawn(app, st, job, move |app, st, out| {
        let px = out.map(|o| finish_preview(o, &src, ssel.as_deref(), region, lod, &base, (w, h), (sw, sh), mode));
        apply_preview(app, st, gen, px, now_ms() - t0, lod);
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
        let csel = sel.map(|m| (y0..y1).flat_map(|y| m[y * w + x0..y * w + x1].to_vec()).collect::<Vec<u8>>());
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
            if st.effect.as_ref().is_some_and(|e| e.partial) {
                preview_effect(&app, &mut st);
            }
        })
    });
}

fn cancel_effect(app: &AppWindow, st: &mut State) {
    restore_effect_others(st);
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
            let mut p = effects::content_fill_params(&es.vals);
            p.push((es.seed & 0xffff) as f32);
            let (w, h, uid, luid) = (st.doc.w, st.doc.h, st.doc.uid, st.doc.layer().uid);
            let title = es.title.clone();
            begin_busy(app, &title, "Reconstitution de la zone…", true);
            let job = background::Heavy::Fill { src: es.base.arc(), mask: std::sync::Arc::new(mask), w, h, p };
            background::spawn(app, st, job, move |app, st, out| {
                end_busy(app);
                if st.doc.uid != uid || st.doc.w != w || st.doc.h != h {
                    return status(app, format!("{title} : abandonné (l'image a changé)"));
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
    let Some(es) = st.effect.take() else { return };
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
    // l'aperçu affiché n'est pas le résultat final (calcul en cours, zone visible, aperçu
    // réduit) : calcul en pleine résolution ; portée « Tous les calques » : les autres aussi
    // (incrustation en masque α : l'aperçu a modifié les pixels, le calcul final va au masque)
    let stale = es.shown != es.want || es.running || es.partial || es.lod > 1 || effects::chroma_as_mask(name, &es.vals);
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

fn open_curves(app: &AppWindow, st: &mut State) {
    finish_edits(app, st);
    st.curves = Some(CurvesSession {
        base: st.doc.layer().px.clone(),
        ch: [curves::identity(), curves::identity(), curves::identity(), curves::identity()],
        active: 0,
        ed: Default::default(),
    });
    sync_curves(app, st, true);
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
    let base = cs.base.clone();
    if let Some(px) = compute_effect(&st.doc, &base, "curves", &p) {
        st.doc.layer_mut().px = px.into();
        let (w, h) = (st.doc.w, st.doc.h);
        refresh_rect(app, st, Some((0, 0, w, h)));
    }
}

fn curves_action(app: &AppWindow, st: &mut State, action: &str, i: usize) {
    match action {
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
            if let Some(cs) = st.curves.take() {
                if cs.ch.iter().any(|c| *c != curves::identity()) {
                    st.last_effect = Some(("curves".into(), curves::engine_params(&cs.ch), "Courbes".into()));
                    st.last_effect_vals = None;
                    st.doc.commit("Courbes");
                }
            }
            app.set_show_curves(false);
            refresh_all(app, st);
        }
        _ => {
            if let Some(cs) = st.curves.take() {
                st.doc.layer_mut().px = cs.base;
            }
            app.set_show_curves(false);
            refresh_all(app, st);
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
        Tool::RectSelect => Some(transform::Kind::MoveSelection),
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
        let on_target = st.floating.as_ref().map_or(false, |f| f.contains(x, y) || !matches!(f.hit(x, y, tol, 0.0, false), transform::Grab::Translate));
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
                    let r = f.render(&mut st.doc);
                    refresh_rect(app, st, r);
                    show_handles(app, st);
                }
            } else if tk == transform::Kind::MoveSelection {
                if st.session.busy() {
                    return false;
                }
                let on_handle = st.floating.as_ref().map_or(false, |f| matches!(f.hit(x, y, tol, 0.0, false), transform::Grab::Edge(_)));
                app.set_canvas_cursor(if on_handle { 2 } else { 0 });
                return false;
            } else {
                // survol : curseur selon la zone (poignée, rotation, déplacement)
                let (cur, hint) = match &st.floating {
                    Some(f) => match f.hit(x, y, tol, rot, false) {
                        transform::Grab::Edge(_) | transform::Grab::Corner(_) => (2, false),
                        transform::Grab::Rotate => (3, true),
                        transform::Grab::Translate => (1, false),
                    },
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
                *o = vector::TextObj { text: content, font: font_name, size: t.get_font_size(), color, align: t.get_text_align(), antialias: t.get_antialias(), x: tx, y: ty };
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
                    st.doc.layers.insert(0, editor::Layer::new("Calque 1", st.doc.w, st.doc.h, [0, 0, 0, 0]));
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
            if let Some(i) = v.hit_index(&mut st.fonts, x, y) {
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
    if app.global::<ToolOpts>().get_text_layer() && st.doc.mask_of.is_none() {
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
        l.name = format!("Texte {n}");
        l.vector = Some(Box::new(vector::VectorLayer::with_text(vector::TextObj {
            text: String::new(),
            font: String::new(),
            size: 32.0,
            color: [0, 0, 0, 255],
            align: 0,
            antialias: true,
            x,
            y,
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
        status(app, format!("{label} : indisponible sur un calque texte (Calques › Pixelliser le calque)"));
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
    status(app, format!("{label} : ajouté aux effets du calque texte (modifiables, non destructifs)"));
    true
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
                    let b = item_badge(mark, &c.action, &c.label);
                    if c.badge.as_str() != b {
                        c.badge = b.into();
                        it.children.set_row_data(k, c);
                    }
                }
            } else {
                let b = item_badge(mark, &it.action, &it.label);
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
    matches!(t, Tool::Brush | Tool::Pencil | Tool::Eraser | Tool::Fill | Tool::Gradient | Tool::Shape | Tool::RoundRect | Tool::Line)
}

/// Le calque actif refuse les pixels (verrou, dossier) : message, `true`. Calque texte :
/// propose de le pixelliser d'abord.
fn layer_guard(app: &AppWindow, st: &mut State) -> bool {
    if let Some(why) = st.doc.edit_refusal() {
        status(app, why);
        return true;
    }
    if st.doc.layer().vector.is_some() {
        st.task = Some(Task::Rasterize(st.doc.layer().uid));
        show_task(
            app,
            "Calque texte",
            "Ce calque est un calque texte. Pour y peindre, il doit d'abord être pixellisé : le texte ne sera plus modifiable.",
            "",
            "",
            &[
                ("Pixelliser le calque", "Transforme le texte et ses effets en pixels ordinaires, puis vous pouvez peindre."),
                ("Annuler", "Garde le calque texte modifiable (outil Texte ou Déplacer)."),
            ],
            Vec::new(),
        );
        return true;
    }
    false
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
            status(app, "Cliquez sur un texte du calque pour le déplacer");
            return true;
        };
        st.vector_drag = Some((st.doc.layer().uid, x.round(), y.round(), i, false));
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
            st.doc.commit("Déplacer le texte");
            refresh_all(app, st);
        }
    }
    true
}

/// Opérations du panneau et du menu Calques (dossiers compris).
fn layer_op(app: &AppWindow, st: &mut State, a: &str) {
    drop_floating(app, st);
    commit_text(app, st);
    let r: Result<&str, groups::Refused> = match a {
        "add" => {
            st.doc.add_layer_in();
            Ok("Ajouter un calque")
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

/// Liste des effets du calque texte actif (fenêtre « Effets du calque texte »).
fn sync_text_fx(app: &AppWindow, st: &State) {
    let rows: Vec<TextFxRow> = st
        .doc
        .layer()
        .vector
        .as_ref()
        .map(|v| v.effects.iter().map(|f| TextFxRow { label: f.label.as_str().into(), on: f.on }).collect())
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
        _ => {}
    }
    st.session.cancel(&mut st.doc);
    drop_floating(app, st);
    app.set_overlay_path(SharedString::default());
    commit_text(app, st);
    st.tool = Tool::from_id(id);
    app.set_current_tool(SharedString::from(id));
    prepare_handles(app, st);
    let tools = app.global::<Generated>().get_tools();
    // structure anonyme vue comme un tuple, champs par ordre alphabétique : (h, icon, id, title, w, x, y)
    let title = (0..tools.row_count()).filter_map(|i| tools.row_data(i)).find(|t| t.2 == id).map(|t| t.3).unwrap_or_default();
    app.set_tool_title(title);
    if st.tool == Tool::Unsupported {
        status(app, "Cet outil n'est pas encore porté dans la version Rust");
    } else {
        status(app, "");
    }
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

fn handle_outcome(app: &AppWindow, st: &mut State, out: Outcome) {
    match out {
        Outcome::Nothing => {}
        Outcome::Redraw(r) => refresh_rect(app, st, r),
        Outcome::Commit(label) => {
            st.doc.commit(label);
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
            app.set_canvas_cursor(2);
            true
        }
        1 => {
            if st.sym_drag == 0 {
                app.set_canvas_cursor(if near_x || near_y { 2 } else { 0 });
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
            status(app, format!("Axe de symétrie : {} px", if st.sym_drag == 1 { ncx } else { ncy }));
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
        show_export(app, &state.borrow());
        return true;
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;

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
        let tool = match c {
            'b' if shift => "tool-brush",
            _ if shift => "",
            's' => "tool-select",
            'm' | 'v' => "tool-move",
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
                t.set_brush_size((if c == '[' { s - step } else { s + step }).clamp(1.0, 500.0));
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
            app.set_dlg_w(SharedString::from(st.doc.w.to_string()));
            app.set_dlg_h(SharedString::from(st.doc.h.to_string()));
            app.set_show_new(true);
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
        ('+', _) | ('=', _) => app.set_zoom((app.get_zoom() * 1.25).min(32.0)),
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
    "showChangelog", "showWelcomeDialog", "undo()", "redo()", "ctxCut", "ctxCopy", "ctxPaste", "selectAll", "deselectAll",
    "invertSelection", "clearSelectionContent", "cropToSelection", "startIlluInteractiveCrop", "resizeCanvas()",
    "showExtendCanvasDialog", "showPixelTransformDialog", "expandCanvasToLayers", "addLayer", "deleteLayer",
    "duplicateActiveLayer", "moveLayer(1)", "moveLayer(-1)", "mergeLayers", "splitActiveLayerRgbChannels", "centerSelection",
    "openLevelsForActiveLayer", "openCurvesForActiveLayer", "showInstantFilterGallery", "openCameraRawForActiveLayer", "illuRepeatLastEffect", "toggleIlluPixelGrid", "toggleIlluRulers",
    "toggleIlluSnapToEdges", "toggleIlluAllowOutsideCanvas", "toggleIlluShowAllRibbonOptions", "win-tools", "win-colors",
    "win-layers", "win-history", "resetWorkspace", "openCanvasLivePreviewWindow", "openIconViewerWindow",
    "openImageLayerBoundsDialog", "illuOpenSnapSettings", "illuRemoveBackgroundIntelligent", "illuGuidedCutoutToolStart", "showContentAwareFillDialog", "convertActiveProjectTo", "PhotoModeManager", "openActiveProjectInPhotoModePro",
];

/// Marqueur d'une entrée de menu : vide si la fonction est en Rust, « à venir » sinon.
fn action_badge(action: &str, label: &str) -> &'static str {
    if action.starts_with("layerop:") {
        return "";
    }
    if let Some(fx) = action.strip_prefix("fx:") {
        let v = effects::dialog(fx).map(|(_, f)| effects::Vals::defaults(f)).unwrap_or_default();
        return if effects::params(fx, &v, 0xffffff, 1).is_some() { "" } else { "à venir" };
    }
    if action.is_empty() {
        let ported = ["Palettes volantes", "Interface : mode téléphone", "Palettes : ancrage fixe"];
        return if ported.iter().any(|p| label.starts_with(p)) { "" } else { "à venir" };
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
                    if it.submenu {
                        let kids: Vec<SubItemSpec> = (0..it.children.row_count())
                            .filter_map(|k| it.children.row_data(k))
                            // « Tramé (Noir et Blanc) » : masqué dans la version web
                            .filter(|c| !c.action.contains("convertActiveProjectToDither"))
                            .map(|mut c| {
                                c.badge = action_badge(&c.action, &c.label).into();
                                c
                            })
                            .collect();
                        let todo = kids.iter().filter(|c| !c.badge.is_empty()).count();
                        it.badge = if todo == kids.len() && todo > 0 { "à venir".into() } else { SharedString::default() };
                        it.children = ModelRc::new(VecModel::from(kids));
                    } else {
                        it.badge = action_badge(&it.action, &it.label).into();
                    }
                    it
                })
                .collect();
            let mut items = items;
            if m.title.as_str() == "Calques" {
                // dossiers, verrou et calque texte (aussi au clic droit sur un calque)
                let item = |label: &str, action: &str, fa: &str| MenuItemSpec { label: label.into(), action: action.into(), fa: fa.into(), fa_weight: 900, ..Default::default() };
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
    ModelRc::new(VecModel::from(menus))
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
    let item = |label: &str, action: &str, fa: &str| MenuItemSpec { label: label.into(), action: action.into(), fa: fa.into(), fa_weight: 900, ..Default::default() };
    out.push(MenuItemSpec { separator: true, ..Default::default() });
    out.push(item("Nouveau dossier", "layerop:group-new", "\u{f65e}"));
    out.push(item("Grouper dans un dossier", "layerop:group", "\u{f07b}"));
    if row.is_group {
        out.push(item("Dégrouper", "layerop:ungroup", "\u{f07c}"));
        out.push(item("Mode Transfert (fusion du contenu avec le dessous)", "layerop:pass", "\u{f0c5}"));
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
fn context_menu(app: &AppWindow, kind: &str, x: f32, y: f32, ctrl: bool) -> bool {
    let wanted: &[&str] = match kind {
        "canvas" => {
            let painting = matches!(
                Tool::from_id(app.get_current_tool().as_str()),
                Tool::Brush | Tool::Pencil | Tool::Eraser | Tool::Fill | Tool::Gradient | Tool::Text | Tool::Shape | Tool::RoundRect | Tool::Line | Tool::Deform | Tool::Warp
            );
            #[cfg(target_arch = "wasm32")]
            let ctrl = ctrl || web::modifiers().0;
            if painting && !ctrl {
                return false;
            }
            &[
                "ctxCut", "ctxCopy", "ctxPaste", "-", "EditorManager.selectAll", "illuDeselectLikeCtrlD", "invertSelection", "clearSelectionContent", "-", "startIlluInteractiveCrop", "EditorManager.addLayer()", "-", "undo()", "redo()",
            ]
        }
        "layer" => &["EditorManager.addLayer()", "duplicateActiveLayer", "deleteLayer()", "-", "moveLayer(1)", "moveLayer(-1)", "mergeLayers", "-", "openImageLayerBoundsDialog", "fx:rotatezoom"],
        _ => &["requestCloseActiveDocumentFromMenu", "-", "showExportDialog", "PhotoModeManager.open()", "showNewProjectDialog"],
    };
    let mut items = context_items(app, wanted);
    if kind == "layer" {
        items = ModelRc::new(VecModel::from(layer_context_extra(app, items)));
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
    // ouvrir / exporter empruntent eux-mêmes l'état
    if has("illuTriggerFileImport") {
        return open_file(app, state);
    }
    if has("showExportDialog") {
        return show_export(app, &state.borrow());
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;
    drop_floating(app, st);
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
        app.set_rs_preset_labels(ModelRc::new(VecModel::from(std::iter::once(SharedString::from("Choisir une taille…")).chain(presets.iter().map(|p| p.label.clone())).collect::<Vec<_>>())));
        app.set_rs_presets(ModelRc::new(VecModel::from(presets)));
        app.set_resize_canvas_mode(canvas);
        app.set_show_resize(true);
    };
    if has("showNewProjectDialog") {
        app.set_dlg_w(SharedString::from(st.doc.w.to_string()));
        app.set_dlg_h(SharedString::from(st.doc.h.to_string()));
        app.set_dlg_mode(st.doc.mode.index().min(2));
        app.set_show_new(true);
    } else if has("openActiveProjectInPhotoModePro") {
        // projet aplati, ajouté à la pellicule
        let flat = st.doc.flatten();
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
    } else if has("showWelcomeDialog") {
        // Fichier › Bienvenue / Informations : toujours, même après « Ne plus afficher »
        app.set_show_welcome(true);
    } else if action == "fn:undo()" || has("undo()") && !has("redo") {
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
    } else if has("expandCanvasToLayers") {
        st.doc.crop_to_content();
        commit(app, st, "Ajuster au contenu");
        app.invoke_zoom_fit();
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
        app.set_icon_entries(ModelRc::new(VecModel::from(theme::icon_entries(app))));
        app.set_show_icons(true);
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
        } else {
            status(app, "Objets SVG : mode vecteur pas encore porté dans la version Rust");
        }
    } else if label.starts_with("Interface : mode téléphone") || label.starts_with("Palettes : ancrage fixe") {
        // bascule de disposition (Paint.NET ↔ téléphone / Photoshop), enregistrée ; quitter
        // l'interface téléphone affichée d'office sur un écran étroit la désactive (le choix
        // est respecté, l'interface n'est jamais imposée)
        let target = if label.starts_with("Interface") { 2 } else { 1 };
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
    } else if label.starts_with("Palettes volantes") {
        if app.get_phone() {
            app.set_set_layout_auto(false);
        }
        app.set_set_layout(0);
        set_phone_panels(app, app.get_phone());
        save_settings(app);
        app.invoke_zoom_fit();
    } else if has("resetWorkspace") {
        app.set_show_tools(true);
        app.set_show_colors(true);
        app.set_show_layers(true);
        app.set_show_history(true);
    } else {
        let l = label.trim_end_matches('…').trim_end_matches("...").trim();
        status(app, format!("« {l} » : pas encore porté dans la version Rust"));
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
            return Some((at(1.0), format!("Aperçu et vignette de « {n} »")));
        }
        if let Some((n, _)) = &self.sensor {
            return Some((at(0.85), format!("Dématriçage et couleurs de « {n} » (flottant)")));
        }
        let (n, _) = self.files.front()?;
        Some(if raw::is_raw(n) { (at(0.3), format!("Lecture des données du capteur de « {n} »")) } else { (at(0.9), format!("Décodage de « {n} »")) })
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
        applog::log(format!("Chargement : {name} ({} octets)", bytes.len()));
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
        match decode(&bytes) {
            Some((w, h, px)) if self.to == LoadTo::Photos => self.out.push(Loaded::Photo(Box::new(photo::Photo::new(&name, w, h, px)))),
            Some((w, h, px)) => self.out.push(Loaded::Pixels(name, w, h, px)),
            None => self.out.push(Loaded::Failed(name.clone(), format!("« {name} » : format d'image non reconnu (formats lus : PNG, JPEG, WebP, BMP, GIF, ICO, TIFF, RAW, .illu)."))),
        }
    }
}

/// Projets en cours de chargement (fenêtre de progression visible tant que > 0).
static LOADS_ACTIVE: std::sync::atomic::AtomicUsize = std::sync::atomic::AtomicUsize::new(0);
/// Captures et tests : chargement immédiat (la boucle d'événements n'est pas pompée).
static SYNC_LOADS: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

fn load_progress(app: &AppWindow, frac: f32, label: &str) {
    app.set_load_progress(frac);
    app.set_load_detail(label.into());
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
    let mut job = LoadJob::new(to, files);
    if SYNC_LOADS.load(Relaxed) {
        while job.plan().is_some() {
            job.run();
        }
        return load_done(app, st, to, job.out);
    }
    LOADS_ACTIVE.fetch_add(1, Relaxed);
    app.set_load_title(if single && raw::is_raw(&first) { "Développement de la photo RAW".into() } else if single { "Ouverture de l'image".into() } else { "Ouverture des fichiers".into() });
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
            applog::log(format!("Chargement terminé en {:.0} ms", now_ms() - t0));
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
            progress(0.85, &format!("Développement de « {name} » en flottant (arrière-plan)"));
            if let Some(r) = web::compute_raw(&bytes).await {
                applog::log(format!("RAW : {name} → {} × {} px, blanc {:.3}, exposition de base +{:.2} IL (worker)", r.w, r.h, r.white, r.baseline_ev));
                progress(1.0, &format!("Aperçu et vignette de « {name} »"));
                web::sleep(30).await;
                out.push(Loaded::Photo(Box::new(photo::Photo::from_raw(&name, r))));
                continue;
            }
        } else if !name.to_lowercase().ends_with(".illu") && !bytes.starts_with(PREDECODED) {
            progress(0.9, &format!("Décodage de « {name} » (arrière-plan)"));
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
                    status(app, format!("Non repris (pas encore en Rust) : {}", l.skipped.join(", ")));
                }
            }
            Loaded::Illu(Err(e)) => show_error(app, "Ouvrir un projet", &e),
            Loaded::Photo(p) => {
                st.photo.photos.push(*p);
                photos += 1;
            }
            Loaded::Failed(name, e) => failed.push((name, e)),
        }
    }
    if photos > 0 {
        st.photo.active = st.photo.photos.len() - 1;
        if app.get_pm_open() {
            pm_sync(app, st);
            pm_render(app, st);
        } else {
            pm_open(app, st);
        }
        status(app, if photos == 1 { "Photo ouverte dans le Mode Photo Pro".to_string() } else { format!("{photos} photos ajoutées à la pellicule") });
    }
    match failed.as_slice() {
        [] => {}
        [(name, e)] => show_error(app, "Ouvrir", &format!("« {name} » : {e}")),
        many => show_error(app, "Ouvrir", &many.iter().map(|(n, e)| format!("« {n} » : {e}")).collect::<Vec<_>>().join("\n")),
    }
}

/// Ouvre le Mode Photo Pro (pellicule gardée d'une ouverture à l'autre).
fn pm_open(app: &AppWindow, st: &mut State) {
    finish_edits(app, st);
    app.set_phone_menu(false);
    app.set_phone_sheet(SharedString::default());
    let names: Vec<SharedString> = photo::preset_names().into_iter().map(SharedString::from).collect();
    app.set_pm_presets(ModelRc::new(VecModel::from(names)));
    pm_set_open(app, true);
    pm_sync(app, st);
    pm_render(app, st);
}

/// Thème choisi dans les Paramètres pendant que le Mode Photo Pro impose le sombre
/// (0 : mode fermé, 1 : clair, 2 : sombre) ; c'est lui qui est enregistré.
static PM_DARK_RESTORE: std::sync::atomic::AtomicU8 = std::sync::atomic::AtomicU8::new(0);

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
            theme::apply(app, true, t.get_accent());
        }
        app.set_menus(photo_menus());
    } else {
        let dark = PM_DARK_RESTORE.swap(0, Relaxed) == 2;
        if !dark {
            theme::apply(app, false, t.get_accent());
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
        label: label.into(),
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
        .map(|(k, n)| SubItemSpec { label: n.into(), action: format!("pm:preset:{k}").into(), fa: "\u{f0d0}".into(), fa_weight: 900, ..Default::default() })
        .collect();
    let menu = |title: &str, items: Vec<MenuItemSpec>| MenuSpec { title: title.into(), items: ModelRc::new(VecModel::from(items)) };
    let menus = vec![
        menu(
            "Fichier",
            vec![
                item("Importer des photos…", '\u{f030}', "Ctrl+O", "pm:import"),
                item("Ouvrir dans l'éditeur", '\u{f35d}', "", "pm:open-editor"),
                item("Exporter…", '\u{f56e}', "Ctrl+S", "pm:export"),
                sep(),
                item("Fermer le Mode Photo Pro", '\u{f00d}', "", "pm:close"),
            ],
        ),
        menu(
            "Édition",
            vec![
                item("Réinitialiser les réglages", '\u{f0e2}', "", "pm:reset"),
                item("Appliquer à toutes les photos", '\u{f0c5}', "", "pm:apply-all"),
                sep(),
                item("Rotation de 90°", '\u{f2f9}', "", "pm:rotate"),
                item("Comparer avec l'original", '\u{f06e}', "", "pm:fx"),
            ],
        ),
        menu(
            "Ajustements",
            vec![
                item("Réglage automatique", '\u{f0d0}', "", "pm:auto"),
                MenuItemSpec { label: "Préréglages créatifs".into(), submenu: true, fa: "\u{f53f}".into(), fa_weight: 900, children: ModelRc::new(VecModel::from(presets)), ..Default::default() },
            ],
        ),
    ];
    ModelRc::new(VecModel::from(menus))
}

/// Préréglage créatif `k` sur la photo active.
fn pm_preset(app: &AppWindow, st: &mut State, k: i32) {
    let active = st.photo.active;
    let Some(p) = st.photo.photos.get_mut(active) else { return };
    p.params = photo::preset_params(k);
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
    app.set_pm_fx_off(pm.fx_off);
    match pm.photos.get(pm.active) {
        Some(p) => {
            app.set_pm_values(ModelRc::new(VecModel::from(p.params.clone())));
            app.set_pm_preset(p.preset);
            app.set_pm_img_w(p.pw as i32);
            app.set_pm_img_h(p.ph as i32);
            app.set_pm_full_w(p.w as i32);
            app.set_pm_info(SharedString::from(format!("{} — {} × {} px", p.name, p.w, p.h)));
        }
        None => {
            app.set_pm_values(ModelRc::new(VecModel::from(photo::neutral())));
            app.set_pm_preset(0);
            app.set_pm_info(SharedString::default());
        }
    }
}

/// Rendu de la photo active, en deux temps comme la version web : tout de suite l'image entière
/// en basse résolution (curseurs fluides ; le dernier réglage gagne), puis, après une courte
/// pause, la zone visible à la résolution de l'écran (`pm_hq`). Les deux en arrière-plan.
fn pm_render(app: &AppWindow, st: &mut State) {
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
    }
    if std::mem::take(&mut pm.queued) || !same {
        pm_render(app, st);
    } else {
        app.set_pm_busy(false);
        if let Some(p) = st.photo.photos.get(st.photo.active) {
            app.set_pm_info(SharedString::from(format!("{} — {} × {} px — aperçu {ms:.0} ms", p.name, p.w, p.h)));
        }
    }
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
            let Some(files) = rfd::AsyncFileDialog::new().add_filter("Photos (dont RAW)", &exts).pick_files().await else { return };
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
    if a == "export" {
        return pm_export(app, state);
    }
    let mut st = state.borrow_mut();
    let st = &mut *st;
    let active = st.photo.active;
    match a {
        "close" => {
            pm_set_open(app, false);
            return;
        }
        "fx" => st.photo.fx_off = !st.photo.fx_off,
        "open-editor" => {
            let Some(p) = st.photo.photos.get(active) else { return };
            let t0 = now_ms();
            let px = p.render_full();
            let doc = Doc::from_pixels(p.w, p.h, px, &p.name);
            pm_set_open(app, false);
            set_document(app, st, doc);
            status(app, format!("Photo ouverte dans l'éditeur ({:.0} ms)", now_ms() - t0));
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
            status(app, format!("Réglages appliqués aux {n} photos"));
        }
        _ => {
            let Some(p) = st.photo.photos.get_mut(active) else { return };
            match a {
                "reset" => {
                    p.params = photo::neutral();
                    p.preset = 0;
                }
                "rotate" => p.rotate90(),
                "auto" => {
                    let auto = match &p.lin {
                        Some((_, prev)) => photo::auto_params_lin(prev, p.raw_ev),
                        None => photo::auto_params(&p.preview),
                    };
                    for i in [0, 3, 4, 5, 6, 18, 20] {
                        p.params[i] = auto[i];
                    }
                    p.preset = 0;
                }
                s if s.starts_with("reset-section:") => {
                    let idx: Vec<usize> = match s.trim_start_matches("reset-section:") {
                        "0" => vec![0, 18, 5, 3, 6, 4],
                        "1" => vec![1, 2, 20, 19],
                        "2" => vec![16, 17, 22, 21, 23, 24],
                        "3" => (7..=15).collect(),
                        _ => (30..=53).collect(),
                    };
                    let n = photo::neutral();
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

/// Exporte toutes les photos en JPEG (pleine résolution). Bureau : dans un dossier choisi ;
/// web : un téléchargement par photo.
fn pm_export(app: &AppWindow, state: &Shared) {
    let jobs: Vec<(String, usize, usize, photo::Src, Vec<f32>)> =
        state.borrow().photo.photos.iter().map(|p| (p.stem(), p.w, p.h, p.full_src(), p.engine_params())).collect();
    if jobs.is_empty() {
        status(app, "Aucune photo à exporter");
        return;
    }
    for p in &mut state.borrow_mut().photo.photos {
        p.modified = false;
    }
    pm_sync(app, &state.borrow());
    #[cfg(not(target_arch = "wasm32"))]
    {
        let Some(dir) = rfd::FileDialog::new().set_title("Dossier d'exportation des photos").pick_folder() else { return };
        app.set_pm_busy(true);
        status(app, format!("Export de {} photo(s)…", jobs.len()));
        let weak = app.as_weak();
        std::thread::spawn(move || {
            let mut done = 0;
            for (stem, w, h, px, p) in &jobs {
                let out = photo::render_src(px, *w, *h, p);
                if let Some(bytes) = encode_jpeg(&out, *w, *h, 92) {
                    if std::fs::write(dir.join(format!("{stem}-photo-pro.jpg")), bytes).is_ok() {
                        done += 1;
                    }
                }
            }
            let msg = format!("{done} photo(s) exportée(s) dans {}", dir.display());
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
        for (stem, w, h, px, p) in &jobs {
            let out = photo::render_src(px, *w, *h, p);
            if let Some(bytes) = encode_jpeg(&out, *w, *h, 92) {
                web::download_bytes(&bytes, &format!("{stem}-photo-pro.jpg"), "image/jpeg");
            }
        }
        status(app, format!("{} photo(s) exportée(s)", jobs.len()));
    }
}

/// Panneau de menu du mode téléphone (barre du bas) : entrées d'Ajustements, ou des sous-menus
/// d'Effets regroupés par section (comme js/app/illu-mobile-shell.js, buildMenuSheet).
fn phone_sheet_rows(app: &AppWindow, which: &str) -> Vec<SheetRow> {
    let menus = app.get_menus();
    let find = |title: &str| (0..menus.row_count()).filter_map(|i| menus.row_data(i)).find(|m| m.title.as_str() == title);
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
        let Some(it) = items.iter().find(|it| it.submenu && it.label.as_str() == *name) else { continue };
        rows.push(SheetRow { section: true, label: name.to_uppercase().into(), ..Default::default() });
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
        status(app, format!("Le projet est déjà en mode {}", mode.status()));
        return;
    }
    let t0 = now_ms();
    st.doc.set_color_mode(mode);
    st.doc.commit(mode.history_label());
    refresh_all(app, st);
    status(app, format!("{} : {:.0} ms", mode.history_label(), now_ms() - t0));
}

fn prompt(app: &AppWindow, kind: &str, title: &str, label: &str, value: &str) {
    app.set_prompt_kind(kind.into());
    app.set_prompt_title(title.into());
    app.set_prompt_label(label.into());
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
        "userAgent": format!("MasterPaint-Rust/{APP_VERSION} ({})", std::env::consts::OS),
    })
    .to_string();
    const URL: &str = "https://polocrafting.fr/contact_save.php";
    app.set_contact_status("Envoi…".into());
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
        app.set_contact_status("Échec de l'envoi (réseau ?)".into());
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
fn save_settings(app: &AppWindow) {
    let t = app.global::<Theme>();
    let a = t.get_accent();
    let hm = app.get_set_history_max().round().clamp(5.0, 500.0) as usize;
    editor::HISTORY_MAX.store(hm, std::sync::atomic::Ordering::Relaxed);
    settings::Settings {
        accent: (a.red() as u32) << 16 | (a.green() as u32) << 8 | a.blue() as u32,
        dark: saved_dark(app),
        toolbar_mode: app.get_toolbar_mode(),
        wheel_scroll: app.get_set_wheel_mode() == 1,
        history_max: hm,
        autosave_min: app.get_set_autosave_min().round() as u32,
        language: app.get_set_language(),
        layout: app.get_set_layout(),
        layout_auto: app.get_set_layout_auto(),
        theme_style: app.get_set_theme_style(),
        ui_zoom: app.get_set_ui_zoom(),
        default_zoom: app.get_set_default_zoom(),
        default_tool: tool_id_at(app, app.get_set_default_tool()),
        autosave: app.get_set_autosave(),
        use_gpu: app.get_set_use_gpu(),
        paste_mode: app.get_set_paste_mode(),
        paste_ask: app.get_set_paste_ask(),
        rounded: app.get_set_rounded(),
        glass: app.get_set_glass(),
        header_preview: app.get_set_header_preview(),
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
    }
    .save();
    AUTOSAVE_ON.store(app.get_set_autosave(), std::sync::atomic::Ordering::Relaxed);
    GPU_ALLOWED.store(app.get_set_use_gpu(), std::sync::atomic::Ordering::Relaxed);
}

/// Fenêtre de bienvenue au démarrage (comme la version HTML) : les deux premières ouvertures,
/// sauf « Ne plus afficher », hors captures / démonstrations et hors Photo Mode Pro. Appelée
/// une fois les projets restaurés (écran de chargement retiré sur le web).
fn welcome_at_start(app: &AppWindow) {
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

/// Identifiant de l'outil n° `i` de la fenêtre Outils (Paramètres › outil au démarrage).
fn tool_id_at(app: &AppWindow, i: i32) -> String {
    let tools = app.global::<Generated>().get_tools();
    tools.row_data(i.max(0) as usize).map(|t| t.2.to_string()).unwrap_or_else(|| "tool-select".into())
}

thread_local! {
    /// échelle de l'écran (sans le zoom de l'interface)
    static BASE_SCALE: std::cell::Cell<f32> = const { std::cell::Cell::new(0.0) };
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
    app.window().dispatch_event(slint::platform::WindowEvent::ScaleFactorChanged { scale_factor: base * z });
    #[cfg(target_arch = "wasm32")]
    {
        let (w, h) = web::viewport();
        app.window().set_size(slint::LogicalSize::new(w / z, h / z));
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
            match id {
                "rot-cw" => st.doc.rotate90(true),
                "rot-ccw" => st.doc.rotate90(false),
                "rot-180" => st.doc.rotate180(),
                "flip-h" => st.doc.flip(true),
                _ => st.doc.flip(false),
            }
            commit(app, st, "Rotation / retournement");
            app.invoke_zoom_fit();
        }
        id if id.starts_with("nouvelle") => t.set_sel_mode(0),
        id if id.starts_with("ajouter") => t.set_sel_mode(1),
        id if id.starts_with("soustraire") => t.set_sel_mode(2),
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
        let msg = format!("MasterPaint : {info}");
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
    #[cfg(not(target_arch = "wasm32"))]
    let snap = snapshot::install(&std::env::args().skip(1).collect::<Vec<_>>());
    let app = AppWindow::new()?;
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
    let accent = if args.iter().any(|a| a.starts_with("--accent=")) {
        accent
    } else {
        Color::from_rgb_u8((cfg.accent >> 16) as u8, (cfg.accent >> 8) as u8, cfg.accent as u8)
    };
    app.set_set_theme_style(if flag("--win98") { 1 } else { cfg.theme_style });
    app.set_set_ui_zoom(cfg.ui_zoom);
    app.set_set_default_zoom(cfg.default_zoom);
    app.set_set_autosave(cfg.autosave);
    app.set_set_use_gpu(cfg.use_gpu);
    app.set_set_paste_mode(cfg.paste_mode);
    app.set_set_paste_ask(cfg.paste_ask);
    app.set_set_rounded(cfg.rounded);
    app.set_set_glass(cfg.glass);
    app.set_set_header_preview(cfg.header_preview);
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
    app.set_toolbar_mode(if flag("--classic") { 1 } else { cfg.toolbar_mode });
    app.set_set_wheel_mode(cfg.wheel_scroll as i32);
    app.set_set_history_max(cfg.history_max as f32);
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
    app.set_welcome_count(cfg.welcome_count.min(1000) as i32);
    app.set_welcome_hide(cfg.welcome_hide);
    app.global::<ToolOpts>().set_magnet_strength(cfg.magnet_strength);
    app.global::<ToolOpts>().set_magnet_freq(cfg.magnet_freq);
    app.set_set_autosave_min(cfg.autosave_min as f32);
    app.set_set_language(cfg.language);
    editor::HISTORY_MAX.store(cfg.history_max, std::sync::atomic::Ordering::Relaxed);
    let rows: Vec<(SharedString, SharedString)> = settings::SHORTCUTS.iter().map(|(k, w)| (SharedString::from(*k), SharedString::from(*w))).collect();
    app.set_shortcut_list(ModelRc::new(VecModel::from(rows)));
    {
        // enregistrement à la fermeture des Paramètres et à chaque changement de thème
        let weak = app.as_weak();
        app.on_settings_changed(move || save_settings(&weak.unwrap()));
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
        .unwrap_or_else(|| Doc::new(1280, 720, [255, 255, 255, 255], "Sans titre 1"));
    #[cfg(target_arch = "wasm32")]
    let doc = Doc::new(1280, 720, [255, 255, 255, 255], "Sans titre 1");

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
        tiles: Rc::new(VecModel::default()),
        tile_index: Default::default(),
        lazy: false,
        tile_ok: Default::default(),
        backdrop: Vec::new(),
        bs: 0,
        thumbs: Vec::new(),
        sel_bounds: None,
        dynfx_dirty: false,
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
    #[cfg(not(target_arch = "wasm32"))]
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
                app.set_rmbg_text(SharedString::from("Annulation…"));
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
        #[cfg(not(target_arch = "wasm32"))]
        {
            use slint::winit_030::{winit, EventResult, WinitWindowAccessor};
            let weak = app.as_weak();
            let state2 = state.clone();
            app.window().on_winit_window_event(move |_w, ev| {
                if let winit::event::WindowEvent::DroppedFile(path) = ev {
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
                    applog::log(format!("Coller (évènement du navigateur) : {name}, {} octets", bytes.len()));
                    if raw::is_raw(&name) || name.to_lowercase().ends_with(".illu") {
                        return dropped_file(&app, &mut st, name, bytes);
                    }
                    match decode(&bytes) {
                        Some((w, h, px)) => {
                            let c = clip_from_raw(&mut st, w, h, px);
                            paste_clips(&app, &mut st, vec![(c, "Coller", None)]);
                        }
                        None => status(&app, format!("Coller : « {name} » n'est pas une image reconnue")),
                    }
                },
                move |name, w, h, px| {
                    let (Some(app), Ok(mut st)) = (weak_raw.upgrade(), state_raw.try_borrow_mut()) else { return };
                    if js_sys::Date::now() - PASTE_READ_AT.with(|t| t.get()) < 1500.0 {
                        return;
                    }
                    applog::log(format!("Coller (évènement du navigateur) : {name}, {w} × {h} px"));
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
        let opened_file = args.iter().any(|a| !a.starts_with("--"));
        #[cfg(not(target_arch = "wasm32"))]
        if !opened_file {
            if let Some(bytes) = autosave_path().and_then(|p| std::fs::read(p).ok()) {
                restore_workspace(&app, &mut state.borrow_mut(), &bytes);
            }
        }
        // fenêtre de bienvenue (deux premières ouvertures), une fois les projets restaurés
        #[cfg(not(target_arch = "wasm32"))]
        welcome_at_start(&app);
        #[cfg(target_arch = "wasm32")]
        if !opened_file {
            let weak = app.as_weak();
            let state = state.clone();
            // l'écran de chargement de la page reste affiché pendant la restauration
            web::loading_step("Restauration des projets…");
            let _ = slint::spawn_local(async move {
                if let (Some(bytes), Some(app)) = (web::store_load().await, weak.upgrade()) {
                    if let Ok(mut st) = state.try_borrow_mut() {
                        restore_workspace(&app, &mut st, &bytes);
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
            web::on_hidden(move || {
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
            let msg = match name {
                Some(n) => format!("Carte graphique : {n}"),
                None => "Carte graphique : non disponible (tout est calculé par le processeur)".to_string(),
            };
            let _ = slint::invoke_from_event_loop(move || {
                if let Some(app) = weak.upgrade() {
                    // annoncé quelques secondes dans la barre d'état ; le détail reste dans les Paramètres
                    status(&app, msg.clone());
                    app.set_gpu_text(SharedString::from(msg));
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
    let start_tool = args.iter().find_map(|a| a.strip_prefix("--tool=")).map(|t| t.to_string()).unwrap_or(cfg.default_tool.clone());
    set_tool(&app, &mut state.borrow_mut(), &start_tool);
    // --show=settings,colors,rulers,grid,shortcuts (captures et démonstrations)
    if let Some(list) = args.iter().find_map(|a| a.strip_prefix("--show=")) {
        for w in list.split(',') {
            match w {
                "settings" => app.set_show_settings(true),
                "welcome" => app.set_show_welcome(true),
                "shortcuts" => app.set_show_shortcuts(true),
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
    if let Some(p) = args.iter().find(|a| !a.starts_with("--")).filter(|p| raw::is_raw(p) || p.to_lowercase().ends_with(".illu")) {
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
            "settings-adv" => {
                app.set_show_settings(true);
                app.set_settings_page(6);
            }
            "eyedropper" => set_tool(&app, st, "tool-eyedropper"),
            "mask" => layer_alpha(&app, st, 0, false),
            "icons" => {
                app.set_icon_entries(ModelRc::new(VecModel::from(theme::icon_entries(&app))));
                app.set_show_icons(true);
            }
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
                st.doc.composite_scaled(&mut st.display, st.ds, (0, 0, dw, dh), true);
                eprintln!("même image composée en entier (comme avant) : {:.0} ms", now_ms() - t0);
                refresh_all(&app, st);
            }
            "ctx" => {
                context_menu(&app, "canvas", 420.0, 260.0, true);
            }
            "tip" => {
                let tip = app.global::<Tip>();
                tip.set_text("Pinceau".into());
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
                    app.set_cursor_text(SharedString::from(format!("{}, {} px", x as i32, y as i32)));
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
                            status(&app, format!("Couleur choisie : #{:02X}{:02X}{:02X}", c[0], c[1], c[2]));
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
                    0 => st.picking = Some(button == 1),
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
            // calque verrouillé, dossier ou calque texte : les outils qui peignent ne s'y appliquent pas
            if kind == 0 && paints_pixels(st.tool) && layer_guard(&app, st) {
                return;
            }
            if kind == 0 && paints_pixels(st.tool) && st.tool != Tool::Eraser {
                note_recent_color(&app, if button == 1 { app.get_secondary_color() } else { app.get_primary_color() });
            }
            let o = opts(&app);
            let tool = st.tool;
            let out = match kind {
                0 => st.session.press(tool, &mut st.doc, &o, x, y, button == 1, ctrl, alt),
                1 => st.session.moved(tool, &mut st.doc, &o, x, y, false),
                _ => st.session.release(tool, &mut st.doc),
            };
            if kind == 0 && tool == Tool::PolyLasso {
                app.set_overlay_path(poly_path(st, (x, y)));
            }
            handle_outcome(&app, st, out);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_canvas_double_click(move || {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let st = &mut *st;
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
            context_menu(&weak.unwrap(), &kind, x, y, ctrl)
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
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_effect_field_changed(move |i, value, text| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let primary = app.get_primary_color();
            let i = i.max(0) as usize;
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
                        3 => format!("#{:02x}{:02x}{:02x}", primary.red(), primary.green(), primary.blue()),
                        4 => text.to_string(),
                        _ => effects::fmt_num(value),
                    };
                    let id = f.id;
                    es.vals.0.insert(id.to_string(), s);
                    // préréglage (incrustation…) : d'autres champs changent, tout est redessiné
                    effects::apply_preset(&es.id, id, &mut es.vals)
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
            begin_busy(&app, &format!("Application de « {title} »"), "Calcul sur l'image entière…", true);
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
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_quick_action(move |id| {
            let app = weak.unwrap();
            match id.as_str() {
                "illu-tb-new" => {
                    let st = state.borrow();
                    app.set_dlg_w(SharedString::from(st.doc.w.to_string()));
                    app.set_dlg_h(SharedString::from(st.doc.h.to_string()));
                    app.set_show_new(true);
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
                "illu-tb-zoom-in" => app.set_zoom((app.get_zoom() * 1.25).min(32.0)),
                "illu-tb-zoom-out" => app.set_zoom((app.get_zoom() / 1.25).max(0.05)),
                "illu-tb-zoom-fit-row1" => app.invoke_zoom_fit(),
                "classic-web" => {
                    // version web classique (HTML) : html/ à la racine du site (la
                    // version Rust est servie à la racine et dans /rust-app/)
                    #[cfg(target_arch = "wasm32")]
                    {
                        if let Some(w) = web_sys::window() {
                            let sub = w.location().pathname().is_ok_and(|p| p.contains("/rust-app/"));
                            let _ = w.location().set_href(if sub { "../html/" } else { "html/" });
                        }
                    }
                    #[cfg(not(target_arch = "wasm32"))]
                    {
                        let _ = webbrowser::open("https://masterpaint.fr/html/");
                    }
                }
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
                "clear-autosave" => {
                    #[cfg(not(target_arch = "wasm32"))]
                    if let Some(p) = autosave_path() {
                        let _ = std::fs::remove_file(p);
                    }
                    #[cfg(target_arch = "wasm32")]
                    web::store_save(&[]);
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
                "icon-viewer" => {
                    app.set_icon_entries(ModelRc::new(VecModel::from(theme::icon_entries(&app))));
                    app.set_show_icons(true);
                }
                _ => {
                    // « Signaler un bug » : formulaire intégré (même envoi que la version web)
                    app.set_contact_message(SharedString::default());
                    app.set_show_contact(true);
                }
            }
        });
    }

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
            sync_panels(&app, &mut st);
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
            l.opacity = (opacity / 100.0).clamp(0.0, 1.0);
            l.blend = Blend::from_index(blend);
            let (w, h) = (st.doc.w, st.doc.h);
            let st = &mut *st;
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
        app.on_layer_dynfx_open(move |i| {
            let app = weak.unwrap();
            let mut st = state.borrow_mut();
            let st = &mut *st;
            drop_floating(&app, st);
            st.doc.active = (i.max(0) as usize).min(st.doc.layers.len() - 1);
            st.dynfx_dirty = false;
            sync_dynfx(&app, st);
            app.set_show_dynfx(true);
            sync_panels(&app, st);
        });
    }
    {
        let weak = app.as_weak();
        let state = state.clone();
        app.on_dynfx_changed(move |action, i, v| dynfx_changed(&weak.unwrap(), &state, &action, i.max(0) as usize, v));
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
            let c = if app.get_colors_grid() {
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
            let c = ColorMode::from_index(app.global::<MenuState>().get_color_mode()).convert(c);
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
        app.on_apply_ui_zoom(move |z| {
            let app = weak.unwrap();
            apply_ui_zoom(&app, z);
            save_settings(&app);
        });
    }
    {
        let weak = app.as_weak();
        app.on_apply_theme(move |dark, accent| {
            let app = weak.unwrap();
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
                st.photo.photos.remove(i);
                let n = st.photo.photos.len();
                st.photo.active = if st.photo.active > i { st.photo.active - 1 } else { st.photo.active.min(n.saturating_sub(1)) };
                pm_sync(&app, &st);
                pm_render(&app, &mut st);
            }
        });
        let weak = app.as_weak();
        let state2 = state.clone();
        app.on_pm_set(move |i, v| {
            let app = weak.unwrap();
            let mut st = state2.borrow_mut();
            let active = st.photo.active;
            let Some(p) = st.photo.photos.get_mut(active) else { return };
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
            let n = state.borrow().tabs.len() + 1;
            let doc = Doc::new(w, h, fill, &format!("Sans titre {n}{}", mode.suffix())).with_mode(mode);
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
                app.set_contact_status("Écrivez un message".into());
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
                st.doc.draw_ants_scaled(&mut st.display, st.ants_phase, st.ds, r);
                upload_rect(&app, st, r);
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
            app.get_set_layout() == 2 || (app.get_set_layout_auto() && w / z < 600.0)
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
    #[cfg(not(target_arch = "wasm32"))]
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

    /// Image du presse-papiers du système (menus Coller), décodée par le navigateur.
    pub async fn clipboard_read() -> Option<(usize, usize, Vec<u8>)> {
        let cb = clipboard()?;
        let f: js_sys::Function = js_sys::Reflect::get(&cb, &"read".into()).ok()?.dyn_into().ok()?;
        let p: js_sys::Promise = f.call0(&cb).ok()?.dyn_into().ok()?;
        let v = wasm_bindgen_futures::JsFuture::from(p).await.ok()?;
        raw_image(&v)
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
        let _ = web_sys::Url::revoke_object_url(&url);
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
