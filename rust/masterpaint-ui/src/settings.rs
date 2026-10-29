//! Paramètres de l'interface, conservés entre les sessions : fichier JSON sur le bureau
//! (dossier de configuration de l'utilisateur), localStorage sur le web — où la molette
//! partage la clé `illu_wheel_mode` de la version HTML.

use serde_json::{json, Value};

#[derive(Clone, Debug)]
pub struct Settings {
    pub accent: u32,
    pub dark: bool,
    pub toolbar_mode: i32,
    pub wheel_scroll: bool,
    pub history_max: usize,
    pub autosave_min: u32,
    pub language: i32,
    pub layout: i32,
    /// interface tactile automatique sous 600 px de large (sinon : la disposition choisie)
    pub layout_auto: bool,
    pub theme_style: i32,
    /// zoom de l'interface (%)
    pub ui_zoom: f32,
    /// zoom à l'ouverture d'une image : 0 ajuster à la fenêtre, 1 taille réelle (100 %)
    pub default_zoom: i32,
    /// outil sélectionné au démarrage (identifiant, comme la version web)
    pub default_tool: String,
    /// sauvegarde automatique des onglets et restauration au démarrage
    pub autosave: bool,
    /// calcul des effets sur la carte graphique
    pub use_gpu: bool,
    /// Coller (Ctrl+V) : 0 dans un nouveau calque, 1 dans le calque actif (pixels flottants)
    pub paste_mode: i32,
    /// image venue de l'extérieur : demander où la coller (nouvel onglet ou image actuelle)
    pub paste_ask: bool,
    /// Apparence : coins arrondis, barre de titre translucide, aperçu du projet derrière les
    /// onglets ; image zoomée lissée
    pub rounded: bool,
    pub glass: bool,
    pub header_preview: bool,
    pub zoom_smooth: bool,
    /// aimantation : taille des cases (1/N de la largeur), force d'attraction (%), grille
    /// toujours visible, repères magenta d'accroche
    pub snap_div: u32,
    pub snap_thresh: u32,
    pub snap_always: bool,
    pub snap_guides: bool,
    /// couleurs favorites de la fenêtre Couleurs (0xAARRGGBB, 24 au plus)
    pub fav_colors: Vec<u32>,
    /// 8 dernières couleurs peintes, la plus récente en tête (0xAARRGGBB)
    pub recent_colors: Vec<u32>,
    /// fenêtre Couleurs : carré saturation × valeur + teinte au lieu de la roue
    pub color_square: bool,
    /// outil Texte : chaque texte crée un calque texte modifiable
    pub text_layer: bool,
    /// lasso magnétique : force d'attraction aux bords (0..100 %) et écart entre ancres (px)
    pub magnet_strength: f32,
    pub magnet_freq: f32,
    /// position et taille des palettes (nom → [x, y, l, h] en px logiques) : tools, history,
    /// colors, layers
    pub palettes: Vec<(String, [f32; 4])>,
    /// fenêtre de bienvenue : nombre d'affichages au démarrage (montrée les deux premières
    /// fois), et « Ne plus afficher »
    pub welcome_count: u32,
    pub welcome_hide: bool,
    /// disposition Photoshop, colonne de droite : place de Couleurs, Historique, Calques
    /// (0 = en haut) puis hauteurs de Couleurs (0 = automatique) et d'Historique (px)
    pub ps_dock: [f32; 5],
}

impl Default for Settings {
    fn default() -> Self {
        Settings {
            accent: 0x0f2d5c,
            dark: false,
            toolbar_mode: 0,
            wheel_scroll: false,
            history_max: 40,
            autosave_min: 0,
            language: 0,
            layout: 0,
            layout_auto: true,
            theme_style: 0,
            ui_zoom: 100.0,
            default_zoom: 0,
            default_tool: "tool-select".into(),
            autosave: true,
            use_gpu: true,
            paste_mode: 0,
            paste_ask: true,
            rounded: true,
            glass: true,
            header_preview: true,
            zoom_smooth: false,
            snap_div: 48,
            snap_thresh: 50,
            snap_always: false,
            snap_guides: true,
            fav_colors: Vec::new(),
            recent_colors: Vec::new(),
            color_square: false,
            text_layer: false,
            magnet_strength: 60.0,
            magnet_freq: 32.0,
            palettes: Vec::new(),
            welcome_count: 0,
            welcome_hide: false,
            ps_dock: [0.0, 1.0, 2.0, 0.0, 150.0],
        }
    }
}

