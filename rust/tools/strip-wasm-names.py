#!/usr/bin/env python3
"""Retire la section « name » (symboles de débogage) d'un .wasm : -8 Mo sur 28 pour MasterPaint,
sans effet sur l'exécution. Usage : strip-wasm-names.py fichier.wasm"""
import sys

def leb(b, i):
    r = s = 0
    while True:
        x = b[i]
        i += 1
        r |= (x & 0x7F) << s
        s += 7
        if not x & 0x80:
            return r, i

path = sys.argv[1]
b = open(path, 'rb').read()
out = bytearray(b[:8])
i = 8
dropped = 0
while i < len(b):
    start = i
    sid = b[i]
    i += 1
    n, i = leb(b, i)
    end = i + n
    if sid == 0:
        l, j = leb(b, i)
        if b[j:j + l] == b'name':
            dropped += end - start
            i = end
            continue
    out += b[start:end]
    i = end
open(path, 'wb').write(out)
print(f"section name retirée : -{dropped / 1048576:.1f} Mo")
