/* ============================================================
   CondoAI — main.js
   Navbar behaviour, mobile menu, pricing toggle,
   animated counters, GDPR cookie banner.
   No external libraries. ES modules, deferred.
   ============================================================ */

(function () {
  'use strict';

  /* ---------- Navbar: opacity on scroll ---------- */
  const nav = document.getElementById('site-nav');
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle('is-scrolled', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile menu toggle ---------- */
  const navToggle = document.getElementById('nav-toggle');
  const navLinks = document.getElementById('nav-links');
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
    });
    // Close menu when a link is chosen
    navLinks.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Pricing toggle (monthly / annual, -20%) ---------- */
  const btnMonthly = document.getElementById('toggle-monthly');
  const btnAnnual = document.getElementById('toggle-annual');
  const prices = document.querySelectorAll('[data-monthly]');

  function setBilling(mode) {
    prices.forEach((el) => {
      const value = mode === 'annual' ? el.dataset.annual : el.dataset.monthly;
      if (el.textContent !== value) {
        el.textContent = value;
        el.classList.remove('price-animate');
        // Restart the pop animation
        void el.offsetWidth;
        el.classList.add('price-animate');
      }
    });
    if (btnMonthly && btnAnnual) {
      btnMonthly.classList.toggle('active', mode === 'monthly');
      btnAnnual.classList.toggle('active', mode === 'annual');
      btnMonthly.setAttribute('aria-pressed', String(mode === 'monthly'));
      btnAnnual.setAttribute('aria-pressed', String(mode === 'annual'));
    }
    document.querySelectorAll('[data-period]').forEach((el) => {
      el.textContent = mode === 'annual'
        ? el.dataset.periodAnnual
        : el.dataset.periodMonthly;
    });
  }

  if (btnMonthly && btnAnnual) {
    btnMonthly.addEventListener('click', () => setBilling('monthly'));
    btnAnnual.addEventListener('click', () => setBilling('annual'));
  }

  /* ---------- Animated number counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length && 'IntersectionObserver' in window) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const animate = (el) => {
      const target = parseFloat(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      const prefix = el.dataset.prefix || '';
      if (reduceMotion) {
        el.textContent = prefix + target.toLocaleString('it-IT') + suffix;
        return;
      }
      const duration = 1600;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
        const value = Math.round(target * eased);
        el.textContent = prefix + value.toLocaleString('it-IT') + suffix;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const counterObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });

    counters.forEach((el) => counterObserver.observe(el));
  }

  /* ---------- Cookie consent banner (GDPR) ----------
     No tracking script is loaded before explicit consent.
     Consent choice stored in localStorage (functional, exempt). */
  const banner = document.getElementById('cookie-banner');
  const CONSENT_KEY = 'condoai-cookie-consent';

  function loadAnalytics() {
    /* Placeholder: privacy-first analytics (e.g. Plausible).
       Loaded ONLY after explicit consent.
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.domain = 'condoai.it';
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
    */
  }

  if (banner) {
    let stored = null;
    try { stored = localStorage.getItem(CONSENT_KEY); } catch (e) { /* storage unavailable */ }

    if (!stored) {
      banner.classList.add('is-visible');
    } else if (stored === 'accepted') {
      loadAnalytics();
    }

    const accept = document.getElementById('cookie-accept');
    const reject = document.getElementById('cookie-reject');

    if (accept) {
      accept.addEventListener('click', () => {
        try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch (e) {}
        banner.classList.remove('is-visible');
        loadAnalytics();
      });
    }
    if (reject) {
      reject.addEventListener('click', () => {
        try { localStorage.setItem(CONSENT_KEY, 'rejected'); } catch (e) {}
        banner.classList.remove('is-visible');
      });
    }
  }

  /* ---------- Current year in footer ---------- */
  document.querySelectorAll('[data-year]').forEach((el) => {
    el.textContent = String(new Date().getFullYear());
  });
})();
