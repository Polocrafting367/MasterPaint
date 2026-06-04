/**
 * Liste de polices pour l’outil texte.
 * Contient EXCLUSIVEMENT des polices Web (Google Fonts). Plus aucune police locale.
 */
(function () {
    const PRESETS = [
        {
            key: 'fonts.groupSans',
            fb: 'Sans-serif (Web)',
            items: [
                ['Roboto, sans-serif', 'Roboto'],
                ['"Open Sans", sans-serif', 'Open Sans'],
                ['Montserrat, sans-serif', 'Montserrat'],
                ['Lato, sans-serif', 'Lato'],
                ['Poppins, sans-serif', 'Poppins'],
                ['Inter, sans-serif', 'Inter'],
                ['Nunito, sans-serif', 'Nunito'],
                ['Ubuntu, sans-serif', 'Ubuntu'],
                ['Oswald, sans-serif', 'Oswald'],
                ['"Bebas Neue", sans-serif', 'Bebas Neue'],
                ['Anton, sans-serif', 'Anton']
            ]
        },
        {
            key: 'fonts.groupSerif',
            fb: 'Serif (Web)',
            items: [
                ['"Playfair Display", serif', 'Playfair Display'],
                ['Merriweather, serif', 'Merriweather'],
                ['Lora, serif', 'Lora'],
                ['"PT Serif", serif', 'PT Serif'],
                ['"Crimson Text", serif', 'Crimson Text'],
                ['"EB Garamond", serif', 'EB Garamond'],
                ['Cinzel, serif', 'Cinzel']
            ]
        },
        {
            key: 'fonts.groupMono',
            fb: 'Code & Monospace (Web)',
            items: [
                ['"Fira Code", monospace', 'Fira Code'],
                ['Inconsolata, monospace', 'Inconsolata'],
                ['"Source Code Pro", monospace', 'Source Code Pro']
            ]
        },
        {
            key: 'fonts.groupRetro',
            fb: 'Rétro & Pixel (Web)',
            items: [
                ['"Press Start 2P", monospace', 'Press Start 2P'],
                ['VT323, monospace', 'VT323'],
                ['Silkscreen, monospace', 'Silkscreen'],
                ['"Pixelify Sans", monospace', 'Pixelify Sans'],
                ['DotGothic16, monospace', 'DotGothic16'],
                ['"Share Tech Mono", monospace', 'Share Tech Mono']
            ]
        },
        {
            key: 'fonts.groupSciFi',
            fb: 'Science-fiction & Tech (Web)',
            items: [
                ['Orbitron, sans-serif', 'Orbitron'],
                ['Audiowide, sans-serif', 'Audiowide'],
                ['Michroma, sans-serif', 'Michroma'],
                ['"Russo One", sans-serif', 'Russo One'],
                ['"Black Ops One", sans-serif', 'Black Ops One'],
                ['Bungee, sans-serif', 'Bungee']
            ]
        },
        {
            key: 'fonts.groupCursive',
            fb: 'Manuscrite & Cursive (Web)',
            items: [
                ['Pacifico, cursive', 'Pacifico'],
                ['Caveat, cursive', 'Caveat'],
                ['"Dancing Script", cursive', 'Dancing Script'],
                ['Satisfy, cursive', 'Satisfy'],
                ['"Great Vibes", cursive', 'Great Vibes'],
                ['"Amatic SC", cursive', 'Amatic SC'],
                ['"Indie Flower", cursive', 'Indie Flower'],
                ['"Permanent Marker", cursive', 'Permanent Marker'],
                ['Lobster, cursive', 'Lobster'],
                ['Righteous, cursive', 'Righteous']
            ]
        },
        {
            key: 'fonts.groupFantasy',
            fb: 'Fantaisie & Autres (Web)',
            items: [
                ['Creepster, fantasy', 'Creepster'],
                ['Bangers, cursive', 'Bangers']
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

    function optgroupOptions(og) {
        return og ? [...og.querySelectorAll('option')] : [];
    }

    window.populateIlluTextFontSelect = function () {
        const sel = document.getElementById('tool-text-font');
        if (!sel) return;
        const prev = sel.value;

        sel.textContent = '';
        let allFonts = [];

        PRESETS.forEach((g) => {
            const og = document.createElement('optgroup');
            og.label = groupLabel(g.key, g.fb);
            g.items.forEach(([value, label]) => {
                const o = document.createElement('option');
                o.value = value;
                o.textContent = label;
                o.style.fontFamily = value;
                og.appendChild(o);
                allFonts.push({ value, label, fontFamily: value, group: og.label });
            });
            sel.appendChild(og);
        });

        const match = [...sel.options].some((o) => o.value === prev);
        if (match) {
            sel.value = prev;
        } else if (prev) {
            const cog = ensureCustomOptgroup(sel);
            const o = document.createElement('option');
            o.value = prev;
            o.textContent = (prev.split(',')[0] || 'Police').replace(/^["']|["']$/g, '').trim() || 'Police';
            o.style.fontFamily = prev;
            cog.appendChild(o);
            sel.value = prev;
            allFonts.push({ value: prev, label: o.textContent, fontFamily: prev, group: cog.label });
        } else {
            sel.value = 'Arial, sans-serif';
        }

        setupCustomFontComboBox(sel, allFonts);
    };

    window.syncIlluTextFontSelectFromToolProps = function () {
        const sel = document.getElementById('tool-text-font');
        if (!sel || typeof EditorManager === 'undefined') return;
        const v = EditorManager.toolProps.textFont || 'Arial, sans-serif';
        if ([...sel.options].some((o) => o.value === v)) {
            sel.value = v;
        } else {
            const cog = ensureCustomOptgroup(sel);
            if (!optgroupOptions(cog).some((o) => o.value === v)) {
                const o = document.createElement('option');
                o.value = v;
                o.textContent = (v.split(',')[0] || 'Police').replace(/^["']|["']$/g, '').trim() || 'Police';
                o.style.fontFamily = v;
                cog.appendChild(o);
                if (sel.parentElement && sel.parentElement._allFonts) {
                    sel.parentElement._allFonts.push({ value: v, label: o.textContent, fontFamily: v, group: cog.label });
                }
            }
            sel.value = v;
        }

        // Sync input
        if (sel.parentElement && sel.parentElement.classList.contains('illu-font-combo-wrap')) {
            const input = sel.parentElement.querySelector('input');
            const opt = sel.options[sel.selectedIndex];
            if (input && opt) input.value = opt.textContent;
        }
    };

    function setupCustomFontComboBox(sel, allFonts) {
        let wrap = sel.parentElement;
        let input, listDiv;

        if (!wrap || !wrap.classList.contains('illu-font-combo-wrap')) {
            wrap = document.createElement('div');
            wrap.className = 'illu-font-combo-wrap';
            wrap.style.position = 'relative';
            wrap.style.display = 'inline-block';
            wrap.style.width = '100%';
            wrap.style.verticalAlign = 'middle';
            wrap._allFonts = allFonts;

            sel.parentNode.insertBefore(wrap, sel);
            wrap.appendChild(sel);
            sel.style.setProperty('display', 'none', 'important');

            input = document.createElement('input');
            input.type = 'text';
            input.id = 'tool-text-font-input';
            input.className = sel.className.replace('illu-text-font-select', '');
            input.style.width = '100%';
            input.style.boxSizing = 'border-box';
            input.style.padding = '0 6px';
            input.style.height = '22px';
            input.style.maxHeight = '22px';
            input.style.lineHeight = '20px';
            input.placeholder = 'Rechercher...';
            input.autocomplete = 'off';
            input.style.fontFamily = 'var(--mp-font, var(--ui-font))';
            input.style.borderRadius = 'var(--mp-radius, 4px)';
            input.style.border = '1px solid var(--mp-inset-top, #dfdfdf)';
            input.style.background = 'var(--mp-surface, #fff)';
            input.style.color = 'var(--mp-text, #000)';

            listDiv = document.createElement('div');
            listDiv.className = 'illu-font-combo-list illu-win-panel';
            listDiv.style.position = 'absolute';
            listDiv.style.top = '100%';
            listDiv.style.left = '0';
            listDiv.style.right = '0';
            listDiv.style.maxHeight = '450px';
            listDiv.style.overflowY = 'auto';
            listDiv.style.overflowX = 'hidden';
            listDiv.style.zIndex = '100000';
            listDiv.style.display = 'none';
            listDiv.style.background = 'var(--mp-surface, var(--win-bg, #c0c0c0))';
            listDiv.style.border = '1px solid var(--mp-raised-top, var(--win-border-dark, #808080))';
            listDiv.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
            listDiv.style.borderRadius = 'var(--mp-radius, 4px)';

            wrap.appendChild(input);
            wrap.appendChild(listDiv);

            function closeList() {
                listDiv.style.display = 'none';
            }

            function renderList(query) {
                listDiv.innerHTML = '';
                const q = (query || '').toLowerCase();
                let currentGroup = null;

                wrap._allFonts.forEach(f => {
                    if (f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)) {
                        if (currentGroup !== f.group) {
                            const gEl = document.createElement('div');
                            gEl.textContent = f.group;
                            gEl.style.padding = '4px 6px';
                            gEl.style.fontSize = '10px';
                            gEl.style.fontWeight = 'bold';
                            gEl.style.background = 'var(--mp-surface-deep, var(--win-title-bg, #000080))';
                            gEl.style.color = 'var(--mp-text, var(--win-title-fg, #fff))';
                            gEl.style.textTransform = 'uppercase';
                            gEl.style.borderBottom = '1px solid var(--mp-raised-top, transparent)';
                            listDiv.appendChild(gEl);
                            currentGroup = f.group;
                        }
                        const item = document.createElement('div');
                        item.textContent = f.label;
                        item.style.padding = '4px 6px';
                        item.style.cursor = 'pointer';
                        item.style.fontFamily = f.fontFamily;
                        item.style.fontSize = '14px';
                        item.style.color = 'var(--mp-text, var(--text-normal, #000))';
                        item.style.whiteSpace = 'nowrap';
                        item.style.overflow = 'hidden';
                        item.style.textOverflow = 'ellipsis';

                        item.onmouseover = () => {
                            item.style.background = 'var(--mp-accent, var(--accent-bg, #000080))';
                            item.style.color = 'var(--mp-menu-hover-fg, var(--accent-fg, #fff))';
                        };
                        item.onmouseout = () => {
                            item.style.background = 'transparent';
                            item.style.color = 'var(--mp-text, var(--text-normal, #000))';
                        };
                        item.onmousedown = (e) => {
                            e.preventDefault(); // Prevent blur
                            input.value = f.label;
                            sel.value = f.value;
                            closeList();
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                        };
                        listDiv.appendChild(item);
                    }
                });
                if (listDiv.children.length === 0) {
                    const noEl = document.createElement('div');
                    noEl.textContent = 'Aucun résultat';
                    noEl.style.padding = '4px 6px';
                    noEl.style.fontStyle = 'italic';
                    noEl.style.color = 'var(--text-muted, #666)';
                    listDiv.appendChild(noEl);
                }
            }

            input.addEventListener('focus', () => {
                input.select();
                renderList('');
                listDiv.style.display = 'block';
            });

            input.addEventListener('input', () => {
                renderList(input.value);
                listDiv.style.display = 'block';
            });

            input.addEventListener('blur', () => {
                setTimeout(closeList, 150);
                const match = wrap._allFonts.find(f => f.label.toLowerCase() === input.value.trim().toLowerCase());
                if (match) {
                    input.value = match.label;
                    if (sel.value !== match.value) {
                        sel.value = match.value;
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else if (input.value.trim()) {
                    // Allow custom system font typed by user
                    sel.value = input.value.trim();
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    const opt = sel.options[sel.selectedIndex];
                    input.value = opt ? opt.textContent : '';
                }
            });

            sel.addEventListener('change', () => {
                const opt = sel.options[sel.selectedIndex];
                if (opt) input.value = opt.textContent;
            });
        } else {
            wrap._allFonts = allFonts;
            input = wrap.querySelector('input');
        }

        const opt = sel.options[sel.selectedIndex];
        if (opt && input) {
            input.value = opt.textContent;
        }
    }

    // Auto-load local fonts from fonts directory
    fetch('fonts/fonts-api.php')
        .then(r => r.json())
        .then(fonts => {
            if (!fonts || !fonts.length) return;

            let style = document.getElementById('illu-local-fonts');
            if (!style) {
                style = document.createElement('style');
                style.id = 'illu-local-fonts';
                document.head.appendChild(style);
            }

            let css = '';

            // Define categories
            let categories = {
                'Manuscrit (Local)': [],
                'Fantastique (Local)': [],
                'Informatique (Local)': [],
                'Autres (Local)': []
            };
            let families = {};

            fonts.forEach(f => {
                css += `@font-face { font-family: "${f.name}"; src: url("${f.url}"); }\n`;
                const n = f.name.toLowerCase();
                const item = [`"${f.name}"`, f.name];

                if (n.includes('minecraft') || n.startsWith('star ') || n.includes('magic') || n.includes('fantasy')) {
                    categories['Fantastique (Local)'].push(item);
                }
                else if (n.includes('pixel') || n.includes('7 segment') || n.includes('7segment') || n.includes('digital') || n.includes('lcd') || n.includes('bit') || n.includes('computer') || n.includes('tech')) {
                    categories['Informatique (Local)'].push(item);
                }
                else if (n.includes('marker') || n.includes('pen ') || n.includes('pencil') || n.includes('script') || n.includes('hand') || n.includes('brush') || n.includes('chalk') || n.includes('crayon') || n.includes('feutre')) {
                    categories['Manuscrit (Local)'].push(item);
                }
                else {
                    categories['Autres (Local)'].push(item);
                }
            });

            for (let cat in categories) {
                if (categories[cat].length > 0) {
                    PRESETS.push({
                        key: 'fonts.group' + cat.replace(/\s+/g, ''),
                        fb: cat,
                        items: categories[cat]
                    });
                }
            }

            style.textContent = css;

            // Refresh select
            if (typeof window.populateIlluTextFontSelect === 'function') {
                window.populateIlluTextFontSelect();
            }
        })
        .catch(e => console.log('No local fonts found or error fetching fonts/fonts-api.php:', e));
})();
