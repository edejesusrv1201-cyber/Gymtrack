/* ============================================================
   diet.js — «Armar dieta»: te arma el día (o la semana) a la medida
   de tus calorías Y macros, respetando lo que no comes.

   Cómo funciona: cada comida se arma con una proteína, un carbohidrato,
   verduras, fruta y/o grasa elegidos de la base de la app; después se
   ajustan los gramos de la proteína, el carbo y la grasa hasta acercarse
   a lo que le toca a esa comida. Cada alimento se puede cambiar por otro
   parecido con un toque, y cada comida se puede rehacer entera.
   Se puede usar hoy o guardar en el plan semanal (con lista de compras).
   ============================================================ */

const Diet = (() => {
  const MEALS = [
    { key: 'desayuno', label: 'Desayuno', icon: '🌅', share: 0.25 },
    { key: 'almuerzo', label: 'Almuerzo', icon: '☀️', share: 0.35 },
    { key: 'cena', label: 'Cena', icon: '🌙', share: 0.28 },
    { key: 'snack', label: 'Snack', icon: '🍎', share: 0.12 },
  ];
  const DAYS = [
    { dow: 1, short: 'L', name: 'Lunes' }, { dow: 2, short: 'M', name: 'Martes' }, { dow: 3, short: 'X', name: 'Miércoles' },
    { dow: 4, short: 'J', name: 'Jueves' }, { dow: 5, short: 'V', name: 'Viernes' }, { dow: 6, short: 'S', name: 'Sábado' },
    { dow: 0, short: 'D', name: 'Domingo' },
  ];

  // [nombre en la base, gramos base, mínimo, máximo]
  const POOLS = {
    protMain: [['Pechuga de pollo cocida', 150, 70, 330], ['Muslo de pollo sin piel cocido', 150, 70, 300], ['Pavo pechuga cocida', 150, 70, 320],
      ['Carne molida de res magra (90/10) cocida', 130, 70, 260], ['Bistec / lomo de res cocido', 150, 70, 280], ['Lomo de cerdo cocido', 140, 70, 280],
      ['Salmón cocido', 140, 70, 250], ['Tilapia cocida', 150, 70, 320], ['Pescado blanco cocido (merluza, corvina)', 150, 70, 320],
      ['Atún en agua (lata, escurrido)', 120, 60, 250], ['Camarón cocido', 130, 60, 250], ['Huevo cocido', 120, 60, 240], ['Tofu firme', 180, 80, 350],
      ['Lentejas cocidas', 220, 120, 400], ['Garbanzos cocidos', 200, 100, 350], ['Frijoles negros cocidos', 200, 100, 380]],
    protBrk: [['Huevo entero (crudo)', 120, 60, 260], ['Yogur griego natural 0%', 200, 120, 420], ['Requesón / cottage', 150, 80, 300],
      ['Queso fresco / campesino', 50, 25, 100], ['Jamón de pavo', 70, 30, 140], ['Proteína en polvo (whey)', 30, 15, 60], ['Clara de huevo', 150, 80, 300]],
    carbBrk: [['Avena en hojuelas (cruda)', 60, 30, 120], ['Pan integral', 64, 30, 150], ['Arepa de maíz', 90, 50, 200], ['Tortilla de maíz', 84, 40, 170],
      ['Granola', 45, 25, 90], ['Cereal de maíz (cornflakes)', 40, 25, 90], ['Pan blanco', 60, 30, 140]],
    carbMain: [['Arroz blanco cocido', 200, 80, 420], ['Arroz integral cocido', 200, 80, 420], ['Pasta cocida', 200, 80, 400], ['Papa cocida', 250, 100, 480],
      ['Camote / batata cocido', 220, 100, 450], ['Quinoa cocida', 170, 80, 350], ['Yuca cocida', 150, 70, 300], ['Plátano verde cocido', 150, 70, 300],
      ['Cuscús cocido', 180, 80, 350], ['Tortilla de maíz', 84, 40, 170]],
    veg: [['Brócoli cocido', 100, 70, 160], ['Espinaca cruda', 60, 40, 120], ['Lechuga', 70, 40, 120], ['Tomate', 100, 60, 160], ['Zanahoria cruda', 80, 50, 140],
      ['Pepino', 80, 50, 140], ['Pimentón', 70, 40, 120], ['Calabacín / zucchini', 120, 70, 180], ['Coliflor cocida', 100, 70, 160], ['Champiñones', 80, 50, 140],
      ['Habichuelas verdes cocidas', 100, 70, 160], ['Ahuyama / calabaza', 100, 70, 160]],
    fruit: [['Banano', 100, 80, 160], ['Manzana', 150, 100, 220], ['Naranja', 130, 100, 200], ['Pera', 140, 100, 210], ['Fresas', 120, 80, 200], ['Arándanos / moras', 80, 60, 140],
      ['Piña', 120, 80, 200], ['Mango', 120, 80, 200], ['Papaya', 150, 100, 250], ['Kiwi', 100, 70, 160], ['Durazno', 130, 100, 200], ['Uvas', 100, 70, 160]],
    snackFruit: [['Banano', 118, 60, 300], ['Manzana', 180, 80, 360], ['Uvas', 120, 60, 260], ['Piña', 150, 80, 320], ['Mango', 140, 80, 300], ['Pera', 170, 80, 330], ['Naranja', 150, 80, 320]],
    snackProt: [['Yogur griego natural 0%', 170, 100, 380], ['Requesón / cottage', 150, 80, 280], ['Huevo cocido', 100, 50, 200], ['Proteína en polvo (whey)', 30, 15, 60],
      ['Jamón de pavo', 60, 30, 120], ['Atún en agua (lata, escurrido)', 80, 40, 160]],
    fatCook: [['Aceite de oliva', 8, 0, 25], ['Aguacate', 50, 0, 130], ['Aceite de oliva', 6, 0, 25]],
    fatNut: [['Almendras', 15, 0, 45], ['Nueces', 15, 0, 45], ['Mantequilla de maní', 14, 0, 40], ['Maní / cacahuates', 18, 0, 45], ['Aguacate', 40, 0, 110]],
  };

  // estructura de cada comida: [pool, ajusta (p/c/f o null)]
  const TEMPLATES = {
    desayuno: [['protBrk', 'p'], ['protBrk', 'p'], ['carbBrk', 'c'], ['fruit', null], ['fatNut', 'f']],
    almuerzo: [['protMain', 'p'], ['carbMain', 'c'], ['veg', null], ['veg', null], ['fatCook', 'f']],
    cena: [['protMain', 'p'], ['carbMain', 'c'], ['veg', null], ['veg', null], ['fatCook', 'f']],
    snack: [['snackProt', 'p'], ['snackFruit', 'c'], ['fatNut', 'f']],
  };

  const r0 = (n) => Math.round(Number(n) || 0);
  const r1 = (n) => Math.round((Number(n) || 0) * 10) / 10;
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const niceG = (g) => (g < 1 ? 0 : g < 12 ? Math.max(1, Math.round(g)) : g < 40 ? Math.round(g / 2) * 2 : Math.round(g / 5) * 5);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  const BY = {};
  FoodDB.BUILTIN.forEach((f) => { BY[f.name] = f; });
  const perG = {};
  const per = (name) => {
    if (!perG[name]) perG[name] = FoodDB.macros(FoodDB.spec(BY[name]), 1);
    return perG[name];
  };

  // ---------------------------------------------------------------- qué se permite
  function tags(name) {
    const n = norm(name);
    return {
      meat: /pollo|pavo|carne|bistec|cerdo|jamon|tocino|salchicha|higado|\bres\b/.test(n),
      fish: /atun|sardina|salmon|tilapia|pescado|camaron/.test(n),
      pork: /cerdo|jamon de cerdo|tocino|salchicha/.test(n),
      egg: /huevo|clara|yema/.test(n),
      dairy: /^leche (entera|descremada)|yogur|queso|requeson|whey|proteina en polvo/.test(n) || (/^mantequilla/.test(n) && !/mani/.test(n)),
      gluten: /^pan\b|pasta|trigo|tortilla de harina|galletas|granola|cuscus|cornflakes|baguette/.test(n),
      nuts: /almendra|mani|cacahuate|nuez|nueces|avellana/.test(n),
    };
  }
  function allowed(name, prefs) {
    if (!BY[name]) return false;
    const t = tags(name);
    if (prefs.type === 'veg' && (t.meat || t.fish)) return false;
    if (prefs.type === 'pesc' && t.meat) return false;
    if (prefs.noFish && t.fish) return false;
    if (prefs.noPork && t.pork) return false;
    if (prefs.noDairy && t.dairy) return false;
    if (prefs.noEgg && t.egg) return false;
    if (prefs.noGluten && t.gluten) return false;
    if (prefs.noNuts && t.nuts) return false;
    const n = norm(name);
    const words = String(prefs.extra || '').split(',').map((w) => norm(w).trim()).filter((w) => w.length > 1);
    if (words.some((w) => n.includes(w))) return false;
    return true;
  }
  // si por tus restricciones no queda ninguna proteína de desayuno (p. ej. vegano), se usan las del almuerzo (tofu, legumbres)
  const poolFor = (poolKey, prefs) => {
    const list = POOLS[poolKey].filter((p) => allowed(p[0], prefs));
    return list.length || poolKey !== 'protBrk' ? list : POOLS.protMain.filter((p) => allowed(p[0], prefs));
  };

  // ---------------------------------------------------------------- armar una comida
  const totalsOf = (items) => items.reduce((a, it) => {
    const m = per(it.name);
    return { kcal: a.kcal + m.kcal * it.g, protein: a.protein + m.protein * it.g, carbs: a.carbs + m.carbs * it.g, fat: a.fat + m.fat * it.g };
  }, { kcal: 0, protein: 0, carbs: 0, fat: 0 });

  // acerca los gramos de las fuentes de proteína (p), carbo (c) y grasa (f) a lo que le toca a la comida
  function solve(items, tgt) {
    const key = { p: 'protein', c: 'carbs', f: 'fat' };
    for (let i = 0; i < 24; i += 1) {
      ['p', 'c', 'f'].forEach((k) => {
        const group = items.filter((x) => x.adj === k);
        if (!group.length) return;
        const diff = tgt[key[k]] - totalsOf(items)[key[k]];
        group.forEach((it) => {
          const pg = per(it.name)[key[k]];
          if (pg < 0.02) return;
          it.g = clamp(it.g + ((diff / group.length) / pg) * 0.8, it.min, it.max);
        });
      });
    }
  }

  // error relativo de una comida frente a lo que le toca (0 = perfecto)
  function mealError(items, tgt) {
    const t = totalsOf(items.map((it) => Object.assign({}, it, { g: niceG(it.g) })));
    const rel = (v, g, floor) => Math.abs(v - g) / Math.max(g, floor);
    return rel(t.kcal, tgt.kcal, 150) * 1.2 + rel(t.protein, tgt.protein, 12) * 1.2 + rel(t.carbs, tgt.carbs, 15) * 0.8 + rel(t.fat, tgt.fat, 8) * 0.8;
  }

  // arma una comida probando varias combinaciones y quedándose con la que mejor encaja
  // avoid: alimentos que no queremos repetir (otra comida, otros días) · counts: cuántas veces ya se usó cada uno
  function buildMeal(mealKey, seed, prefs, tgt, opts = {}) {
    const avoid = opts.avoid || new Set();
    const counts = opts.counts || {};
    let best = null;
    for (let c = 0; c < 10; c += 1) {
      const used = new Set();
      let items = [];
      TEMPLATES[mealKey].forEach(([poolKey, adj], slot) => {
        const pool = poolFor(poolKey, prefs).filter((p) => !used.has(p[0]));
        if (!pool.length) return;
        const [name, base, min, max] = pool[(seed + c * (slot + 1) + slot * 3 + (poolKey === 'veg' ? slot : 0)) % pool.length];
        used.add(name);
        items.push({ name, pool: poolKey, adj, g: base, min, max });
      });
      solve(items, tgt);
      items.forEach((it) => { if (it.adj === 'f' && it.g < 4) it.g = 0; });      // grasa de adorno que no hace falta (queda oculta)
      let err = mealError(items, tgt) + c * 0.012;
      items.forEach((it) => {
        if (it.adj === 'p' || it.adj === 'c') err += (counts[it.name] || 0) * 0.14;
        if (avoid.has(it.name) && (it.adj === 'p' || it.adj === 'c')) err += 0.9;
        if (it.g <= it.min + 0.5 || it.g >= it.max - 0.5) err += it.adj ? 0.06 : 0;   // al tope: poco realista
      });
      if (!best || err < best.err) best = { err, items };
    }
    return best ? best.items : [];
  }

  // reparto de lo que toca en cada comida (si no hay snack, su parte se reparte entre las demás)
  function mealTargets(goals, meals) {
    const shares = MEALS.filter((m) => meals.includes(m.key));
    const tot = shares.reduce((n, m) => n + m.share, 0);
    const out = {};
    shares.forEach((m) => {
      const k = m.share / tot;
      out[m.key] = { kcal: goals.kcal * k, protein: goals.protein * k, carbs: goals.carbs * k, fat: goals.fat * k };
    });
    return out;
  }

  // un día completo: { comida: { seed, items } }
  function buildDay(goals, meals, prefs, dayIdx, variant, counts) {
    const tg = mealTargets(goals, meals);
    const day = {};
    const today = new Set();
    meals.forEach((mk, mi) => {
      const seed = dayIdx * 2 + mi * 3 + (variant || 0) + (mk === 'cena' ? 5 : 0);
      const items = buildMeal(mk, seed, prefs, tg[mk], { counts, avoid: today });
      items.forEach((it) => { if (it.adj === 'p' || it.adj === 'c') { today.add(it.name); if (counts) counts[it.name] = (counts[it.name] || 0) + 1; } });
      day[mk] = { seed, items };
    });
    return day;
  }

  const finalG = (it) => niceG(it.g);
  const live = (items) => items.filter((it) => finalG(it) > 0);
  function itemRecord(mealKey, it) {
    const g = finalG(it);
    const m = FoodDB.macros(FoodDB.spec(BY[it.name]), g);
    return { id: DB.uid(), foodId: BY[it.name].id, foodName: it.name, grams: g, kcal: r1(m.kcal), protein: r1(m.protein), carbs: r1(m.carbs), fat: r1(m.fat), meal: mealKey };
  }
  function dayTotals(day) {
    const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    Object.keys(day).forEach((mk) => live(day[mk].items).forEach((it) => {
      const m = FoodDB.macros(FoodDB.spec(BY[it.name]), finalG(it));
      t.kcal += m.kcal; t.protein += m.protein; t.carbs += m.carbs; t.fat += m.fat;
    }));
    return t;
  }
  const toPlanDay = (day) => {
    const out = {};
    Object.keys(day).forEach((mk) => { out[mk] = live(day[mk].items).map((it) => { const r = itemRecord(mk, it); delete r.meal; return r; }); });
    return out;
  };

  // ---------------------------------------------------------------- pantalla
  function defaultGoals() {
    const s = DB.getSettings();
    const kcal = s.calorieGoal || 2200;
    let { proteinGoal: protein, carbGoal: carbs, fatGoal: fat } = s;
    if (!protein || !carbs || !fat) {
      protein = Math.round((kcal * 0.28) / 4); fat = Math.round((kcal * 0.27) / 9); carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    }
    return { kcal, protein, carbs, fat };
  }

  function open() {
    const saved = DB.getSettings().dietPrefs || {};
    const goals = Object.assign(defaultGoals(), saved.goals || {});
    const prefs = Object.assign({ type: 'omni', noDairy: false, noEgg: false, noGluten: false, noNuts: false, noFish: false, noPork: false, extra: '' }, saved.prefs || {});
    let nMeals = saved.nMeals === 3 ? 3 : 4;
    let week = false;
    let selDow = new Date().getDay();
    let variant = 0;
    let days = {};          // dow -> día armado
    const body = Utils.el('div');
    const meals = () => (nMeals === 3 ? ['desayuno', 'almuerzo', 'cena'] : ['desayuno', 'almuerzo', 'cena', 'snack']);

    function persist() {
      const s = DB.getSettings();
      s.dietPrefs = { goals, prefs, nMeals };
      DB.saveSettings(s);
    }

    function rebuild() {
      days = {};
      const counts = {};
      DAYS.forEach((d, i) => { days[d.dow] = buildDay(goals, meals(), prefs, i, variant, counts); });
      persist();
    }

    // ---- controles
    body.appendChild(Utils.el('p', { class: 'small', text: 'Te armo el día con alimentos de la app para llegar a tus calorías y macros. Ajusta tus metas y lo que no comes; después cambia lo que no te guste con un toque.' }));
    const gRow = Utils.el('div', { class: 'field-row' });
    const inputs = {};
    [['kcal', 'Calorías'], ['protein', 'Proteína g'], ['carbs', 'Carbos g'], ['fat', 'Grasas g']].forEach(([k, label]) => {
      const inp = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(r0(goals[k])) });
      inp.addEventListener('change', () => {
        const v = parseFloat(inp.value);
        if (!(v > 0)) { inp.value = String(r0(goals[k])); return; }
        goals[k] = v;
        if (k === 'kcal') { const d = defaultGoals(); const f = v / (d.kcal || v); goals.protein = r0(d.protein * f); goals.carbs = r0(d.carbs * f); goals.fat = r0(d.fat * f); ['protein', 'carbs', 'fat'].forEach((x) => { inputs[x].value = String(goals[x]); }); }
        rebuild(); paint();
      });
      inputs[k] = inp;
      gRow.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: label }), inp]));
    });
    body.appendChild(gRow);
    const kInfo = Utils.el('div', { class: 'small text-dim', style: 'margin:-4px 0 8px;' });
    body.appendChild(kInfo);

    const chipRow = (labelText) => { body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:8px 0 6px;', text: labelText })); const r = Utils.el('div', { class: 'rt-chips' }); body.appendChild(r); return r; };
    const typeRow = chipRow('Tipo de dieta');
    const exclRow = chipRow('No incluir');
    const mealsRow = chipRow('Comidas al día');
    const extra = Utils.el('input', { type: 'text', placeholder: 'Otros que no comes (ej. cerdo, atún, kiwi)', value: prefs.extra || '', style: 'margin:6px 0;' });
    extra.addEventListener('change', () => { prefs.extra = extra.value; rebuild(); paint(); });
    body.appendChild(extra);

    const paintChips = () => {
      typeRow.innerHTML = '';
      [['omni', '🍗 Como de todo'], ['pesc', '🐟 Pescetariano'], ['veg', '🥦 Vegetariano']].forEach(([k, t]) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${prefs.type === k ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
        c.addEventListener('click', () => { prefs.type = k; rebuild(); paintChips(); paint(); });
        typeRow.appendChild(c);
      });
      exclRow.innerHTML = '';
      [['noDairy', 'Sin lácteos'], ['noEgg', 'Sin huevo'], ['noGluten', 'Sin gluten'], ['noNuts', 'Sin frutos secos'], ['noFish', 'Sin pescado'], ['noPork', 'Sin cerdo']].forEach(([k, t]) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip${prefs[k] ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
        c.addEventListener('click', () => { prefs[k] = !prefs[k]; rebuild(); paintChips(); paint(); });
        exclRow.appendChild(c);
      });
      mealsRow.innerHTML = '';
      [[3, '3 comidas'], [4, '3 + snack']].forEach(([n, t]) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${nMeals === n ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
        c.addEventListener('click', () => { nMeals = n; rebuild(); paintChips(); paint(); });
        mealsRow.appendChild(c);
      });
    };

    // ---- vista previa
    const preview = Utils.el('div', { style: 'margin-top:10px;' });
    body.appendChild(preview);

    function diffChip(label, val, goal, unit) {
      const d = val - goal;
      const ok = Math.abs(d) <= goal * 0.06;
      return Utils.el('span', { class: `diet-chip${ok ? ' ok' : ''}`, text: `${label} ${r0(val)}${unit} ${ok ? '✓' : `(${d > 0 ? '+' : ''}${r0(d)})`}` });
    }

    function swap(day, mk, idx) {
      const m = day[mk];
      const it = m.items[idx];
      const pool = poolFor(it.pool, prefs);
      const inUse = new Set(m.items.map((x) => x.name));
      const options = pool.filter((p) => !inUse.has(p[0]));
      if (!options.length) { Utils.toast('No hay otra opción con tus restricciones'); return; }
      const cur = pool.findIndex((p) => p[0] === it.name);
      const next = options[(Math.max(0, cur) + 1) % options.length] || options[0];
      m.items[idx] = { name: next[0], pool: it.pool, adj: it.adj, g: next[1], min: next[2], max: next[3] };
      solve(m.items, mealTargets(goals, meals())[mk]);
      m.items.forEach((x) => { if (x.adj === 'f' && x.g < 4) x.g = 0; });
    }

    function paint() {
      kInfo.textContent = `Tus macros suman ${r0(goals.protein * 4 + goals.carbs * 4 + goals.fat * 9)} kcal.`;
      preview.innerHTML = '';
      const dow = week ? selDow : new Date().getDay();
      const day = days[dow];
      if (!day) return;

      // semana / un día
      const modeSeg = Utils.segmented([{ key: 'day', label: 'Un día' }, { key: 'week', label: 'Semana (7 días distintos)' }], week ? 'week' : 'day', (k) => { week = k === 'week'; paint(); }, true);
      preview.appendChild(modeSeg);
      if (week) {
        const tabs = Utils.el('div', { class: 'mp-days', style: 'margin:8px 0;' });
        DAYS.forEach((d) => {
          const b = Utils.el('button', { type: 'button', class: `mp-day${d.dow === selDow ? ' active' : ''}` }, [Utils.el('span', { class: 'mp-d', text: d.short })]);
          b.addEventListener('click', () => { selDow = d.dow; paint(); });
          tabs.appendChild(b);
        });
        preview.appendChild(tabs);
      }

      const tot = dayTotals(day);
      preview.appendChild(Utils.el('div', { class: 'diet-total' }, [
        Utils.el('b', { text: `${r0(tot.kcal)} kcal` }), Utils.el('span', { class: 'small text-dim', text: ` de ${r0(goals.kcal)}` }),
      ]));
      preview.appendChild(Utils.el('div', { class: 'diet-chips' }, [
        diffChip('P', tot.protein, goals.protein, ' g'), diffChip('C', tot.carbs, goals.carbs, ' g'), diffChip('G', tot.fat, goals.fat, ' g'),
      ]));

      meals().forEach((mk) => {
        const meta = MEALS.find((m) => m.key === mk);
        const m = day[mk];
        const t = live(m.items).reduce((a, it) => a + FoodDB.macros(FoodDB.spec(BY[it.name]), finalG(it)).kcal, 0);
        const card = Utils.el('div', { class: 'mn-meal' });
        const redo = Utils.el('button', { type: 'button', class: 'link-btn small', text: '🎲 Otra', title: 'Rehacer esta comida' });
        redo.addEventListener('click', () => { m.seed += 1; m.items = buildMeal(mk, m.seed, prefs, mealTargets(goals, meals())[mk], { avoid: new Set(m.items.map((x) => x.name)) }); paint(); });
        card.appendChild(Utils.el('div', { class: 'flex-between' }, [Utils.el('b', { text: `${meta.icon} ${meta.label}` }), Utils.el('span', { class: 'small text-dim', text: `${r0(t)} kcal` }), redo]));
        m.items.forEach((it, idx) => {
          if (finalG(it) <= 0) return;
          const mac = FoodDB.macros(FoodDB.spec(BY[it.name]), finalG(it));
          const sw = Utils.el('button', { type: 'button', class: 'diet-swap', text: '🔄', title: 'Cambiar por otro parecido' });
          sw.addEventListener('click', () => { swap(day, mk, idx); paint(); });
          card.appendChild(Utils.el('div', { class: 'mn-item diet-item' }, [
            Utils.el('span', { text: it.name }),
            Utils.el('span', { class: 'small text-dim', text: `${finalG(it)} g · ${r0(mac.kcal)} kcal` }),
            sw,
          ]));
        });
        preview.appendChild(card);
      });

      const again = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: week ? '🔄 Otra semana' : '🔄 Otro día' });
      again.addEventListener('click', () => { variant += 1; rebuild(); paint(); });
      preview.appendChild(again);

      const todayBtn = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', style: 'margin-top:8px;', text: '📥 Usar este día hoy' });
      todayBtn.addEventListener('click', () => {
        if (!Utils.confirmDialog(`Se agregarán los alimentos de este día (${r0(tot.kcal)} kcal) a tu registro de hoy. ¿Continuar?`)) return;
        const iso = Utils.todayISO();
        const log = DB.getCalorieLog();
        const list = log[iso] || [];
        meals().forEach((mk) => live(day[mk].items).forEach((it) => list.push(Object.assign(itemRecord(mk, it), { time: new Date().toISOString() }))));
        log[iso] = list;
        DB.saveCalorieLog(log);
        Modal.close();
        Utils.toast('✓ Dieta agregada a tu registro de hoy');
        App.navigate('calorias');
      });
      preview.appendChild(todayBtn);

      const planBtn = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: week ? '🗓️ Guardar la semana en mi plan + lista de compras' : '🗓️ Guardar este día en mi plan' });
      planBtn.addEventListener('click', () => {
        if (week) {
          if (!Utils.confirmDialog('Se guardarán los 7 días en tu plan semanal y reemplazan lo que tengas. ¿Continuar?')) return;
          const plan = {};
          DAYS.forEach((d) => { plan[String(d.dow)] = toPlanDay(days[d.dow]); });
          DB.saveMealPlan(plan);
          Modal.close();
          Utils.toast('✓ Semana guardada: abajo tienes la lista de compras');
          App.navigate('plancomidas');
        } else pickDays(day);
      });
      preview.appendChild(planBtn);
      preview.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Los valores son aproximados (promedios de la base de la app). Si cambias un alimento, el resto de la comida se reajusta para mantener tus macros.' }));
    }

    function pickDays(day) {
      const b2 = Utils.el('div');
      b2.appendChild(Utils.el('p', { class: 'small', text: 'Elige los días de tu plan que usarán este menú (reemplaza lo que tengan).' }));
      const picked = new Set();
      const grid = Utils.el('div', { class: 'rt-chips' });
      DAYS.forEach((d) => {
        const c = Utils.el('button', { type: 'button', class: 'rt-chip', style: '--gc:var(--accent-light)', text: d.name });
        c.addEventListener('click', () => { if (picked.has(d.dow)) picked.delete(d.dow); else picked.add(d.dow); c.classList.toggle('active', picked.has(d.dow)); });
        grid.appendChild(c);
      });
      b2.appendChild(grid);
      const ok = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: 'Guardar' });
      ok.addEventListener('click', () => {
        if (!picked.size) { Utils.toast('Elige al menos un día'); return; }
        const plan = DB.getMealPlan();
        picked.forEach((dow) => { plan[String(dow)] = toPlanDay(day); });
        DB.saveMealPlan(plan);
        Modal.close();
        Utils.toast(`✓ Guardado en ${picked.size} día${picked.size === 1 ? '' : 's'} de tu plan`);
        App.navigate('plancomidas');
      });
      b2.appendChild(ok);
      Modal.open('🗓️ ¿Qué días?', b2);
    }

    rebuild();
    paintChips();
    paint();
    const tpl = Utils.el('button', { class: 'link-btn small', type: 'button', style: 'margin-top:6px;', text: '✨ Prefiero un menú ya hecho (equilibrado, económico…) →' });
    tpl.addEventListener('click', () => { Modal.close(); Menus.open(); });
    body.appendChild(tpl);
    Modal.open('🥗 Armar dieta', body);
  }

  return { open, buildDay, dayTotals };
})();
