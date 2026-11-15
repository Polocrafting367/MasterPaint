// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Calcul des jetons du thème : teintes de l'accent (≈ color-mix CSS) et palette sombre.
//! Un thème personnalisé se résume à un autre appel de [`apply`] (ou à d'autres valeurs).

use crate::{icons_gen::ICONS, AppWindow, Icons, Theme};
use slint::{Color, ComponentHandle, Image, ModelRc, Rgba8Pixel, SharedPixelBuffer, VecModel};

fn rgb(hex: u32) -> Color {
    Color::from_rgb_u8((hex >> 16) as u8, (hex >> 8) as u8, hex as u8)
}

// Stable palette identities are saved; display shades adapt to each theme.
const ACCENTS: [u32; 11] = [0xb91c1c, 0xc2410c, 0xa16207, 0x15803d, 0x0f766e,
    0x0078d4, 0x1d4ed8, 0x0f2d5c, 0x4338ca, 0x7e22ce, 0xbe185d];

/// Couleur « #rrggbb » enregistrée ; vide ou « accent » : aucune.
fn parse_hex(s: &str) -> Option<Color> {
    let s = s.trim_start_matches('#');
    (s.len() == 6).then(|| u32::from_str_radix(s, 16).ok()).flatten().map(rgb)
}

/// Même teinte, foncée mais saturée (ruban et volets de 7 en sombre) : une couleur pâle comme le
/// bleu d'Office 2010 (#d9e4f2) devient un bleu acier, au lieu d'un gris.
fn deep_tone(c: Color, value: f32) -> Color {
    let (r, g, b) = (c.red() as f32 / 255.0, c.green() as f32 / 255.0, c.blue() as f32 / 255.0);
    let (mx, mn) = (r.max(g).max(b), r.min(g).min(b));
    let d = mx - mn;
    let h = if d <= 1e-6 { 0.0 } else if mx == r { 60.0 * (((g - b) / d).rem_euclid(6.0)) } else if mx == g { 60.0 * ((b - r) / d + 2.0) } else { 60.0 * ((r - g) / d + 4.0) };
    // gris : reste gris ; teinte pâle : saturation relevée
    let s = if mx <= 1e-6 || d <= 1e-3 { 0.0 } else { (d / mx * 3.0).clamp(0.3, 0.7) };
    let v = value;
    let cc = v * s;
    let x = cc * (1.0 - ((h / 60.0).rem_euclid(2.0) - 1.0).abs());
    let (r1, g1, b1) = match (h / 60.0) as i32 { 0 => (cc, x, 0.0), 1 => (x, cc, 0.0), 2 => (0.0, cc, x), 3 => (0.0, x, cc), 4 => (x, 0.0, cc), _ => (cc, 0.0, x) };
    let m = v - cc;
    let u = |f: f32| ((f + m) * 255.0).round().clamp(0.0, 255.0) as u8;
    Color::from_rgb_u8(u(r1), u(g1), u(b1))
}

fn luminance(c: Color) -> f32 {
    let linear = |v: u8| { let v = v as f32 / 255.0; if v <= 0.04045 { v / 12.92 } else { ((v + 0.055) / 1.055).powf(2.4) } };
    0.2126 * linear(c.red()) + 0.7152 * linear(c.green()) + 0.0722 * linear(c.blue())
}

fn contrast(a: Color, b: Color) -> f32 {
    let (a, b) = (luminance(a), luminance(b));
    (a.max(b) + 0.05) / (a.min(b) + 0.05)
}

fn accent_shade(base: Color, dark: bool) -> Color {
    let surface = rgb(if dark { 0x2e2e2e } else { 0xffffff });
    let end = rgb(if dark { 0xffffff } else { 0x000000 });
    for step in 0..=100 {
        let shade = mix(base, end, 1.0 - step as f32 / 100.0);
        if contrast(shade, surface) >= 4.5 { return shade; }
    }
    end
}

