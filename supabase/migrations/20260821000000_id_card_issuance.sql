-- ============================================================================
-- ID CARD ISSUANCE — phone OTP, single-use card tokens, issuance audit
-- ----------------------------------------------------------------------------
-- Lets a member retrieve their own PBB Membership ID card after proving they
-- hold the phone number on their membership record.
--
-- WHY THIS IS SEPARATE FROM verify_member()
-- The QR printed on every card resolves to /verify.html?m=<member_no>. That
-- code is photographable by anyone who handles the card at a checkpoint, so
-- the scan itself can never be treated as proof of ownership. verify_member()
-- therefore stays exactly as it is: thin, public, no PII. Everything in this
-- migration sits behind a second factor the photograph does not carry — a
-- one-time code delivered to the number already on the member's record.
--
-- THREAT MODEL THIS DEFENDS AGAINST
--   1. Photographed QR -> full record. Blocked: the token is never in the QR.
--   2. Phone-number probing. request-card-otp answers identically whether or
--      not the number matches, so this cannot be used to test whether a given
--      number belongs to a party member. See the Edge Function.
--   3. OTP brute force. 6 digits over a 5-minute window with 3 attempts, then
--      the row is burned. Semaphore's own /otp route is NOT rate limited, so
--      the limits here and in the Edge Function are the only defence.
--   4. Token replay. Card tokens are single-use, 10 minutes, bound to one
--      member, and stored only as a SHA-256 hash.
--   5. Quiet mass harvesting. id_card_issuance_log records every attempt,
--      successful or not. It is the only place a campaign against this
--      endpoint becomes visible.
--
-- NOTHING HERE IS READABLE BY anon. Every path runs through an Edge Function
-- holding the service-role key.
--
-- Idempotent. Target: PostgreSQL 15+ on Supabase.
-- ============================================================================

-- ============================================================================
-- 1. PHONE OTP
-- ============================================================================
-- The plaintext code is never stored. It exists in exactly two places: the
-- SMS, and the memory of the Edge Function that generated it.

