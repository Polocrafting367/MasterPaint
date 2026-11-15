<!-- MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md. -->
# Crédits de MasterPaint

© 2026 **polocrafting** — [polocrafting.fr](https://polocrafting.fr).

MasterPaint est conçu et développé par polocrafting. Son moteur de création bitmap et vectoriel, ses outils, ses effets et leur intégration constituent le travail propre au projet.

Dépôt : [Polocrafting367/MasterPaint](https://github.com/Polocrafting367/MasterPaint).

## Crédits et projets distincts

- **Paint.NET** est le projet original de **Rick Brewster, dotPDN et ses contributeurs** : [paint.net](https://paint.net/) · [dépôt OpenPDN](https://github.com/rivy/OpenPDN). Ses ressources et licences restent celles de leurs auteurs.
- **PaintJS / paintdotjs** est un autre projet, réalisé par **LabyStudio** : [paintjs.net](https://paintjs.net/) · [dépôt paintdotjs](https://github.com/LabyStudio/paintdotjs). Il sert de référence d'interface web et fournit le pack d'icônes PaintJS. Il ne s'agit pas du projet Paint.NET.
- **ArtCraft** — **PhotoCraft**, **VectorCraft** et **LightCraft**, par **storytold et les contributeurs** : [getartcraft.com/apps](https://getartcraft.com/apps) · [dépôts storytold](https://github.com/storytold). PhotoCraft est la référence de l'interface Photoshop et la source du pack d'icônes PhotoCraft ; VectorCraft, celle des projets SVG façon Illustrator et une source d'icônes ; LightCraft, celle du Photo Pro façon Lightroom. Le remplissage de contenu PatchMatch (`rust/masterpaint-core/src/inpaint/`) est repris de LightCraft (`crates/inpaint`, lui-même porté de PhotoCraft). Code et créations propres MIT ou Apache-2.0 ; icônes Lucide/Feather et autres créations selon les notices et licences conservées dans `rust/masterpaint-ui/icon-packs/photocraft/`.
- **U²-Net** (modèle U²-Net-p), par **Xuebin Qin et al.** (licence Apache-2.0, 2020) : [dépôt xuebinqin/U-2-Net](https://github.com/xuebinqin/U-2-Net) ; fichier ONNX tel que distribué par [rembg](https://github.com/danielgatis/rembg). Détourage par IA des versions de bureau (`rust/masterpaint-ui/models/u2netp.onnx`), exécuté par **tract** (Sonos, MIT / Apache-2.0).
- **7.css**, par **Khang Nguyen Duy** (licence MIT, © 2021) : [site](https://khang-nd.github.io/7.css/) · [dépôt khang-nd/7.css](https://github.com/khang-nd/7.css). Référence du style « Windows 7 » de l'interface MasterPaint (couleurs, dégradés, cadre Aero) ; les icônes de barre de titre et de curseur reprises sont dans `rust/masterpaint-ui/ui/skins/win7/`, avec la licence (`LICENSE-7.css.txt`).
- **XP.css** et **98.css**, par **Adam Hammad et Jordan Scales** (licence MIT, © 2020) : [site](https://botoxparty.github.io/XP.css/) · [dépôt botoxparty/XP.css](https://github.com/botoxparty/XP.css). Références des styles « Windows XP » et « Windows 98 » ; icônes reprises (converties en PNG) et licence (`LICENSE-XP.css.txt`) dans `rust/masterpaint-ui/ui/skins/xp/`.
- **Font Awesome Free** : icônes sous CC BY 4.0, polices sous SIL OFL 1.1 ; [licences](https://fontawesome.com/license/free).
- **Selawik**, Rust, Slint et les autres bibliothèques gardent leurs droits et licences respectifs.

Les noms Paint.NET, PaintJS, ArtCraft, Photoshop, Illustrator, Lightroom et Windows désignent des projets ou références indépendants. MasterPaint n'est affilié à aucun d'eux.

## Conditions de réutilisation des créations MasterPaint

L'auteur autorise la copie et l'adaptation du code et des créations propres à MasterPaint uniquement sous un nom de projet différent de « MasterPaint ». Toute copie ou adaptation publiée doit conserver les mentions de polocrafting, le lien cliquable vers [polocrafting.fr](https://polocrafting.fr/) et le lien cliquable vers le [dépôt MasterPaint](https://github.com/Polocrafting367/MasterPaint). Ces mentions ne doivent pas être supprimées, masquées ou remplacées.

Cette autorisation est non commerciale : le projet, une copie ou une adaptation ne doit pas être vendu, proposé contre paiement, intégré à une offre payante ou exploité pour générer un revenu. Il n'est pas autorisé de repartager le projet tel quel en demandant de l'argent, ni de contourner cette restriction par un intermédiaire, un abonnement, un don conditionné ou une autre présentation financière.

Les icônes personnalisées créées par polocrafting sont réservées à une utilisation dans MasterPaint. Elles ne sont pas autorisées pour créer un pack destiné à un autre logiciel, un site, une application ou un produit. L'export PNG proposé dans MasterPaint sert à emporter ou sauvegarder le pack pour un usage dans MasterPaint ; il ne transfère pas de droits de réutilisation externe.

Ces conditions s'appliquent aux éléments propres à MasterPaint. Elles ne remplacent pas les licences des projets et ressources tierces, dont les fichiers de licence et notices restent joints aux packs concernés.

## Mentions dans les fichiers

Les sources propres à MasterPaint portent une mention d'auteur en commentaire, compatible avec leur format. Cette mention ne remplace aucune licence existante. Les fichiers tiers, les archives, les images matricielles, les polices, les exécutables et les formats ne permettant pas de commentaire ne reçoivent pas de préfixe qui pourrait les altérer. Cette notice couvre les créations propres à MasterPaint dans ces formats.
