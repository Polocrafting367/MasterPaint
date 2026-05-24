<p align="center">
  <img src="icons/readme-banner.svg" alt="MasterPaint Banner" width="100%" style="border-radius: 4px; box-shadow: 0 4px 20px rgba(0,0,0,0.3);" />
</p>

---

<p align="center">
  <a href="https://github.com/polocrafting/MasterPaint/blob/main/LICENSE"><img src="https://img.shields.io/badge/Licence-Open%20Source-10b981.svg?style=for-the-badge" alt="Licence" /></a>
  <img src="https://img.shields.io/badge/Sécurité-100%25%20Local-fe8511.svg?style=for-the-badge" alt="Sécurité Local" />
  <img src="https://img.shields.io/badge/Interface-Rétro--Moderne-1e4a8c.svg?style=for-the-badge" alt="Style Rétro Moderne" />
  <img src="https://img.shields.io/badge/Plateformes-Web%20%2F%20Mobile%20PWA-00f4e1.svg?style=for-the-badge" alt="Plateformes" />
</p>

<div align="center">
  
### 🚀 -> [Lancer MasterPaint en ligne : polocrafting.fr/Illu](http://polocrafting.fr/Illu)

</div>

---

## 📌 À propos de MasterPaint

**MasterPaint** est un éditeur graphique hybride ultra-performant conçu pour s'exécuter directement dans votre navigateur web, sur ordinateur ou mobile. Il unit harmonieusement la retouche matricielle traditionnelle inspirée de **Paint.NET** et **Photoshop** avec la flexibilité et la précision du dessin vectoriel d'**Illustrator**.

Que vous dessiniez des formes géométriques parfaites à l'aide de courbes vectorielles intelligentes ou que vous retouchiez des photos haute résolution à l'aide de filtres matériels en temps réel, MasterPaint offre une expérience fluide, sans compromis et **entièrement respectueuse de votre vie privée**.

> [!IMPORTANT]
> **Aucun tracking, aucune publicité, aucun serveur tiers.** Toutes vos données restent dans votre navigateur. Les calculs lourds (effets, déformations) s'exécutent en local via **WebAssembly** et **WebGL**.

---

## 🛠️ Fonctionnalités Phares

MasterPaint regorge d'outils professionnels pensés pour allier vitesse rétro et puissance moderne :

### 1. <svg viewBox="0 0 16 16" width="28" height="28" style="vertical-align: middle; margin-right: 10px;"><rect x="2" y="2" width="12" height="12" rx="1.5" fill="none" stroke="#3b82f6" stroke-width="1.75" stroke-linejoin="round"/><rect x="5.5" y="5.5" width="5" height="5" rx="0.5" fill="#fe8511"/></svg> Dessin Vectoriel & Calques Dynamiques
- **Formes intelligentes interactives** (carrés, rectangles arrondis, triangles) munies de **poignées jaunes** tactiles pour ajuster dynamiquement les rayons de courbure et la géométrie.
- Gestion avancée des **Calques (Layers)** avec buffers persistants indépendants et modes de fusion.
- Outils de **fusion de formes vectorielles** et de **groupage** pour composer des illustrations complexes en un clic.

### 2. <svg viewBox="0 0 16 16" width="28" height="28" style="vertical-align: middle; margin-right: 10px;"><defs><linearGradient id="smart-grad-readme" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#ec4899"/></linearGradient></defs><rect x="2" y="2" width="12" height="12" rx="1.5" fill="url(#smart-grad-readme)" stroke="#ffffff" stroke-width="1.25"/><path d="M 8 4 L 9.2 6.5 L 12 6.9 L 10 8.8 L 10.5 11.5 L 8 10.2 L 5.5 11.5 L 6 8.8 L 4 6.9 L 6.8 6.5 Z" fill="#eab308" stroke="#1e293b" stroke-width="1.25" stroke-linejoin="round"/></svg> Effets GPU & Traitements WebAssembly (WASM)
- Une suite complète d'effets visuels (Flous artistiques, Peinture à l'huile, Effet VHS, Projections 3D) exécutés de manière asynchrone par des **Workers WASM** pour des performances optimales.
- Prévisualisation instantanée à basse résolution (multi-résolution asynchrone) sur les grands projets pour une fluidité sans interruption.
- Moteur WebGL unifié pour les ajustements de colorimétrie professionnels (TSL, courbes pro et Camera Raw).

