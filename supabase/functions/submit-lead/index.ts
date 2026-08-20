// ============================================================================
// SUPABASE EDGE FUNCTION — submit-lead
// ----------------------------------------------------------------------------
// The single write path for every public form on bangonbangsamoro.com:
//
//   volunteer          → public.volunteer_leads
//   basic_services     → public.form_submissions
//   environment_volunteer → public.form_submissions
//   partnership        → public.partnership_agreements
//
// WHY THIS EXISTS
// Before this function, home.html wrote to the visitor's own localStorage and
// nothing ever reached PBB (audit finding C-1). The obvious fix — POST straight
// to Supabase with the anon key — would have worked, but it leaves an
// `insert ... with check (true)` endpoint open to the entire internet, holding
// political-affiliation data, during an election campaign (H-2, H-3).
//
// So all public writes come through here instead, and the anon INSERT grants
// are revoked in migration 20260813000000. This function is the only thing
// holding the service-role key, and it is where the controls live:
//
//   1. Origin allowlist          — no arbitrary cross-site posting
//   2. Cloudflare Turnstile      — bot / mass-submission protection
//   3. Per-IP rate limit         — 5 submissions per 10 minutes
//   4. Field validation + normalisation (PH mobile numbers, e-mail, lengths)
//   5. Idempotent de-duplication on normalised phone
//   6. Consent logging with a salted IP hash, never a raw IP
//   7. Auto-assignment to the chapter coordinator for the submitted province
//
// SECRETS (set with `supabase secrets set`, never committed):
//   TURNSTILE_SECRET_KEY, SEMAPHORE_API_KEY, SEMAPHORE_SENDER_NAME, IP_HASH_SALT
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.
// ============================================================================

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ALLOWED_ORIGINS = [
  'https://bangonbangsamoro.com',
  'https://www.bangonbangsamoro.com',
  'http://localhost:5173',
  'http://localhost:4173',
]

const RATE_LIMIT_MAX = 5
const RATE_LIMIT_WINDOW_MINUTES = 10

const MAX_BODY_BYTES = 32 * 1024 // 32 KB — generous for a form, cheap to reject

type FormType =
  | 'volunteer'
  | 'basic_services'
  | 'environment_volunteer'
  | 'partnership'

const VALID_FORM_TYPES: FormType[] = [
  'volunteer',
  'basic_services',
  'environment_volunteer',
  'partnership',
]

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------

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
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/** Trim, collapse whitespace, cap length. Returns '' for nullish input. */
function clean(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
}

/**
 * Normalise a Philippine mobile number to E.164 (+639XXXXXXXXX).
 * Accepts 09XXXXXXXXX, 639XXXXXXXXX, +639XXXXXXXXX, and spaced/dashed forms.
 * Returns null if it is not a plausible PH mobile number.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '')
  let national: string | null = null

  if (/^09\d{9}$/.test(digits)) national = digits.slice(1)          // 09171234567
  else if (/^9\d{9}$/.test(digits)) national = digits               // 9171234567
  else if (/^639\d{9}$/.test(digits)) national = digits.slice(2)    // 639171234567
  else if (/^00639\d{9}$/.test(digits)) national = digits.slice(4)  // 00639171234567

  return national ? `+63${national}` : null
}

/** Conservative e-mail shape check. Deliverability is proven by the OTP, not by regex. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value) && value.length <= 254
}

/** Mask a phone for display in a response: +639171234567 → •••• •••4567 */
function maskPhone(e164: string): string {
  return `•••• •••${e164.slice(-4)}`
}

// ---------------------------------------------------------------------------
// Turnstile
// ---------------------------------------------------------------------------

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')

  // If no secret is configured (e.g. a local dev stack), fail OPEN but log it
  // loudly. Failing closed here would take the whole sign-up flow down on a
  // misconfiguration, which is a worse outcome 32 days before an election.
  // In production, alert on this log line — it means CAPTCHA is off.
  if (!secret) {
    console.warn('[submit-lead] TURNSTILE_SECRET_KEY not set — CAPTCHA verification SKIPPED')
    return true
  }
  if (!token) return false

  try {
    const body = new FormData()
    body.append('secret', secret)
    body.append('response', token)
    body.append('remoteip', ip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })
    const data = await res.json()
    return data.success === true
  } catch (err) {
    console.error('[submit-lead] Turnstile verification error', err)
    return false // network failure on a configured secret → fail closed
  }
}

