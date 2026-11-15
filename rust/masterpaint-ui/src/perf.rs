// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Mode léger (Paramètres › Performances) : active le dessin ultra léger via theme::skin_of,
//! sans surbrillance décorative, ombres, transparence ni aperçu flouté du haut.
//! Le style choisi reste mémorisé et revient à la désactivation.
//! Il ne touche jamais à la netteté de l'interface. Ce qui pèse sur une image lente est traité à
//! part : un rendu trop long sur un projet fait proposer la résolution de rendu de la toile, pour ce
//! projet seul ou pour de bon (`note_render`).
//! Automatique : appliqué une fois si la machine n'a pas de vraie carte graphique, très peu de
//! cœurs, ou si les images de l'interface restent lentes ; toujours appliqué en mode « Toujours ».
//! Les réglages suivent à l'écran ; quitter le mode rétablit ce qu'il a coupé. Des ralentissements
//! observés font aussi proposer, une seule fois, un rapport : le formulaire « Signaler un bug »
//! déjà rempli, à relire avant de l'envoyer (aucune image, aucun nom de projet).

use super::*;
use std::cell::{Cell, RefCell};

/// Une image plus longue que ça : moins de 25 images par seconde.
const SLOW_MS: f64 = 40.0;
/// Images par fenêtre de mesure ; fenêtres lentes d'affilée avant d'alléger.
const WINDOW: usize = 40;
const STRIKES: u32 = 3;
/// Deux images plus espacées ne se suivent pas : leur écart ne dit rien de la fluidité.
const BURST_MS: f64 = 120.0;
/// Le démarrage de la page ne compte pas.
const WARMUP_MS: f64 = 8000.0;

#[derive(Default)]
struct Watch {
    samples: Vec<f64>,
    strikes: u32,
    /// médianes des dernières fenêtres, pour le rapport
    medians: Vec<f64>,
}

impl Watch {
    /// Note une image : `draw` son tracé, `gap` l'écart avec la précédente. Vrai : PC trop lent.
    fn note(&mut self, draw: f64, gap: f64) -> bool {
        self.samples.push(if gap < BURST_MS { draw.max(gap) } else { draw });
        if self.samples.len() < WINDOW {
            return false;
        }
        self.samples.sort_by(f64::total_cmp);
        // la médiane : une image isolée (sauvegarde, calcul) ne fait pas un PC lent
        let median = self.samples[WINDOW / 2];
        let slow = median > SLOW_MS;
        self.samples.clear();
        self.medians.push(median);
        let extra = self.medians.len().saturating_sub(STRIKES as usize);
        self.medians.drain(..extra);
        self.strikes = if slow { self.strikes + 1 } else { 0 };
        self.strikes >= STRIKES
    }
}

thread_local! {
    static WATCH: RefCell<Watch> = RefCell::new(Watch::default());
    /// mesure en cours (allègement actif et pas encore appliqué)
    static ARMED: Cell<bool> = const { Cell::new(false) };
    static BEGUN: Cell<f64> = const { Cell::new(0.0) };
    static LAST: Cell<f64> = const { Cell::new(0.0) };
    static START: Cell<f64> = const { Cell::new(0.0) };
    /// une image de la toile a été envoyée : cette image-là mesure la toile, pas l'interface
    static UPLOADED: Cell<bool> = const { Cell::new(false) };
}

/// À appeler à chaque image envoyée à l'interface.
pub(crate) fn note_upload() {
    UPLOADED.with(|u| u.set(true));
}

/// Démarre la surveillance des images de l'interface.
pub(crate) fn start(app: &AppWindow) {
    START.with(|s| s.set(now_ms()));
    app.set_screen_hidpi(screen_scale() > 1.0);
    arm(app);
    if app.get_set_perf_mode() == 1 {
        lighten(app, "demandé dans les Paramètres");
    }
    let weak = app.as_weak();
    // rendu logiciel d'un exe (sans notifications) : le matériel seul décide
    let _ = app.window().set_rendering_notifier(move |state, _| {
        if !ARMED.with(|a| a.get()) {
            return;
        }
        match state {
            slint::RenderingState::BeforeRendering => BEGUN.with(|b| b.set(now_ms())),
            slint::RenderingState::AfterRendering => {
                let (now, begun) = (now_ms(), BEGUN.with(|b| b.get()));
                let gap = begun - LAST.with(|l| l.replace(begun));
                if UPLOADED.with(|u| u.replace(false)) || now - START.with(|s| s.get()) < WARMUP_MS {
                    return;
                }
                if WATCH.with(|w| w.borrow_mut().note(now - begun, gap)) {
                    // pas de changement de propriété pendant le tracé
                    let weak = weak.clone();
                    slint::Timer::single_shot(std::time::Duration::ZERO, move || {
                        if let Some(app) = weak.upgrade() {
                            on_slow(&app);
                        }
                    });
                }
            }
            _ => {}
        }
    });
}

