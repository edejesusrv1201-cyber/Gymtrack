/* ============================================================
   labelScan.js — Lector de tablas nutricionales con la cámara.
   Todo ocurre en tu celular (OCR Tesseract.js incluido en la app):
   la foto no sale del teléfono. Lee calorías, proteína, carbos,
   grasas y el tamaño de la porción, y te deja revisar los números
   antes de guardar el alimento.
   ============================================================ */

const LabelScan = (() => {
  const OCR_DIR = 'js/lib/ocr/';

  // ---------------------------------------------------------------- lectura del texto
  const strip = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // números de una línea con su unidad: "3,5 g" -> {v:3.5, u:'g'}
  function numbersOf(line) {
    const out = [];
    const re = /(<)?\s*(\d+(?:[.,]\d+)?)\s*(kcal|cal|kj|mg|mcg|µg|ug|g|ml|%)?/g;
    let m;
    while ((m = re.exec(line))) {
      const v = parseFloat(m[2].replace(',', '.'));
      if (isNaN(v)) continue;
      out.push({ v: m[1] ? 0 : v, u: m[3] === 'cal' ? 'kcal' : (m[3] || '') });
    }
    return out;
  }

  // Interpreta el texto leído de una etiqueta. Devuelve valores listos para el formulario.
  function parse(rawText) {
    // errores típicos del OCR dentro de números: O -> 0, l/I -> 1
    let text = String(rawText || '').replace(/(\d)[oO](?=\s|\d|g\b)/g, '$10').replace(/\b[oO](\d)/g, '0$1');
    text = strip(text).replace(/ /g, ' ');
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const pick = (test, exclude) => lines.filter((l) => test.test(l) && !(exclude && exclude.test(l)));

    // --- porción ---
    let servingG = null;
    let servingLabel = '';
    const servLine = lines.find((l) => /tamano|porcion|racion|serving|portion/.test(l) && !/por envase|porciones por|servings per|contenido/.test(l) && /\d+(?:[.,]\d+)?\s*(g|ml)\b/.test(l));
    if (servLine) {
      const all = [...servLine.matchAll(/(\d+(?:[.,]\d+)?)\s*(g|ml)\b/g)];
      const last = all[all.length - 1]; // en "1 taza (240 ml)" interesa el dato entre paréntesis
      servingG = parseFloat(last[1].replace(',', '.'));
      const afterColon = servLine.includes(':') ? servLine.split(':').slice(1).join(':').trim() : '';
      const cleaned = afterColon || servLine.replace(/^.*?(tamano de (la )?porcion|porcion|racion|serving size|portion)[:\s]*/, '').trim();
      if (/[a-z]{3,}/.test(cleaned.replace(/\b(g|ml)\b/g, ''))) servingLabel = cleaned;
    }

    const has100 = /por\s*100\s*(g|ml)|100\s*(g|ml)/.test(text);
    const hasServ = /por\s*(porcion|racion|serving)|porcion|racion|serving/.test(text);

    // --- cada nutriente: lista de números ---
    const kcalLines = pick(/kcal|calori|energia|valor energetico/);
    let kcalNums = [];
    kcalLines.forEach((l) => {
      const ns = numbersOf(l);
      const withUnit = ns.filter((n) => n.u === 'kcal');
      if (withUnit.length) kcalNums = kcalNums.concat(withUnit.map((n) => n.v));
      else if (!/kj/.test(l)) kcalNums = kcalNums.concat(ns.filter((n) => n.u === '' && n.v > 0 && n.v < 1500).map((n) => n.v));
    });

    const gramsOf = (ls) => {
      for (const l of ls) {
        const ns = numbersOf(l).filter((n) => (n.u === 'g' || n.u === '') && n.v < 1000);
        if (ns.length) return ns.map((n) => n.v);
      }
      return [];
    };
    const fatNums = gramsOf(pick(/grasa\s*total|total\s*fat|lipidos|^grasas?\b|\bgrasas?\b/, /saturad|trans|mono|poli|colesterol|omega|de las cuales/));
    const carbNums = gramsOf(pick(/carbohidrato|hidratos? de carbono|glucidos|total carb/, /azucar|fibra|de los cuales|polioles/));
    const protNums = gramsOf(pick(/proteina|protein/));

    // --- columnas: ¿por porción, por 100 g o las dos? ---
    const colIdx = { serving: 0, per100: 0, two: false };
    const twoCols = kcalNums.length >= 2 && (fatNums.length >= 2 || carbNums.length >= 2 || protNums.length >= 2);
    if (twoCols) {
      colIdx.two = true;
      const [a, b] = kcalNums;
      let resolved = false;
      if (servingG) {
        const k = 100 / servingG;
        if (b > 0 && Math.abs(a * k - b) / b < 0.12) { colIdx.serving = 0; colIdx.per100 = 1; resolved = true; }
        else if (a > 0 && Math.abs(b * k - a) / a < 0.12) { colIdx.serving = 1; colIdx.per100 = 0; resolved = true; }
      }
      if (!resolved) {
        const p100 = text.search(/por\s*100|100\s*(g|ml)/);
        const pServ = text.search(/por\s*(porcion|racion|serving)/);
        const first100 = p100 >= 0 && (pServ < 0 || p100 < pServ);
        colIdx.per100 = first100 ? 0 : 1;
        colIdx.serving = first100 ? 1 : 0;
        if (!servingG && a !== b) { // el mayor suele ser el de 100 g
          colIdx.per100 = a > b ? 0 : 1;
          colIdx.serving = a > b ? 1 : 0;
        }
      }
    }

    const at = (arr, i) => (arr.length ? (arr[i] !== undefined ? arr[i] : arr[0]) : null);
    let basis; let kcal; let protein; let carbs; let fat;
    const notes = [];

    if (colIdx.two) {
      // se guarda por 100 g (permite anotar en gramos) y la porción como atajo
      basis = 'g';
      kcal = at(kcalNums, colIdx.per100); protein = at(protNums, colIdx.per100); carbs = at(carbNums, colIdx.per100); fat = at(fatNums, colIdx.per100);
      notes.push('La etiqueta tiene dos columnas: usé la de 100 g.');
    } else {
      kcal = kcalNums.length ? kcalNums[0] : null; protein = protNums.length ? protNums[0] : null; carbs = carbNums.length ? carbNums[0] : null; fat = fatNums.length ? fatNums[0] : null;
      if (has100 && !hasServ) basis = 'g';
      else if (servingG) {
        // valores por porción: se convierten a por 100 g
        const k = 100 / servingG;
        [kcal, protein, carbs, fat] = [kcal, protein, carbs, fat].map((v) => (v === null ? null : v * k));
        basis = 'g';
        notes.push(`Los valores eran por porción de ${servingG} g; los pasé a 100 g.`);
      } else basis = 's';
    }
    const r1 = (v) => (v === null || v === undefined ? null : Math.round(v * 10) / 10);
    kcal = r1(kcal); protein = r1(protein); carbs = r1(carbs); fat = r1(fat);

    // sin calorías en la etiqueta: se calculan con los macros
    if (kcal === null && (protein !== null || carbs !== null || fat !== null)) {
      kcal = Math.round((protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9);
      notes.push('No vi las calorías; las calculé con los macros.');
    }
    const found = { kcal: kcal !== null, protein: protein !== null, carbs: carbs !== null, fat: fat !== null };
    return {
      basis,
      kcal, protein, carbs, fat,
      portionG: servingG,
      servingLabel: servingG ? (servingLabel && servingLabel.length < 40 ? servingLabel : `1 porción (${servingG} g)`) : '',
      found,
      notes,
      ok: found.kcal && (found.protein || found.carbs || found.fat),
    };
  }

  // ---------------------------------------------------------------- imagen + OCR
  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No pude abrir la foto')); };
      img.src = url;
    });
  }

  // reduce/amplía a un tamaño cómodo y sube el contraste (blanco y negro suave)
  function preprocess(img) {
    const MAX = 2000; const MIN = 1400;
    let w = img.naturalWidth || img.width; let h = img.naturalHeight || img.height;
    const longest = Math.max(w, h);
    const scale = longest > MAX ? MAX / longest : longest < MIN ? Math.min(2, MIN / longest) : 1;
    w = Math.round(w * scale); h = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < px.length; i += 4) {
      const g = (px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114) | 0;
      px[i] = g; hist[g] += 1;
    }
    // estirar entre el 2 % y el 98 % de los tonos
    const total = w * h;
    let acc = 0; let lo = 0; let hi = 255;
    for (let i = 0; i < 256; i += 1) { acc += hist[i]; if (acc > total * 0.02) { lo = i; break; } }
    acc = 0;
    for (let i = 255; i >= 0; i -= 1) { acc += hist[i]; if (acc > total * 0.02) { hi = i; break; } }
    const range = Math.max(40, hi - lo);
    for (let i = 0; i < px.length; i += 4) {
      let g = ((px[i] - lo) / range) * 255;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    ctx.putImageData(data, 0, 0);
    return canvas;
  }

  let libPromise = null;
  function loadLib() {
    if (window.Tesseract) return Promise.resolve();
    if (!libPromise) {
      libPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = `${OCR_DIR}tesseract.min.js?v=1`;
        s.onload = () => resolve();
        s.onerror = () => { libPromise = null; reject(new Error('No se pudo cargar el lector de texto')); };
        document.head.appendChild(s);
      });
    }
    return libPromise;
  }

  async function recognize(canvas, onProgress) {
    await loadLib();
    const abs = (p) => new URL(p, location.href).href;
    const worker = await window.Tesseract.createWorker('spa', 1, {
      workerPath: abs(`${OCR_DIR}worker.min.js`),
      corePath: abs(OCR_DIR),
      langPath: abs(OCR_DIR),
      gzip: true,
      workerBlobURL: false,
      logger: (m) => { if (onProgress) onProgress(m); },
    });
    try {
      await worker.setParameters({ tessedit_pageseg_mode: '6', preserve_interword_spaces: '1' });
      const { data } = await worker.recognize(canvas);
      return data.text || '';
    } finally {
      worker.terminate();
    }
  }

  // ---------------------------------------------------------------- pantalla
  // opts: { onResult(parsed, rawText, thumbDataUrl) }
  function open(opts = {}) {
    const body = Utils.el('div');
    body.appendChild(Utils.el('p', { class: 'small', text: 'Toma una foto de la tabla nutricional (o elige una de tu galería). Que se vea completa, derecha y bien iluminada. La foto se procesa en tu celular y no se envía a ningún sitio.' }));

    const status = Utils.el('div', { class: 'scan-status hidden' });
    const bar = Utils.el('div', { class: 'macro-bar' }, [Utils.el('div', { class: 'macro-bar-fill', style: 'width:0%;background:var(--accent-grad);' })]);
    const statusText = Utils.el('div', { class: 'small text-dim', style: 'margin-bottom:6px;text-align:center;' });
    status.appendChild(statusText);
    status.appendChild(bar);

    const preview = Utils.el('img', { class: 'scan-preview hidden', alt: 'Foto de la etiqueta' });
    const controls = Utils.el('div', { class: 'scan-controls' });

    const mkInput = (capture) => {
      const inp = Utils.el('input', { type: 'file', accept: 'image/*', class: 'hidden' });
      if (capture) inp.setAttribute('capture', 'environment');
      inp.addEventListener('change', () => { if (inp.files && inp.files[0]) run(inp.files[0]); inp.value = ''; });
      return inp;
    };
    const camIn = mkInput(true);
    const galIn = mkInput(false);
    const camBtn = Utils.el('button', { class: 'btn-primary', type: 'button', text: '📷 Tomar foto' });
    camBtn.addEventListener('click', () => camIn.click());
    const galBtn = Utils.el('button', { class: 'btn-secondary', type: 'button', text: '🖼️ Elegir foto' });
    galBtn.addEventListener('click', () => galIn.click());
    controls.appendChild(camBtn);
    controls.appendChild(galBtn);
    controls.appendChild(camIn);
    controls.appendChild(galIn);

    body.appendChild(controls);
    body.appendChild(preview);
    body.appendChild(status);
    body.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:12px;', text: 'La primera vez el lector tarda unos segundos en prepararse. Siempre podrás revisar y corregir los números antes de guardar.' }));

    async function run(file) {
      controls.classList.add('hidden');
      status.classList.remove('hidden');
      statusText.textContent = 'Preparando la foto…';
      try {
        const img = await loadImage(file);
        const canvas = preprocess(img);
        preview.src = canvas.toDataURL('image/jpeg', 0.6);
        preview.classList.remove('hidden');
        statusText.textContent = 'Cargando el lector (solo la primera vez)…';
        const text = await recognize(canvas, (m) => {
          if (m.status === 'recognizing text') {
            statusText.textContent = `Leyendo la etiqueta… ${Math.round((m.progress || 0) * 100)}%`;
            bar.firstChild.style.width = `${Math.round((m.progress || 0) * 100)}%`;
          } else if (m.status && /loading|initializ/.test(m.status)) {
            statusText.textContent = 'Preparando el lector…';
          }
        });
        const parsed = parse(text);
        const thumb = (() => { try { const c = document.createElement('canvas'); const k = 360 / Math.max(canvas.width, canvas.height); c.width = canvas.width * k; c.height = canvas.height * k; c.getContext('2d').drawImage(canvas, 0, 0, c.width, c.height); return c.toDataURL('image/jpeg', 0.6); } catch (e) { return ''; } })();
        Modal.close();
        if (opts.onResult) opts.onResult(parsed, text, thumb);
      } catch (e) {
        statusText.textContent = `No pude leer la foto: ${e.message || e}. Revisa tu conexión la primera vez o intenta otra foto.`;
        controls.classList.remove('hidden');
      }
    }

    Modal.open('📷 Escanear tabla nutricional', body);
  }

  return { parse, open, preprocess, recognize };
})();
