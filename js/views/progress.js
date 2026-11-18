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
        { key: 'deporte', label: '🏃 Deporte' },
        { key: 'nutricion', label: '🍽️ Nutrición' },
        { key: 'logros', label: '🏆 Logros' },
        { key: 'ranking', label: '🌍 Ranking' },
      ],
      section,
      (k) => { section = k; render(root); },
      true,
    ));
    root.appendChild(head);
    // con varias pestañas, deja a la vista la que está activa
    try { const act = head.querySelector('.seg-btn.active'); if (act) head.querySelector('.seg').scrollLeft = Math.max(0, act.offsetLeft - 40); } catch (e) { /* sin scroll */ }

    const body = Utils.el('div');
    root.appendChild(body);
    if (section === 'cuerpo') MeasurementsView.render(body);
    else if (section === 'nutricion') StatsView.renderNutrition(body);
    else if (section === 'deporte') Activity.render(body);
    else if (section === 'logros') RewardsView.render(body);
    else if (section === 'ranking') Leaderboard.render(body);
    else StatsView.renderTraining(body);
  }

  return { render };
})();
