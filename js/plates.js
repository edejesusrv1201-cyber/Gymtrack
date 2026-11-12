/* ============================================================
   plates.js — Calculadora de discos
   Le dices el peso total que quieres levantar y te dice qué discos
   poner por lado (según tu barra y los discos que tengas).
   Funciona en kg o lb (la unidad que uses para ver los pesos).
   ============================================================ */

const Plates = (() => {
  const SETS = {
    kg: { bar: [20, 15, 10], plates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5], defBar: 20 },
    lb: { bar: [45, 35, 25], plates: [45, 35, 25, 10, 5, 2.5, 1.25], defBar: 45 },
  };
  // color de cada disco (por tamaño, como en los discos de competencia)
  const COLORS = { 25: '#e8403a', 20: '#2f6fe0', 15: '#f2c230', 10: '#2fb36b', 5: '#e9ecf3', 2.5: '#262b36', 1.25: '#b8bfce', 0.5: '#8d95a8', 45: '#2f6fe0', 35: '#f2c230' };
  const colorOf = (p, unit) => (unit === 'lb' && p === 25 ? '#2fb36b' : unit === 'lb' && p === 10 ? '#e9ecf3' : COLORS[p] || '#8d95a8');

  const cfg = (unit) => {
    const s = DB.getSettings();
    const d = SETS[unit];
    const bar = (s.plateBar && Number(s.plateBar[unit])) || d.defBar;
    const off = (s.platesOff && s.platesOff[unit]) || [];
    return { bar, off, plates: d.plates.filter((p) => !off.includes(p)) };
  };
  function saveCfg(unit, bar, off) {
    const s = DB.getSettings();
    s.plateBar = Object.assign({}, s.plateBar, { [unit]: bar });
    s.platesOff = Object.assign({}, s.platesOff, { [unit]: off });
    DB.saveSettings(s);
  }

  // discos por lado para llegar a `total`; si no se puede exacto, el más cercano que se pueda armar
  function solve(total, bar, plates) {
    const per = (total - bar) / 2;
    if (per < 0) return { tooLight: true, per: 0, list: [], made: bar, exact: false };
    const list = [];
    let rest = Math.round(per * 1000) / 1000;
    plates.slice().sort((a, b) => b - a).forEach((p) => {
      const n = Math.floor(rest / p + 1e-9);
      if (n > 0) { list.push([p, n]); rest = Math.round((rest - n * p) * 1000) / 1000; }
    });
    const used = list.reduce((s, [p, n]) => s + p * n, 0);
    return { list, per, made: Math.round((bar + used * 2) * 100) / 100, exact: rest < 0.001, rest };
  }

  function barSvg(list, unit) {
    const flat = [];
    list.forEach(([p, n]) => { for (let i = 0; i < n; i += 1) flat.push(p); });
    const maxP = Math.max(...flat, 1);
    const hOf = (p) => 34 + 76 * Math.sqrt(p / (unit === 'lb' ? 45 : 25));
    let x = 40; let parts = '';
    flat.forEach((p) => {
      const h = Math.min(116, hOf(p)); const w = p >= 10 ? 15 : p >= 2.5 ? 11 : 8;
      parts += `<rect x="${x}" y="${60 - h / 2}" width="${w}" height="${h}" rx="3" fill="${colorOf(p, unit)}" stroke="rgba(0,0,0,.45)" stroke-width="1"/>`;
      x += w + 2;
    });
    const end = Math.max(x + 14, 150);
    return `<svg viewBox="0 0 ${end + 10} 120" class="plate-svg" role="img" aria-label="Discos por lado"><rect x="0" y="56" width="${end + 10}" height="8" rx="3" fill="#8d95a8"/><rect x="26" y="40" width="10" height="40" rx="2" fill="#aab2c6"/>${parts}</svg>`;
  }

  function open(prefillKg) {
    const unit = Units.current();
    const c = cfg(unit);
    let bar = c.bar;
    let off = c.off.slice();
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: `Escribe el peso total (barra + discos) y te digo qué discos poner en cada lado. Unidad: ${unit}.` }));

    const totalIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: `Peso total (${unit})` });
    if (prefillKg) totalIn.value = String(Units.num(prefillKg, unit));
    const barSel = Utils.el('select', {});
    SETS[unit].bar.forEach((b) => barSel.appendChild(Utils.el('option', { value: String(b), text: `${b} ${unit}` })));
    if (!SETS[unit].bar.includes(bar)) barSel.appendChild(Utils.el('option', { value: String(bar), text: `${bar} ${unit}` }));
    barSel.value = String(bar);
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso total (${unit})` }), totalIn]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Barra' }), barSel]),
    ]));

    const chips = Utils.el('div', { class: 'rt-chips plate-chips' });
    const result = Utils.el('div', { class: 'plate-result' });
    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 6px;', text: 'Discos que tienes (toca para quitar o poner)' }));
    body.appendChild(chips);
    body.appendChild(result);

    function paintChips() {
      chips.innerHTML = '';
      SETS[unit].plates.forEach((p) => {
        const on = !off.includes(p);
        const b = Utils.el('button', { type: 'button', class: `plate-chip${on ? ' on' : ''}` }, [
          Utils.el('i', { style: `background:${colorOf(p, unit)}` }), `${p}`,
        ]);
        b.addEventListener('click', () => {
          off = on ? off.concat([p]) : off.filter((x) => x !== p);
          saveCfg(unit, bar, off);
          paintChips(); calc();
        });
        chips.appendChild(b);
      });
    }

    function calc() {
      result.innerHTML = '';
      const total = parseFloat(totalIn.value);
      if (isNaN(total) || total <= 0) { result.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;margin-top:12px;', text: 'Escribe un peso para ver los discos.' })); return; }
      const plates = SETS[unit].plates.filter((p) => !off.includes(p));
      const r = solve(total, bar, plates);
      if (r.tooLight) { result.appendChild(Utils.el('div', { class: 'nut-hint', text: `El peso es menor que la barra (${bar} ${unit}). Usa una barra más ligera o mancuernas.` })); return; }
      if (!r.list.length) { result.appendChild(Utils.el('div', { class: 'nut-hint', text: `Solo la barra: ${bar} ${unit}.` })); return; }
      const box = Utils.el('div', { class: 'plate-box' });
      const svg = Utils.el('div', { class: 'plate-svg-wrap' });
      svg.innerHTML = barSvg(r.list, unit);
      box.appendChild(svg);
      box.appendChild(Utils.el('div', { class: 'plate-cap', text: 'Por cada lado' }));
      const rows = Utils.el('div', { class: 'plate-rows' });
      r.list.forEach(([p, n]) => rows.appendChild(Utils.el('div', { class: 'plate-row' }, [
        Utils.el('i', { style: `background:${colorOf(p, unit)}` }),
        Utils.el('b', { text: `${n} × ${p} ${unit}` }),
      ])));
      box.appendChild(rows);
      box.appendChild(Utils.el('div', { class: `plate-total${r.exact ? '' : ' warn'}`, text: r.exact
        ? `Total: ${r.made} ${unit} (barra ${bar} + 2 × ${Math.round(r.list.reduce((s, [p, n]) => s + p * n, 0) * 100) / 100})`
        : `Con tus discos llegas a ${r.made} ${unit} (faltan ${Math.round((total - r.made) * 100) / 100} ${unit}). Agrega discos más chicos o redondea el peso.` }));
      result.appendChild(box);
    }

    barSel.addEventListener('change', () => { bar = Number(barSel.value); saveCfg(unit, bar, off); calc(); });
    totalIn.addEventListener('input', calc);
    paintChips();
    calc();
    Modal.open('🧮 Calculadora de discos', body);
    setTimeout(() => { if (!prefillKg) totalIn.focus(); }, 350);
  }

  return { open, solve };
})();
