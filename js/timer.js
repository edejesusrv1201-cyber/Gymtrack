/* ============================================================
   timer.js — Cronómetro de descanso entre series
   Widget flotante disponible en toda la app. Sobrevive si cambias
   de pestaña o recargas la página (guarda el momento en que debe
   terminar, no solo "segundos restantes").
   ============================================================ */

const RestTimer = (() => {
  const STATE_KEY = 'gt_timerState';
  let tickHandle = null;
  let audioCtx = null;

  let els = {};

  function loadState() {
    return Utils.el ? JSON.parse(localStorage.getItem(STATE_KEY) || 'null') : null;
  }
  function saveState(state) {
    if (state) localStorage.setItem(STATE_KEY, JSON.stringify(state));
    else localStorage.removeItem(STATE_KEY);
  }

  function beep() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [0, 0.25, 0.5].forEach((offset) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.5, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.2);
        osc.connect(gain).connect(audioCtx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + 0.25);
      });
    } catch (e) { /* audio no disponible */ }
  }

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${Utils.pad(s)}`;
  }

  function buildWidget() {
    const wrap = Utils.el('div', { class: 'rest-widget', id: 'restWidget' });

    const fab = Utils.el('button', { class: 'rest-fab', id: 'restFab', 'aria-label': 'Cronómetro de descanso' }, [
      Utils.el('span', { class: 'rest-fab-icon', text: '⏱' }),
      Utils.el('span', { class: 'rest-fab-label', id: 'restFabLabel', text: 'Descanso' }),
    ]);

    const panel = Utils.el('div', { class: 'rest-panel', id: 'restPanel' });
    panel.innerHTML = `
      <div class="rest-panel-header">
        <span>Cronómetro de descanso</span>
        <button class="icon-btn" id="restClose">✕</button>
      </div>
      <div class="rest-display" id="restDisplay">0:00</div>
      <div class="rest-presets" id="restPresets">
        <button data-sec="30">30s</button>
        <button data-sec="60">60s</button>
        <button data-sec="90">90s</button>
        <button data-sec="120">2:00</button>
        <button data-sec="180">3:00</button>
      </div>
      <div class="rest-custom">
        <input type="number" id="restCustomSec" placeholder="Segundos personalizados" min="5" max="900">
        <button id="restCustomStart">Iniciar</button>
      </div>
      <div class="rest-controls" id="restControls" hidden>
        <button id="restMinus15">-15s</button>
        <button id="restPauseResume">Pausar</button>
        <button id="restPlus15">+15s</button>
        <button id="restCancel" class="danger">Cancelar</button>
      </div>
    `;

    wrap.appendChild(panel);
    wrap.appendChild(fab);
    document.body.appendChild(wrap);

    els = {
      wrap, fab,
      fabLabel: panel.parentElement.querySelector('#restFabLabel'),
      panel,
      display: panel.querySelector('#restDisplay'),
      presets: panel.querySelector('#restPresets'),
      controls: panel.querySelector('#restControls'),
      pauseResume: panel.querySelector('#restPauseResume'),
      customInput: panel.querySelector('#restCustomSec'),
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
  }

  function refreshUI(remaining, total, paused) {
    els.display.textContent = fmt(remaining);
    els.fabLabel.textContent = remaining > 0 || paused ? fmt(remaining) : 'Descanso';
    els.fab.classList.toggle('active', remaining > 0);
    els.presets.style.display = (remaining > 0 || paused) ? 'none' : 'grid';
    els.wrap.querySelector('.rest-custom').style.display = (remaining > 0 || paused) ? 'none' : 'flex';
    els.controls.hidden = !(remaining > 0 || paused);
    els.pauseResume.textContent = paused ? 'Reanudar' : 'Pausar';
    if (remaining <= 0 && !paused) {
      els.display.classList.remove('pulse');
    } else {
      els.display.classList.remove('pulse');
    }
  }

  function tick() {
    const st = loadState();
    if (!st) return;
    if (st.paused) {
      refreshUI(st.remainingAtPause, st.total, true);
      return;
    }
    const remaining = (st.endsAt - Date.now()) / 1000;
    if (remaining <= 0) {
      finish();
      return;
    }
    refreshUI(remaining, st.total, false);
  }

  function start(seconds) {
    const st = { total: seconds, endsAt: Date.now() + seconds * 1000, paused: false, remainingAtPause: null };
    saveState(st);
    Utils.toast(`Descanso iniciado: ${fmt(seconds)}`, 1400);
    togglePanel(true);
    ensureTicking();
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
    st.total = Math.max(st.total, 5);
    saveState(st);
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
  }

  function finish() {
    saveState(null);
    refreshUI(0, 0, false);
    Utils.vibrate([300, 150, 300, 150, 300]);
    beep();
    Utils.toast('⏱ ¡Descanso terminado! A seguir entrenando 💪', 3500);
    els.fab.classList.add('done-flash');
    setTimeout(() => els.fab.classList.remove('done-flash'), 1500);
  }

  function ensureTicking() {
    if (tickHandle) return;
    tickHandle = setInterval(tick, 250);
  }

  function init() {
    if (document.getElementById('restWidget')) return;
    buildWidget();
    ensureTicking();
    const st = loadState();
    if (st) tick(); else refreshUI(0, 0, false);
  }

  // API pública: permite iniciar el descanso desde el registro de series
  function quickStart(seconds) {
    start(seconds || (DB.getSettings().restDefault || 90));
  }

  return { init, start, quickStart, cancel };
})();
