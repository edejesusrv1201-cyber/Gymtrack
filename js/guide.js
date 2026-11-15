/* ============================================================
   guide.js — Guía de ejercicios para principiantes
   · Muñeco animado (SVG) que muestra el movimiento.
   · Pasos, consejos y errores comunes.
   · «Modo principiante» (Más → Tu perfil): la primera vez que abres
     un ejercicio te lo muestra solo.
   Los dibujos son una referencia del movimiento: empieza siempre con
   poco peso y, si puedes, que alguien revise tu técnica.
   ============================================================ */

const Guide = (() => {
  const D = Math.PI / 180;
  const v = (a, l) => [Math.cos(a * D) * l, Math.sin(a * D) * l];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const LEN0 = { t: 28, l: 22, a: 14 };
  let LEN = LEN0;
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // ---------------------------------------------------------------- figura
  function ik(H, F, bend) {
    const l = LEN.l;
    let dx = F[0] - H[0]; let dy = F[1] - H[1];
    const d = Math.min(Math.hypot(dx, dy), 2 * l - 0.01);
    const a = Math.atan2(dy, dx);
    const b = Math.acos(d / (2 * l));
    const foot = [H[0] + Math.cos(a) * d, H[1] + Math.sin(a) * d];
    const c1 = [H[0] + l * Math.cos(a + b), H[1] + l * Math.sin(a + b)];
    const c2 = [H[0] + l * Math.cos(a - b), H[1] + l * Math.sin(a - b)];
    const knee = bend === 'up' ? (c1[1] < c2[1] ? c1 : c2) : (c1[0] > c2[0] ? c1 : c2);
    return { knee, foot };
  }

  function solve(spec, anchor, ground, sc) {
    LEN = { t: LEN0.t * (sc || 1), l: LEN0.l * (sc || 1), a: LEN0.a * (sc || 1) };
    let H; let K; let A; let K2 = null; let A2 = null;
    if (spec.feet) {
      H = spec.H.slice();
      const r1 = ik(H, spec.feet[0], spec.bend || 'fwd'); K = r1.knee; A = r1.foot;
      if (spec.feet[1]) { const r2 = ik(H, spec.feet[1], spec.bend || 'fwd'); K2 = r2.knee; A2 = r2.foot; }
    } else {
      H = [0, 0];
      K = add(H, v(spec.th, LEN.l)); A = add(K, v(spec.sh, LEN.l));
      if (spec.th2 !== undefined) { K2 = add(H, v(spec.th2, LEN.l)); A2 = add(K2, v(spec.sh2, LEN.l)); }
    }
    let S = spec.S ? spec.S.slice() : add(H, v(spec.t, LEN.t));
    const ang = Math.atan2(S[1] - H[1], S[0] - H[0]) / D;
    if (spec.sd) S = [S[0], S[1] - spec.sd];
    const E = add(S, v(spec.ua, LEN.a));
    const W = add(E, v(spec.fa, LEN.a));
    const C = add(S, v(ang + (spec.head || 0), 9 * (sc || 1)));
    const pts = { H, K, A, K2, A2, S, E, W, C };
    if (!spec.feet && anchor) {
      const ref = anchor.type === 'wrist' ? W : anchor.type === 'hip' ? H : A;
      const dx = anchor.x - ref[0]; const dy = anchor.y - ref[1];
      Object.keys(pts).forEach((k) => { if (pts[k]) pts[k] = [pts[k][0] + dx, pts[k][1] + dy]; });
    }
    if (spec.lift) Object.keys(pts).forEach((k) => { if (pts[k]) pts[k] = [pts[k][0], pts[k][1] - spec.lift]; });
    pts.toe = [pts.A[0] + 7, spec.toeGround && ground ? ground : pts.A[1]];
    return pts;
  }

  const lerp = (a, b, t) => a + (b - a) * t;
  function mix(A, B, t) {
    const o = {};
    Object.keys(A).forEach((k) => {
      const a = A[k]; const b = B[k] === undefined ? a : B[k];
      if (Array.isArray(a)) {
        o[k] = Array.isArray(a[0]) ? a.map((p, i) => [lerp(p[0], b[i][0], t), lerp(p[1], b[i][1], t)]) : [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];
      } else if (typeof a === 'number') o[k] = lerp(a, b, t);
      else o[k] = a;
    });
    return o;
  }
  const ease = (t) => t * t * (3 - 2 * t);

  // ---------------------------------------------------------------- patrones de movimiento
  const BENCH_LEGS = '<line x1="14" y1="70" x2="14" y2="82" /><line x1="66" y1="70" x2="66" y2="82" />';
  const PATTERNS = {
    bench: {
      dx: 6, title: 'Press horizontal', ground: 82, anchor: { type: 'hip', x: 45, y: 62 }, eq: 'bar', nofoot: false,
      statics: `<rect x="10" y="66" width="62" height="4" rx="2" class="gd-solid"/>${BENCH_LEGS}`,
      A: { t: 180, th: -5, sh: 95, ua: 45, fa: -90 }, B: { t: 180, th: -5, sh: 95, ua: -90, fa: -90 },
      steps: ['Acuéstate con los ojos bajo la barra, pies firmes en el piso y los omóplatos juntos y hacia abajo.', 'Agarra la barra un poco más ancha que los hombros y sácala con los brazos estirados.', 'Baja controlado hasta rozar la parte baja del pecho, con los codos a unos 45–75° del cuerpo.', 'Empuja hacia arriba hasta estirar los brazos sin despegar la espalda baja ni los glúteos.'],
      tips: ['Muñecas rectas y encima de los codos.', 'Respira: inhala al bajar, exhala al empujar.', 'Si entrenas con barra pesada, pide a alguien que te cuide.'],
      mistakes: ['Rebotar la barra en el pecho.', 'Abrir los codos a 90° (daña el hombro).', 'Levantar los glúteos del banco.'],
    },
    incline: {
      dx: 4, title: 'Press inclinado', ground: 84, anchor: { type: 'hip', x: 50, y: 64 }, eq: 'bar',
      statics: '<line x1="50" y1="68" x2="22" y2="46" class="gd-thick"/><rect x="42" y="68" width="22" height="4" rx="2" class="gd-solid"/><line x1="46" y1="72" x2="46" y2="84"/><line x1="62" y1="72" x2="62" y2="84"/>',
      A: { t: -145, th: -5, sh: 95, ua: 40, fa: -55 }, B: { t: -145, th: -5, sh: 95, ua: -55, fa: -55 },
      steps: ['Ajusta el banco a unos 30° y apoya bien la espalda y los pies.', 'Agarra a la anchura de los hombros o un poco más y baja hasta la parte alta del pecho.', 'Empuja en diagonal hacia arriba hasta estirar los brazos.'],
      tips: ['Con 30° trabajas pecho alto sin cargar demasiado el hombro.', 'Mantén los omóplatos juntos todo el recorrido.'],
      mistakes: ['Subir el banco demasiado (se vuelve un press de hombro).', 'Arquear mucho la espalda.'],
    },
    ohp: {
      sc: 0.78, title: 'Press de hombro', ground: 88, anchor: { type: 'ankle', x: 45, y: 88 }, eq: 'bar',
      A: { t: -90, th: 90, sh: 90, ua: 70, fa: -80 }, B: { t: -90, th: 90, sh: 90, ua: -92, fa: -92 },
      steps: ['De pie, pies a la anchura de los hombros, glúteos y abdomen apretados.', 'Lleva el peso a la altura de los hombros, con los antebrazos verticales.', 'Empuja hacia arriba hasta estirar los brazos, pasando la cabeza ligeramente hacia delante.', 'Baja controlado hasta los hombros.'],
      tips: ['No arquees la espalda baja: aprieta el abdomen.', 'La barra sube cerca de la cara, en línea recta.'],
      mistakes: ['Empujar con las piernas (eso es otro ejercicio).', 'Echar las costillas hacia delante.'],
    },
    row: {
      title: 'Remo inclinado', ground: 88, anchor: { type: 'ankle', x: 38, y: 88 }, eq: 'bar',
      A: { t: -25, th: 80, sh: 100, ua: 90, fa: 90 }, B: { t: -25, th: 80, sh: 100, ua: 170, fa: 85 },
      steps: ['Pies a la anchura de la cadera, rodillas ligeramente flexionadas y el torso inclinado con la espalda recta.', 'Deja los brazos estirados con el peso colgando.', 'Tira del peso hacia el abdomen llevando los codos hacia atrás y juntando los omóplatos.', 'Baja controlado sin perder la postura.'],
      tips: ['Imagina que llevas los codos al bolsillo trasero.', 'Mantén el cuello neutro: mira al piso unos metros adelante.'],
      mistakes: ['Redondear la espalda.', 'Balancearte para subir el peso.'],
    },
    pulldown: {
      title: 'Jalón', ground: 84, anchor: { type: 'hip', x: 45, y: 62 }, eq: 'cable', cable: [58, 4],
      statics: '<rect x="34" y="66" width="24" height="4" rx="2" class="gd-solid"/><circle cx="58" cy="4" r="2.5" class="gd-solid"/>',
      A: { t: -92, th: 0, sh: 90, ua: -80, fa: -80 }, B: { t: -92, th: 0, sh: 90, ua: 105, fa: -60 },
      steps: ['Siéntate con los muslos fijos bajo el cojín y agarra la barra más ancha que los hombros.', 'Inclina el torso ligeramente hacia atrás y saca el pecho.', 'Tira de la barra hacia la parte alta del pecho llevando los codos hacia abajo y atrás.', 'Sube controlado hasta estirar los brazos.'],
      tips: ['Piensa en tirar con los codos, no con las manos.', 'No necesitas llegar muy abajo: basta con la clavícula.'],
      mistakes: ['Tirar la barra detrás de la nuca.', 'Balancear todo el cuerpo.'],
    },
    pullup: {
      sc: 0.78, title: 'Dominada', ground: null, anchor: { type: 'wrist', x: 50, y: 12 }, eq: 'none', nofoot: true,
      statics: '<line x1="24" y1="12" x2="76" y2="12" class="gd-thick"/>',
      A: { t: -90, th: 90, sh: 150, ua: -90, fa: -90 }, B: { t: -90, th: 100, sh: 155, ua: 130, fa: -55 },
      steps: ['Agarra la barra un poco más ancha que los hombros y cuelga con los brazos estirados.', 'Aprieta el abdomen y junta los omóplatos antes de subir.', 'Sube llevando el pecho hacia la barra hasta pasar la barbilla.', 'Baja despacio hasta estirar los brazos.'],
      tips: ['Si aún no puedes, usa la máquina asistida o una banda elástica.', 'Baja en 3 segundos: también te hace más fuerte.'],
      mistakes: ['Balancearte o patalear.', 'No bajar del todo.'],
    },
    squat: {
      title: 'Sentadilla', ground: 86, anchor: { type: 'ankle', x: 45, y: 86 }, eq: 'bar',
      A: { t: -90, th: 90, sh: 90, ua: 110, fa: -70 }, B: { t: -60, th: 15, sh: 125, ua: 110, fa: -70 },
      steps: ['Pies a la anchura de los hombros o un poco más, puntas ligeramente hacia afuera.', 'Aprieta el abdomen, pecho arriba y mira al frente.', 'Baja empujando la cadera atrás y las rodillas hacia afuera, hasta que los muslos queden paralelos al piso o un poco más.', 'Sube empujando el piso con todo el pie.'],
      tips: ['Las rodillas siguen la dirección de las puntas de los pies.', 'Mantén los talones en el piso.', 'Empieza solo con la barra o con una mancuerna al pecho.'],
      mistakes: ['Que las rodillas se vayan hacia adentro.', 'Redondear la espalda al final de la bajada.', 'Levantar los talones.'],
    },
    hinge: {
      title: 'Bisagra de cadera', ground: 88, anchor: { type: 'ankle', x: 40, y: 88 }, eq: 'bar',
      A: { t: -45, th: 50, sh: 105, ua: 105, fa: 105 }, B: { t: -90, th: 88, sh: 92, ua: 92, fa: 92 },
      steps: ['Pies a la anchura de la cadera con la barra sobre la mitad del pie.', 'Agarra la barra, espalda recta, pecho arriba y abdomen apretado.', 'Empuja el piso y sube llevando la cadera hacia delante hasta quedar de pie.', 'Baja llevando la cadera atrás y deslizando la barra cerca de las piernas.'],
      tips: ['La barra siempre pegada al cuerpo.', 'En el peso muerto rumano casi no flexionas las rodillas: la cadera va atrás.'],
      mistakes: ['Redondear la espalda.', 'Tirar con los brazos o con la espalda baja en vez de con las piernas y glúteos.'],
    },
    lunge: {
      title: 'Zancada', ground: 88, eq: 'db',
      A: { H: [50, 46], feet: [[62, 88], [38, 88]], bend: 'fwd', t: -90, ua: 90, fa: 90 },
      B: { H: [47, 66], feet: [[64, 88], [36, 88]], bend: 'fwd', t: -90, ua: 90, fa: 90 },
      steps: ['De pie con un pie adelante y otro atrás, torso recto.', 'Baja recto hasta que ambas rodillas formen unos 90°.', 'La rodilla de adelante queda sobre el tobillo, sin pasar mucho la punta del pie.', 'Sube empujando con el pie de adelante.'],
      tips: ['Da un paso lo bastante largo para que la rodilla no pase la punta.', 'Mira al frente para mantener el equilibrio.'],
      mistakes: ['Dar un paso muy corto.', 'Inclinar el torso hacia delante.'],
    },
    curl: {
      title: 'Curl de bíceps', ground: 88, anchor: { type: 'ankle', x: 45, y: 88 }, eq: 'db',
      A: { t: -90, th: 90, sh: 90, ua: 92, fa: 92 }, B: { t: -90, th: 90, sh: 90, ua: 80, fa: -75 },
      steps: ['De pie, codos pegados al cuerpo y palmas hacia delante.', 'Sube el peso doblando solo los codos, sin mover los hombros.', 'Aprieta el bíceps arriba un segundo.', 'Baja despacio hasta estirar casi del todo.'],
      tips: ['Elige un peso que puedas mover sin balancear el cuerpo.', 'Baja en 2–3 segundos.'],
      mistakes: ['Usar impulso con la espalda.', 'Adelantar los codos al subir.'],
    },
    pushdown: {
      title: 'Extensión de tríceps en polea', ground: 88, anchor: { type: 'ankle', x: 45, y: 88 }, eq: 'cable', cable: [58, 8],
      statics: '<circle cx="58" cy="8" r="2.5" class="gd-solid"/>',
      A: { t: -92, th: 90, sh: 90, ua: 88, fa: 5 }, B: { t: -92, th: 90, sh: 90, ua: 88, fa: 88 },
      steps: ['De pie frente a la polea alta, codos pegados a las costillas.', 'Empieza con los antebrazos paralelos al piso.', 'Estira los codos hacia abajo hasta bloquear los brazos.', 'Sube controlado hasta que los antebrazos queden otra vez horizontales.'],
      tips: ['Los codos no se mueven: solo se mueven los antebrazos.'],
      mistakes: ['Inclinarte sobre la barra para empujar con el peso del cuerpo.', 'Subir los codos hacia delante.'],
    },
    skull: {
      dx: 6, title: 'Extensión de tríceps tumbado', ground: 82, anchor: { type: 'hip', x: 45, y: 62 }, eq: 'bar',
      statics: `<rect x="10" y="66" width="62" height="4" rx="2" class="gd-solid"/>${BENCH_LEGS}`,
      A: { t: 180, th: -5, sh: 95, ua: -90, fa: -90 }, B: { t: 180, th: -5, sh: 95, ua: -90, fa: -180 },
      steps: ['Acostado, sujeta el peso con los brazos estirados sobre el pecho.', 'Dobla solo los codos para bajar el peso hacia la frente o detrás de la cabeza.', 'Estira los codos para volver arriba, sin abrirlos.'],
      tips: ['Los brazos casi no se mueven: solo los antebrazos.', 'Usa poco peso al principio: los codos sufren si es excesivo.'],
      mistakes: ['Abrir los codos hacia los lados.', 'Bajar muy rápido.'],
    },
    raise: {
      title: 'Elevaciones', ground: 88, anchor: { type: 'ankle', x: 45, y: 88 }, eq: 'db',
      A: { t: -90, th: 90, sh: 90, ua: 92, fa: 92 }, B: { t: -90, th: 90, sh: 90, ua: 2, fa: 2 },
      steps: ['De pie, peso ligero, codos ligeramente flexionados.', 'Sube los brazos hasta la altura de los hombros (hacia delante o hacia los lados según el ejercicio).', 'Haz una pausa corta arriba.', 'Baja despacio, sin dejar caer el peso.'],
      tips: ['En laterales, sube como si vertieras una jarra: el meñique un poco más alto que el pulgar.', 'Usa poco peso: aquí el control manda.'],
      mistakes: ['Balancear el cuerpo.', 'Subir los hombros hacia las orejas.'],
    },
    fly: {
      dx: 6, title: 'Aperturas', ground: 82, anchor: { type: 'hip', x: 45, y: 62 }, eq: 'db',
      statics: `<rect x="10" y="66" width="62" height="4" rx="2" class="gd-solid"/>${BENCH_LEGS}`,
      A: { t: 180, th: -5, sh: 95, ua: 100, fa: 100 }, B: { t: 180, th: -5, sh: 95, ua: -90, fa: -90 },
      steps: ['Acostado, brazos casi estirados sobre el pecho con una ligera flexión de codos.', 'Abre los brazos en arco hasta sentir el estiramiento del pecho.', 'Cierra juntando las manos como si abrazaras un árbol.'],
      tips: ['Mantén los codos con la misma flexión todo el recorrido.', 'No bajes más allá de lo cómodo para el hombro.'],
      mistakes: ['Convertir la apertura en un press.', 'Usar demasiado peso.'],
    },
    legext: {
      title: 'Extensión de cuádriceps', ground: 84, anchor: { type: 'hip', x: 40, y: 62 }, eq: 'pad',
      statics: '<rect x="30" y="66" width="24" height="4" rx="2" class="gd-solid"/>',
      A: { t: -95, th: 2, sh: 92, ua: 70, fa: 95 }, B: { t: -95, th: 2, sh: 5, ua: 70, fa: 95 },
      steps: ['Ajusta el respaldo para que las rodillas queden en el borde del asiento.', 'Coloca el rodillo sobre los tobillos.', 'Estira las rodillas hasta extender las piernas y aprieta el cuádriceps.', 'Baja controlado sin dejar caer el peso.'],
      tips: ['Pausa de 1 segundo arriba.', 'Sube sin despegar la cadera del asiento.'],
      mistakes: ['Usar impulso.', 'Bloquear las rodillas de golpe con mucho peso.'],
    },
    legcurl: {
      title: 'Curl femoral', ground: 84, anchor: { type: 'hip', x: 40, y: 62 }, eq: 'pad',
      statics: '<rect x="30" y="66" width="24" height="4" rx="2" class="gd-solid"/>',
      A: { t: -95, th: 2, sh: 5, ua: 70, fa: 95 }, B: { t: -95, th: 2, sh: 110, ua: 70, fa: 95 },
      steps: ['Ajusta la máquina para que la rodilla quede en el eje de giro.', 'Coloca el rodillo sobre los tobillos.', 'Flexiona las rodillas llevando los talones hacia los glúteos.', 'Vuelve despacio a la posición inicial.'],
      tips: ['Baja en 2–3 segundos.', 'No despegues la cadera del asiento.'],
      mistakes: ['Jalonear con impulso.', 'Levantar la cadera.'],
    },
    legpress: {
      dx: 22, title: 'Prensa de piernas', ground: null, anchor: { type: 'hip', x: 28, y: 60 }, eq: 'pad', nofoot: true,
      statics: '<line x1="28" y1="64" x2="10" y2="46" class="gd-thick"/>',
      A: { t: -150, th: -60, sh: 60, ua: 30, fa: 30 }, B: { t: -150, th: -35, sh: -35, ua: 30, fa: 30 },
      steps: ['Siéntate con la espalda y la cadera pegadas al respaldo, pies a la anchura de los hombros en la plataforma.', 'Suelta los seguros y baja controlado hasta unos 90° de rodilla.', 'Empuja con todo el pie hasta casi estirar las piernas, sin bloquear las rodillas.'],
      tips: ['Si tu cadera se despega al bajar, no bajes tanto.', 'Rodillas en línea con las puntas de los pies.'],
      mistakes: ['Bloquear las rodillas de golpe.', 'Dejar que las rodillas se vayan hacia adentro.'],
    },
    calf: {
      sc: 0.88, title: 'Elevación de talones', ground: 86, anchor: { type: 'ankle', x: 45, y: 86 }, eq: 'none', toeGround: true,
      A: { t: -90, th: 90, sh: 90, ua: 92, fa: 92, lift: 0, toeGround: true }, B: { t: -90, th: 90, sh: 90, ua: 92, fa: 92, lift: 8, toeGround: true },
      steps: ['De pie con la punta de los pies sobre un escalón o la máquina.', 'Sube lo más alto que puedas sobre las puntas.', 'Pausa de 1 segundo arriba.', 'Baja despacio estirando bien el talón.'],
      tips: ['El rango completo importa más que el peso.'],
      mistakes: ['Rebotar abajo.', 'Doblar las rodillas.'],
    },
    crunch: {
      dx: 12, title: 'Abdominales', ground: 77, anchor: { type: 'hip', x: 55, y: 72 }, eq: 'none', nofoot: true,
      A: { t: 180, th: -60, sh: 60, ua: -150, fa: -30 }, B: { t: -160, th: -60, sh: 60, ua: -150, fa: -30 },
      steps: ['Acostado, rodillas dobladas y pies en el piso, manos detrás de la cabeza (sin tirar del cuello).', 'Exhala y despega los hombros del piso contrayendo el abdomen.', 'Pausa breve arriba.', 'Baja controlado sin relajar del todo.'],
      tips: ['Mira al techo: no lleves la barbilla al pecho.', 'El recorrido es corto, lo importante es contraer.'],
      mistakes: ['Jalar la cabeza con las manos.', 'Subir con impulso.'],
    },
    plank: {
      sc: 0.85, title: 'Plancha', ground: 88, anchor: { type: 'ankle', x: 82, y: 86.5 }, eq: 'none',
      A: { t: -168, th: 12, sh: 12, ua: 90, fa: 180 }, B: { t: -167, th: 12, sh: 12, ua: 90, fa: 180 },
      steps: ['Apoya los antebrazos en el piso con los codos bajo los hombros.', 'Extiende las piernas y apoya la punta de los pies.', 'Forma una línea recta de la cabeza a los talones, con abdomen y glúteos apretados.', 'Mantén la posición respirando con calma.'],
      tips: ['Empieza con 20–30 segundos y ve subiendo.', 'Si te duele la espalda baja, aprieta más el abdomen o apoya las rodillas.'],
      mistakes: ['Dejar caer la cadera.', 'Subir demasiado la cadera.'],
    },
    run: {
      title: 'Cardio (caminar / correr)', ground: 88, anchor: { type: 'hip', x: 50, y: 49 }, eq: 'none',
      A: { t: -80, th: 50, sh: 100, th2: 120, sh2: 150, ua: 120, fa: -30 }, B: { t: -80, th: 120, sh: 150, th2: 50, sh2: 100, ua: 50, fa: -60 },
      steps: ['Empieza con 5 minutos suaves para entrar en calor.', 'Mantén un ritmo con el que puedas hablar entrecortado.', 'Pisa suave, mira al frente y relaja los hombros.', 'Termina con 3–5 minutos más lentos.'],
      tips: ['Si eres principiante, alterna 1 min rápido y 2 min suave.', 'Hidrátate antes y después.'],
      mistakes: ['Empezar demasiado rápido.', 'Saltarte el calentamiento.'],
    },
    shrug: {
      sc: 0.9, title: 'Encogimientos', ground: 88, anchor: { type: 'ankle', x: 45, y: 88 }, eq: 'db',
      A: { t: -90, th: 90, sh: 90, ua: 92, fa: 92, sd: 0 }, B: { t: -90, th: 90, sh: 90, ua: 92, fa: 92, sd: 6 },
      steps: ['De pie con el peso a los lados y los brazos estirados.', 'Sube los hombros hacia las orejas, en línea recta.', 'Aprieta un segundo arriba y baja despacio.'],
      tips: ['No gires los hombros: solo arriba y abajo.'],
      mistakes: ['Hacer círculos con los hombros.', 'Doblar los codos para ayudarte.'],
    },
    facepull: {
      title: 'Jalón a la cara / hombro posterior', ground: 88, anchor: { type: 'ankle', x: 40, y: 88 }, eq: 'cable', cable: [94, 50],
      statics: '<circle cx="94" cy="50" r="2.5" class="gd-solid"/>',
      A: { t: -90, th: 90, sh: 90, ua: -5, fa: -5 }, B: { t: -90, th: 90, sh: 90, ua: 175, fa: -5 },
      steps: ['Pon la polea a la altura de la cara y agarra la cuerda con las palmas hacia abajo.', 'Da un paso atrás con los brazos estirados.', 'Tira hacia la cara abriendo los codos hacia afuera y atrás.', 'Vuelve controlado.'],
      tips: ['Piensa en «mostrar los bíceps» al final.', 'Peso ligero y repeticiones limpias.'],
      mistakes: ['Usar mucho peso e inclinarte hacia atrás.'],
    },
    dips: {
      title: 'Fondos', ground: null, anchor: { type: 'wrist', x: 45, y: 48 }, eq: 'none', nofoot: true,
      statics: '<line x1="30" y1="48" x2="60" y2="48" class="gd-thick"/>',
      A: { t: -85, th: 90, sh: 150, ua: 90, fa: 90 }, B: { t: -75, th: 100, sh: 155, ua: 155, fa: 25 },
      steps: ['Sujeta las barras con los brazos estirados y el cuerpo ligeramente inclinado hacia delante.', 'Baja doblando los codos hasta unos 90°.', 'Empuja hasta estirar los brazos.'],
      tips: ['Más inclinado = más pecho; más vertical = más tríceps.', 'Si no puedes, usa la máquina asistida.'],
      mistakes: ['Bajar demasiado (daña el hombro).', 'Encoger los hombros.'],
    },
    pushup: {
      sc: 0.85, title: 'Flexiones', ground: 87, anchor: { type: 'ankle', x: 85, y: 86 }, eq: 'none',
      A: { t: -158, th: 22, sh: 22, ua: 90, fa: 90 }, B: { t: -171, th: 9, sh: 9, ua: 157, fa: 23 },
      steps: ['Manos un poco más anchas que los hombros, cuerpo en línea recta de cabeza a talones.', 'Baja el pecho hacia el piso con los codos a unos 45° del cuerpo.', 'Empuja hasta estirar los brazos.'],
      tips: ['Si es muy difícil, haz las flexiones con las manos en un banco o con las rodillas apoyadas.'],
      mistakes: ['Dejar caer la cadera.', 'Abrir los codos a 90°.'],
    },
    seatedrow: {
      title: 'Remo sentado', ground: 84, anchor: { type: 'hip', x: 45, y: 62 }, eq: 'cable', cable: [96, 34],
      statics: '<rect x="34" y="66" width="24" height="4" rx="2" class="gd-solid"/><circle cx="96" cy="34" r="2.5" class="gd-solid"/>',
      A: { t: -90, th: 0, sh: 90, ua: 0, fa: 0 }, B: { t: -90, th: 0, sh: 90, ua: 175, fa: 5 },
      steps: ['Siéntate con el pecho arriba y la espalda recta, rodillas ligeramente flexionadas.', 'Tira del agarre hacia el abdomen llevando los codos hacia atrás.', 'Junta los omóplatos un segundo.', 'Vuelve despacio estirando los brazos sin redondear la espalda.'],
      tips: ['No te balancees: el torso casi no se mueve.'],
      mistakes: ['Encoger los hombros.', 'Balancear el torso.'],
    },
    chestpress: {
      title: 'Press en máquina', ground: 84, anchor: { type: 'hip', x: 40, y: 62 }, eq: 'db',
      statics: '<rect x="30" y="66" width="24" height="4" rx="2" class="gd-solid"/>',
      A: { t: -92, th: 0, sh: 90, ua: 160, fa: 0 }, B: { t: -92, th: 0, sh: 90, ua: 2, fa: 2 },
      steps: ['Ajusta el asiento para que las asas queden a la altura del pecho.', 'Espalda pegada al respaldo y omóplatos juntos.', 'Empuja hasta estirar los brazos sin bloquear los codos de golpe.', 'Vuelve controlado.'],
      tips: ['Ideal para aprender el movimiento con poco riesgo.'],
      mistakes: ['Despegar la espalda del respaldo.', 'Subir los hombros.'],
    },
    hipthrust: {
      dx: 4, title: 'Empuje de cadera', ground: 82, eq: 'barHip', nofoot: false,
      statics: '<rect x="6" y="71" width="22" height="3" rx="1.5" class="gd-solid"/><line x1="10" y1="74" x2="10" y2="82"/><line x1="24" y1="74" x2="24" y2="82"/>',
      A: { H: [49, 70], S: [22, 66], feet: [[70, 82]], bend: 'up', ua: 20, fa: 20 }, B: { H: [46, 52], S: [22, 66], feet: [[70, 82]], bend: 'up', ua: 20, fa: 20 },
      steps: ['Apoya la parte alta de la espalda en un banco y los pies en el piso, rodillas dobladas.', 'Empuja el piso con los talones y sube la cadera hasta que el cuerpo quede en línea de hombros a rodillas.', 'Aprieta los glúteos arriba un segundo.', 'Baja controlado sin apoyar del todo la cadera.'],
      tips: ['Mentón ligeramente pegado al pecho.', 'Si usas barra, protege la cadera con una almohadilla.'],
      mistakes: ['Arquear la espalda baja al subir.', 'Poner los pies muy cerca o muy lejos.'],
    },
    stretch: {
      sc: 0.78, title: 'Movilidad / estiramiento', ground: 88, anchor: { type: 'ankle', x: 45, y: 88 }, eq: 'none',
      A: { t: -90, th: 90, sh: 90, ua: 92, fa: 92 }, B: { t: -92, th: 90, sh: 90, ua: -88, fa: -88 },
      steps: ['Muévete despacio y respirando profundo.', 'Llega hasta sentir un estiramiento suave, nunca dolor.', 'Mantén 20–30 segundos o repite el movimiento 8–10 veces.'],
      tips: ['No rebotes en los estiramientos.', 'Mejor después de entrenar o con el cuerpo caliente.'],
      mistakes: ['Forzar hasta que duela.', 'Aguantar la respiración.'],
    },
  };

  // ---------------------------------------------------------------- elegir el patrón de un ejercicio
  function patternFor(name, group, equipment) {
    const n = norm(name);
    const has = (...w) => w.some((x) => n.includes(x));
    if (has('dominada')) return 'pullup';
    if (has('fondos')) return 'dips';
    if (has('flexion')) return 'pushup';
    if (has('plancha')) return 'plank';
    if (has('jalon', 'pullover')) return has('triceps') ? 'pushdown' : 'pulldown';
    if (has('remo al menton')) return 'raise';
    if (has('remo')) return has('polea', 'maquina', 'pecho apoyado') ? 'seatedrow' : 'row';
    if (has('press frances', 'sobre la cabeza', 'extension de triceps tras nuca')) return 'skull';
    if (has('triceps')) return 'pushdown';
    if (has('press militar', 'press de hombro', 'arnold', 'push press', 'landmine', 'press z')) return 'ohp';
    if (has('press')) {
      if (has('inclinado')) return 'incline';
      if (has('maquina', 'polea')) return 'chestpress';
      return 'bench';
    }
    if (has('aperturas', 'cruce de poleas', 'peck')) return 'fly';
    if (has('curl femoral', 'nordic', 'nordico')) return 'legcurl';
    if (has('curl')) return 'curl';
    if (has('extension de cuadriceps')) return 'legext';
    if (has('prensa de pantorrillas', 'elevacion de talones', 'tibial')) return 'calf';
    if (has('prensa')) return 'legpress';
    if (has('zancada', 'bulgara', 'step-up', 'step up')) return 'lunge';
    if (has('sentadilla', 'hack', 'belt', 'goblet')) return 'squat';
    if (has('hip thrust', 'puente de gluteo', 'patada de gluteo')) return 'hipthrust';
    if (has('peso muerto', 'buenos dias', 'rack pull', 'swing', 'cargada', 'arrancada', 'hiperextension', 'kettlebell')) return 'hinge';
    if (has('elevaciones', 'elevacion en y', 'pajaros')) return 'raise';
    if (has('face pull', 'rotacion externa')) return 'facepull';
    if (has('encogimiento', 'paseo del granjero')) return 'shrug';
    if (has('abdominales', 'crunch', 'bicicleta abdominal', 'v-ups', 'hollow', 'elevacion de piernas', 'elevacion de rodillas', 'toes to bar', 'rueda', 'dragon', 'giros', 'lenador', 'pallof', 'rotacion con landmine', 'mountain', 'leñador')) return 'crunch';
    if (group === 'cardio') return 'run';
    if (group === 'movilidad') return 'stretch';
    return { pecho: 'bench', espalda: 'row', pierna: 'squat', hombro: 'raise', brazo: 'curl', core: 'crunch' }[group] || 'stretch';
  }

  // consejos extra según el equipo y detalles de ejercicios concretos
  const EQUIP_TIPS = {
    barra: 'Calienta primero con la barra vacía y sube el peso poco a poco.',
    mancuernas: 'Controla cada mancuerna por separado y no las choques arriba.',
    maquina: 'Ajusta el asiento para que tu articulación quede alineada con el eje de la máquina.',
    polea: 'Mantén tensión constante: no dejes que las pesas descansen entre repeticiones.',
    corporal: 'Si no puedes con tu peso, usa bandas, una máquina asistida o una variante más fácil.',
  };
  const SPECIFIC = [
    ['sentadilla bulgara', 'Apoya el pie de atrás sobre un banco y baja recto: el trabajo lo hace la pierna de adelante.'],
    ['sentadilla goblet', 'Sujeta una mancuerna pegada al pecho: te ayuda a mantener el torso recto.'],
    ['peso muerto rumano', 'Casi sin doblar las rodillas: la cadera va atrás hasta sentir el estiramiento en el femoral.'],
    ['peso muerto sumo', 'Pies muy abiertos, puntas hacia afuera y agarre estrecho dentro de las piernas.'],
    ['hip thrust', 'Sube con los talones y aprieta los glúteos arriba; no arquees la espalda baja.'],
    ['dominadas asistidas', 'Elige un contrapeso que te permita hacer 6–8 repeticiones con buena técnica.'],
    ['face pull', 'Sube la polea a la altura de la cara y abre los codos al final del tirón.'],
    ['curl martillo', 'Palmas mirándose entre sí todo el recorrido: trabaja también el antebrazo.'],
    ['elevaciones laterales', 'Los brazos suben hacia los lados, no hacia delante; sin pasar de la altura de los hombros.'],
    ['elevaciones frontales', 'Sube los brazos hacia delante hasta la altura de los hombros, sin balancear el cuerpo.'],
    ['pajaros', 'Inclina el torso y abre los brazos hacia los lados apretando la parte trasera del hombro.'],
    ['aperturas', 'El codo siempre ligeramente flexionado: es un movimiento de abrazo, no de empuje.'],
    ['press arnold', 'Empieza con las palmas hacia ti y gíralas hacia delante mientras empujas.'],
    ['remo con mancuerna a una mano', 'Apoya una mano y rodilla en el banco, espalda plana, y lleva el codo hacia la cadera.'],
    ['prensa', 'No bajes tanto que la cadera se despegue del asiento.'],
    ['extension de cuadriceps', 'Pausa 1 segundo arriba y baja en 2–3 segundos.'],
    ['plancha lateral', 'Cuerpo en línea recta de pie a cabeza, apoyado en un antebrazo; no dejes caer la cadera.'],
    ['rueda abdominal', 'Empieza de rodillas y avanza solo hasta donde mantengas la espalda recta.'],
    ['elevacion de piernas', 'Sube las piernas sin balancearte y baja controlado, sin arquear la espalda.'],
    ['zancadas caminando', 'Da pasos largos y mantén el torso erguido; cada paso es una repetición.'],
    ['step-up', 'Sube empujando con el talón de la pierna que está en el escalón; no te impulses con la de abajo.'],
    ['press de banca agarre ancho', 'Un agarre más ancho carga más el pecho y el hombro: usa menos peso y baja controlado.'],
    ['press cerrado', 'Manos a la anchura de los hombros y codos pegados: trabaja más tríceps que pecho.'],
    ['caminata inclinada', 'Inclina la caminadora entre 8% y 12% y no te agarres de las barras.'],
    ['saltar la cuerda', 'Salta bajito, con las muñecas haciendo el giro y aterrizando suave en la punta de los pies.'],
  ];

  function guideFor(item) {
    const name = item.name || '';
    const key = patternFor(name, item.group, item.equipment);
    const base = PATTERNS[key];
    const n = norm(name);
    const extra = [];
    SPECIFIC.forEach(([k, tip]) => { if (n.includes(k)) extra.push(tip); });
    if (item.equipment && EQUIP_TIPS[item.equipment]) extra.push(EQUIP_TIPS[item.equipment]);
    if (item.group !== 'cardio' && item.group !== 'movilidad') extra.push('Si eres principiante: elige un peso con el que te sobren 3–4 repeticiones al terminar cada serie.');
    return { key, base, extra, name };
  }

  // ---------------------------------------------------------------- dibujo animado
  const fmtPts = (arr) => arr.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const DUR = '3.4s';

  function svgFor(key, opts = {}) {
    const P = PATTERNS[key];
    const N = 12;
    const states = []; // lista de poses a mostrar en el ciclo
    const specA = P.A; const specB = P.B;
    const frame = (spec) => solve(spec, P.anchor, P.ground, P.sc);
    for (let i = 0; i < 3; i += 1) states.push(frame(specA));
    for (let i = 1; i <= N; i += 1) states.push(frame(mix(specA, specB, ease(i / N))));
    for (let i = 0; i < 3; i += 1) states.push(frame(specB));
    for (let i = 1; i <= N; i += 1) states.push(frame(mix(specB, specA, ease(i / N))));
    const first = states[0];
    const anim = (attr, f) => `<animate attributeName="${attr}" dur="${DUR}" repeatCount="indefinite" values="${states.map(f).join(';')}"/>`;
    const poly = (cls, pick, extraAttr = '') => `<polyline class="${cls}" ${extraAttr} points="${fmtPts(pick(first))}">${anim('points', (s) => fmtPts(pick(s)))}</polyline>`;
    let out = '';
    if (P.ground) out += `<line x1="6" y1="${P.ground}" x2="94" y2="${P.ground}" class="gd-floor"/>`;
    out += `<g transform="translate(${P.dx || 0},0)">`;
    out += `<g class="gd-static">${P.statics || ''}</g>`;
    if (first.K2) out += poly('gd-leg2', (s) => [s.H, s.K2, s.A2]);
    out += poly('gd-leg', (s) => [s.H, s.K, s.A]);
    if (!P.nofoot) out += poly('gd-leg', (s) => [s.A, s.toe]);
    out += poly('gd-torso', (s) => [s.H, s.S]);
    if (P.eq === 'cable') {
      const [cx, cy] = P.cable;
      out += `<line class="gd-cable" x1="${cx}" y1="${cy}" x2="${first.W[0].toFixed(1)}" y2="${first.W[1].toFixed(1)}">${anim('x2', (s) => s.W[0].toFixed(1))}${anim('y2', (s) => s.W[1].toFixed(1))}</line>`;
    }
    out += poly('gd-arm', (s) => [s.S, s.E, s.W]);
    out += `<circle class="gd-head" r="6" cx="${first.C[0].toFixed(1)}" cy="${first.C[1].toFixed(1)}">${anim('cx', (s) => s.C[0].toFixed(1))}${anim('cy', (s) => s.C[1].toFixed(1))}</circle>`;
    const dot = (cls, r, pick) => `<circle class="${cls}" r="${r}" cx="${pick(first)[0].toFixed(1)}" cy="${pick(first)[1].toFixed(1)}">${anim('cx', (s) => pick(s)[0].toFixed(1))}${anim('cy', (s) => pick(s)[1].toFixed(1))}</circle>`;
    if (P.eq === 'bar') out += dot('gd-plate', 6, (s) => s.W);
    else if (P.eq === 'db') out += dot('gd-db', 4.2, (s) => s.W);
    else if (P.eq === 'cable') out += dot('gd-db', 2.6, (s) => s.W);
    else if (P.eq === 'pad') out += dot('gd-pad', 3.6, (s) => s.A);
    else if (P.eq === 'barHip') out += dot('gd-plate', 6, (s) => [s.H[0] + 1, s.H[1] - 5]);
    out += '</g>';
    return `<svg class="gd-svg" viewBox="-6 -8 112 112" role="img" aria-label="${P.title}" xmlns="http://www.w3.org/2000/svg">${out}</svg>`;
  }

  // ---------------------------------------------------------------- pantallas
  const settings = () => DB.getSettings();
  const isBeginner = () => settings().beginner === true;
  const seenMap = () => settings().guideSeen || {};
  function markSeen(id) { const s = settings(); s.guideSeen = Object.assign({}, s.guideSeen, { [id]: true }); DB.saveSettings(s); }
  function setBeginner(v) { const s = settings(); s.beginner = !!v; DB.saveSettings(s); }

  function section(title, items, cls) {
    const w = Utils.el('div', { class: `gd-sec ${cls || ''}` });
    w.appendChild(Utils.el('div', { class: 'eyebrow', text: title }));
    const ul = Utils.el('ul', { class: 'gd-list' });
    items.forEach((t, i) => ul.appendChild(Utils.el('li', {}, [cls === 'steps' ? Utils.el('b', { class: 'gd-n', text: String(i + 1) }) : null, Utils.el('span', { text: t })])));
    w.appendChild(ul);
    return w;
  }

  // item: { name, group, equipment }
  function open(item) {
    const g = guideFor(item);
    const body = Utils.el('div', { class: 'gd-body' });
    const fig = Utils.el('div', { class: 'gd-fig' });
    fig.innerHTML = svgFor(g.key);
    body.appendChild(fig);
    body.appendChild(Utils.el('div', { class: 'gd-cap', text: `${g.base.title}${item.group ? ` · ${item.group}` : ''}` }));
    body.appendChild(section('Cómo hacerlo', g.base.steps, 'steps'));
    body.appendChild(section('Consejos', g.base.tips.concat(g.extra), 'tips'));
    body.appendChild(section('Errores comunes', g.base.mistakes, 'mistakes'));
    body.appendChild(Utils.el('div', { class: 'gd-note', text: 'El dibujo muestra el movimiento general. Empieza con poco peso y, si puedes, pide a alguien que revise tu técnica.' }));
    const toggle = Utils.el('button', { class: `uni-chip${isBeginner() ? ' on' : ''}`, type: 'button', style: 'margin-top:10px;' });
    const paint = () => { toggle.classList.toggle('on', isBeginner()); toggle.textContent = isBeginner() ? '🎓 Modo principiante: activado' : '🎓 Activar modo principiante (te muestro la guía al abrir cada ejercicio)'; };
    toggle.addEventListener('click', () => { setBeginner(!isBeginner()); paint(); });
    paint();
    body.appendChild(toggle);
    Modal.open(`🎓 ${item.name}`, body);
  }

  // bloque para la tarjeta de un ejercicio en el entrenamiento
  function inline(ex, onChange) {
    const item = { name: ex.name, group: ex.group, equipment: ex.equipment };
    const wrap = Utils.el('div', { class: 'gd-inline-wrap' });
    const collapsed = () => {
      wrap.innerHTML = '';
      const b = Utils.el('button', { type: 'button', class: 'link-btn small gd-link', text: '🎓 Cómo se hace' });
      b.addEventListener('click', () => open(item));
      wrap.appendChild(b);
    };
    if (isBeginner() && !seenMap()[ex.id]) {
      const g = guideFor(item);
      const card = Utils.el('div', { class: 'gd-inline' });
      card.appendChild(Utils.el('div', { class: 'gd-in-head' }, [Utils.el('b', { text: '🎓 Cómo hacerlo' }), Utils.el('span', { class: 'small text-dim', text: g.base.title })]));
      const row = Utils.el('div', { class: 'gd-in-row' });
      const fig = Utils.el('div', { class: 'gd-fig sm' });
      fig.innerHTML = svgFor(g.key);
      row.appendChild(fig);
      const ol = Utils.el('ol', { class: 'gd-mini' });
      g.base.steps.slice(0, 3).forEach((s) => ol.appendChild(Utils.el('li', { text: s })));
      row.appendChild(ol);
      card.appendChild(row);
      const btns = Utils.el('div', { class: 'nut-actions act-2', style: 'margin-top:8px;' });
      const full = Utils.el('button', { class: 'btn-secondary', type: 'button', text: 'Ver guía completa' });
      full.addEventListener('click', () => open(item));
      const ok = Utils.el('button', { class: 'btn-primary', type: 'button', text: '✓ Entendido' });
      ok.addEventListener('click', () => { markSeen(ex.id); collapsed(); if (onChange) onChange(); });
      btns.appendChild(full); btns.appendChild(ok);
      card.appendChild(btns);
      wrap.appendChild(card);
    } else collapsed();
    return wrap;
  }

  // vista de depuración: todos los movimientos en cuadrícula
  function allPatterns() { return Object.keys(PATTERNS); }

  return { open, inline, svgFor, patternFor, guideFor, allPatterns, isBeginner, setBeginner, PATTERNS };
})();
