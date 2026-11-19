-- ============================================================
--  MyGymTrack · Liga de amigos (Supabase)
--  Pega TODO esto en Supabase → SQL Editor → New query → Run.
--  Se puede correr más de una vez sin problema. No toca lo que ya existe.
--
--  Cómo funciona:
--   · Cada usuario del ranking tiene un CÓDIGO DE AMIGO de 6 letras/números.
--   · Quien escribe tu código te agrega (y tú a él): amistad de las dos partes.
--   · Cada celular publica su XP de la semana; la liga muestra solo a ti y a tus amigos.
--   · Lo único que ven tus amigos: tu nombre, nivel, XP de la semana, entrenos,
--     días activos y minutos de deporte. Nada de comidas, medidas ni fotos.
--   · Todo pasa por funciones que validan con el "secreto" del usuario.
-- ============================================================

alter table public.gt_profiles add column if not exists friend_code text;
create unique index if not exists gt_profiles_friend_code_key on public.gt_profiles (friend_code);

create table if not exists public.gt_friends (
  a          uuid not null references public.gt_profiles (id) on delete cascade,
  b          uuid not null references public.gt_profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (a, b),
  check (a <> b)
);
create index if not exists gt_friends_b on public.gt_friends (b);

create table if not exists public.gt_week_xp (
  profile_id uuid not null references public.gt_profiles (id) on delete cascade,
  week_start date not null,
  xp         int  not null check (xp >= 0 and xp <= 20000),
  sessions   int  not null default 0 check (sessions between 0 and 50),
  days       int  not null default 0 check (days between 0 and 7),
  sport_min  int  not null default 0 check (sport_min between 0 and 5000),
  level      int  not null default 1 check (level between 1 and 200),
  title      text,
  updated_at timestamptz not null default now(),
  primary key (profile_id, week_start)
);

alter table public.gt_friends enable row level security;
alter table public.gt_week_xp enable row level security;
revoke all on public.gt_friends from anon, authenticated;
revoke all on public.gt_week_xp from anon, authenticated;

-- ---------------------------------------------------------------- mi código de amigo
create or replace function public.gt_my_friend_code(p_secret uuid)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id    uuid;
  v_code  text;
  v_alpha text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_try   int := 0;
begin
  select id, friend_code into v_id, v_code from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  if v_code is not null then return v_code; end if;
  loop
    v_try := v_try + 1;
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alpha, 1 + floor(random() * length(v_alpha))::int, 1);
    end loop;
    begin
      update public.gt_profiles set friend_code = v_code where id = v_id and friend_code is null;
      exit;
    exception when unique_violation then
      if v_try >= 10 then raise exception 'try_again'; end if;
    end;
  end loop;
  select friend_code into v_code from public.gt_profiles where id = v_id;
  return v_code;
end;
$$;

-- ---------------------------------------------------------------- agregar amigo por código
create or replace function public.gt_add_friend(p_secret uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id   uuid;
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_fid  uuid;
  v_name text;
  v_n    int;
begin
  select id into v_id from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  if v_code !~ '^[A-Z0-9]{6}$' then perform pg_sleep(0.4); raise exception 'friend_code_bad'; end if;
  select id, name into v_fid, v_name from public.gt_profiles where friend_code = v_code;
  if v_fid is null then perform pg_sleep(0.4); raise exception 'friend_code_bad'; end if;
  if v_fid = v_id then raise exception 'friend_self'; end if;
  if exists (select 1 from public.gt_friends where a = v_id and b = v_fid) then
    return json_build_object('id', v_fid, 'name', v_name, 'already', true);
  end if;
  select count(*) into v_n from public.gt_friends where a = v_id;
  if v_n >= 50 then raise exception 'friend_limit'; end if;
  insert into public.gt_friends (a, b) values (v_id, v_fid) on conflict do nothing;
  insert into public.gt_friends (a, b) values (v_fid, v_id) on conflict do nothing;
  return json_build_object('id', v_fid, 'name', v_name, 'already', false);
end;
$$;

-- ---------------------------------------------------------------- quitar amigo
create or replace function public.gt_remove_friend(p_secret uuid, p_friend uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  select id into v_id from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  delete from public.gt_friends where (a = v_id and b = p_friend) or (a = p_friend and b = v_id);
end;
$$;

-- ---------------------------------------------------------------- publicar mi semana
create or replace function public.gt_publish_week(
  p_secret uuid, p_week date, p_xp int, p_sessions int, p_days int, p_sport_min int, p_level int, p_title text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid;
begin
  select id into v_id from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  if p_week is null or extract(dow from p_week) <> 0 or p_week < current_date - 14 or p_week > current_date + 1 then raise exception 'bad_week'; end if;
  if coalesce(p_xp, -1) < 0 or p_xp > 20000 or coalesce(p_sessions, -1) not between 0 and 50
     or coalesce(p_days, -1) not between 0 and 7 or coalesce(p_sport_min, -1) not between 0 and 5000
     or coalesce(p_level, 0) not between 1 and 200 then raise exception 'bad_values'; end if;
  insert into public.gt_week_xp (profile_id, week_start, xp, sessions, days, sport_min, level, title, updated_at)
  values (v_id, p_week, p_xp, p_sessions, p_days, p_sport_min, p_level, left(regexp_replace(coalesce(p_title, ''), '[^[:alnum:] ]', '', 'g'), 20), now())
  on conflict (profile_id, week_start) do update
    set xp = excluded.xp, sessions = excluded.sessions, days = excluded.days, sport_min = excluded.sport_min,
        level = excluded.level, title = excluded.title, updated_at = now();
end;
$$;

-- ---------------------------------------------------------------- liga: yo + mis amigos
create or replace function public.gt_friends_board(p_secret uuid, p_week date)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare v_id uuid; v_out json;
begin
  select id into v_id from public.gt_profiles where secret = p_secret;
  if v_id is null then raise exception 'not_auth'; end if;
  select coalesce(json_agg(r order by r.xp desc, r.name), '[]'::json) into v_out from (
    select p.id, p.name, coalesce(w.xp, 0) as xp, coalesce(w.sessions, 0) as sessions, coalesce(w.days, 0) as days,
           coalesce(w.sport_min, 0) as sport_min, coalesce(w.level, 1) as level, w.title, (p.id = v_id) as me
    from public.gt_profiles p
    left join public.gt_week_xp w on w.profile_id = p.id and w.week_start = p_week
    where p.id = v_id or p.id in (select b from public.gt_friends where a = v_id)
  ) r;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------- permisos
revoke all on function public.gt_my_friend_code(uuid) from public;
revoke all on function public.gt_add_friend(uuid, text) from public;
revoke all on function public.gt_remove_friend(uuid, uuid) from public;
revoke all on function public.gt_publish_week(uuid, date, int, int, int, int, int, text) from public;
revoke all on function public.gt_friends_board(uuid, date) from public;
grant execute on function public.gt_my_friend_code(uuid) to anon, authenticated;
grant execute on function public.gt_add_friend(uuid, text) to anon, authenticated;
grant execute on function public.gt_remove_friend(uuid, uuid) to anon, authenticated;
grant execute on function public.gt_publish_week(uuid, date, int, int, int, int, int, text) to anon, authenticated;
grant execute on function public.gt_friends_board(uuid, date) to anon, authenticated;
