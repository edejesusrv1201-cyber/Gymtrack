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

  return { ACTIVITY_MULTIPLIERS, bmr, tdee, buildPlan, SCENARIOS, adaptiveTdee };
})();
