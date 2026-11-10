# Pokedle analytics backend (Supabase)

Anonymous gameplay analytics: one Edge Function (`track`) writing to a locked-down Postgres.
The browser only needs the **function URL**. No keys ship in the client.

Privacy design: the function hashes `salt + IP + user agent` into `visitor_hash` and `salt + IP` into `ip_hash`
(used only for a flood cap), where the salt rotates daily and is deleted after 2 days. The raw IP and UA are never
stored, and `ip_hash` is deleted with the raw events after 6 months. The function never
returns anything about the answer. Raw events are rolled up into `daily_totals` after 6 months.

## One-time setup

1. Create a project at <https://supabase.com/dashboard> (region: US). Note the **project ref**
   (the `abcdxyz` part of `https://abcdxyz.supabase.co`) and set a database password.
2. From the repo root:
   ```sh
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push --remote --yes                    # creates tables, views, functions, cron job
   # Later migrations (e.g. 20261107120000_widen_guess_caps.sql) are applied by the same command.
   npx supabase secrets set ALLOWED_ORIGINS="https://pokemondle.io,https://lucasphanpersonal.github.io"
   npx supabase functions deploy track --no-verify-jwt --yes
   npx supabase functions deploy stats --no-verify-jwt --yes   # public daily stats for the result screen
   ```
   Set `ALLOWED_ORIGINS` **before** deploying. Secrets take effect on the function's next start, so
   if you change them later, redeploy the function.
   `verify_jwt = false` for both `track` and `stats` is set in `supabase/config.toml`, so the CLI keeps JWT
   verification off even without the flag. The `--no-verify-jwt` flags are kept as a double check, because
   browsers call these functions without a Supabase token.
   `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function automatically.
3. The function URL is `https://<project-ref>.supabase.co/functions/v1/track`. That is the only
   value the client will need (e.g. as `VITE_TRACK_URL`).

Quick smoke test (should print `204`):
```sh
curl -s -o /dev/null -w "%{http_code}\n" -X POST "https://<project-ref>.supabase.co/functions/v1/track" \
  -H "Origin: https://pokemondle.io" -H "Content-Type: text/plain" \
  -d '{"events":[{"event":"game_started","game_id":"3fa85b3a-8158-46e3-8e84-af7319e0d0a4","mode":"endless","target_id":25,"device":"desktop"}]}'
```
Delete test rows afterwards: `delete from events where game_id = '3fa85b3a-8158-46e3-8e84-af7319e0d0a4';`

## Automatic deploys (GitHub Actions)

`.github/workflows/supabase-deploy.yml` runs when a change under `supabase/` is merged to `main` (or by hand from the
Actions tab, main branch only; edits to the workflow file also trigger it). It links the project, runs `supabase db push --remote --yes`, then deploys `track` and `stats` with
`--no-verify-jwt`. It also sets `ALLOWED_ORIGINS` on every run from the list in the workflow's `env`, so change the list there: a value set by hand is overwritten by the next run. Other function secrets are not touched.

The Supabase CLI version in the workflow is pinned (currently `3.1.0`), so a new CLI release never runs with the
database secrets before someone has looked at it. Dependabot (`.github/dependabot.yml`) opens weekly PRs for npm
packages and GitHub Actions, but not for this pin: bump it by hand.

One-time setup, in the repo under **Settings > Secrets and variables > Actions > New repository secret**:

| Secret | Where to get it |
| --- | --- |
| `SUPABASE_ACCESS_TOKEN` | <https://supabase.com/dashboard/account/tokens> > Generate new token |
| `SUPABASE_DB_PASSWORD` | The database password chosen when the project was created (reset under **Project Settings > Database** if lost) |

The project ref is in the workflow file because it is public (it is in the function URL). Never commit either secret.
If a secret is missing the job fails with a clear message. Manual deploys from a PC (commands above) still work.

## Security model

- The `Origin` check against `ALLOWED_ORIGINS` is CORS hygiene, **not access control**: any
  non-browser client can forge an `Origin` header.
- The real defences are strict field validation (allow-list, ranges, max 60 events per batch) and a
  per-visitor rate limit (5000 events per UTC day by default, 429 beyond that) plus a per-IP limit (20000 per UTC day);
  see Maintenance.
