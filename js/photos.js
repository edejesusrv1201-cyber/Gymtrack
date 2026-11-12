/* ============================================================
   photos.js — Fotos de progreso. Se guardan solo en este celular
   (IndexedDB), reducidas para ocupar poco. No van en el respaldo
   JSON/Excel: guarda también una copia en tu galería.
   ============================================================ */

const Photos = (() => {
  const DB_NAME = 'migymtrack-photos';
  const STORE = 'photos';
  const ANGLES = [['frente', 'Frente'], ['lado', 'Lado'], ['espalda', 'Espalda']];

  function open() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { reject(new Error('Este navegador no permite guardar fotos')); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore(STORE, { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('No se pudo abrir el almacén de fotos'));
    });
  }
  const tx = (db, mode) => db.transaction(STORE, mode).objectStore(STORE);
  const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });

  async function all() {
    const db = await open();
    const list = await wrap(tx(db, 'readonly').getAll());
    return list.sort((a, b) => (a.date === b.date ? a.time - b.time : a.date < b.date ? -1 : 1));
  }
  async function put(rec) { const db = await open(); await wrap(tx(db, 'readwrite').put(rec)); }
  async function remove(id) { const db = await open(); await wrap(tx(db, 'readwrite').delete(id)); }

  // reduce la foto: grande (para ver) y miniatura
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const make = (max, q) => {
          const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          return c.toDataURL('image/jpeg', q);
        };
        resolve({ data: make(1100, 0.78), thumb: make(260, 0.7) });
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pude abrir la foto')); };
      img.src = url;
    });
  }

  // peso (kg) más cercano a una fecha
  function weightNear(iso) {
    const ms = DB.getMeasurements().filter((m) => m.weight);
    if (!ms.length) return null;
    let best = ms[0];
    const t = Utils.parseISO(iso).getTime();
    ms.forEach((m) => { if (Math.abs(Utils.parseISO(m.date).getTime() - t) < Math.abs(Utils.parseISO(best.date).getTime() - t)) best = m; });
    return Math.abs(Utils.parseISO(best.date).getTime() - t) <= 10 * 86400000 ? Number(best.weight) : null;
  }

  function openAdd(onSaved) {
    const body = Utils.el('div');
    let angle = 'frente';
    body.appendChild(Utils.el('p', { class: 'small', text: 'Misma luz, misma distancia y misma hora del día para comparar mejor. Las fotos se quedan solo en tu celular.' }));
    const chips = Utils.el('div', { class: 'rt-chips' });
    const paint = () => {
      chips.innerHTML = '';
      ANGLES.forEach(([k, t]) => {
        const c = Utils.el('button', { type: 'button', class: `rt-chip plain${k === angle ? ' active' : ''}`, style: '--gc:var(--accent-light)', text: t });
        c.addEventListener('click', () => { angle = k; paint(); });
        chips.appendChild(c);
      });
    };
    paint();
    body.appendChild(chips);
    const status = Utils.el('div', { class: 'small text-dim hidden', style: 'text-align:center;margin:8px 0;' });
    const mk = (cap) => {
      const inp = Utils.el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
      if (cap) inp.setAttribute('capture', 'environment');
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        inp.value = '';
        if (!f) return;
        status.classList.remove('hidden'); status.textContent = 'Guardando…';
        try {
          const s = await shrink(f);
          await put({ id: DB.uid(), date: Utils.todayISO(), time: Date.now(), angle, data: s.data, thumb: s.thumb });
          Modal.close();
          Utils.toast('Foto guardada 📸');
          if (onSaved) onSaved();
        } catch (e) { status.textContent = `No se pudo guardar: ${e.message || e}`; }
      });
      return inp;
    };
    const camIn = mk(true); const galIn = mk(false);
    const cam = Utils.el('button', { class: 'btn-primary btn-block', text: '📷 Tomar foto' });
    cam.addEventListener('click', () => camIn.click());
    const gal = Utils.el('button', { class: 'btn-secondary btn-block', text: '🖼️ Elegir de la galería' });
    gal.addEventListener('click', () => galIn.click());
    body.appendChild(cam); body.appendChild(gal); body.appendChild(camIn); body.appendChild(galIn); body.appendChild(status);
    Modal.open('📸 Nueva foto de progreso', body);
  }

  function infoLine(p) {
    const w = weightNear(p.date);
    return `${Utils.friendlyDate(p.date)} · ${(ANGLES.find((a) => a[0] === p.angle) || [0, ''])[1]}${w ? ` · ${Units.label(w)}` : ''}`;
  }

  function openViewer(p, list, onChanged) {
    const body = Utils.el('div', { style: 'text-align:center;' });
    body.appendChild(Utils.el('img', { class: 'photo-full', src: p.data, alt: 'Foto de progreso' }));
    body.appendChild(Utils.el('div', { class: 'small', style: 'margin:8px 0;', text: infoLine(p) }));
    const same = list.filter((x) => x.angle === p.angle);
    const first = same[0];
    if (first && first.id !== p.id) {
      const cmp = Utils.el('button', { class: 'btn-primary btn-block', text: `Comparar con la primera (${Utils.shortDate(first.date)})` });
      cmp.addEventListener('click', () => openCompare(first, p, list));
      body.appendChild(cmp);
    }
    const del = Utils.el('button', { class: 'btn-secondary btn-block', style: 'color:var(--red);', text: '🗑️ Eliminar foto' });
    del.addEventListener('click', async () => {
      if (!Utils.confirmDialog('¿Eliminar esta foto? No se puede deshacer.')) return;
      await remove(p.id);
      Modal.close();
      if (onChanged) onChanged();
    });
    body.appendChild(del);
    Modal.open('Foto de progreso', body);
  }

  // antes / ahora: deslizador sobre la misma foto o lado a lado; se puede cambiar cualquiera de las dos
  let cmpMode = 'slide';
  function openCompare(a, b, list) {
    const pool = (list || []).filter((x) => x.angle === a.angle);
    const body = Utils.el('div');
    let pa = a; let pb = b;
    const stage = Utils.el('div');
    const info = Utils.el('p', { class: 'small', style: 'margin-top:8px;' });

    const pick = (label, get, set) => {
      const sel = Utils.el('select', {});
      pool.forEach((p) => sel.appendChild(Utils.el('option', { value: p.id, text: `${Utils.shortDate(p.date)}${weightNear(p.date) ? ` · ${Units.label(weightNear(p.date))}` : ''}` })));
      sel.value = get().id;
      sel.addEventListener('change', () => { set(pool.find((p) => p.id === sel.value)); draw(); });
      return Utils.el('div', { class: 'field' }, [Utils.el('label', { text: label }), sel]);
    };
    if (pool.length > 2) body.appendChild(Utils.el('div', { class: 'field-row' }, [pick('Antes', () => pa, (p) => { pa = p; }), pick('Ahora', () => pb, (p) => { pb = p; })]));
    body.appendChild(Utils.segmented([{ key: 'slide', label: 'Deslizar' }, { key: 'side', label: 'Lado a lado' }], cmpMode, (k) => { cmpMode = k; paintSeg(); draw(); }, true));
    const segHolder = body.lastChild;
    function paintSeg() { segHolder.querySelectorAll('.seg-btn').forEach((bt, i) => bt.classList.toggle('active', (i === 0) === (cmpMode === 'slide'))); }
    body.appendChild(Utils.el('div', { style: 'height:10px' }));
    body.appendChild(stage);
    body.appendChild(info);

    function draw() {
      stage.innerHTML = '';
      if (cmpMode === 'side') {
        const col = (p, tag) => Utils.el('div', { class: 'cmp-col' }, [
          Utils.el('div', { class: 'eyebrow', text: tag }),
          Utils.el('img', { src: p.data, alt: tag }),
          Utils.el('div', { class: 'small', text: infoLine(p) }),
        ]);
        stage.appendChild(Utils.el('div', { class: 'cmp-grid' }, [col(pa, 'Antes'), col(pb, 'Ahora')]));
      } else {
        const wrap = Utils.el('div', { class: 'cmp-slider' });
        const under = Utils.el('img', { src: pb.data, alt: 'Ahora', draggable: 'false' });
        const over = Utils.el('img', { class: 'cmp-over', src: pa.data, alt: 'Antes', draggable: 'false' });
        const handle = Utils.el('div', { class: 'cmp-handle' }, [Utils.el('span', { text: '⇆' })]);
        wrap.appendChild(under); wrap.appendChild(over); wrap.appendChild(handle);
        wrap.appendChild(Utils.el('span', { class: 'cmp-tag l', text: `Antes · ${Utils.shortDate(pa.date)}` }));
        wrap.appendChild(Utils.el('span', { class: 'cmp-tag r', text: `Ahora · ${Utils.shortDate(pb.date)}` }));
        const setPos = (pct) => {
          const p = Math.max(0, Math.min(100, pct));
          over.style.clipPath = `inset(0 ${100 - p}% 0 0)`;
          handle.style.left = `${p}%`;
        };
        setPos(50);
        const move = (e) => { const r = wrap.getBoundingClientRect(); setPos(((e.clientX - r.left) / r.width) * 100); };
        wrap.addEventListener('pointerdown', (e) => { wrap.setPointerCapture(e.pointerId); move(e); wrap.onpointermove = move; });
        wrap.addEventListener('pointerup', () => { wrap.onpointermove = null; });
        stage.appendChild(wrap);
      }
      const days = Math.round((Utils.parseISO(pb.date) - Utils.parseISO(pa.date)) / 86400000);
      const wa = weightNear(pa.date); const wb = weightNear(pb.date);
      let txt = `${days} días entre las dos fotos.`;
      if (wa && wb) txt += ` Peso: ${Units.label(wa)} → ${Units.label(wb)} (${wb - wa >= 0 ? '+' : ''}${Utils.round1(Units.fromKg(wb - wa))} ${Units.current()}).`;
      info.textContent = txt;
    }
    draw();
    Modal.open('Antes y ahora', body);
  }

  // tarjeta para Cuerpo
  function card() {
    const c = Utils.el('div', { class: 'card' });
    const count = Utils.el('span', { class: 'eyebrow' });
    c.appendChild(Utils.el('div', { class: 'card-title-row' }, [Utils.el('h3', { text: '📸 Fotos de progreso' }), count]));
    const grid = Utils.el('div', { class: 'photo-grid' });
    const add = Utils.el('button', { class: 'btn-secondary btn-block', text: '➕ Agregar foto' });
    c.appendChild(grid);
    c.appendChild(add);
    c.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:8px;', text: 'Las fotos se guardan solo en este celular y no van en el respaldo. Guarda también una copia en tu galería.' }));

    async function load() {
      grid.innerHTML = '';
      let list = [];
      try { list = await all(); } catch (e) { grid.appendChild(Utils.el('p', { class: 'small text-dim', text: String(e.message || e) })); add.disabled = true; return; }
      count.textContent = list.length ? String(list.length) : '';
      const oldCmp = c.querySelector('.cmp-quick');
      if (oldCmp) oldCmp.remove();
      if (!list.length) grid.appendChild(Utils.el('p', { class: 'small text-dim', style: 'grid-column:1/-1;', text: 'Aún no tienes fotos. Una al mes es suficiente para ver el cambio.' }));
      list.slice().reverse().forEach((p) => {
        const t = Utils.el('button', { class: 'photo-thumb', type: 'button' }, [
          Utils.el('img', { src: p.thumb, alt: 'Foto' }),
          Utils.el('span', { text: Utils.shortDate(p.date) }),
        ]);
        t.addEventListener('click', () => openViewer(p, list, load));
        grid.appendChild(t);
      });
      if (list.length >= 2) {
        const ang = list[list.length - 1].angle;
        const same = list.filter((x) => x.angle === ang);
        if (same.length >= 2) {
          const cmp = Utils.el('button', { class: 'btn-primary btn-block', style: 'margin-top:10px;', text: 'Comparar primera y última' });
          cmp.addEventListener('click', () => openCompare(same[0], same[same.length - 1], list));
          cmp.classList.add('cmp-quick');
          c.insertBefore(cmp, add);
        }
      }
    }
    add.addEventListener('click', () => openAdd(load));
    load();
    return c;
  }

  return { all, card, openAdd };
})();
