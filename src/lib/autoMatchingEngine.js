// src/lib/autoMatchingEngine.js
/**
 * Engine per l'Auto-Matching automatico e intelligente tra Movimenti Bancari in uscita e Fatture Fornitori.
 */

/**
 * Normalizza una stringa per il confronto (minuscolo, senza punteggiatura/spazi extra)
 */
function normalizzaTesto(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // rimuovi accenti
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Cerca la migliore proposta di fattura abbinabile a un movimento di uscita.
 * @param {object} movimento - Oggetto movimento bancario ({ importo, causale, fornitore_rilevato, data_movimento })
 * @param {Array<object>} fatture - Lista fatture del condominio non ancora abbinate/pagate
 * @returns {object|null} { fattura, score, motivoMatch } oppure null se nessun match affidabile
 */
export function trovaBestMatchFattura(movimento, fatture = []) {
  if (!movimento || Math.abs(Number(movimento.importo) || 0) === 0 || !fatture?.length) {
    return null;
  }

  const importoMov = Math.abs(Number(movimento.importo));
  const causaleNorm = normalizzaTesto(movimento.causale);
  const fornitoreMovNorm = normalizzaTesto(movimento.fornitore_rilevato);

  let bestMatch = null;
  let maxScore = 0;

  for (const f of fatture) {
    const importoFatt = Math.abs(Number(f.importo_totale));
    const diffImporto = Math.abs(importoMov - importoFatt);

    // Se l'importo differisce di più di 0.05€, scarta (per le uscite contabili serve precisione)
    if (diffImporto > 0.05) continue;

    let score = 50; // Base score per la corrispondenza esatta dell'importo
    const motivi = ['Importo coincidente'];

    // 1. Verifica Numero Fattura nella causale bancaria
    if (f.numero_fattura) {
      const numClean = String(f.numero_fattura).trim().toLowerCase();
      const numDigitsOnly = numClean.replace(/[^0-9]/g, '');

      if (numClean && numClean.length >= 2 && causaleNorm.includes(numClean)) {
        score += 40;
        motivi.push(`N. fattura "${f.numero_fattura}" presente in causale`);
      } else if (numDigitsOnly && numDigitsOnly.length >= 3 && causaleNorm.includes(numDigitsOnly)) {
        score += 30;
        motivi.push(`N. fattura "${numDigitsOnly}" trovato in causale`);
      }
    }

    // 2. Verifica Ragione Sociale Fornitore nella causale o nel fornitore rilevato
    const fornitoreFattNorm = normalizzaTesto(f.fornitore);
    if (fornitoreFattNorm && fornitoreFattNorm.length >= 3) {
      const paroleFornitore = fornitoreFattNorm.split(' ').filter(p => p.length > 2 && !['srl', 'spa', 'snc', 'sas', 'soc', 'coop', 'ditta'].includes(p));
      
      const paroleMatch = paroleFornitore.filter(p => causaleNorm.includes(p) || fornitoreMovNorm.includes(p));
      if (paroleMatch.length > 0) {
        score += Math.min(30, paroleMatch.length * 15);
        motivi.push(`Fornitore "${f.fornitore}" riconosciuto in causale`);
      }
    }

    if (score > maxScore && score >= 60) {
      maxScore = score;
      bestMatch = {
        fattura: f,
        score,
        motivoMatch: motivi.join(' • ')
      };
    }
  }

  return bestMatch;
}
