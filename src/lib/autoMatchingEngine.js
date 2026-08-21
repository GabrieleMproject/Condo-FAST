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
/**
 * Cerca la migliore proposta di fattura abbinabile a un movimento di uscita bancario.
 * Gestisce sia importo lordo sia netto a pagare (al netto della ritenuta d'acconto),
 * verifica IBAN fornitore, numero fattura e corrispondenza anagrafica.
 * 
 * @param {object} movimento - Oggetto movimento bancario ({ importo, causale, fornitore_rilevato, data_movimento })
 * @param {Array<object>} fatture - Lista fatture del condominio non ancora abbinate/pagate
 * @returns {object|null} { fattura, score, isPerfectMatch, motivoMatch } oppure null se nessun match affidabile
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
    const importoFattTotale = Math.abs(Number(f.importo_totale) || 0);
    const ritenuta = Math.abs(Number(f.importo_ritenuta || f.ritenuta_acconto || 0));
    const nettoAPagare = Math.max(0, importoFattTotale - ritenuta);

    const diffTotale = Math.abs(importoMov - importoFattTotale);
    const diffNetto = Math.abs(importoMov - nettoAPagare);

    // Determina se l'importo coincide con il totale fattura o con il netto a pagare
    const matchTotale = diffTotale <= 0.05;
    const matchNetto = ritenuta > 0 && diffNetto <= 0.05;

    // Se l'importo differisce sia dal totale che dal netto a pagare, scarta
    if (!matchTotale && !matchNetto) continue;

    let score = 50; // Base score per la corrispondenza dell'importo
    const motivi = [];
    
    if (matchNetto) {
      motivi.push(`Importo netto coincidente (€ ${nettoAPagare.toFixed(2)}, ritenuta € ${ritenuta.toFixed(2)})`);
      score += 10;
    } else {
      motivi.push(`Importo totale coincidente (€ ${importoFattTotale.toFixed(2)})`);
    }

    let hasNumFatturaMatch = false;
    let hasIbanMatch = false;
    let hasFornitoreMatch = false;

    // 1. Verifica Numero Fattura nella causale bancaria
    if (f.numero_fattura) {
      const numClean = String(f.numero_fattura).trim().toLowerCase();
      const numDigitsOnly = numClean.replace(/[^0-9]/g, '');

      if (numClean && numClean.length >= 2 && causaleNorm.includes(numClean)) {
        score += 35;
        hasNumFatturaMatch = true;
        motivi.push(`N. fattura "${f.numero_fattura}" in causale`);
      } else if (numDigitsOnly && numDigitsOnly.length >= 3 && causaleNorm.includes(numDigitsOnly)) {
        score += 25;
        hasNumFatturaMatch = true;
        motivi.push(`N. fattura "${numDigitsOnly}" in causale`);
      }
    }

    // 2. Verifica IBAN (Priorità: IBAN indicato sulla singola fattura, fallback: anagrafica fornitore)
    const ibanFatturaDoc = (f.iban || f.iban_fornitore || f.iban_accredito || '').replace(/\s+/g, '').toLowerCase();
    const ibanAnagrafica = (f.fornitore_rel?.iban || f.fornitore_iban || '').replace(/\s+/g, '').toLowerCase();
    const ibanFornitore = ibanFatturaDoc || ibanAnagrafica;

    if (ibanFornitore && ibanFornitore.length >= 15) {
      const causaleSenzaSpazi = (movimento.causale || '').replace(/\s+/g, '').toLowerCase();
      const matchIban = causaleSenzaSpazi.includes(ibanFornitore) || (ibanFornitore.length >= 10 && causaleSenzaSpazi.includes(ibanFornitore.substring(5, 20)));
      
      if (matchIban) {
        score += 35;
        hasIbanMatch = true;
        motivi.push(ibanFatturaDoc ? `IBAN specifico della fattura riconosciuto` : `IBAN fornitore riconosciuto`);
      }
    }

    // 3. Verifica Ragione Sociale Fornitore
    const fornitoreFattNorm = normalizzaTesto(f.fornitore || f.fornitore_rel?.ragione_sociale);
    if (fornitoreFattNorm && fornitoreFattNorm.length >= 3) {
      const paroleFornitore = fornitoreFattNorm.split(' ').filter(p => p.length > 2 && !['srl', 'spa', 'snc', 'sas', 'soc', 'coop', 'ditta'].includes(p));
      
      const paroleMatch = paroleFornitore.filter(p => causaleNorm.includes(p) || fornitoreMovNorm.includes(p));
      if (paroleMatch.length > 0) {
        score += Math.min(30, paroleMatch.length * 15);
        hasFornitoreMatch = true;
        motivi.push(`Fornitore "${f.fornitore}" in causale`);
      }
    }

    // Quadratura Perfetta Deterministica (100% certezza)
    // Se importo è esatto E c'è almeno (Fornitore + N. Fattura) OPPURE (Fornitore + IBAN) OPPURE (N. Fattura + IBAN)
    const isPerfectMatch = (matchTotale || matchNetto) && (
      (hasFornitoreMatch && hasNumFatturaMatch) ||
      (hasFornitoreMatch && hasIbanMatch) ||
      (hasNumFatturaMatch && hasIbanMatch)
    );

    if (isPerfectMatch) {
      score = 100;
      motivi.unshift('Quadratura perfetta 100%');
    }

    if (score > maxScore && score >= 60) {
      maxScore = score;
      bestMatch = {
        fattura: f,
        score,
        isPerfectMatch,
        motivoMatch: motivi.join(' • ')
      };
    }
  }

  return bestMatch;
}
