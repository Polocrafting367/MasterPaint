# Audit des performances web — 8 novembre 2026

© 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.

## Périmètre et méthode

Audit du code de composition, des filtres dynamiques, des aperçus et des caches de compilation. Mesures du moteur WebAssembly distribué, sous Node 20, sans GPU : une chauffe puis médiane de trois calculs. Image RGBA opaque synthétique ; flou gaussien de rayon 8 pixels (rayon ajusté avec la réduction), luminosité/contraste [10,15]. Les mesures incluent le passage JS/WASM et la sortie RGBA, mais pas la composition des calques, le redimensionnement d'entrée, les transferts worker, ni le dessin de l'interface. Ce ne sont donc pas des fréquences d'affichage du navigateur. Mesures indicatives sur cette machine, avec compilation en arrière-plan ; elles varient selon la charge. Le script reproductible est `rust/tools/benchmark-web.mjs`.

## Coûts identifiés dans le code

- `display_step` et `composite_scaled` réduisent déjà la composition et les pixels envoyés à l'écran. Le zoom ajuste automatiquement le pas sur les grandes images.
- `dynamic_jobs_excluding` réutilise l'entrée des filtres lorsque seuls leurs paramètres changent ; une retouche locale peut ne recomposer qu'une zone. Les dépendances entre calques dynamiques attendent les résultats précédents.
- Limite importante : cette entrée de filtre reste un tampon pleine résolution. Le brouillon est réduit ensuite dans `dyn_low_job`. Une réduction ÷8 ne divise donc pas toute la mémoire du document par 64.
- `dyn_chain` et le chemin sans WebGPU calculent encore certains étages dynamiques synchroniquement. Les effets de menu lourds passent par un worker ; tous les calculs du moteur dynamique ne sont pas encore déportés. Sur gros projets, ceci peut bloquer l'interface.
- Les piles non compatibles avec une réduction conservent leur calcul complet (`draft_stages`). Un rendu réduit ne garantit donc pas l'accélération de chaque filtre.
- L'export demande un rendu complet (`flatten_final`), indépendamment du brouillon affiché. Les pixels source et les calques restent intacts.
- À 4000 × 4000, un seul tampon RGBA utilise environ 61 Mio. Plusieurs calques, entrées de filtres, caches et étapes d'historique cumulent rapidement plusieurs centaines de Mio.
- La taille compressée du fichier n'indique pas le coût en mémoire : les dimensions décodées et le nombre de calques/effets sont déterminants.

## Corrections apportées

- Rendu ÷2 accessible pour toute image ; ÷4 à partir de 4 millions de pixels, ÷8 à partir de 16 millions. Cas 1 × 1 conservé en calcul intégral pour éviter un travail dynamique bloqué.
- La proposition automatique de réduction peut maintenant concerner un petit projet lent.
- Correction de la normalisation des noms d'icônes et priorité au nom exact ; désactivation totale du remplacement Font Awesome pour le pack MasterPaint.
- Aperçu du damier réutilisant l'image déjà produite, sans milliers de rectangles supplémentaires.
- Nettoyage des caches natifs et des compilations de développement ; seule la chaîne web optimisée est utilisée pour cette livraison.

## Suites recommandées

1. Déporter les étages dynamiques CPU sur le worker existant, avec annulation des résultats périmés.
2. Composer directement une entrée réduite pour les filtres compatibles ; conserver un cache distinct pour la pleine résolution.
3. Mesurer en navigateur les tracés avec plusieurs filtres, le temps entre mouvement et affichage et le pic mémoire, GPU actif puis désactivé. Les mesures de moteur ci-dessous ne remplacent pas cette campagne interactive.

## Mesures du moteur

| Projet | Rendu | Flou gaussien | Luminosité | Tampon de travail |
|---|---:|---:|---:|---:|
| 800 × 600 | ÷1 | 40.6 ms | 14.5 ms | 1.8 Mio |
| 800 × 600 | ÷2 | 10 ms | 3.3 ms | 0.5 Mio |
| 2400 × 1800 | ÷1 | 366.7 ms | 122.7 ms | 16.5 Mio |
| 2400 × 1800 | ÷2 | 90.1 ms | 30.7 ms | 4.1 Mio |
| 2400 × 1800 | ÷4 | 22.4 ms | 7.7 ms | 1 Mio |
| 4000 × 4000 | ÷1 | 1352.5 ms | 481.7 ms | 61 Mio |
| 4000 × 4000 | ÷2 | 341.7 ms | 112 ms | 15.3 Mio |
| 4000 × 4000 | ÷4 | 82.6 ms | 28 ms | 3.8 Mio |
| 4000 × 4000 | ÷8 | 21.1 ms | 7.4 ms | 1 Mio |

