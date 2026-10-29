// MasterPaint — worker de calcul (navigateur) : effets, Camera Raw, RAW et décodage d'images
// hors du fil de l'interface, qui ne se fige plus. Même module wasm que la page, reçu déjà
// compilé ; la fonction de démarrage de l'application ne fait rien hors d'une fenêtre.
import init, { mp_worker_effect, mp_worker_camraw_lin, mp_worker_raw, mp_worker_decode, mp_worker_fill } from './pkg/masterpaint_ui.js';

let ready = null;
// dernier message de panique du module (écrit par le panic hook dans la console) : transmis à la
// page pour la fenêtre d'erreur
let lastPanic = '';
const consoleError = console.error.bind(console);
console.error = (...a) => {
  const s = a.map(String).join(' ');
  if (s.includes('panicked')) lastPanic = s;
  consoleError(...a);
};

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'init') {
    ready = init({ module_or_path: m.module });
    return;
  }
  let out = null;
  let dead = false;
  let err = '';
  try {
    await ready;
    if (m.type === 'effect') out = mp_worker_effect(m.name, m.data, m.w, m.h, m.params, m.post || new Float32Array(0));
    else if (m.type === 'camraw-lin') out = mp_worker_camraw_lin(m.data, m.w, m.h, m.params);
    else if (m.type === 'fill') out = mp_worker_fill(m.data, m.mask, m.w, m.h, m.params);
    else if (m.type === 'raw') out = mp_worker_raw(m.data);
    else if (m.type === 'decode') out = mp_worker_decode(m.data);
    if (out && out.length === 0) out = null;
  } catch (e2) {
    // erreur dans le module (panique) : il est inutilisable, la page en recrée un
    console.warn("[MasterPaint] worker :", e2);
    out = null;
    dead = true;
    err = (lastPanic || String(e2)) + '\n(calcul : ' + m.type + (m.name ? ' « ' + m.name + ' »' : '') +
      (m.w ? ', ' + m.w + ' × ' + m.h + ' px' : '') + ')';
    lastPanic = '';
  }
  self.postMessage({ job: m.job, out, dead, err }, out ? [out.buffer] : []);
};
