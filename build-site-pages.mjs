/**
 * Scaffolds the five site pages under public/:
 *   bangon.html, about.html, voter-education.html, faq.html, contact.html
 *
 * Same convention as build-bangon-pages.mjs: a ONE-SHOT SCAFFOLD, not a build
 * step. After it runs the generated .html files are ordinary hand-editable
 * pages and are the source of truth.
 *
 *   node scripts/build-site-pages.mjs
 *
 * ---------------------------------------------------------------------------
 * NOTE ON BANGON NAMING — read before editing content
 *
 * Two different expansions of BANGON are in circulation:
 *
 *   Site / COMELEC-registered platform (CANONICAL, used here)
 *     B  Basic Services Enhancement
 *     A  Alliance Building & Partnerships
 *     N  Natural Resources Protection
 *     G  Green Economy Acceleration
 *     O  Open & Inclusive Governance
 *     N  Non-violent Conflict Resolution
 *
 *   Messenger automation script (docs/internal/facebook-messenger-...md)
 *     A  Accelerate Sustainable Livelihood
 *     N  Non-violent Peace
 *     G  Green Economic Competitiveness
 *     N  Nurturing Women & Gender Empowerment
 *
 * These are not stylistic variants — they name different policy areas. The
 * personas document flags exactly this ("fix the Six-Point vs 10-point
 * confusion") as the Ground Operator's top need. Everything on the website
 * uses the canonical set. The Messenger scripts must be corrected to match
 * before they are pasted into Meta Business Suite.
 * ---------------------------------------------------------------------------
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public')
const SITE = 'https://www.bangonbangsamoro.com'

/* =========================================================================
   Shared chrome
   ========================================================================= */

const NAV = [
  ['home.html', 'Simula'],
  ['bangon.html', 'Ang BANGON Platform'],
  ['about.html', 'Tungkol sa PBB'],
  ['voter-education.html', 'Botante'],
  ['faq.html', 'FAQ'],
  ['contact.html', 'Makipag-ugnayan'],
]

const nav = (slug) => `    <nav id="primary-nav" aria-label="Pangunahing nabigasyon">
      <ul>
${NAV.map(([href, label]) =>
  `        <li><a href="${href}"${href === slug ? ' aria-current="page"' : ''}>${label}</a></li>`
).join('\n')}
        <li class="nav-cta"><a href="join.html">Sumali sa Kilusan</a></li>
      </ul>
    </nav>`

const header = (slug) => `<header class="site">
  <div class="wrap header-inner">
    <a class="brand" href="home.html">
      <img src="assets/pbb-logo-128.png" width="38" height="38" alt="">
      <span class="brand-text">
        <strong>Partido Bangon Bangsamoro</strong>
        <small>Babangon Tayo · 2026</small>
      </span>
    </a>
    <button class="nav-toggle" id="navToggle" type="button"
            aria-expanded="false" aria-controls="primary-nav" aria-label="Buksan ang menu">
      <span></span><span></span><span></span>
    </button>
${nav(slug)}
  </div>
</header>`

const FOOTER = `<footer class="site">
  <div class="wrap">
    <div class="footer-grid">
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
          <li><a href="about.html">Tungkol sa PBB</a></li>
          <li><a href="voter-education.html">Botante: Set. 14, 2026</a></li>
          <li><a href="faq.html">Mga madalas itanong</a></li>
          <li><a href="contact.html">Makipag-ugnayan</a></li>
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
    </div>
    <div class="footer-legal">
      <p style="margin-bottom:.5em">© <span id="year">2026</span> Partido Bangon Bangsamoro. Lahat ng karapatan ay nakalaan.</p>
      <p style="margin:0">
        Paid for by Partido Bangon Bangsamoro · Subject to COMELEC campaign finance and
        fair-election disclosure rules. ·
        <button type="button" data-cookie-prefs
                style="background:none;border:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit">Cookie Preferences</button>
      </p>
    </div>
  </div>
</footer>

<button class="back-to-top no-print" id="backToTop" type="button" aria-label="Bumalik sa itaas">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
</button>

<script>
  window.PBB_SUPABASE_URL       = "";
  window.PBB_SUPABASE_ANON_KEY  = "";
  window.PBB_TURNSTILE_SITE_KEY = "";
  window.PBB_MESSENGER_ID       = "914129215127738";
</script>
<script src="assets/pbb-app.js" defer></script>
<script src="assets/pbb-messenger.js" defer></script>
<script src="assets/site-widgets.js" defer></script>
</body>
</html>`

const head = (p) => `<!doctype html>
<html lang="tl" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">

<title>${p.title}</title>
<meta name="description" content="${p.description}">
${p.keywords ? `<meta name="keywords" content="${p.keywords}">\n` : ''}<meta name="theme-color" content="#063D1B">
<link rel="canonical" href="${SITE}/${p.slug}">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">

<meta property="og:type" content="website">
<meta property="og:site_name" content="Partido Bangon Bangsamoro">
<meta property="og:locale" content="tl_PH">
<meta property="og:title" content="${p.ogTitle || p.title}">
<meta property="og:description" content="${p.ogDescription || p.description}">
<meta property="og:url" content="${SITE}/${p.slug}">
<meta property="og:image" content="${SITE}/assets/images/${p.image}">
<meta property="og:image:width" content="1600">
<meta property="og:image:height" content="893">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${p.ogTitle || p.title}">
<meta name="twitter:description" content="${p.ogDescription || p.description}">

<link rel="icon" type="image/png" sizes="32x32" href="assets/favicon-32.png">
<link rel="apple-touch-icon" href="assets/pbb-logo-256.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700;800&family=Montserrat:wght@500;600;700;800&family=Roboto+Condensed:wght@400;500;600;700&display=swap" rel="stylesheet">

<link rel="stylesheet" href="assets/pbb-tokens.css">
<link rel="stylesheet" href="assets/pbb-site.css">

<script type="application/ld+json">
${JSON.stringify(p.schema, null, 2)}
</script>
</head>

<body${p.bodyAttrs ? ' ' + p.bodyAttrs : ''}>

<a class="skip-link" href="#main">Laktawan papunta sa nilalaman</a>

<div class="outbox-banner no-print" id="outboxBanner" hidden>
  May naka-queue kang sign-up na hindi pa naipapadala. Awtomatiko itong susubukan ulit pagbalik ng signal.
</div>

${header(p.slug)}`

/* Breadcrumb schema helper */
const crumbs = (trail) => ({
  '@type': 'BreadcrumbList',
  itemListElement: trail.map(([name, url], i) => ({
    '@type': 'ListItem', position: i + 1, name, ...(url ? { item: SITE + '/' + url } : {})
  })),
})

/* FAQ: one source of truth per page — the schema and the visible <details>
   are both generated from the same array, so they cannot drift apart. */
const faqSchema = (items) => ({
  '@type': 'FAQPage',
  mainEntity: items.map((f) => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.plain || f.a.replace(/<[^>]*>/g, '') },
  })),
})

