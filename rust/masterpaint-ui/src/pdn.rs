// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Fichiers Paint.NET (.pdn) : en-tête « PDN3 » + XML (taille, nombre de calques), flux
//! BinaryFormatter .NET (MS-NRBF) qui décrit le document (calques, noms, visibilité, opacité,
//! mode de fusion), puis les pixels BGRA de chaque calque, « différés » : en morceaux compressés
//! en gzip, dans l'ordre où le flux a rencontré leurs blocs mémoire. Le flux est lu pour de bon
//! (et non fouillé au hasard comme la version HTML) : position exacte des pixels, propriétés des
//! calques. Format écrit par Paint.NET 3.x à 5.x (schéma ancien ou récent : les champs sont
//! retrouvés par la fin de leur nom).

use crate::editor::{Blend, Doc, Layer};
use std::collections::HashMap;
use std::io::Read;

/// Valeur d'un champ ou d'un élément de tableau.
#[derive(Clone, Debug)]
enum V {
    Null,
    Bool(bool),
    Int(i64),
    #[allow(dead_code)]
    Float(f64),
    Str(String),
    /// objet, tableau ou chaîne désignés par leur identifiant
    Ref(i32),
}

/// Objet lu : nom de classe et champs.
#[derive(Clone, Debug, Default)]
struct Obj {
    class: String,
    fields: Vec<(String, V)>,
}

impl Obj {
    /// Champ dont le nom finit par `suffix` (« Layer+properties », « properties »…).
    fn get(&self, suffix: &str) -> Option<&V> {
        self.fields.iter().find(|(n, _)| n == suffix || n.ends_with(&format!("+{suffix}"))).map(|(_, v)| v)
    }
}

/// Description d'une classe (réutilisée par les enregistrements ClassWithId).
#[derive(Clone)]
struct ClassMeta {
    name: String,
    members: Vec<String>,
    /// type de chaque membre : Some(primitif) ou None (enregistrement)
    prims: Vec<Option<u8>>,
}

struct Reader<'a> {
    b: &'a [u8],
    p: usize,
    classes: HashMap<i32, ClassMeta>,
    objs: HashMap<i32, Obj>,
    arrays: HashMap<i32, Vec<V>>,
    strings: HashMap<i32, String>,
    /// blocs mémoire (MemoryBlock), dans l'ordre du flux : leurs pixels suivent dans cet ordre
    blocks: Vec<i32>,
}

type R<T> = Result<T, String>;

