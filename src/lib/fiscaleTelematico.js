// src/lib/fiscaleTelematico.js

/**
 * Helper per scrivere campi in posizioni assolute del tracciato Sogei (1-based).
 * 
 * @param {string} record - La riga del record corrente (inizializzata a 1900 spazi)
 * @param {string|number} valore - Il valore da scrivere
 * @param {number} inizio - Posizione di inizio (1-based, es: 17 per codice fiscale)
 * @param {number} lunghezza - Lunghezza del campo
 * @param {boolean} alineaDestra - Allineamento a destra (tipico per importi numerici)
 * @param {string} padChar - Carattere di riempimento (spazio o zero)
 * @returns {string} Il record aggiornato
 */
function scriviCampo(record, valore, inizio, lunghezza, alineaDestra = false, padChar = ' ') {
  let testo = String(valore ?? '');
  
  // Sanitizzazione caratteri speciali per l'Agenzia delle Entrate
  testo = testo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-\.\,\/\&\']/g, ' '); // Conserva caratteri tipici ammessi

  if (testo.length > lunghezza) {
    testo = testo.substring(0, lunghezza);
  } else {
    testo = alineaDestra ? testo.padStart(lunghezza, padChar) : testo.padEnd(lunghezza, padChar);
  }
  
  const idx = inizio - 1; // Conversione a 0-based in JS
  return record.substring(0, idx) + testo + record.substring(idx + lunghezza);
}

/**
 * Formatta un importo numerico a 15 cifre (compresi 2 decimali senza virgola) per Sogei.
 * Esempio: 120.45 -> 12045 -> "000000000012045"
 * 
 * @param {number} importo 
 * @returns {string}
 */
function formattaImportoSogei(importo) {
  const val = Math.round((parseFloat(importo) || 0) * 100);
  return String(val).padStart(15, '0');
}

/**
 * Genera il file telematico ministeriale per la Certificazione Unica (CU)
 * conforme alle specifiche tecniche posizionali dell'Agenzia delle Entrate.
 * Ciascun record ha lunghezza fissa di 1900 caratteri ed è terminato da CRLF.
 * 
 * @param {Object} condominio - Dati del condominio (Sostituto)
 * @param {string} anno - Anno d'imposta (es. 2026)
 * @param {Array} fornitoriList - Lista dei fornitori (percipienti) con imponibile e ritenute
 * @param {Object} profile - Profilo dell'amministratore (Rappresentante Legale/Sostituto)
 * @returns {string} Il contenuto del file .txt telematico
 */
