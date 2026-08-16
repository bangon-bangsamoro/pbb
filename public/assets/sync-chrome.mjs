/**
 * Syncs shared chrome across every page in public/.
 *
 *   node scripts/sync-chrome.mjs [--check]
 *
 * The site is now 21 static pages. Header nav, footer, and the runtime config
 * block have to be identical on all of them, and hand-editing 21 files every
 * time a nav item changes is how a site ends up with three different menus.
 *
 * This script rewrites four things in place:
 *   1. <nav id="primary-nav"> … </nav>          — with aria-current per page
 *   2. <div class="footer-grid"> … </div>       — the four footer columns
 *   3. the window.PBB_* runtime configuration block
 *   4. the trailing <script src> list
 *
 * Everything between those blocks — the actual page content — is untouched.
 *
 * Run with --check to fail (exit 1) if any page is out of sync, without
 * writing. That is what CI uses.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')
const CHECK = process.argv.includes('--check')

/* Pages that deliberately keep their own chrome. */
const SKIP = new Set([])

/* Legal pages predate the design system and have their own minimal layout;
   rewriting their nav would break it. They are linked from every footer. */
const LEGAL = new Set(['privacy.html', 'terms.html', 'cookies.html', 'accessibility.html'])

/* Labels come from the party, not from this file. They were changed in the
   August 2026 pass to the shorter set below; edit here and re-run so all 22
   pages move together rather than drifting one page at a time. */
const NAV = [
  ['home.html', 'Simula'],
  ['bangon.html', 'BANGON Platform'],
  ['about.html', 'About PBB'],
  ['voter-education.html', 'Paano Bomoto?'],
  ['faq.html', 'FAQ'],
  ['contact.html', 'Contact'],
]

/* Form pages get a nav CTA pointing at their own form rather than the hub. */
const CTA = {
  'membership.html': ['#form', 'Sagutan ang Form'],
  'volunteer.html': ['#form', 'Sagutan ang Form'],
  'partnership.html': ['#form', 'Pumirma ng Kasunduan'],
  'verify.html': ['membership.html', 'Maging Miyembro'],
}

function navBlock(slug) {
  const [ctaHref, ctaLabel] = CTA[slug] || ['join.html', 'Sumali Ngayon']
  const items = NAV.map(([href, label]) => {
    // A BANGON domain page marks the platform hub as its section.
    const current = href === slug || (href === 'bangon.html' && slug.startsWith('bangon-'))
    return `        <li><a href="${href}"${current ? ' aria-current="page"' : ''}>${label}</a></li>`
  }).join('\n')

  return `<nav id="primary-nav" aria-label="Pangunahing nabigasyon">
      <ul>
${items}
        <li class="nav-cta"><a href="${ctaHref}">${ctaLabel}</a></li>
      </ul>
    </nav>`
}

const FOOTER_GRID = `<div class="footer-grid">
      <div>
        <h5>Ang BANGON Platform</h5>
        <ul>
          <li><a href="bangon.html">Buod ng platform</a></li>
          <li><a href="bangon-basic-services.html">B — Batayang Serbisyo</a></li>
          <li><a href="bangon-alliance.html">A — Alyansa</a></li>
          <li><a href="bangon-natural-resources.html">N — Kalikasan</a></li>
          <li><a href="bangon-green-economy.html">G — Green Economy</a></li>
          <li><a href="bangon-open-governance.html">O — Bukas na Pamahalaan</a></li>
          <li><a href="bangon-peace.html">N — Kapayapaan</a></li>
        </ul>
      </div>
      <div>
        <h5>Sumali</h5>
        <ul>
          <li><a href="membership.html">Membership Form</a></li>
          <li><a href="volunteer.html">Volunteer Sign-up</a></li>
          <li><a href="partnership.html">Partnership Agreement</a></li>
          <li><a href="verify.html">I-verify ang Membership ID</a></li>
        </ul>
      </div>
      <div>
        <h5>Alamin</h5>
        <ul>
          <li><a href="about.html">About PBB</a></li>
          <li><a href="persona.html">Para kanino ang BANGON</a></li>
          <li><a href="voter-education.html">Paano Bomoto?</a></li>
          <li><a href="faq.html">FAQ</a></li>
          <li><a href="contact.html">Contact</a></li>
          <li><a data-messenger="footer">Messenger</a></li>
        </ul>
      </div>
      <div>
        <h5>Legal</h5>
        <ul>
          <li><a href="privacy.html">Privacy Policy</a></li>
          <li><a href="terms.html">Terms of Use</a></li>
          <li><a href="cookies.html">Cookie Policy</a></li>
          <li><a href="accessibility.html">Accessibility</a></li>
        </ul>
      </div>
    </div>`

