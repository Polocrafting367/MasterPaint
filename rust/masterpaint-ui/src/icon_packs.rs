// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md.
//! Packs autonomes : JSON v1/v2, import d'images par nom, archives ZIP avec ressources.
use std::{cell::{Cell,RefCell}, collections::BTreeMap, io::Read};
use serde_json::{json, Value};
use slint::{Image, Rgba8Pixel, SharedPixelBuffer};
use base64::Engine;
use image::GenericImageView;
use crate::reference_assets_gen::{REFERENCE_ASSETS, REFERENCE_FILE_MAP};
thread_local! {
    static CUSTOM: RefCell<Vec<Value>> = const { RefCell::new(Vec::new()) };
    static CUSTOM_INDEX: Cell<usize> = const { Cell::new(0) };
    static ACTIVE: RefCell<BTreeMap<String, String>> = const { RefCell::new(BTreeMap::new()) };
    static SELECTED: Cell<i32> = const { Cell::new(0) };
    static MISSING_FALLBACK: Cell<i32> = const { Cell::new(0) };
    /// icônes du pack par nom normalisé (espaces mp, sprite, fa) : recherche des alias sans
    /// parcourir tout le pack à chaque icône
    static ACTIVE_NORM: RefCell<std::collections::HashMap<String, String>> = RefCell::new(std::collections::HashMap::new());
}
const PAINT: &str = include_str!("../icon-packs/paintdotjs.json");
const PHOTO: &str = include_str!("../icon-packs/photocraft.json");
thread_local! {
    /// packs intégrés lus une seule fois (≈ 400 Ko de JSON chacun : relus à chaque choix de pack
    /// ou ouverture de la page Icônes, avant)
    static BUILTIN: std::cell::OnceCell<(Value, Value)> = const { std::cell::OnceCell::new() };
    /// icônes déjà rendues : (source, taille, couleurs) → image. Repasser d'une interface à
    /// l'autre ne redécode plus des centaines de PNG.
    static RENDERED: RefCell<std::collections::HashMap<(u64, u32, u64), Image>> = RefCell::new(std::collections::HashMap::new());
}
fn builtin(index: i32) -> Value {
    BUILTIN.with(|b| {
        let (paint, photo) = b.get_or_init(|| (serde_json::from_str(PAINT).unwrap_or(Value::Null), serde_json::from_str(PHOTO).unwrap_or(Value::Null)));
        if index == 1 { paint.clone() } else { photo.clone() }
    })
}
fn hash_of<T: std::hash::Hash + ?Sized>(v: &T) -> u64 {
    use std::hash::Hasher;
    let mut h = std::collections::hash_map::DefaultHasher::new();
    v.hash(&mut h);
    h.finish()
}
pub fn custom() -> Value { CUSTOM.with(|v|v.borrow().get(CUSTOM_INDEX.with(Cell::get)).cloned().unwrap_or(Value::Null)) }
pub fn all_custom() -> Value { CUSTOM.with(|v|json!(v.borrow().clone())) }
pub fn active_custom_index() -> usize { CUSTOM_INDEX.with(Cell::get) }
pub fn select_custom(i:usize) { let n=CUSTOM.with(|v|v.borrow().len()); if n>0 {CUSTOM_INDEX.with(|x|x.set(i.min(n-1)));} }
pub fn restore_all(all:Value,legacy:Value,index:usize) {
    let mut packs=Vec::new();
    if let Some(a)=all.as_array(){for v in a {if validate(v).is_ok(){packs.push(v.clone());}}}
    else if legacy.is_object()&&validate(&legacy).is_ok(){packs.push(legacy);}
    CUSTOM.with(|v|*v.borrow_mut()=packs);
    select_custom(index);
}
pub fn delete_custom(i:usize)->bool {
    let mut deleted=false;
    CUSTOM.with(|v|{let mut v=v.borrow_mut();if i<v.len(){v.remove(i);deleted=true;}});
    if deleted {let n=CUSTOM.with(|v|v.borrow().len());let active=CUSTOM_INDEX.with(Cell::get);CUSTOM_INDEX.with(|x|x.set(if n==0{0}else if active>i{active-1}else{active.min(n-1)}));}
    deleted
}
pub fn select(index: i32) {
    SELECTED.with(|v|v.set(index));
    let v = match index { 1 | 2 => builtin(index), 3 => custom(), _ => Value::Null };
    ACTIVE.with(|a| *a.borrow_mut() = v["icons"].as_object().map(|m| m.iter().filter_map(|(k,v)| Some((k.clone(),v.as_str()?.to_owned()))).collect()).unwrap_or_default());
    ACTIVE_NORM.with(|n| {
        let mut n=n.borrow_mut(); n.clear();
        ACTIVE.with(|a| for (k,v) in a.borrow().iter() {
            if let Some((ns,name))=k.split_once('/') { if matches!(ns,"mp"|"sprite"|"fa") { n.entry(norm(name)).or_insert_with(||v.clone()); } }
        });
    });
    crate::theme::invalidate_icons();
}
/// Pack affiché : 0 MasterPaint, 1 PaintJS, 2 PhotoCraft, 3 importé.
pub fn selected() -> i32 { SELECTED.with(Cell::get) }
pub fn source(key: &str) -> Option<String> { ACTIVE.with(|a| a.borrow().get(key).cloned()) }
pub fn catalog(selected:i32)->Vec<crate::IconPackCard>{
    let colors=["#30343b","#1685d1","#cce8ff","#ffffff"];
    let mut rows=Vec::new();
    // vignette = l'outil Pinceau de chaque pack, comme PaintJS et PhotoCraft
    let mp_preview=crate::icons_gen::ICON_NAMES.iter().position(|n|*n=="tool-brush").and_then(|i|render(crate::icons_gen::ICONS[i],40,colors)).unwrap_or_default();
    let total=crate::mpicons_gen::MP_ICONS.len()+crate::sprite_gen::SPRITE.len()+crate::icons_gen::ICONS.len();
    rows.push(crate::IconPackCard{id:"builtin:0".into(),name:"MasterPaint".into(),details:format!("Pack complet · {total} icônes · polocrafting").into(),source_url:"https://github.com/Polocrafting367/MasterPaint".into(),preview:mp_preview,selected:selected==0,imported:false});
    for (i,name,details,src) in [(1,"PaintJS","Paint.NET · LabyStudio",PAINT),(2,"PhotoCraft","Photoshop · storytold",PHOTO)] {
        let _ = src;
        let p:Value=builtin(i);
        let preview=p["icons"]["sprite/tool-brush"].as_str().or_else(||p["icons"]["mp/brush"].as_str()).or_else(||p["icons"]["mp/new"].as_str()).or_else(||p["icons"].as_object().and_then(|m|m.values().find_map(Value::as_str))).and_then(|s|render(s,40,colors)).unwrap_or_default();
        let (have,total)=pack_counts(&p);
        let details=format!("{details} · {have} / {total} icônes");
        let source=if i==1{"https://github.com/LabyStudio/paintdotjs"}else{"https://github.com/storytold/photocraft"};
        rows.push(crate::IconPackCard{id:format!("builtin:{i}").into(),name:name.into(),details:details.into(),source_url:source.into(),preview,selected:selected==i,imported:false});
    }
    CUSTOM.with(|packs|for (i,p) in packs.borrow().iter().enumerate(){
        let preview=p["icons"]["sprite/tool-brush"].as_str().or_else(||p["icons"]["mp/brush"].as_str()).or_else(||p["icons"].as_object().and_then(|m|m.values().find_map(Value::as_str))).and_then(|s|render(s,40,colors)).or_else(||p["library"].as_array().and_then(|a|a.first()).and_then(|x|x["data"].as_str()).and_then(|s|render(s,40,colors))).unwrap_or_default();
        let author=p["author"].as_str().unwrap_or("Source non déclarée");
        let source=p["source"].as_str().filter(|s|s.contains("github.com/")).unwrap_or("");
        rows.push(crate::IconPackCard{id:format!("custom:{i}").into(),name:p["name"].as_str().unwrap_or("Pack importé").into(),details:{let (have,total)=pack_counts(p);format!("{author} · {have} / {total} icônes")}.into(),source_url:source.into(),preview,selected:selected==3&&active_custom_index()==i,imported:true});
    });
    rows
}
pub fn github_source(id:&str)->Option<String>{
    let (kind,index)=id.split_once(':')?;
    let index=index.parse::<usize>().ok()?;
    let source=match kind{"builtin"=>match index{0=>Some("https://github.com/Polocrafting367/MasterPaint".to_owned()),1=>Some("https://github.com/LabyStudio/paintdotjs".to_owned()),2=>Some("https://github.com/storytold/photocraft".to_owned()),_=>None},"custom"=>CUSTOM.with(|v|v.borrow().get(index).and_then(|p|p["source"].as_str().map(str::to_owned))),_=>None}?;
    source.split(|c:char|c==';'||c.is_whitespace()).find(|s|s.starts_with("https://github.com/")).map(str::to_owned)
}

