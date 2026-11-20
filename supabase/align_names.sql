-- ============================================================
--  MyGymTrack · Una sola lista de ejercicios en el ranking
--  Pega TODO en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez sin problema.
--  (Archivo generado por `node tests/build-align.js` a partir de js/lifts.js: no lo edites a mano.)
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
         when 'banca' then 'Press de banca'
         when 'sentadilla' then 'Sentadilla'
         when 'peso_muerto' then 'Peso muerto'
         when 'press_militar' then 'Press militar'
         when 'remo_barra' then 'Remo con barra'
         when 'hip_thrust' then 'Hip thrust'
         when 'c:extension_de_cuadriceps_en_maquina' then 'Extensión de cuádriceps en máquina'
         when 'c:aductores_en_maquina' then 'Aductores en máquina'
         when 'c:abductores_en_maquina' then 'Abductores en máquina'
         when 'c:prensa_de_pierna_45' then 'Prensa de pierna 45'
         when 'c:hack_squat' then 'Hack squat'
         when 'c:curl_femoral_sentado' then 'Curl femoral sentado'
         when 'c:curl_femoral_acostado' then 'Curl femoral acostado'
         when 'c:jalon_al_pecho_en_polea' then 'Jalón al pecho en polea'
         when 'c:remo_en_polea_baja' then 'Remo en polea baja'
         when 'c:remo_en_maquina' then 'Remo en máquina'
         when 'c:press_de_pecho_en_maquina' then 'Press de pecho en máquina'
         when 'c:aperturas_en_maquina_peck_deck' then 'Aperturas en máquina (peck-deck)'
         when 'c:pajaros_en_peck_deck_inverso' then 'Pájaros en peck-deck inverso'
         when 'c:elevacion_de_talones_de_pie' then 'Elevación de talones de pie'
         when 'c:elevacion_de_talones_sentado' then 'Elevación de talones sentado'
         when 'c:extension_de_triceps_en_polea_cuerda' then 'Extensión de tríceps en polea (cuerda)'
         when 'c:curl_de_biceps_con_barra' then 'Curl de bíceps con barra'
         when 'c:curl_de_biceps_con_mancuernas' then 'Curl de bíceps con mancuernas'
         when 'c:curl_predicador_scott' then 'Curl predicador (Scott)'
         when 'c:curl_en_polea_baja' then 'Curl en polea baja'
         when 'c:sentadilla_en_maquina_smith' then 'Sentadilla en máquina Smith'
         when 'c:sentadilla_goblet' then 'Sentadilla goblet'
         when 'c:press_de_hombro_en_maquina' then 'Press de hombro en máquina'
         when 'c:press_inclinado_con_barra' then 'Press inclinado con barra'
         when 'c:press_inclinado_con_mancuernas' then 'Press inclinado con mancuernas'
         when 'c:peso_muerto_rumano' then 'Peso muerto rumano'
         when 'c:hip_thrust_en_maquina' then 'Hip thrust en máquina'
         when 'c:face_pull_en_polea' then 'Face pull en polea'
         when 'c:encogimientos_de_hombros_trapecio' then 'Encogimientos de hombros (trapecio)'
         when 'c:pullover_en_polea' then 'Pullover en polea'
         when 'c:pullover_con_mancuerna' then 'Pullover con mancuerna'
       end as new_name,
       x.weight_kg, x.reps, x.e1rm, x.updated_at
