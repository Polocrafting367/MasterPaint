// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Sélections automatiques : sujet et arrière-plan par l'IA de détourage (@imgly
//! background-removal, celle de « Supprimer le fond », exécutée par le navigateur), ciel par la
//! détection du moteur (masterpaint-core, `auto_mask_alpha`).
//!
//! Trois usages : Édition › Sélectionner le sujet / l'arrière-plan / le ciel ; sélection
//! d'objet (rectangle ou ellipse avec l'option « IA » : seul le sujet À L'INTÉRIEUR du cadre
//! est gardé) ; masques Sujet / Arrière-plan du Mode Photo Pro (carte jointe à la photo,
//! `Photo::ai`). L'arrière-plan est toujours l'inverse du sujet.
//!
//! L'IA travaille sur une copie réduite (grand côté `AI_SIDE`) : son modèle analyse de toute
//! façon en 1024 px ; l'alpha est ensuite agrandi en bilinéaire.

use super::*;

/// Grand côté de l'image confiée à l'IA (le modèle analyse en 1024 px : au-delà, rien de
/// gagné ; en deçà, la copie à encoder est plus petite).
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
const AI_SIDE: usize = 1024;

/// Modèle de l'IA pour les sélections : le plus léger (quantifié 8 bits), bien plus rapide que
/// celui de « Supprimer le fond » pour un contour presque identique à la taille d'une sélection.
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
const AI_MODEL: &str = "small";

#[cfg(target_arch = "wasm32")]
thread_local! {
    /// dernier sujet calculé (empreinte de l'image, largeur, hauteur, alpha) : redemander le
    /// sujet ou l'arrière-plan de la même image est instantané
    static LAST: RefCell<Option<(u64, usize, usize, std::rc::Rc<Vec<u8>>)>> = const { RefCell::new(None) };
}

/// Empreinte rapide d'une image (taille et un échantillon de pixels).
#[cfg(target_arch = "wasm32")]
fn image_key(rgba: &[u8], w: usize, h: usize) -> u64 {
    use std::hash::{Hash, Hasher};
    let mut hs = std::collections::hash_map::DefaultHasher::new();
    (w, h).hash(&mut hs);
    rgba.iter().step_by(97).for_each(|b| b.hash(&mut hs));
    hs.finish()
}

/// Télécharge à l'avance le module et le modèle de l'IA (option « Objet (IA) », masque Sujet).
pub fn preload() {
    #[cfg(target_arch = "wasm32")]
    web::ai_preload(AI_MODEL);
}

/// Alpha `sw` × `sh` agrandi (ou réduit) en bilinéaire à `w` × `h`.
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
pub fn resize_alpha(a: &[u8], sw: usize, sh: usize, w: usize, h: usize) -> Vec<u8> {
    if sw == w && sh == h {
        return a.to_vec();
    }
    let mut out = vec![0u8; w * h];
    let (kx, ky) = (sw as f32 / w as f32, sh as f32 / h as f32);
    for y in 0..h {
        let fy = ((y as f32 + 0.5) * ky - 0.5).clamp(0.0, (sh - 1) as f32);
        let (y0, ty) = (fy as usize, fy.fract());
        let y1 = (y0 + 1).min(sh - 1);
        for x in 0..w {
            let fx = ((x as f32 + 0.5) * kx - 0.5).clamp(0.0, (sw - 1) as f32);
            let (x0, tx) = (fx as usize, fx.fract());
            let x1 = (x0 + 1).min(sw - 1);
            let g = |xx: usize, yy: usize| a[yy * sw + xx] as f32;
            let top = g(x0, y0) + (g(x1, y0) - g(x0, y0)) * tx;
            let bot = g(x0, y1) + (g(x1, y1) - g(x0, y1)) * tx;
            out[y * w + x] = (top + (bot - top) * ty + 0.5) as u8;
        }
    }
    out
}

