/* ============================================================
   plates.js — Calculadora de discos (barras y mancuernas)
   Dos modos:
   · Calcular: le dices el peso total y te dice qué discos poner por lado.
   · Armar: tocas los discos que vas a poner y te dice cuánto pesa todo.
   Sirve para la barra olímpica y para mancuernas ajustables.
   Funciona en kg o lb (la unidad que uses para ver los pesos).
   ============================================================ */

const Plates = (() => {
  // barra olímpica
  const SETS = {
    kg: { bar: [20, 15, 10], plates: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5], defBar: 20 },
    lb: { bar: [45, 35, 25], plates: [45, 35, 25, 10, 5, 2.5, 1.25], defBar: 45 },
  };
  // mancuerna ajustable (la "barra" es el mango con sus topes)
  const DB_SETS = {
    kg: { bar: [2.5, 3, 5, 7.5, 10], plates: [10, 5, 2.5, 1.25, 0.5], defBar: 5 },
    lb: { bar: [5, 7, 10, 15, 20], plates: [25, 10, 5, 2.5, 1.25], defBar: 10 },
  };
  const setOf = (unit, type) => (type === 'db' ? DB_SETS[unit] : SETS[unit]);
  const keyOf = (unit, type) => (type === 'db' ? `${unit}db` : unit);

  // color de cada disco (por tamaño, como en los discos de competencia)
  const COLORS = { 25: '#e8403a', 20: '#2f6fe0', 15: '#f2c230', 10: '#2fb36b', 5: '#e9ecf3', 2.5: '#262b36', 1.25: '#b8bfce', 0.5: '#8d95a8', 45: '#2f6fe0', 35: '#f2c230' };
  const colorOf = (p, unit) => (unit === 'lb' && p === 25 ? '#2fb36b' : unit === 'lb' && p === 10 ? '#e9ecf3' : COLORS[p] || '#8d95a8');

  function cfg(unit, type) {
    const s = DB.getSettings();
    const d = setOf(unit, type);
    const k = keyOf(unit, type);
    const bar = (s.plateBar && Number(s.plateBar[k])) || d.defBar;
    const off = (s.platesOff && s.platesOff[k]) || [];
    return { bar, off, plates: d.plates.filter((p) => !off.includes(p)) };
  }
  function saveCfg(unit, type, bar, off) {
    const s = DB.getSettings();
    const k = keyOf(unit, type);
    s.plateBar = Object.assign({}, s.plateBar, { [k]: bar });
    s.platesOff = Object.assign({}, s.platesOff, { [k]: off });
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

  // Dibujo a escala (1 unidad = 1 mm): barra olímpica de 2.2 m con discos de ~45 cm, o mancuerna ajustable.
  // El grosor de los discos va un poco exagerado para que se vean, pero el largo y el diámetro son reales.
  const BAR_D_KG = { 25: 450, 20: 450, 15: 450, 10: 450, 5: 230, 2.5: 185, 1.25: 150, 0.5: 115 };
  const BAR_D_LB = { 45: 450, 35: 410, 25: 340, 10: 260, 5: 210, 2.5: 165, 1.25: 135 };
  const BAR_T = [42, 36, 31, 26, 20, 16, 12, 9];          // grosor según lo grande que es el disco (del más pesado al más ligero)
  const DB_D = [210, 172, 138, 108, 86];
  const DB_T = [40, 33, 27, 21, 16];

  function barSvg(list, unit, type) {
    const isDb = type === 'db';
    const all = setOf(unit, type).plates.slice().sort((x, y) => y - x);
    const flat = [];
    list.forEach(([p, n]) => { for (let i = 0; i < n; i += 1) flat.push(p); });
    flat.sort((x, y) => y - x);                             // el más grande pegado al tope, los chicos por fuera
    const dOf = (p) => (isDb ? DB_D[Math.min(DB_D.length - 1, all.indexOf(p))] : (unit === 'lb' ? BAR_D_LB : BAR_D_KG)[p] || 150);
    const tOf = (p) => (isDb ? DB_T : BAR_T)[Math.min((isDb ? DB_T : BAR_T).length - 1, Math.max(0, all.indexOf(p)))];
    const W = isDb ? 700 : 2200;
    const H = isDb ? 250 : 480;
    const cy = H / 2;
    const inner = isDb ? 250 : 440;                         // dónde empieza el tope de discos (por lado)
    const room = inner - (isDb ? 22 : 40);                  // espacio disponible hacia afuera
    const gap = isDb ? 2 : 3;
    const raw = flat.reduce((a, p) => a + tOf(p) + gap, 0);
    const k = raw > room - 30 ? (room - 30) / raw : 1;       // si hay muchísimos discos, se aprietan
    let defs = '<defs>'
      + '<linearGradient id="gtPlate" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".3" stop-color="#fff" stop-opacity="0"/><stop offset=".72" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".4"/></linearGradient>'
      + '<linearGradient id="gtSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e3e7f0"/><stop offset=".45" stop-color="#a3abbd"/><stop offset="1" stop-color="#5f677a"/></linearGradient>'
      + '</defs>';
    let steel = ''; let plates = '';
    const shaftH = isDb ? 30 : 30;
    const sleeveH = isDb ? 30 : 50;
    if (isDb) {
      // mango + topes
      steel += `<rect x="${inner}" y="${cy - shaftH / 2}" width="${W - 2 * inner}" height="${shaftH}" rx="8" fill="url(#gtSteel)"/>`;
      for (let i = 0; i < 6; i += 1) steel += `<rect x="${inner + 40 + i * 20}" y="${cy - shaftH / 2 + 3}" width="3" height="${shaftH - 6}" fill="#000" opacity=".22"/>`;
      steel += `<rect x="${inner - 26}" y="${cy - 62}" width="26" height="124" rx="8" fill="url(#gtSteel)" stroke="rgba(0,0,0,.4)"/>`;
      steel += `<rect x="${W - inner}" y="${cy - 62}" width="26" height="124" rx="8" fill="url(#gtSteel)" stroke="rgba(0,0,0,.4)"/>`;
      steel += `<rect x="${inner - 70}" y="${cy - 12}" width="46" height="24" rx="6" fill="url(#gtSteel)"/><rect x="${W - inner + 24}" y="${cy - 12}" width="46" height="24" rx="6" fill="url(#gtSteel)"/>`;
    } else {
      // barra completa: manga izquierda, eje central con marcas de agarre, manga derecha
      steel += `<rect x="0" y="${cy - sleeveH / 2}" width="${W}" height="${sleeveH}" rx="6" fill="url(#gtSteel)" stroke="rgba(0,0,0,.35)"/>`;
      steel += `<rect x="${inner + 30}" y="${cy - shaftH / 2}" width="${W - 2 * inner - 60}" height="${shaftH}" fill="url(#gtSteel)"/>`;
      [695, 1505].forEach((x) => { steel += `<rect x="${x}" y="${cy - shaftH / 2}" width="7" height="${shaftH}" fill="#000" opacity=".35"/>`; });
      steel += `<rect x="${W / 2 - 150}" y="${cy - shaftH / 2 + 3}" width="300" height="${shaftH - 6}" fill="#000" opacity=".16"/>`;
      // topes fijos junto al eje
      steel += `<rect x="${inner}" y="${cy - 38}" width="24" height="76" rx="4" fill="url(#gtSteel)" stroke="rgba(0,0,0,.4)"/>`;
      steel += `<rect x="${W - inner - 24}" y="${cy - 38}" width="24" height="76" rx="4" fill="url(#gtSteel)" stroke="rgba(0,0,0,.4)"/>`;
    }
    const startL = isDb ? inner - 26 : inner;               // las mancuernas apoyan en el tope exterior
    let xl = startL - 2; let xr = W - startL + 2;
    flat.forEach((p) => {
      const h = dOf(p); const t = Math.max(5, Math.round(tOf(p) * k));
      const col = colorOf(p, unit);
      plates += `<rect x="${xl - t}" y="${cy - h / 2}" width="${t}" height="${h}" rx="${isDb ? 6 : 8}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="2"/>`
        + `<rect x="${xl - t}" y="${cy - h / 2}" width="${t}" height="${h}" rx="${isDb ? 6 : 8}" fill="url(#gtPlate)"/>`;
      plates += `<rect x="${xr}" y="${cy - h / 2}" width="${t}" height="${h}" rx="${isDb ? 6 : 8}" fill="${col}" stroke="rgba(0,0,0,.5)" stroke-width="2"/>`
        + `<rect x="${xr}" y="${cy - h / 2}" width="${t}" height="${h}" rx="${isDb ? 6 : 8}" fill="url(#gtPlate)"/>`;
      xl -= t + Math.max(1, Math.round(gap * k)); xr += t + Math.max(1, Math.round(gap * k));
    });
    // seguro (collar) al final de cada lado
    if (flat.length && !isDb) {
      plates += `<rect x="${xl - 24}" y="${cy - 34}" width="24" height="68" rx="5" fill="#2a2f3b" stroke="rgba(255,255,255,.25)" stroke-width="2"/>`;
      plates += `<rect x="${xr}" y="${cy - 34}" width="24" height="68" rx="5" fill="#2a2f3b" stroke="rgba(255,255,255,.25)" stroke-width="2"/>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" class="plate-svg${isDb ? ' db' : ''}" role="img" aria-label="${isDb ? 'Mancuerna con sus discos' : 'Barra con sus discos'}">${defs}${steel}${plates}</svg>`;
  }

  const fmt = (n) => String(Math.round(n * 100) / 100);

  // prefillKg: peso total con el que abrir · opts: { onUse(kg) } para devolver el peso a tu serie
  function open(prefillKg, opts = {}) {
    const unit = Units.current();
    const s0 = DB.getSettings();
    let type = s0.plateType === 'db' ? 'db' : 'bar';
    let mode = 'calc';
    let c = cfg(unit, type);
    let bar = c.bar;
    let off = c.off.slice();
    const counts = {};     // modo "armar": discos por lado
    const body = Utils.el('div');

    const typeSeg = Utils.el('div', { class: 'seg small', style: 'margin-bottom:8px;' });
    const modeSeg = Utils.el('div', { class: 'seg small', style: 'margin-bottom:10px;' });
    const content = Utils.el('div');
    body.appendChild(typeSeg);
    body.appendChild(modeSeg);
    body.appendChild(content);

    const paintSegs = () => {
      typeSeg.innerHTML = ''; modeSeg.innerHTML = '';
      [['bar', '🏋️ Barra olímpica'], ['db', '💪 Mancuerna ajustable']].forEach(([k, t]) => {
        const b = Utils.el('button', { class: `seg-btn${k === type ? ' active' : ''}`, type: 'button', text: t });
        b.addEventListener('click', () => {
          type = k;
          const st = DB.getSettings(); st.plateType = k; DB.saveSettings(st);
          c = cfg(unit, type); bar = c.bar; off = c.off.slice();
          Object.keys(counts).forEach((x) => delete counts[x]);
          paintSegs(); paintContent();
        });
        typeSeg.appendChild(b);
      });
      [['calc', 'Calcular discos'], ['build', 'Armar mi peso']].forEach(([k, t]) => {
        const b = Utils.el('button', { class: `seg-btn${k === mode ? ' active' : ''}`, type: 'button', text: t });
        b.addEventListener('click', () => { mode = k; paintSegs(); paintContent(); });
        modeSeg.appendChild(b);
      });
    };

    const barSelect = () => {
      const sel = Utils.el('select', {});
      const list = setOf(unit, type).bar.slice();
      if (!list.includes(bar)) list.push(bar);
      list.forEach((b) => sel.appendChild(Utils.el('option', { value: String(b), text: `${fmt(b)} ${unit}` })));
      sel.value = String(bar);
      return sel;
    };
    const barLabel = () => (type === 'db' ? 'Mango (con topes)' : 'Barra');
    const sideLabel = () => (type === 'db' ? 'Por cada lado de la mancuerna' : 'Por cada lado');
    const platesHtml = (list) => barSvg(list, unit, type);

    // ------------------------------------------------ modo: calcular
    function paintCalc() {
      content.innerHTML = '';
      content.appendChild(Utils.el('p', { class: 'small', text: type === 'db'
        ? `Escribe el peso de UNA mancuerna (mango + discos) y te digo qué discos poner en cada lado. Unidad: ${unit}.`
        : `Escribe el peso total (barra + discos) y te digo qué discos poner en cada lado. Unidad: ${unit}.` }));
      const totalIn = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', placeholder: `Peso total (${unit})` });
      if (prefillKg) totalIn.value = String(Units.num(prefillKg, unit));
      const barSel = barSelect();
      content.appendChild(Utils.el('div', { class: 'field-row' }, [
        Utils.el('div', { class: 'field' }, [Utils.el('label', { text: type === 'db' ? `Peso de una mancuerna (${unit})` : `Peso total (${unit})` }), totalIn]),
        Utils.el('div', { class: 'field' }, [Utils.el('label', { text: barLabel() }), barSel]),
      ]));
      const chips = Utils.el('div', { class: 'rt-chips plate-chips' });
      const result = Utils.el('div', { class: 'plate-result' });
      content.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 6px;', text: 'Discos que tienes (toca para quitar o poner)' }));
      content.appendChild(chips);
      content.appendChild(result);

      function paintChips() {
        chips.innerHTML = '';
        setOf(unit, type).plates.forEach((p) => {
          const on = !off.includes(p);
          const b = Utils.el('button', { type: 'button', class: `plate-chip${on ? ' on' : ''}` }, [Utils.el('i', { style: `background:${colorOf(p, unit)}` }), `${p}`]);
          b.addEventListener('click', () => { off = on ? off.concat([p]) : off.filter((x) => x !== p); saveCfg(unit, type, bar, off); paintChips(); calc(); });
          chips.appendChild(b);
        });
      }
      function calc() {
        result.innerHTML = '';
        const total = parseFloat(totalIn.value);
        if (isNaN(total) || total <= 0) { result.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;margin-top:12px;', text: 'Escribe un peso para ver los discos.' })); return; }
        const plates = setOf(unit, type).plates.filter((p) => !off.includes(p));
        const r = solve(total, bar, plates);
        if (r.tooLight) { result.appendChild(Utils.el('div', { class: 'nut-hint', text: `El peso es menor que ${type === 'db' ? 'el mango' : 'la barra'} (${fmt(bar)} ${unit}). Elige uno más ligero.` })); return; }
        if (!r.list.length) { result.appendChild(Utils.el('div', { class: 'nut-hint', text: `Solo ${type === 'db' ? 'el mango' : 'la barra'}: ${fmt(bar)} ${unit}.` })); return; }
        const box = Utils.el('div', { class: 'plate-box' });
        const svg = Utils.el('div', { class: 'plate-svg-wrap' });
        svg.innerHTML = platesHtml(r.list);
        box.appendChild(svg);
        box.appendChild(Utils.el('div', { class: 'plate-cap', text: sideLabel() }));
        const rows = Utils.el('div', { class: 'plate-rows' });
        r.list.forEach(([p, n]) => rows.appendChild(Utils.el('div', { class: 'plate-row' }, [Utils.el('i', { style: `background:${colorOf(p, unit)}` }), Utils.el('b', { text: `${n} × ${p} ${unit}` })])));
        box.appendChild(rows);
        const sideSum = r.list.reduce((a, [p, n]) => a + p * n, 0);
        box.appendChild(Utils.el('div', { class: `plate-total${r.exact ? '' : ' warn'}`, text: r.exact
          ? `Total: ${fmt(r.made)} ${unit} (${type === 'db' ? 'mango' : 'barra'} ${fmt(bar)} + 2 × ${fmt(sideSum)})`
          : `Con tus discos llegas a ${fmt(r.made)} ${unit} (faltan ${fmt(total - r.made)} ${unit}). Agrega discos más chicos o redondea el peso.` }));
        result.appendChild(box);
        if (opts.onUse) {
          const use = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', style: 'margin-top:10px;', text: `Usar ${fmt(r.made)} ${unit} en mi serie` });
          use.addEventListener('click', () => { Modal.close(); opts.onUse(Units.toKg(r.made, unit)); });
          result.appendChild(use);
        }
      }
      barSel.addEventListener('change', () => { bar = Number(barSel.value); saveCfg(unit, type, bar, off); calc(); });
      totalIn.addEventListener('input', calc);
      paintChips();
      calc();
      setTimeout(() => { if (!prefillKg) { try { totalIn.focus(); } catch (e) { /* sin foco */ } } }, 350);
    }

    // ------------------------------------------------ modo: armar (¿cuánto pesa lo que puse?)
    function paintBuild() {
      content.innerHTML = '';
      content.appendChild(Utils.el('p', { class: 'small', text: type === 'db'
        ? 'Toca + por cada disco que pones en CADA lado de la mancuerna y te digo cuánto pesa en total.'
        : 'Toca + por cada disco que pones en CADA lado de la barra (los dos lados iguales) y te digo cuánto pesa en total.' }));
      const barSel = barSelect();
      content.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: barLabel() }), barSel]));
      const list = Utils.el('div', { class: 'pb-list' });
      const out = Utils.el('div', { class: 'pb-out' });
      content.appendChild(list);
      content.appendChild(out);

      const totals = () => {
        const per = Object.keys(counts).reduce((a, k) => a + Number(k) * counts[k], 0);
        return { per: Math.round(per * 1000) / 1000, total: Math.round((bar + per * 2) * 100) / 100 };
      };
      function paintOut() {
        out.innerHTML = '';
        const t = totals();
        const flat = Object.keys(counts).map(Number).filter((p) => counts[p] > 0).sort((a, b) => b - a).map((p) => [p, counts[p]]);
        const box = Utils.el('div', { class: 'plate-box' });
        if (flat.length) { const svg = Utils.el('div', { class: 'plate-svg-wrap' }); svg.innerHTML = platesHtml(flat); box.appendChild(svg); }
        box.appendChild(Utils.el('div', { class: 'plate-cap', text: type === 'db' ? 'Peso de una mancuerna' : 'Peso total en la barra' }));
        box.appendChild(Utils.el('div', { class: 'pb-total', text: `${fmt(t.total)} ${unit}` }));
        box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;', text: `${type === 'db' ? 'Mango' : 'Barra'} ${fmt(bar)} + 2 × ${fmt(t.per)} de discos` }));
        const kgTxt = unit === 'lb' ? `${fmt(Math.round(Units.toKg(t.total, 'lb') * 10) / 10)} kg` : `${fmt(Math.round(Units.fromKg(t.total, 'lb') * 10) / 10)} lb`;
        box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;margin-top:2px;', text: `≈ ${kgTxt}` }));
        out.appendChild(box);
        const actions = Utils.el('div', { class: 'nut-actions act-2', style: 'margin-top:10px;' });
        const reset = Utils.el('button', { class: 'btn-secondary', type: 'button', text: 'Quitar todo' });
        reset.addEventListener('click', () => { Object.keys(counts).forEach((x) => delete counts[x]); paintList(); paintOut(); });
        actions.appendChild(reset);
        if (opts.onUse) {
          const use = Utils.el('button', { class: 'btn-primary', type: 'button', text: 'Usar en mi serie' });
          use.addEventListener('click', () => { Modal.close(); opts.onUse(Units.toKg(t.total, unit)); });
          actions.appendChild(use);
        } else actions.style.gridTemplateColumns = '1fr';
        out.appendChild(actions);
      }
      function paintList() {
        list.innerHTML = '';
        setOf(unit, type).plates.forEach((p) => {
          const n = counts[p] || 0;
          const minus = Utils.el('button', { type: 'button', class: 'wu-step', text: '−' });
          const plus = Utils.el('button', { type: 'button', class: 'wu-step', text: '+' });
          minus.disabled = n === 0;
          minus.addEventListener('click', () => { counts[p] = Math.max(0, (counts[p] || 0) - 1); paintList(); paintOut(); });
          plus.addEventListener('click', () => { counts[p] = (counts[p] || 0) + 1; paintList(); paintOut(); });
          list.appendChild(Utils.el('div', { class: 'pb-row' }, [
            Utils.el('i', { class: 'pb-dot', style: `background:${colorOf(p, unit)}` }),
            Utils.el('b', { class: 'pb-name', text: `${p} ${unit}` }),
            Utils.el('span', { class: 'pb-ctl' }, [minus, Utils.el('span', { class: 'pb-n', text: String(n) }), plus]),
          ]));
        });
      }
      barSel.addEventListener('change', () => { bar = Number(barSel.value); saveCfg(unit, type, bar, off); paintOut(); });
      paintList();
      paintOut();
    }

    function paintContent() { if (mode === 'build') paintBuild(); else paintCalc(); }
    paintSegs();
    paintContent();
    Modal.open('🧮 Calculadora de discos', body);
  }

  return { open, solve, config: (unit, type) => cfg(unit, type || 'bar') };
})();
