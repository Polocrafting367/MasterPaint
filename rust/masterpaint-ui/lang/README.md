<!-- MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md. -->
# Traductions de l’interface Rust

Le français est la langue source. Les catalogues `fr`, `en`, `es`, `de`, `it` et `pt`
utilisent les mêmes identifiants et sont embarqués à la compilation.

Les traductions ont été initialisées automatiquement, puis corrigées pour la
terminologie des commandes principales, notamment en anglais (outils, fusion,
effets, photographie, raccourcis). Une relecture linguistique des textes longs
reste utile ; un catalogue rempli ne garantit pas une traduction parfaite.

## Sources prises en compte

- Textes `@tr("…")` dans `ui/*.slint`, y compris les fichiers générés.
- Libellés lisibles du code Rust : dialogues, fenêtres d’effets, options,
  sections, historique, erreurs, progression, raccourcis, préréglages et couleurs RAL.
- Modules d’animation, panneau d’objets SVG et avertissements d’import SVG.
- Écran de chargement et fenêtre d’erreur de `web/index.html` : appels `mpTr`,
  éléments `data-mp-i18n` et attributs `data-mp-placeholder`.

Les identifiants internes de calque, les actions, les noms de police, les fichiers
et les noms de calque saisis par l’utilisateur doivent rester stables. On traduit
les libellés au moment de leur affichage. Les codes internes utilisés pour bloquer
les outils restent en français ; les badges affichés sont traduits séparément.
Les notes de version (`changelog.txt`), les messages techniques des bibliothèques
externes et le contenu des documents ne sont pas des traductions d’interface.

## Mise à jour et vérification

Depuis `rust/masterpaint-ui` :

```sh
python3 -I tools/gen_lang.py
python3 -I tools/gen_lang.py --check
```

La première commande conserve les traductions existantes, ajoute les nouveaux
textes avec une traduction vide (sauf en français), retire les anciennes entrées
et régénère le petit catalogue JavaScript embarqué dans la page Rust. Elle ne
contacte aucun service de traduction.

La vérification échoue si une langue contient une entrée absente, vide ou
obsolète, si un paramètre `{n}`, `{}` ou `{ms:.0}`, une unité ou un axe X/Y est altéré,
si un libellé Slint lisible contourne `@tr`, ou si le catalogue
JavaScript n’est pas à jour. Les chaînes Rust lisibles sont relevées par une
heuristique : lors de l’ajout d’un nouveau module ou d’un libellé court en
minuscules, vérifier sa collecte dans `tools/gen_lang.py` et son utilisation par
`i18n::tr` au point d’affichage. Le contrôle des catalogues ne remplace pas un
contrôle des écrans.

Pour les messages formatés côté Rust, utiliser
`i18n::tr_format!("Sélection : {} × {} px", largeur, hauteur)`. Les valeurs sont
formatées par Rust puis replacées dans le modèle traduit. Les messages des
travailleurs d’arrière-plan sont traduits sur le fil de l’interface lors de leur
affichage. Un changement de langue rafraîchit aussi les modèles fournis par Rust.

```sh
cargo check -p masterpaint-ui
cargo check -p masterpaint-ui --target wasm32-unknown-unknown
cargo test -p masterpaint-ui i18n::
```

Les modifications concernent l’interface Rust. Elles ne modifient pas l’ancienne
interface HTML ni les fichiers publiés à la racine du site : la page Rust sera
copiée lors du prochain lancement des scripts de construction web habituels.
