-- ============================================================
--  MiGymTrack · Ranking global (Supabase)
--  Pega TODO este archivo en Supabase → SQL Editor → New query → Run.
--  Se puede ejecutar más de una vez sin problema.
--
--  Cómo protege los datos:
--   · Las tablas NO se pueden leer ni escribir directamente con la clave pública.
--   · Todo pasa por las funciones de abajo, que validan nombre, pesos y repeticiones.
--   · Cada usuario tiene un "secreto" que solo guarda su celular; sin él nadie puede
--     publicar ni borrar marcas a su nombre. La contraseña (opcional) sirve para
--     volver a entrar desde otro celular.
--   · No se guardan correos ni datos personales: solo nombre elegido, sexo (opcional)
--     y las marcas que la persona decide publicar.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------- tablas
create table if not exists public.gt_profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sex         text check (sex in ('M', 'F')),
  pass_hash   text,
  secret      uuid not null default gen_random_uuid(),
  created_at  timestamptz not null default now()
);
create unique index if not exists gt_profiles_name_key on public.gt_profiles (lower(name));
create unique index if not exists gt_profiles_secret_key on public.gt_profiles (secret);

create table if not exists public.gt_scores (
  id             bigint generated always as identity primary key,
  profile_id     uuid not null references public.gt_profiles (id) on delete cascade,
  exercise_key   text not null,
  exercise_name  text not null,
  weight_kg      numeric(7, 2) not null check (weight_kg > 0 and weight_kg <= 700),
  reps           int not null check (reps between 1 and 30),
  e1rm           numeric(7, 2) not null,
  updated_at     timestamptz not null default now(),
  unique (profile_id, exercise_key)
);
create index if not exists gt_scores_board on public.gt_scores (exercise_key, e1rm desc);

-- Seguridad: con RLS activado y SIN políticas, la clave pública no puede tocar las tablas.
alter table public.gt_profiles enable row level security;
alter table public.gt_scores enable row level security;
revoke all on public.gt_profiles from anon, authenticated;
revoke all on public.gt_scores from anon, authenticated;

-- ---------------------------------------------------------------- crear usuario
create or replace function public.gt_register(p_name text, p_sex text default null, p_pass text default null)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_sex    text := case when p_sex in ('M', 'F') then p_sex else null end;
  v_id     uuid;
  v_secret uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 24 then raise exception 'name_length'; end if;
  if v_name !~ '^[[:alnum:] ._-]+$' then raise exception 'name_chars'; end if;
  if coalesce(p_pass, '') <> '' and char_length(p_pass) < 4 then raise exception 'pass_short'; end if;
  begin
    insert into public.gt_profiles (name, sex, pass_hash)
    values (v_name, v_sex, case when coalesce(p_pass, '') = '' then null else crypt(p_pass, gen_salt('bf')) end)
    returning id, secret into v_id, v_secret;
  exception when unique_violation then
    raise exception 'name_taken';
  end;
  return json_build_object('id', v_id, 'secret', v_secret, 'name', v_name, 'sex', v_sex);
end;
$$;

