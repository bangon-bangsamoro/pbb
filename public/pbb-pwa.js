/* ==========================================================================
   PBB — PWA INSTALL PROMPT + SERVICE WORKER REGISTRATION
   --------------------------------------------------------------------------
   Builds the install bar that docks at the bottom of every page. Styled by
   section 5 of site-widgets.css — that file is loaded by all 21 pages
   including the legal ones, which is why the CSS lives there and not in
   pbb-site.css (the legal pages never load pbb-site.css).

   BEHAVIOUR RULES, and the reasoning behind each

   1. Consent first. The bar stays hidden while the cookie banner is up.
      Two stacked bottom sheets on a 380px phone is where a first-time
      visitor bounces, and asking someone to install before they have made a
      consent choice is the wrong order of operations.

   2. Earned, not immediate. The bar waits for a real engagement signal —
      12 seconds of dwell or a scroll past a quarter of the page — before
      appearing. An install prompt served to someone who arrived 800ms ago
      from a Facebook link converts badly and reads as pushy.

   3. Dismissal is respected for 30 days, and permanently after two
      dismissals. A prompt re-shown every visit is the single most common
      way a PWA bar becomes the thing people remember about a site.

   4. iOS gets a different bar. Safari has never fired
      `beforeinstallprompt`, so on iPhone the same slot shows the Share ->
      "Add to Home Screen" instruction instead of a button that could not
      work. Shown only once, and only in Safari proper.

   STACKING — where this sits in the site's one z-index scale:
       page chrome / bottom-bar   60
       a11y toolbar               70
       install bar                80   <- here
       cookie banner              90
       cookie modal               95+

   Depends on: site-widgets.css (section 5), manifest.webmanifest, /sw.js
   ========================================================================== */

(function () {
  'use strict';

  var STORAGE_KEY = 'pbb_pwa';
  var SNOOZE_DAYS = 30;
  var MAX_DISMISSALS = 2;
  var DWELL_MS = 12000;
  var SCROLL_TRIGGER = 0.25;

  /* ---------- state ---------- */

  function readState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { dismissals: 0, snoozedUntil: 0, installed: false };
    } catch (e) {
      return { dismissals: 0, snoozedUntil: 0, installed: false };
    }
  }

  function writeState(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* Private mode or a full quota must not break the page. */
    }
  }

  /* ---------- environment ---------- */

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIOSSafari() {
    var ua = window.navigator.userAgent;
    var iOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    var safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return iOS && safari;
  }

  function eligible() {
    if (isStandalone()) return false;
    var s = readState();
    if (s.installed) return false;
    if (s.dismissals >= MAX_DISMISSALS) return false;
    if (s.snoozedUntil && Date.now() < s.snoozedUntil) return false;
    return true;
  }

  /* ---------- DOM ---------- */

  var deferredPrompt = null;
  var bar = null;

  function buildBar(mode) {
    if (bar) return bar;

    bar = document.createElement('div');
    bar.className = 'pwa-install';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'I-install ang PBB app');
    bar.hidden = true;

    var action =
      mode === 'ios'
        ? '<p class="pwa-install-ios">Pindutin ang <strong>Share</strong> sa ibaba, pagkatapos ay <strong>“Add to Home Screen.”</strong></p>' +
          '<button type="button" class="pwa-btn pwa-btn-ghost" data-pwa="dismiss">Sige, salamat</button>'
        : '<button type="button" class="pwa-btn pwa-btn-primary" data-pwa="install">I-install</button>' +
          '<button type="button" class="pwa-btn pwa-btn-ghost" data-pwa="dismiss">Hindi muna</button>';

    bar.innerHTML =
      '<div class="pwa-install-inner">' +
      '<img class="pwa-install-icon" src="/assets/pwa-icon-192.png" alt="" width="44" height="44" decoding="async">' +
      '<div class="pwa-install-copy">' +
      '<p class="pwa-install-title">Ilagay ang PBB sa inyong home screen</p>' +
      '<p class="pwa-install-sub">Mabilis buksan, gumagana kahit mahina ang signal.</p>' +
      '</div>' +
      '<div class="pwa-install-actions">' +
      action +
      '</div>' +
      '<button type="button" class="pwa-install-close" data-pwa="dismiss" aria-label="Isara ang paalala">&times;</button>' +
      '</div>';

    bar.addEventListener('click', function (e) {
      var el = e.target.closest('[data-pwa]');
      if (!el) return;
      if (el.getAttribute('data-pwa') === 'install') doInstall();
      else doDismiss();
    });

    document.body.appendChild(bar);
    return bar;
  }

  function show(mode) {
    if (!eligible()) return;
    var el = buildBar(mode);
    el.hidden = false;
    /* Next frame, so the transform transition actually runs. */
    requestAnimationFrame(function () {
      el.classList.add('is-visible');
      document.body.classList.add('has-pwa-install');
    });
  }

  function hide() {
    if (!bar) return;
    bar.classList.remove('is-visible');
    document.body.classList.remove('has-pwa-install');
    window.setTimeout(function () {
      if (bar) bar.hidden = true;
    }, 280);
  }

  function doInstall() {
    if (!deferredPrompt) {
      hide();
      return;
    }
    var prompt = deferredPrompt;
    deferredPrompt = null;
    hide();
    prompt.prompt();
    prompt.userChoice
      .then(function (choice) {
        if (choice && choice.outcome === 'dismissed') {
          var s = readState();
          s.dismissals = (s.dismissals || 0) + 1;
          s.snoozedUntil = Date.now() + SNOOZE_DAYS * 86400000;
          writeState(s);
        }
      })
      .catch(function () {});
  }

  function doDismiss() {
    var s = readState();
    s.dismissals = (s.dismissals || 0) + 1;
    s.snoozedUntil = Date.now() + SNOOZE_DAYS * 86400000;
    writeState(s);
    hide();
  }

  /* ---------- gating ---------- */

  /* The cookie banner owns the bottom of the viewport until it is answered.
     site-widgets.js flags that with body.has-cookie-banner, so watch the
     class rather than racing a timer against it. */
  function whenConsentSettled(run) {
    if (!document.body.classList.contains('has-cookie-banner')) {
      run();
      return;
    }
    var observer = new MutationObserver(function () {
      if (!document.body.classList.contains('has-cookie-banner')) {
        observer.disconnect();
        run();
      }
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  function whenEngaged(run) {
    var fired = false;
    function go() {
      if (fired) return;
      fired = true;
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
      run();
    }
    function onScroll() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      if (max > 0 && window.scrollY / max >= SCROLL_TRIGGER) go();
    }
    var timer = window.setTimeout(go, DWELL_MS);
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- events ---------- */

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (!eligible()) return;
    whenConsentSettled(function () {
      whenEngaged(function () {
        show('android');
      });
    });
  });

  window.addEventListener('appinstalled', function () {
    var s = readState();
    s.installed = true;
    writeState(s);
    deferredPrompt = null;
    hide();
  });

  /* ---------- service worker ---------- */

  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(function (reg) {
        /* Check for a new worker on every load. Assets here are not
           content-hashed, so a stale worker means a stale stylesheet. */
        reg.update().catch(function () {});
      })
      .catch(function () {
        /* Registration failure is non-fatal — the site works without it. */
      });
  }

  /* ---------- init ---------- */

  function init() {
    registerSW();

    if (isIOSSafari() && eligible()) {
      whenConsentSettled(function () {
        whenEngaged(function () {
          show('ios');
        });
      });
    }
    /* Chromium fires beforeinstallprompt on its own schedule; that listener
       is already bound above and handles the non-iOS path. */
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
