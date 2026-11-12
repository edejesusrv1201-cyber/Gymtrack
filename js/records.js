/* ============================================================
   records.js — Línea de tiempo de récords personales.
   Recorre todo tu historial día por día y marca cada vez que
   superaste tu mejor marca: más peso, más repeticiones con un peso
   igual o mayor, más tiempo o más distancia (cardio). La primera
   vez que haces un ejercicio es solo tu punto de partida.
   ============================================================ */

const Records = (() => {
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  // Devuelve [{ date, exerciseId, name, group, kind, value, reps, weight, prev }] (más reciente primero)
  function compute() {
    const wl = DB.getWorkoutLog();
    const exs = {};
    DB.getExercises().forEach((e) => { exs[e.id] = e; });
    const dates = Object.keys(wl).sort();
    const hist = {};   // exerciseId -> sets de días anteriores
    const out = [];
    dates.forEach((d) => {
      (wl[d].exercises || []).forEach((entry) => {
        const ex = exs[entry.exerciseId];
        if (!ex) return;
        const isCardio = ex.group === 'cardio';
        const prior = hist[entry.exerciseId] || (hist[entry.exerciseId] = []);
        const day = (entry.sets || []).filter((s) => isCardio || Metrics.isNormal(s));
        if (!day.length) return;
        const base = { date: d, exerciseId: ex.id, name: ex.name, group: ex.group };
        if (prior.length) {
          if (isCardio) {
            const maxOf = (k) => prior.reduce((m, s) => Math.max(m, Number(s[k]) || 0), 0);
            const pd = maxOf('duration'); const pk = maxOf('distance');
            const bd = day.reduce((m, s) => Math.max(m, Number(s.duration) || 0), 0);
            const bk = day.reduce((m, s) => Math.max(m, Number(s.distance) || 0), 0);
            if (pd > 0 && bd > pd) out.push({ ...base, kind: 'tiempo', value: bd, prev: pd });
            if (pk > 0 && bk > pk) out.push({ ...base, kind: 'distancia', value: bk, prev: pk });
          } else {
            const prevW = prior.reduce((m, s) => Math.max(m, Metrics.loadOf(s)), 0);
            const top = day.reduce((a, b) => (Metrics.loadOf(b) > Metrics.loadOf(a) || (Metrics.loadOf(b) === Metrics.loadOf(a) && (Number(b.reps) || 0) > (Number(a.reps) || 0)) ? b : a), day[0]);
            const topW = Metrics.loadOf(top);
            if (topW > prevW) {
              out.push({ ...base, kind: 'peso', value: topW, reps: Number(top.reps) || 0, prev: prevW, bw: !!top.bw, uni: !!top.uni, e1rm: Metrics.e1rm(topW, top.reps) });
            } else {
              // más repeticiones con el mismo peso (o mayor) que antes
              let best = null;
              day.forEach((s) => {
                const w = Metrics.loadOf(s); const r = Number(s.reps) || 0;
                const prevR = prior.filter((x) => Metrics.loadOf(x) >= w).reduce((m, x) => Math.max(m, Number(x.reps) || 0), 0);
                if (prevR > 0 && r > prevR && (!best || w > best.value)) best = { ...base, kind: 'reps', value: w, reps: r, prev: prevR, bw: !!s.bw, uni: !!s.uni };
              });
              if (best) out.push(best);
            }
          }
        }
        day.forEach((s) => prior.push(s));
      });
    });
    return out.reverse();
  }

  const KIND_ICON = { peso: '🏋️', reps: '🔁', tiempo: '⏱️', distancia: '📍' };

  function describe(r) {
    if (r.kind === 'peso') return `${Units.label(r.value)} × ${r.reps}${r.uni ? ' /lado' : ''} · antes ${Units.label(r.prev)}`;
    if (r.kind === 'reps') return `${r.reps} reps con ${Units.label(r.value)} · antes ${r.prev}`;
    if (r.kind === 'tiempo') return `${Math.round(r.value)} min · antes ${Math.round(r.prev)} min`;
    return `${Utils.round1(r.value)} km · antes ${Utils.round1(r.prev)} km`;
  }

  function row(r) {
    return Utils.el('div', { class: 'rec-row' }, [
      Utils.el('div', { class: 'rec-ico', text: KIND_ICON[r.kind] || '🏆' }),
      Utils.el('div', { class: 'rec-main' }, [
        Utils.el('div', { class: 'rec-name', text: r.name }),
        Utils.el('div', { class: 'meta', text: describe(r) }),
      ]),
      Utils.el('div', { class: 'rec-date', text: Utils.shortDate(r.date) }),
    ]);
  }

  // ventana con todos los récords, con filtro por grupo muscular
  function openAll() {
    const all = compute();
    const body = Utils.el('div');
    let group = 'todos';
    const groups = ['todos'].concat(Array.from(new Set(all.map((r) => r.group))));
    const chips = Utils.el('div', { class: 'rt-chips' });
    const list = Utils.el('div', { class: 'rec-list' });
    body.appendChild(chips);
    body.appendChild(list);
    function paint() {
      chips.innerHTML = '';
      groups.forEach((g) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip${g === group ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: g === 'todos' ? 'Todos' : g });
        c.addEventListener('click', () => { group = g; paint(); });
        chips.appendChild(c);
      });
      list.innerHTML = '';
      const rows = all.filter((r) => group === 'todos' || r.group === group);
      if (!rows.length) { list.appendChild(Utils.el('p', { class: 'small text-dim', text: 'Aún no hay récords aquí.' })); return; }
      let lastMonth = '';
      rows.forEach((r) => {
        const d = Utils.parseISO(r.date);
        const m = `${MESES[d.getMonth()]} ${d.getFullYear()}`;
        if (m !== lastMonth) { lastMonth = m; list.appendChild(Utils.el('div', { class: 'eyebrow rec-month', text: m })); }
        list.appendChild(row(r));
      });
    }
    paint();
    Modal.open(`🏆 Línea de récords (${all.length})`, body);
  }

  function card() {
    const all = compute();
    const wrap = Utils.el('div', { class: 'card rec-card' });
    wrap.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: '🏆 Línea de récords' }), Utils.el('span', { class: 'small text-dim', text: all.length ? `${all.length} en total` : '' })]));
    if (!all.length) {
      wrap.appendChild(Utils.el('p', { class: 'small text-dim', text: 'Aquí aparecerán cada vez que superes tu mejor marca (más peso, más repeticiones, más tiempo o distancia). Tu primera vez con un ejercicio es el punto de partida.' }));
      return wrap;
    }
    const monthStart = Metrics.monthRange(0).start;
    const thisMonth = all.filter((r) => r.date >= monthStart).length;
    wrap.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin:-2px 0 8px;', text: thisMonth ? `${thisMonth} récord${thisMonth === 1 ? '' : 's'} este mes 🔥` : 'Aún sin récords este mes: ¡a por uno!' }));
    all.slice(0, 5).forEach((r) => wrap.appendChild(row(r)));
    if (all.length > 5) {
      const more = Utils.el('button', { class: 'btn-secondary btn-block', style: 'margin-top:8px;', text: `Ver los ${all.length} récords` });
      more.addEventListener('click', openAll);
      wrap.appendChild(more);
    }
    return wrap;
  }

  return { compute, card, openAll };
})();
