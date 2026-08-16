/* ==========================================================================
   Form controllers — membership.html, volunteer.html, partnership.html
   --------------------------------------------------------------------------
   One file, three controllers. Each is guarded by the presence of its form,
   so the same script can be loaded by all three pages (and by any future page
   that embeds one of the forms) without a per-page bundle.

   The three forms used to share a single join.html with #anchors. They were
   split into separate pages for SEO: one title and one canonical cannot rank
   for "paano maging miyembro ng PBB", "mag-volunteer BARMM 2026", and
   "partnership agreement kooperatiba" at the same time. join.html survives as
   a hub that links to all three.

   Depends on pbb-app.js (window.PBB transport) and, on membership.html,
   pbb-id.js (capture + card rendering).
   ========================================================================== */

(function (window, document) {
  'use strict';

  var PBB = window.PBB;
  if (!PBB || typeof PBB.submitLead !== 'function') {
    /* This used to be a bare `return`, and that was a mistake.
     *
     * join.js owns every button on the three form pages: the step navigation,
     * the camera, the signature pad, the submit. If pbb-app.js has not loaded
     * — wrong script order, a 404 on the asset, a CSP that blocked it, a
     * deploy that shipped the HTML without the JS — then window.PBB is
     * undefined and the old guard returned silently. The page looked
     * completely normal and every button was inert, with nothing in the
     * console to explain it. A volunteer hits "Susunod: Litrato", nothing
     * happens, and there is no way to tell whether they misclicked.
     *
     * Fail loudly instead: say so in the console, and put a visible notice on
     * the form so whoever is testing knows the page is broken rather than
     * assuming they did something wrong.
     */
    if (window.console && console.error) {
      console.error(
        '[PBB] assets/pbb-app.js did not load, so window.PBB is undefined. ' +
        'Every button on this form is inert until it does. Check that ' +
        'assets/pbb-app.js returns 200 and is listed BEFORE assets/join.js.'
      );
    }
    var forms = document.querySelectorAll('#memberForm, #joinForm, #apForm');
    for (var f = 0; f < forms.length; f++) {
      var warn = document.createElement('p');
      warn.setAttribute('role', 'alert');
      warn.style.cssText =
        'margin:0 0 1rem;padding:.85rem 1rem;border-radius:8px;' +
        'background:#fdecea;color:#8a1a14;border:1px solid #b3261e;' +
        'font:600 .95rem/1.5 system-ui,sans-serif';
      warn.textContent =
        'Hindi gumagana ang form sa ngayon dahil may bahagi ng pahina na hindi ' +
        'na-load. Pakisubukan i-refresh. Kung magpatuloy ito, mag-message sa ' +
        'aming Facebook Page at tutulungan ka naming makapagpalista.';
      forms[f].insertBefore(warn, forms[f].firstChild);
    }
    return;
  }

  var $ = function (id) { return document.getElementById(id); };

  /* Deep link from a BANGON page: volunteer.html?interest=green_economy
     The BANGON pages link here with the pillar preselected, so someone who
     arrived caring about one thing does not have to find it again in a
     ten-option list. */
  (function preselectInterest() {
    var interest = new URLSearchParams(window.location.search).get('interest');
    if (!interest) return;
    var sel = $('interest');
    if (!sel) return;
    // CSS.escape is not in every Android WebView still in use in BARMM.
    var options = sel.options;
    for (var i = 0; i < options.length; i++) {
      if (options[i].value === interest) { sel.selectedIndex = i; return; }
    }
  })();

  /* ======================================================================
     PHONE HELPERS
     Client-side shape check only — the Edge Function normalises to E.164 and
     is the authority. This exists to give instant feedback, not to be trusted.
     ====================================================================== */

  function looksLikePHMobile(raw) {
    var d = String(raw || '').replace(/\D/g, '');
    return /^09\d{9}$/.test(d) || /^9\d{9}$/.test(d) || /^639\d{9}$/.test(d) || /^00639\d{9}$/.test(d);
  }

  /* ======================================================================
     1. MEMBERSHIP + ID
     ====================================================================== */

  var memberForm = $('memberForm');
  if (memberForm) {

    var photoState = { dataUrl: '' };
    var signState  = { dataUrl: '' };
    var issued     = null;      // server response once submitted

    /* ---- Step navigation ---------------------------------------------- */

    function showStep(n) {
      Array.prototype.forEach.call(memberForm.querySelectorAll('.step-panel'), function (panel) {
        panel.hidden = panel.dataset.panel !== String(n);
      });
      Array.prototype.forEach.call(document.querySelectorAll('#memberSteps li'), function (li) {
        var step = Number(li.dataset.step);
        li.classList.toggle('done', step < n);
        if (step === n) li.setAttribute('aria-current', 'step');
        else li.removeAttribute('aria-current');
      });
      /* Scroll back to the top of the form on each step change, and move
         focus there so a screen-reader user is told the panel changed —
         otherwise focus stays on a button that no longer exists. */
      var anchor = $('form') || $('membership') || memberForm;
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (!anchor.hasAttribute('tabindex')) anchor.setAttribute('tabindex', '-1');
        anchor.focus({ preventScroll: true });
      }
    }

    /* Step 1 gate: check the fields on this panel only, so the browser does
       not complain about inputs the user has not reached yet. */
    function step1Valid() {
      var required = ['mFullName', 'mPhone', 'mBirth', 'mProvince', 'mMunicipality', 'mBarangay'];
      for (var i = 0; i < required.length; i++) {
        var el = $(required[i]);
        if (!el || !el.value.trim()) { el.focus(); el.reportValidity && el.reportValidity(); return false; }
      }
      if (!looksLikePHMobile($('mPhone').value)) {
        $('mPhone').setAttribute('aria-invalid', 'true');
        $('mPhone').focus();
        alert('Mukhang mali ang cellphone number. Gamitin ang format na 0917 123 4567.');
        return false;
      }
      $('mPhone').removeAttribute('aria-invalid');
      if (!$('mConsent').checked) {
        $('mConsent').focus();
        alert('Kailangan ang pahintulot mo bago magpatuloy.');
        return false;
      }
      return true;
    }

    memberForm.addEventListener('click', function (e) {
      var next = e.target.closest('[data-next]');
      var prev = e.target.closest('[data-prev]');
      if (next) {
        var target = Number(next.dataset.next);
        if (target === 2 && !step1Valid()) return;
        if (target === 3 && !photoState.dataUrl) {
          $('photoStatus').className = 'form-status err';
          $('photoStatus').textContent = 'Kailangan ang litrato para sa iyong ID.';
          return;
        }
        showStep(target);
      }
      if (prev) showStep(Number(prev.dataset.prev));
    });

    /* ---- Photo --------------------------------------------------------- */

    var photo = new PBB.PhotoCapture({
      video: $('photoVideo'),
      canvas: $('photoCanvas'),
      preview: $('photoPreview'),
      fileInput: $('photoFile'),
      onChange: function (url) {
        photoState.dataUrl = url;
        $('photoClear').hidden = !url;
        $('photoStart').hidden = !!url;
        $('photoUploadBtn').hidden = !!url;
      }
    });

    $('photoStart').addEventListener('click', function () {
      var status = $('photoStatus');
      status.className = 'form-status';
      status.textContent = 'Binubuksan ang camera…';
      photo.start().then(function () {
        status.textContent = 'Nakahanda. Pindutin ang "Kunan ng litrato".';
        $('photoShoot').hidden = false;
        $('photoStart').hidden = true;
      }).catch(function (err) {
        status.className = 'form-status err';
        status.textContent = err.message + ' Gamitin na lang ang "Mag-upload ng litrato".';
      });
    });

    $('photoShoot').addEventListener('click', function () {
      try {
        photo.capture();
        $('photoShoot').hidden = true;
        $('photoStatus').className = 'form-status ok';
        $('photoStatus').textContent = 'Nakuha ang litrato.';
      } catch (err) {
        $('photoStatus').className = 'form-status err';
        $('photoStatus').textContent = err.message;
      }
    });

    $('photoUploadBtn').addEventListener('click', function () { $('photoFile').click(); });

    $('photoFile').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      photo.fromFile(file).then(function () {
        $('photoStatus').className = 'form-status ok';
        $('photoStatus').textContent = 'Nakuha ang litrato.';
      }).catch(function (err) {
        $('photoStatus').className = 'form-status err';
        $('photoStatus').textContent = err.message;
      });
    });

    $('photoClear').addEventListener('click', function () {
      photo.clear();
      $('photoFile').value = '';
      $('photoShoot').hidden = true;
      $('photoStatus').textContent = '';
    });

    /* ---- Signature ------------------------------------------------------ */

    var pad = new PBB.SignaturePad($('signaturePad'), {
      onChange: function (url) {
        signState.dataUrl = url;
        var s = $('signStatus');
        if (url) { s.className = 'form-status ok'; s.textContent = 'Nakuha ang lagda.'; }
        else { s.className = 'form-status'; s.textContent = ''; }
      }
    });
    $('signClear').addEventListener('click', function () { pad.clear(); });

    /* ---- Submit --------------------------------------------------------- */

    memberForm.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!signState.dataUrl) {
        $('signStatus').className = 'form-status err';
        $('signStatus').textContent = 'Kailangan ang iyong lagda bago mag-submit.';
        return;
      }

      var btn = $('memberSubmit');
      var status = $('memberStatus');
      var restore = PBB.beginSubmit(btn, status);

      var payload = {
        fullName:     $('mFullName').value.trim(),
        phone:        $('mPhone').value.trim(),
        email:        $('mEmail').value.trim(),
        dateOfBirth:  $('mBirth').value,
        provinceCode: $('mProvince').value,
        municipality: $('mMunicipality').value.trim(),
        barangay:     $('mBarangay').value.trim(),
        precinct:     $('mPrecinct').value.trim(),
        preferredLang: $('mLang').value,
        preferredChannel: 'sms',
        photo:        photoState.dataUrl,
        signature:    signState.dataUrl
      };

      PBB.submitLead('membership', payload, PBB.tokenFor(memberForm))
        .then(function (result) {
          restore();
          issued = result.data || {};

          /* Mark this browser as belonging to a member. assets/pbb-join-popup.js
             reads this flag and will never again ask them to join — being
             invited to become a member after you already are reads as a party
             that does not know who its members are. */
          try { localStorage.setItem('pbb_joined', '1'); } catch (e) {}

          PBB.renderResult(status, result.state, issued);
          buildCard(payload, issued, false);
          showStep(4);
        })
        .catch(function (err) {
          restore();
          PBB.renderResult(status, err.state, err);
          if (err.state === 'queued') {
            /* Still show the card, clearly marked PENDING with no QR — the
               submission has not reached PBB, so it is not verifiable and
               must not look as though it is. */
            issued = { pending: true };
            buildCard(payload, issued, true);
            showStep(4);
          }
        });
    });

    /* ---- Card ----------------------------------------------------------- */

    function provinceLabel() {
      var sel = $('mProvince');
      return sel.options[sel.selectedIndex] ? sel.options[sel.selectedIndex].text : '';
    }

    function buildCard(payload, server, pending) {
      var now = new Date();
      var data = {
        memberNo:     server.memberNo || 'PENDING',
        fullName:     payload.fullName,
        province:     provinceLabel(),
        municipality: payload.municipality,
        barangay:     payload.barangay,
        precinct:     payload.precinct || '—',
        chapter:      server.chapter || 'PBB National',
        photo:        payload.photo,
        signature:    payload.signature,
        issuedAt:     now.toLocaleDateString('fil-PH'),
        validUntil:   server.validUntil || (now.getFullYear() + 3) + '-12-31',
        verifyUrl:    server.verifyUrl || '',
        pending:      !!pending
      };

      var summary = $('idSummary');
      summary.textContent = pending
        ? 'Naka-queue pa ang iyong sign-up, kaya PENDING muna ang ID at wala pang QR code. ' +
          'Pagbalik ng signal at pagkatanggap namin, puwede kang bumalik dito para sa pinal na ID.'
        : 'Member No. ' + data.memberNo + ' · ' + data.chapter + ' · Valid hanggang ' + data.validUntil;

      PBB.idCard.renderFront($('idFront'), data);
      PBB.idCard.renderBack($('idBack'), data);

      if (data.verifyUrl) $('idVerifyLink').href = data.verifyUrl;

      $('idDownloadPng').onclick = function () {
        PBB.idCard.exportPNG($('idFront'), $('idBack'), data);
      };
      $('idDownloadPdf').onclick = function () {
        var b = $('idDownloadPdf');
        var original = b.textContent;
        b.disabled = true;
        b.textContent = 'Ginagawa ang PDF…';
        PBB.idCard.exportPDF($('idFront'), $('idBack'), data)
          .catch(function (err) {
            alert('Hindi magawa ang PDF: ' + err.message + ' Subukan ang larawan sa halip.');
          })
          .then(function () { b.disabled = false; b.textContent = original; });
      };
    }
  }

  /* ======================================================================
     2. VOLUNTEER
     ====================================================================== */

  var joinForm = $('joinForm');
  if (joinForm) {
    joinForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var name = $('fullName').value.trim();
      var phone = $('phone').value.trim();
      var statusEl = $('formStatus');

      if (!name || !phone || !$('province').value || !$('joinConsent').checked) {
        joinForm.reportValidity();
        return;
      }
      if (!looksLikePHMobile(phone)) {
        statusEl.className = 'form-status err';
        statusEl.textContent = 'Mukhang mali ang cellphone number. Gamitin ang format na 0917 123 4567.';
        $('phone').focus();
        return;
      }

      var restore = PBB.beginSubmit($('joinSubmit'), statusEl);

      PBB.submitLead('volunteer', {
        fullName: name,
        phone: phone,
        email: $('email').value.trim(),
        provinceCode: $('province').value,
        interestCode: $('interest').value,
        affiliation: 'volunteer',
        preferredLang: PBB.lang.get(),
        preferredChannel: 'sms'
      }, PBB.tokenFor(joinForm)).then(function (result) {
        restore();
        PBB.renderResult(statusEl, result.state, {
          firstName: result.data.firstName || name.split(' ')[0],
          chapter: result.data.chapter,
          maskedPhone: result.data.maskedPhone,
          submittedAt: result.data.submittedAt
        });
        if (result.state === 'sent') joinForm.reset();
      }).catch(function (err) {
        restore();
        PBB.renderResult(statusEl, err.state, err);
      });
    });
  }

  /* ======================================================================
     3. PARTNERSHIP
     ====================================================================== */

  var apForm = $('allianceForm');
  if (apForm) {
    var AGREEMENT_TEXT =
      'PARTIDO BANGON BANGSAMORO - ALLIANCE & PARTNERSHIP AGREEMENT\n' +
      'Version: v1, Ago. 2026\n\n' +
      '1. Sumasang-ayon ang Partner na suportahan ang mga inisyatiba ng PBB sa ilalim ng\n' +
      '   Alliance Building & Partnerships pillar ng BANGON platform - Bottom-Up Budgeting,\n' +
      '   sectoral organizing, at grassroots network building.\n' +
      '2. Ang kasunduang ito ay HINDI nangangahulugan ng financial contribution, campaign\n' +
      '   donation, o obligasyon sa pag-endorso. Maaaring umatras anumang oras.\n' +
      '3. Gagamitin lang ng PBB ang detalye ng Partner para i-coordinate ang partnership\n' +
      '   activities, alinsunod sa Privacy Policy at COMELEC disclosure rules.\n' +
      '4. Ang pag-type ng buong legal na pangalan at pag-submit ng form na ito ay bumubuo\n' +
      '   ng electronic signature sa ilalim ng Republic Act 8792 (Electronic Commerce Act).';

    function buildSignedAgreementText(lead) {
      return AGREEMENT_TEXT + '\n\n---\n' +
        'Organisasyon/Grupo: ' + lead.orgName + '\n' +
        'Uri ng organisasyon: ' + lead.orgType + '\n' +
        'Contact person: ' + lead.contactName + ' <' + lead.email + '>\n' +
        'Lokasyon: ' + lead.province + '\n' +
        'Iaambag sa partnership: ' + lead.proposal + '\n\n' +
        'Nilagdaan (e-signature): ' + lead.signature + '\n' +
        'Petsa ng paglagda: ' + lead.submittedAt + '\n';
    }

    apForm.addEventListener('submit', function (e) {
      e.preventDefault();

      var lead = {
        orgName:     $('apOrgName').value.trim(),
        contactName: $('apContactName').value.trim(),
        email:       $('apContactEmail').value.trim(),
        phone:       $('apContactPhone').value.trim(),
        orgType:     $('apOrgType').value,
        province:    $('apProvince').value,
        proposal:    $('apProposal').value.trim(),
        signature:   $('apSignature').value.trim(),
        agreementVersion: 'v1-2026-08',
        submittedAt: new Date().toISOString()
      };

      if (!lead.orgName || !lead.contactName || !lead.email || !lead.orgType ||
          !lead.province || !lead.proposal || !lead.signature ||
          !$('apAgreementConsent').checked || !$('apConsent').checked) {
        apForm.reportValidity();
        return;
      }

      var statusEl = $('apStatus');
      var restore = PBB.beginSubmit($('apSubmit'), statusEl);
      var signedText = buildSignedAgreementText(lead);

      function showConfirmation(referenceLine) {
        apForm.hidden = true;
        $('apConfirm').hidden = false;
        $('apReference').textContent = referenceLine;

        $('apDownload').onclick = function () {
          var blob = new Blob([signedText], { type: 'text/plain;charset=utf-8' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'PBB-Partnership-Agreement-' + lead.orgName.replace(/[^a-z0-9]+/gi, '-') + '.txt';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        };

        $('apEmailCopy').onclick = function () {
          window.open('mailto:info@bangonbangsamoro.com' +
            '?subject=' + encodeURIComponent('Signed Partnership Agreement - ' + lead.orgName) +
            '&body=' + encodeURIComponent(signedText), '_blank');
        };
      }

      PBB.submitLead('partnership', {
        orgName: lead.orgName,
        contactName: lead.contactName,
        email: lead.email,
        phone: lead.phone,
        orgType: lead.orgType,
        provinceCode: lead.province,
        proposal: lead.proposal,
        signature: lead.signature,
        agreementVersion: lead.agreementVersion,
        agreementText: signedText
      }, PBB.tokenFor(apForm)).then(function (result) {
        restore();
        statusEl.className = 'form-status ok';
        statusEl.textContent = 'Salamat! Naitala na namin ang inyong nilagdaang kasunduan.';
        showConfirmation('Reference: ' + (result.data.reference || '—'));
      }).catch(function (err) {
        restore();
        if (err.state === 'queued') {
          statusEl.className = 'form-status';
          statusEl.textContent = 'Naka-queue ang inyong kasunduan — ipapadala pagbalik ng signal. ' +
            'I-download muna ang kopya bilang patunay ng paglagda.';
          showConfirmation('Naka-queue — wala pang reference number.');
        } else if (err.state === 'rejected') {
          statusEl.className = 'form-status err';
          statusEl.textContent = PBB.fieldErrorMessage(err.body || {});
        } else {
          statusEl.className = 'form-status err';
          statusEl.textContent = 'Hindi namin naipadala ang kasunduan. I-download ang kopya at i-email ito sa ' +
            'info@bangonbangsamoro.com, o tumawag sa ' + PBB.config.hotline + '.';
          showConfirmation('Hindi pa naitatala sa PBB — i-email ang kopya.');
        }
      });
    });
  }

  /* Readiness beacon.
     The inline guard on the form pages checks this. It has to be set here,
     at the end of the controllers, rather than inferred from anything inside
     this file — if join.js is missing or blocked entirely, nothing in this
     file runs, and only an outside observer can notice. */
  window.PBB_FORMS_READY = true;

})(window, document);