const faqHtml = (items, heading) => `
  <section id="faq" class="band-tint" aria-labelledby="faq-h">
    <div class="wrap">
      <div class="section-head">
        <p class="eyebrow">Mga madalas itanong</p>
        <h2 id="faq-h">${heading}</h2>
      </div>
      <div class="faq-list">
${items.map((f) => `        <details class="disclose">
          <summary>${f.q}</summary>
          <div class="disclose-body">
            <p style="margin:0">${f.a}</p>
          </div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>`

/* Messenger block, reused on several pages. Mirrors the Persistent Menu in
   docs/internal/facebook-messenger-automated-responses.md so the site and the
   bot offer the same four doors. */
const messengerBlock = (intro) => `
  <section aria-labelledby="msgr-h">
    <div class="wrap">
      <div class="msgr-card">
        <span class="msgr-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.3 2 2 6.2 2 11.7c0 3.1 1.4 5.9 3.7 7.7v3.8l3.4-1.9c.9.3 1.9.4 2.9.4 5.7 0 10-4.2 10-9.7S17.7 2 12 2zm1 13.1-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.4 5.8z"/></svg>
        </span>
        <div>
          <h3 id="msgr-h">Mag-message sa amin</h3>
          <p>${intro}</p>
          <div class="msgr-chips">
            <a class="msgr-chip" data-messenger="menu_about">🕊️ Tungkol sa PBB</a>
            <a class="msgr-chip" data-messenger="menu_platform">📋 BANGON Platform</a>
            <a class="msgr-chip" data-messenger="menu_volunteer">🙋 Mag-volunteer</a>
            <a class="msgr-chip" data-messenger="menu_contact">📞 Makipag-ugnayan</a>
          </div>
          <p class="form-note">
            Karaniwang sumasagot kami sa loob ng ilang oras. Para sa madalian —
            insidente, reklamo, o usaping pangkaligtasan — tumawag sa
            <a href="tel:+639663018777"><strong>0966 301 8777</strong></a>; may taong sasagot,
            hindi awtomatikong mensahe.
          </p>
        </div>
      </div>
    </div>
  </section>`

/* =========================================================================
   PAGE 1 — BANGON PLATFORM
   ========================================================================= */

const PILLARS = [
  ['B', 'Batayang Serbisyo', 'bangon-basic-services.html', 'Basic Services Enhancement',
   '₱8,000 household subsidy, Super Health Stations na may libreng gamot at laboratoryo, at libreng internet sa paaralan.'],
  ['A', 'Alyansa at Partnership', 'bangon-alliance.html', 'Alliance Building &amp; Partnerships',
   'Bottom-Up Budgeting: ang barangay ang magsasabi kung saan mapupunta ang pondo, hindi ang Cotabato lang.'],
  ['N', 'Kalikasan', 'bangon-natural-resources.html', 'Natural Resources Protection',
   'Palaw Rangers, reforestation, proteksyon ng karagatan, at climate-smart na sakahan.'],
  ['G', 'Green Economy', 'bangon-green-economy.html', 'Green Economy Acceleration',
   "Halal bilang pandaigdigang pamantayan, Shari'ah-compliant na financing, at Green Skills na may trabaho sa dulo."],
  ['O', 'Bukas na Pamahalaan', 'bangon-open-governance.html', 'Open &amp; Inclusive Governance',
   'Meritokrasya sa pagkuha ng empleyado, nababakas na badyet, at anti-korapsyon na may ngipin.'],
  ['N', 'Kapayapaan', 'bangon-peace.html', 'Non-violent Conflict Resolution',
   'Reintegrasyon ng dating kombatant, rehabilitasyon ng Marawi, at community-based na dayalogo.'],
]

const bangonFaq = [
  { q: 'Ano ang ibig sabihin ng BANGON?',
    a: 'Ito ang platform of government ng PBB — anim na haligi, isa sa bawat letra: <strong>B</strong>asic Services Enhancement, <strong>A</strong>lliance Building &amp; Partnerships, <strong>N</strong>atural Resources Protection, <strong>G</strong>reen Economy Acceleration, <strong>O</strong>pen &amp; Inclusive Governance, at <strong>N</strong>on-violent Conflict Resolution. Ang salitang “bangon” mismo ay pag-ahon at pagtayo.' },
  { q: 'Bakit anim lang? Hindi ba masyadong kaunti?',
    a: 'Sinasadya. Ang mahabang listahan ng pangako ay madaling gawin at mahirap panagutan. Anim na haligi ang kayang tandaan ng botante, kayang ipaliwanag ng volunteer sa pintuan, at kayang sukatin pagkatapos ng termino.' },
  { q: 'May panukalang batas ba sa likod ng bawat haligi?',
    a: 'Oo. Ang bawat haligi ay may kaukulang panukalang batas sa aming legislative agenda — halimbawa, ang Super Health Stations Act sa ilalim ng Batayang Serbisyo, at ang Marawi Siege Victims Compensation Act sa ilalim ng Kapayapaan. Nakalista ang mga ito sa bawat pahina ng haligi.' },
  { q: 'Paano ito babayaran?',
    a: 'Mula sa Block Grant at Special Development Fund na nakalaan na sa BARMM sa ilalim ng Bangsamoro Organic Law. Ang tanong ay hindi kung may pondo — ang tanong ay kung saan ito napupunta at kung sino ang nakakakita ng listahan. Kaya nakatali ang lahat ng haligi sa Bukas na Pamahalaan.' },
  { q: 'Alin ang pinakaunang gagawin?',
    a: 'Ang Batayang Serbisyo at ang Bukas na Pamahalaan ay magkasabay. Walang saysay ang subsidy kung hindi mababakas ang pera, at walang kabuluhan ang transparency kung walang serbisyong dumarating sa pamilya.' },
  { q: 'Saan ko makikita ang buong detalye?',
    a: 'May sariling pahina ang bawat haligi, na may konkretong pangako, kaugnay na panukalang batas, at paraan para makatulong ka. I-tap lang ang haligi sa itaas.' },
]

const bangonPage = {
  slug: 'bangon.html',
  image: 'bangon-platform.jpg',
  title: 'Ang BANGON Platform ng PBB — Anim na Haligi | PBB',
  description: 'Ang BANGON platform of government ng PBB: anim na haligi — Batayang Serbisyo, Alyansa, Kalikasan, Green Economy, Bukas na Pamahalaan, at Kapayapaan.',
  keywords: 'BANGON platform, platform of government PBB, Partido Bangon Bangsamoro platform, BARMM 2026 platform, anim na haligi BANGON',
  ogTitle: 'Ang BANGON Platform — Anim na Haligi ng PBB',
  schema: {
    '@context': 'https://schema.org',
    '@graph': [
      crumbs([['Simula', ''], ['Ang BANGON Platform', 'bangon.html']]),
      {
        '@type': 'ItemList',
        name: 'Ang anim na haligi ng BANGON platform',
        itemListElement: PILLARS.map(([letter, label, href, en], i) => ({
          '@type': 'ListItem', position: i + 1, name: `${letter} — ${label} (${en.replace(/&amp;/g, '&')})`, url: SITE + '/' + href,
        })),
      },
      faqSchema(bangonFaq),
    ],
  },
  body: `
  <section class="hero hero-compact">
    <div class="wrap">
      <ol class="breadcrumb">
        <li><a href="home.html">Simula</a></li>
        <li>Ang BANGON Platform</li>
      </ol>
      <h1>Ang BANGON Platform of Government</h1>
      <p class="lede">
        Anim na haligi, isa sa bawat letra ng salitang <strong>BANGON</strong>. Hindi ito
        listahan ng pangako — ito ay paraan ng pamamahala, na may panukalang batas sa likod
        ng bawat isa at may paraan para makatulong ka sa bawat isa.
      </p>
      <div class="hero-actions">
        <a class="btn btn-gold" href="#haligi">Tingnan ang anim na haligi</a>
        <a class="btn btn-ghost" href="join.html">Sumali sa Kilusan</a>
      </div>
    </div>
  </section>

  <section id="haligi" aria-labelledby="pillars-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Ang anim na haligi</p>
        <h2 id="pillars-h">B · A · N · G · O · N</h2>
        <p>May sariling pahina ang bawat haligi. I-tap ang gusto mong basahin.</p>
      </div>

      <div class="grid-auto" data-pillar-grid>
