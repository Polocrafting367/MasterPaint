/**
 * Liste de polices pour l’outil texte (stacks CSS + polices locales via queryLocalFonts si disponible).
 * Les navigateurs ne peuvent pas énumérer toutes les polices du système sans permission (API Local Font Access).
 */
(function () {
    const PRESETS = [
        {
            key: 'fonts.groupSans',
            fb: 'Sans-serif',
            items: [
                ['Arial, sans-serif', 'Arial'],
                ['Helvetica, Arial, sans-serif', 'Helvetica'],
                ['"Arial Black", Gadget, sans-serif', 'Arial Black'],
                ['Verdana, Geneva, sans-serif', 'Verdana'],
                ['Tahoma, Geneva, sans-serif', 'Tahoma'],
                ['Trebuchet MS, Lucida Sans Unicode, sans-serif', 'Trebuchet MS'],
                ['Segoe UI, Tahoma, Geneva, sans-serif', 'Segoe UI'],
                ['Calibri, Candara, Verdana, sans-serif', 'Calibri'],
                ['Candara, Verdana, sans-serif', 'Candara'],
                ['Corbel, Verdana, sans-serif', 'Corbel'],
                ['Century Gothic, CenturyGothic, AppleGothic, sans-serif', 'Century Gothic'],
                ['Franklin Gothic Medium, Arial, sans-serif', 'Franklin Gothic Medium'],
                ['Lucida Sans Unicode, Lucida Grande, sans-serif', 'Lucida Sans Unicode'],
                ['Lucida Grande, Lucida Sans Unicode, sans-serif', 'Lucida Grande'],
                ['Optima, Segoe UI, sans-serif', 'Optima'],
                ['Gill Sans, Gill Sans MT, Calibri, sans-serif', 'Gill Sans'],
                ['Futura, Century Gothic, sans-serif', 'Futura'],
                ['Liberation Sans, Arial, sans-serif', 'Liberation Sans'],
                ['DejaVu Sans, Arial, sans-serif', 'DejaVu Sans'],
                ['Noto Sans, Arial, sans-serif', 'Noto Sans'],
                ['Ubuntu, Cantarell, sans-serif', 'Ubuntu'],
                ['Bahnschrift, Helvetica, Arial, sans-serif', 'Bahnschrift'],
                ['Segoe Print, Verdana, sans-serif', 'Segoe Print'],
                ['Segoe Script, Brush Script MT, cursive', 'Segoe Script'],
                ['MV Boli, sans-serif', 'MV Boli']
            ]
        },
        {
            key: 'fonts.groupSerif',
            fb: 'Serif',
            items: [
                ['Times New Roman, Times, serif', 'Times New Roman'],
                ['Georgia, serif', 'Georgia'],
                ['Cambria, Georgia, serif', 'Cambria'],
                ['Garamond, Times New Roman, serif', 'Garamond'],
                ['Palatino Linotype, Palatino, Book Antiqua, serif', 'Palatino Linotype'],
                ['Book Antiqua, Palatino, serif', 'Book Antiqua'],
                ['Baskerville, Times New Roman, serif', 'Baskerville'],
                ['Constantia, Georgia, serif', 'Constantia'],
                ['Didot, Didot LT STD, Times New Roman, serif', 'Didot'],
                ['Liberation Serif, Times New Roman, serif', 'Liberation Serif'],
                ['Noto Serif, Georgia, serif', 'Noto Serif']
            ]
        },
        {
            key: 'fonts.groupMono',
            fb: 'Monospace',
            items: [
                ['Courier New, Courier, monospace', 'Courier New'],
                ['Consolas, Monaco, monospace', 'Consolas'],
                ['Monaco, Menlo, Consolas, monospace', 'Monaco'],
                ['Menlo, Monaco, Consolas, monospace', 'Menlo'],
                ['Lucida Console, Monaco, monospace', 'Lucida Console'],
                ['Andale Mono, Courier New, monospace', 'Andale Mono'],
                ['DejaVu Sans Mono, Consolas, monospace', 'DejaVu Sans Mono'],
                ['Liberation Mono, Courier New, monospace', 'Liberation Mono']
            ]
        },
        {
            key: 'fonts.groupDisplay',
            fb: 'Affichage & manuscrites',
            items: [
                ['Impact, Haettenschweiler, Arial Narrow Bold, sans-serif', 'Impact'],
                ['Comic Sans MS, cursive', 'Comic Sans MS'],
                ['Brush Script MT, cursive', 'Brush Script MT'],
                ['Marker Felt, fantasy', 'Marker Felt'],
                ['Trattatello, fantasy', 'Trattatello'],
                ['Chalkduster, fantasy', 'Chalkduster'],
                ['Papyrus, fantasy', 'Papyrus'],
                ['Copperplate, Papyrus, fantasy', 'Copperplate'],
                ['Rockwell, Courier Bold, serif', 'Rockwell']
            ]
        }
    ];

    function groupLabel(key, fb) {
        if (window.IlluI18n && typeof window.IlluI18n.t === 'function') {
            const s = window.IlluI18n.t(key);
            if (s !== key) return s;
        }
        return fb;
    }

    function ensureCustomOptgroup(sel) {
        let og = document.getElementById('illu-text-font-custom-optgroup');
        if (!og) {
            og = document.createElement('optgroup');
            og.id = 'illu-text-font-custom-optgroup';
            og.label = groupLabel('fonts.groupCustom', 'Autre');
            sel.appendChild(og);
        }
        return og;
    }

    /** HTMLOptGroupElement n’a pas de .options — uniquement les &lt;option&gt; enfants. */
    function optgroupOptions(og) {
        return og ? [...og.querySelectorAll('option')] : [];
    }

    function ensureLocalOptgroup(sel) {
        let og = document.getElementById('illu-text-font-local-optgroup');
        if (!og) {
            og = document.createElement('optgroup');
            og.id = 'illu-text-font-local-optgroup';
            og.label = groupLabel('fonts.groupLocal', 'Polices locales (OS)');
            og.hidden = true;
            sel.appendChild(og);
        }
        return og;
    }

    window.populateIlluTextFontSelect = function () {
        const sel = document.getElementById('tool-text-font');
        if (!sel) return;
        const prev = sel.value;
        const hadLocal = document.getElementById('illu-text-font-local-optgroup');
        const localChildren = hadLocal ? [...hadLocal.querySelectorAll('option')].map((o) => ({ v: o.value, t: o.textContent })) : [];

        sel.textContent = '';

        PRESETS.forEach((g) => {
            const og = document.createElement('optgroup');
            og.label = groupLabel(g.key, g.fb);
            g.items.forEach(([value, label]) => {
                const o = document.createElement('option');
                o.value = value;
                o.textContent = label;
                og.appendChild(o);
            });
            sel.appendChild(og);
        });

        if (localChildren.length) {
            const og = document.createElement('optgroup');
            og.id = 'illu-text-font-local-optgroup';
            og.label = groupLabel('fonts.groupLocal', 'Polices locales (OS)');
            localChildren.forEach(({ v, t }) => {
                const o = document.createElement('option');
                o.value = v;
                o.textContent = t;
                og.appendChild(o);
            });
            sel.appendChild(og);
        }

        const match = [...sel.options].some((o) => o.value === prev);
        if (match) {
            sel.value = prev;
        } else if (prev) {
            const cog = ensureCustomOptgroup(sel);
            const o = document.createElement('option');
            o.value = prev;
            o.textContent = (prev.split(',')[0] || 'Police').replace(/^["']|["']$/g, '').trim() || 'Police';
            cog.appendChild(o);
            sel.value = prev;
        } else {
            sel.value = 'Arial, sans-serif';
        }
    };

    window.syncIlluTextFontSelectFromToolProps = function () {
        const sel = document.getElementById('tool-text-font');
        if (!sel || typeof EditorManager === 'undefined') return;
        const v = EditorManager.toolProps.textFont || 'Arial, sans-serif';
        if ([...sel.options].some((o) => o.value === v)) {
            sel.value = v;
            return;
        }
        const cog = ensureCustomOptgroup(sel);
        if (!optgroupOptions(cog).some((o) => o.value === v)) {
            const o = document.createElement('option');
            o.value = v;
            o.textContent = (v.split(',')[0] || 'Police').replace(/^["']|["']$/g, '').trim() || 'Police';
            cog.appendChild(o);
        }
        sel.value = v;
    };

    function cssStackForFamilyName(name) {
        const safe = String(name || '').replace(/"/g, '').trim();
        if (!safe) return 'sans-serif';
        if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(safe)) return safe;
        return `"${safe}", sans-serif`;
    }

    window.loadIlluLocalFonts = async function () {
        if (typeof window.queryLocalFonts !== 'function') {
            if (typeof window.showIlluAlert === 'function') {
                window.showIlluAlert(
                    window.IlluI18n && typeof window.IlluI18n.t === 'function'
                        ? window.IlluI18n.t('fonts.localUnavailable')
                        : 'Les polices du système ne sont pas lisibles dans ce navigateur. Utilisez Chrome ou Edge en HTTPS, ou choisissez une police dans la liste.'
                );
            }
            return;
        }
        let fonts;
        try {
            fonts = await window.queryLocalFonts();
        } catch (err) {
            if (typeof window.showIlluAlert === 'function') {
                window.showIlluAlert(
                    (window.IlluI18n && window.IlluI18n.t('fonts.localDenied')) || 'Accès aux polices refusé ou annulé.'
                );
            }
            return;
        }
        const sel = document.getElementById('tool-text-font');
        if (!sel || !fonts || !fonts.length) return;

        const families = [...new Set(fonts.map((f) => f.family).filter(Boolean))];
        families.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        let og = document.getElementById('illu-text-font-local-optgroup');
        if (og) {
            og.remove();
        }
        og = document.createElement('optgroup');
        og.id = 'illu-text-font-local-optgroup';
        og.label = groupLabel('fonts.groupLocal', 'Polices locales (OS)');
        families.forEach((fam) => {
            const o = document.createElement('option');
            o.value = cssStackForFamilyName(fam);
            o.textContent = fam;
            og.appendChild(o);
        });
        sel.appendChild(og);
        og.hidden = false;

        if (typeof window.syncIlluTextFontSelectFromToolProps === 'function') {
            window.syncIlluTextFontSelectFromToolProps();
        }
    };

    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('tool-text-font-scan');
        if (btn) {
            btn.addEventListener('click', () => {
                window.loadIlluLocalFonts();
            });
        }
    });
})();
