# -*- coding: utf-8 -*-
"""
HTCL — moteur de surveillance (partagé par la ligne de commande et l'interface).

Vocabulaire
-----------
**Projet**  : un logiciel à surveiller = une zone de l'écran, ses réglages OCR
              et ses règles. Plusieurs projets tournent en parallèle, chacun à
              son propre rythme.
**Règle**   : ce qu'on guette dans la zone — un mot, une expression régulière,
              n'importe quel texte, ou un niveau de luminosité.
**Événement**: une occurrence pendant laquelle une règle est restée vraie.
              Ouvert à l'apparition, fermé à la disparition, avec sa durée.

Rien d'autre que la bibliothèque standard. Outils externes : `import` et
`convert` (imagemagick) pour l'écran, `tesseract` pour l'OCR — ce dernier
uniquement si au moins une règle lit du texte.
"""

from __future__ import annotations

import base64
import hashlib
import json
import os
import re
import ssl
import subprocess
import threading
import time
import unicodedata
import urllib.error
import urllib.request
import uuid
from pathlib import Path
from shutil import which

VERSION = "2.0"

CONFIG_PATHS = [
    Path.home() / ".config" / "htcl" / "config.json",
    Path.cwd() / "htcl.json",
]

MODES = ("contains", "exact", "regex", "any", "luminosite")
OPERATORS = (">", "<", "variation")

DEFAULT_OCR = {
    "lang": "fra+eng",
    "psm": 6,            # 6 = bloc de texte uniforme
    "scale": 300,        # agrandissement en %, aide beaucoup l'OCR
    "grayscale": True,
    "normalize": True,
    "invert": False,     # texte clair sur fond sombre
    "threshold": 0,      # 0 = désactivé, sinon 1-99 (%)
    "min_chars": 2,
}

DEFAULT_PROJECT = {
    "name": "Projet",
    "enabled": True,
    "zone": {"x": 0, "y": 0, "w": 600, "h": 200},
    "interval": 1.0,
    "ocr": dict(DEFAULT_OCR),
    "debounce": {"appear": 1, "disappear": 2},
    "min_duration_ms": 0,
    "rules": [],
}

DEFAULTS = {
    "endpoint": "https://polocrafting.fr/HTCL/api.php",
    "token": "",
    "source": os.uname().nodename,
    "display": "",          # vide = $DISPLAY
    "spool": "",            # vide = ~/.cache/htcl/spool.jsonl
    "insecure_tls": False,
    "projects": [dict(DEFAULT_PROJECT)],
}


# --------------------------------------------------------------- journalisation

_log_lock = threading.Lock()
LOG_SINK = None      # callable(str) — l'interface s'y branche pour afficher le journal


def log(msg: str, *, quiet: bool = False) -> None:
    line = f"{time.strftime('%H:%M:%S')}  {msg}"
    with _log_lock:
        if LOG_SINK is not None:
            try:
                LOG_SINK(line)
            except Exception:       # l'affichage ne doit jamais casser la surveillance
                pass
        elif not quiet:
            print(line, flush=True)


class ConfigError(Exception):
    """Configuration inexploitable — message destiné à l'utilisateur."""


# ------------------------------------------------------------------ utilitaires


def deep_merge(base: dict, over: dict) -> dict:
    out = dict(base)
    for k, v in over.items():
        out[k] = deep_merge(out[k], v) if isinstance(v, dict) and isinstance(out.get(k), dict) else v
    return out


def normalize_text(s: str) -> str:
    """Minuscules, sans accents, espaces compactés : l'OCR n'est pas fiable dessus."""
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return re.sub(r"\s+", " ", s.lower()).strip()


def parse_zone(text: str) -> dict:
    """Accepte « 400x120+100+50 » (géométrie X) ou « 100,50,400,120 »."""
    m = re.fullmatch(r"\s*(\d+)x(\d+)\+(-?\d+)\+(-?\d+)\s*", text)
    if m:
        w, h, x, y = (int(g) for g in m.groups())
        return {"x": x, "y": y, "w": w, "h": h}
    m = re.fullmatch(r"\s*(-?\d+)\s*,\s*(-?\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*", text)
    if m:
        x, y, w, h = (int(g) for g in m.groups())
        return {"x": x, "y": y, "w": w, "h": h}
    raise ConfigError(f"zone illisible : {text!r} (attendu « LxH+X+Y » ou « X,Y,L,H »)")


