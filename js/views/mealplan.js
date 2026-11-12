/* ============================================================
   views/mealplan.js — Plan de comidas semanal + lista de compras.
   Armas tu "semana tipo": cada día de la semana tiene sus comidas.
   Puedes pasar un día (o una comida) a tu registro de hoy con un
   toque, copiar un día a otros, y generar la lista de compras de
   toda la semana sumando cantidades.
   ============================================================ */

const MealPlanView = (() => {
  const MEALS = [
    { key: 'desayuno', label: 'Desayuno', icon: '🌅' },
    { key: 'almuerzo', label: 'Almuerzo', icon: '☀️' },
    { key: 'cena', label: 'Cena', icon: '🌙' },
    { key: 'snack', label: 'Snacks', icon: '🍎' },
  ];
  const DAYS = [
    { dow: 1, short: 'L', name: 'Lunes' }, { dow: 2, short: 'M', name: 'Martes' }, { dow: 3, short: 'X', name: 'Miércoles' },
    { dow: 4, short: 'J', name: 'Jueves' }, { dow: 5, short: 'V', name: 'Viernes' }, { dow: 6, short: 'S', name: 'Sábado' },
    { dow: 0, short: 'D', name: 'Domingo' },
  ];
  const MACRO_COLORS = { protein: '#c26fe0', carbs: '#3d8de0', fat: '#e0c23d' };

  let sel = new Date().getDay();
  let rootRef = null;
  const checked = new Set();   // artículos tachados en la lista de compras (mientras la app está abierta)

  const r0 = (n) => Math.round(Number(n) || 0);
  const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const dayName = (dow) => DAYS.find((d) => d.dow === dow).name;
  const refresh = () => { if (rootRef) render(rootRef); };

  function dayItems(plan, dow) {
    const d = plan[String(dow)] || {};
    return MEALS.reduce((acc, m) => acc.concat((d[m.key] || []).map((it) => Object.assign({ meal: m.key }, it))), []);
  }
  const sumOf = (items) => items.reduce((a, e) => ({
    kcal: a.kcal + (e.kcal || 0), protein: a.protein + (e.protein || 0), carbs: a.carbs + (e.carbs || 0), fat: a.fat + (e.fat || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
  const qtyText = (it) => (it.grams ? `${r1(it.grams)} g` : `${r1(it.servings || 1)} ${(it.servings || 1) === 1 ? 'porción' : 'porciones'}`);

  function savePlan(plan) { DB.saveMealPlan(plan); }

  // ---------------------------------------------------------------- pantalla
  function render(root) {
    rootRef = root;
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const plan = DB.getMealPlan();
    const settings = DB.getSettings();
    const todayDow = new Date().getDay();

    // días de la semana
    const tabs = Utils.el('div', { class: 'mp-days' });
    DAYS.forEach((d) => {
      const n = dayItems(plan, d.dow).length;
      const b = Utils.el('button', { type: 'button', class: `mp-day${d.dow === sel ? ' active' : ''}${d.dow === todayDow ? ' today' : ''}` }, [
        Utils.el('span', { class: 'mp-d', text: d.short }),
        Utils.el('span', { class: 'mp-n', text: n ? String(n) : '·' }),
      ]);
      b.addEventListener('click', () => { sel = d.dow; refresh(); });
      tabs.appendChild(b);
    });
    view.appendChild(tabs);

    const items = dayItems(plan, sel);
    const t = sumOf(items);
    const goal = settings.calorieGoal || 0;

    // resumen del día
    const sum = Utils.el('div', { class: 'card mp-sum' });
    sum.appendChild(Utils.el('div', { class: 'flex-between' }, [
      Utils.el('h3', { class: 'mb-0', text: `${dayName(sel)}${sel === todayDow ? ' · hoy' : ''}` }),
      Utils.el('div', { class: 'mp-kcal' }, [Utils.el('b', { text: String(r0(t.kcal)) }), Utils.el('span', { class: 'small text-dim', text: goal ? ` / ${goal} kcal` : ' kcal' })]),
    ]));
    if (goal) {
      const pct = Math.min(100, Math.round((t.kcal / goal) * 100));
      const diff = r0(t.kcal - goal);
      sum.appendChild(Utils.el('div', { class: 'macro-bar', style: 'margin:10px 0 6px;' }, [Utils.el('div', { class: 'macro-bar-fill', style: `width:${pct}%;background:var(--accent-grad);` })]));
      sum.appendChild(Utils.el('div', { class: 'small text-dim', text: !items.length ? 'Día vacío: agrega tus comidas abajo.' : Math.abs(diff) <= goal * 0.05 ? '✓ Muy cerca de tu meta' : diff < 0 ? `Te faltan ${-diff} kcal para tu meta` : `Te pasas ${diff} kcal de tu meta` }));
    }
    if (items.length) {
      sum.appendChild(Utils.el('div', { class: 'mp-macros' }, [
        Utils.el('span', { style: `color:${MACRO_COLORS.protein}`, text: `P ${r0(t.protein)} g${settings.proteinGoal ? ` / ${settings.proteinGoal}` : ''}` }),
        Utils.el('span', { style: `color:${MACRO_COLORS.carbs}`, text: `C ${r0(t.carbs)} g` }),
        Utils.el('span', { style: `color:${MACRO_COLORS.fat}`, text: `G ${r0(t.fat)} g` }),
      ]));
    }
    view.appendChild(sum);

    // comidas
    MEALS.forEach((m) => view.appendChild(mealCard(plan, m)));

    // acciones
    const apply = Utils.el('button', { class: 'btn-primary btn-block', text: sel === todayDow ? '📥 Pasar este día a mi registro de hoy' : `📥 Usar el plan del ${dayName(sel).toLowerCase()} en mi registro de hoy` });
    apply.disabled = !items.length;
    apply.addEventListener('click', () => applyToToday(items, `el plan del ${dayName(sel).toLowerCase()}`));
    view.appendChild(apply);
    const row = Utils.el('div', { class: 'nut-actions act-2', style: 'margin-top:8px;' });
    const copy = Utils.el('button', { class: 'btn-secondary', text: '📋 Copiar a otros días' });
    copy.disabled = !items.length;
    copy.addEventListener('click', () => openCopy());
    const clear = Utils.el('button', { class: 'btn-secondary', text: '🧹 Vaciar día' });
    clear.disabled = !items.length;
    clear.addEventListener('click', () => {
      if (!Utils.confirmDialog(`¿Vaciar el plan del ${dayName(sel).toLowerCase()}?`)) return;
      const p = DB.getMealPlan(); delete p[String(sel)]; savePlan(p); refresh();
    });
    row.appendChild(copy); row.appendChild(clear);
    view.appendChild(row);

    const totalItems = DAYS.reduce((n, d) => n + dayItems(plan, d.dow).length, 0);
    const shop = Utils.el('button', { class: 'btn-secondary btn-block', style: 'margin-top:8px;', text: '🛒 Lista de compras de la semana' });
    shop.disabled = !totalItems;
    shop.addEventListener('click', () => openShopping());
    view.appendChild(shop);

    // promedio de la semana
    const planned = DAYS.map((d) => sumOf(dayItems(plan, d.dow))).filter((x) => x.kcal > 0);
    if (planned.length) {
      const avg = planned.reduce((s, x) => s + x.kcal, 0) / planned.length;
      const avgP = planned.reduce((s, x) => s + x.protein, 0) / planned.length;
      view.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;margin:12px 0 4px;', text: `Promedio de tu semana (${planned.length} día${planned.length === 1 ? '' : 's'} con plan): ${r0(avg)} kcal · ${r0(avgP)} g de proteína` }));
    }
    root.appendChild(view);
  }

  function mealCard(plan, meal) {
    const list = ((plan[String(sel)] || {})[meal.key]) || [];
    const t = sumOf(list);
    const card = Utils.el('div', { class: 'card meal-group' });
    card.appendChild(Utils.el('div', { class: 'meal-head' }, [
      Utils.el('div', {}, [
        Utils.el('h4', { class: 'mb-0', text: `${meal.icon} ${meal.label}` }),
        list.length ? Utils.el('div', { class: 'small text-dim', text: `P ${r0(t.protein)} · C ${r0(t.carbs)} · G ${r0(t.fat)} g` }) : null,
      ]),
      Utils.el('div', { class: 'meal-kcal', text: list.length ? `${r0(t.kcal)} kcal` : '' }),
    ]));
    list.forEach((it) => {
      const row = Utils.el('div', { class: 'meal-row' }, [
        Utils.el('div', { class: 'mr-main' }, [
          Utils.el('div', { class: 'mr-name', text: it.foodName }),
          Utils.el('div', { class: 'meta', text: `${qtyText(it)} · P ${r0(it.protein)} · C ${r0(it.carbs)} · G ${r0(it.fat)}` }),
        ]),
        Utils.el('div', { class: 'mr-kcal', text: String(r0(it.kcal)) }),
        Utils.el('button', { class: 'icon-btn', text: '✕', title: 'Quitar' }),
      ]);
      row.querySelector('button').addEventListener('click', () => {
        const p = DB.getMealPlan();
        const d = p[String(sel)] || {};
        d[meal.key] = (d[meal.key] || []).filter((x) => x.id !== it.id);
        if (!d[meal.key].length) delete d[meal.key];
        if (Object.keys(d).length) p[String(sel)] = d; else delete p[String(sel)];
        savePlan(p); refresh();
      });
      card.appendChild(row);
    });
    const actions = Utils.el('div', { class: 'meal-actions' });
    const add = Utils.el('button', { class: 'btn-secondary', text: '➕ Agregar' });
    add.addEventListener('click', () => openPicker(meal.key));
    actions.appendChild(add);
    if (list.length) {
      const today = Utils.el('button', { class: 'btn-secondary', text: '📥 A hoy', title: 'Pasar esta comida a mi registro de hoy' });
      today.addEventListener('click', () => applyToToday(list.map((x) => Object.assign({ meal: meal.key }, x)), `este ${meal.label.toLowerCase()}`));
      actions.appendChild(today);
    }
    card.appendChild(actions);
    return card;
  }

  // ---------------------------------------------------------------- agregar alimentos al plan
  function openPicker(mealKey) {
    const body = Utils.el('div');
    const search = Utils.el('input', { type: 'search', class: 'ax-search', placeholder: '🔎 Buscar (ej. pollo, arroz, avena)…' });
    const list = Utils.el('div');
    body.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-bottom:6px;', text: `${dayName(sel)} · ${MEALS.find((m) => m.key === mealKey).label}` }));
    body.appendChild(search);
    body.appendChild(list);
    const done = Utils.el('button', { class: 'btn-primary btn-block', style: 'margin-top:10px;', text: 'Listo' });
    done.addEventListener('click', () => { Modal.close(); refresh(); });
    body.appendChild(done);

    function paint() {
      list.innerHTML = '';
      const q = search.value.trim();
      let items;
      if (q) items = FoodDB.search(q).slice(0, 60);
      else {
        const seen = new Set();
        items = [];
        FoodDB.favorites().concat(FoodDB.recentIds()).forEach((id) => { const sp = FoodDB.findSpec(id); if (sp && !seen.has(id)) { seen.add(id); items.push(sp); } });
        FoodDB.search('', { onlyMine: true }).forEach((sp) => { if (!seen.has(sp.id)) { seen.add(sp.id); items.push(sp); } });
        FoodDB.search('').slice(0, 40).forEach((sp) => { if (!seen.has(sp.id)) { seen.add(sp.id); items.push(sp); } });
      }
      if (!items.length) list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: 'No encontré ese alimento. Créalo desde Calorías → Agregar alimento.' }));
      items.forEach((sp) => {
        const sub = sp.basis === 'g' ? `${r0(sp.kcal)} kcal / 100 g` : `${r0(sp.kcal)} kcal / ${sp.servingLabel}`;
        const r = Utils.el('div', { class: 'food-row' }, [
          Utils.el('div', { class: 'fr-main' }, [
            Utils.el('div', { class: 'fr-name' }, [sp.name, sp.combo ? Utils.el('span', { class: 'uni-pill', text: sp.recipe ? 'receta' : 'plantilla' }) : null]),
            Utils.el('div', { class: 'meta', text: `${sub} · P ${r1(sp.protein)} · C ${r1(sp.carbs)} · G ${r1(sp.fat)}` }),
          ]),
          Utils.el('span', { class: 'fr-add', text: '+' }),
        ]);
        r.addEventListener('click', () => openQty(sp, mealKey));
        list.appendChild(r);
      });
    }
    search.addEventListener('input', paint);
    paint();
    Modal.open('Agregar al plan', body, { onClose: refresh });
  }

  function openQty(sp, mealKey) {
    const isG = sp.basis === 'g';
    const body = Utils.el('div');
    const qty = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', class: 'qty-input', value: String(isG ? ((sp.portions && sp.portions[0] && sp.portions[0].g) || 100) : 1) });
    body.appendChild(Utils.el('div', { class: 'qty-row' }, [qty, Utils.el('span', { class: 'qty-unit', text: isG ? 'gramos' : (sp.servingLabel || 'porciones') })]));
    const chips = Utils.el('div', { class: 'rt-chips' });
    const addChip = (label, v) => {
      const c = Utils.el('button', { type: 'button', class: 'rt-chip plain', style: '--gc:var(--accent-light)', text: label });
      c.addEventListener('click', () => { qty.value = String(v); upd(); });
      chips.appendChild(c);
    };
    if (isG) { (sp.portions || []).forEach((p) => addChip(`${p.label} · ${r0(p.g)} g`, p.g)); [50, 100, 150, 200].forEach((g) => addChip(`${g} g`, g)); }
    else [[0.5, '½'], [1, '1'], [1.5, '1½'], [2, '2'], [3, '3']].forEach(([v, tx]) => addChip(tx, v));
    body.appendChild(chips);
    const preview = Utils.el('div', { class: 'qty-preview' });
    body.appendChild(preview);
    function upd() {
      const q = parseFloat(qty.value) || 0;
      const m = FoodDB.macros(sp, q);
      preview.innerHTML = '';
      preview.appendChild(Utils.el('div', { class: 'qp-kcal' }, [Utils.el('b', { text: String(r0(m.kcal)) }), ' kcal']));
      preview.appendChild(Utils.el('div', { class: 'qp-macros' }, [
        Utils.el('span', { style: `color:${MACRO_COLORS.protein}`, text: `P ${r1(m.protein)} g` }),
        Utils.el('span', { style: `color:${MACRO_COLORS.carbs}`, text: `C ${r1(m.carbs)} g` }),
        Utils.el('span', { style: `color:${MACRO_COLORS.fat}`, text: `G ${r1(m.fat)} g` }),
      ]));
    }
    qty.addEventListener('input', upd);
    upd();
    const ok = Utils.el('button', { class: 'btn-primary btn-block', text: `Agregar al ${dayName(sel).toLowerCase()}` });
    ok.addEventListener('click', () => {
      const q = parseFloat(qty.value);
      if (!(q > 0)) { Utils.toast('Escribe una cantidad'); return; }
      const m = FoodDB.macros(sp, q);
      const it = { id: DB.uid(), foodId: sp.id, foodName: sp.name, kcal: r1(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat) };
      if (isG) it.grams = r1(q); else it.servings = r1(q);
      const p = DB.getMealPlan();
      const d = p[String(sel)] || (p[String(sel)] = {});
      (d[mealKey] = d[mealKey] || []).push(it);
      savePlan(p);
      Utils.vibrate(20);
      Utils.toast(`✓ ${sp.name} agregado`);
      openPicker(mealKey);
    });
    body.appendChild(ok);
    const back = Utils.el('button', { class: 'link-btn small', style: 'margin-top:10px;', text: '← Volver a la lista' });
    back.addEventListener('click', () => openPicker(mealKey));
    body.appendChild(back);
    Modal.open(sp.name, body, { onClose: refresh });
    setTimeout(() => { try { qty.focus(); qty.select(); } catch (e) { /* sin foco */ } }, 120);
  }

  // ---------------------------------------------------------------- pasar al registro de hoy
  function applyToToday(items, what) {
    if (!items.length) return;
    const t = sumOf(items);
    if (!Utils.confirmDialog(`Se agregarán ${items.length} alimento${items.length === 1 ? '' : 's'} (${r0(t.kcal)} kcal) a tu registro de hoy con ${what}. ¿Continuar?`)) return;
    const iso = Utils.todayISO();
    const log = DB.getCalorieLog();
    const list = log[iso] || [];
    items.forEach((it) => {
      const e = { id: DB.uid(), foodId: it.foodId, foodName: it.foodName, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, meal: it.meal, time: new Date().toISOString() };
      if (it.grams) e.grams = it.grams; else e.servings = it.servings || 1;
      list.push(e);
    });
    log[iso] = list;
    DB.saveCalorieLog(log);
    Utils.vibrate(30);
    Utils.toast('✓ Agregado a tu registro de hoy');
  }

  // ---------------------------------------------------------------- copiar día
  function openCopy() {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: `Copia el plan del ${dayName(sel).toLowerCase()} a los días que elijas (reemplaza lo que tengan).` }));
    const picked = new Set();
    const grid = Utils.el('div', { class: 'rt-chips' });
    DAYS.filter((d) => d.dow !== sel).forEach((d) => {
      const c = Utils.el('button', { type: 'button', class: 'rt-chip', style: '--gc:var(--accent-light)', text: d.name });
      c.addEventListener('click', () => { if (picked.has(d.dow)) picked.delete(d.dow); else picked.add(d.dow); c.classList.toggle('active', picked.has(d.dow)); });
      grid.appendChild(c);
    });
    body.appendChild(grid);
    const ok = Utils.el('button', { class: 'btn-primary btn-block', text: 'Copiar' });
    ok.addEventListener('click', () => {
      if (!picked.size) { Utils.toast('Elige al menos un día'); return; }
      const p = DB.getMealPlan();
      const src = p[String(sel)] || {};
      picked.forEach((dow) => {
        const copy = {};
        Object.keys(src).forEach((k) => { copy[k] = src[k].map((it) => Object.assign({}, it, { id: DB.uid() })); });
        p[String(dow)] = copy;
      });
      savePlan(p);
      Modal.close();
      Utils.toast(`✓ Copiado a ${picked.size} día${picked.size === 1 ? '' : 's'}`);
      refresh();
    });
    body.appendChild(ok);
    Modal.open('📋 Copiar día', body);
  }

  // ---------------------------------------------------------------- lista de compras
  function shoppingList() {
    const plan = DB.getMealPlan();
    const acc = {};   // key -> { name, basis, qty, cat, label }
    const add = (sp, qty, fallbackName) => {
      const key = `${sp ? sp.id : fallbackName}|${sp ? sp.basis : 's'}`;
      const row = acc[key] || (acc[key] = { name: sp ? sp.name : fallbackName, basis: sp ? sp.basis : 's', qty: 0, cat: sp && sp.cat ? sp.cat : 'otros', label: sp && sp.servingLabel ? sp.servingLabel : '' });
      row.qty += qty;
    };
    DAYS.forEach((d) => dayItems(plan, d.dow).forEach((it) => {
      const sp = FoodDB.findSpec(it.foodId);
      const food = DB.getFoods().find((f) => f.id === it.foodId);
      if (food && food.recipe && Array.isArray(food.ingredients) && food.ingredients.length) {
        // una receta se desglosa en sus ingredientes (según las porciones que comes)
        const k = (it.servings || 1) / Math.max(0.25, Number(food.servings) || 1);
        food.ingredients.forEach((ing) => add(FoodDB.findSpec(ing.foodId), (Number(ing.qty) || 0) * k, ing.name || 'Ingrediente'));
      } else add(sp, it.grams ? it.grams : (it.servings || 1), it.foodName);
    }));
    return Object.values(acc);
  }

  const qtyLabel = (r) => {
    if (r.basis === 'g') return r.qty >= 1000 ? `${r1(r.qty / 1000)} kg` : `${r0(r.qty)} g`;
    const n = r1(r.qty);
    return `${n} ${n === 1 ? 'porción' : 'porciones'}${r.label && r.label !== '1 porción' ? ` (${r.label})` : ''}`;
  };

  function openShopping() {
    const rows = shoppingList();
    const body = Utils.el('div');
    if (!rows.length) { body.appendChild(Utils.el('p', { text: 'Tu plan está vacío.' })); Modal.open('🛒 Lista de compras', body); return; }
    const catInfo = (k) => FoodDB.CATEGORIES.find((c) => c.key === k) || { label: 'Otros', icon: '🛍️' };
    const order = FoodDB.CATEGORIES.map((c) => c.key).concat(['otros']);
    const groups = {};
    rows.forEach((r) => { (groups[r.cat] = groups[r.cat] || []).push(r); });
    body.appendChild(Utils.el('p', { class: 'small text-dim', text: `Suma de tus ${rows.length} productos de la semana. Toca para tachar lo que ya compraste.` }));
    const listEl = Utils.el('div', { class: 'shop-list' });
    body.appendChild(listEl);
    function paint() {
      listEl.innerHTML = '';
      order.filter((k) => groups[k]).forEach((k) => {
        const ci = catInfo(k);
        listEl.appendChild(Utils.el('div', { class: 'eyebrow shop-cat', text: `${ci.icon} ${ci.label}` }));
        groups[k].sort((a, b) => a.name.localeCompare(b.name, 'es')).forEach((r) => {
          const key = `${r.name}|${r.basis}`;
          const on = checked.has(key);
          const line = Utils.el('button', { type: 'button', class: `shop-row${on ? ' done' : ''}` }, [
            Utils.el('span', { class: 'shop-box', text: on ? '✓' : '' }),
            Utils.el('span', { class: 'shop-name', text: r.name }),
            Utils.el('span', { class: 'shop-qty', text: qtyLabel(r) }),
          ]);
          line.addEventListener('click', () => { if (on) checked.delete(key); else checked.add(key); paint(); });
          listEl.appendChild(line);
        });
      });
    }
    paint();
    const text = () => `🛒 Lista de compras\n${order.filter((k) => groups[k]).map((k) => `\n${catInfo(k).label}\n${groups[k].map((r) => `- ${r.name}: ${qtyLabel(r)}`).join('\n')}`).join('\n')}`;
    const copy = Utils.el('button', { class: 'btn-secondary btn-block', style: 'margin-top:10px;', text: '📋 Copiar lista' });
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(text()); Utils.toast('Lista copiada ✓'); } catch (e) { window.prompt('Copia tu lista:', text()); }
    });
    body.appendChild(copy);
    if (navigator.share) {
      const sh = Utils.el('button', { class: 'btn-primary btn-block', style: 'margin-top:8px;', text: '📤 Enviar lista' });
      sh.addEventListener('click', async () => { try { await navigator.share({ title: 'Lista de compras', text: text() }); } catch (e) { /* cerró */ } });
      body.appendChild(sh);
    }
    Modal.open('🛒 Lista de compras', body);
  }

  return { render };
})();
