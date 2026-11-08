// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Mode Animation (frise) — portage de js/anim/AnimationTimeline.js.
//!
//! Modèle (par document) : `Doc::anim` = { ips, durée, tête de lecture, boucle, aller-retour,
//! pelure d'oignon… }. Modèle (par calque) : `Layer::cels`, triés par image ; un cel est
//! « exposé » (maintenu) de son image jusqu'au cel suivant (ou à la fin de la frise),
//! éventuellement écourté par `hold` (trou vide après).
//!
//! Comme dans la version web, les pixels du calque (`Layer::px`) sont repointés sur le cel
//! exposé à la tête de lecture (`resolve`) : tous les outils et effets existants travaillent
//! sans le savoir sur l'image courante. Ce qu'ils ont modifié est rangé dans le cel avant
//! chaque étape d'historique ou changement d'image (`stash`) : le calque est comparé au
//! tampon posé par `resolve` (référence faible), sans parcourir les pixels.

use crate::vector::VectorLayer;
use crate::editor::{Doc, Layer, Px};
use std::cell::RefCell;

/// Maintien « jusqu'au cel suivant » (valeur de la version web : 1e9).
pub const HOLD_INF: usize = 1_000_000_000;

/// Dessin d'un calque posé à l'image `frame`, maintenu `hold` images au plus.
#[derive(Clone)]
pub struct Cel {
    pub frame: usize,
    pub hold: usize,
    pub px: Px,
    /// calque SVG (mode Animation SVG) : objets de ce dessin (`px` en est le rendu)
    pub vector: Option<Box<VectorLayer>>,
}

/// Réglages de l'animation d'un document (clé `animation` du .illu).
#[derive(Clone, Debug, PartialEq)]
pub struct Anim {
    pub fps: u32,
    pub duration: usize,
    pub playhead: usize,
    pub looping: bool,
    pub pingpong: bool,
    pub onion: bool,
    /// pelure d'oignon sur tous les calques (sinon le calque actif seul)
    pub onion_all: bool,
    pub onion_before: usize,
    pub onion_after: usize,
    pub onion_opacity: f32,
    /// avancer d'une image après chaque tracé (dessin image par image)
    pub draw_step: bool,
}

impl Default for Anim {
    fn default() -> Self {
        Anim { fps: 12, duration: 24, playhead: 0, looping: true, pingpong: false, onion: false, onion_all: false, onion_before: 1, onion_after: 1, onion_opacity: 0.4, draw_step: false }
    }
}

/// Calques animés : tous sauf les dossiers. Un calque SVG garde aussi ses objets par dessin
/// (`Cel::vector`), son rendu restant dans `px`.
pub fn animated(l: &Layer) -> bool {
    !l.group
}

/// Objets d'un calque SVG à l'image `t` (dessin exposé, sinon calque vide qui garde les effets) ;
/// None pour un calque de pixels.
fn vec_at(l: &Layer, t: usize) -> Option<Box<VectorLayer>> {
    let cur = l.vector.as_ref()?;
    Some(match cel_index_at(l, t).and_then(|i| l.cels[i].vector.clone()) {
        Some(v) => v,
        None => Box::new(VectorLayer { objects: Vec::new(), effects: cur.effects.clone(), serial: 0 }),
    })
}

/// Indice du cel exposé à l'image `t` (None : trou ou aucun cel).
pub fn cel_index_at(l: &Layer, t: usize) -> Option<usize> {
    let idx = l.cels.iter().rposition(|c| c.frame <= t)?;
    (t < exposure_end(l, idx)).then_some(idx)
}

/// Première image où le cel `idx` n'est plus exposé.
pub fn exposure_end(l: &Layer, idx: usize) -> usize {
    let c = &l.cels[idx];
    let next = l.cels.get(idx + 1).map_or(usize::MAX, |n| n.frame);
    c.frame.saturating_add(if c.hold == 0 { HOLD_INF } else { c.hold }).min(next)
}