/// Alpha du sujet (0..255) d'une image RVBA `w` × `h`, à la taille réduite renvoyée
/// (largeur, hauteur, alpha). `progress(texte, avancement 0..100)` suit les étapes.
#[cfg(target_arch = "wasm32")]
pub async fn subject(rgba: &[u8], w: usize, h: usize, progress: impl Fn(String, f32) + 'static) -> Result<(usize, usize, Vec<u8>), String> {
    let (sw, sh, small) = photo::downscale(rgba, w, h, AI_SIDE);
    let key = image_key(&small, sw, sh);
    if let Some((_, cw, ch, a)) = LAST.with(|l| l.borrow().clone()).filter(|l| l.0 == key && l.1 == sw && l.2 == sh) {
        return Ok((cw, ch, a.to_vec()));
    }
    let out = web::remove_bg(&small, sw, sh, AI_MODEL, move |k, c, t| {
        let (text, pct) = rmbg_step(&k, c, t);
        progress(text, pct)
    })
    .await?;
    if out.len() != sw * sh * 4 {
        return Err("résultat inattendu".into());
    }
    let a: Vec<u8> = out.chunks_exact(4).map(|p| p[3]).collect();
    LAST.with(|l| *l.borrow_mut() = Some((key, sw, sh, std::rc::Rc::new(a.clone()))));
    Ok((sw, sh, a))
}

/// État partagé de l'application (rappel des calculs asynchrones).
#[cfg(target_arch = "wasm32")]
fn shared() -> Option<Shared> {
    SHARED.with(|s| s.borrow().upgrade())
}

