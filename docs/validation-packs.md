# Vérification des thèmes et packs — 8 novembre 2026

- Compilation navigateur optimisée réussie (`rust/build-ui-web.sh`), WebAssembly 29 791 505 octets.
- Tests Rust des packs : 2 réussis, 0 échec. Les trois packs complets se réimportent sans changement des icônes ; un import invalide conserve le pack précédent.
- Export complet : 508 entrées (215 icônes maison, 93 symboles, 26 icônes d’outils, 174 glyphes Font Awesome).
- Packs de référence : 75 correspondances paintdotjs, 140 correspondances PhotoCraft ; les autres entrées conservent les ressources MasterPaint.
- Ordres des outils : les 21 commandes sont présentes exactement une fois dans chaque disposition de référence.
- Archive préalable vérifiée : sources, page d’accueil, ressources et anciennes applications compilées présentes. SHA-256 : `aa4fadaaf1e3e14a64d6c67f41393efb8e32880e2e12c8cd238d9133bab92d90`.
- Les versions distribuées dans `downloads/` n’ont pas été reconstruites ; cette validation porte sur le navigateur et les sources partagées.
