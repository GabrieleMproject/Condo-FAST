// src/lib/notificheEngine.js
// Motore puro di calcolo dei promemoria temporali.
// Riceve le impostazioni e i dati grezzi dal DB, restituisce array Notifica[].
// Non ha side effects — testabile isolatamente.

const MESI_IT = [
  'Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
  'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'
]

function nomeMese(idx) { return MESI_IT[idx] ?? '' }

/**
 * Calcola i promemoria F24 per ritenute d'acconto.
 *
 * Logica fiscale (art. 25 DPR 600/73, verificata con AdE):
 * - Scadenza: 16 del mese successivo al pagamento della fattura
 * - Il promemoria appare dal 1° del mese successivo fino al giorno 16 incluso
 * - Si chiude automaticamente se tutte le fatture del mese hanno f24_presentato = true
 *
 * @param {object} settings - { enabled: bool }
 * @param {Array}  fatture  - righe da fatture_fornitori con ritenuta_acconto > 0
 * @param {Date}   oggi
 * @returns {Array<Notifica>}
 */
export function calcolaF24Ritenute(settings, fatture, oggi = new Date()) {
  if (!settings?.enabled) return []

  // Determina il mese precedente (quello per cui va presentato l'F24)
  const meseCorrente = oggi.getMonth()   // 0-based
  const annoCorrente = oggi.getFullYear()

  // Il promemoria è attivo dal 1° al 16 del mese corrente
  const giornoCorrente = oggi.getDate()
  if (giornoCorrente > 16) return [] // scadenza già passata

  const mesePrecedente = meseCorrente === 0 ? 11 : meseCorrente - 1
  const annoPrecedente = meseCorrente === 0 ? annoCorrente - 1 : annoCorrente

  // Fatture pagate nel mese precedente con ritenuta e F24 non ancora presentato
  const fattureConRitenuta = fatture.filter(f => {
    if (!f.ritenuta_acconto || parseFloat(f.ritenuta_acconto) <= 0) return false
    if (f.f24_presentato === true) return false
    if (f.stato !== 'pagata') return false

    // Verifica che la data di pagamento sia nel mese precedente
    const dataPag = f.data_pagamento ? new Date(f.data_pagamento) : null
    if (!dataPag || isNaN(dataPag)) return false
    return dataPag.getMonth() === mesePrecedente && dataPag.getFullYear() === annoPrecedente
  })

  if (fattureConRitenuta.length === 0) return []

  const totaleRitenute = fattureConRitenuta.reduce(
    (s, f) => s + parseFloat(f.ritenuta_acconto || 0), 0
  )

  // Raggruppa per condominio
  const perCondominio = {}
  fattureConRitenuta.forEach(f => {
    const cid = f.condominio_id
    if (!perCondominio[cid]) {
      perCondominio[cid] = {
        condominioId: cid,
        condominioNome: f.condomini?.nome || `Condominio ${cid?.slice(0, 8)}`,
        count: 0,
        totale: 0,
      }
    }
    perCondominio[cid].count++
    perCondominio[cid].totale += parseFloat(f.ritenuta_acconto || 0)
  })

  return Object.values(perCondominio).map(({ condominioId, condominioNome, count, totale }) => {
    const giorniRimanenti = 16 - giornoCorrente
    const isUrgente = giornoCorrente >= 11

    return {
      id: `f24_${condominioId}_${annoPrecedente}-${String(mesePrecedente + 1).padStart(2, '0')}`,
      tipo: 'f24_ritenute',
      severita: isUrgente ? 'danger' : 'warning',
      titolo: isUrgente 
        ? `Urgenza F24 Anti-Ravvedimento (Scadenza tra ${giorniRimanenti} giorn${giorniRimanenti === 1 ? 'o' : 'i'})` 
        : 'Allerta Anti-Ravvedimento F24 — Scadenza 16 del mese',
      messaggio: isUrgente
        ? `${count} fattur${count === 1 ? 'a' : 'e'} pagat${count === 1 ? 'a' : 'e'} a ${nomeMese(mesePrecedente)} con ritenuta (totale: €${totale.toFixed(2)}). Versa l'F24 entro il 16 ${nomeMese(meseCorrente)} per evitare sanzioni ed interessi dell'Agenzia delle Entrate.`
        : `${count} fattur${count === 1 ? 'a' : 'e'} pagat${count === 1 ? 'a' : 'e'} a ${nomeMese(mesePrecedente)} con ritenuta (totale: €${totale.toFixed(2)}). Predisponi il versamento F24 entro il 16 ${nomeMese(meseCorrente)} per evitare il ravvedimento operoso.`,
      condominioId,
      condominioNome,
      link: `/condomini/${condominioId}/fatture`,
      data: oggi,
    }
  })
}