impl Settings {
    fn to_json(&self) -> Value {
        json!({
            "accent": format!("#{:06x}", self.accent),
            "dark": self.dark,
            "toolbarMode": self.toolbar_mode,
            "wheelMode": if self.wheel_scroll { "scroll" } else { "zoom" },
            "historyMax": self.history_max,
            "autosaveMin": self.autosave_min,
            "language": self.language,
            "layout": self.layout,
            "layoutAuto": self.layout_auto,
            "themeStyle": self.theme_style,
            "uiZoom": self.ui_zoom,
            "defaultZoom": self.default_zoom,
            "defaultTool": self.default_tool,
            "autosave": self.autosave,
            "useGpu": self.use_gpu,
            "pasteMode": self.paste_mode,
            "pasteAsk": self.paste_ask,
            "rounded": self.rounded,
            "glass": self.glass,
            "headerPreview": self.header_preview,
            "zoomSmooth": self.zoom_smooth,
            "snapDiv": self.snap_div,
            "snapThresh": self.snap_thresh,
            "snapAlways": self.snap_always,
            "snapGuides": self.snap_guides,
            "favColors": self.fav_colors.iter().map(|c| format!("#{c:08x}")).collect::<Vec<_>>(),
            "recentColors": self.recent_colors.iter().map(|c| format!("#{c:08x}")).collect::<Vec<_>>(),
            "colorSquare": self.color_square,
            "textLayer": self.text_layer,
            "welcomeCount": self.welcome_count,
            "welcomeHide": self.welcome_hide,
            "magnetStrength": self.magnet_strength,
            "magnetFreq": self.magnet_freq,
            "palettes": self.palettes.iter()
                .map(|(k, g)| (k.clone(), json!({ "x": g[0], "y": g[1], "w": g[2], "h": g[3] })))
                .collect::<serde_json::Map<String, Value>>(),
            "psDock": {
                "order": [self.ps_dock[0], self.ps_dock[1], self.ps_dock[2]],
                "colorsH": self.ps_dock[3],
                "historyH": self.ps_dock[4],
            },
        })
    }

