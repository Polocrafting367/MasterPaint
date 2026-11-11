// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Sélection d'objet sans IA et nettoyage des résultats de l'IA (web et bureau).
//!
//! - `cleanup` : ne garde que l'objet visé (le ou les morceaux qui touchent le cœur du cadre ou
//!   sont assez grands), retire les taches, bouche les petits trous. Avant, un bout d'objet voisin
//!   pris dans la marge du cadre ou un reflet restaient sélectionnés.
//! - `color_object` : objet dans un cadre par modèle de couleurs (à la manière de GrabCut, sans
//!   coupe de graphe) : fond appris sur la bordure du cadre, objet sur son centre, puis trois
//!   passes où chaque modèle est réappris sur l'affectation précédente ; probabilité lissée,
//!   seuillée, nettoyée. Repli quand l'IA ne trouve rien (ou prend tout le cadre), et méthode du
//!   bureau (pas d'IA hors du navigateur).

/// Composantes 4-connexes des pixels où `on(i)` : étiquette par pixel (u32::MAX : hors masque)
/// et aire de chaque composante.
fn components(w: usize, h: usize, on: impl Fn(usize) -> bool) -> (Vec<u32>, Vec<usize>) {
    let n = w * h;
    let mut lab = vec![u32::MAX; n];
    let mut areas = Vec::new();
    let mut stack = Vec::new();
    for s in 0..n {
        if lab[s] != u32::MAX || !on(s) {
            continue;
        }
        let id = areas.len() as u32;
        lab[s] = id;
        stack.push(s);
        let mut area = 0;
        while let Some(i) = stack.pop() {
            area += 1;
            let (x, y) = (i % w, i / w);
            let mut go = |j: usize, lab: &mut [u32], stack: &mut Vec<usize>| {
                if lab[j] == u32::MAX && on(j) {
                    lab[j] = id;
                    stack.push(j);
                }
            };
            if x > 0 { go(i - 1, &mut lab, &mut stack); }
            if x + 1 < w { go(i + 1, &mut lab, &mut stack); }
            if y > 0 { go(i - w, &mut lab, &mut stack); }
            if y + 1 < h { go(i + w, &mut lab, &mut stack); }
        }
        areas.push(area);
    }
    (lab, areas)
}

/// Nettoie un masque d'objet `a` (w × h) : garde les morceaux qui touchent `core` (cœur du
/// cadre visé, x0 y0 x1 y1) ou qui font au moins 25 % du plus grand ; retire le reste ; bouche
/// les trous fermés de moins de 4 % de l'objet. Sans `core` : le centre de l'image.
pub fn cleanup(a: &mut [u8], w: usize, h: usize, core: Option<(usize, usize, usize, usize)>) {
    let n = w * h;
    if n == 0 || a.len() < n {
        return;
    }
    let core = core.unwrap_or((w / 4, h / 4, w - w / 4, h - h / 4));
    let (lab, areas) = components(w, h, |i| a[i] >= 128);
    if areas.is_empty() {
        return;
    }
    let mut touches = vec![false; areas.len()];
    for y in core.1..core.3.min(h) {
        for x in core.0..core.2.min(w) {
            let l = lab[y * w + x];
            if l != u32::MAX {
                touches[l as usize] = true;
            }
        }
    }
    let biggest = *areas.iter().max().unwrap_or(&0);
    let min_area = (n / 2000).max(4);
    let keep: Vec<bool> = areas
        .iter()
        .enumerate()
        .map(|(k, &ar)| ar >= min_area && (touches[k] || ar * 4 >= biggest))
        .collect();
    if !keep.iter().any(|k| *k) {
        return;
    }
    let mut kept = 0usize;
    for i in 0..n {
        let l = lab[i];
        if l != u32::MAX {
            if keep[l as usize] {
                kept += 1;
            } else {
                a[i] = 0;
            }
        }
    }
    // pixels doux (< 128) collés à un morceau retiré : retirés aussi s'ils n'en touchent aucun gardé
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            if a[i] == 0 || a[i] >= 128 {
                continue;
            }
            let near_kept = [(-1i32, 0i32), (1, 0), (0, -1), (0, 1), (-2, 0), (2, 0), (0, -2), (0, 2)].iter().any(|(dx, dy)| {
                let (nx, ny) = (x as i32 + dx, y as i32 + dy);
                nx >= 0 && ny >= 0 && (nx as usize) < w && (ny as usize) < h && {
                    let l = lab[ny as usize * w + nx as usize];
                    l != u32::MAX && keep[l as usize]
                }
            });
            if !near_kept {
                a[i] = 0;
            }
        }
    }
    // trous fermés (fond qui ne touche pas le bord) petits devant l'objet : bouchés
    let (hl, hareas) = components(w, h, |i| a[i] < 128);
    let mut border = vec![false; hareas.len()];
    for x in 0..w {
        for y in [0, h - 1] {
            let l = hl[y * w + x];
            if l != u32::MAX {
                border[l as usize] = true;
            }
        }
    }
    for y in 0..h {
        for x in [0, w - 1] {
            let l = hl[y * w + x];
            if l != u32::MAX {
                border[l as usize] = true;
            }
        }
    }
    for i in 0..n {
        let l = hl[i];
        if l != u32::MAX && !border[l as usize] && hareas[l as usize] * 25 < kept {
            a[i] = 255;
        }
    }
}

