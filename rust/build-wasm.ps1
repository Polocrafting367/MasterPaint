# Compile le cœur Rust en WebAssembly -> html/build/masterpaint_core.wasm
#
# Utilise rustc directement (pas cargo / rust-lld), puis rust/tools/wasm_objlink.py
# pour finaliser le module : fonctionne même quand Windows Smart App Control
# bloque cargo.exe et rust-lld.exe.
#
# Prérequis : rustup + cible wasm32-unknown-unknown, Python 3.
#   rustup target add wasm32-unknown-unknown
param([switch]$Check)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$rustc = Join-Path $env:USERPROFILE '.cargo\bin\rustc.exe'
if (-not (Test-Path $rustc)) { $rustc = 'rustc' }
$src = Join-Path $PSScriptRoot 'masterpaint-core\src\lib.rs'
$obj = Join-Path $env:TEMP 'masterpaint_core_wasm.o'
$out = Join-Path $root 'html\build\masterpaint_core.wasm'

# rustc écrit ses avertissements sur stderr : ne pas les traiter comme des erreurs
$ErrorActionPreference = 'Continue'
& $rustc --edition 2021 --crate-name masterpaint_core --crate-type cdylib --cfg 'feature=\"c-abi\"' `
    --target wasm32-unknown-unknown --emit obj `
    -C opt-level=3 -C panic=abort -C codegen-units=1 -C debuginfo=0 `
    -C target-feature=+bulk-memory,+mutable-globals,+sign-ext,+nontrapping-fptoint `
    -o $obj $src
if ($LASTEXITCODE -ne 0) { throw "rustc a échoué ($LASTEXITCODE)" }
$ErrorActionPreference = 'Stop'
if ($Check) { Write-Host 'Compilation OK (objet seulement)'; exit 0 }

python -I (Join-Path $PSScriptRoot 'tools\wasm_objlink.py') $obj $out
if ($LASTEXITCODE -ne 0) { throw 'wasm_objlink.py a échoué' }
Remove-Item $obj -ErrorAction SilentlyContinue
Get-Item $out | Select-Object FullName, Length
