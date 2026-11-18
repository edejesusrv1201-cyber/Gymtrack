/* ============================================================
   barcode.js — Escáner de código de barras para alimentos.
   - Con la cámara (si tu navegador lo permite) lee el código.
   - Si no, escribes los números del código a mano.
   Busca el producto en Open Food Facts (base de datos abierta). Solo
   se envía el NÚMERO del código, nada más. Si ya guardaste ese código
   en "Mis alimentos", lo encuentra sin internet.
   ============================================================ */

const Barcode = (() => {
  const API = 'https://world.openfoodfacts.org/api/v2/product/';
  const FIELDS = 'product_name,product_name_es,brands,nutriments,serving_size,serving_quantity,quantity';
  const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

  const cameraOk = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && 'BarcodeDetector' in window);
  const clean = (code) => String(code || '').replace(/\D/g, '');
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  const r1 = (n) => Math.round(n * 10) / 10;

  // producto ya guardado con ese código (funciona sin internet)
  function findSaved(code) {
    return DB.getFoods().find((f) => f.barcode && clean(f.barcode) === code) || null;
  }

  // convierte un producto de Open Food Facts → { name, brand, kcal, protein, carbs, fat, fiber, sugar, sodium, servingG, servingLabel } (por 100 g)
  function parse(p) {
    const n = p.nutriments || {};
    let kcal = num(n['energy-kcal_100g']);
    if (kcal === null && num(n.energy_100g) !== null) kcal = num(n.energy_100g) / 4.184;
    const protein = num(n.proteins_100g); const carbs = num(n.carbohydrates_100g); const fat = num(n.fat_100g);
    const name = String(p.product_name_es || p.product_name || '').trim();
    const brand = String(p.brands || '').split(',')[0].trim();
    if (kcal === null && protein === null && carbs === null && fat === null) return { empty: true, name, brand };
    if (kcal === null) kcal = (protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9;
    const fiber = num(n.fiber_100g); const sugar = num(n.sugars_100g);
    let sodium = num(n.sodium_100g);                       // en gramos
    if (sodium === null && num(n.salt_100g) !== null) sodium = num(n.salt_100g) / 2.5;
    const servingG = num(p.serving_quantity);
    return {
      name, brand,
      kcal: r1(kcal), protein: r1(protein || 0), carbs: r1(carbs || 0), fat: r1(fat || 0),
      fiber: fiber === null ? null : r1(fiber), sugar: sugar === null ? null : r1(sugar), sodium: sodium === null ? null : Math.round(sodium * 1000),
      servingG: servingG > 0 ? servingG : null,
      servingLabel: p.serving_size ? String(p.serving_size).trim() : '',
    };
  }

  async function getJson(url) {
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 12000);
    try {
      const res = await fetch(url, ctl ? { signal: ctl.signal } : undefined);
      if (!res.ok) return { error: true };
      return { json: await res.json() };
    } catch (e) {
      return { error: true };
    } finally {
      clearTimeout(timer);
    }
  }

  // busca en Open Food Facts por código → { found, ...parse }
  async function lookup(code) {
    const r = await getJson(`${API}${code}.json?fields=${FIELDS}`);
    if (r.error) return { found: false, error: true };
    const j = r.json;
    if (!j || j.status !== 1 || !j.product) return { found: false };
    const info = parse(j.product);
    return Object.assign({ found: true }, info);
  }

  // opts: { onFound(code, food) , onNew(code, info|null) }
  //  - onSaved(code, food): el código ya está en "Mis alimentos"
  //  - onProduct(code, info): lo encontró en internet (hay que revisar y guardar)
  //  - onMissing(code, reason): no apareció (se puede crear a mano)
  function open(opts) {
    let stream = null;
    let stopped = false;
    let busy = false;
    const body = Utils.el('div', { class: 'bc-body' });

    const stop = () => {
      stopped = true;
      if (stream) { try { stream.getTracks().forEach((t) => t.stop()); } catch (e) { /* nada */ } stream = null; }
    };

    const status = Utils.el('div', { class: 'small text-dim', style: 'text-align:center;margin:8px 0;' });

    async function handle(codeRaw) {
      const code = clean(codeRaw);
      if (code.length < 6 || busy) { if (code.length < 6) Utils.toast('El código debe tener al menos 6 números'); return; }
      busy = true;
      stop();
      const saved = findSaved(code);
      if (saved) { Modal.close(); opts.onSaved(code, saved); return; }
      status.textContent = '🔎 Buscando el producto…';
      const info = await lookup(code);
      Modal.close();
      if (info.found && !info.empty) opts.onProduct(code, info);
      else opts.onMissing(code, info.error ? 'offline' : info.found ? 'sin-datos' : 'no-existe', info);
    }

    // ---- cámara ----
    if (cameraOk()) {
      const video = Utils.el('video', { class: 'bc-video', playsinline: 'true', muted: 'true', autoplay: 'true' });
      video.muted = true;
      const frame = Utils.el('div', { class: 'bc-frame' }, [video, Utils.el('div', { class: 'bc-guide' })]);
      body.appendChild(frame);
      body.appendChild(status);
      status.textContent = 'Apunta al código de barras del empaque…';
      const detector = new window.BarcodeDetector({ formats: FORMATS });
      navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then((s) => {
        if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        video.srcObject = s;
        video.play().catch(() => {});
        const tick = async () => {
          if (stopped || busy) return;
          try {
            if (video.readyState >= 2) {
              const found = await detector.detect(video);
              if (found && found.length && found[0].rawValue) { handle(found[0].rawValue); return; }
            }
          } catch (e) { /* frame no listo */ }
          setTimeout(tick, 220);
        };
        tick();
      }).catch(() => {
        status.textContent = 'No pude usar la cámara (revisa el permiso). Puedes escribir el código a mano aquí abajo.';
        frame.remove();
      });
    } else {
      body.appendChild(Utils.el('div', { class: 'nut-hint', text: 'Tu navegador no puede leer códigos con la cámara. Escribe los números que aparecen debajo de las barras.' }));
      body.appendChild(status);
    }

    // ---- escribir el código ----
    const input = Utils.el('input', { type: 'text', inputmode: 'numeric', placeholder: 'o escribe el código (ej. 7501055300075)', maxlength: '20' });
    const go = Utils.el('button', { class: 'btn-primary btn-block', type: 'button', text: '🔎 Buscar este código' });
    go.addEventListener('click', () => handle(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handle(input.value); });
    body.appendChild(Utils.el('div', { class: 'field', style: 'margin-top:10px;' }, [input]));
    body.appendChild(go);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:10px;', text: 'Se consulta Open Food Facts (base de datos abierta) y solo se envía el número del código. Necesitas internet; los productos que guardes después se encuentran sin conexión. Revisa siempre los números contra tu empaque.' }));

    Modal.open('▮▮ Escanear código de barras', body, { onClose: stop });
  }

  return { open, lookup, cameraOk, parseProduct: parse };
})();