## Campagne interactive dans le navigateur — 8 novembre 2026 (soir)

Suite de la recommandation 3. Version web compilée (profil `web`), Chrome sans carte graphique
(rendu logiciel SwiftShader, WebGL2 sans WebGPU), processeur ralenti ×4 pour simuler un PC
modeste, fenêtre 1366 × 768. Chiffre = temps de travail du fil principal (`TaskDuration`) ; entre
parenthèses, la part du code de MasterPaint (`ScriptDuration`) ; le reste est le dessin de la page
par le navigateur. Sur un PC ordinaire, diviser environ par 4. Scénarios pilotés par CDP avec de
vrais clics (`scratchpad/cdp.py`), captures vérifiées à chaque étape.

| Scénario | Avant | Après corrections |
|---|---:|---:|
| Démarrage (10 premières secondes) | 2,2 s (0,3 s) | inchangé |
| Ouvrir les Paramètres | 0,56 s | inchangé |
| Interface MasterPaint → Paint.NET (pack PaintJS) | 1,98 s (1,53 s) | 1,06 s ; 0,60 s la fois suivante |
| Interface → Photoshop (pack PhotoCraft) | 1,40 s | 0,99 s |
| Thème sombre | 0,43 s | inchangé |
| Petite image 800 × 533 : ouverture | 0,14 s | — |
| — pinceau, par mouvement | 52 ms (15 ms) | — |
| — survol de la toile, par mouvement | 13 ms | — |
| — déplacer une palette, par mouvement | 37 ms (5 ms) | — |
| — zoom avant + arrière | 0,28 s | — |
| Photo 5472 × 3648 (20 Mpx) : ouverture | 0,94 s (+ décodage au worker) | — |
| — pinceau, par mouvement | 81 ms (43 ms) | — |
| — survol / palette / zoom | 13 ms / 37 ms / 0,31 s | — |
| Filtre ƒ + Flou gaussien, 20 Mpx : ouvrir la fenêtre | **10,1 s (9,7 s)** | **2,0 s** |
| — OK (calcul pleine résolution) | (pendant le réglage) | 6,9 s, une seule fois |
| — peindre sous le filtre, par mouvement | 80 ms | 72 ms |
| Filtre ƒ, petite image : fenêtre / OK / pinceau | — | 0,72 s / 0,63 s / 63 ms |

### Corrections de ce lot

- **Filtre ƒ pendant le réglage** : une pause de 0,3 s lançait le calcul en pleine résolution
  alors que la fenêtre de l'effet était encore ouverte (passes WebGL puis `readPixels` synchrone de
  80 Mo : interface figée plusieurs secondes, toile vide pendant ce temps). L'aperçu reste
  maintenant à la taille affichée ; pleine résolution à la validation seulement (`dyn_refine`).
- **Aperçus réduits trop forts** : `scale_px` bornait les réglages en pixels au minimum de la
  fenêtre. Un flou de 2 px vu au 1/9 devenait 1 px réduit, soit ~9 px à l'échelle : l'aperçu ne
  ressemblait pas au résultat. Valable pour tous les effets à aperçu réduit.
- **Changer d'interface / de pack** : les packs intégrés (≈ 400 Ko de JSON) étaient relus à chaque
  choix ; les icônes PNG redécodées et réduites en Lanczos à chaque fois. Packs lus une fois,
  icônes rendues gardées en cache, réduction bilinéaire (suffisante à 16–32 px).
- **Icônes de l'outil** : le remplacement par le pack était calculé deux fois par outil.
- **Glyphes au style MasterPaint** : préparés une fois en masques puis seulement teintés (pas de
  rendu SVG à chaque changement de thème).
- **Recherche des équivalents dans un pack** : index des noms normalisés construit au choix du pack
  (avant : ~1 million de chaînes recréées à chaque changement de thème).
