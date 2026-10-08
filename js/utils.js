/* ============================================================
   utils.js — helpers de fecha, formato, DOM y gráficas
   ============================================================ */

const Utils = (() => {
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const DIAS_CORTOS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const GROUP_COLORS = {
    pecho: '#ff6a3d', espalda: '#5b8cff', pierna: '#35d49a', hombro: '#ffc247',
    brazo: '#b08bff', core: '#e6e9f0', cardio: '#ff5d73', movilidad: '#3de0c2', otro: '#8d95a8',
  };

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

  function shortDate(iso) {
    const d = parseISO(iso);
    return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3).toLowerCase()}`;
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

  // 12450 -> "12.5k"
  function compact(n) {
    const abs = Math.abs(n);
    if (abs >= 1000000) return `${round1(n / 1000000)}M`;
    if (abs >= 10000) return `${Math.round(n / 1000)}k`;
    if (abs >= 1000) return `${round1(n / 1000)}k`;
    return `${Math.round(n)}`;
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

  // ---- control segmentado (pestañas pequeñas) ----
  function segmented(options, active, onChange, small) {
    const wrap = el('div', { class: 'seg' + (small ? ' small' : '') });
    options.forEach((o) => {
      const b = el('button', { class: 'seg-btn' + (o.key === active ? ' active' : ''), type: 'button', text: o.label });
      b.addEventListener('click', () => onChange(o.key));
      wrap.appendChild(b);
    });
    return wrap;
  }

  // ---- anillo de progreso (pct de 0 a 1) ----
  function ring(pct, opts = {}) {
    const size = opts.size || 88;
    const stroke = opts.stroke || 9;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const clamped = Math.max(0, Math.min(1, pct || 0));
    const ns = 'http://www.w3.org/2000/svg';
    const id = 'rg' + Math.random().toString(36).slice(2, 8);
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.innerHTML = `
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${opts.from || '#ff5a36'}"/><stop offset="100%" stop-color="${opts.to || '#ffb347'}"/>
      </linearGradient></defs>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="${stroke}"/>
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${id})" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - clamped)}"/>`;
    const wrap = el('div', { class: 'ring', style: `width:${size}px;height:${size}px;` }, [svg]);
    if (opts.label !== undefined) {
      wrap.appendChild(el('div', { class: 'ring-label' }, [
        el('span', { text: String(opts.label) }),
        opts.sub ? el('small', { text: opts.sub }) : null,
      ]));
    }
    return wrap;
  }

  // ---------------------------------------------------------------
  //  Gráficas en canvas
  // ---------------------------------------------------------------

  function setupCanvas(canvas, cssHeight) {
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = Math.max(220, canvas.parentElement.clientWidth);
    canvas.width = Math.round(cssWidth * dpr);
    canvas.height = Math.round(cssHeight * dpr);
    canvas.style.width = cssWidth + 'px';
    canvas.style.height = cssHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssWidth, cssHeight);
    return { ctx, w: cssWidth, h: cssHeight };
  }

  function rgba(hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((x) => x + x).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function roundedTopRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, Math.max(h, 0));
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + rr);
    ctx.quadraticCurveTo(x, y, x + rr, y);
    ctx.lineTo(x + w - rr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();
  }

  function pill(ctx, text, cx, cy, color, w) {
    ctx.font = '700 11px system-ui, sans-serif';
    const tw = ctx.measureText(text).width + 14;
    let x = cx - tw / 2;
    x = Math.max(4, Math.min(w - tw - 4, x));
    const y = cy - 11;
    ctx.fillStyle = 'rgba(14,17,24,0.94)';
    ctx.strokeStyle = rgba(color, 0.7);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const r = 9;
    ctx.moveTo(x + r, y); ctx.lineTo(x + tw - r, y); ctx.quadraticCurveTo(x + tw, y, x + tw, y + r);
    ctx.lineTo(x + tw, y + 22 - r); ctx.quadraticCurveTo(x + tw, y + 22, x + tw - r, y + 22);
    ctx.lineTo(x + r, y + 22); ctx.quadraticCurveTo(x, y + 22, x, y + 22 - r);
    ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f2f4f9';
    ctx.textAlign = 'center';
    ctx.fillText(text, x + tw / 2, y + 15);
  }

  // escala con marcas "redondas": 3 intervalos iguales que cubren [min, max]
  function niceStep(raw) {
    const pow = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const f = raw / pow;
    const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return nice * pow;
  }

  function niceScale(min, max) {
    let step = niceStep(((max - min) * 1.08) / 3);
    let lo = Math.floor(min / step) * step;
    let hi = lo + step * 3;
    for (let i = 0; i < 6 && hi < max; i++) {
      step = niceStep(step * 1.2);
      lo = Math.floor(min / step) * step;
      hi = lo + step * 3;
    }
    return { min: lo, max: hi };
  }

  // curva suave que no se pasa de los datos (interpolación monótona)
  function monotonePath(ctx, pts) {
    const n = pts.length;
    ctx.moveTo(pts[0].x, pts[0].y);
    if (n === 2) { ctx.lineTo(pts[1].x, pts[1].y); return; }
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) {
      dx[i] = pts[i + 1].x - pts[i].x;
      m[i] = (pts[i + 1].y - pts[i].y) / (dx[i] || 1);
    }
    t[0] = m[0];
    t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
      const a = t[i] / m[i];
      const b = t[i + 1] / m[i];
      const s = a * a + b * b;
      if (s > 9) {
        const k = 3 / Math.sqrt(s);
        t[i] = k * a * m[i];
        t[i + 1] = k * b * m[i];
      }
    }
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i];
      ctx.bezierCurveTo(pts[i].x + h / 3, pts[i].y + (t[i] * h) / 3, pts[i + 1].x - h / 3, pts[i + 1].y - (t[i + 1] * h) / 3, pts[i + 1].x, pts[i + 1].y);
    }
  }

  // points: [{ x: 'YYYY-MM-DD' | etiqueta, y: número }] en orden ascendente
  // opts: color, height, format(valor) -> texto, onPointClick(p, i)
  function drawLineChart(canvas, points, opts = {}) {
    if (points.length < 2) return;
    const color = opts.color || '#ff6a3d';
    const fmt = opts.format || ((v) => String(round1(v)));
    const { ctx, w, h } = setupCanvas(canvas, opts.height || 176);

    const padL = 38, padR = 16, padT = 34, padB = 26;
    const iw = w - padL - padR;
    const ih = h - padT - padB;
    const values = points.map((p) => p.y);
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) { min -= 1; max += 1; }
    const sc = niceScale(min, max);
    min = sc.min;
    max = sc.max;

    const isoRe = /^\d{4}-\d{2}-\d{2}$/;
    const times = points.map((p) => (isoRe.test(p.x) ? parseISO(p.x).getTime() : null));
    const useTime = times.every((t) => t !== null) && times[times.length - 1] > times[0];
    const xAt = (i) => (useTime
      ? padL + ((times[i] - times[0]) / (times[times.length - 1] - times[0])) * iw
      : padL + (i / (points.length - 1)) * iw);
    const yAt = (v) => padT + ih - ((v - min) / (max - min)) * ih;
    const pts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.y) }));

    function draw(selected) {
      ctx.clearRect(0, 0, w, h);

      // rejilla
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 3; i++) {
        const y = padT + (ih / 3) * i;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        const v = max - ((max - min) / 3) * i;
        ctx.fillText(fmt(v), padL - 7, y + 3);
      }
      ctx.setLineDash([]);

      // área con degradado
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ih);
      grad.addColorStop(0, rgba(color, 0.38));
      grad.addColorStop(1, rgba(color, 0));
      ctx.beginPath();
      monotonePath(ctx, pts);
      ctx.lineTo(pts[pts.length - 1].x, padT + ih);
      ctx.lineTo(pts[0].x, padT + ih);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // línea con brillo
      ctx.save();
      ctx.shadowColor = rgba(color, 0.55);
      ctx.shadowBlur = 12;
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.6;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      monotonePath(ctx, pts);
      ctx.stroke();
      ctx.restore();

      // etiquetas del eje X
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '600 10px system-ui, sans-serif';
      const n = points.length;
      const idxs = n <= 4 ? points.map((_, i) => i) : [0, Math.round((n - 1) / 3), Math.round(((n - 1) * 2) / 3), n - 1];
      [...new Set(idxs)].forEach((i, k, arr) => {
        ctx.textAlign = k === 0 ? 'left' : k === arr.length - 1 ? 'right' : 'center';
        const label = isoRe.test(points[i].x) ? shortDate(points[i].x) : String(points[i].x);
        ctx.fillText(label, k === 0 ? pts[i].x - 4 : k === arr.length - 1 ? pts[i].x + 4 : pts[i].x, h - 8);
      });

      // línea guía del punto seleccionado
      if (selected !== null && selected !== undefined) {
        ctx.setLineDash([3, 4]);
        ctx.strokeStyle = rgba(color, 0.55);
        ctx.beginPath();
        ctx.moveTo(pts[selected].x, padT - 4);
        ctx.lineTo(pts[selected].x, padT + ih);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // puntos
      pts.forEach((p, i) => {
        const isSel = i === selected;
        const isLast = i === pts.length - 1;
        ctx.beginPath();
        ctx.fillStyle = '#0b0d13';
        ctx.arc(p.x, p.y, isSel ? 6.5 : isLast ? 5.5 : 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(p.x, p.y, isSel ? 4.6 : isLast ? 3.8 : 2.6, 0, Math.PI * 2);
        ctx.fill();
        if (isSel) {
          ctx.beginPath();
          ctx.strokeStyle = rgba(color, 0.4);
          ctx.lineWidth = 2;
          ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      });

      if (selected !== null && selected !== undefined) {
        pill(ctx, fmt(values[selected]), pts[selected].x, pts[selected].y - 18, color, w);
      }
    }

    let selected = points.length - 1;
    draw(selected);

    canvas.onclick = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = evt.clientX - rect.left;
      let nearest = 0;
      let best = Infinity;
      pts.forEach((p, i) => {
        const d = Math.abs(p.x - clickX);
        if (d < best) { best = d; nearest = i; }
      });
      selected = nearest;
      draw(selected);
      if (opts.onPointClick) opts.onPointClick(points[nearest], nearest);
    };
    if (opts.onPointClick) opts.onPointClick(points[selected], selected);
  }

  // bars: [{ label, value, color?, highlight? }]
  // opts: color, height, goal, format(valor), onBarClick(bar, i)
  function drawBarChart(canvas, bars, opts = {}) {
    if (!bars.length) return;
    const color = opts.color || '#ff6a3d';
    const fmt = opts.format || ((v) => compact(v));
    const { ctx, w, h } = setupCanvas(canvas, opts.height || 176);

    const padL = 34, padR = 8, padT = 32, padB = 24;
    const iw = w - padL - padR;
    const ih = h - padT - padB;
    const maxVal = niceScale(0, Math.max(opts.goal || 0, ...bars.map((b) => b.value), 1)).max;
    const slot = iw / bars.length;
    const barW = Math.min(36, slot * 0.62);
    const xAt = (i) => padL + slot * i + (slot - barW) / 2;
    const yFor = (v) => padT + ih - (v / maxVal) * ih;

    function draw(progress, selected) {
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '600 10px system-ui, sans-serif';
      ctx.textAlign = 'right';
      for (let i = 0; i <= 3; i++) {
        const y = padT + (ih / 3) * i;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
        ctx.fillText(fmt(maxVal - (maxVal / 3) * i), padL - 6, y + 3);
      }
      ctx.setLineDash([]);

      bars.forEach((b, i) => {
        const c = b.color || color;
        const isSel = i === selected;
        const full = (b.value / maxVal) * ih;
        const bh = Math.max(full * progress, b.value > 0 ? 3 : 0);
        const x = xAt(i);
        const y = padT + ih - bh;
        const g = ctx.createLinearGradient(0, y, 0, padT + ih);
        const strong = b.highlight || isSel;
        g.addColorStop(0, rgba(c, strong ? 1 : 0.62));
        g.addColorStop(1, rgba(c, strong ? 0.5 : 0.18));
        ctx.fillStyle = g;
        roundedTopRect(ctx, x, y, barW, bh, 7);
        ctx.fill();
        if (strong) {
          ctx.save();
          ctx.shadowColor = rgba(c, 0.5);
          ctx.shadowBlur = 10;
          roundedTopRect(ctx, x, y, barW, bh, 7);
          ctx.fill();
          ctx.restore();
        }
        // etiqueta bajo la barra (se salta alguna si no caben todas)
        ctx.font = '600 10px system-ui, sans-serif';
        const widest = Math.max(...bars.map((x) => ctx.measureText(x.label).width));
        const skip = Math.max(1, Math.ceil((widest + 8) / slot));
        if ((bars.length - 1 - i) % skip === 0) {
          ctx.fillStyle = strong ? '#f2f4f9' : 'rgba(255,255,255,0.4)';
          ctx.font = '600 10px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(b.label, x + barW / 2, h - 8);
        }
      });

      if (opts.goal) {
        const gy = yFor(opts.goal);
        ctx.setLineDash([6, 5]);
        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.moveTo(padL, gy); ctx.lineTo(w - padR, gy); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = '700 10px system-ui, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(opts.goalLabel || 'meta', w - padR, gy - 4);
      }

      if (selected !== null && selected !== undefined && progress >= 1) {
        const b = bars[selected];
        pill(ctx, fmt(b.value), xAt(selected) + barW / 2, yFor(b.value) - 14, b.color || color, w);
      }
    }

    let selected = typeof opts.selected === 'number' ? opts.selected : bars.findIndex((b) => b.highlight);
    if (selected < 0) selected = null;

    const duration = 420;
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      draw(eased, selected);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    canvas.onclick = (evt) => {
      const rect = canvas.getBoundingClientRect();
      const clickX = evt.clientX - rect.left;
      let i = Math.floor((clickX - padL) / slot);
      i = Math.max(0, Math.min(bars.length - 1, i));
      selected = i;
      draw(1, selected);
      if (opts.onBarClick) opts.onBarClick(bars[i], i);
    };
  }

  return {
    DIAS, DIAS_CORTOS, MESES, GROUP_COLORS, pad, toISODate, todayISO, monthKey, parseISO,
    friendlyDate, shortDate, daysInMonth, el, round1, compact, vibrate, toast, confirmDialog,
    segmented, ring, drawLineChart, drawBarChart,
  };
})();