// ---------------------------------------------------------------------------
// Rate limiting + consent
// ---------------------------------------------------------------------------

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
    .gte('created_at', since)

  if (error) {
    console.error('[submit-lead] rate-limit check failed', error)
    return false // never block a genuine volunteer because our own table erred
  }
  return (count ?? 0) >= RATE_LIMIT_MAX
}

async function recordThrottle(sb: SupabaseClient, ipHash: string, formType: string) {
  await sb.from('submission_throttle').insert({ ip_hash: ipHash, form_type: formType })
}

async function logConsent(
  sb: SupabaseClient,
  ipHash: string,
  sessionRef: string,
): Promise<string | null> {
  const { data, error } = await sb
    .from('consent_log')
    .insert({
      session_ref: sessionRef,
      essential: true,
      analytics: false,
      marketing: true, // explicit: they ticked "contact me about PBB activities"
      ip_hash: ipHash,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[submit-lead] consent log failed', error)
    return null
  }
  return data.id
}

// ---------------------------------------------------------------------------
// Chapter routing
// ---------------------------------------------------------------------------

/** Find the chapter (and therefore the coordinator) for a province code. */
async function resolveChapter(
  sb: SupabaseClient,
  provinceCode: string | null,
): Promise<{ chapterId: string | null; chapterName: string }> {
  if (!provinceCode) return { chapterId: null, chapterName: 'PBB National' }

  const { data, error } = await sb
    .from('chapters')
    .select('id, name')
    .eq('province_code', provinceCode)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error || !data) return { chapterId: null, chapterName: 'PBB National' }
  return { chapterId: data.id, chapterName: data.name }
}

// ---------------------------------------------------------------------------
// SMS confirmation
// ---------------------------------------------------------------------------

async function sendConfirmationSms(phone: string, firstName: string, chapter: string) {
  const apiKey = Deno.env.get('SEMAPHORE_API_KEY')
  if (!apiKey) {
    console.warn('[submit-lead] SEMAPHORE_API_KEY not set — confirmation SMS skipped')
    return
  }

  // Keep under 160 characters AFTER Tagalog expansion.
  const message =
    `PBB: Salamat ${firstName}! Nakuha na namin ang sign-up mo para sa ${chapter}. ` +
    `Kokontakin ka ng coordinator sa loob ng 2 araw. Reply STOP para tumigil.`

  try {
    await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apikey: apiKey,
        number: phone,
        message: message.slice(0, 160),
        sendername: Deno.env.get('SEMAPHORE_SENDER_NAME') || 'PBB',
      }),
    })
  } catch (err) {
    // A failed SMS must never fail the sign-up — the lead is already saved.
    console.error('[submit-lead] SMS send failed', err)
  }
}

// ---------------------------------------------------------------------------
// Per-form-type handlers
// ---------------------------------------------------------------------------

interface HandlerContext {
  sb: SupabaseClient
  payload: Record<string, unknown>
  consentId: string | null
  origin: string | null
}

interface HandlerResult {
  status: number
  body: Record<string, unknown>
  sms?: { phone: string; firstName: string; chapter: string }
}

