"""Fichiers de traduction de l'interface (gettext .po), à relancer quand des textes @tr changent.

  python3 -I tools/gen_lang.py

Relève les textes @tr("…") de ui/*.slint et les libellés lisibles de src/*.rs et met à jour lang/<langue>/LC_MESSAGES/
masterpaint-ui.po (embarqués à la compilation par build.rs) :
- fr : langue des sources, chaque texte traduit par lui-même (fichier complet) ;
- en, es, de, it, pt : textes ajoutés vides (msgstr ""), à traduire à la main. Une traduction
  déjà écrite est gardée ; un texte disparu des sources est retiré.
Un texte non traduit s'affiche en français.
"""
import os
import re
import argparse
import json
from pathlib import Path

HERE = os.path.dirname(os.path.abspath(__file__))
CRATE = os.path.dirname(HERE)
LANGS = {'fr': 'Français', 'en': 'English', 'es': 'Español', 'de': 'Deutsch', 'it': 'Italiano', 'pt': 'Português'}
TR = re.compile(r'@tr\(\s*"((?:[^"\\]|\\.)*)"')


# Skip comments before looking at literals (including multiline source strings).
TOKEN = re.compile(r"'(?:\\.|[^'\\])'|" + r'//[^\n]*|/\*[\s\S]*?\*/|r(\#+)?"[\s\S]*?"\1|"(?:[^"\\]|\\.)*"')
RUST_UI = {
    'lib.rs', 'effects.rs', 'effects_gen.rs', 'settings.rs', 'colorspace.rs',
    'scene.rs', 'tools.rs', 'vector.rs', 'text.rs', 'groups.rs', 'gallery_gen.rs',
    'illu.rs', 'photo.rs', 'curves.rs', 'ascii.rs', 'transform.rs', 'raw.rs', 'editor.rs',
    'ral_gen.rs', 'gpu.rs', 'webgl.rs', 'snapshot.rs', 'anim.rs', 'svg_panel.rs', 'svg_import.rs',
}


def human_text(text):
    """Rust data includes UI labels and technical IDs: only collect readable labels.

    Do not translate IDs, filenames, SVG paths, font families, or serialized keys.
    Keep lower-case French messages as well as capitalized labels/options.
    """
    if (re.fullmatch(r'mp[A-Z][A-Za-z0-9]*|[a-z]+(?:[A-Z][a-zA-Z0-9]*)+|\{[A-Z_]+\}', text)
            or text in {'PhotoModeManager.open', 'IlluGifImport'}):
        return False
    if not any(c.isalpha() for c in re.sub(r'\{[^{}]*\}', '', text)):
        return False
    if not text or any(x in text for x in ('<', '::', 'https:', 'xmlns', '\\u{')):
        return False
    if text.startswith(('[MasterPaint]', 'M ', 'M0 ', ' L ', ' M ', 'RAW :', 'raccourci reçu', 'refresh_all')):
        return False
    return bool(text in {'portrait', 'paysage', 'contre-jour'} or re.search(r'[àâéèêëîïôùûüçœÀÉÈÊÇ]', text)
                or re.search(r'[A-Z][a-zA-Z]+', text)
                or (' ' in text and re.search(r'[a-zA-Z]{2}', text)))


def sources():
    """Slint @tr plus Rust UI data, messages, effect fields/options and shortcuts."""
    seen = {}
    for path in sorted(Path(CRATE, 'ui').glob('*.slint')):
        content = path.read_text(encoding='utf-8')
        # Comments cannot introduce catalogue entries.
        content = re.sub(r'//[^\n]*|/\*[\s\S]*?\*/', lambda m: '\n' * m[0].count('\n'), content)
        for m in TR.finditer(content):
            seen.setdefault(m[1], f'ui/{path.name}:{content.count(chr(10), 0, m.start()) + 1}')
    for name in sorted(RUST_UI):
        path = Path(CRATE, 'src', name)
        content = path.read_text(encoding='utf-8')
        # Unit-test fixtures are not part of the interface.
        content = content.split('#[cfg(test)]')[0]
        for m in TOKEN.finditer(content):
            if not m[0].startswith('"'):
                continue
            text = m[0][1:-1]
            if human_text(text):
                # PO literals cannot contain physical newlines.
                text = text.replace('\n', r'\n').replace('\r', r'\r').replace('\t', r'\t')
                seen.setdefault(text, f'src/{name}:{content.count(chr(10), 0, m.start()) + 1}')
    path = Path(CRATE, 'web', 'index.html')
    content = path.read_text(encoding='utf-8')
    for pattern in [r'mpTr\(("(?:[^"\\]|\\.)*")\)',
                    r'data-mp-i18n>([^<]+)<', r'data-mp-placeholder="([^"<>]+)"']:
        for m in re.finditer(pattern, content):
            text = json.loads(m[1]) if m[1].startswith('"') else m[1]
            text = json.dumps(text, ensure_ascii=False)[1:-1]
            seen.setdefault(text, f'web/index.html:{content.count(chr(10), 0, m.start()) + 1}')
    return seen


