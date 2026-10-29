//! Calcul des jetons du thème : teintes de l'accent (≈ color-mix CSS) et palette sombre.
//! Un thème personnalisé se résume à un autre appel de [`apply`] (ou à d'autres valeurs).

use crate::{icons_gen::ICONS, AppWindow, Icons, Theme};
use slint::{Color, ComponentHandle, Image, ModelRc, VecModel};

fn rgb(hex: u32) -> Color {
    Color::from_rgb_u8((hex >> 16) as u8, (hex >> 8) as u8, hex as u8)
}

/// `p` d'accent mélangé au fond `base` (comme `color-mix(in srgb, accent p%, base)`).
fn mix(accent: Color, base: Color, p: f32) -> Color {
    let m = |a: u8, b: u8| (a as f32 * p + b as f32 * (1.0 - p)).round() as u8;
    Color::from_rgb_u8(m(accent.red(), base.red()), m(accent.green(), base.green()), m(accent.blue(), base.blue()))
}

fn hex(c: Color) -> String {
    format!("#{:02x}{:02x}{:02x}", c.red(), c.green(), c.blue())
}

/// Couleurs des icônes SVG (trait, accent, accent atténué, fond), comme les variables CSS
/// --illu-icon-stroke / --illu-icon-accent / --illu-icon-accent-subtle / --illu-icon-bg. En
/// sombre, trait gris clair plutôt que blanc (sinon les icônes paraissent cernées de blanc) ;
/// fond = vraie surface des fenêtres.
fn icon_colors(dark: bool, accent: Color) -> (String, String, String, String) {
    let white = rgb(0xffffff);
    let bg = if dark { rgb(0x2e2e2e) } else { rgb(0xf0f0f0) };
    let stroke = if dark { "#d4d4d4".to_string() } else { "#1a1a1a".to_string() };
    let acc = hex(mix(accent, white, if dark { 0.62 } else { 0.78 }));
    let subtle = hex(mix(accent, bg, 0.42));
    (stroke, acc, subtle, hex(bg))
}

/// Icônes maison (style du sprite : mêmes marqueurs, mêmes couleurs que le sprite).
fn mp_images(stroke: &str, acc: &str, subtle: &str, bg: &str) -> Vec<Image> {
    crate::mpicons_gen::MP_ICONS
        .iter()
        .map(|(_, tpl)| {
            let svg = tpl.replace("{STROKE}", stroke).replace("{ACCENT}", acc).replace("{SUBTLE}", subtle).replace("{BG}", bg);
            Image::load_from_svg_data(svg.as_bytes()).unwrap_or_default()
        })
        .collect()
}

thread_local! {
    /// couleurs des icônes déjà rendues (sombre, accent) : rien à refaire si elles n'ont pas
    /// changé (arrondis, translucidité, style… appellent aussi `apply`)
    static ICON_KEY: std::cell::Cell<Option<(bool, u32)>> = const { std::cell::Cell::new(None) };
}

/// Rend les icônes du sprite aux couleurs du thème (seulement si ces couleurs ont changé).
fn render_icons(app: &AppWindow, dark: bool, accent: Color) {
    let key = (dark, (accent.red() as u32) << 16 | (accent.green() as u32) << 8 | accent.blue() as u32);
    if ICON_KEY.with(|k| k.replace(Some(key))) == Some(key) {
        return;
    }
    let (stroke, acc, subtle, bgs) = icon_colors(dark, accent);
    let images: Vec<Image> = ICONS
        .iter()
        .map(|tpl| {
            let svg = tpl.replace("{STROKE}", &stroke).replace("{ACCENT}", &acc).replace("{SUBTLE}", &subtle).replace("{BG}", &bgs);
            Image::load_from_svg_data(svg.as_bytes()).unwrap_or_default()
        })
        .collect();
    app.global::<Icons>().set_images(ModelRc::new(VecModel::from(images)));
    // sprite complet de MasterPaint (ruban, menus, calques…)
    let sprite: Vec<Image> = crate::sprite_gen::SPRITE
        .iter()
        .map(|(_, tpl)| {
            let svg = tpl.replace("{STROKE}", &stroke).replace("{ACCENT}", &acc).replace("{SUBTLE}", &subtle).replace("{BG}", &bgs);
            Image::load_from_svg_data(svg.as_bytes()).unwrap_or_default()
        })
        .collect();
    crate::sprite_gen::apply(&app.global::<crate::Sprite>(), sprite);
    // icônes maison (outils, barre rapide, ruban, menus) : rendues à la taille d'affichage
    app.global::<crate::MpIcons>().set_images(ModelRc::new(VecModel::from(mp_images(&stroke, &acc, &subtle, &bgs))));
}

