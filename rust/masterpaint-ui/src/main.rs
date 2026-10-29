// Exécutable de bureau : toute l'application est dans la bibliothèque (partagée avec le web).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    masterpaint_ui::main();
}
