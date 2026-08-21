-- ============================================================================
-- MEMBERSHIP APPROVAL — applications, approvers, and the issuance control point
-- ----------------------------------------------------------------------------
-- Closes the gap between "someone filled in the membership form" and "a
-- verifiable PBB membership ID exists".
--
-- WHY THERE WAS A GAP, AND WHY IT STAYS
-- Until now nothing wrote to public.members and nothing called
-- next_membership_no(). verify_member() therefore found nothing, which is why
-- verify.html correctly reported "Walang nakitang tugmang ID".
--
-- The fix is NOT to have the form issue a number. Membership in a political
-- party is not self-service: a submitted form is an APPLICATION. If the form
-- minted a member number, anyone with a browser could produce an ID that the
-- party's own verification endpoint vouches for at a checkpoint, during an
-- election. So the form writes an application, and a named officer turns that
-- application into a member.
--
-- THE CONTROL POINT
-- Issuance requires an authenticated approver — the Secretary General, or a
-- delegate he names — proving possession of a registered phone number via a
-- one-time code. That action, and only that action, calls
-- next_membership_no().
--
-- A NOTE ON THE SIGNATURE
-- The Secretary General's signature is stamped onto the issued card as the
-- ARTIFACT of approval. It is deliberately not the ACT of approval. A
-- signature applied automatically on submission would be attesting to
-- something nobody looked at, under his name. Here the signature only ever
-- appears on a card that a named person authorised, and every issuance
-- records who, when, and from where.
--
-- Idempotent. Safe to re-run. Depends on 20260814000000_membership_ids.sql
-- (members, next_membership_no) and 20260821000000_id_card_issuance.sql
-- (phone_otp).
-- ============================================================================

-- ============================================================================
-- 1. APPLICATIONS
-- ============================================================================
-- Holds everything the membership form collects, including the photo and the
-- signature, until an officer decides. Nothing in here is verifiable and
-- nothing in here has a member number.

create table if not exists public.membership_applications (
  id                uuid primary key default uuid_generate_v4(),

  full_name         text not null,
  date_of_birth     date,
  phone             text not null,
  email             text,

  province_code     text references public.provinces(code),
  municipality      text not null,
  barangay          text not null,
  precinct_no       text,

  photo_data        text,
  signature_data    text,

  preferred_lang    text not null default 'tl'
                      check (preferred_lang in ('tl','en','mdh','mrw','tsg')),
  preferred_channel text not null default 'sms'
                      check (preferred_channel in ('sms','messenger','email','call')),

  status            text not null default 'pending'
                      check (status in ('pending','approved','rejected')),

  -- Set only once a decision is made.
  decided_at        timestamptz,
  decided_by        uuid,
  decision_note     text,
  member_id         uuid references public.members(id) on delete set null,

  consent_id        uuid references public.consent_log(id) on delete set null,
  source            text not null default 'bangonbangsamoro.com/membership.html',
  submitted_at      timestamptz not null default now()
);

create index if not exists idx_applications_status
  on public.membership_applications(status, submitted_at desc);

-- One pending application per phone number.
--
-- Matched on the TRAILING 10 DIGITS, not on the whole digit string. Stripping
-- non-digits alone is not enough: "0917 555 6666" normalises to 09175556666
-- while "+63 917 555 6666" gives 639175556666 — different strings, so the same
-- person submitting in two formats would land two pending rows and could be
-- issued two membership numbers. right(...,10) is also what
-- member_for_card_claim() and approver_for_phone() use, so all three agree.
--
-- Partial on status='pending': a rejected applicant may re-apply, and an
-- approved member's application history is preserved.
drop index if exists public.idx_applications_pending_phone;
create unique index if not exists idx_applications_pending_phone
  on public.membership_applications (right(regexp_replace(phone, '\D', '', 'g'), 10))
  where status = 'pending';

alter table public.membership_applications enable row level security;
-- No policies: service role only. Photos and signatures live here.

comment on table public.membership_applications is
  'Membership form submissions awaiting a decision. Carries photo and signature. No member number is issued until an approver acts. Service-role access only.';

-- ============================================================================
-- 2. APPROVERS
-- ============================================================================
-- Who may turn an application into a member. Deliberately a table and not a
-- constant: a single hard-coded phone number means issuance stops the day
-- that handset is lost or replaced, in the middle of a campaign.

