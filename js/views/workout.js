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
        : `${Units.label(set.weight)}${set.uni ? ' /lado' : ''} × ${set.reps}`;
      let badge;
      if (Metrics.isWarmup(set)) badge = Utils.el('span', { class: 'set-badge warm', title: 'Aproximación', text: 'A' });
      else if (Metrics.isDrop(set)) badge = Utils.el('span', { class: 'set-badge drop', title: 'Dropset', text: '↓' });
      else { normalIdx += 1; badge = Utils.el('span', { class: 'set-badge work', text: `${normalIdx}` }); }
      setsWrap.appendChild(Utils.el('div', { class: 'set-line' }, [
        badge,
        Utils.el('span', { class: 'set-main', text: mainLabel }),
        set.pr ? Utils.el('span', { title: `Récord de ${set.pr.replace(',', ' y ')}`, text: '🏆' }) : null,
        Metrics.isWarmup(set) ? Utils.el('span', { class: 'set-felt', text: 'aprox.' }) : Utils.el('span', { class: 'set-felt', text: `${feltOpt.icon} ${feltOpt.label}` }),
        Utils.el('button', { class: 'icon-btn', text: '✏️', title: 'Editar esta serie', onclick: () => openEditSet(iso, log, entry, sIdx, ex, isCardio, rerender) }),
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
    // unilateral: el peso es por lado (se recuerda en el ejercicio)
    let uniSelected = !!(ex && ex.unilateral);

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
        const baseKg = prev && !!prev.best.uni === uniSelected ? Number(prev.best.weight) : lastWork && !!lastWork.uni === uniSelected ? Number(lastWork.weight) : 0;
        const st = Units.step(inputUnit, true);
        return baseKg > 0 ? Math.round((asInput(baseKg) * 0.5) / st) * st : '';
      }
      if (lastWork && !!lastWork.uni === uniSelected) return Units.num(lastWork.weight, inputUnit);
      if (prev && !!prev.best.uni === uniSelected) return Units.num(prev.best.weight, inputUnit);
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
        weightInput.placeholder = uniSelected ? `Peso por lado (${next})` : `Peso (${next})`;
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

      // bilateral / unilateral (peso por lado)
      const uniRow = Utils.el('div', { class: 'seg small' });
      const paintUni = () => {
        uniRow.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', (b.dataset.u === '1') === uniSelected));
        weightInput.placeholder = uniSelected ? `Peso por lado (${inputUnit})` : `Peso (${inputUnit})`;
      };
      [['0', 'Bilateral'], ['1', 'Unilateral · peso por lado']].forEach(([v, t]) => {
        const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-u': v, text: t });
        b.addEventListener('click', () => {
          uniSelected = v === '1';
          if (ex) {
            const all = DB.getExercises();
            const target = all.find((e) => e.id === ex.id);
            if (target) { target.unilateral = uniSelected; DB.saveExercises(all); }
          }
          weightInput.value = suggestWeight(typeSelected);
          paintUni();
        });
        uniRow.appendChild(b);
      });
      form.appendChild(uniRow);
      form.paintUni = paintUni;
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
    if (form.paintUni) form.paintUni();

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
      if (uniSelected) set.uni = true;
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

  // ---------- editar una serie ya registrada ----------
  function openEditSet(iso, log, entry, sIdx, ex, isCardio, rerender) {
    const set = entry.sets[sIdx];
    if (!set) return;
    const body = Utils.el('div');
    let type = set.type === 'warmup' || set.type === 'drop' ? set.type : 'normal';
    let uni = !!set.uni;
    let felt = set.felt || 'normal';
    let unit = isCardio ? Units.current() : Units.inputUnitFor(entry.exerciseId);
    let weightIn, repsIn, durIn, distIn, calIn;

    const feltWrap = Utils.el('div', { class: 'mt-8' });
    const feltRow = Utils.el('div', { class: 'felt-select' });
    const paintFelt = () => feltRow.querySelectorAll('.felt-btn').forEach((b) => b.classList.toggle('selected', b.dataset.k === felt));
    FELT_OPTIONS.forEach((f) => {
      const b = Utils.el('button', { class: 'felt-btn', title: f.label, type: 'button', 'data-k': f.key }, [Utils.el('div', { text: f.icon })]);
      b.addEventListener('click', () => { felt = f.key; paintFelt(); });
      feltRow.appendChild(b);
    });
    feltWrap.appendChild(feltRow);

    if (isCardio) {
      durIn = Utils.el('input', { type: 'number', inputmode: 'decimal', value: set.duration !== undefined ? String(set.duration) : '' });
      distIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: '0.1', value: set.distance ? String(set.distance) : '' });
      calIn = Utils.el('input', { type: 'number', inputmode: 'numeric', value: set.calories ? String(set.calories) : '' });
      body.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Duración (min)' }), durIn]),
        Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Distancia (km)' }), distIn]),
      ]));
      body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Calorías' }), calIn]));
    } else {
      const segFor = (opts, get, set_) => {
        const row = Utils.el('div', { class: 'seg small' });
        const paint = () => row.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.k === String(get())));
        opts.forEach(([k, t]) => {
          const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': k, text: t });
          b.addEventListener('click', () => { set_(k); paint(); });
          row.appendChild(b);
        });
        paint();
        return row;
      };
      body.appendChild(Utils.el('div', { class: 'field' }, [
        Utils.el('label', { text: 'Tipo de serie' }),
        segFor(SET_TYPES.map((t) => [t.key, t.label]), () => type, (k) => { type = k; feltWrap.classList.toggle('hidden', type === 'warmup'); }),
      ]));
      body.appendChild(Utils.el('div', { class: 'field' }, [
        Utils.el('label', { text: '¿Unilateral?' }),
        segFor([['0', 'Bilateral'], ['1', 'Unilateral · peso por lado']], () => (uni ? '1' : '0'), (k) => { uni = k === '1'; weightLabel.textContent = weightText(); }),
      ]));

      const weightText = () => (uni ? `Peso por lado (${unit})` : `Peso (${unit})`);
      const weightLabel = Utils.el('label', { text: weightText() });
      weightIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: set.weight !== undefined && set.weight !== null ? String(Units.num(set.weight, unit)) : '' });
      const unitBtn = Utils.el('button', { class: 'unit-btn', type: 'button', title: 'Cambiar entre kg y lb', text: unit });
      unitBtn.addEventListener('click', () => {
        const next = unit === 'kg' ? 'lb' : 'kg';
        const typed = parseFloat(weightIn.value);
        if (!isNaN(typed)) weightIn.value = Math.round(Units.fromKg(Units.toKg(typed, unit), next) * 10) / 10;
        unit = next;
        unitBtn.textContent = next;
        weightLabel.textContent = weightText();
      });
      repsIn = Utils.el('input', { type: 'number', inputmode: 'numeric', value: set.reps !== undefined ? String(set.reps) : '' });
      body.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field' }, [weightLabel, Utils.el('div', { class: 'input-unit' }, [weightIn, unitBtn])]),
        Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Repeticiones' }), repsIn]),
      ]));
    }

    body.appendChild(Utils.el('label', { class: 'small text-dim', style: 'display:block;margin-top:4px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;font-size:0.7rem;', text: 'Sensación' }));
    body.appendChild(feltWrap);
    feltWrap.classList.toggle('hidden', !isCardio && type === 'warmup');
    paintFelt();

    const saveBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Guardar cambios' });
    saveBtn.addEventListener('click', () => {
      const next = { felt: !isCardio && type === 'warmup' ? 'normal' : felt };
      if (isCardio) {
        const duration = parseFloat(durIn.value);
        if (isNaN(duration) || duration <= 0) { Utils.toast('Ingresa la duración en minutos'); return; }
        next.duration = duration;
        if (distIn.value !== '') next.distance = parseFloat(distIn.value);
        if (calIn.value !== '') next.calories = parseFloat(calIn.value);
      } else {
        const entered = parseFloat(weightIn.value);
        const reps = parseInt(repsIn.value, 10);
        if (isNaN(entered) || isNaN(reps) || reps <= 0) { Utils.toast('Ingresa peso y repeticiones válidas'); return; }
        next.weight = Units.toKg(entered, unit);
        next.reps = reps;
        if (type !== 'normal') next.type = type;
        if (uni) next.uni = true;
      }
      // recalcula el récord de esta serie comparándola con las demás
      entry.sets.splice(sIdx, 1);
      saveLog(iso, log);
      const prs = Metrics.detectPR(entry.exerciseId, isCardio, next);
      if (prs.length) next.pr = prs.map((x) => x.kind).join(',');
      entry.sets.splice(sIdx, 0, next);
      saveLog(iso, log);
      if (ex && !isCardio && uni !== !!ex.unilateral) {
        const all = DB.getExercises();
        const t = all.find((e) => e.id === ex.id);
        if (t) { t.unilateral = uni; DB.saveExercises(all); }
      }
      Modal.close();
      Utils.toast('Serie actualizada');
      rerender();
    });
    body.appendChild(saveBtn);
    Modal.open(`Editar serie · ${ex ? ex.name : ''}`, body);
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

  // ---------- agregar ejercicio al día: buscador, grupos, recientes y crear nuevo ----------
  function openAddExercise(iso, log, onDone) {
    const body = Utils.el('div');
    const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const GROUP_ORDER = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];
    const added = new Set();
    let filter = null; // 'recientes' | nombre de grupo | 'todos'
    let query = '';

    // ejercicios más hechos en las últimas 8 semanas
    const freq = {};
    const wl = DB.getWorkoutLog();
    const since = Utils.toISODate(new Date(Date.now() - 56 * 86400000));
    Object.keys(wl).filter((d) => d >= since).forEach((d) => {
      (wl[d].exercises || []).forEach((e) => { if (e.sets && e.sets.length) freq[e.exerciseId] = (freq[e.exerciseId] || 0) + 1; });
    });

    const search = Utils.el('input', { type: 'search', placeholder: '🔎 Buscar ejercicio…', class: 'ax-search' });
    const chipsRow = Utils.el('div', { class: 'rt-chips' });
    const listWrap = Utils.el('div');
    const createWrap = Utils.el('div');

    const inLog = () => new Set(log.exercises.map((e) => e.exerciseId));

    function available() {
      const used = inLog();
      return DB.getExercises().filter((e) => !used.has(e.id) || added.has(e.id));
    }

    function chipList() {
      const present = new Set(available().map((e) => e.group));
      const groups = GROUP_ORDER.filter((g) => present.has(g)).concat([...present].filter((g) => !GROUP_ORDER.includes(g)));
      const hasRecent = available().some((e) => freq[e.id]);
      return (hasRecent ? ['recientes'] : []).concat(['todos'], groups);
    }

    function paintChips() {
      const chips = chipList();
      if (!filter || !chips.includes(filter)) filter = chips[0];
      chipsRow.innerHTML = '';
      chips.forEach((g) => {
        const color = g === 'recientes' || g === 'todos' ? 'var(--accent-light)' : (Utils.GROUP_COLORS[g] || '#8d95a8');
        const chip = Utils.el('button', { type: 'button', class: `rt-chip${g === filter ? ' active' : ''}`, style: `--gc:${color}`, text: g === 'recientes' ? '⭐ recientes' : g });
        chip.addEventListener('click', () => { filter = g; paintChips(); paintList(); });
        chipsRow.appendChild(chip);
      });
    }

    function addToDay(ex, row, btn) {
      log.exercises.push({ exerciseId: ex.id, sets: [] });
      saveLog(iso, log);
      expandedSet.add(`${iso}:${ex.id}`);
      added.add(ex.id);
      btn.textContent = '✓';
      btn.disabled = true;
      row.classList.add('ax-added');
      onDone();
      doneBtn.textContent = `Listo (${added.size} agregado${added.size === 1 ? '' : 's'})`;
    }

    function exRow(ex) {
      const isCardio = ex.group === 'cardio';
      const best = Metrics.previousBest(ex.id, '9999-12-31', isCardio);
      const isAdded = added.has(ex.id);
      const btn = Utils.el('button', { class: 'btn-small', text: isAdded ? '✓' : '+' });
      btn.disabled = isAdded;
      const row = Utils.el('div', { class: `list-item${isAdded ? ' ax-added' : ''}` }, [
        Utils.el('div', { style: 'min-width:0;' }, [
          Utils.el('div', { style: 'font-weight:700;' }, [ex.name, ex.unilateral ? Utils.el('span', { class: 'uni-pill', text: 'unilateral' }) : null]),
          Utils.el('div', { class: `meta grp-${ex.group}`, text: best ? `${ex.group} · última vez ${Metrics.formatSet(best.best, isCardio)}` : `${ex.group} · sin registros` }),
        ]),
        btn,
      ]);
      btn.addEventListener('click', () => addToDay(ex, row, btn));
      return row;
    }

    function paintList() {
      listWrap.innerHTML = '';
      const q = norm(query);
      let items = available();
      if (q) items = items.filter((e) => norm(e.name).includes(q) || norm(e.group).includes(q));
      else if (filter === 'recientes') items = items.filter((e) => freq[e.id]).sort((a, b) => freq[b.id] - freq[a.id]);
      else if (filter !== 'todos') items = items.filter((e) => e.group === filter);

      if (!items.length) {
        listWrap.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: q ? `No hay ejercicios que coincidan con "${query}". Puedes crearlo abajo.` : 'No hay ejercicios en esta lista.' }));
        return;
      }
      if (filter === 'todos' || q) {
        // agrupados por músculo, en orden fijo
        GROUP_ORDER.concat([...new Set(items.map((e) => e.group))].filter((g) => !GROUP_ORDER.includes(g))).forEach((g) => {
          const inGroup = items.filter((e) => e.group === g).sort((a, b) => a.name.localeCompare(b.name, 'es'));
          if (!inGroup.length) return;
          listWrap.appendChild(Utils.el('div', { class: `eyebrow grp-${g}`, style: 'margin-top:12px;', text: g }));
          inGroup.forEach((ex) => listWrap.appendChild(exRow(ex)));
        });
      } else {
        const sorted = filter === 'recientes' ? items : items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        sorted.forEach((ex) => listWrap.appendChild(exRow(ex)));
      }
    }

    // crear uno nuevo sin salir del entrenamiento
    function paintCreate(open) {
      createWrap.innerHTML = '';
      if (!open) {
        const b = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: '➕ Crear ejercicio nuevo' });
        b.addEventListener('click', () => paintCreate(true));
        createWrap.appendChild(b);
        return;
      }
      const nameIn = Utils.el('input', { type: 'text', placeholder: 'Nombre del ejercicio', value: query || '' });
      const groupSel = Utils.el('select', {});
      GROUP_ORDER.forEach((g) => groupSel.appendChild(Utils.el('option', { value: g, text: g })));
      if (filter && GROUP_ORDER.includes(filter)) groupSel.value = filter;
      let uni = false;
      const seg = Utils.el('div', { class: 'seg small' });
      const paintSeg = () => seg.querySelectorAll('.seg-btn').forEach((x) => x.classList.toggle('active', (x.dataset.u === '1') === uni));
      [['0', 'Bilateral'], ['1', 'Unilateral (peso por lado)']].forEach(([v, t]) => {
        const x = Utils.el('button', { type: 'button', class: 'seg-btn', 'data-u': v, text: t });
        x.addEventListener('click', () => { uni = v === '1'; paintSeg(); });
        seg.appendChild(x);
      });
      paintSeg();
      const create = Utils.el('button', { class: 'btn-primary btn-block', text: 'Crear y agregar al día' });
      create.addEventListener('click', () => {
        const name = nameIn.value.trim();
        if (!name) { Utils.toast('Escribe el nombre del ejercicio'); return; }
        const exercises = DB.getExercises();
        const ex = { id: DB.uid(), name, group: groupSel.value };
        if (uni) ex.unilateral = true;
        exercises.push(ex);
        DB.saveExercises(exercises);
        log.exercises.push({ exerciseId: ex.id, sets: [] });
        saveLog(iso, log);
        expandedSet.add(`${iso}:${ex.id}`);
        added.add(ex.id);
        onDone();
        query = '';
        search.value = '';
        doneBtn.textContent = `Listo (${added.size} agregado${added.size === 1 ? '' : 's'})`;
        paintChips();
        paintList();
        paintCreate(false);
        Utils.toast(`"${name}" creado y agregado`);
      });
      createWrap.appendChild(Utils.el('div', { class: 'ax-create' }, [
        Utils.el('div', { class: 'small text-dim', text: 'NUEVO EJERCICIO' }),
        Utils.el('div', { class: 'field mt-8' }, [nameIn]),
        Utils.el('div', { class: 'field' }, [groupSel]),
        seg,
        create,
      ]));
    }

    const doneBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Listo' });
    doneBtn.addEventListener('click', () => { Modal.close(); onDone(); });

    search.addEventListener('input', () => { query = search.value.trim(); paintList(); });

    body.appendChild(search);
    body.appendChild(chipsRow);
    body.appendChild(listWrap);
    body.appendChild(createWrap);
    body.appendChild(doneBtn);
    paintChips();
    paintList();
    paintCreate(false);
    Modal.open('Agregar ejercicio', body);
  }

  return { render };
})();
