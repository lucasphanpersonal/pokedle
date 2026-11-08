-- Hard mode (no Gen column) games send config.hard_mode = true. Keep them out of the
-- public daily stats, so the result screen compares normal games with normal games.
-- Games from older clients have no hard_mode key and count as normal. The raw events
-- (and the private analytics views) still include hard games; filter on
-- config->>'hard_mode' there if you want to split them.
create or replace function public.public_daily_stats(p_date date)
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

  select count(*) into n
  from public.events
  where event = 'game_finished' and mode = 'daily' and puzzle_date = p_date
    and coalesce(config->>'hard_mode', 'false') <> 'true';

  if n < 5 then
    return query select n, null::bigint, null::numeric, '{}'::jsonb;
    return;
  end if;

  return query
  with f as (
    select result, guess_count
    from public.events
    where event = 'game_finished' and mode = 'daily' and puzzle_date = p_date
      and coalesce(config->>'hard_mode', 'false') <> 'true'
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

revoke all on function public.public_daily_stats(date) from public;
grant execute on function public.public_daily_stats(date) to anon, authenticated, service_role;
