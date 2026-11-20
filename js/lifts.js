/* ============================================================
   lifts.js — Lista ÚNICA de ejercicios para el ranking.
   Cada persona le pone al ejercicio el nombre que quiera
   («extensión de rodilla», «leg extension», «extensión de cuádriceps
   en máquina»…). Estas reglas leen el nombre y lo llevan al mismo
   ejercicio de la biblioteca, para que todos compitan en una sola
   lista. Los textos se comparan sin tildes, en minúsculas y con los
   guiones como espacios (igual que Leaderboard.norm).

   OJO: estas expresiones también se pasan a SQL (supabase/align_names.sql,
   se genera con `node tests/build-align.js`), así que solo usan
   alternancias, grupos, `?`, `*`, `[a-z ]` (nada de \b ni lookahead).
   ============================================================ */

const Lifts = (() => {
  const EQ_OTHER = 'liga|banda|polea|cable|mancuerna|smith|barra|unilateral|una pierna|1 pierna';

  // { to: nombre del ejercicio en la biblioteca, re: debe cumplirse, not: no debe cumplirse }
  const RULES = [
    { to: 'Extensión de cuádriceps en máquina', re: '(extension(es)? (de )?(rodilla|rodillas|cuadriceps|pierna|piernas)|leg extension|sillon (de )?cuadriceps)', not: '(una pierna|unilateral|1 pierna|liga|banda|polea|cable|mancuerna|isometric)' },
    { to: 'Aductores en máquina', re: '(aductor|aduccion)', not: `(${EQ_OTHER})` },
    { to: 'Abductores en máquina', re: '(abductor|abduccion)', not: `(${EQ_OTHER}|hombro|brazo)` },
    { to: 'Prensa de pierna 45°', re: '(prensa|leg press)', not: '(horizontal|unilateral|una pierna|pantorrilla|gemelo|talon|hombro|pecho|banca)' },
    { to: 'Hack squat', re: '(hack squat|sentadilla hack|hack)', not: '(barra)' },
    { to: 'Curl femoral sentado', re: '(((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl)[a-z ]*(sentad[oa]|seated)|(sentad[oa]|seated)[a-z ]*((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl))', not: '(una pierna|unilateral|acostad|tumbad|boca abajo|prone|lying)' },
    { to: 'Curl femoral acostado', re: '(((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl)[a-z ]*(acostad[oa]|tumbad[oa]|boca abajo|prone|lying)|(acostad[oa]|tumbad[oa]|prone|lying)[a-z ]*((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl))', not: '(una pierna|unilateral|sentad|seated)' },
    { to: 'Jalón al pecho en polea', re: '(jalon|pulldown|lat pull)', not: '(agarre|cerrado|supino|ancho|brazos rectos|rectos|unilateral|una mano|neutro|tras nuca|triceps)' },
    { to: 'Remo en polea baja', re: '(remo (en |con )?(polea|cable)( baja| sentado)?|remo sentado en polea|seated row|low row)', not: '(ancho|unilateral|una mano|agarre|barra|mancuerna|pecho apoyado)' },
    { to: 'Remo en máquina', re: '(remo (sentado )?(en )?maquina|machine row)', not: '(pecho apoyado|smith|unilateral|polea|cable)' },
    { to: 'Press de pecho en máquina', re: '(press (de )?pecho (en )?maquina|chest press|press (en )?maquina( de pecho)?|pecho plano (en )?maquina|maquina (de )?pecho)', not: '(inclinado|unilateral|smith|hombro|polea)' },
    { to: 'Aperturas en máquina (peck-deck)', re: '(peck ?deck|pec ?deck|aperturas? (en )?maquina|mariposa)', not: '(inverso|posterior|trasero|pajaro|hombro)' },
    { to: 'Pájaros en peck-deck inverso', re: '(pajaros? (en )?(peck ?deck|pec ?deck|maquina)|(peck|pec) ?deck inverso|reverse (fly|pec))', not: '(polea|cable|mancuerna)' },
    { to: 'Elevación de talones de pie', re: '(elevacion(es)? de (talones|gemelos|pantorrillas)|calf raise|gemelos|pantorrillas)', not: '(sentad|prensa|smith|una pierna|unilateral)' },
    { to: 'Elevación de talones sentado', re: '(((elevacion(es)? de (talones|gemelos|pantorrillas)|calf raise|gemelos|pantorrillas)[a-z ]*sentad)|sentad[a-z ]*(talones|gemelos|pantorrillas|calf))', not: '(prensa|smith|una pierna|unilateral)' },
    { to: 'Extensión de tríceps en polea (cuerda)', re: '(extension(es)? (de )?triceps( en)? (polea|cuerda)|triceps (en )?(polea|cuerda)|push ?down|jalon (de )?triceps)', not: '(una mano|unilateral|barra|tras nuca|supino|mancuerna|sobre la cabeza|banco|acostad)' },
    { to: 'Curl de bíceps con barra', re: '(curl (de )?biceps( con)? barra( recta)?|curl (con )?barra( recta)?)', not: '(barra z|barra ez|inverso|predicador|scott|polea|mancuerna|spider|arana)' },
    { to: 'Curl de bíceps con mancuernas', re: '(curl (de )?biceps( con)? (mancuernas?|pesas?)|curl (con )?(mancuernas?|pesas?)|curl alterno)', not: '(martillo|concentrado|inclinado|predicador|arana|spider|una mano|unilateral)' },
    { to: 'Curl predicador (Scott)', re: '(predicador|scott|preacher)', not: '(maquina|polea|mancuerna)' },
    { to: 'Curl en polea baja', re: '(curl (de (biceps|b) )?(en )?polea( baja)?)', not: '(cuerda|bayesian|unilateral|triceps)' },
    { to: 'Sentadilla en máquina Smith', re: '(sentadilla (en |con )?(maquina )?smith|smith squat)', not: '(frontal|bulgara|unilateral)' },
    { to: 'Sentadilla goblet', re: '(goblet)', not: '(bulgara)' },
    { to: 'Press de hombro en máquina', re: '(press (de )?hombros? (en )?maquina|shoulder press|press militar (en )?maquina)', not: '(mancuerna|barra|smith|unilateral|arnold)' },
    { to: 'Press inclinado con barra', re: '(press inclinado( con)? barra|incline bench( press)?|press (de )?banca inclinado( con barra)?)', not: '(mancuerna|maquina|smith)' },
    { to: 'Press inclinado con mancuernas', re: '(press (de banca )?inclinado[a-z ]*mancuernas?|incline dumbbell press|mancuernas?[a-z ]*press inclinado)', not: '(unilateral|una mano)' },
    { to: 'Peso muerto rumano', re: '(peso muerto rumano|rdl|romanian deadlift|stiff)', not: '(mancuerna|una pierna|unilateral|smith)' },
    { to: 'Hip thrust en máquina', re: '(hip thrust (en )?maquina|maquina (de )?hip thrust|empuje de cadera (en )?maquina)', not: '(unilateral|una pierna)' },
    { to: 'Face pull en polea', re: '(face ?pull)', not: '(mancuerna)' },
    { to: 'Encogimientos de hombros (trapecio)', re: '(encogimientos?|shrugs?|trapecio)', not: '(barra|maquina|smith)' },
    { to: 'Pullover en polea', re: '(pull ?over[a-z ]*(polea|cable)|(polea|cable)[a-z ]*pull ?over)', not: '(barra|mancuerna)' },
    { to: 'Pullover con mancuerna', re: '(pull ?over)', not: '(polea|cable|barra|cuerda)' },
  ];

  const STOP = new Set(['de', 'en', 'con', 'el', 'la', 'los', 'las', 'a', 'al', 'un', 'una', 'y', 'del', 'para', 'tu', 'mi']);
  const stem = (w) => (w.length > 5 && w.endsWith('es') ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w);
  // palabras sin conectores y en singular, ordenadas: «Máquina de extensión de cuádriceps» = «Extensión de cuádriceps en máquina»
  const tokens = (normName) => normName.split(' ').filter((w) => w && !STOP.has(w)).map(stem).sort().join(' ');

  const compiled = RULES.map((r) => ({ to: r.to, re: new RegExp(r.re), not: r.not ? new RegExp(r.not) : null }));
  // nombre (ya normalizado) → nombre de la biblioteca, o null
  const canonical = (normName) => {
    const hit = compiled.find((r) => r.re.test(normName) && !(r.not && r.not.test(normName)));
    return hit ? hit.to : null;
  };

  return { RULES, canonical, tokens };
})();
