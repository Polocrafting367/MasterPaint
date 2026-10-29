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

## Mise à jour du 28/10/2026 (3.3.0)

- **Calques** : dossiers / sous-dossiers (`src/groups.rs` : arbre, composition isolée ou
  « Transfert », panneau indenté), verrouillage ; clés .illu `locked`, `isGroup`, `parentId`,
  `collapsed`, `passThrough`.
- **Calque texte** (`src/vector.rs`, début du mode vectoriel, sans le code HTML) : objet texte
  re-modifiable, pile d'effets non destructive rejouée en arrière-plan, clé .illu `textObject`.
- **Outils** : lasso magnétique (live-wire), fermeture du lasso polygonal, `polygon_mask` par
  balayage, sélections hors historique, symétrie déplaçable, aperçu 1:1 externe (`mpPreview` /
  `ui/preview.slint`), couleurs favorites (`favColors`).
- **Effets** : aberration chromatique paramétrable + pondérée par la force de l'effet, séparation
  RVB (Effets › Couleur), portée « Tous les calques » complète, aperçu basse résolution seulement
  (pleine résolution à OK), annulation des rendus Photo Mode Pro (`CancelToken`, file web 2
  annulable), ƒ 13 / 14 (trame CMJN, Bayer), effets du menu simples sur GPU, détourage avec options.
- **Interface** : icônes maison (`tools/gen_mpicons.py` → `icons/mp/`, `ui/mpicons.slint`, `src/mpicons_gen.rs`), `DialogFooter`,
  `Segmented` arrondi, Mica, paramètres réorganisés, palettes aimantées, téléphone (`layoutAuto`).
