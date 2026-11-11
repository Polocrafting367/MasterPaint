# Audit fonctionnel et performances — 9 novembre 2026

© 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.

## Périmètre et méthode

Comparaison de MasterPaint 3.5.6 (Rust/Slint, `rust/masterpaint-ui` + `rust/masterpaint-core`)
avec les quatre projets de `/opt/lampp/htdocs/masterpaint-inspiration` :

| Référence | Imite | Utilisée ici pour |
|---|---|---|
| **paintdotjs** (JS, port de Paint.NET 3.36) | Paint.NET | comportements de base des outils et de la sélection |
| **PhotoCraft** (Rust, MIT/Apache) | Photoshop 2026 | outils, sélection, transformation, algorithmes (`crates/algo`) |
| **LightCraft** (Rust, MIT/Apache) | Lightroom Classic | Photo Pro, RAW, développement |
| **VectorCraft** (Rust, MIT/Apache) | Illustrator | SVG : ouverture, modèle d'objet, édition |

Méthode : lecture du code, sans compilation ni nouvelle mesure. Les chiffres de temps viennent de
`performance-audit-2026-11-08.md`. Chaque constat cite le fichier et la ligne. Les points non
vérifiés sont signalés « à vérifier ».

Les projets PhotoCraft, LightCraft et VectorCraft sont sous licence MIT/Apache : leur code peut être
repris avec attribution (NOTICE), comme celui de paintdotjs.

---

## 1. Défauts constatés (à corriger en premier, peu coûteux)

| # | Constat | Où | Effet | Correction |
|---|---|---|---|---|
| D1 | **Maj ignorée sur la toile** : le paramètre s'appelle `_shift` et ne sert qu'à la transformation | `lib.rs:11252` | pas de carré ni de cercle à la sélection ou aux formes, pas de ligne contrainte à 15°/45°, pas de « Maj+clic = trait droit » au pinceau, pas de baguette globale à Maj (Paint.NET : `MagicWandTool.js:72`) | passer `shift` à `Session::press/moved` et l'appliquer outil par outil |
| D2 | **Intersection et OU exclusif inaccessibles** : `SelMode::Intersect` existe, mais le ruban n'a que Nouvelle / Ajouter / Soustraire ; les modificateurs ne donnent que Ctrl = ajouter, Alt = soustraire. Pas de XOR. | `tools.rs:649` | combinaisons courantes impossibles | Paint.NET : Ctrl+clic droit = XOR, Alt+clic droit = intersection. Photoshop : Maj = ajouter, Alt = soustraire, Maj+Alt = intersection. Ajouter `SelMode::Xor` et un 4ᵉ bouton |
| D3 | **TIFF et ICO proposés mais illisibles** au bureau : le sélecteur les liste, mais la crate `image` est compilée sans `tiff` ni `ico` | `lib.rs:2946`, `Cargo.toml:23` | message d'échec à l'ouverture | ajouter les features `tiff`, `ico` (le TIFF sert aussi à l'export 16 bits, §5) |
| D4 | **Orientation EXIF ignorée** au bureau : `image::load_from_memory` ne tourne pas l'image | `lib.rs:566`, `illu.rs:38` | photos de téléphone ouvertes couchées (le navigateur, lui, applique l'orientation) | `ImageDecoder::orientation()` puis `DynamicImage::apply_orientation` (image 0.25). RAW en portrait : à vérifier |
| D5 | **Fourmis dessinées dans les pixels du document** | `editor.rs:1552–1640` | à 800 % le contour fait 8 px d'épaisseur ; vue réduite, des détails sautent. PhotoCraft (`ants.rs`) et Photoshop les tracent à 1 px d'écran | extraire le contour une fois (marching squares → segments), le tracer dans la texture d'affichage à l'échelle de l'écran. C'est la piste « sélection vectorielle » déjà notée dans PORTAGE-RUST.md |
| D6 | **Déformation : bilinéaire seulement**, sans préfiltrage | `transform.rs:532` | crénelage et moiré au-delà d'une réduction ×2 ; pixel art flouté | réduction < 0,5 : échantillonner une pyramide (mipmaps) ou suréchantillonner ; option « Plus proche voisin » (indispensable en mode Pixel) et bicubique |
| D7 | **Étendre / réduire la sélection** : noyau carré, coût proportionnel au rayon | `editor.rs:1698` | coins carrés au lieu d'arrondis ; lent à grand rayon sur 20 Mpx | transformée de distance (Felzenszwalb, coût linéaire) : coins ronds, temps indépendant du rayon |
| D8 | **Remplissage de contenu** : diffusion par anneaux qui reparcourt toute l'image à chaque anneau | `editor.rs:1806` | lent sur une grande image, résultat flou (pas de texture) | crate `inpaint` de LightCraft (PatchMatch + membrane, **aucune dépendance**, portée de PhotoCraft), limitée au cadre de la sélection + marge, au worker |
| D9 | Chaque appui d'outil **copie le masque de sélection entier** | `tools.rs:788` (`base_sel: doc.sel.clone()`) | 20 Mo copiés à chaque clic sur une photo de 20 Mpx | `Arc<Vec<u8>>` pour `Doc::sel` |

