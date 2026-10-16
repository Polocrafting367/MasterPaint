# HTCL — Historique des Textes Captés à L'écran

Un agent Linux surveille **une ou plusieurs zones de l'écran**. Pour chaque
zone, il lit le texte affiché (OCR) ou mesure la luminosité, et chronomètre
**combien de temps** chaque chose surveillée reste à l'écran. Chaque apparition
devient un événement envoyé à ce dossier, consultable sur une page web protégée
par identifiant et mot de passe — page pensée pour le téléphone.

```
   écran                  agent (interface ou console)        serveur
   ┌──────────┐           ┌───────────────────────┐           ┌──────────────┐
   │ zone A   │──capture─▶│ projet « Blender »    │──HTTP────▶│ api.php      │
   │ zone B   │──capture─▶│ projet « Terminal »   │  (token)  │ events.jsonl │
   └──────────┘           └───────────────────────┘           └──────┬───────┘
                                                                     ▼
                                                        index.php (connexion + page)
```

## 1. Démarrer en une commande

```bash
cd HTCL/agent
./htcl.sh
```

C'est tout. Au premier lancement, le script :

1. vérifie les paquets nécessaires (et propose `./htcl.sh deps` pour les poser) ;
2. crée `~/.config/htcl/config.json` — si le serveur HTCL est sur cette machine,
   **l'adresse et le token sont repris automatiquement** de `lib/config.php` ;
3. ouvre l'interface graphique.

Pour l'avoir dans le menu des applications : `./htcl.sh install`.

| commande | effet |
|---|---|
| `./htcl.sh` | interface graphique (cas normal) |
| `./htcl.sh run` | surveillance en console, sans fenêtre |
| `./htcl.sh check` | dépendances, configuration, serveur |
| `./htcl.sh deps` | installe les paquets manquants |
| `./htcl.sh install` | ajoute HTCL au menu des applications |
| `./htcl.sh config` | ouvre le fichier de configuration |

Dépendances : `imagemagick`, `python3-tk`, et `tesseract-ocr` + `tesseract-ocr-fra`
si des règles lisent du texte. Python : bibliothèque standard uniquement.
Fonctionne sous **X11** (sous Wayland, ouvrir une session « Ubuntu sur Xorg »).

## 2. Projets, règles, événements

**Un projet** = une zone de l'écran, sa cadence et ses règles. Plusieurs projets
tournent en parallèle : un par logiciel surveillé, chacun à son rythme. Le nom du
projet accompagne chaque événement et sert de filtre sur la page web.

**Une règle** = ce qu'on guette dans la zone :

| type | déclenche quand |
|---|---|
| `contains` | un des mots apparaît (accents et majuscules ignorés) |
| `exact` | une ligne lue vaut exactement le texte |
| `regex` | l'expression régulière trouve quelque chose (`\b\d{6}\b`) |
| `any` | n'importe quel texte est présent |
| `luminosite` | la zone passe au-dessus/en dessous d'un seuil, ou change brusquement |

Les règles de luminosité **n'utilisent pas l'OCR** : elles fonctionnent sans
tesseract, coûtent presque rien, et repèrent ce que le texte ne dit pas — une
fenêtre qui s'allume, un écran qui bascule, une alerte qui clignote.

**Un événement** naît quand une règle devient vraie et se ferme quand elle
redevient fausse ; sa durée est le temps passé à l'écran. Un événement ouvert
est visible en direct sur la page web, avec son chronomètre qui tourne.

### Anti-clignotement

L'OCR se trompe parfois sur une image isolée. `Captures avant ouverture` et
`Captures avant fermeture` (onglet *Réglages fins*) exigent plusieurs captures
d'accord entre elles. La fin retenue reste **la dernière capture où la règle
était vraie**, pas l'instant où l'agent s'en aperçoit : la durée n'est jamais
gonflée. `Durée minimale` jette les apparitions trop brèves.

### Coupure réseau

Les événements non transmis sont empilés dans `~/.cache/htcl/spool.jsonl` et
rejoués au retour du réseau, y compris après un redémarrage. Chaque événement
porte un identifiant unique : un renvoi met à jour la ligne existante au lieu
d'en créer une deuxième.

## 3. L'interface graphique

- **Projets** — la liste à gauche, l'éditeur à droite. *Définir à la souris*
  trace la zone sur un voile plein écran ; *Aperçu* montre ce que l'agent voit ;
  *Tester la zone* affiche le texte reconnu, la luminosité mesurée et les règles
  qui se déclenchent. C'est l'outil de réglage : si la reconnaissance est
  mauvaise, augmenter `Agrandissement`, essayer `Seuil noir/blanc` vers 50, ou
  cocher `inverser` pour du texte clair sur fond sombre.
- **Connexion** — adresse de l'API, token, nom de la machine, état des
  dépendances, test de connexion.
- **Journal** — les affichages en cours et le déroulé en direct.

La surveillance tourne dans un fil séparé : la fenêtre reste utilisable, et on
peut modifier un autre projet pendant que ça tourne (les changements prennent
effet au redémarrage de la surveillance).

