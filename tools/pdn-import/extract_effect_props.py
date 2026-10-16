"""
Extrait les réglages des effets de Paint.NET 5 depuis l'IL désassemblé (ildasm, fourni avec
Paint.NET) : pour chaque effet, propriétés (type, défaut, min, max, choix) et libellés traduits.

Usage :
  ildasm /UTF8 /OUT=gpu.il "C:\\Program Files\\paint.net\\PaintDotNet.Effects.Gpu.dll"
  python -I extract_effect_props.py gpu.il res_fr.tsv  > pdn_effects.json

res_fr.tsv : sortie de dumpres.py sur PaintDotNet.Strings.3.FR.resources.
Le résultat sert de référence pour aligner les dialogues de MasterPaint (docs/pdn-effects-reference.md).
"""
import json, re, sys

CIPN = ['DisplayName', 'Description', 'ControlType', 'ButtonText', 'UseExponentialScale', 'DecimalPlaces',
        'SliderSmallChange', 'SliderSmallChangeX', 'SliderSmallChangeY', 'SliderLargeChange', 'SliderLargeChangeX',
        'SliderLargeChangeY', 'UpDownIncrement', 'UpDownIncrementX', 'UpDownIncrementY', 'StaticImageUnderlay',
        'Multiline', 'ShowResetButton', 'SliderShowTickMarks', 'SliderShowTickMarksX', 'SliderShowTickMarksY',
        'WindowTitle', 'WindowWidthScale', 'WindowIsSizable', 'SliderSmallChangeZ', 'SliderLargeChangeZ',
        'UpDownIncrementZ', 'SliderShowTickMarksZ', 'Footnote', 'RangeWraps', 'ControlStyle', 'ControlColors',
        'WindowHelpContentType', 'WindowHelpContent', 'AllowAllFiles', 'FileTypes', 'ShowHeaderLine',
        'WindowShowBottomSeparatorLine', 'ExponentialScale']
PCT = ['AngleChooser', 'CheckBox', 'PanAndSlider', 'Slider', 'IncrementButton', 'DropDown', 'TextBox', 'RadioButton',
       'ColorWheel', 'RollBallAndSliders', 'FileChooser', 'LinkLabel', 'FolderChooser', 'Null', 'Label']

PROP_TYPES = ('DoubleProperty', 'Int32Property', 'BooleanProperty', 'StaticListChoiceProperty',
              'DoubleVectorProperty', 'Int32VectorProperty', 'ColorBgraProperty', 'StringProperty',
              'ImageProperty', 'UriProperty', 'DoubleVector3Property')


def join_instructions(lines):
    """Regroupe les instructions IL étalées sur plusieurs lignes."""
    out = []
    for ln in lines:
        s = ln.strip()
        if re.match(r'IL_[0-9a-f]{4}:', s):
            out.append(s)
        elif out and s and not s.startswith('//') and not s.startswith('.') and s != '}' and s != '{':
            out[-1] += ' ' + s
    return out


def count_args(sig):
    m = re.search(r'::[^(]*\((.*)\)\s*$', sig)
    if not m:
        return 0
    inner = m.group(1).strip()
    if not inner:
        return 0
    depth = 0
    n = 1
    for ch in inner:
        if ch in '<[':
            depth += 1
        elif ch in '>]':
            depth -= 1
        elif ch == ',' and depth == 0:
            n += 1
    return n


def returns_value(sig):
    head = sig.split('::')[0]
    return not re.search(r'\bvoid\b', head)