/// Case d'histogramme d'une couleur (16 niveaux par canal).
fn bin(p: &[u8]) -> usize {
    ((p[0] as usize >> 4) << 8) | ((p[1] as usize >> 4) << 4) | (p[2] as usize >> 4)
}

/// Histogramme lissé (chaque case reçoit aussi un peu de ses voisines : couleurs proches) et
/// normalisé.
fn smooth_hist(raw: &[f32]) -> Vec<f32> {
    let mut out = vec![0f32; 4096];
    let mut total = 0f32;
    for r in 0..16usize {
        for g in 0..16usize {
            for b in 0..16usize {
                let mut s = 0f32;
                for (dr, dg, db, wgt) in [(0i32, 0i32, 0i32, 4f32), (1, 0, 0, 1.), (-1, 0, 0, 1.), (0, 1, 0, 1.), (0, -1, 0, 1.), (0, 0, 1, 1.), (0, 0, -1, 1.)] {
                    let (rr, gg, bb) = (r as i32 + dr, g as i32 + dg, b as i32 + db);
                    if (0..16).contains(&rr) && (0..16).contains(&gg) && (0..16).contains(&bb) {
                        s += wgt * raw[((rr as usize) << 8) | ((gg as usize) << 4) | bb as usize];
                    }
                }
                out[(r << 8) | (g << 4) | b] = s;
                total += s;
            }
        }
    }
    if total > 0.0 {
        out.iter_mut().for_each(|v| *v /= total);
    }
    out
}

/// Moyenne en boîte (rayon `r`) d'un champ w × h.
fn box_blur(f: &mut [f32], w: usize, h: usize, r: usize) {
    if r == 0 {
        return;
    }
    let mut tmp = vec![0f32; w * h];
    for y in 0..h {
        let row = &f[y * w..(y + 1) * w];
        let mut acc: f32 = row[..=r.min(w - 1)].iter().sum();
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
    for x in 0..w {
        let mut acc: f32 = (0..=r.min(h - 1)).map(|y| tmp[y * w + x]).sum();
        for y in 0..h {
            let (lo, hi) = (y.saturating_sub(r), (y + r).min(h - 1));
            f[y * w + x] = acc / (hi - lo + 1) as f32;
            if y + r + 1 < h {
                acc += tmp[(y + r + 1) * w + x];
            }
            if y >= r {
                acc -= tmp[(y - r) * w + x];
            }
        }
    }
}

/// Objet dans le cadre `shape` (masque w × h, > 0 dans le cadre) d'une image `rgba` (même
/// taille ; en pratique le cadre recadré avec une marge) : masque de l'objet (0..255).
pub fn color_object(rgba: &[u8], w: usize, h: usize, shape: &[u8]) -> Vec<u8> {
    let n = w * h;
    let mut out = vec![0u8; n];
    if n == 0 || rgba.len() < n * 4 || shape.len() < n {
        return out;
    }
    // emprise du cadre et distance relative au centre (0 centre, 1 bord du cadre)
    let (mut x0, mut y0, mut x1, mut y1) = (w, h, 0usize, 0usize);
    for y in 0..h {
        for x in 0..w {
            if shape[y * w + x] > 0 {
                (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x + 1), y1.max(y + 1));
            }
        }
    }
    if x1 <= x0 + 2 || y1 <= y0 + 2 {
        return out;
    }
    let (cx, cy, rx, ry) = ((x0 + x1) as f32 / 2.0, (y0 + y1) as f32 / 2.0, (x1 - x0) as f32 / 2.0, (y1 - y0) as f32 / 2.0);
    let rel = |x: usize, y: usize| ((x as f32 + 0.5 - cx) / rx).abs().max(((y as f32 + 0.5 - cy) / ry).abs());
    let bins: Vec<usize> = rgba.chunks_exact(4).map(bin).collect();
    // départ : fond = hors du cadre et bande des 8 % du bord ; objet = cœur (moitié centrale)
    let mut fg = vec![false; n];
    let mut bg = vec![false; n];
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let r = rel(x, y);
            if shape[i] == 0 || r > 0.92 {
                bg[i] = true;
            } else if r < 0.5 {
                fg[i] = true;
            }
        }
    }
    let mut prob = vec![0f32; n];
    for pass in 0..4 {
        let mut hf = vec![0f32; 4096];
        let mut hb = vec![0f32; 4096];
        for i in 0..n {
            if fg[i] {
                hf[bins[i]] += 1.0;
            } else if bg[i] {
                hb[bins[i]] += 1.0;
            }
        }
        let (hf, hb) = (smooth_hist(&hf), smooth_hist(&hb));
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                if shape[i] == 0 {
                    prob[i] = 0.0;
                    continue;
                }
                let (pf, pb) = (hf[bins[i]] + 1e-6, hb[bins[i]] + 1e-6);
                // a priori : plus probable au centre du cadre
                let prior = (1.0 - rel(x, y)).clamp(0.05, 0.95);
                prob[i] = pf * prior / (pf * prior + pb * (1.0 - prior));
            }
        }
        // cohérence spatiale : probabilité moyennée sur un petit voisinage
        box_blur(&mut prob, w, h, (w.max(h) / 200).clamp(1, 6));
        if pass < 3 {
            for i in 0..n {
                fg[i] = shape[i] > 0 && prob[i] > 0.55;
                bg[i] = shape[i] == 0 || prob[i] < 0.45;
            }
        }
    }
    for i in 0..n {
        out[i] = if shape[i] > 0 && prob[i] >= 0.5 { 255 } else { 0 };
    }
    let core = (
        (cx - rx * 0.5) as usize,
        (cy - ry * 0.5) as usize,
        (cx + rx * 0.5).ceil() as usize,
        (cy + ry * 0.5).ceil() as usize,
    );
    cleanup(&mut out, w, h, Some(core));
    out
}

