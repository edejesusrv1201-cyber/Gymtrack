/* ============================================================
   excelBackup.js — Exportar/importar TODOS los datos como un
   archivo Excel (.xlsx) real, con una hoja por tipo de dato.
   Pensado para mover tu historial completo a otro celular, igual
   que el respaldo .json pero en un formato que se abre en Excel.
   ============================================================ */

const ExcelBackup = (() => {
  const SHEETS = {
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

  // ---------------- exportar ----------------

  function exportAll() {
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
    const add = (rows, name) => XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), name);

    add([settings], SHEETS.ajustes);
    add(exercises, SHEETS.ejercicios);
    add(routines.map((r) => ({ id: r.id, name: r.name, color: r.color })), SHEETS.rutinas);

    const rutinaExRows = [];
    routines.forEach((r) => {
      r.exercises.forEach((re, idx) => {
        rutinaExRows.push({ routineId: r.id, orden: idx, exerciseId: re.exerciseId, targetSets: re.targetSets, targetReps: re.targetReps });
      });
    });
    add(rutinaExRows, SHEETS.rutinaEjercicios);

    const planRows = [];
    Object.keys(monthlyPlans).forEach((mes) => {
      const days = monthlyPlans[mes].days || {};
      Object.keys(days).forEach((dia) => planRows.push({ mes, dia, rutinaId: days[dia] }));
    });
    add(planRows, SHEETS.planMensual);

    add(measurements, SHEETS.medidas);
    add(foods, SHEETS.alimentos);

    const calRows = [];
    Object.keys(calorieLog).forEach((date) => {
      calorieLog[date].forEach((e) => calRows.push({ date, ...e }));
    });
    add(calRows, SHEETS.calorias);

    const waterRows = [];
    Object.keys(waterLog).forEach((date) => {
      waterLog[date].forEach((e) => waterRows.push({ date, ...e }));
    });
    add(waterRows, SHEETS.agua);

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
              weight: set.weight, reps: set.reps, duration: set.duration, distance: set.distance, calories: set.calories, felt: set.felt,
            });
          });
        }
      });
      Object.keys(log.warmup || {}).forEach((exerciseId) => {
        warmupRows.push({ date, exerciseId, hecho: !!log.warmup[exerciseId] });
      });
    });
    add(entRows, SHEETS.entrenamientos);
    add(seriesRows, SHEETS.series);
    add(warmupRows, SHEETS.calentamiento);

    XLSX.writeFile(wb, `migymtrack-backup-${Utils.todayISO()}.xlsx`);
  }

  // ---------------- importar ----------------

  function sheetRows(wb, name) {
    const ws = wb.Sheets[name];
    return ws ? XLSX.utils.sheet_to_json(ws, { defval: '' }) : [];
  }

  function importWorkbook(wb) {
    if (!wb.Sheets[SHEETS.ajustes] && !wb.Sheets[SHEETS.rutinas]) {
      throw new Error('No parece un respaldo de MiGymTrack');
    }

    // Ajustes (una sola fila, columnas = cada ajuste)
    const settings = DB.getSettings();
    const ajustesRow = sheetRows(wb, SHEETS.ajustes)[0];
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

    const exercises = sheetRows(wb, SHEETS.ejercicios).map((r) => ({ id: String(r.id), name: r.name, group: r.group }));

    const rutinaRows = sheetRows(wb, SHEETS.rutinas);
    const routinesMap = {};
    rutinaRows.forEach((r) => { routinesMap[r.id] = { id: String(r.id), name: r.name, color: r.color, exercises: [] }; });
    sheetRows(wb, SHEETS.rutinaEjercicios)
      .slice()
      .sort((a, b) => Number(a.orden) - Number(b.orden))
      .forEach((re) => {
        const r = routinesMap[re.routineId];
        if (r) r.exercises.push({ exerciseId: re.exerciseId, targetSets: num(re.targetSets) || 1, targetReps: String(re.targetReps) });
      });
    const routines = Object.values(routinesMap);

    const monthlyPlans = {};
    sheetRows(wb, SHEETS.planMensual).forEach((r) => {
      const mes = String(r.mes);
      monthlyPlans[mes] = monthlyPlans[mes] || { days: {} };
      monthlyPlans[mes].days[String(r.dia)] = r.rutinaId;
    });

    const measurements = sheetRows(wb, SHEETS.medidas).map((r) => {
      const m = { id: String(r.id), date: asISODate(r.date) };
      ['weight', 'chest', 'waist', 'hips', 'armL', 'armR', 'thighL', 'thighR', 'calfL', 'calfR', 'neck', 'arm', 'thigh', 'calf'].forEach((k) => {
        const v = num(r[k]);
        if (v !== undefined) m[k] = v;
      });
      return m;
    }).sort((a, b) => (a.date > b.date ? 1 : -1));

    const foods = sheetRows(wb, SHEETS.alimentos).map((r) => ({
      id: String(r.id), name: r.name, servingLabel: String(r.servingLabel),
      kcal: num(r.kcal) || 0, protein: num(r.protein) || 0, carbs: num(r.carbs) || 0, fat: num(r.fat) || 0,
    }));

    const calorieLog = {};
    sheetRows(wb, SHEETS.calorias).forEach((r) => {
      const date = asISODate(r.date);
      calorieLog[date] = calorieLog[date] || [];
      calorieLog[date].push({
        id: String(r.id), foodId: r.foodId ? String(r.foodId) : undefined, foodName: r.foodName,
        servings: num(r.servings) || 1, kcal: num(r.kcal) || 0, protein: num(r.protein) || 0,
        carbs: num(r.carbs) || 0, fat: num(r.fat) || 0, meal: r.meal, time: r.time,
      });
    });

    const waterLog = {};
    sheetRows(wb, SHEETS.agua).forEach((r) => {
      const date = asISODate(r.date);
      waterLog[date] = waterLog[date] || [];
      waterLog[date].push({ id: String(r.id), ml: num(r.ml) || 0, time: r.time });
    });

    const workoutLog = {};
    sheetRows(wb, SHEETS.entrenamientos).forEach((r) => {
      const date = asISODate(r.date);
      workoutLog[date] = { routineId: r.routineId || null, notes: r.notes || '', exercises: [], warmup: {} };
    });
    const exerciseEntryMap = {};
    sheetRows(wb, SHEETS.series).forEach((r) => {
      const date = asISODate(r.date);
      if (!workoutLog[date]) workoutLog[date] = { routineId: null, notes: '', exercises: [], warmup: {} };
      exerciseEntryMap[date] = exerciseEntryMap[date] || {};
      const orden = Number(r.orden) || 0;
      if (!exerciseEntryMap[date][orden]) {
        exerciseEntryMap[date][orden] = { exerciseId: r.exerciseId, fromRoutine: bool(r.fromRoutine), sets: [] };
      }
      if (r.setIndex !== '' && r.setIndex !== undefined) {
        const set = { felt: r.felt || 'normal' };
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
    sheetRows(wb, SHEETS.calentamiento).forEach((r) => {
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

  return { exportAll, importFile };
})();
