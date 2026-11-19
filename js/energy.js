/* ============================================================
   energy.js — "Energía" del día: combina cómo dormiste y cuánto
   entrenaste en las últimas 48 h para sugerir qué tan fuerte ir.
   Es una guía sencilla, no una medición médica.
   ============================================================ */

const Energy = (() => {
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const addDays = (iso, n) => { const d = Utils.parseISO(iso); d.setDate(d.getDate() + n); return Utils.toISODate(d); };

  const TIERS = [
    { min: 80, icon: '⚡', color: 'var(--green)', title: 'A tope', text: 'Buen día para exigirte o buscar un récord.' },
    { min: 60, icon: '🔋', color: 'var(--accent-light)', title: 'Bien', text: 'Entrena normal, como lo tienes planeado.' },
    { min: 40, icon: '🪫', color: '#ffc247', title: 'Algo cansado', text: 'Baja un poco la intensidad y cuida la técnica.' },
    { min: 0, icon: '😴', color: '#ff5d73', title: 'Recupérate', text: 'Mejor descanso, caminar o algo suave hoy.' },
  ];

  function load48(today) {
    const from = addDays(today, -2); const to = addDays(today, -1);
    const wl = DB.getWorkoutLog(); let sets = 0;
    [from, to].forEach((d) => { ((wl[d] || {}).exercises || []).forEach((e) => (e.sets || []).forEach((s) => { if (!Metrics.isWarmup(s)) sets += 1; })); });
    const actMin = typeof Activity !== 'undefined' ? Activity.list(from, to).reduce((n, a) => n + (a.min || 0) * ((a.effort || 2) === 3 ? 1.3 : (a.effort || 2) === 1 ? 0.7 : 1), 0) : 0;
    return { sets, actMin, pts: sets * 0.6 + actMin * 0.18 };
  }

  function today() {
    const t = Utils.todayISO();
    const h = typeof Treats !== 'undefined' ? Treats.sleepOf(t) : null;
    const l = load48(t);
    const sleepAdj = h ? clamp((h - 7) * 12, -36, 18) : 0;
    const value = Math.round(clamp(72 + sleepAdj - l.pts, 12, 100));
    const tier = TIERS.find((x) => value >= x.min);
    return { value, tier, sleepH: h, load: l };
  }

  function block(rerender) {
    const e = today();
    const c = Utils.el('div', { class: 'energy-block' });
    c.appendChild(Utils.el('div', { class: 'en-top' }, [
      Utils.el('div', { class: 'en-title' }, [Utils.el('span', { class: 'en-ico', text: e.tier.icon }), Utils.el('b', { text: `Energía ${e.value}%` }), Utils.el('span', { class: 'en-tier', text: ` · ${e.tier.title}` })]),
    ]));
    c.appendChild(Utils.el('div', { class: 'en-bar', role: 'img', 'aria-label': `Energía ${e.value} por ciento` }, [Utils.el('i', { style: `width:${e.value}%;background:${e.tier.color}` })]));
    c.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:6px;', text: e.tier.text }));
    const sleepTxt = e.sleepH ? `😴 ${String(e.sleepH).replace('.', ',')} h` : '😴 sin dato';
    const det = Utils.el('div', { class: 'small text-dim en-det' }, [`${sleepTxt} · 🏋️ ${e.load.sets} series · 🏃 ${Math.round(e.load.actMin)} min (48 h)`]);
    if (!e.sleepH) {
      const b = Utils.el('button', { type: 'button', class: 'link-btn small', text: '· Anotar sueño' });
      b.addEventListener('click', () => Treats.openSleep(Utils.todayISO(), rerender));
      det.appendChild(b);
    }
    c.appendChild(det);
    return c;
  }
  function card(rerender) {
    const c = Utils.el('div', { class: 'card energy-card' });
    c.appendChild(block(rerender));
    return c;
  }

  return { today, block, card, TIERS };
})();
