// MasterPaint — © 2026 polocrafting — https://polocrafting.fr. Voir COPYRIGHT.md / See COPYRIGHT.md.
//! Traduction des textes de l'interface écrits côté Rust (barre d'état, erreurs, fenêtres de
//! choix, fenêtres d'effets) : mêmes fichiers lang/<langue>/LC_MESSAGES/masterpaint-ui.po que
//! les textes @tr des fichiers .slint (tools/gen_lang.py les relève tous). Le français est la
//! langue des sources ; un texte sans traduction reste en français.

use std::cell::RefCell;
use std::collections::HashMap;

/// Fichiers .po des langues autres que le français, compressés à la compilation (build.rs :
/// 1,4 Mo de texte, quatre fois moins une fois compressés) ; seule la langue choisie est
/// décompressée.
const PO_Z: [(&str, &[u8]); 5] = [
    ("en", include_bytes!(concat!(env!("OUT_DIR"), "/po-en.z"))),
    ("es", include_bytes!(concat!(env!("OUT_DIR"), "/po-es.z"))),
    ("de", include_bytes!(concat!(env!("OUT_DIR"), "/po-de.z"))),
    ("it", include_bytes!(concat!(env!("OUT_DIR"), "/po-it.z"))),
    ("pt", include_bytes!(concat!(env!("OUT_DIR"), "/po-pt.z"))),
];

fn po(code: &str) -> Option<String> {
    use std::io::Read;
    let z = PO_Z.iter().find(|(c, _)| *c == code)?.1;
    let mut s = String::new();
    flate2::read::DeflateDecoder::new(z).read_to_string(&mut s).ok()?;
    Some(s)
}

thread_local! {
    /// texte français → traduction de la langue choisie (vide : français)
    static MAP: RefCell<HashMap<String, String>> = RefCell::new(HashMap::new());
    static TEMPLATES: RefCell<Vec<(String, String)>> = const { RefCell::new(Vec::new()) };
}

/// Déséchappe une chaîne .po (\" \\ \n \t).
fn unescape(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut it = s.chars();
    while let Some(c) = it.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }
        match it.next() {
            Some('n') => out.push('\n'),
            Some('t') => out.push('\t'),
            Some('r') => out.push('\r'),
            Some(o) => out.push(o),
            None => {}
        }
    }
    out
}

/// Traductions d'un fichier .po (entrées traduites seulement).
fn parse(po: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let (mut id, mut st): (Option<String>, Option<String>) = (None, None);
    let mut in_id = false;
    let flush = |id: &mut Option<String>, st: &mut Option<String>, map: &mut HashMap<String, String>| {
        if let (Some(i), Some(s)) = (id.take(), st.take()) {
            if !i.is_empty() && !s.is_empty() {
                map.insert(unescape(&i), unescape(&s));
            }
        }
    };
    for line in po.lines() {
        let line = line.trim();
        if let Some(r) = line.strip_prefix("msgid \"") {
            flush(&mut id, &mut st, &mut map);
            id = Some(r.strip_suffix('"').unwrap_or(r).to_string());
            in_id = true;
        } else if let Some(r) = line.strip_prefix("msgstr \"") {
            st = Some(r.strip_suffix('"').unwrap_or(r).to_string());
            in_id = false;
        } else if line.starts_with('"') && line.len() >= 2 {
            let part = &line[1..line.len() - 1];
            match (in_id, id.as_mut(), st.as_mut()) {
                (true, Some(i), _) => i.push_str(part),
                (false, _, Some(s)) => s.push_str(part),
                _ => {}
            }
        }
    }
    flush(&mut id, &mut st, &mut map);
    map
}

/// Langue des textes Rust (code des dossiers de lang/ ; « fr » : textes d'origine).
pub fn set_language(code: &str) {
    let map = po(code).map(|po| parse(&po)).unwrap_or_default();
    let mut templates: Vec<_> = map.iter().filter_map(|(source, target)| {
        let parsed = parts(source)?;
        let letters = parsed.iter().map(|p| match p {
            Part::Text(t) => t.chars().filter(|c| c.is_alphabetic()).count(),
            Part::Field(_) => 0,
        }).sum::<usize>();
        // Symbol-only formats are not UI messages and must not match arbitrary user data.
        (letters >= 3 && parsed.iter().any(|p| matches!(p, Part::Field(_))))
            .then(|| (source.clone(), target.clone()))
    }).collect();
    templates.sort_by_key(|(source, _)| std::cmp::Reverse(source.len()));
    TEMPLATES.with(|t| *t.borrow_mut() = templates);
    MAP.with(|m| *m.borrow_mut() = map);
}

