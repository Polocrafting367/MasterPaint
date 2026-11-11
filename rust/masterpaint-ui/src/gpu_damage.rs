// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Zones modifiées d'un tampon partagé (pixels d'un calque, rendu d'un filtre ƒ) par rapport à
//! une version précédente. La composition sur la carte graphique (gpu.rs, webgl.rs) reconnaît
//! ses tampons à leur adresse : après un trait de pinceau, le calque a une nouvelle adresse et
//! partait en entier (80 Mo pour une photo de 20 Mpx, autant pour le rendu ƒ au-dessus). Si
//! elle tient encore la version d'avant, seules les lignes touchées repartent.
//!
//! Les références faibles gardées ici réservent les adresses : une ancienne version ne peut
//! pas être confondue avec un nouveau tampon placé au même endroit.

use std::cell::RefCell;
use std::sync::{Arc, Weak};

struct Entry {
    base: Weak<Vec<u8>>,
    cur: Weak<Vec<u8>>,
    /// octets [début, fin) qui diffèrent entre `base` et `cur`
    bytes: (usize, usize),
}

/// Au-delà, les plus anciennes entrées sont oubliées (envoi complet, comme avant).
const MAX: usize = 48;

thread_local! {
    static DAMAGE: RefCell<Vec<Entry>> = const { RefCell::new(Vec::new()) };
}

fn same(w: &Weak<Vec<u8>>, p: *const Vec<u8>) -> bool {
    std::ptr::eq(w.as_ptr(), p)
}

/// `after` a le contenu de `before`, sauf les octets `bytes` (bornés à sa taille).
pub fn note(before: &Weak<Vec<u8>>, after: &Arc<Vec<u8>>, bytes: (usize, usize)) {
    let now = Arc::as_ptr(after);
    if same(before, now) {
        return;
    }
    let bytes = (bytes.0.min(after.len()), bytes.1.min(after.len()));
    if bytes.1 <= bytes.0 {
        return;
    }
    DAMAGE.with(|d| {
        let mut d = d.borrow_mut();
        // versions reliées : ce qui a changé depuis chacune des versions plus anciennes
        let chained: Vec<Entry> = d
            .iter()
            .filter(|e| same(&e.cur, before.as_ptr()))
            .map(|e| Entry { base: e.base.clone(), cur: Arc::downgrade(after), bytes: (e.bytes.0.min(bytes.0), e.bytes.1.max(bytes.1)) })
            .collect();
        d.extend(chained);
        d.push(Entry { base: before.clone(), cur: Arc::downgrade(after), bytes });
        let excess = d.len().saturating_sub(MAX);
        d.drain(..excess);
    });
}

/// Octets à renvoyer quand la carte graphique tient `held` et que la source est devenue `now`
/// (None : inconnu, tout renvoyer).
pub fn since(held: &Weak<Vec<u8>>, now: &Arc<Vec<u8>>) -> Option<(usize, usize)> {
    let p = Arc::as_ptr(now);
    DAMAGE.with(|d| d.borrow().iter().rev().find(|e| same(&e.cur, p) && std::ptr::eq(e.base.as_ptr(), held.as_ptr())).map(|e| e.bytes))
}

/// Lignes [y0, y1) d'une image de largeur `w` (RVBA), en octets.
pub fn rows(w: usize, y0: usize, y1: usize) -> (usize, usize) {
    (y0 * w * 4, y1 * w * 4)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chained_versions_keep_every_base() {
        let a = Arc::new(vec![0u8; 64]);
        let b = Arc::new(vec![0u8; 64]);
        let c = Arc::new(vec![0u8; 64]);
        note(&Arc::downgrade(&a), &b, (8, 16));
        note(&Arc::downgrade(&b), &c, (32, 40));
        assert_eq!(since(&Arc::downgrade(&a), &c), Some((8, 40)));
        assert_eq!(since(&Arc::downgrade(&b), &c), Some((32, 40)));
        assert_eq!(since(&Arc::downgrade(&c), &a), None);
    }
}