## 4. Le serveur (ce dossier)

PHP 7.4+ sans extension particulière. **Aucune base de données.**

| fichier | rôle |
|---|---|
| `index.php` | connexion puis tableau de bord |
| `api.php` | `ingest`, `list`, `stats`, `export`, `purge`, `ping` |
| `lib/config.php` | **identifiant, mot de passe, token** — à modifier |
| `lib/store.php` | lecture/écriture du journal |
| `lib/auth.php` | session web et token de l'agent |
| `assets/` | CSS et JS de la page |
| `data/events.jsonl` | les événements, interdits d'accès web |

### Le stockage, en clair

`data/events.jsonl` : **un objet JSON par ligne, en UTF-8**. Lisible dans un
éditeur, réparable à la main, copiable par FTP.

```json
{"uid":"a1b2","source":"pc-bureau","project":"Rendu Blender","rule":"Erreur",
 "label":"error: linker failed","zone":"520x150+60+80",
 "started_at":1790196736.376,"ended_at":1790196738.57,"duration_ms":2194,"meta":{}}
```

L'écriture se fait **toujours en ajout en fin de fichier**, sous verrou : c'est
l'opération la plus rapide et la plus sûre, rien ne peut être corrompu par deux
écritures simultanées. Un événement s'écrit deux fois — à son apparition, puis à
sa disparition — et les lignes de même `uid` sont fusionnées à la lecture, la
plus récente l'emportant. Le fichier est donc un journal, pas un état.

Quand il dépasse 2 Mio, il est réécrit fusionné et élagué (rétention, plafond de
20 000 événements) de façon atomique. Ce qui en sort part dans
`data/archive-AAAA-MM.jsonl` : rien n'est perdu. En pratique, 600 événements
= 250 Ko, relus et agrégés en 3 ms.

### Réglages

```php
'user'  => 'polo',          // identifiant de la page web
'pass'  => 'masterpaint',   // mot de passe  ← à changer
'token' => 'f48419cf…',     // clé de l'agent
'retention_days' => 90,     // 0 = ne jamais purger
```

### Mise en ligne

Copier le dossier `HTCL/` à la racine du site : il répond sur
`https://polocrafting.fr/HTCL/`. Une exception a été ajoutée dans le
`.htaccess` du dossier parent pour que cette adresse ne soit pas redirigée vers
masterpaint.fr. Le dossier `data/` doit être accessible en écriture à PHP :

```bash
chmod 777 HTCL/data          # en local, XAMPP tourne sous l'utilisateur « daemon »
```

## 5. La page web

Conçue pour le téléphone d'abord : filtres repliés, une carte par événement,
cibles tactiles, rafraîchissement suspendu quand l'onglet passe en arrière-plan
(8 s sur mobile, 4 s sur ordinateur), 60 lignes chargées au lieu de 200. Sur
grand écran, la même page se déplie en tableau. L'aspect reprend celui de
l'agent : cadres à titre incrusté, boutons et listes natifs.

- quatre chiffres : événements, temps d'affichage cumulé, en cours, durée moyenne ;
- les affichages en cours, chronomètre qui tourne ;
- le temps cumulé par projet et par règle (un appui filtre dessus), les
  événements par heure ;
- l'historique filtrable par projet, source, règle, période et texte ;
- export CSV (point-virgule, UTF-8, s'ouvre dans Excel ou LibreOffice) ;
- bouton **Vider** : supprime ce que les filtres désignent, ou tout.

## 6. Sécurité — ce qui est assumé

- Le mot de passe est **en clair** dans `lib/config.php`. Quiconque a un accès
  FTP/SSH au site le lit. C'est un choix, pas un oubli.
- `lib/` et `data/` sont fermés par `.htaccess`. Si le serveur ignorait les
  `.htaccess`, le journal deviendrait téléchargeable : vérifier que
  `https://polocrafting.fr/HTCL/data/events.jsonl` renvoie bien un refus.
- Le token voyage dans un en-tête HTTP : **utiliser HTTPS** (le `.htaccess` y
  force déjà). La configuration de l'agent est écrite en `chmod 600`.
- L'agent lit l'écran : ne surveiller que les zones utiles, et pas une zone où
  passent des mots de passe.

## 7. Dépannage

| symptôme | cause probable |
|---|---|
| `tesseract introuvable` | `./htcl.sh deps`, ou n'utiliser que des règles de luminosité |
| `Failed loading language 'fra'` | paquet `tesseract-ocr-fra` absent |
| `aucun écran X` | agent lancé hors session graphique → `export DISPLAY=:0` |
| capture noire ou décalée | session Wayland, ou zone hors écran (refaire *Définir à la souris*) |
| `REFUS du serveur (401)` | token de la config ≠ token de `lib/config.php` |
| aucun événement sur la page | `data/` non accessible en écriture à PHP |
| texte reconnu illisible | *Réglages fins* : agrandissement ↑, seuil ≈ 50, inverser |
| `projet désactivé` au démarrage | une dépendance manque pour ce projet — voir le Journal |
