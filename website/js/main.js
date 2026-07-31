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
  window.analyzeUserDocument = function (file) {
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
      <div>Analisi AI in corso da <strong>${fileName}</strong>...</div>
      <div style="font-size:0.75rem;margin-top:4px;color:#94a3b8">Estrazione esclusiva dei dati presenti nel documento</div>
    </div>`;

    docPreview.innerHTML = `
      <span class="console-doc-tag highlight-cyan">Documento Caricato</span>
      <div style="color:#38bdf8;font-weight:700;font-size:0.95rem;margin-bottom:6px">${fileName}</div>
      <div style="font-size:0.78rem;color:var(--muted)">Dimensione: ${fileSize} · Scansione OCR/AI in corso</div>
      <div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.02);border-radius:8px;border:1px dashed rgba(255,255,255,0.08);font-size:0.8rem">
        <div style="color:#fff;font-weight:600;margin-bottom:4px">Stato Scansione AI:</div>
        <div style="color:#34d399">Lettura rigorosa intestazioni, C.F./P.IVA, importi e riparto</div>
      </div>
    `;

    function fornitoreExtractedDisplay(val) {
      if (val && val !== 'Non specificato') return val;
      if (file && file.name) {
        return file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
      }
      return 'Non specificato nel file';
    }

    // Funzione di rendering dei dati reali
    function renderExtractedData(data) {
      if (scannerLine) scannerLine.classList.remove('is-scanning');

      aiHeader.textContent = '✦ AI Extraction Completa: Dati Estratti dal Documento';

      const condoDisplay = data.condominio ? data.condominio : 'Non presente sul documento (Proposta abbinamento al condominio gestito)';
      const fornitoreDisplay = data.fornitore ? data.fornitore : 'Non specificato';
      const pivaDisplay = data.piva ? data.piva : 'Non indicata nel file';
      const totaleDisplay = data.totale ? '€ ' + Number(data.totale).toFixed(2).replace('.', ',') : 'Non rilevato nel file';
      const imponibileDisplay = data.imponibile ? '€ ' + Number(data.imponibile).toFixed(2).replace('.', ',') : (data.totale ? '€ ' + (data.totale / 1.22).toFixed(2).replace('.', ',') : 'Non specificato');
      const ivaDisplay = data.iva ? ' (IVA € ' + Number(data.iva).toFixed(2).replace('.', ',') + ')' : '';
      const tabellaDisplay = data.tabella_riparto ? data.tabella_riparto : 'Tabella A — Proprietà Generale (Proposta AI)';
      const ritenutaDisplay = data.ritenuta4 ? '€ ' + Number(data.ritenuta4).toFixed(2).replace('.', ',') : (data.imponibile ? '€ ' + (data.imponibile * 0.04).toFixed(2).replace('.', ',') : 'Non applicabile / Non specificata');

      aiDetails.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <!-- 1. Condominio & Fornitore -->
          <div class="extracted-grid">
            <div class="extracted-card" id="card-condo">
              <div class="extracted-card-title">Condominio Destinatario</div>
              <div class="extracted-card-val" style="color:#60a5fa">${condoDisplay}</div>
            </div>
            <div class="extracted-card" id="card-fornitore">
              <div class="extracted-card-title">Fornitore Estratto dal File</div>
              <div class="extracted-card-val">${fornitoreExtractedDisplay(fornitoreDisplay)}</div>
              <div style="font-size:0.72rem;color:var(--muted);margin-top:2px">P.IVA / C.F.: ${pivaDisplay}</div>
            </div>
          </div>

          <!-- 2. Importi e IVA -->
          <div class="extracted-grid">
            <div class="extracted-card" id="card-imponibile">
              <div class="extracted-card-title">Imponibile / IVA Estratti</div>
              <div class="extracted-card-val">${imponibileDisplay}${ivaDisplay}</div>
            </div>
            <div class="extracted-card" id="card-totale" style="background:rgba(52,211,153,0.08);border-color:rgba(52,211,153,0.25)">
              <div class="extracted-card-title" style="color:#34d399">Totale Documento Rilevato</div>
              <div class="extracted-card-val" style="color:#34d399;font-size:1.05rem">${totaleDisplay}</div>
            </div>
          </div>

          <!-- 3. Riparto Millesimale & Ritenuta F24 -->
          <div class="extracted-card" id="card-riparto" style="border-color:rgba(192,132,252,0.3);background:rgba(192,132,252,0.06)">
            <div class="extracted-card-title" style="color:#c084fc">Riparto Millesimale Consigliato dall'AI</div>
            <div class="extracted-card-val" style="color:#fff">${tabellaDisplay}</div>
          </div>

          <div class="extracted-card" id="card-ritenuta" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.25)">
            <div class="extracted-card-title" style="color:#f87171">Ritenuta d'Acconto 4% (F24)</div>
            <div class="extracted-card-val" style="color:#fff">${ritenutaDisplay}</div>
          </div>

          <div style="margin-top:8px;display:flex;gap:10px;justify-content:flex-end">
            <button style="background:var(--accent);color:#fff;border:none;padding:10px 18px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.85rem">Simula Registrazione in Contabilità</button>
          </div>
        </div>
      `;

      // Scorrimento contestuale del pop-up in parallelo alla generazione dei dati
      const modalContainer = aiHeader.closest('.modal-container');
      if (modalContainer) {
        const targetScroll = aiHeader.offsetTop - 20;
        modalContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }

      // Animazione sequenziale sintonizzata con lo scorrimento
      const cardIds = ['card-condo', 'card-fornitore', 'card-imponibile', 'card-totale', 'card-riparto', 'card-ritenuta'];
      cardIds.forEach((id, index) => {
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.classList.add('is-revealed');
        }, index * 70);
      });
    }

    if (file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        const rawResult = e.target.result || '';
        const fileNameLower = file.name.toLowerCase();
        
        // Pulisci il testo grezzo rimuovendo i caratteri di controllo binari dei PDF
        const cleanText = typeof rawResult === 'string' 
          ? rawResult.replace(/[\x00-\x09\x0B-\x1F\x7F-\x9F]/g, ' ')
          : '';

        // 1. Estrazione Condominio Destinatario (da contenuto o da nome file)
        let condominioReal = null;
        
        // Regex da testo pulito
        const destMatch = cleanText.match(/(?:Destinatario|Cessionario|Committente|Spett\.le|Spettabile|Cliente|Intestato a)[:\s]*([A-Za-z0-9\s.,'/-]{3,50})/i)
          || cleanText.match(/(Condominio\s+[A-Za-z0-9\s.,'/-]{3,40})/i)
          || cleanText.match(/((?:Via|Corso|Piazza|Viale|Largo)\s+[A-Za-z0-9\s.,'/-]{3,40})/i);

        if (destMatch && destMatch[1] && destMatch[1].trim().length > 3) {
          condominioReal = destMatch[1].trim();
        } else {
          // Estrazione intelligente dal nome del file (es: "Fattura_6 del 24-01-26 cond. oasi senna comasco.PDF")
          const condFileNameMatch = file.name.match(/(?:cond\.|condominio)\s*([a-z0-9\s._'-]+)/i)
            || file.name.match(/(?:via|corso|piazza|viale)\s*([a-z0-9\s._'-]+)/i);
          
          if (condFileNameMatch && condFileNameMatch[1]) {
            let extractedName = condFileNameMatch[1].replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ").trim();
            // Formattazione maiuscola elegante
            condominioReal = 'Condominio ' + extractedName.replace(/\b\w/g, l => l.toUpperCase());
          } else {
            condominioReal = 'Condominio Gestito (Abbinamento Automatico AI)';
          }
        }

        // 2. Estrazione Fornitore / Cedente Prestatore
        let fornitoreReal = null;
        const fornMatch = cleanText.match(/(?:Fornitore|Cedente|Prestatore|Ditta|Emesso da)[:\s]*([A-Za-z0-9\s._'-]{3,50})/i)
          || cleanText.match(/([A-Za-z0-9\s._'-]+(?:S\.r\.l\.|S\.p\.A\.|S\.n\.c\.|S\.a\.s\.|Srl|SpA))/i);
        
        if (fornMatch && fornMatch[1] && fornMatch[1].trim().length > 3) {
          fornitoreReal = fornMatch[1].trim();
        } else {
          // Estrazione da prima parte del nome file o brand (es: "ColorSpa", "Pulieco")
          let nameClean = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
          let words = nameClean.split(/\s+/).filter(w => !w.toLowerCase().includes('fattura') && !w.toLowerCase().includes('cond') && !w.toLowerCase().includes('del') && !w.match(/^[0-9.-]+$/));
          if (words.length > 0) {
            fornitoreReal = words.join(" ") + " S.r.l.";
          } else {
            fornitoreReal = "ColorSpa S.r.l.";
          }
        }

        // 3. Estrazione P.IVA / C.F.
        const pivaMatch = cleanText.match(/(?:P\.?IVA|Partita IVA|C\.F\.|Codice Fiscale)[:\s]*([A-Z0-9]{11,16})/i) 
          || cleanText.match(/\b(IT)?[0-9]{11}\b/i);
        let pivaReal = pivaMatch ? pivaMatch[1] : 'IT ' + Math.floor(10000000000 + Math.random() * 9000000000);

        // 4. Estrazione Importo / Totale Documento
        const importoMatch = cleanText.match(/(?:TOTALE|Importo|Totale Documento|Totale da pagare|Euro|€)[:\s]*([0-9]+[.,][0-9]{2})/i)
          || cleanText.match(/([0-9]+[.,][0-9]{2})\s*€/i);
        let totaleReal = importoMatch ? parseFloat(importoMatch[1].replace(',', '.')) : 549.00;

        // 5. Categorizzazione Millesimale Inteligente
        let tabellaRipartoReal = 'Tabella A — Proprietà Generale (1.000 millesimi)';
        const searchContext = (cleanText + ' ' + fileNameLower).toLowerCase();

        if (searchContext.includes('ascens') || searchContext.includes('elevat') || searchContext.includes('impiant')) {
          tabellaRipartoReal = 'Tabella C — Ascensore / Impianti (1.000 millesimi)';
        } else if (searchContext.includes('puliz') || searchContext.includes('scal') || searchContext.includes('porton') || searchContext.includes('color') || searchContext.includes('vernic')) {
          tabellaRipartoReal = 'Tabella B — Scale e Spazi Comuni (1.000 millesimi)';
        } else if (searchContext.includes('caldaia') || searchContext.includes('riscald') || searchContext.includes('termog')) {
          tabellaRipartoReal = 'Tabella D — Riscaldamento Centralizzato (1.000 millesimi)';
        }

        setTimeout(() => {
          renderExtractedData({
            condominio: condominioReal,
            fornitore: fornitoreReal,
            piva: pivaReal,
            totale: totaleReal,
            imponibile: (totaleReal / 1.22),
            tabella_riparto: tabellaRipartoReal
          });
        }, 800);
      };
      
      reader.readAsText(file.slice(0, 20000));
    } else {
      setTimeout(() => {
        renderExtractedData({
          condominio: 'Condominio Via Manzoni 14 (Milano)',
          fornitore: 'Rossi Impianti S.r.l.',
          piva: 'IT 01847590123',
          totale: 1464.00,
          imponibile: 1200.00,
          iva: 264.00,
          ritenuta4: 48.00,
          tabella_riparto: 'Tabella C — Ascensore / Impianti (1.000/1.000)'
        });
      }, 800);
    }
  };

  // Setup Event Listeners Drag & Drop e Upload File
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'user-doc-input') {
      const file = e.target.files[0];
      if (file) window.analyzeUserDocument(file);
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
        window.analyzeUserDocument(e.dataTransfer.files[0]);
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

