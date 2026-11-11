# Audit interfaces, parité des fonctions et performances — 10 novembre 2026

© 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.

## Objectif

- **MasterPaint** = l'interface d'avant les thèmes (archive `backups/masterpaint-2026-11-08-avant-themes.tar.gz`), gardée telle quelle.
- **Paint.NET** = paint.js (https://paintjs.net, sources `masterpaint-inspiration/paintdotjs`).
- **Photoshop** = PhotoCraft / Photoshop.
- Une interface ne change que la **mise en page, les formes et les couleurs** : aucune fonction propre à une interface.
- Priorité : **performances** (filtres ƒ, grands calques).

## Méthode

Version web compilée (profil `web`) servie en local, Chrome sans affichage piloté par CDP
(vrais clics), carte graphique réelle (WebGPU), processeur non ralenti, fenêtre 1366 × 768.
Photo réelle Sony 5472 × 3648 (20 Mpx). Chiffre = temps du fil principal (`TaskDuration`) ;
les calculs partis au worker ou à la carte graphique n'y figurent pas. Captures comparées :
version publiée du 9 novembre, archive d'avant les thèmes, paint.js en ligne.

## 1. Performances

### Mesures avant corrections (version publiée du 9 novembre)

| Geste, photo 20 Mpx | Fil principal |
|---|---:|
| Ouvrir (hors décodage au worker) | 388 ms |
| Ajouter un calque | 362 ms |
| Pinceau, sans filtre ƒ, par mouvement | 8 ms |
| **Pinceau sous un flou gaussien ƒ (rayon 75), par mouvement** | **42 – 78 ms** |
| **Simple touche de pinceau sous le filtre (appui + relâchement)** | **213 – 236 ms** |
| **Annuler** | **218 ms** |
| Rétablir | 58 ms |
| Masquer / afficher le calque ƒ | 64 ms |
| **Opacité du calque sous le filtre, par mouvement** | **104 ms** |
| Curseur Rayon de la fenêtre du filtre, par mouvement | 6 ms (calcul au worker) |

### Causes trouvées

1. **Envoi complet à la carte graphique après chaque trait.** La composition (WebGPU et WebGL)
   reconnaît un calque à l'adresse de son tampon. Un trait crée une nouvelle version du calque :
   le calque entier (80 Mo) repartait, puis le rendu ƒ du dessus (80 Mo encore).
2. **Retouche ƒ en pleine résolution même vue de loin.** Sous un flou de rayon 75, chaque
   mouvement refaisait ~1 Mpx de flou autour du trait, alors que la toile était affichée à 14 %
   (1 pixel affiché sur 16).
3. **Étape d'historique enregistrée avant la fin de la retouche ƒ.** La fin du trait était
   recalculée après la création de l'étape : l'étape gardait un rendu ƒ périmé, et annuler ou
   rétablir relançait un recalcul complet du filtre (composition 20 Mpx + flou).
4. **Brouillon ƒ perdu dans l'historique.** Une étape prise pendant un brouillon (rendu réduit)
   revenait sans rendu mais avec une clé « à jour » : filtre invisible après annuler / rétablir.
5. Le calque modifié est copié en entier au premier coup de pinceau (historique par calque
   entier : 80 Mo par étape sur 20 Mpx). Reste à faire : historique par tuiles (voir §4).

### Corrections faites

| # | Correction | Où |
|---|---|---|
| P1 | Registre des zones modifiées : après un trait ou une retouche ƒ, seules les lignes touchées repartent vers la carte graphique (`write_buffer` partiel en WebGPU, `texSubImage2D` en WebGL) | `src/gpu_damage.rs`, `gpu.rs::compose_submit`, `webgl.rs::compose`, `mpGL.uploadRows` |
| P2 | Retouche ƒ au pas de l'affichage pendant un trait quand la vue est réduite et la retouche chère (> 0,2 Mpx), sur image ≥ 2 Mpx ; pleine résolution 0,7 s après le geste ; un nouveau trait abandonne ce recalcul déjà périmé | `editor.rs::patch_layer`, `needs_refine`, `lib.rs::arm_low_refine`, `dyn_patch` |
| P3 | Fin de trait : retouche ƒ terminée **avant** l'étape d'historique | `lib.rs::handle_outcome` |
| P4 | Le brouillon ƒ (petit) reste dans les étapes d'historique ; s'il est plus réduit que la résolution de rendu, il est recalculé après un instant | `editor.rs::snapshot` |
| P5 | Lissage du tracé : le trait est mené jusqu'au pointeur au relâchement (il s'arrêtait avant : le lissage semblait ne rien faire) | `tools.rs::release` |

### Mesures après corrections

