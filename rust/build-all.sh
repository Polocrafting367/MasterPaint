#!/usr/bin/env bash
# Compile la version Rust pour le web, Linux (archive + AppImage) et Windows (exe portable),
# puis dépose les fichiers dans /downloads/ sous les noms attendus par l'application
# (download_url dans masterpaint-ui/src/lib.rs). macOS : GitHub Actions
# (.github/workflows/rust-ui-release.yml) ; Android : pas encore de version Rust.
# Cibles : all (défaut), web, linux (archive, AppImage, Flatpak), flatpak, windows.
#
# Prérequis (Linux) : rustup (~/.cargo), cibles wasm32-unknown-unknown et
# x86_64-pc-windows-gnu, wasm-bindgen-cli à la version de Cargo.lock, mingw-w64.
# AppImage : appimagetool (voir plus bas).
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
ver=$(grep -m1 '^version' masterpaint-ui/Cargo.toml | cut -d'"' -f2)
target=$(cargo metadata --no-deps --format-version 1 | grep -o '"target_directory":"[^"]*"' | cut -d'"' -f4)
dl=../downloads
mkdir -p "$dl"
only="${1:-all}"

if [[ $only == all || $only == web ]]; then
    echo "== web"
    ./build-ui-web.sh
fi

if [[ $only == all || $only == linux ]]; then
    echo "== Linux"
    cargo build -p masterpaint-ui --release
    bin="$target/release/masterpaint-ui"
    strip "$bin"
    tar -C "$target/release" -czf "$dl/MasterPaint_${ver}_linux_x86_64.tar.gz" masterpaint-ui
    app="$target/MasterPaint.AppDir"
    rm -rf "$app"
    mkdir -p "$app/usr/bin" "$app/usr/share/icons/hicolor/128x128/apps"
    cp "$bin" "$app/usr/bin/masterpaint"
    cp desktop/icons/128x128.png "$app/usr/share/icons/hicolor/128x128/apps/fr.masterpaint.app.png"
    cp desktop/icons/128x128.png "$app/fr.masterpaint.app.png"
    sed -e 's/^Exec=.*/Exec=masterpaint %F/' -e 's/^StartupWMClass=.*/StartupWMClass=masterpaint/' \
        desktop/flatpak/fr.masterpaint.app.desktop > "$app/fr.masterpaint.app.desktop"
    printf '#!/bin/sh\nexec "$(dirname "$(readlink -f "$0")")/usr/bin/masterpaint" "$@"\n' > "$app/AppRun"
    chmod +x "$app/AppRun"
    # appimagetool (https://github.com/AppImage/appimagetool/releases) : chemin dans
    # APPIMAGETOOL, ou appimagetool-x86_64.AppImage dans le dossier de compilation
    tool="${APPIMAGETOOL:-$target/appimagetool-x86_64.AppImage}"
    out="$dl/MasterPaint_${ver}_amd64.AppImage"
    if [[ -x $tool ]]; then
        # sans FUSE (conteneurs, certaines distributions) : l'outil s'extrait lui-même
        ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$tool" "$app" "$out"
    elif command -v mksquashfs >/dev/null; then
        # sans appimagetool : une AppImage = lanceur (runtime type 2) + image squashfs (zstd).
        # Le lanceur est repris d'une AppImage déjà publiée (RUNTIME, sinon la plus récente de
        # downloads/ autre que celle produite) : ses N premiers octets, N = --appimage-offset.
        prev="${APPIMAGE_RUNTIME_FROM:-$(ls -t "$dl"/MasterPaint_*_amd64.AppImage 2>/dev/null | grep -v -x "$out" | head -1)}"
        rt="$target/appimage-runtime"
        if [[ -n ${RUNTIME:-} ]]; then
            cp "$RUNTIME" "$rt"
        elif [[ -n $prev ]]; then
            off=$("$prev" --appimage-offset)
            head -c "$off" "$prev" > "$rt"
        fi
        if [[ -s $rt ]]; then
            rm -f "$target/appimage.sqfs"
            mksquashfs "$app" "$target/appimage.sqfs" -root-owned -noappend -comp zstd -b 131072 -quiet
            cat "$rt" "$target/appimage.sqfs" > "$out"
            chmod +x "$out"
        else
            echo "AppImage non produite : ni appimagetool ($tool) ni lanceur à reprendre"
        fi
    else
        echo "AppImage non produite : appimagetool introuvable ($tool)"
    fi
