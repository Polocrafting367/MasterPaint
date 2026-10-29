//! Interface WebAssembly (exports C) + allocateur à pile.
//!
//! Le module est lié par `rust/tools/wasm_objlink.py`, qui laisse la mémoire importée :
//! le JS la crée, fixe `__stack_pointer`, puis appelle `mp_heap_init(base)`.
//! Les allocations Rust (`Vec`) passent par les imports `__rust_alloc*`, que le JS
//! redirige vers `mp_alloc` / `mp_dealloc` / `mp_realloc` ci-dessous.

use crate::{apply, Img, Out, EFFECTS, P};
use core::arch::wasm32;

static mut HEAP_BASE: usize = 0;
static mut HEAP_TOP: usize = 0;
/// Dernier bloc alloué (pour libérer / agrandir en place).
static mut LAST_PTR: usize = 0;

#[inline]
fn align_up(v: usize, a: usize) -> usize {
    let a = a.max(8);
    (v + a - 1) & !(a - 1)
}

unsafe fn ensure(end: usize) -> bool {
    let have = wasm32::memory_size(0) * 65536;
    if end <= have {
        return true;
    }
    let pages = (end - have).div_ceil(65536);
    wasm32::memory_grow(0, pages) != usize::MAX
}

#[no_mangle]
pub unsafe extern "C" fn mp_heap_init(base: usize) {
    HEAP_BASE = align_up(base, 16);
    HEAP_TOP = HEAP_BASE;
    LAST_PTR = 0;
}

/// Position actuelle du tas (pour `mp_heap_reset`).
#[no_mangle]
pub unsafe extern "C" fn mp_heap_mark() -> usize {
    HEAP_TOP
}

/// Libère tout ce qui a été alloué après `mark`.
#[no_mangle]
pub unsafe extern "C" fn mp_heap_reset(mark: usize) {
    HEAP_TOP = mark.max(HEAP_BASE);
    LAST_PTR = 0;
}

#[no_mangle]
pub unsafe extern "C" fn mp_alloc(size: usize, align: usize) -> *mut u8 {
    let p = align_up(HEAP_TOP, align);
    let end = p + size.max(1);
    if !ensure(end) {
        return core::ptr::null_mut();
    }
    HEAP_TOP = end;
    LAST_PTR = p;
    p as *mut u8
}

#[no_mangle]
pub unsafe extern "C" fn mp_alloc_zeroed(size: usize, align: usize) -> *mut u8 {
    let p = mp_alloc(size, align);
    if !p.is_null() {
        core::ptr::write_bytes(p, 0, size);
    }
    p
}

#[no_mangle]
pub unsafe extern "C" fn mp_dealloc(ptr: *mut u8, _size: usize, _align: usize) {
    if ptr as usize == LAST_PTR && LAST_PTR != 0 {
        HEAP_TOP = LAST_PTR;
        LAST_PTR = 0;
    }
}

#[no_mangle]
pub unsafe extern "C" fn mp_realloc(ptr: *mut u8, old: usize, align: usize, new: usize) -> *mut u8 {
    if ptr as usize == LAST_PTR && LAST_PTR != 0 {
        let end = LAST_PTR + new.max(1);
        if !ensure(end) {
            return core::ptr::null_mut();
        }
        HEAP_TOP = end;
        return ptr;
    }
    let np = mp_alloc(new, align);
    if !np.is_null() {
        core::ptr::copy_nonoverlapping(ptr, np, old.min(new));
    }
    np
}

#[no_mangle]
pub extern "C" fn mp_version() -> u32 {
    // 0.1.0
    100
}

#[no_mangle]
pub extern "C" fn mp_effect_count() -> u32 {
    EFFECTS.len() as u32
}

#[no_mangle]
pub extern "C" fn mp_effect_name_ptr(i: u32) -> *const u8 {
    EFFECTS.get(i as usize).map(|s| s.as_ptr()).unwrap_or(core::ptr::null())
}

#[no_mangle]
pub extern "C" fn mp_effect_name_len(i: u32) -> u32 {
    EFFECTS.get(i as usize).map(|s| s.len() as u32).unwrap_or(0)
}

/// Région d'un outil (pot de peinture, baguette magique) → masque w×h (1 = dedans).
/// * `flags` : bit 0 = zone contiguë ; bit 1 = peindre `fill_rgba` (0xAABBGGRR) dans `src` ;
///   `rule` : 0 baguette, 1 pot (voir `region.rs`) ;
/// * `clip` : masque de sélection w×h (0 = interdit), pointeur nul si pas de sélection ;
/// * `x0..y1` : cadre autorisé, bornes incluses.
/// Retourne le nombre de pixels de la région.
#[no_mangle]
pub unsafe extern "C" fn mp_region(src: *mut u8, clip: *const u8, out: *mut u8, w: u32, h: u32, sx: u32, sy: u32, flags: u32, rule: u32, tol: f32, x0: u32, y0: u32, x1: u32, y1: u32, fill_rgba: u32) -> u32 {
    let (w, h) = (w as usize, h as usize);
    let n = w * h;
    let count = mp_region_mask(src, clip, out, w, h, sx, sy, flags, rule, tol, [x0, y0, x1, y1]);
    if flags & 2 != 0 && count > 0 {
        let c = fill_rgba.to_le_bytes();
        crate::region::fill_mask(core::slice::from_raw_parts_mut(src, n * 4), core::slice::from_raw_parts(out, n), c);
    }
    count as u32
}

unsafe fn mp_region_mask(src: *const u8, clip: *const u8, out: *mut u8, w: usize, h: usize, sx: u32, sy: u32, flags: u32, rule: u32, tol: f32, b: [u32; 4]) -> usize {
    let n = w * h;
    let [x0, y0, x1, y1] = b;
    let args = crate::region::RegionArgs {
        src: core::slice::from_raw_parts(src, n * 4),
        w,
        h,
        sx: sx as usize,
        sy: sy as usize,
        contiguous: flags & 1 != 0,
        rule,
        tol,
        clip: if clip.is_null() { None } else { Some(core::slice::from_raw_parts(clip, n)) },
        bounds: [x0 as usize, y0 as usize, x1 as usize, y1 as usize],
    };
    crate::region::region(&args, core::slice::from_raw_parts_mut(out, n))
}

/// Applique l'effet `id`.
/// * `src` : image complète w×h RGBA ; `dst` : sortie pour les lignes [y0,y1) seulement
///   (taille (y1-y0)*w*4) ; `params` : `n` flottants.
/// Retourne 1 si l'effet a été appliqué, 0 sinon.
#[no_mangle]
pub unsafe extern "C" fn mp_apply(id: u32, src: *const u8, dst: *mut u8, w: u32, h: u32, y0: u32, y1: u32, params: *const f32, n: u32) -> u32 {
    let (w, h) = (w as usize, h as usize);
    let y1 = (y1 as usize).min(h);
    let y0 = (y0 as usize).min(y1);
    let img = Img { d: core::slice::from_raw_parts(src, w * h * 4), w, h };
    let out = core::slice::from_raw_parts_mut(dst, (y1 - y0) * w * 4);
    let mut o = Out { d: out, base: y0 * w * 4 };
    let p = if n == 0 || params.is_null() { P(&[]) } else { P(core::slice::from_raw_parts(params, n as usize)) };
    apply(id, &img, &mut o, y0, y1, &p) as u32
}