pub fn set_missing_fallback(value:i32) { MISSING_FALLBACK.with(|v|v.set(value.clamp(0,1))); crate::theme::invalidate_icons(); }
/// Clés des icônes d'interface : outils, ruban, menus maison (pas les glyphes Font Awesome des
/// menus, que MasterPaint dessine toujours).
fn interface_keys()->impl Iterator<Item=String> {
    crate::mpicons_gen::MP_ICONS.iter().map(|(n,_)|format!("mp/{n}"))
        .chain(crate::sprite_gen::SPRITE.iter().map(|(n,_)|format!("sprite/{n}")))
        .chain((0..crate::icons_gen::ICONS.len()).map(|i|format!("tool/{i}")))
}
/// Icônes d'interface sans équivalent dans le pack choisi (0 pour MasterPaint).
pub fn missing_count()->usize {
    if SELECTED.with(Cell::get)==0 {return 0;}
    ACTIVE.with(|a| missing_in(&a.borrow()))
}
fn missing_in(a:&BTreeMap<String,String>)->usize {
    let names:std::collections::HashSet<String>=a.keys().filter_map(|k|k.split_once('/')).filter(|(ns,_)|matches!(*ns,"mp"|"sprite"|"fa")).map(|(_,n)|norm(n)).collect();
    interface_keys().filter(|key| {
        if a.contains_key(key) {return false;}
        let canonical=key.strip_prefix("tool/").and_then(|n|n.parse::<usize>().ok()).and_then(|i|crate::icons_gen::ICON_NAMES.get(i)).copied().unwrap_or_else(||key.split_once('/').map(|(_,n)|n).unwrap_or(key));
        !semantic_aliases(canonical).iter().any(|alias| names.contains(alias))
    }).count()
}
/// Icônes d'interface couvertes par un pack, sur le total (sans le sélectionner).
fn pack_counts(p:&Value)->(usize,usize) {
    let map:BTreeMap<String,String>=p["icons"].as_object().map(|m| m.iter().filter_map(|(k,v)| Some((k.clone(),v.as_str()?.to_owned()))).collect()).unwrap_or_default();
    let total=interface_keys().count();
    (total-missing_in(&map),total)
}
/// Glyphe Font Awesome de l'interface redessiné au style MasterPaint (logos de marques exceptés).
fn mp_fa(key:&str,size:u32,colors:[&str;4])->Option<Image>{
    let n=key.strip_prefix("fa/")?;
    crate::mp_fa_gen::MP_FA.iter().find(|(k,_)|*k==n).and_then(|(_,s)|render(s,size,colors))
}
pub fn render_override(key:&str,size:u32,colors:[&str;4])->Option<Image>{
    // pack MasterPaint : complet, y compris les glyphes des menus (plus de Font Awesome)
    if SELECTED.with(Cell::get)==0 { return mp_fa(key,size,colors); }
    if let Some(src)=source(key){return render(&src,size,colors)}
    let canonical=key.strip_prefix("tool/").and_then(|n|n.parse::<usize>().ok()).and_then(|i|crate::icons_gen::ICON_NAMES.get(i)).copied().unwrap_or_else(||key.split_once('/').map(|(_,n)|n).unwrap_or(key));
    let aliases=semantic_aliases(canonical);
    // Packs use different namespaces and names for equivalent actions. Search every alias
    // across supported project namespaces before falling back to MasterPaint/Font Awesome.
    for alias in &aliases {
        if let Some(src)=ACTIVE_NORM.with(|n|n.borrow().get(alias).cloned()) {return render(&src,size,colors)}
    }
    if MISSING_FALLBACK.with(|v|v.get())==0{return mp_fa(key,size,colors)}
    let fa_alias=aliases.iter().find(|a|crate::fa_svg_gen::FA_SVG.iter().any(|(n,_)|norm(n)==norm(a)))?;
    crate::fa_svg_gen::FA_SVG.iter().find(|(n,_)|norm(n)==norm(fa_alias)).and_then(|(_,s)|render(s,size,colors))
}
fn semantic_aliases(name:&str)->Vec<String>{
    let base=norm(name.trim_start_matches("tool-"));
    let group:&[&str]=match base.as_str(){
        "deform"|"warp"|"transform"|"movetransform"=>&["deform","warp","transform","arrows-up-down-left-right","up-down-left-right"],
        "merge"|"mergedown"|"flatten"|"combine"=>&["merge","merge-down","layer-merge","object-group","layer-group"],
        "plus"|"zoomin"|"add"|"increase"|"layeradd"=>&["plus","zoom-in","add","increase","layer-add","square-plus"],
        "minus"|"zoomout"|"decrease"=>&["minus","zoom-out","decrease","square-minus"],
        "up"|"layerup"|"raise"|"moveup"=>&["up","layer-up","raise","move-up","arrow-up","chevron-up"],
        "down"|"layerdown"|"lower"|"movedown"=>&["down","layer-down","lower","move-down","arrow-down","chevron-down"],
        "directselect"|"select"|"selection"=>&["direct-select","select","selection","pointer","cursor"],
        "new"|"newfile"=>&["new","new-file","file-circle-plus","file-plus"],
        "open"|"openfile"=>&["open","open-file","folder-open","folder"],
        "save"|"savefile"=>&["save","save-file","floppy-disk"],
        "export"|"exportfile"=>&["export","export-file","file-export","share"],
        "undo"=>&["undo","rotate-left","arrow-rotate-left"],
        "redo"=>&["redo","rotate-right","arrow-rotate-right"],
        "zoom"=>&["zoom","magnifying-glass","search"],
        "zoomfit"|"fit"=>&["zoom-fit","fit","expand","maximize"],
        "cut"=>&["cut","scissors"],
        "copy"=>&["copy","clone","copy-alt"],
        "paste"=>&["paste","clipboard","clipboard-check"],
        "delete"|"trash"|"layerdelete"=>&["delete","trash","trash-can","layer-delete"],
        "duplicate"|"dup"|"layerdup"|"layerduplicate"=>&["duplicate","dup","layer-dup","layer-duplicate","clone","copy"],
        "resize"|"imagesize"=>&["resize","image-size","up-right-and-down-left-from-center","maximize"],
        "canvassize"=>&["canvas-size","crop-simple","expand"],
        "layers"|"layerpanel"=>&["layers","layer-panel","layer-group"],
        "history"|"historypanel"=>&["history","history-panel","clock-rotate-left"],
        "line"=>&["line","slash","minus"],
        "wand"|"magicwand"=>&["wand","magic-wand","magicwand","wand-magic-sparkles"],
        "magneticlasso"|"lasso"=>&["magnetic-lasso","lasso","poly-lasso"],
        "polylasso"|"polygonlasso"=>&["poly-lasso","polygon-lasso","lasso"],
        "eyedropper"|"colorpicker"=>&["eyedropper","color-picker","colorpicker","eye-dropper"],
        "brush"|"paintbrush"=>&["brush","paintbrush"],
        "bucket"|"paintbucket"|"fill"=>&["bucket","paint-bucket","fill","fill-drip"],
        "selall"|"selectall"=>&["sel-all","select-all","object-group"],
        "selinvert"|"invertselection"=>&["sel-invert","invert-selection","circle-half-stroke"],
        "seldeselect"|"selectnone"|"selnone"=>&["sel-deselect","select-none","sel-none","ban"],
        "selfreecorners"|"freecorners"=>&["sel-free-corners","free-corners","draw-polygon"],
        "selalignleft"|"alignleft"=>&["sel-align-left","align-left","align-left"],
        "selalignright"|"alignright"=>&["sel-align-right","align-right"],
        "selaligntop"|"aligntop"=>&["sel-align-top","align-top"],
        "selalignbottom"|"alignbottom"=>&["sel-align-bottom","align-bottom"],
        "selcenterh"|"centerh"|"aligncenter"=>&["sel-center-h","center-h","align-center"],
        "selcenterv"|"centerv"=>&["sel-center-v","center-v"],
        "selcenterboth"|"centerboth"=>&["sel-center-both","center-both"],
        "round3"|"roundedrectangle"=>&["round-3","rounded-rectangle","rectangle"],
        "shapesfamily"|"shapes"=>&["shapes-family","shapes","shape"],
        _=>&[],
    };
    let mut out=vec![base.clone()]; out.extend(group.iter().map(|s|norm(s)));
    let mut seen=std::collections::HashSet::new(); out.retain(|name|seen.insert(name.clone())); out
}

