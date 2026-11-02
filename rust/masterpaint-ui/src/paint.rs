//! Rastérisation : tampons de pinceau, traits, formes (champs de distance anticrénelés),
//! dégradés, polygones de lasso.
//!
//! Un trait s'accumule dans un masque de couverture (`Cover`, max par pixel) puis est
//! appliqué en une fois sur l'état du calque au début du trait : l'opacité ne s'additionne
//! donc pas quand le pinceau repasse sur lui-même (comme Paint.NET).

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BrushShape {
    Round,
    Soft,
    Spray,
    Square,
}

/// Masque de couverture 0..255 de la taille du document, avec son rectangle modifié.
pub struct Cover {
    pub w: usize,
    pub h: usize,
    pub m: Vec<u8>,
    pub dirty: Option<(usize, usize, usize, usize)>,
    /// zone modifiée depuis le dernier `take_recent` (un mouvement de pinceau)
    recent: Option<(usize, usize, usize, usize)>,
    last_pencil: Option<(isize,isize,isize,bool)>,
}

impl Cover {
    pub fn new(w: usize, h: usize) -> Self {
        Cover { w, h, m: vec![0; w * h], dirty: None, recent: None, last_pencil: None }
    }

    /// Rebase an in-progress stroke only when its layer surface grows.
    pub fn rebase(&mut self, w: usize, h: usize, dx: usize, dy: usize) {
        let mut pixels = vec![0; w * h];
        for y in 0..self.h {
            let dst = (y + dy) * w + dx;
            pixels[dst..dst + self.w].copy_from_slice(&self.m[y * self.w..(y + 1) * self.w]);
        }
        let shift = |r: (usize, usize, usize, usize)| (r.0 + dx, r.1 + dy, r.2 + dx, r.3 + dy);
        self.m = pixels;
        self.last_pencil=None;
        self.w = w;
        self.h = h;
        self.dirty = self.dirty.map(shift);
        self.recent = self.recent.map(shift);
    }

    #[inline]
    fn put(&mut self, x: isize, y: isize, v: u8) {
        if x < 0 || y < 0 || x as usize >= self.w || y as usize >= self.h || v == 0 {
            return;
        }
        let i = y as usize * self.w + x as usize;
        if v > self.m[i] {
            self.m[i] = v;
        }
    }

    fn touch(&mut self, x0: isize, y0: isize, x1: isize, y1: isize) {
        let c = |v: isize, hi: usize| v.clamp(0, hi as isize) as usize;
        let (a, b, c2, d) = (c(x0, self.w), c(y0, self.h), c(x1, self.w), c(y1, self.h));
        let grow = |cur: Option<(usize, usize, usize, usize)>| {
            Some(match cur {
                None => (a, b, c2, d),
                Some((p, q, r, s)) => (p.min(a), q.min(b), r.max(c2), s.max(d)),
            })
        };
        self.dirty = grow(self.dirty);
        self.recent = grow(self.recent);
    }

    /// Zone modifiée depuis l'appel précédent (le trait entier reste dans `dirty`).
    pub fn take_recent(&mut self) -> Option<(usize, usize, usize, usize)> {
        self.recent.take()
    }

    /// Couverture d'un pixel (texte) : garde le maximum.
    pub fn put_pub(&mut self, x: isize, y: isize, v: u8) {
        self.put(x, y, v);
    }

    /// Étend le rectangle modifié.
    pub fn touch_pub(&mut self, x0: isize, y0: isize, x1: isize, y1: isize) {
        self.touch(x0, y0, x1, y1);
    }

    /// Tampon de pinceau centré en (cx, cy), rayon r.
    pub fn stamp(&mut self, cx: f32, cy: f32, r: f32, hardness: f32, shape: BrushShape, seed: u32) {
        let r = r.max(0.5);
        let (x0, y0, x1, y1) = ((cx - r - 1.0).floor() as isize, (cy - r - 1.0).floor() as isize, (cx + r + 1.0).ceil() as isize, (cy + r + 1.0).ceil() as isize);
        self.touch(x0, y0, x1 + 1, y1 + 1);
        // Solid round tips: fill the interior directly; only the one-pixel fringe
        // needs a square root. Clip the loops before touching the mask.
        if shape == BrushShape::Round && hardness >= 1.0 {
            let inner2 = (r - 0.5).max(0.0).powi(2);
            let outer2 = (r + 0.5).powi(2);
            let xa = x0.clamp(0, self.w as isize) as usize;
            let xb = (x1 + 1).clamp(0, self.w as isize) as usize;
            for y in y0.max(0) as usize..(y1 + 1).clamp(0, self.h as isize) as usize {
                let dy2 = (y as f32 + 0.5 - cy).powi(2);
                let row = &mut self.m[y * self.w + xa..y * self.w + xb.max(xa)];
                for (k, pixel) in row.iter_mut().enumerate() {
                    let d2 = (xa as f32 + k as f32 + 0.5 - cx).powi(2) + dy2;
                    if d2 <= inner2 {
                        *pixel = 255;
                    } else if d2 < outer2 {
                        *pixel = (*pixel).max(((r - d2.sqrt() + 0.5).clamp(0.0, 1.0) * 255.0) as u8);
                    }
                }
            }
            return;
        }
        match shape {
            BrushShape::Square => {
                for y in y0.max(0)..=y1.min(self.h as isize-1) {
                    for x in x0.max(0)..=x1.min(self.w as isize-1) {
                        let (dx, dy) = ((x as f32 + 0.5 - cx).abs(), (y as f32 + 0.5 - cy).abs());
                        let d = dx.max(dy);
                        let a = (r - d + 0.5).clamp(0.0, 1.0);
                        self.put(x, y, (a * 255.0) as u8);
                    }
                }
            }
            BrushShape::Spray => {
                // nuage de points pseudo-aléatoires dans le disque
                let mut s = seed.wrapping_mul(2654435761).wrapping_add(1);
                if r > 250.0 {
                    let xa=x0.max(0);let xb=(x1+1).min(self.w as isize);
                    let ya=y0.max(0);let yb=(y1+1).min(self.h as isize);
                    if xb<=xa || yb<=ya {return;}
                    // Same expected particle density, sampled in the visible box.
                    let n=(((xb-xa) as f64*(yb-ya) as f64)*0.35/std::f64::consts::PI).ceil() as usize;
                    for _ in 0..n {
                        s^=s<<13;s^=s>>17;s^=s<<5;
                        let x=xa as f32+(s&0xffff) as f32/65536.0*(xb-xa) as f32;
                        let y=ya as f32+(s>>16) as f32/65536.0*(yb-ya) as f32;
                        if (x-cx).powi(2)+(y-cy).powi(2)<=r*r {self.put(x as isize,y as isize,255);}
                    }
                    return;
                }
                let n = (r * r * 0.35) as usize + 2;
                for _ in 0..n {
                    s ^= s << 13;
                    s ^= s >> 17;
                    s ^= s << 5;
                    let a = (s & 0xffff) as f32 / 65535.0 * std::f32::consts::TAU;
                    let d = ((s >> 16) as f32 / 65535.0).sqrt() * r;
                    self.put((cx + a.cos() * d) as isize, (cy + a.sin() * d) as isize, 255);
                }
            }
            BrushShape::Round | BrushShape::Soft => {
                let hard = if shape == BrushShape::Soft { 0.0 } else { hardness.clamp(0.0, 1.0) };
                let inner = r * hard;
                for y in y0.max(0)..=y1.min(self.h as isize-1) {
                    for x in x0.max(0)..=x1.min(self.w as isize-1) {
                        let (dx, dy) = (x as f32 + 0.5 - cx, y as f32 + 0.5 - cy);
                        let d = (dx * dx + dy * dy).sqrt();
                        let a = if d <= inner {
                            (r - d + 0.5).clamp(0.0, 1.0)
                        } else if r - inner > 0.5 {
                            let t = ((d - inner) / (r - inner)).clamp(0.0, 1.0);
                            (1.0 - t * t * (3.0 - 2.0 * t)) * (r - d + 0.5).clamp(0.0, 1.0)
                        } else {
                            (r - d + 0.5).clamp(0.0, 1.0)
                        };
                        self.put(x, y, (a * 255.0) as u8);
                    }
                }
            }
        }
    }

