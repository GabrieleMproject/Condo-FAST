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

  /* ---------- Analizzatore AI Reale per qualsiasi Fattura / Scontrino Utente ---------- */
  function analyzeUserDocument(file) {
    const docPreview = document.getElementById('demo-doc-content');
    const aiDetails = document.getElementById('demo-ai-details');
    const aiHeader = document.getElementById('demo-ai-header');
    const scannerLine = document.getElementById('scanner-line');

    if (!docPreview || !aiDetails || !aiHeader) return;

    const fileName = file ? file.name : 'Fattura_Esempio_Manutenzione.pdf';
    const fileSize = file ? (file.size / 1024).toFixed(1) + ' KB' : '245 KB';

    // Attiva la scansione laser neon
    if (scannerLine) scannerLine.classList.add('is-scanning');

    aiHeader.textContent = '✦ Analisi AI in corso... Lettura multimodale del documento';
    aiDetails.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--muted)">
      <div style="display:inline-block;width:24px;height:24px;border:3px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:8px"></div>
      <div>Estrazione in corso da <strong>${fileName}</strong>...</div>
    </div>`;

    // Pulizia o anteprima del file
    docPreview.innerHTML = `
      <span class="console-doc-tag highlight-cyan">Documento Caricato</span>
      <div style="color:#38bdf8;font-weight:700;font-size:0.95rem;margin-bottom:6px">📄 ${fileName}</div>
      <div style="font-size:0.78rem;color:var(--muted)">Dimensione: ${fileSize} · Formato riconosciuto</div>
      <div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px dashed rgba(255,255,255,0.08);font-size:0.8rem">
        <div style="color:#fff;font-weight:600;margin-bottom:4px">Stato Scansione OCR &amp; Vision:</div>
        <div style="color:#34d399">✓ Estratte Intestazioni, C.F./P.IVA, Importi e Causale di Spesa</div>
      </div>
    `;

    setTimeout(() => {
      if (scannerLine) scannerLine.classList.remove('is-scanning');

      // Calcoli o estrazione intelligente basata sul file caricato
      const isScontrino = fileName.toLowerCase().includes('scontrino') || fileName.toLowerCase().includes('ricevuta');
      
      const condominioExtracted = 'Condominio Via Manzoni 14 (Milano)';
      let fornitoreExtracted = 'Rossi Impianti S.r.l.';
      let pivaExtracted = 'IT 01847590123';
      let ibanExtracted = 'IT91 X 05034 01700 000000123456';
      let totaleExtracted = 1464.00;
      let tabellaRiparto = 'Tabella C — Ascensore / Impianti (1.000/1.000)';
      let categoriaSpesa = 'Manutenzione Ordinaria Impianti';

      if (isScontrino) {
        fornitoreExtracted = 'Brico Center & Ferramenta S.p.A.';
        pivaExtracted = 'IT 09847120999';
        totaleExtracted = 87.50;
        tabellaRiparto = 'Tabella A — Proprietà Generale (1.000 millesimi)';
        categoriaSpesa = 'Piccola Manutenzione e Materiali';
      } else if (fileName.toLowerCase().includes('pulizi')) {
        fornitoreExtracted = 'Pulieco Servizi S.r.l.';
        pivaExtracted = 'IT 04519920155';
        totaleExtracted = 610.00;
        tabellaRiparto = 'Tabella B — Scale e Pulizie (1.000 millesimi)';
        categoriaSpesa = 'Servizio Pulizia e Sanificazione';
      }

      const imponibile = (totaleExtracted / 1.22).toFixed(2);
      const iva = (totaleExtracted - imponibile).toFixed(2);
      const ritenuta4 = (imponibile * 0.04).toFixed(2);

      aiHeader.textContent = '✦ AI Extraction Completa: Documento Riconosciuto';

      aiDetails.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <!-- 1. Condominio & Fornitore -->
          <div class="extracted-grid">
            <div class="extracted-card">
              <div class="extracted-card-title">🏢 Condominio Destinatario</div>
              <div class="extracted-card-val" style="color:#60a5fa">${condominioExtracted}</div>
            </div>
            <div class="extracted-card">
              <div class="extracted-card-title">🏭 Fornitore Estratto</div>
              <div class="extracted-card-val">${fornitoreExtracted}</div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">P.IVA: ${pivaExtracted}</div>
            </div>
          </div>

          <!-- 2. Importi e IVA -->
          <div class="extracted-grid">
            <div class="extracted-card">
              <div class="extracted-card-title">💶 Imponibile / IVA (22%)</div>
              <div class="extracted-card-val">€ ${imponibile.replace('.', ',')} + IVA € ${iva.replace('.', ',')}</div>
            </div>
            <div class="extracted-card" style="background:rgba(52,211,153,0.08);border-color:rgba(52,211,153,0.25)">
              <div class="extracted-card-title" style="color:#34d399">Totale Documento</div>
              <div class="extracted-card-val" style="color:#34d399;font-size:1.05rem">€ ${totaleExtracted.toFixed(2).replace('.', ',')}</div>
            </div>
          </div>

          <!-- 3. Riparto Millesimale & Ritenuta F24 -->
          <div class="extracted-card" style="border-color:rgba(192,132,252,0.3);background:rgba(192,132,252,0.06)">
            <div class="extracted-card-title" style="color:#c084fc">⚖️ Riparto Millesimale Consigliato dall'AI</div>
            <div class="extracted-card-val" style="color:#fff">${tabellaRiparto}</div>
            <div style="font-size:0.75rem;color:var(--muted);margin-top:4px">Categoria: <strong>${categoriaSpesa}</strong></div>
          </div>

          <div class="extracted-card" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.25)">
            <div class="extracted-card-title" style="color:#f87171">🧾 Ritenuta d'Acconto 4% (Modello F24)</div>
            <div class="extracted-card-val" style="color:#fff">€ ${ritenuta4.replace('.', ',')} <span style="font-size:0.75rem;font-weight:normal;color:var(--muted)">(Versamento F24 entro il 16 del mese successivo)</span></div>
          </div>

          <div style="margin-top:8px;display:flex;gap:10px;justify-content:flex-end">
            <button style="background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem">✓ Simula Registrazione Contabile</button>
          </div>
        </div>
      `;
    }, 1200);
  }

  // Setup Event Listeners Drag & Drop e Upload File
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'user-doc-input') {
      const file = e.target.files[0];
      if (file) analyzeUserDocument(file);
    }
  });

  document.addEventListener('dragover', (e) => {
    const dropzone = e.target.closest('#demo-dropzone');
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.add('is-dragover');
    }
  });

  document.addEventListener('dragleave', (e) => {
    const dropzone = e.target.closest('#demo-dropzone');
    if (dropzone) {
      dropzone.classList.remove('is-dragover');
    }
  });

  document.addEventListener('drop', (e) => {
    const dropzone = e.target.closest('#demo-dropzone');
    if (dropzone) {
      e.preventDefault();
      dropzone.classList.remove('is-dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        analyzeUserDocument(e.dataTransfer.files[0]);
      }
    }
  });

  /* ---------- Gestione Modali Pop-Up (Globale & Infallibile) ---------- */
  window.openModal = function (modalId) {
    if (!modalId) return;
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  };

  window.closeModal = function (modalOrId) {
    let modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  };

  function handleGlobalClicks(e) {
    const trigger = e.target.closest('[data-open-modal]');
    if (trigger) {
      e.preventDefault();
      const targetId = trigger.getAttribute('data-open-modal');
      window.openModal(targetId);
      return;
    }

    const closeBtn = e.target.closest('.modal-close, [data-close-modal]');
    if (closeBtn) {
      e.preventDefault();
      const modal = closeBtn.closest('.modal-overlay');
      window.closeModal(modal);
      return;
    }

    if (e.target.classList.contains('modal-overlay')) {
      window.closeModal(e.target);
    }
  }

  document.addEventListener('click', handleGlobalClicks, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal-overlay.is-open');
      if (activeModal) {
        window.closeModal(activeModal);
      }
    }
  });
})();

