/* ============================================================
   metrics.js — Cálculos sobre el historial de entrenamientos.

   Tipos de serie (set.type):
   - sin tipo / 'normal' : serie efectiva (cuenta para la meta y récords)
   - 'warmup'            : aproximación (no cuenta para meta, volumen ni récords)
   - 'drop'              : dropset (suma al volumen, no cuenta para meta ni récords)
   ============================================================ */

const Metrics = (() => {
  const isWarmup = (s) => s.type === 'warmup';
  const isDrop = (s) => s.type === 'drop';
  const isNormal = (s) => !s.type || s.type === 'normal';

  function volumeOfSet(s) {
    if (isWarmup(s)) return 0;
    if (s.weight === undefined || s.weight === null) return 0;
    return (Number(s.weight) || 0) * (Number(s.reps) || 0);
  }

  // 1RM estimado (Epley)
  function e1rm(weight, reps) {
    const w = Number(weight) || 0;
    const r = Number(reps) || 0;
    if (w <= 0 || r <= 0) return 0;
    return r === 1 ? w : w * (1 + r / 30);
  }

  function exerciseMap() {
    const byId = {};
    DB.getExercises().forEach((e) => { byId[e.id] = e; });
    return byId;
  }

  // ---------- rangos de fechas (semana empieza en domingo, como el resto de la app) ----------
  function weekRange(offset = 0, ref = new Date()) {
    const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - ref.getDay() + offset * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: Utils.toISODate(start), end: Utils.toISODate(end) };
  }

  function monthRange(offset = 0, ref = new Date()) {
    const start = new Date(ref.getFullYear(), ref.getMonth() + offset, 1);
    const end = new Date(ref.getFullYear(), ref.getMonth() + offset + 1, 0);
    return { start: Utils.toISODate(start), end: Utils.toISODate(end) };
  }

  // ---------- totales de un período ----------
  function totals(startIso, endIso) {
    const wl = DB.getWorkoutLog();
    const byId = exerciseMap();
    const out = { days: 0, sets: 0, volume: 0, minutes: 0, byGroup: {} };
    Object.keys(wl).forEach((d) => {
      if (d < startIso || d > endIso) return;
      let trained = false;
      (wl[d].exercises || []).forEach((entry) => {
        const ex = byId[entry.exerciseId];
        const group = ex ? ex.group : 'otro';
        (entry.sets || []).forEach((set) => {
          if (isWarmup(set)) return;
          trained = true;
          const g = out.byGroup[group] = out.byGroup[group] || { sets: 0, volume: 0, minutes: 0 };
          g.sets += 1;
          out.sets += 1;
          const v = volumeOfSet(set);
          g.volume += v;
          out.volume += v;
          if (set.duration !== undefined) {
            const m = Number(set.duration) || 0;
            g.minutes += m;
            out.minutes += m;
          }
        });
      });
      if (trained) out.days += 1;
    });
    return out;
  }

  // últimas n semanas (la última es la actual)
  function weeklySeries(n) {
    const rows = [];
    for (let i = n - 1; i >= 0; i--) {
      const r = weekRange(-i);
      const t = totals(r.start, r.end);
      rows.push({ start: r.start, end: r.end, label: Utils.shortDate(r.start), ...t });
    }
    return rows;
  }

  // intensidad por día para el mapa de calor: 0 = nada, 1..3
  function dayLevels(startIso, endIso) {
    const wl = DB.getWorkoutLog();
    const result = {};
    Object.keys(wl).forEach((d) => {
      if (d < startIso || d > endIso) return;
      let sets = 0;
      (wl[d].exercises || []).forEach((entry) => {
        (entry.sets || []).forEach((s) => { if (!isWarmup(s)) sets += 1; });
      });
      if (sets > 0) result[d] = sets >= 14 ? 3 : sets >= 7 ? 2 : 1;
    });
    return result;
  }

  // ---------- por ejercicio ----------
  // una fila por día con series: mejor peso, 1RM, volumen... (cardio: duración/distancia)
  function exerciseSessions(exerciseId, isCardio) {
    const wl = DB.getWorkoutLog();
    const rows = [];
    Object.keys(wl).sort().forEach((d) => {
      const entry = (wl[d].exercises || []).find((e) => e.exerciseId === exerciseId);
      if (!entry || !entry.sets || entry.sets.length === 0) return;
      if (isCardio) {
        const best = entry.sets.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a), entry.sets[0]);
        rows.push({
          date: d,
          duration: best.duration || 0,
          distance: entry.sets.reduce((s, x) => s + (Number(x.distance) || 0), 0),
          sets: entry.sets.length,
        });
        return;
      }
      const work = entry.sets.filter(isNormal);
      if (work.length === 0) return;
      const top = work.reduce((a, b) => ((Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a), work[0]);
      rows.push({
        date: d,
        weight: Number(top.weight) || 0,
        reps: Number(top.reps) || 0,
        e1rm: Math.max(...work.map((s) => e1rm(s.weight, s.reps))),
        volume: entry.sets.reduce((s, x) => s + volumeOfSet(x), 0),
        sets: work.length,
      });
    });
    return rows;
  }

  // récord (máx. y mín. peso en series efectivas) + mejor 1RM estimado
  function exerciseRecords(exerciseId, isCardio) {
    const wl = DB.getWorkoutLog();
    let max = null;
    let min = null;
    let bestE1rm = 0;
    Object.keys(wl).forEach((d) => {
      const entry = (wl[d].exercises || []).find((e) => e.exerciseId === exerciseId);
      if (!entry) return;
      entry.sets.forEach((set) => {
        if (!isCardio && !isNormal(set)) return;
        const value = isCardio ? set.duration : set.weight;
        if (value === undefined || value === null) return;
        if (!max || value > (isCardio ? max.set.duration : max.set.weight)) max = { set, date: d };
        if (!min || value < (isCardio ? min.set.duration : min.set.weight)) min = { set, date: d };
        if (!isCardio) bestE1rm = Math.max(bestE1rm, e1rm(set.weight, set.reps));
      });
    });
    if (!max) return null;
    return { max, min, e1rm: bestE1rm };
  }

  function formatSet(set, isCardio, units) {
    return isCardio
      ? `${set.duration} min${set.distance ? ` · ${set.distance} km` : ''}`
      : `${set.weight}${units} × ${set.reps}`;
  }

  // última sesión anterior a una fecha (para "Última vez")
  function previousBest(exerciseId, beforeIso, isCardio) {
    const wl = DB.getWorkoutLog();
    const dates = Object.keys(wl).filter((d) => d < beforeIso).sort((a, b) => (a < b ? 1 : -1));
    for (const d of dates) {
      const entry = (wl[d].exercises || []).find((e) => e.exerciseId === exerciseId);
      if (!entry) continue;
      const pool = isCardio ? entry.sets : entry.sets.filter(isNormal);
      if (pool.length === 0) continue;
      const best = isCardio
        ? pool.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a), pool[0])
        : pool.reduce((a, b) => ((Number(b.weight) || 0) > (Number(a.weight) || 0) ? b : a), pool[0]);
      return { date: d, best, count: pool.length };
    }
    return null;
  }

  return {
    isWarmup, isDrop, isNormal, volumeOfSet, e1rm,
    weekRange, monthRange, totals, weeklySeries, dayLevels,
    exerciseSessions, exerciseRecords, formatSet, previousBest,
  };
})();