${PILLARS.map(([letter, label, href, en, blurb]) => `        <a class="card card-link pillar-card reveal" href="${href}" data-pillar="${href.replace('bangon-', '').replace('.html', '')}">
          <span class="persona-flag" data-persona-flag hidden></span>
          <span class="pillar-card-head">
            <span class="pillar-letter" aria-hidden="true">${letter}</span>
            <h3>${label}</h3>
          </span>
          <p style="font-family:var(--pbb-font-label);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;color:var(--pbb-gold-deep);font-weight:700">${en}</p>
          <p>${blurb}</p>
          <span class="more">Basahin ang buong plano →</span>
        </a>`).join('\n')}
      </div>
    </div>
  </section>

  <section class="band-tint" aria-labelledby="wings-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Legislative agenda</p>
        <h2 id="wings-h">Tatlong pakpak ng panukalang batas</h2>
        <p>
          Ang haligi ay direksyon; ang batas ang nagpapatupad nito. Nakagrupo sa tatlo ang
          aming panukala, ayon sa kung ano ang aayusin nila.
        </p>
      </div>

      <div class="grid-auto">
        <div class="card reveal">
          <h3>Wing A — Serbisyo at Kabuhayan</h3>
          <p style="margin:0">Super Health Stations Act, panukala sa household subsidy, at
             libreng internet sa paaralan. Ang direktang dumarating sa pamilya.</p>
        </div>
        <div class="card reveal">
          <h3>Wing B — Ekonomiya at Kalikasan</h3>
          <p style="margin:0">Bangsamoro Investments and Incentives Code, Environment and
             Natural Resources Code, at ang Ligawasan Development Authority Act.</p>
        </div>
        <div class="card reveal">
          <h3>Wing C — Pamamahala at Kapayapaan</h3>
          <p style="margin:0">Bottom-Up Budgeting, Bangsamoro Gender and Development Code,
             at ang Marawi Siege Victims Compensation Act.</p>
        </div>
      </div>
    </div>
  </section>

  <section aria-labelledby="horizon-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Paano ito bubuoin</p>
        <h2 id="horizon-h">Tatlong yugto</h2>
      </div>
      <div class="grid-auto">
        <div class="card reveal">
          <p class="eyebrow" style="margin-bottom:.3em">Yugto 1 · Ngayon</p>
          <h3>Ang pundasyon</h3>
          <p style="margin:0">Ilagay ang serbisyo kung saan ito kulang, at buksan ang libro
             para makita kung saan napupunta ang pera.</p>
        </div>
        <div class="card reveal">
          <p class="eyebrow" style="margin-bottom:.3em">Yugto 2</p>
          <h3>Ang kakayahan</h3>
          <p style="margin:0">Sanayin ang Halal auditor, green technician, at health worker
             na taga-BARMM mismo — para hindi na kailangang mag-import ng kasanayan.</p>
        </div>
        <div class="card reveal">
          <p class="eyebrow" style="margin-bottom:.3em">Yugto 3</p>
          <h3>Ang kompetisyon</h3>
          <p style="margin:0">Pumasok sa pandaigdigang merkado bilang katumbas — hindi bilang
             rehiyong naghihintay ng ayuda.</p>
        </div>
      </div>
    </div>
  </section>
${faqHtml(bangonFaq, 'Tungkol sa BANGON platform')}
${messengerBlock('May tanong sa platform? I-tap ang <strong>BANGON Platform</strong> sa ibaba at padadalhan ka namin ng buod, o magtanong nang direkta.')}

  <section class="band-navy">
    <div class="wrap" style="text-align:center">
      <h2>Handa ka nang sumali?</h2>
      <p style="margin-inline:auto">Ang platform ay papel hangga't walang taong magpapatupad nito.</p>
      <div class="hero-actions" style="justify-content:center">
        <a class="btn btn-gold" href="membership.html">Maging miyembro</a>
        <a class="btn btn-ghost" href="volunteer.html">Mag-volunteer</a>
      </div>
    </div>
  </section>