/**
 * Calcola i promemoria per rate scadute non pagate.
 *
 * @param {object} settings - { enabled: bool, giorni_dopo_scadenza: number }
 * @param {Array}  rateUnita - righe da rate_unita con join rate → esercizi → condomini
 * @param {Date}   oggi
 * @returns {Array<Notifica>}
 */
export function calcolaRateScadute(settings, rateUnita, oggi = new Date()) {
  if (!settings?.enabled) return []

  const giorniSoglia = settings.giorni_dopo_scadenza ?? 10
  const oggiMs = oggi.getTime()

  // Raggruppa le rate problematiche per condominio
  const perCondominio = {}

  rateUnita.forEach(ru => {
    if (ru.stato === 'pagata') return
    if (!ru.scadenza) return

    const scadenza = new Date(ru.scadenza)
    if (isNaN(scadenza)) return

    const giorniPassati = Math.floor((oggiMs - scadenza.getTime()) / (1000 * 60 * 60 * 24))
    if (giorniPassati < giorniSoglia) return
    if (parseFloat(ru.dovuto || 0) <= 0) return

    const condominioId = ru.rate?.esercizi?.condominio_id || ru.condominio_id
    const condominioNome = ru.rate?.esercizi?.condomini?.nome || `Condominio`

    if (!condominioId) return

    if (!perCondominio[condominioId]) {
      perCondominio[condominioId] = {
        condominioId,
        condominioNome,
        count: 0,
        totaleInsoluto: 0,
        maxGiorni: 0,
      }
    }
    perCondominio[condominioId].count++
    perCondominio[condominioId].totaleInsoluto += parseFloat(ru.dovuto || 0)
    perCondominio[condominioId].maxGiorni = Math.max(
      perCondominio[condominioId].maxGiorni, giorniPassati
    )
  })

  return Object.values(perCondominio).map(({ condominioId, condominioNome, count, totaleInsoluto, maxGiorni }) => ({
    id: `rate_scadute_${condominioId}_${oggi.getFullYear()}-${oggi.getMonth()}`,
    tipo: 'rate_scadute',
    severita: 'error',
    titolo: 'Rate scadute — Verifica pagamenti',
    messaggio: `${count} unit${count === 1 ? 'à' : 'à'} con rate scadute da oltre ${giorniSoglia} giorni (max: ${maxGiorni} gg). Totale insoluto: €${totaleInsoluto.toFixed(2)}. Aggiorna l'estratto conto.`,
    condominioId,
    condominioNome,
    link: `/condomini/${condominioId}/riconciliazioni-incassi`,
    data: oggi,
  }))
}

/**
 * Calcola i promemoria per esercizi in scadenza imminente.
 *
 * @param {object} settings  - { enabled: bool, giorni_prima: number }
 * @param {Array}  esercizi  - righe da esercizi con join condomini
 * @param {Date}   oggi
 * @returns {Array<Notifica>}
 */
