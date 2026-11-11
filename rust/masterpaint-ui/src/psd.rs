// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Fichiers Photoshop (.psd, .psb) : calques de pixels avec nom, visibilité, opacité (et
//! remplissage), mode de fusion, masque de fusion, dossiers (imbriqués, « Transfert ») ;
//! 8, 16 et 32 bits ; RVB, niveaux de gris, CMJN (approché), bitmap ; compression brute, RLE
//! (PackBits) et ZIP. Sans calque lisible : image composite du fichier.
//!
//! Écrit d'après la spécification publique d'Adobe (« Adobe Photoshop File Formats
//! Specification ») ; PhotoCraft (storytold, `crates/psd`, MIT OR Apache-2.0 —
//! https://getartcraft.com/apps) a servi de référence pour l'ordre des dossiers. Les calques de
//! texte, de forme et de réglage arrivent par leurs pixels (rendu enregistré par Photoshop).

use crate::editor::{Blend, Doc, Layer};

struct R<'a> {
    b: &'a [u8],
    p: usize,
}

impl<'a> R<'a> {
    fn need(&self, n: usize) -> Result<(), String> {
        if self.p.checked_add(n).is_some_and(|e| e <= self.b.len()) {
            Ok(())
        } else {
            Err("fichier Photoshop tronqué".into())
        }
    }
    fn bytes(&mut self, n: usize) -> Result<&'a [u8], String> {
        self.need(n)?;
        let s = &self.b[self.p..self.p + n];
        self.p += n;
        Ok(s)
    }
    fn u8(&mut self) -> Result<u8, String> {
        Ok(self.bytes(1)?[0])
    }
    fn u16(&mut self) -> Result<u16, String> {
        let s = self.bytes(2)?;
        Ok(u16::from_be_bytes([s[0], s[1]]))
    }
    fn i16(&mut self) -> Result<i16, String> {
        Ok(self.u16()? as i16)
    }
    fn u32(&mut self) -> Result<u32, String> {
        let s = self.bytes(4)?;
        Ok(u32::from_be_bytes([s[0], s[1], s[2], s[3]]))
    }
    fn i32(&mut self) -> Result<i32, String> {
        Ok(self.u32()? as i32)
    }
    fn u64(&mut self) -> Result<u64, String> {
        let s = self.bytes(8)?;
        Ok(u64::from_be_bytes(s.try_into().unwrap_or([0; 8])))
    }
    /// longueur de section : 4 octets en PSD, 8 en PSB pour certaines
    fn len(&mut self, psb: bool) -> Result<usize, String> {
        Ok(if psb { self.u64()? as usize } else { self.u32()? as usize })
    }
    fn skip(&mut self, n: usize) -> Result<(), String> {
        self.bytes(n).map(|_| ())
    }
}

fn blend_of(key: &[u8]) -> Blend {
    match key {
        b"mul " => Blend::Multiply,
        b"scrn" => Blend::Screen,
        b"over" => Blend::Overlay,
        b"sLit" => Blend::SoftLight,
        b"hLit" => Blend::HardLight,
        b"dark" | b"dkCl" => Blend::Darken,
        b"lite" | b"lgCl" => Blend::Lighten,
        b"div " => Blend::ColorDodge,
        b"idiv" => Blend::ColorBurn,
        b"diff" => Blend::Difference,
        b"smud" => Blend::Exclusion,
        b"hue " => Blend::Hue,
        b"sat " => Blend::Saturation,
        b"colr" => Blend::Color,
        b"lum " => Blend::Luminosity,
        _ => Blend::Normal,
    }
}

