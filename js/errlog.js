/* ============================================================
   errlog.js — Guarda los últimos errores de la app (solo en este teléfono)
   para que «Enviar feedback» pueda adjuntarlos si la persona lo permite.
   Se carga primero, para atrapar también fallos de arranque.
   ============================================================ */

const ErrLog = (() => {
  const KEY = 'gt_errlog';
  const MAX = 12;

  function read() {
    try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; }
  }
  function add(msg, where) {
    try {
      const text = String(msg || '').slice(0, 220);
      if (!text) return;
      const list = read();
      const last = list[list.length - 1];
      if (last && last.m === text && last.w === where) { last.n = (last.n || 1) + 1; last.t = Date.now(); } else list.push({ t: Date.now(), m: text, w: String(where || '').slice(0, 120) });
      localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    } catch (e) { /* sin espacio: no pasa nada */ }
  }
  function where(file, line, col) {
    const f = String(file || '').split('/').slice(-2).join('/').split('?')[0];
    return f ? `${f}:${line || 0}:${col || 0}` : '';
  }

  window.addEventListener('error', (e) => {
    if (e && e.target && e.target !== window) return;   // fallos de carga de imágenes/recursos no cuentan
    add(e.message, where(e.filename, e.lineno, e.colno));
  });
  window.addEventListener('unhandledrejection', (e) => {
    const r = e && e.reason;
    add(`Promesa rechazada: ${(r && r.message) || r || ''}`, '');
  });

  // texto corto para adjuntar al feedback (últimos errores)
  function summary(n) {
    const list = read().slice(-(n || 3));
    if (!list.length) return '';
    return list.map((x) => `· ${new Date(x.t).toISOString().slice(0, 16).replace('T', ' ')} ${x.m}${x.w ? ` (${x.w})` : ''}${x.n > 1 ? ` ×${x.n}` : ''}`).join('\n');
  }
  function count() { return read().length; }
  function clear() { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } }

  return { add, summary, count, clear };
})();
