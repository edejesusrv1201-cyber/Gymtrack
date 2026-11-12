/* ============================================================
   views/measurements.js — Medidas corporales + progreso
   ============================================================ */

const MeasurementsView = (() => {
  const FIELDS = [
    { key: 'weight', label: 'Peso', unit: () => Units.current(), required: true },
    { key: 'chest', label: 'Pecho', unit: () => 'cm' },
    { key: 'waist', label: 'Cintura', unit: () => 'cm' },
    { key: 'hips', label: 'Cadera', unit: () => 'cm' },
    { key: 'armL', label: 'Brazo izquierdo', unit: () => 'cm' },
    { key: 'armR', label: 'Brazo derecho', unit: () => 'cm' },
    { key: 'thighL', label: 'Muslo izquierdo', unit: () => 'cm' },
    { key: 'thighR', label: 'Muslo derecho', unit: () => 'cm' },
    { key: 'calfL', label: 'Pantorrilla izquierda', unit: () => 'cm' },
    { key: 'calfR', label: 'Pantorrilla derecha', unit: () => 'cm' },
    { key: 'neck', label: 'Cuello', unit: () => 'cm' },
  ];
  // campos antiguos (una sola medida para brazo/muslo/pantorrilla) que ya
  // tenga guardados el usuario; se siguen mostrando en historial y gráfico
  // pero el formulario de registro ya solo usa los campos izq/der de arriba.
  const LEGACY_FIELDS = [
    { key: 'arm', label: 'Brazo', unit: () => 'cm' },
    { key: 'thigh', label: 'Muslo', unit: () => 'cm' },
    { key: 'calf', label: 'Pantorrilla', unit: () => 'cm' },
  ];
  const ALL_FIELDS = [...FIELDS, ...LEGACY_FIELDS];

  let chartField = 'weight';

  function render(root) {
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const measurements = DB.getMeasurements();

    const addBtn = Utils.el('button', { class: 'btn-primary', style: 'margin-bottom:14px;', text: '➕ Registrar medidas de hoy' });
    addBtn.addEventListener('click', () => {
      Modal.open('Registrar medidas', buildForm(null, () => { Modal.close(); render(root); }));
    });
    view.appendChild(addBtn);

    view.appendChild(goalCard(measurements, () => render(root)));
    view.appendChild(Photos.card());

    // ---- gráfico de progreso ----
    if (measurements.length >= 2) {
      const chartCard = Utils.el('div', { class: 'card' });
      chartCard.appendChild(Utils.el('div', { class: 'card-title-row' }, [
        Utils.el('h3', { text: 'Progreso' }),
        Utils.el('span', { class: 'eyebrow', text: `${measurements.length} registros` }),
      ]));
      const fieldsWithData = ALL_FIELDS.filter((f) => measurements.some((m) => m[f.key] !== undefined && m[f.key] !== null && m[f.key] !== ''));
      if (!fieldsWithData.some((f) => f.key === chartField)) chartField = fieldsWithData[0].key;
      const fieldSelect = Utils.el('select', {});
      fieldsWithData.forEach((f) => {
        fieldSelect.appendChild(Utils.el('option', { value: f.key, text: f.label, selected: f.key === chartField ? 'selected' : null }));
      });
      fieldSelect.value = chartField;
      fieldSelect.addEventListener('change', () => { chartField = fieldSelect.value; render(root); });
      chartCard.appendChild(fieldSelect);

      const kpis = Utils.el('div', { class: 'grid-3 mt-12' });
      chartCard.appendChild(kpis);

      const chartWrap = Utils.el('div', { class: 'chart-wrap mt-12' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      chartWrap.appendChild(canvas);
      chartCard.appendChild(chartWrap);
      const tooltip = Utils.el('div', { class: 'chart-note', id: 'chartTooltip' });
      chartCard.appendChild(tooltip);
      view.appendChild(chartCard);
      renderKpis(kpis, measurements, chartField);
      requestAnimationFrame(() => drawChart(canvas, measurements, chartField, tooltip));
    } else if (measurements.length === 1) {
      view.appendChild(Utils.el('div', { class: 'card' }, [
        Utils.el('p', { text: 'Registra otra medida más y aquí aparecerá tu gráfico de progreso con la tendencia.' }),
      ]));
    }

    // ---- historial ----
    const histCard = Utils.el('div', { class: 'card' });
    histCard.appendChild(Utils.el('h3', { text: 'Historial' }));
    if (measurements.length === 0) {
      histCard.appendChild(Utils.el('div', { class: 'empty-state' }, [
        Utils.el('div', { class: 'icon', text: '📏' }),
        Utils.el('div', { text: 'Aún no has registrado medidas.' }),
      ]));
    } else {
      [...measurements].reverse().forEach((m) => {
        const summary = ALL_FIELDS.filter((f) => m[f.key] !== undefined && m[f.key] !== null && m[f.key] !== '')
          .map((f) => `${f.label} ${f.key === 'weight' ? Units.num(m[f.key]) : m[f.key]}${typeof f.unit === 'function' ? f.unit() : ''}`).join(' · ');
        const row = Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { text: Utils.friendlyDate(m.date) }),
            Utils.el('div', { class: 'meta', text: summary }),
          ]),
          Utils.el('div', {}, [
            Utils.el('button', { class: 'btn-small', text: 'Editar', style: 'margin-right:6px;' }),
            Utils.el('button', { class: 'btn-small', text: '🗑️' }),
          ]),
        ]);
        row.querySelectorAll('button')[0].addEventListener('click', () => {
          const body = buildForm(m, () => { Modal.close(); render(root); });
          Modal.open('Editar medidas', body);
        });
        row.querySelectorAll('button')[1].addEventListener('click', () => {
          if (!Utils.confirmDialog('¿Eliminar este registro de medidas?')) return;
          DB.saveMeasurements(DB.getMeasurements().filter((x) => x.id !== m.id));
          render(root);
        });
        histCard.appendChild(row);
      });
    }
    view.appendChild(histCard);

    root.appendChild(view);
  }

  function buildForm(existing, onSaved) {
    const wrap = Utils.el('div');
    const dateInput = Utils.el('input', { type: 'date', value: existing ? existing.date : Utils.todayISO() });
    wrap.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Fecha' }), dateInput]));

    // el peso se guarda en kg; se puede escribir en kg o lb (se recuerda la última unidad usada)
    const savedUnit = DB.getSettings().bodyWeightUnit;
    let bodyUnit = savedUnit === 'lb' || savedUnit === 'kg' ? savedUnit : Units.current();

    const inputs = {};
    FIELDS.forEach((f) => {
      const inp = Utils.el('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: f.required ? `Peso (${bodyUnit})` : `${f.label} (cm)` });
      if (existing && existing[f.key] !== undefined && existing[f.key] !== null) {
        inp.value = f.key === 'weight' ? Units.num(existing[f.key], bodyUnit) : existing[f.key];
      }
      inputs[f.key] = inp;
    });

    const weightLabel = Utils.el('label', { text: `Peso (${bodyUnit}) *` });
    const unitBtn = Utils.el('button', { class: 'unit-btn', type: 'button', title: 'Cambiar entre kg y lb', text: bodyUnit });
    unitBtn.addEventListener('click', () => {
      const next = bodyUnit === 'kg' ? 'lb' : 'kg';
      const typed = parseFloat(inputs.weight.value);
      if (!isNaN(typed)) inputs.weight.value = Math.round(Units.fromKg(Units.toKg(typed, bodyUnit), next) * 10) / 10;
      bodyUnit = next;
      const st = DB.getSettings();
      st.bodyWeightUnit = next;
      DB.saveSettings(st);
      unitBtn.textContent = next;
      weightLabel.textContent = `Peso (${next}) *`;
      inputs.weight.placeholder = `Peso (${next})`;
    });
    wrap.appendChild(Utils.el('div', { class: 'field' }, [weightLabel, Utils.el('div', { class: 'input-unit' }, [inputs.weight, unitBtn])]));
    const grid = Utils.el('div', { class: 'grid-2' });
    FIELDS.filter((f) => !f.required).forEach((f) => {
      grid.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: f.label }), inputs[f.key]]));
    });
    wrap.appendChild(grid);

    const saveBtn = Utils.el('button', { class: 'btn-primary btn-block mt-8', text: existing ? 'Guardar cambios' : '✓ Registrar medidas' });
    saveBtn.addEventListener('click', () => {
      if (!inputs.weight.value) { Utils.toast('Ingresa al menos el peso'); return; }
      const measurements = DB.getMeasurements();
      let record;
      if (existing) {
        record = measurements.find((m) => m.id === existing.id);
      } else {
        record = { id: DB.uid() };
        measurements.push(record);
      }
      record.date = dateInput.value || Utils.todayISO();
      FIELDS.forEach((f) => {
        const v = inputs[f.key].value;
        if (v === '') record[f.key] = undefined;
        else record[f.key] = f.key === 'weight' ? Units.toKg(parseFloat(v), bodyUnit) : parseFloat(v);
      });
      measurements.sort((a, b) => (a.date > b.date ? 1 : -1));
      DB.saveMeasurements(measurements);
      Utils.toast('Medidas guardadas');
      if (!existing) FIELDS.forEach((f) => { inputs[f.key].value = ''; });
      onSaved();
    });
    wrap.appendChild(saveBtn);
    return wrap;
  }

  function fieldPoints(measurements, fieldKey) {
    return measurements
      .filter((m) => m[fieldKey] !== undefined && m[fieldKey] !== null && m[fieldKey] !== '')
      .map((m) => ({ x: m.date, y: fieldKey === 'weight' ? Units.fromKg(m[fieldKey]) : m[fieldKey] }));
  }

  // ---- gráfico suave con degradado ----
  function drawChart(canvas, measurements, fieldKey, tooltipEl) {
    const points = fieldPoints(measurements, fieldKey);
    const fieldDef = ALL_FIELDS.find((f) => f.key === fieldKey);
    const unit = fieldDef.unit();
    Utils.drawLineChart(canvas, points, {
      color: Utils.accent().main,
      format: (v) => `${Utils.round1(v)}${unit}`,
      onPointClick: (p) => { tooltipEl.textContent = `${Utils.friendlyDate(p.x)} · ${Utils.round1(p.y)}${unit}`; },
    });
  }

  // ---- KPIs: valor actual, cambio total y cambio de los últimos 30 días ----
  function renderKpis(container, measurements, fieldKey) {
    container.innerHTML = '';
    const points = fieldPoints(measurements, fieldKey);
    if (points.length === 0) return;
    const fieldDef = ALL_FIELDS.find((f) => f.key === fieldKey);
    const unit = fieldDef.unit();
    const last = points[points.length - 1];
    const first = points[0];
    const cutoff = Utils.parseISO(last.x);
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffIso = Utils.toISODate(cutoff);
    let base = first;
    points.forEach((p) => { if (p.x <= cutoffIso) base = p; });

    const fmtDelta = (d) => `${d > 0 ? '▲ +' : d < 0 ? '▼ ' : ''}${Utils.round1(d)}${unit}`;
    const box = (label, value, sub) => Utils.el('div', { class: 'stat-box' }, [
      Utils.el('div', { class: 'val', style: 'font-size:1.1rem;', text: value }),
      Utils.el('div', { class: 'lbl', text: label }),
      sub ? Utils.el('div', { class: 'small text-dim', style: 'margin-top:2px;font-size:0.66rem;', text: sub }) : null,
    ]);
    container.appendChild(box('Actual', `${Utils.round1(last.y)}${unit}`, Utils.shortDate(last.x)));
    container.appendChild(box('Total', fmtDelta(Utils.round1(last.y - first.y)), `desde ${Utils.shortDate(first.x)}`));
    container.appendChild(box('30 días', fmtDelta(Utils.round1(last.y - base.y)), base === first && first.x > cutoffIso ? 'desde el inicio' : `desde ${Utils.shortDate(base.x)}`));
  }

  // ---------- registro rápido de peso (desde Hoy) ----------
  function weightPoints(list) {
    return list.filter((m) => m.weight).map((m) => ({ date: m.date, kg: Number(m.weight) }));
  }

  // días desde el último pesaje (null = nunca)
  function daysSinceWeight() {
    const pts = weightPoints(DB.getMeasurements());
    if (!pts.length) return null;
    const last = pts.reduce((a, p) => (p.date > a ? p.date : a), '0000-00-00');
    return Math.floor((Utils.parseISO(Utils.todayISO()) - Utils.parseISO(last)) / 86400000);
  }

  function openQuickWeight(onSaved) {
    const body = Utils.el('div');
    const savedUnit = DB.getSettings().bodyWeightUnit;
    let unit = savedUnit === 'lb' || savedUnit === 'kg' ? savedUnit : Units.current();
    const pts = weightPoints(DB.getMeasurements());
    const lastKg = pts.length ? pts[pts.length - 1].kg : 0;
    const inp = Utils.el('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: `Peso (${unit})`, value: lastKg ? String(Units.num(lastKg, unit)) : '' });
    const label = Utils.el('label', { text: `Peso de hoy (${unit})` });
    const btn = Utils.el('button', { class: 'unit-btn', type: 'button', text: unit });
    btn.addEventListener('click', () => {
      const next = unit === 'kg' ? 'lb' : 'kg';
      const typed = parseFloat(inp.value);
      if (!isNaN(typed)) inp.value = Math.round(Units.fromKg(Units.toKg(typed, unit), next) * 10) / 10;
      unit = next;
      const st = DB.getSettings(); st.bodyWeightUnit = next; DB.saveSettings(st);
      btn.textContent = next; label.textContent = `Peso de hoy (${next})`; inp.placeholder = `Peso (${next})`;
    });
    body.appendChild(Utils.el('p', { class: 'small', text: 'Pésate en ayunas y en la misma báscula para que la tendencia sea confiable.' }));
    body.appendChild(Utils.el('div', { class: 'field' }, [label, Utils.el('div', { class: 'input-unit' }, [inp, btn])]));
    const save = Utils.el('button', { class: 'btn-primary btn-block', text: '✓ Guardar peso' });
    save.addEventListener('click', () => {
      const v = parseFloat(inp.value);
      if (!(v > 0)) { Utils.toast('Escribe tu peso'); return; }
      const list = DB.getMeasurements();
      const today = Utils.todayISO();
      let rec = list.find((m) => m.date === today);
      if (!rec) { rec = { id: DB.uid(), date: today }; list.push(rec); }
      rec.weight = Units.toKg(v, unit);
      list.sort((a, b) => (a.date > b.date ? 1 : -1));
      DB.saveMeasurements(list);
      try { localStorage.removeItem('gt_weight_nudge'); } catch (e) { /* sin almacenamiento */ }
      Modal.close();
      Utils.toast('Peso guardado ⚖️');
      if (onSaved) onSaved();
    });
    body.appendChild(save);
    Modal.open('⚖️ Registrar peso', body);
    setTimeout(() => { try { inp.focus(); inp.select(); } catch (e) { /* sin foco */ } }, 120);
  }

  // ---------- meta de peso con proyección ----------
  // tendencia (kg/día) por mínimos cuadrados con los pesajes de las últimas 6 semanas
  function weightTrend() {
    const since = Utils.toISODate(new Date(Date.now() - 42 * 86400000));
    const pts = weightPoints(DB.getMeasurements()).filter((p) => p.date >= since)
      .map((p) => ({ t: Utils.parseISO(p.date).getTime() / 86400000, w: p.kg }));
    if (pts.length < 2) return null;
    const span = Math.max(...pts.map((p) => p.t)) - Math.min(...pts.map((p) => p.t));
    if (span < 5) return null;
    const n = pts.length;
    const mt = pts.reduce((s, p) => s + p.t, 0) / n;
    const mw = pts.reduce((s, p) => s + p.w, 0) / n;
    const den = pts.reduce((s, p) => s + (p.t - mt) ** 2, 0) || 1;
    return pts.reduce((s, p) => s + (p.t - mt) * (p.w - mw), 0) / den;
  }

  function openGoalForm(onSaved) {
    const body = Utils.el('div');
    const s = DB.getSettings();
    let unit = Units.current();
    const inp = Utils.el('input', { type: 'number', step: 'any', inputmode: 'decimal', value: s.goalWeightKg ? String(Units.num(s.goalWeightKg, unit)) : '' });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso que quieres alcanzar (${unit})` }), inp]));
    const save = Utils.el('button', { class: 'btn-primary btn-block', text: 'Guardar meta' });
    save.addEventListener('click', () => {
      const v = parseFloat(inp.value);
      if (!(v > 0)) { Utils.toast('Escribe un peso válido'); return; }
      const st = DB.getSettings();
      const pts = weightPoints(DB.getMeasurements());
      st.goalWeightKg = Units.toKg(v, unit);
      st.goalStartKg = pts.length ? pts[pts.length - 1].kg : st.goalWeightKg;
      DB.saveSettings(st);
      Modal.close();
      if (onSaved) onSaved();
    });
    body.appendChild(save);
    if (s.goalWeightKg) {
      const del = Utils.el('button', { class: 'btn-secondary btn-block', style: 'color:var(--red);', text: 'Quitar meta' });
      del.addEventListener('click', () => {
        const st = DB.getSettings(); delete st.goalWeightKg; delete st.goalStartKg; DB.saveSettings(st);
        Modal.close();
        if (onSaved) onSaved();
      });
      body.appendChild(del);
    }
    Modal.open('🎯 Meta de peso', body);
  }

  function goalCard(measurements, rerender) {
    const s = DB.getSettings();
    const card = Utils.el('div', { class: 'card' });
    const pts = weightPoints(measurements);
    if (!s.goalWeightKg) {
      card.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: '🎯 Meta de peso' })]));
      card.appendChild(Utils.el('p', { class: 'small', text: 'Ponte una meta y te muestro cuánto te falta y la fecha aproximada según tu tendencia.' }));
      const b = Utils.el('button', { class: 'btn-secondary btn-block', text: 'Definir mi meta' });
      b.addEventListener('click', () => openGoalForm(rerender));
      card.appendChild(b);
      return card;
    }
    const goal = s.goalWeightKg;
    const cur = pts.length ? pts[pts.length - 1].kg : null;
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: '🎯 Meta de peso' }),
      Utils.el('button', { class: 'link-btn small', text: 'Cambiar', onclick: () => openGoalForm(rerender) }),
    ]));
    if (cur === null) {
      card.appendChild(Utils.el('p', { class: 'small', text: `Meta: ${Units.label(goal)}. Registra tu peso para ver el avance.` }));
      return card;
    }
    const start = s.goalStartKg || cur;
    const total = goal - start;
    const done = cur - start;
    const pct = total === 0 ? 100 : Math.max(0, Math.min(100, Math.round((done / total) * 100)));
    const left = goal - cur;
    card.appendChild(Utils.el('div', { class: 'goal-row' }, [
      Utils.el('div', {}, [Utils.el('div', { class: 'eyebrow', text: 'Ahora' }), Utils.el('div', { class: 'goal-val', text: Units.label(cur) })]),
      Utils.el('div', { style: 'text-align:center;' }, [Utils.el('div', { class: 'eyebrow', text: Math.abs(left) < 0.2 ? '¡Meta lograda!' : left > 0 ? 'Te faltan' : 'Te sobran' }), Utils.el('div', { class: 'goal-val', text: Math.abs(left) < 0.2 ? '✓' : `${Utils.round1(Math.abs(Units.fromKg(left)))} ${Units.current()}` })]),
      Utils.el('div', { style: 'text-align:right;' }, [Utils.el('div', { class: 'eyebrow', text: 'Meta' }), Utils.el('div', { class: 'goal-val', text: Units.label(goal) })]),
    ]));
    card.appendChild(Utils.el('div', { class: 'macro-bar', style: 'margin-top:10px;' }, [Utils.el('div', { class: 'macro-bar-fill', style: `width:${pct}%;background:var(--accent-grad);` })]));

    const slope = weightTrend(); // kg/día
    let note;
    if (Math.abs(left) < 0.2) note = 'Estás en tu meta. Ahora toca mantenerla.';
    else if (slope === null) note = 'Con otro pesaje en unos días calculo tu tendencia y la fecha estimada.';
    else if (Math.abs(slope) < 0.005) note = `Tu peso está estable (${Utils.round1(Units.fromKg(slope * 7))} ${Units.current()}/semana).`;
    else if ((left > 0) === (slope > 0)) {
      const days = Math.round(left / slope);
      const d = new Date(Date.now() + days * 86400000);
      note = `A este ritmo (${slope > 0 ? '+' : ''}${Utils.round1(Units.fromKg(slope * 7))} ${Units.current()}/semana) llegarías hacia el ${Utils.DIAS_CORTOS[d.getDay()]} ${d.getDate()} de ${Utils.MESES[d.getMonth()]} (≈ ${days <= 14 ? `${days} días` : `${Math.round(days / 7)} semanas`}).`;
    } else note = `Tu tendencia va en dirección contraria a la meta (${slope > 0 ? '+' : ''}${Utils.round1(Units.fromKg(slope * 7))} ${Units.current()}/semana). Revisa tus calorías en la pestaña de alimentación.`;
    card.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: note }));
    return card;
  }

  return { render, daysSinceWeight, openQuickWeight };
})();
