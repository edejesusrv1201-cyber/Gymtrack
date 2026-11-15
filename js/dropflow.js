/* ============================================================
   dropflow.js — Drop set dentro de la misma serie
   Igual que el flujo de aproximaciones: botón → peso y reps sugeridos
   (editables) → Aceptar → lo haces → Terminé → puedes encadenar otro
   drop; al terminar arranca el descanso. Los drops se guardan como
   series tipo 'drop' pegadas a su serie y se muestran dentro de ella.
   ============================================================ */

const DropFlow = (() => {
  const flows = {};
  const fmt = (n) => String(Math.round(n * 100) / 100);
  const PCTS = [10, 20, 30];

  const stateOf = (key) => flows[key] || (flows[key] = { phase: 'idle', n: 0 });
  // abre el flujo ya en la fase de plan (p. ej. al registrar una serie "con drop set")
  function open(key) { const st = stateOf(key); st.phase = 'plan'; st.n = 0; st.w = undefined; st.reps = undefined; }
  const isOpen = (key) => !!flows[key] && flows[key].phase !== 'idle';

  // ctx: { key, name, unit, getLast():{kg,reps}|null, onDone(kg, reps), onFinish(), rerender() }
  function flow(ctx) {
    const unit = ctx.unit;
    const st = stateOf(ctx.key);
    const stepU = Units.step(unit, true);
    const host = Utils.el('div', { class: 'wu-flow-host df-host' });

    const base = () => {
      const l = ctx.getLast();
      return l ? { w: Units.fromKg(l.kg, unit), reps: Number(l.reps) || 8 } : null;
    };
    const pctW = (b, p) => Math.max(stepU, Math.round((b.w * (1 - p / 100)) / stepU) * stepU);
    const ensureDefaults = () => {
      const b = base();
      if (st.w === undefined || st.w === '') st.w = b ? pctW(b, 20) : '';
      if (st.reps === undefined || st.reps === '') st.reps = b ? b.reps : 8;
    };

    function idle() {
      host.innerHTML = '';
      const b = base();
      if (!b) return;
      const btn = Utils.el('button', { type: 'button', class: 'sugg-line dropset', text: `↓ ¿No pudiste más? Sigue con un drop set · sugerido ${fmt(pctW(b, 20))} ${unit}` });
      btn.addEventListener('click', () => { try { RestTimer.cancel(); } catch (e) { /* sin cronómetro */ } open(ctx.key); paint(); });
      host.appendChild(btn);
    }

    const stepper = (get, set, step, min) => {
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
      ensureDefaults();
      const b = base();
      const box = Utils.el('div', { class: 'wu-flow df-flow' });
      box.appendChild(Utils.el('div', { class: 'wu-flow-head' }, [
        Utils.el('b', { class: 'wu-title', text: `↓ Drop ${st.n + 1}` }),
        Utils.el('span', { class: 'small text-dim', text: 'baja el peso y sigue, sin descansar' }),
      ]));
      const w = stepper(() => st.w, (v) => { st.w = v; paintChips(); }, stepU, 0);
      const r = stepper(() => st.reps, (v) => { st.reps = v; }, 1, 1);
      box.appendChild(Utils.el('div', { class: 'wu-grid' }, [
        Utils.el('div', {}, [Utils.el('div', { class: 'small text-dim', text: `Peso (${unit})` }), w.node]),
        Utils.el('div', {}, [Utils.el('div', { class: 'small text-dim', text: 'Repeticiones' }), r.node]),
      ]));
      const chips = Utils.el('div', { class: 'rt-chips', style: 'margin-top:8px;' });
      function paintChips() {
        chips.innerHTML = '';
        if (!b) return;
        chips.appendChild(Utils.el('span', { class: 'small text-dim', style: 'align-self:center;', text: 'Bajar' }));
        PCTS.forEach((p) => {
          const on = Math.abs((parseFloat(st.w) || 0) - pctW(b, p)) < 0.01;
          const c = Utils.el('button', { type: 'button', class: `rt-chip plain${on ? ' active' : ''}`, style: '--gc:var(--violet)', text: `−${p}%` });
          c.addEventListener('click', () => { st.w = pctW(b, p); w.input.value = String(st.w); paintChips(); });
          chips.appendChild(c);
        });
      }
      paintChips();
      box.appendChild(chips);
      const ok = Utils.el('button', { class: 'btn-primary', type: 'button', text: '✓ Aceptar' });
      ok.addEventListener('click', () => {
        const wv = parseFloat(st.w); const rv = parseInt(st.reps, 10);
        if (!(wv >= 0) || st.w === '' || !(rv > 0)) { Utils.toast('Pon el peso y las repeticiones'); return; }
        st.phase = 'do';
        paint();
      });
      const second = st.n > 0
        ? Utils.el('button', { class: 'btn-secondary', type: 'button', text: '✓ Listo, descansar' })
        : Utils.el('button', { class: 'btn-secondary', type: 'button', text: 'Cancelar' });
      second.addEventListener('click', () => finish());
      box.appendChild(Utils.el('div', { class: 'nut-actions act-2', style: 'margin:10px 0 0;' }, [ok, second]));
      host.appendChild(box);
    }

    function doing() {
      host.innerHTML = '';
      const box = Utils.el('div', { class: 'wu-flow df-flow doing' });
      box.appendChild(Utils.el('div', { class: 'wu-flow-head' }, [Utils.el('b', { text: `↓ Drop ${st.n + 1}` }), Utils.el('span', { class: 'small text-dim', text: 'en curso' })]));
      box.appendChild(Utils.el('div', { class: 'wu-big', text: `${fmt(st.w)} ${unit} × ${st.reps}` }));
      box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;margin-top:4px;', text: 'Quita peso rápido y sigue hasta el límite. Cuando termines, confirma.' }));
      const done = Utils.el('button', { class: 'btn-primary', type: 'button', text: '✓ Terminé' });
      done.addEventListener('click', () => {
        const kg = Units.toKg(parseFloat(st.w), unit);
        const reps = parseInt(st.reps, 10);
        ctx.onDone(kg, reps);
        st.n += 1; st.w = undefined; st.reps = undefined; st.phase = 'plan';
        ctx.rerender();
      });
      const back = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '← Cambiar' });
      back.addEventListener('click', () => { st.phase = 'plan'; paint(); });
      box.appendChild(Utils.el('div', { class: 'nut-actions act-2', style: 'margin:10px 0 0;' }, [done, back]));
      host.appendChild(box);
    }

    function finish() {
      const had = st.n > 0;
      st.phase = 'idle'; st.n = 0; st.w = undefined; st.reps = undefined;
      if (had && ctx.onFinish) ctx.onFinish();
      ctx.rerender();
    }

    function paint() {
      if (st.phase === 'plan') plan();
      else if (st.phase === 'do') doing();
      else idle();
    }
    paint();
    return host;
  }

  return { flow, open, isOpen };
})();
