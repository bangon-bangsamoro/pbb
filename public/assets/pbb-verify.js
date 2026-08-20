/* ==========================================================================
   PBB — MEMBER CARD CLAIM
   --------------------------------------------------------------------------
   Attaches to verify.html. After a successful public verification, offers the
   member a way to retrieve their own ID card by proving they hold the phone
   number on their membership record.

     phone  ->  request-card-otp   (uniform response, code sent by Semaphore)
     code   ->  issue-id-card:verify  ->  single-use card token
     token  ->  issue-id-card:claim   ->  full payload
     payload -> PBB.idCard.renderFront/renderBack -> PNG + PDF

   NOTHING IS PERSISTED. The payload lives in a closure variable and is wiped
   on panel close, on tab hide, and after ten minutes. It is never written to
   localStorage, sessionStorage, IndexedDB or a cookie.

   That is a deliberate choice against a real BARMM constraint: shared and
   borrowed handsets are ordinary, not exceptional. A card cached "for
   convenience" is a card sitting on a device its owner may not control
   tomorrow. "Save" here means the member downloads the PNG or PDF and decides
   where it goes; retrieving it again costs one more SMS, which is the correct
   price for not leaving someone's photo, signature and precinct in a browser
   store.

   Depends on: pbb-app.js (PBB.config), pbb-id.js (PBB.idCard), pbb-verify.js
   Styled by:  section 12 of pbb-site.css
   ========================================================================== */

