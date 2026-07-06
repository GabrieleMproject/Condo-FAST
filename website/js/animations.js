/* ============================================================
   CondoAI — animations.js
   Scroll-triggered reveals (Intersection Observer) and
   3D tilt on feature cards. No libraries.
   ============================================================ */

(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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

/* ============================================================
   V2 — progress bar, spotlight, typewriter
   ============================================================ */
(function () {
  'use strict';

  document.documentElement.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Scroll progress bar ---------- */
  const bar = document.createElement('div');
  bar.className = 'progress-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);

  let ticking = false;
  function updateBar() {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (window.scrollY / max) * 100 : 0;
    bar.style.width = pct + '%';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateBar); }
  }, { passive: true });
  updateBar();

  /* ---------- Spotlight su card e piani ---------- */
  const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (canHover) {
    document.querySelectorAll('.card, .plan, .flip__face').forEach((el) => {
      el.classList.add('spot');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width) * 100 + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height) * 100 + '%');
      });
    });
  }

  /* ---------- Typewriter nel mockup AI ---------- */
  const typeEl = document.querySelector('.type');
  if (typeEl) {
    const aiBox = typeEl.closest('.mockup__ai');
    const fullText = typeEl.dataset.text || typeEl.textContent.trim();

    if (reduceMotion) {
      typeEl.textContent = fullText;
      if (aiBox) aiBox.classList.add('done');
    } else {
      typeEl.textContent = '';
      let started = false;

      const start = () => {
        if (started) return;
        started = true;
        typeEl.classList.add('typing');
        let i = 0;
        (function tick() {
          if (i <= fullText.length) {
            typeEl.textContent = fullText.slice(0, i);
            i += 1;
            setTimeout(tick, 26);
          } else {
            typeEl.classList.remove('typing');
            if (aiBox) aiBox.classList.add('done');
          }
        })();
      };

      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries, obs) => {
          entries.forEach((en) => {
            if (en.isIntersecting) { setTimeout(start, 900); obs.disconnect(); }
          });
        }, { threshold: 0.35 });
        io.observe(typeEl);
      } else {
        setTimeout(start, 900);
      }
    }
  }
})();
