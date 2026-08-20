// ============================================================================
// SUPABASE EDGE FUNCTION — issue-id-card
// ----------------------------------------------------------------------------
// Steps two and three of member self-service card retrieval.
//
//   POST { action: 'verify', memberNo, code }  ->  { ok, cardToken, expiresInSeconds }
//   POST { action: 'claim',  cardToken }       ->  { ok, card: { ... } }
//
// WHY TWO ACTIONS AND NOT ONE
// Splitting the OTP check from the payload fetch means the request that
// actually carries a member's photo, signature and precinct never carries the
// code. A retry, a back button, or a screenshotted network log cannot re-fetch
// the payload — the token is single-use and dies on first exchange.
//
// This is the only endpoint on the site that returns photo_data and
// signature_data to an unauthenticated caller. Everything about it is written
// on that basis: single-use token, ten-minute ceiling, active members only,
// no-store on the response, and every outcome written to the audit log.
// ============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://bangonbangsamoro.com',
  'https://www.bangonbangsamoro.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MINUTES = 15

const MAX_OTP_ATTEMPTS = 3
const CARD_TOKEN_TTL_SECONDS = 600

const MEMBER_NO_PATTERN = /^PBB-\d{4}-[A-Z]{3}-\d{4,8}$/i
const CODE_PATTERN = /^\d{6}$/
const TOKEN_PATTERN = /^[0-9a-f]{64}$/i

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
      // A membership card in a shared proxy cache is the whole threat model.
      'Cache-Control': 'no-store',
    },
  })
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

async function hashIp(ip: string): Promise<string> {
  const salt = Deno.env.get('IP_HASH_SALT') || 'pbb-default-salt-change-me'
  return await sha256(`${salt}:${ip}`)
}

async function hashCode(memberId: string, code: string): Promise<string> {
  const pepper = Deno.env.get('OTP_PEPPER') || 'pbb-default-pepper-change-me'
  return await sha256(`${pepper}:${memberId}:${code}`)
}

