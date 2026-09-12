/* ============================================================
   views/today.js — Pantalla principal "Hoy"
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

  function weekStrip(container) {
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // domingo
    const workoutLog = DB.getWorkoutLog();
    const wrap = Utils.el('div', { class: 'grid-3', style: 'grid-template-columns:repeat(7,1fr);gap:6px;' });
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      const iso = Utils.toISODate(d);
      const routine = getRoutineForDate(iso);
      const hasLog = !!(workoutLog[iso] && workoutLog[iso].exercises && workoutLog[iso].exercises.some((e) => e.sets.length));
      const isToday = iso === Utils.todayISO();
      const box = Utils.el('div', {
        class: 'stat-box' + (isToday ? '' : ''),
        style: `padding:8px 2px;${isToday ? 'outline:2px solid var(--accent);' : ''}`,
      }, [
        Utils.el('div', { class: 'lbl', text: Utils.DIAS_CORTOS[i] }),
        Utils.el('div', { style: 'font-size:1.2rem;margin:2px 0;', text: hasLog ? '✅' : (routine ? '•' : '–') }),
        Utils.el('div', { class: 'lbl', style: 'font-size:0.6rem;color:' + (routine ? routine.color : 'var(--text-dim)'), text: routine ? routine.name.split(' ')[0] : '' }),
      ]);
      wrap.appendChild(box);
    }
    container.appendChild(wrap);
  }

  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const todayIso = Utils.todayISO();
    const routine = getRoutineForDate(todayIso);
    const workoutLog = DB.getWorkoutLog();
    const log = workoutLog[todayIso];
    const hasStarted = !!log;
    const setsLogged = log ? log.exercises.reduce((n, e) => n + e.sets.length, 0) : 0;

    // ---- Card: plan de hoy ----
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: Utils.friendlyDate(todayIso) }),
      routine ? Utils.el('span', { class: 'pill', style: `color:${routine.color}`, text: routine.name }) : null,
    ]));

    if (!routine) {
      card.appendChild(Utils.el('p', { text: 'No tienes una rutina asignada para hoy en tu plan mensual.' }));
      const btnAssign = Utils.el('button', { class: 'btn-secondary btn-block', text: '📅 Asignar rutina de hoy' });
      btnAssign.addEventListener('click', () => App.navigate('plan', { focusDate: todayIso }));
      card.appendChild(btnAssign);
    } else if (routine.exercises.length === 0) {
      card.appendChild(Utils.el('p', { text: 'Día de descanso. ¡Aprovecha para recuperar! 😌' }));
    } else {
      const list = Utils.el('div');
      routine.exercises.forEach((re) => {
        const ex = DB.getExercises().find((e) => e.id === re.exerciseId);
        if (!ex) return;
        const doneSets = log ? (log.exercises.find((e) => e.exerciseId === re.exerciseId) || { sets: [] }).sets.length : 0;
        list.appendChild(Utils.el('div', { class: 'list-item' }, [
          Utils.el('span', { text: ex.name }),
          Utils.el('span', { class: 'meta', text: `${doneSets}/${re.targetSets} series · ${re.targetReps}` }),
        ]));
      });
      card.appendChild(list);

      const btn = Utils.el('button', {
        class: 'btn-primary btn-block',
        text: hasStarted ? (setsLogged > 0 ? '▶️ Continuar entrenamiento' : '▶️ Empezar a registrar') : '▶️ Iniciar entrenamiento',
      });
      btn.addEventListener('click', () => {
        if (!hasStarted) {
          const wl = DB.getWorkoutLog();
          wl[todayIso] = {
            routineId: routine.id,
            exercises: routine.exercises.map((re) => ({ exerciseId: re.exerciseId, sets: [], fromRoutine: true })),
            notes: '',
          };
          DB.saveWorkoutLog(wl);
        }
        App.navigate('workout', { date: todayIso });
      });
      card.appendChild(btn);
    }
    view.appendChild(card);

    // ---- Card: stats rápidas ----
    const calLog = DB.getCalorieLog()[todayIso] || [];
    const kcalToday = calLog.reduce((s, e) => s + e.kcal, 0);
    const settings = DB.getSettings();
    const measurements = DB.getMeasurements();
    const lastWeight = measurements.length ? measurements[measurements.length - 1].weight : null;
    const weekCount = (() => {
      const start = new Date();
      start.setDate(start.getDate() - start.getDay());
      let n = 0;
      for (let i = 0; i < 7; i++) {
        const d = new Date(start); d.setDate(start.getDate() + i);
        const iso = Utils.toISODate(d);
        const l = workoutLog[iso];
        if (l && l.exercises.some((e) => e.sets.length)) n++;
      }
      return n;
    })();

    const statsCard = Utils.el('div', { class: 'card' }, [
      Utils.el('div', { class: 'grid-3' }, [
        Utils.el('div', { class: 'stat-box' }, [
          Utils.el('div', { class: 'val', text: `${kcalToday}` }),
          Utils.el('div', { class: 'lbl', text: `kcal / ${settings.calorieGoal}` }),
        ]),
        Utils.el('div', { class: 'stat-box' }, [
          Utils.el('div', { class: 'val', text: lastWeight ? `${lastWeight}` : '–' }),
          Utils.el('div', { class: 'lbl', text: `${settings.units} peso` }),
        ]),
        Utils.el('div', { class: 'stat-box' }, [
          Utils.el('div', { class: 'val', text: `${weekCount}/7` }),
          Utils.el('div', { class: 'lbl', text: 'días entrenados' }),
        ]),
      ]),
    ]);
    view.appendChild(statsCard);

    // ---- Card: semana ----
    const weekCard = Utils.el('div', { class: 'card' });
    weekCard.appendChild(Utils.el('h3', { text: 'Esta semana' }));
    weekStrip(weekCard);
    view.appendChild(weekCard);

    // ---- Historial ----
    const histBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '🕘 Ver historial de entrenamientos' });
    histBtn.addEventListener('click', showHistory);
    view.appendChild(histBtn);

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
        const totalSets = log.exercises.reduce((s, e) => s + e.sets.length, 0);
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

  return { render, getRoutineForDate };
})();
