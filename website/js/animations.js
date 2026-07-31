/* ============================================================
   CondoFAST — animations.js
   Scroll-triggered reveals (Intersection Observer) and
   3D tilt on feature cards. No libraries.
   ============================================================ */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- OS Detection: mostra i controlli finestra nativi del visitatore ---------- */
  const ua = (navigator.userAgent || '').toLowerCase();
  const isMac = /macintosh|mac os x|mac_powerpc/i.test(ua) || (/iphone|ipad/i.test(ua));
  if (isMac) {
    document.documentElement.classList.add('os-mac');
  } else {
    document.documentElement.classList.add('os-windows');
  }

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll('.reveal');

  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    }, {
      threshold: 0.12,
      rootMargin: '0px 0px -40px 0px'
    });

    revealEls.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- 3D tilt on hover (pointer devices only) ---------- */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (!reduceMotion && canHover) {
    const MAX_TILT = 6; // degrees

    document.querySelectorAll('.tilt').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;  // 0 → 1
        const py = (e.clientY - rect.top) / rect.height;  // 0 → 1
        const ry = (px - 0.5) * 2 * MAX_TILT;   // rotateY
        const rx = -(py - 0.5) * 2 * MAX_TILT;  // rotateX
        card.style.setProperty('--rx', rx.toFixed(2) + 'deg');
        card.style.setProperty('--ry', ry.toFixed(2) + 'deg');
      });

      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--rx', '0deg');
        card.style.setProperty('--ry', '0deg');
      });
    });
  }
})();
