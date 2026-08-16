/* ==========================================================================
   PBB — "Sumali sa PBB" popup
   --------------------------------------------------------------------------
   Styles the modal built by assets/pbb-join-popup.js. EVERY CLASS NAME HERE
   IS LOAD-BEARING — the JS creates these elements by class, so renaming one
   silently unstyles the dialog rather than throwing.

   Kept in its own file rather than appended to pbb-site.css because the popup
   is optional: a deployment that turns it off (window.PBB_JOIN_POPUP.enabled
   = false) can drop this stylesheet and the script together and lose nothing
   else.

   STACKING — where this sits in the site's one z-index scale:
       50  back-to-top
       55  Messenger FAB
       60  sticky header
       70  accessibility toolbar
       90  cookie banner
       95  THIS
      100  cookie preferences modal

   Above the chrome, below the consent modal. A consent decision always
   outranks a marketing invitation, and the script additionally refuses to
   open while the cookie banner is still up.

   Depends on: pbb-tokens.css
   ========================================================================== */

.join-popup-overlay {
  position: fixed;
  inset: 0;
  z-index: 95;
  display: flex;
  /* Mobile-first: a sheet rising from the bottom edge, within thumb reach.
     Centred dialogs on a phone put the buttons where the hand is not. */
  align-items: flex-end;
  justify-content: center;
  padding: var(--pbb-space-3, 0.75rem);
  background: rgba(6, 31, 15, 0.66);
  opacity: 0;
  transition: opacity 0.22s var(--pbb-ease-out, ease);
}
.join-popup-overlay[hidden] { display: none; }
.join-popup-overlay.open { opacity: 1; }

@media (min-width: 620px) {
  .join-popup-overlay {
    align-items: center;
    padding: var(--pbb-space-5, 1.5rem);
  }
}

.join-popup {
  position: relative;
  width: min(440px, 100%);
  max-height: min(88vh, 720px);
  overflow-y: auto;
  background: var(--pbb-white, #fff);
  color: var(--pbb-ink-dark, #14261A);
  border-radius: var(--pbb-radius-lg, 20px);
  border-top: 5px solid var(--pbb-gold, #C9A227);
  box-shadow: var(--pbb-shadow-lg, 0 20px 40px -16px rgba(6, 61, 27, 0.5));
  padding: var(--pbb-space-6, 2rem) var(--pbb-space-5, 1.5rem) var(--pbb-space-5, 1.5rem);
  /* Clears the home indicator when the sheet sits on the bottom edge; every
     page sets viewport-fit=cover. */
  padding-bottom: calc(var(--pbb-space-5, 1.5rem) + env(safe-area-inset-bottom, 0px));
  text-align: center;
  transform: translateY(18px);
  transition: transform 0.28s var(--pbb-ease-out, ease);
}
.join-popup-overlay.open .join-popup { transform: none; }

@media (prefers-reduced-motion: reduce) {
  .join-popup-overlay,
  .join-popup { transition: none; }
  .join-popup { transform: none; }
}

/* ---- Dismissal ---------------------------------------------------------
   Full 48px target, real contrast, first in the tab order. A close control
   that is small, faint, or hard to reach is a dark pattern — and on an
   unrequested dialog it is the first thing a keyboard or screen-reader user
   needs. #4A5B4F on white is 7.24:1. */

.join-popup-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: var(--pbb-tap, 48px);
  height: var(--pbb-tap, 48px);
  display: grid;
  place-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--pbb-ink-dark-soft, #4A5B4F);
  cursor: pointer;
  transition: background-color 0.2s ease, color 0.2s ease;
}
.join-popup-close:hover {
  background: var(--pbb-forest-tint, #E8F3EA);
  color: var(--pbb-ink-dark, #14261A);
}
.join-popup-close:focus-visible {
  outline: 3px solid var(--pbb-gold-deep, #8B6914);
  outline-offset: 2px;
}

/* ---- Content ----------------------------------------------------------- */

.join-popup-art {
  width: 76px;
  height: 76px;
  margin: 0 auto var(--pbb-space-3, 0.75rem);
  display: grid;
  place-content: center;
  border-radius: 50%;
  background: var(--pbb-forest-tint, #E8F3EA);
  border: 2px solid var(--pbb-gold, #C9A227);
}
.join-popup-art img {
  width: 52px;
  height: 52px;
  border-radius: 50%;
}

.join-popup h2 {
  font-size: var(--pbb-text-2xl, 1.6rem);
  margin-bottom: var(--pbb-space-3, 0.75rem);
}
.join-popup p { margin-inline: auto; }

.join-popup-points {
  list-style: none;
  margin: var(--pbb-space-4, 1rem) 0;
  padding: 0;
  /* Left-aligned even though the dialog is centred: a scannable list of
     three facts reads better ragged-right than centred. */
  text-align: left;
  display: grid;
  gap: var(--pbb-space-2, 0.5rem);
}
.join-popup-points li {
  display: flex;
  align-items: flex-start;
  gap: var(--pbb-space-2, 0.5rem);
  font-size: 0.92rem;
  line-height: 1.5;
  color: var(--pbb-ink-dark, #14261A);
}
.join-popup-points li::before {
  content: "✓";
  flex: none;
  font-weight: 800;
  color: var(--pbb-forest, #0A6E2E);
}

/* ---- Actions ------------------------------------------------------------
   Stacked, both full width. The decline option is a real, equally reachable
   button rather than a faint text link — consent-style asymmetry belongs in
   neither a cookie banner nor a membership invitation. */

.join-popup-actions {
  display: grid;
  gap: var(--pbb-space-2, 0.5rem);
  margin-top: var(--pbb-space-5, 1.5rem);
}

.join-popup-note {
  margin: var(--pbb-space-4, 1rem) 0 0;
  font-size: var(--pbb-text-sm, 0.875rem);
  color: var(--pbb-ink-dark-soft, #4A5B4F);
}

/* The script refuses to open while the cookie banner is up, so these should
   never coexist. If a queued banner reappears underneath anyway, keep the
   dialog's own buttons clear of it. */
body.has-cookie-banner .join-popup-overlay { padding-bottom: 150px; }

@media print {
  .join-popup-overlay { display: none !important; }
}
