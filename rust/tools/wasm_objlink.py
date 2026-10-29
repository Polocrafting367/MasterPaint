"""
Mini « linker » WASM pour un objet relocatable unique produit par `rustc --emit obj`.

Pourquoi : sur certaines machines Windows (Smart App Control), `cargo.exe` et
`rust-lld.exe` sont bloqués alors que `rustc.exe` s'exécute. LLVM écrit les objets
WASM « provisoirement liés » (segments de données posés à partir de 0, indices
de fonctions/types/globales déjà finaux tant que tout est dans un seul objet).
Il suffit donc de :
  1. retirer les sections personnalisées `linking` / `reloc.*` ;
  2. ajouter une section d'export pour les symboles `#[no_mangle] extern "C"` ;
  3. ajouter une globale exportée `__data_end` (fin des données statiques).

La mémoire, `__stack_pointer` et `__indirect_function_table` restent importés :
c'est le JS (js/rust/RustCore.js) qui les fournit. Les symboles non résolus
(sinf, panics de core…) restent importés depuis `env` et sont fournis/stubés en JS.

Usage : python -I wasm_objlink.py entree.o sortie.wasm
"""
import sys

SEC_CUSTOM, SEC_TYPE, SEC_IMPORT, SEC_FUNCTION, SEC_TABLE, SEC_MEMORY, SEC_GLOBAL, \
    SEC_EXPORT, SEC_START, SEC_ELEM, SEC_CODE, SEC_DATA, SEC_DATACOUNT = range(13)

SYM_FUNCTION, SYM_DATA, SYM_GLOBAL, SYM_SECTION, SYM_TAG, SYM_TABLE = range(6)
F_LOCAL, F_HIDDEN, F_UNDEFINED, F_EXPORTED, F_EXPLICIT_NAME = 0x2, 0x4, 0x10, 0x20, 0x40


def uleb(b, p):
    r = s = 0
    while True:
        c = b[p]
        p += 1
        r |= (c & 0x7F) << s
        s += 7
        if not c & 0x80:
            return r, p


def sleb(b, p):
    r = s = 0
    while True:
        c = b[p]
        p += 1
        r |= (c & 0x7F) << s
        s += 7
        if not c & 0x80:
            if c & 0x40:
                r -= 1 << s
            return r, p


def enc_uleb(v):
    out = bytearray()
    while True:
        c = v & 0x7F
        v >>= 7
        if v:
            out.append(c | 0x80)
        else:
            out.append(c)
            return bytes(out)


def enc_sleb(v):
    out = bytearray()
    while True:
        c = v & 0x7F
        v >>= 7
        if (v == 0 and not c & 0x40) or (v == -1 and c & 0x40):
            out.append(c)
            return bytes(out)
        out.append(c | 0x80)


def name(b, p):
    n, p = uleb(b, p)
    return b[p:p + n].decode('utf-8'), p + n


def enc_name(s):
    d = s.encode('utf-8')
    return enc_uleb(len(d)) + d


def parse_sections(b):
    assert b[:4] == b'\0asm', 'pas un module wasm'
    p = 8
    secs = []
    while p < len(b):
        sid = b[p]
        size, q = uleb(b, p + 1)
        secs.append((sid, b[q:q + size]))
        p = q + size
    return secs


def count_imports(payload):
    """Retourne (nb fonctions importées, nb globales importées)."""
    n, p = uleb(payload, 0)
    nf = ng = 0
    for _ in range(n):
        _, p = name(payload, p)
        _, p = name(payload, p)
        kind = payload[p]
        p += 1
        if kind == 0:
            _, p = uleb(payload, p)
            nf += 1
        elif kind == 1:  # table
            p += 1
            flags, p = uleb(payload, p)
            _, p = uleb(payload, p)
            if flags & 1:
                _, p = uleb(payload, p)
        elif kind == 2:  # memory
            flags, p = uleb(payload, p)
            _, p = uleb(payload, p)
            if flags & 1:
                _, p = uleb(payload, p)
        elif kind == 3:  # global
            p += 2
            ng += 1
        elif kind == 4:  # tag
            p += 1
            _, p = uleb(payload, p)
    return nf, ng


