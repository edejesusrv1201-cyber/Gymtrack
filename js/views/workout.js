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

  // ejercicios agregados al día que el usuario ya expandió para registrar
  // (además de los que ya tienen al menos una serie, que siempre se muestran expandidos)
  const expandedSet = new Set();

  function getLog(iso) {
    const wl = DB.getWorkoutLog();
    return wl[iso];
  }
  function saveLog(iso, log) {
    const wl = DB.getWorkoutLog();
    wl[iso] = log;
    DB.saveWorkoutLog(wl);
  }

  // mantiene el día sincronizado si la rutina cambió de ejercicios después
  // de haber "iniciado" el entrenamiento: solo toca lo que aún no tiene
  // ninguna serie registrada, así nunca se pierde lo que ya hiciste.
  function syncRoutineExercises(log, routine) {
    if (!routine) return false;
    let changed = false;
    const routineIds = new Set(routine.exercises.map((re) => re.exerciseId));
    const before = log.exercises.length;
    log.exercises = log.exercises.filter((e) => !(e.fromRoutine && e.sets.length === 0 && !routineIds.has(e.exerciseId)));
    if (log.exercises.length !== before) changed = true;
    const presentIds = new Set(log.exercises.map((e) => e.exerciseId));
    routine.exercises.forEach((re) => {
      if (!presentIds.has(re.exerciseId)) {
        log.exercises.push({ exerciseId: re.exerciseId, sets: [], fromRoutine: true });
        presentIds.add(re.exerciseId);
        changed = true;
      }
    });
    return changed;
  }

  // ---- récord histórico (máximo y mínimo) para servir de guía al entrenar ----
  function exerciseRecords(exerciseId, isCardio) {
    const wl = DB.getWorkoutLog();
    let max = null;
    let min = null;
    Object.keys(wl).forEach((d) => {
      const entry = wl[d].exercises.find((e) => e.exerciseId === exerciseId);
      if (!entry) return;
      entry.sets.forEach((set) => {
        const value = isCardio ? set.duration : set.weight;
        if (value === undefined || value === null) return;
        if (!max || value > (isCardio ? max.set.duration : max.set.weight)) max = { set, date: d };
        if (!min || value < (isCardio ? min.set.duration : min.set.weight)) min = { set, date: d };
      });
    });
    if (!max) return null;
    return { max, min };
  }

  function formatRecordSet(set, isCardio, units) {
    return isCardio
      ? `${set.duration} min${set.distance ? ` · ${set.distance} km` : ''}`
      : `${set.weight}${units} × ${set.reps}`;
  }

  function previousBest(exerciseId, beforeIso, isCardio) {
    const wl = DB.getWorkoutLog();
    const dates = Object.keys(wl).filter((d) => d < beforeIso).sort((a, b) => (a < b ? 1 : -1));
    for (const d of dates) {
      const entry = wl[d].exercises.find((e) => e.exerciseId === exerciseId);
      if (entry && entry.sets.length) {
        const best = isCardio
          ? entry.sets.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a), entry.sets[0])
          : entry.sets.reduce((a, b) => (b.weight > a.weight ? b : a), entry.sets[0]);
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
    if (syncRoutineExercises(log, routine)) saveLog(iso, log);

    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });

    view.appendChild(Utils.el('div', { class: 'card' }, [
      Utils.el('div', { class: 'flex-between' }, [
        Utils.el('h3', { class: 'mb-0', text: Utils.friendlyDate(iso) }),
        routine ? Utils.el('span', { class: 'pill', style: `color:${routine.color}`, text: routine.name }) : Utils.el('span', { class: 'pill', text: 'Libre' }),
      ]),
    ]));

    view.appendChild(renderWarmupCard(iso, log));

    const exList = Utils.el('div');
    const pendingItems = Utils.el('div');
    let pendingCount = 0;
    log.exercises.forEach((entry, idx) => {
      const key = `${iso}:${entry.exerciseId}`;
      const isExpanded = entry.sets.length > 0 || expandedSet.has(key);
      if (isExpanded) {
        exList.appendChild(renderExerciseCard(iso, log, entry, idx));
      } else {
        pendingCount += 1;
        pendingItems.appendChild(renderPendingRow(iso, log, entry, key, () => render(root, params)));
      }
    });
    view.appendChild(exList);

    if (pendingCount > 0) {
      const pendingCard = Utils.el('div', { class: 'card' });
      pendingCard.appendChild(Utils.el('h3', { text: '📋 Pendientes de hoy' }));
      pendingCard.appendChild(pendingItems);
      view.appendChild(pendingCard);
    }

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

    if (log.exercises.length > 0) {
      const finishBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '🏁 Finalizar entrenamiento' });
      finishBtn.addEventListener('click', () => {
        const before = log.exercises.length;
        log.exercises = log.exercises.filter((e) => e.sets.length > 0);
        const removed = before - log.exercises.length;
        saveLog(iso, log);
        Utils.toast(removed > 0
          ? `Entrenamiento guardado · se quitaron ${removed} ejercicio${removed === 1 ? '' : 's'} sin registro`
          : 'Entrenamiento guardado');
        App.navigate('hoy');
      });
      view.appendChild(finishBtn);
    }

    root.appendChild(view);
  }

  function renderExerciseCard(iso, log, entry, idx) {
    const ex = DB.getExercises().find((e) => e.id === entry.exerciseId);
    const isCardio = !!(ex && ex.group === 'cardio');
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    const target = routine ? routine.exercises.find((re) => re.exerciseId === entry.exerciseId) : null;
    const settings = DB.getSettings();

    const card = Utils.el('div', { class: 'card exercise-card' });
    const headerBtns = Utils.el('div', { style: 'display:flex;gap:4px;' }, [
      ex ? Utils.el('button', { class: 'icon-btn', text: '📈', title: 'Ver progreso', onclick: () => openProgressModal(ex, isCardio) }) : null,
      Utils.el('button', { class: 'icon-btn', text: '🗑️', onclick: () => {
        if (!Utils.confirmDialog('¿Quitar este ejercicio del día?')) return;
        log.exercises.splice(idx, 1);
        saveLog(iso, log);
        render(document.getElementById('viewRoot'), { date: iso });
      } }),
    ]);
    card.appendChild(Utils.el('div', { class: 'ex-header' }, [
      Utils.el('h3', { class: 'mb-0', text: ex ? ex.name : '(ejercicio eliminado)' }),
      headerBtns,
    ]));
    if (target) {
      const done = entry.sets.length;
      const complete = done >= target.targetSets;
      card.appendChild(Utils.el('div', {
        class: 'ex-target',
        style: complete ? 'color:var(--green);font-weight:700;' : '',
        text: `${done} de ${target.targetSets} series · ${target.targetReps}${complete ? ' ✓' : ''}`,
      }));
    } else if (entry.sets.length > 0) {
      card.appendChild(Utils.el('div', { class: 'ex-target', text: `${entry.sets.length} serie${entry.sets.length === 1 ? '' : 's'} registrada${entry.sets.length === 1 ? '' : 's'}` }));
    }

    const records = ex ? exerciseRecords(ex.id, isCardio) : null;
    if (records) {
      const sameSet = records.max.date === records.min.date && records.max.set === records.min.set;
      const recordText = sameSet
        ? `🏆 Récord: ${formatRecordSet(records.max.set, isCardio, settings.units)} (${Utils.friendlyDate(records.max.date)})`
        : `🏆 Máx: ${formatRecordSet(records.max.set, isCardio, settings.units)} (${Utils.friendlyDate(records.max.date)}) · Mín: ${formatRecordSet(records.min.set, isCardio, settings.units)} (${Utils.friendlyDate(records.min.date)})`;
      card.appendChild(Utils.el('div', { class: 'small mt-8', style: 'color:var(--accent);font-weight:600;', text: recordText }));
    }

    const prev = ex ? previousBest(ex.id, iso, isCardio) : null;
    if (prev) {
      const prevLabel = isCardio
        ? `${prev.best.duration} min${prev.best.distance ? ` · ${prev.best.distance} km` : ''}${prev.best.calories ? ` · ${prev.best.calories} kcal` : ''}`
        : `${prev.best.weight}${settings.units} × ${prev.best.reps} reps`;
      card.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: `Última vez (${Utils.friendlyDate(prev.date)}): ${prevLabel}` }));
    }

    const setsWrap = Utils.el('div', { class: 'mt-8' });
    entry.sets.forEach((set, sIdx) => {
      const feltOpt = FELT_OPTIONS.find((f) => f.key === set.felt) || FELT_OPTIONS[1];
      const mainLabel = isCardio
        ? `${set.duration} min${set.distance ? ` · ${set.distance} km` : ''}${set.calories ? ` · ${set.calories} kcal` : ''}`
        : `${set.weight}${settings.units} × ${set.reps}`;
      const row = Utils.el('div', { class: 'list-item' }, [
        Utils.el('span', { text: `#${sIdx + 1}` }),
        Utils.el('span', { text: mainLabel }),
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

    // formulario para nueva serie / sesión
    const form = Utils.el('div', { class: 'mt-8' });
    const lastSet = entry.sets[entry.sets.length - 1];

    let weightInput, repsInput, durationInput, distanceInput, caloriesInput;
    if (isCardio) {
      durationInput = Utils.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'Duración (min)' });
      distanceInput = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: 'Distancia (km, opcional)', step: '0.1' });
      caloriesInput = Utils.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'Calorías (opcional)' });
      if (lastSet) { durationInput.value = lastSet.duration || ''; distanceInput.value = lastSet.distance || ''; }
      form.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field' }, [durationInput]),
        Utils.el('div', { class: 'field' }, [distanceInput]),
      ]));
      form.appendChild(Utils.el('div', { class: 'field' }, [caloriesInput]));
    } else {
      weightInput = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: `Peso (${settings.units})`, step: '0.5' });
      repsInput = Utils.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'Repeticiones' });
      if (lastSet) { weightInput.value = lastSet.weight; }
      else if (prev) { weightInput.value = prev.best.weight; }
      form.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field' }, [weightInput]),
        Utils.el('div', { class: 'field' }, [repsInput]),
      ]));
    }

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
    form.appendChild(feltRow);

    const addSetBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: isCardio ? '✓ Registrar sesión de cardio' : '✓ Registrar serie e iniciar descanso' });
    addSetBtn.addEventListener('click', () => {
      if (isCardio) {
        const duration = parseFloat(durationInput.value);
        if (isNaN(duration) || duration <= 0) {
          Utils.toast('Ingresa la duración en minutos');
          return;
        }
        const distance = distanceInput.value !== '' ? parseFloat(distanceInput.value) : undefined;
        const calories = caloriesInput.value !== '' ? parseFloat(caloriesInput.value) : undefined;
        entry.sets.push({ duration, distance, calories, felt: feltSelected });
        saveLog(iso, log);
        Utils.vibrate(40);
        render(document.getElementById('viewRoot'), { date: iso });
        return;
      }
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

  function renderWarmupCard(iso, log) {
    const mobilityExercises = DB.getExercises().filter((e) => e.group === 'movilidad');
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('h3', { text: '🔥 Calentamiento dinámico' }));
    if (mobilityExercises.length === 0) {
      card.appendChild(Utils.el('p', { text: 'Agrega ejercicios de movilidad en "Más → Catálogo de ejercicios" (grupo "movilidad") para verlos aquí.' }));
      return card;
    }
    card.appendChild(Utils.el('p', { class: 'small', text: 'Marca lo que hiciste antes de entrenar.' }));
    log.warmup = log.warmup || {};
    const list = Utils.el('div');
    mobilityExercises.forEach((ex) => {
      const done = !!log.warmup[ex.id];
      const row = Utils.el('div', { class: 'list-item' }, [
        Utils.el('span', { text: ex.name, style: done ? 'color:var(--text-dim);text-decoration:line-through;' : '' }),
        Utils.el('button', { class: 'btn-small', text: done ? '✅' : '⬜' }),
      ]);
      row.querySelector('button').addEventListener('click', () => {
        log.warmup[ex.id] = !log.warmup[ex.id];
        saveLog(iso, log);
        render(document.getElementById('viewRoot'), { date: iso });
      });
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  function renderPendingRow(iso, log, entry, key, onExpand) {
    const ex = DB.getExercises().find((e) => e.id === entry.exerciseId);
    const isCardio = !!(ex && ex.group === 'cardio');
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    const target = routine ? routine.exercises.find((re) => re.exerciseId === entry.exerciseId) : null;
    const records = ex ? exerciseRecords(ex.id, isCardio) : null;
    const row = Utils.el('div', { class: 'list-item' }, [
      Utils.el('div', {}, [
        Utils.el('div', { text: ex ? ex.name : '(ejercicio eliminado)' }),
        target ? Utils.el('div', { class: 'meta', text: `0 de ${target.targetSets} series · ${target.targetReps}` }) : null,
        records ? Utils.el('div', { class: 'meta', style: 'color:var(--accent);', text: `🏆 ${formatRecordSet(records.max.set, isCardio, DB.getSettings().units)}` }) : null,
      ]),
      Utils.el('button', { class: 'btn-small', text: '▶ Empezar' }),
    ]);
    row.querySelector('button').addEventListener('click', () => {
      expandedSet.add(key);
      onExpand();
    });
    return row;
  }

  // ---- progreso histórico de un ejercicio (peso o duración según el tipo) ----
  function exerciseHistory(exerciseId, isCardio) {
    const wl = DB.getWorkoutLog();
    return Object.keys(wl)
      .filter((d) => {
        const entry = wl[d].exercises.find((e) => e.exerciseId === exerciseId);
        return entry && entry.sets.length > 0;
      })
      .sort()
      .map((d) => {
        const entry = wl[d].exercises.find((e) => e.exerciseId === exerciseId);
        const best = isCardio
          ? entry.sets.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a), entry.sets[0])
          : entry.sets.reduce((a, b) => (b.weight > a.weight ? b : a), entry.sets[0]);
        return { date: d, best };
      });
  }

  function openProgressModal(ex, isCardio) {
    const history = exerciseHistory(ex.id, isCardio);
    const body = Utils.el('div');
    if (history.length < 2) {
      body.appendChild(Utils.el('p', { text: 'Necesitas al menos 2 días registrados en este ejercicio para ver el progreso.' }));
    } else {
      const chartWrap = Utils.el('div', { class: 'chart-wrap' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      chartWrap.appendChild(canvas);
      body.appendChild(chartWrap);
      const tooltip = Utils.el('div', { class: 'small text-dim mt-8', text: 'Toca un punto para ver el detalle' });
      body.appendChild(tooltip);
      const settings = DB.getSettings();
      requestAnimationFrame(() => {
        Utils.drawLineChart(canvas, history.map((h) => ({ x: h.date, y: isCardio ? h.best.duration : h.best.weight })), {
          color: '#3d8de0',
          onPointClick: (p, i) => {
            const h = history[i];
            tooltip.textContent = isCardio
              ? `${Utils.friendlyDate(h.date)}: ${h.best.duration} min${h.best.distance ? ` · ${h.best.distance} km` : ''}`
              : `${Utils.friendlyDate(h.date)}: ${h.best.weight}${settings.units} × ${h.best.reps} reps`;
          },
        });
      });
    }
    Modal.open(`📈 Progreso: ${ex.name}`, body);
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
          expandedSet.add(`${iso}:${ex.id}`);
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

  return { render, exerciseRecords, formatRecordSet };
})();
