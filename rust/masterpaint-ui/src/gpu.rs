//! Calcul sur la carte graphique (wgpu : Vulkan / Metal / DirectX 12 sur le bureau, WebGPU
//! dans le navigateur). Sert aux filtres dynamiques (ƒ) : toute la chaîne d'effets d'un calque
//! s'exécute en une seule soumission, avec une seule relecture à la fin ; et aux effets du menu
//! qui ont un équivalent exact (flous, netteté, pixeliser, réglages de couleur : `menu_plan`).
//!
//! Les noyaux reprennent exactement les étages CPU de masterpaint-core/src/fx_dynamic.rs
//! (moyennes glissantes, arrondi « demi vers le pair », mêmes constantes) : le rendu ne change
//! pas selon que la carte graphique est disponible ou non. Sans carte compatible, l'appelant
//! retombe sur le moteur CPU.

use std::collections::HashMap;
use wgpu::util::DeviceExt;

const SHADER: &str = r#"
struct P { w: u32, h: u32, r: u32, mode: u32, f0: f32, f1: f32, f2: f32, f3: f32 };
@group(0) @binding(0) var<uniform> p: P;
@group(0) @binding(1) var<storage, read> src: array<u32>;
@group(0) @binding(2) var<storage, read> aux: array<u32>;
@group(0) @binding(3) var<storage, read_write> dst: array<u32>;

fn unpack(v: u32) -> vec4<u32> { return vec4<u32>(v & 255u, (v >> 8u) & 255u, (v >> 16u) & 255u, v >> 24u); }
fn pack(c: vec4<u32>) -> u32 { return min(c.x, 255u) | (min(c.y, 255u) << 8u) | (min(c.z, 255u) << 16u) | (min(c.w, 255u) << 24u); }
fn div_even(s: u32, n: u32) -> u32 {
    let q = s / n; let r = s % n;
    var up = 0u;
    if (2u * r > n || (2u * r == n && (q & 1u) == 1u)) { up = 1u; }
    return min(q + up, 255u);
}
// Math.round puis bornes 0..255
fn jr(v: f32) -> u32 { return u32(clamp(floor(v + 0.5), 0.0, 255.0)); }
// écriture Uint8ClampedArray : arrondi demi vers le pair
fn rhe(v: f32) -> u32 {
    if (!(v > 0.0)) { return 0u; }
    if (v >= 255.0) { return 255u; }
    let f = floor(v); let d = v - f;
    if (d > 0.5 || (d == 0.5 && (u32(f) & 1u) == 1u)) { return u32(f) + 1u; }
    return u32(f);
}

// moyenne glissante d'une ligne ou d'une colonne. mode : bit 0 horizontal, bit 1 bords répétés (RVB seul)
@compute @workgroup_size(16, 16)
fn box_pass(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let horiz = (p.mode & 1u) == 1u;
    let clampe = (p.mode & 2u) == 2u;
    let r = i32(p.r);
    var len = i32(p.h); var pos = i32(id.y);
    if (horiz) { len = i32(p.w); pos = i32(id.x); }
    var acc = vec4<u32>(0u);
    var cnt = 0u;
    for (var k = -r; k <= r; k++) {
        var q = pos + k;
        if (q < 0 || q >= len) {
            if (!clampe) { continue; }
            q = clamp(q, 0, len - 1);
        }
        var idx = u32(q) * p.w + id.x;
        if (horiz) { idx = id.y * p.w + u32(q); }
        acc += unpack(src[idx]);
        cnt += 1u;
    }
    let i = id.y * p.w + id.x;
    // mode 4 : flou du menu (fx_blur, box_blur_band) : 4 canaux, (somme + n/2) / n
    if ((p.mode & 4u) == 4u) {
        dst[i] = pack((acc + vec4<u32>(cnt / 2u)) / cnt);
        return;
    }
    var o = vec4<u32>(div_even(acc.x, cnt), div_even(acc.y, cnt), div_even(acc.z, cnt), div_even(acc.w, cnt));
    if (clampe) { o.w = unpack(src[i]).w; }
    dst[i] = pack(o);
}

// netteté : src = image floutée, aux = image d'origine, f0 = force
@compute @workgroup_size(16, 16)
fn sharpen(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let s = vec4<f32>(unpack(aux[i]));
    let b = vec4<f32>(unpack(src[i]));
    var o = s + (s - b) * p.f0;
    // mode 1 : « Améliorer la netteté » (seuil f1 : écarts plus faibles inchangés)
    if (p.mode == 1u) {
        let d = s - b;
        o = select(s, s + d * p.f0, abs(d) > vec4<f32>(p.f1));
    }
    dst[i] = pack(vec4<u32>(jr(o.x), jr(o.y), jr(o.z), u32(s.w)));
}

// pixeliser du menu : moyenne de la cellule de r pixels (alpha pondéré)
@compute @workgroup_size(16, 16)
fn cell_avg(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let bs = p.r;
    let x0 = (id.x / bs) * bs; let y0 = (id.y / bs) * bs;
    let x1 = min(x0 + bs, p.w); let y1 = min(y0 + bs, p.h);
    var s = vec4<u32>(0u);
    var n = 0u;
    for (var y = y0; y < y1; y++) {
        for (var x = x0; x < x1; x++) {
            let q = unpack(src[y * p.w + x]);
            s += vec4<u32>(q.x * q.w, q.y * q.w, q.z * q.w, q.w);
            n += 1u;
        }
    }
    var o = vec4<u32>(0u);
    if (s.w > 0u) {
        let a = f32(s.w);
        o = vec4<u32>(jr(f32(s.x) / a), jr(f32(s.y) / a), jr(f32(s.z) / a), jr(a / f32(n)));
    }
    dst[id.y * p.w + id.x] = pack(o);
}

// réglages du menu (fx_adjust) : mode 0 luminosité / contraste (f0 facteur, f1 luminosité,
// f2 température, f3 teinte), 1 noir et blanc, 2 négatif, 3 sépia
@compute @workgroup_size(16, 16)
fn adjust(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let q = unpack(src[i]);
    let c = vec3<f32>(f32(q.x), f32(q.y), f32(q.z));
    var o = c;
    switch (p.mode) {
        case 0u: {
            o = p.f0 * (c + vec3<f32>(p.f1 - 128.0)) + vec3<f32>(128.0 + p.f2, 128.0 - p.f3, 128.0 - p.f2);
        }
        case 1u: { o = vec3<f32>(0.299 * c.x + 0.587 * c.y + 0.114 * c.z); }
        case 2u: { o = vec3<f32>(255.0) - c; }
        case 3u: {
            o = vec3<f32>(c.x * 0.393 + c.y * 0.769 + c.z * 0.189, c.x * 0.349 + c.y * 0.686 + c.z * 0.168, c.x * 0.272 + c.y * 0.534 + c.z * 0.131);
        }
        default: {}
    }
    dst[i] = pack(vec4<u32>(jr(o.x), jr(o.y), jr(o.z), q.w));
}

fn cmyk(c: vec3<f32>) -> vec4<f32> {
    let n = c / 255.0;
    let k = 1.0 - max(n.x, max(n.y, n.z));
    if (k >= 0.999) { return vec4<f32>(0.0, 0.0, 0.0, 1.0); }
    let d = 1.0 - k;
    return vec4<f32>((1.0 - n.x - k) / d, (1.0 - n.y - k) / d, (1.0 - n.z - k) / d, k);
}

// trame d'impression CMJN (fx_dynamic::print_screen) : pas f0
@compute @workgroup_size(16, 16)
fn print_screen(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let cell = p.f0;
    let xf = f32(id.x) + 0.5; let yf = f32(id.y) + 0.5;
    var angles = array<f32, 4>(0.2617993877991494, 1.3089969389957472, 0.0, 0.7853981633974483);
    var ink = vec4<f32>(0.0);
    for (var k = 0u; k < 4u; k++) {
        let ca = cos(angles[k]); let sa = sin(angles[k]);
        let u = xf * ca + yf * sa;
        let v = -xf * sa + yf * ca;
        let cu = (floor(u / cell) + 0.5) * cell;
        let cv = (floor(v / cell) + 0.5) * cell;
        let sx = u32(clamp(floor(cu * ca - cv * sa), 0.0, f32(p.w - 1u)));
        let sy = u32(clamp(floor(cu * sa + cv * ca), 0.0, f32(p.h - 1u)));
        let q = unpack(src[sy * p.w + sx]);
        let cov = cmyk(vec3<f32>(f32(q.x), f32(q.y), f32(q.z)))[k];
        let r = cell * sqrt(cov / 3.141592653589793);
        let d = sqrt((u - cu) * (u - cu) + (v - cv) * (v - cv));
        ink[k] = clamp(r - d + 0.5, 0.0, 1.0);
    }
    let paper = 1.0 - ink.w;
    let s = unpack(src[i]);
    dst[i] = pack(vec4<u32>(jr(255.0 * (1.0 - ink.x) * paper), jr(255.0 * (1.0 - ink.y) * paper), jr(255.0 * (1.0 - ink.z) * paper), s.w));
}

