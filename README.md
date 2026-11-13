# Pokémondle

A Wordle-style guessing game covering every Pokémon from Gen 1 to Gen 9, including regional forms, Megas and Gigantamax.

Pokémondle is an unofficial fan project. It is not affiliated with, endorsed or sponsored by Nintendo, Game Freak or The Pokémon Company. Pokémon and all related names are trademarks of their respective owners.

## Getting started

```bash
npm install
npm run dev        # local dev server
npm run build      # static production build in dist/
npm run preview    # serve the production build locally
npm run test       # unit tests
npm run test:e2e   # browser smoke test (Playwright; first run: npx playwright install chromium)
npm run fetch-data # rebuild src/data/pokemon.json from PokéAPI
npm run icons      # rebuild the site icons in public/ from scripts/icons/pokeball.txt
```

## Project layout

```
e2e/smoke.spec.ts             Playwright browser smoke test (load, guess, win, mode switch, Endless Gens at 390px and 1280px)
scripts/fetchPokemonData.ts   builds the local Pokémon dataset from PokéAPI
scripts/makeIcons.ts          builds the tab icon, home-screen icons and manifest icons from the pixel Poké Ball
scripts/icons/pokeball.txt    the hand-drawn Poké Ball (16x16 and 32x32 grids, one letter per colour)
public/                       favicon.ico, apple-touch-icon.png, manifest.json and its icons (generated, committed)
src/components/               Header, SearchBar, GuessGrid, FeedbackRow, ResultModal, HistoryModal, HelpModal, GiveUpModal, GensModal, Modal
src/hooks/usePokemondle.ts    game state (target, guesses, status), saved to localStorage (answer id scrambled, see below)
src/lib/history.ts            Daily history (solved and given up), streak maths and Endless stats (pure, tested)
src/hooks/useAnalytics.ts     wraps guesses with anonymous analytics
src/hooks/useRevealEffects.ts  flip-reveal hold, tick sounds, win fanfare, cry and confetti timers
src/hooks/useMediaQuery.ts     live CSS media-query match (GuessGrid picks table or cards with it)
src/lib/                      dataset + search, Pokédex entry fetch (dexEntry.ts), comparison, daily seed, game rules, Endless Gen filter (gens.ts), sound, storage, display settings (display.ts: CRT, Larger text), tile text fitting (tileText.ts), phone card layout (cardLayout.ts)
src/config/gameConfig.ts      game settings, including which form categories are enabled
src/config/uiConfig.ts        tile animation timing
src/data/pokemon.json         generated dataset (committed, so the app needs no API at runtime)
```

## How the game plays

- **Daily**: everyone gets the same Pokémon on the same calendar day (local time), picked by hashing the date
  with each Pokémon's id. **Endless**: a new random Pokémon on demand. Each mode keeps its own saved game.
- **No guess limit**: a game ends when you guess the answer. The search box only accepts Pokémon picked from
  its suggestions; already guessed Pokémon are hidden from them. Matching ignores case, accents and punctuation ("flabebe" finds Flabébé).
  Typing the full name of a Pokémon you already guessed and pressing Enter says "You already guessed …" instead of guessing
  the next suggestion (so "pikachu" twice never guesses Pikachu Rock Star); picking a suggestion with ↑/↓ first still works.
- **Give up (Daily and Endless)**: a white **Give up** button sits last in the menu row under the puzzle title,
  beside the Gen hint (after Gens in Endless); the row wraps on narrow phones. It disappears once the game is over. It
  is kept away from the search box on purpose, so the most-tapped control never sits next to one that ends the game,
  and it is shown all game, so nothing moves when it becomes available: before the first guess it is locked (same
  colours, grey label, `aria-disabled`, and a tap shows "Give up unlocks
  after your first guess." under the guess count). It asks first (`src/components/GiveUpModal.tsx`: **Keep going** or
  **Give up**), then ends the game as `lost`: the result screen, titled "It got away!", reveals the answer with its
  Pokédex entry (plus **New Pokémon** in Endless). For the Daily the dialog warns that it can't be replayed and names
  the streak that ends: a given-up Daily is listed in History as "Gave up", resets the streak straight away and stays
  out of the solved count, average, fewest and no-hint share. An Endless give up counts as given up in the Endless stats.
