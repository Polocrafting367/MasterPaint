#!/usr/bin/env bash
# Compile toutes les versions de MasterPaint (Rust) et dépose les fichiers dans /downloads/
# sous des noms FIXES (sans numéro de version), ceux des boutons Télécharger de l'application
# (download_url dans masterpaint-ui/src/lib.rs) : chaque compilation remplace simplement le
# fichier précédent. Une cible qui échoue n'arrête pas les autres ; bilan à la fin.
#
# Usage : rust/build-all.sh [cible…]   (sans cible : tout ce que cette machine sait compiler)
#   web      version navigateur (rust-app/ + page d'accueil du site)
#   linux    archive .tar.gz + AppImage            flatpak   paquet Flatpak
#   windows  exe portable + installeur NSIS        apk       Android natif Rust/Slint ARM64 ; webapk : ancienne coquille WebView
#   macos    .dmg universel (sur un Mac)           ios       .ipa non signée (sur un Mac)
# Sur Linux, « all » = web linux flatpak windows apk ; sur macOS, « all » = web macos ios apk.
# macOS et iOS ne se compilent que sur un Mac (outils Apple : lipo, codesign, hdiutil, Xcode).
#
# Prérequis (Linux) : rustup (~/.cargo), cibles wasm32-unknown-unknown et
# x86_64-pc-windows-gnu, wasm-bindgen-cli à la version de Cargo.lock, mingw-w64, nsis,
# mksquashfs, flatpak + org.freedesktop.Sdk//25.08 ; APK : /opt/lampp/htdocs/WebApk (JDK et
# SDK Android installés par son build.sh au premier lancement).
# Prérequis (macOS) : rustup avec aarch64-apple-darwin, x86_64-apple-darwin, aarch64-apple-ios.
set -euo pipefail
cd "$(dirname "$0")"
export PATH="$HOME/.cargo/bin:$PATH"
ver=$(grep -m1 '^version' masterpaint-ui/Cargo.toml | cut -d'"' -f2)
target=$(cargo metadata --no-deps --format-version 1 | grep -o '"target_directory":"[^"]*"' | cut -d'"' -f4)
dl=../downloads
mkdir -p "$dl"
# noms publiés (mêmes noms dans download_url, masterpaint-ui/src/lib.rs)
win_exe="$dl/MasterPaint-windows-x64.exe"
win_setup="$dl/MasterPaint-windows-setup.exe"
linux_tar="$dl/MasterPaint-linux-x86_64.tar.gz"
appimage="$dl/MasterPaint-linux-x86_64.AppImage"
flatpak_out="$dl/MasterPaint.flatpak"
apk_out="$dl/MasterPaint-android.apk"
dmg="$dl/MasterPaint-macos.dmg"
ipa_out="$dl/MasterPaint-ios.ipa"
mac=false
[[ $(uname -s) == Darwin ]] && mac=true
if [[ $# -eq 0 || $* == all ]]; then
    if $mac; then set -- web macos ios apk; else set -- web linux flatpak windows apk; fi
fi
wanted=" $* "
want() { [[ $wanted == *" $1 "* ]]; }
done_list=()
fail_list=()
# lance une cible dans un sous-shell (set -e actif dedans) : un échec est noté, pas fatal
run() {
    local t=$1
    set +e
    ( set -e; "build_$t" )
    local rc=$?
    set -e
    if [[ $rc -eq 0 ]]; then done_list+=("$t"); else fail_list+=("$t"); echo "!! $t : échec (code $rc)"; fi
}

build_web() {
    echo "== web"
    ./build-ui-web.sh
}

build_linux() {
    echo "== Linux"
    cargo build -p masterpaint-ui --release
    bin="$target/release/masterpaint-ui"
    strip "$bin"
    tar -C "$target/release" -czf "$linux_tar.tmp" masterpaint-ui
    mv -f "$linux_tar.tmp" "$linux_tar"
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
    out="$appimage"
    if [[ -x $tool ]]; then
        # sans FUSE (conteneurs, certaines distributions) : l'outil s'extrait lui-même
        ARCH=x86_64 APPIMAGE_EXTRACT_AND_RUN=1 "$tool" "$app" "$out.tmp"
        mv -f "$out.tmp" "$out"
    elif command -v mksquashfs >/dev/null; then
        # sans appimagetool : une AppImage = lanceur (runtime type 2) + image squashfs (zstd).
        # Le lanceur (ses N premiers octets, N = --appimage-offset) est repris de l'AppImage
        # déjà publiée AVANT de la remplacer, et gardé dans le dossier de compilation
        # (appimage-runtime) pour les fois suivantes. RUNTIME : lanceur fourni à la main.
        rt="$target/appimage-runtime"
        prev="${APPIMAGE_RUNTIME_FROM:-$(ls -t "$out" "$dl"/MasterPaint_*_amd64.AppImage 2>/dev/null | head -1 || true)}"
        if [[ -n ${RUNTIME:-} ]]; then
            cp "$RUNTIME" "$rt"
        elif [[ -n $prev && -x $prev ]]; then
            off=$("$prev" --appimage-offset) && head -c "$off" "$prev" > "$rt.new" && mv -f "$rt.new" "$rt"
        fi
        if [[ -s $rt ]]; then
            rm -f "$target/appimage.sqfs"
            mksquashfs "$app" "$target/appimage.sqfs" -root-owned -noappend -comp zstd -b 131072 -quiet
            cat "$rt" "$target/appimage.sqfs" > "$out.tmp"
            chmod +x "$out.tmp"
            mv -f "$out.tmp" "$out"
        else
            echo "AppImage non produite : ni appimagetool ($tool) ni lanceur à reprendre"
        fi
    else
        echo "AppImage non produite : appimagetool introuvable ($tool)"
    fi
}

# Flatpak : paquet unique (fr.masterpaint.app.flatpak) fait du binaire Linux, sur le runtime
# org.freedesktop.Platform 25.08 (installé par Flathub à l'installation du paquet). Construit
# avec les commandes de base de flatpak (build-init / build-finish / build-export /
# build-bundle) : flatpak-builder n'est pas nécessaire.
build_flatpak() {
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
        flatpak build-bundle "$fp/repo" "$flatpak_out.tmp" fr.masterpaint.app stable \
            --runtime-repo=https://dl.flathub.org/repo/flathub.flatpakrepo
        mv -f "$flatpak_out.tmp" "$flatpak_out"
    else
        echo "Flatpak non produit : flatpak ou le SDK org.freedesktop.Sdk//25.08 manque"
        return 1
    fi
}

build_windows() {
    echo "== Windows"
    cargo build -p masterpaint-ui --release --target x86_64-pc-windows-gnu
    cp "$target/x86_64-pc-windows-gnu/release/masterpaint-ui.exe" "$win_exe.tmp"
    mv -f "$win_exe.tmp" "$win_exe"
    # installeur (menu Démarrer, bureau, désinstallation, fichiers .illu) : NSIS
    # (Ubuntu : sudo apt install nsis ; GitHub Actions : préinstallé sur windows-latest)
    if command -v makensis >/dev/null; then
        makensis -V2 -DVERSION="$ver" -DEXE="$(readlink -f "$win_exe")" \
            -DICON="$(readlink -f desktop/icons/icon.ico)" \
            -DOUT="$(readlink -f "$dl")/$(basename "$win_setup").tmp" desktop/installer/masterpaint.nsi
        mv -f "$win_setup.tmp" "$win_setup"
    else
        echo "Installeur Windows non produit : makensis introuvable (sudo apt install nsis)"
    fi
}

# Android : coquille WebApk (WebView plein écran sur https://masterpaint.fr/, pont JavaScript
# pour fichiers, partage, widget) — le contenu suit le site, l'APK ne change qu'avec sa version.
build_apk() {
    echo "== Android natif (Rust/Slint, ARM64)"
    ./build-ui-android.sh
    cp "$dl/MasterPaint-android-native.apk" "$apk_out.tmp"
    mv -f "$apk_out.tmp" "$apk_out"
}

build_webapk() {
    echo "== Android (APK)"
    webapk="${WEBAPK:-../../WebApk}"
    cfg="$webapk/apps/masterpaint/masterpaint.properties"
    if [[ -f $webapk/build.sh && -f $cfg ]]; then
        # version de l'APK = celle de l'application ; versionCode croissant : 3.3.0 → 30300
        IFS=. read -r ma mi pa <<< "$ver"
        code=$((ma * 10000 + mi * 100 + pa))
        sed -i -e "s|^app.version=.*|app.version=$ver|" -e "s|^app.versionCode=.*|app.versionCode=$code|" \
            -e "s|^app.output=.*|app.output=../../../MasterPaint/downloads/MasterPaint-android-webview.apk|" "$cfg"
        cfg=$(realpath "$cfg")
        # Some WebApk checkouts contain an unfinished, unregistered widget screen.
        # Build an isolated copy without that orphan; never change the shared sources.
        orphan=app/src/main/java/fr/webapk/shell/WidgetConfigActivity.kt
        if [[ -f $webapk/$orphan ]] && ! grep -q WidgetConfigActivity "$webapk/app/src/main/AndroidManifest.xml"; then
            webapk_build=$(mktemp -d "${TMPDIR:-/tmp}/masterpaint-webapk.XXXXXX")
            trap 'rm -rf "$webapk_build"' EXIT
            tar -C "$webapk" --exclude=.git --exclude=.gradle --exclude=build --exclude=apps \
                --exclude='*.jks' --exclude='*.keystore' --exclude=local.properties --exclude="$orphan" -cf - . | tar -C "$webapk_build" -xf -
            bash "$webapk_build/build.sh" "$cfg"
        else
            bash "$webapk/build.sh" "$cfg"
        fi
    else
        echo "APK non produit : WebApk introuvable ($webapk, variable WEBAPK)"
        return 1
    fi
}

# macOS : application universelle (Apple Silicon + Intel) dans un .dmg ; signature ad hoc
# (sans compte développeur, macOS demande d'autoriser l'application au premier lancement)
build_macos() {
    echo "== macOS"
    if $mac; then
        rustup target add aarch64-apple-darwin x86_64-apple-darwin >/dev/null
        cargo build -p masterpaint-ui --release --target aarch64-apple-darwin
        cargo build -p masterpaint-ui --release --target x86_64-apple-darwin
        app="$target/MasterPaint.app"
        rm -rf "$app"
        mkdir -p "$app/Contents/MacOS" "$app/Contents/Resources"
        lipo -create -output "$app/Contents/MacOS/MasterPaint" \
            "$target/aarch64-apple-darwin/release/masterpaint-ui" "$target/x86_64-apple-darwin/release/masterpaint-ui"
        cp desktop/icons/icon.icns "$app/Contents/Resources/MasterPaint.icns"
        cat > "$app/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>MasterPaint</string>
  <key>CFBundleDisplayName</key><string>MasterPaint</string>
  <key>CFBundleIdentifier</key><string>fr.masterpaint.app</string>
  <key>CFBundleVersion</key><string>${ver}</string>
  <key>CFBundleShortVersionString</key><string>${ver}</string>
  <key>CFBundleExecutable</key><string>MasterPaint</string>
  <key>CFBundleIconFile</key><string>MasterPaint</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
        codesign --force --deep --sign - "$app"
        hdiutil create -volname MasterPaint -srcfolder "$app" -ov -format UDZO "$dmg"
    else
        echo "macOS non produit : à lancer sur un Mac (rust/build-all.sh macos)"
        return 1
    fi
}

# iOS / iPadOS (expérimental) : application Slint pour aarch64-apple-ios dans une .ipa NON
# signée — à signer avec un compte développeur Apple (Xcode, ou AltStore / Sideloadly) pour
# l'installer. Sans Mac : la version web s'installe depuis Safari (Partager › Sur l'écran d'accueil).
build_ios() {
    echo "== iOS"
    if $mac && xcrun --sdk iphoneos --show-sdk-path >/dev/null 2>&1; then
        rustup target add aarch64-apple-ios >/dev/null
        cargo build -p masterpaint-ui --release --target aarch64-apple-ios
        ipa="$target/ios-ipa"
        app="$ipa/Payload/MasterPaint.app"
        rm -rf "$ipa"
        mkdir -p "$app"
        cp "$target/aarch64-apple-ios/release/masterpaint-ui" "$app/MasterPaint"
        cp ../icons/icon-512.png "$app/AppIcon.png"
        cat > "$app/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleName</key><string>MasterPaint</string>
  <key>CFBundleDisplayName</key><string>MasterPaint</string>
  <key>CFBundleIdentifier</key><string>fr.masterpaint.app</string>
  <key>CFBundleVersion</key><string>${ver}</string>
  <key>CFBundleShortVersionString</key><string>${ver}</string>
  <key>CFBundleExecutable</key><string>MasterPaint</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFiles</key><array><string>AppIcon.png</string></array>
  <key>LSRequiresIPhoneOS</key><true/>
  <key>MinimumOSVersion</key><string>15.0</string>
  <key>UIDeviceFamily</key><array><integer>1</integer><integer>2</integer></array>
  <key>UILaunchScreen</key><dict/>
  <key>UIRequiredDeviceCapabilities</key><array><string>arm64</string></array>
</dict></plist>
PLIST
        (cd "$ipa" && rm -f app.ipa && zip -qr app.ipa Payload)
        cp "$ipa/app.ipa" "$ipa_out"
    else
        echo "iOS non produit : à lancer sur un Mac avec Xcode (rust/build-all.sh ios)"
        return 1
    fi
}

for t in web linux flatpak windows apk webapk macos ios; do
    if want "$t"; then run "$t"; fi
done
# anciens fichiers à numéro de version (avant les noms fixes) : retirés une fois remplacés
replaced() {
    local new=$1
    shift
    if [[ -s $new ]]; then rm -f "$@"; fi
}
replaced "$linux_tar" "$dl"/MasterPaint_[0-9]*_linux_x86_64.tar.gz
replaced "$appimage" "$dl"/MasterPaint_[0-9]*_amd64.AppImage
replaced "$flatpak_out" "$dl"/fr.masterpaint.app.flatpak
replaced "$win_exe" "$dl"/MasterPaint-[0-9]*-windows-x64.exe
replaced "$win_setup" "$dl"/MasterPaint_[0-9]*_x64-setup.exe
replaced "$apk_out" "$dl"/MasterPaint_[0-9]*.apk
replaced "$dmg" "$dl"/MasterPaint_[0-9]*_universal.dmg
replaced "$ipa_out" "$dl"/MasterPaint_[0-9]*_ios.ipa
rm -f "$dl"/*.tmp

echo
echo "== Bilan (version $ver)"
echo "réussi : ${done_list[*]:-aucune}"
ls -la "$dl"
if [[ ${#fail_list[@]} -gt 0 ]]; then
    echo "échoué : ${fail_list[*]}"
    exit 1
fi
