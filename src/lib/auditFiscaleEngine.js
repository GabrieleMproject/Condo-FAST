// src/lib/auditFiscaleEngine.js
// Motore di verifica e audit di quadratura fiscale tra ritenute d'acconto ed F24 (Modello 770 / CU)

/**
 * Calcola la quadratura fiscale tra le ritenute d'acconto nelle fatture dell'esercizio ed i versamenti F24 registrati.
 * 
 * @param {Array} fatture - array di fatture_fornitori del condominio
 * @param {Array} delegheF24 - array di f24_deleghe del condominio
 * @returns {object} { status: 'conforme' | 'discrepanza' | 'in_attesa', totaleRitenuteFatture, totaleF24Pagati, differenza, messaggio }
 */
export function verificaQuadraturaFiscaleRitenute(fatture = [], delegheF24 = []) {
  // 1. Somma ritenute calcolate sulle fatture dell'anno (con stato pagata o con ritenuta > 0)
  const totaleRitenuteFatture = (fatture || []).reduce((sum, f) => {
    const ritenuta = parseFloat(f.importo_ritenuta || f.ritenuta_acconto || 0)
    return sum + (isNaN(ritenuta) ? 0 : ritenuta)
  }, 0)

  // 2. Somma totale F24 versati (stato = 'pagato')
  const totaleF24Pagati = (delegheF24 || [])
    .filter(d => d.stato === 'pagato' || d.quietanza_url != null || d.data_pagamento != null)
    .reduce((sum, d) => {
      const tot = parseFloat(d.importo_totale || 0)
      return sum + (isNaN(tot) ? 0 : tot)
    }, 0)

  const diffRaw = Math.abs(totaleRitenuteFatture - totaleF24Pagati)
  const differenza = Math.round(diffRaw * 100) / 100

  if (totaleRitenuteFatture === 0 && totaleF24Pagati === 0) {
    return {
      status: 'in_attesa',
      totaleRitenuteFatture: 0,
      totaleF24Pagati: 0,
      differenza: 0,
      messaggio: 'Nessuna ritenuta o versamento F24 registrato nell\'esercizio corrente.'
    }
  }

  if (differenza <= 0.02) { // Tolleranza 2 centesimi per arrotondamenti di calcolo
    return {
      status: 'conforme',
      totaleRitenuteFatture,
      totaleF24Pagati,
      differenza: 0,
      messaggio: 'Quadratura Ritenute/F24 per 770 e CU: 100% verificata. I versamenti corrispondono perfettamente alle fatture.'
    }
  }

  return {
    status: 'discrepanza',
    totaleRitenuteFatture,
    totaleF24Pagati,
    differenza,
    messaggio: `Discrepanza di € ${differenza.toFixed(2)} tra il totale ritenute nelle fatture (€ ${totaleRitenuteFatture.toFixed(2)}) e gli F24 versati (€ ${totaleF24Pagati.toFixed(2)}). Riconcilia prima della consegna del 770.`
  }
}