// tramage ordonné Bayer 8 × 8 (fx_dynamic::ordered_dither) : f0 niveaux, r taille d'un point
@compute @workgroup_size(16, 16)
fn bayer(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    var m = array<u32, 64>(0u, 32u, 8u, 40u, 2u, 34u, 10u, 42u, 48u, 16u, 56u, 24u, 50u, 18u, 58u, 26u, 12u, 44u, 4u, 36u, 14u, 46u, 6u, 38u, 60u, 28u, 52u, 20u, 62u, 30u, 54u, 22u, 3u, 35u, 11u, 43u, 1u, 33u, 9u, 41u, 51u, 19u, 59u, 27u, 49u, 17u, 57u, 25u, 15u, 47u, 7u, 39u, 13u, 45u, 5u, 37u, 63u, 31u, 55u, 23u, 61u, 29u, 53u, 21u);
    let t = (f32(m[((id.y / p.r) & 7u) * 8u + ((id.x / p.r) & 7u)]) + 0.5) / 64.0;
    let s = unpack(src[i]);
    let steps = p.f0 - 1.0;
    var o = vec3<u32>(0u);
    for (var c = 0u; c < 3u; c++) {
        let v = f32(s[c]) / 255.0 * steps;
        var q = floor(v);
        if (v - q > t) { q += 1.0; }
        o[c] = jr(q / steps * 255.0);
    }
    dst[i] = pack(vec4<u32>(o, s.w));
}

// pixelisé : blocs de r pixels, couleur du centre du bloc
@compute @workgroup_size(16, 16)
fn pixelate(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let bs = p.r;
    let sx = min(p.w - 1u, (id.x / bs) * bs + bs / 2u);
    let sy = min(p.h - 1u, (id.y / bs) * bs + bs / 2u);
    dst[id.y * p.w + id.x] = src[sy * p.w + sx];
}

// trame noir et blanc à 45°, pas f0
@compute @workgroup_size(16, 16)
fn halftone(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let s = unpack(src[i]);
    let luma = (0.299 * f32(s.x) + 0.587 * f32(s.y) + 0.114 * f32(s.z)) / 255.0;
    let freq = 6.283185307179586 / p.f0;
    let ca = 0.7071067811865476; let sa = 0.7071067811865476;
    let xf = f32(id.x); let yf = f32(id.y);
    let pat = (sin((xf * ca - yf * sa) * freq) + sin((xf * sa + yf * ca) * freq)) / 2.0;
    var v = 0u;
    if (luma >= (pat + 1.0) / 2.0) { v = 255u; }
    dst[i] = pack(vec4<u32>(v, v, v, s.w));
}

// ombre, étape 1 : silhouette noire (alpha du calque)
@compute @workgroup_size(16, 16)
fn shadow_prep(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    dst[i] = (src[i] >> 24u) << 24u;
}

// ombre, étape 2 : calque d'origine (aux) posé sur l'ombre floutée (src)
@compute @workgroup_size(16, 16)
fn shadow_mix(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let s = unpack(aux[i]);
    let f = unpack(src[i]);
    let a_s = f32(s.w) / 255.0;
    if (a_s >= 1.0) { dst[i] = pack(vec4<u32>(s.x, s.y, s.z, 255u)); return; }
    if (a_s <= 0.0) { dst[i] = src[i]; return; }
    let a_d = f32(f.w) / 255.0;
    let m = 1.0 - a_s;
    let ao = a_s + a_d * m;
    if (ao <= 0.0) { dst[i] = src[i]; return; }
    let inv = 1.0 / ao;
    let c = (vec3<f32>(f32(s.x), f32(s.y), f32(s.z)) * a_s + vec3<f32>(f32(f.x), f32(f.y), f32(f.z)) * a_d * m) * inv;
    dst[i] = pack(vec4<u32>(rhe(c.x), rhe(c.y), rhe(c.z), rhe(floor(ao * 255.0 + 0.5))));
}

fn rgb_to_hsv(c: vec3<f32>) -> vec3<f32> {
    let n = c / 255.0;
    let mx = max(n.x, max(n.y, n.z)); let mn = min(n.x, min(n.y, n.z)); let d = mx - mn;
    var h = 0.0;
    if (d > 1e-6) {
        if (mx == n.x) { h = (n.y - n.z) / d; h = h - 6.0 * trunc(h / 6.0); }
        else if (mx == n.y) { h = (n.z - n.x) / d + 2.0; }
        else { h = (n.x - n.y) / d + 4.0; }
        h *= 60.0;
        if (h < 0.0) { h += 360.0; }
    }
    var s = 0.0;
    if (mx > 1e-6) { s = d / mx; }
    return vec3<f32>(h, s * 255.0, mx * 255.0);
}

fn hsv_to_rgb(h: f32, s: f32, v: f32) -> vec3<f32> {
    let hm = h - 360.0 * trunc(h / 360.0);
    let hn = ((hm + 360.0) - 360.0 * trunc((hm + 360.0) / 360.0)) / 60.0;
    let sn = clamp(s / 255.0, 0.0, 1.0); let vn = clamp(v / 255.0, 0.0, 1.0);
    let c = vn * sn;
    let x = c * (1.0 - abs((hn - 2.0 * trunc(hn / 2.0)) - 1.0));
    let m = vn - c;
    var o = vec3<f32>(c, 0.0, x);
    if (hn < 1.0) { o = vec3<f32>(c, x, 0.0); }
    else if (hn < 2.0) { o = vec3<f32>(x, c, 0.0); }
    else if (hn < 3.0) { o = vec3<f32>(0.0, c, x); }
    else if (hn < 4.0) { o = vec3<f32>(0.0, x, c); }
    else if (hn < 5.0) { o = vec3<f32>(x, 0.0, c); }
    return floor((o + m) * 255.0 + 0.5);
}

// opérations point par point (types 6 à 12), r = intensité 1..32
@compute @workgroup_size(16, 16)
fn color(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let s = unpack(src[i]);
    var c = vec3<f32>(f32(s.x), f32(s.y), f32(s.z));
    let r = f32(p.r);
    switch (p.mode) {
        case 6u: {
            let g = min((5.0 + r * 8.0) / 100.0, 1.0);
            let l = c.x * 0.299 + c.y * 0.587 + c.z * 0.114;
            c = c * (1.0 - g) + vec3<f32>(l) * g;
        }
        case 7u: {
            let k = min((8.0 + r * 6.0) / 100.0, 1.0);
            let sp = vec3<f32>(c.x * 0.393 + c.y * 0.769 + c.z * 0.189, c.x * 0.349 + c.y * 0.686 + c.z * 0.168, c.x * 0.272 + c.y * 0.534 + c.z * 0.131);
            c = c * (1.0 - k) + sp * k;
        }
        case 8u: {
            let k = min((12.0 + r * 7.0) / 100.0, 1.0);
            c = c * (1.0 - k) + (vec3<f32>(255.0) - c) * k;
        }
        case 9u: { c = c * clamp(0.65 + r * 0.055, 0.4, 2.2); }
        case 10u: { c = (c - vec3<f32>(127.5)) * clamp(0.55 + r * 0.065, 0.5, 2.2) + vec3<f32>(127.5); }
        case 11u: {
            let hsv = rgb_to_hsv(c);
            c = hsv_to_rgb(hsv.x, clamp(hsv.y * clamp((30.0 + r * 20.0) / 100.0, 0.0, 4.0), 0.0, 255.0), hsv.z);
        }
        case 12u: {
            let hsv = rgb_to_hsv(c);
            let h = hsv.x + r * 14.0;
            c = hsv_to_rgb(h - 360.0 * trunc(h / 360.0), hsv.y, hsv.z);
        }
        default: {}
    }
    dst[i] = pack(vec4<u32>(jr(c.x), jr(c.y), jr(c.z), s.w));
}