---

## 2. Sélection

| Fonction | Paint.NET | Photoshop | MasterPaint | Note |
|---|:-:|:-:|:-:|---|
| Rectangle | ✔ | ✔ | ✔ | sans Maj = carré (D1) |
| **Ellipse** | ✔ | ✔ | ✘ | outil de base de Paint.NET : 2–3 h (`paint::sdf_ellipse` existe déjà) |
| Lasso, lasso polygonal | ✔ | ✔ | ✔ | Maj = 45° absent |
| Lasso magnétique | — | ✔ | ✔ | |
| Baguette magique | ✔ | ✔ | ✔ | il manque « échantillonner : calque / image », Maj = global |
| Nouvelle / ajouter / soustraire | ✔ | ✔ | ✔ | |
| Intersection / XOR | ✔ | ✔ / — | ✘ | D2 |
| Plume (adoucir le contour), Bordure, Lisser | — | ✔ | ✘ | `blur_mask` existe déjà : une commande Sélection › Modifier suffit |
| Transformer la sélection seule | — | ✔ | ✔ | `Kind::MoveSelection` |
| **Sélection depuis l'alpha d'un calque** (Ctrl+clic sur la vignette) | — | ✔ | ✘ | très utilisé, quelques lignes |
| Sélection rapide (pinceau) | — | ✔ | ✘ | PhotoCraft : `algo/segment` (coupe de graphe), `docs/quick-selection-performance.md` |
| Sélectionner le sujet / le ciel | — | ✔ | ✘ | `scene.rs` détecte déjà le sujet (saillance, visage) et le ciel : à exposer comme sélection |
| Plage de couleurs | — | ✔ | ✘ | baguette globale + tolérance progressive |
| Masque rapide (Q) | — | ✔ | ✘ | peindre la sélection avec les outils existants |
| Enregistrer / charger une sélection | — | ✔ | ✘ | |
| Lissage (anticrénelage) au choix | ✔ | ✔ | ✘ | |

**Priorités** : D1, D2, ellipse, sélection depuis l'alpha et Sélection › Modifier (plume, bordure,
lisser). C'est peu de travail, ce sont les gestes de tous les jours. Ensuite, sujet/ciel (le
code de `scene.rs` existe), puis sélection rapide.

---

## 3. Transformation et déformation

Présent (`transform.rs`) : contenu soulevé une seule fois, puis redessiné sans perte ; 8 poignées,
rotation (Maj = 15°), Alt = depuis le centre, Maj = proportions, Déformation, 4 coins
(homographie), Hors toile, aimantation, flèches pour décaler. Bonne base, fidèle à Paint.NET.

