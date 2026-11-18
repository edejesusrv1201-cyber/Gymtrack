/* ============================================================
   perf.js — Guardia de rendimiento.
   Si el teléfono va a tirones (pocos cuadros por segundo) o es muy
   modesto, aligera solo los efectos del fondo y las animaciones.
   Ajuste en Más → Personalización → Rendimiento:
     auto (por defecto) · max (siempre efectos completos) · ahorro (siempre ligero)
   ============================================================ */

const Perf = (() => {
  const KEY = 'gt_perfAuto';           // 'low' si la medición automática decidió aligerar
  const root = document.documentElement;

  const mode = () => { try { return (JSON.parse(localStorage.getItem('gt_settings') || '{}').perfMode) || 'auto'; } catch (e) { return 'auto'; } };
  const saved = () => { try { return localStorage.getItem(KEY) === 'low'; } catch (e) { return false; } };
  const weak = () => {
    const mem = navigator.deviceMemory; const cores = navigator.hardwareConcurrency;
    return (mem && mem <= 2) || (cores && cores <= 2);
  };

  function apply() {
    const m = mode();
    const low = m === 'ahorro' || (m === 'auto' && (saved() || weak()));
    root.dataset.perf = low ? 'low' : 'high';
    return low;
  }

  // mide los cuadros por segundo un momento tras abrir la app (solo en modo auto)
  function measure() {
    if (mode() !== 'auto' || saved() || typeof requestAnimationFrame !== 'function') return;
    let frames = 0; let t0 = 0; let bad = 0; let rounds = 0;
    const sample = () => {
      frames = 0; t0 = performance.now();
      const tick = (t) => {
        frames += 1;
        if (t - t0 < 2000) { requestAnimationFrame(tick); return; }
        const fps = frames / ((t - t0) / 1000);
        rounds += 1;
        if (document.hidden || root.classList.contains('scrolling')) { if (rounds < 4) setTimeout(sample, 1500); return; }   // pestaña oculta: no cuenta
        if (fps < 38) bad += 1;
        if (bad >= 2) { try { localStorage.setItem(KEY, 'low'); } catch (e) { /* nada */ } apply(); return; }
        if (rounds < 3) setTimeout(sample, 2500);
      };
      requestAnimationFrame(tick);
    };
    setTimeout(sample, 3000);
  }

  function reset() { try { localStorage.removeItem(KEY); } catch (e) { /* nada */ } apply(); measure(); }
  function isLow() { return root.dataset.perf === 'low'; }

  apply();
  return { apply, measure, reset, isLow, mode };
})();