`,
}

/* =========================================================================
   PAGE 2 — ABOUT
   ========================================================================= */

const aboutFaq = [
  { q: 'Kailan itinatag ang PBB?',
    a: 'Noong 2022 sa Cotabato City, ng mga propesyonal at grassroots na lider. Binigyan ng rehistrasyon ng COMELEC noong 2026 para lumahok sa unang parliamentaryong halalan ng Bangsamoro.' },
  { q: 'Kaugnay ba ang PBB ng MILF o MNLF?',
    a: 'Hindi. Malaya ang PBB sa dalawang kilusan. Iginagalang namin ang kanilang sakripisyo at ang proseso ng kapayapaang binuo nila — pero iba ang inaalok naming paraan ng pamamahala, at hindi kami nagmula sa alinman sa kanila.' },
  { q: 'Ilan ang miyembro ng PBB?',
    a: 'Humigit-kumulang 71,000 sa anim na probinsya at tatlong komponent na lungsod ng BARMM, mula pa noong 2022. Puwede kang makadagdag sa bilang na iyon sa pamamagitan ng membership form.' },
  { q: 'Sino ang namumuno sa PBB?',
    a: 'Si Nashrudin Piang Kusain, ang Regional President at nagtatag ng partido noong 2022. Hindi siya galing sa political clan at hindi siya dating miyembro ng MILF o MNLF.' },
  { q: 'Bakit "professional-led"?',
    a: 'Dahil doktor, abogado, inhinyero, at guro ang bumuo nito — mga taong ang trabaho ay pagpapatakbo ng sistema. Ang paniniwala namin: ang susunod na yugto ng Bangsamoro ay tungkol na sa kung sino ang kayang magpatakbo ng ospital at maglathala ng badyet, hindi na lang kung sino ang nakipaglaban.' },
  { q: 'Ano ang pinagkaiba ninyo sa ibang partido sa BARMM?',
    a: 'Iba ang batayan ng lakas. Ang ilang partido ay nakaugat sa rebolusyonaryong kasaysayan; ang iba ay sa alyansa ng mga naitatag nang pamilyang pulitikal. Ang sa amin ay sa organisasyon at sektor — kooperatiba, asosasyon, samahan. Hindi ito nangangahulugang mali sila; ang ibig sabihin ay iba ang aming pinagmumulan ng lakas, at iba ang aming pananagutan.' },
]

const aboutPage = {
  slug: 'about.html',
  image: 'engine-of-reform.jpg',
  title: 'Tungkol sa Partido Bangon Bangsamoro | PBB',
  description: 'Itinatag noong 2022 sa Cotabato City ng mga propesyonal at grassroots na lider. 71,000+ miyembro, malaya sa MILF at MNLF, nakabatay sa meritokrasya.',
  keywords: 'tungkol sa PBB, Partido Bangon Bangsamoro history, Nashrudin Kusain, BARMM political party, PBB founding',
  ogTitle: 'Tungkol sa Partido Bangon Bangsamoro',
  schema: {
    '@context': 'https://schema.org',
    '@graph': [
      crumbs([['Simula', ''], ['Tungkol sa PBB', 'about.html']]),
      {
        '@type': 'AboutPage',
        name: 'Tungkol sa Partido Bangon Bangsamoro',
        url: SITE + '/about.html',
        mainEntity: {
          '@type': 'PoliticalParty',
          name: 'Partido Bangon Bangsamoro',
          alternateName: 'PBB',
          url: SITE + '/',
          logo: SITE + '/assets/pbb-logo-256.png',
          foundingDate: '2022',
          foundingLocation: { '@type': 'Place', name: 'Cotabato City, BARMM, Philippines' },
          areaServed: 'Bangsamoro Autonomous Region in Muslim Mindanao',
          numberOfEmployees: undefined,
          member: { '@type': 'QuantitativeValue', value: 71000 },
          employee: { '@type': 'Person', name: 'Nashrudin Piang Kusain', jobTitle: 'Regional President' },
          telephone: '+63-966-301-8777',
          email: 'info@bangonbangsamoro.com',
        },
      },
      faqSchema(aboutFaq),
    ],
  },
  body: `
  <section class="hero hero-compact">
    <div class="wrap">
      <ol class="breadcrumb">
        <li><a href="home.html">Simula</a></li>
        <li>Tungkol sa PBB</li>
      </ol>
      <h1>Tungkol sa Partido Bangon Bangsamoro</h1>
      <p class="lede">
        Isang rehiyonal na partido sa BARMM, itinatag noong 2022 sa Cotabato City ng mga
        propesyonal at grassroots na lider. Hindi kami galing sa armadong kilusan at hindi
        kami galing sa political clan. Iba ang aming pinagmumulan — at iba rin ang aming
        pananagutan.
      </p>
    </div>
  </section>

  <section class="band-tint">
    <div class="wrap">
      <div class="stat-row reveal">
        <div class="stat"><b>2022</b><span>itinatag sa Cotabato City</span></div>
        <div class="stat"><b>71,000+</b><span>miyembro sa buong BARMM</span></div>
        <div class="stat"><b>6+3</b><span>probinsya at komponent na lungsod</span></div>
        <div class="stat"><b>2026</b><span>rehistrado ng COMELEC</span></div>
      </div>
    </div>
  </section>

  <section aria-labelledby="story-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Ang simula</p>
        <h2 id="story-h">Bakit binuo ang PBB</h2>
      </div>
      <div class="reveal" style="max-width:68ch">
        <p>
          Nagsimula ito sa isang obserbasyon na pamilyar sa halos lahat ng taga-BARMM: mahigit
          dalawang dekada ng proseso ng kapayapaan, at ang minimum wage ay ₱411 pa rin kada
          araw habang ang Family Living Wage ay ₱2,201. Dumating ang katahimikan. Ang kaunlaran
          ay hindi pa.
        </p>
        <p>
          Noong 2022, nagtipon sa Cotabato City ang isang grupo ng doktor, abogado, inhinyero,
          guro, at lider ng komunidad. Ang tanong nila ay hindi kung sino ang dapat mamuno,
          kundi kung <em>anong klaseng kakayahan</em> ang kailangan sa susunod na yugto. Ang
          pagtatapos ng digmaan ay nangangailangan ng isang uri ng lakas ng loob. Ang
          pagpapatakbo ng ospital, pagbubukas ng merkado, at paglalathala ng badyet ay
          nangangailangan ng iba.
        </p>
        <p>
          Iyon ang PBB: hindi kapalit ng kilusang pangkapayapaan, kundi ang susunod na hakbang
          pagkatapos nito.
        </p>
      </div>
    </div>
  </section>

  <section class="band-navy" aria-labelledby="lead-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Lideratura</p>
        <h2 id="lead-h">Nashrudin Piang Kusain</h2>
      </div>
      <div class="grid-auto">
        <figure class="showcase reveal-figure" style="margin:0">
          <div class="showcase-frame">
            <img src="assets/leadership/nashrudin-kusain.jpg" width="1200" height="900" loading="lazy"
                 alt="Si Nashrudin Piang Kusain, Regional President ng Partido Bangon Bangsamoro.">
          </div>
        </figure>
        <div class="reveal">
          <p style="color:var(--pbb-gold-bright);font-family:var(--pbb-font-label);font-weight:600">Regional President · Founding leader, 2022</p>
          <p>
            Itinatag ni Kusain ang PBB bilang <em>professional-led alternative</em> sa
            tradisyunal na pulitika ng BARMM. Hindi siya nagmula sa political clan, at hindi rin
            siya dating miyembro ng MILF o MNLF.
          </p>
          <p>
            Siya ang nagpanukala ng BANGON platform — anim na haliging naglalayong gawing
            future-ready ang Bangsamoro, mula sa libreng internet at Super Health Stations
            hanggang sa Green Skills at Shari'ah-compliant na financing.
          </p>
          <p style="color:var(--pbb-ink)"><strong>“Tapos na ang panahon ng paghihintay. Panahon na ng pagtatayo.”</strong></p>
        </div>
      </div>
    </div>
  </section>

  <section aria-labelledby="values-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Ang aming pinaninindigan</p>
        <h2 id="values-h">Limang saligang haligi</h2>
      </div>
      <div class="grid-auto">
        <div class="card reveal"><h3>Pananalig sa Iisang Diyos</h3><p style="margin:0">Ang pananampalataya ang moral na saligan ng paglilingkod — hindi kasangkapan sa kampanya.</p></div>
        <div class="card reveal"><h3>Awtonomiyang Rehiyonal</h3><p style="margin:0">Tunay na awtonomiya sa loob ng balangkas ng Pilipinas, ayon sa Bangsamoro Organic Law.</p></div>
        <div class="card reveal"><h3>Katarungang Panlipunan</h3><p style="margin:0">Ang pinakamalayong barangay ang panukat, hindi ang sentro ng lungsod.</p></div>
        <div class="card reveal"><h3>Balanseng Ekolohiya</h3><p style="margin:0">Ang lupa at dagat ay hiram sa susunod na henerasyon, hindi mana ng kasalukuyan.</p></div>
        <div class="card reveal"><h3>Kapayapaan at Pagkakasundo</h3><p style="margin:0">Dayalogo at restorative justice bago anumang pamimilit.</p></div>
        <div class="card reveal"><h3>Meritokrasya</h3><p style="margin:0">Ang kakayahan ang dapat magbukas ng pinto — hindi ang apelyido o ang padrino.</p></div>
      </div>
    </div>
  </section>

  <section class="band-tint" aria-labelledby="pos-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Sa mas malawak na larangan</p>
        <h2 id="pos-h">Saan kami nakatayo</h2>
        <p>
          Maraming partido sa BARMM ngayon, at may lehitimong batayan ang bawat isa. Narito
          ang aming pagkakaiba — nakasaad nang patas, dahil karapatan ninyong maghambing.
        </p>
      </div>
      <div class="grid-auto">
        <div class="card reveal">
          <h3>Rebolusyonaryong pamana</h3>
          <p style="margin:0">May mga partidong nakaugat sa MILF o MNLF, at may moral na
             awtoridad silang galing sa sakripisyo. Ang lakas nila: lehitimidad at organisadong
             base. Ang hamon: ang pamumuno sa panahon ng digmaan at ang pamamahala sa panahon
             ng kapayapaan ay magkaibang kasanayan.</p>
        </div>
        <div class="card reveal">
          <h3>Koalisyon ng mga pamilya</h3>
          <p style="margin:0">May mga partidong binuo sa pagitan ng mga naitatag nang
             pamilyang pulitikal. Ang lakas nila: abot at rekurso sa buong rehiyon. Ang hamon:
             ang pagbabahagi ng posisyon sa pagitan ng iilan ay hindi pareho ng pagbubukas nito
             sa lahat.</p>
        </div>
        <div class="card reveal">
          <h3>Ang PBB</h3>
          <p style="margin:0">Nakabatay sa organisasyon at sektor, hindi sa angkan o sa
             armadong kasaysayan. Ang lakas namin: teknikal na kakayahan at bagong mukha. Ang
             hamon — at sasabihin namin ito nang tapat — mas maliit ang aming makinarya kaysa
             sa dalawang nabanggit. Kaya kailangan namin kayo.</p>
        </div>
      </div>
    </div>
  </section>
