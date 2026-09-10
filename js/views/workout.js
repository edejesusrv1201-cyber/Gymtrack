/* ============================================================
   views/workout.js — Registro de entrenamiento de un día
   (pesos, repeticiones, si costó o no) + acceso al cronómetro
   ============================================================ */

const WorkoutView = (() => {
  const FELT_OPTIONS = [
    { key: 'facil', icon: '😃', label: 'Fácil' },
    { key: 'normal', icon: '🙂', label: 'Normal' },
    { key: 'dificil', icon: '😖', label: 'Costó' },
    { key: 'fallo', icon: '❌', label: 'Fallé' },
  ];

  function getLog(iso) {
    const wl = DB.getWorkoutLog();
    return wl[iso];
  }
  function saveLog(iso, log) {
    const wl = DB.getWorkoutLog();
    wl[iso] = log;
    DB.saveWorkoutLog(wl);
  }

  function previousBest(exerciseId, beforeIso) {
    const wl = DB.getWorkoutLog();
    const dates = Object.keys(wl).filter((d) => d < beforeIso).sort((a, b) => (a < b ? 1 : -1));
    for (const d of dates) {
      const entry = wl[d].exercises.find((e) => e.exerciseId === exerciseId);
      if (entry && entry.sets.length) {
        const best = entry.sets.reduce((a, b) => (b.weight > a.weight ? b : a), entry.sets[0]);
        return { date: d, best, count: entry.sets.length };
      }
    }
    return null;
  }

  function render(root, params) {
    const iso = (params && params.date) || Utils.todayISO();
    let log = getLog(iso);
    if (!log) {
      log = { routineId: null, exercises: [], notes: '' };
      saveLog(iso, log);
    }
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;

    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });

    view.appendChild(Utils.el('div', { class: 'card' }, [
      Utils.el('div', { class: 'flex-between' }, [
        Utils.el('h3', { class: 'mb-0', text: Utils.friendlyDate(iso) }),
        routine ? Utils.el('span', { class: 'pill', style: `color:${routine.color}`, text: routine.name }) : Utils.el('span', { class: 'pill', text: 'Libre' }),
      ]),
    ]));

    const exList = Utils.el('div');
    log.exercises.forEach((entry, idx) => exList.appendChild(renderExerciseCard(iso, log, entry, idx)));
    view.appendChild(exList);

    const addExBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '➕ Agregar ejercicio' });
    addExBtn.addEventListener('click', () => openAddExercise(iso, log, () => render(root, params)));
    view.appendChild(addExBtn);

    const notesCard = Utils.el('div', { class: 'card' });
    notesCard.appendChild(Utils.el('h3', { text: 'Notas del día' }));
    const notesArea = Utils.el('textarea', { rows: 2, placeholder: '¿Cómo te sentiste hoy?' });
    notesArea.value = log.notes || '';
    notesArea.addEventListener('change', () => { log.notes = notesArea.value; saveLog(iso, log); });
    notesCard.appendChild(notesArea);
    view.appendChild(notesCard);

    const timerBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '⏱ Abrir cronómetro de descanso' });
    timerBtn.addEventListener('click', () => document.getElementById('restFab').click());
    view.appendChild(timerBtn);

    root.appendChild(view);
  }

  function renderExerciseCard(iso, log, entry, idx) {
    const ex = DB.getExercises().find((e) => e.id === entry.exerciseId);
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    const target = routine ? routine.exercises.find((re) => re.exerciseId === entry.exerciseId) : null;
    const settings = DB.getSettings();

    const card = Utils.el('div', { class: 'card exercise-card' });
    card.appendChild(Utils.el('div', { class: 'ex-header' }, [
      Utils.el('h3', { class: 'mb-0', text: ex ? ex.name : '(ejercicio eliminado)' }),
      Utils.el('button', { class: 'icon-btn', text: '🗑️', onclick: () => {
        if (!Utils.confirmDialog('¿Quitar este ejercicio del día?')) return;
        log.exercises.splice(idx, 1);
        saveLog(iso, log);
        render(document.getElementById('viewRoot'), { date: iso });
      } }),
    ]));
    if (target) card.appendChild(Utils.el('div', { class: 'ex-target', text: `Meta: ${target.targetSets} series · ${target.targetReps}` }));

    const prev = ex ? previousBest(ex.id, iso) : null;
    if (prev) {
      card.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: `Última vez (${Utils.friendlyDate(prev.date)}): ${prev.best.weight}${settings.units} × ${prev.best.reps} reps` }));
    }

    const setsWrap = Utils.el('div', { class: 'mt-8' });
    entry.sets.forEach((set, sIdx) => {
      const feltOpt = FELT_OPTIONS.find((f) => f.key === set.felt) || FELT_OPTIONS[1];
      const row = Utils.el('div', { class: 'list-item' }, [
        Utils.el('span', { text: `#${sIdx + 1}` }),
        Utils.el('span', { text: `${set.weight}${settings.units} × ${set.reps}` }),
        Utils.el('span', { text: `${feltOpt.icon} ${feltOpt.label}` }),
        Utils.el('button', { class: 'icon-btn', text: '✕', onclick: () => {
          entry.sets.splice(sIdx, 1);
          saveLog(iso, log);
          render(document.getElementById('viewRoot'), { date: iso });
        } }),
      ]);
      setsWrap.appendChild(row);
    });
    card.appendChild(setsWrap);

    // formulario para nueva serie
    const form = Utils.el('div', { class: 'mt-8' });
    const lastSet = entry.sets[entry.sets.length - 1];
    const weightInput = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: `Peso (${settings.units})`, step: '0.5' });
    const repsInput = Utils.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'Repeticiones' });
    if (lastSet) { weightInput.value = lastSet.weight; }
    else if (prev) { weightInput.value = prev.best.weight; }

    let feltSelected = 'normal';
    const feltRow = Utils.el('div', { class: 'felt-select mt-8' });
    FELT_OPTIONS.forEach((f) => {
      const b = Utils.el('button', { class: 'felt-btn' + (f.key === feltSelected ? ' selected' : ''), title: f.label, type: 'button' }, [
        Utils.el('div', { text: f.icon }),
      ]);
      b.addEventListener('click', () => {
        feltSelected = f.key;
        feltRow.querySelectorAll('.felt-btn').forEach((n) => n.classList.remove('selected'));
        b.classList.add('selected');
      });
      feltRow.appendChild(b);
    });

    form.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [weightInput]),
      Utils.el('div', { class: 'field' }, [repsInput]),
    ]));
    form.appendChild(feltRow);

    const addSetBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '✓ Registrar serie e iniciar descanso' });
    addSetBtn.addEventListener('click', () => {
      const weight = parseFloat(weightInput.value);
      const reps = parseInt(repsInput.value, 10);
      if (isNaN(weight) || isNaN(reps) || reps <= 0) {
        Utils.toast('Ingresa peso y repeticiones válidas');
        return;
      }
      entry.sets.push({ weight, reps, felt: feltSelected });
      saveLog(iso, log);
      Utils.vibrate(40);
      RestTimer.quickStart(DB.getSettings().restDefault);
      render(document.getElementById('viewRoot'), { date: iso });
    });
    form.appendChild(addSetBtn);
    card.appendChild(form);

    return card;
  }

  function openAddExercise(iso, log, onDone) {
    const body = Utils.el('div');
    const existingIds = new Set(log.exercises.map((e) => e.exerciseId));
    const groups = {};
    DB.getExercises().forEach((ex) => {
      if (existingIds.has(ex.id)) return;
      (groups[ex.group] = groups[ex.group] || []).push(ex);
    });
    Object.keys(groups).forEach((g) => {
      body.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: g.toUpperCase() }));
      groups[g].forEach((ex) => {
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('span', { text: ex.name }),
          Utils.el('button', { class: 'btn-small', text: '+' }),
        ]);
        row.querySelector('button').addEventListener('click', () => {
          log.exercises.push({ exerciseId: ex.id, sets: [] });
          saveLog(iso, log);
          Modal.close();
          onDone();
        });
        body.appendChild(row);
      });
    });
    if (Object.keys(groups).length === 0) {
      body.appendChild(Utils.el('p', { text: 'Ya agregaste todos los ejercicios de tu catálogo. Crea uno nuevo en "Más → Ejercicios".' }));
    }
    Modal.open('Agregar ejercicio', body);
  }

  return { render };
})();