/// La mesure tourne en automatique, tant qu'il reste à alléger ou un rapport à proposer.
fn arm(app: &AppWindow) {
    ARMED.with(|a| a.set(app.get_set_perf_mode() == 0 && (!app.get_set_perf_done() || !app.get_set_perf_reported())));
}

/// Échelle réelle de l'écran (la page peut annoncer moins au moteur d'affichage).
fn screen_scale() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        let win = web_sys::window();
        win.as_ref()
            .and_then(|w| js_sys::Reflect::get(w, &"mpRealDpr".into()).ok())
            .and_then(|v| v.as_f64())
            .or_else(|| win.map(|w| w.device_pixel_ratio()))
            .unwrap_or(1.0)
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        1.0
    }
}

/// Un rendu plus long que ça, plusieurs fois sur un même projet : proposer de le réduire.
const RENDER_SLOW_MS: f64 = 800.0;
const RENDER_SLOW_COUNT: u32 = 3;

thread_local! {
    /// début d'un rendu dont un filtre ƒ est encore en calcul
    static RENDER_T0: Cell<f64> = const { Cell::new(0.0) };
    /// rendus lents par projet ; `u32::MAX` : déjà proposé
    static RENDER_SLOW: RefCell<std::collections::HashMap<u64, u32>> = RefCell::new(std::collections::HashMap::new());
}

/// Un calcul de filtre vient de partir : le délai court jusqu'à son affichage.
pub(crate) fn render_started() {
    RENDER_T0.with(|t| {
        if t.get() == 0.0 {
            t.set(now_ms());
        }
    });
}

/// Toile recomposée : si plus rien n'est en calcul, le délai de rendu est connu.
pub(crate) fn render_finished(app: &AppWindow, st: &State, t0: f64) {
    if !st.dyn_inflight.is_empty() || !st.dyn_draft_flight.is_empty() {
        return;
    }
    let start = RENDER_T0.with(|t| t.replace(0.0));
    let start = if start > 0.0 { start } else { t0 };
    if start > 0.0 {
        note_render(app, st, now_ms() - start);
    }
}

fn note_render(app: &AppWindow, st: &State, ms: f64) {
    let eligible = ms >= RENDER_SLOW_MS && !st.empty && st.doc.mask_of.is_none() && app.get_set_perf_mode() != 2 && st.doc.render_div_set() == 1 && st.doc.render_choices().len() > 1;
    if !eligible {
        return;
    }
    let uid = st.doc.uid;
    let offer = RENDER_SLOW.with(|r| {
        let mut r = r.borrow_mut();
        let n = r.entry(uid).or_insert(0);
        if *n == u32::MAX {
            return false;
        }
        *n += 1;
        if *n >= RENDER_SLOW_COUNT {
            *n = u32::MAX;
            return true;
        }
        false
    });
    if offer {
        // la réduction selon la lenteur, bornée par la taille de l'image
        let want = if ms >= 6000.0 { 8 } else if ms >= 2000.0 { 4 } else { 2 };
        let div = st.doc.render_choices().into_iter().filter(|c| *c <= want).max().unwrap_or(2);
        offer_render(app.as_weak(), uid, div, ms);
    }
}

/// Propose la réduction quand plus rien n'est en cours.
fn offer_render(weak: slint::Weak<AppWindow>, uid: u64, div: usize, ms: f64) {
    slint::Timer::single_shot(std::time::Duration::from_secs(2), move || {
        let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
        let Ok(mut st) = state.try_borrow_mut() else { return offer_render(weak, uid, div, ms) };
        if st.task.is_some() || st.session.busy() || app.get_show_contact() || now_ms() - LAST_ACTIVITY.with(|a| a.get()) < 1500.0 {
            drop(st);
            return offer_render(weak, uid, div, ms);
        }
        if st.doc.uid != uid {
            return;
        }
        st.task = Some(Task::RenderOffer(uid, div));
        let intro = i18n::tr_format!("Ce projet met environ {:.1} s à se rendre. La toile peut être rendue ÷{div} : bien plus fluide, et l'enregistrement reste en pleine résolution.", ms / 1000.0);
        show_task(
            &app,
            "Rendu lent sur ce projet",
            &intro,
            "",
            "",
            &[
                ("Pour ce projet seulement", "Le réglage apparaît dans le ruban tant que ce projet l'utilise."),
                ("Activer dans les Paramètres", "Le réglage reste dans le ruban et s'applique aux nouveaux projets."),
                ("Non merci", "Ne plus le proposer pour ce projet."),
            ],
            Vec::new(),
        );
    });
}

