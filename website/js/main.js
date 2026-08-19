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
    // Close menu when tapping outside (mobile UX standard)
    document.addEventListener('click', (e) => {
      if (
        navLinks.classList.contains('is-open') &&
        !navLinks.contains(e.target) &&
        !navToggle.contains(e.target)
      ) {
        navLinks.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ---------- Flip cards: toggle su touch (mobile) ----------
     Su desktop: le carte si girano con hover (CSS).
     Su mobile: hover non persiste al tocco, quindi usiamo JS
     per aggiungere/rimuovere la classe .is-flipped al click.
     Il CSS gestisce il comportamento visivo (flip 3D su desktop,
     show/hide delle facce su mobile tramite media query).
  ----------------------------------------------------------- */
  document.querySelectorAll('.flip').forEach((card) => {
    card.addEventListener('click', () => {
      card.classList.toggle('is-flipped');
    });
  });


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
    s.dataset.domain = 'condofast.it';
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
  const roiReconDisplay = document.getElementById('roi-recon-val');
  const roiInvoicesDisplay = document.getElementById('roi-invoices-val');
  const roiPlanBadge = document.getElementById('roi-plan-badge');

  function updateRoiCalculator(condoCount) {
    if (!roiValDisplay) return;
    const count = parseInt(condoCount, 10) || 30;
    roiValDisplay.textContent = count;

    // Calcoli deterministici realistici per uno studio amministrativo
    const hoursSaved = Math.round(count * 0.8);
    const savingsYear = Math.round(count * 135);
    
    // Nuovi KPI:
    // 1. Spunta estratti conto: Manuale (25 min/condominio) -> 2 min/condominio con AI (mensile)
    const manualReconHours = Math.round((count * 25) / 60); 
    const aiReconHours = Math.max(1, Math.round((count * 2) / 60)); 
    // 2. Fatture inserite in automatico: stima di ~15 fatture/mese a condominio = 180 all'anno
    const invoicesProcessedYear = count * 180;
    
    let planCost = 59;
    let planName = 'Base';
    if (count > 100) {
      planCost = 299;
      planName = 'Professional';
    } else if (count > 50) {
      planCost = 169;
      planName = 'Studio';
    }
    const costPerCondo = (planCost / count).toFixed(2).replace('.', ',');

    const reportDays = count > 80 ? '3 Giorni' : '2 Giorni';

    if (roiHoursDisplay) roiHoursDisplay.textContent = hoursSaved + ' Ore';
    if (roiSavingsDisplay) roiSavingsDisplay.textContent = '€ ' + savingsYear.toLocaleString('it-IT');
    if (roiCostPerCondoDisplay) roiCostPerCondoDisplay.textContent = '€ ' + costPerCondo;
    if (roiReportTimeDisplay) roiReportTimeDisplay.textContent = reportDays;
    
    if (roiReconDisplay) {
      roiReconDisplay.innerHTML = `<span style="text-decoration:line-through;opacity:0.5;font-size:1.1rem;margin-right:8px">${manualReconHours}h</span><span style="color:#22c55e">${aiReconHours}h</span>`;
    }
    if (roiInvoicesDisplay) {
      roiInvoicesDisplay.textContent = invoicesProcessedYear.toLocaleString('it-IT');
    }
    if (roiPlanBadge) {
      roiPlanBadge.textContent = planName;
    }
  }

  if (roiSlider) {
    roiSlider.addEventListener('input', (e) => updateRoiCalculator(e.target.value));
    updateRoiCalculator(roiSlider.value);
  }

  const MAX_DEMO_TRIES = 10;

  function renderTrialLimitBanner() {
    const aiDetails = document.getElementById('demo-ai-details');
    const aiHeader = document.getElementById('demo-ai-header');
    const scannerLine = document.getElementById('scanner-line');
    const docPreview = document.getElementById('demo-doc-content');

    if (scannerLine) scannerLine.classList.remove('is-scanning');
    if (aiHeader) aiHeader.innerHTML = '✦ Prove Gratuite Completate (10/10)';

    const bannerHtml = `
      <div class="trial-limit-banner" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.18) 0%, rgba(147, 51, 234, 0.18) 100%); border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 16px; padding: 28px 20px; text-align: center; box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.4);">
        <div style="font-size: 2.2rem; margin-bottom: 8px;">🎉</div>
        <h4 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin-bottom: 8px;">Hai completato le tue 10 prove gratuite!</h4>
        <p style="color: #cbd5e1; font-size: 0.92rem; max-width: 520px; margin: 0 auto 18px; line-height: 1.55;">
          Hai visto quanto è veloce l'Intelligenza Artificiale di CondoFAST? Attiva subito la tua <strong>prova gratuita di 14 giorni</strong> per elaborare fatture ed estratti conto illimitati, gestire la contabilità e i tuoi condomini senza limiti.
        </p>
        <div style="display: flex; gap: 12px; justify-content: center; align-items: center; flex-wrap: wrap;">
          <a href="https://condofast.app/register" class="btn btn--primary btn-glow" style="padding: 13px 28px; font-weight: 700; font-size: 0.96rem; text-decoration: none; border-radius: 12px;">
            🚀 Inizia la Prova Gratuita — 14 Giorni →
          </a>
        </div>
        <div style="margin-top: 12px; font-size: 0.78rem; color: #94a3b8;">
          Nessuna carta di credito richiesta · Setup in 2 minuti · Disdici quando vuoi
        </div>
      </div>
    `;

    if (aiDetails) {
      aiDetails.innerHTML = bannerHtml;
      const modalContainer = aiDetails.closest('.modal-container');
      if (modalContainer) {
        modalContainer.scrollTo({ top: aiDetails.offsetTop - 30, behavior: 'smooth' });
      }
    }

    if (docPreview) {
      docPreview.innerHTML = `
        <span class="console-doc-tag highlight-cyan">Limite Raggiunto</span>
        <div style="color:#60a5fa;font-weight:700;font-size:1rem;margin-bottom:8px">10 Prove su 10 Effettuate</div>
        <div style="color:var(--muted);font-size:0.85rem;line-height:1.5">
          Tutte le 10 elaborazioni di anteprima sono state completate con successo. Per elaborare nuovi documenti reali del tuo studio, crea il tuo account gratuito.
        </div>
        <div style="margin-top:16px">
          <a href="https://condofast.app/register" class="btn btn--ghost btn--sm" style="width:100%;justify-content:center">Crea Account Gratuito →</a>
        </div>
      `;
    }
  }

  function updateDemoCounterBadge() {
    let demoCount = parseInt(localStorage.getItem('condofast_demo_count') || '0', 10);
    const badge = document.getElementById('demo-tries-badge');
    if (badge) {
      const remaining = Math.max(0, MAX_DEMO_TRIES - demoCount);
      badge.textContent = `Prove rimanenti: ${remaining}/${MAX_DEMO_TRIES}`;
    }
  }

  /* ---------- Analizzatore AI Reale per qualsiasi Fattura / Scontrino Utente ---------- */
  window.analyzeUserDocument = function (file) {
    const docPreview = document.getElementById('demo-doc-content');
    const aiDetails = document.getElementById('demo-ai-details');
    const aiHeader = document.getElementById('demo-ai-header');
    const scannerLine = document.getElementById('scanner-line');

    if (!docPreview || !aiDetails || !aiHeader) return;

    let demoCount = parseInt(localStorage.getItem('condofast_demo_count') || '0', 10);
    if (demoCount >= MAX_DEMO_TRIES) {
      renderTrialLimitBanner();
      return;
    }

    const fileName = file ? file.name : 'Fattura_Esempio_Manutenzione.pdf';
    const fileSize = file ? (file.size / 1024).toFixed(1) + ' KB' : '245 KB';

    // Attiva la scansione laser neon
    if (scannerLine) scannerLine.classList.add('is-scanning');

    aiHeader.textContent = '✦ Analisi AI in corso... Lettura multimodale del documento';
    aiDetails.innerHTML = `<div style="text-align:center;padding:24px 0;color:var(--muted)">
      <div style="display:inline-block;width:24px;height:24px;border:3px solid var(--accent);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;margin-bottom:8px"></div>
      <div>Analisi AI in corso da <strong>${fileName}</strong>...</div>
      <div style="font-size:0.75rem;margin-top:4px;color:#94a3b8">Estrazione esclusiva dei dati presenti nel documento (Prova ${demoCount + 1} di ${MAX_DEMO_TRIES})</div>
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
      if (val) return val;
      return 'Dato non rilevato nel documento';
    }

    // Funzione di rendering dei dati reali
    function renderExtractedData(data) {
      if (scannerLine) scannerLine.classList.remove('is-scanning');

      const currentCount = parseInt(localStorage.getItem('condofast_demo_count') || '0', 10);
      aiHeader.textContent = `✦ AI Extraction Completa (Prova ${currentCount} di ${MAX_DEMO_TRIES})`;

      const condoDisplay = data.condominio ? data.condominio : 'Dato non rilevato nel documento';
      const fornitoreDisplay = data.fornitore ? data.fornitore : 'Dato non rilevato nel documento';
      const pivaDisplay = data.piva ? data.piva : 'Non indicata nel documento';
      const dataFatturaDisplay = data.data ? data.data : 'Non rilevata';
      
      const totaleDisplay = data.totale ? '€ ' + Number(data.totale).toFixed(2).replace('.', ',') : 'Non rilevato nel documento';
      const imponibileDisplay = data.imponibile ? '€ ' + Number(data.imponibile).toFixed(2).replace('.', ',') : (data.totale ? '€ ' + (data.totale / 1.22).toFixed(2).replace('.', ',') : 'Non specificato');
      const ivaDisplay = data.iva ? ' (IVA € ' + Number(data.iva).toFixed(2).replace('.', ',') + ')' : '';
      const tabellaDisplay = data.tabella_riparto ? data.tabella_riparto : 'Tabella A — Proprietà Generale';
      const ritenutaDisplay = data.ritenuta4 ? '€ ' + Number(data.ritenuta4).toFixed(2).replace('.', ',') : (data.imponibile ? '€ ' + (data.imponibile * 0.04).toFixed(2).replace('.', ',') : 'Non applicabile');

      const reachedLimit = currentCount >= MAX_DEMO_TRIES;
      const trialCtaBanner = reachedLimit ? `
        <div class="trial-limit-banner" style="background: linear-gradient(135deg, rgba(37, 99, 235, 0.2) 0%, rgba(147, 51, 234, 0.2) 100%); border: 1px solid rgba(96, 165, 250, 0.35); border-radius: 14px; padding: 20px; text-align: center; margin-top: 16px;">
          <div style="font-size: 1.5rem; margin-bottom: 4px;">🎉</div>
          <h5 style="color: #fff; font-size: 1.1rem; font-weight: 800; margin-bottom: 6px;">Hai completato le 10 prove gratuite!</h5>
          <p style="color: #cbd5e1; font-size: 0.85rem; margin-bottom: 14px;">
            Attiva la prova completa di 14 giorni per continuare a elaborare documenti illimitati.
          </p>
          <a href="https://condofast.app/register" class="btn btn--primary" style="padding: 10px 22px; font-weight: 700; font-size: 0.88rem; text-decoration: none; border-radius: 10px;">
            Inizia la Prova Gratuita di 14 Giorni →
          </a>
        </div>
      ` : '';

      aiDetails.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:10px">
          <!-- 1. Condominio & Fornitore -->
          <div class="extracted-grid">
            <div class="extracted-card" id="card-condo">
              <div class="extracted-card-title">Condominio Destinatario</div>
              <div class="extracted-card-val" style="color:#60a5fa">${condoDisplay}</div>
            </div>
            <div class="extracted-card" id="card-fornitore">
              <div class="extracted-card-title">Fornitore Estratto</div>
              <div class="extracted-card-val">${fornitoreExtractedDisplay(fornitoreDisplay)}</div>
            </div>
          </div>
          
          <!-- 2. Data & P.IVA -->
          <div class="extracted-grid">
            <div class="extracted-card" id="card-data">
              <div class="extracted-card-title">Data Documento</div>
              <div class="extracted-card-val">${dataFatturaDisplay}</div>
            </div>
            <div class="extracted-card" id="card-piva">
              <div class="extracted-card-title">P.IVA / C.F.</div>
              <div class="extracted-card-val">${pivaDisplay}</div>
            </div>
          </div>

          <!-- 3. Importi e IVA -->
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

          <!-- 4. Riparto Millesimale & Ritenuta F24 -->
          <div class="extracted-card" id="card-riparto" style="border-color:rgba(192,132,252,0.3);background:rgba(192,132,252,0.06)">
            <div class="extracted-card-title" style="color:#c084fc">Riparto Millesimale Rilevato / Suggerito</div>
            <div class="extracted-card-val" style="color:#fff">${tabellaDisplay}</div>
          </div>

          <div class="extracted-card" id="card-ritenuta" style="background:rgba(239,68,68,0.08);border-color:rgba(239,68,68,0.25)">
            <div class="extracted-card-title" style="color:#f87171">Ritenuta d'Acconto (Stima F24)</div>
            <div class="extracted-card-val" style="color:#fff">${ritenutaDisplay}</div>
          </div>

          <div style="margin-top:8px;display:flex;gap:10px;justify-content:flex-end">
            <a href="https://condofast.app/register" class="btn btn--primary" style="padding:10px 18px;border-radius:8px;font-weight:700;font-size:0.85rem;text-decoration:none">Registrati e Salva in Contabilità →</a>
          </div>

          ${trialCtaBanner}
        </div>
      `;

      // Scorrimento contestuale del pop-up in parallelo alla generazione dei dati
      const modalContainer = aiHeader.closest('.modal-container');
      if (modalContainer) {
        const targetScroll = aiHeader.offsetTop - 20;
        modalContainer.scrollTo({ top: targetScroll, behavior: 'smooth' });
      }

      // Animazione sequenziale sintonizzata con lo scorrimento
      const cardIds = ['card-condo', 'card-fornitore', 'card-data', 'card-piva', 'card-imponibile', 'card-totale', 'card-riparto', 'card-ritenuta'];
      cardIds.forEach((id, index) => {
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.classList.add('is-revealed');
        }, index * 70);
      });
    }

    if (file) {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
      
      const reader = new FileReader();
      reader.onload = async function() {
        try {
          const base64 = reader.result.split(',')[1];
          const payload = {
            type: isImage ? 'vision' : 'document',
            mediaType: file.type || (isPdf ? 'application/pdf' : 'image/jpeg'),
            prompt: "Analizza questa fattura ed estrai rigorosamente i dati fiscali. Restituisci SOLO ed ESCLUSIVAMENTE un oggetto JSON valido con questa struttura esatta, senza testo extra:\n{\n  \"dati\": {\n    \"fornitore\": \"nome fornitore\",\n    \"partita_iva\": \"partita iva\",\n    \"totale\": 0.00,\n    \"imponibile\": 0.00,\n    \"iva\": 0.00,\n    \"data\": \"DD/MM/YYYY\",\n    \"condominio\": \"nome condominio destinatario\",\n    \"tabella_riparto\": \"Tabella A — Proprietà Generale\"\n  }\n}",
            system: "Sei un assistente AI per estrattore dati contabili CondoFAST. Devi sempre rispondere con codice JSON puro.",
            jsonMode: true
          };
          if (isImage) {
            payload.image = base64;
          } else {
            payload.document = base64;
          }

          const response = await fetch("https://aapksiokakavarwaumwy.supabase.co/functions/v1/gemini-proxy", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-CondoFAST-Demo": "true"
            },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errData = await response.json().catch(() => null);
            throw new Error(errData?.error || "Errore chiamata API AI");
          }

          const result = await response.json();
          let jsonStr = '';
          try {
            if (!result.content || !result.content[0] || !result.content[0].text) {
              throw new Error("Risposta AI priva di contenuto testuale.");
            }
            jsonStr = result.content[0].text;
            const parsed = JSON.parse(jsonStr.replace(/```json|```/g, '').trim());
            const dati = parsed.dati || parsed;

            localStorage.setItem('condofast_demo_count', (demoCount + 1).toString());

            setTimeout(() => {
              renderExtractedData({
                condominio: dati.condominio,
                fornitore: dati.fornitore,
                piva: dati.partita_iva,
                totale: dati.totale,
                imponibile: dati.imponibile,
                iva: dati.iva,
                data: dati.data,
                tabella_riparto: dati.tabella_riparto || 'Tabella A — Proprietà Generale'
              });
            }, 400);
          } catch (parseErr) {
            console.error("Raw AI response:", jsonStr);
            throw new Error(`Risposta AI non valida: ${jsonStr.slice(0, 100)}...`);
          }

        } catch (err) {
          console.error("Errore estrazione AI:", err);
          alert(`Errore di sistema: ${err.message}. Verifica la console per i dettagli.`);
          const aiPulse = document.getElementById('ai-pulse');
          if (aiPulse) aiPulse.style.display = 'none';
          if (aiHeader) aiHeader.innerHTML = '✦ AI Extraction: Fallita';
        }
      };
      reader.readAsDataURL(file);
    } else {
      localStorage.setItem('condofast_demo_count', (demoCount + 1).toString());
      setTimeout(() => {
        renderExtractedData({
          condominio: 'Condominio Via Manzoni 14 (Milano)',
          fornitore: 'Rossi Impianti S.r.l.',
          piva: 'IT 01847590123',
          data: '12/03/2026',
          totale: 1464.00,
          imponibile: 1200.00,
          iva: 264.00,
          ritenuta4: 48.00,
          tabella_riparto: 'Tabella C — Ascensore / Impianti'
        });
      }, 800);
    }
  };

  // Setup Event Listeners Drag & Drop e Upload File
  document.addEventListener('change', (e) => {
    if (e.target && e.target.id === 'user-doc-input') {
      const file = e.target.files[0];
      if (file) analyzeUserDocument(file);
    }
    
    if (e.target && e.target.id === 'privacy-consent-checkbox') {
      const isChecked = e.target.checked;
      const dropzone = document.getElementById('demo-dropzone');
      const wrapper = document.getElementById('demo-dropzone-wrapper');
      if (isChecked) {
        dropzone.classList.remove('disabled-privacy');
        wrapper.classList.remove('disabled-privacy');
      } else {
        dropzone.classList.add('disabled-privacy');
        wrapper.classList.add('disabled-privacy');
      }
    }
  });

  document.addEventListener('dragover', (e) => {
    const dropzone = e.target.closest('#demo-dropzone-wrapper');
    if (dropzone && !dropzone.classList.contains('disabled-privacy')) {
      e.preventDefault();
      dropzone.querySelector('#demo-dropzone').classList.add('is-dragover');
    }
  });

  document.addEventListener('dragleave', (e) => {
    const dropzone = e.target.closest('#demo-dropzone-wrapper');
    if (dropzone && !dropzone.classList.contains('disabled-privacy')) {
      dropzone.querySelector('#demo-dropzone').classList.remove('is-dragover');
    }
  });

  document.addEventListener('drop', (e) => {
    const wrapper = e.target.closest('#demo-dropzone-wrapper');
    if (wrapper) {
      e.preventDefault();
      if (wrapper.classList.contains('disabled-privacy')) {
        alert("Devi spuntare la casella della Privacy Policy per sbloccare l'area di elaborazione AI.");
        return;
      }
      wrapper.querySelector('#demo-dropzone').classList.remove('is-dragover');
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

    const sampleDocBtn = e.target.closest('[data-action="sample-doc"]');
    if (sampleDocBtn) {
      e.preventDefault();
      if (typeof window.analyzeUserDocument === 'function') {
        window.analyzeUserDocument(null);
      }
      return;
    }

    const privacyAlert = e.target.closest('[data-action="privacy-alert"], #demo-dropzone-overlay');
    if (privacyAlert) {
      e.preventDefault();
      alert("Devi spuntare la casella della Privacy Policy per sbloccare l'area di elaborazione AI.");
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

  /* ---------- ScrollSpy for Features Sidebar ---------- */
  const featureRows = document.querySelectorAll('.feature-row');
  const navLinksList = document.querySelectorAll('#features-nav a');

  if (featureRows.length > 0 && navLinksList.length > 0 && 'IntersectionObserver' in window) {
    const observerOptions = {
      root: null,
      rootMargin: '-20% 0px -60% 0px', // Attiva l'elemento quando entra nel 20-40% superiore dello schermo
      threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id');
          // Rimuovi classe active da tutti
          navLinksList.forEach(link => link.classList.remove('active'));
          // Aggiungi active a quello corrispondente
          const activeLink = document.querySelector(`#features-nav a[href="#${id}"]`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    }, observerOptions);

    featureRows.forEach(row => observer.observe(row));
  }
})();
