# Pokemondle

A Wordle-style guessing game covering every Pokémon from Gen 1 to Gen 9, including regional forms, Megas and Gigantamax.

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run build      # static production build in dist/
npm run preview    # serve the production build locally
npm run test       # unit tests
npm run fetch-data # rebuild src/data/pokemon.json from PokéAPI
```

## Project layout

```
scripts/fetchPokemonData.ts   builds the local Pokémon dataset from PokéAPI
src/components/               Header, SearchBar, GuessGrid, FeedbackRow, ResultModal, HistoryModal, HelpModal, Modal
src/hooks/usePokemondle.ts    game state (target, guesses, status), saved to localStorage (answer id scrambled, see below)
src/lib/history.ts            solved-Daily history and streak maths (pure, tested)
src/hooks/useAnalytics.ts     wraps guesses with anonymous analytics
src/lib/                      dataset + search, Pokédex entry fetch (dexEntry.ts), comparison, daily seed, game rules, sound, storage
src/config/gameConfig.ts      game settings, including which form categories are enabled
src/config/uiConfig.ts        tile animation timing
src/data/pokemon.json         generated dataset (committed, so the app needs no API at runtime)
```

## How the game plays

- **Daily**: everyone gets the same Pokémon on the same calendar day (local time), picked by hashing the date
  with each Pokémon's id. **Endless**: a new random Pokémon on demand. Each mode keeps its own saved game.
- **No guess limit**: a game ends only when you guess the answer. The search box only accepts Pokémon picked from
  its suggestions; already guessed Pokémon are hidden from them. Matching ignores case, accents and punctuation ("flabebe" finds Flabébé).
- **Columns**: Pokémon, Type 1, Type 2, Gen, Height, Weight, Color, Evolution (stage 1–3), Form, Shared Ability.
  Green = match, yellow = type in the other slot, red = no match, ▲/▼ = the answer is higher/lower.
  Form is green when the guess and the answer share a form category (Base, Mega, Regional, Gigantamax, Cosmetic, Other), red otherwise; the tile shows the guess's own category.
  Shared Ability lists every ability the two share (hidden abilities count). With no match it is red and lists all of
  the guess's own abilities instead, or "Unknown" for the few new Megas with no ability data yet.
- **Hard mode**: an optional switch under **Help → Difficulty** that hides the Gen column (table and phone cards).
  It is a per-device preference (`localStorage['pokemondle:hard-mode']`, off by default, `src/lib/hardMode.ts`) that
  sets how the *next* game starts. Each game records its own `hard` flag when its first guess is made, so the mode
  can't change mid-game: the switch is disabled while the current game is in progress and unlocks once it is solved.
  Hard games show "Hard mode" under the guess count, a **★ Hard mode** line on the result screen and a **★ Hard** tag
  in History (streaks still count them). Their analytics events carry `config.hard_mode = true` and the Daily result
  screen skips the public stats for them (see [Public daily stats](#public-daily-stats)).
- **Pokédex numbers**: every guess shows its National Dex number (`#025`) beside the name as a display-only label,
  never a clue. Forms use their species' number (Alolan Raichu is `#026`).
- **Results**: after the last tile flips, a dialog shows the answer's artwork, how many guesses it took and a
  **Pokédex entry card** (number, category such as "Mouse Pokémon", height, weight and English flavor text). Number,
  height and weight come from the local dataset; category and text are fetched from PokéAPI's `pokemon-species`
  endpoint only on a win (cached per session), with a graceful message if offline (`src/lib/dexEntry.ts`). On the
  Daily it also shows **Today's stats**: players who solved it, the average guesses, how you rank and a small guesses
  histogram (see [Public daily stats](#public-daily-stats)). Endless shows a **New Pokémon** button instead.

### Saved games

Each mode's game is saved in `localStorage` (`pokemondle:daily`, `pokemondle:endless`). Hard mode games add `hard: true` to the save (set at the first guess, so it can't change mid-game); older saves without it load as normal games and any other value makes the save invalid. The answer is stored scrambled
(`t`, see `encodeSave` in `src/lib/game.ts`) rather than as a plain id, so it can't be read at a glance in the browser's
storage panel. This is only a deterrent: the game is fully client-side, so a determined player can still work it out.
Older plain saves are still read. The search box shows "You got it!" once a game is solved.

### History and streaks

- Every solved Daily is saved on the player's own device in `localStorage['pokemondle:history']` (date, answer id,
  guess count, and `hard: true` if it was a Hard mode game). No account or server is involved, so it doesn't carry over between devices or browsers.
