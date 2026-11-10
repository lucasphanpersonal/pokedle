-- Two abuse fixes.
--
-- 1. Public stats poisoning: public_daily_stats() counted every game_finished row, so one visitor
--    could post thousands of fake Daily finishes and skew the result-screen panel. It now counts at
--    most ONE finished game per visitor_hash per puzzle date (within the normal/hard split): the
--    visitor's earliest row (received_at, ties broken by id), so the pick is deterministic.
--    visitor_hash rotates daily (daily salt), so this is a per-day cap, which is enough here.
--
-- 2. Flood cap bypass: the per-visitor cap is keyed on salt|IP|user agent, so rotating the User-Agent
--    gave unlimited budget. events gets an ip_hash (salted sha256 of the IP alone, rotating daily
--    like visitor_hash, never the raw IP) that the track function counts against a second, higher cap.
--    It lives in events, so it is deleted with the raw events by rollup_old_events().
alter table public.events
  add column if not exists ip_hash text check (char_length(ip_hash) = 64);

create index if not exists events_ip_received_idx on public.events (ip_hash, received_at);

create or replace function public.public_daily_stats(p_date date, p_hard boolean default false)
returns table (games_finished bigint, wins bigint, solve_rate numeric, histogram jsonb)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'utc')::date;
  n bigint;
begin
  if p_date is null or p_date < today - 400 or p_date > today + 1 then
    raise exception 'date out of range' using errcode = '22023';
  end if;

  -- One finished game per visitor: the earliest by received_at, then id.
  select count(*) into n
  from (
    select distinct on (visitor_hash) visitor_hash
    from public.events
    where event = 'game_finished' and mode = 'daily' and puzzle_date = p_date
      and (coalesce(config->>'hard_mode', 'false') = 'true') = coalesce(p_hard, false)
    order by visitor_hash, received_at, id
  ) d;

  if n < 5 then
    return query select n, null::bigint, null::numeric, '{}'::jsonb;
    return;
  end if;

  return query
  with f as (
    select distinct on (visitor_hash) result, guess_count
    from public.events
    where event = 'game_finished' and mode = 'daily' and puzzle_date = p_date
      and (coalesce(config->>'hard_mode', 'false') = 'true') = coalesce(p_hard, false)
    order by visitor_hash, received_at, id
  ),
  h as (
    select coalesce(guess_count::text, 'lost') as k, count(*) as c
    from (select case when result = 'won' then guess_count end as guess_count from f) x
    group by 1
  )
  select
    n,
    (select count(*) from f where result = 'won'),
    round((select count(*) from f where result = 'won')::numeric / n, 4),
    coalesce((select jsonb_object_agg(k, c) from h), '{}'::jsonb);
end;
$$;

revoke all on function public.public_daily_stats(date, boolean) from public;
grant execute on function public.public_daily_stats(date, boolean) to anon, authenticated, service_role;
