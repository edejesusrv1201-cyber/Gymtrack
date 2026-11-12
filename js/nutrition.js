/* ============================================================
   nutrition.js — Cálculo de gasto calórico (BMR/TDEE) y de los
   5 escenarios de dieta (déficit/mantenimiento/superávit)
   ============================================================ */

const Nutrition = (() => {
  const ACTIVITY_MULTIPLIERS = {
    sedentario: { label: 'Sedentario (poco o nada de ejercicio)', value: 1.2 },
    ligero: { label: 'Ligero (activo o entrena 1-3 días/semana)', value: 1.375 },
    moderado: { label: 'Moderado (activo o entrena 3-5 días/semana)', value: 1.55 },
    activo: { label: 'Activo (entrena 6-7 días/semana / trabajo de pie)', value: 1.725 },
    muy_activo: { label: 'Muy activo (entrenamiento intenso + trabajo físico duro)', value: 1.9 },
  };

  // Mifflin-St Jeor
  function bmr({ sex, weightKg, heightCm, age }) {
    const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
    return sex === 'F' ? base - 161 : base + 5;
  }

  function tdee(bmrValue, activityLevel) {
    const mult = (ACTIVITY_MULTIPLIERS[activityLevel] || ACTIVITY_MULTIPLIERS.moderado).value;
    return bmrValue * mult;
  }

  const SCENARIOS = [
    { key: 'deficit_agresivo', label: 'Déficit agresivo', pct: -0.25, note: 'Pérdida de grasa rápida. Sostenible solo unas semanas, cuidando bien la proteína.' },
    { key: 'mini_deficit', label: 'Mini déficit', pct: -0.12, note: 'Pérdida de grasa lenta y sostenible, minimiza pérdida de músculo.' },
    { key: 'mantenimiento', label: 'Mantenimiento', pct: 0, note: 'Para mantener tu peso y composición actuales.' },
    { key: 'mini_superavit', label: 'Mini superávit ("lean bulk")', pct: 0.12, note: 'Ganancia muscular limpia, con poca grasa de más.' },
    { key: 'superavit_agresivo', label: 'Superávit agresivo', pct: 0.22, note: 'Ganancia de masa más rápida, pero con más grasa corporal acompañando.' },
  ];

  function buildPlan(tdeeValue, weightKg, { proteinPerKg = 2.0, fatPct = 0.25 } = {}) {
    const protein = Math.round(proteinPerKg * weightKg);
    const proteinKcal = protein * 4;
    return SCENARIOS.map((s) => {
      const kcal = Math.round(tdeeValue * (1 + s.pct));
      const fat = Math.round((kcal * fatPct) / 9);
      const carbsKcal = Math.max(0, kcal - proteinKcal - fat * 9);
      const carbs = Math.round(carbsKcal / 4);
      const weeklyDeltaKg = Utils.round1(((kcal - tdeeValue) * 7) / 7700);
      return { ...s, kcal, protein, fat, carbs, weeklyDeltaKg };
    });
  }

  // Mantenimiento REAL estimado a partir de lo que comiste y cómo cambió tu peso (últimos `windowDays` días).
  //   gasto ≈ calorías promedio − (cambio de peso por día × 7700 kcal/kg)
  // Devuelve null si todavía no hay datos suficientes.
  function adaptiveTdee(windowDays = 28) {
    const cal = DB.getCalorieLog();
    const end = new Date();
    const days = [];
    for (let i = 0; i < windowDays; i++) {
      const d = new Date(end.getFullYear(), end.getMonth(), end.getDate() - i);
      days.push(Utils.toISODate(d));
    }
    // solo días con registro "completo" (más de 800 kcal), para no contar días a medias
    const logged = days.map((iso) => (cal[iso] || []).reduce((s, e) => s + (e.kcal || 0), 0)).filter((k) => k >= 800);
    if (logged.length < 7) return { ok: false, reason: `Registra tus comidas al menos 7 días (llevas ${logged.length}).` };
    const avgKcal = logged.reduce((s, k) => s + k, 0) / logged.length;

    const since = days[days.length - 1];
    const points = DB.getMeasurements().filter((m) => m.weight && m.date >= since)
      .map((m) => ({ t: Utils.parseISO(m.date).getTime() / 86400000, w: Number(m.weight) }));
    if (points.length < 2) return { ok: false, reason: 'Necesito al menos 2 pesajes en las últimas 4 semanas (Progreso → Cuerpo).' };
    const span = Math.max(...points.map((p) => p.t)) - Math.min(...points.map((p) => p.t));
    if (span < 7) return { ok: false, reason: 'Tus pesajes deben cubrir al menos 7 días.' };

    // pendiente por mínimos cuadrados (kg por día)
    const n = points.length;
    const mt = points.reduce((s, p) => s + p.t, 0) / n;
    const mw = points.reduce((s, p) => s + p.w, 0) / n;
    const num = points.reduce((s, p) => s + (p.t - mt) * (p.w - mw), 0);
    const den = points.reduce((s, p) => s + (p.t - mt) ** 2, 0) || 1;
    const slope = num / den;
    const tdee = Math.round(avgKcal - slope * 7700);
    return { ok: true, tdee, avgKcal: Math.round(avgKcal), loggedDays: logged.length, slopeKgWeek: Utils.round1(slope * 7), weighIns: n };
  }

  // ---------- Ajuste automático de calorías ----------
  // Compara cómo cambia tu peso con lo que querías lograr (perder, mantener o ganar)
  // y te propone una meta de calorías nueva, con cambios graduales (unas 250 kcal como máximo a la vez).
  const AUTO_MODES = {
    perder: { label: 'Perder grasa', rates: [-0.25, -0.5, -0.75], def: -0.5 },
    mantener: { label: 'Mantener', rates: [0], def: 0 },
    ganar: { label: 'Ganar músculo', rates: [0.15, 0.25, 0.5], def: 0.25 },
  };
  function autoConfig() {
    const a = DB.getSettings().autoKcal || {};
    const mode = AUTO_MODES[a.mode] ? a.mode : 'mantener';
    const rate = typeof a.rate === 'number' && AUTO_MODES[mode].rates.includes(a.rate) ? a.rate : AUTO_MODES[mode].def;
    return { mode, rate, snoozeUntil: a.snoozeUntil || null, lastApplied: a.lastApplied || null };
  }
  function saveAuto(patch) {
    const s = DB.getSettings();
    s.autoKcal = Object.assign({}, autoConfig(), patch);
    DB.saveSettings(s);
  }
  const round25 = (n) => Math.round(n / 25) * 25;
  function suggestGoal() {
    const cfg = autoConfig();
    const s = DB.getSettings();
    const cur = Number(s.calorieGoal) || 0;
    const t = adaptiveTdee(21);
    if (!t.ok) return { ok: false, reason: t.reason, cfg };
    const floor = s.sex === 'F' ? 1200 : 1500;
    const target = t.tdee + (cfg.rate * 7700) / 7;
    let rec = Math.max(floor, Math.min(t.tdee + 1000, target));
    if (cur > 0) {
      const delta = rec - cur;
      if (Math.abs(delta) > 250) rec = cur + Math.sign(delta) * 250;
    }
    rec = round25(rec);
    return {
      ok: true, cfg, tdee: t.tdee, current: cur, recommended: rec, diff: cur ? rec - cur : 0,
      slopeKgWeek: t.slopeKgWeek, avgKcal: t.avgKcal, loggedDays: t.loggedDays, weighIns: t.weighIns,
      onTrack: Math.abs(t.slopeKgWeek - cfg.rate) <= 0.15,
    };
  }
  // aplica la meta nueva y reparte los macros (proteína se mantiene, grasas 25 %, resto carbos)
  function applyGoal(kcal) {
    const s = DB.getSettings();
    const prev = s.calorieGoal;
    s.calorieGoal = kcal;
    const p = Number(s.proteinGoal) || Math.round((kcal * 0.25) / 4);
    const f = Math.round((kcal * 0.25) / 9);
    s.proteinGoal = p;
    s.fatGoal = f;
    s.carbGoal = Math.max(0, Math.round((kcal - p * 4 - f * 9) / 4));
    s.autoKcal = Object.assign({}, autoConfig(), { lastApplied: { date: Utils.todayISO(), from: prev, to: kcal }, snoozeUntil: null });
    DB.saveSettings(s);
  }

  return { ACTIVITY_MULTIPLIERS, bmr, tdee, buildPlan, SCENARIOS, adaptiveTdee, AUTO_MODES, autoConfig, saveAuto, suggestGoal, applyGoal };
})();