class Sim:
    def __init__(self, enums):
        self.enums = enums

    def run(self, instrs):
        st, locs, props, ui = [], {}, [], []
        arrays = {}
        for ins in instrs:
            body = ins.split(':', 1)[1].strip()
            op, _, arg = body.partition(' ')
            arg = arg.strip()
            try:
                if op.startswith('ldc.i4'):
                    if op == 'ldc.i4.m1':
                        v = -1
                    elif op in ('ldc.i4', 'ldc.i4.s'):
                        v = int(arg, 16) if arg.startswith('0x') else int(arg)
                    else:
                        v = int(op.split('.')[-1])
                    st.append(v)
                elif op in ('ldc.r8', 'ldc.r4'):
                    st.append(float(arg.replace('(', '').split()[0]) if not arg.startswith('(') else float('nan'))
                elif op == 'ldc.i8':
                    st.append(int(arg, 16) if arg.startswith('0x') else int(arg))
                elif op == 'ldstr':
                    st.append(('str', arg.strip('"')))
                elif op == 'box':
                    v = st.pop() if st else None
                    tname = arg.split('/')[-1]
                    full = arg
                    if isinstance(v, int):
                        st.append(('enum', full, v))
                    else:
                        st.append(v)
                elif op == 'dup':
                    st.append(st[-1] if st else None)
                elif op == 'pop':
                    st and st.pop()
                elif op.startswith('stloc'):
                    k = op.split('.')[-1] if '.' in op and op != 'stloc.s' and op != 'stloc' else arg
                    locs[k] = st.pop() if st else None
                elif op.startswith('ldloc'):
                    k = op.split('.')[-1] if '.' in op and op not in ('ldloc.s', 'ldloc', 'ldloca.s', 'ldloca') else arg
                    st.append(locs.get(k))
                elif op in ('ldarg.0', 'ldarg.1', 'ldarg.2', 'ldarg.s', 'ldnull', 'ldsfld', 'ldfld', 'ldftn', 'ldtoken', 'ldsflda', 'ldflda'):
                    if op in ('ldfld', 'ldflda'):
                        st and st.pop()
                    st.append(None)
                elif op == 'newarr':
                    n = st.pop() if st else 0
                    st.append(('array', [None] * (n if isinstance(n, int) and 0 <= n < 1000 else 0)))
                elif op.startswith('stelem'):
                    v = st.pop() if st else None
                    i = st.pop() if st else None
                    a = st.pop() if st else None
                    if isinstance(a, tuple) and a[0] == 'array' and isinstance(i, int) and i < len(a[1]):
                        a[1][i] = v
                elif op.startswith('conv') or op in ('nop', 'castclass', 'unbox.any', 'volatile.'):
                    pass
                elif op in ('br', 'br.s', 'leave', 'leave.s', 'ret'):
                    pass
                elif op.startswith('b') and op not in ('box',):
                    # branchement conditionnel : on dépile les opérandes et on continue linéairement
                    n = 1 if op in ('brtrue', 'brtrue.s', 'brfalse', 'brfalse.s') else 2
                    for _ in range(n):
                        st and st.pop()
                elif op in ('add', 'sub', 'mul', 'div', 'neg', 'ceq', 'cgt', 'clt', 'and', 'or', 'not', 'rem'):
                    if op in ('neg', 'not'):
                        pass
                    else:
                        b = st.pop() if st else None
                        a = st.pop() if st else None
                        try:
                            st.append({'add': a + b, 'sub': a - b, 'mul': a * b, 'div': a / b}.get(op))
                        except Exception:
                            st.append(None)
                elif op in ('newobj', 'call', 'callvirt'):
                    n = count_args(arg)
                    args = [st.pop() if st else None for _ in range(n)][::-1]
                    inst = None
                    if op == 'callvirt' or (op == 'call' and ' instance ' in (' ' + arg + ' ')):
                        inst = st.pop() if st else None
                    cls = re.search(r'([\w.`]+)::([\w.]+)\(', arg)
                    cname, mname = (cls.group(1).split('.')[-1], cls.group(2)) if cls else ('', '')
                    if op == 'newobj':
                        if cname in PROP_TYPES:
                            props.append({'type': cname.replace('Property', ''), 'args': args})
                        st.append(('obj', cname))
                    else:
                        if mname == 'GetString' and args and isinstance(args[0], tuple) and args[0][0] == 'str':
                            res = ('res', args[0][1])
                        elif mname == 'SetPropertyControlValue':
                            ui.append(args)
                            res = None
                        elif mname == 'SetPropertyControlType':
                            ui.append(args + ['__controltype'])
                            res = None
                        else:
                            res = ('call', cname + '.' + mname, args) if mname.startswith('get_') or 'ToRadius' in mname else None
                        if returns_value(arg):
                            st.append(res)
                else:
                    pass
            except Exception:
                pass
        return props, ui