create table if not exists public.approvers (
  id          uuid primary key default uuid_generate_v4(),
  full_name   text not null,
  title       text not null,
  phone       text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create unique index if not exists idx_approvers_phone
  on public.approvers (regexp_replace(phone, '\D', '', 'g'));

alter table public.approvers enable row level security;

comment on table public.approvers is
  'Officers permitted to issue membership numbers. Matched on the trailing 10 digits of the phone number, same normalisation as members.';

-- ---------------------------------------------------------------------------
-- SEED — replace the placeholder number before running this in production.
--
--   update public.approvers
--      set phone = '09XXXXXXXXX'
--    where title = 'Secretary General';
--
-- A second active approver is strongly advised. One phone is one point of
-- failure, and the failure mode is "no member can be issued an ID today".
-- ---------------------------------------------------------------------------
insert into public.approvers (full_name, title, phone, is_active)
values ('Engr. Addie T. Unsi', 'Secretary General', '09000000000', true)
on conflict do nothing;

-- ============================================================================
-- 3. OTP PURPOSE
-- ============================================================================
-- phone_otp already carries the peppered-hash, TTL, attempt-limit and
-- rate-limit machinery built for card claims. Approval reuses all of it rather
-- than growing a second, less-tested code path.

do $$
begin
  alter table public.phone_otp drop constraint if exists phone_otp_purpose_check;
  alter table public.phone_otp
    add constraint phone_otp_purpose_check
    check (purpose in ('card_claim', 'member_approval'));
exception when undefined_table then
  raise notice 'phone_otp not present — run 20260821000000_id_card_issuance.sql first';
end $$;

-- member_id references members, but an approval OTP belongs to an approver.
-- Relax the FK so one table can serve both purposes.
do $$
begin
  alter table public.phone_otp drop constraint if exists phone_otp_member_id_fkey;
exception when undefined_table then null;
end $$;

-- ============================================================================
-- 4. RESOLVING AN APPROVER
-- ============================================================================
/**
 * Match a phone number to an active approver, or return null.
 *
 * Trailing 10 digits, exactly as member_for_card_claim() does, so
 * "0917 123 4567", "+63 917 123 4567" and "639171234567" all agree without
 * needing anyone to store the number in a particular shape.
 */
create or replace function public.approver_for_phone(p_phone text)
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

  select a.id into v_id
  from public.approvers a
  where a.is_active
    and right(regexp_replace(a.phone, '\D', '', 'g'), 10) = right(v_digits, 10)
  limit 1;

  return v_id;
end;
$$;

revoke all on function public.approver_for_phone(text) from public, anon, authenticated;

-- ============================================================================
-- 5. ISSUANCE
-- ============================================================================
/**
 * Turn an application into a member. This is the only path to a member number.
 *
 * Ordering matters. The application row is locked and marked 'approved' FIRST,
 * so two officers approving the same person at the same moment cannot both
 * proceed — the second finds no pending row and returns null rather than
 * burning a second membership number on the same human.
 *
 * Chapter is resolved from the province so the card can print a chapter name
 * without the officer having to pick one.
 */
create or replace function public.approve_member(
  p_application_id uuid,
  p_approver_id    uuid,
  p_note           text default null
)
returns table (member_no text, member_id uuid)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_app        public.membership_applications%rowtype;
  v_member_no  text;
  v_member_id  uuid;
  v_chapter_id uuid;
begin
  if p_approver_id is null
     or not exists (select 1 from public.approvers where id = p_approver_id and is_active) then
    return;
  end if;

  update public.membership_applications a
     set status = 'approved',
         decided_at = now(),
         decided_by = p_approver_id,
         decision_note = p_note
   where a.id = p_application_id
     and a.status = 'pending'
  returning a.* into v_app;

  if v_app.id is null then
    return;   -- already decided, or no such application
  end if;

  v_member_no := public.next_membership_no(v_app.province_code);

  select c.id into v_chapter_id
  from public.chapters c
  where c.province_code = v_app.province_code
    and c.is_active
  limit 1;

  insert into public.members (
    member_no, full_name, date_of_birth, phone, email,
    province_code, municipality, barangay, precinct_no, chapter_id,
    status, issued_at, valid_until, verified_at,
    photo_data, signature_data, preferred_lang, preferred_channel,
    consent_id, source
  ) values (
    v_member_no, v_app.full_name, v_app.date_of_birth, v_app.phone, v_app.email,
    v_app.province_code, v_app.municipality, v_app.barangay, v_app.precinct_no, v_chapter_id,
    'active', current_date, (current_date + interval '3 years')::date, now(),
    v_app.photo_data, v_app.signature_data, v_app.preferred_lang, v_app.preferred_channel,
    v_app.consent_id, 'approved:' || p_approver_id::text
  )
  returning id into v_member_id;

  update public.membership_applications
     set member_id = v_member_id
   where id = p_application_id;

  insert into public.id_card_issuance_log (member_no, member_id, event, detail)
  values (v_member_no, v_member_id, 'card_issued',
          'approved by ' || p_approver_id::text);

  return query select v_member_no, v_member_id;
end;
$$;

revoke all on function public.approve_member(uuid, uuid, text) from public, anon, authenticated;

/**
 * Decline an application. Kept symmetrical with approve_member() so a rejection
 * is as auditable as an issuance — an application that quietly disappears from
 * the queue is indistinguishable from one that was never received.
 */
create or replace function public.reject_application(
  p_application_id uuid,
  p_approver_id    uuid,
  p_note           text default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_ok boolean := false;
begin
  if p_approver_id is null
     or not exists (select 1 from public.approvers where id = p_approver_id and is_active) then
    return false;
  end if;

  update public.membership_applications
     set status = 'rejected', decided_at = now(),
         decided_by = p_approver_id, decision_note = p_note
   where id = p_application_id and status = 'pending';

  get diagnostics v_ok = row_count;
  return v_ok;
end;
$$;

revoke all on function public.reject_application(uuid, uuid, text) from public, anon, authenticated;

-- ============================================================================
-- 6. THE QUEUE
-- ============================================================================
/**
 * What an approver sees. Deliberately omits photo_data and signature_data:
 * the list view does not need a base64 photograph of every applicant, and
 * shipping them all to a phone over a BARMM connection would make the queue
 * unusable. The officer fetches one application in full when reviewing it.
 */
create or replace function public.pending_applications(p_limit integer default 50)
returns table (
  id            uuid,
  full_name     text,
  phone_masked  text,
  province_code text,
  municipality  text,
  barangay      text,
  precinct_no   text,
  submitted_at  timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id,
         a.full_name,
         '•••• •••' || right(regexp_replace(a.phone, '\D', '', 'g'), 4),
         a.province_code,
         a.municipality,
         a.barangay,
         a.precinct_no,
         a.submitted_at
  from public.membership_applications a
  where a.status = 'pending'
  order by a.submitted_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
$$;

revoke all on function public.pending_applications(integer) from public, anon, authenticated;
