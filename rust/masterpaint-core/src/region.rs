//! Régions de pixels pour les outils : pot de peinture et baguette magique.
//!
//! Remplace les boucles JavaScript de `floodFill` (js/DrawingTools.js) et du worker de la
//! baguette (js/tools/wand-worker.js) : même résultat, mais sans appel de fonction par pixel.
//!
//! Deux règles de couleur, reprises à l'identique de l'interface :
//! * [`RULE_WAND`]   — baguette : distance RVBA euclidienne ≤ tolérance ;
//! * [`RULE_BUCKET`] — pot de peinture (`buildPixelColorMatchFn`) : tolérance 0 = couleur
//!   exacte ; sinon écart RVB ≤ max(24, t × 1,75) et écart alpha ≤ max(40, t × 2), un pixel
//!   totalement transparent n'étant comparé que sur l'alpha.
//!
//! Le masque de sortie vaut 1 dans la région, 0 ailleurs (convention de l'interface).

pub const RULE_WAND: u32 = 0;
pub const RULE_BUCKET: u32 = 1;

struct Matcher {
    rule: u32,
    seed: [i32; 4],
    tol_sq: f32,
    exact: bool,
    rgb_max_sq: f32,
    alpha_max: i32,
}

impl Matcher {
    fn new(rule: u32, seed: [u8; 4], tol: f32) -> Self {
        let t = tol.max(0.0);
        let rgb_max = (t * 1.75).max(24.0);
        Matcher {
            rule,
            seed: [seed[0] as i32, seed[1] as i32, seed[2] as i32, seed[3] as i32],
            tol_sq: t * t,
            exact: t <= 0.0,
            rgb_max_sq: rgb_max * rgb_max,
            alpha_max: (t * 2.0).max(40.0) as i32,
        }
    }

    #[inline]
    fn matches(&self, p: &[u8]) -> bool {
        let s = &self.seed;
        if self.rule == RULE_WAND {
            let d = |c: usize| (p[c] as i32 - s[c]) as f32;
            return d(0) * d(0) + d(1) * d(1) + d(2) * d(2) + d(3) * d(3) <= self.tol_sq;
        }
        if self.exact {
            return p[0] as i32 == s[0] && p[1] as i32 == s[1] && p[2] as i32 == s[2] && p[3] as i32 == s[3];
        }
        // `da` est entier : da ≤ max(40, t×2) (flottant, interface) ⇔ da ≤ partie entière
        let alpha_ok = (p[3] as i32 - s[3]).abs() <= self.alpha_max;
        if s[3] == 0 || p[3] == 0 {
            return alpha_ok;
        }
        let d = |c: usize| (p[c] as i32 - s[c]) as f32;
        d(0) * d(0) + d(1) * d(1) + d(2) * d(2) <= self.rgb_max_sq && alpha_ok
    }
}

/// Paramètres d'une région.
pub struct RegionArgs<'a> {
    /// image RGBA w×h
    pub src: &'a [u8],
    pub w: usize,
    pub h: usize,
    /// pixel de départ (dans l'image)
    pub sx: usize,
    pub sy: usize,
    /// vrai : zone contiguë (remplissage) ; faux : toute l'image (couleur semblable)
    pub contiguous: bool,
    pub rule: u32,
    pub tol: f32,
    /// masque d'écrêtage (sélection active) : 0 = interdit ; None = pas de sélection
    pub clip: Option<&'a [u8]>,
    /// cadre autorisé [x0, y0, x1, y1] bornes INCLUSES (cadre de la sélection rectangulaire)
    pub bounds: [usize; 4],
}

