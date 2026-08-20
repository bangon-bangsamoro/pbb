# PBB — Partido Bangon Bangsamoro

Platform repository for the 2026 BARMM Parliamentary Elections (14 September 2026).

Three things live here:

1. **Public campaign site** (`public/`) — a slim persona-routing hub, one page per BANGON pillar, a forms page with membership-ID generation, and a public ID verification page. Static HTML/CSS/JS, no build step.
2. **Onboarding backend** (`supabase/`) — Postgres schema, RLS policies, and the `submit-lead` Edge Function that every public form writes through.
3. **INFORM dashboard** (`src/`) — React + TypeScript + Vite SPA showing BARMM conflict/risk intelligence built on the ACAPS INFORM Risk Index methodology. Gated behind sign-in, with a credential-free sample-data preview.

---

## Getting started

```bash
npm install
cp .env.example .env      # fill in real values — every var is explained in the file
npm run dev               # dashboard at /, campaign site at /home.html
```

Before opening a pull request:

```bash
npm run verify            # typecheck + lint + build — the same gates CI runs
```

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server. Proxies `/api/acaps` → `api.acaps.org` to avoid CORS. |
| `npm run build` | `tsc && vite build`. Fails loudly on type errors. |
| `npm run preview` | Serve the production build locally. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run lint` | ESLint, zero warnings tolerated. |
| `npm run verify` | All three, in order. Run this before pushing. |

---

## Deploying the backend

The forms on the public site do nothing until the database and Edge Function exist. Order matters.

```bash
# 1. Apply the schema (four migrations, in timestamp order)
supabase db push

# 2. Set the Edge Function secrets — these are server-side only and must
#    never appear in .env or in any file that reaches the browser
supabase secrets set TURNSTILE_SECRET_KEY=...
supabase secrets set SEMAPHORE_API_KEY=...
supabase secrets set SEMAPHORE_SENDER_NAME=PBB
supabase secrets set IP_HASH_SALT="$(openssl rand -hex 32)"

# 3. Deploy the write path and the ID verification path
supabase functions deploy submit-lead
supabase functions deploy verify-member

# 4. Point the public site at the project — edit the configuration block
#    near the bottom of public/home.html:
#      window.PBB_SUPABASE_URL       = "https://<project>.supabase.co";
#      window.PBB_SUPABASE_ANON_KEY  = "<publishable anon key>";
#      window.PBB_TURNSTILE_SITE_KEY = "<turnstile site key>";
#    The same block appears in every public/*.html page — update all of them,
#    or inject the values at deploy time.

# 5. Seed the chapter coordinators, so leads have an owner on arrival
#    (migration 20260813000000 creates one chapter per province with a null
#    coordinator; assign real staff_profiles rows to them)
```

**Verify it worked** before trusting it: submit a test sign-up on the live site, then check that a row appeared.

```sql
select full_name, phone, chapter_id, onboarding_stage, submitted_at
from public.coordinator_queue
order by submitted_at desc
limit 5;
```

If that query returns nothing after a test submission, the forms are silently failing — do not assume otherwise. This exact failure mode is what the 13 August 2026 audit found in production.

---

## How a sign-up flows

```
  Visitor fills a form on home.html
            │
            ▼
  submitLead()  ──── fails ────►  localStorage outbox
            │                     retried on 'online' + next page load
            │                     user is told it is QUEUED, never "received"
            ▼
  POST /functions/v1/submit-lead
            │
            ├─ origin allowlist
            ├─ Cloudflare Turnstile verification
            ├─ per-IP rate limit (5 / 10 min, salted hash, never a raw IP)
            ├─ validation + PH mobile normalisation to E.164
            ├─ de-duplication on the normalised number
            ├─ consent_log entry
            ▼
  volunteer_leads / form_submissions / partnership_agreements
            │
            ├─ trigger: auto-assign to the chapter for that province
            ▼
  coordinator_queue  ──►  coordinator contacts within 48h (breached_sla flags misses)
            │
            ▼
  SMS confirmation to the volunteer
