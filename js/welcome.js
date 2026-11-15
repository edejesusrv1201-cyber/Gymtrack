/* ============================================================
   welcome.js — Bienvenida de la primera vez
   Pregunta nombre, nivel, unidades y objetivo; calcula tus calorías y
   macros y te sugiere un programa de entrenamiento. Se salta sola si
   ya usas la app, y se puede repetir desde Más.
   ============================================================ */

const Welcome = (() => {
  const GOALS = [
    { key: 'perder', icon: '🔥', label: 'Perder grasa', scenario: 'mini_deficit', hint: 'Déficit suave y sostenible' },
    { key: 'mantener', icon: '⚖️', label: 'Mantener', scenario: 'mantenimiento', hint: 'Conservar tu peso y rendir' },
    { key: 'ganar', icon: '💪', label: 'Ganar músculo', scenario: 'mini_superavit', hint: 'Superávit controlado' },
  ];
  const LEVELS = [
    { key: 'principiante', icon: '🌱', label: 'Principiante', hint: 'Empiezo o vuelvo después de mucho' },
    { key: 'intermedio', icon: '💪', label: 'Intermedio', hint: 'Entreno con regularidad' },
    { key: 'avanzado', icon: '🔥', label: 'Avanzado', hint: 'Llevo años entrenando' },
  ];

  function hasData() {
    const wl = DB.getWorkoutLog();
    const anySets = Object.keys(wl).some((d) => (wl[d].exercises || []).some((e) => (e.sets || []).length));
    return anySets || DB.getMeasurements().length > 0 || Object.keys(DB.getCalorieLog()).length > 0;
  }

  // se llama al abrir la app: solo muestra la bienvenida a quien está empezando
  function maybeShow() {
    const s = DB.getSettings();
    if (s.welcomed) return;
    if (hasData()) { s.welcomed = true; DB.saveSettings(s); return; }
    setTimeout(() => { if (!document.querySelector('.modal-backdrop:not(.closing)')) open(); }, 700);
  }

  function open() {
    const s0 = DB.getSettings();
    const st = {
      name: s0.userName || '', sex: s0.userSex || null,
      level: s0.beginner ? 'principiante' : 'intermedio', units: s0.units || 'kg',
      goal: 'mantener', age: '', height: '', weight: '', activity: 'moderado', days: 3, step: 0,
    };
    const STEPS = 5;
    const body = Utils.el('div', { class: 'wz' });
    const dots = Utils.el('div', { class: 'wz-dots' });
    const content = Utils.el('div', { class: 'wz-body' });
    const nav = Utils.el('div', { class: 'nut-actions act-2', style: 'margin-top:16px;' });
    body.appendChild(dots); body.appendChild(content); body.appendChild(nav);

    const chip = (label, on, fn, style) => {
      const c = Utils.el('button', { type: 'button', class: `rt-chip plain${on ? ' active' : ''}`, style: style || '--gc:var(--accent-light)', text: label });
      c.addEventListener('click', fn);
      return c;
    };
    const choice = (icon, label, hint, on, fn) => {
      const b = Utils.el('button', { type: 'button', class: `wz-choice${on ? ' on' : ''}` }, [
        Utils.el('span', { class: 'wz-ico', text: icon }),
        Utils.el('span', { class: 'wz-txt' }, [Utils.el('b', { text: label }), Utils.el('span', { class: 'small text-dim', text: hint })]),
      ]);
      b.addEventListener('click', fn);
      return b;
    };

    // ---- cálculo de calorías
    function plan() {
      const age = parseFloat(st.age); const h = parseFloat(st.height); const wv = parseFloat(st.weight);
      if (!(age > 10) || !(h > 100) || !(wv > 20)) return null;
      const kg = Units.toKg(wv, st.units);
      const base = (sex) => Nutrition.bmr({ sex, weightKg: kg, heightCm: h, age });
      const b = st.sex === 'M' ? base('M') : st.sex === 'F' ? base('F') : (base('M') + base('F')) / 2;
      const t = Nutrition.tdee(b, st.activity);
      const sc = GOALS.find((g) => g.key === st.goal).scenario;
      const row = Nutrition.buildPlan(t, kg, { proteinPerKg: st.goal === 'ganar' ? 1.9 : 2.0 }).find((x) => x.key === sc);
      return { row, kg, tdee: t };
    }

    function paintDots() {
      dots.innerHTML = '';
      for (let i = 0; i < STEPS; i += 1) dots.appendChild(Utils.el('i', { class: i === st.step ? 'on' : i < st.step ? 'done' : '' }));
    }

    function stepName() {
      content.appendChild(Utils.el('div', { class: 'wz-hero', text: '👋' }));
      content.appendChild(Utils.el('h3', { text: '¡Bienvenido a MyGymTrack!' }));
      content.appendChild(Utils.el('p', { class: 'small', text: 'En un minuto dejo la app lista para ti: tus calorías, tus rutinas y tu guía de ejercicios. Todo se guarda en tu celular.' }));
      const name = Utils.el('input', { type: 'text', maxlength: '24', placeholder: 'Tu nombre o apodo', autocomplete: 'off', value: st.name });
      name.addEventListener('input', () => { st.name = name.value; });
      content.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: '¿Cómo te llamas?' }), name]));
      content.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 6px;', text: 'Sexo (para calcular tus calorías y las listas del ranking)' }));
      const row = Utils.el('div', { class: 'rt-chips' });
      const paint = () => { row.innerHTML = ''; [['M', 'Hombre'], ['F', 'Mujer'], [null, 'Prefiero no decir']].forEach(([v, t]) => row.appendChild(chip(t, st.sex === v, () => { st.sex = v; paint(); }))); };
      paint();
      content.appendChild(row);
    }

    function stepLevel() {
      content.appendChild(Utils.el('h3', { text: '¿Qué nivel tienes?' }));
      const list = Utils.el('div', { class: 'wz-list' });
      const paint = () => { list.innerHTML = ''; LEVELS.forEach((l) => list.appendChild(choice(l.icon, l.label, l.hint, st.level === l.key, () => { st.level = l.key; paint(); }))); };
      paint();
      content.appendChild(list);
      content.appendChild(Utils.el('p', { class: 'small text-dim', text: 'Con «Principiante» te muestro una guía animada de cómo hacer cada ejercicio la primera vez que lo abres.' }));
      content.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:10px 0 6px;', text: 'Unidades de peso' }));
      const u = Utils.el('div', { class: 'rt-chips' });
      const pu = () => { u.innerHTML = ''; [['kg', 'Kilos (kg)'], ['lb', 'Libras (lb)']].forEach(([k, t]) => u.appendChild(chip(t, st.units === k, () => { st.units = k; pu(); }))); };
      pu();
      content.appendChild(u);
    }

    function stepGoal() {
      content.appendChild(Utils.el('h3', { text: 'Tu objetivo' }));
      const list = Utils.el('div', { class: 'wz-list' });
      const paintG = () => { list.innerHTML = ''; GOALS.forEach((g) => list.appendChild(choice(g.icon, g.label, g.hint, st.goal === g.key, () => { st.goal = g.key; paintG(); upd(); }))); };
      content.appendChild(list);
      const mk = (label, key, ph, step) => {
        const i = Utils.el('input', { type: 'number', inputmode: 'decimal', step: step || 'any', placeholder: ph, value: st[key] });
        i.addEventListener('input', () => { st[key] = i.value; upd(); });
        return Utils.el('div', { class: 'field' }, [Utils.el('label', { text: label }), i]);
      };
      content.appendChild(Utils.el('div', { class: 'field-row' }, [mk('Edad', 'age', 'años'), mk('Estatura (cm)', 'height', 'cm'), mk(`Peso (${st.units})`, 'weight', st.units)]));
      const act = Utils.el('select', {});
      Object.keys(Nutrition.ACTIVITY_MULTIPLIERS).forEach((k) => act.appendChild(Utils.el('option', { value: k, text: Nutrition.ACTIVITY_MULTIPLIERS[k].label })));
      act.value = st.activity;
      act.addEventListener('change', () => { st.activity = act.value; upd(); });
      content.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Tu actividad diaria' }), act]));
      const out = Utils.el('div', { class: 'wz-calc' });
      content.appendChild(out);
      function upd() {
        out.innerHTML = '';
        const p = plan();
        const nb = nav.querySelector('.wz-next'); if (nb) nb.textContent = p ? 'Siguiente →' : 'Omitir →';
        if (!p) { out.appendChild(Utils.el('div', { class: 'small text-dim', text: 'Escribe tu edad, estatura y peso y calculo tus calorías. Puedes omitirlo y hacerlo después en Calorías.' })); return; }
        out.appendChild(Utils.el('div', { class: 'wz-kcal' }, [Utils.el('b', { text: String(p.row.kcal) }), ' kcal al día']));
        out.appendChild(Utils.el('div', { class: 'small text-dim', text: `Proteína ${p.row.protein} g · Carbos ${p.row.carbs} g · Grasas ${p.row.fat} g · tu gasto estimado es ${Math.round(p.tdee)} kcal` }));
      }
      paintG(); upd();
    }

    function recommended() {
      const beginner = st.level === 'principiante';
      const d = st.days;
      const id = d <= 3 ? (beginner ? 'fb3' : 'ppl3') : d === 4 ? 'tp4' : (st.level === 'avanzado' ? 'ppl6' : 'tp4');
      return Programs.LIST.find((p) => p.id === id) || Programs.LIST[0];
    }
    let programMade = false;
    function stepTrain() {
      content.appendChild(Utils.el('h3', { text: '¿Cuántos días puedes entrenar?' }));
      const row = Utils.el('div', { class: 'rt-chips' });
      const rec = Utils.el('div');
      const paint = () => {
        row.innerHTML = '';
        [2, 3, 4, 5, 6].forEach((d) => row.appendChild(chip(`${d} días`, st.days === d, () => { st.days = d; programMade = false; paint(); })));
        rec.innerHTML = '';
        const p = recommended();
        const card = Utils.el('div', { class: 'wz-prog' }, [
          Utils.el('div', { class: 'eyebrow', text: 'Programa sugerido' }),
          Utils.el('b', { text: p.name }),
          Utils.el('div', { class: 'small text-dim', text: `${p.level} · ${p.blurb}` }),
        ]);
        const mk = Utils.el('button', { class: programMade ? 'btn-secondary btn-block' : 'btn-primary btn-block', type: 'button', style: 'margin-top:10px;', text: programMade ? '✓ Rutinas creadas' : '📋 Crear mis rutinas' });
        mk.disabled = programMade;
        mk.addEventListener('click', () => {
          const r = Programs.apply(p, { months: 1, onlyEmpty: true });
          programMade = true;
          Utils.toast(`${r.routines} rutinas creadas${r.placed ? ` · ${r.placed} días en tu calendario` : ''}`);
          paint();
        });
        card.appendChild(mk);
        rec.appendChild(card);
      };
      paint();
      content.appendChild(row);
      content.appendChild(rec);
      content.appendChild(Utils.el('p', { class: 'small text-dim', text: 'También puedes hacerlo después en Plan → 📋 Programas, o entrenar libre sin rutina.' }));
    }

    function stepDone() {
      content.appendChild(Utils.el('div', { class: 'wz-hero', text: '🎉' }));
      content.appendChild(Utils.el('h3', { text: `¡Listo${st.name.trim() ? `, ${st.name.trim().split(/\s+/)[0]}` : ''}!` }));
      const tips = Utils.el('ul', { class: 'gd-list' });
      ['Toca «Entrenar» en Hoy para registrar tu primera serie.', 'En cada ejercicio, «🎓 Cómo se hace» te enseña la técnica.', 'Gana vales con tus retos de la semana y canjéalos por un premio.', 'Si algo no te gusta o falla, usa Más → «💬 Enviar feedback».'].forEach((t) => tips.appendChild(Utils.el('li', {}, [Utils.el('span', { text: '✅' }), Utils.el('span', { text: t })])));
      content.appendChild(tips);
    }

    // ---- guardar lo respondido
    function save() {
      const s = DB.getSettings();
      s.userName = st.name.trim().slice(0, 24);
      s.userSex = st.sex || '';
      s.units = st.units;
      s.beginner = st.level === 'principiante';
      if (s.beginner) s.guideSeen = {};
      const p = plan();
      if (p) {
        s.calorieGoal = p.row.kcal; s.proteinGoal = p.row.protein; s.carbGoal = p.row.carbs; s.fatGoal = p.row.fat;
        const list = DB.getMeasurements();
        const today = Utils.todayISO();
        let rec = list.find((m) => m.date === today);
        if (!rec) { rec = { id: DB.uid(), date: today }; list.push(rec); }
        if (!rec.weight) rec.weight = p.kg;
        list.sort((a, b) => (a.date > b.date ? 1 : -1));
        DB.saveMeasurements(list);
      }
      s.welcomed = true;
      DB.saveSettings(s);
    }

    function paint() {
      paintDots();
      content.innerHTML = '';
      [stepName, stepLevel, stepGoal, stepTrain, stepDone][st.step]();
      nav.innerHTML = '';
      const back = Utils.el('button', { class: 'btn-secondary', type: 'button', text: st.step === 0 ? 'Saltar' : '← Atrás' });
      back.addEventListener('click', () => {
        if (st.step === 0) { const s = DB.getSettings(); s.welcomed = true; DB.saveSettings(s); Modal.close(); return; }
        st.step -= 1; paint();
      });
      const last = st.step === STEPS - 1;
      const next = Utils.el('button', { class: 'btn-primary wz-next', type: 'button', text: last ? '🚀 Empezar' : st.step === 2 && !plan() ? 'Omitir →' : 'Siguiente →' });
      next.addEventListener('click', () => {
        if (last) { save(); Modal.close(); Utils.toast('¡A entrenar! 💪'); App.navigate('hoy'); return; }
        st.step += 1; paint();
      });
      nav.appendChild(back); nav.appendChild(next);
    }
    paint();
    Modal.open('👋 Bienvenida', body, { dismissOnBackdrop: false, onClose: () => { const s2 = DB.getSettings(); if (!s2.welcomed) { s2.welcomed = true; DB.saveSettings(s2); } } });
  }

  return { maybeShow, open };
})();