thread_local! {
    /// tampon transparent partagé (taille du document) : les trous de la frise ne coûtent rien
    static BLANK: RefCell<Option<(usize, usize, Px)>> = const { RefCell::new(None) };
    /// presse-papiers de cel (Copier / Coller le cel)
    static CEL_CLIP: RefCell<Option<(usize, usize, Px)>> = const { RefCell::new(None) };
}

fn blank(w: usize, h: usize) -> Px {
    BLANK.with(|b| {
        let mut b = b.borrow_mut();
        match b.as_ref() {
            Some((bw, bh, px)) if *bw == w && *bh == h => px.clone(),
            _ => {
                let px: Px = vec![0u8; w * h * 4].into();
                *b = Some((w, h, px.clone()));
                px
            }
        }
    })
}

fn sort_cels(l: &mut Layer) {
    l.cels.sort_by_key(|c| c.frame);
}

/// Pixels de `l` à l'image `t` (cel exposé, sinon transparent).
fn px_at(l: &Layer, t: usize, w: usize, h: usize) -> Px {
    match cel_index_at(l, t) {
        Some(i) => l.cels[i].px.clone(),
        None => blank(w, h),
    }
}

/// Range dans les cels ce que les outils ont modifié à la tête de lecture : le cel posé à
/// cette image est mis à jour ; un dessin maintenu ou un trou modifié devient un nouveau cel
/// à cette image (les images d'avant gardent leur dessin).
pub fn stash(doc: &mut Doc) {
    let Some(t) = doc.anim.as_ref().map(|a| a.playhead) else { return };
    for l in doc.layers.iter_mut().filter(|l| animated(l)) {
        if l.anim_shown.as_ref().is_some_and(|w| l.px.is(w)) {
            continue;
        }
        match cel_index_at(l, t) {
            Some(i) if l.cels[i].frame == t => {
                l.cels[i].px = l.px.clone();
                l.cels[i].vector = l.vector.clone();
            }
            exposed => {
                // trou resté vide (calque ajouté puis rien dessiné) : pas de cel inutile
                if exposed.is_none() && !l.cels.is_empty() && !l.px.iter().skip(3).step_by(4).any(|a| *a > 0) {
                    l.anim_shown = Some(l.px.weak());
                    continue;
                }
                l.cels.retain(|c| c.frame != t);
                l.cels.push(Cel { frame: t, hold: HOLD_INF, px: l.px.clone(), vector: l.vector.clone() });
                sort_cels(l);
            }
        }
        l.anim_shown = Some(l.px.weak());
    }
}

/// Pose sur chaque calque animé le dessin exposé à la tête de lecture.
pub fn resolve(doc: &mut Doc) {
    let Some(t) = doc.anim.as_ref().map(|a| a.playhead) else { return };
    let (w, h) = (doc.w, doc.h);
    for l in doc.layers.iter_mut().filter(|l| animated(l)) {
        // calque ajouté depuis (sans cel) : son contenu devient le premier dessin
        if l.cels.is_empty() {
            l.cels.push(Cel { frame: t, hold: HOLD_INF, px: l.px.clone(), vector: l.vector.clone() });
        }
        if l.vector.is_some() {
            l.vector = vec_at(l, t);
        }
        l.px = px_at(l, t, w, h);
        l.anim_shown = Some(l.px.weak());
    }
}

/// Va à l'image `t` (bornée à la frise).
pub fn goto(doc: &mut Doc, t: usize) {
    stash(doc);
    if let Some(a) = doc.anim.as_mut() {
        a.playhead = t.min(a.duration.saturating_sub(1));
    }
    resolve(doc);
}

/// Image suivante de la lecture (boucle, aller-retour) ; `dir` : sens courant (1 / -1),
/// modifié aux rebonds. None : fin de la lecture (sans boucle).
pub fn next_play_frame(a: &Anim, dir: &mut i32) -> Option<usize> {
    let last = a.duration.saturating_sub(1);
    if last == 0 {
        return Some(0);
    }
    let p = a.playhead as i64 + *dir as i64;
    if a.pingpong {
        if p > last as i64 {
            *dir = -1;
            return Some(last - 1);
        }
        if p < 0 {
            *dir = 1;
            return Some(1);
        }
        return Some(p as usize);
    }
    if p > last as i64 {
        return a.looping.then_some(0);
    }
    Some(p.max(0) as usize)
}