/// Résultat de l'IA inutilisable pour un cadre (rien, ou presque tout le cadre) : la part du
/// cadre couverte.
pub fn coverage(a: &[u8], shape: &[u8]) -> f32 {
    let (mut inside, mut on) = (0usize, 0usize);
    for (v, s) in a.iter().zip(shape) {
        if *s > 0 {
            inside += 1;
            if *v >= 128 {
                on += 1;
            }
        }
    }
    if inside == 0 { 0.0 } else { on as f32 / inside as f32 }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Disque rouge sur fond vert dans un cadre : le disque est retrouvé, le fond non.
    #[test]
    fn finds_disc_in_frame() {
        let (w, h) = (80, 60);
        let mut px = vec![0u8; w * h * 4];
        let mut shape = vec![0u8; w * h];
        for y in 0..h {
            for x in 0..w {
                let i = y * w + x;
                let d = ((x as f32 - 40.0).powi(2) + (y as f32 - 30.0).powi(2)).sqrt();
                let c = if d < 14.0 { [200, 40, 40, 255] } else { [40, 160, 60, 255] };
                px[i * 4..i * 4 + 4].copy_from_slice(&c);
                if (10..70).contains(&x) && (5..55).contains(&y) {
                    shape[i] = 255;
                }
            }
        }
        let m = color_object(&px, w, h, &shape);
        assert_eq!(m[30 * w + 40], 255, "centre du disque");
        assert_eq!(m[8 * w + 12], 0, "fond du cadre");
        let on = m.iter().filter(|v| **v >= 128).count() as f32;
        let disc = std::f32::consts::PI * 14.0 * 14.0;
        assert!((on - disc).abs() / disc < 0.15, "{on} pixels pour {disc}");
    }

    /// Nettoyage : la tache loin du cœur part, le trou se bouche.
    #[test]
    fn cleanup_drops_stray_and_fills_hole() {
        let (w, h) = (50, 50);
        let mut a = vec![0u8; w * h];
        for y in 10..40 {
            for x in 10..40 {
                a[y * w + x] = 255;
            }
        }
        a[25 * w + 25] = 0;
        for y in 1..4 {
            for x in 44..47 {
                a[y * w + x] = 255;
            }
        }
        cleanup(&mut a, w, h, Some((20, 20, 30, 30)));
        assert_eq!(a[25 * w + 25], 255, "trou bouché");
        assert_eq!(a[2 * w + 45], 0, "tache retirée");
    }
}
