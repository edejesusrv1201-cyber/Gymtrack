/* ============================================================
   views/progress.js — Pestaña "Progreso": Entreno, Cuerpo y Nutrición
   ============================================================ */

const ProgressView = (() => {
  let section = 'entreno';

  function render(root, params) {
    if (params && params.section) section = params.section;
    root.innerHTML = '';

    const head = Utils.el('div', { class: 'view', style: 'padding-bottom:0;' });
    head.appendChild(Utils.segmented(
      [
        { key: 'entreno', label: '🏋️ Entreno' },
        { key: 'cuerpo', label: '📏 Cuerpo' },
        { key: 'nutricion', label: '🍽️ Nutrición' },
      ],
      section,
      (k) => { section = k; render(root); },
    ));
    root.appendChild(head);

    const body = Utils.el('div');
    root.appendChild(body);
    if (section === 'cuerpo') MeasurementsView.render(body);
    else if (section === 'nutricion') StatsView.renderNutrition(body);
    else StatsView.renderTraining(body);
  }

  return { render };
})();