/// Fenêtre « Détection du sujet en cours, veuillez patienter » avec Annuler (l'IA peut prendre
/// plusieurs secondes, et télécharge son modèle au premier usage).
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
fn busy_on(app: &AppWindow, title: &str) {
    app.set_load_title(i18n::tr(title).into());
    load_progress(app, 0.03, "Détection du sujet en cours, veuillez patienter…");
    app.set_load_cancel(true);
    app.set_loading(true);
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
fn busy_step(app: &AppWindow, text: &str, pct: f32) {
    if app.get_load_cancel() {
        load_progress(app, (pct / 100.0).clamp(0.03, 0.99), &i18n::tr_format!("Détection du sujet en cours, veuillez patienter… ({})", i18n::tr(text)));
    }
}

#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
fn busy_off(app: &AppWindow) {
    app.set_load_cancel(false);
    if LOADS_ACTIVE.load(std::sync::atomic::Ordering::Relaxed) == 0 {
        app.set_loading(false);
    }
}

/// Annuler dans la fenêtre d'attente : l'analyse est abandonnée (son résultat sera ignoré).
pub fn cancel(app: &AppWindow) {
    #[cfg(target_arch = "wasm32")]
    web::remove_bg_abort();
    busy_off(app);
    status(app, "Sélection IA annulée");
}

/// Message d'échec de l'IA (connexion, bloqueur, navigateur).
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
fn ai_failed(app: &AppWindow, title: &str, why: &str) {
    show_error(
        app,
        title,
        &i18n::tr_format!("L'IA de détourage n'a pas pu analyser l'image ({why}). Vérifiez la connexion (premier usage : téléchargement du modèle), un bloqueur de script, ou essayez un navigateur récent."),
    );
}

/// Bureau : l'IA n'existe que dans la version navigateur pour l'instant.
#[cfg(not(target_arch = "wasm32"))]
fn desktop_only(app: &AppWindow, title: &str) {
    show_error(app, title, "La sélection du sujet utilise un modèle d'IA exécuté dans le navigateur : elle est disponible dans la version web de MasterPaint. La version de bureau suivra.");
}

/// Contour affiné sur l'image pleine résolution (filtre guidé, He et al. 2010) : l'alpha
/// agrandi depuis l'analyse en 1024 px suit les vrais bords de l'image (cheveux, poils) au
/// lieu d'un dégradé flou. `rgba` : image `w` × `h`, `a` : alpha agrandi (même taille).
pub fn refine(a: &mut [u8], rgba: &[u8], w: usize, h: usize) {
    let n = w * h;
    if n == 0 || rgba.len() < n * 4 {
        return;
    }
    let r = ((w.max(h) as f32 / 512.0).round() as usize).clamp(2, 12);
    let eps = 0.004f32;
    let gi: Vec<f32> = rgba.chunks_exact(4).map(|p| (0.299 * p[0] as f32 + 0.587 * p[1] as f32 + 0.114 * p[2] as f32) / 255.0).collect();
    let pa: Vec<f32> = a.iter().map(|v| *v as f32 / 255.0).collect();
    // moyenne en boîte (2r+1)² par sommes glissantes, lignes puis colonnes
    let boxf = |src: &[f32]| -> Vec<f32> {
        let mut tmp = vec![0f32; n];
        for y in 0..h {
            let row = &src[y * w..(y + 1) * w];
            let mut acc = 0f32;
            for x in 0..=r.min(w - 1) {
                acc += row[x];
            }
            for x in 0..w {
                let (lo, hi) = (x.saturating_sub(r), (x + r).min(w - 1));
                tmp[y * w + x] = acc / (hi - lo + 1) as f32;
                if x + r + 1 < w {
                    acc += row[x + r + 1];
                }
                if x >= r {
                    acc -= row[x - r];
                }
            }
        }
        let mut out = vec![0f32; n];
        for x in 0..w {
            let mut acc = 0f32;
            for y in 0..=r.min(h - 1) {
                acc += tmp[y * w + x];
            }
            for y in 0..h {
                let (lo, hi) = (y.saturating_sub(r), (y + r).min(h - 1));
                out[y * w + x] = acc / (hi - lo + 1) as f32;
                if y + r + 1 < h {
                    acc += tmp[(y + r + 1) * w + x];
                }
                if y >= r {
                    acc -= tmp[(y - r) * w + x];
                }
            }
        }
        out
    };
    let mi = boxf(&gi);
    let mp = boxf(&pa);
    let ip: Vec<f32> = gi.iter().zip(&pa).map(|(i, p)| i * p).collect();
    let ii: Vec<f32> = gi.iter().map(|i| i * i).collect();
    let mip = boxf(&ip);
    let mii = boxf(&ii);
    drop((ip, ii));
    let mut ca = vec![0f32; n];
    let mut cb = vec![0f32; n];
    for k in 0..n {
        let var = mii[k] - mi[k] * mi[k];
        let cov = mip[k] - mi[k] * mp[k];
        ca[k] = cov / (var + eps);
        cb[k] = mp[k] - ca[k] * mi[k];
    }
    let ma = boxf(&ca);
    let mb = boxf(&cb);
    for k in 0..n {
        a[k] = ((ma[k] * gi[k] + mb[k]).clamp(0.0, 1.0) * 255.0 + 0.5) as u8;
    }
}

/// Grande image (plus de 3 Mpx) : choix Rapide (contour lissé depuis l'analyse réduite) ou
/// Précise (contour affiné sur l'image entière), demandé selon Paramètres › Choix retenus.
/// None : la question est posée, `job` repartira avec la réponse.
#[cfg_attr(not(target_arch = "wasm32"), allow(dead_code))]
fn quality(app: &AppWindow, st: &mut State, w: usize, h: usize, job: AiJob) -> Option<(bool, AiJob)> {
    if w * h <= 3_000_000 {
        return Some((true, job));
    }
    match app.get_set_ai_quality() {
        1 => return Some((false, job)),
        2 => return Some((true, job)),
        _ => {}
    }
    if st.task.is_some() {
        return Some((false, job));
    }
    st.task = Some(Task::AiQuality(job));
    show_task(
        app,
        "Sélection IA sur une grande image",
        &i18n::tr_format!("L'image fait {w} × {h} px. L'IA analyse toujours une copie réduite (1024 px) ; reste à poser son résultat sur l'image entière."),
        "",
        "",
        &[
            ("Rapide", "Sélection agrandie et lissée : instantané, contour un peu doux."),
            ("Précise", "Contour affiné sur l'image entière (cheveux, poils, bords nets) : un peu plus long."),
        ],
        Vec::new(),
    );
    app.set_task_check(false);
    app.set_task_check_text(i18n::tr("Se souvenir de mon choix (réglable dans Paramètres › Choix retenus)").into());
    None
}

/// Sélection IA en attente de la réponse « Rapide / Précise ».
pub enum AiJob {
    Subject(bool),
    Object(Vec<u8>, SelMode, Option<Vec<u8>>),
}

/// Réponse à la question Rapide / Précise (`r` : 0 rapide, 1 précise, −1 fermée).
pub fn quality_answer(app: &AppWindow, st: &mut State, job: AiJob, r: i32) {
    if r < 0 {
        return status(app, "Sélection IA annulée");
    }
    if app.get_task_check() {
        app.set_set_ai_quality(if r == 1 { 2 } else { 1 });
        save_settings(app);
    }
    run(app, st, job, r == 1);
}

fn run(app: &AppWindow, st: &mut State, job: AiJob, precise: bool) {
    match job {
        AiJob::Subject(bg) => subject_run(app, st, bg, precise),
        AiJob::Object(shape, mode, base) => object_run(app, st, shape, mode, base, precise),
    }
}

/// Édition › Sélectionner le ciel : détection du moteur sur l'image entière (calques visibles),
/// calculée en taille réduite puis agrandie ; combinée selon le mode de sélection.
pub fn select_sky(app: &AppWindow, st: &mut State) {
    let (w, h) = (st.doc.w, st.doc.h);
    let flat = st.doc.flatten_final();
    let (sw, sh, small) = photo::downscale(&flat, w, h, 1600);
    let a = masterpaint_core::auto_mask_alpha(6, &small, sw, sh, 6.0, 0.0);
    let m = resize_alpha(&a, sw, sh, w, h);
    if !m.iter().any(|v| *v > 127) {
        return status(app, "Sélectionner le ciel : aucun ciel trouvé dans l'image");
    }
    let mode = opts(app).sel_mode;
    st.doc.apply_selection(m, mode);
    st.doc.selection_changed();
    sel_changed(app, st);
    status(app, "Ciel sélectionné");
}

/// Édition › Sélectionner le sujet (`background` : l'arrière-plan, son inverse) par l'IA.
pub fn select_subject(app: &AppWindow, st: &mut State, background: bool) {
    let (w, h) = (st.doc.w, st.doc.h);
    if let Some((precise, job)) = quality(app, st, w, h, AiJob::Subject(background)) {
        run(app, st, job, precise);
    }
}

fn subject_run(app: &AppWindow, st: &mut State, background: bool, precise: bool) {
    let title = if background { "Sélectionner l'arrière-plan" } else { "Sélectionner le sujet" };
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = (st, background, precise);
        desktop_only(app, title);
    }
    #[cfg(target_arch = "wasm32")]
    {
        let (w, h, uid) = (st.doc.w, st.doc.h, st.doc.uid);
        let flat = st.doc.flatten_final();
        let mode = opts(app).sel_mode;
        busy_on(app, title);
        let weak = app.as_weak();
        let _ = slint::spawn_local(async move {
            let wk = weak.clone();
            let t0 = now_ms();
            let res = subject(&flat, w, h, move |t, pct| {
                if let Some(app) = wk.upgrade() {
                    busy_step(&app, &t, pct);
                }
            })
            .await;
            let (Some(app), Some(state)) = (weak.upgrade(), shared()) else { return };
            // annulé pendant l'analyse : rien n'est appliqué
            let cancelled = !app.get_load_cancel();
            busy_off(&app);
            match res {
                Ok(_) if cancelled => {}
                Ok((sw, sh, mut a)) => {
                    let Ok(mut st) = state.try_borrow_mut() else { return };
                    if st.doc.uid != uid || st.doc.w != w || st.doc.h != h {
                        return status(&app, "Sélection IA : le document a changé pendant l'analyse, résultat ignoré");
                    }
                    // taches retirées, petits trous bouchés (tous les sujets gardés : cœur = image)
                    crate::seg::cleanup(&mut a, sw, sh, Some((0, 0, sw, sh)));
                    let mut m = resize_alpha(&a, sw, sh, w, h);
                    if precise {
                        refine(&mut m, &flat, w, h);
                    }
                    if background {
                        m.iter_mut().for_each(|v| *v = 255 - *v);
                    }
                    st.doc.apply_selection(m, mode);
                    st.doc.selection_changed();
                    sel_changed(&app, &mut st);
                    status(&app, i18n::tr_format!("{} : {:.1} s", i18n::tr(title), (now_ms() - t0) / 1000.0));
                }
                Err(e) if e == "ILLU_ABORT" || cancelled => status(&app, "Sélection IA annulée"),
                Err(e) => ai_failed(&app, title, &e),
            }
        });
    }
}