    /// Segment de pinceau : tampons espacés le long de [a, b].
    pub fn segment(&mut self, a: (f32, f32), b: (f32, f32), r: f32, hardness: f32, shape: BrushShape, seed: &mut u32) {
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let len = (dx * dx + dy * dy).sqrt();
        let step = (r * 0.25).max(0.5);
        let n = (len / step).ceil().max(1.0) as usize;
        for k in 1..=n {
            let t = k as f32 / n as f32;
            *seed = seed.wrapping_add(1);
            self.stamp(a.0 + dx * t, a.1 + dy * t, r, hardness, shape, *seed);
        }
    }

    /// A pressure change tapers continuously instead of changing the whole segment
    /// to the newest radius. Ordinary constant-radius strokes keep the fast path.
    pub fn segment_variable(&mut self, a: (f32, f32), b: (f32, f32), r0: f32, r1: f32, hardness: f32, shape: BrushShape, seed: &mut u32) {
        if (r0 - r1).abs() < 0.001 { return self.segment(a, b, r1, hardness, shape, seed); }
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let length = dx.hypot(dy);
        let mut distance = 0.0;
        loop {
            let t0 = if length > 0.0 { distance / length } else { 1.0 };
            let radius = r0 + (r1-r0)*t0;
            distance = (distance + (radius*0.25).max(0.5)).min(length);
            let t = if length > 0.0 { distance / length } else { 1.0 };
            *seed = seed.wrapping_add(1);
            self.stamp(a.0+dx*t, a.1+dy*t, r0+(r1-r0)*t, hardness, shape, *seed);
            if distance >= length { break; }
        }
    }

    /// Pixel-aligned brush tip without geometric edge coverage. Softness is an
    /// intentional opacity falloff inside the tip, separate from antialiasing.
    pub fn stamp_aliased(&mut self, cx: f32, cy: f32, r: f32, hardness: f32, shape: BrushShape, seed: u32) {
        if shape == BrushShape::Square || (shape == BrushShape::Round && hardness >= 1.0) {
            let p = (cx.floor() as isize, cy.floor() as isize);
            self.pencil_sized(p, p, (r * 2.0).max(1.0), shape == BrushShape::Square);
            return;
        }
        let (cx, cy) = (cx.floor() + 0.5, cy.floor() + 0.5);
        let r = r.max(0.5);
        if shape == BrushShape::Spray {
            self.stamp(cx, cy, r, hardness, shape, seed);
            return;
        }
        let (x0, y0, x1, y1) = ((cx-r).floor() as isize, (cy-r).floor() as isize, (cx+r).ceil() as isize, (cy+r).ceil() as isize);
        self.touch(x0, y0, x1, y1);
        let hard = if shape == BrushShape::Soft { 0.0 } else { hardness.clamp(0.0, 1.0) };
        let inner = r * hard;
        for y in y0.max(0)..y1.min(self.h as isize) {
            for x in x0.max(0)..x1.min(self.w as isize) {
                let d = (x as f32+0.5-cx).hypot(y as f32+0.5-cy);
                if d > r { continue; }
                let a = if d <= inner || r <= inner { 1.0 } else {
                    let t = ((d-inner)/(r-inner)).clamp(0.0,1.0);
                    1.0-t*t*(3.0-2.0*t)
                };
                self.put(x,y,(a*255.0) as u8);
            }
        }
    }

    pub fn segment_variable_aliased(&mut self, a: (f32,f32), b: (f32,f32), r0: f32, r1: f32, hardness: f32, shape: BrushShape, seed: &mut u32) {
        // Keep the frontier-only rasterizer for solid, constant-size pixel strokes.
        if (r0-r1).abs() < 0.001 && (shape == BrushShape::Square || (shape == BrushShape::Round && hardness >= 1.0)) {
            self.pencil_sized((a.0.floor() as isize,a.1.floor() as isize),(b.0.floor() as isize,b.1.floor() as isize),r1*2.0,shape == BrushShape::Square);
            return;
        }
        let (dx,dy) = (b.0-a.0,b.1-a.1);
        let length = dx.hypot(dy);
        let mut distance = 0.0;
        loop {
            let t0 = if length > 0.0 { distance/length } else { 1.0 };
            distance = (distance+((r0+(r1-r0)*t0)*0.25).max(0.5)).min(length);
            let t = if length > 0.0 { distance/length } else { 1.0 };
            *seed = seed.wrapping_add(1);
            self.stamp_aliased(a.0+dx*t,a.1+dy*t,r0+(r1-r0)*t,hardness,shape,*seed);
            if distance >= length { break; }
        }
    }

