/* ============================================================
   autoBackup.js — Copia automática de tus datos.

   1) Carpeta (Chrome/Edge en computadora): eliges una carpeta una sola
      vez —mejor una que sincronice Google Drive, OneDrive o iCloud— y
      la app guarda sola ahí un respaldo cada vez que cambias algo.
      (Los celulares no permiten escribir en una carpeta sin preguntar
      cada vez; ahí puedes mandar el respaldo a tu nube con un toque.)
   2) Copias internas (todos los dispositivos): una copia por día de los
      últimos 7 días, guardada en el propio navegador. Te salvan de un
      error o de importar un archivo equivocado; NO sirven si borras los
      datos del navegador.
   ============================================================ */

const AutoBackup = (() => {
  const DB_NAME = 'migymtrack_backup';
  const KEEP = 7;
  const FILE = 'migymtrack-respaldo.json';
  const DATED = /^migymtrack-respaldo-(\d{4}-\d{2}-\d{2})\.json$/;

  let dirty = false;
  let timer = null;
  let running = false;

  // ---------------------------------------------------------------- IndexedDB mínima
  function idb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('sin IndexedDB')); return; }
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => { const d = r.result; d.createObjectStore('kv'); d.createObjectStore('snaps'); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  async function tx(store, mode, fn) {
    const d = await idb();
    return new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      const out = fn(t.objectStore(store));
      t.oncomplete = () => { d.close(); resolve(out && 'result' in out ? out.result : undefined); };
      t.onerror = () => { d.close(); reject(t.error); };
      t.onabort = () => { d.close(); reject(t.error); };
    });
  }

  // ---------------------------------------------------------------- ajustes
  const cfg = () => Object.assign({ folder: false, folderName: '', lastFile: null, needsPerm: false }, DB.getSettings().autoBackup || {});
  function saveCfg(patch) {
    const s = DB.getSettings();
    s.autoBackup = Object.assign(cfg(), patch);
    DB.saveSettings(s);
  }
  const supported = () => !!(window.showDirectoryPicker && window.isSecureContext);

  // ---------------------------------------------------------------- copias internas
  async function snapshot() {
    const today = Utils.todayISO();
    const json = JSON.stringify(DB.exportAll());
    await tx('snaps', 'readwrite', (s) => s.put({ date: today, savedAt: Date.now(), size: json.length, json }, today));
    const keys = await tx('snaps', 'readonly', (s) => s.getAllKeys());
    const old = keys.sort().slice(0, Math.max(0, keys.length - KEEP));
    if (old.length) await tx('snaps', 'readwrite', (s) => { old.forEach((k) => s.delete(k)); });
  }
  async function listSnapshots() {
    try {
      const all = await tx('snaps', 'readonly', (s) => s.getAll());
      return all.map((x) => ({ date: x.date, savedAt: x.savedAt, size: x.size })).sort((a, b) => (a.date < b.date ? 1 : -1));
    } catch (e) { return []; }
  }
  async function restoreSnapshot(date) {
    const snap = await tx('snaps', 'readonly', (s) => s.get(date));
    if (!snap) return false;
    DB.importAll(JSON.parse(snap.json));
    return true;
  }

  // ---------------------------------------------------------------- carpeta
  async function getHandle() {
    try { return await tx('kv', 'readonly', (s) => s.get('dir')); } catch (e) { return null; }
  }
  async function chooseFolder() {
    if (!supported()) return false;
    let h;
    try { h = await window.showDirectoryPicker({ id: 'migymtrack', mode: 'readwrite' }); } catch (e) { return false; }   // canceló
    await tx('kv', 'readwrite', (s) => s.put(h, 'dir'));
    saveCfg({ folder: true, folderName: h.name, needsPerm: false });
    return run({ manual: true });
  }
  async function disableFolder() {
    try { await tx('kv', 'readwrite', (s) => s.delete('dir')); } catch (e) { /* nada */ }
    saveCfg({ folder: false, folderName: '', needsPerm: false });
  }

  async function writeFile(dir, name, text) {
    const fh = await dir.getFileHandle(name, { create: true });
    const w = await fh.createWritable();
    await w.write(text);
    await w.close();
  }

  async function toFolder(manual) {
    const h = await getHandle();
    if (!h) { saveCfg({ folder: false }); return { ok: false, reason: 'sin-carpeta' }; }
    let perm = await h.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted' && manual) perm = await h.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { saveCfg({ needsPerm: true }); return { ok: false, reason: 'permiso' }; }
    const text = JSON.stringify(DB.exportAll(), null, 2);
    await writeFile(h, FILE, text);
    // una copia con fecha por día, y se conservan las últimas 7
    const today = Utils.todayISO();
    await writeFile(h, `migymtrack-respaldo-${today}.json`, text);
    try {
      const dated = [];
      for await (const [name] of h.entries()) { const m = DATED.exec(name); if (m) dated.push(name); }
      dated.sort();
      for (const n of dated.slice(0, Math.max(0, dated.length - KEEP))) await h.removeEntry(n);
    } catch (e) { /* limpiar es opcional */ }
    saveCfg({ lastFile: Date.now(), needsPerm: false });
    Backup.mark();
    return { ok: true };
  }

  // ---------------------------------------------------------------- ejecutar
  async function run(opts = {}) {
    if (running) return { ok: false, reason: 'ocupado' };
    running = true;
    dirty = false;
    let res = { ok: true, folder: false };
    try {
      try { await snapshot(); } catch (e) { console.warn('copia interna falló', e); }
      if (cfg().folder && supported()) {
        res = Object.assign(await toFolder(!!opts.manual), { folder: true });
      }
    } catch (e) {
      console.warn('copia automática falló', e);
      res = { ok: false, reason: 'error', folder: cfg().folder };
    } finally { running = false; }
    return res;
  }

  // los datos cambiaron: copia en unos segundos (junta varios cambios seguidos)
  function touch() {
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => { if (dirty) run(); }, 30000);
  }

  function init() {
    // al salir de la app o cambiar de pestaña, si quedó algo pendiente, copia ya
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && dirty) { clearTimeout(timer); run(); }
    });
    // al abrir: una copia interna por día y, si hay carpeta, una copia si pasó más de medio día
    setTimeout(async () => {
      try {
        const snaps = await listSnapshots();
        const c = cfg();
        const stale = c.folder && (!c.lastFile || Date.now() - c.lastFile > 12 * 3600 * 1000);
        if (!snaps.some((x) => x.date === Utils.todayISO()) || stale) run();
      } catch (e) { /* nada */ }
    }, 4000);
  }

  // ---------------------------------------------------------------- interfaz (tarjeta en Más)
  const ago = (ts) => {
    if (!ts) return 'nunca';
    const m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return 'hace un momento';
    if (m < 60) return `hace ${m} min`;
    const h = Math.round(m / 60);
    if (h < 24) return `hace ${h} h`;
    const d = Math.round(h / 24);
    return `hace ${d} día${d === 1 ? '' : 's'}`;
  };
  const kb = (n) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  function card(onRestored) {
    const wrap = Utils.el('div', { class: 'ab-card' });
    wrap.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 8px;', text: '☁️ Copia automática' }));
    const c = cfg();
    const redo = () => { const n = card(onRestored); wrap.replaceWith(n); };

    if (supported()) {
      if (c.folder) {
        wrap.appendChild(Utils.el('div', { class: `ab-status${c.needsPerm ? ' warn' : ' ok'}`, text: c.needsPerm
          ? `⚠️ Falta permiso para escribir en «${c.folderName}». Toca "Reactivar".`
          : `✓ Se guarda sola en «${c.folderName}» cada vez que cambias algo. Última copia: ${ago(c.lastFile)}.` }));
        const row = Utils.el('div', { class: 'nut-actions' });
        const now = Utils.el('button', { class: c.needsPerm ? 'btn-primary' : 'btn-secondary', type: 'button', text: c.needsPerm ? '🔓 Reactivar' : '💾 Copiar ahora' });
        now.addEventListener('click', async () => {
          now.disabled = true;
          const r = await run({ manual: true });
          Utils.toast(r.ok ? 'Copia guardada ✓' : r.reason === 'permiso' ? 'Necesito el permiso para escribir en la carpeta' : 'No pude guardar la copia');
          redo();
        });
        const change = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '📂 Cambiar carpeta' });
        change.addEventListener('click', async () => { const r = await chooseFolder(); if (r) Utils.toast('Carpeta lista ✓'); redo(); });
        row.appendChild(now); row.appendChild(change);
        wrap.appendChild(row);
        const off = Utils.el('button', { class: 'link-btn small', type: 'button', style: 'margin-top:6px;', text: 'Dejar de guardar en la carpeta' });
        off.addEventListener('click', async () => { await disableFolder(); redo(); });
        wrap.appendChild(off);
      } else {
        wrap.appendChild(Utils.el('p', { class: 'small', text: 'Elige una carpeta una sola vez y la app guardará ahí un respaldo cada vez que cambies algo (y una copia por día, las últimas 7). Si eliges una carpeta de Google Drive, OneDrive o iCloud Drive, queda también en tu nube.' }));
        const pick = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: '📂 Elegir carpeta para la copia automática' });
        pick.addEventListener('click', async () => { const r = await chooseFolder(); if (r && r.ok) Utils.toast('Listo: se guardará sola ✓'); redo(); });
        wrap.appendChild(pick);
      }
    } else {
      wrap.appendChild(Utils.el('p', { class: 'small', text: 'Los celulares no permiten que una app escriba sola en una carpeta. Aquí se hacen copias internas automáticas (abajo) y, cuando quieras, mandas el respaldo a tu nube —Drive, iCloud, WhatsApp, correo— con un toque. Te lo recordaré cada semana en Hoy.' }));
      const send = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: '📤 Enviar respaldo a mi nube' });
      send.addEventListener('click', async () => { const ok = await Backup.run(); if (ok) Utils.toast('Respaldo enviado ✓'); });
      wrap.appendChild(send);
    }

    // copias internas
    const snapsBox = Utils.el('div', { class: 'ab-snaps' });
    wrap.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:14px 0 6px;', text: 'Copias internas (últimos 7 días)' }));
    wrap.appendChild(snapsBox);
    wrap.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:6px;', text: 'Viven en este navegador: te salvan de un error o de importar un archivo equivocado, pero no si borras los datos del navegador. Por eso conviene también la copia en carpeta o en tu nube.' }));
    listSnapshots().then((list) => {
      if (!list.length) { snapsBox.appendChild(Utils.el('div', { class: 'small text-dim', text: 'Aún no hay copias. Se crean solas al usar la app.' })); return; }
      list.forEach((s) => {
        const row = Utils.el('div', { class: 'ab-snap' }, [
          Utils.el('div', {}, [Utils.el('b', { text: Utils.friendlyDate(s.date) }), Utils.el('div', { class: 'small text-dim', text: `${kb(s.size)} · ${new Date(s.savedAt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}` })]),
        ]);
        const b = Utils.el('button', { class: 'btn-small', type: 'button', text: 'Restaurar' });
        b.addEventListener('click', async () => {
          if (!Utils.confirmDialog(`Esto reemplazará tus datos actuales con la copia del ${Utils.friendlyDate(s.date)}. ¿Continuar?`)) return;
          if (s.date !== Utils.todayISO()) { try { await snapshot(); } catch (e) { /* guarda primero el estado actual */ } }
          const ok = await restoreSnapshot(s.date);
          Utils.toast(ok ? 'Datos restaurados ✓' : 'No pude restaurar esa copia');
          if (ok && onRestored) onRestored();
        });
        row.appendChild(b);
        snapsBox.appendChild(row);
      });
    });
    return wrap;
  }

  return { supported, run, touch, init, card, chooseFolder, listSnapshots, restoreSnapshot, snapshot, cfg };
})();
