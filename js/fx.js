/* ============================================================
   fx.js — Pequeños efectos de "videojuego": XP que flota al ganar puntos.
   Solo se ven con las animaciones de menús activadas.
   ============================================================ */

const Fx = (() => {
  const on = () => document.documentElement.dataset.ui === 'on';
  let active = 0;

  // n = puntos ganados; extra = texto corto opcional (ej. '🏆 Récord')
  function xp(n, extra) {
    if (!on() || !(n > 0)) return;
    const slot = Math.min(active, 3); active += 1;
    const node = document.createElement('div');
    node.className = 'fx-xp';
    node.style.bottom = `calc(${26 + slot * 7}% + env(safe-area-inset-bottom))`;
    node.textContent = `+${n} XP${extra ? ` ${extra}` : ''}`;
    node.setAttribute('aria-hidden', 'true');
    document.body.appendChild(node);
    setTimeout(() => { node.remove(); active = Math.max(0, active - 1); }, 1300);
  }
  // ---------- subida de nivel a pantalla completa ----------
  // res = { up: {from, to}, ev: { lvl } } (lo que devuelve Gamify.check). done() se llama al cerrar.
  function levelUp(res, done) {
    if (document.querySelector('.lvlup')) return;
    const low = typeof Perf !== 'undefined' && Perf.isLow();
    const lvl = res.ev.lvl; const from = res.up.from; const to = res.up.to;
    const R = 104; const C = Math.round(2 * Math.PI * R);
    const newTitle = Gamify.titleFor(to); const oldTitle = Gamify.titleFor(from);
    const ov = document.createElement('div');
    ov.className = `lvlup${low ? ' low' : ''}`;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', `Subiste al nivel ${to}`);
    ov.style.setProperty('--C', String(C)); ov.style.setProperty('--set', String(Math.round(C * (1 - (lvl.pct || 0)))));
    ov.innerHTML = `
      <div class="lu-stage">
        <div class="lu-rays"></div>
        <div class="lu-wave"></div><div class="lu-wave w2"></div>
        <svg class="lu-ring" viewBox="0 0 240 240" aria-hidden="true">
          <defs><linearGradient id="luGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--acc-a, #ff6a3d)"/><stop offset="1" stop-color="var(--acc-c, #ffc247)"/></linearGradient></defs>
          <circle class="lu-track" cx="120" cy="120" r="${R}"/>
          <circle class="lu-fill" cx="120" cy="120" r="${R}"/>
        </svg>
        <div class="lu-nums"><span class="lu-lbl">NIVEL</span><b class="lu-old">${from}</b><b class="lu-new">${to}</b></div>
      </div>
      <div class="lu-eyebrow">¡SUBISTE DE NIVEL!</div>
      <div class="lu-title">${newTitle}</div>
      ${newTitle !== oldTitle ? '<div class="lu-new-title">✨ ¡Título nuevo!</div>' : ''}
      <div class="lu-sub">${(lvl.toNext || 0).toLocaleString('en-US')} XP para el nivel ${to + 1}</div>`;
    const colors = ['#ffc53d', '#ffffff', 'var(--acc-a, #ff6a3d)', 'var(--acc-c, #ffc247)'];
    const n = low ? 12 : 30;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2; const d = 120 + Math.random() * 190;
      const p = document.createElement('i'); p.className = 'lu-p';
      p.style.cssText = `--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--s:${4 + Math.round(Math.random() * 8)}px;--c:${colors[i % colors.length]};--dl:${(Math.random() * 0.18).toFixed(2)}s`;
      ov.querySelector('.lu-stage').appendChild(p);
    }
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'btn-primary lu-btn'; btn.textContent = '¡Vamos!';
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      ov.classList.add('out');
      setTimeout(() => { ov.remove(); if (done) done(); }, 260);
    };
    btn.addEventListener('click', close);
    ov.appendChild(btn);
    document.body.appendChild(ov);
    if (navigator.vibrate) { try { navigator.vibrate([40, 60, 40, 60, 160]); } catch (e) { /* sin vibración */ } }
    setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch (e) { /* nada */ } }, 2300);
  }

  return { xp, levelUp };
})();