- The **History** button under the puzzle title shows the current streak, and opens a screen with current and best
  streak, Dailies solved, average and fewest guesses, and a list of past Dailies (puzzle number, date, answer, guesses).
  The Daily result screen shows the streak too.
- A streak counts consecutive days with a solved Daily. It stays alive while today's Daily is still open, and resets
  when a day goes by unsolved. Endless games are not recorded. Today's Daily, if solved before this feature existed, is added
  the next time the page loads; earlier ones can't be recovered.

### Look and feel

- **Pixel art style**: dialog boxes use a pixel-art frame (`.ds-box`, an inline SVG border image with stepped
  corners), buttons and tiles have stepped "pixel" corners (`.ds-button`, `.px-notch`) and a dark frame-colored
  outline. Guess tiles and the Help swatches are beveled like Platinum's battle-menu blocks (`.tile-bevel` in
  `src/index.css`: light top edge, dark bottom edge, shaded sides, colour taken from `data-result`), the sky is drawn in flat
  bands, and every image is scaled with `image-rendering: pixelated`. The results screen shows the Pokémon's
  in-game pixel sprite, scaled up crisply (falling back to the official artwork if a form has no sprite).
- **CRT screen effect**: scanlines, a faint RGB phosphor mask, a vignette and a slow flicker drawn over the page
  (`html.crt body::after` in `src/index.css`). On by default; players can turn it off under **Help → Display**
  (saved per device in `localStorage['pokemondle:crt']`). The flicker stops for "reduce motion".

- **Sound effects**: original 8-bit style blips synthesised in the browser with the Web Audio API
  (`src/lib/sound.ts`; square/triangle oscillators, no audio files and nothing copied from the games; the win cry below is the only audio, and it is streamed, not bundled): a blip as
  you type, a tick as you move through suggestions, a two-note chime on a guess, a rising tick as each tile flips
  (timed from `App.tsx` to match the flip animation), a low buzz for a bad or duplicate guess and a fanfare when
  you win, then the answer's cry after the fanfare. On by default; mute with the speaker button in the header or **Help → Display & sound** (saved per
  device in `localStorage['pokemondle:sound']`). The audio context is created on the first tap or keypress, as
  browsers (including iOS Safari) require. Typing and menu blips still play with "reduce motion"; only the tile ticks are skipped.
- **Win cry**: on a win the answer's cry plays after the fanfare (`src/lib/cry.ts`). Cries are streamed from the PokéAPI
  cries repo (`raw.githubusercontent.com/PokeAPI/cries`, `latest/{id}.ogg`), only on a win, never during play. Forms without
  their own cry use their species' cry. A missing or offline cry is skipped silently, and muting stops it at once.

### Layout on different devices

- Desktop and large tablet (≥ 1024 px): all ten columns fit on screen.
- Phones and tablets under 1024 px: no sideways scrolling. Each guess is a compact card: sprite and name on top, then the
  comparison tiles in two rows of four (Type 1, Type 2, Gen, Height / Weight, Color, Evolution, Form; in Hard mode the top row is three wider tiles without Gen) and a full-width Shared Ability strip,
  with a small key above the list. The search box uses 16 px text so iOS doesn't
  zoom, and every button and suggestion is at least 44 px tall for touch.
- Keyboard: type to search, ↑/↓ to move through suggestions, Enter to guess, Esc to close a dialog.
- Animations are turned off for players who set "reduce motion".

## Dataset

`npm run fetch-data` pulls every Pokémon entry from PokéAPI (1,351 at the time of writing: 1,025 species
plus regional forms, Megas, Gigantamax and other alternate forms) and writes `src/data/pokemon.json`.
If pokeapi.co is unreachable it falls back to PokéAPI's static mirror on GitHub
(`PokeAPI/api-data`); set `POKEAPI_SOURCE=live` or `POKEAPI_SOURCE=mirror` to force one.
Responses are cached in `scripts/.cache/`.