Même scénario des deux côtés (`scen.py` : ouverture, calque ƒ, flou gaussien rayon 75, gestes
sur l'arrière-plan), version publiée puis version corrigée, carte graphique réelle.

| Geste, photo 20 Mpx sous flou ƒ r75 | Avant | Après |
|---|---:|---:|
| Trait, par mouvement | 76 ms | **20 ms** |
| Second trait, par mouvement | 45 ms | **15 ms** |
| Touche simple | 222 ms | **89 ms** |
| Annuler | 118 ms | **27 – 33 ms** |
| Rétablir | 113 ms | **32 – 46 ms** |
| Masquer / afficher le calque ƒ | 68 / 41 ms | 64 – 74 / 40 – 90 ms (inchangé) |
| Opacité du calque du dessous, par mouvement | 103 ms | 103 ms (reste à faire) |

Contrôles : netteté de la toile mesurée (flou → net quand le calque ƒ est masqué → flou) ;
après les traits, vue zoomée à 85 % **identique au pixel près** à la version publiée (la pleine
résolution revient bien).

## 2. Parité des fonctions entre interfaces

| Fonction | MasterPaint | Paint.NET | Photoshop | Correction |
|---|:-:|:-:|:-:|---|
| Histogramme + alertes d'écrêtage (Photo Pro) | ✘ | ✘ | ✔ | affiché partout |
| Télécharger l'application | bouton (web) | ✘ | ✘ | ajouté au menu Fichier |
| Groupe Affichage (grille, règles, hors toile, aimantation, **résolution de rendu ÷2/÷4/÷8**) | ruban | barre | ✘ (la résolution de rendu n'avait aucun autre accès) | présent dans la barre Photoshop |
| Pinceau Spray / Carré | ✔ | coupés (2ᵉ rangée invisible en barre) | coupés | une rangée en barre réduite ; liste repliable en Paint.NET |
| Image (recadrer, pivoter, retourner) | ruban | menus | menus | mise en page seulement (menus) |
| Copier / coller | ruban | barre rapide | menus | mise en page seulement |
| Thème clair / sombre rapide | Paramètres | Paramètres | bouton | raccourci, pas une fonction |
| Bibliothèque en grille (Photo Pro) | pellicule | pellicule | grille | autre vue des mêmes photos |

## 3. Visuel

### MasterPaint comparé à l'archive

Identique pour la disposition, les palettes, les couleurs et les fenêtres. Différences :
icônes des boutons du bas de Calques et de l'Historique (dessins maison au lieu des glyphes
Font Awesome à la couleur d'accent, demandés le 8 novembre), icône ≡ du menu, bouton « ⊕ » du
groupe Sélection (fonction ajoutée depuis), fenêtre de bienvenue refaite (commune à toutes les
interfaces). **Décision à prendre** : revenir aux glyphes de l'archive pour l'interface MasterPaint ?

### Paint.NET comparé à paint.js

Conforme : palettes flottantes, titres 19 px à croix rouge, outils sur deux colonnes, quatre
interrupteurs de palettes en haut à droite, boutons des calques en bas. Écarts restants :

- barre d'état : paint.js montre l'aide de l'outil à gauche, la taille de l'image, la position,
  l'unité et **le zoom avec curseur et boutons ± ** ; MasterPaint montre le nom du projet et des textes ;
- menus de paint.js plus grands (≈ 14 px, barre de 40 px) ;
- barre d'options : paint.js met ses réglages secondaires dans des listes (▾) ; fait ici (§ corrections).

### Corrections visuelles faites

- Densité − / + et éponge : icônes vides (formes ◐ ◑ absentes de la police) → glyphes ; idem Lisse / Nette.
- Lissage : déplacé après les types de pinceau / crayon, explication sous le curseur.
- Barre réduite (Paint.NET, ruban replié, Photoshop) : plus de noms de groupes (« Lissage : Lissage »).
- Barre réduite (Paint.NET et ruban MasterPaint replié) : Symétrie, Ajustements, Affichage, Pinceau / Crayon repliés en petites icônes ▾ (nom en infobulle), comme paint.js.
- Listes déroulantes : le champ prend l'arrondi de sa liste.
- Paint.NET (coins carrés) : coin bas-gauche de la zone des onglets qui restait arrondi.
- Paramètres : « Réinitialiser la section » à la marge du titre, centré ; langue rattachée sous
  la liste des sections, icône de langue, drapeaux dans toutes les listes de langues.

## 4. Reste à faire (par ordre d'intérêt)

1. **Historique par tuiles** (copie à l'écriture par tuile de 256 px) : supprime la copie de
   80 Mo au premier coup de pinceau et divise la mémoire de l'historique.
2. Entrée réduite des filtres ƒ pendant un réglage d'un calque du dessous (opacité, mode) :
   aujourd'hui la composition 20 Mpx est refaite à chaque mouvement (104 ms).
3. Ajout d'un calque vide : ne pas l'envoyer à la carte graphique (tampon connu vide).
4. Barre d'état Paint.NET façon paint.js (aide de l'outil, curseur de zoom).
5. Lecture WebGL asynchrone (`readPixels`) pour le chemin sans WebGPU.

## 5. Effets du menu, petite et grande image

`rust/tools/audit-effects-web.mjs` sur le moteur corrigé (Node, un seul fil, réglages par
défaut) : **86 effets, aucun échec**. Médiane 27 ms à 0,3 Mpx, 241 ms à 3 Mpx ; 69 / 86 sous
100 ms à 0,3 Mpx, 68 / 86 sous 500 ms à 3 Mpx.

| Effet (les plus lents) | 0,3 Mpx | 3 Mpx | 20 Mpx (estimé, un fil) |
|---|---:|---:|---:|
| Mandelbrot | 3,2 s | 29,9 s | ≈ 199 s |
| Flou radial | 1,2 s | 11,9 s | ≈ 80 s |
| Julia | 0,8 s | 5,5 s | ≈ 37 s |
| Flou de surface | 0,6 s | 5,2 s | ≈ 35 s |
| Flou d'esquisse | 0,4 s | 4,1 s | ≈ 27 s |
| Flou de zoom | 0,4 s | 2,7 s | ≈ 18 s |
| Médiane | 0,4 s | 1,9 s | ≈ 13 s |
| Flou de déplacement | 0,2 s | 1,8 s | ≈ 12 s |
| Réduction du bruit | 0,3 s | 1,6 s | ≈ 10 s |

Correction : dans le navigateur, les effets spatiaux sont maintenant **répartis en bandes sur
plusieurs workers** (jusqu'à 4, image entière en contexte, `masterpaint_core::apply_band`,
`mpCompute.run`), comme `apply_parallel` sur le bureau. Résultat identique (test
`banded_equals_whole` étendu aux bandes recollées). Gain attendu proche du nombre de workers ;
mémoire : une copie de l'image par worker (limite 30 Mpx).

Reste : tables du flou radial / de zoom (méthode PhotoCraft, ×4 à résultat identique), grille
bilatérale pour le flou de surface, médiane à histogramme glissant.

## 6. Mode téléphone

- Menu ☰ (tiroir), barre du bas et panneaux du bas (effets, calques) : conformes.
- **Défaut corrigé** : les fenêtres (Nouvelle image, Exporter, Paramètres…) s'ouvraient en
  pleine page avec la barre de titre de bureau (croix rouge carrée). Elles ont maintenant un
  en-tête mobile : titre centré, bouton fermer rond, poignée pour les panneaux du bas
  (`FloatWindow.mob`).
- Reste : ruban du haut identique au bureau, serré à 390 px.

## 7. Photo Pro

- Colonne Navigateur / Préréglages et modules Bibliothèque / Développement : dans toutes les
  interfaces (avant : Photoshop seulement).
- Corrigé : en présentation Photoshop, le panneau de réglages était décalé (il recouvrait la
  photo et laissait une bande vide à droite) ; « Développement » passait sous les boutons ;
  pastille Avant / Après coupée.

## Suite du 11/11/26 (version 3.5.8)

Mesures dans Chrome, carte graphique réelle (WebGL), projet d'exemple (1000 × 850, plusieurs
calques ƒ) et photo de 20 Mpx :

| Geste | Avant | Après |
|---|---:|---:|
| Déplacer un calque sous les filtres ƒ (par mouvement) | 346 ms | 128 ms |
| Curseur d'opacité sous un filtre ƒ (par mouvement) | 253 ms | 71 ms |
| Coup de pinceau, photo 20 Mpx | 105 ms | 62 ms |

Image finale identique au pixel près dans les deux premiers cas.

- **Causes trouvées au profileur** : à chaque mouvement, l'entrée de chaque filtre ƒ était
  recomposée en pleine résolution (42 % du temps), puis l'affichage relu de la carte graphique
  (30 %) ; au premier coup de pinceau, la copie complète du calque pour l'historique (≈ 45 %).
- **Corrections** : pendant un geste (`note_gesture`), entrée des filtres composée directement
  au pas du brouillon (`Doc::dynamic_jobs_step`, `gesture_plan`, `draft_stages_loose`),
  affichage composé à un pas deux fois plus grossier (`gpuview::coarse`), recompositions
  regroupées (`redraw_soon`), rendu du calque déplacé en brouillon ; rendu exact au relâchement
  ou 0,7 s après le dernier mouvement. Historique : copie privée du calque actif préparée au
  repos (`Doc::prepare_spare` / `adopt_spare`), sans changer le format de l'historique (un
  historique par tuiles aurait demandé de reprendre tout le moteur pour ce même gain).
- Essayé et écarté : composition grossière sur le processeur dans le navigateur (164 ms, plus
  lent que WebGL).
- **Reste** : la relecture synchrone de WebGL (≈ 30 % d'un mouvement) ; une lecture asynchrone
  (tampon PBO + barrière) la supprimerait.