export function generaTelematicoCU(condominio, anno, fornitoriList, profile) {
  let righe = [];
  let recordCount = 0;
  
  const cfSostituto = formattaCf(condominio?.codice_fiscale);
  const cfAmministratore = formattaCf(profile?.codice_fiscale);
  
  // L'anno di presentazione del telematico è l'anno d'imposta + 1
  const annoPresentazione = String(parseInt(anno.substring(0, 4)) + 1);
  const aaPresentazione = annoPresentazione.slice(-2); // es. "26" per il 2026 (imposta 2025)

  // --- 1. RECORD A (FRONTESPIZIO - DATI FORNITURA) ---
  let recA = "".padEnd(1900, ' ');
  recA = scriviCampo(recA, "A", 1, 1);
  recA = scriviCampo(recA, `CUR${aaPresentazione}`, 2, 5); // Codice fornitura, es: CUR26
  recA = scriviCampo(recA, "1", 7, 1);                    // Tipo fornitore (1 = sostituto)
  recA = scriviCampo(recA, cfAmministratore, 8, 16);       // CF Amministratore (Mittente)
  righe.push(recA);
  recordCount++;

  // --- 2. RECORD B (DATI SOSTITUTO D'IMPOSTA) ---
  let recB = "".padEnd(1900, ' ');
  recB = scriviCampo(recB, "B", 1, 1);
  recB = scriviCampo(recB, cfSostituto, 2, 16);            // CF Sostituto (Condominio)
  recB = scriviCampo(recB, condominio?.nome, 18, 150);     // Denominazione sostituto
  recB = scriviCampo(recB, condominio?.indirizzo, 168, 100);
  recB = scriviCampo(recB, condominio?.cap, 268, 5);
  recB = scriviCampo(recB, condominio?.citta, 273, 40);
  recB = scriviCampo(recB, condominio?.provincia, 313, 2);
  
  // Dati rappresentante firmatario (amministratore)
  recB = scriviCampo(recB, cfAmministratore, 315, 16);     // CF Rappresentante
  recB = scriviCampo(recB, "01", 331, 2);                  // Codice carica (01 = Rappresentante Legale)
  recB = scriviCampo(recB, profile?.ragione_sociale, 333, 150); // Cognome e Nome / Ragione Sociale
  righe.push(recB);
  recordCount++;

  let progressivoPercipiente = 1;

  fornitoriList.forEach(fData => {
    const fornitore = fData.fornitore;
    const cfPercipiente = formattaCf(fornitore?.codice_fiscale || fornitore?.partita_iva);
    
    if (!cfPercipiente) return; // Salta se privo di codice fiscale valido
    
    const impLordo = formattaImportoSogei(fData.totaleImponibile);
    const impRitenuta = formattaImportoSogei(fData.totaleRitenute);
    
    const primaFattura = fData.fatture?.[0];
    // Determinazione della causale in base al tributo F24: 1040 -> "A" (Autonomo), altri -> "W" (Appalto condominio)
    const causaleCU = primaFattura?.codice_tributo_f24 === "1040" ? "A" : "W";
    const codEsclusione = fornitore.codice_esclusione_cu || (fornitore.regime_forfettario ? "24" : "  ");

    const progStr = String(progressivoPercipiente).padStart(5, '0');

    // --- 3. RECORD D (ANAGRAFICA PERCIPIENTE) ---
    let recD = "".padEnd(1900, ' ');
    recD = scriviCampo(recD, "D", 1, 1);
    recD = scriviCampo(recD, cfSostituto, 2, 16);
    recD = scriviCampo(recD, progStr, 18, 5);              // N. progressivo percipiente
    recD = scriviCampo(recD, cfPercipiente, 23, 16);        // CF Percipiente
    recD = scriviCampo(recD, fornitore.ragione_sociale, 39, 150);
    recD = scriviCampo(recD, fornitore.indirizzo, 189, 100);
    recD = scriviCampo(recD, fornitore.cap, 289, 5);
    recD = scriviCampo(recD, fornitore.citta, 294, 40);
    recD = scriviCampo(recD, fornitore.provincia, 334, 2);
    righe.push(recD);
    recordCount++;

    // --- 4. RECORD H (DATI CERTIFICAZIONE / REDDITI LAVORO AUTONOMO, APPORTI E CONTRATTI APPALTO) ---
    let recH = "".padEnd(1900, ' ');
    recH = scriviCampo(recH, "H", 1, 1);
    recH = scriviCampo(recH, cfSostituto, 2, 16);
    recH = scriviCampo(recH, progStr, 18, 5);
    recH = scriviCampo(recH, cfPercipiente, 23, 16);
    
    // Riferimenti importi
    recH = scriviCampo(recH, causaleCU, 39, 2);             // Causale (pos 39-40, es: "A" o "W")
    recH = scriviCampo(recH, impLordo, 41, 15);             // Ammontare lordo corrisposto (pos 41-55)
    
    if (fornitore.regime_forfettario) {
      recH = scriviCampo(recH, impLordo, 56, 15);           // Somme non soggette a ritenuta (pos 56-70)
      recH = scriviCampo(recH, "".padStart(15, '0'), 71, 15); // Imponibile ritenuta
      recH = scriviCampo(recH, "".padStart(15, '0'), 86, 15); // Ritenute effettuate
      recH = scriviCampo(recH, codEsclusione, 101, 2);      // Codice esclusione
    } else {
      recH = scriviCampo(recH, "".padStart(15, '0'), 56, 15); // Somme non soggette
      recH = scriviCampo(recH, impLordo, 71, 15);           // Imponibile ritenuta
      recH = scriviCampo(recH, impRitenuta, 86, 15);        // Ritenute effettuate
      recH = scriviCampo(recH, "  ", 101, 2);               // Codice esclusione vuoto
    }
    
    righe.push(recH);
    recordCount++;

    progressivoPercipiente++;
  });

  // --- 5. RECORD Z (TOTALI DI CONTROLLO) ---
  let recZ = "".padEnd(1900, ' ');
  recZ = scriviCampo(recZ, "Z", 1, 1);
  recZ = scriviCampo(recZ, cfAmministratore, 2, 16);
  recZ = scriviCampo(recZ, String(progressivoPercipiente - 1), 18, 5, true, '0'); // Tot. percipienti
  recZ = scriviCampo(recZ, String(recordCount + 1), 23, 7, true, '0');           // Tot. record file
  righe.push(recZ);

  return righe.map(r => r.substring(0, 1900)).join("\r\n") + "\r\n";
}

