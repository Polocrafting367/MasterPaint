// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Pen data stays separate from mouse/touch coordinates: unsupported devices keep
//! the ordinary brush size, while hardware pressure is normalized to 0..1.
use std::cell::Cell;
#[derive(Clone, Copy, Debug)]
pub struct Sample { pub pressure: f32, pub eraser: bool }
impl Default for Sample { fn default() -> Self { Self { pressure: 1.0, eraser: false } } }
thread_local! { static NATIVE: Cell<Sample> = Cell::new(Sample::default()); }
#[cfg(not(target_arch = "wasm32"))]
pub fn native(pressure: Option<f64>) {
    NATIVE.with(|s| s.set(Sample { pressure: pressure.filter(|v| v.is_finite()).map(|v| v.clamp(0.0, 1.0) as f32).unwrap_or(1.0), eraser: false }));
}
#[cfg(target_os = "android")]
static ANDROID_PRESSURE: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1f32.to_bits());
#[cfg(target_os = "android")]
static ANDROID_PEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[cfg(target_os = "android")]
static ANDROID_ERASER: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);
#[cfg(target_os = "android")]
pub fn hardware(pressure: f32, pen: bool, eraser: bool) {
    use std::sync::atomic::Ordering::Relaxed;
    ANDROID_PRESSURE.store(if pressure.is_finite() { pressure.clamp(0.0, 1.0).to_bits() } else { 1f32.to_bits() }, Relaxed);
    ANDROID_PEN.store(pen, Relaxed);
    ANDROID_ERASER.store(eraser, Relaxed);
}
pub fn current() -> Sample {
    #[cfg(target_arch = "wasm32")]
    {
        let Some(p) = web_sys::window().and_then(|w| js_sys::Reflect::get(&w, &"mpPen".into()).ok()) else { return Sample::default() };
        let get = |k: &str| js_sys::Reflect::get(&p, &k.into()).ok();
        if !get("active").and_then(|v| v.as_bool()).unwrap_or(false) { return Sample::default(); }
        return Sample { pressure: get("pressure").and_then(|v| v.as_f64()).filter(|v| v.is_finite()).unwrap_or(1.0).clamp(0.0, 1.0) as f32,
            eraser: get("eraser").and_then(|v| v.as_bool()).unwrap_or(false) };
    }
    #[cfg(target_os = "android")]
    {
        use std::sync::atomic::Ordering::Relaxed;
        return if ANDROID_PEN.load(Relaxed) { Sample { pressure: f32::from_bits(ANDROID_PRESSURE.load(Relaxed)), eraser: ANDROID_ERASER.load(Relaxed) } } else { Sample::default() };
    }
    #[cfg(all(not(target_arch = "wasm32"), not(target_os = "android")))]
    NATIVE.with(|s| s.get())
}
/// All hardware samples from one browser event, mapped relative to Slint's hit-tested
/// canvas position. UI controls still use Slint's normal pointer routing.
pub fn points(x: f32, y: f32, zoom: f32, scale: f32) -> Vec<(f32, f32, f32)> {
    #[cfg(target_arch = "wasm32")]
    {
        let Some(win) = web_sys::window() else { return vec![] };
        let Ok(pen) = js_sys::Reflect::get(&win, &"mpPen".into()) else { return vec![] };
        let Ok(points) = js_sys::Reflect::get(&pen, &"points".into()) else { return vec![] };
        let _ = js_sys::Reflect::set(&pen, &"points".into(), &js_sys::Array::new());
        let get = |k: &str| js_sys::Reflect::get(&pen, &k.into()).ok().and_then(|v| v.as_f64()).unwrap_or(0.0) as f32;
        let (last_x, last_y) = (get("x"), get("y"));
        let factor = win.device_pixel_ratio() as f32 / (zoom * scale).max(0.001);
        return js_sys::Array::from(&points).iter().filter_map(|p| {
            let a = js_sys::Array::from(&p);
            let (px, py, pressure) = (a.get(0).as_f64()? as f32, a.get(1).as_f64()? as f32, a.get(2).as_f64()? as f32);
            (px.is_finite() && py.is_finite() && pressure.is_finite()).then_some((x + (px - last_x) * factor, y + (py - last_y) * factor, pressure.clamp(0.0, 1.0)))
        }).collect();
    }
    #[cfg(not(target_arch = "wasm32"))]
    { let _ = (x,y,zoom,scale); vec![] }
}
