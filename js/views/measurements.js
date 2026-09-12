/* ============================================================
   views/measurements.js — Medidas corporales + progreso
   ============================================================ */

const MeasurementsView = (() => {
  const FIELDS = [
    { key: 'weight', label: 'Peso', unit: () => DB.getSettings().units, required: true },
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

    // ---- formulario rápido ----
    const addCard = Utils.el('div', { class: 'card' });
    addCard.appendChild(Utils.el('h3', { text: 'Registrar medidas de hoy' }));
    addCard.appendChild(buildForm(null, () => render(root)));
    view.appendChild(addCard);

    const measurements = DB.getMeasurements();

    // ---- gráfico de progreso ----
    if (measurements.length >= 2) {
      const chartCard = Utils.el('div', { class: 'card' });
      chartCard.appendChild(Utils.el('div', { class: 'flex-between' }, [
        Utils.el('h3', { class: 'mb-0', text: 'Progreso' }),
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

      const trend = Utils.el('div', { class: 'small mt-8' });
      chartCard.appendChild(trend);

      const chartWrap = Utils.el('div', { class: 'chart-wrap mt-8' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      chartWrap.appendChild(canvas);
      chartCard.appendChild(chartWrap);
      const tooltip = Utils.el('div', { class: 'small text-dim mt-8', id: 'chartTooltip', text: 'Toca un punto para ver el valor' });
      chartCard.appendChild(tooltip);
      view.appendChild(chartCard);
      renderTrend(trend, measurements, chartField);
      requestAnimationFrame(() => drawChart(canvas, measurements, chartField, tooltip));
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
          .map((f) => `${f.label} ${m[f.key]}${typeof f.unit === 'function' ? f.unit() : ''}`).join(' · ');
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

    const inputs = {};
    FIELDS.forEach((f) => {
      const inp = Utils.el('input', { type: 'number', step: '0.1', placeholder: f.required ? `Peso (${DB.getSettings().units})` : `${f.label} (cm)` });
      if (existing && existing[f.key] !== undefined) inp.value = existing[f.key];
      inputs[f.key] = inp;
    });

    wrap.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso (${DB.getSettings().units}) *` }), inputs.weight]));
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
        record[f.key] = v === '' ? undefined : parseFloat(v);
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

  // ---- gráfico simple en canvas (una sola serie: magnitud en el tiempo) ----
  function drawChart(canvas, measurements, fieldKey, tooltipEl) {
    const points = measurements
      .filter((m) => m[fieldKey] !== undefined && m[fieldKey] !== null && m[fieldKey] !== '')
      .map((m) => ({ x: m.date, y: m[fieldKey] }));
    const fieldDef = ALL_FIELDS.find((f) => f.key === fieldKey);
    Utils.drawLineChart(canvas, points, {
      color: '#ff6a3d',
      onPointClick: (p) => { tooltipEl.textContent = `${Utils.friendlyDate(p.x)}: ${p.y}${fieldDef.unit()}`; },
    });
  }

  // ---- indicador de tendencia: ¿subió o bajó desde el primer registro? ----
  function renderTrend(container, measurements, fieldKey) {
    container.innerHTML = '';
    const points = measurements
      .filter((m) => m[fieldKey] !== undefined && m[fieldKey] !== null && m[fieldKey] !== '')
      .map((m) => ({ x: m.date, y: m[fieldKey] }));
    if (points.length < 2) return;
    const fieldDef = ALL_FIELDS.find((f) => f.key === fieldKey);
    const first = points[0].y;
    const last = points[points.length - 1].y;
    const delta = Utils.round1(last - first);
    const unit = fieldDef.unit();
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '▬';
    container.appendChild(Utils.el('span', {
      style: 'color:var(--accent-2);font-weight:700;',
      text: `${arrow} ${delta > 0 ? '+' : ''}${delta}${unit}`,
    }));
    container.appendChild(Utils.el('span', { class: 'text-dim', text: ` desde el ${Utils.friendlyDate(points[0].x)}` }));
  }

  return { render };
})();
