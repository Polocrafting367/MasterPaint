#!/usr/bin/env bash
#
# HTCL — lanceur unique de l'agent.
#
#   ./htcl.sh              ouvre l'interface graphique (c'est le cas normal)
#   ./htcl.sh run          surveille en console, sans fenêtre
#   ./htcl.sh check        vérifie dépendances, configuration et serveur
#   ./htcl.sh deps         installe les paquets manquants (demande le mot de passe)
#   ./htcl.sh install      ajoute HTCL au menu des applications
#   ./htcl.sh config       ouvre le fichier de configuration dans un éditeur
#
# Au premier lancement, la configuration est créée toute seule : si le serveur
# HTCL est sur cette machine, l'adresse et le token sont repris de
# ../lib/config.php sans rien demander.

set -u

DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CONFIG="${HTCL_CONFIG:-$HOME/.config/htcl/config.json}"
PY="${PYTHON:-python3}"

vert()  { printf '\033[32m%s\033[0m\n' "$*"; }
rouge() { printf '\033[31m%s\033[0m\n' "$*"; }
gris()  { printf '\033[90m%s\033[0m\n' "$*"; }

# --------------------------------------------------------------- dépendances

PAQUETS_MANQUANTS=()

verifier() {
    PAQUETS_MANQUANTS=()
    command -v "$PY" >/dev/null || { rouge "python3 est absent."; exit 1; }
    command -v import    >/dev/null || PAQUETS_MANQUANTS+=(imagemagick)
    command -v tesseract >/dev/null || PAQUETS_MANQUANTS+=(tesseract-ocr tesseract-ocr-fra)
    "$PY" -c "import tkinter" 2>/dev/null || PAQUETS_MANQUANTS+=(python3-tk)
}

installer_deps() {
    verifier
    if [ ${#PAQUETS_MANQUANTS[@]} -eq 0 ]; then
        vert "Tout est déjà installé."
        return 0
    fi
    echo "Paquets manquants : ${PAQUETS_MANQUANTS[*]}"
    if ! command -v apt >/dev/null; then
        rouge "Distribution sans apt : installez ces paquets à la main."
        return 1
    fi
    echo "Commande qui va être lancée :"
    gris "  sudo apt install -y ${PAQUETS_MANQUANTS[*]}"
    read -rp "Continuer ? [O/n] " rep
    case "${rep:-o}" in
        [oOyY]*) sudo apt install -y "${PAQUETS_MANQUANTS[@]}" ;;
        *) echo "annulé" ; return 1 ;;
    esac
}

# ------------------------------------------------------------- configuration

creer_config() {
    [ -f "$CONFIG" ] && return 0

    echo "Première utilisation : création de $CONFIG"
    local php="$DIR/../lib/config.php" token="" url=""

    # Serveur sur cette machine : on se sert directement.
    if [ -r "$php" ]; then
        token="$(grep -oP "'token'\s*=>\s*'\K[^']+" "$php" || true)"
        local racine
        racine="$(cd "$DIR/.." && pwd)"
        case "$racine" in
            /opt/lampp/htdocs/*) url="http://localhost/${racine#/opt/lampp/htdocs/}/api.php" ;;
            /var/www/html/*)     url="http://localhost/${racine#/var/www/html/}/api.php" ;;
        esac
        [ -n "$token" ] && gris "  token et adresse repris de lib/config.php"
    fi

    if [ -z "$url" ]; then
        read -rp "  Adresse de l'API [https://polocrafting.fr/HTCL/api.php] : " url
        url="${url:-https://polocrafting.fr/HTCL/api.php}"
    fi
    if [ -z "$token" ]; then
        read -rp "  Token (celui de HTCL/lib/config.php) : " token
    fi

    "$PY" "$DIR/htcl-agent.py" -c "$CONFIG" init --endpoint "$url" --token "$token" \
        --project "Principal" >/dev/null || return 1
    vert "  configuration créée : $CONFIG"
    gris "  la zone et les règles se définissent dans la fenêtre qui s'ouvre."
}

# ----------------------------------------------------------------- raccourci

installer_menu() {
    local dest="$HOME/.local/share/applications/htcl.desktop"
    mkdir -p "$(dirname "$dest")"
    sed "s|@DIR@|$DIR|g" "$DIR/htcl.desktop" > "$dest"
    chmod +x "$dest"
    command -v update-desktop-database >/dev/null && \
        update-desktop-database "$(dirname "$dest")" 2>/dev/null
    vert "Raccourci installé : $dest"
    gris "HTCL apparaît dans le menu des applications (cherchez « HTCL »)."
}

# --------------------------------------------------------------------- corps

case "${1:-gui}" in
    -h|--help|help)
        sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'
        ;;

    deps)    installer_deps ;;
    install) installer_menu ;;

    config)
        creer_config || exit 1
        "${EDITOR:-${VISUAL:-xdg-open}}" "$CONFIG"
        ;;

    gui)
        verifier
        if [ ${#PAQUETS_MANQUANTS[@]} -gt 0 ]; then
            rouge "Paquets manquants : ${PAQUETS_MANQUANTS[*]}"
            echo   "Lancez :  $0 deps"
            # tkinter absent = pas de fenêtre possible, les autres sont rattrapables.
            "$PY" -c "import tkinter" 2>/dev/null || exit 1
        fi
        creer_config || exit 1
        exec "$PY" "$DIR/htcl-gui.py" -c "$CONFIG"
        ;;

    run|check|test|select|projects|init)
        creer_config || exit 1
        exec "$PY" "$DIR/htcl-agent.py" -c "$CONFIG" "$@"
        ;;

    *)
        rouge "commande inconnue : $1"
        sed -n '3,14p' "$0" | sed 's/^# \{0,1\}//'
        exit 1
        ;;
esac