/// Passe le document en mode animation : chaque calque devient le premier dessin de la frise.
pub fn enable(doc: &mut Doc) {
    if doc.anim.is_some() {
        return;
    }
    doc.anim = Some(Anim::default());
    for l in doc.layers.iter_mut().filter(|l| animated(l)) {
        l.cels = vec![Cel { frame: 0, hold: HOLD_INF, px: l.px.clone(), vector: l.vector.clone() }];
        l.anim_shown = Some(l.px.weak());
    }
}

/// Quitte le mode animation : chaque calque garde l'image courante.
pub fn disable(doc: &mut Doc) {
    stash(doc);
    doc.anim = None;
    for l in &mut doc.layers {
        l.cels.clear();
        l.anim_shown = None;
    }
}

/// Dessin vierge à la tête de lecture sur le calque actif, si l'image courante montre un
/// dessin maintenu ou un trou (dessin image par image, comme la version web) ; vrai si créé.
pub fn ensure_blank_cel(doc: &mut Doc) -> bool {
    let Some(t) = doc.anim.as_ref().map(|a| a.playhead) else { return false };
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let l = doc.layer_mut();
    if !animated(l) || cel_index_at(l, t).is_some_and(|i| l.cels[i].frame == t) {
        return false;
    }
    let px: Px = vec![0u8; w * h * 4].into();
    // calque SVG : dessin vierge = aucun objet (les effets du calque restent)
    if let Some(v) = l.vector.as_mut() {
        v.objects.clear();
    }
    l.cels.retain(|c| c.frame != t);
    l.cels.push(Cel { frame: t, hold: HOLD_INF, px: px.clone(), vector: l.vector.clone() });
    sort_cels(l);
    l.px = px;
    l.anim_shown = Some(l.px.weak());
    true
}

// ------------------------------------------------------------------ opérations de la frise

/// Change la durée (images) ; la tête de lecture reste dans la frise.
pub fn set_duration(doc: &mut Doc, n: usize) {
    stash(doc);
    if let Some(a) = doc.anim.as_mut() {
        a.duration = n.clamp(1, 9999);
        a.playhead = a.playhead.min(a.duration - 1);
    }
    resolve(doc);
}

/// Ajoute une image vierge à la fin et s'y place (le calque actif y reçoit un dessin vierge).
pub fn add_frame(doc: &mut Doc) {
    stash(doc);
    let Some(a) = doc.anim.as_mut() else { return };
    a.duration += 1;
    a.playhead = a.duration - 1;
    resolve(doc);
    ensure_blank_cel(doc);
}

/// Insère une image à la tête de lecture (les dessins suivants sont décalés).
pub fn insert_frame(doc: &mut Doc) {
    stash(doc);
    let Some(a) = doc.anim.as_mut() else { return };
    let t = a.playhead;
    a.duration += 1;
    for l in &mut doc.layers {
        for c in l.cels.iter_mut().filter(|c| c.frame >= t) {
            c.frame += 1;
        }
    }
    resolve(doc);
}

/// Supprime l'image à la tête de lecture (dessins posés dessus retirés, suivants décalés).
pub fn remove_frame(doc: &mut Doc) {
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let Some(a) = doc.anim.as_mut() else { return };
    if a.duration <= 1 {
        return;
    }
    let t = a.playhead;
    a.duration -= 1;
    a.playhead = a.playhead.min(a.duration - 1);
    for l in doc.layers.iter_mut().filter(|l| animated(l)) {
        l.cels.retain(|c| c.frame != t);
        for c in l.cels.iter_mut().filter(|c| c.frame > t) {
            c.frame -= 1;
        }
        if l.cels.is_empty() {
            l.cels.push(Cel { frame: 0, hold: HOLD_INF, px: blank(w, h), vector: None });
        }
    }
    resolve(doc);
}