-- ---------------------------------------------------------------- entrar (desde otro celular)
create or replace function public.gt_login(p_name text, p_pass text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare r public.gt_profiles%rowtype;
begin
  select * into r from public.gt_profiles where lower(name) = lower(btrim(coalesce(p_name, '')));
  if not found or r.pass_hash is null or coalesce(p_pass, '') = '' or r.pass_hash <> crypt(p_pass, r.pass_hash) then
    perform pg_sleep(0.6);               -- frena los intentos de adivinar contraseñas
    raise exception 'bad_login';
  end if;
  return json_build_object('id', r.id, 'secret', r.secret, 'name', r.name, 'sex', r.sex);
end;
$$;

-- ---------------------------------------------------------------- publicar / actualizar una marca
-- Claves permitidas: los 6 básicos o 'c:algo' para ejercicios de la comunidad.
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
  v_n     int;
begin
  select id into v_id from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  if p_weight is null or p_weight <= 0 or p_weight > 700 or p_reps is null or p_reps < 1 or p_reps > 30 then raise exception 'bad_values'; end if;
  if v_key not in ('banca', 'sentadilla', 'peso_muerto', 'press_militar', 'remo_barra', 'hip_thrust')
     and v_key !~ '^c:[a-z0-9_]{2,40}$' then raise exception 'bad_exercise'; end if;
  if char_length(v_ename) < 2 or char_length(v_ename) > 40 then raise exception 'bad_exercise'; end if;
  if v_ename !~ '^[[:alnum:] ._()/+-]+$' then raise exception 'bad_exercise'; end if;
  select count(*) into v_n from public.gt_scores where profile_id = v_id and exercise_key <> v_key;
  if v_n >= 40 then raise exception 'too_many'; end if;
  v_e := round(case when p_reps = 1 then p_weight else p_weight * (1 + p_reps / 30.0) end, 2);
  insert into public.gt_scores (profile_id, exercise_key, exercise_name, weight_kg, reps, e1rm)
  values (v_id, v_key, v_ename, p_weight, p_reps, v_e)
  on conflict (profile_id, exercise_key) do update
    set exercise_name = excluded.exercise_name, weight_kg = excluded.weight_kg, reps = excluded.reps,
        e1rm = excluded.e1rm, updated_at = now();
  return json_build_object('e1rm', v_e);
end;
$$;

-- ---------------------------------------------------------------- quitar una marca / borrar mi usuario
create or replace function public.gt_remove(p_secret uuid, p_key text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.gt_scores s using public.gt_profiles p
  where p.id = s.profile_id and p.secret = p_secret and s.exercise_key = lower(btrim(coalesce(p_key, '')));
end;
$$;

create or replace function public.gt_delete_me(p_secret uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  delete from public.gt_profiles where secret = p_secret;
end;
$$;

-- ---------------------------------------------------------------- lectura
-- Lista de una prueba. p_sex: 'M' (hombres), 'F' (mujeres) o null (mixto).
create or replace function public.gt_leaderboard(p_key text, p_sex text default null, p_limit int default 50)
returns table (rank bigint, name text, sex text, weight_kg numeric, reps int, e1rm numeric, updated_at timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select row_number() over (order by s.e1rm desc, s.updated_at asc) as rank,
         p.name, p.sex, s.weight_kg, s.reps, s.e1rm, s.updated_at
  from public.gt_scores s
  join public.gt_profiles p on p.id = s.profile_id
  where s.exercise_key = lower(btrim(coalesce(p_key, '')))
    and (p_sex is null or p.sex = p_sex)
  order by s.e1rm desc, s.updated_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- Pruebas con marcas publicadas (para el selector de "comunidad").
create or replace function public.gt_exercises()
returns table (exercise_key text, exercise_name text, athletes bigint)
language sql
security definer
set search_path = public, extensions
as $$
  select s.exercise_key, (array_agg(s.exercise_name order by s.updated_at desc))[1], count(*)
  from public.gt_scores s
  group by s.exercise_key
  order by count(*) desc, s.exercise_key
  limit 200;
$$;

-- Mis marcas publicadas.
create or replace function public.gt_my_scores(p_secret uuid)
returns table (exercise_key text, exercise_name text, weight_kg numeric, reps int, e1rm numeric, updated_at timestamptz)
language sql
security definer
set search_path = public, extensions
as $$
  select s.exercise_key, s.exercise_name, s.weight_kg, s.reps, s.e1rm, s.updated_at
  from public.gt_scores s join public.gt_profiles p on p.id = s.profile_id
  where p.secret = p_secret
  order by s.exercise_key;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function public.gt_register(text, text, text) from public;
revoke all on function public.gt_login(text, text) from public;
revoke all on function public.gt_publish(uuid, text, text, numeric, int) from public;
revoke all on function public.gt_remove(uuid, text) from public;
revoke all on function public.gt_delete_me(uuid) from public;
revoke all on function public.gt_leaderboard(text, text, int) from public;
revoke all on function public.gt_exercises() from public;
revoke all on function public.gt_my_scores(uuid) from public;

grant execute on function public.gt_register(text, text, text) to anon, authenticated;
grant execute on function public.gt_login(text, text) to anon, authenticated;
grant execute on function public.gt_publish(uuid, text, text, numeric, int) to anon, authenticated;
grant execute on function public.gt_remove(uuid, text) to anon, authenticated;
grant execute on function public.gt_delete_me(uuid) to anon, authenticated;
grant execute on function public.gt_leaderboard(text, text, int) to anon, authenticated;
grant execute on function public.gt_exercises() to anon, authenticated;
grant execute on function public.gt_my_scores(uuid) to anon, authenticated;