def read_po(path):
    """traductions existantes : msgid → msgstr (chaînes telles qu'écrites, échappements compris)"""
    out = {}
    if not os.path.exists(path):
        return out
    msgid = msgstr = None
    cur = None
    with open(path, encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            if line.startswith('msgid '):
                if msgid is not None and msgstr is not None:
                    out[msgid] = msgstr
                msgid, msgstr, cur = line[7:-1], None, 'id'
            elif line.startswith('msgstr '):
                msgstr, cur = line[8:-1], 'str'
            elif line.startswith('"') and cur:
                if cur == 'id':
                    msgid += line[1:-1]
                else:
                    msgstr += line[1:-1]
            else:
                cur = None
    if msgid is not None and msgstr is not None:
        out[msgid] = msgstr
    out.pop('', None)
    return out


def write_po(lang, texts):
    d = os.path.join(CRATE, 'lang', lang, 'LC_MESSAGES')
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, 'masterpaint-ui.po')
    old = read_po(path)
    plural = 'nplurals=2; plural=(n > 1);' if lang in ('fr', 'pt') else 'nplurals=2; plural=(n != 1);'
    lines = [
        f'# MasterPaint — traduction de l\'interface : {LANGS[lang]} ({lang}).',
        '# Fichier tenu à jour par tools/gen_lang.py : les traductions écrites ici sont gardées.',
        '# Traductions initialisées automatiquement et corrigées pour les commandes principales ; voir lang/README.md.',
        'msgid ""',
        'msgstr ""',
        '"Content-Type: text/plain; charset=UTF-8\\n"',
        f'"Language: {lang}\\n"',
        f'"Plural-Forms: {plural}\\n"',
        '',
    ]
    done = 0
    for text, where in texts.items():
        tr = text if lang == 'fr' else old.get(text, '')
        done += bool(tr)
        lines += [f'#: {where}', f'msgid "{text}"', f'msgstr "{tr}"', '']
    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines))
    return done


def update_web(check=False):
    path = Path(CRATE, 'web', 'index.html')
    content = path.read_text(encoding='utf-8')
    # Only bootstrap/fallback strings are shipped to JavaScript, not the entire UI catalogue.
    keys = {t for t, where in sources().items() if where.startswith('web/')}
    for m in re.finditer(r'mpTr\(("(?:[^"\\]|\\.)*")\)', content):
        keys.add(m[1][1:-1])
    for m in re.finditer(r'data-mp-(?:i18n>([^<]+)<|placeholder="([^"<>]+)")', content):
        keys.add(json.dumps(m[1] or m[2], ensure_ascii=False)[1:-1])
    tables = {}
    for lang in LANGS:
        if lang == 'fr': continue
        po = read_po(Path(CRATE, 'lang', lang, 'LC_MESSAGES', 'masterpaint-ui.po'))
        tables[lang] = {json.loads('"' + k + '"'): json.loads('"' + po[k] + '"') for k in sorted(keys) if po.get(k)}
    data = json.dumps(tables, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
    updated = re.sub(r'const mpTranslations = .*?;\n// END GENERATED I18N',
                     lambda m: f'const mpTranslations = {data};\n// END GENERATED I18N', content, count=1)
    if check:
        if updated != content:
            print('web/index.html : catalogue embarqué à régénérer')
            return False
    else:
        path.write_text(updated, encoding='utf-8')
    return True


def audit_slint():
    """Reject readable literals that bypass @tr, apart from stable internal codes."""
    allowed = {'calque texte', 'verrouillé', 'dossier', 'Font Awesome 6 Brands'}
    ok = True
    for path in sorted(Path(CRATE, 'ui').glob('*.slint')):
        content = path.read_text(encoding='utf-8')
        for m in TOKEN.finditer(content):
            if not m[0].startswith('"'): continue
            text = m[0][1:-1]
            if re.search(r'@tr\(\s*$', content[max(0, m.start()-20):m.start()]): continue
            if text in allowed or text.startswith('fn:'): continue
            if re.search(r'[éèàçœ]|Maj|Suppr|Échap', text) or (' ' in text and re.search(r'[A-Za-z]{3}', text)):
                print(f'{path.name}:{content.count(chr(10), 0, m.start()) + 1}: texte hors @tr : {text}')
                ok = False
    return ok


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Vérifier la couverture sans modifier les fichiers')
    args = parser.parse_args()
    texts = sources()
    failed = args.check and not audit_slint()
    for lang in LANGS:
        if args.check:
            old = read_po(os.path.join(CRATE, 'lang', lang, 'LC_MESSAGES/masterpaint-ui.po'))
            missing = set(texts) - old.keys()
            stale = old.keys() - set(texts)
            empty = [t for t in texts if not old.get(t)]
            n = len(texts) - len(empty)
            if missing or stale or empty:
                print(f'{lang}: {len(missing)} absents, {len(stale)} obsolètes, {len(empty)} vides')
                failed = True
            for source in texts:
                # Rust format fields and Slint placeholders must survive translation.
                fields = lambda s: sorted(re.findall(r'(?<!\{)\{[^{}]*\}(?!\})', s))
                if old.get(source) and fields(source) != fields(old[source]):
                    print(f'{lang}: paramètres différents : {source}')
                    failed = True
                target = old.get(source, '')
                unit = re.search(r'(\(px\)|\(%\)| %|°)$', source)
                axes = re.findall(r'\b([XY])\b', source)
                if target and ((unit and unit[1].strip() not in target) or any(axis not in target for axis in axes)):
                    print(f'{lang}: unité ou axe perdu : {source}')
                    failed = True
        else:
            n = write_po(lang, texts)
        print(f'{lang} : {n} / {len(texts)} textes traduits')
    if not update_web(args.check):
        failed = True
    if failed:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
