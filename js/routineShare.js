/* ============================================================
   routineShare.js — Compartir una rutina con otra persona que tenga
   MyGymTrack. La rutina viaja dentro de un enlace (o un código para
   pegar): no hay servidor de por medio. Quien la recibe ve qué trae,
   toca «Guardar rutina» y se agrega a su lista con el mismo nombre.
   Los ejercicios se buscan por nombre; los que no tenga se crean.
   ============================================================ */

const RoutineShare = (() => {
  const GROUPS = ['pecho', 'espalda', 'pierna', 'hombro', 'brazo', 'core', 'cardio', 'movilidad', 'otro'];
  const EQUIP = ['barra', 'mancuernas', 'maquina', 'polea', 'corporal', 'otro'];
  const COLORS = ['#e0663d', '#3d8de0', '#5fbf6f', '#e0c23d', '#c26fe0', '#e05a5a', '#7a7a85', '#3de0c2'];
  const MAX_ITEMS = 40;
  const PENDING = 'gt_rs_pending';

  // ---------- codificación ----------
  const toB64 = (s) => {
    const bytes = new TextEncoder().encode(s); let bin = '';
    bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const fromB64 = (t) => {
    let s = String(t).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
    const bin = atob(s); const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  };
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const clampInt = (v, a, b, d) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.max(a, Math.min(b, n)) : d; };
  const str = (v, max) => String(v === undefined || v === null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);

  // rutina de la app → objeto compacto para compartir
  function pack(routine) {
    const exs = DB.getExercises();
    const e = [];
    (routine.exercises || []).forEach((re) => {
      const ex = exs.find((x) => x.id === re.exerciseId);
      if (!ex) return;
      const it = { n: ex.name, g: ex.group, s: re.targetSets, r: re.targetReps };
      if (ex.equipment) it.q = ex.equipment;
      if (ex.unilateral) it.u = 1;
      if (ex.bodyweight) it.b = 1;
      if (re.ss) it.ss = re.ss;
      e.push(it);
    });
    return { v: 1, n: routine.name, c: routine.color, e };
  }
  const encode = (routine) => toB64(JSON.stringify(pack(routine)));

  // texto recibido (enlace, «MGT1.código» o código suelto) → rutina validada o null
  function extractCode(text) {
    const t = String(text || '').trim();
    let m = /[?&#]r=([A-Za-z0-9_-]+)/.exec(t); if (m) return m[1];
    m = /MGT1\.([A-Za-z0-9_-]+)/.exec(t); if (m) return m[1];
    return /^[A-Za-z0-9_-]{20,}$/.test(t) ? t : null;
  }
  function decode(code) {
    try {
      const d = JSON.parse(fromB64(code));
      if (!d || d.v !== 1 || !Array.isArray(d.e) || !d.e.length) return null;
      const items = d.e.slice(0, MAX_ITEMS).map((x) => {
        const name = str(x && x.n, 80); if (!name) return null;
        const it = { name, group: GROUPS.includes(x.g) ? x.g : 'otro', equipment: EQUIP.includes(x.q) ? x.q : '', uni: x.u ? 1 : 0, bw: x.b ? 1 : 0, sets: clampInt(x.s, 1, 20, 3), reps: str(x.r, 20) || '8-12' };
        const ss = str(x.ss, 14).replace(/[^A-Za-z0-9_-]/g, ''); if (ss) it.ss = ss;
        return it;
      }).filter(Boolean);
      if (!items.length) return null;
      return { name: str(d.n, 60) || 'Rutina compartida', color: /^#[0-9a-f]{6}$/i.test(d.c || '') ? d.c : COLORS[0], items };
    } catch (e) { return null; }
  }

  // ---------- guardar ----------
  function uniqueName(name) {
    const have = DB.getRoutines().map((r) => norm(r.name));
    if (!have.includes(norm(name))) return name;
    let i = 2; while (have.includes(norm(`${name} (${i})`))) i += 1;
    return `${name} (${i})`;
  }
  // devuelve { routine, created } (created = ejercicios que no tenías y se crearon)
  function save(plan, nameOverride) {
    const exs = DB.getExercises(); let created = 0;
    const items = plan.items.map((it) => {
      let ex = exs.find((x) => norm(x.name) === norm(it.name));
      if (!ex) {
        ex = { id: DB.uid(), name: it.name, group: it.group };
        if (it.equipment) ex.equipment = it.equipment;
        if (it.uni) ex.unilateral = true;
        if (it.bw) ex.bodyweight = true;
        exs.push(ex); created += 1;
      }
      const row = { exerciseId: ex.id, targetSets: it.sets, targetReps: it.reps };
      if (it.ss) row.ss = it.ss;
      return row;
    });
    if (created) DB.saveExercises(exs);
    const routines = DB.getRoutines();
    const routine = { id: DB.uid(), name: uniqueName(str(nameOverride, 60) || plan.name), color: plan.color, exercises: items };
    routines.push(routine);
    DB.saveRoutines(routines);
    return { routine, created };
  }

  // ---------- compartir ----------
  const baseUrl = () => location.origin + location.pathname.replace(/index\.html$/, '');
  const linkFor = (routine) => `${baseUrl()}?r=${encode(routine)}`;
  function messageFor(routine) {
    const p = pack(routine);
    const lines = p.e.map((it, i) => `${i + 1}. ${it.n} · ${it.s}×${it.r}`);
    return `🏋️ Te comparto mi rutina «${routine.name}» de MyGymTrack (${p.e.length} ejercicio${p.e.length === 1 ? '' : 's'}):\n${lines.join('\n')}\n\nÁbrela con la app y toca «Guardar rutina»:\n${linkFor(routine)}`;
  }
  async function copy(text, ok) {
    try { await navigator.clipboard.writeText(text); Utils.toast(ok); } catch (e) { Utils.toast('No pude copiar; mantén pulsado el texto'); }
  }
  function openShare(routineId) {
    const r = DB.getRoutines().find((x) => x.id === routineId);
    if (!r || !(r.exercises || []).length) { Utils.toast('Esta rutina no tiene ejercicios'); return; }
    const msg = messageFor(r); const link = linkFor(r);
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Mándala por WhatsApp o donde quieras. Quien tenga MyGymTrack la abre y toca «Guardar rutina»; se agrega con este mismo nombre.' }));
    body.appendChild(Utils.el('textarea', { rows: '8', readonly: 'true', class: 'rs-preview', 'aria-label': 'Mensaje que se enviará', text: msg }));
    if (navigator.share) {
      const sb = Utils.el('button', { type: 'button', class: 'btn-primary btn-block', style: 'margin-top:10px;', text: '📤 Compartir' });
      sb.addEventListener('click', async () => { try { await navigator.share({ text: msg }); } catch (e) { /* cerró la hoja */ } });
      body.appendChild(sb);
    }
    const cm = Utils.el('button', { type: 'button', class: navigator.share ? 'btn-secondary btn-block' : 'btn-primary btn-block', style: 'margin-top:8px;', text: '📋 Copiar mensaje' });
    cm.addEventListener('click', () => copy(msg, 'Mensaje copiado ✓'));
    const cl = Utils.el('button', { type: 'button', class: 'btn-secondary btn-block', style: 'margin-top:8px;', text: '🔗 Copiar solo el enlace' });
    cl.addEventListener('click', () => copy(link, 'Enlace copiado ✓'));
    body.appendChild(cm); body.appendChild(cl);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Si la otra persona usa la app instalada en iPhone, que copie el enlace y use «Importar rutina» dentro de Mis rutinas.' }));
    Modal.open('📤 Compartir rutina', body);
  }
  function shareButton(routineId, cls) {
    const b = Utils.el('button', { type: 'button', class: cls || 'btn-secondary btn-block', style: 'margin-top:8px;', text: '📤 Compartir esta rutina' });
    b.addEventListener('click', () => { Modal.close(); setTimeout(() => openShare(routineId), 260); });
    return b;
  }

  // ---------- recibir ----------
  function openImport(plan, after) {
    const have = DB.getExercises().map((x) => norm(x.name));
    const body = Utils.el('div');
    const nameInput = Utils.el('input', { type: 'text', value: plan.name, maxlength: '60', 'aria-label': 'Nombre de la rutina' });
    body.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Nombre' }), nameInput]));
    const missing = plan.items.filter((it) => !have.includes(norm(it.name))).length;
    body.appendChild(Utils.el('div', { class: 'small text-dim', text: `${plan.items.length} ejercicio${plan.items.length === 1 ? '' : 's'}${missing ? ` · ${missing} se agregarán a tu lista` : ' · ya tienes todos los ejercicios'}` }));
    const list = Utils.el('div', { class: 'rs-list' });
    plan.items.forEach((it, i) => {
      const isNew = !have.includes(norm(it.name));
      list.appendChild(Utils.el('div', { class: 'rs-row' }, [
        Utils.el('span', { class: 'rs-n', text: String(i + 1) }),
        Utils.el('span', { class: 'rs-t' }, [Utils.el('b', { text: it.name }), Utils.el('small', { text: `${it.sets} series · ${it.reps} reps${it.ss ? ' · superserie' : ''}` })]),
        isNew ? Utils.el('span', { class: 'rs-tag new', text: 'nuevo' }) : null,
      ]));
    });
    body.appendChild(list);
    const ok = Utils.el('button', { type: 'button', class: 'btn-primary btn-block', style: 'margin-top:12px;', text: '✓ Guardar rutina' });
    ok.addEventListener('click', () => {
      const { routine, created } = save(plan, nameInput.value);
      try { sessionStorage.removeItem(PENDING); } catch (e) { /* nada */ }
      Modal.close();
      Utils.toast(`✓ «${routine.name}» guardada${created ? ` (+${created} ejercicio${created === 1 ? '' : 's'})` : ''}`);
      if (after) after(routine);
      try { if (App.currentView === 'plan' || App.currentView === 'hoy') App.navigate(App.currentView, App.currentParams); } catch (e) { /* nada */ }
    });
    const no = Utils.el('button', { type: 'button', class: 'link-btn small', style: 'margin-top:8px;', text: 'Ahora no' });
    no.addEventListener('click', () => { try { sessionStorage.removeItem(PENDING); } catch (e) { /* nada */ } Modal.close(); });
    body.appendChild(ok); body.appendChild(no);
    Modal.open('📥 Rutina compartida', body, { onClose: () => { try { sessionStorage.removeItem(PENDING); } catch (e) { /* nada */ } } });
  }

  // pegar un enlace o código
  function openPaste(after) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Pega aquí el enlace (o el mensaje completo) que te mandaron.' }));
    const ta = Utils.el('textarea', { rows: '4', placeholder: 'Pega el enlace de la rutina…', 'aria-label': 'Enlace de la rutina' });
    body.appendChild(ta);
    const go = Utils.el('button', { type: 'button', class: 'btn-primary btn-block', style: 'margin-top:10px;', text: 'Ver la rutina' });
    go.addEventListener('click', () => {
      const code = extractCode(ta.value); const plan = code ? decode(code) : null;
      if (!plan) { Utils.toast('No encuentro una rutina en ese texto'); return; }
      Modal.close(); setTimeout(() => openImport(plan, after), 260);
    });
    body.appendChild(go);
    Modal.open('📥 Importar rutina', body);
    setTimeout(() => { try { ta.focus(); } catch (e) { /* nada */ } }, 350);
  }

  // al abrir la app con ?r=… (enlace compartido)
  function takeFromUrl() {
    let code = null;
    try { code = new URLSearchParams(location.search).get('r'); } catch (e) { return; }
    if (!code) return;
    try { history.replaceState(null, '', location.pathname); } catch (e) { /* nada */ }
    try { sessionStorage.setItem(PENDING, code); } catch (e) { /* nada */ }
  }
  // muestra la rutina pendiente cuando no haya otra ventana abierta
  function checkLink(tries) {
    let code = null;
    try { code = sessionStorage.getItem(PENDING); } catch (e) { return; }
    if (!code) return;
    if (document.querySelector('.modal-backdrop:not(.closing)') || document.querySelector('.lvlup')) { if ((tries || 0) < 25) setTimeout(() => checkLink((tries || 0) + 1), 1000); return; }
    const plan = decode(code);
    try { sessionStorage.removeItem(PENDING); } catch (e) { /* nada */ }
    if (!plan) { Utils.toast('El enlace de la rutina no es válido'); return; }
    openImport(plan);
  }

  return { pack, encode, decode, extractCode, save, linkFor, messageFor, openShare, openPaste, openImport, shareButton, takeFromUrl, checkLink };
})();
