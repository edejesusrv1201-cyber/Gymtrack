/* ============================================================
   views/calories.js — Conteo de calorías con lista de alimentos
   frecuentes reutilizables
   ============================================================ */

const CaloriesView = (() => {
  const MEALS = [
    { key: 'desayuno', label: 'Desayuno' },
    { key: 'almuerzo', label: 'Almuerzo' },
    { key: 'cena', label: 'Cena' },
    { key: 'snack', label: 'Snacks' },
  ];

  let cursorIso = Utils.todayISO();

  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();
    const calorieLog = DB.getCalorieLog();
    const entries = calorieLog[cursorIso] || [];

    const nav = Utils.el('div', { class: 'flex-between' }, [
      Utils.el('button', { class: 'btn-small', text: '←', onclick: () => { shiftDay(-1, root); } }),
      Utils.el('h3', { class: 'mb-0', text: Utils.friendlyDate(cursorIso) }),
      Utils.el('button', { class: 'btn-small', text: '→', onclick: () => { shiftDay(1, root); } }),
    ]);
    view.appendChild(nav);

    const calcBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: '🧮 Calculadora de mantenimiento / déficit / superávit' });
    calcBtn.addEventListener('click', () => App.navigate('calculadora'));
    view.appendChild(calcBtn);

    // ---- resumen ----
    const totals = entries.reduce((acc, e) => ({
      kcal: acc.kcal + e.kcal, protein: acc.protein + e.protein, carbs: acc.carbs + e.carbs, fat: acc.fat + e.fat,
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

    const summary = Utils.el('div', { class: 'card mt-8' });
    summary.appendChild(Utils.el('div', { class: 'grid-2' }, [
      Utils.el('div', { class: 'stat-box' }, [
        Utils.el('div', { class: 'val', text: `${Math.round(totals.kcal)}` }),
        Utils.el('div', { class: 'lbl', text: `de ${settings.calorieGoal} kcal` }),
      ]),
      Utils.el('div', { class: 'stat-box' }, [
        Utils.el('div', { class: 'val', text: `${Math.max(0, settings.calorieGoal - Math.round(totals.kcal))}` }),
        Utils.el('div', { class: 'lbl', text: 'kcal restantes' }),
      ]),
    ]));
    [['Proteína', totals.protein, settings.proteinGoal, '#c26fe0'],
      ['Carbohidratos', totals.carbs, settings.carbGoal, '#3d8de0'],
      ['Grasas', totals.fat, settings.fatGoal, '#e0c23d']].forEach(([label, val, goal, color]) => {
      const pct = Math.min(100, Math.round((val / goal) * 100)) || 0;
      summary.appendChild(Utils.el('div', { class: 'mt-8' }, [
        Utils.el('div', { class: 'flex-between small' }, [
          Utils.el('span', { text: label }),
          Utils.el('span', { class: 'text-dim', text: `${Utils.round1(val)}g / ${goal}g` }),
        ]),
        Utils.el('div', { class: 'macro-bar' }, [
          Utils.el('div', { class: 'macro-bar-fill', style: `width:${pct}%;background:${color};` }),
        ]),
      ]));
    });
    view.appendChild(summary);

    // ---- comidas ----
    MEALS.forEach((meal) => {
      const mealEntries = entries.filter((e) => e.meal === meal.key);
      const mealKcal = mealEntries.reduce((s, e) => s + e.kcal, 0);
      const card = Utils.el('div', { class: 'card meal-group' });
      card.appendChild(Utils.el('h4', {}, [
        Utils.el('span', { text: meal.label }),
        Utils.el('span', { class: 'text-dim', text: `${Math.round(mealKcal)} kcal` }),
      ]));
      mealEntries.forEach((e) => {
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: e.foodName }),
            Utils.el('div', { class: 'meta', text: `${e.servings}x · ${Math.round(e.kcal)} kcal` }),
          ]),
          Utils.el('button', { class: 'icon-btn', text: '✕' }),
        ]);
        row.querySelector('button').addEventListener('click', () => {
          const log = DB.getCalorieLog();
          log[cursorIso] = (log[cursorIso] || []).filter((x) => x.id !== e.id);
          DB.saveCalorieLog(log);
          render(root);
        });
        card.appendChild(row);
      });
      const addBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: `➕ Agregar a ${meal.label.toLowerCase()}` });
      addBtn.addEventListener('click', () => openAddFood(meal.key, () => render(root)));
      card.appendChild(addBtn);
      view.appendChild(card);
    });

    const manageBtn = Utils.el('button', { class: 'btn-secondary btn-block mt-8', text: '🍎 Gestionar mis alimentos' });
    manageBtn.addEventListener('click', () => openFoodManager(() => render(root)));
    view.appendChild(manageBtn);

    root.appendChild(view);
  }

  function shiftDay(delta, root) {
    const d = Utils.parseISO(cursorIso);
    d.setDate(d.getDate() + delta);
    cursorIso = Utils.toISODate(d);
    render(root);
  }

  function openAddFood(mealKey, onDone) {
    const body = Utils.el('div');
    const searchInput = Utils.el('input', { type: 'text', placeholder: 'Buscar alimento...' });
    body.appendChild(searchInput);
    const listWrap = Utils.el('div', { class: 'mt-8' });
    body.appendChild(listWrap);

    function renderList(filter) {
      listWrap.innerHTML = '';
      const foods = DB.getFoods().filter((f) => !filter || f.name.toLowerCase().includes(filter.toLowerCase()));
      if (foods.length === 0) {
        listWrap.appendChild(Utils.el('p', { text: 'No hay alimentos guardados con ese nombre.' }));
      }
      foods.forEach((f) => {
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: f.name }),
            Utils.el('div', { class: 'meta', text: `${f.kcal} kcal / ${f.servingLabel}` }),
          ]),
          Utils.el('button', { class: 'btn-small', text: '+' }),
        ]);
        row.querySelector('button').addEventListener('click', () => openQuantityPrompt(f, mealKey, onDone));
        listWrap.appendChild(row);
      });
    }
    renderList('');
    searchInput.addEventListener('input', () => renderList(searchInput.value));

    const customBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '✍️ Registrar alimento nuevo' });
    customBtn.addEventListener('click', () => { Modal.close(); openFoodForm(null, (food) => openQuantityPrompt(food, mealKey, onDone)); });
    body.appendChild(customBtn);

    Modal.open('Agregar alimento', body);
  }

  function openQuantityPrompt(food, mealKey, onDone) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { text: `${food.name} — ${food.kcal} kcal por ${food.servingLabel}` }));
    const qtyInput = Utils.el('input', { type: 'number', value: '1', step: '0.25', min: '0.25' });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Cantidad (en unidades de "${food.servingLabel}")` }), qtyInput]));
    const confirmBtn = Utils.el('button', { class: 'btn-primary btn-block', text: 'Agregar al registro' });
    confirmBtn.addEventListener('click', () => {
      const servings = parseFloat(qtyInput.value) || 1;
      const log = DB.getCalorieLog();
      log[cursorIso] = log[cursorIso] || [];
      log[cursorIso].push({
        id: DB.uid(), foodId: food.id, foodName: food.name, servings,
        kcal: food.kcal * servings, protein: (food.protein || 0) * servings,
        carbs: (food.carbs || 0) * servings, fat: (food.fat || 0) * servings,
        meal: mealKey, time: new Date().toISOString(),
      });
      DB.saveCalorieLog(log);
      Modal.close();
      onDone();
    });
    body.appendChild(confirmBtn);
    Modal.open('¿Cuánto comiste?', body);
  }

  function openFoodForm(existing, onSaved) {
    const body = Utils.el('div');
    const nameInput = Utils.el('input', { type: 'text', value: existing ? existing.name : '' });
    const servingInput = Utils.el('input', { type: 'text', value: existing ? existing.servingLabel : '100g', placeholder: 'ej. 100g, 1 taza, 1 unidad' });
    const kcalInput = Utils.el('input', { type: 'number', value: existing ? existing.kcal : '' });
    const proteinInput = Utils.el('input', { type: 'number', value: existing ? existing.protein : '0' });
    const carbsInput = Utils.el('input', { type: 'number', value: existing ? existing.carbs : '0' });
    const fatInput = Utils.el('input', { type: 'number', value: existing ? existing.fat : '0' });

    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre del alimento' }), nameInput]));
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Tamaño de la porción' }), servingInput]));
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Calorías por porción (kcal)' }), kcalInput]));
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Proteína (g)' }), proteinInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Carbos (g)' }), carbsInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grasas (g)' }), fatInput]),
    ]));

    const saveBtn = Utils.el('button', { class: 'btn-primary btn-block', text: 'Guardar en mis alimentos' });
    saveBtn.addEventListener('click', () => {
      if (!nameInput.value.trim() || !kcalInput.value) { Utils.toast('Falta el nombre o las calorías'); return; }
      const foods = DB.getFoods();
      let food;
      if (existing) {
        food = foods.find((f) => f.id === existing.id);
      } else {
        food = { id: DB.uid() };
        foods.push(food);
      }
      Object.assign(food, {
        name: nameInput.value.trim(),
        servingLabel: servingInput.value.trim() || '1 porción',
        kcal: parseFloat(kcalInput.value) || 0,
        protein: parseFloat(proteinInput.value) || 0,
        carbs: parseFloat(carbsInput.value) || 0,
        fat: parseFloat(fatInput.value) || 0,
      });
      DB.saveFoods(foods);
      Modal.close();
      if (onSaved) onSaved(food);
    });
    body.appendChild(saveBtn);
    Modal.open(existing ? 'Editar alimento' : 'Nuevo alimento', body);
  }

  function openFoodManager(onDone) {
    const body = Utils.el('div');
    function refresh() {
      body.innerHTML = '';
      const foods = DB.getFoods();
      if (foods.length === 0) body.appendChild(Utils.el('p', { text: 'Aún no tienes alimentos guardados.' }));
      foods.forEach((f) => {
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: f.name }),
            Utils.el('div', { class: 'meta', text: `${f.kcal} kcal / ${f.servingLabel}` }),
          ]),
          Utils.el('div', {}, [
            Utils.el('button', { class: 'btn-small', text: 'Editar', style: 'margin-right:6px;' }),
            Utils.el('button', { class: 'btn-small', text: '🗑️' }),
          ]),
        ]);
        row.querySelectorAll('button')[0].addEventListener('click', () => { Modal.close(); openFoodForm(f, () => openFoodManager(onDone)); });
        row.querySelectorAll('button')[1].addEventListener('click', () => {
          if (!Utils.confirmDialog(`¿Eliminar "${f.name}" de tus alimentos?`)) return;
          DB.saveFoods(DB.getFoods().filter((x) => x.id !== f.id));
          refresh();
        });
        body.appendChild(row);
      });
      const addBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: '➕ Nuevo alimento' });
      addBtn.addEventListener('click', () => { Modal.close(); openFoodForm(null, () => openFoodManager(onDone)); });
      body.appendChild(addBtn);
    }
    refresh();
    Modal.open('Mis alimentos', body, { onClose: onDone });
  }

  return { render };
})();
