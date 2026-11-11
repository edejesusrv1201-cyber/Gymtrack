/* ============================================================
   progression.js — Estimaciones de peso con el tiempo:
   · peso sugerido para hoy (progresión de cargas)
   · plan de regreso después de semanas sin entrenar
   · proyección de tu 1RM y tabla de RM (1, 3, 5, 8, 10, 12 reps)

   Todo se calcula con tu historial (1RM por Epley). Son guías:
   ajusta según cómo te sientas.
   ============================================================ */

const Progression = (() => {
  const DAY = 86400000;
  const dayNum = (iso) => Math.round(Utils.parseISO(iso).getTime() / DAY);
  const daysBetween = (a, b) => dayNum(b) - dayNum(a);

  // peso que se puede mover `reps` veces con un 1RM dado (Epley invertido)
  const weightFor = (e1, reps) => (reps <= 1 ? e1 : e1 / (1 + reps / 30));

  // cuánto baja tu fuerza tras N semanas sin entrenar (se recupera rápido: memoria muscular)
  const DETRAIN = [[0, 1], [1, 1], [2, 0.97], [3, 0.94], [4, 0.92], [6, 0.88], [8, 0.85], [12, 0.8], [16, 0.75], [26, 0.7]];
  function detrain(weeks) {
    if (weeks <= 0) return 1;
    for (let i = 1; i < DETRAIN.length; i += 1) {
      if (weeks <= DETRAIN[i][0]) {
        const [w0, f0] = DETRAIN[i - 1];
        const [w1, f1] = DETRAIN[i];
        return f0 + ((f1 - f0) * (weeks - w0)) / (w1 - w0);
      }
    }
    return DETRAIN[DETRAIN.length - 1][1];
  }

  // "8-10" -> [8, 10]; "12" -> [12, 12]
  function parseRange(text) {
    const m = String(text || '').match(/(\d+)\s*[-–]\s*(\d+)/);
    if (m) return [Number(m[1]), Number(m[2])];
    const s = String(text || '').match(/\d+/);
    if (s) return [Number(s[0]), Number(s[0])];
    return [8, 12];
  }

  // redondea una carga (kg) a los saltos "normales" de la unidad (2.5 kg / 5 lb); devuelve kg
  function roundLoad(kg, unit, small) {
    const u = unit || Units.current();
    const st = Units.step(u, !small);
    const v = Units.fromKg(kg, u);
    return Units.toKg(Math.max(0, Math.round(v / st) * st), u);
  }

  // sesiones de un ejercicio (solo series de trabajo), de la más vieja a la más nueva
  function logsFor(exId) {
    const wl = DB.getWorkoutLog();
    const out = [];
    Object.keys(wl).sort().forEach((d) => {
      const e = (wl[d].exercises || []).find((x) => x.exerciseId === exId);
      if (!e) return;
      const work = (e.sets || []).filter((s) => Metrics.isNormal(s) && s.reps);
      if (work.length) out.push({ date: d, sets: work });
    });
    return out;
  }
  const e1Of = (sets) => Math.max(...sets.map((s) => Metrics.e1rm(Metrics.loadOf(s), s.reps)));

  // 1RM "de referencia": lo mejor de tus últimas 3 sesiones
  function baseline(logs) {
    return Math.max(...logs.slice(-3).map((l) => e1Of(l.sets)));
  }

  // semanas desde tu último entreno (cualquier ejercicio)
  function gap() {
    const wl = DB.getWorkoutLog();
    const dates = Object.keys(wl).filter((d) => (wl[d].exercises || []).some((e) => e.sets && e.sets.length)).sort();
    if (!dates.length) return null;
    const last = dates[dates.length - 1];
    const days = daysBetween(last, Utils.todayISO());
    return { last, days, weeks: days / 7 };
  }

  // ---------------------------------------------------------------- peso sugerido
  // opts: { unit, range:[lo,hi], today }
  function suggest(exId, opts = {}) {
    const ex = DB.getExercises().find((e) => e.id === exId);
    if (!ex || ex.group === 'cardio' || ex.group === 'movilidad') return null;
    const logs = logsFor(exId);
    if (!logs.length) return null;
    const unit = opts.unit || Units.current();
    const [lo, hi] = opts.range || [8, 12];
    const today = opts.today || Utils.todayISO();
    const last = logs[logs.length - 1];
    const weeks = daysBetween(last.date, today) / 7;
    const bw = !!ex.bodyweight;

    // volviendo tras 2+ semanas sin este ejercicio
    if (weeks >= 2 && !bw) {
      const base = baseline(logs);
      const f = detrain(weeks);
      const reps = Math.round((lo + hi) / 2);
      return { kind: 'return', weightKg: roundLoad(weightFor(base * f, reps + 2), unit), reps: `${lo}-${hi}`, weeks: Math.round(weeks), pct: Math.round(f * 100), unit };
    }

    // progresión: mira el peso más alto de la última sesión
    const top = last.sets.reduce((a, b) => ((Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a), last.sets[0]);
    const W = Number(top.weight) || 0;
    const atTop = last.sets.filter((s) => (Number(s.weight) || 0) >= W - 1e-6);
    const reps = atTop.map((s) => Number(s.reps) || 0);
    const minReps = Math.min(...reps);
    const minStep = Units.toKg(Units.step(unit), unit);
    if (atTop.length >= 2 && minReps >= hi) {
      const inc = Math.max(minStep, roundLoad(W * 0.025, unit, true));
      return { kind: 'progress', weightKg: W === 0 ? roundLoad(inc * 2, unit) : W + inc, reps: `${lo}-${hi}`, lastReps: minReps, unit };
    }
    return { kind: 'repeat', weightKg: W, reps: `${Math.min(hi, Math.max(lo, minReps + 1))}`, lastReps: minReps, unit };
  }

  // ---------------------------------------------------------------- proyección y RM
  function projection(exId) {
    const logs = logsFor(exId);
    if (!logs.length) return null;
    const now = baseline(logs);
    const pts = logs.map((l) => ({ t: dayNum(l.date) / 7, e: e1Of(l.sets) }));
    const tLast = pts[pts.length - 1].t;
    const recent = pts.filter((p) => p.t >= tLast - 16);
    let slope = null;
    let basis = 'estimado';
    if (recent.length >= 3 && recent[recent.length - 1].t - recent[0].t >= 2) {
      const n = recent.length;
      const mt = recent.reduce((s, p) => s + p.t, 0) / n;
      const me = recent.reduce((s, p) => s + p.e, 0) / n;
      const den = recent.reduce((s, p) => s + (p.t - mt) ** 2, 0) || 1;
      const sl = recent.reduce((s, p) => s + (p.t - mt) * (p.e - me), 0) / den;
      if (sl > 0) { slope = Math.min(sl, now * 0.01); basis = 'tendencia'; }
    }
    if (slope === null) slope = now * 0.006; // ritmo conservador (≈0.6 % por semana)
    return { now, slope, basis, rows: [4, 8, 12].map((w) => ({ weeks: w, e1: now + slope * w })) };
  }

  // tabla de RM a partir de un 1RM
  function rmTable(e1) {
    return [1, 3, 5, 8, 10, 12].map((r) => ({ reps: r, kg: weightFor(e1, r) }));
  }

  // plan semana a semana para volver (peso para `reps` repeticiones con 2 en reserva)
  function returnPlan(exId, weeksOff, weeks = 6, reps = 10) {
    const logs = logsFor(exId);
    if (!logs.length) return null;
    const base = baseline(logs);
    let e = base * detrain(weeksOff);
    const out = [];
    for (let w = 1; w <= weeks; w += 1) {
      out.push({ week: w, e1: e, pct: Math.round((e / base) * 100), kg: roundLoad(weightFor(e, reps + 2)) });
      // se recupera ~4 % del máximo por semana hasta volver a tu nivel; luego +0.6 %
      e = e < base ? Math.min(base, e + base * 0.04) : e + base * 0.006;
    }
    return { base, rows: out };
  }

  // ejercicios con historial, los usados más recientemente primero
  function recentExercises(limit = 8) {
    const wl = DB.getWorkoutLog();
    const last = {};
    Object.keys(wl).sort().forEach((d) => (wl[d].exercises || []).forEach((e) => {
      if (e.sets && e.sets.some((s) => Metrics.isNormal(s) && s.reps)) last[e.exerciseId] = d;
    }));
    const exs = DB.getExercises();
    return Object.keys(last)
      .map((id) => ({ ex: exs.find((e) => e.id === id), last: last[id] }))
      .filter((x) => x.ex && x.ex.group !== 'cardio' && !x.ex.bodyweight)
      .sort((a, b) => (a.last < b.last ? 1 : -1))
      .slice(0, limit)
      .map((x) => x.ex);
  }

  // ---------------------------------------------------------------- pantallas
  const lab = (kg, unit) => `${Units.num(kg, unit)}${unit || Units.current()}`;

  // bloque que se agrega al progreso de cada ejercicio: RM, proyección y "si paras"
  function panel(ex) {
    const wrap = Utils.el('div', { class: 'prog-panel' });
    const logs = logsFor(ex.id);
    if (!logs.length || ex.group === 'cardio') return wrap;
    const rec = Metrics.exerciseRecords(ex.id, false);
    const best = rec ? rec.e1rm : baseline(logs);

    // RM
    wrap.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:18px 0 8px;', text: 'Tus RM estimados' }));
    const grid = Utils.el('div', { class: 'rm-grid' });
    rmTable(best).forEach((r) => {
      grid.appendChild(Utils.el('div', { class: 'rm-cell' }, [
        Utils.el('div', { class: 'rm-r', text: `${r.reps} RM` }),
        Utils.el('div', { class: 'rm-w', text: lab(r.kg) }),
      ]));
    });
    wrap.appendChild(grid);
    wrap.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:6px;', text: `Calculado con tu mejor 1RM estimado (${lab(best)}) por la fórmula de Epley.` }));

    // proyección
    const pr = projection(ex.id);
    if (pr) {
      wrap.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:18px 0 8px;', text: 'Hacia dónde vas' }));
      const note = pr.basis === 'tendencia'
        ? `Con tu tendencia (+${Utils.round1(Units.fromKg(pr.slope))} ${Units.current()}/semana de 1RM):`
        : 'Con un ritmo conservador (≈0.6 % por semana), porque aún hay pocos datos:';
      wrap.appendChild(Utils.el('div', { class: 'small', style: 'margin-bottom:8px;', text: note }));
      const rows = Utils.el('div', { class: 'proj-rows' });
      pr.rows.forEach((r) => {
        rows.appendChild(Utils.el('div', { class: 'proj-row' }, [
          Utils.el('span', { class: 'pj-w', text: `En ${r.weeks} semanas` }),
          Utils.el('span', { class: 'pj-v' }, [Utils.el('b', { text: lab(r.e1) }), ' de 1RM']),
          Utils.el('span', { class: 'pj-s', text: `≈ ${lab(roundLoad(weightFor(r.e1, 12)))} × 10` }),
        ]));
      });
      wrap.appendChild(rows);
    }

    // si paras unas semanas
    wrap.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:18px 0 8px;', text: 'Si pasas tiempo sin entrenar' }));
    const out = Utils.el('div', { class: 'proj-rows' });
    const seg = Utils.el('div', { class: 'seg small' });
    let sel = 4;
    const paint = () => {
      seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.w) === sel));
      out.innerHTML = '';
      const base = baseline(logs);
      const f = detrain(sel);
      const e = base * f;
      out.appendChild(Utils.el('div', { class: 'proj-row' }, [
        Utils.el('span', { class: 'pj-w', text: `Tras ${sel} semanas` }),
        Utils.el('span', { class: 'pj-v' }, [Utils.el('b', { text: lab(roundLoad(weightFor(e, 12))) }), ' × 10']),
        Utils.el('span', { class: 'pj-s', text: `≈ ${Math.round(f * 100)} % de tu mejor` }),
      ]));
      const plan = returnPlan(ex.id, sel, 4);
      if (plan) {
        out.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:6px;', text: `Para volver a tu nivel: ${plan.rows.map((r) => `sem ${r.week} ${lab(r.kg)}`).join(' → ')} (× 10).` }));
      }
    };
    [2, 4, 8, 12].forEach((w) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-w': String(w), text: `${w} sem` });
      b.addEventListener('click', () => { sel = w; paint(); });
      seg.appendChild(b);
    });
    wrap.appendChild(seg);
    wrap.appendChild(out);
    paint();
    return wrap;
  }

  // plan de regreso de todos tus ejercicios principales (se abre desde Hoy)
  function openReturnPlan(weeksOff) {
    const body = Utils.el('div');
    const g = gap();
    const wo = weeksOff || (g ? g.weeks : 4);
    body.appendChild(Utils.el('p', { class: 'small', text: `Llevas unas ${Math.round(wo)} semanas sin entrenar. Tu fuerza baja poco y vuelve rápido. Estos son pesos para ~10 repeticiones con 2 en reserva, semana a semana. Si algo se siente pesado, baja un escalón.` }));
    const list = recentExercises(8);
    if (!list.length) body.appendChild(Utils.el('p', { text: 'Aún no hay historial suficiente.' }));
    const table = Utils.el('div', { class: 'ret-table' });
    table.appendChild(Utils.el('div', { class: 'ret-row head' }, [Utils.el('span', { text: 'Ejercicio' }), ...[1, 2, 4, 6].map((w) => Utils.el('span', { text: `S${w}` }))]));
    list.forEach((ex) => {
      const plan = returnPlan(ex.id, wo, 6);
      if (!plan) return;
      const byW = (w) => plan.rows.find((r) => r.week === w);
      table.appendChild(Utils.el('div', { class: 'ret-row' }, [
        Utils.el('span', { class: 'ret-name', text: ex.name }),
        ...[1, 2, 4, 6].map((w) => Utils.el('span', { text: lab(byW(w).kg) })),
      ]));
    });
    body.appendChild(table);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: 'Semana 1–2: técnica y buen control. Semana 3–4: sube ~4 % por semana. En 4–6 semanas deberías estar de vuelta en tu nivel anterior.' }));
    Modal.open('↩ Plan de regreso', body);
  }

  return { suggest, projection, rmTable, returnPlan, recentExercises, gap, detrain, weightFor, parseRange, panel, openReturnPlan, logsFor };
})();
