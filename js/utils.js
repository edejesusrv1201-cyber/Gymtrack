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

  // ---- gráfico de línea reutilizable (progreso en el tiempo) ----
  // points: [{ x: etiqueta, y: número }] ordenados por fecha ascendente
  function drawLineChart(canvas, points, opts = {}) {
    if (points.length < 2) return;
    const color = opts.color || '#ff6a3d';

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.parentElement.clientWidth;
    const cssHeight = opts.height || 160;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssWidth, cssHeight);

    const padL = 34, padR = 12, padT = 14, padB = 20;
    const w = cssWidth - padL - padR;
    const h = cssHeight - padT - padB;
    const values = points.map((p) => p.y);
    let min = Math.min(...values), max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const margin = (max - min) * 0.15;
    min -= margin; max += margin;

    const xAt = (i) => padL + (points.length === 1 ? 0 : (i / (points.length - 1)) * w);
    const yAt = (v) => padT + h - ((v - min) / (max - min)) * h;

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 3; i++) {
      const y = padT + (h / 3) * i;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + w, y); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(round1(max).toString(), padL - 6, padT + 4);
    ctx.fillText(round1(min).toString(), padL - 6, padT + h);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(p.y);
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();

    points.forEach((p, i) => {
      const x = xAt(i), y = yAt(p.y);
      ctx.beginPath();
      ctx.fillStyle = '#0f1115';
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    if (opts.onPointClick) {
      canvas.onclick = (evt) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = evt.clientX - rect.left;
        let nearest = 0, bestDist = Infinity;
        points.forEach((p, i) => {
          const d = Math.abs(xAt(i) - clickX);
          if (d < bestDist) { bestDist = d; nearest = i; }
        });
        opts.onPointClick(points[nearest], nearest);
      };
    }
  }

  return {
    DIAS, DIAS_CORTOS, MESES, pad, toISODate, todayISO, monthKey, parseISO,
    friendlyDate, daysInMonth, el, round1, vibrate, toast, confirmDialog, drawLineChart,
  };
})();
