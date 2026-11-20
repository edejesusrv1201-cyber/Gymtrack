/* ============================================================
   unitfix.js — «Corregir pesos» (Más → Herramientas).
   Mucha gente anotó pesos en libras mientras la app estaba en kilos:
   se guardó «100 kg» cuando eran 100 lb. Aquí eliges los ejercicios
   y los números que escribiste pasan a contar como LIBRAS (se
   guardan ×0,4536). Se puede deshacer (se recuerdan los cambios).
   ============================================================ */

const UnitFix = (() => {
  const UNDO_KEY = 'gt_unitfix_undo';   // [{ d, id, i, w }] pesos anteriores, para deshacer
  const F = 0.45359237;

  const readUndo = () => { try { return JSON.parse(localStorage.getItem(UNDO_KEY) || 'null'); } catch (e) { return null; } };
  const writeUndo = (v) => { try { if (v) localStorage.setItem(UNDO_KEY, JSON.stringify(v)); else localStorage.removeItem(UNDO_KEY); } catch (e) { /* sin almacenamiento */ } };

  // ejercicios con series con peso: { id, name, sets, max, first, last }
  function scan() {
    const wl = DB.getWorkoutLog();
    const exs = {};
    DB.getExercises().forEach((e) => { exs[e.id] = e; });
    const by = {};
    Object.keys(wl).sort().forEach((d) => (wl[d].exercises || []).forEach((en) => {
      const ex = exs[en.exerciseId];
      if (!ex || ex.group === 'cardio') return;
      (en.sets || []).forEach((s) => {
        const w = Number(s.weight);
        if (!(w > 0)) return;
        const r = by[ex.id] || (by[ex.id] = { id: ex.id, name: ex.name, sets: 0, max: 0, first: d, last: d });
        r.sets += 1; r.max = Math.max(r.max, w); r.last = d;
      });
    }));
    return Object.keys(by).map((k) => by[k]).sort((a, b) => b.sets - a.sets);
  }

  // convierte los pesos de los ejercicios `ids` desde `fromISO` (o todo). Devuelve cuántas series cambió.
  function apply(ids, fromISO) {
    const wl = DB.getWorkoutLog();
    const set = new Set(ids);
    const undo = [];
    Object.keys(wl).forEach((d) => {
      if (fromISO && d < fromISO) return;
      (wl[d].exercises || []).forEach((en) => {
        if (!set.has(en.exerciseId)) return;
        (en.sets || []).forEach((s, i) => {
          const w = Number(s.weight);
          if (!(w > 0)) return;
          undo.push({ d, id: en.exerciseId, i, w });
          s.weight = Math.round(w * F * 10000) / 10000;
        });
      });
    });
    if (undo.length) { DB.saveWorkoutLog(wl); writeUndo({ at: Date.now(), list: undo }); }
    return undo.length;
  }

  function undo() {
    const u = readUndo();
    if (!u || !u.list) return 0;
    const wl = DB.getWorkoutLog();
    let n = 0;
    u.list.forEach((c) => {
      const en = wl[c.d] && (wl[c.d].exercises || []).find((e) => e.exerciseId === c.id);
      const s = en && en.sets && en.sets[c.i];
      if (s) { s.weight = c.w; n += 1; }
    });
    DB.saveWorkoutLog(wl);
    writeUndo(null);
    return n;
  }

  function open() {
    const body = Utils.el('div');
    const rows = scan();
    const chosen = new Set();
    body.appendChild(Utils.el('p', { class: 'small', text: '¿Anotaste pesos en libras cuando la app estaba en kilos? Marca los ejercicios y esos números pasarán a contar como libras. Tus series, récords y volumen se recalculan solos.' }));
    const list = Utils.el('div', { class: 'uf-list' });
    const from = Utils.el('input', { type: 'date', 'aria-label': 'Corregir desde esta fecha' });
    const go = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: 'Corregir' });
    const msg = Utils.el('div', { class: 'small text-dim', style: 'margin:8px 0;text-align:center;' });

    const upd = () => { go.disabled = !chosen.size; go.textContent = chosen.size ? `Corregir ${chosen.size} ejercicio${chosen.size === 1 ? '' : 's'}` : 'Marca al menos un ejercicio'; };
    if (!rows.length) list.appendChild(Utils.el('p', { class: 'small text-dim', text: 'Aún no tienes series con peso.' }));
    rows.forEach((r) => {
      const cb = Utils.el('input', { type: 'checkbox', 'aria-label': r.name });
      cb.addEventListener('change', () => { if (cb.checked) chosen.add(r.id); else chosen.delete(r.id); upd(); });
      list.appendChild(Utils.el('label', { class: 'uf-row' }, [
        cb,
        Utils.el('div', { class: 'uf-main' }, [
          Utils.el('b', { text: r.name }),
          Utils.el('span', { class: 'small text-dim', text: `${r.sets} serie${r.sets === 1 ? '' : 's'} · tu máximo: ${Units.label(r.max)} → quedaría ${Units.label(r.max * F)}` }),
        ]),
      ]));
    });
    body.appendChild(list);
    body.appendChild(Utils.el('div', { class: 'field', style: 'margin-top:10px;' }, [Utils.el('label', { text: 'Solo desde esta fecha (opcional)' }), from]));
    body.appendChild(msg);
    body.appendChild(go);
    upd();

    const un = readUndo();
    if (un && un.list && un.list.length) {
      const b = Utils.el('button', { class: 'btn-secondary btn-block', type: 'button', style: 'margin-top:8px;', text: `↩︎ Deshacer la última corrección (${un.list.length} series)` });
      b.addEventListener('click', () => {
        if (!window.confirm('¿Deshacer la última corrección de pesos?')) return;
        const n = undo(); Modal.close(); Utils.toast(`↩︎ ${n} serie${n === 1 ? '' : 's'} restaurada${n === 1 ? '' : 's'}`); App.navigate(App.currentView, App.currentParams);
      });
      body.appendChild(b);
    }
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: 'Si ya publicaste esa marca en el ranking, ajústala en Progreso → Ranking → Mis marcas → Editar.' }));

    go.addEventListener('click', () => {
      if (!chosen.size) return;
      if (!window.confirm(`Los pesos de ${chosen.size} ejercicio${chosen.size === 1 ? '' : 's'} pasarán a contar como libras. Se puede deshacer. ¿Seguir?`)) return;
      const n = apply(Array.from(chosen), from.value || '');
      Modal.close();
      Utils.toast(n ? `✓ ${n} serie${n === 1 ? '' : 's'} corregida${n === 1 ? '' : 's'}` : 'No había series para corregir en esa fecha');
      App.navigate(App.currentView, App.currentParams);
    });
    Modal.open('🔧 Corregir pesos (libras)', body);
  }

  return { open, scan, apply, undo };
})();
