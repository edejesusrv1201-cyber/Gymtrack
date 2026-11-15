-- ============================================================
--  MyGymTrack · Feedback desde la app (Supabase)
--  Pega esto en SQL Editor → Run. Se puede correr más de una vez.
--  Los mensajes se ven en Table Editor → gt_feedback.
-- ============================================================
create table if not exists public.gt_feedback (
  id          bigserial primary key,
  created_at  timestamptz not null default now(),
  kind        text,
  message     text not null,
  app_version text,
  device      text,
  name        text
);
alter table public.gt_feedback enable row level security;   -- sin políticas: nadie lee ni escribe directo

create or replace function public.gt_send_feedback(p_kind text, p_message text, p_version text, p_device text, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_message is null or char_length(trim(p_message)) < 3 or char_length(p_message) > 2000 then raise exception 'bad_values'; end if;
  -- freno básico contra abuso: máximo 30 mensajes por minuto en total
  if (select count(*) from public.gt_feedback where created_at > now() - interval '1 minute') >= 30 then raise exception 'too_many'; end if;
  insert into public.gt_feedback (kind, message, app_version, device, name)
  values (left(coalesce(p_kind, ''), 20), left(p_message, 2000), left(coalesce(p_version, ''), 20), left(coalesce(p_device, ''), 240), left(coalesce(p_name, ''), 40));
end;
$$;
revoke all on function public.gt_send_feedback(text, text, text, text, text) from public;
grant execute on function public.gt_send_feedback(text, text, text, text, text) to anon, authenticated;
