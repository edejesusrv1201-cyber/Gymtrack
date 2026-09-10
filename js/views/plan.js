/* ============================================================
   views/plan.js — Plan mensual: qué rutina toca cada día
   ============================================================ */

const PlanView = (() => {
  let cursor = new Date(); // mes que se está viendo
  const COLORS = ['#e0663d', '#3d8de0', '#5fbf6f', '#e0c23d', '#c26fe0', '#e05a5a', '#7a7a85', '#3de0c2'];

  function getPlan(mk) {
    const plans = DB.getMonthlyPlans();
    if (!plans[mk]) plans[mk] = { days: {} };
    return plans[mk];
  }
  function savePlans(plans) { DB.saveMonthlyPlans(plans); }

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
    for (let day = 1; day <= totalDays; day++) {
      const iso = `${year}-${Utils.pad(month0 + 1)}-${Utils.pad(day)}`;
      const routineId = plan.days[String(day)];
      const routine = routineId ? DB.getRoutines().find((r) => r.id === routineId) : null;
      const cell = Utils.el('div', { class: 'cal-day' + (iso === todayIso ? ' today' : '') }, [
        Utils.el('div', { text: String(day) }),
        routine ? Utils.el('div', { class: 'dot', style: `background:${routine.color}` }) : null,
      ]);
      cell.addEventListener('click', () => openAssignDay(iso, day, mk, () => render(root)));
      grid.appendChild(cell);
    }
    calCard.appendChild(grid);

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
        const plans = DB.getMonthlyPlans();
        const plan = getPlan(mk);
        plans[mk] = plan;
        plan.days[String(day)] = r.id;
        savePlans(plans);
        Modal.close();
        onDone();
      });
      body.appendChild(row);
    });
    const clearBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: 'Quitar asignación' });
    clearBtn.addEventListener('click', () => {
      const plans = DB.getMonthlyPlans();
      const plan = getPlan(mk);
      plans[mk] = plan;
      delete plan.days[String(day)];
      savePlans(plans);
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
      const plans = DB.getMonthlyPlans();
      const plan = getPlan(mk);
      plans[mk] = plan;
      for (let day = 1; day <= totalDays; day++) {
        const dow = new Date(year, month0, day).getDay();
        const val = selects[dow].value;
        if (val) plan.days[String(day)] = val;
        else delete plan.days[String(day)];
      }
      savePlans(plans);
      Modal.close();
      Utils.toast('Plantilla aplicada a todo el mes');
      onDone();
    });
    body.appendChild(applyBtn);
    Modal.open('Plantilla semanal', body);
  }

  // ---------- Gestión de rutinas ----------
  function openRoutineList(onDone) {
    const body = Utils.el('div');
    function refresh() {
      body.innerHTML = '';
      DB.getRoutines().forEach((r) => {
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: r.name, style: `color:${r.color};font-weight:600;` }),
            Utils.el('div', { class: 'meta', text: `${r.exercises.length} ejercicios` }),
          ]),
          Utils.el('div', {}, [
            Utils.el('button', { class: 'btn-small', text: 'Editar', style: 'margin-right:6px;' }),
            Utils.el('button', { class: 'btn-small', text: '🗑️' }),
          ]),
        ]);
        row.querySelectorAll('button')[0].addEventListener('click', () => openRoutineEditor(r.id, refresh));
        row.querySelectorAll('button')[1].addEventListener('click', () => {
          if (!Utils.confirmDialog(`¿Eliminar la rutina "${r.name}"? Esto no borra tu historial ya registrado.`)) return;
          const routines = DB.getRoutines().filter((x) => x.id !== r.id);
          DB.saveRoutines(routines);
          refresh();
          onDone();
        });
        body.appendChild(row);
      });
      const addBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '➕ Nueva rutina' });
      addBtn.addEventListener('click', () => {
        const routines = DB.getRoutines();
        const newR = { id: DB.uid(), name: 'Nueva rutina', color: COLORS[routines.length % COLORS.length], exercises: [] };
        routines.push(newR);
        DB.saveRoutines(routines);
        openRoutineEditor(newR.id, refresh);
      });
      body.appendChild(addBtn);
    }
    refresh();
    Modal.open('Mis rutinas', body, { onClose: onDone });
  }

  function openRoutineEditor(routineId, onDone) {
    const routines = DB.getRoutines();
    const r = routines.find((x) => x.id === routineId);
    if (!r) return;
    const body = Utils.el('div');

    const nameInput = Utils.el('input', { type: 'text', value: r.name });
    nameInput.addEventListener('change', () => { r.name = nameInput.value || 'Sin nombre'; DB.saveRoutines(routines); });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre' }), nameInput]));

    const colorRow = Utils.el('div', { style: 'display:flex;gap:6px;flex-wrap:wrap;' });
    COLORS.forEach((c) => {
      const dot = Utils.el('button', { style: `width:28px;height:28px;border-radius:50%;background:${c};${c === r.color ? 'outline:2px solid white;' : ''}` });
      dot.addEventListener('click', () => { r.color = c; DB.saveRoutines(routines); openRoutineEditor(routineId, onDone); });
      colorRow.appendChild(dot);
    });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Color' }), colorRow]));

    body.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: 'EJERCICIOS DE LA RUTINA' }));
    const exList = Utils.el('div');
    r.exercises.forEach((re, idx) => {
      const ex = DB.getExercises().find((e) => e.id === re.exerciseId);
      const row = Utils.el('div', { class: 'list-item' }, [
        Utils.el('span', { text: ex ? ex.name : '(eliminado)' }),
        Utils.el('span', { class: 'meta', text: `${re.targetSets}x ${re.targetReps}` }),
        Utils.el('button', { class: 'icon-btn', text: '✕' }),
      ]);
      row.querySelector('button').addEventListener('click', () => {
        r.exercises.splice(idx, 1);
        DB.saveRoutines(routines);
        openRoutineEditor(routineId, onDone);
      });
      exList.appendChild(row);
    });
    body.appendChild(exList);

    const addRow = Utils.el('div', { class: 'field-row mt-8' });
    const exSelect = Utils.el('select', {});
    DB.getExercises().forEach((ex) => exSelect.appendChild(Utils.el('option', { value: ex.id, text: ex.name })));
    const setsInput = Utils.el('input', { type: 'number', placeholder: 'Series', value: '3', style: 'width:70px;' });
    const repsInput = Utils.el('input', { type: 'text', placeholder: 'Reps (ej. 8-10)', value: '10', style: 'width:100px;' });
    addRow.appendChild(exSelect);
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Agregar ejercicio' }), exSelect]));
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Series' }), setsInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Reps objetivo' }), repsInput]),
    ]));
    const addExBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '➕ Agregar a la rutina' });
    addExBtn.addEventListener('click', () => {
      if (!exSelect.value) return;
      r.exercises.push({ exerciseId: exSelect.value, targetSets: Number(setsInput.value) || 3, targetReps: repsInput.value || '10' });
      DB.saveRoutines(routines);
      openRoutineEditor(routineId, onDone);
    });
    body.appendChild(addExBtn);

    Modal.open(`Editar: ${r.name}`, body, { onClose: onDone });
  }

  return { render };
})();