export function calcolaEserciziInScadenza(settings, esercizi, oggi = new Date()) {
  if (!settings?.enabled) return []

  const giorniSoglia = settings.giorni_prima ?? 30
  const oggiMs = oggi.getTime()

  return esercizi
    .filter(e => {
      if (!e.data_fine) return false
      const fine = new Date(e.data_fine)
      if (isNaN(fine)) return false
      const giorniRimasti = Math.floor((fine.getTime() - oggiMs) / (1000 * 60 * 60 * 24))
      return giorniRimasti >= 0 && giorniRimasti <= giorniSoglia
    })
    .map(e => {
      const fine = new Date(e.data_fine)
      const giorniRimasti = Math.floor((fine.getTime() - oggiMs) / (1000 * 60 * 60 * 24))
      const condominioId = e.condominio_id
      const condominioNome = e.condomini?.nome || `Condominio`
      return {
        id: `esercizio_${e.id}_scadenza`,
        tipo: 'esercizio_in_scadenza',
        severita: giorniRimasti <= 7 ? 'error' : 'warning',
        titolo: 'Esercizio in scadenza',
        messaggio: `L'esercizio ${e.anno || ''} di ${condominioNome} termina ${giorniRimasti === 0 ? 'oggi' : `tra ${giorniRimasti} giorni`} (${fine.toLocaleDateString('it-IT')}). Prepara il consuntivo.`,
        condominioId,
        condominioNome,
        link: `/condomini/${condominioId}`,
        data: fine,
      }
    })
}

/**
 * Calcola i promemoria per movimenti bancari non riconciliati da troppo tempo.
 *
 * @param {object} settings       - { enabled: bool, giorni_tolleranza: number }
 * @param {Array}  movimenti      - righe da estratto_conto con riconciliato=false
 * @param {Date}   oggi
 * @returns {Array<Notifica>}
 */
export function calcolaMovimentiNonRiconciliati(settings, movimenti, oggi = new Date()) {
  if (!settings?.enabled) return []

  const giorniSoglia = settings.giorni_tolleranza ?? 15
  const oggiMs = oggi.getTime()

  // Raggruppa per condominio
  const perCondominio = {}

  movimenti.forEach(m => {
    if (m.riconciliato === true) return

    const dataMovimento = m.data ? new Date(m.data) : null
    if (!dataMovimento || isNaN(dataMovimento)) return

    const giorniPassati = Math.floor((oggiMs - dataMovimento.getTime()) / (1000 * 60 * 60 * 24))
    if (giorniPassati < giorniSoglia) return

    const condominioId = m.condominio_id
    const condominioNome = m.condomini?.nome || 'Condominio'
    if (!condominioId) return

    if (!perCondominio[condominioId]) {
      perCondominio[condominioId] = { condominioId, condominioNome, count: 0 }
    }
    perCondominio[condominioId].count++
  })

  return Object.values(perCondominio).map(({ condominioId, condominioNome, count }) => ({
    id: `movimenti_nr_${condominioId}_${oggi.getFullYear()}-${oggi.getMonth()}`,
    tipo: 'movimenti_non_riconciliati',
    severita: 'info',
    titolo: 'Movimenti non riconciliati',
    messaggio: `${count} moviment${count === 1 ? 'o' : 'i'} bancari di ${condominioNome} non riconciliati da oltre ${giorniSoglia} giorni.`,
    condominioId,
    condominioNome,
    link: `/condomini/${condominioId}/riconciliazioni`,
    data: oggi,
  }))
}

/**
 * Funzione principale — aggrega tutte le tipologie di notifiche.
 *
 * @param {object} settings  - notification_settings da profiles
 * @param {object} dati      - { fatture, rateUnita, esercizi, movimenti }
 * @param {Date}   oggi
 * @returns {Array<Notifica>}
 */
export function calcolaNotifiche(settings = {}, dati = {}, oggi = new Date()) {
  const s = settings || {}
  const { fatture = [], rateUnita = [], esercizi = [], movimenti = [] } = dati

  const tutte = [
    ...calcolaF24Ritenute(s.f24_ritenute, fatture, oggi),
    ...calcolaRateScadute(s.rate_scadute, rateUnita, oggi),
    ...calcolaEserciziInScadenza(s.esercizio_in_scadenza, esercizi, oggi),
    ...calcolaMovimentiNonRiconciliati(s.movimenti_non_riconciliati, movimenti, oggi),
  ]

  // Ordina: error → warning → info
  const ORDINE = { error: 0, warning: 1, info: 2 }
  return tutte.sort((a, b) => (ORDINE[a.severita] ?? 99) - (ORDINE[b.severita] ?? 99))
}
