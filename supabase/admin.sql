-- ============================================================
-- MyGymTrack · panel de administración (v67)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo.
-- Solo las cuentas listadas en gt_admins pueden leer comentarios y
-- ver el resumen. NO expone el contenido de las copias de nadie.
-- Para añadir a otra persona administradora:
--   insert into public.gt_admins (user_id) select id from auth.users where email = 'correo@ejemplo.com';
-- ============================================================
create table if not exists public.gt_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.gt_admins enable row level security;
revoke all on public.gt_admins from anon, authenticated;

alter table public.gt_feedback add column if not exists done boolean not null default false;

create or replace function public.gt_is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.gt_admins where user_id = auth.uid());
$$;
revoke all on function public.gt_is_admin() from public, anon;
grant execute on function public.gt_is_admin() to authenticated;

create or replace function public.gt_admin_feedback(p_only_open boolean default true, p_limit integer default 100)
returns table (id bigint, created_at timestamptz, kind text, message text, app_version text, device text, name text, done boolean)
language plpgsql security definer set search_path = public as $$
begin
  if not public.gt_is_admin() then raise exception 'not_admin'; end if;
  return query
    select f.id, f.created_at, f.kind, f.message, f.app_version, f.device, f.name, f.done
    from public.gt_feedback f
    where (not p_only_open) or (not f.done)
    order by f.created_at desc
    limit least(greatest(coalesce(p_limit, 100), 1), 300);
end $$;
revoke all on function public.gt_admin_feedback(boolean, integer) from public, anon;
grant execute on function public.gt_admin_feedback(boolean, integer) to authenticated;

create or replace function public.gt_admin_feedback_mark(p_id bigint, p_done boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.gt_is_admin() then raise exception 'not_admin'; end if;
  update public.gt_feedback set done = coalesce(p_done, true) where id = p_id;
end $$;
revoke all on function public.gt_admin_feedback_mark(bigint, boolean) from public, anon;
grant execute on function public.gt_admin_feedback_mark(bigint, boolean) to authenticated;

create or replace function public.gt_admin_feedback_delete(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.gt_is_admin() then raise exception 'not_admin'; end if;
  delete from public.gt_feedback where id = p_id;
end $$;
revoke all on function public.gt_admin_feedback_delete(bigint) from public, anon;
grant execute on function public.gt_admin_feedback_delete(bigint) to authenticated;

-- números generales (sin contenido de nadie)
create or replace function public.gt_admin_stats() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.gt_is_admin() then raise exception 'not_admin'; end if;
  return jsonb_build_object(
    'users', (select count(*) from auth.users),
    'confirmed', (select count(*) from auth.users where email_confirmed_at is not null),
    'backups', (select count(*) from public.gt_cloud_backup),
    'last_backup', (select max(updated_at) from public.gt_cloud_backup),
    'ranking_users', (select count(*) from public.gt_profiles),
    'scores', (select count(*) from public.gt_scores),
    'feedback_open', (select count(*) from public.gt_feedback where not done),
    'feedback_total', (select count(*) from public.gt_feedback)
  );
end $$;
revoke all on function public.gt_admin_stats() from public, anon;
grant execute on function public.gt_admin_stats() to authenticated;

-- personas con cuenta: correo parcial y estado de su copia (no el contenido)
create or replace function public.gt_admin_users()
returns table (mail text, created_at timestamptz, confirmed boolean, last_sign_in timestamptz, backup_at timestamptz, backup_kb integer, device text)
language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.gt_is_admin() then raise exception 'not_admin'; end if;
  return query
    select left(u.email, 3) || '***@' || split_part(u.email, '@', 2), u.created_at, u.email_confirmed_at is not null, u.last_sign_in_at,
           b.updated_at, (b.size / 1024)::integer, b.device
    from auth.users u left join public.gt_cloud_backup b on b.user_id = u.id
    order by u.created_at desc limit 200;
end $$;
revoke all on function public.gt_admin_users() from public, anon;
grant execute on function public.gt_admin_users() to authenticated;
