/* ============================================================
   excelBackup.js — Exportar/importar TODOS los datos como Excel.

   El archivo trae dos tipos de hojas:
   - Hojas de reporte (visibles, con formato): Resumen, Entrenamientos,
     Récords, Constancia, Medidas, Nutrición, Comidas y Rutinas.
   - Hojas "_datos_*" (ocultas): las tablas técnicas con las que la app
     restaura todo al importar. No las borres ni les cambies los títulos.

   Los archivos de versiones anteriores (hojas sin prefijo) se siguen
   pudiendo importar.
   ============================================================ */

const ExcelBackup = (() => {
  const DATA = {
    ajustes: '_datos_Ajustes',
    ejercicios: '_datos_Ejercicios',
    rutinas: '_datos_Rutinas',
    rutinaEjercicios: '_datos_RutinaEjercicios',
    planMensual: '_datos_PlanMensual',
    medidas: '_datos_Medidas',
    alimentos: '_datos_Alimentos',
    calorias: '_datos_RegistroCalorias',
    agua: '_datos_Agua',
    entrenamientos: '_datos_Entrenamientos',
    series: '_datos_Series',
    calentamiento: '_datos_Calentamiento',
  };
  const LEGACY = {
    ajustes: 'Ajustes',
    ejercicios: 'Ejercicios',
    rutinas: 'Rutinas',
    rutinaEjercicios: 'RutinaEjercicios',
    planMensual: 'PlanMensual',
    medidas: 'Medidas',
    alimentos: 'Alimentos',
    calorias: 'RegistroCalorias',
    agua: 'Agua',
    entrenamientos: 'Entrenamientos',
    series: 'EntrenamientoSeries',
    calentamiento: 'Calentamiento',
  };

  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const FELT = { facil: 'Fácil', normal: 'Normal', dificil: 'Costó', fallo: 'Fallé' };
  const MEAS = [
    ['weight', 'Peso'], ['chest', 'Pecho'], ['waist', 'Cintura'], ['hips', 'Cadera'],
    ['armL', 'Brazo izq.'], ['armR', 'Brazo der.'], ['thighL', 'Muslo izq.'], ['thighR', 'Muslo der.'],
    ['calfL', 'Pantorrilla izq.'], ['calfR', 'Pantorrilla der.'], ['neck', 'Cuello'],
    ['arm', 'Brazo (antes)'], ['thigh', 'Muslo (antes)'], ['calf', 'Pantorrilla (antes)'],
  ];

  // ---------------- utilidades ----------------
  function asISODate(v) {
    if (v === undefined || v === null || v === '') return null;
    if (v instanceof Date) return Utils.toISODate(v);
    if (typeof v === 'number') {
      const d = XLSX.SSF.parse_date_code(v);
      if (d) return `${d.y}-${Utils.pad(d.m)}-${Utils.pad(d.d)}`;
    }
    return String(v).slice(0, 10);
  }

  function num(v) {
    if (v === undefined || v === null || v === '') return undefined;
    const n = Number(v);
    return isNaN(n) ? undefined : n;
  }

  function bool(v) {
    return v === true || v === 1 || v === '1' || v === 'true' || v === 'TRUE';
  }

  // fecha ISO -> número de serie de Excel (para que sea una fecha real y se pueda filtrar)
  function excelDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return (Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000;
  }

  const dow = (iso) => DOW[Utils.parseISO(iso).getDay()];

  // ---------------- estilos ----------------
  const PAL = {
    ink: '12151D', ink2: '1E2330', text: '1F2430', dim: '7A8296', line: 'DDE1EC',
    zebra: 'F6F7FB', white: 'FFFFFF', green: '17A673', red: 'D64550', empty: 'EEF0F6',
  };
  const hex6 = (h) => String(h).replace('#', '').toUpperCase();
  const accentHex = () => hex6(Utils.accent().main);

  // mezcla un color con blanco (t = 1 es el color puro, 0 es blanco)
  function mix(hex, t) {
    const n = parseInt(hex, 16);
    const ch = (v) => Math.round(255 - (255 - v) * t).toString(16).padStart(2, '0');
    return (ch((n >> 16) & 255) + ch((n >> 8) & 255) + ch(n & 255)).toUpperCase();
  }

  function st(o = {}) {
    const s = { font: { name: 'Calibri', sz: o.sz || 11, bold: !!o.bold, italic: !!o.italic, color: { rgb: o.color || PAL.text } } };
    if (o.bg) s.fill = { patternType: 'solid', fgColor: { rgb: o.bg } };
    s.alignment = { horizontal: o.h || 'left', vertical: o.v || 'center', wrapText: !!o.wrap, indent: o.indent || 0 };
    if (o.border) s.border = o.border;
    return s;
  }

  const bd = (side, style, rgb) => ({ [side]: { style, color: { rgb } } });

  // ---------------- constructor de hojas con formato ----------------
  function cellOf(v, s, z) {
    const c = { v: v === undefined || v === null ? '' : v, t: typeof v === 'number' ? 'n' : 's' };
    if (s) c.s = s;
    if (z) c.z = z;
    return c;
  }

  function makeSheet() {
    const cells = {};
    const merges = [];
    const rowH = {};
    let cols = [];
    let maxR = 0;
    let maxC = 0;
    const api = {
      set(r, c, v, s, z) {
        cells[XLSX.utils.encode_cell({ r, c })] = cellOf(v, s, z);
        maxR = Math.max(maxR, r);
        maxC = Math.max(maxC, c);
        return api;
      },
      merge(r1, c1, r2, c2, v, s, z) {
        for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) api.set(r, c, '', s);
        api.set(r1, c1, v, s, z);
        if (r2 > r1 || c2 > c1) merges.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
        return api;
      },
      // fondo liso (esconde las líneas de la cuadrícula)
      bg(r1, c1, r2, c2, s) {
        for (let r = r1; r <= r2; r++) {
          for (let c = c1; c <= c2; c++) {
            const a = XLSX.utils.encode_cell({ r, c });
            if (!cells[a]) api.set(r, c, '', s);
          }
        }
        return api;
      },
      height(r, h) { rowH[r] = h; return api; },
      widths(arr) { cols = arr; return api; },
      toWs() {
        const ws = Object.assign({}, cells);
        ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxR, c: maxC } });
        if (merges.length) ws['!merges'] = merges;
        if (cols.length) ws['!cols'] = cols.map((w) => ({ wch: w }));
        const rows = [];
        for (let r = 0; r <= maxR; r++) rows.push(rowH[r] ? { hpt: rowH[r] } : {});
        ws['!rows'] = rows;
        return ws;
      },
    };
    return api;
  }

  // tabla con encabezado oscuro, filas alternadas y filtro
  // defs: [{ w: ancho, z: formato, h: alineación }]; una celda puede ser { v, s: opciones de estilo, z }
  function tableSheet(headers, rows, defs) {
    const sh = makeSheet();
    const acc = accentHex();
    const hs = st({ sz: 10, bold: true, color: PAL.white, bg: PAL.ink2, h: 'center', wrap: true, border: bd('bottom', 'medium', acc) });
    headers.forEach((h, i) => sh.set(0, i, h, hs));
    sh.height(0, 30);
    const body = rows.length ? rows : [['Todavía no hay datos para mostrar.']];
    body.forEach((row, ri) => {
      const bg = ri % 2 ? PAL.zebra : PAL.white;
      row.forEach((cellVal, ci) => {
        const d = defs[ci] || {};
        const isObj = cellVal && typeof cellVal === 'object';
        const value = isObj ? cellVal.v : cellVal;
        const s = st(Object.assign({
          bg,
          h: d.h || (typeof value === 'number' ? 'right' : 'left'),
          border: bd('bottom', 'thin', PAL.line),
        }, isObj ? cellVal.s : {}));
        sh.set(ri + 1, ci, value, s, isObj && cellVal.z ? cellVal.z : d.z);
      });
    });
    sh.widths(defs.map((d) => d.w || 12));
    const ws = sh.toWs();
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(body.length, 1), c: headers.length - 1 } }) };
    return ws;
  }

  const bar = (value, max, width) => {
    if (!(value > 0) || !(max > 0)) return '';
    return '█'.repeat(Math.max(1, Math.round((value / max) * width)));
  };

  const deltaText = (cur, prev) => {
    if (prev > 0) {
      const pct = Math.round(((cur - prev) / prev) * 100);
      return { text: `${pct >= 0 ? '▲ +' : '▼ '}${pct}%`, color: pct >= 0 ? PAL.green : PAL.red };
    }
    return cur > 0 ? { text: 'Nuevo', color: PAL.green } : { text: '—', color: PAL.dim };
  };

  // ---------------- datos para los reportes ----------------
  function allSets() {
    const wl = DB.getWorkoutLog();
    const exById = {};
    DB.getExercises().forEach((e) => { exById[e.id] = e; });
    const routineById = {};
    DB.getRoutines().forEach((r) => { routineById[r.id] = r; });
    const out = [];
    Object.keys(wl).sort().forEach((date) => {
      const log = wl[date];
      (log.exercises || []).forEach((entry) => {
        const ex = exById[entry.exerciseId];
        let normalIdx = 0;
        (entry.sets || []).forEach((set) => {
          if (Metrics.isNormal(set)) normalIdx += 1;
          out.push({
            date, routine: routineById[log.routineId], ex, exerciseId: entry.exerciseId, set,
            label: Metrics.isWarmup(set) ? 'A' : Metrics.isDrop(set) ? '↓' : String(normalIdx),
          });
        });
      });
    });
    return out;
  }

  function streakWeeks() {
    let offset = 0;
    const cur = Metrics.weekRange(0);
    if (Metrics.totals(cur.start, cur.end).days === 0) offset = -1;
    let n = 0;
    for (let i = 0; i < 260; i++) {
      const r = Metrics.weekRange(offset - i);
      if (Metrics.totals(r.start, r.end).days > 0) n += 1;
      else break;
    }
    return n;
  }

  function lastDays(n) {
    const out = [];
    const t = new Date();
    for (let i = n - 1; i >= 0; i--) out.push(Utils.toISODate(new Date(t.getFullYear(), t.getMonth(), t.getDate() - i)));
    return out;
  }

  // ---------------- hoja: Resumen ----------------
  function summarySheet() {
    const settings = DB.getSettings();
    const units = Units.current();
    const goal = Metrics.weeklyGoal();
    const acc = accentHex();
    const tint = mix(acc, 0.12);
    const sh = makeSheet();
    const FIRST = 1; // columna B
    const LAST = 8;  // columna I
    sh.widths([2, 15, 15, 15, 15, 15, 15, 15, 15, 2]);
    sh.bg(0, 0, 70, 9, st({ bg: PAL.white }));

    const all = Metrics.totals('0000-01-01', '9999-12-31');
    const last30 = lastDays(30);
    const t30 = Metrics.totals(last30[0], last30[last30.length - 1]);
    const wk = Metrics.weekRange(0);
    const wkPrev = Metrics.weekRange(-1);
    const tw = Metrics.totals(wk.start, wk.end);
    const tp = Metrics.totals(wkPrev.start, wkPrev.end);
    const prCount = allSets().filter((x) => x.set.pr).length;
    const meas = DB.getMeasurements().filter((m) => m.weight !== undefined && m.weight !== null);
    const calLog = DB.getCalorieLog();
    const days7 = lastDays(7);
    const kcal7 = days7.map((d) => (calLog[d] || []).reduce((s, e) => s + (Number(e.kcal) || 0), 0)).filter((v) => v > 0);
    const kcalAvg = kcal7.length ? kcal7.reduce((a, b) => a + b, 0) / kcal7.length : 0;

    let r = 1;
    // --- portada ---
    sh.merge(r, FIRST, r, LAST, 'MiGymTrack · Resumen', st({ sz: 22, bold: true, color: PAL.white, bg: PAL.ink, indent: 1, border: bd('bottom', 'thick', acc) }));
    sh.height(r, 40);
    r += 1;
    sh.merge(r, FIRST, r, LAST, `Exportado el ${Utils.friendlyDate(Utils.todayISO())} · ${all.days} entrenos registrados`, st({ sz: 10, color: 'B8BFD2', bg: PAL.ink, indent: 1 }));
    sh.height(r, 20);
    r += 2;

    // --- tarjetas de métricas ---
    function tile(row, col, label, value, sub, z) {
      sh.merge(row, col, row, col + 1, label.toUpperCase(), st({ sz: 9, bold: true, color: PAL.dim, bg: tint, indent: 1, border: bd('top', 'medium', acc) }));
      sh.merge(row + 1, col, row + 1, col + 1, value, st({ sz: 22, bold: true, color: PAL.ink, bg: tint, indent: 1 }), z);
      sh.merge(row + 2, col, row + 2, col + 1, sub, st({ sz: 9, color: PAL.dim, bg: tint, indent: 1 }));
      sh.height(row, 18);
      sh.height(row + 1, 34);
      sh.height(row + 2, 18);
    }
    tile(r, 1, 'Entrenos', all.days, `últimos 30 días: ${t30.days}`, '#,##0');
    tile(r, 3, 'Series', all.sets, `últimos 30 días: ${t30.sets}`, '#,##0');
    tile(r, 5, `Volumen (${units})`, Math.round(Units.fromKg(all.volume)), `últimos 30 días: ${Math.round(Units.fromKg(t30.volume)).toLocaleString('es')}`, '#,##0');
    tile(r, 7, 'Récords rotos', prCount, 'series con marca nueva', '#,##0');
    r += 4;
    const firstW = meas.length ? meas[0].weight : null;
    const lastW = meas.length ? meas[meas.length - 1].weight : null;
    tile(r, 1, 'Cardio (min)', Math.round(all.minutes), `últimos 30 días: ${Math.round(t30.minutes)}`, '#,##0');
    const dW = lastW !== null ? Utils.round1(Units.fromKg(lastW) - Units.fromKg(firstW)) : 0;
    tile(r, 3, 'Peso actual', lastW !== null ? `${Units.num(lastW)} ${units}` : '—',
      lastW !== null && meas.length > 1 ? `${dW >= 0 ? '+' : ''}${dW} ${units} desde el inicio` : 'sin registros');
    const streak = streakWeeks();
    tile(r, 5, 'Racha', `${streak} sem`, 'semanas seguidas entrenando');
    tile(r, 7, 'Calorías / día', kcalAvg ? Math.round(kcalAvg) : '—', `meta ${settings.calorieGoal} kcal · últimos 7 días`, '#,##0');
    r += 4;

    // --- encabezados de sección / tabla ---
    function section(row, title, note) {
      sh.merge(row, FIRST, row, LAST, note ? `${title}   ·   ${note}` : title, st({ sz: 13, bold: true, color: PAL.ink, border: bd('bottom', 'medium', acc) }));
      sh.height(row, 26);
    }
    const hs = st({ sz: 10, bold: true, color: PAL.white, bg: PAL.ink2, h: 'center', border: bd('bottom', 'medium', acc) });
    function head(row, labels, spans) {
      let c = FIRST;
      labels.forEach((l, i) => {
        const span = spans && spans[i] ? spans[i] : 1;
        if (span > 1) sh.merge(row, c, row, c + span - 1, l, hs);
        else sh.set(row, c, l, hs);
        c += span;
      });
      sh.height(row, 22);
    }
    const body = (ri, extra) => st(Object.assign({ bg: ri % 2 ? PAL.zebra : PAL.white, border: bd('bottom', 'thin', PAL.line) }, extra));

    // --- esta semana vs la anterior ---
    section(r, 'Esta semana vs. la anterior');
    r += 1;
    head(r, ['Métrica', 'Esta semana', 'Anterior', 'Cambio']);
    r += 1;
    [
      ['Entrenos', tw.days, tp.days],
      ['Series', tw.sets, tp.sets],
      [`Volumen (${units})`, Math.round(Units.fromKg(tw.volume)), Math.round(Units.fromKg(tp.volume))],
      ['Cardio (min)', Math.round(tw.minutes), Math.round(tp.minutes)],
    ].forEach((row, i) => {
      const d = deltaText(row[1], row[2]);
      sh.set(r, 1, row[0], body(i, { bold: true }));
      sh.set(r, 2, row[1], body(i, { h: 'right' }), '#,##0');
      sh.set(r, 3, row[2], body(i, { h: 'right', color: PAL.dim }), '#,##0');
      sh.set(r, 4, d.text, body(i, { h: 'center', bold: true, color: d.color }));
      r += 1;
    });
    r += 1;

    // --- volumen por semana ---
    section(r, 'Volumen por semana', 'últimas 8');
    r += 1;
    head(r, ['Semana del', `Volumen (${units})`, 'Series', 'Días', 'Gráfica'], [1, 1, 1, 1, 4]);
    r += 1;
    const weeks = Metrics.weeklySeries(8);
    const maxVol = Math.max(...weeks.map((w) => w.volume), 1);
    weeks.forEach((w, i) => {
      const isNow = i === weeks.length - 1;
      sh.set(r, 1, w.label, body(i, { bold: isNow }));
      sh.set(r, 2, Math.round(Units.fromKg(w.volume)), body(i, { h: 'right', bold: isNow }), '#,##0');
      sh.set(r, 3, w.sets, body(i, { h: 'right' }), '#,##0');
      sh.set(r, 4, w.days, body(i, { h: 'right' }));
      sh.merge(r, 5, r, 8, bar(w.volume, maxVol, 34), body(i, { sz: 10, color: isNow ? acc : mix(acc, 0.55) }));
      r += 1;
    });
    r += 1;

    // --- series por grupo muscular y semana ---
    section(r, 'Series por grupo muscular y semana', `meta ${goal.min}–${goal.max} · últimas 7`);
    r += 1;
    const w7 = Metrics.weeklySeries(7);
    head(r, ['Grupo'].concat(w7.map((w) => { const d = Utils.parseISO(w.start); return `${d.getDate()}/${d.getMonth() + 1}`; })));
    r += 1;
    const mgroups = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro']
      .filter((g) => Metrics.STRENGTH_GROUPS.includes(g) || w7.some((w) => w.byGroup[g] && w.byGroup[g].sets > 0));
    mgroups.forEach((g, i) => {
      const gc = hex6(Utils.GROUP_COLORS[g] || '#8d95a8');
      sh.set(r, 1, g.charAt(0).toUpperCase() + g.slice(1), body(i, { bold: true, color: gc }));
      w7.forEach((w, wi) => {
        const n = w.byGroup[g] ? w.byGroup[g].sets : 0;
        let bg = i % 2 ? PAL.zebra : PAL.white;
        let color = PAL.dim;
        if (n > 0 && Metrics.STRENGTH_GROUPS.includes(g)) {
          if (n < goal.min) { bg = 'FFF1CC'; color = '9A6B00'; }
          else if (n > goal.max) { bg = 'DCE6FF'; color = '2F54B8'; }
          else { bg = 'D6F5E8'; color = '0E7A52'; }
        } else if (n > 0) { bg = PAL.empty; color = PAL.text; }
        sh.set(r, 2 + wi, n || '', st({ bg, color, bold: n > 0, h: 'center', border: bd('bottom', 'thin', PAL.line) }));
      });
      r += 1;
    });
    sh.merge(r, 1, r, 8, 'Amarillo: por debajo de la meta · Verde: dentro de la meta · Azul: por encima.', st({ sz: 9, italic: true, color: PAL.dim }));
    r += 2;

    // --- series por grupo muscular ---
    section(r, 'Por grupo muscular', 'últimos 30 días');
    r += 1;
    head(r, ['Grupo', 'Series', `Volumen (${units})`, 'Cardio (min)', 'Gráfica'], [1, 1, 1, 1, 4]);
    r += 1;
    const groups = Object.keys(t30.byGroup).filter((g) => t30.byGroup[g].sets > 0).sort((a, b) => t30.byGroup[b].sets - t30.byGroup[a].sets);
    if (groups.length === 0) {
      sh.merge(r, 1, r, 8, 'Sin series registradas en los últimos 30 días.', body(0, { color: PAL.dim, italic: true }));
      r += 1;
    } else {
      const maxSets = Math.max(...groups.map((g) => t30.byGroup[g].sets));
      groups.forEach((g, i) => {
        const d = t30.byGroup[g];
        const gc = hex6(Utils.GROUP_COLORS[g] || '#8d95a8');
        sh.set(r, 1, g.charAt(0).toUpperCase() + g.slice(1), body(i, { bold: true, color: gc }));
        sh.set(r, 2, d.sets, body(i, { h: 'right' }), '#,##0');
        sh.set(r, 3, Math.round(Units.fromKg(d.volume)), body(i, { h: 'right' }), '#,##0');
        sh.set(r, 4, Math.round(d.minutes), body(i, { h: 'right' }), '#,##0');
        sh.merge(r, 5, r, 8, bar(d.sets, maxSets, 34), body(i, { sz: 10, color: gc }));
        r += 1;
      });
    }
    r += 1;

    // --- nutrición ---
    section(r, 'Nutrición', 'últimos 7 días');
    r += 1;
    head(r, ['Fecha', 'Calorías', 'Proteína (g)', 'Carbos (g)', 'Grasas (g)', 'Agua (L)', 'Gráfica'], [1, 1, 1, 1, 1, 1, 2]);
    r += 1;
    const waterLog = DB.getWaterLog();
    const nutri = days7.map((d) => {
      const e = calLog[d] || [];
      const sum = (k) => e.reduce((s, x) => s + (Number(x[k]) || 0), 0);
      return { d, kcal: sum('kcal'), p: sum('protein'), c: sum('carbs'), f: sum('fat'), w: (waterLog[d] || []).reduce((s, x) => s + x.ml, 0) / 1000 };
    });
    const maxKcal = Math.max(...nutri.map((n) => n.kcal), settings.calorieGoal || 1);
    nutri.forEach((n, i) => {
      const over = n.kcal > (settings.calorieGoal || 0) * 1.1;
      sh.set(r, 1, `${dow(n.d)} ${Utils.shortDate(n.d)}`, body(i, { bold: true }));
      sh.set(r, 2, Math.round(n.kcal) || '', body(i, { h: 'right', color: over ? PAL.red : PAL.text }), '#,##0');
      sh.set(r, 3, Math.round(n.p) || '', body(i, { h: 'right' }), '#,##0');
      sh.set(r, 4, Math.round(n.c) || '', body(i, { h: 'right' }), '#,##0');
      sh.set(r, 5, Math.round(n.f) || '', body(i, { h: 'right' }), '#,##0');
      sh.set(r, 6, n.w ? Utils.round1(n.w) : '', body(i, { h: 'right' }), '0.0');
      sh.merge(r, 7, r, 8, bar(n.kcal, maxKcal, 20), body(i, { sz: 10, color: over ? PAL.red : acc }));
      r += 1;
    });
    r += 1;

    // --- cuerpo ---
    const measFields = MEAS.filter(([k]) => DB.getMeasurements().some((m) => m[k] !== undefined && m[k] !== null && m[k] !== ''));
    section(r, 'Cuerpo', 'primera vs. última medida');
    r += 1;
    head(r, ['Medida', 'Primera', 'Última', 'Cambio', 'Desde']);
    r += 1;
    if (measFields.length === 0 || DB.getMeasurements().length < 1) {
      sh.merge(r, 1, r, 8, 'Aún no hay medidas registradas.', body(0, { color: PAL.dim, italic: true }));
      r += 1;
    } else {
      const ms = DB.getMeasurements();
      measFields.forEach(([k, label], i) => {
        const pts = ms.filter((m) => m[k] !== undefined && m[k] !== null && m[k] !== '');
        const f = pts[0];
        const l = pts[pts.length - 1];
        const unit = k === 'weight' ? units : 'cm';
        const conv = (v) => (k === 'weight' ? Units.fromKg(v) : v);
        const d = Utils.round1(conv(l[k]) - conv(f[k]));
        sh.set(r, 1, label, body(i, { bold: true }));
        sh.set(r, 2, Utils.round1(conv(f[k])), body(i, { h: 'right', color: PAL.dim }), '0.0');
        sh.set(r, 3, Utils.round1(conv(l[k])), body(i, { h: 'right' }), '0.0');
        sh.set(r, 4, pts.length > 1 ? `${d > 0 ? '▲ +' : d < 0 ? '▼ ' : ''}${d} ${unit}` : '—', body(i, { h: 'center', bold: true, color: PAL.ink }));
        sh.set(r, 5, pts.length > 1 ? Utils.shortDate(f.date) : '—', body(i, { h: 'center', color: PAL.dim }));
        r += 1;
      });
    }
    r += 1;

    sh.merge(r, FIRST, r + 1, LAST, 'Las hojas "_datos_*" (ocultas) guardan la información que la app usa para restaurar todo al importar este archivo. Puedes mostrarlas con clic derecho en una pestaña, pero no cambies sus títulos.', st({ sz: 9, italic: true, color: PAL.dim, wrap: true, v: 'top' }));
    sh.height(r, 16);
    sh.height(r + 1, 16);
    return sh.toWs();
  }

  // ---------------- hoja: Entrenamientos (un renglón por serie) ----------------
  function workoutsSheet() {
    const units = Units.current();
    // días de más reciente a más antiguo; dentro de cada día, las series en su orden
    const ordered = allSets().map((x, i) => ({ x, i }))
      .sort((a, b) => (a.x.date < b.x.date ? 1 : a.x.date > b.x.date ? -1 : a.i - b.i))
      .map((o) => o.x);
    const rows = ordered.map((x) => {
      const s = x.set;
      const isCardio = !!(x.ex && x.ex.group === 'cardio');
      const warm = Metrics.isWarmup(s);
      const grey = warm ? { color: PAL.dim, italic: true } : {};
      const gc = x.ex ? hex6(Utils.GROUP_COLORS[x.ex.group] || '#8d95a8') : PAL.dim;
      const vol = Metrics.volumeOfSet(s);
      const e1 = !isCardio && Metrics.isNormal(s) ? Metrics.e1rm(s.weight, s.reps) : 0;
      return [
        { v: excelDate(x.date), s: grey, z: 'dd/mm/yyyy' },
        { v: dow(x.date), s: grey },
        { v: x.routine ? x.routine.name : 'Libre', s: grey },
        { v: x.ex ? x.ex.name : '(ejercicio eliminado)', s: Object.assign({ bold: !warm }, grey) },
        { v: x.ex ? x.ex.group : '', s: { color: gc, bold: true } },
        { v: (warm ? 'Aproximación' : Metrics.isDrop(s) ? 'Dropset' : 'Normal') + (s.uni ? ' · unilateral' : ''), s: grey },
        { v: x.label, s: Object.assign({ h: 'center' }, grey) },
        { v: s.weight !== undefined && s.weight !== null && s.weight !== '' ? Units.num(s.weight) : '', s: grey, z: '0.0' },
        { v: s.reps !== undefined && s.reps !== null && s.reps !== '' ? Number(s.reps) : '', s: grey },
        { v: s.duration !== undefined ? Number(s.duration) : '', s: grey, z: '0.0' },
        { v: s.distance ? Number(s.distance) : '', s: grey, z: '0.00' },
        { v: s.calories ? Number(s.calories) : '', s: grey },
        { v: warm ? '' : FELT[s.felt] || '', s: grey },
        { v: vol > 0 ? Math.round(Units.fromKg(vol)) : '', z: '#,##0' },
        { v: e1 > 0 ? Units.num(e1) : '', z: '0.0' },
        { v: s.pr ? `🏆 ${String(s.pr).replace(',', ' y ')}` : '', s: { bold: true, color: accentHex() } },
      ];
    });
    return tableSheet(
      ['Fecha', 'Día', 'Rutina', 'Ejercicio', 'Grupo', 'Tipo', 'Serie', `Peso (${units}, por lado si es unilateral)`, 'Reps', 'Duración (min)', 'Distancia (km)', 'Calorías', 'Sensación', `Volumen (${units})`, `1RM est. (${units})`, 'Récord'],
      rows,
      [{ w: 12 }, { w: 6, h: 'center' }, { w: 22 }, { w: 32 }, { w: 12 }, { w: 22 }, { w: 7 }, { w: 11 }, { w: 7 }, { w: 12 }, { w: 12 }, { w: 10 }, { w: 12 }, { w: 13 }, { w: 13 }, { w: 22 }],
    );
  }

  // ---------------- hoja: Récords ----------------
  function recordsSheet() {
    const units = Units.current();
    const rows = DB.getExercises()
      .map((ex) => {
        const isCardio = ex.group === 'cardio';
        return { ex, isCardio, rec: Metrics.exerciseRecords(ex.id, isCardio), sessions: Metrics.exerciseSessions(ex.id, isCardio).length };
      })
      .filter((x) => x.rec)
      .sort((a, b) => (a.ex.group === b.ex.group ? a.ex.name.localeCompare(b.ex.name) : a.ex.group.localeCompare(b.ex.group)))
      .map((x) => {
        const gc = hex6(Utils.GROUP_COLORS[x.ex.group] || '#8d95a8');
        return [
          { v: x.ex.name, s: { bold: true } },
          { v: x.ex.group, s: { color: gc, bold: true } },
          { v: Metrics.formatSet(x.rec.max.set, x.isCardio, units), s: { bold: true, color: accentHex() } },
          { v: excelDate(x.rec.max.date), z: 'dd/mm/yyyy', s: { h: 'center' } },
          { v: !x.isCardio && x.rec.e1rm > 0 ? Units.num(x.rec.e1rm) : '', z: '0.0' },
          { v: Metrics.formatSet(x.rec.min.set, x.isCardio, units), s: { color: PAL.dim } },
          { v: x.sessions },
        ];
      });
    return tableSheet(
      ['Ejercicio', 'Grupo', 'Récord', 'Fecha del récord', `1RM estimado (${units})`, 'Marca más baja', 'Sesiones'],
      rows,
      [{ w: 34 }, { w: 13 }, { w: 22 }, { w: 16, h: 'center' }, { w: 18 }, { w: 22 }, { w: 11 }],
    );
  }

  // ---------------- hoja: Constancia (mapa de calor) ----------------
  function consistencySheet() {
    const acc = accentHex();
    const WEEKS = 20;
    const sh = makeSheet();
    const widths = [2, 8];
    for (let i = 0; i < WEEKS; i++) widths.push(5.2);
    widths.push(2);
    sh.widths(widths);
    sh.bg(0, 0, 18, WEEKS + 2, st({ bg: PAL.white }));

    const startIso = Metrics.weekRange(-(WEEKS - 1)).start;
    const endIso = Metrics.weekRange(0).end;
    const counts = {};
    const wl = DB.getWorkoutLog();
    Object.keys(wl).forEach((d) => {
      if (d < startIso || d > endIso) return;
      let n = 0;
      (wl[d].exercises || []).forEach((e) => (e.sets || []).forEach((s) => { if (!Metrics.isWarmup(s)) n += 1; }));
      if (n > 0) counts[d] = n;
    });
    const trainedDays = Object.keys(counts).length;

    sh.merge(1, 1, 1, WEEKS + 1, 'Constancia · últimas 20 semanas', st({ sz: 18, bold: true, color: PAL.white, bg: PAL.ink, indent: 1, border: bd('bottom', 'thick', acc) }));
    sh.height(1, 34);
    sh.merge(2, 1, 2, WEEKS + 1, `${trainedDays} días entrenados · cada casilla es un día y el número son las series de ese día`, st({ sz: 10, color: 'B8BFD2', bg: PAL.ink, indent: 1 }));
    sh.height(2, 20);

    const base = Utils.parseISO(startIso);
    const todayIso = Utils.todayISO();
    for (let w = 0; w < WEEKS; w++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + w * 7);
      sh.set(4, 2 + w, `${d.getDate()}/${d.getMonth() + 1}`, st({ sz: 8, color: PAL.dim, h: 'center', bg: PAL.white }));
    }
    for (let dIdx = 0; dIdx < 7; dIdx++) {
      sh.set(5 + dIdx, 1, DOW[dIdx], st({ sz: 10, bold: true, color: PAL.dim, bg: PAL.white }));
      sh.height(5 + dIdx, 22);
      for (let w = 0; w < WEEKS; w++) {
        const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + w * 7 + dIdx);
        const iso = Utils.toISODate(d);
        const n = counts[iso] || 0;
        const lvl = n >= 14 ? 3 : n >= 7 ? 2 : n > 0 ? 1 : 0;
        const bg = lvl === 3 ? acc : lvl === 2 ? mix(acc, 0.6) : lvl === 1 ? mix(acc, 0.32) : (iso > todayIso ? 'F7F8FC' : PAL.empty);
        const white = { style: 'medium', color: { rgb: PAL.white } };
        sh.set(5 + dIdx, 2 + w, n || '', st({ sz: 9, bold: true, h: 'center', color: lvl === 3 ? PAL.white : PAL.ink, bg, border: { top: white, bottom: white, left: white, right: white } }));
      }
    }
    const lr = 13;
    sh.set(lr, 1, 'Menos', st({ sz: 9, color: PAL.dim, bg: PAL.white }));
    [PAL.empty, mix(acc, 0.32), mix(acc, 0.6), acc].forEach((c, i) => sh.set(lr, 2 + i, '', st({ bg: c })));
    sh.set(lr, 6, 'Más', st({ sz: 9, color: PAL.dim, bg: PAL.white }));
    return sh.toWs();
  }

  // ---------------- hoja: Medidas ----------------
  function measurementsSheet() {
    const units = Units.current();
    const ms = DB.getMeasurements();
    const fields = MEAS.filter(([k]) => ms.some((m) => m[k] !== undefined && m[k] !== null && m[k] !== ''));
    const headers = ['Fecha', 'Día'].concat(fields.map(([k, l]) => (k === 'weight' ? `${l} (${units})` : `${l} (cm)`)));
    const rows = [...ms].sort((a, b) => (a.date < b.date ? 1 : -1)).map((m) => [
      { v: excelDate(m.date), z: 'dd/mm/yyyy' },
      { v: dow(m.date), s: { h: 'center' } },
      ...fields.map(([k]) => ({ v: m[k] !== undefined && m[k] !== null ? (k === 'weight' ? Units.num(m[k]) : Number(m[k])) : '', z: '0.0', s: k === 'weight' ? { bold: true } : {} })),
    ]);
    return tableSheet(headers, rows, [{ w: 12 }, { w: 6, h: 'center' }, ...fields.map(() => ({ w: 13 }))]);
  }

  // ---------------- hojas: Nutrición y Comidas ----------------
  function nutritionSheet() {
    const settings = DB.getSettings();
    const calLog = DB.getCalorieLog();
    const waterLog = DB.getWaterLog();
    const dates = [...new Set([...Object.keys(calLog), ...Object.keys(waterLog)])].sort().reverse();
    const goal = settings.calorieGoal || 0;
    const maxKcal = Math.max(goal, ...dates.map((d) => (calLog[d] || []).reduce((s, e) => s + (Number(e.kcal) || 0), 0)), 1);
    const acc = accentHex();
    const rows = dates.map((d) => {
      const e = calLog[d] || [];
      const sum = (k) => e.reduce((s, x) => s + (Number(x[k]) || 0), 0);
      const kcal = sum('kcal');
      const pct = goal ? kcal / goal : 0;
      const over = pct > 1.1;
      return [
        { v: excelDate(d), z: 'dd/mm/yyyy' },
        { v: dow(d), s: { h: 'center' } },
        { v: Math.round(kcal) || '', z: '#,##0', s: { bold: true, color: over ? PAL.red : PAL.text } },
        { v: goal && kcal ? pct : '', z: '0%', s: { color: over ? PAL.red : PAL.dim } },
        { v: Math.round(sum('protein')) || '', z: '#,##0' },
        { v: Math.round(sum('carbs')) || '', z: '#,##0' },
        { v: Math.round(sum('fat')) || '', z: '#,##0' },
        { v: (waterLog[d] || []).length ? Utils.round1((waterLog[d] || []).reduce((s, x) => s + x.ml, 0) / 1000) : '', z: '0.0' },
        { v: bar(kcal, maxKcal, 26), s: { sz: 10, color: over ? PAL.red : acc } },
      ];
    });
    return tableSheet(
      ['Fecha', 'Día', 'Calorías', '% de la meta', 'Proteína (g)', 'Carbos (g)', 'Grasas (g)', 'Agua (L)', 'Calorías (gráfica)'],
      rows,
      [{ w: 12 }, { w: 6, h: 'center' }, { w: 11 }, { w: 13 }, { w: 13 }, { w: 12 }, { w: 12 }, { w: 10 }, { w: 34 }],
    );
  }

  function mealsSheet() {
    const MEAL = { desayuno: 'Desayuno', almuerzo: 'Almuerzo', cena: 'Cena', snack: 'Snack' };
    const calLog = DB.getCalorieLog();
    const rows = [];
    Object.keys(calLog).sort().reverse().forEach((d) => {
      [...calLog[d]].reverse().forEach((e) => rows.push([
        { v: excelDate(d), z: 'dd/mm/yyyy' },
        { v: MEAL[e.meal] || e.meal || '' },
        { v: e.foodName, s: { bold: true } },
        { v: Number(e.servings) || 1, z: '0.##' },
        { v: Math.round(Number(e.kcal) || 0), z: '#,##0', s: { bold: true } },
        { v: Utils.round1(Number(e.protein) || 0), z: '0.0' },
        { v: Utils.round1(Number(e.carbs) || 0), z: '0.0' },
        { v: Utils.round1(Number(e.fat) || 0), z: '0.0' },
      ]));
    });
    return tableSheet(
      ['Fecha', 'Comida', 'Alimento', 'Porciones', 'Calorías', 'Proteína (g)', 'Carbos (g)', 'Grasas (g)'],
      rows,
      [{ w: 12 }, { w: 13 }, { w: 32 }, { w: 11 }, { w: 11 }, { w: 13 }, { w: 12 }, { w: 12 }],
    );
  }

  // ---------------- hoja: Rutinas ----------------
  function routinesSheet() {
    const exById = {};
    DB.getExercises().forEach((e) => { exById[e.id] = e; });
    const rows = [];
    DB.getRoutines().forEach((r) => {
      const rc = hex6(r.color || '#8d95a8');
      if (r.exercises.length === 0) {
        rows.push([{ v: r.name, s: { bold: true, color: rc } }, '', 'Día de descanso', '', '', '']);
        return;
      }
      r.exercises.forEach((re, i) => {
        const ex = exById[re.exerciseId];
        rows.push([
          { v: r.name, s: { bold: true, color: rc } },
          i + 1,
          ex ? ex.name : '(eliminado)',
          { v: ex ? ex.group : '', s: { color: ex ? hex6(Utils.GROUP_COLORS[ex.group] || '#8d95a8') : PAL.dim, bold: true } },
          Number(re.targetSets) || '',
          String(re.targetReps),
        ]);
      });
    });
    return tableSheet(['Rutina', '#', 'Ejercicio', 'Grupo', 'Series', 'Reps / meta'], rows,
      [{ w: 26 }, { w: 5, h: 'center' }, { w: 34 }, { w: 13 }, { w: 9, h: 'center' }, { w: 22 }]);
  }

  // ---------------- hojas técnicas (para restaurar) ----------------
  function dataSheet(rows) {
    const ws = XLSX.utils.json_to_sheet(rows);
    if (!ws['!ref']) return ws;
    const range = XLSX.utils.decode_range(ws['!ref']);
    const widths = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      let w = 8;
      for (let r = range.s.r; r <= Math.min(range.e.r, 60); r++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (cell && cell.v !== undefined) w = Math.max(w, Math.min(40, String(cell.v).length + 2));
      }
      widths.push({ wch: w });
      const h = ws[XLSX.utils.encode_cell({ r: range.s.r, c })];
      if (h) h.s = st({ bold: true, color: PAL.white, bg: PAL.ink2 });
    }
    ws['!cols'] = widths;
    return ws;
  }

  // ---------------- exportar ----------------
  function buildWorkbook() {
    const settings = DB.getSettings();
    const exercises = DB.getExercises();
    const routines = DB.getRoutines();
    const monthlyPlans = DB.getMonthlyPlans();
    const measurements = DB.getMeasurements();
    const foods = DB.getFoods();
    const calorieLog = DB.getCalorieLog();
    const waterLog = DB.getWaterLog();
    const workoutLog = DB.getWorkoutLog();

    const wb = XLSX.utils.book_new();
    const add = (ws, name) => XLSX.utils.book_append_sheet(wb, ws, name);

    // --- hojas de reporte (visibles) ---
    add(summarySheet(), 'Resumen');
    add(workoutsSheet(), 'Entrenamientos');
    add(recordsSheet(), 'Récords');
    add(consistencySheet(), 'Constancia');
    add(measurementsSheet(), 'Medidas');
    add(nutritionSheet(), 'Nutrición');
    add(mealsSheet(), 'Comidas');
    add(routinesSheet(), 'Rutinas');

    // --- hojas técnicas (ocultas) ---
    add(dataSheet([settings]), DATA.ajustes);
    add(dataSheet(exercises), DATA.ejercicios);
    add(dataSheet(routines.map((r) => ({ id: r.id, name: r.name, color: r.color }))), DATA.rutinas);

    const rutinaExRows = [];
    routines.forEach((r) => {
      r.exercises.forEach((re, idx) => {
        rutinaExRows.push({ routineId: r.id, orden: idx, exerciseId: re.exerciseId, targetSets: re.targetSets, targetReps: re.targetReps });
      });
    });
    add(dataSheet(rutinaExRows), DATA.rutinaEjercicios);

    const planRows = [];
    Object.keys(monthlyPlans).forEach((mes) => {
      const days = monthlyPlans[mes].days || {};
      Object.keys(days).forEach((dia) => planRows.push({ mes, dia, rutinaId: days[dia] }));
    });
    add(dataSheet(planRows), DATA.planMensual);

    add(dataSheet(measurements), DATA.medidas);
    add(dataSheet(foods), DATA.alimentos);

    const calRows = [];
    Object.keys(calorieLog).forEach((date) => {
      calorieLog[date].forEach((e) => calRows.push({ date, ...e }));
    });
    add(dataSheet(calRows), DATA.calorias);

    const waterRows = [];
    Object.keys(waterLog).forEach((date) => {
      waterLog[date].forEach((e) => waterRows.push({ date, ...e }));
    });
    add(dataSheet(waterRows), DATA.agua);

    const entRows = [];
    const seriesRows = [];
    const warmupRows = [];
    Object.keys(workoutLog).forEach((date) => {
      const log = workoutLog[date];
      entRows.push({ date, routineId: log.routineId || '', notes: log.notes || '' });
      (log.exercises || []).forEach((entry, idx) => {
        if (!entry.sets || entry.sets.length === 0) {
          seriesRows.push({ date, orden: idx, exerciseId: entry.exerciseId, fromRoutine: !!entry.fromRoutine, setIndex: '' });
        } else {
          entry.sets.forEach((set, sIdx) => {
            seriesRows.push({
              date, orden: idx, exerciseId: entry.exerciseId, fromRoutine: !!entry.fromRoutine, setIndex: sIdx,
              weight: set.weight, reps: set.reps, duration: set.duration, distance: set.distance, calories: set.calories, felt: set.felt, type: set.type, pr: set.pr, uni: set.uni ? 1 : undefined,
            });
          });
        }
      });
      Object.keys(log.warmup || {}).forEach((exerciseId) => {
        warmupRows.push({ date, exerciseId, hecho: !!log.warmup[exerciseId] });
      });
    });
    add(dataSheet(entRows), DATA.entrenamientos);
    add(dataSheet(seriesRows), DATA.series);
    add(dataSheet(warmupRows), DATA.calentamiento);

    wb.Workbook = { Sheets: wb.SheetNames.map((n) => ({ Hidden: n.indexOf('_datos_') === 0 ? 1 : 0 })) };
    wb.Props = { Title: 'MiGymTrack — respaldo y reporte', Author: 'MiGymTrack', CreatedDate: new Date() };
    return wb;
  }

  function exportAll() {
    const wb = buildWorkbook();
    const data = XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
    const blob = new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    Utils.saveFile(blob, `migymtrack-reporte-${Utils.todayISO()}.xlsx`);
  }

  // ---------------- importar ----------------
  function importWorkbook(wb) {
    // los archivos nuevos traen hojas "_datos_*"; los anteriores, las hojas sin prefijo
    const isNew = wb.SheetNames.some((n) => n.indexOf('_datos_') === 0);
    const names = isNew ? DATA : LEGACY;
    const rows = (key) => {
      const ws = wb.Sheets[names[key]];
      return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
    };
    if (!wb.Sheets[names.ajustes] && !wb.Sheets[names.rutinas]) {
      throw new Error('No parece un respaldo de MiGymTrack');
    }

    // Ajustes (una sola fila, columnas = cada ajuste)
    const settings = DB.getSettings();
    const ajustesRow = rows('ajustes')[0];
    if (ajustesRow) {
      Object.keys(ajustesRow).forEach((k) => {
        let v = ajustesRow[k];
        if (v === '') v = null;
        else if (v === 'true') v = true;
        else if (v === 'false') v = false;
        else if (typeof v === 'string' && !isNaN(v)) v = Number(v);
        settings[k] = v;
      });
    }

    const exercises = rows('ejercicios').map((r) => {
      const ex = { id: String(r.id), name: r.name, group: r.group };
      if (r.unilateral === true || r.unilateral === 'true' || r.unilateral === 1 || r.unilateral === '1') ex.unilateral = true;
      return ex;
    });

    const routinesMap = {};
    rows('rutinas').forEach((r) => { routinesMap[r.id] = { id: String(r.id), name: r.name, color: r.color, exercises: [] }; });
    rows('rutinaEjercicios')
      .slice()
      .sort((a, b) => Number(a.orden) - Number(b.orden))
      .forEach((re) => {
        const r = routinesMap[re.routineId];
        if (r) r.exercises.push({ exerciseId: re.exerciseId, targetSets: num(re.targetSets) || 1, targetReps: String(re.targetReps) });
      });
    const routines = Object.values(routinesMap);

    const monthlyPlans = {};
    rows('planMensual').forEach((r) => {
      const mes = String(r.mes);
      monthlyPlans[mes] = monthlyPlans[mes] || { days: {} };
      monthlyPlans[mes].days[String(r.dia)] = r.rutinaId;
    });

    const measurements = rows('medidas').map((r) => {
      const m = { id: String(r.id), date: asISODate(r.date) };
      ['weight', 'chest', 'waist', 'hips', 'armL', 'armR', 'thighL', 'thighR', 'calfL', 'calfR', 'neck', 'arm', 'thigh', 'calf'].forEach((k) => {
        const v = num(r[k]);
        if (v !== undefined) m[k] = v;
      });
      return m;
    }).sort((a, b) => (a.date > b.date ? 1 : -1));

    const foods = rows('alimentos').map((r) => ({
      id: String(r.id), name: r.name, servingLabel: String(r.servingLabel),
      kcal: num(r.kcal) || 0, protein: num(r.protein) || 0, carbs: num(r.carbs) || 0, fat: num(r.fat) || 0,
    }));

    const calorieLog = {};
    rows('calorias').forEach((r) => {
      const date = asISODate(r.date);
      calorieLog[date] = calorieLog[date] || [];
      calorieLog[date].push({
        id: String(r.id), foodId: r.foodId ? String(r.foodId) : undefined, foodName: r.foodName,
        servings: num(r.servings) || 1, kcal: num(r.kcal) || 0, protein: num(r.protein) || 0,
        carbs: num(r.carbs) || 0, fat: num(r.fat) || 0, meal: r.meal, time: r.time,
      });
    });

    const waterLog = {};
    rows('agua').forEach((r) => {
      const date = asISODate(r.date);
      waterLog[date] = waterLog[date] || [];
      waterLog[date].push({ id: String(r.id), ml: num(r.ml) || 0, time: r.time });
    });

    const workoutLog = {};
    rows('entrenamientos').forEach((r) => {
      const date = asISODate(r.date);
      workoutLog[date] = { routineId: r.routineId || null, notes: r.notes || '', exercises: [], warmup: {} };
    });
    const exerciseEntryMap = {};
    rows('series').forEach((r) => {
      const date = asISODate(r.date);
      if (!workoutLog[date]) workoutLog[date] = { routineId: null, notes: '', exercises: [], warmup: {} };
      exerciseEntryMap[date] = exerciseEntryMap[date] || {};
      const orden = Number(r.orden) || 0;
      if (!exerciseEntryMap[date][orden]) {
        exerciseEntryMap[date][orden] = { exerciseId: r.exerciseId, fromRoutine: bool(r.fromRoutine), sets: [] };
      }
      if (r.setIndex !== '' && r.setIndex !== undefined) {
        const set = { felt: r.felt || 'normal' };
        if (r.type === 'warmup' || r.type === 'drop') set.type = r.type;
        if (r.pr) set.pr = String(r.pr);
        if (r.uni === 1 || r.uni === '1' || r.uni === true) set.uni = true;
        if (r.duration !== undefined && r.duration !== '') {
          set.duration = num(r.duration);
          if (r.distance !== '') set.distance = num(r.distance);
          if (r.calories !== '') set.calories = num(r.calories);
        } else {
          set.weight = num(r.weight);
          set.reps = num(r.reps);
        }
        exerciseEntryMap[date][orden].sets.push(set);
      }
    });
    Object.keys(exerciseEntryMap).forEach((date) => {
      const ordenes = Object.keys(exerciseEntryMap[date]).map(Number).sort((a, b) => a - b);
      workoutLog[date].exercises = ordenes.map((o) => exerciseEntryMap[date][o]);
    });
    rows('calentamiento').forEach((r) => {
      const date = asISODate(r.date);
      if (!workoutLog[date]) workoutLog[date] = { routineId: null, notes: '', exercises: [], warmup: {} };
      workoutLog[date].warmup = workoutLog[date].warmup || {};
      workoutLog[date].warmup[r.exerciseId] = bool(r.hecho);
    });

    DB.saveSettings(settings);
    if (exercises.length) DB.saveExercises(exercises);
    if (routines.length) DB.saveRoutines(routines);
    DB.saveMonthlyPlans(monthlyPlans);
    DB.saveMeasurements(measurements);
    if (foods.length) DB.saveFoods(foods);
    DB.saveCalorieLog(calorieLog);
    DB.saveWaterLog(waterLog);
    DB.saveWorkoutLog(workoutLog);
    DB.migrateWeightUnits();
  }

  function importFile(file, onDone, onError) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = new Uint8Array(reader.result);
        const wb = XLSX.read(data, { type: 'array' });
        importWorkbook(wb);
        onDone();
      } catch (e) {
        console.error('Error importando Excel', e);
        onError(e);
      }
    };
    reader.onerror = () => onError(new Error('No se pudo leer el archivo'));
    reader.readAsArrayBuffer(file);
  }

  return { exportAll, importFile, buildWorkbook };
})();