/// Copie le dessin exposé du calque actif sur l'image suivante et s'y place (la frise
/// s'allonge si besoin).
pub fn duplicate_cel(doc: &mut Doc) {
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let Some(a) = doc.anim.as_mut() else { return };
    let t = a.playhead;
    if t + 1 >= a.duration {
        a.duration = t + 2;
    }
    a.playhead = t + 1;
    let l = doc.layer_mut();
    if animated(l) {
        let px = px_at(l, t, w, h);
        let vector = vec_at(l, t);
        l.cels.retain(|c| c.frame != t + 1);
        // copie détachée : la retoucher ne modifie pas l'original
        l.cels.push(Cel { frame: t + 1, hold: HOLD_INF, px: px.to_vec().into(), vector });
        sort_cels(l);
    }
    resolve(doc);
}

/// Crée un dessin à l'image `t` du calque `li` (copie du dessin exposé : image clé).
pub fn key_here(doc: &mut Doc, li: usize, t: usize) {
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    if l.cels.iter().any(|c| c.frame == t) {
        return;
    }
    let px = px_at(l, t, w, h);
    let vector = vec_at(l, t);
    l.cels.push(Cel { frame: t, hold: HOLD_INF, px: px.to_vec().into(), vector });
    sort_cels(l);
    resolve(doc);
}

/// Retire le dessin posé à l'image `t` du calque `li` (le précédent est maintenu à sa place).
/// Le dessin de l'image 0 reste toujours (vidé à la place).
pub fn clear_cel(doc: &mut Doc, li: usize, t: usize) {
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    if t == 0 {
        if let Some(c) = l.cels.iter_mut().find(|c| c.frame == 0) {
            c.px = blank(w, h);
            if let Some(v) = c.vector.as_mut() {
                v.objects.clear();
            }
        }
    } else {
        l.cels.retain(|c| c.frame != t);
    }
    resolve(doc);
}

/// « Figer jusqu'à cette image » : le dessin exposé en `t` s'arrête après `t` (trou ensuite,
/// jusqu'au dessin suivant).
pub fn hold_until(doc: &mut Doc, li: usize, t: usize) {
    stash(doc);
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    let Some(i) = l.cels.iter().rposition(|c| c.frame <= t) else { return };
    l.cels[i].hold = t - l.cels[i].frame + 1;
    resolve(doc);
}

/// Prolonge le dessin exposé du calque `li` en `t` jusqu'au dessin suivant (maintien sans fin).
pub fn hold_forever(doc: &mut Doc, li: usize, t: usize) {
    stash(doc);
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    let Some(i) = l.cels.iter().rposition(|c| c.frame <= t) else { return };
    l.cels[i].hold = HOLD_INF;
    resolve(doc);
}

/// Déplace le dessin posé en `from` vers `to` sur le calque `li` (glisser dans la frise).
pub fn move_cel(doc: &mut Doc, li: usize, from: usize, to: usize) {
    if from == to {
        return;
    }
    stash(doc);
    let Some(dur) = doc.anim.as_ref().map(|a| a.duration) else { return };
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    let Some(k) = l.cels.iter().position(|c| c.frame == from) else { return };
    let mut c = l.cels.remove(k);
    l.cels.retain(|o| o.frame != to);
    c.frame = to.min(dur - 1);
    c.hold = HOLD_INF;
    l.cels.push(c);
    sort_cels(l);
    resolve(doc);
}

/// Copie le dessin exposé en `t` du calque `li` (presse-papiers de cel).
pub fn copy_cel(doc: &mut Doc, li: usize, t: usize) {
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let Some(l) = doc.layers.get(li) else { return };
    let px = px_at(l, t, w, h);
    CEL_CLIP.with(|c| *c.borrow_mut() = Some((w, h, px)));
}

pub fn has_cel_clip(doc: &Doc) -> bool {
    CEL_CLIP.with(|c| c.borrow().as_ref().is_some_and(|(w, h, _)| *w == doc.w && *h == doc.h))
}

