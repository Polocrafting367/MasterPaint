const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const root = document.querySelector('.illu-menubar-root');
const action = (li) => {
  const oc = li.getAttribute('onclick') || '';
  let m = oc.match(/applyEffect\(\s*['"]([\w-]+)['"]/);
  if (m) return 'fx:' + m[1];
  if (oc) return 'fn:' + oc.replace(/\s+/g, ' ').trim().slice(0, 160);
  return li.id ? 'id:' + li.id : '';
};
const icon = (li) => { const ic = li.querySelector(':scope > .menu-icon i, :scope > i'); if (!ic) return ['', '900']; const c = getComputedStyle(ic, '::before').content.replace(/"/g, ''); return [c && c !== 'none' ? c.codePointAt(0).toString(16) : '', getComputedStyle(ic).fontWeight]; };
const label = (li) => [...li.childNodes].filter(n => !(n.nodeType === 1 && n.matches('ul,menu,i,svg,.menu-icon,.shortcut,kbd,.menu-shortcut,.accel'))).map(n => n.textContent).join('').trim().replace(/\s+/g, ' ');
const items = (ul) => [...ul.querySelectorAll(':scope > li, :scope > hr')].map(li => {
  if (li.tagName === 'HR' || li.matches('.separator,[role=separator]') || !label(li)) return { sep: true };
  const sc = li.querySelector(':scope > .shortcut, :scope > kbd, :scope > .menu-shortcut, :scope > .accel');
  const sub = li.querySelector(':scope > ul');
  const [fa, faw] = icon(li);
  return { label: label(li), shortcut: sc ? sc.textContent.trim() : '', fa, faw, action: action(li), children: sub ? items(sub).filter(c => !c.sep) : [] };
});
const menus = [...root.children].filter(vis).map(m => ({ title: (m.querySelector(':scope > span') || m).textContent.trim().split('\n')[0].trim(), items: m.querySelector(':scope > ul') ? items(m.querySelector(':scope > ul')) : [] }));
const sw = [...document.querySelectorAll('.palette-swatch')].filter(vis).map(e => getComputedStyle(e).backgroundColor);
return JSON.stringify({ menus, palette: sw });

