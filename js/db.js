/* ============================================================
   db.js — Capa de datos (localStorage)
   Toda la app guarda su información en el navegador del celular.
   No se necesita internet ni servidor.

   Claves usadas en localStorage:
   - gt_settings       -> configuración general
   - gt_measurements   -> [] medidas corporales
   - gt_foods          -> [] alimentos guardados (base personal)
   - gt_calorieLog     -> { 'YYYY-MM-DD': [entradas] }
   - gt_exercises      -> [] ejercicios (catálogo)
   - gt_routines       -> [] rutinas (Push, Pull, Legs, Descanso...)
   - gt_monthlyPlans   -> { 'YYYY-MM': { days: { '1': routineId, ... } } }
   - gt_workoutLog     -> { 'YYYY-MM-DD': { routineId, exercises:[...], notes } }
   - gt_waterLog       -> { 'YYYY-MM-DD': [{id, ml, time}] }
   ============================================================ */

const DB = (() => {
  const KEYS = {
    settings: 'gt_settings',
    measurements: 'gt_measurements',
    foods: 'gt_foods',
    calorieLog: 'gt_calorieLog',
    exercises: 'gt_exercises',
    routines: 'gt_routines',
    monthlyPlans: 'gt_monthlyPlans',
    workoutLog: 'gt_workoutLog',
    waterLog: 'gt_waterLog',
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return fallback;
      return JSON.parse(raw);
    } catch (e) {
      console.error('Error leyendo', key, e);
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      console.error('Error guardando', key, e);
      alert('No se pudo guardar. Puede que el almacenamiento esté lleno.');
      return false;
    }
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ---- Defaults / seed data (solo la primera vez) ----
  const DEFAULT_SETTINGS = {
    units: 'kg',
    restDefault: 90, // segundos
    calorieGoal: 2500,
    proteinGoal: 160,
    carbGoal: 280,
    fatGoal: 70,
    waterGoalMl: 2500,
    onboarded: false,
    // perfil para la calculadora de mantenimiento (Nutrition)
    calcWeightKg: null,
    heightCm: null,
    age: null,
    sex: 'M',
    activityLevel: 'moderado',
    lastCalcGoalKey: null,
  };

  const DEFAULT_EXERCISES = [
    { id: 'ex_press_banca', name: 'Press de banca', group: 'pecho' },
    { id: 'ex_press_inclinado', name: 'Press inclinado con mancuernas', group: 'pecho' },
    { id: 'ex_aperturas', name: 'Aperturas con mancuerna', group: 'pecho' },
    { id: 'ex_dominadas', name: 'Dominadas', group: 'espalda' },
    { id: 'ex_remo_barra', name: 'Remo con barra', group: 'espalda' },
    { id: 'ex_jalon_pecho', name: 'Jalón al pecho', group: 'espalda' },
    { id: 'ex_peso_muerto', name: 'Peso muerto', group: 'espalda' },
    { id: 'ex_sentadilla', name: 'Sentadilla', group: 'pierna' },
    { id: 'ex_prensa', name: 'Prensa de pierna', group: 'pierna' },
    { id: 'ex_zancadas', name: 'Zancadas', group: 'pierna' },
    { id: 'ex_curl_femoral', name: 'Curl femoral', group: 'pierna' },
    { id: 'ex_press_militar', name: 'Press militar', group: 'hombro' },
    { id: 'ex_elevaciones_laterales', name: 'Elevaciones laterales', group: 'hombro' },
    { id: 'ex_curl_biceps', name: 'Curl de bíceps', group: 'brazo' },
    { id: 'ex_press_frances', name: 'Press francés', group: 'brazo' },
    { id: 'ex_extension_triceps', name: 'Extensión de tríceps en polea', group: 'brazo' },
    { id: 'ex_plancha', name: 'Plancha', group: 'core' },
    { id: 'ex_abdominales', name: 'Abdominales', group: 'core' },
    { id: 'ex_elevacion_piernas', name: 'Elevación de piernas colgado', group: 'core' },
    { id: 'ex_elevacion_talones', name: 'Elevación de talones (gemelos)', group: 'pierna' },
    { id: 'ex_caminadora', name: 'Caminadora / trote', group: 'cardio' },
    { id: 'ex_carrera_larga', name: 'Carrera larga / fondo', group: 'cardio' },
    { id: 'ex_mov_circulos_brazos', name: 'Círculos de brazos', group: 'movilidad' },
    { id: 'ex_mov_balanceo_piernas', name: 'Balanceo de piernas (adelante/atrás y lateral)', group: 'movilidad' },
    { id: 'ex_mov_sentadilla_cw', name: 'Sentadilla con peso corporal', group: 'movilidad' },
    { id: 'ex_mov_zancada_giro', name: 'Zancada caminando con giro de tronco', group: 'movilidad' },
    { id: 'ex_mov_cadera_90_90', name: 'Movilidad de cadera 90/90', group: 'movilidad' },
    { id: 'ex_mov_gato_camello', name: 'Gato-camello', group: 'movilidad' },
    { id: 'ex_mov_tobillo', name: 'Movilidad de tobillo', group: 'movilidad' },
    { id: 'ex_mov_hombro_palo', name: 'Rotación de hombros con palo/banda', group: 'movilidad' },
  ];

  const DEFAULT_ROUTINES = [
    {
      id: 'rt_push',
      name: 'Push (Empuje)',
      color: '#e0663d',
      exercises: [
        { exerciseId: 'ex_press_banca', targetSets: 4, targetReps: '8-10' },
        { exerciseId: 'ex_press_inclinado', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_press_militar', targetSets: 3, targetReps: '8-10' },
        { exerciseId: 'ex_elevaciones_laterales', targetSets: 3, targetReps: '12-15' },
        { exerciseId: 'ex_press_frances', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_plancha', targetSets: 3, targetReps: '40-60 seg' },
      ],
    },
    {
      id: 'rt_pull',
      name: 'Pull (Jalón)',
      color: '#3d8de0',
      exercises: [
        { exerciseId: 'ex_dominadas', targetSets: 4, targetReps: 'al fallo' },
        { exerciseId: 'ex_remo_barra', targetSets: 4, targetReps: '8-10' },
        { exerciseId: 'ex_jalon_pecho', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_curl_biceps', targetSets: 3, targetReps: '10-12' },
      ],
    },
    {
      id: 'rt_legs',
      name: 'Piernas',
      color: '#5fbf6f',
      exercises: [
        { exerciseId: 'ex_sentadilla', targetSets: 4, targetReps: '8-10' },
        { exerciseId: 'ex_prensa', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_zancadas', targetSets: 3, targetReps: '12 c/pierna' },
        { exerciseId: 'ex_curl_femoral', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_abdominales', targetSets: 3, targetReps: '15-20' },
      ],
    },
    {
      id: 'rt_descanso',
      name: 'Descanso',
      color: '#7a7a85',
      exercises: [],
    },
    {
      id: 'rt_upper',
      name: 'Upper (Tren superior)',
      color: '#c26fe0',
      exercises: [
        { exerciseId: 'ex_press_militar', targetSets: 3, targetReps: '8-10' },
        { exerciseId: 'ex_remo_barra', targetSets: 4, targetReps: '8-10' },
        { exerciseId: 'ex_press_inclinado', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_jalon_pecho', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_curl_biceps', targetSets: 2, targetReps: '10-12' },
        { exerciseId: 'ex_extension_triceps', targetSets: 2, targetReps: '10-12' },
        { exerciseId: 'ex_elevacion_piernas', targetSets: 3, targetReps: '12-15' },
      ],
    },
    {
      id: 'rt_lower',
      name: 'Lower (Tren inferior)',
      color: '#e0c23d',
      exercises: [
        { exerciseId: 'ex_sentadilla', targetSets: 4, targetReps: '8-10' },
        { exerciseId: 'ex_curl_femoral', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_zancadas', targetSets: 3, targetReps: '12 c/pierna' },
        { exerciseId: 'ex_prensa', targetSets: 3, targetReps: '10-12' },
        { exerciseId: 'ex_elevacion_talones', targetSets: 3, targetReps: '15-20' },
      ],
    },
    {
      id: 'rt_cardio_ligero',
      name: 'Cardio ligero',
      color: '#3de0c2',
      exercises: [
        { exerciseId: 'ex_caminadora', targetSets: 1, targetReps: '20-30 min ritmo suave' },
      ],
    },
    {
      id: 'rt_tanda_larga',
      name: 'Tanda larga (cada 15 días)',
      color: '#e05a5a',
      exercises: [
        { exerciseId: 'ex_carrera_larga', targetSets: 1, targetReps: '45-60+ min ritmo constante' },
      ],
    },
  ];

  function ensureSeed() {
    if (read(KEYS.settings, null) === null) write(KEYS.settings, DEFAULT_SETTINGS);
    if (read(KEYS.exercises, null) === null) write(KEYS.exercises, DEFAULT_EXERCISES);
    if (read(KEYS.routines, null) === null) write(KEYS.routines, DEFAULT_ROUTINES);
    if (read(KEYS.foods, null) === null) write(KEYS.foods, []);
    if (read(KEYS.measurements, null) === null) write(KEYS.measurements, []);
    if (read(KEYS.calorieLog, null) === null) write(KEYS.calorieLog, {});
    if (read(KEYS.monthlyPlans, null) === null) write(KEYS.monthlyPlans, {});
    if (read(KEYS.workoutLog, null) === null) write(KEYS.workoutLog, {});
    if (read(KEYS.waterLog, null) === null) write(KEYS.waterLog, {});
  }

  return {
    KEYS, read, write, uid, ensureSeed,
    // Settings
    getSettings: () => read(KEYS.settings, DEFAULT_SETTINGS),
    saveSettings: (s) => write(KEYS.settings, s),
    // Measurements
    getMeasurements: () => read(KEYS.measurements, []),
    saveMeasurements: (arr) => write(KEYS.measurements, arr),
    // Foods
    getFoods: () => read(KEYS.foods, []),
    saveFoods: (arr) => write(KEYS.foods, arr),
    // Calorie log
    getCalorieLog: () => read(KEYS.calorieLog, {}),
    saveCalorieLog: (obj) => write(KEYS.calorieLog, obj),
    // Exercises
    getExercises: () => read(KEYS.exercises, []),
    saveExercises: (arr) => write(KEYS.exercises, arr),
    // Routines
    getRoutines: () => read(KEYS.routines, []),
    saveRoutines: (arr) => write(KEYS.routines, arr),
    // Monthly plans
    getMonthlyPlans: () => read(KEYS.monthlyPlans, {}),
    saveMonthlyPlans: (obj) => write(KEYS.monthlyPlans, obj),
    // Workout log
    getWorkoutLog: () => read(KEYS.workoutLog, {}),
    saveWorkoutLog: (obj) => write(KEYS.workoutLog, obj),
    // Water log
    getWaterLog: () => read(KEYS.waterLog, {}),
    saveWaterLog: (obj) => write(KEYS.waterLog, obj),

    // Export / import (backup completo)
    exportAll() {
      const data = {};
      Object.values(KEYS).forEach((k) => { data[k] = read(k, null); });
      data.__exportedAt = new Date().toISOString();
      data.__version = 1;
      return data;
    },
    importAll(data) {
      Object.values(KEYS).forEach((k) => {
        if (data[k] !== undefined) write(k, data[k]);
      });
    },
    wipeAll() {
      Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
    },
  };
})();
