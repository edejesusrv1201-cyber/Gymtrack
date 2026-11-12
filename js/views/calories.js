/* ============================================================
   views/calories.js — Conteo de calorías y macros.
   Base de alimentos incluida (en gramos), favoritos, recientes,
   copiar comidas, plantillas, metas y resumen de la semana.
   ============================================================ */

const CaloriesView = (() => {
  const MEALS = [
    { key: 'desayuno', label: 'Desayuno', icon: '🌅' },
    { key: 'almuerzo', label: 'Almuerzo', icon: '☀️' },
    { key: 'cena', label: 'Cena', icon: '🌙' },
    { key: 'snack', label: 'Snacks', icon: '🍎' },
  ];
  const MACRO_COLORS = { protein: '#c26fe0', carbs: '#3d8de0', fat: '#e0c23d' };

  let cursorIso = Utils.todayISO();
  let lastFilter = null; // pestaña elegida en "Agregar alimento"
  let rootRef = null;

  const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const r0 = (n) => Math.round(Number(n) || 0);
  const mealOf = (key) => MEALS.find((m) => m.key === key) || MEALS[3];

  // comida sugerida según la hora (si estás viendo hoy)
  function defaultMeal() {
    const h = new Date().getHours();
    if (h < 10) return 'desayuno';
    if (h < 15) return 'almuerzo';
    if (h < 18) return 'snack';
    return 'cena';
  }

  const entriesOf = (iso) => DB.getCalorieLog()[iso] || [];
  function saveEntries(iso, list) {
    const log = DB.getCalorieLog();
    if (list.length) log[iso] = list; else delete log[iso];
    DB.saveCalorieLog(log);
  }
  const sumOf = (list) => list.reduce((a, e) => ({
    kcal: a.kcal + (e.kcal || 0), protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  function qtyText(e) {
    if (e.grams) return `${r1(e.grams)} g`;
    const s = Number(e.servings) || 1;
    return `${s === 1 ? '1 porción' : `${r1(s)} porciones`}`;
  }

  const refresh = () => { if (rootRef) render(rootRef); };

  // ---------------------------------------------------------------- pantalla
  function render(root) {
    rootRef = root;
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();
    const entries = entriesOf(cursorIso);
    const isToday = cursorIso === Utils.todayISO();

    // ---- día ----
    const dayNav = Utils.el('div', { class: 'day-nav' }, [
      Utils.el('button', { class: 'btn-small', text: '←', onclick: () => shiftDay(-1) }),
      Utils.el('div', { class: 'day-title' }, [
        Utils.el('div', { class: 'h', text: Utils.friendlyDate(cursorIso) }),
        isToday ? null : Utils.el('button', { class: 'link-btn small', text: 'Volver a hoy', onclick: () => { cursorIso = Utils.todayISO(); refresh(); } }),
      ]),
      Utils.el('button', { class: 'btn-small', text: '→', onclick: () => shiftDay(1) }),
    ]);
    view.appendChild(dayNav);

    view.appendChild(renderSummary(settings, entries));

    // ---- acciones principales ----
    const addMain = Utils.el('button', { class: 'btn-primary', text: '➕ Agregar alimento' });
    addMain.addEventListener('click', () => openAddFood(isToday ? defaultMeal() : 'almuerzo'));
    const addQuick = Utils.el('button', { class: 'btn-secondary', text: '⚡ Rápido', title: 'Solo calorías y macros' });
    addQuick.addEventListener('click', () => openQuickAdd(isToday ? defaultMeal() : 'almuerzo'));
    const addScan = Utils.el('button', { class: 'btn-secondary', text: '📷', title: 'Escanear tabla nutricional' });
    addScan.addEventListener('click', () => scanLabel(isToday ? defaultMeal() : 'almuerzo'));
    view.appendChild(Utils.el('div', { class: 'nut-actions' }, [addMain, addQuick, addScan]));

    // ---- comidas ----
    MEALS.forEach((meal) => view.appendChild(renderMeal(meal, entries)));

    view.appendChild(renderWaterCard(cursorIso, settings));
    view.appendChild(renderWeekStrip(settings));

    const manageBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '🍎 Mis alimentos y plantillas' });
    manageBtn.addEventListener('click', () => openFoodManager());
    view.appendChild(manageBtn);
    const calcBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '🧮 Calculadora de mantenimiento / déficit / superávit' });
    calcBtn.addEventListener('click', () => App.navigate('calculadora'));
    view.appendChild(calcBtn);

    root.appendChild(view);
  }

  function shiftDay(delta) {
    const d = Utils.parseISO(cursorIso);
    d.setDate(d.getDate() + delta);
    cursorIso = Utils.toISODate(d);
    refresh();
  }

  // ---------------------------------------------------------------- resumen
  function renderSummary(settings, entries) {
    const t = sumOf(entries);
    const goal = settings.calorieGoal || 0;
    const pct = goal ? t.kcal / goal : 0;
    const over = goal && t.kcal > goal * 1.05;
    const remaining = goal - t.kcal;

    const card = Utils.el('div', { class: 'card nut-summary' });
    card.appendChild(Utils.el('div', { class: 'nut-top' }, [
      Utils.ring(pct, { size: 104, stroke: 11, label: `${r0(t.kcal)}`, sub: 'kcal', from: over ? '#ff5d73' : Utils.accent().a, to: over ? '#ff9aa8' : Utils.accent().c }),
      Utils.el('div', { class: 'nut-rem' }, [
        Utils.el('div', { class: 'eyebrow', text: over ? 'Te pasaste' : 'Te quedan' }),
        Utils.el('div', { class: 'nut-rem-val', text: `${Math.abs(r0(remaining))}` }),
        Utils.el('div', { class: 'small text-dim', text: `de ${goal} kcal` }),
        Utils.el('button', { class: 'link-btn small', text: '✏️ Cambiar metas', onclick: () => openGoals() }),
      ]),
    ]));

    // macros
    const cols = Utils.el('div', { class: 'nut-macros' });
    [['Proteína', 'protein', t.protein, settings.proteinGoal], ['Carbos', 'carbs', t.carbs, settings.carbGoal], ['Grasas', 'fat', t.fat, settings.fatGoal]].forEach(([label, key, val, g]) => {
      const p = g ? Math.min(100, Math.round((val / g) * 100)) : 0;
      const left = g ? Math.round(g - val) : 0;
      cols.appendChild(Utils.el('div', { class: 'nut-macro' }, [
        Utils.el('div', { class: 'nm-label', text: label }),
        Utils.el('div', { class: 'nm-val', text: `${r0(val)}` }),
        Utils.el('div', { class: 'nm-goal', text: `de ${g || 0} g` }),
        Utils.el('div', { class: 'macro-bar' }, [Utils.el('div', { class: 'macro-bar-fill', style: `width:${p}%;background:${MACRO_COLORS[key]};` })]),
        Utils.el('div', { class: 'nm-left', style: left < 0 ? 'color:var(--red)' : '', text: left > 0 ? `faltan ${left} g` : left === 0 ? '✓ meta' : `+${-left} g` }),
      ]));
    });
    card.appendChild(cols);

    // sugerencia
    let hint = '';
    if (!entries.length) hint = 'Empieza agregando tu primera comida del día.';
    else if (over) hint = `Superaste tu meta por ${r0(t.kcal - goal)} kcal.`;
    else if (settings.proteinGoal && t.protein < settings.proteinGoal * 0.7 && t.kcal > goal * 0.5) hint = `Vas corto de proteína: te faltan ${r0(settings.proteinGoal - t.protein)} g.`;
    else if (goal && t.kcal >= goal * 0.9) hint = 'Casi llegas a tu meta del día. 👏';
    if (hint) card.appendChild(Utils.el('div', { class: 'nut-hint', text: hint }));

    // reparto de calorías de macros
    const kP = t.protein * 4; const kC = t.carbs * 4; const kF = t.fat * 9; const kT = kP + kC + kF;
    if (kT > 0) {
      card.appendChild(Utils.el('div', { class: 'nut-split' }, [
        Utils.el('div', { class: 'ns-bar' }, [
          Utils.el('i', { style: `width:${(kP / kT) * 100}%;background:${MACRO_COLORS.protein}` }),
          Utils.el('i', { style: `width:${(kC / kT) * 100}%;background:${MACRO_COLORS.carbs}` }),
          Utils.el('i', { style: `width:${(kF / kT) * 100}%;background:${MACRO_COLORS.fat}` }),
        ]),
        Utils.el('div', { class: 'small text-dim', text: `Proteína ${r0((kP / kT) * 100)}% · Carbos ${r0((kC / kT) * 100)}% · Grasas ${r0((kF / kT) * 100)}%` }),
      ]));
    }
    return card;
  }

  // ---------------------------------------------------------------- comidas
  function renderMeal(meal, entries) {
    const mealEntries = entries.filter((e) => e.meal === meal.key);
    const t = sumOf(mealEntries);
    const card = Utils.el('div', { class: 'card meal-group' });
    card.appendChild(Utils.el('div', { class: 'meal-head' }, [
      Utils.el('div', {}, [
        Utils.el('h4', { class: 'mb-0', text: `${meal.icon} ${meal.label}` }),
        mealEntries.length ? Utils.el('div', { class: 'small text-dim', text: `P ${r0(t.protein)} · C ${r0(t.carbs)} · G ${r0(t.fat)} g` }) : null,
      ]),
      Utils.el('div', { class: 'meal-kcal', text: mealEntries.length ? `${r0(t.kcal)} kcal` : '' }),
    ]));

    mealEntries.forEach((e) => {
      const row = Utils.el('div', { class: 'meal-row' }, [
        Utils.el('div', { class: 'mr-main' }, [
          Utils.el('div', { class: 'mr-name', text: e.foodName }),
          Utils.el('div', { class: 'meta', text: `${qtyText(e)} · P ${r0(e.protein)} · C ${r0(e.carbs)} · G ${r0(e.fat)}` }),
        ]),
        Utils.el('div', { class: 'mr-kcal', text: `${r0(e.kcal)}` }),
        Utils.el('button', { class: 'icon-btn', text: '✕', title: 'Quitar' }),
      ]);
      row.querySelector('button').addEventListener('click', (ev) => {
        ev.stopPropagation();
        saveEntries(cursorIso, entriesOf(cursorIso).filter((x) => x.id !== e.id));
        refresh();
      });
      row.addEventListener('click', () => openEditEntry(e));
      card.appendChild(row);
    });

    const actions = Utils.el('div', { class: 'meal-actions' });
    const add = Utils.el('button', { class: 'btn-secondary', text: '➕ Agregar' });
    add.addEventListener('click', () => openAddFood(meal.key));
    actions.appendChild(add);
    const copy = Utils.el('button', { class: 'btn-secondary', text: '📋 Copiar', title: 'Copiar de otro día' });
    copy.addEventListener('click', () => openCopy(meal.key));
    actions.appendChild(copy);
    if (mealEntries.length >= 2) {
      const tpl = Utils.el('button', { class: 'btn-secondary', text: '💾 Plantilla', title: 'Guardar esta comida para repetirla' });
      tpl.addEventListener('click', () => openSaveTemplate(meal, mealEntries));
      actions.appendChild(tpl);
    }
    card.appendChild(actions);
    return card;
  }

  // ---------------------------------------------------------------- semana
  function renderWeekStrip(settings) {
    const goal = settings.calorieGoal || 0;
    const days = [];
    const end = Utils.parseISO(Utils.todayISO());
    for (let i = 6; i >= 0; i--) {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      const iso = Utils.toISODate(d);
      const list = entriesOf(iso);
      days.push({ iso, d, t: sumOf(list), has: list.length > 0 });
    }
    const logged = days.filter((x) => x.has);
    const max = Math.max(goal * 1.25, ...days.map((x) => x.t.kcal), 1);
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: 'Últimos 7 días' }),
      Utils.el('span', { class: 'eyebrow', text: 'Toca un día' }),
    ]));
    const strip = Utils.el('div', { class: 'wk-strip' });
    days.forEach((x) => {
      const pct = x.t.kcal / max;
      let color = 'rgba(255,255,255,0.18)';
      if (x.has && goal) color = x.t.kcal > goal * 1.1 ? 'var(--red)' : x.t.kcal >= goal * 0.9 ? 'var(--green)' : 'var(--accent-2)';
      const col = Utils.el('button', { class: 'wk-col' + (x.iso === cursorIso ? ' sel' : ''), type: 'button' }, [
        Utils.el('div', { class: 'wk-val', text: x.has ? String(r0(x.t.kcal)) : '' }),
        Utils.el('div', { class: 'wk-bar' }, [
          Utils.el('i', { style: `height:${Math.max(x.has ? 6 : 0, pct * 100)}%;background:${color}` }),
          goal ? Utils.el('b', { style: `bottom:${(goal / max) * 100}%` }) : null,
        ]),
        Utils.el('div', { class: 'wk-day', text: `${Utils.DIAS_CORTOS[x.d.getDay()]}` }),
      ]);
      col.addEventListener('click', () => { cursorIso = x.iso; refresh(); window.scrollTo(0, 0); });
      strip.appendChild(col);
    });
    card.appendChild(strip);
    if (logged.length) {
      const avg = logged.reduce((s, x) => s + x.t.kcal, 0) / logged.length;
      const avgP = logged.reduce((s, x) => s + x.t.protein, 0) / logged.length;
      card.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: `Promedio (${logged.length} día${logged.length === 1 ? '' : 's'} registrado${logged.length === 1 ? '' : 's'}): ${r0(avg)} kcal · ${r0(avgP)} g de proteína` }));
    } else {
      card.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Aún no hay días registrados esta semana.' }));
    }
    return card;
  }

  // ---------------------------------------------------------------- agua
  function renderWaterCard(iso, settings) {
    const entries = DB.getWaterLog()[iso] || [];
    const totalMl = entries.reduce((s, e) => s + e.ml, 0);
    const goalMl = settings.waterGoalMl || 2500;
    const pct = Math.min(100, Math.round((totalMl / goalMl) * 100)) || 0;

    function addWater(ml) {
      const wl = DB.getWaterLog();
      wl[iso] = wl[iso] || [];
      wl[iso].push({ id: DB.uid(), ml, time: new Date().toISOString() });
      DB.saveWaterLog(wl);
      Utils.vibrate(20);
      refresh();
    }

    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'flex-between' }, [
      Utils.el('h3', { class: 'mb-0', text: '💧 Agua' }),
      Utils.el('span', { class: 'pill', text: `${Utils.round1(totalMl / 1000)} L / ${Utils.round1(goalMl / 1000)} L` }),
    ]));
    card.appendChild(Utils.el('div', { class: 'macro-bar mt-8' }, [
      Utils.el('div', { class: 'macro-bar-fill', style: `width:${pct}%;background:var(--accent-2);` }),
    ]));
    const quickRow = Utils.el('div', { class: 'grid-3 mt-8' });
    [[250, '🥛 250 ml'], [500, '🍶 500 ml'], [1000, '🚰 1 L']].forEach(([ml, label]) => {
      const b = Utils.el('button', { class: 'btn-secondary', text: label });
      b.addEventListener('click', () => addWater(ml));
      quickRow.appendChild(b);
    });
    card.appendChild(quickRow);

    const customInput = Utils.el('input', { type: 'number', inputmode: 'numeric', placeholder: 'ml personalizado' });
    const customBtn = Utils.el('button', { class: 'btn-secondary', style: 'width:64px;flex:none;height:46px;', text: '➕' });
    customBtn.addEventListener('click', () => {
      const v = Number(customInput.value);
      if (v > 0) { addWater(v); customInput.value = ''; }
    });
    card.appendChild(Utils.el('div', { class: 'field-row mt-8' }, [Utils.el('div', { class: 'field' }, [customInput]), customBtn]));

    if (entries.length > 0) {
      const undoBtn = Utils.el('button', { class: 'link-btn small mt-8', text: '↩️ Deshacer último' });
      undoBtn.addEventListener('click', () => {
        const wl = DB.getWaterLog();
        wl[iso] = (wl[iso] || []).slice(0, -1);
        DB.saveWaterLog(wl);
        refresh();
      });
      card.appendChild(undoBtn);
    }
    return card;
  }

  // ---------------------------------------------------------------- agregar alimento
  function foodSub(sp) {
    const base = `${r0(sp.kcal)} kcal · P ${r1(sp.protein)} · C ${r1(sp.carbs)} · G ${r1(sp.fat)}`;
    return sp.basis === 'g' ? `${base} / 100 g` : `${base} / ${sp.servingLabel}`;
  }

  function openAddFood(mealKey) {
    const body = Utils.el('div');
    const recents = FoodDB.recentIds().filter((id) => FoodDB.findSpec(id));
    const favs = FoodDB.favorites().filter((id) => FoodDB.findSpec(id));
    const hasMine = DB.getFoods().length > 0;

    const tabs = [];
    if (recents.length) tabs.push({ key: 'recientes', label: '🕘 Recientes' });
    if (favs.length) tabs.push({ key: 'favoritos', label: '⭐ Favoritos' });
    if (hasMine) tabs.push({ key: 'mios', label: '👤 Míos' });
    tabs.push({ key: 'todos', label: 'Todos' });
    FoodDB.CATEGORIES.forEach((c) => tabs.push({ key: `cat:${c.key}`, label: `${c.icon} ${c.label}` }));
    let filter = tabs.some((t) => t.key === lastFilter) ? lastFilter : tabs[0].key;
    let query = '';

    // comida a la que se agrega
    let meal = mealKey;
    const mealSeg = Utils.el('div', { class: 'seg small' });
    const paintMeal = () => mealSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.k === meal));
    MEALS.forEach((m) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': m.key, text: m.label });
      b.addEventListener('click', () => { meal = m.key; paintMeal(); });
      mealSeg.appendChild(b);
    });
    paintMeal();
    body.appendChild(mealSeg);

    const search = Utils.el('input', { type: 'search', placeholder: '🔎 Buscar (ej. pollo, arroz, banano)…', class: 'ax-search' });
    const chipsRow = Utils.el('div', { class: 'rt-chips nut-chips' });
    const listWrap = Utils.el('div');
    body.appendChild(search);
    body.appendChild(chipsRow);
    body.appendChild(listWrap);

    function paintChips() {
      chipsRow.innerHTML = '';
      tabs.forEach((t) => {
        const chip = Utils.el('button', { type: 'button', class: `rt-chip${t.key === filter && !query ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t.label });
        chip.addEventListener('click', () => { filter = t.key; lastFilter = t.key; search.value = ''; query = ''; paintChips(); paintList(); });
        chipsRow.appendChild(chip);
      });
    }

    function row(sp) {
      const fav = FoodDB.favorites().includes(sp.id);
      const star = Utils.el('button', { class: 'star-btn' + (fav ? ' on' : ''), type: 'button', text: fav ? '★' : '☆', title: 'Favorito' });
      star.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const on = FoodDB.toggleFavorite(sp.id);
        star.textContent = on ? '★' : '☆';
        star.classList.toggle('on', on);
      });
      const r = Utils.el('div', { class: 'food-row' }, [
        Utils.el('div', { class: 'fr-main' }, [
          Utils.el('div', { class: 'fr-name' }, [sp.name, sp.combo ? Utils.el('span', { class: 'uni-pill', text: sp.recipe ? 'receta' : 'plantilla' }) : null]),
          Utils.el('div', { class: 'meta', text: foodSub(sp) }),
        ]),
        star,
        Utils.el('span', { class: 'fr-add', text: '+' }),
      ]);
      r.addEventListener('click', () => openQuantity({ sp, meal, onBack: () => openAddFood(meal), after: 'list' }));
      return r;
    }

    function paintList() {
      listWrap.innerHTML = '';
      let items;
      if (query) items = FoodDB.search(query);
      else if (filter === 'recientes') items = recents.map((id) => FoodDB.findSpec(id));
      else if (filter === 'favoritos') items = favs.map((id) => FoodDB.findSpec(id));
      else if (filter === 'mios') items = FoodDB.search('', { onlyMine: true });
      else if (filter.startsWith('cat:')) items = FoodDB.search('', { cat: filter.slice(4) }).sort((a, b) => a.name.localeCompare(b.name, 'es'));
      else items = FoodDB.search('');
      items = items.filter(Boolean);
      if (!items.length) {
        listWrap.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:14px 0;', text: query ? `No encontré "${query}". Puedes crearlo abajo o registrar solo las calorías.` : 'No hay alimentos en esta lista.' }));
      }
      items.forEach((sp) => listWrap.appendChild(row(sp)));
    }

    search.addEventListener('input', () => { query = search.value.trim(); paintChips(); paintList(); });

    const scan = Utils.el('button', { class: 'btn-primary btn-block', text: '📷 Escanear tabla nutricional' });
    scan.addEventListener('click', () => scanLabel(meal));
    body.appendChild(scan);
    const create = Utils.el('button', { class: 'btn-secondary btn-block', text: '✍️ Crear alimento nuevo' });
    create.addEventListener('click', () => openFoodForm(null, (food) => {
      const sp = FoodDB.spec(food);
      openQuantity({ sp, meal, onBack: () => openAddFood(meal), after: 'list' });
    }, query));
    const quick = Utils.el('button', { class: 'btn-secondary btn-block', text: '⚡ Solo calorías y macros (sin guardar)' });
    quick.addEventListener('click', () => openQuickAdd(meal));
    const done = Utils.el('button', { class: 'btn-primary btn-block', text: 'Listo' });
    done.addEventListener('click', () => Modal.close());
    const recipeBtn = Utils.el('button', { class: 'btn-secondary btn-block', text: '🍳 Crear receta (varios ingredientes)' });
    recipeBtn.addEventListener('click', () => openRecipe(null, (food) => openQuantity({ sp: FoodDB.spec(food), meal, onBack: () => openAddFood(meal), after: 'list' })));
    body.appendChild(create);
    body.appendChild(recipeBtn);
    body.appendChild(quick);
    body.appendChild(done);

    paintChips();
    paintList();
    Modal.open('Agregar alimento', body, { onClose: refresh });
  }

  // ---------------------------------------------------------------- escanear etiqueta
  function scanLabel(meal) {
    LabelScan.open({
      onResult: (p, raw, thumb) => {
        const extra = Utils.el('div', { class: 'scan-result' });
        if (thumb) extra.appendChild(Utils.el('img', { class: 'scan-thumb', src: thumb, alt: 'Etiqueta' }));
        const msgs = Utils.el('div', { class: 'scan-msgs' });
        if (p.ok) msgs.appendChild(Utils.el('div', { class: 'sm-ok', text: '✓ Leí la etiqueta. Compara los números con tu producto antes de guardar.' }));
        else msgs.appendChild(Utils.el('div', { class: 'sm-warn', text: 'No pude leer bien la etiqueta. Completa los números a mano o toma otra foto más cerca y con mejor luz.' }));
        const missing = [['kcal', 'calorías'], ['protein', 'proteína'], ['carbs', 'carbohidratos'], ['fat', 'grasas']].filter(([k]) => !p.found[k]).map((x) => x[1]);
        if (p.ok && missing.length) msgs.appendChild(Utils.el('div', { class: 'sm-warn', text: `No encontré: ${missing.join(', ')}. Complétalo.` }));
        p.notes.forEach((n) => msgs.appendChild(Utils.el('div', { class: 'small text-dim', text: n })));
        extra.appendChild(msgs);
        if (raw && raw.trim()) {
          const det = Utils.el('details', { class: 'scan-raw' }, [Utils.el('summary', { text: 'Ver el texto que leí' }), Utils.el('pre', { text: raw.trim() })]);
          msgs.appendChild(det);
        }
        openFoodForm(null, (food) => {
          openQuantity({ sp: FoodDB.spec(food), meal, onBack: () => openAddFood(meal), after: 'list' });
        }, '', {
          basis: p.basis, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, servingLabel: p.servingLabel, portionG: p.portionG, extra,
        });
      },
    });
  }

  // ---------------------------------------------------------------- cantidad (agregar o editar)
  // opts: { sp, meal, entry?, onBack?, after? }
  function openQuantity(opts) {
    const { sp, entry } = opts;
    let meal = opts.meal;
    const body = Utils.el('div');
    const isG = sp.basis === 'g';
    const day = sumOf(entriesOf(cursorIso).filter((e) => !entry || e.id !== entry.id));
    const settings = DB.getSettings();

    let initial = isG ? 100 : 1;
    if (entry) {
      if (isG) initial = entry.grams || (sp.kcal > 0 ? Math.round((entry.kcal / sp.kcal) * 100) : 100);
      else initial = entry.servings || 1;
    } else if (isG && sp.portions && sp.portions.length) {
      initial = sp.portions[0].g;
    }

    body.appendChild(Utils.el('div', { class: 'meta', style: 'margin:-4px 0 10px;', text: foodSub(sp) }));

    const qty = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(r1(initial)), class: 'qty-input' });
    body.appendChild(Utils.el('div', { class: 'qty-row' }, [qty, Utils.el('span', { class: 'qty-unit', text: isG ? 'gramos' : (sp.servingLabel || 'porciones') })]));

    // atajos
    const chips = Utils.el('div', { class: 'rt-chips' });
    const addChip = (label, value) => {
      const c = Utils.el('button', { type: 'button', class: 'rt-chip plain', style: '--gc:var(--accent-light)', text: label });
      c.addEventListener('click', () => { qty.value = String(r1(value)); update(); });
      chips.appendChild(c);
    };
    if (isG) {
      (sp.portions || []).forEach((p) => addChip(`${p.label} · ${r0(p.g)} g`, p.g));
      [50, 100, 150, 200].forEach((g) => addChip(`${g} g`, g));
    } else {
      [[0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2'], [3, '3']].forEach(([v, t]) => addChip(t, v));
    }
    body.appendChild(chips);

    // vista previa
    const preview = Utils.el('div', { class: 'qty-preview' });
    body.appendChild(preview);

    // comida
    const mealSeg = Utils.el('div', { class: 'seg small', style: 'margin-top:12px;' });
    const paintMeal = () => mealSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.k === meal));
    MEALS.forEach((m) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': m.key, text: m.label });
      b.addEventListener('click', () => { meal = m.key; paintMeal(); updateBtn(); });
      mealSeg.appendChild(b);
    });
    paintMeal();
    body.appendChild(mealSeg);

    const confirm = Utils.el('button', { class: 'btn-primary btn-block' });
    body.appendChild(confirm);
    const updateBtn = () => { confirm.textContent = entry ? 'Guardar cambios' : `Agregar a ${mealOf(meal).label.toLowerCase()}`; };

    function update() {
      const q = parseFloat(qty.value) || 0;
      const m = FoodDB.macros(sp, q);
      preview.innerHTML = '';
      preview.appendChild(Utils.el('div', { class: 'qp-kcal' }, [Utils.el('b', { text: `${r0(m.kcal)}` }), ' kcal']));
      preview.appendChild(Utils.el('div', { class: 'qp-macros' }, [
        Utils.el('span', { style: `color:${MACRO_COLORS.protein}`, text: `P ${r1(m.protein)} g` }),
        Utils.el('span', { style: `color:${MACRO_COLORS.carbs}`, text: `C ${r1(m.carbs)} g` }),
        Utils.el('span', { style: `color:${MACRO_COLORS.fat}`, text: `G ${r1(m.fat)} g` }),
      ]));
      if (settings.calorieGoal) {
        const left = settings.calorieGoal - day.kcal - m.kcal;
        preview.appendChild(Utils.el('div', { class: 'small text-dim', style: left < 0 ? 'color:var(--red)' : '', text: left >= 0 ? `Después de esto te quedarían ${r0(left)} kcal` : `Te pasarías ${r0(-left)} kcal de tu meta` }));
      }
    }
    qty.addEventListener('input', update);
    update();
    updateBtn();

    confirm.addEventListener('click', () => {
      const q = parseFloat(qty.value);
      if (!(q > 0)) { Utils.toast('Escribe una cantidad'); return; }
      const m = FoodDB.macros(sp, q);
      const rec = {
        id: entry ? entry.id : DB.uid(), foodId: sp.id, foodName: sp.name,
        kcal: r1(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat),
        meal, time: entry ? entry.time : new Date().toISOString(),
      };
      if (isG) rec.grams = r1(q); else rec.servings = r1(q);
      const list = entriesOf(cursorIso);
      if (entry) {
        const i = list.findIndex((x) => x.id === entry.id);
        if (i >= 0) list[i] = rec;
      } else list.push(rec);
      saveEntries(cursorIso, list);
      Utils.vibrate(20);
      if (!entry && opts.after === 'list' && opts.onBack) {
        Utils.toast(`✓ ${sp.name} agregado`);
        refresh();
        opts.onBack();
      } else {
        Modal.close();
        refresh();
      }
    });

    if (entry) {
      const del = Utils.el('button', { class: 'btn-secondary btn-block', style: 'color:var(--red);', text: '🗑️ Quitar este alimento' });
      del.addEventListener('click', () => {
        saveEntries(cursorIso, entriesOf(cursorIso).filter((x) => x.id !== entry.id));
        Modal.close();
        refresh();
      });
      body.appendChild(del);
    } else {
      const favBtn = Utils.el('button', { class: 'link-btn small', style: 'margin-top:10px;' });
      const paintFav = () => { favBtn.textContent = FoodDB.favorites().includes(sp.id) ? '★ Es favorito (tocar para quitar)' : '☆ Marcar como favorito'; };
      favBtn.addEventListener('click', () => { FoodDB.toggleFavorite(sp.id); paintFav(); });
      paintFav();
      body.appendChild(favBtn);
      if (opts.onBack) {
        const back = Utils.el('button', { class: 'link-btn small', style: 'margin:10px 0 0 14px;', text: '← Volver a la lista' });
        back.addEventListener('click', () => opts.onBack());
        body.appendChild(back);
      }
    }

    Modal.open(sp.name, body, { onClose: refresh });
    setTimeout(() => { try { qty.focus(); qty.select(); } catch (e) { /* sin foco */ } }, 120);
  }

  // editar un alimento ya registrado
  function openEditEntry(e) {
    const sp = FoodDB.findSpec(e.foodId);
    if (sp) { openQuantity({ sp, meal: e.meal, entry: e }); return; }
    // alimento rápido o eliminado del catálogo: se edita el total
    openQuickAdd(e.meal, e);
  }

  // ---------------------------------------------------------------- solo calorías
  function openQuickAdd(mealKey, entry) {
    const body = Utils.el('div');
    let meal = mealKey;
    body.appendChild(Utils.el('p', { class: 'small', text: 'Para cuando no encuentras el alimento: anota lo que dice la etiqueta o tu mejor estimado.' }));
    const nameIn = Utils.el('input', { type: 'text', placeholder: 'Nombre (opcional)', value: entry ? entry.foodName : '' });
    const kcalIn = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: 'kcal', value: entry ? String(r0(entry.kcal)) : '' });
    const pIn = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: '0', value: entry ? String(r1(entry.protein)) : '' });
    const cIn = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: '0', value: entry ? String(r1(entry.carbs)) : '' });
    const fIn = Utils.el('input', { type: 'number', inputmode: 'decimal', placeholder: '0', value: entry ? String(r1(entry.fat)) : '' });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre' }), nameIn]));
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Calorías (kcal)' }), kcalIn]));
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Proteína (g)' }), pIn]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Carbos (g)' }), cIn]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grasas (g)' }), fIn]),
    ]));
    const mealSeg = Utils.el('div', { class: 'seg small' });
    const paintMeal = () => mealSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.k === meal));
    MEALS.forEach((m) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': m.key, text: m.label });
      b.addEventListener('click', () => { meal = m.key; paintMeal(); });
      mealSeg.appendChild(b);
    });
    paintMeal();
    body.appendChild(mealSeg);

    const save = Utils.el('button', { class: 'btn-primary btn-block', text: entry ? 'Guardar cambios' : 'Agregar' });
    save.addEventListener('click', () => {
      const p = parseFloat(pIn.value) || 0; const c = parseFloat(cIn.value) || 0; const f = parseFloat(fIn.value) || 0;
      let kcal = parseFloat(kcalIn.value);
      if (isNaN(kcal)) kcal = p * 4 + c * 4 + f * 9; // si no pones calorías, se calculan desde los macros
      if (!(kcal > 0)) { Utils.toast('Escribe las calorías o los macros'); return; }
      const rec = {
        id: entry ? entry.id : DB.uid(), foodName: nameIn.value.trim() || 'Comida rápida', servings: 1,
        kcal: r1(kcal), protein: r1(p), carbs: r1(c), fat: r1(f), meal, time: entry ? entry.time : new Date().toISOString(),
      };
      if (entry && entry.foodId) rec.foodId = entry.foodId;
      const list = entriesOf(cursorIso);
      if (entry) { const i = list.findIndex((x) => x.id === entry.id); if (i >= 0) list[i] = rec; } else list.push(rec);
      saveEntries(cursorIso, list);
      Modal.close();
      refresh();
    });
    body.appendChild(save);
    if (entry) {
      const del = Utils.el('button', { class: 'btn-secondary btn-block', style: 'color:var(--red);', text: '🗑️ Quitar' });
      del.addEventListener('click', () => { saveEntries(cursorIso, entriesOf(cursorIso).filter((x) => x.id !== entry.id)); Modal.close(); refresh(); });
      body.appendChild(del);
    }
    Modal.open(entry ? 'Editar' : '⚡ Calorías rápidas', body, { onClose: refresh });
  }

  // ---------------------------------------------------------------- copiar de otro día
  function openCopy(mealKey) {
    const body = Utils.el('div');
    const d0 = Utils.parseISO(cursorIso);
    d0.setDate(d0.getDate() - 1);
    let srcIso = Utils.toISODate(d0);
    let scopeAll = false;
    const wrap = Utils.el('div');
    body.appendChild(wrap);

    function paint() {
      wrap.innerHTML = '';
      const nav = Utils.el('div', { class: 'day-nav', style: 'margin-bottom:6px;' }, [
        Utils.el('button', { class: 'btn-small', text: '←', onclick: () => { const d = Utils.parseISO(srcIso); d.setDate(d.getDate() - 1); srcIso = Utils.toISODate(d); paint(); } }),
        Utils.el('div', { class: 'day-title' }, [Utils.el('div', { class: 'h', text: `Copiar de: ${Utils.friendlyDate(srcIso)}` })]),
        Utils.el('button', { class: 'btn-small', text: '→', onclick: () => { const d = Utils.parseISO(srcIso); d.setDate(d.getDate() + 1); srcIso = Utils.toISODate(d); paint(); } }),
      ]);
      wrap.appendChild(nav);
      const seg = Utils.el('div', { class: 'seg small' });
      [[false, `Solo ${mealOf(mealKey).label.toLowerCase()}`], [true, 'Todo el día']].forEach(([v, t]) => {
        const b = Utils.el('button', { class: 'seg-btn' + (scopeAll === v ? ' active' : ''), type: 'button', text: t });
        b.addEventListener('click', () => { scopeAll = v; paint(); });
        seg.appendChild(b);
      });
      wrap.appendChild(seg);

      const src = entriesOf(srcIso).filter((e) => scopeAll || e.meal === mealKey);
      if (!src.length) {
        wrap.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: scopeAll ? 'Ese día no tiene comidas registradas.' : `Ese día no tiene ${mealOf(mealKey).label.toLowerCase()}. Prueba con otro día o "Todo el día".` }));
        return;
      }
      src.forEach((e) => {
        wrap.appendChild(Utils.el('div', { class: 'meal-row', style: 'cursor:default;' }, [
          Utils.el('div', { class: 'mr-main' }, [
            Utils.el('div', { class: 'mr-name', text: e.foodName }),
            Utils.el('div', { class: 'meta', text: `${scopeAll ? `${mealOf(e.meal).label} · ` : ''}${qtyText(e)} · ${r0(e.kcal)} kcal` }),
          ]),
        ]));
      });
      const t = sumOf(src);
      const go = Utils.el('button', { class: 'btn-primary btn-block', text: `Copiar ${src.length} alimento${src.length === 1 ? '' : 's'} (${r0(t.kcal)} kcal)` });
      go.addEventListener('click', () => {
        const list = entriesOf(cursorIso);
        src.forEach((e) => list.push(Object.assign({}, e, { id: DB.uid(), meal: scopeAll ? e.meal : mealKey, time: new Date().toISOString() })));
        saveEntries(cursorIso, list);
        Modal.close();
        Utils.toast('Copiado ✓');
        refresh();
      });
      wrap.appendChild(go);
    }
    paint();
    Modal.open('📋 Copiar comida', body, { onClose: refresh });
  }

  // ---------------------------------------------------------------- plantilla de comida
  function openSaveTemplate(meal, mealEntries) {
    const body = Utils.el('div');
    const t = sumOf(mealEntries);
    body.appendChild(Utils.el('p', { text: `Guarda esta comida (${r0(t.kcal)} kcal · P ${r0(t.protein)} · C ${r0(t.carbs)} · G ${r0(t.fat)}) para agregarla de un solo toque la próxima vez. Aparecerá en "Míos".` }));
    const nameIn = Utils.el('input', { type: 'text', placeholder: `ej. ${meal.label} de siempre`, value: '' });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre de la plantilla' }), nameIn]));
    const save = Utils.el('button', { class: 'btn-primary btn-block', text: 'Guardar plantilla' });
    save.addEventListener('click', () => {
      const name = nameIn.value.trim();
      if (!name) { Utils.toast('Ponle un nombre'); return; }
      const foods = DB.getFoods();
      foods.push({
        id: DB.uid(), name, basis: 's', servingLabel: '1 porción', combo: true,
        kcal: r1(t.kcal), protein: r1(t.protein), carbs: r1(t.carbs), fat: r1(t.fat),
      });
      DB.saveFoods(foods);
      Modal.close();
      Utils.toast('Plantilla guardada 💾');
    });
    body.appendChild(save);
    Modal.open('💾 Guardar comida', body);
  }

  // ---------------------------------------------------------------- metas
  function openGoals() {
    const s = DB.getSettings();
    const body = Utils.el('div');
    const kcal = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(s.calorieGoal || '') });
    const p = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(s.proteinGoal || '') });
    const c = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(s.carbGoal || '') });
    const f = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(s.fatGoal || '') });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Calorías al día (kcal)' }), kcal]));
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Proteína (g)' }), p]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Carbos (g)' }), c]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grasas (g)' }), f]),
    ]));
    const info = Utils.el('div', { class: 'small text-dim', style: 'margin:-2px 0 8px;' });
    const updInfo = () => {
      const k = (parseFloat(p.value) || 0) * 4 + (parseFloat(c.value) || 0) * 4 + (parseFloat(f.value) || 0) * 9;
      info.textContent = `Tus macros suman ${r0(k)} kcal${parseFloat(kcal.value) ? ` (${r0(k - parseFloat(kcal.value)) >= 0 ? '+' : ''}${r0(k - parseFloat(kcal.value))} vs tu meta)` : ''}.`;
    };
    [kcal, p, c, f].forEach((i) => i.addEventListener('input', updInfo));
    updInfo();
    body.appendChild(info);

    const kg = s.calcWeightKg || (DB.getMeasurements().slice(-1)[0] || {}).weight || 0;
    const auto = Utils.el('button', { class: 'btn-secondary btn-block', text: '✨ Autocompletar macros desde las calorías' });
    auto.addEventListener('click', () => {
      const k = parseFloat(kcal.value);
      if (!(k > 0)) { Utils.toast('Primero escribe las calorías'); return; }
      const prot = kg ? Math.round(kg * 2) : Math.round((k * 0.25) / 4); // 2 g por kg de peso
      const fat = Math.round((k * 0.25) / 9); // 25% de las calorías
      const carbs = Math.max(0, Math.round((k - prot * 4 - fat * 9) / 4));
      p.value = String(prot); f.value = String(fat); c.value = String(carbs);
      updInfo();
    });
    body.appendChild(auto);
    body.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin:6px 0 10px;', text: kg ? `Usa 2 g de proteína por kg (${Utils.round1(Units.fromKg(kg))} ${Units.current()}), 25 % de grasas y el resto en carbohidratos.` : 'Usa 25 % de las calorías en proteína y 25 % en grasas; el resto en carbohidratos.' }));

    const save = Utils.el('button', { class: 'btn-primary btn-block', text: 'Guardar metas' });
    save.addEventListener('click', () => {
      const st = DB.getSettings();
      st.calorieGoal = parseFloat(kcal.value) || st.calorieGoal;
      st.proteinGoal = parseFloat(p.value) || 0;
      st.carbGoal = parseFloat(c.value) || 0;
      st.fatGoal = parseFloat(f.value) || 0;
      DB.saveSettings(st);
      Modal.close();
      Utils.toast('Metas actualizadas');
      refresh();
    });
    body.appendChild(save);
    const calc = Utils.el('button', { class: 'link-btn small', style: 'margin-top:8px;', text: '¿No sabes cuánto? Usa la calculadora →' });
    calc.addEventListener('click', () => { Modal.close(); App.navigate('calculadora'); });
    body.appendChild(calc);
    Modal.open('🎯 Metas diarias', body);
  }

  // ---------------------------------------------------------------- crear / editar alimento propio
  // prefill: valores iniciales (por ejemplo, leídos de una etiqueta) y `extra`: nodo que se muestra arriba
  function openFoodForm(existing, onSaved, presetName, prefill) {
    const body = Utils.el('div');
    const src = existing || prefill || null;
    const numStr = (v) => (v === null || v === undefined ? '' : String(v));
    let basis = src ? (src.basis === 'g' ? 'g' : 's') : 'g';

    if (prefill && prefill.extra) body.appendChild(prefill.extra);

    const nameIn = Utils.el('input', { type: 'text', value: existing ? existing.name : (presetName || (prefill && prefill.name) || ''), placeholder: prefill ? 'Nombre del producto (ej. Galletas de avena)' : 'ej. Pan de la panadería' });
    const kcalIn = Utils.el('input', { type: 'number', inputmode: 'decimal', value: src ? numStr(src.kcal) : '' });
    const pIn = Utils.el('input', { type: 'number', inputmode: 'decimal', value: src ? numStr(existing ? (src.protein || 0) : src.protein) : '' });
    const cIn = Utils.el('input', { type: 'number', inputmode: 'decimal', value: src ? numStr(existing ? (src.carbs || 0) : src.carbs) : '' });
    const fIn = Utils.el('input', { type: 'number', inputmode: 'decimal', value: src ? numStr(existing ? (src.fat || 0) : src.fat) : '' });
    const labelIn = Utils.el('input', { type: 'text', value: src ? (src.servingLabel || '') : '', placeholder: 'ej. 1 pan, 1 taza, 1 scoop' });
    const portionG = Utils.el('input', { type: 'number', inputmode: 'decimal', value: src && src.portionG ? String(src.portionG) : '', placeholder: 'gramos de 1 porción (opcional)' });

    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre del alimento' }), nameIn]));

    const seg = Utils.el('div', { class: 'seg small' });
    const labelBasis = Utils.el('label', { text: 'Los valores de la etiqueta son…' });
    const portionBox = Utils.el('div');
    const paint = () => {
      seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', b.dataset.k === basis));
      portionBox.innerHTML = '';
      if (basis === 'g') {
        portionBox.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-bottom:6px;', text: 'Podrás anotarlo en gramos. Si quieres, define cuánto pesa 1 porción para usarla como atajo.' }));
        portionBox.appendChild(Utils.el('div', { class: 'field-row' }, [
          Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre de la porción' }), labelIn]),
          Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Gramos' }), portionG]),
        ]));
      } else {
        portionBox.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre de la porción' }), labelIn]));
      }
    };
    [['g', 'Por 100 g'], ['s', 'Por porción']].forEach(([k, t]) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': k, text: t });
      b.addEventListener('click', () => { basis = k; paint(); });
      seg.appendChild(b);
    });
    body.appendChild(Utils.el('div', { class: 'field' }, [labelBasis, seg]));
    body.appendChild(portionBox);
    paint();

    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Calorías (kcal)' }), kcalIn]));
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Proteína (g)' }), pIn]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Carbos (g)' }), cIn]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grasas (g)' }), fIn]),
    ]));
    body.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin:-4px 0 10px;', text: 'Si dejas las calorías vacías, se calculan con los macros (4 · P + 4 · C + 9 · G).' }));

    const saveBtn = Utils.el('button', { class: 'btn-primary btn-block', text: 'Guardar en mis alimentos' });
    saveBtn.addEventListener('click', () => {
      const name = nameIn.value.trim();
      const p = parseFloat(pIn.value) || 0; const c = parseFloat(cIn.value) || 0; const f = parseFloat(fIn.value) || 0;
      let kcal = parseFloat(kcalIn.value);
      if (isNaN(kcal)) kcal = p * 4 + c * 4 + f * 9;
      if (!name || !(kcal > 0)) { Utils.toast('Falta el nombre o las calorías'); return; }
      const foods = DB.getFoods();
      let food;
      if (existing) food = foods.find((x) => x.id === existing.id);
      else { food = { id: DB.uid() }; foods.push(food); }
      Object.assign(food, { name, basis, kcal: r1(kcal), protein: r1(p), carbs: r1(c), fat: r1(f) });
      if (basis === 'g') {
        const g = parseFloat(portionG.value);
        if (g > 0) { food.portionG = g; food.servingLabel = labelIn.value.trim() || `1 porción (${r0(g)} g)`; } else { delete food.portionG; food.servingLabel = labelIn.value.trim() || '100 g'; }
      } else {
        delete food.portionG;
        food.servingLabel = labelIn.value.trim() || '1 porción';
      }
      DB.saveFoods(foods);
      Modal.close();
      if (onSaved) onSaved(food);
    });
    body.appendChild(saveBtn);
    Modal.open(existing ? 'Editar alimento' : (prefill ? 'Revisa los datos de la etiqueta' : 'Nuevo alimento'), body);
  }

  // ---------------------------------------------------------------- recetas
  // Una receta suma varios alimentos (con sus cantidades) y se guarda como un alimento "por porción".
  function recipeTotals(items) {
    return items.reduce((a, i) => {
      const sp = FoodDB.findSpec(i.foodId);
      if (!sp) return a;
      const m = FoodDB.macros(sp, Number(i.qty) || 0);
      return { kcal: a.kcal + m.kcal, protein: a.protein + m.protein, carbs: a.carbs + m.carbs, fat: a.fat + m.fat };
    }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  }

  function openRecipe(existing, onSaved) {
    const isRecipe = !!(existing && existing.recipe);
    const state = {
      name: existing ? existing.name : '',
      servings: isRecipe ? existing.servings || 1 : 1,
      items: isRecipe ? (existing.ingredients || []).map((i) => Object.assign({}, i)) : [],
    };
    show();

    function show() {
      const body = Utils.el('div');
      body.appendChild(Utils.el('p', { class: 'small', text: 'Arma el plato con sus ingredientes y cantidades. Se guarda como un alimento por porción para agregarlo de un toque.' }));
      const nameIn = Utils.el('input', { type: 'text', value: state.name, placeholder: 'ej. Bowl de pollo con arroz' });
      nameIn.addEventListener('input', () => { state.name = nameIn.value; });
      const servIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(state.servings) });
      body.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field', style: 'flex:2;' }, [Utils.el('label', { text: 'Nombre de la receta' }), nameIn]),
        Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Rinde (porciones)' }), servIn]),
      ]));

      body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:6px 0 2px;', text: 'Ingredientes' }));
      const list = Utils.el('div');
      const totalBox = Utils.el('div', { class: 'recipe-total' });
      const paintTotals = () => {
        const t = recipeTotals(state.items);
        const n = Math.max(0.25, parseFloat(servIn.value) || 1);
        state.servings = n;
        totalBox.innerHTML = '';
        totalBox.appendChild(Utils.el('div', { class: 'small text-dim', text: `Total: ${r0(t.kcal)} kcal · P ${r0(t.protein)} · C ${r0(t.carbs)} · G ${r0(t.fat)}` }));
        totalBox.appendChild(Utils.el('div', { style: 'margin-top:4px;' }, [Utils.el('b', { style: 'font-size:1.5rem;', text: `${r0(t.kcal / n)}` }), ' kcal por porción']));
        totalBox.appendChild(Utils.el('div', { class: 'small text-dim', text: `P ${r1(t.protein / n)} · C ${r1(t.carbs / n)} · G ${r1(t.fat / n)} g por porción` }));
      };
      state.items.forEach((it, idx) => {
        const sp = FoodDB.findSpec(it.foodId);
        const q = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(it.qty) });
        q.addEventListener('input', () => { it.qty = parseFloat(q.value) || 0; paintTotals(); });
        const del = Utils.el('button', { class: 'icon-btn', text: '✕' });
        del.addEventListener('click', () => { state.items.splice(idx, 1); show(); });
        list.appendChild(Utils.el('div', { class: 'ing-row' }, [
          Utils.el('div', { class: 'ing-name', text: it.name }),
          q,
          Utils.el('span', { class: 'small text-dim', style: 'width:34px;', text: sp && sp.basis === 'g' ? 'g' : 'porc.' }),
          del,
        ]));
      });
      if (!state.items.length) list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:8px 0;', text: 'Aún no hay ingredientes.' }));
      body.appendChild(list);
      servIn.addEventListener('input', paintTotals);
      paintTotals();

      const addIng = Utils.el('button', { class: 'btn-secondary btn-block', text: '➕ Agregar ingrediente' });
      addIng.addEventListener('click', () => pickIngredient(state, show));
      body.appendChild(addIng);
      body.appendChild(totalBox);

      const save = Utils.el('button', { class: 'btn-primary btn-block', text: isRecipe ? 'Guardar cambios' : 'Guardar receta' });
      save.addEventListener('click', () => {
        const name = state.name.trim();
        if (!name) { Utils.toast('Ponle un nombre a la receta'); return; }
        const items = state.items.filter((i) => i.qty > 0);
        if (!items.length) { Utils.toast('Agrega al menos un ingrediente'); return; }
        const t = recipeTotals(items);
        const n = Math.max(0.25, state.servings || 1);
        const foods = DB.getFoods();
        let food = isRecipe ? foods.find((f) => f.id === existing.id) : null;
        if (!food) { food = { id: DB.uid() }; foods.push(food); }
        Object.assign(food, {
          name, basis: 's', servingLabel: '1 porción', combo: true, recipe: true, servings: n, ingredients: items,
          kcal: r1(t.kcal / n), protein: r1(t.protein / n), carbs: r1(t.carbs / n), fat: r1(t.fat / n),
        });
        DB.saveFoods(foods);
        Modal.close();
        Utils.toast('Receta guardada 🍳');
        if (onSaved) onSaved(food);
      });
      body.appendChild(save);
      Modal.open(isRecipe ? 'Editar receta' : '🍳 Nueva receta', body);
    }
  }

  // elegir un ingrediente (buscador) y su cantidad
  function pickIngredient(state, back) {
    const body = Utils.el('div');
    const search = Utils.el('input', { type: 'search', placeholder: '🔎 Buscar ingrediente…', class: 'ax-search' });
    const list = Utils.el('div');
    function paint() {
      list.innerHTML = '';
      const items = FoodDB.search(search.value.trim()).filter((f) => !f.recipe).slice(0, 60);
      if (!items.length) list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: 'No encontré ese alimento.' }));
      items.forEach((sp) => {
        const row = Utils.el('div', { class: 'food-row' }, [
          Utils.el('div', { class: 'fr-main' }, [Utils.el('div', { class: 'fr-name', text: sp.name }), Utils.el('div', { class: 'meta', text: foodSub(sp) })]),
          Utils.el('span', { class: 'fr-add', text: '+' }),
        ]);
        row.addEventListener('click', () => askQty(sp));
        list.appendChild(row);
      });
    }
    function askQty(sp) {
      const b = Utils.el('div');
      const isG = sp.basis === 'g';
      const q = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', class: 'qty-input', value: String(isG ? ((sp.portions && sp.portions[0] && sp.portions[0].g) || 100) : 1) });
      b.appendChild(Utils.el('div', { class: 'meta', style: 'margin:-4px 0 10px;', text: foodSub(sp) }));
      b.appendChild(Utils.el('div', { class: 'qty-row' }, [q, Utils.el('span', { class: 'qty-unit', text: isG ? 'gramos' : (sp.servingLabel || 'porciones') })]));
      if (isG && sp.portions && sp.portions.length) {
        const chips = Utils.el('div', { class: 'rt-chips' });
        sp.portions.forEach((p) => {
          const c = Utils.el('button', { type: 'button', class: 'rt-chip plain', style: '--gc:var(--accent-light)', text: `${p.label} · ${r0(p.g)} g` });
          c.addEventListener('click', () => { q.value = String(p.g); });
          chips.appendChild(c);
        });
        b.appendChild(chips);
      }
      const ok = Utils.el('button', { class: 'btn-primary btn-block', text: 'Agregar a la receta' });
      ok.addEventListener('click', () => {
        const v = parseFloat(q.value);
        if (!(v > 0)) { Utils.toast('Escribe una cantidad'); return; }
        state.items.push({ foodId: sp.id, name: sp.name, qty: v });
        Modal.close();
        back();
      });
      b.appendChild(ok);
      Modal.open(sp.name, b);
      setTimeout(() => { try { q.focus(); q.select(); } catch (e) { /* sin foco */ } }, 120);
    }
    search.addEventListener('input', paint);
    body.appendChild(search);
    body.appendChild(list);
    const cancel = Utils.el('button', { class: 'link-btn small', style: 'margin-top:8px;', text: '← Volver a la receta' });
    cancel.addEventListener('click', back);
    body.appendChild(cancel);
    paint();
    Modal.open('Agregar ingrediente', body);
  }

  // ---------------------------------------------------------------- mis alimentos
  function openFoodManager() {
    const body = Utils.el('div');
    const search = Utils.el('input', { type: 'search', placeholder: '🔎 Buscar en mis alimentos…', class: 'ax-search' });
    const list = Utils.el('div');
    function paint() {
      list.innerHTML = '';
      const q = FoodDB.norm(search.value);
      const foods = DB.getFoods().filter((f) => !q || FoodDB.norm(f.name).includes(q));
      if (!foods.length) list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: DB.getFoods().length ? 'Sin resultados.' : 'Aún no tienes alimentos propios. Crea uno o guarda una comida como plantilla.' }));
      foods.forEach((f) => {
        const sp = FoodDB.spec(f);
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', { style: 'min-width:0;' }, [
            Utils.el('div', { style: 'font-weight:700;' }, [f.name, f.combo ? Utils.el('span', { class: 'uni-pill', text: f.recipe ? 'receta' : 'plantilla' }) : null]),
            Utils.el('div', { class: 'meta', text: foodSub(sp) }),
          ]),
          Utils.el('div', { style: 'display:flex;gap:6px;flex:none;' }, [
            Utils.el('button', { class: 'btn-small', text: 'Editar' }),
            Utils.el('button', { class: 'btn-small', text: '🗑️' }),
          ]),
        ]);
        const [edit, del] = row.querySelectorAll('button');
        edit.addEventListener('click', () => (f.recipe ? openRecipe(f, () => openFoodManager()) : openFoodForm(f, () => openFoodManager())));
        del.addEventListener('click', () => {
          if (!Utils.confirmDialog(`¿Eliminar "${f.name}" de tus alimentos? Lo ya registrado se conserva.`)) return;
          DB.saveFoods(DB.getFoods().filter((x) => x.id !== f.id));
          paint();
        });
        list.appendChild(row);
      });
    }
    search.addEventListener('input', paint);
    body.appendChild(search);
    body.appendChild(list);
    paint();
    const add = Utils.el('button', { class: 'btn-primary btn-block', text: '➕ Nuevo alimento' });
    add.addEventListener('click', () => openFoodForm(null, () => openFoodManager()));
    body.appendChild(add);
    const addRecipe = Utils.el('button', { class: 'btn-secondary btn-block', text: '🍳 Nueva receta' });
    addRecipe.addEventListener('click', () => openRecipe(null, () => openFoodManager()));
    body.appendChild(addRecipe);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: `La app ya incluye ${FoodDB.BUILTIN.length} alimentos comunes (valores promedio por 100 g). Aquí van solo los tuyos.` }));
    Modal.open('Mis alimentos', body, { onClose: refresh });
  }

  // desde Hoy: abre la pantalla de calorías (día de hoy) con el menú de agregar
  function addNow() {
    cursorIso = Utils.todayISO();
    App.navigate('calorias');
    openAddFood(defaultMeal());
  }

  return { render, addNow };
})();