/// Images trop lentes plusieurs fenêtres de suite : on allège, puis on propose le rapport.
fn on_slow(app: &AppWindow) {
    WATCH.with(|w| w.borrow_mut().strikes = 0);
    lighten(app, "images de l'interface trop lentes");
    if !app.get_set_perf_reported() {
        app.set_set_perf_reported(true);
        app.invoke_settings_changed();
        offer_report(app.as_weak());
    }
    arm(app);
}

/// Propose le rapport quand plus rien n'est en cours : pas de fenêtre en plein trait.
fn offer_report(weak: slint::Weak<AppWindow>) {
    slint::Timer::single_shot(std::time::Duration::from_secs(2), move || {
        let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
        let Ok(mut st) = state.try_borrow_mut() else { return offer_report(weak) };
        if st.task.is_some() || st.session.busy() || app.get_show_contact() || now_ms() - LAST_ACTIVITY.with(|a| a.get()) < 1500.0 {
            drop(st);
            return offer_report(weak);
        }
        st.task = Some(Task::PerfReport);
        show_task(
            &app,
            "L'interface manque de fluidité",
            "MasterPaint a ralenti sur ce PC : le mode léger est maintenant actif (Paramètres › Performances). Vous pouvez aussi envoyer un rapport pour aider à comprendre pourquoi.",
            "",
            "",
            &[
                ("Préparer le rapport", "Ouvre le message à relire avant l'envoi : processeur, mémoire, carte graphique, taille des projets. Aucune image ni nom de projet."),
                ("Plus tard", "Le mode léger reste actif. Ce message ne reviendra pas."),
            ],
            Vec::new(),
        );
    });
}

/// Mémoire et processeur vus par ce système.
fn machine_lines() -> String {
    let mb = |b: f64| b / 1_048_576.0;
    #[cfg(target_arch = "wasm32")]
    {
        let win = web_sys::window().map(wasm_bindgen::JsValue::from).unwrap_or_default();
        let get = |o: &wasm_bindgen::JsValue, k: &str| js_sys::Reflect::get(o, &k.into()).ok().filter(|v| !v.is_undefined());
        let nav = get(&win, "navigator").unwrap_or_default();
        let cores = get(&nav, "hardwareConcurrency").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let ram = get(&nav, "deviceMemory").and_then(|v| v.as_f64()).map_or("?".to_string(), |g| format!("{g}"));
        let module = core::arch::wasm32::memory_size(0) as f64 * 65536.0;
        i18n::tr_format!("Processeur : {cores} cœurs (modèle inconnu dans un navigateur)\nMémoire de l'appareil : environ {ram} Go ; utilisée par l'application : {:.0} Mo", mb(module))
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let cores = std::thread::available_parallelism().map_or(0, |n| n.get());
        let cpu = std::fs::read_to_string("/proc/cpuinfo")
            .ok()
            .and_then(|s| s.lines().find(|l| l.starts_with("model name") || l.starts_with("Hardware")).and_then(|l| l.split(':').nth(1)).map(|n| n.trim().to_string()))
            .or_else(|| std::env::var("PROCESSOR_IDENTIFIER").ok())
            .unwrap_or_else(|| "?".into());
        let (total, free) = system_memory();
        i18n::tr_format!("Processeur : {cpu}, {cores} cœurs\nMémoire de l'appareil : {:.0} Mo, dont {:.0} Mo disponibles", mb(total), mb(free))
    }
}

/// Mémoire totale et disponible (octets).
#[cfg(all(not(target_arch = "wasm32"), not(windows)))]
fn system_memory() -> (f64, f64) {
    let info = std::fs::read_to_string("/proc/meminfo").unwrap_or_default();
    let field = |k: &str| info.lines().find(|l| l.starts_with(k)).and_then(|l| l.split_whitespace().nth(1)).and_then(|v| v.parse::<f64>().ok()).unwrap_or(0.0) * 1024.0;
    (field("MemTotal:"), field("MemAvailable:"))
}

