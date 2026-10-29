const ids = ['brightness','exposure','highlightsshadows','hsv','posterize','coloraccent','transparency','temptint','vibrance',
 'sketch','oil','pastel','pencilsketch','unfocus','fragment','gaussian','motionblur','radialblur','sketchblur','blur','surfaceblur','zoomblur',
 'quantize','colorbal','chroma','chromatic','duotone','cmjn','bulge','dents','crystallize','frosted','morphology','pixelate','polarInvert','tileReflect',
 'twist','mirrorquad','projection3d','wave','addnoise','median','reducenoise','digitalpattern','vhs','dropshadow','featherobj','contour','softglow',
 'redeyeremove','unsharp','softenportrait','dream','fadeedge','removedust','straighten','vignette','clouds','gridcheck','julia','mandelbrot','turbulence',
 'edges','emboss','outline','relief','solarize','halftone','autolevel','grayscale','invert','invertalpha','sepia'];
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const res = {};
for (const id of ids) {
  try { window.applyEffect(id); } catch (e) { res[id] = { error: String(e) }; continue; }
  await sleep(350);
  const win = document.getElementById('effect-dialog-window');
  const vis = win && getComputedStyle(win).display !== 'none' && win.getBoundingClientRect().width > 0;
  if (!vis) { res[id] = { direct: true }; continue; }
  const title = (win.querySelector('.title-bar-text') || {}).textContent || '';
  const fields = [];
  for (const el of win.querySelectorAll('input, select')) {
    if (!el.id || !el.id.startsWith('ef-') || el.id.endsWith('-val') || el.type === 'hidden') continue;
    if (el.closest('[hidden]') ) continue;
    const row = el.closest('.field-row, .fx-row, label, div');
    let label = '';
    const fxr = el.closest('.fx-row'); const fxl = fxr && fxr.querySelector('.fx-label'); if (fxl && el.type !== 'checkbox') label = fxl.textContent.trim();
    const lab = el.id && win.querySelector(`label[for="${el.id}"]`);
    if (lab && !label) label = lab.textContent.trim();
    if (!label && row) { const l = row.querySelector('label, .fx-label, span'); if (l && !l.contains(el)) label = l.textContent.trim(); }
    if (!label && el.closest('label')) label = el.closest('label').textContent.trim();
    const f = { id: el.id, label: label.replace(/\s+/g, ' ').slice(0, 40), type: el.tagName === 'SELECT' ? 'select' : el.type };
    if (el.type === 'range' || el.type === 'number') { f.min = +el.min; f.max = +el.max; f.step = +(el.step || 1) || 1; f.value = +el.value; }
    else if (el.type === 'checkbox') f.value = el.checked ? 1 : 0;
    else if (el.type === 'color') f.value = el.value;
    else if (el.tagName === 'SELECT') { f.options = [...el.options].map(o => [o.value, o.textContent.trim()]); f.value = el.value; }
    else f.value = el.value;
    // section : légende du groupe (fieldset), titre de section repliable (.illu-cr-sec-h) ou résumé
    const fs = el.closest('fieldset'); const sec = el.closest('.illu-cr-sec'); const adv = el.closest('.illu-advanced-section');
    const head = (fs && fs.querySelector('legend')) || (sec && sec.querySelector('.illu-cr-sec-h')) || (adv && adv.querySelector('.illu-advanced-section-summary'));
    f.section = head ? head.textContent.replace(/\s+/g, ' ').trim().slice(0, 50) : '';
    if (sec && sec.classList.contains('illu-cr-sec--collapsed')) f.collapsed = 1;
    if (!fields.some(x => x.id === f.id)) fields.push(f);
  }
  res[id] = { title: title.trim(), fields };
  const cancel = document.getElementById('effect-dialog-btn-cancel') || [...win.querySelectorAll('button')].find(b => /annuler/i.test(b.textContent));
  if (cancel) cancel.click(); else if (window.FilterManager && FilterManager.cancel) FilterManager.cancel();
  await sleep(150);
}
return JSON.stringify(res);

