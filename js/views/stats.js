/* ============================================================
   views/stats.js — Métricas y gráficas de entrenamiento y nutrición
   (se muestran dentro de la pestaña "Progreso")
   ============================================================ */

const StatsView = (() => {
  let trainPeriod = 'semana';
  let nutriPeriod = 7;
  let selectedExerciseId = null;

  const GROUP_ORDER = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];

  // ---------- helpers de UI ----------
  function deltaEl(cur, prev, vsLabel) {
    let text = '—';
    let cls = '';
    if (prev > 0) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      text = `${pct >= 0 ? '▲ +' : '▼ '}${pct}% ${vsLabel}`;
      cls = pct > 0 ? 'up' : pct < 0 ? 'down' : '';
    } else if (cur > 0) {
      text = `Nuevo ${vsLabel}`;
      cls = 'up';
    }
    return Utils.el('div', { class: `kpi-delta ${cls}`, text });
  }

  function kpi(label, value, unit, cur, prev, vsLabel) {
    return Utils.el('div', { class: 'kpi' }, [
      Utils.el('div', { class: 'eyebrow', text: label }),
      Utils.el('div', { class: 'kpi-val' }, [value, unit ? Utils.el('small', { text: unit }) : null]),
      deltaEl(cur, prev, vsLabel),
    ]);
  }

  function card(title, eyebrow) {
    const c = Utils.el('div', { class: 'card' });
    c.appendChild(Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: title }),
      eyebrow ? Utils.el('span', { class: 'eyebrow', text: eyebrow }) : null,
    ]));
    return c;
  }

  // aviso de "aún no hay datos"; con `cta` agrega un botón que lleva a donde se registran
  const CTA_TRAIN = { label: '🏋️ Empezar un entreno', view: 'hoy' };
  const CTA_FOOD = { label: '🍽️ Registrar una comida', view: 'calorias' };
  const CTA_WATER = { label: '💧 Registrar agua', view: 'calorias' };
  function emptyNote(text, cta) {
    if (!cta) return Utils.el('p', { class: 'mt-8', text });
    const b = Utils.el('button', { type: 'button', class: 'btn-secondary empty-cta', text: cta.label });
    b.addEventListener('click', () => App.navigate(cta.view));
    return Utils.el('div', { class: 'empty-note' }, [Utils.el('p', { class: 'small text-dim', text }), b]);
  }

  // ---------- progreso de un ejercicio (reutilizado por el modal del entreno) ----------
  function exerciseProgress(host, ex) {
    const isCardio = ex.group === 'cardio';
    const sessions = Metrics.exerciseSessions(ex.id, isCardio);
    const settings = DB.getSettings();
    host.innerHTML = '';
    if (sessions.length < 2) {
      host.appendChild(emptyNote('Necesitas al menos 2 días registrados en este ejercicio para ver el progreso.'));
      if (!isCardio) host.appendChild(Progression.panel(ex));
      return;
    }
    const metrics = isCardio
      ? [
        { key: 'duration', label: 'Duración', get: (s) => s.duration, fmt: (v) => `${Utils.round1(v)} min`, color: '#ff5d73' },
        { key: 'distance', label: 'Distancia', get: (s) => s.distance, fmt: (v) => `${Utils.round1(v)} km`, color: '#3de0c2' },
      ]
      : [
        { key: 'weight', label: 'Peso máx.', get: (s) => Units.fromKg(s.weight), fmt: (v) => `${Utils.round1(v)}${Units.current()}`, color: '#5b8cff' },
        { key: 'e1rm', label: '1RM est.', get: (s) => Units.fromKg(s.e1rm), fmt: (v) => `${Utils.round1(v)}${Units.current()}`, color: Utils.accent().main },
        { key: 'volume', label: 'Volumen', get: (s) => Units.fromKg(s.volume), fmt: (v) => `${Utils.compact(v)}${Units.current()}`, color: '#35d49a' },
      ];
    let current = metrics[0].key;

    function build() {
      host.innerHTML = '';
      const m = metrics.find((x) => x.key === current);
      host.appendChild(Utils.segmented(metrics.map((x) => ({ key: x.key, label: x.label })), current, (k) => { current = k; build(); }, true));

      const points = sessions.map((s) => ({ x: s.date, y: m.get(s) || 0 }));
      const first = points[0].y;
      const last = points[points.length - 1].y;
      const delta = last - first;
      const pct = first > 0 ? Math.round((delta / first) * 100) : null;
      host.appendChild(Utils.el('div', { class: 'flex-between', style: 'margin-bottom:6px;' }, [
        Utils.el('div', {}, [
          Utils.el('div', { class: 'eyebrow', text: 'Último' }),
          Utils.el('div', { style: 'font-size:1.45rem;font-weight:800;letter-spacing:-0.02em;', text: m.fmt(last) }),
        ]),
        Utils.el('div', { style: 'text-align:right;' }, [
          Utils.el('div', { class: 'eyebrow', text: `Desde ${Utils.shortDate(points[0].x)}` }),
          Utils.el('div', {
            style: `font-size:1.05rem;font-weight:800;color:${delta >= 0 ? 'var(--green)' : 'var(--red)'};`,
            text: `${delta >= 0 ? '▲ +' : '▼ −'}${m.fmt(Math.abs(delta))}${pct !== null ? ` (${pct >= 0 ? '+' : ''}${pct}%)` : ''}`,
          }),
        ]),
      ]));

      const wrap = Utils.el('div', { class: 'chart-wrap' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      wrap.appendChild(canvas);
      host.appendChild(wrap);
      const note = Utils.el('div', { class: 'chart-note' });
      host.appendChild(note);
      requestAnimationFrame(() => {
        Utils.drawLineChart(canvas, points, {
          color: m.color,
          format: (v) => m.fmt(v),
          onPointClick: (p, i) => {
            const s = sessions[i];
            note.textContent = isCardio
              ? `${Utils.friendlyDate(s.date)} · ${Utils.round1(s.duration)} min${s.distance ? ` · ${Utils.round1(s.distance)} km` : ''}`
              : `${Utils.friendlyDate(s.date)} · ${Units.label(s.weight)} × ${s.reps} · ${s.sets} serie${s.sets === 1 ? '' : 's'}${s.rpe ? ` · RPE ${Utils.round1(s.rpe)}` : ''}`;
          },
        });
      });
      if (!isCardio) host.appendChild(Progression.panel(ex));
    }
    build();
  }

  // =========================================================
  //  ENTRENO
  // =========================================================
  // ---------- series por grupo muscular ----------
  const STATUS_COLOR = { low: '#ffc247', ok: '#35d49a', high: '#5b8cff' };
  const weeklyStatus = (n, goal) => (n < goal.min ? 'low' : n > goal.max ? 'high' : 'ok');
  const setsOf = (w, g) => (w.byGroup[g] && w.byGroup[g].sets ? w.byGroup[g].sets : 0);

  function weeklyGroupsCard() {
    const goal = Metrics.weeklyGoal();
    const weeks = Metrics.weeklySeries(8);
    const cur = weeks[weeks.length - 1];
    const barGroups = GROUP_ORDER.filter((g) => Metrics.STRENGTH_GROUPS.includes(g) || setsOf(cur, g) > 0);
    const inGoal = Metrics.STRENGTH_GROUPS.filter((g) => weeklyStatus(setsOf(cur, g), goal) === 'ok').length;

    const c = card('Series por grupo muscular', `Esta semana · meta ${goal.min}–${goal.max}`);
    c.appendChild(Utils.el('p', { class: 'small', style: 'margin:-2px 0 8px;', text: `${inGoal} de ${Metrics.STRENGTH_GROUPS.length} grupos dentro de la meta semanal.` }));

    const scale = Math.max(goal.max * 1.25, ...barGroups.map((g) => setsOf(cur, g) + 2));
    barGroups.forEach((g) => {
      const n = setsOf(cur, g);
      const strength = Metrics.STRENGTH_GROUPS.includes(g);
      const st = weeklyStatus(n, goal);
      const color = strength ? STATUS_COLOR[st] : Utils.GROUP_COLORS[g];
      const track = Utils.el('div', { class: 'hb-track' });
      if (strength) {
        track.appendChild(Utils.el('div', { class: 'hb-band', style: `left:${(goal.min / scale) * 100}%;width:${((goal.max - goal.min) / scale) * 100}%;` }));
      }
      if (n > 0) {
        track.appendChild(Utils.el('div', { class: 'hb-fill', style: `width:${Math.max(4, (n / scale) * 100)}%;background:linear-gradient(90deg,${color}aa,${color})` }));
      }
      let note = '';
      if (strength) note = st === 'low' ? `faltan ${goal.min - n}` : st === 'ok' ? 'en meta ✓' : `+${n - goal.max} sobre meta`;
      c.appendChild(Utils.el('div', { class: 'hbar' }, [
        Utils.el('span', { class: 'hb-label', style: `color:${Utils.GROUP_COLORS[g]}`, text: g }),
        track,
        Utils.el('span', { class: 'hb-val' }, [`${n} serie${n === 1 ? '' : 's'}`, Utils.el('small', { text: note })]),
      ]));
    });

    // conteo semana por semana
    c.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:18px 0 8px;', text: 'Últimas 8 semanas' }));
    const matrixGroups = GROUP_ORDER.filter((g) => Metrics.STRENGTH_GROUPS.includes(g) || weeks.some((w) => setsOf(w, g) > 0));
    const grid = Utils.el('div', { class: 'sets-matrix' });
    grid.appendChild(Utils.el('span', {}));
    weeks.forEach((w, i) => {
      const d = Utils.parseISO(w.start);
      grid.appendChild(Utils.el('span', { class: `sm-head${i === weeks.length - 1 ? ' now' : ''}`, text: `${d.getDate()}/${d.getMonth() + 1}` }));
    });
    matrixGroups.forEach((g) => {
      const strength = Metrics.STRENGTH_GROUPS.includes(g);
      grid.appendChild(Utils.el('span', { class: 'sm-label', style: `color:${Utils.GROUP_COLORS[g]}`, text: g }));
      weeks.forEach((w, i) => {
        const n = setsOf(w, g);
        const cls = n === 0 ? 'zero' : strength ? weeklyStatus(n, goal) : 'other';
        grid.appendChild(Utils.el('span', { class: `sm-cell ${cls}${i === weeks.length - 1 ? ' now' : ''}`, text: n ? String(n) : '·' }));
      });
    });
    c.appendChild(Utils.el('div', { style: 'overflow-x:auto;' }, [grid]));
    c.appendChild(Utils.el('div', { class: 'legend' }, [
      Utils.el('span', {}, [Utils.el('i', { style: `background:${STATUS_COLOR.low}` }), `menos de ${goal.min}`]),
      Utils.el('span', {}, [Utils.el('i', { style: `background:${STATUS_COLOR.ok}` }), `${goal.min}–${goal.max} (meta)`]),
      Utils.el('span', {}, [Utils.el('i', { style: `background:${STATUS_COLOR.high}` }), `más de ${goal.max}`]),
    ]));
    return c;
  }

  function monthlyGroupsCard(t) {
    const groupCard = card('Por grupo muscular', 'Este mes');
    const groups = GROUP_ORDER.filter((g) => t.byGroup[g] && t.byGroup[g].sets > 0)
      .sort((a, b) => t.byGroup[b].sets - t.byGroup[a].sets);
    if (groups.length === 0) {
      groupCard.appendChild(emptyNote('No hay series registradas en este período.', CTA_TRAIN));
    } else {
      const maxSets = Math.max(...groups.map((g) => t.byGroup[g].sets));
      groups.forEach((g) => {
        const d = t.byGroup[g];
        const sub = d.volume > 0 ? `${Utils.compact(Units.fromKg(d.volume))} ${Units.current()}` : d.minutes > 0 ? `${Math.round(d.minutes)} min` : 'peso corporal';
        groupCard.appendChild(Utils.el('div', { class: 'hbar' }, [
          Utils.el('span', { class: 'hb-label', style: `color:${Utils.GROUP_COLORS[g]}`, text: g }),
          Utils.el('div', { class: 'hb-track' }, [Utils.el('div', { class: 'hb-fill', style: `width:${Math.max(6, Math.round((d.sets / maxSets) * 100))}%;background:linear-gradient(90deg,${Utils.GROUP_COLORS[g]}aa,${Utils.GROUP_COLORS[g]})` })]),
          Utils.el('span', { class: 'hb-val' }, [`${d.sets} serie${d.sets === 1 ? '' : 's'}`, Utils.el('small', { text: sub })]),
        ]));
      });
    }
    return groupCard;
  }

  function renderTraining(container) {
    container.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();

    view.appendChild(Utils.segmented(
      [{ key: 'semana', label: 'Esta semana' }, { key: 'mes', label: 'Este mes' }],
      trainPeriod,
      (k) => { trainPeriod = k; renderTraining(container); },
      true,
    ));

    const cur = trainPeriod === 'mes' ? Metrics.monthRange(0) : Metrics.weekRange(0);
    const prv = trainPeriod === 'mes' ? Metrics.monthRange(-1) : Metrics.weekRange(-1);
    const t = Metrics.totals(cur.start, cur.end);
    const p = Metrics.totals(prv.start, prv.end);
    const vs = trainPeriod === 'mes' ? 'vs mes ant.' : 'vs sem. ant.';

    view.appendChild(Utils.el('div', { class: 'kpi-grid' }, [
      kpi('Entrenos', String(t.days), t.days === 1 ? 'día' : 'días', t.days, p.days, vs),
      kpi('Series', String(t.sets), '', t.sets, p.sets, vs),
      kpi('Volumen', Utils.compact(Units.fromKg(t.volume)), Units.current(), t.volume, p.volume, vs),
      kpi('Cardio', String(Math.round(t.minutes)), 'min', t.minutes, p.minutes, vs),
    ]));

    // ---- mapa muscular (series o recuperación) ----
    view.appendChild(Muscles.card());

    // ---- línea de tiempo de récords ----
    view.appendChild(Records.card());

    // ---- volumen por semana ----
    const weeks = Metrics.weeklySeries(8);
    const volCard = card('Volumen por semana', 'Últimas 8');
    if (weeks.every((w) => w.volume === 0)) {
      volCard.appendChild(emptyNote('Aún no hay volumen registrado. Anota series con peso y repeticiones y aquí verás cómo crece.', CTA_TRAIN));
    } else {
      const wrap = Utils.el('div', { class: 'chart-wrap' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      wrap.appendChild(canvas);
      volCard.appendChild(wrap);
      const note = Utils.el('div', { class: 'chart-note' });
      volCard.appendChild(note);
      requestAnimationFrame(() => {
        Utils.drawBarChart(canvas, weeks.map((w, i) => ({ label: w.label, value: Units.fromKg(w.volume), highlight: i === weeks.length - 1 })), {
          color: Utils.accent().main,
          format: (v) => Utils.compact(v),
          onBarClick: (b, i) => {
            const w = weeks[i];
            note.textContent = `Semana del ${Utils.shortDate(w.start)}: ${Utils.round1(Units.fromKg(w.volume))} ${Units.current()} · ${w.sets} series · ${w.days} día${w.days === 1 ? '' : 's'}`;
          },
        });
        const w = weeks[weeks.length - 1];
        note.textContent = `Semana del ${Utils.shortDate(w.start)}: ${Utils.round1(Units.fromKg(w.volume))} ${Units.current()} · ${w.sets} series · ${w.days} día${w.days === 1 ? '' : 's'}`;
      });
    }
    view.appendChild(volCard);

    // ---- series por grupo muscular ----
    view.appendChild(trainPeriod === 'semana' ? weeklyGroupsCard() : monthlyGroupsCard(t));

    // ---- constancia (mapa de calor 12 semanas) ----
    const heatStart = Metrics.weekRange(-11).start;
    const heatEnd = Metrics.weekRange(0).end;
    const levels = Metrics.dayLevels(heatStart, heatEnd);
    const heatCard = card('Constancia', `${Object.keys(levels).length} entrenos · 12 semanas`);
    const heat = Utils.el('div', { class: 'heat' });
    const todayIso = Utils.todayISO();
    const startDate = Utils.parseISO(heatStart);
    for (let i = 0; i < 84; i++) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      const iso = Utils.toISODate(d);
      const lvl = levels[iso] || 0;
      heat.appendChild(Utils.el('div', {
        class: `cell${lvl ? ` l${lvl}` : ''}${iso > todayIso ? ' future' : ''}`,
        title: `${Utils.friendlyDate(iso)}${lvl ? '' : ' · sin entreno'}`,
      }));
    }
    heatCard.appendChild(heat);
    heatCard.appendChild(Utils.el('div', { class: 'heat-legend' }, [
      Utils.el('span', { text: 'Menos' }),
      Utils.el('span', { class: 'cell' }), Utils.el('span', { class: 'cell l1' }),
      Utils.el('span', { class: 'cell l2' }), Utils.el('span', { class: 'cell l3' }),
      Utils.el('span', { text: 'Más' }),
    ]));
    view.appendChild(heatCard);

    // ---- progreso por ejercicio ----
    const exCard = card('Progreso por ejercicio');
    const withHistory = DB.getExercises()
      .map((ex) => ({ ex, sessions: Metrics.exerciseSessions(ex.id, ex.group === 'cardio') }))
      .filter((r) => r.sessions.length > 0)
      .sort((a, b) => (a.sessions[a.sessions.length - 1].date < b.sessions[b.sessions.length - 1].date ? 1 : -1));
    if (withHistory.length === 0) {
      exCard.appendChild(emptyNote('Registra series de algún ejercicio y aquí verás su evolución (peso, 1RM estimado y volumen).'));
    } else {
      if (!withHistory.some((r) => r.ex.id === selectedExerciseId)) selectedExerciseId = withHistory[0].ex.id;
      const sel = Utils.el('select', { 'aria-label': 'Ejercicio' });
      withHistory.forEach((r) => sel.appendChild(Utils.el('option', { value: r.ex.id, text: r.ex.name })));
      sel.value = selectedExerciseId;
      const host = Utils.el('div', { class: 'mt-12' });
      sel.addEventListener('change', () => {
        selectedExerciseId = sel.value;
        exerciseProgress(host, withHistory.find((r) => r.ex.id === selectedExerciseId).ex);
      });
      exCard.appendChild(sel);
      exCard.appendChild(host);
      exerciseProgress(host, withHistory.find((r) => r.ex.id === selectedExerciseId).ex);
    }
    view.appendChild(exCard);

    // ---- récords personales ----
    const recCard = card('🏆 Récords personales');
    const rows = DB.getExercises()
      .map((ex) => ({ ex, rec: Metrics.exerciseRecords(ex.id, ex.group === 'cardio') }))
      .filter((r) => r.rec)
      .sort((a, b) => a.ex.name.localeCompare(b.ex.name));
    if (rows.length === 0) {
      recCard.appendChild(emptyNote('Aún no tienes marcas. En cuanto anotes series de un ejercicio, tu récord aparecerá aquí y como guía al entrenarlo.', CTA_TRAIN));
    } else {
      rows.forEach(({ ex, rec }) => {
        const isCardio = ex.group === 'cardio';
        recCard.appendChild(Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { style: 'font-weight:700;', text: ex.name }),
            Utils.el('div', { class: `meta grp-${ex.group}`, text: ex.group }),
          ]),
          Utils.el('div', { style: 'text-align:right;' }, [
            Utils.el('div', { style: 'font-weight:800;color:var(--accent-light);', text: Metrics.formatSet(rec.max.set, isCardio) }),
            Utils.el('div', { class: 'meta', text: `${Utils.shortDate(rec.max.date)}${!isCardio && rec.e1rm > 0 ? ` · 1RM ${Units.label(rec.e1rm)}` : ''}` }),
          ]),
        ]));
      });
    }
    view.appendChild(recCard);

    container.appendChild(view);
  }

  // =========================================================
  //  NUTRICIÓN
  // =========================================================
  function lastDays(n) {
    const out = [];
    const today = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
      out.push(Utils.toISODate(d));
    }
    return out;
  }

  // =========================================================
  //  RESUMEN DE ALIMENTACIÓN: constancia, tendencia de peso y qué ajustar
  // =========================================================
  const sumDay = (entries, k) => entries.reduce((s, e) => s + (Number(e[k]) || 0), 0);

  function adherenceCard(nDays, container) {
    const st = DB.getSettings();
    const log = DB.getCalorieLog();
    const goalP = Number(st.proteinGoal) || 0;
    const days = lastDays(nDays).map((iso) => {
      const en = log[iso] || [];
      return {
        iso, dow: Utils.parseISO(iso).getDay(), logged: sumDay(en, 'kcal') >= 300,
        kcal: sumDay(en, 'kcal'), protein: sumDay(en, 'protein'), goal: Treats.goalOf(iso) || Number(st.calorieGoal) || 0,
      };
    });
    const logged = days.filter((d) => d.logged);
    const c = card('📋 Tu constancia', `últimos ${nDays} días`);
    if (!Number(st.calorieGoal)) {
      c.appendChild(emptyNote('Define tu meta de calorías (Calorías → Metas) para medir qué tanto la cumples.', CTA_FOOD));
      return c;
    }
    if (!logged.length) {
      c.appendChild(emptyNote('Aún no hay comidas registradas en este período.', CTA_FOOD));
      return c;
    }
    const inGoal = logged.filter((d) => d.kcal >= d.goal * 0.9 && d.kcal <= d.goal * 1.1).length;
    const protOk = goalP ? logged.filter((d) => d.protein >= goalP * 0.9).length : 0;
    const share = (a, b) => (b ? a / b : 0);
    const score = Math.round(100 * (0.4 * share(logged.length, nDays) + 0.35 * share(inGoal, logged.length) + (goalP ? 0.25 * share(protOk, logged.length) : 0.25 * share(inGoal, logged.length))));
    const label = score >= 80 ? 'Excelente' : score >= 60 ? 'Muy bien' : score >= 40 ? 'Vas mejorando' : 'Por mejorar';
    const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--accent-light)' : score >= 40 ? 'var(--yellow)' : 'var(--red)';

    const stat = (n, t) => Utils.el('div', { class: 'adh-stat' }, [Utils.el('b', { text: n }), Utils.el('span', { text: t })]);
    c.appendChild(Utils.el('div', { class: 'adh-top' }, [
      Utils.ring(score / 100, { size: 96, stroke: 10, label: String(score), sub: '/100' }),
      Utils.el('div', { class: 'adh-side' }, [
        Utils.el('div', { class: 'adh-label', style: `color:${color}`, text: label }),
        stat(`${logged.length}/${nDays}`, 'días registrados'),
        stat(`${inGoal}/${logged.length}`, 'días en tu meta de calorías (±10 %)'),
        goalP ? stat(`${protOk}/${logged.length}`, 'días con tu proteína') : null,
      ]),
    ]));

    // promedio contra meta por nutriente
    const avg = (k) => logged.reduce((sum, d) => sum + d[k], 0) / logged.length;
    const bars = [
      ['Calorías', avg('kcal'), logged.reduce((sum, d) => sum + d.goal, 0) / logged.length, 'kcal', '#ff9f43'],
      ['Proteína', avg('protein'), goalP, 'g', '#b08bff'],
    ];
    const gc = Number(st.carbGoal) || 0; const gf = Number(st.fatGoal) || 0;
    const avgOf = (k) => logged.reduce((sum, d) => sum + sumDay(log[d.iso] || [], k), 0) / logged.length;
    if (gc) bars.push(['Carbos', avgOf('carbs'), gc, 'g', '#5b8cff']);
    if (gf) bars.push(['Grasas', avgOf('fat'), gf, 'g', '#ffc247']);
    c.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:16px 0 8px;', text: 'Promedio diario vs tu meta' }));
    bars.forEach(([name, v, g, u, col]) => {
      if (!g) return;
      const pct = v / g;
      c.appendChild(Utils.el('div', { class: 'hbar' }, [
        Utils.el('span', { class: 'hb-label', style: `color:${col}`, text: name }),
        Utils.el('div', { class: 'hb-track' }, [Utils.el('div', { class: 'hb-fill', style: `width:${Math.max(3, Math.min(100, pct * 100))}%;background:${col}` })]),
        Utils.el('span', { class: 'hb-val' }, [`${Math.round(v)} ${u}`, Utils.el('small', { text: `${Math.round(pct * 100)} % de ${Math.round(g)}` })]),
      ]));
    });

    // consejos concretos (máximo 3)
    const tips = [];
    const avgK = avg('kcal'); const avgGoal = bars[0][2];
    if (logged.length < Math.ceil(nDays * 0.6)) tips.push(`📝 Registraste ${logged.length} de ${nDays} días. Con más días puedo darte consejos más fiables.`);
    if (goalP && avg('protein') < goalP * 0.9) tips.push(`🥩 Te faltan ~${Math.round(goalP - avg('protein'))} g de proteína al día. Una pechuga o 3 huevos y una lata de atún suman ~40 g.`);
    if (avgK > avgGoal * 1.1) tips.push(`🍽️ Pasas tu meta por ~${Math.round(avgK - avgGoal)} kcal al día. Mira la comida donde más se te va en Calorías.`);
    else if (avgK < avgGoal * 0.9) tips.push(`⚡ Te quedas ~${Math.round(avgGoal - avgK)} kcal por debajo de tu meta. Si estás entrenando, puede frenar tu progreso.`);
    const wk = logged.filter((d) => d.dow === 0 || d.dow === 6); const wd = logged.filter((d) => d.dow > 0 && d.dow < 6);
    if (wk.length >= 2 && wd.length >= 3) {
      const a = wk.reduce((sum, d) => sum + d.kcal, 0) / wk.length; const b = wd.reduce((sum, d) => sum + d.kcal, 0) / wd.length;
      if (a > b * 1.15) tips.push(`📅 Los fines de semana comes ~${Math.round(a - b)} kcal más que entre semana: ahí se te escapa buena parte del progreso.`);
    }
    if (!tips.length) tips.push('✅ Vas muy bien con tus números. Mantén el ritmo.');
    tips.slice(0, 3).forEach((t) => c.appendChild(Utils.el('div', { class: 'nut-hint adh-tip', text: t })));
    return c;
  }

  // tendencia de peso contra tu objetivo + ajuste sugerido de calorías
  function trendCard(container) {
    const c = card('⚖️ Tu peso y tus calorías', 'semana a semana');
    const cfg = Nutrition.autoConfig();
    const mUnit = Units.current();
    const weeks = [];
    for (let i = 5; i >= 0; i--) {
      const r = Metrics.weekRange(-i);
      const log = DB.getCalorieLog();
      const ds = lastDaysBetween(r.start, r.end).map((iso) => ({ iso, en: log[iso] || [] })).filter((d) => sumDay(d.en, 'kcal') >= 300);
      const ws = DB.getMeasurements().filter((m) => m.weight && m.date >= r.start && m.date <= r.end).map((m) => Number(m.weight));
      weeks.push({
        r, days: ds.length,
        kcal: ds.length ? ds.reduce((sum, d) => sum + sumDay(d.en, 'kcal'), 0) / ds.length : null,
        prot: ds.length ? ds.reduce((sum, d) => sum + sumDay(d.en, 'protein'), 0) / ds.length : null,
        w: ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null,
      });
    }
    if (weeks.every((w) => w.w === null)) {
      c.appendChild(emptyNote('Registra tu peso al menos una vez por semana (Progreso → Cuerpo) para ver cómo responde tu cuerpo a lo que comes.'));
      return c;
    }
    // tabla
    const head = ['Semana', 'kcal/día', 'Peso', 'Cambio'];
    const grid = Utils.el('div', { class: 'wk-table' });
    head.forEach((h) => grid.appendChild(Utils.el('span', { class: 'wk-h', text: h })));
    let prevW = null;
    weeks.forEach((w, i) => {
      const d = Utils.parseISO(w.r.start);
      const delta = w.w !== null && prevW !== null ? w.w - prevW : null;
      if (w.w !== null) prevW = w.w;
      const cls = i === weeks.length - 1 ? ' now' : '';
      grid.appendChild(Utils.el('span', { class: `wk-c${cls}`, text: `${d.getDate()}/${d.getMonth() + 1}` }));
      grid.appendChild(Utils.el('span', { class: `wk-c${cls}`, text: w.kcal !== null ? String(Math.round(w.kcal)) : '—' }));
      grid.appendChild(Utils.el('span', { class: `wk-c${cls}`, text: w.w !== null ? `${Utils.round1(Units.fromKg(w.w))} ${mUnit}` : '—' }));
      const good = delta === null ? '' : (cfg.mode === 'perder' ? (delta < -0.05 ? ' up' : delta > 0.15 ? ' down' : '') : cfg.mode === 'ganar' ? (delta > 0.05 ? ' up' : delta < -0.15 ? ' down' : '') : (Math.abs(delta) <= 0.4 ? ' up' : ' down'));
      grid.appendChild(Utils.el('span', { class: `wk-c wk-d${good}${cls}`, text: delta === null ? '—' : `${delta > 0 ? '+' : delta < 0 ? '−' : ''}${Utils.round1(Math.abs(Units.fromKg(delta)))}` }));
    });
    c.appendChild(grid);

    // veredicto según tu objetivo
    const slope = typeof MeasurementsView.weightTrend === 'function' ? MeasurementsView.weightTrend() : null;
    const sg = Nutrition.suggestGoal();
    const goalTxt = cfg.mode === 'perder' ? `perder ${Math.abs(cfg.rate)} kg/sem` : cfg.mode === 'ganar' ? `subir ${cfg.rate} kg/sem` : 'mantener tu peso';
    c.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:10px;', text: `Objetivo actual: ${goalTxt}. Cámbialo en Calorías → Ajuste automático.` }));
    if (slope === null) {
      c.appendChild(Utils.el('div', { class: 'nut-hint', text: '⚖️ Necesito 2 pesajes con al menos 5 días de diferencia para calcular tu tendencia. Pésate en ayunas 2 veces por semana.' }));
    } else {
      const wkKg = slope * 7;
      const diff = wkKg - cfg.rate;
      const sl = `${wkKg > 0 ? '+' : wkKg < 0 ? '−' : ''}${Utils.round1(Math.abs(Units.fromKg(wkKg)))} ${mUnit}/semana`;
      let msg; let col = 'var(--green)';
      if (Math.abs(diff) <= 0.15) msg = `✓ Tu peso cambia ${sl}: justo lo que buscas. No cambies nada.`;
      else if (cfg.mode === 'perder' && diff > 0) { msg = `🐌 Tu peso cambia ${sl}: bajas más lento de lo planeado.`; col = 'var(--yellow)'; }
      else if (cfg.mode === 'perder') { msg = `⚠️ Tu peso cambia ${sl}: bajas más rápido de lo planeado. Cuida tu músculo y tu energía.`; col = 'var(--yellow)'; }
      else if (cfg.mode === 'ganar' && diff < 0) { msg = `🐌 Tu peso cambia ${sl}: subes más lento de lo planeado.`; col = 'var(--yellow)'; }
      else if (cfg.mode === 'ganar') { msg = `⚠️ Tu peso cambia ${sl}: subes más rápido de lo planeado y puede ser grasa.`; col = 'var(--yellow)'; }
      else { msg = `⚠️ Tu peso cambia ${sl} y quieres mantenerlo.`; col = 'var(--yellow)'; }
      c.appendChild(Utils.el('div', { class: 'nut-hint', style: `color:${col};`, text: msg }));
    }
    if (sg.ok && Math.abs(sg.diff) >= 100) {
      const row = Utils.el('div', { class: 'adh-adjust' }, [
        Utils.el('div', { style: 'flex:1;min-width:0;' }, [
          Utils.el('b', { text: `Meta sugerida: ${sg.recommended} kcal` }),
          Utils.el('div', { class: 'small text-dim', text: `${sg.diff > 0 ? '+' : ''}${sg.diff} vs tu meta de ${sg.current}${Math.abs(sg.slopeKgWeek - cfg.rate) <= 0.15 ? `. Comes ~${sg.avgKcal} y tu peso va bien: así tu meta refleja la realidad.` : ''}` }),
        ]),
      ]);
      const ap = Utils.el('button', { type: 'button', class: 'btn-primary btn-small', text: 'Aplicar' });
      ap.addEventListener('click', () => { Nutrition.applyGoal(sg.recommended); Utils.toast(`Meta actualizada: ${sg.recommended} kcal ✓`); renderNutrition(container); });
      row.appendChild(ap);
      c.appendChild(row);
    } else if (sg.ok) {
      c.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: `Tu gasto real estimado es ~${sg.tdee} kcal/día y tu meta ya encaja.` }));
    } else {
      c.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: `Para sugerirte un ajuste de calorías: ${sg.reason}` }));
    }
    return c;
  }

  function lastDaysBetween(a, b) {
    const out = [];
    const d = Utils.parseISO(a); const end = Utils.parseISO(b);
    while (d <= end) { out.push(Utils.toISODate(d)); d.setDate(d.getDate() + 1); }
    return out;
  }

  function renderNutrition(container) {
    container.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const settings = DB.getSettings();

    view.appendChild(Utils.segmented(
      [{ key: 7, label: '7 días' }, { key: 30, label: '30 días' }],
      nutriPeriod,
      (k) => { nutriPeriod = k; renderNutrition(container); },
      true,
    ));

    const days = lastDays(nutriPeriod);
    const calLog = DB.getCalorieLog();
    const waterLog = DB.getWaterLog();
    const rows = days.map((iso) => {
      const entries = calLog[iso] || [];
      const sum = (k) => entries.reduce((s, e) => s + (Number(e[k]) || 0), 0);
      return {
        iso, logged: entries.length > 0,
        kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat'),
        water: (waterLog[iso] || []).reduce((s, e) => s + e.ml, 0),
      };
    });
    const withData = rows.filter((r) => r.logged);
    const avg = (k) => (withData.length ? withData.reduce((s, r) => s + r[k], 0) / withData.length : 0);
    const goal = settings.calorieGoal || 2500;
    const waterGoal = settings.waterGoalMl || 2500;
    const inGoal = withData.filter((r) => r.kcal >= goal * 0.9 && r.kcal <= goal * 1.1).length;
    const waterDays = rows.filter((r) => r.water > 0);
    const waterAvg = waterDays.length ? waterDays.reduce((s, r) => s + r.water, 0) / waterDays.length : 0;

    const kcalAvg = avg('kcal');
    view.appendChild(Utils.el('div', { class: 'kpi-grid' }, [
      Utils.el('div', { class: 'kpi' }, [
        Utils.el('div', { class: 'eyebrow', text: 'Calorías / día' }),
        Utils.el('div', { class: 'kpi-val' }, [String(Math.round(kcalAvg)), Utils.el('small', { text: 'kcal' })]),
        Utils.el('div', { class: 'kpi-delta', text: withData.length ? `${kcalAvg >= goal ? '▲ +' : '▼ −'}${Math.abs(Math.round(kcalAvg - goal))} vs meta` : 'Sin registros' }),
      ]),
      Utils.el('div', { class: 'kpi' }, [
        Utils.el('div', { class: 'eyebrow', text: 'Proteína / día' }),
        Utils.el('div', { class: 'kpi-val' }, [String(Math.round(avg('protein'))), Utils.el('small', { text: 'g' })]),
        Utils.el('div', { class: 'kpi-delta', text: `meta ${settings.proteinGoal} g` }),
      ]),
      Utils.el('div', { class: 'kpi' }, [
        Utils.el('div', { class: 'eyebrow', text: 'Días en meta' }),
        Utils.el('div', { class: 'kpi-val' }, [String(inGoal), Utils.el('small', { text: `/ ${withData.length}` })]),
        Utils.el('div', { class: 'kpi-delta', text: '±10% de tu meta' }),
      ]),
      Utils.el('div', { class: 'kpi' }, [
        Utils.el('div', { class: 'eyebrow', text: 'Agua / día' }),
        Utils.el('div', { class: 'kpi-val' }, [String(Utils.round1(waterAvg / 1000)), Utils.el('small', { text: 'L' })]),
        Utils.el('div', { class: 'kpi-delta', text: `meta ${Utils.round1(waterGoal / 1000)} L` }),
      ]),
    ]));

    view.appendChild(adherenceCard(nutriPeriod, container));
    view.appendChild(trendCard(container));

    const labelFor = (iso) => {
      const d = Utils.parseISO(iso);
      return nutriPeriod === 7 ? Utils.DIAS_CORTOS[d.getDay()] + d.getDate() : String(d.getDate());
    };

    // ---- calorías por día ----
    const calCard = card('Calorías por día', `Meta ${goal} kcal`);
    if (withData.length === 0) {
      calCard.appendChild(emptyNote('Aún no hay comidas registradas en este período.', CTA_FOOD));
    } else {
      const wrap = Utils.el('div', { class: 'chart-wrap' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      wrap.appendChild(canvas);
      calCard.appendChild(wrap);
      const note = Utils.el('div', { class: 'chart-note' });
      calCard.appendChild(note);
      requestAnimationFrame(() => {
        Utils.drawBarChart(canvas, rows.map((r, i) => ({
          label: labelFor(r.iso),
          value: r.kcal,
          color: r.kcal > goal * 1.1 ? '#ff5d73' : Utils.accent().main,
          highlight: i === rows.length - 1,
        })), {
          goal,
          goalLabel: 'meta',
          format: (v) => Utils.compact(v),
          onBarClick: (b, i) => {
            const r = rows[i];
            note.textContent = `${Utils.friendlyDate(r.iso)}: ${Math.round(r.kcal)} kcal · P ${Utils.round1(r.protein)} g · C ${Utils.round1(r.carbs)} g · G ${Utils.round1(r.fat)} g`;
          },
        });
      });
    }
    view.appendChild(calCard);

    // ---- reparto de macros ----
    const macroCard = card('Reparto de macros', 'Promedio');
    const pKcal = avg('protein') * 4;
    const cKcal = avg('carbs') * 4;
    const fKcal = avg('fat') * 9;
    const macroTotal = pKcal + cKcal + fKcal;
    if (macroTotal <= 0) {
      macroCard.appendChild(emptyNote('Registra comidas con macros para ver tu reparto.'));
    } else {
      const parts = [
        { name: 'Proteína', color: '#b08bff', kcal: pKcal, g: avg('protein') },
        { name: 'Carbohidratos', color: '#5b8cff', kcal: cKcal, g: avg('carbs') },
        { name: 'Grasas', color: '#ffc247', kcal: fKcal, g: avg('fat') },
      ];
      macroCard.appendChild(Utils.el('div', { class: 'stack-bar' }, parts.map((x) => Utils.el('div', { style: `width:${(x.kcal / macroTotal) * 100}%;background:${x.color}` }))));
      macroCard.appendChild(Utils.el('div', { class: 'legend' }, parts.map((x) => Utils.el('span', {}, [
        Utils.el('i', { style: `background:${x.color}` }),
        `${x.name} ${Math.round((x.kcal / macroTotal) * 100)}% · ${Math.round(x.g)} g`,
      ]))));
    }
    view.appendChild(macroCard);

    // ---- agua por día ----
    const waterCard = card('Agua por día', `Meta ${Utils.round1(waterGoal / 1000)} L`);
    if (waterDays.length === 0) {
      waterCard.appendChild(emptyNote('Aún no has registrado agua en este período.', CTA_WATER));
    } else {
      const wrap = Utils.el('div', { class: 'chart-wrap' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      wrap.appendChild(canvas);
      waterCard.appendChild(wrap);
      const note = Utils.el('div', { class: 'chart-note' });
      waterCard.appendChild(note);
      requestAnimationFrame(() => {
        Utils.drawBarChart(canvas, rows.map((r, i) => ({
          label: labelFor(r.iso),
          value: r.water,
          color: r.water >= waterGoal ? '#35d49a' : '#5b8cff',
          highlight: i === rows.length - 1,
        })), {
          goal: waterGoal,
          goalLabel: 'meta',
          format: (v) => `${Utils.round1(v / 1000)}L`,
          onBarClick: (b, i) => {
            note.textContent = `${Utils.friendlyDate(rows[i].iso)}: ${Utils.round1(rows[i].water / 1000)} L`;
          },
        });
      });
    }
    view.appendChild(waterCard);

    container.appendChild(view);
  }

  return { renderTraining, renderNutrition, exerciseProgress };
})();