#[cfg(windows)]
fn system_memory() -> (f64, f64) {
    #[repr(C)]
    struct MemoryStatusEx {
        length: u32,
        load: u32,
        total_phys: u64,
        avail_phys: u64,
        rest: [u64; 5],
    }
    extern "system" {
        fn GlobalMemoryStatusEx(buffer: *mut MemoryStatusEx) -> i32;
    }
    let mut m = MemoryStatusEx { length: std::mem::size_of::<MemoryStatusEx>() as u32, load: 0, total_phys: 0, avail_phys: 0, rest: [0; 5] };
    // SAFETY : structure MEMORYSTATUSEX complète, sa taille renseignée comme l'exige l'API
    if unsafe { GlobalMemoryStatusEx(&mut m) } != 0 {
        (m.total_phys as f64, m.avail_phys as f64)
    } else {
        (0.0, 0.0)
    }
}

/// Texte du rapport : ce qui aide à comprendre un ralentissement, sans image ni nom de projet.
fn report_text(app: &AppWindow, st: &State) -> String {
    let medians = WATCH.with(|w| w.borrow().medians.iter().map(|m| format!("{m:.0}")).collect::<Vec<_>>().join(" / "));
    let docs: Vec<&Doc> = (0..st.tabs.len()).filter_map(|i| if i == st.cur { Some(&st.doc) } else { st.tabs[i].as_ref() }).collect();
    let mut out = i18n::tr_format!("L'interface a manqué de fluidité (rapport automatique).\nDurée d'une image : {medians} ms (médianes, 25 images/s = 40 ms)\nOutil : {}\nÉchelle de l'écran : {:.2} ; résolution de rendu : {} ; réduction de la toile : {} ; mode léger : {}\n", app.get_current_tool(), screen_scale(), app.get_render_scale_start(), st.doc.render_div_set(), app.get_set_perf_mode());
    out += &machine_lines();
    out.push('\n');
    out += &tech_info(app, st);
    if !st.empty {
        for (i, d) in docs.iter().enumerate() {
            let filters = d.layers.iter().filter(|l| l.dynamic.is_some()).count();
            let masks = d.layers.iter().filter(|l| l.mask.is_some()).count();
            let bytes: usize = d.layers.iter().map(|l| l.px.len()).sum();
            out += &i18n::tr_format!("\nProjet {} : {} × {} px, {} calque(s), {} filtre(s) ƒ, {} masque(s) α, {:.0} Mo, {} étape(s) d'historique", i + 1, d.w, d.h, d.layers.len(), filters, masks, bytes as f64 / 1_048_576.0, d.history_steps());
        }
    }
    out
}

/// Ouvre le formulaire de rapport, déjà rempli : rien ne part sans « Envoyer ».
pub(crate) fn open_report(app: &AppWindow, st: &State) {
    app.set_contact_kind(0);
    app.set_contact_message(SharedString::default());
    app.set_contact_journal(report_text(app, st).into());
    app.set_contact_with_journal(true);
    app.set_show_contact(true);
}

/// Carte graphique sans accélération réelle (rendu sur le processeur).
fn software_renderer(name: &str) -> bool {
    let n = name.to_lowercase();
    ["swiftshader", "llvmpipe", "softpipe", "software", "basic render"].iter().any(|k| n.contains(k))
}

