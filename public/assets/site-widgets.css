/* ==========================================================================
   PBB — SITE WIDGETS
   Accessibility toolbar + cookie consent banner and modal.
   --------------------------------------------------------------------------
   Styles the DOM built by assets/site-widgets.js. EVERY CLASS NAME HERE IS
   LOAD-BEARING — the JS creates these elements by class, so renaming one
   silently unstyles a widget rather than throwing. If you rename anything,
   change site-widgets.js in the same commit.

   REVISION 15 Aug 2026 — what changed and why

   1. Values now come from pbb-tokens.css instead of being hardcoded. The
      widgets predate the design system; they used their own greens, greys and
      radii, so the cookie banner never quite matched the site it sat on.

   2. Stacking and position collisions fixed. Four things now compete for the
      bottom of the viewport:

          cookie banner      full width, bottom: 0
          a11y toolbar       right, bottom: 80px
          back-to-top        right, bottom: 16px
          Messenger FAB      left,  bottom: 16px

      The banner is full-width and was drawn over the back-to-top button and
      the Messenger button, making both untappable exactly when a first-time
      visitor is most likely to reach for them. The JS now sets
      `body.has-cookie-banner` while the banner is up, and the rules at the
      bottom of this file lift the three floating controls clear of it.

   3. Contrast corrected. The old banner used #666 body text on white (5.7:1,
      fine) but #999 on white for the secondary button label (2.8:1, fails).
      All pairs here are AA.

   4. Safe-area insets added for notched phones — the banner sat under the
      home indicator on iPhones with `viewport-fit=cover`, which every page
      now sets.

   Depends on: pbb-tokens.css
   ========================================================================== */

/* ==========================================================================
   1. ACCESSIBILITY TOOLBAR
   ========================================================================== */

.a11y-toolbar {
  position: fixed;
  bottom: 80px;
  right: 16px;
  z-index: 70;              /* above page chrome (60), below cookie UI */
  font-family: var(--pbb-font-label, system-ui, sans-serif);
}

