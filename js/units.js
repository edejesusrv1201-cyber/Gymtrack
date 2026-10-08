/* ============================================================
   units.js — Unidades de peso (kg / lb).

   Todos los pesos se GUARDAN en kg (series, peso corporal). Al
   escribirlos puedes usar kg o lb (cada máquina es distinta) y la
   unidad elegida en Más > Ajustes decide cómo se MUESTRAN.
   ============================================================ */

const Units = (() => {
  const KG_PER_LB = 0.45359237;

  const current = () => (DB.getSettings().units === 'lb' ? 'lb' : 'kg');

  // valor escrito en `unit` -> kg
  const toKg = (value, unit) => {
    const v = Number(value) || 0;
    return unit === 'lb' ? Math.round(v * KG_PER_LB * 10000) / 10000 : v;
  };

  // kg -> número en `unit` (por defecto, la unidad elegida para ver)
  const fromKg = (kg, unit) => {
    const v = Number(kg) || 0;
    return (unit || current()) === 'lb' ? v / KG_PER_LB : v;
  };

  // número redondeado a 1 decimal, listo para mostrar
  const num = (kg, unit) => Math.round(fromKg(kg, unit) * 10) / 10;

  // "62.5kg" / "135lb"
  const label = (kg, unit) => `${num(kg, unit)}${unit || current()}`;

  // saltos "redondos" para las sugerencias de peso en cada unidad
  const step = (unit, big) => (unit === 'lb' ? (big ? 5 : 1) : (big ? 2.5 : 0.5));

  // unidad con la que se escribe el peso de un ejercicio (se recuerda por ejercicio)
  const inputUnitFor = (exerciseId) => {
    const s = DB.getSettings();
    const u = s.exerciseUnits && s.exerciseUnits[exerciseId];
    return u === 'lb' || u === 'kg' ? u : current();
  };

  const rememberInputUnit = (exerciseId, unit) => {
    const s = DB.getSettings();
    s.exerciseUnits = s.exerciseUnits || {};
    s.exerciseUnits[exerciseId] = unit;
    DB.saveSettings(s);
  };

  return { KG_PER_LB, current, toKg, fromKg, num, label, step, inputUnitFor, rememberInputUnit };
})();
