// src/lib/morositaEngine.js
/**
 * Motore di Calcolo Morosità & Recupero Crediti per CondoFast
 * - Calcolo analitico interessi legali (art. 1284 c.c.) e di mora (D.Lgs. 231/2002) giorno per giorno
 * - Scaglioni progressivi personalizzabili per singolo condominio
 * - Addebito spese amministrative e gestione pratica di sollecito (art. 1129 c. 14 c.c.)
 * - Tracciamento delle spese incassate dai morosi e liquidabili allo studio
 * - Generazione dinamica dei testi per 1° Sollecito Bonario, 2° Sollecito con Messa in Mora e Diffida Legale (art. 63 disp. att. c.c.)
 */

import { formattaData, formattaValuta } from './formatters.js'

// Tassi di interesse ufficiali predefiniti
export const TASSI_PREDEFINITI = {
  LEGALE_MEF: {
    id: 'legale_mef',
    nome: 'Tasso di Interesse Legale (D.M. MEF - Art. 1284 c.c.)',
    descrizione: 'Tasso legale stabilito annualmente dal Ministero dell\'Economia e delle Finanze',
    valore: 2.50, // 2.50% annuo
  },
  MORA_COMMERCIALE: {
    id: 'mora_commerciale',
    nome: 'Tasso di Mora Commerciale (D.Lgs. 231/2002)',
    descrizione: 'Tasso BCE maggiorato di 8 punti percentuali per transazioni commerciali',
    valore: 10.50, // BCE (2.50%) + 8% = 10.50%
  },
  PERSONALIZZATO: {
    id: 'personalizzato',
    nome: 'Tasso Personalizzato / Deliberato da Regolamento',
    descrizione: 'Tasso specifico approvato dall\'assemblea o previsto nel regolamento contrattuale',
    valore: 5.00,
  }
}

// Configurazione predefinita dei 3 livelli per un condominio
export const DEFAULT_MOROSITA_CONFIG = {
  // Tasso di interesse predefinito
  tassoTipo: 'legale_mef',
  tassoPersonalizzatoValore: 2.50,

  // Scaglione 1: 1° Sollecito Bonario (Promemoria)
  livello1: {
    nome: '1° Sollecito Bonario',
    minGiorniRitardo: 10,
    maxGiorniRitardo: 30,
    speseAmministrative: 0.00,
    giorniTerminePagamento: 10,
    tono: 'bonario'
  },

  // Scaglione 2: 2° Sollecito con Messa in Mora
  livello2: {
    nome: '2° Sollecito di Pagamento (Messa in Mora)',
    minGiorniRitardo: 31,
    maxGiorniRitardo: 90,
    speseAmministrative: 15.00,
    giorniTerminePagamento: 10,
    tono: 'formale'
  },

  // Scaglione 3: Diffida Legale ad Adempiere (Art. 63 Disp. Att. c.c.)
  livello3: {
    nome: 'Diffida ad Adempiere & Costituzione in Mora (Art. 63 c.c.)',
    minGiorniRitardo: 91,
    speseAmministrative: 35.00,
    giorniTerminePagamento: 7,
    tono: 'legale'
  },

  // Coordinate bancarie e impostazioni generali
  notePersonalizzate: '',
}

/**
 * Estrae la configurazione del condominio o restituisce i default
 */
export function getCondominioMorositaConfig(condominio) {
  if (!condominio) return { ...DEFAULT_MOROSITA_CONFIG }
  
  if (condominio.config_morosita && typeof condominio.config_morosita === 'object') {
    return {
      ...DEFAULT_MOROSITA_CONFIG,
      ...condominio.config_morosita,
      livello1: { ...DEFAULT_MOROSITA_CONFIG.livello1, ...(condominio.config_morosita.livello1 || {}) },
      livello2: { ...DEFAULT_MOROSITA_CONFIG.livello2, ...(condominio.config_morosita.livello2 || {}) },
      livello3: { ...DEFAULT_MOROSITA_CONFIG.livello3, ...(condominio.config_morosita.livello3 || {}) },
    }
  }

  // Fallback se salvato in note JSON
  if (condominio.note) {
    try {
      const parsed = JSON.parse(condominio.note)
      if (parsed.config_morosita) {
        return {
          ...DEFAULT_MOROSITA_CONFIG,
          ...parsed.config_morosita,
          livello1: { ...DEFAULT_MOROSITA_CONFIG.livello1, ...(parsed.config_morosita.livello1 || {}) },
          livello2: { ...DEFAULT_MOROSITA_CONFIG.livello2, ...(parsed.config_morosita.livello2 || {}) },
          livello3: { ...DEFAULT_MOROSITA_CONFIG.livello3, ...(parsed.config_morosita.livello3 || {}) },
        }
      }
    } catch {
      // note non è json
    }
  }

  return { ...DEFAULT_MOROSITA_CONFIG }
}

