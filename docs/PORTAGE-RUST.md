# Portage de MasterPaint vers Rust — liste de travail

État au 16/10/2026. L'interface Rust (Slint) se trouve dans `rust/masterpaint-ui`, le moteur
d'effets dans `rust/masterpaint-core`. Dans les menus de l'interface Rust, les fonctions pas
encore transférées portent le marqueur **« à venir »** (calculé par `action_badge` dans
`src/lib.rs` : il disparaît dès que la fonction est branchée).

Pour régénérer la liste des menus :
`cargo test -p masterpaint-ui --release --lib worklist -- --ignored --nocapture`

Compilation : `rust/build-ui-web.sh` (Linux / macOS) ou `build-ui-web.ps1` (Windows) pour le
web ; `cargo build -p masterpaint-ui --release` pour le bureau ;
`.github/workflows/rust-ui-release.yml` produit l'exe Windows, l'AppImage Linux et le dmg macOS.

## Déjà en Rust

- **Menus** : 129 entrées sur 146.
- **Effets** : les 76 effets des menus (dont Art ASCII et Conversion RAL), Niveaux, **Courbes**
  (spline monotone, canaux RVB / R / V / B, histogramme), Camera Raw, **Galerie de filtres**
  (looks Camera Raw de la version web) ; Ctrl+F répète le dernier effet.
  Test : `cargo test -p masterpaint-ui --lib effects_check -- --nocapture`.
- **Outils** : sélection rectangulaire (avec poignées), lasso, lasso polygonal, baguette,
  déplacer (8 poignées, rotation, Maj / Alt comme Paint.NET), déformation, 4 coins, pipette,
  zoom, pinceau (rond / doux / spray / carré, symétrie X / Y), crayon, gomme, remplissage,
  dégradé (4 types), texte, formes (9 formes), rectangle arrondi, ligne.
- **Calques** : ajout, suppression, duplication, fusion, ordre par glisser-déposer, visibilité,
  opacité, 16 modes de fusion, **renommer** (double-clic), **masque α** (onglet lié, blanc =
  visible, enregistré dans le .illu comme la version web), **filtre dynamique ƒ** (fenêtre de
  réglage : activer, Dessous / Ce calque, chaîne de 8 effets).
- **Documents** : onglets multi-projets, .illu compatible avec la version web, export PNG /
  JPEG / WebP / BMP.
- **Interface** : ruban et barre classique, fenêtres volantes, thème clair / sombre,
  15 accents, **thème Windows 98**, **disposition Photoshop** (palettes ancrées),
  **mode téléphone** (menu ☰, bande d'outils, panneaux du bas ; automatique sous 600 px ;
  pincement à deux doigts sur le web), règles, grille, aimantation, raccourcis.

## Fluidité (16/10/2026)

- Historique : pixels des calques partagés (`editor::Px`, copie à l'écriture) — une étape ne
  copie que le calque modifié.
- Pinceau / crayon : seul le dernier segment est recalculé (`Cover::take_recent`).
- Affichage : tuiles de 256 px envoyées pendant un geste (`upload_rect`), image entière
  seulement aux validations ; vignettes de calques en cache ; rendu ƒ en cache.
- Sélection rectangulaire / lasso : contour seul pendant le geste, masque au relâchement.
- Composition des calques répartie sur tous les cœurs (bureau).
- Aperçu des effets dans un autre fil sur le bureau (l'interface ne se fige plus).
- Banc d'essai : `cargo test --release -p masterpaint-ui bench_stroke -- --ignored --nocapture`.

## À venir — menus (17)

| Menu | Entrée | Piste |
|---|---|---|
| Fichier | Photo Mode Pro, Ouvrir projet dans Photo Mode Pro | pont HTML ou portage du pipeline photo |
| Fichier | Espace de couleur : Bitmap / Tramé N&B / RAL / CMJN | modes de projet à porter |
| Fichier | Visionneuse d'icônes | pont HTML |
| Édition | Vectoriser un bitmap | pont HTML |
| Image | Calque actif : position et taille | calques à décalage (voir « Hors toile ») |
| Effets › Détourage | Supprimer le fond (IA), Détourage par sélection, Remplissage contenu | pont HTML |
| Outils | Aperçu toile 1:1, Paramètres aimantation | simple |
| Outils | Objets SVG, Animation (frise), Importer une séquence d'images | mode vecteur / animation |

## À venir — autres

- Outils : sélection rapide, sélection d'objet, lasso magnétique (actuellement lasso libre),
  outils vecteur (plume, courbe, polygone), catalogue complet des formes.
- Sélection : modèle vectoriel (contours combinés, comme Paint.NET — voir paintdotjs,
  `js/src/engine/document/selection/`, licence MIT) pour des contours nets à tout zoom.
- **Hors toile** : calques à décalage pour garder le contenu hors toile après validation.
- Paramètres : langues autres que le français, sauvegarde automatique, export / import des
  données locales.
- Web : enregistrer un projet .illu (le bureau le fait déjà).
- **Effets sur la carte graphique** : l'interface est déjà rendue par OpenGL (bureau) / WebGL
  (web) ; les effets restent calculés par le processeur (tous les cœurs sur le bureau, un seul
  fil sur le web). Pistes : wgpu (calcul GPU, WebGPU sur le web) pour les flous et les effets
  à voisinage ; WebAssembly multi-fil (en-têtes COOP / COEP) pour le web.
- Aperçu des effets en basse résolution sur les grandes images (comme la version web).

## Transition : fonctions HTML derrière l'interface Rust

Objectif : tant qu'une fonction n'est pas transférée, l'utiliser depuis la version HTML sans
quitter l'interface Rust.

- **Web** : la page Rust charge la version HTML dans une fenêtre intégrée (iframe) en « mode
  hôte » : l'image y est transmise, la fenêtre de réglage de l'effet HTML s'affiche comme une
  fenêtre de l'application, l'aperçu et le résultat reviennent sur la toile Rust.
- **Bureau** : même principe avec une WebView intégrée à la fenêtre Rust (WebView2 sous
  Windows, WKWebView sous macOS, WebKitGTK sous Linux), fichiers servis localement.
- Le marqueur « à venir » deviendra « HTML » pour les fonctions servies par ce pont.

## Mise en ligne (racine de masterpaint.fr)

- `/` : version web classique (HTML) — bouton « Essayer la version Rust » + fenêtre à la
  première visite (`js/app/rust-try.js`) ; `/#contact` ouvre directement le formulaire.
- `/rust-app/` : version Rust web — construite et publiée par `rust/build-ui-web.ps1` ;
  bouton « Version web classique » pour revenir à `/`.
- `/downloads/` : exe portable Rust, installeur Windows ; Flatpak / AppImage / dmg à venir
  (GitHub Actions). `.htaccess` : type `application/wasm` et téléchargement forcé.
- `/fonts/` : polices partagées par les deux versions (outil Texte de la version Rust).
