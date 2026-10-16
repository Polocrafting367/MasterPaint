/* HTCL — tableau de bord. Interroge api.php et redessine la page. */
(() => {
  'use strict';

  const $  = (s) => document.querySelector(s);
  const el = (tag, cls, txt) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt !== undefined) n.textContent = txt;
    return n;
  };

  const ui = {
    pulse: $('#pulse'), kpis: $('#kpis'), live: $('#live'), livePanel: $('#live-panel'),
    byRule: $('#by-rule'), byHour: $('#by-hour'), rulesScope: $('#rules-scope'),
    byProject: $('#by-project'), projScope: $('#proj-scope'), project: $('#f-project'),
    tbody: $('#events tbody'), empty: $('#empty'), count: $('#count'), tip: $('#tip'),
    source: $('#f-source'), rule: $('#f-rule'), range: $('#f-range'), q: $('#f-q'),
    auto: $('#f-auto'), exportLink: $('#export'), purge: $('#purge'),
    statusbar: $('#statusbar'),
    filterbox: $('#filterbox'), filterSummary: $('#filter-summary'),
  };

  let skew = 0;            // secondes à ajouter à l'horloge locale pour suivre le serveur
  let timer = null, ticker = null, busy = false;
  let openEvents = [];
  let lastSignature = '';  // évite de reconstruire le tableau quand rien n'a bougé

  // Sur mobile on charge moins de lignes : moins de données, moins de DOM.
  const MOBILE = matchMedia('(max-width: 720px)').matches;
  const PAGE = MOBILE ? 60 : 200;
  const COARSE = matchMedia('(pointer: coarse)').matches;

  /* ------------------------------------------------------------ format --- */

  const pad = (n) => String(n).padStart(2, '0');

  /** Durée lisible : 850 ms → « 0,9 s », 95 s → « 1 min 35 s », 4000 s → « 1 h 07 ». */
  function fmtDur(ms) {
    if (ms === null || ms === undefined) return '—';
    const s = ms / 1000;
    if (s < 10)   return s.toFixed(1).replace('.', ',') + ' s';
    if (s < 60)   return Math.round(s) + ' s';
    if (s < 3600) return Math.floor(s / 60) + ' min ' + pad(Math.round(s % 60)) + ' s';
    return Math.floor(s / 3600) + ' h ' + pad(Math.floor((s % 3600) / 60));
  }

  function fmtClock(ts) {
    if (!ts) return '—';
    const d = new Date(ts * 1000);
    return pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function fmtDay(ts) {
    const d = new Date(ts * 1000), n = new Date((Date.now() / 1000 + skew) * 1000);
    if (d.toDateString() === n.toDateString()) return '';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + ' ';
  }

  const now = () => Date.now() / 1000 + skew;

  /* ------------------------------------------------------------ filtres --- */

  function since() {
    const v = ui.range.value;
    if (v === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() / 1000; }
    if (v === '0') return null;
    return now() - Number(v);
  }

  function query(extra = {}) {
    const p = new URLSearchParams();
    const s = since();
    if (s) p.set('since', Math.floor(s));
    if (ui.source.value) p.set('source', ui.source.value);
    if (ui.project.value) p.set('project', ui.project.value);
    if (ui.rule.value)   p.set('rule', ui.rule.value);
    if (ui.q.value.trim()) p.set('q', ui.q.value.trim());
    for (const [k, v] of Object.entries(extra)) p.set(k, v);
    return p;
  }

  function fillSelect(sel, values) {
    const keep = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    values.forEach((v) => sel.add(new Option(v, v)));
    if (values.includes(keep)) sel.value = keep;
  }

  /* ------------------------------------------------------------- rendu --- */

  function renderKpis(st) {
    const tiles = [
      { label: 'Événements', value: String(st.today_count), sub: scopeLabel() },
      { label: "Temps d'affichage cumulé", value: fmtDur(st.today_ms), sub: scopeLabel() },
      { label: 'En cours', value: String(st.open_count), sub: st.open_count ? 'affichage actif' : 'rien à l’écran', live: st.open_count > 0 },
      { label: 'Durée moyenne', value: fmtDur(avgOf(st)), sub: 'par événement' },
    ];
    ui.kpis.replaceChildren(...tiles.map((t) => {
      const box = el('div', 'kpi' + (t.live ? ' live' : ''));
      box.append(el('div', 'k-label', t.label), el('div', 'k-value', t.value), el('div', 'k-sub', t.sub));
      return box;
    }));
  }

  function avgOf(st) {
    const tot = st.by_rule.reduce((a, r) => a + r.total_ms, 0);
    const n   = st.by_rule.reduce((a, r) => a + r.count, 0);
    return n ? Math.round(tot / n) : null;
  }

  const scopeLabel = () => ui.range.selectedOptions[0].textContent.toLowerCase();

  function renderLive(events) {
    openEvents = events.filter((e) => e.ended_at === null);
    ui.livePanel.hidden = openEvents.length === 0;
    ui.live.replaceChildren(...openEvents.map((e) => {
      const row = el('div', 'live-row');
      row.append(el('span', 'r', e.rule),
                 el('span', 'p', e.project && e.project !== 'défaut' ? e.project : ''),
                 el('span', 't', e.label || '—'),
                 el('span', 'd', fmtDur((now() - e.started_at) * 1000)));
      row.dataset.start = e.started_at;
      return row;
    }));
  }

  function tickLive() {
    ui.live.querySelectorAll('.live-row').forEach((row) => {
      row.querySelector('.d').textContent = fmtDur((now() - Number(row.dataset.start)) * 1000);
    });
  }

  /** Barres horizontales : une seule série, donc une seule couleur. */
  function renderBars(node, rows, key) {
    if (!rows.length) {
      node.replaceChildren(el('p', 'empty', 'Rien à afficher.'));
      return;
    }
    const max = Math.max(...rows.map((r) => r.total_ms), 1);
    node.replaceChildren(...rows.map((r) => {
      const row = el('div', 'bar-row');
      const track = el('div', 'bar-track');
      const fill = el('div', 'bar-fill');
      fill.style.width = Math.max(2, (r.total_ms / max) * 100) + '%';
      track.append(fill);
      row.append(el('div', 'name', r[key]), track, el('div', 'val', fmtDur(r.total_ms)));
      if (COARSE) row.title = `${r[key]} — ${r.count} événement(s), cumul ${fmtDur(r.total_ms)}`;
      bindTip(row, `<b>${esc(r[key])}</b><br>${r.count} événement${r.count > 1 ? 's' : ''}` +
                   `<br>cumul ${fmtDur(r.total_ms)}` +
                   (r.avg_ms !== undefined ? ` · moyenne ${fmtDur(r.avg_ms)}` : ''));
      row.addEventListener('click', () => {      // un clic filtre sur la barre
        const sel = key === 'rule' ? ui.rule : ui.project;
        sel.value = sel.value === r[key] ? '' : r[key];
        refresh();
      });
      row.style.cursor = 'pointer';
      return row;
    }));
  }

  function renderByHour(st) {
    const h = new Date().getHours();
    const order = Array.from({ length: 24 }, (_, i) => (h - 23 + i + 24) % 24);
    const max = Math.max(...st.by_hour, 1);
    ui.byHour.replaceChildren(...order.map((hour, i) => {
      const n = st.by_hour[hour];
      const cell = el('div', 'hour' + (n ? '' : ' zero'));
      const col  = el('div', 'col');
      col.style.height = (n ? Math.max(4, (n / max) * 100) : 2) + '%';
      cell.append(col, el('div', 'lbl', i % 4 === 0 || i === 23 ? pad(hour) : ''));
      bindTip(cell, `<b>${pad(hour)} h</b><br>${n} événement${n > 1 ? 's' : ''}`);
      return cell;
    }));
  }

  function renderTable(events) {
    ui.count.textContent = events.length + (events.length >= PAGE ? ' derniers' : '');
    ui.empty.hidden = events.length > 0;

    // Signature bon marché : si elle n'a pas changé, le DOM non plus.
    const sig = events.length + '|' + events.map((e) => e.uid + (e.ended_at || 0)).join(',');
    if (sig === lastSignature) return;
    lastSignature = sig;
    ui.tbody.replaceChildren(...events.map((e) => {
      const tr = el('tr');

      const dur = el('td', 'num dur');
      if (e.ended_at === null) {
        dur.classList.add('running');
        dur.dataset.live = String(e.started_at);   // réactualisé chaque seconde
        dur.textContent = fmtDur((now() - e.started_at) * 1000);
      } else {
        dur.textContent = fmtDur(e.duration_ms);
      }

      const proj = el('td', 'c-proj');
      proj.append(el('span', 'tag proj', e.project || 'défaut'));

      const rule = el('td', 'c-rule');
      rule.append(el('span', 'tag', e.rule));

      const txt = el('td', 'txt', e.label || '—');
      if (e.label) txt.title = e.label;

      tr.append(
        el('td', 'c-start', fmtDay(e.started_at) + fmtClock(e.started_at)),
        el('td', 'c-end', e.ended_at === null ? '—' : fmtClock(e.ended_at)),
        dur,
        proj,
        rule,
        txt,
        el('td', 'c-src', e.source),
      );
      return tr;
    }));
  }

  function tickTable() {
    ui.tbody.querySelectorAll('td[data-live]').forEach((td) => {
      td.textContent = fmtDur((now() - Number(td.dataset.live)) * 1000);
    });
  }

  /** Sur mobile les filtres sont repliés : on rappelle en une ligne ceux qui agissent. */
  function renderFilterSummary() {
    const bits = [ui.project.value, ui.rule.value, ui.source.value,
                  ui.q.value.trim() ? '« ' + ui.q.value.trim() + ' »' : ''].filter(Boolean);
    bits.unshift(scopeLabel());
    ui.filterSummary.textContent = '— ' + bits.join(', ');
  }

  /** Barre d'état, dans l'esprit de celle de l'agent. */
  function renderStatus(st, shown) {
    const bits = [
      `${shown} événement${shown > 1 ? 's' : ''} affiché${shown > 1 ? 's' : ''}`,
      `${st.total_events} au total`,
      `${st.projects.length} projet${st.projects.length > 1 ? 's' : ''}`,
    ];
    if (st.open_count) bits.push(`${st.open_count} en cours`);
    bits.push('mis à jour à ' + fmtClock(now()));
    if (!ui.auto.checked) bits.push('rafraîchissement automatique désactivé');
    ui.statusbar.textContent = bits.join('  ·  ');
  }

  /* --------------------------------------------------------- infobulle --- */

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function bindTip(node, html) {
    if (COARSE) return;          // sur écran tactile, le toucher sert à filtrer
    node.addEventListener('pointerenter', () => {
      ui.tip.innerHTML = html;
      ui.tip.hidden = false;
    });
    node.addEventListener('pointermove', (ev) => {
      const pad = 14;
      const w = ui.tip.offsetWidth, hgt = ui.tip.offsetHeight;
      ui.tip.style.left = Math.min(ev.clientX + pad, innerWidth  - w - 8) + 'px';
      ui.tip.style.top  = Math.max(8, Math.min(ev.clientY + pad, innerHeight - hgt - 8)) + 'px';
    });
    node.addEventListener('pointerleave', () => { ui.tip.hidden = true; });
  }

  /* -------------------------------------------------------- chargement --- */

  async function refresh() {
    if (busy) return;
    busy = true;
    try {
      const statsQ = new URLSearchParams();
      const s = since();
      if (s) statsQ.set('since', Math.floor(s));

      const [listR, statsR] = await Promise.all([
        fetch('api.php?action=list&' + query({ limit: PAGE }), { credentials: 'same-origin' }),
        fetch('api.php?action=stats&' + statsQ, { credentials: 'same-origin' }),
      ]);
      if (listR.status === 401 || statsR.status === 401) { location.reload(); return; }

      const list  = await listR.json();
      const stats = (await statsR.json()).stats;
      skew = list.now - Date.now() / 1000;

      fillSelect(ui.source,  stats.sources);
      fillSelect(ui.rule,    stats.rules);
      fillSelect(ui.project, stats.projects);
      renderKpis(stats);
      renderLive(list.events);
      ui.rulesScope.textContent = scopeLabel();
      ui.projScope.textContent = scopeLabel();
      renderBars(ui.byRule, stats.by_rule, 'rule');
      renderBars(ui.byProject, stats.by_project, 'project');
      renderByHour(stats);
      renderTable(list.events);
      schedule();
      ui.exportLink.href = 'api.php?action=export&' + query();
      renderStatus(stats, list.events.length);
      renderFilterSummary();
      ui.pulse.className = 'dot on';
      setTimeout(() => { if (ui.pulse.className === 'dot on') ui.pulse.className = 'dot'; }, 600);
    } catch (err) {
      ui.pulse.className = 'dot err';
      ui.statusbar.textContent = 'serveur injoignable — ' + err;
      console.error('[HTCL]', err);
    } finally {
      busy = false;
    }
  }

  const PERIOD = MOBILE ? 8000 : 4000;

  function schedule() {
    clearInterval(timer);
    clearInterval(ticker);
    if (document.hidden) return;              // onglet en arrière-plan : rien ne tourne
    if (ui.auto.checked) timer = setInterval(refresh, PERIOD);
    if (openEvents.length) ticker = setInterval(tick, 1000);
  }

  function tick() {
    tickLive();
    tickTable();
  }

  /* ------------------------------------------------------------ actions -- */

  let debounce;
  ui.q.addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(refresh, 350); });
  [ui.source, ui.rule, ui.project, ui.range].forEach((n) => n.addEventListener('change', refresh));
  ui.auto.addEventListener('change', schedule);

  ui.purge.addEventListener('click', async () => {
    const bits = [];
    if (ui.project.value) bits.push('du projet « ' + ui.project.value + ' »');
    if (ui.rule.value)    bits.push('de la règle « ' + ui.rule.value + ' »');
    if (ui.source.value)  bits.push('de ' + ui.source.value);
    const what = bits.length
      ? 'Supprimer les événements ' + bits.join(' ') + ' ?'
      : "Supprimer TOUT l'historique ?";
    if (!confirm(what)) return;
    const r = await fetch('api.php?action=purge', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        csrf: window.HTCL.csrf,
        rule: ui.rule.value || null,
        source: ui.source.value || null,
        project: ui.project.value || null,
      }),
    });
    const j = await r.json();
    if (!j.ok) alert('Échec : ' + (j.error || '?'));
    refresh();
  });

  document.addEventListener('visibilitychange', () => {
    schedule();
    if (!document.hidden) refresh();
  });

  if (MOBILE) ui.filterbox.removeAttribute('open');   // écran court : on déplie à la demande
  refresh();
  schedule();
})();