### 3. <svg viewBox="0 0 16 16" width="28" height="28" style="vertical-align: middle; margin-right: 10px;"><g stroke="#9ca3af" stroke-width="1.25" stroke-linecap="square"><line x1="4.5" y1="3" x2="6.5" y2="3"/><line x1="9.5" y1="3" x2="11.5" y2="3"/><line x1="4.5" y1="13" x2="6.5" y2="13"/><line x1="9.5" y1="13" x2="11.5" y2="13"/><line x1="3" y1="4.5" x2="3" y2="6.5"/><line x1="3" y1="9.5" x2="3" y2="11.5"/><line x1="13" y1="4.5" x2="13" y2="6.5"/><line x1="13" y1="9.5" x2="13" y2="11.5"/></g><g fill="none" stroke="#3b82f6" stroke-width="1.5"><rect x="2" y="2" width="2" height="2" fill="#3b82f6"/><rect x="12" y="2" width="2" height="2" fill="#3b82f6"/><rect x="12" y="12" width="2" height="2" fill="#3b82f6"/><rect x="2" y="12" width="2" height="2" fill="#3b82f6"/><rect x="7" y="2" width="2" height="2"/><rect x="7" y="12" width="2" height="2"/><rect x="2" y="7" width="2" height="2"/><rect x="12" y="7" width="2" height="2"/></g></svg> Déformations & Grille Homographique (Warp-4)
- Outil de déformation ultra-fluide avec mise en cache optimisée des données pixellisées.
- Redressement rectangulaire en 4 points d'ancrage.
- Élimination automatique des artefacts de bordure transparente pour des fusions de pixels parfaites.

### 4. <svg viewBox="0 0 16 16" width="28" height="28" style="vertical-align: middle; margin-right: 10px;"><path d="M 8 1 V 15 M 1 8 H 15" fill="none" stroke="#00f4e1" stroke-width="2" stroke-linecap="round"/><rect x="5" y="5" width="6" height="6" rx="1" fill="#fe8511" stroke="#ffffff" stroke-width="1"/></svg> Sélection, Alignement & Remplissage IA
- Raccourcis clavier professionnels (`Ctrl+A` Sélectionner tout, `Ctrl+I` Inverser, copier-coller croisé).
- Outil intelligent de centrage de sélection horizontal/vertical.
- **Remplissage Intelligent IA (Content-Aware Fill)** localisé grâce à l'extraction de zones ciblées.

---

## 🎨 Charte & Identité Visuelle

L'application arbore une double identité visuelle unique :

| Thème | Caractéristiques |
| :--- | :--- |
| **📺 Rétro Windows 98** | Reliefs 3D nets, boutons biseautés authentiques, nostalgie de l'âge d'or du pixel art et de Paint.NET. |
| **🌌 Sombre Moderne** | Un mode sombre ultra-premium aux contrastes soignés pour travailler la nuit avec un confort visuel exceptionnel. |

### Le Logo : Le Lynx Rétro-Moderne
Le logo de MasterPaint représente un Lynx géométrique en style low-poly. Il incarne la **vision nocturne** (mode sombre), la **précision chirurgicale** du dessin vectoriel (les lignes géométriques) et l'**agilité** d'une application web réactive.
- **Teintes dominantes** : Bleu Cobalt (`#2d51e9`), Cyan Électrique (`#00f4e1`), Orange Néon (`#fe8511`) et Profondeurs Violettes (`#110224`).

---

## 📱 Expérience Mobile Exceptionnelle

MasterPaint n'est pas qu'une application de bureau. L'interface se transforme pour offrir le confort d'une **application native sur téléphone** :
- **Dock de commandes bas** avec navigation intuitive par scroll.
- **Pinch-to-zoom libre** et déplacement du canevas sans contrainte (tactile multipoint).
- Panneaux détachables de gestion des couleurs, calques et effets sous forme de tiroirs adaptatifs (Sheets).
- Compatibilité **PWA** totale (installation sur l'écran d'accueil, partage d'images natif via `share_target` et Service Worker).

---

## 💻 Comment l'utiliser ?

### 1. En ligne (Recommandé)
MasterPaint est directement disponible à l'adresse suivante :
👉 **[http://polocrafting.fr/Illu](http://polocrafting.fr/Illu)**

### 2. En local sur votre machine
Pour exécuter MasterPaint chez vous sans connexion internet :

1. Téléchargez ou clonez ce dépôt :
   ```bash
   git clone https://github.com/polocrafting/MasterPaint.git
   ```
2. Double-cliquez sur `index.html` ou placez le dossier dans votre serveur local favori (XAMPP, Apache, Nginx ou simple serveur php) :
   ```bash
   # Exemple rapide avec PHP
   php -S localhost:8000
   ```
3. Ouvrez `http://localhost:8000` dans votre navigateur.

---

<p align="center">
  Conçu avec passion par <strong>polocrafting</strong>. Inspiré par l'ergonomie de Paint.NET et la puissance d'Adobe Creative Suite.
</p>