/// Décompresse un plan d'image (`w × h` échantillons de `depth` bits) selon `comp`.
/// RLE : `counts` donne la taille de chaque ligne compressée (lue avant par l'appelant).
fn plane(data: &[u8], comp: u16, w: usize, h: usize, depth: u16, row_counts: Option<&[usize]>) -> Result<Vec<u8>, String> {
    let bpr = match depth {
        1 => w.div_ceil(8),
        d => w * (d as usize / 8),
    };
    let mut out = vec![0u8; bpr * h];
    match comp {
        0 => {
            let n = out.len().min(data.len());
            out[..n].copy_from_slice(&data[..n]);
        }
        1 => {
            let counts = row_counts.ok_or("RLE sans tailles de lignes")?;
            let mut p = 0usize;
            for y in 0..h {
                let end = (p + counts.get(y).copied().unwrap_or(0)).min(data.len());
                let row = &mut out[y * bpr..(y + 1) * bpr];
                let mut q = 0usize;
                while p < end && q < bpr {
                    let n = data[p] as i8;
                    p += 1;
                    if n >= 0 {
                        let k = (n as usize + 1).min(bpr - q).min(end.saturating_sub(p));
                        row[q..q + k].copy_from_slice(&data[p..p + k]);
                        p += n as usize + 1;
                        q += k;
                    } else if n != -128 {
                        let k = ((1 - n as isize) as usize).min(bpr - q);
                        if p < end {
                            row[q..q + k].fill(data[p]);
                        }
                        p += 1;
                        q += k;
                    }
                }
                p = end;
            }
        }
        2 | 3 => {
            use std::io::Read;
            let mut z = Vec::new();
            flate2::read::ZlibDecoder::new(data).read_to_end(&mut z).map_err(|e| format!("ZIP illisible : {e}"))?;
            let n = out.len().min(z.len());
            out[..n].copy_from_slice(&z[..n]);
            if comp == 3 && depth >= 16 {
                // ZIP avec prédiction : différences par ligne (sur des mots de 16 ou 32 bits)
                let bps = depth as usize / 8;
                for y in 0..h {
                    let row = &mut out[y * bpr..(y + 1) * bpr];
                    if bps == 2 {
                        for x in 1..w {
                            let a = u16::from_be_bytes([row[(x - 1) * 2], row[(x - 1) * 2 + 1]]);
                            let b = u16::from_be_bytes([row[x * 2], row[x * 2 + 1]]);
                            row[x * 2..x * 2 + 2].copy_from_slice(&a.wrapping_add(b).to_be_bytes());
                        }
                    } else {
                        // 32 bits : différences d'octets, puis octets rangés par plans
                        for i in 1..bpr {
                            row[i] = row[i].wrapping_add(row[i - 1]);
                        }
                        let copy = row.to_vec();
                        for x in 0..w {
                            for k in 0..4 {
                                row[x * 4 + k] = copy[k * w + x];
                            }
                        }
                    }
                }
            } else if comp == 3 {
                for y in 0..h {
                    let row = &mut out[y * bpr..(y + 1) * bpr];
                    for i in 1..bpr {
                        row[i] = row[i].wrapping_add(row[i - 1]);
                    }
                }
            }
        }
        _ => return Err(format!("compression Photoshop {comp} non prise en charge")),
    }
    Ok(out)
}

/// Échantillon ramené à 8 bits.
fn sample8(p: &[u8], i: usize, depth: u16) -> u8 {
    match depth {
        1 => {
            // bitmap : 1 = noir
            if p.get(i / 8).is_some_and(|b| b & (0x80 >> (i % 8)) != 0) { 0 } else { 255 }
        }
        16 => p.get(i * 2).copied().unwrap_or(0),
        32 => {
            let v = p.get(i * 4..i * 4 + 4).map_or(0.0, |s| f32::from_be_bytes([s[0], s[1], s[2], s[3]]));
            // 32 bits linéaire → sRGB
            let v = v.clamp(0.0, 1.0);
            let s = if v <= 0.003_130_8 { v * 12.92 } else { 1.055 * v.powf(1.0 / 2.4) - 0.055 };
            (s * 255.0 + 0.5) as u8
        }
        _ => p.get(i).copied().unwrap_or(0),
    }
}

/// Plans de canaux (identifiants Photoshop : 0.. couleur, -1 alpha, -2 masque) → RGBA.
fn to_rgba(mode: u16, depth: u16, w: usize, h: usize, chans: &[(i16, Vec<u8>)]) -> Vec<u8> {
    let get = |id: i16| chans.iter().find(|(c, _)| *c == id).map(|(_, p)| p.as_slice());
    let mut out = vec![0u8; w * h * 4];
    let alpha = get(-1);
    for i in 0..w * h {
        let o = i * 4;
        let s = |id: i16| get(id).map(|p| sample8(p, i, depth));
        let (r, g, b) = match mode {
            1 | 8 | 0 => {
                let v = s(0).unwrap_or(0);
                (v, v, v)
            }
            4 => {
                // CMJN (encre stockée inversée : 255 = pas d'encre)
                let (c, m, y, k) = (s(0).unwrap_or(255) as f32 / 255.0, s(1).unwrap_or(255) as f32 / 255.0, s(2).unwrap_or(255) as f32 / 255.0, s(3).unwrap_or(255) as f32 / 255.0);
                ((c * k * 255.0) as u8, (m * k * 255.0) as u8, (y * k * 255.0) as u8)
            }
            _ => (s(0).unwrap_or(0), s(1).unwrap_or(0), s(2).unwrap_or(0)),
        };
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = alpha.map_or(255, |p| sample8(p, i, depth));
    }
    out
}

