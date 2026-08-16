/* ==========================================================================
   pbb-verify.js — membership ID verification controller for verify.html
   --------------------------------------------------------------------------
   WHY THIS FILE EXISTS

   verify.html shipped with a form, a submit button and a result container,
   and nothing wired to any of them. The page rendered perfectly and did
   nothing. Worse, the QR code printed on every membership ID links to

       verify.html?m=PBB-2026-MDN-004821

   and that parameter was ignored — so scanning the QR on a member's card
   opened a page that asked you to type in the number you had just scanned.

   WHAT "AUTOMATED" MEANS HERE

   1. QR / deep link. ?m= (also ?member= and ?id=) is read, filled in, and
      verified without a click. Scanning the card is the whole interaction.
   2. The number is then REMOVED from the address bar via replaceState. A
      membership number is sensitive personal information under RA 10173;
      leaving it in the URL puts it in screenshots, in shared links, in the
      browser history of a borrowed phone, and in the Referer header of any
      outbound click.
   3. Typing is normalised as you go: lower case, stray spaces, a pasted
      full URL, or the number with its hyphens missing all resolve to the
      canonical PBB-YYYY-ABC-NNNNNN form.
   4. When the shape is complete the lookup fires on its own. No button
      press is needed, on a card scan or by hand.
   5. Short serials retry once zero-padded. The generator pads to six digits
      but people read "4821" off a card and type that.
   6. Where the browser supports it (BarcodeDetector — Chrome and most
      Android WebViews), a scanner opens the camera and reads the QR
      directly. Poll watchers checking IDs at a precinct should not be
      typing twenty characters per person. Hidden entirely where it is
      unsupported rather than offered and broken.

   WHAT IT DELIBERATELY DOES NOT DO

   No number is ever written to localStorage. It would be convenient to
   remember the last one verified, and it is exactly the kind of convenience
   that leaves sensitive personal information on a shared phone. The Edge
   Function's own throttle (20 lookups per 10 minutes) is the backstop
   against enumeration; this file adds a client-side gap between automatic
   attempts so a scanner pointed at a wall does not burn the allowance.
   ========================================================================== */

