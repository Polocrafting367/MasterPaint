<!-- MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md. -->
# Audit du pack d’icônes — 4 novembre 2026

261 symboles examinés. 38 symboles ajustés dans cette passe, après les cinq icônes initialement signalées. La planche `icon-pack-audit.html` contient le pack actuel à 16, 24 et 64 pixels, avec recherche, filtre des corrections et fonds clair/sombre.

## Défauts corrigés

- **Contours recouverts par les aplats** : inversion de sélection, crayon, aimant du lasso, sélection rectangulaire, grille, recadrage de sélection, remplissage de contenu, dossier et secteurs circulaires. Les aplats sont désormais dessinés avant leurs contours.
- **Remplissages débordant des coins arrondis** : postérisation, damiers, pixels, inversion, vignette, paysage, image et disposition. Les aplats sont découpés avec la géométrie exacte du cadre ; le contour est dessiné en dernier.
- **Raccords mal alignés** : sommets et côtés de la sélection à quatre coins, rails de déformation, ligne du seau et montagnes de l’icône photo.
- **Dessins rognés** : pointeur du lasso libre, étoile fine, famille de formes, empilement d’animation, fusion de calques, nœud supérieur du lasso polygonal et signe plus d’ajout de calque.
- **Géométrie erronée** : l’heptagone avait six côtés ; il en a désormais sept.
- **Sources divergentes** : les 27 SVG historiques utilisés par les indices d’outils sont synchronisés avec le sprite ; les générateurs privilégient désormais le sprite courant au dessin ancien intégré au relevé d’interface.

Les icônes `mode-contiguous`, `mode-layer`, `grad-linear`, `grad-radial`, `grad-diamond` et `grad-conic` sont inchangées. Les diagonales parasites et les dégradés noirs des premières planches étaient des erreurs du moteur de prévisualisation ImageMagick. Leur rendu a été revérifié avec Chrome et resvg.

## Vérifications

- XML valide ; identifiants uniques ; toutes les références locales de masques, découpes et dégradés sont résolues.
- Contrôle raster dans Chrome avec une marge transparente : aucun des 261 symboles ne déborde de sa zone de dessin (seuil alpha de 16/255).
- Les 261 SVG ont été lus et rendus par resvg, le moteur utilisé par l’application.
- Les 306 modèles Rust générés ont été compilés indépendamment puis rendus en clair et en sombre : 612 rendus réussis, sans icône vide.
- Régénération répétée : fichiers identiques ; les 27 SVG historiques correspondent au sprite courant.
- Le test global de l’application `icon_tint_matches_svg` a été interrompu pendant la recompilation complète ; il n’est pas compté comme réussi. Les contrôles de rendu ciblés ci-dessus utilisent les fichiers finaux.

## Symboles ajustés

- `illu-icon-tool-deform`
- `illu-icon-sel-invert`
- `illu-icon-tool-direct-select`
- `illu-icon-sel-free-corners`
- `illu-icon-grad-method-simple`
- `illu-icon-grad-method-smart`
- `illu-icon-tool-shapes-family`
- `illu-icon-layer-merge`
- `illu-icon-shape-heptagon`
- `illu-icon-shape-star-thin`
- `illu-icon-anim-onion`
- `illu-icon-tool-pencil`
- `illu-icon-tool-bucket`
- `illu-icon-tool-magnetic-lasso`
- `illu-icon-tool-poly-lasso`
- `illu-icon-mp-sel-rect`
- `illu-icon-mp-grid`
- `illu-icon-mp-crop-sel`
- `illu-icon-mp-layer-add`
- `illu-icon-mp-shadows`
- `illu-icon-mp-invert-alpha`
- `illu-icon-mp-invert`
- `illu-icon-mp-posterize`
- `illu-icon-mp-photo`
- `illu-icon-mp-transparency`
- `illu-icon-mp-duotone`
- `illu-icon-mp-pixelate`
- `illu-icon-mp-tile`
- `illu-icon-mp-mirror4`
- `illu-icon-mp-dither`
- `illu-icon-mp-vignette`
- `illu-icon-mp-checker`
- `illu-icon-mp-solarize`
- `illu-icon-mp-content-fill`
- `illu-icon-mp-folder`
- `illu-icon-mp-image`
- `illu-icon-mp-layout`
- `illu-icon-mp-grad-conic`

## Seconde passe (même jour, après retour d'utilisation)

Contrôle à l'œil des 260 symboles en grand, plus deux détecteurs sur rendu à 16 px par unité : interstices de moins de 0,35 unité entre deux formes, et lamelles d'aplat. Défauts corrigés par famille :

- **Pointillés automatiques** (`stroke-dasharray` sur un cadre) qui coupent les coins au hasard : `sel-invert`, `sel-deselect`, `brush-spray`, `warp-rect-lock`, `image-extend`, `vec-text`, `vec-shape`, `sym-x`, `sym-y`, `brush-soft`. `gen_mpicons.py` place désormais les tirets lui-même (`dashed_rect`) : `R(..., 'd')` ne peut plus produire ce défaut.
- **Micro-lignes** entre traits parallèles trop proches : `tool-eyedropper`, `tool-quick-select` ; coutures du dégradé `grad-conic` ; liserés de `mp-grad-linear`, `mode-contiguous`, `mode-layer`.
- **Traits qui dépassent du cadre** : `mp-exposure`, `mp-emboss`, `mp-edges`, `mp-straighten`, `mp-polar`, `mp-bulge`, désormais via `framed()` ou dessinés sous le cadre.
- **Géométrie** : `tool-eraser`, `tool-poly-lasso`, `outside-canvas`, `mp-image`, `mp-photo`, `mp-sequence` (montagnes à 45° et symétriques), `mp-clouds`, `mp-dream` (base droite), `mp-settings` (dents sur les axes), `mp-rulers`, `mp-fx`, `mp-chroma-key`, `mp-content-fill`, `mp-remove-bg`, `tool-shapes-family`, `shape-star-thin`, `svg-obj-refresh`.

Restent signalés par le détecteur, jugés voulus : `anim-onion` (calques translucides), `fill-gradient`, `grad-linear`, `mp-radial`, `mp-film`, `mp-temperature`, `mp-bug`, `mp-twist`.