/// Sélection d'objet : cadre `shape` (masque du rectangle ou de l'ellipse tracé, déjà
/// appliqué à la sélection) ; l'IA analyse le cadre seul (marge de 6 %), puis la sélection
/// devient `base` combinée selon `mode` avec (sujet ∩ cadre). Sans résultat : le cadre reste.
pub fn select_object(app: &AppWindow, st: &mut State, shape: Vec<u8>, mode: SelMode, base: Option<Vec<u8>>) {
    // pas de question Rapide / Précise : le contour est affiné sur le cadre seul, toujours rapide
    object_run(app, st, shape, mode, base, true);
}

fn object_run(app: &AppWindow, st: &mut State, shape: Vec<u8>, mode: SelMode, base: Option<Vec<u8>>, precise: bool) {
    let (w, h, uid) = (st.doc.w, st.doc.h, st.doc.uid);
    // emprise du cadre
    let (mut x0, mut y0, mut x1, mut y1) = (w, h, 0, 0);
    for y in 0..h {
        let row = &shape[y * w..(y + 1) * w];
        if let (Some(a), Some(b)) = (row.iter().position(|v| *v > 0), row.iter().rposition(|v| *v > 0)) {
            (x0, x1, y0, y1) = (x0.min(a), x1.max(b + 1), y0.min(y), y + 1);
        }
    }
    if x1 <= x0 + 4 || y1 <= y0 + 4 {
        return;
    }
    // cœur du cadre (moitié centrale) : l'objet visé le touche
    let core = (x0 + (x1 - x0) / 4, y0 + (y1 - y0) / 4, x1 - (x1 - x0) / 4, y1 - (y1 - y0) / 4);
    let (mx, my) = ((x1 - x0) * 6 / 100, (y1 - y0) * 6 / 100);
    let (x0, y0, x1, y1) = (x0.saturating_sub(mx), y0.saturating_sub(my), (x1 + mx).min(w), (y1 + my).min(h));
    let (cw, ch) = (x1 - x0, y1 - y0);
    let core = (core.0 - x0, core.1 - y0, core.2 - x0, core.3 - y0);
    let flat = st.doc.flatten_final();
    let mut crop = vec![0u8; cw * ch * 4];
    let mut scrop = vec![0u8; cw * ch];
    for y in 0..ch {
        crop[y * cw * 4..(y + 1) * cw * 4].copy_from_slice(&flat[((y0 + y) * w + x0) * 4..((y0 + y) * w + x1) * 4]);
        scrop[y * cw..(y + 1) * cw].copy_from_slice(&shape[(y0 + y) * w + x0..(y0 + y) * w + x1]);
    }
    drop(flat);
    let (fcrop, fshape) = (crop.clone(), scrop.clone());
    // résultat (cadre recadré) → sélection : coupé au cadre, nettoyé, contour affiné
    let finish = move |app: &AppWindow, st: &mut State, mut a: Vec<u8>, how: &str| {
        let (crop, scrop) = (&fcrop, &fshape);
        for (v, s) in a.iter_mut().zip(scrop) {
            *v = (*v as u16 * *s as u16 / 255) as u8;
        }
        crate::seg::cleanup(&mut a, cw, ch, Some(core));
        // contour affiné : peu coûteux sur le cadre seul (toujours sous 4 Mpx)
        if precise || cw * ch <= 4_000_000 {
            refine(&mut a, crop, cw, ch);
            for (v, s) in a.iter_mut().zip(scrop) {
                *v = (*v as u16 * *s as u16 / 255) as u8;
            }
        }
        if !a.iter().any(|v| *v > 127) {
            return status(app, "Sélection d'objet : aucun objet trouvé dans le cadre, le cadre reste sélectionné");
        }
        let mut m = vec![0u8; w * h];
        for y in 0..ch {
            m[(y0 + y) * w + x0..(y0 + y) * w + x1].copy_from_slice(&a[y * cw..(y + 1) * cw]);
        }
        st.doc.sel = base;
        st.doc.apply_selection(m, mode);
        st.doc.selection_changed();
        sel_changed(app, st);
        status(app, i18n::tr_format!("Objet sélectionné ({how})"));
    };
    // bureau : modèle de couleurs (pas d'IA hors du navigateur)
    #[cfg(not(target_arch = "wasm32"))]
    {
        let _ = uid;
        let c = crate::seg::color_object(&crop, cw, ch, &scrop);
        finish(app, st, c, "couleurs");
    }
    #[cfg(target_arch = "wasm32")]
    {
        let after = st.doc.sel.clone();
        busy_on(app, "Sélection d'objet (IA)");
        let weak = app.as_weak();
        let (crop2, scrop2) = (crop, scrop);
        let _ = slint::spawn_local(async move {
            let wk = weak.clone();
            let res = subject(&crop2, cw, ch, move |t, pct| {
                if let Some(app) = wk.upgrade() {
                    busy_step(&app, &t, pct);
                }
            })
            .await;
            let (Some(app), Some(state)) = (weak.upgrade(), shared()) else { return };
            let cancelled = !app.get_load_cancel();
            busy_off(&app);
            let Ok(mut st) = state.try_borrow_mut() else { return };
            // document ou sélection changés entre-temps : le cadre reste tel quel
            if cancelled || st.doc.uid != uid || st.doc.w != w || st.doc.h != h || st.doc.sel != after {
                return;
            }
            match res {
                Ok((sw, sh, a)) => {
                    let a = resize_alpha(&a, sw, sh, cw, ch);
                    // IA sans réponse utile (rien, ou tout le cadre) : modèle de couleurs
                    let cov = crate::seg::coverage(&a, &scrop2);
                    if !(0.03..=0.93).contains(&cov) {
                        let c = crate::seg::color_object(&crop2, cw, ch, &scrop2);
                        return finish(&app, &mut st, c, "couleurs");
                    }
                    finish(&app, &mut st, a, "IA")
                }
                Err(e) if e == "ILLU_ABORT" => status(&app, "Sélection IA annulée"),
                Err(_) => {
                    // IA indisponible (réseau, modèle) : modèle de couleurs plutôt qu'une erreur
                    let c = crate::seg::color_object(&crop2, cw, ch, &scrop2);
                    finish(&app, &mut st, c, "couleurs, IA indisponible")
                }
            }
        });
    }
}