/// Icônes du sprite aux couleurs courantes du thème, avec leur nom (Visionneuse d'icônes).
pub fn icon_entries(app: &AppWindow) -> Vec<crate::IconEntry> {
    let t = app.global::<Theme>();
    let (dark, accent) = (t.get_dark(), t.get_accent());
    let (stroke, acc, subtle, bgs) = icon_colors(dark, accent);
    // icônes maison d'abord (outils, menus), puis le sprite
    let mp = crate::mpicons_gen::MP_ICONS
        .iter()
        .zip(mp_images(&stroke, &acc, &subtle, &bgs))
        .map(|((name, _), image)| crate::IconEntry { name: (*name).into(), image });
    mp.chain(crate::sprite_gen::SPRITE.iter().map(|(name, tpl)| {
        let svg = tpl.replace("{STROKE}", &stroke).replace("{ACCENT}", &acc).replace("{SUBTLE}", &subtle).replace("{BG}", &bgs);
        crate::IconEntry { name: (*name).into(), image: Image::load_from_svg_data(svg.as_bytes()).unwrap_or_default() }
    }))
    .collect()
}

/// Applique le thème : sombre ou clair, accent, et style (Paramètres › Thème d'interface :
/// 0 Flat Design, 1 Windows 98).
pub fn apply(app: &AppWindow, dark: bool, accent: Color) {
    render_icons(app, dark, accent);
    let t = app.global::<Theme>();
    let win98 = app.get_set_theme_style() == 1;
    // Paramètres › Apparence : coins arrondis et barre de titre translucide (Windows 11)
    let round = !win98 && app.get_set_rounded();
    t.set_win98(win98);
    t.set_glass(!win98 && app.get_set_glass());
    t.set_window_radius(if round { 8.0 } else { 0.0 });
    t.set_ctl_radius(if round { 5.0 } else { 0.0 });
    t.set_title_height(if win98 { 24.0 } else { 26.0 });
    // Segoe UI n'existe que sous Windows : ailleurs (web, Linux, macOS), Selawik, intégrée
    // (mêmes métriques, licence libre), plutôt qu'une police de repli du système
    #[cfg(not(windows))]
    t.set_font("Selawik".into());
    t.set_dark(dark);
    t.set_accent(accent);
    let base = if dark { rgb(0x2b2b2b) } else { rgb(0xffffff) };
    t.set_accent_12(mix(accent, base, 0.12));
    t.set_accent_14(mix(accent, base, 0.14));
    t.set_accent_20(mix(accent, base, 0.20));
    t.set_accent_27(mix(accent, base, 0.27));
    t.set_accent_32(mix(accent, base, 0.32));
    t.set_accent_60(mix(accent, base, 0.60));
    // texte sur l'accent : blanc sauf accent très clair
    let lum = 0.2126 * accent.red() as f32 + 0.7152 * accent.green() as f32 + 0.0722 * accent.blue() as f32;
    t.set_on_accent(if lum > 170.0 { rgb(0x000000) } else { rgb(0xffffff) });

    // paliers de surfaces distincts (barre de menus < ruban < fenêtres, listes en creux, pied
    // des dialogues un peu plus clair) : menus, ruban et fenêtres ne se confondent plus
    if dark {
        t.set_menubar_bg(rgb(0x232323));
        t.set_ribbon_bg(rgb(0x2b2b2b));
        t.set_ribbon_fg(rgb(0xf0f0f0));
        t.set_ribbon_label(rgb(0xb0b0b0));
        t.set_ribbon_sep(rgb(0x4f4f4f));
        t.set_workspace_bg(rgb(0x171717));
        t.set_window_bg(rgb(0x2e2e2e));
        // barre de titre des fenêtres : une pointe (6 %) de la couleur d'accentuation
        t.set_window_title_bg(mix(accent, rgb(0x232323), 0.06));
        t.set_window_border(rgb(0x4a4a4a));
        t.set_window_shadow(Color::from_argb_u8(0x80, 0, 0, 0));
        t.set_text(rgb(0xf3f3f3));
        t.set_text_inactive(rgb(0x8a8a8a));
        t.set_statusbar_bg(rgb(0x1c1c1c));
        t.set_statusbar_border(rgb(0x383838));
        t.set_list_bg(rgb(0x262626));
        t.set_footer_bg(rgb(0x363636));
        t.set_menu_bg(rgb(0x232323));
        t.set_menu_gutter(rgb(0x2b2b2b));
        t.set_button_bg(rgb(0x383838));
        t.set_button_border(rgb(0x555555));
        t.set_field_bg(rgb(0x1f1f1f));
        t.set_field_border(rgb(0x6a6a6a));
        t.set_track_bg(rgb(0x5a5a5a));
        t.set_track_border(rgb(0x5a5a5a));
    } else {
        t.set_menubar_bg(rgb(0xf3f3f3));
        t.set_ribbon_bg(rgb(0xffffff));
        t.set_ribbon_fg(rgb(0x242424));
        t.set_ribbon_label(rgb(0x616161));
        t.set_ribbon_sep(rgb(0xc8c6c4));
        t.set_workspace_bg(rgb(0xcfcfcf));
        t.set_window_bg(rgb(0xf0f0f0));
        t.set_window_title_bg(mix(accent, rgb(0xe9e9e9), 0.06));
        t.set_window_border(rgb(0xc6c6c6));
        t.set_window_shadow(Color::from_argb_u8(0x40, 0, 0, 0));
        t.set_text(rgb(0x000000));
        t.set_text_inactive(rgb(0x7a7a7a));
        t.set_statusbar_bg(rgb(0xf0f0f0));
        t.set_statusbar_border(rgb(0xd4d4d4));
        t.set_list_bg(rgb(0xfafafa));
        t.set_footer_bg(rgb(0xf9f9f9));
        t.set_menu_bg(rgb(0xffffff));
        t.set_menu_gutter(rgb(0xf2f2f2));
        t.set_button_bg(rgb(0xfdfdfd));
        t.set_button_border(rgb(0xd0d0d0));
        t.set_field_bg(rgb(0xffffff));
        t.set_field_border(rgb(0xadadad));
        t.set_track_bg(rgb(0xe1e1e1));
        t.set_track_border(rgb(0xd6d6d6));
    }
    // mode téléphone (theme-mobile-modern.css) : surfaces, cartes, accent foncé de la barre du haut
    let alpha = |c: Color, a: f32| Color::from_argb_u8((a * 255.0).round() as u8, c.red(), c.green(), c.blue());
    if dark {
        t.set_mob_surface(rgb(0x1c1c1e));
        t.set_mob_surface_deep(rgb(0x2c2c2e));
        t.set_mob_card(Color::from_argb_u8(217, 44, 44, 46));
        t.set_mob_text(rgb(0xf2f2f7));
        t.set_mob_muted(rgb(0x98989f));
        t.set_mob_divider(Color::from_argb_u8(23, 255, 255, 255));
        t.set_mob_accent_tint(alpha(accent, 0.18));
        t.set_mob_accent_pill(alpha(accent, 0.22));
        t.set_mob_capsule(mix(accent, rgb(0x1c1c1e), 0.08));
    } else {
        t.set_mob_surface(rgb(0xf2f2f7));
        t.set_mob_surface_deep(rgb(0xe5e5ea));
        t.set_mob_card(Color::from_argb_u8(204, 255, 255, 255));
        t.set_mob_text(rgb(0x1a1a1a));
        t.set_mob_muted(rgb(0x6e6e73));
        t.set_mob_divider(Color::from_argb_u8(20, 0, 0, 0));
        t.set_mob_accent_tint(alpha(accent, 0.12));
        t.set_mob_accent_pill(alpha(accent, 0.14));
        t.set_mob_capsule(mix(accent, rgb(0xffffff), 0.06));
    }
    t.set_mob_accent_dark(mix(accent, rgb(0x000000), 0.62));
    if win98 {
        // Windows 98 (98.css) : surfaces argentées, reliefs 3D, barre de titre en dégradé de l'accent
        let (face, hi, lo, dk, fld, txt, ws) = if dark {
            (rgb(0x3c3c3c), rgb(0x6a6a6a), rgb(0x232323), rgb(0x000000), rgb(0x1e1e1e), rgb(0xf0f0f0), rgb(0x2a2a2a))
        } else {
            (rgb(0xc0c0c0), rgb(0xffffff), rgb(0x808080), rgb(0x0a0a0a), rgb(0xffffff), rgb(0x000000), rgb(0x808080))
        };
        for set in [Theme::set_menubar_bg, Theme::set_ribbon_bg, Theme::set_window_bg, Theme::set_statusbar_bg, Theme::set_list_bg, Theme::set_button_bg, Theme::set_window_title_bg, Theme::set_footer_bg, Theme::set_menu_bg, Theme::set_menu_gutter] {
            set(&t, face);
        }
        t.set_workspace_bg(ws);
        t.set_text(txt);
        t.set_ribbon_fg(txt);
        t.set_ribbon_label(if dark { rgb(0xc0c0c0) } else { rgb(0x404040) });
        t.set_field_bg(fld);
        t.set_field_border(lo);
        t.set_button_border(lo);
        t.set_window_border(lo);
        t.set_statusbar_border(lo);
        t.set_ribbon_sep(lo);
        t.set_track_bg(fld);
        t.set_track_border(lo);
        t.set_bevel_hi(hi);
        t.set_bevel_lo(lo);
        t.set_bevel_dk(dk);
        t.set_title_a(mix(accent, rgb(0x000000), 0.75));
        t.set_title_b(mix(accent, rgb(0xffffff), 0.65));
        t.set_title_fg(rgb(0xffffff));
        // survols et lignes actives : sur fond argent, la teinte d'accent reste lisible
        t.set_accent_12(mix(accent, face, 0.18));
        t.set_accent_14(mix(accent, face, 0.22));
    }
}
