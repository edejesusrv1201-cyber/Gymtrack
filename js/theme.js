/* ============================================================
   theme.js — Personalización: fondo "lámpara de lava" y colores.

   El fondo son 5 manchas de color (#bgGlow) que se mueven despacio.
   Pueden tomar el color de la rutina que toca ese día ("auto") o una
   paleta fija. Opcionalmente los botones y detalles toman ese color.
   Ajustes guardados:
   - themeMode      'auto' | 'fijo'
   - themePreset    clave de PRESETS (color base / respaldo)
   - themeIntensity 'suave' | 'media' | 'intensa'
   - themeMotion    'lava' | 'quieto'   (si no existe: lava, salvo "reducir animaciones")
   - themeAccent    'tema' | 'app'      (por defecto 'tema')
   ============================================================ */

const Theme = (() => {
  const PRESETS = [
    { key: 'brasa', label: 'Brasa', colors: ['#ff6a3d', '#5b8cff', '#a384ff'] },
    { key: 'oceano', label: 'Océano', colors: ['#2fb7ff', '#5b8cff', '#3de0c2'] },
    { key: 'bosque', label: 'Bosque', colors: ['#35d49a', '#8bdc5b', '#2fb7ff'] },
    { key: 'violeta', label: 'Violeta', colors: ['#a384ff', '#ff6ad5', '#5b8cff'] },
    { key: 'rosa', label: 'Rosa chicle', colors: ['#ff6fae', '#ffb0d6', '#c79bff'] },
    { key: 'lila', label: 'Lila', colors: ['#c79bff', '#ffb0d6', '#8ec5ff'] },
    { key: 'durazno', label: 'Durazno', colors: ['#ff9a8b', '#ffcf9e', '#ff7eb6'] },
    { key: 'grafito', label: 'Grafito', colors: ['#7f8aa3', '#5b6478', '#3d4558'] },
  ];
  // glow = opacidad de las manchas · card = opacidad de las tarjetas (más baja = se ve más el fondo)
  const INTENSITIES = {
    suave: { glow: 0.45, card: 0.84 },
    media: { glow: 0.72, card: 0.64 },
    intensa: { glow: 0.95, card: 0.48 },
  };
  const REST_COLORS = ['#4f7cff', '#3de0c2', '#a384ff'];
  const APP_ACCENT = { main: '#ff6a3d', a: '#ff5a36', b: '#ff8f3d', c: '#ffb347', light: '#ffb08a' };

  // ---------- color ----------
  function hexToRgb(hex) {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hexToHsl(hex) {
    const [r8, g8, b8] = hexToRgb(hex);
    const r = r8 / 255;
    const g = g8 / 255;
    const b = b8 / 255;
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

  function luminance(hex) {
    const [r, g, b] = hexToRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // texto oscuro o blanco, el que mejor contraste dé sobre el color
  function onColor(hex) {
    const l = luminance(hex);
    const dark = (l + 0.05) / (luminance('#1d0d05') + 0.05);
    const light = 1.05 / (l + 0.05);
    return dark >= light ? '#1d0d05' : '#ffffff';
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

  // color de acento (botones, anillos, detalles) a partir del primer color del fondo
  function accentFromColor(hex) {
    const [h, s] = hexToHsl(hex);
    if (s < 0.18) return { main: '#b4bdd4', a: '#9aa5c0', b: '#b4bdd4', c: '#d6dcf0', light: '#d6dcf0' };
    const sat = Math.max(0.6, Math.min(0.97, s));
    return {
      main: hslToHex(h, sat, 0.64),
      a: hslToHex((h + 350) % 360, sat, 0.6),
      b: hslToHex(h, sat, 0.65),
      c: hslToHex((h + 22) % 360, sat, 0.74),
      light: hslToHex(h, Math.min(1, sat), 0.84),
    };
  }

  // ---------- qué mostrar ----------
  function reducedMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function settings() {
    const s = DB.getSettings();
    return {
      mode: s.themeMode || 'auto',
      preset: PRESETS.find((p) => p.key === s.themePreset) || PRESETS[0],
      intensity: INTENSITIES[s.themeIntensity] ? s.themeIntensity : 'media',
      motion: s.themeMotion || (reducedMotion() ? 'quieto' : 'lava'),
      accent: s.themeAccent === 'app' ? 'app' : 'tema',
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

  // aplica colores, intensidad, movimiento y acento (al abrir, al navegar y al cambiar ajustes)
  function apply(iso) {
    const cfg = settings();
    const res = resolve(iso);
    const root = document.documentElement;
    res.colors.forEach((c, i) => root.style.setProperty(`--g${i + 1}`, c));
    root.style.setProperty('--glow-opacity', String(INTENSITIES[cfg.intensity].glow));
    root.style.setProperty('--card-alpha', String(INTENSITIES[cfg.intensity].card));

    const acc = cfg.accent === 'app' ? APP_ACCENT : accentFromColor(res.colors[0]);
    root.style.setProperty('--accent', acc.main);
    root.style.setProperty('--accent-rgb', hexToRgb(acc.main).join(', '));
    root.style.setProperty('--accent-light', acc.light);
    root.style.setProperty('--acc-a', acc.a);
    root.style.setProperty('--acc-b', acc.b);
    root.style.setProperty('--acc-c', acc.c);
    root.style.setProperty('--on-accent', onColor(acc.main));

    const glow = document.getElementById('bgGlow');
    if (glow) glow.dataset.motion = cfg.motion;
    return res;
  }

  function init() {
    apply();
    // si cambia el día con la app abierta, el color del día se actualiza al volver
    document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
  }

  return { PRESETS, INTENSITIES, init, apply, resolve, settings, reducedMotion };
})();
