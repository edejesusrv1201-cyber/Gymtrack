-- ============================================================
--  MyGymTrack · El ranking ordena por PESO MÁXIMO (y repeticiones)
--  Pega TODO en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez. No borra nada.
--
--  Antes: se ordenaba por 1RM estimado. Ahora gana quien levantó MÁS PESO;
--  si el peso es igual, gana quien hizo MÁS REPETICIONES (después, quien lo logró antes).
-- ============================================================

create index if not exists gt_scores_board2 on public.gt_scores (exercise_key, weight_kg desc, reps desc);

create or replace function public.gt_leaderboard(p_key text, p_sex text default null, p_limit int default 50)
returns table (rank bigint, name text, sex text, weight_kg numeric, reps int, e1rm numeric, updated_at timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select row_number() over (order by s.weight_kg desc, s.reps desc, s.updated_at asc) as rank,
         p.name, p.sex, s.weight_kg, s.reps, s.e1rm, s.updated_at
  from public.gt_scores s
  join public.gt_profiles p on p.id = s.profile_id
  where s.exercise_key = lower(btrim(coalesce(p_key, '')))
    and (p_sex is null or p.sex = p_sex)
  order by s.weight_kg desc, s.reps desc, s.updated_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

grant execute on function public.gt_leaderboard(text, text, int) to anon, authenticated;
