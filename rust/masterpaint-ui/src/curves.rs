//! Réglage « Courbes » (comme js/effects/CurvesPanel.js) : une courbe par canal (RVB, R, V, B),
//! points de contrôle [entrée, sortie] en 0..255 interpolés par spline cubique monotone
//! (Fritsch–Carlson) en table de 256 valeurs. La table RVB s'applique d'abord, puis R / V / B.

pub type Points = Vec<(f32, f32)>;

pub fn identity() -> Points {
    vec![(0.0, 0.0), (255.0, 255.0)]
}

/// Table de 256 valeurs d'une courbe (spline monotone : pas de dépassement entre deux points).
pub fn build_lut(points: &Points) -> [u8; 256] {
    let mut pts = if points.is_empty() { identity() } else { points.clone() };
    pts.sort_by(|a, b| a.0.total_cmp(&b.0));
    let c = |v: f32| v.round().clamp(0.0, 255.0) as u8;
    let mut lut = [0u8; 256];
    let n = pts.len();
    if n == 1 {
        return [c(pts[0].1); 256];
    }
    let (xs, ys): (Vec<f32>, Vec<f32>) = pts.iter().cloned().unzip();
    let dx: Vec<f32> = (0..n - 1).map(|i| if xs[i + 1] - xs[i] == 0.0 { 1.0 } else { xs[i + 1] - xs[i] }).collect();
    let slope: Vec<f32> = (0..n - 1).map(|i| (ys[i + 1] - ys[i]) / dx[i]).collect();
    let mut m = vec![0f32; n];
    m[0] = slope[0];
    m[n - 1] = slope[n - 2];
    for i in 1..n - 1 {
        m[i] = if slope[i - 1] * slope[i] <= 0.0 { 0.0 } else { (slope[i - 1] + slope[i]) / 2.0 };
    }
    for i in 0..n - 1 {
        if slope[i] == 0.0 {
            m[i] = 0.0;
            m[i + 1] = 0.0;
        } else {
            let (a, b) = (m[i] / slope[i], m[i + 1] / slope[i]);
            let hp = (a * a + b * b).sqrt();
            if hp > 3.0 {
                let t = 3.0 / hp;
                m[i] = t * a * slope[i];
                m[i + 1] = t * b * slope[i];
            }
        }
    }
    for (x, v) in lut.iter_mut().enumerate() {
        let x = x as f32;
        if x <= xs[0] {
            *v = c(ys[0]);
            continue;
        }
        if x >= xs[n - 1] {
            *v = c(ys[n - 1]);
            continue;
        }
        let mut seg = 0;
        while seg < n - 2 && x > xs[seg + 1] {
            seg += 1;
        }
        let h = dx[seg];
        let t = (x - xs[seg]) / h;
        let (t2, t3) = (t * t, t * t * t);
        let y = (2.0 * t3 - 3.0 * t2 + 1.0) * ys[seg] + (t3 - 2.0 * t2 + t) * h * m[seg] + (-2.0 * t3 + 3.0 * t2) * ys[seg + 1] + (t3 - t2) * h * m[seg + 1];
        *v = c(y);
    }
    lut
}

/// Paramètres de l'effet « curves » du moteur : tables R, V, B (RVB puis canal).
pub fn engine_params(ch: &[Points; 4]) -> Vec<f32> {
    let rgb = build_lut(&ch[0]);
    let mut p = Vec::with_capacity(768);
    for k in 1..4 {
        let l = build_lut(&ch[k]);
        p.extend((0..256).map(|i| l[rgb[i] as usize] as f32));
    }
    p
}

/// Tracé de la courbe (coordonnées de l'éditeur : y vers le bas).
pub fn path(points: &Points) -> String {
    let lut = build_lut(points);
    let mut s = String::with_capacity(256 * 10);
    for (x, v) in lut.iter().enumerate() {
        s += &format!("{}{x} {} ", if x == 0 { "M" } else { "L" }, 255 - *v as i32);
    }
    s
}

/// Histogramme d'un canal (0 = luminance) sous forme de surface remplie.
pub fn histogram_path(px: &[u8], channel: usize) -> String {
    let mut hist = [0u32; 256];
    for p in px.chunks_exact(4).step_by(3) {
        if p[3] == 0 {
            continue;
        }
        let v = match channel {
            1 => p[0],
            2 => p[1],
            3 => p[2],
            _ => ((p[0] as u32 * 299 + p[1] as u32 * 587 + p[2] as u32 * 114) / 1000) as u8,
        };
        hist[v as usize] += 1;
    }
    let max = (*hist.iter().max().unwrap_or(&1)).max(1) as f32;
    let mut s = String::from("M 0 255 ");
    for (x, c) in hist.iter().enumerate() {
        s += &format!("L {x} {:.1} ", 255.0 - (*c as f32 / max).sqrt() * 250.0);
    }
    s + "L 255 255 Z"
}

/// Édition des points d'une courbe à la souris (rayon de prise : 10 unités).
#[derive(Default)]
pub struct Editor {
    pub drag: Option<usize>,
}

impl Editor {
    fn hit(pts: &Points, x: f32, y: f32) -> Option<usize> {
        pts.iter()
            .enumerate()
            .map(|(i, p)| (i, (p.0 - x).powi(2) + (p.1 - y).powi(2)))
            .filter(|(_, d)| *d <= 100.0)
            .min_by(|a, b| a.1.total_cmp(&b.1))
            .map(|(i, _)| i)
    }

    /// Appui : prend un point, en ajoute un, ou le supprime (clic droit). Retourne true si la courbe change.
    pub fn press(&mut self, pts: &mut Points, x: f32, y: f32, right: bool) -> bool {
        let (x, y) = (x.clamp(0.0, 255.0), y.clamp(0.0, 255.0));
        match Self::hit(pts, x, y) {
            Some(i) if right => {
                self.drag = None;
                if pts.len() > 2 {
                    pts.remove(i);
                    return true;
                }
                false
            }
            Some(i) => {
                self.drag = Some(i);
                false
            }
            None if right => false,
            None => {
                let i = pts.iter().position(|p| p.0 > x).unwrap_or(pts.len());
                pts.insert(i, (x.round(), y.round()));
                self.drag = Some(i);
                true
            }
        }
    }

    /// Glisser : le point reste entre ses voisins (les entrées restent croissantes).
    pub fn moved(&mut self, pts: &mut Points, x: f32, y: f32) -> bool {
        let Some(i) = self.drag else { return false };
        let lo = if i == 0 { 0.0 } else { pts[i - 1].0 + 1.0 };
        let hi = if i + 1 >= pts.len() { 255.0 } else { pts[i + 1].0 - 1.0 };
        pts[i] = (x.round().clamp(lo, hi.max(lo)), y.round().clamp(0.0, 255.0));
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lut_is_identity_then_monotone() {
        let l = build_lut(&identity());
        assert!((0..256).all(|i| l[i] as usize == i));
        let s = build_lut(&vec![(0.0, 0.0), (64.0, 40.0), (192.0, 220.0), (255.0, 255.0)]);
        assert!(s.windows(2).all(|w| w[1] >= w[0]), "courbe en S monotone");
        assert_eq!((s[64], s[192]), (40, 220));
        let mut ed = Editor::default();
        let mut pts = identity();
        assert!(ed.press(&mut pts, 128.0, 160.0, false));
        assert_eq!(pts.len(), 3);
        ed.moved(&mut pts, 300.0, 10.0);
        assert_eq!(pts[1].0, 254.0, "le point ne dépasse pas son voisin");
        assert!(ed.press(&mut pts, 254.0, 10.0, true) && pts.len() == 2);
    }
}
