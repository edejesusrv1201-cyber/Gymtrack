/* ============================================================
   feedback.js — «Enviar feedback» dentro de la app
   Va a tu base de datos (Supabase) con la versión y el modelo del
   celular. Si no hay internet, se comparte o copia el texto.
   ============================================================ */

const Feedback = (() => {
  const KINDS = [['bug', '🐞 Algo falla'], ['idea', '💡 Una idea'], ['love', '😍 Me gustó'], ['other', '💬 Otro']];

  function version() {
    try { const s = document.querySelector('script[src*="js/app.js"]'); const m = s && s.src.match(/v=(\d+)/); return m ? `v${m[1]}` : ''; } catch (e) { return ''; }
  }
  function device() {
    const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
    return `${navigator.userAgent.slice(0, 140)} | ${screen.width}x${screen.height} | ${standalone ? 'app instalada' : 'navegador'}`;
  }

  function open(preset) {
    const body = Utils.el('div');
    let kind = (preset && preset.kind) || 'idea';
    body.appendChild(Utils.el('p', { class: 'small', text: 'Cuéntame qué te gusta, qué falla o qué te gustaría que tuviera la app. Me llega directo.' }));
    const row = Utils.el('div', { class: 'rt-chips' });
    const paint = () => { row.innerHTML = ''; KINDS.forEach(([k, t]) => { const c = Utils.el('button', { type: 'button', class: `rt-chip plain${kind === k ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t }); c.addEventListener('click', () => { kind = k; paint(); }); row.appendChild(c); }); };
    paint();
    body.appendChild(row);
    const msg = Utils.el('textarea', { rows: '5', maxlength: '2000', placeholder: 'Escribe aquí…', style: 'width:100%;margin-top:10px;' });
    body.appendChild(msg);
    const name = Utils.el('input', { type: 'text', maxlength: '40', placeholder: 'Tu nombre (opcional)', value: DB.getSettings().userName || '', style: 'margin-top:8px;' });
    body.appendChild(name);
    let withDevice = true;
    const dev = Utils.el('button', { type: 'button', class: 'uni-chip on', style: 'margin-top:10px;', text: '✓ Incluir versión y modelo del celular (ayuda a arreglar fallas)' });
    dev.addEventListener('click', () => { withDevice = !withDevice; dev.classList.toggle('on', withDevice); dev.textContent = withDevice ? '✓ Incluir versión y modelo del celular (ayuda a arreglar fallas)' : 'No incluir datos del celular'; });
    body.appendChild(dev);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:6px;', text: 'No se envían tus entrenos, comidas ni fotos: solo lo que escribas aquí (y, si dejas marcada la casilla de arriba, los últimos errores internos de la app).' }));
    const send = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', style: 'margin-top:8px;', text: '📨 Enviar' });
    send.addEventListener('click', async () => {
      const text = msg.value.trim();
      if (text.length < 3) { Utils.toast('Escribe tu mensaje'); return; }
      send.disabled = true; send.textContent = 'Enviando…';
      // con "incluir datos del celular" también van los últimos errores internos (ayudan a encontrar la falla)
      const errs = withDevice && typeof ErrLog !== 'undefined' ? ErrLog.summary(3) : '';
      const sent = errs ? `${text.slice(0, 1500)}\n\n[Errores recientes]\n${errs}`.slice(0, 2000) : text;
      const payload = { p_kind: kind, p_message: sent, p_version: version(), p_device: withDevice ? device() : '', p_name: name.value.trim() };
      try {
        if (typeof Leaderboard === 'undefined' || !Leaderboard.configured()) throw new Error('sin servidor');
        await Leaderboard.rpc('gt_send_feedback', payload);
        Modal.close();
        Utils.toast('¡Gracias! Lo recibí 🙌');
      } catch (e) {
        // sin internet o sin servidor: lo comparte o lo copia para que no se pierda
        const full = `[MyGymTrack ${payload.p_version}] ${KINDS.find((x) => x[0] === kind)[1]}\n${sent}${payload.p_name ? `\n— ${payload.p_name}` : ''}${withDevice ? `\n${payload.p_device}` : ''}`;
        send.disabled = false; send.textContent = '📨 Enviar';
        if (navigator.share) { try { await navigator.share({ text: full }); Modal.close(); return; } catch (err) { /* cerró */ } }
        try { await navigator.clipboard.writeText(full); Utils.toast('No pude enviarlo: lo copié para que lo pegues en un mensaje'); } catch (err) { Utils.toast('No pude enviarlo. Revisa tu internet.'); }
      }
    });
    body.appendChild(send);
    Modal.open('💬 Enviar feedback', body);
    setTimeout(() => { try { msg.focus(); } catch (e) { /* sin foco */ } }, 350);
  }

  return { open, version };
})();
