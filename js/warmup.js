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

  // ---------------------------------------------------------------- flujo "una aproximación a la vez"
  // Botón → te propone peso y repeticiones (editables) → Aceptar → haces la serie → Terminé → empieza el descanso.
  // El estado vive aquí (por ejercicio y día) para que sobreviva a que la pantalla se vuelva a dibujar.
  const flows = {};
  const REST_OPTS = [[30, '30 s'], [45, '45 s'], [60, '1 min']];
  const restSel = () => { const v = Number(DB.getSettings().warmRest); return REST_OPTS.some((r) => r[0] === v) ? v : 45; };
  const saveRest = (v) => { const s = DB.getSettings(); s.warmRest = v; DB.saveSettings(s); };

  // ctx: { key, name, unit, getWorkKg(), doneKgs:[kg], uni, onDone(kg, reps), rerender() }  →  nodo para poner en la tarjeta
  function flow(ctx) {
    const unit = ctx.unit;
    const cfg = Plates.config(unit);
    const st = flows[ctx.key] || (flows[ctx.key] = { phase: 'idle', bar: usesBar(ctx.name) });
    const host = Utils.el('div', { class: 'wu-flow-host' });
    const stepU = unit === 'lb' ? 5 : 2.5;

    // siguiente aproximación sugerida (según el peso de trabajo y lo que ya hiciste)
    function next() {
      const workKg = ctx.getWorkKg();
      if (!(workKg > 0)) return null;
      const plan = build(Units.fromKg(workKg, unit), unit, cfg.bar, st.bar);
      const lastW = ctx.doneKgs.length ? Math.max(...ctx.doneKgs.map((k) => Units.fromKg(k, unit))) : 0;
      const step = plan.find((s) => s.w > lastW + 0.01) || null;
      return { step, plan, workU: Units.fromKg(workKg, unit) };
    }
    const n0 = () => ctx.doneKgs.length + 1;
    const platesText = (w) => {
      if (!st.bar || !(w > 0)) return '';
      const r = Plates.solve(w, cfg.bar, cfg.plates);
      if (r.tooLight) return `Menos que la barra (${cfg.bar} ${unit})`;
      return r.list.length ? `Por lado: ${r.list.map(([p, n]) => (n > 1 ? `${n}×${fmt(p)}` : fmt(p))).join(' + ')}${r.exact ? '' : ' (aprox.)'}` : 'Solo la barra';
    };

    function idle() {
      host.innerHTML = '';
      const nx = next();
      const text = !nx ? '🔥 Aproximación (escribe tu peso de trabajo para estimarla)'
        : nx.step ? `🔥 Aproximación ${n0()} · sugerida ${fmt(nx.step.w)} ${unit} × ${nx.step.reps}`
        : '✓ Calentamiento listo · agregar otra aproximación';
      const b = Utils.el('button', { type: 'button', class: 'sugg-line warmup', text });
      b.addEventListener('click', () => {
        st.phase = 'plan';
        st.w = nx && nx.step ? nx.step.w : (ctx.doneKgs.length ? Units.fromKg(Math.max(...ctx.doneKgs), unit) : (nx ? Math.round((nx.workU * 0.5) / stepU) * stepU : ''));
        st.reps = nx && nx.step ? nx.step.reps : 5;
        st.label = nx && nx.step ? nx.step.label : '';
        paint();
      });
      host.appendChild(b);
    }

    const stepper = (get, set, step, min, dec) => {
      const input = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', class: 'wu-num', value: get() === '' ? '' : String(get()) });
      const upd = (v) => { v = Math.max(min, Math.round(v * 100) / 100); set(v); input.value = String(v); input.dispatchEvent(new Event('wu')); };
      const minus = Utils.el('button', { type: 'button', class: 'wu-step', text: '−' });
      const plus = Utils.el('button', { type: 'button', class: 'wu-step', text: '+' });
      minus.addEventListener('click', () => upd((parseFloat(input.value) || 0) - step));
      plus.addEventListener('click', () => upd((parseFloat(input.value) || 0) + step));
      input.addEventListener('input', () => { const v = parseFloat(input.value); set(isNaN(v) ? '' : v); input.dispatchEvent(new Event('wu')); });
      return { node: Utils.el('div', { class: 'wu-stepper' }, [minus, input, plus]), input };
    };

    function plan() {
      host.innerHTML = '';
      const box = Utils.el('div', { class: 'wu-flow' });
      box.appendChild(Utils.el('div', { class: 'wu-flow-head' }, [
        Utils.el('b', { class: 'wu-title', text: `🔥 Aproximación ${n0()}` }),
        Utils.el('span', { class: 'small text-dim', text: st.label ? (st.label.includes('%') ? `${st.label} de tu peso de trabajo` : st.label) : 'a tu medida' }),
      ]));
      const w = stepper(() => st.w, (v) => { st.w = v; }, stepU, 0);
      const r = stepper(() => st.reps, (v) => { st.reps = v; }, 1, 1);
      box.appendChild(Utils.el('div', { class: 'wu-grid' }, [
        Utils.el('div', {}, [Utils.el('div', { class: 'small text-dim', text: `Peso (${unit})` }), w.node]),
        Utils.el('div', {}, [Utils.el('div', { class: 'small text-dim', text: 'Repeticiones' }), r.node]),
      ]));
      const pl = Utils.el('div', { class: 'small text-dim wu-plates', text: platesText(parseFloat(st.w)) });
      w.input.addEventListener('wu', () => { pl.textContent = platesText(parseFloat(st.w)); });
      box.appendChild(pl);

      const barSeg = Utils.el('div', { class: 'seg small', style: 'margin:8px 0;' });
      const paintBar = () => barSeg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', (b.dataset.k === 'bar') === st.bar));
      [['bar', `Barra (${cfg.bar} ${unit})`], ['free', 'Sin barra']].forEach(([k, t]) => {
        const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-k': k, text: t });
        b.addEventListener('click', () => { st.bar = k === 'bar'; paintBar(); pl.textContent = platesText(parseFloat(st.w)); });
        barSeg.appendChild(b);
      });
      paintBar();
      box.appendChild(barSeg);

      box.appendChild(Utils.el('div', { class: 'small text-dim', text: 'Descanso al terminar' }));
      const chips = Utils.el('div', { class: 'rt-chips' });
      const paintChips = () => { chips.innerHTML = ''; REST_OPTS.forEach(([v, t]) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${restSel() === v ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
        c.addEventListener('click', () => { saveRest(v); paintChips(); });
        chips.appendChild(c);
      }); };
      paintChips();
      box.appendChild(chips);

      const ok = Utils.el('button', { class: 'btn-primary', type: 'button', text: '✓ Aceptar' });
      ok.addEventListener('click', () => {
        const wv = parseFloat(st.w); const rv = parseInt(st.reps, 10);
        if (!(wv > 0) || !(rv > 0)) { Utils.toast('Pon el peso y las repeticiones'); return; }
        st.phase = 'do';
        paint();
      });
      const cancel = Utils.el('button', { class: 'btn-secondary', type: 'button', text: 'Cancelar' });
      cancel.addEventListener('click', () => { st.phase = 'idle'; paint(); });
      box.appendChild(Utils.el('div', { class: 'nut-actions act-2', style: 'margin:10px 0 0;' }, [ok, cancel]));
      host.appendChild(box);
    }

    function doing() {
      host.innerHTML = '';
      const box = Utils.el('div', { class: 'wu-flow doing' });
      box.appendChild(Utils.el('div', { class: 'wu-flow-head' }, [Utils.el('b', { text: `🔥 Aproximación ${n0()}` }), Utils.el('span', { class: 'small text-dim', text: 'en curso' })]));
      box.appendChild(Utils.el('div', { class: 'wu-big', text: `${fmt(st.w)} ${unit} × ${st.reps}` }));
      const pt = platesText(parseFloat(st.w));
      if (pt) box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;', text: pt }));
      box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;margin-top:4px;', text: 'Hazla con buena técnica y sin llegar al cansancio. Cuando termines, confirma.' }));
      const done = Utils.el('button', { class: 'btn-primary', type: 'button', text: '✓ Terminé' });
      done.addEventListener('click', () => {
        const kg = Units.toKg(parseFloat(st.w), unit);
        const reps = parseInt(st.reps, 10);
        const sec = restSel();
        st.phase = 'idle';
        ctx.onDone(kg, reps);                         // guarda la serie
        RestTimer.quickStart(sec, ctx.name);          // y arranca el descanso
        ctx.doneKgs.push(kg);
        const nx = next();
        if (nx && nx.step) {                          // deja lista la siguiente aproximación
          st.phase = 'plan'; st.w = nx.step.w; st.reps = nx.step.reps; st.label = nx.step.label;
        } else { Utils.toast('Calentamiento listo 💪 ¡a trabajar!'); }
        ctx.rerender();
      });
      const back = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '← Cambiar' });
      back.addEventListener('click', () => { st.phase = 'plan'; paint(); });
      box.appendChild(Utils.el('div', { class: 'nut-actions act-2', style: 'margin:10px 0 0;' }, [done, back]));
      host.appendChild(box);
    }

    function paint() {
      if (st.phase === 'plan') plan();
      else if (st.phase === 'do') doing();
      else idle();
    }
    paint();
    host.refresh = () => { if (st.phase === 'idle') idle(); };   // por si cambias el peso de trabajo de arriba
    return host;
  }

  return { open, build, usesBar, flow };
})();
