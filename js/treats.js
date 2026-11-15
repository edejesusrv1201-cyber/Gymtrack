/* ============================================================
   treats.js — Premios de comida y sueño
   · Cada semana ganas hasta 4 vales 🎟️: entrenar, seguir la dieta,
     romper un récord y dormir bien.
   · Con vales canjeas una cerveza, una comida trampa… Esas calorías se
     SUMAN a tu meta de ese día (no se le restan a tu dieta normal).
   · El sueño se anota a mano (la app no puede leer tu reloj).
   ============================================================ */

const Treats = (() => {
  const SLEEP_GOAL_H = 7;      // horas para contar una buena noche
  const r0 = (n) => Math.round(Number(n) || 0);

  // ---------------------------------------------------------------- datos
  const sleepLog = () => DB.read(DB.KEYS.sleepLog, {}) || {};
  const rewards = () => {
    const r = DB.read(DB.KEYS.rewards, null) || {};
    if (!r.since) r.since = weekStart(Utils.todayISO());
    r.awarded = r.awarded || {};
    r.spent = r.spent || [];
    return r;
  };
  const saveRewards = (r) => DB.write(DB.KEYS.rewards, r);

  function weekStart(iso) {
    const d = Utils.parseISO(iso);
    d.setDate(d.getDate() - d.getDay());
    return Utils.toISODate(d);
  }
  const addDays = (iso, n) => { const d = Utils.parseISO(iso); d.setDate(d.getDate() + n); return Utils.toISODate(d); };

  function sleepOf(iso) { const s = sleepLog()[iso]; return s && Number(s.h) > 0 ? Number(s.h) : null; }
  function saveSleep(iso, h) {
    const all = sleepLog();
    if (h > 0) all[iso] = { h: Math.round(h * 2) / 2 }; else delete all[iso];
    DB.write(DB.KEYS.sleepLog, all);
  }

  // calorías extra del día por premios (se suman a tu meta)
  function bonusOf(iso) {
    return (DB.getCalorieLog()[iso] || []).reduce((n, e) => n + (e.treat ? (Number(e.kcal) || 0) : 0), 0);
  }
  const dayKcal = (iso) => (DB.getCalorieLog()[iso] || []).reduce((n, e) => n + (Number(e.kcal) || 0), 0);
  const goalOf = (iso) => (DB.getSettings().calorieGoal || 0) + bonusOf(iso);

  // ---------------------------------------------------------------- retos de la semana
  function criteriaFor(start) {
    const end = addDays(start, 6);
    const today = Utils.todayISO();
    const tot = Metrics.totals(start, end);
    let diet = 0; let sleepN = 0; let prs = 0;
    const wl = DB.getWorkoutLog();
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(start, i);
      if (d > today) break;
      const g = goalOf(d); const k = dayKcal(d);
      if (g > 0 && k >= g * 0.85 && k <= g * 1.1) diet += 1;
      const h = sleepOf(d);
      if (h && h >= SLEEP_GOAL_H) sleepN += 1;
      ((wl[d] && wl[d].exercises) || []).forEach((e) => (e.sets || []).forEach((s) => { if (s.pr) prs += 1; }));
    }
    const mk = (id, icon, title, cur, target, hint) => ({ id, icon, title, cur, target, curCapped: Math.min(cur, target), hint, done: cur >= target });
    return [
      mk('train', '💪', 'Entrena 3 días', tot.days, 3, 'Series de trabajo registradas'),
      mk('diet', '🥗', 'Sigue tu dieta 4 días', diet, 4, 'Entre 85% y 110% de tu meta de kcal'),
      mk('pr', '🏆', 'Rompe 1 récord', prs, 1, 'Peso, repeticiones, tiempo o distancia'),
      mk('sleep', '😴', `Duerme ${SLEEP_GOAL_H} h o más, 5 noches`, sleepN, 5, 'Anota tus horas en Hoy → 😴 Sueño'),
    ];
  }

  // marca los vales ganados (una sola vez por reto y semana); devuelve los nuevos
  function check() {
    const r = rewards();
    const thisWk = weekStart(Utils.todayISO());
    const weeks = [thisWk];
    const prev = addDays(thisWk, -7);
    if (prev >= r.since) weeks.unshift(prev);
    const fresh = [];
    weeks.forEach((wk) => {
      const got = r.awarded[wk] || [];
      criteriaFor(wk).forEach((c) => {
        if (c.done && !got.includes(c.id)) { got.push(c.id); fresh.push(c); }
      });
      if (got.length) r.awarded[wk] = got;
    });
    if (fresh.length) {
      saveRewards(r);
      fresh.forEach((c) => Utils.toast(`🎟️ ¡Vale ganado! ${c.title}`));
    } else if (!DB.read(DB.KEYS.rewards, null)) saveRewards(r);
    return fresh;
  }

  const earnedTotal = (r) => Object.keys(r.awarded).reduce((n, k) => n + r.awarded[k].length, 0);
  const costOf = (kcal) => Math.max(1, Math.ceil((Number(kcal) || 0) / 220));
  function balance() {
    const r = rewards();
    return earnedTotal(r) - r.spent.reduce((n, s) => n + (s.cost || 0), 0);
  }
  function spend(entryId, name, kcal) {
    const r = rewards();
    r.spent.push({ id: entryId, date: Utils.todayISO(), name, kcal: r0(kcal), cost: costOf(kcal) });
    saveRewards(r);
  }
  // si borras un premio del diario, el vale vuelve
  function refund(entryId) {
    const r = rewards();
    const n = r.spent.length;
    r.spent = r.spent.filter((s) => s.id !== entryId);
    if (r.spent.length !== n) { saveRewards(r); Utils.toast('🎟️ Vale devuelto'); }
  }

  // estadísticas para los logros
  function stats() {
    const r = rewards();
    const sl = sleepLog();
    const good = Object.keys(sl).filter((d) => Number(sl[d].h) >= SLEEP_GOAL_H).length;
    const perfect = Object.keys(r.awarded).filter((k) => r.awarded[k].length >= 4).length;
    return { vales: earnedTotal(r), redeemed: r.spent.length, goodNights: good, perfectTreatWeeks: perfect };
  }

  // ---------------------------------------------------------------- premios disponibles
  const TREATS = [
    { id: 'cerveza', icon: '🍺', name: 'Cerveza clara (355 ml)', kcal: 150, p: 1.5, c: 13, f: 0 },
    { id: 'artesanal', icon: '🍻', name: 'Cerveza artesanal / IPA (355 ml)', kcal: 210, p: 2, c: 16, f: 0 },
    { id: 'light', icon: '🥂', name: 'Cerveza light (355 ml)', kcal: 100, p: 1, c: 5, f: 0 },
    { id: 'vino', icon: '🍷', name: 'Copa de vino (150 ml)', kcal: 125, p: 0, c: 4, f: 0 },
    { id: 'trago', icon: '🥃', name: 'Trago / shot (45 ml)', kcal: 100, p: 0, c: 0, f: 0 },
    { id: 'coctel', icon: '🍹', name: 'Cóctel (200 ml)', kcal: 250, p: 0, c: 22, f: 0 },
    { id: 'pizza', icon: '🍕', name: 'Pizza (2 rebanadas)', kcal: 570, p: 24, c: 68, f: 22 },
    { id: 'hamburguesa', icon: '🍔', name: 'Hamburguesa', kcal: 550, p: 28, c: 40, f: 30 },
    { id: 'tacos', icon: '🌮', name: 'Tacos (3)', kcal: 450, p: 22, c: 40, f: 22 },
    { id: 'papas', icon: '🍟', name: 'Papas fritas (porción)', kcal: 365, p: 4, c: 48, f: 17 },
    { id: 'postre', icon: '🍰', name: 'Postre (1 rebanada)', kcal: 350, p: 4, c: 45, f: 17 },
    { id: 'helado', icon: '🍦', name: 'Helado (2 bolas)', kcal: 270, p: 4, c: 31, f: 14 },
    { id: 'chocolate', icon: '🍫', name: 'Chocolate / antojo (50 g)', kcal: 270, p: 3, c: 28, f: 16 },
  ];

  function redeemPreset(t, qty, meal) {
    const kcal = t.kcal * qty;
    const need = costOf(kcal);
    if (balance() < need) { Utils.toast(`Te faltan ${need - balance()} vale${need - balance() === 1 ? '' : 's'}`); return false; }
    const iso = Utils.todayISO();
    const log = DB.getCalorieLog();
    const id = DB.uid();
    const list = log[iso] || [];
    list.push({
      id, foodName: `${t.icon} ${qty > 1 ? `${qty} × ` : ''}${t.name.replace(/ \(.*\)/, '')} (premio)`, servings: qty, treat: true,
      kcal: r0(kcal), protein: Math.round(t.p * qty * 10) / 10, carbs: Math.round(t.c * qty * 10) / 10, fat: Math.round(t.f * qty * 10) / 10,
      meal: meal || 'snack', time: new Date().toISOString(),
    });
    log[iso] = list;
    DB.saveCalorieLog(log);
    spend(id, t.name, kcal);
    return true;
  }

  // ---------------------------------------------------------------- pantallas
  function card(onChange) {
    check();
    const r = rewards();
    const bal = balance();
    const wk = weekStart(Utils.todayISO());
    const crit = criteriaFor(wk);
    const got = r.awarded[wk] || [];
    const wrap = Utils.el('div', { class: 'card treat-card' });
    wrap.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: '🎁 Tus premios' }),
      Utils.el('span', { class: 'vale-chip', text: `🎟️ ${bal} vale${bal === 1 ? '' : 's'}` }),
    ]));
    wrap.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin:-4px 0 10px;', text: 'Cumple los retos de la semana y gana vales para una cerveza o una comida trampa. Las calorías del premio se suman a tu meta de ese día: es parte del equilibrio.' }));
    crit.forEach((c) => {
      const pct = got.includes(c.id) ? 100 : Math.round((c.curCapped / c.target) * 100);
      wrap.appendChild(Utils.el('div', { class: `tr-row${got.includes(c.id) ? ' got' : ''}` }, [
        Utils.el('div', { class: 'tr-ico', text: got.includes(c.id) ? '🎟️' : c.icon }),
        Utils.el('div', { class: 'tr-main' }, [
          Utils.el('div', { class: 'tr-title', text: c.title }),
          Utils.el('div', { class: 'tr-bar' }, [Utils.el('i', { style: `width:${pct}%` })]),
          Utils.el('div', { class: 'meta', text: got.includes(c.id) ? '¡Vale ganado esta semana!' : `${c.curCapped} / ${c.target} · ${c.hint}` }),
        ]),
      ]));
    });
    const btns = Utils.el('div', { class: 'nut-actions act-2', style: 'margin-top:12px;' });
    const redeem = Utils.el('button', { class: bal > 0 ? 'btn-primary' : 'btn-secondary', type: 'button', text: '🍺 Canjear' });
    redeem.addEventListener('click', () => openRedeem(onChange));
    const sleep = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '😴 Sueño' });
    sleep.addEventListener('click', () => openSleep(Utils.todayISO(), onChange));
    btns.appendChild(redeem); btns.appendChild(sleep);
    wrap.appendChild(btns);
    if (r.spent.length) {
      const last = r.spent.slice(-3).reverse().map((s) => `${s.name.replace(/ \(.*\)/, '')} (${Utils.shortDate(s.date)})`).join(' · ');
      wrap.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: `Canjeaste: ${last}` }));
    }
    return wrap;
  }

  function openRedeem(onChange) {
    const body = Utils.el('div');
    const bal = balance();
    body.appendChild(Utils.el('div', { class: 'tr-balance' }, [Utils.el('b', { text: `🎟️ ${bal} vale${bal === 1 ? '' : 's'}` }), Utils.el('span', { class: 'small text-dim', text: ' · 1 vale ≈ 220 kcal de premio' })]));
    if (bal < 1) body.appendChild(Utils.el('div', { class: 'nut-hint', text: 'Aún no tienes vales. Cumple retos de la semana (entrenar, dieta, récord, sueño) y los ganas.' }));
    let sel = TREATS[0]; let qty = 1; let meal = 'snack';
    const grid = Utils.el('div', { class: 'tr-grid' });
    const sum = Utils.el('div', { class: 'tr-sum' });
    const qtyRow = Utils.el('div', { class: 'tr-qty' });
    const go = Utils.el('button', { class: 'btn-primary btn-block', type: 'button' });
    function paint() {
      grid.innerHTML = '';
      TREATS.forEach((t) => {
        const b = Utils.el('button', { type: 'button', class: `tr-tile${t === sel ? ' on' : ''}` }, [
          Utils.el('div', { class: 'tr-emoji', text: t.icon }),
          Utils.el('div', { class: 'tr-tname', text: t.name.replace(/ \(.*\)/, '') }),
          Utils.el('div', { class: 'meta', text: `${t.kcal} kcal · ${costOf(t.kcal)} 🎟️` }),
        ]);
        b.addEventListener('click', () => { sel = t; qty = 1; paint(); });
        grid.appendChild(b);
      });
      qtyRow.innerHTML = '';
      const minus = Utils.el('button', { type: 'button', class: 'wu-step', text: '−' });
      const plus = Utils.el('button', { type: 'button', class: 'wu-step', text: '+' });
      minus.addEventListener('click', () => { qty = Math.max(1, qty - 1); paint(); });
      plus.addEventListener('click', () => { qty = Math.min(6, qty + 1); paint(); });
      qtyRow.appendChild(minus); qtyRow.appendChild(Utils.el('b', { class: 'tr-q', text: `${qty} × ${sel.icon}` })); qtyRow.appendChild(plus);
      const kcal = sel.kcal * qty; const need = costOf(kcal);
      sum.textContent = `${qty} × ${sel.name} = ${kcal} kcal · cuesta ${need} vale${need === 1 ? '' : 's'}. Tu meta de hoy sube +${kcal} kcal.`;
      go.textContent = need > bal ? `Te faltan ${need - bal} vale${need - bal === 1 ? '' : 's'}` : `🎁 Canjear ${need} vale${need === 1 ? '' : 's'}`;
      go.disabled = need > bal;
    }
    body.appendChild(grid);
    body.appendChild(qtyRow);
    body.appendChild(sum);
    go.addEventListener('click', () => {
      if (!redeemPreset(sel, qty, meal)) return;
      Modal.close();
      Utils.toast(`🎁 ¡A disfrutar! +${sel.kcal * qty} kcal en tu meta de hoy`);
      if (onChange) onChange();
    });
    body.appendChild(go);

    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:16px 0 6px;', text: 'O registra el tuyo' }));
    const custom = Utils.el('div', { class: 'nut-actions act-3' });
    [['📷 Foto de la tabla', 'label'], ['▮▮ Código', 'barcode'], ['✍️ A mano', 'manual']].forEach(([t, k]) => {
      const b = Utils.el('button', { class: 'btn-secondary', type: 'button', text: t });
      b.addEventListener('click', () => { Modal.close(); CaloriesView.addTreat(k); });
      custom.appendChild(b);
    });
    body.appendChild(custom);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:6px;', text: 'Con foto, código de barras o a mano, las calorías de tu bebida o comida también se suman a la meta de hoy (cuesta 1 vale por cada ~220 kcal).' }));
    paint();
    Modal.open('🎁 Canjear un premio', body);
  }

  // ---- sueño
  function openSleep(iso, onChange) {
    const body = Utils.el('div');
    let day = iso;
    let hours = sleepOf(day) || 7.5;
    const head = Utils.el('div', { class: 'day-nav' });
    const big = Utils.el('div', { class: 'sl-big' });
    const chips = Utils.el('div', { class: 'rt-chips' });
    const avg = Utils.el('div', { class: 'small text-dim', style: 'margin-top:10px;text-align:center;' });
    const hist = Utils.el('div', { class: 'sl-hist' });
    function paint() {
      head.innerHTML = '';
      const prev = Utils.el('button', { class: 'btn-small', type: 'button', text: '←' });
      const next = Utils.el('button', { class: 'btn-small', type: 'button', text: '→' });
      prev.addEventListener('click', () => { day = addDays(day, -1); hours = sleepOf(day) || hours; paint(); });
      next.addEventListener('click', () => { if (day < Utils.todayISO()) { day = addDays(day, 1); hours = sleepOf(day) || hours; paint(); } });
      next.disabled = day >= Utils.todayISO();
      head.appendChild(prev);
      head.appendChild(Utils.el('div', { class: 'day-title' }, [Utils.el('div', { class: 'h', text: day === Utils.todayISO() ? 'Anoche (para hoy)' : `Noche antes del ${Utils.friendlyDate(day)}` })]));
      head.appendChild(next);
      big.innerHTML = '';
      const minus = Utils.el('button', { type: 'button', class: 'wu-step', text: '−' });
      const plus = Utils.el('button', { type: 'button', class: 'wu-step', text: '+' });
      minus.addEventListener('click', () => { hours = Math.max(0.5, hours - 0.5); paint(); });
      plus.addEventListener('click', () => { hours = Math.min(14, hours + 0.5); paint(); });
      big.appendChild(minus);
      big.appendChild(Utils.el('div', { class: `sl-val${hours >= SLEEP_GOAL_H ? ' good' : ''}` }, [Utils.el('b', { text: String(hours).replace('.5', ',5') }), Utils.el('span', { text: ' h' })]));
      big.appendChild(plus);
      chips.innerHTML = '';
      [5, 6, 7, 8, 9].forEach((h) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${hours === h ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: `${h} h` });
        c.addEventListener('click', () => { hours = h; paint(); });
        chips.appendChild(c);
      });
      hist.innerHTML = '';
      for (let i = 6; i >= 0; i -= 1) {
        const d = addDays(Utils.todayISO(), -i); const h = sleepOf(d);
        const col = Utils.el('div', { class: 'sl-col' }, [
          Utils.el('div', { class: 'sl-bar' }, [Utils.el('i', { class: h && h >= SLEEP_GOAL_H ? 'good' : '', style: `height:${h ? Math.min(100, (h / 10) * 100) : 0}%` })]),
          Utils.el('div', { class: 'sl-h', text: h ? String(h) : '–' }),
          Utils.el('div', { class: 'sl-d', text: Utils.DIAS_CORTOS[Utils.parseISO(d).getDay()] }),
        ]);
        hist.appendChild(col);
      }
      const last7 = []; for (let i = 0; i < 7; i += 1) { const h = sleepOf(addDays(Utils.todayISO(), -i)); if (h) last7.push(h); }
      avg.textContent = last7.length ? `Promedio de los últimos 7 días: ${(last7.reduce((a, b) => a + b, 0) / last7.length).toFixed(1)} h · meta ${SLEEP_GOAL_H} h` : `Meta: ${SLEEP_GOAL_H} h o más por noche.`;
    }
    body.appendChild(head); body.appendChild(big); body.appendChild(chips); body.appendChild(hist); body.appendChild(avg);
    const save = Utils.el('button', { class: 'btn-primary btn-block', style: 'margin-top:12px;', type: 'button', text: '✓ Guardar' });
    save.addEventListener('click', () => {
      saveSleep(day, hours);
      Modal.close();
      Utils.toast(`😴 ${hours} h guardadas`);
      check();
      if (onChange) onChange();
    });
    body.appendChild(save);
    if (sleepOf(day)) {
      const del = Utils.el('button', { class: 'link-btn small', style: 'margin-top:8px;', type: 'button', text: 'Quitar este registro' });
      del.addEventListener('click', () => { saveSleep(day, 0); Modal.close(); if (onChange) onChange(); });
      body.appendChild(del);
    }
    paint();
    Modal.open('😴 Sueño', body);
  }

  return { card, check, balance, bonusOf, goalOf, costOf, spend, refund, stats, openSleep, openRedeem, sleepOf, weekStart };
})();
