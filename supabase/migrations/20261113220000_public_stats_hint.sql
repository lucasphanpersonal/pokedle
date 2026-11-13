-- One mode for everyone: Hard mode is gone, the Gen column is gone, and players can instead take an
-- optional Gen hint after 5 guesses (config.hint_used = true on their events).
--
-- public_daily_stats() loses its p_hard split: every Daily counts together, including games from
-- when Hard mode existed (config.hard_mode is ignored; those players had no Gen at all, so they count
-- as games without the hint). It gains `hinted`, the finished games that used the hint, so the result
-- screen can say what share of players took it.
--
-- The 5-game threshold is also gone: the result screen always shows today's totals, even when you
-- are the first to finish. They are still aggregates only (counts and a guesses histogram, one game
-- per network per puzzle, never the answer or anything per player).
drop function if exists public.public_daily_stats(date, boolean);
drop function if exists public.public_daily_stats(date);

create function public.public_daily_stats(p_date date)
returns table (games_finished bigint, wins bigint, solve_rate numeric, histogram jsonb, hinted bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'utc')::date;
begin
  if p_date is null or p_date < today - 400 or p_date > today + 1 then
    raise exception 'date out of range' using errcode = '22023';
  end if;

  return query
  -- One finished game per network (ip_hash, else visitor_hash): the earliest by received_at, then id.
  with f as (
    select distinct on (coalesce(ip_hash, visitor_hash)) result, guess_count,
      coalesce(config->>'hint_used', 'false') = 'true' as hint
    from public.events
    where event = 'game_finished' and mode = 'daily' and puzzle_date = p_date
    order by coalesce(ip_hash, visitor_hash), received_at, id
  ),
  h as (
    select coalesce(guess_count::text, 'lost') as k, count(*) as c
    from (select case when result = 'won' then guess_count end as guess_count from f) x
    group by 1
  )
  select
    (select count(*) from f),
    (select count(*) from f where result = 'won'),
    case when (select count(*) from f) = 0 then null
      else round((select count(*) from f where result = 'won')::numeric / (select count(*) from f), 4) end,
    coalesce((select jsonb_object_agg(k, c) from h), '{}'::jsonb),
    (select count(*) from f where hint);
end;
$$;

revoke all on function public.public_daily_stats(date) from public;
grant execute on function public.public_daily_stats(date) to anon, authenticated, service_role;