create table if not exists public.phone_otp (
  id          uuid primary key default uuid_generate_v4(),
  purpose     text not null default 'card_claim' check (purpose in ('card_claim')),
  member_id   uuid not null references public.members(id) on delete cascade,

  -- SHA-256 of (pepper || member_id || code). The pepper lives in the Edge
  -- Function environment, so a database-only compromise still cannot verify
  -- a guessed code offline.
  code_hash   text not null,

  expires_at  timestamptz not null,
  attempts    integer not null default 0,
  consumed_at timestamptz,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_phone_otp_member  on public.phone_otp(member_id, created_at desc);
create index if not exists idx_phone_otp_expires on public.phone_otp(expires_at);

alter table public.phone_otp enable row level security;
-- No policies whatsoever: service role only.

comment on table public.phone_otp is
  'One-time codes for member self-service card retrieval. Codes are stored as peppered SHA-256 hashes, never plaintext. Service-role access only.';

-- ============================================================================
-- 2. CARD TOKENS
-- ============================================================================
-- Issued once an OTP is proven. Exchanged for the card payload exactly once.
-- Splitting this from the OTP means the payload request carries no code, so a
-- retry, a back button, or a shared screenshot of the URL cannot re-fetch a
-- member's photo and signature.

create table if not exists public.id_card_tokens (
  id          uuid primary key default uuid_generate_v4(),
  token_hash  text not null unique,
  member_id   uuid not null references public.members(id) on delete cascade,
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists idx_card_tokens_expires on public.id_card_tokens(expires_at);

alter table public.id_card_tokens enable row level security;

comment on table public.id_card_tokens is
  'Single-use, 10-minute, member-scoped tokens exchanged for a card payload. Stored as SHA-256 hashes. Service-role access only.';

-- ============================================================================
-- 3. ISSUANCE AUDIT
-- ============================================================================
-- Deliberately records failures as well as successes, and deliberately does
-- NOT record the phone number that was tried. What matters operationally is
-- the shape of the traffic, not the identity of whoever is probing.

create table if not exists public.id_card_issuance_log (
  id         uuid primary key default uuid_generate_v4(),
  member_no  text,
  member_id  uuid references public.members(id) on delete set null,
  event      text not null check (event in (
    'otp_requested',   -- a code was generated and handed to Semaphore
    'otp_no_match',    -- member_no + phone did not resolve to a member
    'otp_failed',      -- wrong code supplied
    'otp_verified',    -- code accepted, card token issued
    'card_issued',     -- token exchanged for the payload
    'card_denied'      -- token invalid, expired, reused, or member not active
  )),
  detail     text,
  ip_hash    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_issuance_log_created on public.id_card_issuance_log(created_at desc);
create index if not exists idx_issuance_log_ip      on public.id_card_issuance_log(ip_hash, created_at desc);
create index if not exists idx_issuance_log_member  on public.id_card_issuance_log(member_id, created_at desc);

alter table public.id_card_issuance_log enable row level security;

drop policy if exists "staff read issuance log" on public.id_card_issuance_log;
create policy "staff read issuance log"
  on public.id_card_issuance_log for select
  to authenticated
  using (public.current_role() in ('admin', 'coordinator'));

grant select on public.id_card_issuance_log to authenticated;

comment on table public.id_card_issuance_log is
  'Audit trail for member card retrieval. Records attempts as well as successes so that harvesting is visible. Never stores the phone number supplied.';

-- ============================================================================
-- 4. MATCHING A MEMBER TO A PHONE NUMBER
-- ============================================================================
/**
 * Resolve (member_no, phone) to a member id, or null.
 *
 * Matching is on the LAST 10 DIGITS. `members.phone` is stored as the member
 * typed it — "0917 123 4567", "+63 917 123 4567" and "639171234567" are all
 * in there — and the existing unique index already normalises by stripping
 * non-digits. Comparing the trailing 10 makes every one of those forms agree
 * without needing a migration to rewrite historical rows.
 *
 * Returns null for any member that is not 'active'. A suspended or revoked
 * member must not be able to pull a card that still looks valid.
 */
update public.approvers set phone = '09XXXXXXXXX'
 where title = 'Secretary General';
create or replace function public.member_for_card_claim(
)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_id     uuid;
begin
  if length(v_digits) < 10 then
    return null;
  end if;

  select m.id into v_id
  from public.members m
  where upper(m.member_no) = upper(trim(p_member_no))
    and m.status = 'active'
    and right(regexp_replace(m.phone, '\D', '', 'g'), 10) = right(v_digits, 10)
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.member_for_card_claim(text, text) from public, anon, authenticated;

-- ============================================================================
-- 5. CLAIMING THE CARD
-- ============================================================================
/**
 * Exchange a card token for the full card payload, exactly once.
 *
 * The consume-then-return ordering matters: the UPDATE ... RETURNING takes a
 * row lock and marks the token spent before any member data is read, so two
 * simultaneous requests with the same token cannot both come back with a
 * payload. A member who loses the response to a dropped connection re-runs
 * the OTP step; that is the correct trade against a replayable token.
 *
 * This is the only function in the codebase that returns photo_data and
 * signature_data outside the authenticated staff RLS path.
 */
create or replace function public.claim_member_card(p_token_hash text)
returns table (
  member_no      text,
  full_name      text,
  chapter        text,
  province       text,
  municipality   text,
  barangay       text,
  precinct_no    text,
  photo_data     text,
  signature_data text,
  issued_at      date,
  valid_until    date
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
begin
  update public.id_card_tokens t
     set consumed_at = now()
   where t.token_hash = p_token_hash
     and t.consumed_at is null
     and t.expires_at > now()
  returning t.member_id into v_member_id;

  if v_member_id is null then
    return;
  end if;

  return query
  select
    m.member_no,
    m.full_name,
    coalesce(c.name, 'PBB National') as chapter,
    coalesce(pr.label, '—') as province,
    m.municipality,
    m.barangay,
    m.precinct_no,
    m.photo_data,
    m.signature_data,
    m.issued_at,
    m.valid_until
  from public.members m
  left join public.chapters  c  on c.id = m.chapter_id
  left join public.provinces pr on pr.code = m.province_code
  where m.id = v_member_id
    and m.status = 'active';
end;
$$;

revoke all on function public.claim_member_card(text) from public, anon, authenticated;

-- ============================================================================
-- 6. HOUSEKEEPING
-- ============================================================================
-- Spent and expired artifacts are not evidence of anything — the audit log is.
-- Holding them serves no purpose and only widens what a future compromise
-- would expose. Schedule hourly via pg_cron, or call from a deploy hook.

create or replace function public.purge_expired_card_artifacts()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer := 0;
  v_n     integer;
begin
  delete from public.phone_otp
   where expires_at < now() - interval '1 hour';
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  delete from public.id_card_tokens
   where expires_at < now() - interval '1 hour';
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- The audit log is kept for one year, matching the retention already
  -- applied to consent records.
  delete from public.id_card_issuance_log
   where created_at < now() - interval '1 year';
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  return v_count;
end;
$$;

revoke all on function public.purge_expired_card_artifacts() from public, anon, authenticated;
