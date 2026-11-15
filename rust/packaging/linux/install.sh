#!/bin/sh
# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
# Installe MasterPaint pour l'utilisateur courant (sans droits administrateur) : programme dans
# ~/.local/bin, lanceur dans le menu des applications, icône, types .illu / .pdn, et MasterPaint
# proposé à l'ouverture des images, photos RAW, .psd, .pdn, .illu (double-clic, « Ouvrir avec »).
#   ./install.sh            installer (ou mettre à jour)
#   ./install.sh --remove   désinstaller
set -e
here=$(cd "$(dirname "$0")" && pwd)
data="${XDG_DATA_HOME:-$HOME/.local/share}"
bin="$HOME/.local/bin"
refresh() {
    command -v update-mime-database >/dev/null && update-mime-database "$data/mime" >/dev/null 2>&1 || true
    command -v update-desktop-database >/dev/null && update-desktop-database "$data/applications" >/dev/null 2>&1 || true
    command -v gtk-update-icon-cache >/dev/null && gtk-update-icon-cache -q -t "$data/icons/hicolor" >/dev/null 2>&1 || true
}
if [ "${1:-}" = "--remove" ]; then
    rm -f "$bin/masterpaint" "$data/applications/fr.masterpaint.app.desktop" \
          "$data/icons/hicolor/512x512/apps/fr.masterpaint.app.png" "$data/mime/packages/fr.masterpaint.app.xml"
    refresh
    echo "MasterPaint désinstallé (vos réglages restent dans ~/.config)."
    exit 0
fi
mkdir -p "$bin" "$data/applications" "$data/icons/hicolor/512x512/apps" "$data/mime/packages"
install -m755 "$here/masterpaint" "$bin/masterpaint"
install -m644 "$here/fr.masterpaint.app.png" "$data/icons/hicolor/512x512/apps/fr.masterpaint.app.png"
install -m644 "$here/fr.masterpaint.app.mime.xml" "$data/mime/packages/fr.masterpaint.app.xml"
# chemin complet : le lanceur marche même si ~/.local/bin n'est pas dans le PATH
sed "s|^Exec=.*|Exec=$bin/masterpaint %F|" "$here/fr.masterpaint.app.desktop" > "$data/applications/fr.masterpaint.app.desktop"
refresh
# projets MasterPaint et Paint.NET : MasterPaint par défaut (les images gardent leur visionneuse)
if command -v xdg-mime >/dev/null; then
    xdg-mime default fr.masterpaint.app.desktop application/x-masterpaint image/x-paintnet 2>/dev/null || true
fi
echo "MasterPaint installé : menu des applications, double-clic sur les .illu et .pdn,"
echo "« Ouvrir avec » pour les images, photos RAW et .psd."
