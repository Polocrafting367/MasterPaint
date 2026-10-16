#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HTCL — interface graphique de l'agent.

Tout se règle ici : les projets (une zone d'écran chacun), leurs règles (mots à
détecter, expressions régulières, seuils de luminosité), l'adresse du serveur,
et la surveillance elle-même, qui tourne dans un fil séparé pour que la fenêtre
reste réactive.

    ./htcl-gui.py [-c chemin/config.json]
"""

from __future__ import annotations

import argparse
import copy
import queue
import sys
import threading
import time
import tkinter as tk
import webbrowser
from pathlib import Path
from tkinter import filedialog, messagebox, ttk

sys.path.insert(0, str(Path(__file__).resolve().parent))
import htcl_core as core  # noqa: E402

PAD = {"padx": 6, "pady": 4}


# --------------------------------------------------------------- petits outils


def labeled(parent, text: str, widget, row: int, col: int = 0, **grid):
    ttk.Label(parent, text=text).grid(row=row, column=col, sticky="w", **PAD)
    widget.grid(row=row, column=col + 1, sticky=grid.pop("sticky", "w"), **PAD, **grid)
    return widget


class RuleDialog(tk.Toplevel):
    """Création / modification d'une règle."""

    def __init__(self, parent, rule: dict | None, measure):
        super().__init__(parent)
        self.title("Règle" if rule else "Nouvelle règle")
        self.transient(parent)
        self.resizable(False, False)
        self.result = None
        self.measure = measure          # callable() -> float | None, luminosité actuelle

        rule = rule or {"name": "", "mode": "contains", "match": [], "operator": ">", "value": 50}
        self.v_name = tk.StringVar(value=rule.get("name", ""))
        self.v_mode = tk.StringVar(value=rule.get("mode", "contains"))
        self.v_op = tk.StringVar(value=rule.get("operator", ">"))
        self.v_val = tk.DoubleVar(value=float(rule.get("value", 50)))
        self.v_icase = tk.BooleanVar(value=bool(rule.get("ignore_case", True)))

        body = ttk.Frame(self)
        body.pack(fill="both", expand=True, padx=8, pady=8)

        labeled(body, "Nom", ttk.Entry(body, textvariable=self.v_name, width=34), 0, sticky="ew")

        modes = [("contains", "un mot est présent"), ("exact", "une ligne vaut exactement"),
                 ("regex", "expression régulière"), ("any", "n'importe quel texte"),
                 ("luminosite", "luminosité de la zone")]
        self.mode_labels = {m: f"{m} — {d}" for m, d in modes}
        self.combo = combo = ttk.Combobox(body, state="readonly", width=32,
                                          values=[self.mode_labels[m] for m, _ in modes])
        combo.set(self.mode_labels.get(self.v_mode.get(), self.mode_labels["contains"]))
        combo.bind("<<ComboboxSelected>>", lambda e: self._mode_changed(combo.get().split(" — ")[0]))
        labeled(body, "Type", combo, 1, sticky="ew")

        # --- zone qui change selon le type -------------------------------
        self.box = ttk.LabelFrame(body, text="Critère")
        self.box.grid(row=2, column=0, columnspan=2, sticky="nsew", **PAD)

        self.text = tk.Text(self.box, width=40, height=5, wrap="word")
        self.text.insert("1.0", "\n".join(rule.get("match", []) if isinstance(rule.get("match"), list)
                                          else [str(rule.get("match", ""))]))
        self.hint = ttk.Label(self.box, text="", foreground="#777", wraplength=330, justify="left")
        self.chk_icase = ttk.Checkbutton(self.box, text="ignorer accents et majuscules",
                                         variable=self.v_icase)

        self.lum = ttk.Frame(self.box)
        ttk.Label(self.lum, text="Condition").grid(row=0, column=0, sticky="w", **PAD)
        self.op_combo = ttk.Combobox(self.lum, state="readonly", width=26, values=[
            "> — plus clair que le seuil", "< — plus sombre que le seuil",
            "variation — changement brusque"])
        self.op_combo.set({">": "> — plus clair que le seuil",
                           "<": "< — plus sombre que le seuil",
                           "variation": "variation — changement brusque"}[self.v_op.get()])
        self.op_combo.grid(row=0, column=1, sticky="w", **PAD)
        ttk.Label(self.lum, text="Seuil (%)").grid(row=1, column=0, sticky="w", **PAD)
        ttk.Spinbox(self.lum, from_=0, to=100, increment=1, width=8,
                    textvariable=self.v_val).grid(row=1, column=1, sticky="w", **PAD)
        self.lum_now = ttk.Label(self.lum, text="", foreground="#777")
        self.lum_now.grid(row=2, column=1, sticky="w", **PAD)
        ttk.Button(self.lum, text="Mesurer la zone",
                   command=self._measure).grid(row=2, column=0, sticky="w", **PAD)

        btns = ttk.Frame(body)
        btns.grid(row=3, column=0, columnspan=2, sticky="e", pady=(8, 0))
        ttk.Button(btns, text="Annuler", command=self.destroy).pack(side="right", padx=4)
        ttk.Button(btns, text="Valider", command=self._ok).pack(side="right")

        body.columnconfigure(1, weight=1)
        self._mode_changed(self.v_mode.get())
        self.bind("<Return>", lambda e: self._ok())
        self.bind("<Escape>", lambda e: self.destroy())
        self.grab_set()
        self.wait_window(self)

    def _mode_changed(self, mode: str) -> None:
        self.v_mode.set(mode)
        if self.combo.get().split(" — ")[0] != mode:      # appel par programme
            self.combo.set(self.mode_labels[mode])
        for w in (self.text, self.hint, self.chk_icase, self.lum):
            w.pack_forget()
        if mode == "luminosite":
            self.lum.pack(fill="x")
            return
        if mode == "any":
            self.hint.configure(text="Déclenche dès que la zone contient du texte. "
                                     "Utile pour chronométrer l'apparition d'un message "
                                     "quel qu'il soit.")
            self.hint.pack(fill="x", padx=6, pady=6)
            return
        hints = {
            "contains": "Un mot (ou une ligne) par ligne ci-dessous : la règle se déclenche "
                        "si l'un d'eux apparaît dans la zone.",
            "exact": "Une ligne lue doit valoir exactement l'un de ces textes.",
            "regex": "Une expression régulière Python par ligne. Exemple : \\b\\d{6}\\b "
                     "pour un code à six chiffres.",
        }
        self.hint.configure(text=hints[mode])
        self.hint.pack(fill="x", padx=6, pady=(6, 0))
        self.text.pack(fill="both", expand=True, padx=6, pady=6)
        if mode != "regex":
            self.chk_icase.pack(anchor="w", padx=6, pady=(0, 6))

    def _measure(self) -> None:
        self.lum_now.configure(text="mesure…")
        self.update_idletasks()
        val = self.measure()
        self.lum_now.configure(text=f"actuellement : {val:.1f} %" if val is not None
                                    else "mesure impossible")

    def _ok(self) -> None:
        name = self.v_name.get().strip()
        if not name:
            messagebox.showwarning("Nom manquant", "Donnez un nom à la règle.", parent=self)
            return
        mode = self.v_mode.get()
        rule = {"name": name, "mode": mode}
        if mode == "luminosite":
            rule["operator"] = self.op_combo.get().split(" — ")[0]
            rule["value"] = round(self.v_val.get(), 2)
        elif mode != "any":
            crit = [l.strip() for l in self.text.get("1.0", "end").splitlines() if l.strip()]
            if not crit:
                messagebox.showwarning("Critère vide", "Saisissez au moins un critère.", parent=self)
                return
            rule["match"] = crit
            rule["ignore_case"] = bool(self.v_icase.get())
        try:
            core.Rule(rule)          # validation (expression régulière, etc.)
        except core.ConfigError as e:
            messagebox.showerror("Règle invalide", str(e), parent=self)
            return
        self.result = rule
        self.destroy()


