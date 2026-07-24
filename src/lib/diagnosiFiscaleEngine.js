// src/lib/diagnosiFiscaleEngine.js
import { validaIbanItaliano, validaCodiceFiscaleOPiva } from './cbiValidator.js'

/**
 * Esegue un audit preventivo approfondito (zero chiamate AI) per valutare il grado
 * di completezza anagrafica e fiscale di un condominio.
 * 
 * @param {Object} params - { condominio, fornitori, unita, occupanti, fatture, f24Deleghe }
 * @returns {Object} { score, livello, anomalie, ok }
 */
export function eseguiDiagnosiConformitaFiscale({
  condominio,
  fornitori = [],
  unita = [],
  occupanti = [],
  fatture = [],
  f24Deleghe = []
}) {
  const anomalie = []
  let puntiTotali = 0
  let puntiSuperati = 0

  if (!condominio) {
    return {
      score: 0,
      livello: 'critico',
      anomalie: [{ id: 'no_condo', tipo: 'errore', titolo: 'Condominio non selezionato', descrizione: 'Nessun dato condominio fornito.', categoria: 'condominio' }],
      ok: false
    }
  }

  // ── 1. VERIFICA CONDOMINIO ─────────────────────────────────────────────
  puntiTotali += 3
  
  if (!condominio.codice_fiscale) {
    anomalie.push({
      id: 'c_cf_mancante',
      tipo: 'errore',
      titolo: 'Codice Fiscale Condominio Mancante',
      descrizione: 'Il condominio non possiede un Codice Fiscale registrato. Tutti gli adempimenti fiscali (CU, 770, F24) saranno bloccati.',
      categoria: 'condominio'
    })
  } else if (!validaCodiceFiscaleOPiva(condominio.codice_fiscale)) {
    anomalie.push({
      id: 'c_cf_errato',
      tipo: 'errore',
      titolo: 'Codice Fiscale Condominio Non Valido',
      descrizione: `Il Codice Fiscale "${condominio.codice_fiscale}" non rispetta il formato standard ministeriale.`,
      categoria: 'condominio'
    })
  } else {
    puntiSuperati += 1
  }

  if (!condominio.iban) {
    anomalie.push({
      id: 'c_iban_mancante',
      tipo: 'errore',
      titolo: 'IBAN di Addebito Mancante',
      descrizione: 'Il conto corrente del condominio non ha un IBAN registrato per il pagamento telematico degli F24.',
      categoria: 'condominio'
    })
  } else if (!validaIbanItaliano(condominio.iban)) {
    anomalie.push({
      id: 'c_iban_errato',
      tipo: 'errore',
      titolo: 'IBAN Condominio Non Valido (Check MOD-97 Fallito)',
      descrizione: `L'IBAN "${condominio.iban}" presenta errori formali. La banca scarterà qualsiasi distinta di addebito.`,
      categoria: 'condominio'
    })
  } else {
    puntiSuperati += 1
  }

  if (!condominio.indirizzo || !condominio.cap || !condominio.citta) {
    anomalie.push({
      id: 'c_indirizzo_incompleto',
      tipo: 'warning',
      titolo: 'Indirizzo Condominio Incompleto',
      descrizione: 'Indirizzo, CAP o Città non completamente specificati per la compilazione dei quadri telematici.',
      categoria: 'condominio'
    })
  } else {
    puntiSuperati += 1
  }

  // ── 2. VERIFICA FORNITORI ASSOCIATI ───────────────────────────────────
  puntiTotali += 2
  const fornitoriCondo = fornitori.filter(f => 
    fatture.some(fat => fat.condominio_id === condominio.id && (fat.fornitore_id === f.id || fat.fornitore === f.ragione_sociale))
  )

  const fornitoriSenzaPiva = fornitoriCondo.filter(f => !f.partita_iva && !f.codice_fiscale)
  if (fornitoriSenzaPiva.length > 0) {
    anomalie.push({
      id: 'f_piva_mancante',
      tipo: 'errore',
      titolo: `${fornitoriSenzaPiva.length} Fornitore/i Senza Partita IVA / CF`,
      descrizione: `Fornitori coinvolti in compensi erogati privi di identificativo fiscale: ${fornitoriSenzaPiva.map(f => f.ragione_sociale).slice(0, 3).join(', ')}.`,
      categoria: 'fornitori'
    })
  } else {
    puntiSuperati += 1
  }

  const fornitoriSenzaRegime = fornitoriCondo.filter(f => f.regime_forfettario === undefined || f.regime_forfettario === null)
  if (fornitoriSenzaRegime.length > 0) {
    anomalie.push({
      id: 'f_regime_mancante',
      tipo: 'warning',
      titolo: `Regime Fiscale Non Specificato per ${fornitoriSenzaRegime.length} Fornitori`,
      descrizione: 'Specificare se il fornitore è in regime ordinario o forfettario/esente per il calcolo corretto delle ritenute.',
      categoria: 'fornitori'
    })
  } else {
    puntiSuperati += 1
  }

  // ── 3. VERIFICA UNITÀ & ANAGRAFICA CONDÒMINI (QUADRO AC / 770) ───────
  puntiTotali += 2
  const unitaCondo = unita.filter(u => u.condominio_id === condominio.id)
  const unitaSenzaCatasto = unitaCondo.filter(u => !u.foglio || !u.particella)
  
  if (unitaSenzaCatasto.length > 0) {
    anomalie.push({
      id: 'u_catasto_incompleto',
      tipo: 'warning',
      titolo: `${unitaSenzaCatasto.length} Unità con Dati Catastali Mancanti`,
      descrizione: 'Mancano Foglio o Particella in alcune unità. I dati sono richiesti per la comunicazione del Quadro AC nell\'Anagrafe Tributaria.',
      categoria: 'anagrafica'
    })
  } else {
    puntiSuperati += 1
  }

  const occupantiCondo = occupanti.filter(o => unitaCondo.some(u => u.id === o.unita_id))
  const occupantiSenzaCf = occupantiCondo.filter(o => !o.persona?.codice_fiscale && !o.codice_fiscale)
  
  if (occupantiSenzaCf.length > 0) {
    anomalie.push({
      id: 'a_cf_mancante',
      tipo: 'warning',
      titolo: `${occupantiSenzaCf.length} Condòmino/i o Proprietario/i Senza Codice Fiscale`,
      descrizione: 'Alcune anagrafiche dei condòmini non hanno il Codice Fiscale compilato.',
      categoria: 'anagrafica'
    })
  } else {
    puntiSuperati += 1
  }

  // ── 4. VERIFICA RITENUTE & DELEGHE F24 ──────────────────────────────────
  puntiTotali += 2
  const fattureCondo = fatture.filter(f => f.condominio_id === condominio.id)
  const fattureSoggette = fattureCondo.filter(f => parseFloat(f.importo_ritenuta || f.ritenuta_acconto || 0) > 0 && f.stato === 'pagata')
  const fattureSenzaQuietanza = fattureSoggette.filter(f => !f.ritenuta_pagata && !f.f24_url)

  if (fattureSenzaQuietanza.length > 0) {
    anomalie.push({
      id: 'fis_ritenute_in_attesa',
      tipo: 'warning',
      titolo: `${fattureSenzaQuietanza.length} Ritenuta/e d'Acconto in Attesa di F24 Pagato`,
      descrizione: 'Ci sono compensi saldati per i quali la quietanza F24 non è ancora stata registrata.',
      categoria: 'fiscale'
    })
  } else {
    puntiSuperati += 1
  }

  const f24DaPagareScaduti = f24Deleghe.filter(d => 
    d.condominio_id === condominio.id && 
    d.stato === 'da_pagare' && 
    d.data_scadenza && 
    d.data_scadenza < new Date().toISOString().split('T')[0]
  )

  if (f24DaPagareScaduti.length > 0) {
    anomalie.push({
      id: 'fis_f24_scaduti',
      tipo: 'errore',
      titolo: `${f24DaPagareScaduti.length} Delega/he F24 Scaduta/e Non Ancora Saldata/e`,
      descrizione: 'Presenti modelli F24 con data di scadenza passata per i quali occorre procedere al versamento o ravvedimento.',
      categoria: 'fiscale'
    })
  } else {
    puntiSuperati += 1
  }

  // ── CALCOLO SCORE & LIVELLO ────────────────────────────────────────────
  const score = Math.max(0, Math.min(100, Math.round((puntiSuperati / puntiTotali) * 100)))
  
  let livello = 'eccellente'
  if (score < 50) livello = 'critico'
  else if (score < 75) livello = 'attenzione'
  else if (score < 95) livello = 'buono'

  const erroriCritici = anomalie.filter(a => a.tipo === 'errore')

  return {
    score,
    livello,
    totaleControlli: puntiTotali,
    controlliSuperati: puntiSuperati,
    anomalie,
    ok: erroriCritici.length === 0
  }
}
