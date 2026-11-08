// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
// Exécutable de bureau : toute l'application est dans la bibliothèque (partagée avec le web).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    masterpaint_ui::main();
}