/// A format token retains its specifier, so `{n}` and `{n:.1}` remain distinct.
#[derive(Clone, Debug)]
enum Part {
    Text(String),
    Field(String),
}

fn parts(template: &str) -> Option<Vec<Part>> {
    let mut out = Vec::new();
    let mut text = String::new();
    let mut chars = template.chars().peekable();
    let mut anonymous = 0;
    while let Some(c) = chars.next() {
        match c {
            '{' if chars.peek() == Some(&'{') => { chars.next(); text.push('{'); }
            '}' if chars.peek() == Some(&'}') => { chars.next(); text.push('}'); }
            '{' => {
                if !text.is_empty() { out.push(Part::Text(std::mem::take(&mut text))); }
                let mut key = String::new();
                loop {
                    match chars.next() {
                        Some('}') => break,
                        Some('{') | None => return None,
                        Some(c) => key.push(c),
                    }
                }
                if key.is_empty() || key.starts_with(':') {
                    key = format!("#{anonymous}{key}");
                    anonymous += 1;
                }
                // Adjacent fields have no separator. Keep their already-formatted value
                // together, provided the translation preserves the same adjacent fields.
                if let Some(Part::Field(previous)) = out.last_mut() {
                    previous.push('\u{1f}');
                    previous.push_str(&key);
                } else {
                    out.push(Part::Field(key));
                }
            }
            '}' => return None,
            _ => text.push(c),
        }
    }
    if !text.is_empty() { out.push(Part::Text(text)); }
    Some(out)
}

/// Recover values from a message formatted by Rust, then insert them in the translated
/// template. No dynamic string is passed to `format!`; format specifiers are already applied.
fn render(source: &str, translated: &str, message: &str) -> Option<String> {
    let src = parts(source)?;
    let dst = parts(translated)?;
    let mut values = HashMap::new();
    let mut rest = message;
    for (i, part) in src.iter().enumerate() {
        match part {
            Part::Text(text) => rest = rest.strip_prefix(text.as_str())?,
            Part::Field(key) => {
                let end = match src.get(i + 1) {
                    Some(Part::Text(text)) if i + 2 == src.len() => rest.len().checked_sub(text.len()).filter(|_| rest.ends_with(text))?,
                    Some(Part::Text(text)) => rest.find(text.as_str())?,
                    Some(Part::Field(_)) => return None, // Adjacent values have no unambiguous boundary.
                    None => rest.len(),
                };
                let value = rest.get(..end)?;
                if values.get(key).is_some_and(|v| *v != value) { return None; }
                values.insert(key.clone(), value);
                rest = rest.get(end..)?;
            }
        }
    }
    if !rest.is_empty() { return None; }
    let mut output = String::new();
    for part in dst {
        match part {
            Part::Text(text) => output.push_str(&text),
            Part::Field(key) => output.push_str(values.get(&key)?),
        }
    }
    Some(output)
}

/// Translate a known template before displaying its formatted values.
pub fn formatted(source: &str, message: &str) -> String {
    MAP.with(|map| {
        let map = map.borrow();
        map.get(source).and_then(|translated| render(source, translated, message))
            .unwrap_or_else(|| message.to_owned())
    })
}

macro_rules! tr_format {
    ($source:literal $(, $arg:expr)* $(,)?) => {
        $crate::i18n::formatted($source, &format!($source $(, $arg)*))
    };
}
pub(crate) use tr_format;

/// Exact lookup first. Formatted messages returned by background workers are translated on
/// the UI thread, which owns the selected language. Most specific templates take priority.
pub fn tr(s: &str) -> String {
    if let Some(text) = MAP.with(|map| map.borrow().get(s).cloned()) { return text; }
    TEMPLATES.with(|templates| {
        for (source, translated) in templates.borrow().iter() {
            if let Some(text) = render(source, translated, s) { return text; }
        }
        s.to_owned()
    })
}