(function (window, document) {
  'use strict';

  var form = document.getElementById('verifyForm');
  if (!form) return;

  var PBB = window.PBB;
  var input = document.getElementById('memberNo');
  var statusEl = document.getElementById('verifyStatus');
  var resultEl = document.getElementById('verifyResult');
  var submitBtn = document.getElementById('verifySubmit');

  if (!PBB || !PBB.config || !input || !statusEl || !resultEl) {
    if (window.console && console.error) {
      console.error('[PBB] verify.html is missing pbb-app.js or its own markup; ' +
                    'the verification form will not work.');
    }
    return;
  }

  var ENDPOINT = PBB.config.supabaseUrl
    ? PBB.config.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/verify-member'
    : '';

  /* Same shape the Edge Function enforces. Kept identical on purpose: a
     client that accepts more than the server does just produces confusing
     "not found" answers for input that was never valid. */
  var PATTERN = /^PBB-\d{4}-[A-Z]{3}-\d{4,8}$/;

  var MIN_GAP_MS = 1200;      // between automatic attempts
  var lastAttempt = 0;
  var inFlight = false;
  var lastQuery = '';

  /* ---------------------------------------------------------------- utils */

  function setStatus(cls, msg) {
    statusEl.className = 'form-status' + (cls ? ' ' + cls : '');
    statusEl.textContent = msg || '';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function phDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    if (isNaN(d)) return esc(iso);
    var BUWAN = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo',
                 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];
    return d.getDate() + ' ' + BUWAN[d.getMonth()] + ' ' + d.getFullYear();
  }

  /* --------------------------------------------------------- normalisation */

  /**
   * Accepts anything a human or a scanner might produce and returns the
   * canonical member number, or '' if it cannot be read as one.
   *
   *   "pbb 2026 mdn 004821"          -> PBB-2026-MDN-004821
   *   "PBB2026MDN004821"             -> PBB-2026-MDN-004821
   *   "https://…/verify.html?m=PBB-" -> PBB-2026-MDN-004821
   *   "  pbb-2026-mdn-4821  "        -> PBB-2026-MDN-4821  (padded on retry)
   */
  function normalise(raw) {
    var s = String(raw || '').trim();
    if (!s) return '';

    // A scanned QR is a whole URL. Pull the parameter back out of it.
    if (/^https?:\/\//i.test(s) || s.indexOf('verify.html') !== -1) {
      var m = s.match(/[?&](?:m|member|id)=([^&#\s]+)/i);
      if (m) {
        try { s = decodeURIComponent(m[1]); } catch (e) { s = m[1]; }
      }
    }

    s = s.toUpperCase().replace(/[\s_‐-―]+/g, '-');   // en/em dashes too
    s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');

    if (PATTERN.test(s)) return s;

    // Hyphens missing or in the wrong places: rebuild from the parts.
    var bare = s.replace(/[^A-Z0-9]/g, '');
    var built = bare.match(/^PBB(\d{4})([A-Z]{3})(\d{4,8})$/);
    if (built) return 'PBB-' + built[1] + '-' + built[2] + '-' + built[3];

    return PATTERN.test(s) ? s : '';
  }

  /** Zero-pad a short serial to the six digits the generator produces. */
  function padded(no) {
    var m = no.match(/^(PBB-\d{4}-[A-Z]{3})-(\d{4,8})$/);
    if (!m || m[2].length >= 6) return '';
    var p = m[1] + '-' + ('000000' + m[2]).slice(-6);
    return p === no ? '' : p;
  }

  /* -------------------------------------------------------------- rendering */

  var STATES = {
    valid: {
      cls: 'ok', icon: '✔',
      title: 'Totoong miyembro ng PBB',
      note: 'Ang ID na ito ay nakatala at aktibo.'
    },
    expired: {
      cls: 'warn', icon: '!',
      title: 'Tapos na ang bisa ng ID na ito',
      note: 'Totoo ang ID pero lampas na sa petsa ng bisa. Maaaring i-renew ang membership.'
    },
    pending: {
      cls: 'warn', icon: '…',
      title: 'Hinihintay pa ang kumpirmasyon',
      note: 'Naisumite na ang aplikasyon pero hindi pa ito naaprubahan ng chapter.'
    },
    inactive: {
      cls: 'warn', icon: '!',
      title: 'Hindi aktibo ang membership na ito',
      note: 'Makipag-ugnayan sa chapter kung sa tingin mo ay mali ito.'
    },
    not_found: {
      cls: 'err', icon: '✕',
      title: 'Walang nakitang tugmang ID',
      note: 'Pakisuri ang numero. Kung tama ito at lumalabas pa rin ang mensaheng ito, ' +
            'huwag tanggapin ang ID at tumawag sa hotline.'
    }
  };

  function render(data) {
    var s = STATES[data.status] || STATES.not_found;
    var rows = '';

    if (data.status !== 'not_found') {
      rows =
        '<dl class="verify-facts">' +
          '<div><dt>Member No.</dt><dd>' + esc(data.memberNo) + '</dd></div>' +
          '<div><dt>Pangalan</dt><dd>' + esc(data.maskedName || '—') + '</dd></div>' +
          '<div><dt>Chapter</dt><dd>' + esc(data.chapter || '—') + '</dd></div>' +
          '<div><dt>Petsa ng pagkakatala</dt><dd>' + phDate(data.issuedAt) + '</dd></div>' +
          '<div><dt>May bisa hanggang</dt><dd>' + phDate(data.validUntil) + '</dd></div>' +
        '</dl>';
    }

    resultEl.className = 'verify-result verify-' + s.cls;
    resultEl.innerHTML =
      '<p class="verify-head"><span class="verify-icon" aria-hidden="true">' + s.icon + '</span>' +
      '<strong>' + esc(s.title) + '</strong></p>' +
      rows +
      '<p class="verify-note">' + esc(s.note) + '</p>' +
      '<p class="verify-note verify-privacy">Ipinapakita lang ang mga ito. Hindi ibinibigay ' +
      'ang numero, address, o litrato ng miyembro sa nag-verify.</p>';
    resultEl.hidden = false;
    resultEl.setAttribute('tabindex', '-1');
    resultEl.focus({ preventScroll: true });
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearResult() {
    resultEl.hidden = true;
    resultEl.innerHTML = '';
  }

  /* ---------------------------------------------------------------- lookup */

  function lookup(memberNo, opts) {
    opts = opts || {};
    if (inFlight) return;
    if (!ENDPOINT) {
      setStatus('err', 'Hindi pa nakakonekta ang verification service. Tumawag sa ' +
                       PBB.config.hotline + '.');
      return;
    }
    if (!navigator.onLine) {
      setStatus('err', 'Mukhang wala kang koneksyon. Subukan ulit kapag may signal.');
      return;
    }

    inFlight = true;
    lastAttempt = Date.now();
    lastQuery = memberNo;
    if (submitBtn) submitBtn.disabled = true;
    setStatus('', 'Tinitingnan…');
    clearResult();

    var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, PBB.config.timeoutMs || 15000);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + PBB.config.supabaseKey,
        'apikey': PBB.config.supabaseKey
      },
      body: JSON.stringify({ memberNo: memberNo }),
      signal: ctrl ? ctrl.signal : undefined
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; })
          .then(function (body) { return { ok: res.ok, status: res.status, body: body }; });
      })
      .then(function (r) {
        clearTimeout(timer);

        if (r.status === 429) {
          var mins = (r.body && r.body.retryAfterMinutes) || 10;
          setStatus('err', 'Masyadong maraming beses na sinubukan. Maghintay ng ' + mins +
                           ' minuto bago ulitin.');
          return;
        }
        if (!r.ok || (r.body && r.body.error)) {
          setStatus('err', 'May problema sa serbisyo ngayon. Subukan ulit maya-maya, o ' +
                           'tumawag sa ' + PBB.config.hotline + '.');
          return;
        }

        // A short serial that found nothing gets one zero-padded retry.
        if (r.body.status === 'not_found' && !opts.isRetry) {
          var alt = padded(memberNo);
          if (alt) {
            inFlight = false;
            if (submitBtn) submitBtn.disabled = false;
            input.value = alt;
            lookup(alt, { isRetry: true, auto: opts.auto });
            return;
          }
        }

        setStatus('', '');
        render(r.body);
      })
      .catch(function (err) {
        clearTimeout(timer);
        setStatus('err', err && err.name === 'AbortError'
          ? 'Masyadong matagal ang sagot. Subukan ulit.'
          : 'Hindi ma-abot ang serbisyo. Suriin ang koneksyon at subukan ulit.');
      })
      .then(function () {
        inFlight = false;
        if (submitBtn) submitBtn.disabled = false;
      });
  }

  /** Fire only if the shape is complete, it is not a repeat, and we are not
      hammering. Used by the typing/paste/scan paths. */
  function maybeAuto(value) {
    var no = normalise(value);
    if (!no || !PATTERN.test(no)) return false;
    if (no === lastQuery) return false;
    if (Date.now() - lastAttempt < MIN_GAP_MS) return false;
    input.value = no;
    lookup(no, { auto: true });
    return true;
  }

  /* ------------------------------------------------------------- listeners */

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var no = normalise(input.value);
    if (!no) {
      setStatus('err', 'Ganito ang hugis ng member number: PBB-2026-MDN-004821.');
      input.focus();
      return;
    }
    input.value = no;
    lastQuery = '';            // an explicit press always re-queries
    lookup(no, {});
  });

  /* Typing fires on a debounce, not on every keystroke.
     The serial is 4-8 digits, so a hand-typed number passes the shape check
     the moment its fourth digit lands — firing then would spend a lookup on
     "PBB-2026-MDN-0048" while the member is still typing "21". The Edge
     Function allows 20 lookups per 10 minutes per IP; those are worth
     spending on real attempts. Paste and QR paths stay immediate, since
     both arrive complete. */
  var typeTimer = 0;
  input.addEventListener('input', function () {
    clearTimeout(typeTimer);
    if (input.value.replace(/[^A-Za-z0-9]/g, '').length < 14) return;
    typeTimer = setTimeout(function () { maybeAuto(input.value); }, 600);
  });

  input.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData);
    if (!text) return;
    var v = text.getData('text');
    if (!v) return;
    e.preventDefault();
    input.value = normalise(v) || v.trim();
    maybeAuto(input.value);
  });

  input.addEventListener('blur', function () {
    var no = normalise(input.value);
    if (no) input.value = no;
  });

  /* ------------------------------------------------- QR / deep link entry */

  (function fromUrl() {
    var params = new URLSearchParams(window.location.search);
    var raw = params.get('m') || params.get('member') || params.get('id');
    if (!raw) return;
    var no = normalise(raw);
    if (!no) return;

    input.value = no;

    /* Strip the number from the address bar before anything else can read
       it. RA 10173 treats party membership as sensitive personal
       information, and a URL is the least private place on a page. */
    try {
      var clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, clean);
    } catch (e) { /* older WebViews: not fatal, continue */ }

    lookup(no, { auto: true });
  })();

  /* ------------------------------------------------------------ QR scanner */

  (function scanner() {
    var host = document.getElementById('verifyScan');
    if (!host) return;
    if (typeof window.BarcodeDetector !== 'function' ||
        !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      host.hidden = true;         // unsupported: offer nothing rather than a dead button
      return;
    }

    var btn = document.getElementById('scanStart');
    var stopBtn = document.getElementById('scanStop');
    var video = document.getElementById('scanVideo');
    if (!btn || !video) { host.hidden = true; return; }

    var stream = null, detector = null, raf = 0;

    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (stream) { stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; }
      video.hidden = true;
      if (stopBtn) stopBtn.hidden = true;
      btn.hidden = false;
    }

    function tick() {
      if (!stream) return;
      detector.detect(video).then(function (codes) {
        for (var i = 0; i < codes.length; i++) {
          var no = normalise(codes[i].rawValue);
          if (no && PATTERN.test(no)) {
            stop();
            input.value = no;
            lastQuery = '';
            lookup(no, { auto: true });
            return;
          }
        }
        raf = requestAnimationFrame(tick);
      }).catch(function () {
        raf = requestAnimationFrame(tick);
      });
    }

    btn.addEventListener('click', function () {
      BarcodeDetector.getSupportedFormats().then(function (fmts) {
        if (fmts.indexOf('qr_code') === -1) { host.hidden = true; return; }
        detector = new BarcodeDetector({ formats: ['qr_code'] });
        return navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }, audio: false
        }).then(function (s) {
          stream = s;
          video.srcObject = s;
          video.hidden = false;
          video.play();
          btn.hidden = true;
          if (stopBtn) stopBtn.hidden = false;
          raf = requestAnimationFrame(tick);
        });
      }).catch(function () {
        setStatus('err', 'Hindi mabuksan ang camera. Pakisulat na lang ang numero.');
        stop();
      });
    });

    if (stopBtn) stopBtn.addEventListener('click', stop);
    window.addEventListener('pagehide', stop);
  })();

  window.PBB_VERIFY_READY = true;

})(window, document);