- A "visitor" is a hash of IP + user agent, so players sharing one Wi-Fi network and browser count as one
  visitor: daily player counts undercount them and they share one rate-limit budget (hence the generous default).
  Fixing that would need a stored device ID, which the project deliberately avoids (no cookies, no consent banner).
- Rotating the User-Agent changes `visitor_hash` and so gets a fresh per-visitor budget, which is why the second cap
  is keyed on the IP alone (`events.ip_hash`, a salted hash, never the raw IP). Someone with many IPs can still
  flood; that is acceptable for analytics: the worst case is some noisy rows, and the tables are write-only
  for the function and unreadable by the browser. The public stats are protected separately (one finished game per
  network per UTC day, see below).
- Retried or duplicate events are ignored (unique on `game_id, event, guess_number`).
- If no client IP is available the request is hashed with a random value, `ip_hash` is null, and it is not rate limited.
- `events.ip_hash` (nullable, 64 hex chars) is the salted IP-only hash; it is never selected by the views or roll-up.

## Reading the data

Open **Dashboard > SQL Editor** and run, for example:

```sql
select * from daily_players order by day desc limit 30;      -- unique players per day and mode
select * from daily_puzzle_stats order by puzzle_date desc;  -- solve rate / avg guesses per puzzle
select * from guess_histogram order by mode, guess_count;    -- guesses-to-win distribution
select * from top_guesses;                                   -- 50 most common guesses
select * from top_first_guesses;                             -- 50 most common opening guesses
select * from mode_split;                                    -- daily vs endless
select * from streak_share order by day desc;                -- share of finishers with streak >= 2
select * from daily_totals order by day desc;                -- rolled-up history (older than 6 months)
```
Use the editor's **Save** to keep them as saved queries. The views are not readable with the anon key.
`target_id` and `guess_id` are National Dex numbers.

The `stats` function (`GET /functions/v1/stats?date=YYYY-MM-DD[&hard=1]`, same `ALLOWED_ORIGINS` as `track`) serves this
to the game with a 60 s cache. `select public_daily_stats(current_date);` is the only thing the anon role may call: aggregates
for one daily puzzle (games finished, solve rate, guess histogram), never the target or per-player data.
`public_daily_stats(date, hard)` serves normal games by default, or only Hard mode games (`config.hard_mode = true`, no Gen column)
with `?hard=1`; each has its own 5-game threshold. The raw events and the private views include both (filter on `config->>'hard_mode'`).
Each network counts at most once per puzzle date and split, keyed on `ip_hash` (falling back to `visitor_hash` for older
rows) and taking the earliest finish by `received_at`, then `id`. Rotating the User-Agent therefore doesn't add fake finishes;
only many IPs would. Because the hashes rotate with the UTC-day salt, a player whose finishes land on two UTC days can count
twice, and players sharing one network (home Wi-Fi, a school) count as one. It returns nulls and an empty histogram when fewer than 5 games finished, and errors for dates older
than 400 days or more than 1 day ahead.

## Maintenance

- **WARNING: enable pg_cron.** The 6-month roll-up/deletion of raw events depends on it. Without it,
  raw events are kept forever until you run `select public.rollup_old_events();` yourself. (Old daily
  salts are deleted by the function itself, so hash unlinkability does not depend on pg_cron.)
- `rollup_old_events()` runs daily at 03:15 UTC via pg_cron. If the migration printed a notice that
  pg_cron was unavailable, enable it under **Database > Extensions** and run
  `select cron.schedule('pokedle-rollup', '15 3 * * *', 'select public.rollup_old_events()');`
- Logs: **Edge Functions > track > Logs**.
- Rate limit: 5000 events per visitor per UTC day by default (HTTP 429 beyond that; it was 300, which cut off heavy
  Endless players). Change it without a code change: `npx supabase secrets set MAX_EVENTS_PER_VISITOR_PER_DAY=<n>`
  (picked up on the next cold start, or redeploy). Rejections are logged as `rate_limited` in Edge Functions > track > Logs.
- Per-IP rate limit: 20000 events per IP (salted hash) per UTC day by default, so a school or office behind one IP still
  fits. Override with `npx supabase secrets set MAX_EVENTS_PER_IP_PER_DAY=<n>`. Rejections are logged as `rate_limited_ip`.
- Tests for the validation logic: `npm test`.
