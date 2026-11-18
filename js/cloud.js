/* ============================================================
   cloud.js — Cuenta (correo + contraseña) y respaldo en la nube.

   · Servidor: Supabase Auth + tabla gt_cloud_backup (ver supabase/cloud.sql).
     Cada persona solo puede ver y tocar su propia fila.
   · Se guarda UNA copia completa de tus datos (lo mismo que "Exportar
     mis datos"; las fotos no van). Se sube sola unos segundos después de
     cada cambio y al salir de la app; al abrir en otro celular con la
     misma cuenta se baja.
   · Si cambias algo en dos dispositivos a la vez, la app te pregunta con
     cuál versión quedarte. Antes de reemplazar tus datos locales se hace
     una copia interna (Más → Copia de seguridad → copias de los últimos días).
   · La sesión y el estado de sync viven FUERA del respaldo (gt_cloud*).
   ============================================================ */

const Cloud = (() => {
  const SESSION_KEY = 'gt_cloudSession';
  const META_KEY = 'gt_cloudMeta';
  const KEEP_LOCAL = ['themeScheme', 'autoBackup', 'lbConfig'];   // ajustes propios de cada aparato
  const UPLOAD_DELAY = 25000;

  let timer = null;
  let running = false;
  let applying = false;
  let changeSeq = 0;
  let lastCheck = 0;
  const listeners = new Set();

  // ---------------------------------------------------------------- estado local
  function lget(key, fb) { try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch (e) { return fb; } }
  function lset(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* sin espacio */ } }
  const session = () => lget(SESSION_KEY, null);
  const meta = () => Object.assign({ serverAt: null, dirty: false, lastOk: 0, lastError: '', autoOn: true }, lget(META_KEY, {}));
  function setMeta(patch) { lset(META_KEY, Object.assign(meta(), patch)); listeners.forEach((f) => { try { f(); } catch (e) { /* vista cerrada */ } }); }
  const signedIn = () => !!(session() && session().refresh_token);
  const email = () => (session() && session().email) || '';
  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
  const notify = () => listeners.forEach((f) => { try { f(); } catch (e) { /* vista cerrada */ } });

  // ---------------------------------------------------------------- conexión
  function conf() {
    const c = window.GT_CONFIG || {};
    const o = (DB.getSettings().lbConfig) || {};
    return { url: String(o.url || c.supabaseUrl || '').replace(/\/+$/, ''), key: String(o.key || c.supabaseKey || '') };
  }
  // la nube se muestra solo cuando GT_CONFIG.cloud es true (después de correr supabase/cloud.sql)
  const configured = () => { const c = conf(); return !!(c.url && c.key && (window.GT_CONFIG || {}).cloud === true); };

  async function api(path, opts = {}) {
    const c = conf();
    if (!c.url || !c.key) throw new Error('No hay servidor configurado.');
    const headers = Object.assign({ apikey: c.key }, opts.headers || {});
    if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const t = setTimeout(() => { if (ctl) ctl.abort(); }, opts.timeout || 20000);
    let res;
    try {
      res = await fetch(`${c.url}${path}`, { method: opts.method || 'GET', headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: ctl ? ctl.signal : undefined });
    } catch (e) {
      const err = new Error('No pude conectarme. Revisa tu internet.'); err.offline = true; throw err;
    } finally { clearTimeout(t); }
    let json = null;
    try { const txt = await res.text(); json = txt ? JSON.parse(txt) : null; } catch (e) { json = null; }
    return { ok: res.ok, status: res.status, json };
  }

  const AUTH_ERRORS = {
    invalid_credentials: 'Correo o contraseña incorrectos.',
    email_not_confirmed: 'Falta confirmar tu correo: abre el mensaje que te llegó y luego entra.',
    user_already_exists: 'Ese correo ya tiene cuenta. Toca "Entrar".',
    weak_password: 'Contraseña muy débil: usa al menos 6 caracteres.',
    over_email_send_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    over_request_rate_limit: 'Demasiados intentos. Espera unos minutos y vuelve a probar.',
    signup_disabled: 'El registro de cuentas está cerrado por ahora.',
    validation_failed: 'Revisa el correo y la contraseña.',
  };
  function authMessage(r) {
    const j = r.json || {};
    const code = j.error_code || j.code;
    if (AUTH_ERRORS[code]) return AUTH_ERRORS[code];
    const m = String(j.msg || j.error_description || j.message || '').toLowerCase();
    if (m.includes('invalid login')) return AUTH_ERRORS.invalid_credentials;
    if (m.includes('not confirmed')) return AUTH_ERRORS.email_not_confirmed;
    if (m.includes('already')) return AUTH_ERRORS.user_already_exists;
    if (m.includes('password')) return AUTH_ERRORS.weak_password;
    if (r.status === 429) return AUTH_ERRORS.over_request_rate_limit;
    return j.msg || j.error_description || j.message || 'No se pudo. Intenta de nuevo.';
  }

  function storeSession(j) {
    if (!j || !j.access_token) return false;
    lset(SESSION_KEY, {
      access_token: j.access_token,
      refresh_token: j.refresh_token,
      expires_at: j.expires_at || Math.floor(Date.now() / 1000) + (j.expires_in || 3600),
      email: (j.user && j.user.email) || email(),
      uid: (j.user && j.user.id) || (session() && session().uid) || '',
    });
    return true;
  }

  // token vigente (renueva si está por vencer)
  async function token() {
    const s = session();
    if (!s) return null;
    if (s.expires_at - 60 > Date.now() / 1000) return s.access_token;
    const r = await api('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh_token } });
    if (r.ok && storeSession(r.json)) return session().access_token;
    if (r.status === 400 || r.status === 401) { signOutLocal(); throw new Error('Tu sesión venció. Entra de nuevo.'); }
    throw new Error('No pude renovar la sesión.');
  }

  function signOutLocal() {
    clearTimeout(timer);
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* nada */ }
    setMeta({ serverAt: null, dirty: false, lastError: '' });
  }

  // ---------------------------------------------------------------- cuenta
  async function signUp(mail, pass) {
    const r = await api('/auth/v1/signup', { method: 'POST', body: { email: mail, password: pass } });
    if (!r.ok) throw new Error(authMessage(r));
    if (storeSession(r.json)) return { needsConfirm: false };
    return { needsConfirm: true };
  }
  async function signIn(mail, pass) {
    const r = await api('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: mail, password: pass } });
    if (!r.ok) throw new Error(authMessage(r));
    storeSession(r.json);
  }
  async function recover(mail) {
    const back = encodeURIComponent(location.origin + location.pathname);
    const r = await api(`/auth/v1/recover?redirect_to=${back}`, { method: 'POST', body: { email: mail } });
    if (!r.ok) throw new Error(authMessage(r));
  }
  async function setPassword(pass) {
    const tk = await token();
    const r = await api('/auth/v1/user', { method: 'PUT', token: tk, body: { password: pass } });
    if (!r.ok) throw new Error(authMessage(r));
    if (r.json && r.json.id) lset(SESSION_KEY, Object.assign({}, session(), { uid: r.json.id, email: r.json.email || email() }));
  }
  // llama a una función del servidor con tu sesión (p. ej. la búsqueda de alimentos)
  async function rpcAuth(fn, args) {
    const tk = await token();
    const r = await api(`/rest/v1/rpc/${fn}`, { method: 'POST', token: tk, body: args || {}, timeout: 25000 });
    if (!r.ok) {
      const code = r.json && r.json.message ? String(r.json.message) : '';
      const e = new Error(code === 'upstream_busy' ? 'busy' : code === 'too_many_searches' ? 'Hiciste muchas búsquedas esta hora. Intenta más tarde.' : code === 'not_auth' ? 'Tu sesión venció. Entra de nuevo.' : 'No pude buscar ahora.');
      e.code = code;
      throw e;
    }
    return r.json;
  }
  async function deleteAccount() {
    const tk = await token();
    const r = await api('/rest/v1/rpc/gt_cloud_delete_me', { method: 'POST', token: tk, body: {} });
    if (!r.ok) throw new Error('No pude borrar la cuenta. Intenta de nuevo.');
    signOutLocal();
  }

  // ---------------------------------------------------------------- datos en la nube
  async function remoteMeta() {
    const tk = await token();
    const r = await api('/rest/v1/gt_cloud_backup?select=updated_at,device,size', { token: tk });
    if (!r.ok) throw new Error('No pude leer tu copia en la nube.');
    return (r.json && r.json[0]) || null;
  }
  async function remoteData() {
    const tk = await token();
    const r = await api('/rest/v1/gt_cloud_backup?select=data,updated_at,device', { token: tk, timeout: 60000 });
    if (!r.ok) throw new Error('No pude descargar tu copia.');
    return (r.json && r.json[0]) || null;
  }
  function deviceLabel() {
    const ua = navigator.userAgent || '';
    const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac/.test(ua) ? 'Mac' : 'otro';
    const app = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true ? 'app' : 'navegador';
    return `${os} · ${app}`;
  }
  // el enlace de "olvidé mi contraseña" no trae el usuario: se pide una vez
  async function ensureUser(tk) {
    const s = session();
    if (s && s.uid) return s.uid;
    const r = await api('/auth/v1/user', { token: tk });
    if (!r.ok || !r.json || !r.json.id) throw new Error('No pude identificar tu cuenta. Entra de nuevo.');
    lset(SESSION_KEY, Object.assign({}, session(), { uid: r.json.id, email: r.json.email || '' }));
    return r.json.id;
  }
  async function upload() {
    const tk = await token();
    const uid = await ensureUser(tk);
    const seq = changeSeq;
    const data = DB.exportAll();
    // tu usuario del ranking viaja dentro de tu copia privada para recuperarlo en otro teléfono
    try { const lb = typeof Leaderboard !== 'undefined' ? Leaderboard.user() : null; if (lb) data.__lbUser = lb; } catch (e) { /* sin ranking */ }
    const size = JSON.stringify(data).length;
    if (size > 7900000) throw new Error('Tus datos son demasiado grandes para la nube (más de 8 MB).');
    const r = await api('/rest/v1/gt_cloud_backup?on_conflict=user_id&select=updated_at', {
      method: 'POST',
      token: tk,
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: { user_id: uid, data, device: deviceLabel(), size },
      timeout: 60000,
    });
    if (!r.ok) throw new Error('No pude subir tu copia. Intenta de nuevo.');
    const at = r.json && r.json[0] && r.json[0].updated_at;
    setMeta({ serverAt: at || meta().serverAt, dirty: seq !== changeSeq, lastOk: Date.now(), lastError: '' });
    return at;
  }

  // reemplaza tus datos locales por los de la nube (con copia interna antes)
  async function apply(row) {
    applying = true;
    try {
      try { await AutoBackup.snapshot(); } catch (e) { /* la copia interna es un extra */ }
      const keep = {};
      const cur = DB.getSettings();
      KEEP_LOCAL.forEach((k) => { if (cur[k] !== undefined) keep[k] = cur[k]; });
      DB.importAll(row.data);
      try { if (row.data && row.data.__lbUser && typeof Leaderboard !== 'undefined') Leaderboard.adopt(row.data.__lbUser); } catch (e) { /* sin ranking */ }
      const next = DB.getSettings();
      Object.assign(next, keep);
      DB.saveSettings(next);
      setMeta({ serverAt: row.updated_at, dirty: false, lastOk: Date.now(), lastError: '' });
    } finally { applying = false; }
    try { Theme.apply(); } catch (e) { /* sin tema */ }
    try { App.navigate(App.currentView, App.currentParams); } catch (e) { /* sin vista */ }
  }

  // ¿este aparato ya tiene datos propios (no solo los de fábrica)?
  function hasUserData() {
    const full = (v) => (Array.isArray(v) ? v.length > 0 : v && typeof v === 'object' ? Object.keys(v).length > 0 : false);
    const d = DB.exportAll();
    return full(d.gt_workoutLog) || full(d.gt_calorieLog) || full(d.gt_measurements) || full(d.gt_waterLog) || full(d.gt_sleepLog);
  }

  const when = (iso) => { try { return new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };

  // preguntar con cuál versión quedarse
  function askConflict(remote, reason) {
    return new Promise((resolve) => {
      const body = Utils.el('div');
      body.appendChild(Utils.el('p', { text: reason }));
      body.appendChild(Utils.el('p', { class: 'small', text: `Copia en la nube: ${when(remote.updated_at)}${remote.device ? ` · ${remote.device}` : ''}.` }));
      let done = false;
      const finish = (v) => { if (done) return; done = true; Modal.close(); resolve(v); };
      const cloudBtn = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: '☁️ Quedarme con la nube (reemplaza este teléfono)' });
      const phoneBtn = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: '📱 Quedarme con este teléfono (reemplaza la nube)' });
      const laterBtn = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: 'Decidir después' });
      cloudBtn.addEventListener('click', () => finish('cloud'));
      phoneBtn.addEventListener('click', () => finish('phone'));
      laterBtn.addEventListener('click', () => finish('later'));
      body.appendChild(cloudBtn); body.appendChild(phoneBtn); body.appendChild(laterBtn);
      body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Antes de reemplazar tus datos aquí se guarda una copia interna, por si te arrepientes.' }));
      Modal.open('☁️ Dos versiones de tus datos', body, { onClose: () => finish('later') });
    });
  }

  // revisa la nube y deja todo al día; { manual } muestra mensajes y permite forzar
  async function sync(opts = {}) {
    if (!signedIn() || !configured() || running) return 'ocupado';
    if (!opts.manual && !meta().autoOn) return 'apagado';
    running = true;
    lastCheck = Date.now();
    try {
      const m = meta();
      const remote = await remoteMeta();
      if (!remote) {
        if (hasUserData() || opts.manual) { await upload(); return 'subido'; }
        setMeta({ lastOk: Date.now(), lastError: '' });
        return 'vacio';
      }
      const sameAsLastSync = !!m.serverAt && remote.updated_at === m.serverAt;
      if (sameAsLastSync) {
        if (m.dirty || opts.manual) { await upload(); return 'subido'; }
        setMeta({ lastOk: Date.now(), lastError: '' });
        return 'al-dia';
      }
      // la nube tiene algo distinto a lo último que sincronizamos
      const row = await remoteData();
      if (!row) { await upload(); return 'subido'; }
      const localHas = hasUserData();
      if (!localHas || (m.serverAt && !m.dirty)) {
        await apply(row);
        if (opts.manual || !localHas) Utils.toast('☁️ Tus datos se bajaron de la nube');
        return 'bajado';
      }
      const reason = m.serverAt
        ? 'Hiciste cambios en este teléfono y también hubo cambios desde otro dispositivo. ¿Con cuál versión te quedas?'
        : 'Esta cuenta ya tiene datos en la nube y este teléfono también tiene los suyos. ¿Con cuál versión te quedas?';
      const choice = await askConflict(row, reason);
      if (choice === 'cloud') { await apply(row); Utils.toast('☁️ Listo: ahora tienes los datos de la nube'); return 'bajado'; }
      if (choice === 'phone') { await upload(); Utils.toast('☁️ La nube ahora tiene los datos de este teléfono'); return 'subido'; }
      setMeta({ lastError: 'Pendiente: elegir qué versión conservar' });
      return 'pendiente';
    } catch (e) {
      setMeta({ lastError: e.message || 'Error de sincronización' });
      if (opts.manual) Utils.toast(e.message || 'No pude sincronizar');
      return 'error';
    } finally { running = false; }
  }

  // los datos cambiaron: subir en unos segundos (junta varios cambios seguidos)
  function touch() {
    if (applying || !signedIn()) return;
    changeSeq += 1;
    if (!meta().dirty) setMeta({ dirty: true });
    if (!meta().autoOn) return;
    clearTimeout(timer);
    timer = setTimeout(() => { if (meta().dirty) sync(); }, UPLOAD_DELAY);
  }

  // ---------------------------------------------------------------- recuperar contraseña (enlace del correo)
  function handleLink() {
    const h = location.hash || '';
    if (!h.includes('access_token') && !h.includes('error_description')) return;
    const p = new URLSearchParams(h.replace(/^#/, ''));
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* sin history */ }
    if (p.get('error_description')) { Utils.toast(String(p.get('error_description')).replace(/\+/g, ' ')); return; }
    if (p.get('type') === 'recovery' && p.get('access_token')) {
      storeSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: Number(p.get('expires_in')) || 3600 });
      // el correo no viene en el enlace: se completa al renovar la sesión
      setTimeout(openNewPassword, 600);
    }
  }
  function openNewPassword() {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { text: 'Escribe tu nueva contraseña.' }));
    const pass = Utils.el('input', { type: 'password', autocomplete: 'new-password', placeholder: 'Nueva contraseña (mínimo 6)', minlength: '6' });
    body.appendChild(Utils.el('div', { class: 'field' }, [pass]));
    const btn = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: 'Guardar contraseña' });
    btn.addEventListener('click', async () => {
      if (pass.value.length < 6) { Utils.toast('Mínimo 6 caracteres'); return; }
      btn.disabled = true;
      try { await setPassword(pass.value); Modal.close(); Utils.toast('Contraseña actualizada ✓'); setTimeout(() => sync({ manual: true }), 400); } catch (e) { btn.disabled = false; Utils.toast(e.message); }
    });
    body.appendChild(btn);
    Modal.open('🔑 Nueva contraseña', body);
  }

  // ---------------------------------------------------------------- interfaz (tarjeta en Más)
  const ago = (ts) => {
    if (!ts) return 'nunca';
    const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'hace un momento';
    if (s < 3600) return `hace ${Math.round(s / 60)} min`;
    if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
    return `hace ${Math.round(s / 86400)} d`;
  };

  // ---- ranking: al crear la cuenta se ofrece aparecer con un nombre (se guarda la intención hasta el primer ingreso)
  const INTENT_KEY = 'gt_lbIntent';
  const getIntent = () => { try { return JSON.parse(localStorage.getItem(INTENT_KEY) || 'null'); } catch (e) { return null; } };
  const setIntent = (v) => { try { if (v) localStorage.setItem(INTENT_KEY, JSON.stringify(v)); else localStorage.removeItem(INTENT_KEY); } catch (e) { /* nada */ } };
  const lbReady = () => typeof Leaderboard !== 'undefined' && Leaderboard.configured();
  const suggestName = (mail) => {
    const st = DB.getSettings();
    const raw = st.userName || String(mail || email() || '').split('@')[0];
    return (typeof Leaderboard !== 'undefined' ? Leaderboard.rankName(raw) : raw).slice(0, 24);
  };
  let joining = false;
  async function joinNow(name) {
    if (joining || !lbReady() || Leaderboard.user()) return;
    joining = true;
    try {
      const r = await Leaderboard.autoJoin(name);
      setIntent(null);
      Utils.toast(`🌍 Ya apareces en el ranking como ${r.user.name}${r.published ? ` · ${r.published} marca${r.published === 1 ? '' : 's'} publicada${r.published === 1 ? '' : 's'}` : ''}`);
    } catch (e) { setIntent(null); Utils.toast(`Ranking: ${e.message}`); }
    joining = false;
    notify();
  }
  function pendingIntent() { const it = getIntent(); if (it && signedIn() && lbReady() && !Leaderboard.user()) joinNow(it.name); }

  function card() {
    const box = Utils.el('div', { class: 'card cloud-card' });
    let msg = '';
    let busy = false;

    function paint() {
      box.innerHTML = '';
      box.appendChild(Utils.el('h3', { text: '☁️ Cuenta y nube' }));
      if (!configured()) { box.appendChild(Utils.el('p', { class: 'small', text: 'La nube no está disponible en esta versión.' })); return; }
      if (signedIn()) paintIn(); else paintOut();
    }

    function note(text, cls) { return Utils.el('div', { class: cls || 'backup-last', text }); }

    function paintOut() {
      box.appendChild(Utils.el('p', { text: 'Crea tu cuenta para guardar tus datos en la nube: si cambias o pierdes el teléfono, entras con tu correo y todo vuelve. También sirve para usar la app en varios dispositivos.' }));
      const mail = Utils.el('input', { type: 'email', autocomplete: 'email', placeholder: 'Tu correo', inputmode: 'email' });
      const pass = Utils.el('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Contraseña (mínimo 6)' });
      box.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Correo' }), mail]));
      box.appendChild(Utils.el('div', { class: 'field' }, [Utils.el('label', { text: 'Contraseña' }), pass]));
      if (msg) box.appendChild(note(msg, 'backup-last due'));
      // ranking (opcional)
      let rankOn = true; let rankIn = null;
      if (lbReady() && !Leaderboard.user()) {
        const chip = Utils.el('button', { type: 'button', class: 'uni-chip on', style: 'margin:6px 0 4px;' });
        rankIn = Utils.el('input', { type: 'text', maxlength: '24', placeholder: 'Nombre que verán otros en el ranking', value: suggestName(mail.value) });
        const paintRank = () => { chip.classList.toggle('on', rankOn); chip.textContent = rankOn ? '🌍 Aparecer en el ranking (tocar para no)' : '🌍 No aparecer en el ranking'; rankIn.classList.toggle('hidden', !rankOn); };
        chip.addEventListener('click', () => { rankOn = !rankOn; paintRank(); });
        paintRank();
        box.appendChild(chip);
        box.appendChild(rankIn);
        box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin:2px 0 8px;', text: 'Solo se publica ese nombre y tus mejores marcas de fuerza (peso × repeticiones). Puedes salir cuando quieras.' }));
      }
      const saveIntent = () => { if (rankOn && rankIn) setIntent({ name: rankIn.value.trim() || suggestName(mail.value) }); else setIntent(null); };
      const row = Utils.el('div', { class: 'cloud-row' });
      const inBtn = Utils.el('button', { class: 'btn-primary', type: 'button', text: 'Entrar' });
      const upBtn = Utils.el('button', { class: 'btn-secondary', type: 'button', text: 'Crear cuenta' });
      const check = () => {
        const m = mail.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(m)) { Utils.toast('Escribe un correo válido'); return null; }
        if (pass.value.length < 6) { Utils.toast('La contraseña necesita al menos 6 caracteres'); return null; }
        return m;
      };
      inBtn.addEventListener('click', async () => {
        const m = check(); if (!m || busy) return;
        busy = true; inBtn.disabled = upBtn.disabled = true; inBtn.textContent = 'Entrando…';
        saveIntent();
        try { await signIn(m, pass.value); msg = ''; paint(); await sync({ manual: true }); pendingIntent(); } catch (e) { msg = e.message; busy = false; paint(); return; }
        busy = false; paint();
      });
      upBtn.addEventListener('click', async () => {
        const m = check(); if (!m || busy) return;
        busy = true; inBtn.disabled = upBtn.disabled = true; upBtn.textContent = 'Creando…';
        try {
          saveIntent();
          const r = await signUp(m, pass.value);
          if (r.needsConfirm) { msg = 'Te mandé un correo para confirmar tu cuenta. Ábrelo y luego toca "Entrar".'; } else { msg = ''; paint(); await sync({ manual: true }); pendingIntent(); }
        } catch (e) { msg = e.message; }
        busy = false; paint();
      });
      row.appendChild(inBtn); row.appendChild(upBtn);
      box.appendChild(row);
      const forgot = Utils.el('button', { class: 'link-btn small', type: 'button', text: '¿Olvidaste tu contraseña?' });
      forgot.addEventListener('click', async () => {
        const m = mail.value.trim();
        if (!/^\S+@\S+\.\S+$/.test(m)) { Utils.toast('Escribe tu correo arriba y toca de nuevo'); return; }
        try { await recover(m); Utils.toast('Si ese correo tiene cuenta, te llegó un enlace'); } catch (e) { Utils.toast(e.message); }
      });
      box.appendChild(forgot);
      box.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Se guarda una copia de tus datos (entrenos, comidas, medidas, rutinas y ajustes). Las fotos de progreso no se suben. Puedes borrar tu cuenta y tus datos cuando quieras. Tus datos quedan en el servidor de la app: quien la administra podría verlos solo si hace falta para ayudarte.' }));
      if (typeof Privacy !== 'undefined') box.appendChild(Privacy.link('🔒 Ver qué se guarda y quién lo ve'));
    }

    function paintIn() {
      const m = meta();
      box.appendChild(Utils.el('p', { text: `Sesión iniciada como ${email() || 'tu cuenta'}.` }));
      let status; let cls = 'backup-last';
      if (running) status = '🔄 Sincronizando…';
      else if (m.lastError) { status = `⚠️ ${m.lastError}`; cls = 'backup-last due'; }
      else if (m.dirty) { status = '🕒 Cambios pendientes de subir'; cls = 'backup-last due'; }
      else status = `✅ Al día · ${ago(m.lastOk)}`;
      box.appendChild(note(status, cls));

      // ranking
      if (lbReady()) {
        const u = Leaderboard.user();
        if (u) {
          const r = Utils.el('div', { class: 'cloud-rank' }, [Utils.el('span', { text: `🌍 En el ranking como ${u.name}` })]);
          const go = Utils.el('button', { type: 'button', class: 'link-btn small', text: 'Ver ranking', onclick: () => App.navigate('progreso', { section: 'ranking' }) });
          r.appendChild(go);
          box.appendChild(r);
        } else {
          const wrap = Utils.el('div', { class: 'cloud-rank col' });
          const nm = Utils.el('input', { type: 'text', maxlength: '24', placeholder: 'Nombre para el ranking', value: suggestName() });
          const go = Utils.el('button', { type: 'button', class: 'btn-secondary btn-block', text: '🌍 Unirme al ranking con este nombre' });
          go.addEventListener('click', async () => { go.disabled = true; go.textContent = 'Uniendo…'; await joinNow(nm.value); go.disabled = false; });
          wrap.appendChild(nm); wrap.appendChild(go);
          box.appendChild(wrap);
          pendingIntent();
        }
      }

      const auto = Utils.el('button', { type: 'button', class: `uni-chip${m.autoOn ? ' on' : ''}`, text: m.autoOn ? '✓ Sincronizar automáticamente' : 'Sincronización automática apagada' });
      auto.addEventListener('click', () => { setMeta({ autoOn: !meta().autoOn }); if (meta().autoOn) touch(); });
      box.appendChild(auto);

      const now = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: '🔄 Sincronizar ahora' });
      now.addEventListener('click', async () => { if (running) return; now.disabled = true; now.textContent = 'Sincronizando…'; await sync({ manual: true }); });
      box.appendChild(now);

      const down = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: '⬇️ Restaurar desde la nube (reemplaza este teléfono)' });
      down.addEventListener('click', async () => {
        if (!Utils.confirmDialog('Esto reemplaza los datos de este teléfono por los de la nube. Antes se guarda una copia interna. ¿Seguir?')) return;
        down.disabled = true;
        try { const row = await remoteData(); if (!row) { Utils.toast('Aún no hay copia en la nube'); down.disabled = false; return; } await apply(row); Utils.toast('☁️ Datos restaurados'); } catch (e) { Utils.toast(e.message); }
        down.disabled = false;
      });
      box.appendChild(down);

      const pw = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: '🔑 Cambiar contraseña' });
      pw.addEventListener('click', openNewPassword);
      box.appendChild(pw);
      const out = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: 'Cerrar sesión' });
      out.addEventListener('click', async () => {
        if (meta().dirty) { try { await sync({ manual: true }); } catch (e) { /* seguir */ } }
        signOutLocal(); msg = ''; paint(); Utils.toast('Sesión cerrada. Tus datos siguen en este teléfono.');
      });
      box.appendChild(out);
      const del = Utils.el('button', { class: 'link-btn small', type: 'button', style: 'margin-top:10px;color:var(--red);', text: 'Borrar mi cuenta y mis datos de la nube' });
      del.addEventListener('click', async () => {
        if (!Utils.confirmDialog('Se borra tu cuenta y la copia en la nube. Los datos de ESTE teléfono no se tocan. No se puede deshacer. ¿Borrar?')) return;
        try { await deleteAccount(); msg = ''; paint(); Utils.toast('Cuenta borrada'); } catch (e) { Utils.toast(e.message); }
      });
      box.appendChild(del);
    }

    const off = onChange(() => { if (!box.isConnected) { off(); return; } if (!busy) paint(); });
    paint();
    return box;
  }

  function init() {
    handleLink();
    document.addEventListener('visibilitychange', () => {
      if (!signedIn()) return;
      if (document.visibilityState === 'hidden') { if (meta().dirty && meta().autoOn) { clearTimeout(timer); sync(); } return; }
      if (Date.now() - lastCheck > 60000) sync();
    });
    window.addEventListener('online', () => { if (signedIn() && meta().dirty) sync(); });
    if (signedIn()) setTimeout(() => sync(), 5000);
  }

  return { init, card, touch, sync, signedIn, email, configured, onChange, rpcAuth };
})();
