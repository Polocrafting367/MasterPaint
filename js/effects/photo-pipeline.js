/**
 * photo-pipeline.js — Pipeline photographique de référence (Photo Mode Pro / RAW).
 *
 * OBJECTIF : une seule définition mathématique du traitement, partagée par les trois
 * moteurs (CPU JS, Wasm, WebGL). Tout le traitement se fait en virgule flottante :
 * la scène reste linéaire (scene-referred, 0..+inf) jusqu'au tone mapping, puis
 * display-referred (0..1 en flottant) jusqu'à la toute dernière étape. La
 * quantification 8 bits n'a lieu QU'UNE FOIS, à l'écriture du pixel de sortie.
 *
 * C'est ce qui permet aux outils "couleur" (température, teinte, saturation,
 * vibrance, TSL, courbes) de profiter de la dynamique 14 bits d'un RAW au même
 * titre que les outils "lumière" (exposition, contraste, hautes lumières...).
 *
 * Ordre des opérations (identique dans les trois moteurs) :
 *   1.  décodage vers linéaire (RAW = déjà linéaire, 8 bits = dé-gamma sRGB)
 *   2.  balance des blancs (gains de canaux von Kries, linéaire)
 *   3.  exposition (gain en diaphragmes, linéaire)
 *   4.  noirs / ombres / hautes lumières / blancs (masques perceptuels, linéaire)
 *   5.  étalonnage RGB par zones (split toning, linéaire)
 *   6.  correction du voile puis clarté (contraste local, linéaire)
 *   7.  tone mapping Reinhard étendu calé sur le blanc réel de la scène
 *   8.  encodage sRGB -> flottant 0..1 (aucune quantification)
 *   9.  contraste global (courbe S autour de 0,5)
 *   10. courbes (LUT flottante 1024 points, lecture interpolée)
 *   11. TSL sélectif, saturation, vibrance (en TSL flottant)
 *   12. vignettage
 *   13. netteté (masque flou sur la luminance)
 *   14. grain (bruit déterministe, stable entre aperçu et export)
 *   15. quantification 8 bits avec tramage ordonné
 */