/// Colle le dessin copié à l'image `t` du calque `li` (remplace un dessin posé là).
pub fn paste_cel(doc: &mut Doc, li: usize, t: usize) -> bool {
    let Some(px) = CEL_CLIP.with(|c| c.borrow().as_ref().filter(|(w, h, _)| *w == doc.w && *h == doc.h).map(|c| c.2.clone())) else { return false };
    stash(doc);
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return false };
    l.cels.retain(|c| c.frame != t);
    l.cels.push(Cel { frame: t, hold: HOLD_INF, px: px.to_vec().into(), vector: None });
    sort_cels(l);
    resolve(doc);
    true
}

/// Répète le dessin exposé en `t` du calque `li` sur les `n` images suivantes (un dessin
/// détaché par image, prêt à être retouché).
pub fn repeat_cel(doc: &mut Doc, li: usize, t: usize, n: usize) {
    stash(doc);
    let Some(dur) = doc.anim.as_ref().map(|a| a.duration) else { return };
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    let Some(i) = cel_index_at(l, t) else { return };
    let src = l.cels[i].px.clone();
    let vector = l.cels[i].vector.clone();
    for f in t + 1..=(t + n).min(dur - 1) {
        l.cels.retain(|c| c.frame != f);
        l.cels.push(Cel { frame: f, hold: HOLD_INF, px: src.to_vec().into(), vector: vector.clone() });
    }
    sort_cels(l);
    resolve(doc);
}

/// Inverse l'animation dans le temps (maintiens conservés).
pub fn reverse(doc: &mut Doc) {
    stash(doc);
    let (w, h) = (doc.w, doc.h);
    let Some(dur) = doc.anim.as_ref().map(|a| a.duration) else { return };
    for l in doc.layers.iter_mut().filter(|l| animated(l)) {
        let frames: Vec<Option<usize>> = (0..dur).rev().map(|f| cel_index_at(l, f)).collect();
        let mut cels: Vec<Cel> = Vec::new();
        let mut prev: Option<Option<usize>> = None;
        for (f, k) in frames.iter().enumerate() {
            if prev != Some(*k) {
                match k {
                    Some(i) => cels.push(Cel { frame: f, hold: HOLD_INF, px: l.cels[*i].px.clone(), vector: l.cels[*i].vector.clone() }),
                    // trou : dessin transparent (sinon le précédent resterait maintenu)
                    None => cels.push(Cel { frame: f, hold: HOLD_INF, px: blank(w, h), vector: None }),
                }
                prev = Some(*k);
            }
        }
        l.cels = cels;
    }
    resolve(doc);
}

/// Cadence : chaque dessin du calque actif tient `n` images (animer « sur 2 », « sur 3 »…) ;
/// la frise s'allonge ou se raccourcit en conséquence.
pub fn set_exposure(doc: &mut Doc, n: usize) {
    stash(doc);
    let n = n.max(1);
    let li = doc.active;
    let Some(l) = doc.layers.get_mut(li).filter(|l| animated(l)) else { return };
    for (k, c) in l.cels.iter_mut().enumerate() {
        c.frame = k * n;
        c.hold = HOLD_INF;
    }
    let end = l.cels.len() * n;
    if let Some(a) = doc.anim.as_mut() {
        a.duration = a.duration.max(end);
    }
    resolve(doc);
}

/// État de chaque image d'un calque dans la frise : 0 trou, 1 dessin posé (image clé),
/// 2 dessin maintenu.
pub fn row_cells(l: &Layer, duration: usize) -> Vec<i32> {
    (0..duration)
        .map(|t| match cel_index_at(l, t) {
            Some(i) if l.cels[i].frame == t => 1,
            Some(_) => 2,
            None => 0,
        })
        .collect()
}

// ------------------------------------------------------------------ rendus

/// Image complète (calques composés) à l'image `t`, sans toucher au document.
pub fn frame_flat(doc: &Doc, t: usize) -> Vec<u8> {
    let (w, h) = (doc.w, doc.h);
    let layers: Vec<Layer> = doc
        .layers
        .iter()
        .map(|l| {
            let mut c = l.clone();
            if animated(l) && !l.cels.is_empty() {
                c.px = px_at(l, t, w, h);
            }
            c
        })
        .collect();
    Doc::scratch(w, h, layers).flatten()
}