```

The browser never writes to the database directly. Anonymous `INSERT` grants were revoked in `20260813000000_onboarding_pipeline.sql`; the Edge Function holds the only key that can write.

---

## Onboarding stages

`volunteer_leads.onboarding_stage` tracks where each person is:

| Stage | Meaning |
|---|---|
| `captured` | Form submitted. Nothing sent yet. |
| `confirmed` | Auto-reply delivered on their preferred channel. |
| `verified` | OTP proved the number belongs to them. |
| `assigned` | Routed to a chapter coordinator. |
| `activated` | Completed a first task. |
| `trained` | Finished role-based micro-modules. |
| `deployed` | Holds a precinct/barangay assignment. |
| `inactive` | Lapsed or opted out. |

`public.onboarding_funnel` reports conversion between stages per chapter — the weekly organising review should read from it.

---

## Site structure

The campaign site was one 2,078-line, 144 KB `home.html`. It is now a slim hub
plus one page per BANGON pillar, a forms page, and a verification page.

| Page | Size | Purpose |
|---|---|---|
| `home.html` | 23 KB | Persona selector + pillar cards + Messenger + CTA |
| `bangon.html` | 20 KB | BANGON platform hub — six pillars, legislative wings, horizons |
| `about.html` | 21 KB | Party history, leadership, values, comparative positioning |
| `voter-education.html` | 20 KB | Election guide for 14 Sep 2026 (non-partisan) |
| `faq.html` | 17 KB | Site-wide FAQ, 12 questions |
| `contact.html` | 19 KB | Hotline, email, HQ, Messenger |
| `bangon-*.html` (x6) | ~13 KB each | One BANGON domain each, detail behind `<details>` |
| `join.html` | 11 KB | Hub — routes to the three forms, keeps legacy links alive |
| `membership.html` | 27 KB | Membership form + PBB ID generation |
| `volunteer.html` | 22 KB | Volunteer sign-up |
| `partnership.html` | 24 KB | Alliance & Partnership Agreement (RA 8792 e-signature) |
| `verify.html` | 9 KB | Public membership-ID lookup (noindex) |

### Why the forms are separate pages

They began as one `join.html` with `#membership`, `#volunteer` and
`#partnership` anchors. One `<title>`, one `<meta description>` and one
canonical cannot rank for three unrelated queries — "paano maging miyembro ng
PBB", "mag-volunteer BARMM 2026" and "partnership agreement kooperatiba" are
different searchers with different objections. Each form now owns a page with
its own title, description, canonical, H1, intent copy, and FAQ.

Every page carries `BreadcrumbList` + `FAQPage` structured data (plus `HowTo`
on `membership.html`). **The FAQ schema mirrors the visible `<details>` FAQ on
each page, question for question** — structured data describing content a
visitor cannot see is a manual-action risk, not a ranking trick. A CI check
would be a reasonable next addition; for now the parity is verified manually.

`join.html` survives as a hub so pre-split inbound links and printed QR codes
still work. It carries no form markup, so there is no duplicate content, and a
small script forwards the three legacy hashes to the page that now owns each
form. A server-side 301 would be better if the host supports one.

### Persona routing

`docs/internal/PBB_User_Personas_2026.md` defines six voter personas. The chip
row on `home.html` lets a visitor pick the closest one; `PBB.persona` then
**reorders** the pillar cards so the two most relevant come first and flags
them.

It reorders, it never hides. Hiding platform content from a voter because we
guessed their segment would be both patronising and bad for search indexing.


### Facebook Messenger

Every page links to `m.me/914129215127738` — plain deep links, not the Customer
Chat plugin. The reasoning is at the top of `assets/pbb-messenger.js`: the
plugin loads ~200 KB of Facebook SDK before it renders, sets third-party
cookies and reports the visit whether or not the visitor opens it, and fails
inside in-app browsers — which is where much of this traffic arrives from. On a
political party's site, where the visitor list is sensitive, "reports nothing
until tapped" is the right default.