// TSV du moteur (util.rs rgb_to_hsv / hsv_to_rgb) : composantes 0..255, teinte en degrés,
// saturation et valeur en %
fn tsv_of(c: vec3<f32>) -> vec3<f32> {
    let r = c.x / 255.0; let g = c.y / 255.0; let b = c.z / 255.0;
    let mx = max(max(r, g), b);
    let mn = min(min(r, g), b);
    let d = mx - mn;
    var s = 0.0;
    if (mx != 0.0) { s = d / mx; }
    var h = 0.0;
    if (d > 0.0) {
        if (mx == r) {
            h = (g - b) / d;
            if (g < b) { h = h + 6.0; }
        } else if (mx == g) {
            h = (b - r) / d + 2.0;
        } else {
            h = (r - g) / d + 4.0;
        }
        h = h / 6.0;
    }
    return vec3<f32>(h * 360.0, s * 100.0, mx * 100.0);
}
fn rgb_of_tsv(h0: f32, s0: f32, v0: f32) -> vec3<f32> {
    let h = h0 / 360.0; let s = s0 / 100.0; let v = v0 / 100.0;
    let i = floor(h * 6.0);
    let f = h * 6.0 - i;
    let p = v * (1.0 - s);
    let q = v * (1.0 - f * s);
    let t = v * (1.0 - (1.0 - f) * s);
    var o = vec3<f32>(v, p, q);
    switch (((i32(i) % 6) + 6) % 6) {
        case 0: { o = vec3<f32>(v, t, p); }
        case 1: { o = vec3<f32>(q, v, p); }
        case 2: { o = vec3<f32>(p, v, t); }
        case 3: { o = vec3<f32>(p, q, v); }
        case 4: { o = vec3<f32>(t, p, v); }
        default: {}
    }
    return o * 255.0;
}

// réglages du menu (fx_adjust) : mode 0 teinte / saturation (TSV : f0 teinte, f1 saturation,
// f2 valeur), 1 vibrance (f0), 2 température / teinte (f0, f1 déjà × 0,6), 3 chaleur (f0)
@compute @workgroup_size(16, 16)
fn adjust2(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let q = unpack(src[i]);
    let c = vec3<f32>(f32(q.x), f32(q.y), f32(q.z));
    var o = c;
    switch (p.mode) {
        case 0u: {
            let t = tsv_of(c);
            o = rgb_of_tsv((t.x + p.f0 + 720.0) % 360.0, clamp(t.y + p.f1, 0.0, 100.0), clamp(t.z + p.f2, 0.0, 100.0));
        }
        case 1u: {
            let mx = max(max(c.x, c.y), c.z);
            let avg = (c.x + c.y + c.z) / 3.0;
            let k = 1.0 + p.f0 * (1.0 - (mx - avg) / 255.0);
            o = vec3<f32>(avg + (c.x - avg) * k, avg + (c.y - avg) * k, avg + (c.z - avg) * k);
        }
        case 2u: { o = vec3<f32>(c.x + p.f0 - p.f1 * 0.5, c.y + p.f1, c.z - p.f0 - p.f1 * 0.5); }
        case 3u: { o = vec3<f32>(c.x + p.f0 * 40.0, c.y + p.f0 * 8.0, c.z - p.f0 * 40.0); }
        default: {}
    }
    dst[i] = pack(vec4<u32>(jr(o.x), jr(o.y), jr(o.z), q.w));
}

// vignette (fx_photo::vignette) : r couleur 0xRRVVBB, mode fusion (0 couleur, 1 produit,
// 2 superposition écran, 3 incrustation), f0 force, f1 / f2 centre, f3 rayon de référence
@compute @workgroup_size(16, 16)
fn vignette(@builtin(global_invocation_id) id: vec3<u32>) {
    if (id.x >= p.w || id.y >= p.h) { return; }
    let i = id.y * p.w + id.x;
    let q = unpack(src[i]);
    let dx = f32(id.x) - p.f1;
    let dy = f32(id.y) - p.f2;
    let d = sqrt(dx * dx + dy * dy) / p.f3 * p.f0 * 2.0;
    var mask = 0.0;
    if (d <= 0.2) {
        mask = 1.0;
    } else if (d < 0.8) {
        let t = (d - 0.2) / 0.6;
        mask = 1.0 - t * t * (3.0 - 2.0 * t);
    }
    let m = vec3<f32>(f32((p.r >> 16u) & 255u), f32((p.r >> 8u) & 255u), f32(p.r & 255u)) / 255.0;
    let o = vec3<f32>(f32(q.x), f32(q.y), f32(q.z)) / 255.0;
    var f = m;
    switch (p.mode) {
        case 1u: { f = o * m; }
        case 2u: { f = vec3<f32>(1.0) - (vec3<f32>(1.0) - o) * (vec3<f32>(1.0) - m); }
        case 3u: { f = select(vec3<f32>(1.0) - 2.0 * (vec3<f32>(1.0) - o) * (vec3<f32>(1.0) - m), 2.0 * o * m, o < vec3<f32>(0.5)); }
        default: {}
    }
    let r = (o * mask + f * (1.0 - mask)) * 255.0;
    dst[i] = pack(vec4<u32>(jr(r.x), jr(r.y), jr(r.z), q.w));
}
"#;

const KERNELS: [&str; 13] = [
    "box_pass", "sharpen", "pixelate", "halftone", "shadow_prep", "shadow_mix", "color", "cell_avg", "adjust", "print_screen", "bayer", "adjust2", "vignette",
];

pub struct Gpu {
    device: wgpu::Device,
    queue: wgpu::Queue,
    layout: wgpu::BindGroupLayout,
    pipes: HashMap<&'static str, wgpu::ComputePipeline>,
    max_bytes: u64,
    /// nom de la carte (affiché dans la barre d'état)
    pub name: String,
}

/// Une passe : noyau, tampons (source, auxiliaire, destination) et paramètres.
struct Pass {
    kernel: &'static str,
    src: usize,
    aux: usize,
    dst: usize,
    r: u32,
    mode: u32,
    f0: f32,
    f1: f32,
    f2: f32,
    f3: f32,
}

impl Pass {
    fn new(kernel: &'static str, src: usize, aux: usize, dst: usize, r: u32, mode: u32, f0: f32) -> Pass {
        Pass { kernel, src, aux, dst, r, mode, f0, f1: 0.0, f2: 0.0, f3: 0.0 }
    }
}

fn jround(v: f32) -> f32 {
    (v + 0.5).floor()
}