/// Pelure d'oignon : dessins des images voisines (avant en bleu, après en rouge), réduits
/// pour tenir dans `max_side` px, alpha déjà estompé. None : pelure coupée ou rien à montrer.
pub fn onion(doc: &Doc, max_side: usize) -> Option<(Vec<u8>, usize, usize)> {
    let a = doc.anim.as_ref().filter(|a| a.onion)?;
    let (w, h) = (doc.w, doc.h);
    let k = (w.max(h) as f32 / max_side.max(16) as f32).max(1.0);
    let (ow, oh) = (((w as f32 / k).round() as usize).max(1), ((h as f32 / k).round() as usize).max(1));
    let mut out = vec![0u8; ow * oh * 4];
    let t = a.playhead;
    let layers: Vec<&Layer> = if a.onion_all {
        doc.layers.iter().filter(|l| animated(l) && l.visible).collect()
    } else {
        doc.layers.get(doc.active).filter(|l| animated(l)).into_iter().collect()
    };
    let mut any = false;
    // de la plus lointaine à la plus proche : les fantômes proches restent dessus
    let mut offsets: Vec<i64> = (1..=a.onion_before as i64).map(|d| -d).chain(1..=a.onion_after as i64).collect();
    offsets.sort_by_key(|d| std::cmp::Reverse(d.abs()));
    for d in offsets {
        let f = t as i64 + d;
        if f < 0 || f >= a.duration as i64 {
            continue;
        }
        let f = f as usize;
        let tint: [f32; 3] = if d < 0 { [42.0, 107.0, 255.0] } else { [255.0, 59.0, 59.0] };
        let fade = a.onion_opacity.clamp(0.05, 1.0) / d.unsigned_abs() as f32;
        for l in &layers {
            let (Some(i), cur) = (cel_index_at(l, f), cel_index_at(l, t)) else { continue };
            // même dessin qu'à l'image courante (maintien) : rien à montrer
            if cur == Some(i) {
                continue;
            }
            let px = &l.cels[i].px;
            any = true;
            for y in 0..oh {
                let sy = ((y as f32 + 0.5) * k) as usize;
                let row = sy.min(h - 1) * w;
                for x in 0..ow {
                    let sx = (((x as f32 + 0.5) * k) as usize).min(w - 1);
                    let s = (row + sx) * 4;
                    let sa = px[s + 3] as f32 / 255.0 * fade;
                    if sa <= 0.0 {
                        continue;
                    }
                    let o = (y * ow + x) * 4;
                    let lum = (0.299 * px[s] as f32 + 0.587 * px[s + 1] as f32 + 0.114 * px[s + 2] as f32) / 255.0;
                    let da = out[o + 3] as f32 / 255.0;
                    let na = sa + da * (1.0 - sa);
                    for c in 0..3 {
                        // teinte gardant les valeurs du dessin (traits sombres plus visibles)
                        let v = tint[c] * (0.35 + 0.65 * (1.0 - lum));
                        out[o + c] = ((v * sa + out[o + c] as f32 * da * (1.0 - sa)) / na.max(1e-6)).round() as u8;
                    }
                    out[o + 3] = (na * 255.0).round() as u8;
                }
            }
        }
    }
    any.then_some((out, ow, oh))
}

/// Toutes les images composées (export).
pub fn all_frames(doc: &Doc) -> Vec<Vec<u8>> {
    let n = doc.anim.as_ref().map_or(1, |a| a.duration);
    (0..n).map(|t| frame_flat(doc, t)).collect()
}

/// GIF animé (boucle infinie sauf « boucle » coupée).
pub fn encode_gif(frames: &[Vec<u8>], w: usize, h: usize, fps: u32, looping: bool) -> Option<Vec<u8>> {
    use image::codecs::gif::{GifEncoder, Repeat};
    let mut out = Vec::new();
    {
        let mut enc = GifEncoder::new_with_speed(&mut out, 10);
        // sans boucle : pas d'extension de répétition (lecture unique)
        if looping {
            enc.set_repeat(Repeat::Infinite).ok()?;
        }
        let delay = image::Delay::from_numer_denom_ms(1000, fps.max(1));
        for f in frames {
            let img = image::RgbaImage::from_raw(w as u32, h as u32, f.clone())?;
            enc.encode_frame(image::Frame::from_parts(img, 0, 0, delay)).ok()?;
        }
    }
    Some(out)
}