fi

# Flatpak : paquet unique (fr.masterpaint.app.flatpak) fait du binaire Linux, sur le runtime
# org.freedesktop.Platform 25.08 (installé par Flathub à l'installation du paquet). Construit
# avec les commandes de base de flatpak (build-init / build-finish / build-export /
# build-bundle) : flatpak-builder n'est pas nécessaire.
if [[ $only == all || $only == linux || $only == flatpak ]]; then
    if command -v flatpak >/dev/null && flatpak info org.freedesktop.Sdk//25.08 >/dev/null 2>&1; then
        echo "== Flatpak"
        bin="$target/release/masterpaint-ui"
        [[ -x $bin ]] || cargo build -p masterpaint-ui --release
        fp="$target/flatpak"
        rm -rf "$fp"
        flatpak build-init "$fp/app" fr.masterpaint.app org.freedesktop.Sdk org.freedesktop.Platform 25.08
        f="$fp/app/files"
        install -Dm755 "$bin" "$f/bin/masterpaint"
        mkdir -p "$f/share/applications"
        sed -e 's/^Exec=.*/Exec=masterpaint %F/' -e 's/^StartupWMClass=.*/StartupWMClass=masterpaint/' \
            desktop/flatpak/fr.masterpaint.app.desktop > "$f/share/applications/fr.masterpaint.app.desktop"
        install -Dm644 desktop/flatpak/fr.masterpaint.app.metainfo.xml "$f/share/metainfo/fr.masterpaint.app.metainfo.xml"
        install -Dm644 desktop/icons/128x128.png "$f/share/icons/hicolor/128x128/apps/fr.masterpaint.app.png"
        install -Dm644 ../icons/icon-512.png "$f/share/icons/hicolor/512x512/apps/fr.masterpaint.app.png"
        flatpak build-finish "$fp/app" --command=masterpaint \
            --socket=wayland --socket=fallback-x11 --share=ipc --device=dri --share=network \
            --filesystem=xdg-pictures --filesystem=xdg-documents --filesystem=xdg-download
        flatpak build-export "$fp/repo" "$fp/app" stable
        flatpak build-bundle "$fp/repo" "$dl/fr.masterpaint.app.flatpak" fr.masterpaint.app stable \
            --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo
    else
        echo "Flatpak non produit : flatpak ou le SDK org.freedesktop.Sdk//25.08 manque"
    fi
fi

if [[ $only == all || $only == windows ]]; then
    echo "== Windows"
    cargo build -p masterpaint-ui --release --target x86_64-pc-windows-gnu
    cp "$target/x86_64-pc-windows-gnu/release/masterpaint-ui.exe" "$dl/MasterPaint-${ver}-windows-x64.exe"
    # installeur (menu Démarrer, bureau, désinstallation, fichiers .illu) : NSIS
    # (Ubuntu : sudo apt install nsis ; GitHub Actions : préinstallé sur windows-latest)
    if command -v makensis >/dev/null; then
        makensis -V2 -DVERSION="$ver" -DEXE="$(readlink -f "$dl/MasterPaint-${ver}-windows-x64.exe")" \
            -DICON="$(readlink -f desktop/icons/icon.ico)" \
            -DOUT="$(readlink -f "$dl")/MasterPaint_${ver}_x64-setup.exe" desktop/installer/masterpaint.nsi
    else
        echo "Installeur Windows non produit : makensis introuvable (sudo apt install nsis)"
    fi
fi

ls -la "$dl"
