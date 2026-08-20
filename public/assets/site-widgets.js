(function() {
  'use strict';

  const STORAGE_KEY = 'pbb_site_prefs';
  const defaults = {
    fontSize: 100,
    highContrast: false,
    grayscale: false,
    dyslexiaFont: false,
    reduceMotion: false,
    cookies: { essential: true, analytics: false },
    cookiesBannerDismissed: false
  };

  function getPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...defaults, ...JSON.parse(raw) } : { ...defaults };
    } catch(e) {
      return { ...defaults };
    }
  }

  function savePrefs(prefs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }

  function applyPrefs(prefs) {
    const html = document.documentElement;
    html.style.fontSize = prefs.fontSize + '%';
    html.classList.toggle('pbb-high-contrast', prefs.highContrast);
    html.classList.toggle('pbb-grayscale', prefs.grayscale);
    html.classList.toggle('pbb-dyslexia', prefs.dyslexiaFont);
    html.classList.toggle('pbb-reduce-motion', prefs.reduceMotion);
  }

  /* Toggles body.has-cookie-banner, which site-widgets.css uses to lift the
     floating controls above the banner. Guarded because this file is also
     loaded on the legal pages, which have no floating controls. */
  function setBannerFlag(on) {
    if (document.body) document.body.classList.toggle('has-cookie-banner', !!on);
  }

  /* ---------- Accessibility Toolbar ---------- */
  function buildA11yToolbar() {
    const container = document.createElement('div');
    container.className = 'a11y-toolbar';
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Accessibility Tools');

    const toggle = document.createElement('button');
    toggle.className = 'a11y-toolbar-toggle';
    toggle.setAttribute('aria-label', 'Toggle accessibility tools');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v8m-4-4h8"/></svg>';

    const panel = document.createElement('div');
    panel.className = 'a11y-toolbar-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'Accessibility options');

    const prefs = getPrefs();
    panel.innerHTML = `
      <h3>Accessibility Tools</h3>
      <button class="a11y-btn" data-action="font-up" aria-label="Increase font size">A+ Larger Text</button>
      <button class="a11y-btn" data-action="font-down" aria-label="Decrease font size">A- Smaller Text</button>
      <button class="a11y-btn ${prefs.highContrast ? 'active' : ''}" data-action="contrast" aria-pressed="${prefs.highContrast}">High Contrast</button>
      <button class="a11y-btn ${prefs.grayscale ? 'active' : ''}" data-action="grayscale" aria-pressed="${prefs.grayscale}">Grayscale</button>
      <button class="a11y-btn ${prefs.dyslexiaFont ? 'active' : ''}" data-action="dyslexia" aria-pressed="${prefs.dyslexiaFont}">Dyslexia-Friendly</button>
      <button class="a11y-btn ${prefs.reduceMotion ? 'active' : ''}" data-action="motion" aria-pressed="${prefs.reduceMotion}">Reduce Motion</button>
      <a class="a11y-btn" href="accessibility.html" style="display:block;text-decoration:none;color:inherit;">Full Accessibility Policy →</a>
    `;

    container.appendChild(toggle);
    container.appendChild(panel);
    document.body.appendChild(container);

    toggle.addEventListener('click', () => {
      const isOpen = panel.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      if (isOpen) panel.querySelector('.a11y-btn').focus();
    });

    panel.addEventListener('click', (e) => {
      const btn = e.target.closest('.a11y-btn');
      if (!btn || btn.tagName === 'A') return;
      const action = btn.dataset.action;
      const p = getPrefs();

      if (action === 'font-up') p.fontSize = Math.min(p.fontSize + 10, 150);
      else if (action === 'font-down') p.fontSize = Math.max(p.fontSize - 10, 80);
      else if (action === 'contrast') { p.highContrast = !p.highContrast; btn.classList.toggle('active'); btn.setAttribute('aria-pressed', String(p.highContrast)); }
      else if (action === 'grayscale') { p.grayscale = !p.grayscale; btn.classList.toggle('active'); btn.setAttribute('aria-pressed', String(p.grayscale)); }
      else if (action === 'dyslexia') { p.dyslexiaFont = !p.dyslexiaFont; btn.classList.toggle('active'); btn.setAttribute('aria-pressed', String(p.dyslexiaFont)); }
      else if (action === 'motion') { p.reduceMotion = !p.reduceMotion; btn.classList.toggle('active'); btn.setAttribute('aria-pressed', String(p.reduceMotion)); }

      savePrefs(p);
      applyPrefs(p);
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target) && panel.classList.contains('open')) {
        panel.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Cookie Banner ---------- */
  function buildCookieBanner() {
    const prefs = getPrefs();
    if (prefs.cookiesBannerDismissed) return;

    const banner = document.createElement('div');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie consent');

    banner.innerHTML = `
      <div class="cookie-banner-inner">
        <p>We respect your privacy. Essential cookies keep the site working. Optional analytics help us improve. <a href="cookies.html">Cookie Policy</a> · <a href="privacy.html">Privacy Policy</a></p>
        <div class="cookie-actions">
          <button class="cookie-btn cookie-btn-secondary" data-action="customize">Customize</button>
          <button class="cookie-btn cookie-btn-primary" data-action="accept-all">Accept All</button>
          <button class="cookie-btn cookie-btn-text" data-action="essential-only">Essential Only</button>
        </div>
      </div>
    `;
    document.body.appendChild(banner);

    /* The banner is full-width and fixed to the bottom, so it draws over the
       back-to-top button, the Messenger button, and the accessibility toggle.
       site-widgets.css lifts all three clear while this class is present.
       Without it, the three controls a first-time visitor is most likely to
       reach for are unreachable exactly when the banner appears. */
    setBannerFlag(true);

    /* Modal */
    const modal = document.createElement('div');
    modal.className = 'cookie-modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Cookie Preferences');
    modal.innerHTML = `
      <div class="cookie-modal">
        <div class="cookie-modal-head">
          <h3>Cookie Preferences</h3>
        </div>
        <div class="cookie-modal-body">
          <div class="cookie-pref-row">
            <div>
              <label>Essential</label>
              <p>Required for the site to function. Cannot be disabled.</p>
            </div>
            <button class="cookie-toggle on" aria-disabled="true" role="switch" aria-checked="true" tabindex="-1"></button>
          </div>
          <div class="cookie-pref-row">
            <div>
              <label>Analytics &amp; Performance</label>
              <p>Helps us understand how visitors use our site so we can improve content.</p>
            </div>
            <button class="cookie-toggle" id="analytics-toggle" role="switch" aria-checked="false" tabindex="0"></button>
          </div>
        </div>
        <div class="cookie-modal-foot">
          <button class="cookie-btn cookie-btn-secondary" data-action="close-modal">Cancel</button>
          <button class="cookie-btn cookie-btn-primary" data-action="save-prefs">Save Preferences</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    function closeModal() {
      modal.classList.remove('open');
      banner.querySelector('button[data-action="customize"]').focus();
    }
    function openModal() {
      const p = getPrefs();
      const analyticsToggle = modal.querySelector('#analytics-toggle');
      analyticsToggle.classList.toggle('on', p.cookies.analytics);
      analyticsToggle.setAttribute('aria-checked', String(p.cookies.analytics));
      modal.classList.add('open');
      analyticsToggle.focus();
    }

    banner.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const action = btn.dataset.action;
      const p = getPrefs();

      if (action === 'accept-all') {
        p.cookies = { essential: true, analytics: true };
        p.cookiesBannerDismissed = true;
        savePrefs(p);
        banner.classList.add('hidden');
        setBannerFlag(false);
      } else if (action === 'essential-only') {
        p.cookies = { essential: true, analytics: false };
        p.cookiesBannerDismissed = true;
        savePrefs(p);
        banner.classList.add('hidden');
        setBannerFlag(false);
      } else if (action === 'customize') {
        openModal();
      }
    });

    modal.addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      const toggle = e.target.closest('.cookie-toggle');

      if (toggle && toggle.id === 'analytics-toggle') {
        const isOn = toggle.classList.toggle('on');
        toggle.setAttribute('aria-checked', String(isOn));
      }

      if (!btn) {
        if (e.target === modal) closeModal();
        return;
      }

      const action = btn.dataset.action;
      if (action === 'close-modal') {
        closeModal();
      } else if (action === 'save-prefs') {
        const analyticsOn = modal.querySelector('#analytics-toggle').classList.contains('on');
        const p = getPrefs();
        p.cookies = { essential: true, analytics: analyticsOn };
        p.cookiesBannerDismissed = true;
        savePrefs(p);
        banner.classList.add('hidden');
        setBannerFlag(false);
        closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });

    /* Wire footer "Cookie Preferences" trigger */
    document.querySelectorAll('[data-cookie-prefs]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        banner.classList.remove('hidden');
        setBannerFlag(true);
        openModal();
      });
    });
  }

  /* ---------- Init ---------- */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      buildA11yToolbar();
      buildCookieBanner();
      applyPrefs(getPrefs());
    });
  } else {
    buildA11yToolbar();
    buildCookieBanner();
    applyPrefs(getPrefs());
  }
})();