${faqHtml(aboutFaq, 'Tungkol sa partido')}
${messengerBlock('Gusto mong makausap ang isang tao mula sa PBB? Mag-message sa amin — sinasagot namin ito araw-araw.')}
`,
}

/* =========================================================================
   PAGE 3 — VOTER EDUCATION
   ========================================================================= */

const voterFaq = [
  { q: 'Kailan ang halalan sa Bangsamoro?',
    a: '<strong>Setyembre 14, 2026</strong> — ang unang parliamentaryong halalan ng Bangsamoro. Para sa opisyal na oras ng botohan at anumang pagbabago, sumangguni sa COMELEC.' },
  { q: 'Paano ako makakaboto? Ano ang dala ko?',
    a: 'Kailangang rehistradong botante ka sa iyong presinto. Magdala ng balidong ID. Ang eksaktong listahan ng tinatanggap na ID at ang proseso sa presinto ay itinatakda ng COMELEC — tingnan ang <a href="https://comelec.gov.ph" target="_blank" rel="noopener">comelec.gov.ph</a> o ang inyong lokal na COMELEC office. Bilang partido, hindi namin kayang asikasuhin ang inyong rehistrasyon.' },
  { q: 'Saan ko malalaman ang aking presinto?',
    a: 'Sa precinct finder ng COMELEC, o sa inyong lokal na COMELEC office. Nakasulat din ito sa inyong voter\'s ID o voter certification. Kung hindi ninyo mahanap, tumawag sa aming hotline at tutulungan namin kayong hanapin — pero ang COMELEC pa rin ang opisyal na pinagmumulan.' },
  { q: 'Ano ang pinagkaiba ng party-list at district na boto?',
    a: 'Sa parliamentaryong sistema ng Bangsamoro, may bahagi ng upuan na napupunta sa mga partido ayon sa bilang ng boto nila sa buong rehiyon (party-list), at may bahagi na napupunta sa kinatawan ng bawat distrito. Ibig sabihin, ang boto mo para sa partido ay mahalaga kahit malayo ang panalo sa inyong distrito. Ang eksaktong bilang ng upuan ay itinatakda ng batas at ng COMELEC.' },
  { q: 'Ligtas ba ang bumoto sa aming lugar?',
    a: 'May mga munisipyo sa Lanao del Sur at Maguindanao del Sur na inuuri ng awtoridad bilang mas mataas ang panganib. Ang paninindigan namin ay walang kondisyon: walang armadong grupo ang may lugar sa botohan, kahit kanino pa ito kumakampi. Kung may makita kayong pananakot o insidente, iulat ito sa COMELEC at sa awtoridad — at puwede rin ninyong tawagan ang aming hotline sa buong araw ng eleksyon.' },
  { q: 'Binabayaran ba ng PBB ang boto?',
    a: 'Hindi, at hindi namin ito gagawin. Ang pagbili ng boto ay krimen sa ilalim ng Omnibus Election Code at kabaligtaran ng lahat ng ipinaglalaban namin. Kung may magpakilalang taga-PBB at mag-alok ng pera para sa boto ninyo, hindi siya sa amin — iulat ito sa 0966 301 8777 at sa COMELEC.' },
]

const voterPage = {
  slug: 'voter-education.html',
  image: 'roadmap-2026.jpg',
  title: 'Botante: Setyembre 14, 2026 — Gabay sa Halalan | PBB',
  description: 'Gabay sa halalan ng Bangsamoro sa Set. 14, 2026: sino ang puwedeng bumoto, saan, ano ang dala, at paano gumagana ang party-list at district na boto.',
  keywords: 'halalan Bangsamoro 2026, BARMM parliamentary elections September 14 2026, paano bumoto BARMM, voter education Bangsamoro, precinct finder COMELEC',
  ogTitle: 'Botante: Setyembre 14, 2026',
  schema: {
    '@context': 'https://schema.org',
    '@graph': [
      crumbs([['Simula', ''], ['Botante', 'voter-education.html']]),
      {
        '@type': 'Event',
        name: 'Bangsamoro Parliamentary Elections 2026',
        startDate: '2026-09-14',
        eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: {
          '@type': 'Place',
          name: 'Bangsamoro Autonomous Region in Muslim Mindanao',
          address: { '@type': 'PostalAddress', addressRegion: 'BARMM', addressCountry: 'PH' },
        },
        description: 'Ang unang parliamentaryong halalan ng Bangsamoro Autonomous Region in Muslim Mindanao.',
        organizer: { '@type': 'Organization', name: 'Commission on Elections (COMELEC)', url: 'https://comelec.gov.ph' },
      },
      faqSchema(voterFaq),
    ],
  },
  body: `
  <section class="hero hero-compact">
    <div class="wrap">
      <ol class="breadcrumb">
        <li><a href="home.html">Simula</a></li>
        <li>Botante</li>
      </ol>
      <p class="eyebrow">Setyembre 14, 2026</p>
      <h1>Gabay sa unang parliamentaryong halalan ng Bangsamoro</h1>
      <p class="lede">
        Ang pahinang ito ay pang-edukasyon, hindi pangkampanya. Kahit hindi ninyo kami iboto,
        gusto naming makaboto kayo — at makaboto nang tama.
      </p>
      <div class="hero-actions">
        <a class="btn btn-gold" href="#handa">Paano maghanda</a>
        <a class="btn btn-ghost" href="#ligtas">Ligtas na halalan</a>
      </div>
    </div>
  </section>

  <div class="wrap" style="margin-top:var(--pbb-space-6)">
    <div class="callout">
      <p style="margin-bottom:.4em"><strong>Ang COMELEC ang opisyal na pinagmumulan.</strong></p>
      <p style="margin:0">
        Bilang partido, hindi namin kayang asikasuhin ang inyong rehistrasyon o baguhin ang
        anumang talaan. Para sa rehistrasyon, presinto, at karapatang bumoto, ang
        <a href="https://comelec.gov.ph" target="_blank" rel="noopener">Commission on Elections</a>
        ang may awtoridad. Ang nasa ibaba ay gabay lamang para hindi kayo maligaw.
      </p>
    </div>
  </div>

  <section id="handa" aria-labelledby="prep-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Bago ang Setyembre 14</p>
        <h2 id="prep-h">Apat na hakbang para maging handa</h2>
      </div>
      <div class="grid-auto">
        <div class="card reveal">
          <h3>1. Suriin kung rehistrado ka</h3>
          <p style="margin:0">Kung hindi ka nakaboto noong nakaraang halalan, maaaring
             deactivated na ang iyong rekord. Alamin ito sa COMELEC bago pa magsara ang panahon
             ng pagwawasto.</p>
        </div>
        <div class="card reveal">
          <h3>2. Hanapin ang iyong presinto</h3>
          <p style="margin:0">Nasa voter's ID o voter certification mo ito, o sa precinct
             finder ng COMELEC. Alamin din kung saang paaralan ito nakalagay.</p>
        </div>
        <div class="card reveal">
          <h3>3. Ihanda ang iyong ID</h3>
          <p style="margin:0">Magdala ng balidong ID sa araw ng botohan. Ang listahan ng
             tinatanggap ay itinatakda ng COMELEC — tingnan ito nang maaga, hindi sa mismong araw.</p>
        </div>
        <div class="card reveal">
          <h3>4. Alamin ang mga kandidato</h3>
          <p style="margin:0">Basahin ang platform, hindi lang ang tarpaulin. Ang sa amin ay
             nasa <a href="bangon.html">pahina ng BANGON platform</a>; may ganito rin ang ibang
             partido, at karapatan ninyong ihambing.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="band-tint" aria-labelledby="sys-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Paano gumagana</p>
        <h2 id="sys-h">Ang parliamentaryong sistema, sa simpleng salita</h2>
      </div>
      <div style="max-width:68ch">
        <p class="reveal">
          Sa mga nakaraang halalan, boboto kayo ng tao. Sa parliamentaryong sistema, boboto rin
          kayo ng <strong>partido</strong> — at ang bilang ng upuan ng bawat partido sa
          parlamento ay nakabatay sa kabuuang boto nito sa buong rehiyon.
        </p>
        <p class="reveal">
          Ang praktikal na kahulugan nito: <strong>mahalaga ang boto mo kahit malayo ang panalo
          sa inyong distrito.</strong> Sa lumang sistema, ang natalo sa inyong lugar ay wala nang
          bunga. Sa party-list na bahagi, bawat boto ay bumibilang sa kabuuan.
        </p>
        <p class="reveal">
          May bahagi rin ng upuan na para sa kinatawan ng bawat distrito, at may nakalaang upuan
          para sa ilang sektor. Ang eksaktong bilang ng upuan sa bawat kategorya ay itinatakda ng
          batas at inaanunsyo ng COMELEC — <strong>tingnan ang COMELEC para sa pinal na bilang</strong>,
          dahil nagbago ito kasunod ng mga pagbabago sa saklaw ng rehiyon.
        </p>
      </div>
    </div>
  </section>

  <section id="ligtas" aria-labelledby="safe-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Sa araw ng botohan</p>
        <h2 id="safe-h">Ligtas at malinis na halalan</h2>
      </div>
      <div class="grid-auto">
        <div class="card reveal">
          <h3>Walang armadong grupo sa botohan</h3>
          <p style="margin:0">Walang kondisyon ito at hindi ito nakadepende sa kung kanino
             kumakampi ang grupo. Kung may pananakot, iulat sa COMELEC at sa awtoridad.</p>
        </div>
        <div class="card reveal">
          <h3>Huwag ibenta ang boto</h3>
          <p style="margin:0">Krimen ang pagbili at pagbebenta ng boto. Kung may magpakilalang
             taga-PBB at mag-alok ng pera, <strong>hindi siya sa amin</strong> — iulat ito sa
             amin at sa COMELEC.</p>
        </div>
        <div class="card reveal">
          <h3>May hotline kami buong araw</h3>
          <p style="margin:0"><a href="tel:+639663018777"><strong>0966 301 8777</strong></a> —
             bukas sa buong araw ng eleksyon para sa tanong at sa ulat ng insidente. May taong
             sasagot.</p>
        </div>
      </div>

      <div class="callout" style="margin-top:var(--pbb-space-5)">
        <p style="margin:0">
          <strong>Kung nasa panganib kayo ngayon</strong>, huwag munang mag-message —
          tumawag sa lokal na pulisya o sa emergency hotline muna. Ang aming hotline ay para sa
          tanong at ulat, hindi kapalit ng emergency response.
        </p>
      </div>
    </div>
  </section>