/// Calcule la région dans `out` (w×h, 1 = dedans). Retourne le nombre de pixels de la région.
pub fn region(a: &RegionArgs, out: &mut [u8]) -> usize {
    let (w, h) = (a.w, a.h);
    out[..w * h].fill(0);
    if w == 0 || h == 0 || a.sx >= w || a.sy >= h {
        return 0;
    }
    let [bx0, by0, bx1, by1] = [a.bounds[0], a.bounds[1], a.bounds[2].min(w - 1), a.bounds[3].min(h - 1)];
    if bx0 > bx1 || by0 > by1 {
        return 0;
    }
    let si = (a.sy * w + a.sx) * 4;
    let m = Matcher::new(a.rule, [a.src[si], a.src[si + 1], a.src[si + 2], a.src[si + 3]], a.tol);

    if !a.contiguous {
        let mut n = 0;
        for y in by0..=by1 {
            let row = y * w;
            for x in bx0..=bx1 {
                let i = row + x;
                if a.clip.is_none_or(|c| c[i] != 0) && m.matches(&a.src[i * 4..i * 4 + 4]) {
                    out[i] = 1;
                    n += 1;
                }
            }
        }
        return n;
    }

    // test de couleur + sélection mémorisé : calculé à la PREMIÈRE visite d'un pixel seulement
    // (0 = pas encore testé, 1 = dedans, 2 = dehors). Le coût suit la taille de la zone
    // remplie : une petite zone ne paie pas le test de toute l'image.
    let okmap = core::cell::RefCell::new(vec![0u8; w * h]);
    let ok = |x: usize, y: usize| -> bool {
        let i = y * w + x;
        let mut mm = okmap.borrow_mut();
        let v = mm[i];
        if v != 0 {
            return v == 1;
        }
        let r = a.clip.is_none_or(|c| c[i] != 0) && m.matches(&a.src[i * 4..i * 4 + 4]);
        mm[i] = if r { 1 } else { 2 };
        r
    };

    // remplissage par segments horizontaux (4-connexité) : chaque segment est rempli d'un coup,
    // puis les lignes du dessus et du dessous sont parcourues pour y trouver de nouveaux départs
    if a.sx < bx0 || a.sx > bx1 || a.sy < by0 || a.sy > by1 || !ok(a.sx, a.sy) {
        return 0;
    }
    let mut n = 0;
    let mut stack: Vec<(usize, usize)> = vec![(a.sx, a.sy)];
    while let Some((x, y)) = stack.pop() {
        if out[y * w + x] != 0 {
            continue;
        }
        let mut lx = x;
        while lx > bx0 && out[y * w + lx - 1] == 0 && ok(lx - 1, y) {
            lx -= 1;
        }
        let mut rx = x;
        while rx < bx1 && out[y * w + rx + 1] == 0 && ok(rx + 1, y) {
            rx += 1;
        }
        out[y * w + lx..=y * w + rx].fill(1);
        n += rx - lx + 1;
        for ny in [y.wrapping_sub(1), y + 1] {
            if ny < by0 || ny > by1 || ny == usize::MAX {
                continue;
            }
            let mut xx = lx;
            while xx <= rx {
                if out[ny * w + xx] == 0 && ok(xx, ny) {
                    stack.push((xx, ny));
                    // sauter le reste du segment : un seul départ par segment
                    while xx <= rx && out[ny * w + xx] == 0 && ok(xx, ny) {
                        xx += 1;
                    }
                } else {
                    xx += 1;
                }
            }
        }
    }
    n
}

