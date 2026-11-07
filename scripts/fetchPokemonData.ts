/**
 * Builds src/data/pokemon.json from PokéAPI.
 *
 *   npm run fetch-data
 *
 * Pulls every Pokémon entry (Gen 1-9, including regional forms, Megas,
 * Gigantamax and other alternate forms), joins in species colour, generation
 * and evolution stage, and writes a compact dataset the game loads locally.
 *
 * Source: https://pokeapi.co/api/v2. If that host can't be reached, the script
 * falls back to PokéAPI's official static mirror on GitHub (PokeAPI/api-data),
 * which serves the same JSON. Set POKEAPI_SOURCE=live|mirror to force one.
 *
 * Responses are cached in scripts/.cache so re-runs are fast and polite.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Pokemon } from '../src/types/pokemon.ts'
import {
  type ApiEvolutionNode,
  type ApiAbility,
  type ApiName,
  type ApiPokemon,
  type ApiPokemonForm,
  type NamedRef,
  abilitySlugs,
  categorize,
  displayName,
  englishName,
  evolutionStage,
  generationNumber,
  idFromUrl,
  sortedTypes,
  titleCase,
} from './lib/transform.ts'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const OUT_FILE = path.join(ROOT, 'src/data/pokemon.json')
const CACHE_DIR = path.join(ROOT, 'scripts/.cache')

const LIVE_BASE = 'https://pokeapi.co'
const MIRROR_BASE = 'https://raw.githubusercontent.com/PokeAPI/api-data/master/data'
const CONCURRENCY = 12

type Source = 'live' | 'mirror'
const forcedSource = process.env.POKEAPI_SOURCE
if (forcedSource && forcedSource !== 'live' && forcedSource !== 'mirror') {
  throw new Error(`POKEAPI_SOURCE must be "live" or "mirror", got "${forcedSource}"`)
}
let source: Source = (forcedSource as Source | undefined) ?? 'live'

const REQUEST_TIMEOUT_MS = 20_000

/** Normalizes "/api/v2/pokemon/37" or a full pokeapi.co URL to "/api/v2/pokemon/37/". */
function toPath(resource: string): string {
  const p = resource.replace(/^https?:\/\/pokeapi\.co/, '')
  return p.endsWith('/') ? p : `${p}/`
}

function requestUrl(apiPath: string, query = ''): string {
  return source === 'live' ? `${LIVE_BASE}${apiPath}${query}` : `${MIRROR_BASE}${apiPath}index.json`
}

class HttpError extends Error {
  readonly status: number
  constructor(status: number, url: string) {
    super(`HTTP ${status} for ${url}`)
    this.status = status
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchWithRetry(url: string, attempts = 4): Promise<unknown> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    let waitMs = 500 * 2 ** i
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
      if (res.ok) return await res.json()
      const err = new HttpError(res.status, url)
      // Client errors other than rate limiting won't succeed on retry.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) throw err
      const retryAfter = Number(res.headers.get('retry-after'))
      if (res.status === 429 && retryAfter > 0) waitMs = retryAfter * 1000
      lastError = err
    } catch (err) {
      if (err instanceof HttpError && err.status !== 429 && err.status < 500) throw err
      lastError = err
    }
    await sleep(waitMs)
  }
  throw lastError
}

const memo = new Map<string, Promise<unknown>>()

/** Cached GET of a PokéAPI resource path. */
function get<T>(resource: string): Promise<T> {
  const apiPath = toPath(resource)
  let pending = memo.get(apiPath)
  if (!pending) {
    pending = (async () => {
      const cacheFile = path.join(CACHE_DIR, `${apiPath.replace(/^\/api\/v2\//, '').replace(/\/$/, '').replaceAll('/', '_')}.json`)
      try {
        return JSON.parse(await readFile(cacheFile, 'utf8'))
      } catch {
        const data = await fetchWithRetry(requestUrl(apiPath))
        // Write-then-rename so an interrupted run never leaves a truncated cache file.
        const tmp = `${cacheFile}.${process.pid}.tmp`
        await writeFile(tmp, JSON.stringify(data))
        await rename(tmp, cacheFile)
        return data
      }
    })()
    memo.set(apiPath, pending)
  }
  return pending as Promise<T>
}

async function pickSource(): Promise<void> {
  if (process.env.POKEAPI_SOURCE) return
  try {
    const res = await fetch(`${LIVE_BASE}/api/v2/pokemon/1/`, { signal: AbortSignal.timeout(8000) })
    if (res.ok) return
  } catch {
    // fall through to mirror
  }
  source = 'mirror'
  console.warn('pokeapi.co is unreachable; using the PokeAPI/api-data mirror on GitHub.')
}