/// Passes d'une chaîne d'effets dynamiques (mêmes étapes que fx_dynamic::stage). Retourne
/// les passes et l'index du tampon qui contient le résultat. Tampons : 0..4.
fn plan(stack: &[(i32, f32)]) -> (Vec<Pass>, usize) {
    let mut v = Vec::new();
    let mut cur = 0usize;
    let free = |used: &[usize]| (0..4).filter(|i| !used.contains(i)).collect::<Vec<_>>();
    // moyenne glissante en deux sens (+ une seconde passe plus étroite), comme box_blur_rgb / _full
    let blur = |v: &mut Vec<Pass>, input: usize, out: usize, tmp: usize, rad: f32, full: bool| {
        let (lim, second) = if full { (64, 2.0) } else { (32, 1.0) };
        let r1 = (rad.trunc() as i64).clamp(1, lim) as u32;
        let mode = if full { 0 } else { 2 };
        v.push(Pass::new("box_pass", input, input, tmp, r1, mode | 1, 0.0));
        v.push(Pass::new("box_pass", tmp, tmp, out, r1, mode, 0.0));
        if rad > second {
            let r2 = (jround(rad * 0.6).max(1.0) as i64).clamp(1, lim) as u32;
            v.push(Pass::new("box_pass", out, out, tmp, r2, mode | 1, 0.0));
            v.push(Pass::new("box_pass", tmp, tmp, out, r2, mode, 0.0));
        }
    };
    for &(typ, rad) in stack {
        let f = free(&[cur]);
        let (a, b, c) = (f[0], f[1], f[2]);
        match typ {
            0 => {
                blur(&mut v, cur, a, b, rad, false);
                cur = a;
            }
            1 => {
                blur(&mut v, cur, a, b, rad, false);
                blur(&mut v, a, c, b, jround(rad * 0.55).max(1.0), false);
                cur = c;
            }
            2 => {
                let br = (rad.clamp(1.0, 3.0).trunc()).max(1.0);
                blur(&mut v, cur, a, b, br, false);
                v.push(Pass::new("sharpen", a, cur, c, 0, 0, (0.55 + rad * 0.08).clamp(0.0, 2.5)));
                cur = c;
            }
            3 => {
                v.push(Pass::new("pixelate", cur, cur, a, jround(rad * 2.0).clamp(2.0, 48.0) as u32, 0, 0.0));
                cur = a;
            }
            4 => {
                v.push(Pass::new("halftone", cur, cur, a, 0, 0, (rad * 1.5).max(2.0)));
                cur = a;
            }
            5 => {
                v.push(Pass::new("shadow_prep", cur, cur, a, 0, 0, 0.0));
                blur(&mut v, a, b, c, rad.trunc().max(1.0), true);
                v.push(Pass::new("shadow_mix", b, cur, a, 0, 0, 0.0));
                cur = a;
            }
            6..=12 => {
                v.push(Pass::new("color", cur, cur, a, (rad.trunc() as i64).clamp(1, 32) as u32, typ as u32, 0.0));
                cur = a;
            }
            13 => {
                v.push(Pass::new("print_screen", cur, cur, a, 0, 0, (rad * 1.5).max(3.0)));
                cur = a;
            }
            14 => {
                let (levels, scale) = masterpaint_core::dither_params(rad as f64);
                v.push(Pass::new("bayer", cur, cur, a, scale as u32, 0, levels as f32));
                cur = a;
            }
            _ => {}
        }
    }
    (v, cur)
}

/// Effets du menu calculés sur la carte graphique : mêmes calculs que le moteur CPU
/// (masterpaint-core : fx_blur, fx_photo, fx_distort, fx_adjust), arrondis compris.
/// None : effet sans équivalent (calcul CPU).
fn menu_plan(name: &str, p: &[f32]) -> Option<(Vec<Pass>, usize)> {
    let f = |i: usize, d: f32| p.get(i).copied().filter(|v| v.is_finite()).unwrap_or(d);
    let mut v = Vec::new();
    // flou boîte du moteur : `passes` fois horizontal puis vertical, bords répétés ; 0 → 1 → 2 → 1…
    let boxes = |v: &mut Vec<Pass>, r: u32, passes: usize| -> usize {
        let (mut a, mut b) = (0usize, 1usize);
        for _ in 0..passes {
            v.push(Pass::new("box_pass", a, a, b, r, 7, 0.0));
            let c = if a == 0 { 2 } else { a };
            v.push(Pass::new("box_pass", b, b, c, r, 6, 0.0));
            (a, b) = (c, if c == 1 { 2 } else { 1 });
        }
        a
    };
    let out = match name {
        "blur" | "gaussian" => {
            // grand rayon : la fenêtre glissante du CPU (coût fixe par pixel) va plus vite
            let r = f(0, 2.0).max(0.0) as u32;
            if r == 0 || r > 48 {
                return None;
            }
            boxes(&mut v, r, if name == "blur" { 1 } else { 3 })
        }
        "sharpen" | "unsharp" => {
            let (amt, r, thr) = if name == "sharpen" { (f(0, 45.0) / 100.0, f(1, 1.0), 0.0) } else { (f(0, 80.0) / 100.0, f(1, 3.0), f(2, 0.0)) };
            if r > 48.0 {
                return None;
            }
            let blurred = boxes(&mut v, r.max(1.0) as u32, 1);
            let dst = if blurred == 1 { 2 } else { 1 };
            let mut ps = Pass::new("sharpen", blurred, 0, dst, 0, (name == "unsharp") as u32, amt);
            ps.f1 = thr;
            v.push(ps);
            dst
        }
        "pixelate" => {
            // chaque pixel relit toute sa cellule : seulement pour des cellules petites
            let size = f(0, 10.0).max(1.0) as u32;
            if size > 16 {
                return None;
            }
            v.push(Pass::new("cell_avg", 0, 0, 1, size, 0, 0.0));
            1
        }
        "brightness" => {
            let (br, co) = (f(0, 0.0), f(1, 0.0));
            let mut ps = Pass::new("adjust", 0, 0, 1, 0, 0, (259.0 * (co + 255.0)) / (255.0 * (259.0 - co)));
            (ps.f1, ps.f2, ps.f3) = (br, f(2, 0.0) * 0.5, f(3, 0.0) * 0.5);
            v.push(ps);
            1
        }
        "grayscale" | "invert" | "sepia" => {
            let mode = match name {
                "grayscale" => 1,
                "invert" => 2,
                _ => 3,
            };
            v.push(Pass::new("adjust", 0, 0, 1, 0, mode, 0.0));
            1
        }
        // teinte / saturation : mélangeur par plage de teinte (p[3]) → moteur CPU
        "hsv" if f(3, 0.0) == 0.0 => {
            let mut ps = Pass::new("adjust2", 0, 0, 1, 0, 0, f(0, 0.0));
            (ps.f1, ps.f2) = (f(1, 0.0), f(2, 0.0));
            v.push(ps);
            1
        }
        "vibrance" => {
            v.push(Pass::new("adjust2", 0, 0, 1, 0, 1, f(0, 50.0) / 100.0));
            1
        }
        "temptint" => {
            let mut ps = Pass::new("adjust2", 0, 0, 1, 0, 2, f(0, 0.0) * 0.6);
            ps.f1 = f(1, 0.0) * 0.6;
            v.push(ps);
            1
        }
        "temperature" => {
            v.push(Pass::new("adjust2", 0, 0, 1, 0, 3, f(0, 0.0) / 100.0));
            1
        }
        // vignette : le centre et le rayon dépendent de la taille, fixés par `menu_plan_sized`
        "vignette" => {
            let mut ps = Pass::new("vignette", 0, 0, 1, f(1, 0.0) as u32, f(2, 0.0) as u32, f(0, 50.0) / 100.0);
            (ps.f1, ps.f2) = (f(3, 0.0), f(4, 0.0));
            v.push(ps);
            1
        }
        _ => return None,
    };
    Some((v, out))
}

/// L'effet du menu `name` a-t-il un calcul sur la carte graphique ?
pub fn menu_supported(name: &str) -> bool {
    menu_plan(name, &[]).is_some()
}

/// Réglages qui dépendent de la taille de l'image (vignette : centre et rayon de référence,
/// calculés comme fx_photo::vignette).
fn size_passes(passes: &mut [Pass], w: usize, h: usize) {
    for ps in passes.iter_mut().filter(|ps| ps.kernel == "vignette") {
        let (wf, hf) = (w as f32, h as f32);
        let (ox, oy) = (ps.f1, ps.f2);
        ps.f1 = wf / 2.0 * (1.0 + ox / 100.0);
        ps.f2 = hf / 2.0 * (1.0 + oy / 100.0);
        ps.f3 = ((wf / 2.0) * (wf / 2.0) + (hf / 2.0) * (hf / 2.0)).sqrt().max(1.0);
    }
}