    /// Ligne aliasée de 1 px (crayon), algorithme de Bresenham.
    pub fn pencil(&mut self, a: (isize, isize), b: (isize, isize)) {
        let (mut x, mut y) = a;
        let (dx, dy) = ((b.0 - a.0).abs(), -(b.1 - a.1).abs());
        let (sx, sy) = (if a.0 < b.0 { 1 } else { -1 }, if a.1 < b.1 { 1 } else { -1 });
        let mut err = dx + dy;
        self.touch(a.0.min(b.0), a.1.min(b.1), a.0.max(b.0) + 1, a.1.max(b.1) + 1);
        loop {
            self.put(x, y, 255);
            if x == b.0 && y == b.1 {
                break;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x += sx;
            }
            if e2 <= dx {
                err += dx;
                y += sy;
            }
        }
    }

    /// Crayon de taille `size` (pixels entiers, sans anticrénelage, comme le crayon de
    /// Photoshop) : pointe ronde, ou carrée avec `square`, posée à chaque pas du tracé de
    /// Bresenham. Taille 1 : le crayon de Paint.NET (1 pixel).
    pub fn pencil_sized(&mut self, a: (isize, isize), b: (isize, isize), size: f32, square: bool) {
        let n = size.round().max(1.0) as isize;
        if n <= 1 {
            return self.pencil(a, b);
        }
        // pointe : décalages des pixels couverts autour du point du tracé
        let lo = -(n - 1) / 2;
        let r2 = (n as f32 / 2.0).powi(2);
        let c = (n - 1) as f32 / 2.0;
        // One horizontal interval per tip row (O(diameter), not diameter² pixels).
        let rows:Vec<(isize,isize)>=(0..n).map(|j| {
            if square {return (lo,lo+n);}
            let dy=j as f32-c;
            let half=(r2-dy*dy).max(0.0).sqrt();
            let mut left=(c-half).ceil().max(0.0) as isize;
            let mut right=(c+half).floor().min((n-1) as f32) as isize;
            let inside=|i:isize| (i as f32-c).powi(2)+dy*dy<=r2;
            while left>0 && inside(left-1) {left-=1;}
            while left<n && !inside(left) {left+=1;}
            while right+1<n && inside(right+1) {right+=1;}
            while right>=left && !inside(right) {right-=1;}
            (lo+left,lo+right+1)
        }).collect();
        self.touch(a.0.min(b.0) + lo, a.1.min(b.1) + lo, a.0.max(b.0) + lo + n, a.1.max(b.1) + lo + n);
        let (mut x, mut y) = a;
        let (dx, dy) = ((b.0 - a.0).abs(), -(b.1 - a.1).abs());
        let (sx, sy) = (if a.0 < b.0 { 1 } else { -1 }, if a.1 < b.1 { 1 } else { -1 });
        let mut err = dx + dy;
        let mut previous=self.last_pencil.filter(|(x,y,size,shape)|(*x,*y)==a && *size==n && *shape==square).map(|(x,y,_,_)|(x,y));
        loop {
            // The preceding stamp is already covered. Fill only its newly exposed border.
            let ya=(y+lo).clamp(0,self.h as isize) as usize;
            let yb=(y+lo+n).clamp(0,self.h as isize) as usize;
            for yy in ya..yb {
                let (left,right)=rows[(yy as isize-y-lo) as usize];
                let xa=(x+left).clamp(0,self.w as isize) as usize;
                let xb=(x+right).clamp(0,self.w as isize) as usize;
                let old=previous.and_then(|(px,py)| {
                    let j=yy as isize-py-lo;
                    (j>=0 && j<n).then(|| {let (l,r)=rows[j as usize];(px+l,px+r)})
                });
                let row=&mut self.m[yy*self.w..(yy+1)*self.w];
                if let Some((l,r))=old.filter(|(l,r)|*r>xa as isize && *l<xb as isize) {
                    row[xa..(l.max(xa as isize) as usize).min(xb)].fill(255);
                    row[(r.max(xa as isize) as usize).min(xb)..xb].fill(255);
                } else {row[xa..xb].fill(255);}
            }
            previous=Some((x,y));
            if x == b.0 && y == b.1 {
                break;
            }
            let e2 = 2 * err;
            if e2 >= dy {
                err += dy;
                x += sx;
            }
            if e2 <= dx {
                err += dx;
                y += sy;
            }
        }
        self.last_pencil=Some((b.0,b.1,n,square));
    }

    /// Remplit la couverture avec une forme décrite par sa distance signée (négatif = dedans).
    pub fn shape<F: Fn(f32, f32) -> f32>(&mut self, bbox: (f32, f32, f32, f32), style: ShapeStyle, width: f32, sdf: F) {
        let pad = width + 2.0;
        let (x0, y0, x1, y1) = ((bbox.0 - pad).floor() as isize, (bbox.1 - pad).floor() as isize, (bbox.2 + pad).ceil() as isize, (bbox.3 + pad).ceil() as isize);
        self.touch(x0, y0, x1 + 1, y1 + 1);
        let hw = width / 2.0;
        for y in y0.max(0)..=y1.min(self.h as isize - 1) {
            for x in x0.max(0)..=x1.min(self.w as isize - 1) {
                let d = sdf(x as f32 + 0.5, y as f32 + 0.5);
                let fill = (0.5 - d).clamp(0.0, 1.0);
                let line = (hw + 0.5 - d.abs()).clamp(0.0, 1.0);
                let a = match style {
                    ShapeStyle::Outline => line,
                    ShapeStyle::Fill => fill,
                    ShapeStyle::Both => fill.max(line),
                };
                self.put(x, y, (a * 255.0) as u8);
            }
        }
    }
}

