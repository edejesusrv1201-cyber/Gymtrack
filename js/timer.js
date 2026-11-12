/* ============================================================
   timer.js — Cronómetro de descanso entre series
   Widget flotante disponible en toda la app. Sobrevive si cambias
   de pestaña o recargas la página (guarda el momento en que debe
   terminar, no solo "segundos restantes").
   · Anillo de progreso y cuenta final (últimos 3 s con pitidos)
   · Mantiene la pantalla encendida mientras entrenas o descansas
     (se puede apagar en Más → Ajustes)
   ============================================================ */

const RestTimer = (() => {
  const STATE_KEY = 'gt_timerState';
  const RING = 2 * Math.PI * 52;
  let tickHandle = null;
  let audioCtx = null;
  let lastBeepSec = null;
  let workoutMode = false;

  let els = {};

  function loadState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || 'null'); } catch (e) { return null; }
  }
  function saveState(state) {
    try {
      if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
      else localStorage.removeItem(STATE_KEY);
    } catch (e) { /* sin almacenamiento */ }
  }
  const settings = () => DB.getSettings();
  const soundOn = () => settings().restSound !== false;

  // ---------------------------------------------------------------- pantalla encendida
  const Wake = (() => {
    let lock = null;
    let want = false;
    async function acquire() {
      if (!want || lock || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return;
      try {
        lock = await navigator.wakeLock.request('screen');
        lock.addEventListener('release', () => { lock = null; });
      } catch (e) { lock = null; }
    }
    function set(on) {
      want = on;
      if (on) acquire();
      else if (lock) { lock.release().catch(() => {}); lock = null; }
    }
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });
    return { set, active: () => !!lock, supported: () => 'wakeLock' in navigator };
  })();

  function syncWake() {
    const on = settings().keepAwake !== false && (workoutMode || !!loadState());
    Wake.set(on);
  }
  function setWorkoutMode(on) {
    workoutMode = !!on;
    syncWake();
  }

  // ---------------------------------------------------------------- sonido
  // iOS solo deja sonar el audio si se "desbloquea" con un toque de la persona
  function unlockAudio() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
    } catch (e) { /* audio no disponible */ }
  }

  function tone(freq, at, dur, vol) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(vol, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  function beep() {
    if (!soundOn()) return;
    try {
      unlockAudio();
      const now = audioCtx.currentTime;
      [0, 0.25, 0.5].forEach((o) => tone(880, now + o, 0.2, 0.5));
      tone(1320, now + 0.8, 0.35, 0.5);
    } catch (e) { /* audio no disponible */ }
  }
  // pitido corto de la cuenta final (3, 2, 1)
  function tick1() {
    if (!soundOn()) return;
    try { unlockAudio(); tone(660, audioCtx.currentTime, 0.1, 0.3); } catch (e) { /* audio no disponible */ }
  }

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${Utils.pad(s)}`;
  }

  // ---------------------------------------------------------------- interfaz
  function buildWidget() {
    const wrap = Utils.el('div', { class: 'rest-widget', id: 'restWidget' });

    const fab = Utils.el('button', { class: 'rest-fab', id: 'restFab', 'aria-label': 'Cronómetro de descanso' }, [
      Utils.el('span', { class: 'rest-fab-icon', text: '⏱' }),
      Utils.el('span', { class: 'rest-fab-label', id: 'restFabLabel', text: 'Descanso' }),
      Utils.el('span', { class: 'rest-fab-prog' }),
    ]);

    const panel = Utils.el('div', { class: 'rest-panel', id: 'restPanel' });
    panel.innerHTML = `
      <div class="rest-panel-header">
        <span id="restTitle">Cronómetro de descanso</span>
        <button class="icon-btn" id="restClose">✕</button>
      </div>
      <div class="rest-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle class="rr-bg" cx="60" cy="60" r="52"></circle>
          <circle class="rr-fg" id="restRing" cx="60" cy="60" r="52" stroke-dasharray="${RING.toFixed(2)}" stroke-dashoffset="${RING.toFixed(2)}"></circle>
        </svg>
        <div class="rest-display" id="restDisplay">0:00</div>
      </div>
      <div class="rest-presets" id="restPresets">
        <button data-sec="30">30s</button>
        <button data-sec="60">60s</button>
        <button data-sec="90">90s</button>
        <button data-sec="120">2:00</button>
        <button data-sec="180">3:00</button>
        <button data-sec="240">4:00</button>
      </div>
      <div class="rest-custom">
        <input type="number" id="restCustomSec" placeholder="Segundos personalizados" min="5" max="900">
        <button id="restCustomStart">Iniciar</button>
      </div>
      <div class="rest-controls" id="restControls" hidden>
        <button id="restMinus15">−15 s</button>
        <button id="restPlus15">+15 s</button>
        <button id="restPauseResume">Pausar</button>
        <button id="restCancel" class="danger">Saltar</button>
      </div>
    `;

    wrap.appendChild(panel);
    wrap.appendChild(fab);
    document.body.appendChild(wrap);

    els = {
      wrap, fab,
      fabLabel: wrap.querySelector('#restFabLabel'),
      prog: fab.querySelector('.rest-fab-prog'),
      panel,
      title: panel.querySelector('#restTitle'),
      ring: panel.querySelector('#restRing'),
      display: panel.querySelector('#restDisplay'),
      presets: panel.querySelector('#restPresets'),
      controls: panel.querySelector('#restControls'),
      pauseResume: panel.querySelector('#restPauseResume'),
      customInput: panel.querySelector('#restCustomSec'),
      custom: panel.querySelector('.rest-custom'),
    };

    fab.addEventListener('click', () => togglePanel());
    panel.querySelector('#restClose').addEventListener('click', () => togglePanel(false));
    panel.querySelectorAll('#restPresets button').forEach((btn) => {
      btn.addEventListener('click', () => start(Number(btn.dataset.sec)));
    });
    panel.querySelector('#restCustomStart').addEventListener('click', () => {
      const v = Number(els.customInput.value);
      if (v > 0) start(v);
    });
    panel.querySelector('#restMinus15').addEventListener('click', () => adjust(-15));
    panel.querySelector('#restPlus15').addEventListener('click', () => adjust(15));
    panel.querySelector('#restPauseResume').addEventListener('click', () => togglePause());
    panel.querySelector('#restCancel').addEventListener('click', () => cancel());
  }

  function togglePanel(force) {
    const show = force !== undefined ? force : !els.panel.classList.contains('open');
    els.panel.classList.toggle('open', show);
    showWidget();
  }

  function refreshUI(remaining, total, paused, label) {
    const active = remaining > 0 || paused;
    const frac = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
    els.display.textContent = active ? fmt(remaining) : fmt(settings().restDefault || 90);
    els.display.classList.toggle('idle', !active);
    els.display.classList.toggle('last', active && !paused && remaining <= 3);
    els.ring.style.strokeDashoffset = String((RING * (1 - frac)).toFixed(2));
    els.fabLabel.textContent = active ? fmt(remaining) : 'Descanso';
    els.fab.classList.toggle('active', remaining > 0);
    els.fab.classList.toggle('paused', paused);
    els.prog.style.width = `${Math.round(frac * 100)}%`;
    els.presets.style.display = active ? 'none' : 'grid';
    els.custom.style.display = active ? 'none' : 'flex';
    els.controls.hidden = !active;
    els.pauseResume.textContent = paused ? 'Reanudar' : 'Pausar';
    els.title.textContent = active ? (label ? `Siguiente: ${label}` : 'Descansando…') : 'Cronómetro de descanso';
  }

  function tick() {
    const st = loadState();
    if (!st) return;
    if (st.paused) {
      refreshUI(st.remainingAtPause, st.total, true, st.label);
      return;
    }
    const remaining = (st.endsAt - Date.now()) / 1000;
    if (remaining <= 0) {
      finish(st);
      return;
    }
    const sec = Math.ceil(remaining);
    if (sec <= 3 && sec !== lastBeepSec) { lastBeepSec = sec; tick1(); }
    refreshUI(remaining, st.total, false, st.label);
  }

  function start(seconds, opts = {}) {
    const st = { total: seconds, endsAt: Date.now() + seconds * 1000, paused: false, remainingAtPause: null, label: opts.label || '' };
    saveState(st);
    lastBeepSec = null;
    Utils.toast(`Descanso iniciado: ${fmt(seconds)}`, 1400);
    if (opts.openPanel !== false) togglePanel(true);
    showWidget(true);
    ensureTicking();
    syncWake();
    tick();
  }

  function adjust(deltaSec) {
    const st = loadState();
    if (!st) { start(Math.max(15, deltaSec)); return; }
    if (st.paused) {
      st.remainingAtPause = Math.max(0, st.remainingAtPause + deltaSec);
    } else {
      st.endsAt += deltaSec * 1000;
    }
    // el anillo debe seguir siendo coherente si se alarga el descanso
    const rem = st.paused ? st.remainingAtPause : (st.endsAt - Date.now()) / 1000;
    st.total = Math.max(st.total, rem, 5);
    saveState(st);
    lastBeepSec = null;
    tick();
  }

  function togglePause() {
    const st = loadState();
    if (!st) return;
    if (st.paused) {
      st.endsAt = Date.now() + st.remainingAtPause * 1000;
      st.paused = false;
      st.remainingAtPause = null;
    } else {
      st.remainingAtPause = Math.max(0, (st.endsAt - Date.now()) / 1000);
      st.paused = true;
    }
    saveState(st);
    tick();
  }

  function cancel() {
    saveState(null);
    refreshUI(0, 0, false);
    togglePanel(false);
    showWidget();
    syncWake();
  }

  function finish(st) {
    saveState(null);
    refreshUI(0, 0, false);
    Utils.vibrate([300, 150, 300, 150, 300]);
    beep();
    const late = st && st.endsAt ? Math.round((Date.now() - st.endsAt) / 1000) : 0;
    Utils.toast(`⏱ ¡Descanso terminado!${late > 5 ? ` (hace ${late} s)` : ''} ${st && st.label ? `A por ${st.label} 💪` : 'A seguir entrenando 💪'}`, 3800);
    els.fab.classList.add('done-flash');
    setTimeout(() => { els.fab.classList.remove('done-flash'); showWidget(); }, 1600);
    syncWake();
  }

  function ensureTicking() {
    if (tickHandle) return;
    tickHandle = setInterval(tick, 250);
  }

  // el botón flotante solo se ve en el entrenamiento o mientras corre un descanso
  function showWidget(force) {
    if (!els.wrap) return;
    const running = !!loadState();
    const panelOpen = els.panel.classList.contains('open');
    els.wrap.classList.toggle('hidden', !(force || running || panelOpen));
  }

  function openPanel() {
    showWidget(true);
    togglePanel(true);
  }

  function init() {
    if (document.getElementById('restWidget')) return;
    ['touchend', 'click'].forEach((ev) => document.addEventListener(ev, unlockAudio, { passive: true }));
    buildWidget();
    ensureTicking();
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tick(); });
    const st = loadState();
    if (st) tick(); else refreshUI(0, 0, false);
    showWidget();
    syncWake();
  }

  // API pública: permite iniciar el descanso desde el registro de series
  function quickStart(seconds, label) {
    start(seconds || (settings().restDefault || 90), { openPanel: false, label });
  }

  return { init, start, quickStart, cancel, showWidget, openPanel, setWorkoutMode, syncWake, wakeSupported: Wake.supported, wakeActive: Wake.active };
})();
