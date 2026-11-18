/* ============================================================
   activity.js — Deporte fuera del gym: correr, trail, bici, natación,
   fútbol, yoga… Se registra a mano o con un cronómetro en vivo
   (con GPS si tu teléfono lo permite). Suma XP, retos y logros.
   Los datos viven en gt_activities (van en el respaldo y la nube).
   ============================================================ */

const Activity = (() => {
  // met(v, effort) → METs. v = velocidad km/h (si hay distancia); effort 1 suave · 2 normal · 3 intenso
  const eff = (e) => [0, 0.85, 1, 1.2][e] || 1;
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const TYPES = [
    { k: 'correr', n: 'Correr', i: '🏃', dist: true, pace: true, run: true, max: 7.5, met: (v) => (v ? clamp(v * 1.0, 6, 16) : 9.5) },
    { k: 'trail', n: 'Trail', i: '⛰️', dist: true, pace: true, run: true, elev: true, max: 6.5, met: (v) => (v ? clamp(v * 1.0, 6, 15) + 1 : 10) },
    { k: 'caminar', n: 'Caminar', i: '🚶', dist: true, pace: true, max: 3.2, met: (v) => (v ? clamp(0.6 * v + 0.5, 2.3, 6.5) : 3.5) },
    { k: 'senderismo', n: 'Senderismo', i: '🥾', dist: true, pace: true, elev: true, max: 3.5, met: () => 6 },
    { k: 'bici', n: 'Bici', i: '🚴', dist: true, speed: true, elev: true, max: 20, met: (v) => (!v ? 8 : v < 16 ? 6 : v < 19 ? 6.8 : v < 22 ? 8 : v < 25 ? 10 : 12) },
    { k: 'natacion', n: 'Natación', i: '🏊', dist: true, max: 3, met: (v, e) => 7 * eff(e) },
    { k: 'remo', n: 'Remo', i: '🚣', dist: true, max: 6, met: (v, e) => 7 * eff(e) },
    { k: 'futbol', n: 'Fútbol', i: '⚽', met: (v, e) => 7 * eff(e) },
    { k: 'basquet', n: 'Básquet', i: '🏀', met: (v, e) => 6.5 * eff(e) },
    { k: 'raqueta', n: 'Tenis / pádel', i: '🎾', met: (v, e) => 7 * eff(e) },
    { k: 'voley', n: 'Voleibol', i: '🏐', met: (v, e) => 4.5 * eff(e) },
    { k: 'combate', n: 'Box / artes marciales', i: '🥊', met: (v, e) => 9 * eff(e) },
    { k: 'escalada', n: 'Escalada', i: '🧗', met: (v, e) => 8 * eff(e) },
    { k: 'hiit', n: 'HIIT / funcional', i: '⚡', met: (v, e) => 8 * eff(e) },
    { k: 'spinning', n: 'Spinning', i: '🚲', met: (v, e) => 8.5 * eff(e) },
    { k: 'baile', n: 'Baile', i: '💃', met: (v, e) => 5 * eff(e) },
    { k: 'yoga', n: 'Yoga / estiramiento', i: '🧘', met: () => 3 },
    { k: 'otro', n: 'Otro', i: '🏅', met: (v, e) => 5.5 * eff(e) },
  ];
  const typeOf = (k) => TYPES.find((t) => t.k === k) || TYPES[TYPES.length - 1];
  const EFFORT = [{ key: '1', label: '😌 Suave' }, { key: '2', label: '🙂 Normal' }, { key: '3', label: '🥵 Fuerte' }];

  const KEY = () => DB.KEYS.activities;
  const all = () => { const l = DB.read(KEY(), []); return Array.isArray(l) ? l : []; };
  const save = (list) => DB.write(KEY(), list);
  const isoOffset = (iso, n) => { const d = Utils.parseISO(iso); d.setDate(d.getDate() + n); return Utils.toISODate(d); };
  const weekStart = (iso) => { const d = Utils.parseISO(iso); d.setDate(d.getDate() - d.getDay()); return Utils.toISODate(d); };

  // ---------- cálculos ----------
  const speedOf = (a) => (a.km > 0 && a.min > 0 ? a.km / (a.min / 60) : 0);
  function kcalOf(a) {
    if (a.kcal > 0 && a.kcalAuto === false) return Math.round(a.kcal);
    const t = typeOf(a.type);
    const kg = Metrics.bodyWeightKg(a.date) || Number(DB.getSettings().weightKg) || 70;
    const met = t.met(speedOf(a), a.effort || 2) + (t.elev && a.elev > 0 && a.min > 0 ? clamp((a.elev / (a.min / 60)) / 500, 0, 2) : 0);
    return Math.round(met * kg * (a.min / 60));
  }
  function paceText(a) {                       // min/km → "5:32 /km"
    if (!(a.km > 0 && a.min > 0)) return '';
    const p = a.min / a.km; const m = Math.floor(p); const s = Math.round((p - m) * 60);
    return `${s === 60 ? m + 1 : m}:${String(s === 60 ? 0 : s).padStart(2, '0')} /km`;
  }
  const kmText = (n) => `${(Math.round(n * 100) / 100).toString().replace('.', ',')} km`;
  const minText = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, '0')} min` : `${Math.round(m)} min`);
  function xpOf(a) { return 30 + Math.min(90, Math.round((a.min || 0) * 1.2)) + Math.round(Math.min(30, a.km || 0) * 4); }
  const label = (a) => `${typeOf(a.type).i} ${typeOf(a.type).n}`;
  function detail(a) {
    const t = typeOf(a.type); const bits = [minText(a.min)];
    if (a.km > 0) bits.push(kmText(a.km));
    if (a.km > 0 && t.pace) bits.push(paceText(a)); else if (a.km > 0 && t.speed) bits.push(`${(Math.round(speedOf(a) * 10) / 10).toString().replace('.', ',')} km/h`);
    if (a.elev > 0) bits.push(`↑${Math.round(a.elev)} m`);
    bits.push(`~${kcalOf(a)} kcal`);
    return bits.join(' · ');
  }

  const list = (from, to) => all().filter((a) => (!from || a.date >= from) && (!to || a.date <= to)).sort((x, y) => (x.date === y.date ? (y.t || 0) - (x.t || 0) : (x.date < y.date ? 1 : -1)));
  const byDate = (iso) => list(iso, iso);
  const kcalOfDay = (iso) => byDate(iso).reduce((n, a) => n + kcalOf(a), 0);
  const xpOfDay = (iso) => byDate(iso).reduce((n, a) => n + xpOf(a), 0);

  function sum(items) {
    const r = { n: 0, min: 0, km: 0, elev: 0, kcal: 0, days: new Set(), types: new Set() };
    items.forEach((a) => { r.n += 1; r.min += a.min || 0; r.km += a.km || 0; r.elev += a.elev || 0; r.kcal += kcalOf(a); r.days.add(a.date); r.types.add(a.type); });
    return r;
  }
  const weekSum = (iso) => { const s = weekStart(iso || Utils.todayISO()); return sum(list(s, isoOffset(s, 6))); };
  const recentCount = (days) => list(isoOffset(Utils.todayISO(), -days), Utils.todayISO()).length;

  // estadísticas para logros y XP
  function stats() {
    const items = all();
    const r = sum(items);
    const runs = items.filter((a) => typeOf(a.type).run);
    let runKm = 0; let longestRun = 0; let trailElev = 0;
    runs.forEach((a) => { runKm += a.km || 0; longestRun = Math.max(longestRun, a.km || 0); });
    items.forEach((a) => { if (typeOf(a.type).elev) trailElev += a.elev || 0; });
    // días que cuentan para la racha semanal (20 min o más)
    const days = new Set(items.filter((a) => a.min >= 20).map((a) => a.date));
    return { acts: r.n, actMin: r.min, actKm: r.km, runKm, longestRun, trailElev, actTypes: r.types.size, actDays: days, actXp: items.reduce((n, a) => n + xpOf(a), 0) };
  }

  // marcas personales
  function records() {
    const items = all(); const out = [];
    const best = (fn, pick) => items.filter(fn).sort(pick)[0];
    const longRun = best((a) => typeOf(a.type).run && a.km > 0, (x, y) => y.km - x.km);
    if (longRun) out.push({ icon: '🏃', title: 'Carrera más larga', value: kmText(longRun.km), date: longRun.date, a: longRun });
    const fast = best((a) => typeOf(a.type).run && a.km >= 3 && a.min > 0, (x, y) => (x.min / x.km) - (y.min / y.km));
    if (fast) out.push({ icon: '⚡', title: 'Mejor ritmo (3 km o más)', value: paceText(fast), date: fast.date, a: fast });
    const climb = best((a) => a.elev > 0, (x, y) => y.elev - x.elev);
    if (climb) out.push({ icon: '⛰️', title: 'Más desnivel', value: `↑${Math.round(climb.elev)} m`, date: climb.date, a: climb });
    const ride = best((a) => a.type === 'bici' && a.km > 0, (x, y) => y.km - x.km);
    if (ride) out.push({ icon: '🚴', title: 'Salida en bici más larga', value: kmText(ride.km), date: ride.date, a: ride });
    const longest = best((a) => a.min > 0, (x, y) => y.min - x.min);
    if (longest) out.push({ icon: '⏱️', title: 'Actividad más larga', value: minText(longest.min), date: longest.date, a: longest });
    return out;
  }

  // ---------- guardar ----------
  function add(rec) {
    const a = Object.assign({ id: DB.uid(), t: Date.now(), effort: 2 }, rec);
    const l = all(); l.push(a); save(l); return a;
  }
  function update(id, patch) { const l = all(); const i = l.findIndex((x) => x.id === id); if (i >= 0) { Object.assign(l[i], patch); save(l); } }
  function remove(id) { save(all().filter((a) => a.id !== id)); }
  function celebrate() { try { Gamify.announce(Gamify.check()); } catch (e) { /* sin celebración */ } }

  // ---------- formulario ----------
  // opts: { id?, date?, type?, min?, km?, elev? }   onDone() se llama al guardar o borrar
  function openForm(opts, onDone) {
    opts = opts || {};
    const editing = opts.id ? all().find((a) => a.id === opts.id) : null;
    const st = Object.assign({ date: Utils.todayISO(), type: (all()[all().length - 1] || {}).type || 'correr', min: 30, km: 0, elev: 0, effort: 2, note: '' }, editing || {}, opts.id ? {} : opts);
    const body = Utils.el('div');
    const grid = Utils.el('div', { class: 'act-grid strip' });
    const fields = Utils.el('div');
    const preview = Utils.el('div', { class: 'act-preview' });

    const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) && n > 0 ? n : 0; };
    function paintPreview() {
      const a = { date: st.date, type: st.type, min: st.min, km: st.km, elev: st.elev, effort: st.effort };
      const t = typeOf(st.type);
      const bits = [`≈ ${kcalOf(a)} kcal`, `+${xpOf(a)} XP`];
      if (st.km > 0 && st.min > 0 && t.pace) bits.unshift(paceText(a));
      else if (st.km > 0 && st.min > 0 && t.speed) bits.unshift(`${(Math.round(speedOf(a) * 10) / 10).toString().replace('.', ',')} km/h`);
      preview.textContent = bits.join(' · ');
    }
    function field(labelText, input, hint) {
      const f = Utils.el('div', { class: 'field' }, [Utils.el('label', { text: labelText }), input]);
      if (hint) f.appendChild(Utils.el('div', { class: 'small text-dim', text: hint }));
      return f;
    }
    function paintFields() {
      fields.innerHTML = '';
      const t = typeOf(st.type);
      const date = Utils.el('input', { type: 'date', value: st.date, max: Utils.todayISO(), 'aria-label': 'Fecha' });
      date.addEventListener('change', () => { if (date.value) { st.date = date.value; paintPreview(); } });
      const min = Utils.el('input', { type: 'number', inputmode: 'numeric', min: '1', max: '1440', value: String(st.min || ''), 'aria-label': 'Duración en minutos' });
      min.addEventListener('input', () => { st.min = num(min.value); paintPreview(); });
      fields.appendChild(Utils.el('div', { class: 'grid-2' }, [field('📅 Fecha', date), field('⏱️ Minutos', min)]));
      const chips = Utils.el('div', { class: 'rt-chips', style: 'margin:-2px 0 8px;' });
      [20, 30, 45, 60, 90].forEach((m) => { const c = Utils.el('button', { type: 'button', class: 'rt-chip plain', style: '--gc:var(--accent-light)', text: `${m}'` }); c.addEventListener('click', () => { st.min = m; min.value = String(m); paintPreview(); }); chips.appendChild(c); });
      fields.appendChild(chips);
      if (t.dist) {
        const km = Utils.el('input', { type: 'text', inputmode: 'decimal', value: st.km ? String(st.km).replace('.', ',') : '', placeholder: '0', 'aria-label': 'Distancia en kilómetros' });
        km.addEventListener('input', () => { st.km = num(km.value); paintPreview(); });
        const row = [field('📏 Kilómetros', km)];
        if (t.elev) {
          const el = Utils.el('input', { type: 'number', inputmode: 'numeric', min: '0', value: st.elev ? String(Math.round(st.elev)) : '', placeholder: '0', 'aria-label': 'Desnivel positivo en metros' });
          el.addEventListener('input', () => { st.elev = num(el.value); paintPreview(); });
          row.push(field('↑ Desnivel (m)', el));
        }
        fields.appendChild(Utils.el('div', { class: row.length > 1 ? 'grid-2' : '' }, row));
      }
      if (!t.speed && !t.pace) {
        fields.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:4px 0 6px;', text: '¿Qué tan fuerte estuvo?' }));
        fields.appendChild(Utils.segmented(EFFORT, String(st.effort), (k) => { st.effort = Number(k); paintPreview(); }, true));
      }
      const note = Utils.el('input', { type: 'text', maxlength: '120', value: st.note || '', placeholder: 'Nota (opcional): ruta, con quién, cómo te sentiste…', style: 'margin-top:10px;', 'aria-label': 'Nota' });
      note.addEventListener('input', () => { st.note = note.value; });
      fields.appendChild(note);
    }
    function paintGrid() {
      grid.innerHTML = '';
      TYPES.forEach((t) => {
        const b = Utils.el('button', { type: 'button', class: `act-type${st.type === t.k ? ' on' : ''}`, 'aria-label': t.n }, [Utils.el('span', { class: 'ai', text: t.i }), Utils.el('span', { class: 'an', text: t.n })]);
        b.addEventListener('click', () => { st.type = t.k; paintGrid(); paintFields(); paintPreview(); });
        grid.appendChild(b);
      });
      const on = grid.querySelector('.on'); if (on) setTimeout(() => { try { grid.scrollLeft = Math.max(0, on.offsetLeft - 60); } catch (e) { /* nada */ } }, 0);
    }
    paintGrid(); paintFields(); paintPreview();
    body.appendChild(grid); body.appendChild(fields); body.appendChild(preview);

    const saveBtn = Utils.el('button', { type: 'button', class: 'btn-primary btn-block', style: 'margin-top:12px;', text: editing ? '✓ Guardar cambios' : '✓ Guardar actividad' });
    saveBtn.addEventListener('click', () => {
      if (!(st.min >= 1)) { Utils.toast('Pon cuántos minutos fueron'); return; }
      const rec = { date: st.date, type: st.type, min: Math.round(st.min), km: typeOf(st.type).dist ? Math.round((st.km || 0) * 100) / 100 : 0, elev: typeOf(st.type).elev ? Math.round(st.elev || 0) : 0, effort: st.effort, note: (st.note || '').trim(), src: st.src || (editing && editing.src) || 'manual' };
      if (editing) update(editing.id, rec); else add(rec);
      Modal.close();
      Utils.toast(`${typeOf(rec.type).i} Guardado · +${xpOf(rec)} XP`);
      if (onDone) onDone();
      if (!editing) celebrate();
    });
    body.appendChild(saveBtn);
    if (editing) {
      const del = Utils.el('button', { type: 'button', class: 'link-btn small', style: 'margin-top:8px;', text: '🗑️ Borrar esta actividad' });
      del.addEventListener('click', () => { remove(editing.id); Modal.close(); Utils.toast('Borrada'); if (onDone) onDone(); });
      body.appendChild(del);
    }
    Modal.open(editing ? 'Editar actividad' : '🏃 Registrar actividad', body);
  }

  // ---------- cronómetro en vivo (con GPS si se puede) ----------
  const LIVE_KEY = 'gt_act_live';
  const readLive = () => { try { return JSON.parse(localStorage.getItem(LIVE_KEY) || 'null'); } catch (e) { return null; } };
  const writeLive = (s) => { try { if (s) localStorage.setItem(LIVE_KEY, JSON.stringify(s)); else localStorage.removeItem(LIVE_KEY); } catch (e) { /* nada */ } };
  const hav = (a, b) => {                      // metros entre dos puntos
    const R = 6371000; const rad = (x) => (x * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat); const dLon = rad(b.lon - a.lon);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  // acepta o descarta un punto GPS y actualiza distancia y desnivel (exportado para probarlo)
  function gpsStep(s, p, type) {
    if (!p || !(p.acc <= 35)) return s;                         // señal mala
    const last = s.last;
    if (!last) { s.last = { lat: p.lat, lon: p.lon, t: p.t }; s.refAlt = Number.isFinite(p.alt) ? p.alt : null; return s; }
    const d = hav(last, p); const dt = Math.max(0.5, (p.t - last.t) / 1000);
    if (d < Math.max(3, p.acc * 0.25)) return s;                // quieto o ruido
    if (d / dt > (type.max || 8) * 1.8) return s;               // salto imposible
    s.km += d / 1000;
    s.last = { lat: p.lat, lon: p.lon, t: p.t };
    if (Number.isFinite(p.alt) && s.refAlt !== null) {
      const diff = p.alt - s.refAlt;
      if (diff >= 3) { s.elev += diff; s.refAlt = p.alt; } else if (diff <= -3) s.refAlt = p.alt;
    } else if (Number.isFinite(p.alt)) s.refAlt = p.alt;
    return s;
  }
  const clock = (ms) => { const t = Math.floor(ms / 1000); const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = t % 60; return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };

  function openLive(typeKey, onDone) {
    if (document.querySelector('.act-live')) return;
    let s = readLive();
    if (!s) s = { type: typeKey || 'correr', accMs: 0, since: Date.now(), running: true, km: 0, elev: 0, last: null, refAlt: null, gps: 'wait' };
    const t = typeOf(s.type);
    const ov = Utils.el('div', { class: 'act-live', role: 'dialog', 'aria-label': 'Actividad en curso' });
    const head = Utils.el('div', { class: 'al-head', text: `${t.i} ${t.n}` });
    const time = Utils.el('div', { class: 'al-time' });
    const stats = Utils.el('div', { class: 'al-stats' });
    const gpsNote = Utils.el('div', { class: 'al-gps small' });
    const ctrl = Utils.el('div', { class: 'al-ctrl' });
    ov.appendChild(head); ov.appendChild(time); ov.appendChild(stats); ov.appendChild(gpsNote); ov.appendChild(ctrl);
    document.body.appendChild(ov);

    let timer = null; let watchId = null; let lock = null;
    const elapsed = () => s.accMs + (s.running ? Date.now() - s.since : 0);
    function paint() {
      time.textContent = clock(elapsed());
      stats.innerHTML = '';
      const add2 = (v, l) => stats.appendChild(Utils.el('div', { class: 'al-stat' }, [Utils.el('b', { text: v }), Utils.el('span', { text: l })]));
      if (t.dist) {
        add2(s.km > 0.005 ? (Math.round(s.km * 100) / 100).toFixed(2).replace('.', ',') : '0,00', 'km');
        const mins = elapsed() / 60000;
        if (t.pace) add2(s.km > 0.05 && mins > 0 ? paceText({ km: s.km, min: mins }).replace(' /km', '') : '–:––', 'ritmo /km');
        else if (t.speed) add2(s.km > 0.05 && mins > 0 ? (Math.round((s.km / (mins / 60)) * 10) / 10).toString().replace('.', ',') : '–', 'km/h');
        if (t.elev) add2(`${Math.round(s.elev)}`, 'm ↑');
      } else add2(`${Math.round(kcalOf({ date: Utils.todayISO(), type: s.type, min: elapsed() / 60000, effort: 2 }))}`, 'kcal aprox.');
      gpsNote.textContent = !t.dist ? '' : s.gps === 'ok' ? '📡 GPS activo' : s.gps === 'denied' ? 'Sin permiso de ubicación: al terminar escribe los km a mano.' : s.gps === 'none' ? 'Este teléfono no da ubicación: al terminar escribe los km a mano.' : '📡 Buscando señal GPS…';
    }
    function startGps() {
      if (!t.dist) return;
      if (!navigator.geolocation) { s.gps = 'none'; return; }
      watchId = navigator.geolocation.watchPosition((pos) => {
        s.gps = 'ok';
        if (!s.running) return;
        gpsStep(s, { lat: pos.coords.latitude, lon: pos.coords.longitude, alt: pos.coords.altitude, acc: pos.coords.accuracy, t: pos.timestamp || Date.now() }, t);
        writeLive(s);
      }, (err) => { s.gps = err && err.code === 1 ? 'denied' : 'wait'; paint(); }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    }
    async function keepAwake() { try { if (navigator.wakeLock) lock = await navigator.wakeLock.request('screen'); } catch (e) { /* no se pudo */ } }
    function cleanup() {
      clearInterval(timer);
      if (watchId !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId);
      try { if (lock) lock.release(); } catch (e) { /* nada */ }
      document.removeEventListener('visibilitychange', onVis);
      ov.remove();
    }
    const onVis = () => { if (!document.hidden && s.running) keepAwake(); };
    document.addEventListener('visibilitychange', onVis);

    function paintCtrl() {
      ctrl.innerHTML = '';
      const pause = Utils.el('button', { type: 'button', class: 'btn-secondary al-btn', text: s.running ? '⏸ Pausa' : '▶ Seguir' });
      pause.addEventListener('click', () => {
        if (s.running) { s.accMs += Date.now() - s.since; s.running = false; } else { s.since = Date.now(); s.running = true; keepAwake(); }
        writeLive(s); paintCtrl(); paint(); Utils.vibrate(15);
      });
      const stop = Utils.el('button', { type: 'button', class: 'btn-primary al-btn', text: '■ Terminar' });
      stop.addEventListener('click', () => {
        if (s.running) { s.accMs += Date.now() - s.since; s.running = false; }
        const result = { type: s.type, min: Math.max(1, Math.round(s.accMs / 60000)), km: Math.round(s.km * 100) / 100, elev: Math.round(s.elev), src: 'live' };
        writeLive(null); cleanup(); Utils.vibrate([30, 40, 30]);
        openForm(result, onDone);
      });
      const drop = Utils.el('button', { type: 'button', class: 'link-btn small', text: 'Descartar' });
      drop.addEventListener('click', () => {
        if (Utils.confirmDialog('¿Descartar esta actividad? No se guardará nada.')) { writeLive(null); cleanup(); if (onDone) onDone(); }
      });
      ctrl.appendChild(pause); ctrl.appendChild(stop); ctrl.appendChild(drop);
    }
    writeLive(s);
    paint(); paintCtrl(); startGps(); keepAwake();
    timer = setInterval(paint, 1000);
  }
  const liveActive = () => !!readLive();

  // ---------- tarjeta de Hoy ----------
  function card(rerender) {
    const wk = weekSum();
    const todays = byDate(Utils.todayISO());
    const c = Utils.el('div', { class: 'card act-card' });
    const head = Utils.el('div', { class: 'act-head' }, [
      Utils.el('div', {}, [Utils.el('h3', { text: '🏃 Deporte' }), Utils.el('div', { class: 'small text-dim', text: wk.n ? `Esta semana: ${wk.n} ${wk.n === 1 ? 'actividad' : 'actividades'} · ${minText(wk.min)}${wk.km > 0 ? ` · ${kmText(wk.km)}` : ''}` : 'Correr, bici, fútbol, natación… todo suma.' })]),
    ]);
    c.appendChild(head);
    todays.slice(0, 3).forEach((a) => {
      const row = Utils.el('button', { type: 'button', class: 'act-row' }, [Utils.el('span', { class: 'ar-t', text: label(a) }), Utils.el('span', { class: 'ar-d', text: detail(a) })]);
      row.addEventListener('click', () => openForm({ id: a.id }, rerender));
      c.appendChild(row);
    });
    const btns = Utils.el('div', { class: 'grid-2', style: 'margin-top:10px;' });
    const live = Utils.el('button', { type: 'button', class: 'btn-primary', text: liveActive() ? '▶ Volver a mi actividad' : '▶ En vivo' });
    live.addEventListener('click', () => (liveActive() ? openLive(null, rerender) : pickLive(rerender)));
    const manual = Utils.el('button', { type: 'button', class: 'btn-secondary', text: '＋ Registrar' });
    manual.addEventListener('click', () => openForm({}, rerender));
    btns.appendChild(live); btns.appendChild(manual);
    c.appendChild(btns);
    return c;
  }
  function pickLive(rerender) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Elige tu deporte y arranca el cronómetro. En correr, trail, caminar y bici se mide la distancia con el GPS (deja la pantalla encendida).' }));
    const grid = Utils.el('div', { class: 'act-grid' });
    TYPES.forEach((t) => {
      const b = Utils.el('button', { type: 'button', class: 'act-type', 'aria-label': t.n }, [Utils.el('span', { class: 'ai', text: t.i }), Utils.el('span', { class: 'an', text: t.n })]);
      b.addEventListener('click', () => { Modal.close(); setTimeout(() => openLive(t.k, rerender), 260); });
      grid.appendChild(b);
    });
    body.appendChild(grid);
    Modal.open('▶ ¿Qué vas a hacer?', body);
  }

  // ---------- pantalla de Progreso → Deporte ----------
  function render(container) {
    container.innerHTML = '';
    const view = Utils.el('div', { class: 'view' });
    const rerender = () => render(container);
    const items = all();
    view.appendChild(card(rerender));
    if (!items.length) {
      view.appendChild(Utils.el('div', { class: 'empty-state' }, [Utils.el('div', { class: 'icon', text: '🏃' }), Utils.el('div', { text: 'Todavía no registras actividades. Corre, pedalea, juega o nada y suma XP, retos y logros.' })]));
      container.appendChild(view);
      return;
    }
    // minutos por semana (8 semanas)
    const today = Utils.todayISO(); const weeks = [];
    for (let i = 7; i >= 0; i -= 1) { const s = isoOffset(weekStart(today), -7 * i); const r = sum(list(s, isoOffset(s, 6))); weeks.push({ label: Utils.shortDate(s), value: Math.round(r.min), highlight: i === 0 }); }
    const chartCard = Utils.el('div', { class: 'card' }, [Utils.el('h3', { text: '⏱️ Minutos por semana' })]);
    const canvas = Utils.el('canvas', { class: 'chart', role: 'img', 'aria-label': 'Minutos de actividad por semana' });
    chartCard.appendChild(canvas); view.appendChild(chartCard);

    // mes y total
    const ms = `${today.slice(0, 7)}-01`; const month = sum(list(ms, today)); const tot = sum(items);
    const tiles = Utils.el('div', { class: 'act-tiles' });
    [[String(month.n), 'este mes'], [minText(month.min), 'tiempo del mes'], [month.km > 0 ? kmText(month.km) : '–', 'km del mes'], [Utils.compact(tot.kcal), 'kcal en total']].forEach(([v, l]) => tiles.appendChild(Utils.el('div', { class: 'act-tile' }, [Utils.el('b', { text: v }), Utils.el('span', { text: l })])));
    view.appendChild(tiles);

    // por deporte
    const per = {}; items.forEach((a) => { per[a.type] = per[a.type] || { n: 0, min: 0, km: 0 }; per[a.type].n += 1; per[a.type].min += a.min || 0; per[a.type].km += a.km || 0; });
    const sports = Utils.el('div', { class: 'card' }, [Utils.el('h3', { text: '🧭 Por deporte' })]);
    Object.keys(per).sort((x, y) => per[y].min - per[x].min).forEach((k) => {
      const p = per[k]; const t = typeOf(k);
      sports.appendChild(Utils.el('div', { class: 'act-sport' }, [Utils.el('span', { text: `${t.i} ${t.n}` }), Utils.el('span', { class: 'small text-dim', text: `${p.n}× · ${minText(p.min)}${p.km > 0 ? ` · ${kmText(p.km)}` : ''}` })]));
    });
    view.appendChild(sports);

    const recs = records();
    if (recs.length) {
      const rc = Utils.el('div', { class: 'card' }, [Utils.el('h3', { text: '🏆 Tus marcas' })]);
      recs.forEach((r) => rc.appendChild(Utils.el('div', { class: 'act-sport' }, [Utils.el('span', { text: `${r.icon} ${r.title}` }), Utils.el('span', {}, [Utils.el('b', { text: r.value }), Utils.el('span', { class: 'small text-dim', text: `  ${Utils.shortDate(r.date)}` })])])));
      view.appendChild(rc);
    }

    const recent = Utils.el('div', { class: 'card' }, [Utils.el('h3', { text: '🕘 Recientes' })]);
    list().slice(0, 12).forEach((a) => {
      const row = Utils.el('button', { type: 'button', class: 'act-row' }, [Utils.el('span', { class: 'ar-t', text: `${label(a)} · ${Utils.shortDate(a.date)}` }), Utils.el('span', { class: 'ar-d', text: detail(a) })]);
      row.addEventListener('click', () => openForm({ id: a.id }, rerender));
      recent.appendChild(row);
    });
    view.appendChild(recent);
    container.appendChild(view);
    Utils.drawBarChart(canvas, weeks, { format: (v) => `${v}'` });
  }

  return { TYPES, typeOf, all, list, byDate, add, update, remove, kcalOf, kcalOfDay, xpOf, xpOfDay, stats, records, weekSum, recentCount, paceText, kmText, minText, detail, openForm, openLive, liveActive, card, render, gpsStep };
})();
