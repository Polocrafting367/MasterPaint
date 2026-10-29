//! Captures de l'interface sans fenêtre : `--snapshot=fichier.png [--size=LxH] [--wait=ms]
//! [--clicks=x,y;x,y…]`. L'application est rendue par le moteur logiciel de Slint dans une
//! image PNG, sans écran : sert à vérifier la mise en page (bureau, téléphone, fenêtres).

use slint::platform::software_renderer::{MinimalSoftwareWindow, PremultipliedRgbaColor, RepaintBufferType};
use slint::platform::{Platform, PointerEventButton, WindowAdapter, WindowEvent};
use slint::LogicalPosition;
use std::rc::Rc;
use std::time::{Duration, Instant};

pub struct Snap {
    path: String,
    w: u32,
    h: u32,
    wait: u64,
    clicks: Vec<(f32, f32)>,
    window: Rc<MinimalSoftwareWindow>,
}

struct SnapPlatform {
    window: Rc<MinimalSoftwareWindow>,
    start: Instant,
}

impl Platform for SnapPlatform {
    fn create_window_adapter(&self) -> Result<Rc<dyn WindowAdapter>, slint::PlatformError> {
        Ok(self.window.clone())
    }
    fn duration_since_start(&self) -> Duration {
        self.start.elapsed()
    }
}

/// Options de capture ; installe la plateforme logicielle (avant toute fenêtre Slint).
pub fn install(args: &[String]) -> Option<Snap> {
    let get = |k: &str| args.iter().find_map(|a| a.strip_prefix(k)).map(|s| s.to_string());
    let path = get("--snapshot=")?;
    let (w, h) = get("--size=").and_then(|s| s.split_once('x').map(|(a, b)| (a.parse().ok(), b.parse().ok()))).and_then(|(a, b)| Some((a?, b?))).unwrap_or((1600, 1000));
    let wait = get("--wait=").and_then(|s| s.parse().ok()).unwrap_or(400);
    let clicks = get("--clicks=")
        .map(|s| s.split(';').filter_map(|p| p.split_once(',').and_then(|(x, y)| Some((x.trim().parse().ok()?, y.trim().parse().ok()?)))).collect())
        .unwrap_or_default();
    let window = MinimalSoftwareWindow::new(RepaintBufferType::NewBuffer);
    // taille posée avant la création de l'interface : la disposition (téléphone ou bureau)
    // est choisie au démarrage d'après la largeur de la fenêtre
    window.set_size(slint::PhysicalSize::new(w, h));
    slint::platform::set_platform(Box::new(SnapPlatform { window: window.clone(), start: Instant::now() })).ok()?;
    Some(Snap { path, w, h, wait, clicks, window })
}

impl Snap {
    /// Laisse passer le temps (minuteries, animations) en redessinant.
    fn settle(&self, ms: u64, buf: &mut [PremultipliedRgbaColor]) {
        let end = Instant::now() + Duration::from_millis(ms);
        while Instant::now() < end {
            slint::platform::update_timers_and_animations();
            self.window.draw_if_needed(|r| {
                r.render(buf, self.w as usize);
            });
            std::thread::sleep(Duration::from_millis(16));
        }
    }

    /// Affiche la fenêtre, joue les clics demandés et écrit l'image.
    pub fn capture(self, app: &impl slint::ComponentHandle) -> Result<(), slint::PlatformError> {
        self.window.set_size(slint::PhysicalSize::new(self.w, self.h));
        app.show()?;
        let mut buf = vec![PremultipliedRgbaColor::default(); (self.w * self.h) as usize];
        self.settle(self.wait, &mut buf);
        for &(x, y) in &self.clicks {
            let position = LogicalPosition::new(x, y);
            self.window.dispatch_event(WindowEvent::PointerMoved { position });
            self.settle(30, &mut buf);
            self.window.dispatch_event(WindowEvent::PointerPressed { position, button: PointerEventButton::Left });
            self.window.dispatch_event(WindowEvent::PointerReleased { position, button: PointerEventButton::Left });
            self.settle(250, &mut buf);
        }
        self.window.request_redraw();
        self.settle(50, &mut buf);
        let rgba: Vec<u8> = buf.iter().flat_map(|p| [p.red, p.green, p.blue, 255]).collect();
        image::save_buffer(&self.path, &rgba, self.w, self.h, image::ExtendedColorType::Rgba8).map_err(|e| slint::PlatformError::Other(e.to_string()))?;
        eprintln!("capture : {} ({}×{})", self.path, self.w, self.h);
        Ok(())
    }
}
