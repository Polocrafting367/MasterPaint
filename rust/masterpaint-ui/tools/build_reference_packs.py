# MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
from pathlib import Path
import re,json,base64,shutil,subprocess
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
root=Path(__file__).resolve().parents[3]; dest=root/'rust/masterpaint-ui/icon-packs';dest.mkdir(exist_ok=True)
fa=[]
for cp,name,style in re.findall(r'\("\\u\{([0-9a-f]+)\}", "([^"]+)", "([^"]+)"\)',(root/'rust/masterpaint-ui/src/fa_used_gen.rs').read_text()):
 f=TTFont(str(root/'rust/masterpaint-ui/fonts'/('fa-brands-400.ttf' if style=='brands' else 'fa-regular-400.ttf' if style=='regular' else 'fa-solid-900.ttf')))
 glyph=f.getBestCmap().get(int(cp,16))
 if glyph is None:
  for font in (root/'rust/masterpaint-ui/fonts').glob('fa-*.ttf'):
   other=TTFont(font); g=other.getBestCmap().get(int(cp,16))
   if g is not None: f=other;glyph=g;break
 if glyph is None: continue
 gs=f.getGlyphSet(); pen=SVGPathPen(gs);gs[glyph].draw(pen);up=f['head'].unitsPerEm;adv=f['hmtx'][glyph][0];asc=f['hhea'].ascent
 svg=f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {adv} {up}"><path fill="{{STROKE}}" transform="translate(0 {asc}) scale(1 -1)" d="{pen.getCommands()}"/></svg>'
 fa.append((cp,name,svg))