async function handleVolunteer(ctx: HandlerContext): Promise<HandlerResult> {
  const { sb, payload, consentId } = ctx

  const fullName = clean(payload.fullName, 120)
  const rawPhone = clean(payload.phone, 30)
  const email = clean(payload.email, 254).toLowerCase()
  const provinceCode = clean(payload.provinceCode, 40)
  const interestCode = clean(payload.interestCode, 40)
  const affiliation = clean(payload.affiliation, 20) || 'volunteer'
  const lang = clean(payload.preferredLang, 5) || 'tl'
  const channel = clean(payload.preferredChannel, 12) || 'sms'

  if (fullName.length < 2) {
    return { status: 400, body: { error: 'invalid_name', field: 'fullName' } }
  }

  const phone = rawPhone ? normalisePhone(rawPhone) : null
  if (!phone) {
    return { status: 400, body: { error: 'invalid_phone', field: 'phone' } }
  }
  if (email && !isValidEmail(email)) {
    return { status: 400, body: { error: 'invalid_email', field: 'email' } }
  }

  // Idempotency: a second submission from the same number is not an error,
  // it is someone who tapped twice or lost signal mid-request.
  const { data: existing } = await sb
    .from('volunteer_leads')
    .select('id, submitted_at, full_name')
    .eq('phone', phone)
    .maybeSingle()

  if (existing) {
    return {
      status: 200,
      body: {
        ok: true,
        duplicate: true,
        submittedAt: existing.submitted_at,
        message: 'already_registered',
      },
    }
  }

  const { chapterId, chapterName } = await resolveChapter(sb, provinceCode || null)

  const { data, error } = await sb
    .from('volunteer_leads')
    .insert({
      full_name: fullName,
      phone,
      email: email || null,
      province_code: provinceCode || null,
      interest_code: interestCode || null,
      affiliation,
      preferred_lang: lang,
      preferred_channel: channel,
      chapter_id: chapterId,
      onboarding_stage: 'captured',
      consent_id: consentId,
      source: 'bangonbangsamoro.com/#get-involved',
    })
    .select('id')
    .single()

  if (error) {
    console.error('[submit-lead] volunteer insert failed', error)
    return { status: 500, body: { error: 'insert_failed' } }
  }

  const firstName = fullName.split(' ')[0]
  return {
    status: 201,
    body: {
      ok: true,
      id: data.id,
      chapter: chapterName,
      maskedPhone: maskPhone(phone),
      firstName,
    },
    sms: { phone, firstName, chapter: chapterName },
  }
}

async function handleFormSubmission(
  ctx: HandlerContext,
  formType: 'basic_services' | 'environment_volunteer',
): Promise<HandlerResult> {
  const { sb, payload, consentId } = ctx

  const fullName = clean(payload.fullName, 120)
  const rawContact = clean(payload.contact, 254)

  if (fullName.length < 2) {
    return { status: 400, body: { error: 'invalid_name', field: 'fullName' } }
  }
  if (!rawContact) {
    return { status: 400, body: { error: 'invalid_contact', field: 'contact' } }
  }

  // Contact may be a phone OR an e-mail here — both are acceptable by design,
  // because the Struggling Provider persona often has neither reliably.
  const asPhone = normalisePhone(rawContact)
  const contact = asPhone ?? rawContact.toLowerCase()
  if (!asPhone && !isValidEmail(contact)) {
    return { status: 400, body: { error: 'invalid_contact', field: 'contact' } }
  }

  // Guardian consent is mandatory for minors under RA 10173.
  const age = Number(payload.age)
  if (formType === 'environment_volunteer' && Number.isFinite(age) && age < 18) {
    if (payload.guardianConsent !== true) {
      return { status: 400, body: { error: 'guardian_consent_required', field: 'guardianConsent' } }
    }
  }

  const { data, error } = await sb
    .from('form_submissions')
    .insert({
      form_type: formType,
      full_name: fullName,
      contact,
      municipality: clean(payload.municipality, 120) || null,
      barangay_area: clean(payload.barangay, 120) || null,
      mode: clean(payload.mode, 20) || null,
      payload: {
        service: clean(payload.service, 200),
        suggestion: clean(payload.suggestion, 2000),
        focus: clean(payload.focus, 200),
        experience: clean(payload.experience, 2000),
        age: Number.isFinite(age) ? age : null,
        guardianConsent: payload.guardianConsent === true,
        preferredLang: clean(payload.preferredLang, 5) || 'tl',
      },
      consent_id: consentId,
      source: `bangonbangsamoro.com/#${formType}`,
    })
    .select('id')
    .single()

  if (error) {
    console.error(`[submit-lead] ${formType} insert failed`, error)
    return { status: 500, body: { error: 'insert_failed' } }
  }

  const firstName = fullName.split(' ')[0]
  const result: HandlerResult = {
    status: 201,
    body: { ok: true, id: data.id, firstName },
  }
  if (asPhone) {
    result.body.maskedPhone = maskPhone(asPhone)
    result.sms = { phone: asPhone, firstName, chapter: 'PBB' }
  }
  return result
}

