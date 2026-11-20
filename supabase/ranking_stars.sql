-- ============================================================
--  MyGymTrack · Ranking con ⭐ ejercicios fijos (sin ejercicios de la comunidad)
--  Pega TODO en Supabase → SQL Editor → New query → Run. Se puede correr más de una vez.
--  (Archivo generado por `node tests/build-align.js` a partir de js/lifts.js: no lo edites a mano.)
--
--  Solo estos 19 ejercicios se pueden publicar. Las marcas viejas de otros ejercicios
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
  if v_key not in ('banca', 'sentadilla', 'peso_muerto', 'press_militar', 'remo_barra', 'hip_thrust', 'c:press_inclinado_con_mancuernas', 'c:prensa_de_pierna_45', 'c:peso_muerto_rumano', 'c:jalon_al_pecho_en_polea', 'c:remo_en_polea_baja', 'c:press_de_pecho_en_maquina', 'c:extension_de_cuadriceps_en_maquina', 'c:curl_femoral_sentado', 'c:curl_de_biceps_con_barra', 'c:extension_de_triceps_en_polea_cuerda', 'c:abductores_en_maquina', 'c:aductores_en_maquina', 'c:elevacion_de_talones_de_pie') then raise exception 'bad_exercise'; end if;
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
  where s.exercise_key in ('banca', 'sentadilla', 'peso_muerto', 'press_militar', 'remo_barra', 'hip_thrust', 'c:press_inclinado_con_mancuernas', 'c:prensa_de_pierna_45', 'c:peso_muerto_rumano', 'c:jalon_al_pecho_en_polea', 'c:remo_en_polea_baja', 'c:press_de_pecho_en_maquina', 'c:extension_de_cuadriceps_en_maquina', 'c:curl_femoral_sentado', 'c:curl_de_biceps_con_barra', 'c:extension_de_triceps_en_polea_cuerda', 'c:abductores_en_maquina', 'c:aductores_en_maquina', 'c:elevacion_de_talones_de_pie')
  group by s.exercise_key
  order by count(*) desc, s.exercise_key;
$$;

revoke all on function public.gt_publish(uuid, text, text, numeric, int) from public;
grant execute on function public.gt_publish(uuid, text, text, numeric, int) to anon, authenticated;
grant execute on function public.gt_exercises() to anon, authenticated;