- **Distribution** : installeur NSIS (`rust/desktop/installer/masterpaint.nsi`), AppImage refaite
  sans appimagetool (lanceur repris d'une AppImage existante + mksquashfs).
- Suite (29/10) : composition GPU (`src/gpuview.rs`, `gpu.rs` Composer), fenêtre Couleurs (`ui/colors.slint`),
  palettes redimensionnables (clé `palettes`), grisage calque texte / verrou (`sync_layer_blocks`).
- Reste : détourage guidé au pinceau, flous radial / zoom / ombre / VHS sur GPU, formes et
  chemins dans le mode vectoriel ; un plantage à la sortie vu 2 fois sur 36 captures
  (`--snapshot`, non reproduit ensuite).

## Mise à jour du 27/10/2026

- **Paramètres aimantation** (Outils) : fenêtre comme la version web (taille des cases 1/N,
  force d'attraction, grille toujours visible, repères magenta), enregistrée dans les
  paramètres (`snapDiv`, `snapThresh`, `snapAlways`, `snapGuides`). L'aimantation (bouton
  aimant) se fait maintenant sur la grille : coin haut-gauche du déplacement, puis bords /
  centre de la toile ; points des sélections, formes, ligne, texte et déformation.
  Capture : `--demo=snap`.
- **Supprimer le fond (IA)** (web) : fenêtre Modèle (petit / moyen / grand) + Plume, progression,
  Annuler ; même bibliothèque que la version HTML (@imgly/background-removal, ONNX + WASM dans
  ses propres Workers, pont `window.mpAi` de `web/index.html`). Bureau : message (modèle à
  embarquer : tract ou ort, pas encore fait).
- **Presse-papiers web refait** : winit appelle `preventDefault` sur toutes les touches, donc le
  navigateur ne déclenchait jamais ses évènements copy / paste et il ne restait que l'API
  asynchrone (permission, « Document is not focused » sous Edge). Ctrl+C / X / V sont retenus
  dans la page (phase de capture, focus sur la toile seulement) : évènements natifs, sans
  permission. Images décodées / encodées par le navigateur (createImageBitmap, toBlob).
  Collage dans un champ de texte : les raccourcis d'édition restent au champ (avant : Ctrl+A
  sélectionnait l'image, Ctrl+V affichait une erreur). Clic droit : menu du navigateur supprimé.
- **Performances (grandes images, web)** : composition (calque opaque du dessus recopié, départ
  au calque opaque le plus haut), soulever / copier / coller par lignes, cadre de sélection par
  ligne, JPEG décodés par le navigateur, sauvegarde automatique : PNG par calque en cache,
  reportée pendant un geste, fenêtre d'attente avant un effet sur une grande image, wasm sans
  section « name » (28,9 → 20,6 Mo ; `MP_KEEP_NAMES=1` pour profiler).
  Mesures (24 Mpx, Chrome sans GPU) : ouverture PNG 1,9 → 0,7 s, JPEG 0,55 s, Ctrl+A 1,1 → 0,66 s.
- **Calculs en arrière-plan** (`src/background.rs`) : aperçus et application des effets,
  Photo Mode Pro, développement RAW et décodage d'images tournent dans un autre fil (bureau)
  ou dans un worker du navigateur (`web/mp-worker.js`, même module wasm compilé une fois par
  la page : `window.mpWasmModule`, `mpCompute.run`, deux files). L'interface ne se fige plus ;
  fenêtre de progression pour un effet appliqué à une grande image.
- **Grandes images** : seules les tuiles visibles sont composées (`LAZY_MIN`, aperçu de fond
  réduit) ; vue de loin, l'aperçu d'un effet est d'abord calculé au pas de l'affichage
  (réglages en pixels mis à l'échelle, `effects::scale_px`), puis en pleine résolution après
  450 ms ; ajustements point par point limités à la zone visible.
- **Photo Mode Pro** : rendu en deux temps (720 px bureau / 480 px web en direct, puis zone
  visible à la résolution de l'écran après une pause) ; thème sombre imposé sans
  l'enregistrer, menus réduits, onglets masqués, menus au-dessus du mode ; réglage auto RAW
  mesuré en flottant.
- **Zoom** : ombre de la toile bornée à la partie visible, grille de pixels limitée à la zone
  visible, contenu hors toile sans `opacity` (chacun faisait calculer une image à la taille
  de la toile zoomée).
- **Paramètres** réorganisés (Apparence en page d'accueil, Toile et outils, Édition,
  Performances, Données, Raccourcis, Avancé, Infos techniques), défilement corrigé ; repris de
  la version HTML : coins arrondis, transparence du haut des fenêtres, aperçu derrière les
  onglets, image zoomée lissée, fréquence de sauvegarde, vider l'historique. Langues non
  traduites masquées.
- **Flatpak** 3.2.0 dans `downloads/` (`build-all.sh flatpak`).
- Reste : wasm multi-fil pour découper un même effet sur plusieurs cœurs dans le navigateur
  (rayon + COOP / COEP), effets du menu sur la carte graphique (wgpu).
- Reste en « à venir » (4) : Vectoriser un bitmap, Objets SVG, Animation (frise), Importer une
  séquence d'images.

## Mise à jour du 23/10/2026 (3.1.0)

- **Mode téléphone** refait comme la version web (`ui/phone.slint`) : barre du haut, capsule
  annuler / rétablir, ruban en carte flottante, bande d'outils, pilules, barre du bas, panneaux
  du bas (Couleurs avec actions rapides, Calques, Historique, menus Ajuster / Déform / Effets),
  tiroir ☰ (documents, tuiles Fichier, menus en accordéon), fenêtre d'effet en panneau du bas.
- **Espace de couleur** (`src/colorspace.rs`) : Bitmap, CMJN (projection idempotente : une couleur
  imprimable n'est plus modifiée), RAL ; menu coché, Nouvelle image, barre d'état, .illu.
- **Captures sans écran** : `masterpaint-ui --snapshot=f.png --size=412x880 [--clicks=x,y;…]`
  (moteur de rendu logiciel) ; `--color-mode=ral|cmjn` pour les démonstrations.
- **Compilation hors du dépôt** : `rust/.cargo/config.toml` → `../../MasterPaint-build/target`.
  `MasterPaint-build/build-all.sh` produit Linux (AppImage, tar.gz), Windows (llvm-mingw) et le web.
- Reste à faire : Mode Photo Pro (pipeline déjà en Rust : `fx_camraw.rs`), portée des effets
  (Sélection / Calque actif / Tous les calques), Android / macOS / iOS.

## Demandes du 26/10/2026 (suivi)

Fait :
- fenêtres de choix façon Paint.NET (textes de paintdotjs) : modifications non enregistrées
  (onglet : Enregistrer / Ne pas enregistrer / Annuler, avec vignette ; fermeture de
  l'application : liste des images à vignettes cliquables), glisser-déposer (Ouvrir / Ajouter
  comme calques, plusieurs fichiers), image collée plus grande que la toile (Agrandir /
  Conserver / Annuler) ; Échap ferme ; web : confirmation du navigateur à la fermeture ;
- presse-papiers du système sur le web (comme paintdotjs) : copie en PNG, lecture au Ctrl+V,
  évènement « paste » du navigateur ; sa propre copie garde sa position ; Coller dans une
  nouvelle image (Ctrl+Alt+V) ; fermer l'onglet (Ctrl+W) ;
- réglage Coller : nouveau calque / calque actif (pixels flottants) ; même image = même
  position, autre image = centré ;
- site : version Rust à la racine (`index.html`), version HTML dans `html/` ;
  écran de démarrage repris de la version HTML, gardé pendant la restauration des projets ;
  chemins web relatifs au dossier de l'application (polices, téléchargements : localhost) ;
- Paramètres : Général + Toile et outils fusionnés, section Avancé (thème, version web
  classique, projet), bêta sur Photoshop / Téléphone ; liens Polocrafting 367 → polocrafting.fr ;
- barre d'état : messages temporaires, éléments masqués selon la largeur ;
- boutons façon Windows 11, même arrondi partout ; cases à cocher activables par leur libellé ;
- menus : zone de sécurité des sous-menus (400 ms), séparateurs du menu Outils ;
- Linux, fenêtre sans cadre : relâchement envoyé à Slint après déplacer / réduire / agrandir ;
- palettes rouvertes au démarrage du bureau (largeur nulle prise pour un téléphone) ;
- Couleurs : bouton Grille cohérent, curseurs + valeur saisissable ;
- formes : icônes du sprite, catalogue étendu (pentagone… étoiles 4 / 6) ; sprite aussi dans la
  barre Paint.NET (symétrie, contour / plein) ;
- pipette : couleur prélevée, HEX, RVB, RAL le plus proche dans le ruban ;
- vignettes d'onglets : image complète (masques, fusion, ƒ) ;
- Art ASCII : cellules à chasse fixe (largeur moyenne), moins d'espace ;
- Redimensionner / Taille de la zone de travail : pourcentage, proportions, préréglages selon
  le rapport, taille en Mo, ancrage ;
- Recadrer : outil interactif (8 poignées, extérieur assombri, tiers, 16:9 / 9:16 / 1:1 / 4:3 /
  libre), bouton dans le ruban des sélections, Ctrl+Maj+R ;
- Bordure d'image complète (autour / intérieur, marges par côté, couleur, destination) ;
- Rotation et retournement : portée image / calque, tuiles ;
- Exporter : nom, export rapide PNG / .illu, autres formats (JPEG + qualité, WebP, BMP, GIF),
  profondeur de couleur, tous les onglets en .illu ;
- ruban : libellés masqués sous 1180 px, barre Paint.NET sur deux lignes sous 1100 px.

Fait en plus (suite du 26/10) : masque α en niveaux de gris (fond violet, onglet marqué), fenêtres
d'effet instantanées + portée (sélection / calque / tous) + aperçu limité à la zone visible sur
les grandes images, axes de symétrie, lasso magnétique, Aperçu 1:1, Visionneuse d'icônes,
Calque actif : position et taille, Détourage par sélection, Remplissage contenu, RAW (rawler),
affichage réduit des grandes images, Hors toile, dossier html/.

À faire :
- fenêtres d'effets : reprendre les contenus et réglages de paintdotjs (js/src/interface/window/dialog) ;
- effets du menu sur la carte graphique (bureau et WebGPU) ; seuls les filtres ƒ y sont ;
- Supprimer le fond (IA), Vectoriser un bitmap, Objets SVG, Animation (frise), séquence d'images ;
- sélection rapide, sélection d'objet ; langues autres que le français ;
- Android (.apk) : WebApk (`/opt/lampp/htdocs/WebApk`, `apps/masterpaint/`) — la compilation échoue
  tant que `widget2_label` manque dans `app/build.gradle.kts` ; macOS : GitHub Actions
  (`.github/workflows/rust-ui-release.yml`, tag v*) ; AppImage : appimagetool absent ici ;
- Linux : vérifier à la main les boutons de la barre de titre (réduire / agrandir / fermer) ;
- ouverture des .illu à animation / vecteurs : seuls les calques bitmap sont repris.

## Déjà en Rust

- **Menus** : 141 entrées sur 146.
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

## Demandes du 16/10/2026 (suivi)

Fait : accélération GPU des filtres ƒ (wgpu), fenêtres d'effets (sections, couleurs + pipette,
curseurs en dégradé, valeurs saisissables), fenêtre Couleurs (dégradés, saisie, mise en page
étroite), coches en direct dans les menus, menus façon Windows (survol, sous-menus, icônes),
fond flou derrière les onglets, bouton ^ du ruban, fenêtres de dialogue déplaçables partout,
boutons Calques répartis, contour projet + masque α.

À faire :
- écran de chargement soigné (version web) ;
- confirmation avant fermeture (onglet modifié, application) ;
- glisser-déposer d'une image : choix nouvel onglet / nouveau calque ;
- coller aux mêmes coordonnées que la copie ; sélection, copier-coller et rotation façon
  paintdotjs ;
- sauvegarde automatique (bureau : fichier ; web : stockage du navigateur) et restauration ;
- bordures fines / séparateurs façon Windows (fenêtre Outils notamment) ;
- menus dans la barre de titre (application de bureau : fenêtre sans cadre) ;
- Paramètres en onglets (Général, Visuel…), zoom de l'interface, zoom et outil par défaut ;
- effets du menu sur la carte graphique (flous…), WebGPU vérifié sur un vrai navigateur.