struct Rec {
    top: i32,
    left: i32,
    bottom: i32,
    right: i32,
    chans: Vec<(i16, usize)>,
    blend: Blend,
    opacity: u8,
    hidden: bool,
    name: String,
    /// dossier : 1 / 2 ouvert / fermé, 3 = fin de dossier (marqueur sous ses calques)
    section: u32,
    pass: bool,
    /// masque de fusion : rectangle, couleur par défaut, désactivé
    mask: Option<(i32, i32, i32, i32, u8, bool)>,
}

/// Ouvre un .psd / .psb : document à calques et remarques sur ce qui a été approché ou ignoré.
pub fn load(name: &str, bytes: &[u8]) -> Result<(Doc, Vec<String>), String> {
    let mut r = R { b: bytes, p: 0 };
    if r.bytes(4)? != b"8BPS" {
        return Err(format!("« {name} » n'est pas un fichier Photoshop"));
    }
    let version = r.u16()?;
    let psb = version == 2;
    r.skip(6)?;
    let nch = r.u16()? as usize;
    let h = r.u32()? as usize;
    let w = r.u32()? as usize;
    let depth = r.u16()?;
    let mode = r.u16()?;
    if w == 0 || h == 0 || w.checked_mul(h).map_or(true, |n| n > 400_000_000) {
        return Err("dimensions Photoshop invalides ou trop grandes".into());
    }
    if !matches!(depth, 1 | 8 | 16 | 32) {
        return Err(format!("profondeur {depth} bits non prise en charge"));
    }
    let mut notes = Vec::new();
    if mode == 4 {
        notes.push("CMJN converti en RVB (approché, sans profil)".to_string());
    } else if !matches!(mode, 0 | 1 | 3 | 8) {
        notes.push(format!("mode de couleur {mode} lu comme RVB"));
    }
    // données de mode couleur, ressources d'image
    let n = r.u32()? as usize;
    r.skip(n)?;
    let n = r.u32()? as usize;
    r.skip(n)?;
    // calques et masques
    let lm_len = r.len(psb)?;
    let lm_end = r.p + lm_len;
    let mut doc = Doc::new(w, h, [0, 0, 0, 0], name);
    doc.layers.clear();
    if lm_len > 0 {
        let li_len = r.len(psb)?;
        let li_end = r.p + li_len;
        if li_len > 0 {
            let count = (r.i16()?).unsigned_abs() as usize;
            let mut recs = Vec::with_capacity(count);
            for _ in 0..count {
                let (top, left, bottom, right) = (r.i32()?, r.i32()?, r.i32()?, r.i32()?);
                let nc = r.u16()? as usize;
                let mut chans = Vec::with_capacity(nc);
                for _ in 0..nc {
                    let id = r.i16()?;
                    let len = r.len(psb)?;
                    chans.push((id, len));
                }
                r.skip(4)?; // « 8BIM »
                let blend = blend_of(r.bytes(4)?);
                let key_pass = r.b[r.p - 4..r.p] == *b"pass";
                let opacity = r.u8()?;
                r.skip(1)?; // détourage
                let flags = r.u8()?;
                r.skip(1)?;
                let extra = r.u32()? as usize;
                let extra_end = r.p + extra;
                // masque de fusion
                let ml = r.u32()? as usize;
                let mut mask = None;
                if ml >= 20 {
                    let (t, l, b, rr) = (r.i32()?, r.i32()?, r.i32()?, r.i32()?);
                    let def = r.u8()?;
                    let mf = r.u8()?;
                    mask = Some((t, l, b, rr, def, mf & 2 != 0));
                    r.skip(ml - 18)?;
                } else {
                    r.skip(ml)?;
                }
                let bl = r.u32()? as usize;
                r.skip(bl)?;
                let nl = r.u8()? as usize;
                let raw_name = String::from_utf8_lossy(r.bytes(nl)?).to_string();
                r.p += (4 - (nl + 1) % 4) % 4;
                let mut rec = Rec { top, left, bottom, right, chans, blend, opacity, hidden: flags & 2 != 0, name: raw_name, section: 0, pass: key_pass, mask };
                // informations additionnelles : nom Unicode, dossiers
                while r.p + 12 <= extra_end {
                    let sig = r.bytes(4)?;
                    if sig != b"8BIM" && sig != b"8B64" {
                        break;
                    }
                    let key = r.bytes(4)?.to_vec();
                    let long = psb && matches!(&key[..], b"LMsk" | b"Lr16" | b"Lr32" | b"Layr" | b"Mt16" | b"Mt32" | b"Mtrn" | b"Alph" | b"FMsk" | b"lnk2" | b"FEid" | b"FXid" | b"PxSD");
                    let len = if long { r.u64()? as usize } else { r.u32()? as usize };
                    let start = r.p;
                    match &key[..] {
                        b"luni" if len >= 4 => {
                            let n = r.u32()? as usize;
                            let s = r.bytes((n * 2).min(len - 4))?;
                            let u: Vec<u16> = s.chunks_exact(2).map(|c| u16::from_be_bytes([c[0], c[1]])).collect();
                            rec.name = String::from_utf16_lossy(&u).trim_end_matches('\0').to_string();
                        }
                        b"lsct" | b"lsdk" if len >= 4 => {
                            rec.section = r.u32()?;
                            if len >= 12 {
                                r.skip(4)?;
                                rec.pass = r.bytes(4)? == b"pass";
                            }
                        }
                        _ => {}
                    }
                    r.p = start + len;
                    // alignement sur 2 (PSD) ; les tailles sont déjà paires en pratique
                }
                r.p = extra_end;
                recs.push(rec);
            }
            // données des canaux, dans l'ordre des calques
            let mut stack: Vec<usize> = Vec::new();
            for rec in recs {
                let (lw, lh) = ((rec.right - rec.left).max(0) as usize, (rec.bottom - rec.top).max(0) as usize);
                let mut planes: Vec<(i16, Vec<u8>)> = Vec::new();
                let mut mask_plane: Option<(Vec<u8>, usize, usize)> = None;
                for (id, len) in &rec.chans {
                    let start = r.p;
                    let end = start + len;
                    if end > bytes.len() {
                        return Err("fichier Photoshop tronqué (canaux)".into());
                    }
                    let (cw, ch) = if *id == -2 {
                        rec.mask.map_or((0, 0), |m| ((m.3 - m.1).max(0) as usize, (m.2 - m.0).max(0) as usize))
                    } else {
                        (lw, lh)
                    };
                    if *len >= 2 && cw > 0 && ch > 0 {
                        let comp = r.u16()?;
                        let counts: Option<Vec<usize>> = if comp == 1 {
                            let mut v = Vec::with_capacity(ch);
                            for _ in 0..ch {
                                v.push(if psb { r.u32()? as usize } else { r.u16()? as usize });
                            }
                            Some(v)
                        } else {
                            None
                        };
                        let data = &bytes[r.p.min(end)..end];
                        let d = if *id == -2 { 8 } else { depth };
                        match plane(data, comp, cw, ch, d, counts.as_deref()) {
                            Ok(p) if *id == -2 => mask_plane = Some((p, cw, ch)),
                            Ok(p) => planes.push((*id, p)),
                            Err(e) => notes.push(format!("« {} » : {e}", rec.name)),
                        }
                    }
                    r.p = end;
                }
                match rec.section {
                    3 => {
                        // fin de dossier (sous ses calques) : début du groupe en lecture de bas en haut
                        stack.push(doc.layers.len());
                        continue;
                    }
                    1 | 2 => {
                        let start = stack.pop().unwrap_or(0);
                        let mut g = Layer::new(&rec.name, w, h, [0, 0, 0, 0]);
                        g.group = true;
                        g.visible = !rec.hidden;
                        g.opacity = rec.opacity as f32 / 255.0;
                        g.blend = rec.blend;
                        g.pass = rec.pass;
                        g.collapsed = rec.section == 2;
                        for l in doc.layers[start..].iter_mut() {
                            if l.parent == 0 {
                                l.parent = g.uid;
                            }
                        }
                        doc.layers.push(g);
                        continue;
                    }
                    _ => {}
                }
                let mut l = Layer::new(if rec.name.is_empty() { "Calque" } else { &rec.name }, w, h, [0, 0, 0, 0]);
                l.visible = !rec.hidden;
                l.opacity = rec.opacity as f32 / 255.0;
                l.blend = rec.blend;
                if lw > 0 && lh > 0 && !planes.is_empty() {
                    let rgba = to_rgba(mode, depth, lw, lh, &planes);
                    // calque posé dans la toile (le contenu qui dépasse est coupé)
                    for y in 0..lh {
                        let dy = rec.top + y as i32;
                        if dy < 0 || dy >= h as i32 {
                            continue;
                        }
                        for x in 0..lw {
                            let dx = rec.left + x as i32;
                            if dx < 0 || dx >= w as i32 {
                                continue;
                            }
                            let (s, d) = ((y * lw + x) * 4, (dy as usize * w + dx as usize) * 4);
                            l.px[d..d + 4].copy_from_slice(&rgba[s..s + 4]);
                        }
                    }
                }
                // masque de fusion → masque α du calque (blanc = visible)
                if let (Some((mp, mw, mh)), Some((mt, ml, _, _, def, off))) = (mask_plane, rec.mask) {
                    if !off {
                        // un octet par pixel (255 = visible), comme les masques α de MasterPaint
                        let mut m = vec![def; w * h];
                        for y in 0..h {
                            for x in 0..w {
                                let (mx, my) = (x as i32 - ml, y as i32 - mt);
                                if mx >= 0 && my >= 0 && (mx as usize) < mw && (my as usize) < mh {
                                    m[y * w + x] = mp[my as usize * mw + mx as usize];
                                }
                            }
                        }
                        l.mask = Some(m.into());
                    }
                }
                doc.layers.push(l);
            }
        }
        r.p = li_end.max(r.p);
    }
    r.p = lm_end;
    if doc.layers.iter().all(|l| l.group) {
        // pas de calque : image composite (fin du fichier)
        doc.layers.clear();
        let comp = r.u16()?;
        let counts = if comp == 1 {
            let mut v = Vec::with_capacity(h * nch);
            for _ in 0..h * nch {
                v.push(if psb { r.u32()? as usize } else { r.u16()? as usize });
            }
            Some(v)
        } else {
            None
        };
        let bpr = if depth == 1 { w.div_ceil(8) } else { w * depth as usize / 8 };
        let mut planes = Vec::new();
        let mut p = r.p;
        for c in 0..nch.min(5) {
            let rows = counts.as_ref().map(|v| v[c * h..(c + 1) * h].to_vec());
            let size = rows.as_ref().map_or(bpr * h, |v| v.iter().sum());
            let data = &bytes[p.min(bytes.len())..(p + size).min(bytes.len())];
            let id = if (mode == 3 && c == 3) || ((mode == 1 || mode == 8) && c == 1) || (mode == 4 && c == 4) { -1 } else { c as i16 };
            planes.push((id, plane(data, comp, w, h, depth, rows.as_deref())?));
            p += size;
        }
        let mut l = Layer::new("Arrière-plan", w, h, [0, 0, 0, 0]);
        l.px = to_rgba(mode, depth, w, h, &planes).into();
        doc.layers.push(l);
    }
    if doc.layers.is_empty() {
        return Err("aucun calque lisible dans ce fichier Photoshop".into());
    }
    doc.normalize_groups();
    doc.active = doc.layers.iter().rposition(|l| !l.group).unwrap_or(0);
    doc.history.clear();
    doc.hindex = 0;
    doc.commit("Ouvrir le fichier Photoshop");
    Ok((doc, notes))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// PSD minimal écrit à la main : 2 × 1 px RVB 8 bits, sans calque, composite brut.
    #[test]
    fn composite_only_psd() {
        let mut b = Vec::new();
        b.extend_from_slice(b"8BPS");
        b.extend_from_slice(&1u16.to_be_bytes());
        b.extend_from_slice(&[0; 6]);
        b.extend_from_slice(&3u16.to_be_bytes()); // canaux
        b.extend_from_slice(&1u32.to_be_bytes()); // hauteur
        b.extend_from_slice(&2u32.to_be_bytes()); // largeur
        b.extend_from_slice(&8u16.to_be_bytes());
        b.extend_from_slice(&3u16.to_be_bytes()); // RVB
        b.extend_from_slice(&0u32.to_be_bytes());
        b.extend_from_slice(&0u32.to_be_bytes());
        b.extend_from_slice(&0u32.to_be_bytes());
        b.extend_from_slice(&0u16.to_be_bytes()); // brut
        b.extend_from_slice(&[255, 0, 0, 255, 0, 0]); // R, V, B (2 px chacun)
        let (d, _) = load("t.psd", &b).unwrap();
        assert_eq!(&d.layers[0].px[..8], &[255, 0, 0, 255, 0, 255, 0, 255]);
    }

    #[test]
    fn packbits_rows() {
        // « 3 fois 7 », puis 2 octets littéraux
        let data = [0xFE, 7, 0x01, 1, 2];
        let p = plane(&data, 1, 5, 1, 8, Some(&[5])).unwrap();
        assert_eq!(p, vec![7, 7, 7, 1, 2]);
    }
}