from (
  select s.profile_id, s.exercise_key as old_key, s.weight_kg, s.reps, s.e1rm, s.updated_at,
         case
         when t ~ '(press (de )?banca|banca plano|bench)' and t !~ '(mancuerna|inclinado|declinado|maquina|smith|agarre cerrado|cerrado|floor|svend)' then 'banca'
         when t ~ 'sentadilla' and t !~ '(bulgara|hack|goblet|sissy|maquina|smith|salto|pistol|bandas?|frontal|mancuerna|cinturon|belt|zercher|una pierna|pendular)' then 'sentadilla'
         when t ~ 'peso muerto' and t !~ '(rumano|stiff|mancuerna|piernas rigidas|unilateral|una pierna|hexagonal|kettlebell)' then 'peso_muerto'
         when t ~ 'press militar' and t !~ '(mancuerna|maquina|smith|arnold)' then 'press_militar'
         when t ~ '(remo (con )?barra|pendlay)' and t !~ '(mancuerna|maquina|polea|t ?bar|meadows|smith|invertido)' then 'remo_barra'
         when t ~ '(hip thrust|empuje de cadera)' and t !~ '(maquina|mancuerna|una pierna)' then 'hip_thrust'
         when t ~ '(extension(es)? (de )?(rodilla|rodillas|cuadriceps|pierna|piernas)|leg extension|sillon (de )?cuadriceps)' and t !~ '(una pierna|unilateral|1 pierna|liga|banda|polea|cable|mancuerna|isometric)' then 'c:extension_de_cuadriceps_en_maquina'
         when t ~ '(aductor|aduccion)' and t !~ '(liga|banda|polea|cable|mancuerna|smith|barra|unilateral|una pierna|1 pierna)' then 'c:aductores_en_maquina'
         when t ~ '(abductor|abduccion)' and t !~ '(liga|banda|polea|cable|mancuerna|smith|barra|unilateral|una pierna|1 pierna|hombro|brazo)' then 'c:abductores_en_maquina'
         when t ~ '(prensa|leg press)' and t !~ '(horizontal|unilateral|una pierna|pantorrilla|gemelo|talon|hombro|pecho|banca)' then 'c:prensa_de_pierna_45'
         when t ~ '(hack squat|sentadilla hack|hack)' and t !~ '(barra)' then 'c:hack_squat'
         when t ~ '(((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl)[a-z ]*(sentad[oa]|seated)|(sentad[oa]|seated)[a-z ]*((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl))' and t !~ '(una pierna|unilateral|acostad|tumbad|boca abajo|prone|lying)' then 'c:curl_femoral_sentado'
         when t ~ '(((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl)[a-z ]*(acostad[oa]|tumbad[oa]|boca abajo|prone|lying)|(acostad[oa]|tumbad[oa]|prone|lying)[a-z ]*((curl|flexion) (de )?(femoral(es)?|isquios?|isquiotibial(es)?|piernas?|rodilla)|leg curl|hamstring curl))' and t !~ '(una pierna|unilateral|sentad|seated)' then 'c:curl_femoral_acostado'
         when t ~ '(jalon|pulldown|lat pull)' and t !~ '(agarre|cerrado|supino|ancho|brazos rectos|rectos|unilateral|una mano|neutro|tras nuca|triceps)' then 'c:jalon_al_pecho_en_polea'
         when t ~ '(remo (en |con )?(polea|cable)( baja| sentado)?|remo sentado en polea|seated row|low row)' and t !~ '(ancho|unilateral|una mano|agarre|barra|mancuerna|pecho apoyado)' then 'c:remo_en_polea_baja'
         when t ~ '(remo (sentado )?(en )?maquina|machine row)' and t !~ '(pecho apoyado|smith|unilateral|polea|cable)' then 'c:remo_en_maquina'
         when t ~ '(press (de )?pecho (en )?maquina|chest press|press (en )?maquina( de pecho)?|pecho plano (en )?maquina|maquina (de )?pecho)' and t !~ '(inclinado|unilateral|smith|hombro|polea)' then 'c:press_de_pecho_en_maquina'
         when t ~ '(peck ?deck|pec ?deck|aperturas? (en )?maquina|mariposa)' and t !~ '(inverso|posterior|trasero|pajaro|hombro)' then 'c:aperturas_en_maquina_peck_deck'
         when t ~ '(pajaros? (en )?(peck ?deck|pec ?deck|maquina)|(peck|pec) ?deck inverso|reverse (fly|pec))' and t !~ '(polea|cable|mancuerna)' then 'c:pajaros_en_peck_deck_inverso'
         when t ~ '(elevacion(es)? de (talones|gemelos|pantorrillas)|calf raise|gemelos|pantorrillas)' and t !~ '(sentad|prensa|smith|una pierna|unilateral)' then 'c:elevacion_de_talones_de_pie'
         when t ~ '(((elevacion(es)? de (talones|gemelos|pantorrillas)|calf raise|gemelos|pantorrillas)[a-z ]*sentad)|sentad[a-z ]*(talones|gemelos|pantorrillas|calf))' and t !~ '(prensa|smith|una pierna|unilateral)' then 'c:elevacion_de_talones_sentado'
         when t ~ '(extension(es)? (de )?triceps( en)? (polea|cuerda)|triceps (en )?(polea|cuerda)|push ?down|jalon (de )?triceps)' and t !~ '(una mano|unilateral|barra|tras nuca|supino|mancuerna|sobre la cabeza|banco|acostad)' then 'c:extension_de_triceps_en_polea_cuerda'
         when t ~ '(curl (de )?biceps( con)? barra( recta)?|curl (con )?barra( recta)?)' and t !~ '(barra z|barra ez|inverso|predicador|scott|polea|mancuerna|spider|arana)' then 'c:curl_de_biceps_con_barra'
         when t ~ '(curl (de )?biceps( con)? (mancuernas?|pesas?)|curl (con )?(mancuernas?|pesas?)|curl alterno)' and t !~ '(martillo|concentrado|inclinado|predicador|arana|spider|una mano|unilateral)' then 'c:curl_de_biceps_con_mancuernas'
         when t ~ '(predicador|scott|preacher)' and t !~ '(maquina|polea|mancuerna)' then 'c:curl_predicador_scott'
         when t ~ '(curl (de (biceps|b) )?(en )?polea( baja)?)' and t !~ '(cuerda|bayesian|unilateral|triceps)' then 'c:curl_en_polea_baja'
         when t ~ '(sentadilla (en |con )?(maquina )?smith|smith squat)' and t !~ '(frontal|bulgara|unilateral)' then 'c:sentadilla_en_maquina_smith'
         when t ~ '(goblet)' and t !~ '(bulgara)' then 'c:sentadilla_goblet'
         when t ~ '(press (de )?hombros? (en )?maquina|shoulder press|press militar (en )?maquina)' and t !~ '(mancuerna|barra|smith|unilateral|arnold)' then 'c:press_de_hombro_en_maquina'
         when t ~ '(press inclinado( con)? barra|incline bench( press)?|press (de )?banca inclinado( con barra)?)' and t !~ '(mancuerna|maquina|smith)' then 'c:press_inclinado_con_barra'
         when t ~ '(press (de banca )?inclinado[a-z ]*mancuernas?|incline dumbbell press|mancuernas?[a-z ]*press inclinado)' and t !~ '(unilateral|una mano)' then 'c:press_inclinado_con_mancuernas'
         when t ~ '(peso muerto rumano|rdl|romanian deadlift|stiff)' and t !~ '(mancuerna|una pierna|unilateral|smith)' then 'c:peso_muerto_rumano'
         when t ~ '(hip thrust (en )?maquina|maquina (de )?hip thrust|empuje de cadera (en )?maquina)' and t !~ '(unilateral|una pierna)' then 'c:hip_thrust_en_maquina'
         when t ~ '(face ?pull)' and t !~ '(mancuerna)' then 'c:face_pull_en_polea'
         when t ~ '(encogimientos?|shrugs?|trapecio)' and t !~ '(barra|maquina|smith)' then 'c:encogimientos_de_hombros_trapecio'
         when t ~ '(pull ?over[a-z ]*(polea|cable)|(polea|cable)[a-z ]*pull ?over)' and t !~ '(barra|mancuerna)' then 'c:pullover_en_polea'
         when t ~ '(pull ?over)' and t !~ '(polea|cable|barra|cuerda)' then 'c:pullover_con_mancuerna'
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
