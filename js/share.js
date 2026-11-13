/* ============================================================
   share.js — Compartir tu entreno como imagen.
   Dibuja una tarjeta vertical (1080×1350) con tu resumen, el mapa
   muscular y tus mejores series, y la manda por WhatsApp, Instagram,
   etc. (hoja "Compartir" del celular) o la guarda como PNG.
   Todo se dibuja en tu celular: no se sube nada a internet.
   ============================================================ */

const Share = (() => {
  const W = 1080;
  const H = 1350;
  const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

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

  function mapSvg(iso, color) {
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
    svg = svg.replace('</svg>', '<style>.bm-base{fill:rgba(255,255,255,.07);stroke:rgba(255,255,255,.22);stroke-width:.8}.bm-m{fill:rgba(255,255,255,.1);stroke:rgba(255,255,255,.24);stroke-width:.7;stroke-linejoin:round}.bm-lines{fill:none;stroke:rgba(0,0,0,.4);stroke-width:.9;stroke-linecap:round}</style></svg>');
    return { src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, names };
  }

  async function render(iso, log) {
    const data = gather(iso, log);
    const ac = Utils.accent();
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    // fondo
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W * 0.15, H * 0.05, 40, W * 0.15, H * 0.05, 900);
    g.addColorStop(0, `${ac.a}66`); g.addColorStop(1, 'rgba(11,13,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    g = ctx.createRadialGradient(W * 0.95, H * 0.98, 40, W * 0.95, H * 0.98, 800);
    g.addColorStop(0, `${ac.c}40`); g.addColorStop(1, 'rgba(11,13,18,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

    // cabecera: logo + nombre
    const icon = await loadImg('icons/icon-192.png');
    if (icon) { ctx.save(); rrect(ctx, 70, 64, 92, 92, 22); ctx.clip(); ctx.drawImage(icon, 70, 64, 92, 92); ctx.restore(); }
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'alphabetic';
    ctx.font = `800 46px ${FONT}`; ctx.fillText('MiGymTrack', 184, 120);
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `600 28px ${FONT}`;
    ctx.fillText(Utils.friendlyDate(iso), 184, 154);

    // título
    ctx.fillStyle = '#fff'; ctx.font = `900 78px ${FONT}`;
    ctx.fillText(data.prs ? '¡Entreno de récords! 🏆' : '¡Entreno completado! 💪', 70, 290);
    if (data.routine) {
      ctx.fillStyle = ac.c; ctx.font = `700 40px ${FONT}`;
      ctx.fillText(fit(ctx, data.routine.name, W - 140), 70, 346);
    }

    // estadísticas
    const stats = [[String(data.exCount), 'ejercicios'], [String(data.sets), 'series'], [`${Utils.compact(Units.fromKg(data.vol))} ${Units.current()}`, 'volumen']];
    const bw = (W - 140 - 40) / 3;
    stats.forEach(([v, l], i) => {
      const x = 70 + i * (bw + 20);
      rrect(ctx, x, 392, bw, 150, 28);
      ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = `900 ${v.length > 7 ? 46 : 58}px ${FONT}`; ctx.fillText(v, x + bw / 2, 478);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `700 26px ${FONT}`; ctx.fillText(l, x + bw / 2, 520);
      ctx.textAlign = 'left';
    });

    // mapa muscular + lista
    let y = 590;
    let hasMap = false;
    const map = mapSvg(iso, ac.main.startsWith('#') ? ac.main : '#ff6a3d');
    if (map) {
      const img = await loadImg(map.src);
      if (img) {
        ctx.drawImage(img, 60, y, 440, 470);
        ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `800 24px ${FONT}`;
        ctx.fillText('MÚSCULOS TRABAJADOS', 540, y + 36);
        const top = map.names.slice(0, 6);
        const maxN = top[0].n;
        top.forEach((m, i) => {
          const yy = y + 84 + i * 64;
          ctx.fillStyle = '#fff'; ctx.font = `700 30px ${FONT}`;
          ctx.fillText(fit(ctx, m.name, 300), 540, yy);
          const barW = 150;
          rrect(ctx, 880, yy - 22, barW, 20, 10); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill();
          rrect(ctx, 880, yy - 22, Math.max(20, barW * (m.n / maxN)), 20, 10);
          const bg = ctx.createLinearGradient(880, 0, 880 + barW, 0); bg.addColorStop(0, ac.a); bg.addColorStop(1, ac.c);
          ctx.fillStyle = bg; ctx.fill();
        });
        y += 470;
        hasMap = true;
      }
    }

    // mejores series
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = `800 24px ${FONT}`;
    ctx.fillText('MEJORES SERIES', 70, y + 20);
    const room = hasMap ? 3 : 6;
    data.rows.slice().sort((a, b) => (b.pr - a.pr) || (b.load - a.load)).slice(0, room).forEach((r, i) => {
      const yy = y + 76 + i * 62;
      ctx.fillStyle = '#fff'; ctx.font = `700 31px ${FONT}`; ctx.textAlign = 'left';
      ctx.fillText(fit(ctx, `${r.pr ? '🏆 ' : ''}${r.name}`, 560), 70, yy);
      ctx.fillStyle = ac.c; ctx.font = `800 31px ${FONT}`; ctx.textAlign = 'right';
      ctx.fillText(r.text, W - 70, yy);
      ctx.textAlign = 'left';
    });

    // pie
    ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.font = `600 24px ${FONT}`; ctx.textAlign = 'center';
    const who = (DB.getSettings().userName || '').trim();
    ctx.fillText(who ? `${who} · Hecho con MiGymTrack` : 'Hecho con MiGymTrack', W / 2, H - 30);
    ctx.textAlign = 'left';
    return canvas;
  }

  const toBlob = (canvas) => new Promise((res) => canvas.toBlob(res, 'image/png'));

  // abre la ventana con la vista previa y los botones
  async function open(iso, log, opts = {}) {
    const body = Utils.el('div', { class: 'share-body' });
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;', text: 'Preparando tu tarjeta…' }));
    Modal.open('📤 Compartir entreno', body, { onClose: opts.onClose });
    let canvas;
    try { canvas = await render(iso, log); } catch (e) { console.error(e); body.innerHTML = ''; body.appendChild(Utils.el('p', { text: 'No pude crear la imagen.' })); return; }
    const blob = await toBlob(canvas);
    if (!blob) { body.innerHTML = ''; body.appendChild(Utils.el('p', { text: 'No pude crear la imagen.' })); return; }
    const url = URL.createObjectURL(blob);
    const name = `migymtrack-${iso}.png`;
    body.innerHTML = '';
    body.appendChild(Utils.el('img', { class: 'share-img', src: url, alt: 'Tarjeta de tu entreno' }));
    const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null;
    const canShare = !!(file && navigator.canShare && navigator.canShare({ files: [file] }));
    if (canShare) {
      const shareBtn = Utils.el('button', { class: 'btn-primary btn-block', text: '📤 Compartir' });
      shareBtn.addEventListener('click', async () => {
        try { await navigator.share({ files: [file], title: 'Mi entreno' }); } catch (e) { /* cerró la hoja */ }
      });
      body.appendChild(shareBtn);
    }
    const saveBtn = Utils.el('button', { class: canShare ? 'btn-secondary btn-block' : 'btn-primary btn-block', text: '⬇️ Guardar imagen' });
    saveBtn.addEventListener('click', async () => { const ok = await Utils.saveFile(blob, name); if (ok !== false) Utils.toast('Imagen guardada ✓'); });
    body.appendChild(saveBtn);
  }

  return { open, render, gather };
})();