(function (window, document) {
  'use strict';

  var PBB = window.PBB;
  var host = document.getElementById('cardClaim');
  if (!host || !PBB || !PBB.config) return;

  var OTP_ENDPOINT = PBB.config.supabaseUrl
    ? PBB.config.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/request-card-otp'
    : '';
  var CARD_ENDPOINT = PBB.config.supabaseUrl
    ? PBB.config.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/issue-id-card'
    : '';

  var PAYLOAD_TTL_MS = 600000;   // matches the server's card-token ceiling
  var RESEND_LOCK_MS = 60000;

  var state = { memberNo: null, card: null, wipeTimer: null, resendAt: 0 };

  /* ------------------------------------------------------------------ utils */

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function say(msg, kind) {
    var el = document.getElementById('claimStatus');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'form-status' + (kind ? ' is-' + kind : '');
  }

  function post(url, body) {
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, PBB.config.timeoutMs || 15000);

    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: PBB.config.supabaseAnonKey || '',
        Authorization: 'Bearer ' + (PBB.config.supabaseAnonKey || ''),
      },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; })
          .then(function (b) { return { ok: res.ok, status: res.status, body: b }; });
      })
      .then(function (r) { clearTimeout(timer); return r; },
            function (e) { clearTimeout(timer); throw e; });
  }

  /* The payload is the most sensitive thing this site ever holds in a tab.
     Wipe it on every path out, not just the tidy one. */
  function wipe() {
    state.card = null;
    if (state.wipeTimer) { clearTimeout(state.wipeTimer); state.wipeTimer = null; }
    var canvases = host.querySelectorAll('canvas');
    for (var i = 0; i < canvases.length; i++) {
      var c = canvases[i];
      var ctx = c.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, c.width, c.height);
      c.width = c.width;
    }
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden' && state.card) wipe();
  });

  /* ------------------------------------------------------------------ steps */

  function showOffer(memberNo) {
    state.memberNo = memberNo;
    host.hidden = false;
    host.innerHTML =
      '<div class="claim-offer">' +
        '<p class="claim-title">Ito ba ang inyong ID?</p>' +
        '<p class="claim-sub">Kung kayo ang may-ari nito, makukuha ninyo ang inyong ' +
        'Membership ID card dito. Magpapadala kami ng code sa numerong nakatala sa inyong membership.</p>' +
        '<button type="button" class="btn btn-gold btn-block" id="claimStart">Kunin ang aking ID card</button>' +
      '</div>';
    document.getElementById('claimStart').addEventListener('click', showPhoneStep);
  }

  function showPhoneStep() {
    host.innerHTML =
      '<div class="claim-step">' +
        '<p class="claim-title">Hakbang 1 — Numero ninyo</p>' +
        '<p class="claim-sub">Ilagay ang mobile number na ginamit ninyo noong sumali kayo. ' +
        'Doon namin ipapadala ang code.</p>' +
        '<div class="field">' +
          '<label for="claimPhone">Mobile number</label>' +
          '<input id="claimPhone" type="tel" inputmode="numeric" autocomplete="tel" ' +
                 'maxlength="20" placeholder="09XX XXX XXXX">' +
        '</div>' +
        '<button type="button" class="btn btn-gold btn-block" id="claimSend">Ipadala ang code</button>' +
        '<p class="form-status" id="claimStatus" role="status" aria-live="polite"></p>' +
      '</div>';

    var btn = document.getElementById('claimSend');
    var input = document.getElementById('claimPhone');
    input.focus();

    function submit() {
      var phone = input.value.trim();
      if (phone.replace(/\D/g, '').length < 10) {
        say('Pakisuri ang numero — hindi ito mukhang kumpletong mobile number.', 'error');
        return;
      }
      btn.disabled = true;
      say('Ipinapadala…');

      post(OTP_ENDPOINT, { memberNo: state.memberNo, phone: phone })
        .then(function (r) {
          if (r.status === 429) {
            say('Masyadong maraming subok. Subukan ulit pagkalipas ng ' +
                (r.body.retryAfterMinutes || 15) + ' minuto.', 'error');
            btn.disabled = false;
            return;
          }
          if (!r.ok) {
            say('May problema sa pagpapadala. Subukan ulit mamaya.', 'error');
            btn.disabled = false;
            return;
          }
          /* The server answers the same way whether or not the number matched.
             The copy has to be honest about that: promising "code sent" to
             someone whose number does not match would leave them waiting. */
          state.resendAt = Date.now() + RESEND_LOCK_MS;
          showCodeStep(r.body.maskedPhone);
        })
        .catch(function () {
          say('Walang koneksyon. Subukan ulit kapag may signal.', 'error');
          btn.disabled = false;
        });
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function showCodeStep(masked) {
    host.innerHTML =
      '<div class="claim-step">' +
        '<p class="claim-title">Hakbang 2 — Ilagay ang code</p>' +
        '<p class="claim-sub">Kung tama ang numerong inilagay ninyo, may padalang 6-digit code sa ' +
        '<strong>' + esc(masked || 'inyong numero') + '</strong>. ' +
        'Mag-e-expire ito sa 5 minuto.</p>' +
        '<div class="field">' +
          '<label for="claimCode">6-digit code</label>' +
          '<input id="claimCode" type="text" inputmode="numeric" autocomplete="one-time-code" ' +
                 'maxlength="6" pattern="[0-9]*" placeholder="••••••" class="claim-code-input">' +
        '</div>' +
        '<button type="button" class="btn btn-gold btn-block" id="claimVerify">I-verify ang code</button>' +
        '<button type="button" class="btn btn-outline btn-block" id="claimResend">Ipadala ulit</button>' +
        '<p class="form-status" id="claimStatus" role="status" aria-live="polite"></p>' +
      '</div>';

    var btn = document.getElementById('claimVerify');
    var input = document.getElementById('claimCode');
    input.focus();

    document.getElementById('claimResend').addEventListener('click', function () {
      var wait = Math.ceil((state.resendAt - Date.now()) / 1000);
      if (wait > 0) { say('Maghintay ng ' + wait + ' segundo bago magpadala ulit.', 'error'); return; }
      showPhoneStep();
    });

    function submit() {
      var code = input.value.replace(/\D/g, '');
      if (code.length !== 6) { say('Anim na numero ang code.', 'error'); return; }

      btn.disabled = true;
      say('Sinusuri…');

      post(CARD_ENDPOINT, { action: 'verify', memberNo: state.memberNo, code: code })
        .then(function (r) {
          if (r.ok && r.body.cardToken) return claimCard(r.body.cardToken);

          btn.disabled = false;
          if (r.body.error === 'code_expired') {
            say('Expired na ang code. Pindutin ang "Ipadala ulit".', 'error');
          } else if (r.body.error === 'too_many_attempts') {
            say('Naubos na ang subok para sa code na ito. Humingi ng bago.', 'error');
          } else if (typeof r.body.attemptsLeft === 'number') {
            say('Mali ang code. ' + r.body.attemptsLeft + ' subok pa ang natitira.', 'error');
          } else {
            say('Mali ang code.', 'error');
          }
        })
        .catch(function () {
          btn.disabled = false;
          say('Walang koneksyon. Subukan ulit kapag may signal.', 'error');
        });
    }

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });
  }

  function claimCard(token) {
    say('Kinukuha ang inyong card…');
    return post(CARD_ENDPOINT, { action: 'claim', cardToken: token })
      .then(function (r) {
        if (!r.ok || !r.body.card) {
          say('Hindi makuha ang card. Simulan ulit ang proseso.', 'error');
          return;
        }
        state.card = r.body.card;
        state.wipeTimer = setTimeout(function () {
          wipe();
          showOffer(state.memberNo);
        }, PAYLOAD_TTL_MS);
        renderCard(state.card);
      });
  }

  /* ----------------------------------------------------------------- render */

  function renderCard(card) {
    host.innerHTML =
      '<div class="claim-card">' +
        '<p class="claim-title">Narito ang inyong Membership ID</p>' +
        '<p class="claim-sub">I-download ito ngayon. Sa seguridad, hindi namin ito iniimbak sa ' +
        'teleponong ito — mawawala ito kapag umalis kayo sa pahina.</p>' +
        '<div class="claim-canvases">' +
          '<canvas id="claimFront" class="claim-canvas" aria-label="Harap ng ID"></canvas>' +
          '<canvas id="claimBack" class="claim-canvas" aria-label="Likod ng ID"></canvas>' +
        '</div>' +
        '<button type="button" class="btn btn-gold btn-block" id="claimPng">I-save bilang larawan (PNG)</button>' +
        '<button type="button" class="btn btn-outline btn-block" id="claimPdf">I-download bilang PDF (para i-print)</button>' +
        '<button type="button" class="btn btn-text btn-block" id="claimDone">Tapos na — burahin sa screen</button>' +
        '<p class="form-status" id="claimStatus" role="status" aria-live="polite"></p>' +
      '</div>';

    var front = document.getElementById('claimFront');
    var back = document.getElementById('claimBack');

    if (!PBB.idCard || !PBB.idCard.renderFront) {
      say('Hindi na-load ang card renderer. I-refresh ang pahina.', 'error');
      return;
    }

    Promise.resolve()
      .then(function () { return PBB.idCard.renderFront(front, card); })
      .then(function () { return PBB.idCard.renderBack(back, card); })
      .then(function () { say(''); })
      .catch(function () { say('May problema sa pag-render ng card.', 'error'); });

    document.getElementById('claimPng').addEventListener('click', function () {
      if (!state.card) { say('Nag-expire na ang session. Simulan ulit.', 'error'); return; }
      PBB.idCard.exportPNG(front, back, state.card);
    });

    document.getElementById('claimPdf').addEventListener('click', function () {
      if (!state.card) { say('Nag-expire na ang session. Simulan ulit.', 'error'); return; }
      PBB.idCard.exportPDF(front, back, state.card);
    });

    document.getElementById('claimDone').addEventListener('click', function () {
      wipe();
      showOffer(state.memberNo);
    });
  }

  /* ------------------------------------------------------------------- wire */

  /* pbb-verify.js dispatches this once a lookup returns an active member. The
     event carries the member number only — never the verification payload. */
  document.addEventListener('pbb:verified', function (e) {
    var d = e.detail || {};
    if (d.status !== 'active' || !d.memberNo) {
      host.hidden = true;
      host.innerHTML = '';
      wipe();
      return;
    }
    showOffer(d.memberNo);
  });
})(window, document);
