/* ============================================================
   views/today.js — Pantalla principal "Hoy"
   Una tarjeta principal (rutina, progreso y botón de acción),
   ejercicios tocables, accesos rápidos y la semana interactiva.
   ============================================================ */

const TodayView = (() => {
  function getRoutineForDate(iso) {
    const d = Utils.parseISO(iso);
    const mk = Utils.monthKey(d);
    const plans = DB.getMonthlyPlans();
    const plan = plans[mk];
    if (!plan) return null;
    const routineId = plan.days[String(d.getDate())];
    if (!routineId) return null;
    return DB.getRoutines().find((r) => r.id === routineId) || null;
  }

  // crea el entrenamiento del día si todavía no existe
  function ensureLog(iso, routine) {
    const wl = DB.getWorkoutLog();
    if (!wl[iso]) {
      wl[iso] = {
        routineId: routine ? routine.id : null,
        exercises: routine ? routine.exercises.map((re) => ({ exerciseId: re.exerciseId, sets: [], fromRoutine: true })) : [],
        notes: '',
      };
      DB.saveWorkoutLog(wl);
    }
    return wl[iso];
  }

  const workingSets = (entry) => entry.sets.filter(Metrics.isNormal).length;
  const routineTotalSets = (r) => r.exercises.reduce((s, re) => s + (Number(re.targetSets) || 0), 0);

  // ---------- selector de rutina (hoja inferior) ----------
  function openRoutinePicker(iso, onDone) {
    const body = Utils.el('div');
    const current = getRoutineForDate(iso);
    body.appendChild(Utils.el('p', { text: `${Utils.friendlyDate(iso)}. Se actualiza en tu plan y en el entrenamiento de ese día.` }));
    DB.getRoutines().forEach((r) => {
      const isCurrent = !!(current && current.id === r.id);
      const sub = r.exercises.length === 0 ? 'Día de descanso' : `${r.exercises.length} ejercicios · ${routineTotalSets(r)} series`;
      const row = Utils.el('button', { class: 'pick-row' + (isCurrent ? ' current' : ''), type: 'button' }, [
        Utils.el('span', { class: 'bar', style: `background:${r.color}` }),
        Utils.el('span', { class: 'pk-main' }, [
          Utils.el('div', { class: 'pk-name', text: r.name }),
          Utils.el('div', { class: 'pk-sub', text: sub }),
        ]),
        isCurrent ? Utils.el('span', { class: 'check-badge', text: '✓' }) : null,
      ]);
      row.addEventListener('click', () => {
        DB.setPlannedRoutine(iso, r.id);
        Modal.close();
        Utils.toast(`${r.name} asignada`);
        if (onDone) onDone();
      });
      body.appendChild(row);
    });
    if (current) {
      const clear = Utils.el('button', { class: 'btn-secondary btn-block', text: 'Quitar rutina de este día' });
      clear.addEventListener('click', () => {
        DB.setPlannedRoutine(iso, null);
        Modal.close();
        if (onDone) onDone();
      });
      body.appendChild(clear);
    }
    Modal.open('Rutina del día', body);
  }

  // ---------- hoja de un día de la semana ----------
  function openDaySheet(iso, onDone) {
    const routine = getRoutineForDate(iso);
    const log = DB.getWorkoutLog()[iso];
    const hasSets = !!(log && log.exercises.some((e) => e.sets.length));
    const body = Utils.el('div');
    body.appendChild(Utils.el('div', { class: 'flex-between', style: 'margin-bottom:12px;' }, [
      Utils.el('span', { class: 'pill', style: routine ? `color:${routine.color}` : '', text: routine ? routine.name : 'Sin rutina' }),
      hasSets ? Utils.el('span', { class: 'pill', style: 'color:var(--green)', text: '✓ Entrenado' }) : null,
    ]));

    const openBtn = Utils.el('button', {
      class: 'btn-primary',
      text: hasSets ? 'Ver entrenamiento' : (routine && routine.exercises.length ? '▶ Entrenar este día' : 'Entrenar libre'),
    });
    openBtn.addEventListener('click', () => {
      ensureLog(iso, routine);
      Modal.close();
      App.navigate('workout', { date: iso });
    });
    body.appendChild(openBtn);

    const changeBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '🔁 Cambiar rutina de este día' });
    changeBtn.addEventListener('click', () => { Modal.close(); openRoutinePicker(iso, onDone); });
    body.appendChild(changeBtn);

    Modal.open(Utils.friendlyDate(iso), body);
  }

  // ---------- tarjeta principal ----------
  function renderHero(todayIso, routine, log, rerender) {
    const hero = Utils.el('div', { class: 'hero' });
    const hasSets = !!(log && log.exercises.some((e) => e.sets.length));
    const dateLabel = `${Utils.DIAS[Utils.parseISO(todayIso).getDay()]} ${Utils.shortDate(todayIso)}`;

    const top = Utils.el('div', { class: 'hero-top' }, [
      Utils.el('span', { class: 'eyebrow', text: `Hoy · ${dateLabel}` }),
    ]);
    const changeChip = Utils.el('button', { class: 'chip-btn', type: 'button', text: routine ? '🔁 Cambiar' : '📅 Elegir' });
    changeChip.addEventListener('click', () => openRoutinePicker(todayIso, rerender));
    top.appendChild(changeChip);
    hero.appendChild(top);

    // --- sin rutina asignada ---
    if (!routine) {
      hero.appendChild(Utils.el('div', { class: 'hero-body' }, [
        Utils.el('div', {}, [
          Utils.el('h2', { class: 'hero-title', text: 'Sin rutina hoy' }),
          Utils.el('p', { class: 'hero-sub', text: 'Elige una y arrancamos.' }),
        ]),
      ]));
      const chips = Utils.el('div', { style: 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;' });
      DB.getRoutines().filter((r) => r.exercises.length > 0).slice(0, 6).forEach((r) => {
        const c = Utils.el('button', { class: 'chip-btn', type: 'button', style: `color:${r.color}`, text: r.name });
        c.addEventListener('click', () => { DB.setPlannedRoutine(todayIso, r.id); rerender(); });
        chips.appendChild(c);
      });
      hero.appendChild(chips);
      const free = Utils.el('button', { class: 'btn-secondary', text: 'Entrenar libre (sin rutina)' });
      free.addEventListener('click', () => { ensureLog(todayIso, null); App.navigate('workout', { date: todayIso }); });
      hero.appendChild(free);
      return hero;
    }

    hero.style.setProperty('--hero-glow', `${routine.color}47`);

    // --- día de descanso ---
    if (routine.exercises.length === 0) {
      hero.appendChild(Utils.el('div', { class: 'hero-body' }, [
        Utils.el('div', {}, [
          Utils.el('h2', { class: 'hero-title', text: routine.name }),
          Utils.el('p', { class: 'hero-sub', text: 'Recupera: duerme bien, hidrátate y estira suave.' }),
        ]),
        Utils.el('div', { style: 'font-size:2.6rem;', text: '😴' }),
      ]));
      const pick = Utils.el('button', { class: 'btn-primary', text: 'Elegir otra rutina para hoy' });
      pick.addEventListener('click', () => openRoutinePicker(todayIso, rerender));
      hero.appendChild(pick);
      const free = Utils.el('button', { class: 'btn-secondary btn-block', text: 'Entrenar libre de todos modos' });
      free.addEventListener('click', () => { ensureLog(todayIso, routine); App.navigate('workout', { date: todayIso }); });
      hero.appendChild(free);
      return hero;
    }

    // --- rutina con ejercicios ---
    const total = routineTotalSets(routine);
    const done = routine.exercises.reduce((s, re) => {
      const e = log && log.exercises.find((x) => x.exerciseId === re.exerciseId);
      return s + Math.min(e ? workingSets(e) : 0, Number(re.targetSets) || 0);
    }, 0);
    const pct = total ? done / total : 0;

    hero.appendChild(Utils.el('div', { class: 'hero-body' }, [
      Utils.el('div', { style: 'min-width:0;' }, [
        Utils.el('h2', { class: 'hero-title', style: `color:${routine.color}`, text: routine.name }),
        Utils.el('p', { class: 'hero-sub', text: `${routine.exercises.length} ejercicios · ${total} series · ~${Math.round(total * 2.5)} min` }),
      ]),
      Utils.ring(pct, { size: 84, stroke: 9, label: `${Math.round(pct * 100)}%`, sub: `${done}/${total}` }),
    ]));

    const cta = Utils.el('button', {
      class: 'btn-primary',
      text: pct >= 1 ? '✓ Completo · ver entrenamiento' : hasSets ? `▶ Continuar · ${done}/${total} series` : '▶ Iniciar entrenamiento',
    });
    cta.addEventListener('click', () => {
      ensureLog(todayIso, routine);
      App.navigate('workout', { date: todayIso });
    });
    hero.appendChild(cta);
    return hero;
  }

  // ---------- lista de ejercicios del día (tocables) ----------
  function renderExerciseList(todayIso, routine, log) {
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: 'Ejercicios de hoy' }),
      Utils.el('span', { class: 'eyebrow', text: 'Toca para registrar' }),
    ]));
    const byId = {};
    DB.getExercises().forEach((e) => { byId[e.id] = e; });

    function row(exerciseId, target, doneN, extra) {
      const ex = byId[exerciseId];
      if (!ex) return null;
      const t = Number(target && target.targetSets) || 0;
      const complete = t > 0 && doneN >= t;
      let marker;
      if (complete) marker = Utils.el('span', { class: 'check-badge', text: '✓' });
      else if (t > 0 && t <= 6) {
        marker = Utils.el('div', { class: 'dots' }, Array.from({ length: t }, (_, i) => Utils.el('span', { class: i < doneN ? 'on' : '' })));
      } else marker = Utils.el('span', { class: 'counter-chip', text: t ? `${doneN}/${t}` : `${doneN}` });
      const r = Utils.el('div', { class: 'ex-row' }, [
        Utils.el('div', { class: 'ex-main' }, [
          Utils.el('div', { class: 'ex-name', text: ex.name }),
          Utils.el('div', { class: 'ex-meta', text: extra || `${t}×${target.targetReps}` }),
        ]),
        marker,
        Utils.el('span', { class: 'go', text: '›' }),
      ]);
      r.addEventListener('click', () => {
        ensureLog(todayIso, routine);
        App.navigate('workout', { date: todayIso, focus: exerciseId });
      });
      return r;
    }

    const shown = new Set();
    routine.exercises.forEach((re) => {
      const entry = log && log.exercises.find((e) => e.exerciseId === re.exerciseId);
      const r = row(re.exerciseId, re, entry ? workingSets(entry) : 0);
      if (r) { card.appendChild(r); shown.add(re.exerciseId); }
    });
    if (log) {
      log.exercises.forEach((e) => {
        if (shown.has(e.exerciseId) || e.sets.length === 0) return;
        const r = row(e.exerciseId, null, workingSets(e), 'Extra · fuera de la rutina');
        if (r) card.appendChild(r);
      });
    }
    return card;
  }

  // ---------- semana interactiva ----------
  function renderWeek(workoutLog, rerender) {
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: 'Esta semana' }),
      Utils.el('span', { class: 'eyebrow', text: 'Toca un día' }),
    ]));
    const wrap = Utils.el('div', { class: 'week-strip' });
    const today = new Date();
    const todayIso = Utils.todayISO();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay());
    for (let i = 0; i < 7; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      const iso = Utils.toISODate(d);
      const routine = getRoutineForDate(iso);
      const hasLog = !!(workoutLog[iso] && workoutLog[iso].exercises.some((e) => e.sets.length));
      const dayEl = Utils.el('div', { class: 'week-day' + (iso === todayIso ? ' today' : '') + (hasLog ? ' done' : '') }, [
        Utils.el('div', { class: 'wd', text: Utils.DIAS_CORTOS[i] }),
        Utils.el('div', { class: 'wn', text: String(d.getDate()) }),
        Utils.el('div', { class: 'wr', style: hasLog ? 'background:var(--green)' : routine ? `background:${routine.color}` : '' }),
      ]);
      dayEl.addEventListener('click', () => openDaySheet(iso, rerender));
      wrap.appendChild(dayEl);
    }
    card.appendChild(wrap);
    return card;
  }

  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const todayIso = Utils.todayISO();
    const routine = getRoutineForDate(todayIso);
    const workoutLog = DB.getWorkoutLog();
    const log = workoutLog[todayIso];
    const settings = DB.getSettings();
    const rerender = () => render(root);

    view.appendChild(renderHero(todayIso, routine, log, rerender));
    if (routine && routine.exercises.length > 0) view.appendChild(renderExerciseList(todayIso, routine, log));

    // ---- accesos rápidos: calorías, agua, semana ----
    const kcalToday = (DB.getCalorieLog()[todayIso] || []).reduce((s, e) => s + e.kcal, 0);
    const waterMl = (DB.getWaterLog()[todayIso] || []).reduce((s, e) => s + e.ml, 0);
    const waterGoal = settings.waterGoalMl || 2500;
    const wk = Metrics.weekRange(0);
    const weekDays = Metrics.totals(wk.start, wk.end).days;

    function tile(label, value, sub, pct, color, target) {
      const t = Utils.el('button', { class: 'tile', type: 'button' }, [
        Utils.el('div', { class: 'eyebrow', text: label }),
        Utils.el('div', { class: 'tile-val', text: value }),
        Utils.el('div', { class: 'tile-sub', text: sub }),
        Utils.el('div', { class: 'tile-bar' }, [Utils.el('div', { style: `width:${Math.min(100, Math.round(pct * 100))}%;background:${color}` })]),
      ]);
      t.addEventListener('click', () => App.navigate(target.view, target.params || {}));
      return t;
    }
    view.appendChild(Utils.el('div', { class: 'tiles' }, [
      tile('Calorías', `${Math.round(kcalToday)}`, `de ${settings.calorieGoal} kcal`, kcalToday / (settings.calorieGoal || 1), 'linear-gradient(90deg,#ff5a36,#ffb347)', { view: 'calorias' }),
      tile('Agua', `${Utils.round1(waterMl / 1000)} L`, `de ${Utils.round1(waterGoal / 1000)} L`, waterMl / waterGoal, 'linear-gradient(90deg,#5b8cff,#3de0c2)', { view: 'calorias' }),
      tile('Semana', `${weekDays}`, weekDays === 1 ? 'día entrenado' : 'días entrenados', weekDays / 5, 'linear-gradient(90deg,#35d49a,#3de0c2)', { view: 'progreso', params: { section: 'entreno' } }),
    ]));

    view.appendChild(renderWeek(workoutLog, rerender));

    const hist = Utils.el('button', { class: 'btn-secondary', text: '🕘 Historial' });
    hist.addEventListener('click', showHistory);
    const stats = Utils.el('button', { class: 'btn-secondary', text: '📊 Estadísticas' });
    stats.addEventListener('click', () => App.navigate('progreso', { section: 'entreno' }));
    view.appendChild(Utils.el('div', { class: 'grid-2' }, [hist, stats]));

    root.appendChild(view);
  }

  function showHistory() {
    const workoutLog = DB.getWorkoutLog();
    const dates = Object.keys(workoutLog)
      .filter((d) => workoutLog[d].exercises.some((e) => e.sets.length))
      .sort((a, b) => (a < b ? 1 : -1));

    const body = Utils.el('div');
    if (dates.length === 0) {
      body.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { class: 'icon', text: '🗒️' }),
        Utils.el('div', { text: 'Aún no has registrado entrenamientos.' }),
      ]));
    } else {
      dates.forEach((iso) => {
        const log = workoutLog[iso];
        const routine = DB.getRoutines().find((r) => r.id === log.routineId);
        const totalSets = log.exercises.reduce((s, e) => s + e.sets.filter((x) => !Metrics.isWarmup(x)).length, 0);
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: Utils.friendlyDate(iso) }),
            Utils.el('div', { class: 'meta', text: `${routine ? routine.name : 'Libre'} · ${totalSets} series` }),
          ]),
          Utils.el('button', { class: 'btn-small', text: 'Ver' }),
        ]);
        row.querySelector('button').addEventListener('click', () => {
          Modal.close();
          App.navigate('workout', { date: iso });
        });
        body.appendChild(row);
      });
    }
    Modal.open('Historial de entrenamientos', body);
  }

  return { render, getRoutineForDate, ensureLog, openRoutinePicker, openDaySheet };
})();