Links carry a `ref` payload (`hero`, `menu_platform`, `web_volunteer`, …) so
the Messenger team can see which page a conversation started from. The four
chips on the site mirror the Persistent Menu in
`docs/internal/facebook-messenger-automated-responses.md`; change one, change
the other.

### Keeping 22 pages consistent

`scripts/sync-chrome.mjs` used to rewrite the nav, footer, runtime config and
script tags on every page. **It was removed in August 2026** — it threw an
error in the maintainers' environment, and a generator nobody can run is worse
than no generator. Those blocks are hand-maintained now.

What CI still enforces directly, because these were the failures worth
catching rather than the formatting:

* every page pairs `site-widgets.css` with `site-widgets.js`, so the cookie
  banner cannot go missing from a page that collects personal data;
* every page carries `pbb-hide-host-badge.js`;
* every page that loads a form controller also carries the readiness guard,
  so a controller that fails to load says so instead of leaving every button
  inert;
* `scripts/sync-figures.mjs --check` still manages the campaign figures.

If you change a nav label, change it on all 22 pages. Nothing will stop you
shipping one page that disagrees with the rest.

### Progressive disclosure

Every BANGON page leads with the concrete commitment and folds the legislative
and technical detail into `<details class="disclose">`. `<details>` was chosen
over a JS accordion deliberately: it works with JavaScript disabled, screen
readers announce its state natively, and Chrome's Ctrl+F finds text inside a
closed one.

### Design system

`public/assets/pbb-tokens.css` is the single source of truth for colour, type,
space, and component styling. Both the static site and `src/index.css` import
it. Before it existed there were two token vocabularies for one brand
(`--forest` vs `--pbb-forest`) with values already drifting.

Every text/background pair in the system is verified at WCAG 2.1 AA. Four
pairs previously failed and are corrected: input placeholders (2.62 -> 5.63),
`.chart-desc` on a dashboard card (4.34 -> 5.36), the persona flag chip
(4.42 -> 5.16), and gold-as-text on light surfaces (2.42 — gold is now
documented as a surface colour; `--pbb-gold-deep` is the text token).

Mobile-first throughout: 48px minimum touch targets, 16px minimum input font
size (anything smaller makes iOS Safari zoom on focus), fluid `clamp()` type
with no horizontal overflow at 320px, and `prefers-reduced-motion` /
`prefers-contrast` support.

---

## Membership IDs

`membership.html` is a four-step form — details, photo, signature, ID —
that ends with a downloadable PBB Membership ID.

- **Card size** CR80, the ISO/IEC 7810 credit-card format (85.6 x 54 mm),
  rendered at 300 DPI (1011 x 638 px).
- **Export** PNG for sharing, PDF at exact CR80 page size so it prints 1:1
  with no scaling dialog.
- **Photo** `getUserMedia` live capture with a file-picker fallback, centre-
  cropped to 3:4 and compressed to a ~50 KB JPEG.
- **Signature** finger, stylus, or mouse on a canvas via Pointer Events, then
  whitespace-trimmed.
- **Number** issued by `next_membership_no()` in Postgres, never by the
  browser. Format `PBB-2026-MDN-004821`. A client-generated number would let
  anyone fabricate a convincing party ID during an election period.
- **QR** points at `verify.html?m=<member_no>`.
- **Offline** the card still renders if the submission is queued, but is
  watermarked **PENDING** and carries no QR — an ID that has not reached PBB
  is not verifiable and must not look as though it is.

`verify.html` returns only: is it real, which chapter, is it still valid, and
the name masked to first name plus surname initial. It never returns the phone
number, address, precinct, or photo. Membership in a political party is
sensitive personal information under RA 10173; an endpoint that echoed those
fields back would be a queryable directory of who supports whom.

---

