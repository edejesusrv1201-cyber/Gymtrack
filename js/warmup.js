/* ============================================================
   warmup.js — Series de calentamiento (aproximación) automáticas.
   Pones el peso con el que vas a trabajar y te propone las series
   para llegar a él: barra sola, 50 %, 70 % y 85 %. Con barra, te dice
   qué discos poner por lado (usa tus discos de la calculadora).
   Las series se guardan como "aproximación": no cuentan para tu meta
   semanal, volumen ni récords.
   ============================================================ */

const Warmup = (() => {
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ¿el ejercicio se hace normalmente con barra olímpica?
  function usesBar(name) {
    const n = norm(name);
    if (/mancuerna|maquina|polea|smith|kettlebell|banda|unilateral/.test(n)) return false;
    return /barra|banca|sentadilla|peso muerto|press militar|hip thrust|good morning|pendlay|rumano/.test(n);
  }

  // series de calentamiento para un peso de trabajo `work` (en la unidad `unit`)
  function build(work, unit, bar, useBar) {
    if (!(work > 0)) return [];
    const step = unit === 'lb' ? 5 : 2.5;
    const rnd = (v) => Math.max(step, Math.round(v / step) * step);
    const out = [];
    const push = (w, reps, label) => {
      if (w >= work) return;                                  // siempre por debajo del peso de trabajo
      if (out.length && w <= out[out.length - 1].w) return;   // sin repetir pesos
      out.push({ w, reps, label });
    };
    if (useBar && work >= bar * 1.6) push(bar, 10, 'Solo la barra');
    [[0.5, 6, '50 %'], [0.7, 4, '70 %'], [0.85, 2, '85 %']].forEach(([p, reps, label]) => {
      const w = rnd(work * p);
      if (useBar && w < bar) return;
      push(w, reps, label);
    });
    return out;
  }

  const fmt = (n) => String(Math.round(n * 100) / 100);

  // opts: { name, workKg, onAdd(sets) } — sets: [{ weight (kg), reps }]
  function open(opts) {
    const unit = Units.current();
    const cfg = Plates.config(unit);
    let useBar = usesBar(opts.name);
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Escribe el peso con el que vas a trabajar y te propongo cómo llegar a él sin cansarte.' }));

    const workIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: `Peso de trabajo (${unit})` });
    if (opts.workKg > 0) workIn.value = String(Units.num(opts.workKg, unit));
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso de trabajo (${unit})` }), workIn]));

    const barSeg = Utils.el('div', { class: 'seg small', style: 'margin-bottom:10px;' });
    const paintBar = () => barSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', (b.dataset.k === 'bar') === useBar));
    [['bar', `Con barra (${cfg.bar} ${unit})`], ['free', 'Sin barra (mancuernas / máquina)']].forEach(([k, t]) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': k, text: t });
      b.addEventListener('click', () => { useBar = k === 'bar'; paintBar(); calc(); });
      barSeg.appendChild(b);
    });
    body.appendChild(barSeg);
    paintBar();

    const list = Utils.el('div', { class: 'wu-list' });
    body.appendChild(list);
    const addBtn = Utils.el('button', { class: 'btn-primary btn-block', type: 'button' });
    body.appendChild(addBtn);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Descansa 30–60 s entre aproximaciones. No llegues al cansancio: son para entrar en calor, no para trabajar.' }));

    let current = [];
    function calc() {
      list.innerHTML = '';
      const work = parseFloat(workIn.value);
      current = build(work, unit, cfg.bar, useBar);
      addBtn.disabled = !current.length;
      addBtn.textContent = current.length ? `➕ Agregar ${current.length} serie${current.length === 1 ? '' : 's'} de aproximación` : 'Agregar';
      if (!(work > 0)) { list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;', text: 'Escribe un peso para ver el calentamiento.' })); return; }
      if (!current.length) { list.appendChild(Utils.el('div', { class: 'nut-hint', text: 'Con un peso tan ligero no necesitas calentar con series extra: haz una primera serie suave.' })); return; }
      current.forEach((s, i) => {
        let sub = '';
        if (useBar) {
          const r = Plates.solve(s.w, cfg.bar, cfg.plates);
          if (r.list.length) sub = `por lado: ${r.list.map(([p, n]) => (n > 1 ? `${n}×${fmt(p)}` : fmt(p))).join(' + ')}${r.exact ? '' : ' (aprox.)'}`;
        }
        list.appendChild(Utils.el('div', { class: 'wu-row' }, [
          Utils.el('span', { class: 'set-badge warm', text: String(i + 1) }),
          Utils.el('div', { class: 'wu-main' }, [
            Utils.el('b', { text: `${fmt(s.w)} ${unit} × ${s.reps}` }),
            Utils.el('div', { class: 'small text-dim', text: sub ? `${s.label} · ${sub}` : s.label }),
          ]),
        ]));
      });
      list.appendChild(Utils.el('div', { class: 'wu-row wu-work' }, [
        Utils.el('span', { class: 'set-badge work', text: '💪' }),
        Utils.el('div', { class: 'wu-main' }, [Utils.el('b', { text: `Trabajo: ${fmt(work)} ${unit}` }), Utils.el('div', { class: 'small text-dim', text: 'tus series efectivas' })]),
      ]));
    }

    addBtn.addEventListener('click', () => {
      if (!current.length) return;
      const sets = current.map((s) => ({ weight: Units.toKg(s.w, unit), reps: s.reps }));
      Modal.close();
      if (opts.onAdd) opts.onAdd(sets);
    });
    workIn.addEventListener('input', calc);
    calc();
    Modal.open(`🔥 Calentamiento · ${opts.name || ''}`, body);
    setTimeout(() => { if (!(opts.workKg > 0)) workIn.focus(); }, 350);
  }

  return { open, build, usesBar };
})();
