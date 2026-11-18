/* ============================================================
   admin.js — Panel de administración (solo para cuentas autorizadas).
   Comentarios de la gente, resumen general y estado de las cuentas.
   Nunca muestra el contenido de las copias de nadie.
   Se activa solo si tu cuenta está en gt_admins (supabase/admin.sql).
   ============================================================ */

const Admin = (() => {
  const CACHE = 'gt_isAdmin';
  const cached = () => { try { return sessionStorage.getItem(CACHE); } catch (e) { return null; } };
  const setCached = (v) => { try { sessionStorage.setItem(CACHE, v ? '1' : '0'); } catch (e) { /* nada */ } };
  const KIND = { bug: '🐞 Falla', idea: '💡 Idea', duda: '❓ Duda', otro: '💬 Otro', problema: '🐞 Falla', sugerencia: '💡 Idea' };
  const kindLabel = (k) => KIND[String(k || '').toLowerCase()] || `💬 ${k || 'Comentario'}`;
  const when = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'ahora';
    if (mins < 60) return `hace ${mins} min`;
    if (mins < 1440) return `hace ${Math.round(mins / 60)} h`;
    if (mins < 43200) return `hace ${Math.round(mins / 1440)} d`;
    return d.toLocaleDateString('es');
  };

  async function isAdmin() {
    if (typeof Cloud === 'undefined' || !Cloud.signedIn()) return false;
    const c = cached();
    if (c !== null) return c === '1';
    try { const v = await Cloud.rpcAuth('gt_is_admin', {}); setCached(v === true); return v === true; } catch (e) { return false; }
  }

  // tarjeta para «Más»: aparece sola si eres administrador
  function card() {
    const host = Utils.el('div');
    isAdmin().then((ok) => {
      if (!ok) return;
      const c = Utils.el('div', { class: 'card admin-card' });
      c.appendChild(Utils.el('h3', { text: '🛠️ Administración' }));
      c.appendChild(Utils.el('p', { class: 'small', text: 'Comentarios de la gente, resumen de cuentas y estado de las copias. No muestra el contenido de los datos de nadie.' }));
      const badge = Utils.el('span', { class: 'admin-dot hidden' });
      const b = Utils.el('button', { class: 'btn-primary btn-block', type: 'button' }, [Utils.el('span', { text: '🛠️ Abrir panel' }), badge]);
      b.addEventListener('click', open);
      c.appendChild(b);
      host.appendChild(c);
      Cloud.rpcAuth('gt_admin_stats', {}).then((s) => { if (s && s.feedback_open > 0) { badge.textContent = String(s.feedback_open); badge.classList.remove('hidden'); } }).catch(() => {});
    });
    return host;
  }

  function open() {
    const body = Utils.el('div', { class: 'admin-body' });
    let tab = 'fb';
    let showDone = false;
    const content = Utils.el('div');
    const paint = () => {
      body.innerHTML = '';
      body.appendChild(Utils.segmented([{ key: 'fb', label: '💬 Comentarios' }, { key: 'stats', label: '📊 Resumen' }, { key: 'users', label: '👥 Cuentas' }], tab, (k) => { tab = k; paint(); }, true));
      content.innerHTML = '';
      body.appendChild(content);
      if (tab === 'fb') feedback(content, showDone, (v) => { showDone = v; paint(); });
      else if (tab === 'stats') stats(content);
      else users(content);
    };
    paint();
    Modal.open('🛠️ Administración', body);
  }

  const loading = (host) => { host.innerHTML = ''; host.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;padding:18px 0;', text: 'Cargando…' })); };
  const fail = (host, e) => { host.innerHTML = ''; host.appendChild(Utils.el('div', { class: 'sm-warn', text: e.message === 'busy' || /No pude/.test(e.message) ? 'No pude cargar. Revisa que ejecutaste supabase/admin.sql y tu internet.' : e.message })); };

  async function feedback(host, showDone, setShowDone) {
    loading(host);
    let rows;
    try { rows = await Cloud.rpcAuth('gt_admin_feedback', { p_only_open: !showDone, p_limit: 100 }); } catch (e) { fail(host, e); return; }
    host.innerHTML = '';
    const tog = Utils.el('button', { type: 'button', class: `uni-chip${showDone ? ' on' : ''}`, style: 'margin:10px 0 6px;', text: showDone ? '✓ Mostrando también los resueltos' : 'Mostrar también los resueltos' });
    tog.addEventListener('click', () => setShowDone(!showDone));
    host.appendChild(tog);
    if (!rows.length) { host.appendChild(Utils.el('p', { class: 'small text-dim', style: 'text-align:center;padding:16px 0;', text: showDone ? 'Aún no hay comentarios.' : '🎉 No hay comentarios pendientes.' })); return; }
    rows.forEach((r) => {
      const item = Utils.el('div', { class: `fb-item${r.done ? ' done' : ''}` });
      item.appendChild(Utils.el('div', { class: 'fb-head' }, [
        Utils.el('b', { text: kindLabel(r.kind) }),
        Utils.el('span', { class: 'small text-dim', text: `${when(r.created_at)}${r.app_version ? ` · ${r.app_version}` : ''}` }),
      ]));
      item.appendChild(Utils.el('div', { class: 'fb-msg', text: r.message }));
      const meta = [r.name ? `— ${r.name}` : '', r.device || ''].filter(Boolean).join(' · ');
      if (meta) item.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:4px;word-break:break-word;', text: meta }));
      const row = Utils.el('div', { class: 'fb-actions' });
      const ok = Utils.el('button', { type: 'button', class: 'btn-small', text: r.done ? '↩︎ Reabrir' : '✓ Resuelto' });
      ok.addEventListener('click', async () => { ok.disabled = true; try { await Cloud.rpcAuth('gt_admin_feedback_mark', { p_id: r.id, p_done: !r.done }); feedback(host, showDone, setShowDone); } catch (e) { Utils.toast(e.message); ok.disabled = false; } });
      const cp = Utils.el('button', { type: 'button', class: 'btn-small', text: '📋 Copiar' });
      cp.addEventListener('click', async () => {
        const text = `[${kindLabel(r.kind)} · ${r.app_version || ''}] ${r.message}${meta ? `\n${meta}` : ''}`;
        try { await navigator.clipboard.writeText(text); Utils.toast('Copiado ✓'); } catch (e) { Utils.toast('No pude copiar'); }
      });
      const del = Utils.el('button', { type: 'button', class: 'btn-small', style: 'color:var(--red);', text: '🗑️' });
      del.addEventListener('click', async () => {
        if (!Utils.confirmDialog('¿Borrar este comentario para siempre?')) return;
        try { await Cloud.rpcAuth('gt_admin_feedback_delete', { p_id: r.id }); feedback(host, showDone, setShowDone); } catch (e) { Utils.toast(e.message); }
      });
      row.appendChild(ok); row.appendChild(cp); row.appendChild(del);
      item.appendChild(row);
      host.appendChild(item);
    });
  }

  async function stats(host) {
    loading(host);
    let s;
    try { s = await Cloud.rpcAuth('gt_admin_stats', {}); } catch (e) { fail(host, e); return; }
    host.innerHTML = '';
    const box = (n, t) => Utils.el('div', { class: 'stat-box' }, [Utils.el('div', { class: 'val', text: String(n) }), Utils.el('div', { class: 'lbl', text: t })]);
    host.appendChild(Utils.el('div', { class: 'grid-3 mt-12' }, [box(s.users, 'cuentas'), box(s.confirmed, 'confirmadas'), box(s.backups, 'con copia')]));
    host.appendChild(Utils.el('div', { class: 'grid-3 mt-12' }, [box(s.ranking_users, 'en el ranking'), box(s.scores, 'marcas'), box(s.feedback_open, 'comentarios')]));
    host.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:12px;', text: `Última copia subida: ${when(s.last_backup)}. Comentarios en total: ${s.feedback_total}.` }));
  }

  async function users(host) {
    loading(host);
    let rows;
    try { rows = await Cloud.rpcAuth('gt_admin_users', {}); } catch (e) { fail(host, e); return; }
    host.innerHTML = '';
    host.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin:10px 0 4px;', text: 'Correo parcial y estado de la copia. El contenido de los datos no se muestra.' }));
    rows.forEach((u) => {
      host.appendChild(Utils.el('div', { class: 'diag-row' }, [
        Utils.el('div', { class: 'diag-main' }, [
          Utils.el('b', { text: u.mail || '—' }),
          Utils.el('span', { class: 'small text-dim', text: `Creada ${when(u.created_at)} · ${u.last_sign_in ? `entró ${when(u.last_sign_in)}` : 'nunca entró'}` }),
          Utils.el('span', { class: 'small text-dim', text: u.backup_at ? `Copia ${when(u.backup_at)} · ${u.backup_kb || 0} KB${u.device ? ` · ${u.device}` : ''}` : 'Sin copia todavía' }),
        ]),
        Utils.el('span', { class: `diag-chip ${u.confirmed ? 'ok' : 'pend'}`, text: u.confirmed ? 'Confirmada' : 'Sin confirmar' }),
      ]));
    });
  }

  return { card, open, isAdmin };
})();
