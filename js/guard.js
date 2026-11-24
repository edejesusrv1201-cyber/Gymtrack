/* ============================================================
   guard.js — La app solo funciona en sus direcciones oficiales.
   © MyGymTrack. Todos los derechos reservados (ver LICENSE).
   Es un freno contra quien copie los archivos y los publique en
   otra dirección; no sustituye la protección legal ni la del
   servidor. Las direcciones oficiales están en config.js (hosts):
   si cambias de dominio, agrégalo ahí ANTES de publicar.
   ============================================================ */

const Guard = (() => {
  // pruebas en tu propia computadora o en la red de tu casa
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;

  function allowed(host) {
    const h = String(host === undefined ? location.hostname : host).toLowerCase();
    const hosts = (window.GT_CONFIG && window.GT_CONFIG.hosts) || [];
    if (!hosts.length) return true;   // sin lista no se bloquea nada
    return LOCAL.test(h) || hosts.some((x) => String(x).toLowerCase() === h);
  }

  // pantalla que reemplaza a la app en una copia. No toca ni borra datos.
  function block() {
    const home = (window.GT_CONFIG && window.GT_CONFIG.homeUrl) || '';
    document.body.innerHTML = '';
    const box = document.createElement('div');
    box.style.cssText = 'min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:28px;font-family:system-ui,sans-serif;color:#eef0f7;background:#090b10;';
    const h = document.createElement('h1');
    h.textContent = 'Copia no autorizada';
    const p = document.createElement('p');
    p.textContent = 'Esta no es la aplicación oficial de MyGymTrack. © Todos los derechos reservados.';
    box.appendChild(h); box.appendChild(p);
    if (home) {
      const a = document.createElement('a');
      a.href = home; a.textContent = 'Abrir la app oficial';
      a.style.cssText = 'margin-top:14px;color:#ff8c46;font-weight:700;';
      box.appendChild(a);
    }
    document.body.appendChild(box);
  }

  return { allowed, block };
})();
