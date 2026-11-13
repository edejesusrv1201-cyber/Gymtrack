/* ============================================================
   prcalc.js — "Sacar PR": estimar con qué peso intentar un récord.
   Parte de una serie que te salió bien (peso × repeticiones, y si
   quieres cómo de cerca del fallo) y estima tu 1RM con la fórmula
   de Epley. Con eso te dice qué peso deberías poder mover para las
   repeticiones que elijas y cuál es el mínimo que rompería tu récord.
   Es una estimación (±5 %), más fiable entre 1 y 8 repeticiones.
   ============================================================ */

const PRCalc = (() => {
  const fmt = (n) => String(Math.round(n * 100) / 100);

  // 1RM estimado. Si sabes tu RPE, las repeticiones que te "sobraron" (10 − RPE) cuentan como hechas.
  function e1rmOf(kg, reps, rpe) {
    const spare = rpe ? Math.max(0, 10 - rpe) : 0;
    return Metrics.e1rm(kg, reps + spare);
  }
  // peso que se puede mover para `reps` repeticiones dado un 1RM
  const weightFor = (e1, reps) => (reps <= 1 ? e1 : e1 / (1 + reps / 30));

  // opts: { ex, exerciseId, unit, ref:{kg,reps,rpe}|null, onUse(kg, reps) }
  function open(opts) {
    const unit = opts.unit;
    const rpeOn = [6, 7, 8, 9, 10];
    const state = {
      w: opts.ref && opts.ref.kg > 0 ? Units.num(opts.ref.kg, unit) : '',
      reps: opts.ref && opts.ref.reps > 0 ? opts.ref.reps : '',
      rpe: opts.ref && opts.ref.rpe ? opts.ref.rpe : 0,
      target: 0,
    };
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Dime una serie que te salió bien (con cuántas repeticiones y qué tan cerca del fallo) y te estimo el peso para intentar tu récord.' }));

    const wIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(state.w), placeholder: `Peso (${unit})` });
    const rIn = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(state.reps), placeholder: 'Reps' });
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso de esa serie (${unit})` }), wIn]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Repeticiones' }), rIn]),
    ]));

    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:2px 0 6px;', text: '¿Qué tan cerca del fallo? (RPE, opcional)' }));
    const rpeRow = Utils.el('div', { class: 'rt-chips' });
    const paintRpe = () => {
      rpeRow.innerHTML = '';
      [[0, 'No sé']].concat(rpeOn.map((v) => [v, String(v)])).forEach(([v, t]) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${state.rpe === v ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
        c.addEventListener('click', () => { state.rpe = v; paintRpe(); calc(); });
        rpeRow.appendChild(c);
      });
    };
    paintRpe();
    body.appendChild(rpeRow);
    body.appendChild(Utils.el('div', { class: 'small text-dim', text: '10 = fallo total · 9 = 1 rep de sobra · 8 = 2 reps de sobra' }));

    const result = Utils.el('div', { class: 'prc-result' });
    body.appendChild(result);

    function stepFor(kgVal) { return unit === 'lb' ? (Units.fromKg(kgVal, 'lb') < 50 ? 2.5 : 5) : (kgVal < 30 ? 1 : 2.5); }
    const roundTo = (val, st) => Math.round(val / st) * st;   // en la unidad del usuario

    function isPR(kg, reps) {
      return Metrics.detectPR(opts.exerciseId, false, { weight: kg, reps }).length > 0;
    }
    // el peso mínimo (en pasos de la unidad) que ya cuenta como récord con esas repeticiones
    function minPrWeight(estU, reps, st) {
      for (let i = -4; i <= 10; i += 1) {
        const w = roundTo(estU, st) + i * st;
        if (w > 0 && isPR(Units.toKg(w, unit), reps)) return w;
      }
      return null;
    }

    function calc() {
      result.innerHTML = '';
      const wU = parseFloat(wIn.value); const reps = parseInt(rIn.value, 10);
      if (!(wU > 0) || !(reps > 0)) { result.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;margin-top:12px;', text: 'Escribe el peso y las repeticiones de esa serie.' })); return; }
      const kg = Units.toKg(wU, unit);
      const e1 = e1rmOf(kg, reps, state.rpe);
      const e1U = Units.fromKg(e1, unit);
      const rec = Metrics.exerciseRecords(opts.exerciseId, false);
      const best = rec ? Number(rec.e1rm) || 0 : 0;
      if (!state.target) state.target = Math.min(12, Math.max(1, reps));
      const tgt = state.target;
      const st = stepFor(kg);

      const box = Utils.el('div', { class: 'prc-box' });
      box.appendChild(Utils.el('div', { class: 'prc-e1' }, [
        Utils.el('div', { class: 'small text-dim', text: 'Tu 1RM estimado hoy' }),
        Utils.el('div', { class: 'prc-big', text: `${fmt(Math.round(e1U * 10) / 10)} ${unit}` }),
        best > 0 ? Utils.el('div', { class: 'small', style: `color:${e1 > best * 1.005 ? 'var(--green)' : 'var(--text-dim)'}`, text: e1 > best * 1.005 ? `▲ ${fmt(Math.round(Units.fromKg(e1 - best, unit) * 10) / 10)} ${unit} sobre tu mejor marca (${fmt(Math.round(Units.fromKg(best, unit) * 10) / 10)} ${unit})` : `Tu mejor 1RM estimado: ${fmt(Math.round(Units.fromKg(best, unit) * 10) / 10)} ${unit}` }) : null,
      ]));

      box.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:12px 0 6px;', text: '¿Con cuántas repeticiones quieres el PR?' }));
      const chips = Utils.el('div', { class: 'rt-chips' });
      [1, 2, 3, 4, 5, 6, 8, 10, 12].forEach((n) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${tgt === n ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: `${n}` });
        c.addEventListener('click', () => { state.target = n; calc(); });
        chips.appendChild(c);
      });
      box.appendChild(chips);

      const estU = Units.fromKg(weightFor(e1, tgt), unit);
      const estR = roundTo(estU, st);
      const need = minPrWeight(estU, tgt, st);
      const sug = Utils.el('div', { class: 'prc-sug' });
      sug.appendChild(Utils.el('div', { class: 'small text-dim', text: `Peso estimado para ${tgt} rep${tgt === 1 ? '' : 's'}` }));
      sug.appendChild(Utils.el('div', { class: 'prc-big', text: `${fmt(estR)} ${unit} × ${tgt}` }));
      let verdict; let useW = estR;
      if (need === null) verdict = 'Con ese peso no llegas a romper tu récord con esas repeticiones; prueba con menos repeticiones.';
      else if (need <= estR) verdict = `🏆 Con ${fmt(estR)} ${unit} × ${tgt} ya rompes tu récord. ¡Ve por él!`;
      else { verdict = `Tu estimado queda por debajo del récord. Para que cuente como PR necesitas al menos ${fmt(need)} ${unit} × ${tgt} (+${fmt(Math.round((need - estR) * 10) / 10)} ${unit}): sería un intento exigente.`; useW = need; }
      sug.appendChild(Utils.el('div', { class: `prc-verdict${need !== null && need <= estR ? ' good' : ''}`, text: verdict }));
      box.appendChild(sug);

      if (opts.onUse) {
        const use = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: `🎯 Usar ${fmt(useW)} ${unit} × ${tgt} en mi serie` });
        use.addEventListener('click', () => { Modal.close(); opts.onUse(Units.toKg(useW, unit), tgt); });
        box.appendChild(use);
      }

      // tabla de repeticiones
      box.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:14px 0 6px;', text: 'Tabla estimada' }));
      const grid = Utils.el('div', { class: 'prc-table' });
      [1, 2, 3, 4, 5, 6, 8, 10, 12].forEach((n) => {
        const wU2 = roundTo(Units.fromKg(weightFor(e1, n), unit), st);
        const pr = isPR(Units.toKg(wU2, unit), n);
        grid.appendChild(Utils.el('div', { class: `prc-cell${pr ? ' pr' : ''}${n === tgt ? ' sel' : ''}` }, [
          Utils.el('div', { class: 'prc-r', text: `${n} rep${n === 1 ? '' : 's'}` }),
          Utils.el('div', { class: 'prc-w', text: `${fmt(wU2)}` }),
          pr ? Utils.el('div', { class: 'prc-tag', text: '🏆' }) : null,
        ]));
      });
      box.appendChild(grid);
      box.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: '🏆 = ese peso y repeticiones romperían tu récord actual. Es una estimación: calienta bien, usa seguros o ayuda en los intentos pesados y no sacrifiques la técnica.' }));
      result.appendChild(box);
    }

    wIn.addEventListener('input', () => { state.target = 0; calc(); });
    rIn.addEventListener('input', () => { state.target = 0; calc(); });
    calc();
    Modal.open(`🎯 Sacar PR${opts.ex ? ` · ${opts.ex.name}` : ''}`, body);
  }

  return { open, e1rmOf, weightFor };
})();
