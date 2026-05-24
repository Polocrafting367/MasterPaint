<p align="center">
  <img src="icons/readme-banner.svg" alt="MasterPaint Retro-Modern Banner" width="100%" />
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Licence-Open%20Source-0d7a7a.svg?style=flat" alt="Licence" />
  <img src="https://img.shields.io/badge/Sécurité-100%25%20Local-fe8511.svg?style=flat" alt="Sécurité Local" />
  <img src="https://img.shields.io/badge/Style-Win98%20Modern-1e4a8c.svg?style=flat" alt="Design Rétro Moderne" />
</p>

<div align="center">

### -> [Essayez MasterPaint en ligne : polocrafting.fr/Illu](http://polocrafting.fr/Illu)

</div>

---

## À propos de MasterPaint

**MasterPaint** est une application web d'édition graphique puissante et accessible directement depuis n'importe quel navigateur moderne (ordinateurs et mobiles). Conçu comme un pont idéal entre la retouche matricielle traditionnelle (inspirée de **Paint.NET** et **Photoshop**) et le dessin vectoriel (inspiré d'**Illustrator**), MasterPaint vous permet de créer, modifier et fusionner des images bitmap et des éléments vectoriels au même endroit, sans compromis.

L'application fonctionne **100% en local** via votre navigateur : aucun tracking, pas de publicité, tous vos projets restent sur votre machine. Les traitements complexes d'effets et de géométrie sont accélérés localement par **WebGL** et **WebAssembly**.

---

## Fonctionnalités principales

Chaque outil est modélisé de façon vectorielle ou matricielle avec une précision chirurgicale :

* **Dessin vectoriel & Calques dynamiques** : Formes intelligentes (carrés, rectangles arrondis, triangles) avec poignées tactiles pour modifier les rayons et la courbure, fusion de formes vectorielles et groupage.
* **Effets GPU & WASM accélérés** : Moteur asynchrone pour les filtres (peinture à l'huile, flou, effet VHS, projections 3D) couplé à un affichage basse-résolution en temps réel pour conserver une fluidité constante.
* **Déformations homographiques (Warp-4)** : Outil de déformation à 4 points d'ancrage avec cache de pixels optimisé et suppression automatique des artefacts transparents en bordure.
* **Sélection, Alignement & Remplissage IA** : Raccourcis claviers professionnels complets, outil de centrage automatique et remplissage intelligent localisé.

---

## Charte graphique (Rétro-Moderne)

L'interface de MasterPaint est directement construite autour du fichier [`css/theme-win98-modern.css`](css/theme-win98-modern.css) qui modernise les fenêtres classiques de Windows 98 :

* **Bordures 3D Nets** : Utilisation de reliefs biseautés nets créant une sensation de relief physique sur les boutons et fenêtres volantes (`--mp-raised-top: #ffffff`, `--mp-raised-bot: #8a8a8a`).
* **Palette Teal Vintage** : Le fond emblématique du bureau de Windows (`--mp-teal: #0d7a7a`).
* **Active Title Gradient** : Titres de fenêtres en dégradé dynamique du bleu cobalt au bleu profond (`#0f2d5c` à `#3d6dad`).
* **Logo Lynx géométrique** : Symbole de vision nocturne et de précision géométrique, utilisant des touches d'orange néon (`#fe8511`) et cyan (`#00f4e1`).

---

## Comment l'utiliser ?

### 1. En ligne (Recommandé)
L'application est hébergée et immédiatement disponible sur :
👉 **[http://polocrafting.fr/Illu](http://polocrafting.fr/Illu)**

### 2. En local sur votre machine
MasterPaint ne nécessite aucune base de données ni configuration lourde :

1. Clonez le dépôt sur votre ordinateur :
   ```bash
   git clone https://github.com/polocrafting/MasterPaint.git
   ```
2. Double-cliquez sur `index.html` ou utilisez un outil comme XAMPP ou un simple serveur web local pour l'héberger en un clic :
   ```bash
   php -S localhost:8000
   ```
3. Accédez à l'application via `http://localhost:8000`.