def zone_str(z: dict) -> str:
    return f"{int(z['w'])}x{int(z['h'])}+{int(z['x'])}+{int(z['y'])}"


def fmt_duration(ms: float) -> str:
    s = ms / 1000
    if s < 10:
        return f"{s:.1f} s".replace(".", ",")
    if s < 60:
        return f"{s:.0f} s"
    if s < 3600:
        return f"{int(s // 60)} min {int(s % 60):02d} s"
    return f"{int(s // 3600)} h {int((s % 3600) // 60):02d}"


# ----------------------------------------------------------------- configuration


def default_config() -> dict:
    return json.loads(json.dumps(DEFAULTS))


def find_config(explicit: str | None = None) -> Path:
    if explicit:
        return Path(explicit).expanduser()
    for p in CONFIG_PATHS:
        if p.is_file():
            return p
    return CONFIG_PATHS[0]


def normalize_config(raw: dict) -> dict:
    """Complète les valeurs manquantes et accepte l'ancien format à zone unique."""
    cfg = deep_merge(default_config(), raw)

    # Ancien format : zone / ocr / rules à la racine → un projet unique.
    if "projects" not in raw and ("rules" in raw or "zone" in raw):
        cfg["projects"] = [{
            "name": raw.get("name", "Principal"),
            "enabled": True,
            "zone": raw.get("zone", DEFAULT_PROJECT["zone"]),
            "interval": raw.get("interval", 1.0),
            "ocr": raw.get("ocr", dict(DEFAULT_OCR)),
            "debounce": raw.get("debounce", dict(DEFAULT_PROJECT["debounce"])),
            "min_duration_ms": raw.get("min_duration_ms", 0),
            "rules": raw.get("rules", []),
        }]
    for key in ("zone", "ocr", "rules", "debounce", "interval", "min_duration_ms"):
        cfg.pop(key, None)

    projects = cfg.get("projects") or [dict(DEFAULT_PROJECT)]
    seen: set[str] = set()
    out = []
    for i, p in enumerate(projects):
        p = deep_merge(json.loads(json.dumps(DEFAULT_PROJECT)), p if isinstance(p, dict) else {})
        name = str(p.get("name") or f"Projet {i + 1}").strip()[:64]
        while name.lower() in seen:            # deux projets homonymes seraient indistinguables
            name += " (2)"
        seen.add(name.lower())
        p["name"] = name
        if isinstance(p["zone"], str):
            p["zone"] = parse_zone(p["zone"])
        p["interval"] = max(0.2, float(p.get("interval", 1.0)))
        out.append(p)
    cfg["projects"] = out

    if not cfg.get("spool"):
        cfg["spool"] = str(Path.home() / ".cache" / "htcl" / "spool.jsonl")
    return cfg


def load_config(path: Path) -> dict:
    if not path.is_file():
        raise ConfigError(f"configuration absente : {path}")
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise ConfigError(f"{path} : JSON invalide ligne {e.lineno} ({e.msg})") from e
    if not isinstance(raw, dict):
        raise ConfigError(f"{path} : un objet JSON est attendu")
    return normalize_config(raw)


