// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
fn main() {
    // MouseCursor.custom (curseur des outils sur la toile) est encore « expérimental » pour Slint ;
    // à poser avant CompilerConfiguration::new, qui lit cette variable
    std::env::set_var("SLINT_ENABLE_EXPERIMENTAL_FEATURES", "1");
    // style « fluent » : seuls nos propres contrôles Windows 10 sont utilisés, mais il fixe
    // aussi l'apparence des éléments Slint standard (popups, barres de défilement).
    // traductions : textes @tr("…") des fichiers .slint, traduits par lang/<langue>/LC_MESSAGES/
    // masterpaint-ui.po (fichiers embarqués ; tools/gen_lang.py les tient à jour). Le français
    // est la langue des sources ; pas de contexte par composant (msgid seul).
    let config = slint_build::CompilerConfiguration::new()
        .with_style("fluent-light".into())
        .with_bundled_translations("lang")
        .with_default_translation_context(slint_build::DefaultTranslationContext::None);
    slint_build::compile_with_config("ui/app.slint", config).expect("compilation de l'interface Slint");
    // traductions des textes Rust (i18n.rs) : .po compressés, décompressés à l'usage
    let out = std::path::PathBuf::from(std::env::var("OUT_DIR").unwrap());
    for code in ["en", "es", "de", "it", "pt"] {
        use std::io::Write;
        let src = format!("lang/{code}/LC_MESSAGES/masterpaint-ui.po");
        println!("cargo:rerun-if-changed={src}");
        let text = std::fs::read(&src).expect("fichier de traduction");
        let mut z = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::best());
        z.write_all(&text).unwrap();
        std::fs::write(out.join(format!("po-{code}.z")), z.finish().unwrap()).unwrap();
    }
    // exécutable Windows : logo MasterPaint (icône du fichier et de la barre des tâches), y
    // compris en compilation croisée depuis Linux (windres de mingw-w64)
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("../packaging/icons/icon.ico");
        res.set("ProductName", "MasterPaint");
        res.set("FileDescription", "MasterPaint — éditeur d'images");
        let _ = res.compile();
    }
}
