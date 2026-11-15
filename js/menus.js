/* ============================================================
   menus.js — Menús ya hechos para tus calorías
   Eliges las calorías del día y un estilo (equilibrado, alto en
   proteína, económico, vegetariano) y arma desayuno, almuerzo, cena y
   snack con alimentos de la base de la app, ajustando los gramos para
   llegar a tu número. Puedes usarlo hoy o guardarlo en tu plan semanal.
   ============================================================ */

const Menus = (() => {
  const MEALS = [
    { key: 'desayuno', label: 'Desayuno', icon: '🌅', share: 0.25 },
    { key: 'almuerzo', label: 'Almuerzo', icon: '☀️', share: 0.35 },
    { key: 'cena', label: 'Cena', icon: '🌙', share: 0.28 },
    { key: 'snack', label: 'Snack', icon: '🍎', share: 0.12 },
  ];

  // cada estilo: 3 opciones por comida → [alimento, gramos base]
  const STYLES = {
    equilibrado: {
      label: '⚖️ Equilibrado', desc: 'De todo un poco: proteína, carbos y grasas buenas.',
      desayuno: [
        [['Avena en hojuelas (cruda)', 60], ['Leche entera', 250], ['Banano', 100], ['Mantequilla de maní', 15]],
        [['Huevo entero (crudo)', 120], ['Pan integral', 64], ['Aguacate', 50], ['Naranja', 130]],
        [['Yogur griego natural 0%', 170], ['Granola', 40], ['Arándanos / moras', 80], ['Miel', 10]],
      ],
      almuerzo: [
        [['Pechuga de pollo cocida', 150], ['Arroz blanco cocido', 200], ['Brócoli cocido', 100], ['Aceite de oliva', 8]],
        [['Carne molida de res magra (90/10) cocida', 130], ['Pasta cocida', 200], ['Tomate', 100], ['Aceite de oliva', 8]],
        [['Salmón cocido', 140], ['Camote / batata cocido', 200], ['Habichuelas verdes cocidas', 120], ['Aceite de oliva', 5]],
      ],
      cena: [
        [['Tilapia cocida', 150], ['Papa cocida', 200], ['Lechuga', 60], ['Tomate', 80], ['Aceite de oliva', 6]],
        [['Huevo entero (crudo)', 150], ['Tortilla de maíz', 84], ['Aguacate', 60], ['Espinaca cruda', 30]],
        [['Pavo pechuga cocida', 150], ['Quinoa cocida', 150], ['Calabacín / zucchini', 150], ['Aceite de oliva', 6]],
      ],
      snack: [
        [['Manzana', 180], ['Almendras', 28]],
        [['Yogur griego natural 0%', 170], ['Miel', 10]],
        [['Banano', 118], ['Mantequilla de maní', 16]],
      ],
    },
    proteina: {
      label: '💪 Alto en proteína', desc: 'Más pollo, pescado, huevo y lácteos magros para ganar o mantener músculo.',
      desayuno: [
        [['Clara de huevo', 200], ['Huevo entero (crudo)', 100], ['Pan integral', 64], ['Aguacate', 40]],
        [['Proteína en polvo (whey)', 30], ['Avena en hojuelas (cruda)', 60], ['Leche descremada', 250], ['Banano', 100]],
        [['Yogur griego natural 0%', 250], ['Granola', 40], ['Fresas', 100], ['Semillas de chía', 12]],
      ],
      almuerzo: [
        [['Pechuga de pollo cocida', 200], ['Arroz blanco cocido', 220], ['Brócoli cocido', 120], ['Aceite de oliva', 8]],
        [['Bistec / lomo de res cocido', 180], ['Papa cocida', 250], ['Lechuga', 80], ['Tomate', 100], ['Aceite de oliva', 8]],
        [['Atún en agua (lata, escurrido)', 180], ['Pasta cocida', 220], ['Tomate', 120], ['Aceite de oliva', 8]],
      ],
      cena: [
        [['Pavo pechuga cocida', 180], ['Camote / batata cocido', 200], ['Espinaca cruda', 60], ['Aceite de oliva', 5]],
        [['Salmón cocido', 150], ['Arroz integral cocido', 180], ['Habichuelas verdes cocidas', 120]],
        [['Pechuga de pollo cocida', 180], ['Quinoa cocida', 150], ['Brócoli cocido', 120], ['Aceite de oliva', 6]],
      ],
      snack: [
        [['Requesón / cottage', 150], ['Piña', 100]],
        [['Proteína en polvo (whey)', 30], ['Leche descremada', 250]],
        [['Yogur griego natural 0%', 170], ['Almendras', 20]],
      ],
    },
    economico: {
      label: '💰 Casero y económico', desc: 'Arroz, frijoles, huevo, pollo y plátano: barato y rinde.',
      desayuno: [
        [['Huevo entero (crudo)', 120], ['Arepa de maíz', 100], ['Queso fresco / campesino', 30], ['Leche entera', 200]],
        [['Avena en hojuelas (cruda)', 70], ['Leche entera', 250], ['Banano', 118]],
        [['Pan francés / baguette', 100], ['Huevo entero (crudo)', 100], ['Mantequilla', 8], ['Naranja', 130]],
      ],
      almuerzo: [
        [['Frijoles rojos / pintos cocidos', 180], ['Arroz blanco cocido', 200], ['Muslo de pollo sin piel cocido', 130], ['Zanahoria cruda', 60]],
        [['Lentejas cocidas', 250], ['Arroz blanco cocido', 180], ['Huevo cocido', 100], ['Tomate', 100]],
        [['Pasta cocida', 250], ['Carne molida de res magra (90/10) cocida', 120], ['Tomate', 120], ['Queso mozzarella', 20]],
      ],
      cena: [
        [['Arroz con pollo', 300], ['Aguacate', 40]],
        [['Sopa de pollo con verduras', 350], ['Pan blanco', 56], ['Aguacate', 40]],
        [['Huevo entero (crudo)', 120], ['Tortilla de maíz', 84], ['Frijoles negros cocidos', 120], ['Tomate', 80]],
      ],
      snack: [
        [['Banano', 118], ['Maní / cacahuates', 28]],
        [['Manzana', 180], ['Galletas de soda', 15]],
        [['Yogur natural entero', 250], ['Banano', 100]],
      ],
    },
    vegetariano: {
      label: '🥦 Vegetariano', desc: 'Sin carne: legumbres, huevo, lácteos, tofu y mucha verdura.',
      desayuno: [
        [['Avena en hojuelas (cruda)', 60], ['Leche de avena', 250], ['Fresas', 100], ['Nueces', 20]],
        [['Tofu firme', 150], ['Pan integral', 64], ['Aguacate', 60], ['Tomate', 80]],
        [['Yogur griego entero', 200], ['Granola', 40], ['Banano', 100]],
      ],
      almuerzo: [
        [['Lentejas cocidas', 250], ['Arroz integral cocido', 180], ['Espinaca cruda', 50], ['Aceite de oliva', 8]],
        [['Garbanzos cocidos', 200], ['Cuscús cocido', 180], ['Calabacín / zucchini', 150], ['Aceite de oliva', 8]],
        [['Frijoles negros cocidos', 220], ['Arroz blanco cocido', 180], ['Aguacate', 70], ['Tomate', 100]],
      ],
      cena: [
        [['Tofu firme', 200], ['Quinoa cocida', 160], ['Brócoli cocido', 150], ['Aceite de oliva', 6]],
        [['Huevo entero (crudo)', 150], ['Papa cocida', 200], ['Champiñones', 100], ['Queso mozzarella', 30]],
        [['Pasta cocida', 220], ['Hummus', 60], ['Tomate', 120], ['Queso mozzarella', 30]],
      ],
      snack: [
        [['Almendras', 28], ['Manzana', 150]],
        [['Hummus', 60], ['Zanahoria cruda', 120]],
        [['Yogur griego natural 0%', 170], ['Miel', 10]],
      ],
    },
  };

  const r0 = (n) => Math.round(Number(n) || 0);
  const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const FOOD_BY_NAME = () => { const m = {}; FoodDB.BUILTIN.forEach((f) => { m[f.name] = f; }); return m; };

  // redondea gramos a algo que se pueda pesar
  const niceG = (g) => (g < 12 ? Math.max(1, Math.round(g)) : g < 40 ? Math.round(g / 2) * 2 : Math.round(g / 5) * 5);

  // arma un día: { meal: [items], totals }
  function buildDay(style, target, dayIdx) {
    const st = STYLES[style];
    const byName = FOOD_BY_NAME();
    const day = {};
    const total = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    MEALS.forEach((m, mi) => {
      const opts = st[m.key];
      const base = opts[(dayIdx + mi) % opts.length];
      const baseK = base.reduce((s, [n, g]) => { const f = byName[n]; return s + (f ? FoodDB.macros(FoodDB.spec(f), g).kcal : 0); }, 0);
      const k = baseK > 0 ? Math.min(2.6, Math.max(0.4, (target * m.share) / baseK)) : 1;
      day[m.key] = base.map(([n, g]) => {
        const f = byName[n];
        if (!f) return null;
        const grams = niceG(g * k);
        const mac = FoodDB.macros(FoodDB.spec(f), grams);
        total.kcal += mac.kcal; total.protein += mac.protein; total.carbs += mac.carbs; total.fat += mac.fat;
        return { id: DB.uid(), foodId: f.id, foodName: f.name, grams, kcal: r1(mac.kcal), protein: r1(mac.protein), carbs: r1(mac.carbs), fat: r1(mac.fat) };
      }).filter(Boolean);
    });
    return { day, total };
  }

  // ---------------------------------------------------------------- pantalla
  function open() {
    const settings = DB.getSettings();
    let target = Math.round((settings.calorieGoal || 2200) / 50) * 50;
    let style = 'equilibrado';
    let variant = 0;
    const body = Utils.el('div');

    body.appendChild(Utils.el('p', { class: 'small', text: 'Elige tus calorías y un estilo: te armo el día con alimentos de la app y ajusto los gramos para llegar a tu número.' }));
    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 6px;', text: 'Calorías del día' }));
    const kRow = Utils.el('div', { class: 'rt-chips' });
    const kcalIn = Utils.el('input', { type: 'number', inputmode: 'numeric', class: 'qty-input', value: String(target), style: 'margin:8px 0;' });
    body.appendChild(kRow);
    body.appendChild(kcalIn);
    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:8px 0 6px;', text: 'Estilo' }));
    const sRow = Utils.el('div', { class: 'rt-chips' });
    const sDesc = Utils.el('div', { class: 'small text-dim', style: 'margin:6px 0 10px;' });
    body.appendChild(sRow);
    body.appendChild(sDesc);
    const preview = Utils.el('div');
    body.appendChild(preview);

    function paintChips() {
      kRow.innerHTML = '';
      [1500, 1800, 2000, 2200, 2500, 2800, 3000, 3500].forEach((k) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${target === k ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: String(k) });
        c.addEventListener('click', () => { target = k; kcalIn.value = String(k); paintChips(); paintPreview(); });
        kRow.appendChild(c);
      });
      sRow.innerHTML = '';
      Object.keys(STYLES).forEach((k) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${style === k ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: STYLES[k].label });
        c.addEventListener('click', () => { style = k; variant = 0; paintChips(); paintPreview(); });
        sRow.appendChild(c);
      });
      sDesc.textContent = STYLES[style].desc;
    }
    kcalIn.addEventListener('input', () => { const v = parseInt(kcalIn.value, 10); if (v >= 800 && v <= 6000) { target = v; paintChips(); paintPreview(); } });

    function paintPreview() {
      preview.innerHTML = '';
      const { day, total } = buildDay(style, target, variant);
      const head = Utils.el('div', { class: 'mn-total' }, [
        Utils.el('b', { text: `${r0(total.kcal)} kcal` }),
        Utils.el('span', { class: 'small text-dim', text: ` · P ${r0(total.protein)} g · C ${r0(total.carbs)} g · G ${r0(total.fat)} g` }),
      ]);
      preview.appendChild(head);
      MEALS.forEach((m) => {
        const items = day[m.key] || [];
        const t = items.reduce((s, e) => s + e.kcal, 0);
        const card = Utils.el('div', { class: 'mn-meal' });
        card.appendChild(Utils.el('div', { class: 'flex-between' }, [Utils.el('b', { text: `${m.icon} ${m.label}` }), Utils.el('span', { class: 'small text-dim', text: `${r0(t)} kcal` })]));
        items.forEach((e) => card.appendChild(Utils.el('div', { class: 'mn-item' }, [Utils.el('span', { text: e.foodName }), Utils.el('span', { class: 'small text-dim', text: `${e.grams} g · ${r0(e.kcal)} kcal` })])));
        preview.appendChild(card);
      });
      const shuffle = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: '🔄 Otra combinación' });
      shuffle.addEventListener('click', () => { variant += 1; paintPreview(); });
      preview.appendChild(shuffle);

      const todayBtn = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', style: 'margin-top:8px;', text: '📥 Usar este menú hoy' });
      todayBtn.addEventListener('click', () => {
        if (!Utils.confirmDialog(`Se agregarán los alimentos de este menú (${r0(total.kcal)} kcal) a tu registro de hoy. ¿Continuar?`)) return;
        const iso = Utils.todayISO();
        const log = DB.getCalorieLog();
        const list = log[iso] || [];
        MEALS.forEach((m) => (day[m.key] || []).forEach((it) => list.push({ id: DB.uid(), foodId: it.foodId, foodName: it.foodName, grams: it.grams, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat, meal: m.key, time: new Date().toISOString() })));
        log[iso] = list;
        DB.saveCalorieLog(log);
        Modal.close();
        Utils.toast('✓ Menú agregado a tu registro de hoy');
        App.navigate('calorias');
      });
      preview.appendChild(todayBtn);

      const planRow = Utils.el('div', { class: 'nut-actions act-2', style: 'margin-top:8px;' });
      const planDay = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '🗓️ Guardar en mi plan' });
      planDay.addEventListener('click', () => pickDays(day));
      const planWeek = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '📆 Semana completa' });
      planWeek.addEventListener('click', () => {
        if (!Utils.confirmDialog('Se armará un menú distinto para cada día de la semana y reemplazará tu plan semanal actual. ¿Continuar?')) return;
        const plan = {};
        for (let dow = 0; dow < 7; dow += 1) plan[String(dow)] = buildDay(style, target, variant + dow).day;
        DB.saveMealPlan(plan);
        Modal.close();
        Utils.toast('✓ Plan semanal listo (lista de compras incluida)');
        App.navigate('plancomidas');
      });
      planRow.appendChild(planDay); planRow.appendChild(planWeek);
      preview.appendChild(planRow);
      preview.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Los valores son aproximados (promedios de la base de la app). Ajusta gramos en tu plan o registro si lo necesitas.' }));
    }

    function pickDays(day) {
      const b2 = Utils.el('div');
      b2.appendChild(Utils.el('p', { class: 'small', text: 'Elige los días de tu plan semanal que usarán este menú (reemplaza lo que tengan).' }));
      const names = [['Lunes', 1], ['Martes', 2], ['Miércoles', 3], ['Jueves', 4], ['Viernes', 5], ['Sábado', 6], ['Domingo', 0]];
      const picked = new Set();
      const grid = Utils.el('div', { class: 'rt-chips' });
      names.forEach(([n, dow]) => {
        const c = Utils.el('button', { type: 'button', class: 'rt-chip', style: '--gc:var(--accent-light)', text: n });
        c.addEventListener('click', () => { if (picked.has(dow)) picked.delete(dow); else picked.add(dow); c.classList.toggle('active', picked.has(dow)); });
        grid.appendChild(c);
      });
      b2.appendChild(grid);
      const ok = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: 'Guardar' });
      ok.addEventListener('click', () => {
        if (!picked.size) { Utils.toast('Elige al menos un día'); return; }
        const plan = DB.getMealPlan();
        picked.forEach((dow) => {
          const copy = {};
          Object.keys(day).forEach((k) => { copy[k] = day[k].map((it) => Object.assign({}, it, { id: DB.uid() })); });
          plan[String(dow)] = copy;
        });
        DB.saveMealPlan(plan);
        Modal.close();
        Utils.toast(`✓ Guardado en ${picked.size} día${picked.size === 1 ? '' : 's'} de tu plan`);
        App.navigate('plancomidas');
      });
      b2.appendChild(ok);
      Modal.open('🗓️ ¿Qué días?', b2);
    }

    paintChips();
    paintPreview();
    Modal.open('✨ Menús listos por calorías', body);
  }

  return { open, buildDay, STYLES };
})();
