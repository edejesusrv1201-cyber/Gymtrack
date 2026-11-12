/* ============================================================
   weekly.js — Resumen semanal: cómo te fue y qué ajustar.
   ============================================================ */

const WeeklyReview = (() => {
  const r0 = (n) => Math.round(Number(n) || 0);

  // offset 0 = esta semana (domingo a sábado), -1 = la pasada
  function compute(offset) {
    const range = Metrics.weekRange(offset);
    const prevRange = Metrics.weekRange(offset - 1);
    const t = Metrics.totals(range.start, range.end);
    const p = Metrics.totals(prevRange.start, prevRange.end);
    const goal = Metrics.weeklyGoal();
    const wl = DB.getWorkoutLog();
    const exs = DB.getExercises();

    let prs = 0;
    const prNames = [];
    Object.keys(wl).filter((d) => d >= range.start && d <= range.end).forEach((d) => (wl[d].exercises || []).forEach((e) => {
      const n = (e.sets || []).filter((s) => s.pr).length;
      if (n) { prs += n; const nm = (exs.find((x) => x.id === e.exerciseId) || {}).name; if (nm && !prNames.includes(nm)) prNames.push(nm); }
    }));

    const groups = Metrics.STRENGTH_GROUPS.map((g) => ({ g, n: t.byGroup[g] ? t.byGroup[g].sets : 0 }));
    const inGoal = groups.filter((x) => x.n >= goal.min).length;
    const weakest = groups.slice().sort((a, b) => a.n - b.n).filter((x) => x.n < goal.min).slice(0, 2);

    // alimentación de la semana
    const cal = DB.getCalorieLog();
    let kcalSum = 0; let protSum = 0; let foodDays = 0;
    const water = DB.getWaterLog();
    const waterGoal = DB.getSettings().waterGoalMl || 2500;
    let waterDays = 0;
    for (let i = 0; i < 7; i += 1) {
      const d = Utils.parseISO(range.start); d.setDate(d.getDate() + i);
      const iso = Utils.toISODate(d);
      const list = cal[iso] || [];
      if (list.length) { foodDays += 1; kcalSum += list.reduce((s, e) => s + (e.kcal || 0), 0); protSum += list.reduce((s, e) => s + (e.protein || 0), 0); }
      if ((water[iso] || []).reduce((s, e) => s + e.ml, 0) >= waterGoal) waterDays += 1;
    }

    // peso: último pesaje de la semana vs el anterior
    const ms = DB.getMeasurements().filter((m) => m.weight);
    const inWeek = ms.filter((m) => m.date >= range.start && m.date <= range.end);
    let weightDelta = null;
    if (inWeek.length) {
      const lastIn = inWeek[inWeek.length - 1];
      const before = ms.filter((m) => m.date < range.start);
      if (before.length) weightDelta = Number(lastIn.weight) - Number(before[before.length - 1].weight);
    }

    const done = (DB.getSettings().challengeDone || {})[range.start] || [];
    return {
      range, offset, sessions: t.days, sets: t.sets, volume: t.volume, prevVolume: p.volume, prevSets: p.sets, prevSessions: p.days,
      prs, prNames, groups, inGoal, weakest, goal,
      foodDays, avgKcal: foodDays ? kcalSum / foodDays : 0, avgProtein: foodDays ? protSum / foodDays : 0, waterDays,
      weighedIn: inWeek.length > 0, weightDelta, challenges: done.length,
    };
  }

  // qué ajustar, en frases cortas
  function advice(w) {
    const s = DB.getSettings();
    const tips = [];
    if (w.sessions === 0) { tips.push('Esta semana no entrenaste. Empieza con una sesión corta: lo importante es volver al ritmo.'); }
    else if (w.sessions < 3) tips.push(`Entrenaste ${w.sessions} día${w.sessions === 1 ? '' : 's'}. Si puedes, apunta a 3 para progresar más rápido.`);
    else tips.push(`${w.sessions} días de entreno: ¡buen ritmo!`);
    if (w.weakest.length) tips.push(`Te faltaron series de ${w.weakest.map((x) => `${x.g} (${x.n}/${w.goal.min})`).join(' y ')}. Súmalas la próxima semana.`);
    else if (w.sets) tips.push('Todos tus grupos principales llegaron a la meta de series. 👏');
    if (w.prevVolume > 0 && w.volume > 0) {
      const pct = Math.round(((w.volume - w.prevVolume) / w.prevVolume) * 100);
      if (pct >= 5) tips.push(`Tu volumen subió ${pct}% vs la semana anterior.`);
      else if (pct <= -15) tips.push(`Tu volumen bajó ${Math.abs(pct)}% vs la semana anterior: normal si fue una semana de descanso.`);
    }
    if (w.foodDays === 0) tips.push('No registraste comidas. Con 3 días a la semana ya puedes ver tendencias.');
    else if (s.proteinGoal && w.avgProtein < s.proteinGoal * 0.8) tips.push(`Tu proteína promedio fue ${r0(w.avgProtein)} g (meta ${s.proteinGoal} g): sube un poco.`);
    if (!w.weighedIn) tips.push('No te pesaste esta semana. Un pesaje semanal basta para ver tu tendencia.');
    return tips;
  }

  function line(label, val, sub) {
    return Utils.el('div', { class: 'wr-line' }, [Utils.el('span', { text: label }), Utils.el('span', {}, [Utils.el('b', { text: val }), sub ? Utils.el('small', { text: ` ${sub}` }) : null])]);
  }

  function openModal(offset) {
    const w = compute(offset);
    const body = Utils.el('div');
    const label = offset === 0 ? 'Esta semana' : 'Semana pasada';
    body.appendChild(Utils.el('div', { class: 'eyebrow', text: `${label} · ${Utils.shortDate(w.range.start)} – ${Utils.shortDate(w.range.end)}` }));

    const tile = (v, l) => Utils.el('div', { class: 'stat-box' }, [Utils.el('div', { class: 'val', text: v }), Utils.el('div', { class: 'lbl', text: l })]);
    body.appendChild(Utils.el('div', { class: 'grid-3', style: 'margin:12px 0;' }, [tile(String(w.sessions), 'entrenos'), tile(String(w.sets), 'series'), tile(String(w.prs), 'récords')]));

    body.appendChild(line('Volumen', `${Utils.compact(Units.fromKg(w.volume))} ${Units.current()}`, w.prevVolume ? `(antes ${Utils.compact(Units.fromKg(w.prevVolume))})` : ''));
    body.appendChild(line('Grupos en meta', `${w.inGoal} de ${Metrics.STRENGTH_GROUPS.length}`, `(meta ${w.goal.min}–${w.goal.max} series)`));
    if (w.prNames.length) body.appendChild(line('Récords en', w.prNames.slice(0, 3).join(', ')));
    body.appendChild(line('Comidas registradas', `${w.foodDays} día${w.foodDays === 1 ? '' : 's'}`, w.foodDays ? `· ${r0(w.avgKcal)} kcal · ${r0(w.avgProtein)} g prot.` : ''));
    body.appendChild(line('Meta de agua', `${w.waterDays} día${w.waterDays === 1 ? '' : 's'}`));
    if (w.weightDelta !== null) body.appendChild(line('Peso', `${w.weightDelta > 0 ? '+' : ''}${Utils.round1(Units.fromKg(w.weightDelta))} ${Units.current()}`, 'vs el pesaje anterior'));
    body.appendChild(line('Retos cumplidos', `${w.challenges}`));

    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:16px 0 6px;', text: 'Qué ajustar' }));
    advice(w).forEach((t) => body.appendChild(Utils.el('div', { class: 'wr-tip', text: t })));

    const ok = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Entendido' });
    ok.addEventListener('click', () => Modal.close());
    body.appendChild(ok);
    Modal.open('📊 Resumen semanal', body);
  }

  // tarjeta para Hoy: domingo = esta semana, lunes = la pasada
  function card(rerender) {
    const dow = new Date().getDay();
    const offset = dow === 0 ? 0 : dow === 1 ? -1 : null;
    if (offset === null) return null;
    const w = compute(offset);
    if (!w.sessions && !w.foodDays) return null;
    let hidden = false;
    try { hidden = localStorage.getItem('gt_wk_dismiss') === w.range.start; } catch (e) { /* sin almacenamiento */ }
    if (hidden) return null;
    const c = Utils.el('div', { class: 'card wr-card' });
    c.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: `📊 ${offset === 0 ? 'Tu semana' : 'Tu semana pasada'}` }),
      Utils.el('button', { class: 'icon-btn', text: '✕', title: 'Ocultar', onclick: () => {
        try { localStorage.setItem('gt_wk_dismiss', w.range.start); } catch (e) { /* sin almacenamiento */ }
        rerender();
      } }),
    ]));
    c.appendChild(Utils.el('div', { class: 'small', style: 'margin-bottom:10px;', text: `${w.sessions} entreno${w.sessions === 1 ? '' : 's'} · ${w.sets} series · ${w.prs} récord${w.prs === 1 ? '' : 's'} · ${w.inGoal}/${Metrics.STRENGTH_GROUPS.length} grupos en meta` }));
    const b = Utils.el('button', { class: 'btn-secondary btn-block', text: 'Ver resumen y qué ajustar' });
    b.addEventListener('click', () => openModal(offset));
    c.appendChild(b);
    return c;
  }

  return { compute, advice, openModal, card };
})();