def save_config(path: Path, cfg: dict) -> None:
    path = Path(path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(path)
    try:
        os.chmod(path, 0o600)       # le token est dedans
    except OSError:
        pass


# --------------------------------------------------------------------- captures


def env_with_display(cfg: dict) -> dict:
    env = dict(os.environ)
    disp = cfg.get("display") or env.get("DISPLAY")
    if not disp:
        raise ConfigError("aucun écran X : renseignez « display » (ex. « :0 ») ou exportez DISPLAY")
    env["DISPLAY"] = disp
    return env


def grab(zone: dict, cfg: dict) -> bytes:
    """Capture brute de la zone, en PNG."""
    cmd = ["import", "-silent", "-window", "root", "-crop", zone_str(zone), "+repage", "png:-"]
    try:
        p = subprocess.run(cmd, capture_output=True, env=env_with_display(cfg), timeout=15)
    except FileNotFoundError:
        raise ConfigError("« import » introuvable — sudo apt install imagemagick") from None
    except subprocess.TimeoutExpired:
        raise RuntimeError("capture trop lente (X ne répond pas)") from None
    if p.returncode != 0 or not p.stdout:
        raise RuntimeError("capture impossible : " + p.stderr.decode(errors="replace").strip()[:200])
    return p.stdout


def preprocess(png: bytes, ocr_cfg: dict) -> bytes:
    """Nettoyage avant OCR : niveaux de gris, agrandissement, contraste."""
    args = ["convert", "png:-"]
    if ocr_cfg.get("grayscale", True):
        args += ["-colorspace", "Gray"]
    scale = int(ocr_cfg.get("scale", 0) or 0)
    if scale and scale != 100:
        args += ["-filter", "Lanczos", "-resize", f"{scale}%"]
    if ocr_cfg.get("normalize", True):
        args += ["-normalize"]
    if ocr_cfg.get("invert"):
        args += ["-negate"]
    th = int(ocr_cfg.get("threshold", 0) or 0)
    if 0 < th < 100:
        args += ["-threshold", f"{th}%"]
    args += ["-sharpen", "0x1", "png:-"]
    try:
        p = subprocess.run(args, input=png, capture_output=True, timeout=20)
    except FileNotFoundError:
        raise ConfigError("« convert » introuvable — sudo apt install imagemagick") from None
    return p.stdout if p.returncode == 0 and p.stdout else png


def brightness(png: bytes) -> float:
    """Luminosité moyenne de la zone, de 0 (noir) à 100 (blanc)."""
    try:
        p = subprocess.run(["convert", "png:-", "-colorspace", "Gray",
                            "-format", "%[fx:mean*100]", "info:"],
                           input=png, capture_output=True, timeout=15)
    except FileNotFoundError:
        raise ConfigError("« convert » introuvable — sudo apt install imagemagick") from None
    try:
        return round(float(p.stdout.decode(errors="replace").strip()), 2)
    except ValueError:
        raise RuntimeError("luminosité illisible : " + p.stderr.decode(errors="replace")[:120]) from None


def ocr(png: bytes, ocr_cfg: dict) -> str:
    cmd = ["tesseract", "stdin", "stdout", "--psm", str(ocr_cfg.get("psm", 6))]
    if ocr_cfg.get("lang"):
        cmd += ["-l", ocr_cfg["lang"]]
    try:
        p = subprocess.run(cmd, input=png, capture_output=True, timeout=30)
    except FileNotFoundError:
        raise ConfigError("« tesseract » introuvable — sudo apt install tesseract-ocr "
                          "tesseract-ocr-fra") from None
    except subprocess.TimeoutExpired:
        raise RuntimeError("OCR trop lent") from None
    if p.returncode != 0:
        err = p.stderr.decode(errors="replace").strip()
        if "Failed loading language" in err:
            raise ConfigError("langue OCR absente — sudo apt install tesseract-ocr-fra")
        raise RuntimeError("OCR en échec : " + err[:200])
    return p.stdout.decode("utf-8", errors="replace")


def ocr_languages() -> list[str]:
    if not which("tesseract"):
        return []
    p = subprocess.run(["tesseract", "--list-langs"], capture_output=True)
    return [l.strip() for l in p.stdout.decode(errors="replace").splitlines()[1:] if l.strip()]


def png_preview(png: bytes, max_side: int = 520) -> tuple[bytes, int]:
    """PNG redimensionné pour l'aperçu. Renvoie (données, facteur de réduction)."""
    p = subprocess.run(["convert", "png:-", "-resize", f"{max_side}x{max_side}>", "png:-"],
                       input=png, capture_output=True, timeout=15)
    return (p.stdout if p.returncode == 0 and p.stdout else png), 1


def b64(png: bytes) -> str:
    return base64.b64encode(png).decode("ascii")


# ------------------------------------------------------------------------ règles


class Rule:
    """Une règle et l'état de l'événement qu'elle est en train de produire."""

    def __init__(self, spec: dict, index: int = 0):
        self.name = str(spec.get("name") or f"règle-{index + 1}").strip()[:64]
        self.mode = str(spec.get("mode", "contains")).lower()
        if self.mode not in MODES:
            raise ConfigError(f"règle « {self.name} » : mode inconnu {self.mode!r} "
                              f"({', '.join(MODES)})")

        raw = spec.get("match", [])
        self.needles = [raw] if isinstance(raw, str) else [str(x) for x in raw]
        self.ignore_case = bool(spec.get("ignore_case", True))
        self.operator = str(spec.get("operator", ">"))
        self.value = float(spec.get("value", 50))

        if self.mode in ("contains", "exact", "regex") and not [n for n in self.needles if n.strip()]:
            raise ConfigError(f"règle « {self.name} » : le critère est vide")
        if self.mode == "luminosite" and self.operator not in OPERATORS:
            raise ConfigError(f"règle « {self.name} » : opérateur inconnu {self.operator!r}")

        self.regexes = []
        if self.mode == "regex":
            flags = re.IGNORECASE if self.ignore_case else 0
            for n in self.needles:
                try:
                    self.regexes.append(re.compile(n, flags))
                except re.error as e:
                    raise ConfigError(f"règle « {self.name} » : expression régulière invalide ({e})") from e

        self.norm_needles = [normalize_text(n) for n in self.needles]
        self.reset()

    # -- état ---------------------------------------------------------------

    def reset(self) -> None:
        self.hits = 0
        self.misses = 0
        self.open_uid = None
        self.started_at = 0.0
        self.last_seen = 0.0
        self.label = ""
        self.pending_since = 0.0

    @property
    def needs_text(self) -> bool:
        return self.mode != "luminosite"

    @property
    def needs_brightness(self) -> bool:
        return self.mode == "luminosite"

    def criterion(self) -> str:
        """Résumé lisible du critère, pour l'interface."""
        if self.mode == "any":
            return "n'importe quel texte"
        if self.mode == "luminosite":
            if self.operator == "variation":
                return f"variation ≥ {self.value:g} points"
            return f"luminosité {self.operator} {self.value:g} %"
        return " / ".join(self.needles)

    # -- évaluation ----------------------------------------------------------

    def evaluate(self, sample: dict) -> tuple[bool, str]:
        """(déclenchée ?, extrait à archiver)"""
        if self.mode == "luminosite":
            return self._evaluate_brightness(sample)
        return self._evaluate_text(sample.get("text") or "", int(sample.get("min_chars", 1)))

    def _evaluate_brightness(self, sample: dict) -> tuple[bool, str]:
        cur = sample.get("brightness")
        if cur is None:
            return False, ""
        if self.operator == ">":
            return (cur > self.value), f"luminosité {cur:.0f} %"
        if self.operator == "<":
            return (cur < self.value), f"luminosité {cur:.0f} %"
        prev = sample.get("prev_brightness")
        if prev is None:
            return False, ""       # pas de précédent : aucune variation mesurable
        delta = cur - prev
        if abs(delta) >= self.value:
            return True, f"luminosité {prev:.0f} % → {cur:.0f} % ({delta:+.0f})"
        return False, ""

    def _evaluate_text(self, text: str, min_chars: int) -> tuple[bool, str]:
        lines = [l.strip() for l in text.splitlines() if l.strip()]
        joined = " ".join(lines)

        if self.mode == "any":
            return (len(joined) >= min_chars), joined[:500]

        if self.mode == "regex":
            for rx in self.regexes:
                m = rx.search(joined)
                if m:
                    return True, (m.group(0) or joined)[:500]
            return False, ""

        norm_lines = [normalize_text(l) for l in lines]
        for needle in self.norm_needles:
            if not needle:
                continue
            for i, nl in enumerate(norm_lines):
                hit = (nl == needle) if self.mode == "exact" else (needle in nl)
                if hit:
                    return True, lines[i][:500]
            if self.mode == "contains" and needle in normalize_text(joined):
                return True, joined[:500]      # le mot était coupé sur deux lignes
        return False, ""


class Project:
    """Une zone surveillée, ses réglages et ses règles."""

    def __init__(self, spec: dict, index: int = 0):
        self.name = str(spec.get("name") or f"Projet {index + 1}").strip()[:64]
        self.enabled = bool(spec.get("enabled", True))
        self.zone = spec.get("zone") or dict(DEFAULT_PROJECT["zone"])
        if isinstance(self.zone, str):
            self.zone = parse_zone(self.zone)
        self.interval = max(0.2, float(spec.get("interval", 1.0)))
        self.ocr = deep_merge(dict(DEFAULT_OCR), spec.get("ocr") or {})
        self.debounce = deep_merge({"appear": 1, "disappear": 2}, spec.get("debounce") or {})
        self.min_duration_ms = int(spec.get("min_duration_ms", 0))
        self.rules = [Rule(r, i) for i, r in enumerate(spec.get("rules") or [])]

        self.next_run = 0.0
        self.last_hash = None
        self.last_text = ""
        self.last_brightness = None
        self.prev_brightness = None

    @property
    def needs_text(self) -> bool:
        return any(r.needs_text for r in self.rules)

    @property
    def needs_brightness(self) -> bool:
        return any(r.needs_brightness for r in self.rules)

    def zone_label(self) -> str:
        return zone_str(self.zone)

    def sample(self, cfg: dict) -> dict:
        """Capture la zone et en extrait ce dont les règles ont besoin."""
        png = grab(self.zone, cfg)
        digest = hashlib.blake2b(png, digest_size=16).digest()

        if digest == self.last_hash:
            text = self.last_text              # image identique : l'OCR redirait la même chose
            bright = self.last_brightness
        else:
            text = ocr(preprocess(png, self.ocr), self.ocr) if self.needs_text else ""
            bright = brightness(png) if self.needs_brightness else None
            self.last_hash = digest

        sample = {
            "text": text,
            "brightness": bright,
            "prev_brightness": self.prev_brightness,
            "min_chars": int(self.ocr.get("min_chars", 1)),
            "png": png,
        }
        self.prev_brightness = bright if bright is not None else self.prev_brightness
        self.last_text, self.last_brightness = text, bright
        return sample


# -------------------------------------------------------------------- transport


class Sender:
    """File d'attente persistante vers api.php. Les renvois sont sans effet de bord."""

    def __init__(self, cfg: dict, quiet: bool = False):
        self.endpoint = str(cfg["endpoint"]).strip()
        self.token = cfg["token"]
        self.source = cfg["source"]
        self.quiet = quiet
        self.spool = Path(cfg["spool"]).expanduser()
        self.spool.parent.mkdir(parents=True, exist_ok=True)
        self.ctx = ssl._create_unverified_context() if cfg.get("insecure_tls") else None
        self.lock = threading.Lock()
        self.pending: list[dict] = self._load_spool()
        self.offline = False
        self.sent = 0
        if self.pending:
            log(f"{len(self.pending)} événement(s) en attente repris du disque", quiet=quiet)

    # -- file d'attente sur disque ------------------------------------------

    def _load_spool(self) -> list[dict]:
        if not self.spool.is_file():
            return []
        out = []
        for line in self.spool.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line:
                try:
                    out.append(json.loads(line))
                except json.JSONDecodeError:
                    pass
        return out[-2000:]

    def _save_spool(self) -> None:
        try:
            if self.pending:
                self.spool.write_text(
                    "\n".join(json.dumps(e, ensure_ascii=False) for e in self.pending) + "\n",
                    encoding="utf-8")
            elif self.spool.is_file():
                self.spool.unlink()
        except OSError as e:
            log(f"file d'attente non sauvegardée : {e}", quiet=self.quiet)

    # -- réseau --------------------------------------------------------------

    def _url(self, action: str) -> str:
        sep = "&" if "?" in self.endpoint else "?"
        return f"{self.endpoint}{sep}action={action}"

    def _post(self, action: str, payload: dict, timeout: float = 10.0) -> dict:
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(self._url(action), data=data, method="POST", headers={
            "Content-Type": "application/json; charset=utf-8",
            "X-HTCL-Token": self.token,
            "User-Agent": f"htcl-agent/{VERSION}",
        })
        with urllib.request.urlopen(req, timeout=timeout, context=self.ctx) as r:
            body = r.read().decode("utf-8", errors="replace")
        try:
            return json.loads(body)
        except json.JSONDecodeError:
            raise RuntimeError("réponse non-JSON du serveur : " + body[:200]) from None

    def ping(self) -> dict:
        req = urllib.request.Request(self._url("ping"), headers={
            "X-HTCL-Token": self.token, "User-Agent": f"htcl-agent/{VERSION}"})
        with urllib.request.urlopen(req, timeout=10, context=self.ctx) as r:
            return json.loads(r.read().decode("utf-8", errors="replace"))

    def push(self, event: dict) -> None:
        with self.lock:
            self.pending.append(event)
        self.flush()

    def flush(self) -> bool:
        with self.lock:
            if not self.pending:
                return True
            batch = self.pending[:200]
        try:
            res = self._post("ingest", {"source": self.source, "events": batch})
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:200]
            if e.code in (401, 403):
                log(f"REFUS du serveur ({e.code}) — token incorrect ? {detail}", quiet=False)
                with self.lock:
                    self.pending = self.pending[len(batch):]    # inutile de boucler là-dessus
                self._save_spool()
                return False
            self._go_offline(f"HTTP {e.code} {detail}")
            return False
        except (urllib.error.URLError, OSError, RuntimeError, ssl.SSLError) as e:
            self._go_offline(str(e))
            return False

        if not res.get("ok") and res.get("errors"):
            log("le serveur a refusé : " + "; ".join(res["errors"][:3]), quiet=self.quiet)
        with self.lock:
            self.pending = self.pending[len(batch):]
            self.sent += len(batch)
            more = bool(self.pending)
        self._save_spool()
        if self.offline:
            log("serveur de nouveau joignable", quiet=self.quiet)
            self.offline = False
        return self.flush() if more else True

    def _go_offline(self, why: str) -> None:
        if not self.offline:
            log(f"serveur injoignable ({why[:120]}) — mise en file d'attente", quiet=False)
            self.offline = True
        with self.lock:
            if len(self.pending) > 2000:
                self.pending = self.pending[-2000:]
        self._save_spool()

    def close(self) -> None:
        self.flush()
        self._save_spool()


