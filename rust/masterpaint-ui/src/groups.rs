//! Dossiers de calques (imbriqués, comme paintdotjs / Photoshop) et verrouillage.
//!
//! Un dossier est un calque `group` aux pixels transparents (jamais dessinés) ; ses enfants sont
//! les calques dont `parent` vaut son `uid`. Dans `Doc::layers` (de bas en haut), le contenu d'un
//! dossier est juste sous lui (ordre « enfants puis dossier », voir `normalize_groups`) : le
//! panneau Calques l'affiche sous la ligne du dossier, en retrait. Sans dossier, la composition
//! garde son chemin habituel (editor.rs) ; avec, elle suit l'arbre (`pixel_tree`).

use crate::editor::{over_rgba, Blend, Doc, Layer};

/// Profondeur maximale (protection contre un fichier où un dossier serait son propre parent).
const MAX_DEPTH: usize = 32;

/// Nœud de composition : calque visible, ou dossier visible avec ses enfants visibles.
pub(crate) struct Node<'a> {
    pub l: &'a Layer,
    pub kids: Vec<Node<'a>>,
}

/// Arbre des calques visibles (un dossier masqué masque tout son contenu). Un calque dont le
/// dossier n'est pas dans la liste (document partiel des filtres dynamiques) est à la racine.
pub(crate) fn visible_tree(doc: &Doc) -> Vec<Node<'_>> {
    let groups: Vec<u64> = doc.layers.iter().filter(|l| l.group).map(|l| l.uid).collect();
    fn build<'a>(doc: &'a Doc, groups: &[u64], p: u64, depth: usize) -> Vec<Node<'a>> {
        doc.layers
            .iter()
            .filter(|l| eff_parent(l, groups) == p && l.visible && l.opacity > 0.0)
            .map(|l| Node { l, kids: if l.group && depth < MAX_DEPTH { build(doc, groups, l.uid, depth + 1) } else { Vec::new() } })
            .collect()
    }
    build(doc, &groups, 0, 0)
}

fn eff_parent(l: &Layer, groups: &[u64]) -> u64 {
    if l.parent != 0 && l.parent != l.uid && groups.contains(&l.parent) {
        l.parent
    } else {
        0
    }
}

/// Couleur composée du pixel `i` par l'arbre : un dossier « Transfert » fond son contenu
/// directement avec le dessous (puis son opacité dose le résultat) ; sinon son contenu est
/// composé à part puis posé avec son opacité, son masque α et son mode de fusion.
pub(crate) fn pixel_tree(doc: &Doc, nodes: &[Node], i: usize, mut acc: (f32, f32, f32, f32)) -> (f32, f32, f32, f32) {
    for n in nodes {
        if !n.l.group {
            acc = doc.over(n.l, i, acc);
            continue;
        }
        let mut m = n.l.opacity;
        if let Some(mask) = n.l.mask.as_ref().filter(|m| m.len() == doc.w * doc.h) {
            m *= mask[i / 4] as f32 / 255.0;
        }
        if m <= 0.0 || n.kids.is_empty() {
            continue;
        }
        if n.l.pass {
            let inner = pixel_tree(doc, &n.kids, i, acc);
            acc = if m >= 1.0 { inner } else { lerp(acc, inner, m) };
        } else {
            let c = pixel_tree(doc, &n.kids, i, (0.0, 0.0, 0.0, 0.0));
            acc = over_rgba((c.0, c.1, c.2), c.3 * m, n.l.blend, acc);
        }
    }
    acc
}

/// Mélange de deux couleurs (prémultipliées pendant le calcul).
fn lerp(a: (f32, f32, f32, f32), b: (f32, f32, f32, f32), t: f32) -> (f32, f32, f32, f32) {
    let al = a.3 + (b.3 - a.3) * t;
    if al <= 0.0 {
        return (0.0, 0.0, 0.0, 0.0);
    }
    let mix = |x: f32, y: f32| (x * a.3 + (y * b.3 - x * a.3) * t) / al;
    (mix(a.0, b.0), mix(a.1, b.1), mix(a.2, b.2), al)
}

/// Opération du panneau Calques refusée : message pour la barre d'état.
pub type Refused = &'static str;

impl Doc {
    /// Le document a des dossiers (composition par l'arbre).
    pub fn has_groups(&self) -> bool {
        self.layers.iter().any(|l| l.group)
    }

    fn index_of_uid(&self, uid: u64) -> Option<usize> {
        self.layers.iter().position(|l| l.uid == uid)
    }

    /// Le calque `k` est dans le dossier `g` (à n'importe quelle profondeur).
    pub fn is_inside(&self, k: usize, g: u64) -> bool {
        let mut p = self.layers[k].parent;
        for _ in 0..MAX_DEPTH {
            if p == 0 {
                return false;
            }
            if p == g {
                return true;
            }
            p = self.index_of_uid(p).map(|j| self.layers[j].parent).unwrap_or(0);
        }
        false
    }