#[cfg(test)]
mod tests {
    #[test]
    fn po_lookup() {
        let po = "msgid \"\"\nmsgstr \"\"\n\"Language: en\\n\"\n\n#: x\nmsgid \"Ouvrir\"\nmsgstr \"Open\"\n\nmsgid \"Vide\"\nmsgstr \"\"\n\nmsgid \"Ligne \\\"a\\\"\"\nmsgstr \"Line \\\"a\\\"\"\n";
        let m = super::parse(po);
        assert_eq!(m.get("Ouvrir").map(String::as_str), Some("Open"));
        assert_eq!(m.get("Vide"), None, "traduction vide : texte d'origine");
        assert_eq!(m.get("Ligne \"a\"").map(String::as_str), Some("Line \"a\""));
    }
}

#[cfg(test)]
mod format_tests {
    use super::*;

    #[test]
    fn translated_values_and_reordering() {
        assert_eq!(render("Calque {n} sur {total}", "Layer {n} of {total}", "Calque 2 sur 12").as_deref(), Some("Layer 2 of 12"));
        assert_eq!(render("{name} : {n} photos", "{n} photos: {name}", "été.jpg : 3 photos").as_deref(), Some("3 photos: été.jpg"));
        assert_eq!(render("Exporté : {}", "Exported: {}", "Exporté : /tmp/a b.png").as_deref(), Some("Exported: /tmp/a b.png"));
        assert_eq!(render("Aperçu : {ms:.0} ms", "Preview: {ms:.0} ms", "Aperçu : 12 ms").as_deref(), Some("Preview: 12 ms"));
        assert_eq!(render("{{Image}} : {}", "{{Image}}: {}", "{Image} : test").as_deref(), Some("{Image}: test"));
        assert_eq!(render("Sans titre {n}{}", "Untitled {n}{}", "Sans titre 2 (RAL)").as_deref(), Some("Untitled 2 (RAL)"));
        assert_eq!(render("Couleur : #{:02X}{:02X}{:02X}", "Color: #{:02X}{:02X}{:02X}", "Couleur : #FF0000").as_deref(), Some("Color: #FF0000"));
        assert!(render("Exporté : {}", "Exported: {other}", "Exporté : a").is_none());
        assert!(render("Exporté : {}", "Exported: {}", "Autre : a").is_none());
    }

    #[test]
    fn language_switch_and_worker_messages() {
        set_language("en");
        assert_eq!(tr("Ouvrir"), "Open");
        assert_eq!(tr("Sélection : 12 × 34 px"), "Selection: 12 × 34 px");
        assert_eq!(tr_format!("Sélection : {} × {} px", 12, 34), "Selection: 12 × 34 px");
        set_language("fr");
        assert_eq!(tr("Ouvrir"), "Ouvrir");
        set_language("unknown");
        assert_eq!(tr("Ouvrir"), "Ouvrir");
    }

    #[test]
    fn every_translated_template_can_render() {
        for (language, _) in PO_Z {
            for (source, target) in parse(&po(language).unwrap()) {
                let Some(src) = parts(&source) else { continue };
                if !src.iter().any(|p| matches!(p, Part::Field(_))) { continue; }
                let mut message = String::new();
                for part in &src {
                    match part {
                        Part::Text(text) => message.push_str(text),
                        Part::Field(key) => message.push_str(&format!("value[{key}]")),
                    }
                }
                assert!(render(&source, &target, &message).is_some(), "{language}: {source} => {target}");
            }
        }
    }

    #[test]
    fn escaped_quote_at_end_and_multiline() {
        let parsed = parse("msgid \"Texte\"\nmsgstr \"Text \\\"end\\\"\"\n\nmsgid \"Lignes\"\nmsgstr \"\"\n\"a\\nb\"\n");
        assert_eq!(parsed.get("Texte").map(String::as_str), Some("Text \"end\""));
        assert_eq!(parsed.get("Lignes").map(String::as_str), Some("a\nb"));
    }
}
