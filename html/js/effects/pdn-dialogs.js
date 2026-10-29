/**
 * pdn-dialogs.js — dialogues des effets repris de Paint.NET 5 (calculés par le moteur Rust).
 *
 * FilterManager.initEffect() appelle IlluPdnDialogs.html(effect, FilterManager) avant son
 * propre switch : un effet listé ici utilise ce dialogue (paramètres et valeurs par défaut
 * de Paint.NET), les autres gardent leur dialogue historique.
 * Les identifiants des contrôles (ef-…) sont lus par js/rust/rust-effect-params.js.
 */
(function (global) {
    'use strict';

    const T = {
        highlightsshadows: 'Mises en lumière / Ombres',
        quantize: 'Quantifier',
        median: 'Médiane',
        sketchblur: "Flou d'esquisse",
        morphology: 'Morphologie',
        turbulence: 'Turbulence',
        straighten: 'Redresser',
        rotatezoom: 'Faire pivoter / Zoomer',
        outline: 'Contour',
        relief: 'Mise en relief',
        emboss: 'Embosser',
        addnoise: 'Ajouter du bruit',
        oil: "Peinture à l'huile",
        sketch: "Croquis à l'encre",
        unfocus: 'Flou bokeh / Défocaliser',
        bulge: 'Bosse',
        // plugins Paint.NET (BoltBait, Vandermotten)
        dream: 'Rêve',
        removedust: 'Supprimer la poussière',
        gridcheck: 'Grille / Damier',
        fadeedge: 'Fondu des bords',
        coloraccent: 'Accent de couleur',
        transparency: 'Transparence',
        featherobj: "Adoucir le contour de l'objet",
        pastel: 'Pastel'
    };

    function slider(fm, id, label, min, max, value, step) {
        const st = step ? ` step="${step}"` : '';
        return `<div class="field-row" style="margin-top:6px;"><label style="width:110px;">${label}</label>` +
            `<input type="range" id="${id}" min="${min}" max="${max}" value="${value}"${st} style="flex-grow:1;" ` +
            `oninput="document.getElementById('${id}-val').innerText=this.value; FilterManager.preview()"> ` +
            `<span id="${id}-val" style="width:38px; text-align:right;">${value}</span></div>`;
    }
    function select(id, label, options, value) {
        const opts = options.map(([v, t]) => `<option value="${v}"${String(v) === String(value) ? ' selected' : ''}>${t}</option>`).join('');
        return `<div class="field-row" style="margin-top:6px;"><label style="width:110px;">${label}</label>` +
            `<select id="${id}" style="flex-grow:1;" onchange="FilterManager.preview()">${opts}</select></div>`;
    }
    function check(id, label, on) {
        return `<div class="field-row" style="margin-top:6px; padding-left:110px;"><input type="checkbox" id="${id}"${on ? ' checked' : ''} ` +
            `onchange="FilterManager.preview()"><label for="${id}" style="margin-left:6px;cursor:pointer;">${label}</label></div>`;
    }
    function reseed(id) {
        return `<div class="field-row" style="margin-top:6px; padding-left:110px;"><button type="button" class="illu-btn" ` +
            `onclick="var e=document.getElementById('${id}'); e.value=Math.floor(Math.random()*255); FilterManager.preview()">Réinitialiser l'aléatoire</button>` +
            `<input type="hidden" id="${id}" value="0"></div>`;
    }
    /** Couleur de la palette (principale / secondaire) en #rrggbb, comme les plugins Paint.NET. */
    function paletteHex(which) {
        const em = global.EditorManager;
        const c = em && (which === 'secondary' ? em.secondaryColor : em.primaryColor);
        if (!c) return which === 'secondary' ? '#ffffff' : '#000000';
        return '#' + ((1 << 24) | (c.r << 16) | (c.g << 8) | c.b).toString(16).slice(1);
    }
    function color(id, label, hex) {
        return `<div class="field-row" style="margin-top:6px;"><label style="width:110px;">${label}</label>` +
            `<input type="color" id="${id}" value="${hex}" oninput="FilterManager.preview()" style="width:56px;height:22px;padding:0;"></div>`;
    }
    function note(t) {
        return `<p style="margin:0 0 6px;font-size:11px;opacity:.8;">${t}</p>`;
    }

    const D = {
        highlightsshadows: (fm) =>
            slider(fm, 'ef-hs-shadows', 'Ombres', -100, 100, 30) +
            slider(fm, 'ef-hs-highlights', 'Mises en lumière', -100, 100, 0) +
            slider(fm, 'ef-hs-clarity', 'Clarté', -100, 100, 0) +
            slider(fm, 'ef-hs-radius', 'Rayon', 1, 200, 25),
        quantize: (fm) =>
            slider(fm, 'ef-q-colors', 'Couleurs', 2, 256, 16) +
            slider(fm, 'ef-q-dither', 'Tramage', 0, 100, 50),
        median: (fm) =>
            note('Paint.NET : Bruit › Médiane (identique au « Flou médian » avec percentile 50).') +
            slider(fm, 'ef-med-rad', 'Rayon', 1, 200, 10) +
            slider(fm, 'ef-med-pct', 'Percentile', 0, 100, 50),
        sketchblur: (fm) =>
            slider(fm, 'ef-skb-r', 'Rayon', 1, 100, 10) +
            slider(fm, 'ef-skb-var', 'Variation', 0, 100, 50) +
            reseed('ef-skb-seed'),
        morphology: (fm) =>
            select('ef-mo-mode', 'Mode', [[0, 'Dilater'], [1, 'Éroder']], 0) +
            slider(fm, 'ef-mo-r', 'Rayon', 1, 200, 3) +
            select('ef-mo-shape', 'Forme', [[0, 'Cercle'], [1, 'Carré']], 0),
        turbulence: (fm) =>
            note('Couleurs : primaire → secondaire.') +
            select('ef-tb-noise', 'Bruit', [[0, 'Turbulence'], [1, 'Somme fractale']], 0) +
            slider(fm, 'ef-tb-scale', 'Taille', 2, 1000, 200) +
            slider(fm, 'ef-tb-oct', 'Octaves', 1, 12, 6) +
            slider(fm, 'ef-tb-rough', 'Rugosité', 5, 100, 50) +
            select('ef-tb-blend', 'Mode de fusion', [[0, 'Normal'], [1, 'Produit'], [2, 'Addition'], [3, 'Écran'], [4, 'Incrustation'], [5, 'Différence']], 0) +
            reseed('ef-tb-seed'),
        straighten: (fm) => slider(fm, 'ef-str-angle', 'Angle', -45, 45, 0, 0.1),
        rotatezoom: (fm) =>
            slider(fm, 'ef-rz-angle', 'Angle', -180, 180, 0) +
            slider(fm, 'ef-rz-panx', 'Décalage X', -100, 100, 0) +
            slider(fm, 'ef-rz-pany', 'Décalage Y', -100, 100, 0) +
            slider(fm, 'ef-rz-zoom', 'Zoom (%)', 5, 1600, 100) +
            check('ef-rz-tile', 'Mosaïque', false),
        outline: (fm) =>
            slider(fm, 'ef-ol-thick', 'Épaisseur', 1, 200, 3) +
            slider(fm, 'ef-ol-int', 'Intensité', 0, 100, 50),
        relief: (fm) => slider(fm, 'ef-relief-angle', 'Angle', -180, 180, 45),
        emboss: (fm) => slider(fm, 'ef-emb-angle', 'Angle', -180, 180, 0),
        addnoise: (fm) =>
            slider(fm, 'ef-noise-int', 'Intensité', 0, 100, 64) +
            slider(fm, 'ef-noise-sat', 'Saturation', 0, 400, 100) +
            slider(fm, 'ef-noise-cov', 'Couverture', 0, 100, 100),
        oil: (fm) =>
            slider(fm, 'ef-oil', 'Taille du pinceau', 1, 8, 3) +
            slider(fm, 'ef-oil-coarse', 'Grossièreté', 3, 255, 50),
        sketch: (fm) =>
            slider(fm, 'ef-ink', "Contour d'encre", 0, 99, 50) +
            slider(fm, 'ef-ink-color', 'Coloriage', 0, 100, 50),
        bulge: (fm) =>
            note('Valeur négative : pincement (anciennement « Pincement… »).') +
            slider(fm, 'ef-bulge', 'Quantité', -100, 100, 45),
        unfocus: (fm) =>
            note('Hautes lumières à 0 : « Défocaliser » de Paint.NET ; au-dessus : « Flou bokeh ».') +
            slider(fm, 'ef-unfocus-r', 'Rayon', 1, 100, 8) +
            slider(fm, 'ef-unfocus-hl', 'Hautes lumières', 0, 100, 55),

        /* ---- plugins Paint.NET réécrits en Rust (rust/masterpaint-core/src/fx_plugins.rs) ---- */
        dream: (fm) =>
            note('BoltBait : flou doux fondu en « obscurcir » avec l’image, vignette en option.') +
            slider(fm, 'ef-dream-r', 'Rayon', 0, 200, 10) +
            check('ef-dream-vig', 'Ajouter une vignette', true),
        removedust: () =>
            select('ef-dust-mode', 'Supprimer', [[0, 'Les points blancs'], [1, 'Les points noirs']], 0),
        gridcheck: (fm) =>
            select('ef-gc-mode', 'Motif', [[0, 'Grille'], [1, 'Damier']], 0) +
            slider(fm, 'ef-gc-size', 'Taille', 1, 1000, 33) +
            slider(fm, 'ef-gc-width', 'Épaisseur du trait', 1, 100, 1) +
            color('ef-gc-color', 'Couleur', paletteHex('primary')) +
            select('ef-gc-bg', 'Fond', [[0, 'Image source'], [1, 'Couleur de fond']], 0) +
            color('ef-gc-color2', 'Couleur de fond', paletteHex('secondary')) +
            check('ef-gc-swap', 'Inverser les couleurs', false),
        fadeedge: (fm) =>
            select('ef-fe-shape', 'Forme', [[0, 'Rectangulaire'], [1, 'Circulaire']], 0) +
            slider(fm, 'ef-fe-width', 'Largeur', 0, 200, 20) +
            slider(fm, 'ef-fe-power', 'Puissance', 0, 10, 1, 0.1),
        coloraccent: (fm) =>
            note('Garde une couleur, passe tout le reste en noir et blanc.') +
            color('ef-ca-color', 'Couleur', paletteHex('primary')) +
            slider(fm, 'ef-ca-tol', 'Tolérance', 0, 100, 10),
        transparency: (fm) =>
            slider(fm, 'ef-tr-adj', 'Opacité (± %)', -100, 100, 0) +
            check('ef-tr-ignore', 'Ignorer les pixels transparents', false) +
            check('ef-tr-replace', 'Remplacer la transparence par la couleur secondaire', false),
        featherobj: (fm) =>
            note('Adoucit le bord des objets (zones non transparentes) du calque.') +
            slider(fm, 'ef-fo-r', 'Rayon', 0, 20, 1),
        pastel: (fm) =>
            slider(fm, 'ef-pa-brush', 'Taille du pinceau', 1, 8, 3) +
            slider(fm, 'ef-pa-coarse', 'Grossièreté', 3, 255, 50) +
            slider(fm, 'ef-pa-pencil', 'Trait de crayon (%)', 0, 100, 50) +
            slider(fm, 'ef-pa-tip', 'Pointe du crayon', 1, 20, 2)
    };

    global.IlluPdnDialogs = {
        /** Le moteur Rust doit être présent : sans lui, ces dialogues n'ont pas de rendu. */
        html(effect, fm) {
            const fn = D[effect];
            if (!fn) return null;
            const R = global.MasterPaintRust;
            if (!R || !R.supports(effect)) return null;
            return fn(fm);
        },
        title(effect) {
            return T[effect] || effect;
        },
        has(effect) {
            return effect in D;
        }
    };
})(typeof window !== 'undefined' ? window : globalThis);