mp_source=dest/'masterpaint'/'source'/'fontawesome';mp_source.mkdir(parents=True,exist_ok=True)
for _,n,s in fa:(mp_source/(n+'.svg')).write_text('<!-- MasterPaint © 2026 polocrafting — https://polocrafting.fr -->\n'+s+'\n')
(root/'rust/masterpaint-ui/src/fa_svg_gen.rs').write_text('// MasterPaint — © polocrafting. SVG visibles dans icon-packs/masterpaint/source/fontawesome/.\npub const FA_SVG: &[(&str, &str)] = &[\n'+''.join(f'    ({json.dumps(n)}, include_str!("../icon-packs/masterpaint/source/fontawesome/{n}.svg")),\n' for _,n,_ in fa)+'];\n')
(root/'rust/masterpaint-ui/ui/pack-icons.slint').write_text('export global PackIcons {\n in property <[image]> images;\n public pure function index(g: string) -> int { return '+''.join(('' if i==0 else ': ')+f'g == "\\u{{{cp}}}" ? {i} ' for i,(cp,_,_) in enumerate(fa))+': -1; }\n}\n')
import sys; sys.path.insert(0,str(Path(__file__).resolve().parent))
from pack_mappings import PDN as pdn, PHOTO as photo, VECTOR as vector
vector_src=root.parent/'masterpaint-inspiration/vectorcraft-main'
from gen_custom_pack_icons import CUSTOM_ALIAS
# Also match generated MasterPaint names to upstream names where unambiguous.
mpnames=re.findall(r'^    \("([^"]+)"',(root/'rust/masterpaint-ui/src/mpicons_gen.rs').read_text(),re.M)
sprites=re.findall(r'^    \("([^"]+)"',(root/'rust/masterpaint-ui/src/sprite_gen.rs').read_text(),re.M)
tools=re.findall(r'^    "([^"]+)",$',(root/'rust/masterpaint-ui/src/icons_gen.rs').read_text().split('ICON_NAMES')[1],re.M)
reference_rows=[]
for kind,src,mapping,ext in [('paintdotjs',root.parent/'masterpaint-inspiration/paintdotjs',pdn,'png'),('photocraft',root.parent/'masterpaint-inspiration/photocraft',photo,'svg')]:
 folder=dest/kind;folder.mkdir(exist_ok=True)
 for file in (['LICENSE.md','NOTICE.md'] if kind=='paintdotjs' else ['LICENSE-MIT','LICENSE-APACHE','NOTICE','ATTRIBUTION.md']):shutil.copy(src/file,folder/file)
 for f in (src/'assets/icons').glob('LICENSE*'):shutil.copy(f,folder/f.name)
 if kind=='photocraft':
  vlic=folder/'vectorcraft';vlic.mkdir(exist_ok=True)
  for f in ['LICENSE-MIT','LICENSE-APACHE','NOTICE','ATTRIBUTION.md']:
   if (vector_src/f).exists():shutil.copy(vector_src/f,vlic/f)
  for f in (vector_src/'assets/icons').glob('LICENSE*'):shutil.copy(f,vlic/f.name)
 source_dir=folder/'source';source_dir.mkdir(exist_ok=True)
 for original in sorted((src/'assets/icons').glob('*')):
  if original.is_file() and original.suffix.lower() in {'.png','.svg'}:
   shutil.copy2(original,source_dir/original.name)
 icons={}; asset_map={}; custom_keys=[]
 custom_dir=folder/'custom'
 def asset(n,key):
  # correspondance écrite à la main d'abord, puis nom identique (PhotoCraft : noms Lucide)
  stem=mapping.get(n) or mapping.get(n.removeprefix('tool-')) or n
  file=src/'assets/icons'/f'{stem}.{ext}'
  if not file.exists() and kind=='photocraft':
   # même famille ArtCraft : icône de VectorCraft (copiée dans photocraft/vectorcraft/)
   vstem=vector.get(n) or vector.get(n.removeprefix('tool-')) or vector.get(n.split('/')[-1]) or n
   vf=vector_src/'assets/icons'/f'{vstem}.svg'
   if vf.exists():
    vdir=folder/'vectorcraft';vdir.mkdir(exist_ok=True)
    shutil.copy2(vf,vdir/vf.name)
    asset_map.setdefault(f'assets/vectorcraft/{vf.name}',[]).append(key)
    reference_rows.append(('vectorcraft',vf.name,key))
    return vf.read_text().replace('currentColor','{STROKE}')
  if not file.exists():
   # rien dans le projet de référence : icône dessinée pour MasterPaint (custom/, à part)
   for c in (n, CUSTOM_ALIAS.get(n,''), n.removeprefix('tool-')):
    cf=custom_dir/f'{c}.svg'
    if c and cf.exists():
     asset_map.setdefault(f'custom/{kind}/{cf.name}',[]).append(key)
     custom_keys.append(key)
     return cf.read_text().split('-->',1)[-1].strip().replace('currentColor','{STROKE}')
   return None
  asset_map.setdefault(f'assets/{kind}/{file.name}',[]).append(key)
  reference_rows.append((kind,file.name,key))
  return file.read_text().replace('currentColor','{STROKE}') if ext=='svg' else 'data:image/png;base64,'+base64.b64encode(file.read_bytes()).decode()
 for n in mpnames:
  a=asset(n,'mp/'+n)
  if a:icons['mp/'+n]=a
 for n in sprites:
  a=asset(n,'sprite/'+n)
  if a:icons['sprite/'+n]=a
 for i,n in enumerate(tools):
  a=asset(n,'tool/'+str(i))
  if a:icons['tool/'+str(i)]=a
 for _,n,_ in fa:
  a=asset(n,'fa/'+n)
  if a:icons['fa/'+n]=a
 # mappings vers un fichier inexistant : erreur de saisie à corriger
 for k,v in mapping.items():
  if not (src/'assets/icons'/f'{v}.{ext}').exists(): print('  FICHIER ABSENT',kind,k,'->',v)
 total=len(mpnames)+len(sprites)+len(tools)+len(fa)
 print(kind,f'{len(icons)}/{total} icônes couvertes, dont {len(custom_keys)} dessinées pour MasterPaint')
 notices='\n\n'.join(f.name+'\n'+f.read_text() for f in folder.iterdir() if f.is_file() and f.suffix not in ['.svg','.png'])
 if (folder/'vectorcraft').is_dir(): notices+='\n\n'+'\n\n'.join('vectorcraft/'+f.name+'\n'+f.read_text() for f in (folder/'vectorcraft').iterdir() if f.is_file() and f.suffix!='.svg')
 data={'format':'masterpaint-icon-pack','version':2,'name':'PaintJS' if kind=='paintdotjs' else 'PhotoCraft','author':'Paint.NET contributors; PaintJS by LabyStudio' if kind=='paintdotjs' else 'ArtCraft (PhotoCraft, VectorCraft) / Lucide contributors — storytold','source':'https://paintjs.net/; https://github.com/LabyStudio/paintdotjs' if kind=='paintdotjs' else 'https://getartcraft.com/apps; https://github.com/storytold','origin':'https://paint.net/; https://github.com/rivy/OpenPDN' if kind=='paintdotjs' else 'https://github.com/storytold/photocraft','revision':(subprocess.run(['git','-C',str(src),'rev-parse','HEAD'],text=True,capture_output=True).stdout.strip() or 'archive'),'license':notices,'icons':icons,'assetMap':asset_map,'assets':sorted(asset_map.keys())}
 data['customIcons']=custom_keys
 data['customNote']='Icônes de custom/ : dessinées pour MasterPaint (polocrafting) là où '+('paintdotjs' if kind=='paintdotjs' else 'PhotoCraft')+" n'a pas d'équivalent ; elles ne viennent pas du projet de référence."
 (dest/(kind+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)); print(kind,len(icons),'mapped,',len(list(source_dir.iterdir())),'originales')
