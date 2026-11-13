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
    { key: 'banca', name: 'Press de banca', re: /press (de )?banca|banca plano|bench/, not: /mancuerna|inclinado|declinado|maquina|smith|agarre cerrado|cerrado/ },
    { key: 'sentadilla', name: 'Sentadilla', re: /sentadilla/, not: /bulgara|hack|goblet|sissy|maquina|smith|salto|pistol|bandas?/ },
    { key: 'peso_muerto', name: 'Peso muerto', re: /peso muerto/, not: /rumano|stiff|mancuerna|piernas rigidas|unilateral|una pierna/ },
    { key: 'press_militar', name: 'Press militar', re: /press militar/, not: /mancuerna|maquina|smith|arnold/ },
    { key: 'remo_barra', name: 'Remo con barra', re: /remo (con )?barra|pendlay/, not: /mancuerna|maquina|polea|t-?bar/ },
    { key: 'hip_thrust', name: 'Hip thrust', re: /hip thrust|empuje de cadera/, not: /maquina|mancuerna/ },
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

  // ---------------------------------------------------------------- pantalla
  let ui = { sex: null, key: 'banca', mine: [], list: null, listKey: null, listSex: null, exercises: [], loading: false, error: '' };
  let rootRef = null;
  const refresh = () => { if (rootRef) render(rootRef); };

  function render(root) {
    rootRef = root;
    root.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    root.appendChild(view);
    if (!configured()) return renderSetup(view);
    const u = user();
    if (!u) return renderJoin(view);
    renderMain(view, u);
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
    let sex = ui.sex;
    function paint() {
      card.innerHTML = '';
      card.appendChild(Utils.el('h3', { text: '🌍 Ranking global' }));
      card.appendChild(Utils.segmented([{ key: 'new', label: 'Crear usuario' }, { key: 'login', label: 'Ya tengo usuario' }], mode, (k) => { mode = k; paint(); }, true));
      const msg = Utils.el('div', { class: 'sm-warn hidden', style: 'margin-bottom:10px;' });
      const name = Utils.el('input', { type: 'text', maxlength: '24', placeholder: 'Tu nombre (o apodo)', autocomplete: 'off' });
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
      const go = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: mode === 'new' ? 'Crear mi usuario' : 'Entrar' });
      go.addEventListener('click', async () => {
        msg.classList.add('hidden');
        const n = name.value.trim();
        if (!n) { msg.textContent = 'Escribe tu nombre.'; msg.classList.remove('hidden'); return; }
        go.disabled = true; go.textContent = '…';
        try {
          const r = mode === 'new' ? await rpc('gt_register', { p_name: n, p_sex: sex, p_pass: pass.value || null }) : await rpc('gt_login', { p_name: n, p_pass: pass.value });
          setUser({ id: r.id, secret: r.secret, name: r.name, sex: r.sex || null });
          Utils.toast(mode === 'new' ? `¡Bienvenido, ${r.name}!` : `Hola de nuevo, ${r.name}`);
          ui.mine = []; ui.list = null;
          refresh();
        } catch (e) {
          msg.textContent = e.message; msg.classList.remove('hidden');
          go.disabled = false; go.textContent = mode === 'new' ? 'Crear mi usuario' : 'Entrar';
        }
      });
      card.appendChild(go);
    }
    paint();
  }

  // --- usuario dentro
  function renderMain(view, u) {
    const head = Utils.el('div', { class: 'card lb-head' });
    head.appendChild(Utils.el('div', { class: 'flex-between' }, [
      Utils.el('div', {}, [Utils.el('div', { class: 'eyebrow', text: '🌍 Ranking global' }), Utils.el('h3', { class: 'mb-0', text: `${u.name}${u.sex === 'M' ? ' ♂' : u.sex === 'F' ? ' ♀' : ''}` })]),
      Utils.el('button', { class: 'btn-small', type: 'button', text: 'Cuenta', onclick: () => openAccount(u) }),
    ]));
    view.appendChild(head);

    view.appendChild(boardCard(u));
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
      const og1 = Utils.el('optgroup', { label: 'Básicos' });
      BASICS.forEach((b) => og1.appendChild(Utils.el('option', { value: b.key, text: b.name })));
      exSel.appendChild(og1);
      const com = ui.exercises.filter((x) => !BASICS.some((b) => b.key === x.exercise_key));
      if (com.length) {
        const og2 = Utils.el('optgroup', { label: 'Comunidad' });
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
      rows.forEach((r) => {
        const me = norm(r.name) === norm(u.name);
        const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : String(r.rank);
        body.appendChild(Utils.el('div', { class: `lb-row${me ? ' me' : ''}` }, [
          Utils.el('div', { class: 'lb-rank', text: medal }),
          Utils.el('div', { class: 'lb-main' }, [
            Utils.el('div', { class: 'lb-name', text: `${r.name}${r.sex === 'M' ? ' ♂' : r.sex === 'F' ? ' ♀' : ''}` }),
            Utils.el('div', { class: 'meta', text: `${Units.label(Number(r.weight_kg))} × ${r.reps}` }),
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
    try { ui.mine = (await rpc('gt_my_scores', { p_secret: u.secret })) || []; } catch (e) { /* sin conexión */ }
  }

  // ---- mis marcas
  function paintMine(host, u) {
    host.innerHTML = '';
    const card = Utils.el('div', { class: 'card' });
    card.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: '📤 Mis marcas' })]));
    card.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin:-6px 0 8px;', text: 'Tu mejor serie de cada básico, calculada de tu historial. Solo se publica lo que toques.' }));
    BASICS.forEach((b) => {
      const local = bestBasic(b);
      const pub = ui.mine.find((m) => m.exercise_key === b.key);
      card.appendChild(markRow(u, { key: b.key, name: b.name, local, pub }, host));
    });
    // ejercicios de comunidad que ya publicaste
    ui.mine.filter((m) => m.exercise_key.startsWith('c:')).forEach((m) => {
      const id = (DB.getExercises().find((e) => 'c:' + slug(e.name) === m.exercise_key) || {}).id;
      card.appendChild(markRow(u, { key: m.exercise_key, name: m.exercise_name, local: id ? bestOfExercise(id) : null, pub: m }, host));
    });
    const add = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:10px;', text: '➕ Publicar otro ejercicio (comunidad)' });
    add.addEventListener('click', () => openCommunityPicker(u, host));
    card.appendChild(add);
    host.appendChild(card);
  }

  function markRow(u, o, host) {
    const better = o.local && o.pub && o.local.e1rm > Number(o.pub.e1rm) * 1.005;
    const row = Utils.el('div', { class: 'mk-row' });
    row.appendChild(Utils.el('div', { class: 'mk-main' }, [
      Utils.el('div', { class: 'mk-name', text: o.name }),
      Utils.el('div', { class: 'meta', text: o.pub ? `Publicado: ${Units.label(Number(o.pub.weight_kg))} × ${o.pub.reps}${better ? ' · ¡tienes una marca mejor!' : ''}` : o.local ? `Tu mejor: ${Units.label(o.local.kg)} × ${o.local.reps}` : 'Aún sin registros de este ejercicio' }),
    ]));
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
    out.addEventListener('click', () => { setUser(null); ui.mine = []; Modal.close(); refresh(); });
    const del = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;color:var(--red);', text: '🗑️ Borrar mi usuario y todas mis marcas' });
    del.addEventListener('click', async () => {
      if (!Utils.confirmDialog('Se borrará tu usuario y todas tus marcas publicadas. No se puede deshacer. ¿Continuar?')) return;
      try { await rpc('gt_delete_me', { p_secret: u.secret }); setUser(null); ui.mine = []; Modal.close(); Utils.toast('Usuario borrado'); refresh(); } catch (e) { Utils.toast(e.message); }
    });
    body.appendChild(out); body.appendChild(del);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: 'Tus entrenos, comidas y fotos nunca se envían: en el servidor solo existe tu nombre, tu sexo (si lo diste) y las marcas que publicaste.' }));
    Modal.open('👤 Mi cuenta', body);
  }

  return { render, configured, rpc, BASICS };
})();
