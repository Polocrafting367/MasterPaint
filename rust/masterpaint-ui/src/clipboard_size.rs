// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Read only dimensions for the New Image dialog; never paste or replace clipboard content.
use std::path::{Path, PathBuf};
#[cfg(target_os = "android")]
use crate::android_io::clipboard as arboard;

pub fn file_dimensions(path: &Path) -> Option<(usize, usize)> {
    let (w, h) = image::ImageReader::open(path).ok()?.with_guessed_format().ok()?.into_dimensions().ok()?;
    (w > 0 && h > 0).then_some((w as usize, h as usize))
}
fn text_paths(text: &str) -> Vec<PathBuf> {
    text.lines().filter_map(|line| {
        let line = line.trim().trim_matches('"');
        if line.is_empty() || line.starts_with('#') { return None; }
        let line = line.strip_prefix("file://localhost").or_else(|| line.strip_prefix("file://")).unwrap_or(line);
        let mut bytes = Vec::new();
        let mut input = line.as_bytes().iter().copied().peekable();
        while let Some(c) = input.next() {
            if c == b'%' {
                let (a, b) = (input.next()?, input.next()?);
                bytes.push((a as char).to_digit(16)? as u8 * 16 + (b as char).to_digit(16)? as u8);
            } else { bytes.push(c); }
        }
        let path = PathBuf::from(String::from_utf8(bytes).ok()?);
        path.is_absolute().then_some(path)
    }).collect()
}
thread_local! {
    // X11 clipboard ownership must outlive the Copy callback.
    static OWNER: std::cell::RefCell<Option<arboard::Clipboard>> = const { std::cell::RefCell::new(None) };
}
/// Texte dans le presse-papiers (le presse-papiers reste possédé : sous Linux, son contenu
/// disparaît sinon avec l'objet).
pub fn write_text(text: &str) -> bool {
    OWNER.with(|o| {
        let mut owner = o.borrow_mut();
        if owner.is_none() { *owner = arboard::Clipboard::new().ok(); }
        owner.as_mut().is_some_and(|c| c.set_text(text.to_string()).is_ok())
    })
}

pub fn write_image(w: usize, h: usize, pixels: &[u8]) {
    OWNER.with(|owner| {
        let mut owner = owner.borrow_mut();
        if owner.is_none() { *owner = arboard::Clipboard::new().ok(); }
        if let Some(clipboard) = owner.as_mut() {
            let _ = clipboard.set_image(arboard::ImageData { width: w, height: h, bytes: std::borrow::Cow::Borrowed(pixels) });
        }
    });
}
pub fn proposed(system: Option<(usize, usize)>, internal: Option<(usize, usize)>, fallback: (usize, usize)) -> (usize, usize) {
    system.or(internal).unwrap_or(fallback)
}
pub fn read() -> Option<(usize, usize)> {
    #[cfg(windows)]
    if let Some(size) = windows::read() { return Some(size); }
    let mut clipboard = arboard::Clipboard::new().ok()?;
    if let Ok(image) = clipboard.get_image() {
        return (image.width > 0 && image.height > 0).then_some((image.width, image.height));
    }
    clipboard.get_text().ok().and_then(|s| text_paths(&s).iter().find_map(|p| file_dimensions(p)))
}

#[cfg(windows)]
mod windows {
    use super::*;
    use std::{ffi::c_void, os::windows::ffi::OsStringExt};
    #[link(name = "user32")]
    extern "system" {
        fn OpenClipboard(window: *mut c_void) -> i32;
        fn CloseClipboard() -> i32;
        fn GetClipboardData(format: u32) -> *mut c_void;
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GlobalLock(handle: *mut c_void) -> *mut c_void;
        fn GlobalUnlock(handle: *mut c_void) -> i32;
        fn GlobalSize(handle: *mut c_void) -> usize;
    }
    #[link(name = "shell32")]
    extern "system" { fn DragQueryFileW(drop: *mut c_void, index: u32, buffer: *mut u16, size: u32) -> u32; }
    struct Clipboard;
    impl Drop for Clipboard { fn drop(&mut self) { unsafe { CloseClipboard(); } } }
    pub fn read() -> Option<(usize, usize)> {
        let paths = unsafe {
            if OpenClipboard(std::ptr::null_mut()) == 0 { return None; }
            let _clipboard = Clipboard;
            for format in [17, 8] { // CF_DIBV5 / CF_DIB: browsers and native image copies.
                let handle = GetClipboardData(format);
                if handle.is_null() || GlobalSize(handle) < 12 { continue; }
                let data = GlobalLock(handle) as *const u8;
                if data.is_null() { continue; }
                let header = std::ptr::read_unaligned(data as *const u32);
                let size = if header >= 40 {
                    let w = std::ptr::read_unaligned(data.add(4) as *const i32);
                    let h = std::ptr::read_unaligned(data.add(8) as *const i32).checked_abs();
                    h.filter(|h| w > 0 && *h > 0).map(|h| (w as usize, h as usize))
                } else if header == 12 {
                    let w = std::ptr::read_unaligned(data.add(4) as *const u16);
                    let h = std::ptr::read_unaligned(data.add(6) as *const u16);
                    (w > 0 && h > 0).then_some((w as usize, h as usize))
                } else { None };
                GlobalUnlock(handle);
                if size.is_some() { return size; }
            }
            // Explorer's Copy command puts file paths in CF_HDROP, rather than image pixels.
            let drop = GetClipboardData(15);
            if drop.is_null() { return None; }
            let mut files = Vec::new();
            for i in 0..DragQueryFileW(drop, u32::MAX, std::ptr::null_mut(), 0) {
                let len = DragQueryFileW(drop, i, std::ptr::null_mut(), 0);
                let mut path = vec![0u16; len as usize + 1];
                let read = DragQueryFileW(drop, i, path.as_mut_ptr(), path.len() as u32);
                if read > 0 { files.push(PathBuf::from(std::ffi::OsString::from_wide(&path[..read as usize]))); }
            }
            files
        };
        paths.iter().find_map(|path| file_dimensions(path))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn current_system_image_takes_priority_and_internal_copy_is_available_offline() {
        assert_eq!(proposed(Some((500, 600)), Some((100, 200)), (1280, 720)), (500, 600));
        assert_eq!(proposed(None, Some((500, 600)), (1280, 720)), (500, 600));
        assert_eq!(proposed(None, None, (1280, 720)), (1280, 720));
    }
    #[test]
    fn copied_file_uri_and_image_header_dimensions() {
        let path = std::env::temp_dir().join(format!("masterpaint-new-image-{}.png", std::process::id()));
        image::save_buffer(&path, &vec![0; 500 * 600 * 4], 500, 600, image::ColorType::Rgba8).unwrap();
        assert_eq!(file_dimensions(&path), Some((500, 600)));
        let uri = format!("file://{}", path.to_string_lossy().replace(' ', "%20"));
        assert_eq!(text_paths(&uri), vec![path.clone()]);
        std::fs::remove_file(path).unwrap();
        assert!(text_paths("plain text").is_empty());
    }
}