    /// Nombre de dossiers au-dessus du calque `k`.
    pub fn depth(&self, k: usize) -> usize {
        let mut p = self.layers[k].parent;
        let mut d = 0;
        while p != 0 && d < MAX_DEPTH {
            d += 1;
            p = self.index_of_uid(p).map(|j| self.layers[j].parent).unwrap_or(0);
        }
        d
    }

    /// Un dossier au-dessus du calque `k` est replié (ligne cachée dans le panneau).
    fn hidden_in_panel(&self, k: usize) -> bool {
        let mut p = self.layers[k].parent;
        for _ in 0..MAX_DEPTH {
            let Some(j) = (p != 0).then(|| self.index_of_uid(p)).flatten() else { return false };
            if self.layers[j].collapsed {
                return true;
            }
            p = self.layers[j].parent;
        }
        false
    }

    /// Indices du calque `k` et de tout son contenu (dossier) : bloc contigu `start..=k`.
    pub fn subtree(&self, k: usize) -> std::ops::RangeInclusive<usize> {
        let uid = self.layers[k].uid;
        let n = if self.layers[k].group { (0..k).filter(|&j| self.is_inside(j, uid)).count() } else { 0 };
        k - n..=k
    }

    /// Lignes du panneau Calques, du haut vers le bas : (indice du calque, profondeur). Le
    /// contenu des dossiers repliés est omis.
    pub fn panel_rows(&self) -> Vec<(usize, usize)> {
        (0..self.layers.len()).rev().filter(|&k| !self.hidden_in_panel(k)).map(|k| (k, self.depth(k))).collect()
    }

    /// Le calque `k` ou un de ses dossiers est verrouillé.
    pub fn locked_at(&self, k: usize) -> bool {
        if self.layers[k].locked {
            return true;
        }
        let mut p = self.layers[k].parent;
        for _ in 0..MAX_DEPTH {
            let Some(j) = (p != 0).then(|| self.index_of_uid(p)).flatten() else { return false };
            if self.layers[j].locked {
                return true;
            }
            p = self.layers[j].parent;
        }
        false
    }

    /// Le calque actif peut-il recevoir des pixels (outils, effets, suppression) ?
    pub fn edit_refusal(&self) -> Option<Refused> {
        let l = self.layer();
        if l.group {
            return Some("Dossier sélectionné : choisissez un calque pour dessiner ou appliquer un effet");
        }
        if self.locked_at(self.active) {
            return Some("Calque verrouillé : cliquez sur son cadenas (panneau Calques) pour le déverrouiller");
        }
        None
    }

    /// Remet les calques dans l'ordre « contenu puis dossier » (de bas en haut), rattache à la
    /// racine les calques dont le dossier n'existe plus (ou en boucle) ; garde le calque actif.
    pub fn normalize_groups(&mut self) {
        if !self.layers.iter().any(|l| l.group || l.parent != 0) {
            return;
        }
        let active = self.layers.get(self.active).map(|l| l.uid);
        let groups: Vec<u64> = self.layers.iter().filter(|l| l.group).map(|l| l.uid).collect();
        for l in self.layers.iter_mut() {
            if l.parent != 0 && (l.parent == l.uid || !groups.contains(&l.parent)) {
                l.parent = 0;
            }
        }
        for k in 0..self.layers.len() {
            if self.depth(k) >= MAX_DEPTH {
                self.layers[k].parent = 0;
            }
        }
        fn emit(old: &[Layer], p: u64, used: &mut [bool], order: &mut Vec<usize>, depth: usize) {
            for (k, l) in old.iter().enumerate() {
                if l.parent == p && !used[k] {
                    used[k] = true;
                    if l.group && depth < MAX_DEPTH {
                        emit(old, l.uid, used, order, depth + 1);
                    }
                    order.push(k);
                }
            }
        }
        let mut used = vec![false; self.layers.len()];
        let mut order = Vec::with_capacity(self.layers.len());
        emit(&self.layers, 0, &mut used, &mut order, 0);
        // calques restés hors de l'arbre (ne devrait pas arriver) : gardés en haut
        order.extend((0..self.layers.len()).filter(|k| !used[*k]));
        let mut old: Vec<Option<Layer>> = std::mem::take(&mut self.layers).into_iter().map(Some).collect();
        self.layers = order.into_iter().filter_map(|k| old[k].take()).collect();
        self.active = active.and_then(|u| self.index_of_uid(u)).unwrap_or(0).min(self.layers.len().saturating_sub(1));
    }