fn palette_accent(c: Color) -> Color {
    let distance = |v: &u32| {
        let v = rgb(*v);
        let d = |a: u8, b: u8| (a as i32 - b as i32).pow(2);
        d(c.red(), v.red()) + d(c.green(), v.green()) + d(c.blue(), v.blue())
    };
    rgb(*ACCENTS.iter().min_by_key(|v| distance(v)).unwrap())
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

/// Icône préparée pour changer de couleurs sans relire son SVG, comme les variables CSS de la
/// version HTML : pour chaque pixel, la part de chaque couleur du thème. Une composition SVG est
/// linéaire en alpha prémultiplié : pixel = fixe + Σ part × couleur, y compris dans les
/// anticrénelages, opacités et dégradés. Changer de teinte ne demande qu'une multiplication.
struct IconMask {
    size: u32,
    /// 8 octets par pixel : parts (trait, accent, atténué, fond), couleur fixe (r, v, b), alpha
    px: Vec<u8>,
}

/// Taille de rendu des icônes (pixels) : les icônes de l'interface font 15 à 24 unités.
fn icon_px(scale: f32) -> u32 {
    if scale > 2.0 { 64 } else { 32 }
}

pub(crate) fn render_tpl(tpl: &str, size: u32, c: [&str; 4]) -> Option<Vec<u8>> {
    let svg = tpl.replace("{STROKE}", c[0]).replace("{ACCENT}", c[1]).replace("{SUBTLE}", c[2]).replace("{BG}", c[3]);
    let tree = resvg::usvg::Tree::from_data(svg.as_bytes(), &resvg::usvg::Options::default()).ok()?;
    let mut pm = tiny_skia::Pixmap::new(size, size)?;
    // proportions gardées, centrée, comme `image-fit: contain`
    let (tw, th) = (tree.size().width(), tree.size().height());
    let k = size as f32 / tw.max(th).max(1e-3);
    let t = tiny_skia::Transform::from_row(k, 0.0, 0.0, k, (size as f32 - tw * k) / 2.0, (size as f32 - th * k) / 2.0);
    resvg::render(&tree, t, &mut pm.as_mut());
    Some(pm.take())
}

fn icon_mask(tpl: &str, size: u32) -> Option<IconMask> {
    let n = (size * size) as usize;
    let mut px = vec![0u8; n * 8];
    if has_literal_color(tpl) {
        // couleurs écrites en dur dans l'icône : un rendu tout noir donne leur part fixe, un rendu
        // par couleur du thème donne la part de celle-ci
        const K: &str = "#000000";
        const W: &str = "#ffffff";
        let base = render_tpl(tpl, size, [K, K, K, K])?;
        for (i, c) in [[W, K, K, K], [K, W, K, K], [K, K, W, K], [K, K, K, W]].into_iter().enumerate() {
            let r = render_tpl(tpl, size, c)?;
            for k in 0..n {
                px[k * 8 + i] = r[k * 4].saturating_sub(base[k * 4]);
            }
        }
        for k in 0..n {
            px[k * 8 + 4..k * 8 + 7].copy_from_slice(&base[k * 4..k * 4 + 3]);
            px[k * 8 + 7] = base[k * 4 + 3];
        }
    } else {
        // cas général, un seul rendu : trait en rouge, accent en vert, atténué en bleu ; le fond
        // est ce qui reste de l'alpha
        let r = render_tpl(tpl, size, ["#ff0000", "#00ff00", "#0000ff", "#000000"])?;
        for k in 0..n {
            let (s, a, u, al) = (r[k * 4], r[k * 4 + 1], r[k * 4 + 2], r[k * 4 + 3]);
            px[k * 8] = s;
            px[k * 8 + 1] = a;
            px[k * 8 + 2] = u;
            px[k * 8 + 3] = al.saturating_sub(s).saturating_sub(a).saturating_sub(u);
            px[k * 8 + 7] = al;
        }
    }
    Some(IconMask { size, px })
}

/// L'icône contient une couleur écrite en dur (hors de ses marqueurs et de ses masques).
fn has_literal_color(tpl: &str) -> bool {
    let b = tpl.as_bytes();
    (0..b.len()).any(|i| {
        b[i] == b'#' && i > 0 && b[i - 1] == b'"' && b[i + 1..].iter().take_while(|c| c.is_ascii_hexdigit()).count() >= 3
    })
}

/// Couleurs d'une teinte, en valeurs : trait, accent, atténué, fond.
fn palette(dark: bool, accent: Color) -> [[u32; 3]; 4] {
    let (stroke, acc, subtle, bg) = icon_colors(dark, accent);
    [stroke, acc, subtle, bg].map(|h| {
        let v = u32::from_str_radix(h.trim_start_matches('#'), 16).unwrap_or(0);
        [v >> 16 & 255, v >> 8 & 255, v & 255]
    })
}

/// Pixels de l'icône aux couleurs données.
fn tint(m: &IconMask, pal: &[[u32; 3]; 4]) -> Image {
    let mut buf = SharedPixelBuffer::<Rgba8Pixel>::new(m.size, m.size);
    for (o, p) in buf.make_mut_bytes().chunks_exact_mut(4).zip(m.px.chunks_exact(8)) {
        if p[7] == 0 {
            continue;
        }
        for c in 0..3 {
            let v = p[0] as u32 * pal[0][c] + p[1] as u32 * pal[1][c] + p[2] as u32 * pal[2][c] + p[3] as u32 * pal[3][c];
            o[c] = ((v + 127) / 255 + p[4 + c] as u32).min(p[7] as u32) as u8;
        }
        o[3] = p[7];
    }
    Image::from_rgba8_premultiplied(buf)
}

thread_local! {
    /// couleurs des icônes déjà appliquées (sombre, accent) : rien à refaire si elles n'ont pas
    /// changé (arrondis, translucidité, style… appellent aussi `apply`)
    static ICON_KEY: std::cell::Cell<Option<(bool, u32, u32)>> = const { std::cell::Cell::new(None) };
    /// icônes préparées (outils, sprite, maison), une seule fois par échelle d'affichage
    static ICON_MASKS: std::cell::RefCell<Option<(u32, Vec<Option<IconMask>>, Vec<Option<IconMask>>, Vec<Option<IconMask>>)>> = const { std::cell::RefCell::new(None) };
    /// glyphes Font Awesome redessinés au style MasterPaint, dans l'ordre de FA_SVG (masques
    /// préparés une fois par taille, puis seulement teintés : pas de rendu SVG à chaque thème)
    static MP_FA_MASKS: std::cell::RefCell<Option<(u32, Vec<Option<IconMask>>)>> = const { std::cell::RefCell::new(None) };
}

/// Donne aux icônes les couleurs du thème : instantané, y compris pendant qu'on fait glisser le
/// sélecteur de couleur (les SVG ne sont lus qu'une fois, au premier affichage).
pub fn invalidate_icons() { ICON_KEY.with(|k| k.set(None)); }

fn render_icons(app: &AppWindow, dark: bool, accent: Color) {
    let rgbkey = |c: Color| (c.red() as u32) << 16 | (c.green() as u32) << 8 | c.blue() as u32;
    let size = icon_px(app.window().scale_factor());
    let key = (dark, rgbkey(accent), size);
    if ICON_KEY.with(|k| k.replace(Some(key))) == Some(key) {
        return;
    }
    let pal = palette(dark, accent);
    let (mut tools, mut sprite, mut mp) = ICON_MASKS.with(|m| {
        let mut m = m.borrow_mut();
        if m.as_ref().is_none_or(|e| e.0 != size) {
            let prep = |tpl: &str| icon_mask(tpl, size);
            *m = Some((
                size,
                ICONS.iter().map(|t| prep(t)).collect(),
                crate::sprite_gen::SPRITE.iter().map(|(_, t)| prep(t)).collect(),
                crate::mpicons_gen::MP_ICONS.iter().map(|(_, t)| prep(t)).collect(),
            ));
        }
        let e = m.as_ref().expect("icônes préparées");
        let set = |v: &Vec<Option<IconMask>>| -> Vec<Image> { v.iter().map(|o| o.as_ref().map_or_else(Image::default, |k| tint(k, &pal))).collect() };
        (set(&e.1), set(&e.2), set(&e.3))
    });
    let (s,a,u,b) = icon_colors(dark, accent);
    let colors = [s.as_str(),a.as_str(),u.as_str(),b.as_str()];
    let override_image = |key: &str| crate::icon_packs::render_override(key,size,colors);
    // pack MasterPaint : glyphes des menus au style maison, teintés depuis leurs masques
    let fa_images: Vec<Image> = if crate::icon_packs::selected() == 0 {
        MP_FA_MASKS.with(|m| {
            let mut m = m.borrow_mut();
            if m.as_ref().is_none_or(|e| e.0 != size) {
                let masks = crate::fa_svg_gen::FA_SVG.iter().map(|(n, _)| crate::mp_fa_gen::MP_FA.iter().find(|(k, _)| k == n).and_then(|(_, t)| icon_mask(t, size))).collect();
                *m = Some((size, masks));
            }
            m.as_ref().expect("masques préparés").1.iter().map(|o| o.as_ref().map_or_else(Image::default, |k| tint(k, &pal))).collect()
        })
    } else {
        crate::fa_svg_gen::FA_SVG.iter().map(|(n,_)| override_image(&format!("fa/{n}")).unwrap_or_default()).collect()
    };
    // remplacements du pack pour les outils : calculés une fois (avant : deux rendus par outil)
    let tool_pack: Vec<Image> = (0..tools.len()).map(|i| override_image(&format!("tool/{i}")).unwrap_or_default()).collect();
    for (img, v) in tools.iter_mut().zip(&tool_pack) { if v.size().width > 0 { *img = v.clone(); } }
    for ((n,_),img) in crate::sprite_gen::SPRITE.iter().zip(&mut sprite) { if let Some(v)=override_image(&format!("sprite/{n}")) { *img=v; } }
    for ((n,_),img) in crate::mpicons_gen::MP_ICONS.iter().zip(&mut mp) { if let Some(v)=override_image(&format!("mp/{n}")) { *img=v; } }
    app.global::<crate::PackIcons>().set_images(ModelRc::new(VecModel::from(fa_images)));
    app.global::<crate::ToolPackIcons>().set_images(ModelRc::new(VecModel::from(tool_pack)));
    app.global::<Icons>().set_images(ModelRc::new(VecModel::from(tools)));
    // sprite complet de MasterPaint (ruban, menus, calques…)
    crate::sprite_gen::apply(&app.global::<crate::Sprite>(), sprite);
    // icônes maison (outils, barre rapide, ruban, menus)
    app.global::<crate::MpIcons>().set_images(ModelRc::new(VecModel::from(mp)));
}

/// Accent de l'aperçu de la visionneuse, nuancé pour le thème voulu.
fn viewer_accent(app: &AppWindow, dark: bool) -> Color {
    accent_shade(palette_accent(app.get_icon_accent()), dark)
}

/// Visionneuse d'icônes : `tab` 0 = icônes MasterPaint (maison puis sprite), 1 = glyphes Font
/// Awesome encore employés sans icône maison ; filtrées par `query` (nom), rendues en sombre
/// (`dark`) ou en clair.
pub fn icon_entries(app: &AppWindow, tab: i32, query: &str, dark: bool) -> Vec<crate::IconEntry> {
    let q = query.trim().to_lowercase();
    let keep = |n: &str| q.is_empty() || n.to_lowercase().contains(&q);
    if tab == 1 {
        let mp = app.global::<crate::MpIcons>();
        return crate::fa_used_gen::FA_USED
            .iter()
            .filter(|(g, n, _)| keep(n) && mp.invoke_for_glyph((*g).into()) < 0)
            .map(|(g, n, st)| crate::IconEntry { name: (*n).into(), image: { let (s,a,u,b)=icon_colors(dark,viewer_accent(app,dark)); crate::icon_packs::render_override(&format!("fa/{n}"),32,[&s,&a,&u,&b]).unwrap_or_default() }, glyph: (*g).into(), brands: *st == "brands", kind: 2 })
            .collect();
    }
    // les icônes telles que compilées, à la teinte choisie
    let pal = palette(dark, viewer_accent(app, dark));
    ICON_MASKS.with(|m| {
        let m = m.borrow();
        let Some((_, _, sprite, mpi)) = m.as_ref() else { return Vec::new() };
        let entry = |name: &str, mask: &Option<IconMask>, kind: i32| crate::IconEntry {
            name: name.into(),
            image: { let (a,b,c,d)=icon_colors(dark,viewer_accent(app,dark)); crate::icon_packs::render_override(&format!("{}/{name}",if kind == 0 {"mp"} else {"sprite"}),32,[&a,&b,&c,&d]).unwrap_or_else(|| mask.as_ref().map_or_else(Image::default, |k| tint(k, &pal))) },
            glyph: "".into(),
            brands: false,
            kind,
        };
        let home = crate::mpicons_gen::MP_ICONS.iter().zip(mpi).filter(|((n, _), _)| keep(n)).map(|((n, _), k)| entry(n, k, 0));
        let list = crate::sprite_gen::SPRITE.iter().zip(sprite).filter(|((n, _), _)| keep(n)).map(|((n, _), k)| entry(n, k, 1));
        home.chain(list).collect()
    })
}

/// Icône choisie dans la visionneuse, nette en grand (aperçu jusqu'à 108 unités).
pub fn icon_big(app: &AppWindow, name: &str, kind: i32, dark: bool) -> Image {
    let (s,a,u,b)=icon_colors(dark,viewer_accent(app,dark));
    if let Some(img)=crate::icon_packs::render_override(&format!("{}/{name}",if kind==0 {"mp"} else if kind==1 {"sprite"} else {"fa"}),216,[&s,&a,&u,&b]) { return img; }
    let tpl = if kind == 0 {
        crate::mpicons_gen::MP_ICONS.iter().find(|(n, _)| *n == name)
    } else {
        crate::sprite_gen::SPRITE.iter().find(|(n, _)| *n == name)
    };
    let Some((_, tpl)) = tpl else { return Image::default() };
    let (s, a, u, b) = icon_colors(dark, viewer_accent(app, dark));
    let size = 216;
    let Some(px) = render_tpl(tpl, size, [&s, &a, &u, &b]) else { return Image::default() };
    let mut buf = SharedPixelBuffer::<Rgba8Pixel>::new(size, size);
    buf.make_mut_bytes().copy_from_slice(&px);
    Image::from_rgba8_premultiplied(buf)
}

/// Nombre d'icônes de chaque onglet de la visionneuse (MasterPaint, non personnalisées).
pub fn icon_counts(app: &AppWindow) -> (usize, usize) {
    let mp = app.global::<crate::MpIcons>();
    let fa = crate::fa_used_gen::FA_USED.iter().filter(|(g, _, _)| mp.invoke_for_glyph((*g).into()) < 0).count();
    (crate::mpicons_gen::MP_ICONS.len() + crate::sprite_gen::SPRITE.len(), fa)
}

/// SVG d'une icône MasterPaint (kind 0 maison, 1 sprite) aux couleurs du thème, agrandi à
/// 512 px (ouverture en projet SVG).
pub fn icon_svg(app: &AppWindow, name: &str, kind: i32, dark: bool) -> Option<String> {
    let key=format!("{}/{name}",if kind==0 {"mp"} else if kind==1 {"sprite"} else {"fa"});
    if let Some(src)=crate::icon_packs::source(&key) {
        if src.starts_with("data:image/png;base64,") { return Some(format!(r#"<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><image width="512" height="512" href="{src}"/></svg>"#)); }
        let (s,a,u,b)=icon_colors(dark,viewer_accent(app,dark));
        return Some(src.replace("{STROKE}",&s).replace("{ACCENT}",&a).replace("{SUBTLE}",&u).replace("{BG}",&b));
    }
    if kind == 2 { return None; }

    let tpl = if kind == 0 {
        crate::mpicons_gen::MP_ICONS.iter().find(|(n, _)| *n == name)?.1
    } else {
        crate::sprite_gen::SPRITE.iter().find(|(n, _)| *n == name)?.1
    };
    let (stroke, acc, subtle, bgs) = icon_colors(dark, viewer_accent(app, dark));
    Some(
        tpl.replace("{STROKE}", &stroke)
            .replace("{ACCENT}", &acc)
            .replace("{SUBTLE}", &subtle)
            .replace("{BG}", &bgs)
            .replacen("<svg ", "<svg width=\"512\" height=\"512\" ", 1),
    )
}

/// Keep browser chrome and Android system bars in sync with the actual header.
fn sync_system_theme(dark: bool, base: Color, bar: Color) {
    #[cfg(target_os = "android")]
    crate::android_io::system_theme(bar, contrast(bar,rgb(0x000000)) > contrast(bar,rgb(0xffffff)));
    #[cfg(target_arch = "wasm32")]
    {
        use wasm_bindgen::JsCast;
        if let Some(w)=web_sys::window() {
            if let Ok(f)=js_sys::Reflect::get(&w,&"mpSetSystemTheme".into()) {
                if let Some(f)=f.dyn_ref::<js_sys::Function>() {
                    let _=f.call3(&w,&hex(bar).into(),&dark.into(),&hex(base).into());
                }
            }
        }
    }
    #[cfg(not(any(target_os = "android",target_arch = "wasm32")))]
    let _=(dark,base,bar);
    #[cfg(target_os = "android")]
    let _=(dark,base);
}

/// Dessin des contrôles en vigueur : celui choisi (Paramètres › Personnalisation › Style), dans
/// les quatre interfaces (MasterPaint, Paint.NET, Photoshop, Téléphone). Le mode léger
/// impose le style 4 sans écraser le choix à restaurer à sa désactivation.
pub fn skin_of(app: &AppWindow) -> i32 {
    if app.get_set_perf_mode() == 1 || (app.get_set_perf_mode() == 0 && app.get_set_perf_done()) {
        4
    } else {
        app.get_set_theme_style().clamp(0, 4)
    }
}

/// Pack d'icônes qui accompagne l'interface et le style (« Suivre l'interface choisie ») :
/// Windows 7 / XP → Paint.NET (ancien), de la même époque ; sinon celui de l'interface.
pub fn followed_pack(app: &AppWindow) -> i32 {
    match skin_of(app) {
        2 | 3 => 4,
        _ => match app.get_set_interface_theme() { 1 => 1, 2 => 2, _ => 0 },
    }
}

/// Applique le thème : sombre ou clair, accent, et style (Paramètres › Thème d'interface :
/// 0 Flat Design, 1 Windows 98.
pub fn apply(app: &AppWindow, dark: bool, accent: Color) {
    let base_accent = palette_accent(accent);
    let accent = accent_shade(base_accent, dark);
    sync_system_theme(dark, base_accent, mix(accent, rgb(0x000000), 0.62));
    // Personnalisation avancée : icônes d'une autre couleur que l'accentuation
    let icon_pick = parse_hex(&app.get_set_icon_color());
    app.global::<Theme>().set_icon_base(icon_pick.unwrap_or(base_accent));
    let icon_accent = icon_pick.map_or(accent, |c| accent_shade(c, dark));
    render_icons(app, dark, icon_accent);
    let t = app.global::<Theme>();
    // dessin des contrôles de l'interface MasterPaint (0 moderne, 1 Windows 98, 2 Windows 7,
    // 3 Windows XP, 4 ultra léger) ; les présentations Paint.NET / Photoshop / Téléphone ont le leur
    let skin = skin_of(app);
    let style = match app.get_set_interface_theme() {1 => 2, 2 => 3, 3 => 0, _ => if skin == 1 { 1 } else { 0 }};
    t.set_reference_style(style);
    t.set_skin(skin);
    let win98 = skin == 1;
    let (win7, xp, lite) = (skin == 2, skin == 3, skin == 4);
    // Paramètres › Apparence : coins arrondis et barre de titre translucide (Windows 11)
    let round = !win98 && !lite && app.get_set_rounded();
    t.set_win98(win98);
    t.set_glass(!win98 && !lite && app.get_set_glass());
    // Windows 7 : « Fenêtres transparentes » = verre Aero (cadre translucide sur l'aperçu flouté)
    t.set_title_transparent(skin == 0 && !win98 && app.get_set_title_transparent());
    // ultra léger : rien qui redessine au survol, aucune ombre (réglages de l'utilisateur gardés)
    t.set_shadows(app.get_set_shadows() && !lite);
    t.set_hover_fx(app.get_set_hover_fx() && !lite);
    t.set_window_radius(if round { 8.0 } else { 0.0 });
    t.set_ctl_radius(if round { 5.0 } else { 0.0 });
    t.set_round(if round { 1.0 } else { 0.0 });
    t.set_title_height(if win98 { 24.0 } else { 26.0 });
    // Segoe UI n'existe que sous Windows : ailleurs (web, Linux, macOS), Selawik, intégrée
    // (mêmes métriques, licence libre), plutôt qu'une police de repli du système
    #[cfg(not(windows))]
    t.set_font("Selawik".into());
    t.set_dark(dark);
    t.set_accent_base(base_accent);
    t.set_accent(accent);
    let base = if dark { rgb(0x2b2b2b) } else { rgb(0xffffff) };
    t.set_accent_12(mix(accent, base, 0.12));
    t.set_accent_14(mix(accent, base, 0.14));
    t.set_accent_20(mix(accent, base, 0.20));
    t.set_accent_27(mix(accent, base, 0.27));
    t.set_accent_32(mix(accent, base, 0.32));
    t.set_accent_60(mix(accent, base, 0.60));
    t.set_on_accent(if contrast(accent, rgb(0x000000)) > contrast(accent, rgb(0xffffff)) { rgb(0x000000) } else { rgb(0xffffff) });

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
        t.set_text_inactive(rgb(0x9c9c9c));
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
        t.set_text_inactive(rgb(0x6b6b6b));
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
    // Reference palettes from paintdotjs/css/theme.css and PhotoCraft Tokens::ProMedium.
    // Layout is derived in Slint; the saved MasterPaint layout remains untouched.
    // géométrie et boutons de MasterPaint (les présentations de référence les remplacent)
    t.set_button_fg(t.get_text());
    t.set_button_radius(t.get_ctl_radius());
    t.set_close_size(17.0);
    t.set_button_relief(true);
    t.set_close_bg(rgb(0xc75050));
    t.set_close_hover(rgb(0xe04343));
    t.set_font_size(12.0);
    t.set_menu_font_size(12.0);
    t.set_small_font_size(11.0);
    if style == 2 {
        // Paint.NET = paintdotjs, css/theme.css (thème sombre par défaut, clair : data-color-scheme
        // « light ») et css/window.css : tout est carré, barre de titre de 30 px, croix rouge de
        // 19 px, boutons clairs à texte noir, police 8,25 pt
        let c = |v: u32| rgb(v);
        let (bg, title, menu, window, field, _border, text, muted, popup, sep) = if dark {
            (0x2f2f2f, 0x0d0d0d, 0x202020, 0x282828, 0x1e1e1e, 0x646464, 0xffffff, 0xc8c8c8, 0x1c1c1c, 0x46464a)
        } else {
            (0xd7d7d7, 0xe9e9e9, 0xf1f1f1, 0xf0f0f0, 0xffffff, 0xa0a0a0, 0x111111, 0x555555, 0xffffff, 0xc2c2c2)
        };
        for set in [Theme::set_menubar_bg, Theme::set_ribbon_bg, Theme::set_statusbar_bg, Theme::set_menu_gutter] { set(&t, c(menu)); }
        for set in [Theme::set_window_bg, Theme::set_list_bg, Theme::set_footer_bg] { set(&t, c(window)); }
        t.set_window_title_bg(c(title));
        t.set_window_border(if dark { Color::from_argb_u8(54, 195, 195, 195) } else { Color::from_argb_u8(71, 0, 0, 0) });
        t.set_window_shadow(Color::from_argb_u8(51, 0, 0, 0));
        for set in [Theme::set_field_bg, Theme::set_track_bg] { set(&t, c(field)); }
        for set in [Theme::set_field_border, Theme::set_track_border, Theme::set_statusbar_border] { set(&t, c(if dark { 0x8d8d8d } else { 0x767676 })); }
        t.set_ribbon_sep(c(sep));
        t.set_menu_bg(c(popup));
        t.set_workspace_bg(c(bg));
        t.set_text(c(text)); t.set_ribbon_fg(c(text));
        t.set_text_inactive(c(muted)); t.set_ribbon_label(c(muted));
        // boutons : clairs en thème clair (Paint.NET), sombres en thème sombre comme Paint.NET 5
        // (paintdotjs garde un bouton blanc en sombre : texte blanc sur blanc dans MasterPaint,
        // où beaucoup de boutons écrivent la couleur du texte sur ce fond)
        t.set_button_bg(c(if dark { 0x333333 } else { 0xfdfdfd }));
        t.set_button_border(c(if dark { 0x6e6e6e } else { 0xd0d0d0 }));
        t.set_button_fg(c(text));
        t.set_close_bg(c(0xc75050)); t.set_close_hover(c(0xe04343));
        // couleur d'accentuation choisie (bleu Paint.NET proposé au choix de l'interface) ; survol
        // et sélection en dérivent comme #18324B / #074F97 dérivent du bleu #0078D7
        let surface = c(window);
        t.set_accent(accent);
        t.set_on_accent(if contrast(accent, rgb(0x000000)) > contrast(accent, rgb(0xffffff)) { rgb(0x000000) } else { rgb(0xffffff) });
        t.set_accent_12(mix(accent, surface, if dark { 0.22 } else { 0.18 }));
        t.set_accent_14(mix(accent, surface, if dark { 0.26 } else { 0.22 }));
        t.set_accent_20(mix(accent, surface, if dark { 0.38 } else { 0.34 }));
        t.set_accent_27(mix(accent, surface, if dark { 0.34 } else { 0.28 }));
        t.set_accent_32(t.get_accent_27());
        t.set_accent_60(mix(accent, surface, 0.70));
        // carré comme paintdotjs ; l'option « Coins arrondis » reste respectée
        let r = if app.get_set_rounded() { 1.0 } else { 0.0 };
        t.set_window_radius(6.0 * r); t.set_ctl_radius(4.0 * r); t.set_round(r); t.set_button_radius(4.0 * r);
        t.set_title_height(30.0);
        t.set_close_size(24.0);
        t.set_button_relief(false);
        t.set_font_size(11.0); t.set_menu_font_size(11.0); t.set_small_font_size(10.0);
        sync_system_theme(dark, base_accent, c(title));
    }
    if style == 3 {
        // Photoshop = PhotoCraft, crates/ui-egui/src/theme.rs : Tokens « Pro » (sombre, par défaut)
        // et « ProLight » ; arrondis 3 / 4 / 6 px, boutons en pilule, bandes d'onglets
        let c = |v: u32| rgb(v);
        let (chrome, canvas, dock, card, field, field_border, hover, text, dim, tab, row, soft) = if dark {
            (0x323232, 0x282828, 0x1e1e1e, 0x323232, 0x242424, 0x4a4a4a, 0x424242, 0xdedede, 0xb2b2b2, 0x262626, 0x525252, 0x4e4e4e)
        } else {
            (0xf0f0f0, 0xd6d6d6, 0xe2e2e2, 0xf0f0f0, 0xffffff, 0xbababa, 0xe2e2e2, 0x141414, 0x404040, 0xe2e2e2, 0xcccccc, 0xd6d6d6)
        };
        for set in [Theme::set_menubar_bg, Theme::set_ribbon_bg, Theme::set_statusbar_bg, Theme::set_menu_gutter] { set(&t, c(chrome)); }
        for set in [Theme::set_window_bg, Theme::set_list_bg, Theme::set_footer_bg, Theme::set_menu_bg] { set(&t, c(card)); }
        t.set_window_title_bg(c(tab));
        for set in [Theme::set_window_border, Theme::set_statusbar_border, Theme::set_ribbon_sep] { set(&t, c(dock)); }
        t.set_window_shadow(if dark { Color::from_argb_u8(150, 0, 0, 0) } else { Color::from_argb_u8(50, 0, 0, 0) });
        for set in [Theme::set_field_bg, Theme::set_track_bg] { set(&t, c(field)); }
        for set in [Theme::set_field_border, Theme::set_track_border] { set(&t, c(field_border)); }
        t.set_workspace_bg(c(canvas));
        t.set_text(c(text)); t.set_ribbon_fg(c(text)); t.set_button_fg(c(text));
        t.set_text_inactive(c(dim)); t.set_ribbon_label(c(dim));
        // boutons en pilule, sans fond propre, liseré clair (« Reset to defaults »)
        t.set_button_bg(c(card));
        t.set_button_border(c(if dark { 0x8c8c8c } else { 0x9a9a9a }));
        // accent = couleur choisie (bleu PhotoCraft proposé au choix de l'interface)
        let blue = accent;
        t.set_accent(blue);
        t.set_on_accent(if contrast(blue, rgb(0x000000)) > contrast(blue, rgb(0xffffff)) { rgb(0x000000) } else { rgb(0xffffff) });
        t.set_accent_12(c(hover));
        t.set_accent_14(c(soft));
        t.set_accent_20(c(if dark { 0x5a5a5a } else { 0xcecece }));
        t.set_accent_27(c(row)); t.set_accent_32(c(row));
        t.set_accent_60(blue);
        t.set_close_bg(c(0xc42b1c)); t.set_close_hover(c(0xd94b3c));
        let r = if app.get_set_rounded() { 1.0 } else { 0.0 };
        t.set_window_radius(6.0 * r); t.set_ctl_radius(3.0 * r); t.set_round(r); t.set_button_radius(12.0 * r);
        t.set_title_height(28.0);
        t.set_button_relief(false);
        sync_system_theme(dark, base_accent, c(chrome));
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
        // tout est carré, y compris dans les présentations Paint.NET / Photoshop
        t.set_window_radius(0.0); t.set_ctl_radius(0.0); t.set_round(0.0); t.set_button_radius(0.0);
        t.set_title_height(24.0);
        t.set_close_size(17.0);
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
    // couleurs réglables du style Windows 7 (vide : automatique — verre à la couleur d'accentuation,
    // surbrillance dorée et ruban bleuté d'Office 2010)
    let hex = |s: slint::SharedString| -> Option<Color> {
        let s = s.trim_start_matches('#');
        (s.len() == 6).then(|| u32::from_str_radix(s, 16).ok()).flatten().map(rgb)
    };
    let w7_glass = hex(app.get_set_w7_glass()).unwrap_or(base_accent);
    let w7_ribbon = hex(app.get_set_w7_ribbon()).unwrap_or(rgb(0xd9e4f2));
    t.set_w7_glass_base(w7_glass);
    t.set_vista(win7 && app.get_set_w7_vista());
    // surbrillance par défaut : dorée (Office 2010) en Windows 7, orangée (Office 2003) en XP
    // « accent » : suit la couleur d'accentuation ; réglée, elle vaut aussi en moderne (ruban)
    let rib = app.get_set_w7_highlight();
    t.set_w7_hl(if rib.as_str() == "accent" { mix(base_accent, rgb(0xffffff), 0.85) } else { hex(rib.clone()).unwrap_or(rgb(if xp { 0xffc46e } else { 0xffcf4d })) });
    t.set_rib_hl_on(!rib.is_empty());
    // surbrillance des boutons ordinaires : couleur choisie, ou accentuation (XP : orangé d'origine)
    let bh = app.get_set_btn_highlight();
    t.set_btn_hl_on(!bh.is_empty());
    t.set_btn_hl(if bh.as_str() == "accent" { accent } else { parse_hex(&bh).unwrap_or(accent) });
    // Windows XP : jeu de couleurs Luna (titres, cadre) et Office 2003 (barres) — Bleu, Olive, Argent
    let xs = match app.get_set_xp_scheme() {
        1 => [0xd2dfa9, 0x8fa66a, 0xa3b97d, 0x6b8448, 0x5a7a3a, 0xa6bb7c, 0x405a28, 0x33461d, 0xffffff, 0xf8faea, 0xe2e8c6, 0xbccb90, 0xedf1d8, 0xcfd8a8, 0x4f6b38],
        2 => [0xffffff, 0xd3d3df, 0xc3c3d2, 0x9a9ab0, 0x8a8aa2, 0xc8c8d6, 0x5c5c76, 0xffffff, 0x20223c, 0xfbfbfd, 0xe4e4ed, 0xbcbccd, 0xf3f3f7, 0xd5d5e3, 0x4b4b6f],
        _ => [0x0997ff, 0x0053ee, 0x0066ff, 0x003dd7, 0x0831d9, 0x166aee, 0x001ea0, 0x0f1089, 0xffffff, 0xeef5ff, 0xcfe2fc, 0xa4c4f4, 0xdae7fc, 0xa9c6f3, 0x000080],
    };
    // jeu « Accentuation » : le bleu Luna refait à partir de la couleur d'accentuation
    let xs = if app.get_set_xp_scheme() == 3 {
        let (a, w, k) = (base_accent, rgb(0xffffff), rgb(0x000000));
        let v = |c: Color| (c.red() as u32) << 16 | (c.green() as u32) << 8 | c.blue() as u32;
        let fg = if contrast(a, k) > contrast(a, w) { 0x000000 } else { 0xffffff };
        [v(mix(a, w, 0.55)), v(a), v(mix(a, w, 0.85)), v(mix(a, k, 0.8)), v(mix(a, k, 0.85)), v(mix(a, w, 0.8)), v(mix(a, k, 0.55)),
            v(mix(a, k, 0.45)), fg, v(mix(a, w, 0.08)), v(mix(a, w, 0.22)), v(mix(a, w, 0.42)), v(mix(a, w, 0.18)), v(mix(a, w, 0.38)), v(mix(a, k, 0.5))]
    } else { xs };
    for (k, set) in [Theme::set_xp_t0, Theme::set_xp_t1, Theme::set_xp_t2, Theme::set_xp_t3, Theme::set_xp_f0, Theme::set_xp_f1, Theme::set_xp_f2,
        Theme::set_xp_shadow, Theme::set_xp_title_fg, Theme::set_xp_bar_a, Theme::set_xp_bar_b, Theme::set_xp_bar_c, Theme::set_xp_menu_a, Theme::set_xp_menu_b, Theme::set_xp_hl_border].into_iter().enumerate() {
        set(&t, rgb(xs[k]));
    }
    t.set_w7_ribbon(w7_ribbon);
    t.set_w7_ribbon_deep(deep_tone(w7_ribbon, 0.34));
    // couleur « Ruban » réglée : vaut aussi pour les autres styles (ruban, volet des Paramètres,
    // tutoriel : tout ce qui suit `Theme.band`)
    if !win7 && !xp && !lite && !app.get_set_w7_ribbon().is_empty() {
        t.set_ribbon_bg(if dark { mix(w7_ribbon, rgb(0x2b2b2b), 0.22) } else { mix(w7_ribbon, rgb(0xffffff), 0.6) });
    }
    if win7 {
        // Windows 7 = 7.css (gui/_variables.scss, _window.scss, _menu.scss…) : surface #f0f0f0,
        // contrôles en dégradé vitré bordés de #8e8f8f, arrondis 3 px, fenêtres 6 px, cadre Aero
        // #4580c4 (dessiné dans widgets.slint). Pas de thème sombre dans 7.css : le sombre (Photo
        // Pro) garde le cadre et les dégradés, avec des surfaces sombres.
        let c = |v: u32| rgb(v);
        if dark {
            for set in [Theme::set_window_bg, Theme::set_footer_bg, Theme::set_statusbar_bg, Theme::set_menu_bg, Theme::set_menu_gutter, Theme::set_menubar_bg] { set(&t, c(0x2d2f33)); }
            t.set_list_bg(c(0x232528));
            t.set_ribbon_bg(c(0x30333a));
            t.set_workspace_bg(c(0x1d2733));
            t.set_button_bg(c(0x3c3f45));
            t.set_field_bg(c(0x1f2124));
            t.set_track_bg(c(0x1f2124));
        } else {
            for set in [Theme::set_window_bg, Theme::set_footer_bg, Theme::set_statusbar_bg, Theme::set_menu_bg, Theme::set_menu_gutter] { set(&t, c(0xf0f0f0)); }
            // verre Aero clair de l'en-tête, ruban et espace de travail d'Office 2010
            t.set_menubar_bg(mix(w7_glass, c(0xffffff), 0.26));
            t.set_list_bg(c(0xffffff));
            t.set_ribbon_bg(mix(w7_ribbon, c(0xffffff), 0.5));
            t.set_workspace_bg(c(0xb4c3d6));
            t.set_text(c(0x000000));
            t.set_ribbon_fg(c(0x000000));
            t.set_text_inactive(c(0x6a6a6a));
            t.set_ribbon_label(c(0x5a6b85));
            t.set_button_bg(c(0xebebeb));
            t.set_field_bg(c(0xffffff));
            t.set_track_bg(c(0xf0f0f0));
        }
        // survols, sélections et lignes actives de TOUTE l'interface (palette Outils, listes,
        // onglets, panneaux…) : surbrillance dorée du ruban de Windows 7 / Office 2010, bordée
        // (accent-60), au lieu des aplats à la couleur d'accentuation
        let hl = t.get_w7_hl();
        let under = c(if dark { 0x30333a } else { 0xffffff });
        let (h12, h14, h20, h27) = if dark { (0.2, 0.34, 0.45, 0.3) } else { (0.3, 0.6, 0.85, 0.5) };
        t.set_accent_12(mix(hl, under, h12));
        t.set_accent_14(mix(hl, under, h14));
        t.set_accent_20(mix(hl, under, h20));
        t.set_accent_27(mix(hl, under, h27));
        t.set_accent_32(mix(hl, under, h27));
        t.set_accent_60(if dark { mix(hl, under, 0.7) } else { mix(hl, c(0xa87400), 0.7) });
        t.set_window_title_bg(c(if dark { 0x4a5f7a } else { 0xb9d1ea }));
        // traits intérieurs (cartes, séparateurs) : liseré de groupe de 7.css ; le cadre noir
        // translucide (#000000b3) est dessiné par la fenêtre elle-même
        t.set_window_border(c(if dark { 0x4a4d52 } else { 0xcdd7db }));
        t.set_window_shadow(Color::from_argb_u8(0xb3, 0, 0, 0));
        t.set_statusbar_border(c(if dark { 0x4a4d52 } else { 0x8ba0bc }));
        t.set_ribbon_sep(c(if dark { 0x4a4d52 } else { 0xb3c0d3 }));
        t.set_button_border(c(0x8e8f8f));
        t.set_button_fg(c(if dark { 0xf0f0f0 } else { 0x222222 }));
        t.set_field_border(c(0xabadb3));
        t.set_track_border(c(0x999999));
        t.set_close_bg(c(0xd54f36)); t.set_close_hover(c(0xee6d56));
        // « Coins arrondis » (Paramètres › Apparence) reste respecté : cadre et boutons carrés sinon
        let r = if app.get_set_rounded() { 1.0 } else { 0.0 };
        t.set_window_radius(6.0 * r); t.set_ctl_radius(3.0 * r); t.set_round(r); t.set_button_radius(3.0 * r);
        t.set_title_height(28.0);
        t.set_button_relief(false);
        sync_system_theme(dark, base_accent, mix(w7_glass, c(0xffffff), 0.42));
    }
    if xp {
        // Windows XP = XP.css (themes/XP : _variables, _window, _buttons, _forms, _groupbox) :
        // surface #ece9d8, boutons beiges bordés de #003c74, champs #7f9db9, barre de titre Luna
        // (dessinée dans widgets.slint), coins hauts de 8 px. Sombre (Photo Pro) : cadre gardé.
        let c = |v: u32| rgb(v);
        if dark {
            for set in [Theme::set_window_bg, Theme::set_footer_bg, Theme::set_statusbar_bg, Theme::set_menubar_bg, Theme::set_ribbon_bg] { set(&t, c(0x33322d)); }
            for set in [Theme::set_list_bg, Theme::set_menu_bg, Theme::set_menu_gutter, Theme::set_field_bg, Theme::set_track_bg] { set(&t, c(0x23221f)); }
            t.set_workspace_bg(c(0x262626));
            t.set_button_bg(c(0x45443e));
        } else {
            for set in [Theme::set_window_bg, Theme::set_footer_bg, Theme::set_statusbar_bg, Theme::set_menubar_bg, Theme::set_ribbon_bg] { set(&t, c(0xece9d8)); }
            for set in [Theme::set_list_bg, Theme::set_menu_bg, Theme::set_menu_gutter, Theme::set_field_bg] { set(&t, c(0xffffff)); }
            t.set_track_bg(c(0xecebe4));
            t.set_workspace_bg(c(0x808080));
            t.set_text(c(0x000000));
            t.set_ribbon_fg(c(0x000000));
            // #aca899 de XP.css illisible pour les indications (2:1) : gris chaud plus foncé
            t.set_text_inactive(c(0x6f6c5f));
            t.set_ribbon_label(c(0x15428b));
            t.set_button_bg(c(0xf4f3ee));
        }
        t.set_window_title_bg(t.get_xp_t1());
        // survols, sélections et lignes actives (palette Outils, listes, onglets…) : orangé
        // d'Office 2003 (couleur de surbrillance réglable), bordé de bleu marine
        let hl = t.get_w7_hl();
        let under = c(if dark { 0x33322d } else { 0xffffff });
        let (h12, h14, h20, h27) = if dark { (0.2, 0.34, 0.45, 0.3) } else { (0.35, 0.62, 0.9, 0.5) };
        t.set_accent_12(mix(hl, under, h12));
        t.set_accent_14(mix(hl, under, h14));
        t.set_accent_20(mix(hl, under, h20));
        t.set_accent_27(mix(hl, under, h27));
        t.set_accent_32(mix(hl, under, h27));
        t.set_accent_60(if dark { mix(hl, under, 0.7) } else { t.get_xp_hl_border() });
        // traits intérieurs : liseré de groupe de XP.css ; le cadre bleu est dessiné par la fenêtre
        t.set_window_border(c(if dark { 0x55534b } else { 0xd0d0bf }));
        t.set_window_shadow(Color::from_argb_u8(0x2e, 0, 0, 0));
        t.set_statusbar_border(c(if dark { 0x55534b } else { 0xd0cebf }));
        t.set_ribbon_sep(c(if dark { 0x55534b } else { 0xd0d0bf }));
        t.set_button_border(c(0x003c74));
        t.set_button_fg(c(if dark { 0xf0f0f0 } else { 0x000000 }));
        t.set_field_border(c(0x7f9db9));
        t.set_track_border(c(0x9d9c99));
        t.set_window_radius(8.0); t.set_ctl_radius(3.0); t.set_round(1.0); t.set_button_radius(3.0);
        t.set_title_height(29.0);
        t.set_button_relief(false);
        t.set_font_size(11.0); t.set_menu_font_size(11.0); t.set_small_font_size(10.0);
        sync_system_theme(dark, base_accent, c(0x0054e3));
    }
    if lite {
        // ultra léger : palette MasterPaint, fenêtres et boutons réduits à des aplats bordés
        // (pas de barre de titre teintée, de croix rouge, de relief ni d'arrondi)
        t.set_window_title_bg(t.get_window_bg());
        t.set_window_radius(0.0); t.set_ctl_radius(0.0); t.set_round(0.0); t.set_button_radius(0.0);
        t.set_button_relief(false);
        t.set_close_size(20.0);
        t.set_title_height(24.0);
    }
    // Paint.NET / Photoshop : « Bordures marquées » = contours de la référence (paintdotjs,
    // PhotoCraft) ; « Non » = contours discrets de MasterPaint, avec son relief de boutons
    // « Contraste renforcé » (Paramètres › Personnalisation) comprend les bordures marquées ;
    // ces dernières restent aussi le contour d'origine de Paint.NET / Photoshop (interface suivie)
    let hc = app.get_set_high_contrast();
    let pb = hc || app.get_set_pronounced_borders();
    if style >= 2 && skin == 0 && !pb {
        let v = |d: u32, l: u32| rgb(if dark { d } else { l });
        t.set_window_border(v(0x4a4a4a, 0xc6c6c6));
        t.set_field_border(v(0x6a6a6a, 0xadadad));
        t.set_button_border(v(0x555555, 0xd0d0d0));
        t.set_track_border(v(0x5a5a5a, 0xd6d6d6));
        t.set_statusbar_border(v(0x383838, 0xd4d4d4));
        t.set_ribbon_sep(v(0x4f4f4f, 0xc8c6c4));
        t.set_button_relief(true);
    }
    if pb && (hc || (style < 2 && !win7 && !xp)) {
        let border = rgb(if dark { 0x858585 } else { 0x737373 });
        t.set_window_border(border);
        t.set_field_border(border);
        t.set_button_border(border);
        t.set_track_border(border);
        t.set_statusbar_border(border);
        t.set_ribbon_sep(border);
    }
    // Personnalisation avancée : chaque élément peut prendre le dessin d'un autre style (boutons
    // XP sur verre Aero…) ; ultra léger (mode léger compris) : tout reste en aplats
    let pick = |o: i32| if lite || o < 0 { skin } else { o.clamp(0, 4) };
    // boutons : 5 = pilules de Photoshop (PhotoCraft) sur n'importe quel style
    let ps_btn = !lite && app.get_set_btn_skin() == 5;
    let (bs, fs, cs) = (if ps_btn { 0 } else { pick(app.get_set_btn_skin()) }, pick(app.get_set_frame_skin()), pick(app.get_set_close_skin()));
    if ps_btn {
        t.set_button_radius(12.0 * t.get_round());
        t.set_button_relief(false);
        t.set_button_bg(t.get_window_bg());
        t.set_button_border(mix(t.get_text(), t.get_window_bg(), 0.42));
    } else if app.get_set_btn_skin() == 0 && style >= 2 {
        // boutons « Windows 10/11 » demandés dans Paint.NET / Photoshop : ceux de MasterPaint
        t.set_button_radius(t.get_ctl_radius());
        t.set_button_relief(true);
    }
    t.set_btn_skin(bs);
    t.set_frame_skin(fs);
    t.set_close_skin(cs);
    t.set_title_center(app.get_set_title_center());
    t.set_gloss(app.get_set_gloss() && !lite);
    t.set_w7_glass_opacity((app.get_set_glass_opacity() / 100.0).clamp(0.0, 1.0));
    t.set_glass_bright((app.get_set_glass_bright() / 100.0).clamp(-0.5, 0.5));
    t.set_title_opacity((app.get_set_title_opacity() / 100.0).clamp(0.0, 1.0));
    // barres de titre translucides : celles du cadre moderne (Windows 10/11), quel que soit le
    // style des autres éléments
    t.set_title_transparent(fs == 0 && app.get_set_title_transparent());
    // verre Aero : celui du cadre Windows 7, quel que soit le style des autres éléments
    t.set_aero(fs == 2 && app.get_set_title_transparent());
    // flou derrière le verre : Aero (7) et barres translucides (10/11)
    t.set_aero_blur(matches!(fs, 0 | 2) && app.get_set_title_transparent() && app.get_set_aero_blur());
    // Windows 10/11 : couleur d'accentuation saturée sur les barres de titre
    t.set_title_accent(fs == 0 && app.get_set_title_accent());
    let tab = if dark { mix(base_accent, rgb(0x000000), 0.8) } else { base_accent };
    t.set_title_accent_bg(tab);
    t.set_title_accent_fg(if contrast(tab, rgb(0x000000)) > contrast(tab, rgb(0xffffff)) { rgb(0x000000) } else { rgb(0xffffff) });
    if fs != skin {
        // hauteur de la barre de titre du cadre choisi ; reliefs Windows 98 à la couleur d'accent
        t.set_title_height(match fs { 1 => 24.0, 2 => 28.0, 3 => 29.0, 4 => 24.0, _ => 26.0 });
    }
    if !win98 {
        t.set_bevel_hi(rgb(if dark { 0x6a6a6a } else { 0xffffff }));
        t.set_bevel_lo(rgb(if dark { 0x232323 } else { 0x808080 }));
        t.set_bevel_dk(rgb(if dark { 0x000000 } else { 0x0a0a0a }));
        t.set_title_a(mix(accent, rgb(0x000000), 0.75));
        t.set_title_b(mix(accent, rgb(0xffffff), 0.65));
    }
    // contraste renforcé (mal-voyants) : textes secondaires presque aussi foncés que le texte,
    // contours nets partout
    if hc {
        // texte de l'interface un peu plus grand partout
        t.set_font_size(t.get_font_size() + 1.0);
        t.set_menu_font_size(t.get_menu_font_size() + 1.0);
        t.set_small_font_size(t.get_small_font_size() + 1.0);
        let bg = t.get_window_bg();
        let txt = t.get_text();
        t.set_text_inactive(mix(txt, bg, 0.78));
        t.set_ribbon_label(mix(t.get_ribbon_fg(), bg, 0.85));
        let line = mix(txt, bg, 0.6);
        for set in [Theme::set_window_border, Theme::set_field_border, Theme::set_button_border, Theme::set_track_border, Theme::set_statusbar_border, Theme::set_ribbon_sep] {
            set(&t, line);
        }
        t.set_accent_60(mix(t.get_accent(), txt, 0.8));
    }
    // fond de la zone de travail et damier par défaut : ceux du thème
    crate::appearance::follow_theme(app, dark);
    // flou derrière le verre : l'image floutée de la toile suit TOUT changement de thème (style
    // Windows 7 choisi, mode léger, Personnalisation…), pas seulement la case du flou — sinon le
    // verre restait sans image jusqu'à la prochaine retouche de la toile
    crate::refresh_aero_later(app);
}

#[cfg(test)]
mod contrast_tests {
    use super::*;
    #[test]
    fn each_palette_accent_is_readable_in_both_themes() {
        for hex in ACCENTS {
            for dark in [false, true] {
                let shade = accent_shade(rgb(hex), dark);
                assert!(contrast(shade, rgb(if dark { 0x2e2e2e } else { 0xffffff })) >= 4.5);
                assert!(contrast(shade, rgb(0xffffff)).max(contrast(shade, rgb(0x000000))) >= 4.5);
                assert_eq!(palette_accent(rgb(hex)), rgb(hex));
            }
        }
    }
}

#[cfg(test)]
mod icon_tests {
    use super::*;

    /// Teinte calculée = rendu du SVG aux mêmes couleurs, pour toutes les icônes.
    #[test]
    fn icon_tint_matches_svg() {
        let t0 = std::time::Instant::now();
        let masks: Vec<(&str, IconMask)> = crate::mpicons_gen::MP_ICONS.iter().chain(crate::sprite_gen::SPRITE.iter()).map(|(n, t)| (*n, icon_mask(t, 32).unwrap_or_else(|| panic!("{n}")))).collect();
        let prep = t0.elapsed();
        let accent = Color::from_rgb_u8(0xc2, 0x18, 0x5b);
        let pal = palette(true, accent);
        let t1 = std::time::Instant::now();
        for (_, m) in &masks {
            let _ = tint(m, &pal);
        }
        let retint = t1.elapsed();
        println!("{} icônes : préparation {prep:?}, nouvelle teinte {retint:?}", masks.len());
        let (s, a, u, b) = icon_colors(true, accent);
        let mut worst = 0i32;
        for ((n, tpl), (_, m)) in crate::mpicons_gen::MP_ICONS.iter().chain(crate::sprite_gen::SPRITE.iter()).zip(&masks) {
            let want = render_tpl(tpl, 32, [&s, &a, &u, &b]).unwrap();
            let got = tint(m, &pal).to_rgba8_premultiplied().unwrap();
            for (x, y) in want.iter().zip(got.as_bytes()) {
                let d = (*x as i32 - *y as i32).abs();
                if d > worst {
                    worst = d;
                }
                assert!(d <= 4, "{n} : écart {d}");
            }
        }
        println!("écart maximal {worst}");
    }
}