/** Runs `fn` over `items` with bounded concurrency, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  let done = 0
  const worker = async () => {
    while (next < items.length) {
      const i = next++
      results[i] = await fn(items[i], i)
      done++
      if (done % 100 === 0 || done === items.length) process.stdout.write(`\r  ${done}/${items.length}`)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  process.stdout.write('\n')
  return results
}

interface ApiSpecies {
  name: string
  names: ApiName[]
  color: NamedRef
  generation: NamedRef
  evolution_chain: { url: string } | null
  varieties: { is_default: boolean; pokemon: NamedRef }[]
}

interface ApiList {
  count: number
  results: NamedRef[]
}

/**
 * The full /pokemon list. Live: one request with a large limit (not cached, so
 * new Pokémon show up). Mirror: its index.json already holds every entry.
 * Fails loudly if the list is incomplete rather than writing a partial dataset.
 */
async function fetchPokemonList(): Promise<ApiList> {
  const list = (await fetchWithRetry(requestUrl('/api/v2/pokemon/', '?limit=100000&offset=0'))) as ApiList
  if (!Array.isArray(list.results) || list.results.length !== list.count) {
    throw new Error(`Incomplete Pokémon list: got ${list.results?.length} of ${list.count}`)
  }
  return list
}

async function main() {
  await mkdir(CACHE_DIR, { recursive: true })
  await pickSource()
  console.log(`Source: ${source === 'live' ? LIVE_BASE : MIRROR_BASE}`)

  const list = await fetchPokemonList()
  console.log(`Fetching ${list.results.length} Pokémon entries...`)

  const entries = await mapLimit(list.results, CONCURRENCY, async (ref) => {
    const p = await get<ApiPokemon>(ref.url)
    const species = await get<ApiSpecies>(p.species.url)
    const defaultRef = species.varieties.find((v) => v.is_default)?.pokemon ?? p.species
    const base = p.is_default ? p : await get<ApiPokemon>(defaultRef.url)
    const form = p.forms[0] ? await get<ApiPokemonForm>(p.forms[0].url) : null
    const chain = species.evolution_chain
      ? await get<{ chain: ApiEvolutionNode }>(species.evolution_chain.url)
      : null

    const speciesGen = generationNumber(species.generation.name)
    let generation = speciesGen
    if (!p.is_default && form) {
      const vg = await get<{ generation: NamedRef }>(form.version_group.url)
      // A form can't predate its species (guards against odd version-group data).
      generation = Math.max(speciesGen, generationNumber(vg.generation.name))
    }

    const abilities = await Promise.all(
      abilitySlugs(p).map(async (ref) => {
        const a = await get<ApiAbility>(ref.url)
        return (englishName(a.names) ?? titleCase(a.name)).replaceAll('\u2019', "'")
      }),
    )

    const [type1, type2] = sortedTypes(p)
    const speciesName = englishName(species.names) ?? species.name

    const entry: Pokemon = {
      id: p.id,
      dexNumber: idFromUrl(p.species.url),
      name: displayName(p, form, speciesName),
      type1,
      type2,
      generation,
      height: p.height / 10,
      weight: p.weight / 10,
      color: species.color.name[0].toUpperCase() + species.color.name.slice(1),
      abilities,
      evolutionStage: chain ? evolutionStage(chain.chain, species.name) : 1,
      formCategory: categorize(p, form, base),
    }
    return entry
  })

  // Make display names unique, since search and guesses key on them.
  const seen = new Map<string, number>()
  for (const e of entries) seen.set(e.name, (seen.get(e.name) ?? 0) + 1)
  const dupes = entries.filter((e) => (seen.get(e.name) ?? 0) > 1)
  for (const e of dupes) {
    const slug = list.results.find((r) => idFromUrl(r.url) === e.id)!.name
    e.name = `${e.name} [${slug}]`
  }
  if (dupes.length) console.warn(`Disambiguated ${dupes.length} duplicate names.`)

  entries.sort((a, b) => a.dexNumber - b.dexNumber || a.id - b.id)

  // One entry per line keeps diffs readable when the data is regenerated.
  const json = `[\n${entries.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`
  await writeFile(OUT_FILE, json)

  const counts = entries.reduce<Record<string, number>>((acc, e) => {
    acc[e.formCategory] = (acc[e.formCategory] ?? 0) + 1
    return acc
  }, {})
  console.log(`Wrote ${entries.length} entries to ${path.relative(ROOT, OUT_FILE)}`, counts)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
