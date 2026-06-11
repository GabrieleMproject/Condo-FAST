// src/hooks/usePreventivo.js
import { useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

// Ripartizione annua: { [unita_id]: importo } a partire dalle voci di preventivo.
// helpers da useMillesimi: getMillesimiUnita(tabellaId, unitaId), getTotaleTabella(tabellaId)
export function calcRipartizione(voci, unitaList, getMillesimiUnita, getTotaleTabella) {
  const tot = {}
  unitaList.forEach((u) => { tot[u.id] = 0 })
  voci.forEach((v) => {
    const imp = parseFloat(v.importo || 0)
    if (imp <= 0) return
    if (v.criterio === 'parti_uguali') {
      const q = unitaList.length ? imp / unitaList.length : 0
      unitaList.forEach((u) => { tot[u.id] += q })
    } else {
      const totTab = getTotaleTabella(v.tabella_millesimale_id) || 0
      unitaList.forEach((u) => {
        const m = parseFloat(getMillesimiUnita(v.tabella_millesimale_id, u.id) || 0)
        tot[u.id] += totTab > 0 ? imp * (m / totTab) : 0
      })
    }
  })
  return tot
}

export function usePreventivo(condominioId, esercizioId) {
  const [preventivo, setPreventivo] = useState(null)
  const [voci, setVoci] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetch = useCallback(async () => {
    if (!esercizioId) { setPreventivo(null); setVoci([]); return }
    setLoading(true); setError(null)
    try {
      const { data, error } = await supabase
        .from('preventivi')
        .select('*, preventivo_voci(*)')
        .eq('esercizio_id', esercizioId)
        .maybeSingle()
      if (error) throw error
      setPreventivo(data || null)
      setVoci((data?.preventivo_voci || []).sort((a, b) => (a.ordine || 0) - (b.ordine || 0)))
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [esercizioId])

  const creaPreventivo = useCallback(async () => {
    const { data, error } = await supabase
      .from('preventivi')
      .insert({ condominio_id: condominioId, esercizio_id: esercizioId })
      .select('*, preventivo_voci(*)')
      .single()
    if (error) throw error
    setPreventivo(data); setVoci([])
    return data
  }, [condominioId, esercizioId])

  const aggiungiVoce = useCallback(async (voce) => {
    if (!preventivo) throw new Error('Crea prima il preventivo')
    const { data, error } = await supabase
      .from('preventivo_voci')
      .insert({
        preventivo_id: preventivo.id,
        descrizione: voce.descrizione,
        categoria: voce.categoria || null,
        importo: parseFloat(voce.importo) || 0,
        criterio: voce.criterio || 'millesimi',
        tabella_millesimale_id: voce.criterio === 'parti_uguali' ? null : (voce.tabella_millesimale_id || null),
        ordine: voci.length,
      })
      .select().single()
    if (error) throw error
    setVoci((prev) => [...prev, data])
    return data
  }, [preventivo, voci])

  const aggiornaVoce = useCallback(async (id, patch) => {
    const clean = { ...patch }
    if (clean.importo !== undefined) clean.importo = parseFloat(clean.importo) || 0
    if (clean.criterio === 'parti_uguali') clean.tabella_millesimale_id = null
    const { data, error } = await supabase
      .from('preventivo_voci').update(clean).eq('id', id).select().single()
    if (error) throw error
    setVoci((prev) => prev.map((v) => (v.id === id ? data : v)))
    return data
  }, [])

  const eliminaVoce = useCallback(async (id) => {
    const { error } = await supabase.from('preventivo_voci').delete().eq('id', id)
    if (error) throw error
    setVoci((prev) => prev.filter((v) => v.id !== id))
  }, [])

  // Genera rate (colonne) + rate_unita (celle).
  // scadenze: [{ numero, scadenza, descrizione, importo }] — gli importi devono sommare al totale.
  const generaRate = useCallback(async ({ scadenze, unitaList, getMillesimiUnita, getTotaleTabella }) => {
    if (!preventivo) throw new Error('Crea prima il preventivo')
    if (!voci.length) throw new Error('Aggiungi almeno una voce di spesa')
    if (!unitaList.length) throw new Error('Il condominio non ha unità')
    const totale = round2(voci.reduce((s, v) => s + (parseFloat(v.importo) || 0), 0))
    if (totale <= 0) throw new Error('Il totale del preventivo è zero')
    const sommaScad = round2(scadenze.reduce((s, x) => s + (parseFloat(x.importo) || 0), 0))
    if (Math.abs(sommaScad - totale) > 0.01) {
      throw new Error(`La somma delle rate (${sommaScad}) non coincide col totale del preventivo (${totale})`)
    }

    const perUnita = calcRipartizione(voci, unitaList, getMillesimiUnita, getTotaleTabella)

    // Celle per unità: residuo sull'ultima rata → la somma per unità torna esatta.
    const n = scadenze.length
    const cellByUnit = {}
    unitaList.forEach((u) => {
      const T = perUnita[u.id] || 0
      const arr = []; let acc = 0
      scadenze.forEach((s, i) => {
        const p = totale > 0 ? (parseFloat(s.importo) || 0) / totale : 0
        if (i < n - 1) { const v = round2(T * p); arr.push(v); acc += v }
        else arr.push(round2(T - acc))
      })
      cellByUnit[u.id] = arr
    })
    const rataTotali = scadenze.map((_, i) =>
      round2(unitaList.reduce((s, u) => s + (cellByUnit[u.id][i] || 0), 0)))

    // Rigenera: cancella le rate di questo preventivo (rate_unita in CASCADE).
    const { error: errDel } = await supabase.from('rate').delete().eq('preventivo_id', preventivo.id)
    if (errDel) throw errDel

const rateRows = scadenze.map((s, i) => ({
  esercizio_id: preventivo.esercizio_id,
  preventivo_id: preventivo.id,
  condominio_id: condominioId,
  numero_rata: s.numero,
  data_scadenza: s.scadenza,
  percentuale: totale > 0 ? round2((rataTotali[i] / totale) * 100) : 0,
  descrizione: s.descrizione || `Rata ${s.numero}`,
}))

    const { data: rateCreate, error: errRate } = await supabase.from('rate').insert(rateRows).select()
    if (errRate) throw errRate

    const idByNumero = {}
    rateCreate.forEach((r) => { idByNumero[r.numero_rata] = r.id })
    const celle = []
unitaList.forEach((u) => scadenze.forEach((s, i) => celle.push({
  rata_id: idByNumero[s.numero],
  unita_id: u.id,
  condominio_id: condominioId,
  importo: cellByUnit[u.id][i],
  stato: 'non_pagata',
})))

    const { error: errCelle } = await supabase.from('rate_unita').insert(celle)
    if (errCelle) throw errCelle

    await supabase.from('preventivi').update({ totale, stato: 'approvato' }).eq('id', preventivo.id)
    setPreventivo((p) => ({ ...p, totale, stato: 'approvato' }))
    return { totale, nRate: rateCreate.length, nCelle: celle.length }
  }, [preventivo, voci, condominioId])

  const totale = round2(voci.reduce((s, v) => s + (parseFloat(v.importo) || 0), 0))

  return {
    preventivo, voci, totale, loading, error,
    fetch, creaPreventivo, aggiungiVoce, aggiornaVoce, eliminaVoce, generaRate,
  }
}