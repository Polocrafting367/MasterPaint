/**
 * EffectDialogUI — mise en forme compacte et unifiée des fenêtres d'effet.
 *
 * Les modales d'effet sont générées par ~80 gabarits HTML différents (FilterManager,
 * ChromaKeyer, VhsEffect…), tous écrits « à la main » avec des styles en ligne
 * (`width:120px`, `flex-grow:1`, `margin-top:6px`…). Plutôt que de réécrire chaque
 * gabarit, ce module normalise le DOM **après** l'injection :
 *
 *   1. chaque `input[type=range]` est enveloppé dans une piste `.fx-track` qui porte
 *      un dégradé sémantique (température, teinte, saturation, luminosité…) ;
 *   2. les styles en ligne de dimensionnement sont retirés des libellés / valeurs afin
 *      que la grille CSS (`css/effects-compact.css`) reprenne la main ;
 *   3. les lignes sont marquées `.fx-row` et regroupées en deux colonnes quand la
 *      modale en contient beaucoup — c'est ce qui rend les fenêtres nettement plus
 *      basses sans rien retirer.
 *
 * Les éléments existants sont **déplacés**, jamais recréés : les `id`, les gestionnaires
 * `oninput=` en ligne et la persistance des paramètres (EFFECT_PARAM_DEFAULTS) restent
 * intacts.
 */
