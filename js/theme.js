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
    { key: 'oro', label: 'Oro', colors: ['#ffc23c', '#ff8a2b', '#ffe08a'] },
    { key: 'neon', label: 'Neón', colors: ['#39ff9f', '#00d4ff', '#b8ff3d'] },
    { key: 'carmesi', label: 'Carmesí', colors: ['#ff3b5c', '#ff7a45', '#b3134f'] },
    { key: 'medianoche', label: 'Medianoche', colors: ['#4f6bff', '#2a2f8f', '#21c7d9'] },
    { key: 'grafito', label: 'Grafito', colors: ['#7f8aa3', '#5b6478', '#3d4558'] },
  ];
  // glow = opacidad de las manchas · card = opacidad de las tarjetas (más baja = se ve más el fondo)
  const INTENSITIES = {
    suave: { glow: 0.34, card: 0.92 },
    media: { glow: 0.5, card: 0.86 },
    intensa: { glow: 0.72, card: 0.76 },
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
      ui: s.uiAnim || (reducedMotion() ? 'off' : 'on'),
      accent: s.themeAccent === 'app' ? 'app' : 'tema',
      scheme: ['claro', 'oscuro', 'auto'].includes(s.themeScheme) ? s.themeScheme : 'oscuro',
    };
  }

  // 'oscuro' | 'claro' | 'auto' (según el teléfono) -> 'dark' | 'light'
  function resolveScheme(pref) {
    if (pref === 'claro') return 'light';
    if (pref === 'auto') return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    return 'dark';
  }
  const GROUPS_DARK = { pecho: '#ff6a3d', espalda: '#5b8cff', pierna: '#35d49a', hombro: '#ffc247', brazo: '#b08bff', core: '#e6e9f0', cardio: '#ff5d73', movilidad: '#3de0c2', otro: '#8d95a8' };
  const GROUPS_LIGHT = { pecho: '#e0522a', espalda: '#3d6fe6', pierna: '#0e9e6b', hombro: '#b27300', brazo: '#7650e0', core: '#566078', cardio: '#e0344f', movilidad: '#0b9b84', otro: '#6b7488' };

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
    // colores muy claros (amarillo, durazno, rosa pastel) brillan demasiado y apagan el texto: se atenúan
    const lum = (hex) => { const [r, g, b] = hexToRgb(hex).map((v) => v / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    const avgLum = res.colors.reduce((a, c) => a + lum(c), 0) / res.colors.length;
    const damp = avgLum > 0.5 ? 0.8 : avgLum > 0.4 ? 0.92 : 1;
    root.style.setProperty('--glow-opacity', String(INTENSITIES[cfg.intensity].glow * damp));
    root.style.setProperty('--card-alpha', String(INTENSITIES[cfg.intensity].card));

    const scheme = resolveScheme(cfg.scheme);
    const light = scheme === 'light';
    root.dataset.scheme = scheme;
    root.style.colorScheme = scheme;
    root.style.background = light ? '#eef0f6' : '#090b10';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', light ? '#eef0f6' : '#090b10');
    // sobre fondo claro las manchas se atenúan y los textos de acento se oscurecen
    if (light) root.style.setProperty('--glow-opacity', String(INTENSITIES[cfg.intensity].glow * damp * 0.62));
    if (typeof Utils !== 'undefined' && Utils.GROUP_COLORS) Object.assign(Utils.GROUP_COLORS, light ? GROUPS_LIGHT : GROUPS_DARK);

    let acc = cfg.accent === 'app' ? APP_ACCENT : accentFromColor(res.colors[0]);
    if (light) {
      const [h, s] = hexToHsl(acc.main);
      acc = Object.assign({}, acc, { light: s < 0.18 ? '#5b6478' : hslToHex(h, Math.min(1, Math.max(0.6, s)), 0.4) });
    }
    root.style.setProperty('--accent', acc.main);
    root.style.setProperty('--accent-rgb', hexToRgb(acc.main).join(', '));
    root.style.setProperty('--accent-light', acc.light);
    root.style.setProperty('--acc-a', acc.a);
    root.style.setProperty('--acc-b', acc.b);
    root.style.setProperty('--acc-c', acc.c);
    root.style.setProperty('--on-accent', onColor(acc.main));

    const glow = document.getElementById('bgGlow');
    if (glow) glow.dataset.motion = cfg.motion;
    root.dataset.ui = cfg.ui;
    return res;
  }

  // partículas que flotan en el fondo (solo se ven con el fondo en movimiento)
  function makeParticles() {
    const glow = document.getElementById('bgGlow');
    if (!glow || glow.querySelector('b')) return;
    // menos partículas en celulares modestos (cada una es una capa más que dibujar)
    const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3;
    for (let i = 0; i < (weak ? 6 : 10); i += 1) {
      const b = document.createElement('b');
      b.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
      b.style.setProperty('--s', `${(3 + Math.random() * 7).toFixed(1)}px`);
      b.style.setProperty('--d', `${(16 + Math.random() * 18).toFixed(1)}s`);
      b.style.setProperty('--dl', `-${(Math.random() * 30).toFixed(1)}s`);
      b.style.setProperty('--dx', `${Math.round(Math.random() * 90 - 45)}px`);
      glow.appendChild(b);
    }
  }

  function init() {
    makeParticles();
    apply();
    // si cambia el día con la app abierta, el color del día se actualiza al volver
    document.addEventListener('visibilitychange', () => { if (!document.hidden) apply(); });
    // modo automático: si el teléfono cambia de claro a oscuro, la app lo sigue
    if (window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      const onChange = () => { if (settings().scheme === 'auto') { apply(); if (typeof App !== 'undefined') App.navigate(App.currentView, App.currentParams); } };
      if (mq.addEventListener) mq.addEventListener('change', onChange); else if (mq.addListener) mq.addListener(onChange);
    }
  }

  return { PRESETS, INTENSITIES, init, apply, resolve, settings, reducedMotion, resolveScheme, isLight: () => document.documentElement.dataset.scheme === 'light' };
})();