impl Gpu {
    /// Ouvre la carte graphique (None si aucune n'est compatible).
    pub async fn new() -> Option<Gpu> {
        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor::new_without_display_handle());
        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions { power_preference: wgpu::PowerPreference::HighPerformance, ..Default::default() })
            .await
            .ok()?;
        let info = adapter.get_info();
        // un rendu logiciel (llvmpipe, SwiftShader…) n'apporte rien face au moteur CPU multi-cœur
        if info.device_type == wgpu::DeviceType::Cpu {
            return None;
        }
        let limits = adapter.limits();
        let (device, queue) = adapter
            .request_device(&wgpu::DeviceDescriptor { label: Some("masterpaint"), required_limits: limits.clone(), ..Default::default() })
            .await
            .ok()?;
        let module = device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some("effets"), source: wgpu::ShaderSource::Wgsl(SHADER.into()) });
        let entry = |binding: u32, ty: wgpu::BufferBindingType| wgpu::BindGroupLayoutEntry {
            binding,
            visibility: wgpu::ShaderStages::COMPUTE,
            ty: wgpu::BindingType::Buffer { ty, has_dynamic_offset: false, min_binding_size: None },
            count: None,
        };
        let layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: None,
            entries: &[
                entry(0, wgpu::BufferBindingType::Uniform),
                entry(1, wgpu::BufferBindingType::Storage { read_only: true }),
                entry(2, wgpu::BufferBindingType::Storage { read_only: true }),
                entry(3, wgpu::BufferBindingType::Storage { read_only: false }),
            ],
        });
        let pl = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[Some(&layout)], immediate_size: 0 });
        let pipes = KERNELS
            .iter()
            .map(|k| {
                let pipe = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
                    label: Some(k),
                    layout: Some(&pl),
                    module: &module,
                    entry_point: Some(k),
                    compilation_options: Default::default(),
                    cache: None,
                });
                (*k, pipe)
            })
            .collect();
        let max_bytes = (limits.max_storage_buffer_binding_size as u64).min(limits.max_buffer_size);
        let backend = match info.backend {
            wgpu::Backend::BrowserWebGpu => "WebGPU".to_string(),
            wgpu::Backend::Dx12 => "DirectX 12".to_string(),
            b => format!("{b:?}"),
        };
        let label = if info.name.is_empty() { "carte graphique".to_string() } else { info.name.clone() };
        Some(Gpu { device, queue, layout, pipes, max_bytes, name: format!("{label} ({backend})") })
    }

    /// Prépare et soumet la chaîne ; retourne le tampon de relecture (None : image trop grande).
    fn submit(&self, src: &[u8], w: usize, h: usize, stack: &[(i32, f32)]) -> Option<wgpu::Buffer> {
        let bytes = (w * h * 4) as u64;
        if bytes == 0 || bytes > self.max_bytes || src.len() as u64 != bytes {
            return None;
        }
        let (passes, out) = plan(stack);
        self.submit_passes(src, w, h, &passes, out)
    }

    /// Soumet des passes déjà préparées ; retourne le tampon de relecture.
    fn submit_passes(&self, src: &[u8], w: usize, h: usize, passes: &[Pass], out: usize) -> Option<wgpu::Buffer> {
        let bytes = (w * h * 4) as u64;
        if bytes == 0 || bytes > self.max_bytes || src.len() as u64 != bytes || passes.is_empty() {
            return None;
        }
        let usage = wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC | wgpu::BufferUsages::COPY_DST;
        let bufs: Vec<wgpu::Buffer> = (0..4)
            .map(|i| {
                if i == 0 {
                    self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents: src, usage })
                } else {
                    self.device.create_buffer(&wgpu::BufferDescriptor { label: None, size: bytes, usage, mapped_at_creation: false })
                }
            })
            .collect();
        let read = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: None,
            size: bytes,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        let mut enc = self.device.create_command_encoder(&Default::default());
        for ps in passes {
            let mut u = [0u8; 32];
            for (k, v) in [w as u32, h as u32, ps.r, ps.mode].iter().enumerate() {
                u[k * 4..k * 4 + 4].copy_from_slice(&v.to_le_bytes());
            }
            for (k, f) in [ps.f0, ps.f1, ps.f2, ps.f3].iter().enumerate() {
                u[16 + k * 4..20 + k * 4].copy_from_slice(&f.to_le_bytes());
            }
            let ub = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents: &u, usage: wgpu::BufferUsages::UNIFORM });
            let bg = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: None,
                layout: &self.layout,
                entries: &[
                    wgpu::BindGroupEntry { binding: 0, resource: ub.as_entire_binding() },
                    wgpu::BindGroupEntry { binding: 1, resource: bufs[ps.src].as_entire_binding() },
                    wgpu::BindGroupEntry { binding: 2, resource: bufs[ps.aux].as_entire_binding() },
                    wgpu::BindGroupEntry { binding: 3, resource: bufs[ps.dst].as_entire_binding() },
                ],
            });
            let mut cp = enc.begin_compute_pass(&Default::default());
            cp.set_pipeline(&self.pipes[ps.kernel]);
            cp.set_bind_group(0, &bg, &[]);
            cp.dispatch_workgroups((w as u32).div_ceil(16), (h as u32).div_ceil(16), 1);
        }
        enc.copy_buffer_to_buffer(&bufs[out], 0, &read, 0, bytes);
        self.queue.submit([enc.finish()]);
        Some(read)
    }

    /// Effet du menu (voir `menu_plan`), résultat attendu sur place (bureau).
    #[cfg(not(target_arch = "wasm32"))]
    pub fn run_menu(&self, name: &str, src: &[u8], w: usize, h: usize, p: &[f32]) -> Option<Vec<u8>> {
        let (mut passes, out) = menu_plan(name, p)?;
        size_passes(&mut passes, w, h);
        let read = self.submit_passes(src, w, h, &passes, out)?;
        self.read_back(read)
    }

    /// Effet du menu (voir `menu_plan`), résultat asynchrone (navigateur).
    #[cfg(target_arch = "wasm32")]
    pub async fn run_menu(&self, name: &str, src: &[u8], w: usize, h: usize, p: &[f32]) -> Option<Vec<u8>> {
        let (mut passes, out) = menu_plan(name, p)?;
        size_passes(&mut passes, w, h);
        let read = self.submit_passes(src, w, h, &passes, out)?;
        self.read_back(read).await
    }

    #[cfg(not(target_arch = "wasm32"))]
    fn read_back(&self, read: wgpu::Buffer) -> Option<Vec<u8>> {
        let (tx, rx) = std::sync::mpsc::channel();
        read.map_async(wgpu::MapMode::Read, .., move |r| {
            let _ = tx.send(r.is_ok());
        });
        self.device.poll(wgpu::PollType::wait_indefinitely()).ok()?;
        if !rx.recv().ok()? {
            return None;
        }
        let out = read.get_mapped_range(..).ok()?.to_vec();
        read.unmap();
        Some(out)
    }

    #[cfg(target_arch = "wasm32")]
    async fn read_back(&self, read: wgpu::Buffer) -> Option<Vec<u8>> {
        let (tx, rx) = futures_channel::oneshot::channel();
        read.map_async(wgpu::MapMode::Read, .., move |r| {
            let _ = tx.send(r.is_ok());
        });
        if !rx.await.ok()? {
            return None;
        }
        let out = read.get_mapped_range(..).ok()?.to_vec();
        read.unmap();
        Some(out)
    }

    /// Chaîne d'effets dynamiques, résultat attendu sur place (bureau).
    #[cfg(not(target_arch = "wasm32"))]
    pub fn run_stack(&self, src: &[u8], w: usize, h: usize, stack: &[(i32, f32)]) -> Option<Vec<u8>> {
        let read = self.submit(src, w, h, stack)?;
        let (tx, rx) = std::sync::mpsc::channel();
        read.map_async(wgpu::MapMode::Read, .., move |r| {
            let _ = tx.send(r.is_ok());
        });
        self.device.poll(wgpu::PollType::wait_indefinitely()).ok()?;
        if !rx.recv().ok()? {
            return None;
        }
        let out = read.get_mapped_range(..).ok()?.to_vec();
        read.unmap();
        Some(out)
    }

    /// Chaîne d'effets dynamiques, résultat asynchrone (navigateur : la relecture ne bloque pas).
    #[cfg(target_arch = "wasm32")]
    pub async fn run_stack(&self, src: &[u8], w: usize, h: usize, stack: &[(i32, f32)]) -> Option<Vec<u8>> {
        let read = self.submit(src, w, h, stack)?;
        let (tx, rx) = futures_channel::oneshot::channel();
        read.map_async(wgpu::MapMode::Read, .., move |r| {
            let _ = tx.send(r.is_ok());
        });
        if !rx.await.ok()? {
            return None;
        }
        let out = read.get_mapped_range(..).ok()?.to_vec();
        read.unmap();
        Some(out)
    }
}

// ------------------------------------------------------------------ composition de l'affichage

