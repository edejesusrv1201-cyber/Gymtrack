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

  function emptyNote(text) {
    return Utils.el('p', { class: 'mt-8', text });
  }

  // ---------- progreso de un ejercicio (reutilizado por el modal del entreno) ----------
  function exerciseProgress(host, ex) {
    const isCardio = ex.group === 'cardio';
    const sessions = Metrics.exerciseSessions(ex.id, isCardio);
    const settings = DB.getSettings();
    host.innerHTML = '';
    if (sessions.length < 2) {
      host.appendChild(emptyNote('Necesitas al menos 2 días registrados en este ejercicio para ver el progreso.'));
      return;
    }
    const metrics = isCardio
      ? [
        { key: 'duration', label: 'Duración', get: (s) => s.duration, fmt: (v) => `${Utils.round1(v)} min`, color: '#ff5d73' },
        { key: 'distance', label: 'Distancia', get: (s) => s.distance, fmt: (v) => `${Utils.round1(v)} km`, color: '#3de0c2' },
      ]
      : [
        { key: 'weight', label: 'Peso máx.', get: (s) => s.weight, fmt: (v) => `${Utils.round1(v)}${settings.units}`, color: '#5b8cff' },
        { key: 'e1rm', label: '1RM est.', get: (s) => s.e1rm, fmt: (v) => `${Utils.round1(v)}${settings.units}`, color: Utils.accent().main },
        { key: 'volume', label: 'Volumen', get: (s) => s.volume, fmt: (v) => `${Utils.compact(v)}${settings.units}`, color: '#35d49a' },
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
              : `${Utils.friendlyDate(s.date)} · ${s.weight}${settings.units} × ${s.reps} · ${s.sets} serie${s.sets === 1 ? '' : 's'}`;
          },
        });
      });
    }
    build();
  }

  // =========================================================
  //  ENTRENO
  // =========================================================
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
      kpi('Volumen', Utils.compact(t.volume), settings.units, t.volume, p.volume, vs),
      kpi('Cardio', String(Math.round(t.minutes)), 'min', t.minutes, p.minutes, vs),
    ]));

    // ---- volumen por semana ----
    const weeks = Metrics.weeklySeries(8);
    const volCard = card('Volumen por semana', 'Últimas 8');
    if (weeks.every((w) => w.volume === 0)) {
      volCard.appendChild(emptyNote('Aún no hay volumen registrado. Anota series con peso y repeticiones y aquí verás cómo crece.'));
    } else {
      const wrap = Utils.el('div', { class: 'chart-wrap' });
      const canvas = Utils.el('canvas', { class: 'chart' });
      wrap.appendChild(canvas);
      volCard.appendChild(wrap);
      const note = Utils.el('div', { class: 'chart-note' });
      volCard.appendChild(note);
      requestAnimationFrame(() => {
        Utils.drawBarChart(canvas, weeks.map((w, i) => ({ label: w.label, value: w.volume, highlight: i === weeks.length - 1 })), {
          color: Utils.accent().main,
          format: (v) => Utils.compact(v),
          onBarClick: (b, i) => {
            const w = weeks[i];
            note.textContent = `Semana del ${Utils.shortDate(w.start)}: ${Utils.round1(w.volume)} ${settings.units} · ${w.sets} series · ${w.days} día${w.days === 1 ? '' : 's'}`;
          },
        });
        const w = weeks[weeks.length - 1];
        note.textContent = `Semana del ${Utils.shortDate(w.start)}: ${Utils.round1(w.volume)} ${settings.units} · ${w.sets} series · ${w.days} día${w.days === 1 ? '' : 's'}`;
      });
    }
    view.appendChild(volCard);

    // ---- series por grupo muscular ----
    const groupCard = card('Por grupo muscular', trainPeriod === 'mes' ? 'Este mes' : 'Esta semana');
    const groups = GROUP_ORDER.filter((g) => t.byGroup[g] && t.byGroup[g].sets > 0)
      .sort((a, b) => t.byGroup[b].sets - t.byGroup[a].sets);
    if (groups.length === 0) {
      groupCard.appendChild(emptyNote('No hay series registradas en este período.'));
    } else {
      const maxSets = Math.max(...groups.map((g) => t.byGroup[g].sets));
      groups.forEach((g) => {
        const d = t.byGroup[g];
        const sub = d.volume > 0 ? `${Utils.compact(d.volume)} ${settings.units}` : d.minutes > 0 ? `${Math.round(d.minutes)} min` : 'peso corporal';
        groupCard.appendChild(Utils.el('div', { class: 'hbar' }, [
          Utils.el('span', { class: 'hb-label', style: `color:${Utils.GROUP_COLORS[g]}`, text: g }),
          Utils.el('div', { class: 'hb-track' }, [Utils.el('div', { class: 'hb-fill', style: `width:${Math.max(6, Math.round((d.sets / maxSets) * 100))}%;background:linear-gradient(90deg,${Utils.GROUP_COLORS[g]}aa,${Utils.GROUP_COLORS[g]})` })]),
          Utils.el('span', { class: 'hb-val' }, [`${d.sets} serie${d.sets === 1 ? '' : 's'}`, Utils.el('small', { text: sub })]),
        ]));
      });
    }
    view.appendChild(groupCard);

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
      const sel = Utils.el('select', {});
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
      recCard.appendChild(emptyNote('Aún no tienes marcas. En cuanto anotes series de un ejercicio, tu récord aparecerá aquí y como guía al entrenarlo.'));
    } else {
      rows.forEach(({ ex, rec }) => {
        const isCardio = ex.group === 'cardio';
        recCard.appendChild(Utils.el('div', { class: 'list-item' }, [
          Utils.el('div', {}, [
            Utils.el('div', { style: 'font-weight:700;', text: ex.name }),
            Utils.el('div', { class: `meta grp-${ex.group}`, text: ex.group }),
          ]),
          Utils.el('div', { style: 'text-align:right;' }, [
            Utils.el('div', { style: 'font-weight:800;color:var(--accent-light);', text: Metrics.formatSet(rec.max.set, isCardio, settings.units) }),
            Utils.el('div', { class: 'meta', text: `${Utils.shortDate(rec.max.date)}${!isCardio && rec.e1rm > 0 ? ` · 1RM ${Utils.round1(rec.e1rm)}${settings.units}` : ''}` }),
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

    const labelFor = (iso) => {
      const d = Utils.parseISO(iso);
      return nutriPeriod === 7 ? Utils.DIAS_CORTOS[d.getDay()] + d.getDate() : String(d.getDate());
    };

    // ---- calorías por día ----
    const calCard = card('Calorías por día', `Meta ${goal} kcal`);
    if (withData.length === 0) {
      calCard.appendChild(emptyNote('Aún no hay comidas registradas en este período.'));
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
      waterCard.appendChild(emptyNote('Aún no has registrado agua en este período.'));
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
