// src/lib/cbiGenerator.js

/**
 * Genera un file CBI F24 a lunghezza record fissa (120 caratteri per riga)
 * per il pagamento telematico di deleghe F24 multiple.
 * Conforme allo standard CBI (Corporate Banking Italiano).
 * 
 * @param {Array} deleghe - Lista di deleghe F24 con condominio, tributi e dettagli
 * @param {Object} profile - Profilo dell'amministratore (mittente)
 * @returns {string} Il contenuto del file CBI in formato testo con CRLF
 */
export function generaCbiF24(deleghe, profile) {
  const SIA = (profile?.codice_sia || 'SIA99').toUpperCase().padEnd(5, ' ').substring(0, 5);
  const ABI_MITTENTE = (profile?.codice_abi || '00000').padStart(5, '0').substring(0, 5);
  
  const dataInvio = formattaDataOggi(); // GGMMAA
  const oraInvio = formattaOraOra();   // HHMM
  
  let recordCount = 0;
  let righe = [];
  let importoTotaleDistinta = 0;

  // --- 1. RECORD DI TESTA (TIPO 10) ---
  // Pos 1-2:   "10" (Tipo record)
  // Pos 3-7:   Codice SIA Mittente (5 char)
  // Pos 8-12:  Codice ABI Banca del mittente (5 char)
  // Pos 13-18: Data Invio (GGMMAA)
  // Pos 19-38: Nome Supporto (Amministratore o Studio) - 20 char
  // Pos 39-120: Spazi
  let rec10 = "10" + SIA + ABI_MITTENTE + dataInvio + padLeftOrRight(profile?.ragione_sociale || 'CONDOFAST DISTINTA', 20, ' ', false);
  rec10 = rec10.padEnd(120, ' ');
  righe.push(rec10);
  recordCount++;

  deleghe.forEach((delega, index) => {
    const cfCondominio = (delega.condominio?.codice_fiscale || '').replace(/\s+/g, '').toUpperCase().padEnd(16, ' ').substring(0, 16);
    const nomeCondominio = padLeftOrRight(delega.condominio?.nome || 'Condominio', 30, ' ', false);
    const ibanCondominio = (delega.condominio?.iban || '').replace(/\s+/g, '').toUpperCase();
    const abiCondo = ibanCondominio.substring(5, 10) || '00000';
    const cabCondo = ibanCondominio.substring(10, 15) || '00000';
    const contoCondo = ibanCondominio.substring(15, 27) || '000000000000';
    
    const dataVersamento = formattaDataCBI(delega.data_scadenza); // GGMMAA
    const importoDebitoDelega = Math.round(delega.importo_totale * 100);
    importoTotaleDistinta += delega.importo_totale;
    
    const progressivoDelega = String(index + 1).padStart(5, '0');

    // --- 2. RECORD DI DELEGA (TIPO 20) ---
    // Pos 1-2:   "20" (Tipo record)
    // Pos 3-7:   Progressivo delega (5 char)
    // Pos 8-23:  Codice Fiscale Contribuente (16 char)
    // Pos 24-53: Denominazione Contribuente (30 char)
    // Pos 54-59: ABI del conto addebito (5 char)
    // Pos 60-64: CAB del conto addebito (5 char)
    // Pos 65-76: Numero Conto addebito (12 char)
    // Pos 77-82: Data Esecuzione Richiesta (GGMMAA)
    // Pos 83-92: Importo Totale Debito (10 cifre senza virgola, es: 0000012045 per 120,45€)
    // Pos 93-120: Spazi
    let rec20 = "20" + progressivoDelega + cfCondominio + nomeCondominio + abiCondo.padStart(5, '0') + cabCondo.padStart(5, '0') + contoCondo.padStart(12, '0') + dataVersamento + String(importoDebitoDelega).padStart(10, '0');
    rec20 = rec20.padEnd(120, ' ');
    righe.push(rec20);
    recordCount++;

    // --- 3. RECORD DI DETTAGLIO TRIBUTI (TIPO 30) ---
    // Per ogni tributo della delega creiamo un record 30
    const tributi = delega.f24_dettagli_tributi || [];
    tributi.forEach((tr) => {
      const codTributo = tr.codice_tributo.padEnd(4, ' ').substring(0, 4);
      const meseRif = String(tr.mese_riferimento).padStart(2, '0');
      const annoRif = String(tr.anno_riferimento).slice(-4).padStart(4, '0');
      const importoTributo = Math.round(tr.importo * 100);

      // Pos 1-2:   "30" (Tipo record)
      // Pos 3-7:   Progressivo delega (5 char)
      // Pos 8-11:  Codice Sezione (es: "ERAC" per Erario, qui usiamo "ER" o spazi a seconda degli standard, ma lo standard F24 CBI prevede codici sezione standard. Per Erario è "ER")
      // Pos 12-15: Codice Tributo (4 char)
      // Pos 16-21: Mese/Anno Riferimento (MMAAAA)
      // Pos 22-31: Importo a debito (10 cifre)
      // Pos 32-120: Spazi
      let rec30 = "30" + progressivoDelega + "ER  " + codTributo + meseRif + annoRif + String(importoTributo).padStart(10, '0');
      rec30 = rec30.padEnd(120, ' ');
      righe.push(rec30);
      recordCount++;
    });
  });

  // --- 4. RECORD DI CODA (TIPO 90) ---
  // Pos 1-2:   "90" (Tipo record)
  // Pos 3-7:   Codice SIA Mittente (5 char)
  // Pos 8-14:  Numero Totale Record nel file inclusi testa e coda (7 cifre)
  // Pos 15-24: Importo Totale delle deleghe (10 cifre)
  // Pos 25-120: Spazi
  const totaleRecord = String(recordCount + 1).padStart(7, '0');
  const importoTotaleFile = String(Math.round(importoTotaleDistinta * 100)).padStart(10, '0');
  let rec90 = "90" + SIA + totaleRecord + importoTotaleFile;
  rec90 = rec90.padEnd(120, ' ');
  righe.push(rec90);

  // Unisce le righe con CRLF come previsto dallo standard CBI
  return righe.join("\r\n") + "\r\n";
}

// Helper formatting
function formattaDataOggi() {
  const d = new Date();
  const gg = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const aa = String(d.getFullYear()).slice(-2);
  return `${gg}${mm}${aa}`;
}

function formattaOraOra() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}${mm}`;
}

function formattaDataCBI(dateStr) {
  if (!dateStr) return '160000';
  const parti = dateStr.split('-');
  if (parti.length !== 3) return '160000';
  const gg = parti[2].padStart(2, '0');
  const mm = parti[1].padStart(2, '0');
  const aa = parti[0].slice(-2);
  return `${gg}${mm}${aa}`;
}

function padLeftOrRight(val, length, padChar = ' ', isNumber = false) {
  const cleanStr = String(val || '');
  if (isNumber) {
    return cleanStr.padStart(length, padChar).substring(0, length);
  } else {
    // Sanitizzazione caratteri non standard ASCII per CBI
    const sanitized = cleanStr
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Rimuove accenti
      .toUpperCase()
      .replace(/[^A-Z0-9\s\-\.\,\/]/g, ' '); // Sostituisce caratteri speciali
    return sanitized.padEnd(length, padChar).substring(0, length);
  }
}