/// Composition des calques comme `Doc::composite_scaled` / `Doc::over` (editor.rs) : une passe
/// par calque visible sur un accumulateur flottant par échantillon (1 par pixel d'affichage, 4
/// à partir du pas 4), puis `RESOLVE` fait la moyenne prémultipliée et pose le damier.
/// flags : bit 0 masque α (aux), bits 1-2 filtre dynamique (1 mode 0, 2 mode 2 : aux = rendu ƒ),
/// bit 3 premier calque (accumulateur vide).
const COMPOSE: &str = r#"
struct C { w: u32, h: u32, ds: u32, ns: u32, x0: u32, y0: u32, bw: u32, bh: u32,
           blend: u32, flags: u32, opacity: f32, off0: u32, off1: u32, checker: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<uniform> c: C;
@group(0) @binding(1) var<storage, read> lay: array<u32>;
@group(0) @binding(2) var<storage, read> aux: array<u32>;
@group(0) @binding(3) var<storage, read_write> acc: array<vec4<f32>>;

fn px4(v: u32) -> vec4<f32> {
    return vec4<f32>(f32(v & 255u), f32((v >> 8u) & 255u), f32((v >> 16u) & 255u), f32(v >> 24u)) / 255.0;
}
fn hard(s: f32, d: f32) -> f32 {
    if (s <= 0.5) { return d * 2.0 * s; }
    let s2 = 2.0 * s - 1.0;
    return d + s2 - d * s2;
}
fn mixc(m: u32, s: f32, d: f32) -> f32 {
    var r = s;
    switch (m) {
        case 1u: { r = s * d; }
        case 2u: { r = s + d - s * d; }
        case 3u: { r = hard(d, s); }
        case 4u: {
            if (s <= 0.5) {
                r = d - (1.0 - 2.0 * s) * d * (1.0 - d);
            } else {
                var dd = sqrt(d);
                if (d <= 0.25) { dd = ((16.0 * d - 12.0) * d + 4.0) * d; }
                r = d + (2.0 * s - 1.0) * (dd - d);
            }
        }
        case 5u: { r = hard(s, d); }
        case 6u: { r = min(s, d); }
        case 7u: { r = max(s, d); }
        case 8u: {
            if (d <= 0.0) { r = 0.0; } else if (s >= 1.0) { r = 1.0; } else { r = min(d / (1.0 - s), 1.0); }
        }
        case 9u: {
            if (d >= 1.0) { r = 1.0; } else if (s <= 0.0) { r = 0.0; } else { r = 1.0 - min((1.0 - d) / s, 1.0); }
        }
        case 10u: { r = abs(s - d); }
        case 11u: { r = s + d - 2.0 * s * d; }
        default: {}
    }
    return r;
}
fn lum(q: vec3<f32>) -> f32 { return 0.3 * q.x + 0.59 * q.y + 0.11 * q.z; }
fn clip_color(q: vec3<f32>) -> vec3<f32> {
    let l = lum(q);
    let n = min(min(q.x, q.y), q.z);
    let x = max(max(q.x, q.y), q.z);
    var o = q;
    if (n < 0.0) { o = vec3<f32>(l) + (o - vec3<f32>(l)) * l / (l - n); }
    if (x > 1.0) { o = vec3<f32>(l) + (o - vec3<f32>(l)) * (1.0 - l) / (x - l); }
    return o;
}
fn set_lum(q: vec3<f32>, l: f32) -> vec3<f32> {
    let d = l - lum(q);
    return clip_color(q + vec3<f32>(d));
}
fn sat(q: vec3<f32>) -> f32 { return max(max(q.x, q.y), q.z) - min(min(q.x, q.y), q.z); }
fn set_sat(q: vec3<f32>, s: f32) -> vec3<f32> {
    let mx = max(max(q.x, q.y), q.z);
    let mn = min(min(q.x, q.y), q.z);
    if (mx - mn <= 0.0) { return vec3<f32>(0.0); }
    return (q - vec3<f32>(mn)) * s / (mx - mn);
}
fn blend_rgb(m: u32, s: vec3<f32>, d: vec3<f32>) -> vec3<f32> {
    var o = vec3<f32>(mixc(m, s.x, d.x), mixc(m, s.y, d.y), mixc(m, s.z, d.z));
    switch (m) {
        case 12u: { o = set_lum(set_sat(s, sat(d)), lum(d)); }
        case 13u: { o = set_lum(set_sat(d, sat(s)), lum(d)); }
        case 14u: { o = set_lum(s, lum(d)); }
        case 15u: { o = set_lum(d, lum(s)); }
        default: {}
    }
    return o;
}

@compute @workgroup_size(256)
fn compose_layer(@builtin(global_invocation_id) gid: vec3<u32>) {
    let s = gid.x;
    if (s >= c.bw * c.bh * c.ns) { return; }
    let p = s / c.ns;
    let k = s % c.ns;
    var ox = c.off0;
    var oy = c.off0;
    if (c.ns == 4u) {
        if ((k & 1u) == 1u) { ox = c.off1; }
        if (k >= 2u) { oy = c.off1; }
    }
    let sx = min((c.x0 + p % c.bw) * c.ds + ox, c.w - 1u);
    let sy = min((c.y0 + p / c.bw) * c.ds + oy, c.h - 1u);
    let i = sy * c.w + sx;
    var a = vec4<f32>(0.0);
    if ((c.flags & 8u) == 0u) { a = acc[s]; }
    let dynm = (c.flags >> 1u) & 3u;
    if (dynm != 0u) {
        // filtre dynamique, modes 0 / 2 : le rendu ƒ remplace le dessous (luminance × alpha)
        let q = px4(lay[i]);
        var m = c.opacity;
        if (dynm == 1u) { m = (0.299 * q.x + 0.587 * q.y + 0.114 * q.z) * q.w * c.opacity; }
        if (m > 0.0) {
            let f = px4(aux[i]);
            a = a + (f - a) * m;
        }
        acc[s] = a;
        return;
    }
    let q = px4(lay[i]);
    var sa = q.w * c.opacity;
    if ((c.flags & 1u) == 1u) {
        sa = sa * f32((aux[i / 4u] >> ((i % 4u) * 8u)) & 255u) / 255.0;
    }
    if (sa <= 0.0) {
        acc[s] = a;
        return;
    }
    var bl = q.xyz;
    if (a.w > 0.0 && c.blend != 0u) { bl = blend_rgb(c.blend, q.xyz, a.xyz); }
    let ao = sa + a.w * (1.0 - sa);
    let o = (sa * (1.0 - a.w) * q.xyz + sa * a.w * bl + (1.0 - sa) * a.w * a.xyz) / ao;
    acc[s] = vec4<f32>(o, ao);
}
"#;

const RESOLVE: &str = r#"
struct C { w: u32, h: u32, ds: u32, ns: u32, x0: u32, y0: u32, bw: u32, bh: u32,
           blend: u32, flags: u32, opacity: f32, off0: u32, off1: u32, checker: u32, pad0: u32, pad1: u32 };
@group(0) @binding(0) var<uniform> c: C;
@group(0) @binding(1) var<storage, read> acc: array<vec4<f32>>;
@group(0) @binding(2) var<storage, read> aux: array<u32>;
@group(0) @binding(3) var<storage, read_write> view_px: array<u32>;

@compute @workgroup_size(256)
fn compose_resolve(@builtin(global_invocation_id) gid: vec3<u32>) {
    let p = gid.x;
    if (p >= c.bw * c.bh) { return; }
    var col = vec4<f32>(0.0);
    if (c.ns == 1u) {
        col = acc[p];
    } else {
        // moyenne en couleurs prémultipliées (les bords transparents ne bavent pas)
        var r = vec3<f32>(0.0);
        var a = 0.0;
        for (var k = 0u; k < c.ns; k++) {
            let v = acc[p * c.ns + k];
            r += v.xyz * v.w;
            a += v.w;
        }
        if (a > 0.0) { col = vec4<f32>(r / a, a / f32(c.ns)); }
    }
    var o = col;
    if (c.checker == 1u) {
        let x = (c.x0 + p % c.bw) * c.ds;
        let y = (c.y0 + p / c.bw) * c.ds;
        var chk = 0.8;
        if ((((x >> 3u) + (y >> 3u)) & 1u) == 0u) { chk = 1.0; }
        o = vec4<f32>(col.xyz * col.w + vec3<f32>(chk * (1.0 - col.w)), 1.0);
    }
    let q = vec4<u32>(clamp(o * 255.0 + vec4<f32>(0.5), vec4<f32>(0.0), vec4<f32>(255.0)));
    view_px[p] = q.x | (q.y << 8u) | (q.z << 16u) | (q.w << 24u);
}
"#;

/// Pixels d'un calque gardés sur la carte graphique. `src` / `aux_src` : tampons d'origine
/// (référence faible : aucun coût pour l'application ; toute écriture dans le calque passe par
/// `Arc::make_mut`, qui en change l'adresse, et le tampon est alors renvoyé).
struct LayerBuf {
    src: std::sync::Weak<Vec<u8>>,
    buf: wgpu::Buffer,
    aux_src: Option<std::sync::Weak<Vec<u8>>>,
    aux: Option<wgpu::Buffer>,
}

struct Composer {
    layer: wgpu::ComputePipeline,
    resolve: wgpu::ComputePipeline,
    bufs: HashMap<u64, LayerBuf>,
}

thread_local! {
    /// composition de l'affichage : toujours sur le fil de l'interface
    static COMPOSER: std::cell::RefCell<Option<Composer>> = const { std::cell::RefCell::new(None) };
}

/// Mémoire graphique au-delà de laquelle la composition reste sur le processeur.
#[cfg(not(target_arch = "wasm32"))]
const COMPOSE_BUDGET: u64 = 1_500_000_000;
#[cfg(target_arch = "wasm32")]
const COMPOSE_BUDGET: u64 = 1_000_000_000;

/// Même tampon que `w` ?
fn same_src(w: &std::sync::Weak<Vec<u8>>, a: &std::sync::Arc<Vec<u8>>) -> bool {
    std::ptr::eq(w.as_ptr(), std::sync::Arc::as_ptr(a))
}

/// Composition demandée à la carte graphique : la relecture donne `w` × `h` pixels RGBA.
pub struct ViewJob {
    read: wgpu::Buffer,
    pub w: usize,
    pub h: usize,
}

impl Gpu {
    fn compose_pipe(&self, src: &str, entry: &'static str) -> wgpu::ComputePipeline {
        let module = self.device.create_shader_module(wgpu::ShaderModuleDescriptor { label: Some(entry), source: wgpu::ShaderSource::Wgsl(src.into()) });
        let pl = self.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor { label: None, bind_group_layouts: &[Some(&self.layout)], immediate_size: 0 });
        self.device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some(entry),
            layout: Some(&pl),
            module: &module,
            entry_point: Some(entry),
            compilation_options: Default::default(),
            cache: None,
        })
    }

    /// Tampon de stockage rempli avec `data` (réutilise `old` s'il a la bonne taille).
    fn storage_with(&self, old: Option<wgpu::Buffer>, data: &[u8]) -> wgpu::Buffer {
        let size = (data.len() as u64).div_ceil(4).max(1) * 4;
        let buf = match old.filter(|b| b.size() == size) {
            Some(b) => b,
            None => self.device.create_buffer(&wgpu::BufferDescriptor {
                label: Some("calque"),
                size,
                usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
                mapped_at_creation: false,
            }),
        };
        if data.len() as u64 == size {
            self.queue.write_buffer(&buf, 0, data);
        } else {
            let mut v = data.to_vec();
            v.resize(size as usize, 0);
            self.queue.write_buffer(&buf, 0, &v);
        }
        buf
    }

    /// Compose le rectangle `r` (x0, y0, x1, y1 exclus, en pixels de l'affichage au pas `ds`) du
    /// document, comme `Doc::composite_scaled` ; `checker` : sur le damier de transparence.
    /// None : pas possible ici (dossiers de calques, image ou mémoire trop grandes) → CPU.
    /// Les calques déjà envoyés ne repartent que s'ils ont changé.
    pub fn compose_submit(&self, doc: &crate::editor::Doc, ds: usize, r: (usize, usize, usize, usize), checker: bool) -> Option<ViewJob> {
        let (w, h) = (doc.w, doc.h);
        let ds = ds.max(1);
        let (dw, dh) = (w.div_ceil(ds), h.div_ceil(ds));
        let (x0, y0, x1, y1) = (r.0, r.1, r.2.min(dw), r.3.min(dh));
        if w == 0 || h == 0 || x1 <= x0 || y1 <= y0 || doc.has_groups() || (w * h * 4) as u64 > self.max_bytes {
            return None;
        }
        let vis: Vec<&crate::editor::Layer> = doc.layers.iter().filter(|l| l.visible && l.opacity > 0.0).collect();
        if vis.is_empty() {
            return None;
        }
        // échantillons dans un bloc ds × ds : mêmes positions que `Doc::scaled_band`
        let (off0, off1, ns) = if ds >= 4 { ((ds / 4) as u32, (ds * 3 / 4) as u32, 4u32) } else { ((ds / 2) as u32, (ds / 2) as u32, 1u32) };
        COMPOSER.with(|cell| {
            let mut cell = cell.borrow_mut();
            let comp = cell.get_or_insert_with(|| Composer { layer: self.compose_pipe(COMPOSE, "compose_layer"), resolve: self.compose_pipe(RESOLVE, "compose_resolve"), bufs: HashMap::new() });
            comp.bufs.retain(|uid, _| doc.layers.iter().any(|l| l.uid == *uid));
            // sources de chaque calque : pixels (ou rendu ƒ en mode 1), puis masque α ou rendu ƒ
            let mut plan: Vec<(u64, u32, u32, f32)> = Vec::with_capacity(vis.len());
            let mut total = 0u64;
            for (n, l) in vis.iter().enumerate() {
                let mask = l.mask.as_ref().filter(|m| m.len() == w * h).map(|m| m.arc());
                let (main, aux, mut flags) = match (&l.dyn_cache, l.dynamic_mode) {
                    (Some(cache), 0) => (l.px.arc(), Some(cache.clone()), 2u32),
                    (Some(cache), 2) => (l.px.arc(), Some(cache.clone()), 4u32),
                    (Some(cache), 1) => (cache.clone(), mask.clone(), mask.is_some() as u32),
                    _ => (l.px.arc(), mask.clone(), mask.is_some() as u32),
                };
                if main.len() != w * h * 4 || aux.as_ref().is_some_and(|a| a.len() < w * h) {
                    return None;
                }
                if n == 0 {
                    flags |= 8;
                }
                let fresh = match comp.bufs.get(&l.uid) {
                    Some(b) => !same_src(&b.src, &main) || b.buf.size() < main.len() as u64,
                    None => true,
                };
                let old = comp.bufs.remove(&l.uid);
                let (buf, src, old_aux, old_aux_src) = match old {
                    Some(b) if !fresh => (b.buf, b.src, b.aux, b.aux_src),
                    Some(b) => (self.storage_with(Some(b.buf), &main), std::sync::Arc::downgrade(&main), b.aux, b.aux_src),
                    None => (self.storage_with(None, &main), std::sync::Arc::downgrade(&main), None, None),
                };
                let (aux_buf, aux_src) = match &aux {
                    Some(a) => match (old_aux, old_aux_src) {
                        (Some(ab), Some(asrc)) if same_src(&asrc, a) => (Some(ab), Some(asrc)),
                        (ab, _) => (Some(self.storage_with(ab, a)), Some(std::sync::Arc::downgrade(a))),
                    },
                    None => (None, None),
                };
                total += buf.size() + aux_buf.as_ref().map_or(0, |b| b.size());
                comp.bufs.insert(l.uid, LayerBuf { src, buf, aux_src, aux: aux_buf });
                plan.push((l.uid, l.blend.index() as u32, flags, l.opacity));
            }
            if total > COMPOSE_BUDGET {
                comp.bufs.clear();
                return None;
            }
            let (rw, rh) = (x1 - x0, y1 - y0);
            // bandes de lignes : accumulateur d'au plus 2^20 échantillons (16 Mo)
            let rows = ((1usize << 20) / (rw * ns as usize)).clamp(1, rh);
            let dev = &self.device;
            let acc = dev.create_buffer(&wgpu::BufferDescriptor { label: Some("accumulateur"), size: (rows * rw * ns as usize * 16) as u64, usage: wgpu::BufferUsages::STORAGE, mapped_at_creation: false });
            let out = dev.create_buffer(&wgpu::BufferDescriptor { label: Some("affichage"), size: (rows * rw * 4) as u64, usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC, mapped_at_creation: false });
            let read = dev.create_buffer(&wgpu::BufferDescriptor { label: None, size: (rw * rh * 4) as u64, usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST, mapped_at_creation: false });
            let dummy = dev.create_buffer(&wgpu::BufferDescriptor { label: None, size: 16, usage: wgpu::BufferUsages::STORAGE, mapped_at_creation: false });
            let uniform = |by: usize, bh: usize, blend: u32, flags: u32, opacity: f32| {
                let vals = [w as u32, h as u32, ds as u32, ns, x0 as u32, by as u32, rw as u32, bh as u32, blend, flags];
                let mut u = [0u8; 64];
                for (k, v) in vals.iter().enumerate() {
                    u[k * 4..k * 4 + 4].copy_from_slice(&v.to_le_bytes());
                }
                u[40..44].copy_from_slice(&opacity.to_le_bytes());
                for (k, v) in [off0, off1, checker as u32].iter().enumerate() {
                    u[44 + k * 4..48 + k * 4].copy_from_slice(&v.to_le_bytes());
                }
                dev.create_buffer_init(&wgpu::util::BufferInitDescriptor { label: None, contents: &u, usage: wgpu::BufferUsages::UNIFORM })
            };
            let bind = |ub: &wgpu::Buffer, a: &wgpu::Buffer, b: &wgpu::Buffer, d: &wgpu::Buffer| {
                dev.create_bind_group(&wgpu::BindGroupDescriptor {
                    label: None,
                    layout: &self.layout,
                    entries: &[
                        wgpu::BindGroupEntry { binding: 0, resource: ub.as_entire_binding() },
                        wgpu::BindGroupEntry { binding: 1, resource: a.as_entire_binding() },
                        wgpu::BindGroupEntry { binding: 2, resource: b.as_entire_binding() },
                        wgpu::BindGroupEntry { binding: 3, resource: d.as_entire_binding() },
                    ],
                })
            };
            let mut enc = dev.create_command_encoder(&Default::default());
            let mut by = y0;
            while by < y1 {
                let bh = rows.min(y1 - by);
                let samples = (rw * bh) as u32 * ns;
                for &(uid, blend, flags, opacity) in &plan {
                    let lb = &comp.bufs[&uid];
                    let ub = uniform(by, bh, blend, flags, opacity);
                    let bg = bind(&ub, &lb.buf, lb.aux.as_ref().unwrap_or(&dummy), &acc);
                    let mut cp = enc.begin_compute_pass(&Default::default());
                    cp.set_pipeline(&comp.layer);
                    cp.set_bind_group(0, &bg, &[]);
                    cp.dispatch_workgroups(samples.div_ceil(256), 1, 1);
                }
                let ub = uniform(by, bh, 0, 0, 1.0);
                let bg = bind(&ub, &acc, &dummy, &out);
                {
                    let mut cp = enc.begin_compute_pass(&Default::default());
                    cp.set_pipeline(&comp.resolve);
                    cp.set_bind_group(0, &bg, &[]);
                    cp.dispatch_workgroups(((rw * bh) as u32).div_ceil(256), 1, 1);
                }
                enc.copy_buffer_to_buffer(&out, 0, &read, ((by - y0) * rw * 4) as u64, (bh * rw * 4) as u64);
                by += bh;
            }
            self.queue.submit([enc.finish()]);
            Some(ViewJob { read, w: rw, h: rh })
        })
    }

    /// Résultat d'une composition (bureau : attendu sur place).
    #[cfg(not(target_arch = "wasm32"))]
    pub fn compose_wait(&self, job: ViewJob) -> Option<Vec<u8>> {
        self.read_back(job.read)
    }

    /// Résultat d'une composition (navigateur : asynchrone, la page ne se fige pas).
    #[cfg(target_arch = "wasm32")]
    pub async fn compose_wait(&self, job: ViewJob) -> Option<Vec<u8>> {
        self.read_back(job.read).await
    }
}

