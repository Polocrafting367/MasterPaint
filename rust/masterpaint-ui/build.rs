fn main() {
    // style « fluent » : seuls nos propres contrôles Windows 10 sont utilisés, mais il fixe
    // aussi l'apparence des éléments Slint standard (popups, barres de défilement).
    let config = slint_build::CompilerConfiguration::new().with_style("fluent-light".into());
    slint_build::compile_with_config("ui/app.slint", config).expect("compilation de l'interface Slint");
    // exécutable Windows : logo MasterPaint (icône du fichier et de la barre des tâches), y
    // compris en compilation croisée depuis Linux (windres de mingw-w64)
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("../desktop/icons/icon.ico");
        res.set("ProductName", "MasterPaint");
        res.set("FileDescription", "MasterPaint — éditeur d'images");
        let _ = res.compile();
    }
}