function newToken(): string {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function isRateLimited(sb: SupabaseClient, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const { count, error } = await sb
    .from('id_card_issuance_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .in('event', ['otp_failed', 'card_denied'])
    .gte('created_at', since)

  if (error) {
    console.error('[issue-id-card] rate-limit check failed', error)
    return true // fail closed
  }
  return (count ?? 0) >= RATE_LIMIT_MAX
}

async function logEvent(
  sb: SupabaseClient,
  event: string,
  opts: { memberNo?: string | null; memberId?: string | null; detail?: string; ipHash?: string },
) {
  const { error } = await sb.from('id_card_issuance_log').insert({
    event,
    member_no: opts.memberNo ?? null,
    member_id: opts.memberId ?? null,
    detail: opts.detail ?? null,
    ip_hash: opts.ipHash ?? null,
  })
  if (error) console.error('[issue-id-card] audit write failed', error)
}

// ---------------------------------------------------------------------------
// action: verify
// ---------------------------------------------------------------------------

async function handleVerify(
  sb: SupabaseClient,
  payload: Record<string, unknown>,
  ipHash: string,
  origin: string | null,
): Promise<Response> {
  const memberNoRaw = String(payload.memberNo ?? '').trim()
  const code = String(payload.code ?? '').trim()

  if (!MEMBER_NO_PATTERN.test(memberNoRaw)) return json({ error: 'invalid_member_no' }, 400, origin)
  if (!CODE_PATTERN.test(code)) return json({ error: 'invalid_code' }, 400, origin)

  const memberNo = memberNoRaw.toUpperCase()

  // Resolve the member from the number alone, then check the code against the
  // OTP row. The phone is not re-supplied here: it was already proven in step
  // one, and asking for it again would put it on the wire a second time.
  const { data: member, error: memberErr } = await sb
    .from('members')
    .select('id, status')
    .ilike('member_no', memberNo)
    .maybeSingle()

  if (memberErr) {
    console.error('[issue-id-card] member lookup failed', memberErr)
    return json({ error: 'server_error' }, 500, origin)
  }

  if (!member || member.status !== 'active') {
    await logEvent(sb, 'otp_failed', { memberNo, detail: 'no active member', ipHash })
    return json({ error: 'invalid_code' }, 400, origin)
  }

  const { data: otp, error: otpErr } = await sb
    .from('phone_otp')
    .select('id, code_hash, expires_at, attempts')
    .eq('member_id', member.id)
    .eq('purpose', 'card_claim')
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (otpErr) {
    console.error('[issue-id-card] otp lookup failed', otpErr)
    return json({ error: 'server_error' }, 500, origin)
  }

  if (!otp || new Date(otp.expires_at).getTime() < Date.now()) {
    await logEvent(sb, 'otp_failed', { memberNo, memberId: member.id, detail: 'expired or absent', ipHash })
    return json({ error: 'code_expired' }, 400, origin)
  }

  if (otp.attempts >= MAX_OTP_ATTEMPTS) {
    await sb.from('phone_otp').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id)
    await logEvent(sb, 'otp_failed', { memberNo, memberId: member.id, detail: 'attempts exhausted', ipHash })
    return json({ error: 'too_many_attempts' }, 429, origin)
  }

  const supplied = await hashCode(member.id, code)

  if (supplied !== otp.code_hash) {
    await sb.from('phone_otp').update({ attempts: otp.attempts + 1 }).eq('id', otp.id)
    await logEvent(sb, 'otp_failed', { memberNo, memberId: member.id, detail: 'wrong code', ipHash })
    return json({ error: 'invalid_code', attemptsLeft: MAX_OTP_ATTEMPTS - otp.attempts - 1 }, 400, origin)
  }

  // Correct. Burn the code before issuing the token — if the insert below
  // fails, the member re-requests rather than the code staying live.
  await sb.from('phone_otp').update({ consumed_at: new Date().toISOString() }).eq('id', otp.id)

  const token = newToken()
  const { error: tokenErr } = await sb.from('id_card_tokens').insert({
    token_hash: await sha256(token),
    member_id: member.id,
    expires_at: new Date(Date.now() + CARD_TOKEN_TTL_SECONDS * 1000).toISOString(),
    ip_hash: ipHash,
  })

  if (tokenErr) {
    console.error('[issue-id-card] token insert failed', tokenErr)
    return json({ error: 'server_error' }, 500, origin)
  }

  await logEvent(sb, 'otp_verified', { memberNo, memberId: member.id, ipHash })

  return json({ ok: true, cardToken: token, expiresInSeconds: CARD_TOKEN_TTL_SECONDS }, 200, origin)
}

// ---------------------------------------------------------------------------
// action: claim
// ---------------------------------------------------------------------------

async function handleClaim(
  sb: SupabaseClient,
  payload: Record<string, unknown>,
  ipHash: string,
  origin: string | null,
): Promise<Response> {
  const token = String(payload.cardToken ?? '').trim()
  if (!TOKEN_PATTERN.test(token)) return json({ error: 'invalid_token' }, 400, origin)

  const { data, error } = await sb.rpc('claim_member_card', { p_token_hash: await sha256(token) })

  if (error) {
    console.error('[issue-id-card] claim failed', error)
    return json({ error: 'server_error' }, 500, origin)
  }

  const row = Array.isArray(data) ? data[0] : data
  if (!row) {
    await logEvent(sb, 'card_denied', { detail: 'token invalid, expired, or already used', ipHash })
    return json({ error: 'token_invalid' }, 400, origin)
  }

  await logEvent(sb, 'card_issued', { memberNo: row.member_no, ipHash })

  return json(
    {
      ok: true,
      // Field names match what PBB.idCard.renderFront/renderBack read, so the
      // browser hands the response straight to the renderer with no mapping
      // layer that could drift out of step with the card design.
      card: {
        memberNo: row.member_no,
        fullName: row.full_name,
        chapter: row.chapter,
        province: row.province,
        municipality: row.municipality,
        barangay: row.barangay,
        precinct: row.precinct_no,
        photo: row.photo_data,
        signature: row.signature_data,
        issuedAt: row.issued_at,
        validUntil: row.valid_until,
      },
    },
    200,
    origin,
  )
}

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
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

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, origin)
  }

  const sb = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown'
  const ipHash = await hashIp(ip)

  if (await isRateLimited(sb, ipHash)) {
    return json({ error: 'rate_limited', retryAfterMinutes: RATE_LIMIT_WINDOW_MINUTES }, 429, origin)
  }

  const action = String(payload.action ?? '')
  if (action === 'verify') return await handleVerify(sb, payload, ipHash, origin)
  if (action === 'claim') return await handleClaim(sb, payload, ipHash, origin)
  return json({ error: 'invalid_action' }, 400, origin)
})
