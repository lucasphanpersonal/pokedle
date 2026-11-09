import { expect, test, type Page } from '@playwright/test'
import { decodeSave } from '../src/lib/game'
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
  await guess(page, 'Bulbasaur')
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)

  const game = (await savedGame(page, 'daily'))!
  const answer = names.get(game.targetId)!
  if (answer === 'Bulbasaur') test.skip(true, 'Bulbasaur is today’s answer; the win path is covered by the next guess')
  await guess(page, answer)

  const result = page.getByRole('dialog')
  await expect(result).toBeVisible({ timeout: 15_000 })
  await expect(result).toContainText('Gotcha!')
  await expect(result).toContainText(answer)

  // Progress is saved: after a reload the finished game is still there.
  await page.reload()
  await expect(guessBox(page)).toBeDisabled()
})

test('a repeat guess is rejected', async ({ page }) => {
  await page.goto('/')
  await guess(page, 'Pidgey')
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)
  await guessBox(page).fill('Pidgey')
  // Already-guessed Pokémon are removed from the suggestions.
  await expect(option(page, 'Pidgey')).toHaveCount(0)
})

test('switching to Endless and back keeps each mode separate', async ({ page }) => {
  await page.goto('/')
  await guess(page, 'Rattata')
  await expect.poll(async () => (await savedGame(page, 'daily'))?.guessIds).toHaveLength(1)

  await page.getByRole('radio', { name: 'endless' }).click()
  await expect(page.getByRole('radio', { name: 'endless' })).toBeChecked()
  await expect(guessBox(page)).toBeEnabled()
  await guess(page, 'Caterpie')
  await expect.poll(async () => (await savedGame(page, 'endless'))?.guessIds).toHaveLength(1)

  await page.getByRole('radio', { name: 'daily' }).click()
  await expect(page.getByRole('radio', { name: 'daily' })).toBeChecked()
  const daily = await savedGame(page, 'daily')
  expect(daily!.guessIds).toHaveLength(1)
  expect(names.get(daily!.guessIds[0])).toBe('Rattata')
})
