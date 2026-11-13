-- Pokémondle game stats: ready-made, read-only queries for the Supabase SQL Editor.
--
-- HOW TO USE: the SQL Editor shows only the LAST result of whatever you run, so paste ONE query
-- at a time (everything between two "=====" lines), run it, and use Save to keep it as a saved
-- query (name it after the "Q#" title). Every query is a plain SELECT; none of them change data.
--
-- NOTES
--  * Day boundaries are America/New_York ("ET"), based on when the event was received. Daily
--    puzzle rows use puzzle_date (the player's local puzzle day) where noted.
--  * target_id / guess_id are National Dex numbers (25 = Pikachu).
--  * "Players" = distinct visitor_hash. It rotates every UTC day and is never a device id, so it
--    counts unique players PER DAY; summing days over-counts people who return. The salt changes at
--    UTC midnight (7-8pm ET), so someone playing across it can count twice in one ET day.
--  * Raw events are kept 6 months; older days exist only in daily_totals (see Q9).
--  * Hard mode games carry config->>'hard_mode' = 'true'. Q1/Q2 split it out as a plain column.
--  * "Last 30 days" is a rolling window, so the oldest day shown is partial.
--  * The client doesn't send streaks yet, so there is no streak query.
--  * Results: finished games have result 'won' or 'lost' (Endless "give up" counts as lost).


-- =====================================================================================
-- Q1 Today: players, games, wins, losses and average guesses (Daily and Endless separately)
-- Shows today's (ET) activity per mode. avg_guesses_to_win only counts won games.
-- =====================================================================================
select
  mode,
  count(distinct visitor_hash)                                     as players,
  count(*) filter (where event = 'game_started')                   as games_started,
  count(*) filter (where event = 'game_finished')                  as games_finished,
  count(*) filter (where event = 'game_finished' and result = 'won')  as wins,
  count(*) filter (where event = 'game_finished' and result = 'lost') as losses,
  round(100.0 * count(*) filter (where event = 'game_finished' and result = 'won')
        / nullif(count(*) filter (where event = 'game_finished'), 0), 1) as win_pct,
  round(avg(guess_count) filter (where event = 'game_finished' and result = 'won'), 2) as avg_guesses_to_win,
  count(*) filter (where event = 'game_finished' and config->>'hard_mode' = 'true') as hard_games_finished
from public.events
where (received_at at time zone 'America/New_York')::date = (now() at time zone 'America/New_York')::date
group by mode
order by mode;


-- =====================================================================================
-- Q2 Last 30 days, day by day (change 30 to 7 for the last week)
-- One row per ET day and mode: players, games, wins, win rate and average guesses.
-- =====================================================================================
select
  (received_at at time zone 'America/New_York')::date               as day,
  mode,
  count(distinct visitor_hash)                                      as players,
  count(*) filter (where event = 'game_started')                    as games_started,
  count(*) filter (where event = 'game_finished')                   as games_finished,
  count(*) filter (where event = 'game_finished' and result = 'won') as wins,
  round(100.0 * count(*) filter (where event = 'game_finished' and result = 'won')
        / nullif(count(*) filter (where event = 'game_finished'), 0), 1) as win_pct,
  round(avg(guess_count) filter (where event = 'game_finished' and result = 'won'), 2) as avg_guesses_to_win,
  count(*) filter (where event = 'game_finished' and config->>'hard_mode' = 'true') as hard_games_finished
from public.events
where received_at >= now() - interval '30 days'
group by 1, 2
order by day desc, mode;


-- =====================================================================================
-- Q3 Players per day, both modes combined, plus the Daily / Endless split (last 30 days)
-- "players_any" counts a person once even if they played both modes that day.
-- =====================================================================================
select
  (received_at at time zone 'America/New_York')::date               as day,
  count(distinct visitor_hash)                                      as players_any,
  count(distinct visitor_hash) filter (where mode = 'daily')        as daily_players,
  count(distinct visitor_hash) filter (where mode = 'endless')      as endless_players,
  count(distinct visitor_hash) filter (where event = 'game_finished') as players_who_finished
from public.events
where received_at >= now() - interval '30 days'
group by 1
order by day desc;


-- =====================================================================================
-- Q4 Guess-count distribution: how many guesses winners needed (all time, per mode)
-- Rows are guess counts (1, 2, 3 ...), columns are Daily vs Endless wins. Losses are the last row.
-- =====================================================================================
select
  coalesce(guess_count::text, 'lost')                               as guesses,
  count(*) filter (where mode = 'daily')                            as daily_games,
  count(*) filter (where mode = 'endless')                          as endless_games
from (
  select mode, case when result = 'won' then guess_count end as guess_count
  from public.events
  where event = 'game_finished'
) f
group by guess_count
order by guess_count nulls last;


-- =====================================================================================
-- Q5 Most-guessed Pokémon: top 25 by Dex number
-- times_guessed = every guess; opening_guesses = how many of those were guess #1 of a game.
-- =====================================================================================
select
  guess_id                                                          as dex_number,
  count(*)                                                          as times_guessed,
  count(*) filter (where guess_number = 1)                          as opening_guesses
from public.events
where event = 'guess_made'
group by guess_id
order by times_guessed desc, guess_id
limit 25;


-- =====================================================================================
-- Q6 Hardest Daily answers: lowest win rate first (puzzles with at least 5 finished games)
-- One row per daily puzzle. Look up the dex_number in a Pokédex to see the answer.
-- =====================================================================================
select
  puzzle_date,
  target_id                                                         as dex_number,
  count(*)                                                          as games_finished,
  count(*) filter (where result = 'won')                            as wins,
  round(100.0 * count(*) filter (where result = 'won') / count(*), 1) as win_pct,
  round(avg(guess_count), 2)                                        as avg_guesses_all_games,
  round(avg(guess_count) filter (where result = 'won'), 2)          as avg_guesses_to_win
from public.events
where event = 'game_finished' and mode = 'daily'
group by puzzle_date, target_id
having count(*) >= 5
order by win_pct asc, games_finished desc
limit 25;


-- =====================================================================================
-- Q7 Hardest Pokémon in Endless: lowest win rate first (answers with at least 5 finished games)
-- In Endless a loss is a give-up, so this shows which Pokémon people give up on most.
-- =====================================================================================
select
  target_id                                                         as dex_number,
  count(*)                                                          as games_finished,
  count(*) filter (where result = 'lost')                           as given_up,
  round(100.0 * count(*) filter (where result = 'won') / count(*), 1) as win_pct,
  round(avg(guess_count) filter (where result = 'won'), 2)          as avg_guesses_to_win
from public.events
where event = 'game_finished' and mode = 'endless'
group by target_id
having count(*) >= 5
order by win_pct asc, games_finished desc
limit 25;


-- =====================================================================================
-- Q8 Funnel and devices: how many started a game vs finished one, by device (last 30 days)
-- finish_pct is a rough "did people stick around" measure.
-- =====================================================================================
select
  device,
  count(*) filter (where event = 'game_started')                    as games_started,
  count(*) filter (where event = 'game_finished')                   as games_finished,
  round(100.0 * count(*) filter (where event = 'game_finished')
        / nullif(count(*) filter (where event = 'game_started'), 0), 1) as finish_pct,
  round(avg(duration_s) filter (where event = 'game_finished' and result = 'won') / 60.0, 1) as avg_minutes_to_win
from public.events
where received_at >= now() - interval '30 days'
group by device
order by games_started desc;


-- =====================================================================================
-- Q9 Long-term history: days already rolled up into daily_totals (older than 6 months, UTC days)
-- Empty until the first rollup runs; recent days are in Q1-Q3.
-- =====================================================================================
select day, mode, players, games_started, games_finished, wins,
       round(100.0 * wins / nullif(games_finished, 0), 1)           as win_pct,
       round(total_guesses::numeric / nullif(games_finished, 0), 2) as avg_guesses_all_games
from public.daily_totals
order by day desc, mode
limit 200;