pub fn import_files(files: Vec<(String, Vec<u8>)>) -> Result<(String,usize), String> {
    if files.is_empty() { return Err("Aucun fichier sélectionné.".into()); }
    let total: usize=files.iter().map(|(_,b)|b.len()).sum();
    if total > 24*1024*1024 { return Err("La sélection dépasse 24 Mo.".into()); }
    let mut all=BTreeMap::<String,Vec<u8>>::new();
    for (n,b) in files { let n=n.replace('\\',"/"); if n.rsplit('/').next().unwrap_or("").starts_with('.') { continue; } all.insert(n,b); }
    let mut json_file=None;
    let archives:Vec<Vec<u8>>=all.iter().filter(|(n,_)|n.to_ascii_lowercase().ends_with(".zip")).map(|(_,b)|b.clone()).collect();
    for b in archives { for (p,d) in unzip(&b)? { all.entry(p).or_insert(d); } }
    for (n,b) in &all { if n.to_ascii_lowercase().ends_with(".json") { if let Ok(v)=serde_json::from_slice::<Value>(b) { if v["format"]=="masterpaint-icon-pack" { json_file=Some(v); break; } } } }
    let mut pack=json_file.unwrap_or_else(|| json!({"format":"masterpaint-icon-pack","version":2,"name":"Icônes importées","icons":{}}));
    if pack["format"]!="masterpaint-icon-pack" || !matches!(pack["version"].as_i64(),Some(1|2)) { return Err("Format JSON de pack non reconnu.".into()); }
    // export MasterPaint : `iconsPng` complète les icônes que `icons` n'a qu'en PNG
    if let Some(png)=pack.as_object_mut().and_then(|m|m.remove("iconsPng")) { if let Some(m)=png.as_object() { for (k,v) in m { if pack["icons"].get(k).is_none() { pack["icons"][k]=v.clone(); } } } }
    if !pack["icons"].is_object() { pack["icons"]=json!({}); }
    // Les descripteurs de fichiers d'un pack ZIP se résolvent par chemin complet, puis par nom.
    let mappings:Vec<(String,Vec<String>)>=pack["assetMap"].as_object().map(|m|m.iter().map(|(p,ks)|(p.clone(),ks.as_array().into_iter().flatten().filter_map(Value::as_str).map(str::to_owned).collect())).collect()).unwrap_or_default();
    for (path,keys) in mappings { if let Some(data)=lookup(&all,&path) { let value=as_icon(&path,data)?; for k in keys { if known(&k) { pack["icons"][k]=json!(value); } } } }
    let refs:Vec<(String,String)>=pack["icons"].as_object().map(|m|m.iter().filter_map(|(k,v)|{let p=v.as_str()?;(!p.trim_start().starts_with("<svg")&&!p.starts_with("data:image/")).then(||(k.clone(),p.to_owned()))}).collect()).unwrap_or_default();
    for (key,path) in refs { if known(&key) { if let Some(data)=lookup(&all,&path) { pack["icons"][key]=json!(as_icon(&path,data)?); } } }
    // Import d'images seules : le nom de fichier doit correspondre à un identifiant ou alias.
    let mut library=Vec::new();
    for (path,data) in &all {
        let lower=path.to_ascii_lowercase();
        if !(lower.ends_with(".png")||lower.ends_with(".jpg")||lower.ends_with(".jpeg")||lower.ends_with(".svg")) { continue; }
        let Some(value)=as_icon(path,data).ok() else { continue };
        let stem=path.rsplit('/').next().unwrap_or(path).rsplit_once('.').map(|x|x.0).unwrap_or(path);
        let keys=keys_for_name(stem);
        if keys.is_empty() { library.push(json!({"name":path,"data":value})); }
        for key in keys { if known(&key) { pack["icons"][key]=json!(value); } }
    }
    if !library.is_empty() { pack["library"]=json!(library); }
    if pack["name"].as_str().is_none() { pack["name"]=json!("Icônes importées"); }
    pack["version"]=json!(2);
    // pack exporté complet : seules les icônes qui diffèrent de MasterPaint sont gardées (le
    // reste se retrouve tout seul, et les réglages restent légers)
    if let Some(m)=pack["icons"].as_object_mut() { m.retain(|k,v| v.as_str().is_none_or(|src| builtin_source(k)!=Some(src))); }
    validate(&pack)?;
    let name=pack["name"].as_str().unwrap_or("Icônes importées").to_owned();
    let index=CUSTOM.with(|c|{let mut c=c.borrow_mut();c.push(pack);c.len()-1});
    select_custom(index);
    Ok((name,index))
}
fn lookup<'a>(all:&'a BTreeMap<String,Vec<u8>>, path:&str)->Option<&'a [u8]> { all.get(path).or_else(||all.iter().find(|(n,_)|n.ends_with(&format!("/{path}"))).map(|(_,b)|b)).map(Vec::as_slice) }
fn as_icon(path:&str,data:&[u8])->Result<String,String>{
    if path.to_ascii_lowercase().ends_with(".svg") { let s=std::str::from_utf8(data).map_err(|_|"SVG invalide.")?; let lo=s.to_ascii_lowercase(); if !lo.contains("<svg")||["<script","<!entity","<!doctype","<image","<foreignobject","href=","@import","url(http"].iter().any(|x|lo.contains(x)){return Err("SVG non autonome ou non sûr.".into())} return Ok(s.replace("currentColor","{STROKE}")); }
    let img=image::load_from_memory(data).map_err(|_|"Image PNG/JPG illisible.")?; let (w,h)=img.dimensions(); if w==0||h==0||w>512||h>512{return Err("Icône trop grande (512 × 512 maximum).".into())}
    let mut bytes=std::io::Cursor::new(Vec::new()); img.write_to(&mut bytes,image::ImageFormat::Png).map_err(|_|"Conversion PNG impossible.")?;
    Ok(format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(bytes.into_inner())))
}
fn norm(s:&str)->String { s.chars().filter(|c|c.is_ascii_alphanumeric()).flat_map(char::to_lowercase).collect() }
fn keys_for_name(stem:&str)->Vec<String>{
    if let Some((ns,name))=stem.split_once('_') { let key=format!("{ns}/{name}"); if known(&key) {return vec![key];} }
    let n=norm(stem); let mut out=Vec::new();
    for &(path,key) in REFERENCE_FILE_MAP { let f=path.rsplit('/').next().unwrap_or(path).rsplit_once('.').map(|x|x.0).unwrap_or(path); if norm(f)==n {out.push(key.to_owned())} }
    for (key,_) in crate::mpicons_gen::MP_ICONS { if norm(key)==n {out.push(format!("mp/{key}"));} }
    for (key,_) in crate::sprite_gen::SPRITE { if norm(key)==n {out.push(format!("sprite/{key}"));} }
    for (key,_) in crate::fa_svg_gen::FA_SVG { if norm(key)==n {out.push(format!("fa/{key}"));} }
    for (i,key) in crate::icons_gen::ICON_NAMES.iter().enumerate() {
        let stripped=key.strip_prefix("tool-").unwrap_or(key);
        if norm(key)==n || norm(stripped)==n || semantic_aliases(key).iter().any(|x|x==&n) {out.push(format!("tool/{i}"));}
    }
    let mut seen=std::collections::HashSet::new(); out.retain(|name|seen.insert(name.clone())); out
}

