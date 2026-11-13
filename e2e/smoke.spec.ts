import { expect, test, type Page } from '@playwright/test'
import { decodeSave } from '../src/lib/game.ts'
import pokedex from '../src/data/pokemon.json' with { type: 'json' }

// The game must keep working end to end: load, guess, win, and switch modes.
// Runs at 390px (phone) and 1280px (desktop); see playwright.config.ts.

const names = new Map((pokedex as { id: number; name: string }[]).map((p) => [p.id, p.name]))

test.beforeEach(async ({ page }) => {
  // No real network: analytics and sprites are stubbed so the run is fast and offline-safe.
  await page.route('**/functions/v1/**', (r) =>
    r.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*' } }),
  )
  await page.route(/pokeapi\.co|raw\.githubusercontent\.com/, (r) => r.abort())
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('e2e-init')) {
      localStorage.setItem('pokemondle:seen-help', 'true') // skip the first-visit Help dialog
      sessionStorage.setItem('e2e-init', '1')
    }
  })
})

// An option's accessible name also holds its dex number, so match on the name text inside it.
const option = (page: Page, name: string) =>
  page.getByRole('option').filter({ has: page.getByText(name, { exact: true }) })

const guessBox = (page: Page) => page.getByRole('combobox', { name: 'Guess a Pokémon' })

async function guess(page: Page, name: string) {
  await guessBox(page).fill(name)
  await option(page, name).click()
}

// The saved game hides its answer (obfuscated), so decode it with the app's own function.
async function savedGame(page: Page, key: string) {
  const raw = await page.evaluate((k) => JSON.parse(localStorage.getItem(`pokemondle:${k}`) ?? 'null'), key)
  return decodeSave(raw) as { guessIds: number[]; targetId: number } | null
}

// The answer is random (Endless) or rotates daily, so never guess a fixed name blindly:
// take the first candidate that is not the current answer, so a game never ends early by chance.
async function nonAnswer(page: Page, mode: 'daily' | 'endless', candidates: string[]) {
  await expect.poll(async () => (await savedGame(page, mode))?.targetId).toBeDefined()
  const target = names.get((await savedGame(page, mode))!.targetId)
  return candidates.find((n) => n !== target)!
}

test('loads the game with the guess box and mode toggle', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('/')
  await expect(guessBox(page)).toBeVisible()
  await expect(page.getByRole('radio', { name: 'daily' })).toBeChecked()
  await expect(page.getByRole('radio', { name: 'endless' })).not.toBeChecked()
  await expect(page.getByRole('button', { name: 'How to play' })).toBeVisible()
  // No horizontal scroll at this width.
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('guessing, winning, and surviving a reload', async ({ page }) => {
  await page.goto('/')
  await guess(page, await nonAnswer(page, 'daily', ['Bulbasaur', 'Charmander']))
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)

  const answer = names.get((await savedGame(page, 'daily'))!.targetId)!
  await guess(page, answer)

  const result = page.getByRole('dialog')
  // The row flips in, then the Poké Ball shakes and clicks; a tap skips the rest.
  const scene = page.locator('[data-capture="catch"]')
  await expect(scene).toBeVisible({ timeout: 15_000 })
  await expect(scene).toContainText('Go! Poké Ball!')
  await scene.click()
  await expect(scene).toHaveCount(0)
  await expect(result).toBeVisible()
  await expect(result).toContainText('Gotcha!')
  await expect(result).toContainText(answer)

  // Progress is saved: after a reload the finished game is still there.
  await page.reload()
  await expect(guessBox(page)).toBeDisabled()
})

test('reduced motion: no catch scene, the result shows straight away', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  await expect.poll(async () => (await savedGame(page, 'daily'))?.targetId).toBeDefined()
  const answer = names.get((await savedGame(page, 'daily'))!.targetId)!
  await guess(page, answer)
  await expect(page.getByRole('dialog')).toContainText('Gotcha!')
  await expect(page.locator('[data-capture]')).toHaveCount(0)
})