impl<'a> Reader<'a> {
    fn need(&self, n: usize) -> R<()> {
        if self.p + n > self.b.len() {
            Err("flux .NET tronqué".into())
        } else {
            Ok(())
        }
    }
    fn u8(&mut self) -> R<u8> {
        self.need(1)?;
        self.p += 1;
        Ok(self.b[self.p - 1])
    }
    fn i32(&mut self) -> R<i32> {
        self.need(4)?;
        let v = i32::from_le_bytes(self.b[self.p..self.p + 4].try_into().unwrap());
        self.p += 4;
        Ok(v)
    }
    fn bytes(&mut self, n: usize) -> R<&'a [u8]> {
        self.need(n)?;
        self.p += n;
        Ok(&self.b[self.p - n..self.p])
    }
    /// chaîne précédée de sa longueur (entier 7 bits par octet)
    fn lps(&mut self) -> R<String> {
        let mut len = 0usize;
        for shift in (0..35).step_by(7) {
            let c = self.u8()?;
            len |= ((c & 0x7f) as usize) << shift;
            if c & 0x80 == 0 {
                break;
            }
        }
        Ok(String::from_utf8_lossy(self.bytes(len)?).into_owned())
    }

    /// Valeur d'un type primitif (PrimitiveTypeEnum).
    fn prim(&mut self, t: u8) -> R<V> {
        let le = |s: &[u8]| s.iter().rev().fold(0u64, |a, b| a << 8 | *b as u64);
        Ok(match t {
            1 => V::Bool(self.u8()? != 0),
            2 => V::Int(self.u8()? as i64),
            3 => {
                // caractère UTF-8 : 1 à 4 octets selon le premier
                let c = self.u8()?;
                let extra = if c >= 0xf0 { 3 } else if c >= 0xe0 { 2 } else if c >= 0xc0 { 1 } else { 0 };
                self.bytes(extra)?;
                V::Int(c as i64)
            }
            5 => V::Str(self.lps()?),
            6 => V::Float(f64::from_le_bytes(self.bytes(8)?.try_into().unwrap())),
            7 => V::Int(i16::from_le_bytes(self.bytes(2)?.try_into().unwrap()) as i64),
            8 => V::Int(self.i32()? as i64),
            9 | 12 | 13 => V::Int(i64::from_le_bytes(self.bytes(8)?.try_into().unwrap())),
            10 => V::Int(self.u8()? as i8 as i64),
            11 => V::Float(f32::from_le_bytes(self.bytes(4)?.try_into().unwrap()) as f64),
            14 => V::Int(le(self.bytes(2)?) as i64),
            15 => V::Int(le(self.bytes(4)?) as i64),
            16 => V::Int(le(self.bytes(8)?) as i64),
            17 => V::Null,
            18 => V::Str(self.lps()?),
            _ => return Err(format!("type primitif .NET inconnu ({t})")),
        })
    }

    /// Informations de type des membres (MemberTypeInfo) : Some(primitif) ou None.
    fn member_types(&mut self, n: usize) -> R<Vec<Option<u8>>> {
        let kinds: Vec<u8> = (0..n).map(|_| self.u8()).collect::<R<_>>()?;
        let mut out = Vec::with_capacity(n);
        for k in kinds {
            out.push(match k {
                0 => Some(self.u8()?),
                3 => {
                    self.lps()?;
                    None
                }
                4 => {
                    self.lps()?;
                    self.i32()?;
                    None
                }
                7 => {
                    self.u8()?;
                    None
                }
                _ => None,
            });
        }
        Ok(out)
    }

    /// ClassInfo : identifiant, nom, membres.
    fn class_info(&mut self) -> R<(i32, String, Vec<String>)> {
        let id = self.i32()?;
        let name = self.lps()?;
        let n = self.i32()?.max(0) as usize;
        let members = (0..n).map(|_| self.lps()).collect::<R<_>>()?;
        Ok((id, name, members))
    }

    /// Valeurs des membres d'un objet, puis enregistrement de l'objet.
    fn object_values(&mut self, id: i32, meta: &ClassMeta) -> R<()> {
        let mut fields = Vec::with_capacity(meta.members.len());
        for (i, name) in meta.members.iter().enumerate() {
            let v = match meta.prims.get(i).copied().flatten() {
                Some(t) => self.prim(t)?,
                None => self.value()?,
            };
            fields.push((name.clone(), v));
        }
        if meta.name.ends_with("MemoryBlock") {
            self.blocks.push(id);
        }
        self.objs.insert(id, Obj { class: meta.name.clone(), fields });
        Ok(())
    }

    /// Valeur sous forme d'enregistrement (membre non primitif ou élément de tableau) ; les
    /// objets en ligne sont rangés et désignés par leur identifiant.
    fn value(&mut self) -> R<V> {
        match self.record()? {
            Rec::Value(v) => Ok(v),
            Rec::Nulls(_) => Ok(V::Null),
            Rec::End => Err("fin de flux .NET inattendue".into()),
        }
    }

    /// Éléments d'un tableau d'enregistrements (avec les suites de « null »).
    fn record_elements(&mut self, n: usize) -> R<Vec<V>> {
        let mut out = Vec::with_capacity(n.min(1 << 16));
        while out.len() < n {
            match self.record()? {
                Rec::Value(v) => out.push(v),
                Rec::Nulls(k) => out.extend(std::iter::repeat_n(V::Null, k)),
                Rec::End => return Err("fin de flux .NET dans un tableau".into()),
            }
        }
        Ok(out)
    }

    /// Un enregistrement du flux.
    fn record(&mut self) -> R<Rec> {
        let t = self.u8()?;
        Ok(match t {
            // en-tête du flux, bibliothèque : rien à garder
            0 => {
                self.bytes(16)?;
                return self.record();
            }
            12 => {
                self.i32()?;
                self.lps()?;
                return self.record();
            }
            1 => {
                let id = self.i32()?;
                let meta_id = self.i32()?;
                let meta = self.classes.get(&meta_id).cloned().ok_or("classe .NET inconnue (ClassWithId)")?;
                self.object_values(id, &meta)?;
                Rec::Value(V::Ref(id))
            }
            2 | 3 => {
                // membres sans types : chaque valeur est un enregistrement
                let (id, name, members) = self.class_info()?;
                if t == 3 {
                    self.i32()?;
                }
                let meta = ClassMeta { name, prims: vec![None; members.len()], members };
                self.classes.insert(id, meta.clone());
                self.object_values(id, &meta)?;
                Rec::Value(V::Ref(id))
            }
            4 | 5 => {
                let (id, name, members) = self.class_info()?;
                let prims = self.member_types(members.len())?;
                if t == 5 {
                    self.i32()?;
                }
                let meta = ClassMeta { name, members, prims };
                self.classes.insert(id, meta.clone());
                self.object_values(id, &meta)?;
                Rec::Value(V::Ref(id))
            }
            6 => {
                let id = self.i32()?;
                let s = self.lps()?;
                self.strings.insert(id, s.clone());
                Rec::Value(V::Str(s))
            }
            7 => {
                let id = self.i32()?;
                let kind = self.u8()?;
                let rank = self.i32()?.max(0) as usize;
                let lens: Vec<i32> = (0..rank).map(|_| self.i32()).collect::<R<_>>()?;
                if matches!(kind, 3..=5) {
                    for _ in 0..rank {
                        self.i32()?;
                    }
                }
                let ty = self.member_types(1)?;
                let n = lens.iter().map(|&l| l.max(0) as usize).product::<usize>();
                let items = match ty[0] {
                    Some(p) => (0..n).map(|_| self.prim(p)).collect::<R<_>>()?,
                    None => self.record_elements(n)?,
                };
                self.arrays.insert(id, items);
                Rec::Value(V::Ref(id))
            }
            8 => {
                let p = self.u8()?;
                Rec::Value(self.prim(p)?)
            }
            9 => Rec::Value(V::Ref(self.i32()?)),
            10 => Rec::Value(V::Null),
            11 => Rec::End,
            13 => Rec::Nulls(self.u8()? as usize),
            14 => Rec::Nulls(self.i32()?.max(0) as usize),
            15 => {
                let id = self.i32()?;
                let n = self.i32()?.max(0) as usize;
                let p = self.u8()?;
                // tableau d'octets (gros) : non gardé élément par élément
                if p == 2 {
                    self.bytes(n)?;
                    self.arrays.insert(id, Vec::new());
                } else {
                    let items = (0..n).map(|_| self.prim(p)).collect::<R<_>>()?;
                    self.arrays.insert(id, items);
                }
                Rec::Value(V::Ref(id))
            }
            16 | 17 => {
                let id = self.i32()?;
                let n = self.i32()?.max(0) as usize;
                let items = self.record_elements(n)?;
                self.arrays.insert(id, items);
                Rec::Value(V::Ref(id))
            }
            _ => return Err(format!("enregistrement .NET inconnu ({t}) à l'octet {}", self.p - 1)),
        })
    }
}