fn builtin_source(key:&str)->Option<&'static str> {
    if let Some(n)=key.strip_prefix("mp/"){return crate::mpicons_gen::MP_ICONS.iter().find(|(k,_)|*k==n).map(|(_,s)|*s)}
    if let Some(n)=key.strip_prefix("sprite/"){return crate::sprite_gen::SPRITE.iter().find(|(k,_)|*k==n).map(|(_,s)|*s)}
    if let Some(n)=key.strip_prefix("fa/"){return crate::mp_fa_gen::MP_FA.iter().chain(crate::fa_svg_gen::FA_SVG).find(|(k,_)|*k==n).map(|(_,s)|*s)}
    key.strip_prefix("tool/").and_then(|n|n.parse::<usize>().ok()).and_then(|i|crate::icons_gen::ICONS.get(i)).copied()
}
fn known(key:&str)->bool { if let Some(n)=key.strip_prefix("mp/"){return crate::mpicons_gen::MP_ICONS.iter().any(|(k,_)|*k==n)} if let Some(n)=key.strip_prefix("sprite/"){return crate::sprite_gen::SPRITE.iter().any(|(k,_)|*k==n)} if let Some(n)=key.strip_prefix("fa/"){return crate::fa_svg_gen::FA_SVG.iter().any(|(k,_)|*k==n)} key.strip_prefix("tool/").and_then(|n|n.parse::<usize>().ok()).is_some_and(|n|n<crate::icons_gen::ICONS.len()) }
fn validate(v:&Value)->Result<(),String>{
    if v["format"]!="masterpaint-icon-pack" || !matches!(v["version"].as_i64(),Some(1|2)){return Err("Format de pack non reconnu (MasterPaint version 1 ou 2 attendu).".into())}
    if !v["name"].as_str().is_some_and(|n|!n.trim().is_empty()&&n.len()<=120){return Err("Nom du pack manquant ou trop long.".into())}
    let icons=v["icons"].as_object().ok_or("La collection icons est absente.")?; if icons.len()>1024{return Err("Le pack dépasse 1024 icônes.".into())}
    for (k,val) in icons {if !known(k){return Err(format!("Identifiant inconnu : {k}"))}let s=val.as_str().ok_or("Icône invalide.")?;if s.len()>256*1024||render(s,24,["#202020","#0078d7","#cce8ff","#fff"]).is_none(){return Err(format!("Image illisible : {k}"))}}
    Ok(())
}
pub fn render(src:&str,size:u32,colors:[&str;4])->Option<Image>{
    let png=src.starts_with("data:image/png;base64,");
    let dark=is_dark_ui(colors);
    let key=(hash_of(src),size,if png {dark as u64} else {hash_of(&colors)});
    if let Some(img)=RENDERED.with(|c|c.borrow().get(&key).cloned()) {return Some(img)}
    let img=render_uncached(src,size,colors)?;
    RENDERED.with(|c|{let mut c=c.borrow_mut(); if c.len()>6000 {c.clear();} c.insert(key,img.clone());});
    Some(img)
}
/// Thème sombre : le trait des icônes (première couleur) est clair.
fn is_dark_ui(colors:[&str;4])->bool{
    let h=colors[0].trim_start_matches('#');
    let v=|i:usize|h.get(i..i+2).and_then(|x|u8::from_str_radix(x,16).ok()).unwrap_or(0) as u32;
    h.len()>=6 && (v(0)*299+v(2)*587+v(4)*114)/1000>128
}
/// Icône PNG gris foncé d'une seule teinte (le « T » du Texte de Paint.NET…) : invisible sur un
/// fond sombre ; inversée en thème sombre, comme le fait paintdotjs.
fn invert_if_dark_mono(img:&mut image::RgbaImage){
    let (mut n,mut lum,mut sat)=(0u64,0u64,0u64);
    for p in img.pixels().filter(|p|p[3]>96){
        let (r,g,b)=(p[0] as u64,p[1] as u64,p[2] as u64);
        n+=1; lum+=(r*299+g*587+b*114)/1000; sat+=r.max(g).max(b)-r.min(g).min(b);
    }
    if n==0 || lum/n>95 || sat/n>28 {return}
    for p in img.pixels_mut(){ for c in 0..3 { p[c]=255-p[c]; } }
}
fn render_uncached(src:&str,size:u32,colors:[&str;4])->Option<Image>{if let Some(encoded)=src.strip_prefix("data:image/png;base64,"){let bytes=base64::engine::general_purpose::STANDARD.decode(encoded).ok()?;let reader=image::ImageReader::with_format(std::io::Cursor::new(&bytes),image::ImageFormat::Png);let(w,h)=reader.into_dimensions().ok()?;if w==0||h==0||w>512||h>512{return None}let img=image::load_from_memory_with_format(&bytes,image::ImageFormat::Png).ok()?.resize(size,size,image::imageops::FilterType::Triangle).to_rgba8();let mut img=img;if is_dark_ui(colors){invert_if_dark_mono(&mut img);}return Some(Image::from_rgba8(SharedPixelBuffer::<Rgba8Pixel>::clone_from_slice(img.as_raw(),img.width(),img.height())))} let px=crate::theme::render_tpl(src,size,colors)?;let mut buf=SharedPixelBuffer::<Rgba8Pixel>::new(size,size);buf.make_mut_bytes().copy_from_slice(&px);Some(Image::from_rgba8_premultiplied(buf))}
fn crc(b:&[u8])->u32 {crc32fast::hash(b)}
fn push16(o:&mut Vec<u8>,n:u16){o.extend_from_slice(&n.to_le_bytes())} fn push32(o:&mut Vec<u8>,n:u32){o.extend_from_slice(&n.to_le_bytes())}
fn zip_store(entries:Vec<(String,Vec<u8>)>)->Vec<u8>{let mut out=Vec::new();let mut cd=Vec::new();let mut count=0u16;for(name,data)in entries{let n=name.as_bytes();if n.len()>65535||data.len()>u32::MAX as usize{continue}let c=crc(&data);let off=out.len() as u32;push32(&mut out,0x04034b50);push16(&mut out,20);push16(&mut out,0x0800);push16(&mut out,0);push16(&mut out,0);push16(&mut out,0);push32(&mut out,c);push32(&mut out,data.len() as u32);push32(&mut out,data.len() as u32);push16(&mut out,n.len() as u16);push16(&mut out,0);out.extend_from_slice(n);out.extend_from_slice(&data);push32(&mut cd,0x02014b50);push16(&mut cd,20);push16(&mut cd,20);push16(&mut cd,0x0800);push16(&mut cd,0);push16(&mut cd,0);push16(&mut cd,0);push32(&mut cd,c);push32(&mut cd,data.len() as u32);push32(&mut cd,data.len() as u32);push16(&mut cd,n.len() as u16);push16(&mut cd,0);push16(&mut cd,0);push16(&mut cd,0);push16(&mut cd,0);push32(&mut cd,0);push32(&mut cd,off);cd.extend_from_slice(n);count=count.saturating_add(1)}let cdo=out.len() as u32;out.extend(cd);let cdsize=out.len() as u32-cdo;push32(&mut out,0x06054b50);push16(&mut out,0);push16(&mut out,0);push16(&mut out,count);push16(&mut out,count);push32(&mut out,cdsize);push32(&mut out,cdo);push16(&mut out,0);out}
fn png_data_uri(src:&str)->Option<String>{
    if let Some(png)=src.strip_prefix("data:image/png;base64,"){
        let bytes=base64::engine::general_purpose::STANDARD.decode(png).ok()?;
        image::load_from_memory_with_format(&bytes,image::ImageFormat::Png).ok()?;
        return Some(src.to_owned());
    }
    let mut px=crate::theme::render_tpl(src,128,["#30343b","#1685d1","#cce8ff","#ffffff"])?;
    // resvg fournit des canaux prémultipliés ; PNG stocke des couleurs droites.
    for p in px.chunks_exact_mut(4){let a=p[3] as u16;if a==0{p[0]=0;p[1]=0;p[2]=0;}else{for c in &mut p[..3]{*c=((*c as u16*255+a/2)/a).min(255) as u8;}}}
    let rgba=image::RgbaImage::from_raw(128,128,px)?;
    let mut out=std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(rgba).write_to(&mut out,image::ImageFormat::Png).ok()?;
    Some(format!("data:image/png;base64,{}",base64::engine::general_purpose::STANDARD.encode(out.into_inner())))
}
/// Pack complet tel qu'il s'affiche : icônes du pack, puis MasterPaint pour le reste. `icons`
/// garde la source (SVG si le pack en a, sinon PNG) ; `iconsPng` donne un PNG de chaque icône,
/// converti depuis le SVG au besoin.
fn export_value(index:i32)->Value{
    let mut pack:Value=match index{1|2=>builtin(index),3=>custom(),_=>json!({"name":"MasterPaint","author":"polocrafting"})};
    let mut icons=BTreeMap::<String,String>::new();
    for(n,s)in crate::mpicons_gen::MP_ICONS{icons.insert(format!("mp/{n}"),s.to_string());}
    for(n,s)in crate::sprite_gen::SPRITE{icons.insert(format!("sprite/{n}"),s.to_string());}
    for(i,s)in crate::icons_gen::ICONS.iter().enumerate(){icons.insert(format!("tool/{i}"),s.to_string());}
    for(n,s)in crate::fa_svg_gen::FA_SVG{icons.insert(format!("fa/{n}"),s.to_string());}
    // glyphes des menus redessinés au style MasterPaint (Font Awesome : logos de marques seulement)
    for(n,s)in crate::mp_fa_gen::MP_FA{icons.insert(format!("fa/{n}"),s.to_string());}
    if let Some(overrides)=pack["icons"].as_object(){for(k,v)in overrides{if let Some(src)=v.as_str(){icons.insert(k.clone(),src.to_owned());}}}
    let mut png_icons=serde_json::Map::new();
    for (key,src) in &icons{if let Some(data)=png_data_uri(src){png_icons.insert(key.clone(),json!(data));}}
    pack["format"]=json!("masterpaint-icon-pack");pack["version"]=json!(2);
    pack["icons"]=json!(icons);
    pack["iconsPng"]=Value::Object(png_icons);
    if let Some(m)=pack.as_object_mut(){m.remove("assetMap");m.remove("assets");}
    pack["projectCredits"]=json!({"MasterPaint":"polocrafting — https://polocrafting.fr — https://github.com/Polocrafting367/MasterPaint","Paint.NET":"Rick Brewster, dotPDN — https://paint.net/ — https://github.com/rivy/OpenPDN","PaintJS":"LabyStudio — https://paintjs.net/ — https://github.com/LabyStudio/paintdotjs","PhotoCraft":"storytold — https://github.com/storytold/photocraft"});
    pack["reusePolicy"]=json!("MasterPaint: adaptations sous un autre nom; conserver les mentions et liens cliquables; pas d'exploitation financière ni de redistribution payante. Icônes personnelles polocrafting réservées à MasterPaint. Les ressources tierces conservent leurs licences.");
    pack["fallbackCredits"]=json!({"MasterPaint":"https://github.com/Polocrafting367/MasterPaint","Font Awesome":"https://fontawesome.com/license/free"});
    pack
}

