-- ============================================================
-- MyGymTrack · cuentas y respaldo en la nube (v56)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo.
-- Requiere Authentication → Providers → Email activado.
-- ============================================================

create table if not exists public.gt_cloud_backup (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null,
  updated_at timestamptz not null default now(),
  device     text,
  size       integer
);

alter table public.gt_cloud_backup enable row level security;

-- cada persona solo ve y toca su propia fila
drop policy if exists gt_cloud_select on public.gt_cloud_backup;
drop policy if exists gt_cloud_insert on public.gt_cloud_backup;
drop policy if exists gt_cloud_update on public.gt_cloud_backup;
drop policy if exists gt_cloud_delete on public.gt_cloud_backup;
create policy gt_cloud_select on public.gt_cloud_backup for select to authenticated using (auth.uid() = user_id);
create policy gt_cloud_insert on public.gt_cloud_backup for insert to authenticated with check (auth.uid() = user_id);
create policy gt_cloud_update on public.gt_cloud_backup for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy gt_cloud_delete on public.gt_cloud_backup for delete to authenticated using (auth.uid() = user_id);

revoke all on public.gt_cloud_backup from anon;
grant select, insert, update, delete on public.gt_cloud_backup to authenticated;

-- la hora la pone el servidor (no el celular), para comparar versiones sin errores de reloj
create or replace function public.gt_cloud_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then new.user_id := old.user_id; end if;
  return new;
end $$;

drop trigger if exists gt_cloud_touch on public.gt_cloud_backup;
create trigger gt_cloud_touch before insert or update on public.gt_cloud_backup
  for each row execute function public.gt_cloud_touch();

-- tope de tamaño (8 MB) para que nadie llene la base por error
alter table public.gt_cloud_backup drop constraint if exists gt_cloud_size_ok;
alter table public.gt_cloud_backup add constraint gt_cloud_size_ok check (coalesce(size, 0) <= 8000000);

-- "Borrar mi cuenta": elimina al usuario y, en cascada, su respaldo
create or replace function public.gt_cloud_delete_me() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_auth'; end if;
  delete from auth.users where id = auth.uid();
end $$;

revoke all on function public.gt_cloud_delete_me() from public, anon;
grant execute on function public.gt_cloud_delete_me() to authenticated;