thread_local! {
    /// carte graphique annoncée (None : pas encore connue ; Some("") : aucune)
    static RENDERER: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Nom de la carte connu : le matériel suffit-il à juger ce PC modeste ?
pub(crate) fn hardware_check(app: &AppWindow, renderer: Option<&str>) {
    RENDERER.with(|r| *r.borrow_mut() = Some(renderer.unwrap_or("").to_string()));
    if !ARMED.with(|a| a.get()) || app.get_set_perf_done() {
        return;
    }
    #[cfg(target_arch = "wasm32")]
    let cores = web_sys::window().map_or(4, |w| w.navigator().hardware_concurrency() as usize);
    #[cfg(not(target_arch = "wasm32"))]
    let cores = std::thread::available_parallelism().map_or(4, |n| n.get());
    if renderer.is_some_and(software_renderer) {
        lighten(app, "pas de carte graphique accélérée");
    } else if cores <= 2 {
        lighten(app, "deux cœurs de calcul ou moins");
    }
}

/// Applique le mode léger, une seule fois.
fn lighten(app: &AppWindow, why: &str) {
    if app.get_set_perf_done() {
        return;
    }
    let cut = app.get_set_shadows() as i32 | (app.get_set_title_transparent() as i32) << 1 | (app.get_set_header_preview() as i32) << 2 | (app.get_set_hover_fx() as i32) << 3;
    app.set_set_perf_cut(cut);
    app.set_set_perf_done(true);
    apply(app, false, false, false, false);
    applog::log(format!("Mode léger : {why}"));
    if cut != 0 {
        status(app, "Mode léger actif (Paramètres › Performances)");
    }
}

/// Mode léger changé : ce qu'il avait coupé revient, puis le nouveau mode s'applique.
pub(crate) fn auto_changed(app: &AppWindow) {
    if app.get_set_perf_done() {
        let cut = app.get_set_perf_cut();
        app.set_set_perf_cut(0);
        app.set_set_perf_done(false);
        if cut & 16 != 0 {
            app.set_set_render_scale(0);
        }
        apply(app, app.get_set_shadows() || cut & 1 != 0, app.get_set_title_transparent() || cut & 2 != 0, app.get_set_header_preview() || cut & 4 != 0, app.get_set_hover_fx() || cut & 8 != 0);
    }
    WATCH.with(|w| *w.borrow_mut() = Watch::default());
    START.with(|s| s.set(now_ms()));
    if app.get_set_perf_mode() == 1 {
        lighten(app, "demandé dans les Paramètres");
    }
    arm(app);
    app.invoke_settings_changed();
}

fn apply(app: &AppWindow, shadows: bool, transparent: bool, preview: bool, hover: bool) {
    app.set_set_shadows(shadows);
    app.set_set_title_transparent(transparent);
    app.set_set_header_preview(preview);
    app.set_set_hover_fx(hover);
    // ombres, survol, transparence et verre Aero selon le dessin des contrôles (ultra léger,
    // Windows 7…) : même calcul que le changement de thème
    let t = app.global::<Theme>();
    crate::theme::apply(app, t.get_dark(), t.get_accent_base());
    app.invoke_settings_changed();
}

// ------------------------------------------------------------------ audit du premier lancement

/// Réglages d'avant l'audit, rétablis par « Ne pas optimiser ».
pub(crate) struct Before {
    shadows: bool,
    hover: bool,
    transparent: bool,
    preview: bool,
    aero_blur: bool,
    render_default: i32,
    render_scale: i32,
    history_max: f32,
    history_keep: f32,
    perf_done: bool,
    perf_cut: i32,
}

/// Calcul de référence sur un seul cœur, proche du vrai travail de MasterPaint : flou en boîte
/// (0,4 Mpx, 3 passes), superposition de 4 calques RGBA de 0,8 Mpx en mode normal avec opacité
/// (débit mémoire), puis conversion sRGB → linéaire (calcul flottant des photos). Millisecondes,
/// **médiane** de cinq essais : un PC modeste qui ne tient qu'un bref pic de vitesse (turbo,
/// tablette qui chauffe) n'obtient pas un bon score sur son meilleur essai.
fn cpu_bench() -> f64 {
    let (w, h) = (768usize, 512usize);
    let mut a: Vec<f32> = (0..w * h).map(|i| ((i * 2654435761usize) >> 7 & 255) as f32).collect();
    let mut b = vec![0f32; w * h];
    let (cw, ch) = (1024usize, 768usize);
    let layers: Vec<Vec<u8>> = (0..4u32)
        .map(|l| (0..cw * ch * 4).map(|i| ((i as u32).wrapping_mul(2654435761).wrapping_add(l * 97) >> 9) as u8).collect())
        .collect();
    let mut out = vec![0u8; cw * ch * 4];
    let lin: Vec<f32> = (0..262_144).map(|i| (i & 1023) as f32 / 1023.0).collect();
    let mut runs = Vec::with_capacity(5);
    for _ in 0..5 {
        let t0 = now_ms();
        for _ in 0..3 {
            for y in 0..h {
                let row = &a[y * w..(y + 1) * w];
                let mut acc: f32 = row[..9].iter().sum();
                for x in 4..w - 5 {
                    b[y * w + x] = acc * (1.0 / 9.0);
                    acc += row[x + 5] - row[x - 4];
                }
            }
            for y in 4..h - 5 {
                for x in 0..w {
                    let mut acc = 0f32;
                    for k in 0..9 {
                        acc += b[(y + k - 4) * w + x];
                    }
                    a[y * w + x] = acc * (1.0 / 9.0);
                }
            }
        }
        // superposition : chaque calque par-dessus le résultat (alpha × opacité 80 %)
        out.copy_from_slice(&layers[0]);
        for l in &layers[1..] {
            for (o, s) in out.chunks_exact_mut(4).zip(l.chunks_exact(4)) {
                let al = s[3] as u32 * 204 / 255;
                let inv = 255 - al;
                for c in 0..3 {
                    o[c] = ((s[c] as u32 * al + o[c] as u32 * inv + 127) / 255) as u8;
                }
                o[3] = (al + o[3] as u32 * inv / 255).min(255) as u8;
            }
        }
        let mut sum = 0f32;
        for &v in &lin {
            sum += if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) };
        }
        std::hint::black_box((&a, &out, sum));
        runs.push(now_ms() - t0);
    }
    runs.sort_by(|x, y| x.total_cmp(y));
    runs[2]
}

