/* ============================================================
   views/plan.js — Plan mensual: qué rutina toca cada día
   ============================================================ */

const PlanView = (() => {
  let cursor = new Date(); // mes que se está viendo
  const COLORS = ['#e0663d', '#3d8de0', '#5fbf6f', '#e0c23d', '#c26fe0', '#e05a5a', '#7a7a85', '#3de0c2'];


  function render(root, params) {
    if (params && params.focusDate) cursor = Utils.parseISO(params.focusDate);
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const year = cursor.getFullYear();
    const month0 = cursor.getMonth();
    const mk = Utils.monthKey(cursor);
    const plans = DB.getMonthlyPlans();
    const plan = plans[mk] || { days: {} };

    // ---- navegación de mes ----
    const nav = Utils.el('div', { class: 'flex-between mt-8' }, [
      Utils.el('button', { class: 'btn-small', text: '←', onclick: () => { cursor = new Date(year, month0 - 1, 1); render(root); } }),
      Utils.el('h3', { class: 'mb-0', text: `${Utils.MESES[month0]} ${year}` }),
      Utils.el('button', { class: 'btn-small', text: '→', onclick: () => { cursor = new Date(year, month0 + 1, 1); render(root); } }),
    ]);
    view.appendChild(nav);

    // ---- calendario ----
    const calCard = Utils.el('div', { class: 'card mt-8' });
    const grid = Utils.el('div', { class: 'cal-grid' });
    Utils.DIAS_CORTOS.forEach((d) => grid.appendChild(Utils.el('div', { class: 'cal-dow', text: d })));
    const firstDow = new Date(year, month0, 1).getDay();
    for (let i = 0; i < firstDow; i++) grid.appendChild(Utils.el('div', { class: 'cal-day empty' }));
    const totalDays = Utils.daysInMonth(year, month0);
    const todayIso = Utils.todayISO();
    const wlog = DB.getWorkoutLog();
    let planned = 0; let done = 0;
    for (let day = 1; day <= totalDays; day++) {
      const iso = `${year}-${Utils.pad(month0 + 1)}-${Utils.pad(day)}`;
      const routineId = plan.days[String(day)];
      const routine = routineId ? DB.getRoutines().find((r) => r.id === routineId) : null;
      const trained = !!(wlog[iso] && (wlog[iso].exercises || []).some((e) => e.sets && e.sets.length));
      const isRest = !!(routine && routine.exercises.length === 0);
      if (routine && !isRest) planned += 1;
      if (trained) done += 1;
      const first = routine ? routine.name.split(/[\s(]/)[0] : '';
      const cell = Utils.el('div', { class: 'cal-day' + (iso === todayIso ? ' today' : '') + (trained ? ' trained' : '') + (isRest ? ' rest' : '') }, [
        Utils.el('div', { class: 'cd-num', text: String(day) }),
        routine ? Utils.el('div', { class: 'cd-lb', style: `color:${routine.color}`, text: first.length > 5 ? `${first.slice(0, 4)}.` : first }) : null,
        trained ? Utils.el('span', { class: 'cd-check', text: '✓' }) : null,
      ]);
      cell.addEventListener('click', () => openAssignDay(iso, day, mk, () => render(root)));
      grid.appendChild(cell);
    }
    calCard.appendChild(grid);

    calCard.appendChild(Utils.el('div', { class: 'cal-summary' }, [
      Utils.el('span', {}, [Utils.el('b', { text: String(planned) }), ' días de entreno planeados']),
      Utils.el('span', {}, [Utils.el('b', { text: String(done) }), ' con series registradas ✓']),
    ]));

    const legend = Utils.el('div', { class: 'cal-legend' });
    DB.getRoutines().forEach((r) => {
      legend.appendChild(Utils.el('div', { class: 'cal-legend-item' }, [
        Utils.el('span', { class: 'dot', style: `background:${r.color}` }),
        Utils.el('span', { text: r.name }),
      ]));
    });
    calCard.appendChild(legend);
    view.appendChild(calCard);

    // ---- acciones ----
    const tplBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '🔁 Repetir plantilla semanal en el mes' });
    tplBtn.addEventListener('click', () => openWeeklyTemplate(mk, () => render(root)));
    view.appendChild(tplBtn);

    const routinesBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: '🏋️ Gestionar rutinas' });
    routinesBtn.addEventListener('click', () => openRoutineList(() => render(root)));
    view.appendChild(routinesBtn);

    root.appendChild(view);
  }

  function openAssignDay(iso, day, mk, onDone) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { text: Utils.friendlyDate(iso) }));
    const routines = DB.getRoutines();
    routines.forEach((r) => {
      const row = Utils.el('button', { class: 'btn-secondary btn-block mt-8', style: `border-left:4px solid ${r.color}` }, [r.name]);
      row.addEventListener('click', () => {
        DB.setPlannedRoutine(iso, r.id);
        Modal.close();
        Utils.toast(`${r.name} asignada`);
        onDone();
      });
      body.appendChild(row);
    });
    const clearBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: 'Quitar asignación' });
    clearBtn.addEventListener('click', () => {
      DB.setPlannedRoutine(iso, null);
      Modal.close();
      onDone();
    });
    body.appendChild(clearBtn);
    Modal.open('Asignar rutina', body);
  }

  function openWeeklyTemplate(mk, onDone) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { text: 'Elige qué rutina va cada día de la semana. Se aplicará a todo el mes actual (puedes ajustar días individuales después).' }));
    const routines = DB.getRoutines();
    const selects = [];
    Utils.DIAS.forEach((dowName, dowIdx) => {
      const sel = Utils.el('select', {});
      sel.appendChild(Utils.el('option', { value: '', text: '— Sin asignar —' }));
      routines.forEach((r) => sel.appendChild(Utils.el('option', { value: r.id, text: r.name })));
      selects[dowIdx] = sel;
      body.appendChild(Utils.el('div', { class: 'field' }, [
        Utils.el('label', { text: dowName }),
        sel,
      ]));
    });
    const applyBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Aplicar al mes' });
    applyBtn.addEventListener('click', () => {
      const [year, month1] = mk.split('-').map(Number);
      const month0 = month1 - 1;
      const totalDays = Utils.daysInMonth(year, month0);
      for (let day = 1; day <= totalDays; day++) {
        const dow = new Date(year, month0, day).getDay();
        const val = selects[dow].value;
        DB.setPlannedRoutine(`${year}-${Utils.pad(month1)}-${Utils.pad(day)}`, val || null);
      }
      Modal.close();
      Utils.toast('Plantilla aplicada a todo el mes');
      onDone();
    });
    body.appendChild(applyBtn);
    Modal.open('Plantilla semanal', body);
  }

  // ---------- Gestión de rutinas ----------
  // plantillas para empezar una rutina con ejercicios ya puestos (solo usa los que existen en tu catálogo)
  const ROUTINE_STARTERS = [
    { name: 'Push (Empuje)', items: [['ex_press_banca', 4, '8-10'], ['ex_press_inclinado', 3, '10-12'], ['ex_press_militar', 3, '8-10'], ['ex_elevaciones_laterales', 3, '12-15'], ['ex_press_frances', 3, '10-12']] },
    { name: 'Pull (Jalón)', items: [['ex_dominadas', 4, '6-10'], ['ex_remo_barra', 4, '8-10'], ['ex_jalon_pecho', 3, '10-12'], ['ex_curl_biceps', 3, '10-12']] },
    { name: 'Piernas', items: [['ex_sentadilla', 4, '8-10'], ['ex_prensa', 3, '10-12'], ['ex_curl_femoral', 3, '10-12'], ['ex_elevacion_talones', 3, '12-15']] },
    { name: 'Torso', items: [['ex_press_banca', 3, '8-10'], ['ex_remo_barra', 3, '8-10'], ['ex_press_militar', 3, '8-10'], ['ex_jalon_pecho', 3, '10-12'], ['ex_curl_biceps', 2, '10-12'], ['ex_extension_triceps', 2, '10-12']] },
  ];

  function routineSummary(r) {
    const exs = DB.getExercises();
    const by = {};
    let sets = 0;
    r.exercises.forEach((re) => {
      const ex = exs.find((e) => e.id === re.exerciseId);
      if (!ex || ex.group === 'cardio') return;
      by[ex.group] = (by[ex.group] || 0) + (Number(re.targetSets) || 0);
      sets += Number(re.targetSets) || 0;
    });
    return { by, sets };
  }

  function openRoutineList(onDone) {
    const body = Utils.el('div');
    function refresh() {
      body.innerHTML = '';
      const routines = DB.getRoutines();
      routines.forEach((r) => {
        const { by, sets } = routineSummary(r);
        const row = Utils.el('div', { class: 'rt-card', style: `--gc:${r.color}` }, [
          Utils.el('div', { class: 'rt-card-top' }, [
            Utils.el('div', { style: 'min-width:0;' }, [
              Utils.el('div', { class: 'rt-card-name', text: r.name }),
              Utils.el('div', { class: 'meta', text: r.exercises.length ? `${r.exercises.length} ejercicio${r.exercises.length === 1 ? '' : 's'}${sets ? ` · ${sets} series` : ''}` : 'Día de descanso / sin ejercicios' }),
            ]),
            Utils.el('div', { class: 'rt-card-btns' }, [
              Utils.el('button', { class: 'btn-small', text: 'Editar' }),
              Utils.el('button', { class: 'icon-btn', text: '⧉', title: 'Duplicar' }),
              Utils.el('button', { class: 'icon-btn', text: '🗑️', title: 'Eliminar' }),
            ]),
          ]),
          Object.keys(by).length ? Utils.el('div', { class: 'rt-summary' }, Object.keys(by).map((g) => Utils.el('span', { class: 'rt-pill', style: `color:${Utils.GROUP_COLORS[g] || '#8d95a8'}`, text: `${g} ${by[g]}` }))) : null,
        ]);
        const [edit, dup, del] = row.querySelectorAll('button');
        edit.addEventListener('click', () => openRoutineEditor(r.id, refresh));
        dup.addEventListener('click', () => {
          const all = DB.getRoutines();
          const copy = { id: DB.uid(), name: `${r.name} (copia)`, color: r.color, exercises: r.exercises.map((e) => Object.assign({}, e)) };
          all.push(copy);
          DB.saveRoutines(all);
          Utils.toast('Rutina duplicada');
          openRoutineEditor(copy.id, refresh);
        });
        del.addEventListener('click', () => {
          if (!Utils.confirmDialog(`¿Eliminar la rutina "${r.name}"? Esto no borra tu historial ya registrado.`)) return;
          DB.saveRoutines(DB.getRoutines().filter((x) => x.id !== r.id));
          refresh();
          onDone();
        });
        body.appendChild(row);
      });
      const addBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '➕ Nueva rutina' });
      addBtn.addEventListener('click', () => openNewRoutine(refresh, onDone));
      body.appendChild(addBtn);
    }
    refresh();
    Modal.open('Mis rutinas', body, { onClose: onDone });
  }

  // elegir cómo empezar: en blanco o con una plantilla
  function openNewRoutine(refresh, onDone) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: '¿Cómo quieres empezar? Luego puedes cambiar todo.' }));
    const exs = DB.getExercises();
    const make = (name, items) => {
      const routines = DB.getRoutines();
      const COLS = COLORS;
      const newR = { id: DB.uid(), name, color: COLS[routines.length % COLS.length], exercises: items };
      routines.push(newR);
      DB.saveRoutines(routines);
      openRoutineEditor(newR.id, refresh);
    };
    const blank = Utils.el('button', { class: 'btn-secondary btn-block', text: '📄 En blanco' });
    blank.addEventListener('click', () => make('Nueva rutina', []));
    body.appendChild(blank);
    ROUTINE_STARTERS.forEach((t) => {
      const items = t.items.filter(([id]) => exs.some((e) => e.id === id)).map(([id, n, reps]) => ({ exerciseId: id, targetSets: n, targetReps: reps }));
      if (items.length < 2) return;
      const b = Utils.el('button', { class: 'btn-secondary btn-block', text: `${t.name} · ${items.length} ejercicios` });
      b.addEventListener('click', () => make(t.name, items));
      body.appendChild(b);
    });
    const cancel = Utils.el('button', { class: 'link-btn small', style: 'margin-top:10px;', text: '← Volver' });
    cancel.addEventListener('click', () => openRoutineList(onDone));
    body.appendChild(cancel);
    Modal.open('Nueva rutina', body, { onClose: onDone });
  }

  const EDITOR_GROUPS = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];
  let lastPickedGroup = null;

  function openRoutineEditor(routineId, onDone) {
    const routines = DB.getRoutines();
    const r = routines.find((x) => x.id === routineId);
    if (!r) return;
    const save = () => DB.saveRoutines(routines);
    const exById = () => {
      const m = {};
      DB.getExercises().forEach((e) => { m[e.id] = e; });
      return m;
    };
    const body = Utils.el('div');

    // ---- nombre y color ----
    const nameInput = Utils.el('input', { type: 'text', value: r.name });
    nameInput.addEventListener('change', () => { r.name = nameInput.value || 'Sin nombre'; save(); });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre' }), nameInput]));

    const colorRow = Utils.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });
    const paintDots = () => dots.forEach((d, i) => { d.style.outline = COLORS[i] === r.color ? '2px solid white' : 'none'; });
    const dots = COLORS.map((c) => {
      const dot = Utils.el('button', { style: `width:28px;height:28px;border-radius:50%;background:${c};` });
      dot.addEventListener('click', () => { r.color = c; save(); paintDots(); });
      colorRow.appendChild(dot);
      return dot;
    });
    paintDots();
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Color' }), colorRow]));

    // ---- lista de ejercicios (se edita en el lugar) ----
    body.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: 'EJERCICIOS DE LA RUTINA' }));
    const summary = Utils.el('div', { class: 'rt-summary' });
    const exList = Utils.el('div');
    body.appendChild(summary);
    body.appendChild(exList);

    function renderSummary() {
      const exs = exById();
      const by = {};
      r.exercises.forEach((re) => {
        const ex = exs[re.exerciseId];
        if (!ex || ex.group === 'cardio') return;
        by[ex.group] = (by[ex.group] || 0) + (Number(re.targetSets) || 0);
      });
      summary.innerHTML = '';
      const total = Object.values(by).reduce((a, b) => a + b, 0);
      if (!total) return;
      summary.appendChild(Utils.el('span', { class: 'rt-total', text: `${total} series` }));
      Object.keys(by).forEach((g) => {
        summary.appendChild(Utils.el('span', { class: 'rt-pill', style: `color:${Utils.GROUP_COLORS[g] || '#8d95a8'}`, text: `${g} ${by[g]}` }));
      });
    }

    function renderList() {
      const exs = exById();
      exList.innerHTML = '';
      if (r.exercises.length === 0) {
        exList.appendChild(Utils.el('div', { class: 'small text-dim', style: 'padding:10px 0;', text: 'Aún no hay ejercicios. Agrégalos abajo.' }));
      }
      r.exercises.forEach((re, idx) => {
        const ex = exs[re.exerciseId];
        const group = ex ? ex.group : 'otro';
        const isCardio = group === 'cardio';

        const setsIn = Utils.el('input', { type: 'number', min: '1', inputmode: 'numeric', value: String(re.targetSets || 1), title: 'Series' });
        setsIn.addEventListener('change', () => {
          re.targetSets = Math.max(1, Math.round(Number(setsIn.value) || 1));
          setsIn.value = re.targetSets;
          save();
          renderSummary();
        });
        const repsIn = Utils.el('input', { type: 'text', value: String(re.targetReps || ''), title: isCardio ? 'Duración / distancia' : 'Reps', placeholder: isCardio ? 'ej. 20 min' : 'ej. 8-10' });
        repsIn.addEventListener('change', () => { re.targetReps = repsIn.value.trim() || (isCardio ? '' : '10'); save(); });

        const up = Utils.el('button', { class: 'icon-btn', text: '▲', title: 'Subir' });
        const down = Utils.el('button', { class: 'icon-btn', text: '▼', title: 'Bajar' });
        const del = Utils.el('button', { class: 'icon-btn', text: '✕', title: 'Quitar' });
        up.disabled = idx === 0;
        down.disabled = idx === r.exercises.length - 1;
        const move = (to) => {
          const [item] = r.exercises.splice(idx, 1);
          r.exercises.splice(to, 0, item);
          save();
          renderList();
        };
        up.addEventListener('click', () => move(idx - 1));
        down.addEventListener('click', () => move(idx + 1));
        del.addEventListener('click', () => { r.exercises.splice(idx, 1); save(); renderList(); fillExercises(); });

        const color = Utils.GROUP_COLORS[group] || '#8d95a8';
        exList.appendChild(Utils.el('div', { class: 'rt-row', style: `--gc:${color}` }, [
          Utils.el('div', { class: 'rt-top' }, [
            Utils.el('span', { class: 'rt-num', text: String(idx + 1) }),
            Utils.el('div', { class: 'rt-name' }, [
              Utils.el('div', { text: ex ? ex.name : '(eliminado)' }),
              Utils.el('div', { class: 'rt-group', text: group }),
            ]),
            Utils.el('div', { class: 'rt-actions' }, [up, down, del]),
          ]),
          Utils.el('div', { class: 'rt-edit' }, [
            isCardio ? null : Utils.el('label', {}, [Utils.el('span', { text: 'Series' }), setsIn]),
            Utils.el('label', { class: 'grow' }, [Utils.el('span', { text: isCardio ? 'Duración / distancia' : 'Reps' }), repsIn]),
          ]),
        ]));
      });
      renderSummary();
    }

    // ---- agregar ejercicio: primero grupo muscular, luego ejercicio ----
    body.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: 'AGREGAR EJERCICIO' }));
    const chipsRow = Utils.el('div', { class: 'rt-chips' });
    const exSelect = Utils.el('select', {});
    const setsInput = Utils.el('input', { type: 'number', min: '1', inputmode: 'numeric', value: '3' });
    const repsInput = Utils.el('input', { type: 'text', value: '10' });
    const repsLabel = Utils.el('label', { text: 'Reps objetivo' });
    const setsField = Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Series' }), setsInput]);
    const repsField = Utils.el('div', { class: 'field' }, [repsLabel, repsInput]);
    let group = null;

    function groupsAvailable() {
      const present = new Set(DB.getExercises().map((e) => e.group));
      return EDITOR_GROUPS.filter((g) => present.has(g)).concat([...present].filter((g) => !EDITOR_GROUPS.includes(g)));
    }

    function fillExercises() {
      const used = new Set(r.exercises.map((re) => re.exerciseId));
      exSelect.innerHTML = '';
      DB.getExercises().filter((e) => e.group === group)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .forEach((ex) => exSelect.appendChild(Utils.el('option', { value: ex.id, text: (ex.unilateral ? `${ex.name} (unilateral)` : ex.name) + (used.has(ex.id) ? '  ✓ ya está' : '') })));
      const isCardio = group === 'cardio';
      setsField.classList.toggle('hidden', isCardio);
      if (isCardio) {
        setsInput.value = '1';
        repsLabel.textContent = 'Duración / distancia objetivo';
        repsInput.placeholder = 'ej. 20-30 min ó 5 km';
        if (repsInput.value === '10') repsInput.value = '';
      } else {
        repsLabel.textContent = 'Reps objetivo';
        repsInput.placeholder = 'Reps (ej. 8-10)';
        if (repsInput.value === '') repsInput.value = '10';
        if (setsInput.value === '1') setsInput.value = '3';
      }
    }

    function paintChips() {
      chipsRow.innerHTML = '';
      groupsAvailable().forEach((g) => {
        const color = Utils.GROUP_COLORS[g] || '#8d95a8';
        const chip = Utils.el('button', { type: 'button', class: `rt-chip${g === group ? ' active' : ''}`, style: `--gc:${color}`, text: g });
        chip.addEventListener('click', () => { group = g; lastPickedGroup = g; paintChips(); fillExercises(); });
        chipsRow.appendChild(chip);
      });
    }

    const avail = groupsAvailable();
    group = avail.includes(lastPickedGroup) ? lastPickedGroup : avail[0];
    paintChips();
    fillExercises();

    body.appendChild(chipsRow);
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Ejercicio' }), exSelect]));
    body.appendChild(Utils.el('div', { class: 'field-row' }, [setsField, repsField]));
    const addExBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '➕ Agregar a la rutina' });
    addExBtn.addEventListener('click', () => {
      if (!exSelect.value) return;
      const isCardio = group === 'cardio';
      r.exercises.push({
        exerciseId: exSelect.value,
        targetSets: isCardio ? 1 : Math.max(1, Math.round(Number(setsInput.value) || 3)),
        targetReps: repsInput.value.trim() || (isCardio ? '' : '10'),
      });
      save();
      renderList();
      fillExercises();
      if (exList.lastElementChild) exList.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
    body.appendChild(addExBtn);
    const libBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '📚 Biblioteca de ejercicios y máquinas' });
    libBtn.addEventListener('click', () => ExerciseUI.openLibrary({ onClose: () => openRoutineEditor(routineId, onDone) }));
    const newExBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '✍️ Crear ejercicio propio' });
    newExBtn.addEventListener('click', () => ExerciseUI.openForm(null, (ex) => { if (ex) lastPickedGroup = ex.group; openRoutineEditor(routineId, onDone); }, { group }));
    body.appendChild(libBtn);
    body.appendChild(newExBtn);

    renderList();
    Modal.open(`Editar: ${r.name}`, body, { onClose: onDone });
  }

  return { render };
})();
