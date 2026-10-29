# Construit l'interface Rust (Slint) pour le web et la publie dans /rust-app/ (index.html + pkg/).
# Les fichiers intermédiaires restent dans le dossier de compilation (MasterPaint-build, voir
# .cargo/config.toml), hors du dépôt.
# Prérequis : cible wasm32-unknown-unknown et wasm-bindgen-cli à la même version que la crate
# (cargo install wasm-bindgen-cli --version <version de Cargo.lock> --locked).
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$target = (cargo metadata --no-deps --format-version 1 | ConvertFrom-Json).target_directory
# rawler (lecture des RAW) chronomètre son dématriçage avec std::time::Instant, qui fait
# paniquer le navigateur (« time not implemented on this platform ») : copie corrigée, hors du
# dépôt (même correctif que build-ui-web.sh)
cargo fetch --target wasm32-unknown-unknown | Out-Null
$cargoHome = if ($env:CARGO_HOME) { $env:CARGO_HOME } else { Join-Path $env:USERPROFILE '.cargo' }
$rawSrc = Get-ChildItem (Join-Path $cargoHome 'registry\src') -Directory | ForEach-Object { Join-Path $_.FullName 'rawler-0.8.0' } | Where-Object { Test-Path $_ } | Select-Object -First 1
$rawDst = Join-Path $target 'rawler-wasm'
if (-not (Test-Path (Join-Path $rawDst '.patched'))) {
    if (Test-Path $rawDst) { Remove-Item $rawDst -Recurse -Force }
    Copy-Item $rawSrc $rawDst -Recurse
    Set-Content (Join-Path $rawDst 'src\wasm_instant.rs') "pub struct Stamp;`nimpl Stamp {`n    pub fn elapsed(&self) -> std::time::Duration { std::time::Duration::ZERO }`n}`npub fn now() -> Stamp { Stamp }`n"
    Add-Content (Join-Path $rawDst 'src\lib.rs') "pub mod wasm_instant;"
    Get-ChildItem (Join-Path $rawDst 'src') -Recurse -Filter *.rs | Where-Object { $_.FullName -notmatch '\\bin\\' } | ForEach-Object {
        $t = Get-Content $_.FullName -Raw
        if ($t -match 'Instant::now\(\)') { Set-Content $_.FullName ($t -replace 'Instant::now\(\)', 'crate::wasm_instant::now()') -NoNewline }
    }
    New-Item (Join-Path $rawDst '.patched') -ItemType File | Out-Null
}
$rawPath = $rawDst -replace '\\', '/'
cargo build -p masterpaint-ui --lib --target wasm32-unknown-unknown --release --config "patch.crates-io.rawler.path='$rawPath'"
if ($LASTEXITCODE) { throw 'compilation wasm' }
$pkg = Join-Path $target 'web-pkg'
wasm-bindgen (Join-Path $target 'wasm32-unknown-unknown\release\masterpaint_ui.wasm') --target web --no-typescript --out-dir $pkg
if ($LASTEXITCODE) { throw 'wasm-bindgen' }
# publication à la racine du site : /rust-app/ (à côté de index.html, /fonts/, /downloads/)
$dest = Join-Path $PSScriptRoot '..\rust-app'
New-Item -ItemType Directory -Force (Join-Path $dest 'pkg') | Out-Null
Copy-Item masterpaint-ui\web\index.html $dest -Force
# worker de calcul (effets, Camera Raw, RAW, décodage hors du fil de l'interface)
Copy-Item masterpaint-ui\web\mp-worker.js $dest -Force
# la version Rust est aussi la page d'accueil du site (la version HTML : html/)
Copy-Item masterpaint-ui\web\index.html (Join-Path $PSScriptRoot '..\index.html') -Force
Copy-Item (Join-Path $pkg '*') (Join-Path $dest 'pkg') -Force
$w = Get-Item (Join-Path $pkg 'masterpaint_ui_bg.wasm')
"ok : /rust-app/ ({0:N1} Mo de wasm ; servir le dossier tel quel, en gzip/brotli)" -f ($w.Length / 1MB)