/// Rendu complet de l'interface (une image de la fenêtre, hors écran) : millisecondes, médiane de
/// trois ; `None` si la plateforme ne sait pas le faire. Mesure ce que le calcul seul ne voit pas :
/// rendu logiciel, carte graphique faible, écran très grand.
fn render_bench(app: &AppWindow) -> Option<f64> {
    let mut runs = Vec::with_capacity(3);
    for _ in 0..3 {
        let t0 = now_ms();
        app.window().request_redraw();
        let shot = app.window().take_snapshot().ok()?;
        std::hint::black_box(shot.width());
        runs.push(now_ms() - t0);
    }
    runs.sort_by(|x, y| x.total_cmp(y));
    Some(runs[1])
}

/// Cœurs, mémoire de l'appareil (Go, 0 : inconnue), écran à haute densité.
fn machine() -> (usize, f64) {
    #[cfg(target_arch = "wasm32")]
    {
        let win = web_sys::window();
        let cores = win.as_ref().map_or(4, |w| w.navigator().hardware_concurrency() as usize);
        let ram = win
            .and_then(|w| js_sys::Reflect::get(&w.navigator(), &"deviceMemory".into()).ok())
            .and_then(|v| v.as_f64())
            .unwrap_or(0.0);
        (cores, ram)
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        let cores = std::thread::available_parallelism().map_or(4, |n| n.get());
        (cores, system_memory().0 / 1_073_741_824.0)
    }
}

/// Classe du PC : 0 puissant, 1 correct, 2 modeste, 3 très lent.
fn tier(cpu_ms: f64, cores: usize, ram_gb: f64, soft_gpu: bool, render_ms: Option<f64>) -> u8 {
    let mut score = 0;
    if let Some(r) = render_ms {
        score += if r > 150.0 { 2 } else if r > 60.0 { 1 } else { 0 };
    }
    if soft_gpu {
        score += 3;
    }
    score += if cores <= 2 { 3 } else if cores <= 4 { 1 } else { 0 };
    if ram_gb > 0.0 {
        score += if ram_gb < 3.0 { 2 } else if ram_gb < 6.0 { 1 } else { 0 };
    }
    // seuils pour le banc complet (flou + calques + flottant) : ~12 ms sur un PC de bureau récent
    score += if cpu_ms > 200.0 { 3 } else if cpu_ms > 100.0 { 2 } else if cpu_ms > 46.0 { 1 } else { 0 };
    match score {
        0..=1 => 0,
        2..=3 => 1,
        4..=5 => 2,
        _ => 3,
    }
}

/// Fenêtre de bienvenue fermée (ou absente) au tout premier lancement : mesure ce PC, ajuste
/// les réglages, puis montre ce qui a changé (OK / Ne pas optimiser). Une seule fois.
pub(crate) fn first_audit(app: &AppWindow) {
    if app.get_set_perf_audit() || SYNC_LOADS.load(std::sync::atomic::Ordering::Relaxed) {
        return;
    }
    let weak = app.as_weak();
    // la carte graphique est annoncée peu après le démarrage : l'attendre un peu
    slint::Timer::single_shot(std::time::Duration::from_millis(1200), move || audit_when_idle(weak, 0));
}