plain
pbb/
├── .github/
│   └── workflows/
│       └── ci.yaml                 # FIXED: removed sync-chrome orphan, fixed secrets scan
├── public/                         # Static campaign site (no build step)
│   ├── home.html                   # Persona-routing hub
│   ├── bangon.html                 # BANGON platform hub
│   ├── about.html
│   ├── voter-education.html
│   ├── faq.html
│   ├── contact.html
│   ├── bangon-*.html               # 6 pillar pages
│   ├── join.html                   # Hub — routes to forms, keeps legacy links
│   ├── membership.html             # Membership form + PBB ID generation
│   ├── volunteer.html              # Volunteer sign-up
│   ├── partnership.html            # Alliance & Partnership Agreement
│   ├── verify.html                 # Public membership-ID lookup (noindex)
│   ├── privacy.html, terms.html, cookies.html, accessibility.html
│   ├── robots.txt, sitemap.xml
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker
│   └── assets/
│       ├── pbb-tokens.css          # Design system — single source of truth
│       ├── pbb-site.css            # Page chrome (header, nav, hero, footer)
│       ├── pbb-forms.css           # Form-page styles
│       ├── pbb-app.js              # window.PBB: transport, persona, lang, chrome
│       ├── pbb-id.js               # Photo capture, signature pad, ID card renderer
│       ├── join.js                 # Controllers for all three form pages
│       ├── site-widgets.js         # Cookie + accessibility widget
│       └── site-widgets.css        # Widget styles (must pair with JS on every page)
│       # NOTE: sync-chrome.mjs REMOVED — nav/footer are hand-maintained
├── src/                            # INFORM dashboard (React + TS + Vite)
│   ├── index.css                   # Imports pbb-tokens.css; dashboard-only styles
│   ├── main.tsx
│   └── ...
├── supabase/
│   ├── migrations/
│   │   ├── 20260811123735_comprehensive_schema.sql
│   │   ├── 20260812000000_pillar_cta_forms.sql
│   │   ├── 20260813000000_onboarding_pipeline.sql
│   │   └── 20260814000000_membership_ids.sql
│   └── functions/
│       ├── submit-lead/            # Public write path for every form
│       └── verify-member/          # Public ID verification
├── scripts/
│   ├── build-bangon-pages.mjs      # One-shot scaffold for pillar pages
│   └── sync-figures.mjs            # Manages campaign figures (still in CI)
├── docs/
│   └── internal/                   # Personas, Messenger scripts — NOT served publicly
├── index.html                      # Vite entry for the dashboard
├── package.json
├── .env.example                    # Example env vars (excluded from secret scan)
└── README.md

## Data protection

Volunteer records reveal **political affiliation**, which is *sensitive personal information* under the Data Privacy Act of 2012 (RA 10173). Treat this data accordingly:

- Contact details are collected only with affirmative, logged consent (`consent_log`).
- IP addresses are stored as salted SHA-256 hashes, never in the clear.
- No client-side surface may enumerate or export leads. Coordinators read `coordinator_queue` under RLS; every export is written to `audit_log`.
- Minors (under 18) require guardian consent — enforced in the form, in the Edge Function, and by a `check` constraint on the table.
- `purge_opted_out_leads()` removes opted-out records 30 days after opt-out. Schedule it, and agree a post-election retention decision for the rest.

**Never commit `.env`.** Never place a `service_role` key anywhere a browser can reach it. CI fails the build if either appears.

---

## Contributing

`main` is the source of truth. Edits made directly in the Bolt host must be pushed back here, or the two will drift — which is what happened before August 2026, and made it impossible to reason about what was actually live.

1. Branch from `main`.
2. Make the change.
3. `npm run verify`.
4. Open a PR. CI must be green before merge.

---

## A note on "ACAPS" in this codebase

ACAPS is the actual upstream data source and risk methodology (INFORM Risk Index) this dashboard is built on — references to it in data attribution, chart naming (`acaps-severity`, `acaps-access` color tokens), and API integration code are legitimate and should stay. What was cleaned up is *visual branding* that made the tool look like it belonged to ACAPS rather than PBB (emoji, off-palette accent colors used decoratively, page titles). If you are touching this code and unsure which category something falls into: data attribution and methodology naming stays; anything purely cosmetic should use the PBB brand tokens in `index.css`.

---

## License

Apache — see [LICENSE](LICENSE).
