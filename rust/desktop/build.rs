//! Copie l'interface web de MasterPaint (racine du projet) dans `dist/`, puis prépare Tauri.
//! Seuls les fichiers servis au navigateur sont copiés (pas `rust/`, `docs/`, sauvegardes…).

use std::fs;
use std::path::Path;

const FILES: &[&str] = &["index.html", "favicon.ico", "manifest.webmanifest", "sw.js"];
const DIRS: &[&str] = &["css", "js", "fonts", "icons", "IMG", "vendor", "build"];

fn copy_dir(src: &Path, dst: &Path) {
    fs::create_dir_all(dst).expect("création de dist/");
    for e in fs::read_dir(src).expect("lecture du dossier web").flatten() {
        let p = e.path();
        let t = dst.join(e.file_name());
        if p.is_dir() {
            copy_dir(&p, &t);
        } else if p.extension().is_none_or(|x| x != "bak") {
            copy_if_newer(&p, &t);
        }
    }
}

fn copy_if_newer(src: &Path, dst: &Path) {
    let (Ok(a), b) = (fs::metadata(src), fs::metadata(dst)) else { return };
    let same = b.is_ok_and(|b| b.len() == a.len() && b.modified().ok() >= a.modified().ok());
    if !same {
        fs::copy(src, dst).unwrap_or_else(|e| panic!("copie de {} : {e}", src.display()));
    }
}

fn main() {
    let web = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let dist = Path::new(env!("CARGO_MANIFEST_DIR")).join("dist");
    for f in FILES {
        let p = web.join(f);
        println!("cargo:rerun-if-changed={}", p.display());
        fs::create_dir_all(&dist).expect("création de dist/");
        copy_if_newer(&p, &dist.join(f));
    }
    for d in DIRS {
        let p = web.join(d);
        println!("cargo:rerun-if-changed={}", p.display());
        if p.is_dir() {
            copy_dir(&p, &dist.join(d));
        }
    }
    tauri_build::build()
}