fn audit_when_idle(weak: slint::Weak<AppWindow>, tries: u32) {
    let (Some(app), Some(state)) = (weak.upgrade(), APP_STATE.with(|s| s.borrow().clone())) else { return };
    if app.get_set_perf_audit() {
        return;
    }
    let busy = state.try_borrow().map_or(true, |st| st.task.is_some() || st.session.busy());
    let renderer_known = RENDERER.with(|r| r.borrow().is_some());
    if (busy || app.get_show_welcome() || !renderer_known) && tries < 20 {
        let weak = weak.clone();
        slint::Timer::single_shot(std::time::Duration::from_millis(1000), move || audit_when_idle(weak, tries + 1));
        return;
    }
    if busy {
        return;
    }
    run_audit(&app, &state);
}

fn run_audit(app: &AppWindow, state: &Shared) {
    let cpu_ms = cpu_bench();
    let render_ms = render_bench(app);
    let (cores, ram_gb) = machine();
    let renderer = RENDERER.with(|r| r.borrow().clone()).unwrap_or_default();
    let soft = renderer.is_empty() || software_renderer(&renderer);
    let tier = tier(cpu_ms, cores, ram_gb, soft, render_ms);
    let before = Before {
        shadows: app.get_set_shadows(),
        hover: app.get_set_hover_fx(),
        transparent: app.get_set_title_transparent(),
        preview: app.get_set_header_preview(),
        aero_blur: app.get_set_aero_blur(),
        render_default: app.get_set_render_default(),
        render_scale: app.get_set_render_scale(),
        history_max: app.get_set_history_max(),
        history_keep: app.get_set_history_keep(),
        perf_done: app.get_set_perf_done(),
        perf_cut: app.get_set_perf_cut(),
    };
    app.set_set_perf_audit(true);
    let mut changes: Vec<String> = Vec::new();
    let tr = |s: &str| i18n::tr(s).to_string();
    // historique : plus d'étapes si la mémoire abonde, moins sur un petit PC
    let (hm, hk) = match tier {
        0 if ram_gb >= 15.0 => (40.0, 5.0),
        0 | 1 => (before.history_max, before.history_keep),
        2 => (12.0, 2.0),
        _ => (6.0, 1.0),
    };
    if (hm - before.history_max).abs() >= 1.0 || (hk - before.history_keep).abs() >= 1.0 {
        app.set_set_history_max(hm);
        app.set_set_history_keep(hk);
        changes.push(i18n::tr_format!("Historique : {} étapes (tous projets), {} gardées par projet", hm, hk));
    }
    if tier >= 2 && before.aero_blur {
        app.set_set_aero_blur(false);
        changes.push(tr("Flou derrière le verre Aero coupé"));
    }
    if tier >= 2 {
        // nouveaux projets rendus ÷2 à l'écran (l'enregistrement reste en pleine résolution)
        if before.render_default < 1 {
            app.set_set_render_default(1);
            editor::RENDER_DEFAULT.store(2, std::sync::atomic::Ordering::Relaxed);
            changes.push(tr("Toile rendue ÷2 à l'écran pour les nouveaux projets (l'enregistrement reste en pleine résolution)"));
        }
        if before.shadows {
            app.set_set_shadows(false);
            changes.push(tr("Ombres des fenêtres coupées"));
        }
        if before.preview {
            app.set_set_header_preview(false);
            changes.push(tr("Aperçu flouté du projet en haut coupé"));
        }
    }
    if tier >= 3 {
        if before.hover {
            app.set_set_hover_fx(false);
            changes.push(tr("Surbrillance au survol coupée"));
        }
        if before.transparent {
            app.set_set_title_transparent(false);
            changes.push(tr("Fenêtres transparentes coupées"));
        }
        if screen_scale() > 1.0 && before.render_scale == 0 {
            app.set_set_render_scale(1);
            changes.push(tr("Interface dessinée comme à 100 % (pris en compte au prochain lancement)"));
        }
        if !before.perf_done && app.get_set_perf_mode() == 0 {
            lighten(app, "audit du premier lancement");
            changes.push(tr("Style ultra léger (mode léger), réversible dans Paramètres › Performances"));
        }
    }
    let t = app.global::<Theme>();
    crate::theme::apply(app, t.get_dark(), t.get_accent_base());
    app.invoke_settings_changed();
    let class = match tier {
        0 => tr("puissant"),
        1 => tr("correct"),
        2 => tr("modeste"),
        _ => tr("très lent"),
    };
    let gpu = if soft { tr("aucune carte graphique accélérée") } else { renderer.clone() };
    let ram = if ram_gb > 0.0 { i18n::tr_format!("{:.0} Go de mémoire", ram_gb) } else { tr("mémoire inconnue") };
    let rend = render_ms.map_or_else(String::new, |r| i18n::tr_format!(", rendu de l'interface {:.0} ms", r));
    let found = i18n::tr_format!("PC {class} : {cores} cœurs, {ram}, calcul de référence {:.0} ms{rend}, {gpu}.", cpu_ms);
    applog::log(format!("Audit du premier lancement : {found}"));
    let (title, intro) = if changes.is_empty() {
        (tr("Performances vérifiées"), i18n::tr_format!("{found}\nCe PC fait tourner MasterPaint confortablement : les réglages restent tels quels."))
    } else {
        (tr("Performances optimisées"), i18n::tr_format!("{found}\nLes réglages ont été ajustés au mieux pour ce PC :\n• {}", changes.join("\n• ")))
    };
    let mut st = state.borrow_mut();
    st.task = Some(Task::PerfAudit(Box::new(before)));
    drop(st);
    if changes.is_empty() {
        show_task(app, &title, &intro, "Modifiable à tout moment dans Paramètres › Performances.", "", &[("OK", "Fermer.")], Vec::new());
    } else {
        show_task(
            app,
            &title,
            &intro,
            "Modifiable à tout moment dans Paramètres › Performances.",
            "",
            &[("OK", "Garder ces réglages."), ("Ne pas optimiser", "Revenir aux réglages d'avant.")],
            Vec::new(),
        );
    }
}