# ----------------------------------------------------------------- surveillance


class Watcher:
    """Boucle de surveillance de tous les projets actifs."""

    def __init__(self, cfg: dict, quiet: bool = False, on_event=None):
        self.cfg = cfg
        self.quiet = quiet
        self.on_event = on_event          # callback(dict) pour l'interface
        self.projects = [Project(p, i) for i, p in enumerate(cfg.get("projects", []))]
        self.active = [p for p in self.projects if p.enabled and p.rules]
        if not self.active:
            raise ConfigError("aucun projet actif : il faut au moins un projet avec une règle")
        self.sender = Sender(cfg, quiet)
        self.stop = False
        self.errors = 0

    # -- cycle de vie d'un événement ----------------------------------------

    def _emit(self, project: Project, rule: Rule, closing: bool) -> None:
        event = {
            "uid": rule.open_uid,
            "source": self.cfg["source"],
            "project": project.name,
            "rule": rule.name,
            "label": rule.label,
            "zone": project.zone_label(),
            "started_at": round(rule.started_at, 3),
            "ended_at": round(rule.last_seen, 3) if closing else None,
            "meta": {"mode": rule.mode, "agent": VERSION},
        }
        self.sender.push(event)
        if self.on_event:
            try:
                self.on_event(event)
            except Exception:
                pass

    def _open(self, project: Project, rule: Rule, when: float, label: str) -> None:
        rule.open_uid = uuid.uuid4().hex[:24]
        rule.started_at = when
        rule.last_seen = when
        rule.label = label
        self._emit(project, rule, closing=False)
        log(f"▶ [{project.name}] « {rule.name} » apparaît — {label[:60]!r}", quiet=self.quiet)

    def _close(self, project: Project, rule: Rule, reason: str = "disparu") -> None:
        if not rule.open_uid:
            return
        ms = int(round((rule.last_seen - rule.started_at) * 1000))
        if ms < project.min_duration_ms:
            log(f"✕ [{project.name}] « {rule.name} » ignoré ({ms} ms sous le seuil)", quiet=self.quiet)
        else:
            self._emit(project, rule, closing=True)
            log(f"■ [{project.name}] « {rule.name} » {reason} — affiché {fmt_duration(ms)}",
                quiet=self.quiet)
        rule.reset()

    # -- une itération -------------------------------------------------------

    def step_project(self, project: Project) -> dict:
        sample = project.sample(self.cfg)
        self.apply(project, sample, time.time())
        return sample

    def apply(self, project: Project, sample: dict, when: float) -> None:
        need_appear = max(1, int(project.debounce.get("appear", 1)))
        need_gone = max(1, int(project.debounce.get("disappear", 2)))

        for rule in project.rules:
            hit, label = rule.evaluate(sample)

            if hit:
                rule.misses = 0
                if rule.open_uid:
                    rule.last_seen = when
                    if label:
                        rule.label = label
                else:
                    if rule.hits == 0:
                        rule.pending_since = when   # la durée court dès la 1re image vue
                    rule.hits += 1
                    if rule.hits >= need_appear:
                        self._open(project, rule, rule.pending_since, label)
            else:
                rule.hits = 0
                if rule.open_uid:
                    rule.misses += 1
                    if rule.misses >= need_gone:
                        # la fin, c'est la dernière image où c'était vrai,
                        # pas l'instant où l'on s'en aperçoit.
                        self._close(project, rule)

    def open_events(self) -> list[tuple[Project, Rule]]:
        return [(p, r) for p in self.active for r in p.rules if r.open_uid]

    def close_all(self, reason: str) -> None:
        for project, rule in self.open_events():
            self._close(project, rule, reason)
        self.sender.close()

    # -- boucle --------------------------------------------------------------

    def run(self) -> None:
        names = ", ".join(f"{p.name} ({p.zone_label()}, {p.interval:g} s)" for p in self.active)
        log(f"surveillance de {len(self.active)} projet(s) : {names}", quiet=self.quiet)

        now = time.time()
        for p in self.active:
            p.next_run = now

        while not self.stop:
            now = time.time()
            due = [p for p in self.active if p.next_run <= now]
            for project in due:
                if self.stop:
                    break
                try:
                    self.step_project(project)
                    self.errors = 0
                except ConfigError as e:
                    log(f"[{project.name}] {e} — projet désactivé", quiet=False)
                    project.enabled = False
                    self.active = [p for p in self.active if p.enabled]
                    if not self.active:
                        log("plus aucun projet actif — arrêt", quiet=False)
                        self.stop = True
                except RuntimeError as e:
                    self.errors += 1
                    log(f"[{project.name}] itération ignorée : {e}", quiet=False)
                    if self.errors >= 10:
                        log("dix échecs de suite — arrêt", quiet=False)
                        self.stop = True
                project.next_run = time.time() + project.interval

            if self.sender.pending:
                self.sender.flush()

            if self.stop or not self.active:
                break
            delay = min((p.next_run for p in self.active), default=now + 0.5) - time.time()
            time.sleep(max(0.05, min(delay, 1.0)))

        log("clôture des événements en cours…", quiet=self.quiet)
        self.close_all("arrêt de l'agent")