/* Stylesheets, in cascade order. site-widgets.css was previously linked only
   from the four legal pages, so the cookie banner and the accessibility
   toolbar rendered UNSTYLED on every other page — the JS that builds them was
   loaded site-wide, the CSS was not. */
const STYLES = [
  'assets/pbb-tokens.css',     // design tokens — must come first
  'assets/pbb-site.css',       // page chrome
  'assets/site-widgets.css',   // cookie banner + a11y toolbar
  'assets/pbb-join-popup.css', // "Sumali sa PBB" modal
]

/* Form pages additionally need the form/capture styles. */
const EXTRA_STYLES = {
  'membership.html': ['assets/pbb-forms.css'],
  'volunteer.html': ['assets/pbb-forms.css'],
  'partnership.html': ['assets/pbb-forms.css'],
  'join.html': ['assets/pbb-forms.css'],
  'verify.html': ['assets/pbb-forms.css'],
}

function styleBlock(slug) {
  return [...STYLES, ...(EXTRA_STYLES[slug] || [])]
    .map((href) => `<link rel="stylesheet" href="${href}">`)
    .join('\n')
}

const CONFIG_BLOCK = `<script>
  window.PBB_SUPABASE_URL       = "";
  window.PBB_SUPABASE_ANON_KEY  = "";
  window.PBB_TURNSTILE_SITE_KEY = "";
  window.PBB_MESSENGER_ID       = "914129215127738";

  /* "Sumali sa PBB" popup. Set enabled:false to switch it off site-wide.
     It never auto-opens on the form pages, never before both the dwell time
     and the scroll depth are met, and never while the cookie banner is up. */
  window.PBB_JOIN_POPUP = {
    enabled: true,
    delaySeconds: 25,
    scrollPercent: 45,
    cooldownDays: 14,
    exitIntent: true
  };
</script>`

/* Which extra scripts a page needs, on top of pbb-app + pbb-messenger. */
const EXTRA_SCRIPTS = {
  'membership.html': ['assets/pbb-id.js', 'assets/join.js'],
  'volunteer.html': ['assets/join.js'],
  'partnership.html': ['assets/join.js'],
  // verify.html had a form, a button and a result container with nothing
  // wired to any of them, and ignored the ?m= parameter its own printed QR
  // codes point at. pbb-verify.js is that controller.
  'verify.html': ['assets/pbb-verify.js'],
}

function scriptBlock(slug) {
  const extra = EXTRA_SCRIPTS[slug] || []
  // Form pages load their controllers synchronously (they query the DOM at
  // the bottom of the body); everything else can defer.
  //
  // site-widgets.js goes on EVERY page. It was previously omitted from the
  // three form pages, which meant no cookie-consent banner on precisely the
  // pages that collect a name, a phone number, a photo and a signature. Under
  // RA 10173 the consent notice has to be present where the data is
  // collected; that is not optional and not a styling detail.
  //
  // pbb-join-popup.js also goes on every page, including the form pages: it
  // suppresses its own auto-open there (interrupting someone mid-form to ask
  // them to fill in a form is the worst thing this component could do), but
  // it still needs to be present so a [data-join-popup] button works
  // anywhere.
  //
  // pbb-hide-host-badge.js is last because it only reads the DOM. It hides
  // the host-injected bolt.new attribution anchor in cases the CSS rule in
  // pbb-tokens.css section 9 cannot reach (open shadow roots, late
  // injection). It matches nothing else on the page.
  const lines = extra.length
    ? ['<script src="assets/pbb-app.js"></script>',
       ...extra.map((s) => `<script src="${s}"></script>`),
       '<script src="assets/pbb-messenger.js" defer></script>',
       '<script src="assets/pbb-join-popup.js" defer></script>',
       '<script src="assets/site-widgets.js" defer></script>',
       '<script src="assets/pbb-hide-host-badge.js" defer></script>']
    : ['<script src="assets/pbb-app.js" defer></script>',
       '<script src="assets/pbb-messenger.js" defer></script>',
       '<script src="assets/pbb-join-popup.js" defer></script>',
       '<script src="assets/site-widgets.js" defer></script>',
       '<script src="assets/pbb-hide-host-badge.js" defer></script>']
  /* An outside observer for the form pages.
   *
   * Everything above can fail in a way nothing above can report. If join.js
   * itself 404s, is blocked by CSP, or was left out of a deploy, then no code
   * inside join.js runs — the page renders perfectly and every button is
   * inert, with only a 404 buried in the network tab to show for it. That is
   * exactly the failure that reached a live tester.
   *
   * join.js sets window.PBB_FORMS_READY at the end of its work. This checks
   * for it after load and, if it is missing, tells the visitor plainly and
   * points a developer at the cause. It is deliberately tiny, inline, and
   * dependency-free so it survives whatever broke everything else.
   */
  if (extra.length) {
    lines.push(`<script>
  window.addEventListener('load', function () {
    if (window.PBB_FORMS_READY || window.PBB_VERIFY_READY) return;
    if (window.console && console.error) {
      console.error('[PBB] the form controller for this page never ran — every button on this form is inert. Check that it returns 200 and is not blocked by CSP.');
    }
    var form = document.querySelector('#memberForm, #joinForm, #apForm, #verifyForm');
    if (!form || form.querySelector('[data-pbb-dead]')) return;
    var p = document.createElement('p');
    p.setAttribute('role', 'alert');
    p.setAttribute('data-pbb-dead', '');
    p.style.cssText = 'margin:0 0 1rem;padding:.85rem 1rem;border-radius:8px;background:#fdecea;color:#8a1a14;border:1px solid #b3261e;font:600 .95rem/1.5 system-ui,sans-serif';
    p.textContent = 'Hindi gumagana ang form sa ngayon dahil may bahagi ng pahina na hindi na-load. Pakisubukan i-refresh. Kung magpatuloy ito, mag-message sa aming Facebook Page at tutulungan ka naming makapagpalista.';
    form.insertBefore(p, form.firstChild);
  });
<\/script>`)
  }

  return lines.join('\n')
}