(function (global) {
    'use strict';

    /* ————————————————————————————————————————————————————————————
     *  Dégradés de piste
     * ———————————————————————————————————————————————————————————— */

    /** Rampes réutilisables. `--fx-neutral-*` sont résolues par le thème (clair/sombre). */
    const RAMP = {
        hue: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)',
        temp: 'linear-gradient(to right,#3f8ef7,#dfe6ee,#ff9a3c)',
        tint: 'linear-gradient(to right,#4ec24e,#e6e6e6,#d24ed2)',
        luma: 'linear-gradient(to right,#101010,#808080,#ffffff)',
        dark2light: 'linear-gradient(to right,#101010,#ffffff)',
        light2dark: 'linear-gradient(to right,#ffffff,#101010)',
        contrast: 'linear-gradient(to right,#d8d8d8,#3a3a3a,#d8d8d8)',
        gamma: 'linear-gradient(to right,#2b2b2b,#9a9a9a,#f4f4f4)',
        sat: 'linear-gradient(to right,#8a8a8a,#c8582f,#cfae2b,#3f9b48,#2f77c8,#8a49b8)',
        vibrance: 'linear-gradient(to right,#8a8a8a,#7fb6d8,#ff7bb0)',
        red: 'linear-gradient(to right,#0e6f6f,#e8e8e8,#ff4d4d)',
        green: 'linear-gradient(to right,#b34db3,#e8e8e8,#4dd44d)',
        blue: 'linear-gradient(to right,#d8b23c,#e8e8e8,#4d8dff)',
        cyan: 'linear-gradient(to right,#ffffff,#00a8c8)',
        magenta: 'linear-gradient(to right,#ffffff,#c8007a)',
        yellow: 'linear-gradient(to right,#ffffff,#c9b100)',
        black: 'linear-gradient(to right,#ffffff,#101010)',
        alpha:
            'linear-gradient(to right,rgba(128,128,128,0),rgba(128,128,128,.95)),' +
            'repeating-conic-gradient(#cfcfcf 0% 25%,#f4f4f4 0% 50%) 0 0/8px 8px',
        angle: 'linear-gradient(to right,#5a6a86,#8fa3c4,#d3dbe7,#8fa3c4,#5a6a86)',
        spill: 'linear-gradient(to right,#e8e8e8,#39c05a)',
        /** Rampe « quantité » neutre : discrète mais cohérente avec les autres. */
        amount: 'linear-gradient(to right,var(--fx-ramp-a),var(--fx-ramp-b))',
        /** Rampe bipolaire neutre (curseurs -N…+N sans couleur propre). */
        bipolar: 'linear-gradient(to right,var(--fx-ramp-b),var(--fx-ramp-a),var(--fx-ramp-b))'
    };

    /**
     * Dégradés fixés par identifiant. Prioritaire sur l'heuristique par mot-clé :
     * certains ids sont trop courts ou ambigus pour être devinés (`ef-b` = luminosité,
     * pas « bleu » ; `ef-s` = saturation ; `ef-l` = lumière).
     */
    const BY_ID = {
        /* Luminosité / contraste */
        'ef-b': RAMP.luma,
        'ef-c': RAMP.contrast,
        'ef-bc-temp': RAMP.temp,
        'ef-bc-tint': RAMP.tint,
        /* Teinte / saturation / lumière */
        'ef-h': RAMP.hue,
        'ef-s': 'linear-gradient(to right,#8a8a8a,hsl(var(--hsv-strip-h,210),85%,50%))',
        'ef-l': RAMP.luma,
        'ef-temp': RAMP.temp,
        /* Température / teinte */
        'ef-tt-temp': RAMP.temp,
        'ef-tt-tint': RAMP.tint,
        /* Vibrance */
        'ef-vibr': RAMP.vibrance,
        /* Exposition / gamma */
        'ef-exp': RAMP.dark2light,
        'ef-gamma': RAMP.gamma,
        /* Postérisation / seuil / solarisation */
        'ef-lvl': RAMP.amount,
        'ef-thr': RAMP.dark2light,
        'ef-sol': RAMP.dark2light,
        /* Balance des couleurs */
        'ef-cb-r': RAMP.red,
        'ef-cb-g': RAMP.green,
        'ef-cb-b': RAMP.blue,
        /* Trame CMJN : encriers */
        'ef-half-dc': RAMP.cyan,
        'ef-half-dm': RAMP.magenta,
        'ef-half-dy': RAMP.yellow,
        'ef-half-dk': RAMP.black,
        /* Duo-tone : point de bascule */
        'ef-duo-mid': RAMP.luma,
        /* Vignettage */
        'ef-vig': RAMP.light2dark,
        /* ASCII */
        'ef-ascii-gamma': RAMP.gamma,
        /* Incrustation (ChromaKeyer) */
        'ef-ch-black': RAMP.light2dark,
        'ef-ch-white': RAMP.dark2light,
        'ef-ch-gamma': RAMP.gamma,
        'ef-ch-luma': RAMP.luma,
        'ef-ch-spill': RAMP.spill,
        'ef-ch-recover': RAMP.sat,
        /* VHS */
        'ef-vhs-shift_r': RAMP.red,
        'ef-vhs-shift_g': RAMP.green,
        'ef-vhs-shift_b': RAMP.blue,
        'ef-vhs-cast_r': RAMP.red,
        'ef-vhs-cast_g': RAMP.green,
        'ef-vhs-cast_b': RAMP.blue,
        'ef-vhs-luma_contrast': RAMP.contrast,
        'ef-vhs-luma_brightness': RAMP.luma,
        'ef-vhs-chroma_phase': RAMP.hue,
        'ef-vhs-chroma_saturation': RAMP.sat,
        'ef-vhs-edge_sat': RAMP.sat,
        'ef-vhs-hs_sat': RAMP.sat,
        'ef-vhs-shadow_sat': RAMP.sat
    };

    /**
     * Heuristique par mot-clé, évaluée dans l'ordre : le premier motif trouvé dans
     * l'identifiant gagne. Les motifs les plus spécifiques passent en premier.
     */
    const BY_KEYWORD = [
        [/tint|teinte/, RAMP.tint],
        [/temp(?!o)|warm/, RAMP.temp],
        /* Teinte colorimétrique uniquement : un angle géométrique (rotation d'un flou,
           orientation d'une trame) n'a rien à voir avec la roue chromatique. */
        [/hue|_h$|chroma_phase/, RAMP.hue],
        [/angle|rotation|phase|orient/, RAMP.angle],
        [/vibr/, RAMP.vibrance],
        [/sat/, RAMP.sat],
        [/despill|spill/, RAMP.spill],
        [/gamma/, RAMP.gamma],
        [/contrast/, RAMP.contrast],
        [/expos|bright|lumin|light|glow|highlight/, RAMP.dark2light],
        [/shadow|dark|black|noir/, RAMP.light2dark],
        [/white|blanc/, RAMP.dark2light],
        [/threshold|seuil/, RAMP.dark2light],
        [/opacity|opacit|alpha/, RAMP.alpha],
        [/-r$|_r$|red|rouge/, RAMP.red],
        [/-g$|_g$|green|vert/, RAMP.green],
        [/-b$|_b$|blue|bleu/, RAMP.blue]
    ];

    /** Curseurs purement géométriques : rampe neutre, pas de couleur trompeuse. */
    const NEUTRAL = /radius|rayon|size|taille|dist|offset|ox$|oy$|width|height|cell|tile|frag|quality|scale|seed|freq|rows|len|thick|pad|feather/;

    /**
     * @param {HTMLInputElement} input curseur à habiller
     * @returns {string} valeur CSS `background` de la piste
     */
    function gradientFor(input) {
        const id = String(input.id || '').toLowerCase();
        if (BY_ID[input.id]) return BY_ID[input.id];
        if (!id) return RAMP.amount;
        if (NEUTRAL.test(id)) return RAMP.amount;
        for (let i = 0; i < BY_KEYWORD.length; i++) {
            if (BY_KEYWORD[i][0].test(id)) return BY_KEYWORD[i][1];
        }
        /* Sans indice sémantique : rampe neutre, bipolaire si le curseur est centré sur 0. */
        const min = parseFloat(input.min);
        const max = parseFloat(input.max);
        return Number.isFinite(min) && Number.isFinite(max) && min < 0 && max > 0
            ? RAMP.bipolar
            : RAMP.amount;
    }

    /* ————————————————————————————————————————————————————————————
     *  Normalisation du DOM
     * ———————————————————————————————————————————————————————————— */

    /** Conteneurs dont la mise en page est déjà gérée ailleurs — on ne les touche pas. */
    const OPT_OUT = '.illu-curve-editor, .illu-hsl-manager, .illu-cr-range-wrap, .fx-track, .illu-lvl-gamma-row, [data-fx-raw]';

    /** Retire les styles en ligne de dimensionnement qui empêchent la grille CSS d'agir. */
    function stripInlineSizing(el, props) {
        if (!el || !el.style) return;
        for (let i = 0; i < props.length; i++) el.style.removeProperty(props[i]);
    }

    /**
     * Trouve l'affichage de valeur associé à un curseur.
     * Convention majoritaire : `<id>-val`, `<id>-v` ou `<id>-value`. À défaut, une boîte
     * numérique isolée dans la même ligne joue ce rôle (remplissage intelligent,
     * incrustation, où le curseur et la boîte ont des identifiants distincts).
     */
    function findReadout(root, row, input) {
        if (input.id) {
            const suffixes = ['-val', '-v', '-value'];
            for (let i = 0; i < suffixes.length; i++) {
                const el = root.querySelector('#' + CSS.escape(input.id + suffixes[i]));
                if (el) return el;
            }
        }
        if (!row) return null;
        const nums = row.querySelectorAll('input[type="number"]');
        return nums.length === 1 ? nums[0] : null;
    }

    /** Libellé de la ligne : le premier `<label>`/`.effect-param-label` qui n'est pas une case à cocher. */
    function findLabel(row, input) {
        const cands = row.querySelectorAll('label, .effect-param-label');
        for (let i = 0; i < cands.length; i++) {
            const c = cands[i];
            if (c.contains(input)) continue;
            if (c.querySelector('input, select, textarea')) continue;
            return c;
        }
        return null;
    }

    /**
     * Récupère (ou crée) la piste qui entoure le curseur.
     * Les gabarits récents (luminosité, TSL, température) fournissent déjà un
     * `.effect-track` : on le réutilise au lieu d'imbriquer une seconde piste.
     */
    function ensureTrack(input) {
        const parent = input.parentElement;
        if (parent && parent.classList.contains('effect-track')) {
            parent.classList.add('fx-track');
            return parent;
        }
        const track = document.createElement('div');
        track.className = 'fx-track';
        input.parentNode.insertBefore(track, input);
        track.appendChild(input);
        return track;
    }

    /**
     * Enveloppe un curseur dans sa piste dégradée et met la ligne au format compact.
     * @param {HTMLElement} root racine de la modale
     * @param {HTMLInputElement} input
     */
    function decorateRange(root, input) {
        if (input.closest(OPT_OUT)) return;
        input.classList.add('fx-range');
        stripInlineSizing(input, ['flex', 'flex-grow', 'width', 'min-width', 'margin']);

        const track = ensureTrack(input);
        track.style.background = gradientFor(input);

        /* Mise au format de la ligne parente. */
        const row =
            track.closest('.effect-track-row, .field-row, .effect-slider-block, .illu-pm-row') ||
            track.parentElement;
        if (!row || row.classList.contains('fx-row')) return;
        row.classList.add('fx-row');
        stripInlineSizing(row, ['margin-top', 'margin-bottom', 'gap', 'align-items']);

        let label = findLabel(row, input);
        if (!label) {
            /*
             * Gabarit « bloc » (.effect-slider-block) : le libellé est au-dessus de la
             * piste, ce qui double la hauteur de chaque réglage. On le rapatrie dans
             * la ligne pour retrouver la disposition libellé | piste | valeur.
             */
            const block = row.closest('.effect-slider-block');
            const outer = block && block.querySelector(':scope > .effect-param-label');
            if (outer) {
                row.insertBefore(outer, row.firstChild);
                label = outer;
            }
        }
        if (label) {
            label.classList.add('fx-label');
            stripInlineSizing(label, ['width', 'min-width', 'max-width', 'margin-bottom', 'display']);
            /* La colonne de libellés est à largeur fixe : une infobulle rattrape les
               intitulés longs (« Décalage centre X », « Zone nette (rayon %) »). */
            if (!label.title) {
                const txt = label.textContent.trim();
                if (txt) label.title = txt;
            }
        }

        const readout = findReadout(root, row, input);
        if (readout && !readout.contains(track) && readout !== input) {
            readout.classList.add('fx-val');
            stripInlineSizing(readout, ['width', 'min-width', 'margin-left', 'text-align']);
            /* La valeur doit suivre la piste, même si le gabarit la plaçait ailleurs. */
            if (readout.parentElement === row && readout.previousElementSibling !== track) {
                row.insertBefore(readout, track.nextSibling);
            }
        }
    }

    /** Compacte les regroupements (`fieldset`/`legend`) et les paragraphes d'aide. */
    function decorateGroups(root) {
        root.querySelectorAll('fieldset').forEach((fs) => {
            fs.classList.add('fx-group');
            stripInlineSizing(fs, ['margin', 'margin-bottom', 'padding', 'border', 'border-radius']);
            const lg = fs.querySelector(':scope > legend');
            if (lg) {
                lg.classList.add('fx-group-h');
                stripInlineSizing(lg, ['font-weight', 'padding']);
            }
        });
        /* Textes d'aide : repliés en note discrète, ils mangeaient 2 à 3 lignes par modale. */
        root.querySelectorAll(':scope > p, .fx-group > p, .illu-cr-sec-body > p').forEach((p) => {
            if (p.classList.contains('fx-hint')) return;
            p.classList.add('fx-hint');
            stripInlineSizing(p, ['margin', 'font-size', 'color']);
        });
        /* Lignes sans curseur (cases à cocher, listes déroulantes, boutons). */
        root.querySelectorAll('.field-row:not(.fx-row)').forEach((r) => {
            r.classList.add('fx-line');
            stripInlineSizing(r, ['margin-top', 'margin-bottom']);
            const lab = r.querySelector(':scope > label');
            /*
             * Seul un libellé en tête de ligne joue le rôle de colonne de gauche. Celui
             * qui suit une case à cocher est au contraire son texte : lui imposer une
             * largeur fixe le tronquerait.
             */
            if (lab && lab === r.firstElementChild && !lab.querySelector('input, select')) {
                lab.classList.add('fx-label');
                stripInlineSizing(lab, ['width', 'min-width']);
            }
        });
    }

    /**
     * Conteneurs qu'on laisse en une colonne : leur regroupement porte du sens.
     * `.fx-grid-2` y figure pour que `normalize()` reste idempotent — une grille déjà
     * posée ne doit pas être réempaquetée dans une seconde.
     */
    const NO_GRID = 'fieldset, section, .illu-cr-sec, .illu-vhs-split, .illu-vhs-grid, .fx-group, .fx-grid-2';

    /**
     * Regroupe en deux colonnes les suites de réglages assez longues pour y gagner.
     *
     * Le remplissage est fait **colonne par colonne** (`grid-auto-flow: column`) et non
     * ligne par ligne : les réglages liés se suivent dans le gabarit (décalage X puis Y,
     * les quatre coins d'une perspective…), et un remplissage par ligne les séparerait
     * sur deux colonnes différentes. En colonnes, ils restent l'un sous l'autre.
     *
     * Seules des lignes sœurs consécutives sont réunies : les fenêtres déjà structurées
     * en sections (incrustation, VHS, trame) gardent leur colonne unique, plus lisible.
     *
     * @returns {boolean} vrai si au moins une grille a été posée
     */
    function applyTwoColumnLayout(root, minRows) {
        const threshold = minRows || 5;
        const parents = new Set();
        root.querySelectorAll('.fx-row').forEach((r) => {
            const p = r.parentElement;
            if (p && !p.matches(NO_GRID) && !p.closest(NO_GRID)) parents.add(p);
        });

        let placed = false;
        parents.forEach((parent) => {
            /* Découper en suites de lignes de réglage consécutives. */
            let run = [];
            const flush = () => {
                if (run.length >= threshold) {
                    const grid = document.createElement('div');
                    grid.className = 'fx-grid-2';
                    grid.style.setProperty('--fx-rows', String(Math.ceil(run.length / 2)));
                    parent.insertBefore(grid, run[0]);
                    run.forEach((el) => grid.appendChild(el));
                    placed = true;
                }
                run = [];
            };
            const children = Array.prototype.slice.call(parent.children);
            for (let i = 0; i < children.length; i++) {
                if (children[i].classList.contains('fx-row')) run.push(children[i]);
                else flush();
            }
            flush();
        });
        return placed;
    }

    /* ————————————————————————————————————————————————————————————
     *  Dégradés dynamiques
     * ———————————————————————————————————————————————————————————— */

    /**
     * Certaines pistes dépendent d'un autre curseur (la saturation se teinte de la
     * teinte courante). On les rafraîchit via une variable CSS pour éviter de
     * recalculer un dégradé à chaque `input`.
     */
    function refreshDynamic(root) {
        const hue = root.querySelector('#ef-h');
        if (!hue) return;
        /* Teinte / saturation : FilterManager gère déjà la teinte de référence
           (curseur ou raccourcis R/V/B). On lui délègue pour rester cohérent. */
        const fm = global.FilterManager;
        if (fm && typeof fm._syncHsvStripHue === 'function') {
            fm._syncHsvStripHue();
            return;
        }
        const panel = root.querySelector('#ef-hsv-panel') || root;
        let h = parseFloat(hue.value);
        if (!Number.isFinite(h)) h = 0;
        let deg = (210 + h) % 360;
        if (deg < 0) deg += 360;
        panel.style.setProperty('--hsv-strip-h', String(Math.round(deg)));
    }

    /* ————————————————————————————————————————————————————————————
     *  API publique
     * ———————————————————————————————————————————————————————————— */

    const EffectDialogUI = {
        RAMP: RAMP,
        gradientFor: gradientFor,
        refreshDynamic: refreshDynamic,

        /**
         * Normalise une modale d'effet fraîchement injectée.
         * Idempotent : un second appel sur le même DOM ne change rien.
         *
         * @param {HTMLElement} root racine du contenu (ex. `#effect-dialog-content`)
         * @param {{ effect?: string, twoColumnsFrom?: number }} [opts]
         * @returns {{ rangeCount: number, twoColumns: boolean }}
         */
        /**
         * Retire les marques de mise en page laissées par une normalisation précédente.
         * `#effect-dialog-content` est partagé avec d'autres boîtes de dialogue
         * (redimensionner, étendre la zone de travail…) : sans ce nettoyage, une
         * disposition en deux colonnes survivrait à la fermeture de l'effet.
         *
         * @param {HTMLElement} root
         */
        reset(root) {
            if (!root) return;
            root.classList.remove('fx-compact', 'fx-grid-2');
            root.removeAttribute('data-fx-effect');
        },

        normalize(root, opts) {
            if (!root) return { rangeCount: 0, twoColumns: false };
            const o = opts || {};
            root.classList.remove('fx-grid-2');
            root.classList.add('fx-compact');
            if (o.effect) root.setAttribute('data-fx-effect', o.effect);

            const ranges = Array.prototype.slice.call(root.querySelectorAll('input[type="range"]'));
            ranges.forEach((input) => decorateRange(root, input));
            decorateGroups(root);
            const twoColumns = applyTwoColumnLayout(root, o.twoColumnsFrom);
            refreshDynamic(root);

            /* Un seul écouteur délégué : les dégradés dynamiques suivent la saisie. */
            if (!root.dataset.fxDynamicBound) {
                root.dataset.fxDynamicBound = '1';
                root.addEventListener('input', (ev) => {
                    if (ev.target && ev.target.id === 'ef-h') refreshDynamic(root);
                });
            }
            return { rangeCount: ranges.length, twoColumns: twoColumns };
        },

        /**
         * Largeur conseillée pour la fenêtre, d'après la densité réelle du contenu.
         * Les modales à une poignée de curseurs n'ont aucune raison de faire 440 px.
         *
         * @param {HTMLElement} root
         * @param {{ rangeCount: number, twoColumns: boolean }} info
         * @returns {number} largeur en pixels
         */
        suggestWidth(root, info) {
            /* Deux colonnes de (libellé 100 + piste ~70 + valeur 34 + gouttières). */
            if (info && info.twoColumns) return 540;
            const controls = root
                ? root.querySelectorAll('input, select, textarea, button').length
                : 0;
            if (controls <= 4) return 320;
            if (controls <= 10) return 360;
            return 400;
        }
    };

    global.IlluEffectDialogUI = EffectDialogUI;
})(typeof window !== 'undefined' ? window : this);
