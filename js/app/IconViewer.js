/**
 * IconViewer.js — Visionneuse d'icônes MasterPaint
 *
 * Onglet 1 : Icônes FontAwesome (fa-solid, fa-regular, fa-brands)
 *            Parsées dynamiquement depuis vendor/fontawesome/css/all.min.css
 * Onglet 2 : Icônes SVG internes (symbols inline dans #illu-shape-icons-sprite)
 *
 * Cette version affiche la visionneuse sous forme de boîte de dialogue fixe (modal overlay)
 * similaire aux paramètres (settings-overlay), sans déplacement.
 */
(function () {
    'use strict';

    const WIN_ID   = 'win-icon-viewer';
    const FA_CSS   = 'vendor/fontawesome/css/all.min.css';

    // ── Catégories FA (groupements visuels) ─────────────────────────────────
    const FA_CATEGORIES = {
        'Interfaces / Actions': ['save','floppy-disk','folder-open','file','print','copy','paste','scissors','trash','trash-can','undo','redo','rotate-left','rotate-right','check','xmark','ban','circle-xmark','rectangle-xmark','plus','minus','expand','compress','arrows-up-down-left-right','up-right-from-square','download','upload','share','link','chain','unlock','lock'],
        'Outils dessin':       ['paintbrush','brush','pencil','pen','pen-nib','eraser','fill','fill-drip','spray-can','stamp','bezier-curve','vector-square','draw-polygon','shapes','swatchbook','palette','eye-dropper','pipette','crop','crop-simple','wand-magic','wand-magic-sparkles','magnifying-glass','magnifying-glass-plus','magnifying-glass-minus','search','search-plus','search-minus'],
        'Sélection / Formes':  ['square','circle','rectangle','triangle','diamond','star','heart','cloud','bolt','slash','minus','grip-lines','border-all','border-none','border-style','object-group','object-ungroup','layer-group','layers','hand-pointer','arrow-pointer','cursor','crosshairs'],
        'Images / Médias':     ['image','images','photo-film','camera','camera-retro','film','video','music','play','pause','stop','forward','backward','volume-high','volume-low','volume-xmark'],
        'Effets / Filtres':    ['wand-sparkles','magic','sparkles','star-of-life','sun','moon','cloud-sun','brightness','contrast','eye','eye-slash','glasses','blur','circle-half-stroke','adjust','droplet','droplet-slash','droplet-half'],
        'Interface / UI':      ['bars','ellipsis','ellipsis-vertical','grip','grip-vertical','sliders','sliders-h','list','list-ul','list-ol','th','th-list','table','table-cells','grip-lines-vertical','columns','sidebar','window-maximize','window-restore','window-minimize','desktop','display','mobile','tablet'],
        'Calques / Fichiers':  ['file-image','file-pdf','file-export','file-import','file-code','file-alt','folder','folder-open','folder-plus','folder-minus','archive','box','boxes','stack-overflow'],
        'Couleurs / Texte':    ['font','text-height','text-width','italic','bold','underline','strikethrough','align-left','align-center','align-right','align-justify','outdent','indent','quote-left','quote-right','superscript','subscript','code','heading'],
        'Flèches':             ['arrow-up','arrow-down','arrow-left','arrow-right','arrow-up-left','arrow-up-right','arrow-down-left','arrow-down-right','arrows-rotate','rotate','circle-arrow-left','circle-arrow-right','angle-up','angle-down','angle-left','angle-right','chevron-up','chevron-down','chevron-left','chevron-right','caret-up','caret-down','sort','sort-up','sort-down'],
        'Notifications':       ['info','info-circle','exclamation','exclamation-circle','exclamation-triangle','question','question-circle','bell','bell-slash','bug','circle-check','check-circle','times-circle','circle-info','circle-exclamation','triangle-exclamation'],
    };

    // ── Parse le CSS FontAwesome pour extraire tous les noms/codes ───────────
    async function parseFaIcons() {
        let css = '';
        try {
            const resp = await fetch(FA_CSS);
            css = await resp.text();
        } catch (e) {
            console.warn('[IconViewer] Impossible de charger FA CSS:', e);
            return {};
        }

        // Regex: .fa-NOM:before{content:"\fXXX"}
        const re = /\.fa-([\w-]+):before\{content:"\\([0-9a-fA-F]+)"/g;
        const icons = {};
        let m;
        while ((m = re.exec(css)) !== null) {
            const [, name, code] = m;
            const cp = parseInt(code, 16);
            if (cp < 0x1000) continue; // Ignorer les faux icones
            if (!icons[name]) {
                icons[name] = { code, cp };
            }
        }
        return icons;
    }

    // ── Construit le HTML pour les icônes FA ────────────────────────────────
    function buildFaHtml(icons, filterText = '') {
        const filter = filterText.toLowerCase().trim();

        let html = '';
        const allNames = Object.keys(icons).sort();
        const categorized = new Set();

        // Catégories prédéfinies en premier
        for (const [catLabel, nameList] of Object.entries(FA_CATEGORIES)) {
            const items = nameList.filter(n => icons[n] && (!filter || n.includes(filter)));
            if (!items.length) continue;
            categorized.add(...items);

            html += `<div class="iview-fa-category">
                <div class="iview-fa-cat-label">${catLabel} <span class="iview-fa-cat-count">${items.length}</span></div>
                <div class="iview-fa-grid">`;
            for (const name of items) {
                html += buildFaCell(name, 'fa-solid');
            }
            html += `</div></div>`;
        }

        // Icônes non catégorisées
        const uncategorized = allNames.filter(n => {
            if (filter && !n.includes(filter)) return false;
            return !Object.values(FA_CATEGORIES).flat().includes(n);
        });

        if (uncategorized.length) {
            html += `<div class="iview-fa-category">
                <div class="iview-fa-cat-label">Autres <span class="iview-fa-cat-count">${uncategorized.length}</span></div>
                <div class="iview-fa-grid">`;
            for (const name of uncategorized.slice(0, 400)) { // Limiter pour perf
                html += buildFaCell(name, 'fa-solid');
            }
            if (uncategorized.length > 400) {
                html += `<div style="opacity:.6;font-size:11px;padding:8px;grid-column:1/-1;">… et ${uncategorized.length - 400} autres (utilisez la recherche)</div>`;
            }
            html += `</div></div>`;
        }

        if (!html) {
            html = `<p style="opacity:.6;padding:20px;text-align:center;">Aucune icône trouvée pour "${filterText}"</p>`;
        }

        return html;
    }

    function buildFaCell(name, styleClass) {
        const classes = `${styleClass} fa-${name}`;
        return `<div class="iview-fa-cell" title="fa-${name}" onclick="iviewCopyClass(this,'${styleClass} fa-${name}')">
            <i class="${classes}" aria-hidden="true"></i>
            <span class="iview-fa-name">fa-${name}</span>
        </div>`;
    }

    // ── Construit le HTML pour les SVG symbols ───────────────────────────────
    function buildSvgHtml() {
        const sprite = document.getElementById('illu-shape-icons-sprite');
        if (!sprite) return '<p style="opacity:.6;padding:16px;">Sprite SVG non trouvé dans le DOM.</p>';
        const symbols = sprite.querySelectorAll('symbol[id]');
        if (!symbols.length) return '<p style="opacity:.6;padding:16px;">Aucun symbol trouvé.</p>';

        let html = `<p style="margin:0 0 12px;opacity:.65;font-size:11px;">
            ${symbols.length} icônes — cliquer pour copier l'ID.<br>
            Définies dans <code>index.html</code> (sprite inline) et <code>icons/illu-sprite.svg</code> (fichier externe).
        </p><div class="iview-svg-grid">`;

        symbols.forEach(sym => {
            const id = sym.getAttribute('id');
            const vb = sym.getAttribute('viewBox') || '0 0 16 16';
            const shortName = id.replace('illu-icon-', '');
            html += `<div class="iview-icon-cell" title="Cliquer pour copier #${id}" onclick="iviewCopyClass(this,'${id}')">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="28" height="28" aria-hidden="true">
                    <use href="#${id}"/>
                </svg>
                <span class="iview-icon-name">${shortName}</span>
            </div>`;
        });
        html += `</div>`;
        return html;
    }

    // ── Copie dans le presse-papier ──────────────────────────────────────────
    window.iviewCopyClass = function (el, text) {
        navigator.clipboard?.writeText(text).catch(() => {});
        el.style.outline = '2px solid #4a8';
        setTimeout(() => { el.style.outline = ''; }, 800);
    };

    // ── Fenêtre principale (Overlay fixe Modal) ──────────────────────────────
    window.openIconViewerWindow = async function () {
        const existing = document.getElementById(WIN_ID);
        if (existing) {
            existing.remove();
            return;
        }

        // Détecter si le mode sombre global de la page est actif
        const isGlobalDark = document.body.classList.contains('theme-dark');

        // Parser FA CSS en arrière-plan
        const faIcons = await parseFaIcons();
        const faCount = Object.keys(faIcons).length;

        const svgHtml = buildSvgHtml();
        const sprite = document.getElementById('illu-shape-icons-sprite');
        const svgCount = sprite ? sprite.querySelectorAll('symbol').length : 0;

        // Créer l'overlay en arrière-plan
        const overlay = document.createElement('div');
        overlay.id = WIN_ID;
        overlay.style.cssText = `
            position: fixed;
            top: 0; left: 0;
            width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 9500;
            display: flex;
            align-items: center;
            justify-content: center;
        `;

        // Créer la fenêtre (Utilise les styles CSS natifs des thèmes pour respecter l'esthétique classique/moderne)
        const win = document.createElement('div');
        win.className = 'window iview-window';
        win.style.cssText = `
            width: min(900px, 96vw);
            height: 80vh;
            max-height: 80vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            z-index: 9600;
        `;

        win.innerHTML = `
            <!-- Title Bar (Sans style en ligne pour respecter les thèmes classique Win98 et moderne) -->
            <div class="title-bar">
                <div class="title-bar-text">
                    <i class="fa-solid fa-icons" style="margin-right:8px;vertical-align:middle;"></i>
                    Visionneuse d'icônes
                </div>
                <div class="title-bar-controls">
                    <button type="button" class="title-bar-close-btn" aria-label="Close" onclick="document.getElementById('${WIN_ID}').remove()"></button>
                </div>
            </div>

            <!-- Tabs -->
            <div style="display:flex;border-bottom:1px solid var(--mp-dock-border);flex-shrink:0;background:var(--mp-surface-deep);">
                <button class="iview-tab iview-tab-active" id="iview-tab-fa"
                    onclick="iviewSwitch('fa')"
                    style="flex:1;padding:10px;border:none;border-right:1px solid var(--mp-dock-border);cursor:pointer;font-size:12px;background:transparent;color:var(--mp-text);font-family:inherit;transition:all 0.2s;">
                    <i class="fa-brands fa-font-awesome" style="margin-right:4px;"></i>
                    FontAwesome <span style="opacity:.6;font-size:10px;">(${faCount})</span>
                </button>
                <button class="iview-tab" id="iview-tab-svg"
                    onclick="iviewSwitch('svg')"
                    style="flex:1;padding:10px;border:none;cursor:pointer;font-size:12px;background:transparent;color:var(--mp-text);font-family:inherit;transition:all 0.2s;">
                    <i class="fa-solid fa-shapes" style="margin-right:4px;"></i>
                    SVG Internes <span style="opacity:.6;font-size:10px;">(${svgCount})</span>
                </button>
            </div>

            <!-- Control Bar (Toujours visible avec Toggle Mode Sombre Preview) -->
            <div id="iview-control-bar" style="padding:8px 12px;border-bottom:1px solid var(--mp-dock-border);flex-shrink:0;display:flex;gap:12px;align-items:center;background:var(--mp-surface);justify-content:space-between;">
                <!-- Barre de recherche (Visible uniquement en mode FA) -->
                <div id="iview-search-container" style="display:flex;gap:10px;align-items:center;flex:1;">
                    <i class="fa-solid fa-magnifying-glass" style="opacity:.6;color:var(--mp-text);"></i>
                    <input type="text" id="iview-search" placeholder="Rechercher une icône… (ex: arrow, save, brush)"
                        style="flex:1;border:1px solid var(--mp-dock-border);padding:6px 10px;font-size:12px;border-radius:var(--mp-radius);background:var(--mp-surface-deep);color:var(--mp-text);font-family:inherit;outline:none;transition:all 0.15s;"
                        onfocus="this.style.borderColor='var(--mp-accent)';"
                        onblur="this.style.borderColor='var(--mp-dock-border)';"
                        oninput="iviewFilter(this.value)">
                </div>
                
                <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                    <!-- Case à cocher d'aperçu dynamique -->
                    <label style="display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;cursor:pointer;user-select:none;color:var(--mp-text);">
                        <input type="checkbox" id="iview-preview-toggle" onchange="iviewTogglePreviewMode(this.checked)" style="cursor:pointer;width:14px;height:14px;margin:0;">
                        <span>${isGlobalDark ? 'Aperçu Clair' : 'Aperçu Sombre'}</span>
                    </label>
                    <span id="iview-search-hint" style="font-size:10px;opacity:.6;color:var(--mp-text);">
                        Clic = copier
                    </span>
                </div>
            </div>

            <!-- Content -->
            <div id="iview-scroll" style="overflow-y:auto;flex:1;padding:12px 16px;background:var(--mp-surface);color:var(--mp-text);">
                <div id="iview-pane-fa">${buildFaHtml(faIcons)}</div>
                <div id="iview-pane-svg" style="display:none;">${svgHtml}</div>
            </div>

            <style>
                #${WIN_ID} .iview-window {
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45) !important;
                }
                #${WIN_ID} .iview-fa-category { margin-bottom: 20px; }
                #${WIN_ID} .iview-fa-cat-label {
                    font-size: 11px; font-weight: bold; margin-bottom: 8px;
                    padding-bottom: 4px; border-bottom: 1px solid var(--mp-dock-border);
                    display: flex; align-items: center; gap: 6px;
                    color: var(--mp-text); opacity: 0.85;
                }
                #${WIN_ID} .iview-fa-cat-count {
                    background: var(--mp-accent-muted); border-radius: 10px;
                    padding: 1px 6px; font-size: 9px; font-weight: 500;
                    color: var(--mp-accent);
                }
                #${WIN_ID} .iview-fa-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
                    gap: 6px;
                }
                #${WIN_ID} .iview-fa-cell {
                    display: flex; flex-direction: column; align-items: center;
                    padding: 10px 6px 8px; gap: 6px; border-radius: var(--mp-radius);
                    border: 1px solid var(--mp-dock-border);
                    background: var(--mp-surface-deep);
                    color: var(--mp-text);
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    font-size: 13px;
                }
                #${WIN_ID} .iview-fa-cell:hover {
                    background: rgba(var(--mp-accent-rgb, 107, 155, 217), 0.1) !important;
                    border-color: var(--mp-accent) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px var(--mp-accent-muted);
                }
                #${WIN_ID} .iview-fa-cell:hover i {
                    color: var(--mp-accent) !important;
                    filter: drop-shadow(0 0 3px var(--mp-accent-muted));
                }
                #${WIN_ID} .iview-fa-cell i {
                    font-size: 18px;
                    transition: all 0.2s;
                }
                #${WIN_ID} .iview-fa-name {
                    font-size: 9px; opacity: .65; text-align: center;
                    word-break: break-all; max-width: 82px;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                    color: var(--mp-text);
                    transition: opacity 0.2s;
                }
                #${WIN_ID} .iview-fa-cell:hover .iview-fa-name {
                    opacity: 1;
                }
                #${WIN_ID} .iview-svg-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
                    gap: 8px;
                }
                #${WIN_ID} .iview-icon-cell {
                    display: flex; flex-direction: column; align-items: center;
                    padding: 12px 6px 8px; gap: 8px;
                    border: 1px solid var(--mp-dock-border);
                    border-radius: var(--mp-radius);
                    background: var(--mp-surface-deep);
                    color: var(--mp-text);
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                }
                #${WIN_ID} .iview-icon-cell:hover {
                    background: rgba(var(--mp-accent-rgb, 107, 155, 217), 0.1) !important;
                    border-color: var(--mp-accent) !important;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px var(--mp-accent-muted);
                }
                #${WIN_ID} .iview-icon-cell svg {
                    transition: transform 0.2s;
                }
                #${WIN_ID} .iview-icon-cell:hover svg {
                    transform: scale(1.1);
                }
                #${WIN_ID} .iview-icon-name {
                    font-size: 9px; opacity: .65; text-align: center;
                    word-break: break-all; max-width: 88px;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                    color: var(--mp-text);
                    transition: opacity 0.2s;
                }
                #${WIN_ID} .iview-icon-cell:hover .iview-icon-name {
                    opacity: 1;
                }
                #${WIN_ID} .iview-tab { font-weight: 500; }
                #${WIN_ID} .iview-tab-active {
                    font-weight: 600;
                    box-shadow: inset 0 -3px 0 var(--mp-accent) !important;
                    background: rgba(var(--mp-accent-rgb, 107, 155, 217), 0.1) !important;
                }

                /* Surcharges d'Aperçu Mode Sombre Dynamique Scoped dans le conteneur */
                #${WIN_ID} .iview-dark-preview {
                    background: #1a1a1a !important;
                    color: #f8fafc !important;
                    --illu-icon-stroke: #f8fafc !important;
                    --illu-icon-bg: #2d2d2d !important;
                    --illu-icon-accent-subtle: #4a6fa5 !important;
                    --illu-icon-subtle: #475569 !important;
                    --mp-surface-deep: #262626 !important;
                    --mp-text: #f8fafc !important;
                    --mp-dock-border: #333333 !important;
                }

                /* Surcharges d'Aperçu Mode Clair Dynamique Scoped dans le conteneur */
                #${WIN_ID} .iview-light-preview {
                    background: #ffffff !important;
                    color: #1e293b !important;
                    --illu-icon-stroke: #1e293b !important;
                    --illu-icon-bg: #ffffff !important;
                    --illu-icon-accent-subtle: #cbd5e1 !important;
                    --illu-icon-subtle: #f1f5f9 !important;
                    --mp-surface-deep: #f8fafc !important;
                    --mp-text: #1e293b !important;
                    --mp-dock-border: #cbd5e1 !important;
                }
            </style>
        `;

        overlay.appendChild(win);
        document.body.appendChild(overlay);



        // Fermer l'overlay au clic extérieur
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                overlay.remove();
            }
        });

        // Switcher d'onglets
        window._iviewFaIcons = faIcons;
        window.iviewSwitch = function (tab) {
            document.getElementById('iview-pane-fa').style.display  = tab === 'fa'  ? '' : 'none';
            document.getElementById('iview-pane-svg').style.display = tab === 'svg' ? '' : 'none';
            document.getElementById('iview-search-container').style.display = tab === 'fa' ? 'flex' : 'none';
            document.getElementById('iview-tab-fa') .classList.toggle('iview-tab-active', tab === 'fa');
            document.getElementById('iview-tab-svg').classList.toggle('iview-tab-active', tab === 'svg');
        };

        // Action de bascule de l'Aperçu dynamique (Clair/Sombre)
        window.iviewTogglePreviewMode = function (checked) {
            const scroll = document.getElementById('iview-scroll');
            if (scroll) {
                if (isGlobalDark) {
                    scroll.classList.toggle('iview-light-preview', checked);
                } else {
                    scroll.classList.toggle('iview-dark-preview', checked);
                }
            }
        };

        // Filtre de recherche
        window.iviewFilter = function (q) {
            const pane = document.getElementById('iview-pane-fa');
            if (pane && window._iviewFaIcons) {
                pane.innerHTML = buildFaHtml(window._iviewFaIcons, q);
            }
        };
    };

})();
