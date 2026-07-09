// src/lib/fiscaleTelematico.js

/**
 * Genera il file telematico ministeriale per la Certificazione Unica (CU)
 * conforme alle specifiche tecniche dell'Agenzia delle Entrate.
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
  const annoRiferimento = anno.substring(0, 4);

  // --- 1. RECORD A (FRONTESPIZIO - DATI FORNITURA) ---
  let recA = "A";
  recA += "CUR26"; // Codice fornitura (es: CUR26 per l'anno 2026)
  recA += "1";     // Tipo fornitore (1 = sostituto)
  recA += cfAmministratore.padEnd(16, ' ');
  recA = recA.padEnd(1900, ' ');
  righe.push(recA);
  recordCount++;

  // --- 2. RECORD B (DATI SOSTITUTO D'IMPOSTA) ---
  let recB = "B";
  recB += cfSostituto.padEnd(16, ' ');
  recB += padString(condominio?.nome || '', 150); // Denominazione sostituto
  recB += padString(condominio?.indirizzo || '', 100);
  recB += padString(condominio?.cap || '', 5);
  recB += padString(condominio?.citta || '', 40);
  recB += padString(condominio?.provincia || '', 2).toUpperCase();
  
  // Dati rappresentante firmatario (amministratore)
  recB += cfAmministratore.padEnd(16, ' ');
  recB += "01"; // Codice carica (01 = Rappresentante Legale)
  recB += padString(profile?.ragione_sociale || '', 150);
  recB = recB.padEnd(1900, ' ');
  righe.push(recB);
  recordCount++;

  let progressivoPercipiente = 1;

  fornitoriList.forEach(fData => {
    const fornitore = fData.fornitore;
    const cfPercipiente = formattaCf(fornitore?.codice_fiscale || fornitore?.partita_iva);
    
    if (!cfPercipiente) return; // Salta se privo di codice fiscale valido
    
    const lordo = Math.round(fData.totaleImponibile * 100);
    const ritenuta = Math.round(fData.totaleRitenute * 100);
    const imponibile = Math.round(fData.totaleImponibile * 100);
    
    const causaleCU = fornitore.regime_forfettario ? "W" : "A"; // W = Contratti d'appalto condominio, A = Lavoro autonomo professionale
    const codEsclusione = fornitore.codice_esclusione_cu || (fornitore.regime_forfettario ? "24" : "  ");

    // --- 3. RECORD D (ANAGRAFICA PERCIPIENTE) ---
    const progStr = String(progressivoPercipiente).padStart(5, '0');
    let recD = "D";
    recD += cfSostituto.padEnd(16, ' ');
    recD += progStr;
    recD += cfPercipiente.padEnd(16, ' ');
    recD += padString(fornitore.ragione_sociale || '', 150);
    recD += padString(fornitore.indirizzo || '', 100);
    recD += padString(fornitore.cap || '', 5);
    recD += padString(fornitore.citta || '', 40);
    recD += padString(fornitore.provincia || '', 2).toUpperCase();
    recD = recD.padEnd(1900, ' ');
    righe.push(recD);
    recordCount++;

    // --- 4. RECORD H (DATI CERTIFICAZIONE / REDDITI LAVORO AUTONOMO) ---
    let recH = "H";
    recH += cfSostituto.padEnd(16, ' ');
    recH += progStr;
    recH += cfPercipiente.padEnd(16, ' ');
    
    // Campi numerici posizionali
    recH += causaleCU.padEnd(2, ' ');                // Causale (pos 35-36)
    recH += String(lordo).padStart(13, '0');        // Ammontare lordo corrisposto (pos 37-49)
    
    if (fornitore.regime_forfettario) {
      recH += String(lordo).padStart(13, '0');      // Somme non soggette a ritenuta
      recH += String(0).padStart(13, '0');          // Imponibile ritenuta
      recH += String(0).padStart(13, '0');          // Ritenute effettuate
      recH += codEsclusione.padEnd(2, ' ');         // Codice esclusione
    } else {
      recH += String(0).padStart(13, '0');          // Somme non soggette
      recH += String(imponibile).padStart(13, '0'); // Imponibile ritenuta
      recH += String(ritenuta).padStart(13, '0');   // Ritenute effettuate
      recH += "  ";                                 // Codice esclusione vuoto
    }
    
    recH = recH.padEnd(1900, ' ');
    righe.push(recH);
    recordCount++;

    progressivoPercipiente++;
  });

  // --- 5. RECORD Z (TOTALI DI CONTROLLO) ---
  let recZ = "Z";
  recZ += cfAmministratore.padEnd(16, ' ');
  recZ += String(progressivoPercipiente - 1).padStart(5, '0'); // Numero percipienti
  recZ += String(recordCount + 1).padStart(7, '0');             // Numero record totali nel file
  recZ = recZ.padEnd(1900, ' ');
  righe.push(recZ);

  // Unisce i record da 1900 caratteri con CRLF
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
  const annoRiferimento = anno.substring(0, 4);

  // --- 1. RECORD A (FRONTESPIZIO) ---
  let recA = "A";
  recA += "77026"; // Codice fornitura per il 770 dell'anno 2026
  recA += "1";
  recA += cfAmministratore.padEnd(16, ' ');
  recA = recA.padEnd(1900, ' ');
  righe.push(recA);
  recordCount++;

  // --- 2. RECORD B (DATI ANAGRAFICI SOSTITUTO) ---
  let recB = "B";
  recB += cfSostituto.padEnd(16, ' ');
  recB += padString(condominio?.nome || '', 150);
  recB += cfAmministratore.padEnd(16, ' ');
  recB += "01";
  recB = recB.padEnd(1900, ' ');
  righe.push(recB);
  recordCount++;

  // --- 3. RECORD F (QUADRO ST - DETTAGLIO VERSAMENTI RITENUTE) ---
  // Ogni tributo pagato in F24 genera un rigo del quadro ST nel record F
  let progressivoRigo = 1;
  
  delegheF24.forEach(del => {
    if (del.stato !== 'pagato') return; // Consideriamo solo gli F24 effettivamente pagati
    
    const dataVersamento = del.data_pagamento ? del.data_pagamento.replace(/-/g, '') : '';
    const tributi = del.f24_dettagli_tributi || [];

    tributi.forEach(tr => {
      const progStr = String(progressivoRigo).padStart(5, '0');
      const importoVersato = Math.round(tr.importo * 100);
      const meseRif = String(tr.mese_riferimento).padStart(2, '0');
      const annoRif = String(tr.anno_riferimento).padStart(4, '0');
      
      let recF = "F";
      recF += cfSostituto.padEnd(16, ' ');
      recF += progStr;
      recF += "ST"; // Quadro ST
      recF += tr.codice_tributo.padEnd(4, ' ');          // Codice tributo (es. 1019)
      recF += meseRif + annoRif;                          // Periodo di riferimento (MMGGAA o MMAAAA)
      recF += String(importoVersato).padStart(13, '0');   // Ritenute operate / versate
      recF += dataVersamento.padEnd(8, ' ');             // Data di versamento (AAAAMMGG)
      
      recF = recF.padEnd(1900, ' ');
      righe.push(recF);
      recordCount++;
      progressivoRigo++;
    });
  });

  // --- 4. RECORD Z (TOTALI) ---
  let recZ = "Z";
  recZ += cfAmministratore.padEnd(16, ' ');
  recZ += String(progressivoRigo - 1).padStart(5, '0'); // Numero totale righi quadro ST
  recZ += String(recordCount + 1).padStart(7, '0');
  recZ = recZ.padEnd(1900, ' ');
  righe.push(recZ);

  return righe.map(r => r.substring(0, 1900)).join("\r\n") + "\r\n";
}

// Helpers
function formattaCf(cf) {
  return (cf || '').replace(/\s+/g, '').toUpperCase();
}

function padString(str, length) {
  const cleanStr = String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s\-\.\,\/]/g, ' ');
  return cleanStr.padEnd(length, ' ').substring(0, length);
}