${faqHtml(voterFaq, 'Tungkol sa pagboto')}
${messengerBlock('May tanong tungkol sa halalan? Mag-message sa amin — pero para sa rehistrasyon at presinto, ang COMELEC pa rin ang opisyal na sagot.')}
`,
}

/* =========================================================================
   PAGE 4 — FAQ
   ========================================================================= */

const siteFaq = [
  { q: 'Ano ang Partido Bangon Bangsamoro?',
    a: 'Isang rehiyonal na partido sa BARMM na lalahok sa parliamentaryong halalan sa Setyembre 14, 2026. Itinatag noong 2022 sa Cotabato City ng mga propesyonal at grassroots na lider, at may humigit-kumulang 71,000 miyembro. <a href="about.html">Basahin ang buong kuwento</a>.' },
  { q: 'Ano ang BANGON platform?',
    a: 'Ang platform of government ng PBB — anim na haligi: Batayang Serbisyo, Alyansa at Partnership, Kalikasan, Green Economy, Bukas na Pamahalaan, at Kapayapaan. <a href="bangon.html">Tingnan ang anim na haligi</a>.' },
  { q: 'Paano ako makakasali?',
    a: 'Tatlong paraan: <a href="membership.html">maging miyembro</a> at kumuha ng PBB Membership ID, <a href="volunteer.html">mag-volunteer</a> sa kampanya, o <a href="partnership.html">pumirma ng partnership agreement</a> kung kumakatawan ka sa isang organisasyon. Libre ang lahat.' },
  { q: 'Magkano ang bayad sa membership?',
    a: 'Wala. Libre ang membership at libre ang Membership ID. Kung may humingi ng bayad sa inyo, iulat ito sa 0966 301 8777.' },
  { q: 'Ano ang pinagkaiba ng miyembro at volunteer?',
    a: 'Ang miyembro ay opisyal na kasapi ng partido at may Membership ID. Ang volunteer ay tumutulong sa kampanya, miyembro man o hindi. Hindi kailangang maging miyembro bago mag-volunteer, at hindi obligadong mag-volunteer ang miyembro.' },
  { q: 'Nasaan ang inyong opisina at paano ko kayo matatawagan?',
    a: 'Party headquarters: Cotabato City, BARMM (visiting hours by appointment). Hotline: <a href="tel:+639663018777">0966 301 8777</a>. Email: <a href="mailto:info@bangonbangsamoro.com">info@bangonbangsamoro.com</a>. Puwede rin kayong mag-message sa Facebook Messenger — sinasagot namin ito araw-araw. <a href="contact.html">Lahat ng paraan ng pakikipag-ugnayan</a>.' },
  { q: 'Kailan ang halalan at paano ako makakaboto?',
    a: 'Setyembre 14, 2026. Para sa rehistrasyon, presinto, at karapatang bumoto, ang COMELEC ang opisyal na pinagmumulan — bilang partido hindi namin kayang asikasuhin ang inyong rehistrasyon. May <a href="voter-education.html">gabay sa botante</a> kami para hindi kayo maligaw.' },
  { q: 'Puwede ba akong mag-donate o sumuporta sa kampanya?',
    a: 'Salamat sa pag-iisip nito. Piliin ang "Mag-donate ng resources" sa <a href="volunteer.html">volunteer form</a>, o mag-email sa info@bangonbangsamoro.com at gagabayan namin kayo. Lahat ng kontribusyon ay saklaw ng COMELEC campaign finance rules at iniuulat nang naaayon.' },
  { q: 'Kaugnay ba ang PBB ng MILF o MNLF?',
    a: 'Hindi. Malaya ang PBB sa dalawang kilusan. Iginagalang namin ang kanilang sakripisyo at ang proseso ng kapayapaan, pero hindi kami nagmula sa alinman sa kanila.' },
  { q: 'Ano ang PBB Membership ID? Government ID ba ito?',
    a: 'Patunay ito ng membership sa partido, na may litrato, lagda, at QR code na puwedeng i-verify. <strong>Hindi ito government-issued ID</strong> at hindi kapalit ng voter\'s ID o national ID. Puwedeng i-verify ang alinmang ID sa <a href="verify.html">verification page</a>.' },
  { q: 'Ano ang gagawin ninyo sa aking personal na impormasyon?',
    a: 'Ang pagiging kasapi sa isang partido ay <em>sensitive personal information</em> sa ilalim ng RA 10173. Hindi namin ito ibinebenta, ipinapasa sa ibang organisasyon, o inilalathala. Ginagamit lang ito para sa coordination, at puwede kayong tumigil anumang oras sa pag-text ng STOP. <a href="privacy.html">Basahin ang Privacy Policy</a>.' },
  { q: 'Wala akong internet. Paano pa rin ako makakasali?',
    a: 'I-text ang <strong>SUMALI</strong> sa <a href="tel:+639663018777">0966 301 8777</a> at kami na ang bahala sa sign-up ninyo. Puwede rin kayong pumunta sa chapter ng inyong probinsya.' },
]

const faqPage = {
  slug: 'faq.html',
  image: 'bangon-platform.jpg',
  title: 'Mga Madalas Itanong sa PBB | Partido Bangon Bangsamoro',
  description: 'Sagot sa mga madalas itanong tungkol sa Partido Bangon Bangsamoro: ang BANGON platform, paano sumali, membership ID, halalan sa Set. 14, 2026, at privacy.',
  keywords: 'PBB FAQ, madalas itanong Partido Bangon Bangsamoro, paano sumali sa PBB, PBB membership tanong',
  ogTitle: 'Mga Madalas Itanong sa PBB',
  schema: {
    '@context': 'https://schema.org',
    '@graph': [crumbs([['Simula', ''], ['FAQ', 'faq.html']]), faqSchema(siteFaq)],
  },
  body: `
  <section class="hero hero-compact">
    <div class="wrap">
      <ol class="breadcrumb">
        <li><a href="home.html">Simula</a></li>
        <li>FAQ</li>
      </ol>
      <h1>Mga madalas itanong</h1>
      <p class="lede">
        Ang mga tanong na pinakamadalas naming matanggap sa Messenger, sa hotline, at sa
        bahay-bahay. Kung wala rito ang sa inyo, tanungin ninyo kami — walang tanong na
        masyadong simple.
      </p>
      <div class="hero-actions">
        <a class="btn btn-gold" data-messenger="faq_page">Magtanong sa Messenger</a>
        <a class="btn btn-ghost" href="tel:+639663018777">Tumawag: 0966 301 8777</a>
      </div>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="faq-list">