/// Planche de sprites (PNG) : images rangées en grille, de gauche à droite.
pub fn sprite_sheet(frames: &[Vec<u8>], w: usize, h: usize) -> Option<Vec<u8>> {
    let n = frames.len().max(1);
    let cols = (n as f32).sqrt().ceil() as usize;
    let rows = n.div_ceil(cols);
    let (sw, sh) = (cols * w, rows * h);
    let mut sheet = vec![0u8; sw * sh * 4];
    for (k, f) in frames.iter().enumerate() {
        let (ox, oy) = ((k % cols) * w, (k / cols) * h);
        for y in 0..h {
            let d = ((oy + y) * sw + ox) * 4;
            sheet[d..d + w * 4].copy_from_slice(&f[y * w * 4..(y + 1) * w * 4]);
        }
    }
    let img = image::RgbaImage::from_raw(sw as u32, sh as u32, sheet)?;
    let mut out = std::io::Cursor::new(Vec::new());
    img.write_to(&mut out, image::ImageFormat::Png).ok()?;
    Some(out.into_inner())
}

/// Document animé fait d'images successives (GIF animé, séquence) : un calque, un dessin par
/// image, les images identiques qui se suivent deviennent un maintien.
pub fn doc_from_frames(frames: Vec<Vec<u8>>, w: usize, h: usize, fps: u32, title: &str) -> Doc {
    let first = frames.first().cloned().unwrap_or_else(|| vec![0u8; w * h * 4]);
    let mut doc = Doc::from_pixels(w, h, first, title);
    let n = frames.len().max(1);
    let mut cels: Vec<Cel> = Vec::new();
    for (t, f) in frames.into_iter().enumerate() {
        if cels.last().is_some_and(|c: &Cel| *c.px == f) {
            continue;
        }
        cels.push(Cel { frame: t, hold: HOLD_INF, px: f.into(), vector: None });
    }
    doc.anim = Some(Anim { fps: fps.clamp(1, 60), duration: n, ..Anim::default() });
    doc.layers[0].name = crate::i18n::tr("Animation");
    doc.layers[0].cels = cels;
    resolve(&mut doc);
    doc.history.clear();
    doc.hindex = 0;
    doc.commit("Ouvrir l'animation");
    doc
}

/// GIF animé (au moins deux images) : images composées et cadence moyenne.
pub fn decode_gif(bytes: &[u8]) -> Option<(Vec<Vec<u8>>, usize, usize, u32)> {
    use image::AnimationDecoder;
    let dec = image::codecs::gif::GifDecoder::new(std::io::Cursor::new(bytes)).ok()?;
    let frames = dec.into_frames().collect_frames().ok()?;
    if frames.len() < 2 {
        return None;
    }
    let (w, h) = frames[0].buffer().dimensions();
    let mut ms = 0.0f64;
    let mut out = Vec::with_capacity(frames.len());
    for f in frames {
        let (n, d) = f.delay().numer_denom_ms();
        ms += n as f64 / d.max(1) as f64;
        let buf = f.into_buffer();
        if buf.dimensions() != (w, h) {
            continue;
        }
        out.push(buf.into_raw());
    }
    let avg = ms / out.len().max(1) as f64;
    let fps = if avg > 1.0 { (1000.0 / avg).round() as u32 } else { 12 };
    Some((out, w as usize, h as usize, fps.clamp(1, 60)))
}

// ------------------------------------------------------------------ .illu

