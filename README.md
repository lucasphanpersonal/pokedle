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
src/components/               Header, SearchBar, GuessGrid, FeedbackRow, WinModal, HelpModal
src/hooks/usePokemondle.ts       game state (target, guesses, status)
src/lib/                      dataset loading and game logic
src/config/gameConfig.ts      game settings, including which form categories are enabled
src/data/pokemon.json         generated dataset (committed, so the app needs no API at runtime)
```

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

## Analytics (Supabase)

Anonymous player analytics run on a Supabase Edge Function. From the repo root:

```sh
npx supabase link --project-ref <project-ref>   # connect this repo to your Supabase project
npx supabase db push --remote --yes            # create the tables, views and daily roll-up job
npx supabase secrets set ALLOWED_ORIGINS="https://lucasphanpersonal.github.io,http://localhost:5173"   # sites allowed to send events (set BEFORE deploying)
npx supabase functions deploy track --no-verify-jwt --yes   # deploy the event-collecting function
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
anonymous game events (guesses, results, device type) are recorded. Players are opted out automatically if their browser sends Global Privacy Control (`navigator.globalPrivacyControl`)
or Do Not Track, or if `localStorage['pokemondle:analytics-opt-out']` is `'true'` (`setTrackingOptOut()` in
`src/lib/analytics.ts` sets it, and the Help switch calls it; the choice is also held in memory for the session if
storage is unavailable). When the browser sends GPC or Do Not Track, the
switch is shown off and disabled.