test('a key skips the escape scene', async ({ page }) => {
  await page.goto('/')
  await guess(page, await nonAnswer(page, 'daily', ['Pidgey', 'Zubat']))
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)
  await page.getByRole('button', { name: 'Give up' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Give up' }).click()
  const scene = page.locator('[data-capture="escape"]')
  await expect(scene).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(scene).toHaveCount(0)
  // The key only skipped: the result screen is open, not closed or acted on.
  await expect(page.getByRole('dialog')).toContainText('It got away!')
})

test('a repeat guess is rejected', async ({ page }) => {
  await page.goto('/')
  const first = await nonAnswer(page, 'daily', ['Pidgey', 'Zubat'])
  await guess(page, first)
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)
  await guessBox(page).fill(first)
  // Already-guessed Pokémon are removed from the suggestions.
  await expect(option(page, first)).toHaveCount(0)
})

test('switching to Endless and back keeps each mode separate', async ({ page }) => {
  await page.goto('/')
  const dailyGuess = await nonAnswer(page, 'daily', ['Rattata', 'Spearow'])
  await guess(page, dailyGuess)
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)

  await page.getByRole('radio', { name: 'endless' }).click()
  await expect(page.getByRole('radio', { name: 'endless' })).toBeChecked()
  await expect(guessBox(page)).toBeEnabled()
  await guess(page, await nonAnswer(page, 'endless', ['Caterpie', 'Weedle']))
  await expect.poll(async () => (await savedGame(page, 'endless'))?.guessIds).toHaveLength(1)

  await page.getByRole('radio', { name: 'daily' }).click()
  await expect(page.getByRole('radio', { name: 'daily' })).toBeChecked()
  const daily = await savedGame(page, 'daily')
  expect(daily!.guessIds).toHaveLength(1)
  expect(names.get(daily!.guessIds[0])).toBe(dailyGuess)
})

