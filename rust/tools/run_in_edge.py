"""
Exécute un script JS de test dans Edge headless et affiche ce qu'il écrit dans <pre id=out>.

Usage : python -I run_in_edge.py test.js [fichier1 fichier2 ...]
Chaque fichier supplémentaire est embarqué en base64 et accessible dans le test via
`FILES['nom_du_fichier']` (Uint8Array). Les fichiers .js supplémentaires sont aussi
exécutés comme <script> avant le test.
Le test doit appeler `done(texte)` à la fin.
"""
import base64, os, subprocess, sys, tempfile, html, re

EDGE = [r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
        r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"]


def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    args = sys.argv[1:]
    realtime = '--realtime' in args
    args = [a for a in args if a != '--realtime']
    test = args[0]
    extra = args[1:]
    files_js = []
    scripts = []
    for f in extra:
        data = open(f, 'rb').read()
        files_js.append('FILES[%r]=Uint8Array.from(atob(%r),c=>c.charCodeAt(0));'
                        % (os.path.basename(f), base64.b64encode(data).decode()))
        if f.endswith('.js'):
            scripts.append('<script>%s</script>' % data.decode('utf-8').replace('</script', '<\\/script'))
    body = open(test, 'r', encoding='utf-8').read()
    page = ('<!doctype html><meta charset=utf-8><pre id=out>PENDING</pre><script>'
            'window.FILES={};%s'
            'window.done=function(t){document.getElementById("out").textContent="DONE\\n"+t;};'
            'window.onerror=function(m,s,l,c,e){done("ERROR "+m+" @"+l+":"+c+"\\n"+(e&&e.stack));};'
            'window.addEventListener("unhandledrejection",function(e){done("REJECT "+(e.reason&&e.reason.stack||e.reason));});'
            '</script>%s<script>%s</script>'
            % (''.join(files_js), ''.join(scripts),
               ('try{%s}catch(e){done("EXC "+(e&&e.stack||e));}' if realtime
                else '(async()=>{%s})().catch(e=>done("EXC "+(e&&e.stack||e)));') % body))
    tmpdir = tempfile.mkdtemp(prefix='mp_edge_')
    path = os.path.join(tmpdir, 'test.html')
    open(path, 'w', encoding='utf-8').write(page)
    exe = next(e for e in EDGE if os.path.exists(e))
    # --realtime : le test doit être synchrone (temps réel mesurable, pas de temps virtuel)
    timing = [] if realtime else ['--virtual-time-budget=60000']
    r = subprocess.run([exe, '--headless=new', '--disable-gpu', '--no-first-run',
                        '--user-data-dir=' + os.path.join(tmpdir, 'prof')] + timing +
                       ['--dump-dom', 'file:///' + path.replace('\\', '/')],
                       capture_output=True, text=True, encoding='utf-8', timeout=300)
    m = re.search(r'<pre id="out">(.*?)</pre>', r.stdout, re.S)
    print(html.unescape(m.group(1)) if m else ('NO OUTPUT\n' + r.stdout[-2000:] + r.stderr[-2000:]))


if __name__ == '__main__':
    main()
