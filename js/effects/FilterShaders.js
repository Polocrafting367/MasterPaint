/**
 * FilterShaders.js — Bibliothèque des Shaders GLSL pour MasterPaint 98.
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

    // Effets de couleur simples
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
uniform float u_brightness; // -1.0 to 1.0
uniform float u_contrast;   // -1.0 to 1.0
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 rgb = c.rgb;
    // Brightness
    rgb += u_brightness;
    // Contrast
    float factor = (259.0 * (u_contrast * 255.0 + 255.0)) / (255.0 * (259.0 - u_contrast * 255.0));
    rgb = factor * (rgb - 0.5) + 0.5;
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`,

    exposure: `
uniform float u_exposure; // 0.0 to 2.0+
uniform float u_gamma;    // 0.1 to 3.0
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 rgb = c.rgb * u_exposure;
    rgb = pow(rgb, vec3(1.0 / u_gamma));
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`,

    hsv: `
uniform float u_hue; // -180.0 to 180.0
uniform float u_sat; // -100.0 to 100.0
uniform float u_val; // -100.0 to 100.0

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

    // Effets géométriques
    wave: `
uniform float u_amp;
uniform float u_freq;
void main() {
    vec2 uv = v_uv;
    uv.x += u_amp * sin(uv.y * u_freq);
    uv.y += u_amp * cos(uv.x * u_freq);
    gl_FragColor = texture2D(u_tex, uv);
}`,

    bulge_pinch: `
uniform float u_k; // >0 bulge, <0 pinch
void main() {
    vec2 uv = v_uv - 0.5;
    float r = length(uv);
    if (r < 0.5) {
        // Reverse mapping: a sample from closer to center (f < 1) creates magnification (Bulge)
        float f = 1.0 / (1.0 + u_k * (1.0 - pow(r * 2.0, 2.0)));
        uv *= f;
    }
    gl_FragColor = texture2D(u_tex, uv + 0.5);
}`,

    twist: `
uniform float u_rad;
void main() {
    vec2 uv = v_uv - 0.5;
    float r = length(uv);
    if (r < 0.5) {
        float angle = atan(uv.y, uv.x) + u_rad * (1.0 - r * 2.0);
        uv = vec2(cos(angle), sin(angle)) * r;
    }
    gl_FragColor = texture2D(u_tex, uv + 0.5);
}`,

    temperature: `
uniform float u_temp; // -1.0 (cool) to 1.0 (warm)
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 rgb = c.rgb;
    rgb.r += u_temp * 0.1;
    rgb.b -= u_temp * 0.1;
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), c.a);
}`,

    vignette: `
uniform float u_intensity; // 0.0 to 1.0
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    float dist = distance(v_uv, vec2(0.5));
    float mask = smoothstep(0.8, 0.2, dist * u_intensity * 2.0);
    gl_FragColor = vec4(c.rgb * mask, c.a);
}`,

    pixelate: `
uniform vec2 u_res;
uniform float u_size;
void main() {
    vec2 p = floor(v_uv * u_res / u_size) * u_size / u_res;
    gl_FragColor = texture2D(u_tex, p);
}`,

    posterize: `
uniform float u_levels;
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    float step = 1.0 / (u_levels - 1.0);
    vec3 rgb = floor(c.rgb / step + 0.5) * step;
    gl_FragColor = vec4(rgb, c.a);
}`,

    solarize: `
uniform float u_threshold;
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    vec3 rgb = c.rgb;
    if (rgb.r > u_threshold) rgb.r = 1.0 - rgb.r;
    if (rgb.g > u_threshold) rgb.g = 1.0 - rgb.g;
    if (rgb.b > u_threshold) rgb.b = 1.0 - rgb.b;
    gl_FragColor = vec4(rgb, c.a);
}`,

    colorbal: `
uniform vec3 u_offset;
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    gl_FragColor = vec4(clamp(c.rgb + u_offset, 0.0, 1.0), c.a);
}`,

    chromatic: `
uniform float u_offset; // pixels offset
uniform vec2 u_res;
void main() {
    float off = u_offset / u_res.x;
    float r = texture2D(u_tex, v_uv + vec2(off, 0.0)).r;
    float g = texture2D(u_tex, v_uv).g;
    float b = texture2D(u_tex, v_uv - vec2(off, 0.0)).b;
    gl_FragColor = vec4(r, g, b, texture2D(u_tex, v_uv).a);
}`,

    mirrorquad: `
void main() {
    vec2 uv = v_uv;
    if (uv.x > 0.5) uv.x = 1.0 - uv.x;
    if (uv.y > 0.5) uv.y = 1.0 - uv.y;
    gl_FragColor = texture2D(u_tex, uv);
}`,

    duotone: `
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform float u_pivot;
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    float t;
    if (lum <= u_pivot) t = (lum / u_pivot) * 0.5;
    else t = 0.5 + ((lum - u_pivot) / (1.0 - u_pivot)) * 0.5;
    gl_FragColor = vec4(mix(u_c1, u_c2, clamp(t, 0.0, 1.0)), c.a);
}`,

    halftone: `
uniform float u_radius;
uniform vec2 u_res;
void main() {
    vec2 p = v_uv * u_res;
    vec2 grid = floor(p / u_radius + 0.5) * u_radius;
    vec4 c = texture2D(u_tex, grid / u_res);
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    float dist = distance(p, grid);
    float r = u_radius * 0.5 * lum;
    float mask = smoothstep(r, r - 1.0, dist);
    gl_FragColor = vec4(vec3(mask), c.a);
}`,

    filmgrain: `
uniform float u_intensity;
uniform float u_time;
float rand(vec2 co){
    return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}
void main() {
    vec4 c = texture2D(u_tex, v_uv);
    float n = (rand(v_uv + u_time) - 0.5) * u_intensity;
    gl_FragColor = vec4(clamp(c.rgb + n, 0.0, 1.0), c.a);
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

void main() {
    vec4 color = texture2D(u_tex, v_uv);
    vec3 rgb = vec3(sToL(color.r), sToL(color.g), sToL(color.b));
    
    // 1. Exposure
    rgb *= pow(2.0, (exposure / 100.0) * 2.0);
    
    // 2. Temp / Tint
    float t = temp / 100.0;
    rgb.r *= (1.0 + t * 0.12);
    rgb.b *= (1.0 - t * 0.12);
    rgb.g *= (1.0 + t * 0.02);
    float tn = tint / 100.0;
    rgb.r *= (1.0 + tn * 0.06);
    rgb.b *= (1.0 + tn * 0.06);
    rgb.g *= (1.0 - tn * 0.08);

    // 3. Tonal Curves
    float y = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
    if (y > 0.001) {
        float yNew = y;
        if (shadows != 0.0) {
            float w = max(0.0, 1.0 - (y / 0.5));
            yNew += (shadows / 100.0) * w * 0.4 * sqrt(y);
        }
        if (highlights != 0.0) {
            float w = max(0.0, (y - 0.5) / 0.5);
            yNew += (highlights / 100.0) * w * 0.6 * (1.1 - y);
        }
        if (whites != 0.0) {
            float w = pow(max(0.0, (y - 0.7) / 0.3), 2.0);
            yNew += (whites / 100.0) * w;
        }
        if (blacks != 0.0) {
            float w = pow(max(0.0, 1.0 - (y / 0.3)), 2.0);
            yNew += (blacks / 100.0) * w * 0.3;
        }
        rgb *= (max(0.0, yNew) / y);
        y = max(0.0, yNew);
    }
    
    // 4. Per-channel
    float wHi = max(0.0, y - 0.5) / 0.5;
    float wSh = max(0.0, 0.5 - y) / 0.5;
    rgb.r *= (1.0 + red / 100.0) * (1.0 + (redHi / 100.0) * wHi * 1.5) * (1.0 + (redSh / 100.0) * wSh * 1.5);
    rgb.g *= (1.0 + green / 100.0) * (1.0 + (greenHi / 100.0) * wHi * 1.5) * (1.0 + (greenSh / 100.0) * wSh * 1.5);
    rgb.b *= (1.0 + blue / 100.0) * (1.0 + (blueHi / 100.0) * wHi * 1.5) * (1.0 + (blueSh / 100.0) * wSh * 1.5);

    // 5. Sharpening (Simple Laplacian 5-tap)
    if (sharpen > 0.0 && u_res.x > 0.0) {
        float k = sharpen / 150.0;
        float center = 1.0 + 4.0 * k;
        float neighbor = -k;
        vec2 off = 1.0 / u_res;
        vec3 up = texture2D(u_tex, v_uv + vec2(0, -off.y)).rgb;
        vec3 dn = texture2D(u_tex, v_uv + vec2(0, off.y)).rgb;
        vec3 lf = texture2D(u_tex, v_uv + vec2(-off.x, 0)).rgb;
        vec3 rt = texture2D(u_tex, v_uv + vec2(off.x, 0)).rgb;
        vec3 upL = vec3(sToL(up.r), sToL(up.g), sToL(up.b));
        vec3 dnL = vec3(sToL(dn.r), sToL(dn.g), sToL(dn.b));
        vec3 lfL = vec3(sToL(lf.r), sToL(lf.g), sToL(lf.b));
        vec3 rtL = vec3(sToL(rt.r), sToL(rt.g), sToL(rt.b));
        rgb = rgb * center + (upL + dnL + lfL + rtL) * neighbor;
    }

    // 6. Grain
    if (grain > 0.0) {
        float gs = grainSharpness / 100.0;
        float noise = (rand(v_uv) - 0.5) * (grain / 100.0) * (0.2 + 0.4 * gs);
        rgb += noise;
    }

    // 7. Back to sRGB for Contrast/Sat
    rgb = vec3(lToS(rgb.r), lToS(rgb.g), lToS(rgb.b));
    float contrastF = (100.0 + contrast) / 100.0;
    rgb = clamp((rgb - 0.5) * contrastF + 0.5, 0.0, 1.0);
    
    if (saturation != 0.0 || vibrance != 0.0) {
        vec3 hsv = rgb2hsv(rgb);
        hsv.y = clamp(hsv.y * (1.0 + saturation / 100.0), 0.0, 1.0);
        if (vibrance != 0.0) hsv.y = clamp(hsv.y + (1.0 - hsv.y) * (vibrance / 100.0) * 0.4, 0.0, 1.0);
        rgb = hsv2rgb(hsv);
    }
    
    gl_FragColor = vec4(clamp(rgb, 0.0, 1.0), color.a);
}
    `
};