test('Endless Gens: the answer comes only from the chosen generations', async ({ page }) => {
  const gens = new Map((pokedex as { id: number; generation: number }[]).map((p) => [p.id, p.generation]))
  await page.goto('/')
  // The picker is Endless only.
  await expect(page.getByRole('button', { name: /^Gens · / })).toHaveCount(0)
  await page.getByRole('radio', { name: 'endless' }).click()
  await page.getByRole('button', { name: 'Gens · All' }).click()

  const dialog = page.getByRole('dialog', { name: 'Endless Gens' })
  await dialog.getByRole('button', { name: 'None' }).click()
  // At least one Gen is needed.
  await expect(dialog.getByRole('button', { name: 'OK' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Gen 4' }).click()
  await expect(dialog.getByRole('button', { name: 'Gen 4' })).toHaveAttribute('aria-pressed', 'true')
  await dialog.getByRole('button', { name: 'OK' }).click()

  await expect(page.getByText('Endless · Gen 4')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Gens · 1/9' })).toBeVisible()
  // No guesses yet, so the answer was redrawn from Gen 4 straight away.
  await expect.poll(async () => gens.get((await savedGame(page, 'endless'))!.targetId)).toBe(4)

  // Guesses from other Gens are still allowed, and the choice survives a reload.
  await guess(page, 'Bulbasaur')
  await expect.poll(async () => (await savedGame(page, 'endless'))?.guessIds).toHaveLength(1)
  // Once the game has a guess the button is locked: tapping it explains why instead of opening the picker.
  await page.getByRole('button', { name: 'Gens · 1/9' }).click({ force: true }) // aria-disabled, but still tappable
  await expect(page.getByText(/Gens are locked for this game/)).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  // Giving up ends the game, which unlocks the picker again.
  await page.getByRole('button', { name: 'Give up' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Give up' }).click()
  // The ball bursts first; then the result screen. Escape closes it.
  await expect(page.getByRole('dialog')).toContainText('It got away!')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Gens · 1/9' }).click()
  await expect(page.getByRole('dialog', { name: 'Endless Gens' })).toBeVisible()
  await page.keyboard.press('Escape')
  await page.reload()
  await page.getByRole('radio', { name: 'endless' }).click()
  await expect(page.getByText('Endless · Gen 4')).toBeVisible()
  expect(gens.get((await savedGame(page, 'endless'))!.targetId)).toBe(4)
})

test('giving up the Daily asks first, ends the game and is listed in History', async ({ page }) => {
  await page.goto('/')
  const giveUp = page.getByRole('button', { name: 'Give up' })
  // Shown but locked before the first guess: a tap explains why instead of asking.
  await expect(giveUp).toHaveAttribute('aria-disabled', 'true')
  await giveUp.click({ force: true }) // Playwright treats aria-disabled as not clickable; a real tap still lands
  await expect(page.getByText('Give up unlocks after your first guess.')).toBeVisible()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await guess(page, await nonAnswer(page, 'daily', ['Oddish', 'Paras']))
  await expect(giveUp).not.toHaveAttribute('aria-disabled')

  await giveUp.click()
  const ask = page.getByRole('dialog')
  await expect(ask).toContainText("can't play it again")
  await ask.getByRole('button', { name: 'Keep going' }).click()
  await expect(guessBox(page)).toBeEnabled()

  await giveUp.click()
  await page.getByRole('dialog').getByRole('button', { name: 'Give up' }).click()
  const answer = names.get((await savedGame(page, 'daily'))!.targetId)!
  // The Poké Ball bursts and the answer runs off, then the result screen shows.
  const scene = page.locator('[data-capture="escape"]')
  await expect(scene).toContainText('Oh no! The Pokémon broke free!')
  const result = page.getByRole('dialog')
  await expect(result).toContainText('It got away!')
  await expect(scene).toHaveCount(0)
  await expect(result).toContainText(answer)

  // The loss survives a reload, and History lists it.
  await page.reload()
  await expect(guessBox(page)).toBeDisabled()
  await expect(giveUp).toHaveAttribute('aria-disabled', 'true')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /History/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Gave up')
})

test('Gen hint: offered after 5 guesses, optional, and shown for the rest of the game', async ({ page }) => {
  // Reduced motion: the hint text appears at once, so one Enter closes it.
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')
  // There is no Gen column any more.
  await guess(page, await nonAnswer(page, 'daily', ['Pidgey', 'Zubat']))
  await expect(page.getByRole('columnheader', { name: 'Gen' })).toHaveCount(0)
  for (const pair of [['Rattata', 'Spearow'], ['Caterpie', 'Weedle'], ['Ekans', 'Sandshrew'], ['Oddish', 'Paras']]) {
    await expect(page.getByRole('alertdialog', { name: 'Gen hint' })).toHaveCount(0)
    await guess(page, await nonAnswer(page, 'daily', pair))
  }
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(5)

  // After the fifth guess the offer pops up; Not now keeps a button for later.
  const prompt = page.getByRole('alertdialog', { name: 'Gen hint' })
  await expect(prompt).toBeVisible({ timeout: 15_000 })
  await prompt.getByRole('button', { name: 'Not now' }).click()
  await expect(prompt).toHaveCount(0)
  const hintButton = page.getByRole('button', { name: 'Gen hint' })
  await expect(hintButton).toBeVisible()

  // It isn't offered again after a reload.
  await page.reload()
  await expect(guessBox(page)).toBeEnabled()
  await expect(prompt).toHaveCount(0)

  const target = (await savedGame(page, 'daily'))!.targetId
  const gen = (pokedex as { id: number; generation: number }[]).find((p) => p.id === target)!.generation
  await hintButton.click()
  await prompt.getByRole('button', { name: 'Show Gen' }).click()
  await expect(prompt).toContainText(`from Gen ${gen}`)
  await page.keyboard.press('Enter')
  await expect(prompt).toHaveCount(0)
  await expect(page.getByText(`Hint: it's from Gen ${gen}`)).toBeVisible()
  await expect(hintButton).toHaveCount(0)
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('pokemondle:daily') ?? '{}').hinted)).toBe(true)
})