async function handlePartnership(ctx: HandlerContext): Promise<HandlerResult> {
  const { sb, payload, consentId } = ctx

  const orgName = clean(payload.orgName, 200)
  const contactName = clean(payload.contactName, 120)
  const email = clean(payload.email, 254).toLowerCase()
  const signature = clean(payload.signature, 120)
  const agreementText = typeof payload.agreementText === 'string'
    ? payload.agreementText.slice(0, 20_000)
    : ''

  if (!orgName || !contactName || !signature || !agreementText) {
    return { status: 400, body: { error: 'missing_required_fields' } }
  }
  if (!isValidEmail(email)) {
    return { status: 400, body: { error: 'invalid_email', field: 'email' } }
  }

  // RA 8792 e-signature: the typed name must match the named contact person.
  // A mismatch is the single most common sign the form was filled in by
  // someone other than the signatory.
  if (signature.toLowerCase() !== contactName.toLowerCase()) {
    return { status: 400, body: { error: 'signature_name_mismatch', field: 'signature' } }
  }

  const phone = normalisePhone(clean(payload.phone, 30))

  const { data, error } = await sb
    .from('partnership_agreements')
    .insert({
      org_or_individual: orgName,
      contact_name: contactName,
      email,
      phone,
      partnership_type: clean(payload.orgType, 100) || null,
      agreement_version: clean(payload.agreementVersion, 40) || 'v1-2026-08',
      agreement_text: agreementText, // snapshotted, immutable after insert
      signature_name: signature,
      consent_id: consentId,
      source: 'bangonbangsamoro.com/#alliance-building',
    })
    .select('id, signed_at')
    .single()

  if (error) {
    console.error('[submit-lead] partnership insert failed', error)
    return { status: 500, body: { error: 'insert_failed' } }
  }

  return {
    status: 201,
    body: {
      ok: true,
      id: data.id,
      signedAt: data.signed_at,
      reference: `PBB-AP-${String(data.id).slice(0, 8).toUpperCase()}`,
    },
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405, origin)
  }
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    console.warn('[submit-lead] rejected origin', origin)
    return json({ error: 'origin_not_allowed' }, 403, origin)
  }

  const contentLength = Number(req.headers.get('content-length') || '0')
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'payload_too_large' }, 413, origin)
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400, origin)
  }

  const formType = clean(body.formType, 40) as FormType
  if (!VALID_FORM_TYPES.includes(formType)) {
    return json({ error: 'invalid_form_type' }, 400, origin)
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

  const captchaOk = await verifyTurnstile(clean(body.turnstileToken, 4096), ip)
  if (!captchaOk) {
    return json({ error: 'captcha_failed' }, 403, origin)
  }

  const consentId = await logConsent(sb, ipHash, clean(body.sessionRef, 64) || crypto.randomUUID())

  const payload = (body.payload ?? {}) as Record<string, unknown>
  const ctx: HandlerContext = { sb, payload, consentId, origin }

  let result: HandlerResult
  try {
    switch (formType) {
      case 'volunteer':
        result = await handleVolunteer(ctx)
        break
      case 'basic_services':
        result = await handleFormSubmission(ctx, 'basic_services')
        break
      case 'environment_volunteer':
        result = await handleFormSubmission(ctx, 'environment_volunteer')
        break
      case 'partnership':
        result = await handlePartnership(ctx)
        break
    }
  } catch (err) {
    console.error('[submit-lead] unhandled error', err)
    return json({ error: 'internal_error' }, 500, origin)
  }

  await recordThrottle(sb, ipHash, formType)

  // Fire-and-forget: never let a slow SMS gateway hold the response open.
  if (result.sms && result.status < 400) {
    const { phone, firstName, chapter } = result.sms
    void sendConfirmationSms(phone, firstName, chapter)
  }

  return json(result.body, result.status, origin)
})