pub fn export_json(index:i32)->Vec<u8>{serde_json::to_vec_pretty(&export_value(index)).unwrap_or_default()}
/// SVG lisible hors de MasterPaint : trait = couleur courante, autres teintes du thème clair.
fn standalone_svg(tpl:&str)->String{tpl.replace("{STROKE}","currentColor").replace("{ACCENT}","#1685d1").replace("{SUBTLE}","#cce8ff").replace("{BG}","#ffffff")}
fn file_stem(key:&str)->String{key.chars().map(|c|if c.is_ascii_alphanumeric()||c=='-'||c=='_' {c}else{'_'}).collect()}
/// ZIP : `masterpaint-pack.json` (réimportable tel quel), `svg/` quand la source est vectorielle,
/// `png/` pour toutes les icônes (128 px, ou taille d'origine), originaux et licences.
pub fn export_zip(index:i32)->Vec<u8>{
    let pack=export_value(index);
    let mut entries=vec![("masterpaint-pack.json".into(),serde_json::to_vec_pretty(&pack).unwrap_or_default()),("CREDITS.txt".into(),"MasterPaint — © polocrafting — https://polocrafting.fr/ — https://github.com/Polocrafting367/MasterPaint\nMasterPaint reuse: use a different project name, keep clickable credits and links, non-commercial use only. Custom polocrafting icons are reserved for MasterPaint.\nPaint.NET original project by Rick Brewster, dotPDN and contributors — https://paint.net/ — https://github.com/rivy/OpenPDN\nPaintJS by LabyStudio (separate project; interface reference and icon pack) — https://paintjs.net/ — https://github.com/LabyStudio/paintdotjs\nPhotoCraft by storytold and contributors — https://github.com/storytold/photocraft\nThird-party material retains its original license and notices.\nsvg/ : vector icons (when the source is vector) · png/ : every icon as PNG · file names = MasterPaint keys (mp_brush, tool_3…), re-importable.\n".as_bytes().to_vec())];
    // fichiers d'origine et licences du projet de référence (assets/…, licenses/…)
    for a in REFERENCE_ASSETS {if (index==1&&a.pack==1)||(index==2&&a.pack==2){entries.push((a.path.to_owned(),a.bytes.to_vec()));}}
    if let Some(icons)=pack["icons"].as_object(){
        for (key,src) in icons{if let Some(src)=src.as_str(){if !src.starts_with("data:"){entries.push((format!("svg/{}.svg",file_stem(key)),standalone_svg(src).into_bytes()));}}}
    }
    if let Some(icons)=pack["iconsPng"].as_object(){
        for (key,src) in icons{if let Some(bytes)=src.as_str().and_then(|s|s.strip_prefix("data:image/png;base64,")).and_then(|s|base64::engine::general_purpose::STANDARD.decode(s).ok()){entries.push((format!("png/{}.png",file_stem(key)),bytes));}}
    }
    if let Some(lib)=pack["library"].as_array(){for row in lib{if let(Some(name),Some(src))=(row["name"].as_str(),row["data"].as_str()){let fname=name.rsplit('/').next().unwrap_or("icon");let stem=fname.rsplit_once('.').map(|x|x.0).unwrap_or(fname);if let Some(b)=src.strip_prefix("data:image/png;base64,").and_then(|s|base64::engine::general_purpose::STANDARD.decode(s).ok()){entries.push((format!("library/{stem}.png"),b));}else{entries.push((format!("library/{stem}.svg"),standalone_svg(src).into_bytes()));if let Some(png)=png_data_uri(src).and_then(|u|u.strip_prefix("data:image/png;base64,").and_then(|s|base64::engine::general_purpose::STANDARD.decode(s).ok())){entries.push((format!("library/{stem}.png"),png));}}}}}
    zip_store(entries)
}

