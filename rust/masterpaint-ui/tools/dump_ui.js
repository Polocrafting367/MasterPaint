const icon = (b) => {
  const u = b.querySelector('use');
  if (u) return { kind: 'svg', id: (u.getAttribute('href') || u.getAttribute('xlink:href')).slice(1) };
  const i = b.querySelector('i[class*="fa-"]');
  if (i) { const c = getComputedStyle(i, '::before').content.replace(/"/g, ''); return { kind: 'fa', weight: getComputedStyle(i).fontWeight, code: c.codePointAt(0).toString(16) }; }
  const sv = b.querySelector('svg');
  if (sv) return { kind: 'inline', svg: sv.outerHTML };
  return null;
};
const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; };
const dump = (els) => els.filter(vis).map(b => { const r = b.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), id: b.dataset.tool || b.id || '', title: (b.title || b.getAttribute('aria-label') || '').split(/[(—:]/)[0].trim(), label: [...b.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.matches('i,svg,use'))).map(n => n.textContent).join('').trim(), icon: icon(b) }; });
const all = [...document.querySelectorAll('button, [role=button], label.illu-ribbon-btn')];
const top = dump(all.filter(b => { const r = b.getBoundingClientRect(); return r.top >= 0 && r.bottom <= 140; }));
const tools = dump([...document.querySelectorAll('#win-tools button')]).filter(t => t.y < 480);
const menus = [...document.querySelectorAll('*')].filter(e => vis(e) && e.getBoundingClientRect().top < 24 && e.children.length === 0 && e.textContent.trim()).map(e => e.textContent.trim());
const groups = [...document.querySelectorAll('.illu-ribbon-group-label')].filter(vis).map(e => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), label: e.textContent.trim() }; });
const ids = new Set([...top, ...tools].filter(t => t.icon && t.icon.kind === 'svg').map(t => t.icon.id));
['illu-icon-tool-direct-select'].forEach(i => ids.add(i));
const symbols = {}; ids.forEach(id => { const s = document.getElementById(id); if (s) symbols[id] = { viewBox: s.getAttribute('viewBox'), inner: s.innerHTML }; });
return JSON.stringify({ menus, groups, top, tools, symbols });