Known data quirks:
- Colour comes from the species, so forms share it (Alolan Vulpix is listed as Brown, like Vulpix).
- Eternamax Eternatus has no official weight and is stored as 0.

## Turning form categories on or off

Every entry has a `formCategory` (`base`, `regional`, `mega`, `gmax`, `cosmetic`, `other`).
Set any of them to `false` in `src/config/gameConfig.ts` to remove them from the game.

## Deploying

The app is a fully static site with no backend. The build uses relative asset paths,
so `dist/` works on Vercel or Netlify (build command `npm run build`, output `dist`) and on
GitHub Pages under a sub-path.

### GitHub Pages (current host)

`.github/workflows/deploy.yml` lints, tests, builds and publishes `dist/` on every push to `main`
(or manually from the Actions tab). The live site is https://lucasphanpersonal.github.io/pokemondle/.

One-time setup: in the repo's **Settings → Pages → Build and deployment**, set **Source** to
**GitHub Actions**. GitHub Pages needs the repository to be public on a free plan.

Pull requests run the same lint, test and build checks (`.github/workflows/ci.yml`) without deploying.

## Analytics (Supabase)

Anonymous player analytics run on a Supabase Edge Function. From the repo root:

```sh
npx supabase link --project-ref <project-ref>   # connect this repo to your Supabase project
npx supabase db push --remote --yes            # create the tables, views and daily roll-up job
npx supabase secrets set ALLOWED_ORIGINS="https://lucasphanpersonal.github.io,http://localhost:5173"   # sites allowed to send events (set BEFORE deploying)
npx supabase functions deploy track --no-verify-jwt --yes   # deploy the event-collecting function
npx supabase functions deploy stats --no-verify-jwt --yes   # deploy the public daily-stats function
```

Secrets take effect on the function's next start; redeploy after changing them.
With Supabase CLI 3, `db push` targets a local database unless you pass `--remote`, and `--yes` skips the confirmation prompt for hosted projects. `link` creates `supabase/.temp/`, which is git-ignored.

The live project is `inxvlunfwsssifvjkgtz` (US); the client sends events to `https://inxvlunfwsssifvjkgtz.supabase.co/functions/v1/track`.

See [supabase/README.md](supabase/README.md) for details.

### Client-side tracking and opting out

The game sends events to the `track` function only when `VITE_TRACK_URL` is set. `.env.production` sets it
(the URL is public), so production builds report; `npm run dev` does not unless you copy `.env.example` to
`.env.local`. Events are batched per game and sent when a game ends or the page is hidden or closed.

Players can switch off "Share anonymous stats" in the Help screen (the "?" button), which also explains that only
anonymous game events (guesses, results, device type, and whether Hard mode was on) are recorded. Players are opted out automatically if their browser sends Global Privacy Control (`navigator.globalPrivacyControl`)
or Do Not Track, or if `localStorage['pokemondle:analytics-opt-out']` is `'true'` (`setTrackingOptOut()` in
`src/lib/analytics.ts` sets it, and the Help switch calls it; the choice is also held in memory for the session if
storage is unavailable). When the browser sends GPC or Do Not Track, the
switch is shown off and disabled.

### Public daily stats

The Daily result screen reads totals from the `stats` Edge Function
(`GET /functions/v1/stats?date=YYYY-MM-DD`), which calls `public_daily_stats()` and returns only
`games_finished`, `wins`, `solve_rate` and a guesses histogram. Nothing per-player and never the answer.
Below 5 finished games it returns an empty histogram, and the panel stays hidden. Responses are cached for 60 s.
The client derives the URL from `VITE_TRACK_URL` (`/track` becomes `/stats`), skips the request for players who
opted out (or send GPC / Do Not Track), and shows nothing if the request fails or the player is offline.


Hard mode games (`config.hard_mode = true` on their events) are excluded from these totals by
`public_daily_stats()` (migration `20261108220000_public_stats_exclude_hard.sql`), so the numbers compare like with like,
and the result screen shows a note instead of the panel for a Hard game.

The player's own result is sent just before, so the fetch waits 1.5 s to usually include it. Deploy the function
(with the same `ALLOWED_ORIGINS` secret as `track`) before the site update goes live; until then the panel simply doesn't appear.
