// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Mode léger (Paramètres › Performances) : plus de surbrillance au survol (rien à redessiner quand
//! la souris passe), ombres, transparence et flou du haut (ces trois-là ne pèsent presque plus).
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

/// Nom de la carte connu : le matériel suffit-il à juger ce PC modeste ?
pub(crate) fn hardware_check(app: &AppWindow, renderer: Option<&str>) {
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
    let t = app.global::<Theme>();
    t.set_shadows(shadows);
    t.set_hover_fx(hover);
    t.set_title_transparent(transparent && !t.get_win98());
    app.invoke_settings_changed();
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
    fn software_renderers_are_recognised() {
        assert!(software_renderer("Google SwiftShader"));
        assert!(software_renderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)"));
        assert!(software_renderer("llvmpipe (LLVM 15.0.7, 256 bits)"));
        assert!(software_renderer("Microsoft Basic Render Driver"));
        assert!(!software_renderer("ANGLE (Intel, Intel(R) UHD Graphics 620)"));
        assert!(!software_renderer("NVIDIA GeForce RTX 3060"));
    }
}