/// Oublie les calques gardés sur la carte graphique (accélération coupée dans les Paramètres).
pub fn compose_forget() {
    COMPOSER.with(|c| *c.borrow_mut() = None);
}

// ------------------------------------------------------------------ accès global

#[cfg(not(target_arch = "wasm32"))]
static GPU: std::sync::OnceLock<Option<std::sync::Arc<Gpu>>> = std::sync::OnceLock::new();

/// Bureau : carte graphique ouverte au premier appel (None si absente ou désactivée par
/// MASTERPAINT_GPU=0).
#[cfg(not(target_arch = "wasm32"))]
pub fn get() -> Option<std::sync::Arc<Gpu>> {
    GPU.get_or_init(|| {
        if std::env::var("MASTERPAINT_GPU").is_ok_and(|v| v == "0") {
            return None;
        }
        pollster::block_on(Gpu::new()).map(std::sync::Arc::new)
    })
    .clone()
}

#[cfg(target_arch = "wasm32")]
thread_local! {
    static GPU: std::cell::RefCell<Option<std::rc::Rc<Gpu>>> = const { std::cell::RefCell::new(None) };
}

/// Navigateur : carte graphique (WebGPU) si l'initialisation asynchrone a abouti.
#[cfg(target_arch = "wasm32")]
pub fn get() -> Option<std::rc::Rc<Gpu>> {
    GPU.with(|g| g.borrow().clone())
}

