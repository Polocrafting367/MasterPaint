#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTCL — agent de surveillance d'écran, en ligne de commande.

  htcl-agent.py gui                 ouvre l'interface graphique
  htcl-agent.py init                crée un fichier de configuration
  htcl-agent.py projects            liste les projets configurés
  htcl-agent.py select              trace une zone à la souris
  htcl-agent.py check               vérifie dépendances, config et serveur
  htcl-agent.py test                une capture par projet : texte, luminosité, règles
  htcl-agent.py run                 boucle de surveillance

La logique est dans htcl_core.py, partagé avec l'interface graphique.
"""

from __future__ import annotations

import argparse
import signal
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import htcl_core as core  # noqa: E402


def die(msg: str, code: int = 1):
    print(f"erreur : {msg}", file=sys.stderr)
    sys.exit(code)


def get_config(args) -> tuple[Path, dict]:
    path = core.find_config(args.config)
    try:
        return path, core.load_config(path)
    except core.ConfigError as e:
        die(f"{e}\n       créez-la avec :  {sys.argv[0]} init --config {path}")


def pick_projects(cfg: dict, wanted: list[str] | None) -> dict:
    """Restreint la configuration aux projets demandés (par nom, casse ignorée)."""
    if not wanted:
        return cfg
    names = {w.lower() for w in wanted}
    found = {p["name"].lower() for p in cfg["projects"]} & names
    if not found:
        die("aucun projet ne porte ce nom : " + ", ".join(wanted))
    for p in cfg["projects"]:
        p["enabled"] = p["name"].lower() in names
    return cfg


# ----------------------------------------------------------------- commandes


def cmd_gui(args) -> int:
    import subprocess
    gui = Path(__file__).resolve().parent / "htcl-gui.py"
    return subprocess.call([sys.executable, str(gui)] + (["-c", args.config] if args.config else []))


def cmd_init(args) -> int:
    path = core.find_config(args.config)
    if path.is_file() and not args.force:
        die(f"{path} existe déjà (utilisez --force pour l'écraser)")
    cfg = core.default_config()
    if args.endpoint:
        cfg["endpoint"] = args.endpoint
    if args.token:
        cfg["token"] = args.token
    cfg["projects"][0]["name"] = args.project or "Principal"
    if args.zone:
        cfg["projects"][0]["zone"] = core.parse_zone(args.zone)
    cfg["projects"][0]["rules"] = [
        {"name": "Erreur", "mode": "contains", "match": ["erreur", "error"]},
    ]
    core.save_config(path, cfg)
    print(f"configuration écrite : {path}")
    print("Complétez « token » (celui de HTCL/lib/config.php), puis :")
    print(f"  {sys.argv[0]} -c {path} gui")
    return 0


def cmd_projects(args) -> int:
    path, cfg = get_config(args)
    print(f"{path}\n")
    for p in cfg["projects"]:
        rules = p.get("rules") or []
        state = "actif  " if p.get("enabled", True) else "inactif"
        print(f"  [{state}] {p['name']}")
        print(f"            zone {core.zone_str(p['zone'])} · toutes les {p['interval']:g} s "
              f"· {len(rules)} règle(s)")
        for r in rules:
            try:
                rule = core.Rule(r)
                print(f"              · {rule.name} — {rule.mode} : {rule.criterion()}")
            except core.ConfigError as e:
                print(f"              · INVALIDE : {e}")
    return 0


def cmd_select(args) -> int:
    try:
        zone = core.select_zone()
    except core.ConfigError as e:
        die(str(e))
    if not zone:
        print("sélection annulée")
        return 1
    print(f"zone : {core.zone_str(zone)}   (x={zone['x']} y={zone['y']} "
          f"largeur={zone['w']} hauteur={zone['h']})")
    if args.save:
        path, cfg = get_config(args)
        target = args.project or cfg["projects"][0]["name"]
        for p in cfg["projects"]:
            if p["name"].lower() == target.lower():
                p["zone"] = zone
                core.save_config(path, cfg)
                print(f"enregistrée dans le projet « {p['name']} » ({path})")
                return 0
        die(f"projet « {target} » introuvable")
    return 0


def cmd_check(args) -> int:
    ok = True
    print(f"agent HTCL {core.VERSION}\n")
    for prog, paquet, found in core.dependencies():
        print(f"  {'✔' if found else '✘'} {prog:<10} {found or f'MANQUANT → sudo apt install {paquet}'}")
        ok &= bool(found)
    langs = core.ocr_languages()
    print(f"  · langues OCR : {', '.join(langs) or '—'}")

    import os
    disp = os.environ.get("DISPLAY")
    print(f"  {'✔' if disp else '✘'} DISPLAY    {disp or 'absent (à lancer dans la session graphique)'}")
    ok &= bool(disp)

    path = core.find_config(args.config)
    print(f"\n  configuration : {path}{'' if path.is_file() else '  (absente)'}")
    if not path.is_file():
        return 1
    try:
        cfg = core.load_config(path)
    except core.ConfigError as e:
        print(f"  ✘ {e}")
        return 1

    for p in cfg["projects"]:
        rules = p.get("rules") or []
        print(f"  · projet « {p['name']} » : {core.zone_str(p['zone'])}, "
              f"{len(rules)} règle(s){'' if p.get('enabled', True) else ', inactif'}")
    print(f"  serveur       : {cfg['endpoint']}")

    if not cfg["token"]:
        print("  ✘ token vide — recopiez celui de HTCL/lib/config.php")
        return 1
    try:
        res = core.Sender(cfg, quiet=True).ping()
        print(f"  ✔ serveur joignable, authentifié comme « {res.get('as')} »")
    except Exception as e:  # noqa: BLE001 — afficher n'importe quel souci réseau
        code = getattr(e, "code", None)
        print(f"  ✘ serveur : {'token refusé' if code in (401, 403) else e}")
        ok = False
    return 0 if ok else 1


def cmd_test(args) -> int:
    path, cfg = get_config(args)
    cfg = pick_projects(cfg, args.project)
    for spec in cfg["projects"]:
        if not spec.get("enabled", True):
            continue
        try:
            project = core.Project(spec)
        except core.ConfigError as e:
            print(f"projet « {spec['name']} » : {e}")
            continue

        print(f"\n=== {project.name} — zone {project.zone_label()} ===")
        try:
            sample = project.sample(cfg)
        except (core.ConfigError, RuntimeError) as e:
            print(f"  capture impossible : {e}")
            continue

        if args.save:
            Path(args.save).write_bytes(core.preprocess(sample["png"], project.ocr))
            print(f"  image OCR enregistrée : {args.save}")
        if project.needs_brightness:
            print(f"  luminosité : {sample['brightness']:.1f} %")
        if project.needs_text:
            print("  texte reconnu :")
            print("    " + ("\n    ".join(sample["text"].strip().splitlines()) or "(rien)"))
        for rule in project.rules:
            hit, label = rule.evaluate(sample)
            print(f"  {'✔ DÉCLENCHÉE' if hit else '· au repos   '}  {rule.name}"
                  + (f"   → {label[:70]!r}" if hit else ""))
    return 0


def cmd_run(args) -> int:
    path, cfg = get_config(args)
    cfg = pick_projects(cfg, args.project)
    if not cfg["token"]:
        die("token vide dans la configuration (voir HTCL/lib/config.php)")
    if args.source:
        cfg["source"] = args.source

    try:
        watcher = core.Watcher(cfg, quiet=args.quiet)
    except core.ConfigError as e:
        die(str(e))

    def handler(signum, _frame):
        watcher.stop = True
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    if args.once:
        for project in watcher.active:
            watcher.step_project(project)
        watcher.close_all("exécution unique")
        return 0

    core.log("Ctrl+C pour arrêter (les événements en cours seront clôturés)", quiet=args.quiet)
    watcher.run()
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(
        prog="htcl-agent",
        description="Surveille des zones de l'écran (texte reconnu ou luminosité) "
                    "et journalise les durées d'affichage sur HTCL.",
        epilog="Exemple :  htcl-agent.py gui")
    ap.add_argument("-c", "--config", help="chemin du fichier de configuration")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p = sub.add_parser("gui", help="ouvre l'interface graphique")
    p.set_defaults(func=cmd_gui)

    p = sub.add_parser("init", help="crée un fichier de configuration")
    p.add_argument("--endpoint"); p.add_argument("--token")
    p.add_argument("--zone"); p.add_argument("--project")
    p.add_argument("--force", action="store_true")
    p.set_defaults(func=cmd_init)

    p = sub.add_parser("projects", help="liste les projets configurés")
    p.set_defaults(func=cmd_projects)

    p = sub.add_parser("select", help="trace une zone à la souris")
    p.add_argument("--save", action="store_true", help="enregistre la zone dans le projet")
    p.add_argument("--project", help="projet visé (défaut : le premier)")
    p.set_defaults(func=cmd_select)

    p = sub.add_parser("check", help="vérifie dépendances, configuration et serveur")
    p.set_defaults(func=cmd_check)

    p = sub.add_parser("test", help="une capture par projet : texte, luminosité, règles")
    p.add_argument("--project", action="append", help="limiter à ce projet (répétable)")
    p.add_argument("--save", help="enregistre l'image envoyée à l'OCR")
    p.set_defaults(func=cmd_test)

    p = sub.add_parser("run", help="boucle de surveillance")
    p.add_argument("--project", action="append", help="limiter à ce projet (répétable)")
    p.add_argument("--source"); p.add_argument("--once", action="store_true")
    p.add_argument("-q", "--quiet", action="store_true")
    p.set_defaults(func=cmd_run)

    args = ap.parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
