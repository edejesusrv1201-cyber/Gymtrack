/* ============================================================
   views/workout.js — Registro de entrenamiento de un día
   Series normales, aproximaciones y dropsets, contador por
   ejercicio, guía de récords y acceso al cronómetro.
   ============================================================ */

const WorkoutView = (() => {
  const FELT_OPTIONS = [
    { key: 'facil', icon: '😃', label: 'Fácil' },
    { key: 'normal', icon: '🙂', label: 'Normal' },
    { key: 'dificil', icon: '😖', label: 'Costó' },
    { key: 'fallo', icon: '❌', label: 'Fallé' },
  ];

  const SET_TYPES = [
    { key: 'normal', label: 'Normal' },
    { key: 'warmup', label: 'Aprox.' },
    { key: 'drop', label: 'Dropset' },
  ];

  // ejercicios del día que el usuario ya expandió para registrar
  // (los que ya tienen series siempre se muestran expandidos)
  const expandedSet = new Set();
  // si la última serie de un ejercicio fue dropset, la siguiente sugiere dropset
  const typeMemory = {};
  let warmupOpen = false;
  let notesOpen = false;

  function getLog(iso) {
    return DB.getWorkoutLog()[iso];
  }
  function saveLog(iso, log) {
    const wl = DB.getWorkoutLog();
    wl[iso] = log;
    DB.saveWorkoutLog(wl);
  }

  // Mantiene el día sincronizado con su rutina. Solo toca lo que aún no tiene
  // ninguna serie registrada, así nunca se pierde lo que ya hiciste.
  function syncRoutineExercises(log, routine) {
    let changed = false;
    const routineIds = new Set(routine ? routine.exercises.map((re) => re.exerciseId) : []);
    const before = log.exercises.length;
    log.exercises = log.exercises.filter((e) => !(e.fromRoutine && e.sets.length === 0 && !routineIds.has(e.exerciseId)));
    if (log.exercises.length !== before) changed = true;
    if (routine) {
      const presentIds = new Set(log.exercises.map((e) => e.exerciseId));
      routine.exercises.forEach((re) => {
        if (!presentIds.has(re.exerciseId)) {
          log.exercises.push({ exerciseId: re.exerciseId, sets: [], fromRoutine: true });
          presentIds.add(re.exerciseId);
          changed = true;
        }
      });
    }
    return changed;
  }

  const workingCount = (entry) => entry.sets.filter(Metrics.isNormal).length;

  function render(root, params) {
    const iso = (params && params.date) || Utils.todayISO();
    const planned = TodayView.getRoutineForDate(iso);
    const log = getLog(iso) || TodayView.ensureLog(iso, planned);
    const plannedId = planned ? planned.id : null;

    // si el plan del día cambió y todavía no hay series, el entrenamiento sigue al plan
    let changed = false;
    const hasSets = log.exercises.some((e) => e.sets.length > 0);
    if (!hasSets && (log.routineId || null) !== plannedId) {
      log.routineId = plannedId;
      changed = true;
    }
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    if (syncRoutineExercises(log, routine)) changed = true;
    if (changed) saveLog(iso, log);

    if (params && params.focus) expandedSet.add(`${iso}:${params.focus}`);
    const reparams = { date: iso };
    const rerender = () => render(root, reparams);

    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });

    // ---- aviso: el plan cambió pero ya hay series registradas ----
    if (hasSets && planned && planned.id !== log.routineId) {
      const banner = Utils.el('div', { class: 'banner' }, [
        Utils.el('span', { text: `El plan de este día ahora es «${planned.name}».` }),
      ]);
      const useBtn = Utils.el('button', { class: 'btn-small', text: 'Cambiar' });
      useBtn.addEventListener('click', () => {
        log.routineId = planned.id;
        syncRoutineExercises(log, planned);
        saveLog(iso, log);
        rerender();
      });
      banner.appendChild(useBtn);
      view.appendChild(banner);
    }

    view.appendChild(renderHeader(iso, log, routine, rerender));
    view.appendChild(renderWarmupCard(iso, log, rerender));

    // series de la semana por grupo muscular (de la semana del día que se está viendo)
    const weekR = Metrics.weekRange(0, Utils.parseISO(iso));
    const weekGroups = Metrics.totals(weekR.start, weekR.end).byGroup;

    const exList = Utils.el('div');
    const pendingItems = Utils.el('div');
    let pendingCount = 0;
    log.exercises.forEach((entry, idx) => {
      const key = `${iso}:${entry.exerciseId}`;
      if (entry.sets.length > 0 || expandedSet.has(key)) {
        exList.appendChild(renderExerciseCard(iso, log, entry, idx, rerender, weekGroups));
      } else {
        pendingCount += 1;
        pendingItems.appendChild(renderPendingRow(log, entry, key, rerender));
      }
    });
    view.appendChild(exList);

    if (pendingCount > 0) {
      const pendingCard = Utils.el('div', { class: 'card' });
      pendingCard.appendChild(Utils.el('div', { class: 'card-title-row' }, [
        Utils.el('h3', { text: '📋 Pendientes' }),
        Utils.el('span', { class: 'eyebrow', text: `${pendingCount}` }),
      ]));
      pendingCard.appendChild(pendingItems);
      view.appendChild(pendingCard);
    }

    // ---- acciones compactas ----
    const addBtn = Utils.el('button', { type: 'button', text: '➕ Ejercicio' });
    addBtn.addEventListener('click', () => openAddExercise(iso, log, rerender));
    const notesBtn = Utils.el('button', { type: 'button', text: log.notes ? '📝 Notas •' : '📝 Notas' });
    notesBtn.addEventListener('click', () => { notesOpen = !notesOpen; rerender(); });
    const timerBtn = Utils.el('button', { type: 'button', text: '⏱ Descanso' });
    timerBtn.addEventListener('click', () => RestTimer.openPanel());
    view.appendChild(Utils.el('div', { class: 'action-row' }, [addBtn, notesBtn, timerBtn]));

    if (notesOpen) {
      const notesCard = Utils.el('div', { class: 'card' });
      const notesArea = Utils.el('textarea', { rows: 3, placeholder: '¿Cómo te sentiste hoy? Molestias, sensaciones, ajustes…' });
      notesArea.value = log.notes || '';
      notesArea.addEventListener('change', () => { log.notes = notesArea.value; saveLog(iso, log); });
      notesCard.appendChild(notesArea);
      view.appendChild(notesCard);
    }

    if (log.exercises.length > 0) {
      const finishBtn = Utils.el('button', { class: 'btn-primary', text: '🏁 Finalizar entrenamiento' });
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

  // ---------- encabezado con progreso del día ----------
  function renderHeader(iso, log, routine, rerender) {
    const card = Utils.el('div', { class: 'card' });
    const pillBtn = Utils.el('button', {
      class: 'pill',
      type: 'button',
      style: routine ? `color:${routine.color}` : '',
      text: `${routine ? routine.name : 'Libre'} ▾`,
    });
    pillBtn.addEventListener('click', () => TodayView.openRoutinePicker(iso, rerender));
    card.appendChild(Utils.el('div', { class: 'flex-between' }, [
      Utils.el('h3', { class: 'mb-0', text: Utils.friendlyDate(iso) }),
      pillBtn,
    ]));

    const totalWorking = log.exercises.reduce((s, e) => s + workingCount(e), 0);
    if (routine && routine.exercises.length > 0) {
      const target = routine.exercises.reduce((s, re) => s + (Number(re.targetSets) || 0), 0);
      const done = routine.exercises.reduce((s, re) => {
        const e = log.exercises.find((x) => x.exerciseId === re.exerciseId);
        return s + Math.min(e ? workingCount(e) : 0, Number(re.targetSets) || 0);
      }, 0);
      const pct = target ? Math.round((done / target) * 100) : 0;
      card.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: `${done} de ${target} series de la rutina · ${pct}%` }));
      card.appendChild(Utils.el('div', { class: 'progress-line' }, [Utils.el('div', { style: `width:${pct}%` })]));
    } else {
      card.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: `${totalWorking} serie${totalWorking === 1 ? '' : 's'} registrada${totalWorking === 1 ? '' : 's'}` }));
    }
    return card;
  }

  // ---------- calentamiento (plegable) ----------
  function renderWarmupCard(iso, log, rerender) {
    const mobility = DB.getExercises().filter((e) => e.group === 'movilidad');
    log.warmup = log.warmup || {};
    const doneCount = mobility.filter((e) => log.warmup[e.id]).length;
    const card = Utils.el('div', { class: 'card' });
    const head = Utils.el('div', { class: 'fold-head' }, [
      Utils.el('h3', { text: '🔥 Calentamiento' }),
      Utils.el('div', { style: 'display:flex;align-items:center;gap:10px;' }, [
        Utils.el('span', { class: 'counter-chip' + (mobility.length && doneCount === mobility.length ? ' done' : ''), text: `${doneCount}/${mobility.length}` }),
        Utils.el('span', { class: 'caret' + (warmupOpen ? ' open' : ''), text: '⌄' }),
      ]),
    ]);
    head.addEventListener('click', () => { warmupOpen = !warmupOpen; rerender(); });
    card.appendChild(head);
    if (!warmupOpen) return card;

    if (mobility.length === 0) {
      card.appendChild(Utils.el('p', { class: 'mt-8', text: 'Agrega ejercicios de movilidad en "Más → Catálogo" (grupo "movilidad") para verlos aquí.' }));
      return card;
    }
    const list = Utils.el('div', { class: 'mt-8' });
    mobility.forEach((ex) => {
      const done = !!log.warmup[ex.id];
      const row = Utils.el('div', { class: 'list-item' }, [
        Utils.el('span', { text: ex.name, style: done ? 'color:var(--text-dim);text-decoration:line-through;' : '' }),
        Utils.el('button', { class: 'btn-small', text: done ? '✅' : '⬜' }),
      ]);
      row.querySelector('button').addEventListener('click', () => {
        log.warmup[ex.id] = !log.warmup[ex.id];
        saveLog(iso, log);
        rerender();
      });
      list.appendChild(row);
    });
    card.appendChild(list);
    return card;
  }

  // ---------- tarjeta de ejercicio ----------
  function renderExerciseCard(iso, log, entry, idx, rerender, weekGroups) {
    const ex = DB.getExercises().find((e) => e.id === entry.exerciseId);
    const isCardio = !!(ex && ex.group === 'cardio');
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    const target = routine ? routine.exercises.find((re) => re.exerciseId === entry.exerciseId) : null;
    const settings = DB.getSettings();
    const key = `${iso}:${entry.exerciseId}`;

    const workingN = workingCount(entry);
    const warmN = entry.sets.filter(Metrics.isWarmup).length;
    const dropN = entry.sets.filter(Metrics.isDrop).length;

    const card = Utils.el('div', { class: 'card exercise-card' });

    // --- cabecera: nombre, contador y acciones ---
    const complete = !!(target && workingN >= target.targetSets);
    const counterChip = Utils.el('span', {
      class: 'counter-chip' + (complete ? ' done' : ''),
      text: target ? `${workingN}/${target.targetSets}${complete ? ' ✓' : ''}` : `${workingN}`,
    });
    const headerBtns = Utils.el('div', { style: 'display:flex;align-items:center;gap:2px;flex:none;' }, [
      counterChip,
      ex ? Utils.el('button', { class: 'icon-btn', text: '📈', title: 'Ver progreso', onclick: () => openProgressModal(ex, isCardio) }) : null,
      Utils.el('button', { class: 'icon-btn', text: '🗑️', onclick: () => {
        if (!Utils.confirmDialog('¿Quitar este ejercicio del día?')) return;
        log.exercises.splice(idx, 1);
        saveLog(iso, log);
        rerender();
      } }),
    ]);
    card.appendChild(Utils.el('div', { class: 'ex-header' }, [
      Utils.el('div', { style: 'min-width:0;' }, [
        Utils.el('h3', { class: 'mb-0', text: ex ? ex.name : '(ejercicio eliminado)' }),
        ex ? Utils.el('div', { class: `eyebrow grp-${ex.group}`, style: 'margin-top:3px;', text: ex.group }) : null,
      ]),
      headerBtns,
    ]));

    // --- series de este grupo muscular en la semana ---
    if (ex && Metrics.STRENGTH_GROUPS.includes(ex.group)) {
      const goal = Metrics.weeklyGoal();
      const n = weekGroups && weekGroups[ex.group] ? weekGroups[ex.group].sets : 0;
      const st = n < goal.min ? 'low' : n > goal.max ? 'high' : 'ok';
      card.appendChild(Utils.el('div', {
        class: 'wk-line',
        style: `color:${{ low: 'var(--yellow)', ok: 'var(--green)', high: 'var(--accent-2)' }[st]}`,
        text: `Esta semana en ${ex.group}: ${n} serie${n === 1 ? '' : 's'} · meta ${goal.min}–${goal.max}`,
      }));
    }

    // --- meta + extras (aproximaciones / dropsets) ---
    const extras = `${warmN ? ` · +${warmN} aprox.` : ''}${dropN ? ` · +${dropN} drop` : ''}`;
    if (target) {
      card.appendChild(Utils.el('div', {
        class: 'ex-target',
        style: complete ? 'color:var(--green);font-weight:700;' : '',
        text: `${workingN} de ${target.targetSets} series · ${target.targetReps}${extras}`,
      }));
    } else if (entry.sets.length > 0) {
      card.appendChild(Utils.el('div', {
        class: 'ex-target',
        text: `${workingN} serie${workingN === 1 ? '' : 's'} registrada${workingN === 1 ? '' : 's'}${extras}`,
      }));
    }

    // --- guía: récord y última vez ---
    const records = ex ? Metrics.exerciseRecords(ex.id, isCardio) : null;
    const prev = ex ? Metrics.previousBest(ex.id, iso, isCardio) : null;
    if (records || prev) {
      const guide = Utils.el('div', { class: 'guide' });
      if (records) {
        const sameSet = records.max.date === records.min.date && records.max.set === records.min.set;
        const fmt = (set) => Metrics.formatSet(set, isCardio);
        let text = sameSet
          ? `🏆 Récord: ${fmt(records.max.set)} (${Utils.shortDate(records.max.date)})`
          : `🏆 Máx: ${fmt(records.max.set)} (${Utils.shortDate(records.max.date)}) · Mín: ${fmt(records.min.set)} (${Utils.shortDate(records.min.date)})`;
        if (!isCardio && records.e1rm > 0) text += ` · 1RM est. ${Units.label(records.e1rm)}`;
        guide.appendChild(Utils.el('div', { text }));
      }
      if (prev) {
        guide.appendChild(Utils.el('div', {
          style: 'color:var(--text-dim);font-weight:600;margin-top:3px;',
          text: `Última vez (${Utils.shortDate(prev.date)}): ${Metrics.formatSet(prev.best, isCardio)}`,
        }));
      }
      card.appendChild(guide);
    }

    // --- series registradas ---
    const setsWrap = Utils.el('div', { class: 'mt-8' });
    let normalIdx = 0;
    entry.sets.forEach((set, sIdx) => {
      const feltOpt = FELT_OPTIONS.find((f) => f.key === set.felt) || FELT_OPTIONS[1];
      const mainLabel = isCardio
        ? `${set.duration} min${set.distance ? ` · ${set.distance} km` : ''}${set.calories ? ` · ${set.calories} kcal` : ''}`
        : `${Units.label(set.weight)} × ${set.reps}`;
      let badge;
      if (Metrics.isWarmup(set)) badge = Utils.el('span', { class: 'set-badge warm', title: 'Aproximación', text: 'A' });
      else if (Metrics.isDrop(set)) badge = Utils.el('span', { class: 'set-badge drop', title: 'Dropset', text: '↓' });
      else { normalIdx += 1; badge = Utils.el('span', { class: 'set-badge work', text: `${normalIdx}` }); }
      setsWrap.appendChild(Utils.el('div', { class: 'set-line' }, [
        badge,
        Utils.el('span', { class: 'set-main', text: mainLabel }),
        set.pr ? Utils.el('span', { title: `Récord de ${set.pr.replace(',', ' y ')}`, text: '🏆' }) : null,
        Metrics.isWarmup(set) ? Utils.el('span', { class: 'set-felt', text: 'aprox.' }) : Utils.el('span', { class: 'set-felt', text: `${feltOpt.icon} ${feltOpt.label}` }),
        Utils.el('button', { class: 'icon-btn', text: '✕', onclick: () => {
          entry.sets.splice(sIdx, 1);
          saveLog(iso, log);
          rerender();
        } }),
      ]));
    });
    card.appendChild(setsWrap);

    // --- formulario para nueva serie / sesión ---
    const form = Utils.el('div', { class: 'mt-8' });
    const lastSet = entry.sets[entry.sets.length - 1];
    const lastWork = [...entry.sets].reverse().find(Metrics.isNormal);

    let weightInput, repsInput, durationInput, distanceInput, caloriesInput;
    let typeSelected = isCardio ? 'normal' : (typeMemory[key] || 'normal');
    const feltWrap = Utils.el('div', { class: 'mt-8' });

    // unidad con la que se escribe el peso de este ejercicio (cada máquina es distinta)
    let inputUnit = isCardio ? Units.current() : Units.inputUnitFor(entry.exerciseId);

    // sugerencias de peso, ya convertidas a la unidad de captura
    function suggestWeight(type) {
      const asInput = (kg) => Units.fromKg(kg, inputUnit);
      if (type === 'drop') {
        const base = lastSet && lastSet.weight !== undefined ? asInput(lastSet.weight) : 0;
        const st = Units.step(inputUnit);
        return base > 0 ? Math.round((base * 0.8) / st) * st : '';
      }
      if (type === 'warmup') {
        if (lastSet && Metrics.isWarmup(lastSet)) return Units.num(lastSet.weight, inputUnit);
        const baseKg = prev ? Number(prev.best.weight) : lastWork ? Number(lastWork.weight) : 0;
        const st = Units.step(inputUnit, true);
        return baseKg > 0 ? Math.round((asInput(baseKg) * 0.5) / st) * st : '';
      }
      if (lastWork) return Units.num(lastWork.weight, inputUnit);
      if (prev) return Units.num(prev.best.weight, inputUnit);
      return '';
    }

    const addSetBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8' });
    const BTN_TEXT = {
      normal: '✓ Registrar serie e iniciar descanso',
      warmup: '✓ Registrar aproximación',
      drop: '✓ Registrar dropset',
    };

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
      addSetBtn.textContent = '✓ Registrar sesión de cardio';
    } else {
      weightInput = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: `Peso (${inputUnit})`, step: 'any' });
      const unitBtn = Utils.el('button', { class: 'unit-btn', type: 'button', title: 'Cambiar entre kg y lb', text: inputUnit });
      unitBtn.addEventListener('click', () => {
        const next = inputUnit === 'kg' ? 'lb' : 'kg';
        const typed = parseFloat(weightInput.value);
        if (!isNaN(typed)) weightInput.value = Math.round(Units.fromKg(Units.toKg(typed, inputUnit), next) * 10) / 10;
        inputUnit = next;
        Units.rememberInputUnit(entry.exerciseId, next);
        unitBtn.textContent = next;
        weightInput.placeholder = `Peso (${next})`;
      });
      repsInput = Utils.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'Repeticiones' });
      weightInput.value = suggestWeight(typeSelected);

      const typeRow = Utils.el('div', { class: 'seg small' });
      const refreshType = () => {
        typeRow.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.type === typeSelected));
        addSetBtn.textContent = BTN_TEXT[typeSelected];
        feltWrap.classList.toggle('hidden', typeSelected === 'warmup');
      };
      SET_TYPES.forEach((t) => {
        const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-type': t.key, text: t.label });
        b.addEventListener('click', () => {
          typeSelected = t.key;
          weightInput.value = suggestWeight(typeSelected);
          refreshType();
        });
        typeRow.appendChild(b);
      });
      form.appendChild(typeRow);
      form.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field' }, [Utils.el('div', { class: 'input-unit' }, [weightInput, unitBtn])]),
        Utils.el('div', { class: 'field' }, [repsInput]),
      ]));
      addSetBtn.textContent = BTN_TEXT[typeSelected];
      form.refreshType = refreshType;
    }

    let feltSelected = 'normal';
    const feltRow = Utils.el('div', { class: 'felt-select' });
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
    feltWrap.appendChild(feltRow);
    form.appendChild(feltWrap);
    if (form.refreshType) form.refreshType();

    addSetBtn.addEventListener('click', () => {
      if (isCardio) {
        const duration = parseFloat(durationInput.value);
        if (isNaN(duration) || duration <= 0) {
          Utils.toast('Ingresa la duración en minutos');
          return;
        }
        const distance = distanceInput.value !== '' ? parseFloat(distanceInput.value) : undefined;
        const calories = caloriesInput.value !== '' ? parseFloat(caloriesInput.value) : undefined;
        const cardioSet = { duration, distance, calories, felt: feltSelected };
        const prs = Metrics.detectPR(entry.exerciseId, true, cardioSet);
        if (prs.length) cardioSet.pr = prs.map((x) => x.kind).join(',');
        entry.sets.push(cardioSet);
        saveLog(iso, log);
        Utils.vibrate(40);
        rerender();
        Celebrate.record(prs, ex ? ex.name : '');
        return;
      }
      const entered = parseFloat(weightInput.value);
      const weight = Units.toKg(entered, inputUnit);
      const reps = parseInt(repsInput.value, 10);
      if (isNaN(entered) || isNaN(reps) || reps <= 0) {
        Utils.toast('Ingresa peso y repeticiones válidas');
        return;
      }
      const set = { weight, reps, felt: typeSelected === 'warmup' ? 'normal' : feltSelected };
      if (typeSelected !== 'normal') set.type = typeSelected;
      const prs = Metrics.detectPR(entry.exerciseId, false, set);
      if (prs.length) set.pr = prs.map((x) => x.kind).join(',');
      entry.sets.push(set);
      saveLog(iso, log);
      Utils.vibrate(40);
      if (typeSelected === 'drop') typeMemory[key] = 'drop';
      else delete typeMemory[key];
      // descanso solo tras una serie efectiva (las aproximaciones y los drops van seguidos)
      if (typeSelected === 'normal') RestTimer.quickStart(DB.getSettings().restDefault);
      rerender();
      Celebrate.record(prs, ex ? ex.name : '');
    });
    form.appendChild(addSetBtn);
    card.appendChild(form);

    return card;
  }

  // ---------- fila compacta de un ejercicio pendiente ----------
  function renderPendingRow(log, entry, key, rerender) {
    const ex = DB.getExercises().find((e) => e.id === entry.exerciseId);
    const isCardio = !!(ex && ex.group === 'cardio');
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    const target = routine ? routine.exercises.find((re) => re.exerciseId === entry.exerciseId) : null;
    const records = ex ? Metrics.exerciseRecords(ex.id, isCardio) : null;
    const row = Utils.el('div', { class: 'list-item' }, [
      Utils.el('div', {}, [
        Utils.el('div', { style: 'font-weight:700;', text: ex ? ex.name : '(ejercicio eliminado)' }),
        target ? Utils.el('div', { class: 'meta', text: `0 de ${target.targetSets} series · ${target.targetReps}` }) : null,
        records ? Utils.el('div', { class: 'meta', style: 'color:var(--accent-light);', text: `🏆 ${Metrics.formatSet(records.max.set, isCardio)}` }) : null,
      ]),
      Utils.el('button', { class: 'btn-small', text: '▶ Empezar' }),
    ]);
    row.querySelector('button').addEventListener('click', () => {
      expandedSet.add(key);
      rerender();
    });
    return row;
  }

  // ---------- progreso histórico de un ejercicio ----------
  function openProgressModal(ex) {
    const body = Utils.el('div');
    StatsView.exerciseProgress(body, ex);
    Modal.open(`📈 ${ex.name}`, body);
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
      body.appendChild(Utils.el('div', { class: `eyebrow grp-${g}`, style: 'margin-top:12px;', text: g }));
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
      body.appendChild(Utils.el('p', { text: 'Ya agregaste todos los ejercicios de tu catálogo. Crea uno nuevo en "Más → Catálogo".' }));
    }
    Modal.open('Agregar ejercicio', body);
  }

  return { render };
})();