    fn from_json(v: &Value) -> Settings {
        let d = Settings::default();
        let i = |k: &str, def: i64| v.get(k).and_then(|x| x.as_i64()).unwrap_or(def);
        Settings {
            accent: v
                .get("accent")
                .and_then(|a| a.as_str())
                .and_then(|s| u32::from_str_radix(s.trim_start_matches('#'), 16).ok())
                .unwrap_or(d.accent),
            dark: v.get("dark").and_then(|b| b.as_bool()).unwrap_or(d.dark),
            toolbar_mode: i("toolbarMode", 0) as i32,
            wheel_scroll: v.get("wheelMode").and_then(|w| w.as_str()) == Some("scroll"),
            history_max: i("historyMax", d.history_max as i64).clamp(5, 500) as usize,
            autosave_min: i("autosaveMin", 0).clamp(0, 120) as u32,
            language: i("language", 0) as i32,
            layout: i("layout", 0) as i32,
            layout_auto: v.get("layoutAuto").and_then(|b| b.as_bool()).unwrap_or(true),
            theme_style: i("themeStyle", 0) as i32,
            ui_zoom: v.get("uiZoom").and_then(|z| z.as_f64()).unwrap_or(100.0).clamp(60.0, 200.0) as f32,
            default_zoom: i("defaultZoom", 0) as i32,
            default_tool: v.get("defaultTool").and_then(|t| t.as_str()).unwrap_or("tool-select").to_string(),
            autosave: v.get("autosave").and_then(|b| b.as_bool()).unwrap_or(true),
            use_gpu: v.get("useGpu").and_then(|b| b.as_bool()).unwrap_or(true),
            paste_mode: i("pasteMode", 0).clamp(0, 1) as i32,
            paste_ask: v.get("pasteAsk").and_then(|b| b.as_bool()).unwrap_or(true),
            rounded: v.get("rounded").and_then(|b| b.as_bool()).unwrap_or(true),
            glass: v.get("glass").and_then(|b| b.as_bool()).unwrap_or(true),
            header_preview: v.get("headerPreview").and_then(|b| b.as_bool()).unwrap_or(true),
            zoom_smooth: v.get("zoomSmooth").and_then(|b| b.as_bool()).unwrap_or(false),
            snap_div: i("snapDiv", 48).clamp(4, 128) as u32,
            snap_thresh: i("snapThresh", 50).clamp(1, 100) as u32,
            snap_always: v.get("snapAlways").and_then(|b| b.as_bool()).unwrap_or(false),
            snap_guides: v.get("snapGuides").and_then(|b| b.as_bool()).unwrap_or(true),
            fav_colors: v
                .get("favColors")
                .and_then(|a| a.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|c| c.as_str())
                        .filter_map(|s| u32::from_str_radix(s.trim_start_matches('#'), 16).ok())
                        .take(24)
                        .collect()
                })
                .unwrap_or_default(),
            recent_colors: v
                .get("recentColors")
                .and_then(|a| a.as_array())
                .map(|a| {
                    a.iter()
                        .filter_map(|c| c.as_str())
                        .filter_map(|s| u32::from_str_radix(s.trim_start_matches('#'), 16).ok())
                        .take(8)
                        .collect()
                })
                .unwrap_or_default(),
            color_square: v.get("colorSquare").and_then(|b| b.as_bool()).unwrap_or(false),
            text_layer: v.get("textLayer").and_then(|b| b.as_bool()).unwrap_or(false),
            welcome_count: i("welcomeCount", 0).clamp(0, 1000) as u32,
            welcome_hide: v.get("welcomeHide").and_then(|b| b.as_bool()).unwrap_or(false),
            magnet_strength: v.get("magnetStrength").and_then(|n| n.as_f64()).map(|n| n.clamp(0.0, 100.0) as f32).unwrap_or(60.0),
            magnet_freq: v.get("magnetFreq").and_then(|n| n.as_f64()).map(|n| n.clamp(8.0, 200.0) as f32).unwrap_or(32.0),
            palettes: v
                .get("palettes")
                .and_then(|p| p.as_object())
                .map(|o| {
                    o.iter()
                        .filter_map(|(k, g)| {
                            let n = |c: &str| g.get(c).and_then(|x| x.as_f64()).map(|x| x as f32);
                            Some((k.clone(), [n("x")?, n("y")?, n("w")?.max(40.0), n("h")?.max(40.0)]))
                        })
                        .collect()
                })
                .unwrap_or_default(),
            ps_dock: v
                .get("psDock")
                .and_then(|p| {
                    let o: Vec<f32> = p.get("order")?.as_array()?.iter().filter_map(|x| x.as_f64()).map(|x| x as f32).collect();
                    // ordre valide : une permutation de 0, 1, 2
                    let mut s = o.clone();
                    s.sort_by(|a, b| a.total_cmp(b));
                    if s != [0.0, 1.0, 2.0] {
                        return None;
                    }
                    let h = |k: &str, def: f32| p.get(k).and_then(|x| x.as_f64()).map(|x| x as f32).unwrap_or(def);
                    Some([o[0], o[1], o[2], h("colorsH", 0.0).max(0.0), h("historyH", 150.0).max(70.0)])
                })
                .unwrap_or(d.ps_dock),
        }
    }

    #[cfg(not(target_arch = "wasm32"))]
    /// Dossier des données de MasterPaint (paramètres, sauvegarde automatique).
    pub fn data_dir() -> Option<std::path::PathBuf> {
        Settings::path().and_then(|p| p.parent().map(|d| d.to_path_buf()))
    }

    fn path() -> Option<std::path::PathBuf> {
        let base = std::env::var_os("APPDATA")
            .map(std::path::PathBuf::from)
            .or_else(|| std::env::var_os("XDG_CONFIG_HOME").map(std::path::PathBuf::from))
            .or_else(|| std::env::var_os("HOME").map(|h| std::path::PathBuf::from(h).join(".config")))?;
        Some(base.join("MasterPaint").join("settings-rust.json"))
    }

    pub fn load() -> Settings {
        #[cfg(not(target_arch = "wasm32"))]
        {
            Settings::path()
                .and_then(|p| std::fs::read(p).ok())
                .and_then(|b| serde_json::from_slice::<Value>(&b).ok())
                .map(|v| Settings::from_json(&v))
                .unwrap_or_default()
        }
        #[cfg(target_arch = "wasm32")]
        {
            let store = web_sys::window().and_then(|w| w.local_storage().ok().flatten());
            let mut s = store
                .as_ref()
                .and_then(|st| st.get_item("illu_rust_settings").ok().flatten())
                .and_then(|t| serde_json::from_str::<Value>(&t).ok())
                .map(|v| Settings::from_json(&v))
                .unwrap_or_default();
            // molette : réglage commun avec la version HTML
            if let Some(m) = store.as_ref().and_then(|st| st.get_item("illu_wheel_mode").ok().flatten()) {
                s.wheel_scroll = m == "scroll";
            }
            s
        }
    }

    pub fn save(&self) {
        #[cfg(not(target_arch = "wasm32"))]
        {
            if let Some(p) = Settings::path() {
                if let Some(dir) = p.parent() {
                    let _ = std::fs::create_dir_all(dir);
                }
                let _ = std::fs::write(p, self.to_json().to_string());
            }
        }
        #[cfg(target_arch = "wasm32")]
        {
            if let Some(st) = web_sys::window().and_then(|w| w.local_storage().ok().flatten()) {
                let _ = st.set_item("illu_rust_settings", &self.to_json().to_string());
                let _ = st.set_item("illu_wheel_mode", if self.wheel_scroll { "scroll" } else { "zoom" });
            }
        }
    }
}

