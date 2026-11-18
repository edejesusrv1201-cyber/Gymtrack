-- ============================================================
-- MyGymTrack · búsqueda de alimentos por nombre (v66)
-- Ejecutar UNA vez en Supabase → SQL Editor. Es seguro repetirlo.
-- Open Food Facts no permite buscar desde el navegador (sin CORS),
-- así que el servidor busca por ti: solo personas con cuenta, resultados
-- guardados 7 días y tope de 40 búsquedas por hora y persona.
-- Solo se envía el texto escrito, nada más.
-- ============================================================
create extension if not exists http with schema extensions;

create table if not exists public.gt_food_cache (
  q          text primary key,
  result     jsonb not null,
  fetched_at timestamptz not null default now()
);
create table if not exists public.gt_food_log (
  user_id uuid not null,
  at      timestamptz not null default now()
);
create index if not exists gt_food_log_idx on public.gt_food_log (user_id, at desc);
alter table public.gt_food_cache enable row level security;
alter table public.gt_food_log enable row level security;
revoke all on public.gt_food_cache from anon, authenticated;
revoke all on public.gt_food_log from anon, authenticated;

create or replace function public.gt_food_search(p_q text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  qn text := left(lower(trim(coalesce(p_q, ''))), 60);
  r jsonb;
  resp extensions.http_response;
  n int;
begin
  if auth.uid() is null then raise exception 'not_auth'; end if;
  if length(qn) < 3 then raise exception 'bad_query'; end if;
  select result into r from public.gt_food_cache where q = qn and fetched_at > now() - interval '7 days';
  if r is not null then return r; end if;
  select count(*) into n from public.gt_food_log where user_id = auth.uid() and at > now() - interval '1 hour';
  if n >= 40 then raise exception 'too_many_searches'; end if;
  insert into public.gt_food_log (user_id) values (auth.uid());
  delete from public.gt_food_log where at < now() - interval '2 days';
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '6');
  resp := extensions.http((
    'GET',
    'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' || extensions.urlencode(qn) || '&search_simple=1&action=process&json=1&page_size=24&lc=es&fields=code,product_name,product_name_es,brands,nutriments,serving_size,serving_quantity',
    array[extensions.http_header('User-Agent', 'MyGymTrack/1.0 (app de entrenamiento)')],
    null, null
  )::extensions.http_request);
  if resp.status <> 200 then raise exception 'upstream_busy'; end if;
  r := coalesce((resp.content::jsonb) -> 'products', '[]'::jsonb);
  insert into public.gt_food_cache (q, result, fetched_at) values (qn, r, now())
    on conflict (q) do update set result = excluded.result, fetched_at = now();
  return r;
end $$;
revoke all on function public.gt_food_search(text) from public, anon;
grant execute on function public.gt_food_search(text) to authenticated;