/// Peint `color` (RGBA, alpha remplacé comme le pot de peinture de l'interface) sur les
/// pixels du masque. Retourne le nombre de pixels peints.
pub fn fill_mask(img: &mut [u8], mask: &[u8], color: [u8; 4]) -> usize {
    let mut n = 0;
    for (p, &m) in img.chunks_exact_mut(4).zip(mask) {
        if m != 0 {
            p.copy_from_slice(&color);
            n += 1;
        }
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;

    fn img(w: usize, h: usize, f: impl Fn(usize, usize) -> [u8; 4]) -> Vec<u8> {
        let mut d = vec![0u8; w * h * 4];
        for y in 0..h {
            for x in 0..w {
                d[(y * w + x) * 4..(y * w + x) * 4 + 4].copy_from_slice(&f(x, y));
            }
        }
        d
    }

    fn run(src: &[u8], w: usize, h: usize, sx: usize, sy: usize, contiguous: bool, rule: u32, tol: f32, clip: Option<&[u8]>) -> Vec<u8> {
        let mut out = vec![0u8; w * h];
        region(&RegionArgs { src, w, h, sx, sy, contiguous, rule, tol, clip, bounds: [0, 0, w - 1, h - 1] }, &mut out);
        out
    }

    /// Référence naïve (pile de voisins, comme le JavaScript) pour comparer.
    fn naive(src: &[u8], w: usize, h: usize, sx: usize, sy: usize, rule: u32, tol: f32, clip: Option<&[u8]>) -> Vec<u8> {
        let si = (sy * w + sx) * 4;
        let m = Matcher::new(rule, [src[si], src[si + 1], src[si + 2], src[si + 3]], tol);
        let ok = |i: usize| clip.map_or(true, |c| c[i] != 0) && m.matches(&src[i * 4..i * 4 + 4]);
        let mut out = vec![0u8; w * h];
        if !ok(sy * w + sx) {
            return out;
        }
        let mut st = vec![(sx, sy)];
        out[sy * w + sx] = 1;
        while let Some((x, y)) = st.pop() {
            let mut nb = vec![];
            if x > 0 { nb.push((x - 1, y)); }
            if x + 1 < w { nb.push((x + 1, y)); }
            if y > 0 { nb.push((x, y - 1)); }
            if y + 1 < h { nb.push((x, y + 1)); }
            for (nx, ny) in nb {
                let i = ny * w + nx;
                if out[i] == 0 && ok(i) {
                    out[i] = 1;
                    st.push((nx, ny));
                }
            }
        }
        out
    }

    #[test]
    fn scanline_matches_naive_flood() {
        // labyrinthe : couleur dépend d'un motif pseudo-aléatoire, avec trous transparents
        let (w, h) = (97, 61);
        let src = img(w, h, |x, y| {
            let v = ((x * 7 + y * 13) ^ (x * y)) % 5;
            if v == 0 { [0, 0, 0, 0] } else if v < 3 { [200, 30, 30, 255] } else { [60, 200, 90, 255] }
        });
        let clip: Vec<u8> = (0..w * h).map(|i| if (i % w) > 10 && (i / w) < 55 { 1 } else { 0 }).collect();
        for (rule, tol) in [(RULE_WAND, 0.0), (RULE_WAND, 40.0), (RULE_BUCKET, 0.0), (RULE_BUCKET, 64.0), (RULE_BUCKET, 128.0)] {
            for (sx, sy) in [(20, 20), (50, 30), (90, 5)] {
                assert_eq!(run(&src, w, h, sx, sy, true, rule, tol, None), naive(&src, w, h, sx, sy, rule, tol, None), "règle {rule} tol {tol} départ {sx},{sy}");
                assert_eq!(run(&src, w, h, sx, sy, true, rule, tol, Some(&clip)), naive(&src, w, h, sx, sy, rule, tol, Some(&clip)), "écrêté, règle {rule} tol {tol}");
            }
        }
    }

    #[test]
    fn bucket_rule_is_the_interface_rule() {
        let m = Matcher::new(RULE_BUCKET, [100, 100, 100, 255], 32.0);
        // rgbMax = max(24, 56) = 56 ; alphaOkMax = max(40, 64) = 64
        assert!(m.matches(&[140, 100, 130, 255])); // √(40²+30²)=50 ≤ 56
        assert!(!m.matches(&[150, 100, 140, 255])); // √(50²+40²)≈64 > 56
        assert!(m.matches(&[100, 100, 100, 191])); // écart alpha 64
        assert!(!m.matches(&[100, 100, 100, 190])); // 65 > 64
        // pixel transparent : seul l'alpha compte
        let t = Matcher::new(RULE_BUCKET, [0, 0, 0, 0], 32.0);
        assert!(t.matches(&[255, 0, 0, 64]));
        assert!(!t.matches(&[255, 0, 0, 65]));
        // tolérance 0 : couleur exacte
        let e = Matcher::new(RULE_BUCKET, [1, 2, 3, 4], 0.0);
        assert!(e.matches(&[1, 2, 3, 4]) && !e.matches(&[1, 2, 3, 5]));
    }

    #[test]
    fn global_mode_and_bounds() {
        let (w, h) = (10, 10);
        let src = img(w, h, |x, _| if x % 2 == 0 { [255, 255, 255, 255] } else { [0, 0, 0, 255] });
        let mut out = vec![0u8; w * h];
        let n = region(&RegionArgs { src: &src, w, h, sx: 0, sy: 0, contiguous: false, rule: RULE_BUCKET, tol: 0.0, clip: None, bounds: [2, 2, 5, 5] }, &mut out);
        assert_eq!(n, 8); // colonnes paires 2 et 4, lignes 2..=5
        assert_eq!(out[0], 0);
        assert_eq!(out[2 * w + 2], 1);
    }
}
