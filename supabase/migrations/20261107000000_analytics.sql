-- Pokedle player analytics.
-- All tables are locked down (RLS on, no policies, no anon/authenticated grants).
-- Only the service role (used by the `track` Edge Function) and the postgres
-- owner (SQL editor, pg_cron) can touch them.

-- ---------------------------------------------------------------- events ----
create table public.events (
  id            bigint generated always as identity primary key,
  event         text        not null check (event in ('game_started', 'guess_made', 'game_finished')),
  game_id       uuid        not null,
  mode          text        not null check (mode in ('daily', 'endless')),
  puzzle_date   date,
  target_id     int         not null check (target_id between 1 and 100000),
  guess_id      int         check (guess_id between 1 and 100000),
  guess_number  smallint    check (guess_number between 1 and 50),
  is_correct    boolean,
  result        text        check (result in ('won', 'lost')),
  guess_count   smallint    check (guess_count between 1 and 50),
  streak        int         check (streak between 0 and 100000),
  duration_s    int         check (duration_s between 0 and 86400),
  device        text        not null check (device in ('phone', 'tablet', 'desktop')),
  app_version   text        check (char_length(app_version) <= 32),
  config        jsonb       not null default '{}'::jsonb check (jsonb_typeof(config) = 'object'),
  visitor_hash  text        not null check (char_length(visitor_hash) = 64),
  received_at   timestamptz not null default now(),

  constraint events_puzzle_date_matches_mode check (
    (mode = 'daily'   and puzzle_date is not null) or
    (mode = 'endless' and puzzle_date is null)
  )
);

create index events_received_at_idx on public.events (received_at);
create index events_puzzle_date_idx on public.events (puzzle_date);
create index events_event_guess_id_idx on public.events (event, guess_id);
create index events_game_id_idx on public.events (game_id);
create index events_visitor_received_idx on public.events (visitor_hash, received_at);

-- ----------------------------------------------------------- daily_salts ----
-- Rotating salt for visitor_hash. Used only by the function; deleted after 2 days
-- so old hashes can no longer be linked to anyone.
create table public.daily_salts (
  day  date primary key,
  salt text not null
);

-- ---------------------------------------------------------- daily_totals ----
-- Long-term roll-up of events older than the retention window.
create table public.daily_totals (
  day             date   not null,
  mode            text   not null check (mode in ('daily', 'endless')),
  players         int    not null default 0,  -- distinct visitor_hash that day
  games_started   int    not null default 0,
  games_finished  int    not null default 0,
  wins            int    not null default 0,
  total_guesses   bigint not null default 0,  -- sum of guess_count over finished games
  primary key (day, mode)
);

-- -------------------------------------------------------------- lockdown ----
alter table public.events       enable row level security;
alter table public.daily_salts  enable row level security;
alter table public.daily_totals enable row level security;
-- Intentionally no policies: anon/authenticated see nothing. service_role bypasses RLS.

revoke all on public.events       from anon, authenticated;
revoke all on public.daily_salts  from anon, authenticated;
revoke all on public.daily_totals from anon, authenticated;
revoke all on sequence public.events_id_seq from anon, authenticated;

grant select, insert on public.events      to service_role;
grant select, insert on public.daily_salts to service_role;
grant usage on sequence public.events_id_seq to service_role;

-- ---------------------------------------------------------------- rollup ----
-- Aggregates whole UTC days older than `retention` into daily_totals, deletes the
-- raw events, and drops salts older than 2 days. Safe to re-run.
create or replace function public.rollup_old_events(retention interval default interval '6 months')
returns void
language plpgsql
set search_path = public, pg_temp
as $$
declare
  cutoff timestamptz := date_trunc('day', (now() at time zone 'utc') - retention) at time zone 'utc';
begin
  insert into public.daily_totals as t (day, mode, players, games_started, games_finished, wins, total_guesses)
  select
    (received_at at time zone 'utc')::date,
    mode,
    count(distinct visitor_hash),
    count(*) filter (where event = 'game_started'),
    count(*) filter (where event = 'game_finished'),
    count(*) filter (where event = 'game_finished' and result = 'won'),
    coalesce(sum(guess_count) filter (where event = 'game_finished'), 0)
  from public.events
  where received_at < cutoff
  group by 1, 2
  on conflict (day, mode) do update set
    players        = t.players        + excluded.players,
    games_started  = t.games_started  + excluded.games_started,
    games_finished = t.games_finished + excluded.games_finished,
    wins           = t.wins           + excluded.wins,
    total_guesses  = t.total_guesses  + excluded.total_guesses;

  delete from public.events where received_at < cutoff;
  delete from public.daily_salts where day < (now() at time zone 'utc')::date - 2;