/// Clé `animation` d'un projet (mêmes noms que la version web).
pub fn to_json(a: &Anim) -> serde_json::Value {
    serde_json::json!({
        "enabled": true,
        "fps": a.fps,
        "duration": a.duration,
        "playhead": a.playhead,
        "loop": a.looping,
        "pingpong": a.pingpong,
        "onionSkin": a.onion,
        "onionAllLayers": a.onion_all,
        "onionBefore": a.onion_before,
        "onionAfter": a.onion_after,
        "onionOpacity": a.onion_opacity,
        "drawStep": a.draw_step,
    })
}

pub fn from_json(j: &serde_json::Value) -> Option<Anim> {
    if !j.get("enabled").and_then(|e| e.as_bool()).unwrap_or(false) {
        return None;
    }
    let u = |k: &str, d: u64| j.get(k).and_then(|v| v.as_u64()).unwrap_or(d);
    let b = |k: &str, d: bool| j.get(k).and_then(|v| v.as_bool()).unwrap_or(d);
    let duration = (u("duration", 24) as usize).clamp(1, 9999);
    Some(Anim {
        fps: u("fps", 12).clamp(1, 60) as u32,
        duration,
        playhead: (u("playhead", 0) as usize).min(duration - 1),
        looping: b("loop", true),
        pingpong: b("pingpong", false),
        onion: b("onionSkin", false),
        onion_all: b("onionAllLayers", false),
        onion_before: u("onionBefore", 1).clamp(0, 5) as usize,
        onion_after: u("onionAfter", 1).clamp(0, 5) as usize,
        onion_opacity: j.get("onionOpacity").and_then(|v| v.as_f64()).unwrap_or(0.4) as f32,
        draw_step: b("drawStep", false),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc() -> Doc {
        let mut d = Doc::new(4, 4, [0, 0, 0, 0], "t");
        enable(&mut d);
        d.commit("Mode animation");
        d
    }

    #[test]
    fn draw_on_held_frame_makes_new_cel() {
        let mut d = doc();
        d.layers[0].px[3] = 255;
        d.commit("trait");
        goto(&mut d, 5);
        // image 5 : dessin de l'image 0 maintenu
        assert_eq!(d.layers[0].px[3], 255);
        assert!(ensure_blank_cel(&mut d));
        d.layers[0].px[7] = 255;
        d.commit("trait 2");
        assert_eq!(row_cells(&d.layers[0], 7), vec![1, 2, 2, 2, 2, 1, 2]);
        goto(&mut d, 0);
        assert_eq!((d.layers[0].px[3], d.layers[0].px[7]), (255, 0));
        goto(&mut d, 6);
        assert_eq!((d.layers[0].px[3], d.layers[0].px[7]), (0, 255));
    }

    #[test]
    fn undo_restores_cels() {
        let mut d = doc();
        goto(&mut d, 2);
        ensure_blank_cel(&mut d);
        d.layers[0].px[3] = 255;
        d.commit("trait");
        d.undo();
        assert_eq!(row_cells(&d.layers[0], 3), vec![1, 2, 2]);
        assert_eq!(d.layers[0].px[3], 0);
        d.redo();
        assert_eq!(d.layers[0].px[3], 255);
    }

    #[test]
    fn hold_reverse_and_remove() {
        let mut d = doc();
        set_duration(&mut d, 4);
        goto(&mut d, 2);
        ensure_blank_cel(&mut d);
        d.layers[0].px[3] = 255;
        stash(&mut d);
        hold_until(&mut d, 0, 0);
        assert_eq!(row_cells(&d.layers[0], 4), vec![1, 0, 1, 2]);
        reverse(&mut d);
        assert_eq!(row_cells(&d.layers[0], 4), vec![1, 2, 1, 1]);
        goto(&mut d, 0);
        remove_frame(&mut d);
        assert_eq!(d.anim.as_ref().unwrap().duration, 3);
    }

    #[test]
    fn frames_dedupe_into_holds() {
        let a = vec![0u8; 16];
        let mut b = vec![0u8; 16];
        b[3] = 9;
        let d = doc_from_frames(vec![a.clone(), a, b], 2, 2, 10, "gif");
        assert_eq!(row_cells(&d.layers[0], 3), vec![1, 2, 1]);
        assert_eq!(d.anim.as_ref().unwrap().fps, 10);
    }
}