# ------------------------------------------------- sélection de zone à la souris


def select_zone(parent=None) -> dict | None:
    """Voile plein écran : on trace la zone à la souris. Échap annule."""
    try:
        import tkinter as tk
    except ImportError:
        raise ConfigError("tkinter absent — sudo apt install python3-tk "
                          "(ou saisissez la zone à la main)") from None

    root = tk.Toplevel(parent) if parent is not None else tk.Tk()
    root.attributes("-alpha", 0.35)
    root.attributes("-topmost", True)
    root.configure(bg="black", cursor="crosshair")
    root.overrideredirect(True)
    root.geometry(f"{root.winfo_screenwidth()}x{root.winfo_screenheight()}+0+0")

    canvas = tk.Canvas(root, bg="black", highlightthickness=0)
    canvas.pack(fill="both", expand=True)
    canvas.create_text(root.winfo_screenwidth() // 2, 40,
                       text="Tracez la zone à surveiller   ·   Échap pour annuler",
                       fill="white", font=("sans", 15))

    state = {"x0": 0, "y0": 0, "rect": None, "out": None}

    def press(e):
        state["x0"], state["y0"] = e.x_root, e.y_root
        if state["rect"]:
            canvas.delete(state["rect"])
        state["rect"] = canvas.create_rectangle(e.x, e.y, e.x, e.y,
                                                outline="#3987e5", width=2, fill="white")

    def drag(e):
        if state["rect"]:
            canvas.coords(state["rect"],
                          state["x0"] - root.winfo_rootx(),
                          state["y0"] - root.winfo_rooty(), e.x, e.y)

    def release(e):
        x, y = min(state["x0"], e.x_root), min(state["y0"], e.y_root)
        w, h = abs(e.x_root - state["x0"]), abs(e.y_root - state["y0"])
        if w >= 8 and h >= 8:
            state["out"] = {"x": x, "y": y, "w": w, "h": h}
        root.destroy()

    canvas.bind("<ButtonPress-1>", press)
    canvas.bind("<B1-Motion>", drag)
    canvas.bind("<ButtonRelease-1>", release)
    root.bind("<Escape>", lambda e: root.destroy())
    root.focus_force()
    if parent is not None:
        root.grab_set()
        parent.wait_window(root)
    else:
        root.mainloop()
    return state["out"]


def dependencies() -> list[tuple[str, str, str | None]]:
    """[(programme, paquet, chemin ou None)] — pour `check` et l'interface."""
    return [(prog, pkg, which(prog)) for prog, pkg in
            (("import", "imagemagick"), ("convert", "imagemagick"), ("tesseract", "tesseract-ocr"))]