/* --------------------------------------------------------------------------
   Rewrite
   -------------------------------------------------------------------------- */

const STYLES_RE = /<link rel="stylesheet" href="assets\/pbb-tokens\.css">[\s\S]*?(?=\n\n|\n<script)/
const NAV_RE = /<nav id="primary-nav"[\s\S]*?<\/nav>/
const FOOTER_RE = /<div class="footer-grid">[\s\S]*?\n    <\/div>/
const CONFIG_RE = /<script>\s*\n\s*window\.PBB_SUPABASE_URL[\s\S]*?<\/script>/
const SCRIPTS_RE = /<script src="assets\/pbb-app\.js"[\s\S]*?(?=\n<\/body>)/

let changed = []
let checked = 0

for (const file of readdirSync(PUBLIC).filter((f) => f.endsWith('.html')).sort()) {
  if (SKIP.has(file) || LEGAL.has(file)) continue
  checked++

  const path = join(PUBLIC, file)
  const before = readFileSync(path, 'utf8')
  let after = before

  if (STYLES_RE.test(after)) after = after.replace(STYLES_RE, styleBlock(file))
  if (NAV_RE.test(after)) after = after.replace(NAV_RE, navBlock(file))
  if (FOOTER_RE.test(after)) after = after.replace(FOOTER_RE, FOOTER_GRID)
  if (CONFIG_RE.test(after)) after = after.replace(CONFIG_RE, CONFIG_BLOCK)
  if (SCRIPTS_RE.test(after)) after = after.replace(SCRIPTS_RE, scriptBlock(file) + '\n')

  if (after !== before) {
    changed.push(file)
    if (!CHECK) writeFileSync(path, after, 'utf8')
  }
}

/* --------------------------------------------------------------------------
   Legal pages: minimal, targeted pass.

   These four keep their own layout — rewriting their nav would break it — but
   two things must still hold everywhere, and were previously true only on the
   other eighteen:

     site-widgets.js          the cookie banner. A privacy policy page with no
                              consent banner is the most conspicuous possible
                              place for it to be missing.
     pbb-hide-host-badge.js   the host attribution badge is injected on every
                              page, so it has to be handled on every page.

   Nothing else here is touched.
   -------------------------------------------------------------------------- */
const BADGE_TAG = '<script src="assets/pbb-hide-host-badge.js" defer></script>'
const WIDGETS_TAG_RE = /<script src="assets\/site-widgets\.js"[^>]*><\/script>/

for (const file of LEGAL) {
  const path = join(PUBLIC, file)
  const before = readFileSync(path, 'utf8')
  if (before.includes('assets/pbb-hide-host-badge.js')) { checked++; continue }
  const m = before.match(WIDGETS_TAG_RE)
  if (!m) {
    console.error(`${file}: no site-widgets.js tag to anchor to — fix by hand`)
    process.exit(1)
  }
  const after = before.replace(WIDGETS_TAG_RE, `${m[0]}\n${BADGE_TAG}`)
  checked++
  changed.push(file)
  if (!CHECK) writeFileSync(path, after, 'utf8')
}

if (CHECK) {
  if (changed.length) {
    console.error('Out of sync with scripts/sync-chrome.mjs:\n  ' + changed.join('\n  '))
    console.error('\nRun: node scripts/sync-chrome.mjs')
    process.exit(1)
  }
  console.log(`${checked} pages checked — chrome in sync`)
} else {
  console.log(changed.length
    ? `updated ${changed.length}/${checked}:\n  ` + changed.join('\n  ')
    : `${checked} pages already in sync`)
}
