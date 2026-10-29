"""Dump a .NET .resources file (string entries) as key\tvalue lines (UTF-8)."""
import sys, struct

def read7(b, p):
    r = s = 0
    while True:
        c = b[p]; p += 1
        r |= (c & 0x7F) << s; s += 7
        if not c & 0x80:
            return r, p

def main(path, out):
    b = open(path, 'rb').read()
    p = 0
    magic, ver, skip = struct.unpack_from('<III', b, p); p += 12
    p += skip
    rver, n, ntypes = struct.unpack_from('<III', b, p); p += 12
    types = []
    for _ in range(ntypes):
        l, p = read7(b, p); types.append(b[p:p+l].decode('utf-8')); p += l
    # align to 8
    while p % 8: p += 1
    p += 4 * n  # hashes
    pos = struct.unpack_from('<%dI' % n, b, p); p += 4 * n
    dsec, = struct.unpack_from('<I', b, p); p += 4
    nsec = p
    rows = []
    for off in pos:
        q = nsec + off
        l, q = read7(b, q)
        name = b[q:q+l].decode('utf-16-le'); q += l
        doff, = struct.unpack_from('<I', b, q)
        d = dsec + doff
        tc, d = read7(b, d)
        if tc == 1:  # string
            l, d = read7(b, d)
            rows.append((name, b[d:d+l].decode('utf-8', 'replace')))
    rows.sort()
    with open(out, 'w', encoding='utf-8') as f:
        for k, v in rows:
            f.write(k + '\t' + v.replace('\r', '').replace('\n', '\\n') + '\n')
    print(len(rows), 'strings')

main(sys.argv[1], sys.argv[2])