enum Rec {
    Value(V),
    Nulls(usize),
    End,
}

fn gunzip(data: &[u8]) -> Option<Vec<u8>> {
    let mut out = Vec::new();
    flate2::read::GzDecoder::new(data).read_to_end(&mut out).ok()?;
    Some(out)
}

/// Mode de fusion Paint.NET (nom de la classe d'opération) → mode MasterPaint.
fn blend_of(class: &str) -> Blend {
    let c = class.rsplit(['+', '.']).next().unwrap_or("").to_ascii_lowercase();
    match c.trim_end_matches("blendop") {
        "multiply" => Blend::Multiply,
        "screen" => Blend::Screen,
        "overlay" => Blend::Overlay,
        "darken" => Blend::Darken,
        "lighten" => Blend::Lighten,
        "colordodge" | "additive" | "glow" => Blend::ColorDodge,
        "colorburn" | "reflect" => Blend::ColorBurn,
        "difference" | "negation" | "xor" => Blend::Difference,
        _ => Blend::Normal,
    }
}

/// Lit un fichier .pdn : un document (calques de bas en haut) et les remarques éventuelles.
pub fn load(name: &str, bytes: &[u8]) -> Result<(Doc, Vec<String>), String> {
    // Paint.NET 2.x : tout le fichier en gzip
    let owned;
    let bytes = if bytes.starts_with(&[0x1f, 0x8b]) {
        owned = gunzip(bytes).ok_or("fichier .pdn ancien illisible")?;
        &owned[..]
    } else {
        bytes
    };
    if !bytes.starts_with(b"PDN3") || bytes.len() < 8 {
        return Err(format!("« {name} » n'est pas un fichier Paint.NET (.pdn)"));
    }
    let xml_len = bytes[4] as usize | (bytes[5] as usize) << 8 | (bytes[6] as usize) << 16;
    let xml = String::from_utf8_lossy(bytes.get(7..7 + xml_len).ok_or("en-tête .pdn tronqué")?).into_owned();
    let attr = |k: &str| -> Option<usize> {
        let at = xml.find(&format!("{k}=\""))? + k.len() + 2;
        xml[at..].split('"').next()?.trim().parse().ok()
    };
    let (w, h) = (attr("width").unwrap_or(0), attr("height").unwrap_or(0));
    if w == 0 || h == 0 || w > 32768 || h > 32768 {
        return Err("taille d'image .pdn invalide".into());
    }
    let mut p = 7 + xml_len;
    if bytes.get(p..p + 2) == Some(&[0, 1]) {
        p += 2;
    }
    // variante de MasterPaint HTML (« MPDN ») : calques BGRA gzip, sans flux .NET
    if bytes.get(p..p + 4) == Some(b"MPDN") {
        return load_mpdn(name, &bytes[p..], w, h);
    }
    let mut r = Reader { b: bytes, p, classes: HashMap::new(), objs: HashMap::new(), arrays: HashMap::new(), strings: HashMap::new(), blocks: Vec::new() };
    loop {
        match r.record()? {
            Rec::End => break,
            _ => continue,
        }
    }
    // pixels différés : un bloc par MemoryBlock « deferred », dans l'ordre du flux
    let mut pixels: HashMap<i32, Vec<u8>> = HashMap::new();
    let mut pos = r.p;
    for &id in &r.blocks {
        let Some(o) = r.objs.get(&id) else { continue };
        if !matches!(o.get("deferred"), Some(V::Bool(true))) {
            continue;
        }
        let len = match o.get("length64").or(o.get("length")) {
            Some(V::Int(n)) => *n as usize,
            _ => continue,
        };
        let fv = *bytes.get(pos).ok_or("pixels .pdn tronqués")?;
        let chunk = u32::from_be_bytes(bytes.get(pos + 1..pos + 5).ok_or("pixels .pdn tronqués")?.try_into().unwrap()) as usize;
        pos += 5;
        if chunk == 0 {
            return Err("bloc de pixels .pdn invalide".into());
        }
        let mut out = vec![0u8; len];
        // morceaux, pas forcément dans l'ordre (écriture parallèle de Paint.NET)
        for _ in 0..len.div_ceil(chunk) {
            let num = u32::from_be_bytes(bytes.get(pos..pos + 4).ok_or("morceau .pdn tronqué")?.try_into().unwrap()) as usize;
            let size = u32::from_be_bytes(bytes.get(pos + 4..pos + 8).ok_or("morceau .pdn tronqué")?.try_into().unwrap()) as usize;
            let data = bytes.get(pos + 8..pos + 8 + size).ok_or("morceau .pdn tronqué")?;
            pos += 8 + size;
            let raw = if fv == 0 { gunzip(data).ok_or("morceau .pdn illisible (gzip)")? } else { data.to_vec() };
            let at = num * chunk;
            if at < len {
                let n = raw.len().min(len - at);
                out[at..at + n].copy_from_slice(&raw[..n]);
            }
        }
        pixels.insert(id, out);
    }
    // document → liste des calques → calques bitmap
    let doc_obj = r.objs.values().find(|o| o.class.ends_with("PaintDotNet.Document")).ok_or("document .pdn introuvable")?;
    let list_id = match doc_obj.get("layers") {
        Some(V::Ref(i)) => *i,
        _ => return Err("calques .pdn introuvables".into()),
    };
    let list = r.objs.get(&list_id).ok_or("liste des calques .pdn introuvable")?;
    let items_id = match list.get("_items") {
        Some(V::Ref(i)) => *i,
        _ => return Err("calques .pdn introuvables".into()),
    };
    let count = match list.get("_size") {
        Some(V::Int(n)) => *n as usize,
        _ => usize::MAX,
    };
    let items = r.arrays.get(&items_id).cloned().unwrap_or_default();
    let obj_of = |v: Option<&V>| match v {
        Some(V::Ref(i)) => r.objs.get(i),
        _ => None,
    };
    let mut notes = Vec::new();
    let mut doc = Doc::new(w, h, [0, 0, 0, 0], name);
    doc.layers.clear();
    for item in items.iter().take(count) {
        let Some(layer) = obj_of(Some(item)) else { continue };
        // Layer+properties : nom, visibilité, opacité ; properties (BitmapLayer) : fusion
        let lp = layer.fields.iter().find(|(n, _)| n.ends_with("Layer+properties")).map(|(_, v)| v).and_then(|v| obj_of(Some(v)));
        let bp = layer.fields.iter().find(|(n, _)| n == "properties").map(|(_, v)| v).and_then(|v| obj_of(Some(v)));
        let surface = obj_of(layer.get("surface"));
        let block = surface.and_then(|s| match s.get("scan0") {
            Some(V::Ref(i)) => Some(*i),
            _ => None,
        });
        let stride = match surface.and_then(|s| s.get("stride")) {
            Some(V::Int(n)) => *n as usize,
            _ => w * 4,
        };
        let name = match lp.and_then(|o| o.get("name")) {
            Some(V::Str(s)) => s.clone(),
            Some(V::Ref(i)) => r.strings.get(i).cloned().unwrap_or_default(),
            _ => format!("Calque {}", doc.layers.len() + 1),
        };
        let mut l = Layer::new(&name, w, h, [0, 0, 0, 0]);
        if let Some(V::Bool(v)) = lp.and_then(|o| o.get("visible")) {
            l.visible = *v;
        }
        if let Some(V::Int(o)) = lp.and_then(|o| o.get("opacity")) {
            l.opacity = (*o as f32 / 255.0).clamp(0.0, 1.0);
        }
        // mode de fusion : objet « blendOp » (son nom de classe) ou énumération récente
        if let Some(op) = obj_of(bp.and_then(|o| o.get("blendOp"))) {
            l.blend = blend_of(&op.class);
        } else if let Some(V::Int(m)) = obj_of(lp.and_then(|o| o.get("blendMode")).or(bp.and_then(|o| o.get("blendMode")))).and_then(|o| o.get("value__")) {
            // Paint.NET 5 : énumération LayerBlendMode
            l.blend = match m {
                1 => Blend::Multiply,
                2 | 4 => Blend::ColorBurn,
                3 | 5 => Blend::ColorDodge,
                6 => Blend::Overlay,
                7 | 8 | 12 => Blend::Difference,
                9 => Blend::Lighten,
                10 => Blend::Darken,
                11 => Blend::Screen,
                13 => Blend::HardLight,
                14 => Blend::SoftLight,
                15 => Blend::Color,
                16 => Blend::Luminosity,
                17 => Blend::Hue,
                18 => Blend::Saturation,
                _ => Blend::Normal,
            };
        }
        match block.and_then(|b| pixels.get(&b)) {
            Some(bgra) => {
                let mut px = vec![0u8; w * h * 4];
                for y in 0..h {
                    for x in 0..w {
                        let s = y * stride + x * 4;
                        if s + 4 <= bgra.len() {
                            let o = (y * w + x) * 4;
                            px[o..o + 4].copy_from_slice(&[bgra[s + 2], bgra[s + 1], bgra[s], bgra[s + 3]]);
                        }
                    }
                }
                l.px = px.into();
            }
            None => notes.push(format!("pixels du calque « {name} »")),
        }
        doc.layers.push(l);
    }
    if doc.layers.is_empty() {
        return Err("aucun calque lisible dans ce .pdn".into());
    }
    doc.active = doc.layers.len() - 1;
    doc.history.clear();
    doc.hindex = 0;
    doc.commit("Ouvrir le fichier Paint.NET");
    Ok((doc, notes))
}