lines=['// Copyright polocrafting; see COPYRIGHT.md. Generated from the visible icon-packs source folders.',"pub struct ReferenceAsset { pub pack: i32, pub path: &'static str, pub bytes: &'static [u8] }",'pub const REFERENCE_ASSETS: &[ReferenceAsset] = &[']
for original in sorted((dest/'masterpaint'/'source').rglob('*.svg')):
 rel=original.relative_to(dest/'masterpaint'/'source').as_posix()
 lines.append(f'    ReferenceAsset {{ pack: 0, path: {json.dumps("assets/masterpaint/"+rel)}, bytes: include_bytes!("../icon-packs/masterpaint/source/{rel}") }},')
for kind in ('paintdotjs','photocraft'):
 for original in sorted((dest/kind/'source').glob('*')):
  lines.append(f'    ReferenceAsset {{ pack: {1 if kind=="paintdotjs" else 2}, path: {json.dumps("assets/"+kind+"/"+original.name)}, bytes: include_bytes!("../icon-packs/{kind}/source/{original.name}") }},')
for original in sorted((dest/'photocraft'/'vectorcraft').glob('*.svg')):
 lines.append(f'    ReferenceAsset {{ pack: 2, path: {json.dumps("assets/vectorcraft/"+original.name)}, bytes: include_bytes!("../icon-packs/photocraft/vectorcraft/{original.name}") }},')
for original in sorted((dest/'photocraft'/'vectorcraft').iterdir()):
 if original.is_file() and original.suffix.lower()!='.svg':
  lines.append(f'    ReferenceAsset {{ pack: 2, path: {json.dumps("licenses/vectorcraft/"+original.name)}, bytes: include_bytes!("../icon-packs/photocraft/vectorcraft/{original.name}") }},')
for kind in ('paintdotjs','photocraft'):
 for original in sorted((dest/kind/'custom').glob('*')):
  lines.append(f'    ReferenceAsset {{ pack: {1 if kind=="paintdotjs" else 2}, path: {json.dumps("custom/"+kind+"/"+original.name)}, bytes: include_bytes!("../icon-packs/{kind}/custom/{original.name}") }},')
for kind in ('paintdotjs','photocraft'):
 for original in sorted((dest/kind).iterdir()):
  if original.is_file() and (original.name.startswith(('LICENSE','NOTICE','ATTRIBUTION','CREDITS')) or original.suffix.lower()=='.md'):
   lines.append(f'    ReferenceAsset {{ pack: {1 if kind=="paintdotjs" else 2}, path: {json.dumps("licenses/"+kind+"/"+original.name)}, bytes: include_bytes!("../icon-packs/{kind}/{original.name}") }},')
lines.extend(['];','pub const REFERENCE_FILE_MAP: &[(&str, &str)] = &['])
for kind,name,key in sorted(set(reference_rows)):
 lines.append(f'    ({json.dumps("assets/"+kind+"/"+name)}, {json.dumps(key)}),')
lines.extend(['];',''])
(root/'rust/masterpaint-ui/src/reference_assets_gen.rs').write_text('\n'.join(lines))
