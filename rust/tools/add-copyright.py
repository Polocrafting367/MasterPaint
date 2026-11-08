#!/usr/bin/env python3
"""Add the MasterPaint author credit without changing third-party assets or binary formats."""
from pathlib import Path
root = Path(__file__).resolve().parents[2]
credit = 'MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.'
count = 0
for path in root.rglob('*'):
    if not path.is_file(): continue
    rel = path.relative_to(root)
    if any(part in {'.git', '.agents', '.codex', '.aws', 'vendor', 'backups', 'downloads', 'icon-packs', 'fonts', 'target', '__pycache__'} for part in rel.parts): continue
    if path.name.startswith(('LICENSE', 'NOTICE', 'Cargo.lock')): continue
    ext = path.suffix.lower()
    if ext in {'.rs', '.slint', '.js', '.ts', '.java', '.kt', '.c', '.h', '.cpp'}: header = '// ' + credit
    elif ext in {'.py', '.sh', '.ps1', '.toml', '.po', '.desktop', '.yml', '.yaml'} or path.name in {'.gitignore', '.htaccess'}: header = '# ' + credit
    elif ext == '.css': header = '/* ' + credit + ' */'
    elif ext == '.nsi': header = '; ' + credit
    elif path.name == 'robots.txt': header = '# ' + credit
    elif path.name == 'changelog.txt': header = credit
    elif ext in {'.html', '.svg', '.xml', '.md', '.plist'}: header = '<!-- ' + credit + ' -->'
    else: continue
    text = path.read_text()
    if credit in text: continue
    lines = text.splitlines(keepends=True)
    index = 1 if lines and (lines[0].startswith('#!') or lines[0].startswith('<?xml') or lines[0].lower().startswith('<!doctype')) else 0
    lines.insert(index, header + '\n')
    path.write_text(''.join(lines)); count += 1
print(f'{count} fichiers marqués')