    /// Pixels transparents d'un dossier (partagés avec un autre dossier de même taille).
    fn group_pixels(&self) -> crate::editor::Px {
        let n = self.w * self.h * 4;
        match self.layers.iter().find(|l| l.group && l.px.len() == n) {
            Some(g) => g.px.clone(),
            None => vec![0u8; n].into(),
        }
    }

    fn new_group(&self, name: &str) -> Layer {
        let mut g = Layer::new(name, 0, 0, [0, 0, 0, 0]);
        g.px = self.group_pixels();
        g.group = true;
        g
    }

    /// Nouveau calque au-dessus du calque actif, dans le même dossier ; dossier actif : en
    /// haut de son contenu.
    pub fn add_layer_in(&mut self) {
        let n = self.layers.iter().filter(|l| !l.group).count() + 1;
        let mut l = Layer::new(&format!("Calque {n}"), self.w, self.h, [0, 0, 0, 0]);
        let a = self.active;
        if self.layers[a].group {
            l.parent = self.layers[a].uid;
            self.layers.insert(a, l);
            self.active = a;
        } else {
            l.parent = self.layers[a].parent;
            self.layers.insert(a + 1, l);
            self.active = a + 1;
        }
    }

    /// Nouveau dossier vide au-dessus du calque actif (même dossier parent).
    pub fn add_group(&mut self) {
        let n = self.layers.iter().filter(|l| l.group).count() + 1;
        let mut g = self.new_group(&format!("Dossier {n}"));
        let a = self.active;
        g.parent = self.layers[a].parent;
        self.layers.insert(a + 1, g);
        self.active = a + 1;
    }

    /// Range le calque actif (et son contenu) dans un nouveau dossier.
    pub fn group_active(&mut self) {
        let n = self.layers.iter().filter(|l| l.group).count() + 1;
        let mut g = self.new_group(&format!("Dossier {n}"));
        let a = self.active;
        g.parent = self.layers[a].parent;
        self.layers[a].parent = g.uid;
        self.layers.insert(a + 1, g);
        self.active = a + 1;
        self.normalize_groups();
    }

    /// Supprime le dossier actif ; son contenu prend sa place.
    pub fn ungroup_active(&mut self) -> Result<(), Refused> {
        let a = self.active;
        if !self.layers[a].group {
            return Err("Dégrouper : sélectionnez un dossier");
        }
        let (uid, parent) = (self.layers[a].uid, self.layers[a].parent);
        for l in self.layers.iter_mut().filter(|l| l.parent == uid) {
            l.parent = parent;
        }
        self.layers.remove(a);
        self.active = a.saturating_sub(1).min(self.layers.len() - 1);
        self.normalize_groups();
        Ok(())
    }

    /// Supprime le calque actif (dossier : avec son contenu). Il reste toujours un calque.
    pub fn delete_layer_in(&mut self) -> Result<(), Refused> {
        let r = self.subtree(self.active);
        let (s, e) = (*r.start(), *r.end());
        let left = self.layers.iter().enumerate().filter(|(k, l)| (*k < s || *k > e) && !l.group).count();
        if left == 0 {
            return Err("Le document doit garder au moins un calque");
        }
        self.layers.drain(s..=e);
        self.active = s.min(self.layers.len() - 1);
        self.normalize_groups();
        Ok(())
    }

    /// Duplique le calque actif (dossier : avec tout son contenu).
    pub fn duplicate_in(&mut self) {
        let r = self.subtree(self.active);
        let (s, e) = (*r.start(), *r.end());
        let mut map: Vec<(u64, u64)> = Vec::new();
        let mut block: Vec<Layer> = self.layers[s..=e].to_vec();
        for l in block.iter_mut() {
            let nu = crate::editor::next_uid();
            map.push((l.uid, nu));
            l.uid = nu;
        }
        for l in block.iter_mut() {
            if let Some((_, nu)) = map.iter().find(|(o, _)| *o == l.parent) {
                l.parent = *nu;
            }
        }
        if let Some(top) = block.last_mut() {
            top.name = format!("{} copie", top.name);
        }
        let n = block.len();
        let at = e + 1;
        self.layers.splice(at..at, block);
        self.active = at + n - 1;
    }

