/* ============================================================
   programs.js — Programas completos (Full body, Torso/Pierna,
   Push/Pull/Legs). Crean todas las rutinas de una vez, con tus
   ejercicios (agrega los que falten desde la biblioteca) y,
   si quieres, las reparten en el calendario.
   ============================================================ */

const Programs = (() => {
  const COLORS = ['#e0663d', '#3d8de0', '#5fbf6f', '#e0c23d', '#c26fe0', '#e05a5a', '#3de0c2', '#7a7a85'];

  // ejercicio: [nombre de la biblioteca, series, repeticiones]
  const FB = {
    A: [['Sentadilla con barra', 3, '6-8'], ['Press de banca con barra', 3, '6-8'], ['Remo con barra', 3, '8-10'], ['Press militar con mancuernas', 2, '8-10'], ['Curl de bíceps con mancuernas', 2, '10-12'], ['Plancha', 3, '40-60 seg']],
    B: [['Prensa de pierna 45°', 3, '8-12'], ['Press inclinado con mancuernas', 3, '8-10'], ['Jalón al pecho en polea', 3, '8-12'], ['Elevaciones laterales con mancuernas', 3, '12-15'], ['Extensión de tríceps en polea (cuerda)', 2, '10-12'], ['Abdominales (crunch)', 3, '12-15']],
    C: [['Peso muerto rumano', 3, '8-10'], ['Fondos en paralelas', 3, '8-12'], ['Remo en polea baja', 3, '10-12'], ['Press de hombro en máquina', 2, '10-12'], ['Curl martillo', 2, '10-12'], ['Elevación de piernas colgado', 3, '10-12']],
  };
  const TP = {
    TA: [['Press de banca con barra', 4, '6-8'], ['Remo con barra', 4, '6-8'], ['Press militar con mancuernas', 3, '8-10'], ['Jalón al pecho en polea', 3, '8-12'], ['Curl de bíceps con barra', 2, '8-12'], ['Extensión de tríceps en polea (cuerda)', 2, '10-12']],
    PA: [['Sentadilla con barra', 4, '6-8'], ['Peso muerto rumano', 3, '8-10'], ['Prensa de pierna 45°', 3, '10-12'], ['Curl femoral sentado', 3, '10-12'], ['Elevación de talones de pie', 4, '12-15'], ['Plancha', 3, '40-60 seg']],
    TB: [['Press inclinado con mancuernas', 4, '8-10'], ['Remo en máquina', 4, '8-10'], ['Press de hombro en máquina', 3, '10-12'], ['Remo con mancuerna a una mano', 3, '10-12'], ['Elevaciones laterales con mancuernas', 3, '12-15'], ['Curl martillo', 2, '10-12'], ['Press francés', 2, '10-12']],
    PB: [['Hack squat', 4, '8-10'], ['Hip thrust con barra', 3, '8-12'], ['Extensión de cuádriceps en máquina', 3, '10-15'], ['Curl femoral acostado', 3, '10-12'], ['Elevación de talones sentado', 4, '12-20'], ['Elevación de piernas colgado', 3, '10-15']],
  };
  const PPL = {
    Push: [['Press de banca con barra', 4, '6-8'], ['Press inclinado con mancuernas', 3, '8-12'], ['Press militar con mancuernas', 3, '8-10'], ['Elevaciones laterales con mancuernas', 3, '12-15'], ['Extensión de tríceps en polea (cuerda)', 3, '10-12'], ['Press francés', 2, '10-12']],
    Pull: [['Dominadas', 3, '6-10'], ['Remo con barra', 4, '8-10'], ['Jalón al pecho en polea', 3, '10-12'], ['Face pull en polea', 3, '12-15'], ['Curl de bíceps con barra', 3, '8-12'], ['Curl martillo', 2, '10-12']],
    Piernas: [['Sentadilla con barra', 4, '6-8'], ['Prensa de pierna 45°', 3, '10-12'], ['Peso muerto rumano', 3, '8-10'], ['Curl femoral sentado', 3, '10-12'], ['Elevación de talones de pie', 4, '12-15'], ['Abdominales (crunch)', 3, '12-15']],
  };

  // days: día de la semana (0 = domingo) -> nombre de rutina
  const LIST = [
    {
      id: 'fb3', name: 'Full body · 3 días', level: 'Principiante', blurb: 'Cuerpo completo lunes, miércoles y viernes. Ideal para empezar o volver.',
      routines: { 'Full body A': FB.A, 'Full body B': FB.B, 'Full body C': FB.C },
      days: { 1: 'Full body A', 3: 'Full body B', 5: 'Full body C' },
    },
    {
      id: 'tp4', name: 'Torso / Pierna · 4 días', level: 'Intermedio', blurb: 'Dos de torso y dos de pierna a la semana: más volumen por músculo.',
      routines: { 'Torso A': TP.TA, 'Pierna A': TP.PA, 'Torso B': TP.TB, 'Pierna B': TP.PB },
      days: { 1: 'Torso A', 2: 'Pierna A', 4: 'Torso B', 5: 'Pierna B' },
    },
    {
      id: 'ppl3', name: 'Push / Pull / Piernas · 3 días', level: 'Intermedio', blurb: 'Empuje, jalón y pierna una vez por semana. Fácil de sostener.',
      routines: { 'Push': PPL.Push, 'Pull': PPL.Pull, 'Piernas': PPL.Piernas },
      days: { 1: 'Push', 3: 'Pull', 5: 'Piernas' },
    },
    {
      id: 'ppl6', name: 'Push / Pull / Piernas · 6 días', level: 'Avanzado', blurb: 'Cada grupo dos veces por semana. Requiere buena recuperación.',
      routines: { 'Push': PPL.Push, 'Pull': PPL.Pull, 'Piernas': PPL.Piernas },
      days: { 1: 'Push', 2: 'Pull', 3: 'Piernas', 4: 'Push', 5: 'Pull', 6: 'Piernas' },
    },
  ];

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  // devuelve el id del ejercicio del catálogo (lo crea desde la biblioteca si falta)
  function ensureExercise(name) {
    const all = DB.getExercises();
    const lib = ExerciseUI.LIB.find((l) => norm(l[0]) === norm(name));
    const found = all.find((e) => norm(e.name) === norm(name));
    if (found) return { id: found.id, created: false };
    // un ejercicio tuyo casi igual (mismo grupo, nombre contenido en el otro) se reutiliza
    if (lib) {
      const n = norm(name);
      const similar = all
        .filter((e) => e.group === lib[1] && (n.includes(norm(e.name)) || norm(e.name).includes(n)) && norm(e.name).length >= 5)
        .sort((a, b) => norm(b.name).length - norm(a.name).length)[0];
      if (similar) return { id: similar.id, created: false };
    }
    const ex = { id: DB.uid(), name, group: lib ? lib[1] : 'otro' };
    if (lib && lib[2]) ex.equipment = lib[2];
    if (lib && lib[3]) ex.unilateral = true;
    if (lib && lib[4]) ex.bodyweight = true;
    all.push(ex);
    DB.saveExercises(all);
    return { id: ex.id, created: true };
  }

  // crea las rutinas del programa y (opcional) las pone en el calendario desde hoy
  function apply(program, opts = {}) {
    const routines = DB.getRoutines();
    const idByName = {};
    let created = 0;
    Object.keys(program.routines).forEach((rname) => {
      const items = program.routines[rname].map(([exName, sets, reps]) => {
        const r = ensureExercise(exName);
        if (r.created) created += 1;
        return { exerciseId: r.id, targetSets: sets, targetReps: reps };
      });
      let finalName = rname;
      if (routines.some((r) => r.name === finalName)) finalName = `${rname} (${program.id})`;
      const rt = { id: DB.uid(), name: finalName, color: COLORS[routines.length % COLORS.length], exercises: items };
      routines.push(rt);
      idByName[rname] = rt.id;
    });
    DB.saveRoutines(routines);

    let placed = 0;
    if (opts.months) {
      const today = Utils.todayISO();
      const plans = DB.getMonthlyPlans();
      const base = new Date();
      for (let m = 0; m < opts.months; m += 1) {
        const first = new Date(base.getFullYear(), base.getMonth() + m, 1);
        const y = first.getFullYear();
        const mo = first.getMonth();
        const mk = Utils.monthKey(first);
        const existing = (plans[mk] || { days: {} }).days || {};
        for (let d = 1; d <= Utils.daysInMonth(y, mo); d += 1) {
          const iso = `${y}-${Utils.pad(mo + 1)}-${Utils.pad(d)}`;
          if (iso < today) continue;
          const rname = program.days[new Date(y, mo, d).getDay()];
          if (!rname) continue;
          if (opts.onlyEmpty && existing[String(d)]) continue;
          DB.setPlannedRoutine(iso, idByName[rname]);
          placed += 1;
        }
      }
    }
    return { created, placed, routines: Object.keys(idByName).length };
  }

  const DOW = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  function open(onDone) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Elige un programa y se crean todas sus rutinas con ejercicios, series y repeticiones. Podrás editarlas después.' }));
    LIST.forEach((p) => {
      const card = Utils.el('div', { class: 'rt-card', style: '--gc:var(--accent)' }, [
        Utils.el('div', { class: 'rt-card-name', style: 'color:var(--text);', text: p.name }),
        Utils.el('div', { class: 'meta', text: `${p.level} · ${p.blurb}` }),
        Utils.el('div', { class: 'rt-summary' }, Object.keys(p.days).map((d) => Utils.el('span', { class: 'rt-pill', text: `${DOW[d]} ${p.days[d]}` }))),
      ]);
      const b = Utils.el('button', { class: 'btn-secondary btn-block', text: 'Ver y usar' });
      b.addEventListener('click', () => openProgram(p, onDone));
      card.appendChild(b);
      body.appendChild(card);
    });
    Modal.open('📋 Programas completos', body, { onClose: onDone });
  }

  function openProgram(p, onDone) {
    const body = Utils.el('div');
    Object.keys(p.routines).forEach((rname) => {
      body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:10px 0 4px;', text: rname }));
      p.routines[rname].forEach(([n, s, r]) => body.appendChild(Utils.el('div', { class: 'list-item', style: 'padding:7px 0;' }, [Utils.el('span', { text: n }), Utils.el('span', { class: 'meta', text: `${s} × ${r}` })])));
    });

    let months = 1;
    let onlyEmpty = true;
    body.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:16px 0 6px;', text: 'Calendario' }));
    const seg = Utils.el('div', { class: 'seg small' });
    const paint = () => seg.querySelectorAll('.seg-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.m) === months));
    [[0, 'No aplicar'], [1, 'Este mes'], [2, 'Este y el próximo']].forEach(([m, t]) => {
      const b = Utils.el('button', { class: 'seg-btn', type: 'button', 'data-m': String(m), text: t });
      b.addEventListener('click', () => { months = m; paint(); });
      seg.appendChild(b);
    });
    body.appendChild(seg);
    paint();
    const keep = Utils.el('button', { class: 'uni-chip on', type: 'button', text: '✓ Solo días vacíos (no pisa lo que ya asignaste)' });
    keep.addEventListener('click', () => { onlyEmpty = !onlyEmpty; keep.classList.toggle('on', onlyEmpty); keep.textContent = onlyEmpty ? '✓ Solo días vacíos (no pisa lo que ya asignaste)' : 'Reemplazar los días del programa'; });
    body.appendChild(keep);

    const go = Utils.el('button', { class: 'btn-primary btn-block', text: 'Crear rutinas del programa' });
    go.addEventListener('click', () => {
      const r = apply(p, { months, onlyEmpty });
      Modal.close();
      Utils.toast(`${r.routines} rutinas creadas${r.created ? ` · ${r.created} ejercicios agregados` : ''}${r.placed ? ` · ${r.placed} días en el calendario` : ''}`);
      if (onDone) onDone();
    });
    body.appendChild(go);
    const back = Utils.el('button', { class: 'link-btn small', style: 'margin-top:8px;', text: '← Volver a los programas' });
    back.addEventListener('click', () => open(onDone));
    body.appendChild(back);
    Modal.open(p.name, body, { onClose: onDone });
  }

  return { LIST, apply, open };
})();