/// Fichier .pdn de MasterPaint HTML : « MPDN », version, nombre de calques, puis par calque
/// largeur, hauteur, taille et pixels BGRA (gzip ou bruts), de bas en haut.
fn load_mpdn(name: &str, b: &[u8], w: usize, h: usize) -> Result<(Doc, Vec<String>), String> {
    let u32le = |o: usize| b.get(o..o + 4).map(|s| u32::from_le_bytes(s.try_into().unwrap()) as usize);
    let count = u32le(8).ok_or("en-tête MPDN tronqué")?;
    let mut pos = 12;
    let mut doc = Doc::new(w, h, [0, 0, 0, 0], name);
    doc.layers.clear();
    for k in 0..count {
        let (Some(lw), Some(lh), Some(len)) = (u32le(pos), u32le(pos + 4), u32le(pos + 8)) else { break };
        pos += 12;
        let Some(data) = b.get(pos..pos + len) else { break };
        pos += len;
        let bgra = if data.starts_with(&[0x1f, 0x8b]) { gunzip(data).ok_or("calque MPDN illisible (gzip)")? } else { data.to_vec() };
        let mut px = vec![0u8; w * h * 4];
        for y in 0..h.min(lh) {
            for x in 0..w.min(lw) {
                let s = (y * lw + x) * 4;
                if s + 4 <= bgra.len() {
                    let o = (y * w + x) * 4;
                    px[o..o + 4].copy_from_slice(&[bgra[s + 2], bgra[s + 1], bgra[s], bgra[s + 3]]);
                }
            }
        }
        let mut l = Layer::new(&if k == 0 { "Arrière-plan".to_string() } else { format!("Calque {}", k + 1) }, w, h, [0, 0, 0, 0]);
        l.px = px.into();
        doc.layers.push(l);
    }
    if doc.layers.is_empty() {
        return Err("aucun calque lisible dans ce .pdn".into());
    }
    doc.active = doc.layers.len() - 1;
    doc.history.clear();
    doc.hindex = 0;
    doc.commit("Ouvrir le fichier Paint.NET");
    Ok((doc, Vec::new()))
}

#[cfg(test)]
mod tests {
    /// Fichiers Paint.NET réels (MP_PDN = chemins séparés par « | ») : calques listés, image
    /// aplatie en PNG dans MP_OUT. `cargo test --lib pdn_look -- --ignored --nocapture`
    #[test]
    #[ignore]
    fn pdn_look() {
        let out = std::env::var("MP_OUT").expect("MP_OUT");
        for path in std::env::var("MP_PDN").expect("MP_PDN").split('|') {
            let bytes = std::fs::read(path).unwrap();
            let name = std::path::Path::new(path).file_stem().unwrap().to_string_lossy().to_string();
            match super::load(&name, &bytes) {
                Ok((d, notes)) => {
                    let layers: Vec<String> = d.layers.iter().map(|l| format!("{} (vis {}, op {:.2}, {:?})", l.name, l.visible, l.opacity, l.blend)).collect();
                    eprintln!("{name} : {}×{}, {:?}, manque {:?}", d.w, d.h, layers, notes);
                    image::save_buffer(format!("{out}/{name}.png"), &d.flatten(), d.w as u32, d.h as u32, image::ColorType::Rgba8).unwrap();
                }
                Err(e) => eprintln!("{name} : ERREUR {e}"),
            }
        }
    }
}