- **Damier** : écrit directement en pixels (aperçu des Paramètres figé dans le navigateur avec
  l'image SVG).

### Ce qui reste lourd

1. **Validation d'un filtre ƒ sur une grande image** : 6,9 s ralenti (≈ 1,7 s réel) de fil
   principal bloqué, surtout la lecture synchrone du résultat WebGL (`readPixels`, 80 Mo). Piste :
   lecture asynchrone (tampon `PIXEL_PACK` + `fenceSync`, puis `getBufferSubData`), ou par bandes.
2. **Dessin de la page** : sans carte graphique, chaque mouvement de pinceau ou de palette redessine
   toute la fenêtre (femtovg n'a pas de rendu partiel) : 35–40 ms par mouvement au ralenti, quelle
   que soit la taille de l'image. Leviers déjà en place : mode léger, résolution de l'interface.
3. **Premier passage à un pack d'icônes** : ~1 s ralenti (décodage de ~300 PNG). Piste : PNG du
   pack pré-réduits à 32 px dans le JSON.
4. Pinceau sur 20 Mpx : 43 ms de code au ralenti (≈ 11 ms réels) — acceptable.

## Effets et Photo Pro — 8 novembre 2026 (nuit)

### Tous les effets du moteur (86)

`rust/tools/audit-effects-web.mjs` (Node, moteur WebAssembly publié, un seul fil, réglages par
défaut), image 1600 × 1200 (2 Mpx). Aucun effet en échec. Médiane : 154 ms ; 54 effets
sur 86 sous 200 ms. Ces calculs tournent au worker : l'interface ne se fige pas, mais
l'application d'un effet lent sur une grande photo fait attendre. Estimation 20 Mpx = ×10,4.

| Effet (les 15 plus lents) | 2 Mpx | 20 Mpx (estimé) |
|---|---:|---:|
| mandelbrot | 18331 ms | ≈ 191 s |
| radialblur | 7688 ms | ≈ 80 s |
| julia | 3552 ms | ≈ 37 s |
| surfaceblur | 3215 ms | ≈ 33 s |
| sketchblur | 2605 ms | ≈ 27 s |
| morphology | 2125 ms | ≈ 22 s |
| zoomblur | 1734 ms | ≈ 18 s |
| median | 1236 ms | ≈ 13 s |
| motionblur | 1180 ms | ≈ 12 s |
| outline | 1017 ms | ≈ 11 s |
| reducenoise | 1012 ms | ≈ 11 s |
| highlightsshadows | 923 ms | ≈ 10 s |
| pastel | 904 ms | ≈ 9 s |
| oil | 710 ms | ≈ 7 s |
| sketch | 686 ms | ≈ 7 s |

- **Fractale de Mandelbrot** : chaque point qui ne s'échappe jamais faisait ~1000 itérations
  × 5 échantillons pour finir blanc. Deux raccourcis exacts : cardioïde principale et disque de
  période 2, puis orbite qui repasse exactement par une valeur déjà vue (méthode de Brent, égalité
  stricte) — le rendu par défaut (zoom 10) cadre le bord de l'ensemble, où seul le second sert.
  Tests `mandelbrot_interior_is_white` et `mandelbrot_cycle_is_white`.
- **Flou radial, flou de zoom, Julia, flou de surface, morphologie** : algorithmes de Paint.NET
  tels quels (le flou radial fait 136 rotations × 2 échantillons par pixel). Pas de raccourci
  exact. **Piste principale : répartir l'image en bandes sur plusieurs workers** (le moteur calcule
  déjà par bandes `y0..y1`) — gain proche du nombre de cœurs, au prix d'une copie de la source par
  worker.

### Photo Pro (navigateur, RAW Sony 5472 × 3648, processeur ralenti ×4)

| Action | Fil principal | dont MasterPaint |
|---|---:|---:|
| Ouvrir le RAW (développement au worker), 30 s | 4,4 s | 2,9 s |
| Curseur Exposition / Contraste / Température, par mouvement | ~175 ms | ~40 ms |
| Auto | 2,4 s | 1,4 s |
| Ouvrir dans l'éditeur | 6,8 s | 6,0 s |

- Curseurs : l'essentiel est le dessin de la page (envoi de l'aperçu à la carte graphique, rendu
  logiciel), pas le calcul ; aperçu à la taille affichée, comme demandé.
- « Ouvrir dans l'éditeur » : pas de point unique — composition de la photo pleine résolution
  (WebGL + `readPixels` synchrone), aperçu de fond, copies de 80 Mo vers JavaScript (texture,
  sauvegarde automatique). Pistes : lecture WebGL asynchrone, sauvegarde automatique différée de
  quelques secondes après l'ouverture.
