/* ============================================================
   theme.js — Personalización del fondo difuminado.

   El fondo son 3 manchas de color desenfocadas (#bgGlow). Pueden
   tomar el color de la rutina que toca ese día ("auto") o un color
   fijo elegido por la persona. Se guarda en los ajustes:
   - themeMode      'auto' | 'fijo'
   - themePreset    clave de PRESETS (color base / respaldo)
   - themeIntensity 'suave' | 'media' | 'intensa'
   ============================================================ */

const Theme = (() => {
  const PRESETS = [
    { key: 'brasa', label: 'Brasa', colors: ['#ff6a3d', '#5b8cff', '#a384ff'] },
    { key: 'oceano', label: 'Océano', colors: ['#2fb7ff', '#5b8cff', '#3de0c2'] },
    { key: 'bosque', label: 'Bosque', colors: ['#35d49a', '#8bdc5b', '#2fb7ff'] },
    { key: 'violeta', label: 'Violeta', colors: ['#a384ff', '#ff6ad5', '#5b8cff'] },
    { key: 'rosa', label: 'Rosa', colors: ['#ff5d8f', '#ffb347', '#a384ff'] },
    { key: 'grafito', label: 'Grafito', colors: ['#7f8aa3', '#5b6478', '#3d4558'] },
  ];
  const INTENSITIES = { suave: 0.3, media: 0.5, intensa: 0.78 };
  const REST_COLORS = ['#4f7cff', '#3de0c2', '#a384ff'];

  // ---------- color ----------
  function hexToHsl(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = ((n >> 16) & 255) / 255;
    const g = ((n >> 8) & 255) / 255;
    const b = (n & 255) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (max === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }

  function hslToHex(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h / 30) % 12;
      const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(255 * c).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  // a partir del color de una rutina saca 3 tonos armónicos
  function paletteFromColor(hex) {
    const [h, s] = hexToHsl(hex);
    if (s < 0.18) return PRESETS.find((p) => p.key === 'grafito').colors;
    const sat = Math.max(0.68, Math.min(0.95, s));
    return [
      hslToHex(h, sat, 0.58),
      hslToHex((h + 38) % 360, sat, 0.55),
      hslToHex((h + 318) % 360, sat * 0.9, 0.5),
    ];
  }

  // ---------- qué colores toca mostrar ----------
  function settings() {
    const s = DB.getSettings();
    return {
      mode: s.themeMode || 'auto',
      preset: PRESETS.find((p) => p.key === s.themePreset) || PRESETS[0],
      intensity: INTENSITIES[s.themeIntensity] !== undefined ? s.themeIntensity : 'media',
    };
  }

  function resolve(iso) {
    const cfg = settings();
    if (cfg.mode !== 'auto') return { colors: cfg.preset.colors, source: 'fijo', routine: null };
    const routine = TodayView.getRoutineForDate(iso || Utils.todayISO());
    if (!routine) return { colors: cfg.preset.colors, source: 'sin-rutina', routine: null };
    if (routine.exercises.length === 0) return { colors: REST_COLORS, source: 'descanso', routine };
    return { colors: paletteFromColor(routine.color), source: 'rutina', routine };
  }

  // aplica los colores al fondo (se llama al abrir, al navegar y al cambiar ajustes)
  function apply(iso) {
    const cfg = settings();
    const res = resolve(iso);
    const root = document.documentElement;
    res.colors.forEach((c, i) => root.style.setProperty(`--g${i + 1}`, c));
    root.style.setProperty('--glow-opacity', String(INTENSITIES[cfg.intensity]));
    return res;
  }

  function init() {
    apply();
    // si cambia el día con la app abierta, el color del día se actualiza al volver
    document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
  }

  return { PRESETS, INTENSITIES, init, apply, resolve, settings };
})();
