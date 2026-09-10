/* ============================================================
   views/calculator.js — Calculadora de mantenimiento (TDEE) y
   de los 5 escenarios (déficit agresivo / mini déficit /
   mantenimiento / mini superávit / superávit agresivo)
   ============================================================ */

const CalculatorView = (() => {
  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();
    const measurements = DB.getMeasurements();
    const lastWeight = measurements.length ? measurements[measurements.length - 1].weight : '';

    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('h3', { text: '🧮 Calculadora de mantenimiento' }));
    card.appendChild(Utils.el('p', { text: 'Calcula tu gasto calórico total (TDEE) y compara déficit, mantenimiento o superávit para elegir tu meta diaria.' }));

    const weightInput = Utils.el('input', { type: 'number', step: '0.1', value: settings.calcWeightKg || lastWeight || '' });
    const heightInput = Utils.el('input', { type: 'number', value: settings.heightCm || '' });
    const ageInput = Utils.el('input', { type: 'number', value: settings.age || '' });
    const sexSel = Utils.el('select', {});
    [['M', 'Hombre'], ['F', 'Mujer']].forEach(([v, l]) => sexSel.appendChild(Utils.el('option', { value: v, text: l })));
    sexSel.value = settings.sex || 'M';
    const activitySel = Utils.el('select', {});
    Object.entries(Nutrition.ACTIVITY_MULTIPLIERS).forEach(([key, def]) => activitySel.appendChild(Utils.el('option', { value: key, text: def.label })));
    activitySel.value = settings.activityLevel || 'moderado';

    card.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso a usar (${settings.units})` }), weightInput]));
    card.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Estatura (cm)' }), heightInput]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Edad' }), ageInput]),
    ]));
    card.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Sexo (para la fórmula)' }), sexSel]));
    card.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nivel de actividad diaria + entrenamiento' }), activitySel]));

    const resultsWrap = Utils.el('div', { class: 'mt-8' });

    function calculate() {
      const weightRaw = Number(weightInput.value);
      const heightCm = Number(heightInput.value);
      const age = Number(ageInput.value);
      if (!weightRaw || !heightCm || !age) { Utils.toast('Completa peso, estatura y edad'); return; }
      const weightKg = settings.units === 'lb' ? weightRaw * 0.4536 : weightRaw;

      const s = DB.getSettings();
      Object.assign(s, { calcWeightKg: weightRaw, heightCm, age, sex: sexSel.value, activityLevel: activitySel.value });
      DB.saveSettings(s);

      const bmrVal = Nutrition.bmr({ sex: sexSel.value, weightKg, heightCm, age });
      const tdeeVal = Nutrition.tdee(bmrVal, activitySel.value);
      const plan = Nutrition.buildPlan(tdeeVal, weightKg);
      renderResults(resultsWrap, bmrVal, tdeeVal, plan);
    }

    const calcBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: 'Calcular' });
    calcBtn.addEventListener('click', calculate);
    card.appendChild(calcBtn);
    card.appendChild(resultsWrap);
    view.appendChild(card);

    const tip = Utils.el('div', { class: 'card' });
    tip.appendChild(Utils.el('h3', { text: '💡 Cómo afinar el número real' }));
    tip.appendChild(Utils.el('p', { text: 'La fórmula da un estimado (puede variar ±10-15%). Elige una meta, síguela 2 semanas registrando tus comidas y pesándote en "Medidas", y ajusta ±100-150 kcal según lo que realmente pase con tu peso: si no cambia lo esperado, sube o baja la meta.' }));
    view.appendChild(tip);

    root.appendChild(view);

    if (settings.heightCm && settings.age) calculate();
  }

  function renderResults(wrap, bmrVal, tdeeVal, plan) {
    wrap.innerHTML = '';
    wrap.appendChild(Utils.el('div', { class: 'grid-2 mt-8' }, [
      Utils.el('div', { class: 'stat-box' }, [
        Utils.el('div', { class: 'val', text: `${Math.round(bmrVal)}` }),
        Utils.el('div', { class: 'lbl', text: 'BMR (basal)' }),
      ]),
      Utils.el('div', { class: 'stat-box' }, [
        Utils.el('div', { class: 'val', text: `${Math.round(tdeeVal)}` }),
        Utils.el('div', { class: 'lbl', text: 'TDEE (mantenimiento)' }),
      ]),
    ]));

    const settings = DB.getSettings();
    plan.forEach((s) => {
      const isActive = settings.lastCalcGoalKey === s.key;
      const row = Utils.el('div', { class: 'card', style: `margin-top:10px;${isActive ? 'outline:2px solid var(--accent);' : ''}` });
      row.appendChild(Utils.el('div', { class: 'flex-between' }, [
        Utils.el('h3', { class: 'mb-0', text: s.label }),
        Utils.el('span', { class: 'pill', text: `${s.kcal} kcal` }),
      ]));
      row.appendChild(Utils.el('div', { class: 'small text-dim mt-8', text: s.note }));
      row.appendChild(Utils.el('div', { class: 'small mt-8', text: `Proteína ${s.protein}g · Carbos ${s.carbs}g · Grasas ${s.fat}g` }));
      row.appendChild(Utils.el('div', { class: 'small text-dim', text: s.weeklyDeltaKg === 0 ? 'Sin cambio de peso esperado' : `${s.weeklyDeltaKg > 0 ? '+' : ''}${s.weeklyDeltaKg} kg/semana estimado` }));
      const useBtn = Utils.el('button', { class: isActive ? 'btn-primary btn-block mt-8' : 'btn-secondary btn-block mt-8', text: isActive ? '✓ Meta activa' : 'Usar como mi meta diaria' });
      useBtn.addEventListener('click', () => {
        const sNow = DB.getSettings();
        sNow.calorieGoal = s.kcal;
        sNow.proteinGoal = s.protein;
        sNow.carbGoal = s.carbs;
        sNow.fatGoal = s.fat;
        sNow.lastCalcGoalKey = s.key;
        DB.saveSettings(sNow);
        Utils.toast(`Meta actualizada: ${s.label} (${s.kcal} kcal)`);
        renderResults(wrap, bmrVal, tdeeVal, plan);
      });
      row.appendChild(useBtn);
      wrap.appendChild(row);
    });
  }

  return { render };
})();