# ------------------------------------------------------------------ application


class App(tk.Tk):
    def __init__(self, config_path: Path):
        super().__init__()
        self.title("HTCL — surveillance d'écran")
        self.geometry("1000x680")
        self.minsize(860, 600)

        self.path = config_path
        try:
            self.cfg = core.load_config(config_path)
        except core.ConfigError:
            self.cfg = core.default_config()
            self.cfg["projects"][0]["name"] = "Principal"

        self.current = 0            # index du projet affiché
        self.loading = False        # garde : les traces ne doivent pas écrire pendant un chargement
        self.watcher = None
        self.thread = None
        self.preview_image = None
        self.logq: queue.Queue[str] = queue.Queue()
        core.LOG_SINK = self.logq.put

        self._build()
        self._fill_projects()
        self._select_project(0)
        self.after(120, self._pump)
        self.protocol("WM_DELETE_WINDOW", self._quit)

    # ---------------------------------------------------------------- interface

    def _build(self) -> None:
        bar = ttk.Frame(self)
        bar.pack(fill="x", **PAD)
        ttk.Label(bar, text="HTCL", font=("TkDefaultFont", 13, "bold")).pack(side="left", padx=(4, 10))
        self.lbl_path = ttk.Label(bar, text=str(self.path), foreground="#777")
        self.lbl_path.pack(side="left")
        self.btn_run = ttk.Button(bar, text="▶  Démarrer", command=self._toggle_run)
        self.btn_run.pack(side="right", padx=4)
        ttk.Button(bar, text="Enregistrer", command=self._save).pack(side="right", padx=4)
        ttk.Button(bar, text="Page web", command=self._open_web).pack(side="right", padx=4)

        self.nb = nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True, padx=6, pady=(0, 4))
        self.tab_projects = ttk.Frame(nb)
        self.tab_conn = ttk.Frame(nb)
        self.tab_log = ttk.Frame(nb)
        nb.add(self.tab_projects, text="  Projets  ")
        nb.add(self.tab_conn, text="  Connexion  ")
        nb.add(self.tab_log, text="  Journal  ")

        self._build_projects(self.tab_projects)
        self._build_conn(self.tab_conn)
        self._build_log(self.tab_log)

        self.status = ttk.Label(self, text="", foreground="#777", anchor="w")
        self.status.pack(fill="x", padx=10, pady=(0, 6))
        self._refresh_status()

    # -- onglet Projets ------------------------------------------------------

    def _build_projects(self, root) -> None:
        panes = ttk.PanedWindow(root, orient="horizontal")
        panes.pack(fill="both", expand=True, padx=4, pady=4)

        left = ttk.Frame(panes)
        panes.add(left, weight=1)
        self.tree_proj = ttk.Treeview(left, columns=("zone", "rules"), show="tree headings", height=12)
        self.tree_proj.heading("#0", text="Projet")
        self.tree_proj.heading("zone", text="Zone")
        self.tree_proj.heading("rules", text="Règles")
        self.tree_proj.column("#0", width=150)
        self.tree_proj.column("zone", width=120, anchor="center")
        self.tree_proj.column("rules", width=55, anchor="center")
        self.tree_proj.pack(fill="both", expand=True)
        self.tree_proj.bind("<<TreeviewSelect>>", self._on_project_select)

        btns = ttk.Frame(left)
        btns.pack(fill="x", pady=4)
        ttk.Button(btns, text="+", width=3, command=self._add_project).pack(side="left")
        ttk.Button(btns, text="−", width=3, command=self._del_project).pack(side="left", padx=3)
        ttk.Button(btns, text="Dupliquer", command=self._dup_project).pack(side="left")

        right = ttk.Frame(panes)
        panes.add(right, weight=3)
        sub = ttk.Notebook(right)
        sub.pack(fill="both", expand=True)
        page_main = ttk.Frame(sub)
        page_ocr = ttk.Frame(sub)
        sub.add(page_main, text=" Zone et règles ")
        sub.add(page_ocr, text=" Réglages fins ")

        # --- identité + zone
        self.v_pname = tk.StringVar()
        self.v_penabled = tk.BooleanVar(value=True)
        self.v_interval = tk.DoubleVar(value=1.0)
        self.v_zone = {k: tk.IntVar() for k in "xywh"}

        top = ttk.Frame(page_main)
        top.pack(fill="x")
        labeled(top, "Nom du projet", ttk.Entry(top, textvariable=self.v_pname, width=28), 0, sticky="ew")
        ttk.Checkbutton(top, text="actif", variable=self.v_penabled).grid(row=0, column=2, **PAD)
        labeled(top, "Cadence (s)", ttk.Spinbox(top, from_=0.2, to=60, increment=0.2, width=7,
                                                textvariable=self.v_interval), 1)
        top.columnconfigure(1, weight=1)

        zone = ttk.LabelFrame(page_main, text="Zone surveillée")
        zone.pack(fill="x", pady=6)
        coords = ttk.Frame(zone)
        coords.pack(fill="x")
        for i, (key, lbl) in enumerate((("x", "X"), ("y", "Y"), ("w", "Largeur"), ("h", "Hauteur"))):
            ttk.Label(coords, text=lbl).grid(row=0, column=i * 2, sticky="e", **PAD)
            ttk.Spinbox(coords, from_=0, to=20000, width=7,
                        textvariable=self.v_zone[key]).grid(row=0, column=i * 2 + 1, sticky="w", **PAD)
        acts = ttk.Frame(zone)
        acts.pack(fill="x")
        ttk.Button(acts, text="Définir à la souris", command=self._pick_zone).pack(side="left", **PAD)
        ttk.Button(acts, text="Aperçu", command=self._preview).pack(side="left", **PAD)
        ttk.Button(acts, text="Tester la zone", command=self._test_zone).pack(side="left", **PAD)
        self.lbl_preview = ttk.Label(zone, text="(aucun aperçu)", foreground="#777", anchor="center")
        self.lbl_preview.pack(fill="x", pady=4)

        # --- règles
        rules = ttk.LabelFrame(page_main, text="Règles")
        rules.pack(fill="both", expand=True)
        self.tree_rules = ttk.Treeview(rules, columns=("mode", "crit"), show="tree headings", height=6)
        self.tree_rules.heading("#0", text="Nom")
        self.tree_rules.heading("mode", text="Type")
        self.tree_rules.heading("crit", text="Critère")
        self.tree_rules.column("#0", width=150)
        self.tree_rules.column("mode", width=90)
        self.tree_rules.column("crit", width=280)
        self.tree_rules.pack(fill="both", expand=True, padx=4, pady=4)
        self.tree_rules.bind("<Double-1>", lambda e: self._edit_rule())
        rb = ttk.Frame(rules)
        rb.pack(fill="x", pady=(0, 4))
        ttk.Button(rb, text="Ajouter", command=self._add_rule).pack(side="left", padx=4)
        ttk.Button(rb, text="Modifier", command=self._edit_rule).pack(side="left")
        ttk.Button(rb, text="Supprimer", command=self._del_rule).pack(side="left", padx=4)

        # --- réglages fins
        self.v_ocr = {
            "lang": tk.StringVar(value="fra+eng"),
            "psm": tk.IntVar(value=6),
            "scale": tk.IntVar(value=300),
            "threshold": tk.IntVar(value=0),
            "min_chars": tk.IntVar(value=2),
            "grayscale": tk.BooleanVar(value=True),
            "normalize": tk.BooleanVar(value=True),
            "invert": tk.BooleanVar(value=False),
        }
        self.v_deb = {"appear": tk.IntVar(value=1), "disappear": tk.IntVar(value=2)}
        self.v_mindur = tk.IntVar(value=0)

        g = ttk.LabelFrame(page_ocr, text="Reconnaissance de texte")
        g.pack(fill="x", pady=4)
        langs = core.ocr_languages()
        lang_widget = (ttk.Combobox(g, textvariable=self.v_ocr["lang"], width=16,
                                    values=langs + ["fra+eng"]) if langs
                       else ttk.Entry(g, textvariable=self.v_ocr["lang"], width=16))
        labeled(g, "Langue", lang_widget, 0)
        labeled(g, "Découpage (psm)", ttk.Spinbox(g, from_=3, to=13, width=6,
                                                  textvariable=self.v_ocr["psm"]), 1)
        labeled(g, "Agrandissement (%)", ttk.Spinbox(g, from_=100, to=800, increment=50, width=6,
                                                     textvariable=self.v_ocr["scale"]), 2)
        labeled(g, "Seuil noir/blanc (%)", ttk.Spinbox(g, from_=0, to=99, width=6,
                                                       textvariable=self.v_ocr["threshold"]), 3)
        labeled(g, "Caractères minimum", ttk.Spinbox(g, from_=1, to=50, width=6,
                                                     textvariable=self.v_ocr["min_chars"]), 4)
        ttk.Checkbutton(g, text="niveaux de gris", variable=self.v_ocr["grayscale"]).grid(
            row=0, column=2, sticky="w", **PAD)
        ttk.Checkbutton(g, text="contraste auto", variable=self.v_ocr["normalize"]).grid(
            row=1, column=2, sticky="w", **PAD)
        ttk.Checkbutton(g, text="inverser (texte clair sur fond sombre)",
                        variable=self.v_ocr["invert"]).grid(row=2, column=2, sticky="w", **PAD)

        d = ttk.LabelFrame(page_ocr, text="Anti-clignotement")
        d.pack(fill="x", pady=4)
        labeled(d, "Captures avant ouverture", ttk.Spinbox(d, from_=1, to=20, width=6,
                                                           textvariable=self.v_deb["appear"]), 0)
        labeled(d, "Captures avant fermeture", ttk.Spinbox(d, from_=1, to=20, width=6,
                                                           textvariable=self.v_deb["disappear"]), 1)
        labeled(d, "Durée minimale (ms)", ttk.Spinbox(d, from_=0, to=600000, increment=100, width=8,
                                                      textvariable=self.v_mindur), 2)
        ttk.Label(d, foreground="#777", wraplength=520, justify="left",
                  text="L'OCR se trompe parfois sur une image isolée. Ces compteurs exigent "
                       "plusieurs captures d'accord entre elles avant d'ouvrir ou de fermer un "
                       "événement. La fin retenue reste la dernière capture où la règle était "
                       "vraie : la durée n'est pas faussée.").grid(
            row=3, column=0, columnspan=2, sticky="w", **PAD)

        for var in [self.v_pname, self.v_penabled, self.v_interval, self.v_mindur,
                    *self.v_zone.values(), *self.v_ocr.values(), *self.v_deb.values()]:
            var.trace_add("write", self._commit_form)

    # -- onglet Connexion ----------------------------------------------------

    def _build_conn(self, root) -> None:
        self.v_endpoint = tk.StringVar(value=self.cfg["endpoint"])
        self.v_token = tk.StringVar(value=self.cfg["token"])
        self.v_source = tk.StringVar(value=self.cfg["source"])
        self.v_insecure = tk.BooleanVar(value=bool(self.cfg.get("insecure_tls")))
        self.v_display = tk.StringVar(value=self.cfg.get("display", ""))

        f = ttk.LabelFrame(root, text="Serveur HTCL")
        f.pack(fill="x", padx=8, pady=8)
        labeled(f, "Adresse de l'API", ttk.Entry(f, textvariable=self.v_endpoint, width=52), 0, sticky="ew")
        labeled(f, "Token", ttk.Entry(f, textvariable=self.v_token, width=52), 1, sticky="ew")
        labeled(f, "Nom de cette machine", ttk.Entry(f, textvariable=self.v_source, width=24), 2)
        labeled(f, "Écran X (vide = $DISPLAY)", ttk.Entry(f, textvariable=self.v_display, width=10), 3)
        ttk.Checkbutton(f, text="accepter un certificat HTTPS non vérifié",
                        variable=self.v_insecure).grid(row=4, column=1, sticky="w", **PAD)
        ttk.Button(f, text="Tester la connexion", command=self._test_conn).grid(
            row=5, column=1, sticky="w", **PAD)
        self.lbl_conn = ttk.Label(f, text="", foreground="#777")
        self.lbl_conn.grid(row=6, column=0, columnspan=2, sticky="w", **PAD)
        f.columnconfigure(1, weight=1)

        ttk.Label(root, foreground="#777", wraplength=700, justify="left",
                  text="Le token est celui du fichier HTCL/lib/config.php sur le serveur. "
                       "La configuration est enregistrée en lecture seule pour vous "
                       "(chmod 600) : elle contient ce token.").pack(anchor="w", padx=12)

        dep = ttk.LabelFrame(root, text="Dépendances")
        dep.pack(fill="x", padx=8, pady=8)
        self.lbl_deps = ttk.Label(dep, justify="left", font=("TkFixedFont", 9))
        self.lbl_deps.pack(anchor="w", padx=8, pady=6)
        ttk.Button(dep, text="Revérifier", command=self._refresh_deps).pack(anchor="w", padx=8, pady=(0, 6))
        self._refresh_deps()

        for v in (self.v_endpoint, self.v_token, self.v_source, self.v_insecure, self.v_display):
            v.trace_add("write", self._commit_conn)

    # -- onglet Journal ------------------------------------------------------

    def _build_log(self, root) -> None:
        top = ttk.LabelFrame(root, text="Affichages en cours")
        top.pack(fill="x", padx=8, pady=8)
        self.tree_live = ttk.Treeview(top, columns=("projet", "regle", "texte", "duree"),
                                      show="headings", height=5)
        for col, lbl, w in (("projet", "Projet", 130), ("regle", "Règle", 130),
                            ("texte", "Texte", 320), ("duree", "Durée", 80)):
            self.tree_live.heading(col, text=lbl)
            self.tree_live.column(col, width=w, anchor="w" if col != "duree" else "e")
        self.tree_live.pack(fill="x", padx=4, pady=4)

        box = ttk.LabelFrame(root, text="Journal")
        box.pack(fill="both", expand=True, padx=8, pady=(0, 8))
        self.txt_log = tk.Text(box, height=12, wrap="word", state="disabled",
                               font=("TkFixedFont", 9))
        scroll = ttk.Scrollbar(box, command=self.txt_log.yview)
        self.txt_log.configure(yscrollcommand=scroll.set)
        scroll.pack(side="right", fill="y")
        self.txt_log.pack(fill="both", expand=True, padx=4, pady=4)
        ttk.Button(box, text="Effacer", command=self._clear_log).pack(anchor="w", padx=6, pady=(0, 6))

    # ------------------------------------------------------------ liaison données

    def project(self) -> dict:
        return self.cfg["projects"][self.current]

    def _fill_projects(self) -> None:
        self.tree_proj.delete(*self.tree_proj.get_children())
        for i, p in enumerate(self.cfg["projects"]):
            self.tree_proj.insert("", "end", iid=str(i),
                                  text=("● " if p.get("enabled", True) else "○ ") + p["name"],
                                  values=(core.zone_str(p["zone"]), len(p.get("rules", []))))

    def _select_project(self, index: int) -> None:
        if not self.cfg["projects"]:
            return
        self.current = max(0, min(index, len(self.cfg["projects"]) - 1))
        self.tree_proj.selection_set(str(self.current))
        self._load_form()

    def _on_project_select(self, _evt) -> None:
        sel = self.tree_proj.selection()
        if sel and int(sel[0]) != self.current:
            self.current = int(sel[0])
            self._load_form()

    def _load_form(self) -> None:
        self.loading = True
        p = self.project()
        self.v_pname.set(p["name"])
        self.v_penabled.set(bool(p.get("enabled", True)))
        self.v_interval.set(float(p.get("interval", 1.0)))
        for k in "xywh":
            self.v_zone[k].set(int(p["zone"][k]))
        ocr = core.deep_merge(dict(core.DEFAULT_OCR), p.get("ocr") or {})
        for k, var in self.v_ocr.items():
            var.set(ocr[k])
        deb = p.get("debounce") or {}
        self.v_deb["appear"].set(int(deb.get("appear", 1)))
        self.v_deb["disappear"].set(int(deb.get("disappear", 2)))
        self.v_mindur.set(int(p.get("min_duration_ms", 0)))
        self.loading = False
        self._fill_rules()
        self.lbl_preview.configure(image="", text="(aucun aperçu)")
        self.preview_image = None

    def _commit_form(self, *_args) -> None:
        """Recopie les champs dans le projet courant, à chaque frappe."""
        if self.loading or not self.cfg["projects"]:
            return
        p = self.project()
        try:
            p["name"] = self.v_pname.get().strip() or p["name"]
            p["enabled"] = bool(self.v_penabled.get())
            p["interval"] = max(0.2, float(self.v_interval.get()))
            p["zone"] = {k: int(self.v_zone[k].get()) for k in "xywh"}
            p["ocr"] = {k: var.get() for k, var in self.v_ocr.items()}
            p["debounce"] = {k: int(v.get()) for k, v in self.v_deb.items()}
            p["min_duration_ms"] = int(self.v_mindur.get())
        except (tk.TclError, ValueError):
            return          # champ en cours de saisie (vide, « - », etc.)
        iid = str(self.current)
        if self.tree_proj.exists(iid):
            self.tree_proj.item(iid, text=("● " if p["enabled"] else "○ ") + p["name"],
                                values=(core.zone_str(p["zone"]), len(p.get("rules", []))))

    def _commit_conn(self, *_args) -> None:
        self.cfg["endpoint"] = self.v_endpoint.get().strip()
        self.cfg["token"] = self.v_token.get().strip()
        self.cfg["source"] = self.v_source.get().strip() or self.cfg["source"]
        self.cfg["insecure_tls"] = bool(self.v_insecure.get())
        self.cfg["display"] = self.v_display.get().strip()

    def _fill_rules(self) -> None:
        self.tree_rules.delete(*self.tree_rules.get_children())
        for i, spec in enumerate(self.project().get("rules", [])):
            try:
                r = core.Rule(spec, i)
                self.tree_rules.insert("", "end", iid=str(i), text=r.name,
                                       values=(r.mode, r.criterion()))
            except core.ConfigError as e:
                self.tree_rules.insert("", "end", iid=str(i),
                                       text=spec.get("name", "?"), values=("invalide", str(e)))

    # ------------------------------------------------------------------ projets

    def _add_project(self) -> None:
        p = copy.deepcopy(core.DEFAULT_PROJECT)
        p["name"] = f"Projet {len(self.cfg['projects']) + 1}"
        self.cfg["projects"].append(p)
        self._fill_projects()
        self._select_project(len(self.cfg["projects"]) - 1)

    def _dup_project(self) -> None:
        p = copy.deepcopy(self.project())
        p["name"] += " (copie)"
        self.cfg["projects"].insert(self.current + 1, p)
        self._fill_projects()
        self._select_project(self.current + 1)

    def _del_project(self) -> None:
        if len(self.cfg["projects"]) <= 1:
            messagebox.showinfo("Impossible", "Il faut au moins un projet.", parent=self)
            return
        if not messagebox.askyesno("Supprimer", f"Supprimer « {self.project()['name']} » ?", parent=self):
            return
        del self.cfg["projects"][self.current]
        self._fill_projects()
        self._select_project(max(0, self.current - 1))

    # -------------------------------------------------------------------- règles

    def _add_rule(self) -> None:
        dlg = RuleDialog(self, None, self._measure_brightness)
        if dlg.result:
            self.project().setdefault("rules", []).append(dlg.result)
            self._fill_rules()
            self._commit_form()

    def _edit_rule(self) -> None:
        sel = self.tree_rules.selection()
        if not sel:
            return
        i = int(sel[0])
        dlg = RuleDialog(self, self.project()["rules"][i], self._measure_brightness)
        if dlg.result:
            self.project()["rules"][i] = dlg.result
            self._fill_rules()

    def _del_rule(self) -> None:
        sel = self.tree_rules.selection()
        if not sel:
            return
        del self.project()["rules"][int(sel[0])]
        self._fill_rules()
        self._commit_form()

    # --------------------------------------------------------------------- zone

    def _pick_zone(self) -> None:
        self.withdraw()
        self.update()
        time.sleep(0.25)            # laisser le gestionnaire de fenêtres retirer la fenêtre
        try:
            zone = core.select_zone(self)
        except core.ConfigError as e:
            zone = None
            messagebox.showerror("Sélection impossible", str(e), parent=self)
        finally:
            self.deiconify()
        if zone:
            self.loading = True
            for k in "xywh":
                self.v_zone[k].set(zone[k])
            self.loading = False
            self._commit_form()
            self._preview()

    def _capture(self) -> bytes | None:
        self._commit_form()
        try:
            return core.grab(self.project()["zone"], self.cfg)
        except (core.ConfigError, RuntimeError) as e:
            messagebox.showerror("Capture impossible", str(e), parent=self)
            return None

    def _preview(self) -> None:
        png = self._capture()
        if not png:
            return
        small, _ = core.png_preview(png, 460)
        try:
            self.preview_image = tk.PhotoImage(data=core.b64(small))
            self.lbl_preview.configure(image=self.preview_image, text="")
        except tk.TclError:
            self.lbl_preview.configure(image="", text="(aperçu impossible : Tk sans support PNG)")

    def _measure_brightness(self) -> float | None:
        try:
            return core.brightness(core.grab(self.project()["zone"], self.cfg))
        except (core.ConfigError, RuntimeError):
            return None

    def _test_zone(self) -> None:
        self._commit_form()
        try:
            project = core.Project(self.project())
        except core.ConfigError as e:
            messagebox.showerror("Projet invalide", str(e), parent=self)
            return
        if not project.rules:
            messagebox.showinfo("Aucune règle", "Ajoutez au moins une règle à tester.", parent=self)
            return

        win = tk.Toplevel(self)
        win.title(f"Test — {project.name}")
        win.geometry("620x460")
        txt = tk.Text(win, wrap="word", font=("TkFixedFont", 9))
        txt.pack(fill="both", expand=True, padx=8, pady=8)
        txt.insert("end", "Capture en cours…\n")
        txt.configure(state="disabled")

        def work():
            try:
                sample = project.sample(self.cfg)
                lines = [f"Zone {project.zone_label()}\n"]
                if project.needs_brightness:
                    lines.append(f"Luminosité : {sample['brightness']:.1f} %\n")
                if project.needs_text:
                    lines.append("Texte reconnu :\n" +
                                 (sample["text"].strip() or "(rien)") + "\n")
                lines.append("\nRègles :\n")
                for rule in project.rules:
                    hit, label = rule.evaluate(sample)
                    lines.append(f"  {'✔ DÉCLENCHÉE' if hit else '· au repos   '}  {rule.name}"
                                 + (f"  →  {label}" if hit else "") + "\n")
                out = "".join(lines)
            except Exception as e:  # noqa: BLE001 — tout souci doit s'afficher
                out = f"Échec : {e}\n"
            self.logq.put(("__test__", win, txt, out))

        threading.Thread(target=work, daemon=True).start()

    # --------------------------------------------------------------- connexion

    def _test_conn(self) -> None:
        self._commit_conn()
        self.lbl_conn.configure(text="test en cours…")

        def work():
            try:
                res = core.Sender(self.cfg, quiet=True).ping()
                msg = f"✔ serveur joignable, authentifié comme « {res.get('as')} »"
            except Exception as e:  # noqa: BLE001
                code = getattr(e, "code", None)
                msg = "✘ token refusé par le serveur" if code in (401, 403) else f"✘ {e}"
            self.logq.put(("__conn__", msg))

        threading.Thread(target=work, daemon=True).start()

    def _refresh_deps(self) -> None:
        lines = []
        for prog, paquet, found in core.dependencies():
            lines.append(f"{'✔' if found else '✘'} {prog:<10} "
                         f"{found or f'manquant → sudo apt install {paquet}'}")
        langs = core.ocr_languages()
        lines.append(f"  langues OCR : {', '.join(langs) or '— (installez tesseract-ocr-fra)'}")
        self.lbl_deps.configure(text="\n".join(lines))

    def _open_web(self) -> None:
        url = self.cfg["endpoint"].split("?")[0].rsplit("/", 1)[0] + "/"
        webbrowser.open(url)

    # -------------------------------------------------------------- surveillance

    def _toggle_run(self) -> None:
        if self.watcher and self.thread and self.thread.is_alive():
            self._log_line("arrêt demandé…")
            self.watcher.stop = True
            self.btn_run.configure(text="…", state="disabled")
            return

        self._commit_form()
        self._commit_conn()
        if not self.cfg["token"]:
            messagebox.showwarning("Token manquant",
                                   "Renseignez le token dans l'onglet Connexion.", parent=self)
            return
        if not self._save():
            return
        try:
            cfg = core.normalize_config(copy.deepcopy(self.cfg))
            self.watcher = core.Watcher(cfg, quiet=True, on_event=lambda e: None)
        except core.ConfigError as e:
            messagebox.showerror("Impossible de démarrer", str(e), parent=self)
            return
        self.thread = threading.Thread(target=self.watcher.run, daemon=True)
        self.thread.start()
        self.btn_run.configure(text="■  Arrêter")
        self.nb.select(self.tab_log)        # on veut voir ce qui se passe

    def _refresh_live(self) -> None:
        self.tree_live.delete(*self.tree_live.get_children())
        if not self.watcher:
            return
        now = time.time()
        for project, rule in self.watcher.open_events():
            self.tree_live.insert("", "end", values=(
                project.name, rule.name, rule.label[:120],
                core.fmt_duration((now - rule.started_at) * 1000)))

    def _refresh_status(self) -> None:
        bits = []
        running = bool(self.thread and self.thread.is_alive())
        bits.append("surveillance active" if running else "à l'arrêt")
        if self.watcher:
            s = self.watcher.sender
            bits.append(f"{s.sent} événement(s) envoyé(s)")
            if s.pending:
                bits.append(f"{len(s.pending)} en attente")
            if s.offline:
                bits.append("serveur injoignable")
        missing = [prog for prog, _, found in core.dependencies() if not found]
        if missing:
            bits.append("manquant : " + ", ".join(missing))
        self.status.configure(text="  ·  ".join(bits))

    # ------------------------------------------------------------------ journal

    def _log_line(self, line: str) -> None:
        self.txt_log.configure(state="normal")
        self.txt_log.insert("end", line + "\n")
        if float(self.txt_log.index("end-1c").split(".")[0]) > 1000:
            self.txt_log.delete("1.0", "200.0")
        self.txt_log.see("end")
        self.txt_log.configure(state="disabled")

    def _clear_log(self) -> None:
        self.txt_log.configure(state="normal")
        self.txt_log.delete("1.0", "end")
        self.txt_log.configure(state="disabled")

    def _pump(self) -> None:
        """Vide la file des messages venus des fils de travail."""
        try:
            while True:
                item = self.logq.get_nowait()
                if isinstance(item, tuple) and item and item[0] == "__test__":
                    _, win, txt, out = item
                    if win.winfo_exists():
                        txt.configure(state="normal")
                        txt.delete("1.0", "end")
                        txt.insert("end", out)
                        txt.configure(state="disabled")
                elif isinstance(item, tuple) and item and item[0] == "__conn__":
                    self.lbl_conn.configure(text=item[1])
                else:
                    self._log_line(str(item))
        except queue.Empty:
            pass

        if self.thread and not self.thread.is_alive() and self.btn_run["text"] != "▶  Démarrer":
            self.btn_run.configure(text="▶  Démarrer", state="normal")
            self.watcher = None
        self._refresh_live()
        self._refresh_status()
        self.after(500, self._pump)

    # ---------------------------------------------------------------- fichier

    def _save(self) -> bool:
        self._commit_form()
        self._commit_conn()
        try:
            cfg = core.normalize_config(copy.deepcopy(self.cfg))
            core.save_config(self.path, cfg)
            self.cfg = cfg
        except (core.ConfigError, OSError) as e:
            messagebox.showerror("Enregistrement impossible", str(e), parent=self)
            return False
        self._fill_projects()
        self.tree_proj.selection_set(str(self.current))
        self._log_line(f"configuration enregistrée : {self.path}")
        return True

    def _quit(self) -> None:
        if self.thread and self.thread.is_alive():
            if not messagebox.askyesno("Quitter", "La surveillance tourne. L'arrêter et quitter ?",
                                       parent=self):
                return
            self.watcher.stop = True
            self.thread.join(timeout=5)
        core.LOG_SINK = None
        self.destroy()


def main() -> int:
    ap = argparse.ArgumentParser(description="Interface graphique de l'agent HTCL.")
    ap.add_argument("-c", "--config", help="chemin du fichier de configuration")
    args = ap.parse_args()
    App(core.find_config(args.config)).mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
