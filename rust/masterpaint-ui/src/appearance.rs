//! Display-only checkerboard and startup color preferences. The image keeps its alpha;
//! the screen-sized SVG is clipped behind it, so zoom cannot enlarge the checker cells.
use crate::{settings::Settings, AppWindow, Theme};
use slint::{Color, ComponentHandle, Image, Model, ModelRc, SharedString, VecModel};
use std::cell::RefCell;

thread_local! { static KEY: RefCell<Option<(u32, u32, u32, u32, u32)>> = const { RefCell::new(None) }; }
fn rgb(v: u32) -> Color { Color::from_rgb_u8((v >> 16) as u8, (v >> 8) as u8, v as u8) }
pub fn color(app: &AppWindow, i: usize) -> Color { app.get_appearance_colors().row_data(i).unwrap_or_else(|| rgb(0)) }
pub fn color_value(app: &AppWindow, i: usize) -> u32 {
    let c = color(app, i); (c.red() as u32) << 16 | (c.green() as u32) << 8 | c.blue() as u32
}
fn set_colors(app: &AppWindow, colors: Vec<Color>) {
    let hex: Vec<SharedString> = colors.iter().map(|c| format!("#{:02X}{:02X}{:02X}", c.red(), c.green(), c.blue()).into()).collect();
    app.set_appearance_colors(ModelRc::new(VecModel::from(colors)));
    app.set_appearance_hex(ModelRc::new(VecModel::from(hex)));
}
pub fn initialize(app: &AppWindow, cfg: &Settings) {
    let surface = app.global::<Theme>().get_workspace_bg();
    set_colors(app, vec![rgb(cfg.checker_light), rgb(cfg.checker_dark), cfg.workspace_color.map(rgb).unwrap_or(surface), rgb(cfg.default_primary), rgb(cfg.default_secondary)]);
    app.set_workspace_custom(cfg.workspace_color.is_some());
    app.set_checker_size(cfg.checker_size as f32);
    KEY.with(|key| *key.borrow_mut() = None);
    render(app);
}
pub fn edit(app: &AppWindow, index: i32, text: &str) -> bool {
    let text = text.trim().trim_start_matches('#');
    if !(0..5).contains(&index) || text.len() != 6 { return false; }
    let Ok(value) = u32::from_str_radix(text, 16) else { return false };
    let mut colors: Vec<_> = app.get_appearance_colors().iter().collect();
    colors[index as usize] = rgb(value);
    set_colors(app, colors);
    if index == 2 { app.set_workspace_custom(true); }
    render(app);
    true
}
pub fn pick(app: &AppWindow, index: i32, value: Color) {
    if !(0..5).contains(&index) { return; }
    let mut colors: Vec<_> = app.get_appearance_colors().iter().collect();
    colors[index as usize] = value;
    set_colors(app, colors);
    if index == 2 { app.set_workspace_custom(true); }
    render(app);
}
pub fn render(app: &AppWindow) {
    let (w, h) = (app.get_checker_view_w().ceil().max(1.0) as u32, app.get_checker_view_h().ceil().max(1.0) as u32);
    let cell = app.get_checker_size().round().clamp(2.0, 32.0) as u32;
    let (light, dark) = (color_value(app, 0), color_value(app, 1));
    let key = (w, h, cell, light, dark);
    if KEY.with(|old| *old.borrow() == Some(key)) { return; }
    let double = cell * 2;
    let svg = format!(r##"<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs><pattern id="c" width="{double}" height="{double}" patternUnits="userSpaceOnUse"><rect width="{double}" height="{double}" fill="#{light:06x}"/><path d="M0 0H{cell}V{cell}H0ZM{cell} {cell}H{double}V{double}H{cell}Z" fill="#{dark:06x}"/></pattern></defs><rect width="100%" height="100%" fill="url(#c)"/></svg>"##);
    if let Ok(image) = Image::load_from_svg_data(svg.as_bytes()) {
        app.set_checker_image(image);
        KEY.with(|old| *old.borrow_mut() = Some(key));
    }
}
