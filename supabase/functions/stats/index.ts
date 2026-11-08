// Supabase Edge Function: GET /functions/v1/stats?date=YYYY-MM-DD
// Public, read-only aggregates for one daily puzzle (players who finished, solve rate,
// guesses-to-win histogram). It only calls public_daily_stats(), which never returns the
// answer or anything per-player, and returns nothing at all until 5 games have finished.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { parseDate } from './params.ts'

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

function respond(status: number, origin: string | null, body?: unknown): Response {
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'content-type'
    headers['Access-Control-Max-Age'] = '86400'
  }
  if (status === 204) return new Response(null, { status, headers })
  headers['Content-Type'] = 'application/json'
  // A minute of caching keeps a busy day from hitting the database on every result screen.
  if (status === 200) headers['Cache-Control'] = 'public, max-age=60'
  return new Response(JSON.stringify(body ?? { error: 'error' }), { status, headers })
}

// The Origin check is CORS hygiene, not access control: the data is aggregate and public.
Deno.serve(async (req) => {
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? null
  if (!origin || !allowedOrigins.includes(origin)) return respond(403, null, { error: 'forbidden' })

  if (req.method === 'OPTIONS') return respond(204, origin)
  if (req.method !== 'GET') return respond(405, origin, { error: 'method_not_allowed' })

  const date = parseDate(new URL(req.url).searchParams.get('date'))
  if (!date) return respond(400, origin, { error: 'invalid_date' })

  const { data, error } = await supabase.rpc('public_daily_stats', { p_date: date })
  if (error) {
    // 22023 = the date is outside the range the database serves.
    if (error.code === '22023') return respond(400, origin, { error: 'date_out_of_range' })
    console.error('stats failed', error.code ?? 'unknown')
    return respond(500, origin, { error: 'server_error' })
  }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return respond(500, origin, { error: 'server_error' })
  return respond(200, origin, {
    games_finished: Number(row.games_finished),
    wins: row.wins === null ? null : Number(row.wins),
    solve_rate: row.solve_rate === null ? null : Number(row.solve_rate),
    histogram: row.histogram ?? {},
  })
})
