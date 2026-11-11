/* ============================================================
   views/rewards.js — Pestaña "Logros" (en Progreso): nivel, XP,
   racha y colección de insignias.
   ============================================================ */

const RewardsView = (() => {
  function render(container) {
    container.innerHTML = '';
    const ev = Gamify.evaluate();
    const { st, lvl } = ev;
    const view = Utils.el('div', { class: 'view' });

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
    hero.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:10px;', text: `Racha: semanas seguidas con ${Gamify.MIN_WEEKLY} o más entrenos.` }));
    hero.appendChild(Utils.el('div', { class: 'lv-stats' }, [
      stat(st.sessions, 'entrenos'),
      stat(st.sets, 'series'),
      stat(st.prs, 'récords'),
      stat(`${Utils.compact(Units.fromKg(st.volume))} ${Units.current()}`, 'volumen'),
    ]));
    view.appendChild(hero);

    // ---- más cerca de desbloquear ----
    const next = ev.list.filter((a) => !a.done).sort((a, b) => b.curCapped / b.target - a.curCapped / a.target).slice(0, 3);
    if (next.length) {
      const c = Utils.el('div', { class: 'card' });
      c.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: 'Casi lo logras' }), Utils.el('span', { class: 'eyebrow', text: 'Próximos' })]));
      next.forEach((a) => c.appendChild(nextRow(a)));
      view.appendChild(c);
    }

    // ---- colección ----
    const done = ev.list.filter((a) => a.done).length;
    const coll = Utils.el('div', { class: 'card' });
    coll.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: 'Colección' }), Utils.el('span', { class: 'eyebrow', text: `${done} / ${ev.list.length}` })]));
    Gamify.CATS.forEach((cat) => {
      const items = ev.list.filter((a) => a.cat === cat);
      if (!items.length) return;
      coll.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:14px 0 8px;', text: cat }));
      const grid = Utils.el('div', { class: 'badge-grid' });
      items.forEach((a) => {
        const t = Utils.el('button', { class: 'badge-tile' + (a.done ? ' done' : ''), type: 'button' }, [
          Gamify.badgeEl(a),
          Utils.el('div', { class: 'bt-name', text: a.name }),
          a.done ? null : Utils.el('div', { class: 'bt-bar' }, [Utils.el('i', { style: `width:${Math.round((a.curCapped / a.target) * 100)}%` })]),
        ]);
        t.addEventListener('click', () => openBadge(a));
        grid.appendChild(t);
      });
      coll.appendChild(grid);
    });
    view.appendChild(coll);

    // ---- récords recientes ----
    view.appendChild(recentPRs());
    container.appendChild(view);
  }

  const stat = (v, l) => Utils.el('div', { class: 'lv-stat' }, [Utils.el('div', { class: 'v', text: String(v) }), Utils.el('div', { class: 'l', text: l })]);

  function fmtVal(a, v) {
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

  function openBadge(a) {
    const body = Utils.el('div', { class: 'unlock-body', style: 'text-align:center;' });
    body.appendChild(Utils.el('div', { style: 'display:flex;justify-content:center;margin:6px 0 12px;' }, [Gamify.badgeEl(a, true)]));
    body.appendChild(Utils.el('div', { class: 'ur-name', style: 'font-size:1.2rem;', text: a.name }));
    body.appendChild(Utils.el('p', { text: a.desc }));
    if (a.done) body.appendChild(Utils.el('div', { class: 'sm-ok', text: a.date && a.date !== 'previo' ? `✓ Desbloqueado el ${Utils.friendlyDate(a.date)}` : '✓ Ya lo tenías antes de que existieran los logros' }));
    else body.appendChild(nextRow(a));
    Modal.open('Logro', body);
  }

  function recentPRs() {
    const c = Utils.el('div', { class: 'card' });
    c.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: 'Récords recientes' }), Utils.el('span', { class: 'eyebrow', text: '🏆' })]));
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

  return { render };
})();
