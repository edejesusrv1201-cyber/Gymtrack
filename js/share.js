/* ============================================================
   share.js — Compartir tu entreno como imagen.
   Dibuja una tarjeta con tu resumen, el mapa muscular y tus mejores
   series. Dos formatos (Publicación 4:5 e Historia 9:16) y cuatro
   estilos (oscuro, negro, claro y transparente para ponerla sobre tu
   foto). Se manda por WhatsApp, Instagram, etc. o se guarda como PNG.
   Todo se dibuja en tu celular: no se sube nada a internet.
   ============================================================ */

const Share = (() => {
  const W = 1080;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
  const GOLD = '#ffc53d';

  const FORMATS = {
    feed:  { label: '▭ Publicación', H: 1350, top: 56,  gap: 24, mapH: 436, rows: 3, bottom: 30,  tileH: 160, mus: 6, step: 58, off: 106 },
    story: { label: '▯ Historia',    H: 1920, top: 170, gap: 34, mapH: 570, rows: 5, bottom: 150, tileH: 190, mus: 8, step: 60, off: 112 },
  };
  const STYLES = {
    dark:  { label: 'Oscuro' },
    black: { label: 'Negro' },
    light: { label: 'Claro' },
    clear: { label: 'Transparente' },
  };

  // colores según el estilo
  function theme(style, ac) {
    if (style === 'light') return { bg: '#f3efe8', glowA: `${ac.a}38`, glowC: `${ac.c}2c`, text: '#14161c', dim: 'rgba(20,22,28,.55)', panel: 'rgba(255,255,255,.78)', stroke: 'rgba(20,22,28,.1)', ring: 'rgba(20,22,28,.05)', mapBase: 'rgba(20,22,28,.07)', mapLine: 'rgba(20,22,28,.28)', track: 'rgba(20,22,28,.1)', gold: 'rgba(255,197,61,.28)', shadow: false, light: true };
    if (style === 'black') return { bg: '#000', glowA: `${ac.a}26`, glowC: `${ac.c}18`, text: '#fff', dim: 'rgba(255,255,255,.55)', panel: 'rgba(255,255,255,.05)', stroke: 'rgba(255,255,255,.1)', ring: 'rgba(255,255,255,.05)', mapBase: 'rgba(255,255,255,.07)', mapLine: 'rgba(255,255,255,.24)', track: 'rgba(255,255,255,.1)', gold: 'rgba(255,197,61,.14)', shadow: false };
    if (style === 'clear') return { bg: null, text: '#fff', dim: 'rgba(255,255,255,.7)', panel: 'rgba(9,11,16,.74)', stroke: 'rgba(255,255,255,.16)', ring: null, mapBase: 'rgba(255,255,255,.09)', mapLine: 'rgba(255,255,255,.26)', track: 'rgba(255,255,255,.14)', gold: 'rgba(255,197,61,.16)', shadow: true };
    return { bg: '#0b0d12', glowA: `${ac.a}66`, glowC: `${ac.c}40`, text: '#fff', dim: 'rgba(255,255,255,.55)', panel: 'rgba(255,255,255,.065)', stroke: 'rgba(255,255,255,.12)', ring: 'rgba(255,255,255,.045)', mapBase: 'rgba(255,255,255,.07)', mapLine: 'rgba(255,255,255,.22)', track: 'rgba(255,255,255,.1)', gold: 'rgba(255,197,61,.14)', shadow: false };
  }

  const rrect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  function loadImg(src) {
    return new Promise((resolve) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => resolve(null);
      im.src = src;
    });
  }

  // recorta el texto con "…" si no cabe
  function fit(ctx, text, maxW) {
    if (ctx.measureText(text).width <= maxW) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
    return `${t}…`;
  }

  // texto en mayúsculas con espacio entre letras (a la izquierda, centro o derecha)
  function spaced(ctx, text, x, y, sp, align = 'left') {
    const chars = [...text];
    const widths = chars.map((c) => ctx.measureText(c).width);
    const total = widths.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
    let cx = align === 'center' ? x - total / 2 : align === 'right' ? x - total : x;
    const prev = ctx.textAlign; ctx.textAlign = 'left';
    chars.forEach((c, i) => { ctx.fillText(c, cx, y); cx += widths[i] + sp; });
    ctx.textAlign = prev;
    return total;
  }

  // panel de vidrio
  function panel(ctx, t, x, y, w, h, r, tint) {
    ctx.save();
    if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8; }
    rrect(ctx, x, y, w, h, r);
    ctx.fillStyle = tint || t.panel; ctx.fill();
    ctx.restore();
    rrect(ctx, x, y, w, h, r);
    ctx.strokeStyle = t.stroke; ctx.lineWidth = 2; ctx.stroke();
    // brillo fino arriba
    ctx.save(); rrect(ctx, x, y, w, h, r); ctx.clip();
    const hl = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 90));
    hl.addColorStop(0, t.light ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.08)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hl; ctx.fillRect(x, y, w, Math.min(h, 90));
    ctx.restore();
  }

  // oscurece un color #rrggbb (para que se lea sobre fondo claro)
  const darken = (hex, f) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgb(${Math.round((n >> 16) * f)},${Math.round(((n >> 8) & 255) * f)},${Math.round((n & 255) * f)})`;
  };
  const bigNum = (n) => (n >= 100000 ? Utils.compact(n) : Math.round(n).toLocaleString('en-US'));

  // datos del día
  function gather(iso, log) {
    const exs = DB.getExercises();
    const rows = [];
    let sets = 0; let vol = 0; let prs = 0;
    (log.exercises || []).forEach((e) => {
      const work = (e.sets || []).filter((s) => !Metrics.isWarmup(s));
      if (!work.length) return;
      const ex = exs.find((x) => x.id === e.exerciseId);
      const isCardio = !!(ex && ex.group === 'cardio');
      sets += work.length;
      vol += work.reduce((s, x) => s + Metrics.volumeOfSet(x), 0);
      const best = isCardio
        ? work.reduce((a, b) => ((b.duration || 0) > (a.duration || 0) ? b : a), work[0])
        : work.reduce((a, b) => (Metrics.loadOf(b) > Metrics.loadOf(a) ? b : a), work[0]);
      const pr = work.some((s) => s.pr);
      if (pr) prs += 1;
      rows.push({ name: ex ? ex.name : 'Ejercicio', n: work.length, text: Metrics.formatSet(best, isCardio), pr, load: isCardio ? 0 : Metrics.loadOf(best) });
    });
    const routine = log.routineId ? DB.getRoutines().find((r) => r.id === log.routineId) : null;
    return { rows, sets, vol, prs, routine, exCount: rows.length };
  }

  function mapSvg(iso, color, t) {
    const d = Muscles.setsBetween(iso, iso);
    const fills = {};
    const names = [];
    Muscles.LIST.forEach((m) => {
      const n = d[m.id].sets;
      if (n <= 0) return;
      fills[m.id] = { color, opacity: Math.min(0.95, 0.4 + n * 0.14) };
      names.push({ name: m.name.replace(/ \(.*\)/, ''), n });
    });
    if (!names.length) return null;
    names.sort((a, b) => b.n - a.n);
    let svg = Muscles.bodySvg(fills, { mini: true });
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="330" height="352" ');
    svg = svg.replace('</svg>', `<style>.bm-base{fill:${t.mapBase};stroke:${t.mapLine};stroke-width:.8}.bm-m{fill:${t.mapBase};stroke:${t.mapLine};stroke-width:.7;stroke-linejoin:round}.bm-lines{fill:none;stroke:rgba(0,0,0,.4);stroke-width:.9;stroke-linecap:round}</style></svg>`);
    return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, names };
  }

  async function render(iso, log, prefs = {}) {
    const fmt = FORMATS[prefs.format] || FORMATS.feed;
    const H = fmt.H;
    const data = gather(iso, log);
    const ac = Utils.accent();
    const t = theme(prefs.style, ac);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const grad = (x0, x1) => { if (t.light) { const l = ctx.createLinearGradient(x0, 0, x1, 0); l.addColorStop(0, darken(ac.a, 0.82)); l.addColorStop(1, darken(ac.c, 0.7)); return l; } const g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, ac.a); g.addColorStop(1, ac.c); return g; };
    const accentText = t.light ? ac.a : ac.c;

    // ---- fondo ----
    if (t.bg) {
      ctx.fillStyle = t.bg; ctx.fillRect(0, 0, W, H);
      let g = ctx.createRadialGradient(W * 0.15, H * 0.04, 40, W * 0.15, H * 0.04, 900);
      g.addColorStop(0, t.glowA); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      g = ctx.createRadialGradient(W * 0.95, H * 0.98, 40, W * 0.95, H * 0.98, 800);
      g.addColorStop(0, t.glowC); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (t.ring) {
        ctx.strokeStyle = t.ring; ctx.lineWidth = 3;
        [260, 380, 500, 620].forEach((r) => { ctx.beginPath(); ctx.arc(W - 30, fmt.top + 40, r, 0, Math.PI * 2); ctx.stroke(); });
      }
    }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const txtShadow = (on) => { if (t.shadow) { ctx.shadowColor = on ? 'rgba(0,0,0,.55)' : 'transparent'; ctx.shadowBlur = on ? 14 : 0; ctx.shadowOffsetY = on ? 3 : 0; } };

    // ---- cabecera ----
    let y = fmt.top;
    const icon = await loadImg('icons/logo-192.png');
    if (icon) { ctx.save(); if (t.shadow) { ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 16; } rrect(ctx, 70, y, 92, 92, 24); ctx.clip(); ctx.drawImage(icon, 70, y, 92, 92); ctx.restore(); }
    txtShadow(true);
    ctx.fillStyle = t.text; ctx.font = `800 44px ${FONT}`; ctx.fillText('MyGymTrack', 184, y + 44);
    ctx.fillStyle = t.dim; ctx.font = `600 28px ${FONT}`; ctx.fillText(Utils.friendlyDate(iso), 184, y + 82);
    txtShadow(false);
    // racha / número de entreno (arriba a la derecha)
    let chip = '';
    try { const st = Gamify.computeStats(); chip = st.streak > 0 ? `🔥 ${st.streak} sem` : (st.sessions ? `Entreno nº ${st.sessions}` : ''); } catch (e) { chip = ''; }
    if (chip) {
      ctx.font = `800 28px ${FONT}`;
      const cw = ctx.measureText(chip).width + 44;
      panel(ctx, t, W - 70 - cw, y + 18, cw, 56, 28);
      ctx.fillStyle = t.text; ctx.textAlign = 'center'; ctx.fillText(chip, W - 70 - cw / 2, y + 56); ctx.textAlign = 'left';
    }
    y += 92;

    // ---- título ----
    y += 62;
    txtShadow(true);
    ctx.fillStyle = data.prs ? (t.light ? '#c98a00' : GOLD) : accentText; ctx.font = `800 27px ${FONT}`;
    spaced(ctx, data.prs ? '🏆  ENTRENO DE RÉCORDS' : 'ENTRENO COMPLETADO', 70, y, 5);
    y += 98;
    const title = data.routine ? data.routine.name : 'Entreno libre';
    let fs = 96;
    do { ctx.font = `900 ${fs}px ${FONT}`; fs -= 4; } while (ctx.measureText(title).width > W - 140 && fs > 48);
    ctx.fillStyle = t.text; ctx.fillText(title, 70, y);
    txtShadow(false);

    // ---- cifras ----
    y += 34;
    const tw = [W - 140 - 40 - 2 * 230, 230, 230];   // la de volumen es más ancha
    const stats = [[bigNum(Units.fromKg(data.vol)), `${Units.current()} de volumen`], [String(data.sets), 'series'], [String(data.exCount), 'ejercicios']];
    let tx = 70;
    stats.forEach(([v, l], i) => {
      panel(ctx, t, tx, y, tw[i], fmt.tileH, 30);
      const big = i === 0;
      ctx.textAlign = 'center';
      const cx = tx + tw[i] / 2;
      const size = big ? (v.length > 6 ? 78 : 96) : 68;
      ctx.font = `900 ${size}px ${FONT}`;
      ctx.fillStyle = grad(tx, tx + tw[i]);
      ctx.fillText(v, cx, y + fmt.tileH * 0.56);
      ctx.fillStyle = t.dim; ctx.font = `700 ${big ? 28 : 25}px ${FONT}`;
      ctx.fillText(l, cx, y + fmt.tileH * 0.56 + 44);
      ctx.textAlign = 'left';
      tx += tw[i] + 20;
    });
    y += fmt.tileH + fmt.gap;

    // ---- mapa muscular + lista ----
    let hasMap = false;
    const map = mapSvg(iso, ac.main && ac.main.startsWith('#') ? ac.main : '#ff6a3d', t);
    if (map) {
      const img = await loadImg(map.src);
      if (img) {
        panel(ctx, t, 70, y, W - 140, fmt.mapH, 36);
        const mh = Math.min(fmt.mapH - 40, 480); const mw = mh * (330 / 352);
        const mx = 70 + 22; const my = y + (fmt.mapH - mh) / 2;
        // resplandor detrás del cuerpo
        const gl = ctx.createRadialGradient(mx + mw / 2, my + mh * 0.42, 10, mx + mw / 2, my + mh * 0.42, mh * 0.62);
        gl.addColorStop(0, `${ac.a}${t.light ? '33' : '55'}`); gl.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.save(); rrect(ctx, 70, y, W - 140, fmt.mapH, 36); ctx.clip(); ctx.fillStyle = gl; ctx.fillRect(70, y, W - 140, fmt.mapH); ctx.restore();
        ctx.drawImage(img, mx, my, mw, mh);
        const lx = mx + mw + 34; const rx = W - 70 - 30;
        ctx.fillStyle = t.dim; ctx.font = `800 23px ${FONT}`;
        spaced(ctx, 'MÚSCULOS TRABAJADOS', lx, y + 56, 3);
        const top = map.names.slice(0, fmt.mus);
        const maxN = top[0].n;
        const barW = 120;
        top.forEach((m, i) => {
          const yy = y + fmt.off + i * fmt.step;
          ctx.fillStyle = t.text; ctx.font = `700 29px ${FONT}`;
          ctx.fillText(fit(ctx, m.name, rx - lx - barW - 18), lx, yy);
          rrect(ctx, rx - barW, yy - 20, barW, 18, 9); ctx.fillStyle = t.track; ctx.fill();
          rrect(ctx, rx - barW, yy - 20, Math.max(18, barW * (m.n / maxN)), 18, 9);
          ctx.fillStyle = grad(rx - barW, rx); ctx.fill();
        });
        y += fmt.mapH + fmt.gap;
        hasMap = true;
      }
    }

    // ---- mejores series ----
    const room = hasMap ? fmt.rows : fmt.rows + 3;
    const list = data.rows.slice().sort((a, b) => (b.pr - a.pr) || (b.load - a.load)).slice(0, room);
    if (list.length) {
      const rowH = 66;
      const ph = 78 + list.length * rowH + 14;
      panel(ctx, t, 70, y, W - 140, ph, 36);
      ctx.fillStyle = t.dim; ctx.font = `800 23px ${FONT}`;
      spaced(ctx, 'MEJORES SERIES', 100, y + 54, 3);
      list.forEach((r, i) => {
        const ry = y + 78 + i * rowH;
        if (r.pr) { rrect(ctx, 88, ry, W - 176, rowH - 8, 20); ctx.fillStyle = t.gold; ctx.fill(); }
        // número
        ctx.beginPath(); ctx.arc(128, ry + (rowH - 8) / 2, 20, 0, Math.PI * 2);
        ctx.fillStyle = r.pr ? GOLD : t.track; ctx.fill();
        ctx.fillStyle = r.pr ? '#1a1300' : t.text; ctx.font = `800 22px ${FONT}`; ctx.textAlign = 'center';
        ctx.fillText(String(i + 1), 128, ry + (rowH - 8) / 2 + 8); ctx.textAlign = 'left';
        // nombre y marca
        ctx.font = `800 31px ${FONT}`;
        ctx.textAlign = 'right'; ctx.fillStyle = grad(W - 400, W - 100);
        ctx.fillText(r.text, W - 104, ry + (rowH - 8) / 2 + 11);
        const tW = ctx.measureText(r.text).width;
        ctx.textAlign = 'left'; ctx.fillStyle = t.text; ctx.font = `700 30px ${FONT}`;
        ctx.fillText(fit(ctx, `${r.pr ? '🏆 ' : ''}${r.name}`, W - 104 - tW - 170 - 30), 166, ry + (rowH - 8) / 2 + 11);
      });
      y += ph;
    }

    // ---- pie ----
    txtShadow(true);
    ctx.fillStyle = t.dim; ctx.font = `700 25px ${FONT}`; ctx.textAlign = 'center';
    const who = (DB.getSettings().userName || '').trim();
    ctx.fillText(who ? `${who}  ·  hecho con MyGymTrack` : 'Hecho con MyGymTrack', W / 2, H - fmt.bottom);
    txtShadow(false);
    ctx.textAlign = 'left';
    return canvas;
  }

  const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

  const PREFS_KEY = 'gt_share_prefs';
  function loadPrefs() {
    try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); return { format: FORMATS[p.format] ? p.format : 'feed', style: STYLES[p.style] ? p.style : 'dark' }; } catch (e) { return { format: 'feed', style: 'dark' }; }
  }

  // abre la ventana con la vista previa y los botones
  async function open(iso, log, opts = {}) {
    const prefs = loadPrefs();
    const body = Utils.el('div', { class: 'share-body' });
    Modal.open('📤 Compartir entreno', body, { onClose: opts.onClose });
    const opt = Utils.el('div', { class: 'share-opts' });
    const out = Utils.el('div', { class: 'share-out' });
    body.appendChild(opt); body.appendChild(out);
    let seq = 0; let lastUrl = null;

    function chips(map, key) {
      const row = Utils.el('div', { class: 'rt-chips share-chips' });
      Object.keys(map).forEach((k) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${prefs[key] === k ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: map[k].label });
        c.addEventListener('click', () => { if (prefs[key] === k) return; prefs[key] = k; try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) { /* sin guardado */ } paintOpts(); paint(); });
        row.appendChild(c);
      });
      return row;
    }
    function paintOpts() { opt.innerHTML = ''; opt.appendChild(chips(FORMATS, 'format')); opt.appendChild(chips(STYLES, 'style')); }

    async function paint() {
      const mine = ++seq;
      out.innerHTML = '';
      out.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;', text: 'Preparando tu tarjeta…' }));
      let canvas;
      try { canvas = await render(iso, log, prefs); } catch (e) { console.error(e); if (mine === seq) { out.innerHTML = ''; out.appendChild(Utils.el('p', { text: 'No pude crear la imagen.' })); } return; }
      const blob = await toBlob(canvas);
      if (mine !== seq) return;
      out.innerHTML = '';
      if (!blob) { out.appendChild(Utils.el('p', { text: 'No pude crear la imagen.' })); return; }
      if (lastUrl) { try { URL.revokeObjectURL(lastUrl); } catch (e) { /* nada */ } }
      const url = lastUrl = URL.createObjectURL(blob);
      const name = `mygymtrack-${iso}-${prefs.format}.png`;
      out.appendChild(Utils.el('div', { class: `share-frame${prefs.style === 'clear' ? ' checker' : ''}` }, [Utils.el('img', { class: 'share-img', src: url, alt: 'Tarjeta de tu entreno' })]));
      if (prefs.style === 'clear') out.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;margin:0 0 10px;', text: 'Fondo transparente: en Instagram agrégala sobre tu foto o video como sticker.' }));
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
      const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
      if (canShare) {
        const shareBtn = Utils.el('button', { class: 'btn-primary btn-block', text: '📤 Compartir' });
        shareBtn.addEventListener('click', async () => {
          try { await navigator.share({ files: [file], title: 'Mi entreno' }); } catch (e) { /* cerró la hoja */ }
        });
        out.appendChild(shareBtn);
      }
      const saveBtn = Utils.el('button', { class: canShare ? 'btn-secondary btn-block' : 'btn-primary btn-block', text: '⬇️ Guardar imagen' });
      saveBtn.addEventListener('click', async () => { const ok = await Utils.saveFile(blob, name); if (ok !== false) Utils.toast('Imagen guardada ✓'); });
      out.appendChild(saveBtn);
    }

    paintOpts();
    paint();
  }

  return { open, render, gather };
})();
