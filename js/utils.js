/* ============================================================
   utils.js — helpers de fecha, formato y DOM
   ============================================================ */

const Utils = (() => {
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  function pad(n) { return n.toString().padStart(2, '0'); }

  function toISODate(d) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function todayISO() {
    return toISODate(new Date());
  }

  function monthKey(d = new Date()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  }

  function parseISO(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function friendlyDate(iso) {
    const d = parseISO(iso);
    return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  function daysInMonth(year, month0) {
    return new Date(year, month0 + 1, 0).getDate();
  }

  function el(tag, opts = {}, children = []) {
    const node = document.createElement(tag);
    Object.entries(opts).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null) node.setAttribute(k, v);
    });
    (Array.isArray(children) ? children : [children]).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function vibrate(pattern) {
    if (navigator.vibrate) {
      try { navigator.vibrate(pattern); } catch (e) { /* ignore */ }
    }
  }

  function toast(msg, ms = 2200) {
    let holder = document.getElementById('toastHolder');
    if (!holder) {
      holder = el('div', { id: 'toastHolder', class: 'toast-holder' });
      document.body.appendChild(holder);
    }
    const t = el('div', { class: 'toast', text: msg });
    holder.appendChild(t);
    requestAnimationFrame(() => t.classList.add('show'));
    setTimeout(() => {
      t.classList.remove('show');
      setTimeout(() => t.remove(), 300);
    }, ms);
  }

  function confirmDialog(msg) {
    return window.confirm(msg);
  }

  return {
    DIAS, DIAS_CORTOS, MESES, pad, toISODate, todayISO, monthKey, parseISO,
    friendlyDate, daysInMonth, el, round1, vibrate, toast, confirmDialog,
  };
})();
