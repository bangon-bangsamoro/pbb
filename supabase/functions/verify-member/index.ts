// ============================================================================
// SUPABASE EDGE FUNCTION — verify-member
// ----------------------------------------------------------------------------
// Public lookup behind the QR code on every PBB Membership ID.
// /verify.html?m=PBB-2026-MDN-004821  ->  this function  ->  verify_member()
//
// WHAT IT DELIBERATELY DOES NOT DO
// It does not return the member's phone number, address, precinct, photo, or
// full name. Membership in a political party is SENSITIVE personal information
// under the Data Privacy Act (RA 10173); an endpoint that echoed those fields
// back would be a queryable directory of who supports whom — in a region where
// that information has, historically, put people at risk.
//
// What a person checking an ID at a rally actually needs is narrow: is this
// real, which chapter issued it, is it still valid. That is all this returns,
// with the name masked to first name plus surname initial so it can be matched
// against the printed card without the endpoint becoming a lookup service.
//
// ENUMERATION
// Membership numbers are sequential per province, so they are guessable by
// design (that is what makes them usable over the phone). The defence is not
// secrecy of the number — it is the rate limit below plus the thinness of the
// response. Scraping this endpoint yields, at most, a list of chapter names.
// ============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://bangonbangsamoro.com',
  'https://www.bangonbangsamoro.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

// Tighter than the submission endpoint: a human checking IDs at a checkpoint
// might do 20 in an hour; a scraper does 20 in a second.
const RATE_LIMIT_MAX = 20
const RATE_LIMIT_WINDOW_MINUTES = 10

// PBB-2026-MDN-004821
const MEMBER_NO_PATTERN = /^PBB-\d{4}-[A-Z]{3}-\d{4,8}$/i

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(origin),
      'Content-Type': 'application/json',
      // Never let a proxy or the browser cache an identity lookup.
      'Cache-Control': 'no-store',
    },
  })
}

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get('IP_HASH_SALT') || 'pbb-default-salt-change-me'
  const data = new TextEncoder().encode(`${salt}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function isRateLimited(sb: SupabaseClient, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const { count, error } = await sb
    .from('submission_throttle')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .eq('form_type', 'verify')
    .gte('created_at', since)

  if (error) {
    console.error('[verify-member] rate-limit check failed', error)
    return false
  }
  return (count ?? 0) >= RATE_LIMIT_MAX
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin)
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return json({ error: 'origin_not_allowed' }, 403, origin)
  }

  let body: { memberNo?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, origin)
  }

  const memberNo = String(body.memberNo ?? '').trim().toUpperCase()

  // Shape-check before touching the database. A malformed number is not a
  // lookup, it is noise, and answering it costs a query.
  if (!MEMBER_NO_PATTERN.test(memberNo)) {
    return json({ status: 'not_found', reason: 'malformed' }, 200, origin)
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  const ipHash = await hashIp(ip)

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )

  if (await isRateLimited(sb, ipHash)) {
    return json({ error: 'rate_limited', retryAfterMinutes: RATE_LIMIT_WINDOW_MINUTES }, 429, origin)
  }

  const { data, error } = await sb.rpc('verify_member', { p_member_no: memberNo })

  // Record the attempt whether or not it matched, so enumeration is throttled
  // the same as legitimate use.
  await sb.from('submission_throttle').insert({ ip_hash: ipHash, form_type: 'verify' })

  if (error) {
    console.error('[verify-member] rpc failed', error)
    return json({ error: 'internal_error' }, 500, origin)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row || row.status === 'not_found') {
    return json({ status: 'not_found' }, 200, origin)
  }

  return json({
    status: row.status,          // valid | expired | pending | inactive
    memberNo: row.member_no,
    maskedName: row.masked_name,
    chapter: row.chapter,
    issuedAt: row.issued_at,
    validUntil: row.valid_until,
  }, 200, origin)
})
