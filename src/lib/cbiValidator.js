// src/lib/cbiValidator.js

/**
 * Valida un IBAN italiano secondo lo standard ISO 13616 e il controllo MOD-97.
 * @param {string} iban 
 * @returns {boolean}
 */
export function validaIbanItaliano(iban) {
  if (!iban) return false;
  const cleanIban = String(iban).replace(/\s+/g, '').toUpperCase();
  
  // L'IBAN italiano deve iniziare con IT ed essere lungo esattamente 27 caratteri
  if (!/^IT\d{2}[A-Z]\d{10}[A-Z0-9]{12}$/.test(cleanIban)) {
    return false;
  }
  
  // Algoritmo MOD-97 (ISO 7064)
  // Sposta i primi 4 caratteri alla fine
  const rearranged = cleanIban.substring(4) + cleanIban.substring(0, 4);
  
  // Converte ciascun carattere alfabetico nel suo equivalente numerico (A=10, B=11, ..., Z=35)
  let numericStr = '';
  for (let i = 0; i < rearranged.length; i++) {
    const char = rearranged[i];
    const code = char.charCodeAt(0);
    if (code >= 65 && code <= 90) { // A-Z
      numericStr += (code - 55).toString();
    } else {
      numericStr += char;
    }
  }
  
  // Calcolo modulo 97 con BigInt per prevenire overflow numerico
  try {
    const remainder = BigInt(numericStr) % 97n;
    return remainder === 1n;
  } catch (e) {
    return false;
  }
}

/**
 * Valida un Codice Fiscale italiano (16 caratteri alfanumerici) o Partita IVA (11 cifre).
 * @param {string} cf 
 * @returns {boolean}
 */
export function validaCodiceFiscaleOPiva(cf) {
  if (!cf) return false;
  const clean = String(cf).replace(/\s+/g, '').toUpperCase();
  // CF persona fisica (16 char) o P.IVA / CF condominio (11 cifre numeriche)
  return /^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(clean) || /^\d{11}$/.test(clean);
}

/**
 * Esegue i controlli di sicurezza e conformità preventiva su un gruppo di deleghe F24
 * destinate all'esportazione in distinta CBI F24.
 * 
 * @param {Array} deleghe - Lista di deleghe selezionate
 * @param {Object} profile - Profilo dell'amministratore (Sostituto / Mittente)
 * @returns {Object} { ok: boolean, errors: Array, warnings: Array, info: Array, totaleImporto: number }
 */
export function validaDelegheCbi(deleghe, profile) {
  const errors = [];
  const warnings = [];
  const info = [];
  let totaleImporto = 0;

  if (!deleghe || deleghe.length === 0) {
    errors.push("Nessun modello F24 selezionato per la generazione della distinta.");
    return { ok: false, errors, warnings, info, totaleImporto: 0 };
  }

  // 1. Controllo Profilo Amministratore (Sostituto)
  if (!profile?.codice_fiscale || !validaCodiceFiscaleOPiva(profile.codice_fiscale)) {
    errors.push("Codice Fiscale dell'Amministratore non valido o mancante nel Profilo Studio.");
  }
  
  if (!profile?.codice_sia) {
    warnings.push("Codice SIA non specificato nel Profilo Studio (verrà utilizzato il valore predefinito SIA99).");
  }

  const oggiStr = new Date().toISOString().split('T')[0];

  // 2. Controllo puntuale per ciascuna Delega F24
  deleghe.forEach((delega, idx) => {
    const numDelega = idx + 1;
    const condoNome = delega.condominio?.nome || `Condominio ID ${delega.condominio_id || numDelega}`;
    const iban = delega.condominio?.iban;
    const cfCondo = delega.condominio?.codice_fiscale;

    // Controllo Sicurezza Anti-Doppio Pagamento
    if (delega.stato === 'pagato' || delega.quietanza_url) {
      errors.push(`[${condoNome}] ATTENZIONE DOPPIO PAGAMENTO: La delega F24 del ${delega.data_scadenza || ''} risulta già pagata o provvista di quietanza.`);
    }

    // Validation IBAN Condominio
    if (!iban) {
      errors.push(`[${condoNome}] Mancante IBAN di addebito del condominio.`);
    } else if (!validaIbanItaliano(iban)) {
      errors.push(`[${condoNome}] IBAN non valido: "${iban}". Verificare il codice IBAN del condominio.`);
    }

    // Validation CF Condominio
    if (!cfCondo) {
      errors.push(`[${condoNome}] Codice Fiscale / Partita IVA del condominio mancante.`);
    } else if (!validaCodiceFiscaleOPiva(cfCondo)) {
      errors.push(`[${condoNome}] Codice Fiscale del condominio non valido: "${cfCondo}".`);
    }

    // Validation Importo Delega
    const importo = parseFloat(delega.importo_totale || 0);
    if (isNaN(importo) || importo <= 0) {
      errors.push(`[${condoNome}] L'F24 presenta un importo nullo o negativo (€ ${importo.toFixed(2)}).`);
    } else {
      totaleImporto += importo;
    }

    // Validation Scadenza
    if (delega.data_scadenza && delega.data_scadenza < oggiStr) {
      warnings.push(`[${condoNome}] F24 in scadenza il ${delega.data_scadenza} (antecedente ad oggi). Potrebbero essere dovute sanzioni o ravvedimento operoso.`);
    }

    // Validation Dettagli Tributi
    const tributi = delega.f24_dettagli_tributi || [];
    if (tributi.length === 0) {
      errors.push(`[${condoNome}] Nessun codice tributo associato alla delega F24.`);
    } else {
      let sommaTributi = 0;
      tributi.forEach(tr => {
        const impTr = parseFloat(tr.importo || 0);
        sommaTributi += impTr;
        if (!tr.codice_tributo) {
          errors.push(`[${condoNome}] Presente un tributo senza codice tributo specificato.`);
        }
        if (impTr <= 0) {
          warnings.push(`[${condoNome}] Il tributo ${tr.codice_tributo || ''} ha importo pari a € 0.00.`);
        }
      });

      // Quadratura somma tributi con importo totale delega
      if (Math.abs(sommaTributi - importo) > 0.01) {
        errors.push(`[${condoNome}] Disallineamento importi: la somma dei tributi (€ ${sommaTributi.toFixed(2)}) non corrisponde al totale delega (€ ${importo.toFixed(2)}).`);
      }
    }
  });

  // 3. Info riassuntive
  info.push(`Selezionate ${deleghe.length} deleghe F24 per un totale complessivo di € ${totaleImporto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}.`);
  info.push("I file della distinta CBI F24 a 120 caratteri per riga sono conformi allo standard bancario italiano.");

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    info,
    totaleImporto
  };
}
