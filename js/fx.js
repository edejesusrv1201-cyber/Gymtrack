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
  return { xp };
})();