${siteFaq.map((f) => `        <details class="disclose">
          <summary>${f.q}</summary>
          <div class="disclose-body">
            <p style="margin:0">${f.a}</p>
          </div>
        </details>`).join('\n')}
      </div>
    </div>
  </section>
${messengerBlock('Wala rito ang tanong ninyo? Mag-message sa amin at sasagutin ito ng tunay na tao.')}
`,
}

/* =========================================================================
   PAGE 5 — CONTACT
   ========================================================================= */

const contactPage = {
  slug: 'contact.html',
  image: 'hotline.jpg',
  // The contact page already leads with a large Messenger card; a floating
  // button on top of it is noise.
  bodyAttrs: 'data-no-messenger-fab',
  title: 'Makipag-ugnayan sa PBB — Hotline, Email, Messenger | PBB',
  description: 'Tawagan ang PBB hotline 0966 301 8777, mag-email sa info@bangonbangsamoro.com, o mag-message sa Facebook Messenger. Headquarters sa Cotabato City, BARMM.',
  keywords: 'contact PBB, PBB hotline, Partido Bangon Bangsamoro contact, PBB Messenger, PBB Cotabato City office',
  ogTitle: 'Makipag-ugnayan sa PBB',
  schema: {
    '@context': 'https://schema.org',
    '@graph': [
      crumbs([['Simula', ''], ['Makipag-ugnayan', 'contact.html']]),
      {
        '@type': 'ContactPage',
        name: 'Makipag-ugnayan sa Partido Bangon Bangsamoro',
        url: SITE + '/contact.html',
        mainEntity: {
          '@type': 'PoliticalParty',
          name: 'Partido Bangon Bangsamoro',
          alternateName: 'PBB',
          url: SITE + '/',
          logo: SITE + '/assets/pbb-logo-256.png',
          email: 'info@bangonbangsamoro.com',
          telephone: '+63-966-301-8777',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Cotabato City',
            addressRegion: 'BARMM',
            addressCountry: 'PH',
          },
          sameAs: [
            'https://www.facebook.com/profile.php?id=61588593370087',
            'https://m.me/914129215127738',
          ],
          contactPoint: [
            {
              '@type': 'ContactPoint',
              telephone: '+63-966-301-8777',
              contactType: 'customer support',
              areaServed: 'PH',
              availableLanguage: ['Tagalog', 'English', 'Maguindanaon', 'Maranao', 'Tausug'],
            },
            {
              '@type': 'ContactPoint',
              email: 'info@bangonbangsamoro.com',
              contactType: 'general enquiry',
              areaServed: 'PH',
            },
          ],
        },
      },
    ],
  },
  body: `
  <section class="hero hero-compact">
    <div class="wrap">
      <ol class="breadcrumb">
        <li><a href="home.html">Simula</a></li>
        <li>Makipag-ugnayan</li>
      </ol>
      <h1>Makipag-ugnayan sa PBB</h1>
      <p class="lede">
        Apat na paraan para maabot kami. Piliin ang pinakamadali para sa inyo — lahat ito ay
        napupunta sa tunay na tao.
      </p>
    </div>
  </section>

  <section>
    <div class="wrap">
      <div class="grid-auto">

        <div class="card reveal">
          <h3>📞 Hotline</h3>
          <p style="font-size:var(--pbb-text-xl);font-weight:700;margin-bottom:.2em">
            <a href="tel:+639663018777">0966 301 8777</a>
          </p>
          <p style="margin:0">Para sa tanong ng volunteer, tulong sa membership, at ulat ng
             insidente. Bukas sa buong araw ng eleksyon sa Setyembre 14.</p>
        </div>

        <div class="card reveal">
          <h3>✉️ Email</h3>
          <p style="font-weight:600;margin-bottom:.2em">
            <a href="mailto:info@bangonbangsamoro.com">info@bangonbangsamoro.com</a>
          </p>
          <p style="margin:0">Para sa partnership, media inquiry, at anumang bagay na
             nangangailangan ng nakasulat na talaan.</p>
        </div>

        <div class="card reveal">
          <h3>📍 Party headquarters</h3>
          <p style="font-weight:600;margin-bottom:.2em">Cotabato City, BARMM</p>
          <p style="margin:0">Bukas para sa pagbisita ayon sa appointment. Tumawag muna sa
             hotline para maiskedyul.</p>
        </div>

        <div class="card reveal">
          <h3>💬 Facebook</h3>
          <p style="margin-bottom:.6em">Verified updates, iskedyul ng event, at live coverage.</p>
          <a class="btn btn-outline btn-responsive"
             href="https://www.facebook.com/profile.php?id=61588593370087"
             target="_blank" rel="noopener">Bisitahin ang Facebook Page</a>
        </div>

      </div>
    </div>
  </section>

  <section class="band-tint" aria-labelledby="msg-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Ang pinakamabilis</p>
        <h2 id="msg-h">Mag-message sa Messenger</h2>
        <p>
          Ito ang paraang pinakamadalas gamitin ng mga tao, at ito rin ang pinakamabilis
          naming nasasagot. May awtomatikong sagot sa mga karaniwang tanong, at may tunay na
          taong humahawak ng iba.
        </p>
      </div>

      <div class="msgr-card reveal">
        <span class="msgr-icon" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2C6.3 2 2 6.2 2 11.7c0 3.1 1.4 5.9 3.7 7.7v3.8l3.4-1.9c.9.3 1.9.4 2.9.4 5.7 0 10-4.2 10-9.7S17.7 2 12 2zm1 13.1-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 4.9-2.7-5.4 5.8z"/></svg>
        </span>
        <div>
          <h3>Ano ang gusto ninyong malaman?</h3>
          <p>I-tap ang pinakamalapit sa tanong ninyo, o magtanong nang direkta.</p>
          <div class="msgr-chips">
            <a class="msgr-chip" data-messenger="menu_about">🕊️ Tungkol sa PBB</a>
            <a class="msgr-chip" data-messenger="menu_platform">📋 BANGON Platform</a>
            <a class="msgr-chip" data-messenger="menu_volunteer">🙋 Mag-volunteer</a>
            <a class="msgr-chip" data-messenger="menu_contact">📞 Opisina at hotline</a>
            <a class="msgr-chip" data-messenger="menu_election">🗳️ Halalan at pagboto</a>
            <a class="msgr-chip" data-messenger="menu_human">👤 Kausapin ang tunay na tao</a>
          </div>
          <p class="form-note">
            Sumasagot kami sa loob ng ilang oras sa karaniwang araw. Sa gabi (9pm–7am),
            awtomatikong sagot muna ang matatanggap ninyo.
          </p>
        </div>
      </div>

      <div class="callout reveal" style="margin-top:var(--pbb-space-5)">
        <p style="margin-bottom:.4em"><strong>Madalian o sensitibo? Huwag sa Messenger.</strong></p>
        <p style="margin:0">
          Para sa insidente sa halalan, reklamo, usaping pangkaligtasan, o kung may nasa
          panganib — tumawag sa <a href="tel:+639663018777"><strong>0966 301 8777</strong></a>.
          Ang awtomatikong sagot ay hindi kailanman dapat maging huling salita sa ganitong
          mga bagay. Kung may nasa agarang panganib, tumawag muna sa lokal na pulisya.
        </p>
      </div>
    </div>
  </section>

  <section aria-labelledby="which-h">
    <div class="wrap">
      <div class="section-head reveal">
        <p class="eyebrow">Kung hindi ninyo alam kung saan magsisimula</p>
        <h2 id="which-h">Ano ang kailangan ninyo?</h2>
      </div>
      <div class="grid-auto">
        <a class="card card-link pillar-card reveal" href="membership.html">
          <h3>Gusto kong maging miyembro</h3>
          <p>Membership form at PBB Membership ID. Mga 3 minuto.</p>
          <span class="more">Pumunta sa form →</span>
        </a>
        <a class="card card-link pillar-card reveal" href="volunteer.html">
          <h3>Gusto kong tumulong sa kampanya</h3>
          <p>Volunteer sign-up. Isang minuto, walang quota.</p>
          <span class="more">Mag-sign up →</span>
        </a>
        <a class="card card-link pillar-card reveal" href="voter-education.html">
          <h3>May tanong ako sa pagboto</h3>
          <p>Gabay sa halalan ng Setyembre 14, 2026.</p>
          <span class="more">Basahin ang gabay →</span>
        </a>
        <a class="card card-link pillar-card reveal" href="faq.html">
          <h3>May ibang tanong ako</h3>
          <p>Mga madalas itanong, may sagot na.</p>
          <span class="more">Tingnan ang FAQ →</span>
        </a>
      </div>
    </div>
  </section>
`,
}

/* =========================================================================
   Emit
   ========================================================================= */

const PAGES = [bangonPage, aboutPage, voterPage, faqPage, contactPage]

mkdirSync(OUT, { recursive: true })

for (const p of PAGES) {
  const html = `${head(p)}

<main id="main">
${p.body}
</main>

${FOOTER}
`
  writeFileSync(join(OUT, p.slug), html, 'utf8')
  console.log('wrote public/' + p.slug)
}

console.log(`\n${PAGES.length} site pages scaffolded.`)
