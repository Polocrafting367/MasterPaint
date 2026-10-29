//! MasterPaint de bureau / mobile : la même interface que masterpaint.fr (HTML/JS, copiée dans
//! `dist/` par build.rs) affichée dans la WebView du système, avec le moteur d'effets Rust natif.

#[tauri::command]
fn core_info() -> serde_json::Value {
    serde_json::json!({
        "native": true,
        "effects": masterpaint_core::EFFECTS,
        "threads": std::thread::available_parallelism().map(|n| n.get()).unwrap_or(1),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![core_info])
        .run(tauri::generate_context!())
        .expect("impossible de démarrer MasterPaint");
}
