/* ==========================================================================
   PBB — shared front-end behaviour for every static page
   --------------------------------------------------------------------------
   Extracted from the old monolithic home.html so the campaign site can be
   split into a slim hub plus one page per BANGON domain without copying 400
   lines of JavaScript into each of them.

   Exposes a single global: window.PBB
     PBB.submitLead(formType, payload, token) -> Promise
     PBB.renderResult(statusEl, state, ctx)
     PBB.beginSubmit(button, statusEl) -> restore()
     PBB.tokenFor(formEl)
     PBB.fieldErrorMessage(body)
     PBB.persona.get() / .set(id) / .onChange(fn)
     PBB.lang.get()  / .set(code)
     PBB.config      (resolved runtime configuration)

   Everything is plain ES5-compatible syntax with no build step, because these
   pages are served as-is and must work on the low-end Android browsers that
   dominate BARMM.
   ========================================================================== */

(function (window, document) {
  'use strict';

  /* ======================================================================
     0. CONFIGURATION
     Set window.PBB_SUPABASE_URL / _ANON_KEY / _TURNSTILE_SITE_KEY before this
     script loads. All three are public by design; see the note in each page.
     ====================================================================== */

  var config = {
    supabaseUrl:  window.PBB_SUPABASE_URL || '',
    supabaseKey:  window.PBB_SUPABASE_ANON_KEY || '',
    turnstileKey: window.PBB_TURNSTILE_SITE_KEY || '',
    hotline:      '0966 301 8777',
    email:        'info@bangonbangsamoro.com',
    timeoutMs:    15000
  };
  config.endpoint = config.supabaseUrl
    ? config.supabaseUrl.replace(/\/+$/, '') + '/functions/v1/submit-lead'
    : '';

  var OUTBOX_KEY  = 'pbb_outbox_v2';
  var SESSION_KEY = 'pbb_session_ref';
  var PERSONA_KEY = 'pbb_persona';
  var LANG_KEY    = 'pbb-lang';

  /* Small storage helpers that never throw — Safari private mode and some
     Android WebViews reject localStorage entirely. */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  /* ======================================================================
     1. SUBMISSION TRANSPORT
     Identical contract to the version that used to live inside home.html:
     a submission is only ever reported as SENT after a confirmed 2xx. If the
     network fails the payload is queued and the user is told it is queued.
     ====================================================================== */

  function sessionRef() {
    var existing = lsGet(SESSION_KEY);
    if (existing) return existing;
    var ref = (window.crypto && window.crypto.randomUUID)
      ? window.crypto.randomUUID()
      : 'sr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
    lsSet(SESSION_KEY, ref);
    return ref;
  }

  function readOutbox() {
    var raw = lsGet(OUTBOX_KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch (e) { return []; }
  }

  /* Returns TRUE only if the write actually landed.
     This used to swallow lsSet's result, so queueForRetry always returned
     undefined and submitLead reported 'failed' for every queued submission —
     including the ones that queued perfectly. A member who filled in the
     whole form, took a photo and signed was told their details had not been
     sent, while the envelope sat safely in localStorage. */
  function writeOutbox(items) { return lsSet(OUTBOX_KEY, JSON.stringify(items)); }

  /* A membership envelope carries a photo and a signature as data URLs and
     runs to roughly 130 KB. Twenty-five of those is 3 MB, which is at or over
     the localStorage quota on the phones this has to work on — so the queue is
     bounded by BYTES as well as by count, dropping the oldest until the new
     one fits. Returns false if it still cannot be stored, and the caller says
     so rather than claiming a save that did not happen. */
  var OUTBOX_MAX_ITEMS = 25;
  var OUTBOX_MAX_BYTES = 1500000;

  function queueForRetry(envelope) {
    var all = readOutbox();
    all.push({ envelope: envelope, queuedAt: new Date().toISOString(), attempts: 0 });

    while (all.length > OUTBOX_MAX_ITEMS ||
           (all.length > 1 && JSON.stringify(all).length > OUTBOX_MAX_BYTES)) {
      all.shift();
    }
    return writeOutbox(all) === true;
  }

  function postEnvelope(envelope) {
    if (!config.endpoint || !config.supabaseKey) {
      return Promise.reject({ kind: 'unconfigured' });
    }

    var controller = ('AbortController' in window) ? new AbortController() : null;
    var timer = controller ? setTimeout(function () { controller.abort(); }, config.timeoutMs) : null;

    return fetch(config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + config.supabaseKey,
        'apikey': config.supabaseKey
      },
      body: JSON.stringify(envelope),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.ok) return body;
        throw {
          // 4xx means the submission itself is wrong — retrying cannot help.
          kind: (res.status >= 500 || res.status === 429) ? 'transient' : 'rejected',
          status: res.status,
          body: body
        };
      });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.kind) throw err;
      throw { kind: 'network', error: err };
    });
  }

  function submitLead(formType, payload, turnstileToken) {
    var envelope = {
      formType: formType,
      payload: payload,
      sessionRef: sessionRef(),
      turnstileToken: turnstileToken || '',
      submittedAt: new Date().toISOString()
    };

    return postEnvelope(envelope).then(function (body) {
      return { state: body.duplicate ? 'duplicate' : 'sent', data: body || {} };
    }).catch(function (err) {
      if (err.kind === 'rejected') {
        return Promise.reject({ state: 'rejected', body: err.body || {}, status: err.status });
      }

      /* Do NOT queue when the site has no endpoint configured.
         flushOutbox() returns early while config.endpoint is empty, so a
         queued envelope would never be sent — and telling someone it will go
         "when the signal returns" would be false, because signal is not the
         problem. It would also leave a photo and a signature in localStorage
         indefinitely, which is sensitive personal information under RA 10173
         sitting on a possibly shared phone for no purpose. */
      if (err.kind === 'unconfigured') {
        if (window.console && console.error) {
          console.error('[PBB] window.PBB_SUPABASE_URL / _ANON_KEY are empty, so ' +
                        'there is nowhere to send this submission. Set them in the ' +
                        'page config block on every form page.');
        }
        return Promise.reject({ state: 'unconfigured', reason: err.kind });
      }

      var queued = queueForRetry(envelope);
      return Promise.reject({ state: queued ? 'queued' : 'failed', reason: err.kind });
    });
  }

  function flushOutbox() {
    var items = readOutbox();
    if (!items.length || !config.endpoint) return;

    var remaining = [];
    var chain = Promise.resolve();

    items.forEach(function (item) {
      chain = chain.then(function () {
        if (item.attempts >= 5) return;   // stop retrying; do not loop forever
        return postEnvelope(item.envelope).catch(function (err) {
          if (err.kind === 'rejected') return;   // permanently invalid, drop
          item.attempts += 1;
          remaining.push(item);
        });
      });
    });

    chain.then(function () {
      writeOutbox(remaining);
      var banner = document.getElementById('outboxBanner');
      if (banner) banner.hidden = remaining.length === 0;
    });
  }

  /* ======================================================================
     2. STATUS COPY
     One place for every form's messaging so the wording stays consistent and,
     above all, honest. `queued` is the state that did not exist before the
     August audit and is the only truthful thing to say on a weak signal.
     ====================================================================== */

  function fieldErrorMessage(body) {
    switch (body && body.error) {
      case 'invalid_phone':
        return 'Mukhang mali ang cellphone number. Gamitin ang format na 0917 123 4567.';
      case 'invalid_email':
        return 'Mukhang mali ang email address. Suriin ang baybay o iwanan itong blangko.';
      case 'invalid_name':
        return 'Pakilagay ang iyong buong pangalan.';
      case 'invalid_contact':
        return 'Kailangan namin ng cellphone number o email para makontak ka.';
      case 'invalid_precinct':
        return 'Suriin ang precinct number. Nasa voter ID o sa COMELEC precinct finder ito.';
      case 'guardian_consent_required':
        return 'Wala pang 18 anyos — kailangan ng pahintulot ng magulang o guardian.';
      case 'signature_name_mismatch':
        return 'Dapat tugma ang nilagdaang pangalan sa pangalan ng contact person.';
      case 'signature_required':
        return 'Kailangan ang iyong lagda bago mag-submit.';
      case 'photo_required':
        return 'Kailangan ang iyong litrato para sa membership ID.';
      case 'captcha_failed':
        return 'Hindi na-verify na tao ka. I-refresh ang page at subukan ulit.';
      case 'rate_limited':
        return 'Masyadong maraming pagsubok mula sa koneksyon na ito. Maghintay ng 10 minuto, o tumawag sa ' + config.hotline + '.';
      case 'payload_too_large':
        return 'Masyadong malaki ang litrato. Subukan ang mas maliit na larawan.';
      default:
        return 'May problema sa pagpapadala. Subukan ulit, o tumawag sa ' + config.hotline + '.';
    }
  }

  function renderResult(statusEl, outcome, ctx) {
    if (!statusEl) return false;
    ctx = ctx || {};
    var first = (ctx.firstName || '').trim();

    switch (outcome) {
      case 'sent':
        statusEl.className = 'form-status ok';
        statusEl.textContent =
          'Salamat' + (first ? ', ' + first : '') + '! Nai-save na namin ang iyong detalye.' +
          (ctx.maskedPhone ? ' Magpapadala kami ng text sa ' + ctx.maskedPhone + ' sa loob ng ilang minuto.' : '') +
          (ctx.chapter ? ' Kokontakin ka ng coordinator ng ' + ctx.chapter + ' sa loob ng 2 araw.' : '');
        return true;

      case 'duplicate':
        statusEl.className = 'form-status ok';
        statusEl.textContent =
          'Nakarehistro ka na sa numerong ito' +
          (ctx.submittedAt ? ' noong ' + new Date(ctx.submittedAt).toLocaleDateString('fil-PH') : '') +
          '. Kung may gusto kang baguhin, i-text ang UPDATE sa ' + config.hotline + '.';
        return true;

      case 'queued':
        statusEl.className = 'form-status';
        statusEl.textContent =
          'Naka-queue ang iyong sign-up. Mahina ang koneksyon ngayon, pero hindi mawawala ang detalye mo — ' +
          'awtomatiko itong ipapadala pagbalik ng signal. Huwag isara ang browser na ito.';
        return false;

      case 'rejected':
        statusEl.className = 'form-status err';
        statusEl.textContent = fieldErrorMessage(ctx.body || {});
        return false;

      /* The site is not connected to its backend. Say that plainly and give a
         route that works today, instead of implying a retry that cannot
         happen. Nothing has been stored, and the member should not be left
         thinking they are registered. */
      case 'unconfigured':
        statusEl.className = 'form-status err';
        statusEl.textContent =
          'Hindi pa nakakonekta ang online na pagpapalista, kaya hindi naipadala ang detalye mo — ' +
          'at hindi rin ito naka-save. Pasensiya na. Mag-text ng SUMALI sa ' + config.hotline +
          ' o mag-message sa aming Facebook Page, at kami na ang magpapalista sa iyo.';
        return false;

      default:
        statusEl.className = 'form-status err';
        statusEl.textContent =
          'Hindi namin naipadala ang iyong detalye. Subukan ulit, o mag-text ng SUMALI sa ' +
          config.hotline + ' at kami na ang bahala.';
        return false;
    }
  }

  function beginSubmit(btn, statusEl) {
    var original = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
    }
    if (statusEl) {
      statusEl.className = 'form-status';
      statusEl.textContent = 'Ipinapadala…';
    }
    return function restore() {
      if (!btn) return;
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = original;
    };
  }

  /* ======================================================================
     3. TURNSTILE
     ====================================================================== */

  function mountTurnstile() {
    if (!config.turnstileKey) return;   // widget stays hidden; server warns
    var wraps = document.querySelectorAll('.pbb-captcha');
    if (!wraps.length) return;

    Array.prototype.forEach.call(wraps, function (wrap) {
      var widget = wrap.querySelector('.cf-turnstile');
      if (widget) widget.setAttribute('data-sitekey', config.turnstileKey);
      wrap.hidden = false;
    });

    var s = document.createElement('script');
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  function tokenFor(formEl) {
    if (!formEl) return '';
    var input = formEl.querySelector('input[name="cf-turnstile-response"]');
    return input ? input.value : '';
  }

  /* ======================================================================
     4. PERSONA ROUTING
     The six voter personas from docs/internal/PBB_User_Personas_2026.md.
     A visitor picks the one closest to them; the site then reorders and
     highlights content instead of asking everyone to read everything. This
     is the progressive-disclosure spine of the redesign.
     ====================================================================== */

  /* Label and destination for each pillar, so the "Para sa'yo" strip does
     not restate them per persona and drift out of step with the cards. */
  var PILLARS = {
    'basic-services':    { letter: 'B', label: 'Batayang Serbisyo',        href: 'bangon-basic-services.html' },
    'alliance':          { letter: 'A', label: 'Alyansa at Partnership',   href: 'bangon-alliance.html' },
    'natural-resources': { letter: 'N', label: 'Natural na Yaman',         href: 'bangon-natural-resources.html' },
    'green-economy':     { letter: 'G', label: 'Green Economy',            href: 'bangon-green-economy.html' },
    'open-governance':   { letter: 'O', label: 'Bukas na Pamahalaan',      href: 'bangon-open-governance.html' },
    'peace':             { letter: 'N', label: 'Kapayapaan',               href: 'bangon-peace.html' }
  };

  var PERSONAS = [
    {
      id: 'professional',
      forYou: [
        { p: 'open-governance', line: 'Meritokrasya sa pagkuha ng empleyado at bukas na badyet — trabahong nakukuha sa kakayahan, hindi sa koneksyon.' },
        { p: 'green-economy', line: 'Green skills at Halal na industriya: mga trabahong bago sa rehiyon, at sinasanay dito mismo.' }
      ],
      headline: 'Trabahong nakukuha sa kakayahan — hindi sa apelyido.',
      lede: 'Meritokrasya sa pagkuha ng empleyado, bukas na badyet, at green skills na may trabaho sa dulo. Ito ang platform para sa propesyonal at kabataan ng BARMM.',
      ctaLabel: 'Sumali bilang propesyonal',
      ctaHref: 'membership.html',
      label: 'Propesyonal / Kabataan',
      blurb: 'Trabaho batay sa kakayahan, hindi sa apelyido.',
      pillars: ['open-governance', 'basic-services', 'green-economy', 'alliance']
    },
    {
      id: 'provider',
      forYou: [
        { p: 'basic-services', line: 'Super Health Station sa munisipyo, libreng gamot at lab, at target na scholarship para sa mga anak.' },
        { p: 'alliance', line: 'Bottom-up budgeting: ang barangay ang magsasabi kung saan mapupunta ang pondo — hindi ang Cotabato lamang.' }
      ],
      headline: '₱1,790 ang kulang bawat araw. May plano kami.',
      lede: 'Bottom-up budgeting kung saan ang barangay ang nagsasabi kung saan mapupunta ang pondo, climate-smart na sakahan, at Super Health Station sa munisipyo.',
      ctaLabel: 'Tingnan ang plano sa serbisyo',
      ctaHref: 'bangon-basic-services.html',
      label: 'Magsasaka / Mangingisda',
      blurb: 'Konkretong tulong para sa pang-araw-araw na pamilya.',
      pillars: ['basic-services', 'alliance', 'natural-resources', 'green-economy']
    },
    {
      id: 'matriarch',
      forYou: [
        { p: 'basic-services', line: 'Kalusugan at eskuwela: espesyalisadong health station, libreng gamot, at scholarship na may target.' },
        { p: 'peace', line: 'Komunidad na hindi natatakot — community dialogue at restorative justice, hindi armas.' }
      ],
      headline: 'Para sa pamilya: kalusugan, eskuwela, at kaligtasan.',
      lede: 'Espesyalisadong health station na may libreng gamot, target na scholarship, at komunidad na hindi natatakot. Ito ang unang tatlong haligi para sa inyo.',
      ctaLabel: 'Alamin ang para sa pamilya',
      ctaHref: 'bangon-basic-services.html',
      label: 'Ina / Community Leader',
      blurb: 'Proteksyon, kalusugan, at scholarship para sa mga anak.',
      pillars: ['basic-services', 'peace', 'open-governance', 'alliance']
    },
    {
      id: 'peace',
      forYou: [
        { p: 'peace', line: 'Reintegrasyon ng dating kombatant at rehabilitasyon ng Marawi, na may kabuhayan sa likod ng bawat hakbang.' },
        { p: 'alliance', line: 'Kasunduang nabubuo sa barangay pataas, kaya may nagbabantay dito sa lupa at hindi lang sa papel.' }
      ],
      headline: 'Kapayapaang may kabuhayan — hindi pangako lang.',
      lede: 'Reintegrasyon ng dating kombatant, rehabilitasyon ng Marawi, at community-based na resolusyon ng alitan, na may kabuhayan sa likod ng bawat isa.',
      ctaLabel: 'Basahin ang plano sa kapayapaan',
      ctaHref: 'bangon-peace.html',
      label: 'Peace Advocate',
      blurb: 'Kapayapaan na may kabuhayan, hindi pangako lang.',
      pillars: ['peace', 'alliance', 'basic-services', 'open-governance']
    },
    {
      id: 'business',
      forYou: [
        { p: 'green-economy', line: 'Halal bilang teknikal na pamantayan: sertipikasyon, auditor, food technologist, at Shari’ah-compliant na pinansya.' },
        { p: 'alliance', line: 'Partnership sa kooperatiba at civil society, na may kasunduang napipirmahan online.' }
      ],
      headline: 'Halal na handa sa pandaigdigang merkado.',
      lede: 'Sertipikasyon, Shari’ah-compliant na pinansya, at sinanay na auditor at food technologist — para makipagkumpitensya ang produktong Bangsamoro sa labas.',
      ctaLabel: 'Makipag-partner sa PBB',
      ctaHref: 'partnership.html',
      label: 'Negosyante / Halal',
      blurb: 'Pandaigdigang merkado para sa produktong Bangsamoro.',
      pillars: ['green-economy', 'alliance', 'natural-resources', 'open-governance']
    },
    {
      id: 'elder',
      forYou: [
        { p: 'open-governance', line: 'Anti-korapsyon na may ngipin at badyet na nababasa ng kahit sino — pananagutan, hindi pangako.' },
        { p: 'peace', line: 'Pagpaplanong kasama ang mga lider ng pananampalataya at ng komunidad, hindi sa ibabaw nila.' }
      ],
      headline: 'Malinis na pamamahala, may galang sa pananampalataya.',
      lede: 'Anti-korapsyon na may ngipin, awtonomiyang iginagalang, at pagpaplanong kasama ang mga lider ng pananampalataya at ng komunidad.',
      ctaLabel: 'Alamin kung sino kami',
      ctaHref: 'about.html',
      label: 'Nakatatanda / Lider ng Pananampalataya',
      blurb: 'Malinis na pamamahala, pananampalataya, at awtonomiya.',
      pillars: ['open-governance', 'peace', 'alliance', 'natural-resources']
    }
  ];

  var personaListeners = [];

  var persona = {
    all: PERSONAS,
    find: function (id) {
      for (var i = 0; i < PERSONAS.length; i++) if (PERSONAS[i].id === id) return PERSONAS[i];
      return null;
    },
    get: function () { return lsGet(PERSONA_KEY) || ''; },
    set: function (id) {
      lsSet(PERSONA_KEY, id || '');
      applyPersona(id);
      personaListeners.forEach(function (fn) { try { fn(id); } catch (e) {} });
    },
    onChange: function (fn) { personaListeners.push(fn); }
  };

  /**
   * Reorder and annotate anything marked data-pillar according to the chosen
   * persona. Nothing is HIDDEN — hiding content from a voter because we
   * guessed their segment would be both patronising and bad for SEO. The
   * relevant items simply move to the front and get a "para sa'yo" flag.
   */
  function applyPersona(id) {
    var chosen = persona.find(id);

    Array.prototype.forEach.call(document.querySelectorAll('.persona-chip'), function (chip) {
      chip.setAttribute('aria-pressed', String(chip.dataset.persona === id));
    });

    var note = document.getElementById('personaNote');
    if (note) {
      note.textContent = chosen
        ? 'Inayos namin ang pahina para sa: ' + chosen.label + ' — ' + chosen.blurb
        : '';
      note.hidden = !chosen;
    }

    /* Rewrite the segment-aware hero. These four hooks are what turn a
       choice into a page that is actually about the reader — before this,
       picking a segment only re-sorted six cards and the headline, lede and
       button stayed generic, so the page still read as written for nobody. */
    var head = document.querySelector('[data-segment-headline]');
    var lede = document.querySelector('[data-segment-lede]');
    var cta  = document.querySelector('[data-segment-cta]');
    if (head) {
      head.textContent = chosen && chosen.headline
        ? chosen.headline
        : (head.dataset.segmentHeadlineDefault || head.textContent);
    }
    if (lede) {
      lede.textContent = chosen && chosen.lede
        ? chosen.lede
        : (lede.dataset.segmentLedeDefault || lede.textContent);
    }
    if (cta && chosen && chosen.ctaHref) {
      cta.textContent = chosen.ctaLabel;
      cta.setAttribute('href', chosen.ctaHref);
    } else if (cta && cta.dataset.segmentCtaDefault) {
      /* Restore the generic wording from the data-*-default attributes.
         Reading the element's own textContent here looked equivalent and was
         not: by the time "Ipakita lahat" is pressed, textContent IS the
         segment copy, so the page stayed stuck on the previous segment. */
      var parts = cta.dataset.segmentCtaDefault.split('|');
      cta.textContent = parts[0];
      cta.setAttribute('href', parts[1] || 'join.html');
    }

    /* Mark the picker so the chosen card reads as chosen, and expose the
       state on <html> so CSS can respond without another listener. */
    Array.prototype.forEach.call(document.querySelectorAll('[data-segment]'), function (card) {
      card.setAttribute('aria-pressed', String(card.dataset.segment === id));
    });
    document.documentElement.setAttribute('data-pbb-segment', id || '');

    var reset = document.querySelector('[data-segment-reset]');
    if (reset) reset.hidden = !chosen;

    /* "Para sa'yo": the two pillars that matter most to this reader, in
       words written for them rather than the generic card blurb.
       This block is ADDITIONAL content that only exists once a segment is
       known — it is not something removed from anyone. With no segment
       chosen, and with JavaScript off, it stays hidden and the page reads
       exactly as it did before. */
    var strip = document.querySelector('[data-for-you]');
    if (strip) {
      var list = strip.querySelector('[data-for-you-list]');
      var lead = strip.querySelector('[data-for-you-lead]');
      if (!chosen || !chosen.forYou || !list) {
        strip.hidden = true;
      } else {
        list.innerHTML = '';
        chosen.forYou.forEach(function (item) {
          var meta = PILLARS[item.p];
          if (!meta) return;
          var a = document.createElement('a');
          a.className = 'foryou-card';
          a.href = meta.href;

          var head = document.createElement('span');
          head.className = 'foryou-head';
          var letter = document.createElement('span');
          letter.className = 'foryou-letter';
          letter.setAttribute('aria-hidden', 'true');
          letter.textContent = meta.letter;
          var title = document.createElement('span');
          title.className = 'foryou-title';
          title.textContent = meta.label;
          head.appendChild(letter);
          head.appendChild(title);

          var line = document.createElement('span');
          line.className = 'foryou-line';
          line.textContent = item.line;

          var more = document.createElement('span');
          more.className = 'more';
          more.textContent = 'Basahin ang haligi →';

          a.appendChild(head);
          a.appendChild(line);
          a.appendChild(more);
          list.appendChild(a);
        });
        if (lead) lead.textContent = 'Dalawa sa anim na haligi ang pinakamalapit sa ' +
                                     chosen.label.toLowerCase() + ':';
        strip.hidden = false;
      }
    }

    var containers = document.querySelectorAll('[data-pillar-grid]');
    Array.prototype.forEach.call(containers, function (grid) {
      var cards = Array.prototype.slice.call(grid.querySelectorAll('[data-pillar]'));
      if (!cards.length) return;

      cards.forEach(function (card) {
        var flag = card.querySelector('[data-persona-flag]');
        var rank = chosen ? chosen.pillars.indexOf(card.dataset.pillar) : -1;
        card.style.order = String(rank === -1 ? 90 : rank);
        if (flag) {
          flag.hidden = rank === -1 || rank > 1;
          if (rank === 0) flag.textContent = '★ Pinakamalapit sa’yo';
          else if (rank === 1) flag.textContent = '★ Mahalaga rin sa’yo';
        }
      });
    });
  }

  /* Short, typeable aliases for the ?para= deep link. A Facebook ad already
     knows which segment it is targeting, so the click should not open with a
     question the targeting has already answered. Tagalog aliases so the URL
     is readable to the person who receives it. */
  var SEGMENT_ALIASES = {
    'propesyonal': 'professional', 'kabataan': 'professional', 'professional': 'professional',
    'magsasaka': 'provider', 'mangingisda': 'provider', 'provider': 'provider',
    'ina': 'matriarch', 'nanay': 'matriarch', 'matriarch': 'matriarch',
    'kapayapaan': 'peace', 'peace': 'peace',
    'negosyante': 'business', 'halal': 'business', 'business': 'business',
    'nakatatanda': 'elder', 'ustadz': 'elder', 'elder': 'elder'
  };

  function segmentFromUrl() {
    var raw = '';
    try {
      raw = new URLSearchParams(window.location.search).get('para') || '';
    } catch (e) { return ''; }
    return SEGMENT_ALIASES[raw.toLowerCase().trim()] || '';
  }

  function initPersona() {
    var chips = document.querySelectorAll('.persona-chip, [data-segment]');

    Array.prototype.forEach.call(chips, function (chip) {
      var id = chip.dataset.segment || chip.dataset.persona;
      chip.addEventListener('click', function (e) {
        e.preventDefault();
        persona.set(chip.dataset.segment === persona.get() || id === persona.get() ? '' : id);
      });
    });

    var reset = document.querySelector('[data-segment-reset]');
    if (reset) {
      reset.addEventListener('click', function (e) { e.preventDefault(); persona.set(''); });
    }

    /* A ?para= link wins over whatever is remembered: the person following it
       was just told this page is about them, and showing them a different
       segment because of an older visit would be worse than not personalising
       at all. The parameter is LEFT in the URL — unlike a membership number it
       is not sensitive, and stripping it would break sharing the link on. */
    var fromUrl = segmentFromUrl();
    if (fromUrl && fromUrl !== persona.get()) persona.set(fromUrl);
    else applyPersona(persona.get());
  }

  /* ======================================================================
     5. LANGUAGE
     ====================================================================== */

  var lang = {
    get: function () { return lsGet(LANG_KEY) || 'tl'; },
    set: function (code) {
      lsSet(LANG_KEY, code);
      applyLang(code);
    }
  };

  function applyLang(code) {
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      var active = b.dataset.lang === code;
      b.setAttribute('aria-pressed', String(active));
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-lang-content] > [data-lang]'), function (div) {
      div.hidden = div.dataset.lang !== code;
    });
  }

  function initLang() {
    var btns = document.querySelectorAll('.lang-btn');
    if (!btns.length) return;
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener('click', function () { lang.set(btn.dataset.lang); });
    });
    applyLang(lang.get());
  }

  /* ======================================================================
     6. CHROME — nav, reveal, back-to-top, year
     ====================================================================== */

  function initNav() {
    var toggle = document.getElementById('navToggle');
    var nav = document.getElementById('primary-nav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
      document.body.style.overflow = !open ? 'hidden' : '';
    });

    Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
      a.addEventListener('click', function () {
        if (window.innerWidth < 1080) {
          toggle.setAttribute('aria-expanded', 'false');
          nav.classList.remove('open');
          document.body.style.overflow = '';
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) {
        toggle.setAttribute('aria-expanded', 'false');
        nav.classList.remove('open');
        document.body.style.overflow = '';
        toggle.focus();
      }
    });
  }

  function initReveal() {
    var els = document.querySelectorAll('.reveal, .reveal-figure');
    if (!els.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(els, function (el) { el.classList.add('in'); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry, i) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var extra = el.classList.contains('reveal-figure') ? 60 : 0;
        el.style.transitionDelay = Math.min(i * 40 + extra, 240) + 'ms';
        el.classList.add('in');
        io.unobserve(el);
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    Array.prototype.forEach.call(els, function (el) { io.observe(el); });
  }

  function initBackToTop() {
    var btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', function () {
      btn.classList.toggle('show', window.scrollY > 600);
    }, { passive: true });
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  function initYear() {
    var el = document.getElementById('year');
    if (el) el.textContent = String(new Date().getFullYear());
  }

  /* ======================================================================
     7. BOOT
     ====================================================================== */

  function boot() {
    document.documentElement.classList.remove('no-js');
    initNav();
    initReveal();
    initBackToTop();
    initYear();
    initLang();
    initPersona();
    mountTurnstile();
    flushOutbox();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('online', flushOutbox);

  /* ======================================================================
     8. PUBLIC API
     ====================================================================== */

  window.PBB = {
    config: config,
    submitLead: submitLead,
    renderResult: renderResult,
    beginSubmit: beginSubmit,
    tokenFor: tokenFor,
    fieldErrorMessage: fieldErrorMessage,
    flushOutbox: flushOutbox,
    persona: persona,
    lang: lang,
    sessionRef: sessionRef
  };

})(window, document);