(function (global) {
    'use strict';

    /** Incrémenter à chaque changement de math : invalide les caches d'aperçu. */
    const VERSION = 2;

    // ------------------------------------------------------------------
    // Constantes partagées avec le shader GLSL et le module AssemblyScript.
    // Toute modification ici DOIT être répercutée dans FilterShaders.js
    // (généré via GLSL_CONSTANTS) et dans assembly/camera_raw.ts.
    // ------------------------------------------------------------------
    const K = {
        /** Exposition : 100 unités de curseur = 2 diaphragmes. */
        EXPOSURE_STOPS_PER_100: 2.0,

        /**
         * Balance des blancs : écart de température maximal, en mireds.
         *
         * Calibré pour une course de curseur de ±100 (±150 en RAW), de sorte
         * que la progression soit régulière d'un bout à l'autre. Avec l'ancienne
         * course de ±1000, la tangente hyperbolique saturait dès 200 : les
         * premiers pourcents du curseur produisaient tout l'effet — l'image
         * virait au bleu ou à l'orange vif au moindre déplacement — et les
         * 80 % restants ne changeaient plus rien.
         */
        WB_MIRED_SPAN: 130.0,
        /** Douceur de la saturation du curseur température (tanh(u / SOFT)). */
        WB_TEMP_SOFT: 0.9,
        /** Teinte : décalage vert/magenta maximal (fraction de gain). */
        WB_TINT_SPAN: 0.22,
        WB_TINT_SOFT: 0.9,
        /** Température de référence de la scène après balance des blancs boîtier. */
        WB_REF_KELVIN: 6500.0,

        /** Seuils des masques tonaux, exprimés en luminance perceptuelle (L^(1/2.2)). */
        MASK_SHADOW_HI: 0.55,
        MASK_BLACK_HI: 0.25,
        MASK_HIGHLIGHT_LO: 0.45,
        MASK_WHITE_LO: 0.70,

        /**
         * Amplitude des réglages tonaux, en exposant du gain exp(amt·tanh(u)).
         *
         * Ces valeurs fixent la course utile de chaque curseur, en diaphragmes :
         * amt = 2,4 autorise environ 3,5 IL de récupération. Les valeurs
         * précédentes (0,9 à 1,3) plafonnaient à ~1,3 IL — trop peu pour
         * rattraper un ciel ou ouvrir une ombre profonde sur un RAW, d'où
         * l'impression que la dynamique 14 bits ne servait à rien.
         */
        AMT_SHADOWS: 2.20,
        AMT_BLACKS: 2.00,
        AMT_HIGHLIGHTS: 2.40,
        AMT_WHITES: 1.80,

        /** Étalonnage RGB : largeur des zones hautes/basses. */
        SPLIT_PIVOT: 0.45,
        AMT_SPLIT_ZONE: 1.5,

        /**
         * Seuil de l'épaulement du tone mapping, en linéaire.
         * En dessous, la courbe est l'IDENTITÉ : ombres et tons moyens ne sont
         * jamais touchés. Seul ce qui dépasse est comprimé vers le blanc.
         */
        TONE_SHOULDER_START: 0.65,
        /** Bornes du seuil quand il s'adapte à la dynamique à comprimer. */
        TONE_SHOULDER_MIN: 0.45,
        TONE_SHOULDER_MAX: 0.70,

        /** Tone mapping : bornes du point blanc de la scène. */
        TONE_WHITE_MIN: 1.0,
        // Assez haut pour couvrir une scène très contrastée poussée de
        // plusieurs diaphragmes : un plafond trop bas écrête les hautes
        // lumières que l'on cherche justement à récupérer.
        TONE_WHITE_MAX: 64.0,
        /** Désaturation des très hautes lumières (évite les pixels cramés colorés). */
        TONE_DESAT_START: 0.72,
        TONE_DESAT_AMOUNT: 0.55,

        /** Contraste : 100 unités = facteur 2 autour du pivot. */
        CONTRAST_PIVOT: 0.5,

        /** Saturation / vibrance en TSL flottant. */
        SAT_SOFT_KNEE: 0.85,
        AMT_VIBRANCE: 0.60,

        /** Clarté : rayon du flou, en fraction du plus petit côté. */
        CLARITY_RADIUS_FRAC: 0.020,
        AMT_CLARITY: 0.75,
        /** Dehaze : rayon du flou (voile = basses fréquences). */
        DEHAZE_RADIUS_FRAC: 0.060,
        AMT_DEHAZE: 0.55,

        /** Vignettage. */
        VIGNETTE_INNER: 0.35,
        VIGNETTE_OUTER: 1.05,

        /** Grain : taille du motif en pixels de l'image traitée. */
        GRAIN_BASE_SCALE: 1.35,

        /** Netteté : 100 unités = facteur d'accentuation. */
        AMT_SHARPEN: 1.20,

        /**
         * Masques tonaux LOCAUX.
         * Le masque d'une étape tonale est évalué sur la luminance moyenne du
         * voisinage, et non sur le seul pixel : le gain devient alors presque
         * constant à l'échelle du détail, si bien qu'éclaircir une ombre ou
         * rattraper une haute lumière déplace la zone entière sans écraser son
         * micro-contraste. Un masque strictement par pixel, lui, comprime la
         * zone sur elle-même et efface le modelé.
         */
        LOCAL_RADIUS_FRAC: 0.045,
        LOCAL_MIX: 0.72,
        /**
         * Tolérance en luminance du masque local (filtre bilatéral).
         *
         * Une simple moyenne du voisinage déborde par-dessus les contours
         * francs : le masque d'une zone claire mord sur l'ombre voisine, ce qui
         * se voit comme un halo — un « bavement » — le long des silhouettes.
         * Chaque point d'échantillonnage est donc pondéré par sa ressemblance
         * en luminance avec le pixel traité : le masque suit les contours au
         * lieu de les traverser.
         *
         * Trop petite, la pondération isole chaque pixel et la transition
         * redevient sèche ; trop grande, elle ne protège plus des halos.
         */
        LOCAL_SIGMA: 0.22,

        /** Reconstruction des hautes lumières écrêtées au niveau du capteur. */
        CLIP_FIX_START: 0.90,
        CLIP_FIX_AMOUNT: 1.0,

        /** Luminance Rec.709 (linéaire). */
        LUMA_R: 0.2126, LUMA_G: 0.7152, LUMA_B: 0.0722
    };

    /**
     * Points d'échantillonnage du masque local : le centre, puis deux anneaux
     * de six points décalés d'un demi-pas. Cette approximation éparse remplace
     * un vrai flou — elle suffit pour un masque, tient en une seule passe, et
     * surtout se reproduit à l'identique sur GPU comme sur CPU.
     */
    /** Gaussienne du filtre bilatéral, tabulée sur |Δluminance| ∈ [0, 1]. */
    const BILATERAL_N = 256;
    const BILATERAL_LUT = new Float32Array(BILATERAL_N + 1);
    for (let i = 0; i <= BILATERAL_N; i++) {
        const d = i / BILATERAL_N;
        BILATERAL_LUT[i] = Math.exp(-(d * d) / (2 * 0.22 * 0.22));
    }

    function bilateralWeight(delta) {
        const d = delta < 0 ? -delta : delta;
        if (d >= 1) return BILATERAL_LUT[BILATERAL_N];
        return BILATERAL_LUT[(d * BILATERAL_N) | 0];
    }

    const LOCAL_TAPS = (function () {
        const t = [[0, 0]];
        for (let i = 0; i < 6; i++) {
            const a = (i / 6) * Math.PI * 2;
            t.push([Math.cos(a) * 0.5, Math.sin(a) * 0.5]);
        }
        for (let i = 0; i < 6; i++) {
            const a = ((i + 0.5) / 6) * Math.PI * 2;
            t.push([Math.cos(a), Math.sin(a)]);
        }
        return t;
    })();

    // ------------------------------------------------------------------
    // Espaces colorimétriques
    // ------------------------------------------------------------------

    function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
    function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }

    /** sRGB (0..1) -> linéaire (0..1). Étend la courbe au-delà de 1 par symétrie. */
    function srgbToLinear(c) {
        if (c <= 0) return 0;
        if (c <= 0.04045) return c / 12.92;
        return Math.pow((c + 0.055) / 1.055, 2.4);
    }

    /**
     * Linéaire -> sRGB, SANS écrêtage haut : au-dessus de 1 la courbe est prolongée
     * par sa tangente. Le tone mapping se charge de ramener la scène dans 0..1 ;
     * un écrêtage ici détruirait la dynamique avant les outils couleur.
     */
    function linearToSrgb(c) {
        if (c <= 0) return 0;
        if (c <= 0.0031308) return 12.92 * c;
        if (c <= 1) return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        // Prolongement linéaire C1 au-delà du blanc (pente de la courbe en c = 1).
        return 1 + (c - 1) * (1.055 / 2.4);
    }

    /** LUT de dé-gamma pour les sources 8 bits (exacte, 256 entrées). */
    const SRGB_TO_LIN_8 = new Float32Array(256);
    for (let i = 0; i < 256; i++) SRGB_TO_LIN_8[i] = srgbToLinear(i / 255);

    /**
     * LUT d'encodage sRGB pour la sortie : 4096 entrées sur 0..1, lecture
     * interpolée. Sert uniquement à accélérer la dernière étape ; la précision
     * reste très supérieure au 8 bits final.
     */
    const LIN_TO_SRGB_F = new Float32Array(4097);
    for (let i = 0; i <= 4096; i++) LIN_TO_SRGB_F[i] = linearToSrgb(i / 4096);

    function fastLinearToSrgb(c) {
        if (c <= 0) return 0;
        if (c >= 1) return linearToSrgb(c);
        const t = c * 4096;
        const i = t | 0;
        const f = t - i;
        return LIN_TO_SRGB_F[i] * (1 - f) + LIN_TO_SRGB_F[i + 1] * f;
    }

    function lumaLinear(r, g, b) { return K.LUMA_R * r + K.LUMA_G * g + K.LUMA_B * b; }

    /**
     * Luminance perceptuelle approchée : sert de base aux masques tonaux.
     * Tabulée sur 0..4 (la plage utile après exposition), lecture interpolée ;
     * au-delà on calcule directement, ce qui ne concerne que de rares pixels.
     */
    const PERC_MAX = 4;
    const PERC_N = 4096;
    const PERC_LUT = new Float32Array(PERC_N + 1);
    for (let i = 0; i <= PERC_N; i++) PERC_LUT[i] = Math.pow((i / PERC_N) * PERC_MAX, 1 / 2.2);

    function perceptual(y) {
        if (y <= 0) return 0;
        if (y >= PERC_MAX) return Math.pow(y, 1 / 2.2);
        const t = (y / PERC_MAX) * PERC_N;
        const i = t | 0;
        const f = t - i;
        return PERC_LUT[i] + (PERC_LUT[i + 1] - PERC_LUT[i]) * f;
    }

    function smoothstep(e0, e1, x) {
        const t = clamp01((x - e0) / (e1 - e0));
        return t * t * (3 - 2 * t);
    }

    // ------------------------------------------------------------------
    // TSL en flottant (0..1), sans quantification 8 bits
    // ------------------------------------------------------------------

    /** RGB 0..1 -> {h: 0..360, s: 0..1, l: 0..1}. Accepte des valeurs > 1. */
    function rgbToHslF(r, g, b, out) {
        const max = r > g ? (r > b ? r : b) : (g > b ? g : b);
        const min = r < g ? (r < b ? r : b) : (g < b ? g : b);
        const l = (max + min) * 0.5;
        let h = 0, s = 0;
        const d = max - min;
        if (d > 1e-9) {
            s = l > 0.5 ? d / Math.max(1e-9, 2 - max - min) : d / Math.max(1e-9, max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h *= 60;
        }
        out.h = h; out.s = s; out.l = l;
        return out;
    }

    function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
    }

    /** {h: 0..360, s: 0..1, l: 0..1} -> RGB 0..1 flottant (non écrêté). */
    function hslToRgbF(h, s, l, out) {
        if (s <= 1e-9) { out.r = l; out.g = l; out.b = l; return out; }
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hn = (h / 360) % 1;
        out.r = hue2rgb(p, q, hn + 1 / 3);
        out.g = hue2rgb(p, q, hn);
        out.b = hue2rgb(p, q, hn - 1 / 3);
        return out;
    }

    /** Pondération des 8 bandes du mélangeur TSL (rouge, orange, jaune, vert, cyan, bleu, violet, magenta). */
    function hslBandWeights(h, out) {
        let i1, i2, w2;
        if (h < 30) { i1 = 0; i2 = 1; w2 = h / 30; }
        else if (h < 60) { i1 = 1; i2 = 2; w2 = (h - 30) / 30; }
        else if (h < 120) { i1 = 2; i2 = 3; w2 = (h - 60) / 60; }
        else if (h < 180) { i1 = 3; i2 = 4; w2 = (h - 120) / 60; }
        else if (h < 240) { i1 = 4; i2 = 5; w2 = (h - 180) / 60; }
        else if (h < 280) { i1 = 5; i2 = 6; w2 = (h - 240) / 40; }
        else if (h < 320) { i1 = 6; i2 = 7; w2 = (h - 280) / 40; }
        else { i1 = 7; i2 = 0; w2 = (h - 320) / 40; }
        out.i1 = i1; out.i2 = i2; out.w1 = 1 - w2; out.w2 = w2;
        return out;
    }

    /**
     * Gain tonal borné : exp(amt * tanh(u)).
     * Toujours strictement positif (jamais d'inversion de canal) et saturant,
     * pour que les plages de curseurs très larges du mode RAW restent utilisables.
     */
    function toneGain(u, amt) {
        if (u === 0) return 1;
        return Math.exp(amt * Math.tanh(u));
    }

    // ------------------------------------------------------------------
    // Balance des blancs : vraie température de couleur (von Kries)
    // ------------------------------------------------------------------

    /** Coordonnées CIE 1931 xy du corps noir (approximation Kim et al., 1667K-25000K). */
    function planckianXY(kelvin) {
        const T = clamp(kelvin, 1667, 25000);
        const t = 1000 / T;
        let x;
        if (T <= 4000) {
            x = -0.2661239 * t * t * t - 0.2343589 * t * t + 0.8776956 * t + 0.179910;
        } else {
            x = -3.0258469 * t * t * t + 2.1070379 * t * t + 0.2226347 * t + 0.240390;
        }
        let y;
        if (T <= 2222) {
            y = -1.1063814 * x * x * x - 1.34811020 * x * x + 2.18555832 * x - 0.20219683;
        } else if (T <= 4000) {
            y = -0.9549476 * x * x * x - 1.37418593 * x * x + 2.09137015 * x - 0.16748867;
        } else {
            y = 3.0817580 * x * x * x - 5.87338670 * x * x + 3.75112997 * x - 0.37001483;
        }
        return { x: x, y: y };
    }

    /** xy -> RGB linéaire sRGB (luminance Y = 1). */
    function xyToLinearRgb(x, y) {
        const Y = 1.0;
        const X = (x / Math.max(1e-6, y)) * Y;
        const Z = ((1 - x - y) / Math.max(1e-6, y)) * Y;
        return {
            r: 3.2404542 * X - 1.5371385 * Y - 0.4985314 * Z,
            g: -0.9692660 * X + 1.8760108 * Y + 0.0415560 * Z,
            b: 0.0556434 * X - 0.2040259 * Y + 1.0572252 * Z
        };
    }

    /**
     * Gains de canaux linéaires pour les curseurs température / teinte.
     *
     * Les deux curseurs sont normalisés de la même façon quel que soit le mode
     * (8 bits ou RAW 14 bits) : u = valeur / 100. C'était LA cause du décrochage
     * du mode RAW, qui divisait par 1000 et rendait la balance des blancs dix
     * fois moins efficace. Une tangente hyperbolique borne l'écart de température
     * à WB_MIRED_SPAN mireds : les plages de curseurs très larges du mode RAW
     * restent exploitables au lieu de produire des gains négatifs.
     *
     * Les gains sont renormalisés en luminance : changer la balance des blancs
     * ne change pas l'exposition.
     */
    function whiteBalanceGains(temp, tint) {
        const gains = { r: 1, g: 1, b: 1 };
        const tu = (temp || 0) / 100;
        const nu = (tint || 0) / 100;
        if (tu === 0 && nu === 0) return gains;

        if (tu !== 0) {
            // Curseur positif = image plus chaude, donc illuminant plus froid à compenser.
            const dMired = -K.WB_MIRED_SPAN * Math.tanh(tu / K.WB_TEMP_SOFT);
            const refMired = 1e6 / K.WB_REF_KELVIN;
            const targetK = 1e6 / Math.max(20, refMired + dMired);
            const xy = planckianXY(targetK);
            const w = xyToLinearRgb(xy.x, xy.y);
            const ref = xyToLinearRgb(0.31271, 0.32902); // D65
            gains.r = ref.r / Math.max(1e-4, w.r);
            gains.g = ref.g / Math.max(1e-4, w.g);
            gains.b = ref.b / Math.max(1e-4, w.b);
        }

        if (nu !== 0) {
            // Axe vert/magenta, perpendiculaire à la courbe de Planck.
            const t = K.WB_TINT_SPAN * Math.tanh(nu / K.WB_TINT_SOFT);
            gains.g *= Math.max(0.05, 1 - t);
            gains.r *= Math.max(0.05, 1 + t * 0.5);
            gains.b *= Math.max(0.05, 1 + t * 0.5);
        }

        // Renormalisation : la balance des blancs ne doit pas déplacer l'exposition.
        const y = lumaLinear(gains.r, gains.g, gains.b);
        if (y > 1e-6) { gains.r /= y; gains.g /= y; gains.b /= y; }
        return gains;
    }

    /**
     * Reconstruction des hautes lumières écrêtées.
     *
     * Quand un photosite sature, son canal se fige au plafond tandis que les
     * autres continuent de monter : le blanc d'une zone brûlée n'est alors plus
     * neutre, et ressort teinté — typiquement en rose. On remonte les canaux
     * restés en dessous vers le canal saturé, proportionnellement à la
     * saturation atteinte, ce qui rend un blanc neutre.
     *
     * @param {object} c couleur linéaire {r,g,b}, modifiée sur place
     * @param {number} ceiling plafond de saturation, en linéaire
     */
    function reconstructClipped(c, ceiling) {
        const mx = c.r > c.g ? (c.r > c.b ? c.r : c.b) : (c.g > c.b ? c.g : c.b);
        const start = ceiling * K.CLIP_FIX_START;
        if (mx <= start) return c;
        // 0 au seuil, 1 quand le canal le plus fort atteint le plafond.
        const t = Math.min(1, (mx - start) / Math.max(1e-6, ceiling - start)) * K.CLIP_FIX_AMOUNT;
        if (t <= 0) return c;
        c.r += (mx - c.r) * t;
        c.g += (mx - c.g) * t;
        c.b += (mx - c.b) * t;
        return c;
    }

    // ------------------------------------------------------------------
    // Tone mapping
    // ------------------------------------------------------------------

    /**
     * Point blanc de la scène, en linéaire, APRÈS balance des blancs et exposition.
     *
     * Calé sur le blanc réel de la source (sourceWhite) plutôt que sur une
     * constante : une scène qui ne dépasse pas 1.0 traverse le tone mapping sans
     * être modifiée (voir toneMap), tandis qu'un RAW poussé de +3 IL est comprimé
     * en douceur au lieu d'être écrêté.
     */
    function sceneWhite(p, sourceWhite) {
        const sw = (typeof sourceWhite === 'number' && isFinite(sourceWhite) && sourceWhite > 0) ? sourceWhite : 1.0;
        const expMult = Math.pow(2, ((p.exposure || 0) / 100) * K.EXPOSURE_STOPS_PER_100);
        const g = whiteBalanceGains(p.temp, p.tint);
        const wbMax = Math.max(g.r, g.g, g.b);

        // Gain appliqué au sommet de l'histogramme par les étapes tonales, dans
        // LES DEUX SENS.
        //
        // Ne compter que les valeurs positives — ce que faisait la version
        // précédente — rendait le curseur des hautes lumières impuissant sur un
        // RAW : on abaissait le ciel en linéaire, mais le point blanc du tone
        // mapping restait inchangé, si bien que la compression le remontait
        // aussitôt vers 1,0. Le réglage semblait alors sans effet, et la
        // dynamique du 14 bits paraissait inexploitable.
        //
        // Seules les valeurs POSITIVES comptent. Un réglage négatif abaisse
        // volontairement les hautes lumières ; si le point blanc le suivait, la
        // compression se relâcherait d'autant et remonterait aussitôt ce que
        // l'on vient d'abaisser — le curseur paraîtrait sans effet.
        const topGain = toneGain(Math.max(0, (p.highlights || 0) / 100), K.AMT_HIGHLIGHTS) *
                        toneGain(Math.max(0, (p.whites || 0) / 100), K.AMT_WHITES);

        return clamp(sw * expMult * wbMax * topGain, K.TONE_WHITE_MIN, K.TONE_WHITE_MAX);
    }

    /**
     * Tone mapping à ÉPAULEMENT : identité jusqu'à TONE_SHOULDER_START, puis
     * compression exponentielle qui amène exactement W sur 1,0.
     *
     * Le Reinhard étendu employé auparavant comprimait la plage ENTIÈRE dès que
     * W dépassait 1 : sur un RAW réel (blanc de scène 0,65 poussé de 2 IL, donc
     * W ≈ 2,8) le blanc diffus ressortait à 198/255 et le gris moyen à 110 — 
     * toute l'image était tassée vers le gris, d'où sa platitude. Ici les
     * ombres et les tons moyens traversent la courbe inchangés, et seules les
     * hautes lumières sont rattrapées.
     *
     * Continuité C1 au seuil : la pente y vaut 1 par construction (k = 1/(1-T)).
     */
    /**
     * Seuil de l'épaulement, ajusté à la dynamique restant à comprimer.
     * Plus il y a de diaphragmes à ramener dans 0..1, plus l'épaulement démarre
     * tôt et s'étale — sinon les hautes lumières se tassent toutes contre 1,0.
     * La pente au seuil reste 1 par construction, donc aucune cassure visible.
     */
    function shoulderStart(W) {
        if (!(W > 1)) return K.TONE_SHOULDER_START;
        const t = 0.75 - 0.08 * Math.log2(W);
        return clamp(t, K.TONE_SHOULDER_MIN, K.TONE_SHOULDER_MAX);
    }

    function toneMapScalar(x, W) {
        if (x <= 0) return 0;
        if (W <= 1.0000001) return x;
        const T = shoulderStart(W);
        if (x <= T) return x;          // identité : rien n'est assombri
        if (W <= T) return x;
        const k = 1 / (1 - T);
        const denom = 1 - Math.exp(-k * (W - T));
        if (denom <= 1e-6) return x;
        return T + (1 - T) * (1 - Math.exp(-k * (x - T))) / denom;
    }

    /**
     * Tone mapping appliqué au canal le plus lumineux, avec conservation des
     * rapports de couleur, puis désaturation progressive des très hautes
     * lumières : un ciel surexposé tend vers le blanc au lieu de virer.
     */
    function toneMapRgb(c, W) {
        const maxC = Math.max(c.r, Math.max(c.g, c.b));
        if (maxC <= 0) { c.r = 0; c.g = 0; c.b = 0; return c; }
        // Sans compression à faire (W = 1), le tone mapping est l'identité
        // stricte : une image qui ne déborde pas ressort inchangée.
        if (W <= 1.0000001) return c;

        const ratio = toneMapScalar(maxC, W) / maxC;
        c.r *= ratio; c.g *= ratio; c.b *= ratio;

        const m = Math.max(c.r, Math.max(c.g, c.b));
        if (m > K.TONE_DESAT_START) {
            const t = smoothstep(K.TONE_DESAT_START, 1.0, m) * K.TONE_DESAT_AMOUNT;
            const y = lumaLinear(c.r, c.g, c.b);
            c.r += (y - c.r) * t;
            c.g += (y - c.g) * t;
            c.b += (y - c.b) * t;
        }
        return c;
    }

    // ------------------------------------------------------------------
    // Courbes : LUT flottante haute résolution
    // ------------------------------------------------------------------

    const CURVE_LUT_SIZE = 1024;

    /** true si la courbe n'est pas l'identité. */
    function curveIsActive(pts) {
        if (!pts || pts.length === 0) return false;
        if (pts.length > 2) return true;
        return !(pts[0].x === 0 && pts[0].y === 0 && pts[1].x === 255 && pts[1].y === 255);
    }

    /**
     * Interpolation cubique monotone (Fritsch-Carlson) sur les points de contrôle
     * exprimés en 0..255, échantillonnée dans une LUT flottante 0..1.
     */
    function buildCurveLUT(pts) {
        const lut = new Float32Array(CURVE_LUT_SIZE);
        if (!pts || pts.length === 0) {
            for (let i = 0; i < CURVE_LUT_SIZE; i++) lut[i] = i / (CURVE_LUT_SIZE - 1);
            return lut;
        }

        pts = pts.slice().sort((a, b) => a.x - b.x);
        if (pts[0].x > 0) pts.unshift({ x: 0, y: pts[0].y });
        if (pts[pts.length - 1].x < 255) pts.push({ x: 255, y: pts[pts.length - 1].y });

        const n = pts.length;
        const m = new Float32Array(n);
        const delta = new Float32Array(Math.max(1, n - 1));
        for (let i = 0; i < n - 1; i++) {
            const dx = pts[i + 1].x - pts[i].x;
            delta[i] = dx !== 0 ? (pts[i + 1].y - pts[i].y) / dx : 0;
        }
        m[0] = delta[0];
        m[n - 1] = delta[n - 2];
        for (let i = 1; i < n - 1; i++) {
            if (delta[i - 1] * delta[i] <= 0) m[i] = 0;
            else m[i] = 2 / (1 / delta[i - 1] + 1 / delta[i]);
        }

        let pIdx = 0;
        for (let i = 0; i < CURVE_LUT_SIZE; i++) {
            const xv = (i / (CURVE_LUT_SIZE - 1)) * 255;
            while (pIdx < n - 2 && xv >= pts[pIdx + 1].x) pIdx++;
            const p0 = pts[pIdx], p1 = pts[pIdx + 1];
            const h = p1.x - p0.x;
            if (h === 0) { lut[i] = clamp01(p0.y / 255); continue; }
            const t = (xv - p0.x) / h;
            const t2 = t * t, t3 = t2 * t;
            const v = (2 * t3 - 3 * t2 + 1) * p0.y + (t3 - 2 * t2 + t) * h * m[pIdx] +
                (-2 * t3 + 3 * t2) * p1.y + (t3 - t2) * h * m[pIdx + 1];
            lut[i] = clamp01(v / 255);
        }
        return lut;
    }

    /** Lecture interpolée d'une LUT flottante (entrée et sortie en 0..1). */
    function sampleLUT(lut, x) {
        if (x <= 0) return lut[0];
        if (x >= 1) return lut[CURVE_LUT_SIZE - 1];
        const t = x * (CURVE_LUT_SIZE - 1);
        const i = t | 0;
        const f = t - i;
        const a = lut[i];
        return a + (lut[i + 1] - a) * f;
    }

    // ------------------------------------------------------------------
    // Bruit déterministe (grain)
    // ------------------------------------------------------------------

    /**
     * Hash entier -> 0..1. Déterministe : le grain est identique entre l'aperçu
     * et l'export, et ne scintille pas d'une image à l'autre (contrairement à
     * Math.random(), qui rendait le rendu non reproductible).
     */
    function hashNoise(x, y, seed) {
        let n = (x | 0) * 374761393 + (y | 0) * 668265263 + (seed | 0) * 1274126177;
        n = (n ^ (n >>> 13)) | 0;
        n = Math.imul(n, 1274126177) | 0;
        n = (n ^ (n >>> 16)) >>> 0;
        return n / 4294967296;
    }

    // ------------------------------------------------------------------
    // Flou séparable (clarté / correction du voile)
    // ------------------------------------------------------------------

    /**
     * Trois passes de flou par boîte ≈ flou gaussien, en O(n) par pixel.
     * Opère sur un canal unique (la luminance) pour rester rapide.
     */
    function boxBlurChannel(src, dst, width, height, radius) {
        if (radius < 1) { dst.set(src); return dst; }
        const tmp = new Float32Array(src.length);
        // 3 allers-retours horizontal/vertical : src -> dst -> tmp -> dst -> tmp -> dst
        blurH(src, tmp, width, height, radius);
        blurV(tmp, dst, width, height, radius);
        blurH(dst, tmp, width, height, radius);
        blurV(tmp, dst, width, height, radius);
        blurH(dst, tmp, width, height, radius);
        blurV(tmp, dst, width, height, radius);
        return dst;
    }

    function blurH(src, dst, width, height, r) {
        const norm = 1 / (2 * r + 1);
        for (let y = 0; y < height; y++) {
            const row = y * width;
            let acc = src[row] * (r + 1);
            for (let i = 1; i <= r; i++) acc += src[row + Math.min(i, width - 1)];
            for (let x = 0; x < width; x++) {
                dst[row + x] = acc * norm;
                const add = src[row + Math.min(x + r + 1, width - 1)];
                const sub = src[row + Math.max(x - r, 0)];
                acc += add - sub;
            }
        }
    }

    function blurV(src, dst, width, height, r) {
        const norm = 1 / (2 * r + 1);
        for (let x = 0; x < width; x++) {
            let acc = src[x] * (r + 1);
            for (let i = 1; i <= r; i++) acc += src[Math.min(i, height - 1) * width + x];
            for (let y = 0; y < height; y++) {
                dst[y * width + x] = acc * norm;
                const add = src[Math.min(y + r + 1, height - 1) * width + x];
                const sub = src[Math.max(y - r, 0) * width + x];
                acc += add - sub;
            }
        }
    }

    // ------------------------------------------------------------------
    // Compression douce des extrémités
    // ------------------------------------------------------------------

    /**
     * Compression douce vers 1.0 qui PRÉSERVE EXACTEMENT 0 et la partie basse.
     * Sert aux grandeurs qui n'ont pas de borne haute naturelle (la saturation),
     * pour qu'un réglage extrême sature progressivement au lieu de se figer en
     * aplat de couleur.
     */
    function softKnee01(x, knee) {
        if (x <= knee) return x < 0 ? 0 : x;
        return 1 - (1 - knee) * Math.exp(-(x - knee) / (1 - knee));
    }

    /**
     * Contraste en courbe S normalisée, dans 0..1.
     *
     * Positif : 0.5 + 0.5·tanh(f·atanh(2x-1)). Cette forme mappe [0,1] sur
     * [0,1] par construction — 0 reste 0 et 1 reste 1 — donc elle ne peut ni
     * écrêter ni créer d'aplats, contrairement à la mise à l'échelle linéaire
     * suivie d'un clamp qui était utilisée jusqu'ici.
     * Négatif : rapprochement linéaire du pivot, qui reste dans 0..1.
     */
    function contrastS(x, f) {
        if (f === 1) return x;
        if (f < 1) return K.CONTRAST_PIVOT + (x - K.CONTRAST_PIVOT) * f;
        const u = 2 * x - 1;
        if (u <= -0.9999999) return 0;
        if (u >= 0.9999999) return 1;
        const a = 0.5 * Math.log((1 + u) / (1 - u)); // atanh
        return 0.5 + 0.5 * Math.tanh(f * a);
    }

    // ------------------------------------------------------------------
    // Tabulation des étapes coûteuses
    //
    // Les masques tonaux et l'étalonnage par zones ne dépendent que de la
    // luminance perceptuelle du pixel : leur gain se tabule donc une fois pour
    // toutes, ce qui évite quelques millions d'appels à exp/tanh sur une image
    // pleine résolution. Idem pour le contraste, qui repose sur atanh/tanh.
    // ------------------------------------------------------------------

    const ZONE_N = 1024;
    const ZONE_MAX = 1.3; // la luminance perceptuelle dépasse 1 dans les hautes lumières

    /** Gain tonal combiné (noirs, ombres, hautes lumières, blancs) indexé par pl. */
    function buildToneCurve(uSh, uBl, uHi, uWh) {
        const lut = new Float32Array(ZONE_N + 1);
        for (let i = 0; i <= ZONE_N; i++) {
            const pl = (i / ZONE_N) * ZONE_MAX;
            let g = 1;
            if (uSh !== 0) g *= toneGain(uSh * smoothstep(K.MASK_SHADOW_HI, 0, pl), K.AMT_SHADOWS);
            if (uBl !== 0) g *= toneGain(uBl * smoothstep(K.MASK_BLACK_HI, 0, pl), K.AMT_BLACKS);
            if (uHi !== 0) g *= toneGain(uHi * smoothstep(K.MASK_HIGHLIGHT_LO, 1.0, pl), K.AMT_HIGHLIGHTS);
            if (uWh !== 0) g *= toneGain(uWh * smoothstep(K.MASK_WHITE_LO, 1.15, pl), K.AMT_WHITES);
            lut[i] = g;
        }
        return lut;
    }

    /** Gain d'un canal de l'étalonnage RGB (global + zone haute + zone basse). */
    function buildSplitCurve(uFlat, uHi, uSh) {
        const lut = new Float32Array(ZONE_N + 1);
        const flat = uFlat !== 0 ? toneGain(uFlat, 1.0) : 1;
        for (let i = 0; i <= ZONE_N; i++) {
            const pl = (i / ZONE_N) * ZONE_MAX;
            let g = flat;
            if (uHi !== 0) g *= toneGain(uHi * smoothstep(K.SPLIT_PIVOT, 1.0, pl), K.AMT_SPLIT_ZONE);
            if (uSh !== 0) g *= toneGain(uSh * smoothstep(K.SPLIT_PIVOT, 0.0, pl), K.AMT_SPLIT_ZONE);
            lut[i] = g;
        }
        return lut;
    }

    /** Lecture interpolée d'une LUT tabulée sur 0..1. */
    function sampleZone01(lut, x) {
        if (x <= 0) return lut[0];
        if (x >= 1) return lut[ZONE_N];
        const t = x * ZONE_N;
        const i = t | 0;
        return lut[i] + (lut[i + 1] - lut[i]) * (t - i);
    }

    function sampleZone(lut, pl) {
        if (pl <= 0) return lut[0];
        if (pl >= ZONE_MAX) return lut[ZONE_N];
        const t = (pl / ZONE_MAX) * ZONE_N;
        const i = t | 0;
        return lut[i] + (lut[i + 1] - lut[i]) * (t - i);
    }

    /** Courbe de contraste tabulée sur 0..1. */
    function buildContrastLUT(f) {
        const lut = new Float32Array(ZONE_N + 1);
        for (let i = 0; i <= ZONE_N; i++) lut[i] = contrastS(i / ZONE_N, f);
        return lut;
    }

    // ------------------------------------------------------------------
    // Pipeline complet (référence CPU)
    // ------------------------------------------------------------------

    /**
     * @param {Float32Array|Uint8ClampedArray} src RGBA. Float32 = linéaire scene-referred
     *        (alpha 0..1) ; Uint8 = sRGB 8 bits (alpha 0..255).
     * @param {number} width
     * @param {number} height
     * @param {object} p paramètres du panneau (mêmes noms que DEFAULT_PARAMS)
     * @param {object} [opts]
     *        - sourceWhite : blanc linéaire de la source (défaut 1.0)
     *        - fullWidth / fullHeight : dimensions de l'image d'origine, pour que
     *          le grain garde la même granulométrie entre aperçu et export
     *        - output : 'u8' (défaut) ou 'float'
     * @returns {Uint8ClampedArray|Float32Array}
     */
    function process(src, width, height, p, opts) {
        opts = opts || {};
        p = p || {};
        const n = width * height;
        const isFloatSrc = (src instanceof Float32Array);
        const outputFloat = opts.output === 'float';

        // Buffer de travail : toujours en flottant, du début à la fin.
        const buf = new Float32Array(n * 4);

        // ---- Paramètres dérivés (calculés une seule fois) ----------------
        const expMult = Math.pow(2, ((p.exposure || 0) / 100) * K.EXPOSURE_STOPS_PER_100);
        const wb = whiteBalanceGains(p.temp, p.tint);
        const gR = wb.r * expMult, gG = wb.g * expMult, gB = wb.b * expMult;

        const uSh = (p.shadows || 0) / 100;
        const uBl = (p.blacks || 0) / 100;
        const uHi = (p.highlights || 0) / 100;
        const uWh = (p.whites || 0) / 100;
        const hasTone = uSh !== 0 || uBl !== 0 || uHi !== 0 || uWh !== 0;

        const uRed = (p.red || 0) / 100, uRedHi = (p.redHi || 0) / 100, uRedSh = (p.redSh || 0) / 100;
        const uGrn = (p.green || 0) / 100, uGrnHi = (p.greenHi || 0) / 100, uGrnSh = (p.greenSh || 0) / 100;
        const uBlu = (p.blue || 0) / 100, uBluHi = (p.blueHi || 0) / 100, uBluSh = (p.blueSh || 0) / 100;
        const hasSplit = uRed || uRedHi || uRedSh || uGrn || uGrnHi || uGrnSh || uBlu || uBluHi || uBluSh;

        const uClarity = (p.clarity || 0) / 100;
        const uDehaze = (p.dehaze || 0) / 100;
        const hasLocal = uClarity !== 0 || uDehaze !== 0;

        const W = sceneWhite(p, opts.sourceWhite);

        const contrastF = Math.exp(((p.contrast || 0) / 100) * 0.9);
        const hasContrast = (p.contrast || 0) !== 0;
        const contrastLUT = hasContrast ? buildContrastLUT(contrastF) : null;

        // Le masque local est activable réglage par réglage : `maskOn` porte les
        // exceptions, le masque étant actif par défaut. Les étapes masquées et
        // les étapes par pixel sont tabulées séparément, puis composées.
        const maskOn = p.maskOn || {};
        const masked = (k) => maskOn[k] !== false;
        const pick = (v, k, want) => (masked(k) === want ? v : 0);

        const toneLUTLocal = hasTone
            ? buildToneCurve(pick(uSh, 'shadows', true), pick(uBl, 'blacks', true),
                             pick(uHi, 'highlights', true), pick(uWh, 'whites', true))
            : null;
        const anyPixel = (uSh && !masked('shadows')) || (uBl && !masked('blacks')) ||
                         (uHi && !masked('highlights')) || (uWh && !masked('whites'));
        const toneLUTPixel = anyPixel
            ? buildToneCurve(pick(uSh, 'shadows', false), pick(uBl, 'blacks', false),
                             pick(uHi, 'highlights', false), pick(uWh, 'whites', false))
            : null;
        const splitR = hasSplit ? buildSplitCurve(uRed, uRedHi, uRedSh) : null;
        const splitG = hasSplit ? buildSplitCurve(uGrn, uGrnHi, uGrnSh) : null;
        const splitB = hasSplit ? buildSplitCurve(uBlu, uBluHi, uBluSh) : null;

        const lutM = curveIsActive(p.curveMaster) ? buildCurveLUT(p.curveMaster) : null;
        const lutR = curveIsActive(p.curveR) ? buildCurveLUT(p.curveR) : null;
        const lutG = curveIsActive(p.curveG) ? buildCurveLUT(p.curveG) : null;
        const lutB = curveIsActive(p.curveB) ? buildCurveLUT(p.curveB) : null;
        const hasCurves = !!(lutM || lutR || lutG || lutB);

        const hslHue = p.hslHue || null, hslSat = p.hslSat || null, hslLum = p.hslLum || null;
        const nonZero = (a) => !!a && a.some((v) => v !== 0);
        const hasHsl = nonZero(hslHue) || nonZero(hslSat) || nonZero(hslLum);

        const satM = Math.exp(((p.saturation || 0) / 100) * 0.9);
        const vibF = Math.tanh((p.vibrance || 0) / 100);
        const hasSat = (p.saturation || 0) !== 0 || (p.vibrance || 0) !== 0;
        const needsHslStage = hasHsl || hasSat;

        // =================================================================
        // PASSE 1a — linéaire : reconstruction des hautes lumières écrêtées,
        //            balance des blancs, exposition
        // =================================================================
        const ceiling = (typeof opts.sourceWhite === 'number' && opts.sourceWhite > 0) ? opts.sourceWhite : 1.0;
        const cc = { r: 0, g: 0, b: 0 };

        for (let i = 0, o = 0; i < n; i++, o += 4) {
            let r, g, b, a;
            if (isFloatSrc) {
                r = src[o]; g = src[o + 1]; b = src[o + 2]; a = src[o + 3];
            } else {
                r = SRGB_TO_LIN_8[src[o]]; g = SRGB_TO_LIN_8[src[o + 1]]; b = SRGB_TO_LIN_8[src[o + 2]];
                a = src[o + 3] / 255;
            }
            if (r < 0) r = 0; if (g < 0) g = 0; if (b < 0) b = 0;

            // Rend leur neutralité aux zones brûlées avant toute correction de
            // couleur : sinon la dominante du capteur serait amplifiée.
            cc.r = r; cc.g = g; cc.b = b;
            reconstructClipped(cc, ceiling);

            // Balance des blancs et exposition, fusionnées en un seul gain par canal.
            buf[o] = cc.r * gR;
            buf[o + 1] = cc.g * gG;
            buf[o + 2] = cc.b * gB;
            buf[o + 3] = a;
        }

        // =================================================================
        // PASSE 1b — masques tonaux locaux, puis tonalité et étalonnage
        //
        // Le masque de chaque étape est lu sur la luminance MOYENNE du
        // voisinage : le gain reste alors quasi constant à l'échelle du
        // détail, et une ombre remontée conserve son modelé au lieu d'être
        // aplatie.
        // =================================================================
        if (hasTone || hasSplit) {
            const plBuf = new Float32Array(n);
            for (let i = 0, o = 0; i < n; i++, o += 4) {
                plBuf[i] = perceptual(lumaLinear(buf[o], buf[o + 1], buf[o + 2]));
            }

            const radius = Math.max(1, Math.round(Math.min(width, height) * K.LOCAL_RADIUS_FRAC));
            const taps = LOCAL_TAPS;
            const nTaps = taps.length;
            const invTaps = 1 / nTaps;
            const mix = K.LOCAL_MIX;

            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const i = y * width + x;
                    const o = i << 2;

                    // Moyenne du voisinage pondérée par la ressemblance en
                    // luminance : le masque épouse les contours au lieu de
                    // baver par-dessus.
                    const plC = plBuf[i];
                    let acc = 0, wsum = 0;
                    for (let t = 0; t < nTaps; t++) {
                        // Arrondi (et non troncature) : c'est le même décalage
                        // entier que celui calculé par le shader, sans quoi les
                        // deux moteurs échantillonnent des pixels différents et
                        // le masque diverge entre l'aperçu et l'export.
                        let sx = x + Math.round(taps[t][0] * radius);
                        let sy = y + Math.round(taps[t][1] * radius);
                        if (sx < 0) sx = 0; else if (sx >= width) sx = width - 1;
                        if (sy < 0) sy = 0; else if (sy >= height) sy = height - 1;
                        const v = plBuf[sy * width + sx];
                        const w = bilateralWeight(v - plC);
                        acc += v * w;
                        wsum += w;
                    }
                    const plLocal = plC * (1 - mix) + (acc / (wsum > 1e-6 ? wsum : 1)) * mix;

                    let r = buf[o], g = buf[o + 1], b = buf[o + 2];

                    if (toneLUTLocal) {
                        const gain = sampleZone(toneLUTLocal, plLocal);
                        r *= gain; g *= gain; b *= gain;
                    }
                    if (toneLUTPixel) {
                        const gain = sampleZone(toneLUTPixel, plC);
                        r *= gain; g *= gain; b *= gain;
                    }
                    if (hasSplit) {
                        r *= sampleZone(splitR, plLocal);
                        g *= sampleZone(splitG, plLocal);
                        b *= sampleZone(splitB, plLocal);
                    }

                    buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
                }
            }
        }

        // =================================================================
        // PASSE 2 — linéaire : correction du voile puis clarté.
        // Ces deux outils sont du contraste LOCAL : ils ont besoin du
        // voisinage et doivent agir avant le tone mapping, sur la vraie
        // dynamique de la scène.
        // =================================================================
        if (hasLocal) {
            applyLocalContrast(buf, width, height, uDehaze, uClarity);
        }

        // =================================================================
        // PASSE 3 — tone mapping, encodage sRGB, puis tous les outils
        //           display-referred, en flottant
        // =================================================================
        const c = { r: 0, g: 0, b: 0 };
        const hsl = { h: 0, s: 0, l: 0 };
        const bw = { i1: 0, i2: 0, w1: 0, w2: 0 };

        for (let i = 0, o = 0; i < n; i++, o += 4) {
            c.r = buf[o]; c.g = buf[o + 1]; c.b = buf[o + 2];

            // Scene-referred -> display-referred.
            toneMapRgb(c, W);

            // Encodage sRGB, sans quantification : on reste en flottant.
            let r = fastLinearToSrgb(c.r);
            let g = fastLinearToSrgb(c.g);
            let b = fastLinearToSrgb(c.b);

            // Le tone mapping a déjà ramené la scène dans 0..1 ; il ne reste
            // qu'à borner les erreurs d'arrondi avant les outils display.
            r = clamp01(r); g = clamp01(g); b = clamp01(b);

            if (hasContrast) {
                r = sampleZone01(contrastLUT, r);
                g = sampleZone01(contrastLUT, g);
                b = sampleZone01(contrastLUT, b);
            }

            if (hasCurves) {
                if (lutR) r = sampleLUT(lutR, r);
                if (lutG) g = sampleLUT(lutG, g);
                if (lutB) b = sampleLUT(lutB, b);
                if (lutM) { r = sampleLUT(lutM, r); g = sampleLUT(lutM, g); b = sampleLUT(lutM, b); }
            }

            if (needsHslStage) {
                rgbToHslF(r, g, b, hsl);

                if (hasHsl) {
                    hslBandWeights(hsl.h, bw);
                    if (hslHue) {
                        const d = hslHue[bw.i1] * bw.w1 + hslHue[bw.i2] * bw.w2;
                        if (d !== 0) hsl.h = (hsl.h + d + 360) % 360;
                    }
                    if (hslSat) {
                        const d = hslSat[bw.i1] * bw.w1 + hslSat[bw.i2] * bw.w2;
                        if (d !== 0) hsl.s = Math.max(0, hsl.s * Math.exp((d / 100) * 0.9));
                    }
                    if (hslLum) {
                        const d = hslLum[bw.i1] * bw.w1 + hslLum[bw.i2] * bw.w2;
                        if (d !== 0) hsl.l = clamp01(hsl.l + (d / 100) * 0.5 * (d > 0 ? (1 - hsl.l) : hsl.l) * 2);
                    }
                }

                if (hasSat) {
                    // Vibrance MULTIPLICATIVE : elle renforce d'autant plus une
                    // couleur qu'elle est peu saturée, mais reste sans effet sur
                    // un gris. Une forme additive teinterait les gris (la teinte
                    // d'un pixel neutre valant 0°, ils viraient au rouge).
                    let s = hsl.s * satM;
                    if (vibF !== 0) s *= 1 + (1 - clamp01(s)) * vibF * K.AMT_VIBRANCE;
                    hsl.s = s <= 0 ? 0 : softKnee01(s, K.SAT_SOFT_KNEE);
                }

                hslToRgbF(hsl.h, hsl.s, hsl.l, c);
                r = clamp01(c.r); g = clamp01(c.g); b = clamp01(c.b);
            }

            buf[o] = r; buf[o + 1] = g; buf[o + 2] = b;
        }

        // =================================================================
        // PASSE 4 — netteté (voisinage, sur la luminance)
        // =================================================================
        if ((p.sharpen || 0) > 0) {
            applySharpenF(buf, width, height, (p.sharpen || 0) / 100);
        }

        // =================================================================
        // PASSE 5 — vignettage, grain, puis quantification unique
        // =================================================================
        const hasVignette = (p.vignette || 0) !== 0;
        const vAmt = Math.tanh((p.vignette || 0) / 100);
        const hasGrain = (p.grain || 0) > 0;
        const grainAmt = (p.grain || 0) / 100;
        // Borné : au-delà de 150 le facteur (1,6 - gs) s'annulerait puis
        // deviendrait négatif, et la taille du grain partirait en vrille.
        const gs = clamp((p.grainSharpness != null ? p.grainSharpness : 50) / 100, 0, 1.4);
        // Le grain est indexé sur l'image pleine résolution : sa granulométrie
        // ne change pas entre l'aperçu réduit et l'export.
        const refW = opts.fullWidth || width;
        const refH = opts.fullHeight || height;
        const grainScale = K.GRAIN_BASE_SCALE * (1.6 - gs);
        const seed = opts.grainSeed || 1;

        const out = outputFloat ? buf : new Uint8ClampedArray(n * 4);
        const aspect = width / Math.max(1, height);

        for (let y = 0; y < height; y++) {
            const vy = (y + 0.5) / height - 0.5;
            for (let x = 0; x < width; x++) {
                const o = (y * width + x) * 4;
                let r = buf[o], g = buf[o + 1], b = buf[o + 2];

                if (hasVignette) {
                    const vx = ((x + 0.5) / width - 0.5) * aspect;
                    const dist = Math.sqrt(vx * vx + vy * vy) / Math.sqrt(0.25 * aspect * aspect + 0.25);
                    const fall = smoothstep(K.VIGNETTE_INNER, K.VIGNETTE_OUTER, dist);
                    const f = Math.max(0, 1 - vAmt * fall);
                    r *= f; g *= f; b *= f;
                }

                if (hasGrain) {
                    const gx = ((x + 0.5) / width) * refW / grainScale;
                    const gy = ((y + 0.5) / height) * refH / grainScale;
                    const nz = (hashNoise(gx | 0, gy | 0, seed) - 0.5) * grainAmt * (0.25 + 0.35 * gs);
                    // Le grain argentique est plus visible dans les tons moyens.
                    const wgt = 4 * r * (1 - clamp01(r)) + 0.25;
                    r += nz * wgt; g += nz * wgt; b += nz * wgt;
                }

                if (outputFloat) {
                    out[o] = clamp01(r); out[o + 1] = clamp01(g); out[o + 2] = clamp01(b);
                } else {
                    // Tramage ordonné 4x4 : répartit l'erreur de quantification
                    // et supprime le banding dans les dégradés (ciels notamment).
                    const d = (BAYER4[(y & 3) * 4 + (x & 3)] - 0.5) / 255;
                    out[o] = (clamp01(r + d) * 255 + 0.5) | 0;
                    out[o + 1] = (clamp01(g + d) * 255 + 0.5) | 0;
                    out[o + 2] = (clamp01(b + d) * 255 + 0.5) | 0;
                    out[o + 3] = (clamp01(buf[o + 3]) * 255 + 0.5) | 0;
                }
            }
        }

        return out;
    }

    /** Matrice de Bayer 4x4 normalisée 0..1, pour le tramage de sortie. */
    const BAYER4 = new Float32Array([
        0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5
    ].map((v) => v / 16));

    /**
     * Correction du voile puis clarté, en linéaire.
     * Les deux reposent sur un masque flou de la luminance : le voile est une
     * composante très basse fréquence, la clarté un contraste de moyenne
     * fréquence. Les rayons sont exprimés en fraction de l'image, donc
     * indépendants de la résolution de traitement.
     */
    function applyLocalContrast(buf, width, height, uDehaze, uClarity) {
        const n = width * height;
        const lum = new Float32Array(n);
        for (let i = 0, o = 0; i < n; i++, o += 4) {
            lum[i] = perceptual(Math.max(0, lumaLinear(buf[o], buf[o + 1], buf[o + 2])));
        }
        const blur = new Float32Array(n);
        const minDim = Math.min(width, height);

        if (uDehaze !== 0) {
            const rad = Math.max(1, Math.round(minDim * K.DEHAZE_RADIUS_FRAC));
            boxBlurChannel(lum, blur, width, height, rad);
            const amt = Math.tanh(uDehaze) * K.AMT_DEHAZE;
            for (let i = 0, o = 0; i < n; i++, o += 4) {
                // Le voile se lit comme une remontée du plancher local : on le
                // retranche, puis on redéploie le contraste sur la plage restante.
                const veil = blur[i] * amt;
                const l = lum[i];
                const lNew = Math.max(0, (l - veil) / Math.max(0.05, 1 - veil));
                const k = l > 1e-5 ? lNew / l : 1;
                if (k !== 1) {
                    // Retour en linéaire : le gain perceptuel devient un gain de luminance.
                    const gLin = Math.pow(k, 2.2);
                    buf[o] *= gLin; buf[o + 1] *= gLin; buf[o + 2] *= gLin;
                }
            }
            // La luminance a changé : on la recalcule pour la passe de clarté.
            if (uClarity !== 0) {
                for (let i = 0, o = 0; i < n; i++, o += 4) {
                    lum[i] = perceptual(Math.max(0, lumaLinear(buf[o], buf[o + 1], buf[o + 2])));
                }
            }
        }

        if (uClarity !== 0) {
            const rad = Math.max(1, Math.round(minDim * K.CLARITY_RADIUS_FRAC));
            boxBlurChannel(lum, blur, width, height, rad);
            const amt = Math.tanh(uClarity) * K.AMT_CLARITY;
            for (let i = 0, o = 0; i < n; i++, o += 4) {
                const l = lum[i];
                // Protection des extrêmes : pas de halo dans les noirs bouchés
                // ni dans les hautes lumières.
                const prot = 4 * l * (1 - clamp01(l));
                const lNew = Math.max(0, l + (l - blur[i]) * amt * prot);
                const k = l > 1e-5 ? lNew / l : 1;
                if (k !== 1) {
                    const gLin = Math.pow(k, 2.2);
                    buf[o] *= gLin; buf[o + 1] *= gLin; buf[o + 2] *= gLin;
                }
            }
        }
    }

    /**
     * Masque flou sur la luminance uniquement : accentue le détail sans créer
     * de franges colorées sur les contours (défaut du laplacien par canal).
     */
    function applySharpenF(buf, width, height, amount) {
        const n = width * height;
        const lum = new Float32Array(n);
        for (let i = 0, o = 0; i < n; i++, o += 4) {
            lum[i] = 0.299 * buf[o] + 0.587 * buf[o + 1] + 0.114 * buf[o + 2];
        }
        const k = amount * K.AMT_SHARPEN;
        for (let y = 0; y < height; y++) {
            const yUp = Math.max(0, y - 1) * width;
            const yDn = Math.min(height - 1, y + 1) * width;
            const yC = y * width;
            for (let x = 0; x < width; x++) {
                const xL = Math.max(0, x - 1);
                const xR = Math.min(width - 1, x + 1);
                const c0 = lum[yC + x];
                const avg = (lum[yUp + x] + lum[yDn + x] + lum[yC + xL] + lum[yC + xR]) * 0.25;
                const d = (c0 - avg) * k;
                if (d !== 0) {
                    const o = (yC + x) * 4;
                    buf[o] = clamp01(buf[o] + d);
                    buf[o + 1] = clamp01(buf[o + 1] + d);
                    buf[o + 2] = clamp01(buf[o + 2] + d);
                }
            }
        }
    }

    /**
     * Blanc linéaire d'une source flottante : sert à caler le tone mapping.
     * On prend un percentile haut plutôt que le maximum absolu, pour qu'un
     * pixel chaud isolé (poussière, spéculaire) n'assombrisse pas toute l'image.
     */
    const _whiteCache = new WeakMap();

    /**
     * Blanc de scène d'un buffer flottant, mémorisé : la mesure échantillonne
     * l'image entière, il ne faut pas la refaire à chaque mouvement de curseur.
     * Renvoie 1.0 pour toute source non flottante (8 bits déjà normalisé).
     */
    function sourceWhiteFor(floatData) {
        if (!(floatData instanceof Float32Array)) return 1.0;
        let v = _whiteCache.get(floatData);
        if (v === undefined) {
            v = measureSourceWhite(floatData);
            _whiteCache.set(floatData, v);
        }
        return v;
    }

    function measureSourceWhite(floatData) {
        const len = floatData.length;
        const step = Math.max(4, (((len / 4) / 200000) | 0) * 4);
        const samples = [];
        for (let o = 0; o < len; o += step) {
            samples.push(Math.max(floatData[o], Math.max(floatData[o + 1], floatData[o + 2])));
        }
        if (samples.length === 0) return 1;
        samples.sort((a, b) => a - b);
        // Percentile 99,99 : assez haut pour englober les vraies hautes
        // lumières (spéculaires, ciel), assez bas pour ignorer un photosite
        // aberrant isolé.
        //
        // Le percentile 99,9 employé auparavant laissait au-dessus de lui une
        // part importante de la dynamique — mesuré sur un fichier réel : un
        // maximum à 1,98 pour un blanc retenu à 0,75, soit 1,4 diaphragme
        // purement et simplement écrasé à 255. Ce choix se justifiait avec la
        // courbe de Reinhard, où un point blanc élevé assombrissait toute
        // l'image ; avec l'épaulement il ne coûte que 4 niveaux sur le blanc
        // diffus, et rend ces hautes lumières récupérables.
        const idx = Math.min(samples.length - 1, Math.floor(samples.length * 0.9999));
        return Math.max(0.05, samples[idx]);
    }

    // ------------------------------------------------------------------
    // Constantes exposées au shader GLSL (source unique de vérité)
    // ------------------------------------------------------------------

    function glslConstants() {
        const f = (v) => {
            const s = String(v);
            return s.indexOf('.') >= 0 || s.indexOf('e') >= 0 ? s : s + '.0';
        };
        let out = '';
        for (const key in K) out += 'const float PP_' + key + ' = ' + f(K[key]) + ';\n';
        return out;
    }

    const API = {
        VERSION: VERSION,
        K: K,
        CURVE_LUT_SIZE: CURVE_LUT_SIZE,
        clamp: clamp,
        clamp01: clamp01,
        srgbToLinear: srgbToLinear,
        linearToSrgb: linearToSrgb,
        fastLinearToSrgb: fastLinearToSrgb,
        SRGB_TO_LIN_8: SRGB_TO_LIN_8,
        lumaLinear: lumaLinear,
        perceptual: perceptual,
        smoothstep: smoothstep,
        rgbToHslF: rgbToHslF,
        hslToRgbF: hslToRgbF,
        hslBandWeights: hslBandWeights,
        whiteBalanceGains: whiteBalanceGains,
        planckianXY: planckianXY,
        sceneWhite: sceneWhite,
        reconstructClipped: reconstructClipped,
        shoulderStart: shoulderStart,
        toneMapScalar: toneMapScalar,
        toneMapRgb: toneMapRgb,
        buildCurveLUT: buildCurveLUT,
        sampleLUT: sampleLUT,
        curveIsActive: curveIsActive,
        hashNoise: hashNoise,
        boxBlurChannel: boxBlurChannel,
        LOCAL_TAPS: LOCAL_TAPS,
        bilateralWeight: bilateralWeight,
        softKnee01: softKnee01,
        contrastS: contrastS,
        toneGain: toneGain,
        process: process,
        measureSourceWhite: measureSourceWhite,
        sourceWhiteFor: sourceWhiteFor,
        glslConstants: glslConstants
    };

    global.IlluPhotoPipeline = API;
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof self !== 'undefined' ? self : this);