- **Endless Gens**: in Endless a white **Gens** button sits first in the menu row. It opens a picker
  (`src/components/GensModal.tsx`): nine **Gen 1** to **Gen 9** toggles in a 3 by 3 grid (green and pressed in when on,
  white and raised when off), **All** and **None** buttons, a line with the selection and how many Pokémon it holds, and
  **OK**. At least one Gen must be on (OK is disabled and the line says "Pick at least one Gen."); closing the box
  any other way keeps the old choice. The answer is then drawn only from those Gens, using each Pokémon's own
  `generation` field, so forms count by their debut (Megas are Gen 6, Alolan forms Gen 7). The search box is not
  filtered: any Pokémon can still be guessed. The choice is a per-device preference
  (`localStorage['pokemondle:endless-gens']`, a sorted list, all nine by default, `src/lib/gens.ts`) kept in sync
  across tabs. While a game is in progress (it has guesses and isn't solved or given up) the picker
  is **view-only**: it shows the Gens that game was drawn from as disabled tiles, without All and None, says "This game
  was drawn from these generations. You can change them once you catch it or give up.", and OK just closes it. Before the first guess a
  change redraws the answer at once; once the game is solved or given up the picker can be changed again and the change
  applies from the next **New Pokémon**. Each game records the Gens it was
  drawn from, and while they are not all nine the title reads "Endless · Gens 1-3, 5" instead of "Endless mode".
  The Daily always uses every Gen. An Endless game drawn from a single Gen never offers the Gen hint (the player already knows it).
- **Columns**: Pokémon, Type 1, Type 2, Height, Weight, Color, Evolution (stage 1–3), Form, Egg Group, Shared Ability.
  There is no Gen column: a guess never shows its generation, so the Gen is only revealed by the optional Gen hint.
  Green ✓ = match, yellow ~ = type in the other slot (or one shared egg group), red ✕ = no match, ▲/▼ = the answer is higher/lower.
  Every tile carries its ✓, ~ or ✕ as a small pixel mark in the top-right corner (`src/components/ResultMark.tsx`), and number tiles carry their arrow, so no match, partial or miss depends on telling red from green.
  Form is green when the guess and the answer share a form category (Base, Mega, Regional, Gigantamax, Cosmetic, Other), red otherwise; the tile shows the guess's own category.
  Egg Group (from PokéAPI's species data; forms share their species' groups, legendaries are mostly "Undiscovered") is green when the guess and the answer have exactly the same groups, yellow when they share at least one, red when none; the tile lists the guess's own groups.
  Shared Ability lists every ability the two share (hidden abilities count). With no match it is red and lists all of
  the guess's own abilities instead.
  Guessing the exact answer always turns every tile green. (Forms with no ability data on PokéAPI, like the new Legends Z-A Megas, borrow their base species' abilities in the data script.)
- **Gen hint**: one mode for everyone (Hard mode and its Gen column were removed). Once a game has 5 guesses
  (`HINT_AFTER_GUESSES` in `src/lib/game.ts`) and is still open, an in-game style text box pops up in the middle of
  the screen over the dimmed background (`src/components/HintPrompt.tsx`), after the fifth row has flipped in. Its
  question types out letter by letter (a tap, Enter, Space or Z/A finishes it), then offers **Not now** (focused, so a
  stray Enter never spends the hint) and **Show Gen**. Show Gen types out "This Pokémon is from Gen N!" with a stepping
  ▼; advancing closes it. Esc or a tap on the dimmed background means Not now. The pop-up appears once per game
  (`localStorage['pokemondle:hint-offered']`, the last game offered in each mode); after Not now a white **Gen hint**
  button (with a pixel bulb, `PixelBulb.tsx`) sits in the menu row (after Gens in Endless) until the game ends. Once taken, that button stays in
  place pressed in (the inverse bevel, a non-interactive status) and reads **Hint · Gen N**, the save gets `hinted: true`, the result screen shows **Used the Gen hint**
  and History marks the Daily with a bulb. A hinted win still counts as a win and keeps the streak; History shows
  "N% of wins without a hint" for the Daily and for Endless. Analytics events carry `config.hint_used` (false until the hint is
  taken), and the Daily stats panel says what share of players used it.
- **Pokédex numbers**: every guess shows its National Dex number (`#025`) beside the name as a display-only label,
  never a clue. Forms use their species' number (Alolan Raichu is `#026`).
- **Results**: after the last tile flips, a dialog shows the answer's artwork, how many guesses it took and a
  **Pokédex entry card** (number, category such as "Mouse Pokémon", height, weight and English flavor text). Number,
  height and weight come from the local dataset; category and text are fetched from PokéAPI's `pokemon-species`
  endpoint only when the game ends, on a win or a give up (cached per session), with a graceful message if offline (`src/lib/dexEntry.ts`). On the
  Daily it always shows **Today's stats**: players who solved it, the average guesses, how you rank (not after a give
  up), how many gave up or used the Gen hint, and a small guesses histogram, or "You're the first to solve today's
  Pokémon!" when nobody else has yet (see [Public daily stats](#public-daily-stats)). Endless shows a **New Pokémon** button instead.
  A white **History** button sits on the result screen in both modes (beside **New Pokémon** in Endless).
- **After the game**: once the last tile flips, the guess box keeps its "You got it!" (or "It got away!") text and
  a red **See results** takes the Guess button's place, reopening the result screen after it has been closed. In
  Endless a red **New Pokémon** joins it and See results turns white (one red main action); on phones the two buttons
  take the whole box and the text hides. While the tiles are still flipping the box shows the faded Guess button.

### Saved games

Each mode's game is saved in `localStorage` (`pokemondle:daily`, `pokemondle:endless`). A game where the Gen hint was taken adds `hinted: true` (any other value makes the save invalid). Saves from when Hard mode existed carry `hard: true`; `decodeSave` drops it, so those games, even one still in progress, carry on as ordinary games. The old `pokemondle:hard-mode` and `pokemondle:seen-hard-notice` settings are deleted on load. The answer is stored scrambled
(`t`, see `encodeSave` in `src/lib/game.ts`) rather than as a plain id, so it can't be read at a glance in the browser's
storage panel. This is only a deterrent: the game is fully client-side, so a determined player can still work it out.
An Endless game drawn from only some Gens adds `gens` (a sorted list such as `[1, 4]`; absent means all nine; only valid on an Endless save whose answer is from one of them).
A game that was given up (Daily or Endless) adds `gaveUp: true` (only valid on a save with at least one guess and no win).
Older plain saves are still read.

### History and streaks

- Every finished Daily is saved on the player's own device in `localStorage['pokemondle:history']` (date, answer id,
  guess count, `hinted: true` if the Gen hint was taken, and `lost: true` if it was given up; entries from the Hard mode days lose their `hard` flag and count as ordinary solves). No account or server is involved, so it doesn't carry over between devices or browsers.
