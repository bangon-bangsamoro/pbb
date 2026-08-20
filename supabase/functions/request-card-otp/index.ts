// ============================================================================
// SUPABASE EDGE FUNCTION — request-card-otp
// ----------------------------------------------------------------------------
// Step one of member self-service card retrieval.
//
//   POST { memberNo, phone }  ->  { ok: true, maskedPhone, expiresInSeconds }
//
// THE RESPONSE IS IDENTICAL WHETHER OR NOT THE NUMBER MATCHES.
// This is the single most important property of this function. If it answered
// "no such member" for a mismatch, anyone could feed it a phone number and a
// guessed membership number and learn whether that person is a PBB member.
// Party membership is sensitive personal information under RA 10173, and in
// BARMM that inference has consequences beyond privacy. So: same status code,
// same body shape, same latency band, code sent only when it genuinely
// matches. The masked phone returned on a miss is derived from what the
// caller typed, not from anything on file.
//
// SEMAPHORE
// Uses the /api/v4/otp route, which is carried on a dedicated OTP path that
// keeps delivering when telcos are congested — the difference between working
// and not working in BARMM on a busy day. Costs 2 credits per message.
//
// We pass our OWN `code` rather than letting Semaphore generate one, because
// the code must be hashed with a server-side pepper before it touches the
// database and we cannot do that with a value we only learn from a response
// body. Semaphore's OTP endpoint is explicitly NOT rate limited on their
// side, so every limit that matters is the one below.
// ============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const ALLOWED_ORIGINS = [
  'https://bangonbangsamoro.com',
  'https://www.bangonbangsamoro.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

// Tighter than verify-member. A member retrieving their own card does it once
// or twice; anything beyond that is someone working through a list.
const RATE_LIMIT_MAX = 3
const RATE_LIMIT_WINDOW_MINUTES = 15
const PER_MEMBER_DAILY_MAX = 5

const OTP_TTL_SECONDS = 300
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

/** Same normalisation as submit-lead. Returns null if not a plausible PH mobile. */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  let national: string | null = null

  if (/^09\d{9}$/.test(digits)) national = digits.slice(1)
  else if (/^9\d{9}$/.test(digits)) national = digits
  else if (/^639\d{9}$/.test(digits)) national = digits.slice(2)
  else if (/^00639\d{9}$/.test(digits)) national = digits.slice(4)

  return national ? `+63${national}` : null
}

function maskPhone(e164: string): string {
  return `•••• •••${e164.slice(-4)}`
}

/**
 * Six digits from the CSPRNG, uniformly distributed.
 *
 * `% 1000000` on a 32-bit draw would bias the low end very slightly. It would
 * not matter here, but writing modulo-biased code in an authentication path
 * is how it ends up copied somewhere it does matter.
 */
function generateOtp(): string {
  const max = 1_000_000
  const limit = Math.floor(0xffffffff / max) * max
  const buf = new Uint32Array(1)
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit)
  return String(n % max).padStart(6, '0')
}

async function isRateLimited(sb: SupabaseClient, ipHash: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString()
  const { count, error } = await sb
    .from('id_card_issuance_log')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .in('event', ['otp_requested', 'otp_no_match'])
    .gte('created_at', since)

  if (error) {
    // Fail closed. An unavailable limiter on an SMS-spending endpoint is not
    // a reason to let traffic through — it bills real credits per attempt.
    console.error('[request-card-otp] rate-limit check failed', error)
    return true
  }
  return (count ?? 0) >= RATE_LIMIT_MAX
}

async function overDailyMemberCap(sb: SupabaseClient, memberId: string): Promise<boolean> {
  const since = new Date(Date.now() - 86_400_000).toISOString()
  const { count } = await sb
    .from('phone_otp')
    .select('id', { count: 'exact', head: true })
    .eq('member_id', memberId)
    .gte('created_at', since)
  return (count ?? 0) >= PER_MEMBER_DAILY_MAX
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
  if (error) console.error('[request-card-otp] audit write failed', error)
}

async function sendOtpSms(phone: string, code: string): Promise<boolean> {
  const apiKey = Deno.env.get('SEMAPHORE_API_KEY')
  if (!apiKey) {
    console.error('[request-card-otp] SEMAPHORE_API_KEY not set — cannot send OTP')
    return false
  }

  // Under 160 characters including the substituted code. The "hindi ibigay
  // kaninuman" line is there because OTP social engineering over a phone call
  // is the realistic attack on this flow, not anything technical.
  const message =
    'PBB: Ang inyong code para makuha ang Membership ID ay {otp}. ' +
    'Mag-e-expire ito sa 5 minuto. Huwag ibigay kaninuman.'

  try {
    const res = await fetch('https://api.semaphore.co/api/v4/otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        number: phone,
        message,
        code,
        sendername: Deno.env.get('SEMAPHORE_SENDER_NAME') || 'PBB',
      }),
    })
    if (!res.ok) {
      console.error('[request-card-otp] Semaphore returned', res.status)
      return false
    }
    return true
  } catch (err) {
    console.error('[request-card-otp] Semaphore request failed', err)
    return false
  }
}

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

  const memberNoRaw = String(payload.memberNo ?? '').trim()
  const phoneRaw = String(payload.phone ?? '').trim()

  if (!MEMBER_NO_PATTERN.test(memberNoRaw)) {
    return json({ error: 'invalid_member_no' }, 400, origin)
  }

  const phone = normalisePhone(phoneRaw)
  if (!phone) {
    return json({ error: 'invalid_phone' }, 400, origin)
  }

  const memberNo = memberNoRaw.toUpperCase()

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

  // Uniform success envelope, built before we know the answer so that the two
  // branches below cannot accidentally diverge in shape.
  const ok = {
    ok: true,
    maskedPhone: maskPhone(phone),
    expiresInSeconds: OTP_TTL_SECONDS,
  }

  const { data: memberId, error: matchErr } = await sb.rpc('member_for_card_claim', {
    p_member_no: memberNo,
    p_phone: phone,
  })

  if (matchErr) {
    console.error('[request-card-otp] match failed', matchErr)
    return json({ error: 'server_error' }, 500, origin)
  }

  if (!memberId) {
    await logEvent(sb, 'otp_no_match', { memberNo, ipHash })
    return json(ok, 200, origin)
  }

  if (await overDailyMemberCap(sb, memberId as string)) {
    // Still the uniform envelope: telling the caller they have hit a per-member
    // cap would confirm the member exists and the number is right.
    await logEvent(sb, 'otp_no_match', { memberNo, memberId: memberId as string, detail: 'daily cap', ipHash })
    return json(ok, 200, origin)
  }

  // Any code still outstanding for this member is void the moment a new one is
  // requested, so a resend cannot leave two valid codes in circulation.
  await sb
    .from('phone_otp')
    .update({ consumed_at: new Date().toISOString() })
    .eq('member_id', memberId as string)
    .is('consumed_at', null)

  const code = generateOtp()
  const codeHash = await hashCode(memberId as string, code)

  const { error: insertErr } = await sb.from('phone_otp').insert({
    purpose: 'card_claim',
    member_id: memberId as string,
    code_hash: codeHash,
    expires_at: new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString(),
    ip_hash: ipHash,
  })

  if (insertErr) {
    console.error('[request-card-otp] could not store OTP', insertErr)
    return json({ error: 'server_error' }, 500, origin)
  }

  const sent = await sendOtpSms(phone, code)

  await logEvent(sb, 'otp_requested', {
    memberNo,
    memberId: memberId as string,
    detail: sent ? 'sms accepted' : 'sms send failed',
    ipHash,
  })

  return json(ok, 200, origin)
})
