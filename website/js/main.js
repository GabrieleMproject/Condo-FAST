/* ============================================================
   CondoFAST — main.js
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
  const CONSENT_KEY = 'condofast-cookie-consent';

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

  /* ---------- Calcolatore ROI Interattivo ---------- */
  const roiSlider = document.getElementById('roi-condo-slider');
  const roiValDisplay = document.getElementById('roi-condo-val');
  const roiHoursDisplay = document.getElementById('roi-hours-val');
  const roiSavingsDisplay = document.getElementById('roi-savings-val');
  const roiCostPerCondoDisplay = document.getElementById('roi-cost-condo-val');
  const roiReportTimeDisplay = document.getElementById('roi-report-time-val');

  function updateRoiCalculator(condoCount) {
    if (!roiValDisplay) return;
    const count = parseInt(condoCount, 10) || 30;
    roiValDisplay.textContent = count;

    // Calcoli deterministici realistici per uno studio amministrativo
    const hoursSaved = Math.round(count * 0.8);
    const savingsYear = Math.round(count * 135);
    
    let planCost = 59;
    if (count > 100) planCost = 299;
    else if (count > 50) planCost = 169;
    const costPerCondo = (planCost / count).toFixed(2).replace('.', ',');

    const reportDays = count > 80 ? '3 Giorni' : '2 Giorni';

    if (roiHoursDisplay) roiHoursDisplay.textContent = hoursSaved + ' Ore';
    if (roiSavingsDisplay) roiSavingsDisplay.textContent = '€ ' + savingsYear.toLocaleString('it-IT');
    if (roiCostPerCondoDisplay) roiCostPerCondoDisplay.textContent = '€ ' + costPerCondo;
    if (roiReportTimeDisplay) roiReportTimeDisplay.textContent = reportDays;
  }

  if (roiSlider) {
    roiSlider.addEventListener('input', (e) => updateRoiCalculator(e.target.value));
    updateRoiCalculator(roiSlider.value);
  }

  /* ---------- Demo Interattiva AI Reader ---------- */
  const demoTabBtns = document.querySelectorAll('.demo-tab-btn');
  const demoDocContent = document.getElementById('demo-doc-content');
  const demoAiHeader = document.getElementById('demo-ai-header');
  const demoAiDetails = document.getElementById('demo-ai-details');

  const DEMO_DATA = {
    fattura: {
      doc: `<div style="color:#60a5fa;font-weight:700;margin-bottom:8px">FATTURA ELETTRONICA N. 104/2026</div>
<div>Fornitore: <strong>Rossi Ascensori S.r.l.</strong> (P.IVA: 01847590123)</div>
<div>Destinatario: Condominio Via Manzoni 14</div>
<div>Data fattura: 14/07/2026</div>
<div>Descrizione: Manutenzione ordinaria III Trimestre + Sostituzione relè di sicurezza</div>
<div style="margin-top:12px;padding-top:8px;border-top:1px dashed #334155">
  <div>Imponibile: € 1.200,00</div>
  <div>IVA (22%): € 264,00</div>
  <div style="color:#fff;font-weight:700;margin-top:4px">TOTALE FATTURA: € 1.464,00</div>
</div>`,
      header: `✦ AI Extraction: Riconosciuta Fattura Fornitore`,
      details: `<div style="display:flex;flex-direction:column;gap:10px">
  <div style="background:rgba(255,255,255,0.04);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
    <div style="color:var(--muted);font-size:0.75rem">Fornitore estratto:</div>
    <div style="color:#fff;font-weight:700">Rossi Ascensori S.r.l. (P.IVA 01847590123)</div>
  </div>
  <div style="background:rgba(255,255,255,0.04);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
    <div style="color:var(--muted);font-size:0.75rem">Riparto millesimale consigliato:</div>
    <div style="color:#34d399;font-weight:700">Tabella C — Ascensore (1.000 millesimi)</div>
  </div>
  <div style="background:rgba(239,68,68,0.1);padding:10px 14px;border-radius:8px;border:1px solid rgba(239,68,68,0.3)">
    <div style="color:#f87171;font-size:0.75rem">Ritenuta d'Acconto 4% (F24):</div>
    <div style="color:#fff;font-weight:700">€ 48,00 da versare entro il 16/08/2026</div>
  </div>
  <div style="margin-top:6px;display:flex;gap:8px">
    <button style="background:var(--accent);color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.8rem">✓ Registra Spesa</button>
    <button style="background:transparent;color:var(--muted);border:1px solid var(--border);padding:8px 14px;border-radius:6px;font-size:0.8rem;cursor:pointer">Modifica</button>
  </div>
</div>`
    },
    estratto: {
      doc: `<div style="color:#34d399;font-weight:700;margin-bottom:8px">ESTRATTO CONTO BANCARIO (CSV/PDF)</div>
<div>Data: 02/07/2026 | Tipo: Bonifico SEPA in entrata</div>
<div>Causale: <em>Quota condominiale rata 2 Sig. Mario Bianchi int 4 scale A Via Manzoni</em></div>
<div style="margin-top:8px;font-size:1.1rem;color:#34d399;font-weight:800">+ € 320,00</div>
<div style="margin-top:14px;padding-top:8px;border-top:1px dashed #334155;color:#94a3b8">
  Stato: Movimento non riconciliato nel flusso bancario
</div>`,
      header: `✦ AI Matching: Incasso Abbinato con successo (99% confidenza)`,
      details: `<div style="display:flex;flex-direction:column;gap:10px">
  <div style="background:rgba(52,211,153,0.1);padding:10px 14px;border-radius:8px;border:1px solid rgba(52,211,153,0.3)">
    <div style="color:#34d399;font-size:0.75rem">Condòmino identificato:</div>
    <div style="color:#fff;font-weight:700">Mario Bianchi (Unità A/4 — Proprietà)</div>
  </div>
  <div style="background:rgba(255,255,255,0.04);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
    <div style="color:var(--muted);font-size:0.75rem">Rata abbinata:</div>
    <div style="color:#fff;font-weight:700">Rata n. 2/2026 (Scadenza 30/06/2026 — € 320,00)</div>
  </div>
  <div style="margin-top:6px;display:flex;gap:8px">
    <button style="background:#10b981;color:#fff;border:none;padding:8px 16px;border-radius:6px;font-weight:600;cursor:pointer;font-size:0.8rem">✓ Conferma Riconciliazione</button>
  </div>
</div>`
    },
    verbale: {
      doc: `<div style="color:#c084fc;font-weight:700;margin-bottom:8px">VERBALE ASSEMBLEA ORDINARIA (PDF)</div>
<div>Data Assemblea: 15/04/2026</div>
<div>Ordine del Giorno: <em>Punto 4 — Ripartizione spese riparazione infiltrazione lastrico solare uso esclusivo int. 12</em></div>
<div style="margin-top:10px;font-size:0.8rem;line-height:1.4">
  «L'Assemblea approva all'unanimità l'applicazione dell'Art. 1126 c.c.: 1/3 a carico del proprietario dell'interno 12 e 2/3 a carico di tutti i condomini coperti dal lastrico.»
</div>`,
      header: `✦ AI Assistant: Risposta alla ricerca nel Verbale`,
      details: `<div style="display:flex;flex-direction:column;gap:10px">
  <div style="background:rgba(192,132,252,0.1);padding:10px 14px;border-radius:8px;border:1px solid rgba(192,132,252,0.3)">
    <div style="color:#c084fc;font-size:0.75rem">Domanda Amministratore:</div>
    <div style="color:#fff;font-weight:700">"Come si ripartisce la riparazione del terrazzo dell'interno 12?"</div>
  </div>
  <div style="background:rgba(255,255,255,0.04);padding:10px 14px;border-radius:8px;border:1px solid rgba(255,255,255,0.08)">
    <div style="color:var(--muted);font-size:0.75rem">Risposta estratta dal Verbale 15/04/2026 (Punto 4):</div>
    <div style="color:#fff;font-size:0.85rem;line-height:1.4;margin-top:4px">
      Applicazione <strong>Art. 1126 c.c.</strong>: 1/3 a carico dell'Int. 12 (uso esclusivo) e 2/3 ripartiti su Tabella A per le unità sottostanti.
    </div>
  </div>
</div>`
    }
  };

  demoTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      demoTabBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      const key = btn.dataset.tab;
      const data = DEMO_DATA[key];
      if (data && demoDocContent && demoAiHeader && demoAiDetails) {
        demoDocContent.innerHTML = data.doc;
        demoAiHeader.textContent = data.header;
        demoAiDetails.innerHTML = data.details;
      }
    });
  });

  /* ---------- Gestione Modali Pop-Up (Global Event Delegation) ---------- */
  function openModal(modalId) {
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-open-modal]');
    if (trigger) {
      e.preventDefault();
      const targetId = trigger.getAttribute('data-open-modal');
      openModal(targetId);
      return;
    }

    const closeBtn = e.target.closest('.modal-close, [data-close-modal]');
    if (closeBtn) {
      e.preventDefault();
      const modal = closeBtn.closest('.modal-overlay');
      closeModal(modal);
      return;
    }

    if (e.target.classList.contains('modal-overlay')) {
      closeModal(e.target);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.is-open');
      if (activeModal) {
        closeModal(activeModal);
      }
    }
  });
})();

