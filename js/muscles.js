/* ============================================================
   muscles.js — Mapa corporal
   · Reparte las series de cada ejercicio entre músculos concretos
     (principal = 1 serie, secundario = ½ serie).
   · Dibuja un cuerpo (frente y espalda) coloreado por series de la
     semana o por recuperación. Se puede tocar cada músculo.
   ============================================================ */

const Muscles = (() => {
  // id, nombre, grupo de fuerza al que pertenece
  const LIST = [
    { id: 'pecho', name: 'Pecho', group: 'pecho' },
    { id: 'dorsal', name: 'Dorsal (espalda ancha)', group: 'espalda' },
    { id: 'trapecio', name: 'Trapecio', group: 'espalda' },
    { id: 'lumbar', name: 'Lumbar', group: 'espalda' },
    { id: 'hombro_ant', name: 'Hombro frontal', group: 'hombro' },
    { id: 'hombro_lat', name: 'Hombro lateral', group: 'hombro' },
    { id: 'hombro_post', name: 'Hombro posterior', group: 'hombro' },
    { id: 'biceps', name: 'Bíceps', group: 'brazo' },
    { id: 'triceps', name: 'Tríceps', group: 'brazo' },
    { id: 'antebrazo', name: 'Antebrazo', group: 'brazo' },
    { id: 'abdomen', name: 'Abdomen', group: 'core' },
    { id: 'oblicuos', name: 'Oblicuos', group: 'core' },
    { id: 'cuadriceps', name: 'Cuádriceps', group: 'pierna' },
    { id: 'isquios', name: 'Isquiotibiales', group: 'pierna' },
    { id: 'gluteo', name: 'Glúteos', group: 'pierna' },
    { id: 'aductores', name: 'Aductores', group: 'pierna' },
    { id: 'gemelos', name: 'Gemelos', group: 'pierna' },
  ];
  const BY_ID = {};
  LIST.forEach((m) => { BY_ID[m.id] = m; });

  const STATUS_COLOR = { low: '#ffc247', ok: '#35d49a', high: '#5b8cff' };
  const REC_COLOR = ['#ff5c6c', '#ff9f43', '#ffd23f', '#35d49a'];

  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------------------------------------------------------------- qué músculos trabaja un ejercicio
  // [expresión, principales, secundarios] — gana la primera que coincide
  const RULES = [
    [/hip.?thrust|puente de gluteo|patada de gluteo|glute/, ['gluteo'], ['isquios']],
    [/abductor/, ['gluteo'], []],
    [/aductor/, ['aductores'], []],
    [/talones|gemelo|pantorrilla/, ['gemelos'], []],
    [/extension de (cuadriceps|rodilla|pierna)|sillon de cuadriceps/, ['cuadriceps'], []],
    [/femoral|curl de pierna|curl (nordico|nordic)/, ['isquios'], ['gemelos']],
    [/rumano|stiff|buenos dias/, ['isquios', 'gluteo'], ['lumbar']],
    [/peso muerto/, ['gluteo', 'isquios', 'lumbar'], ['trapecio', 'cuadriceps', 'antebrazo']],
    [/bulgara|zancada|desplante|step.?up|estocada/, ['cuadriceps', 'gluteo'], ['isquios', 'aductores']],
    [/prensa|hack/, ['cuadriceps', 'gluteo'], ['aductores']],
    [/sentadilla|goblet|squat|pendular/, ['cuadriceps', 'gluteo'], ['aductores', 'isquios']],
    [/face.?pull/, ['hombro_post'], ['trapecio']],
    [/pajaros|posterior|inverso|reverse/, ['hombro_post'], ['trapecio']],
    [/elevacion(es)? lateral|lateral(es)? en polea/, ['hombro_lat'], []],
    [/elevacion(es)? frontal/, ['hombro_ant'], []],
    [/remo al menton/, ['hombro_lat', 'trapecio'], []],
    [/militar|arnold|press.*hombro|hombro.*press|press de hombro/, ['hombro_ant', 'hombro_lat'], ['triceps']],
    [/encogimiento|trapecio|shrug/, ['trapecio'], []],
    [/hiperextension|lumbar/, ['lumbar'], ['gluteo', 'isquios']],
    [/martillo/, ['biceps', 'antebrazo'], []],
    [/curl/, ['biceps'], ['antebrazo']],
    [/franc|triceps|press cerrado|patada de tri|skull/, ['triceps'], []],
    [/dominada|jalon|lat pull/, ['dorsal'], ['biceps', 'hombro_post']],
    [/pull.?over|pullover/, ['dorsal'], ['pecho', 'triceps']],
    [/remo/, ['dorsal', 'trapecio'], ['biceps', 'hombro_post']],
    [/plancha lateral|giros|rusos|lenador|oblicu/, ['oblicuos'], ['abdomen']],
    [/plancha|abdominal|crunch|elevacion de (piernas|rodillas)|rueda|encogimiento de abdomen/, ['abdomen'], ['oblicuos']],
    [/aperturas|peck|cruce|apertura|crossover|pec.?deck/, ['pecho'], ['hombro_ant']],
    [/fondos/, ['pecho', 'triceps'], ['hombro_ant']],
    [/press|pecho|flexion|banca/, ['pecho'], ['hombro_ant', 'triceps']],
  ];
  const GROUP_FALLBACK = {
    pecho: [['pecho'], ['hombro_ant', 'triceps']],
    espalda: [['dorsal', 'trapecio'], ['biceps']],
    pierna: [['cuadriceps', 'gluteo', 'isquios'], []],
    hombro: [['hombro_ant', 'hombro_lat'], ['hombro_post']],
    brazo: [['biceps', 'triceps'], []],
    core: [['abdomen'], ['oblicuos']],
  };

  const cache = {};
  // { p: [ids], s: [ids] } — vacío para cardio, movilidad u otros
  function mapOf(ex) {
    if (!ex) return { p: [], s: [] };
    const group = ex.group || 'otro';
    if (group === 'cardio' || group === 'movilidad' || group === 'otro') return { p: [], s: [] };
    const key = `${group}|${ex.name}`;
    if (cache[key]) return cache[key];
    const n = norm(ex.name);
    let res = null;
    for (const [re, p, s] of RULES) {
      if (!re.test(n)) continue;
      // "fondos" / "pull over" dependen del grupo con el que los guardaste
      if (/fondos/.test(n) && group === 'brazo') { res = { p: ['triceps'], s: ['hombro_ant', 'pecho'] }; break; }
      if (/pull.?over|pullover/.test(n) && group === 'pecho') { res = { p: ['pecho'], s: ['dorsal'] }; break; }
      res = { p: p.slice(), s: s.slice() };
      break;
    }
    if (!res) {
      const f = GROUP_FALLBACK[group];
      res = f ? { p: f[0].slice(), s: f[1].slice() } : { p: [], s: [] };
    }
    cache[key] = res;
    return res;
  }

  // ---------------------------------------------------------------- cálculo
  // series por músculo entre dos fechas: { id: { sets, days:{iso:sets}, last, exs:{nombre:series} } }
  function setsBetween(startIso, endIso) {
    const wl = DB.getWorkoutLog();
    const byId = {};
    DB.getExercises().forEach((e) => { byId[e.id] = e; });
    const out = {};
    LIST.forEach((m) => { out[m.id] = { sets: 0, days: {}, last: null, exs: {} }; });
    Object.keys(wl).forEach((d) => {
      if (d < startIso || d > endIso) return;
      (wl[d].exercises || []).forEach((entry) => {
        const ex = byId[entry.exerciseId];
        const mp = mapOf(ex);
        if (!mp.p.length && !mp.s.length) return;
        const n = (entry.sets || []).filter((s) => !Metrics.isWarmup(s)).length;
        if (!n) return;
        const add = (id, w) => {
          const m = out[id];
          if (!m) return;
          m.sets += n * w;
          m.days[d] = (m.days[d] || 0) + n * w;
          m.exs[ex.name] = (m.exs[ex.name] || 0) + n * w;
        };
        mp.p.forEach((id) => add(id, 1));
        mp.s.forEach((id) => add(id, 0.5));
      });
    });
    LIST.forEach((m) => {
      const days = Object.keys(out[m.id].days).filter((d) => out[m.id].days[d] >= 1).sort();
      out[m.id].last = days.length ? days[days.length - 1] : null;
    });
    return out;
  }

  // meta por músculo: ≈ 60 % de la meta del grupo (un grupo reparte sus series entre varios músculos)
  function goal() {
    const g = Metrics.weeklyGoal();
    const min = Math.max(3, Math.round(g.min * 0.6));
    const max = Math.max(min + 1, Math.round(g.max * 0.6));
    return { min, max };
  }
  const fmtN = (n) => (Math.round(n * 2) / 2).toString().replace('.5', '½').replace(/^0½$/, '½');
  const status = (n, g) => (n < g.min ? 'low' : n > g.max ? 'high' : 'ok');

  function daysSince(iso) {
    if (!iso) return null;
    const a = Utils.parseISO(iso);
    const b = Utils.parseISO(Utils.todayISO());
    return Math.round((b - a) / 86400000);
  }
  const agoText = (d) => (d === null ? 'sin registros recientes' : d === 0 ? 'hoy' : d === 1 ? 'ayer' : `hace ${d} días`);

  // ---------------------------------------------------------------- dibujo
  // Se dibuja la mitad derecha; la izquierda es su espejo.
  const W = 160;
  const BASE = {
    front: [
      'M80 46 Q97 48 109 58 L112 74 Q110 102 106 128 Q109 148 107 166 L80 174 Z', // torso
      'M112 60 Q127 58 131 73 L130 108 L117 108 L112 78 Z', // brazo
      'M117 110 L130 110 Q135 132 138 156 L127 158 Q121 132 117 110 Z', // antebrazo
      'M83 170 L107 166 Q113 198 109 240 L87 242 Q82 208 83 170 Z', // muslo
      'M87 246 L109 244 Q111 282 105 334 L91 334 Q85 292 87 246 Z', // pierna
    ],
    back: [
      'M80 46 Q97 48 109 58 L112 74 Q110 102 106 128 Q109 148 107 166 L80 174 Z',
      'M112 60 Q127 58 131 73 L130 108 L117 108 L112 78 Z',
      'M117 110 L130 110 Q135 132 138 156 L127 158 Q121 132 117 110 Z',
      'M83 170 L107 166 Q113 198 109 240 L87 242 Q82 208 83 170 Z',
      'M87 246 L109 244 Q111 282 105 334 L91 334 Q85 292 87 246 Z',
    ],
  };
  // mitad derecha de cada músculo
  const SHAPES = {
    front: {
      trapecio: 'M81 44 Q95 45 105 54 L99 59 Q90 52 81 50 Z',
      pecho: 'M82 56 Q98 54 109 63 Q112 76 108 84 Q96 91 82 85 Z',
      hombro_ant: 'M108 58 Q119 57 122 67 Q120 79 113 84 Q109 72 108 58 Z',
      hombro_lat: 'M122 66 Q129 71 129 84 Q126 92 119 91 Q122 80 122 66 Z',
      biceps: 'M114 94 Q121 90 127 95 L126 110 Q120 112 115 108 Z',
      antebrazo: 'M118 114 L129 114 Q133 132 135 152 L128 154 Q122 134 118 114 Z',
      abdomen: 'M82 92 L97 92 Q99 124 96 148 Q90 156 82 156 Z',
      oblicuos: 'M99 93 L107 98 Q107 128 103 148 L98 130 Z',
      aductores: 'M83 176 L91 178 Q93 204 91 226 L84 222 Q81 200 83 176 Z',
      cuadriceps: 'M92 176 L106 170 Q111 200 108 234 L93 234 Q92 206 92 176 Z',
    },
    back: {
      trapecio: 'M81 44 Q97 47 109 59 L101 80 Q93 98 81 108 Z',
      hombro_post: 'M109 59 Q120 58 123 70 Q121 82 114 85 Q109 74 109 62 Z',
      hombro_lat: 'M123 68 Q129 72 129 84 Q126 92 119 91 Q122 80 123 68 Z',
      triceps: 'M114 94 Q121 90 127 95 L126 110 Q120 112 115 108 Z',
      antebrazo: 'M118 114 L129 114 Q133 132 135 152 L128 154 Q122 134 118 114 Z',
      dorsal: 'M102 82 Q111 88 109 112 Q105 126 96 131 Q90 120 85 110 Q95 102 102 82 Z',
      lumbar: 'M81 128 L95 130 Q98 146 94 160 L81 162 Z',
      gluteo: 'M82 162 Q100 157 108 169 Q111 187 98 194 Q85 194 82 182 Z',
      isquios: 'M85 198 L106 194 Q111 216 108 238 L91 240 Q85 224 85 198 Z',
      gemelos: 'M89 250 Q101 246 108 252 Q108 282 100 298 Q92 292 89 272 Z',
    },
  };

  const HEAD = '<circle cx="80" cy="24" r="14"/><path d="M73 36 L87 36 L88 47 L72 47 Z"/>';
  const HAND = { front: '<ellipse cx="133" cy="166" rx="6" ry="9" transform="rotate(-8 133 166)"/>', back: '<ellipse cx="133" cy="166" rx="6" ry="9" transform="rotate(-8 133 166)"/>' };
  const FOOT = '<ellipse cx="97" cy="340" rx="11" ry="6"/>';

  // fills: { id: { color, opacity } }
  function bodySvg(fills, opts = {}) {
    const mirror = `transform="translate(${W} 0) scale(-1 1)"`;
    const view = (side) => {
      const base = BASE[side].map((d) => `<path d="${d}"/>`).join('') + HAND[side] + FOOT;
      const baseBoth = `<g class="bm-base">${HEAD}<g>${base}</g><g ${mirror}>${base}</g></g>`;
      const mus = Object.keys(SHAPES[side]).map((id) => {
        const d = SHAPES[side][id];
        const f = fills[id] || {};
        const style = f.color ? ` style="fill:${f.color};fill-opacity:${f.opacity === undefined ? 0.9 : f.opacity}"` : '';
        return `<g class="bm-m${f.color ? ' on' : ''}" data-m="${id}"${style}><path d="${d}"/><path d="${d}" ${mirror}/></g>`;
      }).join('');
      const lines = side === 'front'
        ? '<g class="bm-lines"><path d="M80 94 L80 154"/><path d="M82 106 L96 106 M82 119 L97 119 M82 132 L97 132"/><path d="M78 106 L64 106 M78 119 L63 119 M78 132 L63 132"/></g>'
        : '<g class="bm-lines"><path d="M80 48 L80 160"/></g>';
      return `<g transform="translate(${side === 'front' ? 0 : 170} 0)">${baseBoth}${mus}${lines}</g>`;
    };
    const labels = '<text class="bm-cap" x="80" y="362" text-anchor="middle">FRENTE</text><text class="bm-cap" x="250" y="362" text-anchor="middle">ESPALDA</text>';
    return `<svg class="bodymap${opts.mini ? ' mini' : ''}" viewBox="0 0 330 ${opts.mini ? 352 : 368}" role="img" aria-label="Mapa muscular">${view('front')}${view('back')}${opts.mini ? '' : labels}</svg>`;
  }

  // ---------------------------------------------------------------- colores según el modo
  function seriesFills(data, g, days) {
    const fills = {};
    LIST.forEach((m) => {
      const n = data[m.id].sets / (days || 1);
      if (n <= 0) return;
      const st = status(n, g);
      const op = st === 'low' ? 0.38 + 0.5 * Math.min(1, n / g.min) : 0.95;
      fills[m.id] = { color: STATUS_COLOR[st], opacity: op };
    });
    return fills;
  }
  function recoveryFills(data30) {
    const fills = {};
    LIST.forEach((m) => {
      const d = daysSince(data30[m.id].last);
      if (d === null) return;
      fills[m.id] = { color: REC_COLOR[Math.min(3, d)], opacity: 0.92 };
    });
    return fills;
  }
  // mapa chiquito con lo trabajado en un día (para el resumen del entreno)
  function dayFills(iso) {
    const d = setsBetween(iso, iso);
    const fills = {};
    LIST.forEach((m) => {
      const n = d[m.id].sets;
      if (n <= 0) return;
      fills[m.id] = { color: 'rgb(var(--accent-rgb))', opacity: Math.min(0.95, 0.35 + n * 0.14) };
    });
    return { fills, data: d };
  }
  function dayMini(iso) {
    const { fills, data } = dayFills(iso);
    const names = LIST.filter((m) => data[m.id].sets >= 1).sort((a, b) => data[b.id].sets - data[a.id].sets).map((m) => m.name.replace(/ \(.*\)/, ''));
    if (!names.length) return null;
    const wrap = Utils.el('div', { class: 'bm-sum' });
    const host = Utils.el('div', { class: 'bm-sum-map' });
    host.innerHTML = bodySvg(fills, { mini: true });
    wrap.appendChild(host);
    wrap.appendChild(Utils.el('div', { class: 'bm-sum-txt' }, [
      Utils.el('div', { class: 'eyebrow', text: 'Músculos de hoy' }),
      Utils.el('div', { class: 'bm-sum-list', text: names.slice(0, 7).join(' · ') }),
    ]));
    return wrap;
  }

  // ---------------------------------------------------------------- tarjeta interactiva
  // opts: { compact } — compact oculta el selector de período
  let mode = 'series';   // 'series' | 'recuperacion'
  let period = 'semana'; // 'semana' | '4sem'
  let selected = null;

  function suggestionsFor(id) {
    const mine = DB.getExercises().filter((e) => mapOf(e).p.includes(id)).map((e) => e.name);
    const lib = (ExerciseUI.LIB || []).filter((l) => mapOf({ name: l[0], group: l[1] }).p.includes(id)).map((l) => l[0]);
    const out = mine.slice(0, 3);
    lib.forEach((n) => { if (out.length < 4 && !out.includes(n)) out.push(n); });
    return { out, hasMine: mine.length > 0 };
  }

  function card(opts = {}) {
    const wrap = Utils.el('div', { class: 'card bm-card' });
    const head = Utils.el('div', { class: 'card-title-row' }, [
      Utils.el('h3', { text: '🧍 Mapa muscular' }),
      Utils.el('span', { class: 'eyebrow', text: 'toca un músculo' }),
    ]);
    wrap.appendChild(head);
    const controls = Utils.el('div');
    const mapHost = Utils.el('div', { class: 'bm-host' });
    const legend = Utils.el('div', { class: 'legend bm-legend' });
    const detail = Utils.el('div', { class: 'bm-detail' });
    const lacking = Utils.el('div');
    [controls, mapHost, legend, detail, lacking].forEach((n) => wrap.appendChild(n));

    let firstDraw = true;
    function draw() {
      const g = goal();
      const wk = Metrics.weekRange(0);
      const from4 = Metrics.weekRange(-3).start;
      const cur = setsBetween(wk.start, wk.end);
      const four = setsBetween(from4, wk.end);
      const rec = setsBetween(Utils.toISODate(new Date(Date.now() - 20 * 86400000)), Utils.todayISO());

      // controles
      controls.innerHTML = '';
      controls.appendChild(Utils.segmented(
        [{ key: 'series', label: 'Series' }, { key: 'recuperacion', label: 'Recuperación' }],
        mode, (k) => { mode = k; firstDraw = true; draw(); }, true,
      ));
      if (mode === 'series') {
        controls.appendChild(Utils.el('div', { style: 'height:6px' }));
        controls.appendChild(Utils.segmented(
          [{ key: 'semana', label: 'Esta semana' }, { key: '4sem', label: '4 semanas (promedio)' }],
          period, (k) => { period = k; firstDraw = true; draw(); }, true,
        ));
      }

      const data = mode === 'recuperacion' ? rec : (period === 'semana' ? cur : four);
      const days = mode === 'series' && period === '4sem' ? 4 : 1;
      const fills = mode === 'recuperacion' ? recoveryFills(rec) : seriesFills(data, g, days);
      mapHost.classList.toggle('fresh', firstDraw);
      firstDraw = false;
      mapHost.innerHTML = bodySvg(fills);
      mapHost.querySelectorAll('.bm-m').forEach((el) => {
        if (selected === el.dataset.m) el.classList.add('sel');
        el.addEventListener('click', () => { selected = selected === el.dataset.m ? null : el.dataset.m; draw(); });
      });

      // leyenda
      legend.innerHTML = '';
      const item = (color, text) => Utils.el('span', {}, [Utils.el('i', { style: `background:${color}` }), text]);
      if (mode === 'recuperacion') {
        [[REC_COLOR[0], 'hoy'], [REC_COLOR[1], 'ayer'], [REC_COLOR[2], 'hace 2 días'], [REC_COLOR[3], '3+ días: listo']].forEach(([c, t]) => legend.appendChild(item(c, t)));
      } else {
        legend.appendChild(item(STATUS_COLOR.low, `menos de ${g.min}`));
        legend.appendChild(item(STATUS_COLOR.ok, `${g.min}–${g.max} (meta)`));
        legend.appendChild(item(STATUS_COLOR.high, `más de ${g.max}`));
      }

      // detalle del músculo tocado
      detail.innerHTML = '';
      if (selected && BY_ID[selected]) {
        const m = BY_ID[selected];
        const nShown = data[selected].sets / days;
        const st = status(nShown, g);
        const last = daysSince((mode === 'recuperacion' ? rec : four)[selected].last);
        const box = Utils.el('div', { class: 'bm-card-sel' });
        box.appendChild(Utils.el('div', { class: 'flex-between' }, [
          Utils.el('b', { text: m.name }),
          mode === 'series'
            ? Utils.el('span', { class: 'bm-badge', style: `background:${STATUS_COLOR[st]}22;color:${STATUS_COLOR[st]}`, text: `${fmtN(Math.round(nShown * 2) / 2)} series${days > 1 ? '/sem' : ''}` })
            : Utils.el('span', { class: 'bm-badge', style: `background:${REC_COLOR[Math.min(3, last === null ? 3 : last)]}22;color:${REC_COLOR[Math.min(3, last === null ? 3 : last)]}`, text: last === null ? 'descansado' : agoText(last) }),
        ]));
        box.appendChild(Utils.el('div', { class: 'small text-dim', style: 'margin-top:4px;', text: `Último trabajo: ${agoText(daysSince(four[selected].last))} · meta semanal ${g.min}–${g.max}` }));
        const exs = Object.keys(data[selected].exs).sort((a, b) => data[selected].exs[b] - data[selected].exs[a]);
        if (exs.length) {
          box.appendChild(Utils.el('div', { class: 'small', style: 'margin-top:6px;', text: `Con: ${exs.slice(0, 5).map((n) => `${n} (${fmtN(Math.round(data[selected].exs[n] * 2) / 2)})`).join(' · ')}` }));
        } else {
          const sg = suggestionsFor(selected);
          box.appendChild(Utils.el('div', { class: 'small', style: 'margin-top:6px;', text: `${sg.hasMine ? 'Tus ejercicios para este músculo' : 'Ideas de ejercicios'}: ${sg.out.join(' · ') || '—'}` }));
        }
        detail.appendChild(box);
      } else {
        detail.appendChild(Utils.el('div', { class: 'small text-dim', style: 'text-align:center;margin-top:8px;', text: 'Toca un músculo para ver los detalles.' }));
      }

      // lo más descuidado
      lacking.innerHTML = '';
      if (mode === 'series') {
        const low = LIST.map((m) => ({ m, n: data[m.id].sets / days })).filter((x) => x.n < g.min).sort((a, b) => a.n - b.n).slice(0, 5);
        const total = Object.keys(data).reduce((s, k) => s + data[k].sets, 0);
        if (total > 0 && low.length) {
          lacking.appendChild(Utils.el('div', { class: 'eyebrow', style: 'margin:14px 0 6px;', text: 'Te falta trabajar' }));
          const chips = Utils.el('div', { class: 'rt-chips' });
          low.forEach((x) => {
            const c = Utils.el('button', { type: 'button', class: 'rt-chip', style: `--gc:${STATUS_COLOR.low}`, text: `${x.m.name.replace(/ \(.*\)/, '')} ${fmtN(Math.round(x.n * 2) / 2)}` });
            c.addEventListener('click', () => { selected = x.m.id; draw(); });
            chips.appendChild(c);
          });
          lacking.appendChild(chips);
        } else if (total > 0) {
          lacking.appendChild(Utils.el('div', { class: 'nut-hint', style: 'margin-top:12px;', text: '✅ Todos los músculos están dentro de la meta.' }));
        }
      } else {
        const ready = LIST.filter((m) => { const d = daysSince(rec[m.id].last); return d === null || d >= 3; }).map((m) => m.name.replace(/ \(.*\)/, ''));
        const rest = LIST.filter((m) => { const d = daysSince(rec[m.id].last); return d !== null && d < 2; }).map((m) => m.name.replace(/ \(.*\)/, ''));
        if (rest.length) lacking.appendChild(Utils.el('p', { class: 'small', style: 'margin-top:12px;', text: `😴 Descansando: ${rest.join(', ')}.` }));
        if (ready.length) lacking.appendChild(Utils.el('p', { class: 'small', style: 'margin-top:6px;', text: `✅ Listos para entrenar: ${ready.join(', ')}.` }));
        lacking.appendChild(Utils.el('p', { class: 'small text-dim', style: 'margin-top:6px;', text: 'La recuperación se calcula por los días desde que trabajaste cada músculo (≈48–72 h es lo habitual).' }));
      }
    }
    draw();
    return wrap;
  }

  // vista compacta para Hoy: cuerpo en recuperación + resumen en una línea
  function homeCard() {
    const rec = setsBetween(Utils.toISODate(new Date(Date.now() - 20 * 86400000)), Utils.todayISO());
    const total = Object.keys(rec).reduce((s, k) => s + rec[k].sets, 0);
    if (total <= 0) return null;
    const c = Utils.el('button', { type: 'button', class: 'card bm-home' });
    const host = Utils.el('div', { class: 'bm-home-map' });
    host.innerHTML = bodySvg(recoveryFills(rec), { mini: true });
    const rest = LIST.filter((m) => { const d = daysSince(rec[m.id].last); return d !== null && d < 2; }).map((m) => m.name.replace(/ \(.*\)/, ''));
    const ready = LIST.filter((m) => { const d = daysSince(rec[m.id].last); return d === null || d >= 3; }).map((m) => m.name.replace(/ \(.*\)/, ''));
    const txt = Utils.el('div', { class: 'bm-home-txt' }, [
      Utils.el('div', { class: 'eyebrow', text: 'Estado muscular' }),
      Utils.el('div', { class: 'bm-home-line', text: rest.length ? `😴 Descansando: ${rest.slice(0, 4).join(', ')}${rest.length > 4 ? '…' : ''}` : '😎 Todo recuperado' }),
      Utils.el('div', { class: 'bm-home-line ok', text: ready.length ? `✅ Listos: ${ready.slice(0, 4).join(', ')}${ready.length > 4 ? '…' : ''}` : '' }),
      Utils.el('div', { class: 'small text-dim', style: 'margin-top:4px;', text: 'Toca para ver el mapa completo →' }),
    ]);
    c.appendChild(host);
    c.appendChild(txt);
    c.addEventListener('click', () => App.navigate('progreso', { section: 'entreno' }));
    return c;
  }

  return { LIST, mapOf, setsBetween, goal, card, homeCard, dayMini, bodySvg };
})();
