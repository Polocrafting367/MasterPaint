Bibliothèques tierces utilisées par Illu (chargement réseau par défaut, copie locale optionnelle)
===============================================================================================

1) OpenCV.js — remplissage « contenu pris en compte » (ContentAwareFill.js)
----------------------------------------------------------------------------
Défaut : https://docs.opencv.org/4.8.0/opencv.js (script injecté au premier usage).

Pour héberger en local :
  - Télécharger le même fichier opencv.js (build Emscripten « opencv.js » officiel).
  - Le placer par exemple sous : illu/vendor/opencv/opencv.js
  - Avant le chargement de ContentAwareFill.js, définir dans la page :
        window.ILLU_OPENCV_URL = 'vendor/opencv/opencv.js';
    (chemin relatif à la page HTML, ou URL absolue.)

2) @imgly/background-removal — suppression de fond IA (RemoveBgIntelligent.js)
------------------------------------------------------------------------------
Défaut : import dynamique depuis jsDelivr (+esm), voir MODULE_URL dans RemoveBgIntelligent.js.

Pour utiliser une copie locale du paquet npm :
  - Dans le dossier du projet : npm install @imgly/background-removal@1.5.5
  - Exposer le module en HTTP avec le bon type MIME pour les .wasm (serveur web, pas file://).
  - Pointer vers le point d’entrée ESM du paquet, par exemple :
        window.ILLU_REMOVE_BG_MODULE_URL = '/chemin/vers/node_modules/@imgly/background-removal/dist/index.mjs';
    (Le chemin exact dépend de la version ; vérifier le champ « module » / « exports » dans package.json.)

  - Les modèles ONNX et fichiers WASM sont en général chargés depuis le même origine que le module ;
    en cas d’échec, consulter la doc npm de @imgly/background-removal (option publicPath / assets).

3) Réglages déjà prévus dans l’UI
----------------------------------
  - Suppression de fond : choix du modèle (small / medium / large) et plume (adoucissement du canal alpha).
  - Remplissage contenu : extension du masque, intensité du mélange original ↔ inpainting, transparence.

Licences : respecter les licences d’OpenCV, d’imgly et des modèles fournis avec background-removal.

4) Encodeurs du mode animation (vendor/anim/, copie locale — aucun chargement réseau)
--------------------------------------------------------------------------------------
  - gifenc (MIT, Matt DesLauriers) — encodeur GIF animé (palette + LZW).
        dist/gifenc.js (CommonJS) enveloppé pour exposer window.gifenc.
        https://github.com/mattdesl/gifenc
  - mp4-muxer (MIT, Vanilla) — multiplexeur MP4 (H.264) pour WebCodecs VideoEncoder.
        build/mp4-muxer.js (UMD, global Mp4Muxer). https://github.com/Vanilagy/mp4-muxer
  - webm-muxer (MIT, Vanilla) — multiplexeur WebM (VP9). build/webm-muxer.js (UMD,
        global WebMMuxer). https://github.com/Vanilagy/webm-muxer

Ces trois fichiers sont embarqués localement sous vendor/anim/ et chargés en <script>
classique (aucune dépendance réseau). Le rendu GIF utilise gifenc ; MP4/WebM utilisent
l'API navigateur WebCodecs (VideoEncoder) + le muxeur correspondant, avec repli
MediaRecorder (WebM) si WebCodecs est indisponible.
