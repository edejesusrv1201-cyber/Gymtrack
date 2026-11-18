/* ============================================================
   leaderboard.js — Ranking global (Progreso → 🌍 Ranking).
   · Usuario sin correo: solo un nombre (y, si quieres, una
     contraseña corta para volver a entrar desde otro celular).
   · Tú decides qué marcas publicas; nada se envía antes.
   · Listas: Mixto / Hombres / Mujeres, por ejercicios básicos o de
     la comunidad. Se ordena por 1RM estimado (Epley).
   Servidor: Supabase (ver supabase/setup.sql). Solo se envía tu
   nombre elegido, tu sexo (opcional) y las marcas que publiques.
   ============================================================ */

const Leaderboard = (() => {
  const USER_KEY = 'gt_lbUser';   // fuera del respaldo a propósito: el secreto no viaja en tus archivos .json

  // ejercicios básicos: clave del servidor, nombre y cómo reconocerlos en tu catálogo
  const BASICS = [
    { key: 'banca', name: 'Press de banca', re: /press (de )?banca|banca plano|bench/, not: /mancuerna|inclinado|declinado|maquina|smith|agarre cerrado|cerrado|floor|svend/ },
    { key: 'sentadilla', name: 'Sentadilla', re: /sentadilla/, not: /bulgara|hack|goblet|sissy|maquina|smith|salto|pistol|bandas?|frontal|mancuerna|cinturon|belt|zercher|una pierna|pendular/ },
    { key: 'peso_muerto', name: 'Peso muerto', re: /peso muerto/, not: /rumano|stiff|mancuerna|piernas rigidas|unilateral|una pierna|hexagonal|kettlebell/ },
    { key: 'press_militar', name: 'Press militar', re: /press militar/, not: /mancuerna|maquina|smith|arnold/ },
    { key: 'remo_barra', name: 'Remo con barra', re: /remo (con )?barra|pendlay/, not: /mancuerna|maquina|polea|t-?bar|meadows|smith|invertido/ },
    { key: 'hip_thrust', name: 'Hip thrust', re: /hip thrust|empuje de cadera/, not: /maquina|mancuerna|una pierna/ },
  ];
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  const fmt = (n) => String(Math.round(n * 10) / 10);

  // ---------------------------------------------------------------- servidor
  function conf() {
    const c = window.GT_CONFIG || {};
    const o = DB.getSettings().lbConfig || {};
    return { url: String(o.url || c.supabaseUrl || '').replace(/\/+$/, ''), key: String(o.key || c.supabaseKey || '') };
  }
  const configured = () => { const c = conf(); return !!(c.url && c.key); };

  const ERRORS = {
    name_length: 'El nombre debe tener entre 2 y 24 caracteres.',
    name_chars: 'Usa solo letras, números, espacios, punto, guion o guion bajo.',
    name_taken: 'Ese nombre ya está en uso. Elige otro (o agrégale tu apellido).',
    pass_short: 'La contraseña debe tener al menos 4 caracteres (o déjala vacía).',
    bad_login: 'Nombre o contraseña incorrectos. (Solo puedes entrar así si creaste una contraseña.)',
    not_auth: 'Tu sesión ya no es válida. Entra de nuevo.',
    bad_values: 'Esa marca no parece válida (peso máx. 700 kg, 1 a 30 repeticiones).',
    bad_exercise: 'Ese nombre de ejercicio no es válido.',
    too_many: 'Llegaste al máximo de 40 ejercicios publicados.',
  };

  async function rpc(fn, args) {
    const c = conf();
    if (!c.url || !c.key) throw new Error('No hay servidor configurado.');
    const headers = { 'Content-Type': 'application/json', apikey: c.key };
    if (c.key.startsWith('eyJ')) headers.Authorization = `Bearer ${c.key}`;   // las claves antiguas son JWT
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 12000);
    let res;
    try {
      res = await fetch(`${c.url}/rest/v1/rpc/${fn}`, { method: 'POST', headers, body: JSON.stringify(args || {}), signal: ctl ? ctl.signal : undefined });
    } catch (e) {
      throw new Error('No pude conectarme. Revisa tu internet.');
    } finally { clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch (e) { /* respuesta vacía */ }
    if (!res.ok) {
      const code = data && data.message ? String(data.message) : '';
      throw new Error(ERRORS[code] || (code && code.length < 80 ? code : 'El servidor respondió con un error.'));
    }
    return data;
  }

  // ---------------------------------------------------------------- sesión
  function user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } }
  const setUser = (u) => { try { if (u) localStorage.setItem(USER_KEY, JSON.stringify(u)); else localStorage.removeItem(USER_KEY); } catch (e) { /* sin almacenamiento */ } };

  // ---------------------------------------------------------------- tus marcas locales
  // mejor serie (1RM estimado) de tus ejercicios que corresponden a una prueba
  function bestFor(match) {
    const wl = DB.getWorkoutLog();
    const exs = DB.getExercises().filter(match);
    const ids = new Set(exs.map((e) => e.id));
    let best = null;
    Object.keys(wl).forEach((d) => (wl[d].exercises || []).forEach((en) => {
      if (!ids.has(en.exerciseId)) return;
      (en.sets || []).forEach((s) => {
        if (!Metrics.isNormal(s) || s.uni) return;
        const kg = Metrics.loadOf(s); const reps = Number(s.reps) || 0;
        if (!(kg > 0) || !(reps > 0) || reps > 30) return;
        const e = Metrics.e1rm(kg, reps);
        if (!best || e > best.e1rm) best = { kg, reps, e1rm: e, date: d, name: (exs.find((x) => x.id === en.exerciseId) || {}).name };
      });
    }));
    return best;
  }
  const basicMatch = (b) => (e) => e.group !== 'cardio' && b.re.test(norm(e.name)) && !b.not.test(norm(e.name));
  const bestBasic = (b) => bestFor(basicMatch(b));
  const bestOfExercise = (id) => bestFor((e) => e.id === id);

  // ---------------------------------------------------------------- ejercicios del ranking
  // Básicos + todo lo de la biblioteca de la app con peso externo. Así tus marcas entran solas.
  const LIFT_GROUPS = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo'];
  const cleanName = (t) => String(t).replace(/[^\p{L}\p{N} ._()/+-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Ejercicio';
  let liftsCache = null;
  function lifts() {
    if (liftsCache) return liftsCache;
    const seen = new Set(); const arr = [];
    ((typeof ExerciseUI !== 'undefined' && ExerciseUI.LIB) || []).forEach(([name, group, eq, uni, bw]) => {
      if (uni || bw || !LIFT_GROUPS.includes(group)) return;
      const n = norm(name);
      if (BASICS.some((b) => b.re.test(n) && !b.not.test(n))) return;     // ya es un básico
      const key = `c:${slug(name)}`;
      if (key.length < 4 || seen.has(key)) return;
      seen.add(key);
      arr.push({ key, name: cleanName(name), group, eq, libName: name });
    });
    liftsCache = arr;
    return arr;
  }
  // a qué prueba del ranking corresponde uno de tus ejercicios (o null)
  function liftOf(ex) {
    if (!ex || ex.group === 'cardio' || ex.group === 'movilidad') return null;
    const n = norm(ex.name);
    const b = BASICS.find((x) => x.re.test(n) && !x.not.test(n));
    if (b) return { key: b.key, name: b.name, group: 'básico' };
    if (ex.bodyweight || ex.unilateral) return null;
    const all = lifts();
    const exact = all.find((x) => norm(x.libName) === n);
    if (exact) return exact;
    // nombre abreviado en tu catálogo (p. ej. «Jalón al pecho» ↔ «Jalón al pecho en polea»)
    if (n.length >= 8) {
      // solo si en TODA la biblioteca hay una única coincidencia (si no, es ambiguo y no se adivina)
      const names = ((typeof ExerciseUI !== 'undefined' && ExerciseUI.LIB) || []).map((x) => x[0]);
      const cand = names.filter((nm) => norm(nm).startsWith(`${n} `));
      if (cand.length === 1) return all.find((x) => x.libName === cand[0]) || null;
    }
    return null;
  }
  // tus ejercicios propios (que no están en la biblioteca) también entran solos con el nombre que les pusiste
  const customOn = () => DB.getSettings().lbCustom !== false;
  function liftAny(ex) {
    const l = liftOf(ex);
    if (l) return l;
    if (!ex || !customOn() || ex.bodyweight || ex.unilateral || !LIFT_GROUPS.includes(ex.group)) return null;
    const key = `c:${slug(ex.name)}`;
    if (key.length < 4) return null;
    return { key, name: cleanName(ex.name), group: 'propio' };
  }
  const bestForLift = (key) => bestFor((e) => { const l = liftAny(e); return !!l && l.key === key; });

  // ---- publicación automática
  const PUB_KEY = 'gt_lbPub';          // lo último que sé que está publicado: { clave: e1rm }
  const pubMap = () => { try { return JSON.parse(localStorage.getItem(PUB_KEY) || '{}') || {}; } catch (e) { return {}; } };
  const savePub = (m) => { try { localStorage.setItem(PUB_KEY, JSON.stringify(m)); } catch (e) { /* sin almacenamiento */ } };
  const autoOn = () => DB.getSettings().lbAuto !== false;
  const setAuto = (v) => { const st = DB.getSettings(); st.lbAuto = !!v; DB.saveSettings(st); };
  let pubLoaded = false;
  function rememberMine(list) {
    const m = pubMap();
    (list || []).forEach((x) => { m[x.exercise_key] = Number(x.e1rm) || 0; });
    savePub(m);
  }
  async function publishBest(u, lift, best) {
    await rpc('gt_publish', { p_secret: u.secret, p_key: lift.key, p_name: lift.name, p_weight: Math.round(best.kg * 100) / 100, p_reps: best.reps });
    const m = pubMap(); m[lift.key] = best.e1rm; savePub(m);
  }
  const ERR_KEY = 'gt_lbErr';
  const saveErr = (msg) => { try { if (msg) localStorage.setItem(ERR_KEY, JSON.stringify({ msg, t: Date.now() })); else localStorage.removeItem(ERR_KEY); } catch (e) { /* sin almacenamiento */ } };
  const lastErr = () => { try { return JSON.parse(localStorage.getItem(ERR_KEY) || 'null'); } catch (e) { return null; } };
  const timers = {};
  // se llama cada vez que registras una serie: si mejora tu marca en un ejercicio del ranking, se publica sola
  function onSet(exerciseId) {
    const u = user();
    if (!u || !configured() || !autoOn()) return;
    clearTimeout(timers[exerciseId]);
    timers[exerciseId] = setTimeout(async () => {
      try {
        const ex = DB.getExercises().find((e) => e.id === exerciseId);
        const lift = liftAny(ex);
        if (!lift) return;
        const best = bestForLift(lift.key);
        if (!best || best.kg > 700) return;
        if (!pubLoaded) { rememberMine(await rpc('gt_my_scores', { p_secret: u.secret })); pubLoaded = true; }
        const prev = pubMap()[lift.key];
        if (prev && best.e1rm <= prev * 1.005) return;
        await publishBest(u, lift, best);
        saveErr(null);
        Utils.toast(`🌍 Marca publicada en el ranking: ${lift.name} ${Units.label(best.kg)} × ${best.reps}`);
        ui.mine = []; ui.list = null;
      } catch (e) {
        // sin conexión se reintenta solo; cualquier otro motivo se guarda para mostrarlo en «Mis marcas»
        if (!/conectarme/.test(e.message)) saveErr(e.message);
      }
    }, 1500);
  }
  // publica de una vez todas tus mejores marcas de ejercicios del ranking
  async function syncAll(u) {
    let n = 0;
    try { rememberMine(await rpc('gt_my_scores', { p_secret: u.secret })); pubLoaded = true; } catch (e) { return -1; }
    const seen = new Set();
    for (const ex of DB.getExercises()) {
      const lift = liftAny(ex);
      if (!lift || seen.has(lift.key)) continue;
      seen.add(lift.key);
      const best = bestForLift(lift.key);
      if (!best || best.kg > 700) continue;
      const prev = pubMap()[lift.key];
      if (prev && best.e1rm <= prev * 1.005) continue;
      try { await publishBest(u, lift, best); n += 1; } catch (e) { if (/conectarme/.test(e.message)) return n || -1; saveErr(e.message); if (/máximo de 40|sesión ya no/.test(e.message)) break; }
    }
    if (n >= 0) { try { localStorage.setItem('gt_lbSyncDay', Utils.todayISO()); } catch (e) { /* sin almacenamiento */ } }
    ui.mine = []; ui.list = null;
    return n;
  }
  // al abrir la app (una vez al día): pone al día lo que no se publicó, p. ej. series de otra versión o sin internet
  function dailySync() {
    const u = user();
    if (!u || !configured() || !autoOn()) return;
    let last = ''; try { last = localStorage.getItem('gt_lbSyncDay') || ''; } catch (e) { /* nada */ }
    if (last === Utils.todayISO()) return;
    setTimeout(() => { syncAll(u).then((n) => { if (n > 0) Utils.toast(`🌍 ${n} marca${n === 1 ? '' : 's'} publicada${n === 1 ? '' : 's'} en el ranking`); }).catch(() => {}); }, 4000);
  }

  // revisa cada ejercicio con series y dice si entra al ranking y, si no, por qué
  function diagnose() {
    const wl = DB.getWorkoutLog(); const counts = {};
    Object.keys(wl).forEach((d) => (wl[d].exercises || []).forEach((en) => {
      const n = (en.sets || []).filter(Metrics.isNormal).length;
      if (n) counts[en.exerciseId] = (counts[en.exerciseId] || 0) + n;
    }));
    return DB.getExercises().filter((e) => counts[e.id] && e.group !== 'cardio' && e.group !== 'movilidad').map((ex) => {
      const lift = liftAny(ex);
      let why = '';
      if (!lift) {
        if (ex.bodyweight) why = 'es de peso corporal (no se compara por peso)';
        else if (ex.unilateral) why = 'está marcado como unilateral (peso por lado)';
        else if (!LIFT_GROUPS.includes(ex.group)) why = `el grupo «${ex.group}» no entra al ranking`;
        else if (!customOn()) why = 'no está en la biblioteca y tus ejercicios propios están apagados';
        else why = 'su nombre no se puede usar';
      }
      return { ex, lift, why, sets: counts[ex.id], best: lift ? bestForLift(lift.key) : null, pub: lift ? ui.mine.find((m) => m.exercise_key === lift.key) : null };
    }).sort((a, b) => (a.lift ? 0 : 1) - (b.lift ? 0 : 1) || b.sets - a.sets);
  }

  // ---------------------------------------------------------------- pantalla
  let ui = { joining: false, auto: true, sex: null, key: 'banca', mine: [], list: null, listKey: null, listSex: null, exercises: [], loading: false, error: '' };
  let rootRef = null;
  const refresh = () => { if (rootRef) render(rootRef); };

  function render(root) {
    rootRef = root;
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    root.appendChild(view);
    if (!configured()) return renderSetup(view);
    const u = user();
    if (!u && ui.joining) return renderJoin(view);
    renderMain(view, u);          // sin usuario también se pueden ver las listas
  }

  // --- sin servidor
  function renderSetup(view) {
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('h3', { text: '🌍 Ranking global' }));
    card.appendChild(Utils.el('p', { text: 'Compite con otras personas en los básicos (press de banca, sentadilla, peso muerto…) y en ejercicios de la comunidad, en listas de hombres, mujeres o mixtas.' }));
    card.appendChild(Utils.el('div', { class: 'nut-hint', text: 'El ranking todavía no está conectado a un servidor. Cuando esté listo aparecerá aquí.' }));
    const det = Utils.el('details', { class: 'scan-raw', style: 'margin-top:12px;' });
    det.appendChild(Utils.el('summary', { text: 'Conectar servidor (solo quien administra la app)' }));
    const url = Utils.el('input', { type: 'url', placeholder: 'https://xxxx.supabase.co', value: (DB.getSettings().lbConfig || {}).url || '' });
    const key = Utils.el('input', { type: 'text', placeholder: 'Clave pública (anon / publishable)', value: (DB.getSettings().lbConfig || {}).key || '' });
    const save = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: 'Guardar' });
    save.addEventListener('click', () => {
      const s = DB.getSettings(); s.lbConfig = { url: url.value.trim(), key: key.value.trim() }; DB.saveSettings(s);
      Utils.toast('Servidor guardado'); refresh();
    });
    det.appendChild(Utils.el('div', { class: 'field', style: 'margin-top:8px;' }, [Utils.el('label', { text: 'URL del proyecto' }), url]));
    det.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Clave pública' }), key]));
    det.appendChild(save);
    card.appendChild(det);
    view.appendChild(card);
  }

  // --- sin usuario: crear o entrar
  function renderJoin(view) {
    let mode = 'new';
    const card = Utils.el('div', { class: 'card' });
    view.appendChild(card);
    let sex = ui.sex !== null ? ui.sex : (DB.getSettings().userSex || null);
    function paint() {
      card.innerHTML = '';
      card.appendChild(Utils.el('h3', { text: '🌍 Ranking global' }));
      card.appendChild(Utils.segmented([{ key: 'new', label: 'Crear usuario' }, { key: 'login', label: 'Ya tengo usuario' }], mode, (k) => { mode = k; paint(); }, true));
      const msg = Utils.el('div', { class: 'sm-warn hidden', style: 'margin-bottom:10px;' });
      const name = Utils.el('input', { type: 'text', maxlength: '24', placeholder: 'Tu nombre (o apodo)', autocomplete: 'off', value: DB.getSettings().userName || '' });
      const pass = Utils.el('input', { type: 'password', placeholder: mode === 'new' ? 'Contraseña (opcional, mín. 4)' : 'Contraseña', autocomplete: 'off' });
      if (mode === 'new') {
        card.appendChild(Utils.el('p', { class: 'small', text: 'Sin correo ni datos personales: solo un nombre visible en las listas. Publicas únicamente las marcas que tú decidas.' }));
      } else {
        card.appendChild(Utils.el('p', { class: 'small', text: 'Entra con tu nombre y contraseña para ver tus marcas en este celular.' }));
      }
      card.appendChild(msg);
      card.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre' }), name]));
      if (mode === 'new') {
        card.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 6px;', text: 'Para las listas de hombres / mujeres' }));
        const chips = Utils.el('div', { class: 'rt-chips' });
        [['M', 'Hombre'], ['F', 'Mujer'], [null, 'Prefiero no decir']].forEach(([v, t]) => {
          const c = Utils.el('button', { type: 'button', class: `rt-chip plain${sex === v ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
          c.addEventListener('click', () => { sex = v; ui.sex = v; chips.querySelectorAll('.rt-chip').forEach((x) => x.classList.remove('active')); c.classList.add('active'); });
          chips.appendChild(c);
        });
        card.appendChild(chips);
        card.appendChild(Utils.el('div', { class: 'small text-dim', text: 'Si prefieres no decirlo, aparecerás solo en la lista mixta.' }));
      }
      card.appendChild(Utils.el('div', { class: 'field', style: 'margin-top:10px;' }, [Utils.el('label', { text: mode === 'new' ? 'Contraseña (opcional)' : 'Contraseña' }), pass]));
      if (mode === 'new') card.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin:-4px 0 10px;', text: 'Solo sirve para entrar desde otro celular. Si no pones, no podrás recuperar tu usuario en otro dispositivo.' }));
      if (mode === 'new') {
        const autoChip = Utils.el('button', { class: `uni-chip${ui.auto !== false ? ' on' : ''}`, type: 'button', style: 'margin:4px 0 4px;' });
        const paintAuto = () => { autoChip.classList.toggle('on', ui.auto !== false); autoChip.textContent = ui.auto !== false ? '⚡ Publicar mis mejores marcas automáticamente' : '⚡ Publicar automáticamente (apagado: yo elijo)'; };
        autoChip.addEventListener('click', () => { ui.auto = ui.auto === false; paintAuto(); });
        paintAuto();
        card.appendChild(autoChip);
        card.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin:0 0 10px;', text: 'Solo ejercicios de la biblioteca de la app (y los básicos). Puedes cambiarlo cuando quieras en «Mis marcas».' }));
      }
      const go = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: mode === 'new' ? 'Crear mi usuario' : 'Entrar' });
      go.addEventListener('click', async () => {
        msg.classList.add('hidden');
        const n = name.value.trim();
        if (!n) { msg.textContent = 'Escribe tu nombre.'; msg.classList.remove('hidden'); return; }
        go.disabled = true; go.textContent = '…';
        try {
          const r = mode === 'new' ? await rpc('gt_register', { p_name: n, p_sex: sex, p_pass: pass.value || null }) : await rpc('gt_login', { p_name: n, p_pass: pass.value });
          setUser({ id: r.id, secret: r.secret, name: r.name, sex: r.sex || null });
          if (mode === 'new') setAuto(ui.auto !== false);
          pubLoaded = false;
          if (autoOn()) syncAll(user()).then((n) => { if (n > 0) { Utils.toast(`🌍 ${n} marca${n === 1 ? '' : 's'} publicada${n === 1 ? '' : 's'} automáticamente`); refresh(); } });
          Utils.toast(mode === 'new' ? `¡Bienvenido, ${r.name}!` : `Hola de nuevo, ${r.name}`);
          ui.mine = []; ui.list = null; ui.joining = false;
          refresh();
        } catch (e) {
          msg.textContent = e.message; msg.classList.remove('hidden');
          go.disabled = false; go.textContent = mode === 'new' ? 'Crear mi usuario' : 'Entrar';
        }
      });
      card.appendChild(go);
      card.appendChild(Utils.el('button', { class: 'link-btn small', type: 'button', style: 'margin-top:10px;', text: '← Solo ver el ranking', onclick: () => { ui.joining = false; refresh(); } }));
    }
    paint();
  }

  // --- usuario dentro
  function renderMain(view, u) {
    const head = Utils.el('div', { class: 'card lb-head' });
    if (u) {
      head.appendChild(Utils.el('div', { class: 'flex-between' }, [
        Utils.el('div', {}, [Utils.el('div', { class: 'eyebrow', text: '🌍 Ranking global' }), Utils.el('h3', { class: 'mb-0', text: `${u.name}${u.sex === 'M' ? ' ♂' : u.sex === 'F' ? ' ♀' : ''}` })]),
        Utils.el('button', { class: 'btn-small', type: 'button', text: 'Cuenta', onclick: () => openAccount(u) }),
      ]));
    } else {
      head.appendChild(Utils.el('div', { class: 'eyebrow', text: '🌍 Ranking global' }));
      head.appendChild(Utils.el('p', { class: 'small', style: 'margin:6px 0 10px;', text: 'Mira las listas cuando quieras. Para publicar tus marcas y salir en ellas, crea un usuario (solo un nombre, sin correo).' }));
      head.appendChild(Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: '➕ Crear usuario / Entrar', onclick: () => { ui.joining = true; refresh(); } }));
    }
    view.appendChild(head);

    view.appendChild(boardCard(u));
    if (!u) return;
    const mineHost = Utils.el('div');
    view.appendChild(mineHost);
    paintMine(mineHost, u);
    loadMine(u).then(() => paintMine(mineHost, u));
  }

  // ---- tabla
  function boardCard(u) {
    const card = Utils.el('div', { class: 'card' });
    const body = Utils.el('div');
    const exSel = Utils.el('select', { class: 'lb-select' });
    const groups = Utils.el('div');

    const fillSelect = () => {
      exSel.innerHTML = '';
      const count = (k) => { const x = ui.exercises.find((e) => e.exercise_key === k); return x ? Number(x.athletes) : 0; };
      const og1 = Utils.el('optgroup', { label: '⭐ Básicos' });
      BASICS.forEach((b) => og1.appendChild(Utils.el('option', { value: b.key, text: `${b.name}${count(b.key) ? ` (${count(b.key)})` : ''}` })));
      exSel.appendChild(og1);
      LIFT_GROUPS.forEach((g) => {
        const items = lifts().filter((l) => l.group === g);
        if (!items.length) return;
        const og = Utils.el('optgroup', { label: g.charAt(0).toUpperCase() + g.slice(1) });
        items.forEach((l) => og.appendChild(Utils.el('option', { value: l.key, text: `${l.name}${count(l.key) ? ` (${count(l.key)})` : ''}` })));
        exSel.appendChild(og);
      });
      const known = new Set(BASICS.map((b) => b.key).concat(lifts().map((l) => l.key)));
      const com = ui.exercises.filter((x) => !known.has(x.exercise_key));
      if (com.length) {
        const og2 = Utils.el('optgroup', { label: 'Otros de la comunidad' });
        com.forEach((x) => og2.appendChild(Utils.el('option', { value: x.exercise_key, text: `${x.exercise_name} (${x.athletes})` })));
        exSel.appendChild(og2);
      }
      exSel.value = ui.key;
      if (exSel.value !== ui.key) { ui.key = 'banca'; exSel.value = 'banca'; }
    };
    const paintGroups = () => {
      groups.innerHTML = '';
      groups.appendChild(Utils.segmented([{ key: 'all', label: '👥 Mixto' }, { key: 'M', label: '♂ Hombres' }, { key: 'F', label: '♀ Mujeres' }], ui.listSex || 'all', (k) => { ui.listSex = k; paintGroups(); load(); }, true));
    };
    async function load() {
      body.innerHTML = '';
      body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;padding:14px 0;', text: 'Cargando…' }));
      try {
        const sex = ui.listSex && ui.listSex !== 'all' ? ui.listSex : null;
        const rows = await rpc('gt_leaderboard', { p_key: ui.key, p_sex: sex, p_limit: 50 });
        paintRows(rows || []);
      } catch (e) {
        body.innerHTML = '';
        body.appendChild(Utils.el('div', { class: 'sm-warn', text: e.message }));
      }
    }
    function paintRows(rows) {
      body.innerHTML = '';
      if (!rows.length) { body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;padding:14px 0;', text: 'Nadie ha publicado esta marca todavía. ¡Sé la primera persona!' })); return; }
      const top = Number(rows[0].e1rm) || 1;
      const sexMark = (r) => (r.sex === 'M' ? ' ♂' : r.sex === 'F' ? ' ♀' : '');
      const isMe = (r) => !!u && norm(r.name) === norm(u.name);
      // podio con los 3 primeros (2.º · 1.º · 3.º)
      const pod = Utils.el('div', { class: 'lb-podium' });
      [1, 0, 2].forEach((i) => {
        const r = rows[i];
        if (!r) return;
        const medal = ['🥇', '🥈', '🥉'][i];
        pod.appendChild(Utils.el('div', { class: `lb-pod p${i + 1}${isMe(r) ? ' me' : ''}` }, [
          Utils.el('div', { class: 'lb-medal', text: medal }),
          Utils.el('div', { class: 'lb-av', text: (r.name || '?').trim().charAt(0).toUpperCase() }),
          Utils.el('div', { class: 'lb-pod-name', text: `${r.name}${sexMark(r)}` }),
          Utils.el('b', { class: 'lb-pod-e1', text: Units.label(Number(r.e1rm)) }),
          Utils.el('div', { class: 'lb-pod-sub', text: `${Units.label(Number(r.weight_kg))} × ${r.reps}` }),
          Utils.el('div', { class: 'lb-pod-bar' }),
        ]));
      });
      body.appendChild(pod);
      rows.slice(3).forEach((r) => {
        const me = isMe(r);
        const pct = Math.max(6, Math.round(((Number(r.e1rm) || 0) / top) * 100));
        body.appendChild(Utils.el('div', { class: `lb-row${me ? ' me' : ''}` }, [
          Utils.el('div', { class: 'lb-rank', text: String(r.rank) }),
          Utils.el('div', { class: 'lb-av sm', text: (r.name || '?').trim().charAt(0).toUpperCase() }),
          Utils.el('div', { class: 'lb-main' }, [
            Utils.el('div', { class: 'lb-name', text: `${r.name}${sexMark(r)}` }),
            Utils.el('div', { class: 'meta', text: `${Units.label(Number(r.weight_kg))} × ${r.reps}` }),
            Utils.el('div', { class: 'lb-bar' }, [Utils.el('i', { style: `width:${pct}%` })]),
          ]),
          Utils.el('div', { class: 'lb-e1' }, [Utils.el('b', { text: Units.label(Number(r.e1rm)) }), Utils.el('div', { class: 'small text-dim', text: '1RM est.' })]),
        ]));
      });
      body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Se ordena por 1RM estimado (fórmula de Epley), así una serie de 5 reps y una de 1 rep se pueden comparar.' }));
    }
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: '🏆 Lista' }), Utils.el('button', { class: 'btn-small', type: 'button', text: '↻', title: 'Actualizar', onclick: () => { loadExercises().then(fillSelect); load(); } })]));
    card.appendChild(groups);
    card.appendChild(Utils.el('div', { class: 'field' }, [exSel]));
    card.appendChild(body);
    exSel.addEventListener('change', () => { ui.key = exSel.value; load(); });
    fillSelect(); paintGroups(); load();
    loadExercises().then(() => { fillSelect(); });
    return card;
  }
  async function loadExercises() {
    try { ui.exercises = (await rpc('gt_exercises', {})) || []; } catch (e) { /* se queda con los básicos */ }
  }
  async function loadMine(u) {
    try { ui.mine = (await rpc('gt_my_scores', { p_secret: u.secret })) || []; rememberMine(ui.mine); pubLoaded = true; } catch (e) { /* sin conexión */ }
  }

  // ---- mis marcas
  function paintMine(host, u) {
    host.innerHTML = '';
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: '📤 Mis marcas' })]));

    // interruptor de publicación automática
    const auto = Utils.el('button', { class: `uni-chip${autoOn() ? ' on' : ''}`, type: 'button', style: 'margin:0 0 6px;', text: autoOn() ? '⚡ Publicación automática: activada' : '⚡ Publicación automática: apagada' });
    auto.addEventListener('click', () => { setAuto(!autoOn()); if (autoOn()) syncAll(u).then((n) => { if (n > 0) Utils.toast(`🌍 ${n} marca${n === 1 ? '' : 's'} publicada${n === 1 ? '' : 's'}`); loadMine(u).then(() => paintMine(host, u)); }); paintMine(host, u); });
    card.appendChild(auto);
    card.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin:0 0 8px;', text: autoOn()
      ? 'Cuando mejoras tu marca en un ejercicio de la biblioteca de la app, se publica sola con tu nombre. Aquí abajo puedes ajustar o quitar cada una.'
      : 'Nada se envía solo. Publica tú las marcas que quieras con los botones.' }));

    const keys = new Set();
    const rowsData = [];
    BASICS.forEach((b) => { keys.add(b.key); rowsData.push({ key: b.key, name: b.name, group: 'básico', local: bestForLift(b.key), pub: ui.mine.find((m) => m.exercise_key === b.key) }); });
    const used = new Set();
    DB.getExercises().forEach((e) => { const l = liftOf(e); if (l && !keys.has(l.key) && !used.has(l.key)) { used.add(l.key); } });
    used.forEach((k) => {
      const l = lifts().find((x) => x.key === k);
      if (!l) return;
      keys.add(k);
      rowsData.push({ key: k, name: l.name, group: l.group, local: bestForLift(k), pub: ui.mine.find((m) => m.exercise_key === k) });
    });
    // lo que ya publicaste y no está arriba (ejercicios propios)
    ui.mine.filter((m) => !keys.has(m.exercise_key)).forEach((m) => {
      const ex = DB.getExercises().find((e) => 'c:' + slug(e.name) === m.exercise_key);
      rowsData.push({ key: m.exercise_key, name: m.exercise_name, group: 'propio', local: ex ? bestOfExercise(ex.id) : null, pub: m });
    });
    const withData = rowsData.filter((r) => r.local || r.pub);
    const empty = rowsData.filter((r) => !r.local && !r.pub && r.group === 'básico');
    if (!withData.length) card.appendChild(Utils.el('p', { class: 'small text-dim', text: 'Registra series de los básicos o de ejercicios de la biblioteca y aparecerán aquí.' }));
    let lastG = '';
    withData.forEach((r) => {
      if (r.group !== lastG) { lastG = r.group; card.appendChild(Utils.el('div', { class: 'eyebrow mk-group', text: r.group === 'básico' ? '⭐ Básicos' : r.group })); }
      card.appendChild(markRow(u, r, host));
    });
    if (empty.length) card.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: `Aún sin registros: ${empty.map((r) => r.name).join(', ')}.` }));

    // si la última publicación falló por algo que no es internet, se muestra aquí
    const err = lastErr();
    if (err && err.msg) {
      const warn = Utils.el('div', { class: 'sm-warn', style: 'margin-top:10px;' }, [`⚠️ La última publicación automática falló: ${err.msg} `]);
      const dismiss = Utils.el('button', { class: 'link-btn small', type: 'button', text: 'Quitar aviso', onclick: () => { saveErr(null); paintMine(host, u); } });
      warn.appendChild(dismiss);
      card.appendChild(warn);
    }

    // incluir ejercicios propios
    const cust = Utils.el('button', { class: `uni-chip${customOn() ? ' on' : ''}`, type: 'button', style: 'margin:10px 0 4px;', text: customOn() ? '✓ Incluir también mis ejercicios propios' : 'Incluir también mis ejercicios propios (apagado)' });
    cust.addEventListener('click', () => { const st = DB.getSettings(); st.lbCustom = !customOn(); DB.saveSettings(st); if (customOn() && autoOn()) syncAll(u).then(() => loadMine(u).then(() => paintMine(host, u))); paintMine(host, u); });
    card.appendChild(cust);

    // revisión de todos tus ejercicios
    const diag = diagnose();
    if (diag.length) {
      const bad = diag.filter((x) => !x.lift).length; const pend = diag.filter((x) => x.lift && x.best && (!x.pub || x.best.e1rm > Number(x.pub.e1rm) * 1.005)).length;
      const det = Utils.el('details', { class: 'fold fold-flat diag-fold' });
      det.appendChild(Utils.el('summary', { class: 'fold-sum' }, [
        Utils.el('span', { class: 'fold-t', text: '🔍 Revisar mis ejercicios' }),
        Utils.el('span', { class: 'fold-sub', text: bad || pend ? `${pend} pendientes · ${bad} no entran` : 'todo al día' }),
        Utils.el('i', { class: 'fold-chev' }),
      ]));
      const list = Utils.el('div', { class: 'diag-list' });
      diag.forEach((x) => {
        const state = !x.lift ? 'no' : !x.best ? 'sin' : !x.pub ? 'pend' : x.best.e1rm > Number(x.pub.e1rm) * 1.005 ? 'pend' : 'ok';
        const label = { no: 'No entra', sin: 'Sin marca', pend: 'Por publicar', ok: 'Publicado ✓' }[state];
        list.appendChild(Utils.el('div', { class: 'diag-row' }, [
          Utils.el('div', { class: 'diag-main' }, [
            Utils.el('b', { text: x.ex.name }),
            Utils.el('span', { class: 'small text-dim', text: !x.lift ? `Motivo: ${x.why}.` : x.best ? `Mejor: ${Units.label(x.best.kg)} × ${x.best.reps} · cuenta como «${x.lift.name}»` : `Cuenta como «${x.lift.name}»` }),
          ]),
          Utils.el('span', { class: `diag-chip ${state}`, text: label }),
        ]));
      });
      det.appendChild(list);
      det.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin:8px 2px 0;', text: 'Cuentan las series normales con peso (no aproximaciones). Si algo dice «No entra», cámbialo en el ejercicio (quita «unilateral» o «peso corporal») o usa «Publicar un ejercicio propio».' }));
      card.appendChild(det);
    }

    const now = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:10px;', text: '⚡ Publicar ahora todas mis mejores marcas' });
    now.addEventListener('click', async () => {
      now.disabled = true; now.textContent = 'Publicando…';
      const n = await syncAll(u);
      Utils.toast(n < 0 ? 'No pude conectarme' : n ? `🌍 ${n} marca${n === 1 ? '' : 's'} publicada${n === 1 ? '' : 's'}` : 'Todo está al día ✓');
      await loadMine(u); paintMine(host, u);
    });
    card.appendChild(now);
    const add = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: '➕ Publicar un ejercicio propio' });
    add.addEventListener('click', () => openCommunityPicker(u, host));
    card.appendChild(add);
    host.appendChild(card);
  }

  function markRow(u, o, host) {
    const better = o.local && o.pub && o.local.e1rm > Number(o.pub.e1rm) * 1.005;
    const row = Utils.el('div', { class: 'mk-row' });
    const status = o.pub ? (better ? 'Mejor marca sin publicar' : 'Publicada') : (o.local ? 'Sin publicar' : '');
    row.appendChild(Utils.el('div', { class: 'mk-main' }, [
      Utils.el('div', { class: 'mk-name', text: o.name }),
      Utils.el('div', { class: 'meta', text: o.pub ? `${Units.label(Number(o.pub.weight_kg))} × ${o.pub.reps} · 1RM ${Units.label(Number(o.pub.e1rm))}${better ? ` · ahora ${Units.label(o.local.kg)} × ${o.local.reps}` : ''}` : o.local ? `Tu mejor: ${Units.label(o.local.kg)} × ${o.local.reps}` : 'Aún sin registros' }),
    ]));
    row.appendChild(Utils.el('span', { class: `mk-chip ${o.pub ? (better ? 'warn' : 'ok') : 'off'}`, text: o.pub ? (better ? '↑' : '✓') : '·', title: status }));
    const btn = Utils.el('button', { class: `btn-small${o.pub && !better ? '' : ' btn-primary-s'}`, type: 'button', text: o.pub ? (better ? 'Actualizar' : 'Editar') : 'Publicar' });
    btn.disabled = !o.local && !o.pub;
    btn.addEventListener('click', () => openPublish(u, o, host));
    row.appendChild(btn);
    return row;
  }

  function openPublish(u, o, host) {
    const unit = Units.current();
    const base = o.local || (o.pub ? { kg: Number(o.pub.weight_kg), reps: o.pub.reps } : { kg: 0, reps: 1 });
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: `Se mostrará en la lista pública con tu nombre «${u.name}». Puedes ajustar la marca antes de publicar.` }));
    const w = Utils.el('input', { type: 'number', inputmode: 'decimal', step: 'any', value: String(Units.num(base.kg, unit)) });
    const r = Utils.el('input', { type: 'number', inputmode: 'numeric', value: String(base.reps) });
    body.appendChild(Utils.el('div', { class: 'field-row' }, [
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: `Peso (${unit})` }), w]),
      Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Repeticiones' }), r]),
    ]));
    const est = Utils.el('div', { class: 'small text-dim', style: 'margin:-4px 0 10px;' });
    const upd = () => { const kg = Units.toKg(parseFloat(w.value) || 0, unit); const rp = parseInt(r.value, 10) || 0; est.textContent = kg > 0 && rp > 0 ? `1RM estimado: ${Units.label(Metrics.e1rm(kg, rp))}` : ''; };
    w.addEventListener('input', upd); r.addEventListener('input', upd); upd();
    const msg = Utils.el('div', { class: 'sm-warn hidden', style: 'margin-bottom:8px;' });
    body.appendChild(est); body.appendChild(msg);
    const go = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: o.pub ? 'Guardar cambios' : '📤 Publicar' });
    go.addEventListener('click', async () => {
      const kg = Units.toKg(parseFloat(w.value) || 0, unit); const rp = parseInt(r.value, 10);
      if (!(kg > 0) || !(rp >= 1 && rp <= 30)) { msg.textContent = 'Pon un peso y de 1 a 30 repeticiones.'; msg.classList.remove('hidden'); return; }
      go.disabled = true; go.textContent = '…';
      try {
        await rpc('gt_publish', { p_secret: u.secret, p_key: o.key, p_name: o.name, p_weight: Math.round(kg * 100) / 100, p_reps: rp });
        Modal.close(); Utils.toast('Marca publicada ✓');
        await loadMine(u); refresh();
      } catch (e) { msg.textContent = e.message; msg.classList.remove('hidden'); go.disabled = false; go.textContent = o.pub ? 'Guardar cambios' : '📤 Publicar'; }
    });
    body.appendChild(go);
    if (o.pub) {
      const del = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;color:var(--red);', text: '🗑️ Quitar de la lista' });
      del.addEventListener('click', async () => {
        try { await rpc('gt_remove', { p_secret: u.secret, p_key: o.key }); Modal.close(); Utils.toast('Marca quitada'); await loadMine(u); refresh(); } catch (e) { msg.textContent = e.message; msg.classList.remove('hidden'); }
      });
      body.appendChild(del);
    }
    Modal.open(`📤 ${o.name}`, body);
  }

  function openCommunityPicker(u, host) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Elige uno de tus ejercicios para publicar tu mejor marca. Otras personas que tengan el mismo ejercicio podrán competir contigo.' }));
    const search = Utils.el('input', { type: 'search', class: 'ax-search', placeholder: '🔎 Buscar ejercicio…' });
    const list = Utils.el('div');
    body.appendChild(search); body.appendChild(list);
    const mine = DB.getExercises().filter((e) => e.group !== 'cardio' && e.group !== 'movilidad');
    const paint = () => {
      list.innerHTML = '';
      const q = norm(search.value);
      const items = mine.filter((e) => !q || norm(e.name).includes(q)).map((e) => ({ e, best: bestOfExercise(e.id) })).filter((x) => x.best).sort((a, b) => b.best.e1rm - a.best.e1rm).slice(0, 60);
      if (!items.length) list.appendChild(Utils.el('p', { class: 'small text-dim', style: 'padding:12px 0;', text: 'No hay ejercicios con series registradas que coincidan.' }));
      items.forEach(({ e, best }) => {
        const r = Utils.el('div', { class: 'food-row' }, [
          Utils.el('div', { class: 'fr-main' }, [Utils.el('div', { class: 'fr-name', text: e.name }), Utils.el('div', { class: 'meta', text: `Tu mejor: ${Units.label(best.kg)} × ${best.reps}` })]),
          Utils.el('span', { class: 'fr-add', text: '+' }),
        ]);
        r.addEventListener('click', () => {
          const isBasic = BASICS.find((b) => basicMatch(b)(e));
          const key = isBasic ? isBasic.key : `c:${slug(e.name)}`;
          if (key.length < 4) { Utils.toast('Ese nombre no se puede publicar'); return; }
          openPublish(u, { key, name: isBasic ? isBasic.name : (e.name.replace(/[^\p{L}\p{N} ._()/+-]/gu, '').slice(0, 40) || 'Ejercicio'), local: best, pub: ui.mine.find((m) => m.exercise_key === key) }, host);
        });
        list.appendChild(r);
      });
    };
    search.addEventListener('input', paint); paint();
    Modal.open('➕ Publicar otro ejercicio', body);
  }

  function openAccount(u) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { text: `Sesión: ${u.name}${u.sex === 'M' ? ' (hombre)' : u.sex === 'F' ? ' (mujer)' : ''}` }));
    const out = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', text: 'Cerrar sesión en este celular' });
    out.addEventListener('click', () => { setUser(null); ui.mine = []; ui.joining = false; Modal.close(); refresh(); });
    const del = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;color:var(--red);', text: '🗑️ Borrar mi usuario y todas mis marcas' });
    del.addEventListener('click', async () => {
      if (!Utils.confirmDialog('Se borrará tu usuario y todas tus marcas publicadas. No se puede deshacer. ¿Continuar?')) return;
      try { await rpc('gt_delete_me', { p_secret: u.secret }); setUser(null); ui.mine = []; Modal.close(); Utils.toast('Usuario borrado'); refresh(); } catch (e) { Utils.toast(e.message); }
    });
    body.appendChild(out); body.appendChild(del);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: 'Tus entrenos, comidas y fotos nunca se envían: en el servidor solo existe tu nombre, tu sexo (si lo diste) y las marcas que publicaste.' }));
    Modal.open('👤 Mi cuenta', body);
  }

  return { render, configured, rpc, BASICS, onSet, syncAll, dailySync, diagnose, liftOf, liftAny, lifts };
})();
