/* ============================================================
   stories.js — Historias para compartir: resumen semanal, actividad
   deportiva, tu nivel y tus récords. Mismas opciones que compartir un
   entreno: Publicación 4:5 o Historia 9:16, y estilos oscuro, negro,
   claro o TRANSPARENTE (para ponerla como sticker sobre tu foto).
   Todo se dibuja en tu teléfono; no se sube nada a internet.
   ============================================================ */

const Stories = (() => {
  const K = () => Share.kit;
  const isStory = (fmt) => fmt.H > 1500;
  const DAY = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const SPORT = '#35d49a';

  // ---------- esqueleto común: fondo, cabecera, título y pie ----------
  async function frame(prefs, head, body) {
    const k = K();
    const fmt = k.FORMATS[prefs.format] || k.FORMATS.feed;
    const ac = Utils.accent();
    const t = k.theme(prefs.style, ac);
    const { W, FONT } = k;
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = fmt.H;
    const ctx = canvas.getContext('2d');
    const grad = (x0, x1) => { const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, t.light ? k.darken(ac.a, 0.82) : ac.a); g.addColorStop(1, t.light ? k.darken(ac.c, 0.7) : ac.c); return g; };
    const accentText = t.light ? ac.a : ac.c;
    k.drawBg(ctx, t, ac, fmt);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const sh = (on) => { if (t.shadow) { ctx.shadowColor = on ? 'rgba(0,0,0,.55)' : 'transparent'; ctx.shadowBlur = on ? 14 : 0; ctx.shadowOffsetY = on ? 3 : 0; } };

    let y = fmt.top;
    const icon = await k.loadImg('icons/logo-192.png');
    if (icon) { ctx.save(); if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 16; } k.rrect(ctx, 70, y, 92, 92, 24); ctx.clip(); ctx.drawImage(icon, 70, y, 92, 92); ctx.restore(); }
    sh(true);
    ctx.fillStyle = t.text; ctx.font = `800 44px ${FONT}`; ctx.fillText('MyGymTrack', 184, y + 44);
    ctx.fillStyle = t.dim; ctx.font = `600 28px ${FONT}`; ctx.fillText(head.sub || '', 184, y + 82);
    sh(false);
    if (head.chip) {
      ctx.font = `800 28px ${FONT}`;
      const cw = ctx.measureText(head.chip).width + 44;
      k.panel(ctx, t, W - 70 - cw, y + 18, cw, 56, 28);
      ctx.fillStyle = t.text; ctx.textAlign = 'center'; ctx.fillText(head.chip, W - 70 - cw / 2, y + 56); ctx.textAlign = 'left';
    }
    y += 92 + 62;
    sh(true);
    ctx.fillStyle = head.gold ? (t.light ? '#c98a00' : k.GOLD) : accentText; ctx.font = `800 27px ${FONT}`;
    k.spaced(ctx, head.eyebrow, 70, y, 5);
    y += 98;
    let fs = 96;
    do { ctx.font = `900 ${fs}px ${FONT}`; fs -= 4; } while (ctx.measureText(head.title).width > W - 140 && fs > 48);
    ctx.fillStyle = t.text; ctx.fillText(head.title, 70, y);
    sh(false);
    y += 34;

    const c = { ctx, t, ac, fmt, k, FONT, W, grad, accentText, sh, story: isStory(fmt) };
    y = await body(c, y);

    sh(true);
    ctx.fillStyle = t.dim; ctx.font = `700 25px ${FONT}`; ctx.textAlign = 'center';
    const who = (DB.getSettings().userName || '').trim();
    ctx.fillText(who ? `${who}  ·  hecho con MyGymTrack` : 'Hecho con MyGymTrack', W / 2, fmt.H - fmt.bottom);
    sh(false); ctx.textAlign = 'left';
    return canvas;
  }

  // fila de cifras grandes: items = [{v, l}]
  function tiles(c, y, items, h) {
    const { ctx, t, k, FONT, grad } = c;
    const n = items.length; const w = (940 - (n - 1) * 20) / n;
    items.forEach((it, i) => {
      const x = 70 + i * (w + 20);
      k.panel(ctx, t, x, y, w, h, 30);
      ctx.textAlign = 'center';
      let size = 80; ctx.font = `900 ${size}px ${FONT}`;
      while (ctx.measureText(it.v).width > w - 36 && size > 34) { size -= 4; ctx.font = `900 ${size}px ${FONT}`; }
      ctx.fillStyle = grad(x, x + w); ctx.fillText(it.v, x + w / 2, y + h * 0.56);
      ctx.fillStyle = t.dim; ctx.font = `700 25px ${FONT}`; ctx.fillText(it.l, x + w / 2, y + h * 0.56 + 42);
      ctx.textAlign = 'left';
    });
    return y + h + c.fmt.gap;
  }

  // panel con título pequeño; devuelve la y interior
  function titled(c, y, h, title) {
    const { ctx, t, k, FONT } = c;
    k.panel(ctx, t, 70, y, 940, h, 36);
    ctx.fillStyle = t.dim; ctx.font = `800 23px ${FONT}`;
    k.spaced(ctx, title, 100, y + 54, 3);
    return y + 78;
  }

  // ---------- 1) resumen semanal ----------
  async function weekly(prefs, offset) {
    const w = WeeklyReview.compute(offset);
    const sp = typeof Activity !== 'undefined' ? Activity.weekSum(w.range.start) : { n: 0, min: 0, km: 0, days: new Set() };
    const ev = Gamify.evaluate();
    return frame(prefs, {
      sub: offset === 0 ? 'Esta semana' : 'Semana pasada', chip: ev.st.streak > 0 ? `🔥 ${ev.st.streak} sem` : `Nivel ${ev.lvl.level}`,
      eyebrow: 'RESUMEN SEMANAL', title: `${Utils.shortDate(w.range.start)} – ${Utils.shortDate(w.range.end)}`, gold: w.prs > 0,
    }, async (c, y0) => {
      let y = y0;
      const { ctx, t, k, FONT, fmt, grad } = c;
      y = tiles(c, y, [{ v: String(w.sessions), l: 'entrenos' }, { v: String(w.sets), l: 'series' }, { v: String(w.prs), l: w.prs === 1 ? 'récord' : 'récords' }], fmt.tileH);
      const mins = Math.round(sp.min);
      const sportTxt = mins >= 60 ? `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')}` : `${mins} min`;
      y = tiles(c, y, [{ v: k.bigNum(Units.fromKg(w.volume)), l: `${Units.current()} de volumen` }, { v: sp.n ? sportTxt : '–', l: sp.km > 0 ? `deporte · ${Utils.round1(sp.km)} km` : 'de deporte' }], Math.round(fmt.tileH * 0.9));

      // días activos
      const ph = c.story ? 200 : 214;
      let iy = titled(c, y, ph, 'DÍAS ACTIVOS');
      const wl = DB.getWorkoutLog(); const today = Utils.todayISO();
      const cw = 940 / 7;
      for (let i = 0; i < 7; i += 1) {
        const d = Utils.parseISO(w.range.start); d.setDate(d.getDate() + i); const iso = Utils.toISODate(d);
        const gym = ((wl[iso] || {}).exercises || []).some((e) => (e.sets || []).some((s) => !Metrics.isWarmup(s)));
        const sport = typeof Activity !== 'undefined' && Activity.byDate(iso).length > 0;
        const cx = 70 + cw * i + cw / 2; const cy = iy + 46; const r = 38;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        if (gym) { ctx.fillStyle = grad(cx - r, cx + r); ctx.fill(); } else if (sport) { ctx.fillStyle = SPORT; ctx.fill(); } else { ctx.fillStyle = t.track; ctx.fill(); }
        if (gym && sport) { ctx.beginPath(); ctx.arc(cx + 26, cy - 26, 13, 0, Math.PI * 2); ctx.fillStyle = SPORT; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = t.light ? '#f3efe8' : '#0b0d12'; ctx.stroke(); }
        ctx.textAlign = 'center';
        ctx.fillStyle = gym || sport ? (t.light ? '#fff' : '#0b0d12') : t.dim; ctx.font = `900 30px ${FONT}`;
        ctx.fillText(gym ? '🏋️' : sport ? '🏃' : '·', cx, cy + 11);
        ctx.fillStyle = iso === today ? c.accentText : t.dim; ctx.font = `800 26px ${FONT}`; ctx.fillText(DAY[d.getDay()], cx, cy + 82);
        ctx.textAlign = 'left';
      }
      y += ph + fmt.gap;

      if (c.story) {
        // series por grupo vs meta
        const groups = w.groups.slice().sort((a, b) => b.n - a.n);
        const rowH = 52; const gh = 84 + groups.length * rowH;
        let gy = titled(c, y, gh, 'SERIES POR GRUPO');
        const max = Math.max(w.goal.min, ...groups.map((x) => x.n), 1);
        groups.forEach((g, i) => {
          const yy = gy + 20 + i * rowH;
          ctx.fillStyle = t.text; ctx.font = `700 29px ${FONT}`; ctx.fillText(g.g.charAt(0).toUpperCase() + g.g.slice(1), 100, yy);
          const bx = 340; const bw = 520;
          k.rrect(ctx, bx, yy - 22, bw, 22, 11); ctx.fillStyle = t.track; ctx.fill();
          if (g.n > 0) { k.rrect(ctx, bx, yy - 22, Math.max(22, bw * (g.n / max)), 22, 11); ctx.fillStyle = g.n >= w.goal.min ? grad(bx, bx + bw) : (t.light ? 'rgba(20,22,28,.3)' : 'rgba(255,255,255,.35)'); ctx.fill(); }
          ctx.textAlign = 'right'; ctx.fillStyle = g.n >= w.goal.min ? c.accentText : t.dim; ctx.font = `800 28px ${FONT}`; ctx.fillText(String(g.n), 980, yy); ctx.textAlign = 'left';
        });
        y += gh + fmt.gap;
      }

      // nivel y XP
      const lh = 150;
      k.panel(ctx, t, 70, y, 940, lh, 36);
      ctx.fillStyle = t.text; ctx.font = `900 44px ${FONT}`; ctx.fillText(`Nivel ${ev.lvl.level} · ${ev.lvl.title}`, 104, y + 62);
      ctx.fillStyle = t.dim; ctx.font = `700 26px ${FONT}`; ctx.fillText(`${Math.round(ev.xp).toLocaleString('en-US')} XP`, 104, y + 104);
      ctx.textAlign = 'right'; ctx.fillText(`${w.challenges} reto${w.challenges === 1 ? '' : 's'} cumplido${w.challenges === 1 ? '' : 's'}`, 976, y + 104); ctx.textAlign = 'left';
      k.rrect(ctx, 104, y + 120, 872, 14, 7); ctx.fillStyle = t.track; ctx.fill();
      k.rrect(ctx, 104, y + 120, Math.max(14, 872 * ev.lvl.pct), 14, 7); ctx.fillStyle = grad(104, 976); ctx.fill();
      return y + lh;
    });
  }

  // ---------- 2) actividad deportiva ----------
  async function activity(prefs, a) {
    const t0 = Activity.typeOf(a.type);
    const wk = Activity.weekSum(a.date);
    return frame(prefs, { sub: Utils.friendlyDate(a.date), chip: `+${Activity.xpOf(a)} XP`, eyebrow: `${t0.i}  ACTIVIDAD`, title: t0.n }, async (c, y0) => {
      let y = y0;
      const { ctx, t, k, FONT, fmt, grad } = c;
      // cifra principal
      const hero = a.km > 0 ? { v: (Math.round(a.km * 100) / 100).toFixed(2).replace('.', ','), u: 'kilómetros' } : { v: Activity.minText(a.min), u: 'de actividad' };
      const hh = c.story ? 360 : 280;
      k.panel(ctx, t, 70, y, 940, hh, 40);
      ctx.textAlign = 'center';
      let size = c.story ? 220 : 170; ctx.font = `900 ${size}px ${FONT}`;
      while (ctx.measureText(hero.v).width > 860 && size > 60) { size -= 6; ctx.font = `900 ${size}px ${FONT}`; }
      ctx.fillStyle = grad(120, 960); ctx.fillText(hero.v, 540, y + hh * 0.62);
      ctx.fillStyle = t.dim; ctx.font = `800 32px ${FONT}`; k.spaced(ctx, hero.u.toUpperCase(), 540, y + hh * 0.62 + 56, 6, 'center');
      ctx.textAlign = 'left';
      y += hh + fmt.gap;
      const items = [{ v: Activity.minText(a.min).replace(' min', "'").replace(' h ', 'h '), l: 'tiempo' }];
      if (a.km > 0 && t0.pace) items.push({ v: Activity.paceText(a).replace(' /km', ''), l: 'ritmo /km' });
      else if (a.km > 0 && t0.speed) items.push({ v: String(Math.round((a.km / (a.min / 60)) * 10) / 10).replace('.', ','), l: 'km/h' });
      if (a.elev > 0) items.push({ v: `${Math.round(a.elev)}`, l: 'm de desnivel' });
      items.push({ v: String(Activity.kcalOf(a)), l: 'kcal aprox.' });
      y = tiles(c, y, items.slice(0, 3), fmt.tileH);
      if (a.note) {
        ctx.fillStyle = t.text; ctx.font = `italic 700 34px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(k.fit(ctx, `“${a.note}”`, 900), 540, y + 20); ctx.textAlign = 'left'; y += 60;
      }
      const ph = 150;
      k.panel(ctx, t, 70, y, 940, ph, 36);
      ctx.fillStyle = t.dim; ctx.font = `800 23px ${FONT}`; k.spaced(ctx, 'MI SEMANA', 104, y + 50, 3);
      ctx.fillStyle = t.text; ctx.font = `800 36px ${FONT}`;
      ctx.fillText(`${wk.n} ${wk.n === 1 ? 'actividad' : 'actividades'} · ${Activity.minText(wk.min)}${wk.km > 0 ? ` · ${Activity.kmText(wk.km)}` : ''}`, 104, y + 108);
      return y + ph;
    });
  }

  // ---------- 3) nivel ----------
  async function level(prefs) {
    const ev = Gamify.evaluate();
    const done = ev.list.filter((x) => x.done);
    return frame(prefs, { sub: 'Mi progreso', chip: ev.st.streak > 0 ? `🔥 ${ev.st.streak} sem` : '', eyebrow: 'MI NIVEL', title: ev.lvl.title }, async (c, y0) => {
      let y = y0 + 10;
      const { ctx, t, k, FONT, fmt, grad } = c;
      const R = c.story ? 230 : 170; const cx = 540; const cy = y + R + 20;
      ctx.lineWidth = 34; ctx.lineCap = 'round';
      ctx.strokeStyle = t.track; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
      const g = ctx.createLinearGradient(cx - R, cy, cx + R, cy); g.addColorStop(0, t.light ? k.darken(c.ac.a, 0.82) : c.ac.a); g.addColorStop(1, t.light ? k.darken(c.ac.c, 0.7) : c.ac.c);
      ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, ev.lvl.pct)); ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillStyle = t.dim; ctx.font = `800 28px ${FONT}`; k.spaced(ctx, 'NIVEL', cx, cy - R * 0.32, 8, 'center');
      ctx.fillStyle = grad(cx - 120, cx + 120); ctx.font = `900 ${c.story ? 230 : 170}px ${FONT}`; ctx.fillText(String(ev.lvl.level), cx, cy + R * 0.34);
      ctx.fillStyle = t.dim; ctx.font = `700 28px ${FONT}`; ctx.fillText(`${ev.lvl.toNext.toLocaleString('en-US')} XP para el nivel ${ev.lvl.level + 1}`, cx, cy + R * 0.34 + 62);
      ctx.textAlign = 'left';
      y = cy + R + 70;
      y = tiles(c, y, [{ v: String(ev.st.sessions), l: 'entrenos' }, { v: `${done.length}`, l: `medallas de ${ev.list.length}` }, { v: String(ev.st.streak), l: 'sem. de racha' }], fmt.tileH);
      // últimas medallas
      const recent = done.filter((x) => x.date && x.date !== 'previo').sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);
      const show = recent.length ? recent : done.slice(-6);
      if (show.length) {
        const ph = 190; const iy = titled(c, y, ph, 'ÚLTIMAS MEDALLAS');
        const cw = 940 / show.length;
        show.forEach((m, i) => {
          const mx = 70 + cw * i + cw / 2;
          ctx.textAlign = 'center'; ctx.font = `60px ${FONT}`; ctx.fillStyle = t.text; ctx.fillText(m.icon, mx, iy + 56);
          ctx.fillStyle = t.dim; ctx.font = `700 20px ${FONT}`; ctx.fillText(k.fit(ctx, m.name, cw - 8), mx, iy + 96);
        });
        ctx.textAlign = 'left';
        y += ph;
      }
      return y;
    });
  }

  // ---------- 4) récords ----------
  function recordRows(n) {
    const wl = DB.getWorkoutLog(); const exs = DB.getExercises(); const seen = new Set(); const rows = [];
    Object.keys(wl).sort().reverse().forEach((d) => (wl[d].exercises || []).forEach((e) => {
      const prs = (e.sets || []).filter((s) => s.pr && !Metrics.isWarmup(s));
      if (!prs.length || seen.has(e.exerciseId)) return;
      const ex = exs.find((x) => x.id === e.exerciseId); const isCardio = !!(ex && ex.group === 'cardio');
      const best = isCardio ? prs.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a), prs[0]) : prs.reduce((a, b) => (Metrics.loadOf(b) > Metrics.loadOf(a) ? b : a), prs[0]);
      seen.add(e.exerciseId);
      rows.push({ name: ex ? ex.name : 'Ejercicio', text: Metrics.formatSet(best, isCardio), date: d });
    }));
    return rows.slice(0, n);
  }
  async function records(prefs) {
    const k = K(); const fmt = k.FORMATS[prefs.format] || k.FORMATS.feed;
    const rows = recordRows(isStory(fmt) ? 7 : 4);
    const sportRecs = typeof Activity !== 'undefined' ? Activity.records().slice(0, isStory(fmt) ? 3 : 1) : [];
    const all = rows.map((r) => ({ icon: '🏆', name: r.name, text: r.text, date: r.date })).concat(sportRecs.map((r) => ({ icon: r.icon, name: r.title, text: r.value, date: r.date })));
    return frame(prefs, { sub: 'Mis marcas', eyebrow: '🏆  RÉCORDS PERSONALES', title: all.length ? `${all.length} ${all.length === 1 ? 'marca' : 'marcas'}` : 'Aún sin marcas', gold: true }, async (c, y0) => {
      let y = y0;
      const { ctx, t, FONT, grad } = c;
      if (!all.length) { ctx.fillStyle = t.dim; ctx.font = `700 34px ${FONT}`; ctx.fillText('Rompe tu primer récord y vuelve aquí.', 70, y + 60); return y + 90; }
      const rowH = 98; const ph = 92 + all.length * rowH;
      const iy = titled(c, y, ph, 'ÚLTIMAS MARCAS');
      all.forEach((r, i) => {
        const ry = iy + i * rowH;
        c.k.rrect(ctx, 88, ry, 904, rowH - 12, 24); ctx.fillStyle = t.gold; ctx.fill();
        ctx.font = `46px ${FONT}`; ctx.fillStyle = t.text; ctx.fillText(r.icon, 112, ry + 58);
        ctx.fillStyle = t.text; ctx.font = `800 32px ${FONT}`; ctx.fillText(c.k.fit(ctx, r.name, 430), 186, ry + 42);
        ctx.fillStyle = t.dim; ctx.font = `600 22px ${FONT}`; ctx.fillText(Utils.shortDate(r.date), 186, ry + 72);
        ctx.textAlign = 'right'; ctx.fillStyle = grad(600, 980); ctx.font = `900 36px ${FONT}`; ctx.fillText(r.text, 968, ry + 58); ctx.textAlign = 'left';
      });
      return y + ph;
    });
  }

  // ---------- ventana con vista previa (formato, estilo, compartir/guardar) ----------
  async function preview(title, render, fileBase) {
    const k = K(); const prefs = k.loadPrefs();
    const body = Utils.el('div', { class: 'share-body' });
    Modal.open(title, body);
    const opt = Utils.el('div', { class: 'share-opts' }); const out = Utils.el('div', { class: 'share-out' });
    body.appendChild(opt); body.appendChild(out);
    let seq = 0; let lastUrl = null;
    const chips = (map, key) => {
      const row = Utils.el('div', { class: 'rt-chips share-chips' });
      Object.keys(map).forEach((m) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${prefs[key] === m ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: map[m].label });
        c.addEventListener('click', () => { if (prefs[key] === m) return; prefs[key] = m; k.savePrefs(prefs); paintOpts(); paint(); });
        row.appendChild(c);
      });
      return row;
    };
    const paintOpts = () => { opt.innerHTML = ''; opt.appendChild(chips(k.FORMATS, 'format')); opt.appendChild(chips(k.STYLES, 'style')); };
    async function paint() {
      const mine = ++seq; out.innerHTML = '';
      out.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;', text: 'Preparando tu historia…' }));
      let canvas;
      try { canvas = await render(prefs); } catch (e) { console.error(e); if (mine === seq) { out.innerHTML = ''; out.appendChild(Utils.el('p', { text: 'No pude crear la imagen.' })); } return; }
      const blob = await k.toBlob(canvas);
      if (mine !== seq) return;
      out.innerHTML = '';
      if (!blob) { out.appendChild(Utils.el('p', { text: 'No pude crear la imagen.' })); return; }
      if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) { /* nada */ } }
      const url = lastUrl = URL.createObjectURL(blob);
      const name = `mygymtrack-${fileBase}-${prefs.format}.png`;
      out.appendChild(Utils.el('div', { class: `share-frame${prefs.style === 'clear' ? ' checker' : ''}` }, [Utils.el('img', { class: 'share-img', src: url, alt: 'Tu historia' })]));
      if (prefs.style === 'clear') out.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;margin:0 0 10px;', text: 'Fondo transparente: en Instagram agrégala sobre tu foto o video como sticker.' }));
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
      if (canShare) {
        const sb = Utils.el('button', { class: 'btn-primary btn-block', text: '📤 Compartir' });
        sb.addEventListener('click', async () => { try { await navigator.share({ files: [file], title: 'MyGymTrack' }); } catch (e) { /* cerró la hoja */ } });
        out.appendChild(sb);
      }
      const save = Utils.el('button', { class: canShare ? 'btn-secondary btn-block' : 'btn-primary btn-block', text: '⬇️ Guardar imagen' });
      save.addEventListener('click', async () => { const ok = await Utils.saveFile(blob, name); if (ok !== false) Utils.toast('Imagen guardada ✓'); });
      out.appendChild(save);
    }
    paintOpts(); paint();
  }

  const openWeekly = (offset) => preview('📊 Mi semana', (p) => weekly(p, offset || 0), `semana-${Utils.todayISO()}`);
  const openActivity = (a) => preview('🏃 Mi actividad', (p) => activity(p, a), `actividad-${a.date}`);
  const openLevel = () => preview('🎮 Mi nivel', (p) => level(p), `nivel-${Utils.todayISO()}`);
  const openRecords = () => preview('🏆 Mis récords', (p) => records(p), `records-${Utils.todayISO()}`);

  // menú con todas las historias
  function hub() {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Imágenes listas para tus historias o para mandar. Elige estilo y formato, incluso con fondo transparente.' }));
    const last = typeof Activity !== 'undefined' ? Activity.list()[0] : null;
    const items = [
      ['📊', 'Mi semana', 'Entrenos, deporte, días activos y nivel', () => openWeekly(new Date().getDay() === 1 ? -1 : 0)],
      ['🎮', 'Mi nivel', 'Nivel, XP, medallas y racha', openLevel],
      ['🏆', 'Mis récords', 'Tus últimas marcas personales', openRecords],
    ];
    if (last) items.push([Activity.typeOf(last.type).i, 'Mi última actividad', `${Activity.typeOf(last.type).n} · ${Utils.shortDate(last.date)}`, () => openActivity(last)]);
    items.forEach(([ic, name, desc, fn]) => {
      const b = Utils.el('button', { type: 'button', class: 'story-item' }, [Utils.el('span', { class: 'si-i', text: ic }), Utils.el('span', { class: 'si-t' }, [Utils.el('b', { text: name }), Utils.el('small', { text: desc })])]);
      b.addEventListener('click', () => { Modal.close(); setTimeout(fn, 280); });
      body.appendChild(b);
    });
    Modal.open('📤 Historias para compartir', body);
  }

  return { hub, openWeekly, openActivity, openLevel, openRecords, weekly, activity, level, records };
})();