/// Mode Photo Pro : lance l'IA pour la photo active si un masque Sujet / Arrière-plan attend
/// sa carte (ajout du masque, photo restaurée). En attendant, le masque suit la détection simple.
pub fn pm_ensure(app: &AppWindow, st: &mut State) {
    let active = st.photo.active;
    let Some(p) = st.photo.photos.get_mut(active).filter(|p| p.wants_ai()) else { return };
    #[cfg(not(target_arch = "wasm32"))]
    {
        // pas d'IA sur le bureau : détection simple, signalée une fois
        p.ai_state = 2;
        status(app, "Masque Sujet : la détection par IA est disponible dans la version web ; détection simple en attendant");
    }
    #[cfg(target_arch = "wasm32")]
    {
        p.ai_state = 1;
        let (uid, w, h, px) = (p.uid, p.pw, p.ph, p.preview.clone());
        busy_on(app, "Masque Sujet");
        let weak = app.as_weak();
        let _ = slint::spawn_local(async move {
            let wk = weak.clone();
            let res = subject(&px, w, h, move |t, pct| {
                if let Some(app) = wk.upgrade() {
                    busy_step(&app, &t, pct);
                }
            })
            .await;
            let (Some(app), Some(state)) = (weak.upgrade(), shared()) else { return };
            // Annuler : le masque garde la détection simple (pas de nouvelle demande d'office)
            let cancelled = !app.get_load_cancel();
            busy_off(&app);
            let res = if cancelled { Err("ILLU_ABORT".to_string()) } else { res };
            let Ok(mut st) = state.try_borrow_mut() else { return };
            let st = &mut *st;
            let Some(i) = st.photo.photos.iter().position(|p| p.uid == uid) else { return };
            let p = &mut st.photo.photos[i];
            match res {
                // photo tournée pendant l'analyse : carte ignorée, nouvelle demande
                Ok((sw, sh, a)) if p.pw == w && p.ph == h => {
                    p.ai = Some(std::sync::Arc::new((sw, sh, a)));
                    p.ai_state = 0;
                    status(&app, "Masque Sujet : sujet détecté");
                }
                Ok(_) => p.ai_state = 0,
                Err(e) => {
                    p.ai_state = 2;
                    if e != "ILLU_ABORT" {
                        ai_failed(&app, "Masque Sujet", &e);
                    }
                }
            }
            if i == st.photo.active {
                pm_masks::sync(&app, st);
                pm_render(&app, st);
                pm_ensure(&app, st);
            }
        });
    }
}