/// Raccourcis affichés dans « Raccourcis clavier et souris » (titre de section : touches vides).
pub const SHORTCUTS: &[(&str, &str)] = &[
    ("", "Fichier"),
    ("Ctrl+N", "Nouvelle image"),
    ("Ctrl+O", "Ouvrir une image ou un projet .illu"),
    ("Ctrl+S / Ctrl+Maj+S", "Exporter (PNG, JPEG, WebP, BMP, .illu)"),
    ("", "Édition"),
    ("Ctrl+Z", "Annuler"),
    ("Ctrl+Y / Ctrl+Maj+Z", "Rétablir"),
    ("Ctrl+X / Ctrl+C / Ctrl+V", "Couper / copier / coller"),
    ("Ctrl+A", "Tout sélectionner"),
    ("Ctrl+D / Échap", "Désélectionner"),
    ("Ctrl+I", "Inverser la sélection"),
    ("Suppr / Retour arrière", "Effacer la sélection"),
    ("Ctrl+Maj+X", "Recadrer à la sélection"),
    ("Ctrl+Maj+H / V / C", "Centrer la sélection (horizontal / vertical / les deux)"),
    ("Flèches (Maj : ×10)", "Déplacer la sélection ou les pixels soulevés"),
    ("", "Calques et effets"),
    ("Ctrl+Maj+D", "Dupliquer le calque"),
    ("Ctrl+F", "Répéter le dernier effet"),
    ("Ctrl+Maj+I", "Inverser les couleurs"),
    ("Ctrl+Maj+L", "Auto-niveau"),
    ("Ctrl+Maj+G", "Noir et blanc"),
    ("Ctrl+Maj+E", "Sépia"),
    ("Ctrl+Maj+U", "Teinte / Saturation"),
    ("Ctrl+Maj+P", "Postériser"),
    ("Ctrl+L", "Niveaux"),
    ("Ctrl+Maj+M", "Courbes"),
    ("", "Outils"),
    ("S", "Sélection rectangulaire"),
    ("D / A", "Lasso"),
    ("W / B", "Baguette magique"),
    ("M / V", "Déplacer"),
    ("Y", "Déformation"),
    ("Q", "Déformation 4 coins"),
    ("Maj+B", "Pinceau"),
    ("P", "Crayon"),
    ("E", "Gomme"),
    ("F", "Remplissage"),
    ("G", "Dégradé"),
    ("I", "Pipette"),
    ("Z", "Zoom"),
    ("T", "Texte (Échap : valider)"),
    ("R / O", "Rectangle / ellipse"),
    ("U", "Rectangle arrondi"),
    ("L", "Ligne"),
    ("[ / ]", "Taille du pinceau"),
    ("X", "Échanger couleurs principale et secondaire"),
    ("", "Affichage et souris"),
    ("Ctrl + / Ctrl −", "Zoom avant / arrière"),
    ("Ctrl+0", "Ajuster à la fenêtre"),
    ("Molette", "Zoom ou défilement (Paramètres › Souris)"),
    ("Maj + molette", "Défilement horizontal"),
    ("Ctrl + molette", "Zoom"),
    ("Clic du milieu / Espace + glisser", "Déplacer la vue"),
    ("Clic droit (pinceau…)", "Peindre avec la couleur secondaire"),
    ("Clic droit (Déplacer)", "Rotation des pixels soulevés"),
    ("Maj (poignées)", "Conserver les proportions / rotation par 15°"),
    ("Alt (poignées)", "Redimensionner depuis le centre"),
    ("Ctrl / Alt (sélection)", "Ajouter / retirer de la sélection"),
    ("Entrée", "Valider la transformation ou le lasso polygonal"),
];
