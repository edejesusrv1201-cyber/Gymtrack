/* ============================================================
   celebrate.js — Fuegos artificiales, confeti y aviso 🏆 cuando
   se rompe un récord (peso, repeticiones, tiempo o distancia).
   Se puede apagar en Más > Personalización (ajuste "celebrate").
   ============================================================ */

const Celebrate = (() => {
  function enabled() {
    return DB.getSettings().celebrate !== false;
  }

  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  // ---------- aviso ----------
  function banner(title, sub) {
    document.querySelectorAll('.pr-banner').forEach((b) => b.remove());
    const node = Utils.el('div', { class: 'pr-banner', role: 'status' }, [
      Utils.el('div', { class: 'pr-icon', text: '🏆' }),
      Utils.el('div', { style: 'min-width:0;' }, [
        Utils.el('div', { class: 'pr-title', text: title }),
        sub ? Utils.el('div', { class: 'pr-sub', text: sub }) : null,
      ]),
    ]);
    node.addEventListener('click', () => node.remove());
    document.body.appendChild(node);
    setTimeout(() => {
      node.classList.add('out');
      setTimeout(() => node.remove(), 400);
    }, 3600);
  }

  // ---------- fuegos artificiales ----------
  function palette() {
    const cs = getComputedStyle(document.documentElement);
    const theme = ['--g1', '--g2', '--g3'].map((v) => cs.getPropertyValue(v).trim()).filter(Boolean);
    return ['#ffd24a', '#ffffff', Utils.accent().main, ...theme];
  }

  function fireworks() {
    // un lienzo para el confeti (se limpia cada cuadro) y otro para los fuegos (con estela)
    const confCanvas = Utils.el('canvas', { class: 'fx-canvas' });
    const canvas = Utils.el('canvas', { class: 'fx-canvas' });
    document.body.appendChild(confCanvas);
    document.body.appendChild(canvas);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth;
    const H = window.innerHeight;
    const setup = (cv) => {
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.width = `${W}px`;
      cv.style.height = `${H}px`;
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      return c;
    };
    const ctx = setup(canvas);
    const ctxC = setup(confCanvas);

    const colors = palette();
    const pick = () => colors[(Math.random() * colors.length) | 0];
    const rockets = [];
    const sparks = [];
    const confetti = [];
    const start = performance.now();

    // cohetes escalonados
    [0, 260, 560, 900, 1250, 1650].forEach((delay) => {
      rockets.push({
        at: delay,
        launched: false,
        x: W * (0.15 + Math.random() * 0.7),
        y: H + 10,
        targetY: H * (0.16 + Math.random() * 0.26),
        speed: 9 + Math.random() * 2.5,
        color: pick(),
      });
    });

    function explode(x, y, color) {
      const n = 70 + ((Math.random() * 30) | 0);
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + Math.random() * 0.2;
        const sp = 1.4 + Math.random() * 4.6;
        sparks.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          decay: 0.011 + Math.random() * 0.012,
          size: 1.6 + Math.random() * 1.8,
          color: Math.random() < 0.7 ? color : pick(),
        });
      }
    }

    // confeti desde arriba
    for (let i = 0; i < 90; i++) {
      confetti.push({
        x: Math.random() * W,
        y: -20 - Math.random() * H * 0.5,
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1.8 + Math.random() * 3.2,
        w: 5 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2,
        vr: (Math.random() - 0.5) * 0.3,
        sway: Math.random() * Math.PI * 2,
        color: pick(),
      });
    }

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(2.2, (now - last) / 16.67);
      last = now;
      const t = now - start;

      // estela: desvanece lo anterior
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      rockets.forEach((r) => {
        if (r.done) return;
        if (!r.launched) {
          if (t < r.at) return;
          r.launched = true;
        }
        r.y -= r.speed * dt;
        r.speed *= 0.992;
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2.4, 0, Math.PI * 2);
        ctx.fill();
        if (r.y <= r.targetY || r.speed < 3) {
          r.done = true;
          explode(r.x, r.y, r.color);
        }
      });

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 + 0.045 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.life -= s.decay * dt;
        if (s.life <= 0) { sparks.splice(i, 1); continue; }
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (0.6 + s.life * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      ctxC.clearRect(0, 0, W, H);
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.sway += 0.06 * dt;
        c.x += (c.vx + Math.sin(c.sway) * 0.8) * dt;
        c.y += c.vy * dt;
        c.rot += c.vr * dt;
        if (c.y > H + 30) { confetti.splice(i, 1); continue; }
        ctxC.save();
        ctxC.translate(c.x, c.y);
        ctxC.rotate(c.rot);
        ctxC.fillStyle = c.color;
        ctxC.globalAlpha = 0.92;
        ctxC.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctxC.restore();
      }

      const pending = rockets.some((r) => !r.done);
      if (pending || sparks.length || confetti.length) {
        if (t < 7000) { requestAnimationFrame(frame); return; }
      }
      canvas.remove();
      confCanvas.remove();
    }
    requestAnimationFrame(frame);
  }

  // ---------- API ----------
  function describe(prs, units) {
    const first = prs[0];
    const titles = { peso: 'peso', reps: 'repeticiones', tiempo: 'tiempo', distancia: 'distancia' };
    const kinds = prs.map((p) => titles[p.kind]);
    const title = `¡Nuevo récord de ${kinds.join(' y ')}!`;
    let sub = '';
    if (first.kind === 'peso') sub = `${Units.label(first.value)}${first.reps ? ` × ${first.reps}` : ''} · antes ${Units.label(first.prev)}`;
    else if (first.kind === 'reps') sub = `${first.value} reps con ${Units.label(first.weight)} · antes ${first.prev}`;
    else if (first.kind === 'tiempo') sub = `${first.value} min · antes ${first.prev} min`;
    else sub = `${Utils.round1(first.value)} km · antes ${Utils.round1(first.prev)} km`;
    if (prs[1] && prs[1].kind === 'distancia') sub += ` · ${Utils.round1(prs[1].value)} km`;
    return { title, sub };
  }

  // prs: resultado de Metrics.detectPR
  function record(prs, exerciseName) {
    if (!prs || prs.length === 0 || !enabled()) return;
    const units = DB.getSettings().units;
    const d = describe(prs, units);
    banner(d.title, exerciseName ? `${exerciseName} · ${d.sub}` : d.sub);
    Utils.vibrate([60, 40, 60, 40, 140]);
    // si el sistema pide reducir animaciones solo se muestra el aviso,
    // salvo que la persona haya tocado "Activada" en Personalización
    if (!reducedMotion() || DB.getSettings().celebrate === true) fireworks();
  }

  // vista previa desde Ajustes (ignora el interruptor)
  function preview() {
    banner('¡Nuevo récord de peso!', 'Así se verá · 65kg × 8 · antes 62.5kg');
    Utils.vibrate([60, 40, 60]);
    fireworks();
  }

  return { record, preview, enabled, reducedMotion };
})();
