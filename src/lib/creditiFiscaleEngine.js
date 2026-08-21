// src/lib/creditiFiscaleEngine.js
/**
 * Motore per la gestione del "Cassetto Crediti d'Imposta Condominiale" e la compensazione automatica
 * su modelli F24 (Sezione Erario - Colonna Importi a credito compensati).
 */

/**
 * Calcola il saldo dei crediti d'imposta accumulati per ciascun condominio.
 * 
 * @param {Array} delegheF24 - Tutte le deleghe F24 del condominio
 * @param {Array} fatture - Tutte le fatture del condominio
 * @returns {object} { totaleCreditoDisponibile, listaCrediti, storicoCompensazioni }
 */
export function calcolaCreditiCondominio(delegheF24 = [], fatture = []) {
  // 1. Calcola le ritenute complessivamente dovute sulle fatture
  const ritenuteDovutePerMese = {};
  fatture.forEach(f => {
    if (f.stato !== 'pagata' || !f.data_pagamento) return;
    const meseAnno = f.data_pagamento.substring(0, 7); // YYYY-MM
    const rit = parseFloat(f.importo_ritenuta || f.ritenuta_acconto || 0);
    ritenuteDovutePerMese[meseAnno] = (ritenuteDovutePerMese[meseAnno] || 0) + rit;
  });

  let totaleCreditoDisponibile = 0;
  const listaCrediti = [];

  // 2. Analizza i versamenti F24 effettuati
  delegheF24.forEach(d => {
    if (d.stato !== 'pagato' && !d.quietanza_url) return;
    
    // Se la delega ha generato un'eccedenza rispetto ai tributi registrati
    const importoPagato = parseFloat(d.importo_totale || 0);
    const importoCompensato = parseFloat(d.importo_compensato || 0);

    // Dettagli tributi
    const tributi = d.f24_dettagli_tributi || [];
    const sommaTributi = tributi.reduce((s, t) => s + parseFloat(t.importo || 0), 0);

    if (importoPagato > sommaTributi && sommaTributi > 0) {
      const eccedenza = Math.round((importoPagato - sommaTributi) * 100) / 100;
      totaleCreditoDisponibile += eccedenza;
      listaCrediti.push({
        id: `eccedenza_${d.id}`,
        tipo: 'eccedenza_f24',
        f24_id: d.id,
        descrizione: `Versamento in eccesso F24 del ${d.data_pagamento || d.data_scadenza}`,
        importo: eccedenza,
        data: d.data_pagamento || d.data_scadenza
      });
    }

    if (d.credito_erario_generato && parseFloat(d.credito_erario_generato) > 0) {
      const cred = parseFloat(d.credito_erario_generato);
      totaleCreditoDisponibile += cred;
      listaCrediti.push({
        id: `credito_${d.id}`,
        tipo: 'credito_dichiarato',
        f24_id: d.id,
        descrizione: d.note || `Credito d'imposta registrato`,
        importo: cred,
        data: d.data_pagamento || d.data_scadenza
      });
    }
  });

  return {
    totaleCreditoDisponibile: Math.max(0, Math.round(totaleCreditoDisponibile * 100) / 100),
    listaCrediti
  };
}

/**
 * Applica una compensazione di credito erario su una delega F24 da pagare,
 * riducendo l'importo totale a debito da versare in banca.
 * 
 * @param {object} delega - Delega F24 originaria
 * @param {number} creditoDaCompensare - Importo del credito da applicare
 * @returns {object} Delega aggiornata con importo_totale al netto della compensazione
 */
export function applicaCompensazioneDelega(delega, creditoDaCompensare) {
  const debitoOriginario = parseFloat(delega.importo_totale || 0);
  const compensazione = Math.min(debitoOriginario, Math.max(0, parseFloat(creditoDaCompensare || 0)));
  const nuovoDebitoNetto = Math.round((debitoOriginario - compensazione) * 100) / 100;

  return {
    ...delega,
    importo_debito_originario: debitoOriginario,
    importo_compensato: compensazione,
    importo_totale: nuovoDebitoNetto,
    ha_compensazione: compensazione > 0
  };
}
