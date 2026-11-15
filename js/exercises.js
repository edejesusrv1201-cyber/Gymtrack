/* ============================================================
   exercises.js — Biblioteca de ejercicios y máquinas incluida +
   formulario para crear/editar ejercicios (grupo, equipo,
   unilateral). Se usa desde Más, el entrenamiento y las rutinas.
   ============================================================ */

const ExerciseUI = (() => {
  const GROUPS = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];
  const EQUIPMENT = [
    { key: 'barra', label: 'Barra', icon: '🏋️' },
    { key: 'mancuernas', label: 'Mancuernas', icon: '💪' },
    { key: 'maquina', label: 'Máquina', icon: '⚙️' },
    { key: 'polea', label: 'Polea', icon: '🪢' },
    { key: 'corporal', label: 'Peso corporal', icon: '🤸' },
    { key: 'otro', label: 'Otro', icon: '•' },
  ];
  const eqLabel = (k) => (EQUIPMENT.find((e) => e.key === k) || {}).label || '';

  // [nombre, grupo, equipo, unilateral]
  const LIB = [
    // pecho
    ['Press de banca con barra', 'pecho', 'barra'],
    ['Press inclinado con barra', 'pecho', 'barra'],
    ['Press declinado con barra', 'pecho', 'barra'],
    ['Press de banca con mancuernas', 'pecho', 'mancuernas'],
    ['Press inclinado con mancuernas', 'pecho', 'mancuernas'],
    ['Aperturas con mancuernas', 'pecho', 'mancuernas'],
    ['Aperturas en polea (cruce de poleas)', 'pecho', 'polea'],
    ['Aperturas en máquina (peck-deck)', 'pecho', 'maquina'],
    ['Press de pecho en máquina', 'pecho', 'maquina'],
    ['Press inclinado en máquina', 'pecho', 'maquina'],
    ['Press en máquina Smith', 'pecho', 'maquina'],
    ['Fondos en paralelas', 'pecho', 'corporal', false, true],
    ['Flexiones de pecho', 'pecho', 'corporal', false, true],
    ['Pullover con mancuerna', 'pecho', 'mancuernas'],
    // espalda
    ['Dominadas', 'espalda', 'corporal', false, true],
    ['Dominadas asistidas en máquina', 'espalda', 'maquina'],
    ['Jalón al pecho en polea', 'espalda', 'polea'],
    ['Jalón agarre cerrado', 'espalda', 'polea'],
    ['Jalón unilateral en polea', 'espalda', 'polea', true],
    ['Remo con barra', 'espalda', 'barra'],
    ['Remo con mancuerna a una mano', 'espalda', 'mancuernas', true],
    ['Remo en polea baja', 'espalda', 'polea'],
    ['Remo en máquina', 'espalda', 'maquina'],
    ['Remo en barra T', 'espalda', 'barra'],
    ['Peso muerto convencional', 'espalda', 'barra'],
    ['Pullover en polea', 'espalda', 'polea'],
    ['Hiperextensiones lumbares', 'espalda', 'corporal'],
    ['Encogimientos de hombros (trapecio)', 'espalda', 'mancuernas'],
    // pierna
    ['Sentadilla con barra', 'pierna', 'barra'],
    ['Sentadilla en máquina Smith', 'pierna', 'maquina'],
    ['Sentadilla goblet', 'pierna', 'mancuernas'],
    ['Sentadilla búlgara', 'pierna', 'mancuernas', true],
    ['Prensa de pierna 45°', 'pierna', 'maquina'],
    ['Prensa horizontal', 'pierna', 'maquina'],
    ['Hack squat', 'pierna', 'maquina'],
    ['Extensión de cuádriceps en máquina', 'pierna', 'maquina'],
    ['Curl femoral sentado', 'pierna', 'maquina'],
    ['Curl femoral acostado', 'pierna', 'maquina'],
    ['Curl femoral a una pierna', 'pierna', 'maquina', true],
    ['Zancadas con mancuernas', 'pierna', 'mancuernas', true],
    ['Zancadas caminando', 'pierna', 'mancuernas', true],
    ['Peso muerto rumano', 'pierna', 'barra'],
    ['Hip thrust con barra', 'pierna', 'barra'],
    ['Hip thrust en máquina', 'pierna', 'maquina'],
    ['Abductores en máquina', 'pierna', 'maquina'],
    ['Aductores en máquina', 'pierna', 'maquina'],
    ['Elevación de talones de pie', 'pierna', 'maquina'],
    ['Elevación de talones sentado', 'pierna', 'maquina'],
    ['Patada de glúteo en polea', 'pierna', 'polea', true],
    ['Step-up en banco', 'pierna', 'mancuernas', true],
    // hombro
    ['Press militar con barra', 'hombro', 'barra'],
    ['Press militar con mancuernas', 'hombro', 'mancuernas'],
    ['Press de hombro en máquina', 'hombro', 'maquina'],
    ['Press Arnold', 'hombro', 'mancuernas'],
    ['Elevaciones laterales con mancuernas', 'hombro', 'mancuernas', true],
    ['Elevaciones laterales en polea', 'hombro', 'polea', true],
    ['Elevaciones frontales', 'hombro', 'mancuernas'],
    ['Pájaros (elevaciones posteriores)', 'hombro', 'mancuernas'],
    ['Pájaros en peck-deck inverso', 'hombro', 'maquina'],
    ['Face pull en polea', 'hombro', 'polea'],
    ['Remo al mentón', 'hombro', 'barra'],
    // brazo
    ['Curl de bíceps con barra', 'brazo', 'barra'],
    ['Curl de bíceps con mancuernas', 'brazo', 'mancuernas'],
    ['Curl martillo', 'brazo', 'mancuernas', true],
    ['Curl predicador (Scott)', 'brazo', 'barra'],
    ['Curl en polea baja', 'brazo', 'polea'],
    ['Curl concentrado', 'brazo', 'mancuernas', true],
    ['Extensión de tríceps en polea (cuerda)', 'brazo', 'polea'],
    ['Extensión de tríceps en polea a una mano', 'brazo', 'polea', true],
    ['Press francés', 'brazo', 'barra'],
    ['Fondos en banco (tríceps)', 'brazo', 'corporal', false, true],
    ['Patada de tríceps', 'brazo', 'mancuernas', true],
    ['Extensión de tríceps sobre la cabeza', 'brazo', 'mancuernas'],
    ['Press cerrado', 'brazo', 'barra'],
    // core
    ['Plancha', 'core', 'corporal'],
    ['Plancha lateral', 'core', 'corporal', true],
    ['Abdominales (crunch)', 'core', 'corporal'],
    ['Crunch en polea', 'core', 'polea'],
    ['Abdominales en máquina', 'core', 'maquina'],
    ['Elevación de piernas colgado', 'core', 'corporal'],
    ['Elevación de rodillas colgado', 'core', 'corporal'],
    ['Rueda abdominal', 'core', 'otro'],
    ['Giros rusos (Russian twist)', 'core', 'corporal'],
    ['Leñador en polea', 'core', 'polea'],
    // cardio
    ['Caminadora / trote', 'cardio', 'maquina'],
    ['Caminata inclinada', 'cardio', 'maquina'],
    ['Bicicleta estática', 'cardio', 'maquina'],
    ['Elíptica', 'cardio', 'maquina'],
    ['Remo ergómetro', 'cardio', 'maquina'],
    ['Escaladora (StairMaster)', 'cardio', 'maquina'],
    ['Saltar la cuerda', 'cardio', 'otro'],
    ['Natación', 'cardio', 'otro'],
    ['Carrera al aire libre', 'cardio', 'otro'],
    // movilidad
    ['Círculos de cadera', 'movilidad', 'corporal'],
    ['Rotación torácica', 'movilidad', 'corporal'],
    ['Gato-camello', 'movilidad', 'corporal'],
    ['Apertura de cadera 90/90', 'movilidad', 'corporal'],
    ['Movilidad de hombro con banda', 'movilidad', 'otro'],
    ['Estiramiento de isquiotibiales', 'movilidad', 'corporal'],
    ['Estiramiento de flexores de cadera', 'movilidad', 'corporal'],
    // --- ampliación v43 ---
    // pecho
    ['Press de banca agarre ancho', 'pecho', 'barra'],
    ['Press de banca con pausa', 'pecho', 'barra'],
    ['Press de banca en Smith', 'pecho', 'maquina'],
    ['Press inclinado en Smith', 'pecho', 'maquina'],
    ['Press declinado con mancuernas', 'pecho', 'mancuernas'],
    ['Press con agarre neutro con mancuernas', 'pecho', 'mancuernas'],
    ['Floor press con barra', 'pecho', 'barra'],
    ['Aperturas inclinadas con mancuernas', 'pecho', 'mancuernas'],
    ['Cruce de poleas de arriba abajo', 'pecho', 'polea'],
    ['Cruce de poleas de abajo arriba', 'pecho', 'polea'],
    ['Press de pecho en polea', 'pecho', 'polea'],
    ['Press de pecho unilateral en máquina', 'pecho', 'maquina', true],
    ['Press Svend con disco', 'pecho', 'otro'],
    ['Flexiones declinadas', 'pecho', 'corporal', false, true],
    ['Flexiones diamante', 'pecho', 'corporal', false, true],
    ['Fondos asistidos en máquina', 'pecho', 'maquina'],
    // espalda
    ['Dominadas agarre supino (chin-up)', 'espalda', 'corporal', false, true],
    ['Dominadas agarre neutro', 'espalda', 'corporal', false, true],
    ['Dominadas lastradas', 'espalda', 'corporal', false, true],
    ['Jalón agarre supino', 'espalda', 'polea'],
    ['Jalón agarre ancho', 'espalda', 'polea'],
    ['Jalón con brazos rectos en polea', 'espalda', 'polea'],
    ['Remo Pendlay', 'espalda', 'barra'],
    ['Remo con barra agarre supino', 'espalda', 'barra'],
    ['Remo Meadows', 'espalda', 'barra', true],
    ['Remo con mancuernas inclinado', 'espalda', 'mancuernas'],
    ['Remo con pecho apoyado en máquina', 'espalda', 'maquina'],
    ['Remo unilateral en polea', 'espalda', 'polea', true],
    ['Remo en polea agarre ancho', 'espalda', 'polea'],
    ['Remo en Smith', 'espalda', 'maquina'],
    ['Remo invertido', 'espalda', 'corporal', false, true],
    ['Peso muerto sumo', 'espalda', 'barra'],
    ['Peso muerto con barra hexagonal', 'espalda', 'barra'],
    ['Peso muerto con déficit', 'espalda', 'barra'],
    ['Rack pull', 'espalda', 'barra'],
    ['Buenos días (good morning)', 'espalda', 'barra'],
    ['Encogimientos con barra', 'espalda', 'barra'],
    ['Encogimientos en máquina', 'espalda', 'maquina'],
    ['Pullover con barra', 'espalda', 'barra'],
    // pierna
    ['Sentadilla frontal', 'pierna', 'barra'],
    ['Sentadilla con pausa', 'pierna', 'barra'],
    ['Sentadilla en caja', 'pierna', 'barra'],
    ['Sentadilla Zercher', 'pierna', 'barra'],
    ['Sentadilla con barra baja', 'pierna', 'barra'],
    ['Sentadilla hack con barra', 'pierna', 'barra'],
    ['Sentadilla sissy', 'pierna', 'corporal'],
    ['Sentadilla con cinturón (belt squat)', 'pierna', 'maquina'],
    ['Sentadilla con mancuernas', 'pierna', 'mancuernas'],
    ['Prensa de pierna unilateral', 'pierna', 'maquina', true],
    ['Prensa de pantorrillas', 'pierna', 'maquina'],
    ['Extensión de cuádriceps a una pierna', 'pierna', 'maquina', true],
    ['Peso muerto rumano con mancuernas', 'pierna', 'mancuernas'],
    ['Peso muerto rumano a una pierna', 'pierna', 'mancuernas', true],
    ['Peso muerto rumano en Smith', 'pierna', 'maquina'],
    ['Zancadas con barra', 'pierna', 'barra'],
    ['Zancadas reversas', 'pierna', 'mancuernas', true],
    ['Zancada lateral', 'pierna', 'mancuernas', true],
    ['Step-up con barra', 'pierna', 'barra'],
    ['Hip thrust a una pierna', 'pierna', 'corporal', true],
    ['Hip thrust con mancuerna', 'pierna', 'mancuernas'],
    ['Puente de glúteo', 'pierna', 'corporal'],
    ['Patada de glúteo en máquina', 'pierna', 'maquina', true],
    ['Abducción de cadera en polea', 'pierna', 'polea', true],
    ['Curl nórdico (nordic curl)', 'pierna', 'corporal', false, true],
    ['Elevación de talones en prensa', 'pierna', 'maquina'],
    ['Elevación de talones a una pierna', 'pierna', 'mancuernas', true],
    ['Elevación de talones en Smith', 'pierna', 'maquina'],
    ['Elevación de tibial anterior', 'pierna', 'maquina'],
    ['Sentadilla pistol', 'pierna', 'corporal', true, true],
    ['Swing con kettlebell', 'pierna', 'otro'],
    ['Peso muerto con kettlebell', 'pierna', 'otro'],
    ['Cargada de potencia (power clean)', 'pierna', 'barra'],
    ['Arrancada (snatch)', 'pierna', 'barra'],
    // hombro
    ['Press militar sentado con barra', 'hombro', 'barra'],
    ['Push press', 'hombro', 'barra'],
    ['Press militar en Smith', 'hombro', 'maquina'],
    ['Press de hombro unilateral con mancuerna', 'hombro', 'mancuernas', true],
    ['Press landmine', 'hombro', 'barra', true],
    ['Elevaciones laterales en máquina', 'hombro', 'maquina'],
    ['Elevaciones laterales inclinado', 'hombro', 'mancuernas', true],
    ['Elevaciones frontales con disco', 'hombro', 'otro'],
    ['Elevaciones frontales en polea', 'hombro', 'polea', true],
    ['Pájaros en polea', 'hombro', 'polea', true],
    ['Remo al mentón con mancuernas', 'hombro', 'mancuernas'],
    ['Elevación en Y (Y-raise)', 'hombro', 'mancuernas'],
    ['Rotación externa en polea', 'hombro', 'polea', true],
    ['Press Z', 'hombro', 'barra'],
    // brazo
    ['Curl con barra Z', 'brazo', 'barra'],
    ['Curl inclinado con mancuernas', 'brazo', 'mancuernas'],
    ['Curl araña (spider curl)', 'brazo', 'mancuernas'],
    ['Curl en máquina', 'brazo', 'maquina'],
    ['Curl Bayesian en polea', 'brazo', 'polea', true],
    ['Curl con cuerda en polea', 'brazo', 'polea'],
    ['Curl martillo cruzado', 'brazo', 'mancuernas', true],
    ['Curl inverso con barra', 'brazo', 'barra'],
    ['Curl de muñeca (antebrazo)', 'brazo', 'mancuernas'],
    ['Extensión de muñeca', 'brazo', 'mancuernas'],
    ['Paseo del granjero', 'brazo', 'otro'],
    ['Press francés con mancuernas', 'brazo', 'mancuernas'],
    ['Press francés con barra Z', 'brazo', 'barra'],
    ['Extensión de tríceps con barra en polea', 'brazo', 'polea'],
    ['Extensión de tríceps tras nuca en polea', 'brazo', 'polea'],
    ['Extensión de tríceps agarre supino', 'brazo', 'polea'],
    ['Fondos en máquina (tríceps)', 'brazo', 'maquina'],
    ['Press cerrado en Smith', 'brazo', 'maquina'],
    ['Patada de tríceps en polea', 'brazo', 'polea', true],
    // core
    ['Dragon flag', 'core', 'corporal'],
    ['Rueda abdominal de rodillas', 'core', 'otro'],
    ['Pallof press', 'core', 'polea', true],
    ['Crunch inverso', 'core', 'corporal'],
    ['Bicicleta abdominal', 'core', 'corporal'],
    ['Hollow body', 'core', 'corporal'],
    ['Abdominales V-ups', 'core', 'corporal'],
    ['Toes to bar', 'core', 'corporal'],
    ['Plancha con peso', 'core', 'otro'],
    ['Mountain climbers', 'core', 'corporal'],
    ['Elevación de piernas en banco', 'core', 'corporal'],
    ['Crunch declinado con peso', 'core', 'otro'],
    ['Rotación con landmine', 'core', 'barra'],
    // cardio
    ['Spinning', 'cardio', 'maquina'],
    ['Assault bike', 'cardio', 'maquina'],
    ['SkiErg', 'cardio', 'maquina'],
    ['Caminata', 'cardio', 'otro'],
    ['Senderismo', 'cardio', 'otro'],
    ['Ciclismo al aire libre', 'cardio', 'otro'],
    ['Boxeo / saco', 'cardio', 'otro'],
    ['Battle ropes', 'cardio', 'otro'],
    ['Burpees', 'cardio', 'corporal'],
    ['Empuje de trineo (sled push)', 'cardio', 'otro'],
    ['HIIT', 'cardio', 'otro'],
    // movilidad
    ['Estiramiento de cuádriceps', 'movilidad', 'corporal'],
    ['Estiramiento de pecho en puerta', 'movilidad', 'corporal'],
    ['Postura del niño', 'movilidad', 'corporal'],
    ['Perro boca abajo', 'movilidad', 'corporal'],
    ['Estiramiento de gemelos', 'movilidad', 'corporal'],
    ['Estiramiento de glúteo (paloma)', 'movilidad', 'corporal'],
    ['Movilidad de tobillo', 'movilidad', 'corporal'],
    ['Foam roller de espalda', 'movilidad', 'otro'],
  ];

  (() => { const seen = new Set(); for (let i = 0; i < LIB.length; i += 1) { const k = String(LIB[i][0]).toLowerCase(); if (seen.has(k)) { LIB.splice(i, 1); i -= 1; } else seen.add(k); } })();

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  // ---------- crear / editar ----------
  // preset: { name, group }
  function openForm(existing, onSaved, preset = {}) {
    const body = Utils.el('div');
    let group = existing ? existing.group : (GROUPS.includes(preset.group) ? preset.group : 'pecho');
    let equipment = existing ? (existing.equipment || '') : '';
    let uni = existing ? !!existing.unilateral : false;
    let bwFlag = existing ? !!existing.bodyweight : false;

    const nameIn = Utils.el('input', { type: 'text', value: existing ? existing.name : (preset.name || ''), placeholder: 'ej. Peck-deck, Prensa 45°, Curl en polea' });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre' }), nameIn]));

    const groupRow = Utils.el('div', { class: 'rt-chips' });
    const paintGroups = () => {
      groupRow.innerHTML = '';
      GROUPS.forEach((g) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip${g === group ? ' active' : ''}`, style: `--gc:${Utils.GROUP_COLORS[g] || '#8d95a8'}`, text: g });
        c.addEventListener('click', () => { group = g; paintGroups(); paintRest(); });
        groupRow.appendChild(c);
      });
    };
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Grupo muscular' }), groupRow]));

    const eqRow = Utils.el('div', { class: 'rt-chips' });
    const eqField = Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Equipo / máquina' }), eqRow]);
    const paintEq = () => {
      eqRow.innerHTML = '';
      EQUIPMENT.forEach((e) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${e.key === equipment ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: `${e.icon} ${e.label}` });
        c.addEventListener('click', () => { equipment = equipment === e.key ? '' : e.key; paintEq(); });
        eqRow.appendChild(c);
      });
    };
    body.appendChild(eqField);

    const uniBtn = Utils.el('button', { class: 'uni-chip', type: 'button' });
    const paintUni = () => {
      uniBtn.classList.toggle('on', uni);
      uniBtn.textContent = uni ? '✓ Unilateral · el peso se anota por lado' : 'Unilateral · el peso se anota por lado';
    };
    uniBtn.addEventListener('click', () => { uni = !uni; paintUni(); });
    const bwBtn = Utils.el('button', { class: 'uni-chip', type: 'button' });
    const paintBw = () => {
      bwBtn.classList.toggle('on', bwFlag);
      bwBtn.textContent = bwFlag ? '✓ Peso corporal · anotas solo la carga extra' : 'Peso corporal (dominadas, fondos…) · anotas solo la carga extra';
    };
    bwBtn.addEventListener('click', () => { bwFlag = !bwFlag; paintBw(); });
    body.appendChild(uniBtn);
    body.appendChild(bwBtn);

    function paintRest() {
      const isCardio = group === 'cardio';
      eqField.classList.toggle('hidden', false);
      uniBtn.classList.toggle('hidden', isCardio || group === 'movilidad');
      bwBtn.classList.toggle('hidden', isCardio || group === 'movilidad');
    }
    paintGroups(); paintEq(); paintUni(); paintBw(); paintRest();

    const save = Utils.el('button', { class: 'btn-primary btn-block', text: existing ? 'Guardar cambios' : 'Crear ejercicio' });
    save.addEventListener('click', () => {
      const name = nameIn.value.trim();
      if (!name) { Utils.toast('Escribe el nombre'); return; }
      const all = DB.getExercises();
      const dup = all.find((e) => norm(e.name) === norm(name) && (!existing || e.id !== existing.id));
      if (dup) { Utils.toast('Ya tienes un ejercicio con ese nombre'); return; }
      let ex;
      if (existing) ex = all.find((e) => e.id === existing.id);
      else { ex = { id: DB.uid() }; all.push(ex); }
      Object.assign(ex, { name, group });
      if (equipment) ex.equipment = equipment; else delete ex.equipment;
      if (uni && group !== 'cardio' && group !== 'movilidad') ex.unilateral = true; else if (existing) ex.unilateral = false; else delete ex.unilateral;
      if (bwFlag && group !== 'cardio' && group !== 'movilidad') ex.bodyweight = true; else delete ex.bodyweight;
      DB.saveExercises(all);
      Modal.close();
      if (onSaved) onSaved(ex);
    });
    body.appendChild(save);

    if (existing) {
      const del = Utils.el('button', { class: 'btn-secondary btn-block', style: 'color:var(--red);', text: '🗑️ Eliminar del catálogo' });
      del.addEventListener('click', () => {
        const wl = DB.getWorkoutLog();
        const uses = Object.values(wl).filter((l) => (l.exercises || []).some((e) => e.exerciseId === existing.id && e.sets && e.sets.length)).length;
        const inRoutines = DB.getRoutines().filter((r) => r.exercises.some((e) => e.exerciseId === existing.id)).length;
        const extra = `${uses ? `\nLo hiciste en ${uses} entrenamiento(s): el historial se conserva.` : ''}${inRoutines ? `\nEstá en ${inRoutines} rutina(s): se quedará con la etiqueta "(eliminado)".` : ''}`;
        if (!Utils.confirmDialog(`¿Eliminar "${existing.name}" del catálogo?${extra}`)) return;
        DB.saveExercises(DB.getExercises().filter((e) => e.id !== existing.id));
        Modal.close();
        if (onSaved) onSaved(null);
      });
      body.appendChild(del);
    }
    Modal.open(existing ? 'Editar ejercicio' : 'Nuevo ejercicio', body);
  }

  // ---------- biblioteca ----------
  // opts: { onAdd(ex) — se llama al agregar uno al catálogo, onClose }
  function openLibrary(opts = {}) {
    const body = Utils.el('div');
    let group = 'todos';
    let query = '';
    const added = new Set();

    const search = Utils.el('input', { type: 'search', placeholder: '🔎 Buscar ejercicio o máquina…', class: 'ax-search' });
    const chipsRow = Utils.el('div', { class: 'rt-chips nut-chips' });
    const list = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin:0 0 8px;', text: 'Toca para agregar al catálogo. Después podrás ponerlo en tus rutinas y entrenamientos.' }));
    body.appendChild(search);
    body.appendChild(chipsRow);
    body.appendChild(list);

    const have = () => new Set(DB.getExercises().map((e) => norm(e.name)));

    function paintChips() {
      chipsRow.innerHTML = '';
      ['todos'].concat(GROUPS.filter((g) => LIB.some((l) => l[1] === g))).forEach((g) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip${g === group && !query ? ' active' : ''}`, style: `--gc:${g === 'todos' ? 'var(--accent-light)' : (Utils.GROUP_COLORS[g] || '#8d95a8')}`, text: g });
        c.addEventListener('click', () => { group = g; search.value = ''; query = ''; paintChips(); paintList(); });
        chipsRow.appendChild(c);
      });
    }

    function paintList() {
      list.innerHTML = '';
      const owned = have();
      const q = norm(query);
      let items = LIB.filter((l) => (q ? norm(l[0]).includes(q) || norm(l[1]).includes(q) || norm(eqLabel(l[2])).includes(q) : group === 'todos' || l[1] === group));
      if (!items.length) {
        list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: 'No hay coincidencias. Puedes crear el tuyo con el botón de abajo.' }));
      }
      items.forEach(([name, g, eq, uni, bw]) => {
        const has = owned.has(norm(name));
        const btn = Utils.el('button', { class: 'btn-small', text: has ? '✓' : '+' });
        btn.disabled = has;
        const gbtn = Utils.el('button', { class: 'btn-small', type: 'button', text: '🎓', title: 'Cómo se hace' });
        const row = Utils.el('div', { class: `list-item${has ? ' ax-added' : ''}` }, [
          Utils.el('div', { style: 'min-width:0;' }, [
            Utils.el('div', { style: 'font-weight:700;' }, [name, uni ? Utils.el('span', { class: 'uni-pill', text: 'unilateral' }) : null, bw ? Utils.el('span', { class: 'uni-pill', text: 'peso corporal' }) : null]),
            Utils.el('div', { class: `meta grp-${g}`, text: `${g} · ${eqLabel(eq)}${has ? ' · ya en tu catálogo' : ''}` }),
          ]),
          Utils.el('div', { class: 'gd-btns' }, [gbtn, btn]),
        ]);
        gbtn.addEventListener('click', () => Guide.open({ name, group: g, equipment: eq }));
        btn.addEventListener('click', () => {
          const all = DB.getExercises();
          const ex = { id: DB.uid(), name, group: g, equipment: eq };
          if (uni) ex.unilateral = true;
          if (bw) ex.bodyweight = true;
          all.push(ex);
          DB.saveExercises(all);
          added.add(name);
          btn.textContent = '✓';
          btn.disabled = true;
          row.classList.add('ax-added');
          Utils.toast(`✓ ${name} agregado`);
          if (opts.onAdd) opts.onAdd(ex);
        });
        list.appendChild(row);
      });
    }
    search.addEventListener('input', () => { query = search.value.trim(); paintChips(); paintList(); });

    const create = Utils.el('button', { class: 'btn-secondary btn-block', text: '✍️ Crear ejercicio propio' });
    create.addEventListener('click', () => openForm(null, (ex) => { if (ex && opts.onAdd) opts.onAdd(ex); if (opts.onClose) opts.onClose(); }, { name: query, group: group === 'todos' ? 'pecho' : group }));
    const done = Utils.el('button', { class: 'btn-primary btn-block', text: added.size ? `Listo (${added.size})` : 'Listo' });
    done.addEventListener('click', () => { Modal.close(); if (opts.onClose) opts.onClose(); });
    body.appendChild(create);
    body.appendChild(done);
    paintChips();
    paintList();
    Modal.open('📚 Biblioteca de ejercicios', body, { onClose: opts.onClose });
  }

  return { GROUPS, EQUIPMENT, eqLabel, openForm, openLibrary, LIB };
})();