def data_end(payload):
    n, p = uleb(payload, 0)
    end = 0
    for _ in range(n):
        flags, p = uleb(payload, p)
        if flags == 2:
            _, p = uleb(payload, p)
        if flags in (0, 2):
            op = payload[p]
            p += 1
            assert op == 0x41, 'offset de segment non constant'
            off, p = sleb(payload, p)
            assert payload[p] == 0x0B
            p += 1
        else:
            off = None
        size, p = uleb(payload, p)
        p += size
        if off is not None:
            end = max(end, off + size)
    return end


def exported_functions(linking):
    ver, p = uleb(linking, 0)
    assert ver == 2, 'version linking inattendue %d' % ver
    out = []
    while p < len(linking):
        kind = linking[p]
        size, q = uleb(linking, p + 1)
        p = q + size
        if kind != 8:  # WASM_SYMBOL_TABLE
            continue
        cnt, q = uleb(linking, q)
        for _ in range(cnt):
            sk = linking[q]
            flags, q = uleb(linking, q + 1)
            if sk in (SYM_FUNCTION, SYM_GLOBAL, SYM_TAG, SYM_TABLE):
                idx, q = uleb(linking, q)
                nm = None
                if not (flags & F_UNDEFINED) or (flags & F_EXPLICIT_NAME):
                    nm, q = name(linking, q)
                if (sk == SYM_FUNCTION and nm and not flags & F_UNDEFINED
                        and not flags & (F_LOCAL | F_HIDDEN)):
                    out.append((nm, idx))
            elif sk == SYM_DATA:
                _, q = name(linking, q)
                if not flags & F_UNDEFINED:
                    for _ in range(3):
                        _, q = uleb(linking, q)
            elif sk == SYM_SECTION:
                _, q = uleb(linking, q)
    return out


def main(src, dst):
    b = open(src, 'rb').read()
    secs = parse_sections(b)
    linking = next((pl for sid, pl in secs if sid == 0 and name(pl, 0)[0] == 'linking'), None)
    assert linking is not None, 'section linking absente (objet déjà lié ?)'
    lk = linking[name(linking, 0)[1]:]
    exports = exported_functions(lk)
    imports = next((pl for sid, pl in secs if sid == SEC_IMPORT), b'\0')
    _, n_glob_imp = count_imports(imports)
    dend = 0
    n_glob_def = 0
    for sid, pl in secs:
        if sid == SEC_DATA:
            dend = data_end(pl)
        if sid == SEC_GLOBAL:
            n_glob_def, _ = uleb(pl, 0)
    dend = (dend + 15) & ~15
    new_global_idx = n_glob_imp + n_glob_def

    out = bytearray(b[:8])

    def emit(sid, payload):
        out.append(sid)
        out.extend(enc_uleb(len(payload)))
        out.extend(payload)

    glob_entry = bytes([0x7F, 0x00, 0x41]) + enc_sleb(dend) + b'\x0b'  # i32 immuable
    wrote_global = False
    order = [SEC_TYPE, SEC_IMPORT, SEC_FUNCTION, SEC_TABLE, SEC_MEMORY, SEC_GLOBAL,
             SEC_EXPORT, SEC_START, SEC_ELEM, SEC_DATACOUNT, SEC_CODE, SEC_DATA]
    by_id = {}
    for sid, pl in secs:
        if sid != SEC_CUSTOM:
            by_id[sid] = pl
    for sid in order:
        if sid == SEC_GLOBAL:
            if sid in by_id:
                cnt, p = uleb(by_id[sid], 0)
                emit(sid, enc_uleb(cnt + 1) + by_id[sid][p:] + glob_entry)
            else:
                emit(sid, enc_uleb(1) + glob_entry)
            wrote_global = True
            continue
        if sid == SEC_EXPORT:
            body = bytearray(enc_uleb(len(exports) + 1))
            for nm, idx in exports:
                body += enc_name(nm) + b'\x00' + enc_uleb(idx)
            body += enc_name('__data_end') + b'\x03' + enc_uleb(new_global_idx)
            emit(sid, bytes(body))
            continue
        if sid in by_id:
            emit(sid, by_id[sid])
    assert wrote_global
    open(dst, 'wb').write(bytes(out))
    print('ok: %d exports, data_end=%d, %d octets' % (len(exports), dend, len(out)))
    for nm, _ in exports:
        print('  export', nm)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