    /// Fusionner : un calque dans celui du dessous (même dossier), ou un dossier en un calque.
    pub fn merge_in(&mut self) -> Result<(), Refused> {
        let a = self.active;
        if self.layers[a].group {
            let r = self.subtree(a);
            let s = *r.start();
            let g = self.layers[a].clone();
            let mut kids: Vec<Layer> = self.layers[s..a].to_vec();
            for k in kids.iter_mut().filter(|k| k.parent == g.uid) {
                k.parent = 0;
            }
            // contenu composé à part ; le calque obtenu garde le mode et l'opacité du dossier
            let px = Doc::scratch(self.w, self.h, kids).flatten();
            let mut l = Layer::new(&g.name, self.w, self.h, [0, 0, 0, 0]);
            l.px = px.into();
            l.parent = g.parent;
            l.visible = g.visible;
            l.opacity = g.opacity;
            l.blend = if g.pass { Blend::Normal } else { g.blend };
            l.mask = g.mask.clone();
            self.layers.splice(s..=a, std::iter::once(l));
            self.active = s;
            return Ok(());
        }
        if a == 0 {
            return Err("Fusionner : pas de calque en dessous");
        }
        let below = &self.layers[a - 1];
        if below.parent != self.layers[a].parent || below.group {
            return Err("Fusionner : le calque du dessous est un dossier ou n'est pas dans le même dossier");
        }
        if self.locked_at(a - 1) {
            return Err("Fusionner : le calque du dessous est verrouillé");
        }
        // le calque du dessous devient un calque de pixels
        self.layers[a - 1].vector = None;
        self.merge_down();
        Ok(())
    }

    /// Monter / descendre d'un cran le calque actif (avec son contenu) : il entre dans un
    /// dossier déplié voisin, ou sort de son dossier en arrivant à son bord.
    pub fn move_in(&mut self, up: bool) {
        let a = self.active;
        let r = self.subtree(a);
        let (s, e) = (*r.start(), *r.end());
        let parent = self.layers[a].parent;
        let uid = self.layers[a].uid;
        if up {
            if e + 1 >= self.layers.len() {
                return;
            }
            let next = &self.layers[e + 1];
            if next.uid == parent {
                // en haut de son dossier : passe au-dessus du dossier
                let gp = next.parent;
                self.layers[a].parent = gp;
                let g = self.layers.remove(e + 1);
                self.layers.insert(s, g);
            } else {
                // voisin du dessus : sa ligne du haut est le premier calque de même parent
                let Some(t) = (e + 1..self.layers.len()).find(|&j| self.layers[j].parent == parent) else { return };
                if self.layers[t].group && !self.layers[t].collapsed {
                    // dossier déplié : on entre en bas de son contenu (déjà juste dessous)
                    self.layers[a].parent = self.layers[t].uid;
                } else {
                    let block: Vec<Layer> = self.layers.drain(s..=e).collect();
                    let t = t - block.len();
                    self.layers.splice(t + 1..t + 1, block);
                }
            }
        } else {
            if s == 0 {
                return;
            }
            let below = s - 1;
            if self.layers[below].parent != parent {
                // en bas de son dossier : passe sous le dossier
                let Some(gi) = self.index_of_uid(parent) else { return };
                let gp = self.layers[gi].parent;
                let gs = *self.subtree(gi).start();
                self.layers[a].parent = gp;
                let block: Vec<Layer> = self.layers.drain(s..=e).collect();
                self.layers.splice(gs..gs, block);
            } else if self.layers[below].group && !self.layers[below].collapsed {
                // dossier déplié dessous : on entre en haut de son contenu
                self.layers[a].parent = self.layers[below].uid;
                // (le bloc était au-dessus : l'indice du dossier ne change pas)
                let block: Vec<Layer> = self.layers.drain(s..=e).collect();
                self.layers.splice(below..below, block);
            } else {
                let ts = *self.subtree(below).start();
                let block: Vec<Layer> = self.layers.drain(s..=e).collect();
                self.layers.splice(ts..ts, block);
            }
        }
        self.active = self.index_of_uid(uid).unwrap_or(0);
        self.normalize_groups();
    }

    /// Glisser-déposer dans le panneau (lignes affichées, du haut vers le bas) : vers le haut,
    /// le calque passe au-dessus de la ligne visée (même dossier) ; vers le bas, en dessous —
    /// dans le dossier visé s'il est déplié.
    pub fn drop_row(&mut self, from_row: usize, to_row: usize) {
        let rows = self.panel_rows();
        let (Some(&(from, _)), Some(&(target, _))) = (rows.get(from_row), rows.get(to_row)) else { return };
        if from == target {
            return;
        }
        let uid = self.layers[from].uid;
        let tuid = self.layers[target].uid;
        let r = self.subtree(from);
        if r.contains(&target) {
            return; // dans son propre contenu
        }
        let block: Vec<Layer> = self.layers.drain(r).collect();
        let Some(t) = self.index_of_uid(tuid) else { return };
        let tl = &self.layers[t];
        let (parent, at) = if to_row < from_row {
            (tl.parent, t + 1)
        } else if tl.group && !tl.collapsed {
            (tl.uid, t)
        } else {
            (tl.parent, *self.subtree(t).start())
        };
        let n = block.len();
        self.layers.splice(at..at, block);
        self.layers[at + n - 1].parent = parent;
        self.active = self.index_of_uid(uid).unwrap_or(0);
        self.normalize_groups();
    }
}
