/* ============================================================
   friends.js — Liga de amigos: compites sanamente cada semana por XP
   con la gente que agregues con su código de amigo (6 letras/números).
   Tus amigos solo ven: nombre, nivel, XP de la semana, entrenos, días
   activos y minutos de deporte. Se apoya en el usuario del ranking.
   ============================================================ */

const Friends = (() => {
  const PUB_KEY = 'gt_friends_pub';
  const MIN_GAP_MS = 60 * 1000;             // no publicar más de una vez por minuto
  const SAME_GAP_MS = 6 * 3600 * 1000;      // si nada cambió, cada 6 horas
  let busy = false;

  const enabled = () => !!(window.GT_CONFIG && window.GT_CONFIG.friends);
  const lbOk = () => enabled() && typeof Leaderboard !== 'undefined' && Leaderboard.configured() && !!Leaderboard.user();
  const weekOf = (offset) => Metrics.weekRange(offset);

  // ---------- publicar mi semana ----------
  async function publishWeek(offset) {
    const u = Leaderboard.user(); const wk = weekOf(offset);
    const w = Gamify.weeklyXp(wk.start);
    const lvl = Gamify.levelInfo(Gamify.evaluate().xp);
    await Leaderboard.rpc('gt_publish_week', {
      p_secret: u.secret, p_week: wk.start, p_xp: Math.min(20000, w.xp), p_sessions: Math.min(50, w.sessions), p_days: Math.min(7, w.days),
      p_sport_min: Math.min(5000, Math.round(w.sportMin)), p_level: Math.max(1, Math.min(200, lvl.level)), p_title: lvl.title,
    });
    return w;
  }
  // se llama seguido (tras cada logro/serie); aquí se limita y se evita repetir
  async function touch(force) {
    if (busy || !lbOk() || !navigator.onLine) return false;
    let pub = {}; try { pub = JSON.parse(localStorage.getItem(PUB_KEY) || '{}'); } catch (e) { pub = {}; }
    const now = Date.now();
    const cur = Gamify.weeklyXp(weekOf(0).start);
    const sig = `${weekOf(0).start}|${cur.xp}|${cur.sessions}|${cur.days}|${Math.round(cur.sportMin)}`;
    if (!force) {
      if (pub.t && now - pub.t < MIN_GAP_MS) return false;
      if (pub.sig === sig && pub.t && now - pub.t < SAME_GAP_MS) return false;
    }
    busy = true;
    try {
      await publishWeek(0);
      if (new Date().getDay() <= 1) { try { await publishWeek(-1); } catch (e) { /* la semana pasada es opcional */ } }   // domingo/lunes: cierra la anterior
      try { localStorage.setItem(PUB_KEY, JSON.stringify({ t: now, sig })); } catch (e) { /* nada */ }
      return true;
    } catch (e) { return false; } finally { busy = false; }
  }

  // ---------- datos ----------
  const boardOf = (offset) => Leaderboard.rpc('gt_friends_board', { p_secret: Leaderboard.user().secret, p_week: weekOf(offset).start });
  const myCode = () => Leaderboard.rpc('gt_my_friend_code', { p_secret: Leaderboard.user().secret });
  const addFriend = (code) => Leaderboard.rpc('gt_add_friend', { p_secret: Leaderboard.user().secret, p_code: code });
  const removeFriend = (id) => Leaderboard.rpc('gt_remove_friend', { p_secret: Leaderboard.user().secret, p_friend: id });

  const inviteText = (code) => `💪 Súmate a mi liga de MyGymTrack y compitamos cada semana.\nAbre la app → Progreso → Ranking → 👥 Amigos y escribe mi código: ${code}\n${location.origin}${location.pathname.replace(/index\.html$/, '')}`;
  async function copy(text, ok) { try { await navigator.clipboard.writeText(text); Utils.toast(ok); } catch (e) { Utils.toast('No pude copiar'); } }

  // ---------- pantalla ----------
  const MEDAL = ['🥇', '🥈', '🥉'];
  const daysLeft = () => { const d = new Date().getDay(); return 6 - d; };       // sábado = 0 (termina hoy)

  function leagueCard(rows, last) {
    const wk = weekOf(0);
    const c = Utils.el('div', { class: 'card fr-league' });
    c.appendChild(Utils.el('div', { class: 'flex-between' }, [
      Utils.el('div', {}, [Utils.el('div', { class: 'eyebrow', text: '🏁 Liga de la semana' }), Utils.el('div', { class: 'small text-dim', text: `${Utils.shortDate(wk.start)} – ${Utils.shortDate(wk.end)} · ${daysLeft() === 0 ? 'termina hoy' : `quedan ${daysLeft()} día${daysLeft() === 1 ? '' : 's'}`}` })]),
    ]));
    const max = Math.max(1, ...rows.map((r) => r.xp));
    rows.forEach((r, i) => {
      const row = Utils.el('div', { class: `fr-row${r.me ? ' me' : ''}` });
      row.appendChild(Utils.el('div', { class: 'fr-pos', text: r.xp > 0 && i < 3 ? MEDAL[i] : String(i + 1) }));
      const mid = Utils.el('div', { class: 'fr-mid' }, [
        Utils.el('div', { class: 'fr-name' }, [Utils.el('b', { text: r.me ? `${r.name} (tú)` : r.name }), Utils.el('span', { class: 'fr-lv', text: `Nv ${r.level}` })]),
        Utils.el('div', { class: 'fr-bar' }, [Utils.el('i', { style: `width:${Math.max(r.xp > 0 ? 4 : 0, Math.round((r.xp / max) * 100))}%` })]),
        Utils.el('div', { class: 'small text-dim fr-meta', text: `${r.sessions} entreno${r.sessions === 1 ? '' : 's'} · ${r.days} día${r.days === 1 ? '' : 's'}${r.sport_min > 0 ? ` · 🏃 ${r.sport_min} min` : ''}` }),
      ]);
      row.appendChild(mid);
      row.appendChild(Utils.el('div', { class: 'fr-xp' }, [Utils.el('b', { text: r.xp.toLocaleString('en-US') }), Utils.el('span', { text: 'XP' })]));
      c.appendChild(row);
    });
    if (last && last.length && last[0].xp > 0) {
      c.appendChild(Utils.el('div', { class: 'small text-dim fr-crown', text: `👑 Ganó la semana pasada: ${last[0].me ? 'tú' : last[0].name} (${last[0].xp.toLocaleString('en-US')} XP)` }));
    }
    return c;
  }

  function render(view, u, hooks) {
    hooks = hooks || {};
    if (!u) {
      const c = Utils.el('div', { class: 'card' });
      c.appendChild(Utils.el('div', { class: 'eyebrow', text: '👥 Liga de amigos' }));
      c.appendChild(Utils.el('p', { class: 'small', style: 'margin:6px 0 10px;', text: 'Compite cada semana por XP con tus amigos. Para empezar crea tu usuario del ranking (solo un nombre, sin correo); te toca un código de amigo para invitar.' }));
      const b = Utils.el('button', { type: 'button', class: 'btn-primary btn-block', text: '➕ Crear mi usuario' });
      b.addEventListener('click', () => { if (hooks.join) hooks.join(); });
      c.appendChild(b); view.appendChild(c); return;
    }
    const host = Utils.el('div'); view.appendChild(host);
    host.appendChild(Utils.el('div', { class: 'card' }, [Utils.el('p', { class: 'small text-dim', style: 'text-align:center;margin:8px 0;', text: 'Cargando tu liga…' })]));
    load(host, u);
  }

  async function load(host, u) {
    let code = ''; let rows = []; let last = [];
    try {
      await touch(true);
      [code, rows, last] = await Promise.all([myCode(), boardOf(0), boardOf(-1).catch(() => [])]);
    } catch (e) {
      host.innerHTML = '';
      const c = Utils.el('div', { class: 'card' }, [Utils.el('p', { text: e.message || 'No pude cargar la liga.' })]);
      const r = Utils.el('button', { type: 'button', class: 'btn-secondary btn-block', text: 'Reintentar' });
      r.addEventListener('click', () => { host.innerHTML = ''; load(host, u); });
      c.appendChild(r); host.appendChild(c); return;
    }
    host.innerHTML = '';
    paint(host, u, code, rows, last);
  }

  function paint(host, u, code, rows, last) {
    const reload = () => { host.innerHTML = ''; load(host, u); };
    // mi código
    const mine = Utils.el('div', { class: 'card fr-code-card' });
    mine.appendChild(Utils.el('div', { class: 'eyebrow', text: '🔑 Tu código de amigo' }));
    mine.appendChild(Utils.el('div', { class: 'fr-code', text: code }));
    const btns = Utils.el('div', { class: 'grid-2' });
    const inv = Utils.el('button', { type: 'button', class: 'btn-primary', text: navigator.share ? '📤 Invitar' : '📋 Copiar invitación' });
    inv.addEventListener('click', async () => { const t = inviteText(code); if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) { /* cerró */ } } else copy(t, 'Invitación copiada ✓'); });
    const cp = Utils.el('button', { type: 'button', class: 'btn-secondary', text: '📋 Copiar código' });
    cp.addEventListener('click', () => copy(code, 'Código copiado ✓'));
    btns.appendChild(inv); btns.appendChild(cp); mine.appendChild(btns);
    host.appendChild(mine);

    // agregar amigo
    const add = Utils.el('div', { class: 'card' });
    add.appendChild(Utils.el('div', { class: 'eyebrow', text: '➕ Agregar un amigo' }));
    const input = Utils.el('input', { type: 'text', maxlength: '6', placeholder: 'Código de amigo', autocapitalize: 'characters', autocomplete: 'off', class: 'fr-input', 'aria-label': 'Código del amigo' });
    const go = Utils.el('button', { type: 'button', class: 'btn-primary btn-block', style: 'margin-top:8px;', text: 'Agregar' });
    const doAdd = async () => {
      const c = input.value.trim(); if (c.length !== 6) { Utils.toast('El código tiene 6 caracteres'); return; }
      go.disabled = true; go.textContent = 'Buscando…';
      try { const r = await addFriend(c); Utils.toast(r && r.already ? `Ya eres amigo de ${r.name}` : `🤝 ${r.name} ahora está en tu liga`); reload(); } catch (e) { go.disabled = false; go.textContent = 'Agregar'; Utils.toast(e.message); }
    };
    go.addEventListener('click', doAdd);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doAdd(); });
    add.appendChild(Utils.el('div', { class: 'field', style: 'margin-top:8px;' }, [input])); add.appendChild(go);
    host.appendChild(add);

    // liga
    if (rows.length <= 1) {
      host.appendChild(Utils.el('div', { class: 'empty-state' }, [Utils.el('div', { class: 'icon', text: '👥' }), Utils.el('div', { text: 'Aún no tienes amigos en tu liga. Mándales tu código y compitan cada semana por XP.' })]));
    }
    host.appendChild(leagueCard(rows, last));

    // administrar amigos
    const friends = rows.filter((r) => !r.me);
    if (friends.length) {
      const det = Utils.el('details', { class: 'fold' });
      det.appendChild(Utils.el('summary', {}, [Utils.el('span', { text: `👥 Mis amigos (${friends.length})` })]));
      const box = Utils.el('div', { class: 'fold-body' });
      friends.forEach((f) => {
        const row = Utils.el('div', { class: 'fr-manage' }, [Utils.el('span', { text: f.name })]);
        const rm = Utils.el('button', { type: 'button', class: 'btn-small', text: 'Quitar', 'aria-label': `Quitar a ${f.name}` });
        rm.addEventListener('click', async () => {
          if (!Utils.confirmDialog(`¿Quitar a ${f.name} de tu liga? Dejarán de verse mutuamente.`)) return;
          try { await removeFriend(f.id); Utils.toast('Quitado de tu liga'); reload(); } catch (e) { Utils.toast(e.message); }
        });
        row.appendChild(rm); box.appendChild(row);
      });
      det.appendChild(box); host.appendChild(det);
    }
    host.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: 'Tus amigos solo ven tu nombre, nivel, XP de la semana, entrenos, días activos y minutos de deporte. Nada de comidas, medidas ni fotos.' }));
  }

  return { enabled, render, touch, publishWeek, inviteText };
})();