/**
 * Ottiene il tasso % numerico applicabile in base alla config
 */
export function getTassoApplicato(config) {
  if (!config) return TASSI_PREDEFINITI.LEGALE_MEF.valore
  if (config.tassoTipo === 'mora_commerciale') return TASSI_PREDEFINITI.MORA_COMMERCIALE.valore
  if (config.tassoTipo === 'personalizzato') return parseFloat(config.tassoPersonalizzatoValore || 5.0)
  return TASSI_PREDEFINITI.LEGALE_MEF.valore
}

/**
 * Calcola i giorni di ritardo tra la data di scadenza e la data di riferimento (oggi)
 */
export function calcolaGiorniRitardo(dataScadenzaStr, dataRiferimento = new Date()) {
  if (!dataScadenzaStr) return 0
  const scad = new Date(dataScadenzaStr)
  scad.setHours(0, 0, 0, 0)
  
  const rif = new Date(dataRiferimento)
  rif.setHours(0, 0, 0, 0)

  const diffTime = rif.getTime() - scad.getTime()
  if (diffTime <= 0) return 0
  return Math.floor(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Calcola l'interesse maturato per una singola rata
 * Formula deterministica: (Capitale * TassoAnnuale * GiorniRitardo) / (365 * 100)
 */
export function calcolaInteresseRata(capitaleInsoluto, tassoPercentuale, giorniRitardo) {
  const cap = parseFloat(capitaleInsoluto || 0)
  const tasso = parseFloat(tassoPercentuale || 0)
  const gg = parseInt(giorniRitardo || 0, 10)

  if (cap <= 0 || tasso <= 0 || gg <= 0) return 0
  const interesse = (cap * tasso * gg) / (365 * 100)
  return Math.round((interesse + Number.EPSILON) * 100) / 100
}

/**
 * Determina lo scaglione / livello di sollecito suggerito in base ai giorni massimi di ritardo
 */
export function determinaLivelloSollecito(giorniMaxRitardo, config = DEFAULT_MOROSITA_CONFIG) {
  const gg = parseInt(giorniMaxRitardo || 0, 10)
  const minL2 = config.livello2?.minGiorniRitardo ?? 31
  const minL3 = config.livello3?.minGiorniRitardo ?? 91

  if (gg >= minL3) return 3 // Diffida Legale
  if (gg >= minL2) return 2 // 2° Sollecito con spese
  return 1 // 1° Sollecito bonario
}

/**
 * Calcola l'analisi completa della morosità per una singola unità immobiliare
 */
export function calcolaMorositaUnita({
  unita,
  rateUnita = [],
  rate = [],
  configPagante = {},
  configMorosita = DEFAULT_MOROSITA_CONFIG,
  dataRiferimento = new Date(),
  comunicazioniPrecedenti = []
}) {
  const rateMap = {}
  rate.forEach(r => { rateMap[r.id] = r })

  const tassoAnnuale = getTassoApplicato(configMorosita)

  // Calcola dettaglio di tutte le rate associate all'unità
  const rateDettaglio = []
  let totaleDovuto = 0
  let totalePagato = 0
  let totaleCapitaleInsoluto = 0
  let totaleInteressiMaturati = 0
  let maxGiorniRitardo = 0
  let rateScaduteCount = 0

  rateUnita.forEach(ru => {
    const r = rateMap[ru.rata_id] || {}
    const importo = parseFloat(ru.importo || 0)
    const pagato = parseFloat(ru.importo_pagato || 0)
    const residuo = Math.max(0, Math.round((importo - pagato + Number.EPSILON) * 100) / 100)
    
    totaleDovuto += importo
    totalePagato += pagato

    const giorniRitardo = r.data_scadenza ? calcolaGiorniRitardo(r.data_scadenza, dataRiferimento) : 0
    const isScaduta = giorniRitardo > 0 && residuo > 0.01

    let interesse = 0
    if (isScaduta) {
      interesse = calcolaInteresseRata(residuo, tassoAnnuale, giorniRitardo)
      totaleInteressiMaturati += interesse
      totaleCapitaleInsoluto += residuo
      rateScaduteCount++
      if (giorniRitardo > maxGiorniRitardo) {
        maxGiorniRitardo = giorniRitardo
      }
    }

    rateDettaglio.push({
      rataId: ru.rata_id,
      cellId: ru.id,
      numeroRata: r.numero_rata || 1,
      descrizione: r.descrizione || `Rata ${r.numero_rata || 1}`,
      dataScadenza: r.data_scadenza || null,
      importo,
      importoPagato: pagato,
      capitaleInsoluto: residuo,
      giorniRitardo,
      isScaduta,
      tassoApplicato: tassoAnnuale,
      interesseMaturato: interesse,
      totaleRataConInteressi: Math.round((residuo + interesse + Number.EPSILON) * 100) / 100,
      stato: ru.stato || 'non_pagata'
    })
  })

  // Ordina le rate cronologicamente
  rateDettaglio.sort((a, b) => (a.numeroRata || 0) - (b.numeroRata || 0))

  const rateScaduteList = rateDettaglio.filter(r => r.isScaduta)

  // Soggetto debitore responsabile del pagamento (Proprietario o Inquilino in base a config_pagante)
  const paganteTipo = configPagante[unita.id] || 'proprietario'
  const occupanti = unita.occupanti_unita || []
  
  const propOcc = occupanti.find(o => o.ruolo === 'proprietario' && o.attivo) || occupanti.find(o => o.ruolo === 'proprietario')
  const inqOcc = occupanti.find(o => o.ruolo === 'inquilino' && o.attivo) || occupanti.find(o => o.ruolo === 'inquilino')

  const proprietario = propOcc?.persona || null
  const inquilino = inqOcc?.persona || null
  const debitore = (paganteTipo === 'inquilino' && inquilino) ? inquilino : (proprietario || null)

  // Determina livello suggerito
  const livelloSuggerito = determinaLivelloSollecito(maxGiorniRitardo, configMorosita)

  // Spese applicabili per il livello
  let speseApplicate = 0
  let giorniTermine = 10
  if (livelloSuggerito === 1) {
    speseApplicate = parseFloat(configMorosita.livello1?.speseAmministrative || 0)
    giorniTermine = parseInt(configMorosita.livello1?.giorniTerminePagamento || 10, 10)
  } else if (livelloSuggerito === 2) {
    speseApplicate = parseFloat(configMorosita.livello2?.speseAmministrative || 15)
    giorniTermine = parseInt(configMorosita.livello2?.giorniTerminePagamento || 10, 10)
  } else if (livelloSuggerito === 3) {
    speseApplicate = parseFloat(configMorosita.livello3?.speseAmministrative || 35)
    giorniTermine = parseInt(configMorosita.livello3?.giorniTerminePagamento || 7, 10)
  }

  // Totale complessivo dovuto = Capitale insoluto + Interessi + Spese
  const totaleComplessivoRichiesto = Math.round((totaleCapitaleInsoluto + totaleInteressiMaturati + speseApplicate + Number.EPSILON) * 100) / 100

  // Verifica se la morosità è critica (>180 giorni / oltre 6 mesi ex art. 63 comma 1 e comma 3 disp. att. c.c.)
  const isOltreSeiMesi = maxGiorniRitardo >= 180

  // Filtra storico comunicazioni per questa unità / persona
  const comunicazioniUnita = (comunicazioniPrecedenti || []).filter(c => {
    const matchEmail = debitore?.email && c.destinatario_email?.toLowerCase() === debitore.email.toLowerCase()
    const matchUnita = c.oggetto?.includes(`Unità ${unita.numero}`) || c.messaggio?.includes(`Unità ${unita.numero}`)
    return matchEmail || matchUnita
  })

  return {
    unita,
    debitore,
    proprietario,
    inquilino,
    paganteTipo,
    totaleDovuto: Math.round((totaleDovuto + Number.EPSILON) * 100) / 100,
    totalePagato: Math.round((totalePagato + Number.EPSILON) * 100) / 100,
    totaleCapitaleInsoluto: Math.round((totaleCapitaleInsoluto + Number.EPSILON) * 100) / 100,
    totaleInteressiMaturati: Math.round((totaleInteressiMaturati + Number.EPSILON) * 100) / 100,
    speseApplicate: Math.round((speseApplicate + Number.EPSILON) * 100) / 100,
    totaleComplessivoRichiesto,
    maxGiorniRitardo,
    rateScaduteCount,
    rateScaduteList,
    rateDettaglio,
    livelloSuggerito,
    giorniTermine,
    isOltreSeiMesi,
    haMorosita: totaleCapitaleInsoluto > 0.01,
    tassoApplicato: tassoAnnuale,
    comunicazioniUnita,
    ultimoSollecito: comunicazioniUnita[0] || null
  }
}

/**
 * Calcola statistiche globali morosità per l'intero condominio
 */
export function calcolaMorositaCondominio({
  unitaList = [],
  rateUnitaList = [],
  rateList = [],
  configPagante = {},
  configMorosita = DEFAULT_MOROSITA_CONFIG,
  comunicazioniList = [],
  dataRiferimento = new Date(),
  speseLiquidateIds = []
}) {
  const morosi = []
  let totaleInsolutoCondominio = 0
  let totaleInteressiCondominio = 0
  let totaleSpesePotenziali = 0
  let unitaMoroseCount = 0
  let unitaGraviCount = 0 // >6 mesi

  let conteggioLivello1 = 0
  let conteggioLivello2 = 0
  let conteggioLivello3 = 0

  unitaList.forEach(u => {
    const unitaRateCells = rateUnitaList.filter(ru => ru.unita_id === u.id)
    const morosita = calcolaMorositaUnita({
      unita: u,
      rateUnita: unitaRateCells,
      rate: rateList,
      configPagante,
      configMorosita,
      dataRiferimento,
      comunicazioniPrecedenti: comunicazioniList
    })

    if (morosita.haMorosita) {
      morosi.push(morosita)
      totaleInsolutoCondominio += morosita.totaleCapitaleInsoluto
      totaleInteressiCondominio += morosita.totaleInteressiMaturati
      totaleSpesePotenziali += morosita.speseApplicate
      unitaMoroseCount++
      if (morosita.isOltreSeiMesi) unitaGraviCount++

      if (morosita.livelloSuggerito === 1) conteggioLivello1++
      else if (morosita.livelloSuggerito === 2) conteggioLivello2++
      else if (morosita.livelloSuggerito === 3) conteggioLivello3++
    }
  })

  // Ordina i morosi per gravità (giorni ritardo decrescente e importo decrescente)
  morosi.sort((a, b) => (b.maxGiorniRitardo - a.maxGiorniRitardo) || (b.totaleCapitaleInsoluto - a.totaleCapitaleInsoluto))

  const percentualeUnitaMorose = unitaList.length > 0
    ? Math.round((unitaMoroseCount / unitaList.length) * 100)
    : 0

  // Calcolo delle Spese di Sollecito Incassate e Liquidabili allo Studio:
  const praticheSaldate = []
  let totaleSpeseIncassateLiquidabili = 0

  // Tracciamento da comunicazioni pregresse inviate
  ;(comunicazioniList || []).forEach(comm => {
    if (comm.tipo === 'sollecito' || comm.tipo === 'sollecito_cartaceo' || comm.tipo === 'diffida') {
      const matchUnitaNumero = comm.oggetto?.match(/Unità\s+([A-Za-z0-9\-\/]+)/i)
      const numeroUnita = matchUnitaNumero ? matchUnitaNumero[1] : null
      const u = unitaList.find(un => un.numero?.toString().toLowerCase() === numeroUnita?.toLowerCase())
      
      if (u) {
        // Verifica se l'unità ha saldato le rate
        const unitaRateCells = rateUnitaList.filter(ru => ru.unita_id === u.id)
        const insolutoResiduo = unitaRateCells.reduce((s, c) => s + Math.max(0, parseFloat(c.importo || 0) - parseFloat(c.importo_pagato || 0)), 0)
        
        // Se l'insoluto è saldato (< 0.01) e c'erano spese applicate nel sollecito
        const spesaStimata = comm.oggetto?.includes('DIFFIDA') || comm.oggetto?.includes('Diffida') ? 35 : (comm.oggetto?.includes('2°') ? 15 : 0)
        const isLiquidato = speseLiquidateIds.includes(comm.id)

        if (insolutoResiduo <= 0.01 && spesaStimata > 0) {
          praticheSaldate.push({
            comunicazioneId: comm.id,
            dataInvio: comm.created_at,
            destinatario: comm.destinatario_nome,
            unitaNumero: u.numero,
            importoSpesa: spesaStimata,
            oggetto: comm.oggetto,
            liquidato: isLiquidato
          })

          if (!isLiquidato) {
            totaleSpeseIncassateLiquidabili += spesaStimata
          }
        }
      }
    }
  })

  return {
    morosi,
    totaleInsolutoCondominio: Math.round((totaleInsolutoCondominio + Number.EPSILON) * 100) / 100,
    totaleInteressiCondominio: Math.round((totaleInteressiCondominio + Number.EPSILON) * 100) / 100,
    totaleSpesePotenziali: Math.round((totaleSpesePotenziali + Number.EPSILON) * 100) / 100,
    totaleComplessivoRecuperabile: Math.round((totaleInsolutoCondominio + totaleInteressiCondominio + totaleSpesePotenziali + Number.EPSILON) * 100) / 100,
    unitaMoroseCount,
    totaleUnitaCount: unitaList.length,
    percentualeUnitaMorose,
    unitaGraviCount,
    conteggioLivello1,
    conteggioLivello2,
    conteggioLivello3,
    praticheSaldate,
    totaleSpeseIncassateLiquidabili: Math.round((totaleSpeseIncassateLiquidabili + Number.EPSILON) * 100) / 100
  }
}

/**
 * Genera l'oggetto e il testo completo HTML & PlainText della lettera per i 3 livelli
 */
export function generaLetteraSollecito({
  livello = 1,
  morositaUnita,
  condominio,
  esercizio,
  studioProfile = {},
  opzioniOverride = {}
}) {
  const u = morositaUnita.unita
  const dest = morositaUnita.debitore || {}
  const nomeCondo = condominio?.nome || 'Condominio'
  const annoEs = esercizio?.anno || new Date().getFullYear()
  const nomeDest = `${dest.nome || ''} ${dest.cognome || ''}`.trim() || 'Condòmino'
  const scalaText = u.scala ? `Scala ${u.scala}, ` : ''
  const pianoText = u.piano !== undefined && u.piano !== null ? `Piano ${u.piano}, ` : ''
  const unitaIdentificativo = `${scalaText}${pianoText}Interno ${u.numero || '—'}`
  const ruoloLabel = morositaUnita.paganteTipo === 'inquilino' ? 'inquilino pagante' : 'proprietario'
  const iban = opzioniOverride.iban || condominio?.iban || ''
  const cfCondominio = condominio?.codice_fiscale || ''
  
  const tassoPercentuale = opzioniOverride.tassoPercentuale ?? morositaUnita.tassoApplicato ?? 2.50
  const speseApplicate = opzioniOverride.speseApplicate ?? morositaUnita.speseApplicate ?? 0.00
  const giorniTermine = opzioniOverride.giorniTermine ?? morositaUnita.giorniTermine ?? (livello === 3 ? 7 : 10)
  const dataRif = opzioniOverride.dataRiferimento || new Date()

  const capInsoluto = morositaUnita.totaleCapitaleInsoluto || 0
  const intMaturati = morositaUnita.totaleInteressiMaturati || 0
  const totRichiesto = Math.round((capInsoluto + intMaturati + speseApplicate + Number.EPSILON) * 100) / 100

  // Righe tabella rate formattate
  const righeRateHtml = morositaUnita.rateScaduteList.map(r => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">${r.descrizione}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${formattaData(r.dataScadenza)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 600;">${formattaValuta(r.capitaleInsoluto)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #ef4444;">${r.giorniRitardo} gg</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #3b82f6;">${formattaValuta(r.interesseMaturato)}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">${formattaValuta(r.totaleRataConInteressi)}</td>
    </tr>
  `).join('')

  let oggetto = ''
  let testoHtml = ''

  if (livello === 1) {
    // ── LIVELLO 1: 1° SOLLECITO BONARIO (PROMEMORIA CORDIALE) ──
    oggetto = `Sollecito bonario pagamento quote condominiali - ${nomeCondo} (Unità ${u.numero})`
    testoHtml = `
      <p>Gentile <strong>${nomeDest}</strong>,</p>
      <p>dalle periodiche verifiche contabili relative alla gestione del <strong>${nomeCondo}</strong> (Esercizio ${annoEs}), per l'unità immobiliare <strong>${unitaIdentificativo}</strong> in Sua qualità di <em>${ruoloLabel}</em>, non risulta ad oggi pervenuto il versamento delle quote condominiali di seguito elencate:</p>
      
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #1e293b; text-align: left;">
            <th style="padding: 8px 12px;">Rata / Descrizione</th>
            <th style="padding: 8px 12px; text-align: center;">Scadenza</th>
            <th style="padding: 8px 12px; text-align: right;">Quota Capitale</th>
            <th style="padding: 8px 12px; text-align: center;">Ritardo</th>
            <th style="padding: 8px 12px; text-align: right;">Interessi</th>
            <th style="padding: 8px 12px; text-align: right;">Totale Rata</th>
          </tr>
        </thead>
        <tbody>
          ${righeRateHtml}
        </tbody>
      </table>

      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 4px 0; font-size: 14px;"><strong>Totale Quote Insolute:</strong> ${formattaValuta(capInsoluto)}</p>
        ${intMaturati > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #64748b;">Interessi di mora maturati (${tassoPercentuale}% a.a.): ${formattaValuta(intMaturati)}</p>` : ''}
        <p style="margin: 8px 0 0; font-size: 16px; font-weight: 700; color: #0f172a;">TOTALE DA CORRISPONDERE: ${formattaValuta(totRichiesto)}</p>
      </div>

      <p>Certi che si tratti di una semplice svista, La invitiamo a voler provvedere alla regolarizzazione del saldo entro <strong>${giorniTermine} giorni</strong> dal ricevimento della presente mediante bonifico bancario.</p>

      ${iban ? `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <div style="font-weight: 700; color: #1e40af; margin-bottom: 4px;">Coordinate per il Pagamento:</div>
        <div><strong>Intestazione:</strong> ${nomeCondo}</div>
        ${cfCondominio ? `<div><strong>Codice Fiscale Condominio:</strong> ${cfCondominio}</div>` : ''}
        <div style="font-family: monospace; font-size: 15px; font-weight: 700; color: #1d4ed8; margin: 6px 0;">IBAN: ${iban}</div>
        <div><strong>Causale:</strong> Saldo quote esercizio ${annoEs} - Unità ${u.numero} ${nomeDest}</div>
      </div>
      ` : ''}

      <p style="font-size: 12px; color: #64748b;"><em>Qualora il pagamento fosse già stato effettuato nei giorni immediatamente precedenti, La preghiamo di considerare nulla la presente comunicazione e di trasmettercene cortese quietanza.</em></p>
      
      <p style="margin-top: 24px;">Distinti saluti,<br/><strong>L'Amministrazione Condominiale</strong><br/>${studioProfile.studio_nome || studioProfile.ragione_sociale || ''}</p>
    `
  } else if (livello === 2) {
    // ── LIVELLO 2: 2° SOLLECITO DI PAGAMENTO CON MESSA IN MORA & ADDEBITO SPESE ──
    oggetto = `2° SOLLECITO DI PAGAMENTO E MESSA IN MORA - ${nomeCondo} (Unità ${u.numero})`
    testoHtml = `
      <p>Gentile <strong>${nomeDest}</strong>,</p>
      <p>facciamo seguito al precedente promemoria inviato e constatiamo con rammarico che, alla data odierna, per l'unità immobiliare <strong>${unitaIdentificativo}</strong> presso il <strong>${nomeCondo}</strong> non è ancora pervenuto il pagamento delle quote condominiali scadute.</p>
      
      <p>Di seguito si riporta il prospetto analitico aggiornato delle quote insolute e degli interessi maturati:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <thead>
          <tr style="background-color: #f1f5f9; color: #1e293b; text-align: left;">
            <th style="padding: 8px 12px;">Rata / Descrizione</th>
            <th style="padding: 8px 12px; text-align: center;">Scadenza</th>
            <th style="padding: 8px 12px; text-align: right;">Quota Capitale</th>
            <th style="padding: 8px 12px; text-align: center;">Ritardo</th>
            <th style="padding: 8px 12px; text-align: right;">Interessi (${tassoPercentuale}%)</th>
            <th style="padding: 8px 12px; text-align: right;">Totale Rata</th>
          </tr>
        </thead>
        <tbody>
          ${righeRateHtml}
        </tbody>
      </table>

      <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <p style="margin: 4px 0; font-size: 14px;"><strong>Totale Quote Capitale Insolute:</strong> ${formattaValuta(capInsoluto)}</p>
        <p style="margin: 4px 0; font-size: 14px; color: #b91c1c;"><strong>Interessi Legali/Moratori calcolati al ${formattaData(dataRif)}:</strong> ${formattaValuta(intMaturati)}</p>
        ${speseApplicate > 0 ? `<p style="margin: 4px 0; font-size: 14px; color: #b91c1c;"><strong>Spese amministrative di sollecito e gestione pratica (art. 1129 c.c.):</strong> ${formattaValuta(speseApplicate)}</p>` : ''}
        <div style="border-top: 1px solid #f87171; margin-top: 8px; padding-top: 8px;">
          <p style="margin: 0; font-size: 17px; font-weight: 800; color: #991b1b;">TOTALE COMPLESSIVO DOVUTO: ${formattaValuta(totRichiesto)}</p>
        </div>
      </div>

      <p>La presente vale quale <strong>formale atto di costituzione in mora</strong> ai sensi dell'art. 1219 del Codice Civile. La invitiamo e diffidiamo a voler provvedere al versamento integrale dell'importo sopra indicato entro e non oltre <strong>${giorniTermine} giorni</strong> dal ricevimento della presente.</p>
      
      <p>Decorso infruttuosamente tale termine senza che sia intervenuto il saldo, saremo costretti, nostro malgrado, ad adire le vie legali per il recupero forzoso del credito con ulteriore e gravoso aggravio di spese legali a Suo esclusivo carico.</p>

      ${iban ? `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <div style="font-weight: 700; color: #1e40af; margin-bottom: 4px;">Coordinate Bancarie per il Saldo:</div>
        <div><strong>Intestazione:</strong> ${nomeCondo}</div>
        ${cfCondominio ? `<div><strong>Codice Fiscale Condominio:</strong> ${cfCondominio}</div>` : ''}
        <div style="font-family: monospace; font-size: 15px; font-weight: 700; color: #1d4ed8; margin: 6px 0;">IBAN: ${iban}</div>
        <div><strong>Causale:</strong> Saldo morosità quote esercizio ${annoEs} - Unità ${u.numero} ${nomeDest}</div>
      </div>
      ` : ''}

      <p style="margin-top: 24px;">Distinti saluti,<br/><strong>L'Amministrazione Condominiale</strong><br/>${studioProfile.studio_nome || studioProfile.ragione_sociale || ''}</p>
    `
  } else {
    // ── LIVELLO 3: DIFFIDA LEGALE AD ADEMPIERE & COSTITUZIONE IN MORA (ART. 63 DISP. ATT. C.C.) ──
    oggetto = `DIFFIDA AD ADEMPIERE E COSTITUZIONE IN MORA (Art. 1219 c.c. - Art. 63 Disp. Att. c.c.) - ${nomeCondo}`
    testoHtml = `
      <p>Spett.le <strong>${nomeDest}</strong>,<br/>
      ${dest.codice_fiscale ? `C.F.: <strong>${dest.codice_fiscale}</strong><br/>` : ''}
      ${dest.residenza_indirizzo || dest.indirizzo ? `Residente in: ${dest.residenza_indirizzo || dest.indirizzo} ${dest.residenza_cap || dest.cap || ''} ${dest.residenza_comune || dest.citta || ''}<br/>` : ''}
      In qualità di <em>${ruoloLabel}</em> dell'unità immobiliare: <strong>${unitaIdentificativo}</strong> del <strong>${nomeCondo}</strong>.</p>
      
      <h3 style="color: #991b1b; border-bottom: 2px solid #991b1b; padding-bottom: 6px; margin-top: 20px;">OGGETTO: DIFFIDA AD ADEMPIERE E COSTITUZIONE IN MORA EX ART. 1219 C.C. ED ART. 63 DISP. ATT. C.C.</h3>

      <p>In nome, per conto e nell'interesse del <strong>${nomeCondo}</strong> (C.F. ${cfCondominio || '—'}), con la presente si formula formale atto di <strong>DIFFIDA AD ADEMPIERE E COSTITUZIONE IN MORA</strong> in relazione al grave e perdurante inadempimento nel pagamento degli oneri condominiali afferenti l'unità sopra indicata.</p>

      <p>Dalle scritture contabili ufficiali risulta che ad oggi permangono insolute le seguenti rate:</p>

      <table style="width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px;">
        <thead>
          <tr style="background-color: #fee2e2; color: #7f1d1d; text-align: left;">
            <th style="padding: 8px 12px;">Rata / Descrizione</th>
            <th style="padding: 8px 12px; text-align: center;">Scadenza</th>
            <th style="padding: 8px 12px; text-align: right;">Quota Capitale</th>
            <th style="padding: 8px 12px; text-align: center;">Ritardo</th>
            <th style="padding: 8px 12px; text-align: right;">Interessi Mora (${tassoPercentuale}%)</th>
            <th style="padding: 8px 12px; text-align: right;">Totale Rata</th>
          </tr>
        </thead>
        <tbody>
          ${righeRateHtml}
        </tbody>
      </table>

      <div style="background-color: #fef2f2; border: 2px solid #ef4444; border-radius: 8px; padding: 16px 20px; margin: 18px 0;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px;">
          <span>Totale Quota Capitale Insoluta:</span>
          <strong>${formattaValuta(capInsoluto)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 14px; color: #b91c1c;">
          <span>Interessi moratori maturati (al ${formattaData(dataRif)}):</span>
          <strong>${formattaValuta(intMaturati)}</strong>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; color: #b91c1c;">
          <span>Diritti di segreteria, spese diffida e gestione pratica (art. 1129 c.c.):</span>
          <strong>${formattaValuta(speseApplicate)}</strong>
        </div>
        <div style="border-top: 2px solid #ef4444; padding-top: 10px; display: flex; justify-content: space-between; font-size: 18px; font-weight: 800; color: #7f1d1d;">
          <span>TOTALE DA VERSARE A SALDO:</span>
          <span>${formattaValuta(totRichiesto)}</span>
        </div>
      </div>

      <p style="font-weight: 700; color: #7f1d1d; font-size: 15px;">INTIMAZIONE E DIFFIDA:</p>
      <p>La S.V. è formalmente <strong>DIFFIDATA ED INTIMATA</strong> ai sensi e per gli effetti dell'art. 1219 c.c. a versare la somma complessiva di <strong>${formattaValuta(totRichiesto)}</strong> entro e non oltre il termine perentorio di <strong>${giorniTermine} (sette) giorni</strong> dal ricevimento della presente comunicazione.</p>

      <p style="font-weight: 700; color: #991b1b;">ESPRESSO AVVERTIMENTO DI LEGGE:</p>
      <ul>
        <li><strong>Decreto Ingiuntivo Immediatamente Esecutivo:</strong> In difetto di integrale pagamento entro il termine assegnato, senza ulteriore preavviso né necessità di autorizzazione assembleare, lo scrivente Amministratore conferirà mandato al legale di fiducia dello stabile per il deposito presso il Tribunale competente del ricorso per <strong>DECRETO INGIUNTIVO PROVVISORIAMENTE ESECUTIVO ai sensi dell'art. 63, comma 1, disp. att. c.c.</strong>, con integrale addebito di spese legali, diritti, onorari di causa e successivi atti esecutivi e di pignoramento.</li>
        <li><strong>Sospensione dei Servizi Comuni:</strong> Ai sensi dell'<strong>art. 63, comma 3, disp. att. c.c.</strong>, in caso di mora nel pagamento dei contributi che si sia protratta per oltre un semestre, l'amministratore procederà alla <strong>sospensione del condòmino moroso dalla fruizione dei servizi comuni suscettibili di godimento separato</strong>.</li>
      </ul>

      ${iban ? `
      <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 16px 0;">
        <div style="font-weight: 700; color: #1e40af; margin-bottom: 4px;">Coordinate Bancarie Condominiali:</div>
        <div><strong>Intestatario:</strong> ${nomeCondo}</div>
        ${cfCondominio ? `<div><strong>C.F. Condominio:</strong> ${cfCondominio}</div>` : ''}
        <div style="font-family: monospace; font-size: 15px; font-weight: 700; color: #1d4ed8; margin: 6px 0;">IBAN: ${iban}</div>
        <div><strong>Causale Obbligatoria:</strong> Saldo diffida quote esercizio ${annoEs} - Unità ${u.numero} ${nomeDest}</div>
      </div>
      ` : ''}

      <p style="margin-top: 24px;">Luogo e Data: ${condominio?.citta || 'Lì'}, ${formattaData(dataRif)}</p>
      
      <p style="margin-top: 24px;">In fede,<br/><strong>L'Amministratore del Condominio</strong><br/>${studioProfile.studio_nome || studioProfile.ragione_sociale || ''}</p>
    `
  }

  return {
    oggetto,
    testoHtml,
    datiCalcolo: {
      totaleCapitaleInsoluto: capInsoluto,
      totaleInteressiMaturati: intMaturati,
      speseApplicate,
      totaleComplessivoRichiesto: totRichiesto,
      tassoPercentuale,
      giorniTermine,
      iban,
      cfCondominio
    }
  }
}
