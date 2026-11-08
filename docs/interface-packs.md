<!-- MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md. -->
# Apparence, thèmes et packs d’icônes

Dans Paramètres → Apparence, choisissez une présentation complète :

- **MasterPaint** : ruban, barres et fenêtres flottantes configurables ; finitions Moderne ou Windows 98.
- **Paint.NET** : barre de menu et barre d’options compacte, outils à deux colonnes, panneaux flottants et palette Paint.NET.
- **Photoshop** : barre d’options sombre, outils en rail vertical à gauche, panneaux ancrés à droite et icônes PhotoCraft.
- **Téléphone** : ruban tactile, commandes compactes et panneaux escamotables.

Les quatre présentations gardent les outils, le moteur et les fonctions de MasterPaint. Les réglages rapides regroupent mode sombre, couleur d’accentuation, ruban/barre d’options et coins arrondis. Le choix des icônes manquantes permet d’utiliser l’icône MasterPaint ou un équivalent Font Awesome lorsqu’il existe.

## Icônes classiques MasterPaint

Les fichiers SVG individuels sont dans `rust/masterpaint-ui/icon-packs/masterpaint/source/` : `masterpaint/`, `sprite/`, `tools/` et `fontawesome/`. Les générateurs les compilent directement depuis ce dossier. Chaque SVG MasterPaint porte la mention © 2026 polocrafting. Les ressources tierces gardent leurs crédits et notices de licence dans leurs dossiers d’origine.

## Import et export

**Exporter le pack complet** crée un ZIP avec un manifeste JSON, les icônes en PNG (conversion des SVG), les ressources non vectorielles du pack sélectionné et les crédits. Le format JSON autonome reste également importable.

L’import accepte ZIP, JSON, PNG, JPG/JPEG et SVG, y compris plusieurs fichiers à la fois. Pour qu’une image remplace une icône MasterPaint, son nom (sans extension) doit correspondre à un identifiant existant ou à un nom de fichier d’icône source. Les images qui ne correspondent à aucun identifiant restent conservées dans la bibliothèque du pack importé. PNG et JPG sont convertis en PNG ; les SVG autonomes peuvent utiliser `{STROKE}`, `{ACCENT}`, `{SUBTLE}` et `{BG}` pour suivre les couleurs de l’interface.

Un JSON de pack utilise `format: "masterpaint-icon-pack"`, une version 1 ou 2, un nom et une table `icons`. Les familles d’identifiants sont `mp/`, `sprite/`, `tool/` et `fa/`. L’import de pack remplace le pack personnalisé seulement si le contenu est valide.

## Sources et crédits

- MasterPaint : [dépôt GitHub](https://github.com/Polocrafting367/MasterPaint), développé par polocrafting — [polocrafting.fr](https://polocrafting.fr).
- Paint.NET / paintdotjs : [dépôt LabyStudio](https://github.com/LabyStudio/paintdotjs), [site paintjs.net](https://paintjs.net/).
- PhotoCraft : [dépôt GitHub](https://github.com/storytold/photocraft).
- Font Awesome Free : [licences et attributions](https://fontawesome.com/license/free).

Les révisions de référence sont inscrites dans `icon-packs/paintdotjs.json` et `icon-packs/photocraft.json`. Les dépôts sources locaux sont dans `../masterpaint-inspiration/`. Voir [COPYRIGHT.md](../COPYRIGHT.md) et les notices conservées sous `rust/masterpaint-ui/icon-packs/`.

Une sauvegarde de l’état antérieur aux thèmes est conservée dans `backups/masterpaint-2026-11-08-avant-themes.tar.gz`.
