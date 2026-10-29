/**
 * FilterShaders.js — Bibliothèque des Shaders GLSL pour MasterPaint 98.
 * Optimisé pour le traitement HDR / RAW 14-bit.
 */
window.FilterShaders = {
    VS: `
attribute vec2 a_pos;
attribute vec2 a_uv;
varying vec2 v_uv;
void main() {
    gl_Position = vec4(a_pos, 0.0, 1.0);
    v_uv = a_uv;
}`,

    header: `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
`,

    grayscale: `
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    float avg = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(vec3(avg), c.a);
}`,

    invert: `
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    gl_FragColor = vec4(1.0 - c.rgb, c.a);
}`,

    sepia: `
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 sepia = vec3(
        dot(c.rgb, vec3(0.393, 0.769, 0.189)),
        dot(c.rgb, vec3(0.349, 0.686, 0.168)),
        dot(c.rgb, vec3(0.272, 0.534, 0.131))
    );
    gl_FragColor = vec4(sepia, c.a);
}`,

    brightness_contrast: `
uniform float u_brightness;
uniform float u_contrast;
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 rgb = c.rgb;
    rgb += u_brightness;
    float factor = (259.0 * (u_contrast * 255.0 + 255.0)) / (255.0 * (259.0 - u_contrast * 255.0));
    rgb = factor * (rgb - 0.5) + 0.5;
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`,

    exposure: `
uniform float u_exposure;
uniform float u_gamma;
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 rgb = c.rgb * u_exposure;
    rgb = pow(rgb, vec3(1.0 / u_gamma));
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`,

    hsv: `
uniform float u_hue;
uniform float u_sat;
uniform float u_val;

vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 hsv = rgb2hsv(c.rgb);
    hsv.x = fract(hsv.x + u_hue / 360.0);
    hsv.y = clamp(hsv.y + u_sat / 100.0, 0.0, 1.0);
    hsv.z = clamp(hsv.z + u_val / 100.0, 0.0, 1.0);
    gl_FragColor = vec4(hsv2rgb(hsv), c.a);
}`,

    camera_raw: `
// -------------------------------------------------------------------------
// Camera Raw — moteur GPU.
//
// Applique EXACTEMENT le même pipeline que js/effects/photo-pipeline.js, qui
// en est la définition de référence. Les grandeurs qui demandent de la
// colorimétrie (gains de balance des blancs, point blanc du tone mapping)
// sont calculées côté CPU par ce module et transmises en uniformes : c'est ce
// qui garantit que l'aperçu GPU et l'export CPU donnent la même image.
//
// Tout est traité en flottant. La texture source d'un RAW est un RGBA32F
// linéaire : la dynamique 14 bits reste disponible jusqu'aux outils couleur
// (température, teinte, saturation, vibrance), qui étaient auparavant appliqués
// après un écrêtage 8 bits.
//
// Non pris en charge ici (repli CPU automatique) : courbes, TSL sélectif,
// clarté et correction du voile — ils demandent des LUT haute précision ou des
// passes de voisinage.
// -------------------------------------------------------------------------

uniform vec3 wbExpGain;      // balance des blancs * exposition, en linéaire
uniform float toneWhite;     // point blanc de la scène pour le tone mapping
uniform float sceneCeiling;  // plafond de saturation du capteur, en linéaire
// Masque local actif pour (ombres, noirs, hautes lumières, blancs) : 1 = oui.
uniform vec4 maskFlags;
uniform float contrast;
uniform float highlights;
uniform float shadows;
uniform float whites;
uniform float blacks;
uniform float vibrance;
uniform float saturation;
uniform float red;
uniform float redHi;
uniform float redSh;
uniform float green;
uniform float greenHi;
uniform float greenSh;
uniform float blue;
uniform float blueHi;
uniform float blueSh;
uniform float vignette;
uniform float grain;
uniform float grainSharpness;
uniform float sharpen;
uniform vec2 u_res;
uniform vec2 u_fullRes;
uniform bool isRawMode;

const float PP_MASK_SHADOW_HI = 0.55;
const float PP_MASK_BLACK_HI = 0.25;
const float PP_MASK_HIGHLIGHT_LO = 0.45;
const float PP_MASK_WHITE_LO = 0.70;
const float PP_AMT_SHADOWS = 2.20;
const float PP_AMT_BLACKS = 2.00;
const float PP_AMT_HIGHLIGHTS = 2.40;
const float PP_AMT_WHITES = 1.80;
const float PP_SPLIT_PIVOT = 0.45;
const float PP_AMT_SPLIT_ZONE = 1.5;
const float PP_LOCAL_RADIUS_FRAC = 0.045;
const float PP_LOCAL_MIX = 0.72;
const float PP_LOCAL_SIGMA = 0.22;
const float PP_CLIP_FIX_START = 0.90;
const float PP_TONE_SHOULDER_START = 0.65;
const float PP_TONE_DESAT_START = 0.72;
const float PP_TONE_DESAT_AMOUNT = 0.55;
const float PP_CONTRAST_PIVOT = 0.5;
const float PP_SAT_SOFT_KNEE = 0.85;
const float PP_AMT_VIBRANCE = 0.60;
const float PP_AMT_SHARPEN = 1.20;
const float PP_VIGNETTE_INNER = 0.35;
const float PP_VIGNETTE_OUTER = 1.05;
const float PP_GRAIN_BASE_SCALE = 1.35;
const vec3 PP_LUMA = vec3(0.2126, 0.7152, 0.0722);

// GLSL ES 1.0 n'a ni tanh ni atanh.
float ppTanh(float x) {
    float e = exp(2.0 * clamp(x, -15.0, 15.0));
    return (e - 1.0) / (e + 1.0);
}
float ppAtanh(float x) {
    x = clamp(x, -0.9999999, 0.9999999);
    return 0.5 * log((1.0 + x) / (1.0 - x));
}

float sToL(float c) {
    if (c <= 0.0) return 0.0;
    return (c <= 0.04045) ? (c / 12.92) : pow((c + 0.055) / 1.055, 2.4);
}
// Encodage sRGB prolongé au-delà de 1.0 : aucun écrêtage avant le tone mapping.
float lToS(float c) {
    if (c <= 0.0) return 0.0;
    if (c <= 0.0031308) return 12.92 * c;
    if (c <= 1.0) return 1.055 * pow(c, 1.0 / 2.4) - 0.055;
    return 1.0 + (c - 1.0) * (1.055 / 2.4);
}

float perceptual(float y) { return y <= 0.0 ? 0.0 : pow(y, 1.0 / 2.2); }

// Rend leur neutralité aux zones brûlées : quand un photosite sature, son
// canal se fige tandis que les autres montent encore, et le blanc ressort
// teinté — typiquement en rose.
vec3 reconstructClipped(vec3 c, float ceiling) {
    float mx = max(c.r, max(c.g, c.b));
    float start = ceiling * PP_CLIP_FIX_START;
    if (mx <= start) return c;
    float t = clamp((mx - start) / max(1e-6, ceiling - start), 0.0, 1.0);
    return mix(c, vec3(mx), t);
}

// Gain tonal borné, strictement positif : jamais d'inversion de canal, même
// avec les plages de curseurs très larges du mode RAW.
float toneGain(float u, float amt) {
    return exp(amt * ppTanh(u));
}

float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 1.0 / 6.0) return p + (q - p) * 6.0 * t;
    if (t < 1.0 / 2.0) return q;
    if (t < 2.0 / 3.0) return p + (q - p) * (2.0 / 3.0 - t) * 6.0;
    return p;
}

// TSL flottant — même espace que le moteur CPU (l'ancien shader utilisait TSV,
// ce qui donnait une saturation différente de celle de l'export).
vec3 rgb2hsl(vec3 c) {
    float mx = max(c.r, max(c.g, c.b));
    float mn = min(c.r, min(c.g, c.b));
    float l = (mx + mn) * 0.5;
    float d = mx - mn;
    float h = 0.0;
    float s = 0.0;
    if (d > 1e-9) {
        s = (l > 0.5) ? d / max(1e-9, 2.0 - mx - mn) : d / max(1e-9, mx + mn);
        if (mx == c.r) h = (c.g - c.b) / d + (c.g < c.b ? 6.0 : 0.0);
        else if (mx == c.g) h = (c.b - c.r) / d + 2.0;
        else h = (c.r - c.g) / d + 4.0;
        h *= 60.0;
    }
    return vec3(h, s, l);
}

vec3 hsl2rgb(vec3 hsl) {
    if (hsl.y <= 1e-9) return vec3(hsl.z);
    float q = hsl.z < 0.5 ? hsl.z * (1.0 + hsl.y) : hsl.z + hsl.y - hsl.z * hsl.y;
    float p = 2.0 * hsl.z - q;
    float hn = fract(hsl.x / 360.0);
    return vec3(hue2rgb(p, q, hn + 1.0 / 3.0), hue2rgb(p, q, hn), hue2rgb(p, q, hn - 1.0 / 3.0));
}

// Reinhard étendu calé sur le blanc réel : quand toneWhite vaut 1, c'est
// l'identité — une image qui ne déborde pas n'est jamais assombrie.
// Épaulement : identité sous le seuil, compression au-dessus. Le Reinhard
// employé auparavant tassait la plage entière vers le gris (voir
// toneMapScalar dans js/effects/photo-pipeline.js).
float shoulder(float x, float W) {
    // Seuil adapté à la dynamique à comprimer (voir shoulderStart dans
    // js/effects/photo-pipeline.js).
    float T = clamp(0.75 - 0.08 * (log2(max(1.0, W))), 0.45, 0.70);
    if (x <= T) return x;
    if (W <= T) return x;
    float k = 1.0 / (1.0 - T);
    float denom = 1.0 - exp(-k * (W - T));
    if (denom <= 1e-6) return x;
    return T + (1.0 - T) * (1.0 - exp(-k * (x - T))) / denom;
}

vec3 toneMap(vec3 rgb, float W) {
    float mx = max(rgb.r, max(rgb.g, rgb.b));
    if (mx <= 0.0) return vec3(0.0);
    // Sans compression à faire (W = 1), identité stricte.
    if (W <= 1.0000001) return rgb;

    float mapped = shoulder(mx, W);
    rgb *= mapped / mx;

    // Désaturation progressive des très hautes lumières : un ciel surexposé
    // tend vers le blanc au lieu de virer vers une couleur saturée.
    float m = max(rgb.r, max(rgb.g, rgb.b));
    if (m > PP_TONE_DESAT_START) {
        float t = smoothstep(PP_TONE_DESAT_START, 1.0, m) * PP_TONE_DESAT_AMOUNT;
        rgb = mix(rgb, vec3(dot(rgb, PP_LUMA)), t);
    }
    return rgb;
}

// Contraste en courbe S normalisée : mappe [0,1] sur [0,1] par construction,
// donc ni écrêtage ni aplat dans les hautes lumières.
float contrastS(float x, float f) {
    if (f == 1.0) return x;
    if (f < 1.0) return PP_CONTRAST_PIVOT + (x - PP_CONTRAST_PIVOT) * f;
    return 0.5 + 0.5 * ppTanh(f * ppAtanh(2.0 * x - 1.0));
}

float softKnee01(float x, float knee) {
    if (x <= knee) return max(0.0, x);
    return 1.0 - (1.0 - knee) * exp(-(x - knee) / (1.0 - knee));
}

// Bruit déterministe : même grain dans l'aperçu et dans le fichier exporté.
float hashNoise(vec2 p) {
    return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5453123);
}

// Décodage, reconstruction des hautes lumières, balance des blancs et
// exposition — la partie du traitement qui ne dépend que du pixel lui-même.
vec3 baseLinear(vec3 rgb) {
    if (!isRawMode) rgb = vec3(sToL(rgb.r), sToL(rgb.g), sToL(rgb.b));
    rgb = max(rgb, 0.0);
    rgb = reconstructClipped(rgb, sceneCeiling);
    return rgb * wbExpGain;
}

// Luminance perceptuelle d'un voisin, après les mêmes étapes de base.
float basePerc(vec2 uv) {
    return perceptual(dot(baseLinear(texture2D(u_tex, uv).rgb), PP_LUMA));
}

/**
 * Masque tonal LOCAL.
 *
 * La luminance qui pilote les masques est moyennée sur le voisinage — treize
 * points : le centre et deux anneaux de six — au lieu d'être lue sur le seul
 * pixel. Le gain devient alors quasi constant à l'échelle du détail : une
 * ombre éclaircie ou une haute lumière rattrapée se déplace en bloc, en
 * gardant son micro-contraste, là où un masque par pixel comprime la zone sur
 * elle-même et efface le modelé.
 *
 * Les points d'échantillonnage sont exactement ceux de LOCAL_TAPS dans
 * js/effects/photo-pipeline.js : les deux moteurs rendent la même image.
 */
float localPerc(vec2 uv, float plCenter) {
    if (u_res.x < 1.0) return plCenter;
    // Rayon arrondi au pixel, exactement comme le moteur CPU : les deux
    // doivent échantillonner les mêmes pixels, sinon le masque diffère entre
    // l'aperçu et le fichier exporté.
    float rad = floor(PP_LOCAL_RADIUS_FRAC * min(u_res.x, u_res.y) + 0.5);

    // Pondération bilatérale : un voisin ne compte qu'à proportion de sa
    // ressemblance en luminance. Sans elle, le masque franchit les contours
    // et laisse un halo le long des silhouettes.
    float acc = plCenter;
    float wsum = 1.0;
    vec2 offs[12];
    offs[0]  = vec2( 1.0,   0.0  ) * 0.5;
    offs[1]  = vec2( 0.5,   0.866) * 0.5;
    offs[2]  = vec2(-0.5,   0.866) * 0.5;
    offs[3]  = vec2(-1.0,   0.0  ) * 0.5;
    offs[4]  = vec2(-0.5,  -0.866) * 0.5;
    offs[5]  = vec2( 0.5,  -0.866) * 0.5;
    offs[6]  = vec2( 0.866,  0.5);
    offs[7]  = vec2( 0.0,    1.0);
    offs[8]  = vec2(-0.866,  0.5);
    offs[9]  = vec2(-0.866, -0.5);
    offs[10] = vec2( 0.0,   -1.0);
    offs[11] = vec2( 0.866, -0.5);

    for (int i = 0; i < 12; i++) {
        vec2 dpx = floor(offs[i] * rad + 0.5);
        float v = basePerc(uv + dpx / u_res);
        float d = v - plCenter;
        float w = exp(-(d * d) / (2.0 * PP_LOCAL_SIGMA * PP_LOCAL_SIGMA));
        acc += v * w;
        wsum += w;
    }

    return mix(plCenter, acc / max(1e-6, wsum), PP_LOCAL_MIX);
}

// Étapes linéaires complètes, factorisées pour être réutilisées par la netteté.
vec3 linearStages(vec3 rgb, vec2 uv) {
    rgb = baseLinear(rgb);

    bool hasTone = (shadows != 0.0 || blacks != 0.0 || highlights != 0.0 || whites != 0.0);
    bool hasSplit = (red != 0.0 || redHi != 0.0 || redSh != 0.0 || green != 0.0 ||
                     greenHi != 0.0 || greenSh != 0.0 || blue != 0.0 || blueHi != 0.0 || blueSh != 0.0);
    if (!hasTone && !hasSplit) return rgb;

    float plPix = perceptual(dot(rgb, PP_LUMA));
    float pl = localPerc(uv, plPix);

    if (hasTone) {
        // Chaque étape lit soit le masque local, soit la luminance du seul
        // pixel, selon la case cochée dans le panneau.
        float plSh = mix(plPix, pl, maskFlags.x);
        float plBl = mix(plPix, pl, maskFlags.y);
        float plHi = mix(plPix, pl, maskFlags.z);
        float plWh = mix(plPix, pl, maskFlags.w);
        float g = 1.0;
        if (shadows != 0.0) g *= toneGain((shadows / 100.0) * smoothstep(PP_MASK_SHADOW_HI, 0.0, plSh), PP_AMT_SHADOWS);
        if (blacks != 0.0) g *= toneGain((blacks / 100.0) * smoothstep(PP_MASK_BLACK_HI, 0.0, plBl), PP_AMT_BLACKS);
        if (highlights != 0.0) g *= toneGain((highlights / 100.0) * smoothstep(PP_MASK_HIGHLIGHT_LO, 1.0, plHi), PP_AMT_HIGHLIGHTS);
        if (whites != 0.0) g *= toneGain((whites / 100.0) * smoothstep(PP_MASK_WHITE_LO, 1.15, plWh), PP_AMT_WHITES);
        rgb *= g;
    }

    if (hasSplit) {
        float wHi = smoothstep(PP_SPLIT_PIVOT, 1.0, pl);
        float wSh = smoothstep(PP_SPLIT_PIVOT, 0.0, pl);
        rgb.r *= toneGain(red / 100.0, 1.0) * toneGain((redHi / 100.0) * wHi, PP_AMT_SPLIT_ZONE) * toneGain((redSh / 100.0) * wSh, PP_AMT_SPLIT_ZONE);
        rgb.g *= toneGain(green / 100.0, 1.0) * toneGain((greenHi / 100.0) * wHi, PP_AMT_SPLIT_ZONE) * toneGain((greenSh / 100.0) * wSh, PP_AMT_SPLIT_ZONE);
        rgb.b *= toneGain(blue / 100.0, 1.0) * toneGain((blueHi / 100.0) * wHi, PP_AMT_SPLIT_ZONE) * toneGain((blueSh / 100.0) * wSh, PP_AMT_SPLIT_ZONE);
    }
    return rgb;
}

// Passage en display-referred : tone mapping puis encodage sRGB.
vec3 toDisplay(vec3 rgb) {
    rgb = toneMap(rgb, toneWhite);
    return clamp(vec3(lToS(rgb.r), lToS(rgb.g), lToS(rgb.b)), 0.0, 1.0);
}

void main() {
    vec4 color = texture2D(u_tex, v_uv);
    vec3 rgb = toDisplay(linearStages(color.rgb, v_uv));

    // Contraste
    if (contrast != 0.0) {
        float cf = exp((contrast / 100.0) * 0.9);
        rgb = vec3(contrastS(rgb.r, cf), contrastS(rgb.g, cf), contrastS(rgb.b, cf));
    }

    // Saturation et vibrance, en TSL flottant
    if (saturation != 0.0 || vibrance != 0.0) {
        vec3 hsl = rgb2hsl(rgb);
        // Vibrance multiplicative : sans effet sur un gris (voir photo-pipeline.js).
        float s = hsl.y * exp((saturation / 100.0) * 0.9);
        if (vibrance != 0.0) s *= 1.0 + (1.0 - clamp(s, 0.0, 1.0)) * ppTanh(vibrance / 100.0) * PP_AMT_VIBRANCE;
        hsl.y = s <= 0.0 ? 0.0 : softKnee01(s, PP_SAT_SOFT_KNEE);
        rgb = clamp(hsl2rgb(hsl), 0.0, 1.0);
    }

    // Netteté : masque flou sur la luminance, pour ne pas créer de franges
    // colorées sur les contours.
    if (sharpen > 0.0 && u_res.x > 0.0) {
        vec2 off = 1.0 / u_res;
        float c0 = dot(rgb, vec3(0.299, 0.587, 0.114));
        float up = dot(toDisplay(linearStages(texture2D(u_tex, v_uv + vec2(0.0, -off.y)).rgb, v_uv + vec2(0.0, -off.y))), vec3(0.299, 0.587, 0.114));
        float dn = dot(toDisplay(linearStages(texture2D(u_tex, v_uv + vec2(0.0, off.y)).rgb, v_uv + vec2(0.0, off.y))), vec3(0.299, 0.587, 0.114));
        float lf = dot(toDisplay(linearStages(texture2D(u_tex, v_uv + vec2(-off.x, 0.0)).rgb, v_uv + vec2(-off.x, 0.0))), vec3(0.299, 0.587, 0.114));
        float rt = dot(toDisplay(linearStages(texture2D(u_tex, v_uv + vec2(off.x, 0.0)).rgb, v_uv + vec2(off.x, 0.0))), vec3(0.299, 0.587, 0.114));
        rgb = clamp(rgb + ((c0 - (up + dn + lf + rt) * 0.25) * (sharpen / 100.0) * PP_AMT_SHARPEN), 0.0, 1.0);
    }

    // Vignettage
    if (vignette != 0.0) {
        float aspect = u_res.x / max(1.0, u_res.y);
        vec2 d = vec2((v_uv.x - 0.5) * aspect, v_uv.y - 0.5);
        float dist = length(d) / sqrt(0.25 * aspect * aspect + 0.25);
        float f = max(0.0, 1.0 - ppTanh(vignette / 100.0) * smoothstep(PP_VIGNETTE_INNER, PP_VIGNETTE_OUTER, dist));
        rgb *= f;
    }

    // Grain, indexé sur la pleine résolution : sa granulométrie ne change pas
    // entre l'aperçu réduit et l'export.
    if (grain > 0.0) {
        float gs = clamp(grainSharpness / 100.0, 0.0, 1.4);
        vec2 ref = (u_fullRes.x > 0.0) ? u_fullRes : u_res;
        float scale = PP_GRAIN_BASE_SCALE * (1.6 - gs);
        float nz = (hashNoise(v_uv * ref / scale) - 0.5) * (grain / 100.0) * (0.25 + 0.35 * gs);
        float wgt = 4.0 * rgb.r * (1.0 - clamp(rgb.r, 0.0, 1.0)) + 0.25;
        rgb += nz * wgt;
    }

    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
    `
};
