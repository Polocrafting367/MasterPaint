// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Display-only checkerboard and startup color preferences. The image keeps its alpha;
//! the screen-sized checker image is clipped behind it, so zoom cannot enlarge the checker cells.
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
    follow_theme(app, app.global::<Theme>().get_dark());
}

/// Damier par défaut du thème clair (Paint.NET, Photoshop) et du thème sombre.
const CHECKER_LIGHT: (u32, u32) = (0xffffff, 0xcccccc);
const CHECKER_DARK: (u32, u32) = (0x5c5c5c, 0x484848);

/// Changement clair / sombre : le fond de la zone de travail (s'il n'a pas été choisi) et le
/// damier (s'il a ses couleurs par défaut) suivent le thème, y compris dans la maquette des
/// Paramètres — avant, ils gardaient les couleurs claires en mode sombre.
pub fn follow_theme(app: &AppWindow, dark: bool) {
    let mut colors: Vec<Color> = app.get_appearance_colors().iter().collect();
    if colors.len() < 5 {
        return;
    }
    let val = |c: Color| (c.red() as u32) << 16 | (c.green() as u32) << 8 | c.blue() as u32;
    let mut changed = false;
    let ws = app.global::<Theme>().get_workspace_bg();
    if !app.get_workspace_custom() && val(colors[2]) != val(ws) {
        colors[2] = ws;
        changed = true;
    }
    let pair = (val(colors[0]), val(colors[1]));
    if pair == CHECKER_LIGHT || pair == CHECKER_DARK {
        let want = if dark { CHECKER_DARK } else { CHECKER_LIGHT };
        if pair != want {
            colors[0] = rgb(want.0);
            colors[1] = rgb(want.1);
            changed = true;
        }
    }
    if changed {
        set_colors(app, colors);
        render(app);
    }
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
    // pixels écrits directement : un SVG passe par le décodeur du navigateur sur le web, qui ne
    // suivait pas toujours le changement de taille des cases (aperçu des Paramètres figé)
    let px = |v: u32| [(v >> 16) as u8, (v >> 8) as u8, v as u8, 255u8];
    let (a, b) = (px(light), px(dark));
    let mut buf = slint::SharedPixelBuffer::<slint::Rgba8Pixel>::new(w, h);
    let bytes = buf.make_mut_bytes();
    let row_bytes = w as usize * 4;
    for y in 0..h as usize {
        let row = &mut bytes[y * row_bytes..(y + 1) * row_bytes];
        let odd_row = (y as u32 / cell) % 2 == 1;
        for (x, p) in row.chunks_exact_mut(4).enumerate() {
            let dark_cell = ((x as u32 / cell) % 2 == 1) != odd_row;
            p.copy_from_slice(if dark_cell { &b } else { &a });
        }
    }
    app.set_checker_image(Image::from_rgba8(buf));
    KEY.with(|old| *old.borrow_mut() = Some(key));
}