- History and the streak live on the **result screen** only, never on the play page: the Daily result shows
  "Streak: N days · Best: N", and its **History** button (in Endless too) opens a screen with current and best
  streak, Dailies solved, average and fewest guesses (solved Dailies only), a "Dailies given up" count once there is one, and a list of past Dailies (puzzle number, date, answer, guesses, "Gave up" for a given-up one; days before launch show only the date).
  Closing History returns to the result screen. A returning player who already finished today's Daily lands on the
  result screen; after closing it, **See results** in the guess box brings it (and History) back.
- History also shows **Endless** stats: games played, Pokémon caught and given up, and the average and fewest guesses
  over caught games (given-up games don't count toward those two). They are kept in
  `localStorage['pokemondle:endless-record']` (`caught`, `gaveUp`, `guesses` and `scored` (the guess total and how many
  caught games it covers), `fewest`, and the key of the last game counted, so each game counts once across reloads and
  tabs). Tallies saved before guess totals existed keep their caught and given-up counts, and the average and fewest start from
  the next catch. Individual Endless games are not listed.
- A streak counts consecutive days with a solved Daily. It stays alive while today's Daily is still open, and resets
  when a day goes by unsolved, or straight away when today's Daily is given up. Today's Daily, if solved before this feature existed, is added
  the next time the page loads; earlier ones can't be recovered.

### Look and feel

- **Pixel art style**: dialog boxes use a pixel-art frame (`.ds-box`, an inline SVG border image with stepped
  corners), buttons and tiles have stepped "pixel" corners (`.ds-button`, `.px-notch`) and a dark frame-colored
  outline. Every button and tile shares one bevel, like Platinum's battle-menu blocks (`.bevel` in
  `src/index.css`: light top edge, dark bottom edge, shaded sides; see [Design rules](#design-rules)), the sky is drawn in flat
  bands, and every image is scaled with `image-rendering: pixelated`. The results screen shows the Pokémon's
  in-game pixel sprite, scaled up crisply (falling back to the official artwork if a form has no sprite).
- **CRT screen effect**: scanlines, a faint RGB phosphor mask, a vignette and a slow flicker drawn over the page
  (`html.crt body::after` in `src/index.css`). On by default; players can turn it off under **Help → Display**
  (saved per device in `localStorage['pokemondle:crt']`). The flicker stops for "reduce motion".
- **Larger text**: an off-by-default switch under **Help → Display & sound** (saved per device in
  `localStorage['pokemondle:big-text']`, `src/lib/display.ts`) that makes the small text a quarter bigger, so the
  guess tiles' smallest text goes from 7px to 9px. It adds `.big-text` to `<html>` before the first paint, which sets
  `--ts: 1.25`. Every small text size is written as `tx-N` (a utility in `src/index.css` for N px times `--ts`, rounded to
  whole pixels so the pixel font stays crisp) and the tile font fitting (`.tile-fit`) multiplies its sizes by `--ts` too.
  The layout breakpoints that depend on tile width move by the same quarter: table tiles grow taller, phone cards show
  three tiles to a row under 640 px, cards sit two to a row from 900 px instead of 720 px, and the table starts at
  1280 px instead of 1024 px (the page widens to 1280 px to give it room). The header, search box and menu buttons keep
  their size, so they still fit in one row on a 320 px phone.

- **Sound effects and volume**: original 8-bit style blips synthesised in the browser with the Web Audio API
  (`src/lib/sound.ts`; square/triangle oscillators, no audio files and nothing copied from the games; the win cry below is the only audio, and it is streamed, not bundled): a short press blip on every button, switch and radio (one document-level click listener in `sound.ts`, so new buttons get it automatically; the speaker and Guess buttons opt out with `data-no-sound`), a blip as
  you type, a tick as you move through suggestions, a two-note chime on a guess, a rising tick as each tile flips
  (timed from `useRevealEffects` to match the flip animation), a low buzz for a bad or duplicate guess and a fanfare when
  you win, then the answer's cry after the fanfare. Volume is a Nintendo-style row of 5 equal dashes (empty white when off, green when lit) (`src/components/VolumeControl.tsx`; none lit is muted, default 5): tap a dash (the 4th lights the first 4) or use the arrow keys, Home and End. The dashes sit in the header from 760px wide up and always in **Help → Display & sound**; the speaker button mutes and restores the last level. The level scales the blips and the win cry (the cry at half strength; iOS Safari ignores volume on the cry), and is saved per
  device in `localStorage['pokemondle:volume']` (the old `pokemondle:sound` on/off setting is migrated: off becomes 0). The audio context is created on the first tap or keypress, as
  browsers (including iOS Safari) require. Typing and menu blips still play with "reduce motion"; only the tile ticks are skipped.
- **Win cry**: on a win the answer's cry plays after the fanfare (`src/lib/cry.ts`). Cries are streamed from the PokéAPI
  cries repo (`raw.githubusercontent.com/PokeAPI/cries`, `latest/{id}.ogg`), only on a win, never during play. Forms without
  their own cry use their species' cry. A missing or offline cry is skipped silently, and muting stops it at once.

### Layout on different devices

- Desktop and large tablet (≥ 1024 px, or ≥ 1280 px with Larger text): all ten columns fit on screen.
- Phones and tablets under 1024 px (1280 px with Larger text): no sideways scrolling. Each guess is a compact card: sprite and name on top, then the
  comparison tiles in two rows (three wider tiles: Type 1, Type 2, Height; then four: Weight, Color, Evolution, Form) and full-width Egg Group and Shared Ability strips,
  with a small key above the list laid out in the same two rows as the tiles (rows of three under 640 px with Larger text; `cardTileSpan` in `src/lib/cardLayout.ts` sets the spans for both). The search box uses 16 px text so iOS doesn't
  zoom, and every button and suggestion is at least 44 px tall for touch. From 720 px wide (iPad portrait; 900 px with Larger text) the cards sit two to a row,
  each column with its own key, so tablet tiles aren't stretched across the whole screen.
- Only one of the two layouts is rendered at a time (`useMediaQuery` in GuessGrid), not both with one hidden by CSS. Rotating
  an iPad across 1024 px (1280 px with Larger text) swaps the layout without replaying the tile flips.
- Keyboard: type to search, ↑/↓ to move through suggestions, Enter to guess, Esc to close a dialog, ←/→ to switch Daily/Endless when that toggle is focused.
- **Win confetti**: a ~2 second burst of pixel confetti in the game's colours, with a few Poké Balls and stars, falls over the result dialog when you win (Daily or Endless). It starts after the last tile flips, is pointer-free, and is not shown for players who set "reduce motion" (`src/components/Confetti.tsx`).
- Animations are turned off for players who set "reduce motion".

## Design rules

The look is Pokémon Platinum / NDS menus. Every pull request is checked against these rules (the code reviewer is
asked to flag any break), and UI changes are screenshotted and measured at 320, 390, 768, 1024 and 1280 px before merging.

1. **One bevel for everything.** Every button, toggle and guess tile uses the shared `.bevel` style in
   `src/index.css` (`.ds-button` includes it): 2px dark outline, 6px light top edge, 6px dark bottom edge, 4px shaded
   sides. Pick the face colour with `.bevel-paper` (white), `.bevel-red`, `.bevel-green`, or `data-result` on tiles.
   Never hand-roll a `box-shadow` or `border` bevel on a single control. A dialog's close button is a 44px
   `.ds-button bevel-paper` square holding the pixel-art cross (`ResultMark` drawn at 2px per art pixel), like the
   header's ? button. The only exception is the small on/off switch graphics in Help, which are not menu buttons.
2. **Pressed means the inverse bevel.** A selected or "on" control (the chosen Daily/Endless side, a chosen Gen in the Endless Gens picker, the taken Gen hint) adds
   `.bevel-pressed`: same edges, dark on top and light at the bottom. The edges stay the same size, so labels sit at
   the same height whether a control is up or down.
3. **Equal heights and gaps.** Header and menu controls are all 44px tall (also the minimum touch target), top-aligned
   in one row, with one gap size per row (6px on phones, 8px from 640px up). Nothing may spill past the screen edge
   at any width from 320px.
4. **Text stays inside the padding.** Guess-tile and button text keeps at least 10px from the edge (the 6px bevel plus
   4px of air). Guess tiles shrink long words to fit (`.tile-fit`, down to 7px, or 9px with Larger text) or wrap them at a soft hyphen
   (`src/lib/tileText.ts`), e.g. "Undis- / covered", rather than run edge to edge. Multi-line tiles are also sized by
   line count so nothing is cut off: the table's Pokémon name gets up to 3 lines under its sprite and Pokédex number
   (the sprite shrinks, from 40px, to the room the name leaves, so it never crosses the bevel), and Shared Ability up to
   4 lines at 9px or 5 at 8px (`lineChars` in `tileText.ts`). The table's Shared Ability column uses one size for every
   row, the one its most demanding row needs (`abilityColumnFit`), so rows don't jump in size.
   Write small text sizes as `tx-N`, not `text-[Npx]`, so the Larger text option scales them; only the header, search box
   and `.ds-button` labels keep fixed `text-[Npx]` sizes, so those rows still fit at 320px.
5. **Stepped corners and pixel font.** Boxes and buttons use stepped pixel corners (`.ds-button`, `.px-notch`) and
   Press Start 2P, self-hosted from `@fontsource/press-start-2p` (no Google Fonts request); images use `image-rendering: pixelated`.
6. **One action colour.** The main action on a screen (Guess, New Pokémon) is a red button everywhere it appears;
   secondary actions (See results, History) are white.
7. **Dialog headers.** A dialog's title is vertically centred on its close button, which sits the same distance from
   the box's top and right edges.
8. **Readable colours, never colour alone.** White text needs at least 4.5:1 against its face, so the tile green is
   `#2a8530` (4.67:1) and red `#c84040` (4.93:1); yellow tiles use dark ink text. Every result also has a non-colour
   cue: the ✓ / ~ / ✕ corner mark (7×7 pixel art, 8px from the top and ending 10px from the right edge, so it never
   meets tile text) or a ▲/▼ arrow. Check contrast before changing `--color-fb-*`.

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

The app is a fully static site. The build uses relative asset paths (Vite `base: './'`), so the same
`dist/` works at a domain root and under a sub-path.

### pokemondle.io (main site)

https://pokemondle.io is served from a Windows PC through a Cloudflare Tunnel, so no router ports are open and the
home IP stays hidden. Everything lives in `deploy/`:

- `Caddyfile`: a web server bound to `127.0.0.1:4190` that serves only the built site and sets the security headers
  (CSP, HSTS, anti-framing). It also redirects `www` and plain `http` to `https://pokemondle.io`.
- `cloudflared.yml`: the tunnel, which routes only `pokemondle.io` and `www` and returns 404 for anything else.
- `windows/install.ps1`: one-time setup, run from an elevated PowerShell. It installs a pinned, checksum-verified Caddy
  to `C:\ProgramData\Pokemondle`, creates the `PokemondleWeb` and `PokemondleTunnel` services (they start at boot,
  without anyone signing in) and registers the update task. All three run as the unprivileged LOCAL SERVICE account.
- `windows/update-site.ps1`: runs every 5 minutes, and installs a new build when there is one.

Merging to `main` is all a release takes. `deploy.yml` publishes the build, once lint and tests have passed, as `site.zip` on the
rolling `site-latest` GitHub release, and the PC picks it up within 5 minutes, checking the file's SHA-256 before switching over.
The PC never runs `npm` or builds anything. Logs are in `C:\ProgramData\Pokemondle\logs`.
After changing `deploy/Caddyfile` or `deploy/cloudflared.yml`, run `install.ps1` again to apply them, because merges only deliver the site.

The Cloudflare side is two proxied CNAME records, `@` and `www`, pointing at `<tunnel-id>.cfargotunnel.com`, plus
Web Analytics switched on for the site. To move to another machine, run `cloudflared tunnel create`, update the tunnel id
in `cloudflared.yml` and `install.ps1` and those two records, then run the install there. The Caddyfile also runs on Linux or macOS with `POKEMONDLE_HOME` set.

### GitHub Pages (fallback)

`.github/workflows/deploy.yml` also publishes `dist/` to GitHub Pages on every push to `main`
(or manually from the Actions tab), at https://lucasphanpersonal.github.io/pokemondle/. Saved games and stats are stored per site,
so progress on this address does not carry over to pokemondle.io. GitHub Pages cannot set the security headers above.

One-time setup: in the repo's **Settings → Pages → Build and deployment**, set **Source** to
**GitHub Actions**. GitHub Pages needs the repository to be public on a free plan.

Pull requests run the same lint, test and build checks (`.github/workflows/ci.yml`) without deploying, then a Playwright browser smoke test of the production build (`e2e/`, at 390px and 1280px; a failing run uploads its report as an artifact).

## Analytics (Supabase)

Anonymous player analytics run on a Supabase Edge Function. From the repo root:

```sh
npx supabase link --project-ref <project-ref>   # connect this repo to your Supabase project
npx supabase db push --remote --yes            # create the tables, views and daily roll-up job
npx supabase secrets set ALLOWED_ORIGINS="https://pokemondle.io,https://lucasphanpersonal.github.io"   # sites allowed to send events (set BEFORE deploying)
npx supabase functions deploy track --no-verify-jwt --yes   # deploy the event-collecting function
npx supabase functions deploy stats --no-verify-jwt --yes   # deploy the public daily-stats function
```

The function stores two salted hashes per event, a visitor hash (IP + user agent) and an IP-only hash used for a
second, higher flood cap. Both rotate daily with the salt and neither the raw IP nor the user agent is stored.

Secrets take effect on the function's next start; redeploy after changing them.
With Supabase CLI 3, `db push` targets a local database unless you pass `--remote`, and `--yes` skips the confirmation prompt for hosted projects. `link` creates `supabase/.temp/`, which is git-ignored.

The live project is `inxvlunfwsssifvjkgtz` (US); the client sends events to `https://inxvlunfwsssifvjkgtz.supabase.co/functions/v1/track`.

After the one-time setup, merging a change under `supabase/` to `main` deploys the migrations and both functions automatically
(`.github/workflows/supabase-deploy.yml`; needs the `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` repo secrets; the
Supabase CLI version there is pinned and bumped by hand). That workflow also sets `ALLOWED_ORIGINS` on every run, so change the list there. Local dev is deliberately not on it, so test games stay out of the real stats.
Dependabot (`.github/dependabot.yml`) opens weekly update PRs for npm packages and GitHub Actions.

See [supabase/README.md](supabase/README.md) for details.

To read the game stats (players, wins, guess counts, hardest Pokémon), paste the ready-made queries in
[supabase/queries/stats.sql](supabase/queries/stats.sql) into the Supabase SQL Editor. Traffic (visits, countries) is in Cloudflare Web Analytics.

### Client-side tracking and opting out

The game sends events to the `track` function only when `VITE_TRACK_URL` is set. `.env.production` sets it
(the URL is public), so production builds report; `npm run dev` does not unless you copy `.env.example` to
`.env.local`. Events are batched per game and sent when a game ends or the page is hidden or closed. A finished
game sends `game_finished` with `result: 'won'`, or `'lost'` when a game (Daily or Endless) is given up. A given-up
Daily counts toward the public Daily stats' players-finished total and solve rate, but not the guesses-to-solve chart.

Players can switch off "Share anonymous stats" in the Help screen (the "?" button), which also briefly explains that only
anonymous game events (guesses, results, device type, and whether the Gen hint was taken) are recorded. Players are opted out automatically if their browser sends Global Privacy Control (`navigator.globalPrivacyControl`)
or Do Not Track, or if `localStorage['pokemondle:analytics-opt-out']` is `'true'` (`setTrackingOptOut()` in
`src/lib/analytics.ts` sets it, and the Help switch calls it; the choice is also held in memory for the session if
storage is unavailable). When the browser sends GPC or Do Not Track, the
switch is shown off and disabled.

### Public daily stats

The Daily result screen reads totals from the `stats` Edge Function
(`GET /functions/v1/stats?date=YYYY-MM-DD`), which calls `public_daily_stats()` and returns only
`games_finished`, `wins`, `solve_rate`, `hinted` (finished games that took the Gen hint) and a guesses histogram. Nothing per-player and never the answer.
Each network (IP) counts at most once per puzzle and UTC day (migration `20261110010000_public_stats_one_per_visitor.sql`),
so one person cannot skew it by posting many finishes, and players sharing one Wi-Fi count as one. Totals are served
from the first finished game (there is no minimum any more), so the panel shows after every Daily. Responses are cached for 60 s.
The client derives the URL from `VITE_TRACK_URL` (`/track` becomes `/stats`). The panel (`src/components/DailyStats.tsx`)
always renders: "Counting today's players…" while loading; "You're the first to solve today's Pokémon!" when the server
has counted nobody yet (your own result is then added on the client so your bar shows);
otherwise players, average guesses and how you rank, plus "N gave up" and "N% used the Gen hint" lines. Players who
opted out (or send GPC / Do Not Track) get a note pointing to the Share anonymous stats switch instead of a request,
and a failed request says the stats can't be reached right now.


Every Daily counts together: migration `20261113220000_public_stats_hint.sql` replaced the old normal/Hard split
(`public_daily_stats(date, hard)` and the `?hard=1` parameter) with `public_daily_stats(date)`. Games from the Hard mode days
count as games without the hint. The migration drops the two-argument function, so the `stats` function must be redeployed
with it; the **Deploy Supabase** action does both on merge (migration first), and the panel just says the stats can't be
reached for the few seconds in between.

The player's own result is sent just before, so the fetch waits 1.5 s to usually include it. The function uses the
same `ALLOWED_ORIGINS` secret as `track`. Deploy order is migration first, then the function (the workflow does this);
the site can go live at any time, and the panel says the stats can't be reached until both are deployed.