/// Navigateur : ouvre WebGPU en arrière-plan ; `done` reçoit le nom de la carte (ou None).
#[cfg(target_arch = "wasm32")]
pub fn init(done: impl FnOnce(Option<String>) + 'static) {
    wasm_bindgen_futures::spawn_local(async move {
        let g = Gpu::new().await.map(std::rc::Rc::new);
        let name = g.as_ref().map(|g| g.name.clone());
        GPU.with(|s| *s.borrow_mut() = g);
        done(name);
    });
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    /// La carte graphique doit donner le même résultat que le moteur CPU (à 1 niveau près).
    /// Ignoré sans carte graphique (cargo test gpu_matches_cpu -- --nocapture).
    #[test]
    fn gpu_matches_cpu() {
        let Some(g) = super::get() else {
            println!("pas de carte graphique : test ignoré");
            return;
        };
        let (w, h) = (97usize, 61usize);
        let img: Vec<u8> = (0..w * h * 4).map(|i| if i % 4 == 3 { ((i / 4) * 7 % 256) as u8 } else { ((i * 2654435761usize) >> 13) as u8 }).collect();
        for typ in 0..13 {
            for rad in [1.0f32, 6.0, 17.0] {
                let mut cpu = img.clone();
                cpu = masterpaint_core::apply_image("dynstage", &cpu, w, h, &[typ as f32, rad]).unwrap();
                let gpu = g.run_stack(&img, w, h, &[(typ, rad)]).expect("calcul GPU");
                if typ == 4 {
                    // trame : seuil binaire, quelques pixels limites peuvent basculer (sin en 32 bits)
                    let diff = cpu.chunks(4).zip(gpu.chunks(4)).filter(|(a, b)| a != b).count();
                    assert!(diff * 50 < w * h, "trame rayon {rad} : {diff} pixels différents");
                    continue;
                }
                let worst = cpu.iter().zip(&gpu).map(|(a, b)| (*a as i32 - *b as i32).abs()).max().unwrap();
                assert!(worst <= 1, "type {typ} rayon {rad} : écart {worst} ({})", g.name);
            }
        }
        println!("GPU = CPU sur {} : 13 types × 3 rayons", g.name);
    }

    /// Vitesse : chaîne flou + flou large + netteté sur 4000×3000 (cargo test --release gpu_bench -- --ignored --nocapture).
    #[test]
    #[ignore]
    fn gpu_bench() {
        let (w, h) = (4000usize, 3000usize);
        let img: Vec<u8> = (0..w * h * 4).map(|i| ((i * 2654435761usize) >> 13) as u8).collect();
        let stack = [(0, 16.0), (1, 10.0), (2, 4.0)];
        let t = std::time::Instant::now();
        let _ = crate::editor::cpu_stack(&img, w, h, &stack);
        let cpu = t.elapsed().as_secs_f64() * 1000.0;
        let Some(g) = super::get() else { return };
        let _ = g.run_stack(&img, w, h, &stack);
        let t = std::time::Instant::now();
        let _ = g.run_stack(&img, w, h, &stack);
        let gpu = t.elapsed().as_secs_f64() * 1000.0;
        println!("4000×3000, 3 effets : CPU {cpu:.0} ms, GPU {gpu:.0} ms ({})", g.name);
    }
}