/**
 * Genera il file telematico ministeriale per il Modello 770 Semplificato
 * (riepilogo dei versamenti F24 effettuati).
 * Ciascun record ha lunghezza fissa di 1900 caratteri ed è terminato da CRLF.
 * 
 * @param {Object} condominio - Dati del condominio
 * @param {string} anno - Anno di riferimento
 * @param {Array} delegheF24 - Lista di deleghe F24 pagate
 * @param {Object} profile - Profilo dell'amministratore
 * @returns {string} Il contenuto del file .txt telematico
 */
export function generaTelematico770(condominio, anno, delegheF24, profile) {
  let righe = [];
  let recordCount = 0;
  
  const cfSostituto = formattaCf(condominio?.codice_fiscale);
  const cfAmministratore = formattaCf(profile?.codice_fiscale);
  
  const annoPresentazione = String(parseInt(anno.substring(0, 4)) + 1);
  const aaPresentazione = annoPresentazione.slice(-2); // es. "26"

  // --- 1. RECORD A (FRONTESPIZIO) ---
  let recA = "".padEnd(1900, ' ');
  recA = scriviCampo(recA, "A", 1, 1);
  recA = scriviCampo(recA, `770${aaPresentazione}`, 2, 5); // Codice fornitura, es: 77026
  recA = scriviCampo(recA, "1", 7, 1);
  recA = scriviCampo(recA, cfAmministratore, 8, 16);
  righe.push(recA);
  recordCount++;

  // --- 2. RECORD B (DATI ANAGRAFICI SOSTITUTO) ---
  let recB = "".padEnd(1900, ' ');
  recB = scriviCampo(recB, "B", 1, 1);
  recB = scriviCampo(recB, cfSostituto, 2, 16);
  recB = scriviCampo(recB, condominio?.nome, 18, 150);
  recB = scriviCampo(recB, cfAmministratore, 168, 16);
  recB = scriviCampo(recB, "01", 184, 2);
  righe.push(recB);
  recordCount++;

  // --- 3. RECORD F (QUADRO ST - DETTAGLIO VERSAMENTI RITENUTE) ---
  let progressivoRigo = 1;
  
  delegheF24.forEach(del => {
    if (del.stato !== 'pagato') return;
    
    const dataVersamento = del.data_pagamento ? del.data_pagamento.replace(/-/g, '') : ''; // AAAAMMGG
    const tributi = del.f24_dettagli_tributi || [];

    tributi.forEach(tr => {
      const progStr = String(progressivoRigo).padStart(5, '0');
      const impVersato = formattaImportoSogei(tr.importo);
      const meseRif = String(tr.mese_riferimento).padStart(2, '0');
      const annoRif = String(tr.anno_riferimento).padStart(4, '0');
      
      let recF = "".padEnd(1900, ' ');
      recF = scriviCampo(recF, "F", 1, 1);
      recF = scriviCampo(recF, cfSostituto, 2, 16);
      recF = scriviCampo(recF, progStr, 18, 5);             // Progressivo rigo
      recF = scriviCampo(recF, "ST", 23, 2);                // Quadro ST
      recF = scriviCampo(recF, tr.codice_tributo, 25, 4);    // Codice tributo (es. 1019)
      recF = scriviCampo(recF, meseRif + annoRif, 29, 6);   // Periodo riferimento (MMAAAA)
      recF = scriviCampo(recF, impVersato, 35, 15);         // Ritenute versate (15 cifre Sogei)
      recF = scriviCampo(recF, dataVersamento, 50, 8);      // Data versamento (AAAAMMGG)
      
      righe.push(recF);
      recordCount++;
      progressivoRigo++;
    });
  });

  // --- 4. RECORD Z (TOTALI) ---
  let recZ = "".padEnd(1900, ' ');
  recZ = scriviCampo(recZ, "Z", 1, 1);
  recZ = scriviCampo(recZ, cfAmministratore, 2, 16);
  recZ = scriviCampo(recZ, String(progressivoRigo - 1), 18, 5, true, '0'); // Tot. righi ST
  recZ = scriviCampo(recZ, String(recordCount + 1), 23, 7, true, '0');    // Tot. record file
  righe.push(recZ);

  return righe.map(r => r.substring(0, 1900)).join("\r\n") + "\r\n";
}

// Helpers
function formattaCf(cf) {
  return (cf || '').replace(/\s+/g, '').toUpperCase();
}