def parse(il_path, res_path):
    text = open(il_path, encoding='utf-8', errors='replace').read().splitlines()
    res = {}
    for ln in open(res_path, encoding='utf-8'):
        k, _, v = ln.rstrip('\n').partition('\t')
        res[k] = v.replace('&', '')

    # enums PropertyNames (et autres enums imbriqués)
    # clé = « Externe/Imbriquée » (ex. PaintDotNet.Effects.Gpu.GaussianBlurGpuEffect/PropertyNames)
    enums = {}
    outer = None
    cur_enum = None
    for ln in text:
        if ln.strip().startswith('.class'):
            nm = ln.strip().split()[-1]
            if ' nested ' in ln:
                cur_enum = (outer or '') + '/' + nm
            else:
                outer = nm
                cur_enum = nm
            enums.setdefault(cur_enum, {})
        fm = re.search(r'\.field public static literal valuetype \S+ (\w+) = int32\((0x[0-9A-Fa-f]+)\)', ln)
        if fm and cur_enum:
            enums[cur_enum][int(fm.group(2), 16)] = fm.group(1)

    # méthodes par classe
    effects = {}
    cls = None
    meth = None
    buf = []
    for ln in text:
        s = ln.strip()
        if s.startswith('.class') and ('Effect' in s):
            cls = s.split()[-1]
        if s.startswith('.method') or (meth is None and False):
            meth = None
            buf = []
        if 'OnCreatePropertyCollection()' in s:
            meth = 'props'
            buf = []
            continue
        if s.startswith('OnCreateConfigUI('):
            meth = 'ui'
            buf = []
            continue
        if meth and s.startswith('} // end of method'):
            effects.setdefault(cls, {})[meth] = join_instructions(buf)
            meth = None
            continue
        if meth:
            buf.append(ln)

    sim = Sim(enums)

    def fmt(v):
        if isinstance(v, tuple):
            if v[0] == 'enum':
                if v[1].endswith('ControlInfoPropertyNames'):
                    return CIPN[v[2]] if 0 <= v[2] < len(CIPN) else v[2]
                if v[1].endswith('PropertyControlType'):
                    return PCT[v[2]] if 0 <= v[2] < len(PCT) else v[2]
                if v[1].endswith('System.Boolean'):
                    return bool(v[2])
                if v[1].endswith('System.Int32') or v[1].endswith('System.Double'):
                    return v[2]
                en = re.sub(r'^\[[^\]]*\]', '', v[1].replace('valuetype ', '').strip())
                return enums.get(en, {}).get(v[2], '%s#%d' % (en.split('/')[-1].split('.')[-1], v[2]))
            if v[0] == 'str':
                return v[1]
            if v[0] == 'res':
                return res.get(v[1], v[1])
            if v[0] == 'array':
                return [fmt(x) for x in v[1]]
            if v[0] == 'call':
                return '<' + v[1] + '>'
            return str(v)
        return v

    out = {}
    for cname, m in effects.items():
        if 'props' not in m:
            continue
        props, _ = sim.run(m['props'])
        if not props:
            continue
        labels = {}
        if 'ui' in m:
            _, ui = sim.run(m['ui'])
            for a in ui:
                if len(a) >= 3 and a[-1] != '__controltype':
                    key = fmt(a[0])
                    kind = fmt(a[1])
                    labels.setdefault(str(key), {})[str(kind)] = fmt(a[2])
                elif len(a) >= 3:
                    ct = a[1]
                    labels.setdefault(str(fmt(a[0])), {})['ControlType'] = PCT[ct] if isinstance(ct, int) and 0 <= ct < len(PCT) else fmt(ct)
        lst = []
        for p in props:
            args = [fmt(x) for x in p['args']]
            name = args[0] if args else '?'
            entry = {'name': name, 'type': p['type'], 'args': args[1:]}
            if str(name) in labels:
                entry['ui'] = labels[str(name)]
            lst.append(entry)
        out[cname.split('.')[-1]] = lst
    return out


if __name__ == '__main__':
    data = json.dumps(parse(sys.argv[1], sys.argv[2]), ensure_ascii=False, indent=1, default=str)
    if len(sys.argv) > 3:
        open(sys.argv[3], 'w', encoding='utf-8').write(data)
    else:
        sys.stdout.reconfigure(encoding='utf-8')
        print(data)
