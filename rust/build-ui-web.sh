#!/usr/bin/env bash
# Construit l'interface Rust (Slint) pour le web et la publie dans /rust-app/ (index.html + pkg/)
# et à la racine du site (index.html, qui charge rust-app/pkg/).
# Équivalent Linux / macOS de build-ui-web.ps1. Les fichiers intermédiaires restent dans le
# dossier de compilation (MasterPaint-build, voir .cargo/config.toml), hors du dépôt.
# Prérequis : cible wasm32-unknown-unknown et wasm-bindgen-cli à la version de Cargo.lock.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
target=$(cargo metadata --no-deps --format-version 1 | grep -o '"target_directory":"[^"]*"' | cut -d'"' -f4)
# rawler (lecture des RAW) chronomètre son dématriçage avec std::time::Instant, qui fait paniquer
# le navigateur (« time not implemented on this platform ») : copie corrigée, hors du dépôt
cargo fetch --target wasm32-unknown-unknown >/dev/null 2>&1 || true
raw_src=$(ls -d "$HOME"/.cargo/registry/src/*/rawler-0.8.0 | head -1)
raw_dst="$target/rawler-wasm"
if [[ ! -f $raw_dst/.patched ]]; then
    rm -rf "$raw_dst"
    cp -r "$raw_src" "$raw_dst"
    chmod -R u+w "$raw_dst"
    printf '%s\n' 'pub struct Stamp;' 'impl Stamp {' '    pub fn elapsed(&self) -> std::time::Duration { std::time::Duration::ZERO }' '}' 'pub fn now() -> Stamp { Stamp }' > "$raw_dst/src/wasm_instant.rs"
    echo 'pub mod wasm_instant;' >> "$raw_dst/src/lib.rs"
    grep -rl 'Instant::now()' "$raw_dst/src" --include=*.rs | grep -v '/bin/' | xargs sed -i 's/Instant::now()/crate::wasm_instant::now()/'
    touch "$raw_dst/.patched"
fi
cargo build -p masterpaint-ui --lib --target wasm32-unknown-unknown --release --config "patch.crates-io.rawler.path='$raw_dst'"
wasm-bindgen "$target/wasm32-unknown-unknown/release/masterpaint_ui.wasm" --target web --no-typescript --out-dir "$target/web-pkg"
# symboles de débogage (8 Mo) retirés, sauf MP_KEEP_NAMES=1 (profilage dans le navigateur)
if [ "${MP_KEEP_NAMES:-0}" != "1" ]; then python3 tools/strip-wasm-names.py "$target/web-pkg/masterpaint_ui_bg.wasm"; fi
dest=../rust-app
mkdir -p "$dest/pkg"
cp masterpaint-ui/web/index.html "$dest/"
# worker de calcul (effets, Camera Raw, RAW, décodage hors du fil de l'interface)
cp masterpaint-ui/web/mp-worker.js "$dest/"
# la version Rust est aussi la page d'accueil du site (la version HTML : html/)
cp masterpaint-ui/web/index.html ../index.html
cp "$target"/web-pkg/* "$dest/pkg/"
echo "ok : /rust-app/ ($(du -h "$dest/pkg/masterpaint_ui_bg.wasm" | cut -f1) de wasm)"