fn u16at(b:&[u8],p:usize)->Option<u16>{Some(u16::from_le_bytes(b.get(p..p+2)?.try_into().ok()?))} fn u32at(b:&[u8],p:usize)->Option<u32>{Some(u32::from_le_bytes(b.get(p..p+4)?.try_into().ok()?))}
fn unzip(b:&[u8])->Result<Vec<(String,Vec<u8>)>,String>{if b.len()>24*1024*1024{return Err("ZIP supérieur à 24 Mo.".into())}let start=b.len().saturating_sub(65557);let e=(start..b.len().saturating_sub(3)).rev().find(|&i|u32at(b,i)==Some(0x06054b50)).ok_or("Archive ZIP invalide.")?;let count=u16at(b,e+10).ok_or("ZIP invalide")? as usize;if count>1500{return Err("L'archive contient trop de fichiers.".into())}let mut p=u32at(b,e+16).ok_or("ZIP invalide")? as usize;let mut out=Vec::new();let mut total=0usize;for _ in 0..count{if u32at(b,p)!=Some(0x02014b50){return Err("Répertoire ZIP invalide.".into())}let method=u16at(b,p+10).ok_or("ZIP invalide")?;let crc0=u32at(b,p+16).ok_or("ZIP invalide")?;let cs=u32at(b,p+20).ok_or("ZIP invalide")? as usize;let us=u32at(b,p+24).ok_or("ZIP invalide")? as usize;let nl=u16at(b,p+28).ok_or("ZIP invalide")? as usize;let xl=u16at(b,p+30).ok_or("ZIP invalide")? as usize;let cl=u16at(b,p+32).ok_or("ZIP invalide")? as usize;let off=u32at(b,p+42).ok_or("ZIP invalide")? as usize;let name=std::str::from_utf8(b.get(p+46..p+46+nl).ok_or("Nom ZIP invalide")?).map_err(|_|"Nom ZIP invalide")?.to_owned();p+=46+nl+xl+cl;if name.starts_with('/')||name.split('/').any(|s|s=="..")||name.ends_with('/')||us>8*1024*1024{continue}total=total.saturating_add(us);if total>24*1024*1024{return Err("ZIP décompressé supérieur à 24 Mo.".into())}if u32at(b,off)!=Some(0x04034b50){continue}let ln=u16at(b,off+26).ok_or("ZIP invalide")? as usize;let lx=u16at(b,off+28).ok_or("ZIP invalide")? as usize;let data=b.get(off+30+ln+lx..off+30+ln+lx+cs).ok_or("Données ZIP tronquées")?;let mut d=Vec::with_capacity(us);match method{0=>d.extend_from_slice(data),8=>{flate2::read::DeflateDecoder::new(data).take((us+1) as u64).read_to_end(&mut d).map_err(|_|"Compression ZIP invalide")?;},_=>continue};if d.len()!=us||crc(&d)!=crc0{return Err("Données ZIP corrompues.".into())}out.push((name,d))}Ok(out)}
