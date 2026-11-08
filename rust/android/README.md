<!-- MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md. -->
# MasterPaint Android natif

L'APK contient `libmasterpaint_ui.so`, les ressources Slint et le moteur Rust. Il dessine directement dans une surface Android avec OpenGL ES ; aucune WebView n'est utilisée. Le projet Java ne sert qu'aux sélecteurs de documents et au presse-papiers du système.

## Construction

- Cible Rust `aarch64-linux-android`.
- JDK 17, SDK Android 34, Build Tools 34.0.0, NDK 27.2.12479018.
- `ANDROID_HOME`, `ANDROID_NDK_ROOT`, `JAVA_HOME` peuvent remplacer les chemins locaux utilisés par `build-ui-android.sh`.
- `MP_ANDROID_SIGNING_CONFIG` désigne un fichier local contenant `keystore.file`, `keystore.password` et éventuellement `keystore.alias`. Aucune clé n'est copiée dans le dépôt ou l'APK.
- `rust/build-ui-android.sh` produit `downloads/MasterPaint-android-native.apk`.
- `rust/build-all.sh apk` le copie aussi sous le nom public `MasterPaint-android.apk`.
- `rust/build-all.sh webapk` conserve l'ancienne enveloppe dans `MasterPaint-android-webview.apk`.

Android 8.0+ et un appareil ARM64 avec OpenGL ES 3 sont nécessaires. L'identifiant `fr.masterpaint.nativeapp` permet de tester cette version à côté de l'ancienne enveloppe. Les projets stockés dans le navigateur ne sont pas migrés automatiquement : importer les fichiers `.illu` avec le sélecteur système.

## Entrées et performances

La petite correction du backend Slint (copie de compilation hors dépôt, produite par `tools/patch-android-input.py`) transmet la pression et le type d'outil avant chaque callback, et ignore les contacts reconnus comme paume. La gomme matérielle est distinguée. Les variations de pression modulent la largeur du pinceau avec une transition continue. Le pincement à deux doigts annule le trait commencé par le premier doigt, puis zoome la toile.

Sur le web, les points coalescés, la pression et la gomme utilisent Pointer Events ; les contacts tactiles pendant un trait de stylet sont ignorés. Sur le bureau, la pression utilise les données `Touch.force` fournies par Winit : leur disponibilité dépend du système et du pilote. L'inclinaison et la rotation du stylet ne pilotent pas encore les pointes.

Le dessin conserve tous les points, mais regroupe la composition et les transferts de textures. Les effets déjà pris en charge utilisent le GPU. Le repli CPU web peut répartir les grands ajustements indépendants en bandes sur plusieurs workers, sans modifier les effets spatiaux.

La compilation et les tests logiciels ne remplacent pas un essai physique de pression, de latence et de rejet de paume sur les appareils cibles.
