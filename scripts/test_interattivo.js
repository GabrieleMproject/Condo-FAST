// scripts/test_interattivo.js
import puppeteer from 'puppeteer-core';
import path from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Carica variabili da .env
let SMOKE_EMAIL = '';
let SMOKE_PASSWORD = '';
try {
  if (existsSync('.env')) {
    for (const line of readFileSync('.env', 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
      if (m) {
        const val = m[2].replace(/^["']|["']$/g, '');
        if (m[1] === 'SMOKE_EMAIL') SMOKE_EMAIL = val;
        if (m[1] === 'SMOKE_PASSWORD') SMOKE_PASSWORD = val;
      }
    }
  }
} catch (err) {
  console.warn('⚠️ Errore nel caricamento del file .env:', err.message);
}

const BASE_URL = 'http://localhost:5173';
const TEST_DIR = '/Users/gabrielemaesani/Documents/CondoAI2/test_data /testgestionale';
const CACHE_FILE = path.join('/Users/gabrielemaesani/Documents/CondoAI2/scripts', '.last_condo_id.txt');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function typeSlowly(page, selector, text) {
  const element = await page.waitForSelector(selector);
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (el) {
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector);
  await element.focus();
  await sleep(100);
  for (const char of text) {
    await element.type(char);
    await sleep(40);
  }
}

async function clickByText(page, text, elementTag = 'button') {
  return await page.evaluate((txt, tag) => {
    const elements = Array.from(document.querySelectorAll(tag));
    const target = elements.find(el => el.textContent.toLowerCase().includes(txt.toLowerCase()));
    if (target) {
      target.click();
      return true;
    }
    return false;
  }, text, elementTag);
}

async function getElementByText(page, text, elementTag = 'button') {
  const elHandle = await page.evaluateHandle((txt, tag) => {
    const elements = Array.from(document.querySelectorAll(tag));
    return elements.find(el => el.textContent.toLowerCase().includes(txt.toLowerCase())) || null;
  }, text, elementTag);
  return elHandle.asElement();
}

let browser;

async function main() {
  console.log('🔄 Avvio di Google Chrome controllato in corso...');
  
  try {
    browser = await puppeteer.launch({
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      headless: false,
      defaultViewport: null // Usa la risoluzione dello schermo
    });
  } catch (err) {
    console.error('❌ Impossibile avviare il browser Chrome:', err.message);
    process.exit(1);
  }

  console.log('✅ Google Chrome avviato con successo!');
  
  // Recuperiamo la prima pagina o ne creiamo una nuova
  const pages = await browser.pages();
  const page = pages.length > 0 ? pages[0] : await browser.newPage();

  // Rileviamo se siamo già all'interno di un condominio o se c'è un ID salvato
  let condoId = '';
  
  // Controlliamo prima se l'utente è già su CondoSmart in qualche scheda
  console.log(`➡️ Navigazione iniziale verso: ${BASE_URL}`);
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  await sleep(2000);

  const initialUrl = page.url();
  const matchInitialId = initialUrl.match(/\/condomini\/([a-f0-9\-]+)/);
  if (matchInitialId) {
    condoId = matchInitialId[1];
    console.log(`💡 Rilevato condominio aperto a schermo dall'URL: ${condoId}`);
    writeFileSync(CACHE_FILE, condoId, 'utf8');
  } else if (existsSync(CACHE_FILE)) {
    const cachedId = readFileSync(CACHE_FILE, 'utf8').trim();
    if (cachedId) {
      condoId = cachedId;
      console.log(`💡 Rilevato ID condominio memorizzato nella cache locale: ${condoId}`);
    }
  }

  // ─── 1. Login/Registrazione incrementale ───
  const currentPath = await page.evaluate(() => window.location.pathname);
  if (currentPath.includes('/login') || currentPath.includes('/register') || !condoId) {
    
   // Controlliamo prima se l'utente è già su CondoFAST in qualche scheda
  const pages = await browser.pages();
  for (const p of pages) {
    const url = p.url();
    if (url.includes('localhost:5173') || url.includes('condofast.it')) {
      page = p;
      break;
    }
  }

  if (!page) {
    page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
  }

  console.log('🔗 Connesso alla pagina!');

  // 3. Verifichiamo se siamo già loggati o dobbiamo registrarci/loggarci
  const isLoginPage = await page.$('input[type="email"]');
  if (isLoginPage) {
    console.log('🔑 Pagina di login/registrazione rilevata.');
    const rand = Math.floor(Math.random() * 10000);
    const emailTest = `gabriele.test.${rand}@condofast.it`;
    const passwordTest = 'Password123!';

    await typeSlowly(page, 'input[name="nome"]', 'Gabriele E2E');
    await sleep(300);
    await typeSlowly(page, 'input[name="cognome"]', 'Test');
    await sleep(300);
    await typeSlowly(page, 'input[name="email"]', emailTest);
    await sleep(300);
    await typeSlowly(page, 'input[name="password"]', passwordTest);
    await sleep(500);

    console.log('☑️ Accettazione DPA e Termini di Servizio...');
    const checkboxes = await page.$$('input[type="checkbox"]');
    if (checkboxes.length >= 2) {
      await checkboxes[0].click();
      await sleep(400);
      await checkboxes[1].click();
      await sleep(400);
    }

    console.log('🚀 Invio registrazione...');
    const submitBtn = await page.$('button[type="submit"]');
    if (submitBtn) {
      await submitBtn.click();
    } else {
      await clickByText(page, 'Crea account gratuito', 'button');
    }

    await sleep(3000);

    // Gestione errore registrazione
    const errMsg = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const errDiv = divs.find(d => d.style.color === 'rgb(252, 165, 165)' || d.textContent.toLowerCase().includes('errore') || d.textContent.toLowerCase().includes('già registrato') || d.textContent.toLowerCase().includes('limit'));
      return errDiv ? errDiv.textContent : null;
    });

    let loginSuccess = false;

    if (errMsg) {
      console.log(`⚠️ Registrazione non consentita: "${errMsg.trim()}". Procedo al login con l'utente di test preconfigurato...`);
    }

    // Navigazione e compilazione login
    if (!page.url().includes('/login')) {
      await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
      await sleep(1500);
    }

    if (!errMsg) {
      console.log('🔑 Tentativo login con l\'utente appena registrato...');
      await typeSlowly(page, 'input#email', emailTest);
      await sleep(300);
      await typeSlowly(page, 'input#password', passwordTest);
      await sleep(500);
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await sleep(3000);

      const url = page.url();
      if (url.includes('/condomini') || url.includes('/dashboard')) {
        loginSuccess = true;
        console.log('✅ Login con il nuovo utente completato!');
      }
    }

    if (!loginSuccess) {
      console.log(`🔑 Login di fallback con l'utente preconfigurato: ${SMOKE_EMAIL}...`);
      if (!page.url().includes('/login')) {
        await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle2' });
        await sleep(1500);
      }
      await typeSlowly(page, 'input#email', SMOKE_EMAIL);
      await sleep(300);
      await typeSlowly(page, 'input#password', SMOKE_PASSWORD);
      await sleep(500);
      const loginBtn = await page.$('button[type="submit"]');
      if (loginBtn) await loginBtn.click();
      await sleep(3000);
    }

    // Attesa accesso alla Dashboard
    try {
      await page.waitForFunction(() => {
        const p = window.location.pathname;
        return p === '/condomini' || p.startsWith('/condomini/') || p === '/dashboard' || p === '/';
      }, { timeout: 15000 });
      console.log('✅ Accesso completato con successo!');
    } catch (err) {
      console.error('❌ Impossibile accedere. Inserisci le credenziali a schermo per procedere (attesa 3 minuti)...');
      try {
        await page.waitForFunction(() => {
          const p = window.location.pathname;
          return p === '/condomini' || p.startsWith('/condomini/') || p === '/dashboard' || p === '/';
        }, { timeout: 180000 });
      } catch (e) {
        console.error('❌ Tempo scaduto per il login.');
        process.exit(1);
      }
    }
  }

  // Navighiamo su /condomini se non siamo già dentro un condominio
  if (!condoId) {
    console.log('➕ Navigazione a Condomini per creare il nuovo condominio...');
    if (!page.url().includes('/condomini')) {
      await page.goto(`${BASE_URL}/condomini`, { waitUntil: 'networkidle2' });
      await sleep(1500);
    }

    // ─── 2. Creazione Condominio ───
    console.log('🏢 Apertura modale Nuovo Condominio...');
    const nuovoCondoBtn = await getElementByText(page, 'Nuovo condominio', 'button');
    if (nuovoCondoBtn) {
      await nuovoCondoBtn.click();
    } else {
      await clickByText(page, 'Aggiungi il primo', 'button');
    }
    await sleep(1000);

    console.log('✍️ Compilazione dati condominio...');
    const cfTest = '900' + Math.floor(10000000 + Math.random() * 90000000);
    await typeSlowly(page, 'input[placeholder="Es. Condominio Centrale"]', 'CONDOMINIO CANZIGHINA E2E BROWSER');
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="Es. 97123456789"]', cfTest);
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="Via/Piazza/Corso..."]', 'Via Canzighina');
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="1"]', '1');
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="20100"]', '20100');
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="Milano"]', 'Milano');
    await sleep(500);

    console.log('🗂️ Selezione Tab Struttura...');
    await clickByText(page, 'Struttura', 'button');
    await sleep(800);

    await typeSlowly(page, 'input[placeholder="12"]', '12'); // Numero unità
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="1"]', '1'); // Numero scale
    await sleep(300);
    await typeSlowly(page, 'input[placeholder="5"]', '5'); // Numero piani
    await sleep(500);

    console.log('🗂️ Selezione Tab Amministrazione e inserimento IBAN...');
    await clickByText(page, 'Amministrazione', 'button');
    await sleep(800);
    await typeSlowly(page, 'input[placeholder*="IT60X"]', 'IT60X0542403200000001234567');
    await sleep(500);

    console.log('💾 Salvataggio condominio...');
    await clickByText(page, 'Crea condominio', 'button');

    console.log('⏳ Attesa salvataggio e chiusura modale...');
    try {
      await page.waitForFunction(() => {
        return !document.querySelector('input[placeholder="Es. Condominio Centrale"]');
      }, { timeout: 15000 });
      console.log('✅ Modale chiusa con successo!');
    } catch (err) {
      const toastError = await page.evaluate(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        const toast = divs.find(d => d.style.position === 'fixed' && d.style.top === '20px');
        return toast ? toast.textContent.trim() : null;
      });
      console.error(`❌ Errore durante la creazione del condominio: ${toastError || 'Timeout o errore di rete'}`);
      process.exit(1);
    }

    console.log('⏳ Attesa che il condominio creato appaia nella lista...');
    try {
      await page.waitForFunction(() => {
        const divs = Array.from(document.querySelectorAll('div'));
        return divs.some(d => d.textContent.includes('CONDOMINIO CANZIGHINA E2E BROWSER'));
      }, { timeout: 6000 });
    } catch (e) {
      console.log('⚠️ Card non apparsa subito. Eseguo un reload della pagina...');
      await page.reload({ waitUntil: 'networkidle2' });
      await sleep(2000);
    }

    console.log('🔎 Apertura della pagina di dettaglio del condominio creato...');
    const cardCliccata = await page.evaluate(() => {
      const divs = Array.from(document.querySelectorAll('div'));
      const titleDiv = divs.find(d => d.textContent.trim() === 'CONDOMINIO CANZIGHINA E2E BROWSER');
      if (titleDiv) { titleDiv.click(); return true; }
      return false;
    });

    if (!cardCliccata) {
      await clickByText(page, 'CONDOMINIO CANZIGHINA E2E BROWSER', 'div');
    }

    console.log('⏳ Attesa della navigazione al dettaglio del condominio...');
    try {
      await page.waitForFunction(() => {
        return /\/condomini\/[a-f0-9\-]+/.test(window.location.pathname);
      }, { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ Warning: Timeout cambio URL.');
    }
    await sleep(1500);

    const currentUrl = page.url();
    const matchId = currentUrl.match(/\/condomini\/([a-f0-9\-]+)/);
    if (!matchId) {
      console.error('❌ Impossibile estrarre l\'ID del condominio dall\'URL corrente:', currentUrl);
      process.exit(1);
    }
    condoId = matchId[1];
    writeFileSync(CACHE_FILE, condoId, 'utf8');
    console.log(`🏢 ID Condominio rilevato e salvato: ${condoId}`);
  } else {
    // Navighiamo al dettaglio del condominio se eravamo altrove (es. su comunicazioni)
    const condoUrl = `${BASE_URL}/condomini/${condoId}`;
    if (!page.url().startsWith(condoUrl)) {
      console.log(`➡️ Navigazione diretta al dettaglio del condominio: ${condoUrl}`);
      await page.goto(condoUrl, { waitUntil: 'networkidle2' });
      await sleep(2000);
    }
  }

  // ─── 4. Importazione Anagrafica da DOCX ───
  console.log('👥 Verifica tab Anagrafica & Unità...');
  await clickByText(page, 'Anagrafica & Unità', 'button');
  await sleep(1500);

  // Verifichiamo se ci sono già occupanti nella Rubrica Contatti
  await clickByText(page, 'Rubrica Contatti', 'button');
  await sleep(1000);

  const occupantiPresenti = await page.evaluate(() => {
    // Controlla se la lista/tabella ha righe di dati (es. se trova un div con classe o testo che rappresenta un contatto)
    // Escludiamo gli header. Ad esempio se c'è un elemento cliccabile "Elimina" o se ci sono più di 2-3 righe
    const rows = Array.from(document.querySelectorAll('div')).filter(d => d.textContent.includes('Proprietario') || d.textContent.includes('Inquilino'));
    return rows.length > 0;
  });

  if (occupantiPresenti) {
    console.log('👥 Anagrafica già presente a schermo. Salto questa fase.');
  } else {
    console.log('📥 Apertura modale Importa Anagrafica...');
    await clickByText(page, 'Importa', 'button');
    await sleep(1000);

    console.log('🤖 Upload file "Elenco condomini.docx" per OCR AI...');
    const fileInputAnagrafica = await page.waitForSelector('input[type="file"]');
    const anagraficaPath = path.join(TEST_DIR, 'Elenco condomini.docx');
    if (existsSync(anagraficaPath)) {
      await fileInputAnagrafica.uploadFile(anagraficaPath);
      console.log('⏳ Attesa dell\'elaborazione AI (Gemini)...');
      await page.waitForSelector('button[style*="background: rgb(37, 99, 235)"]', { timeout: 60000 });
      await sleep(2000);

      console.log('📊 Conferma dell\'importazione dei condòmini estratti...');
      await page.click('button[style*="background: rgb(37, 99, 235)"]');
      
      try {
        await page.waitForSelector('svg[class*="lucide-check-circle-2"]', { timeout: 60000 });
      } catch (checkErr) {
        console.log('⚠️ Attesa completamento importazione anagrafica andata in timeout. Verifico la presenza di errori a schermo...');
        try {
          await page.screenshot({ path: '/Users/gabrielemaesani/Documents/CondoAI2/screenshot.png' });
          console.log('📸 Screenshot salvato in screenshot.png per ispezione visiva.');
        } catch (e) {}
        throw checkErr;
      }
      await sleep(1500);
      
      console.log('✅ Importazione anagrafica completata! Chiusura modale...');
      await clickByText(page, 'Chiudi', 'button');
      await sleep(1500);
    } else {
      console.error(`❌ File non trovato: ${anagraficaPath}`);
    }
  }

  // ─── 5. Importazione Tabelle Millesimali da PDF ───
  console.log('📐 Verifica Tabelle Millesimali...');
  await page.goto(`${BASE_URL}/condomini/${condoId}/millesimi`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  const millesimiPresenti = await page.evaluate(() => {
    // Controlla se la griglia millesimi ha dei dati. Cerca bottoni "Importa File" o la griglia
    const headers = Array.from(document.querySelectorAll('th'));
    return headers.length > 2; // se ci sono colonne per le tabelle millesimali (es. Proprietà)
  });

  if (millesimiPresenti) {
    console.log('📐 Tabelle millesimali già presenti. Salto questa fase.');
  } else {
    console.log('📂 Apertura modale Importa Millesimi...');
    await clickByText(page, 'Importa File', 'button');
    await sleep(1000);

    console.log('🤖 Upload file "Millesimi Via Canzighina - rettificati.pdf"...');
    const fileInputMillesimi = await page.waitForSelector('div[style*="position: fixed"] input[type="file"]');
    const millesimiPath = path.join(TEST_DIR, 'Millesimi Via Canzighina - rettificati.pdf');
    if (existsSync(millesimiPath)) {
      await fileInputMillesimi.uploadFile(millesimiPath);
      console.log('⏳ Attesa dell\'elaborazione AI (Gemini)...');
      await page.waitForFunction(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        return btns.some(b => b.textContent.includes('Conferma ed Importa') || b.textContent.includes('Applica'));
      }, { timeout: 60000 });
      await sleep(1500);

      console.log('📊 Conferma ed importazione millesimi...');
      await clickByText(page, 'Conferma ed Importa', 'button');
      await sleep(5000);
      console.log('✅ Caricamento millesimi completato!');
    } else {
      console.error(`❌ File non trovato: ${millesimiPath}`);
    }
  }

  // Ritorna al dettaglio del condominio
  await page.goto(`${BASE_URL}/condomini/${condoId}`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  // ─── 6. Configurazione Preventivo e Generazione Rate ───
  console.log('📋 Verifica Preventivo...');
  await clickByText(page, 'Preventivo & Saldi', 'button');
  await sleep(1500);

  const preventivoPresente = await page.evaluate(() => {
    // Se c'è già il preventivo, viene visualizzato un pannello con le rate o le voci di spesa, non il bottone "Crea preventivo 2025"
    const btns = Array.from(document.querySelectorAll('button'));
    return !btns.some(b => b.textContent.includes('Crea preventivo 2025'));
  });

  if (preventivoPresente) {
    console.log('📋 Preventivo 2025 già presente. Salto questa fase.');
  } else {
    console.log('➕ Creazione preventivo per il 2025...');
    await clickByText(page, 'Crea preventivo 2025', 'button');
    await sleep(1500);

    console.log('✍️ Aggiunta voci di preventivo di test...');
    // Voce 1: Utenze
    await typeSlowly(page, 'input[placeholder*="Pulizia scale"]', 'Energia Elettrica Condominiale');
    await page.select('select[style*="background: var(--app-bg)"]', 'utenze');
    await typeSlowly(page, 'input[placeholder="Importo €"]', '2400');
    
    const selects = await page.$$('select');
    if (selects.length >= 3) {
      await selects[2].select(await page.evaluate(el => el.options[1]?.value || '', selects[2]));
    }
    await sleep(500);
    await clickByText(page, 'Aggiungi', 'button');
    await sleep(1000);

    // Voce 2: Assicurazione
    await typeSlowly(page, 'input[placeholder*="Pulizia scale"]', 'Polizza Assicurativa Stabile');
    await page.select('select[style*="background: var(--app-bg)"]', 'assicurazione');
    await typeSlowly(page, 'input[placeholder="Importo €"]', '1200');
    if (selects.length >= 3) {
      await selects[2].select(await page.evaluate(el => el.options[1]?.value || '', selects[2]));
    }
    await sleep(500);
    await clickByText(page, 'Aggiungi', 'button');
    await sleep(1000);

    console.log('📅 Pianificazione rate trimestrali...');
    await clickByText(page, 'Trimestrali', 'button');
    await sleep(1000);

    console.log('🚀 Generazione della rateizzazione contabile...');
    await clickByText(page, 'Generare la rateizzazione', 'button');
    await sleep(3000);
  }

  // ─── 7. Configurazione Saldi Iniziali da CONSUNTIVO 2024 ───
  console.log('💰 Verifica Saldi Iniziali...');
  await clickByText(page, 'Saldi Iniziali', 'button');
  await sleep(1500);

  const saldiPresenti = await page.evaluate(() => {
    // Se i saldi sono già inseriti, ci sono valori non-zero o una griglia popolata
    const inputs = Array.from(document.querySelectorAll('input[type="number"]'));
    return inputs.some(i => parseFloat(i.value) !== 0);
  });

  if (saldiPresenti) {
    console.log('💰 Saldi iniziali già presenti. Salto questa fase.');
  } else {
    console.log('📥 Upload consuntivo precedente per importazione automatica saldi...');
    const fileInputSaldi = await page.waitForSelector('input[type="file"][accept*="pdf"]');
    const consuntivoPath = path.join(TEST_DIR, 'CONSUNTIVO 2024.pdf');
    if (existsSync(consuntivoPath)) {
      await fileInputSaldi.uploadFile(consuntivoPath);
      console.log('⏳ Attesa dell\'elaborazione AI (Gemini)...');
      await page.waitForSelector('div[style*="position: fixed"] select', { timeout: 60000 });
      await sleep(2000);

      console.log('📊 Conferma e applicazione dei saldi sulla griglia...');
      await clickByText(page, 'Applica alla griglia', 'button');
      await sleep(1500);

      console.log('💾 Salvataggio dei saldi iniziali...');
      await clickByText(page, 'Salva saldi iniziali', 'button');
      await sleep(2000);
    } else {
      console.error(`❌ File non trovato: ${consuntivoPath}`);
    }
  }

  // ─── 8. Caricamento Fatture Fornitori ───
  console.log('🧾 Verifica Fatture Fornitori...');
  await page.goto(`${BASE_URL}/condomini/${condoId}/fatture`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  const fatturePresenti = await page.evaluate(() => {
    const listItems = document.querySelectorAll('div[style*="border-bottom"]');
    return listItems.length > 0;
  });

  if (fatturePresenti) {
    console.log('🧾 Fatture già presenti a schermo. Salto questa fase.');
  } else {
    console.log('📥 Caricamento fattura di test per estrazione OCR AI...');
    const fileInputFattura = await page.waitForSelector('input#fattura-upload');
    const fatturaPath = path.join(TEST_DIR, 'Untitled_01072026_151512.pdf');
    if (existsSync(fatturaPath)) {
      await fileInputFattura.uploadFile(fatturaPath);
      console.log('⏳ Attesa estrazione AI della fattura...');
      await page.waitForFunction(() => {
        return !document.querySelector('label[htmlFor="fattura-upload"]')?.textContent.includes('AI');
      }, { timeout: 60000 });
      await sleep(2000);

      const newFornitoreBtn = await getElementByText(page, 'Salva in Rubrica', 'button');
      if (newFornitoreBtn) {
        console.log('👤 Nuovo fornitore rilevato. Salvataggio in rubrica...');
        await newFornitoreBtn.click();
        await sleep(2000);
      }
      console.log('✅ Fattura caricata correttamente!');
    } else {
      console.error(`❌ File non trovato: ${fatturaPath}`);
    }
  }

  // ─── 9. Caricamento Estratto Conto ───
  console.log('🏦 Verifica Estratto Conto...');
  await page.goto(`${BASE_URL}/condomini/${condoId}/estratto-conto`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  const ecPresente = await page.evaluate(() => {
    const rows = document.querySelectorAll('div[style*="border-bottom"]');
    return rows.length > 0;
  });

  if (ecPresente) {
    console.log('🏦 Movimenti estratto conto già presenti. Salto questa fase.');
  } else {
    console.log('📥 Caricamento estratto conto trimestrale di test...');
    const fileInputEC = await page.waitForSelector('input#estratto-upload');
    const ecPath = path.join(TEST_DIR, 'Estratto conto al 31 03.pdf');
    if (existsSync(ecPath)) {
      await fileInputEC.uploadFile(ecPath);
      console.log('⏳ Attesa estrazione AI dell\'estratto conto...');
      await page.waitForFunction(() => {
        return !document.querySelector('label[htmlFor="estratto-upload"]')?.textContent.includes('Analisi AI');
      }, { timeout: 90000 });
      await sleep(2000);
      console.log('✅ Movimenti bancari caricati con successo!');
    } else {
      console.error(`❌ File non trovato: ${ecPath}`);
    }
  }

  // ─── 10. Navigazione a Riconciliazioni ───
  console.log('🔄 Navigazione a Riconciliazione Uscite per mostrare gli abbinamenti...');
  await page.goto(`${BASE_URL}/condomini/${condoId}/riconciliazioni`, { waitUntil: 'networkidle2' });
  await sleep(1500);

  console.log('🤖 Avvio analisi AI per gli abbinamenti uscite ↔ fatture...');
  const avviaRicBtn = await getElementByText(page, 'Avvia Analisi AI', 'button');
  if (avviaRicBtn) {
    await avviaRicBtn.click();
    console.log('⏳ Attesa elaborazione abbinamenti AI...');
    await page.waitForFunction(() => {
      const btn = document.querySelector('button[disabled]');
      return !btn || !btn.textContent.includes('Analisi');
    }, { timeout: 45000 });
    await sleep(2000);
  }

  console.log('🎉 Test E2E completato con successo!');
  console.log('ℹ️ Puoi procedere alle verifiche manuali dei suggerimenti contabili e del consuntivo!');
}

main().catch(async err => {
  console.error('❌ Errore durante l\'esecuzione del test interattivo:', err);
  try {
    const pages = await browser.pages();
    if (pages.length > 0) {
      await pages[0].screenshot({ path: '/Users/gabrielemaesani/Documents/CondoAI2/screenshot.png' });
      console.log('📸 Screenshot dell\'errore salvato in screenshot.png');
    }
  } catch (e) {
    console.error('⚠️ Impossibile salvare lo screenshot:', e.message);
  }
  process.exit(1);
});