/// « Ne pas optimiser » : tous les réglages d'avant l'audit reviennent.
pub(crate) fn audit_undo(app: &AppWindow, b: &Before) {
    app.set_set_history_max(b.history_max);
    app.set_set_history_keep(b.history_keep);
    app.set_set_aero_blur(b.aero_blur);
    app.set_set_render_default(b.render_default);
    editor::RENDER_DEFAULT.store(1 << b.render_default.clamp(0, 3), std::sync::atomic::Ordering::Relaxed);
    app.set_set_render_scale(b.render_scale);
    app.set_set_perf_done(b.perf_done);
    app.set_set_perf_cut(b.perf_cut);
    apply(app, b.shadows, b.transparent, b.preview, b.hover);
    arm(app);
    status(app, "Réglages d'origine rétablis");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slow_only_after_three_slow_windows_in_a_row() {
        let mut w = Watch::default();
        let run = |w: &mut Watch, cost: f64| (0..WINDOW).any(|_| w.note(cost, cost));
        assert!(!run(&mut w, 60.0));
        assert!(!run(&mut w, 60.0));
        assert!(!run(&mut w, 16.0), "une fenêtre fluide remet le compte à zéro");
        assert!(!run(&mut w, 60.0));
        assert!(!run(&mut w, 60.0));
        assert!(run(&mut w, 60.0));
    }

    #[test]
    fn isolated_slow_frames_and_long_pauses_do_not_count() {
        let mut w = Watch::default();
        for i in 0..WINDOW * 10 {
            // une image sur cinq lente : la médiane reste fluide
            assert!(!w.note(if i % 5 == 0 { 300.0 } else { 8.0 }, 16.0));
        }
        for _ in 0..WINDOW * 10 {
            // images espacées (survol) mais vite tracées
            assert!(!w.note(5.0, 900.0));
        }
    }

    #[test]
    fn audit_tiers() {
        assert_eq!(tier(10.0, 16, 32.0, false, Some(12.0)), 0);
        assert_eq!(tier(60.0, 4, 8.0, false, None), 1);
        assert_eq!(tier(110.0, 4, 4.0, false, Some(20.0)), 2);
        assert_eq!(tier(150.0, 2, 2.0, true, Some(200.0)), 3);
        // calcul rapide mais rendu de l'interface très lent : pas « puissant »
        assert!(tier(10.0, 8, 16.0, false, Some(200.0)) >= 1);
        println!("calcul de référence : {:.1} ms", cpu_bench());
    }

    #[test]
    fn software_renderers_are_recognised() {
        assert!(software_renderer("Google SwiftShader"));
        assert!(software_renderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)"));
        assert!(software_renderer("llvmpipe (LLVM 15.0.7, 256 bits)"));
        assert!(software_renderer("Microsoft Basic Render Driver"));
        assert!(!software_renderer("ANGLE (Intel, Intel(R) UHD Graphics 620)"));
        assert!(!software_renderer("NVIDIA GeForce RTX 3060"));
    }
}
