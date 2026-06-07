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
uniform float exposure;
uniform float contrast;
uniform float temp;
uniform float tint;
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
uniform float grain;
uniform float grainSharpness;
uniform float sharpen;
uniform vec2 u_res;
uniform bool isRawMode;

// Standard sRGB <-> Linear conversions
float sToL(float c) {
    return (c <= 0.04045) ? (c / 12.92) : pow((c + 0.055) / 1.055, 2.4);
}
float lToS(float c) {
    return (c <= 0.0031308) ? (12.92 * c) : (1.055 * pow(c, 1.0 / 2.4) - 0.055);
}

float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

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

// Reinhard Extended Tone Mapping Operator (Matches WASM/CPU)
vec3 Reinhard(vec3 rgb) {
    float maxC = max(rgb.r, max(rgb.g, rgb.b));
    if (maxC > 0.0) {
        float Lw2 = 16.0; // 4.0 * 4.0
        float mappedMax = maxC * (1.0 + maxC / Lw2) / (1.0 + maxC);
        return rgb * (mappedMax / maxC);
    }
    return rgb;
}

void main() {
    vec4 color = texture2D(u_tex, v_uv);
    vec3 rgb = color.rgb;
    
    // 1. GESTION DE L'ESPACE COLORIMÉTRIQUE INITIAL
    // Si c'est un RAW (14-bit), la texture DOIT déjà être linéaire. On ne la décode pas.
    if (!isRawMode) {
        rgb = vec3(sToL(rgb.r), sToL(rgb.g), sToL(rgb.b));
    }
    
    // 2. EXPOSITION (En F-Stops)
    // -100 à 100 = -2 à +2 stops
    float expFactor = 2.0; 
    rgb *= pow(2.0, (exposure / 100.0) * expFactor);
    
    // 3. BALANCE DES BLANCS (Temp / Tint)
    float t = temp / 100.0;
    rgb.r *= (1.0 + t * 0.12);
    rgb.b *= (1.0 - t * 0.12);
    rgb.g *= (1.0 + t * 0.02);
    float tn = tint / 100.0;
    rgb.r *= (1.0 + tn * 0.06);
    rgb.b *= (1.0 + tn * 0.06);
    rgb.g *= (1.0 - tn * 0.08);

    // 4. COURBES TONALES (Shadows, Highlights, Whites, Blacks)
    float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    if (lum > 0.0001) {
        // Conversion de la luminance en pseudo-perceptuel pour générer des masques de zones fluides
        // Cela évite que les mathématiques linéaires n'écrasent tout dans les tons sombres
        float pLum = pow(lum, 1.0 / 2.2); 
        
        // Création de masques avec lissage (smoothstep) pour éviter les cassures
        float shadowMask = smoothstep(0.5, 0.0, pLum);     // Agit dans les ombres
        float highlightMask = smoothstep(0.5, 1.0, pLum);  // Agit dans les lumières
        float whiteMask = smoothstep(0.8, 1.2, pLum);      // Agit sur l'extrême clair (HDR)
        float blackMask = smoothstep(0.2, 0.0, pLum);      // Agit sur l'extrême noir
        
        float lumNew = lum;
        
        // Intensités des sliders
        float sFac = shadows / 100.0;
        float bFac = blacks / 100.0;
        float hFac = highlights / 100.0;
        float wFac = whites / 100.0;

        // Application Multiplicative (Protège les contrastes internes)
        // Ombres et Noirs
        lumNew *= 1.0 + (sFac * shadowMask * 1.5);
        lumNew *= 1.0 + (bFac * blackMask * 2.0);
        
        // Hautes lumières et Blancs (Si négatif = récupération, Si positif = boost)
        if (hFac < 0.0) lumNew *= 1.0 + (hFac * highlightMask * 0.85);
        else lumNew *= 1.0 + (hFac * highlightMask * 1.5);

        if (wFac < 0.0) lumNew *= 1.0 + (wFac * whiteMask * 0.85);
        else lumNew *= 1.0 + (wFac * whiteMask * 2.0);

        lumNew = max(0.0001, lumNew);
        rgb *= (lumNew / lum); // Applique le changement de luminance aux canaux RGB
        lum = lumNew;
    }
    
    // 5. AJUSTEMENTS PAR CANAL (Split Toning / Grading)
    float wHi = max(0.0, min(lum, 1.0) - 0.5) / 0.5;
    float wSh = max(0.0, 0.5 - min(lum, 1.0)) / 0.5;
    rgb.r *= (1.0 + red / 100.0) * (1.0 + (redHi / 100.0) * wHi * 1.5) * (1.0 + (redSh / 100.0) * wSh * 1.5);
    rgb.g *= (1.0 + green / 100.0) * (1.0 + (greenHi / 100.0) * wHi * 1.5) * (1.0 + (greenSh / 100.0) * wSh * 1.5);
    rgb.b *= (1.0 + blue / 100.0) * (1.0 + (blueHi / 100.0) * wHi * 1.5) * (1.0 + (blueSh / 100.0) * wSh * 1.5);

    // 6. NETTETÉ (Sharpening Laplacian)
    if (sharpen > 0.0 && u_res.x > 0.0) {
        float k = sharpen / 150.0;
        float center = 1.0 + 4.0 * k;
        float neighbor = -k;
        vec2 off = 1.0 / u_res;
        
        // Évite la re-conversion sToL coûteuse, on travaille directement en linéaire pour le RAW
        vec3 up = texture2D(u_tex, v_uv + vec2(0, -off.y)).rgb;
        vec3 dn = texture2D(u_tex, v_uv + vec2(0, off.y)).rgb;
        vec3 lf = texture2D(u_tex, v_uv + vec2(-off.x, 0)).rgb;
        vec3 rt = texture2D(u_tex, v_uv + vec2(off.x, 0)).rgb;
        
        if(!isRawMode) {
            up = vec3(sToL(up.r), sToL(up.g), sToL(up.b));
            dn = vec3(sToL(dn.r), sToL(dn.g), sToL(dn.b));
            lf = vec3(sToL(lf.r), sToL(lf.g), sToL(lf.b));
            rt = vec3(sToL(rt.r), sToL(rt.g), sToL(rt.b));
        }

        rgb = rgb * center + (up + dn + lf + rt) * neighbor;
        rgb = max(vec3(0.0), rgb);
    }

    // 7. GRAIN
    if (grain > 0.0) {
        float gs = grainSharpness / 100.0;
        float noise = (rand(v_uv) - 0.5) * (grain / 100.0) * (0.2 + 0.4 * gs);
        rgb += noise;
    }

    // 8. TONE MAPPING (VITAL POUR LE RAW)
    // Compresse doucement les valeurs HDR (> 1.0) vers l'espace écran (0.0 - 1.0)
    if (isRawMode) {
        rgb = Reinhard(rgb);
    } else {
        rgb = clamp(rgb, 0.0, 1.0);
    }

    // 9. RETOUR EN sRGB, CONTRASTE & SATURATION
    rgb = vec3(lToS(rgb.r), lToS(rgb.g), lToS(rgb.b));
    
    // Contraste post-ToneMapping (en courbe S)
    float contrastF = (100.0 + contrast) / 100.0;
    rgb = clamp((rgb - 0.5) * contrastF + 0.5, 0.0, 1.0);
    
    // Saturation / Vibrance
    if (saturation != 0.0 || vibrance != 0.0) {
        vec3 hsv = rgb2hsv(rgb);
        hsv.y = clamp(hsv.y * (1.0 + saturation / 100.0), 0.0, 1.0);
        if (vibrance != 0.0) {
            hsv.y = clamp(hsv.y + (1.0 - hsv.y) * (vibrance / 100.0) * 0.4, 0.0, 1.0);
        }
        rgb = hsv2rgb(hsv);
    }
    
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
    `
};