end;
$$;

revoke all on function public.rollup_old_events(interval) from public, anon, authenticated;

-- Schedule daily at 03:15 UTC if pg_cron can be enabled; never fail the migration.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('pokedle-rollup', '15 3 * * *', 'select public.rollup_old_events()');
exception when others then
  raise notice 'pg_cron unavailable (%); schedule public.rollup_old_events() manually', sqlerrm;
end;
$$;

-- ----------------------------------------------------------------- views ----
-- Private analysis views. security_invoker so they run with the caller's rights
-- (anon has none). Read them from the SQL editor / service role.

create view public.daily_players with (security_invoker = true) as
select
  (received_at at time zone 'utc')::date as day,
  mode,
  count(distinct visitor_hash) as players
from public.events
group by 1, 2;

create view public.daily_puzzle_stats with (security_invoker = true) as
select
  puzzle_date,
  target_id,
  count(*) as games,
  count(*) filter (where result = 'won') as wins,
  round(count(*) filter (where result = 'won')::numeric / nullif(count(*), 0), 4) as solve_rate,
  round(avg(guess_count) filter (where result = 'won'), 2) as avg_guesses_to_win
from public.events
where event = 'game_finished' and mode = 'daily'
group by puzzle_date, target_id;

create view public.guess_histogram with (security_invoker = true) as
select mode, guess_count, count(*) as games
from public.events
where event = 'game_finished' and result = 'won'
group by mode, guess_count;

create view public.top_guesses with (security_invoker = true) as
select guess_id, count(*) as times_guessed
from public.events
where event = 'guess_made'
group by guess_id
order by times_guessed desc, guess_id
limit 50;

create view public.top_first_guesses with (security_invoker = true) as
select guess_id, count(*) as times_guessed
from public.events
where event = 'guess_made' and guess_number = 1
group by guess_id
order by times_guessed desc, guess_id
limit 50;

create view public.mode_split with (security_invoker = true) as
select
  mode,
  count(*) as games_started,
  round(count(*)::numeric / nullif(sum(count(*)) over (), 0), 4) as share
from public.events
where event = 'game_started'
group by mode;

create view public.streak_share with (security_invoker = true) as
select
  (received_at at time zone 'utc')::date as day,
  count(*) as finishers,
  count(*) filter (where streak >= 2) as with_streak,
  round(count(*) filter (where streak >= 2)::numeric / nullif(count(*), 0), 4) as share
from public.events
where event = 'game_finished'
group by 1;

revoke all on public.daily_players, public.daily_puzzle_stats, public.guess_histogram,
  public.top_guesses, public.top_first_guesses, public.mode_split, public.streak_share
  from anon, authenticated;

-- ---------------------------------------------------- public aggregate API ----
-- Aggregate-only stats for one daily puzzle, callable by anon (for a future
-- in-game "global stats" panel). Never returns target_id or anything per-player.
-- histogram: {"1": n, "2": n, ..., "lost": n}
create or replace function public.public_daily_stats(p_date date)
returns table (games_finished bigint, wins bigint, solve_rate numeric, histogram jsonb)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  with f as (
    select result, guess_count
    from public.events
    where event = 'game_finished' and mode = 'daily' and puzzle_date = p_date
  ),
  h as (
    select coalesce(guess_count::text, 'lost') as k, count(*) as n
    from (select case when result = 'won' then guess_count end as guess_count from f) x
    group by 1
  )
  select
    (select count(*) from f),
    (select count(*) from f where result = 'won'),
    round((select count(*) from f where result = 'won')::numeric / nullif((select count(*) from f), 0), 4),
    coalesce((select jsonb_object_agg(k, n) from h), '{}'::jsonb);
$$;

revoke all on function public.public_daily_stats(date) from public;
grant execute on function public.public_daily_stats(date) to anon, authenticated, service_role;