| Manque | Référence | Intérêt |
|---|---|---|
| Choix de l'interpolation (plus proche, bilinéaire, bicubique) | Photoshop | D6 ; essentiel en mode Pixel |
| **Déformation par grille** (Warp 3×3–5×5, préréglages arc, drapeau…) | Photoshop, PhotoCraft `algo/warp.rs` | mockups, texte courbé |
| **Fluidité** (pousser, gonfler, pincer, tourbillon) | Photoshop, PhotoCraft `algo/liquify` | très demandé, ludique |
| Déformation de la marionnette | Photoshop, PhotoCraft `algo/puppet.rs` | plus tard |
| Inclinaison par Ctrl+côté | Photoshop | complète la boîte libre |
| Répéter la transformation (Ctrl+Maj+T) | Photoshop | motifs |
| Recadrage en perspective | Photoshop | photos de documents |
| Mise à l'échelle selon le contenu | Photoshop, PhotoCraft `algo/seam` | plus tard |

**Performance** : `Floating::render` recalcule à **pleine résolution** à chaque mouvement (old ∪ new
rect). Sur le web (un seul fil), déplacer un calque entier de 20 Mpx = 20 M échantillons par
mouvement. Piste : aperçu au pas d'affichage (`display_step`), comme les effets, puis pleine
résolution au relâchement.

---

## 4. Outils de Photoshop / Paint.NET absents, classés par utilité

| Prio | Outil | Chez | Effort estimé | Base existante |
|:-:|---|---|---|---|
| 1 | **Tampon de duplication** (Alt+clic = source) | Paint.NET, PS | ~1 j | moteur de pinceau (`Cover`) |
| 1 | **Correcteur localisé / Supprimer** | PS, LightCraft | ~1–2 j | crate `inpaint` (D8) |
| 1 | **Lissage du tracé** (stabilisateur, 0–100 %) | PS, Krita | ~½ j | points du trait (`Drag::points`) |
| 1 | **Masques d'écrêtage** (calque écrêté sur celui du dessous) | PS | ~1 j | compositeur des calques |
| 2 | Doigt, Densité − / +, Éponge, Netteté / Goutte | PS | ~1 j pour la famille | pinceau + effets locaux |
| 2 | Remplacement de couleur (Recolor) | Paint.NET (`RecolorTool.js`) | ~½ j | tolérance de la baguette |
| 2 | Gomme magique, gomme d'arrière-plan | PS | ~½ j | baguette + effacer |
| 2 | Pinceau d'historique | PS | ~½ j | les instantanés existent |
| 2 | Options de pinceau : flux, espacement, mode de fusion de l'outil | Paint.NET, PS | ~1 j | `tools::Opts` n'a que taille, dureté, opacité, forme |
| 3 | **Styles de calque** non destructifs (ombre, contour, lueur) | PS | ~2 j | pile ƒ : un style = un étage « fx » |
| 3 | Règle / mesure, échantillonneur de couleurs | PS | ~½ j | |
| 3 | Fluidité, grille de déformation | PS | voir §3 | |

Déjà couvert par MasterPaint : calques de réglage (filtres dynamiques ƒ), masques (α), texte et
formes vectoriels, détourage IA (web), animation.

---

## 5. Photo Pro et RAW (référence LightCraft)

Présent : chaîne flottante du capteur à la sortie (`raw.rs` + `fx_camraw.rs`), balance des blancs,
exposition, tons (4 zones, masques locaux bilatéraux), clarté, voile, vibrance, TSL sur 8 teintes,
étalonnage RVB ombres / hautes lumières, netteté, vignettage, grain, Auto de scène (`scene.rs`),
préréglages, export par lot, développement au worker, aperçu à la taille affichée.

