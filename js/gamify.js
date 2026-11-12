/* ============================================================
   gamify.js — Nivel, XP, racha semanal y logros (recompensas).
   Todo se calcula con tu historial; solo se guarda qué logros ya
   desbloqueaste (en Ajustes) para poder celebrarlos una vez.
   ============================================================ */

const Gamify = (() => {
  const MIN_WEEKLY = 2; // entrenos por semana para mantener la racha

  const weekStart = (iso) => {
    const d = Utils.parseISO(iso);
    d.setDate(d.getDate() - d.getDay());
    return Utils.toISODate(d);
  };

  // ---------------------------------------------------------------- estadísticas
  function computeStats() {
    const wl = DB.getWorkoutLog();
    const dates = [];
    let sets = 0; let volume = 0; let prs = 0;
    const exerciseIds = new Set();
    Object.keys(wl).sort().forEach((d) => {
      const log = wl[d];
      let any = false;
      (log.exercises || []).forEach((e) => {
        (e.sets || []).forEach((s) => {
          if (Metrics.isWarmup(s)) return;
          any = true;
          sets += 1;
          volume += Metrics.volumeOfSet(s);
          if (s.pr) prs += 1;
        });
        if (e.sets && e.sets.length) exerciseIds.add(e.exerciseId);
      });
      if (any) dates.push(d);
    });

    // racha semanal: semanas seguidas con al menos MIN_WEEKLY entrenos
    const perWeek = {};
    dates.forEach((d) => { const w = weekStart(d); perWeek[w] = (perWeek[w] || 0) + 1; });
    const thisWeek = weekStart(Utils.todayISO());
    const step = (iso, n) => { const d = Utils.parseISO(iso); d.setDate(d.getDate() + n * 7); return Utils.toISODate(d); };
    let cursor = (perWeek[thisWeek] || 0) >= MIN_WEEKLY ? thisWeek : step(thisWeek, -1); // la semana en curso no rompe la racha
    let streak = 0;
    while ((perWeek[cursor] || 0) >= MIN_WEEKLY) { streak += 1; cursor = step(cursor, -1); }
    let bestStreak = 0; let run = 0; let prev = null;
    Object.keys(perWeek).sort().forEach((w) => {
      if (perWeek[w] < MIN_WEEKLY) { run = 0; prev = w; return; }
      run = prev && step(prev, 1) === w && run > 0 ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
      prev = w;
    });

    // regresos: volver tras 14+ días sin entrenar
    let comebacks = 0;
    for (let i = 1; i < dates.length; i += 1) {
      if ((Utils.parseISO(dates[i]) - Utils.parseISO(dates[i - 1])) / 86400000 >= 14) comebacks += 1;
    }

    // semanas con todos los grupos en meta
    const goal = Metrics.weeklyGoal();
    let perfectWeeks = 0;
    Metrics.weeklySeries(26).forEach((w) => {
      if (Metrics.STRENGTH_GROUPS.every((g) => (w.byGroup[g] ? w.byGroup[g].sets : 0) >= goal.min)) perfectWeeks += 1;
    });

    // alimentación, agua y peso
    const cal = DB.getCalorieLog();
    const foodDays = Object.keys(cal).filter((d) => (cal[d] || []).length > 0).length;
    const water = DB.getWaterLog();
    const waterGoal = DB.getSettings().waterGoalMl || 2500;
    const waterDays = Object.keys(water).filter((d) => (water[d] || []).reduce((s, e) => s + e.ml, 0) >= waterGoal).length;
    const weighIns = DB.getMeasurements().filter((m) => m.weight).length;

    return { sessions: dates.length, sets, volume, prs, exercises: exerciseIds.size, streak, bestStreak, comebacks, perfectWeeks, foodDays, waterDays, weighIns, lastDate: dates[dates.length - 1] || null };
  }

  // ---------------------------------------------------------------- nivel
  const TITLES = [[1, 'Novato'], [3, 'Aprendiz'], [5, 'Constante'], [8, 'Atleta'], [12, 'Fuerte'], [16, 'Élite'], [20, 'Leyenda']];
  const addDays = (iso, n) => { const d = Utils.parseISO(iso); d.setDate(d.getDate() + n); return Utils.toISODate(d); };
  const baseXp = (st) => st.sessions * 100 + st.sets * 4 + st.prs * 60 + st.foodDays * 15 + st.waterDays * 10 + st.weighIns * 20 + st.streak * 50;
  function levelInfo(xp) {
    const level = 1 + Math.floor(Math.sqrt(xp / 120));
    const base = 120 * (level - 1) ** 2;
    const next = 120 * level ** 2;
    const title = TITLES.filter((t) => level >= t[0]).pop()[1];
    return { level, base, next, pct: Math.min(1, (xp - base) / (next - base)), title, toNext: Math.max(0, next - xp) };
  }

  // ---------------------------------------------------------------- logros
  // tier: 1 bronce · 2 plata · 3 oro
  const ACH = [
    { id: 'first', cat: 'Constancia', icon: '🎯', name: 'Primer paso', desc: 'Registra tu primer entrenamiento', tier: 1, target: 1, cur: (s) => s.sessions },
    { id: 's5', cat: 'Constancia', icon: '💪', name: 'En marcha', desc: '5 entrenamientos registrados', tier: 1, target: 5, cur: (s) => s.sessions },
    { id: 's10', cat: 'Constancia', icon: '📅', name: 'Hábito', desc: '10 entrenamientos registrados', tier: 1, target: 10, cur: (s) => s.sessions },
    { id: 's25', cat: 'Constancia', icon: '🔥', name: 'Constante', desc: '25 entrenamientos registrados', tier: 2, target: 25, cur: (s) => s.sessions },
    { id: 's50', cat: 'Constancia', icon: '🚀', name: 'Imparable', desc: '50 entrenamientos registrados', tier: 3, target: 50, cur: (s) => s.sessions },
    { id: 's100', cat: 'Constancia', icon: '👑', name: 'Centenario', desc: '100 entrenamientos registrados', tier: 3, target: 100, cur: (s) => s.sessions },
    { id: 'st2', cat: 'Constancia', icon: '🔗', name: 'Dos semanas', desc: '2 semanas seguidas con 2+ entrenos', tier: 1, target: 2, cur: (s) => s.bestStreak },
    { id: 'st4', cat: 'Constancia', icon: '🌋', name: 'Un mes de fuego', desc: '4 semanas seguidas con 2+ entrenos', tier: 2, target: 4, cur: (s) => s.bestStreak },
    { id: 'st8', cat: 'Constancia', icon: '⚡', name: 'Dos meses', desc: '8 semanas seguidas con 2+ entrenos', tier: 3, target: 8, cur: (s) => s.bestStreak },
    { id: 'cb', cat: 'Constancia', icon: '🔄', name: 'De vuelta', desc: 'Regresa a entrenar tras 2+ semanas parado', tier: 1, target: 1, cur: (s) => s.comebacks },
    { id: 'pr1', cat: 'Fuerza', icon: '🏆', name: 'Primer récord', desc: 'Rompe un récord personal', tier: 1, target: 1, cur: (s) => s.prs },
    { id: 'pr10', cat: 'Fuerza', icon: '🥇', name: 'Cazador de récords', desc: '10 récords personales', tier: 2, target: 10, cur: (s) => s.prs },
    { id: 'pr25', cat: 'Fuerza', icon: '💎', name: 'Máquina de PR', desc: '25 récords personales', tier: 3, target: 25, cur: (s) => s.prs },
    { id: 'pr50', cat: 'Fuerza', icon: '🌟', name: 'Leyenda de PR', desc: '50 récords personales', tier: 3, target: 50, cur: (s) => s.prs },
    { id: 'var10', cat: 'Fuerza', icon: '🧩', name: 'Variedad', desc: 'Entrena 10 ejercicios distintos', tier: 1, target: 10, cur: (s) => s.exercises },
    { id: 'var20', cat: 'Fuerza', icon: '🎛️', name: 'Completo', desc: 'Entrena 20 ejercicios distintos', tier: 2, target: 20, cur: (s) => s.exercises },
    { id: 'pw', cat: 'Fuerza', icon: '⚖️', name: 'Semana equilibrada', desc: 'Todos los grupos en meta en una semana', tier: 2, target: 1, cur: (s) => s.perfectWeeks },
    { id: 'v10', cat: 'Volumen', icon: '🏗️', name: '10 toneladas', desc: 'Mueve 10 000 kg en total', tier: 1, target: 10000, cur: (s) => s.volume },
    { id: 'v50', cat: 'Volumen', icon: '🚛', name: '50 toneladas', desc: 'Mueve 50 000 kg en total', tier: 2, target: 50000, cur: (s) => s.volume },
    { id: 'v100', cat: 'Volumen', icon: '🚢', name: '100 toneladas', desc: 'Mueve 100 000 kg en total', tier: 3, target: 100000, cur: (s) => s.volume },
    { id: 'se100', cat: 'Volumen', icon: '💯', name: 'Cien series', desc: '100 series de trabajo', tier: 1, target: 100, cur: (s) => s.sets },
    { id: 'se500', cat: 'Volumen', icon: '🔱', name: 'Quinientas series', desc: '500 series de trabajo', tier: 2, target: 500, cur: (s) => s.sets },
    { id: 'se1000', cat: 'Volumen', icon: '🌊', name: 'Mil series', desc: '1 000 series de trabajo', tier: 3, target: 1000, cur: (s) => s.sets },
    { id: 'f3', cat: 'Nutrición', icon: '🍽️', name: 'Cuenta calorías', desc: 'Registra comidas 3 días', tier: 1, target: 3, cur: (s) => s.foodDays },
    { id: 'f14', cat: 'Nutrición', icon: '🥗', name: 'Dos semanas contando', desc: 'Registra comidas 14 días', tier: 2, target: 14, cur: (s) => s.foodDays },
    { id: 'f30', cat: 'Nutrición', icon: '🍎', name: 'Nutrición pro', desc: 'Registra comidas 30 días', tier: 3, target: 30, cur: (s) => s.foodDays },
    { id: 'w7', cat: 'Nutrición', icon: '💧', name: 'Hidratado', desc: 'Cumple tu meta de agua 7 días', tier: 2, target: 7, cur: (s) => s.waterDays },
    { id: 'b4', cat: 'Cuerpo', icon: '📏', name: 'Seguimiento', desc: '4 pesajes registrados', tier: 1, target: 4, cur: (s) => s.weighIns },
    { id: 'b12', cat: 'Cuerpo', icon: '📈', name: 'Tendencia clara', desc: '12 pesajes registrados', tier: 2, target: 12, cur: (s) => s.weighIns },
  ];
  const CATS = ['Constancia', 'Fuerza', 'Volumen', 'Nutrición', 'Cuerpo'];

  function evaluate() {
    const st = computeStats();
    const saved = DB.getSettings().achievements || {};
    const list = ACH.map((a) => {
      const raw = a.cur(st);
      return Object.assign({}, a, { raw, curCapped: Math.min(raw, a.target), done: raw >= a.target, date: saved[a.id] || null });
    });
    const doneMap = DB.getSettings().challengeDone || {};
    const chXp = Object.keys(doneMap).reduce((n, k) => n + (doneMap[k] || []).length, 0) * 60;
    const xp = baseXp(st) + list.filter((a) => a.done).length * 40 + chXp;
    return { st, list, xp, lvl: levelInfo(xp) };
  }

  // ---------------------------------------------------------------- retos de la semana
  const GROUP_PREF = ['hombro', 'core', 'brazo', 'espalda', 'pecho', 'pierna'];

  function challengesFor(start) {
    const end = addDays(start, 6);
    const goal = Metrics.weeklyGoal();
    const week = Metrics.totals(start, end);
    // grupo más descuidado en las 2 semanas anteriores (se fija al empezar la semana)
    const before = Metrics.totals(addDays(start, -14), addDays(start, -1));
    let pick = 'hombro';
    if (before.sets > 0) {
      pick = GROUP_PREF.slice().sort((a, b) => ((before.byGroup[a] || { sets: 0 }).sets - (before.byGroup[b] || { sets: 0 }).sets))[0];
    }
    const list = [
      { id: `grp-${pick}`, icon: '🎯', title: `Suma ${goal.min} series de ${pick}`, target: goal.min, cur: (week.byGroup[pick] || { sets: 0 }).sets },
      { id: 'days', icon: '📅', title: 'Entrena 3 días', target: 3, cur: week.days },
    ];
    // el tercero va rotando
    const wl = DB.getWorkoutLog();
    const rot = Math.floor(Utils.parseISO(start).getTime() / 86400000 / 7) % 4;
    let prs = 0;
    Object.keys(wl).filter((d) => d >= start && d <= end).forEach((d) => (wl[d].exercises || []).forEach((e) => (e.sets || []).forEach((s) => { if (s.pr) prs += 1; })));
    const inWeek = (map, fn) => Object.keys(map).filter((d) => d >= start && d <= end && fn(map[d])).length;
    if (rot === 0) list.push({ id: 'pr', icon: '🏆', title: 'Rompe 1 récord', target: 1, cur: prs });
    else if (rot === 1) list.push({ id: 'food', icon: '🍽️', title: 'Registra tus comidas 3 días', target: 3, cur: inWeek(DB.getCalorieLog(), (l) => (l || []).length > 0) });
    else if (rot === 2) { const g = DB.getSettings().waterGoalMl || 2500; list.push({ id: 'water', icon: '💧', title: 'Cumple tu meta de agua 3 días', target: 3, cur: inWeek(DB.getWaterLog(), (l) => (l || []).reduce((n, e) => n + e.ml, 0) >= g) }); }
    else list.push({ id: 'weigh', icon: '⚖️', title: 'Pésate esta semana', target: 1, cur: DB.getMeasurements().filter((m) => m.weight && m.date >= start && m.date <= end).length });
    const saved = (DB.getSettings().challengeDone || {})[start] || [];
    return list.map((c) => Object.assign(c, { curCapped: Math.min(c.cur, c.target), done: c.cur >= c.target || saved.includes(c.id), xp: 60 }));
  }
  const currentChallenges = () => challengesFor(weekStart(Utils.todayISO()));

  // Marca logros nuevos y subidas de nivel. La primera vez solo se ponen al día en silencio.
  function check() {
    const ev = evaluate();
    const s = DB.getSettings();
    const first = !s.achievements;
    const saved = s.achievements || {};
    const fresh = [];
    ev.list.forEach((a) => {
      if (a.done && !saved[a.id]) {
        saved[a.id] = first ? 'previo' : Utils.todayISO();
        if (!first) fresh.push(a);
      }
    });
    let up = null;
    if (first || s.gLevel === undefined) s.gLevel = ev.lvl.level;
    else if (ev.lvl.level > s.gLevel) { up = { from: s.gLevel, to: ev.lvl.level }; s.gLevel = ev.lvl.level; }
    else s.gLevel = ev.lvl.level;
    s.achievements = saved;
    // retos de la semana que acaban de cumplirse
    const wkStart = weekStart(Utils.todayISO());
    const doneMap = s.challengeDone || {};
    const doneNow = doneMap[wkStart] || [];
    const newlyDone = challengesFor(wkStart).filter((c) => c.cur >= c.target && !doneNow.includes(c.id));
    if (newlyDone.length) { doneMap[wkStart] = doneNow.concat(newlyDone.map((c) => c.id)); s.challengeDone = doneMap; }
    DB.saveSettings(s);
    if (newlyDone.length) { ev.xp += newlyDone.length * 60; ev.lvl = levelInfo(ev.xp); }
    return { fresh, up, ev, challenges: newlyDone };
  }

  // XP ganado en un día concreto
  function xpOfDay(iso) {
    const log = DB.getWorkoutLog()[iso];
    if (!log) return 0;
    let sets = 0; let prs = 0;
    (log.exercises || []).forEach((e) => (e.sets || []).forEach((s) => { if (!Metrics.isWarmup(s)) { sets += 1; if (s.pr) prs += 1; } }));
    return sets ? 100 + sets * 4 + prs * 60 : 0;
  }

  // ---------------------------------------------------------------- visual
  function badgeEl(a, big) {
    const tier = a.tier === 3 ? 'gold' : a.tier === 2 ? 'silver' : 'bronze';
    return Utils.el('div', { class: `badge ${tier}${a.done ? '' : ' locked'}${big ? ' big' : ''}` }, [Utils.el('span', { text: a.icon })]);
  }

  function motionOk() {
    return !Celebrate.reducedMotion() || DB.getSettings().celebrate === true;
  }

  // ventana de celebración con los logros nuevos / subida de nivel
  function announce(res) {
    if (!res || (!res.fresh.length && !res.up && !(res.challenges || []).length)) return;
    if (document.querySelector('.modal-backdrop')) return; // no interrumpe otra ventana
    const body = Utils.el('div', { class: 'unlock-body' });
    if (res.up) {
      body.appendChild(Utils.el('div', { class: 'levelup' }, [
        Utils.el('div', { class: 'lu-num', text: String(res.up.to) }),
        Utils.el('div', {}, [Utils.el('div', { class: 'eyebrow', text: '¡Subiste de nivel!' }), Utils.el('div', { class: 'lu-title', text: `Nivel ${res.up.to} · ${res.ev.lvl.title}` })]),
      ]));
    }
    res.fresh.forEach((a) => {
      body.appendChild(Utils.el('div', { class: 'unlock-row' }, [
        badgeEl(Object.assign({}, a, { done: true }), true),
        Utils.el('div', { style: 'min-width:0;' }, [Utils.el('div', { class: 'ur-name', text: a.name }), Utils.el('div', { class: 'meta', text: a.desc })]),
      ]));
    });
    (res.challenges || []).forEach((c) => {
      body.appendChild(Utils.el('div', { class: 'unlock-row' }, [
        Utils.el('div', { class: 'badge big gold' }, [Utils.el('span', { text: c.icon })]),
        Utils.el('div', { style: 'min-width:0;' }, [Utils.el('div', { class: 'ur-name', text: '¡Reto cumplido!' }), Utils.el('div', { class: 'meta', text: `${c.title} · +60 XP` })]),
      ]));
    });
    const ok = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '¡Genial!' });
    ok.addEventListener('click', () => Modal.close());
    body.appendChild(ok);
    const view = Utils.el('button', { class: 'link-btn small', style: 'margin-top:8px;', text: 'Ver todos mis logros →' });
    view.addEventListener('click', () => { Modal.close(); App.navigate('progreso', { section: 'logros' }); });
    body.appendChild(view);
    Modal.open(res.fresh.length ? (res.fresh.length > 1 ? '🏆 ¡Logros desbloqueados!' : '🏆 ¡Logro desbloqueado!') : res.up ? '⬆️ ¡Nivel nuevo!' : '🎯 ¡Reto cumplido!', body);
    Utils.vibrate([60, 40, 60, 40, 140]);
    if (motionOk()) Celebrate.fireworks();
  }

  // resumen al terminar un entrenamiento. data: { iso, log }
  function showSummary(iso, log, done) {
    const res = check(); // logros/nivel que este entreno acaba de desbloquear
    let sets = 0; let vol = 0; let exCount = 0;
    const prList = [];
    const exs = DB.getExercises();
    (log.exercises || []).forEach((e) => {
      const work = (e.sets || []).filter((s) => !Metrics.isWarmup(s));
      if (!work.length) return;
      exCount += 1;
      sets += work.length;
      vol += work.reduce((s, x) => s + Metrics.volumeOfSet(x), 0);
      const name = (exs.find((x) => x.id === e.exerciseId) || {}).name || 'Ejercicio';
      const kinds = new Set();
      work.forEach((s) => { if (s.pr) String(s.pr).split(',').forEach((k) => kinds.add(k)); });
      if (kinds.size) prList.push({ name, kinds: [...kinds] });
    });
    if (!sets) { done(); announce(res); return; }

    const body = Utils.el('div', { class: 'summary-body' });
    body.appendChild(Utils.el('div', { class: 'sum-hero' }, [
      Utils.el('div', { class: 'sum-emoji', text: prList.length ? '🏆' : '💪' }),
      Utils.el('div', { class: 'sum-title', text: prList.length ? '¡Entreno de récords!' : '¡Entreno completado!' }),
      Utils.el('div', { class: 'small text-dim', text: Utils.friendlyDate(iso) }),
    ]));
    const tile = (val, lbl) => Utils.el('div', { class: 'stat-box' }, [Utils.el('div', { class: 'val', text: val }), Utils.el('div', { class: 'lbl', text: lbl })]);
    body.appendChild(Utils.el('div', { class: 'grid-3', style: 'margin:14px 0;' }, [
      tile(String(exCount), 'ejercicios'),
      tile(String(sets), 'series'),
      tile(`${Utils.compact(Units.fromKg(vol))} ${Units.current()}`, 'volumen'),
    ]));
    if (prList.length) {
      body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin-bottom:6px;', text: `Récords (${prList.length})` }));
      prList.forEach((p) => body.appendChild(Utils.el('div', { class: 'sum-pr' }, [Utils.el('span', { text: '🏆' }), Utils.el('span', { text: `${p.name} · ${p.kinds.map((k) => ({ peso: 'peso', reps: 'repeticiones', tiempo: 'tiempo', distancia: 'distancia' }[k] || k)).join(' y ')}` })])));
    }
    const lvl = res.ev.lvl;
    body.appendChild(Utils.el('div', { class: 'sum-xp' }, [
      Utils.el('div', { class: 'flex-between' }, [Utils.el('b', { text: `+${xpOfDay(iso)} XP` }), Utils.el('span', { class: 'small text-dim', text: `Nivel ${lvl.level} · ${lvl.title}` })]),
      Utils.el('div', { class: 'macro-bar', style: 'margin-top:8px;' }, [Utils.el('div', { class: 'macro-bar-fill', style: `width:${Math.round(lvl.pct * 100)}%;background:var(--accent-grad);` })]),
      Utils.el('div', { class: 'small text-dim', style: 'margin-top:6px;', text: `${lvl.toNext} XP para el nivel ${lvl.level + 1}${res.ev.st.streak ? ` · 🔥 racha de ${res.ev.st.streak} semana${res.ev.st.streak === 1 ? '' : 's'}` : ''}` }),
    ]));
    if (res.up) body.appendChild(Utils.el('div', { class: 'nut-hint', text: `⬆️ ¡Subiste al nivel ${res.up.to}!` }));
    if (res.fresh.length) {
      body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:12px 0 6px;', text: 'Logros desbloqueados' }));
      res.fresh.forEach((a) => body.appendChild(Utils.el('div', { class: 'unlock-row' }, [badgeEl(Object.assign({}, a, { done: true })), Utils.el('div', {}, [Utils.el('div', { class: 'ur-name', text: a.name }), Utils.el('div', { class: 'meta', text: a.desc })])])));
    }
    if ((res.challenges || []).length) {
      body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:12px 0 6px;', text: 'Retos cumplidos' }));
      res.challenges.forEach((c) => body.appendChild(Utils.el('div', { class: 'sum-pr' }, [Utils.el('span', { text: c.icon }), Utils.el('span', { text: `${c.title} · +60 XP` })])));
    }
    const go = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Continuar' });
    go.addEventListener('click', () => { Modal.close(); done(); });
    body.appendChild(go);
    Modal.open('🏁 Resumen del entreno', body, { onClose: done, dismissOnBackdrop: false });
    if ((prList.length || res.fresh.length || res.up || (res.challenges || []).length) && motionOk()) { Celebrate.fireworks(); Utils.vibrate([60, 40, 60, 40, 140]); }
  }

  return { challengesFor, currentChallenges, computeStats, evaluate, check, levelInfo, xpOfDay, announce, showSummary, badgeEl, ACH, CATS, MIN_WEEKLY };
})();
