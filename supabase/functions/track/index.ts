// Supabase Edge Function: POST /functions/v1/track
// Accepts batched analytics events, validates them against an allow-list,
// derives a daily-rotating anonymous visitor hash, and inserts with the service role.
// The IP and user agent are only used to compute salted hashes and are never stored.
import { createClient } from 'npm:@supabase/supabase-js@2.119.0'
import { validateBatch } from './validate.ts'

const MAX_BODY_BYTES = 64 * 1024
// Abuse backstop only, not a fair-use limit. The visitor hash is IP + user agent, so everyone on one
// Wi-Fi network (home, school, office) with the same browser shares a single hash and a single budget.
// A heavy Endless player is ~10 events per game, so 5000 covers ~500 games or a classroom of players.
// Override with the MAX_EVENTS_PER_VISITOR_PER_DAY function secret without a code change.
const MAX_EVENTS_PER_VISITOR_PER_DAY = Math.max(
  1,
  Number(Deno.env.get('MAX_EVENTS_PER_VISITOR_PER_DAY')) || 5000,
)

// Second cap keyed on the IP alone. The per-visitor cap above includes the user agent, so rotating the
// User-Agent would give unlimited budget; this one cannot be dodged that way. It is higher because a
// whole school or office can sit behind one IP. Override with the MAX_EVENTS_PER_IP_PER_DAY secret.
const MAX_EVENTS_PER_IP_PER_DAY = Math.max(
  1,
  Number(Deno.env.get('MAX_EVENTS_PER_IP_PER_DAY')) || 20000,
)

const allowedOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
)

function respond(status: number, origin: string | null, error?: string): Response {
  const headers: Record<string, string> = { Vary: 'Origin' }
  if (origin) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
    headers['Access-Control-Allow-Headers'] = 'content-type'
    headers['Access-Control-Max-Age'] = '86400'
  }
  if (status === 204) return new Response(null, { status, headers })
  headers['Content-Type'] = 'application/json'
  return new Response(JSON.stringify({ error: error ?? 'error' }), { status, headers })
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
}

async function getDailySalt(day: string): Promise<string> {
  const read = async () => {
    const { data, error } = await supabase.from('daily_salts').select('salt').eq('day', day).maybeSingle()
    if (error) throw error
    return data?.salt as string | undefined
  }
  const existing = await read()
  if (existing) return existing
  const fresh = hex(crypto.getRandomValues(new Uint8Array(32)).buffer)
  const { error } = await supabase
    .from('daily_salts')
    .upsert({ day, salt: fresh }, { onConflict: 'day', ignoreDuplicates: true })
  if (error) throw error
  // Privacy housekeeping that does not depend on pg_cron: drop salts older than 2 days.
  const cutoff = new Date(Date.parse(`${day}T00:00:00Z`) - 2 * 86_400_000).toISOString().slice(0, 10)
  const { error: delError } = await supabase.from('daily_salts').delete().lt('day', cutoff)
  if (delError) console.error('salt cleanup failed')
  const salt = await read()
  if (!salt) throw new Error('salt missing')
  return salt
}

function clientIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip')?.trim()
  if (cf) return cf
  const real = req.headers.get('x-real-ip')?.trim()
  if (real) return real
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
}

// The Origin check is CORS hygiene, not access control (non-browser clients can forge it).
// The real defences are validation and the per-visitor and per-IP rate limits.
Deno.serve(async (req) => {
  const origin = req.headers.get('origin')?.replace(/\/$/, '') ?? null
  if (!origin || !allowedOrigins.includes(origin)) return respond(403, null, 'forbidden')

  if (req.method === 'OPTIONS') return respond(204, origin)
  if (req.method !== 'POST') return respond(405, origin, 'method_not_allowed')

  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return respond(413, origin, 'too_large')

  let body: unknown
  try {
    const text = await req.text() // works for application/json and text/plain (sendBeacon)
    if (text.length > MAX_BODY_BYTES) return respond(413, origin, 'too_large')
    body = JSON.parse(text)
  } catch {
    return respond(400, origin, 'invalid_json')
  }

  const result = validateBatch(body)
  if (!result.ok) return respond(400, origin, result.error)

  try {
    const now = new Date()
    const day = now.toISOString().slice(0, 10)
    const salt = await getDailySalt(day)
    // Without any IP, do not pool everyone into one visitor: mix in a random value
    // and skip the rate limit for this request.
    const ip = clientIp(req)
    const identity = ip || hex(crypto.getRandomValues(new Uint8Array(16)).buffer)
    const visitorHash = await sha256(`${salt}|${identity}|${req.headers.get('user-agent') ?? ''}`)

    // Salted hash of the IP alone (rotates daily like visitor_hash; the raw IP is never stored).
    const ipHash = ip ? await sha256(`${salt}|ip|${ip}`) : null

    if (ip && ipHash) {
      const { count, error: countError } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('visitor_hash', visitorHash)
        .gte('received_at', `${day}T00:00:00Z`)
      if (countError) throw countError
      if ((count ?? 0) + result.rows.length > MAX_EVENTS_PER_VISITOR_PER_DAY) {
        // Not silent: visible in Edge Functions > track > Logs, so a too-low cap shows up quickly.
        console.warn('rate_limited', { existing: count ?? 0, incoming: result.rows.length })
        return respond(429, origin, 'rate_limited')
      }

      const { count: ipCount, error: ipCountError } = await supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('received_at', `${day}T00:00:00Z`)
      if (ipCountError) throw ipCountError
      if ((ipCount ?? 0) + result.rows.length > MAX_EVENTS_PER_IP_PER_DAY) {
        console.warn('rate_limited_ip', { existing: ipCount ?? 0, incoming: result.rows.length })
        return respond(429, origin, 'rate_limited')
      }
    }

    // Retries/duplicates are silently ignored (unique on game_id, event, guess_number).
    const { error } = await supabase
      .from('events')
      .upsert(
        result.rows.map((r) => ({ ...r, visitor_hash: visitorHash, ip_hash: ipHash })),
        { onConflict: 'game_id,event,guess_number', ignoreDuplicates: true },
      )
    if (error) throw error
    return respond(204, origin)
  } catch (err) {
    console.error('track failed', err instanceof Error ? err.message : 'unknown')
    return respond(500, origin, 'server_error')
  }
})
