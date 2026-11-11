# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
"""Compression brotli faite à l'avance de la version web (rust-app/pkg) : le serveur envoie le
.br aux navigateurs qui l'acceptent (.htaccess), ~30 % de moins que gzip à la volée, sans rien
coûter à l'exécution.

  python3 -I tools/precompress-web.py ../rust-app/pkg
"""
import sys
from pathlib import Path

import brotli

for d in sys.argv[1:]:
    for f in Path(d).iterdir():
        if f.suffix not in ('.wasm', '.js') or not f.is_file():
            continue
        data = f.read_bytes()
        out = brotli.compress(data, quality=11, lgwin=24)
        f.with_name(f.name + '.br').write_bytes(out)
        print(f'{f.name} : {len(data) / 1e6:.1f} Mo → {len(out) / 1e6:.1f} Mo (brotli)')