/// Forme posée directement sur `out` (objets des calques vectoriels) : couverture calculée dans
/// son seul cadre, sans masque de la taille de l'image ni copie complète — mêmes formules et
/// mêmes arrondis que `Cover::shape` suivi de `apply_cover`. `base` : image de départ (None :
/// `out` lui-même). Retourne le rectangle touché (x0, y0, x1, y1 exclus).
#[allow(clippy::too_many_arguments)]
pub fn shape_onto<F: Fn(f32, f32) -> f32>(
    base: Option<&[u8]>,
    out: &mut [u8],
    w: usize,
    h: usize,
    bbox: (f32, f32, f32, f32),
    style: ShapeStyle,
    width: f32,
    sdf: F,
    color: [u8; 4],
) -> Option<(usize, usize, usize, usize)> {
    let pad = width + 2.0;
    let (x0, y0, x1, y1) = ((bbox.0 - pad).floor() as isize, (bbox.1 - pad).floor() as isize, (bbox.2 + pad).ceil() as isize, (bbox.3 + pad).ceil() as isize);
    let c = |v: isize, hi: usize| v.clamp(0, hi as isize) as usize;
    let r = (c(x0, w), c(y0, h), c(x1 + 1, w), c(y1 + 1, h));
    if r.2 <= r.0 || r.3 <= r.1 {
        return None;
    }
    let hw = width / 2.0;
    for y in r.1..r.3 {
        for x in r.0..r.2 {
            let o = (y * w + x) * 4;
            let b = match base {
                Some(b) => [b[o], b[o + 1], b[o + 2], b[o + 3]],
                None => [out[o], out[o + 1], out[o + 2], out[o + 3]],
            };
            let d = sdf(x as f32 + 0.5, y as f32 + 0.5);
            let fill = (0.5 - d).clamp(0.0, 1.0);
            let line = (hw + 0.5 - d.abs()).clamp(0.0, 1.0);
            let a = match style {
                ShapeStyle::Outline => line,
                ShapeStyle::Fill => fill,
                ShapeStyle::Both => fill.max(line),
            };
            let cv = (a * 255.0) as u8;
            if cv == 0 {
                out[o..o + 4].copy_from_slice(&b);
                continue;
            }
            let sa = cv as f32 / 255.0 * color[3] as f32 / 255.0;
            let da = b[3] as f32 / 255.0;
            let ao = sa + da * (1.0 - sa);
            if ao <= 0.0 {
                out[o..o + 4].copy_from_slice(&[0, 0, 0, 0]);
                continue;
            }
            for k in 0..3 {
                out[o + k] = ((color[k] as f32 * sa + b[k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
            }
            out[o + 3] = (ao * 255.0 + 0.5) as u8;
        }
    }
    Some(r)
}

/// Couverture (0..1) d'un ensemble de sous-chemins fermés, règle pair-impair (les trous des
/// tracés composés restent vides), dans le rectangle `r` (x0, y0, x1, y1 exclus) : 4 lignes
/// d'échantillonnage par pixel, couverture horizontale exacte. Coût : lignes × arêtes, et non
/// pixels × arêtes comme une distance signée.
#[allow(dead_code)] // import SVG (à venir)
pub fn poly_fill(subs: &[Vec<(f32, f32)>], r: (usize, usize, usize, usize)) -> Vec<f32> {
    let (rw, rh) = (r.2 - r.0, r.3 - r.1);
    let mut cov = vec![0f32; rw * rh];
    const SUB: usize = 4;
    let mut xs: Vec<f32> = Vec::new();
    for py in 0..rh {
        for k in 0..SUB {
            let y = (r.1 + py) as f32 + (k as f32 + 0.5) / SUB as f32;
            xs.clear();
            for sp in subs {
                let n = sp.len();
                if n < 3 {
                    continue;
                }
                let mut j = n - 1;
                for i in 0..n {
                    let (a, b) = (sp[j], sp[i]);
                    if (a.1 > y) != (b.1 > y) {
                        xs.push(a.0 + (y - a.1) * (b.0 - a.0) / (b.1 - a.1));
                    }
                    j = i;
                }
            }
            xs.sort_by(f32::total_cmp);
            let row = &mut cov[py * rw..(py + 1) * rw];
            for pair in xs.chunks_exact(2) {
                // portée [xa, xb) en coordonnées locales, couverture partielle aux bords
                let (xa, xb) = ((pair[0] - r.0 as f32).max(0.0), (pair[1] - r.0 as f32).min(rw as f32));
                if xb <= xa {
                    continue;
                }
                let (ia, ib) = (xa.floor() as usize, (xb.ceil() as usize).min(rw));
                for (px, c) in row.iter_mut().enumerate().take(ib).skip(ia) {
                    let lo = xa.max(px as f32);
                    let hi = xb.min(px as f32 + 1.0);
                    if hi > lo {
                        *c += (hi - lo) / SUB as f32;
                    }
                }
            }
        }
    }
    cov
}

/// Couverture (0..1) d'un trait d'épaisseur `width` le long de sous-chemins (fermés ou non),
/// dans le rectangle `r` : chaque segment ne parcourt que son propre cadre (coût proportionnel à
/// la longueur du trait, pas à la surface de la forme).
#[allow(dead_code)] // import SVG (à venir)
pub fn poly_stroke(subs: &[Vec<(f32, f32)>], closed: bool, width: f32, r: (usize, usize, usize, usize)) -> Vec<f32> {
    let (rw, rh) = (r.2 - r.0, r.3 - r.1);
    let mut cov = vec![0f32; rw * rh];
    let hw = width.max(1.0) / 2.0;
    for sp in subs {
        let n = sp.len();
        if n == 0 {
            continue;
        }
        let segs = if closed && n > 2 { n } else { n.saturating_sub(1).max(1) };
        for i in 0..segs {
            // un sous-chemin d'un seul point reste visible (segment de longueur nulle)
            let (a, b) = (sp[i], if n == 1 { sp[0] } else { sp[(i + 1) % n] });
            let x0 = ((a.0.min(b.0) - hw - 1.0).floor() as isize - r.0 as isize).max(0) as usize;
            let y0 = ((a.1.min(b.1) - hw - 1.0).floor() as isize - r.1 as isize).max(0) as usize;
            let x1 = (((a.0.max(b.0) + hw + 1.0).ceil() as isize - r.0 as isize).max(0) as usize).min(rw);
            let y1 = (((a.1.max(b.1) + hw + 1.0).ceil() as isize - r.1 as isize).max(0) as usize).min(rh);
            for y in y0..y1 {
                for x in x0..x1 {
                    let d = seg_dist((r.0 + x) as f32 + 0.5, (r.1 + y) as f32 + 0.5, a, b);
                    let c = (hw + 0.5 - d).clamp(0.0, 1.0);
                    let v = &mut cov[y * rw + x];
                    if c > *v {
                        *v = c;
                    }
                }
            }
        }
    }
    cov
}

/// Pose une couverture locale (`cov`, rectangle `r`) de couleur `color` sur `out` (départ :
/// `base`, sinon `out`) — mêmes arrondis que `apply_cover`.
#[allow(dead_code)] // import SVG (à venir)
pub fn cover_onto(base: Option<&[u8]>, out: &mut [u8], w: usize, r: (usize, usize, usize, usize), cov: &[f32], color: [u8; 4]) {
    let rw = r.2 - r.0;
    for y in r.1..r.3 {
        for x in r.0..r.2 {
            let o = (y * w + x) * 4;
            let b = match base {
                Some(b) => [b[o], b[o + 1], b[o + 2], b[o + 3]],
                None => [out[o], out[o + 1], out[o + 2], out[o + 3]],
            };
            let cv = (cov[(y - r.1) * rw + (x - r.0)].clamp(0.0, 1.0) * 255.0) as u8;
            if cv == 0 {
                out[o..o + 4].copy_from_slice(&b);
                continue;
            }
            let sa = cv as f32 / 255.0 * color[3] as f32 / 255.0;
            let da = b[3] as f32 / 255.0;
            let ao = sa + da * (1.0 - sa);
            if ao <= 0.0 {
                out[o..o + 4].copy_from_slice(&[0, 0, 0, 0]);
                continue;
            }
            for k in 0..3 {
                out[o + k] = ((color[k] as f32 * sa + b[k] as f32 * da * (1.0 - sa)) / ao + 0.5) as u8;
            }
            out[o + 3] = (ao * 255.0 + 0.5) as u8;
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ShapeStyle {
    Outline,
    Fill,
    Both,
}

// ---------------------------------------------------------------- distances signées

pub fn sdf_rect(x0: f32, y0: f32, x1: f32, y1: f32, radius: f32) -> impl Fn(f32, f32) -> f32 {
    let (cx, cy) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    let (hx, hy) = ((x1 - x0).abs() / 2.0, (y1 - y0).abs() / 2.0);
    let r = radius.min(hx).min(hy).max(0.0);
    move |px, py| {
        let (qx, qy) = ((px - cx).abs() - hx + r, (py - cy).abs() - hy + r);
        let outside = (qx.max(0.0).powi(2) + qy.max(0.0).powi(2)).sqrt();
        outside + qx.max(qy).min(0.0) - r
    }
}

pub fn sdf_ellipse(x0: f32, y0: f32, x1: f32, y1: f32) -> impl Fn(f32, f32) -> f32 {
    let (cx, cy) = ((x0 + x1) / 2.0, (y0 + y1) / 2.0);
    let (rx, ry) = (((x1 - x0) / 2.0).abs().max(0.5), ((y1 - y0) / 2.0).abs().max(0.5));
    move |px, py| {
        let (nx, ny) = ((px - cx) / rx, (py - cy) / ry);
        let k = (nx * nx + ny * ny).sqrt();
        // approximation au premier ordre : distance ≈ (k - 1) / |∇k|
        let gx = nx / rx;
        let gy = ny / ry;
        let g = (gx * gx + gy * gy).sqrt().max(1e-6) * k.max(1e-6);
        (k * k - 1.0) / (2.0 * g)
    }
}

/// Distance d'un point à un segment.
fn seg_dist(px: f32, py: f32, a: (f32, f32), b: (f32, f32)) -> f32 {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = dx * dx + dy * dy;
    let t = if l2 > 0.0 { (((px - a.0) * dx + (py - a.1) * dy) / l2).clamp(0.0, 1.0) } else { 0.0 };
    let (qx, qy) = (a.0 + dx * t - px, a.1 + dy * t - py);
    (qx * qx + qy * qy).sqrt()
}

/// Polygone fermé (règle pair-impair).
pub fn sdf_polygon(pts: Vec<(f32, f32)>) -> impl Fn(f32, f32) -> f32 {
    move |px, py| {
        let n = pts.len();
        if n < 2 {
            return 1e9;
        }
        let mut d = f32::MAX;
        let mut inside = false;
        let mut j = n - 1;
        for i in 0..n {
            let (a, b) = (pts[i], pts[j]);
            d = d.min(seg_dist(px, py, a, b));
            if (a.1 > py) != (b.1 > py) && px < (b.0 - a.0) * (py - a.1) / (b.1 - a.1) + a.0 {
                inside = !inside;
            }
            j = i;
        }
        if inside { -d } else { d }
    }
}

/// Segment épais (ligne) : distance au segment moins la demi-épaisseur.
pub fn sdf_line(a: (f32, f32), b: (f32, f32), width: f32) -> impl Fn(f32, f32) -> f32 {
    move |px, py| seg_dist(px, py, a, b) - width / 2.0
}

/// Sommets des formes de la famille « Formes multiples », inscrites dans le cadre.
pub fn shape_points(kind: &str, x0: f32, y0: f32, x1: f32, y1: f32) -> Vec<(f32, f32)> {
    let (l, t, r, b) = (x0.min(x1), y0.min(y1), x0.max(x1), y0.max(y1));
    let (cx, cy, w, h) = ((l + r) / 2.0, (t + b) / 2.0, r - l, b - t);
    let regular = |n: usize, rot: f32| -> Vec<(f32, f32)> {
        (0..n)
            .map(|k| {
                let a = rot + k as f32 * std::f32::consts::TAU / n as f32;
                (cx + a.cos() * w / 2.0, cy + a.sin() * h / 2.0)
            })
            .collect()
    };
    let star = |n: usize, inner: f32| -> Vec<(f32, f32)> {
        (0..2 * n)
            .map(|k| {
                let a = -std::f32::consts::FRAC_PI_2 + k as f32 * std::f32::consts::PI / n as f32;
                let f = if k % 2 == 0 { 1.0 } else { inner };
                (cx + a.cos() * w / 2.0 * f, cy + a.sin() * h / 2.0 * f)
            })
            .collect()
    };
    match kind {
        "triangle" => vec![(cx, t), (r, b), (l, b)],
        "triangle-right" => vec![(l, t), (l, b), (r, b)],
        "diamond" => vec![(cx, t), (r, cy), (cx, b), (l, cy)],
        "trapezoid" => vec![(l + w * 0.2, t), (r - w * 0.2, t), (r, b), (l, b)],
        "parallelogram" => vec![(l + w * 0.25, t), (r, t), (r - w * 0.25, b), (l, b)],
        "pentagon" => regular(5, -std::f32::consts::FRAC_PI_2),
        "hexagon" => regular(6, 0.0),
        "heptagon" => regular(7, -std::f32::consts::FRAC_PI_2),
        "octagon" => regular(8, std::f32::consts::PI / 8.0),
        // étoiles : (branches, rayon intérieur)
        "star" | "star-5" => star(5, 0.42),
        "star-4" => star(4, 0.4),
        "star-6" => star(6, 0.5),
        "star-thin" => star(5, 0.25),
        // polygone / étoile à nombre réglable (« ngon-7 », « star-9 »)
        k if k.starts_with("ngon-") => {
            let n = k[5..].parse::<usize>().unwrap_or(5).clamp(3, 64);
            regular(n, -std::f32::consts::FRAC_PI_2)
        }
        k if k.starts_with("star-") && k[5..].parse::<usize>().is_ok() => {
            let n = k[5..].parse::<usize>().unwrap_or(5).clamp(3, 64);
            star(n, if n <= 4 { 0.4 } else { 0.42 + (n as f32 - 5.0) * 0.02 }.min(0.6))
        }
        "arrow" => {
            let (hx, sh) = (r - w * 0.4, h * 0.22);
            vec![(l, cy - sh), (hx, cy - sh), (hx, t), (r, cy), (hx, b), (hx, cy + sh), (l, cy + sh)]
        }
        "cross" => {
            let (ax, ay) = (w / 6.0, h / 6.0);
            vec![
                (cx - ax, t), (cx + ax, t), (cx + ax, cy - ay), (r, cy - ay), (r, cy + ay), (cx + ax, cy + ay),
                (cx + ax, b), (cx - ax, b), (cx - ax, cy + ay), (l, cy + ay), (l, cy - ay), (cx - ax, cy - ay),
            ]
        }
        // cœur : courbe classique (16 sin³ t, 13 cos t − 5 cos 2t − 2 cos 3t − cos 4t) remise au cadre
        "heart" => fit(
            (0..72)
                .map(|k| {
                    let a = k as f32 * std::f32::consts::TAU / 72.0;
                    (16.0 * a.sin().powi(3), -(13.0 * a.cos() - 5.0 * (2.0 * a).cos() - 2.0 * (3.0 * a).cos() - (4.0 * a).cos()))
                })
                .collect(),
            (l, t, r, b),
        ),
        // bulles : corps sur les 4/5 du haut, pointe vers le bas à gauche
        "callout-rect" => {
            let bb = t + h * 0.78;
            vec![(l, t), (r, t), (r, bb), (l + w * 0.42, bb), (l + w * 0.18, b), (l + w * 0.24, bb), (l, bb)]
        }
        "callout-oval" => {
            let (ry, ecy) = (h * 0.4, t + h * 0.4);
            // ellipse sans l'arc de 110° à 130° (en bas à gauche), fermée par la pointe
            let (a0, a1) = (130f32.to_radians(), 470f32.to_radians());
            let mut pts: Vec<(f32, f32)> = (0..=60)
                .map(|k| {
                    let a = a0 + (a1 - a0) * k as f32 / 60.0;
                    (cx + a.cos() * w / 2.0, ecy + a.sin() * ry)
                })
                .collect();
            pts.push((l + w * 0.12, b));
            pts
        }
        _ => vec![(l, t), (r, t), (r, b), (l, b)],
    }
}

/// Ramène des points quelconques dans le cadre (l, t, r, b).
fn fit(pts: Vec<(f32, f32)>, (l, t, r, b): (f32, f32, f32, f32)) -> Vec<(f32, f32)> {
    let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
    for &(x, y) in &pts {
        (x0, y0, x1, y1) = (x0.min(x), y0.min(y), x1.max(x), y1.max(y));
    }
    let (sx, sy) = ((r - l) / (x1 - x0).max(1e-6), (b - t) / (y1 - y0).max(1e-6));
    pts.into_iter().map(|(x, y)| (l + (x - x0) * sx, t + (y - y0) * sy)).collect()
}

// ---------------------------------------------------------------- application

/// Applique une couverture de peinture (`erase` = gomme) sur `base` → `out`, en tenant compte
/// de l'opacité et du masque de sélection. Seul le rectangle modifié est recalculé.
pub fn apply_cover(base: &[u8], out: &mut [u8], cov: &Cover, color: [u8; 4], opacity: f32, erase: bool, sel: Option<&[u8]>) {
    apply_cover_in(base, out, cov, cov.dirty, color, opacity, erase, sel);
}

/// Comme `apply_cover`, limité au rectangle `r` : pendant un trait, seule la zone touchée par
/// le dernier mouvement change (la couverture ne fait que croître ailleurs).
pub fn apply_cover_in(base: &[u8], out: &mut [u8], cov: &Cover, r: Option<(usize, usize, usize, usize)>, color: [u8; 4], opacity: f32, erase: bool, sel: Option<&[u8]>) {
    let Some((x0, y0, x1, y1)) = r else { return };
    let w = cov.w;
    for y in y0..y1 {
        for x in x0..x1 {
            let i = y * w + x;
            let o = i * 4;
            let c = cov.m[i];
            if c == 0 {
                out[o..o + 4].copy_from_slice(&base[o..o + 4]);
                continue;
            }
            let s = sel.map_or(255, |m| m[i]) as f32 / 255.0;
            let a = c as f32 / 255.0 * opacity * s;
            if erase {
                out[o..o + 3].copy_from_slice(&base[o..o + 3]);
                out[o + 3] = (base[o + 3] as f32 * (1.0 - a) + 0.5) as u8;
            } else {
                let sa = a * color[3] as f32 / 255.0;
                let da = base[o + 3] as f32 / 255.0;
                let ao = sa + da * (1.0 - sa);
                if ao <= 0.0 {
                    out[o..o + 4].copy_from_slice(&[0, 0, 0, 0]);
                    continue;
                }
                for k in 0..3 {
                    let v = (color[k] as f32 * sa + base[o + k] as f32 * da * (1.0 - sa)) / ao;
                    out[o + k] = (v + 0.5) as u8;
                }
                out[o + 3] = (ao * 255.0 + 0.5) as u8;
            }
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum GradientKind {
    Linear,
    Radial,
    Diamond,
    Conical,
}

/// Dégradé de `c0` (en a) vers `c1` (en b), fondu dans la sélection.
pub fn gradient(base: &[u8], out: &mut [u8], w: usize, h: usize, a: (f32, f32), b: (f32, f32), c0: [u8; 4], c1: [u8; 4], kind: GradientKind, sel: Option<&[u8]>) {
    let (dx, dy) = (b.0 - a.0, b.1 - a.1);
    let l2 = (dx * dx + dy * dy).max(1e-6);
    let len = l2.sqrt();
    for y in 0..h {
        for x in 0..w {
            let i = y * w + x;
            let o = i * 4;
            let (px, py) = (x as f32 + 0.5 - a.0, y as f32 + 0.5 - a.1);
            let t = match kind {
                GradientKind::Linear => (px * dx + py * dy) / l2,
                GradientKind::Radial => (px * px + py * py).sqrt() / len,
                GradientKind::Diamond => {
                    let (ux, uy) = (dx / len, dy / len);
                    ((px * ux + py * uy).abs() + (-px * uy + py * ux).abs()) / len
                }
                GradientKind::Conical => {
                    let ang = py.atan2(px) - dy.atan2(dx);
                    (ang / std::f32::consts::TAU).rem_euclid(1.0)
                }
            }
            .clamp(0.0, 1.0);
            let s = sel.map_or(255, |m| m[i]) as f32 / 255.0;
            for k in 0..4 {
                let g = c0[k] as f32 + (c1[k] as f32 - c0[k] as f32) * t;
                out[o + k] = (base[o + k] as f32 * (1.0 - s) + g * s + 0.5) as u8;
            }
        }
    }
}

/// Masque anticrénelé d'un polygone (lasso, sélections de forme), règle pair-impair.
/// Remplissage par balayage : 4 sous-lignes par rangée de pixels, couverture horizontale exacte
/// aux extrémités de chaque segment. Avant : distance à toutes les arêtes pour chaque pixel du
/// cadre, ce qui figeait l'interface au relâchement d'un long lasso.
pub fn polygon_mask(w: usize, h: usize, pts: &[(f32, f32)]) -> Vec<u8> {
    const SUB: usize = 4;
    let mut m = vec![0u8; w * h];
    let n = pts.len();
    if n < 3 || w == 0 || h == 0 {
        return m;
    }
    // arêtes non horizontales : (y haut, y bas, x en haut, dx/dy), triées par y haut
    let mut edges: Vec<(f32, f32, f32, f32)> = Vec::with_capacity(n);
    let (mut l, mut r) = (f32::MAX, f32::MIN);
    for i in 0..n {
        let (a, b) = (pts[i], pts[(i + 1) % n]);
        l = l.min(a.0);
        r = r.max(a.0);
        if a.1 == b.1 || !(a.0.is_finite() && a.1.is_finite() && b.0.is_finite() && b.1.is_finite()) {
            continue;
        }
        let (p, q) = if a.1 < b.1 { (a, b) } else { (b, a) };
        edges.push((p.1, q.1, p.0, (q.0 - p.0) / (q.1 - p.1)));
    }
    if edges.is_empty() {
        return m;
    }
    edges.sort_by(|a, b| a.0.total_cmp(&b.0));
    let top = edges[0].0;
    let bottom = edges.iter().map(|e| e.1).fold(f32::MIN, f32::max);
    let (ry0, ry1) = (top.floor().max(0.0) as usize, (bottom.ceil().max(0.0) as usize).min(h));
    let (bx0, bx1) = (l.floor().max(0.0) as usize, ((r.ceil().max(0.0) as usize) + 1).min(w));
    if bx1 <= bx0 {
        return m;
    }
    let wgt = 1.0 / SUB as f32;
    // part : couverture partielle des pixels d'extrémité ; run : pixels entiers (différences)
    let mut part = vec![0f32; w + 1];
    let mut run = vec![0f32; w + 1];
    let mut active: Vec<usize> = Vec::new();
    let mut xs: Vec<f32> = Vec::new();
    let mut next = 0;
    for y in ry0..ry1 {
        part[bx0..=bx1].fill(0.0);
        run[bx0..=bx1].fill(0.0);
        for s in 0..SUB {
            let sy = y as f32 + (s as f32 + 0.5) * wgt;
            while next < edges.len() && edges[next].0 <= sy {
                active.push(next);
                next += 1;
            }
            active.retain(|&e| edges[e].1 > sy);
            xs.clear();
            xs.extend(active.iter().map(|&e| edges[e].2 + (sy - edges[e].0) * edges[e].3));
            xs.sort_by(f32::total_cmp);
            for pair in xs.chunks_exact(2) {
                let (xa, xb) = (pair[0].max(0.0), pair[1].min(w as f32));
                if xb <= xa {
                    continue;
                }
                let (ia, ib) = (xa.floor() as usize, xb.floor() as usize);
                if ia == ib {
                    part[ia] += (xb - xa) * wgt;
                    continue;
                }
                part[ia] += (ia as f32 + 1.0 - xa) * wgt;
                run[ia + 1] += wgt;
                run[ib] -= wgt;
                if ib < w {
                    part[ib] += (xb - ib as f32) * wgt;
                }
            }
        }
        let row = &mut m[y * w..(y + 1) * w];
        let mut acc = 0f32;
        for x in bx0..bx1 {
            acc += run[x];
            let c = (acc + part[x]).clamp(0.0, 1.0);
            row[x] = (c * 255.0 + 0.5) as u8;
        }
    }
    m
}

#[cfg(test)]
mod pressure_tests {
    use super::*;
    #[test]
    fn pressure_tapers_instead_of_widening_the_previous_path() {
        let mut c = Cover::new(160, 100);
        c.stamp(20.0, 50.0, 2.0, 1.0, BrushShape::Round, 1);
        c.segment_variable((20.0, 50.0), (130.0, 50.0), 2.0, 16.0, 1.0, BrushShape::Round, &mut 1);
        let width = |x: usize| (0..100).filter(|y| c.m[y*160+x] > 127).count();
        assert!(width(25) < width(75));
        assert!(width(75) < width(125));
        assert!(width(25) < 8);
        assert!(width(125) >= 28);
    }
    #[test]
    fn hard_brush_preserves_antialiasing_and_clips_outside_points() {
        for (x,y,r) in [(0.0,0.0,0.5),(-2.25,10.5,7.75),(31.2,24.7,18.4),(500.0,500.0,4.0)] {
            let mut c = Cover::new(64, 48);
            c.stamp(x,y,r,1.0,BrushShape::Round,0);
            for py in 0..48 { for px in 0..64 {
                let d = ((px as f32+0.5-x).powi(2)+(py as f32+0.5-y).powi(2)).sqrt();
                let expected = ((r.max(0.5)-d+0.5).clamp(0.0,1.0)*255.0) as u8;
                assert_eq!(c.m[py*64+px], expected);
            }}
        }
    }
}

#[cfg(test)]
mod large_pencil_tests {
    use super::*;
    #[test]
    fn clipped_pencil_matches_the_original_integer_tip() {
        for n in 2..24 {
            for square in [false,true] {
                for (x,y) in [(-3,4),(5,8),(18,13)] {
                    let mut cover=Cover::new(19,13);
                    cover.pencil_sized((x,y),(x,y),n as f32,square);
                    let lo=-(n-1)/2;let c=(n-1) as f32/2.0;let r2=(n as f32/2.0).powi(2);
                    for yy in 0..13 {for xx in 0..19 {
                        let i=xx as isize-x-lo;let j=yy as isize-y-lo;
                        let inside=i>=0 && j>=0 && i<n && j<n && (square || (i as f32-c).powi(2)+(j as f32-c).powi(2)<=r2);
                        assert_eq!(cover.m[yy*19+xx],if inside {255}else{0});
                    }}
                }
            }
        }
    }
    #[test]
    fn moving_and_reversing_tips_preserve_the_exact_pixel_union() {
        let paths=[vec![(2,2),(3,3),(4,3),(5,4),(6,4)],vec![(-2,4),(-1,4),(0,4),(1,4),(2,4)],vec![(8,8),(7,7),(6,6),(5,5)]];
        for n in 2..24 {for square in [false,true] {for points in &paths {
            let mut cover=Cover::new(19,13);
            cover.pencil_sized(points[0],points[0],n as f32,square);
            for pair in points.windows(2) {cover.pencil_sized(pair[0],pair[1],n as f32,square);}
            let lo=-(n-1)/2;let c=(n-1) as f32/2.0;let r2=(n as f32/2.0).powi(2);
            for yy in 0..13 {for xx in 0..19 {
                let inside=points.iter().any(|&(x,y)| {
                    let i=xx as isize-x-lo;let j=yy as isize-y-lo;
                    i>=0 && j>=0 && i<n && j<n && (square || (i as f32-c).powi(2)+(j as f32-c).powi(2)<=r2)
                });
                assert_eq!(cover.m[yy*19+xx],if inside {255}else{0});
            }}
        }}}
    }
    #[test]
    fn huge_tip_on_small_surface_needs_no_huge_temporary_buffer() {
        for square in [false,true] {
            let mut cover=Cover::new(19,13);
            cover.pencil_sized((9,6),(9,6),32768.0,square);
            assert!(cover.m.iter().all(|v|*v==255));
        }
    }
}

#[cfg(test)]
mod pencil_brush_options_tests {
    use super::*;
    #[test]
    fn solid_tips_have_no_antialiased_pixels() {
        for shape in [BrushShape::Round, BrushShape::Square, BrushShape::Spray] {
            let mut c = Cover::new(64,48);
            c.stamp_aliased(24.3,23.8,7.25,1.0,shape,42);
            c.segment_variable_aliased((24.3,23.8),(48.7,30.2),7.25,2.5,1.0,shape,&mut 42);
            assert!(c.m.iter().any(|&v|v==255));
            assert!(c.m.iter().all(|&v|v==0 || v==255));
        }
    }
    #[test]
    fn hardness_and_soft_shape_are_effective_without_an_edge_fringe() {
        let mut hard = Cover::new(48,48);
        let mut soft = Cover::new(48,48);
        let mut reduced = Cover::new(48,48);
        hard.stamp_aliased(20.5,20.5,8.0,1.0,BrushShape::Round,0);
        soft.stamp_aliased(20.5,20.5,8.0,1.0,BrushShape::Soft,0);
        reduced.stamp_aliased(20.5,20.5,8.0,0.0,BrushShape::Round,0);
        assert_ne!(hard.m,soft.m);
        assert_eq!(soft.m,reduced.m);
        assert!(soft.m.iter().any(|&v|v>0 && v<255));
        for y in 0..48 { for x in 0..48 {
            if (x as f32-20.0).hypot(y as f32-20.0)>=8.0 { assert_eq!(soft.m[y*48+x],0); }
        }}
    }
    #[test]
    fn one_pixel_line_stays_continuous_and_pressure_tapers() {
        let mut c=Cover::new(160,100);
        c.segment_variable_aliased((2.0,2.0),(40.0,40.0),0.5,0.5,1.0,BrushShape::Round,&mut 0);
        for i in 2..=40 { assert_eq!(c.m[i*160+i],255); }
        let mut c=Cover::new(160,100);
        c.stamp_aliased(10.0,50.0,1.0,1.0,BrushShape::Round,0);
        c.segment_variable_aliased((10.0,50.0),(140.0,50.0),1.0,16.0,1.0,BrushShape::Round,&mut 0);
        let width=|x:usize|(0..100).filter(|y|c.m[y*160+x]>0).count();
        assert!(width(25)<width(75));
        assert!(width(75)<width(125));
    }
}
