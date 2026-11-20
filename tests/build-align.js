// Genera supabase/align_names.sql y supabase/ranking_stars.sql: junta en el servidor las marcas del ranking que están con nombres distintos
// del mismo ejercicio (básicos + las reglas de js/lifts.js).
// Uso:  node tests/build-align.js     (corre otra vez cada vez que cambies js/lifts.js)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');

const ctx = {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/lifts.js'), 'utf8').replace(/^const Lifts/m, 'var Lifts'), ctx);
const RULES = ctx.Lifts.RULES;

// igual que Leaderboard.norm / slug / cleanName
const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-_.]+/g, ' ').replace(/\s+/g, ' ').trim();
const slug = (t) => norm(t).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
const cleanName = (t) => String(t).replace(/[^\p{L}\p{N} ._()/+-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40);
const q = (t) => `'${String(t).replace(/'/g, "''")}'`;

const BASICS = [
  ['banca', 'Press de banca', "(press (de )?banca|banca plano|bench)", "(mancuerna|inclinado|declinado|maquina|smith|agarre cerrado|cerrado|floor|svend)"],
  ['sentadilla', 'Sentadilla', "sentadilla", "(bulgara|hack|goblet|sissy|maquina|smith|salto|pistol|bandas?|frontal|mancuerna|cinturon|belt|zercher|una pierna|pendular)"],
  ['peso_muerto', 'Peso muerto', "peso muerto", "(rumano|stiff|mancuerna|piernas rigidas|unilateral|una pierna|hexagonal|kettlebell)"],
  ['press_militar', 'Press militar', "press militar", "(mancuerna|maquina|smith|arnold)"],
  ['remo_barra', 'Remo con barra', "(remo (con )?barra|pendlay)", "(mancuerna|maquina|polea|t ?bar|meadows|smith|invertido)"],
  ['hip_thrust', 'Hip thrust', "(hip thrust|empuje de cadera)", "(maquina|mancuerna|una pierna)"],
];

const branches = [];
const names = [];
BASICS.forEach(([key, name, re, not]) => {
  branches.push(`         when t ~ ${q(re)} and t !~ ${q(not)} then ${q(key)}`);
  names.push(`         when ${q(key)} then ${q(name)}`);
});
RULES.forEach((r) => {
  const key = `c:${slug(r.to)}`;
  branches.push(`         when t ~ ${q(r.re)}${r.not ? ` and t !~ ${q(r.not)}` : ''} then ${q(key)}`);
  names.push(`         when ${q(key)} then ${q(cleanName(r.to))}`);
});

const sql = `-- ============================================================
--  MyGymTrack · Una sola lista de ejercicios en el ranking
--  Pega TODO en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez sin problema.
--  (Archivo generado por \`node tests/build-align.js\` a partir de js/lifts.js: no lo edites a mano.)
--
--  Problema: el mismo ejercicio escrito de distinta forma («hip-thrust», «extensión de
--  rodilla» y «extensión de cuádriceps en máquina») quedaba separado en el ranking.
--  Esto mueve esas marcas al ejercicio único de la lista (si una persona tiene dos,
--  se queda con la mejor: más peso y, a igual peso, más repeticiones) y borra las repetidas.
--  Solo toca claves que empiezan por «c:» y devuelve cuántas movió.
-- ============================================================

drop table if exists _gt_map;
create temp table _gt_map as
select x.profile_id, x.old_key, x.new_key,
       case x.new_key
${names.join('\n')}
       end as new_name,
       x.weight_kg, x.reps, x.e1rm, x.updated_at
from (
  select s.profile_id, s.exercise_key as old_key, s.weight_kg, s.reps, s.e1rm, s.updated_at,
         case
${branches.join('\n')}
         end as new_key
  from (select *, replace(substr(exercise_key, 3), '_', ' ') as t from public.gt_scores where exercise_key like 'c:%') s
) x
where x.new_key is not null and x.new_key <> x.old_key;

-- si la persona ya tenía ese ejercicio, la marca vieja solo pasa si es mejor (más peso; a igual peso, más repeticiones)
insert into public.gt_scores (profile_id, exercise_key, exercise_name, weight_kg, reps, e1rm, updated_at)
select distinct on (m.profile_id, m.new_key) m.profile_id, m.new_key, m.new_name, m.weight_kg, m.reps, m.e1rm, m.updated_at
from _gt_map m
order by m.profile_id, m.new_key, m.weight_kg desc, m.reps desc
on conflict (profile_id, exercise_key) do update
  set exercise_name = excluded.exercise_name, weight_kg = excluded.weight_kg, reps = excluded.reps,
      e1rm = excluded.e1rm, updated_at = excluded.updated_at
  where excluded.weight_kg > public.gt_scores.weight_kg
     or (excluded.weight_kg = public.gt_scores.weight_kg and excluded.reps > public.gt_scores.reps);

delete from public.gt_scores s using _gt_map m
where s.profile_id = m.profile_id and s.exercise_key = m.old_key;

-- lo que quedó movido
select new_key as ejercicio, count(*) as marcas_movidas from _gt_map group by new_key order by 1;
`;

// ---- ranking de ⭐ ejercicios fijos: solo esas claves se pueden publicar
const STARS = ctx.Lifts.STARS;
const starKeys = STARS.map((k) => (/^[a-z_]+$/.test(k) ? k : `c:${slug(k)}`));
const starsSql = `-- ============================================================
--  MyGymTrack · Ranking con ⭐ ejercicios fijos (sin ejercicios de la comunidad)
--  Pega TODO en Supabase → SQL Editor → New query → Run. Se puede correr más de una vez.
--  (Archivo generado por \`node tests/build-align.js\` a partir de js/lifts.js: no lo edites a mano.)
--
--  Solo estos ${starKeys.length} ejercicios se pueden publicar. Las marcas viejas de otros ejercicios
--  no se borran: simplemente ya no aparecen ni se pueden crear nuevas.
-- ============================================================

create or replace function public.gt_publish(p_secret uuid, p_key text, p_name text, p_weight numeric, p_reps int)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id    uuid;
  v_key   text := lower(btrim(coalesce(p_key, '')));
  v_ename text := btrim(coalesce(p_name, ''));
  v_e     numeric;
begin
  select id into v_id from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  if p_weight is null or p_weight <= 0 or p_weight > 700 or p_reps is null or p_reps < 1 or p_reps > 30 then raise exception 'bad_values'; end if;
  if v_key not in (${starKeys.map(q).join(', ')}) then raise exception 'bad_exercise'; end if;
  if char_length(v_ename) < 2 or char_length(v_ename) > 40 then raise exception 'bad_exercise'; end if;
  if v_ename !~ '^[[:alnum:] ._()/+-]+$' then raise exception 'bad_exercise'; end if;
  v_e := round(case when p_reps = 1 then p_weight else p_weight * (1 + p_reps / 30.0) end, 2);
  insert into public.gt_scores (profile_id, exercise_key, exercise_name, weight_kg, reps, e1rm)
  values (v_id, v_key, v_ename, p_weight, p_reps, v_e)
  on conflict (profile_id, exercise_key) do update
    set exercise_name = excluded.exercise_name, weight_kg = excluded.weight_kg, reps = excluded.reps,
        e1rm = excluded.e1rm, updated_at = now();
  return json_build_object('e1rm', v_e);
end;
$$;

-- lista de ejercicios con marcas: solo los ⭐
create or replace function public.gt_exercises()
returns table (exercise_key text, exercise_name text, athletes bigint)
language sql
security definer
set search_path = public, extensions
as $$
  select s.exercise_key, (array_agg(s.exercise_name order by s.updated_at desc))[1], count(*)
  from public.gt_scores s
  where s.exercise_key in (${starKeys.map(q).join(', ')})
  group by s.exercise_key
  order by count(*) desc, s.exercise_key;
$$;

revoke all on function public.gt_publish(uuid, text, text, numeric, int) from public;
grant execute on function public.gt_publish(uuid, text, text, numeric, int) to anon, authenticated;
grant execute on function public.gt_exercises() to anon, authenticated;
`;

const out = path.join(root, 'supabase/align_names.sql');
const out2 = path.join(root, 'supabase/ranking_stars.sql');
if (process.argv.includes('--check')) {
  const rd = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split(String.fromCharCode(13, 10)).join(String.fromCharCode(10)) : '');
  process.exit(rd(out) === sql && rd(out2) === starsSql ? 0 : 1);
}
fs.writeFileSync(out, sql);
fs.writeFileSync(out2, starsSql);
console.log(`supabase/align_names.sql y ranking_stars.sql generados (${BASICS.length} básicos + ${RULES.length} reglas, ${starKeys.length} ejercicios ⭐)`);