.a11y-toolbar-toggle {
  width: var(--pbb-tap, 48px);
  height: var(--pbb-tap, 48px);
  display: grid;
  place-content: center;
  border: none;
  border-radius: 50%;
  background: var(--pbb-forest, #0A6E2E);
  color: var(--pbb-white, #fff);
  cursor: pointer;
  box-shadow: var(--pbb-shadow, 0 12px 30px -18px rgba(6, 61, 27, 0.45));
  transition: background-color 0.2s ease, transform 0.2s ease;
}
.a11y-toolbar-toggle:hover {
  background: var(--pbb-forest-mid, #0E5C27);
  transform: translateY(-2px);
}
.a11y-toolbar-toggle:focus-visible {
  outline: 3px solid var(--pbb-gold-bright, #F2C94C);
  outline-offset: 2px;
}

.a11y-toolbar-panel {
  position: absolute;
  bottom: 56px;
  right: 0;
  width: min(260px, calc(100vw - 32px));
  background: var(--pbb-white, #fff);
  border: 1px solid var(--pbb-forest-line, #0A6E2E1f);
  border-radius: var(--pbb-radius, 14px);
  box-shadow: var(--pbb-shadow-lg, 0 20px 40px -16px rgba(6, 61, 27, 0.5));
  padding: var(--pbb-space-3, 0.75rem);
  display: none;
}
.a11y-toolbar-panel.open { display: block; }

.a11y-toolbar-panel h4 {
  font-family: var(--pbb-font-label, system-ui, sans-serif);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--pbb-gold-deep, #8B6914);   /* 5.09:1 on white */
  margin: 0 0 var(--pbb-space-2, 0.5rem);
}

.a11y-btn {
  display: block;
  width: 100%;
  /* 44px, not the 48px used elsewhere: this is a dense settings list, and
     WCAG 2.5.5 asks 44. Below that it would fail. */
  min-height: 44px;
  margin-bottom: 7px;
  padding: var(--pbb-space-2, 0.5rem) var(--pbb-space-3, 0.75rem);
  text-align: left;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--pbb-ink-dark, #14261A);
  background: var(--pbb-forest-tint, #E8F3EA);
  border: 1px solid transparent;
  border-radius: var(--pbb-radius-sm, 8px);
  cursor: pointer;
  transition: background-color 0.2s ease, border-color 0.2s ease;
}
.a11y-btn:last-child { margin-bottom: 0; }
.a11y-btn:hover { background: #D8EBDD; }
.a11y-btn:focus-visible {
  outline: 3px solid var(--pbb-gold-deep, #8B6914);
  outline-offset: 1px;
}
.a11y-btn.active,
.a11y-btn[aria-pressed="true"] {
  background: var(--pbb-forest, #0A6E2E);
  border-color: var(--pbb-forest-deep, #063D1B);
  color: var(--pbb-white, #fff);      /* 6.40:1 */
}

/* ---- Modes the toolbar applies to <html> ------------------------------
   THESE SELECTORS MUST MATCH site-widgets.js applyPrefs(), which toggles
   `pbb-high-contrast`, `pbb-grayscale`, `pbb-dyslexia` and
   `pbb-reduce-motion` on the <html> element — not on <body>, and not with an
   `a11y-` prefix. Get this wrong and the four toggles appear to work (the
   button lights up, the preference persists) while nothing visibly changes,
   which is close to impossible to spot in review. */

/* Deliberately blunt: someone who turns on high contrast wants legibility,
   not brand fidelity. Images are pulled back slightly so photographs do not
   blow out while text gets crisper. */
html.pbb-high-contrast { filter: contrast(1.35); }
html.pbb-high-contrast img,
html.pbb-high-contrast video { filter: contrast(0.95); }

html.pbb-grayscale { filter: grayscale(1); }

html.pbb-dyslexia,
html.pbb-dyslexia body,
html.pbb-dyslexia button,
html.pbb-dyslexia input,
html.pbb-dyslexia select,
html.pbb-dyslexia textarea {
  /* No webfont download: someone who needs this is often on a slow
     connection, and Verdana/Tahoma ship on effectively every device. The
     wider letterforms and looser spacing carry most of the benefit. */
  font-family: Verdana, Tahoma, 'Trebuchet MS', sans-serif !important;
  letter-spacing: 0.04em !important;
  word-spacing: 0.1em !important;
  line-height: 1.8 !important;
}

html.pbb-reduce-motion,
html.pbb-reduce-motion *,
html.pbb-reduce-motion *::before,
html.pbb-reduce-motion *::after {
  animation-duration: 0.001ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.001ms !important;
  scroll-behavior: auto !important;
}
html.pbb-reduce-motion .reveal,
html.pbb-reduce-motion .reveal-figure {
  opacity: 1 !important;
  transform: none !important;
}

/* ==========================================================================
   2. COOKIE BANNER
   ========================================================================== */

.cookie-banner {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 90;              /* above the floating controls, below the modal */
  background: var(--pbb-forest-deep, #063D1B);
  color: var(--pbb-ink, #EAF1EC);
  border-top: 3px solid var(--pbb-gold, #C9A227);
  box-shadow: 0 -8px 24px -12px rgba(0, 0, 0, 0.5);
  /* Clear of the home indicator on notched phones. Every page sets
     viewport-fit=cover, so without this the buttons sit under it. */
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.cookie-banner.hidden { display: none; }

.cookie-banner-inner {
  max-width: var(--pbb-wrap, 1180px);
  margin-inline: auto;
  padding: var(--pbb-space-4, 1rem);
  display: flex;
  flex-direction: column;          /* mobile-first: stacked */
  gap: var(--pbb-space-3, 0.75rem);
}
@media (min-width: 860px) {
  .cookie-banner-inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.cookie-banner-inner p {
  margin: 0;
  font-size: 0.88rem;
  line-height: 1.55;
  color: var(--pbb-ink-soft, #B9C6BD);   /* 7.02:1 on forest-deep */
  max-width: 62ch;
}
.cookie-banner-inner a {
  color: var(--pbb-gold-bright, #F2C94C); /* 7.83:1 */
  text-decoration: underline;
}

.cookie-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pbb-space-2, 0.5rem);
}
/* On a phone the three choices should be equally reachable, and "Accept All"
   should not be the only one that looks like a button. Dark patterns in
   consent UI are a GDPR/DPA problem, not just a taste one. */
@media (max-width: 619px) {
  .cookie-actions { display: grid; grid-template-columns: 1fr 1fr; }
  .cookie-actions .cookie-btn-text { grid-column: 1 / -1; }
}

.cookie-btn {
  min-height: var(--pbb-tap, 48px);
  padding: var(--pbb-space-2, 0.5rem) var(--pbb-space-4, 1rem);
  border-radius: var(--pbb-radius-pill, 999px);
  font-family: var(--pbb-font-label, system-ui, sans-serif);
  font-weight: 700;
  font-size: 0.85rem;
  border: 1px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: filter 0.2s ease, background-color 0.2s ease;
}
.cookie-btn:focus-visible {
  outline: 3px solid var(--pbb-gold-bright, #F2C94C);
  outline-offset: 2px;
}

.cookie-btn-primary {
  background-image: var(--pbb-gold-metal, linear-gradient(135deg, #F7DE8E, #D9AF33 45%, #8B6914));
  color: var(--pbb-forest-deep, #063D1B);
}
.cookie-btn-primary:hover { filter: brightness(1.07); }

.cookie-btn-secondary {
  background: transparent;
  border-color: #ffffff66;
  color: var(--pbb-white, #fff);
}
.cookie-btn-secondary:hover { background: #ffffff1f; }

.cookie-btn-text {
  background: transparent;
  border-color: transparent;
  /* Was #999 on a light banner — 2.8:1, failed AA. On the dark banner,
     --pbb-ink-soft is 7.02:1 and stays visually secondary via weight and the
     absence of a border, not via low contrast. */
  color: var(--pbb-ink-soft, #B9C6BD);
  text-decoration: underline;
}
.cookie-btn-text:hover { color: var(--pbb-white, #fff); }

/* ==========================================================================
   3. COOKIE PREFERENCES MODAL
   ========================================================================== */

.cookie-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;             /* top of the stack */
  background: rgba(6, 31, 15, 0.62);
  display: none;
  align-items: center;
  justify-content: center;
  padding: var(--pbb-space-4, 1rem);
}
.cookie-modal-overlay.open { display: flex; }

.cookie-modal {
  width: min(560px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  background: var(--pbb-white, #fff);
  color: var(--pbb-ink-dark, #14261A);
  border-radius: var(--pbb-radius, 14px);
  box-shadow: var(--pbb-shadow-lg, 0 20px 40px -16px rgba(6, 61, 27, 0.5));
  animation: cookie-modal-in 0.22s var(--pbb-ease-out, cubic-bezier(0.22, 1, 0.36, 1));
}
@keyframes cookie-modal-in {
  from { opacity: 0; transform: translateY(12px) scale(0.985); }
  to   { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .cookie-modal { animation: none; }
}

.cookie-modal-head {
  padding: var(--pbb-space-5, 1.5rem);
  border-bottom: 1px solid var(--pbb-forest-line, #0A6E2E1f);
}
.cookie-modal-head h3 {
  margin: 0 0 var(--pbb-space-2, 0.5rem);
  font-family: var(--pbb-font-display, system-ui, sans-serif);
  font-size: 1.15rem;
}
.cookie-modal-head p {
  margin: 0;
  font-size: 0.88rem;
  color: var(--pbb-ink-dark-soft, #4A5B4F);   /* 7.24:1 on white */
}

.cookie-modal-body { padding: var(--pbb-space-3, 0.75rem) var(--pbb-space-5, 1.5rem); }

.cookie-pref-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--pbb-space-4, 1rem);
  padding: var(--pbb-space-4, 1rem) 0;
  border-bottom: 1px solid #EDF3EE;
}
.cookie-pref-row:last-child { border-bottom: none; }
.cookie-pref-row h4 {
  margin: 0 0 4px;
  font-family: var(--pbb-font-label, system-ui, sans-serif);
  font-size: 0.92rem;
  font-weight: 700;
}
.cookie-pref-row p {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.5;
  color: var(--pbb-ink-dark-soft, #4A5B4F);
}

.cookie-toggle {
  flex: none;
  position: relative;
  width: 52px;
  height: 30px;
  border-radius: var(--pbb-radius-pill, 999px);
  border: none;
  background: #C4D3C8;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.cookie-toggle::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: var(--pbb-white, #fff);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.28);
  transition: transform 0.2s var(--pbb-ease-out, ease);
}
.cookie-toggle.on { background: var(--pbb-forest, #0A6E2E); }
.cookie-toggle.on::after { transform: translateX(22px); }
.cookie-toggle:focus-visible {
  outline: 3px solid var(--pbb-gold-deep, #8B6914);
  outline-offset: 2px;
}
.cookie-toggle[aria-disabled="true"] { opacity: 0.6; cursor: not-allowed; }

.cookie-modal-foot {
  display: flex;
  flex-wrap: wrap;
  gap: var(--pbb-space-2, 0.5rem);
  justify-content: flex-end;
  padding: var(--pbb-space-4, 1rem) var(--pbb-space-5, 1.5rem);
  border-top: 1px solid var(--pbb-forest-line, #0A6E2E1f);
}
/* The modal sits on white, so the banner's dark-surface button colours would
   be invisible here. Restate them for the light surface. */
.cookie-modal .cookie-btn-secondary {
  border-color: var(--pbb-forest, #0A6E2E);
  color: var(--pbb-forest, #0A6E2E);
}
.cookie-modal .cookie-btn-secondary:hover { background: var(--pbb-forest-tint, #E8F3EA); }
.cookie-modal .cookie-btn-text { color: var(--pbb-ink-dark-soft, #4A5B4F); }

@media (max-width: 619px) {
  .cookie-modal-foot { flex-direction: column-reverse; }
  .cookie-modal-foot .cookie-btn { width: 100%; }
}

/* ==========================================================================
   4. COEXISTENCE WITH THE FLOATING CONTROLS
   --------------------------------------------------------------------------
   `body.has-cookie-banner` is set by site-widgets.js while the banner is
   visible. Without this, the full-width banner covers the back-to-top button,
   the Messenger button, and the accessibility toggle — the three controls a
   first-time visitor is most likely to want, hidden at exactly the moment the
   banner appears.

   The offsets assume a banner roughly 130px tall on a phone (stacked layout,
   three buttons) and ~86px from the wide breakpoint up.
   ========================================================================== */

body.has-cookie-banner .back-to-top,
body.has-cookie-banner .msgr-fab { bottom: 146px; }
body.has-cookie-banner .a11y-toolbar { bottom: 210px; }

@media (min-width: 860px) {
  body.has-cookie-banner .back-to-top,
  body.has-cookie-banner .msgr-fab { bottom: 102px; }
  body.has-cookie-banner .a11y-toolbar { bottom: 166px; }
}

.back-to-top,
.msgr-fab,
.a11y-toolbar { transition: bottom 0.25s var(--pbb-ease-out, ease); }

@media print {
  .a11y-toolbar, .cookie-banner, .cookie-modal-overlay { display: none !important; }
}

/* ==========================================================================
   5. PERSISTENT BOTTOM ACTION BAR
   --------------------------------------------------------------------------
   Moved here from pbb-site.css on 20 Aug 2026. The markup is authored
   directly in each page, not built by JS, but the bar appears on all 22
   pages while pbb-site.css is loaded by only 18 — the four legal pages load
   site-widgets.css alone. Living in this file is what makes the bar styled
   everywhere it renders.

   Depends on: pbb-tokens.css
   ========================================================================== */

/* --- Persistent bottom action bar (mobile only) -------------------------
   The conversion links (Sumali / membership / volunteer) previously lived
   only in the footer, i.e. below every other link on the page. This lifts
   them to a always-reachable bar and is what actually produces the "app"
   feel — not a shorter footer.

   Hidden at >=720px, where the sticky header nav already carries the CTA. */
.bottom-bar {
  position: fixed;
  inset-inline: 0;
  bottom: 0;
  z-index: 60;
  display: flex;
  background: var(--pbb-forest-deep);
  border-top: 1px solid #ffffff1f;
  padding-bottom: env(safe-area-inset-bottom, 0px);
}
.bottom-bar a {
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: var(--pbb-tap);
  padding: var(--pbb-space-2) var(--pbb-space-1);
  font-family: var(--pbb-font-label);
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  text-align: center;
  /* Labels are the header's verbatim wording, so two of the four wrap to a
     second line on a 380px screen. Wrapping is correct here; truncating or
     shortening them would recreate the drift this bar is meant to avoid. */
  line-height: 1.15;
  hyphens: none;
  color: var(--pbb-ink-soft);
  text-decoration: none;
}
.bottom-bar a[aria-current="page"] { color: var(--pbb-gold-bright); }
.bottom-bar a.bar-cta {
  background-image: var(--pbb-gold-metal);
  color: var(--pbb-ink-dark);
  font-weight: 700;
}
.bottom-bar a:focus-visible {
  outline: 2px solid var(--pbb-gold-bright);
  outline-offset: -3px;
}

/* Reserve the bar's height so it never covers the last line of the footer,
   including the COMELEC disclosure. */
@media (max-width: 719.98px) {
  body { padding-bottom: calc(var(--pbb-tap) + 12px + env(safe-area-inset-bottom, 0px)); }
  /* back-to-top is fixed at bottom:16px and would sit under the bar. */
  .back-to-top { bottom: calc(var(--pbb-tap) + 28px + env(safe-area-inset-bottom, 0px)); }
}

@media (min-width: 720px) {
  .bottom-bar { display: none; }
}

@media print {
  .bottom-bar { display: none; }
}

/* ==========================================================================
   6. PWA INSTALL BAR
   --------------------------------------------------------------------------
   Styles the DOM built by assets/pbb-pwa.js. Class names are load-bearing —
   the JS creates these elements by class, so a rename here silently unstyles
   the bar rather than throwing. Change both files in the same commit.

   WHY THIS LIVES IN site-widgets.css AND NOT pbb-site.css
   All 21 pages load site-widgets.css; only the 17 non-legal pages load
   pbb-site.css. Putting it there would ship an unstyled stack of buttons on
   privacy.html, terms.html, cookies.html and accessibility.html — the exact
   failure the bottom action bar currently has.

   POSITION
   On phones the persistent .bottom-bar occupies bottom:0, so this docks
   directly above it. From 720px the bottom bar is hidden and this floats
   with a normal margin. z-index 80: above the bottom bar (60) and the a11y
   toolbar (70), below the cookie banner (90) — consent outranks install.
   ========================================================================== */

.pwa-install {
  position: fixed;
  inset-inline: 0;
  bottom: calc(var(--pbb-tap, 48px) + env(safe-area-inset-bottom, 0px));
  z-index: 80;
  padding: var(--pbb-space-3, 0.75rem);
  transform: translateY(120%);
  opacity: 0;
  transition:
    transform 0.28s var(--pbb-ease-out, cubic-bezier(0.22, 1, 0.36, 1)),
    opacity 0.28s var(--pbb-ease-out, ease);
  pointer-events: none;
}
.pwa-install.is-visible {
  transform: translateY(0);
  opacity: 1;
  pointer-events: auto;
}
.pwa-install[hidden] { display: none; }

.pwa-install-inner {
  position: relative;
  max-width: var(--pbb-wrap, 1180px);
  margin-inline: auto;
  display: flex;
  align-items: center;
  gap: var(--pbb-space-3, 0.75rem);
  padding: var(--pbb-space-3, 0.75rem);
  padding-inline-end: var(--pbb-space-6, 1.5rem);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-top: 3px solid var(--pbb-gold, #C9A227);
  border-radius: var(--pbb-radius, 10px);
  background: var(--pbb-forest-deep, #063D1B);
  color: var(--pbb-ink, #EAF1EC);
  box-shadow: 0 12px 32px -14px rgba(0, 0, 0, 0.65);
}

.pwa-install-icon {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  border-radius: 50%;
}

.pwa-install-copy { flex: 1 1 auto; min-width: 0; }

.pwa-install-title {
  margin: 0;
  font-family: var(--pbb-font-label, system-ui, sans-serif);
  font-size: 0.9rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--pbb-gold-bright, #F7DE8E);
}

.pwa-install-sub {
  margin: 2px 0 0;
  font-family: var(--pbb-font-body, system-ui, sans-serif);
  font-size: 0.8rem;
  line-height: 1.35;
  /* AA on #063D1B. Do not lighten the background without rechecking. */
  color: var(--pbb-ink-soft, #C8D8CC);
}

.pwa-install-ios {
  margin: 0 0 var(--pbb-space-2, 0.5rem);
  font-family: var(--pbb-font-body, system-ui, sans-serif);
  font-size: 0.8rem;
  line-height: 1.4;
  color: var(--pbb-ink, #EAF1EC);
}
.pwa-install-ios strong { color: var(--pbb-gold-bright, #F7DE8E); }

.pwa-install-actions {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--pbb-space-2, 0.5rem);
}

.pwa-btn {
  min-height: var(--pbb-tap, 48px);
  padding-inline: var(--pbb-space-4, 1rem);
  border: none;
  border-radius: var(--pbb-radius-sm, 8px);
  font-family: var(--pbb-font-label, system-ui, sans-serif);
  font-size: 0.82rem;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
}
.pwa-btn-primary {
  background-image: var(--pbb-gold-metal, linear-gradient(180deg, #F7DE8E, #D9AF33 55%, #8B6914));
  color: var(--pbb-ink-dark, #12210F);
}
.pwa-btn-ghost {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.28);
  color: var(--pbb-ink-soft, #C8D8CC);
  font-weight: 600;
}
.pwa-btn:focus-visible,
.pwa-install-close:focus-visible {
  outline: 2px solid var(--pbb-gold-bright, #F7DE8E);
  outline-offset: 2px;
}

.pwa-install-close {
  position: absolute;
  top: 4px;
  inset-inline-end: 4px;
  width: 28px;
  height: 28px;
  display: grid;
  place-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--pbb-ink-soft, #C8D8CC);
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
}

/* Narrow phones: stack the actions so the two buttons stay full-width and
   the title is never squeezed to two words per line. */
@media (max-width: 519px) {
  .pwa-install-inner { flex-wrap: wrap; }
  .pwa-install-actions {
    flex: 1 0 100%;
    flex-direction: row;
  }
  .pwa-btn { flex: 1 1 0; }
}

/* From 720px the persistent bottom bar is hidden, so reclaim its offset. */
@media (min-width: 720px) {
  .pwa-install { bottom: env(safe-area-inset-bottom, 0px); }
}

/* Coexistence: while the install bar is up, lift the floating controls that
   share the bottom-right corner, same mechanism as the cookie banner. */
body.has-pwa-install .back-to-top,
body.has-pwa-install .msgr-fab { bottom: 152px; }
body.has-pwa-install .a11y-toolbar { bottom: 216px; }

/* The cookie banner always wins — pbb-pwa.js will not show the install bar
   while it is up, but if both ever render, consent stays on top. */
body.has-cookie-banner .pwa-install { display: none; }

@media (prefers-reduced-motion: reduce) {
  .pwa-install { transition: none; }
}

@media print {
  .pwa-install { display: none !important; }
}
