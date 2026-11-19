/* ============================================================
   views/rewards.js — Pestaña "Logros" (en Progreso): nivel, XP,
   racha, medallas (con estante de recientes, filtros y categorías
   plegables), premios y retos de la semana.
   ============================================================ */

const RewardsView = (() => {
  // estado de la pantalla (se conserva mientras la app está abierta)
  const ui = { filter: 'todas', open: {} };
  const TIER_NAMES = { 1: 'Bronce', 2: 'Plata', 3: 'Oro' };

  const stat = (v, l) => Utils.el('div', { class: 'lv-stat' }, [Utils.el('div', { class: 'v', text: String(v) }), Utils.el('div', { class: 'l', text: l })]);

  // barra plegable. `id` recuerda si estaba abierta
  function fold(id, title, sub, content, defaultOpen, extraHead) {
    const d = Utils.el('details', { class: 'fold' });
    d.open = ui.open[id] !== undefined ? ui.open[id] : !!defaultOpen;
    const head = Utils.el('summary', { class: 'fold-sum' }, [
      Utils.el('span', { class: 'fold-t', text: title }),
      extraHead || null,
      Utils.el('span', { class: 'fold-sub', text: sub || '' }),
      Utils.el('i', { class: 'fold-chev' }),
    ]);
    d.appendChild(head);
    d.appendChild(content);
    d.addEventListener('toggle', () => { ui.open[id] = d.open; });
    return d;
  }

  function render(container) {
    container.innerHTML = '';
    const ev = Gamify.evaluate();
    const { st, lvl } = ev;
    const view = Utils.el('div', { class: 'view' });
    const done = ev.list.filter((a) => a.done);

    // ---- nivel ----
    const hero = Utils.el('div', { class: 'card level-card' });
    hero.appendChild(Utils.el('div', { class: 'lv-top' }, [
      Utils.ring(lvl.pct, { size: 112, stroke: 11, label: String(lvl.level), sub: 'nivel' }),
      Utils.el('div', { style: 'flex:1;min-width:0;' }, [
        Utils.el('div', { class: 'eyebrow', text: 'Tu título' }),
        Utils.el('div', { class: 'lv-title', text: lvl.title }),
        Utils.el('div', { class: 'small text-dim', text: `${ev.xp} XP · faltan ${lvl.toNext} para el nivel ${lvl.level + 1}` }),
        Utils.el('div', { class: 'lv-streak' }, [
          Utils.el('span', { class: 'flame', text: '🔥' }),
          Utils.el('b', { text: String(st.streak) }),
          ` semana${st.streak === 1 ? '' : 's'} de racha`,
          st.bestStreak > st.streak ? Utils.el('span', { class: 'text-dim', text: ` · mejor ${st.bestStreak}` }) : null,
        ]),
      ]),
    ]));
    if (typeof Stories !== 'undefined') {
      const sb = Utils.el('button', { type: 'button', class: 'btn-secondary btn-block', style: 'margin-top:12px;', text: '📤 Compartir historia' });
      sb.addEventListener('click', () => Stories.hub());
      hero.appendChild(sb);
    }
    hero.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:10px;', text: `Racha: semanas seguidas con ${Gamify.MIN_WEEKLY} o más entrenos.` }));
    hero.appendChild(Utils.el('div', { class: 'lv-stats' }, [
      stat(st.sessions, 'entrenos'),
      stat(st.sets, 'series'),
      stat(st.prs, 'récords'),
      stat(`${Utils.compact(Units.fromKg(st.volume))} ${Units.current()}`, 'volumen'),
    ]));
    view.appendChild(hero);

    // ---- estante: últimas medallas ----
    view.appendChild(shelf(ev, done));

    // ---- premios (plegable) ----
    try {
      const bal = Treats.balance();
      const tc = Treats.card(() => render(container));
      view.appendChild(fold('premios', '🎁 Tus premios', `🎟️ ${bal} vale${bal === 1 ? '' : 's'}`, tc, false));
    } catch (e) { /* premios no disponibles */ }

    // ---- retos de la semana ----
    const chs = Gamify.currentChallenges();
    const chCard = Utils.el('div', { class: 'card' });
    chs.forEach((c) => {
      chCard.appendChild(Utils.el('div', { class: 'next-row' }, [
        Utils.el('div', { class: `badge gold${c.done ? '' : ' locked'}`, style: `--p:${Math.round((c.curCapped / c.target) * 100)}` }, [Utils.el('span', { text: c.done ? '✓' : c.icon })]),
        Utils.el('div', { style: 'flex:1;min-width:0;' }, [
          Utils.el('div', { style: 'font-weight:700;', text: c.title }),
          Utils.el('div', { class: 'meta', text: c.done ? '¡Cumplido! +60 XP' : `${c.curCapped} / ${c.target} · +60 XP al cumplirlo` }),
          Utils.el('div', { class: 'macro-bar', style: 'margin-top:6px;' }, [Utils.el('div', { class: 'macro-bar-fill', style: `width:${Math.round((c.curCapped / c.target) * 100)}%;background:var(--accent-grad);` })]),
        ]),
      ]));
    });
    chCard.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:6px;', text: 'Cambian cada semana (domingo). El reto de series sale del grupo que más descuidaste.' }));
    const wkBtn = Utils.el('button', { class: 'btn-secondary btn-block', style: 'margin-top:10px;', text: '📊 Ver el resumen de esta semana' });
    wkBtn.addEventListener('click', () => WeeklyReview.openModal(0));
    chCard.appendChild(wkBtn);
    view.appendChild(fold('retos', '🎯 Retos de la semana', `${chs.filter((c) => c.done).length} / ${chs.length}`, chCard, true));

    // ---- más cerca de desbloquear ----
    const next = ev.list.filter((a) => !a.done).sort((a, b) => b.curCapped / b.target - a.curCapped / a.target).slice(0, 3);
    if (next.length) {
      const c = Utils.el('div', { class: 'card' });
      next.forEach((a) => c.appendChild(nextRow(a)));
      view.appendChild(fold('cerca', '✨ Casi lo logras', 'próximas', c, true));
    }

    // ---- colección ----
    view.appendChild(collection(ev, container));

    // ---- récords recientes ----
    view.appendChild(fold('prs', '🏆 Récords recientes', '', recentPRs(), false));
    container.appendChild(view);
  }

  // ---------------------------------------------------------------- estante de recientes
  function shelf(ev, done) {
    const card = Utils.el('div', { class: 'card shelf-card' });
    const dated = done.filter((a) => a.date && a.date !== 'previo').sort((a, b) => (a.date < b.date ? 1 : -1));
    const rest = done.filter((a) => !dated.includes(a)).sort((a, b) => b.tier - a.tier);
    const list = dated.concat(rest).slice(0, 8);
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: '🏅 Mis medallas' }),
      Utils.el('span', { class: 'medal-count' }, [Utils.el('b', { text: String(done.length) }), ` / ${ev.list.length}`]),
    ]));
    const tiers = [1, 2, 3].map((t) => ({ t, n: done.filter((a) => a.tier === t).length, total: ev.list.filter((a) => a.tier === t).length }));
    card.appendChild(Utils.el('div', { class: 'tier-row' }, tiers.map((x) => Utils.el('div', { class: `tier-chip t${x.t}` }, [Utils.el('i'), Utils.el('span', { text: `${TIER_NAMES[x.t]} ${x.n}/${x.total}` })]))));
    if (!list.length) {
      card.appendChild(Utils.el('p', { class: 'small text-dim', text: 'Aún no tienes medallas. Registra tu primer entrenamiento y empieza la colección.' }));
      return card;
    }
    card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:12px 0 8px;', text: dated.length ? 'Últimas desbloqueadas' : 'Tus mejores medallas' }));
    const row = Utils.el('div', { class: 'shelf' });
    list.forEach((a) => {
      const b = Utils.el('button', { type: 'button', class: 'shelf-item' }, [Gamify.badgeEl(a), Utils.el('div', { class: 'shelf-name', text: a.name })]);
      b.addEventListener('click', () => openBadge(a));
      row.appendChild(b);
    });
    card.appendChild(row);
    return card;
  }

  // ---------------------------------------------------------------- colección por categorías
  function collection(ev, container) {
    const wrap = Utils.el('div', { class: 'coll' });
    const head = Utils.el('div', { class: 'coll-head' }, [Utils.el('h3', { class: 'mb-0', text: '🗂️ Colección' })]);
    const chips = Utils.el('div', { class: 'rt-chips' });
    [['todas', 'Todas'], ['ganadas', 'Ganadas'], ['pendientes', 'Por lograr']].forEach(([k, t]) => {
      const c = Utils.el('button', { type: 'button', class: `rt-chip plain${ui.filter === k ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
      c.addEventListener('click', () => { ui.filter = k; render(container); });
      chips.appendChild(c);
    });
    head.appendChild(chips);
    wrap.appendChild(head);
    Gamify.CATS.forEach((cat) => {
      const all = ev.list.filter((a) => a.cat === cat);
      if (!all.length) return;
      const n = all.filter((a) => a.done).length;
      const items = all.filter((a) => (ui.filter === 'ganadas' ? a.done : ui.filter === 'pendientes' ? !a.done : true));
      if (!items.length) return;
      const grid = Utils.el('div', { class: 'badge-grid card' });
      items.forEach((a) => {
        const t = Utils.el('button', { class: `badge-tile t${a.tier}` + (a.done ? ' done' : ''), type: 'button' }, [
          Gamify.badgeEl(a),
          Utils.el('div', { class: 'bt-name', text: a.name }),
          a.done ? Utils.el('div', { class: 'bt-tier', text: TIER_NAMES[a.tier] }) : Utils.el('div', { class: 'bt-prog', text: `${Math.round((a.curCapped / a.target) * 100)}%` }),
        ]);
        t.addEventListener('click', () => openBadge(a));
        grid.appendChild(t);
      });
      // vista previa en la barra: hasta 5 medallas (las ganadas primero)
      const prev = Utils.el('span', { class: 'fold-prev' });
      all.slice().sort((a, b) => (b.done ? 1 : 0) - (a.done ? 1 : 0) || b.tier - a.tier).slice(0, 5).forEach((a) => prev.appendChild(Gamify.badgeEl(a, false, 'xs')));
      const holder = Utils.el('div');
      holder.appendChild(Utils.el('div', { class: 'cat-bar' }, [Utils.el('i', { style: `width:${Math.round((n / all.length) * 100)}%` })]));
      holder.appendChild(grid);
      wrap.appendChild(fold(`cat-${cat}`, cat, `${n}/${all.length}`, holder, ui.filter !== 'todas', prev));
    });
    return wrap;
  }

  function fmtVal(a, v) {
    if (a.fmt) return a.fmt(v);
    if (a.id[0] === 'v' && a.id !== 'var10' && a.id !== 'var20') return `${Utils.compact(Units.fromKg(v))}${Units.current()}`;
    return String(Math.round(v));
  }

  function nextRow(a) {
    const pct = Math.round((a.curCapped / a.target) * 100);
    return Utils.el('div', { class: 'next-row' }, [
      Gamify.badgeEl(a),
      Utils.el('div', { style: 'flex:1;min-width:0;' }, [
        Utils.el('div', { style: 'font-weight:700;', text: a.name }),
        Utils.el('div', { class: 'meta', text: `${a.desc} · ${fmtVal(a, a.curCapped)} / ${fmtVal(a, a.target)}` }),
        Utils.el('div', { class: 'macro-bar', style: 'margin-top:6px;' }, [Utils.el('div', { class: 'macro-bar-fill', style: `width:${pct}%;background:var(--accent-grad);` })]),
      ]),
    ]);
  }

  // ---------------------------------------------------------------- detalle de una medalla
  function openBadge(a) {
    const body = Utils.el('div', { class: 'unlock-body', style: 'text-align:center;' });
    body.appendChild(Utils.el('div', { class: 'unlock-hero' }, [Utils.el('div', { class: `rays t${a.tier}${a.done ? '' : ' off'}` }), Gamify.badgeEl(a, true)]));
    body.appendChild(Utils.el('div', { class: 'ur-name', style: 'font-size:1.25rem;margin-top:6px;', text: a.name }));
    body.appendChild(Utils.el('div', { class: `tier-pill t${a.tier}`, text: `${TIER_NAMES[a.tier]} · ${a.cat}` }));
    body.appendChild(Utils.el('p', { style: 'margin:10px 0;', text: a.desc }));
    if (a.done) {
      body.appendChild(Utils.el('div', { class: 'sm-ok', text: a.date && a.date !== 'previo' ? `✓ Desbloqueada el ${Utils.friendlyDate(a.date)}` : '✓ Ya la tenías antes de que existieran los logros' }));
      const share = Utils.el('button', { class: 'btn-primary btn-block', style: 'margin-top:12px;', type: 'button', text: '📤 Compartir esta medalla' });
      share.addEventListener('click', () => shareBadge(a));
      body.appendChild(share);
    } else {
      body.appendChild(nextRow(a));
    }
    Modal.open('Medalla', body);
  }

  // imagen para compartir (1080×1350)
  const METAL = { 1: ['#f6c08a', '#b06f33', '#6e3a12'], 2: ['#ffffff', '#b0bbd0', '#6f7b93'], 3: ['#fff3b8', '#f2b92c', '#a8700a'] };
  async function shareBadge(a) {
    const W = 1080; const H = 1350;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const x = cv.getContext('2d');
    const ac = Utils.accent();
    x.fillStyle = '#0b0d12'; x.fillRect(0, 0, W, H);
    const g = x.createRadialGradient(W / 2, 560, 40, W / 2, 560, 760);
    g.addColorStop(0, `${ac.a}55`); g.addColorStop(1, 'rgba(11,13,18,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const m = METAL[a.tier] || METAL[1];
    x.save(); x.translate(W / 2, 560);
    for (let i = 0; i < 16; i += 1) {
      x.rotate((Math.PI * 2) / 16);
      const rg = x.createLinearGradient(0, 0, 0, -520);
      rg.addColorStop(0, `${m[1]}55`); rg.addColorStop(1, `${m[1]}00`);
      x.fillStyle = rg; x.beginPath(); x.moveTo(-26, 0); x.lineTo(26, 0); x.lineTo(70, -520); x.lineTo(-70, -520); x.closePath(); x.fill();
    }
    x.restore();
    const R = 230;
    const ring = x.createConicGradient ? x.createConicGradient(-1.2, W / 2, 560) : x.createLinearGradient(W / 2 - R, 560 - R, W / 2 + R, 560 + R);
    [[0, m[0]], [0.3, m[1]], [0.55, m[2]], [0.8, m[1]], [1, m[0]]].forEach(([o, c]) => ring.addColorStop(o, c));
    x.shadowColor = `${m[1]}aa`; x.shadowBlur = 80;
    x.fillStyle = ring; x.beginPath(); x.arc(W / 2, 560, R, 0, Math.PI * 2); x.fill();
    x.shadowBlur = 0;
    const inner = x.createRadialGradient(W / 2 - 70, 560 - 90, 20, W / 2, 560, R - 28);
    inner.addColorStop(0, m[0]); inner.addColorStop(1, m[2]);
    x.fillStyle = inner; x.beginPath(); x.arc(W / 2, 560, R - 28, 0, Math.PI * 2); x.fill();
    x.fillStyle = 'rgba(255,255,255,.14)'; x.beginPath(); x.ellipse(W / 2 - 50, 560 - 120, 110, 55, -0.5, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = '210px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.fillText(a.icon, W / 2, 570);
    x.fillStyle = '#fff'; x.textBaseline = 'alphabetic';
    x.font = '800 78px system-ui, -apple-system, "Segoe UI", sans-serif'; x.fillText(a.name, W / 2, 940);
    x.fillStyle = m[1]; x.font = '800 36px system-ui, sans-serif'; x.fillText(`${(TIER_NAMES[a.tier] || '').toUpperCase()} · ${a.cat.toUpperCase()}`, W / 2, 1000);
    x.fillStyle = 'rgba(255,255,255,.75)'; x.font = '600 38px system-ui, sans-serif';
    const words = a.desc.split(' '); let line = ''; let y = 1075;
    words.forEach((w) => { const t = line ? `${line} ${w}` : w; if (x.measureText(t).width > 860) { x.fillText(line, W / 2, y); y += 52; line = w; } else line = t; });
    if (line) x.fillText(line, W / 2, y);
    x.fillStyle = 'rgba(255,255,255,.4)'; x.font = '600 28px system-ui, sans-serif';
    const who = (DB.getSettings().userName || '').trim();
    x.fillText(who ? `${who} · MyGymTrack` : 'MyGymTrack', W / 2, H - 50);
    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (!blob) { Utils.toast('No pude crear la imagen'); return; }
    const name = `mygymtrack-medalla-${a.id}.png`;
    const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: a.name }); } catch (e) { /* cerró la hoja */ }
      return;
    }
    const ok = await Utils.saveFile(blob, name);
    if (ok !== false) Utils.toast('Imagen guardada ✓');
  }

  function recentPRs() {
    const c = Utils.el('div', { class: 'card' });
    const wl = DB.getWorkoutLog();
    const exs = DB.getExercises();
    const rows = [];
    Object.keys(wl).sort().reverse().forEach((d) => (wl[d].exercises || []).forEach((e) => {
      const prs = (e.sets || []).filter((s) => s.pr);
      if (!prs.length) return;
      const best = prs.reduce((a, b) => (Metrics.loadOf(b) > Metrics.loadOf(a) ? b : a), prs[0]);
      rows.push({ date: d, name: (exs.find((x) => x.id === e.exerciseId) || {}).name || 'Ejercicio', set: best });
    }));
    if (!rows.length) {
      c.appendChild(Utils.el('p', { text: 'Cuando rompas un récord aparecerá aquí.' }));
      return c;
    }
    rows.slice(0, 8).forEach((r) => {
      const isCardio = r.set.duration !== undefined;
      c.appendChild(Utils.el('div', { class: 'list-item' }, [
        Utils.el('div', { style: 'min-width:0;' }, [Utils.el('div', { style: 'font-weight:700;', text: r.name }), Utils.el('div', { class: 'meta', text: Utils.friendlyDate(r.date) })]),
        Utils.el('div', { style: 'font-weight:800;color:var(--accent-light);', text: Metrics.formatSet(r.set, isCardio) }),
      ]));
    });
    return c;
  }

  return { render, openBadge };
})();
