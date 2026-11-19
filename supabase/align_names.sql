-- ============================================================
--  MyGymTrack · Alinear nombres de ejercicios del ranking
--  Pega TODO en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez sin problema.
--
--  Problema: un ejercicio escrito «hip-thrust» (con guion) no se reconocía
--  como «Hip thrust» y quedaba como ejercicio «propio» (c:hip_thrust),
--  separado del ranking básico. Esto mueve esas marcas a su ejercicio básico
--  (si una persona tiene las dos, se queda con la mejor) y borra las viejas.
--  Solo toca claves que empiezan por «c:» y que, sin guiones, son un básico.
-- ============================================================

drop table if exists _gt_map;
create temp table _gt_map as
select s.profile_id, s.exercise_key as old_key,
       case
         when t ~ '(press (de )?banca|banca plano|bench)' and t !~ '(mancuerna|inclinado|declinado|maquina|smith|agarre cerrado|cerrado|floor|svend)' then 'banca'
         when t ~ 'sentadilla' and t !~ '(bulgara|hack|goblet|sissy|maquina|smith|salto|pistol|bandas?|frontal|mancuerna|cinturon|belt|zercher|una pierna|pendular)' then 'sentadilla'
         when t ~ 'peso muerto' and t !~ '(rumano|stiff|mancuerna|piernas rigidas|unilateral|una pierna|hexagonal|kettlebell)' then 'peso_muerto'
         when t ~ 'press militar' and t !~ '(mancuerna|maquina|smith|arnold)' then 'press_militar'
         when t ~ '(remo (con )?barra|pendlay)' and t !~ '(mancuerna|maquina|polea|t ?bar|meadows|smith|invertido)' then 'remo_barra'
         when t ~ '(hip thrust|empuje de cadera)' and t !~ '(maquina|mancuerna|una pierna)' then 'hip_thrust'
       end as new_key,
       s.exercise_name, s.weight_kg, s.reps, s.e1rm, s.updated_at
from (select *, replace(substr(exercise_key, 3), '_', ' ') as t from public.gt_scores where exercise_key like 'c:%') s;

delete from _gt_map where new_key is null;

-- si la persona ya tenía el básico, solo pasa la marca vieja si es mejor
insert into public.gt_scores (profile_id, exercise_key, exercise_name, weight_kg, reps, e1rm, updated_at)
select distinct on (m.profile_id, m.new_key) m.profile_id, m.new_key,
       case m.new_key when 'banca' then 'Press de banca' when 'sentadilla' then 'Sentadilla' when 'peso_muerto' then 'Peso muerto'
                      when 'press_militar' then 'Press militar' when 'remo_barra' then 'Remo con barra' else 'Hip thrust' end,
       m.weight_kg, m.reps, m.e1rm, m.updated_at
from _gt_map m
order by m.profile_id, m.new_key, m.e1rm desc
on conflict (profile_id, exercise_key) do update
  set exercise_name = excluded.exercise_name, weight_kg = excluded.weight_kg, reps = excluded.reps,
      e1rm = excluded.e1rm, updated_at = excluded.updated_at
  where excluded.e1rm > public.gt_scores.e1rm;

delete from public.gt_scores s using _gt_map m
where s.profile_id = m.profile_id and s.exercise_key = m.old_key;

-- lo que quedó movido
select new_key as ejercicio_basico, count(*) as marcas_movidas from _gt_map group by new_key order by 1;