| Prio | Manque | LightCraft | Note |
|:-:|---|:-:|---|
| 1 | **Histogramme** (+ alerte d'écrêtage J/O) | ✔ | aucun dans `photo.slint` |
| 1 | **Avant / après** (touche \\ ou glissière) | ✔ | |
| 1 | **Pipette de balance des blancs** (clic sur un gris) | ✔ | `white_balance_gains` existe : il suffit d'inverser |
| 1 | **Courbes dans Photo Pro** | ✔ | le moteur les gère déjà (réglages 54–57), seule l'interface manque |
| 1 | **Recadrer / redresser** (+ redressement auto) | ✔ | seulement rotation de 90° (`photo.rs:201`) |
| 2 | **Réduction du bruit** luminance + chroma | ✔ | indispensable en RAW au-delà de 1600 ISO ; chroma : flou guidé sur Cb/Cr à basse résolution, coût faible |
| 2 | **Masques locaux** : pinceau, linéaire, radial, plage de luminance / couleur, sujet, ciel | ✔ | `scene.rs` fournit sujet et ciel ; déjà noté dans PORTAGE-RUST.md |
| 2 | Corrections d'objectif : aberration chromatique latérale auto, vignetage, distorsion | ✔ | `raw.rs` applique OpcodeList2 mais pas **OpcodeList3** (WarpRectilinear, FixVignetteRadial des DNG) |
| 2 | Correcteur de taches | ✔ | crate `inpaint` |
| 2 | **Export 16 bits** (PNG 16, TIFF 16) | ✔ | aujourd'hui tout sort en 8 bits ; l'éditeur est en RGBA 8 bits, donc « Ouvrir dans l'éditeur » perd la dynamique |
| 3 | Copier / coller des réglages sélectifs, versions | ✔ | « Appliquer à toutes » existe |
| 3 | XMP (`crs:`) en lecture / écriture | ✔ | échange avec Lightroom |
| 3 | Profils (Neutre, Vif, Monochrome), mélange N&B, calibration | ✔ | |
| 4 | Fusion HDR, panorama | ✔ | long |

Réutilisable tel quel : `lightcraft-main/crates/inpaint` (sans dépendance). `crates/develop/src/settings.rs`
liste l'ordre et le contenu d'un développement complet ; c'est une bonne grille pour la suite.

---

## 6. SVG (référence VectorCraft)

### Ouverture des fichiers

`svg_import.rs` est un analyseur maison, ligne à ligne. Il gère rect, cercle, ellipse, ligne,
polygone, polyligne, path, dégradés, transformations et viewBox. Il **ignore** (`svg_import.rs:1044–1053`) :

- `<text>` (le texte disparaît) ;
- `<use>` et `<symbol>` hors grille d'icônes ;
- `<image>` ;
- `<clipPath>`, `<mask>`, `<pattern>`, `<marker>`, `<filter>` ;
- les **classes CSS** de `<style>`, utilisées par Illustrator, Inkscape et Figma à l'export : leurs
  couleurs sont perdues.

De plus, **un objet n'a qu'une couleur** : un remplissage et un contour de couleurs différentes
deviennent deux objets (`svg_import.rs:391`). Sélectionner ou déplacer la forme demande alors deux
gestes.

**Recommandation** : importer via **usvg**. Il est déjà dans l'arbre des dépendances, en même
version (resvg 0.48 l'expose : `resvg::usvg`), et c'est le choix de VectorCraft
(`crates/svg/src/import.rs`). usvg résout CSS, `<use>`, unités, transformations et héritage, et
donne des chemins normalisés et du texte (en courbes ou en texte). Il reste à convertir
`usvg::Node` en `ShapeObj` ; l'analyseur maison disparaît. Le test `svg_look` (comparaison à resvg)
devient alors presque exact par construction.

### Modèle et édition

| Manque | VectorCraft | Note |
|---|:-:|---|
| Remplissage **et** contour distincts sur un même objet | ✔ | prérequis du point ci-dessus |
| Jointures, extrémités, tirets par objet | ✔ | `dash` existe pour la ligne seulement |
| Sélection multiple, groupes d'objets | ✔ | déjà noté |
| Aligner / répartir les objets | ✔ | les commandes existent pour la sélection en pixels |
| **Pathfinder** (union, soustraction, intersection, exclusion) | ✔ | `vectorcraft-main/crates/pathops` (MIT/Apache) |
| Décalage de chemin, contour → forme | ✔ | `pathops/offset.rs` |
| Copier / coller d'objets, ordre des objets | ✔ | déjà noté |

---

## 7. Performances : nouveaux constats

Ceux de l'audit du 8 novembre restent valables (lecture WebGL asynchrone, effets en bandes sur
plusieurs workers, filtres ƒ au worker). Nouveaux constats, du plus rentable au moins rentable :

1. **Historique par calque entier.** `Px` est un `Arc<Vec<u8>>` par calque (`editor.rs:165`).
   Un simple point de pinceau sur un calque de 20 Mpx copie 80 Mo au début du trait et garde
   80 Mo par étape. Avec 20 étapes, jusqu'à 1,6 Go dans les 4 Go du wasm. PhotoCraft découpe en
   **tuiles en copie à l'écriture**. Deux options :
   - **intermédiaire** : l'étape garde le rectangle touché et ses anciens pixels. C'est simple, et
     la mémoire devient proportionnelle au trait, plus à l'image.
   - **complète** : tuiles de 256 px avec un `Arc` par tuile. L'envoi à l'écran se fait déjà par
     tuiles de 256 (`upload_rect`), et la sauvegarde automatique pourrait en profiter.
2. **Déformation à pleine résolution à chaque mouvement** (§3) : aperçu au pas d'affichage.
3. **Flou radial / flou de zoom** (7,7 s et 1,7 s à 2 Mpx) : PhotoCraft gagne **×4 à résultat
   identique** en préparant une fois par opération les tables de rotation / d'échelle, puis en les
   réutilisant pour chaque tuile (`photocraft/docs/radial-blur-performance.md`). C'est le même
   algorithme Paint.NET : l'optimisation se transpose sans changer le rendu.
4. **Flou de surface** (3,2 s) : grille bilatérale (coût indépendant du rayon). **Médiane** :
   histogramme glissant à coût constant (Perreault).
5. D7, D8 et D9 (§1) : étendre la sélection, remplissage de contenu, copie du masque.
6. Fourmis (D5) : un contour vectoriel calculé une fois coûte aussi moins cher à animer que le
   parcours des pixels du bord.

---

## 8. Ordre de travail proposé

1. **Lot « gestes de base »** (≈ 2 jours) : D1 à D4, D9, ellipse, intersection / XOR, sélection
   depuis l'alpha, Sélection › Modifier (plume, bordure, lisser), interpolation au choix (D6),
   distance transform (D7).
2. **Lot « retouche »** (≈ 4 jours) : crate `inpaint` (remplissage de contenu, correcteur,
   Supprimer), tampon de duplication, lissage du tracé, masques d'écrêtage, doigt / densité.
3. **Lot « Photo Pro »** (≈ 4 jours) : histogramme, avant / après, pipette BdB, courbes, recadrer /
   redresser, bruit chroma + luminance, export 16 bits (PNG / TIFF).
4. **Lot « SVG »** (≈ 3 jours) : import usvg, remplissage + contour par objet, sélection multiple,
   pathfinder (`pathops`).
5. **Lot « performance »** : historique par rectangle touché ou par tuiles, aperçu de la
   transformation, tables du flou radial / zoom, puis les suites de l'audit du 8 novembre.
6. Ensuite : masques locaux Photo Pro (sujet / ciel via `scene.rs`), sélection rapide, fluidité,
   grille de déformation, styles de calque sur la pile ƒ.
